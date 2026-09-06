import type { AnalysisPayloadV1 } from '../../types/analysis';
import type { ZiweiFocusTaskBundle, ZiweiPromptContext } from './types';
/** 根据专题、报告类型和当前运限选择需要优先放入提示词的宫位。 */
export declare function buildFocusTaskBundle(payload: AnalysisPayloadV1, reportContext: ZiweiPromptContext): ZiweiFocusTaskBundle;
