/**
 * 命理 · 自研排盘内核 · 能力：奇门终身局（qimen-lifetime）
 * ---------------------------------------------------------------------------
 * 导出 `calculateQimenLifetimeCore(params)` —— 与旧实现
 * `calculateQimenLifetime({birthDateTime, timeZoneId, location, calendarType,
 * timeStandard, method, juMethod})` 同形状（stripInternal 后契约；9 个顶层键，
 * 见 rules/qimen-lifetime.js 头注与节154 口径简报）。
 *
 * 四段纯函数管线：① normalizeInput（时区挂钟→绝对时刻→东八区标准挂钟）
 * ② resolveCalendar + resolveJuLifetime + buildEarthPlate + computeFuShi
 * ③ 转盘/飞盘起局（复用节153 qimen 纯函数）④ assemble（baseChart + 终身局解读层）。
 *
 * 对拍实测锁定口径（黑盒探针 tools/_probe/qimen-lifetime/，以 vendor 0.2.2 为准）：
 *   - birthDateTime 按 timeZoneId 当地挂钟（Asia/Shanghai 含 1986–1991 中国夏令时，
 *     起始日 03:00 起 UTC+9、结束日 01:00 起 UTC+8）转绝对时刻，再按东八区标准
 *     +08:00 挂钟起局（夏令时年份结果比挂钟早 1 小时）；带显式时区偏移后缀时
 *     校验与历史偏移一致，不一致抛错
 *   - baseChart = 时家奇门（scope=hour）拆补/置闰；四柱口径同节153
 *     （立春精确换年 / 节气精确换月 / 晚子时 23:00 换日 / 五鼠遁）
 *   - 拆补符头：晚子时（23:00–23:59）按换日后的日干支从「次日」向前寻甲/己
 *     （与节153 qimen 内核的民用日界口径不同，本节以旧实现实测为准；
 *     例 2000-08-08T23:45 → 己亥日 → 符头己亥@2000-08-09 → 立秋中元 5 局）
 *   - personalMarkers：年/日/时干各「天盘+地盘」2 条（按宫序升、同宫天先）、
 *     年支本宫、值符星（值符宫=5 天禽时省略）、值使门、天禽寄宫携干（仅转盘）
 *   - 甲干渲染「甲(遁X)」（盘面无甲，用旬首遁干定位）
 *   - stages：四柱分限 0-16/17-32/33-48/49-80；起始日 = 出生日（转换后挂钟小时
 *     ∈[0,7] 减 1 天）；各段日历 = 起始日 + ageStart/ageEnd 年
 *   - topicCandidates / 白话释义 / supportFacts 等解读层：自撰，只保形状不逐字
 *     （同节153「释义层不进关键字段」裁决）
 */

import { Solar } from 'lunar-typescript';
import {
  YANG_DUN_JIEQI, YIN_DUN_JIEQI, SOLAR_TERM_DUN, FU_TOU_YUAN,
  NINE_STARS, EIGHT_DOORS, RING_R, NINE_PALACES, BRANCH_PALACE,
  SIX_YI, THREE_QI, ZHI_RUN_LIMIT_DAYS, SOLAR_TERM_ORDER,
  GAN_ELEMENT, GAN_MU,
} from '../../rules/qimen.js';
import {
  CHINA_DST, FIXED_OFFSET_TZ, SHANGHAI_LMT_OFFSET, STAGE_TITLES, STAGE_AGES, STAGE_THEMES,
  STAGE_LIMITATION, STAGE_POLICY, TOPICS, MARKER_SIGNIFICANCE,
} from '../../rules/qimen-lifetime.js';
// 复用节153 qimen 能力的地盘/符使/起局纯函数（调用方只读不抄 rules 数据表）
import {
  resolveCalendar, buildEarthPlate, computeFuShi, computePalacesZhuanpan,
  computePalacesFeipan, assemble, PaipanInputError,
} from '../qimen/index.js';

export const SCHEMA_VERSION = '1.0.0';

const CST_OFFSET_MINUTES = 480;
const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 旬首遁干（公有领域传统：甲子戊 甲寅癸 甲辰壬 甲午辛 甲申庚 甲戌己；与 qimen 内核同表）。 */
const DUN_GAN = Object.freeze([
  { xun: '甲子', dun: '戊' }, { xun: '甲寅', dun: '癸' }, { xun: '甲辰', dun: '壬' },
  { xun: '甲午', dun: '辛' }, { xun: '甲申', dun: '庚' }, { xun: '甲戌', dun: '己' },
]);

function mod(n, m) { return ((Math.trunc(n) % m) + m) % m; }
function pad2(n) { return String(Math.trunc(n)).padStart(2, '0'); }
function toMs(dt) { return dt instanceof Date ? dt.getTime() : new Date(dt).getTime(); }

/** 干支 → 旬首遁干。 */
function dunGanOf(gz) {
  const ganIdx = GAN.indexOf(gz.charAt(0));
  const zhiIdx = ZHI.indexOf(gz.charAt(1));
  const off = mod(zhiIdx - ganIdx, 12);
  return DUN_GAN[Math.floor(off / 2)].dun;
}

/** Asia/Shanghai 历史偏移（1901 前 LMT +8.095278；1986–1991 夏令时表；对拍实测）。 */
function shanghaiOffset(y, m, d, h) {
  if (y < 1901) return SHANGHAI_LMT_OFFSET;
  const dst = CHINA_DST[y];
  if (!dst) return 8;
  const key = m * 100 + d;
  const sKey = dst.start[0] * 100 + dst.start[1];
  const eKey = dst.end[0] * 100 + dst.end[1];
  if (key === sKey) return h < 3 ? 8 : 9;
  if (key > sKey && key < eKey) return 9;
  if (key === eKey) return h < 1 ? 9 : 8;
  return 8;
}

/** 当地挂钟 → UTC 偏移（小时）。 */
function offsetAt(local, timeZoneId) {
  if (timeZoneId === 'Asia/Shanghai') return shanghaiOffset(local.y, local.m, local.d, local.h);
  if (FIXED_OFFSET_TZ[timeZoneId] !== undefined) return FIXED_OFFSET_TZ[timeZoneId];
  const m = /^Etc\/GMT([+-]\d{1,2})?$/.exec(timeZoneId);
  if (m) return -(Number(m[1] || '0'));
  throw new PaipanInputError('unsupported_timezone', `不支持的时区: ${timeZoneId}`);
}

function fmtOffsetHours(offset) {
  const s = Math.round(offset * 1e6) / 1e6;
  return `UTC${s >= 0 ? '+' : ''}${s}`;
}

/** 解析 birthDateTime（接受 无填充/空格分隔/缺省时刻=12:00/可选时区后缀）。 */
function parseBirthDateTime(value) {
  if (typeof value !== 'string') {
    throw new PaipanInputError('invalid_birth', `birthDateTime 必须是 ISO 字符串: ${String(value)}`);
  }
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
  if (!m) throw new PaipanInputError('invalid_birth', `birthDateTime 无法解析: ${value}`);
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const h = m[4] === undefined ? 12 : Number(m[4]);
  const min = m[5] === undefined ? 0 : Number(m[5]);
  const s = m[6] === undefined ? 0 : Number(m[6]);
  for (const [v, lo, hi] of [[mo, 1, 12], [d, 1, 31], [h, 0, 23], [min, 0, 59], [s, 0, 59]]) {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new PaipanInputError('invalid_birth', `birthDateTime 超出范围: ${value}`);
  }
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== mo || check.getUTCDate() !== d) {
    throw new PaipanInputError('invalid_birth', `birthDateTime 不是真实日期: ${value}`);
  }
  let offset;
  if (m[7] === 'Z') offset = 0;
  else if (m[7]) {
    const sign = m[7][0] === '-' ? -1 : 1;
    const body = m[7].slice(1).replace(':', '');
    offset = sign * (Number(body.slice(0, 2)) + Number(body.slice(2, 4)) / 60);
  }
  return { y, m: mo, d, h, min, s, offset };
}

/** ① 输入归一化：当地挂钟 → 绝对时刻 → 东八区标准挂钟。 */
export function normalizeInput(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_birth', '奇门终身局必须传 birthDateTime');
  }
  if (params.birthDateTime === undefined || params.birthDateTime === null) {
    throw new PaipanInputError('missing_birth', '奇门终身局必须传 birthDateTime');
  }
  const birthDateTime = params.birthDateTime;
  const timeZoneId = params.timeZoneId === undefined ? 'Asia/Shanghai' : String(params.timeZoneId);
  const location = params.location && typeof params.location === 'object'
    ? { longitude: params.location.longitude, latitude: params.location.latitude, locationName: params.location.locationName || '' }
    : { longitude: params.longitude, latitude: params.latitude, locationName: params.birthplace || '' };
  const calendarType = params.calendarType === undefined ? 'solar' : String(params.calendarType);
  const timeStandard = params.timeStandard === undefined ? 'civil' : String(params.timeStandard);
  const method = params.method === undefined ? 'zhuanpan' : String(params.method);
  const juMethod = params.juMethod === undefined ? 'chaibu' : String(params.juMethod);
  if (!['zhuanpan', 'feipan'].includes(method)) throw new PaipanInputError('invalid_method', `method 必须是 zhuanpan/feipan: ${method}`);
  if (!['chaibu', 'zhirun'].includes(juMethod)) throw new PaipanInputError('invalid_ju_method', `juMethod 必须是 chaibu/zhirun: ${juMethod}`);

  const parsed = parseBirthDateTime(birthDateTime);
  const offset = offsetAt(parsed, timeZoneId);
  if (parsed.offset !== undefined && parsed.offset !== offset) {
    throw new PaipanInputError('timezone_offset_mismatch',
      `timezone 固定偏移 ${fmtOffsetHours(parsed.offset)} 与 ${timeZoneId} 在该当地时刻的历史偏移不一致。`);
  }
  const epochMs = Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.h, parsed.min, parsed.s) - offset * 3600000;
  const shifted = new Date(epochMs + CST_OFFSET_MINUTES * 60000);
  const wall = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
  };
  const isoOffset8 = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}+08:00`;
  return {
    birthDateTime, timeZoneId, location, calendarType, timeStandard, method, juMethod,
    epochMs, offset, wall, scope: 'hour', qimenMethod: method, qimenJuMethod: juMethod,
    hashInput: { capability: 'qimen-lifetime', method, scope: 'hour', ju: juMethod, wall: isoOffset8, birth: birthDateTime, tz: timeZoneId },
  };
}

/** 当前节气（与 qimen 内核同口径：getJieQiTable 只给日期，夹具避开交节日）。 */
function currentTermInfo(calendar, wall) {
  const nowMs = new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second).getTime();
  let name = null;
  let ms = -Infinity;
  const table = calendar.jieQiTable || {};
  for (const [termName, dt] of Object.entries(table)) {
    const t = toMs(dt);
    if (Number.isFinite(t) && t <= nowMs && t > ms) { name = termName; ms = t; }
  }
  if (!name) throw new PaipanInputError('no_solar_term', `无法定位当前节气: ${wall.year}-${wall.month}-${wall.day}`);
  return { name, ms };
}

/** ②b 定局（拆补/置闰）：符头从「晚子时次日」起向前寻甲/己（对拍实测口径）。 */
export function resolveJuLifetime(calendar, normalized) {
  const { wall, qimenJuMethod } = normalized;
  const { name: currentTerm } = currentTermInfo(calendar, wall);
  const isYangDun = SOLAR_TERM_DUN[currentTerm] === 'yang';

  let fuTouDate = Solar.fromYmd(wall.year, wall.month, wall.day);
  if (wall.hour === 23) fuTouDate = fuTouDate.next(1); // 晚子时：按换日后的日干支从次日寻
  let fuTouGz = fuTouDate.getLunar().getDayInGanZhi();
  let guard = 0;
  while (guard++ < 60 && !/^[甲己]/.test(fuTouGz)) {
    fuTouDate = fuTouDate.next(-1);
    fuTouGz = fuTouDate.getLunar().getDayInGanZhi();
  }
  const fuTou = fuTouGz;
  const yuan = FU_TOU_YUAN[fuTou.charAt(1)] || '上元';
  const table3 = isYangDun ? YANG_DUN_JIEQI : YIN_DUN_JIEQI;
  const yuanIndex = yuan === '上元' ? 0 : yuan === '中元' ? 1 : 2;

  let juTerm = currentTerm;
  let juShu = table3[currentTerm] ? table3[currentTerm][yuanIndex] : 1;
  let isZhiRun = false;
  let juMethodNote = `拆补法定局：${fuTou}为甲己符头，按日干支五日一元定${yuan}，不置闰`;

  if (qimenJuMethod === 'zhirun') {
    const idx = SOLAR_TERM_ORDER.indexOf(currentTerm);
    const nextTerm = SOLAR_TERM_ORDER[(idx + 1) % 24];
    const nextMs = toMs(calendar.jieQiTable[nextTerm]);
    const fuTouMs = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
    const diffDays = Math.round((nextMs - fuTouMs) / 86400000);
    if (diffDays >= 0 && diffDays <= ZHI_RUN_LIMIT_DAYS) {
      juTerm = nextTerm;
      // 置闰挂到下一节气：取下一节气的三元表（阴阳遁以 nextTerm 为准）
      const tableN = SOLAR_TERM_DUN[nextTerm] === 'yang' ? YANG_DUN_JIEQI : YIN_DUN_JIEQI;
      juShu = tableN[nextTerm] ? tableN[nextTerm][yuanIndex] : juShu;
      juMethodNote = `置闰法定局：${yuan}符头先于${nextTerm}交节${diffDays}个整日，为超神${yuan}`;
    }
  }

  let chaoShenOrJieQi;
  if (qimenJuMethod === 'zhirun') {
    chaoShenOrJieQi = '超神';
  } else {
    const fuTouMs2 = new Date(fuTouDate.getYear(), fuTouDate.getMonth() - 1, fuTouDate.getDay()).getTime();
    const termMs = toMs(calendar.jieQiTable[juTerm]);
    const dayMs = fuTouMs2 - termMs;
    if (dayMs > 0) chaoShenOrJieQi = '接气';
    else if (dayMs < 0) chaoShenOrJieQi = '超神';
    else chaoShenOrJieQi = '正授';
  }

  return {
    isYangDun: SOLAR_TERM_DUN[juTerm] === 'yang', // 置闰后按 juTerm 定阴阳遁（对拍实测）
    juShu, epoch: yuan, fuTou, fuTouDate: `${fuTouDate.getYear()}-${pad2(fuTouDate.getMonth())}-${pad2(fuTouDate.getDay())}`,
    juTerm, currentTerm, chaoShenOrJieQi, isZhiRun, juMethodNote,
  };
}

/** 值使门沿洛书数顺/逆飞 k 步（中五落宫寄坤二；与 qimen 内核同式）。 */
function menFly(home, k, isYangDun) {
  let p = home;
  const step = isYangDun ? 1 : -1;
  for (let i = 0; i < k; i++) p = mod(p + step - 1, 9) + 1;
  return p === 5 ? 2 : p;
}

/** 空亡（scope 干支旬空；修正节153 qimen 内核未入门禁的口径——旬首支=旬偏移，空亡为其前两支）。 */
function computeVoidLifetime(calendar, normalized) {
  const scopeGz = calendar.hourGanZhi;
  const ganIdx = GAN.indexOf(scopeGz.charAt(0));
  const zhiIdx = ZHI.indexOf(scopeGz.charAt(1));
  const xunOffset = mod(zhiIdx - ganIdx, 12); // 0子 2寅 4辰 6午 8申 10戌 = 旬首支序
  const voidBranches = [ZHI[(xunOffset + 10) % 12], ZHI[(xunOffset + 11) % 12]];
  const voidPalaces = voidBranches.map((b) => {
    const palace = BRANCH_PALACE[b];
    return { branch: b, palace, name: NINE_PALACES[palace].name };
  });
  return { voidBranches, voidPalaces };
}

/** specialConditions（修正 qimen 内核未入门禁的五不遇口径：时干克日干且同阴阳）。 */
function computeSpecialConditionsLifetime(calendar) {
  const hourGz = calendar.hourGanZhi;
  const hourGan = hourGz.charAt(0);
  const hourZhi = hourGz.charAt(1);
  const dayGan = calendar.dayGanZhi.charAt(0);
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // X 克 KE[X]
  const hourEl = GAN_ELEMENT[hourGan];
  const dayEl = GAN_ELEMENT[dayGan];
  const isLiuJiaHour = hourGan === '甲';
  const isLiuGuiHour = hourGan === '癸';
  const isShiGanRuMu = GAN_MU[hourGan] === hourZhi;
  const isWuBuYuShi = KE[hourEl] === dayEl && (GAN.indexOf(dayGan) % 2) === (GAN.indexOf(hourGan) % 2);
  const parts = [];
  if (isLiuJiaHour) parts.push('六甲时辰，甲遁于六仪之下，宜伏藏静守，不宜张扬冒进。');
  if (isLiuGuiHour) parts.push('六癸时辰，癸为阴干之终，天网四张，主动行事多受阻滞，宜隐避蓄势。');
  if (isShiGanRuMu) {
    const palace = BRANCH_PALACE[hourZhi];
    parts.push(`时干入墓（${hourGz}，${hourGan}入${NINE_PALACES[palace].name}/${hourZhi}支），事情停滞，不宜举事。`);
  }
  if (isWuBuYuShi) parts.push(`五不遇时（日干${dayGan}遇时干${hourGan}克日干），事多不顺，不宜举事。`);
  return { isLiuJiaHour, isLiuGuiHour, isShiGanRuMu, isWuBuYuShi, description: parts.join('') };
}

/** 干在盘中的「天盘/地盘」宫（甲干用旬首遁干）。
 *  allowCompanion=true 时天盘含天禽伴星携干（personalMarkers 用）；
 *  stages 非甲干只认常规天盘（中五干时省略天盘宫——对拍实测 1984 戊@中五 例）。 */
function stemPalaces(stem, gz, palaces, earthPlate, allowCompanion) {
  const eff = stem === '甲' ? dunGanOf(gz) : stem;
  const value = stem === '甲' ? `甲(遁${eff})` : stem;
  const diPan = Number(Object.keys(palaces.diPan).find((k) => palaces.diPan[k].stem === eff));
  let tianPan = Number(Object.keys(palaces.tianPan).find((k) => palaces.tianPan[k].stem === eff));
  if (!Number.isFinite(tianPan) && (allowCompanion || stem === '甲')) {
    tianPan = Number(Object.keys(palaces.tianPan).find((k) => palaces.tianPan[k].companionStem === eff));
  }
  return { value, eff, diPan, tianPan };
}

/** 个人标记（对拍实测：类型序固定；干对按宫序升、同宫天先）。 */
export function buildPersonalMarkers({ palaces, fuShi, calendar, earthPlate, juInfo }) {
  const mk = (markerType, value, palace, layer, nameOverride) => ({
    markerType, value, palace,
    palaceName: nameOverride || NINE_PALACES[palace].name,
    layer,
    traditionalSignificance: (MARKER_SIGNIFICANCE[`${markerType}:${layer}`] || (() => ''))(value),
  });
  const stemPair = (markerType, gz) => {
    const { value, diPan, tianPan } = stemPalaces(gz.charAt(0), gz, palaces, earthPlate, true);
    const entries = [
      { layer: 'tianPan', palace: tianPan },
      { layer: 'diPan', palace: diPan },
    ].sort((a, b) => (a.palace - b.palace) || (a.layer === 'tianPan' ? -1 : 1));
    return entries.map((e) => mk(markerType, value, e.palace, e.layer));
  };
  const markers = [];
  markers.push(...stemPair('yearStem', calendar.yearGanZhi));
  markers.push(mk('yearBranch', calendar.yearGanZhi.charAt(1), BRANCH_PALACE[calendar.yearGanZhi.charAt(1)], 'baseGong'));
  markers.push(...stemPair('dayStem', calendar.dayGanZhi));
  markers.push(...stemPair('hourStem', calendar.hourGanZhi));
  if (fuShi.fuShiPalace !== 5) {
    markers.push(mk('zhiFuStar', fuShi.zhiFu, palaces.zhiFuPalace, 'tianPan'));
  }
  const menLand = menFly(fuShi.homePalace, fuShi.k, juInfo.isYangDun);
  markers.push(mk('zhiShiDoor', fuShi.zhiShi, menLand, 'renPan'));
  // 天禽寄宫携干：仅转盘（飞盘 tianPan 无 companionStar → 自动跳过）
  const ruiG = Number(Object.keys(palaces.tianPan || {}).find((k) => palaces.tianPan[k].companionStar === '天禽'));
  if (Number.isFinite(ruiG) && ruiG > 0 && earthPlate[5]) {
    markers.push(mk('companionStem', earthPlate[5], ruiG, 'tianPan'));
  }
  return markers;
}

/** 阶段起点：出生日，转换后挂钟小时 ∈ [0,7] 减 1 天（对拍实测）。 */
function stageBaseDate(wall) {
  let d = Solar.fromYmd(wall.year, wall.month, wall.day);
  if (wall.hour >= 0 && wall.hour <= 7) d = d.next(-1);
  return d;
}

function addYears(solarDate, years) {
  const t = new Date(Date.UTC(solarDate.getYear() + years, solarDate.getMonth() - 1, solarDate.getDay()));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** 阶段干宫序：甲干按「地盘→天盘」，非甲干按宫序升（同宫天先）——对拍实测。 */
function stageStemPair(stem, gz, palaces, earthPlate) {
  const { diPan, tianPan } = stemPalaces(stem, gz, palaces, earthPlate, false);
  if (stem === '甲') return [diPan, tianPan];
  return [tianPan, diPan].sort((a, b) => (a - b) || (a === tianPan ? -1 : 1));
}

/** 四柱分限（stages）。 */
export function buildStages({ calendar, normalized, fuShi, palaces, earthPlate, juInfo }) {
  const base = stageBaseDate(normalized.wall);
  const baseStr = `${base.getYear()}-${pad2(base.getMonth())}-${pad2(base.getDay())}`;
  const monthZhi = calendar.monthGanZhi.charAt(1);
  const menLand = menFly(fuShi.homePalace, fuShi.k, juInfo.isYangDun);

  const pillars = [
    { key: '年', dom: [...stageStemPair(calendar.yearGanZhi.charAt(0), calendar.yearGanZhi, palaces, earthPlate), BRANCH_PALACE[calendar.yearGanZhi.charAt(1)]], markers: [`年干${calendar.yearGanZhi.charAt(0)}`, `年支${calendar.yearGanZhi.charAt(1)}`] },
    { key: '月', dom: [...stageStemPair(calendar.monthGanZhi.charAt(0), calendar.monthGanZhi, palaces, earthPlate), BRANCH_PALACE[monthZhi]], markers: [`月干${calendar.monthGanZhi.charAt(0)}`, `月支${monthZhi}`] },
    { key: '日', dom: stageStemPair(calendar.dayGanZhi.charAt(0), calendar.dayGanZhi, palaces, earthPlate), markers: [`日干${calendar.dayGanZhi.charAt(0)}`] },
    { key: '时', dom: [...stageStemPair(calendar.hourGanZhi.charAt(0), calendar.hourGanZhi, palaces, earthPlate), menLand], markers: [`时干${calendar.hourGanZhi.charAt(0)}`, `值使${fuShi.zhiShi}`] },
  ];

  return STAGE_AGES.map(({ start, end }, i) => {
    const dom = [...new Set(pillars[i].dom.filter((p) => Number.isFinite(p) && p > 0))];
    const facts = stageFacts(palaces, dom);
    return {
      stageIndex: i,
      title: STAGE_TITLES[i],
      ageStart: start,
      ageEnd: end,
      calendarStart: i === 0 ? baseStr : addYears(base, start),
      calendarEnd: addYears(base, end),
      dominantPalaces: dom.map((p) => ({ palace: p, name: NINE_PALACES[p].name })),
      associatedMarkers: pillars[i].markers,
      stageTheme: STAGE_THEMES[pillars[i].key],
      supportFacts: facts.supportFacts,
      constraintFacts: facts.constraintFacts,
      limitations: [STAGE_LIMITATION],
    };
  });
}

/** 阶段支持/限制白话（自撰简化，信息性不进关键字段）。 */
function stageFacts(palaces, stagePalaces) {
  const doorGood = { 休门: '临三大吉门之休门，人事实质通达顺畅', 生门: '临三大吉门之生门，人事进取得助', 开门: '临三大吉门之开门，人事开张进取' };
  const doorBad = { 死门: '临凶门死门，需防滞塞阻力、言语是非或折伤耗散', 惊门: '临凶门惊门，需防惊恐惊扰、口舌是非', 伤门: '临凶门伤门，需防损伤争斗、折伤耗散', 杜门: '临杜门，主隐秘闭塞，宜潜心深耕而不利高调激进' };
  const godGood = { 值符: '得吉神值符护持，贵人引路、协同有方', 六合: '得吉神六合护持，贵人引路、协同有方', 太阴: '得吉神太阴护持，贵人引路、协同有方', 九天: '得吉神九天护持，贵人引路、协同有方' };
  const godBad = { 白虎: '值白虎乘临，警惕暗耗、口舌争执或意外波动', 玄武: '值玄武乘临，警惕暗昧欺诈、虚耗反复', 螣蛇: '值螣蛇乘临，警惕虚惊反复、意外波动', 九地: '值九地乘临，主迟缓滞留、蓄势待变' };
  const support = [];
  const constraint = [];
  for (const p of stagePalaces) {
    const rp = (palaces.renPan || {})[p] || {};
    const sp = (palaces.shenPan || {})[p] || {};
    if (doorGood[rp.door]) support.push(doorGood[rp.door]);
    if (doorBad[rp.door]) constraint.push(doorBad[rp.door]);
    if (godGood[sp.god]) support.push(godGood[sp.god]);
    if (godBad[sp.god]) constraint.push(godBad[sp.god]);
  }
  return { supportFacts: support, constraintFacts: constraint };
}

/** 九宫单行摘要（topicCandidates.patternSummary 用）。 */
function palaceSummary(palaces, g) {
  const tp = palaces.tianPan[g] || {};
  const dp = palaces.diPan[g] || {};
  const rp = palaces.renPan[g] || {};
  const sp = palaces.shenPan[g] || {};
  return `${NINE_PALACES[g].name}: 人盘${rp.door || '无'}，神盘${sp.god || '无'}，天盘${tp.star || '无'}，干组合: ${tp.stem || ''}+${dp.stem || ''}`;
}

/** 九大人生主题（自撰解读层，只保形状；topic/topicName 进门禁）。 */
export function buildTopicCandidates({ palaces, calendar, fuShi, juInfo }) {
  const topicDoors = { career: '开门', wealth: '生门', marriage: '六合', health: '死门', academic: '景门', relocation: '开门', family: '休门', children: '杜门', partnership: '惊门' };
  const topicGods = { career: '值符', wealth: '九地', marriage: '六合', health: '天芮', academic: '太阴', relocation: '九天', family: '太阴', children: '六合', partnership: '六合' };
  const menLand = menFly(fuShi.homePalace, fuShi.k, juInfo.isYangDun);
  const basisByTopic = {
    career: '《统宗》开门专司官爵仕途，值符为百官尊长，克我者官鬼司名权威柄，景门司文书名望',
    wealth: '《统宗》生门专司财帛产业，甲子戊为青龙钱财资本，我克者妻财司日常资产，九地主储蓄',
    marriage: '《统宗》六合专司媒约婚姻，男取我克之妻财、女取克我之官鬼，乙庚为阴阳夫妇正配，休门司家庭',
    health: '《统宗》天芮星为疾病根源病灶，死门主气机滞塞，克我者官鬼疾厄司病患侵袭，伤门司外伤手术',
    academic: '《统宗》生我者父母司学业文凭庇荫，天辅为文曲导师，景门司试卷考选，丁奇为文书玉印',
    relocation: '《烟波钓叟歌》天马为动应之神，九天主升迁远行迁徙，开门司通达，伤门司车马动迁',
    family: '《统宗》生我者为父母长辈，年干为宗族根基，休门为宅舍庇护之宫',
    children: '《统宗》我生者子息司晚辈团队，时干司晚运终局与具体事态产出',
    partnership: '《统宗》比肩者兄弟司同侪伙伴与合伙人，六合主契约协议合作共事',
  };
  return TOPICS.map((t) => {
    const doorG = Number(Object.keys(palaces.renPan || {}).find((k) => palaces.renPan[k].door === topicDoors[t.topic]));
    const godG = Number(Object.keys(palaces.shenPan || {}).find((k) => palaces.shenPan[k].god === topicGods[t.topic]));
    const dayG = Number(Object.keys(palaces.diPan || {}).find((k) => palaces.diPan[k].stem === calendar.dayGanZhi.charAt(0)));
    const primary = [...new Set([doorG, godG, dayG, palaces.zhiFuPalace].filter((p) => Number.isFinite(p) && p > 0))];
    const secondary = [...new Set([menLand, BRANCH_PALACE[calendar.hourGanZhi.charAt(1)]].filter((p) => Number.isFinite(p) && p > 0 && !primary.includes(p)))];
    return {
      topic: t.topic,
      topicName: t.topicName,
      primaryPalaces: primary,
      secondaryPalaces: secondary,
      basis: basisByTopic[t.topic],
      patternSummary: primary.map((g) => palaceSummary(palaces, g)),
    };
  });
}

/** basis 元信息。 */
function buildBasis(normalized, juInfo) {
  return {
    calendar: '公历',
    solarTerm: juInfo.currentTerm,
    timeStandard: '法定民用时',
    timeZoneUsed: `${normalized.timeZoneId} (${fmtOffsetHours(normalized.offset)})`,
    method: normalized.method,
    juMethod: normalized.juMethod,
    stagePolicy: { ...STAGE_POLICY },
  };
}

/** baseChart：复用 qimen assemble（时家形状），去掉 meta（旧实现 baseChart 无 meta），
 *  并修正两处 qimen 内核未入门禁的口径（空亡、五不遇——按旧实现对拍实测）。 */
function buildBaseChart({ normalized, calendar, juInfo, earthPlate, fuShi, palaces }) {
  const chart = assemble({ normalized, calendar, juInfo, earthPlate, fuShi, palaces, now: new Date(0) });
  delete chart.meta;
  const voids = computeVoidLifetime(calendar, normalized);
  chart.voidBranches = voids.voidBranches;
  chart.voidPalaces = voids.voidPalaces;
  chart.specialConditions = computeSpecialConditionsLifetime(calendar);
  return chart;
}

/** ④ 输出装配（终身局）。 */
export function calculateQimenLifetimeCore(params) {
  const normalized = normalizeInput(params);                     // ①
  const calendar = resolveCalendar(normalized);                  // ② 历法/四柱（复用 qimen）
  const juInfo = resolveJuLifetime(calendar, normalized);        // ② 定局（符头修正）
  const earthPlate = buildEarthPlate(juInfo.juShu, juInfo.isYangDun); // ② 地盘
  const fuShi = computeFuShi(calendar, normalized, juInfo, earthPlate); // ② 符使
  const palaces = normalized.qimenMethod === 'feipan'            // ③ 起局
    ? computePalacesFeipan({ juInfo, earthPlate, fuShi, normalized })
    : computePalacesZhuanpan({ juInfo, earthPlate, fuShi, calendar, normalized });

  const baseChart = buildBaseChart({ normalized, calendar, juInfo, earthPlate, fuShi, palaces });
  const basis = buildBasis(normalized, juInfo);
  const personalMarkers = buildPersonalMarkers({ palaces, fuShi, calendar, earthPlate, juInfo });
  const stages = buildStages({ calendar, normalized, fuShi, palaces, earthPlate, juInfo });
  const topicCandidates = buildTopicCandidates({ palaces, calendar, fuShi, juInfo });

  return {
    schemaVersion: SCHEMA_VERSION,
    input: {
      birthDateTime: normalized.birthDateTime,
      timeZoneId: normalized.timeZoneId,
      location: normalized.location,
      calendarType: normalized.calendarType,
      timeStandard: normalized.timeStandard,
      method: normalized.method,
      juMethod: normalized.juMethod,
    },
    basis,
    baseChart,
    personalMarkers,
    topicCandidates,
    stages,
  };
}

export default calculateQimenLifetimeCore;
