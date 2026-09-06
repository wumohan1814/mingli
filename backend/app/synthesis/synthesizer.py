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
    for c in all_conclusions[:5]:  # 最多5条
        details.append({
            "title": c.get("domain", "运势"),
            "direction": c.get("direction", "平"),
            "description": c.get("claim", ""),
            "confidence": c.get("confidence_level", "low"),
        })

    return {
        "summary": f"多流派综合显示，整体趋势为「{trend}」",
        "trend": trend,
        "details": details,
        "method_count": len(method_results),
        "methods_used": [r["method"] for r in method_results],
    }


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
