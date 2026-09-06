import { sanHeMatcher, sanHuiMatcher, siKuMatcher } from './formationMatchers.js';
import { shiZhuMatcher, shiZhiMatcher, riZhiMatcher, riZhuMatcher } from './pillarMatchers.js';
import { chongMatcher, jianZhiMatcher, noJianZhiMatcher, diZhiDuoMatcher } from './branchMatchers.js';
import { touGanMatcher, faYongMatcher, tianGanDuoMatcher, wuHeMatcher, noZhengHeMatcher, noTouGanMatcher, } from './stemMatchers.js';
import { strengthMatcher } from './strengthMatchers.js';
export { branchesContain } from './helpers.js';
const MATCHERS = [
    sanHeMatcher,
    sanHuiMatcher,
    siKuMatcher,
    chongMatcher,
    shiZhuMatcher,
    shiZhiMatcher,
    riZhiMatcher,
    riZhuMatcher,
    jianZhiMatcher,
    noJianZhiMatcher,
    touGanMatcher,
    faYongMatcher,
    strengthMatcher,
    tianGanDuoMatcher,
    noTouGanMatcher,
    diZhiDuoMatcher,
    wuHeMatcher,
    noZhengHeMatcher,
];
export function checkCondition(condition, dayStem, pillars, hiddenStems) {
    const allBranches = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
    const allStems = [pillars.year.gan, pillars.month.gan, pillars.day.gan, pillars.hour.gan];
    const ctx = {
        condition,
        dayStem,
        pillars,
        hiddenStems,
        allBranches,
        allStems,
    };
    for (const matcher of MATCHERS) {
        const result = matcher(ctx);
        if (result !== null) {
            return result;
        }
    }
    return false;
}
