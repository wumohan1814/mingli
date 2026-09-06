/**
 * @file 命语公共地基工具箱
 * @description 统一导出干支、五行、方位与通用神煞能力，供核心包、API 和 MCP 复用。
 */
import { describeGanZhi, getBranchRelations, getStemRelations } from '../ganzhi';
import { analyzeWuxing } from '../wuxing';
import { analyzeCompassDirection } from '../direction';
import { analyzeShenshaEvidence } from '../shensha';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
export type FoundationModuleId = 'calendar' | 'ganzhi' | 'wuxing' | 'direction' | 'shensha';
export interface FoundationCapabilityFact {
    key: `foundation:capability:${FoundationModuleId}`;
    status: '结构化证据可用' | '目录资料可用';
    module: FoundationModuleId;
    name: string;
    provides: string[];
    evidenceOutputs: string[];
    sources: string[];
    promptText: string;
    limitation: string;
}
export interface FoundationCapabilitySummaryFact {
    key: 'foundation:capabilities:summary';
    status: '目录完整';
    factKeys: FoundationCapabilityFact['key'][];
    moduleFactCount: number;
    evidenceReadyModuleCount: number;
    catalogOnlyModuleCount: number;
    constantGroupCount: number;
    commonShenshaCount: number;
    promptText: string;
    sources: string[];
    limitation: string;
}
export interface FoundationCapabilityLimitationFact {
    key: 'foundation:capabilities:limitation:catalog' | 'foundation:capabilities:limitation:traditional-model' | 'foundation:capabilities:limitation:shensha-context' | 'foundation:capabilities:limitation:high-risk-output';
    status: '适用';
    type: '目录边界' | '传统模型边界' | '神煞边界' | '高风险输出边界';
    ownerFactKeys: Array<FoundationCapabilityFact['key'] | FoundationCapabilitySummaryFact['key']>;
    promptText: string;
    sources: string[];
    limitation: string;
}
export interface FoundationCapabilities {
    key: 'foundation:capabilities';
    status: '已登记';
    version: string;
    singleSourceModules: FoundationModuleId[];
    evidenceOutputs: Record<FoundationModuleId, string[]>;
    capabilityFacts: FoundationCapabilityFact[];
    summaryFact: FoundationCapabilitySummaryFact;
    limitationFacts: FoundationCapabilityLimitationFact[];
    limitations: string[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    constants: {
        heavenlyStems: string[];
        earthlyBranches: string[];
        zodiacs: string[];
        sixtyCycle: string[];
        sixXunHeads: string[];
        changshengOrder: string[];
        wuxing: string[];
        bagua: string[];
        twentyFourMountains: string[];
        shichenPeriods: Array<{
            index: number;
            branch: string;
            name: string;
            range: string;
            hour: number;
        }>;
        chinaDstYears: number[];
    };
    commonShensha: Array<{
        id: string;
        name: string;
        scope: string;
        evidenceStatus: '来源已声明' | '来源未声明';
        inputDependencies: string[];
        ruleText: string;
        sources: string[];
    }>;
}
/** 获取可复用底层能力目录。 */
export declare function getFoundationCapabilities(): FoundationCapabilities;
export declare const foundation: {
    getFoundationCapabilities: typeof getFoundationCapabilities;
    describeGanZhi: typeof describeGanZhi;
    getStemRelations: typeof getStemRelations;
    getBranchRelations: typeof getBranchRelations;
    analyzeWuxing: typeof analyzeWuxing;
    analyzeCompassDirection: typeof analyzeCompassDirection;
    analyzeShenshaEvidence: typeof analyzeShenshaEvidence;
};
export { describeGanZhi, getStemRelations, getBranchRelations } from '../ganzhi';
export { analyzeWuxing } from '../wuxing';
export { analyzeCompassDirection } from '../direction';
export { analyzeShenshaEvidence } from '../shensha';
