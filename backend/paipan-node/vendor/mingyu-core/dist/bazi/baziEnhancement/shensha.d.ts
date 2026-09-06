/**
 * 神煞系统扩充：桃花详解与限运分析。
 */
import type { PatternAnalysis } from '../baziTypes';
interface PeachBlossomDetail {
    type: '墙内桃花' | '墙外桃花' | '普通桃花';
    position: string;
    description: string;
    favorable: string;
    unfavorable: string;
}
export declare function getPeachBlossomDetail(pillarPosition: 'year' | 'month' | 'day' | 'hour'): PeachBlossomDetail;
export interface PeriodAnalysis {
    earlyStage: {
        description: string;
        focus: string[];
        tips: string[];
    };
    midStage: {
        description: string;
        focus: string[];
        tips: string[];
    };
    lateStage: {
        description: string;
        focus: string[];
        tips: string[];
    };
}
export declare function generatePeriodAnalysis(pattern: PatternAnalysis, strengthStatus: string, _dayStem: string): PeriodAnalysis;
export {};
