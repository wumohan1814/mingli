#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时起卦 API 路由（横向扩展 Phase B）。

计费契约：
  - POST /api/divinations 起卦 = 确定性计算，免费：把 {method, ...seed} 转发给常驻
    排盘 Node 服务（paipan-node/server.mjs 的 POST /divination，vendored
    mingyu-core 六爻/梅花/小六壬/大六壬(liuren)/灵签/雷诺曼(lenormand)），成功后落
    divinations 表并写 divination_cast 埋点，零 LLM 零扣费。
  - GET /api/divinations/{id} 读单条 = 只读（零 LLM 零扣费），带 user_id 隔离。
  - POST /api/divinations/{id}/interpret 断卦 = LLM 可选付费：命中
    interpretation_json 缓存直接返回（零 LLM 零扣费）；未命中先 check_balance
    预检（余额不足抛 BizError 5002）→ LLM chat → 成功即时扣费
    （ref=divination:{id}）并把 {"content": 断卦文本} 写入 interpretation_json
    作为缓存。LLM 失败（LLMError/ValueError）→ 502，对齐 cases.py revise。
    REQ-118：method == liuren 时 body 可带 liuren_template（general/ganqing/shiye/
    caifu，对齐 vendored LIUREN_TEMPLATE_OPTIONS，缺省 general），随 user JSON 注入。
  - POST /api/divinations/{id}/focus 六爻焦点详解（REQ-075，仅 liuyao）= LLM 可选
    付费：body {focus} 六枚举（非法 400），逐项点击时 LLM 结合该盘 result
    （yaosDetail）+ S08 爻辞原文（user JSON 注入 yao_texts）做「该焦点在本盘意味着
    什么」的针对性解读。计费/缓存语义同 interpret：focus_interpretations 命中该
    focus → 直接返回（零 LLM 零扣费）；未命中 check_balance 预检 → chat
    (json_mode=False) → 成功即时扣费（ref=divination_focus:{id}:{focus}）→ 写回缓存
    → divination_focus_interpret 埋点。LLM 失败 → 502。
"""
import json
import logging
from pathlib import Path
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.router import get_user_id_from_token
from app.config import settings
from app.credits.service import check_balance, consume
from app.database import get_analytics_db
from app.events.service import record_event
from app.llm import LLMError, chat
from app.models import Case, Chart, Divination

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["divination"])

# 断卦 system prompt（backend/prompts/interpret/divination.md）
# divination.py 位于 backend/app/api/，parents[2] = backend
DIVINATION_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "interpret" / "divination.md"

# 雷诺曼解读 system prompt（backend/prompts/interpret/lenormand.md，method == lenormand 时使用）
LENORMAND_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "interpret" / "lenormand.md"

# 六爻焦点详解 system prompt（backend/prompts/interpret/divination_focus.md，
# 仅 REQ-075 POST /divinations/{id}/focus 使用）
DIVINATION_FOCUS_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "interpret" / "divination_focus.md"

# S08 爻辞数据（backend/app/data/liuyao_yaoci.json，随仓库部署；运行时零依赖 docs/）
# divination.py 位于 backend/app/api/，parents[1] = backend/app
LIUYAO_TEXTS_PATH = Path(__file__).resolve().parents[1] / "data" / "liuyao_yaoci.json"

# Node /divination 当前支持的方法（未知 method 在 pydantic 层提前拦成 400 参数错误）
DIVINATION_METHODS = ("liuyao", "meihua", "xiaoliuren", "liuren", "ssgw", "lenormand")

# REQ-075 焦点详解六枚举（稳定 key，前端逐项点击透传）
DIVINATION_FOCUS_KEYS = (
    "moving_yao",        # 动爻
    "shi_ying",          # 世应
    "kong_wang",         # 空亡·月破·日破
    "an_dong",           # 暗动
    "hui_tou_sheng_ke",  # 回头生克
    "hua_kong_hua_mu",   # 化空化墓
)
DIVINATION_FOCUS_KEYS_SET = frozenset(DIVINATION_FOCUS_KEYS)


def _load_liuyao_texts() -> dict:
    """S08 爻辞数据（模块加载一次，数据小放内存）。

    返回 {"by_name": {短卦名(如"乾"): 卦条目}, "by_full": {全名(如"乾为天"): 卦条目}}；
    by_full 为惰性缓存（全名→短名的确定性映射见 _gua_short_name）。
    文件缺失/损坏只记 warning 返回空索引（注入降级为空，不阻断端点），
    部署校验：backend/app/data/liuyao_yaoci.json 随仓库走，正常必在。
    """
    try:
        raw = json.loads(LIUYAO_TEXTS_PATH.read_text(encoding="utf-8"))
        hexagrams = raw.get("hexagrams") if isinstance(raw, dict) else None
    except (OSError, ValueError) as exc:
        logger.warning("六爻爻辞数据缺失或不可读，S08 注入降级为空: %s error=%s",
                       LIUYAO_TEXTS_PATH, exc)
        return {"by_name": {}, "by_full": {}}
    by_name: dict = {}
    if isinstance(hexagrams, list):
        for entry in hexagrams:
            if isinstance(entry, dict) and entry.get("name"):
                by_name[entry["name"]] = entry
    return {"by_name": by_name, "by_full": {}}


# S08 卦条目索引（模块加载一次）：by_name 短卦名 → 条目；by_full 全名 → 条目（惰性填充）
_LIUYAO_TEXTS = _load_liuyao_texts()

# 全名首部的先天八卦“象”字（六十四卦全名 = 上卦象 + 下卦象 + 短卦名，如“雷天大壮”；
# 纯卦例外形如“乾为天”，短名取“为”前的八卦名）
_GUA_NATURE_CHARS = "天泽火雷风水山地"


def _gua_short_name(full_name: str) -> str:
    """result 卦全名（如「雷天大壮」）→ S08 短卦名（如「大壮」）；无法识别返回空串。

    规则：纯卦「X为Y」（X ∈ 八卦名）→ X（乾为天→乾）；其余先剥掉开头的上/下卦
    “象”字（天泽火雷风水山地）即得短卦名（雷泽归妹→归妹）。64 卦全覆盖，
    由 tests 的 S08 注入用例兜底校验。
    """
    name = (full_name or "").strip()
    if not name:
        return ""
    if "为" in name:
        head = name.split("为", 1)[0]
        if len(head) == 1:
            return head
    return name.lstrip(_GUA_NATURE_CHARS) or name


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_divination(db: Session, div_id: int, user_id: int) -> Divination:
    """按 id+user_id 取起卦记录（多用户隔离）；不存在抛 404"""
    row = db.query(Divination).filter_by(id=div_id, user_id=user_id).first()
    if row is None:
        raise _err(404, "起卦记录不存在")
    return row


def _charge_llm(user_id: int, total_tokens, ref: str, what: str) -> None:
    """LLM 调用成功后按实际 token 扣费；失败只记日志不阻断结果（架构 §6.3 对账）。

    tokens <= 0（mock/零消耗）不产生流水，仅 info 日志。
    """
    tokens = int(total_tokens or 0)
    if tokens <= 0:
        logger.info("%s无 token 消耗，跳过扣费 user_id=%s ref=%s", what, user_id, ref)
        return
    try:
        consume(user_id, tokens, ref=ref)
    except Exception as exc:
        logger.error("%s扣费失败 user_id=%s tokens=%s ref=%s error=%s",
                     what, user_id, tokens, ref, exc)


def _load_divination_prompt(path: Path = DIVINATION_PROMPT_PATH) -> str:
    """读取断卦/解读 system prompt（method 决定选 divination.md 还是 lenormand.md）；
    缺失视为配置错误（RuntimeError，向上抛 500）。"""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"断卦提示词缺失或不可读: {path}") from exc
    if not text.strip():
        raise RuntimeError(f"断卦提示词为空: {path}")
    return text


def _chart_summary(chart_json) -> dict:
    """从 chart dict 投影一版简短摘要（字段与 cases.py _chart_summary 口径一致），
    供断卦注入；chart 缺失返回空 dict。"""
    if not isinstance(chart_json, dict):
        return {}
    bazi = chart_json.get("bazi") or {}
    calendar = chart_json.get("calendar") or {}
    meta = chart_json.get("meta") or {}
    return {
        "dayMaster": bazi.get("day_master") or "",
        "dayMasterWuxing": bazi.get("day_master_wuxing") or "",
        "solar": calendar.get("solar") or "",
        "lunar": calendar.get("lunar") or "",
        "pillars": bazi.get("pillars"),
        "degraded_methods": meta.get("degraded_methods") or [],
    }


def _case_chart_summary(db: Session, case_id: Optional[int]) -> Optional[dict]:
    """取关联 case 的 chart 摘要；无 case / case 未排盘（无 chart 行）→ None。"""
    if case_id is None:
        return None
    chart_row = db.query(Chart).filter_by(case_id=case_id).first()
    if chart_row is None or not isinstance(chart_row.chart_json, dict):
        return None
    return _chart_summary(chart_row.chart_json)


# --- 请求模型 ---
class CastDivinationRequest(BaseModel):
    method: Literal["liuyao", "meihua", "xiaoliuren", "liuren", "ssgw", "lenormand"] = Field(description="起卦方法（lenormand=雷诺曼，可无档案；liuren=大六壬）")
    case_id: Optional[int] = Field(default=None, description="关联国学档案（可空；国学类起卦要求有档案，MVP 允许空由前端拦截；lenormand 不要求）")
    seed: Optional[dict] = Field(default=None, description="报数/时间/摇卦等，原样透传 Node /divination；lenormand 的 seed 可带 spreadType（缺省 single）")


class InterpretDivinationRequest(BaseModel):
    """REQ-118 大六壬断课模板（仅 method == liuren 时生效；其余方法忽略）。

    对齐 vendored mingyu-core 的 LiurenTemplateType：general/ganqing/shiye/caifu。
    """
    liuren_template: Optional[Literal["general", "ganqing", "shiye", "caifu"]] = Field(
        default=None, description="大六壬断课模板：general=通用 / ganqing=感情 / shiye=事业 / caifu=财富；缺省 general")


class DivinationFocusRequest(BaseModel):
    """REQ-075 六爻焦点详解：focus 六枚举（非法值在端点校验 400）。"""
    focus: str = Field(description="焦点 key：moving_yao/shi_ying/kong_wang/an_dong/"
                                   "hui_tou_sheng_ke/hua_kong_hua_mu")


# --- REQ-075 S08 注入工具 ---
def _liuyao_entry(full_name: str) -> Optional[dict]:
    """result 卦名（全名或短名）→ S08 卦条目（含 guaCi/xiangCi/yaoCi）；找不到返回 None。

    by_full 惰性缓存命中结果，避免逐次重算短名映射。
    """
    if not full_name:
        return None
    name = full_name.strip()
    by_full = _LIUYAO_TEXTS["by_full"]
    if name in by_full:
        return by_full[name]
    by_name = _LIUYAO_TEXTS["by_name"]
    entry = by_name.get(name) or by_name.get(_gua_short_name(name))
    if entry is not None:
        by_full[name] = entry  # 惰性缓存（短名直接命中时同样缓存，量小无碍）
    return entry


def _moving_positions(result: dict):
    """从 result 取动爻爻位列表（1 起）；无法确定返回 None（→ 注入全部爻辞兜底）。

    优先取引擎 already 滤好的 changingYaos；缺失则回退 yaosDetail.isChanging；
    再回退 yaoArray 的老阳 9 / 老阴 6。全部缺失 → None（映射不确定）。
    """
    if not isinstance(result, dict):
        return None
    changing = result.get("changingYaos")
    if isinstance(changing, list) and changing:
        return sorted({
            int(y["position"]) for y in changing
            if isinstance(y, dict) and y.get("position") is not None
        })
    detail = result.get("yaosDetail")
    if isinstance(detail, list) and detail:
        from_detail = sorted({
            int(y["position"]) for y in detail
            if isinstance(y, dict) and y.get("isChanging") and y.get("position") is not None
        })
        return from_detail  # 有 yaosDetail 即以其 isChanging 为准（空 = 静卦，非不确定）
    arr = result.get("yaoArray")
    if isinstance(arr, list) and arr:
        if len(arr) != 6:  # 爻列长度异常 → 映射不确定
            return None
        positions = []
        for i, raw in enumerate(arr):
            try:
                value = int(raw)
            except (TypeError, ValueError):
                return None  # 含无法解析元素 → 不确定
            if value in (6, 9):  # 老阳 9 / 老阴 6 为动爻
                positions.append(i + 1)
        return positions
    return None


def _collect_yao_entries(entry: dict, positions) -> list:
    """S08 卦条目 → 动爻对应爻辞条目列表 [{position, yaoName, original, baihua}, ...]。

    positions None（映射不确定）→ 返回整卦全部 yaoCi（量小可接受）；position 越界/缺失
    （如乾/坤的用九/用六只在末位，不影响 1-6 爻位取用）时跳过该爻不注入。
    """
    yao_ci = entry.get("yaoCi") if isinstance(entry, dict) else None
    if not isinstance(yao_ci, list):
        return []
    if positions is None:
        return [
            {"position": idx + 1, "yaoName": y.get("name"), "original": y.get("original"),
             "baihua": y.get("baihua")}
            for idx, y in enumerate(yao_ci[:6])
            if isinstance(y, dict)
        ]
    picked = []
    for pos in positions:
        idx = int(pos) - 1
        if 0 <= idx < len(yao_ci) and isinstance(yao_ci[idx], dict):
            y = yao_ci[idx]
            picked.append({"position": int(pos), "yaoName": y.get("name"),
                           "original": y.get("original"), "baihua": y.get("baihua")})
    return picked


def _gua_text_digest(full_name: str, positions) -> Optional[dict]:
    """单个卦（本卦/变卦）→ 注入 digest：guaName + guaCi/xiangCi（baihua）
    + 动爻对应爻辞（original+baihua）；卦名找不到 → None。"""
    entry = _liuyao_entry(full_name)
    if entry is None:
        return None
    digest = {
        "guaName": entry.get("name"),
        "guaCi": (entry.get("guaCi") or {}).get("baihua"),
        "xiangCi": (entry.get("xiangCi") or {}).get("baihua"),
        "movingYaos": _collect_yao_entries(entry, positions),
    }
    return digest


def _build_yao_texts(result: dict) -> dict:
    """REQ-075 S08 注入：result 卦名 → 爻辞 digest（本卦/变卦并置）。

    本卦注入本卦动爻对应 yaoCi（original+baihua）+ guaCi/xiangCi（baihua）；
    变卦（changedName 非空且 ≠ 本卦）同理注入变卦卦辞 + 同爻位变爻爻辞。
    动爻位置映射不确定（positions=None）→ 注入整卦 6 条 yaoCi；静卦（无动爻）
    → 只注卦辞/大象不注爻辞；卦名识别失败 → 该卦缺省（不注入），不阻断解读。
    """
    if not isinstance(result, dict):
        return {}
    positions = _moving_positions(result)
    original_name = result.get("originalName") or result.get("name") or ""
    changed_name = result.get("changedName") or ""
    texts: dict = {}
    original_digest = _gua_text_digest(original_name, positions)
    if original_digest is not None:
        texts["original_gua"] = original_digest
    if changed_name and changed_name != original_name:
        changed_digest = _gua_text_digest(changed_name, positions)
        if changed_digest is not None:
            texts["changed_gua"] = changed_digest
    return texts


# --- 路由 ---
@router.post("/divinations")
def cast_divination(
    body: CastDivinationRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """起卦（确定性，免费，落库）：转发 Node /divination → 落 divinations 表 + 埋点"""
    user_id = get_user_id_from_token(authorization)

    # case 归属校验（case_id 非空时该 case 必须属于当前用户；MVP 允许空由前端拦截）
    case_id = body.case_id
    if case_id is not None:
        case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
        if case is None:
            raise _err(404, "case不存在")

    # ① 转发常驻排盘 Node 服务（server.mjs /divination）；seed 键原样透传。
    #    lenormand 的 spreadType 由 seed 提供（server.mjs 约定读 input.spreadType，
    #    非 settings），缺省 'single'；Node /divination 对非法 spreadType 返回 400。
    payload = {"method": body.method}
    seed = dict(body.seed or {})
    if body.method == "lenormand":
        spread_type = seed.pop("spreadType", None)
        payload["spreadType"] = spread_type if isinstance(spread_type, str) and spread_type else "single"
    payload.update(seed)
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/divination", json=payload, timeout=60)
    except Exception as exc:
        # 连接失败 / 超时等 → 网关错误，不吞成假结果、不落库
        logger.warning("临时起卦 Node 转发失败 user_id=%s method=%s error=%s",
                       user_id, body.method, exc)
        raise _err(502, "起卦服务暂不可用，请稍后重试")

    if resp.status_code != 200:
        logger.warning("临时起卦 Node 非 200 user_id=%s method=%s status=%s body=%s",
                       user_id, body.method, resp.status_code, resp.text[:200])
        raise _err(502, "起卦服务暂不可用，请稍后重试")

    node_result = resp.json()
    if not isinstance(node_result, dict):
        logger.warning("临时起卦 Node 返回结构异常 user_id=%s method=%s body=%s",
                       user_id, body.method, str(node_result)[:200])
        raise _err(502, "起卦服务暂不可用，请稍后重试")

    # ② 落库（确定性卦象免费持久化，供 GET 只读与 interpret 付费断卦复用）
    div = Divination(
        user_id=user_id,
        case_id=case_id,
        method=body.method,
        seed_json=body.seed,
        result_json=node_result,
    )
    db.add(div)
    db.commit()
    db.refresh(div)

    # ③ 埋点（写库失败静默，绝不阻断业务）；本功能零 LLM 零扣费
    record_event("divination_cast", user_id=user_id, case_id=case_id,
                 props={"method": body.method})

    return {"code": 0, "message": "ok",
            "data": {"id": div.id, "method": body.method, "result": node_result}}


@router.get("/divinations/{div_id}")
def get_divination(
    div_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """读单条起卦记录（只读，零 LLM）：id+user_id 隔离，查不到 404。"""
    user_id = get_user_id_from_token(authorization)
    div = _get_owned_divination(db, div_id, user_id)

    return {"code": 0, "message": "ok", "data": {
        "id": div.id,
        "method": div.method,
        "result": div.result_json,
        "interpretation": div.interpretation_json,
    }}


@router.post("/divinations/{div_id}/interpret")
async def interpret_divination(
    div_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
    body: Optional[InterpretDivinationRequest] = Body(default=None),
):
    """断卦（LLM 可选付费，即时扣费）：缓存优先，未命中预检余额 → chat → 扣费 → 缓存。

    REQ-118：method == liuren 时 body 可带 liuren_template（通用/感情/事业/财富，
    对齐 vendored LIUREN_TEMPLATE_OPTIONS，缺省 general），随 user JSON 注入断课 prompt；
    其余方法忽略 body（向后兼容无 body 调用）。
    """
    user_id = get_user_id_from_token(authorization)
    div = _get_owned_divination(db, div_id, user_id)

    # ① 缓存命中：interpretation_json 非空直接返回（零 LLM 零扣费）
    #    REQ-118：大六壬缓存带 liuren_template —— 请求模板与缓存模板一致才命中
    #    （换模板重新断课；同模板二次点击零 LLM 零扣费复用缓存）。
    if isinstance(div.interpretation_json, dict) and div.interpretation_json.get("content"):
        if div.method == "liuren":
            want_tpl = body.liuren_template if (body and body.liuren_template) else "general"
            if div.interpretation_json.get("liuren_template") == want_tpl:
                return {"code": 0, "message": "ok",
                        "data": {"interpretation": div.interpretation_json["content"]}}
        else:
            return {"code": 0, "message": "ok",
                    "data": {"interpretation": div.interpretation_json["content"]}}

    # ② 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ③ 组装 messages：按 method 选解读 prompt（lenormand → lenormand.md，其余 → divination.md）
    #    + 牌面/课式 result + 关联 case 的 chart 摘要；liuren 额外注入断课模板
    prompt_path = LENORMAND_PROMPT_PATH if div.method == "lenormand" else DIVINATION_PROMPT_PATH
    chart_summary = _case_chart_summary(db, div.case_id)  # case_id 为空 → None
    user_payload: dict = {"method": div.method, "result": div.result_json,
                          "chart_summary": chart_summary}
    if div.method == "liuren":
        template = body.liuren_template if (body and body.liuren_template) else "general"
        user_payload["liurenTemplate"] = template
    messages = [
        {"role": "system", "content": _load_divination_prompt(prompt_path)},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]

    # ④ LLM 断卦（非 json_mode 取自然语言文本，对齐 revise）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        # LLM 失败：记日志 + 502，不吞成假文案
        logger.warning("断卦 LLM 调用失败 divination_id=%s user_id=%s error=%s",
                       div_id, user_id, exc)
        raise _err(502, "断卦服务暂不可用，请稍后重试")

    # ⑤ 即时扣费：chat 已成功（LLM 已调用），扣费失败只记日志不阻断缓存落库
    _charge_llm(user_id, resp["usage"]["total_tokens"], ref=f"divination:{div.id}", what="断卦")

    # ⑥ 断卦文本写入 interpretation_json（缓存），二次 interpret 直接命中；
    #    REQ-118：大六壬缓存同时记录 liuren_template，模板不一致视为未命中
    content = resp["content"]
    if div.method == "liuren":
        div.interpretation_json = {"content": content, "liuren_template": template}
    else:
        div.interpretation_json = {"content": content}
    db.commit()

    record_event("divination_interpret", user_id=user_id, case_id=div.case_id,
                 props={"method": div.method, "divination_id": div.id})

    return {"code": 0, "message": "ok", "data": {"interpretation": content}}


@router.post("/divinations/{div_id}/focus")
async def interpret_divination_focus(
    div_id: int,
    body: DivinationFocusRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """六爻焦点详解（REQ-075，LLM 可选付费，即时扣费，仅 liuyao）。

    逐项点击详解：对 动爻/世应/空亡·月破·日破/暗动/回头生克/化空化墓 富字段，
    LLM 结合该盘 result（yaosDetail 富字段）+ S08 爻辞原文（yao_texts 注入）做
    针对性解读。计费与缓存语义对齐 interpret：focus_interpretations 命中该 focus
    → 直接返回（零 LLM 零扣费）；未命中 check_balance 预检（不足抛 BizError 5002）
    → chat(json_mode=False) → 成功即时扣费 ref=divination_focus:{div_id}:{focus}
    → 写回缓存 → divination_focus_interpret 埋点。LLM 失败 → 502。
    """
    user_id = get_user_id_from_token(authorization)
    div = _get_owned_divination(db, div_id, user_id)
    focus = (body.focus or "").strip()

    # ① 非法 focus / 非六爻：先校验枚举再校验方法（归属 404 已在 _get_owned_divination）
    if focus not in DIVINATION_FOCUS_KEYS_SET:
        raise _err(400, f"不支持的六爻焦点: {focus or '(空)'}")
    if div.method != "liuyao":
        raise _err(400, f"焦点详解仅支持六爻（liuyao），当前 method={div.method}")

    # ② 缓存命中：focus_interpretations[focus] 非空直接返回（零 LLM 零扣费）
    cached = div.focus_interpretations
    if isinstance(cached, dict) and cached.get(focus):
        return {"code": 0, "message": "ok",
                "data": {"focus": focus, "interpretation": cached[focus]}}

    # ③ 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ④ 组装 messages：system = divination_focus.md；user JSON = {focus, result,
    #    yao_texts(S08 注入，本卦/变卦卦辞+动爻爻辞原文白话)}，含 chart_summary 摘要
    chart_summary = _case_chart_summary(db, div.case_id)  # case_id 为空 → None
    messages = [
        {"role": "system", "content": _load_divination_prompt(DIVINATION_FOCUS_PROMPT_PATH)},
        {
            "role": "user",
            "content": json.dumps(
                {"method": div.method, "focus": focus,
                 "result": div.result_json,
                 "yao_texts": _build_yao_texts(div.result_json or {}),
                 "chart_summary": chart_summary},
                ensure_ascii=False,
            ),
        },
    ]

    # ⑤ LLM 焦点详解（非 json_mode 取自然语言文本）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        logger.warning("六爻焦点详解 LLM 调用失败 divination_id=%s focus=%s user_id=%s error=%s",
                       div_id, focus, user_id, exc)
        raise _err(502, "焦点详解服务暂不可用，请稍后重试")

    # ⑥ 即时扣费：chat 已成功（LLM 已调用），扣费失败只记日志不阻断缓存落库
    _charge_llm(user_id, resp["usage"]["total_tokens"],
                ref=f"divination_focus:{div.id}:{focus}", what="六爻焦点详解")

    # ⑦ 详解文本按 focus 写回 focus_interpretations（缓存），同 focus 二次点击直接命中
    content = resp["content"]
    cache = dict(cached) if isinstance(cached, dict) else {}
    cache[focus] = content
    div.focus_interpretations = cache
    db.commit()

    record_event("divination_focus_interpret", user_id=user_id, case_id=div.case_id,
                 props={"method": div.method, "divination_id": div.id, "focus": focus})

    return {"code": 0, "message": "ok",
            "data": {"focus": focus, "interpretation": content}}
