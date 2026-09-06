/**
 * 干支信息接口
 */
export interface GanZhiInfo {
    year: string;
    month: string;
    day: string;
    hour: string;
}
/**
 * 农历信息接口
 */
export interface LunarInfo {
    year: string;
    month: string;
    day: string;
    hour: string;
    yearInChinese: string;
    monthInChinese: string;
    dayInChinese: string;
    hourInChinese: string;
    monthNumber: number;
    dayNumber: number;
}
/**
 * 完整时间信息接口
 */
export interface TimeInfo {
    solar: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    };
    lunar: LunarInfo;
    ganzhi: GanZhiInfo;
    eightChar: {
        year: string;
        month: string;
        day: string;
        hour: string;
    };
    jieQi: string;
}
/**
 * 农历工具类
 */
export declare class LunarUtil {
    /**
     * 获取当前时间的完整信息
     */
    static getCurrentTimeInfo(): TimeInfo;
    private static assertValidDate;
    private static assertSolarYear;
    private static assertSolarMonth;
    private static parseLunarDayText;
    /**
     * 获取指定时间的完整信息
     */
    static getTimeInfo(date: Date): TimeInfo;
    /**
     * 获取干支信息
     */
    static getGanZhi(date?: Date): GanZhiInfo;
    /**
     * 获取农历信息
     */
    static getLunar(date?: Date): LunarInfo;
    /**
     * 获取空亡地支
     */
    static getVoidBranches(dayGanZhi: string): string[];
    /**
     * 根据日干获取六神起始
     */
    static getSixAnimalsStart(dayGan: string): string;
    /**
     * 获取六神序列
     * 修正：从第一爻（最下方）开始，按日干确定起始六神
     */
    static getSixAnimals(dayGan: string): string[];
    /**
     * 获取指定公历月份每日的干支
     */
    static getGanZhiForMonth(year: number, month: number): {
        date: string;
        ganZhi: string;
        lunarDate: string;
    }[];
    /**
     * 获取指定公历年份每月的干支
     */
    static getGanZhiForYear(year: number): {
        month: number;
        ganZhi: string;
    }[];
    /**
     * 格式化时间显示
     */
    static formatTimeDisplay(timeInfo: TimeInfo): {
        solar: string;
        lunar: string;
        ganzhi: string;
    };
}
export declare const getVoidBranches: (dayGanZhi: string) => string[];
export declare const getSixAnimals: (dayGan: string) => string[];
