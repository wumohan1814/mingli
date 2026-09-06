import { HIDDEN_STEMS, NAYIN_MAP, TWELVE_STAGES_MAP } from './baziDefinitions.js';
export { calculateKongWang } from './kongWang.js';
import { assertHeavenlyStem, assertPillars, getTenGod } from './baziUtils.js';
export function calculatePillarLifeStages(pillars) {
    assertPillars(pillars);
    const result = {};
    Object.keys(pillars).forEach((key) => {
        const pillar = pillars[key];
        const stage = TWELVE_STAGES_MAP[pillar.gan]?.[pillar.zhi];
        if (!stage) {
            throw new Error(`${key}柱十二长生数据缺失：${pillar.gan}${pillar.zhi}`);
        }
        result[key] = stage;
    });
    return result;
}
export function calculateTenGods(pillars, dayMaster) {
    assertPillars(pillars);
    assertHeavenlyStem(dayMaster, '日主');
    return Object.fromEntries(Object.entries(pillars).map(([pillar, { gan }]) => {
        if (pillar === 'day') {
            return [pillar, '日主'];
        }
        return [pillar, getTenGod(gan, dayMaster)];
    }));
}
export function calculateHiddenStems(pillars) {
    assertPillars(pillars);
    const result = {};
    Object.keys(pillars).forEach((key) => {
        const stems = HIDDEN_STEMS[pillars[key].zhi];
        if (!stems) {
            throw new Error(`${key}柱藏干数据缺失：${pillars[key].zhi}`);
        }
        result[key] = stems;
    });
    return result;
}
export function calculateHiddenTenGods(hiddenStems, dayMaster) {
    assertHeavenlyStem(dayMaster, '日主');
    return Object.fromEntries(Object.entries(hiddenStems).map(([pillar, stems]) => [
        pillar,
        stems.map((stem) => {
            assertHeavenlyStem(stem, `${pillar}柱藏干`);
            return getTenGod(stem, dayMaster);
        }),
    ]));
}
export function calculateLifeStages(pillars, dayMaster) {
    assertPillars(pillars);
    assertHeavenlyStem(dayMaster, '日主');
    const stageMap = TWELVE_STAGES_MAP[dayMaster];
    return Object.fromEntries(Object.entries(pillars).map(([pillar, { zhi }]) => {
        const stage = stageMap[zhi];
        if (!stage) {
            throw new Error(`${pillar}柱十二长生数据缺失：${dayMaster}${zhi}`);
        }
        return [pillar, stage];
    }));
}
export function calculateNayin(pillars) {
    assertPillars(pillars);
    const result = {};
    Object.keys(pillars).forEach((key) => {
        const pillar = pillars[key];
        const ganZhi = pillar.gan + pillar.zhi;
        const nayin = NAYIN_MAP[ganZhi];
        if (!nayin) {
            throw new Error(`${key}柱纳音数据缺失：${ganZhi}`);
        }
        result[key] = nayin;
    });
    return result;
}
/**
 * 计算自坐（十二长生在四柱的表现）
 * 与 calculatePillarLifeStages 逻辑相同，保留为兼容命名。
 * @deprecated 请使用 calculatePillarLifeStages
 */
export function calculateZiZuo(pillars) {
    return calculatePillarLifeStages(pillars);
}
