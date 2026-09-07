# -*- coding: utf-8 -*-
"""REQ-076 太初先生 Agent 会话契约测试（backend/tests/unit/test_agent.py）。

覆盖（对应实现范围要求的关键契约）：
  1. GET /api/agent/greeting：鉴权返回开场白文本（含 greeting.md 话术内容）；
     未登录（非 Bearer / 非法令牌）→ 401；
  2. POST /api/agent/chat 成功：落 agent_messages（user/assistant 两行，
     assistant.tokens=本轮 total_tokens）+ 即时扣费（ref=agent:{uid}，ceil 积分）
     + agent_message 埋点 + 记忆抽取入队（mock enqueue 断言调用参数）；
  3. case 越权 404：他人档案 → 404，不调 LLM、不扣费、不落库；
  4. 余额不足 502：预检拦截，不调 LLM、不落库、不扣费；
  5. 记忆召回注入：mock recall 返回记忆块 → 作为独立 system 段注入（在 master.md
     之后、历史之前）；空召回不注入；
  6. 抽取入队被调用：mock enqueue → 以 (user_id, user_msg_id) 精确调用一次；
  7. 历史仅本人隔离：A 的 LLM 历史与 GET /messages 均不混入 B 的消息；
  8. 档案上下文注入：选档案 + 有 chart → system 含姓名/性别/出生/chartSummary；
     LLM 失败 → 502 不扣费不落库。

依赖 conftest 会话级临时库（orchestration_env）；LLM 与记忆（recall/enqueue）均
mock，不真调外部。抽取 worker 全程不介入（chat 用 mock enqueue，不落真实任务行）。
"""
from __future__ import annotations

import json
import uuid

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user(prefix: str = "ag_ut") -> int:
    """临时 analytics 库建真实 user（agent_messages.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"{prefix}_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int, *, name: str | None = "张三的国学档案") -> int:
    from app.database import AnalyticsSession
    from app.models import Case, CaseStatus

    session = AnalyticsSession()
    try:
        case = Case(
            user_id=uid,
            name=name,
            input_json={"birth_year": 1990, "birth_month": 5, "birth_day": 12,
                        "birth_hour": 8, "gender": "male", "birthplace": "上海",
                        "question": "事业运势"},
            status=CaseStatus.paipan_done,
        )
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _attach_chart(case_id: int, chart_json: dict) -> None:
    from app.database import AnalyticsSession
    from app.models import Chart

    session = AnalyticsSession()
    try:
        session.add(Chart(case_id=case_id, chart_json=chart_json, degraded_methods=[]))
        session.commit()
    finally:
        session.close()


def _insert_message(uid: int, role: str, content: str, *, case_id=None, tokens=None) -> int:
    """直插一条 agent_messages（绕 API，供历史/隔离用例准备数据）。"""
    from app.database import AnalyticsSession
    from app.models import AgentMessage

    session = AnalyticsSession()
    try:
        row = AgentMessage(user_id=uid, case_id=case_id, role=role, content=content, tokens=tokens)
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _agent_messages(uid: int):
    from app.database import AnalyticsSession
    from app.models import AgentMessage

    session = AnalyticsSession()
    try:
        return (session.query(AgentMessage)
                .filter(AgentMessage.user_id == uid)
                .order_by(AgentMessage.id.asc()).all())
    finally:
        session.close()


def _consume_rows(uid: int):
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return (session.query(CreditTransaction)
                .filter_by(user_id=uid, type="consume").all())
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


def _fake_chat(monkeypatch, calls, *, content="先生回复（mock）：人生如茶，苦后回甘。",
               tokens=1234, exc=None):
    """stub app.api.agent.chat（不真调 LLM），记录 messages / json_mode。"""
    import app.api.agent as agent_mod

    async def fake_chat(messages, json_mode=False):
        calls.append({"messages": messages, "json_mode": json_mode})
        if exc is not None:
            raise exc
        return {
            "content": content,
            "usage": {"prompt_tokens": 900,
                      "completion_tokens": max(0, int(tokens) - 900),
                      "total_tokens": int(tokens)},
            "model": "mock-model",
        }

    monkeypatch.setattr(agent_mod, "chat", fake_chat)


def _fake_recall(monkeypatch, block: str, calls=None):
    """stub app.api.agent.recall_memories（返回固定记忆块），记录调用参数。"""
    import app.api.agent as agent_mod

    def fake_recall(user_id, query="", k=None, mode="question"):
        if calls is not None:
            calls.append({"user_id": user_id, "query": query, "mode": mode})
        return block

    monkeypatch.setattr(agent_mod, "recall_memories", fake_recall)


def _fake_enqueue(monkeypatch, calls=None):
    """stub app.api.agent.enqueue_extraction（入队 mock，不真落任务行）。"""
    import app.api.agent as agent_mod

    def fake_enqueue(user_id, last_user_msg_id):
        if calls is not None:
            calls.append({"user_id": user_id, "last_user_msg_id": last_user_msg_id})
        return {"status": "queued", "taskId": None}

    monkeypatch.setattr(agent_mod, "enqueue_extraction", fake_enqueue)


@pytest.fixture(scope="module")
def agent_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表；LLM/记忆由用例 stub）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ greeting ----
def test_greeting_returns_text_and_auth_401(agent_client):
    """GET /api/agent/greeting：鉴权返回开场白文本（零扣费）；未登录 401。"""
    uid = _new_user()
    resp = agent_client.get("/api/agent/greeting", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    greeting = body["data"]["greeting"]
    assert isinstance(greeting, str) and greeting.strip()
    assert "太初先生" in greeting
    assert "开场白" in greeting          # 读取了 prompts/agent/greeting.md
    assert "1." in greeting and "4." in greeting  # 含可轮换的多条话术

    # 未登录：非 Bearer → 401
    resp = agent_client.get("/api/agent/greeting",
                            headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    # 非法令牌 → 401
    resp = agent_client.get("/api/agent/greeting",
                            headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


# ------------------------------------------------------------ chat 成功 ----
def test_chat_success_persists_and_charges(agent_client, monkeypatch):
    """chat 成功：落 user/assistant 两行（assistant.tokens=本轮 total_tokens）、
    即时扣费（ref=agent:{uid}，ceil 积分）、agent_message 埋点、抽取入队。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 100, "free", note="pytest 预充")

    content = "先生回复（mock）：看开些，路在脚下。"
    chat_calls: list = []
    enq_calls: list = []
    _fake_chat(monkeypatch, chat_calls, content=content, tokens=1234)
    _fake_recall(monkeypatch, "")          # 无记忆 → 不注入记忆段
    _fake_enqueue(monkeypatch, enq_calls)

    resp = agent_client.post("/api/agent/chat", json={"message": "最近很焦虑，想聊聊。"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["reply"] == content
    assert body["data"]["tokens"] == 1234

    # LLM messages 契约：system=master.md（含角色/合规红线），末尾 user=本次消息
    assert len(chat_calls) == 1
    msgs = chat_calls[0]["messages"]
    assert msgs[0]["role"] == "system"
    assert "太初先生" in msgs[0]["content"] and "合规红线" in msgs[0]["content"]
    assert msgs[-1] == {"role": "user", "content": "最近很焦虑，想聊聊。"}
    assert chat_calls[0]["json_mode"] is False

    # 落库：user + assistant 两行，assistant.tokens=1234，user.tokens=None
    rows = _agent_messages(uid)
    assert len(rows) == 2
    assert [r.role for r in rows] == ["user", "assistant"]
    assert rows[0].content == "最近很焦虑，想聊聊。"
    assert rows[0].tokens is None
    assert rows[1].content == content
    assert rows[1].tokens == 1234

    # 即时扣费：ref=agent:{uid}（无档案），tokens=1234 → delta=-ceil(1234/1000)=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"agent:{uid}"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 记忆抽取入队：以 (user_id, 本条 user 消息 id) 调用一次
    assert len(enq_calls) == 1
    assert enq_calls[0]["user_id"] == uid
    assert enq_calls[0]["last_user_msg_id"] == rows[0].id

    # agent_message 埋点（props 含 tokens 与 case_id）
    evs = _event_rows("agent_message", uid)
    assert len(evs) == 1
    assert evs[0].props == {"tokens": 1234, "case_id": None}


def test_chat_empty_message_400(agent_client, monkeypatch):
    """message 空 → 400，不调 LLM 不扣费不落库。"""
    uid = _new_user()
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)
    resp = agent_client.post("/api/agent/chat", json={"message": "   "},
                             headers=_auth_header(uid))
    assert resp.status_code == 400, resp.text
    assert chat_calls == []
    assert _agent_messages(uid) == []
    assert _consume_rows(uid) == []


# ------------------------------------------------------------ case 越权 ----
def test_chat_foreign_case_404(agent_client, monkeypatch):
    """case_id 非空但属于他人 → 404（归属校验在 LLM/计费之前）。"""
    owner, other = _new_user(), _new_user()
    cid = _new_case(owner)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = agent_client.post("/api/agent/chat",
                             json={"message": "帮我看看这个盘", "case_id": cid},
                             headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    assert chat_calls == []                       # 未触达 LLM
    assert _agent_messages(other) == []           # 不落库
    assert _consume_rows(other) == []             # 不扣费


# ------------------------------------------------------------ 余额不足 ----
def test_chat_insufficient_balance_502(agent_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502），不放行 LLM、不落库。"""
    uid = _new_user()          # balance=0
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = agent_client.post("/api/agent/chat", json={"message": "帮我看看运势"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "积分不足" in body["message"]
    assert chat_calls == []                       # 预检拦截
    assert _agent_messages(uid) == []
    assert _consume_rows(uid) == []


# ------------------------------------------------------------ 记忆召回注入 ----
def test_chat_injects_recalled_memory_block(agent_client, monkeypatch):
    """recall 返回非空记忆块 → 作为独立 system 段注入（在 master.md 之后）；空 → 不注入。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 100, "free", note="pytest 预充")

    memory_block = "【长期记忆（内部参考：勿向用户复述原文）】\n- 用户偏好绿茶（偏好，重要度 0.9）"
    recall_calls: list = []
    chat_calls: list = []
    _fake_recall(monkeypatch, memory_block, calls=recall_calls)
    _fake_chat(monkeypatch, chat_calls)
    _fake_enqueue(monkeypatch)

    resp = agent_client.post("/api/agent/chat", json={"message": "最近睡不好，偏头痛"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text

    # 召回契约：以 (user_id, query=message, mode="question") 调用
    assert len(recall_calls) == 1
    assert recall_calls[0]["user_id"] == uid
    assert recall_calls[0]["query"] == "最近睡不好，偏头痛"
    assert recall_calls[0]["mode"] == "question"

    # 注入契约：system[0]=master.md；system[1]=记忆块（紧跟角色 prompt，§5.3）
    msgs = chat_calls[0]["messages"]
    assert msgs[0]["role"] == "system" and "太初先生" in msgs[0]["content"]
    assert msgs[1]["role"] == "system"
    assert "长期记忆" in msgs[1]["content"] and "偏好绿茶" in msgs[1]["content"]

    # 空召回 → 无记忆 system 段（只有一个 system）
    recall_calls2: list = []
    chat_calls2: list = []
    _fake_recall(monkeypatch, "", calls=recall_calls2)
    _fake_chat(monkeypatch, chat_calls2)
    resp2 = agent_client.post("/api/agent/chat", json={"message": "随便聊聊"},
                              headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    system_count = sum(1 for m in chat_calls2[0]["messages"] if m["role"] == "system")
    assert system_count == 1


# ------------------------------------------------------------ 抽取入队 ----
def test_chat_calls_enqueue_with_user_message_id(agent_client, monkeypatch):
    """抽取入队（mock enqueue）：以 (user_id, 本条 user 消息 id) 调用一次。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 100, "free", note="pytest 预充")
    _fake_chat(monkeypatch, [])
    _fake_recall(monkeypatch, "")
    enq_calls: list = []
    _fake_enqueue(monkeypatch, enq_calls)

    resp = agent_client.post("/api/agent/chat", json={"message": "我最近工作压力好大"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    rows = _agent_messages(uid)
    assert len(rows) == 2
    user_msg = rows[0]
    assert user_msg.role == "user"
    assert len(enq_calls) == 1
    assert enq_calls[0] == {"user_id": uid, "last_user_msg_id": user_msg.id}


# ------------------------------------------------------------ 历史隔离 ----
def test_history_is_own_user_only(agent_client, monkeypatch, chart_snapshot):
    """LLM 历史与 GET /messages 双口径均只含本人消息，不混入其他用户。"""
    uid_a, uid_b = _new_user("ag_a"), _new_user("ag_b")
    from app.credits.service import recharge

    recharge(uid_a, 100, "free", note="pytest 预充")
    # A 有历史对话（user+assistant），B 也有（id 更小，跨用户交错）
    _insert_message(uid_b, "user", "乙用户的私密消息：我藏了私房钱")
    _insert_message(uid_b, "assistant", "乙用户的回复")
    msg_a = _insert_message(uid_a, "user", "甲说：我最近在跳槽面试")
    _insert_message(uid_a, "assistant", "甲先生的回复")

    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)
    _fake_recall(monkeypatch, "")
    _fake_enqueue(monkeypatch)

    resp = agent_client.post("/api/agent/chat", json={"message": "帮我参谋下"},
                             headers=_auth_header(uid_a))
    assert resp.status_code == 200, resp.text

    # LLM 历史只含 A 的过往消息（正序），不混入 B
    msgs = chat_calls[0]["messages"]
    history = [m for m in msgs if m["role"] in ("user", "assistant")]
    history_contents = "".join(m["content"] for m in history)
    assert "甲说：我最近在跳槽面试" in history_contents
    assert "甲先生的回复" in history_contents
    assert "乙用户" not in history_contents
    # 最后一条 user = 本次消息
    assert msgs[-1] == {"role": "user", "content": "帮我参谋下"}
    # 上一轮 user 消息 id < 本次，顺序正序
    assert history[0]["content"] == "甲说：我最近在跳槽面试"
    assert history[1]["content"] == "甲先生的回复"

    # GET /messages：A 只见自己 3 条（2 历史 + 本次 chat 新增 2 条 → 但本次先看历史隔离）
    resp_get = agent_client.get("/api/agent/messages", headers=_auth_header(uid_a))
    assert resp_get.status_code == 200, resp_get.text
    items = resp_get.json()["data"]["messages"]
    contents = "".join(m["content"] for m in items)
    assert "甲说" in contents and "甲先生的回复" in contents
    assert "乙用户" not in contents
    # 按 id 升序（历史在前，本次新增在后）
    ids = [m["id"] for m in items]
    assert ids == sorted(ids)
    assert ids[0] == msg_a

    # B 看不到 A 的消息（隔离另一方向）
    resp_b = agent_client.get("/api/agent/messages", headers=_auth_header(uid_b))
    items_b = resp_b.json()["data"]["messages"]
    assert "甲说" not in "".join(m["content"] for m in items_b)


# ------------------------------------------------------------ 档案上下文 ----
def test_chat_injects_case_context(agent_client, monkeypatch, chart_snapshot):
    """选档案 + 有 chart → system 注入档案信息段（姓名/性别/出生/chartSummary）。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 100, "free", note="pytest 预充")
    cid = _new_case(uid, name="李四的命盘")
    _attach_chart(cid, chart_snapshot)

    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)
    _fake_recall(monkeypatch, "")
    _fake_enqueue(monkeypatch)

    resp = agent_client.post("/api/agent/chat",
                             json={"message": "结合我的盘看看事业", "case_id": cid},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text

    msgs = chat_calls[0]["messages"]
    # 用带方括号的段头精确命中「档案信息」注入段（master.md 只以「所选档案信息」
    # 字样描述输入，不含【】段头，避免误匹配角色 prompt 本身）
    case_system = next(m["content"] for m in msgs
                       if "【所选档案信息】" in m["content"])
    payload = json.loads(case_system.split("\n", 1)[1])
    assert payload["caseId"] == cid
    assert payload["name"] == "李四的命盘"
    assert payload["gender"] == "male"
    assert payload["birth"] == {"year": 1990, "month": 5, "day": 12, "hour": 8}
    assert payload["birthplace"] == "上海"
    summary = payload["chartSummary"]
    assert summary["dayMaster"] == (chart_snapshot.get("bazi") or {}).get("day_master")
    assert summary["pillars"] == (chart_snapshot.get("bazi") or {}).get("pillars")

    # 扣费 ref 含档案：agent:{uid}:{cid}
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"agent:{uid}:{cid}"


def test_chat_llm_error_502(agent_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不扣费、不落库、不入队。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 100, "free", note="pytest 预充")
    from app.llm import LLMError

    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, exc=LLMError("mock LLM 不可用"))
    _fake_recall(monkeypatch, "")
    enq_calls: list = []
    _fake_enqueue(monkeypatch, enq_calls)

    resp = agent_client.post("/api/agent/chat", json={"message": "你好先生"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(chat_calls) == 1
    assert _consume_rows(uid) == []       # LLM 未成功 → 不扣费
    assert _agent_messages(uid) == []     # 不落库
    assert enq_calls == []                # 不入队
