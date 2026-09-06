export { calculateKongWang } from './kongWang';
import type { HiddenStems, Nayin, PillarLifeStages, Pillars, ZiZuoResult } from './baziTypes';
export declare function calculatePillarLifeStages(pillars: Pillars): PillarLifeStages;
export declare function calculateTenGods(pillars: Pillars, dayMaster: string): Record<string, string>;
export declare function calculateHiddenStems(pillars: Pillars): HiddenStems;
export declare function calculateHiddenTenGods(hiddenStems: HiddenStems, dayMaster: string): Record<string, string[]>;
export declare function calculateLifeStages(pillars: Pillars, dayMaster: string): Record<string, string>;
export declare function calculateNayin(pillars: Pillars): Nayin;
/**
 * 计算自坐（十二长生在四柱的表现）
 * 与 calculatePillarLifeStages 逻辑相同，保留为兼容命名。
 * @deprecated 请使用 calculatePillarLifeStages
 */
export declare function calculateZiZuo(pillars: Pillars): ZiZuoResult;
