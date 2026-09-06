export function matchRequiredVisibleStemPillarPairs(pairRules, visibleStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    if (!visibleStemSources || visibleStemSources.length === 0) {
        return false;
    }
    return pairRules.every((pairRule) => visibleStemSources.some((source) => {
        if (source.stem !== pairRule.stem) {
            return false;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(source.pillar)) {
            return false;
        }
        return true;
    }));
}
export function matchOptionalVisibleStemPillarPairs(pairRules, visibleStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    if (!visibleStemSources || visibleStemSources.length === 0) {
        return false;
    }
    return pairRules.some((pairRule) => visibleStemSources.some((source) => {
        if (source.stem !== pairRule.stem) {
            return false;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(source.pillar)) {
            return false;
        }
        return true;
    }));
}
export function matchForbiddenVisibleStemPillarPairs(pairRules, visibleStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    if (!visibleStemSources || visibleStemSources.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => visibleStemSources.every((source) => {
        if (source.stem !== pairRule.stem) {
            return true;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(source.pillar)) {
            return true;
        }
        return false;
    }));
}
function hasVisibleStemBranchPair(pairRule, visibleStemSources, hiddenStemSources) {
    if (!visibleStemSources ||
        visibleStemSources.length === 0 ||
        !hiddenStemSources ||
        hiddenStemSources.length === 0) {
        return false;
    }
    return visibleStemSources.some((visibleSource) => {
        if (visibleSource.stem !== pairRule.stem) {
            return false;
        }
        if (pairRule.pillars &&
            pairRule.pillars.length > 0 &&
            !pairRule.pillars.includes(visibleSource.pillar)) {
            return false;
        }
        return hiddenStemSources.some((hiddenSource) => {
            if (hiddenSource.pillar !== visibleSource.pillar) {
                return false;
            }
            if (hiddenSource.branch !== pairRule.branch) {
                return false;
            }
            if (pairRule.pillars &&
                pairRule.pillars.length > 0 &&
                !pairRule.pillars.includes(hiddenSource.pillar)) {
                return false;
            }
            return true;
        });
    });
}
export function matchRequiredVisibleStemBranchPairs(pairRules, visibleStemSources, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => hasVisibleStemBranchPair(pairRule, visibleStemSources, hiddenStemSources));
}
export function matchOptionalVisibleStemBranchPairs(pairRules, visibleStemSources, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.some((pairRule) => hasVisibleStemBranchPair(pairRule, visibleStemSources, hiddenStemSources));
}
export function matchForbiddenVisibleStemBranchPairs(pairRules, visibleStemSources, hiddenStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => !hasVisibleStemBranchPair(pairRule, visibleStemSources, hiddenStemSources));
}
function getVisibleStemSourcePillarIndex(pillar) {
    const order = ['year', 'month', 'day', 'hour'];
    return order.indexOf(pillar);
}
function matchesVisibleStemDistancePairRule(pairRule, visibleStemSources) {
    return visibleStemSources.some((leftSource, leftIndex) => {
        if (leftSource.stem !== pairRule.stems[0]) {
            return false;
        }
        if (pairRule.leftPillars &&
            pairRule.leftPillars.length > 0 &&
            !pairRule.leftPillars.includes(leftSource.pillar)) {
            return false;
        }
        return visibleStemSources.some((rightSource, rightIndex) => {
            if (leftIndex === rightIndex) {
                return false;
            }
            if (rightSource.stem !== pairRule.stems[1]) {
                return false;
            }
            if (pairRule.rightPillars &&
                pairRule.rightPillars.length > 0 &&
                !pairRule.rightPillars.includes(rightSource.pillar)) {
                return false;
            }
            const distance = Math.abs(getVisibleStemSourcePillarIndex(leftSource.pillar) -
                getVisibleStemSourcePillarIndex(rightSource.pillar));
            if (typeof pairRule.minDistance === 'number' && distance < pairRule.minDistance) {
                return false;
            }
            if (typeof pairRule.maxDistance === 'number' && distance > pairRule.maxDistance) {
                return false;
            }
            return true;
        });
    });
}
export function matchRequiredVisibleStemDistancePairs(pairRules, visibleStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    if (!visibleStemSources || visibleStemSources.length === 0) {
        return false;
    }
    return pairRules.every((pairRule) => matchesVisibleStemDistancePairRule(pairRule, visibleStemSources));
}
export function matchForbiddenVisibleStemDistancePairs(pairRules, visibleStemSources) {
    if (!pairRules || pairRules.length === 0) {
        return true;
    }
    if (!visibleStemSources || visibleStemSources.length === 0) {
        return true;
    }
    return pairRules.every((pairRule) => !matchesVisibleStemDistancePairRule(pairRule, visibleStemSources));
}
