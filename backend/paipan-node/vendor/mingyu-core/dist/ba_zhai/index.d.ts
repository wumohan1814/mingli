import { type BaZhaiPalace, type SitFacingPosition } from '../direction';
import { type BaZhaiGasRegulationResult } from './suppression';
export { analyzeBaZhaiEvidence } from './evidence';
export { evaluateBaZhaiRegulation } from './suppression';
export type { BaZhaiGasRegulationResult, BaZhaiSuppressionFact } from './suppression';
export type { BaZhaiCalculationFact, BaZhaiCalculationStep, BaZhaiCounterEvidenceFact, BaZhaiCounterSummaryFact, BaZhaiDirectionComparison, BaZhaiDirectionFact, BaZhaiEvidenceAnalysis, BaZhaiLimitationFact, BaZhaiMeasurementCandidateFact, BaZhaiMeasurementFact, } from './evidence';
export interface BaZhaiInput {
    /** 出生公历年份（用于推命卦；已按立春换年处理） */
    birthYear?: number;
    /** 出生公历月日，用于准确处理立春换年。 */
    birthMonth?: number;
    birthDay?: number;
    /** 性别 */
    gender?: 'male' | 'female';
    /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
    mingGua?: string;
    /** 坐山（二十四山，如「子」），用于推宅卦 */
    sitMountain?: string;
}
export interface BaZhaiResult {
    calculationInput: {
        mingGuaSource: '出生年与性别计算' | '直接给定';
        birthYear?: number;
        birthMonth?: number;
        birthDay?: number;
        gender?: 'male' | 'female';
        directMingGua?: string;
        sitMountain?: string;
    };
    mingGua: string;
    effectiveBirthYear: number | null;
    birthYearBoundaryNote: string;
    mingGroup: '东四命' | '西四命';
    houseGua: string | null;
    houseGroup: '东四命' | '西四命' | null;
    /** 命卦大游年盘 */
    mingPalace: BaZhaiPalace[];
    /** 宅卦大游年盘（若有坐山） */
    housePalace: BaZhaiPalace[] | null;
    /** 命宅配合 */
    match: '相合' | '相冲' | '未知';
    matchAdvice: string;
    luckyDirections: BaZhaiPalace[];
    unluckyDirections: BaZhaiPalace[];
    gasRegulation?: BaZhaiGasRegulationResult;
    evidenceAnalysis: import('./evidence').BaZhaiEvidenceAnalysis;
    prompt: string;
}
/** 从大门处面向屋内测量的八宅便捷入参。 */
export interface BaZhaiDoorDegreeInput extends Omit<BaZhaiInput, 'sitMountain'> {
    /** 站在大门处面向屋内时的指南针读数，正北为 0°，顺时针增加。 */
    doorToInteriorDegree: number;
    /** 读数采用的北向基准；未声明时只按原始罗盘读数计算并提示核验。 */
    northReference?: 'unspecified' | 'magnetic' | 'true';
    /** 当读数基于磁北时使用，东偏为正、西偏为负。 */
    magneticDeclinationDegrees?: number;
    /** 测量可能误差，单位为度；用于判断是否跨越二十四山边界。 */
    measurementUncertaintyDegrees?: number;
}
export type BaZhaiMeasurementStability = '稳定' | '山向边界敏感' | '宅卦不稳定';
export interface BaZhaiDirectionCandidate {
    sitMountain: string;
    facingMountain: string;
    label: string;
    houseGua: string;
    houseGroup: '东四命' | '西四命';
    match: '相合' | '相冲';
    housePalace: BaZhaiPalace[];
}
/** 入户测量读数换算成传统坐山朝向后的完整资料。 */
export interface BaZhaiDoorMeasurement {
    method: '站在大门处面向屋内测量';
    measuredDegree: number;
    northReference: 'unspecified' | 'magnetic' | 'true';
    magneticDeclinationDegrees: number | null;
    /** 换算至真北基准后的入户方向；未声明北向时等同原始读数。 */
    trueNorthDegree: number;
    measurementUncertaintyDegrees: number;
    nearestBoundaryDistanceDegrees: number;
    stability: BaZhaiMeasurementStability;
    candidateDirections: BaZhaiDirectionCandidate[];
    warnings: string[];
    facingDegree: number;
    facingMountain: string;
    sitDegree: number;
    sitMountain: string;
    label: string;
    promptText: string;
}
export interface BaZhaiDoorDegreeResult extends BaZhaiResult {
    directionMeasurement: BaZhaiDoorMeasurement;
}
/**
 * 将“从大门面向屋内”的指南针读数换算为八宅传统坐山朝向。
 * 例如读数 0° 表示从大门向屋内看正北，对应子山午向。
 */
export declare function getBaZhaiSitFacingFromDoorDegree(doorToInteriorDegree: number): SitFacingPosition;
/** 八宅风水分析 */
export declare function analyzeBaZhai(input: BaZhaiInput): BaZhaiResult;
/**
 * 直接使用“从大门面向屋内”的指南针读数生成完整八宅结果。
 * 调用方无需自行换算相反方向或二十四山。
 */
export declare function analyzeBaZhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult;
export declare const bazhai: {
    analyzeBaZhai: typeof analyzeBaZhai;
    analyzeBaZhaiByDoorDegree: typeof analyzeBaZhaiByDoorDegree;
    getBaZhaiSitFacingFromDoorDegree: typeof getBaZhaiSitFacingFromDoorDegree;
};
