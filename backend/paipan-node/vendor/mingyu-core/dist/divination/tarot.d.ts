/**
 * @file 塔罗牌算法
 * @传统依据 Rider-Waite-Smith 体系及 A. E. Waite《The Pictorial Key to the Tarot》通行牌义。
 */
import { tarotSpreads } from './tarot-data';
import type { RandomOptions } from '../shared/random';
import type { TarotData, TarotSpreadType } from '../types/divination';
export { tarotCards, tarotSpreads } from './tarot-data';
export { analyzeTarotEvidence } from './tarot-evidence';
export type { TarotCardEvidence, TarotCounterEvidenceFact, TarotCounterSummaryFact, TarotDrawFact, TarotDrawOrderFact, TarotElementInteractionFact, TarotElementInteractionRelation, TarotEvidenceAnalysis, TarotLimitationFact, TarotSequenceFact, TarotSpreadCoverageFact, TarotThemeFact, TarotTraditionalFact, } from './tarot-evidence';
export interface TarotManualCardInput {
    id: number;
    reversed: boolean;
}
export interface TarotDrawOptions extends RandomOptions {
    manualCards?: readonly TarotManualCardInput[];
    /** 用户在前端逐张抽牌时产生的原始随机样本，每张牌依次使用抽牌与正逆位两个样本。 */
    interactiveSamples?: readonly number[];
}
export interface TarotInteractiveCard {
    id: number;
    name: string;
    reversed: boolean;
}
/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export declare function resolveInteractiveTarotCards(spreadType: TarotSpreadType, samples: readonly number[]): TarotInteractiveCard[];
export declare function drawSingleCard(options?: RandomOptions): {
    card: {
        name: string;
        type: string;
        number: number;
        suit?: undefined;
    } | {
        name: string;
        type: string;
        suit: string;
        number: number;
    };
    isReversed: boolean;
    position: string;
    timestamp: number;
} & {
    meta: import(".").CoreResultMeta;
};
export declare function drawSpreadCards(spreadType: keyof typeof tarotSpreads, options?: RandomOptions): {
    spreadType: "year" | "wealth" | "hexagram" | "single" | "three" | "love" | "career" | "decision" | "celtic" | "chakra" | "mindBodySpirit" | "horseshoe" | "holyTriangle" | "universal" | "fourElements" | "relationship" | "problemSolving" | "twelveHouses";
    spreadName: string;
    cards: {
        card: {
            name: string;
            type: string;
            number: number;
            suit?: undefined;
        } | {
            name: string;
            type: string;
            suit: string;
            number: number;
        };
        isReversed: boolean;
        position: string;
    }[];
    timestamp: number;
} & {
    meta: import(".").CoreResultMeta;
};
export declare function getCardKeywords(cardName: string): string;
export declare function getCardEvidence(cardName: string): {
    keywords: string[];
    element: string;
    archetype: string;
};
export declare function drawTarotSpread(spreadType?: TarotSpreadType, options?: TarotDrawOptions): TarotData;
