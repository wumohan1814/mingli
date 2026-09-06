export declare function isValidIsoDateTime(value: string, date: Date): boolean;
export declare function daysInSolarMonth(year: number, month: number): 29 | 28 | 30 | 31;
/** 公历月份天数基础能力；供需要更宽年份范围的历法算法复用。 */
export declare function daysInGregorianMonth(year: number, month: number): 29 | 28 | 30 | 31;
/** 校验 24 小时制时分秒，适合表单、排盘和 API 共用。 */
export declare function isValidClockTime(hour: number, minute: number, second?: number): boolean;
export declare function getBirthDateValidationMessage(params: {
    year: number;
    month: number;
    day: number;
    dateType: 'solar' | 'lunar';
    isLeapMonth?: boolean;
}): string | undefined;
