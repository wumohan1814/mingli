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
