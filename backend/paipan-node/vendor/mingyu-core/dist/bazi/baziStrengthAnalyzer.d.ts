import type { ConstraintAnalysis, DayMasterStrengthAnalysis, HiddenStems, Pillars, RootAnalysis, SupportAnalysis, Wuxing } from './baziTypes';
export interface SeasonalStatusAnalysis {
    status: string;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    score: number;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    baseScore?: number;
    commanderStem?: string;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    commanderScore?: number;
    commanderEffect?: '助身' | '生身' | '泄身' | '耗身' | '克身' | '中性';
    isTimely: boolean;
}
export interface FormationAnalysis {
    formations: Array<{
        type: string;
        branches: string[];
        wuxing: Wuxing;
        effect: '助身' | '生身' | '泄身' | '耗身' | '克身';
        /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
        strength: number;
    }>;
    /** @deprecated 仅为兼容旧调用方保留，不参与正式旺衰、格局或用神裁定。 */
    totalStrength: number;
}
type GetWuxingFn = (ganOrZhi: string) => Wuxing;
type GetSeasonStatusFn = (zhi: string) => Record<string, string>;
export declare function analyzeRoot(dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: GetWuxingFn): RootAnalysis;
export declare function analyzeSupport(dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: GetWuxingFn): SupportAnalysis;
export declare function analyzeConstraint(dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: GetWuxingFn): ConstraintAnalysis;
export declare function analyzeSeasonalStatus(dayMaster: string, monthBranch: string, getSeasonStatus: GetSeasonStatusFn, getWuxing: GetWuxingFn, monthCommander?: string): SeasonalStatusAnalysis;
export declare function analyzeFormation(dayMaster: string, pillars: Pillars, getWuxing: GetWuxingFn): FormationAnalysis;
export declare function analyzeDayMasterStrength(seasonalStatus: SeasonalStatusAnalysis, formationAnalysis: FormationAnalysis, rootAnalysis: RootAnalysis, supportAnalysis: SupportAnalysis, constraintAnalysis: ConstraintAnalysis): DayMasterStrengthAnalysis;
export {};
