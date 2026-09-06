/**
 * @file 玄空飞星城门诀与特殊理气格局判定
 * @传统依据 《沈氏玄空学》城门诀：向首两旁同元龙之位为城门候选；运星入中依元龙阴阳顺逆飞布，若旺星飞临城门宫位，为城门得位可用。
 */
import { type FlyDirection } from './period-stars';
export type YuanLong = '天元龙' | '地元龙' | '人元龙';
export interface MountainProfile {
    mountain: string;
    gong: number;
    trigram: string;
    yuanLong: YuanLong;
    yinYang: '阳' | '阴';
}
export declare const MOUNTAIN_PROFILES: Record<string, MountainProfile>;
export interface CastleGateCandidate {
    gong: number;
    gongName: string;
    mountain: string;
    role: '正城门' | '副城门';
    yunStar: number;
    flyDirection: FlyDirection;
    arrivalStar: number;
    status: '得旺可用' | '得生气可用' | '不得旺不可用';
    summary: string;
}
export interface CastleGateEvaluation {
    hasUsableGate: boolean;
    candidates: CastleGateCandidate[];
    summary: string;
}
/**
 * 计算给定当运与朝向的城门诀
 */
export declare function evaluateCastleGate(params: {
    yun: number;
    facingMountain: string;
    yunPlate: number[];
}): CastleGateEvaluation;
