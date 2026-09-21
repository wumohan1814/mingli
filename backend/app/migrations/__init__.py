# -*- coding: utf-8 -*-
"""版本化数据迁移（SQLite 三库通用）。

对外只需两个入口：
- `migrate_all([("analytics", path), ...])`：启动时把各库升到代码已知版本；
- `MigrationError`：迁移失败 / 库版本高于代码版本 —— 调用方必须让它中断启动（fail loud）。

规范见 `docs/standards/09-数据迁移与版本化.md`。
"""
from app.migrations.registry import (  # noqa: F401
    BASELINE_VERSION,
    MIGRATIONS,
    SCHEMA_VERSION,
    Migration,
)
from app.migrations.runner import (  # noqa: F401
    MigrationError,
    MigrationReport,
    migrate_all,
    migrate_db,
)

__all__ = [
    "BASELINE_VERSION",
    "MIGRATIONS",
    "SCHEMA_VERSION",
    "Migration",
    "MigrationError",
    "MigrationReport",
    "migrate_all",
    "migrate_db",
]
