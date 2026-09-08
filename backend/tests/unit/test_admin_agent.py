# -*- coding: utf-8 -*-
"""后台 Agent 运维端点契约测试（REQ-050，/admin/agent/*）。

覆盖（TestClient + 临时库，不触真实 DB/prompts）：
  1. 鉴权：未配置 token → 401；错 token → 401；admin JWT 不可用（agent 与 admin
     两套互不可用）；正确 token → 放行；
  2. 查看类：GET /agent/health（与 /api/health 同构）、GET /agent/users（含余额）、
     GET /agent/reports/{metric}、GET /agent/errors（含 aggregate 兜底）；
  3. 高风险写端点（余额调整 / 重置密码 / 重置 case）：业务生效 + data
     requires_confirmation=true + 审计 admin_user_id=0 + detail 前缀 "[agent]"；
  4. 参数校验：非法 metric / 金额 0 / 不存在 user/case → 400/404 业务码。

依赖 conftest 的会话级临时库（orchestration_env）。

⚠️ 测试隔离说明：require_agent 运行时读 settings.agent_api_token（属性访问），
故用 autouse fixture 直接设 settings 属性注入测试 token——不依赖 os.environ 注入
时机（其他测试文件可能在模块收集期已 import app.config 定格 settings，env 方案
在混跑时会因 e2e 先 import app 而失效）。
"""
from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

AGENT_TOKEN = "test-agent-token-4e2a"
AGENT_H = {"Authorization": f"Bearer {AGENT_TOKEN}"}


@pytest.fixture(autouse=True)
def _agent_token_enabled(monkeypatch):
    """每用例默认启用 agent token；需测「未配置→401」的用例自行置空。"""
    from app.config import settings

    monkeypatch.setattr(settings, "agent_api_token", AGENT_TOKEN)
    yield


# ------------------------------------------------------------ 工具 ----
def _new_user() -> int:
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"ag_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int) -> int:
    from app.database import AnalyticsSession
    from app.models import Case, CaseStatus

    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, input_json={"question": "事业运势"},
                    status=CaseStatus.paipan_done)
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _credit_balance(uid: int) -> int:
    from app.database import AnalyticsSession
    from app.models import CreditAccount

    session = AnalyticsSession()
    try:
        acc = session.query(CreditAccount).filter_by(user_id=uid).first()
        return acc.balance if acc else 0
    finally:
        session.close()


def _audit_rows(action: str):
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        return (session.query(AdminAuditLog)
                .filter_by(action=action).all())
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _clean_agent_state():
    """每用例前清理 agent 相关审计行，避免跨用例数量断言漂移。"""
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        session.query(AdminAuditLog).delete()
        session.commit()
    finally:
        session.close()
    yield


@pytest.fixture()
def agent_client():
    """真实 FastAPI app 的 TestClient（admin 路由已挂载）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 用例 ----
def test_agent_auth_required_and_wrong_token(agent_client, monkeypatch):
    """缺 token / 错 token / admin JWT → 401；未配置 token 通道禁用 401；
    正确 agent token → 200。"""
    # 缺 Authorization → 401
    r = agent_client.get("/admin/agent/health")
    assert r.status_code == 401, r.text
    # 错 token → 401（Bearer 内容不符）
    r = agent_client.get("/admin/agent/health",
                         headers={"Authorization": "Bearer wrong-token"})
    assert r.status_code == 401, r.text
    # admin JWT 不可用于 agent 通道（两套 token 互不可用）→ 401
    from app.admin.auth import create_admin_token

    r = agent_client.get("/admin/agent/health",
                         headers={"Authorization": "Bearer " + create_admin_token(1, "admin")})
    assert r.status_code == 401, r.text
    # 未配置 token（agent_api_token 置空）→ 401「通道未启用」
    from app.config import settings

    monkeypatch.setattr(settings, "agent_api_token", "")
    r = agent_client.get("/admin/agent/health", headers=AGENT_H)
    assert r.status_code == 401, r.text
    assert "Agent" in r.json()["message"]
    # 正确 token → 200
    monkeypatch.setattr(settings, "agent_api_token", AGENT_TOKEN)
    r = agent_client.get("/admin/agent/health", headers=AGENT_H)
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"status": "ok", "version": "0.1.0"}


def test_agent_health_equivalence(agent_client):
    """/agent/health 与 C 端 /api/health 同构（status=ok + 同 version）。"""
    r_agent = agent_client.get("/admin/agent/health", headers=AGENT_H)
    r_api = agent_client.get("/api/health")
    assert r_agent.status_code == 200 and r_api.status_code == 200
    assert r_agent.json()["data"]["status"] == r_api.json()["status"] == "ok"
    assert r_agent.json()["data"]["version"] == r_api.json()["version"]


def test_agent_users_search_with_balance(agent_client):
    """GET /agent/users：模糊搜用户名 + 返回余额；无匹配 → 空列表不报错。"""
    uid = _new_user()
    from app.credits.service import recharge

    recharge(uid, 66, "free", note="agent 测试预充")

    r = agent_client.get("/admin/agent/users", headers=AGENT_H)
    assert r.status_code == 200, r.text
    items = r.json()["data"]["items"]
    # 新用户应能在列表中被搜到（limit 50 内，按 id 倒序 —— uid 最大应在首屏）
    assert any(it["id"] == uid and it["balance"] == 66 for it in items)

    # 特定前缀搜索（用用户名唯一片段）
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        username = session.query(User).filter_by(id=uid).first().username
    finally:
        session.close()
    r = agent_client.get("/admin/agent/users", params={"q": username[:10]}, headers=AGENT_H)
    assert r.status_code == 200, r.text
    hit = [it for it in r.json()["data"]["items"] if it["id"] == uid]
    assert hit and hit[0]["username"] == username and hit[0]["balance"] == 66


def test_agent_reports_metric_and_invalid(agent_client):
    """GET /agent/reports/{metric}：合法 metric 200（结构含 items）；非法 metric 400。"""
    for metric in ("overview", "funnel", "llm_cost", "errors"):
        r = agent_client.get(f"/admin/agent/reports/{metric}", headers=AGENT_H)
        assert r.status_code == 200, f"{metric}: {r.text}"
        data = r.json()["data"]
        assert data["metric"] == metric and isinstance(data["items"], list)

    r = agent_client.get("/admin/agent/reports/bogus", headers=AGENT_H)
    assert r.status_code == 400, r.text
    assert r.json()["code"] == 1001


def test_agent_errors_endpoint_shape(agent_client):
    """GET /agent/errors：200，含 items + aggregate 兜底 + note。"""
    r = agent_client.get("/admin/agent/errors", headers=AGENT_H)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert isinstance(data["items"], list)
    assert data["aggregate"]["metric"] == "errors"
    assert data["note"]


def test_agent_manual_credit_high_risk_and_audit(agent_client):
    """POST /agent/credits/manual：余额充值（元口径 ×10 落存储单位）+ 扣减均生效 +
    requires_confirmation=true + 审计 admin_user_id=0 + detail 含 [agent]；
    amount_yuan=0 → 400。"""
    uid = _new_user()
    before = _credit_balance(uid)

    # 正数=余额充值：¥5 → 50 存储单位
    r = agent_client.post("/admin/agent/credits/manual",
                          json={"user_id": uid, "amount_yuan": 5.0, "note": "测试充值"},
                          headers=AGENT_H)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["balance"] == before + 50
    assert data["balance_yuan"] == (before + 50) / 10
    assert data["requires_confirmation"] is True

    audits = _audit_rows("credit_manual")
    assert len(audits) == 1
    assert audits[0].admin_user_id == 0
    assert audits[0].detail.startswith("[agent]")
    assert f"user_id={uid}" in audits[0].detail

    # 负数=余额扣减：¥-2.5 → -25 存储单位（支持增与减）
    r = agent_client.post("/admin/agent/credits/manual",
                          json={"user_id": uid, "amount_yuan": -2.5, "note": "测试扣减"},
                          headers=AGENT_H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["balance"] == before + 50 - 25
    assert len(_audit_rows("credit_manual")) == 2

    # 金额为 0 → 400（不落账不审计）
    r = agent_client.post("/admin/agent/credits/manual",
                          json={"user_id": uid, "amount_yuan": 0}, headers=AGENT_H)
    assert r.status_code == 400, r.text
    assert _credit_balance(uid) == before + 50 - 25
    assert len(_audit_rows("credit_manual")) == 2


def test_agent_reset_password_high_risk(agent_client):
    """POST /agent/ops/users/{id}/reset-password：密码更新 + requires_confirmation +
    审计 [agent]；不存在用户 → 1002。"""
    from app.auth.router import hash_password, verify_password
    from app.database import AnalyticsSession
    from app.models import User

    uid = _new_user()
    session = AnalyticsSession()
    try:
        session.query(User).filter_by(id=uid).update({"password_hash": hash_password("old-pass")})
        session.commit()
    finally:
        session.close()

    r = agent_client.post(f"/admin/agent/ops/users/{uid}/reset-password",
                          json={"new_password": "new-pass-9x"}, headers=AGENT_H)
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"reset": True, "requires_confirmation": True}

    session = AnalyticsSession()
    try:
        hashed = session.query(User).filter_by(id=uid).first().password_hash
    finally:
        session.close()
    assert verify_password("new-pass-9x", hashed) is True
    assert verify_password("old-pass", hashed) is False

    audits = _audit_rows("reset_password")
    assert len(audits) == 1 and audits[0].admin_user_id == 0
    assert audits[0].detail.startswith("[agent]")

    # 不存在用户 → code 1002
    r = agent_client.post("/admin/agent/ops/users/999999/reset-password",
                          json={"new_password": "whatever"}, headers=AGENT_H)
    assert r.status_code == 400, r.text
    assert r.json()["code"] == 1002


def test_agent_reset_case_high_risk(agent_client):
    """POST /agent/ops/users/{id}/reset-case：删子表 + case status=created +
    requires_confirmation + 审计；case 非本人/不存在 → 1002。"""
    from app.database import AnalyticsSession
    from app.models import Case, CaseStatus

    uid = _new_user()
    other = _new_user()
    cid = _new_case(uid)
    other_cid = _new_case(other)

    r = agent_client.post(f"/admin/agent/ops/users/{uid}/reset-case",
                          json={"case_id": cid}, headers=AGENT_H)
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"reset": True, "requires_confirmation": True}

    session = AnalyticsSession()
    try:
        case = session.query(Case).filter_by(id=cid).first()
        assert case.status == CaseStatus.created
    finally:
        session.close()

    audits = _audit_rows("reset_case")
    assert len(audits) == 1 and audits[0].admin_user_id == 0
    assert audits[0].detail.startswith("[agent]")

    # 他人 case → 404 HTTP（3xxx case 段映射 404，code=3001；区别于 1xxx 通用段 400）
    r = agent_client.post(f"/admin/agent/ops/users/{uid}/reset-case",
                          json={"case_id": other_cid}, headers=AGENT_H)
    assert r.status_code == 404, r.text
    assert r.json()["code"] == 3001
