/**
 * 命理 · 自研排盘内核 · 小六壬单测（node:test）
 * ---------------------------------------------------------------------------
 * 运行：cd backend/paipan-node && node paipan-core/tests/xiaoliuren.test.mjs
 *
 * 纪律：
 *   - 不触网、不读磁盘、不依赖 Date.now（凡涉及 meta.calculatedAt 处一律注入固定 now）。
 *   - 关键约定写死断言（值来自「对拍实测」而非猜测），约定一变测试先红。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateXiaoliurenCore,
  normalizeInput,
  computePalaces,
  ganZhiFromDay,
  PaipanInputError,
} from '../src/capabilities/xiaoliuren/index.js';
import { XIAOLIUREN_RULES, xiHourIndex, xiHourLabel } from '../src/rules/xiaoliuren.js';
import { stripInternal, getPath, extractKeyFields, stableStringify, fnv1aHash } from '../src/pipeline/index.js';
import { deepDiff, countConsistency } from '../tools/compare/diff.js';

/** 固定 now，保证测试完全确定性。 */
const FIXED_NOW = new Date('2020-01-01T00:00:00.000Z');

const run = (customDate) => generateXiaoliurenCore({ customDate, now: FIXED_NOW });

test('① 农历正月初一 子时 → 大安（1990-01-27 与 2000-02-05 两个正月初一）', () => {
  for (const iso of ['1990-01-27T00:30:00+08:00', '2000-02-05T00:30:00+08:00']) {
    const r = run(iso);
    assert.equal(r.lunarMonth, 1, `${iso} 应为农历正月`);
    assert.equal(r.lunarDay, 1, `${iso} 应为农历初一`);
    assert.equal(r.isLeapMonth, false);
    assert.equal(r.hourIndex, 0, `${iso} 应为早子时`);
    assert.equal(r.hourLabel, '早子时');
    // 三宫全落 0 → 大安
    assert.equal(r.calculation.monthPalaceIndex, 0);
    assert.equal(r.calculation.dayPalaceIndex, 0);
    assert.equal(r.calculation.hourPalaceIndex, 0);
    assert.equal(r.primary.name, '大安');
    assert.equal(r.primary.index, 0);
    assert.equal(r.sequence.hour.name, '大安');
  }
});

test('② 已知样例 1990-05-12T07:30+08:00：三宫 3/2/0、primary 大安（对拍实测写死）', () => {
  const r = run('1990-05-12T07:30:00+08:00');
  assert.equal(r.method, 'time');
  assert.equal(r.methodLabel, '时间起课');
  assert.equal(r.lunarMonth, 4);
  assert.equal(r.lunarDay, 18);
  assert.equal(r.isLeapMonth, false);
  assert.equal(r.hourIndex, 4);
  assert.equal(r.hourLabel, '辰时');
  assert.deepEqual(r.ganzhi, { year: '庚午', month: '辛巳', day: '丁丑', hour: '甲辰' });
  assert.equal(r.calculation.hourNumber, 5);
  assert.equal(r.calculation.monthSeed, 4);
  assert.equal(r.calculation.daySeed, 21);
  assert.equal(r.calculation.hourSeed, 25);
  assert.equal(r.calculation.monthPalaceIndex, 3);
  assert.equal(r.calculation.dayPalaceIndex, 2);
  assert.equal(r.calculation.hourPalaceIndex, 0);
  assert.equal(r.calculation.dayBoundary, '东八区民用日零点换日');
  assert.equal(r.calculation.leapMonthRule, '闰月沿用同名月序');
  assert.equal(r.sequence.month.name, '赤口');
  assert.equal(r.sequence.day.name, '速喜');
  assert.equal(r.sequence.hour.name, '大安');
  assert.equal(r.primary.name, '大安');
  assert.equal(r.primary.index, 0);
  assert.equal(r.palaceOrder.length, 6);
  assert.deepEqual(r.palaceOrder.map((p) => p.name), ['大安', '留连', '速喜', '赤口', '小吉', '空亡']);
  assert.deepEqual(r.palaceOrder.map((p) => p.index), [0, 1, 2, 3, 4, 5]);
});

test('③ 纯函数性：同输入两次结果一致；calculatedAt 之外逐键相同；产物无随机/时间痕迹', () => {
  const a = run('1990-05-12T07:30:00+08:00');
  const b = run('1990-05-12T07:30:00+08:00');
  assert.deepEqual(a, b, '注入固定 now 时两次运行必须深相等');

  const c = generateXiaoliurenCore({ customDate: '1990-05-12T07:30:00+08:00' });
  const d = generateXiaoliurenCore({ customDate: '1990-05-12T07:30:00+08:00' });
  const strip = (o) => {
    const copy = JSON.parse(JSON.stringify(o));
    delete copy.meta.calculatedAt;
    return copy;
  };
  assert.deepEqual(strip(c), strip(d), '不注入 now 时两次运行除 calculatedAt 外必须相同');

  assert.equal(typeof c.meta.calculatedAt, 'string');
  assert.match(c.meta.calculatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'calculatedAt 必须是 ISO 8601');
  assert.equal(c.meta.engineVersion, '0.1.0-mingli');
  assert.equal(c.meta.schemaVersion, '1.0.0');
  assert.equal(c.meta.algorithm, 'xiaoliuren');
  assert.match(c.meta.inputHash, /^[0-9a-f]{16}$/);
  assert.equal(c.meta.resultId, `xiaoliuren:${c.meta.inputHash}`);

  // 产物里不得出现随机/时间/提示词痕迹（内部字段一律不出现在生产契约形状里）
  const keys = JSON.stringify(c);
  for (const forbidden of ['Math.random', 'Date.now', 'evidenceAnalysis', 'calculationContext', 'positionSources', 'prompt', 'calculationChain', '"sources"', 'timestamp', '"random"', '"model"']) {
    assert.ok(!keys.includes(forbidden), `产物不应包含 ${forbidden}`);
  }
});

test('④ stripInternal 递归剔除内部字段（含嵌套与数组元素）', () => {
  const raw = {
    method: 'time',
    evidenceAnalysis: { sources: [{ title: 'x' }], calculationSteps: [{ prompt: 'y' }] },
    timestamp: 642468600000,
    sequence: { month: { name: '赤口', prompt: '内部' }, day: { name: '速喜' } },
    palaceOrder: [{ name: '大安', sources: ['a'] }, { name: '留连' }],
    prompt: '顶层提示词',
    calculationChain: [{ step: 1 }],
    calculationContext: { note: 'x' },
    positionSources: ['z'],
    sources: ['顶层来源'],
  };
  const out = stripInternal(raw);
  assert.deepEqual(Object.keys(out).sort(), ['method', 'palaceOrder', 'sequence']);
  assert.equal('evidenceAnalysis' in out, false);
  assert.equal('timestamp' in out, false);
  assert.equal('prompt' in out, false);
  assert.equal('calculationChain' in out, false);
  assert.equal('calculationContext' in out, false);
  assert.equal('positionSources' in out, false);
  assert.equal('sources' in out, false);
  assert.deepEqual(Object.keys(out.sequence.month), ['name']);
  assert.deepEqual(out.palaceOrder[0], { name: '大安' });
  // 不改入参
  assert.equal(raw.sequence.month.prompt, '内部');
  // 数组保持数组
  assert.ok(Array.isArray(out.palaceOrder));
});

test('⑤ getPath 支持点路径与数组下标', () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] }, primary: { name: '大安' } };
  assert.equal(getPath(obj, 'a.b[1].c'), 2);
  assert.equal(getPath(obj, 'a.b[0].c'), 1);
  assert.equal(getPath(obj, 'primary.name'), '大安');
  assert.equal(getPath(obj, 'a.b[9].c'), undefined);
  assert.equal(getPath(obj, 'nope.deep[0]'), undefined);
  assert.equal(getPath(obj, 'a.b'), obj.a.b);
  // 关键字段提取：取不到的键不产生 undefined 噪音
  assert.deepEqual(extractKeyFields(obj, ['primary.name', 'a.b[0].c', 'missing.path']), {
    'primary.name': '大安',
    'a.b[0].c': 1,
  });
});

test('⑥ 对拍实测约定：年干支 = 立春「精确时刻」换年（不是正月初一、不是立春整日界）', () => {
  // 1990-01-27 是正月初一但在立春（1990-02-04）之前：按正月初一换年会得「庚午」，实测为「己巳」
  assert.equal(run('1990-01-27T12:00:00+08:00').ganzhi.year, '己巳');
  // 2000 立春在 02-04 20:40：20:30 仍是「己卯」，20:41 已换「庚辰」（整日界口径在 20:30 就会给庚辰）
  assert.equal(run('2000-02-04T20:30:00+08:00').ganzhi.year, '己卯');
  assert.equal(run('2000-02-04T20:41:00+08:00').ganzhi.year, '庚辰');
  // 2000 正月初一（02-05）
  assert.equal(run('2000-02-05T12:00:00+08:00').ganzhi.year, '庚辰');
  // 2024 立春在 02-04 16:27
  assert.equal(run('2024-02-04T16:00:00+08:00').ganzhi.year, '癸卯');
  assert.equal(run('2024-02-04T16:30:00+08:00').ganzhi.year, '甲辰');
});

test('⑦ 对拍实测约定：月干支 = 节气精确时刻换月', () => {
  // 2000-02-04 立春 20:40 前仍属十二月（丁丑月），之后换戊寅月
  assert.equal(run('2000-02-04T12:00:00+08:00').ganzhi.month, '丁丑');
  assert.equal(run('2000-02-04T20:30:00+08:00').ganzhi.month, '丁丑');
  assert.equal(run('2000-02-04T20:41:00+08:00').ganzhi.month, '戊寅');
  assert.equal(run('1990-05-12T07:30:00+08:00').ganzhi.month, '辛巳');
});

test('⑧ 对拍实测约定：晚子时 23:00 起换日 / 早子时不换日 / lunarDay 不换日', () => {
  const late = run('1990-05-12T23:30:00+08:00');
  assert.equal(late.hourIndex, 12, '晚子时 hourIndex = 12');
  assert.equal(late.hourLabel, '晚子时');
  assert.equal(late.calculation.hourNumber, 1, '晚子时按「子=1」起课');
  assert.equal(late.lunarDay, 18, '晚子时不进农历日（民用日零点换日）');
  assert.equal(late.ganzhi.day, '戊寅', '日干支 23:00 起换到次日');
  assert.equal(late.ganzhi.hour, '壬子', '时干支按次日日干五鼠遁');
  assert.equal(late.calculation.dayPalaceIndex, 2);

  const before = run('1990-05-12T22:59:00+08:00');
  assert.equal(before.hourIndex, 11);
  assert.equal(before.hourLabel, '亥时');
  assert.equal(before.ganzhi.day, '丁丑', '22:59 仍是当日日干支');
  assert.equal(before.ganzhi.hour, '辛亥');

  const early = run('1986-07-01T00:20:00+08:00');
  assert.equal(early.hourIndex, 0);
  assert.equal(early.hourLabel, '早子时');
  assert.equal(early.ganzhi.day, '丙午');
  assert.equal(early.ganzhi.hour, '戊子');
  assert.equal(early.lunarDay, 25);

  // 跨日边界：23:59 与次日 00:00 的日干支相同（同为戊寅），但 lunarDay 进位
  const a = run('1990-05-12T23:59:00+08:00');
  const b = run('1990-05-13T00:00:00+08:00');
  assert.equal(a.ganzhi.day, b.ganzhi.day);
  assert.equal(a.lunarDay, 18);
  assert.equal(b.lunarDay, 19);
});

test('⑨ 时辰边界表（东八区民用挂钟）', () => {
  const table = [
    [0, 0], [0, 59, 0], [1, 0, 1], [2, 59, 1], [3, 0, 2], [5, 0, 3], [7, 0, 4], [7, 30, 4],
    [10, 59, 5], [11, 0, 6], [13, 0, 7], [15, 0, 8], [17, 0, 9], [19, 0, 10], [21, 0, 11],
    [22, 59, 11], [23, 0, 12], [23, 59, 12],
  ];
  for (const row of table) {
    const [hour, minute, expected] = row.length === 2 ? [row[0], 0, row[1]] : row;
    assert.equal(xiHourIndex(hour), expected, `${hour} 时的 hourIndex 应为 ${expected}`);
  }
  assert.equal(xiHourLabel(0), '早子时');
  assert.equal(xiHourLabel(4), '辰时');
  assert.equal(xiHourLabel(11), '亥时');
  assert.equal(xiHourLabel(12), '晚子时');
});

test('⑩ 五鼠遁（自实现）与农历库 getTimeInGanZhi 一致', () => {
  // 甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子是真途
  assert.equal(ganZhiFromDay('甲午', 12), '甲子');
  assert.equal(ganZhiFromDay('丁丑', 4), '甲辰');
  assert.equal(ganZhiFromDay('丙午', 0), '戊子');
  assert.equal(ganZhiFromDay('戊寅', 12), '壬子');
  assert.equal(ganZhiFromDay('庚辰', 6), '壬午');
  assert.throws(() => ganZhiFromDay('XX', 0), PaipanInputError);
});

test('⑪ 闰月：lunarMonth 取绝对月序、isLeapMonth 为真、月宫仍用同名月序', () => {
  const leap = run('2023-03-25T12:00:00+08:00');
  assert.equal(leap.lunarMonth, 2);
  assert.equal(leap.lunarDay, 4);
  assert.equal(leap.isLeapMonth, true);
  assert.equal(leap.calculation.monthPalaceIndex, 1, '(2-1) mod 6 = 1，闰月沿用同名月序');

  const leap4 = run('2020-05-25T12:00:00+08:00');
  assert.equal(leap4.lunarMonth, 4);
  assert.equal(leap4.isLeapMonth, true);
  assert.equal(leap4.calculation.monthPalaceIndex, 3);

  const normal = run('1990-05-12T07:30:00+08:00');
  assert.equal(normal.isLeapMonth, false);
});

test('⑫ 缺 customDate / 数字模式 / 非法日期 一律抛错，绝不回落「当前时间」', () => {
  assert.throws(() => generateXiaoliurenCore(), (e) => e instanceof PaipanInputError && e.code === 'missing_custom_date');
  assert.throws(() => generateXiaoliurenCore({}), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateXiaoliurenCore({ customDate: null }), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateXiaoliurenCore(null), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateXiaoliurenCore({ month: 6, day: 18, hour: 5 }), (e) => e.code === 'numeric_mode_unsupported');
  assert.throws(() => generateXiaoliurenCore({ month: 3, day: 15, hour: 7 }), (e) => e.code === 'numeric_mode_unsupported');
  assert.throws(() => generateXiaoliurenCore({ customDate: '不是日期' }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateXiaoliurenCore({ customDate: new Date('x') }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateXiaoliurenCore({ customDate: '1990-13-45T99:99:99+08:00' }), (e) => e.code === 'invalid_custom_date');
});

test('⑬ Date 与 ISO 字符串输入等价；无时区串按 +08:00 解释；结果与进程本地时区无关', () => {
  const iso = run('1990-05-12T07:30:00+08:00');
  const dateObj = run(new Date('1990-05-12T07:30:00+08:00'));
  const noTz = run('1990-05-12T07:30:00');
  const utcSame = run('1990-05-11T23:30:00Z');
  assert.deepEqual(stripInternal(dateObj), stripInternal(iso));
  assert.deepEqual(stripInternal(noTz), stripInternal(iso));
  assert.deepEqual(stripInternal(utcSame), stripInternal(iso));
  assert.equal(iso.meta.inputHash, dateObj.meta.inputHash, '同一时刻的不同输入形态应得同一 inputHash');
});

test('⑭ 输入归一化：hashInput 只有 capability/mode/wall 三键（now 不参与哈希）', () => {
  const norm = normalizeInput({ customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.deepEqual(Object.keys(norm.hashInput).sort(), ['capability', 'mode', 'wall']);
  assert.equal(norm.isoOffset8, '1990-05-12T07:30:00+08:00');
  assert.deepEqual(norm.wall, { year: 1990, month: 5, day: 12, hour: 7, minute: 30, second: 0 });
  const h1 = fnv1aHash(stableStringify(norm.hashInput));
  const h2 = fnv1aHash(stableStringify({ wall: norm.isoOffset8, mode: 'date', capability: 'xiaoliuren' }));
  assert.equal(h1, h2, '哈希与键序无关（stableStringify）');
  assert.match(h1, /^[0-9a-f]{8}$/);
});

test('⑮ 三宫推算纯函数：公式与 rules 表一致（独立重算）', () => {
  const cases = [
    { lunarMonth: 4, lunarDay: 18, hourIndex: 4 },
    { lunarMonth: 1, lunarDay: 1, hourIndex: 0 },
    { lunarMonth: 12, lunarDay: 30, hourIndex: 12 },
    { lunarMonth: 2, lunarDay: 12, hourIndex: 12 },
  ];
  for (const c of cases) {
    const p = computePalaces(c);
    const m = (c.lunarMonth - 1) % 6;
    const d = (m + c.lunarDay - 1) % 6;
    const n = (c.hourIndex % 12) + 1;
    const h = (d + n - 1) % 6;
    assert.equal(p.monthPalaceIndex, m);
    assert.equal(p.dayPalaceIndex, d);
    assert.equal(p.hourPalaceIndex, h);
    assert.equal(XIAOLIUREN_RULES.palaces[p.hourPalaceIndex].name, XIAOLIUREN_RULES.palaces[h].name);
  }
});

test('⑯ 单一权威规则源：palaceOrder / verse / dayBoundary 全部来自 XIAOLIUREN_RULES', () => {
  const r = run('1990-05-12T07:30:00+08:00');
  assert.deepEqual(r.palaceOrder, XIAOLIUREN_RULES.palaces.map((p) => ({ name: p.name, index: p.index, verse: p.verse })));
  for (let i = 0; i < 6; i += 1) {
    assert.equal(r.palaceOrder[i].verse, XIAOLIUREN_RULES.palaces[i].verse);
  }
  assert.equal(r.calculation.dayBoundary, XIAOLIUREN_RULES.dayBoundary);
  assert.equal(r.calculation.leapMonthRule, XIAOLIUREN_RULES.leapMonthRule);
  assert.equal(XIAOLIUREN_RULES.hourLabels.length, 12);
  // 掌诀歌逐字（公有领域俗传，逐字断言防漂移）
  assert.equal(XIAOLIUREN_RULES.palaces[0].verse, '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨，将军回田野，仔细更推详。');
  assert.equal(XIAOLIUREN_RULES.palaces[1].verse, '留连事难成，求谋日未明，官事凡宜缓，去者未回程，失物南方见，急讨方心称，更须防口舌，人口且平平。');
  assert.equal(XIAOLIUREN_RULES.palaces[2].verse, '速喜喜来临，求财向南行，失物申午未，逢人路上寻，官事有福德，病者无祸侵，田宅六畜吉，行人有信音。');
  assert.equal(XIAOLIUREN_RULES.palaces[3].verse, '赤口主口舌，官非切宜防，失物急去寻，行人有惊慌，六畜多作怪，病者出西方，更须防咀咒，恐怕染瘟皇。');
  assert.equal(XIAOLIUREN_RULES.palaces[4].verse, '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立便至，交关甚是强，凡事皆和合，病者叩穷苍。');
  assert.equal(XIAOLIUREN_RULES.palaces[5].verse, '空亡事不祥，阴人多乖张，求财无利益，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解保安康。');
});

test('⑰ 对拍框架自身：deepDiff / countConsistency 语义', () => {
  assert.deepEqual(deepDiff({ a: 1 }, { a: 1 }), []);
  const changed = deepDiff({ ganzhi: { year: '庚午' } }, { ganzhi: { year: '己巳' } });
  assert.equal(changed.length, 1);
  assert.equal(changed[0].path, 'ganzhi.year');
  assert.equal(changed[0].kind, 'changed');

  assert.equal(deepDiff({ a: 1 }, {}).find((d) => d.path === 'a').kind, 'missing');
  assert.equal(deepDiff({}, { a: 1 }).find((d) => d.path === 'a').kind, 'extra');
  assert.deepEqual(deepDiff({ x: 1, y: undefined }, { x: 1 }), [], 'undefined 值键视为不存在');

  const floatish = deepDiff({ v: 0.1 + 0.2 }, { v: 0.3 }, { floatTolerance: 1e-9 });
  assert.equal(floatish[0].kind, 'float-diff');
  assert.equal(deepDiff({ v: 0.1 + 0.2 }, { v: 0.3 })[0].kind, 'changed');

  const stat = countConsistency(deepDiff({ a: 1, b: 2 }, { b: 3 }));
  assert.equal(stat.total, 2);
  assert.equal(stat.byKind.missing, 1);
  assert.equal(stat.byKind.changed, 1);
  assert.equal(stat.consistent, false);
  assert.deepEqual(countConsistency([]), { total: 0, byKind: { missing: 0, extra: 0, changed: 0, 'float-diff': 0 }, consistent: true });
});
