import { SixtyCycle } from 'tyme4ts';
import { assertGanZhiPair, assertPillars } from './baziUtils.js';
export function calculateKongWangBranches(gan, zhi) {
    assertGanZhiPair(gan, zhi, '空亡干支');
    return SixtyCycle.fromName(`${gan}${zhi}`)
        .getExtraEarthBranches()
        .map((branch) => branch.getName());
}
export function calculateKongWang(pillars) {
    assertPillars(pillars);
    const result = {};
    Object.keys(pillars).forEach((key) => {
        const pillar = pillars[key];
        result[key] = calculateKongWangBranches(pillar.gan, pillar.zhi);
    });
    return result;
}
