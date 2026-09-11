# -*- coding: utf-8 -*-
"""离线记忆基准 · 播种层：把 `corpus.json` 直接灌进**临时 SQLite**。

**绕过抽取链路**（本基准测的是"召回"，不是"抽取"）：
不调用 `enqueue_extraction` / 抽取 worker / LLM，直接按 `AgentMemory` 表结构
INSERT，字段口径与 `service._persist_facts()`（L694-708）保持一致：
`content / fact_type / importance / trust / content_hash / source_type /
tags_json / access_count / created_at / updated_at`。

FTS 镜像由 `database.ensure_agent_memory_fts()`（L88-121）建的**触发器**自动
同步，故播种前必须先建 schema + 触发器（本模块 `create_schema()` 负责）。

作为库使用（run.py 的做法）：**先** `bench_env.prepare()` 设好环境变量，**再**
`import seed`；本模块会检测到环境已就绪并复用，不会另建库。
作为脚本使用：`python seed.py [--db-dir <dir>] [--tag <t>] [--keep]`。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import bench_env

CORPUS_PATH = Path(__file__).resolve().parent / "corpus.json"


def _preparse() -> argparse.Namespace:
    """**导入 app.* 之前**先取到 --db-dir / --tag（环境必须在导入期前设好）。"""
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--db-dir", default=None)
    ap.add_argument("--tag", default=None)
    ns, _ = ap.parse_known_args()
    return ns


_PRE = _preparse()

if bench_env.is_prepared():
    PATHS: dict = {
        "db_dir": str(Path(os.environ[bench_env.ENV_KEYS["analytics"]]).parent),
        "tag": None,
        **{k: os.environ[v] for k, v in bench_env.ENV_KEYS.items()},
    }
else:
    PATHS = bench_env.prepare(_PRE.db_dir, _PRE.tag)

# —— 以下导入必须在环境隔离之后（app/database.py 在导入期建 Engine）——
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401  注册 analytics 全部表到 Base
from app.database import (  # noqa: E402
    AnalyticsSession, Base, FeedbackBase, OpsBase, analytics_engine,
    ensure_agent_memory_fts, feedback_engine, ops_engine,
)
from app.memory import service as msvc  # noqa: E402
from app.models import AgentMemory, User, UserSetting  # noqa: E402
from app.models.ops import Event  # noqa: E402,F401  注册 OpsBase.events
try:  # 反馈库表注册（模块名可能随治理调整，缺失不阻断：本基准不用反馈库）
    import app.models.feedback  # noqa: E402,F401
except Exception:  # pragma: no cover
    pass


def create_schema() -> dict:
    """幂等建三库 schema + FTS5 触发器；返回自检结果。"""
    Base.metadata.create_all(analytics_engine)
    FeedbackBase.metadata.create_all(feedback_engine)
    OpsBase.metadata.create_all(ops_engine)
    ensure_agent_memory_fts()

    required = {"users", "user_settings", "agent_memories", "agent_memories_fts"}
    with analytics_engine.connect() as conn:
        names = {r[0] for r in conn.execute(
            text("SELECT name FROM sqlite_master WHERE type IN ('table','trigger')"))}
    missing = sorted(required - names)
    if missing:
        raise RuntimeError("schema 自检失败，缺表/触发器：%s" % missing)
    return {"required_ok": True,
            "analytics_table_count": len(Base.metadata.tables),
            "ops_table_count": len(OpsBase.metadata.tables)}


def load_corpus(path: str | Path = CORPUS_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dispose_engines() -> None:
    """释放三个引擎的连接池。

    ⚠ 清理临时库**之前必须调用**：Windows 下删除仍被打开的文件会失败
    （`WinError 32/5`），否则 `cleanup()` 会报 failed 而文件残留。
    """
    for engine in (analytics_engine, feedback_engine, ops_engine):
        try:
            engine.dispose()
        except Exception:  # pragma: no cover
            pass


def seed(corpus: dict, *, now: datetime | None = None) -> dict:
    """把语料灌入临时库；返回 user_id / fact_id 映射与统计。

    Returns:
        {"user_ids": {username: id}, "fact_ids": {corpus_fact_id: db_id},
         "fact_topic": {db_id: topic}, "inserted_facts": int, "fts_rows": int}
    """
    now = now or msvc._now()          # 与生产同一时间口径（naive utcnow）
    session = AnalyticsSession()
    try:
        user_ids: dict[str, int] = {}
        for u in corpus["users"]:
            user = User(username=u["username"],
                        password_hash="bench-disabled-not-a-real-hash",
                        nickname=u["username"])
            session.add(user)
            session.flush()
            session.add(UserSetting(user_id=user.id, agent_enabled=True))
            user_ids[u["username"]] = user.id

            for f in u["facts"]:
                ts = now - timedelta(days=int(f["age_days"]))
                session.add(AgentMemory(
                    user_id=user.id,
                    content=f["content"],
                    fact_type=f["fact_type"],
                    importance=float(f["importance"]),
                    trust=float(f["trust"]),
                    content_hash=msvc.content_hash_of(f["content"]),
                    source_type="agent_chat",
                    tags_json=json.dumps(f["tags"], ensure_ascii=False),
                    access_count=0,
                    last_recalled_at=None,
                    created_at=ts,
                    updated_at=ts,
                    deleted_at=None,
                ))
        session.commit()

        rows = session.execute(text(
            "SELECT id, user_id, content_hash FROM agent_memories")).fetchall()
        hash_to_db: dict[tuple[int, str], int] = {
            (r.user_id, r.content_hash): r.id for r in rows
        }

        fact_ids: dict[str, int] = {}
        fact_topic: dict[int, str] = {}
        missing: list[str] = []
        for u in corpus["users"]:
            uid = user_ids[u["username"]]
            for f in u["facts"]:
                db_id = hash_to_db.get((uid, msvc.content_hash_of(f["content"])))
                if db_id is None:
                    missing.append(f["id"])
                    continue
                fact_ids[f["id"]] = db_id
                fact_topic[db_id] = f["topic"]
        if missing:
            raise RuntimeError("播种自检失败：%d 条事实回读不到 id（如 %s）"
                               % (len(missing), missing[:3]))

        fts_rows = session.execute(
            text("SELECT count(*) FROM agent_memories_fts")).scalar() or 0
        mem_rows = session.execute(
            text("SELECT count(*) FROM agent_memories")).scalar() or 0
        if fts_rows != mem_rows:
            raise RuntimeError(
                "FTS 同步自检失败：agent_memories=%d 但 agent_memories_fts=%d"
                "（触发器未生效？）" % (mem_rows, fts_rows))

        return {"user_ids": user_ids, "fact_ids": fact_ids, "fact_topic": fact_topic,
                "inserted_facts": mem_rows, "fts_rows": fts_rows}
    finally:
        session.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="把 corpus.json 灌进临时 SQLite 库")
    ap.add_argument("--corpus", default=str(CORPUS_PATH))
    ap.add_argument("--keep", action="store_true", help="保留临时库文件")
    ap.parse_known_args()   # --db-dir/--tag 已在导入前由 _preparse() 取走

    print("db_dir:", PATHS["db_dir"])
    for key in bench_env.ENV_KEYS:
        print("  %-9s %s" % (key, PATHS[key]))

    schema = create_schema()
    corpus = load_corpus(CORPUS_PATH)
    stats = seed(corpus)
    print("schema ok:", schema["required_ok"],
          "| analytics_tables:", schema["analytics_table_count"],
          "| ops_tables:", schema["ops_table_count"])
    print("users: %d  facts: %d  fts_rows: %d  questions: %d"
          % (len(stats["user_ids"]), stats["inserted_facts"],
             stats["fts_rows"], len(corpus["questions"])))

    if "--keep" not in sys.argv:
        dispose_engines()
        removed, failed = bench_env.cleanup(PATHS)
        print("已清理临时库文件: %d" % len(removed))
        if failed:
            print("!! 未清理成功（请手工删除）:", failed)
    else:
        print("已保留临时库（--keep）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
