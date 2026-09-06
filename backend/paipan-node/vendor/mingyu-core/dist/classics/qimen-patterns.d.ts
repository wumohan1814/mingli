import type { QimenStemPattern } from './types';
export declare const QIMEN_STEM_PATTERNS: Record<string, QimenStemPattern>;
import type { QimenDeityClassic, QimenDoorClassic, QimenStarClassic } from './types';
/**
 * 奇门遁甲九星《奇门遁甲秘笈大全》释义
 */
export declare const QIMEN_STAR_CLASSICS: Record<string, QimenStarClassic>;
/**
 * 奇门遁甲八门《奇门遁甲秘笈大全》释义
 */
export declare const QIMEN_DOOR_CLASSICS: Record<string, QimenDoorClassic>;
/**
 * 奇门遁甲八神释义
 */
export declare const QIMEN_DEITY_CLASSICS: Record<string, QimenDeityClassic>;
/**
 * 查询奇门遁甲九星释义
 */
export declare function getQimenStarClassic(star: string): QimenStarClassic | undefined;
/**
 * 查询奇门遁甲八门释义
 */
export declare function getQimenDoorClassic(door: string): QimenDoorClassic | undefined;
/**
 * 查询奇门遁甲八神释义
 */
export declare function getQimenDeityClassic(deity: string): QimenDeityClassic | undefined;
/**
 * 宋代《烟波钓叟歌》精义节选
 */
export declare const QIMEN_YANBO_CLASSICS: Array<{
    title: string;
    verse: string;
    explanation: string;
}>;
export declare function getQimenYanboClassic(keyword: string): {
    title: string;
    verse: string;
    explanation: string;
} | undefined;
export declare function getAllQimenYanboClassics(): {
    title: string;
    verse: string;
    explanation: string;
}[];
