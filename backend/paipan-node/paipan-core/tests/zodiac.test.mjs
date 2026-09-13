/**
 * 命理 · 自研排盘内核 · 单测 · 生肖流年（zodiac）
 * ---------------------------------------------------------------------------
 * 断言里的期望值全部来自对拍门禁 PASSED 的实测结果（黑盒探针 + run-compare 100%），
 * 不是从旧实现源码抄来的。纪律：零触网、零真实时钟、零本地时区依赖。
 *
 * 运行：node paipan-core/tests/zodiac.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateZodiacYearFortuneCore,
  getYearTaiSuiCore,
  normalizeInput,
  PaipanInputError,
} from '../src/capabilities/zodiac/index.js';
import {
  TAI_SUI_CONFLICT_ORDER,
  ZODIAC_ANIMALS,
  ZODIAC_BRANCHES,
  ZODIAC_RULES,
  baselineRelations,
  liuHePartner,
  sanHeGroup,
  sanHuiGroup,
  sanXingName,
  taiSuiName,
  tianYiPartners,
  yearGanZhi,
  yearTaiSui,
} from '../src/rules/zodiac.js';
import { stripInternal } from '../src/pipeline/index.js';

test('规则表：12 生肖与 12 地支一一对应，全部冻结', () => {
  assert.equal(ZODIAC_ANIMALS.length, 12);
  assert.equal(ZODIAC_BRANCHES.length, 12);
  assert.ok(Object.isFrozen(ZODIAC_RULES) && Object.isFrozen(ZODIAC_ANIMALS) && Object.isFrozen(TAI_SUI_CONFLICT_ORDER));
  assert.deepEqual([...TAI_SUI_CONFLICT_ORDER], ['值太岁', '冲太岁', '刑太岁', '害太岁', '破太岁']);
  assert.deepEqual(ZODIAC_BRANCHES, ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
});

test('年干支＝按年份直接推六十甲子（不看立春），越界抛错', () => {
  assert.equal(yearGanZhi(1900), '庚子');
  assert.equal(yearGanZhi(1924), '甲子');
  assert.equal(yearGanZhi(1984), '甲子');
  assert.equal(yearGanZhi(2026), '丙午');
  assert.equal(yearGanZhi(2043), '癸亥');
  for (const bad of [1899, 2201, 0, -5, 2026.5, '2026', null, undefined]) {
    assert.throws(() => yearGanZhi(bad), RangeError);
  }
});

test('已知样例写死断言：鼠遇丙午年（2026）', () => {
  const out = calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 2026 });
  assert.equal(out.zodiac, '鼠');
  assert.equal(out.zodiacBranch, '子');
  assert.equal(out.yearGanZhi, '丙午');
  assert.equal(out.yearBranch, '午');
  assert.equal(out.relation, '生肖地支本气克年干五行');
  assert.deepEqual(out.elementRelation, {
    kind: '生肖克年干',
    label: '生肖地支本气克年干五行',
    classification: '中性关系',
    yearStemWuxing: '火',
    zodiacWuxing: '水',
  });
  assert.equal(out.noble, '三合：猴、龙；六合：牛');
  assert.equal(out.meeting, null);
  assert.deepEqual(out.conflicts, [{ type: '冲太岁', with: '午', desc: out.conflicts[0].desc }]);
  assert.equal(out.zodiacWuxing, '水（子）');
  // 天乙贵人随**流年年干**（丙 → 猪、鸡，次序照口诀「丙丁猪鸡位」）
  assert.deepEqual(Object.keys(out.nobleDetail), ['天乙贵人']);
  assert.equal(out.nobleDetail['天乙贵人'].partners, '猪、鸡');
  // 结构：stripInternal 后与生产契约一致（无 evidenceAnalysis / prompt）
  const stripped = stripInternal(out);
  assert.deepEqual(Object.keys(stripped), [
    'zodiacBranch', 'zodiac', 'yearGanZhi', 'yearBranch', 'relation', 'elementRelation', 'noble', 'meeting',
    'conflicts', 'evidenceGrade', 'interpretationBoundary', 'favorableRelations', 'riskRelations',
    'actionSignals', 'nobleDetail', 'relationCopy', 'zodiacWuxing',
  ]);
});

test('六合 / 三合 / 三会 命中时的 noble 与 meeting（对拍实测口径）', () => {
  const he = calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 1925 }); // 乙丑：子丑六合 + 亥子丑三会
  assert.equal(he.yearGanZhi, '乙丑');
  assert.equal(he.noble, '六合贵人');
  assert.equal(he.meeting, '三会关系（北方水）');
  assert.deepEqual(Object.keys(he.nobleDetail), ['六合', '天乙贵人']);
  assert.equal(he.nobleDetail.六合.partner, '牛');

  const san = calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 1928 }); // 戊辰：申子辰三合水局
  assert.equal(san.noble, '三合贵人（水局）');
  assert.equal(san.meeting, null);
  assert.deepEqual(Object.keys(san.nobleDetail), ['三合', '天乙贵人']);
  assert.equal(san.nobleDetail.三合.partners, '猴、龙');

  // 未命中六合/三合时 nobleDetail 只留天乙贵人（对拍实测）
  const plain = calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 1930 }); // 庚午：冲太岁
  assert.equal(plain.noble, '三合：猴、龙；六合：牛');
  assert.deepEqual(Object.keys(plain.nobleDetail), ['天乙贵人']);
});

test('太岁五关系与固定次序（值→冲→刑→害→破）', () => {
  const cases = [
    ['鼠', 1924, ['值太岁']],            // 甲子：子子
    ['鼠', 1930, ['冲太岁']],            // 庚午：子午冲
    ['鼠', 1927, ['刑太岁']],            // 丁卯：子卯无礼之刑
    ['鼠', 1931, ['害太岁']],            // 辛未：子未害
    ['鼠', 1933, ['破太岁']],            // 癸酉：子酉破
    ['牛', 1943, ['冲太岁', '刑太岁']],  // 癸未：丑未冲 + 恃势之刑
    ['猪', 1935, ['值太岁', '刑太岁']],  // 乙亥：亥亥自刑
  ];
  for (const [zodiac, year, types] of cases) {
    const out = calculateZodiacYearFortuneCore({ zodiac, year });
    assert.deepEqual(out.conflicts.map((c) => c.type), types, `${zodiac}/${year}`);
    for (const c of out.conflicts) assert.equal(c.with, out.yearBranch);
  }
});

test('三合局伙伴次序＝长生→帝旺→墓（对拍实测 12 生肖全表）', () => {
  const expected = {
    鼠: ['申', '辰'], 牛: ['巳', '酉'], 虎: ['午', '戌'], 兔: ['亥', '未'],
    龙: ['申', '子'], 蛇: ['酉', '丑'], 马: ['寅', '戌'], 羊: ['亥', '卯'],
    猴: ['子', '辰'], 鸡: ['巳', '丑'], 狗: ['寅', '午'], 猪: ['卯', '未'],
  };
  for (const [zodiac, branches] of Object.entries(expected)) {
    const idx = ZODIAC_ANIMALS.indexOf(zodiac);
    const group = sanHeGroup(ZODIAC_BRANCHES[idx]);
    const got = group.partners.filter((b) => b !== ZODIAC_BRANCHES[idx]);
    // 校验集合与次序（未去重前 partners 已排除自身）
    assert.deepEqual([...got].sort(), [...branches].sort(), `${zodiac} 三合集合`);
  }
  assert.deepEqual(sanHeGroup('子').partners, ['申', '辰']);
  assert.deepEqual(sanHeGroup('丑').partners, ['巳', '酉']);
  assert.deepEqual(sanHeGroup('寅').partners, ['午', '戌']);
  assert.deepEqual(sanHeGroup('巳').partners, ['酉', '丑']);
  assert.deepEqual(sanHeGroup('辰').partners, ['申', '子']);
  assert.deepEqual(sanHeGroup('戌').partners, ['寅', '午']);
  assert.deepEqual(sanHeGroup('未').partners, ['亥', '卯']);
  assert.deepEqual(sanHeGroup('酉').partners, ['巳', '丑']);
});

test('三会 / 六合 / 三刑 判定表', () => {
  assert.equal(sanHuiGroup('子').name, '北方水');
  assert.equal(sanHuiGroup('卯').name, '东方木');
  assert.equal(sanHuiGroup('午').name, '南方火');
  assert.equal(sanHuiGroup('酉').name, '西方金');
  assert.equal(liuHePartner('子'), '丑');
  assert.equal(liuHePartner('申'), '巳');
  assert.equal(sanXingName('子', '卯'), '无礼之刑');
  assert.equal(sanXingName('寅', '巳'), '恃势之刑');
  assert.equal(sanXingName('丑', '未'), '无恩之刑');
  assert.equal(sanXingName('亥', '亥'), '自刑');
  assert.equal(sanXingName('子', '子'), null);
  assert.equal(sanXingName('寅', '寅'), null);
});

test('天乙贵人：按口诀书写次序，年干未收录返回 null', () => {
  assert.deepEqual(tianYiPartners('甲').animals, ['牛', '羊']);
  assert.deepEqual(tianYiPartners('辛').animals, ['马', '虎']);
  assert.deepEqual(tianYiPartners('丙').animals, ['猪', '鸡']);
  assert.deepEqual(tianYiPartners('壬').animals, ['兔', '蛇']);
  assert.deepEqual(tianYiPartners('乙').animals, ['鼠', '猴']);
  assert.equal(tianYiPartners('X'), null);
});

test('值年太岁星君：60 甲子名与 getYearTaiSuiCore 形状', () => {
  assert.equal(taiSuiName('甲子'), '金辨');
  assert.equal(taiSuiName('丙午'), '文哲');
  assert.equal(taiSuiName('甲辰'), '李诚');
  assert.equal(taiSuiName('癸亥'), '虞程');
  assert.deepEqual(yearTaiSui('丙午'), { yearBranch: '午', star: '文哲' });
  assert.deepEqual(getYearTaiSuiCore('丙午'), { yearBranch: '午', star: '文哲' });
  assert.deepEqual(getYearTaiSuiCore('甲子'), { yearBranch: '子', star: '金辨' });
  for (const bad of ['丙', '丙午未', '', 'XX', undefined, null, 123, '甲丑']) {
    assert.throws(() => getYearTaiSuiCore(bad), (err) => err instanceof PaipanInputError && err.code === 'invalid_ganzhi');
  }
  // 60 甲子名互不重复
  const names = [];
  for (let i = 0; i < 60; i += 1) {
    const gz = `${'甲乙丙丁戊己庚辛壬癸'[i % 10]}${ZODIAC_BRANCHES[i % 12]}`;
    names.push(taiSuiName(gz));
  }
  assert.equal(new Set(names).size, 60);
});

test('抛错路径与纯函数性：缺输入/非法生肖/越界年份，同输入同输出', () => {
  assert.throws(() => calculateZodiacYearFortuneCore(undefined), (err) => err.code === 'missing_zodiac');
  assert.throws(() => calculateZodiacYearFortuneCore({ year: 2026 }), (err) => err.code === 'missing_zodiac');
  assert.throws(() => calculateZodiacYearFortuneCore({ zodiac: '猫', year: 2026 }), (err) => err.code === 'unknown_zodiac');
  assert.throws(() => calculateZodiacYearFortuneCore({ zodiac: ' 鼠 ', year: 2026 }), (err) => err.code === 'unknown_zodiac');
  assert.throws(() => calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 1899 }), (err) => err.code === 'year_out_of_range');
  assert.throws(() => calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 2026.5 }), (err) => err.code === 'year_out_of_range');

  const params = { zodiac: '龙', year: 2024 };
  const a = calculateZodiacYearFortuneCore(params);
  const b = calculateZodiacYearFortuneCore(params);
  assert.deepEqual(a, b);
  assert.deepEqual(params, { zodiac: '龙', year: 2024 });
  const normalized = normalizeInput({ zodiac: '龙', year: 2024 });
  assert.deepEqual(normalized, { zodiac: '龙', branch: '辰', year: 2024, yearGanZhiText: '甲辰' });
});

test('基线风险关系（未命中太岁冲突时的生肖固定关系）', () => {
  assert.deepEqual(baselineRelations('鼠'), ['相冲：马', '相害：羊', '相破：鸡', '相刑：兔（无礼之刑）']);
  // 注：丑戌未为「无恩之刑」（寅巳申才是恃势之刑）。旧实现在此把丑的刑名写成「恃势之刑」且次序为「狗、羊」；
  // 该串属本内核自撰的提示文案（信息性字段，不进关键字段），故按传统刑名与地支次序写「羊、狗（无恩之刑）」，
  // 差异已在 rules/zodiac.js 与本报告登记。
  assert.deepEqual(baselineRelations('牛'), ['相冲：羊', '相害：马', '相破：龙', '相刑：羊、狗（无恩之刑）']);
  assert.deepEqual(baselineRelations('虎'), ['相冲：猴', '相害：蛇', '相破：猪', '相刑：蛇、猴（恃势之刑）']);
});
