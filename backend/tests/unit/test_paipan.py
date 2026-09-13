# -*- coding: utf-8 -*-
"""排盘引擎回归基线（backend/tests/unit/test_paipan.py）。

覆盖：
  - 完整排盘契约（顶层键 / meta / 四柱齐全 / 无降级）
  - 同进程两次排盘确定性（剥离 generated_at 后深比较全等）
  - 无经纬度 / 无时辰的降级路径（不触发 Node 子进程，很快）
  - 非法性别抛 ValueError
  - slice_chart 缺省 8 片 / 八字专题第 9 片
  - score_fit / calibration_weight 公式
  - fixtures/chart.json 快照锚点（递归剥离时间依赖字段后深比较）

纪律：不改 engine 契约、不 monkeypatch 固定时间；完整排盘走 session
级 fixture 只跑一次并复用（Node 子进程只在那一次触发）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.paipan import (  # noqa: E402
    calibration_weight,
    paipan,
    score_fit,
    slice_chart,
)

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
CHART_JSON = FIXTURES_DIR / "chart.json"

# 标准测试生辰（虚构数据）
STANDARD_KW = dict(
    year=1990, month=5, day=12, hour=14, minute=30,
    gender="male", name="测试", birthplace="北京",
    longitude=116.4, latitude=39.9,
)

# chart 顶层 10 键（引擎契约）
TOP_KEYS = {
    "meta", "input", "calendar", "bazi", "timeline_20y", "ziwei",
    "western", "qizheng", "qimen_lifetime", "wuyun_liuqi",
}

# 缺省 7 片（slicer.DEFAULT_METHODS；节139 摘除 xizhan）
DEFAULT_SLICE_KEYS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "ziwei",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]

# ---------------------------------------------------------------- 工具 ----

# 时间依赖字段剥离清单（递归删除这些键，无论层级）：
#   generated_at —— meta 里的时间戳，每次排盘不同；
#   timeline_20y —— 年份窗口 = [当年-19, 当年]，跨年会整体滑动；
#   current_year —— wuyun_liuqi 里 Node 侧 new Date().getFullYear() 产出，跨年会变。
TIME_DEPENDENT_KEYS = ("generated_at", "timeline_20y", "current_year")


def strip_time_fields(node):
    """递归删除所有层级上的时间依赖字段（键名见 TIME_DEPENDENT_KEYS）。"""
    if isinstance(node, dict):
        return {k: strip_time_fields(v) for k, v in node.items()
                if k not in TIME_DEPENDENT_KEYS}
    if isinstance(node, list):
        return [strip_time_fields(v) for v in node]
    return node


def normalize(obj):
    """JSON 规范化：排序键往返，消除 dict 顺序 / 类型细节差异。"""
    return json.loads(json.dumps(obj, sort_keys=True, ensure_ascii=False))


def first_diff(path, a, b):
    """递归找第一处差异，返回 (差异路径, a 摘要, b 摘要)；全等返回 None。"""
    if type(a) is not type(b):
        return (path or "<root>", repr(a), repr(b))
    if isinstance(a, dict):
        if set(a) != set(b):
            return (path or "<root>",
                    "keys=" + repr(sorted(a.keys())),
                    "keys=" + repr(sorted(b.keys())))
        for key in sorted(a):
            diff = first_diff(f"{path}.{key}" if path else key, a[key], b[key])
            if diff:
                return diff
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return (path or "<root>",
                    f"list len={len(a)}",
                    f"list len={len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diff = first_diff(f"{path}[{i}]", x, y)
            if diff:
                return diff
        return None
    if a != b:
        return (path or "<root>", repr(a), repr(b))
    return None


@pytest.fixture(scope="session")
def chart():
    """完整排盘只跑一次（触发 Node ziwei + extra 子进程），全程复用。"""
    return paipan(**STANDARD_KW)


# ------------------------------------------------------------ 契约回归 ----

def test_paipan_full_chart_structure(chart):
    assert set(chart.keys()) == TOP_KEYS
    assert chart["meta"]["source"] == "mingli-paipan"
    assert chart["meta"]["version"] == "1.0.0"
    assert chart["meta"]["degraded_methods"] == []
    assert set(chart["bazi"]["pillars"].keys()) == {"year", "month", "day", "hour"}
    for key in ("year", "month", "day", "hour"):
        pillar = chart["bazi"]["pillars"][key]
        assert isinstance(pillar, dict), f"pillar {key} 不是 dict"
        assert pillar.get("gan"), f"pillar {key} 缺 gan"
        assert pillar.get("zhi"), f"pillar {key} 缺 zhi"


def test_paipan_deterministic():
    first = paipan(**STANDARD_KW)
    second = paipan(**STANDARD_KW)
    a = normalize(strip_time_fields(first))
    b = normalize(strip_time_fields(second))
    diff = first_diff("<root>", a, b)
    assert diff is None, f"同进程两次排盘不一致，首处差异: {diff[0]}  a={diff[1]} b={diff[2]}"


def test_paipan_degraded_no_longitude():
    kw = dict(STANDARD_KW)
    kw["longitude"] = None
    kw["latitude"] = None
    c = paipan(**kw)
    for key in ("western", "qizheng", "qimen_lifetime", "wuyun_liuqi"):
        assert c[key] is None, f"无经纬度时 {key} 应为 None"
    expected = {"qimen-lifetime", "western", "qizheng", "wuyun-liuqi"}
    degraded = c["meta"]["degraded_methods"]
    assert expected.issubset(set(degraded))
    assert len(degraded) == len(expected)
    # 有时辰 → bazi 完整、ziwei 不降级
    assert c["bazi"]["pillars"]["hour"] is not None
    assert c["ziwei"] is not None


def test_paipan_degraded_no_hour():
    kw = dict(STANDARD_KW)
    kw["hour"] = None
    kw["minute"] = None
    c = paipan(**kw)
    assert c["bazi"]["pillars"]["hour"] is None
    expected = {"bazi-hour", "ziwei", "western", "qizheng",
                "qimen-lifetime", "wuyun-liuqi"}
    degraded = c["meta"]["degraded_methods"]
    assert expected.issubset(set(degraded))
    assert len(degraded) == len(expected)
    for key in ("ziwei", "western", "qizheng", "qimen_lifetime", "wuyun_liuqi"):
        assert c[key] is None, f"无时辰时 {key} 应为 None"


def test_paipan_invalid_gender():
    with pytest.raises(ValueError):
        paipan(year=1990, month=5, day=12, hour=14, gender="x")


def test_slice_chart_7_default(chart):
    """节139：缺省切片 8→7（xizhan 摘出）；切片键序与 slicer.DEFAULT_METHODS 一致。"""
    slices = slice_chart(chart)
    assert len(slices) == 7
    assert list(slices.keys()) == DEFAULT_SLICE_KEYS


def test_slice_chart_special(chart):
    slices = slice_chart(chart, methods=["bazi-hunyin-caiyun"])
    assert len(slices) == 1
    assert list(slices.keys()) == ["bazi-hunyin-caiyun"]


def test_score_fit_formula():
    propositions = [{
        "method": "bazi-pattern",
        "domain": "前尘",
        "claim": "验证用命题",
        "feedback": "confirmed",
    }]
    out = score_fit(propositions)  # results/validations 缺省 None
    row = out["by_method"]["bazi-pattern"]
    assert len(out["rows"]) == 1
    assert row["hit_rate"] == 1.0          # 单条 confirmed
    assert row["quality"] == 0.5           # 无 validation ⇒ 0.5
    assert row["chain"] == 0.5             # 无 result ⇒ 0.5
    assert row["fit"] == 0.75              # 0.5*1.0 + 0.3*0.5 + 0.2*0.5
    expected_weight = round(0.4 + 0.6 * 0.75, 4)
    assert calibration_weight(0.75) == expected_weight
    assert calibration_weight(0.75) == pytest.approx(0.85)


def test_fixture_snapshot_anchor(chart):
    if not CHART_JSON.exists():
        pytest.fail(f"缺少快照 {CHART_JSON}，请先重新生成 fixture")
    with open(CHART_JSON, encoding="utf-8") as f:
        fixture = json.load(f)
    a = normalize(strip_time_fields(fixture))
    b = normalize(strip_time_fields(chart))
    diff = first_diff("<root>", a, b)
    assert diff is None, (
        f"快照 {CHART_JSON.name} 与当前排盘不一致；"
        f"首处差异路径: {diff[0]}\n  快照: {diff[1]}\n  当前: {diff[2]}"
    )
