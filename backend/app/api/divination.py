#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""临时起卦 API 路由（横向扩展 Phase B）。

计费契约：
  - POST /api/divinations 起卦 = 确定性计算，免费：把 {method, ...seed} 转发给常驻
    排盘 Node 服务（paipan-node/server.mjs 的 POST /divination，vendored
    mingyu-core 六爻/梅花/小六壬/灵签/雷诺曼(lenormand)），成功后落 divinations 表并写
    divination_cast 埋点，零 LLM 零扣费。
  - GET /api/divinations/{id} 读单条 = 只读（零 LLM 零扣费），带 user_id 隔离。
  - POST /api/divinations/{id}/interpret 断卦 = LLM 可选付费：命中
    interpretation_json 缓存直接返回（零 LLM 零扣费）；未命中先 check_balance
    预检（余额不足抛 BizError 5002）→ LLM chat → 成功即时扣费
    （ref=divination:{id}）并把 {"content": 断卦文本} 写入 interpretation_json
    作为缓存。LLM 失败（LLMError/ValueError）→ 502，对齐 cases.py revise。
"""
import json
import logging
from pathlib import Path
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
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

# Node /divination 当前支持的方法（未知 method 在 pydantic 层提前拦成 400 参数错误）
DIVINATION_METHODS = ("liuyao", "meihua", "xiaoliuren", "ssgw", "lenormand")


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
    method: Literal["liuyao", "meihua", "xiaoliuren", "ssgw", "lenormand"] = Field(description="起卦方法（lenormand=雷诺曼，可无档案）")
    case_id: Optional[int] = Field(default=None, description="关联国学档案（可空；国学类起卦要求有档案，MVP 允许空由前端拦截；lenormand 不要求）")
    seed: Optional[dict] = Field(default=None, description="报数/时间/摇卦等，原样透传 Node /divination；lenormand 的 seed 可带 spreadType（缺省 single）")


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
):
    """断卦（LLM 可选付费，即时扣费）：缓存优先，未命中预检余额 → chat → 扣费 → 缓存。"""
    user_id = get_user_id_from_token(authorization)
    div = _get_owned_divination(db, div_id, user_id)

    # ① 缓存命中：interpretation_json 非空直接返回（零 LLM 零扣费）
    if isinstance(div.interpretation_json, dict) and div.interpretation_json.get("content"):
        return {"code": 0, "message": "ok",
                "data": {"interpretation": div.interpretation_json["content"]}}

    # ② 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ③ 组装 messages：按 method 选解读 prompt（lenormand → lenormand.md，其余 → divination.md）
    #    + 牌面 result + 关联 case 的 chart 摘要
    prompt_path = LENORMAND_PROMPT_PATH if div.method == "lenormand" else DIVINATION_PROMPT_PATH
    chart_summary = _case_chart_summary(db, div.case_id)  # case_id 为空 → None
    messages = [
        {"role": "system", "content": _load_divination_prompt(prompt_path)},
        {
            "role": "user",
            "content": json.dumps(
                {"method": div.method, "result": div.result_json,
                 "chart_summary": chart_summary},
                ensure_ascii=False,
            ),
        },
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

    # ⑥ 断卦文本写入 interpretation_json（缓存），二次 interpret 直接命中
    content = resp["content"]
    div.interpretation_json = {"content": content}
    db.commit()

    record_event("divination_interpret", user_id=user_id, case_id=div.case_id,
                 props={"method": div.method, "divination_id": div.id})

    return {"code": 0, "message": "ok", "data": {"interpretation": content}}
