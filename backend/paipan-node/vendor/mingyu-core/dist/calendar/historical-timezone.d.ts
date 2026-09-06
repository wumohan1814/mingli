/**
 * @file IANA 历史时区解析
 * @description 通过运行环境 Intl/IANA 数据库解析当地钟表时刻的历史 UTC 偏移，并识别 DST 歧义与缺失时刻。
 */
export interface HistoricalTimezoneInput {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    timeZoneId: string;
    fixedOffsetHours?: number;
}
export interface HistoricalTimezoneCalculationStep {
    key: string;
    stage: '时区规则加载' | '候选偏移采样' | '当地时刻匹配' | '偏移核验';
    status: '已解析' | '已匹配' | '存在歧义' | '已核验' | '未核验' | '存在冲突';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    promptText: string;
    sources: string[];
    limitation: '历史时区步骤只证明指定 IANA 时区规则下当地钟表时间如何映射为 UTC，并记录回拨歧义与固定偏移冲突；不得把数据库解析结果解释为出生记录本身已经无误';
}
export interface HistoricalTimezoneDiagnosticFact {
    key: string;
    type: '当地时刻映射' | '固定偏移核验';
    status: '唯一映射' | '存在回拨歧义' | '无冲突' | '存在冲突' | '未核验';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '诊断事实只记录 IANA 历史规则下的映射数量与偏移一致性；歧义或冲突需要结合原始时间记录复核，不得自动改写出生时间';
}
export interface HistoricalTimezoneDiagnosticSummaryFact {
    key: 'historical-timezone:diagnostic-summary';
    status: '唯一且无冲突' | '唯一但偏移冲突' | '唯一映射且未核验固定偏移' | '存在回拨歧义' | '回拨歧义且偏移冲突' | '存在回拨歧义且未核验固定偏移';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '诊断汇总只整合当地时刻映射与固定偏移核验，不证明原始钟表记录、地点或时区标注必然正确';
}
export interface HistoricalTimezoneSummaryFact {
    key: 'historical-timezone:evidence-summary';
    status: HistoricalTimezoneDiagnosticSummaryFact['status'];
    factKeys: string[];
    calculationStepCount: number;
    diagnosticFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '历史时区证据汇总只统计 IANA 规则加载、候选偏移、当地时刻映射、固定偏移核验、诊断与限制覆盖；不得按映射状态生成可信度百分比，也不证明原始钟表记录、出生地或时区标注必然正确';
}
export interface HistoricalTimezoneLimitationFact {
    key: string;
    type: '数据库版本边界' | '回拨选择边界' | '固定偏移边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束历史时区换算可支持的结论范围，不得被反向当作出生记录真实性、事件结果或观测精度证据';
}
export interface HistoricalTimezoneEvidence {
    key: string;
    timeZoneId: string;
    database: string;
    status: 'unique' | 'ambiguous';
    selectedUtcTimestamp: number;
    selectedUtcDateTime: string;
    resolvedOffsetHours: number;
    possibleUtcDateTimes: string[];
    possibleOffsetsHours: number[];
    fixedOffsetHours?: number;
    /** 重复当地时刻是否已由匹配的固定偏移明确消歧。 */
    ambiguityResolvedByFixedOffset: boolean;
    offsetConflict: boolean;
    diagnostics: string[];
    calculationSteps: HistoricalTimezoneCalculationStep[];
    calculationChain: string[];
    diagnosticFacts: HistoricalTimezoneDiagnosticFact[];
    diagnosticSummaryFact: HistoricalTimezoneDiagnosticSummaryFact;
    summaryFact: HistoricalTimezoneSummaryFact;
    limitations: string[];
    limitationFacts: HistoricalTimezoneLimitationFact[];
    source: string;
    promptText: string;
}
export declare function resolveHistoricalTimezone(input: HistoricalTimezoneInput): HistoricalTimezoneEvidence;
