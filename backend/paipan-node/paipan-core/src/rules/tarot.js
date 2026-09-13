/**
 * 命理 · 自研排盘内核 · 规则源：塔罗（tarot）
 * ===========================================================================
 * 本文件是**塔罗发牌的单一权威规则源**（README §2）：牌组结构、牌阵牌位、发牌公式、
 * 正逆位口径、以及**发牌用种子化随机源**全部在此定义，全部 `Object.freeze`。
 *
 * 「发牌随机源（fnv1a + mulberry32）」与「洗牌公式（Fisher-Yates + randomInt）」是
 * 塔罗与雷诺曼**共用同一条口径**（黑盒实测两能力的样本序列在同 seed 下逐值相同）。
 * 因此这两个共用件在本文件（先落地的能力）里实现一次，`src/rules/lenormand.js`
 * **再导出**同一份实现——全仓库只有**一处**实现，不存在第二份拷贝（避免规则漂移）。
 * 若将来允许新增 `src/pipeline/random.js`，应把这两个共用件搬过去（本文件与 lenormand
 * 的再导出同时删除），届时改动仅两处 import。
 *
 * == 口径来源（全部由黑盒探针实测确认；只运行旧实现、不读其源码）==
 *   1. **随机源**：`state0 = FNV-1a-32(String(seed))`（逐 **UTF-16 码元**：`h ^= str.charCodeAt(i)`），
 *      其后为 **mulberry32**（`state = (state + 0x6D2B79F5) | 0`，再走
 *      `t = imul(state ^ state>>>15, state|1)` → `t = (t + imul(t ^ t>>>7, t|61)) ^ t`
 *      → `(t ^ t>>>14) >>> 0`），输出 `uint32 / 2^32`。
 *      实测证据：全部 36 个探针 seed（含 0/负数/浮点/大数/文本/中文/空串）下，
 *      本式复现旧实现 `meta.random.samples` **逐位相等（0 误差）**；
 *      且样本全部是 2^-32 的整数倍（排除 Alea/xorwow 等 double 精度通道），
 *      逐字节 FNV 变体在非 ASCII 种子上失败（证明是码元口径而非 UTF-8 字节口径）。
 *   2. **洗牌**：标准 **Fisher-Yates 降序**——`for (i = n-1; i > 0; i--)`，
 *      `j = randomInt(0, i)`，其中 `randomInt(min,max) = min + floor(sample*(max-min+1))`；
 *      抽牌 = 洗好后**自牌顶（下标 0）按牌位顺序连续取**。
 *      实测证据：78 张与 36 张、40 个 seed × 18/8 个牌阵全部牌位逐一相等（见 4.）。
 *   3. **随机样本消耗数**：洗牌固定消耗 `n-1`（塔罗 77 / 雷诺曼 35）个样本，
 *      塔罗再**每张牌 1 个**样本定正逆位；因此 `meta.random.samples` 长度 =
 *      `77 + 牌位数`（塔罗） / `35`（雷诺曼，与牌位数无关）——实测逐牌阵吻合。
 *   4. **正逆位**：逐张独立抽样，`sample < 0.5` 判**逆位**，否则**正位**（实测 11/11 吻合）。
 *   5. **逐张录入模式**（`interactiveSamples`）：不洗牌，直接从余牌按
 *      `index = floor(sample * 余牌数)` 取牌并移出余牌；塔罗样本**成对**给出
 *      `(取牌样本, 正逆位样本)`，共 `2 × 牌位数` 个；雷诺曼每张 1 个。
 *      实测：模型与旧实现在 tarot 4 个牌阵 + lenormand 4 个牌阵上逐一相等。
 *
 * == 与旧实现的有意分歧（对拍报告逐条登记）==
 *   a. **必须显式给定随机源**：旧实现缺 `seed/replay/interactiveSamples` 时走
 *      `mode = 'system'`（实测其输出两次调用不同 ⇒ 用了非确定性随机）。本内核
 *      **禁止非确定性随机**（README §1 纪律 3），一律抛 `PaipanInputError('missing_seed')`。
 *      ⇒ 父节把该能力切到内核前，**调用方必须自己生成 seed 并传入** `options.seed`
 *      （前端当前不传 seed，见节157 报告「接入注意」）。
 *   b. **牌义正文不产出**：旧实现每张牌还带 `upright/reversedText/uprightKeywords/
 *      reversedKeywords/keywords/element/archetype`（第三方文案）。本内核**只发牌**，
 *      这些字段由前端 CONTENT / 调用方另行提供（节157 任务书口径，避免复制第三方文本）。
 *   c. **`evidenceAnalysis` / `timestamp` 不产出**：二者本就在对拍时被 `stripInternal`
 *      剥离，属内部字段。
 *   d. **牌阵表口径 = 产品口径（父节已裁决，本表据此改写）**：本表 = `vendor 引擎 +
 *      覆盖层 mingli-tarot-spreads.mjs` 的生产装配结果，即 server.mjs 启动后
 *      `tarotSpreads` 的真实内容：
 *        · 15 个牌阵沿用 vendor 定义（single/three/love/career/decision/chakra/year/
 *          mindBodySpirit/holyTriangle/universal/fourElements/relationship/wealth/
 *          problemSolving/twelveHouses）；
 *        · **celtic / horseshoe / hexagram 三阵按覆盖层口径改写**（牌位名 +
 *          spreadName：马蹄铁牌阵→七张马蹄、六芒星牌阵→六芒星）；
 *        · `fourSeasons`（四牌四季，春/夏/秋/冬）为覆盖层新增阵。
 *      对拍基准同步改为**覆盖后引擎** `tools/compare/legacy-tarot.mjs`
 *      （先加载 vendor 再 `applyMingliTarotSpreads`，与 server.mjs 生产装配一致）。
 *      因此 19 个牌阵**全部可比对**，且牌位名与线上展示零变化（前端展示不退化）。
 *   e. **`draw.method` / `draw.orientationRule` 文案自撰**：两字段语义与旧实现相同，
 *      但措辞为本内核自写（铁纪律：不从旧实现复制任何文本）。二者属**信息性字段**，
 *      不进关键字段。
 *
 * == 来源登记 ==
 *   - 78 张韦特系牌名（大阿卡纳 22 + 权杖/圣杯/宝剑/钱币各 14）、牌组顺序与 id 编号：
 *     **公有领域传统牌组结构**（Rider-Waite-Smith 体系，1909 年出版，已进入公有领域）；
 *     与旧实现一致由「盘面标识必须一致」要求（铁纪律 6）与前端
 *     `frontend/public/data/content/tarot/cards-zh.js`（节135）的 id/name 映射对照确认。
 *   - 牌阵牌位名：**公有领域传统牌阵命名**（凯尔特十字 Waite 位次、Barbara Moore 经典
 *     马蹄、Star of David 六芒星、时间流等公开命名）；采用**产品口径**（覆盖层
 *     `mingli-tarot-spreads.mjs`，REQ-122 用户拍板），与覆盖后引擎逐字一致由对拍门禁强制。
 *   - `fourSeasons` 牌位（春/夏/秋/冬）：本仓自研定义（`mingli-tarot-spreads.mjs`，REQ-122）。
 *   - 发牌公式与随机源：**对拍实测口径**（本文件头部 1–5 条，探针证据见节157 报告）。
 */

/** 深度冻结（浅层 `Object.freeze` 挡不住内部数组被改）。rules 目录内共用的纯工具。 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/* =========================================================================
 * 一、发牌共用件（塔罗 + 雷诺曼同一条口径；唯一实现位置）
 * ======================================================================= */

/** 32 位 FNV-1a（逐 UTF-16 码元），与对拍实测的旧实现口径一致。 */
export function fnv1a32(text) {
  let h = 0x811c9dc5;
  const str = String(text);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 种子化随机源：`mulberry32(fnv1a32(String(seed)))`，返回 `[0,1)` 的 32 位均匀数。
 * **唯一允许的随机源**（内核禁止 Math.random / 时钟参与结果）。
 *
 * @param {number|string} seed 种子（数字或文本；一律先 `String()` 再哈希——实测同 1 与 '1' 等价）
 * @returns {() => number} 每次调用返回一个 `k / 2^32`（0 ≤ k < 2^32）
 */
export function createSeededRandom(seed) {
  let a = fnv1a32(String(seed)) | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 发牌随机源公式文字版（给规则表/文档引用；实现在 `createSeededRandom`）。
 * @type {string}
 */
export const DRAW_RANDOM_FORMULA = 'state0 = FNV-1a-32(String(seed))；state_{n+1} = (state_n + 0x6D2B79F5) | 0；'
  + 't1 = imul(state ^ state>>>15, state|1)；t2 = (t1 + imul(t1 ^ t1>>>7, 61|t1)) ^ t1；'
  + 'sample = ((t2 ^ t2>>>14) >>> 0) / 2^32';

/**
 * 由样本取整数（发牌唯一取整口径）：`min + floor(sample * (max - min + 1))`。
 * @param {number} sample `[0,1)` 样本
 * @param {number} min 下界（含）
 * @param {number} max 上界（含）
 * @returns {number} 整数
 */
export function drawRandomInt(sample, min, max) {
  return min + Math.floor(sample * (max - min + 1));
}

/**
 * Fisher-Yates 降序洗牌（发牌唯一洗牌口径）。
 * 消耗 `ids.length - 1` 个样本（78 张 → 77 个；36 张 → 35 个）。
 *
 * @param {ReadonlyArray<number>} ids 牌组（按 id 升序）
 * @param {() => number} nextSample 取样本（会按调用次数消耗）
 * @returns {number[]} 洗好的新数组（不改入参）
 */
export function shuffleDeck(ids, nextSample) {
  const arr = ids.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = drawRandomInt(nextSample(), 0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 洗牌公式文字版（供文档与测试逐字断言）。
 * @type {string}
 */
export const SHUFFLE_FORMULA = 'for (i = n-1; i > 0; i--) { j = min + floor(sample*(max-min+1)) 取 j∈[0,i]；交换 a[i], a[j] }；'
  + '抽牌 = 洗好后自牌顶（下标 0）按牌位顺序连续取';

/* =========================================================================
 * 二、牌组结构（78 张，韦特系；id 与牌名与旧实现逐字一致）
 * ======================================================================= */

/** 大阿卡纳 22 张，id 1–22。 */
export const TAROT_MAJOR_ARCANA = deepFreeze([
  '愚者', '魔术师', '女祭司', '女皇', '皇帝', '教皇', '恋人', '战车', '力量', '隐士', '命运之轮',
  '正义', '倒吊人', '死神', '节制', '恶魔', '塔', '星星', '月亮', '太阳', '审判', '世界',
]);

/** 小阿卡纳四花色（顺序即 id 区间顺序：权杖→圣杯→宝剑→钱币，每花色 14 张）。 */
export const TAROT_MINOR_SUITS = deepFreeze([
  { key: 'wands', label: '权杖' },
  { key: 'cups', label: '圣杯' },
  { key: 'swords', label: '宝剑' },
  { key: 'pentacles', label: '钱币' },
]);

/** 小阿卡纳 14 个牌阶名（王牌 + 二…十 + 侍者/骑士/王后/国王）。 */
export const TAROT_MINOR_RANKS = deepFreeze([
  '王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍者', '骑士', '王后', '国王',
]);

/** 78 张牌组（`{id, name, suit, rank}`），**数组下标 = id - 1**（洗牌取牌依赖此顺序）。 */
export const TAROT_DECK = deepFreeze((() => {
  const deck = [];
  TAROT_MAJOR_ARCANA.forEach((name, i) => {
    // 大阿卡纳无牌阶（编号是序号而非阶级，故 rank 置 null，不在此编造牌阶语义）
    deck.push({ id: i + 1, name, suit: 'major', rank: null });
  });
  let id = TAROT_MAJOR_ARCANA.length + 1;
  for (const suit of TAROT_MINOR_SUITS) {
    for (const rank of TAROT_MINOR_RANKS) {
      deck.push({ id, name: `${suit.label}${rank}`, suit: suit.key, rank });
      id += 1;
    }
  }
  return deck;
})());

/** 牌组规模（洗牌消耗 = deckSize - 1）。 */
export const TAROT_DECK_SIZE = TAROT_DECK.length;

/* =========================================================================
 * 三、牌阵表（唯一权威位置）
 * ======================================================================= */

/**
 * 牌阵表：`spreadType → { name, positions, cardCount }`。
 * 15 个沿用 vendor 定义、`celtic/horseshoe/hexagram` 三阵按覆盖层（REQ-122）改写、
 * `fourSeasons` 为覆盖层新增阵 —— 合计 19 阵，牌位名逐字一致（对拍门禁对象）。
 */
export const TAROT_SPREADS = deepFreeze({
  single: { name: '单牌指引', positions: ['当前指引'], cardCount: 1 },
  three: { name: '时间流牌阵', positions: ['过去', '现在', '未来'], cardCount: 3 },
  love: { name: '爱情牌阵', positions: ['你的内心', '对方的内心', '关系现状', '发展建议', '未来走向'], cardCount: 5 },
  career: { name: '事业牌阵', positions: ['当前状况', '优势', '挑战', '机会', '行动建议', '结果'], cardCount: 6 },
  decision: { name: '选择牌阵', positions: ['现状', '选择A', '选择A结果', '选择B', '选择B结果', '最佳建议'], cardCount: 6 },
  celtic: {
    // 产品口径（覆盖层 REQ-122，Waite 经典位次）：1 现状 / 2 交叉影响 / 3 目标与理想 /
    // 4 根基 / 5 近期过去 / 6 临近未来 / 7 你的立场 / 8 环境与他人 / 9 希望与恐惧 / 10 结果
    name: '凯尔特十字',
    positions: [
      '现状', '交叉影响', '目标与理想', '根基', '近期过去',
      '临近未来', '你的立场', '环境与他人', '希望与恐惧', '结果',
    ],
    cardCount: 10,
  },
  chakra: {
    name: '七脉轮牌阵',
    positions: ['海底轮(生存)', '脐轮(情感)', '太阳轮(意志)', '心轮(爱)', '喉轮(表达)', '眉心轮(直觉)', '顶轮(灵性)'],
    cardCount: 7,
  },
  year: {
    name: '年运牌阵',
    positions: ['整体运势', '1-3月', '4-6月', '7-9月', '10-12月', '爱情', '事业', '财运', '健康', '建议', '挑战', '机遇'],
    cardCount: 12,
  },
  mindBodySpirit: { name: '身心灵牌阵', positions: ['心灵/思想', '身体/行动', '精神/灵性'], cardCount: 3 },
  horseshoe: {
    // 产品口径（覆盖层 REQ-122，Barbara Moore 经典马蹄）：1 过去 / 2 现在 / 3 近期未来 /
    // 4 你的态度 / 5 外部影响 / 6 阻碍 / 7 结果（spreadName 亦按覆盖层：七张马蹄）
    name: '七张马蹄',
    positions: ['过去', '现在', '近期未来', '你的态度', '外部影响', '阻碍', '结果'],
    cardCount: 7,
  },
  holyTriangle: { name: '圣三角牌阵', positions: ['问题根源', '当前状况', '发展结果'], cardCount: 3 },
  universal: { name: '万能牌阵', positions: ['当前状况', '主要阻力', '可用资源', '建议行动', '发展趋势'], cardCount: 5 },
  fourElements: { name: '四元素牌阵', positions: ['核心主题', '火元素·行动', '水元素·情感', '风元素·思考', '土元素·现实'], cardCount: 5 },
  hexagram: {
    // 产品口径（覆盖层 REQ-122，Star of David 双层结构）：上三角精神层 1 过去 / 2 现在 /
    // 3 未来 + 下三角现实层 4 原因 / 5 环境 / 6 策略 + 中心核心 7 核心/指示牌
    // （spreadName 亦按覆盖层：六芒星）
    name: '六芒星',
    positions: ['过去', '现在', '未来', '原因', '环境', '策略', '核心/指示牌'],
    cardCount: 7,
  },
  relationship: { name: '关系牌阵', positions: ['你的状态', '对方的状态', '你的需求', '对方的需求', '关系核心', '关系走向'], cardCount: 6 },
  wealth: { name: '财富牌阵', positions: ['当前财务状态', '收入机会', '支出与风险', '可用资源', '改善建议'], cardCount: 5 },
  problemSolving: { name: '问题解决牌阵', positions: ['问题表象', '根本原因', '主要阻力', '突破方向', '行动结果'], cardCount: 5 },
  twelveHouses: {
    name: '十二宫牌阵',
    positions: ['自我与外在', '金钱与价值', '学习与沟通', '家庭与根基', '创造与恋爱', '工作与日常', '伴侣与合作', '共享资源与转变', '远行与信念', '事业与名望', '社群与愿景', '潜意识与休整'],
    cardCount: 12,
  },
  fourSeasons: { name: '四牌四季', positions: ['春', '夏', '秋', '冬'], cardCount: 4 },
});

/**
 * 对拍基准（覆盖后引擎 `tools/compare/legacy-tarot.mjs`）可比对的牌阵 = 全部 19 阵。
 * 覆盖层 `applyMingliTarotSpreads` 会把 `fourSeasons` 写进 vendor 的 `tarotSpreads`，
 * 因此该阵在覆盖后引擎上同样可出牌 ⇒ 也可比对（夹具是否覆盖由父节决定，见报告）。
 */
export const TAROT_LEGACY_COMPARABLE_SPREADS = deepFreeze([
  'single', 'three', 'love', 'career', 'decision', 'celtic', 'chakra', 'year', 'mindBodySpirit',
  'horseshoe', 'holyTriangle', 'universal', 'fourElements', 'hexagram', 'relationship', 'wealth',
  'problemSolving', 'twelveHouses', 'fourSeasons',
]);

/** 默认牌阵（缺 `spreadType` 时；与旧实现默认 `'single'` 一致）。 */
export const TAROT_DEFAULT_SPREAD = 'single';

/* =========================================================================
 * 四、口径常量表（对拍门禁外的口径事实，供测试逐字断言）
 * ======================================================================= */

export const TAROT_DRAW_RULES = deepFreeze({
  deckSize: TAROT_DECK_SIZE,
  shuffle: SHUFFLE_FORMULA,
  randomInt: 'min + floor(sample * (max - min + 1))',
  orientation: '每张牌独立取 1 个样本，sample < 0.5 判逆位，否则判正位',
  orientationThreshold: 0.5,
  shuffleSamples: TAROT_DECK_SIZE - 1,
  samplesPerCard: 1,
  samplesTotal: (cardCount) => (TAROT_DECK_SIZE - 1) + cardCount,
  interactiveSamplesPerCard: 2,
  /** 自撰文案（信息性字段；不复制旧实现文本）。 */
  methodText: 'Fisher-Yates 洗牌，按牌位顺序自牌顶连续取牌',
  orientationRuleText: '逐张独立抽样：样本 < 0.5 判逆位，否则判正位',
  interactiveMethodText: '不洗牌，按牌位顺序从余牌中依样本逐张取牌',
});

export default TAROT_SPREADS;
