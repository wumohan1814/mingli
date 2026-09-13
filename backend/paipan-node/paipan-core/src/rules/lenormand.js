/**
 * 命理 · 自研排盘内核 · 规则源：雷诺曼（lenormand）
 * ===========================================================================
 * 本文件是**雷诺曼发牌的单一权威规则源**（README §2）：36 张牌表、8 个牌阵牌位、
 * 大桌/九宫的宫位与行列几何、以及发牌口径（沿用与塔罗同一条随机源/洗牌口径）。
 *
 * == 口径来源（黑盒探针实测；只运行旧实现、不读其源码）==
 *   1. 牌组 36 张、顺序即 id 1–36；牌名与旧实现逐字一致（公有领域传统雷诺曼牌名，
 *      并与前端 `frontend/public/js/views-xishi.js` 的 `LENORMAND_DECK` +
 *      `LN_NAME_ALIAS`（骑士→骑手 等）映射对照确认：**后端口径的牌名必须保持**
 *      骑士/孩子/路/男士/女士/十字架，前端才有别名可映射）。
 *   2. 洗牌与取牌：与塔罗**同一条口径**（Fisher-Yates 降序 + 自牌顶连续取），
 *      36 张固定消耗 35 个样本；雷诺曼**无正逆位**，故样本数恒为 35（与牌位数无关）——
 *      实测 8 个牌阵全部为 35，逐值与本内核一致。
 *   3. **九宫/大桌的行列与宫位**（实测）：
 *      - `nine`：**3 列**网格，`row = floor(i/3)+1`、`column = i%3+1`，**无 house**；
 *      - `grandTableau`：**9 列 × 4 行**（传统大桌排布，实测逐宫确认：
 *        下标 0–8 → `1,1`…`1,9`；下标 9–17 → `2,1`…`2,9`；共 36 宫），
 *        `row = floor(i/9)+1`、`column = i%9+1`，
 *        `house = 第 i+1 宫的宫名`，牌位名 = `第{i+1}宫（{宫名}宫）`，
 *        其中宫名序列**等于牌名序列**（第 1 宫=骑士宫 … 第 36 宫=十字架宫，实测逐宫吻合）；
 *      - 其余牌阵（single/three/five/relationship/decision/element）**无 row/column/house**。
 *   4. **手工录入模式**（`options.manualCardIds`，前端 REQ-069 产线在用）：
 *      不给随机源、不洗牌，直接按牌位顺序成牌；实测该模式 `meta.random` **不存在**、
 *      `meta.algorithm = 'lenormand.spread.manual'`。校验口径（实测）：长度必须
 *      等于牌位数、必须是 1–36 的整数、同一牌阵不得重复录入同一张牌。
 *   5. 逐张样本模式（`options.interactiveSamples`）：每牌位 1 个样本，
 *      `index = floor(sample * 余牌数)`；实测 4 个牌阵逐一吻合。
 *
 * == 与旧实现的有意分歧 ==
 *   a. 缺随机源时旧实现走非确定性 `mode='system'`；本内核一律抛
 *      `PaipanInputError('missing_seed')`（同 tarot，见 rules/tarot.js 分歧 a）。
 *   b. 牌义正文（`keywords / meaning / theme / detail`）与组合文案
 *      （`combinations / layoutEvidence`）**不产出**：属第三方文案，内核只发牌。
 *   c. `evidenceAnalysis / timestamp` 不产出（对拍时本就被 stripInternal 剥离）。
 *   d. `draw.method` 文案自撰（信息性字段，不复制旧实现文本）。
 *
 * == 共用件说明 ==
 *   发牌随机源与洗牌公式是塔罗/雷诺曼**共用同一条口径**，实现在
 *   `src/rules/tarot.js`（唯一实现位置），本文件**再导出**同一份实现，
 *   以保证「同一 seed 两能力样本序列相同」这条实测事实不会因两份拷贝而漂移。
 *
 * == 来源登记 ==
 *   - 36 张牌名与顺序：公有领域传统雷诺曼牌组（19 世纪，Petit Lenormand）。
 *   - 牌阵牌位名：传统牌阵命名（三牌事件线/五牌十字/九宫/大桌等），与旧实现逐字一致
 *     由对拍门禁强制。
 *   - 宫名（骑士宫…十字架宫）：传统「大桌 36 宫」命名，与牌名同序（实测确认）。
 */

export {
  fnv1a32 as lenormandFnv1a32,
  createSeededRandom as createLenormandRandom,
  drawRandomInt as lenormandDrawRandomInt,
  shuffleDeck as shuffleLenormandDeck,
  DRAW_RANDOM_FORMULA as LENORMAND_DRAW_RANDOM_FORMULA,
  SHUFFLE_FORMULA as LENORMAND_SHUFFLE_FORMULA,
} from './tarot.js';


/** 深度冻结（浅层 `Object.freeze` 挡不住内部数组被改）。rules 目录内共用的纯工具。 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/* =========================================================================
 * 一、牌组（36 张；数组下标 = id - 1，洗牌取牌依赖此顺序）
 * ======================================================================= */

/** 36 张牌名（id 1–36，与旧实现逐字一致）。 */
export const LENORMAND_CARD_NAMES = deepFreeze([
  '骑士', '三叶草', '船', '房子', '树', '云', '蛇', '棺材', '花束', '镰刀', '鞭子', '鸟',
  '孩子', '狐狸', '熊', '星星', '鹳', '狗', '塔', '花园', '山', '路', '老鼠', '心',
  '戒指', '书', '信', '男士', '女士', '百合', '太阳', '月亮', '钥匙', '鱼', '锚', '十字架',
]);

/** 36 张牌组（`{id, name, house}`；`house` = 大桌宫名，与牌名同序）。 */
export const LENORMAND_DECK = deepFreeze(LENORMAND_CARD_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  house: name,
})));

/** 牌组规模（洗牌固定消耗 = deckSize - 1 = 35）。 */
export const LENORMAND_DECK_SIZE = LENORMAND_DECK.length;

/** 大桌 36 宫宫名序列（= 牌名序列）。 */
export const LENORMAND_HOUSES = deepFreeze(LENORMAND_DECK.map((c) => c.house));

/* =========================================================================
 * 二、牌阵表（唯一权威位置）
 * ======================================================================= */

/**
 * 牌阵表：`spreadType → { name, positions, cardCount, layout }`。
 * `layout` ∈ `'none' | 'grid3' | 'grandTableau'`（决定是否带 row/column/house）。
 * 牌位名逐字与旧实现一致（对拍门禁对象）；`cardCount` 由牌位数派生（旧实现表里没有该键，
 * 内核补上以避免调用方各自 `positions.length` 二次推导）。
 */
const LENORMAND_SPREAD_DEFS = {
  single: { name: '单牌线索', positions: ['核心线索'], layout: 'none' },
  three: { name: '三牌事件线', positions: ['起因', '现状', '走向'], layout: 'none' },
  five: {
    name: '五牌十字阵',
    positions: ['过去背景', '当前处境', '隐藏因素', '外在助力', '最终走向'],
    layout: 'none',
  },
  relationship: {
    name: '关系牌阵',
    positions: ['你的状态', '对方状态', '关系纽带', '隐藏因素', '后续走向'],
    layout: 'none',
  },
  decision: {
    name: '选择牌阵',
    positions: ['当前处境', '选择A', '选择A走向', '选择B', '选择B走向', '关键建议'],
    layout: 'none',
  },
  nine: { name: '九宫牌阵', positions: ['左上', '上方', '右上', '左侧', '核心', '右侧', '左下', '下方', '右下'], layout: 'grid3' },
  element: {
    name: '元素牌阵',
    positions: ['火（行动/能量）', '水（情感/直觉）', '风（思维/沟通）', '土（物质/根基）'],
    layout: 'none',
  },
  grandTableau: {
    name: '大桌牌阵',
    positions: LENORMAND_HOUSES.map((house, i) => `第${i + 1}宫（${house}宫）`),
    layout: 'grandTableau',
  },
};

/** 牌阵表（唯一权威位置；`Object.freeze` 深度冻结）。 */
export const LENORMAND_SPREADS = deepFreeze(Object.fromEntries(
  Object.entries(LENORMAND_SPREAD_DEFS).map(([key, def]) => [key, { ...def, cardCount: def.positions.length }]),
));

/** 旧实现可比对的牌阵（本内核全部 8 阵均可对拍）。 */
export const LENORMAND_COMPARABLE_SPREADS = deepFreeze(Object.keys(LENORMAND_SPREADS));

/** 默认牌阵（缺 `spreadType` 时；与旧实现默认 `'single'` 一致）。 */
export const LENORMAND_DEFAULT_SPREAD = 'single';

/** 九宫布局列数。 */
export const LENORMAND_NINE_COLUMNS = 3;

/** 大桌布局列数（9 列 × 4 行 = 36 宫，实测）。 */
export const LENORMAND_GRAND_COLUMNS = 9;

/* =========================================================================
 * 三、口径常量表
 * ======================================================================= */

export const LENORMAND_DRAW_RULES = deepFreeze({
  deckSize: LENORMAND_DECK_SIZE,
  shuffleSamples: LENORMAND_DECK_SIZE - 1,
  samplesPerCard: 0,
  hasOrientation: false,
  interactiveSamplesPerCard: 1,
  shuffle: 'for (i = n-1; i > 0; i--) { j = min + floor(sample*(max-min+1)) 取 j∈[0,i]；交换 a[i], a[j] }；抽牌 = 洗好后自牌顶（下标 0）按牌位顺序连续取',
  /** 自撰文案（信息性字段；不复制旧实现文本）。 */
  methodText: 'Fisher-Yates 洗牌，按牌位顺序自牌顶连续取牌',
  manualMethodText: '按牌位手工录入（调用方给定牌号顺序，不洗牌、不抽随机样本）',
  interactiveMethodText: '不洗牌，按牌位顺序从余牌中依样本逐张取牌',
});

/**
 * 由牌位下标取布局落点（九宫 / 大桌）。
 * 实测口径：row/column 由下标按固定列数换算；大桌另有 house = 该宫的宫名（与牌名同序）。
 *
 * @param {string} layout `none | grid3 | grandTableau`
 * @param {number} index 0 起的牌位下标
 * @returns {{row?: number, column?: number, house?: string}}
 */
export function lenormandLayoutOf(layout, index) {
  if (layout === 'grid3') {
    return {
      row: Math.floor(index / LENORMAND_NINE_COLUMNS) + 1,
      column: (index % LENORMAND_NINE_COLUMNS) + 1,
    };
  }
  if (layout === 'grandTableau') {
    return {
      house: LENORMAND_HOUSES[index],
      row: Math.floor(index / LENORMAND_GRAND_COLUMNS) + 1,
      column: (index % LENORMAND_GRAND_COLUMNS) + 1,
    };
  }
  return {};
}

export default LENORMAND_SPREADS;
