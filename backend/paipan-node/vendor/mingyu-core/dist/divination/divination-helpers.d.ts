/**
 * 占卜通用辅助函数
 * 提供各种占卜功能的通用工具方法
 */
import type { MeihuaData } from '../types/divination';
/**
 * 梅花易数专用工具函数
 */
export declare const MeihuaHelpers: {
    getSeasonByJieQi(jieQi: string): "\u6625" | "\u590F" | "\u79CB" | "\u51AC" | "\u672A\u77E5";
    getSeasonByMonth(monthNumber: number): "\u6625" | "\u590F" | "\u79CB" | "\u51AC";
    getElementSeasonState(element: string, season: "\u6625" | "\u590F" | "\u79CB" | "\u51AC"): "\u65FA" | "\u76F8" | "\u4F11" | "\u56DA" | "\u6B7B" | "\u672A\u77E5";
    /**
     * 分析梅花易数卦象特征
     */
    analyzeMeihuaHexagram(data: MeihuaData): {
        hasMovingYao: boolean;
        movingYaoPosition: number;
        upperTrigramElement: string;
        lowerTrigramElement: string;
        elementRelation: string;
    };
    /**
     * 生成梅花易数解读要点
     */
    generateMeihuaInterpretationPoints(data: MeihuaData): string[];
    /**
     * 获取五行相生相克关系
     */
    getElementRelation(yong: string, ti: string): string;
};
