/**
 * @file 八字合婚深层古典理法算法
 * @传统依据 《渊海子平》《三命通会》《星平会海》：年命纳音生克比和、夫妻宫天地德合与天克地冲、双向喜用神五行互补。
 */
import type { BaziChartResult, Wuxing } from './baziTypes';
export interface NayinCompatibilityResult {
    person1YearGanZhi: string;
    person1Nayin: string;
    person1Element: Wuxing;
    person2YearGanZhi: string;
    person2Nayin: string;
    person2Element: Wuxing;
    relation: '比和' | '生对方' | '受对方生' | '克对方' | '受对方克';
    judgment: string;
}
export interface SpousePalaceDeepRelationResult {
    person1DayGanZhi: string;
    person2DayGanZhi: string;
    stemRelation: '五合' | '天干冲' | '相生' | '相克' | '比和';
    branchRelation: '六合' | '六冲' | '相刑' | '相害' | '同支' | '相生' | '相克' | '无明显刑冲合害';
    isTianDeHe: boolean;
    isTianKeDiChong: boolean;
    judgment: string;
}
export interface UsefulGodComplementarityResult {
    person1Useful: string[];
    person2Useful: string[];
    person1CoveredByPerson2Count: number;
    person2CoveredByPerson1Count: number;
    level: '互为喜用' | '单向得益' | '中和相济' | '互见忌神';
    judgment: string;
}
export interface BaziMarriageDeepEvaluation {
    nayin: NayinCompatibilityResult;
    spousePalace: SpousePalaceDeepRelationResult;
    usefulGodComplementarity: UsefulGodComplementarityResult;
    summary: string;
}
/**
 * 评估年柱纳音五行生克配对
 */
export declare function evaluateNayinCompatibility(chart1: BaziChartResult, chart2: BaziChartResult): NayinCompatibilityResult;
/**
 * 评估日柱夫妻宫天合地合与天克地冲深层关系
 */
export declare function evaluateSpousePalaceDeepRelation(chart1: BaziChartResult, chart2: BaziChartResult): SpousePalaceDeepRelationResult;
/**
 * 评估喜用神互补度
 */
export declare function evaluateUsefulGodComplementarity(chart1: BaziChartResult, chart2: BaziChartResult): UsefulGodComplementarityResult;
/**
 * 综合评估八字合婚古典理法
 */
export declare function evaluateBaziMarriageDeep(chart1: BaziChartResult, chart2: BaziChartResult): BaziMarriageDeepEvaluation;
