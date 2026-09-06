"""HTTP 请求埋点中间件：记录每个 /api/* 请求（method/path/status/latency/user_id）。"""
import logging
import time

from app.auth.router import get_user_id_from_token
from app.events.service import record_event

logger = logging.getLogger(__name__)


async def api_metrics_middleware(request, call_next):
    """记录 /api/* 请求埋点；跳过 /api/events 自身（避免递归）。"""
    path = request.url.path
    if not path.startswith("/api") or path == "/api/events":
        return await call_next(request)

    start = time.perf_counter()
    response = await call_next(request)
    latency_ms = int((time.perf_counter() - start) * 1000)

    user_id = None
    auth = request.headers.get("authorization")
    if auth:
        try:
            user_id = get_user_id_from_token(auth)
        except Exception:
            user_id = None

    record_event(
        "api_request",
        user_id=user_id,
        props={
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "latency_ms": latency_ms,
        },
    )
    return response
