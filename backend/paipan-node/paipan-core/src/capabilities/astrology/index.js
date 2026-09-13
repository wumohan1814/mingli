/**
 * 命理 · 自研排盘内核 · 西洋占星星盘（节151）
 * ===========================================================================
 * 导出（与旧实现同签名同形状，stripInternal 后的生产契约）：
 *   - generateAstrolabeCore(flatInput)              ← vendor `generateAstrolabe(flatInput)`
 *   - buildAstrolabeFullScopeContextsCore(natal, dateStr)
 *                                                   ← vendor `buildAstrolabeFullScopeContexts`
 *   - buildAstrolabeScopeContextCore(natal, scope, dateStr)
 *                                                   ← vendor `buildAstrolabeScopeContext`
 *
 * 四段纯函数管线（README §1）：
 *   ① normalizeInput —— flatInput（数字皆字符串）→ 确定性中间对象（东八区挂钟 + UTC 毫秒）
 *   ② resolveCalendar —— 时刻 → JD(UT)/JD(TT)、本地恒星时、黄赤交角（astronomia）
 *   ③ computeNatal —— 天体视黄经 / 四轴 / 12 宫 / 相位 / 庙旺陷落 / 元素形态
 *   ④ assemble —— 按生产契约键序拼装
 * 纪律：零 IO / 零网络 / 零 LLM / 零随机 / 零时钟；缺输入抛 PaipanInputError。
 */

import {
  ZODIAC_SIGNS, ZODIAC_ELEMENT, ZODIAC_MODALITY, ELEMENT_ORDER, MODALITY_ORDER,
  BODY_ORDER, BODY_LABELS, ASTEROID_DEFERRED, RETROGRADE_BODIES, ASPECTS,
  CLOSENESS_BANDS, DIGNITY_TABLE, DIGNITY_LABELS, ANGLE_DEFINITIONS, HOUSE_SYSTEM,
  PLACIDUS_CUSPS, HYPOTHETICAL_POINTS, DAY_CHART_HOUSES, CN_DST_PERIODS,
  DEFAULT_UTC_OFFSET_HOURS, DST_UTC_OFFSET_HOURS, EPHEMERIS_SOURCE,
} from '../../rules/astrology.js';
import {
  norm360, norm180, apparentEclipticLongitude, longitudeRate, trueNodeLongitude,
  meanApogeeLongitude, julianDayUtc, julianEphemerisDay, deltaTSeconds, decimalYear,
  meanObliquity, localSiderealTime, ascendantLongitude, midheavenLongitude,
  placidusCuspLongitude, wholeSignCusps, eclipticToEquatorial, nutation, gmstDeg,
} from './ephemeris.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** 缺输入/非法输入错误类型（与内核其余能力一致的确定性纪律：不猜、不回落当前时间）。 */
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

/** 把「本地挂钟时刻」当作一个无时区的日期字面量，便于与夏令时段表逐字比较。 */
function wallClockInstant(year, month, day, hour, minute) {
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * 判断该挂钟时刻是否落在中国 1986–1991 夏令时段内。
 * 时段表里的边界写成带 +08:00 的本地时刻；这里把挂钟时刻也当作同一「无时区字面量」
 * 解析（即 Date.parse 会按 +08:00 换算成绝对时刻），两端口径一致再比较。
 */
function isChinaDstWallClock(year, month, day, hour, minute) {
  const wallMs = wallClockInstant(year, month, day, hour, minute);
  for (const [startText, endText] of CN_DST_PERIODS) {
    const start = Date.parse(startText);
    const end = Date.parse(endText);
    if (wallMs >= start && wallMs < end) return true;
  }
  return false;
}

/**
 * ① 输入归一化：flatInput → 确定性中间对象。
 * 【实测】flatInput 数字全为字符串；timezone 固定 '8'；坐标为十进制度（东经/北纬为正）。
 * 时区口径见 rules/astrology.js（含中国 1986–1991 夏令时表，实测旧实现即此行为）。
 */
export function normalizeInput(flatInput) {
  if (flatInput === null || typeof flatInput !== 'object') {
    throw new PaipanInputError('invalid_input', 'generateAstrolabeCore 需要一个对象参数');
  }
  const year = requireNumber(flatInput.year, 'year');
  const month = requireNumber(flatInput.month, 'month');
  const day = requireNumber(flatInput.day, 'day');
  const hour = flatInput.hour === undefined ? 0 : requireNumber(flatInput.hour, 'hour');
  const minute = flatInput.minute === undefined ? 0 : requireNumber(flatInput.minute, 'minute');
  const latitude = requireNumber(flatInput.latitude, 'latitude');
  const longitude = requireNumber(flatInput.longitude, 'longitude');
  const timezone = flatInput.timezone === undefined ? DEFAULT_UTC_OFFSET_HOURS : requireNumber(flatInput.timezone, 'timezone');

  if (month < 1 || month > 12) throw new PaipanInputError('invalid_month', `month 超出 1–12：${month}`);
  if (day < 1 || day > 31) throw new PaipanInputError('invalid_day', `day 超出 1–31：${day}`);
  if (hour < 0 || hour > 23) throw new PaipanInputError('invalid_hour', `hour 超出 0–23：${hour}`);
  if (minute < 0 || minute > 59) throw new PaipanInputError('invalid_minute', `minute 超出 0–59：${minute}`);
  if (latitude < -90 || latitude > 90) throw new PaipanInputError('invalid_latitude', `latitude 超出 ±90：${latitude}`);
  if (longitude < -180 || longitude > 180) throw new PaipanInputError('invalid_longitude', `longitude 超出 ±180：${longitude}`);

  // 挂钟时刻 → 绝对时刻。注意：**夏令时只影响时区标签，不影响排星绝对时刻**——
  // 黑盒实测旧实现：1986–1991 夏令时出生（如 1990-07-07 07:30 北京）标签报 UTC+9，
  // 但行星位置按**声明时区（UTC+8）**的绝对时刻（23:30Z）排算（月亮经度实测对拍确认）。
  // 因此 utcMs 一律用声明时区换算；effectiveOffset 仅供 timezone 标签展示。
  const dstApplies = timezone === DEFAULT_UTC_OFFSET_HOURS
    && isChinaDstWallClock(year, month, day, hour, minute);
  const effectiveOffset = dstApplies ? DST_UTC_OFFSET_HOURS : timezone;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - timezone * 3600000;

  const standardDateTime = `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
  const utcDate = new Date(utcMs);
  const utcText = `${utcDate.getUTCFullYear()}-${pad2(utcDate.getUTCMonth() + 1)}-${pad2(utcDate.getUTCDate())} ${pad2(utcDate.getUTCHours())}:${pad2(utcDate.getUTCMinutes())}:${pad2(utcDate.getUTCSeconds())}Z`;

  return {
    name: flatInput.name === undefined ? '' : String(flatInput.name),
    gender: flatInput.gender === undefined ? 'male' : String(flatInput.gender),
    locationName: flatInput.locationName === undefined ? '' : String(flatInput.locationName),
    year, month, day, hour, minute,
    latitude, longitude,
    timezone: effectiveOffset,
    declaredTimezone: timezone,
    dstApplies,
    useTrueSolarTime: Boolean(flatInput.useTrueSolarTime),
    utcMs,
    standardDateTime,
    utcDateTime: utcText,
  };
}

/* ─────────────────────────── ② 历法 / 天文量 ─────────────────────────── */

/** ② 时刻与几何基量。 */
export function resolveCalendar(normalized) {
  const jdUtc = julianDayUtc(normalized.utcMs);
  const jde = julianEphemerisDay(normalized.utcMs);
  const epsMean = meanObliquity(jde);
  const epsTrue = epsMean + nutation(jde).deps * R2D;
  const lst = localSiderealTime(jdUtc, normalized.longitude);
  return {
    julianDayUtc: jdUtc,
    julianEphemerisDay: jde,
    deltaTSeconds: deltaTSeconds(normalized.utcMs),
    decimalYear: decimalYear(normalized.utcMs),
    gmstDegrees: gmstDeg(jdUtc),
    localSiderealDegrees: lst,
    obliquityMeanDegrees: epsMean,
    obliquityTrueDegrees: epsTrue,
    nutationLongitudeDegrees: nutation(jde).dpsi * R2D,
  };
}

/* ───────────────────────────── ③ 格局判定 ───────────────────────────── */

/** 黄经 → 星座下标。 */
export function signIndexOf(longitude) {
  return Math.floor(norm360(longitude) / 30);
}

/**
 * 黄经 → 度/分。
 * 【探针实测】旧实现为「度取 floor、分取 **floor**」：把旧实现自己的黄经按
 *   floor 还原度分，310/310 项与它输出的 (sign, degree, minute) 完全一致；
 *   按 round 还原只有 164/310 一致。故本内核采用 floor(minute)。
 *   （实测样本含 10 条跨 1935–2024 夹具 × 15 天体 + 12 宫头 + 4 轴。）
 */
export function degMinOf(longitude) {
  const inSign = norm360(longitude) % 30;
  const degree = Math.floor(inSign);
  let minute = Math.floor((inSign - degree) * 60);
  if (minute > 59) minute = 59;
  return { degree, minute };
}

/** 格式化 "星座D°MM′"。 */
export function formatPosition(longitude) {
  const sign = ZODIAC_SIGNS[signIndexOf(longitude)];
  const { degree, minute } = degMinOf(longitude);
  return `${sign}${degree}°${pad2(minute)}′`;
}

/**
 * 宫位几何：四轴 + 12 宫头（Placidus；极区无解时整宫制回退）。
 * 返回 { ascendant, midheaven, cusps, system, fallbackApplied }
 */
export function computeHouses(calendar, latitude) {
  const eps = calendar.obliquityMeanDegrees;
  const ramc = calendar.localSiderealDegrees;
  const ascendant = ascendantLongitude(ramc, latitude, eps, midheavenLongitude(ramc, eps));
  const midheaven = midheavenLongitude(ramc, eps);

  const intermediates = {};
  let fallback = false;
  for (const [houseText, spec] of Object.entries(PLACIDUS_CUSPS)) {
    const value = placidusCuspLongitude(Number(houseText), ramc, latitude, eps, spec);
    if (value === null) fallback = true;
    intermediates[Number(houseText)] = value;
  }

  if (fallback) {
    return {
      ascendant,
      midheaven,
      cusps: wholeSignCusps(ascendant),
      system: HOUSE_SYSTEM.fallback,
      fallbackApplied: true,
    };
  }

  const cusps = new Array(12);
  cusps[0] = ascendant;
  cusps[9] = midheaven;
  cusps[3] = norm360(midheaven + 180);
  cusps[6] = norm360(ascendant + 180);
  cusps[10] = intermediates[11];
  cusps[11] = intermediates[12];
  cusps[1] = intermediates[2];
  cusps[2] = intermediates[3];
  cusps[4] = norm360(intermediates[11] + 180);
  cusps[5] = norm360(intermediates[12] + 180);
  cusps[7] = norm360(intermediates[2] + 180);
  cusps[8] = norm360(intermediates[3] + 180);

  return { ascendant, midheaven, cusps, system: HOUSE_SYSTEM.id, fallbackApplied: false };
}

/** 落宫：cusp[i] ≤ λ < cusp[i+1]（末宫跨 360°）。 */
export function houseOfLongitude(longitude, cusps) {
  const lon = norm360(longitude);
  for (let i = 0; i < 12; i += 1) {
    const start = cusps[i];
    const span = norm360(cusps[(i + 1) % 12] - start);
    if (norm360(lon - start) < span) return i + 1;
  }
  return 12;
}

/** 庙旺陷落（只对古典七曜）。 */
export function essentialDignity(bodyLabel, signName) {
  const table = DIGNITY_TABLE[bodyLabel];
  if (!table) return null;
  for (const key of ['domicile', 'exaltation', 'detriment', 'fall']) {
    if (table[key].includes(signName)) {
      return { dignity: key, dignityLabel: DIGNITY_LABELS[key] };
    }
  }
  return null;
}

/** 行星位置表（BODY_ORDER 顺序），含逆行、落宫、庙旺陷落。 */
export function computeBodies(calendar, houses) {
  const jde = calendar.julianEphemerisDay;
  const ascendant = houses.ascendant;
  const midheaven = houses.midheaven;

  const raw = {};
  for (const body of BODY_ORDER) {
    let longitude;
    if (body === 'North Node') longitude = trueNodeLongitude(jde);
    else if (body === 'South Node') longitude = norm360(trueNodeLongitude(jde) + 180);
    else if (body === 'True Lilith') longitude = meanApogeeLongitude(jde);
    else if (body === 'Part of Fortune' || body === 'Part of Spirit') continue;
    else longitude = apparentEclipticLongitude(body, jde);
    raw[body] = longitude;
  }
  // 日月位置（福点/精神点与昼夜判定用）
  const sunLon = raw.Sun;
  const moonLon = raw.Moon;
  // 先用不含福点的宫位测出太阳落宫，再定昼夜（旧实现同序：先定位后取点）
  const sunHouse = houseOfLongitude(sunLon, houses.cusps);
  const isDayChart = DAY_CHART_HOUSES.includes(sunHouse);
  raw['Part of Fortune'] = isDayChart
    ? norm360(ascendant + moonLon - sunLon)
    : norm360(ascendant + sunLon - moonLon);
  raw['Part of Spirit'] = isDayChart
    ? norm360(ascendant + sunLon - moonLon)
    : norm360(ascendant + moonLon - sunLon);

  const rateBodies = new Set(RETROGRADE_BODIES);
  return BODY_ORDER.map((body) => {
    const longitude = raw[body];
    const signIndex = signIndexOf(longitude);
    const sign = ZODIAC_SIGNS[signIndex];
    const { degree, minute } = degMinOf(longitude);
    const retrograde = rateBodies.has(body) ? longitudeRate(body, jde) < 0 : false;
    const dignity = essentialDignity(body, sign);
    const entry = {
      name: body,
      label: BODY_LABELS[body],
      longitude,
      sign,
      degree,
      minute,
      house: houseOfLongitude(longitude, houses.cusps),
      formatted: `${sign}${degree}°${pad2(minute)}′`,
      retrograde,
    };
    if (dignity) {
      entry.dignity = dignity.dignity;
      entry.dignityLabel = dignity.dignityLabel;
    }
    return entry;
  });
}

/** 四轴表（顺序：上升、天顶、下降、天底）。 */
export function computeAngles(houses) {
  const values = {
    Ascendant: houses.ascendant,
    Midheaven: houses.midheaven,
    Descendant: norm360(houses.ascendant + 180),
    'Imum Coeli': norm360(houses.midheaven + 180),
  };
  return ANGLE_DEFINITIONS.map((def) => {
    const longitude = values[def.name];
    const sign = ZODIAC_SIGNS[signIndexOf(longitude)];
    const { degree, minute } = degMinOf(longitude);
    return {
      name: def.name,
      label: def.label,
      longitude,
      sign,
      degree,
      minute,
      house: 0,
      formatted: `${sign}${degree}°${pad2(minute)}′`,
    };
  });
}

/** 12 宫头表。 */
export function computeHouseEntries(houses) {
  return houses.cusps.map((longitude, index) => {
    const sign = ZODIAC_SIGNS[signIndexOf(longitude)];
    const { degree, minute } = degMinOf(longitude);
    return {
      name: `House ${index + 1}`,
      label: `第${index + 1}宫`,
      longitude,
      sign,
      degree,
      minute,
      house: index + 1,
      formatted: `${sign}${degree}°${pad2(minute)}′`,
    };
  });
}

/** 相位集合（按 orb 升序，与实测旧实现同序）。 */
export function computeAspects(bodies, jde) {
  const list = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let k = i + 1; k < bodies.length; k += 1) {
      const a = bodies[i];
      const b = bodies[k];
      const separation = Math.abs(norm180(b.longitude - a.longitude));
      for (const aspect of ASPECTS) {
        const orb = Math.abs(separation - aspect.exactAngle);
        if (orb > aspect.allowedOrb) continue;
        const normalizedOrbRatio = Number((orb / aspect.allowedOrb).toFixed(4));
        let closeness = CLOSENESS_BANDS[CLOSENESS_BANDS.length - 1].label;
        for (const band of CLOSENESS_BANDS) {
          if (orb / aspect.allowedOrb < band.maxRatio) { closeness = band.label; break; }
        }
        list.push({
          // 【实测】旧实现 aspects 的 body1/body2 用**中文标签**（如「水星」「木星」），
          // 不是英文名 —— 与 planets[].label 同一套文本。
          body1: a.label,
          body2: b.label,
          type: aspect.name,
          symbol: aspect.symbol,
          exactAngle: aspect.exactAngle,
          actualAngle: Number((separation === 180 ? 180 : separation).toFixed(4)),
          orb: Number(orb.toFixed(2)),
          allowedOrb: aspect.allowedOrb,
          closeness,
          normalizedOrbRatio,
          isOutOfSign: signIndexOf(a.longitude) !== signIndexOf(b.longitude),
          applying: isApplying(a, b, aspect, jde),
        });
      }
    }
  }
  list.sort((x, y) => (x.orb - y.orb) || (x.body1 < y.body1 ? -1 : x.body1 > y.body1 ? 1 : 0)
    || (x.body2 < y.body2 ? -1 : x.body2 > y.body2 ? 1 : 0));
  return list;
}

/**
 * 入相 / 出相（本内核口径）。
 * 用「两侧 ±1 天的实际夹角变化方向」判断：夹角在向精确角收敛 ⇒ 入相。
 * ⚠️ 已知缺口：旧实现的 applying 与任何单一速率口径都无法完全对上
 * （其自身在若干样本上不自洽），故 **不纳入关键字段**（见报告「未解决差异 #4」）。
 */
function isApplying(bodyA, bodyB, aspect, jde) {
  const supported = new Set([
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
    'Uranus', 'Neptune', 'Pluto',
  ]);
  if (!supported.has(bodyA.name) || !supported.has(bodyB.name)) return false;
  const sep = (t) => Math.abs(norm180(
    apparentEclipticLongitude(bodyB.name, t) - apparentEclipticLongitude(bodyA.name, t),
  ));
  const now = sep(jde);
  const next = sep(jde + 1);
  return Math.abs(next - aspect.exactAngle) < Math.abs(now - aspect.exactAngle) && next !== now;
}

/** 元素与形态分布（只统计十大行星；实测旧实现即此范围）。 */
export function computeSummary(bodies) {
  const elements = Object.fromEntries(ELEMENT_ORDER.map((k) => [k, []]));
  const modalities = Object.fromEntries(MODALITY_ORDER.map((k) => [k, []]));
  const retrograde = [];
  const tenPlanets = BODY_ORDER.slice(0, 10).map((name) => BODY_LABELS[name]);
  for (const p of bodies) {
    if (!tenPlanets.includes(p.label)) continue;
    const signIndex = signIndexOf(p.longitude);
    elements[ZODIAC_ELEMENT[signIndex]].push(p.label);
    modalities[ZODIAC_MODALITY[signIndex]].push(p.label);
    if (p.retrograde) retrograde.push(p.label);
  }
  return { elements, modalities, retrograde };
}

/* ───────────────────────────── 太阳光照块 ───────────────────────────── */

function solarGeometry(calendar, latitude, longitude, utcMs) {
  const jde = calendar.julianEphemerisDay;
  const eps = calendar.obliquityMeanDegrees;
  const epsTrue = calendar.obliquityTrueDegrees;
  const sunLon = apparentEclipticLongitude('Sun', jde);
  const eq = eclipticToEquatorial(sunLon, 0, epsTrue);
  const jdUtc = calendar.julianDayUtc;
  const lst = norm360(gmstDeg(jdUtc) + longitude);
  const hourAngle = norm180(lst - eq.ra);
  const phi = latitude * D2R;
  const decR = eq.dec * D2R;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(decR) + Math.cos(phi) * Math.cos(decR) * Math.cos(hourAngle * D2R),
  ) * R2D;
  const azimuth = norm360(
    Math.atan2(Math.sin(hourAngle * D2R), Math.cos(hourAngle * D2R) * Math.sin(phi) - Math.tan(decR) * Math.cos(phi)) * R2D + 180,
  );
  const T = (jde - 2451545.0) / 36525;
  const L0 = norm360(280.4664567 + 360007.6982779 * (T / 10) + 0.03032028 * (T / 10) ** 2);
  const equationOfTime = norm180(L0 - 0.0057183 - eq.ra + nutation(jde).dpsi * R2D * Math.cos(eps * D2R));

  // 真太阳正午：本地平正午（12:00 挂钟）+ 经度修正 − 时间方程
  const zoneHours = calendar.timezoneHours || DEFAULT_UTC_OFFSET_HOURS;
  const localNoonUtcMs = Date.UTC(
    new Date(utcMs).getUTCFullYear(),
    new Date(utcMs).getUTCMonth(),
    new Date(utcMs).getUTCDate(),
  ) + 12 * 3600000 - zoneHours * 3600000;
  const apparentNoonUtcMs = Math.round(
    localNoonUtcMs - (longitude / 15) * 3600000 + equationOfTime * 60000,
  );
  return {
    declination: eq.dec,
    rightAscension: eq.ra,
    hourAngle,
    altitude,
    azimuth,
    equationOfTimeMinutes: equationOfTime * 4,
    apparentNoonUtcMs,
  };
}

function formatUtcIso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatLocal(ms, zoneHours) {
  const shifted = new Date(ms + zoneHours * 3600000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())} ${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

/**
 * 太阳光照块（结构对齐旧实现；数值为本内核自研 NOAA/标准公式口径，
 * 实测与旧实现高度角差 ≤ 0.31°、时间方程差 ≤ 0.38 分钟 —— 见报告精度表）。
 */
export function computeSolarIllumination(normalized, calendar) {
  const zoneHours = normalized.timezone;
  const geo = solarGeometry(calendar, normalized.latitude, normalized.longitude, normalized.utcMs);
  const localDate = `${normalized.year}-${pad2(normalized.month)}-${pad2(normalized.day)}`;
  const noon = geo.apparentNoonUtcMs;
  const adjusted = { ...calendar, timezoneHours: zoneHours };
  const noonRecompute = solarGeometry(
    { ...adjusted, julianDayUtc: julianDayUtc(noon), julianEphemerisDay: julianEphemerisDay(noon) },
    normalized.latitude,
    normalized.longitude,
    noon,
  );
  return {
    key: `solar-illumination:${localDate}:${normalized.latitude}:${normalized.longitude}`,
    status: '已计算',
    localDate,
    referenceLocalDateTime: `${normalized.standardDateTime}:00`,
    referenceUtcDateTime: normalized.utcDateTime,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    timezone: zoneHours,
    solarAltitudeDegrees: Number(geo.altitude.toFixed(4)),
    solarAzimuthDegrees: Number(geo.azimuth.toFixed(4)),
    solarDeclinationDegrees: Number(geo.declination.toFixed(6)),
    equationOfTimeMinutes: Number(geo.equationOfTimeMinutes.toFixed(4)),
    apparentSolarNoonUtcDateTime: formatUtcIso(noon),
    apparentSolarNoonLocalDateTime: formatLocal(noon, zoneHours),
    astronomyNote: {
      declinationDegrees: Number(noonRecompute.declination.toFixed(6)),
      hourAngleDegrees: Number(noonRecompute.hourAngle.toFixed(6)),
      source: EPHEMERIS_SOURCE.note,
    },
  };
}

/* ───────────────────────────── ④ 输出装配 ───────────────────────────── */

/**
 * 西洋占星本命盘（自研内核）—— 形状对齐 vendor `generateAstrolabe(flatInput)`
 * 经 `stripInternal` 后的生产契约。
 */
export function generateAstrolabeCore(flatInput) {
  const normalized = normalizeInput(flatInput);
  const calendar = resolveCalendar(normalized);
  const houses = computeHouses(calendar, normalized.latitude);
  const bodies = computeBodies(calendar, houses);
  const angles = computeAngles(houses);
  const houseEntries = computeHouseEntries(houses);
  const aspects = computeAspects(bodies, calendar.julianEphemerisDay);
  const summary = computeSummary(bodies);
  const solarIllumination = computeSolarIllumination(normalized, calendar);

  return {
    birth: {
      name: normalized.name,
      gender: normalized.gender,
      dateTime: normalized.standardDateTime,
      location: `${normalized.locationName}（${normalized.latitude}, ${normalized.longitude}）`,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      timezone: normalized.timezone,
      standardDateTime: normalized.standardDateTime,
      isTrueSolarTime: normalized.useTrueSolarTime,
    },
    planets: bodies,
    angles,
    houses: houseEntries,
    aspects,
    solarIllumination,
    summary,
    houseSystem: {
      id: houses.system,
      label: houses.system === HOUSE_SYSTEM.id ? HOUSE_SYSTEM.label : HOUSE_SYSTEM.fallbackLabel,
      fallbackApplied: houses.fallbackApplied,
    },
    meta: {
      engine: 'mingli-paipan-core',
      capability: 'astrology',
      engineVersion: '0.1.0-mingli',
      schemaVersion: '1.0.0',
      ephemeris: EPHEMERIS_SOURCE,
      computedBodies: BODY_ORDER.length,
      deferredBodies: ASTEROID_DEFERRED.map((b) => b.name),
      julianDayUtc: calendar.julianDayUtc,
      deltaTSeconds: calendar.deltaTSeconds,
      localSiderealDegrees: calendar.localSiderealDegrees,
      obliquityMeanDegrees: calendar.obliquityMeanDegrees,
    },
  };
}

/* ─────────────────────── fullScope 上下文（上下文集） ─────────────────────── */

const SCOPE_LABELS = Object.freeze({
  natal: { displayText: '仅使用本命信息', displayLabel: '本命盘' },
  yearly: { displayText: (d) => `流年 · ${d}`, displayLabel: (d) => `流年${d}` },
  monthly: { displayText: (d) => `流月 · ${d}`, displayLabel: (d) => `流月${d}` },
  daily: { displayText: (d) => `流日 · ${d}`, displayLabel: (d) => `流日${d}` },
});

function parseScopeDate(dateStr) {
  const text = String(dateStr === undefined || dateStr === null ? '' : dateStr).trim();
  if (text === '') return { scope: 'natal', year: null, month: null, day: null };
  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    if (year < 1 || year > 9999) throw new PaipanInputError('invalid_date_str', `year 超出范围：${text}`);
    return { scope: 'yearly', year, month: null, day: null };
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(5, 7));
    if (month < 1 || month > 12) throw new PaipanInputError('invalid_date_str', `month 超出 1–12：${text}`);
    return { scope: 'monthly', year, month, day: null };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(5, 7));
    const day = Number(text.slice(8, 10));
    if (month < 1 || month > 12) throw new PaipanInputError('invalid_date_str', `month 超出 1–12：${text}`);
    if (day < 1 || day > 31) throw new PaipanInputError('invalid_date_str', `day 超出 1–31：${text}`);
    return { scope: 'daily', year, month, day };
  }
  throw new PaipanInputError('invalid_date_str', `无法识别的 dateStr：${dateStr}（应为 YYYY / YYYY-MM / YYYY-MM-DD）`);
}

/** 出生信息（自 natal 契约提取；缺字段抛错）。 */
function birthOf(natal) {
  const birth = natal && natal.birth ? natal.birth : null;
  if (!birth) throw new PaipanInputError('invalid_natal', 'buildAstrolabeFullScopeContextsCore 需要 natal.birth');
  const m = String(birth.standardDateTime || birth.dateTime || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) throw new PaipanInputError('invalid_natal_birth', `natal.birth 时间格式无法解析：${birth.standardDateTime || birth.dateTime}`);
  return {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]),
    latitude: Number(birth.latitude),
    longitude: Number(birth.longitude),
    // 【实测】fullScope 的 timezoneLabel 固定用**声明时区**（UTC+8），
    // 即使 birth.timezone 因中国 1986–1991 夏令时表被改写成 9 也仍是 UTC+8。
    timezone: Number(birth.timezone),
    zoneLabel: `UTC+${Number.isFinite(Number(birth.declaredTimezone)) ? Number(birth.declaredTimezone) : 8}`,
    locationName: String(birth.location || '').replace(/（.*$/, ''),
  };
}

/**
 * 推进盘（次限/太阳弧共用）：出生挂钟 + N 天。
 * 【实测】旧实现的 `progressedDateTime` 输出形态为 `YYYY-MM-DDTHH:MM:00.000Z`，
 *   但其时分秒就是**出生挂钟时刻**（1990-05-12 07:30 出生 → 1990-06-17T07:30:00.000Z），
 *   即把挂钟当作 UTC 直接拼接（不是真正的 UTC 时刻）。本内核为与生产契约逐字一致，
 *   按同一形态输出；真正的 UTC 时刻另由 `progressedUtcMs` 提供（信息性）。
 */
function progressedWallClockString(birth, dayOffset) {
  const d = new Date(Date.UTC(birth.year, birth.month - 1, birth.day + dayOffset, birth.hour, birth.minute));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00.000Z`;
}

/** 用「出生时刻 + N 天」重算全盘（次限/太阳弧共用）。 */
function natalLikeAt(birth, dayOffset, minuteOffset = 0) {
  const utcMs = Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute)
    - birth.timezone * 3600000 + dayOffset * 86400000 + minuteOffset * 60000;
  const d = new Date(utcMs + birth.timezone * 3600000);
  return generateAstrolabeCore({
    name: '', gender: 'male', locationName: birth.locationName,
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(),
    latitude: birth.latitude, longitude: birth.longitude,
    timezone: birth.timezone, useTrueSolarTime: false,
  });
}

/** 回归黄经的时刻（二分法细化）。 */
function findLongitudeCrossing(targetLongitude, startMs, windowHours, coarseStepHours, toleranceMinutes, iterations) {
  const spanMs = windowHours * 3600000;
  const stepMs = coarseStepHours * 3600000;
  const residual = (ms) => {
    const jde = julianEphemerisDay(ms);
    return norm180(apparentEclipticLongitude('Sun', jde) - targetLongitude);
  };
  let bracket = null;
  let previousMs = startMs;
  let previousValue = residual(previousMs);
  for (let ms = startMs + stepMs; ms <= startMs + spanMs; ms += stepMs) {
    const value = residual(ms);
    if (previousValue === 0 || (previousValue < 0) !== (value < 0)) {
      bracket = [previousMs, ms];
      break;
    }
    previousMs = ms;
    previousValue = value;
  }
  if (!bracket) return null;
  let [low, high] = bracket;
  let lowValue = residual(low);
  for (let i = 0; i < iterations * 8; i += 1) {
    const mid = (low + high) / 2;
    const midValue = residual(mid);
    if (Math.abs(midValue) <= 0.001) { lowValue = midValue; low = mid; high = mid; break; }
    if ((lowValue < 0) !== (midValue < 0)) { high = mid; } else { low = mid; lowValue = midValue; }
    if (high - low <= toleranceMinutes * 60000) break;
  }
  const solved = Math.round((low + high) / 2);
  return { utcMs: solved, residualDegrees: residual(solved) };
}

/** 太阳返照。 */
function solarReturnEvidence(natal, targetYear) {
  const birth = birthOf(natal);
  const sunNatal = natal.planets.find((p) => p.name === 'Sun').longitude;
  // 搜索窗：目标年「出生月日」所在日的 00:00（当地）起 48 小时
  const searchStartUtc = Date.UTC(targetYear, birth.month - 1, birth.day) - birth.timezone * 3600000;
  const solved = findLongitudeCrossing(sunNatal, searchStartUtc, 48, 2, 1, 7);
  if (!solved) return null;
  return {
    key: `solar-return:${targetYear}`,
    targetYear,
    timezone: birth.timezone,
    searchWindowHours: 48,
    coarseStepHours: 2,
    refinementToleranceMinutes: 1,
    refinementIterations: 7,
    status: 'exact',
    dateTime: formatLocal(solved.utcMs, birth.timezone).slice(0, 16),
    residualDegrees: Number(Math.abs(solved.residualDegrees).toFixed(6)),
    julianDate: julianDayUtc(solved.utcMs),
  };
}

/** 次限推进（一岁一日）。 */
function secondaryProgression(birth, targetYear) {
  const age = targetYear - birth.year;
  const progressed = natalLikeAt(birth, age);
  return {
    key: `secondary-progression:${targetYear}`,
    status: 'calculated',
    targetYear,
    age,
    progressedDateTime: new Date(
      Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) - birth.timezone * 3600000
        + age * 86400000,
    ).toISOString(),
    planets: progressed.planets.map((p) => ({
      name: p.name, label: p.label, longitude: p.longitude, sign: p.sign, degree: p.degree, minute: p.minute,
    })),
  };
}

/** 太阳弧推进。 */
function solarArc(birth, targetYear) {
  const age = targetYear - birth.year;
  const progressed = natalLikeAt(birth, age);
  const natalSun = null;
  return {
    key: `solar-arc:${targetYear}`,
    status: 'calculated',
    targetYear,
    age,
    progressedDateTime: new Date(
      Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) - birth.timezone * 3600000
        + age * 86400000,
    ).toISOString(),
    progressedPlanets: progressed.planets.map((p) => ({ name: p.name, longitude: p.longitude })),
    natalSun,
  };
}

/** 流年块（含太阳返照 / 次限 / 太阳弧 / 周期事件容器）。 */
function yearlyBlock(natal, birth, year) {
  const natalSun = natal.planets.find((p) => p.name === 'Sun').longitude;
  const evidence = {
    scope: 'yearly',
    dateStr: `${year}`,
    displayText: `流年 · ${year}`,
    displayLabel: `流年${year}`,
    promptText: `分析对象：流年${year}。`,
  };
  const solarReturn = solarReturnEvidence(natal, year);
  if (solarReturn) evidence.solarReturnEvidence = solarReturn;
  evidence.secondaryProgressionEvidence = secondaryProgression(birth, year);
  const arc = solarArc(birth, year);
  const progressedSun = arc.progressedPlanets.find((p) => p.name === 'Sun');
  arc.natalSun = natalSun;
  arc.arcDegrees = Number(norm360(progressedSun.longitude - natalSun).toFixed(6));
  delete arc.progressedPlanets;
  evidence.solarArcEvidence = arc;
  evidence.periodEvents = {
    startDateTime: `${year}-01-01 00:00`,
    endDateTime: `${year + 1}-01-01 00:00`,
    timezoneLabel: `UTC+${birth.timezone}`,
    events: [],
    groups: [],
    windows: [],
    axis: [],
    coverage: 'not-implemented',
    coverageNote: '本内核尚未实现周期关键星象事件流（交食/朔望/换座/换宫/停逆/行运相位触发时刻扫描）',
  };
  return evidence;
}

/** 流月 / 流日块（事件流未实现，诚实标注）。 */
function periodBlock(scopeName, year, month, day, birth) {
  const dateStr = scopeName === 'monthly' ? `${year}-${pad2(month)}` : `${year}-${pad2(month)}-${pad2(day)}`;
  const labelCn = scopeName === 'monthly' ? `流月 · ${dateStr}` : `流日 · ${dateStr}`;
  const labelShort = scopeName === 'monthly' ? `流月${dateStr}` : `流日${dateStr}`;
  const startDateTime = scopeName === 'monthly'
    ? `${dateStr}-01 00:00`
    : `${dateStr} 00:00`;
  const endDateTime = scopeName === 'monthly'
    ? (month === 12 ? `${year + 1}-01-01 00:00` : `${year}-${pad2(month + 1)}-01 00:00`)
    : (() => {
      const next = new Date(Date.UTC(year, month - 1, day) + 86400000);
      return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())} 00:00`;
    })();
  return {
    scope: scopeName,
    dateStr,
    displayText: labelCn,
    displayLabel: labelShort,
    promptText: `分析对象：${labelShort}。`,
    periodEvents: {
      startDateTime,
      endDateTime,
      timezoneLabel: `UTC+${birth.timezone}`,
      events: [],
      groups: [],
      windows: [],
      axis: [],
      coverage: 'not-implemented',
      coverageNote: '本内核尚未实现周期关键星象事件流（交食/朔望/换座/换宫/停逆/行运相位触发时刻扫描）',
    },
  };
}

/**
 * 流年 / 流月 / 流日上下文集（形状对齐 vendor `buildAstrolabeFullScopeContexts` 的
 * stripInternal 后契约）。
 *
 * ⚠️ 契约行为（实测）：旧实现要求 `dateStr` 为 **YYYY-MM-DD**，且**一次返回全部四个
 *    scope 块**（natal + yearly + monthly + daily），粒度由它自己从该日期推导
 *    （yearly 取年、monthly 取年月、daily 取日月）。
 *    本内核接受 YYYY / YYYY-MM / YYYY-MM-DD 三种粒度，YYYY-MM-DD 时同样返回四个块
 *    （与旧实现一致）；传 YYYY 或 YYYY-MM 时只返回能确定粒度的块。
 *
 * 覆盖声明（诚实标注，见节151 报告「未解决差异 #5」）：
 *   已实现：四 scope 的标签块 + 太阳返照（二分法求黄经回归）+ 次限（一岁一日）+
 *          太阳弧（推进太阳 − 本命太阳）+ 流年周期事件容器。
 *   未实现：周期关键星象事件流（`periodEvents.events`：交食/朔望/换座/换宫/停逆/
 *          行运相位触发时刻扫描），旧实现每年约 95 项、每日约 12 项。
 *          本内核输出**结构完整的空事件流**并带 `coverage: 'not-implemented'` 标注，
 *          不伪造事件。
 */
export function buildAstrolabeFullScopeContextsCore(natal, dateStr) {
  const parsed = parseScopeDate(dateStr);
  const birth = birthOf(natal);

  const result = {
    natal: {
      scope: 'natal',
      dateStr: '',
      displayText: SCOPE_LABELS.natal.displayText,
      displayLabel: SCOPE_LABELS.natal.displayLabel,
      promptText: '分析对象：本命盘。',
    },
  };

  if (parsed.scope === 'natal') return result;

  const year = parsed.year;
  result.yearly = yearlyBlock(natal, birth, year);
  if (parsed.month !== null) {
    result.monthly = periodBlock('monthly', year, parsed.month, 1, birth);
  }
  if (parsed.day !== null) {
    result.daily = periodBlock('daily', year, parsed.month, parsed.day, birth);
  }
  return result;
}

/** 单 scope 上下文（形状对齐 vendor `buildAstrolabeScopeContext`）。 */
export function buildAstrolabeScopeContextCore(natal, scopeName, dateStr) {
  const name = scopeName === undefined ? 'natal' : String(scopeName);
  const contexts = buildAstrolabeFullScopeContextsCore(natal, dateStr);
  if (!contexts[name]) {
    throw new PaipanInputError('invalid_scope', `不支持的 scope：${name}（应为 natal / yearly / monthly / daily；且 dateStr 粒度需足够）`);
  }
  return contexts[name];
}

export default Object.freeze({
  generateAstrolabeCore,
  buildAstrolabeFullScopeContextsCore,
  buildAstrolabeScopeContextCore,
  normalizeInput,
  resolveCalendar,
  computeHouses,
  computeBodies,
  computeAngles,
  computeHouseEntries,
  computeAspects,
  computeSummary,
  computeSolarIllumination,
  houseOfLongitude,
  essentialDignity,
  signIndexOf,
  degMinOf,
  formatPosition,
  PaipanInputError,
});
