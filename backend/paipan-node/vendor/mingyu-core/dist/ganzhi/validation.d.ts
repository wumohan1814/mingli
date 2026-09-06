/**
 * 干支与五行基础输入校验。
 *
 * 所有上层术数共用同一套合法值，避免各模块自行维护列表后出现口径分叉。
 */
import { type EarthlyBranch, type HeavenlyStem } from './data';
export declare const WUXING_VALUES: readonly ["木", "火", "土", "金", "水"];
export type WuxingValue = (typeof WUXING_VALUES)[number];
export declare function isHeavenlyStem(value: unknown): value is HeavenlyStem;
export declare function isEarthlyBranch(value: unknown): value is EarthlyBranch;
export declare function isWuxing(value: unknown): value is WuxingValue;
/** 是否为真实存在的六十甲子，而非任意合法天干、地支的拼接。 */
export declare function isValidGanZhi(value: unknown): value is string;
export declare function isGanZhiPair(gan: unknown, zhi: unknown): boolean;
export declare function assertHeavenlyStem(value: unknown, label?: string): asserts value is HeavenlyStem;
export declare function assertEarthlyBranch(value: unknown, label?: string): asserts value is EarthlyBranch;
export declare function assertWuxing(value: unknown, label?: string): asserts value is WuxingValue;
export declare function assertValidGanZhi(value: unknown, label?: string): asserts value is string;
export declare function assertGanZhiPair(gan: unknown, zhi: unknown, label?: string): void;
