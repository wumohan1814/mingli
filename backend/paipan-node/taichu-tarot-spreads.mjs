/**
 * 太初塔罗牌阵覆盖层（REQ-122）
 *
 * 目标：不动 vendored mingyu-core（backend/paipan-node/vendor/）源码，按太初口径
 * 就地覆盖/新增 `tarotSpreads` 中的牌阵定义。ESM 的 `export const tarotSpreads` 是
 * 共享对象引用，server.mjs 引入本层并调用 applyTaichuTarotSpreads(tarotSpreads) 后，
 * computeTarot / drawTarotSpread 读取到的即覆盖后的定义，立即生效。
 *
 * 口径（用户拍板）：
 *   - 凯尔特十字按 Waite 位次（10 张）
 *   - 七张马蹄按经典 Barbara Moore（7 张）
 *   - 六芒星按 Star of David 双层结构（上三角精神 3 位 + 下三角现实 3 位 + 中心核心 1 位）
 *   - 四牌四季为新增定义（4 张：春/夏/秋/冬）
 * 命名冲突项采 vendored 版（关系牌阵 6 卡 / 年运牌阵 12 卡），「五牌关系(5)」
 * 「13 张年度展望(13)」取消，无需新增。其余 10 个直接开放的牌阵
 * （chakra/year/mindBodySpirit/holyTriangle/universal/fourElements/relationship/
 * wealth/problemSolving/twelveHouses）沿用 vendored 定义，不在此覆盖。
 */
export const TAICHU_TAROT_SPREADS = {
  // 四牌四季（新增，REQ-122）：1 春 / 2 夏 / 3 秋 / 4 冬
  fourSeasons: {
    name: '四牌四季',
    description: '以春、夏、秋、冬四季四张牌，观察一整年的季候运势与节奏。',
    positions: ['春', '夏', '秋', '冬'],
    cardCount: 4,
  },
  // 凯尔特十字（覆盖为 Waite 位次，REQ-122）：
  // 1 现状 / 2 交叉影响 / 3 目标与理想 / 4 根基 / 5 近期过去 /
  // 6 临近未来 / 7 你的立场 / 8 环境与他人 / 9 希望与恐惧 / 10 结果
  celtic: {
    name: '凯尔特十字',
    description: '以十张牌层层展开复杂问题的现状、交叉影响、根基、环境与最终结果（Waite 经典位次）。',
    positions: [
      '现状', '交叉影响', '目标与理想', '根基', '近期过去',
      '临近未来', '你的立场', '环境与他人', '希望与恐惧', '结果',
    ],
    cardCount: 10,
  },
  // 七张马蹄（覆盖为 Barbara Moore 经典马蹄，REQ-122）：
  // 1 过去 / 2 现在 / 3 近期未来 / 4 你的态度 / 5 外部影响 / 6 阻碍 / 7 结果
  horseshoe: {
    name: '七张马蹄',
    description: '以七张牌马蹄形展开，纵观问题从过去到结果的完整脉络（Barbara Moore 经典马蹄）。',
    positions: ['过去', '现在', '近期未来', '你的态度', '外部影响', '阻碍', '结果'],
    cardCount: 7,
  },
  // 六芒星（覆盖为 Star of David 双层结构，REQ-122）：
  // 上三角精神层 1 过去 / 2 现在 / 3 未来 + 下三角现实层 4 原因 / 5 环境 / 6 策略
  // + 中心核心 1 位 7 核心/指示牌
  hexagram: {
    name: '六芒星',
    description: '上三角精神层（过去/现在/未来）+ 下三角现实层（原因/环境/策略）+ 中心核心牌，双层透视复杂问题（Star of David）。',
    positions: ['过去', '现在', '未来', '原因', '环境', '策略', '核心/指示牌'],
    cardCount: 7,
  },
};

/**
 * 把太初牌阵定义就地写入传入的 tarotSpreads（ESM 共享对象引用）：
 * 新增 fourSeasons、覆盖 celtic/horseshoe/hexagram；不改动 vendored 文件。
 */
export function applyTaichuTarotSpreads(tarotSpreads) {
  for (const [key, def] of Object.entries(TAICHU_TAROT_SPREADS)) {
    tarotSpreads[key] = def;
  }
  return tarotSpreads;
}
