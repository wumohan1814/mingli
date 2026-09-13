# -*- coding: utf-8 -*-
"""命理太初自研 — 契合度打分（纯代码计算，防幻觉）。

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


# --------------------------------------------------------------------------- #
# 节116 第④步 · 方向级模糊否定闭环
# --------------------------------------------------------------------------- #
# 模糊否定：用户只说"不准"而未指明具体命题时，按领域+方向累积，
# 达到阈值后对该领域该方向的置信度做降级。
# --------------------------------------------------------------------------- #

# 模糊否定累积阈值（对应不同惩罚力度）
VAGUE_DENIAL_HALF_STEP_MIN = 1      # 1-2 次 → 半级惩罚（"待二次验证"）
VAGUE_DENIAL_ONE_STEP_MIN = 3       # 3-4 次 → 降一级
VAGUE_DENIAL_TWO_STEP_MIN = 5       # ≥5 次 → 降两级

# 置信度等级（用于降级计算）
_CONFIDENCE_LEVELS = ["speculative", "low", "medium", "high"]
_CONFIDENCE_RANK = {v: i for i, v in enumerate(_CONFIDENCE_LEVELS)}


def vague_denial_rank_penalty(count: int) -> int:
    """根据模糊否定累积次数，返回应降级的等级数（0=无惩罚, 0.5=半级, 1=降一级, 2=降两级）。

    设计（对齐参考项目的累积规则）：
    - 0 次 → 0（无影响，沉默不推断）
    - 1–2 次 → 0.5（"待二次验证"，置信度下调半级）
    - 3–4 次 → 1（降一级）
    - ≥5 次 → 2（降两级，顶格）
    """
    if count <= 0:
        return 0
    if count <= 2:
        return 0.5
    if count <= 4:
        return 1
    return 2


def apply_confidence_penalty(confidence: str, penalty_ranks: float) -> str:
    """对单个置信度等级应用降级惩罚，返回降级后的置信度。

    penalty_ranks 可以是 0.5 / 1 / 2（半级/一级/两级）。
    半级：high→medium 但标"偏高置信"？不，简化处理：半级按一级算（保守降级，避免精度过高）。
    实际：0.5 也降一级（向保守方向取整），因为"待二次验证"本身就说明不确定性。
    """
    if penalty_ranks <= 0:
        return confidence
    # 半级及以上都按整数级降级（向保守方向取整，宁低勿高）
    steps = int(penalty_ranks + 0.5) if penalty_ranks % 1 == 0.5 else int(penalty_ranks)
    rank = _CONFIDENCE_RANK.get(confidence, 1)  # 默认 medium
    new_rank = max(0, rank - steps)
    return _CONFIDENCE_LEVELS[new_rank]


def collect_vague_denials(vague_denials: list[dict] | None) -> dict[str, dict[str, int]]:
    """聚合模糊否定 → {domain: {direction: count}}。

    输入格式（每条一个否定信号）：
        [{"domain": "事业", "direction": "吉"}, ...]

    输出：
        {"事业": {"吉": 3, "凶": 1}, "财运": {"吉": 2}, ...}

    过滤：domain/direction 为空的丢弃；direction 不在 {吉,凶,平} 的丢弃。
    """
    result: dict[str, dict[str, int]] = {}
    if not vague_denials:
        return result
    for item in vague_denials:
        if not isinstance(item, dict):
            continue
        domain = (item.get("domain") or "").strip()
        direction = (item.get("direction") or "").strip()
        if not domain or direction not in ("吉", "凶", "平"):
            continue
        if domain not in result:
            result[domain] = {}
        result[domain][direction] = result[domain].get(direction, 0) + 1
    return result


def merge_vague_denials(old: list[dict] | None, new: list[dict] | None) -> list[dict]:
    """合并新旧模糊否定记录（简单追加 + 去重靠 count，不在此函数做）。

    旧数据可能是 None 或 list；新数据也是。返回合并后的 list。
    """
    merged = []
    if isinstance(old, list):
        merged.extend(old)
    if isinstance(new, list):
        merged.extend(new)
    return merged


def vague_denial_summary(vague_denials: list[dict] | None) -> dict[str, dict]:
    """生成模糊否定摘要（给合成器/方法模块用的结构化信号）。

    返回：
        {
            "by_domain_direction": {domain: {direction: count}},
            "penalties": {domain: {direction: {"count": n, "penalty_rank": p, "note": "..."}}},
            "has_any": bool,
        }
    """
    aggregated = collect_vague_denials(vague_denials)
    penalties: dict[str, dict] = {}
    has_any = False

    for domain, dir_counts in aggregated.items():
        penalties[domain] = {}
        for direction, count in dir_counts.items():
            penalty = vague_denial_rank_penalty(count)
            note = ""
            if count >= VAGUE_DENIAL_TWO_STEP_MIN:
                note = "多次模糊否定，置信度降两级"
            elif count >= VAGUE_DENIAL_ONE_STEP_MIN:
                note = "多次模糊否定，置信度降一级"
            elif count >= VAGUE_DENIAL_HALF_STEP_MIN:
                note = "少量模糊否定，待二次验证"
            penalties[domain][direction] = {
                "count": count,
                "penalty_rank": penalty,
                "note": note,
            }
            has_any = True

    return {
        "by_domain_direction": aggregated,
        "penalties": penalties,
        "has_any": has_any,
    }
