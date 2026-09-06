import { type BaziChartResult } from '../bazi/index';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import type { PromptBuildOptions, PromptDocument } from './types';
import { type BaziPromptSchool as SharedBaziPromptSchool } from './bazi-school';
export declare const BAZI_PROMPT_TOPICS: readonly ["general", "recent", "career", "job-change", "startup-partnership", "investment-partnership", "wealth", "marriage", "relationship", "relationship-push", "relationship-decision", "reconciliation-decision", "children", "family", "home-move", "settle-relocate", "social", "emotion", "health", "parents", "study", "study-advance", "exam-landing", "growth", "talent"];
export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type BaziPromptMode = 'framework' | 'custom';
export type BaziPromptSchool = SharedBaziPromptSchool;
export type BaziPromptFortuneScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';
export interface BaziPromptOptions extends PromptBuildOptions {
    result: BaziChartResult;
    topic?: BaziPromptTopic;
    mode?: BaziPromptMode;
    school?: BaziPromptSchool;
    schools?: readonly BaziPromptSchool[];
    fortuneScope?: BaziPromptFortuneScope;
    fortuneFocus?: string;
    /**
     * 页面、服务端或其他调用方已选中的具体岁运资料。
     * 传入后只把所选层级、必要上下层背景与主要触发写入提示词。
     */
    fortuneSelectionContext?: FortuneSelectionContext | null;
}
export declare function buildBaziPromptDocument(options: BaziPromptOptions): PromptDocument;
export declare function buildBaziPrompt(options: BaziPromptOptions): string;
export declare const buildBaziPromptForResult: typeof buildBaziPrompt;
export type BaziCompatibilityType = 'marriage' | 'career' | 'friendship' | 'children' | 'parents' | 'siblings';
export interface BaziCompatibilityPromptOptions extends PromptBuildOptions {
    result1: BaziChartResult;
    result2: BaziChartResult;
    schools?: readonly BaziPromptSchool[];
    compatibilityType?: BaziCompatibilityType;
    person1Name?: string;
    person2Name?: string;
}
export declare function buildBaziCompatibilityPromptDocument(options: BaziCompatibilityPromptOptions): PromptDocument;
export declare function buildBaziCompatibilityPrompt(options: BaziCompatibilityPromptOptions): string;
export declare const getCompatibilityPrompt: typeof buildBaziCompatibilityPrompt;
