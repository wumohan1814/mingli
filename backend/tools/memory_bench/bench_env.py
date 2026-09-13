# -*- coding: utf-8 -*-
"""离线记忆召回基准 · 环境隔离层。

**必须在 `import app.*` 之前调用 `prepare()`。** 原因：`app/database.py` 在
**模块导入期**就执行 `create_engine(f"sqlite:///{settings.db_path}")`（L11-27），
导入之后再改环境变量已经无效。

职责：
  1. `prepare(db_dir)` —— 把 analytics / feedback / ops 三个库路径指向
     **仓库外**的独立临时文件，并写回 `MINGLI_*_DB_PATH` 环境变量；
  2. `assert_isolated()` —— 双保险：目录解析后只要落在**仓库内**或
     `/opt/mingli/data`（生产挂载点）下，一律 `RuntimeError` 拒绝执行；
  3. `cleanup()` —— 删除本次产生的库文件（`--keep` 时保留并打印路径）。

⚠ 实现注意（实测得出的约束，别改回去）：
    本机沙箱（Windows / workspace-write）**允许 Python 往临时目录根写文件，
    但拒绝写入新建的子目录**（`tempfile.mkdtemp()` 出来的目录里 open() 报
    PermissionError）。因此这里**不创建子目录**，改为在临时目录根下用
    `memory_bench_<uuid8>_{analytics,feedback,ops}.db` 三个唯一文件名。

口径说明：本模块不读 `.env`、不联网、不调用 LLM。
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

# backend/tools/memory_bench/bench_env.py -> parents[2] == backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent

#: 绝对禁止写入的目录（仓库整棵树 + 生产机数据挂载点）
FORBIDDEN_ROOTS: tuple[Path, ...] = (
    REPO_ROOT,
    Path("/opt/mingli/data"),
)

#: 三个库的环境变量名（对应 app/config.py 的 model_config env_prefix="MINGLI_"）
ENV_KEYS: dict[str, str] = {
    "analytics": "MINGLI_DB_PATH",
    "feedback": "MINGLI_FEEDBACK_DB_PATH",
    "ops": "MINGLI_OPS_DB_PATH",
}


def default_db_dir() -> str:
    """临时目录根（不建子目录，见模块 docstring 的实现注意）。"""
    import tempfile
    return tempfile.gettempdir()


def _assert_not_inside(path: Path, root: Path, label: str) -> None:
    try:
        path.relative_to(root)
    except ValueError:
        return
    raise RuntimeError(
        f"隔离检查失败：{label} 解析到 {path}，位于禁止写入的 {root} 之内。"
        "离线基准只允许写入系统临时目录，绝不碰生产库与项目内真实库。"
    )


def assert_isolated(db_dir: str) -> Path:
    """断言 db_dir 不在仓库内、不在生产数据目录内；返回解析后的绝对路径。

    注意：**不判断禁止目录是否存在** —— 早先写成 `if root.exists()` 时，
    `/opt/mingli/data` 在非 Linux 上不存在，这条守卫会被整体跳过（曾实测到
    该情况下只是被沙箱的 mkdir 拒绝，而不是被本断言拒绝）。始终比较才严密。
    """
    resolved = Path(db_dir).resolve()
    for root in FORBIDDEN_ROOTS:
        _assert_not_inside(resolved, root.resolve(), "临时库目录")
    return resolved


def prepare(db_dir: str | None = None, tag: str | None = None) -> dict:
    """设定三个库路径环境变量；返回路径字典。

    Args:
        db_dir: 临时库所在目录；None → 系统临时目录（不建子目录）。
        tag: 本次运行的文件名前缀；None → `memory_bench_<uuid8>`。

    Returns:
        {"db_dir","tag","analytics","feedback","ops"}

    Raises:
        RuntimeError: 目录未通过隔离检查。
    """
    target = assert_isolated(db_dir or default_db_dir())
    target.mkdir(parents=True, exist_ok=True)
    tag = tag or ("memory_bench_" + uuid.uuid4().hex[:8])

    paths: dict = {"db_dir": str(target), "tag": tag}
    for key, env_name in ENV_KEYS.items():
        file_path = target / f"{tag}_{key}.db"
        os.environ[env_name] = str(file_path)
        paths[key] = str(file_path)
    return paths


def is_prepared() -> bool:
    """三个库环境变量是否已全部就位。"""
    return all(os.environ.get(k) for k in ENV_KEYS.values())


def cleanup(paths: dict) -> tuple[list[str], list[str]]:
    """删除本次产生的库文件（含 WAL/SHM 边车）。

    ⚠ 调用前必须先 `dispose()` 掉 SQLAlchemy 引擎：Windows 下**删除仍被打开的
    文件会失败**（WinError 32/5），此前静默吞异常导致"清理了 0 个文件"却看不出原因。

    Returns:
        (removed, failed) 两个路径列表；`failed` 非空时应打印出来，不要静默。
    """
    removed: list[str] = []
    failed: list[str] = []
    for key in ENV_KEYS:
        base = paths.get(key)
        if not base:
            continue
        for suffix in ("", "-wal", "-shm"):
            p = Path(str(base) + suffix)
            if not p.exists():
                continue
            try:
                p.unlink()
                removed.append(str(p))
            except OSError as exc:
                failed.append("%s (%s)" % (p, exc.__class__.__name__))
    return removed, failed


def env_report() -> dict:
    """当前三个库环境变量的实际取值（供报告留痕）。"""
    return {name: os.environ.get(name, "<unset>") for name in ENV_KEYS.values()}
