#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""八字/八法起名 API（REQ-094 · POST /api/namer/name）。

交互契约：用户选一个**已排盘**的档案 + 姓氏（必填）+ 起名方向（选填）→ 后端
读取该档案八字画像 → LLM 依五行喜忌起名（名字部分**不含姓氏 1~2 字**）。

计费契约（对齐 pair.py / agent.py 即时扣费语义）：
  - 鉴权 Bearer；body {case_id:int, surname:str, direction?:str}；
  - 档案归属校验（非本人/不存在 404）→ 档案无八字（未排盘）→ 400 提示先生成
    （**不自动生成**）→ check_balance 预检（余额不足抛 BizError 5002，全局处理器
    转 502 信封，不放行 LLM）→ LLM chat（json_mode=True，system =
    prompts/namer/master.md）→ 成功即时扣费（consume ref=naming，1 存储单位 =
    1000 tokens，ceil）→ 返回名字列表。
  - LLM 失败（LLMError/ValueError）→ 502，**不扣费**；起名结果无持久化（不落库），
    ref 用固定清晰值 `naming`（labels.parse_ref 未收录 → 流水标签回退「消耗」）。

字数硬约束（prompt 强制 + 后端兜底校验）：
  - 名字部分（不含姓氏）必须是 **1~2 个字**：1 字姓 → 全名 2~3 字；2 字姓 →
    全名 3~4 字；姓氏字数在请求层校验（1~2 字）。
  - 兜底策略（_generate_names_with_fallback）：LLM 返回的名字列表逐条校验；
    全部不合法 → 携带「上一轮不合规 + 硬约束重申」的纠正消息**重试一次**；
    重试仍全部不合法 → 取首个非空候选**裁剪到 2 字**兜底返回（adjusted=true
    标注，裁剪保留末 2 字——违规输出多为「姓+名」拼接，首字更像姓氏）；
    连可裁剪候选都没有（空结果/解析失败）→ 抛 ValueError 转 502，不扣费。
"""
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.pair import _bazi_digest
from app.auth.router import get_user_id_from_token
from app.credits.service import check_balance, consume
from app.database import get_analytics_db
from app.llm import LLMError, chat
from app.models import Case, Chart

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["namer"])

# 起名系统提示词（backend/prompts/namer/master.md，已纳入后台 REQ-048）
# namer.py 位于 backend/app/api/，parents[2] = backend
NAMER_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "namer" / "master.md"

# 名字部分（不含姓氏）字数硬约束：1~2 字
MIN_NAME_LEN, MAX_NAME_LEN = 1, 2
# LLM 返回候选上限（防超长响应把裁剪/解析拖慢）
MAX_CANDIDATES = 10
# 兜底重试次数（首轮 + 1 次纠正重试）
MAX_ATTEMPTS = 2

# 清洗名字时剔除的常见标点/空白（保留汉字与极少数可入名符号）
_PUNCT = set("，。、！？；：“”‘’\"'（）()《》〈〉【】[]{}·—…,.:;!? \t\r\n")


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_case(db: Session, case_id: int, user_id: int) -> Case:
    """按 id+user_id 取档案（多用户隔离）；不存在/非本人抛 404"""
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")
    return case


def _load_namer_prompt() -> str:
    """读取 prompts/namer/master.md；缺失视为配置错误（RuntimeError，向上抛 500）"""
    try:
        text = NAMER_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"起名提示词缺失或不可读: {NAMER_PROMPT_PATH}") from exc
    if not text.strip():
        raise RuntimeError(f"起名提示词为空: {NAMER_PROMPT_PATH}")
    return text


# --------------------------------------------------------------------------- #
# 名字解析 / 字数校验 / 兜底
# --------------------------------------------------------------------------- #
def _clean_name(raw: str) -> str:
    """清洗单个名字：去空白与常见标点，保留汉字候选字符。"""
    return "".join(ch for ch in (raw or "") if ch not in _PUNCT and ch.strip())


def _valid_name(name: str) -> bool:
    """名字部分（不含姓氏）字数硬约束：1~2 字。"""
    return MIN_NAME_LEN <= len(name) <= MAX_NAME_LEN


def _extract_json_object(text: str) -> Optional[str]:
    """从 LLM 输出里抠出 JSON 对象文本：先剥 ```json 围栏，再取首 { 到末 }。

    解析失败（无 { / 无 }）返回 None，由调用方按 LLM 质量失败处理。
    """
    if not text:
        return None
    if text.lstrip().startswith("```"):
        # 剥掉代码围栏（```json ... ```）
        lines = text.strip().splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    return text[start:end + 1]


def _parse_names(text: str) -> tuple[list[tuple[str, str]], str]:
    """解析 LLM JSON `{"names": [{name, reason}, ...], "notes": str}`。

    返回 (清洗后的 [(name, reason), ...], notes)；解析失败抛 ValueError
    （上层按 LLM 质量失败转 502，不扣费）。
    """
    obj_text = _extract_json_object(text)
    if obj_text is None:
        raise ValueError(f"起名响应不是 JSON: {text[:120]!r}")
    try:
        data = json.loads(obj_text)
    except ValueError as exc:
        raise ValueError(f"起名响应 JSON 解析失败: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("起名响应不是 JSON 对象")
    raw_names = data.get("names")
    if not isinstance(raw_names, list):
        raise ValueError("起名响应缺少 names 数组")
    items: list[tuple[str, str]] = []
    for n in raw_names[:MAX_CANDIDATES]:
        if isinstance(n, dict):
            nm = _clean_name(str(n.get("name") or ""))
            reason = str(n.get("reason") or "")
        else:
            nm = _clean_name(str(n))
            reason = ""
        if nm:
            items.append((nm, reason))
    notes = str(data.get("notes") or "")
    return items, notes


def _charge_naming(user_id: int, total_tokens: int) -> None:
    """LLM 调用成功后按实际 token 扣费（ref=naming）；失败只记日志不阻断结果。"""
    tokens = int(total_tokens or 0)
    if tokens <= 0:
        logger.info("起名无 token 消耗，跳过扣费 user_id=%s", user_id)
        return
    try:
        consume(user_id, tokens, ref="naming")
    except Exception as exc:
        logger.error("起名扣费失败 user_id=%s tokens=%s error=%s", user_id, tokens, exc)


async def _generate_names_with_fallback(system_prompt: str, user_payload: dict,
                                        surname: str):
    """LLM 起名 + 字数硬约束兜底（重试一次 → 裁剪）。

    返回 {"names": [{"name","full","adjusted","reason"}], "notes", "total_tokens"}；
    两次调用都无可用名字（空结果/解析失败）→ 抛 ValueError（上层转 502 不扣费）。
    """
    base_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]
    all_items: list[tuple[str, str]] = []
    total_tokens = 0
    last_raw = ""
    messages = base_messages

    for _attempt in range(MAX_ATTEMPTS):
        resp = await chat(messages, json_mode=True)
        total_tokens += int(resp["usage"]["total_tokens"] or 0)
        last_raw = resp["content"]
        # 解析失败（非 JSON/缺 names）不立刻判死：本轮视作无合规名字，进纠正重试
        try:
            items, notes = _parse_names(last_raw)
        except ValueError:
            items, notes = [], ""
        all_items.extend(items)
        if any(_valid_name(nm) for nm, _ in all_items):
            break
        # 本轮仍无合规名字：带纠正说明重试一次（保留首轮输出作为 assistant 上下文）
        messages = base_messages + [
            {"role": "assistant", "content": last_raw},
            {
                "role": "user",
                "content": (
                    f"上一轮输出的名字字数不合法：名字部分（不含姓氏）必须是 "
                    f"{MIN_NAME_LEN}~{MAX_NAME_LEN} 个字，禁止把姓氏拼进名字。"
                    f"请重新输出合规的 JSON，只给 {MIN_NAME_LEN}~{MAX_NAME_LEN} 字候选。"
                ),
            },
        ]

    # ① 优先取全部合规候选（去重保序）
    valid = [(nm, reason) for nm, reason in all_items if _valid_name(nm)]
    if valid:
        seen, chosen = set(), []
        for nm, reason in valid:
            if nm in seen:
                continue
            seen.add(nm)
            chosen.append((nm, reason))
        return _build_result(chosen, notes, surname=surname, adjusted=False,
                             total_tokens=total_tokens)

    # ② 全不合规（且非空）→ 取首个非空候选裁剪到 2 字兜底（保留末 2 字）
    for nm, reason in all_items:
        if nm:
            cropped = nm[-MAX_NAME_LEN:]
            return _build_result([(cropped, reason)], notes, surname=surname,
                                 adjusted=True, total_tokens=total_tokens)

    # ③ 两次调用都没有任何可裁剪内容（空结果/解析失败）→ 视为 LLM 质量失败
    raise ValueError("起名 LLM 未产出任何可用名字")


def _build_result(chosen: list[tuple[str, str]], notes: str, *, surname: str,
                  adjusted: bool, total_tokens: int) -> dict:
    """组装返回结构：names 含 name（不含姓氏）/full（含姓氏）/reason/adjusted。"""
    return {
        "names": [
            {"name": nm, "full": surname + nm, "reason": reason, "adjusted": adjusted}
            for nm, reason in chosen
        ],
        "notes": notes,
        "adjusted": adjusted,
        "total_tokens": total_tokens,
    }


# --- 请求模型 ---
class NamerRequest(BaseModel):
    case_id: int = Field(description="档案 id（须本人所有且已排盘）")
    surname: str = Field(description="姓氏（必填，1~2 个字，不含在名字字数约束内）")
    direction: Optional[str] = Field(
        default=None, max_length=50, description="起名方向（选填，如 五行补益/诗意/事业吉祥）"
    )


# --- 路由 ---
@router.post("/namer/name")
async def generate_name(
    body: NamerRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """八字/八法起名（LLM 可选付费，即时扣费）：归属校验 → 未排盘 400 → 预检余额
    → chat（json_mode）→ 字数兜底 → 成功扣费（ref=naming）；LLM 失败 502 不扣费。"""
    user_id = get_user_id_from_token(authorization)

    # ① 参数校验：姓氏必填、1~2 字（字数硬约束的姓氏侧）
    surname = (body.surname or "").strip()
    if not surname:
        raise _err(400, "请填写姓氏（surname 不能为空）")
    if len(surname) > 2:
        raise _err(400, f"姓氏须为 1~2 个字（当前 {len(surname)} 个字）")
    surname_chars = len(surname)
    direction = (body.direction or "").strip() or None

    # ② 档案归属校验（id+user_id 隔离，非本人/不存在 → 404）
    case = _get_owned_case(db, body.case_id, user_id)

    # ③ 档案须已排盘（charts.chart_json 有八字）；未排盘 → 400 提示先生成，不自动生成
    chart_row = db.query(Chart).filter_by(case_id=case.id).first()
    if chart_row is None or not isinstance(chart_row.chart_json, dict):
        raise _err(400, f"该档案未排盘，请先生成八字排盘后再起名（case {case.id}）")
    profile = _bazi_digest(chart_row.chart_json)
    if not profile.get("dayMaster"):
        raise _err(400, f"该档案八字数据不完整，请重新排盘后再起名（case {case.id}）")

    # ④ 组装 user 载荷（surname + direction + 八字画像；五行喜忌由 LLM 依画像推导）
    user_payload = {
        "surname": surname,
        "surname_chars": surname_chars,
        "direction": direction,
        "bazi": profile,
    }

    # ⑤ 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ⑥ LLM 起名 + 字数兜底（内部最多两次 chat：首轮 + 纠正重试）
    try:
        result = await _generate_names_with_fallback(
            _load_namer_prompt(), user_payload, surname
        )
    except (LLMError, ValueError) as exc:
        # LLM 失败/质量失败：记日志 + 502，不扣费（对齐 pair.py 语义）
        logger.warning(
            "起名 LLM 调用失败 user_id=%s case_id=%s error=%s",
            user_id, body.case_id, exc,
        )
        raise _err(502, "起名服务暂不可用，请稍后重试")

    # ⑦ 即时扣费：chat 已成功，扣费失败只记日志不阻断结果返回
    _charge_naming(user_id, result["total_tokens"])

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "names": result["names"],
            "notes": result["notes"],
            "adjusted": result["adjusted"],
        },
    }
