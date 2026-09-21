# -*- coding: utf-8 -*-
"""运行形态（渠道开关）与版本契约的契约测试（2026-09-22 用户拍板：补两个地基）。

覆盖：
  1. **默认 = 现状**：不设 `MINGLI_RUNTIME_MODE` 时 `mode == "web"`，且能力清单逐键
     等于 web 形态的既有语义（这是「线上行为零变化」的可执行证明，改这张表必须改这里）；
  2. 形态矩阵：apk-local（无账号/无计费/无分享、可自填 key、本机排盘）与
     apk-client（业务能力跟随服务器、本机管理面关闭）；
  3. 配置写错（非法形态值）→ 按 web 兜底，不把自己锁成单机形态；
  4. 能力清单返回**副本**（调用方改不污染全局判断）；
  5. `GET /api/runtime` 信封形状 + **无鉴权可读** + 形态切换真的透传；
  6. 版本单一来源不变量：`app/version.py` 的 APP_VERSION == `pyproject.toml` 版本、
     FastAPI 的 OpenAPI 版本不漂、API_VERSION 形状为 MAJOR.MINOR。
"""
from __future__ import annotations

import re
import tomllib
from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

BACKEND_DIR = Path(__file__).resolve().parents[2]

# web 形态的既有语义（= 现状：账号/计费/分享/后台都在，key 在服务端，排盘在服务器）
WEB_EXPECTED = {
    "auth": True,
    "credits": True,
    "share": True,
    "admin": True,
    "prompt_mgmt": True,
    "asset_mgmt": True,
    "byo_llm_key": False,
    "events_report": True,
    "paipan_local": False,
}


# ------------------------------------------------------------ 渠道开关 ----
def test_default_mode_is_web_with_legacy_capabilities():
    """缺省形态 = web，且能力清单逐键等于现状语义（零行为变化的证明）。"""
    from app.runtime import capabilities, current_mode

    assert current_mode() == "web"
    assert capabilities() == WEB_EXPECTED


def test_apk_local_capabilities():
    """APK 单机：账号/计费/分享/上报关闭，自填 key 与本机管理面打开。"""
    from app.runtime import APK_LOCAL, capabilities

    caps = capabilities(APK_LOCAL)
    assert caps["auth"] is False
    assert caps["credits"] is False
    assert caps["share"] is False
    assert caps["events_report"] is False
    assert caps["byo_llm_key"] is True      # 单机形态的关键差异：用户自备 key
    assert caps["paipan_local"] is True     # 排盘在内嵌 JS 内核里跑
    assert caps["admin"] is True            # 本机即管理面
    assert caps["prompt_mgmt"] is True
    assert caps["asset_mgmt"] is True


def test_apk_client_capabilities_follow_server():
    """APK 客户端：业务能力跟随服务器，本机管理面（admin/素材/Prompt）关闭。"""
    from app.runtime import APK_CLIENT, capabilities

    caps = capabilities(APK_CLIENT)
    assert caps["auth"] is True
    assert caps["credits"] is True
    assert caps["share"] is True
    assert caps["events_report"] is True
    assert caps["admin"] is False
    assert caps["prompt_mgmt"] is False
    assert caps["asset_mgmt"] is False
    assert caps["byo_llm_key"] is False     # 走服务器的 key，设备不直连 LLM
    assert caps["paipan_local"] is False


def test_unknown_mode_falls_back_to_web(monkeypatch):
    """配置写错不能把自己锁成单机：非法值一律按 web。"""
    from app import runtime
    from app.config import settings

    monkeypatch.setattr(settings, "runtime_mode", "apk-fancy-typo")
    assert runtime.current_mode() == "web"
    assert runtime.capabilities() == WEB_EXPECTED


def test_capabilities_returns_fresh_copy():
    """返回副本：调用方改写不得污染下一次判断。"""
    from app.runtime import APK_LOCAL, capabilities

    first = capabilities(APK_LOCAL)
    first["auth"] = True
    assert capabilities(APK_LOCAL)["auth"] is False


# -------------------------------------------------------- /api/runtime ----
def test_api_runtime_endpoint_envelope_without_auth():
    """无鉴权可读；信封与其它 /api 接口一致；四个字段齐备。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/runtime")   # 有意不带 Authorization
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0 and body["message"] == "ok"
    data = body["data"]
    assert data["mode"] == "web"
    assert data["capabilities"] == WEB_EXPECTED
    assert isinstance(data["api_version"], str) and data["api_version"]
    assert isinstance(data["app_version"], str) and data["app_version"]


def test_api_runtime_reflects_mode_switch(monkeypatch):
    """形态开关真的透传到接口（渠道开关不是摆设）。"""
    from fastapi.testclient import TestClient

    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "runtime_mode", "apk-local")
    with TestClient(app) as client:
        body = client.get("/api/runtime").json()
    assert body["data"]["mode"] == "apk-local"
    assert body["data"]["capabilities"]["byo_llm_key"] is True


# ------------------------------------------------------------ 版本契约 ----
def test_app_version_matches_pyproject():
    """单一版本源：app/version.py 与 pyproject.toml 不许漂。"""
    from app.version import APP_VERSION

    with open(BACKEND_DIR / "pyproject.toml", "rb") as fh:
        pyproject = tomllib.load(fh)
    assert APP_VERSION == pyproject["project"]["version"]


def test_api_version_shape():
    """接口契约版本必须是 MAJOR.MINOR（bump 纪律见 docs/standards/08）。"""
    from app.version import API_VERSION

    assert re.fullmatch(r"\d+\.\d+", API_VERSION)


def test_fastapi_openapi_version_does_not_drift():
    """FastAPI(version=) 目前是字面量，与 APP_VERSION 同值；这条用例看住它不许漂。"""
    from app.main import app
    from app.version import APP_VERSION

    assert app.version == APP_VERSION


# ------------------------------------------------- 前端兜底表不许漂 ----
def test_frontend_fallback_table_matches_backend_web_caps():
    """前端兜底表 `WEB_FULL`（frontend/public/data/runtime.js）必须等于后端 web 形态取值。

    为什么要有这条：`docs/standards/08` 要求「两个读端读同一张表」。前端取不到
    `/api/runtime` 时会用兜底表渲染 —— 兜底表一旦与后端漂了，就会出现「断网时多渲染
    或少渲染一块」的诡异 bug，且只在异常路径复现。这里用文本解析把两处钉在一起。
    """
    import re

    from app.runtime import capabilities

    src = (BACKEND_DIR.parent / "frontend" / "public" / "data" / "runtime.js").read_text(encoding="utf-8")
    block = re.search(r"var WEB_FULL\s*=\s*\{(.*?)\n  \};", src, re.S)
    assert block is not None, "未找到 WEB_FULL 兜底表（前端入口被改写了？）"

    front = {}
    for key, val in re.findall(r"(\w+)\s*:\s*(true|false)", block.group(1)):
        front[key] = (val == "true")

    assert front == capabilities("web"), "前端兜底表与后端 web 能力清单已漂移，必须同步"
    assert set(front) == set(WEB_EXPECTED)   # 键集合也要一致（防单边新增）

