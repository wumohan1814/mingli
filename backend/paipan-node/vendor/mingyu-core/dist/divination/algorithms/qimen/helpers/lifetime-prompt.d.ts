/**
 * @file 奇门终身局自包含提示词生成器
 * @description 遵循 AGENTS.md 规范，生成供在线 AI 解读的自包含完整任务书，
 * 严禁暴露内部工程术语、代码路径、字段键名或否定性限制。
 */
import type { QimenLifetimeData } from '../../../../types/divination';
/**
 * 构建终身局自包含提示词任务书
 */
export declare function buildLifetimePrompt(data: QimenLifetimeData, question?: string): string;
