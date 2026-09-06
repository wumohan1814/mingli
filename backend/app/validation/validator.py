"""校验模块（ADR-0002：仅断前尘阶段执行，可整体开关）

对每个方法的 past_propositions 进行独立校验（真实 LLM，独立校验模型、单独计量）。

输出契约与 `paipan/scorer.py::quality_score()` 对齐：
scorer 读 `validation["validations"][].severity`（error/warning/info）计数计算「命题质量」因子。
（旧版返回 proposition_scores 的契约已废弃，勿再使用。）

失败策略：LLM 调用失败（LLMError）或输出解析失败（ValueError）一律记日志后**向上抛**，
由编排层决定该校验失败如何处理；绝不返回伪造的 0.5 / 空分数兜底。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings
from app.llm import LLMError, chat

logger = logging.getLogger(__name__)

# validator.py 位于 backend/app/validation/，parents[2] = backend
VALIDATION_PROMPT_PATH = (
    Path(__file__).resolve().parents[2] / "prompts" / "shared" / "validation.md"
)

VALID_SEVERITIES = {"error", "warning", "info"}


def _load_validation_prompt() -> str:
    """读取 shared/validation.md；缺失视为配置错误（RuntimeError，向上抛）。"""
    try:
        text = VALIDATION_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"校验提示词缺失或不可读: {VALIDATION_PROMPT_PATH}") from exc
    if not text.strip():
        raise RuntimeError(f"校验提示词为空: {VALIDATION_PROMPT_PATH}")
    return text


def _strip_code_fence(text: str) -> str:
    """去掉外围 markdown code fence（```json … ``` 或 ``` … ```）。"""
    lines = text.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def parse_validations(text: str) -> list[dict]:
    """解析校验 LLM 输出的 validations 列表；失败抛 ValueError。

    每项归一为 {"proposition_index", "claim", "severity", "reason"}：
    severity ∈ {error, warning, info}，非法/缺失值默认 "info"。
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("校验 LLM 输出为空或非文本")
    cleaned = _strip_code_fence(text.strip())
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"校验 LLM 输出中未找到 JSON 对象: {cleaned[:200]!r}")
    payload = cleaned[start:end + 1]
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"校验 JSON 解析失败: {exc} — 原文片段: {payload[:300]!r}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"校验输出必须是 JSON 对象，实际为 {type(data).__name__}")
    raw = data.get("validations")
    if raw is None:
        raise ValueError("校验输出缺少 validations 字段")
    if not isinstance(raw, list):
        raise ValueError(f"validations 必须是数组，实际为 {type(raw).__name__}")

    out: list[dict] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            logger.warning("跳过非对象校验条目 index=%s: %r", i, item)
            continue
        severity = str(item.get("severity") or "").strip().lower()
        if severity not in VALID_SEVERITIES:
            if severity:
                logger.warning("非法 severity 值 %r 已归一为 info（条目 %s）", severity, i)
            severity = "info"
        out.append({
            "proposition_index": item.get("proposition_index", i),
            "claim": item.get("claim") or "",
            "severity": severity,
            "reason": item.get("reason") or "",
        })
    return out


async def validate(method_result: dict, slice_data: dict | None = None) -> dict:
    """校验方法结果（真实 LLM）。

    Args:
        method_result: 方法模块产出的 method-result v2（读其 past_propositions）。
        slice_data: 该方法的盘面片段（可选，供校验器对照事实）。

    Returns:
        {
          "validated": bool,
          "model": str,                       # settings.llm_validation_model
          "validations": [                    # 与 scorer.quality_score() 对齐
            {"proposition_index": int, "claim": str,
             "severity": "error"|"warning"|"info", "reason": str}
          ],
        }
        校验关闭时另有 "reason" 字段。
    """
    if not settings.validation_enabled:
        return {
            "validated": False,
            "model": settings.llm_validation_model,
            "validations": [],
            "reason": "校验已关闭（TAICHU_VALIDATION_ENABLED=false）",
        }

    propositions = method_result.get("past_propositions") if isinstance(method_result, dict) else None
    if not propositions:
        return {
            "validated": True,
            "model": settings.llm_validation_model,
            "validations": [],
        }

    prompt = _load_validation_prompt()
    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": json.dumps(
                {"method_result": method_result, "slice": slice_data},
                ensure_ascii=False,
            ),
        },
    ]

    try:
        resp = await chat(messages, model=settings.llm_validation_model, json_mode=True)
        validations = parse_validations(resp["content"])
    except LLMError as exc:
        logger.warning("命题校验 LLM 调用失败，交由编排层决定处理: %s", exc)
        raise
    except ValueError as exc:
        logger.warning("命题校验 LLM 输出解析失败，交由编排层决定处理: %s", exc)
        raise

    return {
        "validated": True,
        "model": settings.llm_validation_model,
        "validations": validations,
    }
