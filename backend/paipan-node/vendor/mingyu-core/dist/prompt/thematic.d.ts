/**
 * 大类主题咨询（Thematic Consultation）统一提示词与核心要素提取器。
 *
 * 提供统一的大类主题枚举、规范化映射、盘面焦点宫位与传统理法任务书。
 * 遵循 AGENTS.md 最高规范：自包含完整任务书，不含工程/API/MCP等噪声，纯盘面与正统理法。
 */
import { type BaziChartResult, type FortuneSelectionContext } from '../bazi';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { type BaziPromptSchool } from './bazi-school';
import { type ZiweiPromptScope, type ZiweiSchool } from './public-api';
export declare const THEMATIC_TOPICS: readonly ["general", "relationship", "career", "wealth", "health", "family", "academic", "timing"];
export type ThematicTopic = (typeof THEMATIC_TOPICS)[number];
export interface ThematicTopicConfig {
    topic: ThematicTopic;
    name: string;
    title: string;
    scopeDescription: string;
    defaultQuestion: string;
    baziTask: string;
    ziweiTask: string;
    combinedTask: string;
    ziweiFocusPalaces: string[];
    baziFocusElements: string[];
}
export declare const THEMATIC_TOPIC_CONFIGS: Record<ThematicTopic, ThematicTopicConfig>;
/**
 * 将任意输入的主题字符串或别名规范化为 8 大类主题之一，不匹配时平滑回退到 'general'。
 */
export declare function normalizeThematicTopic(topic?: string | null): ThematicTopic;
export declare function getThematicTopicConfig(topic?: string | null): ThematicTopicConfig;
export interface ThematicConsultationOptions {
    system?: 'bazi_ziwei' | 'bazi' | 'ziwei';
    topic?: ThematicTopic | string;
    question?: string;
    currentTime?: Date | string;
    baziResult?: BaziChartResult;
    fortuneSelectionContext?: FortuneSelectionContext | null;
    baziSchool?: BaziPromptSchool;
    baziSchools?: readonly BaziPromptSchool[];
    ziweiResult?: ZiweiRuntime;
    ziweiScope?: ZiweiPromptScope;
    ziweiSchool?: ZiweiSchool;
    ziweiSchools?: readonly ZiweiSchool[];
    mode?: 'framework' | 'custom';
}
export interface ThematicConsultationResult {
    topic: ThematicTopic;
    topicLabel: string;
    topicTitle: string;
    system: 'bazi_ziwei' | 'bazi' | 'ziwei';
    prompt: string;
    focusPalaces: string[];
    focusElements: string[];
    scope: string;
}
/**
 * 构建大类主题咨询 AI 提示词（自包含完整任务书）。
 */
export declare function buildThematicConsultationPrompt(options: ThematicConsultationOptions): ThematicConsultationResult;
