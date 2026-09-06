import { BASIC_MAPPINGS } from '../baziDefinitions.js';
import { assertBaziGender, assertEarthlyBranch, assertHeavenlyStem } from '../baziUtils.js';
import { buildNobleRules } from './helpers/nobleRules.js';
import { buildLuRules } from './helpers/luRules.js';
import { buildDayRules } from './helpers/dayRules.js';
import { buildMarriageRules } from './helpers/marriageRules.js';
import { buildDisasterRules } from './helpers/disasterRules.js';
import { analyzeGlobalShenSha, calculateGlobalShenSha } from './helpers/globalRules.js';
import { analyzeShenShaWithTenGod } from './helpers/tenGodAnalysis.js';
import { filterCommonBaziShenSha } from './scope.js';
import { resolveShenShaVariantConfig, } from './variants.js';
export { DEFAULT_SHENSHA_VARIANT_CONFIG, resolveShenShaVariantConfig } from './variants.js';
export { COMMON_BAZI_SHENSHA_NAMES, filterCommonBaziShenSha } from './scope.js';
export class ShenShaCalculator {
    ctg;
    cdz;
    variants;
    scope;
    constructor(options = {}) {
        this.ctg = BASIC_MAPPINGS.HEAVENLY_STEMS;
        this.cdz = BASIC_MAPPINGS.EARTHLY_BRANCHES;
        this.variants = resolveShenShaVariantConfig(options.variants);
        this.scope = options.scope ?? 'common';
    }
    zhiIdx(zhi) {
        return this.cdz.indexOf(zhi);
    }
    calculateAllShenSha(baziArray, gender) {
        this.assertBaziArray(baziArray);
        assertBaziGender(gender);
        const result = {
            year: [],
            month: [],
            day: [],
            hour: [],
        };
        const pillars = ['year', 'month', 'day', 'hour'];
        baziArray.forEach((pillar, index) => {
            const [gan, zhi] = pillar;
            const shenShaList = this.calculatePillarShenSha(gan, zhi, index, baziArray, gender);
            result[pillars[index]] = shenShaList;
        });
        const globalShenSha = calculateGlobalShenSha(baziArray, this.variants.referenceProfile);
        if (globalShenSha.length > 0) {
            result.global = globalShenSha;
        }
        if (this.scope === 'all')
            return result;
        const commonResult = {
            year: filterCommonBaziShenSha(result.year),
            month: filterCommonBaziShenSha(result.month),
            day: filterCommonBaziShenSha(result.day),
            hour: filterCommonBaziShenSha(result.hour),
        };
        const global = filterCommonBaziShenSha(result.global ?? []);
        if (global.length > 0)
            commonResult.global = global;
        return commonResult;
    }
    assertBaziArray(baziArray) {
        if (!Array.isArray(baziArray) || baziArray.length !== 4) {
            throw new Error('神煞计算需要完整四柱。');
        }
        baziArray.forEach((pillar, index) => {
            if (!Array.isArray(pillar) || pillar.length !== 2) {
                throw new Error(`第 ${index + 1} 柱格式无效。`);
            }
            assertHeavenlyStem(pillar[0], `第 ${index + 1} 柱天干`);
            assertEarthlyBranch(pillar[1], `第 ${index + 1} 柱地支`);
        });
    }
    analyzeGlobalShenSha(shenShaList) {
        return analyzeGlobalShenSha(shenShaList);
    }
    analyzeShenShaWithTenGod(shenShaList, tenGod) {
        return analyzeShenShaWithTenGod(shenShaList, tenGod);
    }
    calculatePillarShenSha(gan, zhi, pillarIndex, baziArray, gender) {
        const results = [];
        const [nianGan, nianZhi] = baziArray[0];
        const [, yueZhi] = baziArray[1];
        const [riGan, riZhi] = baziArray[2];
        const riGZ = riGan + riZhi;
        const pillarGZ = gan + zhi;
        const isMan = gender === 'male';
        const ctx = {
            gan,
            zhi,
            pillarIndex,
            baziArray,
            gender,
            nianGan,
            nianZhi,
            yueZhi,
            riGan,
            riZhi,
            riGZ,
            pillarGZ,
            isMan,
            ctg: this.ctg,
            cdz: this.cdz,
            zhiIdx: (z) => this.zhiIdx(z),
            variants: this.variants,
        };
        const rules = {
            ...buildNobleRules(ctx),
            ...buildLuRules(ctx),
            ...buildDayRules(ctx),
            ...buildMarriageRules(ctx),
            ...buildDisasterRules(ctx),
        };
        for (const name in rules) {
            if (rules[name]()) {
                results.push(name);
            }
        }
        return results;
    }
}
