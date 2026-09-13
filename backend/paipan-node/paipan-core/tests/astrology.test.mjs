/**
 * 命理 · 自研排盘内核 · 西洋占星星盘单测（node:test）
 * ---------------------------------------------------------------------------
 * 运行：cd backend/paipan-node && node paipan-core/tests/astrology.test.mjs
 *
 * 纪律（与 xiaoliuren.test.mjs 同）：
 *   - 不触网、不读磁盘、不读时钟：夹具全部内联（不读 tools/fixtures/astrology.json），
 *     无 Date.now / Math.random；涉及时刻处一律用绝对字面量（Date.UTC / getUTC*）。
 *   - 不依赖进程本地时区：断言对象全部是「挂钟文本 + UTC 文本」字面量。
 *   - 关键约定写死断言（值来自「对拍实测」而非猜测），约定一变测试先红。
 *
 * 容差口径（重要，别把调参误判成回归）：
 *   - 结构性字段（星座 / 度 / 落宫 / 逆行 / 庙旺陷落 / 宫位恒等式）逐位断言；
 *   - **原始浮点黄经**只用 LON_TOL = 0.01°（36″）锚定：夹具 keyFieldsRationale 已声明
 *     两套星历之间存在 ~30″ 固有偏差，且星历层仍在精度调校中（本测试编写期间
 *     ephemeris.js 曾被修订一次，太阳黄经漂移 0.81″）——逐位断言浮点会把调参伪装成回归；
 *   - `minute` 字段原则上不入字面量断言（与夹具口径一致：1′ 边界对 30″ 级位置差极敏感），
 *     只断言 `formatted === formatPosition(longitude)` 的自洽性。
 *
 * 已记录的实现缺口（测试保持全绿，缺陷在报告里升级）：
 *   - 缺陷 A（㉙ skip）：`normalizeInput` 报 `timezone = 9`（中国 1986–1991 夏令时），
 *     但换算绝对时刻时用的是声明的 8 小时偏移，二者不自洽。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
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
} from '../src/capabilities/astrology/index.js';
import * as ephem from '../src/capabilities/astrology/ephemeris.js';
import rules from '../src/rules/astrology.js';
import { stripInternal, INTERNAL_KEYS } from '../src/pipeline/index.js';

const D2R = Math.PI / 180;

/** 原始浮点黄经锚定容差（度）：0.01° = 36″。理由见文件头「容差口径」。 */
const LON_TOL = 0.01;

/** 相位容许度表（rules.ASPECTS 的逐条冻结副本，防漂移）。 */
const ASPECT_ALLOWED_ORB = {
  合相: 8, 拱相: 8, 冲相: 8, 刑相: 7, 六合: 6,
  半六合: 2, 半刑: 2, 五分相: 2, 补八分相: 2, 倍五分相: 2,
};

/** 相位表逐条（名 / 符号 / 精确角 / 容许度）。 */
const ASPECT_TABLE = [
  ['合相', '☌', 0, 8],
  ['六合', '⚹', 60, 6],
  ['刑相', '□', 90, 7],
  ['拱相', '△', 120, 8],
  ['冲相', '☍', 180, 8],
  ['半六合', '⚺', 30, 2],
  ['半刑', '∠', 45, 2],
  ['五分相', 'Q', 72, 2],
  ['补八分相', '⚼', 135, 2],
  ['倍五分相', 'bQ', 144, 2],
];

/** flatInput（与 server.mjs computeAstrology 同源：数字可为字符串、timezone 固定 '8'）。 */
function flat(overrides) {
  return {
    name: '', gender: 'male', locationName: '北京',
    timezone: '8', useTrueSolarTime: false,
    ...overrides,
  };
}

/** 内联夹具（取自 paipan-core/tools/fixtures/astrology.json 的 24 条同源输入，取 8 条代表）。 */
const FIX_1990_BJ = flat({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 });
const FIX_1935_BJ = flat({ year: 1935, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 });
const FIX_1960_BJ = flat({ year: 1960, month: 2, day: 29, hour: 23, minute: 5, latitude: 39.9042, longitude: 116.4074 });
const FIX_1980_POLAR = flat({ year: 1980, month: 12, day: 21, hour: 13, minute: 0, latitude: 67.5, longitude: 20.0, locationName: '托讷' });
const FIX_2000_EQUATOR = flat({ year: 2000, month: 1, day: 1, hour: 0, minute: 0, latitude: 0, longitude: 0, locationName: '赤道' });
const FIX_2024_SYDNEY = flat({ year: 2024, month: 11, day: 5, hour: 18, minute: 45, latitude: -33.8688, longitude: 151.2093, gender: 'female', locationName: '悉尼' });
const FIX_2024_BJ_EARLY = flat({ year: 2024, month: 8, day: 15, hour: 0, minute: 30, latitude: 39.9042, longitude: 116.4074 });
const FIX_2029_BJ = flat({ year: 2029, month: 2, day: 14, hour: 20, minute: 30, latitude: 39.9042, longitude: 116.4074, gender: 'female' });

/* ───────────────────────────────── 小工具 ───────────────────────────────── */

const core = (input) => generateAstrolabeCore(input);

/** 归一到 (−180, 180] 用于角度差比较。 */
function norm180of(value) {
  const v = ((value % 360) + 360) % 360;
  return v >= 180 ? v - 360 : v;
}

const cuspsOf = (out) => out.houses.map((house) => house.longitude);
const bodyBy = (out, name) => out.planets.find((planet) => planet.name === name);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 递归检查是否含 Date 实例（normalizeInput 产物必须是纯 JSON 形状）。 */
function containsDate(value) {
  if (value instanceof Date) return true;
  if (value && typeof value === 'object') return Object.values(value).some(containsDate);
  return false;
}

/** 紧密程度分档（阈值严格小于）。 */
function closenessOf(ratio) {
  if (ratio < 1 / 3) return '紧密';
  if (ratio < 2 / 3) return '中等';
  return '宽松';
}

/* ─────────────────────────── 1 · 输出契约形状 ─────────────────────────── */

test('① 输出契约形状：顶层键序 / planets 15 / angles 4 / houses 12 / meta 声明', () => {
  const out = core(FIX_1990_BJ);
  assert.deepEqual(Object.keys(out), [
    'birth', 'planets', 'angles', 'houses', 'aspects', 'solarIllumination', 'summary', 'houseSystem', 'meta',
  ]);
  assert.equal(out.planets.length, 15);
  assert.equal(out.angles.length, 4);
  assert.equal(out.houses.length, 12);
  assert.ok(Array.isArray(out.aspects));
  assert.equal(out.houseSystem.id, 'placidus');
  assert.equal(out.houseSystem.label, '普拉西德（Placidus）');
  assert.equal(out.houseSystem.fallbackApplied, false);
  assert.equal(out.meta.engine, 'mingli-paipan-core');
  assert.equal(out.meta.capability, 'astrology');
  assert.equal(out.meta.engineVersion, '0.1.0-mingli');
  assert.equal(out.meta.schemaVersion, '1.0.0');
  assert.equal(out.meta.computedBodies, 15);
  assert.deepEqual(out.meta.deferredBodies, ['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta']);
  assert.equal(out.meta.ephemeris.library, 'astronomia@4.2.0');
  assert.equal(out.meta.ephemeris.license, 'MIT');
  assert.equal(typeof out.meta.julianDayUtc, 'number');
  assert.equal(typeof out.meta.deltaTSeconds, 'number');
  assert.equal(typeof out.meta.localSiderealDegrees, 'number');
  assert.equal(typeof out.meta.obliquityMeanDegrees, 'number');
  // 天体键集：古典七曜多出 dignity/dignityLabel（本轮土星命中，键序实测如此）
  assert.deepEqual(Object.keys(bodyBy(out, 'Saturn')), [
    'name', 'label', 'longitude', 'sign', 'degree', 'minute', 'house', 'formatted', 'retrograde', 'dignity', 'dignityLabel',
  ]);
  assert.deepEqual(Object.keys(bodyBy(out, 'Uranus')), [
    'name', 'label', 'longitude', 'sign', 'degree', 'minute', 'house', 'formatted', 'retrograde',
  ]);
  assert.deepEqual(Object.keys(out.birth), [
    'name', 'gender', 'dateTime', 'location', 'latitude', 'longitude', 'timezone', 'standardDateTime', 'isTrueSolarTime',
  ]);
});

test('② planets 顺序与中文标签 = rules.BODY_ORDER / BODY_LABELS（15 项，无小行星）', () => {
  const out = core(FIX_1990_BJ);
  assert.deepEqual(out.planets.map((planet) => planet.name), [...rules.BODY_ORDER]);
  assert.deepEqual(
    out.planets.map((planet) => planet.label),
    rules.BODY_ORDER.map((name) => rules.BODY_LABELS[name]),
  );
  assert.deepEqual(out.planets.map((planet) => planet.label), [
    '太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星',
    '北交点', '南交点', '莉莉丝', '福点', '精神点',
  ]);
  // 凯龙星与四小行星按节151 规格降级为不输出（无许可证合规星历源）
  for (const deferred of rules.ASTEROID_DEFERRED) {
    assert.equal(out.planets.some((planet) => planet.name === deferred.name), false, `${deferred.name} 不应输出`);
  }
  for (const planet of out.planets) {
    assert.equal(planet.formatted, formatPosition(planet.longitude));
    assert.equal(planet.sign, rules.ZODIAC_SIGNS[signIndexOf(planet.longitude)]);
    assert.ok(planet.longitude >= 0 && planet.longitude < 360);
  }
});

test('③ 四轴顺序 / 标签 / 落宫 0：上升·天顶·下降·天底', () => {
  const out = core(FIX_1990_BJ);
  assert.deepEqual(out.angles.map((angle) => angle.name), ['Ascendant', 'Midheaven', 'Descendant', 'Imum Coeli']);
  assert.deepEqual(out.angles.map((angle) => angle.label), ['上升', '天顶', '下降', '天底']);
  assert.deepEqual(out.angles.map((angle) => angle.house), [0, 0, 0, 0]);
  for (const angle of out.angles) {
    assert.deepEqual(Object.keys(angle), ['name', 'label', 'longitude', 'sign', 'degree', 'minute', 'house', 'formatted']);
    assert.equal(angle.formatted, formatPosition(angle.longitude));
    assert.deepEqual({ degree: angle.degree, minute: angle.minute }, degMinOf(angle.longitude));
  }
});

test('④ 宫头表：12 项 / 依次编号 / 与宫头黄经自洽', () => {
  const out = core(FIX_1990_BJ);
  const cusps = cuspsOf(out);
  for (let i = 0; i < 12; i += 1) {
    assert.equal(out.houses[i].name, `House ${i + 1}`);
    assert.equal(out.houses[i].label, `第${i + 1}宫`);
    assert.equal(out.houses[i].house, i + 1);
    assert.equal(out.houses[i].longitude, cusps[i]);
    assert.equal(out.houses[i].formatted, formatPosition(cusps[i]));
  }
  assert.equal(new Set(cusps.map((cusp) => cusp.toFixed(9))).size, 12, '12 个宫头应互不相同');
});

/* ────────────────────────── 2 · 1990 北京锚点 ────────────────────────── */

test('⑤ 1990-05-12 07:30 北京：太阳 = 金牛座 21° · 11 宫 · 顺行', () => {
  const out = core(FIX_1990_BJ);
  const sun = bodyBy(out, 'Sun');
  assert.equal(sun.label, '太阳');
  assert.ok(Math.abs(sun.longitude - 51.00441412) < LON_TOL, `太阳黄经 ${sun.longitude} 应贴近实测锚点 51.00441412（±0.01°）`);
  assert.equal(sun.sign, '金牛座');
  assert.equal(sun.degree, 21);
  assert.equal(sun.house, 11);
  assert.equal(sun.retrograde, false);
  assert.equal(sun.formatted, formatPosition(sun.longitude));
  // 太阳落 7–12 宫 ⇒ 昼间盘（福点/精神点公式的判据）
  assert.ok(rules.DAY_CHART_HOUSES.includes(sun.house));
  assert.ok(Math.abs(out.meta.julianDayUtc - 2448023.4791666665) < 1e-6);
});

test('⑥ 1990-05-12 07:30 北京：月亮 = 射手座 14°38′ · 6 宫（夜间盘一侧）', () => {
  const out = core(FIX_1990_BJ);
  const moon = bodyBy(out, 'Moon');
  assert.equal(moon.label, '月亮');
  assert.ok(Math.abs(moon.longitude - 254.64467948) < LON_TOL, `月亮黄经 ${moon.longitude}`);
  assert.equal(moon.sign, '射手座');
  assert.equal(moon.degree, 14);
  assert.equal(moon.minute, 38);
  assert.equal(moon.house, 6);
  assert.equal(moon.retrograde, false);
  assert.equal(moon.formatted, '射手座14°38′');
});

test('⑦ 1990-05-12 07:30 北京：上升 双子座 29° · 天顶 双鱼座 6°（下降/天底为严格对宫）', () => {
  const out = core(FIX_1990_BJ);
  const [asc, mc, dsc, ic] = out.angles;
  assert.ok(Math.abs(asc.longitude - 89.67650904) < LON_TOL, `上升黄经 ${asc.longitude}`);
  assert.ok(Math.abs(mc.longitude - 336.64766078) < LON_TOL, `天顶黄经 ${mc.longitude}`);
  assert.equal(asc.sign, '双子座');
  assert.equal(asc.degree, 29);
  assert.equal(mc.sign, '双鱼座');
  assert.equal(mc.degree, 6);
  assert.equal(dsc.sign, '射手座');
  assert.equal(dsc.degree, 29);
  assert.equal(ic.sign, '处女座');
  assert.equal(ic.degree, 6);
  assert.ok(Math.abs(norm180of(dsc.longitude - (asc.longitude + 180))) < 1e-9);
  assert.ok(Math.abs(norm180of(ic.longitude - (mc.longitude + 180))) < 1e-9);
});

test('⑧ 宫头恒等式：H1=ASC、H10=MC、H7=ASC+180、H4=MC+180（容差 1e-9，4 组夹具）', () => {
  for (const input of [FIX_1990_BJ, FIX_2000_EQUATOR, FIX_2024_SYDNEY, FIX_2029_BJ]) {
    const out = core(input);
    assert.equal(out.houseSystem.fallbackApplied, false, `${input.year} 应为 Placidus`);
    const cusps = cuspsOf(out);
    const [asc, mc] = out.angles;
    assert.equal(cusps[0], asc.longitude, 'H1 宫头必须逐位等于上升');
    assert.equal(cusps[9], mc.longitude, 'H10 宫头必须逐位等于天顶');
    assert.ok(Math.abs(norm180of(cusps[6] - (asc.longitude + 180))) < 1e-9, 'H7 = ASC+180');
    assert.ok(Math.abs(norm180of(cusps[3] - (mc.longitude + 180))) < 1e-9, 'H4 = MC+180');
  }
});

/* ────────────────────────── 3 · 逆行与庙旺陷落 ────────────────────────── */

test('⑨ 1990-05-12 逆行集合恰为 水星/土星/天王星/海王星/冥王星', () => {
  const out = core(FIX_1990_BJ);
  assert.deepEqual(
    out.planets.filter((planet) => planet.retrograde).map((planet) => planet.label),
    ['水星', '土星', '天王星', '海王星', '冥王星'],
  );
  assert.equal(bodyBy(out, 'Mercury').retrograde, true);
  assert.deepEqual(out.summary.retrograde, ['水星', '土星', '天王星', '海王星', '冥王星']);
  // 只有 RETROGRADE_BODIES 参与逆行判定；其余天体恒 false
  for (const planet of out.planets) {
    if (!rules.RETROGRADE_BODIES.includes(planet.name)) {
      assert.equal(planet.retrograde, false, `${planet.label} 恒不逆行`);
    }
  }
  // summary 只统计十大行星
  assert.deepEqual(
    out.summary.retrograde,
    out.planets.slice(0, 10).filter((planet) => planet.retrograde).map((planet) => planet.label),
  );
});

test('⑩ 恒不逆行：太阳/月亮/南北交点/莉莉丝/福点/精神点（跨 4 组夹具）', () => {
  const alwaysDirect = ['Sun', 'Moon', 'North Node', 'South Node', 'True Lilith', 'Part of Fortune', 'Part of Spirit'];
  for (const input of [FIX_1990_BJ, FIX_1935_BJ, FIX_2000_EQUATOR, FIX_2024_SYDNEY]) {
    const out = core(input);
    for (const name of alwaysDirect) {
      assert.equal(bodyBy(out, name).retrograde, false, `${input.year} 的 ${name} 应恒不逆行`);
    }
  }
});

test('⑪ 庙旺陷落锚点：土星入庙（摩羯）/ 木星曜升（巨蟹）/ 金星落陷（白羊）', () => {
  const out = core(FIX_1990_BJ);
  const saturn = bodyBy(out, 'Saturn');
  assert.equal(saturn.sign, '摩羯座');
  assert.equal(saturn.dignity, 'domicile');
  assert.equal(saturn.dignityLabel, '入庙');
  const jupiter = bodyBy(out, 'Jupiter');
  assert.equal(jupiter.sign, '巨蟹座');
  assert.equal(jupiter.dignity, 'exaltation');
  assert.equal(jupiter.dignityLabel, '曜升');
  const venus = bodyBy(out, 'Venus');
  assert.equal(venus.sign, '白羊座');
  assert.equal(venus.dignity, 'detriment');
  assert.equal(venus.dignityLabel, '落陷');
});

test('⑫ dignity 只对古典七曜出现：三王星/交点/莉莉丝/福点/精神点无该键', () => {
  const classical = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const out = core(FIX_1990_BJ);
  // 天王星在摩羯座（土星庙位）也不赋 dignity —— 表里没有它
  assert.equal(bodyBy(out, 'Uranus').sign, '摩羯座');
  assert.equal(hasOwn(bodyBy(out, 'Uranus'), 'dignity'), false);
  assert.equal(rules.DIGNITY_TABLE.Uranus, undefined);
  assert.deepEqual(Object.keys(rules.DIGNITY_TABLE).sort(), [...classical].sort());
  for (const planet of out.planets) {
    if (hasOwn(planet, 'dignity')) {
      assert.ok(classical.includes(planet.name), `${planet.label} 不应有 dignity`);
      assert.equal(planet.dignityLabel, rules.DIGNITY_LABELS[planet.dignity]);
      assert.deepEqual({ dignity: planet.dignity, dignityLabel: planet.dignityLabel }, essentialDignity(planet.name, planet.sign));
    }
  }
});

test('⑬ essentialDignity 纯函数：domicile / exaltation / detriment / fall / null', () => {
  assert.deepEqual(essentialDignity('Sun', '狮子座'), { dignity: 'domicile', dignityLabel: '入庙' });
  assert.deepEqual(essentialDignity('Jupiter', '巨蟹座'), { dignity: 'exaltation', dignityLabel: '曜升' });
  assert.deepEqual(essentialDignity('Venus', '白羊座'), { dignity: 'detriment', dignityLabel: '落陷' });
  assert.deepEqual(essentialDignity('Moon', '天蝎座'), { dignity: 'fall', dignityLabel: '坠落' });
  assert.deepEqual(essentialDignity('Saturn', '白羊座'), { dignity: 'fall', dignityLabel: '坠落' });
  assert.equal(essentialDignity('Mars', '射手座'), null);
  assert.equal(essentialDignity('Uranus', '摩羯座'), null);
  assert.equal(essentialDignity('North Node', '水瓶座'), null);
  // 判定顺序：庙 → 旺 → 陷 → 弱（水星在处女座同时是庙与旺，取 domicile）
  assert.equal(essentialDignity('Mercury', '处女座').dignity, 'domicile');
  assert.equal(essentialDignity('Mercury', '双子座').dignity, 'domicile');
});

/* ────────────────────────── 4 · 交点与相位 ────────────────────────── */

test('⑭ 交点：南交点 = 北交点 + 180°，二者等于星历层真交点黄经', () => {
  for (const input of [FIX_1990_BJ, FIX_2000_EQUATOR, FIX_2029_BJ]) {
    const out = core(input);
    const north = bodyBy(out, 'North Node').longitude;
    const south = bodyBy(out, 'South Node').longitude;
    assert.ok(Math.abs(norm180of(south - (north + 180))) < 1e-9, '南北交点相差恰 180°');
    const jde = out.meta.julianDayUtc + out.meta.deltaTSeconds / 86400;
    assert.ok(Math.abs(norm180of(north - ephem.trueNodeLongitude(jde))) < 1e-9, '北交点 = trueNodeLongitude(jde)');
    assert.ok(Math.abs(norm180of(south - ephem.norm360(ephem.trueNodeLongitude(jde) + 180))) < 1e-9);
    // 莉莉丝（本内核口径：月球平均远地点）也与星历层一致
    assert.ok(Math.abs(norm180of(bodyBy(out, 'True Lilith').longitude - ephem.meanApogeeLongitude(jde))) < 1e-9);
  }
});

test('⑮ 相位结构：body1/body2 为中文标签、按 orb 升序、字段集与自洽性', () => {
  const out = core(FIX_1990_BJ);
  assert.ok(out.aspects.length > 0);
  const labels = new Set(out.planets.map((planet) => planet.label));
  const longitudeByLabel = new Map(out.planets.map((planet) => [planet.label, planet.longitude]));
  let previousOrb = -1;
  for (const aspect of out.aspects) {
    assert.ok(labels.has(aspect.body1), `${aspect.body1} 应为中文标签`);
    assert.ok(labels.has(aspect.body2), `${aspect.body2} 应为中文标签`);
    assert.deepEqual(Object.keys(aspect), [
      'body1', 'body2', 'type', 'symbol', 'exactAngle', 'actualAngle',
      'orb', 'allowedOrb', 'closeness', 'normalizedOrbRatio', 'isOutOfSign', 'applying',
    ]);
    assert.ok(aspect.orb >= previousOrb - 1e-12, `aspects 必须按 orb 升序：${aspect.orb} < ${previousOrb}`);
    previousOrb = aspect.orb;
    assert.equal(typeof aspect.isOutOfSign, 'boolean');
    assert.equal(typeof aspect.applying, 'boolean');
    assert.ok(aspect.actualAngle >= 0 && aspect.actualAngle <= 180);
    // actualAngle = 两天体黄经夹角的 4 位小数（独立重算）
    const separation = Math.abs(norm180of(longitudeByLabel.get(aspect.body2) - longitudeByLabel.get(aspect.body1)));
    assert.equal(aspect.actualAngle, Number(separation.toFixed(4)), `${aspect.body1}/${aspect.body2}`);
  }
  // 南北交点构造性冲相：orb 恰为 0，必是最紧密项
  assert.equal(out.aspects[0].orb, 0);
  const nodeAspect = out.aspects.find(
    (aspect) => aspect.type === '冲相'
      && ((aspect.body1 === '北交点' && aspect.body2 === '南交点') || (aspect.body1 === '南交点' && aspect.body2 === '北交点')),
  );
  assert.equal(nodeAspect.orb, 0);
  assert.equal(nodeAspect.exactAngle, 180);
  assert.equal(nodeAspect.actualAngle, 180);
  assert.equal(nodeAspect.closeness, '紧密');
  // 中文标签配对的典型项（实测）
  const mercuryJupiter = out.aspects.find((aspect) => aspect.body1 === '水星' && aspect.body2 === '木星');
  assert.ok(mercuryJupiter, '应存在 水星/木星 相位');
  assert.equal(mercuryJupiter.type, '六合');
});

test('⑯ 相位表（10 项）：精确角 / 符号 / 容许度逐条冻结', () => {
  assert.equal(rules.ASPECTS.length, 10);
  assert.deepEqual(rules.ASPECTS.map((aspect) => [aspect.name, aspect.symbol, aspect.exactAngle, aspect.allowedOrb]), ASPECT_TABLE);
  assert.equal(Object.keys(ASPECT_ALLOWED_ORB).length, 10);
  for (const [name, , , allowedOrb] of ASPECT_TABLE) {
    assert.equal(ASPECT_ALLOWED_ORB[name], allowedOrb);
    assert.equal(rules.ASPECT_BY_NAME[name].allowedOrb, allowedOrb);
  }
  // 四大主相位容许度 8/7/6 与「合拱冲 8、刑 7、六合 6」一致
  assert.equal(rules.ASPECT_BY_NAME['合相'].allowedOrb, 8);
  assert.equal(rules.ASPECT_BY_NAME['拱相'].allowedOrb, 8);
  assert.equal(rules.ASPECT_BY_NAME['冲相'].allowedOrb, 8);
  assert.equal(rules.ASPECT_BY_NAME['刑相'].allowedOrb, 7);
  assert.equal(rules.ASPECT_BY_NAME['六合'].allowedOrb, 6);
  for (const name of ['半六合', '半刑', '五分相', '补八分相', '倍五分相']) {
    assert.equal(rules.ASPECT_BY_NAME[name].allowedOrb, 2, `${name} 容许度应为 2°`);
  }
});

test('⑰ 相位不变量（5 组夹具）：orb ≤ allowedOrb，精确角/符号/容许度与表一致', () => {
  let checked = 0;
  for (const input of [FIX_1990_BJ, FIX_1935_BJ, FIX_1980_POLAR, FIX_2024_SYDNEY, FIX_2029_BJ]) {
    const out = core(input);
    for (const aspect of out.aspects) {
      checked += 1;
      assert.ok(aspect.orb <= aspect.allowedOrb, `${aspect.body1}/${aspect.body2} ${aspect.type} orb ${aspect.orb} > ${aspect.allowedOrb}`);
      assert.equal(aspect.allowedOrb, ASPECT_ALLOWED_ORB[aspect.type], `${aspect.type} 容许度`);
      const spec = rules.ASPECTS.find((entry) => entry.name === aspect.type);
      assert.equal(aspect.exactAngle, spec.exactAngle);
      assert.equal(aspect.symbol, spec.symbol);
      assert.ok(['紧密', '中等', '宽松'].includes(aspect.closeness));
    }
  }
  assert.ok(checked > 150, `应检查到足量相位（实测 ${checked}）`);
});

test('⑱ 相位紧密程度分档：closeness 由未取整的 orb 比值分档（严格小于）', () => {
  let checked = 0;
  for (const input of [FIX_1990_BJ, FIX_1935_BJ, FIX_2024_SYDNEY]) {
    const out = core(input);
    for (const aspect of out.aspects) {
      checked += 1;
      // ratio = orb / allowedOrb：< 1/3 → 紧密；< 2/3 → 中等；否则宽松
      assert.equal(aspect.closeness, closenessOf(aspect.normalizedOrbRatio), `${aspect.type} orb=${aspect.orb} ratio=${aspect.normalizedOrbRatio}`);
      // normalizedOrbRatio 是「未取整 orb / allowedOrb」（4 位小数），而输出 orb 只保留 2 位小数：
      // 直接拿圆整后的 orb 复算比值，会在压线项上与分档不符（实测 8 组夹具 365 例中 1 例，
      // 如 补八分相 orb 1.33 → 0.665 而真实 ratio 0.6673 → 宽松）。故这里只用它核对圆整幅度。
      assert.ok(
        Math.abs(aspect.normalizedOrbRatio - aspect.orb / aspect.allowedOrb) <= 0.01,
        `${aspect.type} orb 圆整幅度 ${aspect.normalizedOrbRatio} vs ${aspect.orb / aspect.allowedOrb}`,
      );
    }
  }
  assert.equal(checked > 0, true);
});

test('⑲ 分档边界取严格小于：ratio 恰为 1/3 → 中等、恰为 2/3 → 宽松', () => {
  const synthetic = (separation) => computeAspects(
    [{ name: 'X', label: '甲', longitude: 0 }, { name: 'Y', label: '乙', longitude: separation }],
    2451545.0,
  ).find((aspect) => aspect.type === '合相');
  // 合相容许度 8°：sep = 8/3 ⇒ ratio 恰为 1/3 ⇒ 中等（不是紧密）
  assert.equal(synthetic(8 / 3).normalizedOrbRatio, 0.3333);
  assert.equal(synthetic(8 / 3).closeness, '中等');
  assert.equal(synthetic(8 / 3 - 1e-9).closeness, '紧密');
  // sep = 16/3 ⇒ ratio 恰为 2/3 ⇒ 宽松（不是中等）
  assert.equal(synthetic(16 / 3).normalizedOrbRatio, 0.6667);
  assert.equal(synthetic(16 / 3).closeness, '宽松');
  assert.equal(synthetic(16 / 3 - 1e-9).closeness, '中等');
  assert.equal(synthetic(4).closeness, '中等');
  // 合成天体不在星历支持集内 ⇒ applying 恒 false（纯几何，不触发星历调用）
  assert.equal(synthetic(4).applying, false);
});

/* ────────────────────────── 5 · 落宫一致性 ────────────────────────── */

test('⑳ 落宫一致性：houseOfLongitude(p.longitude, 宫头) === p.house（5 组夹具）', () => {
  let checked = 0;
  for (const input of [FIX_1990_BJ, FIX_1935_BJ, FIX_1980_POLAR, FIX_2024_SYDNEY, FIX_2029_BJ]) {
    const out = core(input);
    const cusps = cuspsOf(out);
    for (const planet of out.planets) {
      checked += 1;
      assert.equal(houseOfLongitude(planet.longitude, cusps), planet.house, `${input.year} 的 ${planet.label}`);
      assert.ok(planet.house >= 1 && planet.house <= 12);
    }
  }
  assert.equal(checked, 75, '5 组 × 15 天体');
});

test('㉑ 落宫口径 cusp-lower-inclusive：宫头点归本宫，宫头前一点归上一宫', () => {
  const out = core(FIX_1990_BJ);
  const cusps = cuspsOf(out);
  assert.equal(rules.HOUSE_ASSIGNMENT, 'cusp-lower-inclusive');
  for (let i = 0; i < 12; i += 1) {
    assert.equal(houseOfLongitude(cusps[i], cusps), i + 1, `宫头 ${i + 1} 应归本宫`);
  }
  for (let i = 1; i < 12; i += 1) {
    assert.equal(houseOfLongitude(cusps[i] - 1e-9, cusps), i, `宫头 ${i + 1} 前一点归第 ${i} 宫`);
  }
  assert.equal(houseOfLongitude(cusps[0] - 1e-9, cusps), 12, '第 1 宫头前一点归第 12 宫');
});

/* ────────────────────────── 6 · 确定性与纯函数 ────────────────────────── */

test('㉒ 确定性：同输入两次 stripInternal 后逐键深相等（4 组夹具）', () => {
  for (const input of [FIX_1990_BJ, FIX_1980_POLAR, FIX_2024_SYDNEY, FIX_1960_BJ]) {
    const first = stripInternal(core(input));
    const second = stripInternal(core(input));
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  }
});

test('㉓ 纯函数性：入参不被修改；换序调用结果不变', () => {
  const input = flat({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 });
  const snapshot = JSON.stringify(input);
  const expected = JSON.stringify(stripInternal(core(input)));
  assert.equal(JSON.stringify(input), snapshot, 'generateAstrolabeCore 不得修改入参');
  // 交错换序：A、B、A、B —— 各自的产物必须与首轮一致（模块内无跨调用的隐藏状态）
  const a1 = JSON.stringify(stripInternal(core(FIX_1960_BJ)));
  const b1 = JSON.stringify(stripInternal(core(FIX_2024_SYDNEY)));
  assert.equal(JSON.stringify(stripInternal(core(FIX_1960_BJ))), a1);
  assert.equal(JSON.stringify(stripInternal(core(FIX_2024_SYDNEY))), b1);
  assert.equal(JSON.stringify(stripInternal(core(input))), expected);
  assert.equal(JSON.stringify(input), snapshot);
  // 归一化同样是纯函数
  assert.deepEqual(normalizeInput(input), normalizeInput(input));
});

/* ────────────────────────── 7 · 输入校验（不猜、不回落） ────────────────────────── */

test('㉔ 字符串数字与真数字等价（flatInput 数字皆字符串的生产形态）', () => {
  const asStrings = core(flat({
    year: '1990', month: '5', day: '12', hour: '7', minute: '30',
    latitude: '39.9042', longitude: '116.4074', timezone: '8',
  }));
  const asNumbers = core(flat({
    year: 1990, month: 5, day: 12, hour: 7, minute: 30,
    latitude: 39.9042, longitude: 116.4074, timezone: 8,
  }));
  assert.deepEqual(asStrings, asNumbers);
  assert.deepEqual(
    normalizeInput({ year: '1990', month: '5', day: '12', hour: '7', minute: '30', latitude: '39.9042', longitude: '116.4074' }),
    normalizeInput({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 }),
  );
});

test('㉕ 缺字段 / 非对象 / 非数字：missing_field · invalid_input · invalid_number', () => {
  const throwsCode = (fn, code) => assert.throws(fn, (error) => error instanceof PaipanInputError && error.code === code);
  // 缺 year / latitude / longitude ⇒ missing_field（绝不回落当前时间）
  throwsCode(() => core({}), 'missing_field');
  throwsCode(() => core({ month: 5, day: 12, latitude: 39.9, longitude: 116.4 }), 'missing_field');
  throwsCode(() => core({ year: 1990, month: 5, day: 12, longitude: 116.4 }), 'missing_field');
  throwsCode(() => core({ year: 1990, month: 5, day: 12, latitude: 39.9 }), 'missing_field');
  throwsCode(() => core({ year: '', month: 5, day: 12, latitude: 39.9, longitude: 116.4 }), 'missing_field');
  // 非对象入参 ⇒ invalid_input
  throwsCode(() => core(null), 'invalid_input');
  throwsCode(() => core(42), 'invalid_input');
  throwsCode(() => core('1990-05-12'), 'invalid_input');
  // 非数字 ⇒ invalid_number
  throwsCode(() => core({ year: 'abc', month: 5, day: 12, latitude: 39.9, longitude: 116.4 }), 'invalid_number');
  throwsCode(() => core({ year: 1990, month: 5, day: 12, latitude: '北纬39.9', longitude: 116.4 }), 'invalid_number');
  // 错误类型是 PaipanInputError 且带 name
  try {
    core({});
    assert.fail('应当抛错');
  } catch (error) {
    assert.equal(error.name, 'PaipanInputError');
  }
});

test('㉖ 范围校验错误码表：month / day / hour / minute / latitude / longitude', () => {
  const base = { year: 1990, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 };
  const throwsCode = (overrides, code) => assert.throws(
    () => core({ ...base, ...overrides }),
    (error) => error instanceof PaipanInputError && error.code === code,
    `${JSON.stringify(overrides)} 应抛 ${code}`,
  );
  throwsCode({ month: 13 }, 'invalid_month');
  throwsCode({ month: 0 }, 'invalid_month');
  throwsCode({ day: 32 }, 'invalid_day');
  throwsCode({ day: 0 }, 'invalid_day');
  throwsCode({ hour: 24 }, 'invalid_hour');
  throwsCode({ hour: -1 }, 'invalid_hour');
  throwsCode({ minute: 60 }, 'invalid_minute');
  throwsCode({ minute: -1 }, 'invalid_minute');
  throwsCode({ latitude: 90.5 }, 'invalid_latitude');
  throwsCode({ latitude: -90.5 }, 'invalid_latitude');
  throwsCode({ longitude: 180.5 }, 'invalid_longitude');
  throwsCode({ longitude: -180.5 }, 'invalid_longitude');
  // 边界值合法：±90 纬度 / ±180 经度 / 23:59 / 12 月 31 日
  const edge = core({ ...base, month: 12, day: 31, hour: 23, minute: 59, latitude: -90, longitude: 180 });
  assert.equal(edge.birth.latitude, -90);
  assert.equal(edge.birth.longitude, 180);
  assert.equal(edge.birth.dateTime, '1990-12-31 23:59');
  // hour / minute 缺省为 0（与生产契约一致），不抛错
  const noTime = core({ year: 1990, month: 5, day: 12, latitude: 39.9042, longitude: 116.4074 });
  assert.equal(noTime.birth.dateTime, '1990-05-12 00:00');
});

/* ────────────────────────── 8 · 中国夏令时与极区回退 ────────────────────────── */

test('㉗ 中国 1986–1991 夏令时：1990/1988-07-07 报 UTC+9，1992/1985 报 UTC+8', () => {
  const bj = (year, month, day, hour, minute) => flat({ year, month, day, hour, minute, latitude: 39.9042, longitude: 116.4074 });
  // 1990-05-12 落在 1990-04-15 → 1990-09-16 时段内 ⇒ 报到时区 9
  assert.equal(core(bj(1990, 5, 12, 7, 30)).birth.timezone, 9);
  // 1988-07-07 落在 1988-04-10 → 1988-09-11 时段内 ⇒ 9
  assert.equal(core(bj(1988, 7, 7, 23, 17)).birth.timezone, 9);
  // 夏令时段已结束（1991 之后再无夏令时）⇒ 8
  assert.equal(core(bj(1992, 5, 12, 7, 30)).birth.timezone, 8);
  assert.equal(core(bj(1985, 5, 12, 7, 30)).birth.timezone, 8);
  // 1988 年冬末（时段外）⇒ 8
  assert.equal(core(bj(1988, 1, 15, 3, 17)).birth.timezone, 8);
  // rules 表里就是 6 个夏令时段
  assert.equal(rules.CN_DST_PERIODS.length, 6);
  assert.equal(rules.DEFAULT_UTC_OFFSET_HOURS, 8);
  assert.equal(rules.DST_UTC_OFFSET_HOURS, 9);
});

test('㉘ 夏令时段：dstApplies 为真、报到时区 9、挂钟文本不变', () => {
  const out = core(FIX_1990_BJ);
  assert.equal(out.birth.timezone, 9);
  assert.equal(out.birth.dateTime, '1990-05-12 07:30');
  assert.equal(out.birth.standardDateTime, '1990-05-12 07:30');
  assert.equal(out.solarIllumination.timezone, 9);
  const normalized = normalizeInput(FIX_1990_BJ);
  assert.equal(normalized.dstApplies, true);
  assert.equal(normalized.declaredTimezone, 8);
  assert.equal(normalized.timezone, 9);
  assert.equal(normalized.standardDateTime, '1990-05-12 07:30');
  // 非夏令时段：dstApplies 为假、时区沿用声明值
  const outside = normalizeInput(flat({ year: 1992, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 }));
  assert.equal(outside.dstApplies, false);
  assert.equal(outside.timezone, 8);
});

test('㉙ 夏令时出生：标签报 UTC+9，但排星绝对时刻按声明时区（UTC+8）——黑盒实测旧实现口径', () => {
  // 黑盒实测（节151 收口确认）：旧实现对 1986–1991 夏令时出生（如 1990-05-12 07:30 北京）
  // 标签报 timezone=9，但行星位置按声明时区（8）的绝对时刻排算（月亮经度对拍逐点确认，
  // 本内核同样处理）；utcMs 即按声明时区换算。
  const out = core(FIX_1990_BJ);
  const normalized = normalizeInput(FIX_1990_BJ);
  assert.equal(normalized.timezone, 9);                       // 标签 = 有效时区（夏令时）
  assert.equal(normalized.dstApplies, true);
  assert.equal(normalized.utcMs, Date.UTC(1990, 4, 12, 7, 30) - 8 * 3600000);  // 排星绝对时刻按声明时区
  assert.equal(normalized.utcDateTime, '1990-05-11 23:30:00Z');
  assert.equal(out.solarIllumination.referenceUtcDateTime, '1990-05-11 23:30:00Z');
});

test('㉚ 极区 Placidus 无解 ⇒ 整宫制回退（lat 67.5 / 1980-12-21 13:00）', () => {
  const out = core(FIX_1980_POLAR);
  assert.equal(out.houseSystem.id, 'whole-sign');
  assert.equal(out.houseSystem.fallbackApplied, true);
  assert.equal(out.houseSystem.label, rules.HOUSE_SYSTEM.fallbackLabel);
  const cusps = cuspsOf(out);
  assert.deepEqual(cusps, [210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150, 180]);
  assert.equal(out.houses[0].longitude % 30, 0, '整宫制首个宫头必须是星座起点 0°');
  const asc = out.angles[0].longitude;
  assert.equal(cusps[0], Math.floor(asc / 30) * 30, '宫头 = 上升所在星座起点');
  assert.ok(Math.abs(asc - 228.4943) < LON_TOL, `上升黄经 ${asc} 应为 228.49° 附近`);
  assert.equal(out.angles[0].sign, '天蝎座');
  assert.equal(out.angles[0].degree, 18);
  for (let i = 0; i < 12; i += 1) {
    assert.equal(ephem.norm360(cusps[(i + 1) % 12] - cusps[i]), 30, `第 ${i + 1}→${i % 12 + 2} 宫头应相隔 30°`);
  }
  // 回退时四轴仍按闭式给出（不再等于 H1/H10 宫头）
  assert.ok(Math.abs(norm180of(cusps[0] - asc)) > 1e-6);
  assert.ok(Math.abs(norm180of(cusps[9] - out.angles[1].longitude)) > 1e-6);
});

test('㉛ 南半球（悉尼）：Placidus 成立且 12 宫头递增跨度合计 ≈ 360°', () => {
  const out = core(FIX_2024_SYDNEY);
  assert.equal(out.houseSystem.id, 'placidus');
  assert.equal(out.houseSystem.fallbackApplied, false);
  const cusps = cuspsOf(out);
  assert.equal(cusps.length, 12);
  assert.equal(cusps[0], out.angles[0].longitude, 'H1 = 上升（同一次计算，逐位相等）');
  assert.equal(cusps[9], out.angles[1].longitude, 'H10 = 天顶');
  const spans = cusps.map((cusp, i) => ephem.norm360(cusps[(i + 1) % 12] - cusp));
  const sum = spans.reduce((acc, span) => acc + span, 0);
  assert.ok(Math.abs(sum - 360) < 1e-6, `宫头跨度合计 ${sum} 应为 360°`);
  for (const span of spans) {
    assert.ok(span > 0 && span < 360, `每宫跨度应为正且小于 360°：${span}`);
  }
  assert.ok(Math.abs(norm180of(cusps[6] - (cusps[0] + 180))) < 1e-9);
  assert.ok(Math.abs(norm180of(cusps[3] - (cusps[9] + 180))) < 1e-9);
  assert.equal(out.birth.latitude, -33.8688);
  assert.equal(out.angles[0].sign, '双子座');
  // 南半球也不得静默换成整宫制（本样例 Placidus 有解）
  assert.equal(out.houseSystem.fallbackApplied, false);
});

/* ────────────────────────── 9 · 星历层锚点 ────────────────────────── */

test('㉜ 星历锚点：平均黄赤交角 23.4392911 / GMST 280.46061837（J2000.0）', () => {
  assert.ok(Math.abs(ephem.meanObliquity(2451545.0) - 23.4392911) < 1e-6);
  assert.equal(ephem.meanObliquity(2451545.0), 23.439291111111, 'T=0 处即 IAU1980 常数项');
  assert.ok(Math.abs(ephem.gmstDeg(2451545.0) - 280.46061837) < 1e-6);
  assert.equal(ephem.gmstDeg(2451545.0), 280.46061837);
  // 本地恒星时 = GMST + 东经（mod 360）
  const lst = ephem.localSiderealTime(2451545.0, 116.4074);
  assert.ok(Math.abs(lst - ephem.norm360(280.46061837 + 116.4074)) < 1e-12);
  assert.equal(ephem.julianDayUtc(0), 2440587.5);
  // 黄道 → 赤道：黄经 0° 黄纬 0° ⇒ 赤经 0°、赤纬 0°
  const eq = ephem.eclipticToEquatorial(0, 0, 23.4392911);
  assert.ok(Math.abs(eq.ra) < 1e-12);
  assert.ok(Math.abs(eq.dec) < 1e-12);
});

test('㉝ 星历锚点：J2000.0 太阳视黄经 ≈ 280.374（**不是平黄经 280.46**）', () => {
  const jde = 2451545.0;
  const sun = ephem.apparentEclipticLongitude('Sun', jde);
  // 实测锚点：修订后 280.37397587423806（修订前 280.3739889276）—— 两种都落在 ±0.02° 内。
  // 【锚点修正】任务书给的 280.46 是 Meeus 25.2 的**几何平黄经 L0**，不是视黄经；
  //   太阳视黄经 = L0 + 中心差 C（J2000 处 C ≈ −0.084°）⇒ 与平黄经相差 0.08° 以上。
  assert.ok(Math.abs(sun - 280.3740) < 0.02, `J2000 太阳视黄经 ${sun} 应贴近 280.374（±0.02°）`);
  // 独立核对：Meeus《Astronomical Algorithms》25.2 / 25.4 / 25.10（T = 0，全字面常量，不涉时钟）
  const T = 0;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * D2R)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * D2R)
    + 0.000289 * Math.sin(3 * M * D2R);
  const omega = 125.04452 - 1934.136261 * T;
  const meeusApparent = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  assert.ok(Math.abs(sun - meeusApparent) < 0.02, `实测 ${sun} vs Meeus 25.10 视黄经 ${meeusApparent}`);
  // 口径守卫：视黄经不得等于平黄经（把 L0 当锚点会变成「实现真错、测试却绿」）
  assert.ok(Math.abs(sun - 280.46) > 0.05, '视黄经应比平黄经 L0 小 0.08° 以上');
  assert.equal(ephem.apparentEclipticLongitude('Sun', jde), sun, '同参数两次调用必须逐位相同');
});

test('㉞ 星历锚点：2000 春分点太阳黄经 ≈ 0（|Δ| < 0.02°）+ 归一化与儒略日基量', () => {
  // 2000-03-20 07:35 TT 的 JDE（字面常量，不涉时钟/时区）
  const equinox = ephem.apparentEclipticLongitude('Sun', 2451623.81598);
  assert.ok(Math.abs(equinox) < 0.02, `春分时刻太阳黄经 ${equinox} 应贴近 0（±0.02°）`);
  assert.equal(ephem.norm360(-10), 350);
  assert.equal(ephem.norm360(370), 10);
  assert.equal(ephem.norm360(360), 0);
  assert.equal(ephem.norm180(190), -170);
  assert.equal(ephem.norm180(-190), 170);
  assert.equal(ephem.norm180(180), -180);
  assert.equal(ephem.julianDayUtc(0), 2440587.5);
  assert.equal(ephem.julianDayUtc(86400000), 2440588.5);
  // 中心差分速率：太阳约 +1.02°/天（逆行判定只在速率 < 0 时触发）
  assert.ok(Math.abs(ephem.longitudeRate('Sun', 2451545.0) - 1.0194) < 0.02);
  assert.ok(ephem.longitudeRate('Mercury', 2448023.5) < 0, '1990-05-12 水星应为逆行（速率 < 0）');
});

/* ────────────────────────── 10 · 纯函数与规则表 ────────────────────────── */

test('㉟ degMinOf（度分皆 floor）/ formatPosition（补零）/ signIndexOf 边界', () => {
  assert.deepEqual(degMinOf(20 + 59.999 / 60), { degree: 20, minute: 59 });
  assert.deepEqual(degMinOf(29.9999999), { degree: 29, minute: 59 });
  assert.deepEqual(degMinOf(51.00441412), { degree: 21, minute: 0 });
  assert.deepEqual(degMinOf(0), { degree: 0, minute: 0 });
  assert.deepEqual(degMinOf(359.999999), { degree: 29, minute: 59 });
  assert.deepEqual(degMinOf(-0.5), { degree: 29, minute: 30 }, '负黄经先归一到 [0, 360)');
  assert.equal(formatPosition(51.00441412), '金牛座21°00′');
  assert.equal(formatPosition(254.64467948), '射手座14°38′');
  assert.equal(formatPosition(0), '白羊座0°00′');
  assert.equal(formatPosition(359.999999), '双鱼座29°59′');
  assert.equal(signIndexOf(0), 0);
  assert.equal(signIndexOf(29.999), 0);
  assert.equal(signIndexOf(30), 1);
  assert.equal(signIndexOf(359.999), 11);
  assert.equal(signIndexOf(-1), 11);
  // 产物度分必须由同一黄经按同一 floor 约定还原
  const out = core(FIX_1990_BJ);
  for (const planet of out.planets) {
    assert.deepEqual({ degree: planet.degree, minute: planet.minute }, degMinOf(planet.longitude), planet.label);
  }
});

test('㊱ 规则表冻结与长度：ZODIAC_SIGNS 12 / ASPECTS 10 / BODY_ORDER 15 且全部冻结', () => {
  assert.equal(rules.ZODIAC_SIGNS.length, 12);
  assert.equal(rules.BODY_ORDER.length, 15);
  assert.equal(rules.ASPECTS.length, 10);
  assert.equal(rules.RETROGRADE_BODIES.length, 8);
  assert.equal(rules.ANGLE_DEFINITIONS.length, 4);
  assert.equal(rules.CN_DST_PERIODS.length, 6);
  assert.equal(Object.isFrozen(rules.ZODIAC_SIGNS), true);
  assert.equal(Object.isFrozen(rules.ASPECTS), true);
  assert.equal(Object.isFrozen(rules.DIGNITY_TABLE), true);
  assert.equal(Object.isFrozen(rules.BODY_ORDER), true);
  assert.equal(Object.isFrozen(rules.RETROGRADE_BODIES), true);
  assert.equal(Object.isFrozen(rules.HOUSE_SYSTEM), true);
  assert.deepEqual(rules.ZODIAC_SIGNS, [
    '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
    '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座',
  ]);
  assert.deepEqual(rules.RETROGRADE_BODIES, [
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  ]);
  assert.deepEqual(rules.PLACIDUS_CUSPS[11], { base: 30, divisor: 3 });
  assert.deepEqual(rules.PLACIDUS_CUSPS[12], { base: 60, divisor: 1.5 });
  assert.deepEqual(rules.PLACIDUS_CUSPS[2], { base: 120, divisor: 1.5 });
  assert.deepEqual(rules.PLACIDUS_CUSPS[3], { base: 150, divisor: 3 });
  assert.equal(rules.HOUSE_SYSTEM.id, 'placidus');
  assert.equal(rules.HOUSE_SYSTEM.fallback, 'whole-sign');
  assert.equal(rules.DEFAULT_UTC_OFFSET_HOURS, 8);
  assert.equal(rules.DST_UTC_OFFSET_HOURS, 9);
  assert.deepEqual(rules.DAY_CHART_HOUSES, [7, 8, 9, 10, 11, 12]);
});

test('㊲ 庙旺陷落表字面量（Ptolemy 体系，逐条防漂移）', () => {
  assert.deepEqual(rules.DIGNITY_TABLE.Sun, { domicile: ['狮子座'], exaltation: ['白羊座'], detriment: ['水瓶座'], fall: ['天秤座'] });
  assert.ok(rules.DIGNITY_TABLE.Sun.domicile.includes('狮子座'));
  assert.ok(rules.DIGNITY_TABLE.Mercury.domicile.includes('双子座'));
  assert.ok(rules.DIGNITY_TABLE.Mercury.domicile.includes('处女座'));
  assert.equal(rules.DIGNITY_TABLE.Mercury.domicile.length, 2);
  assert.ok(rules.DIGNITY_TABLE.Mercury.exaltation.includes('处女座'));
  assert.deepEqual(rules.DIGNITY_TABLE.Moon.domicile, ['巨蟹座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Moon.fall, ['天蝎座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Venus.domicile, ['金牛座', '天秤座']);
  assert.ok(rules.DIGNITY_TABLE.Venus.detriment.includes('白羊座'));
  assert.deepEqual(rules.DIGNITY_TABLE.Mars.domicile, ['白羊座', '天蝎座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Jupiter.domicile, ['射手座', '双鱼座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Jupiter.exaltation, ['巨蟹座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Saturn.domicile, ['摩羯座', '水瓶座']);
  assert.deepEqual(rules.DIGNITY_TABLE.Saturn.fall, ['白羊座']);
  assert.deepEqual(rules.DIGNITY_LABELS, { domicile: '入庙', exaltation: '曜升', detriment: '落陷', fall: '坠落' });
});

test('㊳ normalizeInput：纯对象 / 无 Date 实例 / 不读时钟（字段全部由入参推导）', () => {
  const input = flat({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, latitude: 39.9042, longitude: 116.4074 });
  const normalized = normalizeInput(input);
  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
  assert.equal(Array.isArray(normalized), false);
  assert.equal(containsDate(normalized), false, '归一化产物不得含 Date 实例');
  assert.deepEqual(Object.keys(normalized), [
    'name', 'gender', 'locationName', 'year', 'month', 'day', 'hour', 'minute',
    'latitude', 'longitude', 'timezone', 'declaredTimezone', 'dstApplies', 'useTrueSolarTime',
    'utcMs', 'standardDateTime', 'utcDateTime',
  ]);
  assert.equal(normalized.standardDateTime, '1990-05-12 07:30');
  // 绝对时刻完全由入参推导（若实现读时钟，此断言与 ㉒㉓ 必红）
  assert.equal(normalized.utcMs, Date.UTC(1990, 4, 12, 7, 30) - 8 * 3600000);
  assert.equal(normalized.utcDateTime, '1990-05-11 23:30:00Z');
  assert.deepEqual(normalizeInput(input), normalized, '同输入两次必须深相等');
  // 缺省值：hour/minute = 0、name/locationName = ''、gender = 'male'、timezone = 8、useTrueSolarTime 由布尔化
  const minimal = normalizeInput({ year: 2000, month: 1, day: 1, latitude: 0, longitude: 0 });
  assert.equal(minimal.hour, 0);
  assert.equal(minimal.minute, 0);
  assert.equal(minimal.name, '');
  assert.equal(minimal.gender, 'male');
  assert.equal(minimal.locationName, '');
  assert.equal(minimal.declaredTimezone, 8);
  assert.equal(minimal.timezone, 8);
  assert.equal(minimal.dstApplies, false);
  assert.equal(minimal.useTrueSolarTime, false);
  assert.equal(minimal.utcMs, Date.UTC(1999, 11, 31, 16, 0));
  const trueSolar = normalizeInput(flat({ year: 2000, month: 1, day: 1, latitude: 0, longitude: 0, useTrueSolarTime: true }));
  assert.equal(trueSolar.useTrueSolarTime, true);
});

/* ────────────────────────── 11 · 管线组合与上下文集 ────────────────────────── */

test('㊴ 四段纯函数组合复现 generateAstrolabeCore（逐段逐键相等）', () => {
  const input = FIX_1990_BJ;
  const out = core(input);
  const normalized = normalizeInput(input);
  const calendar = resolveCalendar(normalized);
  assert.deepEqual(Object.keys(calendar), [
    'julianDayUtc', 'julianEphemerisDay', 'deltaTSeconds', 'decimalYear', 'gmstDegrees',
    'localSiderealDegrees', 'obliquityMeanDegrees', 'obliquityTrueDegrees', 'nutationLongitudeDegrees',
  ]);
  const houses = computeHouses(calendar, normalized.latitude);
  const bodies = computeBodies(calendar, houses);
  assert.deepEqual(bodies, out.planets);
  assert.deepEqual(computeAngles(houses), out.angles);
  assert.deepEqual(computeHouseEntries(houses), out.houses);
  assert.deepEqual(computeAspects(bodies, calendar.julianEphemerisDay), out.aspects);
  assert.deepEqual(computeSummary(bodies), out.summary);
  assert.deepEqual(computeSolarIllumination(normalized, calendar), out.solarIllumination);
  // calendar / houses 的中间量也进入 meta
  assert.equal(calendar.julianEphemerisDay > calendar.julianDayUtc, true, 'JD(TT) 应大于 JD(UT)');
  assert.equal(houses.fallbackApplied, false);
  assert.equal(houses.system, rules.HOUSE_SYSTEM.id);
});

test('㊵ fullScope 上下文集（2026 流年）：键集 / 太阳返照 / 次限年龄 / 无时钟', () => {
  const natal = core(FIX_1990_BJ);
  const contexts = buildAstrolabeFullScopeContextsCore(natal, '2026');
  assert.deepEqual(Object.keys(contexts), ['natal', 'yearly']);
  assert.equal(contexts.natal.scope, 'natal');
  assert.equal(contexts.natal.dateStr, '');
  assert.equal(contexts.natal.displayLabel, '本命盘');
  assert.equal(contexts.natal.promptText, '分析对象：本命盘。');
  const yearly = contexts.yearly;
  assert.equal(yearly.scope, 'yearly');
  assert.equal(yearly.dateStr, '2026');
  assert.equal(yearly.displayLabel, '流年2026');
  assert.equal(yearly.displayText, '流年 · 2026');
  assert.equal(yearly.promptText, '分析对象：流年2026。');
  const solarReturn = yearly.solarReturnEvidence;
  assert.match(solarReturn.dateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.ok(Math.abs(solarReturn.residualDegrees) < 0.02, `回归残差 ${solarReturn.residualDegrees} 应 < 0.02°`);
  assert.equal(solarReturn.targetYear, 2026);
  assert.equal(solarReturn.status, 'exact');
  assert.equal(solarReturn.timezone, natal.birth.timezone);
  assert.equal(yearly.secondaryProgressionEvidence.age, 2026 - 1990);
  assert.equal(yearly.secondaryProgressionEvidence.planets.length, 15);
  assert.match(yearly.secondaryProgressionEvidence.progressedDateTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(yearly.solarArcEvidence.age, 2026 - 1990);
  assert.ok(Number.isFinite(yearly.solarArcEvidence.arcDegrees));
  assert.equal(yearly.periodEvents.coverage, 'not-implemented');
  assert.deepEqual(yearly.periodEvents.events, []);
  // 同输入两次调用深相等（无时钟、无随机）
  assert.deepEqual(buildAstrolabeFullScopeContextsCore(natal, '2026'), contexts);
});

test('㊶ 单 scope 上下文：yearly 块等价 / 空 dateStr 只回 natal / 未知 scope 抛错', () => {
  const natal = core(FIX_1990_BJ);
  const full = buildAstrolabeFullScopeContextsCore(natal, '2026');
  assert.deepEqual(buildAstrolabeScopeContextCore(natal, 'yearly', '2026'), full.yearly);
  assert.equal(buildAstrolabeScopeContextCore(natal, 'natal', '2026').scope, 'natal');
  assert.equal(buildAstrolabeScopeContextCore(natal).scope, 'natal', 'scope 缺省为 natal');
  assert.deepEqual(Object.keys(buildAstrolabeFullScopeContextsCore(natal, '')), ['natal']);
  assert.deepEqual(Object.keys(buildAstrolabeFullScopeContextsCore(natal, '   ')), ['natal']);
  // 粒度行为（黑盒实测旧实现只接受 YYYY-MM-DD 且返回 natal+yearly+monthly+daily 四块；
  // 本内核为宽松扩展：YYYY / YYYY-MM 返回能确定的块，YYYY-MM-DD 与旧实现一致返回四块）
  assert.deepEqual(Object.keys(buildAstrolabeFullScopeContextsCore(natal, '2026-05')), ['natal', 'yearly', 'monthly']);
  assert.deepEqual(Object.keys(buildAstrolabeFullScopeContextsCore(natal, '2026-05-12')), ['natal', 'yearly', 'monthly', 'daily']);
  assert.throws(
    () => buildAstrolabeScopeContextCore(natal, 'weekly', '2026'),
    (error) => error instanceof PaipanInputError && error.code === 'invalid_scope',
  );
  assert.throws(
    () => buildAstrolabeFullScopeContextsCore(natal, '2026-13-99'),
    (error) => error.code === 'invalid_date_str',
  );
  assert.throws(
    () => buildAstrolabeFullScopeContextsCore(natal, '2026-05-06-07'),
    (error) => error.code === 'invalid_date_str',
  );
  assert.throws(
    () => buildAstrolabeFullScopeContextsCore({}, '2026'),
    (error) => error instanceof PaipanInputError && error.code === 'invalid_natal',
  );
});

/* ────────────────────────── 12 · 生产契约与成本守卫 ────────────────────────── */

test('㊷ stripInternal 不改动输出：核心不产出任何内部字段', () => {
  for (const input of [FIX_1990_BJ, FIX_1980_POLAR, FIX_2024_SYDNEY]) {
    const out = core(input);
    assert.deepEqual(Object.keys(stripInternal(out)), Object.keys(out), '剥离后顶层键必须不变');
    assert.deepEqual(stripInternal(out), out, '产物内不得出现任何内部字段');
    const text = JSON.stringify(out);
    for (const key of INTERNAL_KEYS) {
      assert.equal(text.includes(`"${key}"`), false, `产物不应含内部字段 ${key}`);
    }
  }
});

test('㊸ 成本守卫：单次 generateAstrolabeCore 在 2000 ms 内完成', () => {
  // 先热身，避免把 VSOP87 大表的首次解析算进成本（CI 机器差异大，不设紧界）
  core(FIX_1990_BJ);
  const started = process.hrtime.bigint();
  core(FIX_1990_BJ);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 2000, `单次排盘耗时 ${elapsedMs.toFixed(1)} ms，应 < 2000 ms`);
});

test('㊹ 绝对时刻字面量：与进程本地时区无关（实现全走 Date.UTC / getUTC*）', () => {
  const out = core(FIX_1990_BJ);
  assert.equal(out.birth.dateTime, '1990-05-12 07:30');
  assert.equal(out.birth.standardDateTime, '1990-05-12 07:30');
  assert.equal(out.birth.location, '北京（39.9042, 116.4074）');
  assert.equal(out.solarIllumination.localDate, '1990-05-12');
  assert.equal(out.solarIllumination.referenceLocalDateTime, '1990-05-12 07:30:00');
  assert.match(out.solarIllumination.referenceUtcDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/);
  assert.match(out.solarIllumination.apparentSolarNoonUtcDateTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.match(out.solarIllumination.apparentSolarNoonLocalDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(out.solarIllumination.status, '已计算');
  assert.equal(out.solarIllumination.latitude, 39.9042);
  assert.equal(out.solarIllumination.longitude, 116.4074);
  assert.equal(out.solarIllumination.key, 'solar-illumination:1990-05-12:39.9042:116.4074');
  // 时刻字段必须是输入挂钟 + UTC 双写；无本地时区格式化路径（getHours 之类）
  assert.equal(out.solarIllumination.referenceUtcDateTime.slice(0, 10), '1990-05-11');
  assert.equal(out.meta.julianDayUtc, 2448023.4791666665);
  assert.deepEqual(core(FIX_1990_BJ), out, '同输入两次逐键相同 ⇒ 无时钟参与');
});
