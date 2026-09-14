/**
 * 命理 · 自研排盘内核 · 测试 · 皇极经世
 * ---------------------------------------------------------------------------
 * 纪律：不触网、不读真实时钟（now 注入）、不依赖进程本地时区（输入全带 +08:00）。
 * 覆盖：确定性、已知样例写死断言、边界（元/会/统卦/冬至换年/节气截断/立春精确/
 *       跨 0/远年）、纯函数性、抛错路径、规则表逐字、变爻/互错综合入校验。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshiCore,
  elapsedYears,
  yearGanZhi,
  mutualHexagram,
  oppositeHexagram,
  reversedHexagram,
  resolvePositions,
  resolveHexagramCascade,
  resolveHuangjiCalendar,
  PaipanInputError,
} from '../src/capabilities/huangji/index.js';
import {
  HUANGJI_YEAR_CYCLE,
  HUANGJI_SIXTY_TABLE,
  HUANGJI_HEXAGRAMS,
  HUANGJI_CONVERSION,
  huangjiChangeLine,
} from '../src/rules/huangji.js';
import { stripInternal } from '../src/pipeline/index.js';

const FIXED_NOW = new Date('2026-09-14T09:09:00+08:00');

test('确定性：同样输入同样输出（stripInternal 后全等）', () => {
  const a = calculateHuangjiJingshiCore({ year: 2026, now: FIXED_NOW });
  const b = calculateHuangjiJingshiCore({ year: 2026, now: FIXED_NOW });
  assert.deepEqual(stripInternal(a), stripInternal(b));
  const c = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  const d = calculateHuangjiJingshiCore({ date: new Date('1990-05-12T07:30:00+08:00'), now: FIXED_NOW });
  assert.deepEqual(stripInternal(c), stripInternal(d), 'ISO 字符串与 Date 同义');
});

test('年家 2026：元会运世坐标 + 进度 + 五级卦 写死断言', () => {
  const o = calculateHuangjiJingshiCore({ year: 2026, now: FIXED_NOW });
  assert.equal(o.input.mode, '通行公元年');
  assert.equal(o.input.year, 2026);
  assert.equal(o.input.elapsedYears, 69042);
  assert.equal(o.position.yuan.indexFromEpoch, 1);
  assert.equal(o.position.hui.indexInYuan, 7);
  assert.equal(o.position.yun.indexInYuan, 192);
  assert.equal(o.position.yun.indexInHui, 12);
  assert.equal(o.position.shi.indexInYuan, 2302);
  assert.equal(o.position.shi.indexInYun, 10);
  assert.equal(o.position.year.coordinate, 2026);
  assert.equal(o.position.year.indexInShi, 13);
  assert.equal(o.position.year.indexInYuan, 69043);
  assert.equal(o.progress.yuan.currentYearIndex, 69043);
  assert.equal(o.progress.shi.nextCycleStartYear, 2044);
  assert.deepEqual(o.conversion, HUANGJI_CONVERSION);
  assert.equal(o.forecast.hui.branch, '午');
  assert.equal(o.forecast.hexagrams.governing.hexagram.shortName, '大过');
  assert.equal(o.forecast.hexagrams.yun.hexagram.shortName, '姤');
  assert.equal(o.forecast.hexagrams.sixtyYear.hexagram.shortName, '鼎');
  assert.equal(o.forecast.hexagrams.decade.hexagram.shortName, '姤');
  assert.equal(o.forecast.hexagrams.annual.shortName, '同人');
  assert.equal(o.forecast.hexagrams.annual.ganzhi, '丙午');
  assert.equal(o.forecast.hexagrams.yun.changedLine, 6);
  assert.equal(o.forecast.hexagrams.sixtyYear.changedLine, 5);
  assert.equal(o.forecast.hexagrams.decade.changedLine, 5);
  assert.equal(o.forecast.relatedHexagrams.mutual.shortName, '姤');
  assert.equal(o.forecast.relatedHexagrams.opposite.shortName, '师');
  assert.equal(o.forecast.relatedHexagrams.reversed.shortName, '大有');
});

test('年家 1990：值年卦讼 + 六十年统卦鼎', () => {
  const o = calculateHuangjiJingshiCore({ year: 1990, now: FIXED_NOW });
  assert.equal(o.forecast.hexagrams.annual.shortName, '讼');
  assert.equal(o.forecast.hexagrams.annual.ganzhi, '庚午');
  assert.equal(o.forecast.hexagrams.sixtyYear.hexagram.shortName, '鼎');
  assert.equal(o.forecast.hexagrams.decade.hexagram.shortName, '大有');
  assert.equal(o.position.year.indexInShi, 7);
});

test('值年卦 60 序逐岁顺进（1984 鼎 → 2045 鼎）', () => {
  const names = [];
  for (let y = 1984; y <= 2045; y += 1) names.push(calculateHuangjiJingshiCore({ year: y, now: FIXED_NOW }).forecast.hexagrams.annual.shortName);
  assert.equal(names[0], '鼎');
  assert.equal(names[6], '讼');      // 1990
  assert.equal(names[42], '同人');   // 2026
  assert.equal(names[59], '大过');   // 2043
  assert.equal(names[60], '大过');   // 2044（新块首）
  assert.equal(names[61], '鼎');     // 2045
});

test('元边界：62583（元1末）→ 62584（元2初）', () => {
  const y1 = calculateHuangjiJingshiCore({ year: 62583, now: FIXED_NOW });
  const y2 = calculateHuangjiJingshiCore({ year: 62584, now: FIXED_NOW });
  assert.equal(y1.position.yuan.indexFromEpoch, 1);
  assert.equal(y1.position.yuan.endYear, 62583);
  assert.equal(y2.position.yuan.indexFromEpoch, 2);
  assert.equal(y2.position.yuan.startYear, 62584);
  assert.equal(y2.position.yuan.endYear, 192183);
  assert.equal(y2.progress.yuan.currentYearIndex, 1);
  assert.equal(y2.forecast.hexagrams.annual.shortName, '复');
});

test('跨 0 年前后：-1 与 1 的 elapsed 与干支', () => {
  const n1 = calculateHuangjiJingshiCore({ year: -1, now: FIXED_NOW });
  const p1 = calculateHuangjiJingshiCore({ year: 1, now: FIXED_NOW });
  assert.equal(n1.input.elapsedYears, 67016);
  assert.equal(p1.input.elapsedYears, 67017);
  assert.equal(n1.forecast.hexagrams.annual.ganzhi, '庚申');
  assert.equal(p1.forecast.hexagrams.annual.ganzhi, '辛酉');
  assert.equal(yearGanZhi(-1000), '辛巳');
  assert.equal(yearGanZhi(1984), '甲子');
});

test('上元起点 -67017：elapsed 0', () => {
  const o = calculateHuangjiJingshiCore({ year: -67017, now: FIXED_NOW });
  assert.equal(o.input.elapsedYears, 0);
  assert.equal(o.position.yuan.indexFromEpoch, 1);
  assert.equal(o.position.shi.indexInYuan, 1);
  assert.equal(o.forecast.hexagrams.annual.shortName, '复');
});

test('datetime：黄畿日历（1990-05-12 立夏）', () => {
  const o = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  const c = o.dateTimeForecast.calendar;
  assert.equal(c.forecastYear, 1990);
  assert.equal(c.activeSolarTerm, '立夏');
  assert.equal(c.actualDayInSolarTerm, 7);
  assert.equal(c.mappedDayInSolarTerm, 7);
  assert.equal(c.monthIndex, 5);
  assert.equal(c.monthBranch, '辰');
  assert.equal(c.dayOfMonth, 22);
  assert.equal(c.dayOfYear, 142);
  assert.equal(c.hourSegment, 2);
  assert.equal(c.hourRange, '04:00—08:00');
  assert.equal(o.dateTimeForecast.civilTime.dateTime, '1990-05-12 07:30');
  assert.equal(o.dateTimeForecast.hexagrams.monthJing.shortName, '姤');
  assert.equal(o.dateTimeForecast.hexagrams.monthJing.changedLine, 3);
  assert.equal(o.dateTimeForecast.hexagrams.xunWei.shortName, '讼');
  assert.equal(o.dateTimeForecast.hexagrams.daily.shortName, '艮');
  assert.equal(o.dateTimeForecast.hexagrams.daily.sequenceOffset, 21);
  assert.equal(o.dateTimeForecast.hexagrams.hourJing.shortName, '蛊');
  assert.equal(o.dateTimeForecast.hexagrams.hourJing.changedLine, 2);
});

test('datetime：冬至换年界（1990-12-22 00:30 前 / 12:00 后）', () => {
  const before = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-12-22T00:30:00+08:00', now: FIXED_NOW });
  const after = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-12-22T12:00:00+08:00', now: FIXED_NOW });
  assert.equal(before.dateTimeForecast.calendar.forecastYear, 1990);
  assert.equal(before.dateTimeForecast.calendar.activeSolarTerm, '大雪');
  assert.equal(before.dateTimeForecast.calendar.dayOfYear, 360);
  assert.equal(before.input.year, 1990);
  assert.equal(after.dateTimeForecast.calendar.forecastYear, 1991);
  assert.equal(after.dateTimeForecast.calendar.activeSolarTerm, '冬至');
  assert.equal(after.dateTimeForecast.calendar.dayOfYear, 1);
  assert.equal(after.input.year, 1991);
  assert.equal(after.forecast.hexagrams.annual.shortName, '困');
  assert.equal(after.forecast.hexagrams.annual.year, 1991);
});

test('datetime：节气超 15 日映射截断（谷雨 5/6 02:00）', () => {
  const o = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-06T02:00:00+08:00', now: FIXED_NOW });
  const c = o.dateTimeForecast.calendar;
  assert.equal(c.activeSolarTerm, '谷雨');
  assert.equal(c.actualDayInSolarTerm, 16);
  assert.equal(c.mappedDayInSolarTerm, 15);
  assert.equal(c.dayOfYear, 135);
  assert.equal(c.dayOfMonth, 15);
  const after = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-06T04:00:00+08:00', now: FIXED_NOW });
  assert.equal(after.dateTimeForecast.calendar.activeSolarTerm, '立夏');
  assert.equal(after.dateTimeForecast.calendar.dayOfYear, 136);
});

test('datetime：立春精确时刻（2000-02-04 20:30/20:41）', () => {
  const b = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '2000-02-04T20:30:00+08:00', now: FIXED_NOW });
  const a = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '2000-02-04T20:41:00+08:00', now: FIXED_NOW });
  assert.equal(b.dateTimeForecast.calendar.activeSolarTerm, '大寒');
  assert.equal(a.dateTimeForecast.calendar.activeSolarTerm, '立春');
  assert.equal(b.dateTimeForecast.calendar.dayOfYear, 45);
  assert.equal(a.dateTimeForecast.calendar.dayOfYear, 46);
  assert.equal(a.dateTimeForecast.calendar.monthIndex, 2);
  assert.equal(a.dateTimeForecast.calendar.dayOfMonth, 16);
});

test('纯函数性：无 IO/随机/内部字段（证据链与证据层均在剥离清单内）', () => {
  const o = calculateHuangjiJingshiCore({ year: 2024, now: FIXED_NOW });
  // 顶层 calculationChain/sources 为 server 投影兼容字段（与旧实现同层），剥离前读取；
  // 但绝不能出现 vendor 内部中间件字段
  for (const bad of ['calculationContext', 'positionSources', 'prompt', 'timestamp']) {
    assert.ok(!Object.keys(o).includes(bad), `不得输出内部字段 ${bad}`);
  }
  const stripped = stripInternal(o);
  for (const bad of ['evidenceAnalysis', 'calculationChain', 'sources']) {
    assert.ok(!(bad in stripped), `stripInternal 必须剥离 ${bad}`);
  }
});

test('证据层结构：evidenceAnalysis 含元会运世换算链/五级卦推导/古籍来源；dateTimeForecast 同法', () => {
  const o = calculateHuangjiJingshiCore({ year: 2026, now: FIXED_NOW });
  const ev = o.evidenceAnalysis;
  assert.ok(ev, '必须产出 evidenceAnalysis');
  assert.equal(ev.status, '已计算');
  assert.ok(Array.isArray(ev.calculationChain) && ev.calculationChain.length >= 7, '计算链为元会运世换算 + 五级卦推导');
  assert.ok(ev.calculationChain[0].includes('67017'), '首条为上元积年');
  assert.ok(ev.calculationChain.some((s) => s.includes('统卦')), '含统卦推导');
  assert.ok(ev.calculationChain.some((s) => s.includes('值年卦')), '含值年卦推导');
  assert.ok(Array.isArray(ev.sources) && ev.sources.some((s) => s.includes('皇极经世')), '含古籍来源');
  assert.ok(Array.isArray(ev.limitations) && ev.limitations.length > 0);
  assert.ok(Array.isArray(ev.primaryFacts) && ev.primaryFacts.length > 0);
  assert.ok(typeof ev.summaryFact.promptText === 'string' && ev.summaryFact.promptText.length > 0);
  // datetime 模式：dateTimeForecast.evidenceAnalysis 同法补链
  const d = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  const dev = d.dateTimeForecast.evidenceAnalysis;
  assert.ok(dev, 'dateTimeForecast 必须产出 evidenceAnalysis');
  assert.ok(Array.isArray(dev.calculationChain) && dev.calculationChain.some((s) => s.includes('月卦')), '黄畿月卦推导');
  assert.ok(Array.isArray(dev.calculationChain) && dev.calculationChain.some((s) => s.includes('日卦')), '黄畿日卦推导');
  assert.ok(Array.isArray(dev.sources) && dev.sources.length > 0);
  assert.ok(!('evidenceAnalysis' in stripInternal(d).dateTimeForecast), 'stripInternal 必须剥离 dateTimeForecast.evidenceAnalysis');
});

test('server 投影兼容：顶层 calculationChain/sources/limitations 非空且被 stripInternal 剥离（dateTimeForecast 内同）', () => {
  const o = calculateHuangjiJingshiCore({ year: 2026, now: FIXED_NOW });
  assert.ok(Array.isArray(o.calculationChain) && o.calculationChain.length >= 7, '顶层 calculationChain 非空');
  assert.deepEqual(o.calculationChain, o.evidenceAnalysis.calculationChain, '顶层链与证据层同源');
  assert.ok(Array.isArray(o.sources) && o.sources.length > 0, '顶层 sources 非空');
  assert.deepEqual(o.sources, o.evidenceAnalysis.sources, '顶层 sources 与证据层同源');
  assert.ok(Array.isArray(o.limitations) && o.limitations.length > 0, '顶层 limitations 非空');
  const stripped = stripInternal(o);
  assert.ok(!('calculationChain' in stripped), 'stripInternal 必须剥离顶层 calculationChain');
  assert.ok(!('sources' in stripped), 'stripInternal 必须剥离顶层 sources');
  // datetime 模式：dateTimeForecast 内顶层同法
  const d = calculateHuangjiJingshiCore({ mode: 'datetime', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.ok(Array.isArray(d.dateTimeForecast.calculationChain) && d.dateTimeForecast.calculationChain.length >= 6, 'dateTimeForecast.calculationChain 非空');
  assert.deepEqual(d.dateTimeForecast.calculationChain, d.dateTimeForecast.evidenceAnalysis.calculationChain);
  assert.ok(Array.isArray(d.dateTimeForecast.sources) && d.dateTimeForecast.sources.length > 0);
  const ds = stripInternal(d);
  assert.ok(!('calculationChain' in ds.dateTimeForecast), 'stripInternal 必须剥离 dateTimeForecast.calculationChain');
  assert.ok(!('sources' in ds.dateTimeForecast), 'stripInternal 必须剥离 dateTimeForecast.sources');
});

test('抛错路径', () => {
  assert.throws(() => calculateHuangjiJingshiCore({}), PaipanInputError);
  assert.throws(() => calculateHuangjiJingshiCore(null), PaipanInputError);
  assert.throws(() => calculateHuangjiJingshiCore({ year: 0 }), PaipanInputError);
  assert.throws(() => calculateHuangjiJingshiCore({ year: -67018 }), PaipanInputError);
  assert.throws(() => calculateHuangjiJingshiCore({ year: 1990.5 }), PaipanInputError);
  assert.throws(() => calculateHuangjiJingshiCore({ mode: 'datetime', customDate: 'bad' }), PaipanInputError);
});

test('单元：elapsed / 干支 / 变爻 / 互错综', () => {
  assert.equal(elapsedYears(2026), 69042);
  assert.equal(elapsedYears(-1), 67016);
  assert.equal(elapsedYears(-67017), 0);
  assert.equal(huangjiChangeLine('讼', 3), '姤');
  assert.equal(huangjiChangeLine('大过', 6), '姤');
  assert.equal(huangjiChangeLine('鼎', 5), '姤');
  assert.equal(mutualHexagram('讼'), '家人');
  assert.equal(mutualHexagram('同人'), '姤');
  assert.equal(oppositeHexagram('讼'), '明夷');
  assert.equal(oppositeHexagram('同人'), '师');
  assert.equal(reversedHexagram('讼'), '需');
  assert.equal(reversedHexagram('同人'), '大有');
  assert.equal(reversedHexagram('小过'), '小过');
  assert.equal(reversedHexagram('颐'), '颐');
});

test('规则表逐字：64 卦 / 60 值年序 / 六十卦表 / 换算常量', () => {
  assert.equal(HUANGJI_HEXAGRAMS.length, 64);
  assert.equal(HUANGJI_YEAR_CYCLE.length, 60);
  assert.equal(HUANGJI_YEAR_CYCLE[0], '鼎');
  assert.equal(HUANGJI_YEAR_CYCLE[28], '复');
  assert.equal(HUANGJI_YEAR_CYCLE[59], '大过');
  assert.equal(Object.keys(HUANGJI_SIXTY_TABLE).length, 64);
  assert.deepEqual(HUANGJI_SIXTY_TABLE['姤'], ['姤', '遁', '讼', '巽', '鼎', '大过']);
  assert.equal(HUANGJI_CONVERSION.yearsPerYuan, 129600);
  const ids = HUANGJI_HEXAGRAMS.map((h) => h.id);
  assert.deepEqual(ids, [...Array(64).keys()].map((i) => i + 1));
});

test('单元：resolvePositions / resolveHexagramCascade / resolveHuangjiCalendar', () => {
  const p = resolvePositions(69042);
  assert.equal(p.yunInYuan, 192);
  assert.equal(p.offsetShi, 12);
  const c = resolveHexagramCascade(69042);
  assert.equal(c.governing, '大过');
  assert.equal(c.yunHex, '姤');
  assert.equal(c.sixty, '鼎');
  assert.equal(c.decade, '姤');
  assert.equal(c.annual, '同人');
  const hc = resolveHuangjiCalendar({ year: 1990, month: 5, day: 12, hour: 7, minute: 30, second: 0 });
  assert.equal(hc.annualYear, 1990);
  assert.equal(hc.monthIndex, 5);
});
