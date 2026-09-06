import { BRANCH_ORDER, BRANCH_WUXING, STEM_ORDER, TIAN_GAN_HE, TIAN_GAN_CHONG, LIUHE_MAP, LIUHE_WUXING, LIUCHONG_MAP, LIUPO_MAP, LIUHAI_MAP, SANHE_GROUPS, SANHUI_GROUPS, BRANCH_SANHE, BRANCH_SANXING, ANHE_MAP, BRANCH_HIDDEN_STEMS, getHiddenMainStem, getHiddenMediumStem, getHiddenResidualStem, getSeasonState, isSheng, isKe, isLiupo, isSanxing, getSanxingType, isCompleteSanhe, isCompleteSanhui, getTianGanHeWuxing, getYiMa, getTaoHua, getWuxingChangSheng, SanxingType, SANXING_MAP } from './relations';
import { type ChangShengState } from './data';
import { isValidGanZhi } from './validation';
export * from './data';
export * from './validation';
export { BRANCH_ORDER, BRANCH_WUXING, STEM_ORDER, TIAN_GAN_HE, TIAN_GAN_CHONG, LIUHE_MAP, LIUHE_WUXING, LIUCHONG_MAP, LIUPO_MAP, LIUHAI_MAP, SANHE_GROUPS, SANHUI_GROUPS, BRANCH_SANHE, BRANCH_SANXING, ANHE_MAP, SANXING_MAP, BRANCH_HIDDEN_STEMS, getHiddenMainStem, getHiddenMediumStem, getHiddenResidualStem, getSeasonState, isSheng, isKe, isLiupo, isSanxing, getSanxingType, isCompleteSanhe, isCompleteSanhui, getTianGanHeWuxing, getYiMa, getTaoHua, getWuxingChangSheng, SanxingType, };
export interface StemRelationProfile {
    name: string;
    index: number;
    wuxing: string;
    yinYang: '阳' | '阴';
    combine: string;
    combineWuxing: string;
    clash?: string;
}
export interface BranchRelationProfile {
    name: string;
    index: number;
    zodiac: string;
    wuxing: string;
    yinYang: '阳' | '阴';
    hiddenStems: string[];
    combine: string;
    combineWuxing: string;
    clash: string;
    harm: string;
    break: string;
    hiddenCombine?: string;
    punishment: string;
    punishments: string[];
    punishmentType?: string;
    sanhe: {
        group: string;
        partners: string[];
    };
    sanhui?: {
        group: string;
        members: string[];
    };
}
export interface GanZhiCalculationStep {
    key: string;
    stage: '输入核验' | '六十甲子定位' | '天干资料整理' | '地支资料整理' | '纳音汇总';
    status: '已核验' | '已查询' | '已整理';
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '干支计算步骤只证明输入如何映射到六十甲子序号、天干、地支、纳音与固定关系表；不得把步骤完整度解释为吉凶、事件概率或关系必然成立';
}
export interface GanZhiSourceFact {
    key: string;
    type: '六十甲子' | '纳音' | '天干资料' | '地支资料';
    status: '已查询';
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '干支资料事实只记录当前干支在公共表中的固定属性与关系候选；合冲刑害破是否在具体命盘、课盘或时空条件中成立，必须由上层算法另行判断';
}
export interface GanZhiLimitationFact {
    key: string;
    type: '固定资料边界' | '关系成立边界' | '纳音解释边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '干支限制事实用于约束固定资料的解释范围，不得被反向当作现实结果、吉凶评分、事件概率或唯一结论的证据';
}
export interface GanZhiSummaryFact {
    key: string;
    status: '证据链完整';
    factKeys: string[];
    calculationStepCount: number;
    sourceFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '干支证据汇总只统计六十甲子定位、天干、地支、纳音和解释边界的覆盖，不表示传统关系在具体问题中已经触发';
}
export interface GanZhiEvidenceFields {
    key: string;
    status: '已查询';
    calculationSteps: GanZhiCalculationStep[];
    calculationChain: string[];
    sourceFacts: GanZhiSourceFact[];
    summaryFact: GanZhiSummaryFact;
    limitations: string[];
    limitationFacts: GanZhiLimitationFact[];
    source: string;
    promptText: string;
}
export interface GanZhiBaseProfile {
    ganZhi: string;
    index: number;
    yinYang: '阳' | '阴';
    nayin: string;
    nayinWuxing: string;
    stem: StemRelationProfile;
    branch: BranchRelationProfile;
}
export interface GanZhiProfile extends GanZhiBaseProfile, GanZhiEvidenceFields {
}
/** 返回六十甲子副本，避免调用方改写公共序列。 */
export declare function getSixtyCycle(): string[];
/** 天干基础属性与合冲关系。 */
export declare function getStemRelations(stem: string): StemRelationProfile;
/** 地支基础属性、藏干与合冲刑害破关系。 */
export declare function getBranchRelations(branch: string): BranchRelationProfile;
/** 生成单个六十甲子的完整可复用资料。 */
export declare function describeGanZhi(ganZhi: string): GanZhiProfile;
/** 干支纪时结果 */
export interface GanZhiDate {
    year: string;
    month: string;
    day: string;
    hour: string;
}
/**
 * 把公历时间统一转换为 tyme4ts 的农历时辰对象。
 *
 * 注意：`LunarHour.fromYmdHms` 接收的是农历年月日，不能直接用于公历输入；
 * 公历必须先创建 `SolarTime`，再调用 `getLunarHour()`。
 */
export declare function getLunarHourFromDate(date: Date): import("tyme4ts").LunarHour;
/** 从公历时间获取四柱干支（委托 tyme4ts，已含节气换月、真太阳时请在上层处理） */
export declare function getGanZhiFromDate(date: Date): GanZhiDate;
/** 天干五行（委托 tyme4ts，回退到本地表） */
export declare function getStemWuxing(stem: string): string;
/** 天干阴阳 */
export declare function getStemYinYang(stem: string): '阳' | '阴';
/** 地支阴阳 */
export declare function getBranchYinYang(branch: string): '阳' | '阴';
/** 干支阴阳（以天干阴阳为准） */
export declare function getGanZhiYinYang(ganZhi: string): '阳' | '阴';
/** 天干序号（0-9） */
export declare function getStemIndex(stem: string): number;
/** 地支序号（0-11） */
export declare function getBranchIndex(branch: string): number;
/** 两干支相差的序数差（用于太乙等推算） */
export declare function diffGanZhi(from: string, to: string): number;
/** 六十甲子序号（0-59），甲子为 0 */
export declare function getSixtyCycleIndex(ganZhi: string): number;
/** 获取指定干支所属旬的旬首，如乙丑属于甲子旬。 */
export declare function getXunHead(ganZhi: string): string;
/** 纳音（如「海中金」，委托 tyme4ts，与《纳音歌》一致） */
export declare function getNayin(ganZhi: string): string;
/** 纳音五行（纳音名称均以五行字结尾，如海中金、炉中火） */
export declare function getNayinWuxing(ganZhi: string): string;
export declare function getChangShengState(wuxing: string, branch: string): ChangShengState;
/** 生肖（由年支取） */
export declare function getZodiac(yearBranch: string): string;
/** 地支五行（委托 tyme4ts，回退到本地表） */
export declare function getBranchWuxing(branch: string): string;
/** 地支六合（委托 tyme4ts） */
export declare function isLiuhe(a: string, b: string): boolean;
/** 地支六冲（委托 tyme4ts） */
export declare function isLiuchong(a: string, b: string): boolean;
/** 地支六害（委托 tyme4ts） */
export declare function isLiuhai(a: string, b: string): boolean;
/** 天干五合（委托 tyme4ts） */
export declare function isTianGanHe(a: string, b: string): boolean;
/** 地支对宫（委托 tyme4ts） */
export declare function getOppositeBranch(branch: string): string;
/** 十神：以 dayStem 为日主，求 stem 的相对十神（委托 tyme4ts，新增能力） */
export declare function getTenStar(dayStem: string, stem: string): string;
export declare const ganzhi: {
    HEAVENLY_STEMS: readonly ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    EARTHLY_BRANCHES: readonly ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    ZODIACS: readonly ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
    SIXTY_CYCLE: readonly string[];
    SIX_XUN_HEADS: readonly string[];
    getLunarHourFromDate: typeof getLunarHourFromDate;
    getGanZhiFromDate: typeof getGanZhiFromDate;
    getStemWuxing: typeof getStemWuxing;
    getStemYinYang: typeof getStemYinYang;
    getBranchYinYang: typeof getBranchYinYang;
    getGanZhiYinYang: typeof getGanZhiYinYang;
    getStemIndex: typeof getStemIndex;
    getBranchIndex: typeof getBranchIndex;
    getSixtyCycle: typeof getSixtyCycle;
    getSixtyCycleIndex: typeof getSixtyCycleIndex;
    getXunHead: typeof getXunHead;
    diffGanZhi: typeof diffGanZhi;
    isValidGanZhi: typeof isValidGanZhi;
    getNayin: typeof getNayin;
    getNayinWuxing: typeof getNayinWuxing;
    getChangShengState: typeof getChangShengState;
    getZodiac: typeof getZodiac;
    getBranchWuxing: typeof getBranchWuxing;
    isLiuhe: typeof isLiuhe;
    isLiuchong: typeof isLiuchong;
    isLiuhai: typeof isLiuhai;
    isTianGanHe: typeof isTianGanHe;
    getOppositeBranch: typeof getOppositeBranch;
    getTenStar: typeof getTenStar;
    getStemRelations: typeof getStemRelations;
    getBranchRelations: typeof getBranchRelations;
    describeGanZhi: typeof describeGanZhi;
};
