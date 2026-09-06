import { SolarTime } from 'tyme4ts';
import type { BaziChartResult, SeasonInfo, ShenShaResult } from './baziTypes';
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
export interface LiuyueInfo {
    month: number;
    gan: string;
    zhi: string;
    ganZhi: string;
    tenGod: string;
    tenGodZhi: string;
    startDate: string;
    endDate: string;
    startDateTime?: string;
    endDateTime?: string;
    startTermName?: string;
    endTermName?: string;
    jieqi: {
        name: string;
        date: string;
    }[];
}
export interface LiuriInfo {
    date: string;
    year: number;
    month: number;
    day: number;
    gan: string;
    zhi: string;
    ganZhi: string;
    tenGod: string;
    tenGodZhi: string;
}
export declare function calculateLiuyue(year: number, month: number, dayMaster: string): LiuyueInfo;
export declare function calculateLiuri(year: number, month: number, day: number, dayMaster: string): LiuriInfo;
export declare function calculateLiuriRange(startDate: string, endDate: string, dayMaster: string): LiuriInfo[];
export declare function getMonthCommander(solarTime: SolarTimeInstance, monthBranch: string): string;
export declare function calculateSeasonInfo(solarTime: SolarTimeInstance): SeasonInfo;
export declare function calculateSeasonInfoFromDate(date: Date): SeasonInfo;
export declare function getCategorizedYearShenSha(yearData: {
    ganZhi?: string;
}, baziResult: BaziChartResult, calculateAllShenSha: (baziArray: [string, string][], gender: string) => ShenShaResult, getShenShaType: (shensha: string) => '吉' | '凶' | '中性'): {
    lucky: string[];
    unlucky: string[];
    neutral: string[];
};
export {};
