/**
 * 公开 HTTP API、MCP 与旧前端调用共同使用的紧凑提示词兼容层。
 *
 * 新的通用集成优先使用 `mingyu-core/prompt` 中返回完整任务书的构建器；本文件
 * 保留既有参数和输出结构，避免现有公开接口在迁移时改变提示词契约。
 */
import type { ScopeType } from '../types/analysis';
import { type BaziChartResult, type FortuneSelectionContext } from '../bazi';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { buildSerializableZiweiResult } from './ziwei';
import { buildBaziSchoolPromptSection, buildBaziSchoolsPromptSection, getBaziSchoolGuidance, type BaziPromptSchool } from './bazi-school';
export declare const BAZI_PROMPT_TOPICS: readonly ["general", "recent", "career", "job-change", "startup-partnership", "investment-partnership", "wealth", "marriage", "relationship-push", "relationship-decision", "reconciliation-decision", "children", "family", "home-move", "settle-relocate", "social", "emotion", "health", "parents", "study", "study-advance", "exam-landing", "growth", "talent"];
export declare const ZIWEI_PROMPT_TOPICS: readonly ["destiny", "relationship", "relationship-push", "relationship-decision", "children", "career-wealth", "job-change", "startup-partnership", "investment-partnership", "recent", "family", "home-move", "settle-relocate", "social", "emotion", "health", "study", "study-advance", "exam-landing", "growth", "talent", "reconciliation-decision", "life", "chat"];
export declare const ZIWEI_PROMPT_SCOPES: readonly ["origin", "full", "decadal", "yearly", "monthly", "daily", "hourly", "age"];
export declare const PROMPT_MODES: readonly ["framework", "custom"];
export declare const BAZI_FORTUNE_SCOPES: readonly ["natal", "full", "dayun", "year", "month", "day"];
export declare const BAZI_SCHOOLS: readonly ["traditional", "ziping", "mangpai", "xinpai"];
export declare const BAZI_MULTI_SCHOOLS: readonly ["ziping", "mangpai", "xinpai"];
export declare const ZIWEI_SCHOOLS: readonly ["sanhe", "feixing", "sihua"];
export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];
export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type PromptMode = (typeof PROMPT_MODES)[number];
export type PublicBaziFortuneScope = (typeof BAZI_FORTUNE_SCOPES)[number];
export type BaziSchool = BaziPromptSchool;
export type ZiweiSchool = (typeof ZIWEI_SCHOOLS)[number];
export { buildBaziSchoolPromptSection, buildBaziSchoolsPromptSection, getBaziSchoolGuidance };
export declare function getZiweiSchoolGuidance(school?: ZiweiSchool): string;
export declare function buildBaziPromptForResult(params: {
    result: BaziChartResult;
    question?: string;
    topic?: BaziPromptTopic;
    mode?: PromptMode;
    school?: BaziSchool;
    schools?: readonly BaziSchool[];
    fortuneSelectionContext?: FortuneSelectionContext | null;
    fortuneScope?: PublicBaziFortuneScope;
}): string;
export { buildSerializableZiweiResult };
export declare function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[];
export declare function formatPublicZiweiFullScopeText(result: ZiweiRuntime): string;
export declare function formatZiweiEvidenceText(result: ZiweiRuntime, scope?: ZiweiPromptScope): string;
export declare function buildPublicZiweiPromptForRuntime(params: {
    result: ZiweiRuntime;
    question?: string;
    topic?: ZiweiPromptTopic;
    scope?: ZiweiPromptScope;
    mode?: PromptMode;
    school?: ZiweiSchool;
    schools?: readonly ZiweiSchool[];
}): string;
export declare const buildZiweiPromptForRuntime: typeof buildPublicZiweiPromptForRuntime;
export declare function buildBaziZiweiPromptForResults(params: {
    baziResult: BaziChartResult;
    ziweiResult: ZiweiRuntime;
    question: string;
    baziTopic?: BaziPromptTopic;
    ziweiTopic?: ZiweiPromptTopic;
    ziweiScope?: ZiweiPromptScope;
    mode?: PromptMode;
    baziSchool?: BaziSchool;
    baziSchools?: readonly BaziSchool[];
    ziweiSchool?: ZiweiSchool;
    ziweiSchools?: readonly ZiweiSchool[];
    fortuneSelectionContext?: FortuneSelectionContext | null;
}): string;
export declare function buildCombinedPromptText(system: string, user: string): string;
export { THEMATIC_TOPICS, THEMATIC_TOPIC_CONFIGS, normalizeThematicTopic, getThematicTopicConfig, buildThematicConsultationPrompt, type ThematicTopic, type ThematicTopicConfig, type ThematicConsultationOptions, type ThematicConsultationResult, } from './thematic';
