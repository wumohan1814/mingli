import type { LocalTimeRange, LuckCycle, SolarDateTimeInfo } from './baziTypes';
export declare function toNativeDate(time: SolarDateTimeInfo | Date): Date;
export declare function fromNativeDate(time: Date): SolarDateTimeInfo;
export declare function createLocalTimeRange(start: Date, end: Date): LocalTimeRange;
export declare function getLuckCycleTimeRange(cycle: LuckCycle): LocalTimeRange;
export declare function intersectLocalTimeRanges(left: LocalTimeRange, right: LocalTimeRange): LocalTimeRange | null;
export declare function toSolarDateTimeInfo(time: {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
}): SolarDateTimeInfo;
export declare function shiftSolarDateTimeYears(time: SolarDateTimeInfo, years: number): SolarDateTimeInfo;
export declare function isDateWithinLuckCycle(cycle: LuckCycle, referenceDate?: Date): boolean;
export declare function getLuckCycleForDate(cycles: LuckCycle[], referenceDate?: Date): LuckCycle | null;
export declare function formatSolarDateTime(time: SolarDateTimeInfo, withYear?: boolean): string;
