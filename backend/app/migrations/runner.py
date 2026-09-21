# -*- coding: utf-8 -*-
"""版本化迁移执行器：SQLite 三库（analytics / feedback / ops）通用。

规范：`docs/standards/09-数据迁移与版本化.md`。设计要点：

1. **版本登记**：每库一张 `schema_meta`（k/v），键 `version` = 整数版本号。
2. **记账**：`schema_migrations` 逐步骤留痕（自 v2 起存在；v1 阶段还没有这张表，
   故记账是「有表才记」，不是「必须有表」）。
3. **一库一事务**：`BEGIN IMMEDIATE` 先取写锁 → 任一步失败**整体回滚**并把异常包成
   `MigrationError` 抛出（fail loud，绝不静默降级成「结构没升上去但启动成功」）。
4. **向前兼容保护**：库版本 > 代码已知版本 → 拒绝该库并给出清晰错误。
   这是防「新版写过、老版又打开」导致数据被误解/损坏的关键闸门。
5. **幂等**：已应用步骤不重复执行（按版本号比对），步骤自身也要求幂等写。
6. **并发**：`BEGIN IMMEDIATE` + `busy_timeout` 让多 worker 启动时**串行**；
   等在超时内则排队，超时则 `MigrationError`（fail loud，谁也不会半途乱写）。

只依赖标准库 `sqlite3`（**不依赖 SQLAlchemy / 不依赖应用模型**），
因此在 APK 单机模式、测试临时库、服务器三种场景下行为一致。
"""
from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass, field
from typing import Sequence

from app.migrations.registry import BASELINE_VERSION, MIGRATIONS, Migration

logger = logging.getLogger(__name__)

META_TABLE = "schema_meta"
LEDGER_TABLE = "schema_migrations"
BUSY_TIMEOUT_MS = 10_000


class MigrationError(RuntimeError):
    """迁移失败 / 库版本高于代码版本。

    一律 fail loud：调用方（启动流程）**不许**吞掉它继续跑。
    """


@dataclass
class MigrationReport:
    """一次迁移的结果（供日志与测试断言）。"""

    app: str
    path: str
    from_version: int
    to_version: int
    applied: list[str] = field(default_factory=list)
    baseline_stamped: bool = False

    @property
    def changed(self) -> bool:
        return bool(self.applied)


def _validate_registry(migrations: Sequence[Migration]) -> None:
    """登记表自检：版本号唯一且严格递增（发现即抛，避免跑出不可复现的结构）。"""
    versions = [m.version for m in migrations]
    if not versions:
        raise MigrationError("迁移登记表为空")
    if len(set(versions)) != len(versions):
        raise MigrationError(f"迁移登记表版本号重复：{versions}")
    if versions != sorted(versions):
        raise MigrationError(f"迁移登记表未按版本号递增：{versions}")


def _connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, isolation_level=None, timeout=BUSY_TIMEOUT_MS / 1000.0)
    conn.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
    return conn


def _has_table(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def _ensure_meta_table(conn: sqlite3.Connection) -> None:
    """机制自身的载体表（不属于任何编号步骤）：没有它就没法记版本。"""
    conn.execute(
        f"CREATE TABLE IF NOT EXISTS {META_TABLE} (k TEXT PRIMARY KEY, v TEXT NOT NULL)"
    )


def read_version(conn: sqlite3.Connection) -> int | None:
    """读库版本。

    - `schema_meta` 表不存在（迁移前的老库 / 整库回滚后的库）→ 返回 None；
    - 表在但没有 `version` 行 → 返回 None；
    - 值不是整数（被人手改坏）→ fail loud。

    注意与「库版本 0」的区别：None 表示**从未迁移过**，调用方据此决定是否盖章。
    """
    if not _has_table(conn, META_TABLE):
        return None
    row = conn.execute(f"SELECT v FROM {META_TABLE} WHERE k='version'").fetchone()
    if row is None:
        return None
    try:
        return int(row[0])
    except (TypeError, ValueError) as exc:  # 被人手改坏 → fail loud，别猜
        raise MigrationError(
            f"{META_TABLE}.version 不是整数（值为 {row[0]!r}），库可能已被手工改动"
        ) from exc


def _write_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(
        f"INSERT INTO {META_TABLE}(k, v) VALUES ('version', ?) "
        "ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        (str(version),),
    )


def _record(conn: sqlite3.Connection, app: str, migration: Migration) -> None:
    """记账（`schema_migrations` 尚不存在时跳过——v1 阶段即如此）。"""
    if not _has_table(conn, LEDGER_TABLE):
        return
    conn.execute(
        f"INSERT OR IGNORE INTO {LEDGER_TABLE}(app, version, name, summary) "
        "VALUES (?, ?, ?, ?)",
        (app, migration.version, migration.name, migration.summary),
    )


def migrate_db(
    path: str,
    app: str,
    migrations: Sequence[Migration] = MIGRATIONS,
) -> MigrationReport:
    """把某个库升到代码已知版本；返回报告。

    - 既有库（无 `schema_meta.version`）→ 从 0 起跑，v1 即「盖章」，`baseline_stamped=True`；
    - 已是最新 → `applied` 为空、不做任何写入（幂等，重复启动零副作用）；
    - 库版本 > 代码版本 → `MigrationError`；
    - 任一步骤抛错 → 整体回滚 + `MigrationError`。
    """
    _validate_registry(migrations)
    top = max(m.version for m in migrations)

    applied: list[str] = []
    baseline_stamped = False
    from_version = 0
    to_version = 0

    conn = _connect(path)
    try:
        conn.execute("BEGIN IMMEDIATE")  # 先取写锁：多 worker 并发启动串行化
        try:
            _ensure_meta_table(conn)
            current = read_version(conn)
            from_version = current if current is not None else 0

            if current is not None and current > top:
                raise MigrationError(
                    f"「{app}」库版本({current}) 高于本代码已知版本({top})："
                    f"该库由更新版本的程序写入（{path}）。"
                    "请先升级程序再打开——用旧版本打开会造成数据被误解/损坏。"
                )

            for migration in [m for m in migrations if m.version > from_version]:
                try:
                    migration.fn(conn, app)
                except MigrationError:
                    raise
                except Exception as exc:
                    raise MigrationError(
                        f"「{app}」库迁移失败并已回滚：v{migration.version} "
                        f"{migration.name}（{path}）— {type(exc).__name__}: {exc}"
                    ) from exc
                _write_version(conn, migration.version)
                _record(conn, app, migration)
                applied.append(f"v{migration.version}-{migration.name}")
                if current is None and migration.version == BASELINE_VERSION:
                    baseline_stamped = True

            to_version = read_version(conn) or from_version
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    except sqlite3.OperationalError as exc:
        # 典型：BEGIN IMMEDIATE 在 busy_timeout 内没拿到写锁（另一进程正在迁移）
        raise MigrationError(
            f"「{app}」库迁移无法取得写锁（{path}）：{exc}。"
            "可能有另一个进程正在迁移，请确认无并发启动后重试。"
        ) from exc
    finally:
        conn.close()

    report = MigrationReport(
        app=app,
        path=path,
        from_version=from_version,
        to_version=to_version,
        applied=applied,
        baseline_stamped=baseline_stamped,
    )
    if report.changed:
        logger.info(
            "「%s」库迁移完成：v%s → v%s（%s）",
            app,
            report.from_version,
            report.to_version,
            ", ".join(report.applied),
        )
    return report


def migrate_all(targets: Sequence[tuple[str, str]]) -> list[MigrationReport]:
    """按顺序迁移多个库：`targets = [("analytics", path), ("feedback", path), ...]`。

    任一库失败即抛出（不「跳过继续」）——启动流程必须失败可见。
    """
    return [migrate_db(path, app) for app, path in targets]
