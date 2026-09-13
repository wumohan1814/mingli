/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 真太阳时 + 中国夏令时（1986–1991）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（见 README §2）：
 *   本文件是「出生时间校正链」（节149）的**唯一权威规则位置**：均时差公式与系数、
 *   中国夏令时年份表、边界口径、不确定项码与文案、全部锚点常量，都在这里，并且
 *   `Object.freeze`。调用方（`capabilities/true-solar-time/`、交叉比对脚本、
 *   两侧测试、`backend/app/paipan/birthtime.py` Python 镜像）**只能读不能抄** ——
 *   任何地方出现第二份系数/日期/文案拷贝即视为缺陷（规则漂移是已知教训）。
 *
 * 来源纯度：本能力**不由任何第三方排盘实现派生**（不读、不抄、不移植任何 vendor 代码），
 * 公式来自 NOAA 公开近似式，夏令时表来自国务院公告年份，均为公知数据（见下方逐条来源标注）。
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」。纯数据 + 纯函数。
 */

/* ===========================================================================
 * §1 均时差（Equation of Time, EoT）
 * ===========================================================================
 * 来源：**NOAA/Spencer 全式**（Spencer 1971 年傅里叶级数；NOAA 太阳能计算器口径；
 *       公知公开公式，非任何第三方排盘实现派生）。文字版：
 *
 *     γ   = 2π·(N − 1) / 365            N = 一年中的第几天（1–366）
 *     EoT = 229.18·[ 0.000075 + 0.001868·cos(γ) − 0.032077·sin(γ)
 *                    − 0.014615·cos(2γ) − 0.040849·sin(2γ) ]     [分钟]
 *
 * ⚠️ 换式登记（节149 · 方案② 裁决）：本能力最初按任务书点名的简化近似式
 *   `B = 2π(N−81)/364`、`EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)` 落法，实测其
 *   固有偏差上界 **0.85 分钟**（7 个权威锚点中 2/11、9/1、12/25 三项超 ±0.3 目标）。
 *   经节149 裁决**采纳方案②，改用上述 Spencer 全式**：同组锚点最大偏差降到
 *   **0.3923 分钟**，且 2/11 与锚值 −14.2 逐位吻合（实现值 −14.1997）。旧式已废弃
 *   （见 EOT_FORMULA.superseded 与 EOT_ACCURACY），仅作审计留痕，不再参与计算。
 *
 * ⚠️ 符号约定（写死，不得在别处再定义一遍）：
 *     真太阳时 = 民用时 + 4·(经度 − 120) + EoT
 *   即 EoT 采用「视太阳时 − 平太阳时」的口径：EoT > 0 表示日晷快于钟表。
 *   东八区中央经线 LSTM = 120°E（北京时 UTC+8 的中央经线）。
 *
 * ⚠️ 剩余偏差登记（诚实登记项）：换式后仍有 3 个锚点（6/13、9/1、12/25）略超 ±0.3
 *   ——这是闭式级数本身的极限（它们都是「EoT≈0 的零点日」，过零点不精确落在该日）。
 *   零点日锚点因此按「过零点落在锚点日 ±2 天内」，其余按逐项偏差断言，见 EOT_ACCURACY。
 */

/** 东八区中央经线（度）。全内核唯一处定义 LSTM。 */
export const LSTM_DEGREES = 120;

/** 经度差换算系数：每偏离中央经线 1° = 4 分钟。 */
export const MINUTES_PER_LONGITUDE_DEGREE = 4;

/** 暴露给调用方的分钟浮点保留位数（两语言一致：floor(x·10⁴+0.5)/10⁴）。 */
export const MINUTE_DECIMALS = 4;

/** 均时差公式系数（NOAA/Spencer 全式，逐项列出以便复核与漂移检测）。 */
export const EOT_FORMULA = Object.freeze({
  source: 'NOAA/Spencer 全式（Spencer 1971 傅里叶级数；NOAA 太阳能计算器口径；公知公开公式）',
  expression: 'EoT = 229.18·(0.000075 + 0.001868·cos γ − 0.032077·sin γ − 0.014615·cos 2γ − 0.040849·sin 2γ)',
  gammaExpression: 'γ = 2π·(N − 1) / 365',
  scaleMinutes: 229.18,
  offset: 1,
  denominator: 365,
  constantCoefficient: 0.000075,
  cosGammaCoefficient: 0.001868,
  sinGammaCoefficient: -0.032077,
  cos2GammaCoefficient: -0.014615,
  sin2GammaCoefficient: -0.040849,
  signConvention: '真太阳时 = 民用时 + 4·(经度 − 120) + EoT（EoT = 视太阳时 − 平太阳时）',
  superseded: 'EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)，B = 2π·(N−81)/364'
    + '（节149 方案②换式前口径；固有偏差上界 0.85 分钟，已废弃，仅留痕）',
});

/**
 * 权威锚点（对拍用；来源 NOAA EoT 公开数据与万年历常识的零点日）。
 * 字段：
 *   month / day    公历月日（锚值按**平年**日序给出）
 *   anchor         权威 EoT 值（分钟，「视太阳时 − 平太阳时」口径）
 *   maxDeviation   本内核对该锚点允许的偏差（= Spencer 全式的实测固有偏差上界，非放水值）
 *   observed       Spencer 全式在该日（平年）的实测偏差（分钟，单独列出便于审计）
 *   note           备注（含任务书原文与真值不一致处的裁决）
 */
export const EOT_ANCHORS = Object.freeze([
  Object.freeze({
    month: 2, day: 11, anchor: -14.2, maxDeviation: 0.3, observed: 0.0003,
    note: '一年中 EoT 最负附近（腊月）：Spencer 全式给 −14.1997，与锚值 −14.2 **逐位吻合**（偏差 0.0003）',
  }),
  Object.freeze({
    month: 5, day: 14, anchor: 3.7, maxDeviation: 0.3, observed: 0.2263,
    note: 'EoT 局部极大（月中最正）：真值与两式均为**正号**（Spencer 给 +3.9263）；'
      + '任务书原文写作「−3.7」，与同表另两个锚点（2/11 为负、11/3 为正）的符号口径自相矛盾，'
      + '经裁定按真值 **+3.7** 登记（原文负号视为笔误）',
  }),
  Object.freeze({
    month: 11, day: 3, anchor: 16.4, maxDeviation: 0.3, observed: 0.0347,
    note: '一年中 EoT 最正附近（冬初）：Spencer 全式给 +16.3653',
  }),
  Object.freeze({
    month: 4, day: 15, anchor: 0, maxDeviation: 0.3, observed: 0.2404,
    note: 'EoT 零点日①（春季过零）：Spencer 全式给 −0.2404（过零点落在 04-15→04-16 之间）',
  }),
  Object.freeze({
    month: 6, day: 13, anchor: 0, maxDeviation: 0.4, observed: 0.3923,
    note: 'EoT 零点日②（初夏过零）：Spencer 全式给 +0.3923 —— **换式后仍是全年最大偏差项（略超 ±0.3，0.3923）**，'
      + '属闭式级数极限；零点日按「过零点落在锚点日 ±2 天内」断言',
  }),
  Object.freeze({
    month: 9, day: 1, anchor: 0, maxDeviation: 0.4, observed: 0.3731,
    note: 'EoT 零点日③（秋初过零）：Spencer 全式给 −0.3731，略超 ±0.3（过零点落在 09-02→09-03 之间）',
  }),
  Object.freeze({
    month: 12, day: 25, anchor: 0, maxDeviation: 0.4, observed: 0.3076,
    note: 'EoT 零点日④（冬至后过零）：Spencer 全式给 +0.3076，略超 ±0.3（过零点落在 12-25→12-26 之间）',
  }),
]);

/**
 * 精度登记（诚实登记，供报告与测试断言引用；**不得**据此放水关键断言）。
 *
 * 结论（**换式后**）：Spencer 全式的固有偏差上界 0.3923 分钟；7 个锚点中 4 个
 * （2/11、4/15、5/14、11/3）达任务书 ±0.3 目标，3 个零点日（6/13、9/1、12/25）
 * 仍在 0.30–0.40 分钟区间——它们都是「EoT≈0 的零点日」，任何闭式级数的过零点都
 * 不精确落在该日，故这 3 项按「过零点落在锚点日 ±2 天内 + 偏差登记」断言。
 * 换式前（方案②未采纳时）：简化近似式偏差上界 0.85 分钟，超目标项为 2/11、9/1、12/25。
 */
export const EOT_ACCURACY = Object.freeze({
  formula: 'NOAA/Spencer 全式（节149 方案② 采纳；Spencer 1971 傅里叶级数）',
  formulaMaxDeviationMinutes: 0.4,
  worstAnchor: '6/13（偏差 0.3923 分钟）',
  taskTargetMinutes: 0.3,
  /** 达标锚点（月日，按月序排）。 */
  anchorsWithinTarget: Object.freeze(['2/11', '4/15', '5/14', '11/3']),
  /** 未达标锚点（月日，按月序排）——两侧测试对它做「现状断言」，改式才会变红。 */
  anchorsOutsideTarget: Object.freeze(['6/13', '9/1', '12/25']),
  /** 旧式留痕（已废弃；仅供审计与回归对照）。 */
  supersededFormula: 'EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)，B = 2π·(N−81)/364',
  supersededMaxDeviationMinutes: 0.85,
  supersededAnchorsOutsideTarget: Object.freeze(['2/11', '9/1', '12/25']),
  decision: '节149 方案②：换用 Spencer 全式（任务书原指定的简化近似式偏差上界 0.85 分钟，超 ±0.3 目标；'
    + '换式后降到 0.3923 分钟，2/11 逐位吻合）',
  note: '达标与否由两侧测试逐项断言并随报告上报，不静默放水；零点日按 ±2 天内过零断言。',
});

/* ===========================================================================
 * §2 中国夏令时官方年份表（1986–1991）
 * ===========================================================================
 * 来源：国务院 1986 年 4 月发布的夏令时公告及此后历年的国务院公告（公网可查的
 *       官方年份表；1986 年 5 月 4 日首次施行、1992 年起不再施行）。
 *
 * 口径（写死）：
 *   - **起止日均以「钟表」02:00 为界**（公告原文即「凌晨 2 时」）；
 *   - 起始日当日 02:00（含）起为夏令时 → 该日 00:00–01:59 仍是标准时；
 *   - 结束日当日 02:00 前为夏令时 → 该日 02:00（含）起回到标准时；
 *   - **1986 年为施行首年**：从「5 月第一个周日」开始（05-04），不是 4 月；
 *   - **1987–1991 年**：从「4 月中旬第一个周日」开始；结束日一律「9 月第一个周日」。
 *   - 夏令时钟表 = 北平标准时（UTC+8）+ 1 小时 = UTC+9。
 *
 * ⚠️ 歧义段（写死）：结束日 01:00–01:59 是**钟表重复出现**的一小时
 *   （夏令时的最后一小时与标准时的第一个小时同形），公告无法区分。本内核一律
 *   **按夏令时计**，并同时挂 `dst_ambiguous_hour` 不确定项，交由调用方询问用户。
 */

/** 官方年份表：12 个起止边界（逐年写死，不做「按周日推算」的算法化，避免与公告漂移）。 */
export const CHINA_DST_RANGES = Object.freeze([
  Object.freeze({ year: 1986, startMonth: 5, startDay: 4, endMonth: 9, endDay: 14, firstYear: true }),
  Object.freeze({ year: 1987, startMonth: 4, startDay: 12, endMonth: 9, endDay: 13, firstYear: false }),
  Object.freeze({ year: 1988, startMonth: 4, startDay: 10, endMonth: 9, endDay: 11, firstYear: false }),
  Object.freeze({ year: 1989, startMonth: 4, startDay: 16, endMonth: 9, endDay: 17, firstYear: false }),
  Object.freeze({ year: 1990, startMonth: 4, startDay: 15, endMonth: 9, endDay: 16, firstYear: false }),
  Object.freeze({ year: 1991, startMonth: 4, startDay: 14, endMonth: 9, endDay: 15, firstYear: false }),
]);

/** 夏令时规则表（口径文字 + 表 + 边界语义），供输出与审计引用。 */
export const CHINA_DST_RULES = Object.freeze({
  source: '国务院 1986 年 4 月公告及历年公告（官方年份表；1986 首年、1992 年起停用）',
  clockConvention: '起止日均以钟表 02:00 为界（公告原文「凌晨 2 时」）',
  startBoundary: '起始日当日 02:00（含）起为夏令时；该日 00:00–01:59 仍按标准时',
  endBoundary: '结束日当日 02:00 前（不含 02:00）为夏令时；该日 02:00（含）起按标准时',
  ambiguousWindow: '结束日 01:00–01:59（钟表重复出现的一小时）——本内核一律按夏令时计，并挂 dst_ambiguous_hour',
  firstYearRule: '1986 年（施行首年）：5 月第一个周日 02:00 起',
  otherYearsRule: '1987–1991 年：4 月中旬第一个周日 02:00 起',
  endRule: '结束日一律为 9 月第一个周日 02:00',
  offsets: '夏令时钟表 = 北平标准时（UTC+8）+ 1 小时 = UTC+9',
  ranges: CHINA_DST_RANGES,
});

/* ===========================================================================
 * §3 不确定项码与文案（**唯一权威位置**；Python 镜像逐字照抄并交叉验证）
 * ===========================================================================
 * 语义：不确定项描述「**输入的观测不确定性**」，与 `meta.degraded_methods`
 * （哪些法没跑出来）并列但语义不同，两个字段不许混用（节120 §结构反思）。
 */

/** 不确定项码 → 中文文案。 */
export const UNCERTAINTY_MESSAGES = Object.freeze({
  dst_ambiguous_hour:
    '出生时间落在夏令时结束日 01:00–01:59（钟表重复出现的一小时）：此时刻既可能是夏令时（UTC+9）也可能是标准时（UTC+8）；'
    + '本内核按夏令时计，请与出生记录核对。',
  true_solar_large_delta:
    '真太阳时总修正（均时差 + 经度差）绝对值 ≥ 20 分钟：校正量大，时辰判定对口径敏感，请核对经度与出生时间来源。',
  minute_unknown:
    '输入缺分钟（minute）：按 00 分计算，时辰判定可能整体偏移一个时辰。',
});

/** 「大修正」阈值：真太阳时总修正绝对值达到该值即挂 true_solar_large_delta（分钟）。 */
export const LARGE_TRUE_SOLAR_DELTA_MINUTES = 20;

/* ===========================================================================
 * §4 纯函数：闰年 / 日序 / 取整 / 均时差 / 夏令时查表
 * ===========================================================================
 * 这些函数是公式与表的**唯一执行入口**；capability 与 Python 镜像都按它们落法。
 */

/**
 * 闰年判定（自写，零依赖）：能被 4 整除，且（不被 100 整除或被 400 整除）。
 * @param {number} year 公历年
 * @returns {boolean} 是否闰年
 */
export function isLeapYear(year) {
  const y = Math.trunc(year);
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

/** 每月天数（平年）。 */
const MONTH_DAYS = Object.freeze([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

/**
 * 某年某月的天数（闰年 2 月 29 天）。
 * @param {number} year 公历年
 * @param {number} month 1–12
 * @returns {number} 天数
 */
export function daysInMonth(year, month) {
  const m = Math.trunc(month);
  if (m === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_DAYS[m - 1];
}

/**
 * 一年中第几天（N，1–366；1 月 1 日 = 1）。自写，闰年感知（1900 非闰、2000 闰）。
 * @param {number} year 公历年
 * @param {number} month 1–12
 * @param {number} day 1–31
 * @returns {number} N
 */
export function dayOfYear(year, month, day) {
  let n = Math.trunc(day);
  for (let m = 1; m < Math.trunc(month); m += 1) n += daysInMonth(year, m);
  return n;
}

/**
 * 分钟浮点取整到 MINUTE_DECIMALS 位：floor(x·10⁴+0.5)/10⁴。
 * 为什么用 floor 而不是各语言的 round：JS `Math.round` 与 Python `round`（银行家进位）
 * 在 .5 处语义不同，会让两语言输出产生 1e-4 级差异；floor(x+0.5) 两语言语义完全一致。
 *
 * @param {number} value 分钟值
 * @returns {number} 保留 4 位小数的浮点（-0 归一为 0）
 */
export function roundMinutes(value) {
  const r = Math.floor(value * 10 ** MINUTE_DECIMALS + 0.5) / 10 ** MINUTE_DECIMALS;
  return r === 0 ? 0 : r;
}

/**
 * 均时差（分钟，未取整）：NOAA/Spencer 全式（节149 方案②）。
 * 逐项相加后再乘 229.18，加/减项顺序与 Python 镜像逐字一致（浮点可复现）。
 *
 * @param {number} n 一年中第几天（1–366）
 * @returns {number} EoT（视太阳时 − 平太阳时）
 */
export function equationOfTimeMinutes(n) {
  const gamma = (2 * Math.PI * (n - EOT_FORMULA.offset)) / EOT_FORMULA.denominator;
  return EOT_FORMULA.scaleMinutes * (
    EOT_FORMULA.constantCoefficient
    + EOT_FORMULA.cosGammaCoefficient * Math.cos(gamma)
    + EOT_FORMULA.sinGammaCoefficient * Math.sin(gamma)
    + EOT_FORMULA.cos2GammaCoefficient * Math.cos(2 * gamma)
    + EOT_FORMULA.sin2GammaCoefficient * Math.sin(2 * gamma)
  );
}

/**
 * 取某年的夏令时区间（不在 1986–1991 则返回 null）。
 * @param {number} year 公历年
 * @returns {Readonly<object>|null} 区间表项
 */
export function chinaDstRangeForYear(year) {
  const y = Math.trunc(year);
  return CHINA_DST_RANGES.find((range) => range.year === y) ?? null;
}

/**
 * 月份日 → 可比较的序号（MMDD 整数），用于区间比较。
 * @param {number} month 1–12
 * @param {number} day 1–31
 * @returns {number} month*100+day
 */
export function monthDayKey(month, day) {
  return Math.trunc(month) * 100 + Math.trunc(day);
}

/** 数字补零（规则文案格式化用；两语言一致）。 */
export function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}

/**
 * 夏令时规则文案（唯一格式化位置，两语言逐字一致）。
 * @param {Readonly<object>|null} range 命中区间（null = 不在施行年份）
 * @param {number} year 公历年
 * @returns {string} 规则说明
 */
export function chinaDstRuleText(range, year) {
  if (!range) {
    return `不在中国官方夏令时施行年份（1986–1991）：${Math.trunc(year)} 年无夏令时（1992 年起停用）`;
  }
  const window = `${pad2(range.startMonth)}-${pad2(range.startDay)} 02:00 起 → `
    + `${pad2(range.endMonth)}-${pad2(range.endDay)} 02:00 止`;
  const startRule = range.firstYear ? CHINA_DST_RULES.firstYearRule : CHINA_DST_RULES.otherYearsRule;
  return `${Math.trunc(year)} 年夏令时：${window}（${startRule}；${CHINA_DST_RULES.endRule}；钟表 UTC+9）`;
}
