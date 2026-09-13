/**
 * 命理 · 自研排盘内核 · 能力：真太阳时 + 中国夏令时 + 出生时间校正链（节149）
 * ---------------------------------------------------------------------------
 * 导出三个纯函数（与 `backend/app/paipan/birthtime.py` 的 Python 镜像同算法同表）：
 *   - `calculateTrueSolarTime({year,month,day,hour,minute,longitude})` —— 民用时 → 真太阳时
 *   - `getChinaDst({year,month,day,hour,minute})`                    —— 官方夏令时判定（1986–1991）
 *   - `correctBirthTime({...,applyTrueSolar,applyDst})`               —— 校正链装配（+ 不确定项）
 *
 * 规则只有**一个权威位置**：`src/rules/true-solar-time.js`（公式系数、夏令时年份表、
 * 边界口径、文案全在那里，`Object.freeze`）。本文件**不抄任何系数/日期/文案**。
 *
 * 四段纯函数管线（照 README §1 与 capabilities/xiaoliuren 的写法，顺序固定）：
 *   ① 输入归一化 normalizeInput   —— 校验年月日时分；缺 minute 归零并**标记**（不静默）；
 *                                    缺经度在需要时**抛错**（绝不回落默认经度）
 *   ② 历法/起局  resolveDayOfYear —— 本能力无历法换算，②段即「日序 N」（闰年感知，自写）
 *   ③ 校正判定   computeDstDelta + computeTrueSolarDelta —— 纯查表 + 纯公式
 *   ④ 输出装配   assemble         —— 顺次应用（DST −60 分钟 → 真太阳时）并按契约拼装
 * 四段之间只传普通对象；**禁止** IO / LLM / 格式化 / 网络 / 随机数 / 当前时间。
 *
 * == 校正链口径（写死，节149 交付契约）==
 *   1. 顺序：**先夏令时（−60 分钟），再真太阳时（EoT + 经度差）**，最后一次性施加位移。
 *   2. 位移施加口径：总位移 = dstDelta + floor(真太阳时总修正 + 0.5)（分钟，四舍五入半值向上）；
 *      再按分钟数整体位移，**可跨日/跨月/跨年**（闰年与大小月均按 §4 表处理）。
 *   3. EoT 的日序 N 取**输入民用日**（未校正日期）——EoT 是「日期级」量，DST 位移带来的
 *      ±1 日差异（约 0.02 分钟）不改变结论；此选择写死，保证两语言一致。
 *   4. `calculateTrueSolarTime` 的 eotMinutes / longitudeDeltaMinutes / totalDeltaMinutes
 *      为浮点（保留 4 位小数，`floor(x·10⁴+0.5)/10⁴`，两语言语义一致）；hour/minute 已按
 *      `floor(totalDelta+0.5)` 取整后位移。
 *
 * == 不确定项（与 `meta.degraded_methods` 语义不同，不许混用；节120 §结构反思）==
 *   - `dst_ambiguous_hour`：输入落在夏令时**结束日 01:00–01:59**（钟表重复出现的一小时）。
 *     该不确定项描述**输入本身的歧义**，故**与 `applyDst` 开关无关**，一律上报。
 *   - `true_solar_large_delta`：真太阳时总修正 |EoT + 经度差| ≥ 20 分钟（仅在校正实际施加时）。
 *   - `minute_unknown`：输入缺 minute（按 00 分计算）。
 *   顺序固定为：dst_ambiguous_hour → true_solar_large_delta → minute_unknown。
 *
 * == 已知限制（诚实登记，不在本节能改）==
 *   夏令时**起始日 02:00–02:59** 在钟表上是「被跳过的一小时」（不存在该钟表时刻）。
 *   公告只有「凌晨 2 时起施行」一句，本内核不臆造 `dst_skipped_hour` 不确定项
 *   （不确定项码为交付契约的闭集）；如调用方要覆盖该情形，须先扩契约。
 *   另：官方年份表只覆盖 1986–1991（1992 年起中国不再施行夏令时），表外年份一律按标准时。
 */

import {
  LARGE_TRUE_SOLAR_DELTA_MINUTES,
  LSTM_DEGREES,
  MINUTES_PER_LONGITUDE_DEGREE,
  UNCERTAINTY_MESSAGES,
  chinaDstRangeForYear,
  chinaDstRuleText,
  dayOfYear,
  daysInMonth,
  equationOfTimeMinutes,
  monthDayKey,
  roundMinutes,
} from '../../rules/true-solar-time.js';

/**
 * 内核输入错误（缺经度 / 非法日期时刻）。调用方据此返回 400，不得回落默认值。
 * 与 capabilities/xiaoliuren 的同类错误同名同形（各能力自持一份，不互相依赖）。
 */
export class PaipanInputError extends Error {
  /**
   * @param {string} code 机器可读错误码
   * @param {string} message 中文错误信息
   */
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/** 一天 1440 分钟（本文件唯一处定义）。 */
const MINUTES_PER_DAY = 1440;

/** 夏令时位移：−60 分钟（钟表 UTC+9 → 标准时 UTC+8）。 */
const DST_OFFSET_MINUTES = -60;

/** 起止日界：钟表 02:00 = 当日第 120 分钟。 */
const DST_BOUNDARY_MINUTE_OF_DAY = 120;

/**
 * ① 输入归一化：校验并返回确定性中间对象（只含普通数值）。
 *
 * @param {object} params `{year,month,day,hour,minute}`（minute 允许缺失 → 按 0 计并标记）
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,minuteKnown:boolean}}
 * @throws {PaipanInputError} `invalid_datetime`：字段缺失/非整数/越界（含该月不存在的日期）
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('invalid_datetime', '出生时间校正必须传 {year,month,day,hour,minute} 对象。');
  }
  const { year, month, day, hour, minute } = params;
  const intFields = [
    ['year', year, 1, 9999],
    ['month', month, 1, 12],
    ['day', day, 1, 31],
    ['hour', hour, 0, 23],
  ];
  for (const [name, value, lo, hi] of intFields) {
    if (!Number.isInteger(value) || value < lo || value > hi) {
      throw new PaipanInputError('invalid_datetime',
        `出生时间字段 ${name} 非法（需 ${lo}-${hi} 的整数）: ${String(value)}`);
    }
  }
  if (day > daysInMonth(year, month)) {
    throw new PaipanInputError('invalid_datetime',
      `出生时间日期不存在：${year}-${month}-${day}（该年该月只有 ${daysInMonth(year, month)} 天）`);
  }
  const minuteKnown = minute !== null && minute !== undefined;
  const minuteValue = minuteKnown ? minute : 0;
  if (!Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59) {
    throw new PaipanInputError('invalid_datetime',
      `出生时间字段 minute 非法（需 0-59 的整数）: ${String(minute)}`);
  }
  return { year, month, day, hour, minute: minuteValue, minuteKnown };
}

/**
 * 经度校验（缺经度一律抛错：内核不猜经度，也不用 120°E 顶替）。
 *
 * @param {unknown} longitude 经度（度，东经为正）
 * @returns {number} 校验通过的经度
 * @throws {PaipanInputError} `longitude_required` / `longitude_out_of_range`
 */
function requireLongitude(longitude) {
  if (longitude === null || longitude === undefined || typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    throw new PaipanInputError('longitude_required',
      '真太阳时校正必须传 longitude（经度，度）：缺经度时不得回落中央经线 120°E 或任何默认值。');
  }
  if (longitude < -180 || longitude > 180) {
    throw new PaipanInputError('longitude_out_of_range', `经度超出 [-180,180]: ${longitude}`);
  }
  return longitude;
}

/**
 * ② 历法/起局：本能力无历法换算（不依赖 lunar-typescript），②段即**日序 N**。
 * 口径：日序按公历除夕计（1 月 1 日 = 1），闰年 2 月 29 计入；均时差按 NOAA/Spencer 全式
 * （γ = 2π(N−1)/365，分母 365）计算，系数只在 rules/true-solar-time.js 里定义一次。
 *
 * @param {{year:number,month:number,day:number}} normalized ①的输出
 * @returns {{dayOfYear:number, equationOfTimeMinutes:number}} 日序与未取整 EoT
 */
export function resolveDayOfYear(normalized) {
  const n = dayOfYear(normalized.year, normalized.month, normalized.day);
  return { dayOfYear: n, equationOfTimeMinutes: equationOfTimeMinutes(n) };
}

/**
 * ③ 校正判定（夏令时）：官方年份表查表 + 02:00 边界判定。
 *
 * 边界口径（写死，见 rules 的 CHINA_DST_RULES）：
 *   - 起始日：当日 02:00（含）起为夏令时 → 01:59 及以前仍是标准时；
 *   - 结束日：当日 02:00 前（不含）为夏令时 → 01:59 仍按夏令时计（歧义段，见 correctBirthTime）；
 *   - 区间内其余日期整日为夏令时；表外年份一律标准时。
 *
 * @param {object} params `{year,month,day,hour,minute}`（minute 缺失按 0 计）
 * @returns {{isDst:boolean, rule:string}} 判定结果与规则说明
 * @throws {PaipanInputError} 输入非法（同 ①）
 */
export function getChinaDst(params) {
  const dt = normalizeInput(params);
  const range = chinaDstRangeForYear(dt.year);
  const ruleBase = chinaDstRuleText(range, dt.year);
  if (!range) {
    return { isDst: false, rule: `${ruleBase}；按标准时（UTC+8）计` };
  }
  const key = monthDayKey(dt.month, dt.day);
  const startKey = monthDayKey(range.startMonth, range.startDay);
  const endKey = monthDayKey(range.endMonth, range.endDay);
  const minuteOfDay = dt.hour * 60 + dt.minute;
  let isDst;
  if (key < startKey || key > endKey) {
    isDst = false;
  } else if (key === startKey) {
    isDst = minuteOfDay >= DST_BOUNDARY_MINUTE_OF_DAY;
  } else if (key === endKey) {
    isDst = minuteOfDay < DST_BOUNDARY_MINUTE_OF_DAY;
  } else {
    isDst = true;
  }
  return { isDst, rule: `${ruleBase}；按${isDst ? '夏令时（UTC+9）' : '标准时（UTC+8）'}计` };
}

/**
 * 夏令时歧义段判定：结束日 01:00–01:59（钟表重复出现的一小时）。
 *
 * @param {{year:number,month:number,day:number,hour:number}} dt ①的输出
 * @returns {boolean} 是否落在歧义段
 */
function isDstAmbiguousHour(dt) {
  const range = chinaDstRangeForYear(dt.year);
  if (!range) return false;
  const sameDay = monthDayKey(dt.month, dt.day) === monthDayKey(range.endMonth, range.endDay);
  return sameDay && dt.hour === 1;
}

/** 按整数分钟整体位移日期时刻（可跨日/跨月/跨年；纯整数运算，两语言一致）。 */
function shiftByMinutes(dt, deltaMinutes) {
  const total = dt.hour * 60 + dt.minute + deltaMinutes;
  const dayShift = Math.floor(total / MINUTES_PER_DAY);
  const rem = total - dayShift * MINUTES_PER_DAY;
  let { year, month, day } = dt;
  for (let i = 0; i < Math.abs(dayShift); i += 1) {
    if (dayShift > 0) {
      day += 1;
      if (day > daysInMonth(year, month)) {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    } else {
      day -= 1;
      if (day < 1) {
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        day = daysInMonth(year, month);
      }
    }
  }
  return { year, month, day, hour: Math.floor(rem / 60), minute: rem % 60 };
}

/**
 * 真太阳时：民用时 + 4·(经度 − 120) + EoT。
 * 符号约定与公式见 rules/true-solar-time.js §1（本文件不复写系数）。
 *
 * @param {object} params `{year,month,day,hour,minute,longitude}`（minute 缺失按 0 计）
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,
 *   eotMinutes:number,longitudeDeltaMinutes:number,totalDeltaMinutes:number}}
 * @throws {PaipanInputError} `longitude_required`（缺经度）/ `longitude_out_of_range` / `invalid_datetime`
 */
export function calculateTrueSolarTime(params) {
  const dt = normalizeInput(params);
  const longitude = requireLongitude(params.longitude);   // normalizeInput 已保证 params 是普通对象
  const resolved = resolveDayOfYear(dt);
  const eot = roundMinutes(resolved.equationOfTimeMinutes);
  const longitudeDelta = roundMinutes((longitude - LSTM_DEGREES) * MINUTES_PER_LONGITUDE_DEGREE);
  const totalDelta = roundMinutes(eot + longitudeDelta);
  const shifted = shiftByMinutes(dt, Math.floor(totalDelta + 0.5));
  return {
    year: shifted.year,
    month: shifted.month,
    day: shifted.day,
    hour: shifted.hour,
    minute: shifted.minute,
    eotMinutes: eot,
    longitudeDeltaMinutes: longitudeDelta,
    totalDeltaMinutes: totalDelta,
  };
}

/**
 * ④ 出生时间校正链装配：先夏令时（−60 分钟）→ 再真太阳时（EoT + 经度差），一次施加位移，
 * 并输出**校正明细**与**不确定项清单**（两者语义不同：明细=做了什么，不确定项=输入有多不确定）。
 *
 * @param {object} params `{year,month,day,hour,minute,longitude,applyTrueSolar,applyDst}`
 *   - `minute` 允许缺失（按 0 计，并挂 `minute_unknown`）
 *   - `longitude` 在 `applyTrueSolar !== false` 时**必填**（缺则抛错）
 *   - `applyTrueSolar` / `applyDst` 缺省均为 `true`（与 Python 镜像默认值一致）
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,
 *   applied:{eot:boolean,longitude:boolean,dst:boolean}, deltaMinutes:number,
 *   uncertainties:Array<{code:string,message:string}>}}
 * @throws {PaipanInputError} 缺经度（`longitude_required`）/ 输入非法（`invalid_datetime`）
 */
export function correctBirthTime(params) {
  const dt = normalizeInput(params);                                       // ① 输入归一化
  const applyTrueSolar = params.applyTrueSolar === undefined ? true : Boolean(params.applyTrueSolar);
  const applyDst = params.applyDst === undefined ? true : Boolean(params.applyDst);

  const uncertainties = [];
  // ① dst 歧义段（输入本身的歧义，与 applyDst 开关无关）
  if (isDstAmbiguousHour(dt)) {
    uncertainties.push({ code: 'dst_ambiguous_hour', message: UNCERTAINTY_MESSAGES.dst_ambiguous_hour });
  }

  const dstResult = getChinaDst(dt);                                       // ③ 夏令时判定
  const dstApplied = applyDst && dstResult.isDst;

  let trueSolarDelta = 0;
  if (applyTrueSolar) {
    const resolved = resolveDayOfYear(dt);                                 // ② 日序 + EoT
    const longitude = requireLongitude(params.longitude);
    const eot = roundMinutes(resolved.equationOfTimeMinutes);
    const longitudeDelta = roundMinutes((longitude - LSTM_DEGREES) * MINUTES_PER_LONGITUDE_DEGREE);
    const total = roundMinutes(eot + longitudeDelta);                      // ③ 真太阳时总修正
    trueSolarDelta = Math.floor(total + 0.5);
    // ② 大修正（真太阳时总修正绝对值 ≥ 20 分钟）
    if (Math.abs(total) >= LARGE_TRUE_SOLAR_DELTA_MINUTES) {
      uncertainties.push({ code: 'true_solar_large_delta', message: UNCERTAINTY_MESSAGES.true_solar_large_delta });
    }
  }
  // ③ 缺分钟
  if (!dt.minuteKnown) {
    uncertainties.push({ code: 'minute_unknown', message: UNCERTAINTY_MESSAGES.minute_unknown });
  }

  const deltaMinutes = (dstApplied ? DST_OFFSET_MINUTES : 0) + trueSolarDelta;  // ④ 装配
  const shifted = shiftByMinutes(dt, deltaMinutes);
  return {
    year: shifted.year,
    month: shifted.month,
    day: shifted.day,
    hour: shifted.hour,
    minute: shifted.minute,
    applied: { eot: applyTrueSolar, longitude: applyTrueSolar, dst: dstApplied },
    deltaMinutes,
    uncertainties,
  };
}

export default correctBirthTime;
