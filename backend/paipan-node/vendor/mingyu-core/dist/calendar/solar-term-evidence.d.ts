declare const TERM_NAMES: readonly ["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪"];
export type SolarTermName = (typeof TERM_NAMES)[number];
export interface SolarTermCalculationStep {
    key: string;
    stage: '目标黄经' | '历表时刻' | '独立求根' | '差值核验';
    status: '已计算' | '已采用';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number>;
    result: Record<string, string | number | boolean>;
    promptText: string;
    sources: string[];
    limitation: '节气计算步骤只证明目标黄经、采用历表、低阶模型求根和两者差值如何形成；不得把二分区间或输出小数位解释为观测级精度';
}
export interface SolarTermVerificationFact {
    key: string;
    status: '已记录差值';
    adoptedStepKey: string;
    modelStepKey: string;
    seedDifferenceSeconds: number;
    promptText: string;
    sources: string[];
    limitation: '独立模型差值只用于核验采用历表没有明显偏离节气定义；不得用低阶模型覆盖采用历表，也不得据差值生成可信度百分比';
}
export interface SolarTermLimitationFact {
    key: string;
    type: '数值求根精度' | '星历模型边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束节气历表与独立太阳黄经核验可以支持的精度声明，不得被反向当作现实事件、吉凶或应期证据';
}
export interface SolarTermSummaryFact {
    key: string;
    status: '历表已采用并完成独立核验';
    factKeys: string[];
    calculationStepCount: number;
    verificationFactCount: 1;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '节气证据汇总只统计目标黄经、采用历表、独立低阶模型求根、差值核验与限制覆盖；不得按差值大小或数值位数生成可信度百分比、观测精度声明、现实吉凶或固定应期';
}
export interface SolarTermEvidence {
    key: string;
    status: '历表已采用并独立核验';
    name: SolarTermName;
    index: number;
    isJie: boolean;
    targetLongitudeDegrees: number;
    utcTimestamp: number;
    utcDateTime: string;
    julianDayUtc: number;
    modelRootUtcTimestamp: number;
    modelRootUtcDateTime: string;
    solarLongitudeDegrees: number;
    residualDegrees: number;
    seedUtcDateTime: string;
    seedDifferenceSeconds: number;
    searchWindowHours: number;
    refinementToleranceSeconds: number;
    refinementIterations: number;
    method: string;
    source: string;
    calculationSteps: SolarTermCalculationStep[];
    calculationChain: string[];
    verificationFact: SolarTermVerificationFact;
    summaryFact: SolarTermSummaryFact;
    limitations: string[];
    limitationFacts: SolarTermLimitationFact[];
    promptText: string;
}
export declare function calculateSolarTermEvidence(year: number, index: number): SolarTermEvidence;
export declare function calculateSolarTermsForYear(year: number): SolarTermEvidence[];
export declare function findSolarTermEvidence(name: SolarTermName, year: number): SolarTermEvidence;
export {};
