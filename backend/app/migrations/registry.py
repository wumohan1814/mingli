# -*- coding: utf-8 -*-
"""版本化迁移步骤登记表（**只增不改**）。

纪律（规范见 `docs/standards/09-数据迁移与版本化.md`）：
- 已发布的步骤**不许修改内容**（改了 = 不同库跑出不同结构，无法复现）；
- 版本号必须**严格递增且唯一**，测试会断言；
- 每个步骤只做一件事，且必须**幂等写**（`IF NOT EXISTS` / `INSERT OR IGNORE` /
  `PRAGMA table_info` 探测后 `ADD COLUMN`）——幂等是为了「迁移中途崩溃后重跑」；
- 步骤函数**不得依赖外键强制**（执行器不设 `PRAGMA foreign_keys=ON`），
  也不得依赖 SQLAlchemy 模型（必须能脱离应用单独跑）。

版本语义：
- **v1 = 基线**。「基线」的定义 = `Base.metadata.create_all` + `ensure_schema()`
  里那批**历史遗留补列/种子**执行完之后的现状。既有库（无版本记录）由 v1 盖章，
  见 `_v1_baseline_stamp`。
- v2 起 = 真实结构变更。**新增的结构变更一律走版本化迁移，不再往
  `ensure_schema()` 里加补列**（那条线自本次起冻结为历史遗留）。
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Migration:
    """一个迁移步骤。

    fn 的签名统一为 `fn(conn, app)`：`conn` 是执行器开好的 sqlite3 连接（已在
    `BEGIN IMMEDIATE` 事务内），`app` 是库名（analytics / feedback / ops）。
    """

    version: int
    name: str
    summary: str
    fn: Callable[[sqlite3.Connection, str], None]


#: 基线版本号（既有库盖章即等于此值）
BASELINE_VERSION = 1


def _v1_baseline_stamp(conn: sqlite3.Connection, app: str) -> None:
    """v1 · 基线盖章：把「无版本记录」的既有库声明为基线版本。

    本步骤**不碰任何既有表结构**，只写 `schema_meta` 两行事实（库名 + 盖章时间）。
    版本号本身由执行器统一写入，步骤只管自己那份事实。
    """
    conn.execute(
        "INSERT INTO schema_meta(k, v) VALUES ('app', ?) "
        "ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        (app,),
    )
    conn.execute(
        "INSERT INTO schema_meta(k, v) VALUES ('baseline_stamped_at', datetime('now')) "
        "ON CONFLICT(k) DO UPDATE SET v = excluded.v"
    )


def _v2_migration_ledger(conn: sqlite3.Connection, app: str) -> None:
    """v2 · 迁移记账表：真实新建 `schema_migrations`，并回填 v1 的历史事实。

    为什么要这张表（而不是只用 `schema_meta.version`）：版本号只回答「现在是多少」，
    不回答「哪一步、什么时候、跑过没有」。排障时要能逐步骤对账（尤其 APK 端老库）。
    """
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " app TEXT NOT NULL,"
        " version INTEGER NOT NULL,"
        " name TEXT NOT NULL,"
        " summary TEXT,"
        " applied_at TEXT NOT NULL DEFAULT (datetime('now')),"
        " PRIMARY KEY (app, version))"
    )
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations(app, version, name, summary) "
        "VALUES (?, ?, ?, ?)",
        (app, BASELINE_VERSION, "baseline-stamp", "基线盖章（既有库结构现状，不动结构）"),
    )


#: 迁移链（顺序即执行顺序；新增一律 append，不插入、不修改）
MIGRATIONS: tuple[Migration, ...] = (
    Migration(
        version=BASELINE_VERSION,
        name="baseline-stamp",
        summary="基线盖章：既有库声明为 v1，不改任何既有结构",
        fn=_v1_baseline_stamp,
    ),
    Migration(
        version=2,
        name="migration-ledger",
        summary="建立迁移记账表 schema_migrations 并回填 v1",
        fn=_v2_migration_ledger,
    ),
)

#: 代码当前已知的最高版本。库版本高于它 = 库由更新版本写入 → 拒绝启动（fail loud）。
SCHEMA_VERSION: int = max(m.version for m in MIGRATIONS)
