import type { LiurenData, LiurenLesson, LiurenTransmission } from '../types/divination';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
export interface LiurenRelationEvidenceFact {
    key: string;
    scope: '四课' | '三传';
    ownerKey: string;
    basis: '上下神关系' | '旬空' | '月令旺衰' | '日支关系' | '相邻传关系';
    status: '支持' | '限制' | '中性';
    value: string;
    promptText: string;
    sources: string[];
    limitation: '课传关系事实只说明上下神、月令、旬空、日支或相邻传之间的盘内关系；支持或限制不得直接解释为现实吉凶、成功率或必然结果';
}
export interface LiurenLessonEvidence extends LiurenLesson {
    key: string;
    index: number;
    isInitialSource: boolean;
    constraints: string[];
    relationFacts: LiurenRelationEvidenceFact[];
    promptText: string;
    sources: string[];
    limitation: '四课事实只记录上下神、乘将、关系、课注及其是否参与初传来源；不单独证明现实事件、人物、吉凶或结果';
}
export interface LiurenTransmissionEvidence extends LiurenTransmission {
    key: string;
    index: number;
    label: '起点' | '过程' | '落点';
    support: string[];
    constraints: string[];
    relationFacts: LiurenRelationEvidenceFact[];
    promptText: string;
    sources: string[];
    limitation: '三传事实只记录初中末传的地支、天将、月令、旬空、日支关系与相邻推进；阶段顺序不证明现实事件必然按同样方式发生';
}
export interface LiurenTransitionFact {
    key: string;
    fromTransmissionKey: string;
    toTransmissionKey: string;
    fromStage: LiurenTransmission['stage'];
    toStage: LiurenTransmission['stage'];
    fromBranch: string;
    toBranch: string;
    relation: string;
    status: '支持' | '限制' | '中性';
    promptText: string;
    sources: string[];
    limitation: '相邻传推进事实只描述三传先后与地支关系，不证明现实事件必然推进、停滞、成功或失败';
}
export interface LiurenTransmissionRuleFact {
    key: 'liuren:transmission-rule';
    status: '已确定' | '缺少规则名';
    rule: string | null;
    pattern: LiurenData['transmissionPattern'] | null;
    initialBranch: string;
    initialGod: string;
    initialSourceLessonKeys: string[];
    detail: string | null;
    classicalRuleKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '取传规则事实只说明当前四课如何形成初传及三传模式；缺少规则名时不得按结果反推九宗门名称，也不单独证明现实吉凶或应期';
}
export interface LiurenCounterEvidenceFact {
    key: string;
    ownerKey: string;
    scope: '四课' | '三传';
    basis: LiurenRelationEvidenceFact['basis'];
    detail: string;
    status: '已触发';
    promptText: string;
    sources: string[];
    limitation: '反证事实只表示盘内存在空亡、休囚、冲克或其他限制条件；不得把单项反证直接写成现实失败、灾祸或必然结果';
}
export interface LiurenCounterSummaryFact {
    key: 'liuren:counter-summary';
    status: '有明确反证' | '未见明确反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明当前结构化核验是否发现盘内限制，不代表现实风险为零，也不表示证据数量可换算为吉凶总分';
}
export interface LiurenTimingFact {
    key: string;
    order: number;
    type: '初传状态' | '三传顺序' | '月日触发' | '期限边界' | '补充条件';
    sourceStatus: '原结果提供' | '由盘面补齐';
    rawText?: string;
    promptText: string;
    sources: string[];
    limitation: '应期事实只提供先后、快慢、空亡填实、冲合与旺衰等触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生';
}
export interface LiurenFocusFact {
    key: string;
    target: string;
    role: string;
    level: '主证' | '辅证';
    evidence: string[];
    limitations: string[];
    sourceStatus: '原结果提供';
    promptText: string;
    sources: string[];
    limitation: '类神焦点事实只记录当前结果已选出的关注对象、角色、依据与限制；未选定具体问题类神时不得把日支、天将或神煞固定当作用神';
}
export interface LiurenFocusSummaryFact {
    key: 'liuren:focus-summary';
    status: '已提供焦点' | '缺少焦点';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '焦点覆盖状态只说明当前结果是否保存关注对象；缺少焦点时不得自行把日支、天将或神煞固定当作用神，仍须按具体问题选择类神';
}
export interface LiurenTraditionalFact {
    key: string;
    kind: '经典取传规则' | '课体' | '天将属性' | '神煞';
    name: string;
    originalText: string;
    promptText: string;
    sources: string[];
    stages?: string[];
    branches?: string[];
    limitation: '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果';
}
export interface LiurenCalculationFact {
    key: string;
    ganzhi: LiurenData['ganzhi'];
    monthLeader: string;
    divinationBranch: string;
    dayNight: LiurenData['dayNight'] | '未列';
    noblemanBranch?: string;
    noblemanGroundBranch?: string;
    dayStem: string;
    dayStemResidence?: string;
    xunKong: string[];
    promptText: string;
    sources: string[];
    limitation: '起盘参数只记录占时四柱、月将加时、昼夜贵人、日干寄宫与旬空的计算输入和结果，不单独证明现实事件、吉凶或应期';
}
export interface LiurenPlateFact {
    key: string;
    index: number;
    earthBranch: string;
    heavenBranch: string;
    god: string;
    isNobleman: boolean;
    isNoblemanGround: boolean;
    promptText: string;
    sources: string[];
    limitation: '天地盘逐位字段只证明月将加时与十二天将排布后的对应关系，不单独证明现实吉凶、人物身份、事件或方位结果';
}
export interface LiurenPlateCoverageFact {
    key: string;
    status: '完整' | '缺少';
    expectedCount: 12;
    actualCount: number;
    positionKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '天地盘覆盖状态只说明当前结果能否完整核验十二位对应；缺少逐位资料时不得反推或补造天盘支、地盘支与天将';
}
export interface LiurenEvidenceCalculationStep {
    key: string;
    stage: '起盘参数核验' | '天地盘覆盖核验' | '四课结构核验' | '取传规则核验' | '三传推进核验' | '反证类神应期核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明占时参数、天地盘、四课、取传、三传、反证、类神与应期条件如何形成当前证据；不证明现实吉凶、事件概率、人物身份或固定应期';
}
export interface LiurenSummaryFact {
    key: 'liuren:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    platePositionFactCount: number;
    lessonFactCount: number;
    transmissionFactCount: number;
    transitionFactCount: number;
    counterEvidenceCount: number;
    timingFactCount: number;
    focusFactCount: number;
    traditionalFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '大六壬证据汇总只统计起盘、天地盘、四课取传、三传推进、反证、类神、应期与传统资料的覆盖情况；不得按数量生成吉凶总分、成功率、人物身份、事件保证或唯一日期';
}
export interface LiurenLimitationFact {
    key: string;
    type: '起盘天地盘边界' | '四课取传边界' | '三传推进边界' | '反证类神应期边界' | '传统规则类象边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束大六壬占时、天地盘、四课取传、三传、类神、课体、天将、神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、人物身份、疾病灾祸、事件概率或固定应期的证据';
}
export interface LiurenEvidenceAnalysis {
    key: 'liuren:evidence';
    status: '已计算';
    calculationFact: LiurenCalculationFact;
    calculationFacts: string[];
    calculationSteps: LiurenEvidenceCalculationStep[];
    calculationChain: string[];
    plateFact: LiurenPlateCoverageFact;
    platePositionFacts: LiurenPlateFact[];
    plateFacts: string[];
    patternEvidence: string[];
    shenShaEvidence: string[];
    rule: string;
    initialBranch: string;
    initialSourceLessons: string[];
    transmissionRuleFact: LiurenTransmissionRuleFact;
    lessons: LiurenLessonEvidence[];
    transmissions: LiurenTransmissionEvidence[];
    transitionFacts: LiurenTransitionFact[];
    transitions: string[];
    counterEvidenceFacts: LiurenCounterEvidenceFact[];
    counterSummaryFact: LiurenCounterSummaryFact;
    counterEvidence: string[];
    timingFacts: LiurenTimingFact[];
    timingConditions: string[];
    focusFacts: LiurenFocusFact[];
    focusSummaryFact: LiurenFocusSummaryFact;
    focusEvidence: NonNullable<LiurenData['focusEvidence']>;
    timingEvidence: string[];
    traditionalFacts: LiurenTraditionalFact[];
    limitations: string[];
    limitationFacts: LiurenLimitationFact[];
    summaryFact: LiurenSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeLiurenEvidence(data: LiurenData): LiurenEvidenceAnalysis;
