export type AstrolabeScopeMode = 'natal' | 'full' | 'yearly' | 'monthly' | 'daily';
import type { AstrolabeData } from '../types/divination';
import { type AstrolabePeriodEventCollection } from './astrolabe-period-events';
export { formatAstrolabeAspectLine, formatAstrolabeAspectSections, rankAstrolabeAspects, } from './astrolabe-chart-facts';
export { buildAstrolabePeriodEventLayers, buildAstrolabePeriodEvents, mergeAstrolabePeriodCollections, mergeAstrolabePeriodEvents, resolveAstrolabePeriodWindow, scoreAstrolabePeriodEvent, } from './astrolabe-period-events';
export type { AstrolabePeriodAxisItem, AstrolabePeriodEvent, AstrolabePeriodEventCollection, AstrolabePeriodEventKind, AstrolabePeriodScopeMode, AstrolabePeriodTransitGroup, AstrolabePeriodWindow, } from './astrolabe-period-events';
import { type AstronomicalTimeEvidence } from '../calendar/astronomical-time';
export type AstrolabeScopeContext = {
    scope: AstrolabeScopeMode;
    dateStr: string;
    displayText: string;
    displayLabel: string;
    promptText: string;
    solarReturnEvidence?: SolarReturnEvidence;
    secondaryProgressionEvidence?: SecondaryProgressionEvidence;
    solarArcEvidence?: SolarArcEvidence;
    periodEvents?: AstrolabePeriodEventCollection;
};
export type AstrolabeFullScopeContexts = {
    natal: AstrolabeScopeContext;
    yearly: AstrolabeScopeContext;
    monthly: AstrolabeScopeContext;
    daily: AstrolabeScopeContext;
};
export type AstrolabeAdvancedTechnique = '太阳返照' | '次限推进' | '太阳弧';
export interface AstrolabeAdvancedCalculationStep {
    key: string;
    technique: AstrolabeAdvancedTechnique;
    stage: '输入核验' | '时间映射' | '粗略搜索' | '数值细化' | '位置计算' | '推进弧计算' | '相位筛选';
    status: '已计算' | '近似' | '不可用';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    promptText: string;
    sources: string[];
    limitation: '高级时限步骤只证明太阳返照、次限推进或太阳弧的时间映射、位置计算与相位筛选如何形成；不得把数值精度解释为事件必然性或预测成功率';
}
export interface AstrolabeAdvancedAspectFact {
    key: string;
    technique: AstrolabeAdvancedTechnique;
    status: '命中容许度';
    movingPoint: string;
    natalPoint: string;
    aspectName: string;
    actualAngle: number;
    exactAngle: number;
    deviation: number;
    allowedOrb: number;
    normalizedOrbRatio: number;
    closeness: '紧密' | '中等' | '宽松';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '高级时限相位只描述推进点或返照点与本命点在设定容许度内的几何关系；偏差、紧密等级和数量不代表事件概率、吉凶比例或必然结果';
}
export interface AstrolabeAdvancedAspectSummaryFact {
    key: string;
    status: '有主要相位' | '未见主要相位' | '无法计算';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '高级时限相位汇总只说明当前筛选范围内是否列出主要几何相位；未见不等于没有其他弱相位，有相位也不等于现实事件必然发生';
}
export interface AstrolabeAdvancedLimitationFact {
    key: string;
    technique: AstrolabeAdvancedTechnique;
    type: '输入完整性' | '时间映射边界' | '数值精度边界' | '星历模型边界' | '解释边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束太阳返照、次限推进和太阳弧可以支持的时间与解释范围，不得被反向当作现实事件、吉凶或固定应期证据';
}
export interface AstrolabeAdvancedSummaryFact {
    key: string;
    technique: AstrolabeAdvancedTechnique;
    status: '证据链完整' | '证据链含近似' | '不适用' | '证据链有缺口';
    factKeys: string[];
    calculationStepCount: number;
    aspectFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '高级时限证据汇总只统计时间映射、位置或推进弧计算、主要相位、近似状态与限制覆盖；不得按数量、偏差或状态生成预测成功率、吉凶分数、事件概率或固定应期';
}
export type SolarReturnEvidence = {
    key: string;
    status: 'exact' | 'approximate' | 'not-applicable' | 'unavailable';
    targetYear: number;
    dateTime?: string;
    timezone: number;
    residualDegrees?: number;
    searchWindowHours: number;
    coarseStepHours: number;
    refinementToleranceMinutes: number;
    refinementIterations: number;
    aspects: string[];
    calculationSteps: AstrolabeAdvancedCalculationStep[];
    calculationChain: string[];
    aspectFacts: AstrolabeAdvancedAspectFact[];
    aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
    summaryFact: AstrolabeAdvancedSummaryFact;
    source: string;
    limitations: string[];
    limitationFacts: AstrolabeAdvancedLimitationFact[];
    timeScale?: AstronomicalTimeEvidence;
    promptText: string;
};
export interface SecondaryProgressionEvidence {
    key: string;
    status: 'calculated' | 'not-applicable' | 'unavailable';
    targetYear: number;
    age?: number;
    progressedDateTime?: string;
    aspects: string[];
    calculationSteps: AstrolabeAdvancedCalculationStep[];
    calculationChain: string[];
    aspectFacts: AstrolabeAdvancedAspectFact[];
    aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
    summaryFact: AstrolabeAdvancedSummaryFact;
    source: string;
    limitations: string[];
    limitationFacts: AstrolabeAdvancedLimitationFact[];
    promptText: string;
}
export interface SolarArcEvidence {
    key: string;
    status: 'calculated' | 'not-applicable' | 'unavailable';
    targetYear: number;
    age?: number;
    progressedDateTime?: string;
    arcDegrees?: number;
    aspects: string[];
    calculationSteps: AstrolabeAdvancedCalculationStep[];
    calculationChain: string[];
    aspectFacts: AstrolabeAdvancedAspectFact[];
    aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
    summaryFact: AstrolabeAdvancedSummaryFact;
    source: string;
    limitations: string[];
    limitationFacts: AstrolabeAdvancedLimitationFact[];
    promptText: string;
}
export declare function calculateSecondaryProgressionEvidence(data: AstrolabeData, targetYear: number): SecondaryProgressionEvidence;
export declare function calculateSolarArcEvidence(data: AstrolabeData, targetYear: number): SolarArcEvidence;
export declare function calculateSolarReturnEvidence(data: AstrolabeData, targetYear: number): SolarReturnEvidence;
export declare function buildAstrolabeScopeContext(data: AstrolabeData | null | undefined, scope: AstrolabeScopeMode, dateStr: string): AstrolabeScopeContext;
export declare function buildAstrolabeFullScopeContexts(data: AstrolabeData, referenceDateStr: string): AstrolabeFullScopeContexts;
export declare function getAstrolabeScopeLabel(scope: AstrolabeScopeMode): string;
