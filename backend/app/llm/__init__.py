"""LLM 接入层：DeepSeek 官方 API（OpenAI 兼容 /chat/completions）"""
from .client import chat, LLMError

__all__ = ["chat", "LLMError"]
