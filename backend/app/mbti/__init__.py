"""MBTI 人格测试模块（Phase D2）：纯代码判型，零 LLM、零扣费。

- data/questions.json：60 题标准版题库（四维 EI/SN/TF/JP 各 15 题，二选一）；
- data/types.json：16 型文案（alias/优势/盲点/职场/关系/成长）；
- scoring.py：逐题答案 → 四维分 + 4 字母类型。
"""
