import type { PromptEvidenceBundle, PromptEvidenceItem } from './types';
export declare function normalizePromptEvidenceItems(items: PromptEvidenceItem[]): PromptEvidenceItem[];
export declare function formatPromptEvidenceItem(item: PromptEvidenceItem): string;
export declare function formatPromptEvidenceBundle(bundle: PromptEvidenceBundle): string[];
