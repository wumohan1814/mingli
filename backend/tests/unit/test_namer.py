# -*- coding: utf-8 -*-
"""八字/九法起名契约测试（REQ-094 · /api/namer/name）。

分层覆盖（LLM 均 mock，不真调外部）：
  1. 鉴权：缺 Authorization → 400（Header 必填校验）；非 Bearer / 非法令牌 → 401；
  2. 归属/参数：非本人档案 / 不存在 → 404；档案未排盘 → 400「请先生成」（不调 LLM）；
     姓氏为空 / 超 2 字 → 400；
  3. 成功链路：已排盘档案 + 姓氏 → code:0 + names（不含姓氏 1~2 字，full=姓+名），
     messages 契约（system=prompts/namer/master.md；user JSON 含 surname /
     surname_chars / direction / bazi 八字画像）；即时扣费 ref=naming（tokens→
     ceil 存储单位）；
  4. 字数硬约束兜底：首轮全不合规 → 带纠正消息重试一次；重试仍不合规 → 取首个
     非空候选裁剪到 2 字（adjusted=true）；两次都空结果 → 502 不扣费；
  5. 计费语义：余额不足 → 502 + code 5002 不放行 LLM；LLM 失败 → 502 不扣费；
  6. REQ-048：namer_master 已注册进 admin PROMPT_FILES，文件存在且带合规免责。

依赖 conftest 的会话级临时库（orchestration_env）——不触碰真实 backend/data/*.db。
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
CHART_JSON_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "chart.json"

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"namer_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int) -> int:
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, name="测试档案", input_json={"question": "事业运势"})
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _add_chart(cid: int, chart: dict) -> None:
    from app.database import AnalyticsSession
    from app.models import Chart

    session = AnalyticsSession()
    try:
        session.add(Chart(case_id=cid, chart_json=chart))
        session.commit()
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


def _chart_snapshot() -> dict:
    with open(CHART_JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


def _fake_chat(monkeypatch, calls, *, responses=None, exc=None, tokens=1000):
    """stub app.api.namer 模块的 chat（不真调 LLM），按序返回 responses（list of str）。

    responses 为 None 时每次返回同一 content；exc 非 None 则首轮即抛（其余轮正常）。
    """
    import app.api.namer as namer_mod

    if responses is None:
        responses = ['{"names": [{"name": "沐宸", "reason": "补水"}]}']

    seq = list(responses)
    token_seq = list(tokens) if isinstance(tokens, (list, tuple)) else None

    async def fake_chat(messages, json_mode=False):
        calls.append({"messages": messages, "json_mode": json_mode})
        if exc is not None and len(calls) == 1:
            raise exc
        content = seq[0] if len(seq) == 1 else seq.pop(0)
        total = token_seq.pop(0) if token_seq else (tokens if not isinstance(tokens, (list, tuple)) else 1000)
        return {
            "content": content,
            "usage": {"prompt_tokens": total - 100, "completion_tokens": 100,
                      "total_tokens": total},
            "model": "mock-model",
        }

    monkeypatch.setattr(namer_mod, "chat", fake_chat)


@pytest.fixture(scope="module")
def namer_client(orchestration_env):
    """真实 FastAPI app 的 TestClient；chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 用例 ----
def test_namer_requires_auth(namer_client):
    """鉴权契约：缺 Authorization → 400（Header 必填）；非 Bearer/非法令牌 → 401。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    body = {"case_id": cid, "surname": "李"}

    resp = namer_client.post("/api/namer/name", json=body)
    assert resp.status_code == 400

    resp = namer_client.post("/api/namer/name", json=body,
                             headers={"Authorization": "Token abc"})
    assert resp.status_code == 401

    resp = namer_client.post("/api/namer/name", json=body,
                             headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_namer_not_owned_case_404(namer_client, monkeypatch):
    """非本人 / 不存在档案 → 404（隔离在计费/LLM 之前）。"""
    uid = _new_user()
    other = _new_user()
    other_cid = _new_case(other)
    _add_chart(other_cid, _chart_snapshot())

    calls: list = []
    _fake_chat(monkeypatch, calls)
    auth = _auth_header(uid)

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": other_cid, "surname": "李"},
                             headers=auth)
    assert resp.status_code == 404, resp.text
    assert "档案不存在" in resp.json()["message"]

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": 999999, "surname": "李"},
                             headers=auth)
    assert resp.status_code == 404

    assert calls == []
    assert _consume_rows(uid) == []


def test_namer_missing_chart_400_not_generated(namer_client, monkeypatch):
    """档案未排盘 → 400 提示先生成（不自动生成、不调 LLM、不扣费）。"""
    uid = _new_user()
    cid = _new_case(uid)

    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 400, resp.text
    assert "未排盘" in resp.json()["message"] and "请先生成" in resp.json()["message"]
    assert calls == []
    assert _consume_rows(uid) == []


def test_namer_surname_param_400(namer_client, monkeypatch):
    """姓氏必填 / 超 2 字 → 400（字数硬约束的姓氏侧）。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    calls: list = []
    _fake_chat(monkeypatch, calls)
    auth = _auth_header(uid)

    resp = namer_client.post("/api/namer/name", json={"case_id": cid, "surname": "  "},
                             headers=auth)
    assert resp.status_code == 400
    assert "姓氏" in resp.json()["message"]

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "欧阳娜"},
                             headers=auth)
    assert resp.status_code == 400
    assert calls == []


def test_namer_success_chain(namer_client, monkeypatch):
    """成功链路：已排盘档案 + 姓氏 + direction → code:0 + 1~2 字名字（不含姓氏），
    full=姓+名；messages 契约；即时扣费 ref=naming（tokens=1234 → delta=-2）。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    content = '{"names": [{"name": "沐宸", "reason": "补水养木"}, {"name": "知遥", "reason": "取印星文雅"}], "notes": "两案皆合喜用水木"}'
    calls: list = []
    _fake_chat(monkeypatch, calls, responses=[content], tokens=1234)

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李", "direction": "诗意"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["adjusted"] is False
    names = data["names"]
    assert len(names) == 2
    assert names[0]["name"] == "沐宸" and names[0]["full"] == "李沐宸"
    assert names[1]["name"] == "知遥" and names[1]["full"] == "李知遥"
    assert names[0]["reason"] and names[1]["reason"]
    assert all(1 <= len(n["name"]) <= 2 for n in names)   # 不含姓氏 1~2 字
    assert data["notes"]

    # messages 契约：system=prompts/namer/master.md；user JSON 含 surname/direction/bazi
    assert len(calls) == 1
    msg = calls[0]["messages"]
    assert calls[0]["json_mode"] is True
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "起名" in msg[0]["content"] and "五行" in msg[0]["content"]
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["surname"] == "李"
    assert user_payload["surname_chars"] == 1
    assert user_payload["direction"] == "诗意"
    profile = user_payload["bazi"]
    assert profile["dayMaster"] and profile["dayMasterWuxing"]
    assert profile["pillars"]["day"]["gan"]

    # 即时扣费：ref=naming，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == "naming"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2


def test_namer_retry_after_invalid_length(namer_client, monkeypatch):
    """字数兜底-重试：首轮全不合规 → 追加纠正消息重试一次，二轮合规 → 200
    （两次调用都扣费，tokens 相加）。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    bad = '{"names": [{"name": "李沐宸安", "reason": "bad"}]}'          # 4 字超长
    good = '{"names": [{"name": "梓涵", "reason": "补木"}]}'
    calls: list = []
    _fake_chat(monkeypatch, calls, responses=[bad, good], tokens=[700, 800])

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["names"][0]["name"] == "梓涵"
    assert data["adjusted"] is False

    # 两次 chat：第二次带 assistant=首轮输出 + 纠正 user 消息
    assert len(calls) == 2
    second = calls[1]["messages"]
    assert second[1]["role"] == "user"          # 原始输入
    assert second[2]["role"] == "assistant" and bad in second[2]["content"]
    assert second[3]["role"] == "user"
    assert "1~2" in second[3]["content"] and "姓氏" in second[3]["content"]

    # 扣费为两次 tokens 之和（1500 → delta=-2）
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].tokens == 1500
    assert txs[0].delta == -2


def test_namer_crop_fallback_adjusted(namer_client, monkeypatch):
    """字数兜底-裁剪：两轮都不合规 → 取首个非空候选裁剪到 2 字（adjusted=true）。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    bad1 = '{"names": [{"name": "李沐宸安", "reason": "x"}]}'
    bad2 = '{"names": [{"name": "司马知遥远", "reason": "y"}]}'
    calls: list = []
    _fake_chat(monkeypatch, calls, responses=[bad1, bad2], tokens=[500, 600])

    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["adjusted"] is True
    # 首个非空候选「李沐宸安」裁剪保留末 2 字 → 「宸安」（不含姓氏 2 字）
    assert data["names"][0]["name"] == "宸安"
    assert data["names"][0]["full"] == "李宸安"
    assert len(calls) == 2
    txs = _consume_rows(uid)
    assert len(txs) == 1 and txs[0].tokens == 1100


def test_namer_no_usable_names_502(namer_client, monkeypatch):
    """两轮都是空结果/解析失败 → 502 不扣费。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    calls: list = []
    _fake_chat(monkeypatch, calls, responses=["不是JSON", "也不是JSON"], tokens=[400, 400])
    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(calls) == 2
    assert _consume_rows(uid) == []       # 质量失败不扣费


def test_namer_insufficient_balance_5002(namer_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "余额不足" in body["message"]
    assert calls == []
    assert _consume_rows(uid) == []


def test_namer_llm_error_502_no_charge(namer_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不扣费。"""
    from app.llm import LLMError

    uid = _new_user()
    cid = _new_case(uid)
    _add_chart(cid, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    calls: list = []
    _fake_chat(monkeypatch, calls, exc=LLMError("mock LLM 不可用"))
    resp = namer_client.post("/api/namer/name",
                             json={"case_id": cid, "surname": "李"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(calls) == 1
    assert _consume_rows(uid) == []


def test_namer_prompt_registered_and_bounded():
    """REQ-048 归属：namer_master 注册进 admin PROMPT_FILES（后台可热改/回滚），
    文件存在、带合规免责、篇幅受控。"""
    from app.admin.router import PROMPT_FILES

    assert PROMPT_FILES["namer_master"] == "namer/master.md"
    text = (BACKEND_DIR / "prompts" / "namer" / "master.md").read_text(encoding="utf-8")
    assert 300 <= len(text) <= 1500, f"namer/master.md 篇幅越界（len={len(text)}）"
    assert "免责" in text and "娱乐" in text
    assert "禁止" in text or "严禁" in text
    # 字数硬约束写在 prompt 里（名字部分 1~2 字 / 不含姓氏）
    assert "1~2" in text and "姓氏" in text and "JSON" in text
