import type { SolarDateTimeParts, TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
import type { ShichenPeriod } from '../calendar/dateUtils';
import type { BirthCalendarType, BirthProfileDiagnostic } from './index';
export type BirthTimeInputMode = 'traditional-shichen' | 'precise-clock-time';
export type BirthTimePrecision = 'shichen' | 'minute';
export interface BirthTimeCalculationStep {
    key: string;
    stage: '时间输入核验' | '历法日期换算' | '真太阳时校正' | '时辰确定';
    status: '已核验' | '已换算' | '已采用' | '未请求' | '存在阻断诊断';
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '出生时间步骤只证明当前明确输入如何换算为唯一日期与时辰口径；不得把传统时辰代表值当作精确分钟，不生成候选时辰、出生时间敏感性、缺时柱命盘或现实事件结论';
}
export interface BirthTimeInputFact {
    key: 'birth-profile:time-input';
    status: '明确传统时辰' | '明确精准时分';
    inputMode: BirthTimeInputMode;
    precision: BirthTimePrecision;
    timeIndex: number;
    shichenName: string;
    shichenRange: string;
    clockTime?: string;
    promptText: string;
    sources: string[];
    limitation: '出生时间输入事实只记录明确输入的是传统时辰还是精准时分；传统时辰是八字、紫微等时辰级排盘的完整输入，但不能冒充分钟级出生记录';
}
export interface BirthTimeLimitationFact {
    key: string;
    type: '时辰适用范围' | '代表时刻边界' | '真太阳时前提' | '唯一输入边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '出生时间限制事实用于约束传统时辰、精准时分、真太阳时与代表时刻可以支持的计算范围；不得反向生成候选盘、敏感性结果、事件概率或必然结论';
}
export interface BirthTimeSummaryFact {
    key: 'birth-profile:time-evidence-summary';
    status: '已按明确传统时辰确定' | '已按精准时分确定' | '已按真太阳时确定' | '存在阻断诊断';
    factKeys: string[];
    inputMode: BirthTimeInputMode;
    precision: BirthTimePrecision;
    usedTrueSolarTime: boolean;
    diagnosticCount: number;
    promptText: string;
    sources: string[];
    limitation: '出生时间证据汇总只说明当前唯一排盘口径和输入精度是否满足目标算法；不得把分钟精度、时辰精度或校正步骤数量解释为命盘可信度、预测准确率或现实事件概率';
}
export interface BirthTimeEvidence {
    key: string;
    status: '已确定' | '存在阻断诊断';
    inputMode: BirthTimeInputMode;
    precision: BirthTimePrecision;
    inputFact: BirthTimeInputFact;
    selectedShichen: ShichenPeriod;
    solarClockTime: SolarDateTimeParts;
    effectiveTime: SolarDateTimeParts;
    usedTrueSolarTime: boolean;
    calculationSteps: BirthTimeCalculationStep[];
    calculationChain: string[];
    summaryFact: BirthTimeSummaryFact;
    diagnostics: BirthProfileDiagnostic[];
    limitations: string[];
    limitationFacts: BirthTimeLimitationFact[];
    source: string;
    promptText: string;
}
export interface BirthTimeEvidenceInput {
    inputMode: BirthTimeInputMode;
    calendarType: BirthCalendarType;
    originalDate: {
        year: number;
        month: number;
        day: number;
        isLeapMonth: boolean;
    };
    inputHour: number;
    inputMinute: number;
    selectedShichen: ShichenPeriod;
    solarClockTime: SolarDateTimeParts;
    effectiveTime: SolarDateTimeParts;
    usedTrueSolarTime: boolean;
    requestedTrueSolarTime: boolean;
    trueSolarEvidence?: TrueSolarTimeEvidenceFields;
    diagnostics: BirthProfileDiagnostic[];
}
export declare function buildBirthTimeEvidence(input: BirthTimeEvidenceInput): BirthTimeEvidence;
