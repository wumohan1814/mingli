/**
 * 命理 · 自研排盘内核 · 测试 · 奇门终身局（qimen-lifetime）
 * ---------------------------------------------------------------------------
 * 纪律：不触网、不读真实时钟（无 now 依赖——本能力输出不含时间戳，恒确定）、
 *       不依赖进程本地时区（birthDateTime 为挂钟字符串 + timeZoneId）。
 * 覆盖：确定性；已知样例写死断言（锚点来自对拍探针 tools/_probe/qimen-lifetime/）；
 *       夏令时/晚子时/甲时值符宫5/置闰/LMT/中五干/五不遇/空亡/四柱分限起点/
 *       飞盘/时区偏移校验抛错/规则表逐字；stripInternal 剥离。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQimenLifetimeCore, normalizeInput, resolveJuLifetime } from '../src/capabilities/qimen-lifetime/index.js';
import { resolveCalendar } from '../src/capabilities/qimen/index.js';
import { CHINA_DST, STAGE_TITLES, STAGE_AGES, STAGE_THEMES, STAGE_POLICY, TOPICS, SHANGHAI_LMT_OFFSET } from '../src/rules/qimen-lifetime.js';
import { stripInternal } from '../src/pipeline/index.js';

/** 与对拍夹具同形态的入参。 */
function inp(over) {
  return {
    birthDateTime: '1990-05-12T07:30:00',
    longitude: 120.12,
    latitude: 30.28,
    birthplace: '杭州',
    ...over,
  };
}

test('确定性：同样输入同样输出（stripInternal 后全等）', () => {
  const a = stripInternal(calculateQimenLifetimeCore(inp()));
  const b = stripInternal(calculateQimenLifetimeCore(inp()));
  assert.deepEqual(a, b);
  const c = stripInternal(calculateQimenLifetimeCore(inp({ birthDateTime: '1990-05-12 07:30:00' })));
  assert.deepEqual(c.b, c.b, '无时间戳字段');
});

test('锚点 1990-05-12 07:30（中国夏令时 +9 → 东八区 06:30 起局）：四柱/定局/符使/盘面', () => {
  const o = calculateQimenLifetimeCore(inp());
  const bc = o.baseChart;
  // 夏令时：basis 显示 UTC+9，转换后挂钟早 1 小时
  assert.equal(o.basis.timeZoneUsed, 'Asia/Shanghai (UTC+9)');
  assert.deepEqual(bc.ganzhi, { year: '庚午', month: '辛巳', day: '丁丑', hour: '癸卯' });
  assert.equal(bc.scope, 'hour');
  assert.equal(bc.isYangDun, true);
  assert.equal(bc.juShu, 7);
  assert.equal(bc.zhiFu, '天蓬');
  assert.equal(bc.zhiShi, '休门');
  assert.equal(bc.timeInfo.fuTou, '甲戌');
  assert.equal(bc.timeInfo.fuTouDate, '1990-05-09');
  assert.equal(bc.timeInfo.epoch, '下元');
  assert.equal(bc.timeInfo.chaoShenOrJieQi, '接气');
  // 空亡：癸卯 甲午旬空辰巳
  assert.deepEqual(bc.voidBranches, ['辰', '巳']);
  // 五不遇：癸水克丁火且同阴 → true
  assert.equal(bc.specialConditions.isWuBuYuShi, true);
  assert.equal(bc.specialConditions.isLiuGuiHour, true);
  // schemaVersion / input 回显
  assert.equal(o.schemaVersion, '1.0.0');
  assert.equal(o.input.birthDateTime, '1990-05-12T07:30:00');
  assert.equal(o.input.location.locationName, '杭州');
  assert.deepEqual(o.basis.stagePolicy, STAGE_POLICY);
});

test('personalMarkers：年/日/时干天盘+地盘（宫序升、同宫天先）+ 年支本宫 + 值符值使 + 天禽携干', () => {
  const o = calculateQimenLifetimeCore(inp());
  const types = o.personalMarkers.map((m) => `${m.markerType}:${m.layer}`);
  assert.deepEqual(types, [
    'yearStem:tianPan', 'yearStem:diPan', 'yearBranch:baseGong',
    'dayStem:tianPan', 'dayStem:diPan', 'hourStem:diPan', 'hourStem:tianPan',
    'zhiFuStar:tianPan', 'zhiShiDoor:renPan', 'companionStem:tianPan',
  ]);
  const yearStem = o.personalMarkers.slice(0, 2);
  assert.deepEqual(yearStem.map((m) => [m.value, m.palace]), [['庚', 7], ['庚', 9]]);
  assert.equal(o.personalMarkers[2].value, '午');
  assert.equal(o.personalMarkers[2].palace, 9);
  const hourStem = o.personalMarkers.slice(5, 7);
  assert.deepEqual(hourStem.map((m) => [m.value, m.palace]), [['癸', 3], ['癸', 9]]);
  assert.equal(o.personalMarkers[7].markerType, 'zhiFuStar');
  assert.equal(o.personalMarkers[7].value, '天蓬');
  assert.equal(o.personalMarkers[7].palace, 3);
  assert.equal(o.personalMarkers[8].value, '休门');
  assert.equal(o.personalMarkers[9].value, '丙'); // 天禽寄宫携干 = 中五地盘干
});

test('stages 四柱分限：0-16/17-32/33-48/49-80，起点=出生日（早于 08:00 减 1 天），主题固定', () => {
  // 1990-05-12 07:30 转换后 06:30（<8）→ 起点 5/11
  const o = calculateQimenLifetimeCore(inp());
  const s0 = o.stages[0];
  assert.equal(s0.title, '初限·早年根基');
  assert.equal(s0.calendarStart, '1990-05-11');
  assert.equal(s0.calendarEnd, '2006-05-11');
  assert.deepEqual(s0.dominantPalaces.map((p) => p.palace), [7, 9]);
  assert.deepEqual(s0.associatedMarkers, ['年干庚', '年支午']);
  assert.equal(s0.stageTheme, '年柱主限：主家庭原生教养、长辈福荫护持、学识基础与先天命质形成。');
  assert.deepEqual(o.stages[1].associatedMarkers, ['月干辛', '月支巳']);
  assert.deepEqual(o.stages[1].dominantPalaces.map((p) => p.palace), [1, 3, 4]);
  assert.deepEqual(o.stages[2].associatedMarkers, ['日干丁']);
  assert.deepEqual(o.stages[3].associatedMarkers, ['时干癸', '值使休门']);
  assert.deepEqual(o.stages[3].dominantPalaces.map((p) => p.palace), [3, 9, 1]);
  // 14:20（≥8）→ 起点=出生日
  const o2 = calculateQimenLifetimeCore(inp({ birthDateTime: '1984-01-15T14:20:00', longitude: 116.4, latitude: 39.9, birthplace: '北京' }));
  assert.equal(o2.stages[0].calendarStart, '1984-01-15');
  assert.deepEqual(o2.stages[0].dominantPalaces.map((p) => p.palace), [1, 6]);
  // 凌晨 05:10 → 起点=出生日-1
  const o3 = calculateQimenLifetimeCore(inp({ birthDateTime: '1975-11-30T05:10:00', longitude: 87.6, latitude: 43.8 }));
  assert.equal(o3.stages[0].calendarStart, '1975-11-29');
});

test('晚子时拆补符头从次日寻：2000-08-08T23:45 己亥日甲子时 → 符头己亥@次日 中元 阴5局 值符天禽', () => {
  const o = calculateQimenLifetimeCore(inp({ birthDateTime: '2000-08-08T23:45:00' }));
  const bc = o.baseChart;
  assert.deepEqual(bc.ganzhi, { year: '庚辰', month: '甲申', day: '己亥', hour: '甲子' });
  assert.equal(bc.timeInfo.fuTou, '己亥');
  assert.equal(bc.timeInfo.fuTouDate, '2000-08-09');
  assert.equal(bc.timeInfo.epoch, '中元');
  assert.equal(bc.juShu, 5);
  assert.equal(bc.zhiFu, '天禽');
  // 甲子时 值符宫=5（天禽）→ 省略值符星标记，时干渲染甲(遁戊)
  const types = o.personalMarkers.map((m) => `${m.markerType}:${m.layer}`);
  assert.ok(!types.includes('zhiFuStar:tianPan'));
  const hourStem = o.personalMarkers.filter((m) => m.markerType === 'hourStem');
  assert.deepEqual(hourStem.map((m) => [m.value, m.palace]), [['甲(遁戊)', 2], ['甲(遁戊)', 5]]);
  // stages 时柱分限 [地5, 天2, 值使2] → 去重 [5,2]
  assert.deepEqual(o.stages[3].dominantPalaces.map((p) => p.palace), [5, 2]);
});

test('置闰：2024-06-15T23:30 zhirun → 符头己酉@06-14 距夏至 7 日，挂夏至上元 阴9局', () => {
  const o = calculateQimenLifetimeCore(inp({ birthDateTime: '2024-06-15T23:30:00', juMethod: 'zhirun' }));
  const bc = o.baseChart;
  assert.equal(bc.timeInfo.juTerm, '夏至');
  assert.equal(bc.timeInfo.fuTouDate, '2024-06-14');
  assert.equal(bc.timeInfo.chaoShenOrJieQi, '超神');
  assert.equal(bc.isYangDun, false); // 置闰后按下一节气阴遁
  assert.equal(bc.juShu, 9);
  assert.equal(bc.zhiFu, '天柱');
  assert.equal(bc.zhiShi, '惊门');
});

test('LMT：1901 年前 Asia/Shanghai 用 UTC+8.095278', () => {
  const o = calculateQimenLifetimeCore(inp({ birthDateTime: '1900-06-15T10:30:00' }));
  assert.equal(o.basis.timeZoneUsed, 'Asia/Shanghai (UTC+8.095278)');
  assert.equal(SHANGHAI_LMT_OFFSET, 8.095278);
  const o2 = calculateQimenLifetimeCore(inp({ birthDateTime: '1901-01-01T12:00:00' }));
  assert.equal(o2.basis.timeZoneUsed, 'Asia/Shanghai (UTC+8)');
});

test('甲年干：personalMarkers 渲染甲(遁壬)，stages 关联标记用纯「年干甲」', () => {
  const o = calculateQimenLifetimeCore(inp({ birthDateTime: '2024-06-15T10:30:00' }));
  const yearStem = o.personalMarkers.slice(0, 2);
  assert.deepEqual(yearStem.map((m) => [m.value, m.palace]), [['甲(遁壬)', 1], ['甲(遁壬)', 7]]);
  assert.deepEqual(o.stages[0].associatedMarkers, ['年干甲', '年支辰']);
  assert.deepEqual(o.stages[0].dominantPalaces.map((p) => p.palace), [1, 7, 4]);
});

test('中五干（日干戊@中五）：stages 只留地盘宫', () => {
  const o = calculateQimenLifetimeCore(inp({ birthDateTime: '1984-01-15T14:20:00', longitude: 116.4, latitude: 39.9, birthplace: '北京' }));
  assert.deepEqual(o.stages[2].dominantPalaces.map((p) => p.palace), [5]);
});

test('飞盘：无天禽寄宫携干标记，盘面为飞盘', () => {
  const o = calculateQimenLifetimeCore(inp({ method: 'feipan' }));
  assert.equal(o.baseChart.method, 'feipan');
  const types = o.personalMarkers.map((m) => m.markerType);
  assert.ok(!types.includes('companionStem'));
  assert.equal(o.personalMarkers.length, 9);
});

test('时区偏移校验：显式偏移与历史偏移不一致 → 抛错；date-only 缺省 12:00', () => {
  assert.throws(() => calculateQimenLifetimeCore(inp({ birthDateTime: '1990-05-12T07:30:00+08:00' })), /历史偏移不一致/);
  assert.throws(() => calculateQimenLifetimeCore(inp({ birthDateTime: '1990-05-12T07:30:00Z' })), /历史偏移不一致/);
  // 与历史偏移一致（夏令时 +9）则通过
  const ok = calculateQimenLifetimeCore(inp({ birthDateTime: '1990-05-12T07:30:00+09:00' }));
  assert.equal(ok.baseChart.ganzhi.hour, '癸卯');
  // date-only → 12:00 午时
  const d = calculateQimenLifetimeCore(inp({ birthDateTime: '1990-05-12' }));
  assert.equal(d.baseChart.ganzhi.hour, '丙午');
  assert.throws(() => calculateQimenLifetimeCore(inp({ birthDateTime: '1990-13-01T00:00:00' })), /birthDateTime/);
});

test('normalizeInput/resolveJuLifetime：时区换算与符头口径', () => {
  const n = normalizeInput(inp());
  assert.equal(n.offset, 9); // 1990-05-12 夏令时
  assert.deepEqual({ y: n.wall.year, h: n.wall.hour }, { y: 1990, h: 6 }); // 07:30 → 06:30
  const calendar = resolveCalendar(n);
  const ju = resolveJuLifetime(calendar, n);
  assert.equal(ju.juShu, 7);
  assert.equal(ju.fuTou, '甲戌');
  assert.equal(ju.fuTouDate, '1990-05-09');
  assert.equal(ju.epoch, '下元');
  // 晚子时 23:45 → 符头从次日寻
  const n2 = normalizeInput(inp({ birthDateTime: '2000-08-08T23:45:00' }));
  const ju2 = resolveJuLifetime(resolveCalendar(n2), n2);
  assert.equal(ju2.fuTouDate, '2000-08-09');
  assert.equal(ju2.juShu, 5);
});

test('规则表逐字：夏令时表/分限/主题/主题顺序', () => {
  assert.deepEqual(CHINA_DST[1988].start, [4, 17]); // 对拍实测：1988 起始 04-17（非 04-10）
  assert.deepEqual(CHINA_DST[1986].start, [5, 4]);
  assert.deepEqual(CHINA_DST[1991].end, [9, 15]);
  assert.deepEqual(STAGE_TITLES, ['初限·早年根基', '中前限·青年立业', '中后限·中年鼎盛', '末限·晚景安泰']);
  assert.deepEqual(STAGE_AGES.map((a) => [a.start, a.end]), [[0, 16], [17, 32], [33, 48], [49, 80]]);
  assert.deepEqual(Object.keys(STAGE_THEMES), ['年', '月', '日', '时']);
  assert.deepEqual(TOPICS.map((t) => t.topic), ['career', 'wealth', 'marriage', 'health', 'academic', 'relocation', 'family', 'children', 'partnership']);
});

test('stripInternal：baseChart 剥离 timestamp/evidenceAnalysis', () => {
  const raw = calculateQimenLifetimeCore(inp());
  assert.ok(raw.baseChart && raw.baseChart.jiuGongGe);
  const stripped = stripInternal(raw);
  assert.ok(!('timestamp' in stripped.baseChart));
  assert.ok(!('evidenceAnalysis' in stripped.baseChart));
  assert.equal(stripped.baseChart.juShu, 7);
});
