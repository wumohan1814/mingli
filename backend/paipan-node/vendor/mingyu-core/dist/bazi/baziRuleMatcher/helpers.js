import { BASIC_MAPPINGS } from '../baziDefinitions.js';
export function getStemWuxing(stem) {
    const stemIndex = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem);
    if (stemIndex === -1) {
        return '';
    }
    return BASIC_MAPPINGS.STEM_WUXING[stemIndex];
}
export function includesOrWildcard(values, target) {
    if (!values || values.length === 0) {
        return true;
    }
    if (!target) {
        return false;
    }
    return values.includes(target);
}
export function includesAll(values, targets) {
    if (!values || values.length === 0) {
        return true;
    }
    if (!targets || targets.length === 0) {
        return false;
    }
    return values.every((value) => targets.includes(value));
}
export function includesAny(values, targets) {
    if (!values || values.length === 0) {
        return true;
    }
    if (!targets || targets.length === 0) {
        return false;
    }
    return values.some((value) => targets.includes(value));
}
export function excludesAll(values, targets) {
    if (!values || values.length === 0) {
        return true;
    }
    if (!targets || targets.length === 0) {
        return true;
    }
    return values.every((value) => !targets.includes(value));
}
export function getWuxingTenGodCategory(dayStem, targetWuxing) {
    const dayWuxing = getStemWuxing(dayStem);
    if (!dayWuxing || !targetWuxing) {
        return '';
    }
    if (targetWuxing === dayWuxing) {
        return '比劫';
    }
    if (BASIC_MAPPINGS.WUXING_SHENG[dayWuxing] === targetWuxing) {
        return '食伤';
    }
    if (BASIC_MAPPINGS.WUXING_KE[dayWuxing] === targetWuxing) {
        return '财星';
    }
    if (BASIC_MAPPINGS.WUXING_KE[targetWuxing] === dayWuxing) {
        return '官杀';
    }
    if (BASIC_MAPPINGS.WUXING_SHENG[targetWuxing] === dayWuxing) {
        return '印星';
    }
    return '';
}
export function getStemTenGodCategory(dayStem, targetStem) {
    const dayWuxing = getStemWuxing(dayStem);
    const targetWuxing = getStemWuxing(targetStem);
    if (!dayWuxing || !targetWuxing) {
        return '';
    }
    return getWuxingTenGodCategory(dayStem, targetWuxing);
}
export function buildFormationTenGodCategories(dayStem, formationWuxings) {
    if (!dayStem || !formationWuxings || formationWuxings.length === 0) {
        return undefined;
    }
    const categories = [
        ...new Set(formationWuxings.map((wuxing) => getWuxingTenGodCategory(dayStem, wuxing)).filter(Boolean)),
    ];
    return categories.length > 0 ? categories : undefined;
}
export function buildTenGodCategoryCounts(dayStem, stems, excludeDayStemSelf) {
    if (!dayStem || !stems || stems.length === 0) {
        return null;
    }
    const categoryCounts = stems.reduce((counts, stem) => {
        const category = getStemTenGodCategory(dayStem, stem);
        if (category) {
            counts[category] = (counts[category] || 0) + 1;
        }
        return counts;
    }, {});
    if (excludeDayStemSelf && stems.includes(dayStem) && categoryCounts.比劫) {
        categoryCounts.比劫 = Math.max(categoryCounts.比劫 - 1, 0);
    }
    return categoryCounts;
}
export function mergeCategoryCounts(...countMaps) {
    const validMaps = countMaps.filter((countMap) => Boolean(countMap));
    if (validMaps.length === 0) {
        return null;
    }
    return validMaps.reduce((merged, current) => {
        Object.entries(current).forEach(([category, count]) => {
            merged[category] = (merged[category] || 0) + count;
        });
        return merged;
    }, {});
}
export function buildTenGodCategoryDistinctStemSets(dayStem, stems, excludeDayStemSelf) {
    if (!dayStem || !stems || stems.length === 0) {
        return null;
    }
    const categoryStemSets = stems.reduce((sets, stem) => {
        if (excludeDayStemSelf && stem === dayStem) {
            return sets;
        }
        const category = getStemTenGodCategory(dayStem, stem);
        if (!category) {
            return sets;
        }
        if (!sets[category]) {
            sets[category] = new Set();
        }
        sets[category].add(stem);
        return sets;
    }, {});
    return Object.keys(categoryStemSets).length > 0 ? categoryStemSets : null;
}
export function buildTenGodCategoryDistinctStemCounts(dayStem, stems, excludeDayStemSelf) {
    const categoryStemSets = buildTenGodCategoryDistinctStemSets(dayStem, stems, excludeDayStemSelf);
    if (!categoryStemSets) {
        return null;
    }
    return Object.entries(categoryStemSets).reduce((counts, [category, stemSet]) => {
        counts[category] = stemSet.size;
        return counts;
    }, {});
}
export function mergeDistinctCategoryCounts(...setMaps) {
    const validMaps = setMaps.filter((setMap) => Boolean(setMap));
    if (validMaps.length === 0) {
        return null;
    }
    const categoryStemSets = {};
    validMaps.forEach((setMap) => {
        Object.entries(setMap).forEach(([category, stemSet]) => {
            if (!categoryStemSets[category]) {
                categoryStemSets[category] = new Set();
            }
            stemSet.forEach((stem) => categoryStemSets[category].add(stem));
        });
    });
    return Object.entries(categoryStemSets).reduce((counts, [category, markerSet]) => {
        counts[category] = markerSet.size;
        return counts;
    }, {});
}
