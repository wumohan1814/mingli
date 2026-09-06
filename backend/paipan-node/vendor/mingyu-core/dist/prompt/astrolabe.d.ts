import type { AstrolabeData, AstrolabeSynastryData } from '../types/divination';
import type { PromptBuildOptions, PromptDocument } from './types';
export declare const ASTROLABE_PROMPT_TOPICS: readonly ["life", "career", "job-change", "startup-partnership", "investment-partnership", "wealth", "relationship", "relationship-push", "relationship-decision", "reconciliation-decision", "marriage", "children", "family", "home-move", "settle-relocate", "social", "emotion", "growth", "talent", "health", "study", "study-advance", "exam-landing", "recent", "chat"];
export type AstrolabePromptTopic = (typeof ASTROLABE_PROMPT_TOPICS)[number];
export declare function formatAstrolabeForPrompt(data: AstrolabeData): string;
export interface AstrolabePromptOptions extends PromptBuildOptions {
    chart: AstrolabeData;
    schools?: readonly string[];
    topic?: AstrolabePromptTopic;
}
export declare function buildAstrolabePromptDocument(options: AstrolabePromptOptions): PromptDocument;
export declare function buildAstrolabePrompt(options: AstrolabePromptOptions): string;
export interface AstrolabeSynastryPromptOptions extends PromptBuildOptions {
    chart1: AstrolabeData;
    chart2: AstrolabeData;
    synastry: AstrolabeSynastryData;
    schools?: readonly string[];
}
export declare function buildAstrolabeSynastryPromptDocument(options: AstrolabeSynastryPromptOptions): PromptDocument;
export declare function buildAstrolabeSynastryPrompt(options: AstrolabeSynastryPromptOptions): string;
