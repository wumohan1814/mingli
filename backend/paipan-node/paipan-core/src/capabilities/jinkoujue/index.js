/**
 * 命理 · 自研排盘内核 · 能力：金口诀（jinkoujue）
 * ---------------------------------------------------------------------------
 * 导出 `generateJinkoujueCore(params)` —— 与旧实现 `generateJinkoujue(params)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状，19 个顶层键）。
 *
 * 四段纯函数管线（README §1）：
 *   ① normalizeInput —— 起课方式归一 + 地分求解（time/branch/number/random），缺输入抛错
 *   ② resolveCalendar —— 四柱 / 月将 / 昼夜 / 贵人 / 旬空（唯一使用 lunar-typescript 处）
 *   ③ 判定层 —— buildPositions 四位一体 / computeRelations / resolveYinYangUse 发用 /
 *      computeMovements 五动三动 / computeBihePoem 比合歌
 *   ④ assemble
 *
 * == 对拍实测确认的口径（黑盒探针 420+ 例扫描 + 12 中气边界 + 定向穷举，见 tools/_probe/jinkoujue/）==
 *   1. 四柱：年/月/日干支 = Exact（立春/节气精确时刻换界、晚子时 23:00 换日），时干支五鼠遁自实现
 *   2. 月将：按已交中气取（雨水后亥…大寒后子；换将点=中气精确时刻，与 liuren 同天文口径）
 *   3. 昼夜：占时支 卯～申 昼占、酉～寅 夜占
 *   4. 贵人：十干昼夜贵人表（与 liuren 同）；贵神顺逆 = 贵人支临 亥子丑寅卯辰 顺布、
 *      巳午未申酉戌 逆布（10 日干×昼夜 20 例实测，辛/壬/癸日夜占为顺布的边界由此锁定）
 *   5. 贵神 = 十二贵神[(地分支 − 贵人支) mod 12]（顺布）或 [(贵人支 − 地分支) mod 12]（逆布）；
 *      贵神支 = 本属地支（勾陈=辰 等 12 神本属表）；贵神 element = 本属五行；
 *      positions.guiShen.stem = **遁至贵神支之干**（不是本属干！）
 *   6. 将神 = 月将加时后天盘地分上临支：将神支 = 地分支 + (月将 − 占时)（顺行 12 支）
 *   7. 五子元遁：人元=遁至地分支、神干=遁至贵神支、将干=遁至将神支
 *   8. 五行归属：地分按地分支、将神按月将支、贵神按贵神本属、人元按人元干（elementBasis 文本）
 *   9. 月令旺衰：旺=与月同、相=月生我、休=我生月、囚=我克月、死=月克我；
 *      旺/相 → support、休/囚/死 → constraints；旬空 → constraints 追加「落日旬空」
 *   10. 阴阳发用：地分/将神/贵神按支阴阳、人元按干阴阳；二阴二阳→将神、
 *       三阳一阴→唯一阴位、三阴一阳→唯一阳位、纯阳→贵神、纯阴→将神。
 *       数学事实：五鼠遁子时干恒阳且干序奇偶=支序奇偶，故遁干阴阳≡地分支阴阳，
 *       唯一阴/阳位只会落在将神或贵神（实测 253 例无地分/人元反例）
 *   11. 五动三动：五动 = 妻动(人元克地分)/官动(贵神克人元)/贼动(贵神克将神)/财动(将神克贵神)/
 *       鬼动(地分克人元)；三动 = 兄弟动(人元比和地分)/子孙动(人元生地分)/父母动(地分生人元)；
 *       同课多动按 妻→官→贼→财→鬼（五动）→三动 次序（实测多动样例排序）
 *   12. bihePoem：四位五行计数 ≥3 用「三X」句（四同亦用三X句）、=2 用「二X」句
 *       （两对按木火土金水序「；」拼接）、全不同用「四位五行周流」句
 *   13. calculation.* 口径句模板（diFenNote/noblemanRule/guiShenRule 等逐条反推，进关键字段）
 *
 * == 与旧实现的有意分歧（已在夹具 notes 登记）==
 *   - 缺 customDate / 缺 method：旧实现静默回落「当前时间」或默认 time；本内核一律抛错（确定性纪律）。
 *   - random 起课：旧实现接受 seed（确定性 PRNG，未能反推其算法）/ replay 数组 / 自定义随机函数。
 *     本内核只接受 `params.random`（返回 [0,1) 的函数）或 `params.replay`（[0,1) 数组）或
 *     `params.seed`（自研 mulberry32，与旧实现不一致），缺三者抛错；夹具不放 random 条（无法对拍）。
 *   - customDate 传 ISO 字符串：旧实现抛「自定义时间不是有效日期。」；本内核按内核契约接受
 *     ISO 字符串（Date 与字符串同义），属放宽。
 *   - meta.*：engineVersion 用自研值（0.1.0-mingli），inputHash/resultId 用自写 FNV-1a。
 */
import { Solar } from 'lunar-typescript';
import {
  ZHI,
  GAN,
  ZHI_WUXING,
  GAN_WUXING,
  SHENG,
  KE,
  GAN_YY,
  ZHI_YY,
  WU_SHU_DUN,
  GUI_SHEN_ORDER,
  GUI_SHEN_BENSHU,
  SI_XIANG_ROLES,
  SEASON_STATE_BY_MONTH,
  YIN_YANG_USE,
  MOVEMENTS,
  BIHE_POEMS,
  BIHE_ORDER,
  NOBLEMAN_TABLE,
  HOUR_LABELS,
  CALC_TEMPLATES,
} from '../../rules/jinkoujue.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';
import { julianEphemerisDay, apparentEclipticLongitude } from '../astrology/ephemeris.js';

export const ENGINE_VERSION = '0.1.0-mingli';
export const SCHEMA_VERSION = '1.0.0';
const CST_OFFSET_MINUTES = 480;

export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

const mod = (n, m) => ((Math.trunc(n) % m) + m) % m;
const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0');
const zi = (b) => ZHI.indexOf(b);
const zhiAt = (i) => ZHI[mod(i, 12)];

/* ---------------- ① 输入归一化 ---------------- */

function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) instantMs = value.getTime();
  else if (typeof value === 'number' && Number.isFinite(value)) instantMs = value;
  else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析（支持 ISO 8601 或 Date）: ${value}`);
    const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4] ?? 0), minute: Number(m[5] ?? 0), second: Number(m[6] ?? 0) };
    const ranges = [[parts.month, 1, 12, '月'], [parts.day, 1, 31, '日'], [parts.hour, 0, 23, '时'], [parts.minute, 0, 59, '分'], [parts.second, 0, 59, '秒']];
    for (const [v, lo, hi, label] of ranges) {
      if (!Number.isInteger(v) || v < lo || v > hi) throw new PaipanInputError('invalid_custom_date', `customDate 的${label}超出范围（${lo}-${hi}）: ${v}`);
    }
    let offsetMinutes = CST_OFFSET_MINUTES;
    if (m[7] === 'Z') offsetMinutes = 0;
    else if (m[7]) {
      const sign = m[7][0] === '-' ? -1 : 1;
      const body = m[7].slice(1).replace(':', '');
      offsetMinutes = sign * (Number(body.slice(0, 2)) * 60 + Number(body.slice(2, 4)));
    }
    instantMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - offsetMinutes * 60000;
    const check = new Date(instantMs + offsetMinutes * 60000);
    const rt = { year: check.getUTCFullYear(), month: check.getUTCMonth() + 1, day: check.getUTCDate(), hour: check.getUTCHours(), minute: check.getUTCMinutes(), second: check.getUTCSeconds() };
    for (const key of ['year', 'month', 'day', 'hour', 'minute', 'second']) {
      if (rt[key] !== parts[key]) throw new PaipanInputError('invalid_custom_date', `customDate 不是真实存在的时刻（${key} 被进位）: ${value}`);
    }
  } else {
    throw new PaipanInputError('invalid_custom_date', `customDate 类型不支持（需 Date 或 ISO 字符串）: ${typeof value}`);
  }
  if (!Number.isFinite(instantMs)) throw new PaipanInputError('invalid_custom_date', 'customDate 不是有效日期。');
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  const wall = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(),
  };
  const isoOffset8 = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}+08:00`;
  return { instantMs, wall, isoOffset8 };
}

/** mulberry32（自研随机起课的 seed PRNG；与旧实现不一致，见文件头有意分歧）。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 随机起课样本源：params.random 函数 > params.replay 数组 > params.seed；缺三者抛错。 */
function randomSample(params) {
  if (typeof params.random === 'function') {
    const v = params.random();
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new PaipanInputError('bad_random_source', '自定义随机源必须返回大于等于 0 且小于 1 的数字。');
    }
    return v;
  }
  if (Array.isArray(params.replay)) {
    if (params.replay.length === 0) throw new PaipanInputError('bad_replay', '随机重放样本必须是非空数组。');
    const v = params.replay[0];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
      throw new PaipanInputError('bad_replay', '随机源必须返回大于等于 0 且小于 1 的数字。');
    }
    return v;
  }
  if (params.seed !== undefined && params.seed !== null) {
    return mulberry32(Number(params.seed))();
  }
  throw new PaipanInputError(
    'random_requires_source',
    '随机起课必须提供其一：seed（自研 PRNG，与旧实现不同）、replay（[0,1) 数组）或 random（返回 [0,1) 的函数）。本内核不接受真随机。',
  );
}

/**
 * ① 输入归一化 + 起课方式归一 + 地分求解。
 * @param {object|undefined|null} params `{ method, customDate, branch?, number?, seed?, replay?, random?, now? }`
 * @returns {{method, diFenBranch, diFenInputBase, diFenNote, wall, instantMs, isoOffset8, hashInput}}
 * @throws {PaipanInputError} 缺 method / 缺 customDate / 非法起课参数
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_params', '金口诀起课必须传 params 对象（method + customDate）。');
  }
  const method = params.method === undefined || params.method === null ? 'time' : params.method;
  if (!['time', 'branch', 'number', 'random'].includes(method)) {
    throw new PaipanInputError('bad_method', `未知的金口诀起课方式: ${method}`);
  }
  if (params.customDate === undefined || params.customDate === null) {
    throw new PaipanInputError('missing_custom_date', '金口诀起课必须传 customDate（Date 或 ISO 字符串）；本内核不接受缺省时间，也不会回落「当前时间」。');
  }
  const { instantMs, wall, isoOffset8 } = toCstWallClock(params.customDate);

  let diFenBranch;
  let diFenInputBase;
  let diFenNote;
  if (method === 'time') {
    const hIdx = hourIndex(wall.hour);
    diFenBranch = zhiAt(mod(hIdx, 12));
    diFenInputBase = mod(hIdx, 12) + 1;
    diFenNote = `时间起课以占时${diFenBranch}为地分`;
  } else if (method === 'branch') {
    if (typeof params.branch !== 'string' || !ZHI.includes(params.branch)) {
      throw new PaipanInputError('bad_branch', '金口诀指定地分必须是子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥之一。');
    }
    diFenBranch = params.branch;
    diFenInputBase = zi(params.branch) + 1;
    diFenNote = `按所测方位或来意指定地分${params.branch}`;
  } else if (method === 'number') {
    if (!Number.isInteger(params.number) || params.number < 1) {
      throw new PaipanInputError('bad_number', '金口诀数字起课必须提供不小于 1 的整数。');
    }
    const norm = mod(params.number - 1, 12) + 1;
    diFenBranch = zhiAt(norm - 1);
    diFenInputBase = params.number;
    diFenNote = `数字起课以${params.number}归一为${norm}，对应地分${diFenBranch}`;
  } else {
    const sample = randomSample(params);
    const norm = Math.floor(sample * 12) + 1;
    diFenBranch = zhiAt(norm - 1);
    diFenInputBase = norm;
    diFenNote = `随机起课抽得${norm}，对应地分${diFenBranch}`;
  }

  return {
    method,
    diFenBranch,
    diFenInputBase,
    diFenNote,
    wall,
    instantMs,
    isoOffset8,
    hashInput: {
      capability: 'jinkoujue',
      method,
      wall: isoOffset8,
      branch: method === 'branch' ? params.branch : undefined,
      number: method === 'number' ? params.number : undefined,
      seed: method === 'random' && params.seed !== undefined ? params.seed : undefined,
    },
  };
}

/* ---------------- ② 历法/起局 ---------------- */

/** 时辰序：0=早子时 … 11=亥时，12=晚子时。 */
export function hourIndex(hour) {
  const h = Math.trunc(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) throw new PaipanInputError('bad_hour', `小时越界: ${hour}`);
  if (h === 23) return 12;
  return Math.floor((h + 1) / 2);
}

/** 五子元遁：日干与时辰序 → 时干支（自实现，与 lunar-typescript 一致）。 */
export function ganZhiFromDay(dayGanZhi, hIdx) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  if (!startGan) throw new PaipanInputError('bad_day_ganzhi', `日干支无法解析: ${dayGanZhi}`);
  const step = mod(hIdx, 12);
  return GAN[(GAN.indexOf(startGan) + step) % 10] + ZHI[step];
}

/**
 * 月将 = 太阳过宫（视黄经整 30° 倍数换将），与 liuren 同天文口径：
 *   亥(330°起) 戌(0°起) 酉(30°) 申(60°) 未(90°) 午(120°) 巳(150°) 辰(180°) 卯(210°) 寅(240°) 丑(270°) 子(300°)。
 * 黑盒实测 12 中气边界换将点与天文一致（探针 p6）。
 */
export function monthLeaderOf(lunar, instantMs) {
  const jde = julianEphemerisDay(instantMs);
  const sunLon = apparentEclipticLongitude('Sun', jde);
  const idx = Math.floor(((sunLon + 30) % 360) / 30) % 12;
  const ORDER = ['亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子'];
  return ORDER[idx];
}

export function resolveCalendar(normalized) {
  const { wall } = normalized;
  const solar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);
  const lunar = solar.getLunar();
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const hIdx = hourIndex(wall.hour);
  return {
    wall,
    yearGanZhi: lunar.getYearInGanZhiExact(),
    monthGanZhi: lunar.getMonthInGanZhiExact(),
    dayGanZhi,
    hourGanZhi: ganZhiFromDay(dayGanZhi, hIdx),
    hourIndex: hIdx,
    hourLabel: HOUR_LABELS[hIdx],
    hourBranch: zhiAt(mod(hIdx, 12)),
    monthLeader: monthLeaderOf(lunar, normalized.instantMs),
    monthBranch: lunar.getMonthInGanZhiExact().slice(1), // 月建 = 月干支之支
  };
}

/** 昼夜：占时支 卯(3)～申(8) 昼占。 */
export function dayNightOf(hourBranch) {
  const i = zi(hourBranch);
  return i >= 3 && i <= 8 ? '昼占' : '夜占';
}

/** 十干昼夜贵人（复用权威表）。 */
export function noblemanOf(dayStem, dayNight) {
  const t = NOBLEMAN_TABLE[dayStem];
  if (!t) throw new PaipanInputError('bad_day_stem', `日干无法解析: ${dayStem}`);
  return t[dayNight];
}

/** 旬空：日柱所在旬的空亡二支（旬首支 +10/+11）。 */
export function xunKongOf(dayGanZhi) {
  const ganIdx = GAN.indexOf(dayGanZhi.slice(0, 1));
  const zhiIdx = zi(dayGanZhi.slice(1));
  const xunShouZhi = mod(zhiIdx - ganIdx, 12);
  return [zhiAt(mod(xunShouZhi + 10, 12)), zhiAt(mod(xunShouZhi + 11, 12))];
}

/** 贵神顺逆：贵人支临 亥子丑寅卯辰(11,0,1,2,3,4) 顺布，巳午未申酉戌(5..10) 逆布。 */
export function noblemanDirectionOf(noblemanBranch) {
  const i = zi(noblemanBranch);
  return i === 11 || i <= 4 ? '顺布' : '逆布';
}

/** 贵神：十二贵神[(地分支 − 贵人支) mod 12]（顺布）或 [(贵人支 − 地分支) mod 12]（逆布）。 */
export function guiShenOf(noblemanBranch, diFenBranch, direction) {
  const step = direction === '顺布'
    ? mod(zi(diFenBranch) - zi(noblemanBranch), 12)
    : mod(zi(noblemanBranch) - zi(diFenBranch), 12);
  return GUI_SHEN_ORDER[step];
}

/* ---------------- ③ 判定层 ---------------- */

/** 五行关系（「前者我」视角）：生=我生他、被生=他生我、克=我克他、被克=他克我、比和=同。 */
export function elementRelation(elA, elB) {
  if (elA === elB) return '比和';
  if (SHENG[elA] === elB) return '生';
  if (SHENG[elB] === elA) return '被生';
  if (KE[elA] === elB) return '克';
  return '被克';
}

/** 五子元遁至某支：日干 + 目标支 → 遁干。 */
export function dunGanOf(dayGanZhi, branch) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  const step = zi(branch);
  return GAN[(GAN.indexOf(startGan) + step) % 10];
}

/**
 * ③ 四位一体装配。返回 { positions, relations }。
 * 每个位置 14 键：name/role/branch/stem/stemElement/god/element/elementBasis/yinYang/
 * seasonState/isVoid/support[]/constraints[]/promptText（地分无 stem/stemElement/god）。
 */
export function buildPositions({ dayGanZhi, diFenBranch, monthLeader, hourBranch, noblemanBranch, monthBranch, xunKong }) {
  const shift = mod(zi(monthLeader) - zi(hourBranch), 12);      // 月将加时
  const jiangBranch = zhiAt(zi(diFenBranch) + shift);            // 地分上临支 = 将神支
  const direction = noblemanDirectionOf(noblemanBranch);
  const god = guiShenOf(noblemanBranch, diFenBranch, direction);
  const benshu = GUI_SHEN_BENSHU[god];
  const monthEl = ZHI_WUXING[monthBranch];
  const seasonOf = (el) => SEASON_STATE_BY_MONTH[monthEl][el];

  const make = (key, { branch, stem, element, elementBasis, yinYang, godName }) => {
    const seasonState = seasonOf(element);
    const isVoid = xunKong.includes(branch);
    const support = [];
    const constraints = [];
    if (seasonState === '旺') support.push('月令旺');
    else if (seasonState === '相') support.push('月令相');
    else if (seasonState === '休') constraints.push('月令休');
    else if (seasonState === '囚') constraints.push('月令囚');
    else constraints.push('月令死');
    if (isVoid) constraints.push('落日旬空');
    return {
      name: { diFen: '地分', jiangShen: '将神', guiShen: '贵神', renYuan: '人元' }[key],
      role: SI_XIANG_ROLES[key],
      branch,
      stem,
      stemElement: stem === undefined ? undefined : GAN_WUXING[stem],
      god: godName,
      element,
      elementBasis,
      yinYang,
      seasonState,
      isVoid,
      support,
      constraints,
    };
  };

  const diFenStem = dunGanOf(dayGanZhi, diFenBranch);
  const jiangStem = dunGanOf(dayGanZhi, jiangBranch);
  const guiStem = dunGanOf(dayGanZhi, benshu.zhi);

  const diFen = make('diFen', {
    branch: diFenBranch, stem: undefined, element: ZHI_WUXING[diFenBranch],
    elementBasis: '地分支', yinYang: ZHI_YY[diFenBranch] ? '阳' : '阴',
  });
  const jiangShen = make('jiangShen', {
    branch: jiangBranch, stem: jiangStem, element: ZHI_WUXING[jiangBranch],
    elementBasis: '月将支', yinYang: ZHI_YY[jiangBranch] ? '阳' : '阴',
  });
  const guiShen = make('guiShen', {
    branch: benshu.zhi, stem: guiStem, element: benshu.wuxing,
    elementBasis: '贵神本属', yinYang: ZHI_YY[benshu.zhi] ? '阳' : '阴', godName: god,
  });
  const renYuan = make('renYuan', {
    branch: diFenBranch, stem: diFenStem, element: GAN_WUXING[diFenStem],
    elementBasis: '人元干', yinYang: GAN_YY[diFenStem] ? '阳' : '阴',
  });

  // promptText（黑盒实测模板；地分/人元无遁干从句）
  const voidText = (isVoid) => (isVoid ? '旬空' : '不空');
  diFen.promptText = `地分${diFen.branch}；${diFen.yinYang}${diFen.element}（按地分支）；月令${diFen.seasonState}；${voidText(diFen.isVoid)}`;
  jiangShen.promptText = `将神${jiangShen.stem}${jiangShen.branch}；${jiangShen.yinYang}${jiangShen.element}（按月将支）；遁干${jiangShen.stem}属${jiangShen.stemElement}；月令${jiangShen.seasonState}；${voidText(jiangShen.isVoid)}`;
  guiShen.promptText = `贵神${guiShen.stem}${guiShen.branch}；乘${guiShen.god}；${guiShen.yinYang}${guiShen.element}（按贵神本属）；遁干${guiShen.stem}属${guiShen.stemElement}；月令${guiShen.seasonState}；${voidText(guiShen.isVoid)}`;
  renYuan.promptText = `人元${renYuan.stem}${renYuan.branch}；${renYuan.yinYang}${renYuan.element}（按人元干）；月令${renYuan.seasonState}；${voidText(renYuan.isVoid)}`;

  const relations = {
    guiToJiang: elementRelation(guiShen.element, jiangShen.element),
    guiToRen: elementRelation(guiShen.element, renYuan.element),
    jiangToDi: elementRelation(jiangShen.element, diFen.element),
    renToDi: elementRelation(renYuan.element, diFen.element),
    guiToDi: elementRelation(guiShen.element, diFen.element),
  };
  return { positions: { diFen, jiangShen, guiShen, renYuan }, relations };
}

/**
 * 阴阳发用：统计四位阴阳（人元按干）。返回 { pattern, yinCount, yangCount, usePosition, rule, isVoid }。
 */
export function resolveYinYangUse({ positions, xunKong }) {
  const yy = [
    positions.diFen.yinYang,
    positions.jiangShen.yinYang,
    positions.guiShen.yinYang,
    positions.renYuan.yinYang,
  ];
  const yinCount = yy.filter((v) => v === '阴').length;
  const yangCount = 4 - yinCount;
  let spec;
  if (yinCount === 2 && yangCount === 2) spec = YIN_YANG_USE['二阴二阳'];
  else if (yinCount === 1) spec = YIN_YANG_USE['三阳一阴'];
  else if (yangCount === 1) spec = YIN_YANG_USE['三阴一阳'];
  else if (yangCount === 4) spec = YIN_YANG_USE['纯阳'];
  else spec = YIN_YANG_USE['纯阴'];

  let usePosition;
  if (spec.usePosition === '将神') usePosition = '将神';
  else if (spec.usePosition === '贵神') usePosition = '贵神';
  else if (spec.usePosition === '唯一阴位') {
    usePosition = positions.diFen.yinYang === '阴' ? '地分' : positions.jiangShen.yinYang === '阴' ? '将神' : positions.guiShen.yinYang === '阴' ? '贵神' : '人元';
  } else {
    usePosition = positions.diFen.yinYang === '阳' ? '地分' : positions.jiangShen.yinYang === '阳' ? '将神' : positions.guiShen.yinYang === '阳' ? '贵神' : '人元';
  }
  const useBranch = { 地分: positions.diFen, 将神: positions.jiangShen, 贵神: positions.guiShen, 人元: positions.renYuan }[usePosition].branch;
  return {
    pattern: spec.pattern,
    yinCount,
    yangCount,
    usePosition,
    rule: spec.rule,
    isVoid: xunKong.includes(useBranch),
  };
}

/** 五动三动：按 MOVEMENTS 固定次序收集触发的动爻。 */
export function computeMovements({ positions }) {
  const el = {
    地分: positions.diFen.element,
    将神: positions.jiangShen.element,
    贵神: positions.guiShen.element,
    人元: positions.renYuan.element,
  };
  const relationVerb = { 克: '克', 生: '生', 比和: '比和' };
  const out = [];
  for (const mv of MOVEMENTS) {
    const fromEl = el[mv.from];
    const toEl = el[mv.to];
    let hit = false;
    if (mv.relation === '克') hit = KE[fromEl] === toEl;
    else if (mv.relation === '生') hit = SHENG[fromEl] === toEl;
    else hit = fromEl === toEl;
    if (hit) {
      out.push({
        category: mv.category,
        name: mv.name,
        from: mv.from,
        to: mv.to,
        relation: mv.relation,
        trigger: `${mv.from}${fromEl}${relationVerb[mv.relation]}${mv.to}${toEl}`,
        source: mv.source,
      });
    }
  }
  return out;
}

/** 比合歌：四位五行计数 ≥3 三X 句、=2 二X 句（两对按木火土金水序）、全不同周流句。 */
export function computeBihePoem({ positions }) {
  const counts = {};
  for (const k of ['diFen', 'jiangShen', 'guiShen', 'renYuan']) {
    const e = positions[k].element;
    counts[e] = (counts[e] || 0) + 1;
  }
  const repeated = BIHE_ORDER.filter((e) => counts[e] >= 2);
  const triples = repeated.filter((e) => counts[e] >= 3);
  if (triples.length > 0) return BIHE_POEMS['三'][triples[0]];
  if (repeated.length > 0) {
    return repeated.map((e) => BIHE_POEMS['二'][e]).join('；');
  }
  return BIHE_POEMS['周流'];
}

/* ---------------- ④ 输出装配 ---------------- */

export function assemble(parts) {
  const { normalized, calendar, positions, relations, yinYangUse, movements, bihePoem, now } = parts;
  const { yearGanZhi, monthGanZhi, dayGanZhi, hourGanZhi, hourLabel, hourBranch, monthLeader, monthBranch } = calendar;
  const dayStem = dayGanZhi.slice(0, 1);
  const dayNight = parts.dayNight;
  const noblemanBranch = parts.noblemanBranch;
  const xunKong = parts.xunKong;
  const diFenBranch = normalized.diFenBranch;
  const direction = noblemanDirectionOf(noblemanBranch);
  const god = positions.guiShen.god;
  const benshu = GUI_SHEN_BENSHU[god];
  const m = normalized.method;
  const methodLabel = CALC_TEMPLATES.methodLabel[m];

  const usePosition = yinYangUse.usePosition;
  const usePos = { 地分: positions.diFen, 将神: positions.jiangShen, 贵神: positions.guiShen, 人元: positions.renYuan }[usePosition];

  // 释义层（自撰白话，保持旧实现形状；不进关键字段）
  const four = `人元${positions.renYuan.stem}${positions.renYuan.branch}、贵神${positions.guiShen.stem}${positions.guiShen.branch}乘${positions.guiShen.god}、将神${positions.jiangShen.stem}${positions.jiangShen.branch}、地分${positions.diFen.branch}`;
  const movText = movements.map((mv) => `${mv.name}（${mv.trigger}）`).join('、');
  const useText = `${usePosition}${usePos.stem === undefined ? '' : usePos.stem}${usePos.branch}`;
  const mainLine = `阴阳发用：${yinYangUse.rule}，取${useText}${usePos.promptText.slice(usePos.promptText.indexOf('；') + 1)}为用；四位：${four}；动爻：${movText}`;
  const summary = `${mainLine}。四位：地分${positions.diFen.branch}、将神${positions.jiangShen.stem}${positions.jiangShen.branch}、贵神${positions.guiShen.stem}${positions.guiShen.branch}乘${positions.guiShen.god}、人元${positions.renYuan.stem}${positions.renYuan.branch}。空亡：${xunKong.join('、')}`;

  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;

  return {
    method: m,
    methodLabel,
    ganzhi: { year: yearGanZhi, month: monthGanZhi, day: dayGanZhi, hour: hourGanZhi },
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    xunKong,
    diFenBranch,
    positions,
    relations,
    yinYangUse,
    movements,
    mainLine,
    bihePoem,
    calculation: {
      method: m,
      methodLabel,
      inputBase: normalized.diFenInputBase,
      inputBaseSource: CALC_TEMPLATES.inputBaseSource[m],
      diFenNote: normalized.diFenNote,
      monthLeaderRule: CALC_TEMPLATES.monthLeaderRule,
      yuanDunRule: CALC_TEMPLATES.yuanDunRule,
      dayNightRule: CALC_TEMPLATES.dayNightRule,
      noblemanRule: `${dayNight}贵人起${noblemanBranch}，从贵人起十二贵神排至地分${diFenBranch}`,
      noblemanDirection: direction,
      guiShenRule: `${direction}至地分得${god}，贵神本属${benshu.gan}${benshu.zhi}${benshu.wuxing}`,
    },
    focusEvidence: [
      { target: positions.diFen.promptText, role: positions.diFen.role, level: '辅证', evidence: [normalized.diFenNote, `地分支五行${positions.diFen.element}`], limitations: [] },
      { target: positions.jiangShen.promptText, role: '阴阳次第发用位', level: '主证', evidence: [`月将${monthLeader}加占时${hourBranch}`, `地分${diFenBranch}上临${positions.jiangShen.branch}`], limitations: [] },
      { target: positions.guiShen.promptText, role: positions.guiShen.role, level: '辅证', evidence: [`${dayNight}贵人起${noblemanBranch}${direction}`, `排至地分${diFenBranch}得${god}`, `贵神按本属${benshu.zhi}${benshu.wuxing}`], limitations: [] },
      { target: positions.renYuan.promptText, role: positions.renYuan.role, level: '辅证', evidence: [`日干${dayStem}五子元遁`, `地分${diFenBranch}遁得${positions.renYuan.stem}`], limitations: [] },
    ],
    summary,
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'jinkoujue',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `jinkoujue:${inputHash}`,
    },
  };
}

/**
 * 金口诀起课（自研内核）。
 * @param {object} params `{ method, customDate, branch?, number?, seed?, replay?, random?, now? }`
 *   - method：time / branch / number / random（缺省按 time，与旧实现一致）
 *   - customDate：**必填**。Date、ISO 8601 字符串或 epoch 毫秒数。
 *   - now：可选，仅用于 meta.calculatedAt（便于测试取固定值）。
 * @returns {object} 生产契约形状的排盘结果（19 个顶层键，stripInternal 后）
 * @throws {PaipanInputError} 缺 customDate / 非法起课参数
 */
export function generateJinkoujueCore(params) {
  const normalized = normalizeInput(params);              // ①
  const calendar = resolveCalendar(normalized);           // ②
  const dayGanZhi = calendar.dayGanZhi;
  const dayStem = dayGanZhi.slice(0, 1);
  const dayNight = dayNightOf(calendar.hourBranch);
  const noblemanBranch = noblemanOf(dayStem, dayNight);
  const xunKong = xunKongOf(dayGanZhi);

  const { positions, relations } = buildPositions({      // ③ 四位一体
    dayGanZhi,
    diFenBranch: normalized.diFenBranch,
    monthLeader: calendar.monthLeader,
    hourBranch: calendar.hourBranch,
    noblemanBranch,
    monthBranch: calendar.monthBranch,
    xunKong,
  });
  const yinYangUse = resolveYinYangUse({ positions, xunKong });
  const movements = computeMovements({ positions });
  const bihePoem = computeBihePoem({ positions });

  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({                                       // ④
    normalized, calendar, positions, relations, yinYangUse, movements, bihePoem,
    dayNight, noblemanBranch, xunKong, now,
  });
}

export default generateJinkoujueCore;
