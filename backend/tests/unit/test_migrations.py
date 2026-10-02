# -*- coding: utf-8 -*-
"""节162 地基 · 本地数据版本化迁移链 · 单测。

覆盖对象：`backend/app/migrations/`（registry 登记表 + runner 执行器）。

设计分层（**全部用真实结构与真实数据，零 mock**）：
  ① 全新库：真实 `create_all` 建表后迁移 → 版本 = 代码已知版本，逐步骤记账；
  ② 既有库（无版本记录）：真实建表 + 真实插入数据 → 迁移只盖章、只加记账表，
     **数据行数与既有表结构一字不变**；
  ③ 幂等：重复迁移零写入（`applied` 为空、记账不重复）；
  ④ 向前兼容：库版本高于代码版本 → `MigrationError`，且**不改库**；
  ⑤ 失败回滚：步骤中途抛错 → 整库回滚（版本不变、该步骤建的表不存在、无记账行）。

⚠️ conftest 已在 import 前把三库指向临时目录；本文件只操作 `tmp_path` 下的独立库，
   不触碰任何真实库。
"""
from __future__ import annotations

import sqlite3

import pytest
from sqlalchemy import create_engine

from app.database import Base, FeedbackBase, OpsBase
from app.migrations import SCHEMA_VERSION, Migration, MigrationError, migrate_db
from app.migrations.registry import BASELINE_VERSION, MIGRATIONS
from app.migrations.runner import LEDGER_TABLE, META_TABLE, read_version

# 触发模型注册到各 Base.metadata（真实结构来源）
import app.models  # noqa: F401


# ---------- 工具 ----------

def _connect(path: str) -> sqlite3.Connection:
    return sqlite3.connect(str(path))


def _tables(path: str) -> list[str]:
    conn = _connect(path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        return sorted(r[0] for r in rows)
    finally:
        conn.close()


def _struct_snapshot(path: str, skip: tuple[str, ...] = ()) -> dict[str, list[str]]:
    """每张表的列清单（结构指纹）。"""
    snap: dict[str, list[str]] = {}
    conn = _connect(path)
    try:
        for t in _tables(path):
            if t in skip:
                continue
            snap[t] = [r[1] for r in conn.execute(f"PRAGMA table_info({t})")]
    finally:
        conn.close()
    return snap


def _row_counts(path: str, skip: tuple[str, ...] = ()) -> dict[str, int]:
    counts: dict[str, int] = {}
    conn = _connect(path)
    try:
        for t in _tables(path):
            if t in skip:
                continue
            counts[t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    finally:
        conn.close()
    return counts


def _build_real_db(path, base) -> None:
    """用真实模型建表（等价于 main.py lifespan 的 create_all）。"""
    engine = create_engine(f"sqlite:///{path}")
    try:
        base.metadata.create_all(bind=engine)
    finally:
        engine.dispose()


def _seed_real_rows(path) -> None:
    """往真实结构里插真实数据（system_configs 一行；用 sqlite3 直连目标库，不借应用会话）。"""
    conn = _connect(str(path))
    try:
        conn.execute(
            "INSERT INTO system_configs (key, value) VALUES ('migration_probe', 'v1')"
        )
        conn.commit()
    finally:
        conn.close()


# ---------- ① 全新库 ----------

def test_new_db_migrates_to_code_version(tmp_path):
    path = tmp_path / "fresh.db"
    _build_real_db(path, Base)

    report = migrate_db(str(path), "analytics")

    assert report.from_version == 0
    assert report.to_version == SCHEMA_VERSION
    assert report.baseline_stamped is True
    assert report.applied == [f"v{m.version}-{m.name}" for m in MIGRATIONS]

    conn = _connect(str(path))
    try:
        assert read_version(conn) == SCHEMA_VERSION
        meta = dict(conn.execute(f"SELECT k, v FROM {META_TABLE}").fetchall())
        assert meta["app"] == "analytics"
        assert meta["version"] == str(SCHEMA_VERSION)
        assert "baseline_stamped_at" in meta
        ledger = conn.execute(
            f"SELECT version, name FROM {LEDGER_TABLE} ORDER BY version"
        ).fetchall()
        assert ledger == [(m.version, m.name) for m in MIGRATIONS]
    finally:
        conn.close()


# ---------- ② 既有库：只盖章，数据与结构不变 ----------

def test_legacy_db_is_stamped_without_touching_data_or_structure(tmp_path):
    path = tmp_path / "legacy.db"
    _build_real_db(path, Base)
    _seed_real_rows(path)

    before_tables = _tables(str(path))
    before_struct = _struct_snapshot(str(path))
    before_counts = _row_counts(str(path))
    assert "schema_meta" not in before_tables  # 前置事实：老库确实没有版本记录
    assert before_counts.get("system_configs") == 1

    report = migrate_db(str(path), "analytics")

    assert report.baseline_stamped is True
    assert report.to_version == SCHEMA_VERSION

    # 既有表结构与数据**一字不变**
    assert _struct_snapshot(str(path), skip=(META_TABLE, LEDGER_TABLE)) == before_struct
    assert _row_counts(str(path), skip=(META_TABLE, LEDGER_TABLE)) == before_counts

    # 只新增了机制自身的两张表
    assert set(_tables(str(path))) - set(before_tables) == {META_TABLE, LEDGER_TABLE}

    conn = _connect(str(path))
    try:
        assert conn.execute(
            "SELECT value FROM system_configs WHERE key='migration_probe'"
        ).fetchone()[0] == "v1"
    finally:
        conn.close()


def test_legacy_feedback_and_ops_dbs_also_migrate(tmp_path):
    """三库共用同一执行器：feedback / ops 各自独立记账。"""
    for app, base in (("feedback", FeedbackBase), ("ops", OpsBase)):
        path = tmp_path / f"{app}.db"
        _build_real_db(path, base)
        report = migrate_db(str(path), app)
        assert report.to_version == SCHEMA_VERSION, app
        conn = _connect(str(path))
        try:
            assert dict(conn.execute(f"SELECT k, v FROM {META_TABLE}").fetchall())["app"] == app
            rows = conn.execute(f"SELECT DISTINCT app FROM {LEDGER_TABLE}").fetchall()
            assert [r[0] for r in rows] == [app]
        finally:
            conn.close()


# ---------- ③ 幂等 ----------

def test_second_run_is_a_no_op(tmp_path):
    path = tmp_path / "idempotent.db"
    _build_real_db(path, Base)
    first = migrate_db(str(path), "analytics")
    assert first.changed is True

    before_meta = _struct_snapshot(str(path))
    conn = _connect(str(path))
    try:
        ledger_before = conn.execute(f"SELECT COUNT(*) FROM {LEDGER_TABLE}").fetchone()[0]
    finally:
        conn.close()

    second = migrate_db(str(path), "analytics")

    assert second.applied == []
    assert second.changed is False
    assert second.from_version == second.to_version == SCHEMA_VERSION
    assert second.baseline_stamped is False

    conn = _connect(str(path))
    try:
        assert conn.execute(f"SELECT COUNT(*) FROM {LEDGER_TABLE}").fetchone()[0] == ledger_before
    finally:
        conn.close()
    assert _struct_snapshot(str(path)) == before_meta


# ---------- ④ 向前兼容：库比代码新 → 拒绝 ----------

def test_db_newer_than_code_is_refused(tmp_path):
    path = tmp_path / "future.db"
    _build_real_db(path, Base)
    migrate_db(str(path), "analytics")

    future = SCHEMA_VERSION + 7
    conn = _connect(str(path))
    try:
        conn.execute(f"UPDATE {META_TABLE} SET v=? WHERE k='version'", (str(future),))
        conn.commit()
    finally:
        conn.close()

    before_struct = _struct_snapshot(str(path))
    before_counts = _row_counts(str(path))

    with pytest.raises(MigrationError) as exc:
        migrate_db(str(path), "analytics")

    msg = str(exc.value)
    assert "高于本代码已知版本" in msg
    assert str(future) in msg and str(SCHEMA_VERSION) in msg
    # 拒绝时**不许改库**
    assert _struct_snapshot(str(path)) == before_struct
    assert _row_counts(str(path)) == before_counts


# ---------- ⑤ 失败回滚 ----------

def test_failing_step_rolls_back_whole_db(tmp_path):
    path = tmp_path / "rollback.db"
    _build_real_db(path, Base)

    def _boom(conn, app):  # 真实 DDL 之后抛错：验证 DDL 也被回滚
        conn.execute("CREATE TABLE boom_probe (id INTEGER PRIMARY KEY)")
        conn.execute("INSERT INTO boom_probe (id) VALUES (1)")
        raise RuntimeError("故意失败")

    registry = (
        MIGRATIONS[0],
        MIGRATIONS[1],
        Migration(version=SCHEMA_VERSION + 1, name="boom", summary="故意失败", fn=_boom),
    )

    with pytest.raises(MigrationError) as exc:
        migrate_db(str(path), "analytics", migrations=registry)

    assert "boom" in str(exc.value) and "已回滚" in str(exc.value)

    # 「一库一事务」的硬断言：失败即**整库回滚**——连版本登记表与记账表都不该留下，
    # 失败步骤的 DDL 更不存在（SQLite 的 DDL 参与事务）。
    before_struct = {}
    conn = _connect(str(path))
    try:
        assert read_version(conn) is None
        for absent in ("boom_probe", META_TABLE, LEDGER_TABLE):
            assert conn.execute(
                "SELECT 1 FROM sqlite_master WHERE name=?", (absent,)
            ).fetchone() is None, absent
        before_struct = {
            t: [r[1] for r in conn.execute(f"PRAGMA table_info({t})")]
            for t in _tables(str(path))
        }
    finally:
        conn.close()

    # 库回到「迁移前」的真实结构：与新建后未迁移的状态一致
    fresh = tmp_path / "rollback_reference.db"
    _build_real_db(fresh, Base)
    assert before_struct == _struct_snapshot(str(fresh))


def test_registry_is_append_only_sorted_and_unique():
    """登记表纪律：版本唯一、严格递增、基线为 v1（只增不改的机器化护栏）。"""
    versions = [m.version for m in MIGRATIONS]
    assert versions == sorted(versions)
    assert len(set(versions)) == len(versions)
    assert versions[0] == BASELINE_VERSION == 1
    assert SCHEMA_VERSION == versions[-1]
    # 每个步骤都必须有可读说明（写进 schema_migrations 供排障对账）
    assert all(m.summary.strip() for m in MIGRATIONS)


# ---------- ⑥ v3：老库 jobs 表重建（合参两列 + case_id 放开） ----------

# 合参改造前的生产结构（字面写死：老库真实 DDL，case_id NOT NULL，无 method_keys）
_LEGACY_JOBS_DDL = (
    "CREATE TABLE jobs ("
    " id INTEGER NOT NULL,"
    " case_id INTEGER NOT NULL,"
    " user_id INTEGER NOT NULL,"
    " type VARCHAR(14) NOT NULL,"
    " status VARCHAR(9),"
    " total INTEGER,"
    " completed INTEGER,"
    " error TEXT,"
    " created_at DATETIME,"
    " updated_at DATETIME, result_json JSON,"
    " PRIMARY KEY (id),"
    " FOREIGN KEY(case_id) REFERENCES cases (id),"
    " FOREIGN KEY(user_id) REFERENCES users (id))"
)


def _build_legacy_jobs_db(path) -> None:
    """造一个「合参改造前」的老库：老结构 jobs + 两行真实数据 + 两个索引。"""
    conn = _connect(str(path))
    try:
        conn.execute("CREATE TABLE cases (id INTEGER NOT NULL PRIMARY KEY)")
        conn.execute("CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY)")
        conn.execute(_LEGACY_JOBS_DDL)
        conn.execute("CREATE INDEX ix_jobs_user_id ON jobs (user_id)")
        conn.execute("CREATE INDEX ix_jobs_case_id ON jobs (case_id)")
        conn.execute("INSERT INTO cases (id) VALUES (1)")
        conn.execute("INSERT INTO users (id) VALUES (7)")
        conn.execute(
            "INSERT INTO jobs (id, case_id, user_id, type, status, total, completed, error,"
            " result_json) VALUES (1, 1, 7, 'duan_qian_chen', 'succeeded', 8, 8, NULL, '{\"a\":1}')"
        )
        conn.execute(
            "INSERT INTO jobs (id, case_id, user_id, type, status, total, completed, error)"
            " VALUES (2, 1, 7, 'predict', 'failed', 0, 0, '服务重启，任务中断，请重新触发')"
        )
        conn.commit()
    finally:
        conn.close()


def _jobs_columns(path) -> dict[str, tuple]:
    conn = _connect(str(path))
    try:
        return {r[1]: r for r in conn.execute("PRAGMA table_info(jobs)")}
    finally:
        conn.close()


def test_v3_rebuilds_legacy_jobs_table_and_keeps_data(tmp_path):
    """老库 jobs.case_id NOT NULL → 重建放开为可空 + 补两列，数据/索引一字不丢。"""
    path = tmp_path / "legacy_jobs.db"
    _build_legacy_jobs_db(str(path))

    before = _jobs_columns(str(path))
    assert before["case_id"][3] == 1, "前置事实：老库 case_id 是 NOT NULL"
    assert "method_keys" not in before and "combine_mode" not in before

    report = migrate_db(str(path), "analytics")
    assert report.to_version == SCHEMA_VERSION

    after = _jobs_columns(str(path))
    assert after["case_id"][3] == 0, "case_id 必须已放开为可空（当下事合参没有档案）"
    assert after["method_keys"][1] == "method_keys" and after["combine_mode"][1] == "combine_mode"

    # 数据一字不丢（含 result_json 与 error 文本）
    conn = _connect(str(path))
    try:
        rows = conn.execute(
            "SELECT id, case_id, user_id, type, status, total, completed, error, result_json"
            " FROM jobs ORDER BY id"
        ).fetchall()
        assert [r[0] for r in rows] == [1, 2]
        assert rows[0][1:] == (1, 7, "duan_qian_chen", "succeeded", 8, 8, None, '{"a":1}')
        assert rows[1][8] is None and "服务重启" in rows[1][7]
        # 新列对老行为 NULL（语义 = 未记录，不是「全量」）
        assert all(r[0] is None for r in conn.execute("SELECT method_keys FROM jobs"))
        assert all(r[0] is None for r in conn.execute("SELECT combine_mode FROM jobs"))
        # 索引按原样重建
        idx = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='jobs'"
        )]
        assert set(idx) >= {"ix_jobs_user_id", "ix_jobs_case_id"}
        # 可空真的可空：没有档案的 job 能插进去
        conn.execute(
            "INSERT INTO jobs (case_id, user_id, type, status, total, completed, method_keys,"
            " combine_mode) VALUES (NULL, 7, 'moment_combine', 'pending', 6, 0, '[\"ssgw\"]', 'moment')"
        )
        conn.commit()
        assert conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0] == 3
    finally:
        conn.close()

    # 幂等：二次迁移零写入、结构不变
    struct = _struct_snapshot(str(path))
    second = migrate_db(str(path), "analytics")
    assert second.applied == [] and second.changed is False
    assert _struct_snapshot(str(path)) == struct


def test_v3_is_noop_on_current_schema_db(tmp_path):
    """当前模型建的库（case_id 已可空 + 两列已在）→ 步骤什么都不改（一字不变）。"""
    path = tmp_path / "current.db"
    _build_real_db(path, Base)
    before = _struct_snapshot(str(path))
    before_counts = _row_counts(str(path))

    migrate_db(str(path), "analytics")

    assert _jobs_columns(str(path))["case_id"][3] == 0
    assert _struct_snapshot(str(path), skip=(META_TABLE, LEDGER_TABLE)) == before
    assert _row_counts(str(path), skip=(META_TABLE, LEDGER_TABLE)) == before_counts
