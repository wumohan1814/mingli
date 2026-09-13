/**
 * 命理 · 自研排盘内核 · 单测：塔罗抽牌（tarot）
 * ===========================================================================
 * 覆盖对象：`src/capabilities/tarot/index.js` 的 `drawTarotSpreadCore` 与
 * `src/rules/tarot.js` 的规则表（牌组 / 牌阵 / 发牌口径 / fnv1a32）。
 *
 * 纪律：
 *   - 零网络、零时钟依赖、禁用 `Math.random`（随机源一律注入 `seed`/`replay`/
 *     `interactiveSamples`，时间一律注入 `now`）。
 *   - 已知样例为**写死**断言（不"再算一遍"）；牌名/牌位名/正逆位文本逐字断言。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  drawTarotSpreadCore,
  PaipanInputError,
} from '../src/capabilities/tarot/index.js';
import {
  fnv1a32,
  TAROT_DECK,
  TAROT_DECK_SIZE,
  TAROT_DRAW_RULES,
  TAROT_LEGACY_COMPARABLE_SPREADS,
  TAROT_MAJOR_ARCANA,
  TAROT_SPREADS,
} from '../src/rules/tarot.js';
import { TAROT_MEANINGS } from '../src/rules/tarot-meanings.js';

/** 固定时钟（一律注入，禁时钟依赖）。 */
const NOW = new Date('2026-01-01T00:00:00.000Z');

/** 全部牌阵键（来自规则表本身，不手抄）。 */
const SPREAD_KEYS = Object.keys(TAROT_SPREADS);

/**
 * 发出的一张牌的**完整键序**（契约：前端按位读取）。
 * 键**顺序本身**是契约，故用 `deepEqual(Object.keys(card), CARD_KEYS)` 整串断言。
 */
const CARD_KEYS = [
  'id', 'name', 'position', 'reversed',
  'upright', 'reversedText', 'uprightKeywords', 'reversedKeywords', 'keywords', 'element', 'archetype',
];

/** 牌义正文 7 键（= CARD_KEYS 的第 5 项起；供「逐张正文非空」批量校验复用）。 */
const MEANING_KEYS = CARD_KEYS.slice(4);

/** 花色 → element 逐字对应（`rules/tarot-meanings.js` 的 `TAROT_ELEMENTS` 口径，此处独立写死）。 */
const ELEMENT_BY_SUIT = {
  wands: '火（行动与热情）',
  cups: '水（情感与关系）',
  swords: '风（思维与沟通）',
  pentacles: '土（现实与资源）',
  major: '大阿卡纳（人生课题与阶段）',
};

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

/** 旧实现（覆盖后引擎）可比对的 19 个牌阵键（对拍夹具口径，含 `fourSeasons`）。 */
const LEGACY_KEYS = [
  'single', 'three', 'love', 'career', 'decision', 'celtic', 'chakra', 'year', 'mindBodySpirit',
  'horseshoe', 'holyTriangle', 'universal', 'fourElements', 'hexagram', 'relationship', 'wealth',
  'problemSolving', 'twelveHouses', 'fourSeasons',
];

/** 统一入口：注入固定 now。 */
function run(spreadType, options) {
  return drawTarotSpreadCore({ spreadType, options, now: NOW });
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

/** 取 draw.order 的正逆位文本序列。 */
function orientationsOf(result) {
  return result.draw.order.map((entry) => entry.orientation);
}

/* =========================================================================
 * 一、规则表
 * ======================================================================= */

test('规则表：塔罗规则表与牌组深度冻结（含内层数组）', () => {
  assert.equal(Object.isFrozen(TAROT_SPREADS), true);
  assert.equal(Object.isFrozen(TAROT_SPREADS.celtic), true);
  assert.equal(Object.isFrozen(TAROT_SPREADS.celtic.positions), true);
  assert.equal(Object.isFrozen(TAROT_SPREADS.three.positions), true);
  assert.equal(Object.isFrozen(TAROT_SPREADS.fourSeasons.positions), true);
  assert.equal(Object.isFrozen(TAROT_DECK), true);
  assert.equal(Object.isFrozen(TAROT_DECK[0]), true);
  assert.equal(Object.isFrozen(TAROT_MAJOR_ARCANA), true);
  assert.equal(Object.isFrozen(TAROT_LEGACY_COMPARABLE_SPREADS), true);
  assert.equal(Object.isFrozen(TAROT_DRAW_RULES), true);
});

test('规则表：TAROT_DECK 共 78 张且牌名逐字抽查', () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.equal(TAROT_DECK_SIZE, 78);
  assert.equal(TAROT_DECK[0].name, '愚者');
  assert.equal(TAROT_DECK[0].id, 1);
  assert.equal(TAROT_DECK[21].name, '世界');
  assert.equal(TAROT_DECK[22].name, '权杖王牌');
  assert.equal(TAROT_DECK[27].name, '权杖六');
  assert.equal(TAROT_DECK[36].name, '圣杯王牌');
  assert.equal(TAROT_DECK[50].name, '宝剑王牌');
  assert.equal(TAROT_DECK[64].name, '钱币王牌');
  assert.equal(TAROT_DECK[77].name, '钱币国王');
  // 数组下标 = id - 1（洗牌取牌依赖此顺序）
  TAROT_DECK.forEach((card, i) => assert.equal(card.id, i + 1));
});

test('规则表：牌阵表名称、牌位数与牌位名逐字抽查（celtic/horseshoe/hexagram 为产品口径）', () => {
  assert.equal(TAROT_SPREADS.celtic.name, '凯尔特十字');
  assert.equal(TAROT_SPREADS.celtic.positions.length, 10);
  assert.deepEqual(TAROT_SPREADS.celtic.positions, [
    '现状', '交叉影响', '目标与理想', '根基', '近期过去',
    '临近未来', '你的立场', '环境与他人', '希望与恐惧', '结果',
  ]);
  assert.equal(TAROT_SPREADS.horseshoe.name, '七张马蹄');
  assert.equal(TAROT_SPREADS.horseshoe.positions.length, 7);
  assert.deepEqual(TAROT_SPREADS.horseshoe.positions, [
    '过去', '现在', '近期未来', '你的态度', '外部影响', '阻碍', '结果',
  ]);
  assert.equal(TAROT_SPREADS.hexagram.name, '六芒星');
  assert.equal(TAROT_SPREADS.hexagram.positions.length, 7);
  assert.deepEqual(TAROT_SPREADS.hexagram.positions, [
    '过去', '现在', '未来', '原因', '环境', '策略', '核心/指示牌',
  ]);
  // 其余牌阵名与牌位名沿用原口径（抽查代表阵，未被覆盖层改写）
  assert.equal(TAROT_SPREADS.single.name, '单牌指引');
  assert.deepEqual(TAROT_SPREADS.single.positions, ['当前指引']);
  assert.equal(TAROT_SPREADS.three.name, '时间流牌阵');
  assert.deepEqual(TAROT_SPREADS.three.positions, ['过去', '现在', '未来']);
  assert.equal(TAROT_SPREADS.twelveHouses.cardCount, 12);
  SPREAD_KEYS.forEach((key) => {
    assert.equal(TAROT_SPREADS[key].cardCount, TAROT_SPREADS[key].positions.length);
  });
});

test('规则表：fnv1a32 已知哈希值（"1" / "0"）', () => {
  assert.equal(fnv1a32('1'), 0x340ca71c);
  assert.equal(fnv1a32('0'), 0x350ca8af);
  assert.equal(typeof fnv1a32(1), 'number');
});

test('规则表：TAROT_DRAW_RULES 发牌口径常量', () => {
  assert.equal(TAROT_DRAW_RULES.deckSize, 78);
  assert.equal(TAROT_DRAW_RULES.shuffleSamples, 77);
  assert.equal(TAROT_DRAW_RULES.samplesPerCard, 1);
  assert.equal(TAROT_DRAW_RULES.orientationThreshold, 0.5);
  assert.equal(TAROT_DRAW_RULES.interactiveSamplesPerCard, 2);
  assert.equal(TAROT_DRAW_RULES.samplesTotal(10), 87);
  assert.equal(TAROT_DRAW_RULES.randomInt, 'min + floor(sample * (max - min + 1))');
});

/* =========================================================================
 * 二、已知样例（写死断言）
 * ======================================================================= */

test('已知样例：single seed 1 → 权杖六 / 当前指引 / 正位 / 样本 78 个', () => {
  const result = run('single', { seed: 1 });
  // 盘面事实逐字段断言（整对象 deepEqual 会随正文键增减而失效，故不整对象比对）
  assert.equal(result.cards[0].id, 28);
  assert.equal(result.cards[0].name, '权杖六');
  assert.equal(result.cards[0].position, '当前指引');
  assert.equal(result.cards[0].reversed, false);
  assert.deepEqual(Object.keys(result.cards[0]), CARD_KEYS);
  assert.equal(result.cards[0].upright, TAROT_MEANINGS[28].upright);
  assert.equal(result.cards[0].reversedText, TAROT_MEANINGS[28].reversedText);
  assert.equal(result.cards[0].element, TAROT_MEANINGS[28].element);
  assert.equal(result.cards[0].archetype, TAROT_MEANINGS[28].archetype);
  assert.deepEqual(result.cards[0].keywords, [...TAROT_MEANINGS[28].keywords]);
  assert.equal(result.draw.order[0].orientation, '正位');
  assert.equal(result.meta.random.samples[0], 0.8317172497045249);
  assert.equal(result.meta.random.samples.length, 78);
});

test('已知样例：three seed 1 → 28,77,39 与 正/逆/正', () => {
  const result = run('three', { seed: 1 });
  assert.deepEqual(idsOf(result), [28, 77, 39]);
  assert.deepEqual(orientationsOf(result), ['正位', '逆位', '正位']);
  assert.equal(result.meta.random.samples.length, 80);
});

test('已知样例：three seed 0 → 78,8,12', () => {
  const result = run('three', { seed: 0 });
  assert.deepEqual(idsOf(result), [78, 8, 12]);
});

test('已知样例：celtic seed 3 → 十张牌与正逆位逐位一致', () => {
  const result = run('celtic', { seed: 3 });
  assert.deepEqual(idsOf(result), [77, 76, 12, 21, 75, 60, 37, 72, 53, 16]);
  assert.deepEqual(orientationsOf(result), [
    '正位', '逆位', '逆位', '逆位', '逆位', '逆位', '正位', '逆位', '逆位', '正位',
  ]);
  assert.equal(result.meta.random.samples.length, 87);
});

test('已知样例：love seed 42 → 73,50,8,56,44', () => {
  const result = run('love', { seed: 42 });
  assert.deepEqual(idsOf(result), [73, 50, 8, 56, 44]);
});

test('已知样例：three 逐张样本模式（0.5 × 6）→ 40,39,41 且全正位', () => {
  const samples = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const result = run('three', { interactiveSamples: samples });
  assert.deepEqual(idsOf(result), [40, 39, 41]);
  assert.deepEqual(orientationsOf(result), ['正位', '正位', '正位']);
  assert.equal(result.meta.random.samples.length, 6);
});

test('已知样例：replay 全 0.1 → 10,20,30 且全逆位', () => {
  const replay = new Array(80).fill(0.1);
  const result = run('three', { replay });
  assert.deepEqual(idsOf(result), [10, 20, 30]);
  assert.deepEqual(orientationsOf(result), ['逆位', '逆位', '逆位']);
  assert.equal(result.meta.random.samples.length, 80);
  assert.equal(result.meta.random.mode, 'replay');
});

test('已知样例：replay 全 0.9 → 1,2,3 且全正位', () => {
  const replay = new Array(80).fill(0.9);
  const result = run('three', { replay });
  assert.deepEqual(idsOf(result), [1, 2, 3]);
  assert.deepEqual(orientationsOf(result), ['正位', '正位', '正位']);
});

/* =========================================================================
 * 三、纯函数性 / 确定性 / 不放回
 * ======================================================================= */

test('纯函数性：同入参两次调用结果深等，且传入的 options 未被改动', () => {
  const options = { seed: 7, question: '这次抽牌会顺利吗' };
  const snapshot = structuredClone(options);
  const first = run('three', options);
  const second = run('three', options);
  assert.deepEqual(second, first);
  assert.deepEqual(options, snapshot);
  assert.equal('question' in first, false);

  const interactive = { interactiveSamples: [0.1, 0.6, 0.2, 0.4, 0.3, 0.9] };
  const interactiveSnapshot = structuredClone(interactive);
  const firstInteractive = run('three', interactive);
  const secondInteractive = run('three', interactive);
  assert.deepEqual(secondInteractive, firstInteractive);
  assert.deepEqual(interactive, interactiveSnapshot);

  const replay = { replay: new Array(80).fill(0.3) };
  const replaySnapshot = structuredClone(replay);
  const firstReplay = run('three', replay);
  const secondReplay = run('three', replay);
  assert.deepEqual(secondReplay, firstReplay);
  assert.deepEqual(replay, replaySnapshot);
});

test('确定性等价：seed 1 与 "1"、seed 0 与 "0" 的 cards + draw 完全相同', () => {
  const numericOne = run('three', { seed: 1 });
  const stringOne = run('three', { seed: '1' });
  assert.deepEqual(stringOne.cards, numericOne.cards);
  assert.deepEqual(stringOne.draw, numericOne.draw);
  assert.deepEqual(stringOne.meta.random.samples, numericOne.meta.random.samples);

  const numericZero = run('three', { seed: 0 });
  const stringZero = run('three', { seed: '0' });
  assert.deepEqual(stringZero.cards, numericZero.cards);
  assert.deepEqual(stringZero.draw, numericZero.draw);
  assert.deepEqual(stringZero.meta.random.samples, numericZero.meta.random.samples);
});

test('不放回：每个牌阵 seed 123 的 draw.order 卡号互不重复', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    const ids = idsOf(result);
    assert.equal(ids.length, TAROT_SPREADS[key].cardCount);
    assert.equal(new Set(ids).size, ids.length, `${key} 出现重复卡号`);
  });
});

test('牌位填充：每个牌阵 cards 与 draw.order 与牌位表逐项对齐', () => {
  SPREAD_KEYS.forEach((key) => {
    const spread = TAROT_SPREADS[key];
    const result = run(key, { seed: 123 });
    assert.equal(result.cards.length, spread.positions.length);
    for (let i = 0; i < spread.positions.length; i += 1) {
      assert.equal(result.cards[i].position, spread.positions[i]);
      assert.equal(result.draw.order[i].position, result.cards[i].position);
      assert.equal(result.draw.order[i].index, i + 1);
      assert.equal(result.draw.order[i].cardId, result.cards[i].id);
      assert.equal(result.draw.order[i].cardName, result.cards[i].name);
      assert.equal(result.cards[i].name, TAROT_DECK[result.cards[i].id - 1].name);
    }
  });
});

test('正逆位一致性：每个牌阵 reversed 为布尔且与 orientation 文本互洽', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    result.cards.forEach((card, i) => {
      assert.equal(typeof card.reversed, 'boolean');
      assert.equal(card.reversed, result.draw.order[i].orientation === '逆位');
      assert.ok(result.draw.order[i].orientation === '正位' || result.draw.order[i].orientation === '逆位');
    });
  });
});

test('replay 与 seeded 自洽：celtic seed 7 的样本重放结果完全一致', () => {
  const seeded = run('celtic', { seed: 7 });
  const replay = seeded.meta.random.samples.slice();
  assert.equal(replay.length, 87);
  const replayed = run('celtic', { replay });
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
  expectPaipanError(() => drawTarotSpreadCore({ spreadType: 'single', now: NOW }), 'missing_seed');
  expectPaipanError(() => run('three', { question: '没有给随机源' }), 'missing_seed');
});

test('抛错路径：未知牌阵键 → unknown_spread_type', () => {
  expectPaipanError(() => run('nonexistent', { seed: 1 }), 'unknown_spread_type');
  expectPaipanError(() => run('FourSeasons', { seed: 1 }), 'unknown_spread_type');
  expectPaipanError(() => run(7, { seed: 1 }), 'invalid_spread_type');
  expectPaipanError(() => drawTarotSpreadCore(null), 'invalid_params');
});

test('抛错路径：随机源冲突 → conflicting_random_source', () => {
  expectPaipanError(() => run('three', { seed: 1, replay: new Array(80).fill(0.1) }), 'conflicting_random_source');
  expectPaipanError(() => run('three', { seed: 1, interactiveSamples: new Array(6).fill(0.5) }), 'conflicting_random_source');
  expectPaipanError(
    () => run('three', { replay: new Array(80).fill(0.1), interactiveSamples: new Array(6).fill(0.5) }),
    'conflicting_random_source',
  );
});

test('抛错路径：逐张样本长度或取值非法 → invalid_interactive_samples', () => {
  expectPaipanError(() => run('three', { interactiveSamples: [0.5, 0.5] }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: new Array(7).fill(0.5) }), 'invalid_interactive_samples');
  expectPaipanError(() => run('three', { interactiveSamples: 'not-an-array' }), 'invalid_interactive_samples');
  expectPaipanError(
    () => run('three', { interactiveSamples: [0.5, 1.5, 0.5, 0.5, 0.5, 0.5] }),
    'invalid_interactive_samples',
  );
  expectPaipanError(
    () => run('three', { interactiveSamples: [0.5, -0.1, 0.5, 0.5, 0.5, 0.5] }),
    'invalid_interactive_samples',
  );
  expectPaipanError(
    () => run('three', { interactiveSamples: [0.5, 1, 0.5, 0.5, 0.5, 0.5] }),
    'invalid_interactive_samples',
  );
});

test('抛错路径：replay 为空 / 长度不足 / 取值非法', () => {
  expectPaipanError(() => run('three', { replay: [] }), 'invalid_replay');
  expectPaipanError(() => run('three', { replay: 'not-an-array' }), 'invalid_replay');
  expectPaipanError(() => run('three', { replay: new Array(79).fill(0.1) }), 'replay_exhausted');
  expectPaipanError(() => run('single', { replay: new Array(77).fill(0.1) }), 'replay_exhausted');
  const bad = new Array(80).fill(0.1);
  bad[3] = 1.5;
  expectPaipanError(() => run('three', { replay: bad }), 'invalid_replay');
  const nan = new Array(80).fill(0.1);
  nan[0] = Number.NaN;
  expectPaipanError(() => run('three', { replay: nan }), 'invalid_replay');
});

test('抛错路径：seed / options 取值非法', () => {
  expectPaipanError(() => run('three', { seed: true }), 'invalid_seed');
  expectPaipanError(() => run('three', { seed: Number.NaN }), 'invalid_seed');
  expectPaipanError(() => run('three', { seed: {} }), 'invalid_seed');
  expectPaipanError(() => drawTarotSpreadCore({ spreadType: 'three', options: 5, now: NOW }), 'invalid_options');
  expectPaipanError(() => drawTarotSpreadCore({ spreadType: 'three', options: [], now: NOW }), 'invalid_options');
});

/* =========================================================================
 * 五、输出形状纪律
 * ======================================================================= */

test('输出形状纪律：顶层与 cards 不含内部字段，且每张牌正文 7 键按固定键序齐备', () => {
  // 仍不产出的内部字段（对拍时本就 stripInternal 剥离）
  const forbiddenTop = ['timestamp', 'evidenceAnalysis'];
  // 塔罗卡片不得出现雷诺曼侧的正文字段（口径别串）
  const forbiddenCard = ['timestamp', 'evidenceAnalysis', 'meaning', 'theme', 'detail'];
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    assert.deepEqual(Object.keys(result), ['spreadType', 'spreadName', 'cards', 'meta', 'draw']);
    forbiddenTop.forEach((field) => assert.equal(field in result, false, `顶层出现 ${field}`));
    result.cards.forEach((card) => {
      assert.deepEqual(Object.keys(card), CARD_KEYS, `${key} cards 键序`);
      forbiddenCard.forEach((field) => assert.equal(field in card, false, `cards 出现 ${field}`));
      MEANING_KEYS.forEach((field) => {
        if (field.endsWith('Keywords') || field === 'keywords') {
          assertKeywordTriple(card[field], `${key} cards.${field}`);
        } else {
          assertNonEmptyString(card[field], `${key} cards.${field}`);
        }
      });
    });
    assert.deepEqual(Object.keys(result.draw).sort(), ['deckSize', 'method', 'order', 'orientationRule']);
  });
});

/* =========================================================================
 * 六、meta
 * ======================================================================= */

test('meta：版本、算法键与注入的 calculatedAt', () => {
  const single = run('single', { seed: 1 });
  assert.equal(single.meta.engineVersion, '0.1.0-mingli');
  assert.equal(single.meta.schemaVersion, '1.0.0');
  assert.equal(single.meta.calculatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(single.meta.algorithm, 'tarot.single');

  SPREAD_KEYS.filter((key) => key !== 'single').forEach((key) => {
    const result = run(key, { seed: 1 });
    assert.equal(result.meta.algorithm, 'tarot.spread');
    assert.equal(result.meta.calculatedAt, '2026-01-01T00:00:00.000Z');
  });

  const interactive = run('three', { interactiveSamples: new Array(6).fill(0.5) });
  assert.equal(interactive.meta.algorithm, 'tarot.spread.interactive');
  const interactiveSingle = run('single', { interactiveSamples: [0.5, 0.5] });
  assert.equal(interactiveSingle.meta.algorithm, 'tarot.single.interactive');
});

test('meta.random：seeded 回显原始 seed（数字与文本）且 mode = seeded', () => {
  const numeric = run('three', { seed: 1 });
  assert.equal(numeric.meta.random.mode, 'seeded');
  assert.equal(numeric.meta.random.seed, 1);
  assert.equal(typeof numeric.meta.random.seed, 'number');

  const text = run('three', { seed: '命理-seed' });
  assert.equal(text.meta.random.mode, 'seeded');
  assert.equal(text.meta.random.seed, '命理-seed');
  assert.equal(typeof text.meta.random.seed, 'string');

  const interactive = run('three', { interactiveSamples: new Array(6).fill(0.5) });
  assert.equal(interactive.meta.random.mode, 'system');
  assert.deepEqual(interactive.meta.random.samples, new Array(6).fill(0.5));
  assert.equal('seed' in interactive.meta.random, false);
});

/* =========================================================================
 * 七、布局几何 / 全牌阵遍历
 * ======================================================================= */

test('布局几何：塔罗所有牌阵的卡片均无 row / column / house', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    result.cards.forEach((card) => {
      assert.equal('row' in card, false);
      assert.equal('column' in card, false);
      assert.equal('house' in card, false);
    });
    result.draw.order.forEach((entry) => {
      assert.equal('row' in entry, false);
      assert.equal('column' in entry, false);
      assert.equal('house' in entry, false);
    });
  });
});

test('全牌阵遍历：每个牌阵 seed 123 正常发牌，牌位数与 deckSize 正确', () => {
  assert.equal(SPREAD_KEYS.length, 19);
  SPREAD_KEYS.forEach((key) => {
    const spread = TAROT_SPREADS[key];
    const result = run(key, { seed: 123 });
    assert.equal(result.spreadType, key);
    assert.ok(typeof result.spreadName === 'string' && result.spreadName.length > 0);
    assert.equal(result.spreadName, spread.name);
    assert.equal(result.cards.length, spread.positions.length);
    assert.equal(result.draw.deckSize, 78);
    assert.equal(result.draw.order.length, spread.positions.length);
    assert.equal(result.meta.random.samples.length, 77 + spread.cardCount);
  });
});

test('样本消耗口径：seeded 的 samples 长度恒为 77 + 牌位数', () => {
  const singles = run('single', { seed: 1 });
  assert.equal(singles.meta.random.samples.length, 78);
  const sevens = run('chakra', { seed: 1 });
  assert.equal(sevens.meta.random.samples.length, 84);
  const tens = run('celtic', { seed: 1 });
  assert.equal(tens.meta.random.samples.length, 87);
  const twelves = run('year', { seed: 1 });
  assert.equal(twelves.meta.random.samples.length, 89);
  assert.equal(TAROT_DRAW_RULES.samplesTotal(1), 78);
});

/* =========================================================================
 * 八、fourSeasons（仅内核有的自研牌阵）
 * ======================================================================= */

test('fourSeasons：内核独有牌阵，且已纳入对拍可比对表（覆盖后引擎可出牌）', () => {
  assert.equal(TAROT_SPREADS.fourSeasons.cardCount, 4);
  assert.deepEqual(TAROT_SPREADS.fourSeasons.positions, ['春', '夏', '秋', '冬']);
  const result = run('fourSeasons', { seed: 123 });
  assert.equal(result.cards.length, 4);
  assert.deepEqual(result.cards.map((card) => card.position), ['春', '夏', '秋', '冬']);
  assert.equal(result.meta.algorithm, 'tarot.spread');
  assert.equal(result.draw.deckSize, 78);

  // 对拍基准改为「覆盖层适配器」（tools/compare/legacy-tarot.mjs）后，fourSeasons
  // 在覆盖后引擎上同样可出牌 ⇒ 全部 19 阵可比对
  assert.equal(TAROT_LEGACY_COMPARABLE_SPREADS.includes('fourSeasons'), true);
  assert.equal(TAROT_LEGACY_COMPARABLE_SPREADS.length, 19);
  assert.deepEqual([...TAROT_LEGACY_COMPARABLE_SPREADS], LEGACY_KEYS);
  LEGACY_KEYS.forEach((key) => assert.equal(key in TAROT_SPREADS, true));
});

/* =========================================================================
 * 九、牌义正文覆盖（新契约：cards 带 7 个正文键，正文只由牌 id 决定）
 * ======================================================================= */

test('正文覆盖：TAROT_MEANINGS 覆盖全部 78 张且字段齐备、深度冻结', () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.equal(Object.keys(TAROT_MEANINGS).length, 78);
  assert.equal(Object.isFrozen(TAROT_MEANINGS), true);
  TAROT_DECK.forEach((card) => {
    const meaning = TAROT_MEANINGS[card.id];
    assert.ok(meaning, `牌 id ${card.id}（${card.name}）缺牌义正文`);
    assert.equal(Object.isFrozen(meaning), true, `${card.name} 牌义未冻结`);
    ['upright', 'reversedText', 'element', 'archetype'].forEach((field) => {
      assertNonEmptyString(meaning[field], `${card.name}.${field}`);
    });
    ['uprightKeywords', 'reversedKeywords', 'keywords'].forEach((field) => {
      assertKeywordTriple(meaning[field], `${card.name}.${field}`);
    });
  });
  // 键集合恰为 id 1–78
  assert.deepEqual(
    Object.keys(TAROT_MEANINGS).map(Number).sort((a, b) => a - b),
    Array.from({ length: 78 }, (_, i) => i + 1),
  );
});

test('正文覆盖：element 与花色逐字对应（权杖火 / 圣杯水 / 宝剑风 / 钱币土 / 大阿卡纳）', () => {
  const suitCounts = { wands: 0, cups: 0, swords: 0, pentacles: 0, major: 0 };
  TAROT_DECK.forEach((card) => {
    suitCounts[card.suit] += 1;
    assert.equal(
      TAROT_MEANINGS[card.id].element,
      ELEMENT_BY_SUIT[card.suit],
      `${card.name}（suit=${card.suit}）的 element 不符`,
    );
  });
  assert.deepEqual(suitCounts, { wands: 14, cups: 14, swords: 14, pentacles: 14, major: 22 });
});

test('正文覆盖：每个牌阵发出的牌都带完整正文，且与正逆位互洽', () => {
  SPREAD_KEYS.forEach((key) => {
    const result = run(key, { seed: 123 });
    assert.equal(result.cards.length, TAROT_SPREADS[key].cardCount);
    result.cards.forEach((card, i) => {
      const label = `${key} cards[${i}]`;
      assert.deepEqual(Object.keys(card), CARD_KEYS, `${label} 键序`);
      assertNonEmptyString(card.upright, `${label}.upright`);
      assertNonEmptyString(card.reversedText, `${label}.reversedText`);
      assertNonEmptyString(card.element, `${label}.element`);
      assertNonEmptyString(card.archetype, `${label}.archetype`);
      assertKeywordTriple(card.uprightKeywords, `${label}.uprightKeywords`);
      assertKeywordTriple(card.reversedKeywords, `${label}.reversedKeywords`);
      assertKeywordTriple(card.keywords, `${label}.keywords`);
      assert.equal(typeof card.reversed, 'boolean');
      assert.equal(card.reversed, result.draw.order[i].orientation === '逆位', `${label} 正逆位不一致`);
      // 正文与冻结的牌义表逐字一致（发出的是拷贝而不是引用）
      const meaning = TAROT_MEANINGS[card.id];
      assert.equal(card.upright, meaning.upright);
      assert.equal(card.reversedText, meaning.reversedText);
      assert.equal(card.element, meaning.element);
      assert.equal(card.archetype, meaning.archetype);
      assert.deepEqual(card.uprightKeywords, [...meaning.uprightKeywords]);
      assert.deepEqual(card.reversedKeywords, [...meaning.reversedKeywords]);
      assert.deepEqual(card.keywords, [...meaning.keywords]);
    });
  });
});

test('正文与盘面正交：正文只由牌 id 决定（year 牌阵 seed 0–4 交叉核对）', () => {
  const seen = new Map();
  [0, 1, 2, 3, 4].forEach((seed) => {
    const result = run('year', { seed });
    result.cards.forEach((card) => {
      const meaning = TAROT_MEANINGS[card.id];
      assert.equal(card.upright, meaning.upright, `id ${card.id} upright 随盘面变化`);
      assert.equal(card.reversedText, meaning.reversedText, `id ${card.id} reversedText 随盘面变化`);
      assert.equal(card.element, meaning.element);
      assert.equal(card.archetype, meaning.archetype);
      assert.deepEqual(card.keywords, [...meaning.keywords]);
      assert.deepEqual(card.uprightKeywords, [...meaning.uprightKeywords]);
      assert.deepEqual(card.reversedKeywords, [...meaning.reversedKeywords]);
      // 同一张牌在不同 seed 下正文逐字相同（正逆位只改 reversed，不改正文）
      if (seen.has(card.id)) {
        const first = seen.get(card.id);
        assert.equal(card.upright, first.upright);
        assert.equal(card.reversedText, first.reversedText);
        assert.deepEqual(card.keywords, first.keywords);
        assert.deepEqual(card.uprightKeywords, first.uprightKeywords);
        assert.deepEqual(card.reversedKeywords, first.reversedKeywords);
      }
      seen.set(card.id, card);
    });
  });
  assert.ok(seen.size >= 12, `5 次 year 抽牌应出现多张不同牌（实际 ${seen.size} 张）`);
});

test('规则表：TAROT_SPREADS 与对拍可比对表均为 19 键且含 fourSeasons', () => {
  assert.equal(SPREAD_KEYS.length, 19);
  assert.equal(TAROT_LEGACY_COMPARABLE_SPREADS.length, 19);
  assert.equal(TAROT_LEGACY_COMPARABLE_SPREADS.includes('fourSeasons'), true);
  SPREAD_KEYS.forEach((key) => {
    assert.equal(TAROT_LEGACY_COMPARABLE_SPREADS.includes(key), true, `${key} 不在可比对表内`);
  });
  assert.equal(new Set(TAROT_LEGACY_COMPARABLE_SPREADS).size, 19);
});
