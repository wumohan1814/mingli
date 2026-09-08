# -*- coding: utf-8 -*-
"""C 端余额 API：余额查询 / 流水分页 / 充值码生成（均需 JWT Bearer）。

- GET  /api/credits/balance       → {code:0, message:"ok", data:{balance, balance_yuan, totalConsumed, totalRecharged}}
- GET  /api/credits/transactions  → {code:0, message:"ok", data:{items, total}}（最新在前）
- POST /api/credits/charge-code   → {code:0, message:"ok", data:{code, url}}（生成一次性充值码 + 金数据跳转 URL）
"""
from fastapi import APIRouter, Header

from app.auth.router import get_user_id_from_token
from app.config import settings
from app.credits.codes import create_code
from app.credits.service import balance, transactions
from app.database import AnalyticsSession
from app.models import CreditAccount, CreditTransaction

router = APIRouter(prefix="/api/credits", tags=["credits"])


@router.get("/balance")
def get_balance(authorization: str = Header(...)):
    """当前用户余额账户：余额 + 累计消费 + 累计充值（balance_yuan = 余额元口径 ¥）。"""
    user_id = get_user_id_from_token(authorization)
    # balance() 对无账户用户自动建 balance=0 账户并 commit，随后可直接读全字段
    bal = balance(user_id)
    session = AnalyticsSession()
    try:
        acc = (
            session.query(CreditAccount)
            .filter_by(user_id=user_id)
            .first()
        )
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "balance": bal,                       # 存储单位（1 单位 = 1000 tokens），保留原字段防前端断档
                "balance_yuan": round(bal / 10, 2),   # 展示口径：余额 ¥ = balance ÷ 10（1 元 = 10 存储单位）
                "totalConsumed": acc.total_consumed if acc is not None else 0,
                "totalRecharged": acc.total_recharged if acc is not None else 0,
            },
        }
    finally:
        session.close()


@router.get("/transactions")
def get_transactions(
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(...),
):
    """当前用户余额流水分页（按时间倒序，最新在前），total 为该用户流水总数。"""
    user_id = get_user_id_from_token(authorization)
    limit = min(max(int(limit), 1), 200)   # 防呆：1..200
    offset = max(int(offset), 0)

    items = transactions(user_id, limit=limit, offset=offset)
    session = AnalyticsSession()
    try:
        total = (
            session.query(CreditTransaction)
            .filter_by(user_id=user_id)
            .count()
        )
    finally:
        session.close()

    return {"code": 0, "message": "ok", "data": {"items": items, "total": total}}


@router.post("/charge-code")
def create_charge_code(authorization: str = Header(...)):
    """生成一次性充值码（绑定当前用户，默认 15 分钟有效），返回金数据充值表单跳转 URL。

    前端拿到 url 后 302 跳转：{jinshuju_form_url}?code={code}（金数据预填充值码）。
    """
    user_id = get_user_id_from_token(authorization)
    session = AnalyticsSession()
    try:
        code = create_code(session, user_id)
    finally:
        session.close()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "code": code,
            "url": f"{settings.jinshuju_form_url}?code={code}",
        },
    }
