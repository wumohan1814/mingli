import type { ChartInput } from '../types/chart';
import type { DecadalTimelineOption } from './iztro/decadal';
export interface ZiweiYearOption {
    year: number;
    age: number;
    dateStr: string;
    label: string;
    ganZhi: string;
}
export interface ZiweiMonthOption {
    month: number;
    dateStr: string;
    label: string;
    ganZhi: string;
}
export interface ZiweiDayOption {
    day: number;
    dateStr: string;
    label: string;
    ganZhi: string;
}
export interface ZiweiFortuneOptionsBuildOptions {
    /** 可省略；省略时从紫微命盘取得换算后的公历出生日期。 */
    birthSolarDate?: string;
    hourIndex?: number;
    selectedYearDateStr?: string;
    selectedMonthDateStr?: string;
}
export interface ZiweiFortuneOptions {
    yearOptions: ZiweiYearOption[];
    monthOptions: ZiweiMonthOption[];
    dayOptions: ZiweiDayOption[];
    effectiveYearDateStr: string;
    effectiveMonthDateStr: string;
}
/** 从一个童限或大限直接生成流年、流月、流日选项及其干支。 */
export declare function buildZiweiFortuneOptions(input: ChartInput, selectedDecadal: Pick<DecadalTimelineOption, 'startAge' | 'endAge'>, options?: ZiweiFortuneOptionsBuildOptions): Promise<ZiweiFortuneOptions>;
