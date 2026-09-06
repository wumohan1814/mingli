import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { BaziChartResult } from './baziTypes';
declare const CALCULATION_STEP_LIMITATION: "\u516B\u5B57\u672C\u547D\u8BA1\u7B97\u6B65\u9AA4\u53EA\u8BC1\u660E\u51FA\u751F\u65F6\u95F4\u53E3\u5F84\u3001\u56DB\u67F1\u3001\u85CF\u5E72\u5341\u795E\u3001\u8282\u4EE4\u65FA\u8870\u3001\u683C\u5C40\u4E0E\u53D6\u7528\u5982\u4F55\u5F62\u6210\u5F53\u524D\u7ED3\u6784\u5316\u7ED3\u679C\uFF1B\u4E0D\u5F97\u628A\u6B65\u9AA4\u5B8C\u6574\u5EA6\u89E3\u91CA\u4E3A\u547D\u8FD0\u53EF\u4FE1\u5EA6\u3001\u5409\u51F6\u5206\u6570\u3001\u4E8B\u4EF6\u6982\u7387\u6216\u56FA\u5B9A\u5E94\u671F";
declare const PILLAR_FACT_LIMITATION: "\u56DB\u67F1\u4E8B\u5B9E\u53EA\u8BB0\u5F55\u5E72\u652F\u3001\u5341\u795E\u3001\u85CF\u5E72\u3001\u7EB3\u97F3\u3001\u5341\u4E8C\u8FD0\u3001\u81EA\u5750\u4E0E\u65EC\u7A7A\u7B49\u4F20\u7EDF\u76D8\u9762\u8D44\u6599\uFF1B\u4E0D\u5F97\u7531\u5355\u67F1\u76F4\u63A5\u63A8\u51FA\u6027\u683C\u3001\u516D\u4EB2\u3001\u5065\u5EB7\u3001\u8D22\u5BCC\u6216\u4E8B\u4EF6\u7ED3\u679C";
declare const ANALYSIS_FACT_LIMITATION: "\u65FA\u8870\u3001\u683C\u5C40\u4E0E\u53D6\u7528\u4E8B\u5B9E\u53EA\u8BB0\u5F55\u5F53\u524D\u89C4\u5219\u94FE\u7684\u5206\u7C7B\u7ED3\u679C\u548C\u4F9D\u636E\uFF1B\u4E0D\u540C\u4F20\u7EDF\u6D41\u6D3E\u53EF\u80FD\u91C7\u7528\u4E0D\u540C\u6743\u91CD\u4E0E\u6B21\u5E8F\uFF0C\u4E0D\u5F97\u8F6C\u5199\u4E3A\u7EDD\u5BF9\u547D\u683C\u3001\u6210\u529F\u7387\u3001\u75BE\u75C5\u5224\u65AD\u6216\u73B0\u5B9E\u4FDD\u8BC1";
declare const RELATION_FACT_LIMITATION: "\u4F0F\u541F\u3001\u53CD\u541F\u53CA\u5408\u51B2\u5211\u5BB3\u7834\u53EA\u8BC1\u660E\u539F\u5C40\u67F1\u95F4\u5B58\u5728\u5BF9\u5E94\u5E72\u652F\u7ED3\u6784\uFF1B\u4E0D\u76F4\u63A5\u8BC1\u660E\u73B0\u5B9E\u4E8B\u4EF6\u6027\u8D28\u3001\u53D1\u751F\u65F6\u95F4\u3001\u4EBA\u7269\u610F\u56FE\u6216\u5409\u51F6\u7ED3\u679C";
declare const COUNTER_FACT_LIMITATION: "\u516B\u5B57\u672C\u547D\u53CD\u8BC1\u53EA\u8BB0\u5F55\u56DB\u67F1\u4E0E\u6838\u5FC3\u5206\u6790\u8D44\u6599\u662F\u5426\u5B8C\u6574\u3001\u67F1\u95F4\u4E3B\u8981\u5173\u7CFB\u662F\u5426\u547D\u4E2D\u4EE5\u53CA\u6392\u76D8\u8FB9\u754C\u662F\u5426\u6709\u63D0\u793A\uFF1B\u672A\u547D\u4E2D\u4E0D\u4EE3\u8868\u73B0\u5B9E\u6709\u5229\u6216\u4E0D\u5229\uFF0C\u8D44\u6599\u5B8C\u6574\u4E5F\u4E0D\u8BC1\u660E\u7ED3\u8BBA\u5FC5\u7136\u6210\u7ACB";
declare const SUMMARY_FACT_LIMITATION: "\u516B\u5B57\u672C\u547D\u8BC1\u636E\u6C47\u603B\u53EA\u7EDF\u8BA1\u8BA1\u7B97\u6B65\u9AA4\u3001\u56DB\u67F1\u3001\u65FA\u8870\u683C\u5C40\u53D6\u7528\u3001\u67F1\u95F4\u5173\u7CFB\u3001\u6392\u76D8\u8FB9\u754C\u4E0E\u9650\u5236\u8986\u76D6\uFF1B\u4E0D\u5F97\u6309\u6570\u91CF\u751F\u6210\u547D\u76D8\u603B\u5206\u3001\u53EF\u4FE1\u5EA6\u3001\u5409\u51F6\u6982\u7387\u3001\u75BE\u75C5\u6982\u7387\u3001\u8D22\u5BCC\u5E45\u5EA6\u6216\u552F\u4E00\u5E94\u671F";
declare const LIMITATION_FACT_LIMITATION: "\u516B\u5B57\u672C\u547D\u9650\u5236\u4E8B\u5B9E\u7528\u4E8E\u7EA6\u675F\u56DB\u67F1\u3001\u65FA\u8870\u3001\u683C\u5C40\u3001\u53D6\u7528\u3001\u795E\u715E\u4E0E\u67F1\u95F4\u5173\u7CFB\u53EF\u4EE5\u652F\u6301\u7684\u89E3\u91CA\u8303\u56F4\uFF0C\u4E0D\u5F97\u88AB\u53CD\u5411\u5F53\u4F5C\u73B0\u5B9E\u56E0\u679C\u3001\u4EBA\u7269\u547D\u8FD0\u3001\u6982\u7387\u6216\u4FDD\u8BC1\u6709\u6548\u5EFA\u8BAE\u7684\u8BC1\u636E";
export interface BaziNatalCalculationStep {
    key: string;
    stage: '出生时间定盘' | '四柱生成' | '派生资料计算' | '核心判断形成' | '证据汇总';
    status: '已计算' | '存在资料缺口';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof CALCULATION_STEP_LIMITATION;
}
export interface BaziNatalPillarFact {
    key: string;
    status: '已记录' | '资料缺口';
    pillar: '年柱' | '月柱' | '日柱' | '时柱';
    gan: string;
    zhi: string;
    ganZhi: string;
    tenGod: string;
    hiddenStems: string[];
    hiddenTenGods: string[];
    nayin: string;
    pillarLifeStage: string;
    dayMasterLifeStage: string;
    ziZuo: string;
    kongWang: string[];
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof PILLAR_FACT_LIMITATION;
}
export interface BaziNatalAnalysisFact {
    key: string;
    status: '已记录' | '资料缺口';
    type: '日主旺衰' | '格局' | '用神取忌';
    result: string;
    basis: string[];
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof ANALYSIS_FACT_LIMITATION;
}
export interface BaziNatalRelationFact {
    key: string;
    status: '已命中';
    type: '伏吟' | '反吟' | '刑冲合害破';
    relation: string;
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof RELATION_FACT_LIMITATION;
}
export interface BaziNatalCounterEvidenceFact {
    key: string;
    type: '四柱资料覆盖' | '核心分析覆盖' | '柱间关系覆盖' | '排盘边界覆盖';
    status: '有可用证据' | '资料不足' | '未命中主要关系' | '无边界提示' | '存在边界提示';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof COUNTER_FACT_LIMITATION;
}
export interface BaziNatalCounterSummaryFact {
    key: 'bazi:natal:counter-summary';
    status: '存在需保留反证' | '未见额外反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '八字本命反证汇总只用于防止把资料缺口、未命中关系或排盘边界静默忽略；不得据反证数量生成吉凶分、可信度、事件概率或调整结论';
}
export interface BaziNatalLimitationFact {
    key: string;
    type: '出生时间边界' | '传统模型边界' | '旺衰格局取用边界' | '神煞与单项关系边界' | '本命应期边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: typeof LIMITATION_FACT_LIMITATION;
}
export interface BaziNatalSummaryFact {
    key: 'bazi:natal:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    calculationStepCount: number;
    pillarFactCount: number;
    analysisFactCount: number;
    relationFactCount: number;
    warningFactCount: number;
    missingFactCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: typeof SUMMARY_FACT_LIMITATION;
}
export interface BaziNatalEvidenceAnalysis {
    key: 'bazi:natal:evidence';
    status: '已计算' | '存在资料缺口';
    calculationSteps: BaziNatalCalculationStep[];
    calculationChain: string[];
    pillarFacts: BaziNatalPillarFact[];
    analysisFacts: BaziNatalAnalysisFact[];
    relationFacts: BaziNatalRelationFact[];
    primaryFacts: string[];
    supportingFacts: string[];
    counterEvidence: string[];
    counterEvidenceFacts: BaziNatalCounterEvidenceFact[];
    counterSummaryFact: BaziNatalCounterSummaryFact;
    limitations: string[];
    limitationFacts: BaziNatalLimitationFact[];
    summaryFact: BaziNatalSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export declare function analyzeBaziNatalEvidence(data: BaziChartResult): BaziNatalEvidenceAnalysis;
export {};
