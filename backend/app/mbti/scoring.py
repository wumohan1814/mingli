#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MBTI 判型（纯代码，零 LLM、零扣费）。

计分口径：荣格四维二分（E/I、S/N、T/F、J/P）为公共知识，每维取计数多者。
读同目录 data/questions.json 建立 question_id → dim + 各选项 pole 的映射，
完全由题库驱动，题目增删不改判型代码。

答案支持两种形态（二选一）：
  [{"question_id": 1, "choice": "A"}, ...]   —— 按题干选项 key 取 pole
  [{"id": 1, "pole": "E"}, ...]              —— 直接给所选端字母（须属于该题维度）

返回 {"type": "INTJ", "scores": {"EI": {"E": 8, "I": 7}, "SN": {...},
"TF": {...}, "JP": {...}}}；scores 每维为 {两端字母: 计数}。

非法输入（空/结构错/题目不存在/选项无效/同题重复/某维无作答）抛 ValueError，
由 API 层转 400；四维均作答但某维平票时，取该维默认倾向 E/S/T/J
（外向/实感/思考/判断），见 TIE_DEFAULTS。
"""
from __future__ import annotations

import json
from pathlib import Path

# scoring.py 位于 backend/app/mbti/，data 在同目录下
DATA_DIR = Path(__file__).resolve().parent / "data"
QUESTIONS_PATH = DATA_DIR / "questions.json"

# 四维字母对（顺序即返回 scores 的键序）
DIMS = ("EI", "SN", "TF", "JP")

# 平票时的默认倾向：E（外向）/ S（实感）/ T（思考）/ J（判断）
TIE_DEFAULTS = {"EI": "E", "SN": "S", "TF": "T", "JP": "J"}

_questions_cache: list[dict] | None = None


def load_questions() -> list[dict]:
    """读取题库 questions.json（进程内缓存）；文件缺失/为空视为配置错误。"""
    global _questions_cache
    if _questions_cache is None:
        try:
            data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
        except OSError as exc:
            raise RuntimeError(f"MBTI 题库缺失或不可读: {QUESTIONS_PATH}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"MBTI 题库 JSON 解析失败: {QUESTIONS_PATH}") from exc
        questions = data.get("questions")
        if not isinstance(questions, list) or not questions:
            raise RuntimeError(f"MBTI 题库为空: {QUESTIONS_PATH}")
        _questions_cache = list(questions)
    return list(_questions_cache)


def _coerce_qid(value) -> int | None:
    """question_id/id 允许 int 或数字字符串（"1"），其它类型返回 None。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def score(answers) -> dict:
    """逐题答案统计四维两端计数，每维取多者为该维度字母，返回 {type, scores}。

    非法输入抛 ValueError（message 面向调用方友好）：
      - answers 非 list 或为空；
      - 某项非对象 / 缺 question_id|id / 题目不在题库 / 选项 key 无效 /
        pole 不属于该题维度；
      - 同一题重复作答；
      - 作答后某维度两端计数均为 0（答案未覆盖全部四维）。
    """
    questions = load_questions()
    q_index: dict = {q["id"]: q for q in questions}

    counts = {dim: {p: 0 for p in dim} for dim in DIMS}

    if not isinstance(answers, list) or not answers:
        raise ValueError("answers 不能为空，请提交逐题答案")

    seen: set[int] = set()
    for item in answers:
        if not isinstance(item, dict):
            raise ValueError("每道答案需为对象，如 {\"question_id\":1,\"choice\":\"A\"}")
        qid = _coerce_qid(item.get("question_id", item.get("id")))
        if qid is None:
            raise ValueError("答案缺少 question_id（或 id）")
        question = q_index.get(qid)
        if question is None:
            raise ValueError(f"题目不存在: {qid}")
        if qid in seen:
            raise ValueError(f"同一题目重复作答: {qid}")
        seen.add(qid)

        dim = question["dim"]
        if dim not in counts:
            raise ValueError(f"题库含未知维度: {dim}")

        choice = item.get("choice")
        if choice is not None:
            # 形态一：按题干选项 key 取 pole
            option = next((o for o in question["options"]
                           if o.get("key") == choice), None)
            if option is None:
                raise ValueError(f"选项无效: 题目 {qid} choice={choice!r}")
            pole = option.get("pole")
        else:
            # 形态二：直接给所选端字母（须属于该题维度）
            pole = item.get("pole")

        if pole not in counts[dim]:
            raise ValueError(f"pole 不属于该题维度: 题目 {qid} pole={pole!r}")

        counts[dim][pole] += 1

    # 维度完整性：四维都必须有作答，否则判不了型（API 层转 400）
    for dim in DIMS:
        if counts[dim][dim[0]] + counts[dim][dim[1]] == 0:
            raise ValueError("答案未覆盖全部维度（EI/SN/TF/JP），请完整作答")

    # 每维取计数多者；平票取默认倾向（E/S/T/J）
    letters: list[str] = []
    for dim in DIMS:
        left, right = dim
        left_n, right_n = counts[dim][left], counts[dim][right]
        if left_n == right_n:
            letters.append(TIE_DEFAULTS[dim])
        else:
            letters.append(left if left_n > right_n else right)

    return {"type": "".join(letters), "scores": counts}
