import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type FunctionalHoroscope from 'iztro/lib/astro/FunctionalHoroscope';
import type { Config } from 'iztro/lib/data/types';
import type { ChartInput } from '../../types/chart';
import type { ZiweiCalculationConfig } from '../../types/analysis';
type IztroAstro = typeof import('iztro').astro;
/**
 * 兼容 iztro 的 CommonJS 导出在 Node、Vite 和 Webpack 中的不同包装方式。
 */
export declare function resolveIztroAstro(moduleValue: unknown): IztroAstro;
export declare function normalizeChartInput(input: ChartInput): ChartInput;
export declare function buildIztroConfig(input: ChartInput): Config;
export declare function buildZiweiCalculationConfig(input: ChartInput): ZiweiCalculationConfig;
export declare const DEFAULT_ZIWEI_CALCULATION_CONFIG: ZiweiCalculationConfig;
export declare function buildAstrolabeFromInput(input: ChartInput): Promise<FunctionalAstrolabe>;
export declare function formatLocalDate(date: Date): string;
export declare function getDefaultHoroscopeContext(now?: Date): {
    dateStr: string;
    hourIndex: number;
};
export declare function buildHoroscope(astrolabe: IFunctionalAstrolabe, dateStr: string, hourIndex: number): FunctionalHoroscope;
export declare function buildHoroscopeFromInput(astrolabe: IFunctionalAstrolabe, input: ChartInput, dateStr: string, hourIndex: number): Promise<FunctionalHoroscope>;
export declare function shiftLocalDate(dateStr: string, amount: number, unit: 'year' | 'month' | 'day'): string;
/**
 * 按农历年位移日期：返回出生日对应农历日期在目标农历年中的公历日期。
 *
 * 虚岁按农历年（正月初一）递增；公历直移会让春节前出生者（公历 1 月至春节间）
 * 的"虚岁 N 岁"落入相邻农历年，导致大限/流年时间轴取到错误的年干支。
 * 闰月出生回退到同名普通月，三十日出生遇目标月小月回退到廿九。
 */
export declare function shiftLunarYear(dateStr: string, amount: number): string;
export {};
