export * from './types.js';
export * from './labels.js';
export * from './formatters.js';
export * from './focus.js';
export * from './builders.js';
export * from './snapshot.js';
export * from './combined.js';
import { buildZiweiReadableSnapshot, buildZiweiTaskBookSnapshot } from './snapshot.js';
/** 生成可独立复制给在线 AI 的紫微结构化快照。 */
export function buildPortablePromptPack(params) {
    const builder = params.mode === 'task-book' ? buildZiweiTaskBookSnapshot : buildZiweiReadableSnapshot;
    return builder({ payload: params.payload, reportContext: params.reportContext });
}
