import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { type RandomTraceFact } from '../shared/random';
import type { TarotData } from '../types/divination';
export interface TarotCardEvidence {
    key: string;
    status: '已映射';
    index: number;
    cardId: number;
    position: string;
    name: string;
    orientation: '正位' | '逆位';
    keywords: string[];
    element: string;
    archetype: string;
    activeMeaning: string;
    promptMeaning: string;
    constraints: string[];
    traditionalFactKey: string;
    promptText: string;
    sources: string[];
    limitation: '逐牌事实只记录牌位、牌名、正逆位、关键词、元素与牌阶主题；不得由单牌或牌面数量直接推断现实事件、他人意图、疾病、法律事实、财务结果、成功率或唯一未来';
}
export interface TarotSpreadCoverageFact {
    key: 'tarot:spread-coverage';
    status: '完整' | '牌数不符' | '牌位异常' | '未知牌阵';
    spreadType: string;
    spreadName: string;
    expectedCardCount: number | null;
    actualCardCount: number;
    expectedPositions: string[];
    actualPositions: string[];
    missingPositions: string[];
    duplicatePositions: string[];
    unexpectedPositions: string[];
    positionOrderMismatches: number[];
    duplicateCardIds: number[];
    cardFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '牌阵覆盖状态只说明牌数、牌位顺序与牌面唯一性是否符合已声明牌阵；缺失、重复、越位或未知牌阵时不得补造牌面、牌位或跨牌关系';
}
export interface TarotDrawOrderFact {
    key: string;
    status: '一致' | '不一致' | '缺少牌面';
    index: number;
    recordedIndex: number;
    cardFactKey: string | null;
    position: string;
    cardId: number;
    cardName: string;
    orientation: '正位' | '逆位';
    mismatches: string[];
    promptText: string;
    sources: string[];
    limitation: '逐张抽取事实只核对洗牌顺序记录与已确定牌面的牌号、牌名、牌位和正逆位；记录一致不表示牌义可信度、预测有效性或现实结果';
}
export interface TarotSequenceFact {
    key: string;
    status: '已连接';
    fromCardKey: string;
    toCardKey: string;
    fromPosition: string;
    toPosition: string;
    fromCard: string;
    toCard: string;
    promptText: string;
    sources: string[];
    limitation: '牌序事实只描述已声明牌位的相邻顺序与牌面变化；不得把牌阵顺序直接写成现实事件必然按同样阶段发生';
}
export type TarotElementInteractionRelation = '同类强化' | '相互助长' | '相互制约' | '中性并置' | '核心课题介入' | '资料不足';
export interface TarotElementInteractionFact {
    key: string;
    status: '已计算' | '资料不足';
    fromCardKey: string;
    toCardKey: string;
    fromPosition: string;
    toPosition: string;
    fromCard: string;
    toCard: string;
    fromElement: string;
    toElement: string;
    relation: TarotElementInteractionRelation;
    orientationConstraint: string;
    promptText: string;
    sources: string[];
    limitation: '相邻牌元素互参只描述四元素传统关系或大阿卡纳介入方式；正逆位只约束表达方向，不改变元素关系，不得据此生成吉凶分数、事件结论、成功率或唯一未来';
}
export interface TarotThemeFact {
    key: string;
    status: '重复主题' | '单次出现';
    theme: string;
    count: number;
    cardFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '主题聚合只统计元素或大阿卡纳标签在本次牌面中的出现次数；不得按次数生成权重、能量分数、吉凶总分、成功率或主导结论';
}
export interface TarotCounterEvidenceFact {
    key: string;
    ownerCardKey: string;
    position: string;
    card: string;
    orientation: '正位' | '逆位';
    type: '逆位解释约束';
    status: '已触发';
    detail: string;
    promptText: string;
    sources: string[];
    limitation: '逆位反证只表示该牌主题可能受阻、过度、内化或方向偏离；不得把单张逆位直接写成现实失败、不利结果、疾病、欺骗、损失或灾祸';
}
export interface TarotCounterSummaryFact {
    key: 'tarot:counter-summary';
    status: '有逆位约束' | '未见逆位约束';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明本次牌面是否存在逆位解释约束；未见逆位不代表结果必然有利，也不得按逆位数量换算吉凶或成功率';
}
export interface TarotLimitationFact {
    key: string;
    type: '随机边界' | '象征材料边界' | '聚合边界' | '正逆位边界' | '高风险结论边界' | '时间边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束牌面材料可以支持的解释范围，不得被反向当作现实事件、人物意图或未来结果的证据';
}
export interface TarotEvidenceCalculationStep {
    key: string;
    stage: '随机来源核验' | '抽牌记录核验' | '牌阵覆盖核验' | '逐牌映射核验' | '牌序关系核验' | '主题与反证核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌映射、牌序、相邻元素互参、主题与逆位约束如何形成当前证据；不证明预测有效性、现实吉凶、人物意图或唯一未来';
}
export interface TarotSummaryFact {
    key: 'tarot:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    cardFactCount: number;
    drawOrderFactCount: number;
    sequenceFactCount: number;
    elementInteractionFactCount: number;
    themeFactCount: number;
    recurringThemeFactCount: number;
    counterEvidenceCount: number;
    traditionalFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '塔罗证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、相邻元素互参、主题、逆位约束与牌面事实的覆盖情况；不得按数量生成能量分数、吉凶总分、成功率、人物判断或唯一未来';
}
export interface TarotTraditionalFact {
    key: string;
    status: '已映射';
    index: number;
    position: string;
    card: string;
    orientation: '正位' | '逆位';
    kind: '牌面事实';
    originalText: string;
    promptText: string;
    sources: string[];
    limitation: '逐牌事实只记录牌位、牌名、正逆位、关键词、元素与牌阶；不证明现实事件、他人意图、心理状态、疾病、法律事实、财务结果或唯一未来';
}
export interface TarotDrawFact {
    key: string;
    status: '可核验' | '来源链缺失' | '来源链不一致';
    deckSize?: number;
    method?: string;
    orientationRule?: string;
    order: NonNullable<TarotData['draw']>['order'];
    expectedCardCount: number;
    recordedCardCount: number;
    orderFactKeys: string[];
    mismatchIndexes: number[];
    missingIndexes: number[];
    extraIndexes: number[];
    promptText: string;
    sources: string[];
    limitation: '抽牌来源只记录洗牌、牌位顺序与正逆位生成过程；来源链完整不表示牌义可信度、预测有效性或现实结果';
}
export interface TarotEvidenceAnalysis {
    key: 'tarot:evidence';
    status: '已计算';
    calculationSteps: TarotEvidenceCalculationStep[];
    calculationChain: string[];
    sources: Array<{
        title: string;
        evidence: string;
        role: '牌组结构' | '传统解释来源';
    }>;
    cards: TarotCardEvidence[];
    spreadCoverageFact: TarotSpreadCoverageFact;
    drawFact: TarotDrawFact;
    drawOrderFacts: TarotDrawOrderFact[];
    drawFacts: string[];
    sequenceFacts: TarotSequenceFact[];
    sequence: string[];
    elementInteractionFacts: TarotElementInteractionFact[];
    elementInteractions: string[];
    themeFacts: TarotThemeFact[];
    recurringThemeFacts: TarotThemeFact[];
    recurringThemes: string[];
    randomFact: RandomTraceFact;
    randomFacts: string[];
    counterEvidenceFacts: TarotCounterEvidenceFact[];
    counterSummaryFact: TarotCounterSummaryFact;
    counterEvidence: string[];
    limitationFacts: TarotLimitationFact[];
    limitations: string[];
    traditionalFacts: TarotTraditionalFact[];
    summaryFact: TarotSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeTarotEvidence(data: TarotData): TarotEvidenceAnalysis;
