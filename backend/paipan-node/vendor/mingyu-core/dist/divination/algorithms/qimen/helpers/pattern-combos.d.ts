/**
 * @file 奇门复合格局识别
 * @description 在经典单格基础上识别同宫叠加、吉凶混杂、吉格逢空、
 * 以及三奇、伏吟、反吟等关键盘面组合。
 *
 * 这里只输出结构化计算结果，不生成应用层报告、评分报告或具体场景话术。
 */
import type { QimenBranchPalace, QimenJiuGongGe } from '../../../../types/divination';
import type { ClassicPattern } from './classic-patterns';
export interface QimenPatternCombo {
    key: string;
    name: string;
    tone: 'super-good' | 'super-bad' | 'mixed';
    score: number;
    summary: string;
    palace?: number;
    sources: string[];
}
export interface PatternComboContext {
    classicPatterns?: ClassicPattern[];
    patternTags?: string[];
    voidPalaces?: QimenBranchPalace[];
    horseStar?: QimenBranchPalace;
    activeGanZhi?: string;
    zhiFu?: string;
    zhiShi?: string;
    dayGanZhi?: string;
    yearBranch?: string;
    dayStem?: string;
    dayBranch?: string;
    monthBranch?: string;
    solarTerm?: string;
    epoch?: string;
    hourGanZhi?: string;
    hourStem?: string;
    hourBranch?: string;
    jiuGongGe: QimenJiuGongGe[];
}
export declare function detectQimenPatternCombos(ctx: PatternComboContext): QimenPatternCombo[];
