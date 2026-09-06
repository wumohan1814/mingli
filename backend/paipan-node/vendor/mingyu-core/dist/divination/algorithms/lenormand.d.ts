/**
 * @file 雷诺曼牌算法
 * @传统依据 Petit Lenormand 通行牌序与组合读法；历史牌组参照 1799 年《Das Spiel der Hoffnung》资料。
 */
import type { LenormandData, LenormandSpreadType } from '../../types/divination';
import type { RandomOptions } from '../../shared/random';
export { analyzeLenormandEvidence, conditionLenormandTraditionalText } from '../lenormand-evidence';
export type { LenormandCardEvidence, LenormandCounterEvidenceFact, LenormandCounterSummaryFact, LenormandDrawFact, LenormandDrawOrderFact, LenormandEvidenceAnalysis, LenormandLayoutFact, LenormandLayoutCoverageFact, LenormandLimitationFact, LenormandSequenceFact, LenormandSpreadCoverageFact, LenormandTraditionalFact, } from '../lenormand-evidence';
export declare const LENORMAND_CARDS: {
    id: number;
    name: string;
    keywords: string[];
    meaning: string;
}[];
export declare const LENORMAND_SPREADS: Record<LenormandSpreadType, {
    name: string;
    positions: string[];
}>;
/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export declare function resolveInteractiveLenormandCards(spreadType: LenormandSpreadType, samples: readonly number[]): {
    id: number;
    name: string;
    keywords: string[];
    meaning: string;
}[];
/**
 * 雷诺曼牌组两牌组合含义（为配对解读提供传统关键词）
 * 如 "太阳+鱼" = 财运好、"鞭子+鼠" = 消耗性争执
 */
export declare const LENORMAND_FIXED_COMBINATIONS: Record<string, string>;
export declare function validateLenormandReferenceData(): void;
/**
 * 抽取雷诺曼牌阵
 *
 * 支持 single（单牌）、three（三张）、relationship（感情）、
 * decision（决策）、nine（九宫格）等 8 种牌阵。
 * 抽牌为随机洗牌，每次独立。
 *
 * @param spreadType 牌阵类型，默认 'single'。
 * @returns 雷诺曼牌阵数据对象 LenormandData，含牌面、位置和两牌组合含义。
 *
 * @example
 * ```ts
 * const result = drawLenormandSpread('single');
 * // result 包含 cards（牌面列表）和 combinations（组合含义）
 * ```
 */
export declare function drawLenormandSpread(spreadType?: LenormandSpreadType, options?: RandomOptions & {
    manualCardIds?: readonly number[];
    interactiveSamples?: readonly number[];
}): LenormandData;
