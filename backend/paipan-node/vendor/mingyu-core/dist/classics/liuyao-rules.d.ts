import type { LiuyaoMovementRule } from './types';
export interface LiuyaoCategoryChapter {
    category: 'wealth' | 'career' | 'marriage' | 'health' | 'travel' | 'lost' | 'litigation' | 'house';
    title: string;
    sourceBook: string;
    verse: string;
    explanation: string;
}
/**
 * 六爻《黄金策》《增删卜易》《卜筮正宗》《断易天机》经典动爻与神煞断语全库
 */
export declare const LIUYAO_MOVEMENT_RULES: Record<string, LiuyaoMovementRule>;
/**
 * 六爻分类占断《黄金策·分类篇》经典古训
 */
export declare const LIUYAO_CATEGORY_CHAPTERS: LiuyaoCategoryChapter[];
import type { LiuyaoChishiClassic } from './types';
/**
 * 《卜筮正宗》《增删卜易》六亲持世歌诀全解
 */
export declare const LIUYAO_CHISHI_TABLE: Record<string, LiuyaoChishiClassic>;
export declare function getLiuyaoChishiClassic(sixRelation: string): LiuyaoChishiClassic | undefined;
export declare function getLiuyaoMovementRule(key: string): LiuyaoMovementRule | undefined;
export declare function getAllLiuyaoMovementRules(): LiuyaoMovementRule[];
export declare function getLiuyaoCategoryChapter(category: string): LiuyaoCategoryChapter | undefined;
export declare function getAllLiuyaoCategoryChapters(): LiuyaoCategoryChapter[];
