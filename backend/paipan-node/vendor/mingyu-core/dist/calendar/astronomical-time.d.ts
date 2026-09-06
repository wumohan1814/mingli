/**
 * @file 天文时间尺度证据
 * @description 将当地钟表时间统一换算为 UTC、儒略日和近似 TT，明确记录 ΔT 模型与限制。
 */
import type { HistoricalTimezoneEvidence } from './historical-timezone';
export interface AstronomicalTimeInput {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    timezone?: number;
    timeZoneId?: string;
}
export interface AstronomicalTimeCalculationStep {
    key: string;
    stage: '时区解析' | 'UTC换算' | 'UTC儒略日' | 'UT1近似' | 'ΔT与TT';
    status: '已计算' | '近似';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number>;
    result: Record<string, string | number>;
    promptText: string;
    sources: string[];
    limitation: '时间尺度步骤只证明当地钟表时间如何换算为 UTC、JD(UTC)、近似 UT1 与近似 TT；不得把数值位数解释为观测精度或底层星历精度';
}
export interface AstronomicalTimeAssumptionFact {
    key: string;
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '假设事实只说明时区与 UT1 近似的计算前提；不得当作地点历史时区、实时 DUT1 或观测精度已经被独立证明';
}
export interface AstronomicalTimeCounterEvidenceFact {
    key: string;
    type: 'UT1近似' | 'ΔT模型等级';
    status: '近似' | '历史拟合' | '近现代估算' | '长期外推';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录 UT1≈UTC 与 ΔT 分段模型的近似或外推状态；不得据模型等级生成可信度百分比或宣称达到观测精度';
}
export interface AstronomicalTimeCounterSummaryFact {
    key: 'astronomical-time:counter-summary';
    status: '存在时间尺度近似';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只提醒时间尺度中存在近似或外推，不否定民用历法用途，也不证明观测级精度';
}
export interface AstronomicalTimeLimitationFact {
    key: string;
    type: 'ΔT估算边界' | '底层星历边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束 UTC、UT1、ΔT 与 TT 数值可以支持的精度声明，不得被反向当作天文事件或现实结果证据';
}
export interface AstronomicalTimeSummaryFact {
    key: 'astronomical-time:evidence-summary';
    status: '民用时间链完整' | '含长期外推' | '历史时区歧义已消解' | '含历史时区歧义' | '含固定偏移冲突' | '含历史时区歧义与偏移冲突';
    factKeys: string[];
    calculationStepCount: number;
    assumptionFactCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '天文时间证据汇总只统计时区、UTC、儒略日、UT1近似、ΔT模型、反证与限制覆盖；不得按状态生成可信度百分比、观测精度声明或现实结论';
}
export interface AstronomicalTimeEvidence {
    key: string;
    status: '已计算';
    localDateTime: string;
    timezone: number;
    timeZoneId?: string;
    timezoneEvidence?: HistoricalTimezoneEvidence;
    utcDateTime: string;
    unixMilliseconds: number;
    julianDayUtc: number;
    julianDayUtApprox: number;
    deltaTSeconds: number;
    julianDayTtApprox: number;
    decimalYear: number;
    deltaTModel: string;
    precisionLevel: '历史拟合' | '近现代估算' | '长期外推';
    assumptions: string[];
    assumptionFacts: AstronomicalTimeAssumptionFact[];
    calculationSteps: AstronomicalTimeCalculationStep[];
    calculationChain: string[];
    counterEvidence: string[];
    counterEvidenceFacts: AstronomicalTimeCounterEvidenceFact[];
    counterSummaryFact: AstronomicalTimeCounterSummaryFact;
    limitations: string[];
    limitationFacts: AstronomicalTimeLimitationFact[];
    summaryFact: AstronomicalTimeSummaryFact;
    source: string;
    promptText: string;
}
/**
 * NASA/Espenak-Meeus 公布的分段多项式，限定项目当前支持的 1900-2200 年。
 * 返回 TT-UT1 的估计秒数，不应解释为观测 DUT1。
 */
export declare function estimateDeltaTSeconds(decimalYear: number): number;
export declare function buildAstronomicalTimeEvidence(input: AstronomicalTimeInput): AstronomicalTimeEvidence;
