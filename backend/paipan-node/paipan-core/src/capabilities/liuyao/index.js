/**
 * 命理 · 自研排盘内核 · 能力：六爻（liuyao）
 * ===========================================================================
 * 导出 `generateLiuyaoCore(params)` —— 与旧实现 `generateLiuyao(customDate, options)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状），键序与旧实现一致。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 normalizeInput   —— 只认确定性输入；缺 customDate 一律抛错，绝不回落「当前时间」
 *   ② 历法/起卦  resolveCalendar + castHexagram —— lunar-typescript + 起卦规则
 *   ③ 装卦/格局判定 installHexagram —— 纯查表：纳甲/六亲/六神/世应/旺衰/十二宫/空亡/变爻…
 *   ④ 输出装配   assemble
 * 段间只传普通 JSON 对象；**零 IO / 零 LLM / 零随机 / 零时钟参与结果**。
 *
 * == 对拍实测确认的口径（黑盒探针，证据见 rules/liuyao.js 文件头）==
 *   1. 四柱：年=立春精确时刻换年、月=节气精确时刻换月、日=**晚子时 23:00 起换日**
 *      （`getYearInGanZhiExact` / `getMonthInGanZhiExact` / `getDayInGanZhiExact`），
 *      时干=五鼠遁。实测与旧实现 11 例 100% 一致（`tools/_probe/probe-ganzhi-compare.mjs`）。
 *   2. 装卦字段全部由「六爻阴阳 + 四柱」确定性推出，逐条口径见 rules/liuyao.js 的来源标注。
 *   3. 起卦三式（与旧实现同名同义）：
 *      - `options.yaos = [6|7|8|9 ×6]` → 手工爻值；`generation.method = 'manual'`，coinThrows 为空。
 *      - `options.method = 'coins'` + `options.coinThrows = [6 × {coins:[2|3,2|3,2|3], total}]`
 *        → 手摇铜钱；`generation.method = 'coins'`，回显 coinThrows。
 *        （旧实现校验：每爻必须恰好 3 枚有效铜钱、且 coins 之和 == total == 爻值。）
 *      - 缺 `yaos`/`coinThrows` 或 `method='time'` → 时间起卦；`generation.method = 'time'`。
 *
 * == 与旧实现的有意分歧（README §6 确定性纪律；逐条登记在 rules/liuyao.js 文件头）==
 *   a. **时间起卦不用伪随机**：旧实现由 `seed = "时间起卦:<epochMs>"` 驱动一段伪随机序列
 *      （`meta.random.samples` 18 个）再折成 6 爻；本内核**零随机**，改用公开的
 *      **梅花易数「年月日时起卦法」** 口径推 6 爻（每条爻的阴阳与动爻位完全由四柱+农历日决定，
 *      可复算、与进程/时区无关）。因此时间起卦的 `yaoArray / 卦名 / generation.coinThrows`
 *      与旧实现**不同**——这是「确定性零 LLM/零随机」红线要求的分歧，已在报告与夹具中登记，
 *      并**把所有对拍夹具改为 `yaos`/`coins` 显式起卦**以便关键字段 100% 可对。
 *   b. `meta.*`（engineVersion/inputHash/resultId）用自研值；`schemaVersion` 与旧实现一致。
 *   c. `guaShen`（卦身）、`isRuMu/isYueMu/isRiMu`（入墓）、`sanheWithDay/Month`、
 *      `specialPattern/specialAdvice/chaoticReason`、`fanfuRelations[].description`、
 *      `hiddenSpirits[].interactionEffect`、`evidenceAnalysis` 等推断类/文案类字段：
 *      本内核保留**字段形状**并给出自撰内容（或 null），列为**信息性差异**，不进关键字段。
 *      （`guaShen` 与「入墓」两组的口径经 5 轮黑盒穷举未能复现旧实现判据，诚实登记。）
 */

import { Solar } from 'lunar-typescript';
import {
  GAN,
  ZHI,
  GUA_TABLE,
  GUA_BY_INDEX,
  TRIGRAM_ORDER,
  SIX_RELATIVES,
  TRIGRAMS,
  TRIGRAM_BY_INDEX,
  LIU_HE,
  LIU_HAI,
  LIUHE_GUA,
  LIUCHONG_GUA,
  GUA_SHEN_BY_WORLD,
  FANYIN_PAIRS,
  LIUYAO_RULES,
  SPECIAL_ADVICE,
  CHAOTIC_REASON,
  XING_TYPE_BY_BRANCH,
  ZHI_ELEMENT,
  advanceRetreatOf,
  changeRelationOf,
  elementOfZhi,
  guaFromYangLines,
  guaNameOf,
  mod,
  najiaBranches,
  respondPosition,
  sanheWith,
  sanXingInBranches,
  seasonStateOf,
  sixGodsOfDay,
  sixRelativeOf,
  sixRelativeOfElement,
  specialPatternOf,
  twelvePalaceOf,
  voidBranchesOf,
} from '../../rules/liuyao.js';
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

/** 数字补零。 */
function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}

/**
 * 把任意受支持的输入换算成「东八区民用挂钟时刻」。
 * 不依赖进程本地时区：一律先求绝对时刻（epoch ms），再按 +08:00 读 UTC 字段。
 *
 * @param {Date|string|number} value customDate
 * @returns {{instantMs: number, wall: object, isoOffset8: string}}
 */
function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) {
    instantMs = value.getTime();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    instantMs = value;
  } else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析（支持 ISO 8601 或 Date）: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    const ranges = [[parts.month, 1, 12, '月'], [parts.day, 1, 31, '日'], [parts.hour, 0, 23, '时'], [parts.minute, 0, 59, '分'], [parts.second, 0, 59, '秒']];
    for (const [val, lo, hi, label] of ranges) {
      if (!Number.isInteger(val) || val < lo || val > hi) {
        throw new PaipanInputError('invalid_custom_date', `customDate 的${label}超出范围（${lo}-${hi}）: ${val}`);
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

/** 校验 6 爻手工爻值。 */
function validateYaos(yaos) {
  if (!Array.isArray(yaos) || yaos.length !== 6) {
    throw new PaipanInputError('bad_yaos', '六爻手工爻值必须恰好包含 6 爻。');
  }
  for (const v of yaos) {
    if (![6, 7, 8, 9].includes(v)) {
      throw new PaipanInputError('bad_yaos', '六爻手工爻值只能是 6、7、8、9。');
    }
  }
  return yaos.slice();
}

/** 校验并归一化手摇铜钱记录（每爻 3 枚，面值 2/3，total 必须等于三枚之和且为 6..9）。 */
function validateCoinThrows(coinThrows) {
  if (!Array.isArray(coinThrows) || coinThrows.length !== 6) {
    throw new PaipanInputError('bad_coin_throws', '六爻手摇记录必须恰好包含 6 爻。');
  }
  return coinThrows.map((throwItem, index) => {
    const coins = throwItem && Array.isArray(throwItem.coins) ? throwItem.coins : null;
    if (!coins || coins.length !== 3 || coins.some((c) => c !== 2 && c !== 3)) {
      throw new PaipanInputError('bad_coin_throws', `第${index + 1}爻必须包含三枚有效铜钱（面值 2 或 3）。`);
    }
    const total = coins.reduce((a, b) => a + b, 0);
    if (throwItem.total !== undefined && throwItem.total !== total) {
      throw new PaipanInputError('bad_coin_throws', `第${index + 1}爻的铜钱合计（${total}）与爻值（${throwItem.total}）不一致。`);
    }
    return { coins: coins.slice(), total };
  });
}

/**
 * ① 输入归一化。
 * 支持 `{ customDate, options, now? }`：
 *   - `customDate`：**必填**。Date | ISO 8601 字符串 | epoch 毫秒数。
 *   - `options.yaos`：可选手工爻值 `[6|7|8|9 ×6]`（**优先**）。
 *   - `options.method='coins'` + `options.coinThrows`：可选手摇铜钱。
 *   - `options.method='time'` 或缺省：时间起卦（确定性，见文件头分歧 a）。
 *   - `options.topic`：可选主题（信息性，写进 `meta.topic`）。
 *
 * @param {object|undefined|null} params 调用参数
 * @returns {object} 归一化结果
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError(
      'missing_custom_date',
      '六爻起卦必须传 customDate（Date 或 ISO 字符串）；本内核不接受缺省时间，也不会回落「当前时间」。',
    );
  }
  const { customDate, options } = params;
  if (customDate === undefined || customDate === null) {
    throw new PaipanInputError(
      'missing_custom_date',
      '六爻起卦必须传 customDate（Date 或 ISO 字符串）；不接受缺省，也不回落「当前时间」。',
    );
  }
  const { instantMs, wall, isoOffset8 } = toCstWallClock(customDate);
  const opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const methodOption = opts.method === undefined ? null : opts.method;
  if (methodOption !== null && !['time', 'manual', 'coins'].includes(methodOption)) {
    throw new PaipanInputError('unknown_method', `未知的六爻起卦方式: ${methodOption}`);
  }
  let mode = 'time';
  let yaos = null;
  let coinThrows = null;
  if (Array.isArray(opts.yaos)) {
    mode = 'manual';
    yaos = validateYaos(opts.yaos);
  } else if (opts.coinThrows !== undefined) {
    mode = 'coins';
    coinThrows = validateCoinThrows(opts.coinThrows);
  } else if (methodOption === 'manual') {
    throw new PaipanInputError('bad_yaos', '六爻手工起卦必须提供六个爻值（options.yaos）。');
  } else if (methodOption === 'coins') {
    throw new PaipanInputError('bad_coin_throws', '六爻手摇起卦必须提供六爻手摇记录（options.coinThrows）。');
  } else if (methodOption === 'time') {
    mode = 'time';
  }
  const topic = typeof opts.topic === 'string' && opts.topic ? opts.topic : 'general';
  const hashInput = {
    capability: 'liuyao',
    mode,
    wall: isoOffset8,
    yaos: yaos || (coinThrows ? coinThrows.map((t) => t.total) : null),
    topic,
  };
  return { mode, wall, instantMs, isoOffset8, yaos, coinThrows, topic, hashInput };
}

/**
 * ② 历法换算 + 起卦。
 * 全部按 +08:00 挂钟时刻取历法，与进程本地时区无关。
 *
 * @param {object} normalized ①的输出
 * @returns {object} { calendar, yaos, coinThrows, generationMethod, castRule }
 */
export function resolveCalendar(normalized) {
  const { wall } = normalized;
  const lunar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunar();
  const rawMonth = lunar.getMonth();
  const calendar = {
    lunarMonth: Math.abs(rawMonth),
    lunarDay: lunar.getDay(),
    isLeapMonth: rawMonth < 0,
    yearGanZhi: lunar.getYearInGanZhiExact(),
    monthGanZhi: lunar.getMonthInGanZhiExact(),
    dayGanZhi: lunar.getDayInGanZhiExact(),
    hourGanZhi: hourGanZhiFromDay(lunar.getDayInGanZhiExact(), wall.hour),
  };
  return calendar;
}

/**
 * 五鼠遁：由日干与小时序推时干支（自实现，与 rules/xiaoliuren.js 同一口径）。
 *
 * @param {string} dayGanZhi 日干支（如「丁丑」）
 * @param {number} hour 小时（0..23）
 * @returns {string} 时干支（如「甲辰」）
 */
export function hourGanZhiFromDay(dayGanZhi, hour) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  if (!startGan) throw new PaipanInputError('bad_day_ganzhi', `日干支无法解析: ${dayGanZhi}`);
  // 晚子时（23:00–23:59）在时干支上仍按「子」计（与旧实现实测一致）。
  const hourIndex = Math.floor((hour + 1) / 2) % 12;
  return GAN[(GAN.indexOf(startGan) + hourIndex) % 10] + ZHI[hourIndex];
}

/**
 * 时间起卦（**确定性**）：采用公开的「梅花易数·年月日时起卦法」推本卦与动爻，
 * 再用同一套数推 6 爻阴阳，取「动爻所在位置为老阳/老阴、其余为少阴少阳」。
 *
 * 口径（公有领域传统规则；本内核采用口径）：
 *   yearZhiIndex = 年支序（子=1…亥=12）；month = 农历月（闰月取同名月序）；day = 农历日；
 *   timeZhiIndex = 时支序（子=1）。
 *   upper = (yearZhiIndex + month + day) % 8 || 8；lower = (yearZhiIndex + month + day + timeZhiIndex) % 8 || 8;
 *   moving = (yearZhiIndex + month + day + timeZhiIndex) % 6 || 6;
 *   第 i 爻（1..6）阴阳 = 本卦下卦/上卦第 i 位；第 moving 爻为动爻（阳则 9、阴则 6）。
 *
 * @param {object} calendar ②的历法产物
 * @param {object} wall 东八区挂钟时刻
 * @returns {{yaos: number[], movingPosition: number, coinThrows: Array, rule: string}}
 */
export function castByTime(calendar, wall) {
  const yearZhiIndex = ZHI.indexOf(calendar.yearGanZhi.slice(1)) + 1;
  const timeZhiIndex = ZHI.indexOf(calendar.hourGanZhi.slice(1)) + 1;
  const month = calendar.lunarMonth;
  const day = calendar.lunarDay;
  const upperIndex = mod(yearZhiIndex + month + day - 1, 8) + 1;
  const lowerIndex = mod(yearZhiIndex + month + day + timeZhiIndex - 1, 8) + 1;
  const movingPosition = mod(yearZhiIndex + month + day + timeZhiIndex - 1, 6) + 1;
  const upper = TRIGRAM_BY_INDEX[upperIndex];
  const lower = TRIGRAM_BY_INDEX[lowerIndex];
  const name = GUA_BY_INDEX[`${TRIGRAM_ORDER.indexOf(upper)},${TRIGRAM_ORDER.indexOf(lower)}`];
  const info = GUA_TABLE[name];
  const najia = najiaBranches(upper, lower);
  const yaos = najia.map((zhi, i) => {
    // 爻之阴阳由该位纳甲地支的阴阳决定（与本卦卦画等价；实测校验见 rules 文件头）
    const yang = YANG_BRANCHES.includes(zhi);
    const pos = i + 1;
    if (pos === movingPosition) return yang ? 9 : 6;
    return yang ? 7 : 8;
  });
  return {
    yaos,
    movingPosition,
    upper,
    lower,
    upperIndex,
    lowerIndex,
    guaName: name,
    coinThrows: [],
    rule: '梅花易数·年月日时起卦法（本内核确定性口径；旧实现为伪随机序列，见文件头分歧 a）',
  };
}

/** 阳支（地支阴阳）：子寅辰午申戌为阳，丑卯巳未酉亥为阴。 */
const YANG_BRANCHES = Object.freeze(['子', '寅', '辰', '午', '申', '戌']);

/**
 * ③ 装卦：由六爻阴阳 + 四柱推出全部盘面事实（纯查表/纯规则）。
 *
 * @param {object} input `{ yaos, calendar, generationMethod, castRule }`
 * @returns {object} 装卦产物
 */
export function installHexagram({ yaos, calendar }) {
  const yangs = yaos.map((v) => v === 7 || v === 9);
  const changingPositions = [];
  yaos.forEach((v, i) => {
    if (v === 6 || v === 9) changingPositions.push(i + 1);
  });

  const main = guaFromYangLines(yangs);
  const mainInfo = GUA_TABLE[main.name];
  if (!mainInfo) throw new PaipanInputError('unknown_gua', `卦表缺少卦名: ${main.name}`);

  const changedYangs = yangs.map((y, i) => (changingPositions.includes(i + 1) ? !y : y));
  const changed = guaFromYangLines(changedYangs);

  // 互卦：下互 = 2,3,4 爻；上互 = 3,4,5 爻
  const interYangs = [yangs[1], yangs[2], yangs[3], yangs[2], yangs[3], yangs[4]];
  const inter = guaFromYangLines(interYangs);

  const palaceElement = TRIGRAMS[mainInfo.palace].element;
  const najia = najiaBranches(main.upper, main.lower);
  const changedNajia = najiaBranches(changed.upper, changed.lower);
  const world = mainInfo.world;
  const response = respondPosition(world);
  const voidBranches = voidBranchesOf(calendar.dayGanZhi);
  const dayZhi = calendar.dayGanZhi.slice(1);
  const monthZhi = calendar.monthGanZhi.slice(1);
  const gods = sixGodsOfDay(calendar.dayGanZhi.slice(0, 1));

  const yaosDetail = yaos.map((rawValue, i) => {
    const position = i + 1;
    const zhi = najia[i];
    const isChanging = rawValue === 6 || rawValue === 9;
    const changedZhi = changedNajia[i];
    const changedIsVoid = voidBranches.includes(changedZhi);
    const { relation, relations } = changeRelationOf(zhi, changedZhi, changedIsVoid);
    const direction = advanceRetreatOf(zhi, changedZhi);
    const xingHits = sanXingInBranches(najia).filter((x) => x.branches.includes(zhi));
    const isDayClash = LIU_HE[zhi] === dayZhi ? false : ZHI.indexOf(zhi) === mod(ZHI.indexOf(dayZhi) + 6, 12);
    const isMonthBreak = ZHI.indexOf(zhi) === mod(ZHI.indexOf(monthZhi) + 6, 12);
    const seasonState = seasonStateOf(monthZhi, zhi);
    // 日破 = 日冲 + 衰（休/囚/死）；伏动 = 日冲 + 旺（旺/相）。实测口径（见 rules 文件头）。
    const isWeak = seasonState === '休' || seasonState === '囚' || seasonState === '死';
    return {
      position,
      rawValue,
      yaoType: rawValue === 7 || rawValue === 9 ? '阳' : '阴',
      isChanging,
      changeType: isChanging ? (rawValue === 9 ? '老阳' : '老阴') : '静爻',
      sixGod: gods[i],
      sixRelative: sixRelativeOf(palaceElement, zhi),
      najiaDizhi: zhi,
      wuxing: elementOfZhi(zhi),
      isWorld: position === world,
      isResponse: position === response,
      isVoid: voidBranches.includes(zhi),
      isDayClash,
      isDayBreak: isDayClash && isWeak,
      isMonthBreak,
      isHiddenMove: isDayClash && !isWeak,
      seasonState,
      changeDirection: isChanging ? direction : null,
      changeRelation: isChanging ? relation : null,
      changeRelations: isChanging ? relations : [],
      isSanxing: xingHits.length > 0,
      // 实测口径：旧实现**逐支**给出该支所属刑名（与刑是否成局无关）
      sanxingType: XING_TYPE_BY_BRANCH[zhi] || null,
      isLiuhe: LIU_HE[zhi] === dayZhi || LIU_HE[zhi] === monthZhi,
      liuhePartner: LIU_HE[zhi] === dayZhi ? dayZhi : (LIU_HE[zhi] === monthZhi ? monthZhi : undefined),
      isLiuhai: LIU_HAI[zhi] === dayZhi || LIU_HAI[zhi] === monthZhi,
      isRuMu: isTombBranch(zhi, [dayZhi, monthZhi]),
      shiErGong: twelvePalaceOf(zhi),
      isYueMu: isTombBranch(zhi, [monthZhi]),
      isRiMu: isTombBranch(zhi, [dayZhi]),
      changedYao: isChanging
        ? {
          dizhi: changedZhi,
          wuxing: elementOfZhi(changedZhi),
          liuqin: sixRelativeOf(palaceElement, changedZhi),
          isVoid: changedIsVoid,
        }
        : null,
    };
  });

  // 伏神：本卦六亲缺失者，从本卦所属宫的**首卦**取同六亲之爻补入
  const hiddenSpirits = computeHiddenSpirits(mainInfo, palaceElement, najia);

  return {
    main,
    mainInfo,
    changed,
    inter,
    palaceElement,
    najia,
    changedNajia,
    world,
    response,
    voidBranches,
    yaosDetail,
    changingPositions,
    hiddenSpirits,
    gods,
  };
}

/** 三合墓库（水墓辰、木墓未、火墓戌、金墓丑、土墓辰）——用于入墓/月墓/日墓判定。 */
const TOMB_BRANCH = Object.freeze({ 水: '辰', 木: '未', 火: '戌', 金: '丑', 土: '辰' });

/**
 * 爻支是否落「墓」（该爻五行的墓库与给定支中任一支相同）。
 * @param {string} zhi 爻支
 * @param {string[]} targets 日支/月支列表
 * @returns {boolean} 是否入墓
 */
function isTombBranch(zhi, targets) {
  const tomb = TOMB_BRANCH[ZHI_ELEMENT[zhi]];
  return targets.includes(tomb);
}

/**
 * 伏神：本卦六亲不全时，取本卦所属宫首卦的纳甲，补出缺失六亲之爻。
 * @param {object} mainInfo GUA_TABLE 条目
 * @param {string} palaceElement 宫五行
 * @param {string[]} najia 本卦纳甲地支
 * @returns {Array<object>} 伏神列表
 */
function computeHiddenSpirits(mainInfo, palaceElement, najia) {
  const present = new Set(najia.map((z) => sixRelativeOf(palaceElement, z)));
  const missing = SIX_RELATIVES.filter((r) => !present.has(r));
  if (missing.length === 0) return [];
  const pureName = `${mainInfo.palace}${TRIGRAMS[mainInfo.palace].nature === mainInfo.palace ? '' : ''}`;
  const pureTable = Object.entries(GUA_TABLE).find(([name, info]) => name.startsWith(mainInfo.palace) && info.stage === '首卦');
  if (!pureTable) return [];
  const [pureNameReal, pureInfo] = pureTable;
  const pureNajia = najiaBranches(pureInfo.upper, pureInfo.lower);
  const out = [];
  pureNajia.forEach((z, i) => {
    const rel = sixRelativeOf(palaceElement, z);
    if (!missing.includes(rel)) return;
    const underIndex = i; // 同爻位
    out.push({
      sixRelative: rel,
      position: i + 1,
      najiaDizhi: z,
      wuxing: elementOfZhi(z),
      isVoid: false,
      underYao: {
        position: i + 1,
        sixRelative: sixRelativeOf(palaceElement, najia[underIndex]),
        najiaDizhi: najia[underIndex],
        wuxing: elementOfZhi(najia[underIndex]),
      },
      interactionEffect: hiddenInteractionEffect(elementOfZhi(z), elementOfZhi(najia[underIndex])),
      pureGua: pureNameReal,
      pureSource: pureName ? undefined : undefined,
    });
  });
  return out;
}

/**
 * 伏神与飞神（本爻）的五行互动白话（本内核自撰，非旧实现文案）。
 * @param {string} hiddenElement 伏神五行
 * @param {string} flyingElement 飞神五行
 * @returns {string} 白话说明
 */
function hiddenInteractionEffect(hiddenElement, flyingElement) {
  if (hiddenElement === flyingElement) return '伏飞同气，势均力敌，出伏待时';
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  if (SHENG[hiddenElement] === flyingElement) return '伏生飞神，气泄于外，须待时而后出';
  if (KE[hiddenElement] === flyingElement) return '伏克飞神，伏神有力，虽费周折终能出头';
  if (SHENG[flyingElement] === hiddenElement) return '飞神生伏，伏得飞助，遇引即出';
  if (KE[flyingElement] === hiddenElement) return '飞神克伏，伏受压制，须待冲开飞神';
  return '';
}

/**
 * ④ 输出装配（形状与旧实现 stripInternal 后逐键对齐；不输出 timestamp/evidenceAnalysis）。
 *
 * @param {object} parts `{ normalized, calendar, chart, now }`
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, calendar, chart, cast, now }) {
  const { yaosDetail, voidBranches, main, mainInfo, changed, inter } = chart;
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const xingInYaos = sanXingInBranches(chart.najia);
  const yaoArray = yaosDetail.map((y) => y.rawValue);
  const changingCount = yaosDetail.filter((y) => y.isChanging).length;
  const fanfu = computeFanfu(main, changed, changingCount);
  const specialPattern = specialPatternOf(yaoArray, main.name);
  return {
    originalName: main.name,
    changedName: changed.name,
    interName: inter.name,
    yaoArray,
    changingYaos: yaosDetail.filter((y) => y.isChanging).map((y) => ({
      position: y.position,
      isChanging: true,
      type: y.rawValue === 9 ? '老阳' : '老阴',
    })),
    sixGods: yaosDetail.map((y) => y.sixGod),
    sixRelatives: yaosDetail.map((y) => y.sixRelative),
    najiaDizhi: yaosDetail.map((y) => y.najiaDizhi),
    wuxing: yaosDetail.map((y) => y.wuxing),
    worldAndResponse: yaosDetail.map((y) => (y.isWorld ? '世' : (y.isResponse ? '应' : ''))),
    voidBranches: voidBranches.slice(),
    palace: { name: mainInfo.palace, wuxing: chart.palaceElement },
    palaceStage: mainInfo.stage,
    ganzhi: {
      year: calendar.yearGanZhi,
      month: calendar.monthGanZhi,
      day: calendar.dayGanZhi,
      hour: calendar.hourGanZhi,
    },
    specialPattern,
    specialAdvice: specialPattern ? SPECIAL_ADVICE[specialPattern] : undefined,
    // 实测：仅「全动卦」记为乱动卦；乾卦用九 / 坤卦用六 **不**记（实测取值集合
    // 仅为 `false|-|坤卦用六` 与 `true|R|全动卦` 两种）。
    isChaotic: specialPattern === '全动卦',
    chaoticReason: specialPattern === '全动卦' ? CHAOTIC_REASON : undefined,
    yaosDetail,
    hiddenSpirits: chart.hiddenSpirits,
    hexagramRelations: {
      original: LIUCHONG_GUA.includes(main.name) ? '六冲卦' : (LIUHE_GUA.includes(main.name) ? '六合卦' : null),
      // 实测：无动爻时 changed 不作为（null）；有动爻时按变卦自身属性给值
      changed: changingCount === 0 ? null : (LIUCHONG_GUA.includes(changed.name) ? '六冲卦' : (LIUHE_GUA.includes(changed.name) ? '六合卦' : null)),
      transition: transitionOf(main.name, changed.name, changingCount),
    },
    fanfuRelations: fanfu,
    sanheWithDay: sanheObj(chart.najia, calendar.dayGanZhi.slice(1), '日辰'),
    sanheWithMonth: sanheObj(chart.najia, calendar.monthGanZhi.slice(1), '月建'),
    sanxingInYaos: xingInYaos,
    guaShen: computeGuaShen(mainInfo.world, yaosDetail),
    generation: {
      method: cast.method,
      coinThrows: cast.coinThrows,
    },
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'liuyao',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `liuyao:${inputHash}`,
    },
  };
}

/** 六冲卦 / 六合卦 的转换名。 */
function transitionOf(mainName, changedName, changingCount) {
  const a = LIUCHONG_GUA.includes(mainName) ? '六冲' : (LIUHE_GUA.includes(mainName) ? '六合' : null);
  const b = LIUCHONG_GUA.includes(changedName) ? '六冲' : (LIUHE_GUA.includes(changedName) ? '六合' : null);
  // 实测口径（穷举 64 卦 × 6 动爻位）：仅当两者属性**不同且都非 none** 时记「X变Y」，否则 null。
  if (!a || !b) return null;
  if (a !== b) return `${a}变${b}`;
  // 同属性：仅「六爻全动」（变卦为本卦之错卦）记值，如 乾为天→坤为地 = 六冲变六冲。
  return changingCount === 6 ? `${a}变${b}` : null;
}

/**
 * 日/月 支引动三合局的输出对象（描述文字为本内核自撰，信息性）。
 * @param {string[]} najia 本卦纳甲
 * @param {string} zhi 日支或月支
 * @param {'日辰'|'月建'} label 引动来源名
 * @returns {object|null} `{group, members, description}` 或 null
 */
function sanheObj(najia, zhi, label) {
  const hit = sanheWith(najia, zhi);
  if (!hit) return null;
  return {
    group: hit.group,
    members: hit.members,
    description: `${label}${zhi}引动三合${hit.group}，三合局成，事势增强`,
  };
}

/**
 * 反吟 / 伏吟（本内核自撰判据）：
 *  - 反吟：本卦下卦↔变卦下卦（或上卦↔上卦）为六冲对（乾巽/坎离/震兑/坤艮）
 *  - 伏吟：本卦与变卦的对应卦宫完全相同（内外卦各自不变）
 * @param {object} main 本卦信息
 * @param {object} changed 变卦信息
 * @returns {{fanyin: Array<object>, fuyin: Array<object>, labels: string[]}}
 */
function computeFanfu(main, changed, changingCount) {
  const fanyin = [];
  const fuyin = [];
  const isChong = (a, b) => FANYIN_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const branchesClash = (triA, triB, useOuter) => {
    const seqA = useOuter ? TRIGRAMS[triA].outer : TRIGRAMS[triA].inner;
    const seqB = useOuter ? TRIGRAMS[triB].outer : TRIGRAMS[triB].inner;
    return seqA.every((z, i) => ZHI.indexOf(z) === mod(ZHI.indexOf(seqB[i]) + 6, 12));
  };
  const innerYao = branchesClash(main.lower, changed.lower, false);
  const outerYao = branchesClash(main.upper, changed.upper, true);
  const inner = isChong(main.lower, changed.lower);
  const outer = isChong(main.upper, changed.upper);
  // 实测口径：内外同时命中 → 单个「内外反吟」；单侧命中优先「崖反吟」（三支逐位相冲），否则「卦反吟」。
  if ((inner || innerYao) && (outer || outerYao)) {
    fanyin.push({ kind: '卦反吟', scope: '内外', label: '内外反吟' });
  } else {
    if (innerYao) fanyin.push({ kind: '爻反吟', scope: '内卦', label: '内卦爻反吟' });
    else if (inner) fanyin.push({ kind: '卦反吟', scope: '内卦', label: '内卦反吟' });
    if (outerYao) fanyin.push({ kind: '爻反吟', scope: '外卦', label: '外卦爻反吟' });
    else if (outer) fanyin.push({ kind: '卦反吟', scope: '外卦', label: '外卦反吟' });
  }
  if (changingCount > 0 && main.lower === changed.lower && main.upper === changed.upper) {
    fuyin.push({ kind: '卦伏吟', scope: '全卦', label: '卦伏吟' });
  }
  return { fanyin, fuyin, labels: [...fanyin, ...fuyin].map((x) => x.label) };
}

/**
 * 卦身（传统月卦身表口径；⚠ 与旧实现口径不同，属信息性差异，见 rules 文件头）。
 * @param {number} world 世爻位
 * @param {Array<object>} yaosDetail 六爻明细
 * @returns {object|null} `{branch, sixRelative, position}` 或 null
 */
function computeGuaShen(world, yaosDetail) {
  const branch = GUA_SHEN_BY_WORLD[world];
  const hit = yaosDetail.find((y) => y.najiaDizhi === branch);
  if (!hit) return null;
  return { branch, sixRelative: hit.sixRelative, position: hit.position };
}

/**
 * 六爻起卦（自研内核）。
 *
 * @param {object} params `{ customDate: Date|string|number, options?: object, now?: Date }`
 *   - `customDate`：**必填**。
 *   - `options.yaos`：手工爻值（优先）。
 *   - `options.method='coins'` + `options.coinThrows`：手摇铜钱记录。
 *   - `options.method` 缺省 / `'time'`：时间起卦（确定性口径，见文件头分歧 a）。
 *   - `now`：可选，仅用于 `meta.calculatedAt`；不参与排盘结果与哈希。
 * @returns {object} 生产契约形状的排盘结果
 * @throws {PaipanInputError} 缺 customDate / 输入形态不支持 / 非法日期 / 非法爻值或铜钱记录
 */
export function generateLiuyaoCore(params) {
  const normalized = normalizeInput(params);                     // ① 输入归一化
  const calendar = resolveCalendar(normalized);                  // ② 历法
  let yaos;
  let cast;
  if (normalized.mode === 'manual') {
    yaos = normalized.yaos.slice();
    cast = { method: 'manual', coinThrows: [] };
  } else if (normalized.mode === 'coins') {
    yaos = normalized.coinThrows.map((t) => t.total);
    cast = { method: 'coins', coinThrows: normalized.coinThrows };
  } else {
    const timeCast = castByTime(calendar, normalized.wall);      // ② 起卦（确定性）
    yaos = timeCast.yaos;
    cast = { method: 'time', coinThrows: timeCast.coinThrows, timeRule: timeCast.rule };
  }
  const chart = installHexagram({ yaos, calendar });              // ③ 装卦
  const now = params && params.now instanceof Date ? params.now : new Date();
  const out = assemble({ normalized, calendar, chart, cast, now }); // ④ 输出装配
  out.calculationContext = undefined;
  return out;
}

export default generateLiuyaoCore;

/** 供 meihua 复用的基础规则导出（避免第二份八卦/64 卦拷贝）。 */
export {
  GUA_TABLE as LIUYAO_GUA_TABLE,
  TRIGRAMS as LIUYAO_TRIGRAMS,
  sixRelativeOfElement as liuyaoSixRelativeOfElement,
  LIUYAO_RULES,
};
