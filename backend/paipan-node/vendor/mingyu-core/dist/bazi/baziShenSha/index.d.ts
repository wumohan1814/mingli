import type { ShenShaResult } from '../baziTypes';
import type { BaziArray } from './helpers/types';
import { type ShenShaCalculatorOptions } from './variants';
export { DEFAULT_SHENSHA_VARIANT_CONFIG, resolveShenShaVariantConfig } from './variants';
export { COMMON_BAZI_SHENSHA_NAMES, filterCommonBaziShenSha } from './scope';
export type { ShenShaCalculatorOptions, ShenShaKongWangBasis, ShenShaReferenceProfile, ShenShaTongZiScope, ShenShaVariantConfig, ShenShaYangRenMode, } from './variants';
export type { ShenShaScope } from './scope';
export declare class ShenShaCalculator {
    private ctg;
    private cdz;
    private variants;
    private scope;
    constructor(options?: ShenShaCalculatorOptions);
    private zhiIdx;
    calculateAllShenSha(baziArray: BaziArray, gender: string): ShenShaResult;
    private assertBaziArray;
    analyzeGlobalShenSha(shenShaList: string[]): string[];
    analyzeShenShaWithTenGod(shenShaList: string[], tenGod: string): string[];
    private calculatePillarShenSha;
}
