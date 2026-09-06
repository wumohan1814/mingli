import type { JinkoujueMovementClassic } from './types';
/**
 * 《大六壬金口诀》五动、三动与阴阳生克断语全录
 * 原典出处：《金口诀大全》《入式歌解》
 */
export declare const JINKOUJUE_MOVEMENT_CLASSICS: Record<string, JinkoujueMovementClassic>;
export declare function getJinkoujueMovementClassic(key: string): JinkoujueMovementClassic | undefined;
