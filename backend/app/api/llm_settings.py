# -*- coding: utf-8 -*-
"""应用内「大模型接入」API（节 166）——单机形态下由用户自填大模型端点与凭据。

## 为什么只有单机形态有这个

用户原话：「胖 APK 中需要有一个地方可以让用户在本地调用 API 去连接大模型。」
对应能力键 `byo_llm_key`（`app/runtime.py` 的 `capabilities()`）——
**只有 `apk-local` 为真**：web 形态的 key 是服务端运维配置，用户侧不给入口；
apk-client 走服务器的 key，设备不直连。

## 硬约束（逐条写在这里，改代码前先读）

1. **形态门 = 404，不是 403**：`byo_llm_key` 为假时三个端点**一律 404**。
   理由：「这个形态没有这个功能」比「你没权限」更准确，也更少泄漏信息
   —— 403 等于告诉探查者「这里有个功能，只是你没权限」。
   判定**只走 `capabilities()`**，禁止散写 `if mode == ...`（`docs/standards/08` §2.3）。
2. **绝不回显 key**：GET / PUT 只给 `has_key`（布尔），**任何响应体、日志、
   错误详情里都不出现 key 本身**。测试端点失败时也只报状态码与地址，不带 headers。
3. **鉴权与其它业务端点一致**（`Authorization` 头）。单机形态下前端从
   `/api/runtime` 的 `local_token` 拿到本机 token（见 `app/local_session.py`），
   所以这条过得去 —— 这也正是「免登录 ≠ 无 token」那条结论的落点。
4. **改动即时生效**：PUT 只写文件是不够的 —— `app.config.settings` 是模块级单例，
   业务代码读的是它。故 PUT 必须**同时**改内存里的 `settings.llm_*`（见 `_apply`）。
5. 落盘口径与「两边同一个文件」的约定 → 见 `app/llm/local_config.py` 的 docstring。

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/llm/settings` | 当前**生效**的 base_url / model + `has_key`（不回显 key） |
| PUT  | `/api/llm/settings` | 部分更新；`api_key` 传空串 = **保持不变**，清空用 `clear_api_key: true` |
| POST | `/api/llm/test`     | **真发一次**最小请求验证连通；失败给出可读原因分类 |
"""
from __future__ import annotations

import time
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.auth.router import get_user_id_from_token
from app.config import settings
from app.llm import local_config
from app.runtime import capabilities

router = APIRouter(prefix="/api/llm", tags=["llm-settings"])

#: 连通性测试的超时（秒）。**刻意短**：这是交互式按钮，用户等不了
#: `settings.llm_timeout`（默认 180s，那是给长 prompt 的 method 解读用的）。
TEST_TIMEOUT_S = 15.0

#: 测试用的最小 prompt（1 token 上限，花费可忽略）
_TEST_MESSAGES = [{"role": "user", "content": "ping"}]


def _require_byo_llm_key() -> None:
    """形态门（约束 1）。非单机形态 → 404。"""
    if not capabilities().get("byo_llm_key"):
        raise HTTPException(status_code=404, detail="Not Found")


def _current_payload() -> dict:
    """当前**生效**的配置（读 `settings`，即业务代码真正会用的那份）。

    ⚠️ 只给 `has_key`，**不给 key**（约束 2）。
    """
    return {
        "base_url": settings.llm_base_url,
        "model": settings.llm_model,
        "has_key": local_config.has_key(),
    }


def _envelope() -> dict:
    return {"code": 0, "message": "ok", "data": _current_payload()}


class LlmSettingsUpdateRequest(BaseModel):
    """PUT body。**各字段均可选**：只更新显式给出的那些。

    ⚠️ `api_key` 的语义（易错，写死在这里）：
    - **不传**（None）→ 保持不变；
    - **传空串**（`""`）→ **也保持不变** —— 因为前端表单永远不会回显 key，
      用户只改型号时提交的 api_key 必然是空串，若把空串当「清空」，
      就会**改一次型号把 key 抹掉**；
    - **要清空** → 显式传 `clear_api_key: true`（唯一清空途径）。
    """
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    clear_api_key: bool = False


def _apply(final: dict) -> None:
    """把合并后的配置写进内存单例（约束 4：PUT 之后无需重启即生效）。

    `base_url` / `model` 为空时**回退到现值**（它们有有意义的默认值，
    被空串抹掉会让 LLM 调用直接打到一个残地址）；
    `api_key` 允许被显式清空（这是 `clear_api_key` 的用途）。
    """
    settings.llm_base_url = final["base_url"] or settings.llm_base_url
    settings.llm_model = final["model"] or settings.llm_model
    settings.llm_api_key = final["api_key"]


@router.get("/settings")
def get_llm_settings(authorization: str = Header(...)):
    """读当前生效的「大模型接入」配置（**不回显 key**）。"""
    _require_byo_llm_key()
    get_user_id_from_token(authorization)
    return _envelope()


@router.put("/settings")
def put_llm_settings(
    req: LlmSettingsUpdateRequest,
    authorization: str = Header(...),
):
    """部分更新配置：落盘 + 立刻改动内存单例（无需重启）。"""
    _require_byo_llm_key()
    get_user_id_from_token(authorization)

    merged = local_config.load()
    if req.base_url is not None:
        merged["base_url"] = req.base_url.strip()
    if req.model is not None:
        merged["model"] = req.model.strip()
    if req.api_key:                      # 空串 / None → 保持不变（见类 docstring）
        merged["api_key"] = req.api_key.strip()
    if req.clear_api_key:                # 唯一清空途径
        merged["api_key"] = ""

    local_config.save(merged)
    _apply(merged)
    return _envelope()


def _classify_failure(exc: Exception, url: str) -> str:
    """把 httpx 异常翻译成**用户能看懂**的原因（约束 2：不带凭据、不带 headers）。"""
    if isinstance(exc, httpx.TimeoutException):
        return f"连接超时（{TEST_TIMEOUT_S:.0f} 秒内无响应）：{url}"
    if isinstance(exc, httpx.ConnectError):
        return f"连不上该地址（域名解析失败 / 端口不通 / 证书不受信）：{url}"
    if isinstance(exc, httpx.TransportError):
        return f"网络错误：{type(exc).__name__}（{url}）"
    return f"请求失败：{type(exc).__name__}"


def _classify_status(status: int, url: str) -> str:
    """按状态码给出可操作的原因（401/404 是最常见的两类错配）。"""
    if status in (401, 403):
        return f"API Key 无效或不被接受（HTTP {status}）—— 请核对 Key 与所属平台是否一致"
    if status == 404:
        return (f"接口地址不对（HTTP 404）：服务端没有 {url} —— "
                "请核对「接口地址」，OpenAI 兼容端点通常需要带 /v1")
    if status == 429:
        return "被服务端限流（HTTP 429）—— 稍后再试"
    if status >= 500:
        return f"服务端故障（HTTP {status}）—— 可能稍后恢复"
    return f"服务端拒绝（HTTP {status}）"


@router.post("/test")
async def test_llm_connection(authorization: str = Header(...)):
    """真发一次最小请求验证连通（约束：**不打日志里的 key、不 Echo headers**）。

    无论成败都返回 **200**：这是「测试结果」，不是「请求失败」——
    用 4xx/5xx 表达结果会让前端把「Key 填错了」误当成接口挂了。
    """
    _require_byo_llm_key()
    get_user_id_from_token(authorization)

    base_url = (settings.llm_base_url or "").rstrip("/")
    if not local_config.has_key():
        # 不消费网络：没 key 一定失败，提前给结论（确定性排盘不受影响，这是用户硬要求）
        return {"code": 0, "message": "ok",
                "data": {"ok": False, "detail": "尚未配置 API Key：请填写 Key 后点「保存」再测试",
                         "latency_ms": 0}}
    if not base_url:
        return {"code": 0, "message": "ok",
                "data": {"ok": False, "detail": "尚未配置接口地址（base_url）", "latency_ms": 0}}

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model,
        "messages": _TEST_MESSAGES,
        "max_tokens": 1,
        "temperature": 0,
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=TEST_TIMEOUT_S) as client:
            response = await client.post(url, json=payload, headers=headers)
    except Exception as exc:  # noqa: BLE001 - 测试端点的职责就是把失败讲清楚
        elapsed = int((time.perf_counter() - started) * 1000)
        return {"code": 0, "message": "ok",
                "data": {"ok": False, "detail": _classify_failure(exc, url),
                         "latency_ms": elapsed}}

    elapsed = int((time.perf_counter() - started) * 1000)
    if response.status_code == 200:
        detail = f"连通成功（{settings.llm_model} @ {base_url}）"
        return {"code": 0, "message": "ok",
                "data": {"ok": True, "detail": detail, "latency_ms": elapsed}}
    return {"code": 0, "message": "ok",
            "data": {"ok": False, "detail": _classify_status(response.status_code, url),
                     "latency_ms": elapsed}}
