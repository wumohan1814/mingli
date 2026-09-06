import type { LiurenClassicalRule, LiurenData, LiurenGuaTiFact, LiurenLesson, LiurenTransmission } from '../../../../types/divination';
export declare function buildTransmissionNote(stage: LiurenTransmission['stage'], relation: string): string;
export declare function getTransmissionPattern(chu: string, _zhong: string, mo: string, transmissionRule?: string): LiurenData['transmissionPattern'];
export declare function getPatternTag(pattern: LiurenData['transmissionPattern']): "伏吟" | "反吟" | "回环" | "递传";
export interface LiurenGuaTiContext {
    transmissionBranches: string[];
    initialGroundBranch?: string;
    yearBranch?: string;
    monthBranch?: string;
    monthLeader?: string;
    noblemanBranch?: string;
    noblemanGroundBranch?: string;
    fourLessons?: Array<Pick<LiurenLesson, 'upper' | 'lower'>>;
    dayStem?: string;
    dayBranch?: string;
}
export declare const REGISTERED_LIUREN_GUA_TI_COUNT: number;
/**
 * 识别三传成局课体。
 * 《六壬指南》列三交、玄胎、稼穑及曲直、从革、炎上、润下等三传课体；
 * 这里仅按三传地支结构打标签，吉凶仍交由后续断课结合用神、天将与旺衰判断。
 */
export declare function getLiurenGuaTiFacts(context: LiurenGuaTiContext): LiurenGuaTiFact[];
export declare function getLiurenTransmissionGuaTi(branches: string[]): string[];
export declare function buildTransmissionDetail(rule: string, _pattern: LiurenData['transmissionPattern'], transmissions: LiurenTransmission[], classicalRules?: LiurenClassicalRule[]): string;
