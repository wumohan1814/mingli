import type { AstrolabeBirthInput, AstrolabeData } from '../../types/divination';
export { analyzeAstrolabeEvidence } from '../astrolabe-evidence';
export type { AstrolabeAspectFact, AstrolabeCalculationFact, AstrolabeCalculationStep, AstrolabeCounterEvidenceFact, AstrolabeCounterSummaryFact, AstrolabeDistributionFact, AstrolabeEvidenceAnalysis, AstrolabeIlluminationFact, AstrolabeLimitationFact, AstrolabePositionFact, AstrolabePrimaryCoverageFact, AstrolabePrimaryFact, } from '../astrolabe-evidence';
export declare function getEssentialDignity(planetName: string, signName: string): {
    dignity: 'domicile' | 'exaltation' | 'detriment' | 'fall';
    label: string;
} | null;
/**
 * 生成西洋占星星盘
 *
 * 使用 Placidus 宫位制计算本命盘，含太阳、月亮、上升、十大星体
 * 落宫、星座、以及主要相位分析。真太阳时只作为传统时间参考证据，
 * 不替换现代星历计算所需的实际出生时刻。
 *
 * @param input 出生信息，含经纬度、时区、出生日期时间等。
 *   设置 useTrueSolarTime 为 true 可附带真太阳时参考证据。
 * @returns 星盘数据对象 AstrolabeData，含星体、宫位、相位等信息。
 *
 * @example
 * ```ts
 * const result = generateAstrolabe({
 *   name: '某人',
 *   gender: '男',
 *   year: '1990',
 *   month: '1',
 *   day: '1',
 *   hour: '10',
 *   minute: '30',
 *   latitude: '39.9',
 *   longitude: '116.4',
 *   timezone: '8',
 * });
 * ```
 */
export declare function generateAstrolabe(input: AstrolabeBirthInput): AstrolabeData;
