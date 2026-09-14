/**
 * 命理 · 自研排盘内核 · 七政四余（节152）
 * ===========================================================================
 * 导出 `generateQizhengCore(input)` —— 与旧实现 `calculateBirthChartBundle(
 * profile, {systems:['qizheng']}).qizheng` 经 stripInternal 后的生产契约同形状。
 *
 * 四段纯函数管线（README §1）：
 *   ① normalizeInput —— {year,month,day,hour,minute,gender,name?,birthplace?,
 *     longitude,latitude,true_solar?} → 确定性中间对象（东八区挂钟 + UTC 毫秒）
 *   ② resolveAstronomy —— 时刻 → JD(TT)；七政/罗睺/计都/月孛/紫炁 黄经；
 *     二十八宿宿界（距星目标日期真黄经，随岁差逐年移动）
 *   ③ computeChart —— 宿度/宫位/命身宫/命主/十二宫/神煞/庙旺/相位/紫炁进度
 *   ④ assemble —— 按生产契约键序拼装
 * 纪律：零 IO / 零网络 / 零 LLM / 零随机 / 零时钟；缺输入抛 PaipanInputError。
 *
 * == 对拍实测确认的口径（黑盒探针 tools/_probe/qizheng/，只运行旧实现）==
 *   1. 星曜黄经：太阳 −20″、太阴 ±7″、其余行星 −7~−24″（自研 VSOP87/ELP 与
 *     旧实现 astronomy-engine 的固有差，原始浮点字段不作关键字段，见夹具说明）。
 *   2. 罗睺/计都 = 月球轨道升/降交点（自研密切交点 vs 旧实现差 ≤ 42″）；
 *     月孛 = 月球平均远地点（差 ≤ 434″ ≈ 0.12°，模型不同，结构字段仍稳）。
 *   3. 紫炁 = 《七政算内篇》古法均速：回归黄经 = 归一化(237.038993° + 距
 *     1995-12-31T00:00:00Z 日数 × 360°/10227.1792日)，与旧实现逐位一致。
 *   4. 命宫 = (太阳宫 + 3 − 时支序) mod 12（「太阳起生时顺数至卯」）；身宫 =
 *     (太阴宫 + 3 + 时支序) mod 12 —— 14 条探针全部命中（探针 p2/p4）。
 *   5. 天乙贵人按**日干**（晚子时 23:00 起换日取次日日干）；驿马/劫煞/咸池/
 *     华盖/孤辰/寡宿按**年支**（立春精确时刻换年）—— 探针 p2/p4/p10。
 *   6. 庙旺乐喜表（7×12）由 47 条探针全格锁定（rules/qizheng.js DIGNITY_TABLE）。
 *   7. useTrueSolarTime 被旧实现忽略（探针 p10：同输入开/关输出逐位一致）。
 *   8. 宿界随岁差逐年移动（探针 p3：壁宿界 1905 年 7.8332° → 2024 年 9.4907°），
 *     必须按目标日期换算；自研换算与旧实现差 ≤ 2″（1990）/ ≤ 20″（1905）。
 */

import { Solar } from 'lunar-typescript';
import { precess, coord, base, nutation as nutationModule } from 'astronomia';
import {
  norm360, norm180, apparentEclipticLongitude, longitudeRate, trueNodeLongitude,
  meanApogeeLongitude, julianEphemerisDay, meanObliquity, decimalYear,
} from '../astrology/ephemeris.js';
import {
  BRANCHES, signBranchOf, TWELVE_PALACE_NAMES, RULER_OF_SIGN, DIGNITY_TABLE,
  DIGNITY_GRADE_ORDER, DIGNITY_GRADE_LABELS, MANSION_STARS, SHENSHA, ASPECTS,
  CLOSENESS_BANDS, STAR_ORDER, STAR_BODY_KEY, ZIQI_MODEL, XIU_RULE,
} from '../../rules/qizheng.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** 缺输入/非法输入错误类型（确定性纪律：不猜、不回落当前时间）。 */
export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/* ───────────────────────────── ① 输入归一化 ───────────────────────────── */

function toNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new PaipanInputError('invalid_number', `${field} 不是有效数字：${value}`);
  return n;
}

function requireNumber(value, field) {
  const n = toNumber(value, field);
  if (n === null) throw new PaipanInputError('missing_field', `缺少必填字段 ${field}`);
  return n;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * ① 输入归一化。
 * 【对拍实测】旧实现适配器固定 timezone=8、忽略 useTrueSolarTime（探针 p10），
 * 故本内核：时区固定东八区；true_solar 仅记录不参与计算。
 */
export function normalizeInput(input) {
  if (input === null || typeof input !== 'object') {
    throw new PaipanInputError('invalid_input', 'generateQizhengCore 需要一个对象参数');
  }
  const year = requireNumber(input.year, 'year');
  const month = requireNumber(input.month, 'month');
  const day = requireNumber(input.day, 'day');
  const hour = input.hour === undefined ? 0 : requireNumber(input.hour, 'hour');
  const minute = input.minute === undefined ? 0 : requireNumber(input.minute, 'minute');
  const longitude = requireNumber(input.longitude, 'longitude');
  const latitude = requireNumber(input.latitude, 'latitude');

  if (month < 1 || month > 12) throw new PaipanInputError('invalid_month', `month 超出 1–12：${month}`);
  if (day < 1 || day > 31) throw new PaipanInputError('invalid_day', `day 超出 1–31：${day}`);
  if (hour < 0 || hour > 23) throw new PaipanInputError('invalid_hour', `hour 超出 0–23：${hour}`);
  if (minute < 0 || minute > 59) throw new PaipanInputError('invalid_minute', `minute 超出 0–59：${minute}`);
  if (longitude < -180 || longitude > 180) throw new PaipanInputError('invalid_longitude', `longitude 超出 ±180：${longitude}`);
  if (latitude < -90 || latitude > 90) throw new PaipanInputError('invalid_latitude', `latitude 超出 ±90：${latitude}`);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - 8 * 3600000;
  return {
    name: input.name === undefined ? '' : String(input.name),
    gender: input.gender === undefined ? 'male' : String(input.gender),
    birthplace: input.birthplace === undefined ? '' : String(input.birthplace),
    year, month, day, hour, minute,
    longitude, latitude,
    trueSolar: Boolean(input.true_solar),
    utcMs,
    standardDateTime: `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`,
  };
}

/* ─────────────────────────── ② 历法 / 天文量 ─────────────────────────── */

/** 时支序（子=0 … 亥=11；早子 00:00–00:59 与晚子 23:00–23:59 均为 0）。 */
export function hourIndex0(hour) {
  return Math.floor(((hour + 1) % 24) / 2);
}

/**
 * 二十八宿宿界：距星 J2000 平赤道（含自行）→ 目标日期真黄经。
 * 口径 = IAU 1976 岁差（astronomia precess）+ IAU 1980 章动 Δψ。
 * 与旧实现 Astronomy Engine（IAU 2006 + IAU 2000B）差 ≤ 2″（1990s）/ ≤ 20″（1905）。
 */
export function mansionBoundaryLongitudes(jde) {
  const toYear = base.JDEToJulianYear(jde);
  const eps = meanObliquity(jde) * D2R;
  const dpsi = nutationModule.nutation(jde)[0] * R2D;
  return MANSION_STARS.map((star) => {
    const decRad = star.decJ2000 * D2R;
    const mAlpha = (star.pmRa / 3600000) * D2R / Math.cos(decRad); // μα* → dα/dt (rad/yr)
    const mDelta = (star.pmDec / 3600000) * D2R;
    const eq0 = new coord.Equatorial(star.raJ2000 * D2R, decRad);
    const eq = precess.position(eq0, 2000.0, toYear, mAlpha, mDelta);
    const lambda = Math.atan2(
      Math.sin(eq.ra) * Math.cos(eps) + Math.tan(eq.dec) * Math.sin(eps),
      Math.cos(eq.ra),
    );
    return norm360(lambda * R2D + dpsi);
  });
}

/** 黄经 → 宿/宿度。宿界按 [start, start+width) 判属，末宿（室）跨 360° 包回。 */
export function xiuOf(longitude, boundaries) {
  const lon = norm360(longitude);
  for (let i = 0; i < boundaries.length; i += 1) {
    const start = boundaries[i];
    const next = boundaries[(i + 1) % boundaries.length];
    const width = norm360(next - start);
    if (norm360(lon - start) < width) {
      return { xiu: MANSION_STARS[i].mansion, xiuDegree: norm360(lon - start) };
    }
  }
  const last = boundaries.length - 1;
  return { xiu: MANSION_STARS[last].mansion, xiuDegree: norm360(lon - boundaries[last]) };
}

/** 紫炁归一（与旧实现同浮点口径：((x%360)+360)%360；探针 p14 逐位核对）。 */
function ziqiNorm(value) {
  return ((value % 360) + 360) % 360;
}

/** 紫炁古法均速黄经。【对拍实测】与旧实现逐位一致（探针 p1/p3/p14，须用 ziqiNorm 归一）。 */
export function ziqiLongitude(utcMs) {
  const days = (utcMs - ZIQI_MODEL.epochUtcMs) / 86400000;
  return ziqiNorm(ZIQI_MODEL.epochLongitudeDeg + days * (360 / ZIQI_MODEL.periodDays));
}

/** 紫炁进度块（daysSince/UntilZeroLongitude、cycleProgress）。探针 p14b 锁定逐位算式。 */
export function ziqiProgress(utcMs) {
  const days = (utcMs - ZIQI_MODEL.epochUtcMs) / 86400000;
  const rate = 360 / ZIQI_MODEL.periodDays;
  const phase = ZIQI_MODEL.epochLongitudeDeg + days * rate;
  const phaseNorm = ziqiNorm(phase);
  const daysSinceZeroLongitude = phaseNorm / rate;
  return {
    daysSinceZeroLongitude,
    daysUntilZeroLongitude: ZIQI_MODEL.periodDays - daysSinceZeroLongitude,
    cycleProgress: phaseNorm / 360, // = tropicalLongitude / 360（探针 p14b：与旧实现逐位一致）
  };
}

/** 各星曜黄经（七政 + 四余）。 */
export function starLongitudes(jde, utcMs) {
  const out = {};
  for (const name of STAR_ORDER) {
    const body = STAR_BODY_KEY[name];
    if (body) {
      out[name] = apparentEclipticLongitude(body, jde);
    } else if (name === '罗睺(火余)') {
      out[name] = trueNodeLongitude(jde);
    } else if (name === '计都(土余)') {
      out[name] = norm360(trueNodeLongitude(jde) + 180);
    } else if (name === '月孛(水余)') {
      out[name] = meanApogeeLongitude(jde);
    } else if (name === '紫炁(木余)') {
      out[name] = ziqiLongitude(utcMs);
    }
  }
  return out;
}

/* ───────────────────────────── ③ 格局判定 ───────────────────────────── */

function dignityOf(starName, signIndex) {
  const table = DIGNITY_TABLE[starName];
  if (!table) return '—';
  const grades = DIGNITY_GRADE_ORDER.filter((g) => table[g].includes(signIndex));
  if (grades.length === 0) return '平';
  return grades.map((g) => DIGNITY_GRADE_LABELS[g]).join('/');
}

/** 相位集合（55 对 × 5 相；orb 升序，并列按星名）。 */
export function computeAspects(stars) {
  const list = [];
  for (let i = 0; i < stars.length; i += 1) {
    for (let k = i + 1; k < stars.length; k += 1) {
      const a = stars[i];
      const b = stars[k];
      const separation = Math.abs(norm180(b.longitude - a.longitude));
      for (const aspect of ASPECTS) {
        const orb = Math.abs(separation - aspect.exactAngle);
        if (orb > aspect.allowedOrb) continue;
        const orbRatio = Number((orb / aspect.allowedOrb).toFixed(4));
        let closeness = CLOSENESS_BANDS[CLOSENESS_BANDS.length - 1].label;
        for (const band of CLOSENESS_BANDS) {
          if (orb / aspect.allowedOrb < band.maxRatio) { closeness = band.label; break; }
        }
        list.push({
          star1: a.name,
          star2: b.name,
          type: aspect.name,
          exactAngle: aspect.exactAngle,
          actualAngle: Number(separation.toFixed(4)),
          orb: Number(orb.toFixed(4)),
          allowedOrb: aspect.allowedOrb,
          orbRatio,
          closeness,
          precisionClass: (a.name === '紫炁(木余)' || b.name === '紫炁(木余)') ? '混合模型' : '同层现代天文',
          source: `${a.name}与${b.name}目标日期黄经最小夹角及${aspect.name}容许度`,
        });
      }
    }
  }
  list.sort((x, y) => (x.orb - y.orb)
    || (x.star1 < y.star1 ? -1 : x.star1 > y.star1 ? 1 : 0)
    || (x.star2 < y.star2 ? -1 : x.star2 > y.star2 ? 1 : 0));
  return list;
}

/** 神煞（7 项，固定序）。日干取日柱之干（晚子时换日后），年支取年柱之支（立春精确换年）。 */
export function computeShensha(dayGanZhi, yearGanZhi) {
  const gan = dayGanZhi[0];
  const zhi = yearGanZhi[1];
  return [
    { name: '天乙贵人', value: SHENSHA.tianYi[gan] },
    { name: '驿马', value: SHENSHA.yiMa[zhi] },
    { name: '劫煞', value: SHENSHA.jieSha[zhi] },
    { name: '咸池', value: SHENSHA.xianChi[zhi] },
    { name: '华盖', value: SHENSHA.huaGai[zhi] },
    { name: '孤辰', value: SHENSHA.guChen[zhi] },
    { name: '寡宿', value: SHENSHA.guaSu[zhi] },
  ];
}

/* ───────────────────────────── ④ 输出装配 ───────────────────────────── */

/** 七政四余星盘（自研内核）—— 形状对齐旧实现 bundle.qizheng 经 stripInternal 后契约。 */
export function generateQizhengCore(input) {
  const normalized = normalizeInput(input);
  const { utcMs } = normalized;
  const jde = julianEphemerisDay(utcMs);

  const lons = starLongitudes(jde, utcMs);
  const boundaries = mansionBoundaryLongitudes(jde);
  const sunSignIndex = Math.floor(norm360(lons['太阳']) / 30);
  const moonSignIndex = Math.floor(norm360(lons['太阴']) / 30);
  const h0 = hourIndex0(normalized.hour);

  // 命宫/身宫（探针 p2/p4 拟合：太阳起生时顺数至卯 / 太阴起生时逆数至卯）
  const mingGong = (sunSignIndex + 3 - h0 + 12) % 12;
  const shenGong = (moonSignIndex + 3 + h0) % 12;
  const mingZhu = RULER_OF_SIGN[mingGong];

  // 十二宫（固定序；palace[i].signIndex = (mingGong − i) mod 12）
  const twelvePalaces = TWELVE_PALACE_NAMES.map((palace, i) => {
    const signIndex = (mingGong - i + 12) % 12;
    return { palace, signIndex, signBranch: signBranchOf(signIndex) };
  });
  const palaceBySign = {};
  for (const p of twelvePalaces) palaceBySign[p.signIndex] = p.palace;

  // 星曜表
  const stars = STAR_ORDER.map((name) => {
    const longitude = lons[name];
    const signIndex = Math.floor(norm360(longitude) / 30);
    const { xiu, xiuDegree } = xiuOf(longitude, boundaries);
    const entry = {
      name,
      kind: name.includes('(') && name.includes('余') ? '四余' : '七政',
      tropicalLongitude: longitude,
      longitude,
      xiu,
      sevenStar: MANSION_STARS.find((s) => s.mansion === xiu).sevenStar,
      xiuDegree,
      signIndex,
      signBranch: signBranchOf(signIndex),
      palace: palaceBySign[signIndex],
      dignity: dignityOf(name, signIndex),
      sourceId: STAR_BODY_KEY[name] ? 'mingli-ephemeris-vsop87-elp' : 'mingli-qizheng-model',
      sourceLabel: STAR_BODY_KEY[name]
        ? '自研星历 astronomia 4.2.0（VSOP87 / ELP2000-82B）'
        : name === '紫炁(木余)' ? '《七政算内篇》紫炁古法均速' : '自研月球轨道模型（交点/平均远地点）',
      precisionClass: name === '紫炁(木余)' ? '传统均速模型' : '现代天文计算',
    };
    const body = STAR_BODY_KEY[name];
    if (body) {
      entry.retrograde = longitudeRate(body, jde) < 0;
    } else if (name === '月孛(水余)' || name === '紫炁(木余)') {
      // 【对拍实测】月孛/紫炁为均速模型（恒顺行），retrograde 恒 false；
      // 罗睺/计都为交点，旧实现不输出 retrograde 键。
      entry.retrograde = false;
    }
    return entry;
  });

  // 神煞（日干/年支用 lunar-typescript 精确换界口径，与旧实现日历模块同源）
  const lunar = Solar.fromYmdHms(normalized.year, normalized.month, normalized.day, normalized.hour, normalized.minute, 0).getLunar();
  const dayGanZhi = lunar.getDayInGanZhiExact();
  const yearGanZhi = lunar.getYearInGanZhiExact();
  const shensha = computeShensha(dayGanZhi, yearGanZhi);

  // 相位
  const aspects = computeAspects(stars);

  // 紫炁（均速模型 + 进度）
  const ziqiLon = lons['紫炁(木余)'];
  const progress = ziqiProgress(utcMs);
  const decimalYearValue = decimalYear(utcMs);
  const siderealLon = norm360(ziqiLon + (2000 - decimalYearValue) * 50.290966 / 3600);
  const ziqi = {
    tropicalLongitude: ziqiLon,
    siderealLongitude: siderealLon,
    direction: '顺行',
    dailyMotionDegrees: 360 / ZIQI_MODEL.periodDays,
    cycleProgress: progress.cycleProgress,
    daysSinceZeroLongitude: progress.daysSinceZeroLongitude,
    daysUntilZeroLongitude: progress.daysUntilZeroLongitude,
  };

  // 紫炁模型描述（本内核自撰文案；信息性字段，与旧实现文本允许不同）
  const ziqiModel = {
    id: 'mingli-ziqi-mean-motion',
    name: '《七政算内篇》紫炁古法均速',
    direction: '顺行',
    cycleYears: 28,
    periodDays: ZIQI_MODEL.periodDays,
    dailyMotionDegrees: 360 / ZIQI_MODEL.periodDays,
    classicalDegreeRate: '二十八日一度',
    classicalDailyMotion: '每日约三分五十七秒（古法均速）',
    classicalEpoch: '大元至元十八年前后（约 1280 年）冬至起算的古法历元',
    modernEpochUtc: '1995-12-31T00:00:00.000Z',
    modernEpochTropicalLongitude: ZIQI_MODEL.epochLongitudeDeg,
    formula: '回归黄经 = 归一化(237.038993° + 距1995-12-31T00:00:00Z日数 × 360° / 10227.1792日)',
    coordinate: '先算传统均速回归黄经，再与同日二十八宿距星真黄经边界比较得到宿度',
    precision: '古法均速模型，可按输入分钟稳定复现；不宣称现代天体测量的角秒精度',
  };

  return {
    stars,
    aspects,
    mingGong,
    shenGong,
    mingZhu,
    twelvePalaces,
    shensha,
    ziqiModel,
    ziqi,
  };
}

export default Object.freeze({
  generateQizhengCore,
  normalizeInput,
  hourIndex0,
  mansionBoundaryLongitudes,
  xiuOf,
  ziqiLongitude,
  ziqiProgress,
  starLongitudes,
  computeAspects,
  computeShensha,
  PaipanInputError,
});
