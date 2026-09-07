# -*- coding: utf-8 -*-
"""积分核心服务单测（backend/tests/unit/test_credits.py）。

依赖 tests/conftest.py：
  - 任何 app.* import 前已把 TAICHU_DB_PATH / TAICHU_OPS_DB_PATH 指向 session 级
    临时目录，本文件绝不触碰真实库；
  - session 级夹具 `orchestration_env` 负责在临时 analytics / ops 库建全部表。

隔离：每用例自建独立 User 行（uuid 用户名）+ 独立 user_id，用例间互不污染。

覆盖（docs/架构设计-积分系统开发方案.md §10）：
  1. consume 向上取整：2500→-3、500→-1、1000→-1；
  2. check_balance 余额 0 / 负 → BizError 5002；
  3. recharge 入账 + total_recharged + 流水；
  4. manual 手动赠送 + ops 库写 admin_audit_logs；
  5. transactions 流水分页 limit/offset。
"""
from __future__ import annotations

import uuid

import pytest

from app.credits import balance, check_balance, consume, manual, recharge, transactions
from app.database import AnalyticsSession, OpsSession
from app.errors import BizError, ERR_INSUFFICIENT_CREDIT
from app.models import CreditAccount, CreditTransaction, User
from app.models.ops import AdminAuditLog

pytestmark = pytest.mark.usefixtures("orchestration_env")  # 临时库建表（analytics+ops）


def _create_user() -> int:
    """自建一个 User 行，返回 user_id。"""
    session = AnalyticsSession()
    try:
        user = User(
            username=f"credit_ut_{uuid.uuid4().hex[:12]}",
            password_hash="test-only-not-verified",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _get_account(uid: int) -> CreditAccount:
    session = AnalyticsSession()
    try:
        return session.query(CreditAccount).filter_by(user_id=uid).one()
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 1. consume 按 ceil(tokens / 1000) 扣分
# --------------------------------------------------------------------------- #
def test_consume_ceil():
    uid = _create_user()
    assert balance(uid) == 0  # 无账户时建账户返 0

    r1 = consume(uid, 2500)          # 2500 / 1000 = 2.5 -> ceil = 3
    assert r1["delta"] == -3
    assert r1["tokens"] == 2500
    assert r1["balance"] == -3

    r2 = consume(uid, 500)           # 0.5 -> ceil = 1
    assert r2["delta"] == -1
    assert r2["balance"] == -4

    r3 = consume(uid, 1000)          # 1.0 -> ceil = 1
    assert r3["delta"] == -1
    assert r3["balance"] == -5

    # 账户与流水落库
    acc = _get_account(uid)
    assert acc.balance == -5
    assert acc.total_consumed == 5
    session = AnalyticsSession()
    try:
        rows = session.query(CreditTransaction).filter_by(user_id=uid).all()
    finally:
        session.close()
    assert len(rows) == 3
    assert [r.type for r in rows] == ["consume", "consume", "consume"]
    assert [r.delta for r in rows] == [-3, -1, -1]
    assert [r.tokens for r in rows] == [2500, 500, 1000]


# --------------------------------------------------------------------------- #
# 2. check_balance：余额 <= 0 抛 5002
# --------------------------------------------------------------------------- #
def test_check_balance_insufficient():
    # 无账户（余额 0）→ 抛 5002
    uid_zero = _create_user()
    with pytest.raises(BizError) as exc0:
        check_balance(uid_zero)
    assert exc0.value.code == ERR_INSUFFICIENT_CREDIT == 5002

    # 余额 -1（consume 500 tokens 扣成负）→ 抛 5002
    uid_neg = _create_user()
    consume(uid_neg, 500)
    assert balance(uid_neg) == -1
    with pytest.raises(BizError) as exc_neg:
        check_balance(uid_neg)
    assert exc_neg.value.code == 5002
    assert "当前余额" in exc_neg.value.detail and "-1" in exc_neg.value.detail

    # 余额 > 0 → 不抛
    uid_ok = _create_user()
    recharge(uid_ok, 10, "free")
    check_balance(uid_ok)  # 不抛即通过


# --------------------------------------------------------------------------- #
# 3. recharge 入账：余额 / total_recharged / 流水
# --------------------------------------------------------------------------- #
def test_recharge_and_balance():
    uid = _create_user()

    res = recharge(uid, 100, "free", note="注册赠送")
    assert res["delta"] == 100
    assert res["balance"] == 100

    assert balance(uid) == 100
    acc = _get_account(uid)
    assert acc.balance == 100
    assert acc.total_recharged == 100
    assert acc.total_consumed == 0

    session = AnalyticsSession()
    try:
        rows = session.query(CreditTransaction).filter_by(user_id=uid).all()
    finally:
        session.close()
    assert len(rows) == 1
    assert rows[0].delta == 100
    assert rows[0].type == "free"
    assert rows[0].tokens is None
    assert rows[0].note == "注册赠送"


# --------------------------------------------------------------------------- #
# 4. manual：入账（type=manual）+ ops 库 audit 日志
# --------------------------------------------------------------------------- #
def test_manual_writes_audit():
    uid = _create_user()

    res = manual(uid, 50, "补偿", admin_id=1)
    assert res["balance"] == 50
    assert balance(uid) == 50

    acc = _get_account(uid)
    assert acc.balance == 50
    assert acc.total_recharged == 50  # manual 计入累计充值

    # 流水：1 条 type=manual, delta=+50
    session = AnalyticsSession()
    try:
        rows = session.query(CreditTransaction).filter_by(user_id=uid).all()
    finally:
        session.close()
    assert len(rows) == 1
    assert rows[0].type == "manual"
    assert rows[0].delta == 50
    assert rows[0].note == "补偿"

    # audit：ops 库 1 条 action=credit_manual
    ops = OpsSession()
    try:
        logs = (
            ops.query(AdminAuditLog)
            .filter_by(action="credit_manual", target_type="user", target_id=str(uid))
            .all()
        )
    finally:
        ops.close()
    assert len(logs) == 1
    assert logs[0].admin_user_id == 1
    assert logs[0].target_id == str(uid)
    assert "50" in (logs[0].detail or "")


# --------------------------------------------------------------------------- #
# 5. transactions 流水分页
# --------------------------------------------------------------------------- #
def test_transactions_paging():
    uid = _create_user()
    recharge(uid, 100, "free", note="赠送")
    consume(uid, 1500)          # delta -2
    manual(uid, 5, "补偿", admin_id=7)  # delta +5，共 3 条

    required_keys = {"id", "delta", "type", "tokens", "amount", "ref", "note", "createdAt"}
    # REQ-063：明细可读化——每条额外带 label（中文标签）与 case_name（档案名，可能 None）
    readable_keys = {"label", "case_name"}

    page1 = transactions(uid, limit=2, offset=0)
    assert len(page1) == 2
    # 最新在前：manual(+5) -> consume(-2)
    assert [t["type"] for t in page1] == ["manual", "consume"]
    assert [t["delta"] for t in page1] == [5, -2]
    assert required_keys | readable_keys <= page1[0].keys()
    assert page1[0]["createdAt"] is not None
    # 首条 tokens 为 None（入账流），次条 tokens=1500（消费流）
    assert page1[0]["tokens"] is None
    assert page1[1]["tokens"] == 1500
    # REQ-063 标签：manual→手动赠送、无 ref 的 consume→消耗；两笔均无档案
    assert page1[0]["label"] == "手动赠送" and page1[0]["case_name"] is None
    assert page1[1]["label"] == "消耗" and page1[1]["case_name"] is None

    page2 = transactions(uid, limit=2, offset=2)
    assert len(page2) == 1
    assert page2[0]["type"] == "free"
    assert page2[0]["delta"] == 100
    assert page2[0]["label"] == "注册赠送"
    assert page2[0]["case_name"] is None

    page3 = transactions(uid, limit=2, offset=3)
    assert page3 == []  # 越界返回空
