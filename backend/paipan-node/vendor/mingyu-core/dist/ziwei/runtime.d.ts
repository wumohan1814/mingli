import type { AnalysisPayloadV1, ScopeType } from '../types/analysis';
import type { ChartInput } from '../types/chart';
import type { IztroAstrolabe, IztroHoroscope } from '../types/iztro';
import { buildVerifiedDecadalTimelineOptions } from './iztro/decadal';
/** npm 用户可直接消费的紫微完整运行结果。 */
export type ZiweiRuntime = {
    astrolabe: IztroAstrolabe;
    horoscope: IztroHoroscope;
    /** 本次运限计算实际采用的日期与时辰，便于缓存、审计和重放。 */
    horoscopeContext: ZiweiHoroscopeContext;
    payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
    decadalTimeline: Awaited<ReturnType<typeof buildVerifiedDecadalTimelineOptions>>;
    trueSolarEvidence?: ChartInput['trueSolarEvidence'];
};
export declare const DEFAULT_ZIWEI_RUNTIME_SCOPES: ScopeType[];
export interface ZiweiHoroscopeContext {
    /** 运限排盘使用的公历日期，格式 YYYY-MM-DD。 */
    dateStr: string;
    /** 运限排盘使用的时辰索引，范围 0-12。 */
    hourIndex: number;
}
export interface ZiweiRuntimeOptions {
    /** 需要生成的资料范围；不传时生成全部范围。 */
    scopes?: ScopeType[];
    /** 是否只生成盘面结构而跳过证据和格局分析。 */
    skipAnalysis?: boolean;
    /** 明确指定运限计算时刻，便于服务端缓存和测试复现。 */
    horoscopeContext?: ZiweiHoroscopeContext;
    /** 未指定 horoscopeContext 时使用的当前时间。 */
    now?: Date;
}
/** 将一个星盘和运限对象转换为指定范围的结构化资料。 */
export declare function buildZiweiPayloadByScope(params: {
    astrolabe: IztroAstrolabe;
    horoscope: IztroHoroscope;
    scopes?: ScopeType[];
    calculationConfig: AnalysisPayloadV1['calculation_config'];
    skipAnalysis?: boolean;
}): Record<ScopeType, AnalysisPayloadV1>;
/**
 * 生成紫微完整运行结果。
 *
 * 默认使用当前时刻生成运限资料；服务端、缓存和测试建议显式传入
 * `horoscopeContext`，避免同一份出生盘因运行时间不同而产生不同快照。
 */
export declare function calculateZiweiChart(input: ChartInput, options?: ZiweiRuntimeOptions): Promise<ZiweiRuntime>;
/** 兼容应用层已有的“完整盘”命名。 */
export declare function calculateFullZiweiChart(input: ChartInput, skipAnalysis?: boolean): Promise<ZiweiRuntime>;
/** 兼容应用层已有的范围计算入口。 */
export declare function calculateZiweiChartForScopes(input: ChartInput, scopes?: ScopeType[], skipAnalysis?: boolean): Promise<ZiweiRuntime>;
/** 面向较小接口响应的范围入口，始终保留本命资料。 */
export declare function calculatePublicZiweiChartForScopes(input: ChartInput, scopes?: ScopeType[]): Promise<ZiweiRuntime>;
/** 只返回各范围结构化资料，不额外暴露完整运行时给调用方。 */
export declare function calculateZiweiPayloadByScope(input: ChartInput, options?: Omit<ZiweiRuntimeOptions, 'scopes'> & {
    scopes?: ScopeType[];
}): Promise<Record<ScopeType, AnalysisPayloadV1>>;
/** 按指定日期和时辰生成单个紫微范围资料。 */
export declare function calculateZiweiDisplayPayload(params: {
    input: ChartInput;
    dateStr: string;
    hourIndex: number;
    scope: ScopeType;
}): Promise<AnalysisPayloadV1>;
type ZiweiInputText = string | number;
export interface ZiweiChartInputDraft {
    name: string;
    gender: 'male' | 'female';
    dateType: 'solar' | 'lunar';
    year: ZiweiInputText;
    month: ZiweiInputText;
    day: ZiweiInputText;
    timeIndex: number | '';
    isLeapMonth: boolean;
    useTrueSolarTime?: boolean;
    birthHour?: ZiweiInputText;
    birthMinute?: ZiweiInputText;
    birthLongitude?: ZiweiInputText;
    timezone?: number;
    timeZoneId?: string;
    applyChinaDst?: boolean;
    algorithm?: 'default' | 'zhongzhou';
}
/** 将网页表单或普通 JSON 输入转换为严格的紫微 ChartInput。 */
export declare function buildZiweiChartInput(input: ZiweiChartInputDraft): ChartInput;
export {};
