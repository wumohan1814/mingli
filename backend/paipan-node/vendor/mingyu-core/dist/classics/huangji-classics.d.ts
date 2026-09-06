import type { HuangjiCycleClassic } from './types';
/**
 * 宋代邵雍《皇极经世书·观物篇》元会运世治乱卦气要旨
 */
export declare const HUANGJI_CYCLE_CLASSICS: Record<string, HuangjiCycleClassic>;
export declare function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined;
