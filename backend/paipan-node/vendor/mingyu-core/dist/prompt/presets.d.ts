import type { AstrolabePromptTopic } from './astrolabe';
import type { BaziCompatibilityType, BaziPromptTopic } from './bazi';
export interface BaziPromptPreset {
    id: string;
    prompt: string;
    scopeLabel: string;
    topic: BaziPromptTopic;
}
export interface BaziCompatibilityPromptPreset {
    id: string;
    prompt: string;
    scopeLabel: string;
    compatibilityType: BaziCompatibilityType;
}
export declare const BAZI_PROMPT_PRESETS: readonly BaziPromptPreset[];
export declare const BAZI_COMPATIBILITY_PROMPT_PRESETS: readonly BaziCompatibilityPromptPreset[];
export interface AstrolabePromptShortcut {
    label: string;
    topic: AstrolabePromptTopic;
}
export declare const ASTROLABE_PROMPT_SHORTCUTS: readonly AstrolabePromptShortcut[];
export declare function getBaziPromptPreset(id: string): BaziPromptPreset | undefined;
export declare function getBaziCompatibilityPromptPreset(id: string): BaziCompatibilityPromptPreset | undefined;
export declare function getAstrolabePromptShortcut(label: string): AstrolabePromptShortcut | undefined;
