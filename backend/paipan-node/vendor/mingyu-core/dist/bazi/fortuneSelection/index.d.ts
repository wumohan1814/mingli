import type { BaziChartResult } from '../baziTypes';
import type { BaziFortuneSelectionValue, FortuneSelectionContext, FortuneSelectionOptions } from './helpers/types';
export type { BaziFortuneSelectionValue, FortuneHourMode, FortuneSelectionContext, FortuneSelectionOptions, } from './helpers/types';
export { buildCurrentBaziFortuneSelection, buildRecentBaziFortuneSelection, getCurrentBaziLuckCycle, } from './current';
export declare function normalizeFortuneSelection(result: BaziChartResult, selection: BaziFortuneSelectionValue): BaziFortuneSelectionValue;
export declare function buildFortuneSelectionContext(result: BaziChartResult, selection: BaziFortuneSelectionValue, options?: FortuneSelectionOptions): FortuneSelectionContext | null;
