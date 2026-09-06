"""主模块（合成器）：跨方法聚合 + 结构化裁决

订阅 MethodAnalysisCompleted 事件，聚合所有方法结果，
输出综合解读报告。
"""

# 解读内容页固定 8 个标题（顺序即展示顺序；前端按此渲染详情板块）。
REPORT_TITLES = ["综合趋势", "性格", "事业", "财运", "感情", "健康", "家庭", "大势"]


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
    
    # 4. 生成报告（固定 8 板块：综合趋势 + REPORT_TITLES[1:] 兜底齐全、顺序固定）
    details = [
        {
            "title": "综合趋势",
            "direction": trend,
            "description": f"基于{len(method_results)}个方法的综合分析，整体趋势为「{trend}」",
            "confidence": "medium",
        }
    ]
    # 按 domain 分组去重：每个领域一个板块，避免全部聚焦主问
    grouped: dict[str, list[dict]] = {}
    for c in all_conclusions:
        grouped.setdefault(_normalize_domain(c.get("domain", "运势")), []).append(c)

    def _section_detail(domain: str, group: list[dict]) -> dict:
        """聚合某 domain 板块：claims 去重、最多 3 条、direction 裁决、confidence 取首条。"""
        claims = []
        for c in group:
            claim = (c.get("claim") or "").strip()
            if claim and claim not in claims:
                claims.append(claim)
            if len(claims) >= 3:
                break
        return {
            "title": domain,
            "direction": _decide_trend(group),
            "description": "；".join(claims),
            "confidence": group[0].get("confidence_level", "low"),
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
