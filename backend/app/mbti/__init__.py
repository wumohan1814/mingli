"""MBTI 人格测试模块（Phase D2 · 节123 大五人格替换）：纯代码判型，零 LLM、零扣费。

- data/questions.json：IPIP-NEO-300 中文题库（300 题，五维 N/E/O/A/C 各 60 题，5 点李克特）；
- data/types.json：16 型文案（alias/优势/盲点/职场/关系/成长）；
- scoring.py：逐题答案（value 1–5）→ 大五五维归一分 + r 值映射四字母 + 边界标注。
"""
