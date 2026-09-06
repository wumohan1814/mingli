import type { QimenData } from '../../../../types/divination';
export interface QimenPriorityPalace {
    gong: number;
    name: string;
    /** @deprecated 旧版排序兼容字段，固定为 0；重点宫位不再按总分判断。 */
    score: number;
    reasons: string[];
}
/**
 * 汇总需要重点查看的宫位。
 *
 * 输出顺序是可解释的证据来源顺序：值符相关洞察、值使/其他有利洞察、风险洞察、
 * 经典格局、天地盘干关系、方位事实。这里只归集候选，不把不同性质的证据换算为总分。
 */
export declare function createQimenPriorityPalaces(data: QimenData): QimenPriorityPalace[];
/**
 * 依据《烟波钓叟歌》“吉格逢迫吉不就，凶格逢制灾不侵”的格局成破与空迫制化实效判定
 */
export declare function evaluateQimenPatternFulfillment(data: QimenData): string[];
