"""合规护栏模块（横切）

双层过滤：
1. 关键词表拦截（确定性）
2. LLM 二次判定（ADR-10 待决，当前仅占位）

所有解读输出必须经过此模块。
"""

FORBIDDEN_KEYWORDS = [
    "医疗", "诊断", "治疗", "处方",
    "投资", "保本", "回报率", "股票",
    "司法", "诉讼", "判决",
    "自伤", "自杀", "轻生",
]

REQUIRED_DISCLAIMER = (
    "本内容为传统民俗文化分析，仅供娱乐参考，不构成现实命运预测，"
    "也不提供投资、理财、医疗、法律等决策建议。"
)


def check_output(text: str) -> tuple[bool, str]:
    """检查输出文本是否合规。
    
    Returns:
        (is_safe, message)
    """
    for kw in FORBIDDEN_KEYWORDS:
        if kw in text:
            return False, f"内容包含禁用词「{kw}」，已拦截"
    return True, ""


def append_disclaimer(text: str) -> str:
    """在输出末尾追加免责声明"""
    if REQUIRED_DISCLAIMER not in text:
        text += f"\n\n---\n*{REQUIRED_DISCLAIMER}*"
    return text
