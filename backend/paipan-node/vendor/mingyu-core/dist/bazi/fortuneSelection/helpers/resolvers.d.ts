import type { BaziChartResult, LiunianInfo, LuckCycle } from '../../baziTypes';
import type { BaziFortuneSelectionValue } from './types';
export declare function formatCycleLabel(cycle: LuckCycle): string;
export declare function formatYearLabel(yearInfo: LiunianInfo): string;
export declare function resolveCycleIndex(result: BaziChartResult, selection: BaziFortuneSelectionValue): number;
export declare function resolveSelectedYear(cycle: LuckCycle | undefined, selection: BaziFortuneSelectionValue): number | undefined;
export declare function resolveSelectedMonth(selection: BaziFortuneSelectionValue): number | undefined;
export declare function resolveSelectedDay(year: number | undefined, month: number | undefined, selection: BaziFortuneSelectionValue): number | undefined;
