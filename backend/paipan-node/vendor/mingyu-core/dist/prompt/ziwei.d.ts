import type { AnalysisPayloadV1, ScopeType } from '../types/analysis';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { analyzeZiweiCompatibility } from '../ziwei/iztro/index';
import { type BaziChartResult } from '../bazi/index';
import type { PromptBuildOptions, PromptDocument } from './types';
export declare const ZIWEI_PROMPT_SCOPES: readonly ["origin", "full", "decadal", "yearly", "monthly", "daily", "hourly", "age"];
export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type ZiweiPromptSchool = 'sanhe' | 'feixing' | 'sihua';
export declare const ZIWEI_PROMPT_TOPICS: readonly ["life", "destiny", "relationship", "relationship-push", "relationship-decision", "children", "career-wealth", "job-change", "startup-partnership", "investment-partnership", "recent", "family", "home-move", "settle-relocate", "social", "emotion", "health", "study", "study-advance", "exam-landing", "reconciliation-decision", "growth", "talent", "chat"];
export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];
export declare function formatZiweiPayloadForPrompt(payload: AnalysisPayloadV1, options?: {
    focusPalaceNames?: readonly string[];
    maxEvidence?: number;
}): string;
export declare function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[];
export declare function formatZiweiFullScopeText(runtime: ZiweiRuntime): string;
export interface ZiweiPromptOptions extends PromptBuildOptions {
    runtime: ZiweiRuntime;
    scope?: ZiweiPromptScope;
    school?: ZiweiPromptSchool;
    schools?: readonly ZiweiPromptSchool[];
    topic?: ZiweiPromptTopic;
    focusPalaceNames?: readonly string[];
}
export declare function buildZiweiPromptDocument(options: ZiweiPromptOptions): PromptDocument;
export declare function buildZiweiPrompt(options: ZiweiPromptOptions): string;
export declare const buildZiweiPromptForRuntime: typeof buildZiweiPrompt;
export declare const buildPublicZiweiPromptForRuntime: typeof buildZiweiPrompt;
/** 生成更适合直接交给在线 AI 的紫微主题任务书。 */
export declare function buildZiweiTaskBookPrompt(options: ZiweiPromptOptions): string;
export interface ZiweiCompatibilityPromptOptions extends PromptBuildOptions {
    payload1: AnalysisPayloadV1;
    payload2: AnalysisPayloadV1;
    schools?: readonly ZiweiPromptSchool[];
    compatibility?: ReturnType<typeof analyzeZiweiCompatibility>;
    person1Name?: string;
    person2Name?: string;
    topic?: ZiweiPromptTopic;
}
export declare function buildZiweiCompatibilityPromptDocument(options: ZiweiCompatibilityPromptOptions): PromptDocument;
export declare function buildZiweiCompatibilityPrompt(options: ZiweiCompatibilityPromptOptions): string;
export interface BaziZiweiPromptOptions extends PromptBuildOptions {
    bazi: BaziChartResult;
    ziwei: ZiweiRuntime | AnalysisPayloadV1;
    topic?: string;
    /** 旧版八字单派兼容字段。 */
    school?: import('./bazi').BaziPromptSchool;
    baziSchool?: import('./bazi').BaziPromptSchool;
    baziSchools?: readonly import('./bazi').BaziPromptSchool[];
    ziweiSchool?: ZiweiPromptSchool;
    ziweiSchools?: readonly ZiweiPromptSchool[];
}
/** 组合八字和紫微资料，供需要同时比较两套命理结构的场景使用。 */
export declare function buildBaziZiweiPromptDocument(options: BaziZiweiPromptOptions): PromptDocument;
export declare function buildBaziZiweiPrompt(options: BaziZiweiPromptOptions): string;
export interface SerializableZiweiResult {
    basicInfo: AnalysisPayloadV1['basic_info'];
    calculationConfig: AnalysisPayloadV1['calculation_config'];
    scopeNames: string[];
    payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
    trueSolarEvidence?: ZiweiRuntime['trueSolarEvidence'];
    fourMutagens: Record<string, string>;
    birthMutagens: Record<string, string>;
    gongList: Array<{
        index: number;
        name: string;
        heavenlyStem: string;
        earthlyBranch: string;
        isLifePalace: boolean;
        isBodyPalace: boolean;
        stars: string[];
        majorStars: string[];
        minorStars: string[];
        otherStars: string[];
    }>;
    命宫: string;
    身宫: string;
    五行局: string;
    四化: Record<string, string>;
}
/** 将完整运行结果转换为稳定的 API 兼容结构。 */
export declare function buildSerializableZiweiResult(runtime: ZiweiRuntime): SerializableZiweiResult;
