#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""星座星盘 API 路由（横向扩展 Phase D1 · 星座预测）。

计费契约：
  - POST /api/astrology/chart 排星盘 = 确定性计算，免费：body {case_id, scope?,
    date_str?}，生辰与出生地一律取自该 case 建档时的 input_json（birth_year/
    birth_month/birth_day/birth_hour/gender/birthplace/longitude/latitude/
    true_solar_time，hour/gender/true_solar 缺失兜底 0/male/False，minute 恒 0，
    case 档案无分钟粒度），转发给常驻排盘 Node 服务（paipan-node/server.mjs 的
    POST /astrology，vendored mingyu-core generateAstrolabe + astrolabe-scope），
    成功后落 astrology_readings 表（chart_json = {natal, fullScope?}，带 case_id）
    并写 astrology_chart 埋点（props 含 case_id），零 LLM 零扣费。
    星盘计算较重，Node 转发 timeout=120。
  - GET /api/astrology/charts/{id} 读单条 = 只读（零 LLM 零扣费），带 user_id 隔离。
  - POST /api/astrology/charts/{id}/interpret 本命深度解读 = LLM 可选付费：命中
    reading_json 缓存直接返回（零 LLM 零扣费）；未命中先 check_balance 预检
    （余额不足抛 BizError 5002）→ LLM chat → 成功即时扣费（ref=astrology:{id}）
    并把 {"content": 解读文本} 写入 reading_json 作为缓存。LLM 失败
    （LLMError/ValueError）→ 502，对齐 tarot.py/divination.py 解读。

入参说明：
  - case_id 必填：档案归属校验（id+user_id，非本人/不存在 404），生辰信息只从
    case.input_json 读取，不再接收独立出生字段；
  - longitude/latitude 必填：引擎以经纬度推算上升点与宫位（requireNumber 无条件
    校验），case.input_json 缺失该二者时这里提前拦成 400（「该档案未提供经纬度，
    无法生成星座盘」）；
  - scope 缺省 'natal'（本命盘，仅返回 natal）；其余盘型（yearly/monthly/daily 等
    行运及 transit/solar_return/secondary/firdaria 前瞻值）走 Node 全范围上下文
    （natal + yearly + monthly + daily），date_str 为该盘型的参考日期（YYYY-MM-DD，
    非 natal 且缺省时 Node 以当天为基准）。
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
from app.models import AstrologyReading, Case

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["astrology"])

# 本命深度解读 system prompt（backend/prompts/interpret/astrology.md）
# astrology.py 位于 backend/app/api/，parents[2] = backend
ASTROLOGY_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "interpret" / "astrology.md"

# 出生年份范围不再由本端点校验：生辰取自 case.input_json（建档时入参/引擎兜底），
# 越界值由 Node generateAstrolabe 校验（非 200 → 502 网关错误），对齐 paipan 口径。

# 前端可请求的盘型（model scope 列宽松存储，这里限定 MVP 开放值；
# 非 natal 一律产出 fullScope 全范围上下文，date_str 为参考日期 YYYY-MM-DD）
ASTROLOGY_SCOPES = ("natal", "yearly", "monthly", "daily",
                    "transit", "solar_return", "secondary", "firdaria")

# date_str 参考日期格式（与 Node buildAstrolabeFullScopeContexts 的 full 口径一致）
_DATE_STR_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_reading(db: Session, reading_id: int, user_id: int) -> AstrologyReading:
    """按 id+user_id 取星盘记录（多用户隔离）；不存在抛 404"""
    row = db.query(AstrologyReading).filter_by(id=reading_id, user_id=user_id).first()
    if row is None:
        raise _err(404, "星盘记录不存在")
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


def _load_astrology_prompt() -> str:
    """读取 prompts/interpret/astrology.md；缺失视为配置错误（RuntimeError，向上抛 500）"""
    try:
        text = ASTROLOGY_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"星座解读提示词缺失或不可读: {ASTROLOGY_PROMPT_PATH}") from exc
    if not text.strip():
        raise RuntimeError(f"星座解读提示词为空: {ASTROLOGY_PROMPT_PATH}")
    return text


def _natal_digest(chart_json) -> dict:
    """把 Node /astrology 返回的本命盘 natal 提炼成一版简短摘要（对齐 cases/divination
    的 _chart_summary 摘要思路），供 LLM 深度解读注入；chart 缺失返回空 dict。"""
    if not isinstance(chart_json, dict) or not isinstance(chart_json.get("natal"), dict):
        return {}
    natal = chart_json["natal"]
    planets = natal.get("planets") or []
    angles = natal.get("angles") or []

    def _brief(item) -> Optional[dict]:
        if not isinstance(item, dict):
            return None
        name = item.get("name")
        if not name:
            return None
        return {
            "label": item.get("label") or name,
            "sign": item.get("sign") or "",
            "house": item.get("house"),
            "formatted": item.get("formatted") or "",
            "retrograde": item.get("retrograde", False),
            "dignityLabel": item.get("dignityLabel"),
        }

    # 解读聚焦经典十星体 + 北交点 + 四轴（小行星/莉莉丝/福点等不进 prompt，控制体积）
    digest_names = {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
                    "Uranus", "Neptune", "Pluto", "North Node", "Ascendant"}
    all_points = {p.get("name"): _brief(p) for p in planets + angles if isinstance(p, dict) and p.get("name")}

    birth = natal.get("birth") or {}
    birth_digest = {
        "dateTime": birth.get("dateTime") or "",
        "standardDateTime": birth.get("standardDateTime") or "",
        "location": birth.get("location") or "",
        "timezone": birth.get("timezone"),
        "gender": birth.get("gender") or "",
    }
    summary = natal.get("summary") or {}
    return {
        "birth": birth_digest,
        "sun": all_points.get("Sun"),
        "moon": all_points.get("Moon"),
        "ascendant": all_points.get("Ascendant"),
        "planets": [all_points[name] for name in digest_names if all_points.get(name)],
        "aspects": [a for a in (natal.get("aspects") or []) if isinstance(a, dict)][:16],
        # natal 的 aspects 已按强度降序；截前 16 组控制 prompt 体积
        "elements": summary.get("elements"),
        "modalities": summary.get("modalities"),
        "retrograde": summary.get("retrograde"),
        "patterns": summary.get("patterns"),
    }


# --- 请求模型 ---
class AstrologyChartRequest(BaseModel):
    case_id: int = Field(description="国学档案 id（必须本人所有；生辰/出生地取该档案 input_json）")
    scope: Literal["natal", "yearly", "monthly", "daily",
                   "transit", "solar_return", "secondary", "firdaria"] = Field(
        default="natal", description="盘型：natal=本命；其余盘型返回 fullScope 行运上下文")
    date_str: Optional[str] = Field(default=None, description="参考日期 YYYY-MM-DD（非 natal 使用；缺省以当天为基准）")


# --- 路由 ---
@router.post("/astrology/chart")
def create_astrology_chart(
    body: AstrologyChartRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """排星座盘（确定性，免费，落库）：取 case 生辰 → 转发 Node /astrology →
    落 astrology_readings 表（带 case_id）+ 埋点。

    幂等复用（REQ-039）：同一档案+盘型只生成一次并绑定，键 = (user_id, case_id,
    scope)；已有记录直接返回（不重复转发 Node / 落新行 / 写埋点）。date_str 不参与
    幂等键——模型无 date_str 列，非 natal 盘型的再入按 scope 复用（MVP 前端仅用 natal，
    此简化可接受）。

    统一档案体系：出生信息一律读 case.input_json，不再接收独立出生字段；
    case.input_json 缺经纬度时提前 400，避免 Node 以 500 兜底返回成「服务不可用」。
    """
    user_id = get_user_id_from_token(authorization)

    # ① case 归属校验（id+user_id 隔离，非本人/不存在 → 404）
    case = db.query(Case).filter_by(id=body.case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")

    # ② 从档案 input_json 取生辰；缺失字段用建档默认值兜底（hour 0、gender male、
    #    true_solar False）；case 无分钟粒度，minute 恒 0
    inp = case.input_json if isinstance(case.input_json, dict) else {}
    longitude = inp.get("longitude")
    latitude = inp.get("latitude")
    if longitude is None or latitude is None:
        raise _err(400, "该档案未提供经纬度，无法生成星座盘")
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        raise _err(400, "档案经纬度越界（经度 -180~180，纬度 -90~90）")
    if body.scope != "natal" and body.date_str:
        import re
        if not re.match(_DATE_STR_PATTERN, body.date_str):
            raise _err(400, "date_str 需为 YYYY-MM-DD 格式的参考日期")

    # ③ 幂等复用（REQ-039）：同一 (user_id, case_id, scope) 已生成过且 chart_json
    #    非空 → 直接返回该已有 reading（不转发 Node、不落新行、不写埋点）。
    #    date_str 不参与幂等键：模型无 date_str 列，非 natal 再入按 scope 复用
    #    （docstring 已注明此简化，MVP 前端仅用 natal）。
    existing = (db.query(AstrologyReading)
                .filter_by(user_id=user_id, case_id=body.case_id, scope=body.scope)
                .order_by(AstrologyReading.id.desc()).first())
    if existing is not None and existing.chart_json:
        return {"code": 0, "message": "ok",
                "data": {"id": existing.id, "scope": existing.scope,
                         "chart": existing.chart_json}}

    # ④ 转发常驻排盘 Node 服务（server.mjs /astrology）；生辰扁平化透传。
    #    星盘计算较重（本命 + 行运/返照/次限上下文），timeout 放宽到 120s。
    payload = {
        "year": inp.get("birth_year"),
        "month": inp.get("birth_month"),
        "day": inp.get("birth_day"),
        "hour": inp.get("birth_hour", 0),
        "minute": 0,
        "gender": inp.get("gender", "male"),
        "birthplace": inp.get("birthplace", ""),
        "longitude": longitude,
        "latitude": latitude,
        "true_solar": bool(inp.get("true_solar_time", False)),
        "scope": body.scope,
        "dateStr": body.date_str,
    }
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/astrology", json=payload, timeout=120)
    except Exception as exc:
        # 连接失败 / 超时等 → 网关错误，不吞成假结果、不落库
        logger.warning("星座星盘 Node 转发失败 user_id=%s case_id=%s scope=%s error=%s",
                       user_id, body.case_id, body.scope, exc)
        raise _err(502, "星盘服务暂不可用，请稍后重试")

    if resp.status_code != 200:
        logger.warning("星座星盘 Node 非 200 user_id=%s case_id=%s scope=%s status=%s body=%s",
                       user_id, body.case_id, body.scope, resp.status_code, resp.text[:200])
        raise _err(502, "星盘服务暂不可用，请稍后重试")

    node_result = resp.json()
    if not isinstance(node_result, dict) or not isinstance(node_result.get("natal"), dict):
        logger.warning("星座星盘 Node 返回结构异常 user_id=%s case_id=%s body=%s",
                       user_id, body.case_id, str(node_result)[:200])
        raise _err(502, "星盘服务暂不可用，请稍后重试")

    # ⑤ 落库（确定性星盘免费持久化，供 GET 只读与 interpret 付费解读复用；带 case_id）
    reading = AstrologyReading(
        user_id=user_id,
        case_id=body.case_id,
        chart_json=node_result,
        scope=body.scope,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # ⑥ 埋点（写库失败静默，绝不阻断业务）；本功能零 LLM 零扣费
    record_event("astrology_chart", user_id=user_id,
                 props={"scope": body.scope, "case_id": body.case_id})

    return {"code": 0, "message": "ok",
            "data": {"id": reading.id, "scope": reading.scope,
                     "chart": node_result}}


@router.get("/astrology/charts/{reading_id}")
def get_astrology_chart(
    reading_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """读单条星盘记录（只读，零 LLM）：id+user_id 隔离，查不到 404。"""
    user_id = get_user_id_from_token(authorization)
    reading = _get_owned_reading(db, reading_id, user_id)

    return {"code": 0, "message": "ok", "data": {
        "id": reading.id,
        "scope": reading.scope,
        "chart": reading.chart_json,
        "reading": reading.reading_json,
    }}


@router.post("/astrology/charts/{reading_id}/interpret")
async def interpret_astrology(
    reading_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """星座本命深度解读（LLM 可选付费，即时扣费）：缓存优先，未命中预检余额 → chat → 扣费 → 缓存。"""
    user_id = get_user_id_from_token(authorization)
    reading = _get_owned_reading(db, reading_id, user_id)

    # ① 缓存命中：reading_json 非空直接返回（零 LLM 零扣费）
    if isinstance(reading.reading_json, dict) and reading.reading_json.get("content"):
        return {"code": 0, "message": "ok",
                "data": {"interpretation": reading.reading_json["content"]}}

    # ② 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ③ 组装 messages：星座解读 prompt + {chart: natal 摘要, scope}
    messages = [
        {"role": "system", "content": _load_astrology_prompt()},
        {
            "role": "user",
            "content": json.dumps(
                {"chart": _natal_digest(reading.chart_json), "scope": reading.scope},
                ensure_ascii=False,
            ),
        },
    ]

    # ④ LLM 本命深度解读（非 json_mode 取自然语言文本，对齐 tarot/divination 解读）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        # LLM 失败：记日志 + 502，不吞成假文案
        logger.warning("星座解读 LLM 调用失败 reading_id=%s user_id=%s error=%s",
                       reading_id, user_id, exc)
        raise _err(502, "星座解读服务暂不可用，请稍后重试")

    # ⑤ 即时扣费：chat 已成功（LLM 已调用），扣费失败只记日志不阻断缓存落库
    _charge_llm(user_id, resp["usage"]["total_tokens"], ref=f"astrology:{reading.id}", what="星座解读")

    # ⑥ 解读文本写入 reading_json（缓存），二次 interpret 直接命中
    content = resp["content"]
    reading.reading_json = {"content": content}
    db.commit()

    record_event("astrology_interpret", user_id=user_id,
                 props={"scope": reading.scope, "astrology_reading_id": reading.id})

    return {"code": 0, "message": "ok", "data": {"interpretation": content}}
