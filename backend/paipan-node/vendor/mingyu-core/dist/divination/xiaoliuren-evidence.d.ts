import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { XiaoliurenData, XiaoliurenPalaceDetail } from '../types/divination';
export interface XiaoliurenCalculationStep {
    key: string;
    stage: '定月宫' | '定日宫' | '定时宫';
    status: '已计算' | '资料不足';
    formula: string;
    palace: XiaoliurenPalaceDetail | null;
    dependsOnStepKeys: string[];
    source: string;
    limitation: string;
}
export interface XiaoliurenCalculationFact {
    key: 'xiaoliuren:calculation';
    status: '完整' | '缺少中间参数';
    inputs: {
        lunarMonth: number;
        lunarDay: number;
        hourNumber: number | null;
        hourLabel: string;
        isLeapMonth: boolean;
    };
    steps: XiaoliurenCalculationStep[];
    promptText: string;
    sources: string[];
    limitation: string;
}
export interface XiaoliurenPalaceFact {
    key: string;
    role: '月宫' | '日宫' | '时宫';
    level: '计算轨迹' | '主证';
    palace: XiaoliurenPalaceDetail;
    promptText: string;
    source: string;
    limitation: string;
}
export interface XiaoliurenLimitationFact {
    key: string;
    type: '来源边界' | '中间宫边界' | '歌诀边界' | '历法边界' | '扩展规则边界';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
}
export interface XiaoliurenSummaryFact {
    key: 'xiaoliuren:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    calculationStepCount: number;
    palaceFactCount: number;
    limitationFactCount: number;
    promptText: string;
}
export interface XiaoliurenEvidenceAnalysis {
    key: 'xiaoliuren:evidence';
    status: '已计算' | '资料不足';
    sources: Array<{
        title: string;
        evidence: string;
        role: '规则来源' | '历法来源' | '来源限制';
    }>;
    calculationFact: XiaoliurenCalculationFact;
    calculationSteps: XiaoliurenCalculationStep[];
    palaceFacts: XiaoliurenPalaceFact[];
    primaryFact: XiaoliurenPalaceFact;
    limitationFacts: XiaoliurenLimitationFact[];
    limitations: string[];
    summaryFact: XiaoliurenSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    interpretationOrder: string[];
}
export declare function analyzeXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis;
