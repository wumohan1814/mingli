import { CLIMATE_RULES, STRENGTH_HINT_RULES, THERAPEUTIC_PRIORITY_RULES, } from './baziTherapeuticRules.js';
import { matchFirstRule } from './baziRuleMatcher/index.js';
function resolveTherapeuticHintRule(strengthStatus, dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    if (!monthBranch) {
        return null;
    }
    const climateRule = matchFirstRule(CLIMATE_RULES, {
        yearStem,
        monthBranch,
        hourBranch,
        dayMaster: dmWuxing,
        dayStem: dayMasterStem,
        currentJieqi,
        visibleStems,
        visibleStemSources,
        hiddenStems,
        hiddenStemSources,
        formationWuxings,
        wuxingCounts,
    });
    if (climateRule) {
        return climateRule;
    }
    return (matchFirstRule(STRENGTH_HINT_RULES, {
        strengthStatus,
    }) || null);
}
export function resolveTherapeuticHint(strengthStatus, dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    return (resolveTherapeuticHintRule(strengthStatus, dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts)?.hint || '');
}
export function resolveTherapeuticHintRuleId(strengthStatus, dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    return (resolveTherapeuticHintRule(strengthStatus, dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts)?.id || '');
}
function normalizeWuxingOrder(order) {
    return [...new Set(order.filter(Boolean))];
}
function matchClimateRule(dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, isPatternSpecial, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    if (!monthBranch || isPatternSpecial) {
        return undefined;
    }
    return matchFirstRule(CLIMATE_RULES, {
        yearStem,
        monthBranch,
        hourBranch,
        dayMaster: dmWuxing,
        dayStem: dayMasterStem,
        currentJieqi,
        visibleStems,
        visibleStemSources,
        hiddenStems,
        hiddenStemSources,
        formationWuxings,
        wuxingCounts,
    });
}
export function resolveTherapeuticPriorityWuxing(strengthStatus, dmWuxing, dayMasterStem, monthBranch, isPatternSpecial, wuxingSheng) {
    if (!monthBranch || isPatternSpecial) {
        return '';
    }
    const priorityRule = matchFirstRule(THERAPEUTIC_PRIORITY_RULES, {
        monthBranch,
        strengthStatus,
        dayMaster: dmWuxing,
        dayStem: dayMasterStem,
    });
    if (!priorityRule) {
        return '';
    }
    if (priorityRule.useGeneratedElement) {
        return wuxingSheng[dmWuxing] || '';
    }
    return '';
}
export function resolveClimateUsefulWuxing(dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, isPatternSpecial, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    return (resolveClimateFavorableOrder(dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, isPatternSpecial, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts)[0] || '');
}
export function resolveClimateFavorableOrder(dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, isPatternSpecial, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts) {
    const climateRule = matchClimateRule(dmWuxing, yearStem, dayMasterStem, monthBranch, hourBranch, isPatternSpecial, currentJieqi, visibleStems, visibleStemSources, hiddenStems, hiddenStemSources, formationWuxings, wuxingCounts);
    if (!climateRule) {
        return [];
    }
    return normalizeWuxingOrder([...(climateRule.favorableOrder || []), climateRule.usefulWuxing]);
}
export function applyClimateAdjustment(state, climateFavorableOrder) {
    const normalizedOrder = normalizeWuxingOrder(climateFavorableOrder);
    if (normalizedOrder.length === 0) {
        return { state, adjusted: false };
    }
    return {
        state: {
            ...state,
            favorableWuxing: [
                ...normalizedOrder,
                ...state.favorableWuxing.filter((wx) => !normalizedOrder.includes(wx)),
            ],
            unfavorableWuxing: state.unfavorableWuxing.filter((wx) => !normalizedOrder.includes(wx)),
            trace: [...state.trace, `调候优先:${normalizedOrder.join(' -> ')}`],
            primaryReason: '调候',
        },
        adjusted: true,
    };
}
export function applyTherapeuticPriority(state, therapeuticWuxing) {
    if (!therapeuticWuxing || !state.favorableWuxing.includes(therapeuticWuxing)) {
        return { state, adjusted: false };
    }
    return {
        state: {
            ...state,
            favorableWuxing: [
                therapeuticWuxing,
                ...state.favorableWuxing.filter((wx) => wx !== therapeuticWuxing),
            ],
            trace: [...state.trace, `病药优先:${therapeuticWuxing}`],
            primaryReason: '病药',
        },
        adjusted: true,
    };
}
