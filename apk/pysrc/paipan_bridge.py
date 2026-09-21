"""paipan_bridge —— Python → Java(PaipanBridge) → WebView(V8) → JS 排盘内核 的桥。

用法（仅限 APK 内 Chaqopy 环境）::

    import paipan_bridge
    paipan_bridge.init()                                  # 幂等；注入 bundle + 固定时区 +480
    data = paipan_bridge.call("/ziwei", {"birthday": "1990-05-12", "time_idx": 7, "gender": "男"})
    # data 是 dict；失败时是 {"error": "...", "detail": "..."}，**不会抛异常**

契约（节142 / 去 Node 路线）：
  * `call(path, payload: dict) -> dict`：**json 进 json 出**；
  * 异常、超时、bundle 未就绪 → 一律化为错误 dict（`{"error": ...}`），**不向上抛**；
  * 模块可在**非 Chaquopy** 环境安全 import（`from java import jclass` 被 try/except 包住）；
    真正调用时才给出清晰的 `RuntimeError("仅在 APK 内可用")`。

Java 侧签名（见 apk/app/src/main/java/com/mingli/apk/PaipanBridge.kt）::

    PaipanBridge.init(ctx: Context)
    PaipanBridge.call(path: String, payloadJson: String, timeoutMs: Long = 60000): String
    // 额外诊断用（@JvmStatic 静态）：isReady(): Boolean / lastError(): String? / reset()

注意：Kotlin `object` 的方法只有加了 `@JvmStatic` 才是 Java 静态方法，
Python 侧用 `jclass(...)` 拿到的类对象只能调静态方法——本桥依赖 Kotlin 侧的 `@JvmStatic`。
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Dict, Optional

__all__ = [
    "BRIDGE_CLASS_NAME",
    "is_available",
    "unavailable_reason",
    "init",
    "call",
    "call_json",
    "is_ready",
    "last_error",
    "ping",
    "AVAILABLE_IN_APK_ONLY",
]

BRIDGE_CLASS_NAME = "com.mingli.apk.PaipanBridge"

AVAILABLE_IN_APK_ONLY = "仅在 APK 内可用"

# ---------------------------------------------------------------------------
# 受保护的 Chaquopy import：非 APK 环境下 import 本模块**不能崩**
# ---------------------------------------------------------------------------
_jclass = None
_IMPORT_ERROR: Optional[str] = None
try:  # pragma: no cover - 分支取决于是否运行在 Chaquopy 里
    from java import jclass as _jclass  # type: ignore
except Exception as _exc:  # noqa: BLE001 - 故意吞掉一切，import 阶段绝不炸
    _jclass = None
    _IMPORT_ERROR = "%s: %s" % (type(_exc).__name__, _exc)

_lock = threading.Lock()
_class_cache: Any = None
_init_attempted = False
_init_result: Optional[bool] = None
_init_detail: Optional[str] = None


def is_available() -> bool:
    """当前环境是否具备调用 Java 桥的条件（Chaquopy 的 `java` 模块可用）。"""
    return _jclass is not None


def unavailable_reason() -> Optional[str]:
    """不可用原因（可用时为 None）。"""
    if _jclass is not None:
        return None
    return "%s（%s）" % (AVAILABLE_IN_APK_ONLY, _IMPORT_ERROR or "未找到 Chaquopy 的 java 模块")


def _error(kind: str, detail: str = "", **extra: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {"error": kind, "detail": detail, "bridge": "paipan-webview-iife"}
    out.update(extra)
    return out


def _bridge_class() -> Any:
    """解析并缓存 `com.mingli.apk.PaipanBridge` 类对象。失败抛 RuntimeError。"""
    global _class_cache
    if _class_cache is not None:
        return _class_cache
    if _jclass is None:
        raise RuntimeError(unavailable_reason() or AVAILABLE_IN_APK_ONLY)
    with _lock:
        if _class_cache is None:
            _class_cache = _jclass(BRIDGE_CLASS_NAME)
        return _class_cache


def _android_context() -> Any:
    """取 Android application context（不 new Activity —— 见简报 §2.6 的踩坑清单）。"""
    from java import jclass as _jc  # 局部 import：只有这条路才需要

    platform = _jc("com.chaquo.python.Python").getPlatform()
    return platform.getApplication()


def _safe_get_bool(obj: Any, method: str) -> Optional[bool]:
    try:
        value = getattr(obj, method)()
    except Exception:  # noqa: BLE001
        return None
    if value is None:
        return None
    try:
        return bool(value)
    except Exception:  # noqa: BLE001
        return None


def _safe_get_str(obj: Any, method: str) -> Optional[str]:
    try:
        value = getattr(obj, method)()
    except Exception:  # noqa: BLE001
        return None
    return None if value is None else str(value)


def init(context: Any = None, timeout_ms: int = 60000) -> bool:
    """注入 bundle + `setTimezoneOffsetMinutes(480)`。幂等。

    返回是否就绪；**不抛异常**（环境不可用时返回 False 并可查 `last_error()`）。
    """
    global _init_attempted, _init_result, _init_detail
    if _init_attempted and _init_result:
        return True
    with _lock:
        if _init_attempted and _init_result:
            return True
        _init_attempted = True
        try:
            cls = _bridge_class()
            ctx = context if context is not None else _android_context()
            cls.init(ctx)
            ready = _safe_get_bool(cls, "isReady")
            _init_result = bool(ready) if ready is not None else True
            _init_detail = _safe_get_str(cls, "lastError")
        except Exception as exc:  # noqa: BLE001 - Java 异常也在这里被收敛
            _init_result = False
            _init_detail = "%s: %s" % (type(exc).__name__, exc)
    return bool(_init_result)


def is_ready() -> Optional[bool]:
    """bundle 是否已就绪（环境不可用时 None）。"""
    try:
        return _safe_get_bool(_bridge_class(), "isReady")
    except Exception:  # noqa: BLE001
        return None


def last_error() -> Optional[str]:
    """最近一次桥内错误（无则 None）。"""
    if _init_detail:
        return _init_detail
    try:
        return _safe_get_str(_bridge_class(), "lastError")
    except Exception:  # noqa: BLE001
        return unavailable_reason()


def call_json(path: str, payload_json: str = "", timeout_ms: int = 60000) -> Dict[str, Any]:
    """按 JSON 字符串调用；返回 dict（解析失败也返回错误 dict）。"""
    if not isinstance(path, str) or not path:
        return _error("bridge_bad_path", "path 必须是非空字符串")
    if payload_json is None:
        payload_json = ""
    if not isinstance(payload_json, str):
        return _error("bridge_bad_payload", "payload_json 必须是字符串")
    try:
        timeout = int(timeout_ms)
    except Exception:  # noqa: BLE001
        timeout = 60000

    try:
        cls = _bridge_class()
    except RuntimeError as exc:
        return _error("bridge_unavailable", str(exc))

    try:
        raw = cls.call(path, payload_json, timeout)
    except Exception as exc:  # noqa: BLE001 - 桥内错误不向上抛
        return _error("bridge_call_failed", "%s: %s" % (type(exc).__name__, exc))

    if raw is None:
        return _error("bridge_empty_result", "PaipanBridge.call 返回 None")
    text = str(raw)
    if not text:
        return _error("bridge_empty_result", "PaipanBridge.call 返回空串")
    try:
        parsed = json.loads(text)
    except Exception as exc:  # noqa: BLE001
        return _error(
            "bridge_invalid_json",
            "%s: %s" % (type(exc).__name__, exc),
            raw_head=text[:400],
        )
    if isinstance(parsed, dict):
        return parsed
    return {"value": parsed}


def call(path: str, payload: Optional[Dict[str, Any]] = None, timeout_ms: int = 60000) -> Dict[str, Any]:
    """**主入口**：`path` 形如 `/ziwei`，`payload` 为 dict；返回 dict（永不抛异常）。

    首次调用会自动 `init()`（幂等），让调用方不必关心初始化时序。
    """
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        return _error("bridge_bad_payload", "payload 必须是 dict")
    if not init():
        return _error(
            "bridge_not_initialized",
            last_error() or "PaipanBridge.init() 未成功",
        )
    try:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    except Exception as exc:  # noqa: BLE001
        return _error("bridge_bad_payload", "payload 无法 JSON 序列化: %s" % exc)
    return call_json(path, body, timeout_ms)


# ping 用固定输入（真实排盘，不是假数据）
PING_CASES = (
    ("/ziwei", {"birthday": "1990-05-12", "time_idx": 7, "gender": "男"}),
    ("/divination", {"method": "qimen", "customDate": "2024-02-04 16:30:00"}),
)


def ping(timeout_ms: int = 60000) -> Dict[str, Any]:
    """诊断：跑固定输入的真实排盘，证明「Python→Java→WebView→JS」整链通。"""
    started = time.time()
    available = is_available()
    ready_before = is_ready() if available else None
    cases = []
    all_ok = True
    for path, payload in PING_CASES:
        t0 = time.time()
        result = call(path, payload, timeout_ms)
        ms = int((time.time() - t0) * 1000)
        ok = isinstance(result, dict) and "error" not in result
        if not ok:
            all_ok = False
        cases.append(
            {
                "path": path,
                "input": payload,
                "ok": ok,
                "ms": ms,
                "error": None if ok else result.get("error"),
                "detail": None if ok else result.get("detail"),
                "summary": _summarize(path, result) if ok else None,
            }
        )
    return {
        "ok": all_ok and available,
        "java_bridge_available": available,
        "unavailable_reason": unavailable_reason(),
        "ready_before": ready_before,
        "ready_after": is_ready() if available else None,
        "last_error": last_error(),
        "elapsed_ms": int((time.time() - started) * 1000),
        "tz_offset_minutes": 480,
        "cases": cases,
    }


def _summarize(path: str, result: Dict[str, Any]) -> Dict[str, Any]:
    """给 ping 用的少量关键字段（避免把整盘塞进健康检查响应）。"""
    if path == "/ziwei":
        palaces = result.get("palaces") or []
        return {
            "soul_palace": result.get("soul_palace"),
            "body_palace": result.get("body_palace"),
            "five_elements_class": result.get("five_elements_class"),
            "lunar_date": result.get("lunar_date"),
            "palace_count": len(palaces) if isinstance(palaces, list) else None,
            "sihua_count": len(result.get("sihua") or []),
        }
    if path == "/divination":
        return {
            "method": result.get("method") or result.get("qimenMethod"),
            "ju_shu": result.get("juShu"),
            "is_yang_dun": result.get("isYangDun"),
            "current_term": result.get("currentTerm"),
        }
    return {"keys": sorted(result.keys())[:20]}
