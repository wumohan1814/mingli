# -*- coding: utf-8 -*-
"""六爻焦点详解契约测试（REQ-075 · POST /api/divinations/{div_id}/focus）。

分层覆盖（LLM/Node 转发均 mock，不真调外部）：
  - 非法 focus → 400（body {focus} 六枚举之外）；
  - method != liuyao（如 meihua）→ 400；
  - 归属隔离：跨用户 / 不存在 → 404（校验先于任何 LLM/扣费）；
  - 缓存命中：focus_interpretations 命中该 focus → 二次调用零 LLM 零扣费
    （第一次未命中走 mock chat + 即时扣费 ref=divination_focus:{div_id}:{focus}）；
  - 不同 focus 缓存相互独立：A 命中不影响 B（B 首次仍走 LLM）；
  - 余额不足（未充值）→ check_balance 抛 BizError 5002 → HTTP 502 + code 5002，
    不放行 LLM；
  - S08 注入：mock chat 捕获的 user message JSON 含 yao_texts（本卦/变卦 digest：
    卦辞大象白话 + 动爻爻辞原文/白话；动爻位置不确定时注入整卦 6 条爻辞）。

依赖 conftest 的会话级临时库（orchestration_env）——任何用例都不触碰真实
backend/data/*.db。
"""
from __future__ import annotations

import json
import uuid

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

FOCUS_KEYS = ("moving_yao", "shi_ying", "kong_wang", "an_dong",
              "hui_tou_sheng_ke", "hua_kong_hua_mu")

# 引擎 result 样例（动爻位 1、4）：本卦 雷天大壮 → 短名「大壮」；变卦 火天大有 → 短名「大有」
FOCUS_SAMPLE_RESULT = {
    "originalName": "雷天大壮",
    "changedName": "火天大有",
    "yaoArray": [6, 7, 8, 9, 7, 8],
    "changingYaos": [{"position": 1, "isChanging": True, "type": "老阴"},
                     {"position": 4, "isChanging": True, "type": "老阳"}],
    "palace": {"name": "坤", "wuxing": "土"},
    "palaceStage": "四世",
    "ganzhi": {"year": "甲辰", "month": "丁卯", "day": "丙申", "hour": "戊子"},
    "yaosDetail": [{"position": i + 1, "isChanging": (i + 1) in (1, 4)} for i in range(6)],
    "generation": {"method": "manual"},
}


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"focus_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _make_divination(uid: int, *, method="liuyao", result=None, cached=None) -> int:
    """直插一行 divinations（绕过 API）。result 缺省用动爻 1/4 的六爻样例。"""
    from app.database import AnalyticsSession
    from app.models import Divination

    session = AnalyticsSession()
    try:
        row = Divination(
            user_id=uid,
            method=method,
            seed_json={"customDate": "2024-05-12T08:30:00+08:00",
                       "options": {"method": "manual", "yaos": [6, 7, 8, 9, 7, 8]}},
            result_json=result if result is not None else FOCUS_SAMPLE_RESULT,
            interpretation_json=None,
            focus_interpretations=cached,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _divination_row(div_id: int):
    from app.database import AnalyticsSession
    from app.models import Divination

    session = AnalyticsSession()
    try:
        return session.query(Divination).filter_by(id=div_id).first()
    finally:
        session.close()


def _consume_rows(user_id: int):
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return (session.query(CreditTransaction)
                .filter_by(user_id=user_id, type="consume").all())
    finally:
        session.close()


def _event_rows(event_name: str, user_id: int):
    from app.database import OpsSession
    from app.models.ops import Event

    session = OpsSession()
    try:
        return session.query(Event).filter_by(event_name=event_name, user_id=user_id).all()
    finally:
        session.close()


def _fake_chat(monkeypatch, calls, *, content="焦点详解（mock）：此盘该焦点倾向平稳，宜结合世应细看。", tokens=1234, exc=None):
    """stub app.api.divination.chat（不真调 LLM），记录 messages / json_mode。"""
    import app.api.divination as divination_mod

    async def fake_chat(messages, json_mode=False):
        calls.append({"messages": messages, "json_mode": json_mode})
        if exc is not None:
            raise exc
        return {
            "content": content,
            "usage": {"prompt_tokens": 900, "completion_tokens": tokens - 900,
                      "total_tokens": tokens},
            "model": "mock-model",
        }

    monkeypatch.setattr(divination_mod, "chat", fake_chat)


def _recharge(uid: int, amount: int = 100) -> None:
    from app.credits.service import recharge

    recharge(uid, amount, "free", note="pytest 预充")


def _post_focus(client, div_id: int, uid: int, focus: str):
    return client.post(f"/api/divinations/{div_id}/focus",
                       json={"focus": focus}, headers=_auth_header(uid))


# ------------------------------------------------------------ 端点夹具 ----
@pytest.fixture(scope="module")
def focus_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表/拉起 Node）；chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 契约用例 ----
def test_focus_invalid_key_400(focus_client, monkeypatch):
    """非法 focus（不在六枚举）→ 400，不触达 LLM / 不扣费。"""
    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "not-a-focus")
    assert resp.status_code == 400, resp.text
    assert "不支持的六爻焦点" in resp.json()["message"]
    assert chat_calls == []
    assert _consume_rows(uid) == []

    # 空串 / 缺失 focus 同样 400（body 校验或端点校验兜底）
    resp = _post_focus(focus_client, div_id, uid, "")
    assert resp.status_code == 400, resp.text


def test_focus_non_liuyao_400(focus_client, monkeypatch):
    """method != liuyao（如 meihua）→ 400 仅六爻支持，不触达 LLM / 不扣费。"""
    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid, method="meihua")
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp.status_code == 400, resp.text
    assert "仅支持六爻" in resp.json()["message"]
    assert chat_calls == []
    assert _consume_rows(uid) == []


def test_focus_isolation_404(focus_client, monkeypatch):
    """跨用户 / 不存在 → 404，隔离先于计费与 LLM。"""
    owner = _new_user()
    other = _new_user()
    _recharge(other)
    div_id = _make_divination(owner)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, other, "moving_yao")
    assert resp.status_code == 404, resp.text
    assert chat_calls == []
    assert _consume_rows(other) == []

    resp = _post_focus(focus_client, 999999, other, "moving_yao")
    assert resp.status_code == 404, resp.text


def test_focus_cache_hit_second_call_zero_cost(focus_client, monkeypatch):
    """未命中：mock chat + 即时扣费 + 写回 focus_interpretations + 埋点；
    二次同 focus：命中缓存 → 零 LLM 零扣费。"""
    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid)
    content = "焦点详解（mock）：此盘动爻 1/4 发力，倾向推进但需稳。"
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, content=content, tokens=1234)

    # 第一次：走 LLM
    resp = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["focus"] == "moving_yao"
    assert body["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert chat_calls[0]["json_mode"] is False

    # 即时扣费：ref=divination_focus:{div_id}:moving_yao，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"divination_focus:{div_id}:moving_yao"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 写回缓存（focus_interpretations[moving_yao]）
    row = _divination_row(div_id)
    assert row.focus_interpretations == {"moving_yao": content}

    # 埋点：divination_focus_interpret
    evs = _event_rows("divination_focus_interpret", uid)
    assert len(evs) == 1
    assert evs[0].props == {"method": "liuyao", "divination_id": div_id, "focus": "moving_yao"}

    # 第二次：命中缓存 → 零 LLM、零新增扣费
    resp2 = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert len(_consume_rows(uid)) == 1


def test_focus_different_keys_independent_cache(focus_client, monkeypatch):
    """不同 focus 缓存相互独立：A 缓存命中不影响 B 首次走 LLM 扣费。"""
    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid)
    content_a = "A 焦点详解（mock）"
    content_b = "B 焦点详解（mock）"
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, content=content_a, tokens=1000)

    # A 首次：走 LLM
    resp_a = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp_a.status_code == 200, resp_a.text
    assert resp_a.json()["data"]["interpretation"] == content_a

    # A 命中缓存：不再调 LLM
    resp_a2 = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp_a2.status_code == 200
    assert resp_a2.json()["data"]["interpretation"] == content_a

    # B（kong_wang）首次：独立走 LLM（不同 ref、不同 content）
    _fake_chat(monkeypatch, chat_calls, content=content_b, tokens=888)
    resp_b = _post_focus(focus_client, div_id, uid, "kong_wang")
    assert resp_b.status_code == 200, resp_b.text
    assert resp_b.json()["data"]["interpretation"] == content_b

    assert len(chat_calls) == 2          # A 首次 + B 首次；A 二次命中不调
    refs = [t.ref for t in _consume_rows(uid)]
    assert refs == [f"divination_focus:{div_id}:moving_yao",
                    f"divination_focus:{div_id}:kong_wang"]
    row = _divination_row(div_id)
    assert row.focus_interpretations == {"moving_yao": content_a, "kong_wang": content_b}


def test_focus_cache_hit_prefilled_zero_cost(focus_client, monkeypatch):
    """预置 focus_interpretations 命中（他人/历史已详解）→ 直接返回，零 LLM 零扣费。"""
    uid = _new_user()
    div_id = _make_divination(uid, cached={"shi_ying": "预置世应详解"})
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "shi_ying")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == "预置世应详解"
    assert chat_calls == []
    assert _consume_rows(uid) == []


def test_focus_insufficient_balance_502(focus_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    uid = _new_user()          # 未充值，balance=0
    div_id = _make_divination(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "an_dong")
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "余额不足" in body["message"]
    assert chat_calls == []                # 预检拦截，未调 LLM
    assert _consume_rows(uid) == []


def test_focus_llm_error_502(focus_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不落缓存、不扣费。"""
    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid)

    from app.llm import LLMError
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, exc=LLMError("mock LLM 不可用"))

    resp = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(chat_calls) == 1
    assert _consume_rows(uid) == []
    assert _divination_row(div_id).focus_interpretations is None  # 未缓存


def test_focus_injects_s08_yao_texts(focus_client, monkeypatch):
    """S08 注入：user message JSON 含 yao_texts = 本卦/变卦 digest
    （guaCi/xiangCi 白话 + 动爻爻辞 original+baihua，动爻位 1、4）。"""
    from app.api.divination import DIVINATION_FOCUS_PROMPT_PATH, LIUYAO_TEXTS_PATH

    uid = _new_user()
    _recharge(uid)
    div_id = _make_divination(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "moving_yao")
    assert resp.status_code == 200, resp.text
    assert len(chat_calls) == 1

    # system = divination_focus.md（按次 read_text，REQ-048 热改可生效）
    messages = chat_calls[0]["messages"]
    assert len(messages) == 2 and messages[0]["role"] == "system"
    assert "六爻焦点详解" in messages[0]["content"]
    assert messages[0]["content"] == DIVINATION_FOCUS_PROMPT_PATH.read_text(encoding="utf-8")

    payload = json.loads(messages[1]["content"])
    assert payload["focus"] == "moving_yao"
    assert payload["method"] == "liuyao"
    assert payload["chart_summary"] is None

    # yao_texts 注入存在且结构正确（与 backend/app/data/liuyao_yaoci.json 比对）
    yao_texts = payload["yao_texts"]
    assert isinstance(yao_texts, dict) and yao_texts, "user message 缺 yao_texts"
    disk = json.loads(LIUYAO_TEXTS_PATH.read_text(encoding="utf-8"))
    by_name = {h["name"]: h for h in disk["hexagrams"]}

    og = yao_texts["original_gua"]
    assert og["guaName"] == "大壮"                    # 雷天大壮 → S08「大壮」
    assert og["guaCi"] == by_name["大壮"]["guaCi"]["baihua"]
    assert og["xiangCi"] == by_name["大壮"]["xiangCi"]["baihua"]
    assert [y["position"] for y in og["movingYaos"]] == [1, 4]
    for mv in og["movingYaos"]:
        yao = by_name["大壮"]["yaoCi"][mv["position"] - 1]
        assert mv["yaoName"] == yao["name"]
        assert mv["original"] == yao["original"]
        assert mv["baihua"] == yao["baihua"]

    cg = yao_texts["changed_gua"]
    assert cg["guaName"] == "大有"                    # 火天大有 → S08「大有」
    assert cg["guaCi"] == by_name["大有"]["guaCi"]["baihua"]
    assert [y["position"] for y in cg["movingYaos"]] == [1, 4]

    # 爻辞原文确实进入了 user message（存在 yao_texts 且含原文文本）
    assert any(mv["original"] for mv in og["movingYaos"])


def test_focus_s08_fallback_all_yaoci_when_positions_unknown(focus_client, monkeypatch):
    """动爻位置映射不确定（result 无 changingYaos/yaosDetail/yaoArray）→
    注入本卦 + 变卦整卦 6 条爻辞（量小可接受，测试兜底路径）。"""
    uid = _new_user()
    _recharge(uid)
    # 只有卦名、无任何动爻位置来源
    div_id = _make_divination(
        uid, result={"originalName": "雷天大壮", "changedName": "火天大有",
                     "ganzhi": {"year": "甲辰", "month": "丁卯", "day": "丙申"}})
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = _post_focus(focus_client, div_id, uid, "shi_ying")
    assert resp.status_code == 200, resp.text

    payload = json.loads(chat_calls[0]["messages"][1]["content"])
    yao_texts = payload["yao_texts"]
    assert len(yao_texts["original_gua"]["movingYaos"]) == 6
    assert len(yao_texts["changed_gua"]["movingYaos"]) == 6
    assert [y["position"] for y in yao_texts["original_gua"]["movingYaos"]] == [1, 2, 3, 4, 5, 6]
