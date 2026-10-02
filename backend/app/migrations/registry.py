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


def _v3_jobs_combine_columns(conn: sqlite3.Connection, app: str) -> None:
    """v3 · jobs 表：合参两列 + case_id 放开 NOT NULL（当下事合参没有档案）。

    为什么必须动 case_id：`jobs.case_id` 原本 NOT NULL——命盘合参（断前尘/预测）挂在
    档案上没问题，但「当下事合参」不需要生辰、不落 case，job 必须能没有 case_id。
    SQLite 不能 ALTER 掉 NOT NULL，只能**重建表**（建新表 → 拷数据 → 换名 → 重建索引）。

    幂等：
    - 库无 jobs 表（feedback / ops 库）→ 直接返回；
    - 表已可空且两列已存在（新库由 create_all 建全）→ 不做任何写入（一字不变）；
    - 只缺列 → 只补列（不重建，避免无谓搬数据）。

    注意：本步骤不吃 SQLAlchemy 模型（执行器纪律），DDL 与列清单全部字面写死。
    """
    cols = {row[1]: row for row in conn.execute("PRAGMA table_info(jobs)")}
    if not cols:
        return

    new_columns = (("method_keys", "JSON"), ("combine_mode", "VARCHAR(16)"))

    # case_id 可空（PRAGMA 第 4 位 = notnull）：只补缺列即可
    if not cols["case_id"][3]:
        for name, ddl in new_columns:
            if name not in cols:
                conn.execute(f"ALTER TABLE jobs ADD COLUMN {name} {ddl}")
        return

    # 老库：case_id NOT NULL → 重建表（目标结构 = 当前模型的列与顺序）
    conn.execute(
        "CREATE TABLE jobs__v3 ("
        " id INTEGER NOT NULL,"
        " case_id INTEGER,"
        " user_id INTEGER NOT NULL,"
        " type VARCHAR(14) NOT NULL,"
        " status VARCHAR(9),"
        " total INTEGER,"
        " completed INTEGER,"
        " error TEXT,"
        " result_json JSON,"
        " method_keys JSON,"
        " combine_mode VARCHAR(16),"
        " created_at DATETIME,"
        " updated_at DATETIME,"
        " PRIMARY KEY (id),"
        " FOREIGN KEY(case_id) REFERENCES cases (id),"
        " FOREIGN KEY(user_id) REFERENCES users (id))"
    )
    # 只拷新旧表都有的列（老库 result_json 由历史补列线加过，理论上必在；仍按交集拷贝，
    # 少一列也不至于让整库迁移崩掉）
    target = [r[1] for r in conn.execute("PRAGMA table_info(jobs__v3)")]
    copy_cols = [c for c in target if c in cols]
    col_list = ", ".join(copy_cols)
    conn.execute(f"INSERT INTO jobs__v3 ({col_list}) SELECT {col_list} FROM jobs")
    conn.execute("DROP TABLE jobs")
    conn.execute("ALTER TABLE jobs__v3 RENAME TO jobs")
    # 索引随旧表一起被删，按原样重建（列上的 index=True）
    conn.execute("CREATE INDEX IF NOT EXISTS ix_jobs_user_id ON jobs (user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_jobs_case_id ON jobs (case_id)")


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
    Migration(
        version=3,
        name="jobs-combine-columns",
        summary="jobs 补 method_keys/combine_mode 两列并把 case_id 放开为可空（当下事合参无档案）",
        fn=_v3_jobs_combine_columns,
    ),
)

#: 代码当前已知的最高版本。库版本高于它 = 库由更新版本写入 → 拒绝启动（fail loud）。
SCHEMA_VERSION: int = max(m.version for m in MIGRATIONS)
