export * from './types';
export * from './labels';
export * from './formatters';
export * from './focus';
export * from './builders';
export * from './snapshot';
export * from './combined';
import type { AnalysisPayloadV1 } from '../../types/analysis';
import type { ZiweiPromptContext, ZiweiPromptSnapshotMode } from './types';
/** 生成可独立复制给在线 AI 的紫微结构化快照。 */
export declare function buildPortablePromptPack(params: {
    payload: AnalysisPayloadV1;
    reportContext: ZiweiPromptContext;
    mode?: ZiweiPromptSnapshotMode;
}): string;
