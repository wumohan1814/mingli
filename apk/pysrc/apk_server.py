"""apk_server —— 「胖 APK」自举 HTTP 服务（**纯 Python 标准库**）。

定位（模式 S）：MainActivity 在后台线程里 `from apk_server import main; main()`，
本服务在 `127.0.0.1` 上同时提供

  1. 静态资源：把「从 assets/web/ 拷出来的目录」当站点根（默认 `<HOME>/web`，
     可用参数或 `MINGLI_WEB_ROOT` 覆盖），供给 App 内 WebView 加载本地前端；
  2. 排盘 API：`/api/paipan/*` —— 经 `paipan_bridge`（Python→Java→WebView→JS 内核）
     直连 bundle，替代原先的 Node 常驻服务。

**本阶段只装标准库**（不装 FastAPI/pydantic —— pydantic-core 的 Android wheel 是后续阶段的事）。

路由表
------
| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/health` | 就绪探针，MainActivity 用它判「Python 侧起来了」。200 恒返回（服务本身存活即 ok） |
| GET  | `/api/paipan/ping` | **真实排盘**自检：固定输入跑 `/ziwei` + `/divination(qimen)`，证明整链通。成功 200 / 失败 503，都是 JSON |
| GET  | `/api/paipan/routes` | bundle 暴露的路由清单 + 桥状态 |
| POST | `/api/paipan/<route>` | **透传**：body 即 payload，`<route>` ∈ `/ziwei /extra /zodiac /tarot /astrology /divination`。与 Node 形态同路径同语义，前端可零改动切换 |
| GET/HEAD | `/`、`/index.html`、`/js/*`、`/css/*`、`/assets/*` … | 静态文件；**缺失 → 404（不是 500）**；目录穿越 → 403 |

配置（参数 > 环境变量 > 默认）
------------------------------
* `port`  ← `MINGLI_APK_PORT`（默认 8765）
* `host`  ← `MINGLI_APK_HOST`（默认 `127.0.0.1`，只监听本机）
* `web_root` ← `MINGLI_WEB_ROOT`（默认 `<HOME>/web`；Chaquopy 里 `HOME` = 应用私有目录，
  即 `context.getFilesDir()` —— **sync 脚本应把 `assets/web/` 拷到 `<filesDir>/web`**）

入口
----
* `main(port=8765, host="127.0.0.1", web_root=None)` —— 建服务并**阻塞** `serve_forever()`
  （MainActivity 必须在**后台线程**调用它；这也符合简报 §2.6 的 Chaquopy 线程注意事项）。
* `create_server(...)` / `start_background(...)` —— 需要自己管线程/生命周期时用。

日志一律打到 stdout（Chaquopy 下重定向到 Logcat），带 `[apk_server]` 前缀。
"""

from __future__ import annotations

import json
import os
import posixpath
import shutil
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Tuple

try:  # 允许非 APK 环境下 import（静态资源调试时也能用）
    import paipan_bridge  # type: ignore
except Exception as _exc:  # noqa: BLE001
    paipan_bridge = None  # type: ignore
    _BRIDGE_IMPORT_ERROR = "%s: %s" % (type(_exc).__name__, _exc)
else:
    _BRIDGE_IMPORT_ERROR = None

__all__ = [
    "SERVICE_NAME",
    "SERVICE_VERSION",
    "DEFAULT_PORT",
    "DEFAULT_HOST",
    "API_PREFIX",
    "PAIPAN_ROUTES",
    "create_server",
    "start_background",
    "main",
    "resolve_web_root",
]

SERVICE_NAME = "mingli-apk-server"
SERVICE_VERSION = "1.0.0"

DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"
DEFAULT_WEB_DIRNAME = "web"

API_PREFIX = "/api/paipan"

#: bundle 的 `dispatch()` 覆盖的路由（与 backend/paipan-node/server.mjs 一一对应）
PAIPAN_ROUTES = ("/ziwei", "/extra", "/zodiac", "/tarot", "/astrology", "/divination")

MAX_BODY_BYTES = 64 * 1024 * 1024  # 与 server.mjs 的 64MB 上限同口径

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json",
}

_STARTED_AT = time.time()


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

def _log(message: str) -> None:
    try:
        sys.stdout.write("[apk_server] %s\n" % message)
        sys.stdout.flush()
    except Exception:  # noqa: BLE001 - 日志不能反过来搞死服务
        pass


def _home_dir() -> str:
    """Chaquopy 下 `HOME` = 应用私有目录（filesDir）；宿主环境退化到 cwd。"""
    home = os.environ.get("HOME")
    if home and os.path.isdir(home):
        return home
    return os.getcwd()


def resolve_web_root(web_root: Optional[str] = None) -> Tuple[str, str]:
    """解析静态站点根。返回 `(绝对路径, 来源说明)`。

    优先级：显式参数 > `MINGLI_WEB_ROOT` > `<HOME>/web`。
    **约定：sync 脚本把 `assets/web/` 拷到 `<HOME>/web`**（= `<filesDir>/web`）。
    """
    if web_root:
        return os.path.abspath(str(web_root)), "参数"
    env = os.environ.get("MINGLI_WEB_ROOT")
    if env:
        return os.path.abspath(env), "环境变量 MINGLI_WEB_ROOT"
    return os.path.abspath(os.path.join(_home_dir(), DEFAULT_WEB_DIRNAME)), "默认 <HOME>/web"


# ---------------------------------------------------------------------------
# 响应工具
# ---------------------------------------------------------------------------

def _json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class _Handler(BaseHTTPRequestHandler):
    server_version = "%s/%s" % (SERVICE_NAME, SERVICE_VERSION)
    protocol_version = "HTTP/1.1"

    # -- 基础 ---------------------------------------------------------------

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        _log("%s - %s" % (self.address_string(), fmt % args))

    def _send(self, status: int, body: bytes, content_type: str, extra: Optional[Dict[str, str]] = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD" and body:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):  # WebView 提前断开：正常
                pass

    def _send_json(self, status: int, payload: Any) -> None:
        self._send(status, _json_bytes(payload), "application/json; charset=utf-8")

    def _send_error_json(self, status: int, message: str, **extra: Any) -> None:
        body: Dict[str, Any] = {"error": message, "status": status}
        body.update(extra)
        self._send_json(status, body)

    # -- GET / HEAD ---------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802
        self._route(send_body=True)

    def do_HEAD(self) -> None:  # noqa: N802
        self._route(send_body=False)

    def do_POST(self) -> None:  # noqa: N802
        # 先无条件读掉 body：HTTP/1.1 keep-alive 下不读会让连接错位
        raw, err = self._read_body()
        parsed = urllib.parse.urlsplit(self.path)
        pathname = parsed.path.rstrip("/") or "/"

        if err is not None:
            status, message = err
            if status == 413:
                self.close_connection = True  # body 没读完，连接不能复用
            self._send_error_json(status, message)
            return

        if pathname.startswith(API_PREFIX + "/"):
            route = "/" + pathname[len(API_PREFIX) + 1:]
            if route in PAIPAN_ROUTES:
                self._handle_paipan_call(route, raw if raw is not None else b"")
                return
            self._send_error_json(
                404,
                "Unknown paipan route: %s. Use %s." % (route, ", ".join(PAIPAN_ROUTES)),
            )
            return

        if pathname.startswith("/api/"):
            self._send_error_json(404, "Unknown API path: %s" % pathname)
            return

        self._send_error_json(405, "Method not allowed. Use GET (static) or POST %s/<route>." % API_PREFIX)

    # -- 路由 ---------------------------------------------------------------

    def _route(self, send_body: bool) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        pathname = urllib.parse.unquote(parsed.path)
        if pathname != "/":
            pathname = pathname.rstrip("/") or "/"

        if pathname == "/api/health":
            self._handle_health()
            return
        if pathname == "/api/paipan/ping":
            self._handle_ping()
            return
        if pathname == API_PREFIX + "/routes":
            self._handle_routes()
            return
        if pathname == API_PREFIX or pathname.startswith(API_PREFIX + "/"):
            self._send_error_json(
                405,
                "paipan API 用 POST：POST %s<route>（body = JSON payload），route ∈ %s。"
                % (API_PREFIX, ", ".join(PAIPAN_ROUTES)),
            )
            return
        if pathname.startswith("/api/"):
            self._send_error_json(404, "Unknown API path: %s" % pathname)
            return

        self._serve_static(pathname, send_body=send_body)

    # -- API：健康 / 路由 ----------------------------------------------------

    def _bridge_status(self) -> Dict[str, Any]:
        if paipan_bridge is None:
            return {
                "available": False,
                "ready": None,
                "last_error": "paipan_bridge 导入失败: %s" % _BRIDGE_IMPORT_ERROR,
            }
        try:
            return {
                "available": bool(paipan_bridge.is_available()),
                "ready": paipan_bridge.is_ready(),
                "unavailable_reason": paipan_bridge.unavailable_reason(),
                "last_error": paipan_bridge.last_error(),
            }
        except Exception as exc:  # noqa: BLE001
            return {"available": False, "ready": None, "last_error": "%s: %s" % (type(exc).__name__, exc)}

    def _handle_health(self) -> None:
        server = self.server
        web_root = getattr(server, "web_root", None)
        web_root_source = getattr(server, "web_root_source", None)
        payload = {
            "ok": True,
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "python": sys.version.split()[0],
            "uptime_s": round(time.time() - _STARTED_AT, 3),
            "host": getattr(server, "server_address", ("?", 0))[0],
            "port": getattr(server, "server_address", ("?", 0))[1],
            "web_root": web_root,
            "web_root_source": web_root_source,
            "web_root_exists": bool(web_root and os.path.isdir(web_root)),
            "web_root_index_exists": bool(web_root and os.path.isfile(os.path.join(web_root, "index.html"))),
            "api_prefix": API_PREFIX,
            "paipan_routes": list(PAIPAN_ROUTES),
            "bridge": self._bridge_status(),
        }
        self._send_json(200, payload)

    def _handle_routes(self) -> None:
        self._send_json(
            200,
            {
                "ok": True,
                "bridge": self._bridge_status(),
                "bundle_routes": list(PAIPAN_ROUTES),
                "post_paths": ["%s%s" % (API_PREFIX, r) for r in PAIPAN_ROUTES],
                "note": "POST 透传路径与 backend/paipan-node/server.mjs 的路由一一对应。",
            },
        )

    # -- API：真实排盘自检 ---------------------------------------------------

    def _handle_ping(self) -> None:
        if paipan_bridge is None:
            self._send_error_json(
                503,
                "bundle 不可用：paipan_bridge 导入失败",
                detail=_BRIDGE_IMPORT_ERROR,
            )
            return
        try:
            result = paipan_bridge.ping()
        except Exception as exc:  # noqa: BLE001 - 诊断端点自己不能炸
            self._send_error_json(
                503,
                "bundle 不可用：ping 执行异常",
                detail="%s: %s" % (type(exc).__name__, exc),
            )
            return
        if isinstance(result, dict) and result.get("ok"):
            self._send_json(200, result)
        else:
            self._send_error_json(
                503,
                "bundle 不可用或排盘失败",
                detail=(result or {}).get("last_error") or (result or {}).get("unavailable_reason"),
                ping=result,
            )

    # -- API：透传到 bundle --------------------------------------------------

    def _read_body(self) -> Tuple[Optional[bytes], Optional[Tuple[int, str]]]:
        """返回 `(body, None)` 或 `(None, (http_status, message))`。"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            return None, (400, "Content-Length 非法")
        if length < 0:
            return None, (400, "Content-Length 非法")
        if length > MAX_BODY_BYTES:
            return None, (413, "请求体过大（上限 %d 字节）" % MAX_BODY_BYTES)
        if length == 0:
            return b"", None
        try:
            return self.rfile.read(length), None
        except Exception as exc:  # noqa: BLE001
            return None, (400, "读取请求体失败: %s: %s" % (type(exc).__name__, exc))

    def _handle_paipan_call(self, route: str, raw: bytes) -> None:
        text = raw.decode("utf-8", errors="replace").strip()
        if not text:
            payload: Dict[str, Any] = {}
        else:
            try:
                parsed = json.loads(text)
            except Exception as exc:  # noqa: BLE001
                self._send_error_json(400, "Invalid JSON body: %s" % exc)
                return
            if not isinstance(parsed, dict):
                self._send_error_json(400, "Invalid JSON body: 顶层必须是对象")
                return
            payload = parsed

        if paipan_bridge is None:
            self._send_error_json(
                503,
                "bundle 不可用：paipan_bridge 导入失败",
                detail=_BRIDGE_IMPORT_ERROR,
            )
            return
        started = time.time()
        try:
            result = paipan_bridge.call(route, payload)
        except Exception as exc:  # noqa: BLE001
            self._send_error_json(
                503,
                "bundle 不可用：调用异常",
                detail="%s: %s" % (type(exc).__name__, exc),
            )
            return
        elapsed = int((time.time() - started) * 1000)
        if isinstance(result, dict) and "error" in result:
            status = 503 if str(result.get("error", "")).startswith("bridge_") else 500
            result = dict(result)
            result.setdefault("route", route)
            result.setdefault("elapsed_ms", elapsed)
            self._send_json(status, result)
            return
        self._send_json(200, result)

    # -- 静态资源 -----------------------------------------------------------

    def _safe_join(self, web_root: str, url_path: str) -> Optional[str]:
        if "\x00" in url_path:
            return None
        cleaned = posixpath.normpath("/" + url_path.lstrip("/"))
        if cleaned in ("/", ""):
            cleaned = "/index.html"
        if cleaned.startswith("/..") or "/../" in cleaned:
            return None
        candidate = os.path.abspath(os.path.join(web_root, cleaned.lstrip("/")))
        root = os.path.abspath(web_root)
        if candidate != root and not candidate.startswith(root + os.sep):
            return None  # 目录穿越
        return candidate

    def _serve_static(self, url_path: str, send_body: bool = True) -> None:
        web_root = getattr(self.server, "web_root", None)
        if not web_root:
            self._send_error_json(
                503,
                "静态资源根未配置",
                hint="设置 MINGLI_WEB_ROOT，或把 assets/web/ 拷到 <HOME>/web",
            )
            return

        target = self._safe_join(web_root, url_path)
        if target is None:
            self._send_error_json(403, "Forbidden: 路径越界", path=url_path)
            return

        if os.path.isdir(target):
            index = os.path.join(target, "index.html")
            if os.path.isfile(index):
                target = index
            else:
                # 简单目录列表（只列一层，便于排查包内是否拷全）
                try:
                    names = sorted(os.listdir(target))
                except OSError as exc:
                    self._send_error_json(500, "目录读取失败: %s" % exc, path=url_path)
                    return
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "directory": url_path,
                        "web_root": web_root,
                        "entries": names,
                        "hint": "没有 index.html；本目录仅供排查。",
                    },
                )
                return

        if not os.path.isfile(target):
            # 关键契约：**缺失文件 404，不是 500**
            self._send_error_json(
                404,
                "Not found: %s" % url_path,
                web_root=web_root,
                hint="确认 sync 脚本已把 assets/web/ 拷到 web_root（见 apk/pysrc/README.md）",
            )
            return

        ext = os.path.splitext(target)[1].lower()
        content_type = MIME_TYPES.get(ext, "application/octet-stream")
        try:
            size = os.path.getsize(target)
        except OSError as exc:
            self._send_error_json(500, "文件状态读取失败: %s" % exc, path=url_path)
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command == "HEAD" or not send_body:
            return
        try:
            with open(target, "rb") as handle:
                shutil.copyfileobj(handle, self.wfile, length=256 * 1024)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except OSError as exc:
            _log("静态文件读取失败 %s: %s" % (target, exc))


# ---------------------------------------------------------------------------
# 服务与入口
# ---------------------------------------------------------------------------

def create_server(
    port: Optional[int] = None,
    host: Optional[str] = None,
    web_root: Optional[str] = None,
) -> ThreadingHTTPServer:
    """建服务（**不阻塞**）。调用方可自行 `serve_forever()` 或交给 `start_background()`。"""
    resolved_port = int(port if port is not None else os.environ.get("MINGLI_APK_PORT") or DEFAULT_PORT)
    resolved_host = str(host if host is not None else os.environ.get("MINGLI_APK_HOST") or DEFAULT_HOST)
    root, source = resolve_web_root(web_root)

    server = ThreadingHTTPServer((resolved_host, resolved_port), _Handler)
    server.daemon_threads = True
    server.web_root = root  # type: ignore[attr-defined]
    server.web_root_source = source  # type: ignore[attr-defined]
    _log("静态根 = %s（来源：%s；存在=%s）" % (root, source, os.path.isdir(root)))
    return server


def start_background(
    port: Optional[int] = None,
    host: Optional[str] = None,
    web_root: Optional[str] = None,
) -> Tuple[ThreadingHTTPServer, threading.Thread]:
    """后台线程起服务，返回 `(server, thread)`；适合需要自己控生命周期的场景。"""
    server = create_server(port, host, web_root)
    thread = threading.Thread(target=server.serve_forever, name="apk_server", daemon=True)
    thread.start()
    address = server.server_address
    _log("已后台启动：http://%s:%s/  （health=%s/health，ping=%s/ping）"
         % (address[0], address[1], "/api", API_PREFIX))
    return server, thread


def main(
    port: Optional[int] = None,
    host: Optional[str] = None,
    web_root: Optional[str] = None,
) -> None:
    """MainActivity 的入口：`from apk_server import main; main()`。

    **阻塞**在 `serve_forever()` —— MainActivity 必须在**后台线程**里调用
    （简报 §2.6：Chaquopy 下 Python 解释器的「主线程」由第一个启动它的线程决定）。
    """
    server = create_server(port, host, web_root)
    address = server.server_address
    _log("=" * 68)
    _log("%s %s 已启动：http://%s:%s" % (SERVICE_NAME, SERVICE_VERSION, address[0], address[1]))
    _log("  GET  http://%s:%s/api/health" % (address[0], address[1]))
    _log("  GET  http://%s:%s/api/paipan/ping" % (address[0], address[1]))
    _log("  POST http://%s:%s%s/<route>  route ∈ %s"
         % (address[0], address[1], API_PREFIX, ", ".join(PAIPAN_ROUTES)))
    _log("  GET  http://%s:%s/  → 静态站点（web_root 见上）" % (address[0], address[1]))
    _log("=" * 68)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        _log("收到中断，关闭服务")
    finally:
        try:
            server.server_close()
        except Exception:  # noqa: BLE001
            pass
        _log("服务已关闭")


if __name__ == "__main__":  # 桌面调试（无 Chaquopy 时只能看静态资源与 health）
    main()
