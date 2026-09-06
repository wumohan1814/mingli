import type { LiuyaoChangeRelation, LiuyaoData, LiuyaoHiddenSpirit, LiuyaoYaoDetail } from '../types/divination';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { type RandomTraceFact } from '../shared/random';
export type LiuyaoEvidenceTopic = 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';
export type LiuyaoGodRole = '用神' | '原神' | '忌神' | '仇神';
export interface LiuyaoEvidenceOptions {
    topic?: LiuyaoEvidenceTopic;
    /** 用户或上层明确指定的用神六亲；优先于主题默认候选。 */
    usefulGodRelative?: string;
}
export interface LiuyaoYaoReference {
    key: string;
    factKey: string;
    source: '本卦' | '伏神';
    status: '已匹配';
    position: number;
    sixRelative: string;
    branch: string;
    wuxing: string;
    isWorld?: boolean;
    isResponse?: boolean;
    isChanging?: boolean;
    isVoid: boolean;
    support: string[];
    constraints: string[];
    changedYao?: {
        sixRelative: string;
        branch: string;
        wuxing: string;
        isVoid: boolean;
        relation: LiuyaoYaoDetail['changeRelation'];
        relations: LiuyaoChangeRelation[];
        direction: LiuyaoYaoDetail['changeDirection'];
    };
}
export interface LiuyaoUsefulGodCandidate {
    key: string;
    status: '已匹配' | '未匹配';
    sourceStatus: '用户指定' | '主题默认' | '盘面补齐';
    label: string;
    relative?: string;
    position?: number;
    reason: string;
    references: LiuyaoYaoReference[];
    referenceKeys: string[];
    support: string[];
    constraints: string[];
    promptText: string;
    sources: string[];
    limitation: '用神候选只记录由明确指定、问题主题或世应动爻提出的取用范围及其盘面匹配；候选不等于已证明现实事项，也不得按候选顺序、数量或匹配数量换算吉凶分与成功率';
}
export interface LiuyaoGodChainItem {
    key: string;
    role: LiuyaoGodRole;
    status: '盘中有对应' | '盘中未见';
    wuxing: string;
    relation: string;
    references: LiuyaoYaoReference[];
    referenceKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '原神、忌神与仇神只按已选候选五行的生克链定义，并记录盘中是否有对应爻；盘中有无对应不直接证明现实助力、阻碍、吉凶或结果';
}
export interface LiuyaoTraditionalSymbolFact {
    key: string;
    status: '已映射';
    relative: string;
    positions: number[];
    originalText: string;
    promptText: string;
    source: '传统六亲类象表与当前六亲排布';
    sources: string[];
    limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果';
}
export interface LiuyaoLineFact {
    key: string;
    status: '已计算';
    position: number;
    rawValue: number;
    yaoType: LiuyaoYaoDetail['yaoType'];
    changeType: string;
    sixGod: string;
    sixRelative: string;
    najia: {
        branch: string;
        wuxing: string;
    };
    roles: Array<'世爻' | '应爻'>;
    activity: '静爻' | '明动' | '暗动';
    monthState: {
        branch: string;
        seasonState?: LiuyaoYaoDetail['seasonState'];
        relations: string[];
    };
    dayState: {
        branch: string;
        relations: string[];
    };
    traditionalRelations: {
        twelveStage?: string;
        sanxingType?: string;
        liuhePartner?: string;
        isLiuhai: boolean;
        isRuMu: boolean;
    };
    isVoid: boolean;
    support: string[];
    constraints: string[];
    changedYao?: {
        sixRelative: string;
        branch: string;
        wuxing: string;
        isVoid: boolean;
        relation: LiuyaoYaoDetail['changeRelation'];
        relations: LiuyaoChangeRelation[];
        direction: LiuyaoYaoDetail['changeDirection'];
    };
    promptText: string;
    sources: string[];
    limitation: '逐爻字段是纳甲、世应、月日旺衰与动变规则的计算事实，只限定六爻取证条件，不单独证明现实吉凶、事件、身份、疾病、官非、关系或财务结果';
}
export interface LiuyaoHiddenSpiritFact {
    key: string;
    status: '已计算';
    position: number;
    sixRelative: string;
    najia: {
        branch: string;
        wuxing: string;
    };
    isVoid: boolean;
    coveringLine: LiuyaoHiddenSpirit['underYao'];
    support: string[];
    constraints: string[];
    promptText: string;
    sources: string[];
    limitation: '伏神结构只证明本卦六亲排布中存在伏藏关系；透出、受制或得助仍须结合飞神、月日、动变与现实进展复核';
}
export interface LiuyaoGenerationFact {
    key: string;
    status: '可核验' | '来源链缺失';
    method: NonNullable<LiuyaoData['generation']>['method'] | '未记录';
    methodLabel: string;
    yaoValues: number[];
    coinThrows: NonNullable<NonNullable<LiuyaoData['generation']>['coinThrows']>;
    expectedLineCount: 6;
    recordedLineCount: number;
    promptText: string;
    sources: string[];
    limitation: '起卦来源只说明卦象如何生成以及六个爻值如何录入或生成，不提高卦象证据等级，也不证明预测有效性或现实结果';
}
export interface LiuyaoLineCoverageFact {
    key: 'liuyao:line-coverage';
    status: '完整' | '缺少爻位' | '爻位异常';
    expectedPositions: number[];
    actualPositions: number[];
    missingPositions: number[];
    duplicatePositions: number[];
    invalidPositions: number[];
    lineFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '六爻覆盖状态只说明当前结果能否完整核验初爻至上爻；缺少、重复或越界爻位时不得反推纳甲、六亲、六神、世应、空破墓或动变内容';
}
export interface LiuyaoHiddenSpiritCoverageFact {
    key: 'liuyao:hidden-spirit-coverage';
    status: '有伏神' | '无伏神' | '字段缺失';
    hiddenSpiritFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '伏神覆盖状态只说明当前结果是否明确保存伏神数组以及是否检出伏神；字段缺失时不得把无记录解释为无伏神，也不得反推伏神位置与六亲';
}
export interface LiuyaoUsefulGodSelectionFact {
    key: 'liuyao:useful-god-selection';
    status: '已选定候选' | '缺少可用候选';
    topic: LiuyaoEvidenceTopic;
    requestedRelative: string | null;
    selectedCandidateKey: string | null;
    candidateKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '用神选择状态只说明当前候选是否在本卦或伏神中找到匹配；缺少匹配时不得硬取用神，已有匹配也仍须结合具体问题语义、求测者身份与现实资料复核';
}
export interface LiuyaoCounterEvidenceFact {
    key: string;
    ownerCandidateKey: string;
    candidateLabel: string;
    status: '已触发';
    detail: string;
    referenceKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只表示候选用神命中空亡、月破、日破、休囚死、入墓、回头克冲、化空、化退或未匹配等限制；不得把单项反证直接写成现实失败、灾祸或必然结果';
}
export interface LiuyaoCounterSummaryFact {
    key: 'liuyao:counter-summary';
    status: '有明确反证' | '未见明确反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明当前候选核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率';
}
export interface LiuyaoTimingFact {
    key: string;
    type: '动爻触发' | '空亡填实' | '伏神透出' | '反吟伏吟节奏' | '静卦边界' | '期限边界';
    sourceStatus: '由盘面生成' | '统一边界';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '六爻应期事实只提供动爻、出空冲实、伏神透出与静卦复核等触发条件；未给期限时不得把爻位、支序或卦数换算唯一日期，也不证明事件必然发生';
}
export interface LiuyaoHexagramStructureFact {
    key: string;
    kind: '整卦六合六冲' | '反吟伏吟' | '特殊卦象' | '日辰三合' | '月建三合';
    status: '已计算';
    originalText: string;
    promptText: string;
    sources: string[];
    limitation: '整卦六合六冲、反吟伏吟、特殊卦象与日月三合只描述已计算的卦内结构；不得直接写成现实和合、冲散、反复、成功、失败或固定应期';
}
export interface LiuyaoTimingSummaryFact {
    key: 'liuyao:timing-summary';
    status: '已提供触发条件' | '仅有边界';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '应期汇总只说明当前盘面保存了哪些触发与边界条件；不得按条件数量、爻位或地支序换算固定天数、绝对日期或事件概率';
}
export interface LiuyaoCalculationStep {
    key: string;
    stage: '起卦来源核验' | '六爻逐爻计算' | '伏神资料核验' | '用神候选筛选' | '原忌仇神作用链' | '反证与应期核验' | '证据汇总';
    status: '已计算' | '资料不足';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明起卦来源、逐爻、伏神、用神候选、五行作用链、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}
export interface LiuyaoSummaryFact {
    key: 'liuyao:evidence-summary';
    status: '证据链完整' | '部分资料缺失' | '缺少可用候选';
    factKeys: string[];
    lineFactCount: number;
    hiddenSpiritFactCount: number;
    candidateCount: number;
    matchedCandidateCount: number;
    godChainFactCount: number;
    structureFactCount: number;
    counterEvidenceCount: number;
    timingFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '六爻证据汇总只统计起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、超自然判断或唯一日期';
}
export interface LiuyaoLimitationFact {
    key: string;
    type: '起卦与随机来源边界' | '逐爻与伏神资料边界' | '用神候选与五行链边界' | '卦内结构与传统类象边界' | '反证与应期边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束六爻起卦、逐爻、伏神、用神、传统类象与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病灾祸、超自然原因、事件概率或固定应期的证据';
}
export interface LiuyaoEvidenceAnalysis {
    key: 'liuyao:evidence';
    status: '已计算';
    topic: LiuyaoEvidenceTopic;
    monthBranch: string;
    dayBranch: string;
    candidates: LiuyaoUsefulGodCandidate[];
    selectedCandidate: LiuyaoUsefulGodCandidate | null;
    godChain: LiuyaoGodChainItem[];
    traditionalSymbols: LiuyaoTraditionalSymbolFact[];
    structureFacts: LiuyaoHexagramStructureFact[];
    lineCoverageFact: LiuyaoLineCoverageFact;
    lineFacts: LiuyaoLineFact[];
    hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
    hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
    selectionFact: LiuyaoUsefulGodSelectionFact;
    generationFact: LiuyaoGenerationFact;
    generationFacts: string[];
    randomFact: RandomTraceFact;
    randomFacts: string[];
    timingFacts: LiuyaoTimingFact[];
    timingSummaryFact: LiuyaoTimingSummaryFact;
    timingConditions: string[];
    counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
    counterSummaryFact: LiuyaoCounterSummaryFact;
    counterEvidence: string[];
    calculationSteps: LiuyaoCalculationStep[];
    calculationChain: string[];
    summaryFact: LiuyaoSummaryFact;
    limitations: string[];
    limitationFacts: LiuyaoLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function conditionLiuyaoTraditionalText(text: string): string;
export declare function analyzeLiuyaoEvidence(data: LiuyaoData, options?: LiuyaoEvidenceOptions): LiuyaoEvidenceAnalysis;
