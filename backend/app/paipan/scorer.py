# -*- coding: utf-8 -*-
"""太初自研 — 契合度打分（纯代码计算，防幻觉）。

对断前尘阶段收集的反馈，把每个命盘类方法算成一个 0–1 的**契合度**分数。
契合度 = 0.5×命中率 + 0.3×命题质量 + 0.2×依据链完整度（保留两位小数）。
**契合度/命中率/命题质量/依据链全部由本模块计算，LLM 不心算、不口算。**

输入：
  1. propositions —— 结构化反馈 `[{"method","domain","claim","feedback"}]`，
     feedback ∈ {confirmed, denied, corrected}；
  2. results —— `{method_key: method-result dict}`（含 past_propositions/conclusions）；
  3. validations —— `{method_key: validation dict}`（含 validations[].severity）。

三因子（均 clamp 到 0–1）：
  1. 命中率 = (confirmed + 0.5×corrected) / (confirmed + denied + corrected)
     —— 分母为 0（该法无任何可计反馈）⇒ 该方法不计入评分；
  2. 命题质量 = 1 − (error×0.5 + warning×0.25 + info×0.1)
     —— error/warning/info 来自该法 validations[].severity 计数；无 validation ⇒ 0.5；
  3. 依据链完整度 = method-result（conclusions + past_propositions）中
     「evidence 非空 或 basis 非空」的条目数 / 总条目数；总条目为 0 ⇒ 0.5。

契合度权重（硬编码契约，勿在运行期改）：W_HIT=0.5 / W_QUALITY=0.3 / W_CHAIN=0.2。
校准权重：weight = 0.4 + 0.6 × 契合度；无反馈方法权重 0.5。
"""

from __future__ import annotations

W_HIT = 0.5
W_QUALITY = 0.3
W_CHAIN = 0.2

FEEDBACK_CONFIRMED = "confirmed"
FEEDBACK_DENIED = "denied"
FEEDBACK_CORRECTED = "corrected"
VALID_FEEDBACK = {FEEDBACK_CONFIRMED, FEEDBACK_DENIED, FEEDBACK_CORRECTED}


def clamp01(value: float) -> float:
    """clamp 到 [0, 1]（防御性，避免数据异常导致分数越界）。"""
    return max(0.0, min(1.0, value))


def _nonempty(value) -> bool:
    """“非空”：None/空串/空列表/空字典 ⇒ False，其余 ⇒ True。"""
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def collect_feedback(propositions):
    """把反馈按方法聚合 → (per_method: {method: {confirmed, denied, corrected}}, order)。

    反馈值只认三态；其余值跳过。"""
    per_method: dict = {}
    order: list = []
    for prop in propositions or []:
        if not isinstance(prop, dict):
            continue
        method = (prop.get("method") or "").strip()
        feedback = (prop.get("feedback") or "").strip()
        if not method:
            continue
        if method not in per_method:
            per_method[method] = {FEEDBACK_CONFIRMED: 0, FEEDBACK_DENIED: 0,
                                  FEEDBACK_CORRECTED: 0}
            order.append(method)
        if feedback not in VALID_FEEDBACK:
            continue
        per_method[method][feedback] += 1
    return per_method, order


def severity_counts(validations) -> tuple:
    """统计 validations[].severity 的 error/warning/info 数量。"""
    error = warning = info = 0
    if not isinstance(validations, list):
        return error, warning, info
    for item in validations:
        if not isinstance(item, dict):
            continue
        sev = (item.get("severity") or "").strip()
        if sev == "error":
            error += 1
        elif sev == "warning":
            warning += 1
        elif sev == "info":
            info += 1
    return error, warning, info


def hit_rate(counts: dict):
    """命中率；分母为 0 返回 None（该法不计入表）。"""
    num = counts[FEEDBACK_CONFIRMED] + 0.5 * counts[FEEDBACK_CORRECTED]
    den = (counts[FEEDBACK_CONFIRMED] + counts[FEEDBACK_DENIED]
           + counts[FEEDBACK_CORRECTED])
    if den == 0:
        return None
    return clamp01(num / den)


def quality_score(validation):
    """命题质量。无 validation ⇒ 0.5。"""
    if not isinstance(validation, dict):
        return 0.5
    error, warning, info = severity_counts(validation.get("validations"))
    return clamp01(1.0 - (error * 0.5 + warning * 0.25 + info * 0.1))


def chain_completeness(result):
    """依据链完整度。method-result 缺失/总条目 0 ⇒ 0.5。"""
    entries = []
    if isinstance(result, dict):
        for key in ("conclusions", "past_propositions"):
            part = result.get(key)
            if isinstance(part, list):
                entries.extend(part)
    total = len(entries)
    if total == 0:
        return 0.5
    covered = sum(
        1 for e in entries
        if isinstance(e, dict) and (_nonempty(e.get("evidence"))
                                    or _nonempty(e.get("basis"))))
    return clamp01(covered / total)


def score_fit(propositions, results=None, validations=None) -> dict:
    """逐方法算三因子与契合度。

    返回 `{"rows": [{"method","hit_rate","quality","chain","fit"}], "by_method": {method: row}}`。
    无反馈的方法不进入 rows（命中率分母为 0）。
    """
    results = results or {}
    validations = validations or {}
    per_method, order = collect_feedback(propositions)
    rows = []
    for method in order:
        counts = per_method[method]
        hit = hit_rate(counts)
        if hit is None:
            continue
        quality = quality_score(validations.get(method))
        chain = chain_completeness(results.get(method))
        fit = round(W_HIT * hit + W_QUALITY * quality + W_CHAIN * chain, 2)
        rows.append({
            "method": method,
            "hit_rate": round(hit, 2),
            "quality": round(quality, 2),
            "chain": round(chain, 2),
            "fit": fit,
        })
    return {
        "rows": rows,
        "by_method": {r["method"]: r for r in rows},
    }


def calibration_weight(fit: float) -> float:
    """校准权重 = 0.4 + 0.6 × 契合度。无反馈方法的权重为 0.5（调用方自行判断）。"""
    return round(0.4 + 0.6 * clamp01(fit), 4)
