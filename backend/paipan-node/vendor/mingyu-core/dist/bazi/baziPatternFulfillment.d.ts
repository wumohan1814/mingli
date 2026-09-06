/**
 * @file 八字《子平真诠》格局成败与病药救应推导引擎
 * @description 依据《子平真诠》卷二"论格局成败"与"论成中带败败中有成"，
 * 对八字格局进行正统理法成破推导，精确定位局中之"病"与解救之"药"（救应字）。
 */
import type { Pillars } from './baziTypes';
export interface PatternRemedy {
    stem: string;
    pillar: 'year' | 'month' | 'day' | 'hour';
    tenGod: string;
    effect: string;
}
export interface PatternFulfillmentResult {
    patternName: string;
    status: '成格' | '破格' | '破而复成' | '平常';
    basis: string;
    contradiction: string;
    remedies: PatternRemedy[];
    summary: string;
}
type GetTenGodFn = (gan: string, dayMaster: string) => string;
export declare function evaluatePatternFulfillment(pillars: Pillars, dayMaster: string, patternName: string, getTenGod: GetTenGodFn): PatternFulfillmentResult;
export {};
