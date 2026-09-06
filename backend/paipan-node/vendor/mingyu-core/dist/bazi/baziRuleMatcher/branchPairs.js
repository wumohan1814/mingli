function hasHiddenStemBranchPair(pairRule, hiddenStemSources) {
    if (!hiddenStemSources || hiddenStemSources.length === 0) {
        return false;
    }
    return hiddenStemSources.some((source) => {
        if (source.branch !== pairRule.branch) {
            return false;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(source.pillar)) {
            return false;
        }
        return source.stems.includes(pairRule.stem);
    });
}
function hasBranchPillarPair(pairRule, hiddenStemSources) {
    if (!hiddenStemSources || hiddenStemSources.length === 0) {
        return false;
    }
    return hiddenStemSources.some((source) => {
        if (source.branch !== pairRule.branch) {
            return false;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(source.pillar)) {
            return false;
        }
        return true;
    });
}
export function matchRequiredBranchPillarPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => hasBranchPillarPair(pairRule, hiddenStemSources));
}
export function matchOptionalBranchPillarPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.some((pairRule) => hasBranchPillarPair(pairRule, hiddenStemSources));
}
export function matchForbiddenBranchPillarPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => !hasBranchPillarPair(pairRule, hiddenStemSources));
}
export function matchRequiredHiddenStemBranchPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}
export function matchOptionalHiddenStemBranchPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.some((pairRule) => hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}
export function matchForbiddenHiddenStemBranchPairs(pairRules, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => !hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}
