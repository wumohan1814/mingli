import { type ChinaDstCheckResult } from './china-dst';
import { type CivilDateTimeParts } from './civil-time';
import type { HistoricalTimezoneEvidence } from './historical-timezone';
export interface SolarDateTimeParts extends CivilDateTimeParts {
}
export interface TrueSolarTimeResult {
    correctedTime: SolarDateTimeParts;
    longitudeCorrectionMinutes: number;
    equationOfTimeMinutes: number;
    totalCorrectionMinutes: number;
}
export interface TrueSolarTimeCalculationStep {
    key: string;
    stage: '历法输入换算' | '输入口径核验' | '历史时区解析' | '历史夏令时还原' | '经度时差计算' | '均时差计算' | '总校正与跨日' | '时辰映射';
    status: '已核验' | '已换算' | '已解析' | '已计算' | '已应用' | '未请求' | '未命中';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    promptText: string;
    sources: string[];
    limitation: '真太阳时步骤只证明当地钟表时间如何经历法换算、历史夏令时还原、经度时差、均时差与时辰映射形成当前唯一结果；不得据此生成候选时辰、出生时间敏感性、预测概率或观测级精度声明';
}
export interface TrueSolarTimeCorrectionFact {
    key: string;
    type: '历法输入' | '历史时区' | '历史夏令时' | '经度时差' | '均时差' | '总校正' | '跨日结果' | '时辰结果';
    status: '已核验' | '已换算' | '已解析' | '已应用' | '未请求' | '未命中' | '已计算' | '已确定';
    correctionMinutes?: number;
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '校正事实只记录历法、夏令时、经度、均时差、跨日与时辰映射的计算结果；不证明原始出生记录必然正确，也不生成候选时柱或现实事件结论';
}
export interface TrueSolarTimeLimitationFact {
    key: string;
    type: '均时差近似' | '经度与时区口径' | '历史时区口径' | '历史夏令时口径' | '原始记录边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束真太阳时校正可支持的时间口径和精度声明；不得被反向当作原始出生记录真实性、候选时辰、现实事件或预测有效性证据';
}
export interface TrueSolarTimeSummaryFact {
    key: 'true-solar-time:evidence-summary';
    status: '证据链完整' | '历史时区歧义已消解' | '含夏令时重复时段' | '含夏令时不存在时段';
    factKeys: string[];
    calculationStepCount: number;
    correctionFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '真太阳时证据汇总只统计历法输入、钟表时间、历史夏令时、经度时差、均时差、跨日、时辰映射与限制覆盖；不得按校正量或边界状态生成可信度百分比、候选时辰、敏感性结果或必然结论';
}
export interface TrueSolarTimeEvidenceFields {
    key: string;
    status: '已计算' | '存在时间记录边界';
    calculationSteps: TrueSolarTimeCalculationStep[];
    calculationChain: string[];
    correctionFacts: TrueSolarTimeCorrectionFact[];
    summaryFact: TrueSolarTimeSummaryFact;
    limitations: string[];
    limitationFacts: TrueSolarTimeLimitationFact[];
    timezoneEvidence?: HistoricalTimezoneEvidence;
    source: string;
    promptText: string;
}
export interface TrueSolarTimeConversionInput {
    /** 不带时区偏移的当地钟表时间，如 1990-05-15T10:30:00。 */
    localDateTime: string;
    /** 出生地或观测地经度，东经为正、西经为负。 */
    longitude: number;
    /** 当地标准时区，默认 UTC+8；支持小数时区。 */
    timezone?: number;
    /** IANA 历史时区，如 America/New_York；用于按当地日期解析历史 UTC 偏移。 */
    timeZoneId?: string;
    /** 是否按中国 1986-1991 历史规则自动还原夏令时，默认 false。 */
    applyChinaDst?: boolean;
}
export interface TrueSolarTimeConversionResult extends TrueSolarTimeResult, TrueSolarTimeEvidenceFields {
    clockTime: SolarDateTimeParts;
    clockDateTime: string;
    standardTime: SolarDateTimeParts;
    standardDateTime: string;
    correctedDateTime: string;
    longitude: number;
    timezone: number;
    timeZoneId?: string;
    standardMeridian: number;
    crossesDate: boolean;
    chinaDst: ChinaDstCheckResult & {
        requested: boolean;
        applied: boolean;
    };
    shichen: {
        index: number;
        branch: string;
        name: string;
    };
}
export interface BirthCalendarClockTimeInput {
    dateType: 'solar' | 'lunar';
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
    isLeapMonth?: boolean;
}
export interface TrueSolarBirthTimeInput extends BirthCalendarClockTimeInput {
    longitude: number;
    timezone?: number;
    timeZoneId?: string;
    applyChinaDst?: boolean;
}
export interface TrueSolarBirthTimeResult extends TrueSolarTimeConversionResult {
    inputDateType: 'solar' | 'lunar';
    isLeapMonth: boolean;
    /** 农历输入先转换为公历；公历输入保持原值。 */
    solarClockTime: SolarDateTimeParts;
    solarClockDateTime: string;
    /** 与项目早子、晚子拆分口径一致的 0-12 时辰索引。 */
    timeIndex: number;
}
export declare function formatSolarDateTimeParts(value: SolarDateTimeParts): string;
export declare function parseLocalDateTime(value: string): SolarDateTimeParts;
export declare function calculateEquationOfTimeMinutes(year: number, month: number, day: number): number;
export declare function calculateTrueSolarTime(standardTime: Pick<SolarDateTimeParts, 'year' | 'month' | 'day' | 'hour' | 'minute'> & Partial<Pick<SolarDateTimeParts, 'second'>>, longitude: number, standardMeridian?: number): TrueSolarTimeResult;
/**
 * 面向 API/MCP 的便捷真太阳时换算入口。
 * localDateTime 表示当地钟表时间，不应包含 Z 或 +08:00 等时区后缀；
 * IANA 时区会自动解析历史夏令时，固定偏移口径可按需启用中国历史夏令时兼容校正。
 */
export declare function convertTrueSolarTime(input: TrueSolarTimeConversionInput): TrueSolarTimeConversionResult;
/**
 * 只校验出生历法输入并换算为公历钟表时间。
 * 不解析时区，也不执行夏令时、经度或均时差校正。
 */
export declare function resolveBirthCalendarClockTime(input: BirthCalendarClockTimeInput): SolarDateTimeParts;
/**
 * 面向各类排盘的统一出生真太阳时入口。
 * 统一处理公历/农历、闰月、时区、中国历史夏令时、跨日与时辰索引。
 */
export declare function resolveTrueSolarBirthTime(input: TrueSolarBirthTimeInput): TrueSolarBirthTimeResult;
