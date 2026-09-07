# -*- coding: utf-8 -*-
"""积分核心服务（taichu_analytics 库：credit_accounts / credit_transactions）。

换算：**1 积分 = 1000 tokens**，扣费 = `ceil(tokens / 1000)`（向上取整）。
    >>> consume(uid, 2500)  # delta = -ceil(2500/1000) = -3

session 纪律：
  - 全部为同步函数；
  - 除 `get_account`（显式接收调用方 session，便于在更大事务里复用，不自行
    commit）外，各函数**函数内自开/关 AnalyticsSession**；
  - 写操作成功 `session.commit()`，异常 `session.rollback()` 后重抛，最后
    `session.close()`；
  - `manual` 除业务库（AnalyticsSession）入账外，审计日志写 **运维库**（taichu_ops，
    OpsSession）。

业务规则：
  - `consume` 允许把余额扣成负数（一次调用超余额），由下次 `check_balance`（余额<=0
    抛 5002）拦截；
  - `recharge` 只接受正 delta，type ∈ recharge|manual|free|refund；
  - 入账（recharge/manual/free/refund）累计到 `total_recharged`，消费累计到
    `total_consumed`。
"""
import math

from sqlalchemy.orm import Session

from app.config import settings
from app.credits.labels import label_case_map
from app.database import AnalyticsSession, OpsSession
from app.errors import ERR_BILLING, ERR_INSUFFICIENT_CREDIT, BizError
from app.models import CreditAccount, CreditTransaction
from app.models.ops import AdminAuditLog

# 入账类流水允许的 type（recharge/manual/free/refund）
_RECHARGE_TYPES = ("recharge", "manual", "free", "refund")


# --------------------------------------------------------------------------- #
# 账户
# --------------------------------------------------------------------------- #
def get_account(session: Session, user_id: int) -> CreditAccount:
    """取用户积分账户；不存在则创建 balance=0 账户并返回。

    作用于调用方传入的 session（便于与更大事务组合），**不自行 commit**——
    commit 由本模块内自开 session 的公共函数（或传入 session 的调用方）负责。
    """
    account = (
        session.query(CreditAccount)
        .filter(CreditAccount.user_id == user_id)
        .first()
    )
    if account is None:
        account = CreditAccount(
            user_id=user_id,
            balance=0,
            total_consumed=0,
            total_recharged=0,
        )
        session.add(account)
        session.flush()
    return account


def balance(user_id: int) -> int:
    """查余额；无账户则建账户后返 0。"""
    session = AnalyticsSession()
    try:
        account = get_account(session, user_id)
        bal = account.balance
        session.commit()
        return bal
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_balance(user_id: int) -> None:
    """预检余额：余额 <= 0 抛 BizError(5002 积分不足)，detail 含当前余额。"""
    session = AnalyticsSession()
    try:
        account = get_account(session, user_id)
        bal = account.balance
        session.commit()
        if bal <= 0:
            raise BizError(
                ERR_INSUFFICIENT_CREDIT,
                "积分不足",
                detail=f"当前余额 {bal}，请先充值",
            )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 扣费
# --------------------------------------------------------------------------- #
def consume(user_id: int, tokens: int, ref: str | None = None) -> dict:
    """按 tokens 扣积分：delta = -ceil(tokens / 1000)，写 consume 流水。

    允许余额扣成负数（下次 check_balance 拦截）；同步累计 total_consumed。
    返回 {"balance", "delta", "tokens"}（balance 为扣后余额）。
    """
    if not isinstance(tokens, int) or tokens < 1:
        raise BizError(ERR_BILLING, "计费异常", detail=f"consume 的 tokens 必须为正整数: {tokens}")
    delta = -math.ceil(tokens / settings.credit_per_token)

    session = AnalyticsSession()
    try:
        account = get_account(session, user_id)
        account.balance += delta
        account.total_consumed += -delta  # 累计消耗
        session.add(
            CreditTransaction(
                user_id=user_id,
                delta=delta,
                type="consume",
                tokens=tokens,
                ref=ref,
            )
        )
        session.commit()
        return {"balance": account.balance, "delta": delta, "tokens": tokens}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 入账（充值 / 手动 / 赠送 / 退款）
# --------------------------------------------------------------------------- #
def recharge(
    user_id: int,
    delta: int,
    type: str,
    note: str = "",
    amount: float | None = None,
    ref: str | None = None,
) -> dict:
    """入账（delta 为正），写流水，`total_recharged += delta`。

    type ∈ recharge|manual|free|refund。返回 {"balance", "delta"}。
    """
    if not isinstance(delta, int) or delta <= 0:
        raise BizError(ERR_BILLING, "计费异常", detail=f"recharge 的 delta 必须为正整数: {delta}")
    if type not in _RECHARGE_TYPES:
        raise BizError(ERR_BILLING, "计费异常", detail=f"未知入账流水类型: {type}")

    session = AnalyticsSession()
    try:
        account = get_account(session, user_id)
        account.balance += delta
        account.total_recharged += delta
        session.add(
            CreditTransaction(
                user_id=user_id,
                delta=delta,
                type=type,
                tokens=None,
                amount=amount,
                ref=ref,
                note=note or None,
            )
        )
        session.commit()
        return {"balance": account.balance, "delta": delta}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def manual(user_id: int, delta: int, note: str = "", admin_id: int | None = None) -> dict:
    """后台手动赠送积分 = recharge(type=manual) + ops 库写 admin_audit_logs。

    audit 字段：admin_user_id=admin_id, action="credit_manual",
    target_type="user", target_id=str(user_id), detail=含 delta/余额/备注。
    """
    result = recharge(user_id, delta, type="manual", note=note)

    detail = f"手动赠送积分 {delta}（当前余额 {result['balance']}）"
    if note:
        detail += f"，备注：{note}"

    session = OpsSession()
    try:
        session.add(
            AdminAuditLog(
                admin_user_id=admin_id,
                action="credit_manual",
                target_type="user",
                target_id=str(user_id),
                detail=detail,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return result


# --------------------------------------------------------------------------- #
# 流水
# --------------------------------------------------------------------------- #
def transactions(user_id: int, limit: int = 50, offset: int = 0) -> list:
    """流水分页（按 id 倒序，最新在前）。

    REQ-063：每条额外返回可读化字段 label（ref+type → 中文标签）与
    case_name（消耗档案名，可能为 None）。返回
    [{id, delta, type, tokens, amount, ref, note, createdAt, label, case_name}]。
    """
    session = AnalyticsSession()
    try:
        rows = (
            session.query(CreditTransaction)
            .filter(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        # 同 session 内批量反查 label / case_name（jobs/divinations/astrology_readings/cases）
        decorated = label_case_map(session, rows)
        return [
            {
                "id": t.id,
                "delta": t.delta,
                "type": t.type,
                "tokens": t.tokens,
                "amount": t.amount,
                "ref": t.ref,
                "note": t.note,
                "createdAt": t.created_at.isoformat(timespec="seconds") if t.created_at else None,
                "label": decorated[t.id]["label"],
                "case_name": decorated[t.id]["case_name"],
            }
            for t in rows
        ]
    finally:
        session.close()
