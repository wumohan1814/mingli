/**
 * 命理 · 自研排盘内核 · 七政四余单测（节152）
 * ---------------------------------------------------------------------------
 * 覆盖：确定性（同输入同输出）、已知样例写死断言（1990-05-12 07:30 北京基准，
 * 期望值来自黑盒探针 p1/p2/p4/p14 实测旧实现输出）、纯函数性（不污染入参）、
 * 规则表逐字、命身宫/神煞/紫炁算式、宿界岁差移动、逆行、抛错路径。
 * 纪律：不触网、不读时钟、不依赖进程本地时区（输入全部东八区）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQizhengCore, PaipanInputError, normalizeInput, hourIndex0,
  mansionBoundaryLongitudes, xiuOf, ziqiLongitude, ziqiProgress, computeShensha,
} from '../src/capabilities/qizheng/index.js';
import { julianEphemerisDay } from '../src/capabilities/astrology/ephemeris.js';
import {
  MANSION_STARS, TWELVE_PALACE_NAMES, RULER_OF_SIGN, SHENSHA, ASPECTS,
  BRANCHES, STAR_ORDER, ZIQI_MODEL, DIGNITY_TABLE,
} from '../src/rules/qizheng.js';

/** 基准输入：1990-05-12 07:30 北京（与探针 p1 同一样本）。 */
const BASE = {
  name: '', gender: 'male', birthplace: '北京',
  year: 1990, month: 5, day: 12, hour: 7, minute: 30,
  longitude: 116.4074, latitude: 39.9042, true_solar: false,
};

/* ───────────────────────── 确定性 / 纯函数性 ───────────────────────── */

test('确定性：同输入两次输出逐位一致', () => {
  const a = JSON.stringify(generateQizhengCore(BASE));
  const b = JSON.stringify(generateQizhengCore(BASE));
  assert.equal(a, b);
});

test('纯函数性：不修改入参', () => {
  const input = { ...BASE, nested: { x: 1 } };
  const snapshot = JSON.stringify(input);
  generateQizhengCore(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('输入校验：缺字段抛 PaipanInputError', () => {
  assert.throws(() => generateQizhengCore({}), PaipanInputError);
  assert.throws(() => generateQizhengCore({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, longitude: 116.4 }), PaipanInputError);
  assert.throws(() => generateQizhengCore({ ...BASE, latitude: 99 }), PaipanInputError);
  assert.throws(() => generateQizhengCore({ ...BASE, month: 13 }), PaipanInputError);
  assert.throws(() => generateQizhengCore(null), PaipanInputError);
});

/* ───────────────────────── 已知样例（探针实测期望值） ───────────────────────── */

test('基准样本：命身宫/命主/十二宫/神煞（探针 p1/p2 实测值）', () => {
  const r = generateQizhengCore(BASE);
  assert.equal(r.mingGong, 0);
  assert.equal(r.shenGong, 3);
  assert.equal(r.mingZhu, '火');
  // 十二宫：命宫 signIndex=mingGong，其余逆时针递减
  assert.deepEqual(r.twelvePalaces.map((p) => p.signIndex), [0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(r.twelvePalaces.map((p) => p.signBranch), ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉']);
  assert.deepEqual(r.twelvePalaces.map((p) => p.palace), TWELVE_PALACE_NAMES);
  // 神煞（1990-05-12 日干丁、年支午）
  assert.deepEqual(r.shensha.map((s) => s.value), ['亥酉', '申', '亥', '卯', '戌', '申', '辰']);
});

test('基准样本：星曜结构字段（探针 p1 实测值）', () => {
  const r = generateQizhengCore(BASE);
  assert.equal(r.stars.length, 11);
  assert.deepEqual(r.stars.map((s) => s.name), STAR_ORDER);

  const sun = r.stars[0];
  assert.equal(sun.kind, '七政');
  assert.equal(sun.xiu, '胃');
  assert.equal(sun.sevenStar, '土');
  assert.equal(sun.signIndex, 1);
  assert.equal(sun.signBranch, '酉');
  assert.equal(sun.palace, '相貌');
  assert.equal(sun.dignity, '平');
  assert.equal(sun.retrograde, false);
  assert.ok(Math.abs(sun.xiuDegree - 4.195046060797154) < 0.01, `xiuDegree=${sun.xiuDegree}`);

  const moon = r.stars[1];
  assert.equal(moon.xiu, '心');
  assert.equal(moon.signIndex, 8);
  assert.equal(moon.palace, '男女');

  const mercury = r.stars[2];
  assert.equal(mercury.xiu, '娄');
  assert.equal(mercury.retrograde, true); // 1990-05 水星逆行（探针 p1）

  const saturn = r.stars[6];
  assert.equal(saturn.dignity, '庙/乐');
  assert.equal(saturn.retrograde, true); // 1990-05 土星逆行

  const jupiter = r.stars[5];
  assert.equal(jupiter.dignity, '旺/喜');
  assert.equal(jupiter.palace, '官禄');

  // 四余：罗睺/计都无 retrograde 键，月孛/紫炁恒 false
  const rahu = r.stars[7];
  assert.equal(rahu.kind, '四余');
  assert.equal(rahu.signIndex, 10);
  assert.equal(rahu.palace, '兄弟');
  assert.equal(rahu.dignity, '—');
  assert.ok(!('retrograde' in rahu));
  assert.equal(r.stars[8].signIndex, 4); // 计都 = 罗睺 + 180°
  assert.ok(!('retrograde' in r.stars[8]));
  const lilith = r.stars[9];
  assert.equal(lilith.signIndex, 7);
  assert.equal(lilith.palace, '奴仆');
  assert.equal(lilith.retrograde, false);
  const ziqiStar = r.stars[10];
  assert.equal(ziqiStar.signIndex, 5);
  assert.equal(ziqiStar.palace, '疾厄');
  assert.equal(ziqiStar.retrograde, false);
});

test('基准样本：紫炁均速模型（探针 p14 逐位期望值）', () => {
  const r = generateQizhengCore(BASE);
  assert.equal(r.ziqi.tropicalLongitude, 164.56079686161615);
  assert.equal(r.ziqi.dailyMotionDegrees, 360 / 10227.1792);
  assert.equal(r.ziqi.daysSinceZeroLongitude, 4674.979885551516);
  assert.equal(r.ziqi.daysUntilZeroLongitude, 5552.199314448484);
  assert.equal(r.ziqi.cycleProgress, 0.45711332461560045);
  assert.equal(r.ziqi.direction, '顺行');
  assert.equal(r.stars[10].tropicalLongitude, r.ziqi.tropicalLongitude);
});

test('基准样本：aspects 关键相位存在（探针 p1 实测集合）', () => {
  const r = generateQizhengCore(BASE);
  const set = new Set(r.aspects.map((a) => `${a.star1}|${a.star2}|${a.type}`));
  assert.ok(set.has('罗睺(火余)|计都(土余)|对照'), '罗睺-计都对照');
  assert.ok(set.has('辰星(水)|岁星(木)|六合'));
  assert.ok(set.has('太阳|月孛(水余)|对照'));
  assert.ok(set.has('太白(金)|岁星(木)|四正'));
  assert.ok(set.has('太阴|紫炁(木余)|四正'));
  // 顺序：按 orb 升序
  const orbs = r.aspects.map((a) => a.orb);
  assert.deepEqual(orbs, orbs.slice().sort((x, y) => x - y));
  // 类型/容许度合法性
  for (const a of r.aspects) {
    const def = ASPECTS.find((x) => x.name === a.type);
    assert.ok(def, `未知相位类型 ${a.type}`);
    assert.equal(a.allowedOrb, def.allowedOrb);
    assert.equal(a.exactAngle, def.exactAngle);
  }
});

/* ───────────────────────── 命身宫 / 神煞 算式 ───────────────────────── */

test('命宫/身宫公式：跨时辰/跨日/跨性别（探针 p2/p4 实测值）', () => {
  const cases = [
    // [输入, 期望 mingGong, 期望 shenGong, 期望 mingZhu]
    [{ ...BASE }, 0, 3, '火'],
    [{ ...BASE, hour: 0, minute: 30, gender: 'female' }, 4, 11, '日'], // 早子时
    [{ ...BASE, hour: 23, minute: 30 }, 4, 11, '日'], // 晚子时
    [{ ...BASE, day: 13 }, 0, 3, '火'],
    [{ year: 1980, month: 3, day: 10, hour: 12, minute: 0, longitude: 116.4074, latitude: 39.9042 }, 8, 5, '木'],
    [{ year: 2000, month: 6, day: 15, hour: 3, minute: 0, gender: 'female', longitude: 116.4074, latitude: 39.9042 }, 3, 1, '月'],
    [{ year: 2024, month: 2, day: 4, hour: 16, minute: 26, longitude: 116.4074, latitude: 39.9042 }, 5, 7, '水'],
    [{ year: 2029, month: 2, day: 14, hour: 20, minute: 30, gender: 'female', longitude: 116.4074, latitude: 39.9042 }, 3, 0, '月'],
    [{ year: 2005, month: 1, day: 20, hour: 11, minute: 25, gender: 'female', longitude: 151.2093, latitude: -33.8688 }, 7, 11, '火'],
  ];
  for (const [input, ming, shen, zhu] of cases) {
    const r = generateQizhengCore(input);
    assert.equal(r.mingGong, ming, `${JSON.stringify(input)} mingGong`);
    assert.equal(r.shenGong, shen, `${JSON.stringify(input)} shenGong`);
    assert.equal(r.mingZhu, zhu, `${JSON.stringify(input)} mingZhu`);
  }
});

test('命宫公式纯函数：mingGong = (太阳宫 + 3 − 时支序) mod 12', () => {
  // 直接构造太阳/太阴黄经的等价断言：用 1990 基准，改小时验证
  const at = (h, mi) => generateQizhengCore({ ...BASE, hour: h, minute: mi });
  const sunSi = at(0, 0).stars[0].signIndex;
  for (const [h, mi] of [[0, 30], [7, 30], [12, 0], [18, 30], [23, 30]]) {
    const r = at(h, mi);
    const h0 = hourIndex0(h);
    assert.equal(r.mingGong, (sunSi + 3 - h0 + 12) % 12, `hour ${h}`);
  }
});

test('神煞：天乙贵人随日干（晚子时换日）、其余随年支（立春精确换年）', () => {
  // 1990-05-12 07:30 日干丁 → 亥酉；23:30 晚子时换日为戊 → 丑未
  assert.equal(generateQizhengCore(BASE).shensha[0].value, '亥酉');
  assert.equal(generateQizhengCore({ ...BASE, hour: 23, minute: 30 }).shensha[0].value, '丑未');
  assert.equal(generateQizhengCore({ ...BASE, hour: 0, minute: 30 }).shensha[0].value, '亥酉');
  // 2024-02-04 16:26 在立春(16:27)前 → 年支卯 → 驿马巳；次日 → 年支辰 → 驿马寅
  assert.equal(generateQizhengCore({ year: 2024, month: 2, day: 4, hour: 16, minute: 26, longitude: 116.4074, latitude: 39.9042 }).shensha[1].value, '巳');
  const nextDay = generateQizhengCore({ year: 2024, month: 2, day: 5, hour: 8, minute: 0, longitude: 116.4074, latitude: 39.9042 });
  assert.equal(nextDay.shensha[1].value, '寅');
  assert.equal(nextDay.shensha[2].value, '巳');
  assert.equal(nextDay.shensha[3].value, '酉');
  assert.equal(nextDay.shensha[4].value, '辰');
  assert.equal(nextDay.shensha[5].value, '巳');
  assert.equal(nextDay.shensha[6].value, '丑');
});

test('computeShensha 纯查表（规则表逐字）', () => {
  const s = computeShensha('丙申', '甲子');
  assert.deepEqual(s, [
    { name: '天乙贵人', value: '亥酉' },
    { name: '驿马', value: '寅' },
    { name: '劫煞', value: '巳' },
    { name: '咸池', value: '酉' },
    { name: '华盖', value: '辰' },
    { name: '孤辰', value: '寅' },
    { name: '寡宿', value: '戌' },
  ]);
});

test('真太阳时开关被忽略（探针 p10：开/关输出逐位一致）', () => {
  const off = generateQizhengCore(BASE);
  const on = generateQizhengCore({ ...BASE, true_solar: true });
  assert.equal(JSON.stringify(off), JSON.stringify(on));
});

/* ───────────────────────── 宿界 / 星历换算 ───────────────────────── */

test('宿界随岁差逐年移动（探针 p3：壁宿界 1905≈7.8332° → 2024≈9.4907°）', () => {
  const b1905 = mansionBoundaryLongitudes(2417007.0); // 约 1905-03-15
  const b1990 = mansionBoundaryLongitudes(2448023.5); // 约 1990-05-12
  const b2024 = mansionBoundaryLongitudes(2460349.5); // 约 2024-02-04
  assert.ok(Math.abs(b1905[0] - 7.8332) < 0.02, `壁1905=${b1905[0]}`);
  assert.ok(Math.abs(b1990[0] - 9.0248) < 0.005, `壁1990=${b1990[0]}`);
  assert.ok(Math.abs(b2024[0] - 9.4907) < 0.01, `壁2024=${b2024[0]}`);
  assert.ok(b2024[0] > b1905[0], '宿界应随年代正向移动（岁差）');
});

test('宿度换算：太阳 50.9987 → 胃宿（1990 基准）', () => {
  const r = generateQizhengCore(BASE);
  const sun = r.stars[0];
  assert.equal(sun.xiu, '胃');
  assert.ok(sun.xiuDegree > 4.1 && sun.xiuDegree < 4.3);
  // xiuDegree = 黄经 − 宿界起点（用内核同款 jde 的宿界，逐位核对）
  const jde = julianEphemerisDay(Date.UTC(1990, 4, 12, 7, 30, 0) - 8 * 3600000);
  const b = mansionBoundaryLongitudes(jde);
  const start = b[MANSION_STARS.findIndex((s) => s.mansion === '胃')];
  assert.ok(Math.abs(sun.tropicalLongitude - start - sun.xiuDegree) < 1e-12, 'xiuDegree 应为黄经−宿界起点');
});

/* ───────────────────────── 规则表逐字 ───────────────────────── */

test('规则表：二十八宿目录（28 项，序壁…室，宿曜禽星表）', () => {
  assert.equal(MANSION_STARS.length, 28);
  assert.equal(MANSION_STARS[0].mansion, '壁');
  assert.equal(MANSION_STARS[27].mansion, '室');
  const sevenStars = MANSION_STARS.map((s) => `${s.mansion}${s.sevenStar}`).join('');
  assert.equal(sevenStars, '壁水奎木娄金胃土昴日毕月觜火参水井木鬼金柳土星日张月翼火轸水角木亢金氐土房日心月尾火箕水斗木牛金女土虚日危月室火');
});

test('规则表：十二宫名/命主星/神煞口诀/相位表', () => {
  assert.deepEqual(TWELVE_PALACE_NAMES, ['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '妻妾', '疾厄', '迁移', '官禄', '福德', '相貌']);
  assert.deepEqual(RULER_OF_SIGN, ['火', '金', '水', '月', '日', '水', '金', '火', '木', '土', '土', '木']);
  assert.equal(SHENSHA.tianYi['甲'], '丑未');
  assert.equal(SHENSHA.tianYi['戊'], '丑未');
  assert.equal(SHENSHA.tianYi['丁'], '亥酉');
  assert.equal(SHENSHA.tianYi['壬'], '卯巳');
  assert.equal(SHENSHA.tianYi['辛'], '寅午');
  assert.equal(SHENSHA.tianYi['乙'], '子申');
  assert.equal(SHENSHA.yiMa['寅'], '申');
  assert.equal(SHENSHA.yiMa['子'], '寅');
  assert.equal(SHENSHA.guChen['午'], '申');
  assert.equal(SHENSHA.guaSu['午'], '辰');
  assert.deepEqual(ASPECTS.map((a) => [a.name, a.exactAngle, a.allowedOrb]), [
    ['同宫', 0, 8], ['六合', 60, 4], ['四正', 90, 6], ['三方', 120, 6], ['对照', 180, 8],
  ]);
});

test('规则表：庙旺乐喜表与探针实测格一致（抽验）', () => {
  const sign = (name, si) => {
    const g = ['miao', 'wang', 'le', 'xi'].filter((k) => DIGNITY_TABLE[name][k].includes(si));
    return g.length ? g.map((k) => ({ miao: '庙', wang: '旺', le: '乐', xi: '喜' })[k]).join('/') : '平';
  };
  // 探针 p4/p5/p6/p10 实测：日庙戌(0) 乐午(4) 旺巳(5) 喜寅(8)
  assert.equal(sign('太阳', 0), '庙');
  assert.equal(sign('太阳', 4), '乐');
  assert.equal(sign('太阳', 5), '旺');
  assert.equal(sign('太阳', 8), '喜');
  // 木：未(3)=旺/喜、寅(8)=乐、亥(11)=庙/旺/乐、卯(7)=平
  assert.equal(sign('岁星(木)', 3), '旺/喜');
  assert.equal(sign('岁星(木)', 8), '乐');
  assert.equal(sign('岁星(木)', 11), '庙/旺/乐');
  assert.equal(sign('岁星(木)', 7), '平');
  // 土：丑(9)=庙/乐、子(10)=乐、卯(7)=旺、午(4)=喜
  assert.equal(sign('镇星(土)', 9), '庙/乐');
  assert.equal(sign('镇星(土)', 10), '乐');
  assert.equal(sign('镇星(土)', 6), '旺');
  assert.equal(sign('镇星(土)', 4), '喜');
});

/* ───────────────────────── 辅助纯函数 ───────────────────────── */

test('hourIndex0：子时（早/晚）为 0，其余按时辰', () => {
  assert.equal(hourIndex0(0), 0);
  assert.equal(hourIndex0(1), 1);
  assert.equal(hourIndex0(7), 4);
  assert.equal(hourIndex0(12), 6);
  assert.equal(hourIndex0(23), 0);
});

test('ziqiLongitude/ziqiProgress 与探针 p14/p14b 期望值', () => {
  const utcMs = Date.UTC(1990, 4, 12, 7, 30, 0) - 8 * 3600000;
  assert.equal(ziqiLongitude(utcMs), 164.56079686161615);
  const p = ziqiProgress(utcMs);
  assert.equal(p.daysSinceZeroLongitude, 4674.979885551516);
  assert.equal(p.cycleProgress, 0.45711332461560045);
});

test('xiuOf：边界包含起始不含终止', () => {
  const boundaries = mansionBoundaryLongitudes(2448023.5);
  const b = (m) => boundaries[MANSION_STARS.findIndex((s) => s.mansion === m)];
  const wei = b('胃');
  assert.equal(xiuOf(wei, boundaries).xiu, '胃');
  assert.equal(xiuOf(wei, boundaries).xiuDegree, 0);
  const bi = b('壁');
  assert.equal(xiuOf(0.5, boundaries).xiu, '室'); // 0.5° < 壁起点 → 室（跨 360 包回）
  assert.equal(xiuOf(bi - 1e-9, boundaries).xiu, '室');
  assert.equal(xiuOf(bi, boundaries).xiu, '壁');
});

test('normalizeInput：默认值与东八区换算', () => {
  const n = normalizeInput({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, longitude: 116.4, latitude: 39.9 });
  assert.equal(n.hour, 7);
  assert.equal(n.gender, 'male');
  assert.equal(n.utcMs, Date.UTC(1990, 4, 12, 7, 30, 0) - 8 * 3600000);
  const n2 = normalizeInput({ year: 2000, month: 1, day: 1, longitude: 0, latitude: 0 });
  assert.equal(n2.hour, 0);
  assert.equal(n2.minute, 0);
});

test('ZIQI_MODEL 常量冻结', () => {
  assert.equal(ZIQI_MODEL.epochLongitudeDeg, 237.038993);
  assert.equal(ZIQI_MODEL.periodDays, 10227.1792);
  assert.equal(ZIQI_MODEL.epochUtcMs, Date.UTC(1995, 11, 31));
  assert.ok(Object.isFrozen(ZIQI_MODEL));
  assert.ok(Object.isFrozen(BRANCHES));
  assert.equal(BRANCHES.length, 12);
});
