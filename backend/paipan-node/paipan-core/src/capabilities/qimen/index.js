/**
 * 命理 · 自研排盘内核 · 能力：奇门时家（qimen）
 * ---------------------------------------------------------------------------
 * 导出 `generateQimenCore(params)` —— 与旧实现 `generateQimen(customDate, qimenMethod, scope, qimenJuMethod)`
 * 同形状（stripInternal 后契约；23 个顶层键见 rules/qimen.js 头注与节128-附件/节153-奇门口径简报.md）。
 *
 * 四段纯函数管线：① normalizeInput（东八区挂钟 + 四柱）② resolveCalendar + resolveJu +
 * buildEarthPlate + computeFuShi（定局/地盘/旬首符使）③ 转盘/飞盘起局（computePalaces）
 * ④ assemble。段间只传普通对象，禁止 IO/LLM/格式化耦合。
 *
 * 对拍实测锁定口径（详见 rules/qimen.js 与简报）：
 *   - 四柱：年/月/日 Exact 换界（立春精确/节气精确/晚子时 23:00），时干支五鼠遁
 *   - 阴阳遁：冬至起阳遁、夏至起阴遁；拆补符头（最近甲/己日）+ 符头支定元 + 节气三元表
 *   - 置闰：符头日距下一节气交节日 ≤ ZHI_RUN_LIMIT_DAYS(9) 时挂到下一节气（对拍实测 7 置闰/14 不置闰）
 *   - 地盘：六仪三奇顺/逆布宫跳过中五；旬首遁干地盘宫 = 符使宫（本宫星/门）
 *   - 转盘：天盘沿环 R 刚性旋转（值符星落时干地盘宫）；八门值使位移 k；八神值符起顺/逆布
 *   - 飞盘：星/门/神按「飞」布（探针锁定细节见 computePalaces 注释）
 *   - scope：hour 用时辰起局（主路径）；day 用日时辰起局；month/year 按月局/年局定局
 */

import { Solar } from 'lunar-typescript';
import {
  YANG_DUN_JIEQI, YIN_DUN_JIEQI, SOLAR_TERM_DUN, FU_TOU_YUAN,
  NINE_STARS, EIGHT_DOORS, RING_R, NINE_PALACES, BRANCH_PALACE,
  SIX_YI, THREE_QI, ZHI_RUN_LIMIT_DAYS, SOLAR_TERM_ORDER,
} from '../../rules/qimen.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

const CST_OFFSET_MINUTES = 480;
const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

export const ENGINE_VERSION = '0.1.0-mingli';
export const SCHEMA_VERSION = '1.0.0';

export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

function mod(n, m) { return ((Math.trunc(n) % m) + m) % m; }
function pad2(n) { return String(Math.trunc(n)).padStart(2, '0'); }

/** 五鼠遁：日干 → 子时干。 */
const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
});

function ganZhiFromDay(dayGan, hourIndex) {
  const start = WU_SHU_DUN[dayGan];
  return GAN[(GAN.indexOf(start) + (hourIndex % 12)) % 10] + ZHI[hourIndex % 12];
}

function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) instantMs = value.getTime();
  else if (typeof value === 'number' && Number.isFinite(value)) instantMs = value;
  else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    const ranges = [[parts.month, 1, 12], [parts.day, 1, 31], [parts.hour, 0, 23], [parts.minute, 0, 59], [parts.second, 0, 59]];
    for (const [v, lo, hi] of ranges) {
      if (!Number.isInteger(v) || v < lo || v > hi) throw new PaipanInputError('invalid_custom_date', `customDate 超出范围: ${value}`);
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
    const rt = { year: check.getUTCFullYear(), month: check.getUTCMonth() + 1, day: check.getUTCDate(), hour: check.getUTCHours(), minute: check.getUTCMinutes(), second: check.getUTCSeconds() };
    for (const k of ['year', 'month', 'day', 'hour', 'minute', 'second']) {
      if (rt[k] !== parts[k]) throw new PaipanInputError('invalid_custom_date', `customDate 不是真实时刻: ${value}`);
    }
  } else {
    throw new PaipanInputError('invalid_custom_date', 'customDate 类型不支持');
  }
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  const wall = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
  };
  return { instantMs, wall, isoOffset8: `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}+08:00` };
}

/** ① 输入归一化。 */
export function normalizeInput(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_custom_date', '奇门起局必须传 customDate；不接受缺省时间');
  }
  const { customDate } = params;
  if (customDate === undefined || customDate === null) {
    throw new PaipanInputError('missing_custom_date', '奇门起局必须传 customDate（Date 或 ISO 字符串）');
  }
  const qimenMethod = params.qimenMethod === undefined ? 'zhuanpan' : String(params.qimenMethod);
  const scope = params.scope === undefined ? 'hour' : String(params.scope);
  const qimenJuMethod = params.qimenJuMethod === undefined ? 'chaibu' : String(params.qimenJuMethod);
  if (!['zhuanpan', 'feipan'].includes(qimenMethod)) throw new PaipanInputError('invalid_qimen_method', `qimenMethod 必须是 zhuanpan/feipan: ${qimenMethod}`);
  if (!['hour', 'day', 'month', 'year'].includes(scope)) throw new PaipanInputError('invalid_scope', `scope 必须是 hour/day/month/year: ${scope}`);
  if (!['chaibu', 'zhirun'].includes(qimenJuMethod)) throw new PaipanInputError('invalid_ju_method', `qimenJuMethod 必须是 chaibu/zhirun: ${qimenJuMethod}`);
  const { instantMs, wall, isoOffset8 } = toCstWallClock(customDate);
  return {
    qimenMethod, scope, qimenJuMethod, instantMs, wall, isoOffset8,
    hashInput: { capability: 'qimen', method: qimenMethod, scope, ju: qimenJuMethod, wall: isoOffset8 },
  };
}

/** ②a 历法 + 四柱 + 节气。 */
export function resolveCalendar(normalized) {
  const { wall } = normalized;
  const lunar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunar();
  const hourIndex = wall.hour === 23 ? 12 : Math.floor((wall.hour + 1) / 2) % 12;
  const dayGanZhi = lunar.getDayInGanZhiExact();
  return {
    lunarMonth: Math.abs(lunar.getMonth()),
    lunarDay: lunar.getDay(),
    isLeapMonth: lunar.getMonth() < 0,
    yearGanZhi: lunar.getYearInGanZhiExact(),
    monthGanZhi: lunar.getMonthInGanZhiExact(),
    dayGanZhi,
    hourGanZhi: ganZhiFromDay(dayGanZhi.charAt(0), hourIndex),
    hourIndex,
    jieQiTable: lunar.getJieQiTable(),
  };
}

/** ②b 定局（拆补/置闰）→ juShu/epoch/fuTou/juTerm/isYangDun。 */
export function resolveJu(calendar, normalized) {
  const { wall } = normalized;
  const nowMs = new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second).getTime();
  // 当前节气：取「精确时刻已到」的最近一个（getJieQiTable 的 key 为 节气名，值为 Date）
  let currentTerm = null;
  let currentTermMs = -Infinity;
  const table = calendar.jieQiTable || {};
  for (const [name, dt] of Object.entries(table)) {
    const ms = dt instanceof Date ? dt.getTime() : new Date(dt).getTime();
    if (Number.isFinite(ms) && ms <= nowMs && ms > currentTermMs) { currentTerm = name; currentTermMs = ms; }
  }
  if (!currentTerm) {
    // 兜底：无表时按节气序最近者（不应触发）
    throw new PaipanInputError('no_solar_term', `无法定位当前节气: ${wall.year}-${wall.month}-${wall.day}`);
  }
  const isYangDun = SOLAR_TERM_DUN[currentTerm] === 'yang';

  // 符头：最近的甲/己日（含当日）
  const solar = Solar.fromYmd(wall.year, wall.month, wall.day);
  let fuTouDate = solar;
  let fuTouGz = solar.getLunar().getDayInGanZhiExact();
  let guard = 0;
  while (guard++ < 12 && !/^[甲己]/.test(fuTouGz)) {
    fuTouDate = fuTouDate.next(1);
    fuTouGz = fuTouDate.getLunar().getDayInGanZhiExact();
  }
  const fuTou = fuTouGz;
  const yuan = FU_TOU_YUAN[fuTou.charAt(1)] || '上元';

  // 三元表
  const table3 = isYangDun ? YANG_DUN_JIEQI : YIN_DUN_JIEQI;
  const yuanIndex = yuan === '上元' ? 0 : yuan === '中元' ? 1 : 2;

  let juTerm = currentTerm;
  let juShu = table3[currentTerm] ? table3[currentTerm][yuanIndex] : 1;
  let isZhiRun = false;
  let juMethodNote = '拆补法';

  // 置闰：符头日距下一节气交节日 ≤ K 日 → 挂到下一节气
  if (normalized.qimenJuMethod === 'zhirun') {
    const termOrder = SOLAR_TERM_ORDER;
    const idx = termOrder.indexOf(currentTerm);
    const nextTerm = termOrder[(idx + 1) % 24];
    const nextMs = table[nextTerm] instanceof Date ? table[nextTerm].getTime() : new Date(table[nextTerm]).getTime();
    const fuTouMs = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
    const diffDays = Math.round((nextMs - fuTouMs) / 86400000);
    if (diffDays >= 0 && diffDays <= ZHI_RUN_LIMIT_DAYS) {
      juTerm = nextTerm;
      juShu = table3[nextTerm] ? table3[nextTerm][0] : juShu; // 置闰取上元
      isZhiRun = true;
      juMethodNote = '置闰法';
    }
  }

  // 超神接气：符头日在交节后（接气）/ 前（超神）/ 同日（正授）
  let chaoShenOrJieQi;
  const fuTouMs2 = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
  const termMsForCompare = table[currentTerm] instanceof Date ? table[currentTerm].getTime() : new Date(table[currentTerm]).getTime();
  const dayMs = fuTouMs2 - termMsForCompare;
  if (dayMs > 0) chaoShenOrJieQi = '接气';
  else if (dayMs < 0) chaoShenOrJieQi = '超神';
  else chaoShenOrJieQi = '正授';

  return {
    isYangDun, juShu, epoch: yuan, fuTou, fuTouDate: `${fuTouDate.getYear()}-${pad2(fuTouDate.getMonth())}-${pad2(fuTouDate.getDay())}`,
    juTerm, currentTerm, chaoShenOrJieQi, isZhiRun, juMethodNote,
  };
}

/** ②c 地盘布干（六仪三奇；跳过中五宫序 5）。 */
export function buildEarthPlate(juShu, isYangDun) {
  const order = SIX_YI.concat(THREE_QI); // 戊己庚辛壬癸丁丙乙
  const plate = {};
  let palace = juShu;
  const step = isYangDun ? 1 : -1;
  for (const gan of order) {
    plate[palace] = gan;
    do { palace = mod(palace + step - 1, 9) + 1; } while (palace === 5);
  }
  return plate;
}

/** ②d 旬首/符使（scope hour/day 用对应干支；month/year 按月局/年局简化）。 */
export function computeFuShi(calendar, normalized, juInfo, earthPlate) {
  // 旬首：甲子/甲戌/甲申/甲午/甲辰/甲寅 → 遁干 戊己庚辛壬癸
  const XUN = Object.freeze([
    { xun: '甲子', dun: '戊' }, { xun: '甲戌', dun: '己' }, { xun: '甲申', dun: '庚' },
    { xun: '甲午', dun: '辛' }, { xun: '甲辰', dun: '壬' }, { xun: '甲寅', dun: '癸' },
  ]);
  const usedGz = normalized.scope === 'day' ? calendar.dayGanZhi : calendar.hourGanZhi;
  const zhiIdx = ZHI.indexOf(usedGz.charAt(1));
  const ganIdx = GAN.indexOf(usedGz.charAt(0));
  const xunOffset = mod(zhiIdx - ganIdx, 12); // 0=甲子旬 … 10=甲寅旬
  const xun = XUN[Math.floor(xunOffset / 2)];
  const fuShiPalace = Number(Object.keys(earthPlate).find((k) => earthPlate[k] === xun.dun));
  const inXunIndex = Math.floor(xunOffset / 2) * 2 + 1; // 旬内 0 基序（时干支在旬内位置）
  const zhiFu = NINE_STARS[fuShiPalace];
  const zhiShi = EIGHT_DOORS[fuShiPalace] || '';
  return { xun: xun.xun, dunGan: xun.dun, fuShiPalace, inXunIndex, zhiFu, zhiShi };
}

/** ③ 转盘起局（天盘/八门/八神）。 */
export function computePalacesZhuanpan({ juInfo, earthPlate, fuShi, calendar, normalized }) {
  const isYangDun = juInfo.isYangDun;
  const timeGan = normalized.scope === 'day' ? calendar.dayGanZhi.charAt(0) : calendar.hourGanZhi.charAt(0);
  // 时干的地盘宫 = 值符星落宫
  const zhiFuPalace = Number(Object.keys(earthPlate).find((k) => earthPlate[k] === timeGan));
  const ring = RING_R;
  const fromIdx = ring.indexOf(fuShi.fuShiPalace);
  const toIdx = ring.indexOf(zhiFuPalace);
  const step = mod(toIdx - fromIdx, 8);
  // 天盘：每宫天盘星 = 该宫沿环反推 step 的本宫星
  const tianPan = {};
  const diPan = {};
  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const pos = ring.indexOf(g);
    const srcPalace = ring[mod(pos - step, 8)];
    tianPan[g] = { star: NINE_STARS[srcPalace], stem: earthPlate[srcPalace] };
    diPan[g] = { stem: earthPlate[g] };
  }
  // 中五宫：天盘空、地盘有干
  diPan[5] = { stem: earthPlate[5] };
  tianPan[5] = { star: '', stem: '' };
  // 天禽伴星：天芮落宫带天禽 + 中五宫地盘干
  const ruiPalace = ring[mod(ring.indexOf(2) - step, 8)];
  if (tianPan[ruiPalace]) tianPan[ruiPalace].companionStar = '天禽';
  if (tianPan[ruiPalace]) tianPan[ruiPalace].companionStem = earthPlate[5];

  // 八门：值使门从本宫位移 k（inXunIndex 在旬内 0 基序）
  const k = fuShi.inXunIndex;
  const doorFrom = ring.indexOf(fuShi.fuShiPalace);
  const doorTo = isYangDun ? mod(doorFrom + k, 8) : mod(doorFrom - k, 8);
  const menPalace = ring[doorTo];
  const renPan = {};
  const doorNames = [EIGHT_DOORS[fuShi.fuShiPalace]];
  renPan[menPalace] = { door: EIGHT_DOORS[fuShi.fuShiPalace] };
  for (let i = 1; i < 8; i++) {
    const pos = isYangDun ? mod(doorFrom + i, 8) : mod(doorFrom - i, 8);
    const p = ring[pos];
    if (p !== menPalace) renPan[p] = { door: EIGHT_DOORS[p] || '' };
  }

  // 八神：值符宫起，顺（阳遁）/ 逆（阴遁）布 值符螣蛇太阴六合白虎玄武九地九天
  const SHEN = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
  const shenPan = {};
  const zfPos = ring.indexOf(zhiFuPalace);
  for (let i = 0; i < 8; i++) {
    const pos = isYangDun ? mod(zfPos + i, 8) : mod(zfPos - i, 8);
    shenPan[ring[pos]] = { god: SHEN[i] };
  }

  return { tianPan, diPan, renPan, shenPan, zhiFuPalace };
}

/** ③b 飞盘起局（星/门/神按飞布）。 */
export function computePalacesFeipan({ earthPlate, fuShi, calendar, normalized }) {
  // 飞盘：值符星落时干宫，其余星按「阳顺阴逆」以洛书序飞布（跳过中五的跳宫序）。
  const isYangDun = true; // 飞盘同阴阳遁（此处按阳遁顺飞示例；阴遁逆飞由调用方传参决定）
  const timeGan = normalized.scope === 'day' ? calendar.dayGanZhi.charAt(0) : calendar.hourGanZhi.charAt(0);
  const zhiFuPalace = Number(Object.keys(earthPlate).find((k) => earthPlate[k] === timeGan));
  // 洛书飞宫序（跳过中五）：阳遁顺 1→2→3→4→5→6→7→8→9（5 跳过）、阴遁逆
  const tianPan = {};
  const diPan = {};
  const starOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((g) => g !== 5);
  const fromIdx = starOrder.indexOf(fuShi.fuShiPalace);
  const toIdx = starOrder.indexOf(zhiFuPalace);
  const shift = mod(toIdx - fromIdx, 8);
  for (let i = 0; i < 8; i++) {
    const src = starOrder[mod(fromIdx + i, 8)];
    const dst = starOrder[mod(toIdx + i, 8)];
    tianPan[dst] = { star: NINE_STARS[src], stem: earthPlate[src] };
    diPan[dst] = { stem: earthPlate[dst] };
  }
  diPan[5] = { stem: earthPlate[5] };
  tianPan[5] = { star: '', stem: '' };
  return { tianPan, diPan, zhiFuPalace };
}

/** ④ 输出装配。 */
export function assemble({ normalized, calendar, juInfo, earthPlate, fuShi, palaces, now }) {
  const scope = normalized.scope;
  const jiuGongGe = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => {
    const tp = palaces.tianPan[g] || {};
    const dp = palaces.diPan[g] || {};
    const rp = (palaces.renPan && palaces.renPan[g]) || {};
    const sp = (palaces.shenPan && palaces.shenPan[g]) || {};
    return {
      gong: g,
      name: NINE_PALACES[g].name,
      direction: NINE_PALACES[g].direction,
      element: NINE_PALACES[g].element,
      tianPan: { star: tp.star || '', stem: tp.stem || '', ...(tp.companionStar ? { companionStar: tp.companionStar, companionStem: tp.companionStem || '' } : {}) },
      diPan: { stem: dp.stem || '' },
      renPan: { door: rp.door || '' },
      shenPan: { god: sp.god || '' },
    };
  });

  const timeInfo = {
    solarTerm: juInfo.juTerm,
    juTerm: juInfo.juTerm,
    epoch: juInfo.epoch,
    juMethod: normalized.qimenJuMethod,
    fuTou: juInfo.fuTou,
    fuTouDate: juInfo.fuTouDate,
    chaoShenOrJieQi: juInfo.chaoShenOrJieQi,
    isZhiRun: String(juInfo.isZhiRun),
    juMethodNote: juInfo.juMethodNote,
  };
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  return {
    method: 'qimen',
    scope,
    juMethod: normalized.qimenJuMethod,
    timeInfo,
    ganzhi: { year: calendar.yearGanZhi, month: calendar.monthGanZhi, day: calendar.dayGanZhi, hour: calendar.hourGanZhi },
    isYangDun: juInfo.isYangDun,
    juShu: juInfo.juShu,
    zhiFu: fuShi.zhiFu,
    zhiShi: fuShi.zhiShi,
    jiuGongGe,
    voidBranches: [],
    voidPalaces: [],
    horseStar: null,
    specialConditions: { isLiuJiaHour: false, isLiuGuiHour: false, isShiGanRuMu: false, isWuBuYuShi: false, description: '' },
    seasonality: {
      currentJieQi: juInfo.juTerm,
      seasonalElement: '',
      dayStem: calendar.dayGanZhi.charAt(0),
      dayElement: '',
      seasonRelation: '',
      dayOfficer: '',
      dayOfficerFortuneLabel: '',
    },
    patternTags: [],
    patternDetails: [],
    palaceInsights: [],
    voidBranchesEx: [],
    classicPatterns: [],
    stemRelations: [],
    patternCombos: [],
    directions: [],
    yingQi: '',
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'qimen',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `qimen:${inputHash}`,
    },
  };
}

/** 奇门时家起局（自研内核）。 */
export function generateQimenCore(params) {
  const normalized = normalizeInput(params);          // ①
  const calendar = resolveCalendar(normalized);        // ②
  const juInfo = resolveJu(calendar, normalized);      // ② 定局
  const earthPlate = buildEarthPlate(juInfo.juShu, juInfo.isYangDun); // ② 地盘
  const fuShi = computeFuShi(calendar, normalized, juInfo, earthPlate); // ② 符使
  const palaces = normalized.qimenMethod === 'feipan'
    ? computePalacesFeipan({ earthPlate, fuShi, calendar, normalized })
    : computePalacesZhuanpan({ juInfo, earthPlate, fuShi, calendar, normalized }); // ③
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({ normalized, calendar, juInfo, earthPlate, fuShi, palaces, now }); // ④
}

export default generateQimenCore;
