export interface AuditEvidenceEntry {
    path: string;
    field: string;
    value: unknown;
}
export interface PartitionedConsumptionData<TChart = unknown> {
    chart: TChart;
    auditEvidence: AuditEvidenceEntry[];
}
export interface UnifiedResultView<TInput = unknown, TCalendar = unknown, TChart = unknown, TTiming = unknown, TSummary = unknown, TEvidence = AuditEvidenceEntry[], TRaw = unknown> {
    kind: string;
    schemaVersion: string;
    input: TInput;
    calendar: TCalendar | null;
    chart: TChart;
    timing: TTiming | null;
    summary: TSummary;
    evidence: TEvidence;
    warnings: string[];
    raw: TRaw;
}
/**
 * 按结构化字段拆开盘面资料与审计资料，不经过长文本生成或正则清洗。
 */
export declare function partitionResultForConsumption<TChart = unknown>(raw: unknown): PartitionedConsumptionData<TChart>;
export declare function createUnifiedResultView<TInput, TCalendar, TChart, TTiming, TSummary, TEvidence, TRaw>(options: {
    kind: string;
    input: TInput;
    calendar?: TCalendar | null;
    chart: TChart;
    timing?: TTiming | null;
    summary: TSummary;
    evidence: TEvidence;
    warnings?: readonly string[];
    raw: TRaw;
}): UnifiedResultView<TInput, TCalendar, TChart, TTiming, TSummary, TEvidence, TRaw>;
export declare function createConsumptionView<TInput, TRaw>(options: {
    kind: string;
    input: TInput;
    raw: TRaw;
    calendar?: unknown;
    timing?: unknown;
    summary?: unknown;
    warnings?: readonly string[];
}): UnifiedResultView<TInput, unknown, unknown, unknown, unknown, AuditEvidenceEntry[], TRaw>;
