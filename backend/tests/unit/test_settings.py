# -*- coding: utf-8 -*-
"""功能设置契约测试（REQ-066 · /api/settings，纯本地 DB，零 LLM 零 Node）。

覆盖：
  1. GET 无记录 → 返回 7 项默认值且不落库（user_settings 无行）；
  2. PUT 部分字段 → upsert 建行，未给字段由列默认兜底；二次 PUT 其它字段 →
     只更新显式字段、其余保留；不重复建行；
  3. PUT 全量 → 全量生效，GET 读到同一份存储值；
  4. default_mode 非法 → 400 参数错误信封且不落行；空 body → 不建行返回默认；
  5. 多用户隔离：A 的改动不影响 B；鉴权 400/401。

依赖 conftest 的会话级临时库（orchestration_env）——不触碰真实 backend/data/*.db。
"""
from __future__ import annotations

import uuid

import pytest

from app.errors import ERR_PARAM

pytestmark = pytest.mark.usefixtures("orchestration_env")

DEFAULTS = {
    "anim_enabled": True,
    "default_mode": "auto",
    "banner_dropdown": False,
    "share_mingli_ui": True,
    "bg_enabled": True,
    "card_images": True,
    "agent_enabled": True,
}


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    """临时 analytics 库建真实 user（user_settings.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"settings_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _setting_rows(user_id: int):
    from app.database import AnalyticsSession
    from app.models import UserSetting

    session = AnalyticsSession()
    try:
        return session.query(UserSetting).filter_by(user_id=user_id).all()
    finally:
        session.close()


@pytest.fixture()
def settings_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表）；设置接口不依赖 Node/LLM。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 用例 ----
def test_get_without_row_returns_defaults_not_persisted(settings_client):
    uid = _new_user()
    resp = settings_client.get("/api/settings", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["message"] == "ok"
    assert body["data"]["settings"] == DEFAULTS
    assert _setting_rows(uid) == []  # GET 不落库


def test_put_partial_upsert_then_partial_update(settings_client):
    uid = _new_user()
    # 部分字段 → 建行，未给字段由列 default 兜底
    resp = settings_client.put(
        "/api/settings", json={"default_mode": "manual"}, headers=_auth_header(uid)
    )
    assert resp.status_code == 200, resp.text
    got = resp.json()["data"]["settings"]
    assert got["default_mode"] == "manual"
    for k, v in DEFAULTS.items():
        if k != "default_mode":
            assert got[k] == v, f"字段 {k} 未按列默认兜底"
    assert len(_setting_rows(uid)) == 1

    # 二次 PUT 其它字段 → 只更新显式字段，default_mode 保留 manual
    resp = settings_client.put(
        "/api/settings",
        json={"anim_enabled": False, "bg_enabled": False},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text
    got = resp.json()["data"]["settings"]
    assert got["anim_enabled"] is False
    assert got["bg_enabled"] is False
    assert got["default_mode"] == "manual"  # 未被覆盖
    assert got["card_images"] is True
    assert got["banner_dropdown"] is False
    assert len(_setting_rows(uid)) == 1  # 不重复建行


def test_put_full_then_get_returns_stored(settings_client):
    uid = _new_user()
    full = {
        "anim_enabled": False,
        "default_mode": "both",
        "banner_dropdown": True,
        "share_mingli_ui": False,
        "bg_enabled": False,
        "card_images": False,
        "agent_enabled": False,
    }
    resp = settings_client.put("/api/settings", json=full, headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["settings"] == full
    # GET 有记录 → 返回存储全量
    resp = settings_client.get("/api/settings", headers=_auth_header(uid))
    assert resp.status_code == 200
    assert resp.json()["data"]["settings"] == full


def test_put_invalid_default_mode_400(settings_client):
    uid = _new_user()
    for bad in ("nope", "", "AUTO"):
        resp = settings_client.put(
            "/api/settings", json={"default_mode": bad}, headers=_auth_header(uid)
        )
        assert resp.status_code == 400, f"default_mode={bad!r} resp={resp.text}"
        body = resp.json()
        assert body["code"] == ERR_PARAM  # 参数错误信封
    assert _setting_rows(uid) == []  # 校验失败不落行


def test_put_empty_body_no_write(settings_client):
    uid = _new_user()
    resp = settings_client.put("/api/settings", json={}, headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["settings"] == DEFAULTS
    assert _setting_rows(uid) == []  # 空 body 不建行


def test_user_isolation(settings_client):
    uid_a = _new_user()
    uid_b = _new_user()
    settings_client.put(
        "/api/settings",
        json={"default_mode": "manual", "agent_enabled": False},
        headers=_auth_header(uid_a),
    )
    resp = settings_client.get("/api/settings", headers=_auth_header(uid_b))
    assert resp.status_code == 200
    assert resp.json()["data"]["settings"] == DEFAULTS  # B 不受 A 影响
    assert len(_setting_rows(uid_a)) == 1
    assert len(_setting_rows(uid_b)) == 0


def test_requires_auth(settings_client):
    # 缺 Authorization header → 400（Header(...) 必填校验）
    resp = settings_client.get("/api/settings")
    assert resp.status_code == 400
    # 非法/非 Bearer 令牌 → 401
    resp = settings_client.get(
        "/api/settings", headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert resp.status_code == 401
