import type { BaziChartResult } from './baziTypes';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
export type FortuneLayerType = 'natal' | 'dayun' | 'year' | 'month' | 'day' | 'hour';
export type FortuneTriggerRelationType = 'stem-same' | 'stem-combine' | 'stem-clash' | 'branch-same' | 'branch-combine' | 'branch-clash' | 'branch-punishment' | 'branch-harm' | 'branch-break' | 'pillar-fuyin' | 'tianke-dichong' | 'suiyun-binglin';
export interface FortuneTriggerLayer {
    /** 兼容旧调用的层级标识；输出时同时提供稳定 key。 */
    id: string;
    key?: string;
    status?: '已计算';
    type: FortuneLayerType;
    label: string;
    ganZhi: string;
    pillar?: 'year' | 'month' | 'day' | 'hour';
    timeRange?: string;
}
export interface FortuneTriggerResolvedLayer extends FortuneTriggerLayer {
    key: string;
    status: '已计算';
}
export interface FortuneTriggerCalculationStep {
    key: string;
    stage: '层级干支校验' | '层级关系比对' | '三支成局核验' | '关系汇总';
    status: '已计算';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明所列干支经过固定关系表逐项比对并形成关系事实，不证明关系对应现实事件、吉凶方向、发生概率或固定应期';
}
export interface FortuneTriggerFormationFact {
    key: string;
    status: '已命中';
    type: 'branch-sanhe' | 'branch-sanhui';
    label: string;
    group: string;
    branches: string[];
    participantLayerKeys: string[];
    natalLayerKeys: string[];
    activeLayerKeys: string[];
    triggerLayerKeys: string[];
    calculationStepKey: string;
    sources: string[];
    interpretationLimit: string;
}
export interface FortuneTriggerRelation {
    key: string;
    status: '已命中';
    type: FortuneTriggerRelationType;
    label: string;
    source: FortuneTriggerResolvedLayer;
    target: FortuneTriggerResolvedLayer;
    sourceLayerKey: string;
    targetLayerKey: string;
    calculationStepKey: string;
    dependsOnStepKeys: string[];
    stemRelation?: 'same' | 'combine' | 'clash';
    branchRelation?: 'same' | 'combine' | 'clash' | 'punishment' | 'harm' | 'break';
    rule: string;
    sources: string[];
    interpretationLimit: string;
}
export interface FortuneTriggerCounterEvidenceFact {
    key: string;
    type: '主要关系覆盖';
    status: '已命中主要关系' | '未见主要关系';
    ownerFactKeys: string[];
    sourceLayerKey: string;
    targetLayerKey: string;
    sourceLabel: string;
    targetLabel: string;
    relationKeys: string[];
    majorRelationKeys: string[];
    supportingRelationKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只说明当前层级对是否命中岁运并临、天克地冲或同柱伏吟；未见主要关系不等于没有较弱关系、没有现实触发或必然平稳';
}
export interface FortuneTriggerRelationSummaryFact {
    key: 'bazi:fortune-trigger:relation-summary';
    status: '有关系事实' | '未见列入关系' | '无可比较层级';
    factKeys: string[];
    calculationStepKeys: string[];
    relationKeys: string[];
    formationKeys: string[];
    comparisonStepKeys: string[];
    relationCount: number;
    formationCount: number;
    majorRelationCount: number;
    supportingRelationCount: number;
    comparedPairCount: number;
    noMajorRelationPairCount: number;
    relationTypeCounts: Partial<Record<FortuneTriggerRelationType, number>>;
    promptText: string;
    sources: string[];
    limitation: '关系汇总只统计固定干支关系的命中与层级覆盖，不得按关系数量生成命运总分、吉凶概率、事件概率或唯一应期';
}
export interface FortuneTriggerLimitationFact {
    key: string;
    type: '关系解释边界' | '层级应期边界' | '反证边界' | '上下文边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束岁运干支关系能够支持的解释范围，不得被反向当作现实事件、必然吉凶、发生概率或固定应期的证据';
}
export interface FortuneTriggerEvidenceResult {
    key: 'bazi:fortune-trigger:evidence';
    status: '已计算' | '无可比较层级';
    calculationSteps: FortuneTriggerCalculationStep[];
    calculationChain: string[];
    layers: FortuneTriggerResolvedLayer[];
    relations: FortuneTriggerRelation[];
    formations: FortuneTriggerFormationFact[];
    primaryRelations: FortuneTriggerRelation[];
    supportingRelations: FortuneTriggerRelation[];
    counterEvidence: string[];
    counterEvidenceFacts: FortuneTriggerCounterEvidenceFact[];
    relationSummaryFact: FortuneTriggerRelationSummaryFact;
    limitations: string[];
    limitationFacts: FortuneTriggerLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: {
        notes: string[];
    };
}
export declare function analyzeFortuneTriggers(result: BaziChartResult, activeLayers: FortuneTriggerLayer[]): FortuneTriggerEvidenceResult;
