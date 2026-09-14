/**
 * 命理 · 自研排盘内核 · 测试 · 太乙神数
 * ---------------------------------------------------------------------------
 * 纪律：不触网、不读真实时钟（now 注入）、不依赖进程本地时区（输入全带 +08:00）。
 * 覆盖：确定性、已知样例写死断言、边界（立春/晚子时/闰月/闰日/冬夏至/DST/
 *       entry=360/年份端点）、纯函数性、抛错路径、规则表逐字。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTaiyiCore,
  normalizeInput,
  resolveCalendar,
  evaluateBureau,
  hourGanZhi,
  julianDayNumber,
  PaipanInputError,
} from '../src/capabilities/taiyi/index.js';
import {
  TAIYI_SIXTEEN_GODS,
  TAIYI_YANG_TABLE,
  TAIYI_YIN_TABLE,
  TAIYI_START_JUMP_TABLE,
  TAIYI_COUNT_NATURES,
  TAIYI_PALACE_NUM,
  taiyiStarPos,
  taiyiWenYang,
  taiyiJiShenYear,
  taiyiStartJump,
  taiyiBureauRow,
} from '../src/rules/taiyi.js';
import { stripInternal } from '../src/pipeline/index.js';

const FIXED_NOW = new Date('2026-09-14T09:09:00+08:00');

test('确定性：同样输入同样输出（含 meta 之外全等）', () => {
  const a = generateTaiyiCore({ scope: 'year', year: 1990, now: FIXED_NOW });
  const b = generateTaiyiCore({ scope: 'year', year: 1990, now: FIXED_NOW });
  assert.deepEqual(stripInternal(a), stripInternal(b));
  const c = generateTaiyiCore({ scope: 'hour', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  const d = generateTaiyiCore({ scope: 'hour', customDate: new Date('1990-05-12T07:30:00+08:00'), now: FIXED_NOW });
  assert.deepEqual(stripInternal(c), stripInternal(d), 'ISO 字符串与 Date 同义');
});

test('年家 1990：积年/局数/四星/主客定算/和数/六将 写死断言', () => {
  const o = generateTaiyiCore({ scope: 'year', year: 1990, now: FIXED_NOW });
  assert.equal(o.scope, 'year');
  assert.equal(o.ganZhi, '庚午');
  assert.equal(o.accumulatedValue, 10155907);
  assert.equal(o.entryYears, 307);
  assert.equal(o.yuan, 5);
  assert.equal(o.ji, 6);
  assert.equal(o.yinYang, '阳遁');
  assert.equal(o.bureau, 19);
  assert.equal(o.taiyiPosition, '子');
  assert.equal(o.taiyiPalace, 8);
  assert.equal(o.taiyiGua, '坎');
  assert.equal(o.taiyiDir, '北');
  assert.equal(o.wenChangPosition, '申');
  assert.equal(o.shiJiPosition, '艮');
  assert.equal(o.jiShenPosition, '申');
  assert.equal(o.lordCount, 8);
  assert.equal(o.guestCount, 32);
  assert.equal(o.setCount, 14);
  assert.deepEqual(o.countNatures, { lord: '杂阳', guest: '次和', set: '上和' });
  assert.equal(o.lordGeneral, 8);
  assert.equal(o.lordAssistant, 4);
  assert.equal(o.guestGeneral, 2);
  assert.equal(o.setAssistant, 2);
  assert.ok(o.judgments.includes('囚：主大将与太乙同宫。'));
});

test('月家 1990-05：积月/月干支/月家计神', () => {
  const o = generateTaiyiCore({ scope: 'month', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.equal(o.scope, 'month');
  assert.equal(o.ganZhi, '辛巳');
  assert.equal(o.accumulatedValue, 121870878);
  assert.equal(o.bureau, 6);
  assert.equal(o.yinYang, '阳遁');
  assert.equal(o.taiyiPosition, '午');
  assert.equal(o.jiShenPosition, '酉');
  assert.equal(o.lordCount, 25);
  assert.equal(o.guestCount, 10);
  assert.deepEqual(o.countNatures, { set: '下和' });
});

test('日家 1990-05-12：积日/日干支', () => {
  const o = generateTaiyiCore({ scope: 'day', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.equal(o.ganZhi, '丁丑');
  assert.equal(o.accumulatedValue, 708043754);
  assert.equal(o.bureau, 2);
  assert.equal(o.taiyiPosition, '乾');
  assert.equal(o.lordCount, 6);
});

test('时家 1990-05-12 辰时：积时/时干支/阳遁', () => {
  const o = generateTaiyiCore({ scope: 'hour', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.equal(o.ganZhi, '甲辰');
  assert.equal(o.accumulatedValue, 8496525041);
  assert.equal(o.entryYears, 161);
  assert.equal(o.bureau, 17);
  assert.equal(o.yinYang, '阳遁');
  assert.equal(o.taiyiPosition, '坤');
  assert.equal(o.wenChangPosition, '坤');
});

test('时家 夏至后阴遁 / 冬至后阳遁（冬夏至精确换界）', () => {
  const summer = generateTaiyiCore({ scope: 'hour', customDate: '1990-06-22T12:00:00+08:00', now: FIXED_NOW });
  assert.equal(summer.yinYang, '阴遁');
  assert.equal(summer.bureau, 8);
  assert.equal(summer.taiyiPosition, '艮');
  assert.equal(summer.wenChangPosition, '未');   // 阴遁文昌 = 阳遁对冲
  const winter = generateTaiyiCore({ scope: 'hour', customDate: '1990-12-22T12:00:00+08:00', now: FIXED_NOW });
  assert.equal(winter.yinYang, '阳遁');
  assert.equal(winter.bureau, 43);
  // 夏至时刻 1990-06-21 23:32:46（DST 后墙钟）；前 1 分钟阳遁、后 1 分钟阴遁
  const before = generateTaiyiCore({ scope: 'hour', customDate: '1990-06-21T22:31:00+08:00', now: FIXED_NOW });
  const after = generateTaiyiCore({ scope: 'hour', customDate: '1990-06-21T22:33:00+08:00', now: FIXED_NOW });
  assert.equal(before.yinYang, '阳遁');
  assert.equal(after.yinYang, '阴遁');
  // 冬至时刻 1990-12-22 11:06:59
  assert.equal(generateTaiyiCore({ scope: 'hour', customDate: '1990-12-22T00:30:00+08:00', now: FIXED_NOW }).yinYang, '阴遁');
  assert.equal(generateTaiyiCore({ scope: 'hour', customDate: '1990-12-22T12:00:00+08:00', now: FIXED_NOW }).yinYang, '阳遁');
});

test('晚子时换日（有效墙钟 23:00 起）+ 中国夏令时叠加', () => {
  // 1990-05-12T22:30+08:00 在夏令时窗口内 → 有效 23:30 → 晚子时换日
  const day = generateTaiyiCore({ scope: 'day', customDate: '1990-05-12T22:30:00+08:00', now: FIXED_NOW });
  assert.equal(day.ganZhi, '戊寅');            // 05-13 日干支
  assert.equal(day.accumulatedValue, 708043755);
  assert.equal(day.bureau, 3);
  const hour = generateTaiyiCore({ scope: 'hour', customDate: '1990-05-12T22:30:00+08:00', now: FIXED_NOW });
  assert.equal(hour.ganZhi, '壬子');           // 戊日 子时 → 壬子
  assert.equal(hour.accumulatedValue, 8496525049);
});

test('立春精确时刻换月（月干支变、积月不变）', () => {
  const before = generateTaiyiCore({ scope: 'month', customDate: '2000-02-04T20:30:00+08:00', now: FIXED_NOW });
  const after = generateTaiyiCore({ scope: 'month', customDate: '2000-02-04T20:41:00+08:00', now: FIXED_NOW });
  assert.equal(before.ganZhi, '丁丑');
  assert.equal(after.ganZhi, '戊寅');
  assert.equal(before.accumulatedValue, after.accumulatedValue);   // 积月以农历年/月计，立春不变
  assert.equal(before.jiShenPosition, '丑');
  assert.equal(after.jiShenPosition, '子');
});

test('闰月（2023 闰二月）：农历月序同月不增计', () => {
  const m = generateTaiyiCore({ scope: 'month', customDate: '2023-03-25T12:00:00+08:00', now: FIXED_NOW });
  assert.equal(m.ganZhi, '乙卯');
  assert.equal(m.accumulatedValue, 121871272);
  assert.equal(m.bureau, 40);
});

test('入纪 360 / 局数 72 边界：year 243', () => {
  const o = generateTaiyiCore({ scope: 'year', year: 243, now: FIXED_NOW });
  assert.equal(o.entryYears, 360);
  assert.equal(o.bureau, 72);
  assert.equal(o.yuan, 5);
  assert.equal(o.ji, 6);
});

test('年份范围端点：1 与 9999 可起局', () => {
  const y1 = generateTaiyiCore({ scope: 'year', year: 1, now: FIXED_NOW });
  assert.equal(y1.accumulatedValue, 10153918);
  assert.equal(y1.bureau, 46);
  const y9999 = generateTaiyiCore({ scope: 'year', year: 9999, now: FIXED_NOW });
  assert.equal(y9999.accumulatedValue, 10163916);
  assert.equal(y9999.bureau, 36);
});

test('闰日 2000-02-29 可起局', () => {
  const d = generateTaiyiCore({ scope: 'day', customDate: '2000-02-29T12:00:00+08:00', now: FIXED_NOW });
  assert.equal(d.bureau, 54);   // 与 golden 一致
});

test('纯函数性：不产生 IO/随机（内部字段在剥离清单内）', () => {
  const o = generateTaiyiCore({ scope: 'year', year: 2024, now: FIXED_NOW });
  const stripped = stripInternal(o);
  for (const bad of ['calculationContext', 'positionSources', 'prompt', 'calculationChain', 'sources', 'timestamp']) {
    assert.ok(!Object.keys(o).includes(bad), `不得输出内部字段 ${bad}`);
  }
  assert.ok(!('evidenceAnalysis' in stripped), 'stripInternal 必须剥离 evidenceAnalysis');
  assert.ok(!('calculatedAt' in stripped));
});

test('证据层结构：evidenceAnalysis 含计算链/方法/限制/主次事实/白话汇总', () => {
  const o = generateTaiyiCore({ scope: 'year', year: 1990, now: FIXED_NOW });
  const ev = o.evidenceAnalysis;
  assert.ok(ev, '必须产出 evidenceAnalysis');
  assert.equal(ev.status, '已计算');
  assert.ok(Array.isArray(ev.calculationChain) && ev.calculationChain.length >= 6, 'calculationChain 为计算链数组');
  assert.ok(ev.calculationChain[0].includes('10153917'), '首条为积年推导');
  assert.ok(ev.calculationChain.some((s) => s.includes('局数')), '含局数推导');
  assert.ok(ev.calculationChain.some((s) => s.includes('太乙落宫')), '含太乙落宫推导');
  assert.ok(Array.isArray(ev.methodology) && ev.methodology.length > 0);
  assert.ok(Array.isArray(ev.limitations) && ev.limitations.length > 0);
  assert.ok(Array.isArray(ev.primaryFacts) && ev.primaryFacts.length > 0);
  assert.ok(Array.isArray(ev.supportingFacts) && ev.supportingFacts.length > 0);
  assert.ok(typeof ev.summaryFact.promptText === 'string' && ev.summaryFact.promptText.length > 0, '白话汇总存在');
  const m = generateTaiyiCore({ scope: 'month', customDate: '1990-05-12T07:30:00+08:00', now: FIXED_NOW });
  assert.ok(m.evidenceAnalysis.calculationChain.some((s) => s.includes('积月')));
});

test('抛错路径：缺输入 / 非法 scope / 非法年份 / 非法日期', () => {
  assert.throws(() => generateTaiyiCore({}), PaipanInputError);
  assert.throws(() => generateTaiyiCore(null), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'year' }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'year', year: 0 }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'year', year: 10000 }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'year', year: 1990.5 }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'month' }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'foo', customDate: '2020-01-01T00:00:00+08:00' }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'hour', customDate: 'not-a-date' }), PaipanInputError);
  assert.throws(() => generateTaiyiCore({ scope: 'hour', customDate: '1990-02-30T00:00:00+08:00' }), PaipanInputError);
});

test('单元：JDN / 时辰序 / 五鼠遁时干支', () => {
  assert.equal(julianDayNumber(1990, 5, 12), 2448023);
  assert.equal(julianDayNumber(2000, 1, 1), 2451544);
  assert.equal(julianDayNumber(2024, 1, 1), 2460310);
  assert.equal(hourGanZhi('丁丑', 4), '甲辰');   // 丁日辰时
  assert.equal(hourGanZhi('戊寅', 0), '壬子');   // 戊日子时
  assert.equal(hourGanZhi('甲子', 6), '庚午');   // 甲日午时
});

test('规则表逐字：十六神 / 七十二局表 / 始击表 / 和数表 / 宫数映射', () => {
  assert.equal(TAIYI_SIXTEEN_GODS.length, 16);
  assert.deepEqual(TAIYI_SIXTEEN_GODS[0], { branch: '子', god: '地主' });
  assert.deepEqual(TAIYI_SIXTEEN_GODS[15], { branch: '亥', god: '大义' });
  assert.equal(TAIYI_YANG_TABLE.length, 72);
  assert.equal(TAIYI_YIN_TABLE.length, 72);
  assert.equal(TAIYI_START_JUMP_TABLE.length, 72);
  assert.deepEqual(TAIYI_YANG_TABLE[0], [7, 13, 13, 7, 1, 3, 9, 3, 9]);
  assert.deepEqual(TAIYI_YIN_TABLE[0], [5, 29, 7, 5, 5, 9, 7, 7, 1]);
  assert.equal(TAIYI_COUNT_NATURES[39], '纯阳');
  assert.equal(TAIYI_COUNT_NATURES[25], undefined);   // 无性质值
  assert.equal(TAIYI_PALACE_NUM['寅'], 4);            // 错位口径
  assert.equal(TAIYI_PALACE_NUM['亥'], 8);
  assert.equal(TAIYI_PALACE_NUM['巳'], 2);
});

test('单元：四星位置公式与查表（抽 6 局）', () => {
  const cases = [
    [1, '乾', '申', '寅', '坤'],
    [19, '子', '申', '申', '艮'],
    [30, '午', '辰', '酉', '丑'],
    [66, '坤', '辰', '酉', '丑'],
    [72, '巽', '坤', '卯', '午'],
    [42, '坤', '亥', '酉', '辰'],
  ];
  for (const [b, taiyi, wen, js, sj] of cases) {
    assert.equal(taiyiStarPos(b), taiyi, `b${b} 太乙`);
    assert.equal(taiyiWenYang(b), wen, `b${b} 文昌`);
    assert.equal(taiyiJiShenYear(b), js, `b${b} 计神`);
    assert.equal(taiyiStartJump(b), sj, `b${b} 始击`);
  }
  assert.deepEqual(taiyiBureauRow(19, false), { lord: 8, guest: 32, set: 14, lordGeneral: 8, lordAssistant: 4, guestGeneral: 2, guestAssistant: 6, setGeneral: 4, setAssistant: 2 });
  assert.deepEqual(taiyiBureauRow(8, true), { lord: 1, guest: 7, set: 7, lordGeneral: 1, lordAssistant: 3, guestGeneral: 7, guestAssistant: 1, setGeneral: 7, setAssistant: 1 });
});

test('四段管线可直接调用（normalize→resolve→evaluate→assemble 形状稳定）', () => {
  const n = normalizeInput({ scope: 'hour', customDate: '2024-01-01T00:00:00+08:00' });
  const c = resolveCalendar(n);
  const e = evaluateBureau(c);
  assert.equal(c.bureau, 1);
  assert.equal(c.isYinDun, false);
  assert.equal(c.taiyiPosition, '乾');
  assert.equal(e.row.lord, 7);
  assert.ok(Array.isArray(e.judgments));
  assert.ok(typeof e.tacticGuidance === 'string');
});

test('中国夏令时窗口：1986 首日 02:00 起 +1h；结束日 01:00 起回标准时', () => {
  const startDayBefore = generateTaiyiCore({ scope: 'hour', customDate: '1986-05-04T01:59:00+08:00', now: FIXED_NOW });
  const startDayAfter = generateTaiyiCore({ scope: 'hour', customDate: '1986-05-04T02:00:00+08:00', now: FIXED_NOW });
  assert.equal(startDayBefore.accumulatedValue + 1, startDayAfter.accumulatedValue, '02:00 起 +1 时辰');
  const endDayDst = generateTaiyiCore({ scope: 'hour', customDate: '1986-09-14T00:30:00+08:00', now: FIXED_NOW });
  const endDayStd = generateTaiyiCore({ scope: 'hour', customDate: '1986-09-14T01:00:00+08:00', now: FIXED_NOW });
  assert.equal(endDayDst.accumulatedValue, endDayStd.accumulatedValue, '01:00 起回标准时后同时辰同积时（旧实现口径）');
});
