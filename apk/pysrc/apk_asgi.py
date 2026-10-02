# -*- coding: utf-8 -*-
"""apk_asgi —— 胖 APK 的 **ASGI 自举服务**（节166）。

## 与 `apk_server.py` 的关系（**两个都留，职责不同**）

| | `apk_server.py`（POC-0，纯标准库） | `apk_asgi.py`（节166，本文件） |
|---|---|---|
| 提供什么 | 静态站点 + `/api/paipan/*`（经桥直连 JS 内核） | **真正的 FastAPI 应用**（`app.main:app`）——静态、`/api`、`/admin`、`/legal`、`/uploads` 全由它托管 |
| 依赖 | 只用 Python 标准库 | 需要 fastapi / uvicorn / pydantic(v1) / sqlalchemy 等（见 `app/build.gradle.kts` 的 `pip{}`） |
| 定位 | **兜底**：后端装不上或起不来时，保证「打开有页面、排盘可用」 | **主路径**：完整功能 |

MainActivity 先试本文件；起不来再退回 `apk_server`（见 `MainActivity.kt` 的 `PY_MODULE_CANDIDATES`）。

## 为什么必须做「环境注入」而不是靠 `.env`

安卓上没有进程级 `.env` 的常规语义，且 APK 的数据目录是**应用私有目录**（Chaquopy 下 `HOME` = filesDir）。
所以本文件在 import `app.main` **之前**把配置全部落到 `os.environ`：

| 环境变量 | 值 | 为什么 |
|---|---|---|
| `MINGLI_RUNTIME_MODE` | `apk-local` | **形态开关的唯一入口**（`app/runtime.py`）。这一项决定 `capabilities()` 里 auth/credits/share 关闭、`byo_llm_key` 打开 |
| `MINGLI_WEB_ROOT` | `<HOME>/web` | 静态站点根（MainActivity 已把 `assets/web` 解包到那里） |
| `MINGLI_DB_PATH` / `_FEEDBACK_` / `_OPS_` | `<HOME>/data/*.db` | 三库落在设备本地；**必须显式给绝对路径**——默认值是相对的 `data/*.db`，而进程 cwd 在安卓上不可控（否则会在只读目录上建库而崩） |
| `MINGLI_JWT_SECRET` | **首次生成并持久化**到 `<HOME>/jwt_secret` | `app/config.py` 的 `jwt_secret` 是必填（无弱默认、长度 ≥32）；apk-local 虽无账号体系，但**不设它连 import 都过不去**。持久化使重启后已发 token 不失效 |
| `MINGLI_LLM_*` | 从 `<HOME>/llm.json` 读（用户在「大模型接入」页填的） | **`byo_llm_key` 的落点**：用户在应用内自填的接口地址 / Key / 型号 |

## 线程与信号（**已知坑，已处理**）

MainActivity 在**后台线程**里调用 `main()`。uvicorn 的 `Server.run()` 会装信号处理器，
而**只有主线程能装**——Chaquopy 下「主线程」由第一个启动解释器的线程决定，
很可能不是我们的后台线程 → 会抛 `ValueError: signal only works in main thread`。
故 `_disable_signal_handlers()` 把 `install_signal_handlers` 覆盖成 no-op（进程生命周期由 Android 管，不需要 uvicorn 处理信号）。

## 路由尾斜杠（**契约级约束**）

MainActivity 的健康轮询**只看 200 且不跟随重定向**（`probeHealth()`）。
FastAPI/Starlette 对「带尾斜杠」的路由会回 **307**，Kotlin 不跟随 → 会被判失败。
故**本机健康检查路径必须是 `/api/health`（无尾斜杠）**，不要写成 `/api/health/`。
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

__all__ = [
    "SERVICE_NAME",
    "DEFAULT_PORT",
    "DEFAULT_HOST",
    "LLM_CONFIG_FILENAME",
    "LLM_CONFIG_PATH_ENV_VAR",
    "JWT_SECRET_FILENAME",
    "home_dir",
    "llm_config_path",
    "load_llm_config",
    "save_llm_config",
    "configure_environment",
    "build_app",
    "create_server",
    "start_background",
    "main",
]

SERVICE_NAME = "mingli-apk-asgi"
DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"

LLM_CONFIG_FILENAME = "llm.json"

#: 指向配置落点的环境变量名。**必须与 `backend/app/llm/local_config.py` 的
#: `PATH_ENV_VAR` 逐字一致** —— 这是「两边读写同一个文件」的全部机制。
LLM_CONFIG_PATH_ENV_VAR = "MINGLI_LLM_CONFIG_PATH"

JWT_SECRET_FILENAME = "jwt_secret"
WEB_DIRNAME = "web"
DATA_DIRNAME = "data"

_LOG_PREFIX = "[apk_asgi]"


def _log(message: str) -> None:
    try:
        sys.stdout.write("%s %s\n" % (_LOG_PREFIX, message))
        sys.stdout.flush()
    except Exception:  # noqa: BLE001 - 日志不能反过来搞死服务
        pass


# ---------------------------------------------------------------------------
# 设备本地路径
# ---------------------------------------------------------------------------

def home_dir() -> Path:
    """应用私有目录。Chaquopy 下 `HOME` = `context.getFilesDir()`；桌面调试时退化到 cwd。

    ⚠️ **`HOME` 指了一个不存在的目录时，先试着建出来，而不是直接退回 cwd。**
    为什么（2026-10-02 实测踩到）：退回 cwd 会把 `jwt_secret` / `llm.json` / 三库
    **写进进程当前目录** —— 而安卓上 cwd 不可控、桌面上 cwd 可能是项目根，
    结果是配置散落在意料之外的位置、排查极难（当时 `jwt_secret` 被写进了仓库根）。
    建不出来才退回 cwd，且**大声告警**。

    ⚠️ **`HOME` 完全未设置时同样退回 cwd，也**大声告警**（2026-10-02 补）**：
    Windows **默认不设 `HOME`（用的是 `USERPROFILE`）**，所以这条**在桌面上是常态、不是罕见分支**
    —— 它正是当初把密钥写进仓库根的那条路径。**桌面调试请显式设 `HOME`**
    （`apk/tools/verify-apk-local.py` 就是这么做的：建临时目录并注入）。
    """
    home = os.environ.get("HOME")
    if home:
        path = Path(home)
        if path.is_dir():
            return path
        try:
            path.mkdir(parents=True, exist_ok=True)
            _log("HOME 指向的目录不存在，已创建：%s" % path)
            return path
        except OSError as exc:
            _log("⚠️ HOME=%s 不可用且建不出来（%s: %s）→ **退回 cwd=%s**；"
                 "配置将落在当前目录，请检查！" % (home, type(exc).__name__, exc, Path.cwd()))
    else:
        _log("⚠️ 未设置 HOME → **退回 cwd=%s**；`jwt_secret` / `llm.json` / 三库都会落在"
             "当前目录（在仓库里跑就会落进仓库 —— 已在 .gitignore 兜住，但请先设 HOME）"
             % Path.cwd())
    return Path.cwd()


def llm_config_path() -> Path:
    """设备本地「大模型接入」配置的落点。

    ⚠️ **后端必须读同一个文件**：`backend/app/llm/local_config.py` 的优先级是
    「环境变量 `MINGLI_LLM_CONFIG_PATH` > `<数据目录>/llm.json`」，而本函数的默认是
    `<HOME>/llm.json` —— **两者默认不是同一个路径**。故 `configure_environment()`
    会主动把该环境变量设成本函数的返回值，后端据此对齐。
    改文件名或字段时**必须同步改那边**，否则「设置页改完重启不生效」。
    """
    explicit = os.environ.get(LLM_CONFIG_PATH_ENV_VAR)
    if explicit:
        return Path(explicit)
    return home_dir() / LLM_CONFIG_FILENAME


def _jwt_secret_path() -> Path:
    return home_dir() / JWT_SECRET_FILENAME


# ---------------------------------------------------------------------------
# 大模型接入配置（`byo_llm_key` 的落点）
# ---------------------------------------------------------------------------

def load_llm_config() -> Optional[Dict[str, Any]]:
    """读设备本地的 LLM 配置；不存在或损坏一律返回 None（**不抛异常**——服务要能起来）。"""
    path = llm_config_path()
    try:
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception as exc:  # noqa: BLE001
        _log("读取 %s 失败（忽略，按未配置处理）：%s: %s" % (path, type(exc).__name__, exc))
        return None


def save_llm_config(config: Dict[str, Any]) -> Path:
    """写设备本地的 LLM 配置。**只允许这三个键**，避免把任意内容落盘。"""
    allowed = ("base_url", "api_key", "model")
    payload = {k: str(config.get(k) or "") for k in allowed}
    path = llm_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(path, 0o600)  # 仅属主可读写（Android 上同 uid 沙箱内已隔离，双保险）
    except OSError:
        pass
    _log("已保存大模型接入配置到 %s（key 长度 %d，不回显）" % (path, len(payload["api_key"])))
    return path


def _ensure_jwt_secret() -> str:
    """取或生成持久化的 JWT 密钥。

    `jwt_secret` 在 `app/config.py` 里是**必填且无弱默认**（长度 ≥32，禁占位串）——
    apk-local 形态没有账号体系，但不设它连 import 都过不去。故这里生成一次并落盘。
    """
    existing = os.environ.get("MINGLI_JWT_SECRET")
    if existing and len(existing) >= 32:
        return existing
    path = _jwt_secret_path()
    try:
        if path.is_file():
            value = path.read_text(encoding="utf-8").strip()
            if len(value) >= 32:
                return value
        value = secrets.token_hex(32)  # 64 个十六进制字符 = 32 字节熵
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        _log("已生成并持久化本机 JWT 密钥（%s）" % path)
        return value
    except Exception as exc:  # noqa: BLE001 - 落盘失败也不能让服务起不来
        _log("JWT 密钥落盘失败（改用进程内临时值，重启后旧 token 失效）：%s: %s"
             % (type(exc).__name__, exc))
        return secrets.token_hex(32)


# ---------------------------------------------------------------------------
# 配置注入（**必须在 import app.main 之前跑**）
# ---------------------------------------------------------------------------

def configure_environment(
    web_root: Optional[str] = None,
    runtime_mode: str = "apk-local",
) -> Dict[str, str]:
    """把 APK 形态需要的配置落到 `os.environ`，返回实际生效项（便于日志与测试断言）。

    **纪律**：只在「未设置」时写入，已存在的环境变量一律尊重（便于测试与桌面调试覆盖）。
    """
    home = home_dir()
    data_dir = home / DATA_DIRNAME
    resolved_web_root = web_root or os.environ.get("MINGLI_WEB_ROOT") or str(home / WEB_DIRNAME)

    wanted = {
        "MINGLI_RUNTIME_MODE": runtime_mode,
        "MINGLI_WEB_ROOT": str(resolved_web_root),
        "MINGLI_DB_PATH": str(data_dir / "mingli_analytics.db"),
        "MINGLI_FEEDBACK_DB_PATH": str(data_dir / "mingli_feedback.db"),
        "MINGLI_OPS_DB_PATH": str(data_dir / "mingli_ops.db"),
        "MINGLI_JWT_SECRET": _ensure_jwt_secret(),
        # ⚠️ 必须设这一项：后端 `app/llm/local_config.py` 的默认落点是
        #    `<数据目录>/llm.json`（= `<HOME>/data/llm.json`），而**本文件的**落点是
        #    `<HOME>/llm.json` —— 不是同一个文件。把环境变量指过来，两边才读写同一份，
        #    否则「设置页改完 → 重启 App」读到的还是旧值（改完不生效）。
        LLM_CONFIG_PATH_ENV_VAR: str(llm_config_path()),
        # 安卓上没有 Node：排盘不走 Node 常驻服务（第三路见下方 TODO）
        "MINGLI_NODE_BIN": os.environ.get("MINGLI_NODE_BIN", ""),
    }

    applied: Dict[str, str] = {}
    for key, value in wanted.items():
        if key == "MINGLI_JWT_SECRET" or not os.environ.get(key):
            os.environ[key] = value
        applied[key] = os.environ[key]

    # 用户自填的大模型配置（「大模型接入」页写入 llm.json）
    llm = load_llm_config() or {}
    llm_env = {
        "MINGLI_LLM_BASE_URL": llm.get("base_url"),
        "MINGLI_LLM_API_KEY": llm.get("api_key"),
        "MINGLI_LLM_MODEL": llm.get("model"),
    }
    for key, value in llm_env.items():
        if value:
            os.environ[key] = str(value)
            applied[key] = "已由设备本地配置提供" if "API_KEY" in key else str(value)
    if not os.environ.get("MINGLI_LLM_API_KEY"):
        _log("未配置大模型 API（应用内「大模型接入」页可填）：AI 解读将 fail loud，确定性排盘照常可用")

    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        _log("数据目录创建失败（%s）：%s" % (data_dir, exc))

    _log("配置已注入：mode=%s web_root=%s db=%s"
         % (applied.get("MINGLI_RUNTIME_MODE"), applied.get("MINGLI_WEB_ROOT"),
            applied.get("MINGLI_DB_PATH")))
    return applied


# ---------------------------------------------------------------------------
# 应用与服务器
# ---------------------------------------------------------------------------

def build_app():
    """import 真正的 FastAPI 应用（`app.main:app`）。

    ⚠️ 调用前**必须**先跑 `configure_environment()`（`app.config.settings` 是模块级单例，
    首次 import 即定格，之后再改环境变量无效）。
    """
    from app.main import app  # noqa: PLC0415 - 有意延迟到环境注入之后
    return app


def _disable_signal_handlers(server) -> None:
    """把 uvicorn 的信号处理器安装覆盖成 no-op。

    MainActivity 在**后台线程**里调 `main()`；uvicorn 默认要装 SIGINT/SIGTERM，
    而只有主线程能装 → `ValueError: signal only works in main thread`。
    安卓下进程生命周期由系统管，不需要 uvicorn 处理信号。
    """
    try:
        server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
        _log("已禁用 uvicorn 信号处理器（后台线程场景，符合预期）")
    except Exception as exc:  # noqa: BLE001
        _log("禁用信号处理器失败（不影响启动）：%s: %s" % (type(exc).__name__, exc))


def create_server(port: Optional[int] = None, host: Optional[str] = None):
    """建 uvicorn Server（**不阻塞**）。调用方自行 `.run()`。"""
    import uvicorn  # noqa: PLC0415

    resolved_port = int(port if port is not None else os.environ.get("MINGLI_APK_PORT") or DEFAULT_PORT)
    resolved_host = str(host if host is not None else os.environ.get("MINGLI_APK_HOST") or DEFAULT_HOST)
    app = build_app()
    config = uvicorn.Config(
        app,
        host=resolved_host,
        port=resolved_port,
        log_level="info",
        access_log=False,   # 安卓上 Logcat 已经很吵；需要排查时打开
        loop="asyncio",     # ⚠️ 不用 uvloop：Chaquopy 索引里没有 uvloop（见 build.gradle.kts 注释）
    )
    server = uvicorn.Server(config)
    _disable_signal_handlers(server)
    return server


def start_background(port: Optional[int] = None, host: Optional[str] = None) -> Tuple[Any, threading.Thread]:
    """后台线程起服务，返回 `(server, thread)`。"""
    server = create_server(port, host)
    thread = threading.Thread(target=server.run, name="apk_asgi", daemon=True)
    thread.start()
    _log("已后台启动：http://%s:%s/（health=/api/health）"
         % (server.config.host, server.config.port))
    return server, thread


def main(port: Optional[int] = None, host: Optional[str] = None, web_root: Optional[str] = None) -> None:
    """MainActivity 的入口：`from apk_asgi import main; main()`。**阻塞**。

    顺序**不可颠倒**：先注入环境 → 再 import 应用 → 最后起服务。
    """
    configure_environment(web_root=web_root)
    server = create_server(port, host)
    _log("=" * 68)
    _log("%s 启动于 http://%s:%s" % (SERVICE_NAME, server.config.host, server.config.port))
    _log("  静态站点根 = %s" % os.environ.get("MINGLI_WEB_ROOT"))
    _log("  形态 = %s" % os.environ.get("MINGLI_RUNTIME_MODE"))
    _log("=" * 68)
    try:
        server.run()
    except KeyboardInterrupt:
        _log("收到中断，关闭服务")
    finally:
        _log("服务已退出")


if __name__ == "__main__":  # 桌面调试：python apk_asgi.py
    main()


# ---------------------------------------------------------------------------
# TODO（节166 未完项，归属后端改动，不属本文件）
# ---------------------------------------------------------------------------
# 排盘第三路：`app/paipan/engine.py` 现状是「httpx 打 Node :9317 → 失败降级 subprocess 跑 paipan-node/*.cjs|mjs」。
# 安卓上**两条路都没有**（无 Node、无子进程执行能力）→ 必须新增第三路：直接调 `paipan_bridge`
# （Python → Java → WebView → JS 内核 bundle）。
# ⚠️ 形态判断只允许走 `app/runtime.py` 的 `capabilities()`（`standards/08` §2.3），**禁止散写 `if mode == ...`**。
# 那处改动在 `backend/`，本文件不动它。
