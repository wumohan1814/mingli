import type { LiurenPlateItem } from '../../../../types/divination';
export declare const DIZHI: readonly ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export declare const TIANGAN: readonly ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
/**
 * 十二天将（《大六壬大全》天将体系）：
 * 贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后。
 * 十二天将分属各干支，以下只保留可由《天将总论》《十二将释》直接核验的属性。
 */
export declare const TIANJIANG: readonly ["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"];
export type TianJiangName = (typeof TIANJIANG)[number];
/**
 * 十二天将基础属性（《大六壬大全》卷二《天将总论》《十二将释》）：
 *
 * 五行、阴阳由各将所配天干地支确定，类象取自十二将释。
 * 五味、主数、身体等属于十二月将/地支神类象，不能移植到十二天将。
 *
 * 各将属性来源：
 * - 贵人：己丑土，《大全》"贵人己丑旺，主官爵印信，紫衣"
 * - 螣蛇：丁巳火，《大全》"螣蛇丁巳主惊疑，凶将赤色"
 * - 朱雀：丙午火，《大全》"朱雀丙午主文书口舌"
 * - 六合：乙卯木，《大全》"六合乙卯主和合婚姻"
 * - 勾陈：戊辰土，《大全》"勾陈戊辰主勾连争斗"
 * - 青龙：甲寅木，《大全》"青龙甲寅主财帛庆贺"
 * - 天空：戊戌土，《大全》"天空戊戌主虚诈孤独"
 * - 白虎：庚申金，《大全》"白虎庚申主疾病凶丧"
 * - 太常：己未土，《大全》"太常己未主筵宴印绶"
 * - 玄武：癸亥水，《大全》"玄武癸亥主盗贼阴私"
 * - 太阴：辛酉金，《大全》"太阴辛酉主阴私妇女"
 * - 天后：壬子水，《大全》"天后壬子主恩泽婚姻"
 */
export declare const TIANJIANG_ATTRIBUTES: Record<TianJiangName, {
    wuxing: string;
    yinYang: '阳' | '阴';
    category: string;
    description: string;
}>;
export declare const GUIREN_BRANCH_BY_STEM: Record<string, {
    day: string;
    night: string;
}>;
export declare const DAY_STEM_RESIDENCE_MAP: Record<string, string>;
export declare function describeRelation(sourceBranch: string, targetBranch: string): string;
export declare function getGanZhiWuxing(value: string): string;
export declare function isBranchKe(sourceBranch: string, targetBranch: string): boolean;
export declare function isElementKe(sourceElement: string, targetElement: string): boolean;
export declare function getNoblemanBranch(dayStem: string, dayNight: '昼占' | '夜占'): string;
export declare function getUpperByUnder(plate: LiurenPlateItem[], under: string): string;
export declare function getUnderByUpper(plate: LiurenPlateItem[], upper: string): string;
export declare function buildHeavenlyPlate(args: {
    monthLeader: string;
    divinationBranch: string;
    noblemanBranch: string;
    dayNight: '昼占' | '夜占';
}): {
    god: string;
    branch: "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";
    under: "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";
}[];
export declare function getPlateItemByBranch(plate: LiurenPlateItem[], branch: string): LiurenPlateItem;
export declare function getDayStemResidence(dayStem: string): string;
