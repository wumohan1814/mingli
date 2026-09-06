import { type HiddenStemSource, type VisibleStemSource } from './baziRuleMatcher';
interface UsefulGodDecisionStateLike {
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    trace: string[];
    primaryReason: string;
}
export declare function resolveTherapeuticHint(strengthStatus: string, dmWuxing: string, yearStem?: string, dayMasterStem?: string, monthBranch?: string, hourBranch?: string, currentJieqi?: string, visibleStems?: string[], visibleStemSources?: VisibleStemSource[], hiddenStems?: string[], hiddenStemSources?: HiddenStemSource[], formationWuxings?: string[], wuxingCounts?: Record<string, number>): string;
export declare function resolveTherapeuticHintRuleId(strengthStatus: string, dmWuxing: string, yearStem?: string, dayMasterStem?: string, monthBranch?: string, hourBranch?: string, currentJieqi?: string, visibleStems?: string[], visibleStemSources?: VisibleStemSource[], hiddenStems?: string[], hiddenStemSources?: HiddenStemSource[], formationWuxings?: string[], wuxingCounts?: Record<string, number>): string;
export declare function resolveTherapeuticPriorityWuxing(strengthStatus: string, dmWuxing: string, dayMasterStem: string | undefined, monthBranch: string | undefined, isPatternSpecial: boolean, wuxingSheng: Record<string, string>): string;
export declare function resolveClimateUsefulWuxing(dmWuxing: string, yearStem: string | undefined, dayMasterStem: string | undefined, monthBranch: string | undefined, hourBranch: string | undefined, isPatternSpecial: boolean, currentJieqi?: string, visibleStems?: string[], visibleStemSources?: VisibleStemSource[], hiddenStems?: string[], hiddenStemSources?: HiddenStemSource[], formationWuxings?: string[], wuxingCounts?: Record<string, number>): string;
export declare function resolveClimateFavorableOrder(dmWuxing: string, yearStem: string | undefined, dayMasterStem: string | undefined, monthBranch: string | undefined, hourBranch: string | undefined, isPatternSpecial: boolean, currentJieqi?: string, visibleStems?: string[], visibleStemSources?: VisibleStemSource[], hiddenStems?: string[], hiddenStemSources?: HiddenStemSource[], formationWuxings?: string[], wuxingCounts?: Record<string, number>): string[];
export declare function applyClimateAdjustment<T extends UsefulGodDecisionStateLike>(state: T, climateFavorableOrder: string[]): {
    state: T;
    adjusted: boolean;
};
export declare function applyTherapeuticPriority<T extends UsefulGodDecisionStateLike>(state: T, therapeuticWuxing: string): {
    state: T;
    adjusted: boolean;
};
export {};
