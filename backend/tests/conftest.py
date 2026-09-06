# -*- coding: utf-8 -*-
"""pytest 全局夹具（测试级 DB 隔离 + 编排回归公共夹具）。

DB 隔离原理：pydantic-settings 中**环境变量优先级高于 env_file**，因此只要在任何
`app.*` 被 import 之前（本文件为 tests/ 首个被 pytest 加载的模块）写入
TAICHU_DB_PATH / TAICHU_FEEDBACK_DB_PATH，之后才 import app.database 的模块
（app.models / app.jobs.orchestrator 等）拿到的就是临时库，绝不触碰真实
backend/data/taichu_analytics.db。

编排回归夹具：
  - orchestration_env（session）：建表 + ensure_schema() 迁移各执行一次；
  - chart_snapshot（session）：fixtures/chart.json 内容（全 session 复用，不重复读盘）；
  - paipan_case（function）：工厂，生成一个已排盘的 case（user + case + chart 行），
    返回 (uid, cid, chart_json, degraded_methods)。
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import pytest

# 顶层、任何 app import 之前写入临时库路径（session 级临时目录，全部测试共用）
_TMP_ROOT = Path(tempfile.mkdtemp(prefix="taichu_pytest_"))
os.environ["TAICHU_DB_PATH"] = str(_TMP_ROOT / "analytics.db")
os.environ["TAICHU_FEEDBACK_DB_PATH"] = str(_TMP_ROOT / "feedback.fb")

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CHART_JSON_PATH = FIXTURES_DIR / "chart.json"


@pytest.fixture(scope="session")
def orchestration_env():
    """会话级：在临时 analytics 库上建全部表 + 执行幂等迁移一次。

    结束后清理临时目录；Windows 下 SQLAlchemy engine 未关闭可能锁住 db 文件，
    故先 dispose 两个 engine 再删；仍失败（如句柄未及时释放）则忽略并留待系统清理。
    """
    import app.models  # noqa: F401  # 注册全部 ORM 表到 Base.metadata
    from app.database import Base, analytics_engine, ensure_schema, feedback_engine

    Base.metadata.create_all(bind=analytics_engine)
    ensure_schema()
    yield
    analytics_engine.dispose()
    feedback_engine.dispose()
    # 注：SQLite 文件锁在个别 Windows/驱动组合下可能残留，删除失败可安全忽略
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)


@pytest.fixture(scope="session")
def chart_snapshot() -> dict:
    """完整 chart 快照（fixtures/chart.json），session 内读一次复用。"""
    if not CHART_JSON_PATH.exists():
        pytest.fail(f"缺少 chart 快照: {CHART_JSON_PATH}")
    with open(CHART_JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def paipan_case(orchestration_env, chart_snapshot):
    """工厂夹具：生成一个已排盘的 case（user/case/chart 三行已落临时库）。

    Returns:
        Callable[[list[str] | None], tuple[int, int, dict, list[str]]]
        调用 _make(degraded_methods=[...]) → (uid, cid, chart_json, degraded_methods)。
        degraded_methods 缺省取 chart 快照 meta 里的降级方法（完整盘为 []）。
    """

    def _make(degraded_methods: list[str] | None = None):
        deg = list(degraded_methods) if degraded_methods is not None else list(
            (chart_snapshot.get("meta") or {}).get("degraded_methods") or []
        )
        from app.database import AnalyticsSession
        from app.models import Case, CaseStatus, Chart, User

        session = AnalyticsSession()
        try:
            user = User(
                username=f"ut_{uuid.uuid4().hex[:12]}",
                password_hash="test-only-not-verified",
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            case = Case(
                user_id=user.id,
                input_json={"question": "事业运势"},
                status=CaseStatus.paipan_done,
            )
            session.add(case)
            session.commit()
            session.refresh(case)

            chart_row = Chart(
                case_id=case.id,
                chart_json=chart_snapshot,
                degraded_methods=deg,
            )
            session.add(chart_row)
            session.commit()
            return user.id, case.id, chart_snapshot, deg
        finally:
            session.close()

    return _make
