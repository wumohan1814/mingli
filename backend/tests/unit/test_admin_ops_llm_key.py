# -*- coding: utf-8 -*-
"""后台运维端点 POST /admin/ops/llm-key 的 fail-loud 契约测试（2026-09-21）。

背景（为什么这个端点的契约是「拒绝」而不是「写入」）：LLM key 已改为**系统环境
变量**注入（`MINGLI_LLM_API_KEY`；pydantic-settings 源顺序 = 环境变量 > `.env`）。
端点若继续改写 `backend/.env`，会造成 ① 项目内重新出现 key 文件（违反「项目内零
key 文件」红线）② 环境变量已设时**写了却不生效**的静默失败（运维以为换了 key）。

覆盖（用户拍板的处理方式 = fail loud，路由与请求体形状保持不变）：
  1. 正文合法（operator+）→ 明确拒绝：既有错误信封 + 既有错误码 ERR_CONFLICT(1003)，
     detail 给出环境变量设置指引（Windows setx / Linux export）+ 重启提示；
  2. **不写 .env**：把端点会用的 ENV_FILE 指向临时文件（内含 `MINGLI_LLM_API_KEY=`
     占位行，即“若真写入必被改写”的探针），调用后内容逐字节不变；提交的 key 文本
     不出现在文件里；真实 `backend/.env` 亦逐字节不变；
  3. ENV_FILE 不存在时调用 → 仍然拒绝、且**不会新建**该文件（杜绝重新长出 key 文件）；
  4. 留痕：失败路径仍落一条 AdminAuditLog(action=change_llm_key, target_type=env,
     target_id=MINGLI_LLM_API_KEY)，detail **不含提交的 key 明文**；
  5. 既有契约不回退：viewer → 403（require_role operator）；空白/含空格的畸形 key
     → 仍为 ERR_PARAM(1001)（形状校验沿用原实现，不被拒绝分支吞掉）。

依赖 conftest 的会话级临时库（orchestration_env：ops 表已建）。本用例**不触碰**
真实 backend/.env 的写路径（只读取字节做前后比对），也不使用任何真实 key 值。
"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

# 探针：临时 .env 里预置该键的占位行 —— 一旦端点恢复写 .env，内容必然变化（断言即红）
_ENV_PROBE = (
    "MINGLI_DB_PATH=data/analytics.db\n"
    "MINGLI_LLM_API_KEY=unit-test-placeholder-not-a-real-key\n"
    "MINGLI_LLM_MODEL=deepseek-v4-flash\n"
)
# 用例提交的“key”文本：明显假值，只用于验证“不回显、不落盘”
_SUBMITTED_KEY = "unit-test-fake-key-must-not-be-stored"
_AUDIT_ACTION = "change_llm_key"


# ------------------------------------------------------------ 夹具/工具 ----
@pytest.fixture(autouse=True)
def _clean_llm_key_audit():
    """每用例前清掉本端点留下的审计行（共享会话级 ops 库 → 计数断言才不会漂移）。"""
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        session.query(AdminAuditLog).filter(AdminAuditLog.action == _AUDIT_ACTION).delete()
        session.commit()
    finally:
        session.close()
    yield


def _new_admin(role: str) -> int:
    from app.auth.router import hash_password
    from app.database import OpsSession
    from app.models.ops import AdminUser

    session = OpsSession()
    try:
        admin = AdminUser(
            username=f"ut_{role}_{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("test-password"),
            role=role,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return admin.id
    finally:
        session.close()


def _auth_header(admin_id: int, role: str) -> dict:
    from app.admin.auth import create_admin_token

    return {"Authorization": f"Bearer {create_admin_token(admin_id, role)}"}


@pytest.fixture()
def admin_env():
    operator_id = _new_admin("operator")
    viewer_id = _new_admin("viewer")
    return {
        "operator_h": _auth_header(operator_id, "operator"),
        "viewer_h": _auth_header(viewer_id, "viewer"),
        "operator_id": operator_id,
    }


@pytest.fixture()
def admin_client(admin_env):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


@pytest.fixture()
def isolated_env_file(tmp_path, monkeypatch):
    """把端点的 ENV_FILE 指向临时探针文件；返回 (探测路径, 真实路径, 初始字节)。

    真实 backend/.env 路径在 monkeypatch **之前**捕获，用于断言它同样未被改写。
    """
    import app.admin.router as admin_router

    real_env = Path(admin_router.ENV_FILE)
    probe = tmp_path / ".env"
    probe.write_text(_ENV_PROBE, encoding="utf-8")
    monkeypatch.setattr(admin_router, "ENV_FILE", probe)
    return probe, real_env, probe.read_bytes()


def _audit_rows():
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        return session.query(AdminAuditLog).filter_by(action=_AUDIT_ACTION).all()
    finally:
        session.close()


def _post(client, headers, api_key=_SUBMITTED_KEY):
    return client.post("/admin/ops/llm-key", json={"api_key": api_key}, headers=headers)


# ------------------------------------------------------------ 用例 ----
def test_refuses_with_existing_envelope_and_guidance(admin_client, admin_env, isolated_env_file):
    """合法请求 → 既有错误信封 + 既有错误码 1003 + 环境变量设置指引。"""
    from app.errors import ERR_CONFLICT, code_to_http

    resp = _post(admin_client, admin_env["operator_h"])
    assert resp.status_code == code_to_http(ERR_CONFLICT), resp.text
    body = resp.json()
    assert body["code"] == ERR_CONFLICT
    assert body["message"]  # 非空错误说明
    detail = body["detail"]
    # detail 是前端 api() 优先展示的字段（admin.html pickMsg）→ 指引必须写在这里
    assert "MINGLI_LLM_API_KEY" in detail
    assert "setx" in detail and "export" in detail
    assert "重启" in detail


def test_does_not_write_env_file(admin_client, admin_env, isolated_env_file):
    """核心红线：调用后不写 .env（探针文件 + 真实 backend/.env 均逐字节不变）。"""
    probe, real_env, before = isolated_env_file
    real_before = real_env.read_bytes() if real_env.exists() else None

    resp = _post(admin_client, admin_env["operator_h"])
    assert resp.status_code != 200

    assert probe.read_bytes() == before, "端点不得改写 ENV_FILE（探针行被改动即回归）"
    assert _SUBMITTED_KEY not in probe.read_text(encoding="utf-8"), "提交的 key 不得落盘"
    if real_before is not None:
        assert real_env.read_bytes() == real_before, "真实 backend/.env 不得被改写"


def test_env_file_absent_is_not_created(admin_client, admin_env, tmp_path, monkeypatch):
    """ENV_FILE 缺失时 → 仍然拒绝，且不新建文件（不再长出 key 文件）。"""
    import app.admin.router as admin_router

    missing = tmp_path / "nope" / ".env"
    monkeypatch.setattr(admin_router, "ENV_FILE", missing)

    resp = _post(admin_client, admin_env["operator_h"])
    assert resp.status_code != 200
    assert resp.json()["code"] == 1003
    assert not missing.exists(), "缺失的 .env 不得被端点创建"


def test_refusal_is_audited_without_key_plaintext(admin_client, admin_env, isolated_env_file):
    """失败路径留痕：既有 action/target 口径 + detail 不含 key 明文。"""
    assert _audit_rows() == []

    resp = _post(admin_client, admin_env["operator_h"])
    assert resp.status_code != 200

    rows = _audit_rows()
    assert len(rows) == 1, "被拒绝的换 key 尝试必须留一条审计"
    row = rows[0]
    assert row.admin_user_id == admin_env["operator_id"]
    assert row.target_type == "env"
    assert row.target_id == "MINGLI_LLM_API_KEY"
    assert _SUBMITTED_KEY not in (row.detail or "")


def test_viewer_forbidden_and_no_audit(admin_client, admin_env, isolated_env_file):
    """权限不回退：viewer → 403（require_role operator），且不产生换 key 审计行。"""
    resp = _post(admin_client, admin_env["viewer_h"])
    assert resp.status_code == 403, resp.text
    assert _audit_rows() == []


@pytest.mark.parametrize("bad_key", ["   ", "has space inside"])
def test_malformed_key_still_err_param(admin_client, admin_env, isolated_env_file, bad_key):
    """形状校验沿用原契约：空白/含空格的 key → ERR_PARAM(1001)，不被拒绝分支吞掉。"""
    resp = _post(admin_client, admin_env["operator_h"], api_key=bad_key)
    assert resp.status_code == 400, resp.text
    assert resp.json()["code"] == 1001
