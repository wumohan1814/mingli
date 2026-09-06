import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { BaziChartResult, Wuxing } from './baziTypes';
import { type BaziMarriageDeepEvaluation } from './compatibility-marriage';
declare const PILLAR_KEYS: readonly ["year", "month", "day", "hour"];
type PillarKey = (typeof PILLAR_KEYS)[number];
type ElementRelation = '同类' | '生对方' | '受对方生' | '克对方' | '受对方克';
type StemRelationType = '五合候选' | '天干冲';
type BranchRelationType = '同支' | '六合' | '六冲' | '三刑' | '六害' | '六破';
export interface BaziCompatibilityOptions {
    person1Name?: string;
    person2Name?: string;
}
export interface BaziDayMasterRelation {
    key: 'bazi:compatibility:day-master-relation';
    status: '已计算';
    calculationStepKey: 'bazi:compatibility:calculation:day-master';
    person1Gan: string;
    person1Wuxing: Wuxing;
    person2Gan: string;
    person2Wuxing: Wuxing;
    person1ToPerson2: ElementRelation;
    person2ToPerson1: ElementRelation;
    person2GanAsPerson1TenGod: string;
    person1GanAsPerson2TenGod: string;
    promptText: string;
    sources: string[];
    limitation: '日主五行生克与双向十神只证明两种日干之间的固定关系，不证明双方现实关系结果、相处质量、婚恋成败或合作收益';
}
export interface BaziCrossPillarRelation {
    key: string;
    status: '已命中';
    layer: '天干' | '地支';
    type: StemRelationType | BranchRelationType;
    person1Pillar: PillarKey;
    person2Pillar: PillarKey;
    person1Value: string;
    person2Value: string;
    transformWuxing?: string;
    note?: string;
    sourceLayerKey: string;
    targetLayerKey: string;
    calculationStepKey: 'bazi:compatibility:calculation:cross-pillars';
    promptText: string;
    sources: string[];
    limitation: '跨盘干支关系只证明固定关系表在指定柱位命中；合不等于合化，冲刑害破不等于现实冲突、伤害、分离或失败';
}
export interface BaziCrossBranchCombination {
    key: string;
    status: '组合齐备';
    type: '三合' | '三会';
    name: string;
    members: Array<{
        branch: string;
        sources: Array<{
            person: 'person1' | 'person2';
            pillar: PillarKey;
        }>;
    }>;
    note: string;
    sourceLayerKeys: string[];
    calculationStepKey: 'bazi:compatibility:calculation:branch-combinations';
    promptText: string;
    sources: string[];
    limitation: '跨盘三合三会只证明三个地支成员齐备且来源跨越双方，不证明成局、成化、关系稳定或现实结果';
}
export interface BaziTenGodMapping {
    key: string;
    status: '已计算';
    observer: 'person1' | 'person2';
    source: 'person1' | 'person2';
    pillar: PillarKey;
    stem: string;
    stemTenGod: string;
    branch: string;
    branchMainQiTenGod: string;
    sourceLayerKey: string;
    calculationStepKey: 'bazi:compatibility:calculation:ten-god-mappings';
    promptText: string;
    sources: string[];
    limitation: '双向十神映射只证明对方干支相对观察方日干的十神分类，不等于角色定性、人格标签、情感结果或行为因果';
}
export interface BaziUsefulGodCoverage {
    key: string;
    status: '已计算' | '资料不足';
    beneficiary: 'person1' | 'person2';
    provider: 'person1' | 'person2';
    favorable: BaziUsefulGodCoverageItem[];
    unfavorable: BaziUsefulGodCoverageItem[];
    unavailableReason?: string;
    calculationStepKey: 'bazi:compatibility:calculation:useful-god-coverage';
    promptText: string;
    sources: string[];
    limitation: '喜忌覆盖只证明提供方盘面是否出现受益方既有喜用或忌神五行，不比较伪精确强度，不证明互补、克制、婚配或合作结果';
}
export interface BaziUsefulGodCoverageItem {
    key: string;
    status: '已命中';
    role: '喜用' | '忌神';
    wuxing: string;
    sources: Array<{
        pillar: PillarKey;
        layer: '天干' | '地支' | '藏干';
        value: string;
    }>;
    sourceLayerKeys: string[];
}
export interface BaziCompatibilityCalculationStep {
    key: string;
    stage: '双盘输入校验' | '日主双向关系' | '四柱交叉比对' | '跨盘组合核验' | '双向十神映射' | '喜忌五行覆盖' | '证据汇总';
    status: '已计算';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明两份命盘经过固定干支、五行、十神与喜忌覆盖规则形成当前事实，不证明现实关系、婚恋成败、合作收益、发生概率或固定应期';
}
export interface BaziCompatibilityCounterEvidenceFact {
    key: string;
    type: '夫妻宫关系覆盖' | '跨盘组合覆盖' | '喜用资料覆盖' | '喜忌并存';
    status: '有可用证据' | '未命中' | '资料不足' | '存在双向条件';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录夫妻宫关系、跨盘组合、喜用资料和喜忌并存的覆盖情况；未命中不等于关系有利或不利，命中也不证明现实结果';
}
export interface BaziCompatibilitySummaryFact {
    key: 'bazi:compatibility:evidence-summary';
    status: '证据完整' | '存在资料缺口';
    factKeys: string[];
    crossPillarRelationCount: number;
    spousePalaceRelationCount: number;
    crossBranchCombinationCount: number;
    tenGodMappingCount: number;
    favorableCoverageCount: number;
    unfavorableCoverageCount: number;
    unavailableCoverageCount: number;
    promptText: string;
    sources: string[];
    limitation: '双盘证据汇总只统计已计算事实与资料缺口，不得按命中数量生成匹配分、成功率、婚恋概率、合作收益或必然结论';
}
export interface BaziCompatibilityLimitationFact {
    key: string;
    type: '关系因果边界' | '合化边界' | '十神边界' | '喜忌覆盖边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束双盘干支、十神和喜忌覆盖能够支持的解释范围，不得被反向当作现实关系结果、吉凶概率或保证有效建议的证据';
}
export interface BaziCompatibilityEvidenceResult {
    key: 'bazi:compatibility:evidence';
    status: '已计算' | '存在资料缺口';
    people: {
        person1: string;
        person2: string;
    };
    calculationSteps: BaziCompatibilityCalculationStep[];
    calculationChain: string[];
    dayMasterRelation: BaziDayMasterRelation;
    spousePalaceRelations: BaziCrossPillarRelation[];
    crossPillarRelations: BaziCrossPillarRelation[];
    crossBranchCombinations: BaziCrossBranchCombination[];
    tenGodMappings: BaziTenGodMapping[];
    usefulGodCoverage: BaziUsefulGodCoverage[];
    marriageDeep?: BaziMarriageDeepEvaluation;
    counterEvidence: string[];
    counterEvidenceFacts: BaziCompatibilityCounterEvidenceFact[];
    summaryFact: BaziCompatibilitySummaryFact;
    limitations: string[];
    limitationFacts: BaziCompatibilityLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: {
        notes: string[];
    };
}
export declare function analyzeBaziCompatibility(chart1: BaziChartResult, chart2: BaziChartResult, options?: BaziCompatibilityOptions): BaziCompatibilityEvidenceResult;
export {};
