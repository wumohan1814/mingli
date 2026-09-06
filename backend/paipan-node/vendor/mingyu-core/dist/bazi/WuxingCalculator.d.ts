import { type Pillars, type WuxingStrengthDetails } from './baziTypes';
/**
 * 专注于五行结构出现情况比较的工具类
 */
export declare class WuxingCalculator {
    /**
     * 计算五行结构分布
     * @param pillars - 四柱
     * @param monthCommander - 月令司权天干（可选），仅单列为月令事实，不换算成比例加成
     * @returns 包含出现项、缺失项、结构比较优先项与逐条依据的详细对象
     */
    calculateWuxingStrength(pillars: Pillars, monthCommander?: string): WuxingStrengthDetails;
    private _calculatePresence;
}
