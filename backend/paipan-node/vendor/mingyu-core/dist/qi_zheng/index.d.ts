import { type AstronomicalTimeEvidence } from '../calendar/astronomical-time';
import { type MoonPhaseEvidence } from '../calendar/moon-phase-evidence';
import { type SolarIlluminationEvidence } from '../calendar/solar-illumination-evidence';
import type { PromptEvidenceBundle } from '../prompt-evidence/types';
import { calculateQizhengMansionBoundaries, longitudeToQizhengMansion, QIZHENG_MANSION_MODEL, type QizhengMansionBoundary } from './mansion-boundaries';
import { type QizhengPeriodEventCollection } from './period-events';
import { type QizhengTimeLordResult } from './time-lords';
import { type QizhengEnNanProfile } from './en-nan';
export { calculateQizhengMansionBoundaries, longitudeToQizhengMansion, QIZHENG_MANSION_MODEL, QIZHENG_MANSION_STARS, } from './mansion-boundaries';
export type { QizhengMansionBoundary, QizhengMansionStar } from './mansion-boundaries';
/** 黄道十二宫（七政四余职名，子丑寅卯…自命宫逆布十二职） */
export declare const TWELVE_PALACES: string[];
/**
 * 现代回归黄经十二宫与传统宫支的固定对应。
 * astronomy-engine 的 0 宫从白羊起，而传统果老盘按戌、酉……亥排列，二者不可共用同一数字序。
 */
export declare const QIZHENG_SIGN_BRANCHES: readonly ["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"];
export type QizhengSignBranch = (typeof QIZHENG_SIGN_BRANCHES)[number];
export interface QizhengStar {
    name: string;
    kind: '七政' | '四余';
    tropicalLongitude: number;
    longitude: number;
    xiu: string;
    sevenStar: string;
    xiuDegree: number;
    signIndex: number;
    signBranch: QizhengSignBranch;
    palace: string;
    retrograde?: boolean;
    dignity?: string;
    sourceId: QizhengPositionSourceId;
    sourceLabel: string;
    precisionClass: '现代天文计算' | '传统均速模型';
}
export interface QizhengAspect {
    star1: string;
    star2: string;
    type: '同宫' | '六合' | '四正' | '三方' | '对照';
    exactAngle: number;
    actualAngle: number;
    orb: number;
    allowedOrb: number;
    /** 偏差占当前相位容许度的比例，0为精确相位，1为容许度边界。 */
    orbRatio: number;
    closeness: '紧密' | '中等' | '宽松';
    precisionClass: '同层现代天文' | '混合模型';
    source: string;
}
export type QizhengPositionSourceId = 'astronomy-engine-planets' | 'astronomy-engine-true-node' | 'moshier-mean-lilith' | 'qizhengsuan-ziqi';
export interface QizhengPositionSource {
    id: QizhengPositionSourceId;
    objects: string[];
    provider: string;
    calculation: string;
    coordinate: string;
    precisionClass: '现代天文计算' | '传统均速模型';
    limitations: string[];
}
export interface QizhengCalculationContext {
    /** 传统宫位时间口径 */
    palaceTimeMode?: '民用时间' | '真太阳时混合口径';
    palaceTimeNote?: string;
    localDateTime: string;
    utcDateTime: string;
    timezone: number;
    latitude: number;
    longitude: number;
    locationSource: '用户提供' | '默认北京坐标' | '部分坐标使用默认值';
    timezoneSource: 'IANA历史时区' | '用户提供' | '默认东八区';
    astronomicalTime: AstronomicalTimeEvidence;
    moonPhase: MoonPhaseEvidence;
    solarIllumination: SolarIlluminationEvidence;
    coordinatePipeline: string[];
}
export interface QizhengEvidenceAnalysis {
    key: 'qizheng:evidence';
    status: '已计算';
    calculationFact: QizhengCalculationFact;
    calculationSteps: QizhengCalculationStep[];
    calculationChain: string[];
    positionSourceFacts: QizhengPositionSourceFact[];
    starFacts: QizhengStarFact[];
    aspectFacts: QizhengAspectFact[];
    primaryFacts: string[];
    supportingFacts: string[];
    counterEvidence: string[];
    counterEvidenceFacts: QizhengCounterEvidenceFact[];
    counterSummaryFact: QizhengCounterSummaryFact;
    limitations: string[];
    limitationFacts: QizhengLimitationFact[];
    summaryFact: QizhengSummaryFact;
    evidence: PromptEvidenceBundle;
    promptText: string;
    methodology: string[];
}
export interface QizhengCalculationStep {
    key: string;
    stage: '民用时间转UTC' | '天文时间尺度' | '现代位置计算' | '紫炁古法计算' | '距星宿界换算' | '宿度与落宫' | '吊照筛选';
    status: '已计算';
    inputs: Record<string, string | number | boolean>;
    result: Record<string, string | number | boolean>;
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '七政四余计算步骤只记录民用时间、天文时间尺度、位置模型、距星宿界、宿度落宫与吊照筛选的形成过程；不得把步骤完整度解释为观测级精度、占星有效性、现实吉凶或事件概率';
}
export interface QizhengCalculationFact {
    key: 'calculation:qizheng:chart';
    status: '输入明确' | '含默认值';
    defaults: string[];
    context: {
        localDateTime: string;
        utcDateTime: string;
        timezone: number;
        latitude: number;
        longitude: number;
        locationSource: QizhengCalculationContext['locationSource'];
        timezoneSource: QizhengCalculationContext['timezoneSource'];
    };
    steps: QizhengCalculationStep[];
    promptText: string;
    sources: string[];
    limitation: '计算链只证明民用时间、时区、地点、天文时间尺度、位置模型和坐标换算如何形成当前七政四余盘；默认地点、近似时间尺度与传统均速模型不得提升为真实出生地或观测级精度，也不证明现实事件或吉凶结果';
}
export interface QizhengPositionSourceFact {
    key: string;
    sourceId: QizhengPositionSourceId;
    status: '已采用';
    objects: string[];
    provider: string;
    calculation: string;
    coordinate: string;
    precisionClass: QizhengPositionSource['precisionClass'];
    adoptedSources: string[];
    limitations: string[];
    promptLimitations: string[];
    promptText: string;
    limitation: '位置来源事实只说明各星体采用的提供方、模型、坐标和精度层级；来源可追溯不等于结果达到观测级精度，也不证明占星解释、现实事件或吉凶结论';
}
export interface QizhengStarFact {
    key: string;
    name: string;
    kind: QizhengStar['kind'];
    tropicalLongitude: number;
    siderealLongitude: number;
    xiu: string;
    sevenStar: string;
    xiuDegree: number;
    signIndex: number;
    signBranch: QizhengSignBranch;
    palace: string;
    retrograde?: boolean;
    dignity?: string;
    sourceId: QizhengPositionSourceId;
    sourceLabel: string;
    precisionClass: QizhengStar['precisionClass'];
    promptText: string;
    sources: string[];
    limitation: '逐星位置是目标日期黄经、距星宿度与落宫的计算事实；现代天文计算和传统均速模型必须分层使用，不单独证明人格、现实事件、吉凶或应期';
}
export interface QizhengAspectFact {
    key: string;
    star1: string;
    star2: string;
    type: QizhengAspect['type'];
    exactAngle: number;
    actualAngle: number;
    orb: number;
    allowedOrb: number;
    orbRatio: number;
    closeness: QizhengAspect['closeness'];
    precisionClass: QizhengAspect['precisionClass'];
    promptText: string;
    sources: string[];
    limitation: '吊照相位只描述两星目标日期黄经在当前容许度内的几何关系；混合模型不得提升为现代天文同精度证据，也不代表吉凶比例、事件概率或必然结果';
}
export interface QizhengCounterEvidenceFact {
    key: string;
    type: '输入完整性' | '位置精度分层' | '吊照覆盖';
    status: '输入明确' | '含默认值' | '同层现代天文' | '混合模型' | '有可用证据' | '未见';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证事实只记录七政四余输入是否使用默认值、位置来源是否混合精度及当前容许度内是否有吊照；默认值、混合模型或未见吊照不直接等于现实不利，有资料也不证明吉凶结果';
}
export interface QizhengCounterSummaryFact {
    key: 'qizheng:counter-summary';
    status: '存在需保留反证' | '未见额外反证';
    factKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '反证汇总只用于防止忽略默认输入、混合精度和吊照未见项；不得据反证数量生成吉凶总分、可信度、事件概率或精度评分';
}
export interface QizhengLimitationFact {
    key: string;
    type: '输入默认边界' | '时间尺度边界' | '位置来源边界' | '混合精度边界' | '吊照边界' | '月相光照边界' | '高风险输出边界';
    status: '适用';
    ownerFactKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束七政四余输入、时间尺度、位置来源、混合模型、吊照、月相和光照资料可以支持的解释范围，不得被反向当作现实事件、吉凶或精度证据';
}
export interface QizhengSummaryFact {
    key: 'qizheng:evidence-summary';
    status: '证据链完整' | '证据链有缺口';
    factKeys: string[];
    positionSourceFactCount: number;
    starFactCount: number;
    aspectFactCount: number;
    counterEvidenceCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '七政四余证据汇总只统计输入、时间尺度、位置来源、逐星、吊照、月相光照、反证与限制覆盖；不得按数量生成吉凶等级、可信度、事件概率、观测精度或固定应期';
}
export interface QizhengInput {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
    latitude?: number;
    longitude?: number;
    timezone?: number;
    timeZoneId?: string;
    /**
     * 可选：启用后仅用真太阳时校正传统命身十二宫排布；
     * 七政四余天体位置仍按现代星历与天文时间尺度计算。
     */
    useTrueSolarTime?: boolean;
    /** 排行限时需要；阳男阴女顺行，阴男阳女逆行 */
    gender?: 'male' | 'female';
    /** 流年公元年；不传则只排本命静态盘 */
    flowYear?: number;
    flowMonth?: number;
    flowDay?: number;
    flowHour?: number;
    flowMinute?: number;
}
export declare const QIZHENG_TRADITIONAL_CHART_DISABLED_MESSAGE = "\u4E03\u653F\u56DB\u4F59\u4F20\u7EDF\u76D8\u5DF2\u6062\u590D\uFF1B\u6B64\u5E38\u91CF\u4EC5\u4E3A\u65E7\u8C03\u7528\u65B9\u517C\u5BB9\u4FDD\u7559\u3002";
export interface QizhengResult {
    stars: QizhengStar[];
    aspects: QizhengAspect[];
    mingGong: number;
    shenGong: number;
    mingZhu: string;
    twelvePalaces: {
        palace: string;
        signIndex: number;
        signBranch: QizhengSignBranch;
    }[];
    shensha: {
        name: string;
        value: string;
    }[];
    ziqiModel: ZiqiModelInfo;
    ziqi: ZiqiPosition;
    calculationContext: QizhengCalculationContext;
    positionSources: QizhengPositionSource[];
    mansionBoundaries: QizhengMansionBoundary[];
    mansionModel: typeof QIZHENG_MANSION_MODEL;
    evidenceAnalysis: QizhengEvidenceAnalysis;
    enNan?: QizhengEnNanProfile;
    timeLords?: QizhengTimeLordResult;
    flowingStars?: QizhengFlowingStarsResult;
    prompt: string;
}
export interface QizhengFlowingStar {
    name: string;
    kind: QizhengStar['kind'];
    tropicalLongitude: number;
    longitude: number;
    xiu: string;
    xiuDegree: number;
    signIndex: number;
    signBranch: QizhengSignBranch;
    palace: string;
    retrograde?: boolean;
    dignity?: string;
    sourceId: QizhengPositionSourceId;
    precisionClass: QizhengStar['precisionClass'];
}
export interface QizhengFlowingStarsResult {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    timestampNote: string;
    localDateTime: string;
    stars: QizhengFlowingStar[];
    transits: QizhengAspect[];
    periodEvents?: QizhengPeriodEventCollection;
}
export interface ZiqiSource {
    title: string;
    url: string;
    category: '古籍原文' | '古籍校勘' | '开源复原' | '开源对照';
    usage: '采用' | '校勘说明' | '未采用';
    evidence: string;
}
export interface ZiqiModelInfo {
    id: string;
    name: string;
    direction: '顺行';
    cycleYears: number;
    periodDays: number;
    dailyMotionDegrees: number;
    classicalDegreeRate: string;
    classicalDailyMotion: string;
    classicalEpoch: string;
    classicalWinterSolsticeOffsetDays: number;
    modernEpochUtc: string;
    modernEpochTropicalLongitude: number;
    formula: string;
    coordinate: string;
    precision: string;
    sources: ZiqiSource[];
}
export interface ZiqiPosition {
    tropicalLongitude: number;
    siderealLongitude: number;
    direction: '顺行';
    dailyMotionDegrees: number;
    cycleProgress: number;
    daysSinceZeroLongitude: number;
    daysUntilZeroLongitude: number;
}
/**
 * 紫炁唯一采用的古法模型。
 *
 * 《七政算内篇》载「顺行二十八年一周天」、周积 10227.1792 日、至后策 1256.5224 日；
 * PlanetCalendar 将该立元数据复原为 1995-12-31 09:00 韩国标准时（即 00:00 UTC）
 * 回归黄经 237.038993°，日行 0.0352003219030327°。
 */
export declare const ZIQI_MODEL_INFO: ZiqiModelInfo;
export declare const QIZHENG_POSITION_SOURCES: QizhengPositionSource[];
/** 依《七政算内篇》单一古法模型计算紫炁回归黄经。 */
export declare function calculateZiqiTropicalLongitude(input: QizhengInput): number;
/**
 * J2000.0 至目标年份的黄经岁差（IAU 2006 近似，单位：度）。
 * 23.44° 是黄赤交角，不能作为岁差基数；2024 年累计岁差约 0.34°。
 */
export declare function getPrecessionOffset(year: number): number;
/** 返回紫炁的完整可审计位置数据；项目中不存在第二套紫炁计算模型。 */
export declare function calculateZiqiPosition(input: QizhengInput): ZiqiPosition;
/** 将现代黄经宫序换成传统宫支。 */
export declare function getQizhengSignBranch(signIndex: number): QizhengSignBranch;
/** 按命宫实际宫支查命主，避免把白羊起的黄经宫序误作子支起序。 */
export declare function getQizhengMingZhu(signIndex: number): string;
/** 《星学大成》七政庙旺喜乐判定；同一宫命中多种状态时全部保留。 */
export declare function getQizhengDignity(key: string, signIndex: number): string;
/** 生成七政四余盘 */
export declare function generateQizheng(input: QizhengInput): QizhengResult;
export { evaluateQizhengEnNan } from './en-nan';
export type { QizhengEnNanProfile } from './en-nan';
export { buildQizhengTimeLords, palaceIndexByLimitStep, resolveQizhengLimitDirection, resolveQizhengNominalAge, } from './time-lords';
export type { QizhengLimitDirection, QizhengTimeLordResult } from './time-lords';
export declare const qizheng: {
    generateQizheng: typeof generateQizheng;
    getPrecessionOffset: typeof getPrecessionOffset;
    calculateZiqiTropicalLongitude: typeof calculateZiqiTropicalLongitude;
    calculateZiqiPosition: typeof calculateZiqiPosition;
    ZIQI_MODEL_INFO: ZiqiModelInfo;
    QIZHENG_POSITION_SOURCES: QizhengPositionSource[];
    QIZHENG_MANSION_STARS: readonly import("./mansion-boundaries").QizhengMansionStar[];
    QIZHENG_MANSION_MODEL: {
        readonly id: "qizheng-mansion-stars-simbad-astronomy-engine";
        readonly catalogEpoch: "J2000.0 / ICRS";
        readonly mappingSource: "https://zh.wikipedia.org/w/index.php?title=二十八宿&oldid=92223725";
        readonly astrometrySource: "SIMBAD TAP basic 表（ra、dec、pmra、pmdec；查询日期 2026-07-27）";
        readonly transformSource: "Astronomy Engine 2.1.19 同口径内置变换：IAU 2006 岁差与 IAU 2000B 章动，将 J2000 平赤道坐标转为目标日期真黄道坐标";
        readonly limitation: "宿界按距星目标日期真黄经至下一距星真黄经的实际弧段划分；这是可复算的现代坐标复原，不等同于某一历史历元的古赤道距度表，也不证明占星解释有效。";
    };
    QIZHENG_SIGN_BRANCHES: readonly ["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"];
    getQizhengSignBranch: typeof getQizhengSignBranch;
    getQizhengMingZhu: typeof getQizhengMingZhu;
    getQizhengDignity: typeof getQizhengDignity;
    calculateQizhengMansionBoundaries: typeof calculateQizhengMansionBoundaries;
    longitudeToQizhengMansion: typeof longitudeToQizhengMansion;
};
