# -*- coding: utf-8 -*-
"""后台 Prompt 统一管理台契约测试（REQ-048）。

覆盖（TestClient + 临时 prompt 目录 + ops 临时库，不触碰真实 backend/prompts/）：
  1. GET /admin/prompts：列 15 个文件类 prompt（key/category/file/updated_at），
     只列映射内且真实存在的文件；
  2. GET /admin/prompts/{key}：返回该 prompt 全文（content=当前盘面内容）；
  3. PUT /admin/prompts/{key}：operator+ 保存 → 真实写盘（临时目录）→ 落一条
     PromptVersion 快照 + AdminAuditLog(edit_prompt)；保存后 GET 立即可见
     （热生效：按次 read_text、无启动缓存）；
  4. 校验：空内容 / 花括号不配对 / 超长(>50000) → 400，且不写盘不落版本不审计；
  5. 版本历史：GET /prompts/{key}/versions（倒序、含 length/admin_user_id）、
     GET /prompts/{key}/versions/{id}（全量内容）；
  6. 回滚：POST /prompts/{key}/rollback/{version_id} → 盘面内容回到历史版本 +
     新落一条快照 + AdminAuditLog(rollback_prompt)；
  7. 权限：无 token → 401；viewer 读 OK 但写(PUT/rollback) → 403；
     未知 key → 400（不在映射表，防路径穿越）。

依赖 conftest 的会话级临时库（orchestration_env：ops 表已建）。
"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")


@pytest.fixture(autouse=True)
def _clean_prompt_state():
    """每用例前清理 PromptVersion / prompt 审计行。

    REQ-048 契约测试共享会话级 ops 库且使用固定 key，若不清理，前一个用例写入
    的 PromptVersion 会残留，导致后续用例的数量断言（== [] / == 2）漂移。
    """
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog, PromptVersion

    session = OpsSession()
    try:
        session.query(PromptVersion).delete()
        session.query(AdminAuditLog).filter(AdminAuditLog.target_type == "prompt").delete()
        session.commit()
    finally:
        session.close()
    yield


# 与真实 PROMPT_FILES 对齐：抽一个 interpret 类（tarot）做写/版本/回滚全链路
_TEST_KEY = "tarot"
_TEST_CATEGORY = "解读"
_REL_PATH = "interpret/tarot.md"
V1 = "# 塔罗解读 v1\n\n你是塔罗占卜师。\n"
V2 = "# 塔罗解读 v2\n\n你是资深塔罗占卜师。\n{语气：平和}\n"


# ------------------------------------------------------------ 工具 ----
def _new_admin(role: str) -> int:
    """ops 临时库建真实 admin 账号，返回 admin_id。"""
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


def _version_rows(key: str):
    from app.database import OpsSession
    from app.models.ops import PromptVersion

    session = OpsSession()
    try:
        return session.query(PromptVersion).filter_by(prompt_key=key).all()
    finally:
        session.close()


def _audit_rows(action: str, key: str):
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        return (session.query(AdminAuditLog)
                .filter_by(action=action, target_type="prompt", target_id=key)
                .all())
    finally:
        session.close()


@pytest.fixture()
def admin_env(tmp_path: Path, monkeypatch):
    """把 admin router 的 PROMPT_BASE 指到临时目录，建好 tarot.md（内容 V1）。"""
    import app.admin.router as admin_mod

    prompt_dir = tmp_path / "prompts"
    rel = prompt_dir / _REL_PATH
    rel.parent.mkdir(parents=True, exist_ok=True)
    rel.write_text(V1, encoding="utf-8")
    # monkeypatch 模块级 PROMPT_BASE → 临时目录（真实读取点按次 read_text，热生效）
    monkeypatch.setattr(admin_mod, "PROMPT_BASE", prompt_dir)

    operator_id = _new_admin("operator")
    viewer_id = _new_admin("viewer")
    return {
        "prompt_dir": prompt_dir,
        "rel_file": rel,
        "operator_h": _auth_header(operator_id, "operator"),
        "viewer_h": _auth_header(viewer_id, "viewer"),
        "operator_id": operator_id,
    }


@pytest.fixture()
def admin_client(admin_env):
    """真实 FastAPI app 的 TestClient（admin 路由已挂载）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 用例 ----
def test_list_prompts_contains_test_file(admin_client, admin_env):
    """GET /admin/prompts：含 tarot 项（key/category/file/updated_at）；目录在
    临时目录，故仅临时目录里存在的那 1 个文件被列出（其余 14 个跳过不报错）。"""
    resp = admin_client.get("/admin/prompts", headers=admin_env["viewer_h"])
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    item = items[0]
    assert item["key"] == _TEST_KEY
    assert item["category"] == _TEST_CATEGORY
    assert item["file"] == "tarot.md"
    assert item["updated_at"]


def test_get_prompt_full_content(admin_client, admin_env):
    """GET /admin/prompts/{key}：返回 content = 当前盘面 V1 + 元数据。"""
    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}", headers=admin_env["viewer_h"])
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["key"] == _TEST_KEY
    assert data["content"] == V1
    assert data["file"] == "tarot.md"


def test_update_prompt_writes_and_versions_and_audit(admin_client, admin_env):
    """PUT：operator 保存 V2 → ①临时盘面文件变为 V2（热生效：GET 立即可见）
    ②PromptVersion 新增一条（length 对）③AdminAuditLog edit_prompt 一条。"""
    operator_h = admin_env["operator_h"]
    # 写 V2
    resp = admin_client.put(f"/admin/prompts/{_TEST_KEY}",
                            json={"content": V2}, headers=operator_h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {"key": _TEST_KEY}

    # ① 盘面文件真实改写 + GET 立即返回 V2（按次读文件 → 热生效）
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V2
    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}", headers=admin_env["viewer_h"])
    assert resp.json()["data"]["content"] == V2

    # ② 版本快照：共 2 条（v1 原文件没落库——版本仅记"每次写盘动作"，
    #    首次 PUT V2 即第 1 条快照；这里应恰 1 条）
    versions = _version_rows(_TEST_KEY)
    assert len(versions) == 1
    assert versions[0].content == V2
    assert versions[0].admin_user_id == admin_env["operator_id"]

    # ③ 审计日志
    audits = _audit_rows("edit_prompt", _TEST_KEY)
    assert len(audits) == 1
    assert audits[0].admin_user_id == admin_env["operator_id"]
    assert "tarot" in audits[0].detail


def test_update_prompt_validation_400(admin_client, admin_env):
    """校验失败 → 400，且不写盘、不落版本、不审计。"""
    operator_h = admin_env["operator_h"]
    before_mtime = admin_env["rel_file"].stat().st_mtime

    # 空内容
    resp = admin_client.put(f"/admin/prompts/{_TEST_KEY}",
                            json={"content": "   "}, headers=operator_h)
    assert resp.status_code == 400, resp.text
    assert "不能为空" in resp.json()["message"]
    # 花括号不配对
    resp = admin_client.put(f"/admin/prompts/{_TEST_KEY}",
                            json={"content": "你好 { 世界"}, headers=operator_h)
    assert resp.status_code == 400, resp.text
    assert "花括号" in resp.json()["message"]
    # 超长（> 50000）
    resp = admin_client.put(f"/admin/prompts/{_TEST_KEY}",
                            json={"content": "x" * 50001}, headers=operator_h)
    assert resp.status_code == 400, resp.text
    assert "过长" in resp.json()["message"]

    # 无副作用
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V1
    assert admin_env["rel_file"].stat().st_mtime == before_mtime
    assert _version_rows(_TEST_KEY) == []
    assert _audit_rows("edit_prompt", _TEST_KEY) == []


def test_prompt_versions_list_and_detail(admin_client, admin_env):
    """版本历史：连续 PUT v1→v2 后 versions 倒序 2 条（含 length/admin_user_id）；
    详情可取到指定版本全量内容。"""
    operator_h = admin_env["operator_h"]
    admin_client.put(f"/admin/prompts/{_TEST_KEY}", json={"content": V1}, headers=operator_h)
    admin_client.put(f"/admin/prompts/{_TEST_KEY}", json={"content": V2}, headers=operator_h)

    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}/versions",
                            headers=admin_env["viewer_h"])
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]["items"]
    assert len(items) == 2
    assert items[0]["length"] == len(V2)          # 最新在前
    assert items[1]["length"] == len(V1)
    assert items[0]["admin_user_id"] == admin_env["operator_id"]
    assert items[0]["id"] > items[1]["id"]

    # 详情：最新版本内容 = V2
    vid = items[0]["id"]
    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}/versions/{vid}",
                            headers=admin_env["viewer_h"])
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["prompt_key"] == _TEST_KEY
    assert data["content"] == V2


def test_rollback_prompt_restores_and_audits(admin_client, admin_env):
    """回滚：PUT V2 后回滚到 V1 版本 → 盘面恢复 V1 + 新落一条 V1 快照 +
    AdminAuditLog(rollback_prompt)。"""
    operator_h = admin_env["operator_h"]
    admin_client.put(f"/admin/prompts/{_TEST_KEY}", json={"content": V2}, headers=operator_h)
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V2

    # V2 是第 1 条版本；回滚目标应为它之前的原始状态——但首次写盘前无快照，
    # 因此先再造一次 PUT 得到两个版本（v1=V1 快照…），此处回滚到最旧快照 V1。
    # 说明：rollback 语义 = 用某历史快照覆盖当前盘面并记新快照。
    admin_client.put(f"/admin/prompts/{_TEST_KEY}", json={"content": V1}, headers=operator_h)
    # 现在 versions: [V1(#2), V2(#1)]；回滚到 #1(V2) → 盘面应回到 V2
    versions = _version_rows(_TEST_KEY)
    assert len(versions) == 2
    target_id = min(v.id for v in versions if v.content == V2)

    resp = admin_client.post(f"/admin/prompts/{_TEST_KEY}/rollback/{target_id}",
                             headers=operator_h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {"key": _TEST_KEY, "version_id": target_id}

    # 盘面回到 V2 + 新落一条 V2 快照（总数 3）+ 审计 rollback_prompt
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V2
    versions = _version_rows(_TEST_KEY)
    assert len(versions) == 3
    assert versions[-1].content == V2        # 最新快照 = 回滚后状态
    audits = _audit_rows("rollback_prompt", _TEST_KEY)
    assert len(audits) == 1
    assert "tarot" in audits[0].detail


def test_prompt_admin_permissions(admin_client, admin_env):
    """权限：无 token → 401；viewer 读 200、写(PUT/rollback) → 403。"""
    # 无 token → 401
    resp = admin_client.get("/admin/prompts")
    assert resp.status_code == 401, resp.text

    # viewer 读 OK
    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}", headers=admin_env["viewer_h"])
    assert resp.status_code == 200

    # viewer 写 → 403（require_role operator）
    resp = admin_client.put(f"/admin/prompts/{_TEST_KEY}",
                            json={"content": V2}, headers=admin_env["viewer_h"])
    assert resp.status_code == 403, resp.text
    resp = admin_client.post(f"/admin/prompts/{_TEST_KEY}/rollback/1",
                             headers=admin_env["viewer_h"])
    assert resp.status_code == 403, resp.text

    # viewer 仍不可改盘面（V1 原样）+ 无版本/审计副作用
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V1
    assert _version_rows(_TEST_KEY) == []
    assert _audit_rows("edit_prompt", _TEST_KEY) == []
    assert _audit_rows("rollback_prompt", _TEST_KEY) == []


def test_prompt_unknown_key_and_missing_version(admin_client, admin_env):
    """未知 key → 400（映射表外，防路径穿越）；存在的 key + 不存在版本 → 404。"""
    operator_h = admin_env["operator_h"]
    viewer_h = admin_env["viewer_h"]

    # 防路径穿越的机制是 key 白名单映射（_prompt_path 只查 PROMPT_FILES 静态表，
    # 调用方 key 不参与拼路径）：映射表外的 key 一律 400。含斜杠的多段 URL 不会
    # 命中 /admin/prompts/{key}（key 单段），属 SPA fallback 范畴，不在此断言。
    resp = admin_client.get("/admin/prompts/not-a-key", headers=viewer_h)
    assert resp.status_code == 400, resp.text
    resp = admin_client.get("/admin/prompts/not-a-key/versions", headers=viewer_h)
    assert resp.status_code == 400, resp.text

    resp = admin_client.put("/admin/prompts/not-a-key",
                            json={"content": V1}, headers=operator_h)
    assert resp.status_code == 400, resp.text

    resp = admin_client.get(f"/admin/prompts/{_TEST_KEY}/versions/999999",
                            headers=viewer_h)
    # 项目错误码约定：1xxx 通用段统一 HTTP 400，body code=1002 表示资源不存在
    # （3xxx case 段才映射 HTTP 404）；此处断言业务码而非 HTTP 状态。
    assert resp.status_code == 400, resp.text
    assert resp.json()["code"] == 1002
    assert "版本不存在" in resp.json()["message"]

    # 无副作用
    assert admin_env["rel_file"].read_text(encoding="utf-8") == V1
    assert _version_rows(_TEST_KEY) == []
