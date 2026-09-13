# -*- coding: utf-8 -*-
"""节141：公开注册开关契约测试（`MINGLI_ALLOW_PUBLIC_REGISTER`）。

覆盖：
  - 开关关闭（生产默认）→ `POST /api/auth/register` **403 + code 2003**，
    错误文案即内测提示原文；**端点未被物理删除**（仍能路由到、由开关拦截）。
  - 测试环境配置：conftest 在 import 前把开关置 true → `settings.allow_public_register is True`
    （这是 e2e 用例能继续用 register 造数的前提）。
  - 后台开号主通道未受影响：`POST /api/admin/users` 仍可用（节141 验收第 4 条）。
"""
from __future__ import annotations

import pytest


@pytest.fixture(scope="module")
def register_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表/拉起 Node，同 test_divination 口径）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def test_public_register_disabled_returns_403(register_client, monkeypatch):
    """开关关闭 → 403 + code 2003 + 内测提示原文（不再建用户、不再核验验证码）。"""
    from app.config import settings

    monkeypatch.setattr(settings, "allow_public_register", False)

    resp = register_client.post(
        "/api/auth/register",
        json={
            "username": "13900000001",
            "password": "secret123",
            "captcha_id": "nope",
            "captcha_code": "nope",
        },
    )
    assert resp.status_code == 403, resp.text
    body = resp.json()
    assert body["code"] == 2003, body
    assert body["message"] == "本项目只开放给内部人员，请联系开发者获得测试资格。", body


def test_public_register_switch_on_in_tests(register_client):
    """测试配置口径：conftest 已把开关打开（否则本节 e2e 用例无法用 register 造数）。"""
    from app.config import settings

    assert settings.allow_public_register is True
