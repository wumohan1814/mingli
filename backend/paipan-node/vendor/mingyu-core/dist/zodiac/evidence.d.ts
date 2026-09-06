import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import type { ZodiacYearFortune } from './index';
export interface ZodiacRelationEvidence {
    key: string;
    status: '已命中';
    category: '流年同支' | '地支冲突' | '地支助缘' | '地支会合' | '年干五行';
    relation: string;
    source: string;
    sources: string[];
    role: '主证' | '辅证';
    detail: string;
    operands: Array<{
        label: string;
        value: string;
        wuxing?: string;
    }>;
    rule: string;
    promptText: string;
    limitation: '生肖年支与流年干支关系只证明传统关系表或五行生克条件命中；不证明现实事件、个人命运、他人行为、吉凶概率、固定应期或化解效果';
}
export interface ZodiacCalculationStep {
    key: string;
    stage: '生肖年支' | '流年拆分' | '地支关系核验' | '年干五行辅助';
    status: '已计算';
    inputs: Record<string, string | number>;
    result: Record<string, string | number>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '生肖计算链只证明生肖、流年干支、固定地支关系与五行辅助关系如何形成当前轻量结果，不证明个人现实事件、完整命理结构、吉凶概率、固定应期或化解效果';
}
export interface ZodiacCounterEvidenceFact {
    key: string;
    type: '太岁关系覆盖' | '三合六合三会覆盖' | '生肖信息量';
    status: '有可用证据' | '未命中' | '固有限制';
    ownerRelationKeys: string[];
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录值、冲、刑、害、破、六合、三合、三会是否命中以及生肖模型固有的信息量限制；未命中不代表现实有利或不利，命中也不证明事件结果';
}
export interface ZodiacCounterSummaryFact {
    key: 'zodiac:counter-summary';
    status: '有未命中关系' | '关系均有命中';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只说明传统关系表的命中覆盖情况；不得据命中数量生成吉凶总分、成功率、灾祸概率、固定应期或化解效果';
}
export interface ZodiacLimitationFact {
    key: string;
    type: '信息量边界' | '关系表边界' | '五行辅助边界' | '高风险输出边界' | '现实建议边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束生肖年支、流年干支关系和五行辅助可以支持的解释范围，不得被反向当作个人事件、吉凶概率或化解有效性的证据';
}
export interface ZodiacEvidenceAnalysis {
    key: 'zodiac:evidence';
    status: '已计算';
    calculationSteps: ZodiacCalculationStep[];
    calculationChain: string[];
    relations: ZodiacRelationEvidence[];
    primaryEvidence: ZodiacRelationEvidence[];
    supportingEvidence: ZodiacRelationEvidence[];
    counterEvidence: string[];
    counterEvidenceFacts: ZodiacCounterEvidenceFact[];
    counterSummaryFact: ZodiacCounterSummaryFact;
    limitations: string[];
    limitationFacts: ZodiacLimitationFact[];
    summaryFact: ZodiacSummaryFact;
    sources: Array<{
        title: string;
        evidence: string;
        role: '传统关系表' | '公共算法';
    }>;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export interface ZodiacSummaryFact {
    key: 'zodiac:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    relationFactCount: number;
    primaryEvidenceCount: number;
    supportingEvidenceCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '生肖证据汇总只统计生肖年支、流年干支、关系表、五行辅助、反证与限制覆盖；不得按数量生成个人吉凶等级、成功率、灾祸概率、固定应期或化解效果保证';
}
export declare function analyzeZodiacEvidence(data: Omit<ZodiacYearFortune, 'evidenceAnalysis' | 'prompt'>): ZodiacEvidenceAnalysis;
