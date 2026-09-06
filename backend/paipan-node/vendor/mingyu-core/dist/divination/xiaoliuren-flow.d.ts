/**
 * @file 小六壬初宫二宫三宫流转与终局定性断诀
 * @传统依据 《小六壬通占》《马前课》：月上起初一，日上起子时；初宫主事端起由，二宫主人事过渡，三宫（时宫）定局定性。
 */
export interface XiaoliurenPalaceInfo {
    name: string;
    wuxing: '木' | '火' | '土' | '金' | '水';
    auspice: '大吉' | '吉' | '小吉' | '平' | '凶';
}
export declare const XIAOLIUREN_PALACE_ATTRIBUTES: Record<string, XiaoliurenPalaceInfo>;
export interface XiaoliurenFlowResult {
    month: XiaoliurenPalaceInfo;
    day: XiaoliurenPalaceInfo;
    hour: XiaoliurenPalaceInfo;
    monthToDayRelation: string;
    dayToHourRelation: string;
    trajectoryType: '顺畅相生' | '转折相克' | '先滞后发' | '始吉终空' | '平稳和合' | '起伏交错';
    classicalJudgment: string;
    summary: string;
}
/**
 * 推导小六壬月日时三宫流转与终局定性
 */
export declare function evaluateXiaoliurenFlow(sequence: {
    monthName: string;
    dayName: string;
    hourName: string;
}): XiaoliurenFlowResult;
