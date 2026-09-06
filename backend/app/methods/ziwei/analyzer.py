"""ziwei 方法模块 · 真实 LLM 实现（DeepSeek）"""
from app.methods.base import analyze_method

METHOD_KEY = "ziwei"


async def analyze(phase: str, slice_data: dict, user_question: str = "", calibration_feedback: dict = None) -> dict | None:
    return await analyze_method(METHOD_KEY, phase, slice_data, user_question, calibration_feedback)
