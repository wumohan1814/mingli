import type { TarotData, TarotSpreadType } from '../types/divination';
export interface TarotSpreadPromptFramework {
    mainLine: string;
    connections: string;
    conclusion: string;
}
export declare const TAROT_SPREAD_PROMPT_FRAMEWORKS: Record<TarotSpreadType, TarotSpreadPromptFramework>;
export declare function buildTarotSpreadTask(data: Pick<TarotData, 'spreadType' | 'cards'>): string;
