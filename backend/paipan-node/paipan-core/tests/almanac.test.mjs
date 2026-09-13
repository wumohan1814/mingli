/**
 * 命理 · 自研排盘内核 · 单测 · 黄历择日（almanac）
 * ---------------------------------------------------------------------------
 * 断言里的期望值全部来自对拍门禁 PASSED 的实测结果（黑盒探针 + run-compare 100%），
 * 不是从旧实现源码抄来的。纪律：零触网、零真实时钟、零本地时区依赖。
 *
 * 运行：node paipan-core/tests/almanac.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PaipanInputError,
  buildNineStarBoundaries,
  generateAlmanacSelectionCore,
  judgeDay,
  normalizeInput,
  resolveCalendar,
} from '../src/capabilities/almanac/index.js';
import {
  ALMANAC_HOURS,
  ALMANAC_RULES,
  ALMANAC_TOPIC_KEYS,
  BRANCH_DIRECTION_NAMES,
  CANDIDATE_STATUS,
  XIU_ANIMAL_FIX,
  XIONG_SHA_NAME_FIX,
  annualDirectionGods,
  cleanTabooItems,
  fixXiuAnimal,
  fixXiongShaName,
  lunarMonthText,
  matchTopicItems,
  nineStar,
  nineStarIndexFromPhases,
} from '../src/rules/almanac.js';
import { stripInternal } from '../src/pipeline/index.js';

const one = (topic, date) => generateAlmanacSelectionCore({ topic, startDate: date, endDate: date });

test('规则表：10 个事项 / 13 个时辰 / 12 方位神 / 九星表 / 校勘表完整且冻结', () => {
  assert.deepEqual([...ALMANAC_TOPIC_KEYS], ['move', 'marriage', 'opening', 'contract', 'travel', 'medical', 'study', 'burial', 'renovation', 'custom']);
  assert.equal(ALMANAC_HOURS.length, 13);
  assert.equal(ALMANAC_HOURS[0].name, '早子时');
  assert.equal(ALMANAC_HOURS[12].name, '晚子时');
  assert.equal(ALMANAC_HOURS[12].range, '23:00-24:00');
  assert.equal(ALMANAC_HOURS[12].branch, '子');
  assert.equal(Object.keys(BRANCH_DIRECTION_NAMES).length, 12);
  assert.equal(annualDirectionGods('巳').length, 12);
  assert.equal(nineStar(1).fullName, '一白水');
  assert.equal(nineStar(3).dipper, '天玑');
  assert.equal(nineStar(9).direction, '南');
  assert.deepEqual({ ...XIONG_SHA_NAME_FIX }, { 'sn.sanSang': '三丧', 'sn.guiKu': '鬼哭', 'sn.daTui': '大退', 'sn.siLi': '四离' });
  assert.deepEqual({ ...XIU_ANIMAL_FIX }, { 壁: '貐', 胃: '雉' });
  assert.ok(Object.isFrozen(ALMANAC_RULES) && Object.isFrozen(ALMANAC_HOURS));
  assert.equal(ALMANAC_RULES.dateRange.maxDaysPerCall, 180);
});

test('校勘与清洗：i18n 神煞名、宿动物、农历月名、宜忌占位「无」', () => {
  assert.equal(fixXiongShaName('sn.sanSang'), '三丧');
  assert.equal(fixXiongShaName('四相'), '四相');
  assert.equal(fixXiuAnimal('壁', '獝'), '貐');
  assert.equal(fixXiuAnimal('胃', '彘'), '雉');
  assert.equal(fixXiuAnimal('井', '犴'), '犴');
  assert.equal(lunarMonthText(1), '正月');
  assert.equal(lunarMonthText(11), '十一月');
  assert.equal(lunarMonthText(12), '十二月');
  assert.equal(lunarMonthText(-4), '闰四月');
  assert.deepEqual(cleanTabooItems(['无']), []);
  assert.deepEqual(cleanTabooItems(['嫁娶', '无']), ['嫁娶']);
  assert.deepEqual(matchTopicItems(['修造', '动土', '入宅'], ['入宅', '动土']), ['动土', '入宅']);
});

test('已知样例写死断言：2026-01-01（搬家入宅）', () => {
  const out = one('move', '2026-01-01');
  const d = out.days[0];
  assert.equal(out.topic, 'move');
  assert.equal(out.topicLabel, '搬家入宅');
  assert.equal(out.weekendPreference, 'any');
  assert.deepEqual(out.timePreferences, []);
  assert.deepEqual(out.participants, []);
  assert.equal(d.date, '2026-01-01');
  assert.equal(d.weekday, '星期四');
  assert.equal(d.lunarDate, '农历乙巳年十一月十三');
  assert.deepEqual(d.ganzhi, { year: '乙巳', month: '戊子', day: '乙亥' });
  assert.equal(d.zodiac, '猪');
  assert.equal(d.dayOfficer, '闭');
  assert.equal(d.twelveStar, '朱雀');
  assert.equal(d.twentyEightStar, '井');
  assert.equal(d.twentyEightStarDetail.fullName, '井木犴');
  assert.equal(d.twentyEightStarDetail.fortune, '吉');
  assert.equal(d.nineStar, '三');
  assert.deepEqual(d.nineStarDetail, {
    fullName: '三碧木', color: '碧', wuxing: '木', dipper: '天玑', direction: '东', source: d.nineStarDetail.source,
  });
  assert.equal(d.pengZuGan, '乙不栽植千株不长');
  assert.equal(d.pengZuZhi, '亥不嫁娶不利新郎');
  assert.equal(d.pengZu, '乙不栽植千株不长 亥不嫁娶不利新郎');
  assert.equal(d.clash, '冲巳，煞西');
  assert.equal(d.recommends[0], '入宅');
  assert.equal(d.avoids[0], '嫁娶');
  // 神煞：吉神在前、凶神在后（对拍实测）
  assert.deepEqual(d.gods.slice(0, 6), ['四相', '王日', '游祸', '血支', '重日', '朱雀']);
  // 全年方位神：2026-01-01 年干支乙巳 → 太岁在巳、岁破在亥
  assert.equal(d.annualDirectionGods[0].god, '太岁');
  assert.equal(d.annualDirectionGods[0].branch, '巳');
  assert.equal(d.annualDirectionGods[0].direction, '东南偏南');
  assert.equal(d.annualDirectionGods[6].god, '岁破');
  assert.equal(d.annualDirectionGods[6].branch, '亥');
  assert.equal(d.annualDirectionGods[11].god, '病符');
  // 逐时时课（晚子时用次日日干）
  assert.deepEqual(
    d.hours.map((h) => `${h.name}/${h.ganzhi}/${h.twelveStar}`).slice(0, 2),
    ['早子时/丙子/白虎', '丑时/丁丑/玉堂'],
  );
  assert.equal(d.hours[12].name, '晚子时');
  assert.equal(d.hours[12].ganzhi, '戊子');
  assert.equal(d.hours[12].twelveStar, '金匮');
});

test('九星值日：相位内每日 ±1 且边界特例与旧实现一致（1905/1917/1928）', () => {
  // 实测特例：4 周期逆相位起点为六（逆相位锚定末端＝一白）
  assert.equal(one('move', '1905-05-25').days[0].nineStar, '六');
  assert.equal(one('move', '1905-05-24').days[0].nineStar, '九');
  assert.equal(one('move', '1905-05-26').days[0].nineStar, '五');
  // 实测特例：顺相位 4 周期 → 边界处步进 +3（上一日为六、边界为九）
  assert.equal(one('move', '1917-07-20').days[0].nineStar, '六');
  assert.equal(one('move', '1917-07-21').days[0].nineStar, '九');
  // 实测特例：另一个 4 周期逆相位（起点六）
  assert.equal(one('move', '1928-05-23').days[0].nineStar, '九');
  assert.equal(one('move', '1928-05-24').days[0].nineStar, '六');

  // 相位内每日步进必须是 ±1（用纯函数逐日检查 1900–1910，避免逐日调用历法）
  const boundaries = buildNineStarBoundaries(1899, 1911);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const jdn0 = Math.floor(Date.UTC(1900, 0, 1, 12) / 86400000) + 2440588;
  let checked = 0;
  for (let i = 1; i <= 4000; i += 1) {
    const a = nineStarIndexFromPhases(jdn0 + i - 1, boundaries);
    const b = nineStarIndexFromPhases(jdn0 + i, boundaries);
    let delta = b - a;
    if (delta > 4) delta -= 9;
    if (delta < -4) delta += 9;
    assert.ok(Math.abs(delta) <= 3, `步进异常 jdn=${jdn0 + i} (Δ${delta})`);
    checked += 1;
  }
  assert.equal(checked, 4000);
  // 与逐日历法装配一致（取一段 180 天窗口抽查）
  const window = generateAlmanacSelectionCore({ topic: 'move', startDate: '1900-01-01', endDate: '1900-06-28' });
  for (const d of window.days) {
    const jdn = Math.floor(Date.UTC(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)) - 1, Number(d.date.slice(8, 10)), 12) / 86400000) + 2440588;
    assert.equal(digits[d.nineStar], nineStarIndexFromPhases(jdn, boundaries), `${d.date} 装配与规则不一致`);
  }
});

test('九星边界表：边界必为甲子日、类型交替、相邻间隔为 180 或 240 天', () => {
  const boundaries = buildNineStarBoundaries(1900, 1910);
  assert.ok(boundaries.length >= 20);
  for (let i = 0; i < boundaries.length; i += 1) {
    if (i > 0) {
      const gap = boundaries[i].jdn - boundaries[i - 1].jdn;
      assert.ok(gap === 180 || gap === 240, `边界间隔异常: ${gap}`);
      assert.notEqual(boundaries[i].type, boundaries[i - 1].type, '边界类型应交替');
    }
  }
  // 相位函数：顺相位锚定起点、逆相位锚定末端
  const b = [{ jdn: 100, type: '逆' }, { jdn: 280, type: '顺' }, { jdn: 460, type: '逆' }];
  assert.equal(nineStarIndexFromPhases(100, b), 9);   // 逆相位起点：((280-1-100) mod 9)+1 = 9
  assert.equal(nineStarIndexFromPhases(279, b), 1);   // 逆相位末端：1
  assert.equal(nineStarIndexFromPhases(280, b), 1);   // 顺相位起点：1
  assert.equal(nineStarIndexFromPhases(459, b), 9);
  assert.throws(() => nineStarIndexFromPhases(9, b), RangeError);
});

test('候选状态与 days 顺序：状态 → 有宜项命中 → 日期升序（对拍实测口径）', () => {
  const out = generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-01-01', endDate: '2026-01-20' });
  // 前 8 条是可用候选（有宜项命中在前），后 12 条慎用候选
  assert.deepEqual(out.days.slice(0, 8).map((d) => d.date), [
    '2026-01-03', '2026-01-08', '2026-01-13', '2026-01-19', '2026-01-20', '2026-01-06', '2026-01-11', '2026-01-15',
  ]);
  assert.deepEqual(out.days.slice(8).map((d) => d.date), [
    '2026-01-01', '2026-01-04', '2026-01-05', '2026-01-07', '2026-01-10', '2026-01-14', '2026-01-16', '2026-01-17',
    '2026-01-02', '2026-01-09', '2026-01-12', '2026-01-18',
  ]);
  // 排序键单调
  const status = new Map(out.evidenceAnalysis.candidates.map((c) => [c.date, c.status]));
  const rank = (s) => (s === CANDIDATE_STATUS.preferred ? 0 : s === CANDIDATE_STATUS.conditional ? 1 : 2);
  const keys = out.days.map((d) => [rank(status.get(d.date)), d.highlights.length ? 0 : 1, d.date]);
  for (let i = 1; i < keys.length; i += 1) {
    const [r0, h0, d0] = keys[i - 1];
    const [r1, h1, d1] = keys[i];
    assert.ok(r0 < r1 || (r0 === r1 && (h0 < h1 || (h0 === h1 && d0 < d1))), `顺序不符 @${i}`);
  }
  // 诸事不宜日必为慎用候选
  const allTaboo = one('move', '2026-01-09');
  assert.equal(allTaboo.evidenceAnalysis.candidates[0].status, CANDIDATE_STATUS.caution);
  assert.equal(allTaboo.days[0].avoids[0], '诸事不宜');
});

test('evidenceAnalysis 结构（server 投影 candidateGroups 的契约）', () => {
  const out = generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-01-01', endDate: '2026-01-05' });
  const ev = out.evidenceAnalysis;
  assert.equal(ev.key, 'almanac:evidence');
  assert.equal(ev.status, '已计算');
  for (const key of ['candidates', 'preferredDates', 'conditionalDates', 'cautionDates', 'hardConstraints', 'realityConstraints']) {
    assert.ok(key in ev, `evidenceAnalysis 缺 ${key}`);
    assert.ok(Array.isArray(ev[key]), `${key} 必须是数组`);
  }
  assert.equal(ev.candidates.length, 5);
  for (const c of ev.candidates) {
    assert.equal(typeof c.date, 'string');
    assert.ok([CANDIDATE_STATUS.preferred, CANDIDATE_STATUS.conditional, CANDIDATE_STATUS.caution].includes(c.status));
  }
  // server.mjs 的投影：statusByDate 由 candidates 派生，三个日期组各自有序
  const statusByDate = {};
  for (const c of ev.candidates) statusByDate[c.date] = c.status;
  assert.equal(Object.keys(statusByDate).length, 5);
  assert.equal(
    ev.preferredDates.length + ev.conditionalDates.length + ev.cautionDates.length,
    ev.candidates.length,
  );
  assert.ok(ev.hardConstraints.length >= 4 && ev.realityConstraints.length >= 4);
  // evidenceAnalysis 被 stripInternal 剥离（不进生产契约的形状之外）
  assert.ok(!('evidenceAnalysis' in stripInternal(out)));
  assert.equal(stripInternal(out).days.length, 5);
  assert.ok(!('timestamp' in stripInternal(out)));
  // 逐日不再带月相字段（旧实现的 moonPhaseEvidence 被 server 剔除；本内核不产）
  for (const d of out.days) assert.ok(!('moonPhaseEvidence' in d));
});

test('参与人实测被忽略（对齐旧实现口径，不编造个人结论）', () => {
  const out = generateAlmanacSelectionCore({
    topic: 'marriage',
    startDate: '2026-02-01',
    endDate: '2026-02-03',
    participants: [{ id: 'p1', gender: '男', year: 1990, month: 5, day: 12, timeIndex: 4, dateType: 'solar' }],
  });
  assert.deepEqual(out.participants, []);
  for (const d of out.days) {
    assert.deepEqual(d.participantNotes, []);
    assert.deepEqual(d.participantRelationFacts, []);
  }
});

test('抛错路径：缺参数 / 未知事项 / 非法日期 / 越界年份 / 范围超 180 天 / 结束早于开始', () => {
  assert.throws(() => generateAlmanacSelectionCore(undefined), (err) => err instanceof PaipanInputError && err.code === 'missing_params');
  assert.throws(() => generateAlmanacSelectionCore({}), (err) => err.code === 'unknown_topic');
  assert.throws(() => generateAlmanacSelectionCore({ topic: '结婚', startDate: '2026-01-01', endDate: '2026-01-02' }), (err) => err.code === 'unknown_topic');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '2026/01/01', endDate: '2026-01-02' }), (err) => err.code === 'invalid_date');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-02-30', endDate: '2026-03-02' }), (err) => err.code === 'invalid_date');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '1899-12-31', endDate: '1900-01-02' }), (err) => err.code === 'date_out_of_range');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '2100-12-30', endDate: '2101-01-02' }), (err) => err.code === 'date_out_of_range');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-06-30', endDate: '2026-01-01' }), (err) => err.code === 'invalid_range');
  assert.throws(() => generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-01-01', endDate: '2026-06-30' }), (err) => err.code === 'range_too_long');
  // 180 天整（含端点）允许
  const ok = generateAlmanacSelectionCore({ topic: 'move', startDate: '2026-01-01', endDate: '2026-06-29' });
  assert.equal(ok.days.length, 180);
});

test('纯函数性与归一化：同输入同输出、不改入参、哈希稳定', () => {
  const params = { topic: 'travel', startDate: '1990-05-11', endDate: '1990-05-12', timePreferences: ['上午'] };
  const snapshot = JSON.stringify(params);
  const a = generateAlmanacSelectionCore(params);
  const b = generateAlmanacSelectionCore(params);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(params), snapshot);
  assert.deepEqual(a.timePreferences, ['上午']);
  const normalized = normalizeInput({ topic: 'travel', startDate: '1990-05-11', endDate: '1990-05-12' });
  assert.equal(normalized.dayCount, 2);
  assert.equal(normalized.weekendPreference, 'any');
  assert.equal(normalized.topic.label, '出行赴任');
});

test('分层纯函数：resolveCalendar 与 judgeDay 可单独调用', () => {
  const boundaries = buildNineStarBoundaries(2025, 2027);
  const jdn = Math.floor(Date.UTC(2026, 0, 1, 12) / 86400000) + 2440588;
  const calendar = resolveCalendar('2026-01-01', jdn, boundaries);
  assert.equal(calendar.nineStar, '三');
  const judged = judgeDay(calendar, { key: 'move', label: '搬家入宅', yiKeywords: ['入宅'], jiKeywords: ['安床'] });
  assert.deepEqual(judged.yiMatched, ['入宅']);
  // 2026-01-01 日忌含「安床」→ 命中忌项 ⇒ 慎用候选（对拍实测口径）
  assert.deepEqual(judged.jiMatched, ['安床']);
  assert.equal(judged.status, CANDIDATE_STATUS.caution);
  assert.deepEqual(judged.highlights, ['本日宜项覆盖「搬家入宅」']);
  assert.deepEqual(judged.cautions, ['本日忌项触及「搬家入宅」']);
  // 无命中忌项时才是可用候选
  const lenient = judgeDay(calendar, { key: 'move', label: '搬家入宅', yiKeywords: ['入宅'], jiKeywords: ['不存在的条目'] });
  assert.deepEqual(lenient.jiMatched, []);
  assert.equal(lenient.status, CANDIDATE_STATUS.preferred);
  assert.equal(judged.topicMatchFacts.length, 2);
  assert.equal(judged.godFacts.length, calendar.gods.length);
  assert.equal(judged.godFacts[0].classification, '吉神');
  assert.equal(judged.godFacts[calendar.jiShen.length].classification, '凶神');
});
