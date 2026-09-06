import { HIDDEN_STEMS, TWELVE_STAGES_MAP } from './baziMappingsData.js';
import { WUXING } from './baziTypes.js';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils.js';
function getDayMasterTombBranch(dayMaster) {
    assertHeavenlyStem(dayMaster, '日主');
    const stages = TWELVE_STAGES_MAP[dayMaster];
    if (!stages) {
        throw new Error(`十二长生数据缺失：${dayMaster}`);
    }
    const tombBranch = Object.entries(stages).find(([, stage]) => stage === '墓')?.[0];
    if (!tombBranch) {
        throw new Error(`日主墓位缺失：${dayMaster}`);
    }
    return tombBranch;
}
function assertPillarInputs(pillars) {
    if (pillars.length !== 4) {
        throw new Error(`四柱数量无效：${pillars.length}`);
    }
    pillars.forEach((pillar, index) => {
        assertHeavenlyStem(pillar.gan, `第${index + 1}柱天干`);
        assertEarthlyBranch(pillar.zhi, `第${index + 1}柱地支`);
    });
}
function resolveWuxing(getWuxing, value, label) {
    const wuxing = getWuxing(value);
    if (!WUXING.includes(wuxing)) {
        throw new Error(`${label}五行无效：${wuxing}`);
    }
    return wuxing;
}
function resolveTenGod(getTenGod, stem, dayMaster) {
    const tenGod = getTenGod(stem, dayMaster);
    if (!tenGod || tenGod === '未知') {
        throw new Error(`十神数据缺失：${dayMaster}/${stem}`);
    }
    return tenGod;
}
export function analyzeTombStorage(pillars, dayMaster, getWuxing, getTenGod) {
    assertPillarInputs(pillars);
    assertHeavenlyStem(dayMaster, '日主');
    const items = [];
    const fourTombs = ['辰', '戌', '丑', '未'];
    const dmTomb = getDayMasterTombBranch(dayMaster);
    pillars.forEach((p) => {
        if (!fourTombs.includes(p.zhi))
            return;
        const stems = HIDDEN_STEMS[p.zhi];
        if (!stems) {
            throw new Error(`藏干数据缺失：${p.zhi}`);
        }
        const storageStem = stems[stems.length - 1] || stems[0];
        const storageWuxing = resolveWuxing(getWuxing, storageStem, '墓库藏干');
        items.push({
            branch: p.zhi,
            storageElement: storageWuxing,
            storageStem: storageStem,
            storageTenGod: resolveTenGod(getTenGod, storageStem, dayMaster),
            isDayMasterTomb: p.zhi === dmTomb,
        });
    });
    return { items, summary: '四库分析' };
}
