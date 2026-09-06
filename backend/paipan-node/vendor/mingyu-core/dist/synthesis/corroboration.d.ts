/**
 * @file 八字与紫微斗数跨体系合参互证算法
 * @传统依据 《滴天髓》《紫微斗数全书》《星平会海》：
 * 1. 羊刃与擎羊火星等煞曜同参（刚烈权柄与刑伤防范）；
 * 2. 天乙贵人与左辅右弼、天魁天钺吉曜同参（外力提携与顺遂福力）；
 * 3. 财官印绶与三方四正化禄化权同参（事业成就与资源承载）。
 */
import type { BaziChartResult } from '../bazi/baziTypes';
import type { ZiweiRuntime } from '../ziwei/runtime';
export interface ShaYaoCorroborationResult {
    hasBaziYangRen: boolean;
    baziDayMasterStrength: string;
    ziweiShaStars: string[];
    isHarmonized: boolean;
    judgment: string;
}
export interface GuiRenCorroborationResult {
    hasBaziTianYi: boolean;
    ziweiGuiStars: string[];
    isDoubleBlessed: boolean;
    judgment: string;
}
export interface BaziZiweiCorroborationResult {
    shaYao: ShaYaoCorroborationResult;
    guiRen: GuiRenCorroborationResult;
    corroborationPoints: string[];
    summary: string;
}
/**
 * 评估煞曜同参
 */
export declare function evaluateShaYaoCorroboration(bazi: BaziChartResult, ziwei: ZiweiRuntime): ShaYaoCorroborationResult;
/**
 * 评估贵人吉曜同参
 */
export declare function evaluateGuiRenCorroboration(bazi: BaziChartResult, ziwei: ZiweiRuntime): GuiRenCorroborationResult;
/**
 * 跨体系合参综合互证
 */
export declare function evaluateBaziZiweiCorroboration(bazi: BaziChartResult, ziwei: ZiweiRuntime): BaziZiweiCorroborationResult;
