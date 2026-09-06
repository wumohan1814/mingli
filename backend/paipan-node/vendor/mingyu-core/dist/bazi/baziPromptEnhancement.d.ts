/**
 * AI 提示词增强模块
 * 整合病药法、通关法、经典格局与可由盘面证明的传统旁证。
 */
import type { BaziChartResult } from './baziTypes';
export interface BaziPillarRelations {
    fuxin: string[];
    fanyin: string[];
    xingChong: string[];
}
export declare function analyzePillarRelations(chartResult: Pick<BaziChartResult, 'pillars'>): BaziPillarRelations;
/**
 * 生成增强分析片段。
 * 用户选择的主题只限定回答范围，不再决定本地资料包塞哪些专项模板。
 */
export declare function generateEnhancedAnalysisSection(chartResult: BaziChartResult, _topic?: string): string;
