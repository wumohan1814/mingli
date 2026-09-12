#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""大五人格（IPIP-NEO-300）计分与四字母映射（纯代码，零 LLM、零扣费）。

计分口径（节122 §4.2 / §4.3.1）：
  1. 5 点李克特：正向题 1–5 直接计分，反向题（reverse=True）6 − x。
  2. 维度分 = 该维全部题项之和 → 归一到 0–100（内部量，供映射与条形图）。
  3. 四字母映射：z(倾向) = r × z(维度分)，z>0 取左字母、z<0 取右字母、
     |z| < 阈值标「边界」。N（神经质）不参与映射，仅返回得分。
  4. 映射权重（用户抄录自 Arneson 2016）：
       E–I: r=0.765（区间 0.74~0.79 取中值）
       S–N: r=0.685（区间 0.65~0.72 取中值）
       T–F: r=0.44
       J–P: r=0.49
     方向（权利人确认）：外向性高→E ｜ 开放性高→N ｜ 宜人性高→F ｜ 尽责性高→J

答案形态：[{"question_id": 1, "value": 1..5}, ...]

返回 {"scores": {"N":..,"E":..,"O":..,"A":..,"C":..},
       "mapped_type": "ENFJ",
       "boundaries": ["T"]}。
scores 为 0–100 归一值；boundaries 为落在边界区的字母列表；
若四维全边界，mapped_type 为空串（「介于多型之间」由前端呈现）。

非法输入（空/结构错/题目不存在/分值越界/同题重复/未覆盖全部五维）
抛 ValueError，由 API 层转 400。
"""
from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
QUESTIONS_PATH = DATA_DIR / "questions.json"

# 大五五维
DIMS = ("N", "E", "O", "A", "C")

# 四字母映射：(mbti_dim, big5_dim, left_letter, right_letter, r_value)
# left = 维度高时取的字母，right = 维度低时取的字母
# 方向：外向性高→E、开放性高→N、宜人性高→F、尽责性高→J
MAPPING = (
    ("EI", "E", "E", "I", 0.765),
    ("SN", "O", "N", "S", 0.685),
    ("TF", "A", "F", "T", 0.44),
    ("JP", "C", "J", "P", 0.49),
)

# 边界阈值：|z_mbti| < 此值 → 该字母标边界
# 单一阈值即可，因为 r 越小 z_mbti 越小、越易落入边界（自然实现分级谦虚）
BOUNDARY_THRESHOLD = 0.3

# z 维度分的缩放：归一分 0–100，以 50 为中心、25 为半幅 → z_dim ∈ [-2, +2]
Z_SCALE = 25.0

_questions_cache: list[dict] | None = None


def load_questions() -> list[dict]:
    """读取题库 questions.json（进程内缓存）；文件缺失/为空视为配置错误。"""
    global _questions_cache
    if _questions_cache is None:
        try:
            data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
        except OSError as exc:
            raise RuntimeError(f"大五题库缺失或不可读: {QUESTIONS_PATH}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"大五题库 JSON 解析失败: {QUESTIONS_PATH}") from exc
        questions = data.get("questions")
        if not isinstance(questions, list) or not questions:
            raise RuntimeError(f"大五题库为空: {QUESTIONS_PATH}")
        _questions_cache = list(questions)
    return list(_questions_cache)


def _coerce_qid(value) -> int | None:
    """question_id/id 允许 int 或数字字符串，其它类型返回 None。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def score(answers) -> dict:
    """逐题答案计大五五维分并映射四字母。

    返回 {scores, mapped_type, boundaries}。
    非法输入抛 ValueError（message 面向调用方友好）：
      - answers 非 list 或为空；
      - 某项非对象 / 缺 question_id|id / 题目不在题库 / value 不在 1..5 /
        同一题重复作答；
      - 作答未覆盖全部五个维度。
    """
    questions = load_questions()
    q_index: dict = {q["id"]: q for q in questions}

    # 每维原始得分累加（含反向翻转）+ 该维作答题数
    raw_sums: dict[str, float] = {d: 0.0 for d in DIMS}
    answered_count: dict[str, int] = {d: 0 for d in DIMS}
    answered_dims: set[str] = set()

    if not isinstance(answers, list) or not answers:
        raise ValueError("answers 不能为空，请提交逐题答案")

    seen: set[int] = set()
    for item in answers:
        if not isinstance(item, dict):
            raise ValueError("每道答案需为对象，如 {\"question_id\":1,\"value\":4}")
        qid = _coerce_qid(item.get("question_id", item.get("id")))
        if qid is None:
            raise ValueError("答案缺少 question_id（或 id）")
        question = q_index.get(qid)
        if question is None:
            raise ValueError(f"题目不存在: {qid}")
        if qid in seen:
            raise ValueError(f"同一题目重复作答: {qid}")
        seen.add(qid)

        value = item.get("value")
        if not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > 5:
            raise ValueError(f"分值无效（须为 1–5 的整数）: 题目 {qid} value={value!r}")

        dim = question["dim"]
        if dim not in raw_sums:
            raise ValueError(f"题库含未知维度: {dim}")

        # 反向题翻转：6 − value
        score_val = 6 - value if question.get("reverse") else value
        raw_sums[dim] += score_val
        answered_count[dim] += 1
        answered_dims.add(dim)

    # 维度完整性：五维都必须有作答
    missing = [d for d in DIMS if d not in answered_dims]
    if missing:
        raise ValueError(f"答案未覆盖全部维度（缺 {','.join(missing)}），请完整作答")

    # 归一到 0–100：按该维实际作答题数 N，min=N, max=5N, range=4N
    scores: dict[str, float] = {}
    for dim in DIMS:
        n = answered_count[dim]
        raw = raw_sums[dim]
        normalized = (raw - n) / (n * 4.0) * 100.0
        # 钳制到 [0, 100]
        scores[dim] = max(0.0, min(100.0, normalized))

    mapped_type, boundaries = map_to_mbti(scores)

    return {
        "scores": scores,
        "mapped_type": mapped_type,
        "boundaries": boundaries,
    }


def map_to_mbti(scores: dict[str, float]) -> tuple[str, list[str]]:
    """由大五五维归一分映射四字母 + 边界标注。

    输入 scores = {"N":..,"E":..,"O":..,"A":..,"C":..}（0–100）。
    返回 (mapped_type, boundaries)，boundaries 为落在边界区的字母列表。
    """
    letters: list[str] = []
    boundaries: list[str] = []
    for mbti_dim, big5_dim, left, right, r in MAPPING:
        z_dim = (scores[big5_dim] - 50.0) / Z_SCALE
        z_mbti = r * z_dim
        if abs(z_mbti) < BOUNDARY_THRESHOLD:
            # 边界：取左字母但标记为边界
            letters.append(left)
            boundaries.append(left)
        else:
            letters.append(left if z_mbti > 0 else right)

    mapped_type = "".join(letters)
    return mapped_type, boundaries
