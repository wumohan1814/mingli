import type { MeihuaData, MeihuaDivinationMethod } from '../types/divination';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { type RandomTraceFact } from '../shared/random';
export type MeihuaEvidenceStageKey = 'origin' | 'process' | 'result';
export interface MeihuaStageEvidence {
    key: string;
    status: '已计算' | '卦象资料缺失';
    stage: MeihuaEvidenceStageKey;
    label: string;
    hexagram: string;
    hexagramFactKey: string | null;
    ti: {
        name: string;
        element: string;
        seasonState: string;
    };
    yong: {
        name: string;
        element: string;
        seasonState: string;
    };
    relation: string;
    support: string[];
    constraints: string[];
    basis: string;
    promptText: string;
    sources: string[];
    limitation: '阶段体用事实只描述主卦、互卦或变卦中的体用五行关系与月令旺衰；阶段标签、支持或限制不得直接解释为现实起因、过程、结果、吉凶或成功率';
}
export interface MeihuaHexagramFact {
    key: string;
    status: '已记录';
    stage: MeihuaEvidenceStageKey;
    label: '主卦' | '互卦' | '变卦';
    hexagram: string;
    symbol: string;
    upperTrigram: string;
    lowerTrigram: string;
    promptText: string;
    sources: string[];
    limitation: '主互变卦象事实只记录当前上下经卦、卦名与卦符；不得由卦名或阶段位置直接推断现实事件、人物、吉凶、成败或应期';
}
export interface MeihuaYaoFact {
    key: string;
    status: '已计算';
    position: number;
    yaoType: string;
    tiYong: '体' | '用';
    isChanging: boolean;
    promptText: string;
    sources: string[];
    limitation: '逐爻事实只记录主卦自下而上的阴阳、体用归属与动爻位置；不得按爻位、阴阳数量或体用数量换算吉凶、概率、人物身份或固定日期';
}
export interface MeihuaYaoCoverageFact {
    key: 'meihua:yao-coverage';
    status: '完整' | '缺少爻位' | '爻位异常' | '动爻异常';
    expectedPositions: number[];
    actualPositions: number[];
    missingPositions: number[];
    duplicatePositions: number[];
    invalidPositions: number[];
    changingPositions: number[];
    yaoFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '六爻覆盖状态只说明当前主卦是否完整保存初爻至上爻且仅有一个动爻；缺少、重复、越界或动爻异常时不得补造阴阳、体用归属、互卦或变卦';
}
export interface MeihuaStageCoverageFact {
    key: 'meihua:stage-coverage';
    status: '完整' | '阶段缺失' | '阶段资料不完整';
    expectedStages: MeihuaEvidenceStageKey[];
    actualStages: MeihuaEvidenceStageKey[];
    missingStages: MeihuaEvidenceStageKey[];
    incompleteStages: MeihuaEvidenceStageKey[];
    stageFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '阶段覆盖状态只说明主卦、互卦、变卦体用事实是否齐全；阶段缺失或卦象资料不完整时不得反推互卦过程、变卦结果、卦名或上下经卦';
}
export interface MeihuaTransitionFact {
    key: string;
    status: '连续' | '跨阶段缺口';
    fromStageKey: string;
    toStageKey: string;
    fromStage: MeihuaEvidenceStageKey;
    toStage: MeihuaEvidenceStageKey;
    fromRelation: string;
    toRelation: string;
    promptText: string;
    sources: string[];
    limitation: '阶段推进事实只比较相邻已记录阶段的体用关系变化；不得把卦内先后直接写成现实事件必然按同样顺序发生，跨阶段缺口时更不得补造中间过程';
}
export interface MeihuaCounterEvidenceFact {
    key: string;
    ownerStageKey: string;
    stage: MeihuaEvidenceStageKey;
    type: '体用关系限制' | '体卦月令限制' | '用卦月令限制' | '现实复核限制';
    status: '已触发';
    detail: string;
    promptText: string;
    sources: string[];
    limitation: '反证事实只表示某一阶段存在泄耗、受克、休囚死或待现实复核等限制；不得把单项反证直接写成现实失败、灾祸、伤病、损失或必然结果';
}
export interface MeihuaCounterSummaryFact {
    key: 'meihua:counter-summary';
    status: '有明确反证' | '未见明确反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明当前阶段核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率';
}
export interface MeihuaTimingFact {
    key: string;
    order: number;
    type: '动爻层位' | '月建旺衰' | '体卦状态' | '原应期条件' | '期限边界';
    sourceStatus: '原结果提供' | '由盘面补齐' | '统一边界';
    ownerFactKeys: string[];
    rawText?: string;
    promptText: string;
    sources: string[];
    limitation: '应期事实只提供动爻层位、体用生克、月令旺衰与现实条件的相对触发；不得把爻位、卦数、阶段数量或旺衰换算唯一日期，也不证明事件必然发生';
}
export interface MeihuaTimingSummaryFact {
    key: 'meihua:timing-summary';
    status: '已提供触发条件' | '仅有期限边界';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '应期汇总只说明当前保存了哪些相对触发与期限边界；不得按条件数量、动爻、卦数或旺衰生成固定天数、绝对日期或事件概率';
}
export interface MeihuaTraditionalFact {
    key: string;
    status: '已映射';
    stage: '主卦' | '互卦' | '变卦';
    hexagram: string;
    kind: '卦辞' | '爻辞' | '用辞';
    yaoPosition?: number;
    applicability: '当前卦辞辅助' | '当前动爻辅助' | '未发动背景' | '特殊用辞背景';
    originalText: string;
    promptText: string;
    traditionalSignals: string[];
    topicTags: string[];
    sources: string[];
    limitation: '卦辞与爻辞是《周易》传统取象原文，只用于当前主互变结构和动爻层位的辅助解释，不证明现实吉凶、婚育、疾病、伤亡、诉讼、财物得失、人物意图或固定时间结果';
}
export interface MeihuaCalculationStep {
    key: string;
    target: '上卦' | '下卦' | '动爻';
    expression: string;
    modulus?: 6 | 8;
    result?: number;
    promptText: string;
}
export interface MeihuaCalculationFact {
    key: string;
    status: '完整' | '缺少中间参数';
    methodKey: MeihuaDivinationMethod | '未记录';
    methodLabel: string;
    inputs: Record<string, string | number>;
    steps: MeihuaCalculationStep[];
    resolvedResult: {
        upperTrigram: string;
        lowerTrigram: string;
        movingYao: number;
    };
    compatibilityNote?: string;
    promptText: string;
    sources: string[];
    limitation: '取数算式只证明当前上下卦与动爻索引如何由输入或随机取数得到，不证明卦象预测有效性、现实吉凶或固定应期';
}
export interface MeihuaEvidenceCalculationStep {
    key: string;
    stage: '起卦取数核验' | '主互变卦象构造' | '六爻与动爻核验' | '阶段体用计算' | '阶段推进核验' | '反证与应期核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明起卦取数、主互变卦象、六爻动爻、阶段体用、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}
export interface MeihuaSummaryFact {
    key: 'meihua:evidence-summary';
    status: '证据链完整' | '部分资料缺失' | '阶段链不完整';
    factKeys: string[];
    hexagramFactCount: number;
    yaoFactCount: number;
    stageFactCount: number;
    transitionFactCount: number;
    traditionalFactCount: number;
    counterEvidenceCount: number;
    timingFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、阶段体用、推进、传统文本、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图或唯一日期';
}
export interface MeihuaLimitationFact {
    key: string;
    type: '起卦与随机来源边界' | '卦象与逐爻资料边界' | '阶段体用边界' | '阶段推进与反证边界' | '应期边界' | '传统文本与高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据';
}
export interface MeihuaEvidenceAnalysis {
    key: 'meihua:evidence';
    status: '已计算';
    calculationFact: MeihuaCalculationFact;
    calculationFacts: string[];
    calculationSteps: MeihuaEvidenceCalculationStep[];
    calculationChain: string[];
    hexagramStructureFacts: MeihuaHexagramFact[];
    hexagramFacts: string[];
    yaoCoverageFact: MeihuaYaoCoverageFact;
    yaoStructureFacts: MeihuaYaoFact[];
    yaoFacts: string[];
    monthBranch: string;
    movingYao: number;
    stageCoverageFact: MeihuaStageCoverageFact;
    stages: MeihuaStageEvidence[];
    transitionFacts: MeihuaTransitionFact[];
    transitions: string[];
    timingFacts: MeihuaTimingFact[];
    timingSummaryFact: MeihuaTimingSummaryFact;
    timingConditions: string[];
    randomFact: RandomTraceFact;
    randomFacts: string[];
    counterEvidenceFacts: MeihuaCounterEvidenceFact[];
    counterSummaryFact: MeihuaCounterSummaryFact;
    counterEvidence: string[];
    traditionalFacts: MeihuaTraditionalFact[];
    summaryFact: MeihuaSummaryFact;
    limitations: string[];
    limitationFacts: MeihuaLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function conditionMeihuaTraditionalText(text: string, context: {
    stage: MeihuaTraditionalFact['stage'];
    hexagram: string;
    kind: MeihuaTraditionalFact['kind'];
    yaoPosition?: number;
    isMoving?: boolean;
}): Pick<MeihuaTraditionalFact, 'promptText' | 'traditionalSignals' | 'topicTags'>;
export declare function analyzeMeihuaEvidence(data: MeihuaData): MeihuaEvidenceAnalysis;
