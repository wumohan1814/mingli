import { baziCalculator } from '../bazi/baziCalculator.js';
import { generateAstrolabe } from '../divination/algorithms/astrolabe.js';
import { generateQizheng } from '../qi_zheng/index.js';
import { birthProfileToAstrolabeInput, birthProfileToBaziPerson, birthProfileToQizhengInput, birthProfileToZiweiChartInput, normalizeBirthProfile, } from '../profile/index.js';
import { calculateZiweiChart } from '../ziwei/runtime.js';
const DEFAULT_SYSTEMS = ['bazi'];
const SYSTEMS = new Set(['bazi', 'ziwei', 'astrolabe', 'qizheng']);
function normalizeSystems(systems) {
    const requested = systems?.length ? systems : DEFAULT_SYSTEMS;
    const unique = Array.from(new Set(requested));
    for (const system of unique) {
        if (!SYSTEMS.has(system))
            throw new Error(`不支持的出生排盘系统：${String(system)}。`);
    }
    return unique;
}
/**
 * 从同一份出生档案生成多个盘面。
 *
 * 该入口只负责输入统一、算法调用和结果归组，不生成报告，也不把缺失资料
 * 静默替换成候选盘。所选系统所需的资料不足时，沿用各适配器的结构化错误。
 */
export async function calculateBirthChartBundle(profile, options = {}) {
    const systems = normalizeSystems(options.systems);
    const normalized = normalizeBirthProfile(profile);
    const bundle = {
        profile,
        normalized,
        systems,
        inputs: {},
    };
    for (const system of systems) {
        switch (system) {
            case 'bazi': {
                const input = birthProfileToBaziPerson(profile);
                bundle.inputs.bazi = input;
                bundle.bazi = baziCalculator.calculateBazi(input);
                break;
            }
            case 'ziwei': {
                const input = birthProfileToZiweiChartInput(profile);
                bundle.inputs.ziwei = input;
                bundle.ziwei = await calculateZiweiChart(input, options.ziwei);
                break;
            }
            case 'astrolabe': {
                const input = birthProfileToAstrolabeInput(profile);
                bundle.inputs.astrolabe = input;
                bundle.astrolabe = generateAstrolabe(input);
                break;
            }
            case 'qizheng': {
                const input = birthProfileToQizhengInput(profile);
                bundle.inputs.qizheng = input;
                bundle.qizheng = generateQizheng(input);
                break;
            }
        }
    }
    return bundle;
}
