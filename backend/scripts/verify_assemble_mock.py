# -*- coding: utf-8 -*-
"""mock 验证：底座版八字四法 prompt 接入后，analyze_method 全链路可用（不调真实 LLM）。

用途：节「接入/联调」八字最小闭环的一次性验证。打桩 app.methods.base.chat，
对 4 个八字法各跑一次 analyze_method(prediction)，断言：
  1. 每法 prompt 文件非空且含底座接入必备段（太初定位/输入字段/硬护栏/断前尘/预测/输出格式/通俗化/收尾原则）；
  2. 打桩 chat 收到的 system prompt 已正确组装（含方法 prompt + base.py 输出格式段）；
  3. 解析后的 method-result v2 形状正确（method/phase 以调用方为准、conclusions 数组存在）。

用法：cd backend && python scripts/verify_assemble_mock.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import app.methods.base as base_mod  # noqa: E402
from app.methods.base import analyze_method, load_prompt  # noqa: E402
from app.paipan.slicer import slice_chart  # noqa: E402

METHODS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
    "ziwei",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]

# 底座接入必备段（v2 文件必须包含）
REQUIRED_SECTIONS = [
    "太初定位与语气",
    "合规红线",
    "输入字段",
    "硬护栏",
    "断前尘阶段",
    "预测阶段",
    "表达分寸",
    "输出格式",
    "话术与免责红线",
    "通俗化约束",
    "收尾原则",
]

# 只允许在“禁止/不输出”语境出现的词——单独出现即违规
SCORING_PATTERNS = ["吉凶总分", "匹配度", "契合度", "百分比", "成功率"]

FAKE_RESULT = {
    "method": "MOCK",
    "phase": "prediction",
    "past_propositions": [
        {
            "year_range": "2015-2018",
            "domain": "事业",
            "claim": "早年学业阶段压力偏大",
            "confidence_level": "medium",
            "confidence_reason": "官杀当令而身弱",
            "basis": ["[L1] bazi.pillars.month 官杀当令", "[L3] 官杀当令身弱则压力"],
        }
    ],
    "conclusions": [
        {
            "direction": "平",
            "domain": "事业",
            "claim": "当前阶段宜守不宜攻",
            "confidence_level": "medium",
            "evidence": ["[L2] 大运加重忌神"],
            "risks": ["忌神运冒进易反复"],
        }
    ],
}


async def fake_chat(messages, **kwargs):  # noqa: ANN001
    """打桩 chat：校验 system 组装 + 返回固定合法 method-result v2。"""
    assert messages and messages[0]["role"] == "system", "messages[0] 必须是 system"
    sys_content = messages[0]["content"]
    assert sys_content and "输出格式（硬性要求" in sys_content, "base.py 输出格式段未追加"
    return {"content": json.dumps(FAKE_RESULT, ensure_ascii=False), "usage": {}, "model": "mock"}


def _check_prompt_text(method: str, text: str) -> list[str]:
    """校验 prompt 文本：必备段齐全 + 无违规打分词（非“禁止”语境）。"""
    problems = []
    for sec in REQUIRED_SECTIONS:
        if sec not in text:
            problems.append(f"缺必备段: {sec}")
    for pat in SCORING_PATTERNS:
        # 只查“出现在非禁止语境”——简化：统计出现次数，若出现但都紧跟否定语境则放行
        for line in text.splitlines():
            if pat in line and not any(neg in line for neg in ("不输出", "禁止", "无", "不给", "不写")):
                problems.append(f"疑似违规打分词「{pat}」: {line.strip()[:60]}")
    return problems


async def main() -> int:
    base_mod.chat = fake_chat  # 打桩
    chart = json.loads((BACKEND / "tests" / "fixtures" / "chart.json").read_text(encoding="utf-8"))
    slices = slice_chart(chart, methods=METHODS)
    phases = ["duan-qian-chen", "prediction"]
    failures = 0
    total = 0

    for method in METHODS:
        prompt = load_prompt(method)
        if not prompt:
            print(f"[FAIL] {method}: prompt 文件为空")
            failures += 1
            continue
        problems = _check_prompt_text(method, prompt)
        if problems:
            for p in problems:
                print(f"[FAIL] {method}: {p}")
            failures += 1
        for phase in phases:
            total += 1
            try:
                result = await analyze_method(method, phase, slices[method],
                                              user_question="看看事业运")
                if result is None:
                    print(f"[FAIL] {method}/{phase}: analyze_method 返回 None（slice 空或 prompt 缺失）")
                    failures += 1
                    continue
                assert result["method"] == method, f"{method}: method 键被覆盖"
                assert result["phase"] == phase, f"{method}: phase 键错误"
                assert isinstance(result["past_propositions"], list) and result["past_propositions"], \
                    f"{method}/{phase}: past_propositions 应为非空数组"
                if phase == "prediction":
                    assert isinstance(result["conclusions"], list) and result["conclusions"], \
                        f"{method}/{phase}: conclusions 应为非空数组"
                else:
                    assert result["conclusions"] == [], f"{method}/duan-qian-chen: conclusions 应为空数组"
                print(f"[PASS] {method}/{phase}: prompt {len(prompt)} 字符 · 全链路 method-result v2 合法")
            except Exception as exc:  # noqa: BLE001
                print(f"[FAIL] {method}/{phase}: 全链路异常 {type(exc).__name__}: {exc}")
                failures += 1

    if failures:
        print(f"\n结果：{total - failures}/{total} 通过（{len(METHODS)} 法 × {len(phases)} 阶段），{failures} 失败")
        return 1
    print(f"\n结果：{total}/{total} 全部通过（{len(METHODS)} 法 × {len(phases)} 阶段，mock，未调真实 LLM）")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
