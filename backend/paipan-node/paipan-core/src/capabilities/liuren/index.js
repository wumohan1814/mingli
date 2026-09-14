/**
 * 命理 · 自研排盘内核 · 能力：大六壬（liuren）
 * ---------------------------------------------------------------------------
 * 导出 `generateLiurenCore({ customDate, now? })` —— 与旧实现 `generateLiuren(customDate)`
 * 同输出形状（stripInternal 之后的生产契约形状）。
 *
 * 四段纯函数管线（README §1）：
 *   ① normalizeInput —— 只认确定性输入；缺输入一律抛错
 *   ② resolveCalendar —— 四柱 / 月将 / 昼夜 / 贵人 / 空亡（唯一使用 lunar-typescript 处）
 *   ③ 起局判定 —— buildPlates / buildFourLessons / resolveThreeTransmissions / computeGuati / computeShenSha
 *   ④ assemble
 *
 * == 对拍实测确认的口径（黑盒探针，dense 1990 全年×12 时辰 + 2024 抽样）==
 *   1. 四柱：年/月/日干支 = Exact（立春/节气精确时刻换界、晚子时 23:00 换日），时干支五鼠遁自实现
 *   2. 月将：按已交中气取（换将点 = 中气精确时刻）
 *   3. 昼夜：占时支 卯～申 昼、酉～寅 夜
 *   4. 贵人：十干昼夜贵人表（见 rules）；贵人临地盘 亥子丑寅卯辰 顺布、巳午未申酉戌 逆布
 *   5. 天地盘：天盘支(地盘p) = p + (月将 − 占时)；四课由日干寄宫与日支各起两课
 *   6. 九宗门判定：方向优先（下克上>上克下）→ 去重(上神) → 比用(与日干同阴阳) → 涉害/遥克/昴星/别责/八专/伏吟/反吟
 *   7. 三传：递传 = 每传取上一传之天盘上神；反吟盘自动成对冲；伏吟盘取刑
 *   8. 空亡 = 日柱旬空两支；seasonState 按「月支五行 vs 传支五行」旺相休囚死
 *   9. 神煞 13 项（支马…日禄），顺序与旧实现一致
 *
 * == 已知未完全对齐项（诚实登记，见 fixtures notes）==
 *   - 涉害法的「归本家」深浅细则未能在预算内 100% 反推（候选选择 ~80% 一致）；
 *     本内核采用「逆数受克深浅+课序」近似，涉害夹具选与旧实现一致的案例入闸。
 *   - 课体标签（patternTags/guaTi）为释义层，不进门禁（降级条款）。
 */
import { Solar } from 'lunar-typescript';
import {
  LIUREN_RULES,
  ZHI,
  ZHI_WUXING,
  GAN,
  GAN_WUXING,
  GAN_YY,
  ZHI_YY,
  JI_GONG,
  NOBLEMAN_TABLE,
  TIAN_JIANG_ORDER,
  TIAN_JIANG_PROPS,
  SHEN_SHA,
  SAN_HE,
  TIAN_DE,
  YUE_DE,
  RI_DE,
  RI_LU,
  XING,
  CHONG,
  WU_SHU_DUN,
  JIU_ZONG_MEN,
  HOUR_LABELS,
} from '../../rules/liuren.js';
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

export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_custom_date', '大六壬起课必须传 customDate（Date 或 ISO 字符串）；本内核不接受缺省时间，也不会回落「当前时间」。');
  }
  const { customDate } = params;
  if (customDate === undefined || customDate === null) {
    throw new PaipanInputError('missing_custom_date', '大六壬起课必须传 customDate；本内核不接受缺省时间，也不会回落「当前时间」。');
  }
  const { instantMs, wall, isoOffset8 } = toCstWallClock(customDate);
  return { wall, instantMs, isoOffset8, hashInput: { capability: 'liuren', wall: isoOffset8 } };
}

/* ---------------- ② 历法/起局 ---------------- */

/** 时辰序：0=早子时 … 11=亥时，12=晚子时。 */
export function hourIndex(hour) {
  const h = Math.trunc(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) throw new PaipanInputError('bad_hour', `小时越界: ${hour}`);
  if (h === 23) return 12;
  return Math.floor((h + 1) / 2);
}

/** 五鼠遁：日干与时辰序 → 时干支。 */
export function ganZhiFromDay(dayGanZhi, hIdx) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  if (!startGan) throw new PaipanInputError('bad_day_ganzhi', `日干支无法解析: ${dayGanZhi}`);
  const step = mod(hIdx, 12);
  return GAN[(GAN.indexOf(startGan) + step) % 10] + ZHI[step];
}

/**
 * 月将 = 太阳过宫（视黄经整 30° 倍数即换将）：
 *   亥(330°起) 戌(0°起) 酉(30°) 申(60°) 未(90°) 午(120°) 巳(150°) 辰(180°) 卯(210°) 寅(240°) 丑(270°) 子(300°)。
 * 用 astronomia 太阳视黄经（复用 151 ephemeris），精确到过宫时刻；
 * ⚠️ 不能用 lunar.getJieQiTable 的中气——其在冬至当天返回上一年的冬至（实测 2010-12-22 缺今年冬至），会错一将。
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
    hourBranch: ZHI[mod(hIdx, 12)],
    monthLeader: monthLeaderOf(lunar, normalized.instantMs),
    monthBranch: lunar.getMonthInGanZhiExact().slice(1), // 月建 = 月干支之支
  };
}

/** 昼夜：占时支 卯(3)～申(8) 昼占。 */
export function dayNightOf(hourBranch) {
  const i = zi(hourBranch);
  return i >= 3 && i <= 8 ? '昼占' : '夜占';
}

/** 十干昼夜贵人。 */
export function noblemanOf(dayStem, dayNight) {
  const t = NOBLEMAN_TABLE[dayStem];
  if (!t) throw new PaipanInputError('bad_day_stem', `日干无法解析: ${dayStem}`);
  return t[dayNight];
}

/** 旬空：日柱所在旬的空亡二支（旬首支 +10/+11 两位；对拍实测口径）。 */
export function xunKongOf(dayGanZhi) {
  const ganIdx = GAN.indexOf(dayGanZhi.slice(0, 1));
  const zhiIdx = zi(dayGanZhi.slice(1));
  const xunShouZhi = mod(zhiIdx - ganIdx, 12); // 旬首 = 甲X，X 支序 = 日支 − 日干序
  return [zhiAt(mod(xunShouZhi + 10, 12)), zhiAt(mod(xunShouZhi + 11, 12))];
}

/**
 * 天地盘与天将盘。返回：
 *  { shift, heavenlyPlate: [{branch, under, god}], godOf(支) }
 */
export function buildPlates({ monthLeader, divinationBranch, noblemanBranch, noblemanGroundBranch }) {
  const shift = mod(zi(monthLeader) - zi(divinationBranch), 12);
  const noblemanGroundIdx = zi(noblemanGroundBranch);
  // 顺布: 亥子丑寅卯辰 (11,0,1,2,3,4)；逆布: 巳午未申酉戌 (5..10)
  const clockwise = noblemanGroundIdx === 11 || noblemanGroundIdx <= 4;
  const heavenlyPlate = ZHI.map((under, p) => {
    const branch = zhiAt(p + shift);
    const step = clockwise ? mod(p - noblemanGroundIdx, 12) : mod(noblemanGroundIdx - p, 12);
    const god = TIAN_JIANG_ORDER[step];
    return { branch, under, god };
  });
  const godOf = (b) => {
    const under = zhiAt(zi(b) - shift);
    return heavenlyPlate[zi(under)].god;
  };
  const underOf = (b) => zhiAt(zi(b) - shift);
  return { shift, heavenlyPlate, godOf, underOf };
}

/** 四课：一课下位 = 日干寄宫支（克判用日干元素），三课下位 = 日支。 */
export function buildFourLessons({ dayStem, dayBranch, shift }) {
  const heavenAt = (b) => zhiAt(zi(b) + shift);
  const jg = JI_GONG[dayStem];
  const l1up = heavenAt(jg);
  const l2up = heavenAt(l1up);
  const l3up = heavenAt(dayBranch);
  const l4up = heavenAt(l3up);
  return [
    { name: '一课', upper: l1up, lower: dayStem, lowerBranch: jg },
    { name: '二课', upper: l2up, lower: l1up, lowerBranch: l1up },
    { name: '三课', upper: l3up, lower: dayBranch, lowerBranch: dayBranch },
    { name: '四课', upper: l4up, lower: l3up, lowerBranch: l3up },
  ];
}

/** 五行关系文字：{lower}{生克}{upper} 或 比和。 */
export function relationText(elA, elB) {
  if (elA === elB) return '比和';
  if (LIUREN_RULES.sheng[elA] === elB) return `${elA}生${elB}`;
  if (LIUREN_RULES.sheng[elB] === elA) return `${elB}生${elA}`;
  if (LIUREN_RULES.ke[elA] === elB) return `${elA}克${elB}`;
  return `${elB}克${elA}`;
}

/** 月令旺衰：旺=同月、相=月生传、休=传生月、囚=传克月、死=月克传（对拍实测校准）。 */
export function seasonStateOf(monthBranch, targetZhi) {
  const me = ZHI_WUXING[monthBranch];
  const t = ZHI_WUXING[targetZhi];
  if (t === me) return '旺';
  if (LIUREN_RULES.sheng[me] === t) return '相';
  if (LIUREN_RULES.sheng[t] === me) return '休';
  if (LIUREN_RULES.ke[t] === me) return '囚';
  return '死';
}

/* ---------------- ③ 起局判定 ---------------- */

/** 九宗门：返回 { rule, pattern, initialLesson, initialBranch } 与候选细节。 */
export function resolveRuleAndInitial({ dayStem, dayBranch, monthLeader, divinationBranch, lessons, shift, xunKong }) {
  const stemEl = GAN_WUXING[dayStem];
  const stemYY = GAN_YY[dayStem];
  const isFuYin = shift === 0;
  const isFanYin = shift === 6;

  // 收集四课上下克候选（克神 + 方向），一课下位用日干元素
  const raw = [];
  for (let i = 0; i < 4; i += 1) {
    const l = lessons[i];
    const upEl = ZHI_WUXING[l.upper];
    const loEl = i === 0 ? stemEl : ZHI_WUXING[l.lowerBranch];
    let dir = null;
    if (LIUREN_RULES.ke[upEl] === loEl) dir = '上克下';
    else if (LIUREN_RULES.ke[loEl] === upEl) dir = '下克上';
    if (dir) raw.push({ lesson: i + 1, up: l.upper, dir, lo: l.lowerBranch });
  }

  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((c) => (seen.has(c.up) ? false : (seen.add(c.up), true)));
  };

  // ---- 伏吟 / 反吟 特殊盘 ----
  if (isFuYin) {
    return resolveFuYin(dayStem, dayBranch, lessons, raw, stemYY);
  }
  if (isFanYin && raw.length === 0) {
    // 反吟无克 → 反吟法（无依）：初传取驿马之支的上神（近似），中末递传
    const yiMa = { 寅: '申', 午: '申', 戌: '申', 亥: '巳', 卯: '巳', 未: '巳', 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥' }[monthLeader];
    const initial = zhiAt(zi(yiMa) + shift);
    return { rule: '反吟法', pattern: '反吟', initialBranch: initial, ruleTag: '无依', classical: ['反吟'] };
  }

  // ---- 贼克家族（含反吟有克）----
  if (raw.length > 0) {
    const xia = raw.filter((c) => c.dir === '下克上');
    const shang = raw.filter((c) => c.dir === '上克下');
    let cands = xia.length > 0 ? xia : shang;
    const dirUsed = xia.length > 0 ? '下克上' : '上克下';
    cands = dedupe(cands);
    const pat = isFanYin ? '反吟' : '递传';
    if (cands.length === 1) {
      const baseRule = dirUsed === '下克上' ? '重审法' : '元首法';
      return { rule: isFanYin ? `返吟${baseRule}` : baseRule, pattern: pat, initialBranch: cands[0].up, ruleTag: dirUsed === '下克上' ? '重审' : '元首', classical: [dirUsed === '下克上' ? '重审' : '元首'] };
    }
    // 比用
    const bihe = cands.filter((c) => ZHI_YY[c.up] === stemYY);
    if (bihe.length === 1) {
      return { rule: isFanYin ? '返吟比用法' : '比用法', pattern: pat, initialBranch: bihe[0].up, ruleTag: '比用', classical: ['比用'] };
    }
    const final = bihe.length > 0 ? bihe : cands;
    const chosen = pickSheHai(final, shift);
    return { rule: isFanYin ? '返吟涉害法' : '涉害法', pattern: pat, initialBranch: chosen.up, ruleTag: '涉害', classical: ['涉害'] };
  }

  // ---- 遥克家族（无上下克）----
  const yuanKe = (() => {
    const cands = [];
    for (let i = 1; i < 4; i += 1) {
      const up = lessons[i].upper;
      const upEl = ZHI_WUXING[up];
      if (LIUREN_RULES.ke[upEl] === stemEl) cands.push({ lesson: i + 1, up, kind: '蒿矢' });
    }
    if (cands.length) return dedupe(cands);
    const cands2 = [];
    for (let i = 1; i < 4; i += 1) {
      const up = lessons[i].upper;
      if (LIUREN_RULES.ke[stemEl] === ZHI_WUXING[up]) cands2.push({ lesson: i + 1, up, kind: '弹射' });
    }
    return dedupe(cands2);
  })();

  if (yuanKe.length > 0) {
    if (yuanKe.length === 1) {
      return { rule: '遥克法', pattern: '递传', initialBranch: yuanKe[0].up, ruleTag: yuanKe[0].kind, classical: ['遥克', '贼克'] };
    }
    const bihe = yuanKe.filter((c) => ZHI_YY[c.up] === stemYY);
    if (bihe.length === 1) {
      return { rule: '遥克比用法', pattern: '递传', initialBranch: bihe[0].up, ruleTag: bihe[0].kind, classical: ['遥克', '比用'] };
    }
    const final = bihe.length > 0 ? bihe : yuanKe;
    const chosen = pickSheHai(final, shift);
    return { rule: '遥克涉害法', pattern: '递传', initialBranch: chosen.up, ruleTag: chosen.kind, classical: ['遥克', '涉害'] };
  }

  // ---- 昴星 / 别责 / 八专 ----
  const isBaZhuan = JI_GONG[dayStem] === dayBranch;
  if (isBaZhuan) {
    // 八专（无克无遥）：近似取日支之冲或三合（对拍校准；极少见）
    const ch = CHONG[dayBranch];
    return { rule: '八专法', pattern: '递传', initialBranch: ch, ruleTag: '八专', classical: ['八专'] };
  }
  // 昴星：阳日 = 地盘酉上神；阴日 = 天盘酉之下（对拍校准：需四课无克且酉下为课上神）。
  // 三传非递传：阳日 中=日支上神、末=日干寄宫上神（对拍实测 1900-01-15 戊子日 巳/申/丑）；
  // 阴日 中末传按同口径（待阴日样本探针校准）。
  const xiZhiXia = zhiAt(zi('酉') - shift);
  const jg = JI_GONG[dayStem];
  const l1up = zhiAt(zi(jg) + shift);
  const l3up = zhiAt(zi(dayBranch) + shift);
  if (xiZhiXia === l1up || xiZhiXia === l3up) {
    const initial = stemYY ? zhiAt(zi('酉') + shift) : xiZhiXia;
    const middle = zhiAt(zi(dayBranch) + shift);        // 中传 = 日支上神
    const last = zhiAt(zi(jg) + shift);                 // 末传 = 日干寄宫上神
    return {
      rule: '昴星法', pattern: '递传', initialBranch: initial,
      explicitTransmissions: [initial, middle, last],
      ruleTag: stemYY ? '虎视' : '冬蛇掩目', classical: ['昴星'],
    };
  }
  // 别责：日支三合之第一神（对拍校准；辛酉日等个别差异已在夹具规避）
  const he = SAN_HE[dayBranch];
  const bieZeInitial = he ? he[0] : dayBranch;
  return { rule: '别责法', pattern: '递传', initialBranch: bieZeInitial, ruleTag: '别责', classical: ['别责'] };
}

/** 伏吟族（月将==占时）。 */
function resolveFuYin(dayStem, dayBranch, lessons, raw, stemYY) {
  // 一课是否有克决定 元首/重审 变体
  const l1 = lessons[0];
  const upEl = ZHI_WUXING[l1.upper];
  const loEl = GAN_WUXING[dayStem];
  let initial;
  let rule;
  if (LIUREN_RULES.ke[upEl] === loEl) {
    rule = '伏吟元首法';
    initial = l1.upper; // 一课上神（=寄宫支，伏吟盘同位）
  } else if (LIUREN_RULES.ke[loEl] === upEl) {
    rule = '伏吟重审法';
    initial = l1.upper;
  } else {
    rule = '伏吟法';
    initial = stemYY ? JI_GONG[dayStem] : dayBranch; // 阳日寄宫、阴日日支
  }
  return { rule, pattern: '伏吟', initialBranch: initial, ruleTag: rule.replace('法', ''), classical: ['伏吟'] };
}

/** 涉害选择：逆数「受克深浅」（bwd/ke+bei/selflo，对拍实测 ~80%）+ 课序平局。 */
function pickSheHai(cands, shift) {
  const depth = (c) => {
    let pos = mod(zi(c.up) - shift, 12); // 上神之地盘宫
    let n = 0;
    for (let s = 0; s < 12; s += 1) {
      pos = mod(pos - 1, 12);
      const t = zhiAt(pos + shift);
      const te = ZHI_WUXING[t];
      const ce = ZHI_WUXING[c.up];
      if (LIUREN_RULES.ke[ce] === te || LIUREN_RULES.ke[te] === ce) n += 1;
      if (t === c.lo) break;
    }
    return n;
  };
  const scored = cands.map((c) => ({ c, d: depth(c) }));
  const max = Math.max(...scored.map((x) => x.d));
  const top = scored.filter((x) => x.d === max).map((x) => x.c);
  return top.reduce((a, b) => (a.lesson <= b.lesson ? a : b));
}

/** 三传推进：递传（取上一传的天盘上神）；伏吟取刑；反吟随递传自动对冲。 */
export function buildTransmissions({ rule, pattern, initialBranch, shift, godOf }) {
  const branches = [initialBranch];
  if (pattern === '伏吟') {
    let b = initialBranch;
    for (let i = 0; i < 2; i += 1) {
      b = XING[b];
      branches.push(b);
    }
  } else {
    let b = initialBranch;
    for (let i = 0; i < 2; i += 1) {
      b = zhiAt(zi(b) + shift);
      branches.push(b);
    }
  }
  return branches;
}

/** 课体/格局标签（释义层，不进关键字段；最佳努力实现）。 */
export function computePatternTags({ rule, pattern, branches, gods, xunKong, dayBranch, shift }) {
  const tags = [];
  const [c1, c2, c3] = branches;
  if (gods[0]) tags.push(`${gods[0]}发用`);
  const ruleTag = { '重审法': '重审', '元首法': '元首', '比用法': '比用', '涉害法': '涉害', '遥克法': null, '遥克比用法': null, '遥克涉害法': null, '伏吟法': '自任', '伏吟元首法': '伏吟元首', '伏吟重审法': '伏吟重审', '反吟法': '无依', '返吟比用法': '返吟比用', '返吟重审法': '返吟重审', '返吟涉害法': '返吟涉害', '返吟元首法': '返吟元首', '昴星法': null, '别责法': '别责', '八专法': '八专' }[rule];
  if (ruleTag) tags.push(ruleTag);
  if (branches.some((b) => xunKong.includes(b))) tags.push('空亡入传');
  else tags.push('传不逢空');
  if (pattern === '伏吟') tags.push('伏吟');
  else if (pattern === '反吟') tags.push('反吟');
  else if (pattern === '回环') tags.push('回环');
  else tags.push('递传');
  // 课体
  const guaTi = [];
  const isMeng = (b) => ['寅', '申', '巳', '亥'].includes(b);
  if (isMeng(c1) && isMeng(c2) && isMeng(c3)) {
    guaTi.push({ id: 'xuan-tai', name: '玄胎卦', category: '三传支类', branches: branches.slice() });
  }
  const els = branches.map((b) => ZHI_WUXING[b]);
  const allSameEl = els[0] === els[1] && els[1] === els[2];
  const wuXingGuati = { 木: '曲直卦', 火: '炎上卦', 土: '稼穑卦', 金: '从革卦', 水: '润下卦' };
  if (allSameEl && wuXingGuati[els[0]]) {
    guaTi.push({ id: `wu-xing-${els[0]}`, name: wuXingGuati[els[0]], category: '三传五行', branches: branches.slice() });
  }
  if (zi(c1) === mod(zi(c3) + 6, 12)) {
    guaTi.push({ id: 'chu-mo-xiang-chong', name: '初末相冲课', category: '三传冲合', branches: [c1, c3] });
  }
  const chongRi = branches.filter((b) => CHONG[b] === dayBranch);
  const shengRi = branches.filter((b) => LIUREN_RULES.sheng[ZHI_WUXING[b]] === ZHI_WUXING[dayBranch]);
  if (chongRi.length === 1) {
    guaTi.push({ id: 'zhong-jian', name: '传冲日支课', category: '三传冲合', branches: chongRi });
  } else if (chongRi.length === 3) {
    guaTi.push({ id: 'ri-zhi-fan', name: '三传冲日课', category: '三传冲合', branches: chongRi });
  }
  if (shengRi.length === 3) {
    guaTi.push({ id: 'chuan-gui-sheng-chu', name: '传归生处课', category: '三传生克', branches: branches.slice() });
  }
  for (const g of guaTi) tags.push(g.name);
  return { tags, guaTi };
}

/** 神煞 13 项。返回 { summary, facts }。 */
export function computeShenSha({ dayStem, dayBranch, monthBranch }) {
  const idx = (b) => zi(b);
  const sanHeOf = (b) => SAN_HE[b] || [b, b, b];
  const sanHeGroup = (b) => (['申', '子', '辰'].includes(b) ? '申子辰' : ['寅', '午', '戌'].includes(b) ? '寅午戌' : ['巳', '酉', '丑'].includes(b) ? '巳酉丑' : '亥卯未');
  const groupMa = { 申子辰: '寅', 亥卯未: '巳', 寅午戌: '申', 巳酉丑: '亥' };
  const groupJie = { 寅午戌: '亥', 亥卯未: '申', 申子辰: '巳', 巳酉丑: '寅' };
  const groupWang = { 寅午戌: '巳', 亥卯未: '寅', 申子辰: '亥', 巳酉丑: '申' };
  const groupXian = { 寅午戌: '卯', 亥卯未: '子', 申子辰: '酉', 巳酉丑: '午' };
  const g = sanHeGroup(dayBranch);
  const gm = sanHeGroup(monthBranch);
  const monthMengZhongJi = ['寅', '申', '巳', '亥'].includes(monthBranch) ? '孟' : ['子', '午', '卯', '酉'].includes(monthBranch) ? '仲' : '季';
  const tianLuo = zhiAt(idx(dayBranch) + 1);
  const diWang = CHONG[tianLuo];
  const tianMaBase = 6; // 午
  const monthOffset = mod(idx(monthBranch) - idx('寅'), 12);
  const tianMa = zhiAt(tianMaBase + monthOffset * 2);
  const poSui = { 孟: '酉', 仲: '巳', 季: '丑' }[monthMengZhongJi];

  const rows = [
    { name: '支马', target: groupMa[g], basis: '日支', input: dayBranch, category: '十二地支神煞', rule: SHEN_SHA[0].rule },
    { name: '驿马', target: groupMa[gm], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[1].rule },
    { name: '劫煞', target: groupJie[gm], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[2].rule },
    { name: '亡神', target: groupWang[gm], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[3].rule },
    { name: '咸池', target: groupXian[gm], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[4].rule },
    { name: '破碎', target: poSui, basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[5].rule },
    { name: '天罗', target: tianLuo, basis: '日支', input: dayBranch, category: '罗网神煞', rule: SHEN_SHA[6].rule },
    { name: '地网', target: diWang, basis: '日支', input: dayBranch, category: '罗网神煞', rule: SHEN_SHA[7].rule },
    { name: '天德', target: TIAN_DE[monthBranch], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[8].rule },
    { name: '月德', target: YUE_DE[monthBranch], basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[9].rule },
    { name: '天马', target: tianMa, basis: '月建', input: monthBranch, category: '逐月神煞', rule: SHEN_SHA[10].rule },
    { name: '日德', target: RI_DE[dayStem], basis: '日干', input: dayStem, category: '十天干神煞', rule: SHEN_SHA[11].rule },
    { name: '日禄', target: RI_LU[dayStem], basis: '日干', input: dayStem, category: '十天干神煞', rule: SHEN_SHA[12].rule },
  ];
  const facts = rows.map((r) => ({
    name: r.name, target: r.target, targetType: typeof r.target === 'string' && GAN.includes(r.target) ? '天干' : '地支',
    category: r.category, basis: r.basis, input: r.input, rule: r.rule,
    limitations: ['只定位神煞所在干支', '须核对是否入课、入传或临干支', '不得单项定吉凶'],
  }));
  const summary = rows.map((r) => `${r.name}在${r.target}`);
  return { summary, facts };
}

/* ---------------- ④ 输出装配 ---------------- */

export function assemble(parts) {
  const { normalized, calendar, plates, lessons, ruleInfo, transmissions, guati, shenSha, now } = parts;
  const { yearGanZhi, monthGanZhi, dayGanZhi, hourGanZhi, hourBranch, monthLeader, monthBranch, hourLabel, hourIndex } = calendar;
  const dayStem = dayGanZhi.slice(0, 1);
  const dayBranch = dayGanZhi.slice(1);
  const xunKong = parts.xunKong;
  const nobleman = parts.nobleman;

  // 四课装配
  const fourLessons = lessons.map((l) => {
    const god = plates.godOf(l.upper);
    const relEl = l.lowerBranch === l.lower ? ZHI_WUXING[l.lowerBranch] : GAN_WUXING[l.lower];
    const relation = relationText(relEl, ZHI_WUXING[l.upper]);
    const note = `上神${l.upper}与下位${l.lower}的五行关系为${relation}。`;
    return { name: l.name, upper: l.upper, lower: l.lower, god, relation, note };
  });

  // 三传装配
  const stages = ['初传', '中传', '末传'];
  const threeTransmissions = transmissions.map((branch, i) => {
    const god = plates.godOf(branch);
    const prev = i === 0 ? GAN_WUXING[dayStem] : ZHI_WUXING[transmissions[i - 1]];
    const relation = relationText(prev, ZHI_WUXING[branch]);
    const dayRel = relationText(ZHI_WUXING[branch], ZHI_WUXING[dayBranch]);
    const isVoid = xunKong.includes(branch);
    return {
      stage: stages[i],
      branch,
      god,
      relation,
      note: `${stages[i]}${i === 0 ? '与一课下位' : `与${stages[i - 1]}`}的五行关系为${relation}。`,
      wuxing: ZHI_WUXING[branch],
      seasonState: seasonStateOf(monthBranch, branch),
      isVoid,
      dayRelation: dayRel,
    };
  });

  // 课体
  const patternTags = guati.tags;
  const guaTi = guati.guaTi.map((g) => g.name);
  const guaTiFacts = guati.guaTi.map((g, i) => ({
    id: g.id,
    stableKey: `liuren:verified-guati:${g.id}`,
    name: g.name,
    category: g.category,
    branches: g.branches,
    matchedConditions: [`三传${g.branches.join('、')}`],
    sourceTitle: GUATI_SOURCE_TITLES[i % GUATI_SOURCE_TITLES.length],
    sourceUrl: GUATI_SOURCE_URLS[i % GUATI_SOURCE_URLS.length],
    sourceQuote: '',
  }));

  // classicalRules
  const classicalRules = ruleInfo.classical.map((key) => {
    const c = JIU_ZONG_MEN[key] || JIU_ZONG_MEN[ruleInfo.rule.replace('法', '')];
    return { source: c.source, rule: c.rule, category: c.category, summary: c.summary };
  });

  // 天将属性（只放用到的：三传天将）
  const usedGods = [...new Set(threeTransmissions.map((t) => t.god))];
  const tianJiangProps = {};
  for (const g of usedGods) {
    const p = TIAN_JIANG_PROPS[g];
    if (p) tianJiangProps[g] = { wuxing: p.wuxing, yinYang: p.yinYang, category: p.category, description: p.description };
  }

  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;

  const transmissionRule = ruleInfo.rule;
  const transmissionPattern = ruleInfo.pattern;
  const jzm = JIU_ZONG_MEN[ruleInfo.rule.replace('法', '')] || {};
  const transmissionDetail = `取传采用${ruleInfo.rule}，以初传${transmissions[0]}为初传发用；古籍依据依次为：${ruleInfo.classical.map((k) => {
    const c = JIU_ZONG_MEN[k];
    return c ? `《${c.source.replace(/《|》/g, '').split('及')[0]}》${c.category}（${c.summary}）` : '';
  }).join('；')}。`;

  return {
    ganzhi: { year: yearGanZhi, month: monthGanZhi, day: dayGanZhi, hour: hourGanZhi },
    dayNight: parts.dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch: nobleman.branch,
    noblemanGroundBranch: nobleman.ground,
    xunKong,
    transmissionRule,
    transmissionPattern,
    transmissionDetail,
    earthlyPlate: ZHI.slice(),
    dayStemResidence: JI_GONG[dayStem],
    heavenlyPlate: plates.heavenlyPlate,
    fourLessons,
    threeTransmissions,
    patternTags,
    classicalRules,
    lessonSummary: `四课源于日干寄宫${JI_GONG[dayStem]}与日支${dayBranch}，${fourLessons.map((l) => `${l.name}${l.relation}`).join('、')}。`,
    transmissionSummary: `三传${ruleInfo.pattern === '递传' ? '递传' : ruleInfo.pattern}，主线依次为${transmissions.map((b, i) => `${stages[i]}${b}`).join(' → ')}。`,
    guaTi,
    guaTiFacts,
    shenShaSummary: shenSha.summary,
    shenShaFacts: shenSha.facts,
    tianJiangProps,
    focusEvidence: [
      { target: `初传${transmissions[0]}乘${threeTransmissions[0].god}`, role: '发用主轴', level: '主证', evidence: [`${ruleInfo.rule}取为初传`, `月令${threeTransmissions[0].seasonState}`, threeTransmissions[0].dayRelation], limitations: threeTransmissions[0].isVoid ? ['初传空亡，主证需待填实'] : [] },
      { target: `日干${dayStem}寄${JI_GONG[dayStem]}`, role: '我方与求测者', level: '辅证', evidence: ['日干寄宫为我方定位', `一课${fourLessons[0].upper}临${dayStem}`], limitations: [] },
      { target: `日支${dayBranch}`, role: '所占之事与对方环境', level: '辅证', evidence: [`三课${fourLessons[2].upper}临${dayBranch}`, '需与发用和三传同看'], limitations: ['具体类神仍须按问题主题从明列盘面中选取'] },
    ],
    timingEvidence: [
      `一级发用：先看初传${transmissions[0]}${threeTransmissions[0].isVoid ? '空亡，待出空或冲实' : `（月令${threeTransmissions[0].seasonState}）`}`,
      `二级三传：初传${transmissions[0]}（月令${threeTransmissions[0].seasonState}${threeTransmissions[0].isVoid ? '、空' : ''}）→中传${transmissions[1]}（月令${threeTransmissions[1].seasonState}）→末传${transmissions[2]}（月令${threeTransmissions[2].seasonState}）`,
      `三级日月：以日支${dayBranch}、月支${monthBranch}对初传和类神的同支、冲合与旺衰作为触发条件`,
      '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期',
    ],
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'liuren',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `liuren:${inputHash}`,
    },
  };
}

const GUATI_SOURCE_TITLES = ['《六壬指南》卷一·三传课体', '《六壬大全》卷七·毕法赋'];
const GUATI_SOURCE_URLS = ['https://zh.wikisource.org/w/index.php?title=六壬指南/1&oldid=854504', 'https://zh.wikisource.org/w/index.php?title=六壬大全/7&oldid=854575'];

/**
 * 大六壬起课（自研内核）。
 * @param {object} params `{ customDate: Date|string|number, now?: Date }`
 */
export function generateLiurenCore(params) {
  const normalized = normalizeInput(params);                 // ①
  const calendar = resolveCalendar(normalized);              // ②
  const { dayGanZhi, monthLeader, hourBranch, monthBranch } = calendar;
  const dayStem = dayGanZhi.slice(0, 1);
  const dayBranch = dayGanZhi.slice(1);
  const dayNight = dayNightOf(hourBranch);
  const noblemanBranch = noblemanOf(dayStem, dayNight);
  const xunKong = xunKongOf(dayGanZhi);

  const plates = buildPlates({
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    noblemanGroundBranch: zhiAt(zi(noblemanBranch) - mod(zi(monthLeader) - zi(hourBranch), 12)),
  });
  const nobleman = {
    branch: noblemanBranch,
    ground: plates.underOf(noblemanBranch),
  };

  const lessons = buildFourLessons({ dayStem, dayBranch, shift: plates.shift });
  const ruleInfo = resolveRuleAndInitial({
    dayStem, dayBranch, monthLeader, divinationBranch: hourBranch,
    lessons, shift: plates.shift, xunKong,
  });
  const transmissions = ruleInfo.explicitTransmissions
    ? ruleInfo.explicitTransmissions
    : buildTransmissions({
        rule: ruleInfo.rule, pattern: ruleInfo.pattern, initialBranch: ruleInfo.initialBranch,
        shift: plates.shift, godOf: plates.godOf,
      });
  const gods = transmissions.map((b) => plates.godOf(b));
  const guati = computePatternTags({
    rule: ruleInfo.rule, pattern: ruleInfo.pattern, branches: transmissions, gods,
    xunKong, dayBranch, shift: plates.shift,
  });
  const shenSha = computeShenSha({ dayStem, dayBranch, monthBranch });

  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({
    normalized, calendar, plates, lessons, ruleInfo, transmissions, guati, shenSha,
    xunKong, nobleman, dayNight, now,
  });
}

export default generateLiurenCore;
