# -*- coding: utf-8 -*-
"""法达（Firdaria）主限时间线 —— 自研纯查表，零天文库依赖。

序列来源：docs/架构设计-横向扩展.md §5.6「法达（firdaria）：自研纯查表——
75 年法达主限序列按出生「日盘/夜盘」起算，约 30–50 行 Python，零依赖」。

口径（中世纪波斯—阿拉伯占星通行的 75 年主限周期，Dorothean Firdaria）：
  - 出生时太阳在地平线上（日盘, sect of the day）→ 首主星为太阳；
  - 出生时太阳在地平线下（夜盘）→ 首主星为月亮。
  - 主限顺序（按主管星年限累加，一轮 9 主星共 75 年，75 岁起进入下一轮同序列）：
      日盘：太阳 → 金星 → 水星 → 月亮 → 土星 → 木星 → 火星 → 北交点 → 南交点
      夜盘：月亮 → 土星 → 木星 → 火星 → 太阳 → 金星 → 水星 → 北交点 → 南交点
  - 各主星年限固定（共 75 年）：
      太阳 10 年 / 金星 8 年 / 水星 13 年 / 月亮 9 年 / 土星 11 年 / 木星 12 年 /
      火星 7 年 / 北交点 3 年 / 南交点 2 年。

MVP 简化：日/夜盘由调用方判定（如 hour >= 6 and hour < 18 视为日盘），
本模块不做天文地平线计算；birth_year 保留入参（供后续「按出生年份+当前年龄
取当前主限」等调用折算使用），纯时间线本身只依赖 is_day。
"""

# 各主星固定年限（年），9 主星合计 75 年
RULER_YEARS = {
    "太阳": 10,
    "金星": 8,
    "水星": 13,
    "月亮": 9,
    "土星": 11,
    "木星": 12,
    "火星": 7,
    "北交点": 3,
    "南交点": 2,
}

# 主限起算序列：日盘以太阳起算、夜盘以月亮起算（见模块 docstring）
DAY_RULERS = ["太阳", "金星", "水星", "月亮", "土星", "木星", "火星", "北交点", "南交点"]
NIGHT_RULERS = ["月亮", "土星", "木星", "火星", "太阳", "金星", "水星", "北交点", "南交点"]

# 一轮完整主限 = 75 周岁（每主星按 RULER_YEARS 累加）
FIRDARIA_CYCLE_YEARS = sum(RULER_YEARS.values())  # 75

# 日盘简化判定阈值（MVP：出生时刻 6:00–18:00 前视为日盘；由调用方自行选用）
DAYTIME_HOUR_START = 6
DAYTIME_HOUR_END = 18


def is_daytime(hour: int) -> bool:
    """MVP 简化日盘判定：hour ∈ [6, 18) 视为日盘（太阳在地平线上）。

    占星法达的日/夜盘以出生地真实太阳地平高度为准；MVP 不做天文地平线计算，
    以固定时段近似，供调用方（/astrology 或前端）按需传入 is_day。
    """
    return DAYTIME_HOUR_START <= hour < DAYTIME_HOUR_END


def firdaria_timeline(birth_year: int, is_day: bool, start_age: int = 0, end_age: int = 75) -> list[dict]:
    """返回法达主限时间线：`[{period_start_age, period_end_age, ruler}]`。

    年龄为周岁，按「整段主限」输出（不与请求窗口做半段截断）：
      - 内部以半开区间 [band_start, band_end) 累加（band_end = band_start + 年限），
        period_end_age 输出为该主限覆盖的最后一个周岁（闭合端点，如太阳 0–9 周岁）；
      - 一轮 9 主星共 75 个整周岁（0–74），75 周岁起进入下一轮同序列；
      - 返回与窗口 [start_age, end_age)（周岁，起点闭、终点开）有交叠的全部整段主限；
        缺省 (0, 75) 即完整 75 周岁一轮。

    Args:
        birth_year: 出生公历年（保留：纯时间线不依赖，仅供后续按出生时间折算调用）。
        is_day: True=日盘（太阳在地平线上出生，首主星太阳）；False=夜盘（首主星月亮）。
        start_age: 时间线起点周岁（缺省 0，出生起）。
        end_age: 时间线终点周岁（缺省 75，即完整 75 年主限一轮）。
    """
    rulers = DAY_RULERS if is_day else NIGHT_RULERS
    periods: list[dict] = []
    band_start = 0
    while band_start < end_age:
        for ruler in rulers:
            band_end = band_start + RULER_YEARS[ruler]  # 半开区间 [band_start, band_end)
            # 与窗口 [start_age, end_age)（周岁，起点闭、终点开）有交叠才返回整段
            if band_end > start_age and band_start < end_age:
                periods.append({
                    "period_start_age": band_start,
                    "period_end_age": band_end - 1,  # 闭合端点：该主限最后一周岁
                    "ruler": ruler,
                })
            band_start = band_end
            if band_start >= end_age:
                break
        # while 条件已覆盖（end_age 可能超出 75 → 进入下一轮同序列）
    return periods
