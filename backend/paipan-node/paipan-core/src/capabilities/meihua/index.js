/**
 * 命理 · 自研排盘内核 · 能力：梅花易数（meihua）
 * ===========================================================================
 * 导出 `generateMeihuaCore(params)` —— 与旧实现 `generateMeihua(customDate, settings)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状），顶层键序与旧实现一致：
 *   originalName, changedName, interName, tiGua, yongGua, changedTiGua, changedYongGua,
 *   interTiGua, interYongGua, mainHexagram, changedHexagram, interHexagram, movingYao,
 *   analysis, ganzhi, yaosDetail, calculation, meta
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 normalizeInput        —— 只认确定性输入；缺 customDate 一律抛错
 *   ② 历法/起卦  resolveCalendar + castMeihua
 *   ③ 体用/格局判定 computeTiYong
 *   ④ 输出装配   assemble
 * 段间只传普通 JSON 对象；**零 IO / 零 LLM / 零随机 / 零时钟参与结果**。
 *
 * 六爻与梅花**共享 64 卦基础**：八卦表、64 卦表、纳甲、六亲、八宫一律从 `rules/liuyao.js` 取，
 * 本文件不建第二份表（README §2）。梅花特有规则在 `rules/meihua.js`。
 * 卦辞/爻辞原文取 `rules/zhouyi-texts.js`（公网采源的《周易》原文，信息性字段）。
 *
 * == 与旧实现的有意分歧（确定性纪律；逐条登记在 rules/meihua.js 文件头）==
 *   a. 随机起卦（`seed` / `replay` / `method:'random'`）不受支持 —— 零随机纪律，抛错。
 *   b. `meta.*` 用自研值；`schemaVersion` 与旧实现一致（1.0.0）。
 *   c. 文案类（`tiYongSeasonEvaluation` 之外的评价、`timelineTrend`、`yingQi`、
 *      互/变关系叙述）为本内核**自撰现代白话**，判定条件由实测穷举得出，列为信息性差异。
 */

import { Solar } from 'lunar-typescript';
import {
  GUA_BY_INDEX,
  TRIGRAM_BY_INDEX,
  TRIGRAM_ORDER,
  TRIGRAMS,
  ZHI,
  guaFromYangLines,
} from '../../rules/liuyao.js';
import { ZHOUYI_TEXTS } from '../../rules/zhouyi-texts.js';
import {
  MEIHUA_KE,
  MEIHUA_SHENG,
  MOVING_YAO_NAMES,
  RELATION_FORTUNE,
  SEASON_BY_MONTH_ZHI,
  TI_YONG_EVALUATION,
  TIMELINE_TRENDS,
  YING_QI_MOVING,
  YING_QI_RELATION,
  YING_QI_STATE,
} from '../../rules/meihua.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta.engineVersion —— 自研内核版本（与旧实现的 0.2.2 有意不同，属信息性差异）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致。 */
export const SCHEMA_VERSION = '1.0.0';

/** 东八区偏移（分钟）。 */
const CST_OFFSET_MINUTES = 480;

/** 五鼠遁（日干 → 子时干）。 */
const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
});

/** 十天干。 */
const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/** 地支五行（与 rules/liuyao.js 同一事实，此处仅用于按支取五行做旺衰）。 */
const ZHI_ELEMENT = Object.freeze({
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
});

/** 五行旺衰（月支五行 × 目标五行）——与六爻同一口径，此处内联实现避免跨能力耦合到规则函数签名。 */
function seasonStateByElement(monthElement, element) {
  if (monthElement === element) return '旺';
  if (MEIHUA_SHENG[monthElement] === element) return '相';
  if (MEIHUA_SHENG[element] === monthElement) return '休';
  if (MEIHUA_KE[element] === monthElement) return '囚';
  return '死';
}

/** 三爻阴阳位串（'1'=阳，自初爻起）→ 八卦名（与 rules/liuyao.js 的 TRIGRAM_BY_PATTERN 同一事实）。 */
const TRIGRAM_BY_PATTERN_LOCAL = Object.freeze(['坤', '艮', '坎', '巽', '震', '离', '兑', '乾']);

/**
 * 内核输入错误（缺输入 / 输入形态不支持 / 非法日期 / 随机模式不支持）。
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

/** 取模（非负）。 */
function mod(n, m) {
  return ((Math.trunc(n) % m) + m) % m;
}

/**
 * 把受支持的输入换算成「东八区民用挂钟时刻」（与六爻同一口径，与进程本地时区无关）。
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
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
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
  if (!Number.isFinite(instantMs)) throw new PaipanInputError('invalid_custom_date', 'customDate 不是有效日期（Invalid Date / NaN）。');
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
 * 支持 `{ customDate, settings, now? }`：
 *   - `customDate`：**必填**（Date | ISO 8601 | epoch 毫秒）。
 *   - `settings.method`：缺省 / `'time'` → 时间起卦；`'number'` → 报数起卦。
 *   - `settings.numbers`（或 first/second/third）：报数起卦的 ≥2 个正整数。
 *   - `settings.seed` / `replay` / `randomSource` / `method:'random'` → **抛错**（零随机纪律）。
 *
 * @param {object|undefined|null} params 调用参数
 * @returns {object} 归一化结果
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_custom_date', '梅花易数起卦必须传 customDate（Date 或 ISO 字符串）；本内核不接受缺省时间。');
  }
  const { customDate, settings } = params;
  if (customDate === undefined || customDate === null) {
    throw new PaipanInputError('missing_custom_date', '梅花易数起卦必须传 customDate（Date 或 ISO 字符串）；不接受缺省，也不回落「当前时间」。');
  }
  const { instantMs, wall, isoOffset8 } = toCstWallClock(customDate);
  const st = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  if (st.seed !== undefined || st.replay !== undefined || st.randomSource !== undefined || st.method === 'random') {
    throw new PaipanInputError(
      'random_mode_unsupported',
      '梅花易数随机起卦（seed / replay / 自定义随机源）不受支持：本内核零随机（README §6 确定性纪律），'
      + '随机起卦无法保证「同样输入同样输出」。请改传 settings.method = \'time\'（时间起卦）或 \'number\'（报数起卦）。',
    );
  }
  const method = st.method === undefined ? 'time' : st.method;
  if (!['time', 'number'].includes(method)) {
    throw new PaipanInputError('unknown_method', `未知的梅花易数起卦方式: ${method}`);
  }
  let number = null;
  if (method === 'number') {
    const raw = st.number;
    if (!Number.isSafeInteger(raw) || raw <= 0) {
      throw new PaipanInputError('bad_numbers', `数字起卦必须提供安全范围内的正整数（settings.number）: ${raw}`);
    }
    number = raw;
  }
  return {
    method,
    number,
    wall,
    instantMs,
    isoOffset8,
    hashInput: { capability: 'meihua', method, wall: isoOffset8, number },
  };
}

/**
 * ② 历法换算（按 +08:00 挂钟时刻取历法；四柱口径与六爻/小六壬完全一致）。
 *
 * @param {object} normalized ①的输出
 * @returns {object} 四柱与农曆
 */
export function resolveCalendar(normalized) {
  const { wall } = normalized;
  const lunar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunar();
  const rawMonth = lunar.getMonth();
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const hourIndex = Math.floor((wall.hour + 1) / 2) % 12;
  const startGan = WU_SHU_DUN[dayGanZhi.slice(0, 1)];
  return {
    lunarMonth: Math.abs(rawMonth),
    lunarDay: lunar.getDay(),
    isLeapMonth: rawMonth < 0,
    // 输出用：立春「精确时刻」换年（与六爻/小六壬同一口径）
    yearGanZhi: lunar.getYearInGanZhiExact(),
    // 起卦公式用：**农曆年干支**（正月初一换年）——实测两者在立春前后 10 天内会不同
    castYearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhiExact(),
    dayGanZhi,
    hourGanZhi: GAN[(GAN.indexOf(startGan) + hourIndex) % 10] + ZHI[hourIndex],
  };
}

/**
 * 先天八卦序（1..8）→ 卦名。
 *
 * @param {number} upperIndex 上卦序 1..8
 * @param {number} lowerIndex 下卦序 1..8
 * @returns {{name: string, upper: string, lower: string}} 卦信息
 */
export function guaByTrigramIndex(upperIndex, lowerIndex) {
  const upper = TRIGRAM_BY_INDEX[upperIndex];
  const lower = TRIGRAM_BY_INDEX[lowerIndex];
  if (!upper || !lower) throw new PaipanInputError('bad_trigram_index', `八卦序超范围: ${upperIndex}/${lowerIndex}`);
  const name = GUA_BY_INDEX[`${TRIGRAM_ORDER.indexOf(upper)},${TRIGRAM_ORDER.indexOf(lower)}`];
  return { name, upper, lower };
}

/**
 * ② 起卦。
 *
 * **时间起卦（年月日时起卦法，公有领域传统规则；实测 500 例 + 探针 1439 例核对）**：
 *   年支序 = **农曆年干支**之支序（子=1…亥=12，**正月初一换年**，与输出 `ganzhi.year`
 *   所用的「立春精确时刻换年」**有意不同** —— 实测在立春前后 10 天内两者不同，旧实现即如此）
 *   月 = 农曆月（闰月取同名月序）；日 = 农曆日；时支序 = 时支序（子=1…亥=12）
 *   上卦序 = (年支序 + 月 + 日) mod 8（0 取 8）
 *   下卦序 = (年支序 + 月 + 日 + 时支序) mod 8（0 取 8）
 *   动爻位 = (年支序 + 月 + 日 + 时支序) mod 6（0 取 6）
 *
 * **数字起卦（报数；实测 84 例）**：
 *   上卦序 = number mod 8（0 取 8）
 *   下卦序 = (number + 时支序) mod 8（0 取 8）
 *   动爻位 = (number + 时支序) mod 6（0 取 6）
 *
 * @param {object} normalized ①的输出
 * @param {object} calendar ②的历法产物
 * @returns {object} 起卦结果
 */
export function castMeihua(normalized, calendar) {
  const timeZhiIndex = ZHI.indexOf(calendar.hourGanZhi.slice(1)) + 1;
  if (normalized.method === 'number') {
    const n = normalized.number;
    const totalWithTime = n + timeZhiIndex;
    return {
      methodKey: 'number',
      methodLabel: '数字起卦法',
      number: n,
      totalWithTime,
      upperIndex: mod(n, 8) || 8,
      lowerIndex: mod(totalWithTime, 8) || 8,
      movingYaoIndex: mod(totalWithTime, 6) || 6,
    };
  }
  const yearZhiIndex = ZHI.indexOf(calendar.castYearGanZhi.slice(1)) + 1;
  const sum = yearZhiIndex + calendar.lunarMonth + calendar.lunarDay;
  return {
    methodKey: 'time',
    methodLabel: '年月日时起卦法',
    upperIndex: mod(sum, 8) || 8,
    lowerIndex: mod(sum + timeZhiIndex, 8) || 8,
    movingYaoIndex: mod(sum + timeZhiIndex, 6) || 6,
  };
}

/**
 * 上下卦 → 6 爻阴阳（自初爻起，true = 阳）。
 * @param {string} upper 上卦名
 * @param {string} lower 下卦名
 * @returns {boolean[]} 6 个布尔
 */
function yangsOf(upper, lower) {
  const upIdx = TRIGRAM_BY_PATTERN_LOCAL.indexOf(upper);
  const loIdx = TRIGRAM_BY_PATTERN_LOCAL.indexOf(lower);
  if (upIdx < 0 || loIdx < 0) throw new PaipanInputError('bad_gua', `未知卦: ${upper}/${lower}`);
  const bitsOf = (idx) => [(idx >> 2) & 1, (idx >> 1) & 1, idx & 1];
  return [...bitsOf(loIdx).map((b) => b === 1), ...bitsOf(upIdx).map((b) => b === 1)];
}

/**
 * 体用五行格局（五格局）。
 * @param {string} tiElement 体卦五行
 * @param {string} yongElement 用卦五行
 * @returns {{relation: string, raw: string}} 关系名与 raw（比和时 raw 为「比和」）
 */
export function tiYongRelation(tiElement, yongElement) {
  if (tiElement === yongElement) return { relation: '体用比和', raw: '比和' };
  if (MEIHUA_SHENG[tiElement] === yongElement) return { relation: '体生用', raw: '体生用' };
  if (MEIHUA_SHENG[yongElement] === tiElement) return { relation: '用生体', raw: '用生体' };
  if (MEIHUA_KE[tiElement] === yongElement) return { relation: '体克用', raw: '体克用' };
  return { relation: '用克体', raw: '用克体' };
}

/** 旺衰档：旺/相 = '旺'，休/囚/死 = '衰'。 */
function stateTier(state) {
  return (state === '旺' || state === '相') ? '旺' : '衰';
}

/**
 * 体用旺衰评断（`tiYongSeasonEvaluation`）。
 * 判据（实测 576 例结构穷举 + 25 个可达 (体,用) 组合全部命中，见 rules/meihua.js TI_YONG_EVALUATION）：
 *   体用比和 / 体生用 → 各一种（与旺衰无关）；
 *   用生体：用∈{旺,相} → 吉；否则 → 浅助；
 *   体克用：体∈{旺,相} → 旺克；否则 → 力衰；
 *   用克体：体∈{旺,相} → 有惊无险；体∈{囚,死} → 严峻；体 == 休 → 中性。
 * （文字为本内核自撰现代白话，信息性字段。）
 *
 * @param {string} relation 体用关系名
 * @param {string} tiState 体卦旺衰（旺/相/休/囚/死）
 * @param {string} yongState 用卦旺衰
 * @returns {string} 白话评断
 */
export function tiYongEvaluation(relation, tiState, yongState) {
  if (relation === '体用比和' || relation === '体生用') return TI_YONG_EVALUATION[relation];
  if (relation === '用生体') {
    return stateTier(yongState) === '旺' ? TI_YONG_EVALUATION['用生体|用旺'] : TI_YONG_EVALUATION['用生体|用衰'];
  }
  if (relation === '体克用') {
    return stateTier(tiState) === '旺' ? TI_YONG_EVALUATION['体克用|体旺'] : TI_YONG_EVALUATION['体克用|体衰'];
  }
  // 用克体
  if (tiState === '休') return TI_YONG_EVALUATION['用克体|体休'];
  if (tiState === '囚' || tiState === '死') return TI_YONG_EVALUATION['用克体|体死'];
  return TI_YONG_EVALUATION['用克体|体旺'];
}

/**
 * 基准 ↔ 对方的五行关系（内部用）。
 * @param {string} baseElement 基准五行
 * @param {string} otherElement 对方五行
 * @returns {'比和'|'生'|'被生'|'克'|'被克'} 关系
 */
function bodyRelation(baseElement, otherElement) {
  if (baseElement === otherElement) return '比和';
  if (MEIHUA_SHENG[baseElement] === otherElement) return '生';
  if (MEIHUA_SHENG[otherElement] === baseElement) return '被生';
  if (MEIHUA_KE[baseElement] === otherElement) return '克';
  return '被克';
}

/**
 * 互/变关系文本（本内核自撰措辞；取值集合与实测一致）。
 * 命名口径：`${主体}${动词}${客体}`；互1/互2 以「原体」为动词主语，变卦以体卦为主语。
 * @param {string} baseElement 原体（体卦）五行
 * @param {string} otherElement 对方五行
 * @param {'inter1'|'inter2'|'changed'} kind 关系类别
 * @returns {string} 关系文本
 */
function relationText(baseElement, otherElement, kind) {
  const rel = bodyRelation(baseElement, otherElement);
  if (kind === 'inter1') {
    if (rel === '比和') return '体互与原体比和';
    if (rel === '生') return '原体生体互';
    if (rel === '被生') return '体互生原体';
    if (rel === '克') return '原体克体互';
    return '体互克原体';
  }
  if (kind === 'inter2') {
    if (rel === '比和') return '用互与原体比和';
    if (rel === '生') return '原体生用互';
    if (rel === '被生') return '用互生原体';
    if (rel === '克') return '原体克用互';
    return '用互克原体';
  }
  return tiYongRelation(baseElement, otherElement).relation;
}

/**
 * 趋势判定（`analysis.timelineTrend`）。
 * 实测判据（117 个可达四元组 + 2400 例跨年代交叉验证，全部命中）：
 *   初 = 本卦体用关系的吉凶档（吉={体用比和,用生体}、凶={体生用,用克体}、平={体克用}）
 *   终 = 变卦关系的吉凶档（= `${changedRelation} 的档`）
 *   中 = 「互卦有一半**克**体」（`体互克原体` 或 `用互克原体`）
 *   初吉&终吉 → 中克体? 中途多阻 : 始末顺畅
 *   初吉&终凶 → 先顺后阻
 *   初凶&终吉 → 先难后易
 *   初凶&终凶 → 中克体? 始终受制 : 平稳演进
 *   含「平」  → 中克体? 中途多阻 : 平稳演进
 * 文字为本内核自撰（信息性字段）。
 *
 * @param {string} tiElement 体卦五行
 * @param {{yong:string, tiInter:string, yongInter:string, changed:string}} elements 各组五行
 * @returns {{trend: string, summary: string}} 趋势
 */
export function timelineTrend(tiElement, elements) {
  const fortune = (otherElement) => RELATION_FORTUNE[tiYongRelation(tiElement, otherElement).relation];
  const start = fortune(elements.yong);
  const end = fortune(elements.changed);
  const midKeBody = bodyRelation(tiElement, elements.tiInter) === '被克'
    || bodyRelation(tiElement, elements.yongInter) === '被克';
  let key;
  if (start === '平' || end === '平') key = midKeBody ? '中途多阻' : '平稳演进';
  else if (start === '吉' && end === '吉') key = midKeBody ? '中途多阻' : '始末顺畅';
  else if (start === '吉' && end === '凶') key = '先顺后阻';
  else if (start === '凶' && end === '吉') key = '先难后易';
  else key = midKeBody ? '始终受制' : '平稳演进';
  return TIMELINE_TRENDS[key];
}

/**
 * ③ 体用/格局判定（纯规则表）。
 *
 * @param {object} input `{ cast, calendar }`
 * @returns {object} 体用与格局产物
 */
export function computeTiYong({ cast, calendar }) {
  const main = guaByTrigramIndex(cast.upperIndex, cast.lowerIndex);
  const mainYangs = yangsOf(main.upper, main.lower);
  const movingPos = cast.movingYaoIndex;
  const changedYangs = mainYangs.map((y, i) => (i + 1 === movingPos ? !y : y));
  const changed = guaFromYangLines(changedYangs);
  const interYangs = [mainYangs[1], mainYangs[2], mainYangs[3], mainYangs[2], mainYangs[3], mainYangs[4]];
  const inter = guaFromYangLines(interYangs);

  const movingInLower = movingPos <= 3;
  const tiName = movingInLower ? main.upper : main.lower;
  const yongName = movingInLower ? main.lower : main.upper;
  const tiElement = TRIGRAMS[tiName].element;
  const yongElement = TRIGRAMS[yongName].element;

  const interTiName = movingInLower ? inter.upper : inter.lower;
  const interYongName = movingInLower ? inter.lower : inter.upper;
  const changedTiName = movingInLower ? changed.upper : changed.lower;
  const changedYongName = movingInLower ? changed.lower : changed.upper;

  const { relation, raw } = tiYongRelation(tiElement, yongElement);
  const monthZhi = calendar.monthGanZhi.slice(1);
  const monthElement = ZHI_ELEMENT[monthZhi];
  const tiState = seasonStateByElement(monthElement, tiElement);
  const yongState = seasonStateByElement(monthElement, yongElement);

  const interTiElement = TRIGRAMS[interTiName].element;
  const interYongElement = TRIGRAMS[interYongName].element;
  const changedTiElement = TRIGRAMS[changedTiName].element;
  const changedElement = TRIGRAMS[changedYongName].element;

  return {
    main,
    changed,
    inter,
    mainYangs,
    changedYangs,
    movingPos,
    movingInLower,
    tiName,
    yongName,
    tiElement,
    yongElement,
    interTiName,
    interYongName,
    changedTiName,
    changedYongName,
    interTiElement,
    interYongElement,
    changedTiElement,
    changedElement,
    relation,
    raw,
    monthZhi,
    monthElement,
    tiState,
    yongState,
    season: SEASON_BY_MONTH_ZHI[monthZhi],
    tiYongSeasonEvaluation: tiYongEvaluation(relation, tiState, yongState),
    inter1Relation: relationText(tiElement, interTiElement, 'inter1'),
    inter2Relation: relationText(tiElement, interYongElement, 'inter2'),
    changedRelation: relationText(tiElement, changedElement, 'changed'),
    changedTiYongRelation: relationText(tiElement, changedElement, 'changed'),
    timelineTrend: timelineTrend(tiElement, { yong: yongElement, tiInter: interTiElement, yongInter: interYongElement, changed: changedElement }),
  };
}

/**
 * 用九/用六（仅乾为天、坤为地有值；其余卦 undefined）。
 * 来源：公有领域古籍《周易》原文（采源 URL 见 rules/zhouyi-texts.js 文件头）。
 * 本内核自撰**文本形状**与旧实现同构，文字取自《周易》原文而非旧实现（信息性字段）。
 */
const YONG_CI = Object.freeze({
  乾为天: '见群龙无首，吉',
  坤为地: '利永贞',
});

/**
 * 卦展示对象（卦辞/爻辞取 rules/zhouyi-texts.js 的《周易》原文，信息性字段）。
 *
 * @param {{name: string, upper: string, lower: string}} gua 卦信息
 * @param {number[]} yaos 6 个爻值（6/7/8/9 或阴阳位）
 * @param {number|null} movingPos 动爻位（用于 movingYaoCi）
 * @param {boolean} withMoving 是否带 `movingYaoCi`
 * @returns {object} 卦展示对象
 */
function guaDisplay(gua, yaos, movingPos, withMoving) {
  const txt = ZHOUYI_TEXTS[gua.name] || null;
  const out = {
    name: gua.name,
    symbol: `${TRIGRAMS[gua.upper].symbol}${TRIGRAMS[gua.lower].symbol}`,
    upper: gua.upper,
    lower: gua.lower,
    description: txt ? txt.guaCi : '',
    yaoCi: txt ? txt.yaoCi.slice() : [],
  };
  if (withMoving) {
    out.movingYaoCi = txt && movingPos ? txt.yaoCi[movingPos - 1] : undefined;
    out.yongCi = YONG_CI[gua.name];
  }
  return out;
}

/**
 * ④ 输出装配（顶层键序与旧实现 stripInternal 后一致）。
 *
 * @param {object} parts `{ normalized, calendar, cast, chart, now }`
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, calendar, cast, chart, now }) {
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const mainYaoValues = chart.mainYangs.map((y, i) => (i + 1 === chart.movingPos ? (y ? 9 : 6) : (y ? 7 : 8)));
  const changedYaoValues = chart.changedYangs.map((y) => (y ? 7 : 8));
  const interYaoValues = [chart.mainYangs[1], chart.mainYangs[2], chart.mainYangs[3], chart.mainYangs[2], chart.mainYangs[3], chart.mainYangs[4]]
    .map((y) => (y ? 7 : 8));
  const tiGua = TRIGRAMS[chart.tiName];
  const yongGua = TRIGRAMS[chart.yongName];
  const changedTiGua = TRIGRAMS[chart.changedTiName];
  const changedYongGua = TRIGRAMS[chart.changedYongName];
  const interTiGua = TRIGRAMS[chart.interTiName];
  const interYongGua = TRIGRAMS[chart.interYongName];
  const yaosDetail = mainYaoValues.map((v, i) => ({
    position: i + 1,
    yaoType: v === 7 || v === 9 ? '阳' : '阴',
    isChanging: i + 1 === chart.movingPos,
    // 体用取法（实测口径）：动爻所在之卦为「用」，另一卦为「体」；
    // 惟体用同为一卦（上下卦相同）时，六爻一体，全部标「体」（实测 200 例核对）。
    tiYong: chart.tiName === chart.yongName ? '体' : ((i + 1 <= 3) === chart.movingInLower ? '用' : '体'),
  }));
  return {
    originalName: chart.main.name,
    changedName: chart.changed.name,
    interName: chart.inter.name,
    tiGua: { name: chart.tiName, element: chart.tiElement, nature: tiGua.nature },
    yongGua: { name: chart.yongName, element: chart.yongElement, nature: yongGua.nature },
    changedTiGua: { name: chart.changedTiName, element: chart.changedTiElement, nature: changedTiGua.nature },
    changedYongGua: { name: chart.changedYongName, element: chart.changedElement, nature: changedYongGua.nature },
    interTiGua: { name: chart.interTiName, element: chart.interTiElement, nature: interTiGua.nature },
    interYongGua: { name: chart.interYongName, element: chart.interYongElement, nature: interYongGua.nature },
    mainHexagram: guaDisplay(chart.main, mainYaoValues, chart.movingPos, true),
    changedHexagram: guaDisplay(chart.changed, changedYaoValues, null, false),
    interHexagram: guaDisplay(chart.inter, interYaoValues, null, false),
    movingYao: {
      position: chart.movingPos,
      description: `第${chart.movingPos}爻动`,
      yaoName: MOVING_YAO_NAMES[chart.movingPos],
    },
    analysis: {
      season: chart.season,
      monthBranch: chart.monthZhi,
      monthElement: chart.monthElement,
      tiYongRelation: chart.relation,
      tiSeasonState: chart.tiState,
      yongSeasonState: chart.yongState,
      inter1Relation: chart.inter1Relation,
      inter2Relation: chart.inter2Relation,
      changedRelation: chart.changedRelation,
      changedTiYongRelation: chart.changedTiYongRelation,
      tiYongRaw: chart.raw,
      tiYongSeasonEvaluation: chart.tiYongSeasonEvaluation,
      timelineTrend: chart.timelineTrend,
      yingQi: buildYingQi(chart, cast),
    },
    ganzhi: {
      year: calendar.yearGanZhi,
      month: calendar.monthGanZhi,
      day: calendar.dayGanZhi,
      hour: calendar.hourGanZhi,
    },
    yaosDetail,
    calculation: cast.methodKey === 'number'
      // 数字起卦：实测键序为 method, methodKey, number, timeZhi, timeZhiIndex, totalWithTime, 上/下/动
      ? {
        method: cast.methodLabel,
        methodKey: cast.methodKey,
        number: cast.number,
        timeZhi: calendar.hourGanZhi.slice(1),
        timeZhiIndex: ZHI.indexOf(calendar.hourGanZhi.slice(1)) + 1,
        totalWithTime: cast.totalWithTime,
        upperTrigramIndex: cast.upperIndex,
        lowerTrigramIndex: cast.lowerIndex,
        movingYaoIndex: cast.movingYaoIndex,
      }
      : {
        method: cast.methodLabel,
        methodKey: cast.methodKey,
        yearZhi: calendar.castYearGanZhi.slice(1),
        yearZhiIndex: ZHI.indexOf(calendar.castYearGanZhi.slice(1)) + 1,
        month: calendar.lunarMonth,
        day: calendar.lunarDay,
        timeZhi: calendar.hourGanZhi.slice(1),
        timeZhiIndex: ZHI.indexOf(calendar.hourGanZhi.slice(1)) + 1,
        upperTrigramIndex: cast.upperIndex,
        lowerTrigramIndex: cast.lowerIndex,
        movingYaoIndex: cast.movingYaoIndex,
      },
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'meihua',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `meihua:${inputHash}`,
    },
  };
}

/**
 * 应期提示（`analysis.yingQi`；本内核**自撰现代白话**，信息性字段，不进对拍关键字段）。
 * 结构（实测顺序固定）：
 *   [0] 爻动（恒有）
 *   [1] 数和（恒有）
 *   [2] 关系 —— **仅当** `tiYongRelation !== '体生用'` 时插入（旧实现怪癖，实测 576 例复刻）
 *   [末] 旺衰（恒有）
 * 故数组长度为 3（体生用）或 4（其余关系）。
 * @param {object} chart ③的产物
 * @param {object} cast 起卦产物
 * @returns {string[]} 应期条目
 */
function buildYingQi(chart, cast) {
  const out = [YING_QI_MOVING[chart.movingPos]];
  out.push(`上下卦数和为${cast.upperIndex + cast.lowerIndex}，只作取数来源旁证，不换算绝对日期`);
  if (chart.relation !== '体生用') out.push(YING_QI_RELATION[chart.relation]);
  out.push(chart.tiState === '旺' || chart.tiState === '相' ? YING_QI_STATE.旺相 : YING_QI_STATE.休囚死);
  return out;
}

/**
 * 梅花易数起卦（自研内核）。
 *
 * @param {object} params `{ customDate: Date|string|number, settings?: object, now?: Date }`
 *   - `customDate`：**必填**。
 *   - `settings.method`：缺省 / `'time'`（时间起卦）；`'number'`（报数起卦，配 `settings.numbers`）。
 *   - `now`：可选，仅用于 `meta.calculatedAt`；不参与排盘结果与哈希。
 * @returns {object} 生产契约形状的排盘结果
 * @throws {PaipanInputError} 缺 customDate / 非法日期 / 未知起卦方式 / 随机模式 / 报数非法
 */
export function generateMeihuaCore(params) {
  const normalized = normalizeInput(params);                 // ① 输入归一化
  const calendar = resolveCalendar(normalized);              // ② 历法
  const cast = castMeihua(normalized, calendar);             // ② 起卦
  const chart = computeTiYong({ cast, calendar });           // ③ 体用/格局
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({ normalized, calendar, cast, chart, now }); // ④ 输出装配
}

export default generateMeihuaCore;
