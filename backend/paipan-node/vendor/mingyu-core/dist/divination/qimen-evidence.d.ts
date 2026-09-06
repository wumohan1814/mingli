import type { QimenData, QimenJiuGongGe } from '../types/divination';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
export type QimenCandidateSource = '值符落宫' | '值使落宫' | '日干落宫' | '时干落宫' | '盘面洞察' | '经典格局';
export interface QimenPalaceEvidence {
    gong: number;
    palaceFactKey: string;
    name: string;
    direction: string;
    element: string;
    sources: QimenCandidateSource[];
    palace: QimenJiuGongGe;
    patterns: string[];
    stemRelations: string[];
    support: string[];
    constraints: string[];
    isVoid: boolean;
    hasHorse: boolean;
}
export interface QimenPalaceFact {
    key: string;
    status: '已计算';
    gong: number;
    name: string;
    direction: string;
    element: string;
    tianPan: QimenJiuGongGe['tianPan'];
    diPan: QimenJiuGongGe['diPan'];
    renPan: QimenJiuGongGe['renPan'];
    shenPan: QimenJiuGongGe['shenPan'];
    candidateSources: QimenCandidateSource[];
    isVoid: boolean;
    voidBranches: string[];
    hasHorse: boolean;
    horseSourceBranch?: string;
    patterns: string[];
    patternFactKeys: string[];
    stemRelations: string[];
    stemRelationFacts: QimenStemRelationFact[];
    insights: QimenPalaceInsightFact[];
    support: string[];
    constraints: string[];
    promptText: string;
    sources: string[];
    limitation: '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只限定候选宫取证条件，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
}
export interface QimenPalaceInsightFact {
    key: string;
    ownerPalaceFactKey: string;
    level: '有利' | '风险' | '关注';
    status: '已命中';
    originalText: string;
    promptText: string;
    sources: string[];
    limitation: '宫位洞察只记录当前规则对该宫门、星、神、干与格局组合的分类提示；不证明现实吉凶、人物意图、事件结果或成功概率';
}
export interface QimenStemRelationFact {
    key: string;
    ownerPalaceFactKey: string;
    gong: number;
    heavenStem: string;
    earthStem: string;
    relation: string;
    pattern: string | null;
    status: '已计算';
    promptText: string;
    sources: string[];
    limitation: '天地盘干关系只记录当前宫天盘干与地盘干的生克、合、墓、刑或命名格局；不单独证明现实吉凶、人物关系、事件结果或固定应期';
}
export interface QimenPalaceCoverageFact {
    key: 'qimen:palace-coverage';
    status: '完整' | '缺少宫位' | '宫位异常';
    expectedGongs: number[];
    actualGongs: number[];
    missingGongs: number[];
    duplicateGongs: number[];
    invalidGongs: number[];
    palaceFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '九宫覆盖状态只说明当前结果能否完整核验一至九宫；缺少、重复或越界宫位时不得反推门、星、神、天地盘干、空亡、马星或格局';
}
export interface QimenPalaceRelationEvidence {
    key: string;
    fromPalaceFactKey: string;
    toPalaceFactKey: string;
    fromGong: number;
    toGong: number;
    from: string;
    to: string;
    relation: string;
    status: '已归类' | '待核验';
    meaning: string;
    promptText: string;
    sources: string[];
    limitation: '宫间关系只按候选宫五行陈述比和、生、克或待核验状态；不证明现实中的支持、阻碍、人物关系、方位吉凶、事件结果或成功概率';
}
export interface QimenPatternEvidenceFact {
    key: string;
    status: '已命中';
    name: string;
    kind: '基础格局' | '经典格局' | '复合格局';
    traditionalTone: '有利' | '风险' | '中性' | '混合';
    originalText: string;
    promptText: string;
    palaces: number[];
    sources: string[];
    limitation: '传统格局命中只证明盘面满足当前列明规则，不是现实结果、吉凶分或事件概率';
}
export interface QimenCalculationEvidenceFact {
    key: string;
    stage: '排盘范围' | '定局' | '值符定位' | '值使定位' | '四柱背景';
    status: '已确定' | '落宫缺失';
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    promptText: string;
    sourceKeys: string[];
    limitation: '定局与定位字段只证明排盘范围、主动干支、节气三元、阴阳遁局数和值符值使如何形成当前盘面，不证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
}
export interface QimenRuleSourceFact {
    key: string;
    status: '已声明';
    category: '定局规则' | '值符值使规则' | '九宫排布规则' | '五行关系规则';
    rule: string;
    appliesTo: string[];
    sources: string[];
    promptText: string;
    limitation: '规则来源只标明当前结构化字段采用的传统模型与计算路径，不等于现代实证验证、现实因果关系、吉凶保证或结果概率';
}
export interface QimenCounterEvidenceFact {
    key: string;
    ownerPalaceFactKey: string;
    gong: number;
    palaceName: string;
    status: '已触发';
    detail: string;
    promptText: string;
    sources: string[];
    limitation: '反证事实只表示候选宫命中空亡、特殊条件、风险洞察或格局限制；不得把单项限制直接写成现实失败、灾祸、人物恶意或必然结果';
}
export interface QimenCounterSummaryFact {
    key: 'qimen:counter-summary';
    status: '有明确反证' | '未见明确反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明当前候选宫核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率';
}
export interface QimenTimingFact {
    key: string;
    type: '原应期条件' | '空亡填实' | '马星触发' | '伏吟节奏' | '反吟节奏' | '应期限制' | '期限边界';
    sourceStatus: '原结果提供' | '由盘面补齐' | '统一边界';
    rhythm: '快' | '中' | '慢' | null;
    rawText?: string;
    promptText: string;
    sources: string[];
    limitation: '应期事实只提供盘内相对节奏、空亡填实、马星发动、伏吟反吟与现实触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生';
}
export interface QimenTimingSummaryFact {
    key: 'qimen:timing-summary';
    status: '已提供触发条件' | '仅有期限边界';
    rhythm: '快' | '中' | '慢' | null;
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '应期汇总只说明当前盘面保存了哪些相对节奏与触发条件；不得把条件数量、宫数或局数换算固定天数、绝对日期或事件概率';
}
export interface QimenDirectionFact {
    key: string;
    kind: '建议方位' | '避用方位' | '候选宫方位';
    sourceStatus: '原结果提供' | '由候选宫补齐';
    gong: number;
    palaceName: string;
    palaceFactKey: string;
    direction: string;
    use: string | null;
    candidateSources: QimenCandidateSource[];
    reasons: string[];
    promptText: string;
    sources: string[];
    limitation: '方位事实只记录原结果提供的建议、避用方位或候选宫方向；采用前必须核实现实路线、安全、权限、天气与事项用神，不证明方位必然吉利、危险或成功';
}
export interface QimenDirectionSummaryFact {
    key: 'qimen:direction-summary';
    status: '有明确建议' | '仅候选映射' | '未定位';
    recommendedFactKeys: string[];
    avoidFactKeys: string[];
    candidateFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '方位汇总只说明当前结果是否提供建议、避用或候选宫方向；未列方位不代表其他方向安全，列出方位也不得脱离现实路线与安全条件使用';
}
export interface QimenSummaryFact {
    key: 'qimen:evidence-summary';
    status: '证据链完整' | '部分资料缺失' | '未定位候选宫';
    factKeys: string[];
    calculationFactCount: number;
    ruleSourceCount: number;
    palaceFactCount: number;
    candidateCount: number;
    relationCount: number;
    patternCount: number;
    counterEvidenceCount: number;
    timingFactCount: number;
    directionFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '奇门证据汇总只统计排盘、九宫、候选、格局、反证、应期与方位事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图、方位保证或唯一日期';
}
export interface QimenLimitationFact {
    key: string;
    type: '排盘与规则边界' | '九宫资料边界' | '用神候选边界' | '格局与反证边界' | '应期边界' | '方位与高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束奇门排盘、候选宫、格局、应期与方位资料能够支持的解释范围，不得被反向当作现实吉凶、人物意图、事件概率、方位保证或固定应期的证据';
}
export interface QimenEvidenceAnalysis {
    key: 'qimen:evidence';
    status: '已计算';
    calculationEvidenceFacts: QimenCalculationEvidenceFact[];
    calculationSteps: QimenCalculationEvidenceFact[];
    calculationFacts: string[];
    calculationChain: string[];
    ruleSourceFacts: QimenRuleSourceFact[];
    ruleSources: string[];
    palaceCoverageFact: QimenPalaceCoverageFact;
    palaceFacts: QimenPalaceFact[];
    candidates: QimenPalaceEvidence[];
    relations: QimenPalaceRelationEvidence[];
    patternFacts: QimenPatternEvidenceFact[];
    counterEvidenceFacts: QimenCounterEvidenceFact[];
    counterSummaryFact: QimenCounterSummaryFact;
    counterEvidence: string[];
    timingFacts: QimenTimingFact[];
    timingSummaryFact: QimenTimingSummaryFact;
    timingConditions: string[];
    directionFacts: QimenDirectionFact[];
    directionSummaryFact: QimenDirectionSummaryFact;
    directionConditions: string[];
    summaryFact: QimenSummaryFact;
    limitations: string[];
    limitationFacts: QimenLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeQimenEvidence(data: QimenData): QimenEvidenceAnalysis;
