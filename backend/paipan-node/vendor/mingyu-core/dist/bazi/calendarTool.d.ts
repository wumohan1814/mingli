import { type SolarTermEvidence } from '../calendar/solar-term-evidence';
import type { LocalTimeRange } from './baziTypes';
export interface BaziMonthInfo {
    index: number;
    month: string;
    ganZhi: string;
    startDate: string;
    endDate: string;
    startDateTime?: string;
    endDateTime?: string;
    startTermName?: string;
    endTermName?: string;
    startTermEvidence?: SolarTermEvidence;
    endTermEvidence?: SolarTermEvidence;
    timeRange: LocalTimeRange;
}
export interface BaziMonthDayInfo {
    day: number;
    solarDate: string;
    solarLabel: string;
    ganZhi: string;
    lunar: string;
    term?: string;
    startDateTime?: string;
    endDateTime?: string;
    boundaryNote?: string;
    timeRange: LocalTimeRange;
}
export interface CalendarInfo {
    solarDate: string;
    lunarDate: string;
    ganZhi: {
        year: string;
        month: string;
        day: string;
        hour: string;
    };
    jieQi: {
        prev: string;
        next: string;
    };
    festival: string;
}
export declare function getCalendarInfo(date?: Date): CalendarInfo;
export declare function getCurrentTimeDescription(): string;
export declare function getYearMonthsGanZhi(year: number): BaziMonthInfo[];
export declare function getBaziMonthIndexByDate(year: number, referenceDate?: Date): number | undefined;
export declare function getBaziDayIndexByDate(year: number, monthIndex: number, referenceDate?: Date): number | undefined;
export declare function getYearInfo(year: number): {
    year: number;
    yearGanZhi: string;
    zodiac: string;
    months: BaziMonthInfo[];
};
export declare function getMonthDaysInfo(year: number, month: number): BaziMonthDayInfo[];
