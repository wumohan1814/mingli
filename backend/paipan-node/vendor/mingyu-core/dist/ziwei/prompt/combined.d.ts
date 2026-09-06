import { type PromptSchoolId } from '../../prompt/schools';
import type { AnalysisPayloadV1 } from '../../types/analysis';
import type { ZiweiRuntime } from '../runtime';
type ZiweiTrueSolarEvidence = NonNullable<ZiweiRuntime['trueSolarEvidence']>;
/** 提取紫微真太阳时证据中适合提示词展示的校正时刻与时辰。 */
export declare function formatZiweiTrueSolarEvidence(evidence?: ZiweiTrueSolarEvidence): string;
export interface CombinedZiweiPromptOptions {
    isCustomQuestion?: boolean;
    trueSolarEvidence?: ZiweiTrueSolarEvidence;
    /** 固定提示词中的当前时间；省略时使用调用时刻。 */
    currentTime?: Date;
}
/** 将紫微结构化盘面、传统依据、问题与任务组合成可直接交给在线 AI 的任务书。 */
export declare function buildCombinedZiweiPrompt(payload: AnalysisPayloadV1, topic: string, question: string, options?: CombinedZiweiPromptOptions): string;
export interface CombinedZiweiCompatibilityPromptOptions {
    primaryPayload: AnalysisPayloadV1;
    partnerPayload: AnalysisPayloadV1;
    /** 可选的原生 iztro 星盘对象；必须双方同时提供。 */
    primaryAstrolabe?: object;
    /** 可选的原生 iztro 星盘对象；必须双方同时提供。 */
    partnerAstrolabe?: object;
    topic: string;
    question: string;
    isCustomQuestion?: boolean;
    primaryName?: string;
    partnerName?: string;
    primaryTrueSolarEvidence?: ZiweiTrueSolarEvidence;
    partnerTrueSolarEvidence?: ZiweiTrueSolarEvidence;
    /** 一至三个紫微解读流派；多个值会生成分派判断、共识与分歧任务。 */
    schools?: readonly PromptSchoolId<'ziwei'>[];
    /** 固定提示词中的当前时间；省略时使用调用时刻。 */
    currentTime?: Date;
}
/** 生成包含双方盘面、宫位叠盘与跨盘四化资料的紫微合盘任务书。 */
export declare function buildCombinedZiweiCompatibilityPrompt(params: CombinedZiweiCompatibilityPromptOptions): string;
export {};
