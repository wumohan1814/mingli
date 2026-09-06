/**
 * @file 五运六气脏腑病机偏胜与岁运平气判定算法
 * @传统依据 《素问·至真要大论》《素问·五常政大论》：司天在泉所胜病机、五脏气机受制与平气之岁判定。
 */
import type { AnnualMovement, LiuqiProfile } from './index';
export interface WuyunLiuqiPathomechanismResult {
    isPingQi: boolean;
    pingQiType: '平气之岁' | '太过偏亢' | '不及偏虚';
    pingQiBasis: string;
    affectedZangFu: string;
    climaticPathology: string;
    treatmentGuideline: string;
    summary: string;
}
/**
 * 依据中运与司天推算脏腑病机偏胜与岁运平气定性
 */
export declare function evaluateWuyunLiuqiPathomechanism(params: {
    annualMovement: AnnualMovement;
    sitian: LiuqiProfile;
    yearGanZhi: string;
}): WuyunLiuqiPathomechanismResult;
