import type { DivinationMethodId } from '../divination/config';
import type { DivinationData, LiuyaoTemplateType, LiurenTemplateType, SupplementaryInfo } from '../types/divination';
import type { AstrolabePromptTopic } from './astrolabe';
import type { PromptBuildOptions, PromptDocument } from './types';
export interface DivinationSummaryBlocks {
    title: string;
    tags: string[];
    lines: string[];
}
type SupportedDivinationMethod = Exclude<DivinationMethodId, 'random'>;
export declare function getDivinationSummaryBlocks(method: SupportedDivinationMethod, data: DivinationData): DivinationSummaryBlocks;
/** 格式化占课时间；无时间戳时使用当前时间，显式无效时间戳直接报错。 */
export declare function formatDivinationTime(data?: DivinationData): string;
/** 只返回占课当地民用公历时间，适合星盘等需要单独展示出生时间的场景。 */
export declare function formatDivinationSolarTime(data?: DivinationData): string;
export declare function formatDivinationInfo(method: SupportedDivinationMethod, data: DivinationData, question?: string, supplementaryInfo?: SupplementaryInfo, options?: {
    liuyaoTemplate?: LiuyaoTemplateType;
}): string;
export declare function formatSupplementaryInfo(info?: SupplementaryInfo, method?: SupportedDivinationMethod): string;
export interface DivinationPromptOptions extends PromptBuildOptions {
    method: SupportedDivinationMethod;
    data: DivinationData;
    supplementaryInfo?: SupplementaryInfo;
    isCustomQuestion?: boolean;
    liuyaoTemplate?: LiuyaoTemplateType;
    liurenTemplate?: LiurenTemplateType;
    astrolabeTopic?: AstrolabePromptTopic;
    astrolabeScopeText?: string;
    schools?: readonly string[];
}
export declare function buildDivinationPromptDocument(options: DivinationPromptOptions): PromptDocument;
export declare function buildDivinationPrompt(options: DivinationPromptOptions): string;
export {};
