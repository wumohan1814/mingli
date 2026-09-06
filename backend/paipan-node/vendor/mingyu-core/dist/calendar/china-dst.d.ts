/**
 * @file 中国夏令时（1986-1991）检测与校正
 * @description 中国历史钟表时间修正属于公共日历能力，供八字、紫微、真太阳时等统一复用。
 */
export interface ChinaDstCheckResult {
    /** 输入的钟表时刻是否处于夏令时期间。 */
    inDst: boolean;
    /** 应施加的分钟修正（夏令时内为 -60，否则 0）。 */
    offsetMinutes: number;
    /** 是否落在结束日 01:00-02:00 的重复时段。 */
    ambiguous: boolean;
    /** 是否落在开始日 02:00-03:00 的不存在时段。 */
    nonexistent: boolean;
}
export declare const CHINA_DST_YEARS: readonly [1986, 1987, 1988, 1989, 1990, 1991];
/** 检测某个中国历史钟表时刻是否处于夏令时期间。 */
export declare function checkChinaDst(year: number, month: number, day: number, hour: number, minute?: number): ChinaDstCheckResult;
/** 按日判断日期是否与中国历史夏令时区间有交集。 */
export declare function isDateInChinaDstRange(year: number, month: number, day: number): boolean;
