# -*- coding: utf-8 -*-
"""REQ-077 长期记忆模块契约测试（纯本地临时库，零网络 LLM/Node 依赖）。

覆盖（对应实现范围要求的关键契约）：
  1. 入队幂等：同用户 pending 合并（end 前滚、不重复建行）、游标推进、noop；
  2. 背压：全库 pending ≥ 上限时新投递丢弃（monkeypatch 阈值）；
  3. worker LLM 抽取（mock chat）：任务 done、事实落库、跨轮 content_hash 去重刷新；
  4. worker 失败分支：不可重试 → dead + 规则兜底；可重试 → 指数退避 → 3 次后 dead；
  5. 召回：BM25+时间衰减混合分文本块、跨用户隔离（甲查不到乙）、access_count 维护、
    降级 recency；开关关闭 → 召回/抽取均跳过（数据保留）；
  6. 清理维护：180 天低价值软删 + 软删超 30 天物理清除；
  7. API：列表分页/数量/单删越权 404/一键清空/鉴权 400。

依赖 conftest 会话级临时库（orchestration_env + memory_env 建 FTS/触发器），
不触碰真实 backend/data/*.db。抽取 worker 全部经 process_due_task_once 手动驱动，
mock app.memory.service.chat，绝不发真实 LLM 请求。
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user(prefix: str = "mem_ut") -> int:
    """临时 analytics 库建真实 user（agent_memories.user_id 有外键约束）。"""
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


def _insert_agent_message(session, user_id: int, content: str) -> int:
    """向测试自建的 agent_messages（REQ-076 最小列形态）插一条 user 消息，返回其 id。"""
    from sqlalchemy import text

    session.execute(
        text(
            "INSERT INTO agent_messages (user_id, role, content, created_at) "
            "VALUES (:uid, 'user', :content, :now)"
        ),
        {"uid": user_id, "content": content, "now": datetime.utcnow()},
    )
    session.commit()
    return int(
        session.execute(
            text("SELECT max(id) FROM agent_messages WHERE user_id = :uid"),
            {"uid": user_id},
        ).scalar()
    )


def _add_memory(session, user_id: int, content: str, *,
                fact_type: str = "preference", importance: float = 0.8,
                trust: float = 0.7, last_recalled_at=None, deleted_at=None) -> int:
    """直接落一条活跃/软删事实（hash 用服务层同款归一算法，保证去重语义一致）。"""
    from app.memory.service import content_hash_of
    from app.models import AgentMemory

    now = datetime.utcnow()
    row = AgentMemory(
        user_id=user_id,
        content=content,
        fact_type=fact_type,
        importance=importance,
        trust=trust,
        content_hash=content_hash_of(content),
        source_type="agent_chat",
        access_count=0,
        last_recalled_at=last_recalled_at,
        deleted_at=deleted_at,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row.id


def _memory_rows(user_id: int | None = None, deleted: bool = False):
    from app.database import AnalyticsSession
    from app.models import AgentMemory

    session = AnalyticsSession()
    try:
        q = session.query(AgentMemory)
        if deleted:
            q = q.filter(AgentMemory.deleted_at.isnot(None))
        else:
            q = q.filter(AgentMemory.deleted_at.is_(None))
        if user_id is not None:
            q = q.filter(AgentMemory.user_id == user_id)
        return q.all()
    finally:
        session.close()


def _task_rows(user_id: int | None = None):
    from app.database import AnalyticsSession
    from app.models import AgentMemoryTask

    session = AnalyticsSession()
    try:
        q = session.query(AgentMemoryTask)
        if user_id is not None:
            q = q.filter(AgentMemoryTask.user_id == user_id)
        return q.all()
    finally:
        session.close()


def _set_agent_enabled(user_id: int, enabled: bool) -> None:
    from app.database import AnalyticsSession
    from app.models import UserSetting

    session = AnalyticsSession()
    try:
        row = session.query(UserSetting).filter_by(user_id=user_id).first()
        if row is None:
            row = UserSetting(user_id=user_id)
            session.add(row)
        row.agent_enabled = enabled
        session.commit()
    finally:
        session.close()


@pytest.fixture(scope="session")
def memory_env(orchestration_env):
    """会话级：在临时 analytics 库补建 FTS5 镜像表 + 同步触发器（幂等）。"""
    from app.database import ensure_agent_memory_fts

    ensure_agent_memory_fts()


@pytest.fixture(autouse=True)
def _clean_memory_state(memory_env):
    """每例前置清理：记忆/任务/消息源三表清空 + 自建 agent_messages 消息源表。

    agent_messages 由 REQ-076 建表（本模块不建）；这里按方案书 §7.2 最小列约定
    （id/user_id/role/content/created_at）自建测试消息来源，联调真实 loader。
    """
    from app.database import AnalyticsSession
    from sqlalchemy import text

    session = AnalyticsSession()
    try:
        session.execute(
            text(
                "CREATE TABLE IF NOT EXISTS agent_messages ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                "user_id INTEGER NOT NULL,"
                "role VARCHAR(16) NOT NULL,"
                "content TEXT NOT NULL,"
                "created_at DATETIME)"
            )
        )
        for table in ("agent_memory_tasks", "agent_memories", "agent_messages"):
            session.execute(text(f"DELETE FROM {table}"))
        session.commit()
    finally:
        session.close()


def _run_worker_once() -> bool:
    """同步驱动一次 worker 单轮（测试内串行，等价于 worker 的一次认领执行）。"""
    from app.memory.service import process_due_task_once

    return asyncio.run(process_due_task_once())


def _fake_chat_ok(payload: dict, *, retriable: bool = False):
    """构造 LLM chat mock：返回固定 json_mode 抽取结果。"""
    async def fake(messages, **kwargs):
        return {
            "content": json.dumps(payload, ensure_ascii=False),
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            "model": "mock",
        }
    return fake


def _fake_chat_fail(message: str = "mock LLM 不可用", retriable: bool = False):
    from app.llm.client import LLMError

    async def fake(messages, **kwargs):
        raise LLMError(message, retriable=retriable)
    return fake


# ------------------------------------------------------------ 入队幂等 ----
def test_enqueue_merges_pending_and_advances_cursor(monkeypatch):
    """同用户 pending 合并：重复入队只前滚 end_msg_id，不重复建行；终态后新任务
    起点 = 上个终态任务 end（游标推进）。"""
    from app.memory import service as ms
    from app.models import AgentMemoryTask

    uid = _new_user()

    # 首次入队 → queued（新用户 start=0）
    r1 = ms.enqueue_extraction(uid, 10)
    assert r1["status"] == "queued"
    tasks = _task_rows(uid)
    assert len(tasks) == 1
    assert tasks[0].start_msg_id == 0 and tasks[0].end_msg_id == 10
    assert tasks[0].status == "pending"

    # 已有 pending → merged（end 前滚 10→20，不插新行）
    r2 = ms.enqueue_extraction(uid, 20)
    assert r2["status"] == "merged"
    assert len(_task_rows(uid)) == 1
    assert _task_rows(uid)[0].end_msg_id == 20

    # 无新内容（last <= 已有 end）→ noop
    r3 = ms.enqueue_extraction(uid, 15)
    assert r3["status"] == "noop"
    assert len(_task_rows(uid)) == 1

    # 终态（done）后：新任务起点 = 上个终态 end（游标推进），不再合并
    session = ms.AnalyticsSession()
    try:
        t = session.get(AgentMemoryTask, _task_rows(uid)[0].id)
        t.status = "done"
        session.commit()
    finally:
        session.close()
    r4 = ms.enqueue_extraction(uid, 25)
    assert r4["status"] == "queued"
    tasks = _task_rows(uid)
    assert len(tasks) == 2
    newest = max(tasks, key=lambda t: t.id)
    assert newest.start_msg_id == 20 and newest.end_msg_id == 25


def test_enqueue_backpressure_drops_new_tasks(monkeypatch):
    """全库 pending ≥ 上限（monkeypatch=2）时新投递直接丢弃，不建行。"""
    from app.memory import service as ms

    monkeypatch.setattr(ms, "MAX_PENDING_TASKS", 2)
    uid_a, uid_b, uid_c = _new_user(), _new_user(), _new_user()

    assert ms.enqueue_extraction(uid_a, 5)["status"] == "queued"
    assert ms.enqueue_extraction(uid_b, 5)["status"] == "queued"
    assert len(_task_rows()) == 2

    # 达到上限：第 3 个用户的新任务被背压丢弃（单用户 pending 恒 1 由合并保证）
    r = ms.enqueue_extraction(uid_c, 5)
    assert r["status"] == "dropped"
    assert _task_rows(uid_c) == []
    assert len(_task_rows()) == 2


# ------------------------------------------------------------ worker：LLM 抽取 ----
def test_worker_llm_extract_inserts_and_dedup_refreshes(monkeypatch):
    """LLM json_mode 抽取（mock chat）：事实落库 + 任务 done；同一事实跨轮重抽
    走 content_hash 去重刷新，不新增行（§2.6 事实层幂等）。"""
    import json

    from app.memory import service as ms
    from app.database import AnalyticsSession

    uid = _new_user()
    session = AnalyticsSession()
    try:
        last1 = _insert_agent_message(session, uid, "我平时喜欢喝茶，尤其偏好绿茶。")
        last2 = _insert_agent_message(session, uid, "我目标是今年升职。")
    finally:
        session.close()

    payload = {"memories": [
        {"content": "用户偏好绿茶", "fact_type": "preference", "importance": 0.8,
         "tags": ["茶", "偏好"]},
        {"content": "用户目标是今年升职", "fact_type": "goal", "importance": 0.9,
         "tags": ["事业"]},
    ]}
    monkeypatch.setattr(ms, "chat", _fake_chat_ok(payload))

    assert ms.enqueue_extraction(uid, last2)["status"] == "queued"
    assert _run_worker_once() is True      # 认领并完成
    assert _run_worker_once() is False     # 无到期任务

    tasks = _task_rows(uid)
    assert len(tasks) == 1 and tasks[0].status == "done"
    rows = _memory_rows(uid)
    assert len(rows) == 2
    by_content = {r.content: r for r in rows}
    assert by_content["用户偏好绿茶"].fact_type == "preference"
    assert by_content["用户偏好绿茶"].importance == pytest.approx(0.8)
    assert by_content["用户目标是今年升职"].fact_type == "goal"
    assert by_content["用户目标是今年升职"].source_task_id == tasks[0].id

    # 下一轮再来一条相同事实 → 去重刷新：不新增行（hash 唯一）
    session = AnalyticsSession()
    try:
        last3 = _insert_agent_message(session, uid, "我平时喜欢喝茶，尤其偏好绿茶。")
    finally:
        session.close()
    assert ms.enqueue_extraction(uid, last3)["status"] == "queued"
    assert _run_worker_once() is True
    assert len(_memory_rows(uid)) == 2      # 未新增
    assert len(_task_rows(uid)) == 2
    assert _task_rows(uid)[-1].status == "done"


def test_worker_retriable_backoff_then_dead(monkeypatch):
    """可重试失败：attempts+1 置回 pending + 指数退避（next_retry_at 在未来），
    未到期不认领；3 次尝试后 dead（终态）。"""
    from app.memory import service as ms
    from app.database import AnalyticsSession
    from app.models import AgentMemoryTask

    uid = _new_user()
    session = AnalyticsSession()
    try:
        last = _insert_agent_message(session, uid, "我今天只吃了一碗面。")  # 无标记词 → 规则兜底 0 条
    finally:
        session.close()
    monkeypatch.setattr(ms, "chat", _fake_chat_fail("mock 超时", retriable=True))

    assert ms.enqueue_extraction(uid, last)["status"] == "queued"

    # 第 1 次失败 → pending + 退避
    assert _run_worker_once() is True
    t = _task_rows(uid)[0]
    assert t.attempts == 1 and t.status == "pending"
    assert t.next_retry_at is not None and t.next_retry_at > datetime.utcnow()
    # 未到退避时间 → 不认领
    assert _run_worker_once() is False

    def _force_due(task_id: int) -> None:
        s = AnalyticsSession()
        try:
            row = s.get(AgentMemoryTask, task_id)
            row.next_retry_at = datetime.utcnow() - timedelta(seconds=1)
            s.commit()
        finally:
            s.close()

    # 第 2 次失败 → attempts=2，仍 pending 退避
    _force_due(t.id)
    assert _run_worker_once() is True
    t = _task_rows(uid)[0]
    assert t.attempts == 2 and t.status == "pending"

    # 第 3 次失败（attempts 达上限）→ dead
    _force_due(t.id)
    assert _run_worker_once() is True
    t = _task_rows(uid)[0]
    assert t.attempts == 3 and t.status == "dead"
    assert "mock 超时" in (t.last_error or "")
    assert _memory_rows(uid) == []            # 无标记词 → 规则兜底也为空，无事实


def test_worker_nonretriable_failure_rule_fallback(monkeypatch):
    """不可重试失败（401/400 等）→ dead，但 dead 前执行规则启发式兜底
    （§2.5：该回合至少以规则方式入记忆；规则抽取固定 trust=0.75）。"""
    from app.memory import service as ms
    from app.database import AnalyticsSession

    uid = _new_user()
    session = AnalyticsSession()
    try:
        last = _insert_agent_message(session, uid, "用户的目标是在今年升职。为此正在准备面试。")
    finally:
        session.close()
    monkeypatch.setattr(ms, "chat", _fake_chat_fail("mock 鉴权失败", retriable=False))

    assert ms.enqueue_extraction(uid, last)["status"] == "queued"
    assert _run_worker_once() is True

    t = _task_rows(uid)[0]
    assert t.status == "dead"
    assert "mock 鉴权失败" in (t.last_error or "")
    rows = _memory_rows(uid)
    assert len(rows) == 1
    assert rows[0].fact_type == "goal"        # 「目标是」命中 goal 标记词
    assert rows[0].trust == pytest.approx(0.75)
    assert rows[0].importance >= 0.55
    assert rows[0].source_task_id == t.id


def test_worker_loads_only_own_messages(monkeypatch):
    """worker 只读任务所属用户自己的 user 消息（§4 任务层隔离）：另一用户消息
    即使 id 落在区间内也不进入抽取上下文。"""
    from app.memory import service as ms
    from app.database import AnalyticsSession

    uid_a, uid_b = _new_user(), _new_user()
    session = AnalyticsSession()
    try:
        # B 的消息 id 比 A 的小（跨用户 id 交错时也不可读）
        _insert_agent_message(session, uid_b, "用户喜欢喝咖啡偏好蓝山咖啡")
        last_a = _insert_agent_message(session, uid_a, "用户喜欢喝茶偏好绿茶")
    finally:
        session.close()

    seen: list[list[str]] = []

    async def fake_chat(messages, **kwargs):
        seen.append(messages)
        return {
            "content": '{"memories":[]}',
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "model": "mock",
        }

    monkeypatch.setattr(ms, "chat", fake_chat)
    assert ms.enqueue_extraction(uid_a, last_a)["status"] == "queued"
    assert _run_worker_once() is True

    assert len(seen) == 1
    user_turn = seen[0][-1]["content"]
    assert "偏好绿茶" in user_turn          # 自己的消息在上下文里
    assert "偏好蓝山咖啡" not in user_turn  # 乙用户消息绝不进入


# ------------------------------------------------------------ 召回 ----
def test_recall_bm25_isolation_and_access_count():
    """BM25+时间衰减召回：命中的事实渲染进记忆块；跨用户隔离（甲查不到乙）；
    召回维护 access_count/last_recalled_at。"""
    from app.database import AnalyticsSession
    from app.memory.service import recall_memories

    uid_a, uid_b = _new_user(), _new_user()
    session = AnalyticsSession()
    try:
        m_a = _add_memory(session, uid_a, "用户喜欢喝茶偏好绿茶", importance=0.9)
        _add_memory(session, uid_b, "用户喜欢喝咖啡偏好蓝山咖啡", importance=0.9)
        _add_memory(session, uid_b, "用户目标是今年升职", importance=0.7)
    finally:
        session.close()

    # A 按 BM25 命中自己的绿茶记忆
    block_a = recall_memories(uid_a, query="偏好绿茶", mode="question")
    assert "【长期记忆" in block_a
    assert "用户喜欢喝茶偏好绿茶" in block_a
    assert "偏好，重要度 0.9" in block_a
    assert "蓝山咖啡" not in block_a        # 隔离：乙的记忆绝不混入

    # B 用同一查询词：零命中 → 降级 recency（K/2=3），仍只回自己的记忆
    block_b = recall_memories(uid_b, query="偏好绿茶", mode="question")
    assert "蓝山咖啡" in block_b or "今年升职" in block_b
    assert "用户喜欢喝茶偏好绿茶" not in block_b   # 隔离核心断言

    # 访问计数维护（§1.2）
    rows = _memory_rows(uid_a)
    assert rows[0].id == m_a
    assert rows[0].access_count == 1
    assert rows[0].last_recalled_at is not None


def test_recall_opening_recency_channel():
    """开场召回（无查询词）走 recency 通道（importance·fresh），注入自己的记忆。"""
    from app.database import AnalyticsSession
    from app.memory.service import recall_memories

    uid = _new_user()
    session = AnalyticsSession()
    try:
        _add_memory(session, uid, "用户最近在准备跳槽面试", importance=0.85)
    finally:
        session.close()

    block = recall_memories(uid, query="", k=None, mode="opening")
    assert "用户最近在准备跳槽面试" in block
    assert "目标" in block or "偏好" in block or "其他" in block  # 渲染含类型标签


def test_agent_off_skips_recall_and_extraction():
    """REQ-066⑦ agent_enabled=False：不召回、不抽取，但既有记忆数据保留。"""
    from app.database import AnalyticsSession
    from app.memory.service import enqueue_extraction, recall_memories

    uid = _new_user()
    session = AnalyticsSession()
    try:
        last = _insert_agent_message(session, uid, "用户喜欢喝茶偏好绿茶")
    finally:
        session.close()

    # 开关关闭后：入队被跳过（不产生任务）
    _set_agent_enabled(uid, False)
    assert enqueue_extraction(uid, last)["status"] == "disabled"
    assert _task_rows(uid) == []

    # 召回为空（不召回）
    assert recall_memories(uid, query="偏好绿茶") == ""

    # 数据保留：已存记忆依然可查
    session = AnalyticsSession()
    try:
        _add_memory(session, uid, "用户已留存的旧记忆", importance=0.8)
    finally:
        session.close()
    assert len(_memory_rows(uid)) == 1

    # worker 兜底：即使任务在开启时入队、处理时开关已关 → done 跳过，不落事实
    _set_agent_enabled(uid, True)
    session = AnalyticsSession()
    try:
        last2 = _insert_agent_message(session, uid, "用户喜欢喝咖啡")
    finally:
        session.close()
    assert enqueue_extraction(uid, last2)["status"] == "queued"
    _set_agent_enabled(uid, False)
    assert _run_worker_once() is True
    assert _task_rows(uid)[-1].status == "done"
    assert len(_memory_rows(uid)) == 1  # 仍是旧记忆，未新增


# ------------------------------------------------------------ 清理维护 ----
def test_cleanup_soft_delete_and_physical_purge():
    """§6.3：180 天未召回且 importance<0.5 → 软删；软删超 30 天 → 物理清除。"""
    from app.database import AnalyticsSession
    from app.memory.service import run_memory_cleanup

    uid = _new_user()
    old = datetime.utcnow() - timedelta(days=200)
    session = AnalyticsSession()
    try:
        # 低价值 + 长期未召回（200 天前最后召回）→ 应软删
        m1 = _add_memory(session, uid, "过期的低价值记忆", importance=0.3,
                         last_recalled_at=old)
        # 高价值但久未召回 → 不清理
        m2 = _add_memory(session, uid, "重要记忆不清理", importance=0.9,
                         last_recalled_at=old)
        # 已软删超 30 天 → 物理清除
        m3 = _add_memory(session, uid, "早该物理清除的", importance=0.6,
                         deleted_at=datetime.utcnow() - timedelta(days=40))
    finally:
        session.close()

    stats = run_memory_cleanup()
    assert stats["low_value_soft_deleted"] == 1
    assert stats["physical_deleted"] == 1

    active = _memory_rows(uid)
    assert [m.id for m in active] == [m2]           # 高价值保留、软删的已不可见
    soft_deleted = _memory_rows(uid, deleted=True)
    assert [m.id for m in soft_deleted] == [m1]     # m3 已物理删除，不再有行


def test_recover_pending_tasks_resets_to_pending():
    """§2.8 启动恢复：残留 pending/running → pending、next_retry_at=now。"""
    from app.database import AnalyticsSession
    from app.memory.service import recover_pending_tasks
    from app.models import AgentMemoryTask

    uid = _new_user()
    session = AnalyticsSession()
    try:
        session.add(AgentMemoryTask(user_id=uid, start_msg_id=0, end_msg_id=5,
                                    status="pending", attempts=1))
        session.add(AgentMemoryTask(user_id=uid, start_msg_id=5, end_msg_id=9,
                                    status="running", attempts=2))
        session.commit()
    finally:
        session.close()

    recover_pending_tasks()
    for t in _task_rows(uid):
        assert t.status == "pending"
        assert t.next_retry_at is not None and t.next_retry_at <= datetime.utcnow()


# ------------------------------------------------------------ API ----
@pytest.fixture()
def memory_client(memory_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表 + 启动记忆 worker）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def test_api_list_count_delete_and_clear(memory_client):
    """列表分页/数量/单删/一键清空 + 多用户隔离 + 越权 404 + 鉴权 400。"""
    from app.database import AnalyticsSession

    uid_a, uid_b = _new_user(), _new_user()
    session = AnalyticsSession()
    try:
        id_a1 = _add_memory(session, uid_a, "用户喜欢喝茶偏好绿茶")
        id_a2 = _add_memory(session, uid_a, "用户目标是今年升职", fact_type="goal")
        id_b1 = _add_memory(session, uid_b, "用户喜欢咖啡")
    finally:
        session.close()

    hdr_a, hdr_b = _auth_header(uid_a), _auth_header(uid_b)

    # 鉴权缺失 → 400
    resp = memory_client.get("/api/memory")
    assert resp.status_code == 400

    # A 只能看到自己的 2 条
    resp = memory_client.get("/api/memory", headers=hdr_a)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    contents = [m["content"] for m in body["data"]["memories"]]
    assert set(contents) == {"用户喜欢喝茶偏好绿茶", "用户目标是今年升职"}

    # count 隔离
    assert memory_client.get("/api/memory/count", headers=hdr_a).json()["data"]["count"] == 2
    assert memory_client.get("/api/memory/count", headers=hdr_b).json()["data"]["count"] == 1

    # A 删 B 的记忆 id → 404（(id, user_id) 双条件，防越权）
    resp = memory_client.delete(f"/api/memory/{id_b1}", headers=hdr_a)
    assert resp.status_code == 404
    assert memory_client.get("/api/memory/count", headers=hdr_b).json()["data"]["count"] == 1

    # A 删自己一条 → 成功且列表少一条
    resp = memory_client.delete(f"/api/memory/{id_a1}", headers=hdr_a)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["deleted"] is True
    assert memory_client.get("/api/memory/count", headers=hdr_a).json()["data"]["count"] == 1

    # 重复删已软删的 → 404
    resp = memory_client.delete(f"/api/memory/{id_a1}", headers=hdr_a)
    assert resp.status_code == 404

    # 删不存在的 id → 404
    resp = memory_client.delete("/api/memory/99999999", headers=hdr_a)
    assert resp.status_code == 404

    # 分页参数生效（limit 裁断）
    resp = memory_client.get("/api/memory?limit=1", headers=hdr_a)
    assert resp.status_code == 200
    assert len(resp.json()["data"]["memories"]) == 1

    # 一键清空 A → 0；B 不受影响
    resp = memory_client.delete("/api/memory", headers=hdr_a)
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] == 1
    assert memory_client.get("/api/memory/count", headers=hdr_a).json()["data"]["count"] == 0
    assert memory_client.get("/api/memory/count", headers=hdr_b).json()["data"]["count"] == 1
    assert len(memory_client.get("/api/memory", headers=hdr_a).json()["data"]["memories"]) == 0
