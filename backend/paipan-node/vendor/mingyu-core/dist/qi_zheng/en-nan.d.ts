/**
 * @file 七政四余古典恩难仇用与昼夜分金定性算法
 * @传统依据 《果老星宗·论五行相克》《果老星宗·昼夜篇》：生我者为恩，克我者为难，我生者为用，克恩者为仇；昼生以日为尊，夜生以月为重。
 */
import type { QizhengAspect } from './index';
export type WuxingElement = '木' | '火' | '土' | '金' | '水';
export declare const STAR_WUXING: Record<string, WuxingElement>;
export interface QizhengEnNanProfile {
    sect: '昼生' | '夜生';
    sectSummary: string;
    mingZhu: string;
    mingElement: WuxingElement;
    enStars: string[];
    nanStars: string[];
    chouStars: string[];
    yongStars: string[];
    aspectInteraction: string[];
    summary: string;
}
/**
 * 依据《果老星宗》推导昼夜分金与恩难仇用星曜交会实效
 */
export declare function evaluateQizhengEnNan(params: {
    hour: number;
    mingZhu: string;
    aspects: QizhengAspect[];
}): QizhengEnNanProfile;
