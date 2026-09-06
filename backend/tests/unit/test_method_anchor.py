# -*- coding: utf-8 -*-
"""方法模块输出结构回归锚点（backend/tests/unit/test_method_anchor.py）。

背景（防 prompt 漂移）：
  - `fixtures/chart.json` + test_paipan.py::test_fixture_snapshot_anchor 是
    「排盘层」快照锚点；
  - `fixtures/method_anchor.json` + 本文件是「方法模块层」的已知断语锚点：
    固定命盘 slice + 固定 mock LLM 断语（method-result v2 样本），回归
    `app.methods.base.analyze_method` 的解析 / 规范化输出结构——保证顶层
    method / phase / past_propositions / conclusions 键齐全、两项内层字段
    与枚举不因提示词或解析逻辑改动而漂移。

锚点样本说明（method-result v2 契约，见 app/methods/base.py 模块文档串）：
  样本 phase 记 "prediction"，因为 v2 契约与 bazi-pattern.md 约定 conclusions
  仅在 prediction 阶段非空；prediction 阶段输出同时携带（断前尘阶段锚定并
  回验过的）past_propositions 与前瞻 conclusions，故该样本是两种结构的
  完整参照。test_analyze_method_structure_stable 以 duan-qian-chen 阶段调用
  它，正好覆盖 base.analyze_method 的阶段覆盖写（method/phase 以调用方为准）
  与阶段化规范化（非 prediction 阶段 conclusions 强制置 []）。

零真实 DeepSeek 调用：monkeypatch `app.methods.base.chat`（analyze_method
内部唯一 LLM 调用点）返回锚点内容，不读 key、不触网。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.methods.base import analyze_method  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
METHOD_ANCHOR_JSON = FIXTURES_DIR / "method_anchor.json"

# ---- method-result v2 契约常量（与 app/methods/base.py 文档串逐字段对齐）----
TOP_KEYS = {"method", "phase", "past_propositions", "conclusions"}
VALID_PHASES = {"duan-qian-chen", "prediction"}
VALID_CONFIDENCE = {"high", "medium", "low", "speculative"}
VALID_DIRECTION = {"吉", "凶", "平"}
PAST_PROP_KEYS = {"year_range", "domain", "claim",
                  "confidence_level", "confidence_reason", "basis"}
CONCLUSION_KEYS = {"direction", "domain", "claim",
                   "confidence_level", "evidence", "risks"}


# ---------------------------------------------------------------- 工具 ----

def _load_anchor() -> dict:
    """读取 method_anchor.json 并返回 v2 样本 dict；缺失即失败。"""
    if not METHOD_ANCHOR_JSON.exists():
        pytest.fail(f"缺少方法输出锚点 {METHOD_ANCHOR_JSON}，请先补齐 fixture")
    with open(METHOD_ANCHOR_JSON, encoding="utf-8") as f:
        sample = json.load(f)
    assert isinstance(sample, dict), "锚点必须是 JSON 对象"
    return sample


def _assert_proposition_shape(item: dict) -> None:
    """past_propositions 单项：6 键齐全 + confidence_level 枚举合法 + basis 为列表。"""
    assert isinstance(item, dict)
    missing = PAST_PROP_KEYS - set(item)
    assert not missing, f"past_propositions 项缺键 {sorted(missing)}: {item!r}"
    assert item["confidence_level"] in VALID_CONFIDENCE, \
        f"confidence_level 非法: {item['confidence_level']!r}"
    assert isinstance(item["basis"], list), "basis 必须是数组"


def _assert_conclusion_shape(item: dict) -> None:
    """conclusions 单项：6 键齐全 + direction / confidence_level 枚举合法 + 数组字段合法。"""
    assert isinstance(item, dict)
    missing = CONCLUSION_KEYS - set(item)
    assert not missing, f"conclusions 项缺键 {sorted(missing)}: {item!r}"
    assert item["direction"] in VALID_DIRECTION, f"direction 非法: {item['direction']!r}"
    assert item["confidence_level"] in VALID_CONFIDENCE, \
        f"confidence_level 非法: {item['confidence_level']!r}"
    assert isinstance(item["evidence"], list), "evidence 必须是数组"
    assert isinstance(item["risks"], list), "risks 必须是数组"


# ------------------------------------------------------------ 回归用例 ----

async def test_analyze_method_structure_stable(monkeypatch):
    """固定锚点断语（method_anchor.json）→ analyze_method 输出结构稳定。

    走 duan-qian-chen 调用：method/phase 被规范化覆盖为调用方参数，
    past_propositions 逐项透传且结构/枚举合法，conclusions 键必在（非
    prediction 阶段被规范化为空数组）。
    """
    sample = _load_anchor()

    async def fake_chat(messages, **kwargs):  # 替身：只回放锚点断语文本
        return {
            "content": json.dumps(sample, ensure_ascii=False),
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "model": "mock-anchor",
        }

    monkeypatch.setattr("app.methods.base.chat", fake_chat)

    out = await analyze_method(
        "bazi-pattern",
        "duan-qian-chen",
        {"bazi": {"day_master": "甲"}},  # 固定命盘 slice（锚点断语对应其结构语境）
        "事业运势",
    )

    assert isinstance(out, dict), "analyze_method 应返回 v2 dict"
    missing = TOP_KEYS - set(out)
    assert not missing, f"analyze_method 输出缺顶层键 {sorted(missing)}"
    assert out["method"] == "bazi-pattern", "method 必须以调用方为准"
    assert out["phase"] == "duan-qian-chen", "phase 必须以调用方为准"

    props = out["past_propositions"]
    assert isinstance(props, list) and props, "past_propositions 应透传锚点断语中的命题"
    for prop in props:
        _assert_proposition_shape(prop)
    # 解析为无损往返：锚点 past_propositions 内容不得被解析/规范化改写
    assert props == sample["past_propositions"], "past_propositions 应与锚点样本逐项一致"

    # duan-qian-chen 阶段 conclusions 键必须存在，且按规范化规则置空数组
    assert isinstance(out["conclusions"], list)
    assert out["conclusions"] == [], "非 prediction 阶段 conclusions 应被规范化为 []"


def test_anchor_fixture_wellformed():
    """锚点 fixture 自身必须与 method-result v2 契约一致（防锚点样本被改坏）。"""
    sample = _load_anchor()

    missing = TOP_KEYS - set(sample)
    assert not missing, f"锚点缺顶层键 {sorted(missing)}"
    assert sample["method"] == "bazi-pattern", "锚点 method 应为 bazi-pattern"
    assert sample["phase"] in VALID_PHASES, f"锚点 phase 非法: {sample['phase']!r}"

    props = sample["past_propositions"]
    assert isinstance(props, list) and props, "锚点 past_propositions 应为非空数组"
    for prop in props:
        _assert_proposition_shape(prop)

    conclusions = sample["conclusions"]
    assert isinstance(conclusions, list) and conclusions, "锚点 conclusions 应为非空数组"
    for conclusion in conclusions:
        _assert_conclusion_shape(conclusion)
