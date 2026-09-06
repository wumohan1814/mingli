/**
 * @file 太阳高度、日出日落与曙暮光证据
 * @description 采用 NOAA/Meeus 低阶太阳模型，输出地点相关的光照事件和计算限制。
 */
import { type AstronomicalTimeEvidence, type AstronomicalTimeInput } from './astronomical-time';
export type SolarCrossingStatus = '正常交点' | '全天高于阈值' | '全天低于阈值';
export interface SolarCrossingEvidence {
    key: string;
    name: string;
    solarAltitudeDegrees: number;
    status: SolarCrossingStatus;
    morningUtcDateTime: string | null;
    eveningUtcDateTime: string | null;
    morningLocalDateTime: string | null;
    eveningLocalDateTime: string | null;
    promptText: string;
    ownerFactKeys: string[];
    calculationStepKeys: string[];
    sources: string[];
    calculation: string;
    limitation: '太阳高度阈值交点只描述低阶太阳模型在理想地平线条件下的几何时刻或全天状态；不代表实际可见性、天气、遮挡、建筑采光效果、吉凶或事件结果';
}
export interface SolarIlluminationCalculationStep {
    key: string;
    stage: '天文时间' | '参考太阳位置' | '视太阳正午' | '阈值交点';
    status: '已计算';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number>;
    result: Record<string, string | number>;
    promptText: string;
    sources: string[];
    limitation: '太阳光照步骤只证明天文时间、低阶太阳位置、视太阳正午和高度阈值交点如何形成；不得把几何结果解释为实际可见性、建筑采光效果或导航级精度';
}
export interface SolarIlluminationAssumptionFact {
    key: string;
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '假设事实只说明标准太阳半径、折射近似与单日时区偏移的计算前提；不得当作实际天气、遮挡或时区切换影响已经排除';
}
export interface SolarCrossingSummaryFact {
    key: 'solar-illumination:crossing-summary';
    status: '均有正常交点' | '存在全天状态';
    factKeys: string[];
    crossingFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '交点汇总只说明四类太阳高度阈值在该民用日期是否存在正常交点；全天状态不是错误，也不得直接解释为现实吉凶或居住效果';
}
export interface SolarIlluminationLimitationFact {
    key: string;
    type: '现场可见性边界' | '时区切换边界' | '模型精度边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束太阳高度、方位、日出日落和曙暮光结果可以支持的解释范围，不得被反向当作天气、建筑性能、吉凶或事件证据';
}
export interface SolarIlluminationSummaryFact {
    key: 'solar-illumination:evidence-summary';
    status: '证据链完整' | '含全天状态';
    factKeys: string[];
    calculationStepCount: number;
    normalCrossingCount: number;
    allDayStateCount: number;
    assumptionFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '太阳光照证据汇总只统计天文时间、太阳位置、视太阳正午、阈值交点、全天状态、假设与限制覆盖；不得按状态生成采光评分、天气结论、吉凶或事件保证';
}
export interface SolarIlluminationInput extends AstronomicalTimeInput {
    latitude: number;
    longitude: number;
}
export interface SolarIlluminationEvidence {
    key: string;
    status: '已计算' | '存在全天状态';
    localDate: string;
    referenceLocalDateTime: string;
    referenceUtcDateTime: string;
    latitude: number;
    longitude: number;
    timezone: number;
    astronomicalTime: AstronomicalTimeEvidence;
    solarAltitudeDegrees: number;
    solarAzimuthDegrees: number;
    solarDeclinationDegrees: number;
    equationOfTimeMinutes: number;
    apparentSolarNoonUtcDateTime: string;
    apparentSolarNoonLocalDateTime: string;
    sunriseSunset: SolarCrossingEvidence;
    civilTwilight: SolarCrossingEvidence;
    nauticalTwilight: SolarCrossingEvidence;
    astronomicalTwilight: SolarCrossingEvidence;
    method: string;
    source: string;
    calculationSteps: SolarIlluminationCalculationStep[];
    calculationChain: string[];
    assumptions: string[];
    assumptionFacts: SolarIlluminationAssumptionFact[];
    crossingSummaryFact: SolarCrossingSummaryFact;
    summaryFact: SolarIlluminationSummaryFact;
    limitations: string[];
    limitationFacts: SolarIlluminationLimitationFact[];
    promptText: string;
}
export declare function calculateSolarIlluminationEvidence(input: SolarIlluminationInput): SolarIlluminationEvidence;
