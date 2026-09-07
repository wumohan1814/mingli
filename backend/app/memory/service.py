# -*- coding: utf-8 -*-
"""AI 伙伴长期记忆服务层（REQ-077 · 方案书 docs/记忆方案书.md）。

职责（全部按方案书 §1–§6，用户开关与默认值按审批结论）：
  1. enqueue_extraction：对话回合结束后的 <1ms 入队（同用户 pending 合并、
     全库 pending 上限背压丢弃、agent_enabled 关闭跳过）；零 LLM、零阻塞。
  2. recall_memories：把当前用户记忆按「BM25 相关度 + 时间衰减」混合分召回，
     渲染为独立 system 记忆块文本，供 REQ-076 组装请求时注入（§5）。
  3. 抽取 worker：进程内单 asyncio 协程（不是进程/线程/daemon），认领
     agent_memory_tasks → 读本用户 agent_messages → LLM json_mode 抽取 →
     单事务落 agent_memories（FTS 触发器同步）→ done；失败指数退避重试
     ≤3 次后 dead（dead 前规则启发式兜底，保证零 LLM 成本下限，§2.5）。
  4. 数据维护：抽取前按 300 条/用户上限驱逐（§6.3.1）、180 天低价值软删 +
     软删超 30 天物理清除（§6.3.2/3，worker 空闲每 24h 一轮）。

与 REQ-076 的衔接（§7，本轮只留接口不实现对话）：
  - 每回合「落 agent_messages(user) → 生成回复 → 返回响应」之后，请求处理器内调用
        memory_service.enqueue_extraction(user_id, last_user_msg_id)
    last_user_msg_id = 本回合最后一条 user 消息在 agent_messages 里的 id；
    入队失败静默记日志，不影响对话主流程。
  - 组装发给模型的上下文时（含先生开场白）调用
        memory_service.recall_memories(user_id, query=最新用户消息文本,
                                       k=None, mode="question"|"opening")
    返回的文本段作为独立 system 消息紧跟角色 prompt 之后注入（§5.3）；
    任何异常/开关关闭都会静默返回 ""（记忆是增强不是依赖，§5.5）。

消息来源约定：worker 只读任务.user_id 自己的 agent_messages 中 role='user' 且
id ∈ (start_msg_id, end_msg_id] 的消息（原始 SQL，表由 REQ-076 建，最小列
id/user_id/role/content/created_at，方案书 §7.2）；agent_messages 未建时静默
按空区间处理（方案书「可独立开发联调，agent_messages 就绪后切正式读取」）。

计费（决策点 #3 默认）：抽取 LLM 调用走 app.llm.client.chat（其内部已打 llm_call
usage 埋点），**不向用户余额扣费**——本模块任何路径都不调用 credits.consume。
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
import time
from datetime import datetime, timedelta

from sqlalchemy import bindparam, func, text
from sqlalchemy.orm import Session

from app.database import AnalyticsSession
from app.events.service import record_event
from app.llm.client import LLMError, chat, get_usage
from app.models import AgentMemory, AgentMemoryTask, UserSetting

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# 推荐默认值（方案书决策点默认：300 条 / K 6·8 / 1200 tokens / 60s / 500 / 180 天）
# --------------------------------------------------------------------------- #
MAX_FACTS_PER_USER = 300          # §6.1 单用户活跃事实上限（超出按淘汰分驱逐）
MAX_PENDING_TASKS = 500           # §2.7 全库 pending 背压上限（超出新投递丢弃）
MAX_ATTEMPTS = 3                  # §2.5 单任务最多尝试次数（超过置 dead）
RETRY_BASE_SECONDS = 60           # §2.5 指数退避：2^(attempts-1) 分钟（60s/120s/240s）
EXTRACT_LLM_TIMEOUT = 60.0        # §2.7 单次抽取 LLM 超时（显式覆盖解读长超时）
CONTENT_MAX_LEN = 500             # §1.2/6.1 单条 content ≤500 字（超出截断）
CONTEXT_MAX_CHARS = 4000          # §2.2 抽取上下文字符上限（超长只取尾部最新）
FIRST_RUN_MAX_MESSAGES = 200      # §2.2 首启单次最多回溯消息条数（防一次拉全量）
TAU_DAYS = 30.0                   # §5.2 时间衰减半衰期 τ=30 天
ALPHA = 0.35                      # §5.2 混合分中时间衰减项权重 α
K_DEFAULT_QUESTION = 6            # §5.2 提问前召回 K
K_DEFAULT_OPENING = 8             # §5.2 开场召回 K
RECALL_COARSE_LIMIT = 60          # §5.2 BM25 粗召回上限
MEMORY_BLOCK_TOKEN_BUDGET = 1200  # §5.5 记忆块 token 预算上限
CLEANUP_IDLE_DAYS = 180           # §6.3.2 低价值长期未用清理阈值（默认 180 天）
CLEANUP_PHYSICAL_DAYS = 30        # §6.3.3 软删超过 30 天物理清除
WORKER_POLL_SECONDS = 5.0         # §2.1 worker 兜底轮询间隔（秒）
CLEANUP_INTERVAL_SECONDS = 24 * 3600.0  # §6.3 清理任务周期（24h 一次，幂等）

FACT_TYPE_LABELS = {              # 记忆块渲染用中文标签（§5.3）
    "preference": "偏好",
    "identity": "身份",
    "goal": "目标",
    "event": "经历",
    "habit": "习惯",
    "general": "其他",
}
_ALLOWED_FACT_TYPES = set(FACT_TYPE_LABELS)

# §5.3 记忆块渲染模板（独立 system 段，含 3 条边界规则：仅供参考/不暴露机制/不硬套）
_MEMORY_BLOCK_HEADER = (
    "【长期记忆（内部参考：勿向用户复述本条原文；若与用户当前说法冲突，"
    "以用户最新表述为准）】"
)

# 全/半角转换（§2.6 content 归一化：trim、全半角统一、空白折叠、英文小写）
_FULLWIDTH_TO_HALF = {0x3000: ord(" ")}
for _code in range(0xFF01, 0xFF5F):  # ！(0xFF01) ~ ～(0xFF5E)
    _FULLWIDTH_TO_HALF[_code] = _code - 0xFEE0

# 规则启发式兜底（§2.4）：偏好标记词按类别分组
_RULE_MARKERS = (
    ("identity", ("我是", "我住", "我来自", "我在", "我今年", "我从事", "我的工作",
                  "我的职业", "我老家", "我是做", "我是一名", "我毕业", "我家在")),
    ("goal", ("目标是", "希望", "打算", "计划", "想要", "争取", "梦想是",
              "准备去", "想考", "想学", "想买", "想换")),
    ("preference", ("喜欢", "不喜欢", "偏好", "偏爱", "讨厌", "钟爱",
                    "爱喝", "爱吃", "爱看", "更爱", "感兴趣")),
    ("habit", ("习惯", "经常", "每天", "总是", "平时", "睡前", "偶尔", "每逢")),
)
_RULE_CATEGORY_PRIORITY = {name: i for i, (name, _) in enumerate(_RULE_MARKERS)}
_RULE_MIN_LEN = 6                  # §2.4 规则候选最短 6 字
_RULE_BASE_IMPORTANCE = 0.55       # §2.4 按命中数 0.55~0.85
_RULE_MAX_IMPORTANCE = 0.85
_RULE_TRUST = 0.75                 # §2.4 规则抽取固定 trust

# 抽取 LLM 的 system 提示词（REQ-048 只管 agent/master.md；记忆抽取提示词不属于
# 后台可热改范围，按 §2.4 语义内嵌为常量，无外部文件依赖）
_EXTRACT_SYSTEM_PROMPT = (
    "你是「太初先生」的长期记忆抽取器。用户在与先生对话中透露了跨会话有用的稳定事实，"
    "请抽取出来供未来会话参考。\n"
    "只抽：稳定偏好（喜欢/不喜欢什么）、身份与背景、长期目标、生活习惯、关键经历。\n"
    "忽略：寒暄、客套、一次性闲聊、提问本身、数字排盘细节、涉及他人的信息。\n"
    "每一条用一句自然中文陈述事实本身（主语可用「用户」），不要提问、不要建议、"
    "不要复述原文对话。\n"
    "content 不超过 500 字；importance 为 0~1 的小数（对了解用户越重要越高）；"
    "fact_type 取 preference(偏好)|identity(身份背景)|goal(目标)|event(事件经历)|"
    "habit(习惯)；tags 给 2~5 个简短关键词。\n"
    "只输出 JSON：{\"memories\":[{\"content\":\"...\",\"fact_type\":\"...\","
    "\"importance\":0.8,\"tags\":[\"...\"]}]}"
)

# worker 唤醒事件：每次 worker 协程启动时在**自身事件循环内**重建（见
# memory_worker_loop），避免模块级 Event 绑定到已关闭/其它事件循环（测试多
# TestClient 各自成环）。enqueue 置位后 worker 立即认领，不等 5s 兜底轮询。
_wake: asyncio.Event | None = None


def _wake_worker() -> None:
    """置位唤醒事件。可能被任意线程/无事件循环上下文调用，静默容错。"""
    ev = _wake
    if ev is not None:
        try:
            ev.set()
        except RuntimeError:
            pass


# --------------------------------------------------------------------------- #
# 规范化 / 哈希 / 开关
# --------------------------------------------------------------------------- #
def normalize_content(text: str) -> str:
    """§2.6 content 归一化：trim → 全半角统一 → 空白折叠 → 英文小写。"""
    if text is None:
        return ""
    s = str(text).strip().translate(_FULLWIDTH_TO_HALF)
    return " ".join(s.split()).lower()


def content_hash_of(text: str) -> str:
    """去重键：归一化文本的 sha1（40 hex，对齐 CHAR(40)）。"""
    return hashlib.sha1(normalize_content(text).encode("utf-8")).hexdigest()


def _agent_enabled(session: Session, user_id: int) -> bool:
    """REQ-066⑦ agent_enabled 总开关：关 = 不召回、不抽取，但保留既有记忆数据。

    无设置行按默认开（列默认 True，与 GET /api/settings 默认口径一致）。
    """
    row = session.query(UserSetting).filter_by(user_id=user_id).first()
    return True if row is None else bool(row.agent_enabled)


def _now() -> datetime:
    return datetime.utcnow()


# --------------------------------------------------------------------------- #
# §7.2 衔接点①：入队（对话接口返回响应后调用，<1ms，零 LLM）
# --------------------------------------------------------------------------- #
def enqueue_extraction(user_id: int, last_user_msg_id: int,
                       *, db: Session | None = None) -> dict:
    """REQ-076 每完成 1 回合、返回响应之后投递抽取任务（方案书 §7.2 衔接点）。

    Args:
        user_id: 鉴权得到的当前用户（服务端固定赋值，不接受客户端传入）。
        last_user_msg_id: 本回合最后一条 user 消息在 agent_messages 中的 id
            （该表由 REQ-076 建；本函数只落区间，不读消息内容，恒 <1ms）。
        db: 可选，复用调用方 session（便于并入更大事务）；缺省自开自关。

    Returns:
        {"status": "queued"|"merged"|"noop"|"dropped"|"disabled", "taskId": int|None}
        - queued：新建任务（start=上次已抽最新 end，end=last_user_msg_id）
        - merged：同用户已有 pending/running → 仅前滚 end_msg_id（§2.2 合并）
        - noop  ：无新区间内容（last <= 已有 end / 上次游标）
        - dropped：全库 pending ≥ MAX_PENDING_TASKS 背压丢弃（§2.7，埋点）
        - disabled：agent_enabled 关闭跳过抽取（数据保留，§6.4）

    失败（库不可用等）静默记日志并返回 disabled 以外的异常兜底：
    任何情况下都不抛异常给对话接口（§7.2：入队失败不影响对话）。
    """
    owns_session = db is None
    session = db if db is not None else AnalyticsSession()
    try:
        if not _agent_enabled(session, user_id):
            return {"status": "disabled", "taskId": None}
        last = int(last_user_msg_id or 0)
        if last <= 0:
            return {"status": "noop", "taskId": None}
        now = _now()

        # §2.7 背压：全库 pending 数达上限 → 丢弃并埋点（单用户恒 1 条由合并保证）
        pending_total = (
            session.query(func.count(AgentMemoryTask.id))
            .filter(AgentMemoryTask.status == "pending")
            .scalar()
            or 0
        )
        if pending_total >= MAX_PENDING_TASKS:
            record_event("agent_memory_extract", user_id=user_id, props={
                "status": "dropped", "reason": "pending_queue_over_cap",
                "pending": pending_total, "end_msg_id": last,
            })
            return {"status": "dropped", "taskId": None}

        # §2.2 同用户 pending 合并：已有 pending/running → 只前滚 end_msg_id
        existing = (
            session.query(AgentMemoryTask)
            .filter_by(user_id=user_id)
            .filter(AgentMemoryTask.status.in_(["pending", "running"]))
            .order_by(AgentMemoryTask.id.desc())
            .first()
        )
        if existing is not None:
            if (existing.end_msg_id or 0) >= last:
                return {"status": "noop", "taskId": existing.id}
            existing.end_msg_id = last
            existing.updated_at = now
            session.commit()
            _wake_worker()
            return {"status": "merged", "taskId": existing.id}

        # §2.6 游标层：新任务起点 = 该用户上一个终态任务已抽到的最新消息 id
        prev_end = (
            session.query(func.max(AgentMemoryTask.end_msg_id))
            .filter_by(user_id=user_id)
            .filter(AgentMemoryTask.status.in_(["done", "dead"]))
            .scalar()
        )
        start = int(prev_end or 0)
        if last <= start:
            return {"status": "noop", "taskId": None}

        task = AgentMemoryTask(
            user_id=user_id,
            start_msg_id=start,
            end_msg_id=last,
            status="pending",
            attempts=0,
            created_at=now,
            updated_at=now,
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        _wake_worker()
        return {"status": "queued", "taskId": task.id}
    except Exception as exc:
        # §7.2：入队失败只记日志，绝不影响对话主流程
        logger.warning("记忆抽取入队失败 user_id=%s last_msg_id=%s error=%s",
                       user_id, last_user_msg_id, exc)
        return {"status": "error", "taskId": None}
    finally:
        if owns_session:
            session.close()


# --------------------------------------------------------------------------- #
# §5 召回：BM25 相关度 + 时间衰减混合分 → 渲染 system 记忆块
# --------------------------------------------------------------------------- #
def _age_days(row_ts, now: datetime) -> float:
    if row_ts is None:
        return 99999.0
    try:
        return max(0.0, (now - row_ts).total_seconds() / 86400.0)
    except TypeError:
        return 99999.0


def _freshness(row_ts, now: datetime) -> float:
    """fresh = exp(-age_days / τ)，τ=30 天（约 30 天新鲜度折半，§5.2）。"""
    return math.exp(-_age_days(row_ts, now) / TAU_DAYS)


def _fts_quote(query: str) -> str:
    """FTS5 MATCH 短语：整体加双引号、内部双引号翻倍（trigram 需短语查询）。"""
    return '"' + query.replace('"', '""') + '"'


def _bm25_candidates(session: Session, user_id: int, query: str, now: datetime) -> list[dict]:
    """BM25 粗召回（§4 SQL 形态）：FTS 命中行 join 回事实表，强制 m.user_id 过滤。

    rel = 1/(1+|bm25|) 的归一在 Python 侧与时间衰减混合（§5.2），SQL 只粗召回 60 条。
    """
    rows = session.execute(
        text(
            "SELECT m.id, m.content, m.fact_type, m.importance, m.updated_at, "
            "       bm25(agent_memories_fts) AS bm "
            "FROM agent_memories_fts "
            "JOIN agent_memories m ON m.id = agent_memories_fts.rowid "
            "WHERE agent_memories_fts MATCH :q "
            "  AND m.user_id = :uid AND m.deleted_at IS NULL "
            "ORDER BY bm LIMIT :limit"
        ),
        {"q": _fts_quote(query), "uid": user_id, "limit": RECALL_COARSE_LIMIT},
    ).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": r.id, "content": r.content, "fact_type": r.fact_type,
            "importance": float(r.importance or 0.5), "updated_at": r.updated_at,
            "rel": 1.0 / (1.0 + abs(float(r.bm or 0.0))),
        })
    return out


def _recency_candidates(session: Session, user_id: int) -> list[dict]:
    """recency 通道候选：本用户全部活跃事实（单用户 ≤300 条，Python 侧打分）。"""
    rows = (
        session.query(AgentMemory)
        .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
        .all()
    )
    return [{
        "id": m.id, "content": m.content, "fact_type": m.fact_type,
        "importance": float(m.importance or 0.5), "updated_at": m.updated_at,
    } for m in rows]


def recall_memories(user_id: int, query: str = "", k: int | None = None,
                    mode: str = "question", *, db: Session | None = None) -> str:
    """REQ-076 组装请求上下文时召回记忆，返回可注入的 system 记忆块文本（§5）。

    Args:
        user_id: 鉴权得到的当前用户（服务端固定赋值）。
        query: 最新用户消息文本（mode="question" 时作 BM25 查询词；开场无查询词）。
        k: 返回条数上限；None → question 6 / opening 8（方案书决策点默认）。
        mode: "question"（每轮提问前，核心通道）| "opening"（开场白，recency 通道）。
        db: 可选复用 session。

    Returns:
        渲染好的记忆块文本段（含 §5.3 头注与边界规则说明）；无可用记忆 /
        agent_enabled 关闭 / 任何异常 → ""（静默降级不注入，记忆是增强不是依赖）。

    召回同时维护 access_count / last_recalled_at（§1.2，清理与新鲜度用）。
    """
    owns_session = db is None
    session = db if db is not None else AnalyticsSession()
    try:
        if not _agent_enabled(session, user_id):
            return ""
        if k is None:
            k = K_DEFAULT_OPENING if mode == "opening" else K_DEFAULT_QUESTION
        k = max(1, int(k))
        now = _now()
        t0 = time.monotonic()

        # 查询词有效性：≥3 个有效字符才走 BM25（trigram 对 <3 字查询返回空集）
        eff_query = "".join(query.split()) if query else ""
        use_bm25 = mode != "opening" and len(eff_query) >= 3

        channel = "recency"
        candidates: list[dict] = []
        if use_bm25:
            channel = "bm25"
            try:
                candidates = _bm25_candidates(session, user_id, eff_query, now)
            except Exception as exc:  # FTS 不可用等 → 静默降级 recency（§5.5）
                logger.warning("记忆 BM25 召回失败，降级 recency user_id=%s error=%s",
                               user_id, exc)
                channel = "recency"
                candidates = []
            if channel == "bm25" and not candidates:
                # BM25 零命中 → 降级 recency 通道取 K/2（§5.2 兜底，避免空召回）
                channel = "recency"
                k = max(1, k // 2)

        if channel == "bm25":
            # 混合分：score = rel + α·importance·fresh（§5.2）
            for c in candidates:
                c["score"] = c["rel"] + ALPHA * c["importance"] * _freshness(c["updated_at"], now)
        else:
            candidates = _recency_candidates(session, user_id)
            for c in candidates:
                c["score"] = c["importance"] * _freshness(c["updated_at"], now)

        ranked = sorted(candidates, key=lambda c: c["score"], reverse=True)

        # §5.5 token 预算自裁：按混合分从高到低装填，超预算即停
        items: list[dict] = []
        budget_left = MEMORY_BLOCK_TOKEN_BUDGET
        for c in ranked:
            if len(items) >= k:
                break
            rendered = _render_memory_line(c)
            cost = max(1, math.ceil(len(rendered) / 1.0))  # 中文约 1 token/字 的粗估
            if items and budget_left < cost:
                break
            items.append(c)
            budget_left -= cost

        if items:
            # 维护召回计数/最近召回时间（仅注入的记忆）
            ids = [c["id"] for c in items]
            session.execute(
                text(
                    "UPDATE agent_memories SET access_count = access_count + 1, "
                    "last_recalled_at = :now WHERE deleted_at IS NULL AND id IN :ids"
                ).bindparams(bindparam("ids", expanding=True)),
                {"now": now, "ids": ids},
            )
            session.commit()

        block = _render_memory_block(items)
        record_event("agent_memory_recall", user_id=user_id, props={
            "mode": mode, "channel": channel, "k": len(items),
            "hits": len(candidates),
            "elapsed_ms": round((time.monotonic() - t0) * 1000, 1),
        })
        return block
    except Exception:
        # §5.5 召回/渲染任何异常 → 静默降级为不注入（先生正常应答）
        logger.exception("记忆召回异常（静默降级为空） user_id=%s", user_id)
        return ""
    finally:
        if owns_session:
            session.close()


def _render_memory_line(c: dict) -> str:
    label = FACT_TYPE_LABELS.get(c.get("fact_type"), "其他")
    return f"- {c['content']}（{label}，重要度 {c['importance']:.1f}）"


def _render_memory_block(items: list[dict]) -> str:
    if not items:
        return ""
    lines = [_MEMORY_BLOCK_HEADER] + [_render_memory_line(c) for c in items]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# §2.4 抽取执行：LLM json_mode 优先 + 规则启发式兜底
# --------------------------------------------------------------------------- #
def _clean_fact(raw) -> dict | None:
    """抽取结果单条规范化：类型白名单（非法落 general）、0~1 截断、500 字截断。

    Returns None 表示不可用（空内容/非 dict 且非 str）。
    """
    if isinstance(raw, str):
        content_raw = raw
    elif isinstance(raw, dict):
        content_raw = raw.get("content") or raw.get("text")
    else:
        return None
    if content_raw is None:
        return None
    content = str(content_raw).strip()
    if not content or len(content) < 2:
        return None
    if len(content) > CONTENT_MAX_LEN:
        content = content[:CONTENT_MAX_LEN]

    def _clamp(v, default, lo=0.0, hi=1.0) -> float:
        try:
            f = float(v)
        except (TypeError, ValueError):
            f = default
        return max(lo, min(hi, f))

    ftype = str(raw.get("fact_type") if isinstance(raw, dict) else "").strip().lower()
    if ftype not in _ALLOWED_FACT_TYPES:
        ftype = "general"

    tags = raw.get("tags") if isinstance(raw, dict) else None
    tags_clean: list[str] = []
    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, str) and t.strip():
                tags_clean.append(t.strip()[:20])
    tags_json = json.dumps(tags_clean[:10], ensure_ascii=False) if tags_clean else None

    return {
        "content": content,
        "fact_type": ftype,
        "importance": _clamp(raw.get("importance", 0.5) if isinstance(raw, dict) else 0.5, 0.5),
        "trust": _clamp(raw.get("trust", 0.7) if isinstance(raw, dict) else 0.7, 0.7),
        "tags_json": tags_json,
        "content_hash": content_hash_of(content),
    }


def _parse_llm_json(content: str) -> object:
    """解析抽取 LLM 的 JSON 输出（容忍 ```json 代码围栏与前导文字）。"""
    text_ = (content or "").strip()
    try:
        return json.loads(text_)
    except ValueError:
        pass
    # 取第一个 { 到最后一个 } 的片段再试
    start, end = text_.find("{"), text_.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text_[start:end + 1])
        except ValueError:
            pass
    raise ValueError(f"抽取 LLM 输出不是合法 JSON: {text_[:120]!r}...")


def _build_extract_messages(user_id: int, texts: list[str]) -> list[dict]:
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    return [
        {"role": "system", "content": _EXTRACT_SYSTEM_PROMPT},
        {"role": "user", "content": f"以下是用户最近说过的话（仅用户消息）：\n\n{numbered}"},
    ]


async def _llm_extract_facts(user_id: int, texts: list[str]) -> dict:
    """调用外部 LLM（json_mode）抽取结构化事实。

    超时显式 60s；不向用户扣费（决策点 #3 默认：抽取为后台成本），usage 由
    app.llm.client.chat 内部照常打 llm_call 埋点 + 记入进程内 usage 账本。
    返回 {"facts": list, "usage": {"prompt_tokens","completion_tokens","total_tokens"}}。
    """
    usage_before = get_usage()
    resp = await chat(
        _build_extract_messages(user_id, texts),
        json_mode=True,
        timeout=EXTRACT_LLM_TIMEOUT,
    )
    usage_after = get_usage()
    usage_delta = {
        key: max(0, int(usage_after.get(key, 0) or 0) - int(usage_before.get(key, 0) or 0))
        for key in ("prompt_tokens", "completion_tokens", "total_tokens")
    }
    parsed = _parse_llm_json(resp["content"])
    if isinstance(parsed, dict):
        memories = parsed.get("memories")
    elif isinstance(parsed, list):
        memories = parsed
    else:
        memories = None
    if not isinstance(memories, list):
        raise ValueError(f"抽取 LLM 输出缺少 memories 数组: {str(parsed)[:120]!r}...")
    return {"facts": memories, "usage": usage_delta}


def _split_sentences(text: str) -> list[str]:
    """§2.4 规则兜底断句：中英文句读切分，逐句独立判候选。"""
    parts = re.split(r"[。！？!?；;\n]+", text or "")
    return [p.strip() for p in parts if p.strip()]


def _extract_heuristically(texts: list[str]) -> list[dict]:
    """规则启发式兜底（§2.4）：取 user 消息按句读断句 → 过滤寒暄 →
    长度 ≥6 字且命中偏好标记词才入候选；importance 0.55~0.85、trust=0.75。

    保证 LLM 抖动期记忆能力不静默丢失、且零额外成本；无命中返回 []。
    """
    candidates: list[dict] = []
    seen: set[str] = set()
    for text in texts or []:
        for sentence in _split_sentences(text):
            if len(sentence) < _RULE_MIN_LEN:
                continue
            matched: dict[str, int] = {}
            for category, markers in _RULE_MARKERS:
                count = sum(1 for m in markers if m in sentence)
                if count:
                    matched[category] = count
            if not matched:
                continue
            total_hits = sum(matched.values())
            category = max(
                matched,
                key=lambda c: (matched[c], -_RULE_CATEGORY_PRIORITY[c]),
            )
            importance = min(
                _RULE_MAX_IMPORTANCE,
                _RULE_BASE_IMPORTANCE + 0.1 * (total_hits - 1),
            )
            fact = {
                "content": sentence[:CONTENT_MAX_LEN],
                "fact_type": category,
                "importance": round(importance, 2),
                "trust": _RULE_TRUST,
                "tags": [],
            }
            h = content_hash_of(fact["content"])
            if h not in seen:
                seen.add(h)
                candidates.append(fact)
    return candidates


# --------------------------------------------------------------------------- #
# 持久化：去重刷新 / 上限驱逐 / 软删（FTS 同步）
# --------------------------------------------------------------------------- #
def _soft_delete_memory_ids(session: Session, ids: list[int], now: datetime) -> int:
    """软删（deleted_at）+ 同步摘除 FTS 镜像行。

    §1.3 触发器只同步 INSERT/DELETE/OF content UPDATE；软删是 UPDATE deleted_at，
    不会触发 FTS 触发器，故这里显式 DELETE 对应 FTS 行（方案书 §6.3.1「软删 → FTS
    由触发器同步摘除」的服务层落实）。
    """
    if not ids:
        return 0
    result = session.execute(
        text(
            "UPDATE agent_memories SET deleted_at = :now "
            "WHERE deleted_at IS NULL AND id IN :ids"
        ).bindparams(bindparam("ids", expanding=True)),
        {"now": now, "ids": ids},
    )
    session.execute(
        text("DELETE FROM agent_memories_fts WHERE rowid IN :ids").bindparams(
            bindparam("ids", expanding=True)
        ),
        {"ids": ids},
    )
    return result.rowcount or 0


def _evict_lowest(session: Session, user_id: int, now: datetime) -> int:
    """§6.3.1 淘汰驱逐：软删该用户淘汰分最低的 1 条活跃事实。

    score = 0.6·importance + 0.4·log1p(access_count) − 0.5·age_days/90。
    """
    rows = (
        session.query(AgentMemory)
        .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
        .all()
    )
    if not rows:
        return 0

    def _score(m: AgentMemory) -> float:
        imp = float(m.importance or 0.0)
        acc = float(m.access_count or 0)
        age = _age_days(m.updated_at, now)
        return 0.6 * imp + 0.4 * math.log1p(acc) - 0.5 * age / 90.0

    victim = min(rows, key=_score)
    return _soft_delete_memory_ids(session, [victim.id], now)


def _persist_facts(session: Session, user_id: int, task_id: int | None,
                   source_msg_id: int | None, facts: list) -> dict:
    """单事务批量落库（§2.3④/§2.6 事实层幂等）：去重刷新 vs 新增 + 上限驱逐。

    返回 {"inserted", "refreshed", "blocked_deleted", "evicted"} 供埋点。
    """
    stats = {"inserted": 0, "refreshed": 0, "blocked_deleted": 0, "evicted": 0}
    now = _now()
    active_total = (
        session.query(func.count(AgentMemory.id))
        .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
        .scalar()
        or 0
    )
    for raw in facts:
        fact = _clean_fact(raw)
        if fact is None:
            continue
        h = fact["content_hash"]
        existing = (
            session.query(AgentMemory)
            .filter_by(user_id=user_id, content_hash=h)
            .first()
        )
        if existing is not None:
            if existing.deleted_at is None:
                # §6.2 去重刷新：importance 取 max、updated_at 前移（不触发 FTS 触发器）
                if fact["importance"] > (existing.importance or 0.0):
                    existing.importance = fact["importance"]
                if fact["trust"] != (existing.trust or 0.0):
                    existing.trust = fact["trust"]
                existing.updated_at = now
                stats["refreshed"] += 1
            else:
                # §6.3「已被用户手动删除的不复活」：软删行占位 hash，等物理清除后可再插
                stats["blocked_deleted"] += 1
            continue
        if active_total + stats["inserted"] - stats["evicted"] >= MAX_FACTS_PER_USER:
            stats["evicted"] += _evict_lowest(session, user_id, now)
        session.add(AgentMemory(
            user_id=user_id,
            content=fact["content"],
            fact_type=fact["fact_type"],
            importance=fact["importance"],
            trust=fact["trust"],
            content_hash=h,
            source_type="agent_chat",
            source_msg_id=source_msg_id,
            source_task_id=task_id,
            tags_json=fact["tags_json"],
            access_count=0,
            created_at=now,
            updated_at=now,
        ))
        stats["inserted"] += 1
    return stats


# --------------------------------------------------------------------------- #
# 消息读取（只读本用户 agent_messages 的 user 消息区间）
# --------------------------------------------------------------------------- #
def _load_user_messages(session: Session, user_id: int,
                        start_id: int, end_id: int) -> list[str]:
    """读 (start_id, end_id] 内该用户自己的 role='user' 消息正文（按 id 升序）。

    - 恒带 user_id 过滤（§4 任务层隔离），不读其它用户消息；
    - agent_messages 表由 REQ-076 建（本模块不建，最小列 id/user_id/role/content）；
      表缺失（REQ-076 未交付的联调期）→ 静默返回 []，按空区间处理；
    - §2.2：首启最多回溯最近 200 条；上下文字符上限 4000，超长只取尾部最新。
    """
    try:
        rows = session.execute(
            text(
                "SELECT id, content FROM agent_messages "
                "WHERE user_id = :uid AND role = 'user' "
                "  AND id > :start AND id <= :end "
                "ORDER BY id ASC"
            ),
            {"uid": user_id, "start": start_id, "end": end_id},
        ).fetchall()
    except Exception as exc:
        if "no such table" in str(exc):
            logger.info("agent_messages 表未建（REQ-076 未交付），按空区间处理 user_id=%s", user_id)
        else:
            logger.warning("读取 agent_messages 失败 user_id=%s error=%s", user_id, exc)
        return []
    if len(rows) > FIRST_RUN_MAX_MESSAGES:      # 首启大回溯：只取最近 200 条
        rows = rows[-FIRST_RUN_MAX_MESSAGES:]
    texts: list[str] = []
    total = 0
    for r in reversed(rows):                    # 从最新往回装，超 4000 字截断
        content = (r.content or "").strip()
        if not content:
            continue
        total += len(content)
        if total > CONTEXT_MAX_CHARS:
            break
        texts.append(content)
    texts.reverse()
    return texts


# --------------------------------------------------------------------------- #
# 任务执行 / worker
# --------------------------------------------------------------------------- #
def _retry_delay_seconds(attempts: int) -> float:
    """§2.5 指数退避：attempts 次失败后等 2^(attempts-1) 分钟（60s/120s/240s）。"""
    return float(RETRY_BASE_SECONDS * (2 ** max(0, attempts - 1)))


def _finish_task(session: Session, task_id: int, *, status: str,
                 last_error: str | None = None) -> None:
    task = session.get(AgentMemoryTask, task_id)
    if task is None:
        return
    task.status = status
    task.updated_at = _now()
    if last_error is not None:
        task.last_error = last_error[:200]      # §2.5 截断 200 字符落库
    if status == "done":
        task.next_retry_at = None


def _record_extract_event(user_id: int, *, status: str, channel: str,
                          stats: dict, task_id: int | None = None,
                          error: str = "", usage: dict | None = None,
                          elapsed_ms: float = 0.0) -> None:
    props: dict = {
        "status": status, "channel": channel, "taskId": task_id,
        "elapsed_ms": round(elapsed_ms, 1),
    }
    if stats:
        props.update(stats)
    if error:
        props["error"] = error[:200]
    if usage:
        props["usageTokens"] = usage.get("total_tokens", 0)
    record_event("agent_memory_extract", user_id=user_id, props=props)


async def _run_task(task_id: int, user_id: int, start_id: int, end_id: int) -> None:
    """执行一个已认领（running）的任务：LLM 抽取 / 失败重试退避 / dead 前规则兜底。

    所有事实写入 + 任务终态在**同一事务**提交（§2.6 游标层幂等：commit 前崩溃 →
    任务仍 pending 重跑；commit 后 → 已 done 不重跑）。
    """
    session = AnalyticsSession()
    try:
        task = session.get(AgentMemoryTask, task_id)
        if task is None:
            return
        t0 = time.monotonic()
        # REQ-066⑦ 开关：关 = 不抽取（数据保留）——worker 认领时兜底再查一次
        if not _agent_enabled(session, user_id):
            _finish_task(session, task_id, status="done",
                         last_error="agent_enabled=off，跳过抽取")
            session.commit()
            return

        texts = _load_user_messages(session, user_id, start_id, end_id)
        if not texts:
            _finish_task(session, task_id, status="done",
                         last_error="区间内无 user 消息")
            session.commit()
            return

        llm_ok = False
        usage: dict | None = None
        llm_facts: list = []
        error: Exception | None = None
        retriable = False
        try:
            result = await _llm_extract_facts(user_id, texts)
            llm_facts = result["facts"]
            usage = result["usage"]
            llm_ok = True
        except LLMError as exc:                 # 网络/超时/429/5xx（retriable 由 client 分类）
            error = exc
            retriable = bool(exc.retriable)
        except Exception as exc:                # JSON 解析失败 / schema 异常等
            error = exc
            retriable = False

        if llm_ok:
            stats = _persist_facts(session, user_id, task_id, end_id, llm_facts)
            _finish_task(session, task_id, status="done")
            session.commit()
            _record_extract_event(user_id, status="done", channel="llm",
                                  stats=stats, task_id=task_id, usage=usage,
                                  elapsed_ms=time.monotonic() - t0)
            logger.info("记忆抽取完成 task=%s user_id=%s facts=%s",
                        task_id, user_id, stats)
            return

        # --- 失败分支（§2.5）---
        task.attempts = (task.attempts or 0) + 1
        err_text = str(error) if error else "unknown"
        if retriable and task.attempts < MAX_ATTEMPTS:
            # 可重试：attempts+1 置回 pending + 指数退避，worker 按 due 时间认领
            task.status = "pending"
            task.next_retry_at = _now() + timedelta(
                seconds=_retry_delay_seconds(task.attempts))
            task.last_error = err_text[:200]
            task.updated_at = _now()
            session.commit()
            _record_extract_event(user_id, status="retry_pending", channel="llm",
                                  stats={}, task_id=task_id, error=err_text,
                                  elapsed_ms=time.monotonic() - t0)
            logger.warning("记忆抽取可重试失败 task=%s user_id=%s attempts=%s error=%s",
                           task_id, user_id, task.attempts, err_text)
            return

        # dead 前规则兜底抽取（§2.5：LLM 不可用/解析失败/attempts≥3 均保证
        # 该回合至少以规则方式入记忆，零额外成本）
        rule_facts = _extract_heuristically(texts)
        stats = _persist_facts(session, user_id, task_id, end_id, rule_facts)
        _finish_task(session, task_id, status="dead", last_error=err_text)
        session.commit()
        _record_extract_event(user_id, status="dead", channel="rule",
                              stats=stats, task_id=task_id, error=err_text,
                              elapsed_ms=time.monotonic() - t0)
        logger.warning("记忆抽取任务 dead task=%s user_id=%s attempts=%s rule_facts=%s error=%s",
                       task_id, user_id, task.attempts, len(rule_facts), err_text)
    except Exception:
        # worker 兜底：任何未预期异常不得外泄影响进程/事件循环（§3.4）
        logger.exception("记忆抽取任务异常（任务保持 running，重启恢复） task=%s", task_id)
    finally:
        session.close()


async def process_due_task_once() -> bool:
    """认领并执行一个到期任务（全局单 worker 语义，先到先得）。

    原子认领（UPDATE…RETURNING，SQLite 3.35+）：同一时刻只会有一个任务被置
    running（§2.3①）。返回 True=处理了一个任务，False=当前无到期任务。
    """
    session = AnalyticsSession()
    task_id: int | None = None
    user_id = start_id = end_id = 0
    try:
        now = _now()
        row = session.execute(
            text(
                "UPDATE agent_memory_tasks "
                "SET status = 'running', updated_at = :now "
                "WHERE id = ("
                "  SELECT id FROM agent_memory_tasks "
                "  WHERE status = 'pending' "
                "    AND (next_retry_at IS NULL OR next_retry_at <= :now) "
                "  ORDER BY id LIMIT 1"
                ") "
                "RETURNING id, user_id, start_msg_id, end_msg_id"
            ),
            {"now": now},
        ).fetchone()
        session.commit()
        if row is None:
            return False
        task_id, user_id, start_id, end_id = (
            int(row[0]), int(row[1]), int(row[2] or 0), int(row[3] or 0))
    finally:
        session.close()
    await _run_task(task_id, user_id, start_id, end_id)
    return True


async def memory_worker_loop() -> None:
    """进程内记忆抽取 worker 协程（方案书 §2.1：不是进程/线程/daemon）。

    - 由 main.py lifespan `asyncio.create_task` 启动，随 FastAPI 启停；
    - 全局串行单 worker（同时最多 1 个抽取 LLM 调用）；
    - 有到期任务就连续处理（快速排空），空闲时等唤醒事件 / 5s 兜底轮询；
    - 每空闲 24h 跑一轮清理维护（§6.3，幂等）。
    """
    global _wake
    # 唤醒事件须绑定本 worker 所在事件循环（单个进程内同一时刻只有一个 worker，
    # 直接重建即可；跨 TestClient/重启各自成环也不会串）
    _wake = asyncio.Event()
    logger.info("记忆抽取 worker 启动（进程内单 worker，5s 兜底轮询）")
    last_cleanup = time.monotonic()
    try:
        while True:
            ran = False
            try:
                ran = await process_due_task_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("记忆抽取 worker 单轮处理异常（继续下一轮）")
            if ran:
                continue  # 有活就连续干，不空等
            if time.monotonic() - last_cleanup >= CLEANUP_INTERVAL_SECONDS:
                try:
                    run_memory_cleanup()
                except Exception:
                    logger.exception("记忆清理维护异常")
                last_cleanup = time.monotonic()
            ev = _wake
            try:
                await asyncio.wait_for(ev.wait(), timeout=WORKER_POLL_SECONDS)
            except asyncio.TimeoutError:
                pass
            else:
                ev.clear()
    finally:
        _wake = None


# --------------------------------------------------------------------------- #
# 启动恢复 / 数据维护
# --------------------------------------------------------------------------- #
def recover_pending_tasks() -> None:
    """§2.8 启动孤儿恢复：残留 pending/running → pending、next_retry_at=now。

    与 _recover_orphan_jobs() 对齐（置可重试而非直接 failed：记忆抽取无用户可见
    成本，值得补跑）。失败只记 warning，不阻断应用启动。
    """
    session = AnalyticsSession()
    try:
        stale = (
            session.query(AgentMemoryTask)
            .filter(AgentMemoryTask.status.in_(["pending", "running"]))
            .all()
        )
        now = _now()
        for t in stale:
            t.status = "pending"
            t.next_retry_at = now
            t.updated_at = now
        session.commit()
        if stale:
            logger.info("孤儿记忆抽取任务恢复：%s 个已重置为 pending", len(stale))
    except Exception:
        logger.warning("孤儿记忆抽取任务恢复失败（不阻断应用启动）", exc_info=True)
    finally:
        session.close()


def run_memory_cleanup() -> dict:
    """§6.3 数据清理维护（幂等，24h 一轮 / 亦可手动调用）。

    1. §6.3.2 低价值长期未用软删：deleted_at IS NULL AND
       last_recalled_at < now-180天 AND importance < 0.5（默认 180 天）；
    2. §6.3.3 软删超过 30 天的事实物理 DELETE（触发器同步摘 FTS 行）；
       有物理清除时执行 PRAGMA wal_checkpoint(TRUNCATE)（§3.3 防 WAL 膨胀）。
    返回 {"low_value_soft_deleted", "physical_deleted", "wal_checkpoint"}。
    """
    session = AnalyticsSession()
    stats = {"low_value_soft_deleted": 0, "physical_deleted": 0, "wal_checkpoint": False}
    try:
        now = _now()
        # 1) 低价值 / 长期未召回软删（last_recalled_at IS NULL 不在此清，留给上限驱逐）
        idle_cutoff = now - timedelta(days=CLEANUP_IDLE_DAYS)
        low_rows = (
            session.query(AgentMemory)
            .filter(
                AgentMemory.deleted_at.is_(None),
                AgentMemory.importance < 0.5,
                AgentMemory.last_recalled_at < idle_cutoff,
            )
            .all()
        )
        if low_rows:
            stats["low_value_soft_deleted"] = _soft_delete_memory_ids(
                session, [m.id for m in low_rows], now)

        # 2) 软删超 30 天物理清除（回收空间；ad 触发器逐行摘除 FTS 行）
        purge_cutoff = now - timedelta(days=CLEANUP_PHYSICAL_DAYS)
        stale_ids = [
            m.id for m in (
                session.query(AgentMemory)
                .filter(
                    AgentMemory.deleted_at.isnot(None),
                    AgentMemory.deleted_at < purge_cutoff,
                )
                .all()
            )
        ]
        if stale_ids:
            session.query(AgentMemory).filter(
                AgentMemory.id.in_(stale_ids)
            ).delete(synchronize_session=False)
            stats["physical_deleted"] = len(stale_ids)

        session.commit()
        # 3) WAL 回收（仅在发生物理清除时执行，幂等）
        if stats["physical_deleted"]:
            with session.bind.connect() as conn:
                conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
            stats["wal_checkpoint"] = True
        if any(stats.values()):
            record_event("agent_memory_cleanup", props=dict(stats))
        return stats
    except Exception:
        session.rollback()
        logger.exception("记忆清理维护失败")
        return stats
    finally:
        session.close()
