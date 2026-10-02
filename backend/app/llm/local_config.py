# -*- coding: utf-8 -*-
"""单机形态「大模型接入」配置的**落盘与读取**（节 166）。

## 要解决什么

用户在应用内（「大模型接入」设置页）填的**接口地址 / API Key / 型号**必须
**持久化到设备本机**——重启 App 后还在。而这份配置的写入方与读取方不是一个进程：

- **写入方**：后端 `PUT /api/llm/settings`（跑在本机 Python 服务里）；
- **读取方（启动期）**：`apk/pysrc/apk_asgi.py` —— 它在 `import app.main` **之前**
  就要把这三项写进环境变量（`MINGLI_LLM_BASE_URL` / `MINGLI_LLM_API_KEY` /
  `MINGLI_LLM_MODEL`），因为 `app.config.settings` 是**模块级单例、首次 import 即定格**，
  之后再改环境变量无效。

## 做法：一处「配置路径」抽象（**两边必须落到同一个文件**）

| 优先级 | 取值 |
|---|---|
| 1 | 环境变量 `MINGLI_LLM_CONFIG_PATH` |
| 2 | 默认 `<数据目录>/llm.json`（数据目录 = `settings.db_path` 所在目录） |

**为什么必须有环境变量这一档**：后端**不许 import `apk_asgi`**（它在 web 形态根本不存在，
import 会直接炸）。所以由 `apk_asgi` 在注入环境时**主动把 `MINGLI_LLM_CONFIG_PATH`
设成它自己那个 `<filesDir>/llm.json`**，本模块据此对齐 —— 于是「设置页改完 → 重启 App
→ 启动期读到的是同一份配置」，不会出现「改完不生效」。

> ⚠️ 若将来改文件名或字段，**必须同步改 `apk_asgi.save_llm_config` 的 `allowed` 元组**，
> 否则两边会各写各的。`tests/unit/test_llm_settings.py` 有一条用例盯着字段集。

## 字段

只允许 `base_url` / `api_key` / `model`（与 `apk_asgi.save_llm_config` 同口径）——
**刻意不支持任意键**：这份文件里含凭据，落盘面越小越好。
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict

from app.config import settings

#: 允许落盘的三个键（**唯一事实源**；`apk_asgi` 侧同口径）
ALLOWED_KEYS = ("base_url", "api_key", "model")

#: 默认文件名（与 `apk_asgi.LLM_CONFIG_FILENAME` 必须一致）
DEFAULT_FILENAME = "llm.json"

#: 环境变量名（`apk_asgi` 用它指到自己的路径）
PATH_ENV_VAR = "MINGLI_LLM_CONFIG_PATH"


def config_path() -> Path:
    """配置文件的落点。优先级见模块 docstring。"""
    explicit = os.environ.get(PATH_ENV_VAR)
    if explicit:
        return Path(explicit)
    return Path(settings.db_path).parent / DEFAULT_FILENAME


def load() -> Dict[str, str]:
    """读配置。**永不抛异常**（读不到/损坏一律按「未配置」返回全空）。

    返回值**恒含三个键**（缺失给空串），调用方不必再 `.get`。
    """
    blank = {key: "" for key in ALLOWED_KEYS}
    path = config_path()
    try:
        if not path.is_file():
            return blank
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 - 配置损坏不能让设置页 500
        return blank
    if not isinstance(data, dict):
        return blank
    return {key: str(data.get(key) or "") for key in ALLOWED_KEYS}


def save(payload: Dict[str, Any]) -> Path:
    """写配置（只写 `ALLOWED_KEYS`，其余键丢弃）。返回落点。"""
    body = {key: str(payload.get(key) or "") for key in ALLOWED_KEYS}
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(path, 0o600)  # 仅属主可读写（同 uid 沙箱内已隔离，双保险）
    except OSError:
        pass
    return path


def has_key() -> bool:
    """是否已配置 API Key（**只看有没有，不返回值本身**）。"""
    return bool((settings.llm_api_key or "").strip())
