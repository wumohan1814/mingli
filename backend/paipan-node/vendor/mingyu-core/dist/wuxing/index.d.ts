import { BRANCH_WUXING, MONTH_LING_WUXING, getSeasonState, getBranchWuxing } from '../ganzhi/relations';
export { WUXING } from '../ganzhi/relations';
export type { Wuxing } from '../ganzhi/relations';
/** 五行相生：a 生 b？委托 tyme4ts Element */
export declare function isSheng(a: string, b: string): boolean;
/** 五行相克：a 克 b？委托 tyme4ts Element */
export declare function isKe(a: string, b: string): boolean;
export { BRANCH_WUXING, MONTH_LING_WUXING, getSeasonState, getBranchWuxing };
/**
 * 统计一组干支的五行分布
 * @param items 天干或地支数组（混合亦可）
 * @param options.weightHidden 是否把地支藏干计入（本气权重 1，中气 0.5，余气 0.3）
 * @returns 各五行加权计数
 */
export declare function tallyWuxing(items: readonly string[], options?: {
    weightHidden?: boolean;
}): Record<string, number>;
export interface WuxingStrengthProfile {
    /** 各五行计数 */
    counts: Record<string, number>;
    /** 最强五行 */
    dominant: string;
    /** 与最高计数并列的全部五行；dominant 为其中按木火土金水顺序的首项。 */
    dominantElements: string[];
    /** 最弱五行 */
    weakest: string;
    /** 与最低计数并列的全部五行；weakest 为其中按木火土金水顺序的首项。 */
    weakestElements: string[];
    /** 五行是否缺失 */
    lacking: string[];
}
/** 生成五行强弱画像（仅统计，不含日主旺衰判定） */
export declare function getWuxingStrengthProfile(items: readonly string[]): WuxingStrengthProfile;
export interface WuxingCalculationStep {
    key: string;
    stage: '输入核验' | '逐项五行映射' | '加权汇总' | '分布摘要';
    status: '已核验' | '已映射' | '已统计' | '已汇总';
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '五行统计步骤只证明输入符号如何按天干、地支及可选藏干权重形成当前计数；不得把计数、步骤数量或并列顺序解释为命局旺衰、吉凶分数、事件概率或现实结论';
}
export interface WuxingHiddenContribution {
    stem: string;
    wuxing: string;
    weight: number;
    rank: '本气' | '中气' | '余气';
}
export interface WuxingItemFact {
    key: string;
    status: '已映射';
    itemIndex: number;
    item: string;
    itemType: '天干' | '地支';
    primaryWuxing: string;
    primaryContribution: number;
    hiddenContributions: WuxingHiddenContribution[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '逐项五行事实只记录当前符号对统计结果的公开贡献；藏干权重是本工具的明确统计口径，不等同于月令司权、日主旺衰、格局成败或现实吉凶';
}
export interface WuxingLimitationFact {
    key: string;
    type: '统计范围边界' | '藏干权重边界' | '并列结果边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '五行限制事实用于约束加权计数的解释范围，不得被反向当作命局强弱、用神、健康、财富、职业或事件结果的证据';
}
export interface WuxingSummaryFact {
    key: 'foundation:wuxing:evidence-summary';
    status: '证据链完整';
    factKeys: string[];
    calculationStepCount: number;
    itemFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '五行证据汇总只统计输入映射、公开权重、计数结果、并列情况与解释边界的覆盖，不表示已完成八字旺衰、格局、取用或现实预测';
}
export interface WuxingEvidenceFields {
    key: string;
    status: '已统计';
    calculationSteps: WuxingCalculationStep[];
    calculationChain: string[];
    itemFacts: WuxingItemFact[];
    summaryFact: WuxingSummaryFact;
    limitations: string[];
    limitationFacts: WuxingLimitationFact[];
    source: string;
    promptText: string;
}
export interface WuxingAnalysis extends WuxingStrengthProfile, WuxingEvidenceFields {
    items: string[];
    weightHidden: boolean;
}
/** 严格校验输入后生成可直接给 API/MCP 使用的五行分布结果。 */
export declare function analyzeWuxing(items: readonly string[], options?: {
    weightHidden?: boolean;
}): WuxingAnalysis;
export declare const wuxing: {
    isSheng: typeof isSheng;
    isKe: typeof isKe;
    getSeasonState: typeof getSeasonState;
    getBranchWuxing: typeof getBranchWuxing;
    tallyWuxing: typeof tallyWuxing;
    getWuxingStrengthProfile: typeof getWuxingStrengthProfile;
    analyzeWuxing: typeof analyzeWuxing;
};
