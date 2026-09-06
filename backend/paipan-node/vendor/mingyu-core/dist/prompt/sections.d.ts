import type { PromptDocument } from './types';
export declare function buildPromptSection(title: string, content: string): string;
export declare function joinPromptSections(sections: Array<string | null | undefined>): string;
export declare function buildPromptDocument(user: string, system?: string): PromptDocument;
export declare function formatStringList(values: readonly string[] | undefined, fallback?: string): string;
export declare function formatEvidencePromptText(data: unknown): string;
