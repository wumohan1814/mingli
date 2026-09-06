import { WUXING } from './baziTypes.js';
import { collectEstablishedBranchFormations } from './baziFormationUtils.js';
import { assertHeavenlyStem, assertHiddenStemsMatchPillars } from './baziUtils.js';
function assertValidWuxing(value, label) {
    if (!WUXING.includes(value)) {
        throw new Error(`${label}五行无效：${value}`);
    }
}
function assertAnalysisInput(input) {
    assertHiddenStemsMatchPillars(input.pillars, input.hiddenStems);
    if (input.monthCommander) {
        assertHeavenlyStem(input.monthCommander, '月令司权天干');
    }
}
function buildVisibleStems(pillars) {
    return [pillars.year.gan, pillars.month.gan, pillars.day.gan, pillars.hour.gan].filter(Boolean);
}
function buildVisibleStemSources(pillars) {
    return [
        { pillar: 'year', stem: pillars.year.gan },
        { pillar: 'month', stem: pillars.month.gan },
        { pillar: 'day', stem: pillars.day.gan },
        { pillar: 'hour', stem: pillars.hour.gan },
    ].filter((source) => Boolean(source.stem));
}
function buildHiddenStemValues(hiddenStems) {
    return [
        ...hiddenStems.year,
        ...hiddenStems.month,
        ...hiddenStems.day,
        ...hiddenStems.hour,
    ].filter(Boolean);
}
function buildHiddenStemSources(pillars, hiddenStems) {
    return [
        { pillar: 'year', branch: pillars.year.zhi, stems: hiddenStems.year.filter(Boolean) },
        { pillar: 'month', branch: pillars.month.zhi, stems: hiddenStems.month.filter(Boolean) },
        { pillar: 'day', branch: pillars.day.zhi, stems: hiddenStems.day.filter(Boolean) },
        { pillar: 'hour', branch: pillars.hour.zhi, stems: hiddenStems.hour.filter(Boolean) },
    ];
}
function buildFormationWuxings(pillars) {
    return [
        ...new Set(collectEstablishedBranchFormations(pillars).map((formation) => formation.wuxing)),
    ];
}
function buildWuxingCounts(pillars, getWuxing) {
    const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    const observedValues = [
        pillars.year.gan,
        pillars.month.gan,
        pillars.day.gan,
        pillars.hour.gan,
        pillars.year.zhi,
        pillars.month.zhi,
        pillars.day.zhi,
        pillars.hour.zhi,
    ];
    observedValues.forEach((value, index) => {
        const wuxing = getWuxing(value);
        assertValidWuxing(wuxing, `第${index + 1}个四柱字符`);
        counts[wuxing] = (counts[wuxing] || 0) + 1;
    });
    return counts;
}
function buildPipelineState(input, deps) {
    assertAnalysisInput(input);
    const { pillars, hiddenStems, monthCommander, seasonInfo } = input;
    const dayMaster = pillars.day.gan;
    const monthBranch = pillars.month.zhi;
    const dayMasterElement = deps.getWuxing(dayMaster);
    assertValidWuxing(dayMasterElement, '日主');
    const visibleStems = buildVisibleStems(pillars);
    const visibleStemSources = buildVisibleStemSources(pillars);
    const hiddenStemValues = buildHiddenStemValues(hiddenStems);
    const hiddenStemSources = buildHiddenStemSources(pillars, hiddenStems);
    const formationWuxings = buildFormationWuxings(pillars);
    const wuxingCounts = buildWuxingCounts(pillars, deps.getWuxing);
    const rootAnalysis = deps.analyzeRoot(dayMaster, pillars, hiddenStems, deps.getWuxing);
    const formationAnalysis = deps.analyzeFormation(dayMaster, pillars, deps.getWuxing);
    const supportAnalysis = deps.analyzeSupport(dayMaster, pillars, hiddenStems, deps.getWuxing);
    const constraintAnalysis = deps.analyzeConstraint(dayMaster, pillars, hiddenStems, deps.getWuxing);
    const seasonalStatus = deps.analyzeSeasonalStatus(dayMaster, monthBranch, deps.getSeasonStatus, deps.getWuxing, monthCommander);
    const dayMasterStrength = deps.analyzeDayMasterStrength(seasonalStatus, formationAnalysis, rootAnalysis, supportAnalysis, constraintAnalysis);
    const pattern = deps.determinePattern(pillars, dayMasterStrength.status, deps.getTenGod, monthCommander);
    const usefulGod = deps.determineUsefulGod(dayMasterStrength.status, pattern, dayMasterElement, monthBranch, monthCommander, dayMaster, {
        yearStem: pillars.year.gan,
        hourBranch: pillars.hour.zhi,
        currentJieqi: seasonInfo?.currentJieqi,
        visibleStems,
        visibleStemSources,
        hiddenStems: hiddenStemValues,
        hiddenStemSources,
        formationWuxings,
        wuxingCounts,
    });
    return {
        dayMasterStrength,
        pattern,
        usefulGod,
    };
}
function buildAnalysisResult(state) {
    return {
        dayMasterStrength: state.dayMasterStrength,
        mingGe: state.pattern,
        usefulGod: state.usefulGod,
    };
}
export function createBaziAnalysisPipeline(deps) {
    return {
        run(input) {
            return buildAnalysisResult(buildPipelineState(input, deps));
        },
    };
}
