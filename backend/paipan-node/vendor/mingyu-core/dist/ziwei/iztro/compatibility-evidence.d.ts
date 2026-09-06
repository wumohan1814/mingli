import type { PromptEvidenceBundle } from '../../prompt-evidence/types';
import type { AnalysisPayloadV1, MutagenName } from '../../types/analysis';
import type { IztroAstrolabe } from '../../types/iztro';
export interface ZiweiCompatibilityOptions {
    person1Name?: string;
    person2Name?: string;
    astrolabe1?: IztroAstrolabe;
    astrolabe2?: IztroAstrolabe;
}
export interface ZiweiPalaceOverlay {
    key: string;
    status: '已命中';
    sourcePerson: 'person1' | 'person2';
    targetPerson: 'person1' | 'person2';
    sourcePalace: string;
    earthlyBranch: string;
    targetPalace: string;
    sourceMajorStars: string[];
    targetMajorStars: string[];
    sourcePalaceKey: string;
    targetPalaceKey: string;
    calculationStepKey: 'ziwei:compatibility:calculation:palace-overlays';
    sources: string[];
    calculation: string;
    promptText: string;
    limitation: '宫位叠盘只证明双方宫位位于同一地支轴位；不单独证明关系吉凶、适配程度、他人意图、现实事件或长期结果';
}
export interface ZiweiCrossMutagenPlacement {
    key: string;
    status: '已命中';
    sourcePerson: 'person1' | 'person2';
    targetPerson: 'person1' | 'person2';
    star: string;
    mutagen: MutagenName;
    sourcePalace: string;
    targetPalace: string;
    targetEarthlyBranch: string;
    sourcePalaceKey: string;
    targetPalaceKey: string;
    calculationStepKey: 'ziwei:compatibility:calculation:cross-mutagens';
    sources: string[];
    calculation: string;
    promptText: string;
    limitation: '跨盘四化只证明一方生年四化星曜与对方同名星曜落宫之间的定位链路；化禄、权、科、忌均不直接等于关系吉凶、事件结果、匹配程度或应期';
}
export interface ZiweiCompatibilityCalculationStep {
    key: string;
    stage: '双盘输入校验' | '十二宫地支索引' | '关键宫位叠盘' | '同名星曜索引' | '跨盘生年四化' | '证据汇总';
    status: '已计算';
    inputs: Record<string, string | number | boolean | string[]>;
    result: Record<string, string | number | boolean | string[]>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '计算步骤只证明双方本命十二宫、地支轴位与生年四化星曜经过固定定位规则形成当前交叉事实，不证明现实关系、匹配程度、事件结果、发生概率或固定应期';
}
export interface ZiweiCompatibilityCounterEvidenceFact {
    key: string;
    type: '关键宫位叠盘覆盖' | '跨盘四化覆盖' | '静态应期边界';
    status: '有可用证据' | '未命中' | '固有限制';
    direction?: 'person1-to-person2' | 'person2-to-person1';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录关键宫位叠盘、跨盘四化是否形成以及静态本命双盘的应期限制；未命中不等于关系有利或不利，命中也不证明现实结果';
}
export interface ZiweiCompatibilitySummaryFact {
    key: 'ziwei:compatibility:evidence-summary';
    status: '宫位与四化均有交叉' | '仅见宫位叠盘' | '未见已列交叉事实';
    factKeys: string[];
    palaceOverlayCount: number;
    importantPalaceOverlayCount: number;
    crossMutagenPlacementCount: number;
    mutagenCounts: Partial<Record<MutagenName, number>>;
    uncoveredMutagenDirections: Array<'person1-to-person2' | 'person2-to-person1'>;
    promptText: string;
    sources: string[];
    limitation: '双盘证据汇总只统计宫位叠盘与跨盘生年四化定位事实，不得按数量生成匹配分、关系概率、事件概率、吉凶结论或唯一应期';
}
export interface ZiweiCompatibilityLimitationFact {
    key: string;
    type: '宫位因果边界' | '四化语义边界' | '静态应期边界' | '资料范围边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束宫位叠盘与跨盘生年四化能够支持的解释范围，不得被反向当作现实关系结果、他人意图、吉凶概率或保证有效建议的证据';
}
export interface ZiweiCompatibilityEvidenceResult {
    key: 'ziwei:compatibility:evidence';
    status: '已计算';
    people: {
        person1: string;
        person2: string;
    };
    calculationSteps: ZiweiCompatibilityCalculationStep[];
    calculationChain: string[];
    palaceOverlays: ZiweiPalaceOverlay[];
    crossMutagenPlacements: ZiweiCrossMutagenPlacement[];
    counterEvidence: string[];
    counterEvidenceFacts: ZiweiCompatibilityCounterEvidenceFact[];
    summaryFact: ZiweiCompatibilitySummaryFact;
    limitations: string[];
    limitationFacts: ZiweiCompatibilityLimitationFact[];
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: {
        notes: string[];
    };
}
export declare function analyzeZiweiCompatibility(payload1: AnalysisPayloadV1, payload2: AnalysisPayloadV1, options?: ZiweiCompatibilityOptions): ZiweiCompatibilityEvidenceResult;
