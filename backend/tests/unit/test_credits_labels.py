# -*- coding: utf-8 -*-
"""REQ-063 余额流水可读化回归（backend/tests/unit/test_credits_labels.py）。

覆盖（labels.py 映射 + service.transactions 附加字段）：
  1. ref_label 纯函数：job 断前尘/预测前缀、revise/divination/tarot/astrology/
     query/serial、入账 type 中文、consume 兜底「消耗」；
  2. transactions 每条返回 label + case_name（档案名反查）：
     - job:{id}:{method} → jobs.type 前缀 + jobs.case_id → cases.name；
     - job 记录缺失 → 兜底「排盘分析」，档案名空；
     - revise/query → ref 内 case_id → cases.name；
     - divination:{id} → lenormand=「雷诺曼解读」/其余「起卦深度解读」+ case_id 反查；
     - tarot:{id} → 「塔罗解读」，tarot_readings 无 case 关联 → 档案名恒空；
     - astrology:{id} → 「星座本命解读」+ case_id 反查；
     - 入账/无档案/档案未命名 → case_name=None。

依赖 tests/conftest.py：临时库隔离（同 test_credits.py）。
"""
from __future__ import annotations

import uuid

import pytest

from app.credits import consume, manual, recharge, transactions
from app.credits.labels import parse_ref, ref_label
from app.database import AnalyticsSession
from app.models import (
    AstrologyReading,
    Case,
    Divination,
    Job,
    JobType,
    TarotReading,
    User,
)

pytestmark = pytest.mark.usefixtures("orchestration_env")  # 临时库建表（analytics+ops）


def _create_user() -> int:
    session = AnalyticsSession()
    try:
        user = User(
            username=f"credit_lbl_{uuid.uuid4().hex[:12]}",
            password_hash="test-only-not-verified",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _add(*objects) -> int:
    """把若干行插入 analytics 库并 commit；单行时返回其 id。"""
    session = AnalyticsSession()
    try:
        session.add_all(objects)
        session.commit()
        for obj in objects:
            session.refresh(obj)
        return objects[0].id if len(objects) == 1 else [o.id for o in objects]
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 1. ref_label 纯函数映射
# --------------------------------------------------------------------------- #
def test_ref_label_income_types():
    assert ref_label(None, "recharge") == "充值"
    assert ref_label(None, "free") == "注册赠送"
    assert ref_label(None, "manual") == "手动赠送"
    assert ref_label(None, "refund") == "退款"
    # 入账按 type 映射，不受 ref 影响
    assert ref_label("serial:TC-123", "recharge") == "充值"


def test_ref_label_consume_mapping():
    # job：断前尘/预测前缀 + 方法中文
    assert ref_label("job:1:bazi-pattern", "consume", job_type="duan-qian-chen") == "断前尘·八字格局"
    assert ref_label("job:1:ziwei", "consume", job_type="predict") == "预测·紫微"
    assert ref_label("job:1:qimen-lifetime", "consume", job_type="predict") == "预测·奇门"
    assert ref_label("job:1:no-such-method", "consume", job_type="predict") == "预测·no-such-method"
    # job 查不到 → 兜底排盘分析
    assert ref_label("job:9:bazi-pattern", "consume") == "排盘分析"
    # revise / 单法直问
    assert ref_label("revise:7", "consume") == "追问"
    assert ref_label("query:7:xizhan", "consume") == "单法直问·西占"
    # divination：lenormand 雷诺曼，其余起卦深度解读（含记录缺失）
    assert ref_label("divination:3", "consume") == "起卦深度解读"
    assert ref_label("divination:3", "consume", divination_method="lenormand") == "雷诺曼解读"
    assert ref_label("divination:3", "consume", divination_method="liuyao") == "起卦深度解读"
    # tarot / astrology
    assert ref_label("tarot:4", "consume") == "塔罗解读"
    assert ref_label("astrology:5", "consume") == "星座本命解读"
    # agent（REQ-076 王先生对话；有无档案都同名，档案名反查在 label_case_map）
    assert ref_label("agent:7", "consume") == "王先生对话"
    assert ref_label("agent:7:9", "consume") == "王先生对话"
    # consume 且 ref 无法识别 → 消耗
    assert ref_label(None, "consume") == "消耗"
    assert ref_label("weird:xx", "consume") == "消耗"


def test_parse_ref_shape():
    assert parse_ref("job:12:bazi-pattern") == {"kind": "job", "job_id": 12, "method": "bazi-pattern"}
    assert parse_ref("job:12") == {"kind": "job", "job_id": 12, "method": None}
    assert parse_ref("revise:8") == {"kind": "revise", "case_id": 8}
    assert parse_ref("query:8:wuyun-liuqi") == {"kind": "query", "case_id": 8, "method": "wuyun-liuqi"}
    assert parse_ref("divination:2") == {"kind": "divination", "divination_id": 2}
    assert parse_ref("tarot:2") == {"kind": "tarot", "tarot_id": 2}
    assert parse_ref("astrology:2") == {"kind": "astrology", "astrology_id": 2}
    assert parse_ref("agent:7") == {"kind": "agent", "user_id": 7, "case_id": None}
    assert parse_ref("agent:7:9") == {"kind": "agent", "user_id": 7, "case_id": 9}
    assert parse_ref("serial:TC-ABC") == {"kind": "serial", "serial": "TC-ABC"}
    assert parse_ref(None) is None
    assert parse_ref("") is None
    assert parse_ref("job:abc") is None


# --------------------------------------------------------------------------- #
# 2. transactions 每条附 label + case_name（端到端，走 service）
# --------------------------------------------------------------------------- #
def test_transactions_label_and_case_name():
    uid = _create_user()
    case_id = _add(Case(user_id=uid, name="张三的国学档案"))
    job_dqc = _add(Job(user_id=uid, case_id=case_id, type=JobType.duan_qian_chen))
    job_pred = _add(Job(user_id=uid, case_id=case_id, type=JobType.predict))
    div_liuyao = _add(Divination(user_id=uid, case_id=case_id, method="liuyao"))
    div_lenormand = _add(Divination(user_id=uid, case_id=None, method="lenormand"))
    astro = _add(AstrologyReading(user_id=uid, case_id=case_id))
    tarot = _add(TarotReading(user_id=uid, spread_type="single"))

    consume(uid, 1000, ref=f"job:{job_dqc}:bazi-pattern")     # 断前尘·八字格局 + 档案
    consume(uid, 1000, ref=f"job:{job_pred}:ziwei")            # 预测·紫微 + 档案
    consume(uid, 1000, ref="job:999999:bazi-dayun-liunian")    # job 缺失 → 排盘分析
    consume(uid, 1000, ref=f"revise:{case_id}")                # 追问 + 档案
    consume(uid, 1000, ref=f"query:{case_id}:xizhan")          # 单法直问·西占 + 档案
    consume(uid, 1000, ref=f"divination:{div_liuyao}")         # 起卦深度解读 + 档案
    consume(uid, 1000, ref=f"divination:{div_lenormand}")      # 雷诺曼解读，无档案
    consume(uid, 1000, ref="divination:999999")                # 起卦记录缺失 → 起卦深度解读
    consume(uid, 1000, ref=f"tarot:{tarot}")                   # 塔罗解读，无档案
    consume(uid, 1000, ref=f"astrology:{astro}")               # 星座本命解读 + 档案
    consume(uid, 1000, ref=f"agent:{uid}")                     # 王先生对话（闲聊，无档案）
    consume(uid, 1000, ref=f"agent:{uid}:{case_id}")           # 王先生对话 + 档案
    consume(uid, 1000, ref=None)                               # 无 ref consume → 消耗
    consume(uid, 1000, ref="garbage-xx")                       # 未识别 consume → 消耗
    recharge(uid, 100, "recharge", amount=10.0, ref="serial:TC-ABC")  # 充值
    recharge(uid, 220, "free", note="注册赠送")                 # 注册赠送

    items = transactions(uid, limit=200)

    expect = {
        ("consume", f"job:{job_dqc}:bazi-pattern"): ("断前尘·八字格局", "张三的国学档案"),
        ("consume", f"job:{job_pred}:ziwei"): ("预测·紫微", "张三的国学档案"),
        ("consume", "job:999999:bazi-dayun-liunian"): ("排盘分析", None),
        ("consume", f"revise:{case_id}"): ("追问", "张三的国学档案"),
        ("consume", f"query:{case_id}:xizhan"): ("单法直问·西占", "张三的国学档案"),
        ("consume", f"divination:{div_liuyao}"): ("起卦深度解读", "张三的国学档案"),
        ("consume", f"divination:{div_lenormand}"): ("雷诺曼解读", None),
        ("consume", "divination:999999"): ("起卦深度解读", None),
        ("consume", f"tarot:{tarot}"): ("塔罗解读", None),
        ("consume", f"astrology:{astro}"): ("星座本命解读", "张三的国学档案"),
        ("consume", f"agent:{uid}"): ("王先生对话", None),
        ("consume", f"agent:{uid}:{case_id}"): ("王先生对话", "张三的国学档案"),
        ("consume", None): ("消耗", None),            # 无 ref 的 consume
        ("consume", "garbage-xx"): ("消耗", None),    # 未识别 ref 的 consume
        ("recharge", "serial:TC-ABC"): ("充值", None),
        ("free", None): ("注册赠送", None),
    }
    for (typ, ref), (label, case_name) in expect.items():
        matches = [it for it in items if it["type"] == typ and it["ref"] == ref]
        assert matches, f"type={typ!r} ref={ref!r} 未出现在流水中"
        for it in matches:
            assert it["label"] == label, f"type={typ!r} ref={ref!r}: label={it['label']!r}"
            assert it["case_name"] == case_name, \
                f"type={typ!r} ref={ref!r}: case_name={it['case_name']!r}"
