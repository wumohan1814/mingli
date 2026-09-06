import type { BaziWarningFact, BaziWarningSummaryFact } from './baziTypes';
/** 边界预警阈值（分钟） */
export declare const BOUNDARY_THRESHOLD_MINUTES = 3;
export interface BoundaryCheckInput {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
}
/**
 * 检查出生时刻是否贴近节气交接（仅检查换柱的"节"）。
 * 返回预警文案数组（无预警时为空数组）。
 */
export declare function checkJieqiBoundary(t: BoundaryCheckInput): string[];
/**
 * 检查出生时刻是否贴近时辰边界（奇数整点），23:00 边界额外提示换日流派问题。
 * 返回预警文案数组（无预警时为空数组）。
 */
export declare function checkShichenBoundary(t: BoundaryCheckInput): string[];
/**
 * 汇总边界预警。仅在具备分钟级精度的输入（真太阳时模式）下调用才有意义。
 */
export declare function collectBoundaryWarnings(t: BoundaryCheckInput): string[];
export declare function buildBaziWarningEvidence(warnings: string[]): {
    warningFacts: BaziWarningFact[];
    warningSummaryFact: BaziWarningSummaryFact;
};
