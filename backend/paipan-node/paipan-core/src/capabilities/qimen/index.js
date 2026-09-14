/**
 * 命理 · 自研排盘内核 · 能力：奇门时家（qimen）
 * ---------------------------------------------------------------------------
 * 导出 `generateQimenCore(params)` —— 与旧实现 `generateQimen(customDate, qimenMethod, scope, qimenJuMethod)`
 * 同形状（stripInternal 后契约；23 个顶层键见 rules/qimen.js 头注与节128-附件/节153-奇门口径简报.md）。
 *
 * 四段纯函数管线：① normalizeInput（东八区挂钟 + 四柱）② resolveCalendar + resolveJu +
 * buildEarthPlate + computeFuShi（定局/地盘/旬首符使）③ 转盘/飞盘起局（computePalaces*）
 * ④ assemble（含 seasonality / specialConditions / 空亡马星 / 释义层）。段间只传普通对象。
 *
 * 对拍实测锁定口径（2024-06-15 10:30 锚点：阳遁6局·上元·天柱·惊门；详见 rules/qimen.js 与简报）：
 *   - 四柱：年/月/日 Exact 换界（立春精确/节气精确/晚子时 23:00），时干支五鼠遁
 *   - 拆补：符头 = 最近一个 ≤ 当日 的甲/己日；符头支定元；节气三元表定局
 *   - 置闰：符头日距下一节气交节日 ≤ K(9) 日 → juTerm 挂到下一节气（取符头元）；
 *     chaoShenOrJieQi 恒为「超神」；solarTerm 仍为真实当前节气
 *   - 月局（scope=month）：月支定局 阳遁寅1..未6 / 阴遁申4..丑8；epoch=「月局」
 *   - 年局（scope=year）：三元九运 上阳/中阴/下阳；局数=年干旬内序+1（10 折 1）
 *   - 地盘：六仪三奇阳顺/阴逆**九宫全走**（含中五）
 *   - 转盘：天盘沿环 R 刚性旋转（值符星 → 时干地盘宫）；八门值使沿洛书数顺/逆飞 k 步
 *     （中五落宫寄坤二），其余门沿环 R 同位移刚体旋转；八神值符起顺/逆布
 *   - 飞盘：星沿洛书序顺飞（阳遁星序 +1 / 阴遁 -1）含中五；门/神同转盘
 *   - 甲时（时干=甲）：值符星留旬首宫（天盘伏吟），值符神起旬首宫
 *   - scope hour/day/month/year：用对应级干支定符使/位移/空亡/马星
 *   - seasonality / specialConditions / 空亡马星：结构字段全对齐；白话/释义层自撰（§5 门禁外）
 */

import { Solar } from 'lunar-typescript';
import {
  YANG_DUN_JIEQI, YIN_DUN_JIEQI, SOLAR_TERM_DUN, FU_TOU_YUAN,
  NINE_STARS, EIGHT_DOORS, RING_R, NINE_PALACES, BRANCH_PALACE,
  SIX_YI, THREE_QI, ZHI_RUN_LIMIT_DAYS, SOLAR_TERM_ORDER,
  MONTH_JU, MONTH_DUN, YEAR_DUN_BY_EPOCH, yearEpoch, yearJuFromGanIndex,
  TERM_ELEMENT, GAN_ELEMENT, ZHI_ELEMENT, ELEMENT_RELATION, SEASON_RELATION_LABEL,
  JIAN_CHU, JIAN_CHU_LABEL, GAN_MU, YI_MA, TERM_MONTH_ZHI,
  SIX_HE, SIX_CHONG, XIANG_HAI, XIANG_XING, GAN_CHONG, GAN_HE, BAN_HE_GROUPS,
  EIGHT_GODS, GAN_KEDING,
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

/** 旬首映射：xunOffset（0 子 / 2 寅 / 4 辰 / 6 午 / 8 申 / 10 戌）→ {旬名, 遁干}。 */
const XUN_TABLE = Object.freeze([
  { xun: '甲子', dun: '戊' }, { xun: '甲寅', dun: '癸' }, { xun: '甲辰', dun: '壬' },
  { xun: '甲午', dun: '辛' }, { xun: '甲申', dun: '庚' }, { xun: '甲戌', dun: '己' },
]);

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

/** ②a 历法 + 四柱 + 节气表。 */
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

/** 当前节气：取「精确时刻已到」的最近一个。返回 {name, ms}。 */
function currentTermInfo(calendar, wall) {
  const nowMs = new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second).getTime();
  let name = null;
  let ms = -Infinity;
  const table = calendar.jieQiTable || {};
  for (const [termName, dt] of Object.entries(table)) {
    const t = dt instanceof Date ? dt.getTime() : new Date(dt).getTime();
    if (Number.isFinite(t) && t <= nowMs && t > ms) { name = termName; ms = t; }
  }
  if (!name) throw new PaipanInputError('no_solar_term', `无法定位当前节气: ${wall.year}-${wall.month}-${wall.day}`);
  return { name, ms };
}

/** ②b 定局（拆补/置闰 + 月局/年局）→ juShu/epoch/fuTou/juTerm/isYangDun。 */
export function resolveJu(calendar, normalized) {
  const { wall, qimenJuMethod, scope } = normalized;
  const { name: currentTerm } = currentTermInfo(calendar, wall);

  // —— 月家奇门（scope=month）：月支定局；拆补/置闰不适用 ——
  if (scope === 'month') {
    const monthZhi = calendar.monthGanZhi.charAt(1);
    return {
      isYangDun: MONTH_DUN[monthZhi] === 'yang',
      juShu: MONTH_JU[monthZhi],
      epoch: '月局',
      fuTou: '',
      fuTouDate: '',
      juTerm: currentTerm,
      currentTerm,
      chaoShenOrJieQi: '',
      isZhiRun: false,
      juMethodNote: '月家奇门使用月家定局法，拆补/置闰仅适用于时家与日家',
    };
  }

  // —— 年家奇门（scope=year）：三元九运；拆补/置闰不适用 ——
  if (scope === 'year') {
    const epoch = yearEpoch(wall.year);
    const ganIdx = GAN.indexOf(calendar.yearGanZhi.charAt(0));
    return {
      isYangDun: YEAR_DUN_BY_EPOCH[epoch] === 'yang',
      juShu: yearJuFromGanIndex(ganIdx),
      epoch,
      fuTou: '',
      fuTouDate: '',
      juTerm: currentTerm,
      currentTerm,
      chaoShenOrJieQi: '',
      isZhiRun: false,
      juMethodNote: '年家奇门使用年干与三元甲子定局，拆补/置闰仅适用于时家与日家',
    };
  }

  // —— 时家/日家（scope=hour/day）：拆补 / 置闰 ——
  const isYangDun = SOLAR_TERM_DUN[currentTerm] === 'yang';

  // 符头：最近一个 ≤ 当日 的甲/己日（含当日）
  let fuTouDate = Solar.fromYmd(wall.year, wall.month, wall.day);
  let fuTouGz = fuTouDate.getLunar().getDayInGanZhiExact();
  let guard = 0;
  while (guard++ < 60 && !/^[甲己]/.test(fuTouGz)) {
    fuTouDate = fuTouDate.next(-1);
    fuTouGz = fuTouDate.getLunar().getDayInGanZhiExact();
  }
  const fuTou = fuTouGz;
  const yuan = FU_TOU_YUAN[fuTou.charAt(1)] || '上元';

  const table3 = isYangDun ? YANG_DUN_JIEQI : YIN_DUN_JIEQI;
  const yuanIndex = yuan === '上元' ? 0 : yuan === '中元' ? 1 : 2;

  let juTerm = currentTerm;
  let juShu = table3[currentTerm] ? table3[currentTerm][yuanIndex] : 1;
  let isZhiRun = false; // 对拍口径：拆补/置闰的 isZhiRun 恒为 "false"（旧实现的「闰」仅出现在罕见的超神闰局窗口）
  let juMethodNote = `拆补法定局：${fuTou}为甲己符头，按日干支五日一元定${yuan}，不置闰`;

  // 置闰：符头日距下一节气交节日 ≤ K 日 → 该元挂到下一节气（取符头元）
  if (qimenJuMethod === 'zhirun') {
    const idx = SOLAR_TERM_ORDER.indexOf(currentTerm);
    const nextTerm = SOLAR_TERM_ORDER[(idx + 1) % 24];
    const nextMs = calendar.jieQiTable[nextTerm] instanceof Date
      ? calendar.jieQiTable[nextTerm].getTime()
      : new Date(calendar.jieQiTable[nextTerm]).getTime();
    const fuTouMs = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
    const diffDays = Math.round((nextMs - fuTouMs) / 86400000);
    if (diffDays >= 0 && diffDays <= ZHI_RUN_LIMIT_DAYS) {
      juTerm = nextTerm;
      juShu = table3[nextTerm] ? table3[nextTerm][yuanIndex] : juShu;
      juMethodNote = `置闰法定局：${yuan}符头先于${nextTerm}交节${diffDays}个整日，为超神${yuan}`;
    }
  }

  // 超神接气：置闰模式恒为超神；拆补比较符头日与 juTerm 交节日
  let chaoShenOrJieQi;
  if (qimenJuMethod === 'zhirun') {
    chaoShenOrJieQi = '超神';
  } else {
    const fuTouMs2 = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
    const termMs = calendar.jieQiTable[juTerm] instanceof Date
      ? calendar.jieQiTable[juTerm].getTime()
      : new Date(calendar.jieQiTable[juTerm]).getTime();
    const dayMs = fuTouMs2 - termMs;
    if (dayMs > 0) chaoShenOrJieQi = '接气';
    else if (dayMs < 0) chaoShenOrJieQi = '超神';
    else chaoShenOrJieQi = '正授';
  }

  return {
    isYangDun, juShu, epoch: yuan, fuTou, fuTouDate: `${fuTouDate.getYear()}-${pad2(fuTouDate.getMonth())}-${pad2(fuTouDate.getDay())}`,
    juTerm, currentTerm, chaoShenOrJieQi, isZhiRun, juMethodNote,
  };
}

/** ②c 地盘布干：六仪三奇阳顺/阴逆，九宫全走（含中五）。 */
export function buildEarthPlate(juShu, isYangDun) {
  const order = SIX_YI.concat(THREE_QI);
  const plate = {};
  let palace = juShu;
  const step = isYangDun ? 1 : -1;
  for (const gan of order) {
    plate[palace] = gan;
    palace = mod(palace + step - 1, 9) + 1;
  }
  return plate;
}

/** ②d 旬首/符使：scope 决定用哪一级干支（hour→时、day→日、month→月、year→年）。 */
export function computeFuShi(calendar, normalized, juInfo, earthPlate) {
  const scopeGz = normalized.scope === 'hour' ? calendar.hourGanZhi
    : normalized.scope === 'day' ? calendar.dayGanZhi
      : normalized.scope === 'month' ? calendar.monthGanZhi
        : calendar.yearGanZhi;
  const ganIdx = GAN.indexOf(scopeGz.charAt(0));
  const zhiIdx = ZHI.indexOf(scopeGz.charAt(1));
  const xunOffset = mod(zhiIdx - ganIdx, 12); // 0子 2寅 4辰 6午 8申 10戌
  const xun = XUN_TABLE[Math.floor(xunOffset / 2)];
  const fuShiPalace = Number(Object.keys(earthPlate).find((k) => earthPlate[k] === xun.dun));
  const homePalace = fuShiPalace === 5 ? 2 : fuShiPalace; // 中五寄坤二
  const zhiFu = NINE_STARS[fuShiPalace];
  const zhiShi = EIGHT_DOORS[homePalace] || '';
  return {
    xun: xun.xun, dunGan: xun.dun, fuShiPalace, homePalace,
    k: ganIdx, scopeGz,
    zhiFu, zhiShi,
  };
}

/** 值符宫：时干地盘宫；时干为甲（无地盘位）时取旬首宫。 */
function zhiFuPalaceOf(earthPlate, fuShi, scopeGan) {
  if (scopeGan === '甲') return fuShi.fuShiPalace;
  return Number(Object.keys(earthPlate).find((k) => earthPlate[k] === scopeGan));
}

/** 值使门沿洛书数顺/逆飞 k 步（中五落宫寄坤二）。 */
function menFly(home, k, isYangDun) {
  let p = home;
  const step = isYangDun ? 1 : -1;
  for (let i = 0; i < k; i++) p = mod(p + step - 1, 9) + 1;
  return p === 5 ? 2 : p;
}

/** ③ 转盘起局（天盘/八门/八神）。 */
export function computePalacesZhuanpan({ juInfo, earthPlate, fuShi, calendar, normalized }) {
  const isYangDun = juInfo.isYangDun;
  const scopeGan = fuShi.scopeGz.charAt(0);
  const zhiFuPalace = zhiFuPalaceOf(earthPlate, fuShi, scopeGan);
  const ringTarget = zhiFuPalace === 5 ? 2 : zhiFuPalace;

  // 天盘：沿环 R 刚性旋转（值符星 本宫 → 时干宫）
  const ring = RING_R;
  const fromIdx = ring.indexOf(fuShi.homePalace);
  const toIdx = ring.indexOf(ringTarget);
  const step = mod(toIdx - fromIdx, 8);
  const tianPan = {};
  const diPan = {};
  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const pos = ring.indexOf(g);
    const srcPalace = ring[mod(pos - step, 8)];
    tianPan[g] = { star: NINE_STARS[srcPalace], stem: earthPlate[srcPalace] };
    diPan[g] = { stem: earthPlate[g] };
  }
  diPan[5] = { stem: earthPlate[5] };
  tianPan[5] = { star: '', stem: '' };
  // 天禽伴星：天芮落宫带天禽 + 中五宫地盘干
  const ruiPalace = ring[mod(ring.indexOf(2) + step, 8)];
  if (tianPan[ruiPalace]) {
    tianPan[ruiPalace].companionStar = '天禽';
    tianPan[ruiPalace].companionStem = earthPlate[5];
  }

  // 八门：值使门九宫飞布 k 步（中五寄坤二），其余门沿环 R 同位移刚体旋转
  const k = fuShi.k;
  const menLand = menFly(fuShi.homePalace, k, isYangDun);
  const d = mod(ring.indexOf(menLand) - ring.indexOf(fuShi.homePalace), 8);
  const renPan = {};
  for (let i = 0; i < 8; i++) {
    const p = ring[i];
    const src = ring[mod(i - d, 8)];
    renPan[p] = { door: EIGHT_DOORS[src] || '' };
  }
  renPan[menLand] = { door: fuShi.zhiShi || EIGHT_DOORS[2] };

  // 八神：值符宫起，顺（阳）/逆（阴）沿 R 布
  const shenPan = {};
  const zfPos = ring.indexOf(ringTarget);
  for (let i = 0; i < 8; i++) {
    const pos = isYangDun ? mod(zfPos + i, 8) : mod(zfPos - i, 8);
    shenPan[ring[pos]] = { god: EIGHT_GODS[i] };
  }

  return { tianPan, diPan, renPan, shenPan, zhiFuPalace: ringTarget };
}

/** ③b 飞盘起局（星沿洛书序飞布含中五；门/神同转盘）。 */
export function computePalacesFeipan({ juInfo, earthPlate, fuShi, normalized }) {
  const isYangDun = juInfo.isYangDun;
  const scopeGan = fuShi.scopeGz.charAt(0);
  const zhiFuPalace = zhiFuPalaceOf(earthPlate, fuShi, scopeGan);

  // 星：宫序 = 洛书顺飞从值符宫起（1→2→…→9→1）；星序 = 值符星洛书序 ±1（阳+1 阴-1）
  const zhiFuStarHome = fuShi.fuShiPalace;
  const starWalk = [];
  {
    let p = zhiFuPalace;
    for (let i = 0; i < 9; i++) { starWalk.push(p); p = mod(p, 9) + 1; }
  }
  const tianPan = {};
  const diPan = {};
  for (let i = 0; i < 9; i++) {
    const starHome = isYangDun ? mod(zhiFuStarHome - 1 + i, 9) + 1 : mod(zhiFuStarHome - 1 - i, 9) + 1;
    const g = starWalk[i];
    tianPan[g] = { star: NINE_STARS[starHome], stem: earthPlate[starHome] };
    diPan[g] = { stem: earthPlate[g] };
  }

  // 门/神：与转盘同规则
  const k = fuShi.k;
  const menLand = menFly(fuShi.homePalace, k, isYangDun);
  const ring = RING_R;
  const d = mod(ring.indexOf(menLand) - ring.indexOf(fuShi.homePalace), 8);
  const renPan = {};
  for (let i = 0; i < 8; i++) {
    const p = ring[i];
    const src = ring[mod(i - d, 8)];
    renPan[p] = { door: EIGHT_DOORS[src] || '' };
  }
  renPan[menLand] = { door: fuShi.zhiShi || EIGHT_DOORS[2] };

  const shenPan = {};
  const ringTarget = zhiFuPalace === 5 ? 2 : zhiFuPalace;
  const zfPos = ring.indexOf(ringTarget);
  for (let i = 0; i < 8; i++) {
    const pos = isYangDun ? mod(zfPos + i, 8) : mod(zfPos - i, 8);
    shenPan[ring[pos]] = { god: EIGHT_GODS[i] };
  }

  return { tianPan, diPan, renPan, shenPan, zhiFuPalace: ringTarget };
}

/** 空亡（scope 干支旬空）→ 支序两个 + 宫表。 */
export function computeVoidAndHorse(calendar, normalized) {
  const scopeGz = normalized.scope === 'hour' ? calendar.hourGanZhi
    : normalized.scope === 'day' ? calendar.dayGanZhi
      : normalized.scope === 'month' ? calendar.monthGanZhi
        : calendar.yearGanZhi;
  const ganIdx = GAN.indexOf(scopeGz.charAt(0));
  const zhiIdx = ZHI.indexOf(scopeGz.charAt(1));
  const xunOffset = mod(zhiIdx - ganIdx, 12);
  const xunZhiIdx = mod(zhiIdx - xunOffset, 12);
  const voidBranches = [ZHI[(xunZhiIdx + 10) % 12], ZHI[(xunZhiIdx + 11) % 12]];
  const voidPalaces = voidBranches.map((b) => {
    const palace = BRANCH_PALACE[b];
    return { branch: b, palace, name: NINE_PALACES[palace].name };
  });
  const sourceBranch = scopeGz.charAt(1);
  const branch = YI_MA[sourceBranch];
  const palace = BRANCH_PALACE[branch];
  const horseStar = { branch, palace, name: NINE_PALACES[palace].name, sourceBranch };
  return { voidBranches, voidPalaces, horseStar };
}

/** specialConditions（时干支判定；scope 非 hour 时恒为 false 结构）。 */
export function computeSpecialConditions(calendar, normalized) {
  if (normalized.scope !== 'hour') {
    return { isLiuJiaHour: false, isLiuGuiHour: false, isShiGanRuMu: false, isWuBuYuShi: false, description: '' };
  }
  const hourGz = calendar.hourGanZhi;
  const hourGan = hourGz.charAt(0);
  const hourZhi = hourGz.charAt(1);
  const dayGan = calendar.dayGanZhi.charAt(0);
  const parts = [];
  const isLiuJiaHour = hourGan === '甲';
  const isLiuGuiHour = hourGan === '癸';
  const isShiGanRuMu = GAN_MU[hourGan] === hourZhi;
  const dayEl = GAN_ELEMENT[dayGan];
  const hourEl = GAN_ELEMENT[hourGan];
  const dayYinYang = GAN.indexOf(dayGan) % 2;
  const hourYinYang = GAN.indexOf(hourGan) % 2;
  const isWuBuYuShi = ELEMENT_RELATION[hourEl][dayEl] === '克' && dayYinYang === hourYinYang;

  if (isLiuJiaHour) parts.push('六甲时辰，甲遁于六仪之下，宜伏藏静守，不宜张扬冒进。');
  if (isLiuGuiHour) parts.push('六癸时辰，癸为阴干之终，天网四张，主动行事多受阻滞，宜隐避蓄势。');
  if (isShiGanRuMu) {
    const palace = BRANCH_PALACE[hourZhi];
    const qi = ['乙', '丙', '丁'].includes(hourGan) ? '三奇' : '';
    parts.push(`${qi}时干入墓（${hourGz}，${hourGan}入${NINE_PALACES[palace].name}/${hourZhi}支），事情停滞，不宜举事。`);
  }
  if (isWuBuYuShi) parts.push(`五不遇时（日干${dayGan}遇时干${hourGan}克日干），事多不顺，不宜举事。`);
  return {
    isLiuJiaHour, isLiuGuiHour, isShiGanRuMu, isWuBuYuShi,
    description: parts.join(''),
  };
}

/** seasonality 结构字段（currentJieQi 用真实当前节气；白话/月相自撰）。 */
export function computeSeasonality(calendar, normalized, juInfo, palaces) {
  const currentJieQi = juInfo.currentTerm;
  const seasonalElement = TERM_ELEMENT[currentJieQi];
  const dayStem = calendar.dayGanZhi.charAt(0);
  const dayElement = GAN_ELEMENT[dayStem];
  const relation = ELEMENT_RELATION[seasonalElement][dayElement];
  const seasonRelation = SEASON_RELATION_LABEL[relation];
  const monthZhi = TERM_MONTH_ZHI[currentJieQi];
  const dayZhi = calendar.dayGanZhi.charAt(1);
  const dayOfficer = JIAN_CHU[mod(ZHI.indexOf(dayZhi) - ZHI.indexOf(monthZhi), 12)];
  const dayOfficerFortuneLabel = JIAN_CHU_LABEL[dayOfficer];
  const ganzhiInteractions = computeGanzhiInteractions(calendar);
  const lunar = approximateLunarPhase(calendar, normalized);
  return {
    currentJieQi,
    seasonalElement,
    jieQiPhase: { jieQi: currentJieQi, phase: juInfo.epoch || '上元', phaseIndex: (juInfo.epoch === '中元' ? 1 : juInfo.epoch === '下元' ? 2 : 0) },
    dayStem,
    dayElement,
    seasonRelation,
    seasonRelationDescription: seasonRelationDescription(seasonalElement, dayStem, dayElement, seasonRelation),
    lunarPhase: lunar.lunarPhase,
    lunarPhaseDetail: lunar.lunarPhaseDetail,
    lunarPhaseConsistency: true,
    dayOfficer,
    dayOfficerFortuneLabel,
    dayOfficerAdvice: dayOfficerAdvice(dayOfficer),
    ganzhiInteractions,
  };
}

function seasonRelationDescription(seasonalElement, dayStem, dayElement, seasonRelation) {
  const map = {
    得时: `节令${seasonalElement}与${dayStem}之${dayElement}同气，正当其时。`,
    受生: `节令${seasonalElement}生${dayStem}之${dayElement}，得令相助。`,
    受克: `节令${seasonalElement}克${dayStem}之${dayElement}，受制不吉。`,
    被耗: `${dayStem}之${dayElement}生节令${seasonalElement}，泄气耗力。`,
    持平: `${dayStem}之${dayElement}克节令${seasonalElement}，虽能克令但亦耗力，持平。`,
  };
  return map[seasonRelation] || '';
}

function dayOfficerAdvice(officer) {
  const map = {
    建: '建为岁君，宜出行、上任、赴任，忌动土修造。',
    除: '除旧布新，宜除服、沐浴、祭祀，忌婚嫁。',
    满: '满为丰盈，宜祭祀、祈福、纳财，忌开仓动土。',
    平: '平为平常，宜修整、平路，诸事平稳少吉凶。',
    定: '定为官符，宜冠带、嫁娶、订盟，忌词讼出行。',
    执: '执为执持，宜捕捉、立券、纳财，忌搬家远行。',
    破: '破为破败，宜破土、拆卸、求医，忌婚嫁出行。',
    危: '危为危险，宜安床、祈福，忌登高涉险。',
    成: '成为成就，宜开业、嫁娶、纳财，诸事可成。',
    收: '收为收纳，宜纳财、收账、入仓，忌开市远行。',
    开: '开为开启，宜开业、出行、求财，百事皆宜。',
    闭: '闭为闭塞，宜安葬、筑堤，忌开市出行。',
  };
  return map[officer] || '';
}

/** ganzhiInteractions：六对（y,m)(y,d)(y,h)(m,d)(m,h)(d,h) × 六型，半合次遍（对拍实测口径）。 */
export function computeGanzhiInteractions(calendar) {
  const gz = {
    year: calendar.yearGanZhi, month: calendar.monthGanZhi,
    day: calendar.dayGanZhi, hour: calendar.hourGanZhi,
  };
  const pairs = [
    ['year', 'month'], ['year', 'day'], ['year', 'hour'],
    ['month', 'day'], ['month', 'hour'], ['day', 'hour'],
  ];
  const out = [];
  const checkPair = (a, b) => {
    const ga = gz[a].charAt(0), za = gz[a].charAt(1);
    const gb = gz[b].charAt(0), zb = gz[b].charAt(1);
    const zPair = [za, zb].sort((x, y) => ZHI.indexOf(x) - ZHI.indexOf(y)).join('');
    const gPair = [ga, gb].sort((x, y) => GAN.indexOf(x) - GAN.indexOf(y)).join('');
    if (SIX_HE.includes(zPair)) out.push({ type: '六合', pillars: [a, b], values: [za, zb], description: `${za}与${zb}六合，主合作、亲和。` });
    if (SIX_CHONG.includes(zPair)) out.push({ type: '六冲', pillars: [a, b], values: [za, zb], description: `${za}与${zb}六冲，主冲突变动。` });
    if (GAN_CHONG.includes(gPair)) out.push({ type: '天干相冲', pillars: [a, b], values: [ga, gb], description: `${a}柱${ga}与${b}柱${gb}天干相冲，主对立矛盾。` });
    if (XIANG_HAI.includes(zPair)) out.push({ type: '相害', pillars: [a, b], values: [za, zb], description: `${za}与${zb}相害，主暗损不睦。` });
    if (XIANG_XING.includes(zPair)) out.push({ type: '相刑', pillars: [a, b], values: [za, zb], description: `${za}与${zb}相刑，主刑伤约束。` });
    if (GAN_HE.includes(gPair)) out.push({ type: '天干五合', pillars: [a, b], values: [ga, gb], description: `${ga}与${gb}天干五合，主合化有情。` });
  };
  for (const [a, b] of pairs) checkPair(a, b);
  // 半合（第二遍）：按三合组内支序排列标签
  for (const [a, b] of pairs) {
    const za = gz[a].charAt(1), zb = gz[b].charAt(1);
    for (const group of BAN_HE_GROUPS) {
      if (group.includes(za) && group.includes(zb) && za !== zb) {
        const asc = group.indexOf(za) < group.indexOf(zb);
        out.push({
          type: '半合',
          pillars: asc ? [a, b] : [b, a],
          values: asc ? [za, zb] : [zb, za],
          description: `${za}、${zb}半合${group.join('')}局，合而不全，有合作之意但力未足。`,
        });
        break;
      }
    }
  }
  return out;
}

/** 月相近似（平均朔望月；信息性，不触网）。 */
function approximateLunarPhase(calendar, normalized) {
  const { wall } = normalized;
  const jd = Math.floor(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) / 86400000) + 2440587.5;
  const age = ((jd - 2451550.1) % 29.530588853 + 29.530588853) % 29.530588853;
  const ratio = age / 29.530588853;
  const detail = ratio < 0.06 ? '朔' : ratio < 0.19 ? '娥眉月' : ratio < 0.31 ? '上弦月' : ratio < 0.44 ? '盈凸月' : ratio < 0.56 ? '满月' : ratio < 0.69 ? '亏凸月' : ratio < 0.81 ? '下弦月' : ratio < 0.94 ? '残月' : '晦';
  const lunarPhase = ['朔', '上弦月', '满月', '下弦月'][Math.floor((ratio + 0.125) * 4) % 4];
  return { lunarPhase, lunarPhaseDetail: detail };
}

/** 释义层（§5 门禁外，自撰规则 + 自撰文案；形状照旧实现）。 */
export function buildInterpretation({ juInfo, earthPlate, fuShi, palaces, calendar, normalized, special, horseStar, voidBranches }) {
  const isYangDun = juInfo.isYangDun;
  const patternTags = [];
  const patternDetails = [];
  const classicPatterns = [];
  const palaceInsights = [];
  const stemRelations = [];
  const palaceGoodBad = {};
  const doorElement = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };

  const addPattern = (tag, summary, type, palace) => {
    patternTags.push(tag);
    patternDetails.push({ tag, summary });
    classicPatterns.push({ name: tag, type, summary });
    if (!palaceGoodBad[palace]) palaceGoodBad[palace] = [];
    palaceGoodBad[palace].push(type);
  };

  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const tp = palaces.tianPan[g] || {};
    const dp = palaces.diPan[g] || {};
    const rp = palaces.renPan[g] || {};
    const sp = palaces.shenPan[g] || {};
    const palaceEl = NINE_PALACES[g].element;
    const heavenStem = tp.stem || '';
    const earthStem = dp.stem || '';

    // 十干克应（天盘干 + 地盘干）
    if (heavenStem && earthStem && GAN_KEDING[heavenStem + earthStem]) {
      const kd = GAN_KEDING[heavenStem + earthStem];
      addPattern(kd.name, `${heavenStem}加地盘${earthStem}于${NINE_PALACES[g].name}，${kd.type === 'good' ? '主顺遂得助' : kd.type === 'bad' ? '主阻逆须防' : '主平中有变'}。`, kd.type, g);
    }
    // 门宫生克（门迫/宫生门等）
    if (rp.door && doorElement[rp.door]) {
      const rel = ELEMENT_RELATION[doorElement[rp.door]][palaceEl];
      if (rel === '克') addPattern(`门迫（${NINE_PALACES[g].name}${rp.door}）`, '门克宫，该宫事项易受压制，行动阻力偏大。', 'bad', g);
      else if (rel === '受生') addPattern(`宫生门（${NINE_PALACES[g].name}${rp.door}）`, '宫生门，该宫得地气滋养，行事顺遂。', 'good', g);
      else if (rel === '受克') addPattern(`宫克门（${NINE_PALACES[g].name}${rp.door}）`, '宫克门，该宫门户受制，谋事多阻。', 'bad', g);
      else if (rel === '生') addPattern(`门生宫（${NINE_PALACES[g].name}${rp.door}）`, '门生宫，该宫内外相济，可稳步推进。', 'good', g);
    }
    // 击刑（天盘六仪落击刑位）
    const jixing = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
    if (heavenStem && jixing[heavenStem] === g) {
      addPattern(`击刑（${heavenStem}落${NINE_PALACES[g].name}）`, '天盘干落击刑位，主压力、掣肘或规章束缚，宜谨慎行事。', 'bad', g);
    }
    // 入墓（天盘干落其墓宫）
    const muPalace = { 甲: 2, 乙: 2, 丙: 6, 丁: 8, 戊: 4, 己: 2, 庚: 8, 辛: 8, 壬: 4, 癸: 2 };
    if (heavenStem && muPalace[heavenStem] === g) {
      addPattern(`入墓（${heavenStem}落${NINE_PALACES[g].name}）`, '天盘干入墓，事情易陷入停滞，宜守不宜攻。', 'bad', g);
    }
    // 八神/八门白话提示
    const godGood = { 值符: '贵人扶持', 太阴: '暗中得助', 六合: '合作和合', 九天: '高远进取' };
    const godBad = { 白虎: '阻力口舌', 玄武: '暗昧欺诈', 螣蛇: '虚惊反复', 九地: '迟缓滞留' };
    if (sp.god && godGood[sp.god]) palaceInsights.push({ gong: g, name: NINE_PALACES[g].name, level: '有利', summary: `${sp.god}同宫，主${godGood[sp.god]}，可顺势而为。` });
    if (sp.god && godBad[sp.god]) palaceInsights.push({ gong: g, name: NINE_PALACES[g].name, level: '风险', summary: `${sp.god}同宫，主${godBad[sp.god]}，宜防反复。` });
    if (rp.door) {
      const doorGood = { 休门: '休养安宁', 生门: '生发求财', 开门: '开张进取', 景门: '文书显达' };
      const doorBad = { 死门: '停滞困顿', 惊门: '惊恐惊扰', 伤门: '损伤争斗', 杜门: '闭塞不通' };
      if (doorGood[rp.door]) palaceInsights.push({ gong: g, name: NINE_PALACES[g].name, level: '有利', summary: `${rp.door}同宫，主${doorGood[rp.door]}，可作优先方位。` });
      if (doorBad[rp.door]) palaceInsights.push({ gong: g, name: NINE_PALACES[g].name, level: '风险', summary: `${rp.door}同宫，主${doorBad[rp.door]}，宜避不宜攻。` });
    }
    // 天盘/地盘干五行生克
    if (heavenStem && earthStem) {
      const rel = ELEMENT_RELATION[GAN_ELEMENT[heavenStem]][GAN_ELEMENT[earthStem]];
      const relText = rel === '克' ? '天盘克地盘' : rel === '受克' ? '地盘克天盘' : rel === '生' ? '天盘生地盘' : rel === '受生' ? '地盘生天盘' : '比和';
      stemRelations.push({ gong: g, heavenStem, earthStem, relation: relText, pattern: `${heavenStem}加地盘${earthStem}于${NINE_PALACES[g].name}，${relText}，${rel === '克' || rel === '受克' ? '气机相制，谋事多磨。' : rel === '生' || rel === '受生' ? '气机相生，行事顺遂。' : '气机平和，中平之象。'}` });
    }
    // 空亡宫提示
    if (voidBranches && voidBranches.length) {
      const voidZhi = voidBranches.find((b) => BRANCH_PALACE[b] === g);
      if (voidZhi) palaceInsights.push({ gong: g, name: NINE_PALACES[g].name, level: '风险', summary: `${voidZhi}支空亡落此宫，气散难聚，诸事易虚。` });
    }
  }

  // 伏吟/反吟（转盘：天盘星与本宫星）
  const allHome = [1, 2, 3, 4, 6, 7, 8, 9].every((g) => palaces.tianPan[g] && palaces.tianPan[g].star === NINE_STARS[g]);
  if (allHome) addPattern('伏吟', '天盘九星俱归本宫，主迟缓、反复、事难速成，宜静守待变。', 'neutral', 0);
  else {
    const fanYin = [1, 2, 3, 4, 6, 7, 8, 9].some((g) => palaces.tianPan[g] && palaces.tianPan[g].star === NINE_STARS[RING_R[(RING_R.indexOf(g) + 4) % 8]]);
    if (fanYin) addPattern('反吟', '天盘星与本宫星相冲位对应，主动荡反复，谋事宜缓。', 'bad', 0);
  }
  if (special.isWuBuYuShi) addPattern('五不遇时', '时干克日干且同性，百事不宜，纵有吉门亦难成。', 'bad', 0);
  if (special.isLiuJiaHour) addPattern('六甲伏吟', '六甲时辰，甲遁六仪之下，宜伏藏静守。', 'neutral', 0);
  if (special.isLiuGuiHour) addPattern('六癸天网', '六癸时辰，天网四张，主动行事多阻。', 'bad', 0);

  // patternCombos（吉凶混杂/纯吉/纯凶宫；palace=0 为盘面级格局不入宫组合）
  const patternCombos = [];
  for (const [g, types] of Object.entries(palaceGoodBad)) {
    if (g === '0') continue;
    const hasGood = types.includes('good');
    const hasBad = types.includes('bad');
    const tone = hasGood && hasBad ? 'mixed' : hasGood ? 'good' : 'bad';
    const label = tone === 'mixed' ? '吉凶混杂' : tone === 'good' ? '吉气汇聚' : '凶气凝聚';
    patternCombos.push({
      key: `combo:${tone}:${g}`,
      name: `${NINE_PALACES[g].name}${label}`,
      tone,
      summary: tone === 'mixed' ? `${NINE_PALACES[g].name}同时见吉格与凶格，气机不纯，需分清主次。` : tone === 'good' ? `${NINE_PALACES[g].name}吉格汇聚，可作为用事方位。` : `${NINE_PALACES[g].name}凶格聚集，宜避不宜用。`,
      palace: Number(g),
    });
  }

  // directions
  const goodDirections = [];
  const avoidDirections = [];
  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const rp = palaces.renPan[g] || {};
    const sp = palaces.shenPan[g] || {};
    const goodDoors = { 休门: '休养/安宁/关系', 生门: '生财/进取/求助', 开门: '开张/事业/远行' };
    const badDoors = { 死门: '停滞/丧葬', 惊门: '惊恐/纠纷', 伤门: '损伤/争斗', 杜门: '闭塞/阻滞' };
    if (goodDoors[rp.door]) goodDirections.push({ gong: g, name: NINE_PALACES[g].name, direction: NINE_PALACES[g].direction, use: goodDoors[rp.door], reasons: [rp.door] });
    if (badDoors[rp.door]) avoidDirections.push({ gong: g, name: NINE_PALACES[g].name, direction: NINE_PALACES[g].direction, use: '宜避之方', reasons: [rp.door] });
    if ((sp.god === '白虎' || sp.god === '玄武') && !badDoors[rp.door]) avoidDirections.push({ gong: g, name: NINE_PALACES[g].name, direction: NINE_PALACES[g].direction, use: '宜避之方', reasons: [sp.god] });
    if (horseStar && horseStar.palace === g && !goodDoors[rp.door]) goodDirections.push({ gong: g, name: NINE_PALACES[g].name, direction: NINE_PALACES[g].direction, use: '动象方', reasons: ['马星'] });
  }
  const directions = { goodDirections, avoidDirections };

  // yingQi（应期节奏白话）
  const yingQi = {
    rhythm: isYangDun ? '中' : '慢',
    triggerConditions: [
      `值符${fuShi.zhiFu}落${NINE_PALACES[palaces.zhiFuPalace].name}，逢${horseStar ? horseStar.branch + '马星动' : '值使门临'}应`,
      ...(voidBranches.length ? [`空亡${voidBranches.join('')}冲实之日应`] : []),
    ],
    limitations: [
      '快、中、慢只表示盘内相对节奏，不对应固定日数、月数或公历日期',
      '庚格、空亡、马星等只给候选触发条件，必须结合问题期限和现实事件核验',
      '未按具体问题选定用神时，本结果只能作为值符落宫的通用参考',
    ],
    description: `盘内应期节奏为${isYangDun ? '中' : '慢'}，不机械换算固定天数。宜结合用神宫位的门星神组合与马星、空亡冲实判断。`,
  };

  return {
    patternTags: Array.from(new Set(patternTags)),
    patternDetails,
    palaceInsights,
    classicPatterns,
    stemRelations,
    patternCombos,
    directions,
    yingQi,
  };
}

/** ④ 输出装配。 */
export function assemble({ normalized, calendar, juInfo, earthPlate, fuShi, palaces, now }) {
  const { voidBranches, voidPalaces, horseStar } = computeVoidAndHorse(calendar, normalized);
  const specialConditions = computeSpecialConditions(calendar, normalized);
  const seasonality = computeSeasonality(calendar, normalized, juInfo, palaces);
  const interpretation = buildInterpretation({ juInfo, earthPlate, fuShi, palaces, calendar, normalized, special: specialConditions, horseStar, voidBranches });

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
    solarTerm: juInfo.currentTerm,
    juTerm: juInfo.juTerm,
    epoch: juInfo.epoch,
    juMethod: normalized.qimenJuMethod,
    ...(juInfo.fuTou ? { fuTou: juInfo.fuTou, fuTouDate: juInfo.fuTouDate, chaoShenOrJieQi: juInfo.chaoShenOrJieQi } : {}),
    isZhiRun: String(juInfo.isZhiRun),
    juMethodNote: juInfo.juMethodNote,
  };
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  return {
    method: normalized.qimenMethod,
    scope: normalized.scope,
    juMethod: normalized.qimenJuMethod,
    timeInfo,
    ganzhi: { year: calendar.yearGanZhi, month: calendar.monthGanZhi, day: calendar.dayGanZhi, hour: calendar.hourGanZhi },
    isYangDun: juInfo.isYangDun,
    juShu: juInfo.juShu,
    zhiFu: fuShi.zhiFu,
    zhiShi: fuShi.zhiShi,
    jiuGongGe,
    voidBranches,
    voidPalaces,
    horseStar,
    specialConditions,
    seasonality,
    patternTags: interpretation.patternTags,
    patternDetails: interpretation.patternDetails,
    palaceInsights: interpretation.palaceInsights,
    classicPatterns: interpretation.classicPatterns,
    stemRelations: interpretation.stemRelations,
    patternCombos: interpretation.patternCombos,
    directions: interpretation.directions,
    yingQi: interpretation.yingQi,
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: normalized.qimenMethod === 'zhuanpan' ? 'qimen-zhuanpan' : 'qimen-feipan',
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
    ? computePalacesFeipan({ juInfo, earthPlate, fuShi, normalized })
    : computePalacesZhuanpan({ juInfo, earthPlate, fuShi, calendar, normalized }); // ③
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({ normalized, calendar, juInfo, earthPlate, fuShi, palaces, now }); // ④
}

export default generateQimenCore;
