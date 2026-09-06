import type { BaziChartResult } from './baziTypes';
export type PromptChartScene = 'general' | 'fortune' | 'compatibility' | 'comprehensive' | 'concise';
export declare function formatBaziForPrompt(baziResult: BaziChartResult, 
/** @deprecated 兼容旧调用签名，具体岁运应通过 FortuneSelectionContext 传入。 */
_selectedOption?: unknown, scene?: PromptChartScene): string;
