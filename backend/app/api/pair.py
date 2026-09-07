#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配对解析 API 路由（REQ-072 · 横向扩展）：三大模块 LLM「配对解析」。

交互契约：前端从档案列表选任意两个档案 → 指定关系类型（恋爱/朋友/家人/同事等
预设单选）+ 可选补充关注点 question → LLM 按所选档案与该模块数据做配对解析。

计费契约（对齐 interpret 即时扣费）：
  - POST /api/pair/analyze 鉴权 Bearer，body {case_id_1:int, case_id_2:int,
    relation_type:str, question?:str, module:str}。module ∈ guoxue / xishi /
    mbti，校验不通过 → 400。
    流程：两档案归属校验（filter_by id+user_id，非本人/不存在 404）→ 按 module
    取双方数据（任一档案缺数据 → 400 提示先生成，**不自动生成**）→ check_balance
    预检（余额不足抛 BizError 5002，全局处理器转 502 信封）→ LLM chat
    （json_mode=False，system = prompts/pair/{module}.md 对应系统提示词）→ 成功
    即时扣费（consume ref=pair:{reading.id}，1 积分=1000 tokens，ceil）→
    result_json 存 {"content": 解读文本} 落 pair_readings → pair_analysis 埋点
    （props={module, relation_type}）。LLM 失败（LLMError/ValueError）→ 502，
    不落行不扣费，对齐 interpret 语义。

数据源（与既有解读端点口径一致）：
  - guoxue：读 charts.chart_json 的 bazi 摘要（复用 cases._chart_summary 口径，
    含日主/五行/四柱干支/纳音/十神等）；
  - xishi：读 astrology_readings.chart_json 的 natal 摘要（复用
    astrology._natal_digest 口径，含日月升、行星落座落宫、相位、元素模式）；
  - mbti：case.mbti_type 优先、缺失回退 MbtiResult 最近 type；scores 取该型
    最近一次结果（分享填写记录不回写档案类型，故按 type 匹配过滤）；
    type_info 评语从 mbti/data/types.json 实时取（复用 mbti.load_types）。

提示词：backend/prompts/pair/{guoxue,xishi,mbti}.md 三份已纳入后台
（REQ-048 文件类热改 + 版本回滚，见 app/admin/router.py PROMPT_FILES）。
"""
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.astrology import _natal_digest
from app.api.cases import _chart_summary
from app.api.mbti import load_types
from app.auth.router import get_user_id_from_token
from app.credits.service import check_balance, consume
from app.database import get_analytics_db
from app.events.service import record_event
from app.llm import LLMError, chat
from app.models import AstrologyReading, Case, Chart, MbtiResult, PairReading

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["pair"])

# 配对解析系统提示词目录（backend/prompts/pair/{module}.md）
# pair.py 位于 backend/app/api/，parents[2] = backend
PAIR_PROMPT_DIR = Path(__file__).resolve().parents[2] / "prompts" / "pair"

# 开放模块白名单 → 数据取数说明（缺数据 400 文案里的动作关键词）
PAIR_MODULES = {
    "guoxue": ("排盘", "未排盘"),
    "xishi": ("星盘", "未生成星盘"),
    "mbti": ("MBTI 测评", "未测 MBTI"),
}


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_case(db: Session, case_id: int, user_id: int) -> Case:
    """按 id+user_id 取档案（多用户隔离）；不存在/非本人抛 404"""
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")
    return case


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


def _load_pair_prompt(module: str) -> str:
    """读取 prompts/pair/{module}.md；缺失视为配置错误（RuntimeError，向上抛 500）"""
    path = PAIR_PROMPT_DIR / f"{module}.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"配对解析提示词缺失或不可读: {path}") from exc
    if not text.strip():
        raise RuntimeError(f"配对解析提示词为空: {path}")
    return text


# --------------------------------------------------------------------------- #
# 按 module 取单档案数据（缺数据抛 400 提示先生成，不自动生成）
# --------------------------------------------------------------------------- #
def _load_guoxue_profile(db: Session, case: Case) -> dict:
    """国学：charts.chart_json 的 bazi 摘要（复用 cases._chart_summary 口径）"""
    chart_row = db.query(Chart).filter_by(case_id=case.id).first()
    if chart_row is None or not isinstance(chart_row.chart_json, dict):
        raise _err(400, f"该档案未排盘，请先生成后再配对解析（case {case.id}）")
    return _chart_summary(chart_row.chart_json)


def _load_xishi_profile(db: Session, case: Case) -> dict:
    """西式：astrology_readings.chart_json 的 natal 摘要（复用 astrology._natal_digest）"""
    readings = (
        db.query(AstrologyReading)
        .filter_by(case_id=case.id)
        .order_by(AstrologyReading.id.desc())
        .all()
    )
    for reading in readings:
        # 星盘生成端点保证 chart_json 为 {natal, fullScope?}；无 natal 视为未生成
        if isinstance(reading.chart_json, dict) and isinstance(
            reading.chart_json.get("natal"), dict
        ):
            return _natal_digest(reading.chart_json)
    raise _err(400, f"该档案未生成星盘，请先生成后再配对解析（case {case.id}）")


def _load_mbti_profile(db: Session, case: Case) -> dict:
    """MBTI：case.mbti_type 优先、回退 MbtiResult 最近 type；scores 取该型最近结果。

    分享填写记录（POST /api/mbti/share/{token}/score）不回写 case.mbti_type，
    故这里按「档案主人类型」过滤匹配结果行，避免把他人测评分当主人的。
    """
    rows = (
        db.query(MbtiResult)
        .filter_by(case_id=case.id)
        .order_by(MbtiResult.id.desc())
        .all()
    )
    mbti_type = (case.mbti_type or "").strip().upper()
    if not mbti_type:
        for row in rows:
            if row.type and row.type.strip():
                mbti_type = row.type.strip().upper()
                break
    if not mbti_type:
        raise _err(400, f"该档案未测 MBTI，请先生成后再配对解析（case {case.id}）")

    matched = next(
        (r for r in rows if (r.type or "").strip().upper() == mbti_type), None
    )
    return {
        "type": mbti_type,
        "scores": matched.scores_json if matched is not None else None,
        "type_info": load_types().get(mbti_type) or {},
    }


# module → 档案数据取数器（person.profile 内容随模块而异）
_PROFILE_LOADERS = {
    "guoxue": _load_guoxue_profile,
    "xishi": _load_xishi_profile,
    "mbti": _load_mbti_profile,
}


def _person_payload(db: Session, case: Case, module: str) -> dict:
    """组装单个档案的 person 载荷：{case:{id,name}, profile:<模块数据>}"""
    loader = _PROFILE_LOADERS[module]
    return {
        "case": {"id": case.id, "name": case.name},
        "profile": loader(db, case),
    }


# --- 请求模型 ---
class PairAnalyzeRequest(BaseModel):
    case_id_1: int = Field(description="档案一 id（须本人所有）")
    case_id_2: int = Field(description="档案二 id（须本人所有）")
    relation_type: str = Field(description="关系类型（恋爱/朋友/家人/同事等）")
    question: Optional[str] = Field(
        default=None, description="用户补充关注点（可选自由文本）"
    )
    module: str = Field(description="解析模块：guoxue（国学八字）/ xishi（星座）/ mbti（人格）")


# --- 路由 ---
@router.post("/pair/analyze")
async def analyze_pair(
    body: PairAnalyzeRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """双人配对解析（LLM 可选付费，即时扣费）：归属校验 → 按 module 取数（缺数据
    400）→ 预检余额 → chat → 成功扣费（ref=pair:{id}）→ 落 pair_readings →
    埋点；LLM 失败 502。"""
    user_id = get_user_id_from_token(authorization)

    # ① module 白名单 + relation_type 必填（先于建档归属/数据校验，快速失败）
    module = (body.module or "").strip().lower()
    if module not in PAIR_MODULES:
        raise _err(400, f"不支持的模块: {body.module}（可选 guoxue/xishi/mbti）")
    relation_type = (body.relation_type or "").strip()
    if not relation_type:
        raise _err(400, "请选择关系类型（relation_type 不能为空）")

    # ② 两档案归属校验（id+user_id 隔离，非本人/不存在 → 404）
    case_a = _get_owned_case(db, body.case_id_1, user_id)
    case_b = _get_owned_case(db, body.case_id_2, user_id)

    # ③ 按 module 取双方数据（缺数据 400 提示先生成，不自动生成）
    person_a = _person_payload(db, case_a, module)
    person_b = _person_payload(db, case_b, module)

    # ④ 组装 messages：system=对应模块配对 prompt；user=双方数据+关系类型+问题
    messages = [
        {"role": "system", "content": _load_pair_prompt(module)},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "relation_type": relation_type,
                    "question": body.question,
                    "person_a": person_a,
                    "person_b": person_b,
                },
                ensure_ascii=False,
            ),
        },
    ]

    # ⑤ 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ⑥ LLM 配对解析（非 json_mode 取自然语言文本，对齐 interpret）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        # LLM 失败：记日志 + 502，不落行不扣费（不吞成假文案）
        logger.warning(
            "配对解析 LLM 调用失败 module=%s case1=%s case2=%s user_id=%s error=%s",
            module, body.case_id_1, body.case_id_2, user_id, exc,
        )
        raise _err(502, "配对解析服务暂不可用，请稍后重试")

    content = resp["content"]

    # ⑦ 落 pair_readings（LLM 已成功；result_json 存解读文本，供历史留存/排查）
    reading = PairReading(
        user_id=user_id,
        case_id_1=body.case_id_1,
        case_id_2=body.case_id_2,
        relation_type=relation_type,
        question=body.question,
        module=module,
        result_json={"content": content},
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # ⑧ 即时扣费：chat 已成功（LLM 已调用），扣费失败只记日志不阻断结果返回
    _charge_llm(user_id, resp["usage"]["total_tokens"],
                ref=f"pair:{reading.id}", what="配对解析")

    # ⑨ 埋点（写库失败静默，绝不阻断业务）
    record_event("pair_analysis", user_id=user_id,
                 props={"module": module, "relation_type": relation_type})

    return {"code": 0, "message": "ok",
            "data": {"id": reading.id, "interpretation": content}}
