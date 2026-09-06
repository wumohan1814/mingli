import type { LiurenLessonPatternClassic, LiurenTransmissionClassic } from './types';
/**
 * 《大六壬大全》《六壬指南》《毕法赋》九宗门取传与经典课体释义全录
 */
export declare const LIUREN_TRANSMISSION_CLASSICS: Record<string, LiurenTransmissionClassic>;
export declare const LIUREN_LESSON_PATTERN_CLASSICS: Record<string, LiurenLessonPatternClassic>;
import type { LiurenGeneralClassic } from './types';
/**
 * 大六壬十二天将《大六壬大全》《六壬指南》精解
 */
export declare const LIUREN_GENERAL_CLASSICS: Record<string, LiurenGeneralClassic>;
export declare function getLiurenGeneralClassic(general: string): LiurenGeneralClassic | undefined;
export declare function getLiurenTransmissionClassic(rule: string): LiurenTransmissionClassic | undefined;
export declare function getLiurenLessonPatternClassic(pattern: string): LiurenLessonPatternClassic | undefined;
/**
 * 宋代凌福之《大六壬毕法赋》百法精义节选
 */
export declare const LIUREN_BIFA_CLASSICS: Array<{
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
}>;
export declare function getLiurenBifaClassic(keyword: string): {
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
} | undefined;
export declare function getAllLiurenBifaClassics(): {
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
}[];
