# -*- coding: utf-8 -*-
"""节149 · 出生时间校正链（真太阳时 + 中国夏令时）· Python 侧单测。

覆盖对象：`backend/app/paipan/birthtime.py`（Node 自研内核 `paipan-core/src/capabilities/
true-solar-time/` 的 Python 镜像；八字链路走 Python 侧，engine.py 消费本模块）。

分层覆盖（纯确定性、零 LLM、零扣费、不触网、不读真实时钟）：
  ① 均时差**权威锚点**：7 个锚点（NOAA 公开 EoT 数据与万年历零点日）逐项比对，
     并与 rules 登记的实测偏差核对；任务书 ±0.3 分钟目标的**未达标项逐条登记**（诚实断言）。
  ② 官方 12 个起止日边界（国务院公告）：起始日 01:59 标准时 / 02:00 起夏令时；
     结束日 01:59 按夏令时（歧义段）/ 02:00 回标准时；另验 12 个起止日全部落在周日。
  ③ 1986 施行首年特殊（05-04 起，而非 4 月中旬第一个周日）。
  ④ 歧义段挂 `dst_ambiguous_hour`；大修正挂 `true_solar_large_delta`；缺分钟挂 `minute_unknown`。
  ⑤ 缺经度抛错（`longitude_required`，ValueError 子类）。
  ⑥ 跨日/跨月/跨年进位与退位（含闰日）。
  ⑦ **Python 与 Node 逐字段一致**：`subprocess` 调
     `paipan-core/tools/true-solar-crosscheck.mjs`（20 组输入 × 三函数），要求输出
     「全部 20 组一致」；node 不可用时 skip（该门禁在 node 环境由 CI/本地命令兜底）。
  ⑧ 结构性守卫：本模块**零新依赖**（ast 解析 import，只允许 math/__future__）、
     docstring 声明权威来源、输出键形状 8 键 / applied 3 键（下游按契约取键）。

纪律：本文件不 mock 时间、不依赖进程时区（全程只传公历年月日时分整数）。
"""
from __future__ import annotations

import ast
import datetime
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

NODE_DIR = BACKEND_DIR / "paipan-node"
NODE_BIN = shutil.which("node")
CROSSCHECK_SCRIPT = "paipan-core/tools/true-solar-crosscheck.mjs"
BIRTHTIME_PATH = BACKEND_DIR / "app" / "paipan" / "birthtime.py"

from app.paipan.birthtime import (  # noqa: E402  （必须晚于 sys.path 注入）
    BirthTimeInputError,
    CHINA_DST_RANGES,
    CHINA_DST_RULES,
    EOT_ACCURACY,
    EOT_ANCHORS,
    EOT_FORMULA,
    LARGE_TRUE_SOLAR_DELTA_MINUTES,
    UNCERTAINTY_MESSAGES,
    calculate_true_solar_time,
    china_dst_range_for_year,
    correct_birth_time,
    day_of_year,
    days_in_month,
    equation_of_time_minutes,
    get_china_dst,
    is_leap_year,
    round_minutes,
)

# 测试基准年（平年）；锚点按月日给出，N 随平/闰年变化，故显式声明年份。
COMMON_YEAR = 2025

# 权威锚点期望值（与 JS 侧 tests/true-solar-time.test.mjs 写死同一组数字；
# 两侧各自独立断言 → 任一侧常量漂移都会被看见）。
# 值 = NOAA/Spencer 全式（节149 方案②）在平年 2025 的实现值；容差 = 该式的实测偏差上界。
EXPECTED_EOT = {
    (2, 11): (-14.1997, -14.2, 0.3),     # 与锚值 −14.2 逐位吻合（偏差 0.0003）
    (5, 14): (3.9263, 3.7, 0.3),
    (11, 3): (16.3653, 16.4, 0.3),
    (4, 15): (-0.2404, 0.0, 0.3),
    (6, 13): (0.3923, 0.0, 0.4),         # 换式后仍是全年最大偏差项（0.3923）
    (9, 1): (-0.3731, 0.0, 0.4),
    (12, 25): (0.3076, 0.0, 0.4),
}

# 官方年份表（国务院公告）逐字期望值
EXPECTED_DST_RANGES = (
    (1986, 5, 4, 9, 14, True),
    (1987, 4, 12, 9, 13, False),
    (1988, 4, 10, 9, 11, False),
    (1989, 4, 16, 9, 17, False),
    (1990, 4, 15, 9, 16, False),
    (1991, 4, 14, 9, 15, False),
)


def _anchor_value(month: int, day: int, year: int = COMMON_YEAR) -> float:
    return round_minutes(equation_of_time_minutes(day_of_year(year, month, day)))


def _uncertainty_code(result: dict, code: str):
    """取不确定项（取不到返回 None）。"""
    for item in result["uncertainties"]:
        if item["code"] == code:
            return item
    return None


# ══════════════════════════════════════════════════════════════════════════
# ① 均时差权威锚点
# ══════════════════════════════════════════════════════════════════════════
def test_eot_formula_constants_and_sign_convention():
    """公式与符号约定写死（与 rules/true-solar-time.js 逐项同名；节149 方案② = Spencer 全式）。"""
    assert EOT_FORMULA["expression"] == (
        "EoT = 229.18·(0.000075 + 0.001868·cos γ − 0.032077·sin γ − 0.014615·cos 2γ − 0.040849·sin 2γ)"
    )
    assert EOT_FORMULA["gammaExpression"] == "γ = 2π·(N − 1) / 365"
    assert EOT_FORMULA["scaleMinutes"] == 229.18
    assert EOT_FORMULA["offset"] == 1
    assert EOT_FORMULA["denominator"] == 365
    assert EOT_FORMULA["constantCoefficient"] == 0.000075
    assert EOT_FORMULA["cosGammaCoefficient"] == 0.001868
    assert EOT_FORMULA["sinGammaCoefficient"] == -0.032077
    assert EOT_FORMULA["cos2GammaCoefficient"] == -0.014615
    assert EOT_FORMULA["sin2GammaCoefficient"] == -0.040849
    # 旧式留痕（已废弃，仅审计；不得再参与计算）
    assert "9.87·sin(2B)" in EOT_FORMULA["superseded"]
    assert "9.87·sin(2B)" in EOT_ACCURACY["supersededFormula"]
    assert EOT_ACCURACY["supersededMaxDeviationMinutes"] == 0.85
    assert EOT_FORMULA["signConvention"] == (
        "真太阳时 = 民用时 + 4·(经度 − 120) + EoT（EoT = 视太阳时 − 平太阳时）"
    )
    assert LARGE_TRUE_SOLAR_DELTA_MINUTES == 20


@pytest.mark.parametrize(("month", "day"), sorted(EXPECTED_EOT))
def test_eot_anchor_values_and_registered_deviation(month: int, day: int):
    """① 权威锚点：实现值 = 回归值；偏差 ≤ rules 登记上界；偏差与登记值一致。"""
    expected_value, anchor, max_deviation = EXPECTED_EOT[(month, day)]
    value = _anchor_value(month, day)
    deviation = abs(value - anchor)

    assert value == pytest.approx(expected_value, abs=1e-9), f"{month}/{day} 回归值漂移"
    assert deviation <= max_deviation + 1e-9, (
        f"{month}/{day} EoT={value}，锚值={anchor}，偏差={deviation:.4f} 超出登记上界 {max_deviation}"
    )
    # 与 rules 的 EOT_ANCHORS 登记值逐项一致（表漂移即红）
    entry = next(a for a in EOT_ANCHORS if a["month"] == month and a["day"] == day)
    assert entry["anchor"] == anchor
    assert entry["maxDeviation"] == max_deviation
    assert entry["observed"] == pytest.approx(deviation, abs=5e-4)


def test_eot_anchor_table_shape_matches_js():
    """锚点表形状（7 项、按月序、2/11 与 5/14 符号/量级）与 JS 侧同值。"""
    assert [(a["month"], a["day"]) for a in EOT_ANCHORS] == [
        (2, 11), (5, 14), (11, 3), (4, 15), (6, 13), (9, 1), (12, 25),
    ]
    assert len(EXPECTED_EOT) == 7
    # 5/14 真值与两式均为正号且量级 ≈3.7（任务书原文「−3.7」为笔误，按真值 +3.7 登记）
    assert _anchor_value(5, 14) > 0
    assert abs(_anchor_value(5, 14) - 3.7) <= 0.3
    assert _anchor_value(2, 11) < 0
    assert abs(_anchor_value(2, 11) - (-14.2)) <= 0.001     # 与锚值逐位吻合
    assert _anchor_value(11, 3) > 0
    assert abs(_anchor_value(11, 3) - 16.4) <= 0.3


def test_eot_task_target_status_is_recorded_honestly():
    """① ±0.3 分钟目标的达标/未达标清单（诚实断言，不静默放水）。

    节149 方案② 换用 NOAA/Spencer 全式后：固有偏差上界 0.3923 分钟 → 7 个锚点中
    4 个（2/11、4/15、5/14、11/3）达标，3 个零点日（6/13、9/1、12/25）仍在
    0.30–0.40 区间（闭式级数极限：过零点不精确落在「EoT≈0 的零点日」）。
    本断言记录「现状」：若再换式或改锚值，本条会变红 → 属**知情变更**，
    须同步更新两侧登记并上报节149，而不是直接改期望值。
    """
    within, outside = [], []
    for month, day in sorted(EXPECTED_EOT):
        _, anchor, _ = EXPECTED_EOT[(month, day)]
        target = EOT_ACCURACY["taskTargetMinutes"]
        (within if abs(_anchor_value(month, day) - anchor) <= target + 1e-9 else outside).append(f"{month}/{day}")
    assert tuple(within) == EOT_ACCURACY["anchorsWithinTarget"] == ("2/11", "4/15", "5/14", "11/3")
    assert tuple(outside) == EOT_ACCURACY["anchorsOutsideTarget"] == ("6/13", "9/1", "12/25")
    assert EOT_ACCURACY["formulaMaxDeviationMinutes"] == 0.4
    for month, day in sorted(EXPECTED_EOT):
        _, anchor, _ = EXPECTED_EOT[(month, day)]
        assert abs(_anchor_value(month, day) - anchor) <= 0.4 + 1e-9
    assert "方案②" in EOT_ACCURACY["decision"]


def test_eot_zero_crossing_days_within_two_days():
    """① 四个「EoT≈0」锚点日：Spencer 全式的过零点落在锚点日 ±2 天内（符号翻转）。"""
    for month, day in ((4, 15), (6, 13), (9, 1), (12, 25)):
        values = []
        for offset in range(-3, 4):
            probe = datetime.date(COMMON_YEAR, month, day) + datetime.timedelta(days=offset)
            values.append(equation_of_time_minutes(day_of_year(probe.year, probe.month, probe.day)))
        assert any(values[i - 1] * values[i] < 0 for i in range(1, len(values))), f"{month}/{day} ±3 天内应过零"


def test_eot_annual_range_sanity():
    """均时差全年量级自检：最小 ≈ −14.26、最大 ≈ +16.38（Spencer 全式量级不漂）。"""
    values = [equation_of_time_minutes(n) for n in range(1, 367)]
    assert -15 < min(values) < -14
    assert 16 < max(values) < 17


# ══════════════════════════════════════════════════════════════════════════
# ② 官方 12 个起止日边界
# ══════════════════════════════════════════════════════════════════════════
def test_dst_official_year_table_matches_notice():
    """② 官方年份表逐字（国务院公告；1986 首年、1992 起停用）。"""
    actual = tuple(
        (r["year"], r["startMonth"], r["startDay"], r["endMonth"], r["endDay"], r["firstYear"])
        for r in CHINA_DST_RANGES
    )
    assert actual == EXPECTED_DST_RANGES
    # 6 个施行年，每年 2 个边界日（起 / 止）→ 官方 12 个起止日
    assert len(actual) == 6
    assert sum(2 for _ in actual) == 12


@pytest.mark.parametrize("range_", CHINA_DST_RANGES, ids=lambda r: str(r["year"]))
def test_dst_boundary_0200_clock_semantics(range_: dict):
    """② 起始日 01:59 非夏令时 / 02:00 起；结束日 01:59 按夏令时（歧义段）/ 02:00 非。"""
    year = range_["year"]
    before = get_china_dst(year, range_["startMonth"], range_["startDay"], 1, 59)
    at = get_china_dst(year, range_["startMonth"], range_["startDay"], 2, 0)
    assert before["isDst"] is False
    assert at["isDst"] is True
    assert "夏令时" in at["rule"]

    end_before = get_china_dst(year, range_["endMonth"], range_["endDay"], 1, 59)
    end_at = get_china_dst(year, range_["endMonth"], range_["endDay"], 2, 0)
    assert end_before["isDst"] is True
    assert end_at["isDst"] is False
    assert "标准时" in end_at["rule"]


def test_dst_boundaries_all_fall_on_sunday():
    """② 12 个起止日全部为周日（与「第一个周日」公告口径自洽）。"""
    assert CHINA_DST_RULES["clockConvention"] == "起止日均以钟表 02:00 为界（公告原文「凌晨 2 时」）"
    for r in CHINA_DST_RANGES:
        assert datetime.date(r["year"], r["startMonth"], r["startDay"]).weekday() == 6
        assert datetime.date(r["year"], r["endMonth"], r["endDay"]).weekday() == 6


def test_dst_in_window_and_out_of_window_days():
    """② 区间内整日夏令时；区间前一日/后一日与 1 月/10 月非夏令时。"""
    assert get_china_dst(1990, 4, 15, 12, 0)["isDst"] is True
    assert get_china_dst(1990, 7, 1, 0, 0)["isDst"] is True
    assert get_china_dst(1990, 9, 15, 23, 59)["isDst"] is True
    assert get_china_dst(1990, 4, 14, 23, 59)["isDst"] is False
    assert get_china_dst(1990, 9, 17, 0, 0)["isDst"] is False
    assert get_china_dst(1990, 1, 1, 12, 0)["isDst"] is False
    assert get_china_dst(1990, 10, 1, 12, 0)["isDst"] is False


@pytest.mark.parametrize("year", [1985, 1992, 2000, 2023])
def test_dst_out_of_range_years_are_standard_time(year: int):
    """② 表外年份（1986–1991 之外）一律标准时，且 rule 说明「不在施行年份」。"""
    for month, day in ((6, 1), (7, 15), (9, 1)):
        result = get_china_dst(year, month, day, 12, 0)
        assert result["isDst"] is False
        assert "不在中国官方夏令时施行年份（1986–1991）" in result["rule"]
    assert china_dst_range_for_year(year) is None
    assert china_dst_range_for_year(1986)["startDay"] == 4
    assert china_dst_range_for_year(1991)["endDay"] == 15


# ══════════════════════════════════════════════════════════════════════════
# ③ 1986 施行首年特殊
# ══════════════════════════════════════════════════════════════════════════
def test_1986_first_year_starts_on_may_4_not_april():
    """③ 1986 年从 5 月第一个周日（05-04）起；4 月中旬第一个周日规则不适用。"""
    assert get_china_dst(1986, 4, 13, 12, 0)["isDst"] is False   # 1986-04-13 也是周日，但当年不施行
    assert get_china_dst(1986, 4, 30, 12, 0)["isDst"] is False
    assert get_china_dst(1986, 5, 3, 23, 59)["isDst"] is False
    assert get_china_dst(1986, 5, 4, 1, 59)["isDst"] is False
    assert get_china_dst(1986, 5, 4, 2, 0)["isDst"] is True
    rule = get_china_dst(1986, 6, 1, 12, 0)["rule"]
    assert "1986 年（施行首年）：5 月第一个周日 02:00 起" in rule
    assert "05-04 02:00 起 → 09-14 02:00 止" in rule
    rule_1987 = get_china_dst(1987, 6, 1, 12, 0)["rule"]
    assert "1987–1991 年：4 月中旬第一个周日 02:00 起" in rule_1987
    assert "04-12 02:00 起 → 09-13 02:00 止" in rule_1987
    assert CHINA_DST_RULES["firstYearRule"] == "1986 年（施行首年）：5 月第一个周日 02:00 起"
    assert CHINA_DST_RULES["endRule"] == "结束日一律为 9 月第一个周日 02:00"


# ══════════════════════════════════════════════════════════════════════════
# ④ 不确定项
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize(("year", "month", "day", "hour", "minute"), [
    (1986, 9, 14, 1, 0), (1988, 9, 11, 1, 59), (1991, 9, 15, 1, 30),
])
def test_dst_ambiguous_hour_flagged(year: int, month: int, day: int, hour: int, minute: int):
    """④ 结束日 01:00–01:59（钟表重复出现的一小时）挂 dst_ambiguous_hour。"""
    result = correct_birth_time(year, month, day, hour, minute, longitude=116.4)
    assert get_china_dst(year, month, day, hour, minute)["isDst"] is True
    hit = _uncertainty_code(result, "dst_ambiguous_hour")
    assert hit is not None
    assert hit["message"] == UNCERTAINTY_MESSAGES["dst_ambiguous_hour"]


@pytest.mark.parametrize(("year", "month", "day", "hour", "minute"), [
    (1988, 9, 11, 0, 59),    # 结束日 00:59 → 不歧义
    (1988, 9, 11, 2, 0),     # 结束日 02:00 → 已回标准时
    (1988, 9, 12, 1, 30),    # 结束日次日
    (1988, 4, 10, 1, 30),    # 起始日 01:30 → 尚未施行
])
def test_dst_ambiguous_hour_not_flagged(year: int, month: int, day: int, hour: int, minute: int):
    """④ 非歧义段不得误挂 dst_ambiguous_hour。"""
    result = correct_birth_time(year, month, day, hour, minute, longitude=116.4)
    assert _uncertainty_code(result, "dst_ambiguous_hour") is None


def test_ambiguous_uncertainty_is_independent_of_apply_dst_switch():
    """④ 歧义段描述**输入本身**的不确定性 → 与 apply_dst 开关无关，一律上报。"""
    result = correct_birth_time(1988, 9, 11, 1, 30, longitude=116.4, apply_dst=False)
    assert result["applied"]["dst"] is False
    assert _uncertainty_code(result, "dst_ambiguous_hour") is not None


def test_large_true_solar_delta_flagged_for_longitude_75():
    """⑤ 经度 75°E：4·(75−120) = −180 分钟 → 真太阳时总修正 −185.7811 → 挂 true_solar_large_delta。"""
    ts = calculate_true_solar_time(1990, 7, 15, 12, 0, longitude=75)
    assert ts["longitudeDeltaMinutes"] == -180
    assert ts["totalDeltaMinutes"] == pytest.approx(-185.7811, abs=1e-9)   # Spencer 全式 EoT = −5.7811
    assert (ts["hour"], ts["minute"]) == (8, 54)

    result = correct_birth_time(1990, 7, 15, 12, 0, longitude=75)
    hit = _uncertainty_code(result, "true_solar_large_delta")
    assert hit is not None
    assert hit["message"] == UNCERTAINTY_MESSAGES["true_solar_large_delta"]
    assert result["deltaMinutes"] == -60 - 186          # 先夏令时（区间内）再真太阳时


def test_large_delta_threshold_is_20_minutes():
    """⑤ 阈值精确构造：|EoT + 经度差| = 19.9 不挂 / 20.1 挂（EoT(2/11) = −14.1997）。"""
    below = correct_birth_time(2025, 2, 11, 12, 0, longitude=118.574925)
    assert calculate_true_solar_time(2025, 2, 11, 12, 0, longitude=118.574925)["totalDeltaMinutes"] == -19.9
    assert _uncertainty_code(below, "true_solar_large_delta") is None

    above = correct_birth_time(2025, 2, 11, 12, 0, longitude=118.524925)
    assert calculate_true_solar_time(2025, 2, 11, 12, 0, longitude=118.524925)["totalDeltaMinutes"] == -20.1
    assert _uncertainty_code(above, "true_solar_large_delta") is not None
    # 中央经线 120°E 只有均时差（|EoT| < 17）→ 不挂
    central = correct_birth_time(1990, 11, 3, 12, 0, longitude=120)
    assert _uncertainty_code(central, "true_solar_large_delta") is None


def test_minute_unknown_flagged_and_treated_as_zero():
    """⑦ 缺分钟：按 00 分计算 + 挂 minute_unknown（不抛错、不回落当前时间）。"""
    with_none = correct_birth_time(2025, 3, 1, 12, None, longitude=116.4)
    with_zero = correct_birth_time(2025, 3, 1, 12, 0, longitude=116.4)
    assert _uncertainty_code(with_none, "minute_unknown") is not None
    assert _uncertainty_code(with_zero, "minute_unknown") is None
    assert {**with_none, "uncertainties": []} == {**with_zero, "uncertainties": []}


def test_uncertainty_order_is_fixed():
    """④⑤⑦ 不确定项顺序固定：dst_ambiguous_hour → true_solar_large_delta → minute_unknown。"""
    result = correct_birth_time(1990, 9, 16, 1, None, longitude=75)
    assert [u["code"] for u in result["uncertainties"]] == [
        "dst_ambiguous_hour", "true_solar_large_delta", "minute_unknown",
    ]
    assert result["applied"]["dst"] is True
    assert set(UNCERTAINTY_MESSAGES) == {"dst_ambiguous_hour", "true_solar_large_delta", "minute_unknown"}


# ══════════════════════════════════════════════════════════════════════════
# ⑥ 缺经度抛错 + 非法输入
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize("longitude", [None, "116.4"])
def test_missing_longitude_raises_value_error(longitude):
    """⑥ 缺经度 → ValueError（子类 BirthTimeInputError，code=longitude_required）。"""
    with pytest.raises(ValueError) as exc_info:
        calculate_true_solar_time(1990, 7, 15, 12, 0, longitude=longitude)
    assert isinstance(exc_info.value, BirthTimeInputError)
    assert exc_info.value.code == "longitude_required"

    with pytest.raises(ValueError) as exc_info2:
        correct_birth_time(1990, 7, 15, 12, 0, longitude=longitude)
    assert exc_info2.value.code == "longitude_required"


def test_longitude_not_required_when_true_solar_disabled():
    """⑥ 关闭真太阳时后不再需要经度（夏令时仍可单独校正）。"""
    result = correct_birth_time(1990, 7, 15, 12, 0, longitude=None, apply_true_solar=False)
    assert result["applied"] == {"eot": False, "longitude": False, "dst": True}
    assert result["deltaMinutes"] == -60
    assert result["hour"] == 11
    # 经度越界
    with pytest.raises(ValueError) as exc_info:
        calculate_true_solar_time(1990, 7, 15, 12, 0, longitude=200)
    assert exc_info.value.code == "longitude_out_of_range"


@pytest.mark.parametrize(("year", "month", "day", "hour", "minute"), [
    (2023, 2, 29, 12, 0),    # 2023 非闰年
    (2023, 13, 1, 12, 0),
    (2023, 4, 31, 12, 0),
    (2023, 4, 1, 24, 0),
    (2023, 4, 1, 12, 60),
    (2023, 4, 1, -1, 0),
    (2023, 4, 1, 12.5, 0),
    (2023, 4, 1, None, 0),
    (2023, 4, None, 12, 0),
])
def test_invalid_datetime_raises(year, month, day, hour, minute):
    """⑥ 非法日期时刻 → ValueError（code=invalid_datetime）；不猜、不默许。"""
    with pytest.raises(ValueError) as exc_info:
        correct_birth_time(year, month, day, hour, minute, longitude=116.4)
    assert exc_info.value.code == "invalid_datetime"


def test_valid_leap_days_accepted():
    """⑥ 闰日合法：2024-02-29 与 2000-02-29 均可（1900 非闰 → 拒绝）。"""
    for year in (2024, 2000):
        assert correct_birth_time(year, 2, 29, 12, 0, longitude=116.4)["day"] == 29
    with pytest.raises(ValueError):
        correct_birth_time(1900, 2, 29, 12, 0, longitude=116.4)


def test_leap_year_and_day_of_year_self_written():
    """⑥ 闰年判定与日序自写实现（1900 非闰 / 2000 闰 / 2024 闰）。"""
    assert is_leap_year(1900) is False
    assert is_leap_year(2000) is True
    assert is_leap_year(2024) is True
    assert is_leap_year(2025) is False
    assert days_in_month(1900, 2) == 28
    assert days_in_month(2000, 2) == 29
    assert day_of_year(2025, 1, 1) == 1
    assert day_of_year(2025, 12, 31) == 365
    assert day_of_year(2024, 12, 31) == 366
    assert day_of_year(1900, 3, 1) == 60
    assert day_of_year(2000, 3, 1) == 61
    assert day_of_year(2024, 2, 29) == 60


# ══════════════════════════════════════════════════════════════════════════
# ⑦ 跨日/跨月/跨年进位与退位
# ══════════════════════════════════════════════════════════════════════════
def test_cross_day_forward_2350_plus_20_minutes():
    """⑦ 23:50 + 20 分钟 → 次日 00:10（2000-04-15 闰年，EoT=+0.0196，经度 125.05 = +20.2）。"""
    result = calculate_true_solar_time(2000, 4, 15, 23, 50, longitude=125.05)
    assert result["longitudeDeltaMinutes"] == 20.2
    assert result["totalDeltaMinutes"] == pytest.approx(20.2196, abs=1e-9)
    assert (result["year"], result["month"], result["day"], result["hour"], result["minute"]) == (2000, 4, 16, 0, 10)


def test_cross_year_rollover():
    """⑦ 2023-12-31 23:50 + 18 → 2024-01-01 00:08（跨年；EoT = −2.4535）。"""
    result = correct_birth_time(2023, 12, 31, 23, 50, longitude=125.05)
    assert result["deltaMinutes"] == 18
    assert (result["year"], result["month"], result["day"], result["hour"], result["minute"]) == (2024, 1, 1, 0, 8)


def test_cross_month_backward_into_leap_day():
    """⑦ 2024-03-01 00:30 经度 75（−193）→ 2024-02-29（闰日）21:17。"""
    result = calculate_true_solar_time(2024, 3, 1, 0, 30, longitude=75)
    assert result["totalDeltaMinutes"] == pytest.approx(-192.7242, abs=1e-9)
    assert (result["year"], result["month"], result["day"], result["hour"], result["minute"]) == (2024, 2, 29, 21, 17)
    # 非闰年同日均位移：2023-03-01 00:30 经度 75 → 2023-02-28 21:17
    non_leap = calculate_true_solar_time(2023, 3, 1, 0, 30, longitude=75)
    assert (non_leap["year"], non_leap["month"], non_leap["day"], non_leap["hour"], non_leap["minute"]) == (2023, 2, 28, 21, 17)


def test_chain_order_dst_first_then_true_solar():
    """⑦ 顺序：先夏令时（−60）→ 再真太阳时；总位移 = 两项之和，一次施加。"""
    both = correct_birth_time(1988, 7, 1, 12, 0, longitude=116.4)
    ts_only = correct_birth_time(1988, 7, 1, 12, 0, longitude=116.4, apply_dst=False)
    dst_only = correct_birth_time(1988, 7, 1, 12, 0, longitude=116.4, apply_true_solar=False)
    assert both["applied"] == {"eot": True, "longitude": True, "dst": True}
    assert dst_only["deltaMinutes"] == -60
    assert both["deltaMinutes"] == dst_only["deltaMinutes"] + ts_only["deltaMinutes"]
    assert both["hour"] * 60 + both["minute"] == (12 * 60 + both["deltaMinutes"]) % 1440


def test_all_switches_off_returns_input_unchanged():
    """⑦ 两个开关全关 → 原样返回，deltaMinutes=0，无不确定项。"""
    result = correct_birth_time(1988, 7, 1, 12, 0, longitude=116.4, apply_true_solar=False, apply_dst=False)
    assert (result["year"], result["month"], result["day"], result["hour"], result["minute"]) == (1988, 7, 1, 12, 0)
    assert result["deltaMinutes"] == 0
    assert result["applied"] == {"eot": False, "longitude": False, "dst": False}
    assert result["uncertainties"] == []


def test_rounding_convention_matches_js():
    """⑦ 取整口径：floor(x·10⁴+0.5)/10⁴（半值向上；-0 归一为 0）。"""
    assert round_minutes(3.123456) == 3.1235
    assert round_minutes(-3.123456) == -3.1235
    assert round_minutes(0) == 0
    assert round_minutes(-0.00001) == 0
    assert round_minutes(-0.0001) == -0.0001
    ts = calculate_true_solar_time(2025, 5, 14, 12, 0, longitude=116.4)
    assert ts["eotMinutes"] == 3.9263
    assert ts["longitudeDeltaMinutes"] == -14.4
    assert ts["totalDeltaMinutes"] == pytest.approx(-10.4737, abs=1e-9)
    # 位移取整：floor(−10.4737 + 0.5) = floor(−9.9737) = −10 → 12:00 − 10 分钟 = 11:50
    assert (ts["hour"], ts["minute"]) == (11, 50)


# ══════════════════════════════════════════════════════════════════════════
# ⑧ 输出契约形状 + 纯函数性
# ══════════════════════════════════════════════════════════════════════════
def test_output_contract_shape_is_json_safe():
    """⑧ 输出键形状（下游按契约取键）且 JSON 可序列化（camelCase 与 JS 同形）。"""
    result = correct_birth_time(1990, 9, 16, 1, 30, longitude=116.4)
    assert list(result) == ["year", "month", "day", "hour", "minute", "applied", "deltaMinutes", "uncertainties"]
    assert list(result["applied"]) == ["eot", "longitude", "dst"]
    assert list(calculate_true_solar_time(2025, 5, 14, 12, 0, longitude=116.4)) == [
        "year", "month", "day", "hour", "minute", "eotMinutes", "longitudeDeltaMinutes", "totalDeltaMinutes",
    ]
    assert list(get_china_dst(1986, 5, 4, 2, 0)) == ["isDst", "rule"]
    assert json.loads(json.dumps(result, ensure_ascii=False)) == result
    assert all(set(u) == {"code", "message"} for u in result["uncertainties"])
    assert isinstance(result["deltaMinutes"], int)


def test_pure_function_same_input_same_output():
    """⑧ 纯函数性：同输入同输出（本模块不读时钟、不读环境变量）。"""
    args = (1990, 9, 16, 1, 30)
    kwargs = {"longitude": 116.4}
    assert correct_birth_time(*args, **kwargs) == correct_birth_time(*args, **kwargs)
    assert calculate_true_solar_time(*args, **kwargs) == calculate_true_solar_time(*args, **kwargs)


def test_source_has_no_clock_network_or_randomness():
    """⑧ 源码级纪律：无时钟、无随机、无网络、无环境变量（确定性纯计算）。"""
    source = BIRTHTIME_PATH.read_text(encoding="utf-8")
    for forbidden in ("import time", "datetime.now", "random", "os.environ", "requests", "httpx", "urllib", "socket"):
        assert forbidden not in source, f"birthtime.py 不得出现 {forbidden}（确定性/零触网纪律）"


def test_module_declares_single_authoritative_source_in_docstring():
    """⑧ 模块 docstring 声明「规范唯一权威 = JS rules + 本文件同锚点交叉验证」。"""
    import app.paipan.birthtime as birthtime

    doc = birthtime.__doc__ or ""
    assert "规范唯一权威" in doc
    assert "true-solar-time.js" in doc
    assert "节149" in doc


def test_module_has_zero_new_dependencies():
    """⑧ 零新依赖：ast 解析 import，只允许 math（+ __future__）。"""
    tree = ast.parse(BIRTHTIME_PATH.read_text(encoding="utf-8"))
    modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module.split(".")[0])
    assert modules <= {"math", "__future__"}, f"birthtime.py 引入了非标准库依赖: {modules}"


# ══════════════════════════════════════════════════════════════════════════
# ⑨ ⑧ Python ↔ Node 逐字段一致（20 组输入 × 三函数）
# ══════════════════════════════════════════════════════════════════════════
@pytest.mark.skipif(NODE_BIN is None, reason="node 不可用：跨语言一致性门禁需 node")
def test_python_matches_node_on_20_cases():
    """⑧ Python 与 Node 逐字段一致：调内核导出的交叉比对脚本，要求输出「全部 20 组一致」。

    脚本在设计上就在**组内比对三函数**（correctBirthTime / calculateTrueSolarTime /
    getChinaDst）并附检缺经度错误码；任一处不一致 → 退出码 1，本用例随之变红。

    显式把本用例所在解释器（`sys.executable`）透给脚本（`MINGLI_PYTHON_BIN`），
    避免依赖 PATH 上的 `python` 与当前环境不一致（虚拟环境/别名差异）。
    """
    import os

    env = {**os.environ, "MINGLI_PYTHON_BIN": sys.executable}
    proc = subprocess.run(
        [NODE_BIN, CROSSCHECK_SCRIPT],
        cwd=str(NODE_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=180,
        env=env,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    assert proc.returncode == 0, f"交叉比对失败（exit {proc.returncode}）：\n{out}"
    assert "全部 20 组一致" in proc.stdout, f"未输出「全部 20 组一致」：\n{out}"
    assert "longitude_required" in proc.stdout, "缺经度错误码附检缺失"
