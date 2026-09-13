/**
 * 命理 · 自研排盘内核 · 单测：雷诺曼抽牌（lenormand）
 * ===========================================================================
 * 覆盖对象：`src/capabilities/lenormand/index.js` 的 `drawLenormandSpreadCore` 与
 * `src/rules/lenormand.js` 的规则表（36 张牌组 / 8 个牌阵 / 九宫与大桌几何 / 发牌口径）。
 *
 * 纪律：
 *   - 零网络、零时钟依赖、禁用 `Math.random`（随机源一律注入 `seed`/`replay`/
 *     `interactiveSamples`/`manualCardIds`，时间一律注入 `now`）。
 *   - 已知样例为**写死**断言（不"再算一遍"）；牌名/牌位名/宫名逐字断言。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  drawLenormandSpreadCore,
  PaipanInputError,
} from '../src/capabilities/lenormand/index.js';
import {
  LENORMAND_CARD_NAMES,
  LENORMAND_COMPARABLE_SPREADS,
  LENORMAND_DECK,
  LENORMAND_DECK_SIZE,
  LENORMAND_DRAW_RULES,
  LENORMAND_HOUSES,
  LENORMAND_SPREADS,
  lenormandLayoutOf,
  lenormandFnv1a32,
} from '../src/rules/lenormand.js';
import { LENORMAND_MEANINGS } from '../src/rules/lenormand-meanings.js';

/** 固定时钟（一律注入，禁时钟依赖）。 */
const NOW = new Date('2026-01-01T00:00:00.000Z');

/** 全部牌阵键（来自规则表本身，不手抄）。 */
const SPREAD_KEYS = Object.keys(LENORMAND_SPREADS);

/** 带 row/column 的牌阵。 */
const GRID_KEYS = ['nine'];

/** 带 row/column/house 的牌阵。 */
const GRAND_KEYS = ['grandTableau'];

/** 顶层键序（契约：`combinations` / `layoutEvidence` 位于 `cards` 与 `meta` 之间）。 */
const TOP_KEYS = ['spreadType', 'spreadName', 'draw', 'cards', 'combinations', 'layoutEvidence', 'meta'];

/** 无布局牌阵的 cards 键序。 */
const CARD_KEYS_PLAIN = ['id', 'name', 'keywords', 'meaning', 'theme', 'detail', 'position'];

/** 九宫（grid3）的 cards 键序（多 row / column）。 */
const CARD_KEYS_GRID = [...CARD_KEYS_PLAIN, 'row', 'column'];

/** 大桌的 cards 键序（多 house / row / column）。 */
const CARD_KEYS_GRAND = [...CARD_KEYS_PLAIN, 'house', 'row', 'column'];

/** 一条相邻合读的 9 个键（顺序即契约）。 */
const COMBINATION_KEYS = [
  'card1', 'card2', 'position1', 'position2', 'relation', 'rowDistance', 'columnDistance', 'meaning', 'source',
];

/** `relation` 合法取值。 */
const RELATIONS = ['牌序相邻', '横向相邻', '纵向相邻', '对角相邻'];

/** 无布局牌阵（`combinations` 条数 = 牌位数 - 1）。 */
const PLAIN_KEYS = ['single', 'three', 'five', 'relationship', 'decision', 'element'];

/**
 * 九宫（满格 3×3）的 `combinations` 条数 = 20（结构常量，与抽到哪几张牌无关）。
 * 大桌条数**不是常量**（= 人物牌男士/女士的 Moore 邻域对数，随 seed 变化，如 seed 3 → 13、
 * seed 123 → 10），故不写死在此表，改由盘面几何自算（见 `grandTableauNeighborCount`）。
 */
const GRID_COMBINATION_COUNT = { nine: 20 };

/** 取某牌阵 cards 的期望键序。 */
function expectedCardKeys(key) {
  if (GRAND_KEYS.includes(key)) return CARD_KEYS_GRAND;
  if (GRID_KEYS.includes(key)) return CARD_KEYS_GRID;
  return CARD_KEYS_PLAIN;
}

/** 非空字符串断言。 */
function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} 必须是字符串`);
  assert.ok(value.length > 0, `${label} 不得为空串`);
}

/** 3 个非空字符串的关键词数组断言。 */
function assertKeywordTriple(value, label) {
  assert.ok(Array.isArray(value), `${label} 必须是数组`);
  assert.equal(value.length, 3, `${label} 必须是 3 个关键词`);
  value.forEach((word, i) => assertNonEmptyString(word, `${label}[${i}]`));
}

/** 统一入口：注入固定 now。 */
function run(spreadType, options) {
  return drawLenormandSpreadCore({ spreadType, options, now: NOW });
}

/** 捕获抛出的错误（用于逐字断言 name / code）。 */
function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('预期抛出 PaipanInputError，但未抛出任何错误。');
}

/** 断言抛错并校验 name / code（assert.throws + 显式断言）。 */
function expectPaipanError(fn, code) {
  assert.throws(fn, { name: 'PaipanInputError', code });
  const error = captureError(fn);
  assert.equal(error.name, 'PaipanInputError');
  assert.equal(error.code, code);
  assert.ok(error instanceof PaipanInputError);
}

/** 取 draw.order 的卡号序列。 */
function idsOf(result) {
  return result.draw.order.map((entry) => entry.cardId);
}

/* =========================================================================
 * 一、规则表
 * ======================================================================= */

test('规则表：雷诺曼规则表与牌组深度冻结（含内层数组）', () => {
  assert.equal(Object.isFrozen(LENORMAND_SPREADS), true);
  assert.equal(Object.isFrozen(LENORMAND_SPREADS.nine), true);
  assert.equal(Object.isFrozen(LENORMAND_SPREADS.nine.positions), true);
  assert.equal(Object.isFrozen(LENORMAND_SPREADS.grandTableau.positions), true);
  assert.equal(Object.isFrozen(LENORMAND_SPREADS.three.positions), true);
  assert.equal(Object.isFrozen(LENORMAND_DECK), true);
  assert.equal(Object.isFrozen(LENORMAND_DECK[0]), true);
  assert.equal(Object.isFrozen(LENORMAND_CARD_NAMES), true);
  assert.equal(Object.isFrozen(LENORMAND_HOUSES), true);
  assert.equal(Object.isFrozen(LENORMAND_DRAW_RULES), true);
  assert.equal(Object.isFrozen(LENORMAND_COMPARABLE_SPREADS), true);
});

test('规则表：LENORMAND_DECK 共 36 张且牌名逐字抽查', () => {
  assert.equal(LENORMAND_DECK.length, 36);
  assert.equal(LENORMAND_DECK_SIZE, 36);
  assert.equal(LENORMAND_DECK[0].name, '骑士');
  assert.equal(LENORMAND_DECK[0].house, '骑士');
  assert.equal(LENORMAND_DECK[35].name, '十字架');
  assert.equal(LENORMAND_DECK[35].house, '十字架');
  assert.equal(LENORMAND_CARD_NAMES[4], '树');
  assert.equal(LENORMAND_CARD_NAMES[11], '鸟');
  assert.equal(LENORMAND_CARD_NAMES[21], '路');
  assert.equal(LENORMAND_CARD_NAMES[29], '百合');
  // 数组下标 = id - 1，且 house 恒等于牌名（大桌宫名与牌名同序）
  LENORMAND_DECK.forEach((card, i) => {
    assert.equal(card.id, i + 1);
    assert.equal(card.house, card.name);
    assert.equal(LENORMAND_HOUSES[i], card.name);
  });
});

test('规则表：牌阵表名称、牌位数与牌位名逐字抽查', () => {
  assert.equal(LENORMAND_SPREADS.nine.name, '九宫牌阵');
  assert.equal(LENORMAND_SPREADS.nine.positions.length, 9);
  assert.equal(LENORMAND_SPREADS.nine.positions[4], '核心');
  assert.equal(LENORMAND_SPREADS.nine.cardCount, 9);
  assert.equal(LENORMAND_SPREADS.single.name, '单牌线索');
  assert.deepEqual(LENORMAND_SPREADS.single.positions, ['核心线索']);
  assert.deepEqual(LENORMAND_SPREADS.three.positions, ['起因', '现状', '走向']);
  assert.equal(LENORMAND_SPREADS.grandTableau.positions[0], '第1宫（骑士宫）');
  assert.equal(LENORMAND_SPREADS.grandTableau.positions[35], '第36宫（十字架宫）');
  assert.equal(LENORMAND_SPREADS.grandTableau.cardCount, 36);
  assert.equal(LENORMAND_COMPARABLE_SPREADS.length, 8);
  assert.deepEqual([...LENORMAND_COMPARABLE_SPREADS], SPREAD_KEYS);
  SPREAD_KEYS.forEach((key) => {
    assert.equal(LENORMAND_SPREADS[key].cardCount, LENORMAND_SPREADS[key].positions.length);
  });
});

test('规则表：LENORMAND_DRAW_RULES 口径常量与再导出的 fnv1a32', () => {
  assert.equal(LENORMAND_DRAW_RULES.deckSize, 36);
  assert.equal(LENORMAND_DRAW_RULES.shuffleSamples, 35);
  assert.equal(LENORMAND_DRAW_RULES.samplesPerCard, 0);
  assert.equal(LENORMAND_DRAW_RULES.hasOrientation, false);
  assert.equal(LENORMAND_DRAW_RULES.interactiveSamplesPerCard, 1);
  // 与塔罗共用同一份随机源实现（再导出）
  assert.equal(lenormandFnv1a32('1'), 0x340ca71c);
  assert.equal(lenormandFnv1a32('0'), 0x350ca8af);
});

/* =========================================================================
 * 二、已知样例（写死断言）
 * ======================================================================= */

test('已知样例：single seed 1 → 22 号「路」/ 核心线索', () => {
  const result = run('single', { seed: 1 });
  // 盘面事实逐字段断言（整对象 deepEqual 会随正文键增减而失效，故不整对象比对）
  assert.equal(result.cards[0].id, 22);
  assert.equal(result.cards[0].name, '路');
  assert.equal(result.cards[0].position, '核心线索');
  assert.deepEqual(Object.keys(result.cards[0]), CARD_KEYS_PLAIN);
  assert.equal(result.cards[0].meaning, LENORMAND_MEANINGS[22].meaning);
  assert.equal(result.cards[0].theme, LENORMAND_MEANINGS[22].theme);
  assert.deepEqual(result.cards[0].keywords, [...LENORMAND_MEANINGS[22].keywords]);
  assert.equal(result.draw.order[0].cardId, 22);
  assert.equal(result.draw.order[0].cardName, '路');
  assert.equal(result.meta.random.samples.length, 35);
});

test('已知样例：three seed 1 → 22,10,26', () => {
  const result = run('three', { seed: 1 });
  assert.deepEqual(idsOf(result), [22, 10, 26]);
  assert.equal(result.cards.length, 3);
});

test('已知样例：five seed 1 → 22,10,26,21,27', () => {
  const result = run('five', { seed: 1 });
  assert.deepEqual(idsOf(result), [22, 10, 26, 21, 27]);
});

test('已知样例：element seed 1 → 22,10,26,21', () => {
  const result = run('element', { seed: 1 });
  assert.deepEqual(idsOf(result), [22, 10, 26, 21]);
  assert.deepEqual(result.cards.map((card) => card.position), ['火（行动/能量）', '水（情感/直觉）', '风（思维/沟通）', '土（物质/根基）']);
});

test('已知样例：nine seed 1 → 22,10,26,21,27,9,16,3,1', () => {
  const result = run('nine', { seed: 1 });
  assert.deepEqual(idsOf(result), [22, 10, 26, 21, 27, 9, 16, 3, 1]);
});

test('已知样例：nine seed 3 → 9,28,2,30,32,36,17,16,10 与九宫落点', () => {
  const result = run('nine', { seed: 3 });
  assert.deepEqual(idsOf(result), [9, 28, 2, 30, 32, 36, 17, 16, 10]);
  assert.equal(result.cards[0].row, 1);
  assert.equal(result.cards[0].column, 1);
  assert.equal(result.cards[3].row, 2);
  assert.equal(result.cards[3].column, 1);
  assert.equal(result.cards[8].row, 3);
  assert.equal(result.cards[8].column, 3);
  assert.equal('house' in result.cards[0], false);
});

test('已知样例：grandTableau seed 3 → 前六张与宫位、行列逐位一致', () => {
  const result = run('grandTableau', { seed: 3 });
  assert.deepEqual(idsOf(result).slice(0, 6), [9, 28, 2, 30, 32, 36]);
  assert.equal(result.cards[0].house, '骑士');
  assert.equal(result.cards[0].position, '第1宫（骑士宫）');
  assert.equal(result.cards[8].row, 1);
  assert.equal(result.cards[8].column, 9);
  assert.equal(result.cards[9].row, 2);
  assert.equal(result.cards[9].column, 1);
  assert.equal(result.cards[35].row, 4);
  assert.equal(result.cards[35].column, 9);
  assert.equal(result.cards[35].house, '十字架');
  assert.equal(result.cards[35].position, '第36宫（十字架宫）');
});

test('已知样例：grandTableau 36 张覆盖全牌组且卡号互不重复', () => {
  const result = run('grandTableau', { seed: 3 });
  assert.equal(result.cards.length, 36);
  const ids = idsOf(result);
  assert.equal(new Set(ids).size, 36);
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 36 }, (_, i) => i + 1));
  result.cards.forEach((card, i) => {
    assert.equal(card.name, LENORMAND_DECK[card.id - 1].name);
    assert.equal(card.house, LENORMAND_HOUSES[i]);
    assert.equal(card.position, `第${i + 1}宫（${LENORMAND_HOUSES[i]}宫）`);
  });
});

test('已知样例：three 逐张样本模式（0.2 / 0.4 / 0.6）→ 8,16,23', () => {
  const result = run('three', { interactiveSamples: [0.2, 0.4, 0.6] });
  assert.deepEqual(idsOf(result), [8, 16, 23]);
  assert.equal(result.meta.random.samples.length, 3);
  assert.deepEqual(result.meta.random.samples, [0.2, 0.4, 0.6]);
});

test('已知样例：three 手工录入 [5,12,30] → 树 / 鸟 / 百合 且无 meta.random', () => {
  const result = run('three', { manualCardIds: [5, 12, 30] });
  assert.deepEqual(idsOf(result), [5, 12, 30]);
  assert.deepEqual(result.cards.map((card) => card.name), ['树', '鸟', '百合']);
  assert.equal(result.meta.algorithm, 'lenormand.spread.manual');
  assert.equal('random' in result.meta, false);
});

test('已知样例：nine 手工录入 [9,8,7,6,5,4,3,2,1] → 逐位一致', () => {
  const result = run('nine', { manualCardIds: [9, 8, 7, 6, 5, 4, 3, 2, 1] });
  assert.deepEqual(idsOf(result), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(result.cards.map((card) => card.name), [
    '花束', '棺材', '蛇', '云', '树', '房子', '船', '三叶草', '骑士',
  ]);
  assert.equal('random' in result.meta, false);
  assert.equal(result.cards[0].row, 1);
  assert.equal(result.cards[0].column, 1);
  assert.equal(result.cards[8].row, 3);
  assert.equal(result.cards[8].column, 3);
});

/* =========================================================================
 * 三、纯函数性 / 确定性 / 不放回
 * ======================================================================= */

test('纯函数性：同入参两次调用结果深等，且传入的 options 未被改动', () => {
  const seeded = { seed: 7, question: '这段关系会如何发展' };
  const seededSnapshot = structuredClone(seeded);
  const firstSeeded = run('three', seeded);
  const secondSeeded = run('three', seeded);
  assert.deepEqual(secondSeeded, firstSeeded);
  assert.deepEqual(seeded, seededSnapshot);
  assert.equal('question' in firstSeeded, false);

  const interactive = { interactiveSamples: [0.2, 0.4, 0.6] };
  const interactiveSnapshot = structuredClone(interactive);
  assert.deepEqual(run('three', interactive), run('three', interactive));
  assert.deepEqual(interactive, interactiveSnapshot);

  const manual = { manualCardIds: [5, 12, 30] };
  const manualSnapshot = structuredClone(manual);
  assert.deepEqual(run('three', manual), run('three', manual));
  assert.deepEqual(manual, manualSnapshot);

  const replay = { replay: new Array(35).fill(0.3) };
  const replaySnapshot = structuredClone(replay);
  assert.deepEqual(run('nine', replay), run('nine', replay));
  assert.deepEqual(replay, replaySnapshot);
});

test('确定性等价：seed 1 与 "1"、seed 0 与 "0" 的 cards + draw 完全相同', () => {
  const numericOne = run('nine', { seed: 1 });
  const stringOne = run('nine', { seed: '1' });
  assert.deepEqual(stringOne.cards, numericOne.cards);
  assert.deepEqual(stringOne.draw, numericOne.draw);
  assert.deepEqual(stringOne.meta.random.samples, numericOne.meta.random.samples);

  const numericZero = run('nine', { seed: 0 });
  const stringZero = run('nine', { seed: '0' });
  assert.deepEqual(stringZero.cards, numericZero.cards);
  assert.deepEqual(stringZero.draw, numericZero.draw);
  assert.deepEqual(stringZero.meta.random.samples, numericZero.meta.random.samples);
});

test('不放回：每个牌阵 seed 123 的 draw.order 卡号互不重复', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    const ids = idsOf(result);
    assert.equal(ids.length, LENORMAND_SPREADS[key].cardCount);
    assert.equal(new Set(ids).size, ids.length, `${key} 出现重复卡号`);
  });
});

test('牌位填充：每个牌阵 cards 与 draw.order 与牌位表逐项对齐', () => {
  SPREAD_KEYS.forEach((key) => {
    const spread = LENORMAND_SPREADS[key];
    const result = run(key, { seed: 123 });
    assert.equal(result.cards.length, spread.positions.length);
    for (let i = 0; i < spread.positions.length; i += 1) {
      assert.equal(result.cards[i].position, spread.positions[i]);
      assert.equal(result.draw.order[i].position, result.cards[i].position);
      assert.equal(result.draw.order[i].index, i + 1);
      assert.equal(result.draw.order[i].cardId, result.cards[i].id);
      assert.equal(result.draw.order[i].cardName, result.cards[i].name);
      assert.equal(result.cards[i].name, LENORMAND_DECK[result.cards[i].id - 1].name);
    }
  });
});

test('replay 与 seeded 自洽：nine seed 7 的样本重放结果完全一致', () => {
  const seeded = run('nine', { seed: 7 });
  const replay = seeded.meta.random.samples.slice();
  assert.equal(replay.length, 35);
  const replayed = run('nine', { replay });
  assert.deepEqual(replayed.cards, seeded.cards);
  assert.deepEqual(replayed.draw, seeded.draw);
  // meta 侧有意不同：hashInput 含 mode（seeded / replay），故 resultId 只作信息性标识
  assert.equal(replayed.meta.random.mode, 'replay');
  assert.equal(seeded.meta.random.mode, 'seeded');
  assert.notEqual(replayed.meta.resultId, seeded.meta.resultId);
});

/* =========================================================================
 * 四、抛错路径
 * ======================================================================= */

test('抛错路径：缺随机源 → missing_seed', () => {
  expectPaipanError(() => run('three', {}), 'missing_seed');
  expectPaipanError(() => drawLenormandSpreadCore({ spreadType: 'single', now: NOW }), 'missing_seed');
  expectPaipanError(() => run('nine', { question: '没有给随机源' }), 'missing_seed');
});

test('抛错路径：未知牌阵键 → unknown_spread_type', () => {
  expectPaipanError(() => run('nonexistent', { seed: 1 }), 'unknown_spread_type');
  expectPaipanError(() => run('grandtableau', { seed: 1 }), 'unknown_spread_type');
  expectPaipanError(() => run(9, { seed: 1 }), 'invalid_spread_type');
  expectPaipanError(() => drawLenormandSpreadCore(undefined), 'invalid_params');
});

test('抛错路径：随机源冲突 → conflicting_random_source', () => {
  expectPaipanError(() => run('three', { seed: 1, replay: new Array(35).fill(0.1) }), 'conflicting_random_source');
  expectPaipanError(() => run('three', { seed: 1, manualCardIds: [5, 12, 30] }), 'conflicting_random_source');
  expectPaipanError(
    () => run('three', { manualCardIds: [5, 12, 30], interactiveSamples: [0.2, 0.4, 0.6] }),
    'conflicting_random_source',
  );
  expectPaipanError(
    () => run('three', { replay: new Array(35).fill(0.1), interactiveSamples: [0.2, 0.4, 0.6] }),
    'conflicting_random_source',
  );
});

test('抛错路径：手工录入牌号重复 / 越界 / 个数不符', () => {
  expectPaipanError(() => run('three', { manualCardIds: [5, 5, 30] }), 'duplicate_manual_cards');
  expectPaipanError(() => run('nine', { manualCardIds: [1, 2, 3, 4, 5, 6, 7, 8, 1] }), 'duplicate_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: [5, 12, 99] }), 'invalid_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: [0, 12, 30] }), 'invalid_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: [1.5, 12, 30] }), 'invalid_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: [5, 12] }), 'invalid_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: [5, 12, 30, 4] }), 'invalid_manual_cards');
  expectPaipanError(() => run('three', { manualCardIds: 'not-an-array' }), 'invalid_manual_cards');
});

test('抛错路径：逐张样本长度或取值非法 → invalid_interactive_samples', () => {
  expectPaipanError(() => run('three', { interactiveSamples: [0.2, 0.4] }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: [0.2, 0.4, 0.6, 0.8] }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: 'not-an-array' }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: [0.2, 1.5, 0.6] }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: [-0.5, 0.4, 0.6] }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: [0.2, 1, 0.6] }), 'invalid_interactive_samples');
});

test('抛错路径：replay 为空 / 长度不足 / 取值非法', () => {
  expectPaipanError(() => run('nine', { replay: [] }), 'invalid_replay');
  expectPaipanError(() => run('nine', { replay: 'not-an-array' }), 'invalid_replay');
  expectPaipanError(() => run('nine', { replay: new Array(34).fill(0.1) }), 'replay_exhausted');
  const bad = new Array(35).fill(0.1);
  bad[7] = 1.5;
  expectPaipanError(() => run('nine', { replay: bad }), 'invalid_replay');
  const nan = new Array(35).fill(0.1);
  nan[0] = Number.NaN;
  expectPaipanError(() => run('nine', { replay: nan }), 'invalid_replay');
});

test('抛错路径：seed / options 取值非法', () => {
  expectPaipanError(() => run('three', { seed: true }), 'invalid_seed');
  expectPaipanError(() => run('three', { seed: Number.POSITIVE_INFINITY }), 'invalid_seed');
  expectPaipanError(() => drawLenormandSpreadCore({ spreadType: 'three', options: 5, now: NOW }), 'invalid_options');
  expectPaipanError(() => drawLenormandSpreadCore({ spreadType: 'three', options: [], now: NOW }), 'invalid_options');
});

/* =========================================================================
 * 五、输出形状纪律 / meta
 * ======================================================================= */

test('输出形状纪律：顶层键序固定、不含 timestamp / evidenceAnalysis，cards 正文键序固定', () => {
  const forbiddenTop = ['timestamp', 'evidenceAnalysis'];
  const forbiddenCard = ['orientation', 'reversed', 'upright', 'reversedText', 'archetype', 'element'];
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    assert.deepEqual(Object.keys(result), TOP_KEYS, `${key} 顶层键序`);
    assert.deepEqual(Object.keys(result.draw), ['deckSize', 'method', 'order']);
    forbiddenTop.forEach((field) => assert.equal(field in result, false, `顶层出现 ${field}`));
    result.cards.forEach((card, i) => {
      assert.deepEqual(Object.keys(card), expectedCardKeys(key), `${key} cards[${i}] 键序`);
      forbiddenCard.forEach((field) => assert.equal(field in card, false, `cards 出现 ${field}`));
    });
  });
});

test('meta：版本、注入的 calculatedAt 与各模式 algorithm', () => {
  const seeded = run('single', { seed: 1 });
  assert.equal(seeded.meta.engineVersion, '0.1.0-mingli');
  assert.equal(seeded.meta.schemaVersion, '1.0.0');
  assert.equal(seeded.meta.calculatedAt, '2026-01-01T00:00:00.000Z');

  SPREAD_KEYS.forEach((key) => {
    assert.equal(run(key, { seed: 1 }).meta.algorithm, 'lenormand.spread');
    assert.equal(run(key, { seed: 1 }).meta.calculatedAt, '2026-01-01T00:00:00.000Z');
  });

  const interactive = run('three', { interactiveSamples: [0.2, 0.4, 0.6] });
  assert.equal(interactive.meta.algorithm, 'lenormand.spread.interactive');
  const manual = run('three', { manualCardIds: [5, 12, 30] });
  assert.equal(manual.meta.algorithm, 'lenormand.spread.manual');
  assert.equal(manual.meta.calculatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(manual.meta.resultId.startsWith('lenormand.spread.manual:'), true);
});

test('meta.random：seeded 回显原始 seed（数字与文本），manual 无该键', () => {
  const numeric = run('nine', { seed: 1 });
  assert.equal(numeric.meta.random.mode, 'seeded');
  assert.equal(numeric.meta.random.seed, 1);
  assert.equal(typeof numeric.meta.random.seed, 'number');

  const text = run('nine', { seed: '命理-seed' });
  assert.equal(text.meta.random.mode, 'seeded');
  assert.equal(text.meta.random.seed, '命理-seed');
  assert.equal(typeof text.meta.random.seed, 'string');

  const interactive = run('three', { interactiveSamples: [0.2, 0.4, 0.6] });
  assert.equal(interactive.meta.random.mode, 'system');
  assert.equal('seed' in interactive.meta.random, false);

  const manual = run('three', { manualCardIds: [5, 12, 30] });
  assert.equal('random' in manual.meta, false);
  assert.deepEqual(Object.keys(manual.meta), [
    'engineVersion', 'schemaVersion', 'algorithm', 'calculatedAt', 'inputHash', 'resultId',
  ]);
});

/* =========================================================================
 * 六、布局几何 / 全牌阵遍历
 * ======================================================================= */

test('布局几何：row/column/house 的存在性按牌阵区分', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    const expectHouse = GRAND_KEYS.includes(key);
    const expectRowColumn = expectHouse || GRID_KEYS.includes(key);
    result.cards.forEach((card, i) => {
      assert.equal('row' in card, expectRowColumn, `${key} card[${i}] row 存在性`);
      assert.equal('column' in card, expectRowColumn, `${key} card[${i}] column 存在性`);
      assert.equal('house' in card, expectHouse, `${key} card[${i}] house 存在性`);
      const layout = lenormandLayoutOf(LENORMAND_SPREADS[key].layout, i);
      // 只比对几何落点（cards 现已带牌义正文键，不能再整卡展开比对）
      assert.deepEqual(
        { row: card.row, column: card.column, house: card.house },
        { row: layout.row, column: layout.column, house: layout.house },
      );
      assert.equal(result.draw.order[i].row, card.row);
      assert.equal(result.draw.order[i].column, card.column);
      assert.equal(result.draw.order[i].house, card.house);
    });
  });
});

test('布局几何：九宫 3 列与大桌 9 列 × 4 行的换算', () => {
  assert.equal(LENORMAND_SPREADS.nine.layout, 'grid3');
  assert.equal(LENORMAND_SPREADS.grandTableau.layout, 'grandTableau');
  assert.equal(LENORMAND_SPREADS.single.layout, 'none');
  assert.deepEqual(lenormandLayoutOf('none', 0), {});
  assert.deepEqual(lenormandLayoutOf('grid3', 4), { row: 2, column: 2 });
  assert.deepEqual(lenormandLayoutOf('grandTableau', 35), { house: '十字架', row: 4, column: 9 });

  const nine = run('nine', { seed: 123 });
  nine.cards.forEach((card, i) => {
    assert.equal(card.row, Math.floor(i / 3) + 1);
    assert.equal(card.column, (i % 3) + 1);
  });
  const grand = run('grandTableau', { seed: 123 });
  grand.cards.forEach((card, i) => {
    assert.equal(card.row, Math.floor(i / 9) + 1);
    assert.equal(card.column, (i % 9) + 1);
  });
});

test('全牌阵遍历：每个牌阵 seed 123 正常发牌，牌位数与 deckSize 正确', () => {
  assert.equal(SPREAD_KEYS.length, 8);
  SPREAD_KEYS.forEach((key) => {
    const spread = LENORMAND_SPREADS[key];
    const result = run(key, { seed: 123 });
    assert.equal(result.spreadType, key);
    assert.equal(result.spreadName, spread.name);
    assert.ok(typeof result.spreadName === 'string' && result.spreadName.length > 0);
    assert.equal(result.cards.length, spread.positions.length);
    assert.equal(result.draw.deckSize, 36);
    assert.equal(result.draw.order.length, spread.positions.length);
    assert.equal(result.meta.random.samples.length, 35);
  });
});

test('样本消耗口径：seeded 恒 35 个样本，逐张模式 = 牌位数', () => {
  assert.equal(run('single', { seed: 1 }).meta.random.samples.length, 35);
  assert.equal(run('grandTableau', { seed: 1 }).meta.random.samples.length, 35);
  assert.equal(run('nine', { interactiveSamples: new Array(9).fill(0.5) }).meta.random.samples.length, 9);
  assert.equal(run('single', { interactiveSamples: [0.5] }).meta.random.samples.length, 1);
});

/* =========================================================================
 * 七、牌义正文覆盖（新契约：cards 带正文，顶层带 combinations / layoutEvidence）
 * ======================================================================= */

test('正文覆盖：LENORMAND_MEANINGS 覆盖 36 张、theme 两两不同且字段齐备、深度冻结', () => {
  assert.equal(LENORMAND_DECK.length, 36);
  assert.equal(Object.keys(LENORMAND_MEANINGS).length, 36);
  assert.equal(Object.isFrozen(LENORMAND_MEANINGS), true);
  assert.deepEqual(
    Object.keys(LENORMAND_MEANINGS).map(Number).sort((a, b) => a - b),
    Array.from({ length: 36 }, (_, i) => i + 1),
  );
  const themes = new Set();
  LENORMAND_DECK.forEach((card) => {
    const meaning = LENORMAND_MEANINGS[card.id];
    assert.ok(meaning, `牌 id ${card.id}（${card.name}）缺牌义正文`);
    assert.equal(Object.isFrozen(meaning), true, `${card.name} 牌义未冻结`);
    assertKeywordTriple(meaning.keywords, `${card.name}.keywords`);
    ['meaning', 'theme', 'detail'].forEach((field) => {
      assertNonEmptyString(meaning[field], `${card.name}.${field}`);
    });
    themes.add(meaning.theme);
  });
  assert.equal(themes.size, 36, `theme 必须两两不同（实际 ${themes.size} 个不同值）`);
});

test('正文覆盖：8 个牌阵发出的牌都带完整正文（keywords 3 个 / meaning / theme / detail）', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    assert.equal(result.cards.length, LENORMAND_SPREADS[key].cardCount);
    result.cards.forEach((card, i) => {
      const label = `${key} cards[${i}]`;
      assert.deepEqual(Object.keys(card), expectedCardKeys(key), `${label} 键序`);
      assertKeywordTriple(card.keywords, `${label}.keywords`);
      assertNonEmptyString(card.meaning, `${label}.meaning`);
      assertNonEmptyString(card.theme, `${label}.theme`);
      assertNonEmptyString(card.detail, `${label}.detail`);
      // 正文与冻结的牌义表逐字一致（发出的是拷贝而不是引用）
      const meaning = LENORMAND_MEANINGS[card.id];
      assert.deepEqual(card.keywords, [...meaning.keywords]);
      assert.equal(card.meaning, meaning.meaning);
      assert.equal(card.theme, meaning.theme);
      assert.equal(card.detail, meaning.detail);
    });
  });
});

/**
 * 大桌 `combinations` 期望条数 = 人物牌（男士 id 28 / 女士 id 29）在该盘面上的
 * **Moore 邻域对数**（同一盘内其它牌中 `|Δrow| ≤ 1 && |Δcolumn| ≤ 1` 的牌数，两张相加）。
 * 人物牌落在大桌边角时邻牌更少 ⇒ 该条数**随 seed 变化**，故一律从盘面几何自算，不写死。
 */
function grandTableauNeighborCount(result) {
  const persons = result.cards.filter((card) => card.id === 28 || card.id === 29);
  return persons.reduce((sum, person) => sum + result.cards.filter((card) => card.id !== person.id
    && Math.abs(card.row - person.row) <= 1
    && Math.abs(card.column - person.column) <= 1).length, 0);
}

/** 某牌阵 seed 下的 `combinations` 期望条数。 */
function expectedCombinationCount(key, result) {
  if (GRAND_KEYS.includes(key)) return grandTableauNeighborCount(result);
  if (GRID_KEYS.includes(key)) return GRID_COMBINATION_COUNT[key];
  return LENORMAND_SPREADS[key].cardCount - 1;
}

test('combinations：条数 / 9 键键序 / 文案与关系取值均合契约', () => {
  // 写死契约条数（无布局牌阵 = 牌位数 - 1；九宫满格 3×3 = 20，与抽到哪几张牌无关）
  const fixed = {
    single: 0, three: 2, five: 4, relationship: 4, decision: 5, element: 3, nine: 20,
  };
  Object.entries(fixed).forEach(([key, count]) => {
    const { combinations } = run(key, { seed: 123 });
    assert.ok(Array.isArray(combinations), `${key} combinations 必须是数组`);
    assert.equal(combinations.length, count, `${key} combinations 条数（seed 123）`);
  });
  // 无布局牌阵 = 牌位数 - 1（其余无布局阵一并核对）
  PLAIN_KEYS.forEach((key) => {
    assert.equal(
      run(key, { seed: 123 }).combinations.length,
      LENORMAND_SPREADS[key].cardCount - 1,
      `${key} combinations 条数（牌位数 - 1）`,
    );
  });
  // 「不能只对一个 seed 成立」：九宫在多个 seed 下恒为 20
  [0, 1, 3, 7, 123].forEach((seed) => {
    assert.equal(run('nine', { seed }).combinations.length, 20, `nine seed ${seed} combinations 条数`);
  });

  // 大桌：条数与「人物牌近身格对」逐条对齐（seed 3 → 13、seed 123 → 10，均从几何自算）
  [0, 1, 3, 7, 123].forEach((seed) => {
    const result = run('grandTableau', { seed });
    const persons = result.cards.filter((card) => card.id === 28 || card.id === 29);
    assert.equal(persons.length, 2, `grandTableau seed ${seed} 必须同时出现男士与女士`);
    const neighborsOf = (person) => result.cards.filter((card) => card.id !== person.id
      && Math.abs(card.row - person.row) <= 1
      && Math.abs(card.column - person.column) <= 1);
    assert.equal(
      result.combinations.length,
      grandTableauNeighborCount(result),
      `grandTableau seed ${seed} combinations 条数（人物牌 Moore 邻域对数）`,
    );
    // 每张人物牌参与的合读条数 = 它自己的近身格数（多算/漏算都会在此暴露）
    persons.forEach((person) => {
      const involved = result.combinations.filter(
        (entry) => entry.card1 === person.name || entry.card2 === person.name,
      );
      assert.equal(involved.length, neighborsOf(person).length,
        `grandTableau seed ${seed} ${person.name} 参与的合读条数应等于其近身格数`);
    });
    result.combinations.forEach((entry, i) => {
      const label = `grandTableau seed ${seed} combinations[${i}]`;
      assert.ok(
        persons.some((person) => person.name === entry.card1 || person.name === entry.card2),
        `${label} 必须至少涉及一张人物牌`,
      );
      assert.notEqual(entry.card1, entry.card2, `${label} 两张牌不得相同`);
      assert.ok(entry.rowDistance <= 1 && entry.columnDistance <= 1, `${label} 相邻距离不得大于 1`);
      assert.ok(entry.rowDistance + entry.columnDistance > 0, `${label} 不得落在同一格`);
    });
  });

  // 逐条形状 / 文案 / 关系取值（全部 8 个牌阵）
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    const names = result.cards.map((card) => card.name);
    const positions = result.cards.map((card) => card.position);
    assert.equal(
      result.combinations.length,
      expectedCombinationCount(key, result),
      `${key} combinations 条数`,
    );
    result.combinations.forEach((entry, i) => {
      const label = `${key} combinations[${i}]`;
      assert.deepEqual(Object.keys(entry), COMBINATION_KEYS, `${label} 键序`);
      assert.equal(entry.source, '相邻牌义合读', `${label}.source`);
      assertNonEmptyString(entry.meaning, `${label}.meaning`);
      assertNonEmptyString(entry.card1, `${label}.card1`);
      assertNonEmptyString(entry.card2, `${label}.card2`);
      assert.ok(names.includes(entry.card1), `${label}.card1 必须是本盘面出现的牌`);
      assert.ok(names.includes(entry.card2), `${label}.card2 必须是本盘面出现的牌`);
      assert.ok(positions.includes(entry.position1), `${label}.position1 必须是本牌阵的牌位`);
      assert.ok(positions.includes(entry.position2), `${label}.position2 必须是本牌阵的牌位`);
      assert.ok(RELATIONS.includes(entry.relation), `${label}.relation=${entry.relation} 非法`);
      assert.ok(Number.isInteger(entry.rowDistance) && entry.rowDistance >= 0, `${label}.rowDistance`);
      assert.ok(Number.isInteger(entry.columnDistance) && entry.columnDistance >= 0, `${label}.columnDistance`);
      if (LENORMAND_SPREADS[key].layout === 'none') {
        assert.equal(entry.relation, '牌序相邻', `${label}.relation（无布局牌阵）`);
        assert.equal(entry.rowDistance, 0, `${label}.rowDistance（无布局牌阵恒 0）`);
        assert.equal(entry.columnDistance, 0, `${label}.columnDistance（无布局牌阵恒 0）`);
      } else {
        // 网格牌阵：横向 0 行距 / 纵向 0 列距 / 对角两者皆 1
        assert.ok(entry.rowDistance <= 1 && entry.columnDistance <= 1, `${label} 相邻距离不得大于 1`);
        assert.ok(entry.rowDistance + entry.columnDistance > 0, `${label} 不得是同一个牌位`);
        if (entry.rowDistance === 0) assert.equal(entry.relation, '横向相邻', `${label}.relation`);
        else if (entry.columnDistance === 0) assert.equal(entry.relation, '纵向相邻', `${label}.relation`);
        else assert.equal(entry.relation, '对角相邻', `${label}.relation`);
      }
    });
  });
});

test('layoutEvidence：九宫 3 条 / 大桌 2–3 条 / 其余空数组，元素均为非空字符串', () => {
  // 九宫恒 3 条（中心主轴 / 横纵路径 / 对角线路径）。
  // 大桌为 2 条（男士近身 + 女士近身）+ 可选第 3 条（有「归宫牌」时才出现，故随 seed 变 2 或 3）：
  // 归宫 = 第 i+1 宫恰由牌组第 i 张牌占住（该牌落在以它命名的宫里）。
  const ownHouseCount = (result) => result.cards
    .filter((card, i) => LENORMAND_DECK[i] && card.id === LENORMAND_DECK[i].id).length;
  const expectedCount = {
    single: 0, three: 0, five: 0, relationship: 0, decision: 0, element: 0, nine: 3,
  };
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    const { layoutEvidence } = result;
    assert.ok(Array.isArray(layoutEvidence), `${key} layoutEvidence 必须是字符串数组`);
    const expected = key === 'grandTableau' ? 2 + (ownHouseCount(result) > 0 ? 1 : 0) : expectedCount[key];
    assert.equal(layoutEvidence.length, expected, `${key} layoutEvidence 条数`);
    layoutEvidence.forEach((text, i) => assertNonEmptyString(text, `${key} layoutEvidence[${i}]`));
  });
  // 大桌在多个 seed 上都要落在 2–3 条，且第 3 条只在有归宫牌时出现
  [0, 1, 3, 7, 123].forEach((seed) => {
    const result = run('grandTableau', { seed });
    assert.equal(result.layoutEvidence.length, 2 + (ownHouseCount(result) > 0 ? 1 : 0), `大桌 seed ${seed} layoutEvidence 条数`);
    assert.ok(result.layoutEvidence.length >= 2 && result.layoutEvidence.length <= 3);
  });
  // 无「布局说明」语义的牌阵必须是**空数组**（不是 undefined / 不是 null）
  ['single', 'three', 'five', 'relationship', 'decision', 'element'].forEach((key) => {
    assert.deepEqual(run(key, { seed: 123 }).layoutEvidence, [], `${key} layoutEvidence 应为 []`);
  });
});

test('顶层键序：spreadType / spreadName / draw / cards / combinations / layoutEvidence / meta', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    assert.deepEqual(Object.keys(result), TOP_KEYS, `${key} 顶层键序`);
    assert.equal('timestamp' in result, false, `${key} 顶层出现 timestamp`);
    assert.equal('evidenceAnalysis' in result, false, `${key} 顶层出现 evidenceAnalysis`);
    assert.ok(Array.isArray(result.combinations));
    assert.ok(Array.isArray(result.layoutEvidence));
  });
  // 手工录入模式（meta 无 random）键序不变
  const manual = run('nine', { manualCardIds: [9, 8, 7, 6, 5, 4, 3, 2, 1] });
  assert.deepEqual(Object.keys(manual), TOP_KEYS);
  assert.equal('random' in manual.meta, false);
  assert.equal(manual.combinations.length, 20);
  assert.equal(manual.layoutEvidence.length, 3);
});

test('正文与盘面正交：正文只由牌 id 决定（nine 牌阵 seed 1–4 交叉核对）', () => {
  const seen = new Map();
  [1, 2, 3, 4].forEach((seed) => {
    const result = run('nine', { seed });
    result.cards.forEach((card) => {
      const meaning = LENORMAND_MEANINGS[card.id];
      assert.equal(card.meaning, meaning.meaning, `id ${card.id} meaning 随盘面变化`);
      assert.equal(card.theme, meaning.theme, `id ${card.id} theme 随盘面变化`);
      assert.equal(card.detail, meaning.detail, `id ${card.id} detail 随盘面变化`);
      assert.deepEqual(card.keywords, [...meaning.keywords]);
      // 同一张牌在不同 seed 下正文逐字相同
      if (seen.has(card.id)) {
        const first = seen.get(card.id);
        assert.equal(card.theme, first.theme);
        assert.equal(card.detail, first.detail);
        assert.equal(card.meaning, first.meaning);
        assert.deepEqual(card.keywords, first.keywords);
      }
      seen.set(card.id, card);
    });
  });
  assert.ok(seen.size >= 9, `4 次九宫抽牌应出现多张不同牌（实际 ${seen.size} 张）`);
});
