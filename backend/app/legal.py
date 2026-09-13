# -*- coding: utf-8 -*-
"""合规文书主体信息注入（节147 续，用户 2026-09-14 拍板）。

**问题**：`docs/legal/*.md` 与 `frontend/public/legal/*.html` 是**线上要展示**的
用户协议 / 隐私政策，合规上必须写真实运营主体（姓名 / 联系方式 / 邮箱）；
但这个项目**要开源**（节142 Prosperity 许可）——真实个人信息留在仓库里，等于开源即公开。

**解法**：仓库里两份文书**只含占位符**，真实值走环境变量，**由后端在服务端渲染时注入**。

| 占位符 | 配置项 | 环境变量 |
|---|---|---|
| `{{OPERATOR_NAME}}` | `settings.operator_name` | `MINGLI_OPERATOR_NAME` |
| `{{OPERATOR_CONTACT}}` | `settings.operator_contact` | `MINGLI_OPERATOR_CONTACT` |
| `{{OPERATOR_EMAIL}}` | `settings.operator_email` | `MINGLI_OPERATOR_EMAIL` |

**为什么是服务端渲染而不是构建时替换**：这两份 HTML 由后端 SPA 静态兜底直出
（`/legal/用户协议.html`；Caddy 的 `@static` 白名单不含 `/legal/*`，会反代到 web:8000）。
服务端注入让「**仓库里是占位符**」与「**线上是真实主体**」同时成立，部署侧零额外步骤，
也不会因为 `git reset --hard` 把替换结果冲掉。

**失败策略（fail closed）**：三项任一为空 → 抛 `OperatorInfoMissing` → 页面返回 500。
**宁可 500，也不要发布一份没有运营主体的协议**（那才是真的合规事故）。
"""
from __future__ import annotations

from typing import Dict

from .config import settings

PLACEHOLDER_NAME = "{{OPERATOR_NAME}}"
PLACEHOLDER_CONTACT = "{{OPERATOR_CONTACT}}"
PLACEHOLDER_EMAIL = "{{OPERATOR_EMAIL}}"

PLACEHOLDERS = (PLACEHOLDER_NAME, PLACEHOLDER_CONTACT, PLACEHOLDER_EMAIL)

# 只处理 /legal/ 目录下的 .html，避免误伤其它静态资源
LEGAL_PREFIX = "legal/"
LEGAL_SUFFIX = ".html"

MISSING_HINT = (
    "合规文书需要运营主体信息，但环境变量未配置完整："
    "MINGLI_OPERATOR_NAME / MINGLI_OPERATOR_CONTACT / MINGLI_OPERATOR_EMAIL。"
    "这两份是线上展示的用户协议与隐私政策，缺主体信息不能发布；"
    "请在 .env 补齐后重启（仓库里只放占位符，真实值不入库）。"
)


class OperatorInfoMissing(RuntimeError):
    """运营主体三要素任一为空。"""


def is_legal_page(path: str) -> bool:
    """路径是否为合规文书页。

    ⚠️ **路径分隔符必须先归一**：StaticFiles 内部用 `os.path.normpath` 处理路径，
    **在 Windows 上会把 `/` 变成 `\\`** —— 实测运行期传进来的就是
    `legal\\用户协议.html`。只判 `legal/` 前缀会在 Windows 上静默失效
    （页面照常 200，但占位符不替换 —— 无报错、最坏的那种 bug）。
    """
    normalized = path.replace("\\", "/")
    return normalized.startswith(LEGAL_PREFIX) and normalized.endswith(LEGAL_SUFFIX)


def has_placeholder(text: str) -> bool:
    return any(p in text for p in PLACEHOLDERS)


def missing_placeholders() -> list:
    """返回「配置缺失」的占位符列表（空列表 = 三项都配好了）。

    用于启动体检：不抛异常，只报告，让 lifespan 能喊一声 warning。
    """
    configured = {
        PLACEHOLDER_NAME: settings.operator_name,
        PLACEHOLDER_CONTACT: settings.operator_contact,
        PLACEHOLDER_EMAIL: settings.operator_email,
    }
    return [k for k, v in configured.items() if not (v or "").strip()]


def operator_values() -> Dict[str, str]:
    """占位符 → 真实值。任一为空即抛（不回退空串，避免静默渲染出空白主体）。"""
    values = {
        PLACEHOLDER_NAME: settings.operator_name.strip(),
        PLACEHOLDER_CONTACT: settings.operator_contact.strip(),
        PLACEHOLDER_EMAIL: settings.operator_email.strip(),
    }
    missing = [k for k, v in values.items() if not v]
    if missing:
        raise OperatorInfoMissing(MISSING_HINT + "（缺：" + " / ".join(missing) + "）")
    return values


def render_legal_html(text: str) -> str:
    """把文书里的占位符替换成配置值。"""
    for placeholder, value in operator_values().items():
        text = text.replace(placeholder, value)
    return text
