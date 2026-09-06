/**
 * @file 奇门遁甲终身局主计算入口
 * @description 整合时间标准化、本命基础局、个人年命标记、六亲主题宫、
 * 阶段运限引擎（Stage Engine）、动态事件扫描与自包含提示词生成。
 */
import type { QimenLifetimeData, QimenLifetimeInput } from '../../../types/divination';
export { buildLifetimePrompt } from './helpers/lifetime-prompt';
export { normalizeQimenLifetimeTime } from './helpers/lifetime-time';
export { extractPersonalMarkers, buildTopicCandidates } from './helpers/lifetime-markers';
export { buildLifetimeStages } from './helpers/lifetime-stages';
export { scanLifetimeDynamicEvents } from './helpers/lifetime-dynamic';
/**
 * 计算奇门终身局完整结构
 */
export declare function calculateQimenLifetime(input: QimenLifetimeInput): QimenLifetimeData;
/**
 * 计算终身局并生成自包含提示词
 */
export declare function generateQimenLifetimePrompt(input: QimenLifetimeInput, question?: string): {
    data: QimenLifetimeData;
    prompt: string;
};
