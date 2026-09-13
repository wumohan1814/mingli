/**
 * 命理 · 自研排盘内核 · 梅花易数（meihua）单测（node:test）
 * ===========================================================================
 * 运行：cd backend/paipan-node && node paipan-core/tests/meihua.test.mjs
 *
 * 纪律（README §6）：
 *   - 不触网、不读磁盘、不依赖真实时钟（凡涉及 meta.calculatedAt 处一律注入固定 now）。
 *   - 关键约定写死断言（值来自「黑盒对拍实测」而非猜测），约定一变测试先红。
 *   - 纯函数性：同输入同输出；零随机（随机起卦一律抛错）。
 *
 * 断言里的「实测值」来源：vendor 旧实现黑盒探针（只运行不读源码），
 * 详细口径见 tools/_probe/out/probe-mh-a-FINDINGS.md 与 tools/_probe 下 gen155 / cmp155 系列。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateMeihuaCore,
  normalizeInput,
  resolveCalendar,
  castMeihua,
  computeTiYong,
  guaByTrigramIndex,
  tiYongRelation,
  tiYongEvaluation,
  timelineTrend,
  PaipanInputError,
} from '../src/capabilities/meihua/index.js';
import {
  MEIHUA_SHENG,
  MEIHUA_KE,
  TI_YONG_RELATIONS,
  SEASON_BY_MONTH_ZHI,
  MOVING_YAO_NAMES,
  TI_YONG_EVALUATION,
  TIMELINE_TRENDS,
  RELATION_FORTUNE,
  YING_QI_MOVING,
  YING_QI_RELATION,
  YING_QI_STATE,
  TRIGRAMS,
} from '../src/rules/meihua.js';
import { TRIGRAM_BY_INDEX, GUA_TABLE } from '../src/rules/liuyao.js';
import { stripInternal, getPath, stableStringify } from '../src/pipeline/index.js';

/** 固定 now，保证测试完全确定性。 */
const FIXED_NOW = new Date('2020-01-01T00:00:00.000Z');

const run = (customDate, settings) => generateMeihuaCore({ customDate, settings, now: FIXED_NOW });

// ===========================================================================
// 一、规则表逐字断言
// ===========================================================================

test('① 八卦序 1..8 = 乾兑离震巽坎艮坤；五行生克表与共享基础一致', () => {
  assert.deepEqual([...TRIGRAM_BY_INDEX].slice(1), ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);
  assert.deepEqual(MEIHUA_SHENG, { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' });
  assert.deepEqual(MEIHUA_KE, { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });
  // 八卦五行/自然象（与 rules/liuyao.js 同一份数据，不重复建表）
  assert.deepEqual(Object.keys(TRIGRAMS), ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);
  assert.equal(TRIGRAMS.乾.element, '金');
  assert.equal(TRIGRAMS.巽.element, '木');
  assert.equal(TRIGRAMS.巽.nature, '风');
  assert.equal(TRIGRAMS.艮.nature, '山');
  // 64 卦基础表来自 liuyao rules（共享，不重复）
  assert.equal(Object.keys(GUA_TABLE).length, 64);
});

test('② 体用五行五格局取值集合与命名', () => {
  assert.deepEqual([...TI_YONG_RELATIONS], ['体用比和', '体生用', '用生体', '体克用', '用克体']);
  assert.deepEqual(tiYongRelation('木', '木'), { relation: '体用比和', raw: '比和' });
  assert.deepEqual(tiYongRelation('木', '火'), { relation: '体生用', raw: '体生用' });
  assert.deepEqual(tiYongRelation('木', '水'), { relation: '用生体', raw: '用生体' });
  assert.deepEqual(tiYongRelation('木', '土'), { relation: '体克用', raw: '体克用' });
  assert.deepEqual(tiYongRelation('木', '金'), { relation: '用克体', raw: '用克体' });
});

test('③ 季节/月支表：寅卯辰春、巳午未夏、申酉戌秋、亥子丑冬', () => {
  assert.deepEqual({ ...SEASON_BY_MONTH_ZHI }, {
    寅: '春', 卯: '春', 辰: '春', 巳: '夏', 午: '夏', 未: '夏',
    申: '秋', 酉: '秋', 戌: '秋', 亥: '冬', 子: '冬', 丑: '冬',
  });
});

test('④ 动爻爻位名与吉凶档', () => {
  assert.deepEqual({ ...MOVING_YAO_NAMES }, { 1: '初爻', 2: '二爻', 3: '三爻', 4: '四爻', 5: '五爻', 6: '上爻' });
  assert.deepEqual({ ...RELATION_FORTUNE }, { 体用比和: '吉', 用生体: '吉', 体生用: '凶', 用克体: '凶', 体克用: '平' });
  // 趋势表 6 种 trend 齐全
  assert.deepEqual(Object.keys(TIMELINE_TRENDS).sort(), ['中途多阻', '先顺后阻', '先难后易', '始终受制', '始末顺畅', '平稳演进'].sort());
  for (const t of Object.values(TIMELINE_TRENDS)) {
    assert.ok(typeof t.trend === 'string' && typeof t.summary === 'string' && t.summary.length > 0);
  }
});

test('⑤ 体用旺衰评断（关系 × 体/用旺衰，实测 25 组合全中）', () => {
  // 比和 / 体生用：与旺衰无关
  assert.equal(tiYongEvaluation('体用比和', '旺', '死'), TI_YONG_EVALUATION['体用比和']);
  assert.equal(tiYongEvaluation('体用比和', '死', '旺'), TI_YONG_EVALUATION['体用比和']);
  assert.equal(tiYongEvaluation('体生用', '旺', '死'), TI_YONG_EVALUATION['体生用']);
  assert.equal(tiYongEvaluation('体生用', '死', '旺'), TI_YONG_EVALUATION['体生用']);
  // 用生体：看「用」是否旺相
  assert.equal(tiYongEvaluation('用生体', '死', '相'), TI_YONG_EVALUATION['用生体|用旺']);
  assert.equal(tiYongEvaluation('用生体', '旺', '休'), TI_YONG_EVALUATION['用生体|用衰']);
  // 体克用：看「体」是否旺相
  assert.equal(tiYongEvaluation('体克用', '相', '囚'), TI_YONG_EVALUATION['体克用|体旺']);
  assert.equal(tiYongEvaluation('体克用', '休', '相'), TI_YONG_EVALUATION['体克用|体衰']);
  // 用克体：体旺 / 体囚死 / 体休 三分支
  assert.equal(tiYongEvaluation('用克体', '旺', '囚'), TI_YONG_EVALUATION['用克体|体旺']);
  assert.equal(tiYongEvaluation('用克体', '旺', '死'), TI_YONG_EVALUATION['用克体|体旺']);
  assert.equal(tiYongEvaluation('用克体', '死', '旺'), TI_YONG_EVALUATION['用克体|体死']);
  assert.equal(tiYongEvaluation('用克体', '囚', '相'), TI_YONG_EVALUATION['用克体|体死']);
  assert.equal(tiYongEvaluation('用克体', '休', '死'), TI_YONG_EVALUATION['用克体|体休']);
  // 全部取值都是非空字符串
  for (const v of Object.values(TI_YONG_EVALUATION)) assert.ok(typeof v === 'string' && v.length > 0);
});

test('⑥ 应期条目模板（爻动 6 条 + 关系 4 条 + 旺衰 2 条）', () => {
  assert.equal(Object.keys(YING_QI_MOVING).length, 6);
  assert.equal(Object.keys(YING_QI_RELATION).length, 4);
  assert.equal('体生用' in YING_QI_RELATION, false);   // 实测：体生用无「关系」条目
  assert.equal(Object.keys(YING_QI_STATE).length, 2);
  for (const v of Object.values(YING_QI_MOVING)) assert.match(v, /动，先观察/);
  assert.match(YING_QI_STATE.旺相, /应期快于常规/);
  assert.match(YING_QI_STATE.休囚死, /应期迟缓/);
});

// ===========================================================================
// 二、已知样例写死断言（对拍实测）
// ===========================================================================

test('⑦ 样例 A：2024-03-15T10:30+08:00（时间起卦）→ 风火家人 → 风山渐', () => {
  const r = run('2024-03-15T10:30:00+08:00');
  assert.equal(r.originalName, '风火家人');
  assert.equal(r.changedName, '风山渐');
  assert.equal(r.interName, '火水未济');
  assert.deepEqual(r.tiGua, { name: '巽', element: '木', nature: '风' });
  assert.deepEqual(r.yongGua, { name: '离', element: '火', nature: '火' });
  assert.deepEqual(r.changedTiGua, { name: '巽', element: '木', nature: '风' });
  assert.deepEqual(r.changedYongGua, { name: '艮', element: '土', nature: '山' });
  assert.deepEqual(r.interTiGua, { name: '离', element: '火', nature: '火' });
  assert.deepEqual(r.interYongGua, { name: '坎', element: '水', nature: '水' });
  assert.equal(r.mainHexagram.symbol, '☴☲');
  assert.equal(r.mainHexagram.upper, '巽');
  assert.equal(r.mainHexagram.lower, '离');
  assert.deepEqual(r.movingYao, { position: 1, description: '第1爻动', yaoName: '初爻' });
  assert.equal(r.analysis.season, '春');
  assert.equal(r.analysis.monthBranch, '卯');
  assert.equal(r.analysis.monthElement, '木');
  assert.equal(r.analysis.tiYongRelation, '体生用');
  assert.equal(r.analysis.tiYongRaw, '体生用');
  assert.equal(r.analysis.tiSeasonState, '旺');
  assert.equal(r.analysis.yongSeasonState, '相');
  assert.equal(r.analysis.inter1Relation, '原体生体互');
  assert.equal(r.analysis.inter2Relation, '用互生原体');
  assert.equal(r.analysis.changedRelation, '体克用');
  assert.equal(r.analysis.changedTiYongRelation, r.analysis.changedRelation);
  assert.deepEqual(r.ganzhi, { year: '甲辰', month: '丁卯', day: '戊寅', hour: '丁巳' });
  assert.deepEqual(r.calculation, {
    method: '年月日时起卦法', methodKey: 'time',
    yearZhi: '辰', yearZhiIndex: 5, month: 2, day: 6,
    timeZhi: '巳', timeZhiIndex: 6,
    upperTrigramIndex: 5, lowerTrigramIndex: 3, movingYaoIndex: 1,
  });
  // 逐爻：动爻在下卦 → 下卦为「用」、上卦为「体」
  assert.deepEqual(r.yaosDetail.map((y) => `${y.yaoType}${y.isChanging ? '动' : ''}${y.tiYong}`),
    ['阳动用', '阴用', '阳用', '阴体', '阳体', '阳体']);
  // 体生用 ⇒ 应期数组长度 3（缺「关系」条目，实测怪癖，必须复刻）
  assert.equal(r.analysis.yingQi.length, 3);
  assert.equal(r.analysis.yingQi[1], '上下卦数和为8，只作取数来源旁证，不换算绝对日期');
  assert.equal(r.analysis.yingQi[2], '体卦旺相，应期快于常规');
});

test('⑧ 样例 B：1990-05-12T07:30+08:00 → 风泽中孚（动爻在上卦 → 下卦为体）', () => {
  const r = run('1990-05-12T07:30:00+08:00');
  assert.equal(r.originalName, '风泽中孚');
  assert.deepEqual(r.tiGua.name ? { name: r.tiGua.name, element: r.tiGua.element } : null, { name: '兑', element: '金' });
  assert.equal(r.yongGua.name, '巽');
  assert.equal(r.analysis.tiYongRelation, '体克用');
  assert.equal(r.analysis.season, '夏');
  assert.equal(r.analysis.monthBranch, '巳');
  assert.equal(r.analysis.monthElement, '火');
  assert.equal(r.analysis.tiSeasonState, '死');    // 金在巳月死
  assert.equal(r.analysis.yongSeasonState, '休');  // 木在巳月休
  assert.equal(r.movingYao.position, 4);
  assert.deepEqual(r.yaosDetail.map((y) => y.tiYong), ['体', '体', '体', '用', '用', '用']);
  // 非体生用 ⇒ 应期长度 4
  assert.equal(r.analysis.yingQi.length, 4);
});

test('⑨ 取模满值：模为 0 时取满（上/下卦 8、动爻 6）', () => {
  // 2000-02-05T23:40 → 上7 下8 动2（实测）
  const r = run('2000-02-05T23:40:00+08:00');
  assert.equal(r.calculation.upperTrigramIndex, 7);
  assert.equal(r.calculation.lowerTrigramIndex, 8);
  assert.equal(r.calculation.movingYaoIndex, 2);
  assert.equal(r.originalName, '山地剥');
  assert.equal(r.analysis.tiYongRelation, '体用比和');
  // 2026-02-17T03:05 → 上1 下4 动6（实测，动爻模 0 → 6）
  const r2 = run('2026-02-17T03:05:00+08:00');
  assert.equal(r2.calculation.upperTrigramIndex, 1);
  assert.equal(r2.calculation.lowerTrigramIndex, 4);
  assert.equal(r2.calculation.movingYaoIndex, 6);
  assert.equal(r2.originalName, '天雷无妄');
});

test('⑩ 年界分歧：起卦公式用「农曆年」年支，输出 ganzhi.year 用「立春精确时刻」', () => {
  // 2024-02-05（立春后、正月初一前）：ganzhi.year 已换甲辰，但公式年支序仍为 卯=4
  const r = run('2024-02-05T09:16:00+08:00');
  assert.equal(r.ganzhi.year, '甲辰');
  assert.equal(r.calculation.yearZhi, '卯');
  assert.equal(r.calculation.yearZhiIndex, 4);
  // 2023-01-25（正月初一后、立春前）：ganzhi.year 仍壬寅，但公式年支序为 卯=4
  const r2 = run('2023-01-25T12:00:00+08:00');
  assert.equal(r2.ganzhi.year, '壬寅');
  assert.equal(r2.calculation.yearZhi, '卯');
});

test('⑪ 未时退化结构：时支序=8 ⇒ 主卦必为八纯卦、体用恒比和、逐爻体用全「体」', () => {
  for (const iso of ['2024-06-01T13:30:00+08:00', '2024-06-01T14:30:00+08:00']) {
    const r = run(iso);
    assert.equal(r.calculation.timeZhiIndex, 8, `${iso} 应为未时`);
    assert.equal(r.calculation.upperTrigramIndex, r.calculation.lowerTrigramIndex);
    assert.equal(r.mainHexagram.upper, r.mainHexagram.lower);
    assert.equal(r.analysis.tiYongRelation, '体用比和');
    assert.deepEqual(r.yaosDetail.map((y) => y.tiYong), ['体', '体', '体', '体', '体', '体']);
  }
});

test('⑫ 报数起卦：上卦=number%8、下卦=(number+时支序)%8、动爻=(number+时支序)%6', () => {
  const r = run('2024-03-15T10:30:00+08:00', { method: 'number', number: 78 });
  // 时支序=6（巳）：78%8=6（坎）、78+6=84 → 84%8=4（震）、84%6=0→6
  assert.equal(r.calculation.methodKey, 'number');
  assert.equal(r.calculation.method, '数字起卦法');
  assert.equal(r.calculation.number, 78);
  assert.equal(r.calculation.timeZhi, '巳');
  assert.equal(r.calculation.totalWithTime, 84);
  assert.equal(r.calculation.upperTrigramIndex, 6);
  assert.equal(r.calculation.lowerTrigramIndex, 4);
  assert.equal(r.calculation.movingYaoIndex, 6);
  assert.equal(r.originalName, '水雷屯');
  const r2 = run('2024-03-15T10:30:00+08:00', { method: 'number', number: 100 });
  assert.equal(r2.calculation.upperTrigramIndex, 4);
  assert.equal(r2.calculation.lowerTrigramIndex, 2);
  assert.equal(r2.calculation.movingYaoIndex, 4);
  assert.equal(r2.originalName, '雷泽归妹');
  const r3 = run('2000-02-05T20:00:00+08:00', { method: 'number', number: 16 });
  assert.equal(r3.calculation.timeZhiIndex, 11);
  assert.equal(r3.calculation.totalWithTime, 27);
  assert.equal(r3.originalName, '地火明夷');
});

// ===========================================================================
// 三、体用互变与关系命名
// ===========================================================================

test('⑬ 互卦/变卦：互下取 2-4 爻、互上取 3-5 爻；变卦为动爻取反', () => {
  const r = run('2024-03-15T10:30:00+08:00');   // 风火家人，动爻 1
  // 本卦 上巽 下离；互卦 上离 下坎 → 火水未济
  assert.equal(r.interName, '火水未济');
  assert.equal(r.interHexagram.upper, '离');
  assert.equal(r.interHexagram.lower, '坎');
  // 动爻 1（下卦）→ 体 = 上卦（巽）→ 互之体 = 互上卦（离）、用 = 互下卦（坎）
  assert.equal(r.interTiGua.name, '离');
  assert.equal(r.interYongGua.name, '坎');
  assert.equal(r.changedTiGua.name, r.tiGua.name);     // changedTiGua ≡ 体卦
  assert.equal(r.changedYongGua.name, r.changedHexagram.lower);   // 动爻在下卦 → 变卦下卦为用
});

test('⑭ 关系命名「动作者在前」与比和写法', () => {
  // 用一套构造：巽木为体（动爻 1，体=上巽），互下坎水、互上离火
  const r = run('2024-03-15T10:30:00+08:00');
  assert.equal(r.analysis.inter1Relation, '原体生体互');   // 木生火（体互=离火）
  assert.equal(r.analysis.inter2Relation, '用互生原体');   // 水（用互=坎水）生木
  assert.equal(r.analysis.changedRelation, '体克用');       // 木克土（变卦用侧=艮土）
  assert.equal(r.analysis.changedTiYongRelation, r.analysis.changedRelation);
});

// ===========================================================================
// 四、纯函数性 / 确定性 / 抛错路径
// ===========================================================================

test('⑮ 纯函数性：同输入同输出；除 meta.calculatedAt 外无时间成分', () => {
  const a = run('2024-03-15T10:30:00+08:00');
  const b = run('2024-03-15T10:30:00+08:00');
  assert.equal(stableStringify(a), stableStringify(b));
  assert.equal(a.meta.calculatedAt, FIXED_NOW.toISOString());
  const c = generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', now: new Date('2026-01-01T00:00:00Z') });
  const a2 = { ...a, meta: { ...a.meta, calculatedAt: c.meta.calculatedAt } };
  assert.equal(stableStringify(a2), stableStringify(c));
});

test('⑯ 时区无关：Z 与 +08:00 写法等价', () => {
  const a = run('2024-03-15T02:30:00Z');
  const b = run('2024-03-15T10:30:00+08:00');
  assert.equal(stableStringify({ ...a, meta: undefined }), stableStringify({ ...b, meta: undefined }));
  assert.equal(a.ganzhi.hour, '丁巳');
});

test('⑰ stripInternal：不落内部字段；meta 自研值形状正确', () => {
  const r = stripInternal(run('2024-03-15T10:30:00+08:00'));
  for (const k of ['timestamp', 'evidenceAnalysis', 'prompt', 'calculationContext', 'positionSources', 'calculationChain', 'sources']) {
    assert.equal(k in r, false, `不应含内部字段 ${k}`);
  }
  assert.equal(r.meta.engineVersion, '0.1.0-mingli');
  assert.equal(r.meta.schemaVersion, '1.0.0');
  assert.equal(r.meta.algorithm, 'meihua');
  assert.equal(r.meta.resultId, `meihua:${r.meta.inputHash}`);
});

test('⑱ 抛错路径：缺 customDate / 非法日期 / 随机模式 / 非法报数 / 未知方式', () => {
  assert.throws(() => generateMeihuaCore(undefined), (e) => e instanceof PaipanInputError && e.code === 'missing_custom_date');
  assert.throws(() => generateMeihuaCore({}), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateMeihuaCore({ customDate: 'x' }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { seed: 1 } }), (e) => e.code === 'random_mode_unsupported');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { replay: [1, 2] } }), (e) => e.code === 'random_mode_unsupported');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'random' } }), (e) => e.code === 'random_mode_unsupported');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'number' } }), (e) => e.code === 'bad_numbers');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'number', number: 0 } }), (e) => e.code === 'bad_numbers');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'number', number: -3 } }), (e) => e.code === 'bad_numbers');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'number', number: 1.5 } }), (e) => e.code === 'bad_numbers');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'number', number: 2 ** 53 } }), (e) => e.code === 'bad_numbers');
  assert.throws(() => generateMeihuaCore({ customDate: '2024-03-15T10:30:00+08:00', settings: { method: 'coins' } }), (e) => e.code === 'unknown_method');
});

test('⑲ 各段可独立调用（③段只吃①②产物，可单测）', () => {
  const normalized = normalizeInput({ customDate: '2024-03-15T10:30:00+08:00' });
  assert.equal(normalized.method, 'time');
  const calendar = resolveCalendar(normalized);
  const cast = castMeihua(normalized, calendar);
  assert.equal(cast.upperIndex, 5);
  const chart = computeTiYong({ cast, calendar });
  assert.equal(chart.main.name, '风火家人');
  assert.equal(chart.tiName, '巽');
  assert.equal(chart.yongName, '离');
  assert.equal(chart.relation, '体生用');
  // 卦名查询函数
  assert.equal(guaByTrigramIndex(1, 1).name, '乾为天');
  assert.equal(guaByTrigramIndex(5, 3).name, '风火家人');
  assert.throws(() => guaByTrigramIndex(9, 1), (e) => e.code === 'bad_trigram_index');
});

test('⑳ 趋势判定式：初吉&终吉→中克体则中途多阻，否则始末顺畅；其余分支', () => {
  // 直接以五行关系驱动：体木、用木（比和=吉）、变卦火（体生用=凶）
  assert.equal(timelineTrend('木', { yong: '木', tiInter: '木', yongInter: '木', changed: '火' }).trend, '先顺后阻');
  assert.equal(timelineTrend('木', { yong: '木', tiInter: '木', yongInter: '木', changed: '木' }).trend, '始末顺畅');
  assert.equal(timelineTrend('木', { yong: '木', tiInter: '金', yongInter: '木', changed: '木' }).trend, '中途多阻');
  assert.equal(timelineTrend('木', { yong: '火', tiInter: '木', yongInter: '木', changed: '木' }).trend, '先难后易');
  assert.equal(timelineTrend('木', { yong: '火', tiInter: '木', yongInter: '木', changed: '金' }).trend, '平稳演进');
  assert.equal(timelineTrend('木', { yong: '火', tiInter: '金', yongInter: '木', changed: '金' }).trend, '始终受制');
  // 含「平」（体克用）→ 看中段
  assert.equal(timelineTrend('木', { yong: '土', tiInter: '木', yongInter: '木', changed: '木' }).trend, '平稳演进');
  assert.equal(timelineTrend('木', { yong: '土', tiInter: '金', yongInter: '木', changed: '木' }).trend, '中途多阻');
});

test('㉑ 关键字段全部可从 stripInternal 结果取到（防「字段名漂移」）', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools', 'fixtures', 'meihua.json'), 'utf8'));
  const r = stripInternal(run('2024-03-15T10:30:00+08:00'));
  const missing = [];
  for (const f of doc.defaultKeyFields) {
    if (getPath(r, f) === undefined) missing.push(f);
  }
  assert.deepEqual(missing, [], `关键字段取不到: ${missing.join(', ')}`);
});

test('㉒ 卦辞/爻辞为信息性字段：长度与取用规则正确（内容来自公网采源，非旧实现节选）', () => {
  const r = run('2024-03-15T10:30:00+08:00');
  assert.equal(typeof r.mainHexagram.description, 'string');
  assert.ok(r.mainHexagram.description.length > 0);
  assert.equal(r.mainHexagram.yaoCi.length, 6);
  assert.equal(r.changedHexagram.yaoCi.length, 6);
  assert.equal(r.interHexagram.yaoCi.length, 6);
  // movingYaoCi = yaoCi[movingYao.position - 1]（1-based）
  assert.equal(r.mainHexagram.movingYaoCi, r.mainHexagram.yaoCi[r.movingYao.position - 1]);
  // 用九/用六：仅乾坤两卦有值（公有领域《周易》原文）
  assert.equal(r.mainHexagram.yongCi, undefined);
  const qian = run('2024-01-11T14:00:00+08:00');
  assert.equal(qian.originalName, '乾为天');
  assert.equal(qian.mainHexagram.yongCi, '见群龙无首，吉');
  const kun = run('2024-01-06T14:00:00+08:00');
  assert.equal(kun.originalName, '坤为地');
  assert.equal(kun.mainHexagram.yongCi, '利永贞');
});

test('㉓ 两卦象简写完整（八纯卦 + 乾/坤特殊写法）', () => {
  // 未时（时支序 8）必为八纯卦：上卦序 ≡ 下卦序
  const r = run('2024-01-11T14:00:00+08:00');
  assert.equal(r.mainHexagram.upper, r.mainHexagram.lower);
  assert.equal(r.mainHexagram.symbol, '☰☰');
  const kun = run('2024-01-06T14:00:00+08:00');
  assert.equal(kun.mainHexagram.symbol, '☷☷');
});
