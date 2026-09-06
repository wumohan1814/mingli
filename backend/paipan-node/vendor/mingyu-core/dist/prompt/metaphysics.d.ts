import type { PromptBuildOptions, PromptDocument } from './types';
export declare const METAPHYSICS_PROMPT_METHODS: readonly ["bazhai", "residential", "zodiac", "taiyi", "qizheng", "xuankong"];
export type MetaphysicsPromptMethod = (typeof METAPHYSICS_PROMPT_METHODS)[number];
export interface MetaphysicsPromptOptions extends PromptBuildOptions {
    method: MetaphysicsPromptMethod;
    measurement?: string;
    schools?: readonly string[];
}
/**
 * 将已经由算法生成的元学排盘正文包装成可直接交给在线 AI 的完整任务书。
 * 排盘算法和应用层的输入表单保持分离，调用方只需传入算法返回的正文。
 */
export declare function buildMetaphysicsPromptDocument(basePrompt: string, question: string | undefined, options: MetaphysicsPromptOptions): PromptDocument;
export declare function buildMetaphysicsPrompt(basePrompt: string, question: string | undefined, options: MetaphysicsPromptOptions): string;
