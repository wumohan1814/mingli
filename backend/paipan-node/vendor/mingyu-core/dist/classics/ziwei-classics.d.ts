import type { ZiweiStarClassic } from './types';
/**
 * 《紫微斗数全书》《太微赋》《骨髓赋》十四正曜诸星问答论全篇
 */
export declare const ZIWEI_STAR_CLASSICS: Record<string, ZiweiStarClassic>;
import type { ZiweiFuClassic } from './types';
/**
 * 《太微赋》《骨髓赋》核心赋文全篇精粹
 */
export declare const ZIWEI_FU_CLASSICS: ZiweiFuClassic[];
export declare function getZiweiStarClassic(star: string): ZiweiStarClassic | undefined;
export declare function getZiweiFuClassic(key: string): ZiweiFuClassic | undefined;
export declare function getAllZiweiFuClassics(): ZiweiFuClassic[];
