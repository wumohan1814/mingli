import { MINGYU_SCHEMA_VERSION } from '../shared/version.js';
const AUDIT_FIELDS = new Set([
    'meta',
    'evidence',
    'evidenceAnalysis',
    'focusEvidence',
    'calculation',
    'calculationSteps',
    'classicalRules',
    'traditionalFacts',
    'sources',
    'source',
    'limitations',
    'limitation',
    'ruleBasis',
    'rule',
    'rules',
    'basis',
    'methodology',
    'prompt',
    'promptText',
    'formattedResult',
    'serializedResult',
]);
function partitionValue(value, path, evidence) {
    if (Array.isArray(value)) {
        return value.map((item, index) => partitionValue(item, `${path}[${index}]`, evidence));
    }
    if (!value || typeof value !== 'object' || value instanceof Date)
        return value;
    const chart = {};
    for (const [field, item] of Object.entries(value)) {
        const itemPath = path ? `${path}.${field}` : field;
        if (AUDIT_FIELDS.has(field)) {
            if (item !== undefined && item !== null)
                evidence.push({ path: itemPath, field, value: item });
            continue;
        }
        chart[field] = partitionValue(item, itemPath, evidence);
    }
    return chart;
}
/**
 * 按结构化字段拆开盘面资料与审计资料，不经过长文本生成或正则清洗。
 */
export function partitionResultForConsumption(raw) {
    const auditEvidence = [];
    const chart = partitionValue(raw, '', auditEvidence);
    return { chart, auditEvidence };
}
export function createUnifiedResultView(options) {
    return {
        kind: options.kind,
        schemaVersion: MINGYU_SCHEMA_VERSION,
        input: options.input,
        calendar: options.calendar ?? null,
        chart: options.chart,
        timing: options.timing ?? null,
        summary: options.summary,
        evidence: options.evidence,
        warnings: [...(options.warnings ?? [])],
        raw: options.raw,
    };
}
export function createConsumptionView(options) {
    const partitioned = partitionResultForConsumption(options.raw);
    const rawRecord = options.raw && typeof options.raw === 'object'
        ? options.raw
        : undefined;
    const inferredWarnings = Array.isArray(rawRecord?.warnings)
        ? rawRecord.warnings.filter((item) => typeof item === 'string')
        : [];
    return createUnifiedResultView({
        kind: options.kind,
        input: options.input,
        calendar: options.calendar ?? rawRecord?.calendar ?? null,
        chart: partitioned.chart,
        timing: options.timing ?? rawRecord?.timing ?? null,
        summary: options.summary ?? rawRecord?.summary ?? null,
        evidence: partitioned.auditEvidence,
        warnings: options.warnings ?? inferredWarnings,
        raw: options.raw,
    });
}
