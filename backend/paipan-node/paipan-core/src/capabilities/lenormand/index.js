/**
 * 命理 · 自研排盘内核 · 能力：雷诺曼抽牌（lenormand）
 * ---------------------------------------------------------------------------
 * 导出 `drawLenormandSpreadCore(params)` —— 与旧实现 `drawLenormandSpread(spreadType, options)`
 * 同形状（stripInternal 之后的**生产契约形状**）。入参形态由对拍框架登记表给定：
 * `params = { spreadType, options }`。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 `normalizeInput`    —— 牌阵/四种随机模式（seeded / replay / interactiveSamples / manualCardIds）校验
 *   ② 起局       `resolveDrawSource` —— 建样本流（manual 模式无样本流）
 *   ③ 格局判定   `computeReading`    —— 洗牌取牌（无正逆位）+ 九宫/大桌行列宫位落点
 *   ④ 输出装配   `assemble`          —— 按生产契约键序拼装
 * 四段之间只传普通对象；**禁止** IO / LLM / 网络 / 格式化文案 / `Math.random` / 时钟参与结果。
 *
 * == 规则唯一来源 ==
 *   牌组、牌阵、布局几何、发牌公式与随机源口径**全部**取自 `src/rules/lenormand.js`
 *   （该文件再导出 `src/rules/tarot.js` 的共用随机源/洗牌实现——全仓库一处实现）。
 *
 * == 与旧实现的有意分歧（详见 rules/lenormand.js 头部）==
 *   a. 缺随机源且无 `manualCardIds` 时旧实现走非确定性 `mode='system'`；本内核一律抛
 *      `PaipanInputError('missing_seed')`。
 *   b. **牌义正文由内核自带**：`keywords / meaning / theme / detail` 取自
 *      `src/rules/lenormand-meanings.js`（**本内核自撰**），`combinations` / `layoutEvidence`
 *      亦按同形状产出（文案出自该 rules 文件的模板）⇒ 前端零改动。
 *      对拍中这些字段属**信息性差异**（文案层，与旧实现不同是预期结果）。
 *   c. 不产出 `timestamp` / `evidenceAnalysis`（对拍时本就 stripInternal 剥离）。
 *   d. `draw.method` 文案自撰（信息性字段，不进关键字段）。
 */

import {
  LENORMAND_DECK,
  LENORMAND_DECK_SIZE,
  LENORMAND_DRAW_RULES,
  LENORMAND_SPREADS,
  LENORMAND_DEFAULT_SPREAD,
  lenormandLayoutOf,
  createLenormandRandom,
  lenormandDrawRandomInt,
  shuffleLenormandDeck,
} from '../../rules/lenormand.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';
import {
  LENORMAND_MEANINGS,
  LENORMAND_PAIR_PHRASES,
  LENORMAND_LAYOUT_PHRASES,
} from '../../rules/lenormand-meanings.js';

/** meta.engineVersion —— 自研内核版本（与旧实现 0.2.2 有意不同，属信息性差异）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致（换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** 牌组 id 数组（洗牌对象；`LENORMAND_DECK` 已按 id 升序，故下标 = id - 1）。 */
const DECK_IDS = Object.freeze(LENORMAND_DECK.map((card) => card.id));

/** id → 牌名。 */
const NAME_BY_ID = Object.freeze(Object.fromEntries(LENORMAND_DECK.map((card) => [card.id, card.name])));

/** 内核输入错误（缺随机源 / 牌阵未知 / 样本或牌号非法）。调用方据此返回 400。 */
export class PaipanInputError extends Error {
  /**
   * @param {string} code 机器可读错误码
   * @param {string} message 中文错误信息
   */
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/** 样本是否合法（`[0,1)` 的有限数）。 */
function isSample(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
}

/** 抽样：依次取出样本并记录（= 旧实现 meta.random.samples 的口径）。 */
function makeSampler(source, used) {
  return () => {
    const value = source();
    used.push(value);
    return value;
  };
}

/**
 * ① 输入归一化。
 *
 * 支持且**仅**支持 `{ spreadType, options }`：
 *   - `options.seed`：数字（有限）或文本 —— 确定性种子。
 *   - `options.replay`：非空数值数组（`[0,1)`），长度须 ≥ 35。
 *   - `options.interactiveSamples`：数值数组，长度 = 牌位数（每牌位 1 个样本）。
 *   - `options.manualCardIds`：整数牌号数组，长度 = 牌位数，1–36 且不重复（手工录入模式）。
 *   - 四者**两两互斥**（旧实现同样互斥，实测）。
 *   - `options.question`：占问文本，仅信息性，不进结果。
 *
 * @param {object} params `{ spreadType, options }`
 * @returns {object} 归一化结果
 * @throws {PaipanInputError}
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('invalid_params', '雷诺曼抽牌入参必须是 { spreadType, options } 对象。');
  }
  const rawSpread = params.spreadType;
  if (rawSpread !== undefined && rawSpread !== null && typeof rawSpread !== 'string') {
    throw new PaipanInputError('invalid_spread_type', `spreadType 必须是牌阵键字符串（收到 ${typeof rawSpread}）。`);
  }
  const spreadType = rawSpread === undefined || rawSpread === null || rawSpread === ''
    ? LENORMAND_DEFAULT_SPREAD
    : rawSpread;
  const spread = LENORMAND_SPREADS[spreadType];
  if (!spread) {
    throw new PaipanInputError('unknown_spread_type', `未知的雷诺曼牌阵类型: ${rawSpread}`);
  }
  const rawOptions = params.options;
  if (rawOptions !== undefined && rawOptions !== null && (typeof rawOptions !== 'object' || Array.isArray(rawOptions))) {
    throw new PaipanInputError('invalid_options', 'options 必须是对象。');
  }
  const options = rawOptions || {};

  const { cardCount, name, layout } = spread;
  const hasSeed = options.seed !== undefined;
  const hasReplay = options.replay !== undefined;
  const hasInteractive = options.interactiveSamples !== undefined;
  const hasManual = options.manualCardIds !== undefined;

  const provided = [hasSeed, hasReplay, hasInteractive, hasManual].filter(Boolean).length;
  if (provided > 1) {
    if (hasManual && (hasSeed || hasReplay || hasInteractive)) {
      throw new PaipanInputError('conflicting_random_source', '手工录入雷诺曼牌时不能同时提供随机选项。');
    }
    throw new PaipanInputError('conflicting_random_source', 'seed、replay 与逐张样本只能提供一种。');
  }

  if (hasManual) {
    const ids = options.manualCardIds;
    if (!Array.isArray(ids) || ids.length !== cardCount) {
      throw new PaipanInputError('invalid_manual_cards', `${name}需要按牌位录入${cardCount}张牌。`);
    }
    const seen = new Set();
    ids.forEach((value, i) => {
      if (!Number.isInteger(value) || value < 1 || value > LENORMAND_DECK_SIZE) {
        throw new PaipanInputError('invalid_manual_cards', `第${i + 1}张雷诺曼牌录入无效（需 1–${LENORMAND_DECK_SIZE} 的整数）: ${String(value)}`);
      }
      if (seen.has(value)) {
        throw new PaipanInputError('duplicate_manual_cards', '同一次雷诺曼牌阵不能重复录入同一张牌。');
      }
      seen.add(value);
    });
    return {
      spreadType, spread, mode: 'manual', seed: undefined, replay: null,
      interactiveSamples: null, manualCardIds: ids.slice(), layout,
      hashInput: { capability: 'lenormand', spreadType, mode: 'manual', cards: ids.join(',') },
    };
  }

  if (hasInteractive) {
    const samples = options.interactiveSamples;
    const need = cardCount * LENORMAND_DRAW_RULES.interactiveSamplesPerCard;
    if (!Array.isArray(samples) || samples.length !== need) {
      throw new PaipanInputError('invalid_interactive_samples', `${name}需要逐张抽取${cardCount}张牌（共 ${need} 个样本）。`);
    }
    samples.forEach((value, i) => {
      if (!isSample(value)) {
        throw new PaipanInputError('invalid_interactive_samples', `第${i + 1}个雷诺曼抽牌随机样本无效（需 [0,1) 的有限数）: ${String(value)}`);
      }
    });
    return {
      spreadType, spread, mode: 'interactive', seed: undefined, replay: null,
      interactiveSamples: samples.slice(), manualCardIds: null, layout,
      hashInput: { capability: 'lenormand', spreadType, mode: 'interactive', samples: samples.length },
    };
  }

  if (hasReplay) {
    const samples = options.replay;
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new PaipanInputError('invalid_replay', '随机重放样本必须是非空数组。');
    }
    const need = LENORMAND_DRAW_RULES.shuffleSamples;
    if (samples.length < need) {
      throw new PaipanInputError('replay_exhausted', `随机重放样本已用尽：雷诺曼洗牌需要 ${need} 个样本，仅提供 ${samples.length} 个。`);
    }
    samples.forEach((value, i) => {
      if (!isSample(value)) {
        throw new PaipanInputError('invalid_replay', `第${i + 1}个重放样本无效（需 [0,1) 的有限数）: ${String(value)}`);
      }
    });
    return {
      spreadType, spread, mode: 'replay', seed: undefined, replay: samples.slice(),
      interactiveSamples: null, manualCardIds: null, layout,
      hashInput: { capability: 'lenormand', spreadType, mode: 'replay', samples: samples.length },
    };
  }

  if (hasSeed) {
    const { seed } = options;
    const okNumber = typeof seed === 'number' && Number.isFinite(seed);
    const okString = typeof seed === 'string';
    if (!okNumber && !okString) {
      throw new PaipanInputError('invalid_seed', '随机种子必须是有限数字或文本。');
    }
    return {
      spreadType, spread, mode: 'seeded', seed, replay: null, interactiveSamples: null,
      manualCardIds: null, layout,
      hashInput: { capability: 'lenormand', spreadType, mode: 'seeded', seed: String(seed) },
    };
  }

  throw new PaipanInputError(
    'missing_seed',
    '雷诺曼抽牌必须显式给定确定性来源：options.seed（数字或文本）、options.replay（样本数组）、'
    + 'options.interactiveSamples（逐张样本）或 options.manualCardIds（手工录入牌号）。'
    + '旧实现在四者都缺时走非确定性的 system 随机（实测两次调用输出不同），'
    + '本内核禁止非确定性随机，故不沿用。',
  );
}

/**
 * ② 起局：建立样本流（manual 模式无样本流）。
 *
 * @param {ReturnType<typeof normalizeInput>} normalized ①的输出
 * @returns {{nextSample: (() => number)|null, samples: number[]}}
 */
export function resolveDrawSource(normalized) {
  const samples = [];
  if (normalized.mode === 'manual') return { nextSample: null, samples };
  if (normalized.mode === 'seeded') {
    return { nextSample: makeSampler(createLenormandRandom(normalized.seed), samples), samples };
  }
  if (normalized.mode === 'replay') {
    let cursor = 0;
    const source = normalized.replay;
    return {
      nextSample: makeSampler(() => {
        if (cursor >= source.length) throw new PaipanInputError('replay_exhausted', '随机重放样本已用尽。');
        const value = source[cursor];
        cursor += 1;
        return value;
      }, samples),
      // 重放模式下旧实现记录的是调用方给的整个样本数组（实测）。
      samples: source.slice(),
    };
  }
  // interactive：样本即入参
  let cursor = 0;
  return {
    nextSample: () => {
      const value = normalized.interactiveSamples[cursor];
      cursor += 1;
      return value;
    },
    samples: normalized.interactiveSamples.slice(),
  };
}

/**
 * ③ 发牌判定：取牌（洗牌或手工）+ 布局落点。纯规则查表 + 纯取整，可无 IO 反复重算。
 *
 * @param {object} input `{ normalized, nextSample }`
 * @returns {{drawn: Array<{id:number, name:string, row?:number, column?:number, house?:string}>}}
 */
export function computeReading({ normalized, nextSample }) {
  const { spread } = normalized;
  let ids;
  if (normalized.mode === 'manual') {
    ids = normalized.manualCardIds.slice();
  } else if (normalized.mode === 'interactive') {
    // 不洗牌：按牌位顺序从余牌依样本逐张取牌（每牌位 1 个样本）
    const pool = DECK_IDS.slice();
    ids = [];
    for (let k = 0; k < spread.cardCount; k += 1) {
      const index = lenormandDrawRandomInt(nextSample(), 0, pool.length - 1);
      ids.push(pool.splice(index, 1)[0]);
    }
  } else {
    ids = shuffleLenormandDeck(DECK_IDS, nextSample).slice(0, spread.cardCount);
  }
  return {
    drawn: ids.map((id, i) => ({
      id,
      name: NAME_BY_ID[id],
      ...lenormandLayoutOf(spread.layout, i),
    })),
  };
}

/** 人物牌 id（大桌近身关系以人物牌为锚；牌名是盘面标识，取自 rules 的牌组）。 */
const PERSON_CARD_IDS = Object.freeze([
  LENORMAND_DECK.find((c) => c.name === '男士').id,
  LENORMAND_DECK.find((c) => c.name === '女士').id,
]);

/** 取某张牌的牌义正文（唯一来源 = `rules/lenormand-meanings.js`）。缺数据即内核缺陷。 */
function cardMeaning(id) {
  const m = LENORMAND_MEANINGS[id];
  if (!m) throw new Error(`内核缺陷：雷诺曼牌 id ${id} 在 rules/lenormand-meanings.js 中缺牌义数据。`);
  return m;
}

/** 模板占位符替换（`{key}` → `vars[key]`）；纯拼接，不引入自有措辞。 */
function formatTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (vars[key] === undefined ? whole : String(vars[key])));
}

/** 把多条模板句连成一条说明（去掉句末句号后以「；」相连，末句补句号），避免出现「。；」。 */
function joinSentences(parts) {
  return `${parts.map((text) => String(text).replace(/。+$/, '')).join('；')}。`;
}

/** 「牌位 + 牌名 + 前两个关键词」标签，作为合读模板的替换值。 */
function cardLabel(card) {
  return `${card.position}${card.name}（${card.keywords.slice(0, 2).join('、')}）`;
}

/**
 * 相邻合读关系判定（与旧实现同形状）：
 *   - 无布局牌阵：按**牌序**前后相接（`牌序相邻`，行列距均 0）；
 *   - 网格布局：按**行列差**判定 `横向相邻 / 纵向相邻 / 对角相邻`。
 */
function relationOf(a, b, layout) {
  if (layout === 'none') return { relation: '牌序相邻', rowDistance: 0, columnDistance: 0 };
  const rowDistance = Math.abs(a.row - b.row);
  const columnDistance = Math.abs(a.column - b.column);
  if (rowDistance === 0) return { relation: '横向相邻', rowDistance, columnDistance };
  if (columnDistance === 0) return { relation: '纵向相邻', rowDistance, columnDistance };
  return { relation: '对角相邻', rowDistance, columnDistance };
}

/**
 * 组装一条相邻合读（形状与旧实现一致）：
 * `{card1, card2, position1, position2, relation, rowDistance, columnDistance, meaning, source}`。
 * 文案 = rules 的模板（`{1}`/`{2}` 换成牌位标签）+ 两张牌的 `meaning`（牌序合读时）。
 */
function pairEntry(a, b, templateKey, withMeanings) {
  const template = LENORMAND_PAIR_PHRASES[templateKey];
  const { relation, rowDistance, columnDistance } = relationOf(a, b, templateKey === 'serial' ? 'none' : 'grid');
  const head = formatTemplate(template, { 1: cardLabel(a), 2: cardLabel(b) });
  const meaning = withMeanings ? `${head} ${a.meaning}${b.meaning}` : head;
  return {
    card1: a.name,
    card2: b.name,
    position1: a.position,
    position2: b.position,
    relation,
    rowDistance,
    columnDistance,
    meaning,
    source: '相邻牌义合读',
  };
}

/**
 * 相邻合读集合：
 *   - 无布局牌阵：相邻牌序对（n-1 条）；
 *   - 九宫（grid3）：网格内所有相邻格对（横/纵/对角，3×3 共 20 条）；
 *   - 大桌（grandTableau）：以人物牌（男士/女士）的**近身格**（Moore 邻域）为合读对象
 *     （与旧实现同形状；旧实现另有「固定组合表」命中的额外条目，本内核本轮不重建，
 *      见节157 报告「未能解决的差异」——`combinations` 属信息性文案，不进关键字段）。
 */
function buildCombinations(cards, layout) {
  const out = [];
  if (layout === 'none') {
    for (let i = 1; i < cards.length; i += 1) out.push(pairEntry(cards[i - 1], cards[i], 'serial', true));
    return out;
  }
  if (layout === 'grid3' && cards.length === 9) {
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const rowDistance = Math.abs(cards[i].row - cards[j].row);
        const columnDistance = Math.abs(cards[i].column - cards[j].column);
        if (rowDistance > 1 || columnDistance > 1 || rowDistance + columnDistance === 0) continue;
        const key = rowDistance === 0 ? 'rowAdjacent' : columnDistance === 0 ? 'columnAdjacent' : 'diagonalAdjacent';
        out.push(pairEntry(cards[i], cards[j], key, false));
      }
    }
    return out;
  }
  if (layout === 'grandTableau') {
    for (const personId of PERSON_CARD_IDS) {
      const personIndex = cards.findIndex((c) => c.id === personId);
      if (personIndex < 0) continue;
      const person = cards[personIndex];
      for (let i = 0; i < cards.length; i += 1) {
        if (i === personIndex) continue;
        const other = cards[i];
        const rowDistance = Math.abs(other.row - person.row);
        const columnDistance = Math.abs(other.column - person.column);
        if (rowDistance > 1 || columnDistance > 1) continue;
        const key = rowDistance === 0 ? 'rowAdjacent' : columnDistance === 0 ? 'columnAdjacent' : 'diagonalAdjacent';
        if (i < personIndex) out.push(pairEntry(other, person, key, false));
        else out.push(pairEntry(person, other, key, false));
      }
    }
    return out;
  }
  return out;
}

/**
 * 布局说明（与旧实现同形状：**字符串数组**）：
 *   - 九宫：3 条 = 中心主轴 / 横纵路径 / 对角线路径；
 *   - 大桌：2 条 = 男士近身 / 女士近身；
 *   - 其余牌阵：空数组。
 * 全部文案出自 `rules/lenormand-meanings.js` 的模板。
 */
function buildLayoutEvidence(cards, layout) {
  if (layout === 'grid3' && cards.length === 9) {
    const center = cards[4].name;
    return [
      formatTemplate(LENORMAND_LAYOUT_PHRASES.gridCenterAxis, { card: center }),
      joinSentences([
        formatTemplate(LENORMAND_LAYOUT_PHRASES.gridRowPath, { a: cards[3].name, b: cards[4].name, c: cards[5].name }),
        formatTemplate(LENORMAND_LAYOUT_PHRASES.gridColumnPath, { a: cards[1].name, b: cards[4].name, c: cards[7].name }),
      ]),
      joinSentences([
        formatTemplate(LENORMAND_LAYOUT_PHRASES.gridDiagonalPath, { a: cards[0].name, b: cards[4].name, c: cards[8].name }),
        formatTemplate(LENORMAND_LAYOUT_PHRASES.gridDiagonalPath, { a: cards[2].name, b: cards[4].name, c: cards[6].name }),
      ]),
    ];
  }
  if (layout === 'grandTableau') {
    const lines = PERSON_CARD_IDS.map((personId) => {
      const person = cards.find((c) => c.id === personId);
      if (!person) return '';
      const near = cards.filter((c) => c.id !== personId
        && Math.abs(c.row - person.row) <= 1 && Math.abs(c.column - person.column) <= 1).map((c) => c.name);
      return formatTemplate(LENORMAND_LAYOUT_PHRASES.tableauPersonNear, {
        person: person.name,
        position: person.position,
        row: person.row,
        column: person.column,
        near: near.join('、'),
      });
    }).filter((text) => text !== '');
    // 归宫牌：某张牌正落在以它命名的宫（第 i+1 宫 = 牌组第 i 张牌之名），实测旧实现仅在
    // 「至少一张归宫」时给出这一条（故 layoutEvidence 长度为 2 或 3）。
    const ownHouse = cards
      .filter((card, i) => LENORMAND_DECK[i] && card.id === LENORMAND_DECK[i].id)
      .map((card) => card.name);
    if (ownHouse.length) {
      lines.push(formatTemplate(LENORMAND_LAYOUT_PHRASES.tableauOwnHouse, { cards: ownHouse.join('、') }));
    }
    return lines;
  }
  return [];
}

/**
 * ④ 输出装配（键序与旧实现 stripInternal 后一致：
 * spreadType / spreadName / draw / cards / combinations / layoutEvidence / meta）。
 * 每张牌接回**内核自带的牌义正文**（keywords / meaning / theme / detail）；相邻合读
 * `combinations` 与布局说明 `layoutEvidence` 亦按旧实现**同形状**产出，文案出自
 * `rules/lenormand-meanings.js`（自撰）。**不**输出 timestamp / evidenceAnalysis。
 *
 * 文案装配边界：本段只做「规则表数据 + 模板占位符替换 + 几何配对」的纯装配，
 * 不新增任何自有文案措辞（全部措辞都在 rules 里），保证文案单一权威源不被破坏。
 *
 * @param {object} parts `{ normalized, reading, samples, now }`
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, reading, samples, now }) {
  const { spreadType, spread, mode } = normalized;
  const cards = reading.drawn.map((card, i) => {
    const m = cardMeaning(card.id);
    const out = {
      id: card.id,
      name: card.name,
      keywords: m.keywords.slice(),
      meaning: m.meaning,
      theme: m.theme,
      detail: m.detail,
      position: spread.positions[i],
    };
    if (card.house !== undefined) out.house = card.house;
    if (card.row !== undefined) out.row = card.row;
    if (card.column !== undefined) out.column = card.column;
    return out;
  });
  const order = reading.drawn.map((card, i) => {
    const out = { index: i + 1, position: spread.positions[i], cardId: card.id, cardName: card.name };
    if (card.house !== undefined) out.house = card.house;
    if (card.row !== undefined) out.row = card.row;
    if (card.column !== undefined) out.column = card.column;
    return out;
  });
  const combinations = buildCombinations(cards, spread.layout);
  const layoutEvidence = buildLayoutEvidence(cards, spread.layout);
  const algorithm = mode === 'manual' ? 'lenormand.spread.manual'
    : mode === 'interactive' ? 'lenormand.spread.interactive'
      : 'lenormand.spread';
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const method = mode === 'manual' ? LENORMAND_DRAW_RULES.manualMethodText
    : mode === 'interactive' ? LENORMAND_DRAW_RULES.interactiveMethodText
      : LENORMAND_DRAW_RULES.methodText;
  return {
    spreadType,
    spreadName: spread.name,
    draw: { deckSize: LENORMAND_DECK_SIZE, method, order },
    cards,
    combinations,
    layoutEvidence,
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm,
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `${algorithm}:${inputHash}`,
      // 手工录入模式旧实现无 meta.random（实测），故此处整键省略
      ...(mode === 'manual'
        ? {}
        : {
          random: {
            mode: mode === 'seeded' ? 'seeded' : mode === 'replay' ? 'replay' : 'system',
            ...(mode === 'seeded' ? { seed: normalized.seed } : {}),
            samples: samples.slice(),
          },
        }),
    },
  };
}

/**
 * 雷诺曼抽牌（自研内核）。
 *
 * @param {object} params `{ spreadType: string, options: object, now?: Date }`
 *   - `spreadType`：牌阵键（缺省 `single`）。
 *   - `options.seed | options.replay | options.interactiveSamples | options.manualCardIds`：**必须四选一**。
 *   - `now`：可选，仅用于 `meta.calculatedAt`；不参与任何排盘结果与哈希。
 * @returns {object} 生产契约形状的抽牌结果
 * @throws {PaipanInputError} 牌阵未知 / 缺来源 / 来源冲突 / 样本或牌号非法
 */
export function drawLenormandSpreadCore(params) {
  const normalized = normalizeInput(params);                       // ① 输入归一化
  const { nextSample, samples } = resolveDrawSource(normalized);   // ② 起局（样本流）
  const reading = computeReading({ normalized, nextSample });      // ③ 发牌判定
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({ normalized, reading, samples, now });          // ④ 输出装配
}

export default drawLenormandSpreadCore;
