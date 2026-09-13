"""路由决策模块（ADR-0004：配置化路由表，零LLM）

根据主问领域 + 校准权重 + 降级方法 → 输出主/辅方法集合。
决策为纯查表 + 权重排序，零LLM调用。
"""

from app.models import Phase

# 默认路由表（源自 mingli routing.md）
ROUTE_TABLE = {
    "运势总览": {"main": ["bazi-pattern", "bazi-dayun-liunian"], "support": ["bazi-shensha-nayin"]},
    "婚姻感情": {"main": ["ziwei"], "support": ["bazi-pattern"]},
    "事业财运": {"main": ["bazi-pattern", "bazi-dayun-liunian", "bazi-hunyin-caiyun"], "support": ["ziwei", "qizheng"]},
    "健康": {"main": ["wuyun-liuqi"], "support": ["bazi-pattern"]},
    "性格天赋": {"main": ["ziwei"], "support": ["bazi-pattern"]},
    "疑难一局": {"main": ["qimen-lifetime"], "support": []},
}

# 主问领域 → 路由表key的映射
DOMAIN_MAP = {
    "事业运势": "事业财运",
    "财运": "事业财运",
    "婚姻": "婚姻感情",
    "感情": "婚姻感情",
    "健康": "健康",
    "性格": "性格天赋",
    "运势": "运势总览",
}


def route(main_question: str, phase: Phase, weights: dict = None, degraded_methods: list = None, user_named_methods: list = None) -> dict:
    """路由决策
    
    Args:
        main_question: 用户主问（如"事业运势"）
        phase: duan_qian_chen | prediction
        weights: 各方法权重（来自 score.py 校准）
        degraded_methods: 降级方法列表（盘面null的方法）
        user_named_methods: 用户点名的方法（强制纳入）
    
    Returns:
        {"main_methods": [...], "support_methods": [...], "reasons": [...]}
    """
    degraded = degraded_methods or []
    named = user_named_methods or []
    
    # 1. 查找路由表
    route_key = DOMAIN_MAP.get(main_question, "运势总览")
    entry = ROUTE_TABLE.get(route_key, ROUTE_TABLE["运势总览"])
    
    # 2. 过滤降级方法
    main_methods = [m for m in entry["main"] if m not in degraded]
    support_methods = [m for m in entry["support"] if m not in degraded]
    
    # 3. 用户点名方法强制纳入
    for m in named:
        if m not in main_methods and m not in degraded:
            support_methods.append(m)
    
    # 4. 生成理由
    reasons = [f"主问「{main_question}」匹配路由表条目「{route_key}」"]
    if degraded:
        reasons.append(f"降级方法已排除：{degraded}")
    if named:
        reasons.append(f"用户点名方法已纳入：{named}")
    
    return {
        "main_methods": main_methods,
        "support_methods": support_methods,
        "reasons": reasons,
    }
