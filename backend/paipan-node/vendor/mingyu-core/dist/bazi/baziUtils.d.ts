/**
 * @file Bazi Utils
 * @description Contains stateless utility functions for Bazi calculations.
 */
import type { HiddenStems, Pillars, Wuxing } from './baziTypes';
export { assertEarthlyBranch, assertGanZhiPair, assertHeavenlyStem, isEarthlyBranch, isGanZhiPair, isHeavenlyStem, } from '../ganzhi/validation';
export declare function assertGanZhiName(ganZhi: string, label?: string): void;
export declare function assertBaziGender(gender: string): asserts gender is 'male' | 'female';
export declare function assertPillars(pillars: Pillars): void;
export declare function assertHiddenStemsMatchPillars(pillars: Pillars, hiddenStems: HiddenStems): void;
/**
 * 获取天干或地支的五行
 */
export declare function getWuxing(ganOrZhi: string): Wuxing | '未知';
/**
 * 获取天干阴阳
 */
export declare function getGanYinYang(gan: string): string;
/**
 * 获取两个天干之间的十神关系
 */
export declare function getTenGod(gan: string, dayMaster: string): string;
/**
 * 获取地支对应的十神（取藏干主气）
 */
export declare function getTenGodForBranch(zhi: string, dayMaster: string): string;
/**
 * 获取月支对应的五行旺衰状态
 * @param monthBranch 月支
 * @returns 一个包含各五行状态的对象
 */
export declare function getSeasonStatus(monthBranch: string): Record<string, string>;
/**
 * 获取神煞属性 (吉/凶/中性)
 * @param shensha 神煞名称
 * @returns 属性名称
 */
export declare const getShenShaType: (shensha: string) => "\u5409" | "\u51F6" | "\u4E2D\u6027";
