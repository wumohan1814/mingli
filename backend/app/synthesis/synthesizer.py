"""主模块（合成器）：跨方法聚合 + 结构化裁决

订阅 MethodAnalysisCompleted 事件，聚合所有方法结果，
输出综合解读报告。
"""

from app.paipan.scorer import apply_confidence_penalty

# 解读内容页固定 8 个标题（顺序即展示顺序；前端按此渲染详情板块）。
REPORT_TITLES = ["综合趋势", "性格", "事业", "财运", "感情", "健康", "家庭", "大势"]

# --------------------------------------------------------------------------- #
# 节116 · 裁决层配置
# --------------------------------------------------------------------------- #
# 置信度 → 权重映射（用于加权裁决，不是纯计数）
CONFIDENCE_WEIGHTS = {
    "high": 1.0,
    "medium": 0.6,
    "low": 0.3,
    "speculative": 0.1,
}
CONFIDENCE_DEFAULT = "low"  # 缺失时的默认置信度

# 主法 / 辅法权重（主法 > 辅法；未标记角色的按 0.8 计，介于主辅之间）
WEIGHT_MAIN = 1.0
WEIGHT_SUPPORT = 0.5
WEIGHT_UNLABELED = 0.8

# 分歧阈值：吉/凶加权分差 < 此值 → 判"平"并标低置信（避免 51:49 的假确定性）
DIVERGENCE_THRESHOLD = 0.15  # 相对差：|ji - xiong| / max(ji+xiong, 0.1)

# 置信度聚合规则（最终置信度 = f(基分, 一致性, 数量)）
CONSENSUS_BOOST = 0.15       # 高一致时上调幅度
CONSENSUS_DROP = -0.25       # 严重分歧时下调幅度
MIN_CONCLUSIONS_FOR_BOOST = 3  # 至少几条结论才考虑"互证上调"


async def synthesize(method_results: list[dict], route_decision: dict = None, vague_denials: dict = None) -> dict:
    """合成裁决
    
    Args:
        method_results: 各方法产出的 method-result v2 列表
        route_decision: 路由决策记录（含主/辅角色）
        vague_denials: 节116 第④步 · 方向级模糊否定摘要（vague_denial_summary 返回的结构）
    
    Returns:
        综合解读报告
    """
    if not method_results:
        return {"summary": "暂无分析结果", "trend": "平", "details": []}

    # 1. 按角色分组
    main_methods = (route_decision.get("main_methods", []) if route_decision else [])
    main_results = [r for r in method_results if r["method"] in main_methods]
    support_results = [r for r in method_results if r["method"] in (route_decision.get("support_methods", []) if route_decision else [])]

    # 2. 聚合结论
    all_conclusions = []
    for r in method_results:
        all_conclusions.extend(r.get("conclusions", []))

    # 3. 节116 · 综合裁决（加权 + 分歧检测 + 置信度聚合，替代旧纯计数）
    # 综合趋势不传 domain（跨领域，不应用单领域的模糊否定）
    overall_verdict = _adjudicate(all_conclusions, main_methods=main_methods if main_methods else None)
    trend = overall_verdict["direction"]

    # 4. 生成报告（固定 8 板块：综合趋势 + REPORT_TITLES[1:] 兜底齐全、顺序固定）
    overall_desc = f"基于{len(method_results)}个方法的综合分析，整体趋势为「{trend}」"
    if overall_verdict.get("divergence_detail"):
        overall_desc += f"；{overall_verdict['divergence_detail']}"
    details = [
        {
            "title": "综合趋势",
            "direction": trend,
            "description": overall_desc,
            "confidence": overall_verdict["confidence"],
            "has_divergence": overall_verdict["has_divergence"],
        }
    ]
    # 按 domain 分组去重：每个领域一个板块，避免全部聚焦主问
    grouped: dict[str, list[dict]] = {}
    for c in all_conclusions:
        grouped.setdefault(_normalize_domain(c.get("domain", "运势")), []).append(c)

    def _section_detail(domain: str, group: list[dict]) -> dict:
        """节116 · 聚合某 domain 板块：claims 去重、加权裁决、置信度聚合、模糊否定降级。"""
        claims = []
        for c in group:
            claim = (c.get("claim") or "").strip()
            if claim and claim not in claims:
                claims.append(claim)
            if len(claims) >= 3:
                break
        verdict = _adjudicate(
            group,
            main_methods=main_methods if main_methods else None,
            vague_denials=vague_denials,
            domain=domain,
        )
        desc = "；".join(claims)
        if verdict.get("divergence_detail"):
            desc += f"（{verdict['divergence_detail']}）"
        if verdict.get("vague_denial_applied"):
            desc += f"（注：{verdict['vague_denial_note']}）"
        return {
            "title": domain,
            "direction": verdict["direction"],
            "description": desc,
            "confidence": verdict["confidence"],
            "has_divergence": verdict["has_divergence"],
            "vague_denial_applied": verdict.get("vague_denial_applied", False),
        }

    # 固定标题按 REPORT_TITLES 顺序输出；grouped 中缺失的标题补兜底板块
    for title in REPORT_TITLES[1:]:
        group = grouped.get(title)
        if group:
            details.append(_section_detail(title, group))
        else:
            details.append({
                "title": title,
                "direction": "平",
                "description": "该领域暂无可交叉印证的信息，待校准后补充。",
                "confidence": "low",
            })
    # grouped 中 REPORT_TITLES 之外的归一化 domain（如「迁移」）追加到末尾（保序），避免丢信息
    for domain, group in grouped.items():
        if domain not in REPORT_TITLES:
            details.append(_section_detail(domain, group))

    return {
        "summary": f"多流派综合显示，整体趋势为「{trend}」",
        "trend": trend,
        "details": details,
        "method_count": len(method_results),
        "methods_used": [r["method"] for r in method_results],
    }


def _normalize_domain(domain: str) -> str:
    """把各法细碎 domain（如「事业总断」「事业/财运」「事业合作」）归一到大标签。"""
    d = (domain or "").strip()
    if not d:
        return "运势"
    for keyword, label in (
        ("财", "财运"), ("钱", "财运"),
        ("感情", "感情"), ("婚姻", "感情"), ("婚恋", "感情"), ("姻缘", "感情"),
        ("健康", "健康"), ("疾", "健康"), ("病", "健康"),
        ("性格", "性格"), ("天赋", "性格"), ("性情", "性格"),
        ("家庭", "家庭"), ("六亲", "家庭"), ("父母", "家庭"), ("子女", "家庭"),
        ("迁移", "迁移"), ("居住", "迁移"), ("出行", "迁移"),
        ("事业", "事业"), ("工作", "事业"), ("官禄", "事业"), ("职业", "事业"), ("名望", "事业"),
        # 大势/整体/总运/全局/总览/运势 → 归一到「大势」（放在最后，
        # 让事业/财运等更具体的归一优先命中，避免「事业运势」被抢归大势）
        ("大势", "大势"), ("整体", "大势"), ("总运", "大势"),
        ("全局", "大势"), ("总览", "大势"), ("运势", "大势"),
    ):
        if keyword in d:
            return label
    return d


def _adjudicate(
    conclusions: list[dict],
    main_methods: list[str] | None = None,
    vague_denials: dict | None = None,
    domain: str | None = None,
) -> dict:
    """节116 · 综合裁决：加权趋势判断 + 置信度聚合 + 分歧检测。

    替代旧的 `_decide_trend()`（纯计数多数决）。改进点：
    1. 加权而非纯计数：每条结论按 置信度 × 主辅法角色 加权
    2. 分歧检测：吉/凶力量接近时判"平"并标低置信
    3. 置信度聚合：多法一致上调、分歧下调
    4. 同源去重：同一 method 的多条结论只贡献一次主权重（防"同名陷阱）

    Args:
        conclusions: 同 domain 的结论列表（每条含 direction / confidence_level / method）
        main_methods: 主法 method 名列表（None 表示全部按 unlabeled 权重）

    Returns:
        dict: {
            "direction": "吉" | "凶" | "平",
            "confidence": "high" | "medium" | "low" | "speculative",
            "has_divergence": bool,
            "divergence_detail": str,  # 分歧说明，供前端/模板使用
            "weighted_ji": float,
            "weighted_xiong": float,
            "supporting_methods": list[str],  # 支持主方向的方法名
            "opposing_methods": list[str],  # 反对主方向的方法名
        }
    """
    if not conclusions:
        return {
            "direction": "平", "confidence": "low",
            "has_divergence": False, "divergence_detail": "",
            "weighted_ji": 0.0, "weighted_xiong": 0.0,
            "supporting_methods": [], "opposing_methods": [],
        }

    main_set = set(main_methods or [])

    # 1. 按 method 聚合（同源去重：同一方法的多条结论只算一次综合权重，
    #    但方向按该方法最强置信度计 —— 避免同方法3条低置信叠票）
    method_scores: dict[str, dict] = {}  # method → {ji_weight, xiong_weight, max_conf
    for c in conclusions:
        method = c.get("method", "unknown")
        direction = c.get("direction", "平")
        conf = c.get("confidence_level", CONFIDENCE_DEFAULT)
        conf_w = CONFIDENCE_WEIGHTS.get(conf, CONFIDENCE_WEIGHTS[CONFIDENCE_DEFAULT])

        # 角色权重：
        # - 在主法列表 → WEIGHT_MAIN
        # - 不在主法列表 → WEIGHT_SUPPORT（当作辅法处理，更保守；
        #   未单独传 support_methods 列表，统一按辅法权重）
        if method in main_set:
            role_w = WEIGHT_MAIN
        else:
            role_w = WEIGHT_SUPPORT

        weight = conf_w * role_w

        entry = method_scores.setdefault(method, {"ji": 0.0, "xiong": 0.0, "max_conf_weight": 0.0})

        if direction == "吉":
            entry["ji"] = max(entry["ji"], weight)  # 取最强的最高分（同方法不累加票）
        elif direction == "凶":
            entry["xiong"] = max(entry["xiong"], weight)
        entry["max_conf_weight"] = max(entry["max_conf_weight"], conf_w)

    # 2. 加权汇总
    total_ji = sum(e["ji"] for e in method_scores.values())
    total_xiong = sum(e["xiong"] for e in method_scores.values())
    total_weight = total_ji + total_xiong

    # 3. 分歧判定
    has_divergence = False
    divergence_detail = ""
    if total_weight > 0:
        rel_diff = abs(total_ji - total_xiong) / max(total_weight, 0.1)
        if rel_diff < DIVERGENCE_THRESHOLD:
            has_divergence = True

    # 4. 方向裁决
    if has_divergence:
        direction = "平"
    elif total_ji > total_xiong:
        direction = "吉"
    elif total_xiong > total_ji:
        direction = "凶"
    else:
        direction = "平"

    # 5. 置信度聚合
    # 基分：所有结论的加权平均置信度
    total_conf_sum = sum(e["max_conf_weight"] for e in method_scores.values())
    method_count = len(method_scores)
    base_conf = total_conf_sum / max(method_count, 1) if method_count > 0 else CONFIDENCE_WEIGHTS[CONFIDENCE_DEFAULT]

    # 一致性调整
    if has_divergence:
        adj = CONSENSUS_DROP  # 分歧 → 下调
    elif method_count >= MIN_CONCLUSIONS_FOR_BOOST and direction != "平":
        # 多法一致 → 上调（有上限）
        consensus_ratio = max(total_ji, total_xiong) / max(total_weight, 0.1)
        if consensus_ratio >= 0.7:  # 70% 以上一致才算高一致
            adj = CONSENSUS_BOOST
        else:
            adj = 0.0
    else:
        adj = 0.0

    final_conf_val = max(0.05, min(1.0, base_conf + adj))

    # 数值 → 档位映射回档位
    if final_conf_val >= 0.8:
        confidence = "high"
    elif final_conf_val >= 0.5:
        confidence = "medium"
    elif final_conf_val >= 0.2:
        confidence = "low"
    else:
        confidence = "speculative"

    # 6. 收集支持/反对方法列表（供前端展示分歧依据）
    if direction == "吉":
        supporting = [m for m, e in method_scores.items() if e["ji"] > e["xiong"]]
        opposing = [m for m, e in method_scores.items() if e["xiong"] > e["ji"]]
    elif direction == "凶":
        supporting = [m for m, e in method_scores.items() if e["xiong"] > e["ji"]]
        opposing = [m for m, e in method_scores.items() if e["ji"] > e["xiong"]]
    else:
        supporting = []
        opposing = []

    # 分歧详情
    if has_divergence:
        divergence_detail = (f"{len(supporting)}派倾向吉（{', '.join(supporting[:3])}"
                             f"），{len(opposing)}派倾向凶（{', '.join(opposing[:3])}），"
                             f"力量接近，综合判为平势")
    elif direction == "平":
        divergence_detail = "各方法观点不一，综合判为平势"
    else:
        divergence_detail = ""

    # 7. 节116 第④步 · 方向级模糊否定降级（仅当指定了 domain 且裁决有明确方向时）
    vague_denial_applied = False
    vague_denial_note = ""
    if (
        vague_denials
        and domain
        and direction in ("吉", "凶")
    ):
        penalties = vague_denials.get("penalties") or {}
        domain_pen = penalties.get(domain) or penalties.get(_normalize_domain(domain)) or {}
        pen_info = domain_pen.get(direction)
        if pen_info and isinstance(pen_info, dict):
            penalty_rank = pen_info.get("penalty_rank", 0)
            if penalty_rank and penalty_rank > 0:
                old_conf = confidence
                confidence = apply_confidence_penalty(confidence, penalty_rank)
                vague_denial_applied = True
                count = pen_info.get("count", 0)
                vague_denial_note = (
                    f"该领域{direction}向判断经{count}次用户否定反馈，"
                    f"置信度由「{old_conf}」下调至「{confidence}」"
                )

    return {
        "direction": direction,
        "confidence": confidence,
        "has_divergence": has_divergence,
        "divergence_detail": divergence_detail,
        "weighted_ji": round(total_ji, 3),
        "weighted_xiong": round(total_xiong, 3),
        "supporting_methods": supporting,
        "opposing_methods": opposing,
        "vague_denial_applied": vague_denial_applied,
        "vague_denial_note": vague_denial_note,
    }


def _decide_trend(conclusions: list[dict]) -> str:
    """旧接口保留（向后兼容）：直接调用新裁决，只取direction）。"""
    return _adjudicate(conclusions)["direction"]
