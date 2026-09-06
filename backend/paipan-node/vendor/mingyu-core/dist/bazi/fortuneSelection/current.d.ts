import type { BaziChartResult } from '../baziTypes';
import type { BaziFortuneSelectionValue } from './helpers/types';
/** 按精确交运时刻定位大运；数字年份参数仅为旧调用方式保留。 */
export declare function getCurrentBaziLuckCycle(result: BaziChartResult, reference?: Date | number): BaziChartResult['luckInfo']['cycles'][number] | null;
/** 生成可直接传给 buildFortuneSelectionContext 的当前流日选择。 */
export declare function buildCurrentBaziFortuneSelection(result: BaziChartResult, now?: Date): BaziFortuneSelectionValue | null;
/** 生成当前节令月选择，适合“近期趋势”类入口。 */
export declare function buildRecentBaziFortuneSelection(result: BaziChartResult, now?: Date): BaziFortuneSelectionValue | null;
