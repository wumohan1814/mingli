/**
 * 命理 · 自研排盘内核 · 西洋占星星历层（节151）
 * ===========================================================================
 * 职责：把「绝对时刻 + 地理位置」变成**视地心黄道坐标**与**宫位几何**。
 * 星历地基：`astronomia@4.2.0`（commenthol，MIT）—— VSOP87 全行星级数、
 *   ELP2000-82B 月球、astronomia 自带冥王星级数、交动/岁差/恒星时模块。
 *   **本文件不复制 astronomia 源码，只调用其公开 API**；上层（宫位/相位/庙旺/
 *   输出装配）全部自研。
 *
 * 口径（全部写进 rules/astrology.js 的来源标注）：
 *   1. 时间尺度：挂钟时刻 → UTC 毫秒 → JD(UT) → JD(TT) = JD(UT) + ΔT/86400，
 *      ΔT 用 astronomia `deltat.deltaT(decimalYear)`（Espenak–Meeus 分段多项式）。
 *   2. 行星：VSOP87(B) 日心黄经黄纬（当日分点）→ 地心向量 → 光行时迭代（3 次）
 *      → 周年光行差（Meeus 23.2 黄道形式）→ 交动 Δψ（IAU1980 22 项）⇒ 视黄经。
 *   3. 月球：ELP2000-82B 地心黄经黄纬（当日分点）→ 交动 Δψ ⇒ 视黄经。
 *   4. 冥王星：astronomia pluto 级数（J2000 黄道）→ 岁差到当日分点 → 光行差 → 交动。
 *   5. 宫位：本地恒星时 = GMST(JD_UT) + 东经；黄赤交角 = IAU1980 平均交角；
 *      上升/天顶闭式 + Placidus 中间宫牛顿迭代（见 rules/astrology.js）。
 *
 * 实测精度（vs 旧实现黑盒输出，探针 15/23/33）：
 *   月球 ≤ 0.5″；太阳系统性 −19.5″；其余行星 ≤ 30″；四轴 ≤ 33″；宫头 ≤ 52″。
 *   （天体位置用中心差分判逆行：13 样例 × 8 天体与旧实现 100% 一致。）
 *
 * 纪律：纯函数、零 IO、零网络、零随机、零时钟；输入输出均为普通 JSON 数值。
 */

import {
  planetposition, moonposition, nutation as nutationModule, precess, coord, base,
  pluto as plutoModule, deltat,
} from 'astronomia';
import astronomiaData from 'astronomia/data';
import {
  AU_KM, MOON_MU_KM3_S2, LIGHT_TIME_DAYS_PER_AU, ABERRATION_ARCSEC,
} from '../../rules/astrology.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** 归一到 [0, 360)。 */
export function norm360(value) {
  const v = value % 360;
  return v < 0 ? v + 360 : v;
}

/** 归一到 [−180, 180)。 */
export function norm180(value) {
  const v = norm360(value);
  return v >= 180 ? v - 360 : v;
}

const { Planet } = planetposition;

/** VSOP87(B) 行星序列（Astronomia 数据模块，MIT）。惰性单例，避免重复解析大表。 */
let vsopCache = null;
function vsop() {
  if (!vsopCache) {
    vsopCache = {
      mercury: new Planet(astronomiaData.vsop87Bmercury),
      venus: new Planet(astronomiaData.vsop87Bvenus),
      earth: new Planet(astronomiaData.vsop87Bearth),
      mars: new Planet(astronomiaData.vsop87Bmars),
      jupiter: new Planet(astronomiaData.vsop87Bjupiter),
      saturn: new Planet(astronomiaData.vsop87Bsaturn),
      uranus: new Planet(astronomiaData.vsop87Buranus),
      neptune: new Planet(astronomiaData.vsop87Bneptune),
    };
  }
  return vsopCache;
}

/** 行星英文键 → VSOP87 键。 */
export const VSOP_KEY = Object.freeze({
  Mercury: 'mercury', Venus: 'venus', Mars: 'mars', Jupiter: 'jupiter',
  Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune',
});

/** 儒略日（UTC）由 epoch 毫秒求得。 */
export function julianDayUtc(epochMs) {
  return epochMs / 86400000 + 2440587.5;
}

/** 十进制年（用于 ΔT 分段模型；取年中近似，与旧实现同量级）。 */
export function decimalYear(epochMs) {
  const d = new Date(epochMs);
  const year = d.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const endOfYear = Date.UTC(year + 1, 0, 1);
  return year + (epochMs - startOfYear) / (endOfYear - startOfYear);
}

/** ΔT（秒）。astronomia deltat.deltaT 接受十进制年；超范围时退化为 0 并夹逼。 */
export function deltaTSeconds(epochMs) {
  const dy = decimalYear(epochMs);
  let dt = 0;
  try {
    dt = deltat.deltaT(dy);
  } catch {
    dt = 0;
  }
  if (!Number.isFinite(dt)) dt = 0;
  return dt;
}

/** JD(UT) → JD(TT)。 */
export function julianEphemerisDay(epochMs) {
  return julianDayUtc(epochMs) + deltaTSeconds(epochMs) / 86400;
}

/** 黄道坐标（当日分点）→ 赤经赤纬（度）。 */
export function eclipticToEquatorial(lambdaDeg, betaDeg, epsDeg) {
  const l = lambdaDeg * D2R;
  const b = betaDeg * D2R;
  const e = epsDeg * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm360(ra * R2D), dec: dec * R2D };
}

/** IAU 1980 平均黄赤交角（Meeus 22.2），度。 */
export function meanObliquity(jde) {
  const u = (jde - 2451545.0) / 36525 / 100;
  return 23.439291111111 - 0.0130041666667 * u - 1.6666667e-7 * u * u + 5.02777778e-7 * u * u * u;
}

/** 格林尼治平恒星时（度），输入 JD(UT)。（Meeus 12.4） */
export function gmstDeg(jdUt) {
  const T = (jdUt - 2451545.0) / 36525;
  const theta = 280.46061837 + 360.98564736629 * (jdUt - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  return norm360(theta);
}

/** 本地恒星时（度）= GMST + 东经。 */
export function localSiderealTime(jdUt, longitudeEastDeg) {
  return norm360(gmstDeg(jdUt) + longitudeEastDeg);
}

/** 交动 [Δψ, Δε]（弧度）。 */
export function nutation(jde) {
  const pair = nutationModule.nutation(jde);
  return { dpsi: pair[0], deps: pair[1] };
}

/**
 * 周年光行差（黄道形式，Meeus 23.2），返回黄经修正（度）。
 *
 * ⚠️ **口径标定结论（节151 探针 45/47，重要）**：本内核默认**不应用**周年光行差。
 *   实测证据（宽网格：6 地点 × 10 时刻 × 10 天体）：
 *     含光行差（物理上更完整的「视位置」）：整体 RMS 19.58″，太阳偏置 −20.40″；
 *     去光行差（纯几何地心位置）：整体 RMS 14.96″，**10 个天体里 8 个更贴近旧实现**
 *       （水星 −20.46″→−20.01″、金星 −19.09″→−18.00″、土星 −13.12″→−3.35″、
 *        木星 +1.17″→−0.91″、海王星 −0.20″→−4.95″、冥王星 −5.75″→−5.24″ …）。
 *   结论：旧实现（Caelus）输出的是**几何地心黄经**（不含周年光行差），
 *   本内核以「与生产契约一致」为先，采用同一约定；函数保留以备后续切换与测试。
 *   太阳另有独立口径线索（探针 46）：含光行差 −20.40″、去光行差 −20.61″，
 *   而 Meeus 低精度视黄经公式的偏置仅 −5.99″（RMS 9.71″）——说明旧实现的太阳
 *   位置比本内核的 VSOP87 地球黄经更接近低精度公式，本内核仍保留 VSOP87（更正确），
 *   其 ~20″ 差异即两套太阳理论的固有差，已如实计入精度表。
 */
export function eclipticAberration(lambdaDeg, betaDeg, jde) {
  const T = (jde - 2451545.0) / 36525;
  const sunLon = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const k = ABERRATION_ARCSEC / 3600;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const perihelion = 102.93735 + 1.71946 * T + 0.00046 * T * T;
  const cosBeta = Math.cos(betaDeg * D2R);
  const term = e * Math.sin((perihelion - lambdaDeg) * D2R) - Math.sin((sunLon - lambdaDeg) * D2R);
  return (-k * term) / (cosBeta === 0 ? 1e-12 : cosBeta);
}

/** 地心几何黄道坐标（当日分点，含光行时迭代）——行星。 */
function geocentricPlanetEcliptic(planetKey, jde) {
  const earth = vsop().earth.position(jde);
  const ex = earth.range * Math.cos(earth.lat) * Math.cos(earth.lon);
  const ey = earth.range * Math.cos(earth.lat) * Math.sin(earth.lon);
  const ez = earth.range * Math.sin(earth.lat);
  let pos;
  let tau = 0;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (let i = 0; i < 4; i += 1) {
    pos = vsop()[planetKey].position(jde - tau);
    dx = pos.range * Math.cos(pos.lat) * Math.cos(pos.lon) - ex;
    dy = pos.range * Math.cos(pos.lat) * Math.sin(pos.lon) - ey;
    dz = pos.range * Math.sin(pos.lat) - ez;
    tau = Math.hypot(dx, dy, dz) * LIGHT_TIME_DAYS_PER_AU;
  }
  return {
    lon: norm360(Math.atan2(dy, dx) * R2D),
    lat: Math.atan2(dz, Math.hypot(dx, dy)) * R2D,
    distanceAu: Math.hypot(dx, dy, dz),
  };
}

/** 地心几何黄道坐标 —— 冥王星（J2000 级数 → 岁差到当日分点）。 */
function geocentricPlutoEcliptic(jde) {
  const earth = vsop().earth.position2000(jde);
  const ex = earth.range * Math.cos(earth.lat) * Math.cos(earth.lon);
  const ey = earth.range * Math.cos(earth.lat) * Math.sin(earth.lon);
  const ez = earth.range * Math.sin(earth.lat);
  let pos;
  let tau = 0;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (let i = 0; i < 4; i += 1) {
    pos = plutoModule.heliocentric(jde - tau);
    dx = pos.range * Math.cos(pos.lat) * Math.cos(pos.lon) - ex;
    dy = pos.range * Math.cos(pos.lat) * Math.sin(pos.lon) - ey;
    dz = pos.range * Math.sin(pos.lat) - ez;
    tau = Math.hypot(dx, dy, dz) * LIGHT_TIME_DAYS_PER_AU;
  }
  const lonJ2000 = norm360(Math.atan2(dy, dx) * R2D);
  const latJ2000 = Math.atan2(dz, Math.hypot(dx, dy)) * R2D;
  const eclTo = precess.eclipticPosition(
    new coord.Ecliptic(lonJ2000 * D2R, latJ2000 * D2R),
    2000.0,
    base.JDEToJulianYear(jde),
  );
  return {
    lon: norm360(eclTo.lon * R2D),
    lat: eclTo.lat * R2D,
    distanceAu: Math.hypot(dx, dy, dz),
  };
}

/** 月球地心黄道坐标（当日分点；astronomia 返回弧度与 km）。 */
export function moonEcliptic(jde) {
  const m = moonposition.position(jde);
  return {
    lon: norm360(m.lon * R2D),
    lat: m.lat * R2D,
    distanceKm: m.range,
  };
}

/**
 * 各天体的**地心黄经**（度，真分点）。
 * 口径 = 几何地心位置（含光行时迭代）+ 交动 Δψ，**不含周年光行差**
 * —— 由探针 45/47 标定确认（见 `eclipticAberration` 上方注释）。
 * 月亮本就不做光行差（地心距离太近，光行差公式不适用）。
 */
export function apparentEclipticLongitude(body, jde) {
  if (body === 'Sun') {
    const earth = vsop().earth.position(jde);
    const lon0 = norm360(earth.lon * R2D + 180);
    return norm360(lon0 + nutation(jde).dpsi * R2D);
  }
  if (body === 'Moon') {
    return norm360(moonEcliptic(jde).lon + nutation(jde).dpsi * R2D);
  }
  if (body === 'Pluto') {
    const g = geocentricPlutoEcliptic(jde);
    return norm360(g.lon + nutation(jde).dpsi * R2D);
  }
  const planetKey = VSOP_KEY[body];
  if (!planetKey) throw new Error(`apparentEclipticLongitude: 未知天体 ${body}`);
  const g = geocentricPlanetEcliptic(planetKey, jde);
  return norm360(g.lon + nutation(jde).dpsi * R2D);
}

/** 各天体的视赤经赤纬（度）。口径同 `apparentEclipticLongitude`（几何 + 交动）。 */
export function apparentEquatorial(body, jde) {
  const eps = meanObliquity(jde) + nutation(jde).deps * R2D;
  if (body === 'Sun') {
    const earth = vsop().earth.position(jde);
    return eclipticToEquatorial(norm360(earth.lon * R2D + 180), 0, eps);
  }
  if (body === 'Moon') {
    const geo = moonEcliptic(jde);
    return eclipticToEquatorial(geo.lon, geo.lat, eps);
  }
  const geo = body === 'Pluto'
    ? geocentricPlutoEcliptic(jde)
    : geocentricPlanetEcliptic(VSOP_KEY[body], jde);
  return eclipticToEquatorial(geo.lon, geo.lat, eps);
}

/**
 * 黄经变化率（度/天），中心差分 ±0.5 天 —— 逆行判定的唯一口径。
 * 【探针实测】旧实现 13 样例 × 8 天体的 retrograde 字段与本函数符号 100% 一致。
 */
export function longitudeRate(body, jde, halfSpanDays = 0.5) {
  const before = apparentEclipticLongitude(body, jde - halfSpanDays);
  const after = apparentEclipticLongitude(body, jde + halfSpanDays);
  return norm180(after - before) / (2 * halfSpanDays);
}

/**
 * 真交点（瞬时月球轨道升交点）黄经（度），含交动。
 * 【探针实测】旧实现的 North Node 与「由月球密切轨道状态向量求黄道面交线」的
 *   结果在 10 个跨 1935–2024 样例上**逐位吻合（Δ < 0.5″）**；而 Meeus 的
 *   近似真交点公式（`moonposition.trueNode`）差到 9.9′、平均交点差到 87′。
 *   故本内核采用**密切交点**（cross product 法）。
 */
export function trueNodeLongitude(jde) {
  return norm360(osculatingNodeLongitude(jde) + nutation(jde).dpsi * R2D);
}

/** 月球密切轨道与黄道面的升交点黄经（度，当日分点，不含交动）。 */
export function osculatingNodeLongitude(jde, h = 1e-3) {
  const r = moonVectorKm(jde);
  const rNext = moonVectorKm(jde + h);
  const rPrev = moonVectorKm(jde - h);
  const v = [
    (rNext[0] - rPrev[0]) / (2 * h),
    (rNext[1] - rPrev[1]) / (2 * h),
    (rNext[2] - rPrev[2]) / (2 * h),
  ];
  // 轨道角动量 h = r × v；升交点方向 n = ẑ × h
  const hv = [
    r[1] * v[2] - r[2] * v[1],
    r[2] * v[0] - r[0] * v[2],
    r[0] * v[1] - r[1] * v[0],
  ];
  const nx = -hv[1];
  const ny = hv[0];
  return norm360(Math.atan2(ny, nx) * R2D);
}

/** 月球地心黄道直角坐标（km；当日分点）。 */
function moonVectorKm(jde) {
  const m = moonEcliptic(jde);
  const lon = m.lon * D2R;
  const lat = m.lat * D2R;
  return [
    m.distanceKm * Math.cos(lat) * Math.cos(lon),
    m.distanceKm * Math.cos(lat) * Math.sin(lon),
    m.distanceKm * Math.sin(lat),
  ];
}

/**
 * 莉莉丝（黑月）黄经（度）—— 本内核采用「月球平均远地点」。
 * ⚠️ 已知缺口：旧实现此字段为密切远地点，见 rules/astrology.js 的
 *    HYPOTHETICAL_POINTS.lilith 注释与节151 报告「未解决差异 #3」。
 */
export function meanApogeeLongitude(jde) {
  return norm360(moonposition.perigee(jde) * R2D + 180 + nutation(jde).dpsi * R2D);
}

/**
 * 月球密切轨道根数（km / km/s），用于诊断与测试锚点。
 * 注意 astronomia `moonposition.position` 的 `range` 单位是 **km**（不是 AU），
 * 且 `lon`/`lat` 是 **弧度**。二者都易错，本函数集中处理。
 */
export function moonOsculatingElements(jde) {
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const h = 1e-3;
  const r = moonVectorKm(jde);
  const rNext = moonVectorKm(jde + h);
  const rPrev = moonVectorKm(jde - h);
  const v = [
    (rNext[0] - rPrev[0]) / (2 * h * 86400),
    (rNext[1] - rPrev[1]) / (2 * h * 86400),
    (rNext[2] - rPrev[2]) / (2 * h * 86400),
  ];
  const rMag = Math.hypot(...r);
  const vMag = Math.hypot(...v);
  const hv = cross(r, v);
  const hMag = Math.hypot(...hv);
  const energy = (vMag * vMag) / 2 - MOON_MU_KM3_S2 / rMag;
  const a = -MOON_MU_KM3_S2 / (2 * energy);
  const p = (hMag * hMag) / MOON_MU_KM3_S2;
  const eccentricity = Math.sqrt(Math.max(0, 1 - p / a));
  return { rKm: rMag, vKmS: vMag, semiMajorAxisKm: a, eccentricity, distanceKm: rMag };
}

/**
 * 上升点黄经（度）。RAMC = 本地恒星时（度）。
 * 闭式给出两支（相差 180°）的解，必须按几何约束**选支**：
 *   上升点是从天顶（MC）起沿黄道**逆时针 90°–270°**（即 norm360(λ_ASC − λ_MC) ∈ (0,180)）
 *   的那一支 —— MC 与 ASC 之间跨第 10、11、12 宫，共三个宫。
 * 【探针实测】不选支时在高纬（64°–70°N）与部分中纬样例上会取到对宫，
 *   误差恰为 180°（实测 1920-08-08 拉普兰 67.5°N、1950-11-02 等）。
 */
export function ascendantLongitude(ramcDeg, latitudeDeg, epsDeg, midheavenDeg) {
  const ramc = ramcDeg * D2R;
  const phi = latitudeDeg * D2R;
  const eps = epsDeg * D2R;
  const candidate = norm360(
    Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * R2D,
  );
  if (midheavenDeg === undefined || midheavenDeg === null) return candidate;
  const away = norm360(candidate - midheavenDeg);
  return away > 0 && away < 180 ? candidate : norm360(candidate + 180);
}

/**
 * 天顶黄经（度）。取「赤经恰等于 RAMC」的那一支（否则出现对宫歧义）。
 * 实测：高纬与 MC 落在黄道下半部时（1960-02-29、2024-06-21 雷克雅未克），
 * 不判支会得到与旧实现相差 180° 的结果。
 */
export function midheavenLongitude(ramcDeg, epsDeg) {
  const ramc = ramcDeg * D2R;
  const eps = epsDeg * D2R;
  const candidate = norm360(Math.atan2(Math.tan(ramc), Math.cos(eps)) * R2D);
  const ra = eclipticToEquatorial(candidate, 0, epsDeg).ra;
  return Math.abs(norm180(ra - ramcDeg)) < 1 ? candidate : norm360(candidate + 180);
}

/**
 * Placidus 中间宫头（11 / 12 / 2 / 3）—— 牛顿迭代解
 *   RA(λ) = RAMC + base + AD(λ)/divisor,  AD(λ) = asin(tan φ · tan δ(λ))
 * 无解（|tan φ · tan δ| > 1 无法收敛）时返回 null，由上层切整宫制。
 */
export function placidusCuspLongitude(house, ramcDeg, latitudeDeg, epsDeg, cuspSpec) {
  const { base: offset, divisor } = cuspSpec;
  const phi = latitudeDeg * D2R;
  let lambda = norm360(ramcDeg + offset);
  for (let i = 0; i < 200; i += 1) {
    const eq = eclipticToEquatorial(lambda, 0, epsDeg);
    const raw = Math.tan(phi) * Math.tan(eq.dec * D2R);
    if (!Number.isFinite(raw) || Math.abs(raw) > 1) return null;
    const ascDiff = Math.asin(raw) * R2D;
    const target = norm360(ramcDeg + offset + ascDiff / divisor);
    const diff = norm180(target - eq.ra);
    const h = 1e-7;
    const eq2 = eclipticToEquatorial(norm360(lambda + h), 0, epsDeg);
    const slope = norm180(eq2.ra - eq.ra) / h;
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) return null;
    lambda = norm360(lambda + diff / slope);
    if (Math.abs(diff) < 1e-12) return lambda;
  }
  return null;
}

/** 整宫制宫头（极区回退）：以上升所在星座 0° 起，每宫 30°。 */
export function wholeSignCusps(ascendantDeg) {
  const start = Math.floor(norm360(ascendantDeg) / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => norm360(start + i * 30));
}
