import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { type RandomTraceFact } from '../shared/random';
import type { LenormandCombinationRelation, LenormandData } from '../types/divination';
export interface LenormandCardEvidence {
    key: string;
    status: '已映射';
    index: number;
    cardId: number;
    name: string;
    position: string;
    keywords: string[];
    meaning: string;
    house?: string;
    row?: number;
    column?: number;
    traditionalFactKey: string;
    promptText: string;
    sources: string[];
    limitation: '逐牌事实只记录牌位、牌号、牌名、关键词、基础牌义、宫位与行列落点；不得由单牌直接推断现实事件、他人意图、隐私、疾病、法律事实、财务结果、概率数值或唯一未来';
}
export interface LenormandSpreadCoverageFact {
    key: 'lenormand:spread-coverage';
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
    limitation: '牌阵覆盖状态只核对牌数、牌位顺序与牌面唯一性；缺失、重复、越位或未知牌阵时不得补造牌面、牌位、组合或布局关系';
}
export interface LenormandDrawOrderFact {
    key: string;
    status: '一致' | '不一致' | '缺少牌面';
    index: number;
    recordedIndex: number;
    cardFactKey: string | null;
    position: string;
    cardId: number;
    cardName: string;
    house?: string;
    row?: number;
    column?: number;
    mismatches: string[];
    promptText: string;
    sources: string[];
    limitation: '逐张抽取事实只核对洗牌顺序记录与已确定牌面的序号、牌位、牌号、牌名、宫位和行列落点；记录一致不表示牌义可信度、预测有效性或现实结果';
}
export interface LenormandSequenceFact {
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
    limitation: '牌序事实只描述抽取或登记顺序与牌面衔接，不代表两张牌在网格中空间相邻；不得把牌阵顺序直接写成现实事件必然按同样阶段发生';
}
export interface LenormandLayoutCoverageFact {
    key: 'lenormand:layout-coverage';
    status: '结构化覆盖' | '旧版字符串兼容' | '结构缺失' | '不适用';
    spreadType: string;
    expectedRequiredFactCount: number;
    structuredFactCount: number;
    legacyFactCount: number;
    layoutFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '布局覆盖只说明九宫或大桌所需的中心、路径、宫位和人物牌近身关系是否有可核验结构；旧版字符串不得反推行列、宫位、距离或缺失布局事实';
}
export interface LenormandCounterEvidenceFact {
    key: string;
    type: '固定组合覆盖' | '布局覆盖';
    status: '有可用证据' | '存在缺口';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录固定组合或布局证据是否存在；没有命中不代表现实不利，存在证据也不证明现实事件、吉凶或预测有效性';
}
export interface LenormandCounterSummaryFact {
    key: 'lenormand:counter-summary';
    status: '有证据缺口' | '未见证据缺口';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明固定组合与适用布局的资料覆盖情况；不得据此生成吉凶等级、概率数值或现实结果';
}
export interface LenormandLimitationFact {
    key: string;
    type: '随机边界' | '组合分层边界' | '布局边界' | '象征材料边界' | '高风险结论边界' | '时间边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束雷诺曼牌面、组合和布局可以支持的解释范围，不得被反向当作现实事件或未来结果的证据';
}
export interface LenormandEvidenceCalculationStep {
    key: string;
    stage: '随机来源核验' | '抽牌记录核验' | '牌阵覆盖核验' | '逐牌映射核验' | '牌序与组合核验' | '布局覆盖核验' | '反证核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌、牌序组合、九宫或大桌布局与反证如何形成当前证据；不证明预测有效性、现实吉凶、人物意图、概率或唯一未来';
}
export interface LenormandSummaryFact {
    key: 'lenormand:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    cardFactCount: number;
    drawOrderFactCount: number;
    sequenceFactCount: number;
    fixedCombinationCount: number;
    adjacentReadingCount: number;
    structuredLayoutFactCount: number;
    counterEvidenceCount: number;
    traditionalFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '雷诺曼证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、固定组合、相邻合读、布局与反证覆盖；不得按数量生成吉凶等级、概率数值、人物判断、时间保证或唯一未来';
}
export interface LenormandTraditionalFact {
    key: string;
    status: '已映射';
    kind: '单牌牌义' | '固定组合' | '相邻合读';
    cardFactKeys: string[];
    cardNames: string[];
    positions: string[];
    originalText: string;
    promptText: string;
    verificationTargets: string[];
    sources: string[];
    limitation: '牌名、关键词、单牌牌义与组合牌义只作为当前牌阵的象征解释材料，不证明现实事件、他人意图、隐私、感情承诺、怀孕生育、疾病、法律事实、财务结果或唯一未来';
}
export interface LenormandLayoutFact {
    key: string;
    status: '已计算';
    kind: '九宫中心' | '九宫路径' | '大桌宫位' | '人物牌近身' | '归宫';
    cardFactKeys: string[];
    cardNames: string[];
    positions: string[];
    houses: string[];
    factText: string;
    promptText: string;
    source: string;
    sources: string[];
    limitation: '布局位置是由牌阵顺序计算的事实；中心、路径、近身与归宫只定义传统读取范围，不自动证明吉凶、现实事件或时间';
}
export interface LenormandDrawFact {
    key: string;
    status: '可核验' | '来源链缺失' | '来源链不一致';
    deckSize?: number;
    method?: string;
    order: NonNullable<LenormandData['draw']>['order'];
    expectedCardCount: number;
    recordedCardCount: number;
    orderFactKeys: string[];
    mismatchIndexes: number[];
    missingIndexes: number[];
    extraIndexes: number[];
    promptText: string;
    sources: string[];
    limitation: '抽牌来源只记录洗牌、牌位顺序、宫位和行列落点；来源链完整不表示牌义可信度、预测有效性或现实结果';
}
export interface LenormandEvidenceAnalysis {
    key: 'lenormand:evidence';
    status: '已计算';
    calculationSteps: LenormandEvidenceCalculationStep[];
    calculationChain: string[];
    cards: LenormandCardEvidence[];
    spreadCoverageFact: LenormandSpreadCoverageFact;
    sequenceFacts: LenormandSequenceFact[];
    sequence: string[];
    fixedCombinations: NonNullable<LenormandData['combinations']>;
    adjacentReadings: NonNullable<LenormandData['combinations']>;
    drawFact: LenormandDrawFact;
    drawOrderFacts: LenormandDrawOrderFact[];
    drawFacts: string[];
    layoutFacts: string[];
    layoutCoverageFact: LenormandLayoutCoverageFact;
    randomFact: RandomTraceFact;
    randomFacts: string[];
    counterEvidence: string[];
    counterEvidenceFacts: LenormandCounterEvidenceFact[];
    counterSummaryFact: LenormandCounterSummaryFact;
    limitations: string[];
    limitationFacts: LenormandLimitationFact[];
    traditionalFacts: LenormandTraditionalFact[];
    structuredLayoutFacts: LenormandLayoutFact[];
    summaryFact: LenormandSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function conditionLenormandTraditionalText(text: string, options?: {
    kind?: LenormandTraditionalFact['kind'];
    cardNames?: string[];
    keywords?: string[];
    relation?: LenormandCombinationRelation;
    positions?: string[];
}): string;
export declare function analyzeLenormandEvidence(data: LenormandData): LenormandEvidenceAnalysis;
