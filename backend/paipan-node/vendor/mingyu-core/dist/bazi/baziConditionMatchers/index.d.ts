import type { BaziChartResult } from '../baziTypes';
export { branchesContain } from './helpers';
export type { CheckContext, Matcher } from './types';
export declare function checkCondition(condition: string, dayStem: string, pillars: BaziChartResult['pillars'], hiddenStems: BaziChartResult['hiddenStems']): boolean;
