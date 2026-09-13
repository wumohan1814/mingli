/**
 * 命理 · 自研排盘内核 · 六爻（liuyao）单测（node:test）
 * ===========================================================================
 * 运行：cd backend/paipan-node && node paipan-core/tests/liuyao.test.mjs
 *
 * 纪律（README §6）：
 *   - 不触网、不读磁盘、不依赖真实时钟（凡涉及 meta.calculatedAt 处一律注入固定 now）。
 *   - 关键约定写死断言（值来自「黑盒对拍实测 + 明文传统规则」而非猜测），约定一变测试先红。
 *   - 纯函数性：同输入同输出；meta.calculatedAt 之外无时间/随机成分。
 *
 * 断言里的「实测值」来源：vendor 旧实现黑盒探针（只运行不读源码），
 * 见 tools/_probe/ 下的 gen155 / probe155 / cmp155 系列脚本与 out/_gen-report 系列产物。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateLiuyaoCore,
  normalizeInput,
  resolveCalendar,
  castByTime,
  installHexagram,
  hourGanZhiFromDay,
  PaipanInputError,
} from '../src/capabilities/liuyao/index.js';
import {
  GUA_TABLE,
  PALACE_SEQUENCE,
  TRIGRAMS,
  TRIGRAM_BY_INDEX,
  TRIGRAM_BY_PATTERN,
  GUA_BY_INDEX,
  TRIGRAM_ORDER,
  SIX_GODS,
  SIX_GOD_START,
  LIUHE_GUA,
  LIUCHONG_GUA,
  ZHI_ELEMENT,
  SHENG,
  KE,
  LIU_HE,
  LIU_HAI,
  XING_TYPE_BY_BRANCH,
  SANHE_GROUPS,
  TWELVE_PALACE_SEQUENCE,
  CHANGSHENG_START,
  guaFromYangLines,
  guaNameOf,
  najiaBranches,
  respondPosition,
  sixRelativeOf,
  sixGodsOfDay,
  seasonStateOf,
  twelvePalaceOf,
  voidBranchesOf,
  advanceRetreatOf,
  changeRelationOf,
  sanXingInBranches,
  sanheWith,
  specialPatternOf,
  SPECIAL_ADVICE,
} from '../src/rules/liuyao.js';
import { stripInternal, getPath, stableStringify, fnv1aHash } from '../src/pipeline/index.js';

/** 固定 now，保证测试完全确定性。 */
const FIXED_NOW = new Date('2020-01-01T00:00:00.000Z');

/** 便捷调用：手工爻值。 */
const castManual = (customDate, yaos) => generateLiuyaoCore({ customDate, options: { yaos }, now: FIXED_NOW });

// ===========================================================================
// 一、规则表逐字断言（让「规则漂移」在 CI 层就炸）
// ===========================================================================

test('① 64 卦表完整性：64 条、卦名与上下卦简写一致、八宫各 8 卦、世应相差三位', () => {
  assert.equal(Object.keys(GUA_TABLE).length, 64);
  const SH = { 乾: '天', 兑: '泽', 离: '火', 震: '雷', 巽: '风', 坎: '水', 艮: '山', 坤: '地' };

  for (const [name, info] of Object.entries(GUA_TABLE)) {
    const pureName = `${info.upper}为${SH[info.upper]}`;
    // 八纯卦写作「X为Y」（如 乾为天），其余写作「上简写+下简写」+ 卦义后缀（如 天泽履、泽风大过）
    const isPure = info.upper === info.lower && name === pureName;
    const expected = isPure ? pureName : SH[info.upper] + SH[info.lower];
    assert.ok(name.startsWith(expected), `卦名与上下卦不一致: ${name}（期望以 ${expected} 开头）`);
    assert.ok(GUA_BY_INDEX[`${TRIGRAM_ORDER.indexOf(info.upper)},${TRIGRAM_ORDER.indexOf(info.lower)}`] === name);
    assert.equal(respondPosition(info.world), info.world <= 3 ? info.world + 3 : info.world - 3);
  }
  // 八宫每宫 8 卦、八阶齐全
  for (const [palace, seq] of Object.entries(PALACE_SEQUENCE)) {
    assert.equal(seq.length, 8, `${palace} 宫应为 8 卦`);
    for (const g of seq) assert.equal(GUA_TABLE[g].palace, palace);
  }
  assert.equal(Object.keys(PALACE_SEQUENCE).length, 8);
});

test('② 六爻阴阳位串 → 上下卦（对拍实测推导，0 不一致）', () => {
  // 000=坤 001=艮 010=坎 011=巽 100=震 101=离 110=兑 111=乾
  assert.deepEqual(TRIGRAM_BY_PATTERN, ['坤', '艮', '坎', '巽', '震', '离', '兑', '乾']);
  const cases = [
    [[false, false, false, false, false, false], '坤为地'],
    [[true, true, true, true, true, true], '乾为天'],
    [[true, true, false, false, false, false], '地泽临'],   // 初爻、二爻阳
    [[true, false, true, false, true, false], '水火既济'],
    [[true, false, false, false, true, false], '水雷屯'],
  ];
  for (const [yangs, expected] of cases) {
    assert.equal(guaFromYangLines(yangs).name, expected);
  }
  assert.equal(guaNameOf('坎', '震'), '水雷屯');
  assert.equal(guaNameOf('巽', '巽'), '巽为风');
  // 64 种组合全部落到 64 卦表里（双射）
  const seen = new Set();
  for (let mask = 0; mask < 64; mask += 1) {
    const yangs = [];
    for (let i = 0; i < 6; i += 1) yangs.push(!!(mask & (1 << i)));
    const g = guaFromYangLines(yangs);
    assert.ok(GUA_TABLE[g.name], `卦表缺 ${g.name}`);
    seen.add(g.name);
  }
  assert.equal(seen.size, 64);
});

test('③ 八卦纳甲表逐字断言（公开传统纳甲；与旧实现 64 卦实测一致）', () => {
  const expected = {
    乾: ['子寅辰', '午申戌'], 兑: ['巳卯丑', '亥酉未'], 离: ['卯丑亥', '酉未巳'], 震: ['子寅辰', '午申戌'],
    巽: ['丑亥酉', '未巳卯'], 坎: ['寅辰午', '申戌子'], 艮: ['辰午申', '戌子寅'], 坤: ['未巳卯', '丑亥酉'],
  };
  for (const [tri, [inner, outer]] of Object.entries(expected)) {
    assert.equal(TRIGRAMS[tri].inner.join(''), inner, `${tri} 内卦纳甲`);
    assert.equal(TRIGRAMS[tri].outer.join(''), outer, `${tri} 外卦纳甲`);
  }
  // 全 64 卦纳甲 = [下卦.inner, 上卦.outer]
  for (const [name, info] of Object.entries(GUA_TABLE)) {
    assert.equal(najiaBranches(info.upper, info.lower).join(''),
      `${TRIGRAMS[info.lower].inner.join('')}${TRIGRAMS[info.upper].outer.join('')}`, name);
  }
  assert.equal(najiaBranches('坤', '坤').join(''), '未巳卯丑亥酉');
  assert.equal(najiaBranches('乾', '乾').join(''), '子寅辰午申戌');
  assert.equal(najiaBranches('坎', '震').join(''), '子寅辰申戌子');
});

test('④ 六亲规则：宫五行 × 爻支五行（384 点实测 0 不一致）', () => {
  for (const [name, info] of Object.entries(GUA_TABLE)) {
    const pe = TRIGRAMS[info.palace].element;
    for (const z of najiaBranches(info.upper, info.lower)) {
      const e = ZHI_ELEMENT[z];
      let expected;
      if (pe === e) expected = '兄弟';
      else if (SHENG[pe] === e) expected = '子孙';
      else if (KE[pe] === e) expected = '妻财';
      else if (SHENG[e] === pe) expected = '父母';
      else expected = '官鬼';
      assert.equal(sixRelativeOf(pe, z), expected, `${name} ${z}`);
    }
  }
});

test('⑤ 六神：序列固定 + 日干起神（甲乙青龙/丙丁朱雀/戊勾陈/己螣蛇/庚辛白虎/壬癸玄武）', () => {
  assert.deepEqual(SIX_GODS, ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']);
  assert.equal(SIX_GOD_START.甲, '青龙');
  assert.equal(SIX_GOD_START.丁, '朱雀');
  assert.equal(SIX_GOD_START.戊, '勾陈');
  assert.equal(SIX_GOD_START.己, '螣蛇');
  assert.equal(SIX_GOD_START.辛, '白虎');
  assert.equal(SIX_GOD_START.癸, '玄武');
  assert.deepEqual(sixGodsOfDay('戊'), ['勾陈', '螣蛇', '白虎', '玄武', '青龙', '朱雀']);
  assert.deepEqual(sixGodsOfDay('甲'), ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']);
});

test('⑥ 空亡：ZHI[(日支索引−日干索引+10)%12] 与其 +1 位（实测口径）', () => {
  assert.deepEqual(voidBranchesOf('戊寅'), ['申', '酉']);   // 实测（甲方口径，非通行旬空表）
  assert.deepEqual(voidBranchesOf('己酉'), ['寅', '卯']);
  assert.deepEqual(voidBranchesOf('癸卯'), ['辰', '巳']);
  assert.deepEqual(voidBranchesOf('甲子'), ['戌', '亥']);
  assert.deepEqual(voidBranchesOf('丙申'), ['辰', '巳']);
});

test('⑦ 月建旺衰：12 个月支 × 5 行（标准五行生克，实测 60 点全中）', () => {
  // 与月支五行同 → 旺；月支生 → 相；生月支 → 休；克月支 → 囚；被月支克 → 死
  const expect = {
    子: { 水: '旺', 木: '相', 金: '休', 土: '囚', 火: '死' },
    丑: { 土: '旺', 金: '相', 火: '休', 水: '死', 木: '囚' },
    寅: { 木: '旺', 火: '相', 水: '休', 金: '囚', 土: '死' },
    卯: { 木: '旺', 火: '相', 水: '休', 金: '囚', 土: '死' },
    辰: { 土: '旺', 金: '相', 火: '休', 水: '死', 木: '囚' },
    巳: { 火: '旺', 土: '相', 木: '休', 水: '囚', 金: '死' },
    午: { 火: '旺', 土: '相', 木: '休', 水: '囚', 金: '死' },
    未: { 土: '旺', 金: '相', 火: '休', 水: '死', 木: '囚' },
    申: { 金: '旺', 水: '相', 土: '休', 火: '囚', 木: '死' },
    酉: { 金: '旺', 水: '相', 土: '休', 火: '囚', 木: '死' },
    戌: { 土: '旺', 金: '相', 火: '休', 水: '死', 木: '囚' },
    亥: { 水: '旺', 木: '相', 金: '休', 土: '囚', 火: '死' },
  };
  const ZHI_SAMPLE = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  for (const [mz, table] of Object.entries(expect)) {
    for (const [zhi, e] of Object.entries(ZHI_SAMPLE)) {
      assert.equal(seasonStateOf(mz, zhi), table[e], `${mz}月 ${zhi}(${e})`);
    }
  }
});

test('⑧ 十二宫：阳干顺行（水/土长生申、木长生亥、火长生寅、金长生巳）', () => {
  assert.deepEqual(CHANGSHENG_START, { 水: '申', 土: '申', 木: '亥', 火: '寅', 金: '巳' });
  assert.equal(TWELVE_PALACE_SEQUENCE[0], '长生');
  assert.equal(TWELVE_PALACE_SEQUENCE[11], '养');
  // 实测样例（丙寅/己酉 日：坎为水六爻）
  assert.equal(twelvePalaceOf('卯'), '帝旺');
  assert.equal(twelvePalaceOf('丑'), '衰');
  assert.equal(twelvePalaceOf('亥'), '临官');
  assert.equal(twelvePalaceOf('申'), '临官');
  assert.equal(twelvePalaceOf('戌'), '冠带');
  assert.equal(twelvePalaceOf('子'), '帝旺');
});

test('⑨ 六合/六冲/六害/三刑 名表逐字断言', () => {
  assert.equal(LIU_HE.子, '丑');
  assert.equal(LIU_HE.午, '未');
  assert.equal(LIU_HE.巳, '申');
  assert.equal(LIU_HAI.子, '未');
  assert.equal(LIU_HAI.丑, '午');
  assert.equal(XING_TYPE_BY_BRANCH.寅, '无恩之刑');
  assert.equal(XING_TYPE_BY_BRANCH.丑, '恃势之刑');
  assert.equal(XING_TYPE_BY_BRANCH.子, '无礼之刑');
  assert.equal(XING_TYPE_BY_BRANCH.亥, '自刑');
  // 六冲卦 10 卦（对拍实测名单）
  assert.deepEqual([...LIUCHONG_GUA].sort(), ['乾为天', '兑为泽', '离为火', '震为雷', '巽为风', '坎为水', '艮为山', '坤为地', '雷天大壮', '天雷无妄'].sort());
  // 六合卦 8 卦
  assert.deepEqual([...LIUHE_GUA].sort(), ['天地否', '地天泰', '雷地豫', '地雷复', '泽水困', '水泽节', '山火贲', '火山旅'].sort());
  // 三合局 4 组
  assert.deepEqual(SANHE_GROUPS.map((g) => g.name), ['火局', '木局', '金局', '水局']);
  // 三刑：三支齐备者成局；自刑需同一支出现两次
  assert.deepEqual(sanXingInBranches(['寅', '巳', '申', '寅', '巳', '申']).map((x) => x.type), ['无恩之刑']);
  assert.deepEqual(sanXingInBranches(['卯', '丑', '亥', '丑', '亥', '酉']).map((x) => x.type), ['自刑']);
  assert.deepEqual(sanXingInBranches(['子', '卯', '子', '卯', '子', '卯']).map((x) => x.type), ['无礼之刑']);
});

test('⑩ 化进神/化退神：同五行之支按十二支索引大小（实测 8 组全中）', () => {
  assert.equal(advanceRetreatOf('丑', '辰'), '化进神');
  assert.equal(advanceRetreatOf('辰', '丑'), '化退神');
  assert.equal(advanceRetreatOf('未', '戌'), '化进神');
  assert.equal(advanceRetreatOf('戌', '未'), '化退神');
  assert.equal(advanceRetreatOf('寅', '卯'), '化进神');
  assert.equal(advanceRetreatOf('卯', '寅'), '化退神');
  assert.equal(advanceRetreatOf('申', '酉'), '化进神');
  assert.equal(advanceRetreatOf('酉', '申'), '化退神');
  // 异五行 / 同支 → null
  assert.equal(advanceRetreatOf('子', '卯'), null);
  assert.equal(advanceRetreatOf('子', '子'), null);
});

test('⑪ 变爻关系：回头冲优先，回头生/克、化泄/耗、比和、化空', () => {
  assert.deepEqual(changeRelationOf('亥', '巳', false), { relation: '回头冲', relations: ['回头冲', '化耗'] });
  assert.deepEqual(changeRelationOf('酉', '卯', false), { relation: '回头冲', relations: ['回头冲', '化耗'] });
  assert.deepEqual(changeRelationOf('丑', '午', false), { relation: '回头生', relations: ['回头生'] });
  assert.deepEqual(changeRelationOf('丑', '寅', false), { relation: '回头克', relations: ['回头克'] });
  assert.deepEqual(changeRelationOf('午', '丑', false), { relation: '化泄', relations: ['化泄'] });
  assert.deepEqual(changeRelationOf('午', '酉', false), { relation: '化耗', relations: ['化耗'] });
  assert.deepEqual(changeRelationOf('辰', '丑', false), { relation: '比和', relations: ['比和'] });
  assert.deepEqual(changeRelationOf('丑', '辰', true), { relation: '化空', relations: ['比和', '化空'] });
});

test('⑫ 特殊卦形：静卦 / 全动卦 / 乾卦用九 / 坤卦用六', () => {
  assert.equal(specialPatternOf([7, 8, 7, 8, 7, 8], '离为火'), '静卦');
  assert.equal(specialPatternOf([9, 9, 9, 9, 9, 9], '乾为天'), '乾卦用九');
  assert.equal(specialPatternOf([6, 6, 6, 6, 6, 6], '坤为地'), '坤卦用六');
  assert.equal(specialPatternOf([6, 9, 6, 9, 6, 9], '火水未济'), '全动卦');
  assert.equal(specialPatternOf([9, 8, 8, 8, 8, 8], '天风姤'), undefined);
  assert.equal(SPECIAL_ADVICE.静卦.length > 0, true);
  assert.equal(SPECIAL_ADVICE.全动卦.length > 0, true);
});

test('⑬ 时干支五鼠遁（含晚子时按「子」计）', () => {
  assert.equal(hourGanZhiFromDay('戊寅', 10), '丁巳');
  assert.equal(hourGanZhiFromDay('戊寅', 13), '己未');
  assert.equal(hourGanZhiFromDay('戊寅', 8), '丙辰');
  assert.equal(hourGanZhiFromDay('丁丑', 23), '庚子');
  assert.equal(hourGanZhiFromDay('丁丑', 0), '庚子');
});

test('⑬b 时支序口径：整点小时按「上一时辰」（实测：01:30 为丑时、13:30 为未时）', () => {
  assert.equal(hourGanZhiFromDay('戊寅', 1), '癸丑');
  assert.equal(hourGanZhiFromDay('戊寅', 2), '癸丑');
  assert.equal(hourGanZhiFromDay('戊寅', 3), '甲寅');
  assert.equal(hourGanZhiFromDay('戊寅', 14), '己未');
  assert.equal(hourGanZhiFromDay('戊寅', 15), '庚申');
});

// ===========================================================================
// 二、已知样例写死断言（对拍实测 + 传统纳甲/六亲/世应 手工复核）
// ===========================================================================

test('⑭ 样例 A：2023-06-08T14:20+08:00 + 爻值 [7,9,8,9,8,8] → 雷泽归妹（兑金归魂）', () => {
  const r = castManual('2023-06-08T14:20:00+08:00', [7, 9, 8, 9, 8, 8]);
  assert.equal(r.originalName, '雷泽归妹');
  assert.equal(r.changedName, '地雷复');
  assert.equal(r.interName, '水火既济');
  assert.deepEqual(r.yaoArray, [7, 9, 8, 9, 8, 8]);
  assert.deepEqual(r.changingYaos, [{ position: 2, isChanging: true, type: '老阳' }, { position: 4, isChanging: true, type: '老阳' }]);
  assert.deepEqual(r.sixRelatives, ['官鬼', '妻财', '父母', '官鬼', '兄弟', '父母']);
  assert.deepEqual(r.najiaDizhi, ['巳', '卯', '丑', '午', '申', '戌']);
  assert.deepEqual(r.wuxing, ['火', '木', '土', '火', '金', '土']);
  assert.deepEqual(r.worldAndResponse, ['', '', '世', '', '', '应']);
  assert.deepEqual(r.voidBranches, ['辰', '巳']);
  assert.deepEqual(r.palace, { name: '兑', wuxing: '金' });
  assert.equal(r.palaceStage, '归魂');
  assert.deepEqual(r.sixGods, ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙']);
  assert.deepEqual(r.ganzhi, { year: '癸卯', month: '戊午', day: '丁酉', hour: '丁未' });
  assert.equal(r.generation.method, 'manual');
  assert.deepEqual(r.generation.coinThrows, []);
  // 逐爻细节抽查
  assert.equal(r.yaosDetail[0].seasonState, '旺');       // 巳火 在午月（火旺）
  assert.equal(r.yaosDetail[1].shiErGong, '帝旺');       // 卯木：长生亥 → 卯为帝旺
  assert.equal(r.yaosDetail[3].isChanging, true);
  assert.equal(r.yaosDetail[3].changeType, '老阳');
  assert.equal(r.sixRelatives[5], '父母');
});

test('⑮ 样例 B：2024-03-15T10:30+08:00 + 爻值 [8,7,8,8,9,8] → 坎为水（五爻老阳动 → 地水师）', () => {
  const r = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  assert.equal(r.originalName, '坎为水');
  assert.equal(r.changedName, '地水师');
  assert.equal(r.interName, '山雷颐');
  assert.deepEqual(r.sixRelatives, ['子孙', '官鬼', '妻财', '父母', '官鬼', '兄弟']);
  assert.deepEqual(r.najiaDizhi, ['寅', '辰', '午', '申', '戌', '子']);
  assert.deepEqual(r.wuxing, ['木', '土', '火', '金', '土', '水']);
  assert.deepEqual(r.worldAndResponse, ['', '', '应', '', '', '世']);
  assert.deepEqual(r.voidBranches, ['申', '酉']);          // 戊寅日 → 甲戌旬 → 申酉
  assert.equal(r.palace.wuxing, '水');
  assert.equal(r.palaceStage, '首卦');
  assert.equal(r.hexagramRelations.original, '六冲卦');
  assert.equal(r.hexagramRelations.changed, null);
  assert.deepEqual(r.fanfuRelations.labels, []);
  assert.equal(r.yaosDetail[3].isVoid, true);              // 申 落空亡
  assert.equal(r.yaosDetail[3].isDayClash, true);          // 申 冲 寅日
  assert.equal(r.yaosDetail[4].isChanging, true);
  assert.equal(r.yaosDetail[4].changeType, '老阳');
  assert.equal(r.yaosDetail[4].changedYao.dizhi, '亥');
  assert.equal(r.yaosDetail[4].changedYao.wuxing, '水');
  assert.equal(r.yaosDetail[4].changedYao.liuqin, '兄弟');
});

test('⑯ 样例 C：手工铜钱记录（method=coins）→ 六爻与 yaoArray 一致且回显 coinThrows', () => {
  const coinThrows = [[2, 3, 3], [3, 2, 2], [3, 3, 2], [3, 2, 3], [3, 3, 3], [3, 3, 2]]
    .map((coins) => ({ coins, total: coins.reduce((a, b) => a + b, 0) }));
  const r = generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { method: 'coins', coinThrows }, now: FIXED_NOW });
  assert.equal(r.generation.method, 'coins');
  assert.deepEqual(r.yaoArray, [8, 7, 8, 8, 9, 8]);
  assert.deepEqual(r.yaoArray, coinThrows.map((t) => t.total));
  assert.deepEqual(r.generation.coinThrows, coinThrows);
  // 与手工爻值路径结果一致（同一六爻 → 同一卦）
  const manual = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  assert.equal(r.originalName, manual.originalName);
  assert.deepEqual(r.sixRelatives, manual.sixRelatives);
});

test('⑰ 六爻全动：乾为天 → 用九 + 乱动卦；坤为地 → 用六（不记乱动）', () => {
  const qian = castManual('2023-06-08T14:20:00+08:00', [9, 9, 9, 9, 9, 9]);
  assert.equal(qian.originalName, '乾为天');
  assert.equal(qian.changedName, '坤为地');
  assert.equal(qian.specialPattern, '乾卦用九');
  assert.equal(qian.isChaotic, false);                     // 实测：用九不记乱动
  assert.equal(qian.hexagramRelations.transition, '六冲变六冲');  // 全动且同属性 → 记值
  const kun = castManual('2023-06-08T14:20:00+08:00', [6, 6, 6, 6, 6, 6]);
  assert.equal(kun.originalName, '坤为地');
  assert.equal(kun.specialPattern, '坤卦用六');
  assert.equal(kun.isChaotic, false);
  const other = castManual('2023-06-08T14:20:00+08:00', [6, 9, 6, 9, 6, 9]);
  assert.equal(other.specialPattern, '全动卦');
  assert.equal(other.isChaotic, true);
  assert.ok(typeof other.chaoticReason === 'string' && other.chaoticReason.length > 0);
});

// ===========================================================================
// 三、历法/边界
// ===========================================================================

test('⑱ 早晚子时：23:00 起换日；早子时同日', () => {
  const early = castManual('1990-05-12T00:30:00+08:00', [7, 7, 7, 7, 7, 7]);
  const late = castManual('1990-05-12T23:30:00+08:00', [7, 7, 7, 7, 7, 7]);
  assert.equal(early.ganzhi.day, '丁丑');
  assert.equal(late.ganzhi.day, '戊寅');                   // 晚子时换日
  assert.equal(early.ganzhi.hour, '庚子');
  assert.equal(late.ganzhi.hour, '壬子');
});

test('⑲ 立春精确时刻换年/换月（前后 10 分钟内成对）', () => {
  const before = castManual('2000-02-04T20:30:00+08:00', [7, 7, 7, 7, 7, 7]);
  const after = castManual('2000-02-04T20:41:00+08:00', [7, 7, 7, 7, 7, 7]);
  assert.equal(before.ganzhi.year, '己卯');
  assert.equal(before.ganzhi.month, '丁丑');
  assert.equal(after.ganzhi.year, '庚辰');
  assert.equal(after.ganzhi.month, '戊寅');
  assert.equal(before.originalName, after.originalName);   // 六爻相同 → 卦相同，日月只影响旺衰/空亡
});

test('⑳ 闰月与跨年代（1900 / 2033 端点不抛错，形状完整）', () => {
  for (const iso of ['1900-06-15T08:30:00+08:00', '2023-03-25T09:15:00+08:00', '2033-12-31T23:50:00+08:00']) {
    const r = castManual(iso, [7, 8, 7, 8, 7, 8]);
    assert.equal(Object.keys(r.yaosDetail).length, 6);
    assert.equal(r.yaoArray.length, 6);
    assert.equal(r.sixRelatives.length, 6);
    assert.equal(r.sixGods.length, 6);
    assert.equal(r.voidBranches.length, 2);
    assert.match(r.ganzhi.year, /^[\u4e00-\u9fa5]{2}$/);
    assert.match(r.ganzhi.month, /^[\u4e00-\u9fa5]{2}$/);
  }
});

// ===========================================================================
// 四、纯函数性 / 确定性 / stripInternal / 抛错路径
// ===========================================================================

test('㉑ 纯函数性：同输入同输出；meta.calculatedAt 之外无时间成分', () => {
  const a = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  const b = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  assert.equal(stableStringify(a), stableStringify(b));
  // 注入不同 now 时，除 calculatedAt 外全同
  const c = generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { yaos: [8, 7, 8, 8, 9, 8] }, now: new Date('2026-01-01T00:00:00Z') });
  const a2 = { ...a, meta: { ...a.meta, calculatedAt: c.meta.calculatedAt } };
  assert.equal(stableStringify(a2), stableStringify(c));
  assert.equal(a.meta.calculatedAt, FIXED_NOW.toISOString());   // 唯一时间戳 = 注入值
});

test('㉒ 时区无关：同一绝对时刻用不同 ISO 写法得到同一结果（Z 与 +08:00）', () => {
  const a = castManual('2024-03-15T02:30:00Z', [8, 7, 8, 8, 9, 8]);          // = 10:30+08:00
  const b = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  assert.equal(stableStringify({ ...a, meta: undefined }), stableStringify({ ...b, meta: undefined }));
  assert.equal(a.ganzhi.hour, '丁巳');
  // epoch 毫秒形态同样等价
  const c = castManual(Date.UTC(2024, 2, 15, 2, 30, 0), [8, 7, 8, 8, 9, 8]);
  assert.equal(c.ganzhi.hour, '丁巳');
});

test('㉓ stripInternal：内部字段不落生产契约（timestamp/evidenceAnalysis 等）', () => {
  const r = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  const stripped = stripInternal(r);
  for (const k of ['timestamp', 'evidenceAnalysis', 'prompt', 'calculationContext', 'positionSources', 'calculationChain', 'sources']) {
    assert.equal(k in stripped, false, `不应含内部字段 ${k}`);
  }
  assert.equal(getPath(stripped, 'meta.calculatedAt'), FIXED_NOW.toISOString());
  assert.ok(stripped.meta.inputHash.length > 0);
  assert.equal(stripped.meta.resultId, `liuyao:${stripped.meta.inputHash}`);
});

test('㉔ 抛错路径：缺 customDate / 非法日期 / 非法爻值 / 非法铜钱 / 非法 method', () => {
  assert.throws(() => generateLiuyaoCore(undefined), (e) => e instanceof PaipanInputError && e.code === 'missing_custom_date');
  assert.throws(() => generateLiuyaoCore({}), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateLiuyaoCore({ customDate: null }), (e) => e.code === 'missing_custom_date');
  assert.throws(() => generateLiuyaoCore({ customDate: 'not-a-date' }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-13-01T00:00:00+08:00' }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-02-30T00:00:00+08:00' }), (e) => e.code === 'invalid_custom_date');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { yaos: [7, 8, 9] } }), (e) => e.code === 'bad_yaos');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { yaos: [7, 8, 9, 6, 7, 5] } }), (e) => e.code === 'bad_yaos');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { method: 'coins', coinThrows: [[2, 2, 2]] } }), (e) => e.code === 'bad_coin_throws');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { method: 'coins' } }), (e) => e.code === 'bad_coin_throws');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { method: 'manual' } }), (e) => e.code === 'bad_yaos');
  assert.throws(() => generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: { method: 'x' } }), (e) => e.code === 'unknown_method');
  // 铜钱合计与 total 不一致
  assert.throws(() => generateLiuyaoCore({
    customDate: '2024-03-15T10:30:00+08:00',
    options: { method: 'coins', coinThrows: [[2, 2, 2], [2, 2, 2], [2, 2, 2], [2, 2, 2], [2, 2, 2], { coins: [2, 2, 2], total: 9 }] },
  }), (e) => e.code === 'bad_coin_throws');
});

test('㉕ 时间起卦（确定性口径）：同输入同输出，且六爻由年月日时起卦法推出', () => {
  const a = generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: {}, now: FIXED_NOW });
  const b = generateLiuyaoCore({ customDate: '2024-03-15T10:30:00+08:00', options: {}, now: FIXED_NOW });
  assert.equal(a.generation.method, 'time');
  assert.equal(stableStringify(a), stableStringify(b));
  assert.deepEqual(a.yaoArray, b.yaoArray);
  // 与 castByTime 直接调用一致（纯函数可复算）
  const normalized = normalizeInput({ customDate: '2024-03-15T10:30:00+08:00' });
  const calendar = resolveCalendar(normalized);
  const cast = castByTime(calendar, normalized.wall);
  assert.deepEqual(a.yaoArray, cast.yaos);
  assert.equal(cast.yaos.filter((v) => v === 6 || v === 9).length, 1);   // 单动爻
});

test('㉖ installHexagram 可独立调用（③段只吃①-②产物，可单测）', () => {
  const normalized = normalizeInput({ customDate: '2023-06-08T14:20:00+08:00' });
  const calendar = resolveCalendar(normalized);
  const chart = installHexagram({ yaos: [7, 9, 8, 9, 8, 8], calendar });
  assert.equal(chart.main.name, '雷泽归妹');
  assert.equal(chart.changed.name, '地雷复');
  assert.equal(chart.inter.name, '水火既济');
  assert.equal(chart.world, 3);
  assert.equal(chart.response, 6);
  assert.equal(chart.yaosDetail.length, 6);
});

test('㉗ 引擎版本与 schema 版本（信息性差异：engineVersion 自研、schemaVersion 与旧实现一致）', () => {
  const r = castManual('2024-03-15T10:30:00+08:00', [8, 7, 8, 8, 9, 8]);
  assert.equal(r.meta.engineVersion, '0.1.0-mingli');
  assert.equal(r.meta.schemaVersion, '1.0.0');
  assert.equal(r.meta.algorithm, 'liuyao');
});

test('㉘ 关键字段全部可从 stripInternal 结果取到（防「字段名漂移」）', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools', 'fixtures', 'liuyao.json'), 'utf8'));
  const r = stripInternal(castManual('2023-06-08T14:20:00+08:00', [7, 9, 8, 9, 8, 8]));
  const missing = [];
  for (const f of doc.defaultKeyFields) {
    // 仅校验「本内核应产出」的路径（以下字段在部分爻位组合下天然不存在：
    //  specialPattern / specialAdvice 仅在静卦或六爻全动时才有值；changingYaos 仅在有动爻时存在）
    if (f === 'specialPattern' || f === 'specialAdvice' || f.startsWith('changingYaos')) continue;
    const v = getPath(r, f);
    if (v === undefined) missing.push(f);
  }
  assert.deepEqual(missing, [], `关键字段取不到: ${missing.join(', ')}`);
});

test('㉙ fnv1aHash / stableStringify 确定性（哈希只依赖输入内容）', () => {
  assert.equal(fnv1aHash('liuyao'), fnv1aHash('liuyao'));
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  assert.notEqual(fnv1aHash('a'), fnv1aHash('b'));
});
