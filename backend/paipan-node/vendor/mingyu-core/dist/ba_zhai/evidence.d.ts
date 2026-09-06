import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { BaZhaiDoorMeasurement, BaZhaiMeasurementStability, BaZhaiResult } from './index';
export interface BaZhaiDirectionComparison {
    direction: string;
    degree: number;
    mingLabel: string;
    mingLuck: '吉' | '凶';
    houseLabel: string | null;
    houseLuck: '吉' | '凶' | null;
    relation: '同为吉方' | '同为凶方' | '命宅异判' | '仅命卦资料';
}
export interface BaZhaiDirectionFact extends BaZhaiDirectionComparison {
    key: string;
    status: '已计算';
    gua: string;
    mingGua: string;
    houseGua: string | null;
    calculationStepKeys: string[];
    sources: string[];
    calculation: string;
    promptText: string;
    limitation: '大游年吉凶只表示命卦或宅卦在目标宫位的传统空间分类；单一方位标签或命宅重合不证明房间适用性、健康效果、财富变化、事件结果或调整方案有效';
}
export interface BaZhaiCalculationStep {
    key: string;
    stage: '命卦年界' | '命卦计算' | '宅卦计算' | '八宫排布' | '逐方比较';
    status: '完整' | '待复核' | '未提供';
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只记录出生年界、命卦、宅卦、八宫排布与逐方比较的形成过程；不得把步骤完整度解释为住宅适用度、现实效果或结论可信度';
}
export interface BaZhaiCalculationFact {
    key: 'calculation:bazhai:ming-house';
    status: '命卦完整' | '命宅完整';
    yearBoundaryStatus: '已核定' | '待复核' | '直接命卦';
    steps: BaZhaiCalculationStep[];
    promptText: string;
    sources: string[];
    limitation: '计算链只证明出生年界、命卦、宅卦和大游年八宫如何形成当前方位资料，不证明住宅适用性、健康效果、财富变化、事件结果或调整方案有效';
}
export interface BaZhaiMeasurementCandidateFact {
    key: string;
    status: '候选';
    index: number;
    label: string;
    sitMountain: string;
    facingMountain: string;
    houseGua: string;
    houseGroup: '东四命' | '西四命';
    match: '相合' | '相冲';
    measurementFactKey: 'measurement:bazhai:door';
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '候选坐向只表示测量误差范围内可能落入的二十四山与宅卦，不代表现场真实坐向已经确定，也不得据候选数量生成可信度、吉凶分或调整结论';
}
export interface BaZhaiMeasurementFact {
    key: 'measurement:bazhai:door';
    status: '未提供' | BaZhaiMeasurementStability;
    referenceStatus: '未提供' | '已声明' | '未声明';
    method?: '站在大门处面向屋内测量';
    input?: {
        measuredDegree: number;
        northReference: 'unspecified' | 'magnetic' | 'true';
        magneticDeclinationDegrees: number | null;
        measurementUncertaintyDegrees: number;
    };
    result?: {
        trueNorthDegree: number;
        nearestBoundaryDistanceDegrees: number;
        sitDegree: number;
        sitMountain: string;
        facingDegree: number;
        facingMountain: string;
        label: string;
    };
    candidates: BaZhaiMeasurementCandidateFact[];
    candidateFactKeys: string[];
    calculationStepKeys: string[];
    warnings: string[];
    promptText: string;
    sources: string[];
    limitation: '入户测量只证明指定站位、北向基准、磁偏角和误差范围如何换算当前坐山朝向候选；未声明北向、受环境干扰或跨边界时不得把中心读数当作唯一真实坐向';
}
export interface BaZhaiCounterEvidenceFact {
    key: string;
    type: '命卦年界' | '宅卦资料覆盖' | '命宅逐方一致性' | '山向边界稳定性' | '宅卦边界稳定性' | '北向基准';
    status: '已覆盖' | '未提供' | '存在异判' | '边界敏感' | '不稳定' | '未声明' | '不适用' | '已核定' | '待复核' | '直接给定';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录命卦年界、宅卦资料、逐方异判、测量边界和北向基准是否存在缺口；缺口不等于住宅必然不利，资料完整也不证明现实效果';
}
export interface BaZhaiCounterSummaryFact {
    key: 'bazhai:counter-summary';
    status: '存在需保留反证' | '未见额外反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只用于防止把缺失资料、异判或边界敏感静默忽略；不得据反证数量生成吉凶分、可信度或调整结论';
}
export interface BaZhaiLimitationFact {
    key: string;
    type: '传统模型边界' | '测量方法边界' | '北向基准边界' | '建筑现实边界' | '命宅分层边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束八宅传统分类与现场测量可支持的解释范围，不得被反向当作住宅效果、健康变化、财富结果或调整有效性的证据';
}
export interface BaZhaiSummaryFact {
    key: 'bazhai:evidence-summary';
    status: '命卦链完整' | '命宅链完整' | '证据链有缺口';
    factKeys: string[];
    directionFactCount: number;
    alignedDirectionCount: number;
    conflictingDirectionCount: number;
    measurementCandidateCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '八宅证据汇总只统计命卦年界、命卦宅卦、八宫逐方、测量候选、反证与限制覆盖；不得按数量生成住宅吉凶总分、可信度、健康概率、财富增幅或调整效果保证';
}
export interface BaZhaiEvidenceAnalysis {
    key: 'bazhai:evidence';
    status: '已计算';
    calculationFact: BaZhaiCalculationFact;
    calculationSteps: BaZhaiCalculationStep[];
    calculationChain: string[];
    directionFacts: BaZhaiDirectionFact[];
    directionComparisons: BaZhaiDirectionComparison[];
    alignedDirections: BaZhaiDirectionComparison[];
    conflictingDirections: BaZhaiDirectionComparison[];
    measurementFact: BaZhaiMeasurementFact;
    measurementFacts: string[];
    measurementCandidateFacts: BaZhaiMeasurementCandidateFact[];
    measurementCandidates: Array<{
        label: string;
        sitMountain: string;
        facingMountain: string;
        houseGua: string;
        houseGroup: '东四命' | '西四命';
        match: '相合' | '相冲';
    }>;
    counterEvidence: string[];
    counterEvidenceFacts: BaZhaiCounterEvidenceFact[];
    counterSummaryFact: BaZhaiCounterSummaryFact;
    limitations: string[];
    limitationFacts: BaZhaiLimitationFact[];
    summaryFact: BaZhaiSummaryFact;
    sources: Array<{
        title: string;
        evidence: string;
        role: '传统规则来源' | '公共算法来源';
    }>;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeBaZhaiEvidence(data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>, measurement?: BaZhaiDoorMeasurement): BaZhaiEvidenceAnalysis;
