#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""塔罗 API 路由（横向扩展 Phase C · 塔罗，确定性抽牌免费 + LLM 综合解读可选付费）。

计费契约：
  - POST /api/tarot/draw 抽牌 = 确定性计算，免费：把 {spreadType, options} 转发给常驻
    排盘 Node 服务（paipan-node/server.mjs 的 POST /tarot，vendored mingyu-core
    divination/tarot.js），成功后落 tarot_readings 表并写 tarot_draw 埋点，
    零 LLM 零扣费。
  - GET /api/tarot/readings/{id} 读单条 = 只读（零 LLM 零扣费），带 user_id 隔离。
  - POST /api/tarot/readings/{id}/interpret 综合解读 = LLM 可选付费：命中
    interpretation_json 缓存直接返回（零 LLM 零扣费）；未命中先 check_balance
    预检（余额不足抛 BizError 5002）→ LLM chat → 成功即时扣费（ref=tarot:{id}）
    并把 {"content": 解读文本} 写入 interpretation_json 作为缓存。LLM 失败
    （LLMError/ValueError）→ 502，对齐 divination.py 断卦。
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
from app.models import TarotReading

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tarot"])

# 综合解读 system prompt（backend/prompts/interpret/tarot.md）
# tarot.py 位于 backend/app/api/，parents[2] = backend
TAROT_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "interpret" / "tarot.md"

# Node /tarot 开放给本 API 的牌阵（其余牌阵 Node 支持但前端暂不开放，pydantic 提前拦 400）
TAROT_SPREAD_TYPES = ("single", "three", "love", "career", "decision")


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_reading(db: Session, reading_id: int, user_id: int) -> TarotReading:
    """按 id+user_id 取塔罗抽牌记录（多用户隔离）；不存在抛 404"""
    row = db.query(TarotReading).filter_by(id=reading_id, user_id=user_id).first()
    if row is None:
        raise _err(404, "塔罗记录不存在")
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


def _load_tarot_prompt() -> str:
    """读取 prompts/interpret/tarot.md；缺失视为配置错误（RuntimeError，向上抛 500）"""
    try:
        text = TAROT_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"塔罗解读提示词缺失或不可读: {TAROT_PROMPT_PATH}") from exc
    if not text.strip():
        raise RuntimeError(f"塔罗解读提示词为空: {TAROT_PROMPT_PATH}")
    return text


# --- 请求模型 ---
class TarotDrawRequest(BaseModel):
    spread_type: Literal["single", "three", "love", "career", "decision"] = Field(
        description="牌阵类型", default="single",
    )
    question: Optional[str] = Field(default=None, description="用户占问方向（可选）")
    options: Optional[dict] = Field(default=None, description="原样透传 Node /tarot（seed/replay/interactiveSamples 等）")


# --- 路由 ---
@router.post("/tarot/draw")
def draw_tarot(
    body: TarotDrawRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """塔罗抽牌（确定性，免费，落库）：转发 Node /tarot → 落 tarot_readings 表 + 埋点"""
    user_id = get_user_id_from_token(authorization)

    # ① 转发常驻排盘 Node 服务（server.mjs /tarot）；options 原样透传
    payload = {"spreadType": body.spread_type, "options": body.options or {}}
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/tarot", json=payload, timeout=60)
    except Exception as exc:
        # 连接失败 / 超时等 → 网关错误，不吞成假结果、不落库
        logger.warning("塔罗抽牌 Node 转发失败 user_id=%s spread_type=%s error=%s",
                       user_id, body.spread_type, exc)
        raise _err(502, "塔罗抽牌服务暂不可用，请稍后重试")

    if resp.status_code != 200:
        logger.warning("塔罗抽牌 Node 非 200 user_id=%s spread_type=%s status=%s body=%s",
                       user_id, body.spread_type, resp.status_code, resp.text[:200])
        raise _err(502, "塔罗抽牌服务暂不可用，请稍后重试")

    node_result = resp.json()
    if not isinstance(node_result, dict):
        logger.warning("塔罗抽牌 Node 返回结构异常 user_id=%s spread_type=%s body=%s",
                       user_id, body.spread_type, str(node_result)[:200])
        raise _err(502, "塔罗抽牌服务暂不可用，请稍后重试")

    # ② 落库（确定性牌面免费持久化，供 GET 只读与 interpret 付费解读复用）
    reading = TarotReading(
        user_id=user_id,
        spread_type=body.spread_type,
        question=body.question,
        draw_json=node_result,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # ③ 埋点（写库失败静默，绝不阻断业务）；本功能零 LLM 零扣费
    record_event("tarot_draw", user_id=user_id, props={"spread_type": body.spread_type})

    return {"code": 0, "message": "ok",
            "data": {"id": reading.id, "spread_type": reading.spread_type,
                     "draw": node_result}}


@router.get("/tarot/readings/{reading_id}")
def get_tarot_reading(
    reading_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """读单条塔罗抽牌记录（只读，零 LLM）：id+user_id 隔离，查不到 404。"""
    user_id = get_user_id_from_token(authorization)
    reading = _get_owned_reading(db, reading_id, user_id)

    return {"code": 0, "message": "ok", "data": {
        "id": reading.id,
        "spread_type": reading.spread_type,
        "draw": reading.draw_json,
        "interpretation": reading.interpretation_json,
    }}


@router.post("/tarot/readings/{reading_id}/interpret")
async def interpret_tarot(
    reading_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """塔罗综合解读（LLM 可选付费，即时扣费）：缓存优先，未命中预检余额 → chat → 扣费 → 缓存。"""
    user_id = get_user_id_from_token(authorization)
    reading = _get_owned_reading(db, reading_id, user_id)

    # ① 缓存命中：interpretation_json 非空直接返回（零 LLM 零扣费）
    if isinstance(reading.interpretation_json, dict) and reading.interpretation_json.get("content"):
        return {"code": 0, "message": "ok",
                "data": {"interpretation": reading.interpretation_json["content"]}}

    # ② 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ③ 组装 messages：塔罗解读 prompt + {spread_type, question, draw}
    messages = [
        {"role": "system", "content": _load_tarot_prompt()},
        {
            "role": "user",
            "content": json.dumps(
                {"spread_type": reading.spread_type, "question": reading.question,
                 "draw": reading.draw_json},
                ensure_ascii=False,
            ),
        },
    ]

    # ④ LLM 综合解读（非 json_mode 取自然语言文本，对齐 divination 断卦）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        # LLM 失败：记日志 + 502，不吞成假文案
        logger.warning("塔罗解读 LLM 调用失败 reading_id=%s user_id=%s error=%s",
                       reading_id, user_id, exc)
        raise _err(502, "塔罗解读服务暂不可用，请稍后重试")

    # ⑤ 即时扣费：chat 已成功（LLM 已调用），扣费失败只记日志不阻断缓存落库
    _charge_llm(user_id, resp["usage"]["total_tokens"], ref=f"tarot:{reading.id}", what="塔罗解读")

    # ⑥ 解读文本写入 interpretation_json（缓存），二次 interpret 直接命中
    content = resp["content"]
    reading.interpretation_json = {"content": content}
    db.commit()

    record_event("tarot_interpret", user_id=user_id,
                 props={"spread_type": reading.spread_type, "tarot_reading_id": reading.id})

    return {"code": 0, "message": "ok", "data": {"interpretation": content}}
