/**
 * 统一的占卜时间管理工具
 * 简化时间相关操作，确保所有占卜基于统一的时间基础
 */
import type { TimeInfo, GanZhiInfo } from './lunar';
import type { RandomOptions } from '../shared/random';
/**
 * 统一的占卜时间数据
 */
export interface DivinationTime {
    /** 完整时间信息 */
    timeInfo: TimeInfo;
    /** 干支信息 */
    ganzhi: GanZhiInfo;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 时间管理工具类
 */
export declare class TimeManager {
    /**
     * 时区偏移覆盖（单位：分钟，正数表示 UTC+）
     * - null：不覆盖，使用运行环境本地时区
     * - 例如：北京时间为 480
     * - 默认固定北京时间，避免服务端时区差异导致占卜盘与提示词不一致
     */
    private static timezoneOffsetMinutesOverride;
    /**
     * 设置时区偏移覆盖（用于服务端/边缘环境固定时区）
     */
    static setTimezoneOffsetMinutesOverride(offsetMinutes: number | null): void;
    /**
     * 获取目标时区偏移（分钟）
     */
    private static getTimezoneOffsetMinutes;
    private static assertFiniteNumber;
    private static assertPositiveInteger;
    private static assertTimezoneOffsetMinutes;
    /**
     * 在指定时区偏移下提取年月日时分（不改变原始时间戳）
     */
    private static getDatePartsInOffset;
    /**
     * 获取占卜用的统一时间数据
     * @param customTime 自定义时间（可选）
     * @returns 统一的时间数据
     */
    static getDivinationTime(customTime?: Date): DivinationTime;
    /**
     * 按统一时区策略提取墙上时间的年月日时分（默认东八区）。
     * 供紫微等模块取"当前时刻"，避免直接读运行环境本地时区导致跨模块日期/时辰不一致。
     */
    static getWallClockParts(date?: Date): {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    };
    /**
     * 基于时间戳生成确定性随机数
     * @param timestamp 时间戳
     * @param range 范围
     * @returns 确定性随机数
     */
    static getSeededRandom(timestamp: number, range?: number): number;
    /**
     * 基于时间生成爻象
     * @param timestamp 时间戳
     * @param count 爻象数量
     * @returns 爻象数组
     */
    static generateYaosByTime(timestamp: number, count?: number): number[];
    /**
     * 随机生成爻象
     * @param count 爻象数量
     * @returns 爻象数组
     */
    static generateYaosByRandom(count?: number, options?: RandomOptions): number[];
    /**
     * 使用三钱法起一爻：正面记 3，反面记 2，三枚铜钱合计得 6/7/8/9。
     */
    private static generateYaoByCoinMethod;
    /**
     * 获取指定时间的干支信息
     */
    private static getGanZhi;
    /**
     * 获取指定时间的完整信息
     */
    private static getTimeInfo;
}
export declare const getDivinationTime: typeof TimeManager.getDivinationTime;
export declare const generateYaosByTime: typeof TimeManager.generateYaosByTime;
/**
 * 全局配置选项
 */
export interface MingyuCoreConfig {
    /** 时区偏移分钟数（默认 480 = UTC+8 东八区） */
    timezoneOffset?: number;
}
/**
 * 统一全局配置入口
 *
 * 用于设置时区等全局参数，取代手动调用 TimeManager.setTimezoneOffsetMinutesOverride()。
 * 不传字段则保持当前值不变。
 *
 * @param config 配置选项
 *
 * @example
 * ```ts
 * import { configure } from 'mingyu-core/calendar';
 *
 * // 设置东八区（北京时间）
 * configure({ timezoneOffset: 480 });
 * ```
 */
export declare function configure(config: MingyuCoreConfig): void;
