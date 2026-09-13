/**
 * 命理 · 自研排盘内核 · 能力：塔罗抽牌（tarot）
 * ---------------------------------------------------------------------------
 * 导出 `drawTarotSpreadCore(params)` —— 与旧实现 `drawTarotSpread(spreadType, options)`
 * 同形状（stripInternal 之后的**生产契约形状**）。入参形态由对拍框架登记表给定：
 * `params = { spreadType, options }`（见 run-compare.mjs 的 `toCoreInput`）。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 `normalizeInput`   —— 牌阵/随机模式/样本校验；缺随机源一律抛错，不回落非确定性随机
 *   ② 起局       `resolveDrawSource` —— 建样本流（seeded / replay / interactiveSamples 三选一）
 *   ③ 格局判定   `computeReading`    —— 洗牌取牌 + 逐张正逆位（纯规则表查表 + 纯取整）
 *   ④ 输出装配   `assemble`          —— 按生产契约键序拼装
 * 四段之间只传普通对象；**禁止** IO / LLM / 网络 / 格式化文案 / `Math.random` / 时钟参与结果。
 *
 * == 规则唯一来源 ==
 *   牌组、牌阵、发牌公式、随机源口径**全部**取自 `src/rules/tarot.js`，本文件不复制任何
 *   牌名/牌位名/公式（README §2「调用方只读不抄」）。
 *
 * == 与旧实现的有意分歧（详见 rules/tarot.js 头部）==
 *   a. 缺 `seed/replay/interactiveSamples` 时旧实现走非确定性 `mode='system'`
 *      （实测两次调用输出不同）。本内核**一律抛 `PaipanInputError('missing_seed')`**。
 *   b. **牌义正文由内核自带**：`upright / reversedText / uprightKeywords / reversedKeywords /
 *      keywords / element / archetype` 取自 `src/rules/tarot-meanings.js`（**本内核自撰**的
 *      正文数据，非复制第三方文本），字段名/位置与旧实现一致 ⇒ 前端零改动。
 *      对拍中这些字段属**信息性差异**（文案层，与旧实现不同是预期结果）。
 *   c. 不产出 `timestamp` / `evidenceAnalysis`（对拍时本就 stripInternal 剥离）。
 *   d. `draw.method` / `draw.orientationRule` 文案自撰（信息性字段，不进关键字段）。
 */

import {
  TAROT_DECK,
  TAROT_DECK_SIZE,
  TAROT_DRAW_RULES,
  TAROT_SPREADS,
  TAROT_DEFAULT_SPREAD,
  createSeededRandom,
  drawRandomInt,
  shuffleDeck,
} from '../../rules/tarot.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';
import { TAROT_MEANINGS } from '../../rules/tarot-meanings.js';

/** meta.engineVersion —— 自研内核版本（与旧实现 0.2.2 有意不同，属信息性差异）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致（换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** 牌组 id 数组（洗牌对象；`TAROT_DECK` 已按 id 升序，故下标 = id - 1）。 */
const DECK_IDS = Object.freeze(TAROT_DECK.map((card) => card.id));

/** id → 牌名（本文件内唯一查表入口，数据仍来自 rules）。 */
const NAME_BY_ID = Object.freeze(Object.fromEntries(TAROT_DECK.map((card) => [card.id, card.name])));

/** 内核输入错误（缺随机源 / 牌阵未知 / 样本非法）。调用方据此返回 400，不得回落默认值。 */
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

/**
 * 取某张牌的**牌义正文**（数据唯一来源 = `rules/tarot-meanings.js`）。
 * 返回新对象并按旧实现字段顺序排列；关键词数组做浅拷贝，避免对拍/调用方拿到冻结引用。
 * 缺该牌牌义即内核缺陷（牌组与牌义表都由 rules 维护），**抛错而不是静默降级**。
 *
 * @param {number} id 牌 id（1–78）
 * @returns {{upright:string, reversedText:string, uprightKeywords:string[], reversedKeywords:string[], keywords:string[], element:string, archetype:string}}
 */
function cardMeaning(id) {
  const m = TAROT_MEANINGS[id];
  if (!m) throw new Error(`内核缺陷：塔罗牌 id ${id} 在 rules/tarot-meanings.js 中缺牌义数据。`);
  return {
    upright: m.upright,
    reversedText: m.reversedText,
    uprightKeywords: m.uprightKeywords.slice(),
    reversedKeywords: m.reversedKeywords.slice(),
    keywords: m.keywords.slice(),
    element: m.element,
    archetype: m.archetype,
  };
}

/** 抽样：依次取出 `count` 个样本，并记录到 `used`（= 旧实现 meta.random.samples 的口径）。 */
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
 *   - `spreadType`：必须是 `rules/tarot.js` 的牌阵键；缺省（undefined/null）按 `single`。
 *   - `options.seed`：数字（有限）或文本 —— 确定性种子（**唯一允许的随机源**）。
 *   - `options.replay`：非空数值数组 —— 重放既有样本（`[0,1)`）。
 *   - `options.interactiveSamples`：数值数组，长度 = `2 × 牌位数`（成对：(取牌样本, 正逆位样本)）。
 *   - 三者**互斥**（旧实现同样互斥，实测）。
 *   - `options.question`：占问文本，仅信息性，不进结果（旧实现亦不进）。
 *
 * @param {object} params `{ spreadType, options }`
 * @returns {{spreadType:string, spread:object, mode:string, seed:*, replay:number[]|null,
 *   interactiveSamples:number[]|null, hashInput:object}}
 * @throws {PaipanInputError}
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('invalid_params', '塔罗抽牌入参必须是 { spreadType, options } 对象。');
  }
  const rawSpread = params.spreadType;
  if (rawSpread !== undefined && rawSpread !== null && typeof rawSpread !== 'string') {
    throw new PaipanInputError('invalid_spread_type', `spreadType 必须是牌阵键字符串（收到 ${typeof rawSpread}）。`);
  }
  const spreadType = rawSpread === undefined || rawSpread === null || rawSpread === ''
    ? TAROT_DEFAULT_SPREAD
    : rawSpread;
  const spread = TAROT_SPREADS[spreadType];
  if (!spread) {
    throw new PaipanInputError('unknown_spread_type', `未知的牌阵类型: ${rawSpread}`);
  }
  const rawOptions = params.options;
  if (rawOptions !== undefined && rawOptions !== null && (typeof rawOptions !== 'object' || Array.isArray(rawOptions))) {
    throw new PaipanInputError('invalid_options', 'options 必须是对象。');
  }
  const options = rawOptions || {};

  const hasSeed = options.seed !== undefined;
  const hasReplay = options.replay !== undefined;
  const hasInteractive = options.interactiveSamples !== undefined;

  if (hasSeed && (hasReplay || hasInteractive)) {
    throw new PaipanInputError('conflicting_random_source', 'seed、replay 与逐张样本只能提供一种。');
  }
  if (hasReplay && hasInteractive) {
    throw new PaipanInputError('conflicting_random_source', 'replay 与逐张样本只能提供一种。');
  }

  if (hasInteractive) {
    const samples = options.interactiveSamples;
    const need = spread.cardCount * TAROT_DRAW_RULES.interactiveSamplesPerCard;
    if (!Array.isArray(samples) || samples.length !== need) {
      throw new PaipanInputError(
        'invalid_interactive_samples',
        `${spread.name}需要按牌位逐张抽取${spread.cardCount}张牌（每张两个样本：取牌样本 + 正逆位样本，共 ${need} 个）。`,
      );
    }
    samples.forEach((value, i) => {
      if (!isSample(value)) {
        throw new PaipanInputError('invalid_interactive_samples', `第${i + 1}个逐张抽取样本无效（需 [0,1) 的有限数）: ${String(value)}`);
      }
    });
    return {
      spreadType, spread, mode: 'interactive', seed: undefined, replay: null,
      interactiveSamples: samples.slice(),
      hashInput: { capability: 'tarot', spreadType, mode: 'interactive', samples: samples.length },
    };
  }

  if (hasReplay) {
    const samples = options.replay;
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new PaipanInputError('invalid_replay', '随机重放样本必须是非空数组。');
    }
    const need = TAROT_DRAW_RULES.samplesTotal(spread.cardCount);
    if (samples.length < need) {
      throw new PaipanInputError('replay_exhausted', `随机重放样本已用尽：${spread.name}需要 ${need} 个样本，仅提供 ${samples.length} 个。`);
    }
    samples.forEach((value, i) => {
      if (!isSample(value)) {
        throw new PaipanInputError('invalid_replay', `第${i + 1}个重放样本无效（需 [0,1) 的有限数）: ${String(value)}`);
      }
    });
    return {
      spreadType, spread, mode: 'replay', seed: undefined, replay: samples.slice(),
      interactiveSamples: null,
      hashInput: { capability: 'tarot', spreadType, mode: 'replay', samples: samples.length },
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
      hashInput: { capability: 'tarot', spreadType, mode: 'seeded', seed: String(seed) },
    };
  }

  throw new PaipanInputError(
    'missing_seed',
    '塔罗抽牌必须显式给定确定性随机源：options.seed（数字或文本）、options.replay（样本数组）或 '
    + 'options.interactiveSamples（逐张样本）。旧实现在三者都缺时走非确定性的 system 随机'
    + '（实测两次调用输出不同），本内核禁止非确定性随机，故不沿用。'
    + '（调用方需自行生成 seed 传入，见节157 报告「接入注意」。）',
  );
}

/**
 * ② 起局：建立「样本流」。
 * seeded → 种子化随机源（顺序消耗）；replay / interactive → 直接按序取用给定样本。
 *
 * @param {ReturnType<typeof normalizeInput>} normalized ①的输出
 * @returns {{nextSample: () => number, samples: number[]}}
 */
export function resolveDrawSource(normalized) {
  const samples = [];
  if (normalized.mode === 'seeded') {
    return { nextSample: makeSampler(createSeededRandom(normalized.seed), samples), samples };
  }
  if (normalized.mode === 'replay') {
    let cursor = 0;
    const source = normalized.replay;
    const used = [];
    return {
      nextSample: makeSampler(() => {
        if (cursor >= source.length) throw new PaipanInputError('replay_exhausted', '随机重放样本已用尽。');
        const value = source[cursor];
        cursor += 1;
        return value;
      }, used),
      // 重放模式下旧实现 `meta.random.samples` 记录的是**调用方给的整个样本数组**（实测），
      // 故此处报告原数组而非消耗前缀。
      samples: source.slice(),
    };
  }
  // interactive：样本即入参，不做二次消耗（meta.random.samples 与旧实现一致 = 原样）
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
 * ③ 发牌判定：洗牌 + 取牌 + 逐张正逆位。纯规则查表 + 纯取整，可无 IO 反复重算。
 *
 * @param {object} input `{ normalized, nextSample }`
 * @returns {{drawn: Array<{id:number, name:string, reversed:boolean, reversedSample:number|null}>}}
 */
export function computeReading({ normalized, nextSample }) {
  const { spread } = normalized;
  if (normalized.mode === 'interactive') {
    // 不洗牌：按牌位顺序从余牌依样本逐张取牌（每张两个样本）
    const pool = DECK_IDS.slice();
    const drawn = [];
    for (let k = 0; k < spread.cardCount; k += 1) {
      const cardSample = nextSample();
      const orientationSample = nextSample();
      const index = drawRandomInt(cardSample, 0, pool.length - 1);
      const id = pool.splice(index, 1)[0];
      drawn.push({ id, name: NAME_BY_ID[id], reversed: orientationSample < TAROT_DRAW_RULES.orientationThreshold, reversedSample: orientationSample });
    }
    return { drawn };
  }
  const shuffled = shuffleDeck(DECK_IDS, nextSample);
  const drawn = [];
  for (let k = 0; k < spread.cardCount; k += 1) {
    const id = shuffled[k];
    const orientationSample = nextSample();
    drawn.push({ id, name: NAME_BY_ID[id], reversed: orientationSample < TAROT_DRAW_RULES.orientationThreshold, reversedSample: orientationSample });
  }
  return { drawn };
}

/**
 * ④ 输出装配（键序与旧实现 stripInternal 后一致：spreadType / spreadName / cards / meta / draw）。
 * **不**输出 timestamp / evidenceAnalysis（对拍时本就 stripInternal 剥离）。
 * 每张牌接回**内核自带的牌义正文**（`rules/tarot-meanings.js`，自撰，非复制第三方文本），
 * 字段名与位置与旧实现一致（upright / reversedText / uprightKeywords / reversedKeywords /
 * keywords / element / archetype），使前端解读段落零改动。
 *
 * @param {object} parts `{ normalized, reading, samples, now }`
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, reading, samples, now }) {
  const { spreadType, spread, mode } = normalized;
  const orientationOf = (reversed) => (reversed ? '逆位' : '正位');
  const cards = reading.drawn.map((card, i) => ({
    id: card.id,
    name: card.name,
    position: spread.positions[i],
    reversed: card.reversed,
    ...cardMeaning(card.id),
  }));
  const order = reading.drawn.map((card, i) => ({
    index: i + 1,
    position: spread.positions[i],
    cardId: card.id,
    cardName: card.name,
    orientation: orientationOf(card.reversed),
  }));
  const base = spreadType === 'single' ? 'tarot.single' : 'tarot.spread';
  const algorithm = mode === 'interactive' ? `${base}.interactive` : base;
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const random = { mode: mode === 'seeded' ? 'seeded' : mode === 'replay' ? 'replay' : 'system', samples: samples.slice() };
  if (mode === 'seeded') random.seed = normalized.seed;
  return {
    spreadType,
    spreadName: spread.name,
    cards,
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm,
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `${algorithm}:${inputHash}`,
      random,
    },
    draw: {
      deckSize: TAROT_DECK_SIZE,
      method: mode === 'interactive' ? TAROT_DRAW_RULES.interactiveMethodText : TAROT_DRAW_RULES.methodText,
      orientationRule: TAROT_DRAW_RULES.orientationRuleText,
      order,
    },
  };
}

/**
 * 塔罗抽牌（自研内核）。
 *
 * @param {object} params `{ spreadType: string, options: object, now?: Date }`
 *   - `spreadType`：牌阵键（缺省 `single`）。
 *   - `options.seed | options.replay | options.interactiveSamples`：**必须三选一**。
 *   - `now`：可选，仅用于 `meta.calculatedAt`（便于测试取固定值）；不参与任何排盘结果与哈希。
 * @returns {object} 生产契约形状的抽牌结果
 * @throws {PaipanInputError} 牌阵未知 / 缺随机源 / 随机源冲突 / 样本非法
 */
export function drawTarotSpreadCore(params) {
  const normalized = normalizeInput(params);                       // ① 输入归一化
  const { nextSample, samples } = resolveDrawSource(normalized);   // ② 起局（样本流）
  const reading = computeReading({ normalized, nextSample });      // ③ 发牌判定
  const now = params && params.now instanceof Date ? params.now : new Date();
  return assemble({ normalized, reading, samples, now });          // ④ 输出装配
}

export default drawTarotSpreadCore;
