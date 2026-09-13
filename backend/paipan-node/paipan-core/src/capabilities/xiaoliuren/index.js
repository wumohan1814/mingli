/**
 * 命理 · 自研排盘内核 · 能力：小六壬（时间起课）
 * ---------------------------------------------------------------------------
 * 导出 `generateXiaoliurenCore(params)` —— 与旧实现 `generateXiaoliuren(params)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状）。
 *
 * 四段纯函数管线（见 README §1）：
 *   ① 输入归一化 normalizeInput   —— 只认确定性输入；缺输入一律抛错，绝不回落「当前时间」
 *   ② 历法/起局  resolveCalendar + computePalaces —— lunar-typescript + 纯函数取模
 *   ③ 格局判定   此处即「三宫推算」（小六壬无格局判定段，宫名即结论）
 *   ④ 输出装配   assemble
 * 四段之间只传普通对象，**禁止** IO / LLM / 格式化 / 网络 / 随机数。
 *
 * == 对拍实测确认的历法约定（黑盒探针，见 README §3 与本文件注释）==
 *   1. 年干支 = **立春「精确时刻」换年**（lunar-typescript `getYearInGanZhiExact()`）。
 *      实测：1990-01-27 是正月初一但在立春前，旧实现给「己巳」= Exact 值（正月初一换年
 *      会给「庚午」）；2000-02-04 立春在 20:40，20:30 给「己卯」、20:41 给「庚辰」，
 *      Exact 的分界成立，而「以立春当天为界」的 ByLiChun 在 20:30 就已给「庚辰」。
 *   2. 月干支 = **节气精确时刻换月**（`getMonthInGanZhiExact()`）。实测 2000-02-04 12:00
 *      给「丁丑」= Exact（按日界换月会给「戊寅」）。
 *   3. 日干支 = **晚子时 23:00 起换日**（`getDayInGanZhiExact()`）。实测 1990-05-12 23:00
 *      给「戊寅」= Exact（`getDayInGanZhi()` 与 `…Exact2` 都给「丁丑」）。
 *   4. lunarMonth / lunarDay = **东八区民用日零点换日**，晚子时不进日。
 *      实测 2000-02-05 23:40（正月初一）仍给 lunarDay=1。
 *   5. hourIndex 表：0=早子时(00:00–00:59)、1–11=丑…亥、**12=晚子时(23:00–23:59)**；
 *      晚子时的起课时辰数按「子=1」计。实测 1990-05-12 23:00 → hourIndex 12、
 *      hourLabel「晚子时」、calculation.hourNumber 1。
 *   6. 时干支 = **五鼠遁**（日干取第 3 条的日干支之干，子时干见下表，顺推 hourIndex%12 步）。
 *      实测 12 例与旧实现 100% 一致，也与 lunar-typescript `getTimeInGanZhi()` 一致；
 *      本内核**自实现**五鼠遁，不复用库的时干支（少一层隐式依赖）。
 *   7. 闰月：lunar-typescript `getMonth()` 为负即闰月；月序取绝对值，月宫仍用同名月序。
 *
 * == 与旧实现的有意分歧（已在 README §3 登记）==
 *   - 缺 `customDate` 时旧实现**静默回落到「当前时间」**（实测 `{}`、`undefined`、
 *     `{month,day,hour}` 三种输入输出完全相同，且等于探针运行时刻）。本内核一律抛错。
 *   - `{month,day,hour}` 数字起课模式：旧实现**接受但完全忽略**这三个数字。本内核
 *     不做无法对拍的猜测，抛 PaipanInputError（server.mjs 永远传 customDate）。
 *   - `customDate` 传 ISO 字符串时旧实现抛「自定义时间不是有效日期。」；本内核按内核
 *     契约接受 ISO 字符串（Date 与字符串同义），属**放宽**而非放宽结果。
 */

import { Solar } from 'lunar-typescript';
import {
  XIAOLIUREN_RULES,
  XI_PALACE_COUNT,
  xiHourIndex,
  xiHourLabel,
  xiHourNumber,
  xiPalace,
} from '../../rules/xiaoliuren.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta.engineVersion —— 自研内核版本（与旧实现的 0.2.2 有意不同，属信息性差异）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致（换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** 东八区偏移（分钟）。全内核唯一处定义时区口径。 */
const CST_OFFSET_MINUTES = 480;

/** 时干支五鼠遁表：日干 → 子时干（甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子是真途）。 */
const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲',
  乙: '丙', 庚: '丙',
  丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚',
  戊: '壬', 癸: '壬',
});

const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/**
 * 内核输入错误（缺输入 / 输入形态不支持 / 非法日期）。调用方据此返回 400，不得回落默认值。
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

/** 取模（保证非负）。 */
function mod(n, m) {
  return ((Math.trunc(n) % m) + m) % m;
}

/** 数字补零。 */
function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}

/**
 * 把任意受支持的输入换算成「东八区民用挂钟时刻」。
 * 不依赖进程本地时区：一律先求绝对时刻（epoch ms），再按 +08:00 取挂钟字段。
 *
 * @param {Date|string|number} value customDate
 * @returns {{instantMs: number, wall: {year:number, month:number, day:number, hour:number, minute:number, second:number}, isoOffset8: string}}
 */
function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) {
    instantMs = value.getTime();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    instantMs = value;
  } else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析（支持 ISO 8601 或 Date）: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    // 显式范围校验：不接受 13 月 / 45 日 / 99 时这类会被 Date.UTC 静默「进位」的非法挂钟时间
    const ranges = [[parts.month, 1, 12, '月'], [parts.day, 1, 31, '日'], [parts.hour, 0, 23, '时'], [parts.minute, 0, 59, '分'], [parts.second, 0, 59, '秒']];
    for (const [value, lo, hi, label] of ranges) {
      if (!Number.isInteger(value) || value < lo || value > hi) {
        throw new PaipanInputError('invalid_custom_date', `customDate 的${label}超出范围（${lo}-${hi}）: ${value}`);
      }
    }
    let offsetMinutes = CST_OFFSET_MINUTES;
    if (tz === 'Z') offsetMinutes = 0;
    else if (tz) {
      const sign = tz[0] === '-' ? -1 : 1;
      const body = tz.slice(1).replace(':', '');
      offsetMinutes = sign * (Number(body.slice(0, 2)) * 60 + Number(body.slice(2, 4)));
    }
    instantMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - offsetMinutes * 60000;
    // 回读校验：Date.UTC 会把越界字段静默进位（如 1990-02-30 → 03-02），这里一律拒绝
    const check = new Date(instantMs + offsetMinutes * 60000);
    const roundTrip = { year: check.getUTCFullYear(), month: check.getUTCMonth() + 1, day: check.getUTCDate(), hour: check.getUTCHours(), minute: check.getUTCMinutes(), second: check.getUTCSeconds() };
    for (const key of ['year', 'month', 'day', 'hour', 'minute', 'second']) {
      if (roundTrip[key] !== parts[key]) {
        throw new PaipanInputError('invalid_custom_date', `customDate 不是真实存在的时刻（${key} 被进位为 ${roundTrip[key]}）: ${value}`);
      }
    }
  } else {
    throw new PaipanInputError('invalid_custom_date', `customDate 类型不支持（需 Date 或 ISO 字符串）: ${typeof value}`);
  }
  if (!Number.isFinite(instantMs)) {
    throw new PaipanInputError('invalid_custom_date', 'customDate 不是有效日期（Invalid Date / NaN）。');
  }
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  const wall = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
  const isoOffset8 = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}+08:00`;
  return { instantMs, wall, isoOffset8 };
}

/**
 * ① 输入归一化。
 * 支持且**仅**支持 `{ customDate }`：customDate ∈ Date | ISO 字符串 | epoch 毫秒数。
 * 归一化结果（进哈希的全量输入，绝不含 now / 随机量）。
 *
 * @param {object|undefined|null} params 调用参数
 * @returns {{mode: 'date', wall: object, instantMs: number, isoOffset8: string, hashInput: object}}
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError(
      'missing_custom_date',
      '小六壬起课必须传 customDate（Date 或 ISO 字符串）；本内核不接受缺省时间，也不会回落「当前时间」。'
      + '（旧实现在缺 customDate 时静默使用「当前时间」，对拍实测已确认，属已知缺陷，本内核不沿用。）',
    );
  }
  const { customDate } = params;
  if (customDate === undefined || customDate === null) {
    const numericMode = ['month', 'day', 'hour'].every((k) => typeof params[k] === 'number');
    if (numericMode) {
      throw new PaipanInputError(
        'numeric_mode_unsupported',
        '数字起课模式 {month,day,hour} 不受支持：旧实现会接受这三个数字但**完全忽略**它们并回落「当前时间」'
        + '（黑盒实测确认），因此该模式无法对拍、也无法保证确定性。请改传 customDate。',
      );
    }
    throw new PaipanInputError(
      'missing_custom_date',
      '小六壬起课必须传 customDate（Date 或 ISO 字符串）；不接受 month/day/hour 缺省，也不会回落「当前时间」。',
    );
  }
  const { instantMs, wall, isoOffset8 } = toCstWallClock(customDate);
  return {
    mode: 'date',
    wall,
    instantMs,
    isoOffset8,
    hashInput: { capability: 'xiaoliuren', mode: 'date', wall: isoOffset8 },
  };
}

/**
 * ② 历法换算（本内核唯一使用 lunar-typescript 的地方）。
 * 全部按 +08:00 挂钟时刻取历法，故与进程本地时区无关。
 *
 * @param {{wall: object}} normalized ①的输出
 * @returns {{lunarMonth:number, lunarDay:number, isLeapMonth:boolean, yearGanZhi:string, monthGanZhi:string, dayGanZhi:string}}
 */
export function resolveCalendar(normalized) {
  const { wall } = normalized;
  const lunar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunar();
  const rawMonth = lunar.getMonth();
  return {
    lunarMonth: Math.abs(rawMonth),
    lunarDay: lunar.getDay(),
    isLeapMonth: rawMonth < 0,
    // 年：立春精确时刻换年（对拍实测 = getYearInGanZhiExact）
    yearGanZhi: lunar.getYearInGanZhiExact(),
    // 月：节气精确时刻换月（对拍实测 = getMonthInGanZhiExact）
    monthGanZhi: lunar.getMonthInGanZhiExact(),
    // 日：晚子时 23:00 起换日（对拍实测 = getDayInGanZhiExact）
    dayGanZhi: lunar.getDayInGanZhiExact(),
  };
}

/**
 * 五鼠遁：由日干与时辰序推时干支（自实现，见文件头约定 6）。
 *
 * @param {string} dayGanZhi 日干支（如「丁丑」）
 * @param {number} hourIndex 0–12
 * @returns {string} 时干支（如「甲辰」）
 */
export function ganZhiFromDay(dayGanZhi, hourIndex) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  if (!startGan) throw new PaipanInputError('bad_day_ganzhi', `日干支无法解析: ${dayGanZhi}`);
  const step = mod(hourIndex, 12);
  return GAN[(GAN.indexOf(startGan) + step) % 10] + XIAOLIUREN_RULES.hourLabels[step];
}

/**
 * ③ 三宫推算（纯取模，规则文本见 rules/xiaoliuren.js 的 XIAOLIUREN_FORMULAS）。
 *
 * @param {{lunarMonth:number, lunarDay:number, hourIndex:number}} input
 * @returns {{lunarMonth:number, lunarDay:number, hourNumber:number, monthSeed:number, daySeed:number,
 *   hourSeed:number, monthPalaceIndex:number, dayPalaceIndex:number, hourPalaceIndex:number}}
 */
export function computePalaces({ lunarMonth, lunarDay, hourIndex }) {
  const hourNumber = xiHourNumber(hourIndex);
  const monthPalaceIndex = mod(lunarMonth - 1, XI_PALACE_COUNT);
  const dayPalaceIndex = mod(monthPalaceIndex + lunarDay - 1, XI_PALACE_COUNT);
  const hourPalaceIndex = mod(dayPalaceIndex + hourNumber - 1, XI_PALACE_COUNT);
  return {
    lunarMonth,
    lunarDay,
    hourNumber,
    monthSeed: lunarMonth,
    daySeed: lunarMonth + lunarDay - 1,
    hourSeed: lunarMonth + lunarDay + hourNumber - 2,
    monthPalaceIndex,
    dayPalaceIndex,
    hourPalaceIndex,
  };
}

/**
 * ④ 输出装配（形状与旧实现 stripInternal 后逐键对齐；**不**输出 timestamp / evidenceAnalysis 等内部字段）。
 *
 * @param {{normalized:object, calendar:object, palaces:object, now:Date}} parts
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, calendar, palaces, now }) {
  const { lunarMonth, lunarDay, isLeapMonth, yearGanZhi, monthGanZhi, dayGanZhi } = calendar;
  const hIdx = normalized.hourIndex;
  const sequenceMonth = xiPalace(palaces.monthPalaceIndex);
  const sequenceDay = xiPalace(palaces.dayPalaceIndex);
  const sequenceHour = xiPalace(palaces.hourPalaceIndex);
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  return {
    method: 'time',
    methodLabel: '时间起课',
    lunarMonth,
    lunarDay,
    isLeapMonth,
    hourIndex: hIdx,
    hourLabel: xiHourLabel(hIdx),
    ganzhi: {
      year: yearGanZhi,
      month: monthGanZhi,
      day: dayGanZhi,
      hour: ganZhiFromDay(dayGanZhi, hIdx),
    },
    calculation: {
      lunarMonth: palaces.lunarMonth,
      lunarDay: palaces.lunarDay,
      hourNumber: palaces.hourNumber,
      monthSeed: palaces.monthSeed,
      daySeed: palaces.daySeed,
      hourSeed: palaces.hourSeed,
      monthPalaceIndex: palaces.monthPalaceIndex,
      dayPalaceIndex: palaces.dayPalaceIndex,
      hourPalaceIndex: palaces.hourPalaceIndex,
      dayBoundary: XIAOLIUREN_RULES.dayBoundary,
      leapMonthRule: XIAOLIUREN_RULES.leapMonthRule,
    },
    sequence: {
      month: { name: sequenceMonth.name, index: sequenceMonth.index, verse: sequenceMonth.verse },
      day: { name: sequenceDay.name, index: sequenceDay.index, verse: sequenceDay.verse },
      hour: { name: sequenceHour.name, index: sequenceHour.index, verse: sequenceHour.verse },
    },
    palaceOrder: XIAOLIUREN_RULES.palaces.map((p) => ({ name: p.name, index: p.index, verse: p.verse })),
    primary: { name: sequenceHour.name, index: sequenceHour.index, verse: sequenceHour.verse },
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'xiaoliuren',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `xiaoliuren:${inputHash}`,
    },
  };
}

/**
 * 小六壬时间起课（自研内核）。
 *
 * @param {object} params `{ customDate: Date|string|number, now?: Date }`
 *   - `customDate`：**必填**。Date、ISO 8601 字符串或 epoch 毫秒数。
 *   - `now`：可选，仅用于 `meta.calculatedAt`（便于测试取固定值）；不参与任何排盘结果与哈希。
 * @returns {object} 生产契约形状的排盘结果
 * @throws {PaipanInputError} 缺 customDate / 输入形态不支持 / 非法日期
 */
export function generateXiaoliurenCore(params) {
  const normalized = normalizeInput(params);                    // ① 输入归一化
  const calendar = resolveCalendar(normalized);                 // ② 历法
  const hourIndex = xiHourIndex(normalized.wall.hour);           // ② 起局（时辰序）
  const palaces = computePalaces({                               // ③ 三宫推算
    lunarMonth: calendar.lunarMonth,
    lunarDay: calendar.lunarDay,
    hourIndex,
  });
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({                                              // ④ 输出装配
    normalized: { ...normalized, hourIndex },
    calendar,
    palaces,
    now,
  });
}

export default generateXiaoliurenCore;
