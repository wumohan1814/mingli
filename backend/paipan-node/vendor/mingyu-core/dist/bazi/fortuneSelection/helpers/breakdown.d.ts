import type { FortuneHourMode } from './types';
export declare function getDayHourBreakdown(year: number, month: number, day: number, mode?: FortuneHourMode): {
    label: string;
    ganZhi: string;
    timeRange: string;
    interval: import("../..").LocalTimeRange;
}[];
