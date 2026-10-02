# -*- coding: utf-8 -*-
"""单机形态「大模型接入」与「本机会话」的契约测试（节 166）。

覆盖：
  1. **形态门**：`byo_llm_key` 为假（web / apk-client）时三个端点一律 **404**（不是 403）；
  2. **绝不回显 key**：GET / PUT 只给 `has_key`；响应体里不出现 key 本身；
  3. **PUT 落盘 + 无需重启即生效**：既写文件，也改内存 `settings` 单例；
  4. `api_key` 语义：空串 = 保持不变（防「改型号把 key 抹掉」）；清空只走 `clear_api_key`；
  5. `/api/llm/test`：未配置 key 时不发网络请求；打桩 200 / 401 时给出可读原因（分类正确）；
  6. **两边同一个文件**（文本级不变量）：后端 `local_config` 与 `apk/pysrc/apk_asgi.py`
     的文件名 / 环境变量名 / 字段集必须一致 —— 漂了就会「设置页改完重启不生效」；
  7. **本机会话**：单机形态 + 回环来源 → `/api/runtime` 下发 `local_token`，且该 token
     能真的调通业务端点（`/api/combine/pools` 200 而不是 400）；非回环 / 非单机形态 → 无该键。
"""
from __future__ import annotations

from pathlib import Path

import pytest

pytestmark = pytest.mark.usefixtures("orchestration_env")

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
APK_ASGI_PATH = REPO_ROOT / "apk" / "pysrc" / "apk_asgi.py"

# TestClient 默认来源 IP 是 "testclient"（非回环）→ 单机 token 不会被签发。
# 要测回环分支就用 starlette 的 `client=` 参数显式指定来源。
LOOPBACK = ("127.0.0.1", 51234)
LAN = ("10.0.0.5", 51234)

_FAKE_KEY = "sk-test-only-not-a-real-key-0123456789"


@pytest.fixture()
def apk_local(monkeypatch):
    """把形态切成单机，并把配置落点指到临时目录（不碰真实文件）。"""
    from app.api import llm_settings
    from app.config import settings

    monkeypatch.setattr(settings, "runtime_mode", "apk-local")
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "llm_base_url", "https://api.deepseek.com")
    monkeypatch.setattr(settings, "llm_model", "deepseek-v4-flash")
    assert llm_settings is not None
    return settings


@pytest.fixture()
def tmp_config_path(tmp_path, monkeypatch):
    """把「大模型接入」配置落点指到临时目录，返回该路径。"""
    path = tmp_path / "llm.json"
    monkeypatch.setenv("MINGLI_LLM_CONFIG_PATH", str(path))
    return path


@pytest.fixture()
def auth_headers(apk_local):
    """一个**真的** `Authorization` 头。

    为什么要真 token：这些端点与其它业务端点一样走 `get_user_id_from_token`，
    拿 `"Bearer t"` 这种假串会先撞 401（响应里没有 `data`），测不到真正想测的东西。
    这里直接复用单机形态的正规发券路径 `issue_local_token("127.0.0.1")`。
    """
    from app.local_session import issue_local_token

    token = issue_local_token("127.0.0.1")
    assert token, "单机形态 + 回环应能签发本机 token"
    return {"Authorization": f"Bearer {token}"}


def _client(app, source=("testclient", 50000)):
    from fastapi.testclient import TestClient

    return TestClient(app, client=source)


# --------------------------------------------------------------- 形态门 ----
@pytest.mark.parametrize("mode", ["web", "apk-client"])
def test_endpoints_404_when_byo_llm_key_absent(monkeypatch, mode, tmp_config_path):
    """非单机形态：三个端点都应是 404。

    **404 而不是 403**：403 等于告诉探查者「这里有个功能，只是你没权限」；
    404 才是「这个形态没有这个功能」的准确表达（也更少泄漏信息）。
    """
    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "runtime_mode", mode)
    headers = {"Authorization": "Bearer whatever"}
    with _client(app) as client:
        assert client.get("/api/llm/settings", headers=headers).status_code == 404
        assert client.put("/api/llm/settings", json={"model": "x"}, headers=headers).status_code == 404
        assert client.post("/api/llm/test", headers=headers).status_code == 404
    assert not tmp_config_path.exists(), "非单机形态不应写任何配置文件"


def test_apk_local_requires_auth(apk_local, tmp_config_path):
    """单机形态也要 `Authorization`（与其它业务端点一致）——只是前端会用 local_token。"""
    from app.main import app

    with _client(app) as client:
        resp = client.get("/api/llm/settings")
    assert resp.status_code == 400                      # 缺 header → 参数错误（既有口径）
    assert resp.json()["code"] == 1001


# ------------------------------------------------------------ 不回显 key ----
def test_get_reports_has_key_but_never_the_key(auth_headers, apk_local, tmp_config_path, monkeypatch):
    """GET 只给 `has_key`，**响应体任何位置都不出现 key**。"""
    from app.main import app

    monkeypatch.setattr(apk_local, "llm_api_key", _FAKE_KEY)
    with _client(app) as client:
        resp = client.get("/api/llm/settings", headers=auth_headers)
    assert resp.status_code == 200
    assert _FAKE_KEY not in resp.text, "响应里泄漏了 key"
    data = resp.json()["data"]
    assert data["has_key"] is True
    assert "api_key" not in data


def test_get_has_key_false_when_blank(auth_headers):
    from app.main import app

    with _client(app) as client:
        data = client.get("/api/llm/settings", headers=auth_headers).json()["data"]
    assert data["has_key"] is False


# ------------------------------------------------- PUT：落盘 + 即时生效 ----
def test_put_persists_to_disk_and_applies_without_restart(auth_headers, apk_local, tmp_config_path):
    """PUT 必须**同时**写文件与改内存单例 —— 否则「改完不生效」。"""
    import json

    from app.main import app

    body = {"base_url": "https://example.invalid/v1", "api_key": _FAKE_KEY, "model": "my-model"}
    with _client(app) as client:
        resp = client.put("/api/llm/settings", json=body, headers=auth_headers)
    assert resp.status_code == 200
    assert _FAKE_KEY not in resp.text

    # ① 落盘
    assert tmp_config_path.is_file()
    on_disk = json.loads(tmp_config_path.read_text(encoding="utf-8"))
    assert on_disk == {"base_url": "https://example.invalid/v1",
                       "api_key": _FAKE_KEY, "model": "my-model"}
    # ② 内存生效（业务代码读的就是这三项）
    assert apk_local.llm_base_url == "https://example.invalid/v1"
    assert apk_local.llm_api_key == _FAKE_KEY
    assert apk_local.llm_model == "my-model"
    # ③ 再读回：形状一致且仍不回显 key
    with _client(app) as client:
        data = client.get("/api/llm/settings", headers=auth_headers).json()["data"]
    assert data == {"base_url": "https://example.invalid/v1", "model": "my-model", "has_key": True}


def test_put_empty_api_key_keeps_existing(auth_headers, apk_local, tmp_config_path):
    """空串 = **保持不变**（前端表单不回显 key，用户只改型号时提交的必然是空串）。"""
    from app.main import app

    with _client(app) as client:
        client.put("/api/llm/settings",
                   json={"api_key": _FAKE_KEY}, headers=auth_headers)
        client.put("/api/llm/settings",
                   json={"api_key": "", "model": "changed"}, headers=auth_headers)
        data = client.get("/api/llm/settings", headers=auth_headers).json()["data"]
    assert data["has_key"] is True, "空串把已保存的 key 抹掉了"
    assert apk_local.llm_model == "changed"
    assert apk_local.llm_api_key == _FAKE_KEY


def test_put_clear_api_key_is_the_only_way_to_clear(auth_headers, apk_local, tmp_config_path):
    """清空只走显式的 `clear_api_key: true`。"""
    from app.main import app

    with _client(app) as client:
        client.put("/api/llm/settings",
                   json={"api_key": _FAKE_KEY}, headers=auth_headers)
        client.put("/api/llm/settings",
                   json={"clear_api_key": True}, headers=auth_headers)
        data = client.get("/api/llm/settings", headers=auth_headers).json()["data"]
    assert data["has_key"] is False
    assert apk_local.llm_api_key == ""


def test_put_ignores_unknown_fields(auth_headers, tmp_config_path):
    """落盘面越小越好：只允许三个键，多余的丢弃。"""
    import json

    from app.main import app

    with _client(app) as client:
        client.put("/api/llm/settings",
                   json={"model": "m", "evil": "x", "runtime_mode": "web"},
                   headers=auth_headers)
    assert json.loads(tmp_config_path.read_text(encoding="utf-8")) == {
        "base_url": "", "api_key": "", "model": "m"}


# --------------------------------------------------------- /api/llm/test ----
def _stub_httpx(monkeypatch, status_code: int, captured: dict):
    """把 llm_settings 模块里的 httpx.AsyncClient 换成假的，记录实际请求。"""
    from app.api import llm_settings

    class _Resp:
        def __init__(self):
            self.status_code = status_code

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, json=None, headers=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return _Resp()

    monkeypatch.setattr(llm_settings.httpx, "AsyncClient", _FakeClient)


def test_test_endpoint_without_key_makes_no_request(auth_headers, tmp_config_path, monkeypatch):
    """没 key 时提前给结论，**不发网络请求**（也不花钱）。"""
    from app.main import app

    captured: dict = {}
    _stub_httpx(monkeypatch, 200, captured)
    with _client(app) as client:
        resp = client.post("/api/llm/test", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ok"] is False
    assert "API Key" in data["detail"]
    assert captured == {}, "没 key 却发了请求"


def test_test_endpoint_success(auth_headers, apk_local, tmp_config_path, monkeypatch):
    """打桩 200 → ok=True，且请求确实打到了 `{base_url}/chat/completions`。"""
    from app.main import app

    monkeypatch.setattr(apk_local, "llm_api_key", _FAKE_KEY)
    monkeypatch.setattr(apk_local, "llm_base_url", "https://example.invalid/v1/")
    captured: dict = {}
    _stub_httpx(monkeypatch, 200, captured)

    with _client(app) as client:
        data = client.post("/api/llm/test", headers=auth_headers).json()["data"]
    assert data["ok"] is True
    assert data["latency_ms"] >= 0
    assert captured["url"] == "https://example.invalid/v1/chat/completions"   # base_url 的尾斜杠被归一
    assert captured["headers"]["Authorization"] == f"Bearer {_FAKE_KEY}"
    assert captured["json"]["model"] == "deepseek-v4-flash"


@pytest.mark.parametrize("status,keyword", [
    (401, "Key 无效"),
    (403, "Key 无效"),
    (404, "接口地址不对"),
    (429, "限流"),
    (503, "服务端故障"),
])
def test_test_endpoint_classifies_failures(auth_headers, apk_local, tmp_config_path, monkeypatch, status, keyword):
    """失败必须给**可操作的**原因分类，而不是一句「失败」。"""
    from app.main import app

    monkeypatch.setattr(apk_local, "llm_api_key", _FAKE_KEY)
    _stub_httpx(monkeypatch, status, {})
    with _client(app) as client:
        data = client.post("/api/llm/test", headers=auth_headers).json()["data"]
    assert data["ok"] is False
    assert keyword in data["detail"], data["detail"]


def test_test_endpoint_reports_timeout(auth_headers, apk_local, tmp_config_path, monkeypatch):
    """超时要被翻译成人话（且带上超时秒数）。"""
    import httpx

    from app.api import llm_settings
    from app.main import app

    monkeypatch.setattr(apk_local, "llm_api_key", _FAKE_KEY)

    class _TimeoutClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, *a, **k):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(llm_settings.httpx, "AsyncClient", _TimeoutClient)
    with _client(app) as client:
        data = client.post("/api/llm/test", headers=auth_headers).json()["data"]
    assert data["ok"] is False
    assert "超时" in data["detail"]


# ------------------------------------------- 配置落点：两边同一个文件 ----
def test_config_path_prefers_env_var(monkeypatch, tmp_path):
    """优先级①：环境变量 > 默认 `<数据目录>/llm.json`。"""
    from app.llm import local_config

    target = tmp_path / "custom.json"
    monkeypatch.setenv("MINGLI_LLM_CONFIG_PATH", str(target))
    assert local_config.config_path() == target


def test_config_path_defaults_next_to_db(monkeypatch, tmp_path):
    """优先级②：未设环境变量时落在数据目录（与 `settings.db_path` 同目录）。"""
    from app.config import settings
    from app.llm import local_config

    monkeypatch.delenv("MINGLI_LLM_CONFIG_PATH", raising=False)
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "data" / "mingli_analytics.db"))
    assert local_config.config_path() == tmp_path / "data" / "llm.json"


def test_load_tolerates_broken_file(tmp_path, monkeypatch):
    """配置损坏不能让设置页 500 —— 一律按「未配置」返回（且恒含三个键）。"""
    from app.llm import local_config

    broken = tmp_path / "llm.json"
    broken.write_text("{ this is not json", encoding="utf-8")
    monkeypatch.setenv("MINGLI_LLM_CONFIG_PATH", str(broken))
    assert local_config.load() == {"base_url": "", "api_key": "", "model": ""}


def test_apk_asgi_agrees_on_filename_envvar_and_fields():
    """**文本级不变量**：后端与 `apk_asgi` 必须落到同一个文件、同一套字段。

    为什么用文本解析而不是 import：`apk_asgi.py` 在 `apk/pysrc/`、不在后端包里，
    import 它会把 APK 侧的模块塞进后端进程（且它顶部就依赖 APK 环境）。
    这条用例的作用 = 一旦有人在任一侧改名/加字段，这里当场红。
    """
    src = APK_ASGI_PATH.read_text(encoding="utf-8")
    assert 'LLM_CONFIG_FILENAME = "llm.json"' in src, "apk_asgi 的配置文件名变了"
    assert 'LLM_CONFIG_PATH_ENV_VAR = "MINGLI_LLM_CONFIG_PATH"' in src, \
        "apk_asgi 指向配置落点的环境变量名变了（后端会读不到同一份配置）"
    assert 'allowed = ("base_url", "api_key", "model")' in src, "apk_asgi 的字段集变了"
    # 后端侧同口径
    from app.llm import local_config

    assert local_config.DEFAULT_FILENAME == "llm.json"
    assert local_config.PATH_ENV_VAR == "MINGLI_LLM_CONFIG_PATH"
    assert local_config.ALLOWED_KEYS == ("base_url", "api_key", "model")
    # 并且 apk_asgi 的注入块确实设了这一项（否则两边默认路径不同 → 改完不生效）
    assert "LLM_CONFIG_PATH_ENV_VAR: str(llm_config_path())," in src, \
        "apk_asgi 没有把配置路径注入环境，后端会去 <数据目录>/llm.json 找一份空的"


# ----------------------------------------------------------- 本机会话 ----
def test_loopback_unit_helpers(monkeypatch):
    """`is_loopback` 的判据：回环真、其余假（含 None / 域名 / 非法值 → fail closed）。"""
    from app.local_session import is_loopback, local_session_allowed

    assert is_loopback("127.0.0.1") is True
    assert is_loopback("127.0.0.53") is True
    assert is_loopback("::1") is True
    assert is_loopback("localhost") is True
    assert is_loopback("10.0.0.5") is False
    assert is_loopback("testclient") is False
    assert is_loopback(None) is False
    assert is_loopback("") is False

    from app.config import settings
    monkeypatch.setattr(settings, "runtime_mode", "web")
    assert local_session_allowed("127.0.0.1") is False, "web 形态绝不自动签发 token"


def test_runtime_issues_local_token_on_loopback_in_apk_local(apk_local, tmp_config_path):
    """单机形态 + 回环 → `/api/runtime` 下发 `local_token`（这就是「免登录 ≠ 无 token」的落点）。"""
    from app.main import app

    with _client(app, source=LOOPBACK) as client:
        data = client.get("/api/runtime").json()["data"]
    assert data["mode"] == "apk-local"
    assert data["capabilities"]["auth"] is False
    assert data["capabilities"]["byo_llm_key"] is True
    token = data.get("local_token")
    assert isinstance(token, str) and len(token) > 20


def test_local_token_actually_unlocks_business_endpoints(apk_local, tmp_config_path, monkeypatch):
    """**端到端**：拿 `/api/runtime` 给的 token 调业务端点 → 200（而不是 400）。

    这条钉住的是整个单机形态能不能用：没 token 时 `/api/combine/pools` 返回 400 code 1001。
    """
    from app.main import app

    with _client(app, source=LOOPBACK) as client:
        token = client.get("/api/runtime").json()["data"]["local_token"]

        unauth = client.get("/api/combine/pools")
        assert unauth.status_code == 400, "前提变了：该端点现在不需要鉴权了？"

        ok = client.get("/api/combine/pools",
                        headers={"Authorization": f"Bearer {token}"})
        assert ok.status_code == 200
        body = ok.json()
        assert body["code"] == 0
        assert len(body["data"]["natal"]) >= 1 and len(body["data"]["moment"]) >= 1

        settings_resp = client.get("/api/llm/settings",
                                  headers={"Authorization": f"Bearer {token}"})
        assert settings_resp.status_code == 200


def test_no_local_token_for_lan_source(apk_local, tmp_config_path):
    """自我执行护栏：误绑 0.0.0.0 时局域网来源拿不到 token（fail closed）。"""
    from app.main import app

    with _client(app, source=LAN) as client:
        data = client.get("/api/runtime").json()["data"]
    assert "local_token" not in data


def test_no_local_token_in_web_mode(monkeypatch, tmp_config_path):
    """web 形态即使来自回环也不下发 token（响应形状与 1.1 一致）。"""
    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "runtime_mode", "web")
    with _client(app, source=LOOPBACK) as client:
        data = client.get("/api/runtime").json()["data"]
    assert data["mode"] == "web"
    assert "local_token" not in data


# --------------------------------------------- 缺 Key 时的引导（单点）----
async def test_missing_key_message_guides_single_machine_user(monkeypatch):
    """单机形态下缺 Key 的报错必须**指路**（去设置里填），不是报环境变量名。

    为什么这条重要：`llm/client.py` 的这处 raise 是**所有 AI 解读入口的单点**
    —— 每个调用方都把 `LLMError.message` 透传给用户，所以「未配置时的引导」
    只在这一处实现就覆盖了全站（pytest-asyncio 的 auto 模式：async 用例自动跑）。
    """
    from app.config import settings
    from app.llm.client import LLMError, chat

    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "runtime_mode", "apk-local")
    with pytest.raises(LLMError) as ei:
        await chat([{"role": "user", "content": "hi"}])
    msg = str(ei.value)
    assert "大模型接入" in msg and "设置" in msg
    assert "MINGLI_LLM_API_KEY" not in msg, "单机形态不该把环境变量名甩给用户"


async def test_missing_key_message_keeps_env_name_for_web(monkeypatch):
    """web 形态维持原样（运维向措辞）—— 行为零变化。"""
    from app.config import settings
    from app.llm.client import LLMError, chat

    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "runtime_mode", "web")
    with pytest.raises(LLMError) as ei:
        await chat([{"role": "user", "content": "hi"}])
    assert "MINGLI_LLM_API_KEY" in str(ei.value)


# ---------------------------------------- 单机形态不按余额拦流程（单点）----
def test_check_balance_is_noop_when_credits_absent(monkeypatch):
    """单机形态：`check_balance` 直接放行（否则第一次 AI 解读就撞「余额不足」）。

    `credits` 能力为假 = `runtime.py` 注释里写的「整条摘除」。
    这是**唯一的余额拦路点**（8 处调用方都走它），所以一条用例覆盖全站。
    单机形态下它连库都不碰，所以随便传个 id 也不该抛。
    """
    from app.config import settings
    from app.credits.service import check_balance

    monkeypatch.setattr(settings, "runtime_mode", "apk-local")
    check_balance(999999)      # 不存在的用户 + 未建账户：不应抛任何异常


def test_check_balance_still_blocks_in_web_mode(monkeypatch):
    """对照：web 形态行为不变（余额 <= 0 仍抛 5002）。"""
    from app.config import settings
    from app.credits.service import check_balance
    from app.database import AnalyticsSession
    from app.errors import BizError
    from app.models import User

    monkeypatch.setattr(settings, "runtime_mode", "web")
    session = AnalyticsSession()
    try:
        user = User(username="chk_bal_web_only", password_hash="x")
        session.add(user)
        session.commit()
        uid = user.id
    finally:
        session.close()
    with pytest.raises(BizError) as ei:
        check_balance(uid)     # 新账户 balance=0 → 5002
    assert ei.value.code == 5002
