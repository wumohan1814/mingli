# -*- coding: utf-8 -*-
"""pytest 全局夹具（测试级 DB 隔离 + 编排回归公共夹具）。

DB 隔离原理：pydantic-settings 中**环境变量优先级高于 env_file**，因此只要在任何
`app.*` 被 import 之前（本文件为 tests/ 首个被 pytest 加载的模块）写入
TAICHU_DB_PATH / TAICHU_FEEDBACK_DB_PATH / TAICHU_OPS_DB_PATH，之后才 import
app.database 的模块（app.models / app.jobs.orchestrator 等）拿到的就是临时库，
绝不触碰真实 backend/data/taichu_analytics.db / taichu_ops.db。

编排回归夹具：
  - orchestration_env（session）：在临时 analytics/ops 库建表 + ensure_schema()
    迁移各执行一次；
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
os.environ["TAICHU_OPS_DB_PATH"] = str(_TMP_ROOT / "ops.db")

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CHART_JSON_PATH = FIXTURES_DIR / "chart.json"


@pytest.fixture(scope="session")
def orchestration_env():
    """会话级：在临时 analytics / ops 库上建全部表 + 执行幂等迁移一次。

    结束后清理临时目录；Windows 下 SQLAlchemy engine 未关闭可能锁住 db 文件，
    故先 dispose 三个 engine（analytics/feedback/ops）再删；仍失败（如句柄未
    及时释放）则忽略并留待系统清理。
    """
    import app.models  # noqa: F401  # 注册全部 ORM 表到 Base/FeedbackBase/OpsBase.metadata
    from app.database import (
        Base,
        OpsBase,
        analytics_engine,
        ensure_schema,
        feedback_engine,
        ops_engine,
    )

    Base.metadata.create_all(bind=analytics_engine)
    OpsBase.metadata.create_all(bind=ops_engine)  # 埋点/后台/错误上报运维表也落到临时 ops.db
    ensure_schema()
    yield
    analytics_engine.dispose()
    feedback_engine.dispose()
    ops_engine.dispose()
    # 注：SQLite 文件锁在个别 Windows/驱动组合下可能残留，删除失败可安全忽略
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)


@pytest.fixture(scope="session")
def chart_snapshot() -> dict:
    """完整 chart 快照（fixtures/chart.json），session 内读一次复用。"""
    if not CHART_JSON_PATH.exists():
        pytest.fail(f"缺少 chart 快照: {CHART_JSON_PATH}")
    with open(CHART_JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(autouse=True)
def clean_register_limits(orchestration_env):
    """每个用例开始前清空 register_limits（注册限流计数表）。

    为什么需要：TestClient 发出的所有请求 client.host 都是同一个假 IP
    （"testclient"），且全套 e2e 共用 conftest 的同一个会话级临时 analytics 库；
    跨用例累计注册会让第 3 次 register 撞上“同一 IP 1 小时最多 2 次”的限流而误红。
    e2e 用例验证的是注册→业务主链路而非限流本身，故以“每例前清表”隔离计数
    （单个用例内最多 2 次 register，本就达不到 >=3 才触发的 IP 阈值）。
    """
    from app.database import AnalyticsSession
    from app.models import RegisterLimit

    session = AnalyticsSession()
    try:
        session.query(RegisterLimit).delete()
        session.commit()
    finally:
        session.close()
    yield


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

            # 计费接入后 run_duan_qian_chen / run_predict 入口会 check_balance；
            # 测试直接建 User（未走 register 赠送余额），故在此预充余额，让编排回归
            # 走"已充值用户正常执行"路径（与架构 §4.4 注册送余额同口径）。
            from app.credits.service import recharge
            recharge(user.id, 100, "free", note="pytest 预充余额")

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
