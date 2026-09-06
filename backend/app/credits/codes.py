# -*- coding: utf-8 -*-
"""充值码（一次性、绑定 user_id、短时效）：create / resolve / mark_used。

设计见 docs/架构设计-支付系统-金数据.md §9.4：
  - 码形如 "TC-XXXXXX"（secrets.token_hex(3) 6 位十六进制，约 1677 万种）；
  - 生成即绑定 user_id，TTL 默认 15 分钟；
  - resolve_code 只认 `status=unused` 且未过期的码——充值成功后 mark_used 置
    `used`，同一码被重复消费时 resolve 返回 None，构成天然幂等（防重放）。

session 纪律：三个函数都作用于调用方传入的 session（AnalyticsSession），
create_code / mark_used 自行 commit；resolve_code 只读不写。
"""
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import RechargeCode


def create_code(db: Session, user_id: int, ttl_minutes: int = 15) -> str:
    """生成并落库一枚充值码（status=unused，expires_at=now+ttl），返回码串。"""
    code = "TC-" + secrets.token_hex(3).upper()      # TC-XXXXXX
    db.add(
        RechargeCode(
            code=code,
            user_id=user_id,
            status="unused",
            expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
        )
    )
    db.commit()
    return code


def resolve_code(db: Session, code: str) -> RechargeCode | None:
    """返回 `unused` 且未过期的码行；已用 / 已过期 / 不存在一律 None。"""
    if not code:
        return None
    row = db.query(RechargeCode).filter_by(code=code, status="unused").first()
    if row is not None and row.expires_at and row.expires_at > datetime.utcnow():
        return row
    return None


def mark_used(db: Session, code: str) -> None:
    """把码置 `used`（充值成功后调用，防重放 / 幂等关键）。码不存在则静默。"""
    row = db.query(RechargeCode).filter_by(code=code).first()
    if row is not None and row.status != "used":
        row.status = "used"
        db.commit()
