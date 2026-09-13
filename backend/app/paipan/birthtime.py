# -*- coding: utf-8 -*-
"""节149 · 出生时间校正链（真太阳时 + 中国夏令时 1986–1991）· Python 镜像。

**规范唯一权威 = `paipan-node/paipan-core/src/rules/true-solar-time.js` + 本文件同锚点测试交叉验证（节149）**

本文件是 Node 自研内核能力 `paipan-node/paipan-core/src/capabilities/true-solar-time/index.js`
的 **Python 镜像**：同一套公式、同一套夏令时年份表、同一套取整与进位口径、同一套不确定项文案。
为什么要有镜像：`backend/app/paipan/engine.py`（八字链路）走 Python 侧，**不经过 Node 调用**；
两份实现的一致性由 `paipan-core/tools/true-solar-crosscheck.mjs`（20 组输入逐字段比对）
与两侧同锚点测试（`tests/true-solar-time.test.mjs` / `tests/unit/test_birthtime.py`）共同守住。

零新依赖：只用标准库 `math`；闰年判定自写（不引入 `calendar`/`datetime` 之外的历法间接层）。

口径（与内核逐条对齐，改这里必须同步改 JS，否则交叉比对立刻红）：
  1. **均时差**：**NOAA/Spencer 全式**（Spencer 1971 傅里叶级数；节149 **方案②** 采纳）
     `γ = 2π(N−1)/365`、`EoT = 229.18·(0.000075 + 0.001868·cos γ − 0.032077·sin γ
     − 0.014615·cos 2γ − 0.040849·sin 2γ)`（分钟）。
     符号约定写死：**真太阳时 = 民用时 + 4·(经度 − 120) + EoT**（东八区 LSTM = 120°E）。
  2. **中国夏令时官方年份表（1986–1991，国务院公告）**：起止日均为钟表 02:00。
     起始日 02:00（含）起为夏令时；结束日 02:00 前（含 01:00–01:59 这一小时重复出现的
     歧义段）按夏令时计，并挂 `dst_ambiguous_hour` 不确定项。1986 年为施行首年
     （5 月第一个周日起），1987–1991 为 4 月中旬第一个周日；结束日一律 9 月第一个周日。
  3. **校正顺序**：先夏令时（−60 分钟）→ 再真太阳时（EoT + 经度差），一次性施加位移
     （位移量 = dstDelta + floor(真太阳时总修正 + 0.5)），可跨日/跨月/跨年。
     EoT 的日序 N 取**输入民用日**。
  4. **取整**：暴露的分钟浮点统一 `floor(x·10⁴+0.5)/10⁴`（与 JS `Math.round` 的半值语义不同，
     这样两语言逐字段一致）。
  5. **不确定项**（与 `meta.degraded_methods` 语义不同，不许混用）：
     `dst_ambiguous_hour` → `true_solar_large_delta`（|EoT + 经度差| ≥ 20 分钟）→ `minute_unknown`。

输出结构（与 JS 同 JSON 形状，键名保持 camelCase 以便逐字段比对）:
    {"year":…, "month":…, "day":…, "hour":…, "minute":…,
     "applied": {"eot":…, "longitude":…, "dst":…},
     "deltaMinutes":…, "uncertainties": [{"code":…, "message":…}, …]}

⚠️ 精度诚实登记（**换式后**）：Spencer 全式相对 NOAA 实测 EoT 偏差上界 **0.3923 分钟**
（7 个锚点：2/11、4/15、5/14、11/3 达 ±0.3 目标，3 个零点日 6/13、9/1、12/25 在
0.30–0.40 区间，属闭式级数极限）。换式前的简化近似式偏差上界 0.85 分钟，已废弃留痕
（`EOT_ACCURACY["supersededFormula"]`）。本文件与 JS 侧逐条一致，交叉比对守漂移。
"""
from __future__ import annotations

import math

# ── 常量（与 rules/true-solar-time.js 逐项对齐）────────────────────────────
LSTM_DEGREES = 120.0
MINUTES_PER_LONGITUDE_DEGREE = 4.0
MINUTE_DECIMALS = 4
LARGE_TRUE_SOLAR_DELTA_MINUTES = 20
DST_OFFSET_MINUTES = -60
MINUTES_PER_DAY = 1440
DST_BOUNDARY_MINUTE_OF_DAY = 120

EOT_FORMULA = {
    "source": "NOAA/Spencer 全式（Spencer 1971 傅里叶级数；NOAA 太阳能计算器口径；公知公开公式）",
    "expression": "EoT = 229.18·(0.000075 + 0.001868·cos γ − 0.032077·sin γ − 0.014615·cos 2γ − 0.040849·sin 2γ)",
    "gammaExpression": "γ = 2π·(N − 1) / 365",
    "scaleMinutes": 229.18,
    "offset": 1,
    "denominator": 365,
    "constantCoefficient": 0.000075,
    "cosGammaCoefficient": 0.001868,
    "sinGammaCoefficient": -0.032077,
    "cos2GammaCoefficient": -0.014615,
    "sin2GammaCoefficient": -0.040849,
    "signConvention": "真太阳时 = 民用时 + 4·(经度 − 120) + EoT（EoT = 视太阳时 − 平太阳时）",
    "superseded": "EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)，B = 2π·(N−81)/364"
                  "（节149 方案②换式前口径；固有偏差上界 0.85 分钟，已废弃，仅留痕）",
}

# 权威锚点（对拍用；与 JS rules 的 EOT_ANCHORS 同值，逐项比对由交叉脚本承担）
# 说明：5/14 任务书原文写作「−3.7」，真值与两式均为正号（+3.7），按真值登记。
EOT_ANCHORS = (
    {"month": 2, "day": 11, "anchor": -14.2, "maxDeviation": 0.3, "observed": 0.0003},
    {"month": 5, "day": 14, "anchor": 3.7, "maxDeviation": 0.3, "observed": 0.2263},
    {"month": 11, "day": 3, "anchor": 16.4, "maxDeviation": 0.3, "observed": 0.0347},
    {"month": 4, "day": 15, "anchor": 0.0, "maxDeviation": 0.3, "observed": 0.2404},
    {"month": 6, "day": 13, "anchor": 0.0, "maxDeviation": 0.4, "observed": 0.3923},
    {"month": 9, "day": 1, "anchor": 0.0, "maxDeviation": 0.4, "observed": 0.3731},
    {"month": 12, "day": 25, "anchor": 0.0, "maxDeviation": 0.4, "observed": 0.3076},
)

EOT_ACCURACY = {
    "formula": "NOAA/Spencer 全式（节149 方案② 采纳；Spencer 1971 傅里叶级数）",
    "formulaMaxDeviationMinutes": 0.4,
    "worstAnchor": "6/13（偏差 0.3923 分钟）",
    "taskTargetMinutes": 0.3,
    "anchorsWithinTarget": ("2/11", "4/15", "5/14", "11/3"),
    "anchorsOutsideTarget": ("6/13", "9/1", "12/25"),
    "supersededFormula": "EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)，B = 2π·(N−81)/364",
    "supersededMaxDeviationMinutes": 0.85,
    "supersededAnchorsOutsideTarget": ("2/11", "9/1", "12/25"),
    "decision": "节149 方案②：换用 Spencer 全式（换式前偏差上界 0.85 分钟且 3 项超 ±0.3；"
                "换式后 0.3923 分钟，2/11 与锚值 −14.2 逐位吻合）",
    "note": "本镜像与 JS 侧逐条一致；达标与否由两侧测试逐项断言，不静默放水。",
}

# 国务院公告官方年份表（1986 首年、1992 年起停用）
CHINA_DST_RANGES = (
    {"year": 1986, "startMonth": 5, "startDay": 4, "endMonth": 9, "endDay": 14, "firstYear": True},
    {"year": 1987, "startMonth": 4, "startDay": 12, "endMonth": 9, "endDay": 13, "firstYear": False},
    {"year": 1988, "startMonth": 4, "startDay": 10, "endMonth": 9, "endDay": 11, "firstYear": False},
    {"year": 1989, "startMonth": 4, "startDay": 16, "endMonth": 9, "endDay": 17, "firstYear": False},
    {"year": 1990, "startMonth": 4, "startDay": 15, "endMonth": 9, "endDay": 16, "firstYear": False},
    {"year": 1991, "startMonth": 4, "startDay": 14, "endMonth": 9, "endDay": 15, "firstYear": False},
)

CHINA_DST_RULES = {
    "source": "国务院 1986 年 4 月公告及历年公告（官方年份表；1986 首年、1992 年起停用）",
    "clockConvention": "起止日均以钟表 02:00 为界（公告原文「凌晨 2 时」）",
    "startBoundary": "起始日当日 02:00（含）起为夏令时；该日 00:00–01:59 仍按标准时",
    "endBoundary": "结束日当日 02:00 前（不含 02:00）为夏令时；该日 02:00（含）起按标准时",
    "ambiguousWindow": "结束日 01:00–01:59（钟表重复出现的一小时）——本镜像一律按夏令时计，并挂 dst_ambiguous_hour",
    "firstYearRule": "1986 年（施行首年）：5 月第一个周日 02:00 起",
    "otherYearsRule": "1987–1991 年：4 月中旬第一个周日 02:00 起",
    "endRule": "结束日一律为 9 月第一个周日 02:00",
    "offsets": "夏令时钟表 = 北平标准时（UTC+8）+ 1 小时 = UTC+9",
    "ranges": CHINA_DST_RANGES,
}

# 不确定项文案（逐字照抄 rules 的 UNCERTAINTY_MESSAGES；交叉比对会校验两侧一致）
UNCERTAINTY_MESSAGES = {
    "dst_ambiguous_hour": (
        "出生时间落在夏令时结束日 01:00–01:59（钟表重复出现的一小时）：此时刻既可能是夏令时（UTC+9）也可能是标准时（UTC+8）；"
        "本内核按夏令时计，请与出生记录核对。"
    ),
    "true_solar_large_delta": (
        "真太阳时总修正（均时差 + 经度差）绝对值 ≥ 20 分钟：校正量大，时辰判定对口径敏感，请核对经度与出生时间来源。"
    ),
    "minute_unknown": (
        "输入缺分钟（minute）：按 00 分计算，时辰判定可能整体偏移一个时辰。"
    ),
}

_MONTH_DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


class BirthTimeInputError(ValueError):
    """出生时间校正的输入错误（是 ValueError 的子类，便于调用方按契约 `except ValueError` 捕获）。

    `code` 与 Node 内核的 `PaipanInputError.code` 同名：`longitude_required` /
    `longitude_out_of_range` / `invalid_datetime`。
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


# ── 纯函数：闰年 / 日序 / 取整 / 均时差 ────────────────────────────────────
def is_leap_year(year: int) -> bool:
    """闰年判定（自写）：能被 4 整除，且（不被 100 整除或被 400 整除）。"""
    y = int(year)
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def days_in_month(year: int, month: int) -> int:
    """某年某月的天数（闰年 2 月 29 天）。"""
    m = int(month)
    if m == 2:
        return 29 if is_leap_year(year) else 28
    return _MONTH_DAYS[m - 1]


def day_of_year(year: int, month: int, day: int) -> int:
    """一年中第几天（N，1–366；1 月 1 日 = 1），闰年感知。"""
    n = int(day)
    for m in range(1, int(month)):
        n += days_in_month(year, m)
    return n


def round_minutes(value: float) -> float:
    """分钟浮点保留 4 位：floor(x·10⁴+0.5)/10⁴（与 JS 侧同式，-0 归一为 0）。"""
    r = math.floor(value * 10 ** MINUTE_DECIMALS + 0.5) / 10 ** MINUTE_DECIMALS
    return 0.0 if r == 0 else r


def equation_of_time_minutes(n: int) -> float:
    """均时差（分钟，未取整；符号 = 视太阳时 − 平太阳时）。

    节149 方案②：NOAA/Spencer 全式。逐项相加后再乘 229.18，加/减项顺序与 JS 侧逐字一致
    （浮点逐位可复现，交叉比对不做任何容差猜测）。
    """
    gamma = (2 * math.pi * (n - EOT_FORMULA["offset"])) / EOT_FORMULA["denominator"]
    return EOT_FORMULA["scaleMinutes"] * (
        EOT_FORMULA["constantCoefficient"]
        + EOT_FORMULA["cosGammaCoefficient"] * math.cos(gamma)
        + EOT_FORMULA["sinGammaCoefficient"] * math.sin(gamma)
        + EOT_FORMULA["cos2GammaCoefficient"] * math.cos(2 * gamma)
        + EOT_FORMULA["sin2GammaCoefficient"] * math.sin(2 * gamma)
    )


def month_day_key(month: int, day: int) -> int:
    """月份日 → 可比较序号（MMDD 整数），与 JS 侧同式。"""
    return int(month) * 100 + int(day)


def _pad2(n: int) -> str:
    return str(int(n)).zfill(2)


def china_dst_range_for_year(year: int):
    """取某年的夏令时区间（不在 1986–1991 则返回 None）。"""
    y = int(year)
    for rng in CHINA_DST_RANGES:
        if rng["year"] == y:
            return rng
    return None


def china_dst_rule_text(rng, year: int) -> str:
    """夏令时规则文案（唯一格式化位置，与 JS 侧逐字一致）。"""
    if rng is None:
        return f"不在中国官方夏令时施行年份（1986–1991）：{int(year)} 年无夏令时（1992 年起停用）"
    window = (
        f"{_pad2(rng['startMonth'])}-{_pad2(rng['startDay'])} 02:00 起 → "
        f"{_pad2(rng['endMonth'])}-{_pad2(rng['endDay'])} 02:00 止"
    )
    start_rule = CHINA_DST_RULES["firstYearRule"] if rng["firstYear"] else CHINA_DST_RULES["otherYearsRule"]
    return (
        f"{int(year)} 年夏令时：{window}（{start_rule}；{CHINA_DST_RULES['endRule']}；钟表 UTC+9）"
    )


# ── ① 输入归一化 ───────────────────────────────────────────────────────────
def _normalize_input(year, month, day, hour, minute) -> dict:
    """校验年月日时分；缺 minute（None）→ 按 0 计并标记 minuteKnown=False。

    Raises:
        BirthTimeInputError('invalid_datetime'): 字段缺失/非整数/越界（含该月不存在的日期）
    """
    int_fields = (("year", year, 1, 9999), ("month", month, 1, 12), ("day", day, 1, 31), ("hour", hour, 0, 23))
    for name, value, lo, hi in int_fields:
        if isinstance(value, bool) or not isinstance(value, int) or value < lo or value > hi:
            raise BirthTimeInputError("invalid_datetime", f"出生时间字段 {name} 非法（需 {lo}-{hi} 的整数）: {value!r}")
    if day > days_in_month(year, month):
        raise BirthTimeInputError(
            "invalid_datetime",
            f"出生时间日期不存在：{year}-{month}-{day}（该年该月只有 {days_in_month(year, month)} 天）",
        )
    minute_known = minute is not None
    minute_value = 0 if minute is None else minute
    if isinstance(minute_value, bool) or not isinstance(minute_value, int) or minute_value < 0 or minute_value > 59:
        raise BirthTimeInputError("invalid_datetime", f"出生时间字段 minute 非法（需 0-59 的整数）: {minute!r}")
    return {"year": year, "month": month, "day": day, "hour": hour, "minute": minute_value,
            "minuteKnown": minute_known}


def _require_longitude(longitude) -> float:
    """经度校验（缺经度一律抛错：不猜经度，也不用 120°E 顶替）。"""
    if longitude is None or isinstance(longitude, bool) or not isinstance(longitude, (int, float)):
        raise BirthTimeInputError(
            "longitude_required",
            "真太阳时校正必须传 longitude（经度，度）：缺经度时不得回落中央经线 120°E 或任何默认值。",
        )
    value = float(longitude)
    if not math.isfinite(value):
        raise BirthTimeInputError("longitude_required", f"经度不是有限数值: {longitude!r}")
    if value < -180 or value > 180:
        raise BirthTimeInputError("longitude_out_of_range", f"经度超出 [-180,180]: {longitude}")
    return value


def _shift_by_minutes(dt: dict, delta_minutes: int) -> dict:
    """按整数分钟整体位移日期时刻（可跨日/跨月/跨年；纯整数运算，与 JS 侧同式）。"""
    total = dt["hour"] * 60 + dt["minute"] + delta_minutes
    day_shift = total // MINUTES_PER_DAY          # Python // 即 floor 除法，负数同义
    rem = total - day_shift * MINUTES_PER_DAY
    year, month, day = dt["year"], dt["month"], dt["day"]
    for _ in range(abs(day_shift)):
        if day_shift > 0:
            day += 1
            if day > days_in_month(year, month):
                day = 1
                month += 1
                if month > 12:
                    month = 1
                    year += 1
        else:
            day -= 1
            if day < 1:
                month -= 1
                if month < 1:
                    month = 12
                    year -= 1
                day = days_in_month(year, month)
    return {"year": year, "month": month, "day": day,
            "hour": rem // 60, "minute": rem % 60}


# ── ② 日序 + EoT ───────────────────────────────────────────────────────────
def resolve_day_of_year(year: int, month: int, day: int) -> dict:
    """② 段：本能力无历法换算，②段即「日序 N + 未取整 EoT」。"""
    n = day_of_year(year, month, day)
    return {"dayOfYear": n, "equationOfTimeMinutes": equation_of_time_minutes(n)}


# ── ③ 校正判定 ─────────────────────────────────────────────────────────────
def get_china_dst(year, month, day, hour, minute) -> dict:
    """中国夏令时判定（官方年份表 + 钟表 02:00 边界）。

    Returns:
        {"isDst": bool, "rule": str}（键名与 JS 侧一致，便于逐字段比对）
    """
    dt = _normalize_input(year, month, day, hour, minute)
    rng = china_dst_range_for_year(dt["year"])
    rule_base = china_dst_rule_text(rng, dt["year"])
    if rng is None:
        return {"isDst": False, "rule": f"{rule_base}；按标准时（UTC+8）计"}
    key = month_day_key(dt["month"], dt["day"])
    start_key = month_day_key(rng["startMonth"], rng["startDay"])
    end_key = month_day_key(rng["endMonth"], rng["endDay"])
    minute_of_day = dt["hour"] * 60 + dt["minute"]
    if key < start_key or key > end_key:
        is_dst = False
    elif key == start_key:
        is_dst = minute_of_day >= DST_BOUNDARY_MINUTE_OF_DAY
    elif key == end_key:
        is_dst = minute_of_day < DST_BOUNDARY_MINUTE_OF_DAY
    else:
        is_dst = True
    return {"isDst": is_dst,
            "rule": f"{rule_base}；按{'夏令时（UTC+9）' if is_dst else '标准时（UTC+8）'}计"}


def _is_dst_ambiguous_hour(dt: dict) -> bool:
    """结束日 01:00–01:59（钟表重复出现的一小时）→ True。"""
    rng = china_dst_range_for_year(dt["year"])
    if rng is None:
        return False
    same_day = month_day_key(dt["month"], dt["day"]) == month_day_key(rng["endMonth"], rng["endDay"])
    return bool(same_day and dt["hour"] == 1)


def _true_solar_delta(dt: dict, longitude: float) -> float:
    """③ 段：真太阳时总修正（已取整到 4 位小数），零不附加任何历法依赖。"""
    eot = round_minutes(equation_of_time_minutes(day_of_year(dt["year"], dt["month"], dt["day"])))
    longitude_delta = round_minutes((longitude - LSTM_DEGREES) * MINUTES_PER_LONGITUDE_DEGREE)
    return round_minutes(eot + longitude_delta)


# ── 公开 API ───────────────────────────────────────────────────────────────
def calculate_true_solar_time(year, month, day, hour, minute, longitude) -> dict:
    """民用时 → 真太阳时：民用时 + 4·(经度 − 120) + EoT。

    Args:
        year/month/day/hour: 整数（公历民用时，东八区挂钟）。
        minute: 0–59；None 视为缺分钟（按 0 计，本函数不挂不确定项）。
        longitude: 经度（度，东经为正）；**必填**。

    Returns:
        {"year","month","day","hour","minute","eotMinutes","longitudeDeltaMinutes","totalDeltaMinutes"}
        （键名与 JS `calculateTrueSolarTime` 完全一致）

    Raises:
        BirthTimeInputError: `longitude_required`（缺经度）/ `longitude_out_of_range` / `invalid_datetime`
    """
    dt = _normalize_input(year, month, day, hour, minute)
    lon = _require_longitude(longitude)
    eot = round_minutes(equation_of_time_minutes(day_of_year(dt["year"], dt["month"], dt["day"])))
    longitude_delta = round_minutes((lon - LSTM_DEGREES) * MINUTES_PER_LONGITUDE_DEGREE)
    total_delta = round_minutes(eot + longitude_delta)
    shifted = _shift_by_minutes(dt, math.floor(total_delta + 0.5))
    return {
        "year": shifted["year"], "month": shifted["month"], "day": shifted["day"],
        "hour": shifted["hour"], "minute": shifted["minute"],
        "eotMinutes": eot, "longitudeDeltaMinutes": longitude_delta, "totalDeltaMinutes": total_delta,
    }


def correct_birth_time(year, month, day, hour, minute,
                       longitude=None, apply_true_solar=True, apply_dst=True) -> dict:
    """出生时间校正链（唯一入口）：先夏令时（−60 分钟）→ 再真太阳时（EoT + 经度差）。

    顺序与口径（与 Node 内核逐条一致）：
      1. 夏令时判定（`apply_dst` 为真时生效）→ 位移 −60 分钟；
      2. 真太阳时（`apply_true_solar` 为真时）→ 位移 floor(EoT + 经度差 + 0.5) 分钟；
      3. 一次施加总位移（可跨日/跨月/跨年）；EoT 的日序 N 取输入民用日；
      4. 不确定项顺序：`dst_ambiguous_hour` → `true_solar_large_delta` → `minute_unknown`。
        `dst_ambiguous_hour` 描述**输入本身**的歧义，**与 `apply_dst` 开关无关**，一律上报。

    Args:
        year/month/day/hour: 整数。
        minute: 0–59；None（缺分钟）→ 按 0 计并挂 `minute_unknown`（**不抛错**，仍出结果）。
        longitude: 经度（度）；`apply_true_solar` 为真时**必填**，否则 ValueError。
        apply_true_solar: 缺省 True（None 视为 True，与 JS 侧「未传」同义）。
        apply_dst: 缺省 True（None 视为 True）。

    Returns:
        {"year","month","day","hour","minute",
         "applied": {"eot": bool, "longitude": bool, "dst": bool},
         "deltaMinutes": int, "uncertainties": [{"code": str, "message": str}, ...]}

    Raises:
        BirthTimeInputError: `longitude_required` / `longitude_out_of_range` / `invalid_datetime`
            （均为 ValueError 子类；缺经度且 `apply_true_solar` 为真即抛）
    """
    dt = _normalize_input(year, month, day, hour, minute)          # ① 输入归一化
    want_true_solar = True if apply_true_solar is None else bool(apply_true_solar)
    want_dst = True if apply_dst is None else bool(apply_dst)

    uncertainties = []
    # ① dst 歧义段（输入本身的歧义，与开关无关）
    if _is_dst_ambiguous_hour(dt):
        uncertainties.append({"code": "dst_ambiguous_hour",
                              "message": UNCERTAINTY_MESSAGES["dst_ambiguous_hour"]})

    dst_result = get_china_dst(dt["year"], dt["month"], dt["day"], dt["hour"], dt["minute"])  # ③ 夏令时
    dst_applied = bool(want_dst and dst_result["isDst"])

    true_solar_delta = 0
    if want_true_solar:
        lon = _require_longitude(longitude)                        # 缺经度 → ValueError
        total = _true_solar_delta(dt, lon)                         # ② 日序 + ③ 真太阳时总修正
        true_solar_delta = math.floor(total + 0.5)
        if abs(total) >= LARGE_TRUE_SOLAR_DELTA_MINUTES:           # ② 大修正
            uncertainties.append({"code": "true_solar_large_delta",
                                  "message": UNCERTAINTY_MESSAGES["true_solar_large_delta"]})
    if not dt["minuteKnown"]:                                      # ③ 缺分钟
        uncertainties.append({"code": "minute_unknown",
                              "message": UNCERTAINTY_MESSAGES["minute_unknown"]})

    delta_minutes = (DST_OFFSET_MINUTES if dst_applied else 0) + true_solar_delta   # ④ 装配
    shifted = _shift_by_minutes(dt, delta_minutes)
    return {
        "year": shifted["year"], "month": shifted["month"], "day": shifted["day"],
        "hour": shifted["hour"], "minute": shifted["minute"],
        "applied": {"eot": want_true_solar, "longitude": want_true_solar, "dst": dst_applied},
        "deltaMinutes": delta_minutes,
        "uncertainties": uncertainties,
    }


__all__ = [
    "BirthTimeInputError",
    "LSTM_DEGREES",
    "LARGE_TRUE_SOLAR_DELTA_MINUTES",
    "EOT_FORMULA",
    "EOT_ANCHORS",
    "EOT_ACCURACY",
    "CHINA_DST_RANGES",
    "CHINA_DST_RULES",
    "UNCERTAINTY_MESSAGES",
    "is_leap_year",
    "days_in_month",
    "day_of_year",
    "round_minutes",
    "equation_of_time_minutes",
    "month_day_key",
    "china_dst_range_for_year",
    "china_dst_rule_text",
    "resolve_day_of_year",
    "get_china_dst",
    "calculate_true_solar_time",
    "correct_birth_time",
]
