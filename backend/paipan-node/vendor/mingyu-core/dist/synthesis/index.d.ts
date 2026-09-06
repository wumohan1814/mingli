import type { BaziChartResult } from '../bazi/baziTypes';
import { type BirthChartBundle } from '../birth';
import type { BirthProfile } from '../profile';
import type { ScopeType } from '../types/analysis';
import type { ZiweiRuntime, ZiweiRuntimeOptions } from '../ziwei/runtime';
import { evaluateBaziZiweiCorroboration, evaluateShaYaoCorroboration, evaluateGuiRenCorroboration, type BaziZiweiCorroborationResult, type ShaYaoCorroborationResult, type GuiRenCorroborationResult } from './corroboration';
export { evaluateBaziZiweiCorroboration, evaluateShaYaoCorroboration, evaluateGuiRenCorroboration, type BaziZiweiCorroborationResult, type ShaYaoCorroborationResult, type GuiRenCorroborationResult, };
export type BaziZiweiSynthesisThemeId = 'overview' | 'character' | 'career' | 'wealth' | 'relationships' | 'family' | 'wellbeing' | 'mobility' | 'inner-world' | 'timing';
export type SynthesisEvidenceSystem = 'bazi' | 'ziwei';
export interface SynthesisEvidenceFact {
    key: string;
    system: SynthesisEvidenceSystem;
    scope: 'natal' | ScopeType;
    title: string;
    detail: string;
    sourceKeys: string[];
}
export interface BaziZiweiSynthesisTheme {
    id: BaziZiweiSynthesisThemeId;
    label: string;
    focus: string;
    baziEvidence: SynthesisEvidenceFact[];
    ziweiEvidence: SynthesisEvidenceFact[];
}
export interface BaziZiweiSynthesis {
    key: 'bazi-ziwei:synthesis';
    status: '资料完整' | '资料有缺口';
    subjectName?: string;
    themes: BaziZiweiSynthesisTheme[];
    evidenceCount: {
        bazi: number;
        ziwei: number;
    };
    timingReference: BaziZiweiTimingReference;
    corroboration?: BaziZiweiCorroborationResult;
    missingFacts: string[];
    methodology: string[];
}
export interface BaziZiweiTimingReference {
    dateStr: string;
    year: number;
    hourIndex: number;
    shichen: string;
}
/** 将同一命主的八字与紫微盘组织为逐主题、可追溯的合参资料。 */
export declare function buildBaziZiweiSynthesis(params: {
    bazi: BaziChartResult;
    ziwei: ZiweiRuntime;
    subjectName?: string;
}): BaziZiweiSynthesis;
export interface FormatBaziZiweiSynthesisOptions {
    question?: string;
    detailLevel?: 'concise' | 'standard' | 'professional';
}
/** 生成可直接交给 AI 的八字紫微合参任务书。 */
export declare function formatBaziZiweiSynthesisForPrompt(synthesis: BaziZiweiSynthesis, options?: FormatBaziZiweiSynthesisOptions): string;
export interface BaziZiweiCombinedReadingOptions {
    ziwei?: ZiweiRuntimeOptions;
    prompt?: FormatBaziZiweiSynthesisOptions;
}
export interface BaziZiweiCombinedReading {
    bundle: BirthChartBundle;
    synthesis: BaziZiweiSynthesis;
    promptText: string;
}
/** 从一份统一出生档案直接生成八字、紫微和合参任务书。 */
export declare function calculateBaziZiweiCombinedReading(profile: BirthProfile, options?: BaziZiweiCombinedReadingOptions): Promise<BaziZiweiCombinedReading>;
