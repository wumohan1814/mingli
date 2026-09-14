/**
 * 命理 · 自研排盘内核 · 能力：皇极经世（元会运世 + 卦气推衍）
 * ---------------------------------------------------------------------------
 * 导出 `calculateHuangjiJingshiCore(params)` —— 与旧实现
 * `calculateHuangjiJingshi(params)` 同签名、同输出形状（stripInternal 之后）。
 *
 * 四段纯函数管线（见 README §1）：
 *   ① 输入归一化 normalizeInput —— {year}（值年）或 {date}（年月日时）
 *   ② 历法/起局 resolveCalendar —— 元会运世坐标 + 五级卦级联 + 黄畿 datetime 层
 *   ③ 格局判定 evaluate —— 互/错/综 + 消息文案（白话题名）
 *   ④ 输出装配 assemble
 *
 * == 对拍实测确认的口径（黑盒探针，见 rules/huangji.js 文件头）==
 *   1. 上元 = 公元前 67017 年（无 0 年）；elapsed = Y>0 ? Y+67016 : Y+67017。
 *   2. 元会运世坐标 1 起算；各级首年须做「无 0 年」校正（跨 0 时 +1）。
 *   3. 五级卦：统卦(2160年)=W60[(28+块序)%60]；运卦=统卦变(运序)爻；
 *      六十卦=运卦×60块序查表；十年卦=六十卦变(十块序)爻；
 *      值年卦=W60[(六十卦位 + elapsed%60)%60]。
 *   4. 值年 60 卦序 W60 与「剥→复、夬→姤」圆图对极跳转（rules 表）。
 *   5. 黄畿 datetime 层：以冬至为年界，24 节气各映射 15 皇极日（超出取 15）；
 *      月序 = 冬至起第 k 个中气；月/旬/日/时卦 = 年卦分形的逐级变爻/顺进。
 *   6. datetime 模式整体以「皇极年对应的公历年」（冬至后 = 次年）的坐标与卦级联
 *      输出 input/position/progress/forecast；dateTimeForecast 内 civilTime 用
 *      实际挂钟时刻。
 *   7. 无中国夏令时叠加：皇极层一律按 +08:00 民用挂钟（黑盒实测无 DST 调整）。
 *
 * 纪律：零 IO、零网络、零 LLM、零随机、零「当前时间」；同样输入同样输出。
 */

import { Solar } from 'lunar-typescript';
import {
  HUANGJI_ANCHOR_YEAR,
  HUANGJI_BY_ID,
  HUANGJI_CONVERSION,
  HUANGJI_CYCLE_INDEX,
  HUANGJI_EPOCH_YEAR,
  HUANGJI_HEXAGRAMS,
  HUANGJI_HUI_BRANCH,
  HUANGJI_MODEL,
  HUANGJI_QI_FROM_DONGZHI,
  HUANGJI_SIXTY_TABLE,
  HUANGJI_TERMS_FROM_DONGZHI,
  HUANGJI_TRIGRAM_BITS,
  HUANGJI_YEAR_CYCLE,
  HUANGJI_ZHI,
  huangjiChangeLine,
  huangjiHexagram,
} from '../../rules/huangji.js';
import { ZHOUYI_TEXTS } from '../../rules/zhouyi-texts.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta.engineVersion / schemaVersion。 */
export const ENGINE_VERSION = '0.1.0-mingli';
export const SCHEMA_VERSION = '1.0.0';

const CST_OFFSET_MINUTES = 480;

/** 内核输入错误。 */
export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}
function mod(n, m) {
  return ((Math.trunc(n) % m) + m) % m;
}

/** 把输入转成 +08:00 挂钟（epoch ms → +08 字段）。 */
function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) instantMs = value.getTime();
  else if (typeof value === 'number' && Number.isFinite(value)) instantMs = value;
  else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    const ranges = [[parts.month, 1, 12, '月'], [parts.day, 1, 31, '日'], [parts.hour, 0, 23, '时'], [parts.minute, 0, 59, '分'], [parts.second, 0, 59, '秒']];
    for (const [v, lo, hi, label] of ranges) {
      if (!Number.isInteger(v) || v < lo || v > hi) throw new PaipanInputError('invalid_custom_date', `customDate 的${label}越界: ${value}`);
    }
    let off = CST_OFFSET_MINUTES;
    if (tz === 'Z') off = 0;
    else if (tz) { const s = tz[0] === '-' ? -1 : 1; const b = tz.slice(1).replace(':', ''); off = s * (Number(b.slice(0, 2)) * 60 + Number(b.slice(2, 4))); }
    instantMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - off * 60000;
    const check = new Date(instantMs + off * 60000);
    const rt = { year: check.getUTCFullYear(), month: check.getUTCMonth() + 1, day: check.getUTCDate(), hour: check.getUTCHours(), minute: check.getUTCMinutes(), second: check.getUTCSeconds() };
    for (const k of Object.keys(rt)) if (rt[k] !== parts[k]) throw new PaipanInputError('invalid_custom_date', `customDate 不是真实时刻: ${value}`);
  } else throw new PaipanInputError('invalid_custom_date', `customDate 类型不支持: ${typeof value}`);
  if (!Number.isFinite(instantMs)) throw new PaipanInputError('invalid_custom_date', 'customDate 无效。');
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
  };
}

/**
 * ① 输入归一化。{year} 或 {date}（兼容 {mode:'year',year} 与 {mode:'datetime',customDate}）。
 * 无「0 年」：year 必须 ≥ −67017 且 ≠ 0。
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_input', '皇极经世必须传 {year} 或 {date}。');
  }
  const yearValue = params.year !== undefined ? params.year : (params.mode === 'year' ? params.year : undefined);
  if (yearValue !== undefined) {
    const y = yearValue;
    if (!Number.isInteger(y)) throw new PaipanInputError('invalid_year', `year 必须为整数: ${y}`);
    if (y < HUANGJI_EPOCH_YEAR) throw new PaipanInputError('invalid_year', `year 不能早于公元前 ${-HUANGJI_EPOCH_YEAR} 年。`);
    if (y === 0) throw new PaipanInputError('invalid_year', '无公元 0 年。');
    return { mode: 'year', year: y, hashInput: { capability: 'huangji', mode: 'year', year: y } };
  }
  const dateValue = params.date !== undefined ? params.date : params.customDate;
  if (dateValue === undefined || dateValue === null) {
    throw new PaipanInputError('missing_input', '皇极经世必须传 {year} 或 {date}。');
  }
  const wall = toCstWallClock(dateValue);
  const iso = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}+08:00`;
  return { mode: 'datetime', wall, iso, hashInput: { capability: 'huangji', mode: 'datetime', wall: iso } };
}

/** 自起点以来已完整经过的年数（无 0 年）。 */
export function elapsedYears(year) {
  return year > 0 ? year + 67016 : year + 67017;
}
/** 首年 = 起点 + offset 年（跨 0 校正）。 */
export function startYearOf(offsetYears) {
  const raw = HUANGJI_EPOCH_YEAR + offsetYears;
  return raw > 0 ? raw + 1 : raw;
}
/** 末年 = 首年 + 年数 − 1（区间含 0 时 +1）。 */
export function endYearOf(startYear, years) {
  return startYear + years - 1 + (startYear <= 0 && startYear + years - 1 >= 0 ? 1 : 0);
}

/** 年干支（index = (Y − 1984 + (Y ≤ 0 ? 1 : 0)) mod 60）。 */
export function yearGanZhi(year) {
  const g = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const z = HUANGJI_ZHI;
  const idx = mod(year - HUANGJI_ANCHOR_YEAR + (year <= 0 ? 1 : 0), 60);
  return g[idx % 10] + z[idx % 12];
}

/** 卦对象 → 生产契约子形状。 */
function hxBrief(name) {
  const h = huangjiHexagram(name);
  if (!h) throw new Error(`未知卦: ${name}`);
  return { id: h.id, name: h.name, shortName: h.shortName, symbol: h.symbol, upper: h.upper, lower: h.lower };
}
/** 卦对象 + 卦辞（信息性；公网采源周易原文）。 */
function hxFull(name) {
  const h = huangjiHexagram(name);
  const t = ZHOUYI_TEXTS[h.name] || {};
  return { ...hxBrief(name), judgment: t.guaCi || '' };
}
/** 爻辞（信息性）。 */
function yaoText(name, line) {
  const t = ZHOUYI_TEXTS[huangjiHexagram(name).name];
  return (t && t.yaoCi && t.yaoCi[line - 1]) || '';
}
/** 6 爻位表示（bit0=初爻）。 */
function sixBits(name) {
  const h = huangjiHexagram(name);
  return HUANGJI_TRIGRAM_BITS[h.lower] | (HUANGJI_TRIGRAM_BITS[h.upper] << 3);
}
function nameFromBits(six) {
  const bitToTri = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'];
  const lower = bitToTri[six & 0b111];
  const upper = bitToTri[(six >> 3) & 0b111];
  const h = HUANGJI_HEXAGRAMS.find((x) => x.upper === upper && x.lower === lower);
  return h.shortName;
}
/** 互卦（标准）：爻 2-4 为下卦，爻 3-5 为上卦。 */
export function mutualHexagram(name) {
  const six = sixBits(name);
  return nameFromBits(((six >> 1) & 0b111) | (((six >> 2) & 0b111) << 3));
}
/** 错卦（标准）：六爻全变。 */
export function oppositeHexagram(name) {
  return nameFromBits((~sixBits(name)) & 0b111111);
}

/** 综卦（传统覆卦表；黑盒实测 60 值年卦逐项一致）。 */
const REVERSED_TABLE = Object.freeze({
  乾: '乾', 坤: '坤', 坎: '坎', 离: '离',
  比: '师', 剥: '复', 萃: '升', 大畜: '无妄', 大有: '同人', 大壮: '遁', 鼎: '革', 兑: '巽',
  丰: '旅', 否: '泰', 复: '剥', 革: '鼎', 艮: '震', 姤: '夬', 蛊: '随', 夬: '姤', 观: '临',
  归妹: '渐', 恒: '咸', 涣: '节', 既济: '未济', 家人: '睽', 蹇: '解', 渐: '归妹', 节: '涣',
  解: '蹇', 晋: '明夷', 井: '困', 睽: '家人', 困: '井', 临: '观', 旅: '丰', 履: '小畜',
  蒙: '屯', 明夷: '晋', 谦: '豫', 升: '萃', 师: '比', 噬嗑: '贲', 讼: '需', 随: '蛊',
  损: '益', 泰: '否', 同人: '大有', 屯: '蒙', 未济: '既济', 无妄: '大畜', 咸: '恒',
  小畜: '履', 小过: '小过', 需: '讼', 巽: '兑', 颐: '颐', 益: '损', 豫: '谦', 震: '艮', 中孚: '中孚', 大过: '大过',
});
export function reversedHexagram(name) {
  return REVERSED_TABLE[name] || name;
}

/** 卦在 W60 中的位置；正卦（乾坤坎离）回退 64 序前一位再映射（黄畿日卦口径）。 */
export function cyclePosOrFallback(name) {
  const p = HUANGJI_CYCLE_INDEX[name];
  if (p !== undefined) return p;
  const order = ['乾', '夬', '大有', '大壮', '小畜', '需', '大畜', '泰', '履', '兑', '睽', '归妹', '中孚', '节', '损', '临', '同人', '革', '离', '丰', '家人', '既济', '贲', '明夷', '无妄', '随', '噬嗑', '震', '益', '屯', '颐', '复', '姤', '大过', '鼎', '恒', '巽', '井', '蛊', '升', '讼', '困', '未济', '解', '涣', '坎', '蒙', '师', '遁', '咸', '旅', '小过', '渐', '蹇', '艮', '谦', '否', '萃', '晋', '豫', '观', '比', '剥', '坤'];
  let x = order.indexOf(name) - 1;
  if (x < 0) x = order.length - 1;
  while (HUANGJI_CYCLE_INDEX[order[x]] === undefined) x = x - 1 < 0 ? order.length - 1 : x - 1;
  return HUANGJI_CYCLE_INDEX[order[x]];
}

/** ② 元会运世坐标 + 各级进度。 */
export function resolvePositions(elapsed) {
  const indexInYuan = elapsed + 1;
  const yuan = Math.floor(elapsed / 129600) + 1;
  const offsetYuan = elapsed - (yuan - 1) * 129600;
  const hui = Math.floor(offsetYuan / 10800) + 1;
  const offsetHui = offsetYuan - (hui - 1) * 10800;
  const yunInYuan = Math.floor(offsetYuan / 360) + 1;
  const yunInHui = Math.floor(offsetHui / 360) + 1;
  const offsetYun = offsetHui - (yunInHui - 1) * 360;
  const shiInYuan = Math.floor(offsetYuan / 30) + 1;
  const shiInYun = Math.floor(offsetYun / 30) + 1;
  const offsetShi = offsetYun - (shiInYun - 1) * 30;

  const yuanBase = (yuan - 1) * 129600;
  const yuanStart = startYearOf(yuanBase);
  const yuanEnd = endYearOf(yuanStart, 129600);
  const huiStart = startYearOf(yuanBase + (hui - 1) * 10800);
  const huiEnd = endYearOf(huiStart, 10800);
  const yunStart = startYearOf(yuanBase + (yunInYuan - 1) * 360);
  const yunEnd = endYearOf(yunStart, 360);
  const shiStart = startYearOf(yuanBase + (shiInYuan - 1) * 30);
  const shiEnd = endYearOf(shiStart, 30);

  const position = {
    yuan: { indexFromEpoch: yuan, startYear: yuanStart, endYear: yuanEnd },
    hui: { indexInYuan: hui, startYear: huiStart, endYear: huiEnd },
    yun: { indexInYuan: yunInYuan, indexInHui: yunInHui, startYear: yunStart, endYear: yunEnd },
    shi: { indexInYuan: shiInYuan, indexInYun: shiInYun, startYear: shiStart, endYear: shiEnd },
    year: { coordinate: null, indexInShi: offsetShi + 1, indexInYuan: offsetYuan + 1 },
  };
  const progress = {
    yuan: { currentYearIndex: offsetYuan + 1, completedYears: offsetYuan, remainingYearsAfterCurrent: 129600 - (offsetYuan + 1), nextCycleStartYear: yuanEnd + 1 },
    hui: { currentYearIndex: offsetHui + 1, completedYears: offsetHui, remainingYearsAfterCurrent: 10800 - (offsetHui + 1), nextCycleStartYear: huiEnd + 1 },
    yun: { currentYearIndex: offsetYun + 1, completedYears: offsetYun, remainingYearsAfterCurrent: 360 - (offsetYun + 1), nextCycleStartYear: yunEnd + 1 },
    shi: { currentYearIndex: offsetShi + 1, completedYears: offsetShi, remainingYearsAfterCurrent: 30 - (offsetShi + 1), nextCycleStartYear: shiEnd + 1 },
  };
  return { position, progress, elapsed, indexInYuan, offsetYuan, offsetHui, offsetYun, offsetShi, yuan, hui, yunInYuan, yunInHui, shiInYuan, shiInYun };
}

/** 值年卦级联（五级：统/运/六十/十/年），返回卦名 + 起止年 + 各层变爻行号。 */
export function resolveHexagramCascade(elapsed) {
  const govBlock = Math.floor(elapsed / 2160);
  const governing = HUANGJI_YEAR_CYCLE[mod(28 + govBlock, 60)];
  const govStart = startYearOf(govBlock * 2160);
  const govEnd = endYearOf(govStart, 2160);

  const yunIndex = Math.floor(elapsed / 360) + 1;
  const yunInGovBlock = (yunIndex - 1) - govBlock * 6;
  const yunLine = yunInGovBlock + 1;
  const yunHex = huangjiChangeLine(governing, yunLine);
  const yunStart = startYearOf((yunIndex - 1) * 360);
  const yunEnd = endYearOf(yunStart, 360);

  const baseElapsed = (yunIndex - 1) * 360;
  const blockInYun = Math.floor((elapsed - baseElapsed) / 60);
  const sixtyLine = blockInYun + 1;
  const sixty = HUANGJI_SIXTY_TABLE[yunHex][blockInYun];
  const sixtyStart = startYearOf(baseElapsed + blockInYun * 60);
  const sixtyEnd = endYearOf(sixtyStart, 60);

  const decadeInSixty = Math.floor((elapsed - (baseElapsed + blockInYun * 60)) / 10);
  const decadeLine = decadeInSixty + 1;
  const decade = huangjiChangeLine(sixty, decadeLine);
  const decadeStart = startYearOf(baseElapsed + blockInYun * 60 + decadeInSixty * 10);
  const decadeEnd = endYearOf(decadeStart, 10);

  const annual = HUANGJI_YEAR_CYCLE[mod(HUANGJI_CYCLE_INDEX[sixty] + (elapsed % 60), 60)];

  return {
    governing, govStart, govEnd,
    yunHex, yunStart, yunEnd, yunLine,
    sixty, sixtyStart, sixtyEnd, sixtyLine,
    decade, decadeStart, decadeEnd, decadeLine,
    annual,
  };
}

/** 五级卦级联 → 生产契约形状。changedLineText = 父卦在该爻位的爻辞（信息性）。 */
function cascadeObject(cal, nowYear) {
  const hex = (name) => hxFull(name);
  return {
    governing: { hexagram: hex(cal.governing), startYear: cal.govStart, endYear: cal.govEnd, durationYears: 2160 },
    yun: { hexagram: hex(cal.yunHex), startYear: cal.yunStart, endYear: cal.yunEnd, durationYears: 360, derivedFrom: cal.governing, changedLine: cal.yunLine, changedLineText: yaoText(cal.governing, cal.yunLine) },
    sixtyYear: { hexagram: hex(cal.sixty), startYear: cal.sixtyStart, endYear: cal.sixtyEnd, durationYears: 60, derivedFrom: cal.yunHex, changedLine: cal.sixtyLine, changedLineText: yaoText(cal.yunHex, cal.sixtyLine) },
    decade: { hexagram: hex(cal.decade), startYear: cal.decadeStart, endYear: cal.decadeEnd, durationYears: 10, derivedFrom: cal.sixty, changedLine: cal.decadeLine, changedLineText: yaoText(cal.sixty, cal.decadeLine) },
    annual: { ...hex(cal.annual), year: nowYear, ganzhi: yearGanZhi(nowYear) },
  };
}

/** 取某公历年的冬至时刻（epoch ms）。 */
function dongZhiOf(year) {
  const solar = Solar.fromYmdHms(year + 1, 1, 15, 12, 0, 0);
  const t = solar.getLunar().getJieQiTable()['冬至'];
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(t.toYmdHms());
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

/** ② 黄畿 datetime 层：皇极年定位 + 节气/月序/皇极日。 */
export function resolveHuangjiCalendar(wall) {
  const Y = wall.year;
  const epoch = Date.UTC(Y, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const annualYear = epoch >= dongZhiOf(Y) ? Y + 1 : Y;
  // 皇极年 = [冬至(annualYear−1), 冬至(annualYear))；用 1 月中旬的节气表（含该年 24 气）
  const table = Solar.fromYmdHms(annualYear, 1, 15, 12, 0, 0).getLunar().getJieQiTable();
  const termList = HUANGJI_TERMS_FROM_DONGZHI.map((name) => {
    const v = table[name];
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(v.toYmdHms());
    return { name, ms: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) };
  }).filter(Boolean);

  let active = null;
  for (const t of termList) {
    if (t.ms <= epoch) active = t;
    else break;
  }
  if (!active) active = termList[0];
  const dayInTerm = Math.floor((epoch - active.ms) / 86400000) + 1;
  const mapped = Math.min(dayInTerm, 15);

  const termIndexInYear = HUANGJI_TERMS_FROM_DONGZHI.indexOf(active.name);
  const doy = termIndexInYear * 15 + mapped;
  let monthIndex;
  let termPosInMonth;
  if (termIndexInYear % 2 === 0) {
    monthIndex = termIndexInYear / 2 + 1;
    termPosInMonth = 1;
  } else {
    monthIndex = Math.floor(termIndexInYear / 2) + 1;
    termPosInMonth = 2;
  }
  const dom = (termPosInMonth - 1) * 15 + mapped;
  const hourSegment = Math.floor(wall.hour / 4) + 1;

  return {
    activeSolarTerm: active.name,
    actualDayInSolarTerm: dayInTerm,
    mappedDayInSolarTerm: mapped,
    monthIndex,
    monthBranch: HUANGJI_ZHI[monthIndex - 1],
    dayOfMonth: dom,
    dayOfYear: doy,
    hourSegment,
    hourRange: `${pad2((hourSegment - 1) * 4)}:00—${pad2(hourSegment * 4)}:00`,
    annualYear,
  };
}

/** 消息阶段（现代白话，信息性）。 */
function eraTrendOf(annual, decade) {
  const six = sixBits(annual);
  let yang = 0;
  for (let i = 0; i < 6; i += 1) if ((six >> i) & 1) yang += 1;
  const yin = 6 - yang;
  let phase;
  if (annual === '剥') phase = '剥极将生';
  else if (yang > yin) phase = '阳息进取';
  else if (yang < yin) phase = '阴消蓄养';
  else phase = '阴阳相持';
  const trendNature = phase === '剥极将生' ? '剥极将生，阴极阳回' : phase === '阴消蓄养' ? '阴气渐长，收敛蓄养' : '阳气升腾，生机勃发，气机进取';
  const summary = `世运消息：处于${phase}期；值年${annual}卦承接${decade}十年卦气数，${trendNature}`;
  return { phase, yangLineCount: 3, yinLineCount: 3, trendNature, summary };
}

/** 古籍来源（公网镜像；wikisource 在本机网络不可达，与 zhouyi-texts 采源备注同况）。 */
const HUANGJI_SOURCES = Object.freeze([
  '《皇极经世》（北宋·邵雍）：https://zh.wikisource.org/wiki/皇極經世',
  '《皇极经世书解》（明·黄畿·分形同构）：https://zh.wikisource.org/wiki/皇極經世書解',
]);

/**
 * 证据层（自研，被 stripInternal 剥离；供 server 投影证据链展示）。
 * calculationChain 为真实计算链：元会运世换算 + 五级卦推导。
 */
export function buildHuangjiEvidence({ baseYear, elapsed, positions, cascade, hx }) {
  const p = positions;
  const govBlock = Math.floor(elapsed / 2160);
  const yunIndex = Math.floor(elapsed / 360) + 1;
  const blockInYun = Math.floor((elapsed - (yunIndex - 1) * 360) / 60);
  const blockInSixty = Math.floor((elapsed - ((yunIndex - 1) * 360 + blockInYun * 60)) / 10);
  return {
    key: 'huangji:evidence',
    status: '已计算',
    calculationChain: [
      `上元甲子起于公元前 67017 年（无公元 0 年）；${baseYear} 已积 ${elapsed} 年`,
      `元 = floor(${elapsed}/129600)+1 = ${p.yuan}（${p.position.yuan.startYear}–${p.position.yuan.endYear}）`,
      `会 = floor(元内/${p.offsetHui + 1}…) = ${p.hui}（${HUANGJI_HUI_BRANCH[p.hui - 1]}会，${p.position.hui.startYear}–${p.position.hui.endYear}）`,
      `运 = ${p.yunInYuan}（元内 ${p.yunInHui}，${p.position.yun.startYear}–${p.position.yun.endYear}）；世 = ${p.shiInYuan}（${p.position.shi.startYear}–${p.position.shi.endYear}）`,
      `统卦 = 60值年序[(28 + ${govBlock}) mod 60] = ${cascade.governing}（${cascade.govStart}–${cascade.govEnd}，2160 年）`,
      `运卦 = 统卦${cascade.governing} 变第 ${cascade.yunLine} 爻 = ${cascade.yunHex}（${cascade.yunStart}–${cascade.yunEnd}，360 年）`,
      `六十卦 = 运卦${cascade.yunHex} × 60块序 ${blockInYun} 查表 = ${cascade.sixty}（${cascade.sixtyStart}–${cascade.sixtyEnd}）`,
      `十年卦 = 六十卦${cascade.sixty} 变第 ${cascade.decadeLine} 爻 = ${cascade.decade}（块内 ${blockInSixty}）`,
      `值年卦 = 60值年序[${HUANGJI_CYCLE_INDEX[cascade.sixty]} + ${elapsed % 60} mod 60] = ${cascade.annual}（${yearGanZhi(baseYear)}）`,
    ],
    sources: HUANGJI_SOURCES,
    methodology: [
      '按《皇极经世》元会运世纪年：1元=12会=360运=4320世=129600年，历法纯计算、无星历依赖。',
      '五级卦级联：统卦（2160 年）→ 运卦（360 年）→ 六十卦（60 年）→ 十年卦（10 年）→ 值年卦（1 年），逐级由父卦变爻/查表推出。',
      '值年卦 60 序为先天圆图剔四正卦（乾坤坎离）之通行排法，1984（甲子）锚定鼎卦。',
    ],
    limitations: [
      '值年卦描述年度公共时势取象，个人事项需结合现实背景分析。',
      '公元纪年按无公元0年的连续年序换算，跨公元前后边界时已作校正。',
      '五级卦级联与值年卦 60 序以黑盒对拍实测与旧实现一致为准（口径见 src/rules/huangji.js）。',
    ],
    primaryFacts: [
      `元会运世：元 ${p.yuan} / 会 ${p.hui}（${HUANGJI_HUI_BRANCH[p.hui - 1]}会）/ 运 ${p.yunInYuan} / 世 ${p.shiInYuan}`,
      `值年卦 ${cascade.annual}（${yearGanZhi(baseYear)}）`,
      `统卦 ${cascade.governing} → 运卦 ${cascade.yunHex} → 六十卦 ${cascade.sixty} → 十年卦 ${cascade.decade}`,
    ],
    supportingFacts: [
      `已积 ${elapsed} 年（无 0 年口径）`,
      `会支 ${HUANGJI_HUI_BRANCH[p.hui - 1]}；各级起止年 ${p.position.hui.startYear}–${p.position.hui.endYear} / ${p.position.yun.startYear}–${p.position.yun.endYear} / ${p.position.shi.startYear}–${p.position.shi.endYear}`,
      `互卦 ${mutualHexagram(cascade.annual)}、错卦 ${oppositeHexagram(cascade.annual)}、综卦 ${reversedHexagram(cascade.annual)}`,
    ],
    summaryFact: {
      promptText: `公元${baseYear}年（${yearGanZhi(baseYear)}）处${HUANGJI_HUI_BRANCH[p.hui - 1]}会（运${p.yunInYuan}世${p.shiInYuan}），值年卦为${hxFull(cascade.annual).name}，承${cascade.sixty}六十年统卦与${cascade.decade}十年卦之卦气。`,
    },
  };
}

/** 皇极经世（自研内核）。 */
export function calculateHuangjiJingshiCore(params) {
  const normalized = normalizeInput(params);
  const now = params && params.now instanceof Date ? params.now : new Date();

  // 值年基准年：year 模式 = 传入年；datetime 模式 = 皇极年对应公历年
  let baseYear;
  let hc = null;
  if (normalized.mode === 'year') {
    baseYear = normalized.year;
  } else {
    hc = resolveHuangjiCalendar(normalized.wall);
    baseYear = hc.annualYear;
  }

  const elapsed = elapsedYears(baseYear);
  const positions = resolvePositions(elapsed);
  const cascade = resolveHexagramCascade(elapsed);
  const annualName = cascade.annual;

  const input = {
    mode: normalized.mode === 'year' ? '通行公元年' : '年月日时',
    calendar: '公元纪年（无公元0年）',
    epochYear: HUANGJI_EPOCH_YEAR,
    year: baseYear,
    elapsedYears: elapsed,
  };

  const hx = cascadeObject(cascade, baseYear);
  const related = {
    mutual: hxFull(mutualHexagram(annualName)),
    opposite: hxFull(oppositeHexagram(annualName)),
    reversed: hxFull(reversedHexagram(annualName)),
  };

  const yearLabel = baseYear > 0 ? `公元${baseYear}年` : `公元前${-baseYear}年`;
  const aFull = hxFull(annualName);
  const huiBranch = HUANGJI_HUI_BRANCH[positions.hui - 1];
  const decadeName = hx.decade.hexagram.shortName;
  const reading = {
    headline: `${yearLabel}（${yearGanZhi(baseYear)}）值年卦为${aFull.name}`,
    cycleContext: `${huiBranch}会，${hx.governing.hexagram.shortName}统卦、${hx.yun.hexagram.shortName}运卦、${hx.sixtyYear.hexagram.shortName}六十年统卦、${decadeName}十年卦`,
    annualFocus: `${aFull.upper}上${aFull.lower}下；卦辞：${aFull.judgment}`,
    interpretationOrder: [
      `以${aFull.shortName}值年卦为目标年的主要取象`,
      `以${decadeName}十年卦和${hx.sixtyYear.hexagram.shortName}六十年统卦说明当前阶段`,
      `以${hx.yun.hexagram.shortName}运卦和${hx.governing.hexagram.shortName}统卦说明长期背景`,
      '以互卦、错卦、综卦补充过程、对照与换位观察',
    ],
  };
  const eraTrend = eraTrendOf(annualName, decadeName);

  const limitations = normalized.mode === 'year'
    ? ['值年卦描述年度公共时势取象，个人事项需结合现实背景分析。', '公元纪年按无公元0年的连续年序换算，跨公元前后边界时已作校正。']
    : ['值年卦描述年度公共时势取象，个人事项需结合现实背景分析。', '公元纪年按无公元0年的连续年序换算，跨公元前后边界时已作校正。', '年月日时层以冬至为年界，并将每个节气映射为十五个皇极日；实际节气超过十五日的尾段沿用第十五日位置。', '年月日时卦用于具体时点取象，长期背景仍以元会运世、统卦、运卦、十年卦和值年卦为准。'];

  const result = {
    input,
    position: { ...positions.position, year: { coordinate: baseYear, indexInShi: positions.position.year.indexInShi, indexInYuan: positions.position.year.indexInYuan } },
    progress: positions.progress,
    conversion: HUANGJI_CONVERSION,
    limitations,
    forecast: {
      model: HUANGJI_MODEL,
      hui: { indexInYuan: positions.hui, branch: huiBranch, startYear: positions.position.hui.startYear, endYear: positions.position.hui.endYear },
      hexagrams: hx,
      relatedHexagrams: related,
      reading,
    },
    eraTrend,
  };

  // 证据层（自研，被 stripInternal 剥离；供 server 投影证据链展示）
  result.evidenceAnalysis = buildHuangjiEvidence({ baseYear, elapsed, positions, cascade, hx });
  // server 投影兼容：huangji 分支读**顶层** calculationChain/sources/limitations（与旧实现同层；
  // calculationChain/sources 在 strip 清单内，投影在剥离前读取）
  result.calculationChain = result.evidenceAnalysis.calculationChain;
  result.sources = result.evidenceAnalysis.sources;

  if (normalized.mode === 'datetime') {
    const wall = normalized.wall;
    const monthJ = huangjiChangeLine(annualName, Math.ceil(hc.monthIndex / 2));
    const xunLine = Math.ceil(hc.dayOfMonth / 10) + (hc.monthIndex % 2 === 0 ? 3 : 0);
    const xun = huangjiChangeLine(monthJ, xunLine);
    const dailyOffset = mod((hc.monthIndex - 1) * 30 + (hc.dayOfMonth - 1), 60);
    const daily = HUANGJI_YEAR_CYCLE[mod(cyclePosOrFallback(monthJ) + dailyOffset, 60)];
    const hourJ = huangjiChangeLine(daily, hc.hourSegment);
    result.dateTimeForecast = {
      model: '黄畿分形同构年月日时推衍',
      civilTime: {
        dateTime: `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)} ${pad2(wall.hour)}:${pad2(wall.minute)}`,
        timezone: '北京时间（UTC+8）',
        year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute,
      },
      calendar: {
        forecastYear: hc.annualYear,
        activeSolarTerm: hc.activeSolarTerm,
        actualDayInSolarTerm: hc.actualDayInSolarTerm,
        mappedDayInSolarTerm: hc.mappedDayInSolarTerm,
        monthIndex: hc.monthIndex,
        monthBranch: hc.monthBranch,
        dayOfMonth: hc.dayOfMonth,
        dayOfYear: hc.dayOfYear,
        hourSegment: hc.hourSegment,
        hourRange: hc.hourRange,
      },
      hexagrams: {
        annual: { ...hxFull(annualName), year: baseYear, ganzhi: yearGanZhi(baseYear) },
        monthJing: { ...hxFull(monthJ), derivedFrom: annualName, changedLine: Math.ceil(hc.monthIndex / 2) },
        xunWei: { ...hxFull(xun), derivedFrom: monthJ, changedLine: xunLine },
        daily: { ...hxFull(daily), derivedFrom: monthJ, sequenceOffset: dailyOffset },
        hourJing: { ...hxFull(hourJ), derivedFrom: daily, changedLine: hc.hourSegment },
      },
      limitations: [
        '年月日时层以冬至为年界，并将每个节气映射为十五个皇极日；实际节气超过十五日的尾段沿用第十五日位置。',
        '年月日时卦用于具体时点取象，长期背景仍以元会运世、统卦、运卦、十年卦和值年卦为准。',
      ],
    };
    // dateTimeForecast 内同法补证据链（黄畿层推导）
    result.dateTimeForecast.evidenceAnalysis = {
      key: 'huangji:datetime:evidence',
      status: '已计算',
      calculationChain: [
        `以冬至为年界：${wall.year}-${pad2(wall.month)}-${pad2(wall.day)} 位于皇极年 [冬至 ${hc.annualYear - 1}, 冬至 ${hc.annualYear})，对应公历年 ${hc.annualYear}`,
        `当前节气 ${hc.activeSolarTerm}（当气第 ${hc.actualDayInSolarTerm} 日，映射 ${hc.mappedDayInSolarTerm} 日）；月序 ${hc.monthIndex}（${hc.monthBranch}月），皇极日 dom=${hc.dayOfMonth}，doy=${hc.dayOfYear}`,
        `月卦 = 值年卦${annualName} 变 ceil(${hc.monthIndex}/2)=${Math.ceil(hc.monthIndex / 2)} 爻 = ${monthJ}`,
        `旬纬卦 = 月卦${monthJ} 变 ${xunLine} 爻 = ${xun}`,
        `日卦 = W60[${monthJ}位 + ${dailyOffset}] = ${daily}`,
        `时卦 = 日卦${daily} 变 时段 ${hc.hourSegment} 爻 = ${hourJ}`,
      ],
      sources: HUANGJI_SOURCES,
      limitations: [
        '年月日时层以冬至为年界，并将每个节气映射为十五个皇极日；实际节气超过十五日的尾段沿用第十五日位置。',
        '年月日时卦用于具体时点取象，长期背景仍以元会运世、统卦、运卦、十年卦和值年卦为准。',
      ],
    };
    // dateTimeForecast 内同法：顶层 calculationChain/sources 与 evidenceAnalysis 同源（server 投影兼容）
    result.dateTimeForecast.calculationChain = result.dateTimeForecast.evidenceAnalysis.calculationChain;
    result.dateTimeForecast.sources = result.dateTimeForecast.evidenceAnalysis.sources;
  }

  result.meta = {
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    algorithm: 'huangji',
    calculatedAt: now.toISOString(),
    inputHash: `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`,
    resultId: `huangji:${fnv1aHash(stableStringify(normalized.hashInput))}`,
  };
  return result;
}

export default calculateHuangjiJingshiCore;
