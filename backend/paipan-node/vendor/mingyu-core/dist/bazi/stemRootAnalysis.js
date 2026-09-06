import { HIDDEN_STEMS } from './baziMappingsData.js';
import { WUXING } from './baziTypes.js';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils.js';
const STEM_ELEMENT = {
    甲: '木',
    乙: '木',
    丙: '火',
    丁: '火',
    戊: '土',
    己: '土',
    庚: '金',
    辛: '金',
    壬: '水',
    癸: '水',
};
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
export function analyzeStemRootProfile(pillars, dayMaster, getWuxing, getTenGod) {
    assertPillarInputs(pillars);
    assertHeavenlyStem(dayMaster, '日主');
    const pillarNames = ['year', 'month', 'day', 'hour'];
    const items = [];
    pillars.forEach((p, idx) => {
        const visibleStem = p.gan;
        const visibleElement = STEM_ELEMENT[visibleStem] || resolveWuxing(getWuxing, visibleStem, '透干');
        let hasSameStem = false;
        let hasSameElement = false;
        pillars.forEach((rootPillar) => {
            const stems = HIDDEN_STEMS[rootPillar.zhi];
            if (!stems) {
                throw new Error(`藏干数据缺失：${rootPillar.zhi}`);
            }
            stems.forEach((stem) => {
                const isSameStem = stem === visibleStem;
                const isSameElement = STEM_ELEMENT[stem] === visibleElement && stem !== visibleStem;
                if (isSameStem) {
                    hasSameStem = true;
                }
                else if (isSameElement) {
                    hasSameElement = true;
                }
            });
        });
        const status = hasSameStem
            ? '有本根'
            : hasSameElement
                ? '有同气根'
                : '无根';
        items.push({
            pillar: pillarNames[idx],
            stem: visibleStem,
            tenGod: resolveTenGod(getTenGod, visibleStem, dayMaster),
            status,
            summary: status === '有本根'
                ? '四柱地支见本根支撑'
                : status === '有同气根'
                    ? '四柱地支见同气根支撑'
                    : '无根漂浮',
        });
    });
    const rootedCount = items.filter((i) => i.status !== '无根').length;
    return {
        items,
        rootedCount,
        summary: `天干通根：本根${items.filter((i) => i.status === '有本根').length}柱，同气根${items.filter((i) => i.status === '有同气根').length}柱，无根${items.filter((i) => i.status === '无根').length}柱。`,
    };
}
/**
 * 透干综合画像：每个透出天干的月令地位、力量状态
 *
 * commandStatus:
 *   - 司令透出：透干与月令司令同干
 *   - 月令藏干透出：透干为月支藏干之一
 *   - 得月令同气：透干与月令同五行
 *   - 不得月令：以上都不是
 */
export function analyzeExposedStemProfile(pillars, dayMaster, getWuxing, getTenGod, commanderStem, monthBranch) {
    assertPillarInputs(pillars);
    assertHeavenlyStem(dayMaster, '日主');
    if (commanderStem)
        assertHeavenlyStem(commanderStem, '司令天干');
    if (monthBranch)
        assertEarthlyBranch(monthBranch, '月支');
    const pillarNames = ['year', 'month', 'day', 'hour'];
    const monthStems = monthBranch ? HIDDEN_STEMS[monthBranch] || [] : [];
    const items = [];
    pillars.forEach((p, idx) => {
        const stemElement = STEM_ELEMENT[p.gan] || resolveWuxing(getWuxing, p.gan, '透干');
        let commandStatus = '不得月令';
        if (commanderStem && p.gan === commanderStem) {
            commandStatus = '司令透出';
        }
        else if (monthStems.includes(p.gan)) {
            commandStatus = '月令藏干透出';
        }
        else if (monthBranch && resolveWuxing(getWuxing, monthBranch, '月支') === stemElement) {
            commandStatus = '得月令同气';
        }
        items.push({
            pillar: pillarNames[idx],
            stem: p.gan,
            tenGod: resolveTenGod(getTenGod, p.gan, dayMaster),
            seasonStatus: '平',
            commandStatus,
            rootStatus: '待定',
            summary: `${p.gan}透于${pillarNames[idx]}，${commandStatus}`,
        });
    });
    return { items, summary: '天干透出画像' };
}
