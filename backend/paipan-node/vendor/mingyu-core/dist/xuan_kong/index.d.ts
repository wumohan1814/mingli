/**
 * @file 玄空飞星
 * @description 三元九运、下卦山向飞星、流年流月紫白叠宫、局型组合与结构化证据。
 * @传统依据 玄空飞星通行的三元九运、运盘顺飞、元龙阴阳定山向盘顺逆与下卦口径；流年流月取三元紫白入中后顺飞。
 * 不做形峦、玄空大卦或吉凶总分。
 */
import { type Formation } from '@soul-atelier/xuankong';
import { type XuanKongEvidenceAnalysis } from './evidence';
import { evaluateCastleGate, type CastleGateEvaluation } from './castle-gate';
import { flyStars, resolveFlyingStarYunState, resolveShanXiangRelation, resolveMonthFlyingStar, resolveXuanKongFlowStars, resolveYearFlyingStar, type FlyingStarYunState, type ShanXiangRelation, type XuanKongFlowStars } from './period-stars';
export { evaluateCastleGate, flyStars, resolveFlyingStarYunState, resolveMonthFlyingStar, resolveShanXiangRelation, resolveXuanKongFlowStars, resolveYearFlyingStar, };
export type { FlyDirection, FlyingStarYunState, ShanXiangRelation, XuanKongFlowStars, } from './period-stars';
export type { CastleGateCandidate, CastleGateEvaluation } from './castle-gate';
export type XuanKongFormation = Formation;
export interface XuanKongPeriod {
    year: number;
    yuan: '上元' | '中元' | '下元';
    yun: number;
    yunStar: number;
    startYear: number;
    endYear: number;
    label: string;
}
export interface XuanKongMeasurement {
    facingDegree?: number;
    sitDegree?: number;
    stability: '稳定' | '山向边界敏感';
    nearestBoundaryDistanceDegrees?: number;
    candidateMountains?: Array<{
        sitMountain: string;
        facingMountain: string;
        label: string;
    }>;
    warnings: string[];
}
export interface XuanKongInput {
    year: number;
    sitMountain?: string;
    facingMountain?: string;
    facingDegree?: number;
    sitDegree?: number;
    measurementUncertaintyDegrees?: number;
    /** 流年公元年；不传则只排宅盘，不排流年飞星 */
    flowYear?: number;
    /** 流月公历月 1-12；须同时提供 flowYear */
    flowMonth?: number;
    /** 流月日期；不传时按该月 15 日所属节气月 */
    flowDay?: number;
}
export interface XuanKongPalace {
    gong: number;
    name: string;
    direction: string;
    yunStar: number;
    shanStar: number;
    xiangStar: number;
    yearStar?: number;
    monthStar?: number;
    shanXiangRelation: ShanXiangRelation;
    yunStarState: FlyingStarYunState;
}
export interface XuanKongCombination {
    name: string;
    kind: 'auspicious' | 'inauspicious';
    palaces?: number[];
    note: string;
}
export interface XuanKongResult {
    period: XuanKongPeriod;
    sitMountain: string;
    facingMountain: string;
    plates: {
        yun: number[];
        shan: number[];
        xiang: number[];
        year?: number[];
        month?: number[];
    };
    flowStars?: XuanKongFlowStars;
    palaces: XuanKongPalace[];
    formation: XuanKongFormation;
    combinations: XuanKongCombination[];
    engine: {
        name: '@soul-atelier/xuankong';
        version: '0.2.1';
        mode: '下卦';
    };
    daoShanXiang: {
        shanToMountain: boolean;
        xiangToFacing: boolean;
        summary: string;
    };
    measurement?: XuanKongMeasurement;
    castleGate?: CastleGateEvaluation;
    evidenceAnalysis: XuanKongEvidenceAnalysis;
    prompt: string;
}
export declare function resolveXuanKongPeriod(year: number): XuanKongPeriod;
export declare function generateXuanKong(input: XuanKongInput): XuanKongResult;
export type { XuanKongEvidenceAnalysis };
