"""LLM 客户端：DeepSeek 官方 API（OpenAI 兼容）chat/completions。

- API Key 唯一来源：settings.llm_api_key（MINGLI_LLM_API_KEY，从环境变量 / backend/.env 读入）。
  本模块与全项目代码零硬编码 key。
- 可重试错误（超时 / 429 / 5xx / 连接错误）按 settings.llm_max_retries 指数退避重试；
  4xx（401 鉴权、400 参数、404 模型不存在等）不重试，直接抛 LLMError。
"""
import asyncio
import contextvars
import logging

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

# 进程内 usage 账本（MVP 单进程）。
# 用 contextvars.ContextVar 按 asyncio task 隔离：asyncio.gather / create_task 会为每个
# 协程复制当前 context，因此每个并发 method 协程内只累计它自己的 chat 调用，编排层
# 的「快照差值」即为该法自己的消耗（并发下逐法扣费精确）。
# 纪律：**绝不可原地修改 `.get()` 返回的 dict**——ContextVar 隔离靠「读当前 → 构造
# 新 dict → `.set()`」实现；reset_usage / chat 累加全部走 `.set()` 新对象，default 与
# 各 context 持有的旧 dict 永不 mutate，避免污染共享对象。
_default_usage = {"prompt_tokens": 0, "prompt_cache_hit_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "calls": 0}
_usage_var: contextvars.ContextVar[dict] = contextvars.ContextVar("llm_usage", default=_default_usage)


def reset_usage() -> None:
    """清零当前 context 的 usage 账本（编排任务开始时调用）。"""
    _usage_var.set(dict(_default_usage))


def get_usage() -> dict:
    """返回当前 context 累计 usage 的副本。"""
    return dict(_usage_var.get())


class LLMError(Exception):
    """LLM 调用失败（网络/鉴权/超时/非2xx/解析失败等）。"""

    def __init__(self, message: str, *, status: int | None = None, retriable: bool = False):
        super().__init__(message)
        self.status = status
        self.retriable = retriable


def _truncate(text: str, limit: int = 500) -> str:
    """截断错误响应体，避免日志被超长响应刷屏。"""
    if text is None:
        return ""
    text = text.strip()
    return text if len(text) <= limit else text[:limit] + "…(truncated)"


def _raise_from_response(status_code: int, body: str) -> LLMError:
    """按 HTTP 状态分类错误：4xx 不可重试，429/5xx 可重试。"""
    retriable = status_code == 429 or status_code >= 500
    message = f"LLM 返回非2xx: status={status_code} body={_truncate(body)}"
    return LLMError(message, status=status_code, retriable=retriable)


def _parse_success(data: dict, model: str) -> dict:
    """解析 200 响应，返回 {content, usage, model}。"""
    choices = data.get("choices") if isinstance(data, dict) else None
    if not choices:
        raise LLMError(f"LLM 响应缺少 choices 或为空: {_truncate(str(data))}")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        # DeepSeek 推理模型（如 deepseek-v4-flash）在 json_mode 下可能把结果放进
        # reasoning_content（推理字段），而 content 为空 → 回退到 reasoning_content。
        content = message.get("reasoning_content") or ""
    if not content:
        raise LLMError(f"LLM 响应 content 为空: {_truncate(str(data))}")
    usage = data.get("usage") or {}
    return {
        "content": content,
        "usage": {
            "prompt_tokens": int(usage.get("prompt_tokens", 0)),
            "prompt_cache_hit_tokens": int(usage.get("prompt_cache_hit_tokens", 0)),
            "completion_tokens": int(usage.get("completion_tokens", 0)),
            "total_tokens": int(usage.get("total_tokens", 0)),
        },
        "model": data.get("model") or model,
    }


async def chat(
    messages: list[dict],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    json_mode: bool = False,
    timeout: float | None = None,
) -> dict:
    """调用 DeepSeek chat/completions，返回
    {"content": str, "usage": {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int}, "model": str}
    """
    if not settings.llm_api_key:
        raise LLMError("未配置 MINGLI_LLM_API_KEY")

    api_key = settings.llm_api_key
    base_url = settings.llm_base_url.rstrip("/")
    model = model or settings.llm_model
    temperature = settings.llm_temperature if temperature is None else temperature
    timeout_s = settings.llm_timeout if timeout is None else timeout
    max_retries = max(0, settings.llm_max_retries)

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error: LLMError | None = None
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        for attempt in range(1, max_retries + 2):  # 1 次原始调用 + max_retries 次重试
            try:
                response = await client.post(url, json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                last_error = LLMError(f"LLM 请求超时: {exc}", retriable=True)
            except httpx.TransportError as exc:
                last_error = LLMError(f"LLM 连接错误: {exc}", retriable=True)
            else:
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except ValueError as exc:
                        raise LLMError(f"LLM 响应解析失败: {exc} body={_truncate(response.text)}") from exc
                    result = _parse_success(data, model)
                    usage = result["usage"]
                    logger.info(
                        "LLM chat 成功 model=%s prompt_tokens=%s completion_tokens=%s total_tokens=%s",
                        result["model"], usage["prompt_tokens"], usage["completion_tokens"], usage["total_tokens"],
                    )
                    # 成功返回前把本次 usage 累加进当前 context 的账本（calls+1）。
                    # 读当前 → 构造新 dict → .set()，绝不原地修改 .get() 返回的 dict。
                    cur = _usage_var.get()
                    _usage_var.set({
                        "prompt_tokens": cur["prompt_tokens"] + int(usage["prompt_tokens"]),
                        "prompt_cache_hit_tokens": cur["prompt_cache_hit_tokens"] + int(usage.get("prompt_cache_hit_tokens", 0)),
                        "completion_tokens": cur["completion_tokens"] + int(usage["completion_tokens"]),
                        "total_tokens": cur["total_tokens"] + int(usage["total_tokens"]),
                        "calls": cur["calls"] + 1,
                    })
                    _record_llm_event(result["model"], usage, success=True)
                    return result
                last_error = _raise_from_response(response.status_code, response.text)

            if last_error.retriable and attempt <= max_retries:
                delay = 2 ** (attempt - 1)  # 1s / 2s / 4s …
                logger.warning("LLM 调用失败将重试: %s (attempt=%s/%s, delay=%ss)",
                               last_error, attempt, max_retries + 1, delay)
                await asyncio.sleep(delay)
            else:
                break

    assert last_error is not None  # 循环内必赋值
    _record_llm_event(model, None, success=False, error=str(last_error)[:200])
    raise last_error


def _record_llm_event(model: str, usage: dict | None, *, success: bool, error: str = "") -> None:
    """LLM 调用埋点（llm_call）。函数内 import 避免循环依赖。"""
    try:
        from app.events.service import record_event
        props = {"model": model, "success": success}
        if usage:
            props.update({
                "prompt_tokens": usage.get("prompt_tokens"),
                "prompt_cache_hit_tokens": usage.get("prompt_cache_hit_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens"),
            })
        if error:
            props["error"] = error
        record_event("llm_call", props=props)
    except Exception:
        logger.warning("llm_call 埋点失败", exc_info=True)
