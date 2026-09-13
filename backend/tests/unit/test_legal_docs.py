# -*- coding: utf-8 -*-
"""合规文书主体信息注入回归（节147 续）。

覆盖三件事：
1. `/legal/*.html` 直出时占位符被真实替换（页面里不该再出现 `{{OPERATOR_*}}`）
2. 三要素任一为空 → 返回 500（**fail closed**：绝不渲染出没有运营主体的协议）
3. 非文书静态文件不受影响（body 不被读取/改写）

占位符与配置的映射见 `app/legal.py`。
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import legal
from app.config import settings

LEGAL_PAGES = ["/legal/用户协议.html", "/legal/隐私政策.html"]


@pytest.fixture()
def client(orchestration_env):
    """真实 FastAPI app 的 TestClient（with 形式以触发 lifespan）。"""
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_legal_pages_render_operator_without_placeholder(client):
    """两份文书直出后：真实主体在位、占位符清零。"""
    for url in LEGAL_PAGES:
        resp = client.get(url)
        assert resp.status_code == 200, url
        body = resp.text
        assert not legal.has_placeholder(body), f"{url} 仍有未替换的占位符"
        assert settings.operator_name in body, url
        assert settings.operator_email in body, url


def test_legal_page_missing_operator_fails_closed(client, monkeypatch):
    """主体信息缺失 → 500，而不是渲染出空白主体。"""
    monkeypatch.setattr(settings, "operator_email", "")
    resp = client.get(LEGAL_PAGES[0])
    assert resp.status_code == 500
    assert "MINGLI_OPERATOR_EMAIL" in resp.text


def test_non_legal_static_files_untouched(client):
    """非文书静态资源照常直出（注入逻辑只认 /legal/ + .html）。"""
    resp = client.get("/manifest.webmanifest")
    assert resp.status_code == 200
    assert "{{OPERATOR" not in resp.text


def test_is_legal_page_scope():
    """路径判定：只认 /legal/ 下的 .html，且分隔符两种都要认。

    ⚠️ 反向大小写是有来历的：StaticFiles 用 os.path.normpath，**Windows 上会把
    `/` 归一成 `\\`**，运行期传进来的真的是 `legal\\用户协议.html`。
    只判正斜杠会让注入在 Windows 上静默失效（页面 200、占位符不换、无报错）。
    """
    assert legal.is_legal_page("legal/用户协议.html")
    assert legal.is_legal_page("legal\\用户协议.html")  # Windows 运行期实态
    assert not legal.is_legal_page("legal/readme.md")
    assert not legal.is_legal_page("index.html")
    assert not legal.is_legal_page("js/legal-x.html")
