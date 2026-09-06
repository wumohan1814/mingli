import type { BaziAnalysisResult, ConstraintAnalysis, DayMasterStrengthAnalysis, HiddenStems, PatternAnalysis, Pillars, RootAnalysis, SeasonInfo, SupportAnalysis, UsefulGodAnalysis, Wuxing } from './baziTypes';
import type { FormationAnalysis, SeasonalStatusAnalysis } from './baziStrengthAnalyzer';
import type { HiddenStemSource, VisibleStemSource } from './baziRuleMatcher';
export interface BaziAnalysisPipelineDeps {
    getWuxing: (ganOrZhi: string) => Wuxing;
    getTenGod: (gan: string, dayMaster: string) => string;
    getSeasonStatus: (zhi: string) => Record<string, string>;
    analyzeRoot: (dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: (ganOrZhi: string) => Wuxing) => RootAnalysis;
    analyzeFormation: (dayMaster: string, pillars: Pillars, getWuxing: (ganOrZhi: string) => Wuxing) => FormationAnalysis;
    analyzeSupport: (dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: (ganOrZhi: string) => Wuxing) => SupportAnalysis;
    analyzeConstraint: (dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: (ganOrZhi: string) => Wuxing) => ConstraintAnalysis;
    analyzeSeasonalStatus: (dayMaster: string, monthBranch: string, getSeasonStatus: (zhi: string) => Record<string, string>, getWuxing: (ganOrZhi: string) => Wuxing, monthCommander?: string) => SeasonalStatusAnalysis;
    analyzeDayMasterStrength: (seasonalStatus: SeasonalStatusAnalysis, formationAnalysis: FormationAnalysis, rootAnalysis: RootAnalysis, supportAnalysis: SupportAnalysis, constraintAnalysis: ConstraintAnalysis) => DayMasterStrengthAnalysis;
    determinePattern: (pillars: Pillars, strengthStatus: string, getTenGod: (gan: string, dayMaster: string) => string, monthCommander?: string) => PatternAnalysis;
    determineUsefulGod: (strengthStatus: string, pattern: PatternAnalysis, dmWuxing: string, monthBranch?: string, monthCommander?: string, dayMasterStem?: string, climateContext?: {
        yearStem?: string;
        hourBranch?: string;
        currentJieqi?: string;
        visibleStems?: string[];
        visibleStemSources?: VisibleStemSource[];
        hiddenStems?: string[];
        hiddenStemSources?: HiddenStemSource[];
        formationWuxings?: string[];
        wuxingCounts?: Record<string, number>;
    }) => UsefulGodAnalysis & {
        favorableWuxing: string[];
        unfavorableWuxing: string[];
    };
}
export interface BaziAnalysisPipelineInput {
    pillars: Pillars;
    hiddenStems: HiddenStems;
    monthCommander?: string;
    seasonInfo?: Pick<SeasonInfo, 'currentJieqi'>;
}
export declare function createBaziAnalysisPipeline(deps: BaziAnalysisPipelineDeps): {
    run(input: BaziAnalysisPipelineInput): BaziAnalysisResult;
};
