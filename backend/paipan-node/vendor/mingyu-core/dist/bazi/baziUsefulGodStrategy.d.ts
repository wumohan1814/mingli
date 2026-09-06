import { type PatternAnalysis, type UsefulGodAnalysis } from './baziTypes';
import { type HiddenStemSource, type VisibleStemSource } from './baziRuleMatcher';
interface UsefulGodClimateContext {
    yearStem?: string;
    hourBranch?: string;
    currentJieqi?: string;
    visibleStems?: string[];
    visibleStemSources?: VisibleStemSource[];
    hiddenStems?: string[];
    hiddenStemSources?: HiddenStemSource[];
    formationWuxings?: string[];
    wuxingCounts?: Record<string, number>;
}
export declare function determineUsefulGod(strengthStatus: string, pattern: PatternAnalysis, dmWuxing: string, monthBranch?: string, monthCommander?: string, dayMasterStem?: string, climateContext?: UsefulGodClimateContext): UsefulGodAnalysis & {
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    strategyTrace: string[];
    primaryReason: string;
};
export {};
