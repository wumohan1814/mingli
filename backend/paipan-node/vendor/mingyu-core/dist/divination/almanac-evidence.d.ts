import type { AlmanacData, AlmanacDayCandidate, AlmanacGodFact, AlmanacParticipantRelationFact, AlmanacTopicMatchFact } from '../types/divination';
import { type MoonPhaseEvidence } from '../calendar/moon-phase-evidence';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
export type AlmanacCandidateStatus = '可用候选' | '条件候选' | '慎用候选';
export interface AlmanacRawTabooFact {
    key: string;
    scope: '候选日';
    status: '宜忌均列' | '仅列宜项' | '仅列忌项' | '均未列';
    recommends: string[];
    avoids: string[];
    promptText: string;
    sources: string[];
    limitation: '原始宜忌只保留历书列项及其是否命中当前事项；未列不等于适宜，列出也不等于现实事项必然成功或失败';
}
export interface AlmanacDecisionStep {
    key: string;
    stage: '原始宜忌' | '事项命中' | '值日神煞' | '参与人关系' | '传统限制' | '可用时辰' | '候选分组';
    status: '通过' | '有支持' | '有限制' | '触发慎用' | '未提供';
    factKeys: string[];
    inputs: string[];
    result: string;
    promptText: string;
    sources: string[];
}
export interface AlmanacCandidateDecisionFact {
    key: string;
    date: string;
    status: AlmanacCandidateStatus;
    steps: AlmanacDecisionStep[];
    supportingFactKeys: string[];
    limitingFactKeys: string[];
    strongConstraintTexts: string[];
    promptText: string;
    sources: string[];
    limitation: '候选状态只按明确事项忌项、参与人直接关系和可用时辰分组；算法不设置吉凶总分，不把候选等级解释为成功率或现实吉凶保证';
}
export interface AlmanacTraditionalFact {
    key: string;
    date: string;
    kind: '二十八宿' | '九星' | '全年方位神' | '彭祖百忌';
    name: string;
    originalText: string;
    promptText: string;
    sources: string[];
    fortune?: string;
    branch?: string;
    direction?: string;
    limitation: '传统择日资料只用于当前事项的候选比较，不证明现实中的疾病、死亡、灾祸、官非、财损、婚姻或生育结果';
}
export interface AlmanacHourEvidence {
    key: string;
    name: string;
    range: string;
    ganzhi: string;
    branch: string;
    twelveStar: string;
    status: AlmanacCandidateStatus;
    support: string[];
    constraints: string[];
    participantSupport: string[];
    participantRelationFacts: AlmanacParticipantRelationFact[];
    promptText: string;
    sources: string[];
    limitation: '逐时时课只保留时柱、十二神与参与人刑冲破害，不证明该时辰必然成功、吉利或适合所有人';
}
export interface AlmanacCalendarFact {
    key: string;
    date: string;
    weekday: string;
    lunarDate: string;
    ganzhi: AlmanacDayCandidate['ganzhi'];
    zodiac: string;
    dayOfficer: string;
    twelveStar: string;
    clash: string;
    promptText: string;
    sources: string[];
    limitation: '公历、农历、干支、建除、十二神与冲煞是当前候选日的历法和规则字段，只用于确定比较条件，不单独证明现实吉凶或事项结果';
}
export interface AlmanacCandidateEvidence {
    date: string;
    status: AlmanacCandidateStatus;
    calendarFact: AlmanacCalendarFact;
    rawTabooFact: AlmanacRawTabooFact;
    godFacts: AlmanacGodFact[];
    topicMatchFacts: AlmanacTopicMatchFact[];
    participantRelationFacts: AlmanacParticipantRelationFact[];
    decisionFact: AlmanacCandidateDecisionFact;
    moonPhaseFact: MoonPhaseEvidence;
    astronomicalFacts: string[];
    calendarFacts: string[];
    traditionalRuleFacts: string[];
    directionFacts: string[];
    topicMatches: string[];
    traditionalSupport: string[];
    traditionalConstraints: string[];
    participantSupport: string[];
    participantConflicts: string[];
    directionConstraints: string[];
    usableHours: AlmanacHourEvidence[];
    traditionalFacts: AlmanacTraditionalFact[];
    limitations: string[];
}
export interface AlmanacEvidenceCalculationStep {
    key: string;
    stage: '候选范围核验' | '逐日历法核验' | '事项与神煞核验' | '参与人与现实约束核验' | '逐时时课核验' | '候选分组核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明候选范围、历法字段、事项宜忌、神煞、参与人关系、逐时时课与候选分组如何形成当前证据；不证明现实吉凶、成功率、个人结果或必然适宜';
}
export interface AlmanacCounterEvidenceFact {
    key: string;
    date: string;
    type: '候选限制' | '强限制' | '无可用时辰';
    status: '已触发';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只表示当前候选存在事项忌项、传统限制、参与人冲突或无可用时辰；不得把单项反证直接写成现实失败、灾祸或必然不宜';
}
export interface AlmanacCounterSummaryFact {
    key: 'almanac:counter-summary';
    status: '有明确反证' | '未见明确反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明候选范围内是否记录明确限制，不代表未见反证的日期现实风险为零，也不得按反证数量生成吉凶总分或失败概率';
}
export interface AlmanacSummaryFact {
    key: 'almanac:evidence-summary';
    status: '证据链完整' | '候选资料缺失';
    factKeys: string[];
    candidateCount: number;
    visibleCandidateCount: number;
    preferredDateCount: number;
    conditionalDateCount: number;
    cautionDateCount: number;
    usableHourFactCount: number;
    traditionalFactCount: number;
    counterEvidenceCount: number;
    promptText: string;
    sources: string[];
    limitation: '黄历择日证据汇总只统计候选日、分组、逐时时课、传统资料与反证的覆盖情况；不得按数量或候选等级生成吉凶总分、成功率、个人保证或唯一最佳日期';
}
export interface AlmanacLimitationFact {
    key: string;
    type: '候选范围与历法边界' | '事项宜忌与神煞边界' | '参与人适配边界' | '逐时时课与分组边界' | '天文与传统资料边界' | '现实与高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束候选范围、历法、事项宜忌、神煞、参与人、逐时时课、月相与传统资料能够支持的解释范围，不得被反向当作现实吉凶、成功率、个人结果或必然适宜的证据';
}
export interface AlmanacEvidenceAnalysis {
    key: 'almanac:evidence';
    status: '已计算';
    calculationSteps: AlmanacEvidenceCalculationStep[];
    calculationChain: string[];
    candidates: AlmanacCandidateEvidence[];
    preferredDates: string[];
    conditionalDates: string[];
    cautionDates: string[];
    hardConstraints: string[];
    realityConstraints: string[];
    traditionalFacts: AlmanacTraditionalFact[];
    counterEvidenceFacts: AlmanacCounterEvidenceFact[];
    counterSummaryFact: AlmanacCounterSummaryFact;
    limitations: string[];
    limitationFacts: AlmanacLimitationFact[];
    summaryFact: AlmanacSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function conditionAlmanacTraditionalText(text: string): string;
export declare function classifyAlmanacCandidate(day: AlmanacDayCandidate): {
    status: AlmanacCandidateStatus;
    strongConstraintTexts: string[];
    constraintTexts: string[];
};
export declare function analyzeAlmanacEvidence(data: AlmanacData): AlmanacEvidenceAnalysis;
