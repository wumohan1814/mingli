/**
 * @file 干支基础数据（地基层）
 * @description 天干、地支、生肖、纳音、十二长生等最基础的数据表。
 * 这些数据是八字、紫微、奇门、六壬、择日等所有术数共同依赖的底层常量，
 * 集中在此以便各系统复用、避免重复定义导致分叉。
 */
/** 十天干（顺序） */
export declare const HEAVENLY_STEMS: readonly ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];
/** 十二地支（顺序） */
export declare const EARTHLY_BRANCHES: readonly ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];
/** 十二生肖（与地支一一对应） */
export declare const ZODIACS: readonly ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
/** 六十甲子（甲子起，癸亥止）。 */
export declare const SIXTY_CYCLE: readonly string[];
/** 六旬旬首（每旬第一个甲日/甲时）。 */
export declare const SIX_XUN_HEADS: readonly string[];
/** 天干五行 */
export declare const STEM_WUXING: Record<string, string>;
/** 天干阴阳（阳干：甲丙戊庚壬；阴干：乙丁己辛癸） */
export declare const STEM_YINYANG: Record<string, '阳' | '阴'>;
/** 地支阴阳（阳支：子寅辰午申戌；阴支：丑卯巳未酉亥） */
export declare const BRANCH_YINYANG: Record<string, '阳' | '阴'>;
/**
 * 纳音五行表（六十甲子纳音）
 * 古籍依据：《三命通会》《类经图翼》
 */
export declare const NAYIN_MAP: Record<string, string>;
/** 纳音五行 → 五行属性（取纳音名首字对应的五行） */
export declare const NAYIN_WUXING: Record<string, string>;
/** 十二长生次序 */
export declare const CHANGSHENG_ORDER: readonly ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];
export type ChangShengState = (typeof CHANGSHENG_ORDER)[number];
/** 五行长生起地支（火土同宫，土长生在寅） */
export declare const WUXING_CHANGSHENG_START: Record<string, string>;
