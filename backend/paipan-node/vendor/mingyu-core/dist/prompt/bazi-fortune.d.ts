import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
export interface BaziFortuneSelectionSections {
    /** 可直接放入【分析对象】分段的范围说明。 */
    analysisObject: string;
    /** 可直接放入【岁运重点】分段的上下层岁运、干支、触发与明细。 */
    focus: string;
}
/**
 * 把八字岁运选择结果整理为面向提示词的稳定文本。
 *
 * 页面、服务端和 MCP 共用该入口，避免把底层的“流年触发”等内部层级标签
 * 直接暴露成不一致的任务书字段。
 */
export declare function formatBaziFortuneSelection(context: FortuneSelectionContext | null | undefined): BaziFortuneSelectionSections | null;
