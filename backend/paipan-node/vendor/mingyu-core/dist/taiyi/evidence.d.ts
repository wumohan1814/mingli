import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { TaiyiModelInfo, TaiyiScope } from '../types/divination';
export interface TaiyiEvidenceInput {
    scope: TaiyiScope;
    dateTime: string;
    ganZhi: string;
    accumulatedLabel: '积年' | '积月' | '积日' | '积时';
    accumulatedValue: number;
    entryYears: number;
    yuan: number;
    ji: number;
    yinYang: '阳遁' | '阴遁';
    bureau: number;
    taiyiPosition: string;
    taiyiPalace: number;
    wenChangPosition: string;
    wenChangPalace: number;
    shiJiPosition: string;
    shiJiPalace: number;
    jiShenPosition: string;
    jiShenPalace: number;
    lordCount: number;
    guestCount: number;
    setCount: number;
    countNatures?: {
        lord?: string;
        guest?: string;
        set?: string;
    };
    lordGeneral: number;
    lordAssistant: number;
    guestGeneral: number;
    guestAssistant: number;
    setGeneral: number;
    setAssistant: number;
    sixteenGods: {
        branch: string;
        god: string;
    }[];
    model: TaiyiModelInfo;
}
export interface TaiyiEvidenceAnalysis {
    key: 'taiyi:evidence';
    status: '已计算';
    calculationChain: string[];
    calculationSteps: TaiyiCalculationStep[];
    positionFacts: TaiyiPositionFact[];
    forceFacts: TaiyiForceFact[];
    sixteenGodFacts: TaiyiSixteenGodFact[];
    conditionFacts: TaiyiConditionFact[];
    primaryFacts: string[];
    supportingFacts: string[];
    counterEvidence: string[];
    counterEvidenceFacts: TaiyiCounterEvidenceFact[];
    counterSummaryFact: TaiyiCounterSummaryFact;
    limitations: string[];
    limitationFacts: TaiyiLimitationFact[];
    summaryFact: TaiyiSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export interface TaiyiPositionFact {
    key: string;
    status: '已计算';
    role: '太乙' | '文昌（主目）' | '始击（客目）' | '计神';
    position: string;
    palace: number;
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '核心定位字段是七十二局立成与计神规则的计算事实，只限定太乙盘面取证位置，不单独证明现实吉凶、攻守结果、人物处境或固定应期';
}
export interface TaiyiForceFact {
    key: string;
    status: '已计算';
    side: '主' | '客' | '定';
    count: number;
    nature?: string;
    generalPalace: number;
    assistantPalace: number;
    generalInCenter: boolean;
    assistantInCenter: boolean;
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '主客定算、算数属性与将参宫位是传统规则计算结果，只用于比较三方盘面条件，不直接证明现实胜负、行动成败、吉凶比例或人物强弱';
}
export interface TaiyiSixteenGodFact {
    key: string;
    status: '已计算';
    index: number;
    branch: string;
    god: string;
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '十六神固定定位只作为太乙基础盘辅助索引，未结合具体类神和完整古法细目时不得单独生成现实结论';
}
export interface TaiyiConditionFact {
    key: string;
    status: '已命中' | '未命中';
    kind: '掩' | '囚' | '主将参中宫' | '客将参中宫';
    matched: boolean;
    calculationStepKeys: string[];
    calculationText: string;
    promptText: string;
    sources: string[];
    limitation: '掩、囚与将参中宫只证明盘面满足对应位置条件；传统动静或攻守解释须结合所问事项与现实资料，不代表必然结果';
}
export interface TaiyiCalculationStep {
    key: string;
    name: '360周期余数' | '72数段' | '60数段' | '局数';
    status: '已复算';
    input: number;
    operation: string;
    result: number;
    dependsOnStepKeys: string[];
    basis: string;
    promptText: string;
    sources: string[];
    limitation: '积数算式只证明本计积数如何折算360周期余数、72数段、60数段与七十二局；数段序号不等同于已经统一版本口径的元纪，也不证明传统解释有效性、现实胜负、吉凶比例、人物强弱或固定应期';
}
export interface TaiyiCounterEvidenceFact {
    key: string;
    type: '掩' | '囚' | '主将参中宫' | '客将参中宫';
    status: '已命中' | '未命中';
    ownerConditionKey: string;
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录掩、囚与主客将参中宫条件是否命中；未命中不代表现实有利，命中也不证明攻守、胜负或固定应期';
}
export interface TaiyiCounterSummaryFact {
    key: 'taiyi:counter-summary';
    status: '存在未命中条件' | '条件均有命中';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明传统条件覆盖情况；不得据命中数量生成吉凶总分、成功率、人物强弱或固定应期';
}
export interface TaiyiLimitationFact {
    key: string;
    type: '时间尺度边界' | '传统模型边界' | '实证范围边界' | '古法覆盖边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束太乙四计、七十二局、主客定算和十六神可以支持的解释范围，不得被反向当作现实结果或概率证据';
}
export interface TaiyiSummaryFact {
    key: 'taiyi:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    positionFactCount: number;
    forceFactCount: number;
    sixteenGodFactCount: number;
    conditionFactCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '太乙证据汇总只统计积数计算、核心定位、主客定算、十六神、条件、反证与限制覆盖；不得按数量生成吉凶总分、成功率、人物强弱、攻守胜负或固定应期';
}
export declare function buildTaiyiEvidence(data: TaiyiEvidenceInput): TaiyiEvidenceAnalysis;
