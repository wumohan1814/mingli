"""主模块（合成器）：跨方法聚合 + 结构化裁决

订阅 MethodAnalysisCompleted 事件，聚合所有方法结果，
输出综合解读报告。
"""


async def synthesize(method_results: list[dict], route_decision: dict = None) -> dict:
    """合成裁决
    
    Args:
        method_results: 各方法产出的 method-result v2 列表
        route_decision: 路由决策记录（含主/辅角色）
    
    Returns:
        综合解读报告
    """
    if not method_results:
        return {"summary": "暂无分析结果", "trend": "平", "details": []}

    # 1. 按角色分组
    main_results = [r for r in method_results if r["method"] in (route_decision.get("main_methods", []) if route_decision else [])]
    support_results = [r for r in method_results if r["method"] in (route_decision.get("support_methods", []) if route_decision else [])]

    # 2. 聚合结论
    all_conclusions = []
    for r in method_results:
        all_conclusions.extend(r.get("conclusions", []))

    # 3. 冲突检测与裁决
    trend = _decide_trend(all_conclusions)
    
    # 4. 生成报告
    details = [
        {
            "title": "综合趋势",
            "direction": trend,
            "description": f"基于{len(method_results)}个方法的综合分析",
            "confidence": "medium",
        }
    ]
    # 按 domain 分组去重：每个领域一个板块，避免全部聚焦主问
    grouped: dict[str, list[dict]] = {}
    for c in all_conclusions:
        grouped.setdefault(_normalize_domain(c.get("domain", "运势")), []).append(c)
    for domain, group in grouped.items():
        claims = []
        for c in group:
            claim = (c.get("claim") or "").strip()
            if claim and claim not in claims:
                claims.append(claim)
            if len(claims) >= 3:
                break
        details.append({
            "title": domain,
            "direction": _decide_trend(group),
            "description": "；".join(claims),
            "confidence": group[0].get("confidence_level", "low"),
        })

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
    ):
        if keyword in d:
            return label
    return d


def _decide_trend(conclusions: list[dict]) -> str:
    """裁决趋势方向"""
    if not conclusions:
        return "平"
    ji = sum(1 for c in conclusions if c.get("direction") == "吉")
    xiong = sum(1 for c in conclusions if c.get("direction") == "凶")
    if ji > xiong:
        return "吉"
    elif xiong > ji:
        return "凶"
    return "平"
