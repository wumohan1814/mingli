#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生肖流年 API 路由（横向扩展 Phase A · 生肖流年）。

纯确定性计算（零 LLM、零扣费、不落库）：把 {zodiac, year} 转发给常驻排盘
Node 服务（paipan-node/server.mjs 的 POST /zodiac，vendored mingyu-core zodiac），
成功后仅写一条 zodiac_fortune 埋点并返回引擎结果；Node 不可用/非 200 时按
engine.py 的降级风格返回 502（网关错误），错误信息面向调用方友好。
"""
import logging
from datetime import date

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.auth.router import get_user_id_from_token
from app.config import settings
from app.events.service import record_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["zodiac"])

# Node 侧 resolveYearGanZhi 只接受 1900-2200 的整数（RangeError 之外都算 500），
# 这里用同范围的 pydantic 约束把越界 year 提前拦成 400 参数错误，更友好。
ZODIAC_YEAR_MIN = 1900
ZODIAC_YEAR_MAX = 2200


class ZodiacFortuneRequest(BaseModel):
    zodiac: str = Field(min_length=1, description="生肖名称（鼠/牛/虎…）或十二地支")
    # year 缺省当前年份：default_factory 每次建模型才取值，避免模块加载时把年份写死
    year: int = Field(
        default_factory=lambda: date.today().year,
        ge=ZODIAC_YEAR_MIN,
        le=ZODIAC_YEAR_MAX,
        description="流年（公历年份），缺省当前年份",
    )


@router.post("/zodiac/fortune")
async def zodiac_fortune(body: ZodiacFortuneRequest, authorization: str = Header(...)):
    """生肖流年运程：转发 Node /zodiac 返回引擎结果；不落库、不扣余额。"""
    user_id = get_user_id_from_token(authorization)
    payload = {"zodiac": body.zodiac, "year": body.year}

    # ① 转发常驻排盘 Node 服务（server.mjs /zodiac，纯确定性）
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/zodiac", json=payload, timeout=60)
    except Exception as exc:
        # 连接失败 / 超时等 → 网关错误，不吞成假结果
        logger.warning("生肖流年 Node 转发失败 user_id=%s zodiac=%s error=%s",
                       user_id, body.zodiac, exc)
        raise HTTPException(status_code=502, detail="生肖流年服务暂不可用，请稍后重试")

    if resp.status_code != 200:
        logger.warning("生肖流年 Node 非 200 user_id=%s zodiac=%s status=%s body=%s",
                       user_id, body.zodiac, resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="生肖流年服务暂不可用，请稍后重试")

    data = resp.json()
    if not isinstance(data, dict):
        logger.warning("生肖流年 Node 返回结构异常 user_id=%s zodiac=%s body=%s",
                       user_id, body.zodiac, str(data)[:200])
        raise HTTPException(status_code=502, detail="生肖流年服务暂不可用，请稍后重试")

    # ② 埋点（写库失败静默，绝不阻断业务）；本功能不落盘面、不扣余额
    record_event("zodiac_fortune", user_id=user_id,
                 props={"zodiac": body.zodiac, "year": body.year})

    return {"code": 0, "message": "ok", "data": data}
