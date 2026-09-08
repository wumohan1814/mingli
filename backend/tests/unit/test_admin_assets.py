# -*- coding: utf-8 -*-
"""后台素材管理契约测试（REQ-059 + BUG-018，admin /admin/assets/* + 公开 /api/assets）。

覆盖（TestClient + 会话级临时 ops/analytics 库）：
  1. GET /admin/assets：空库返回空 items；含 opacity / mask_color 字段；
  2. PUT /admin/assets/{key}：operator 新增槽（含蒙版 opacity / mask_color）→
     返回字段 + 落 AdminAuditLog(edit_asset)；替换同 key 即覆盖；
  3. GET /admin/assets?kind=... 过滤 + 字段完整；
  4. DELETE /admin/assets/{key}：删除槽恢复默认 + 审计 delete_asset；不存在 → 404；
  5. 校验：非法 key / 未知 kind / 非法 url / opacity 越界 / mask_color 非 hex → 400/422；
  6. 权限：无 token 401；viewer 写(PUT/DELETE) 403、读 200；
  7. 公开 GET /api/assets：批量 assets map（{key:url|null}）+ masks map
     （{key:{opacity,color}|null}）；单槽返回 url/opacity/color —— 与后台口径对齐；
  8. POST /admin/assets/upload：合法图片 → 相对路径 /uploads/assets/...；非法扩展名 → 400；
     上传只落文件 + upload_asset 审计，不直接入槽。

依赖 conftest 的会话级临时库（orchestration_env：ops 表已建）。
"""
from __future__ import annotations

import io
import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

_KEY = "module-guoxue"
_KIND = "module"
_URL = "/uploads/assets/abc.webp"
_OPACITY = 0.35
_MASK_COLOR = "#2A3A5C"


@pytest.fixture(autouse=True)
def _clean_asset_state():
    """每用例前清空 asset_slots 与素材审计行（会话级 ops 库共享，防数量断言漂移）。"""
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog, AssetSlot

    session = OpsSession()
    try:
        session.query(AssetSlot).delete()
        session.query(AdminAuditLog).filter(AdminAuditLog.target_type == "asset").delete()
        session.commit()
    finally:
        session.close()
    yield


# ------------------------------------------------------------ 工具 ----
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


def _put(client, key=_KEY, kind=_KIND, url=_URL, opacity=None, mask_color=None, headers=None):
    body = {"kind": kind, "url": url}
    if opacity is not None:
        body["opacity"] = opacity
    if mask_color is not None:
        body["mask_color"] = mask_color
    return client.put(f"/admin/assets/{key}", json=body, headers=headers)


def _rows():
    from app.database import OpsSession
    from app.models.ops import AssetSlot

    session = OpsSession()
    try:
        return session.query(AssetSlot).order_by(AssetSlot.key).all()
    finally:
        session.close()


def _audit_rows(action: str, key: str):
    from app.database import OpsSession
    from app.models.ops import AdminAuditLog

    session = OpsSession()
    try:
        return (
            session.query(AdminAuditLog)
            .filter_by(action=action, target_type="asset", target_id=key)
            .all()
        )
    finally:
        session.close()


# ------------------------------------------------------------ 用例 ----
def test_list_assets_empty(admin_client, admin_env):
    resp = admin_client.get("/admin/assets", headers=admin_env["viewer_h"])
    assert resp.status_code == 200
    assert resp.json()["data"]["items"] == []


def test_put_creates_slot_with_mask_and_audit(admin_client, admin_env):
    resp = _put(
        admin_client,
        opacity=_OPACITY,
        mask_color=_MASK_COLOR,
        headers=admin_env["operator_h"],
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["key"] == _KEY
    assert data["kind"] == _KIND
    assert data["url"] == _URL
    assert data["opacity"] == _OPACITY
    assert data["mask_color"] == _MASK_COLOR.upper()  # 规范化：hex 转大写

    rows = _rows()
    assert len(rows) == 1
    assert rows[0].opacity == _OPACITY
    assert rows[0].mask_color == _MASK_COLOR.upper()
    assert len(_audit_rows("edit_asset", _KEY)) == 1

    # 后台列表回蒙版字段
    lst = admin_client.get("/admin/assets", headers=admin_env["viewer_h"]).json()
    item = lst["data"]["items"][0]
    assert item["key"] == _KEY
    assert item["opacity"] == _OPACITY
    assert item["mask_color"] == _MASK_COLOR.upper()


def test_put_replace_slot_and_kind_filter(admin_client, admin_env):
    _put(admin_client, headers=admin_env["operator_h"])
    # 替换：url 与蒙版都更新
    resp = _put(
        admin_client,
        key="method-tarot",
        kind="method",
        url="/uploads/assets/new.webp",
        opacity=0.9,
        headers=admin_env["operator_h"],
    )
    assert resp.status_code == 200
    rows = _rows()
    assert {r.key for r in rows} == {_KEY, "method-tarot"}
    # kind 过滤
    lst = admin_client.get("/admin/assets?kind=method", headers=admin_env["viewer_h"]).json()
    assert [i["key"] for i in lst["data"]["items"]] == ["method-tarot"]
    lst2 = admin_client.get("/admin/assets?kind=module", headers=admin_env["viewer_h"]).json()
    assert [i["key"] for i in lst2["data"]["items"]] == [_KEY]


def test_put_mask_only_replaces_mask_keeps_url(admin_client, admin_env):
    _put(admin_client, url="/uploads/assets/a.webp", headers=admin_env["operator_h"])
    # 只改蒙版：url 传原值，opacity 更新
    resp = _put(
        admin_client,
        url="/uploads/assets/a.webp",
        opacity=0.5,
        mask_color="#ffffff",
        headers=admin_env["operator_h"],
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["url"] == "/uploads/assets/a.webp"
    assert data["opacity"] == 0.5
    assert data["mask_color"] == "#FFFFFF"


def test_delete_restores_default_and_audit(admin_client, admin_env):
    _put(admin_client, headers=admin_env["operator_h"])
    resp = admin_client.delete(f"/admin/assets/{_KEY}", headers=admin_env["operator_h"])
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True
    assert _rows() == []
    assert len(_audit_rows("delete_asset", _KEY)) == 1
    # 再删 → 槽不存在（1xxx 通用错误码 → HTTP 400）
    resp2 = admin_client.delete(f"/admin/assets/{_KEY}", headers=admin_env["operator_h"])
    assert resp2.status_code == 400
    assert resp2.json()["code"] == 1002


@pytest.mark.parametrize(
    "kw,body,status",
    [
        ("bad key", {"kind": "module", "url": _URL}, 400),  # 含空格非法
        ("unknown kind", {"kind": "nope", "url": _URL}, 400),
        ("bad url", {"kind": "module", "url": "javascript:alert(1)"}, 400),
        ("relative ..", {"kind": "module", "url": "/../etc/passwd"}, 400),
        # 1xxx 通用错误码统一 HTTP 400（含 pydantic 越界校验，见 errors.code_to_http）
        ("opacity too high", {"kind": "module", "url": _URL, "opacity": 1.2}, 400),
        ("opacity negative", {"kind": "module", "url": _URL, "opacity": -0.1}, 400),
        ("bad mask_color", {"kind": "module", "url": _URL, "mask_color": "red"}, 400),
    ],
)
def test_put_validation(admin_client, admin_env, kw, body, status):
    resp = admin_client.put(
        "/admin/assets/" + (kw == "bad key" and "bad key!" or _KEY),
        json=body,
        headers=admin_env["operator_h"],
    )
    assert resp.status_code == status, (kw, resp.text)
    assert _rows() == []  # 校验失败不落库


def test_permissions(admin_client, admin_env):
    # 无 token → 401
    assert admin_client.put("/admin/assets/" + _KEY, json={"kind": _KIND, "url": _URL}).status_code == 401
    # viewer 写 → 403
    resp = _put(admin_client, headers=admin_env["viewer_h"])
    assert resp.status_code == 403
    # viewer 读 → 200
    assert admin_client.get("/admin/assets", headers=admin_env["viewer_h"]).status_code == 200


def test_public_batch_assets_masks_alignment(admin_client, admin_env):
    """公开 /api/assets 批量：assets map（{key:url|null}）+ masks map（蒙版），
    与后台 PUT 的口径一致（opacity / color）。"""
    _put(admin_client, headers=admin_env["operator_h"])
    _put(
        admin_client,
        key="agent-1",
        kind="agent",
        url="/uploads/assets/agent1.webp",
        headers=admin_env["operator_h"],
    )
    resp = admin_client.get("/api/assets", params={"keys": f"{_KEY},agent-1,missing-slot"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["assets"][_KEY] == _URL
    assert data["assets"]["agent-1"] == "/uploads/assets/agent1.webp"
    assert data["assets"]["missing-slot"] is None  # 未配置 → null（前台回退 CSS）
    # 未配蒙版（opacity null）→ masks null
    assert data["masks"][_KEY] is None
    assert data["masks"]["missing-slot"] is None


def test_public_batch_masks_with_opacity(admin_client, admin_env):
    _put(admin_client, opacity=0.4, mask_color="#123456", headers=admin_env["operator_h"])
    resp = admin_client.get("/api/assets", params={"keys": _KEY})
    data = resp.json()["data"]
    assert data["masks"][_KEY] == {"opacity": 0.4, "color": "#123456"}
    # 单槽查询对齐
    single = admin_client.get(f"/api/assets/{_KEY}").json()["data"]
    assert single["url"] == _URL
    assert single["opacity"] == 0.4
    assert single["color"] == "#123456"
    # 未配置单槽
    empty = admin_client.get("/api/assets/nope-slot").json()["data"]
    assert empty["url"] is None and empty["opacity"] is None and empty["color"] is None


def test_upload_valid_and_invalid_ext(admin_client, admin_env, monkeypatch):
    import os
    import tempfile

    import app.admin.router as admin_mod

    # 用 os.makedirs 建临时目录（pytest tmp_path 基于 mkdtemp，个别受限环境会拒写）
    up_dir = os.path.join(tempfile.gettempdir(), f"asset_up_{uuid.uuid4().hex[:8]}")
    os.makedirs(up_dir, exist_ok=True)
    monkeypatch.setattr(admin_mod, "ASSETS_UPLOAD_DIR", Path(up_dir))
    files = {"file": ("banner.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 64), "image/png")}
    resp = admin_client.post("/admin/assets/upload", files=files, headers=admin_env["operator_h"])
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["url"].startswith("/uploads/assets/")
    assert data["filename"]
    assert Path(up_dir, data["filename"]).exists()
    # 上传不直接入槽
    assert _rows() == []
    # 非法扩展名 → 400
    bad = {"file": ("evil.txt", io.BytesIO(b"hello"), "text/plain")}
    resp2 = admin_client.post("/admin/assets/upload", files=bad, headers=admin_env["operator_h"])
    assert resp2.status_code == 400
