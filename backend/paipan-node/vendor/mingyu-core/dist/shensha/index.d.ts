export type ShenshaScope = 'common' | 'bazi' | 'liuren' | 'qimen' | 'taiyi' | 'qizheng' | 'bazhai';
export interface ShenshaContext {
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    hourGanZhi: string;
}
export interface ShenshaResult {
    id: string;
    name: string;
    /** 命中与否 / 相关地支或说明 */
    value: string | string[];
    detail?: string;
}
export type ShenshaContextKey = keyof ShenshaContext;
export interface ShenshaEvidenceMetadata {
    /** 当前规则实际读取的四柱字段。 */
    inputDependencies: ShenshaContextKey[];
    /** 可公开说明的固定起法，不包含内部函数名。 */
    ruleText: string;
    /** 固定资料或算法来源；动态注册项缺省时会显式标记来源未声明。 */
    sources: string[];
    /** 旧注册函数返回值的语义；默认沿用“返回即命中”。 */
    resultMeaning?: 'hit' | 'target-branches';
}
export interface ShenshaDefinition {
    id: string;
    name: string;
    scope: ShenshaScope;
    evidence?: ShenshaEvidenceMetadata;
    /** 计算神煞；返回 null 表示不命中 */
    compute: (ctx: ShenshaContext) => ShenshaResult | null;
}
export interface ShenshaCatalogItem {
    id: string;
    name: string;
    scope: ShenshaScope;
    evidenceStatus: '来源已声明' | '来源未声明';
    inputDependencies: ShenshaContextKey[];
    ruleText: string;
    sources: string[];
}
export interface ShenshaPillarFact {
    key: string;
    pillar: ShenshaContextKey;
    label: '年柱' | '月柱' | '日柱' | '时柱';
    ganZhi: string;
    stem: string;
    branch: string;
    status: '有效六十甲子';
    promptText: string;
    sources: string[];
    limitation: '四柱输入事实只证明当前查询采用了哪些有效干支，不证明神煞已经命中或具有现实因果';
}
export interface ShenshaCalculationStep {
    key: string;
    stage: '四柱输入核验' | '规则取值' | '逐柱定位' | '证据汇总';
    status: '已核验' | '已计算' | '已定位' | '已汇总';
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '神煞计算步骤只证明规则如何从四柱取得目标并逐柱核对；不得把步骤完整度解释为吉凶、性格、事件概率或必然结果';
}
export interface ShenshaMatchedPillar {
    pillar: ShenshaContextKey;
    label: '年柱' | '月柱' | '日柱' | '时柱';
    ganZhi: string;
    branch: string;
}
export interface ShenshaMatchFact {
    key: string;
    id: string;
    name: string;
    scope: ShenshaScope;
    status: '命中' | '未命中';
    evidenceStatus: '来源已声明' | '来源未声明';
    inputDependencies: ShenshaContextKey[];
    targetBranches: string[];
    matchedPillars: ShenshaMatchedPillar[];
    result?: ShenshaResult;
    ruleText: string;
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '神煞命中事实只记录当前注册规则与四柱地支的核对结果，只能作为相应传统体系的辅助资料，不得单独定吉凶或现实事件';
}
export interface ShenshaLimitationFact {
    key: string;
    type: '体系范围边界' | '辅助证据边界' | '来源声明边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '神煞限制事实用于约束通用规则可以支持的解释范围，不得被反向当作吉凶、人物定性、现实因果、事件概率或固定应期的证据';
}
export interface ShenshaSummaryFact {
    key: 'foundation:shensha:evidence-summary';
    status: '证据链完整' | '存在来源未声明';
    factKeys: string[];
    requestedRuleCount: number;
    matchedRuleCount: number;
    unmatchedRuleCount: number;
    declaredSourceRuleCount: number;
    undeclaredSourceRuleCount: number;
    calculationStepCount: number;
    matchFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '神煞证据汇总只统计输入、规则取值、逐柱命中与来源声明的覆盖，不表示传统神煞具有现代实证效力或现实预测准确率';
}
export interface ShenshaEvidenceAnalysis {
    key: string;
    status: '已核验';
    context: ShenshaContext;
    requestedIds: string[];
    pillarFacts: ShenshaPillarFact[];
    calculationSteps: ShenshaCalculationStep[];
    calculationChain: string[];
    matchFacts: ShenshaMatchFact[];
    summaryFact: ShenshaSummaryFact;
    limitations: string[];
    limitationFacts: ShenshaLimitationFact[];
    source: string;
    promptText: string;
}
/** 注册神煞（可重复覆盖） */
export declare function registerShensha(def: ShenshaDefinition): void;
/** 批量注册 */
export declare function registerShenshas(defs: ShenshaDefinition[]): void;
/** 列出已注册神煞（可按 scope 过滤） */
export declare function listShensha(scope?: ShenshaScope): ShenshaDefinition[];
/** 列出可安全序列化的神煞目录，不暴露计算函数。 */
export declare function listShenshaCatalog(scope?: ShenshaScope): ShenshaCatalogItem[];
/** 计算指定神煞 */
export declare function computeShensha(ids: string[], ctx: ShenshaContext): ShenshaResult[];
/** 通用命理神煞：空亡、驿马、桃花 */
export declare const COMMON_SHENSHA: ShenshaDefinition[];
/**
 * 严格查询通用神煞结构化证据：核验完整四柱、拒绝未知编号，逐项返回起法、目标、命中柱位、来源与限制。
 * 各术数体系特有神煞仍由各自算法处理，不在此强行统一。
 */
export declare function analyzeShenshaEvidence(ctx: ShenshaContext, ids?: string[]): ShenshaEvidenceAnalysis;
export interface HuangliShensha {
    /** 神煞名 */
    name: string;
    /** 吉凶：吉 / 凶 / 平 */
    luck: string;
}
export interface HuangliInfo {
    /** 当日全部黄历神煞（来自 tyme4ts，共 151 种，按当日命中输出） */
    shensha: HuangliShensha[];
    /** 十二建除（值神） */
    duty: string;
    /** 九星 */
    nineStar: string;
    /** 九星颜色 */
    nineStarColor: string;
}
/** 列出 tyme4ts 内建的全部黄历神煞名（共 151 个），供能力发现/文档用 */
export declare function listHuangliShenshaNames(): string[];
/**
 * 查询指定公历日期的黄历神煞（委托 tyme4ts，权威黄历体系）。
 * 返回的 shensha 含吉凶分类，duty 为十二建除，nineStar 为九星。
 */
export declare function getHuangliShensha(year: number, month: number, day: number): HuangliInfo;
export declare const shensha: {
    registerShensha: typeof registerShensha;
    registerShenshas: typeof registerShenshas;
    listShensha: typeof listShensha;
    listShenshaCatalog: typeof listShenshaCatalog;
    computeShensha: typeof computeShensha;
    analyzeShenshaEvidence: typeof analyzeShenshaEvidence;
    COMMON_SHENSHA: ShenshaDefinition[];
    getHuangliShensha: typeof getHuangliShensha;
    listHuangliShenshaNames: typeof listHuangliShenshaNames;
};
