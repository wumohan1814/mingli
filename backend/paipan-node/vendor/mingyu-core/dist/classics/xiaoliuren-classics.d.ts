import type { XiaoliurenPalaceClassic } from './types';
/**
 * 《小六壬口诀》六神经典诗赋与断语全录
 * 原典出处：《小六壬通占》《诸葛马前课》
 */
export declare const XIAOLIUREN_CLASSICS: Record<string, XiaoliurenPalaceClassic>;
export declare function getXiaoliurenClassic(palaceName: string): XiaoliurenPalaceClassic | undefined;
