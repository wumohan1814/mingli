import { SolarTime, ChildLimit } from 'tyme4ts';
import type { LuckInfo } from './baziTypes';
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
/**
 * 专注于大运、小运、流年等运势计算的工具类
 *
 * 基于 tyme4ts 提供的 ChildLimit / DecadeFortune / Fortune 结果，
 * 统一生成起运时间、大运排布与逐年小运，避免手推公式与官方实现偏离。
 */
export declare class LuckCalculator {
    /**
     * 主计算函数：计算大运、小运和所有关联的流年信息
     */
    calculateLuckInfo(solarTime: SolarTimeInstance, gender: LuckGender, dayMaster: string): LuckInfo;
    /**
     * 为单个大运周期（10年）计算所有流年信息
     */
    private calculateLiunianForCycle;
    private getXiaoyunForAge;
    private attachResolvedYears;
    /**
     * 计算流年
     */
    private calculateLiunian;
    /**
     * 获取交运信息
     * 根据起运月份推算交运时机
     */
    private getHandoverInfo;
    private shouldIncludeBoundaryYear;
    private getCycleCalendarYearCount;
    private getStartInfoText;
}
export {};
