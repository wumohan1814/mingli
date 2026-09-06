import type { Pillars } from './baziTypes';
export interface BaziClimateBalanceResult {
    nature: '寒局' | '燥局' | '中和' | '微偏寒' | '微偏燥';
    medicine: string;
    summary: string;
}
/**
 * 依据《穷通宝鉴》《滴天髓》“天道有寒暖，地道有燥湿”的调候失衡与药神判定算法
 */
export declare function evaluateBaziClimateBalance(pillars: Pillars): BaziClimateBalanceResult;
