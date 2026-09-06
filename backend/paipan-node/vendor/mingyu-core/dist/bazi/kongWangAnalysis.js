import { calculateKongWangBranches } from './kongWang.js';
export function analyzeKongWangProfile(pillars, _dayMasterStem) {
    const pillarNames = ['year', 'month', 'day', 'hour'];
    const dayGan = pillars[2].gan;
    const dayZhi = pillars[2].zhi;
    const emptyBranches = calculateKongWangBranches(dayGan, dayZhi);
    const cnItems = pillarNames.map((pn, idx) => {
        const isEmpty = emptyBranches.includes(pillars[idx].zhi);
        return { pillar: pn, emptyBranches, isEmpty, fillableItems: [] };
    });
    return { items: cnItems, summary: '旬空：' + emptyBranches.join('、') };
}
