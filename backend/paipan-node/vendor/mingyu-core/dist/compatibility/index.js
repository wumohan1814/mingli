import { analyzeBaziCompatibility, } from '../bazi/index.js';
import { analyzeAstrolabeSynastry, } from '../divination/index.js';
import { analyzeZiweiCompatibility, } from '../ziwei/iztro/index.js';
import { calculateBirthChartBundle, } from '../birth/index.js';
const DEFAULT_SYSTEMS = ['bazi'];
const SYSTEMS = new Set(['bazi', 'ziwei', 'astrolabe']);
function normalizeSystems(systems) {
    const requested = systems?.length ? systems : DEFAULT_SYSTEMS;
    const unique = Array.from(new Set(requested));
    for (const system of unique) {
        if (!SYSTEMS.has(system))
            throw new Error(`不支持的合盘系统：${String(system)}。`);
    }
    return unique;
}
/** 从两份 BirthProfile 直接生成八字、紫微和西占合盘证据。 */
export async function calculateCompatibilityBundle(primary, partner, options = {}) {
    const systems = normalizeSystems(options.systems);
    const chartOptions = {
        ...options.chart,
        systems,
    };
    const [primaryChart, partnerChart] = await Promise.all([
        calculateBirthChartBundle(primary, chartOptions),
        calculateBirthChartBundle(partner, chartOptions),
    ]);
    const bundle = {
        systems,
        primary: primaryChart,
        partner: partnerChart,
    };
    if (systems.includes('bazi')) {
        if (!primaryChart.bazi || !partnerChart.bazi)
            throw new Error('八字合盘资料生成失败。');
        bundle.bazi = analyzeBaziCompatibility(primaryChart.bazi, partnerChart.bazi, {
            person1Name: primary.name,
            person2Name: partner.name,
            ...options.bazi,
        });
    }
    if (systems.includes('astrolabe')) {
        if (!primaryChart.astrolabe || !partnerChart.astrolabe)
            throw new Error('西占合盘资料生成失败。');
        bundle.astrolabe = analyzeAstrolabeSynastry(primaryChart.astrolabe, partnerChart.astrolabe, options.astrolabe);
    }
    if (systems.includes('ziwei')) {
        if (!primaryChart.ziwei || !partnerChart.ziwei)
            throw new Error('紫微合盘资料生成失败。');
        bundle.ziwei = analyzeZiweiCompatibility(primaryChart.ziwei.payloadByScope.origin, partnerChart.ziwei.payloadByScope.origin, {
            person1Name: primary.name,
            person2Name: partner.name,
            astrolabe1: primaryChart.ziwei.astrolabe,
            astrolabe2: partnerChart.ziwei.astrolabe,
            ...options.ziwei,
        });
    }
    return bundle;
}
