import { type SolarDateTimeParts, type TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
import type { BaziChartResult, Person } from '../bazi/baziTypes';
import type { AlmanacParticipantInput, AstrolabeBirthInput } from '../types/divination';
import type { ChartInput } from '../types/chart';
import type { QizhengInput } from '../qi_zheng';
import { MingyuCoreError, type CoreDiagnostic } from '../shared/result';
import { type BirthPlaceCoordinateAccuracy } from '../location';
import { type BirthTimeEvidence, type BirthTimeInputMode, type BirthTimePrecision } from './evidence';
export { clampNumericField, validateBirthInput, type BirthInputFields, type BirthInputText, type BirthInputValidationResult, } from './input';
export type { BirthTimeCalculationStep, BirthTimeEvidence, BirthTimeInputFact, BirthTimeInputMode, BirthTimeLimitationFact, BirthTimePrecision, BirthTimeSummaryFact, } from './evidence';
export type BirthGender = 'male' | 'female' | 'unspecified';
export type BirthCalendarType = 'solar' | 'lunar';
export interface BirthProfileLocation {
    /** 中国省、市、区行政区代码；提供后可自动补全地点名称和坐标。 */
    regionId?: string;
    name?: string;
    longitude?: number;
    latitude?: number;
    /** 当地标准时区，例如中国为 UTC+8。 */
    timezone?: number;
    /** IANA 历史时区，例如 America/New_York。 */
    timeZoneId?: string;
}
export interface ResolvedBirthProfileLocation {
    regionId?: string;
    name?: string;
    longitude: number;
    latitude?: number;
    timezone?: number;
    timeZoneId?: string;
    coordinateAccuracy?: BirthPlaceCoordinateAccuracy | 'user-provided' | 'mixed';
}
/**
 * 跨算法复用的出生档案。
 *
 * 此类型只描述客观出生输入，不包含页面状态、报告偏好或用户历史。
 */
export interface BirthProfile {
    id?: string;
    name?: string;
    gender: BirthGender;
    calendarType: BirthCalendarType;
    year: number;
    month: number;
    day: number;
    /** 精准出生小时；与 minute 成对提供。 */
    hour?: number;
    /** 精准出生分钟；与 hour 成对提供。 */
    minute?: number;
    /** 明确传统时辰索引，范围 0-12；未启用真太阳时时可替代精准时分。 */
    timeIndex?: number;
    second?: number;
    isLeapMonth?: boolean;
    location?: BirthProfileLocation;
    useTrueSolarTime?: boolean;
    applyChinaDst?: boolean;
}
export type BirthProfileDiagnosticCode = 'LOCATION_REQUIRED_FOR_TRUE_SOLAR_TIME' | 'LOCATION_NOT_FOUND' | 'LOCATION_COORDINATES_REQUIRED' | 'LATITUDE_REQUIRED' | 'GENDER_REQUIRED' | 'TIME_REQUIRED' | 'PRECISE_TIME_REQUIRED' | 'TIME_INPUT_CONFLICT';
export type BirthProfileDiagnostic = CoreDiagnostic<BirthProfileDiagnosticCode>;
export interface NormalizedBirthProfile {
    profile: BirthProfile;
    /** 已按行政区代码补全并校验的实际排盘地点。 */
    resolvedLocation?: ResolvedBirthProfileLocation;
    solarClockTime: SolarDateTimeParts;
    effectiveTime: SolarDateTimeParts;
    timeIndex: number;
    timeInputMode: BirthTimeInputMode;
    timePrecision: BirthTimePrecision;
    usedTrueSolarTime: boolean;
    trueSolarEvidence?: TrueSolarTimeEvidenceFields;
    timeEvidence: BirthTimeEvidence;
    diagnostics: BirthProfileDiagnostic[];
}
export declare class BirthProfileError extends MingyuCoreError<BirthProfileDiagnosticCode> {
    constructor(diagnostic: BirthProfileDiagnostic);
}
/** 将行政区代码或显式坐标统一为可直接排盘的出生地点。 */
export declare function resolveBirthProfileLocation(location?: BirthProfileLocation): ResolvedBirthProfileLocation | undefined;
/**
 * 校验并统一出生档案的时间口径。
 *
 * 未启用真太阳时时，可直接提供明确传统时辰；启用真太阳时时必须提供完整小时和分钟。
 * 两种模式都只形成一个确定结果，不生成候选盘、敏感性结果或缺时柱命盘。
 */
export declare function normalizeBirthProfile(profile: BirthProfile): NormalizedBirthProfile;
/** 将统一档案转换为八字既有输入。 */
export declare function birthProfileToBaziPerson(profile: BirthProfile): Person;
/** 直接按统一出生档案生成八字传统盘数据。 */
export declare function calculateBaziFromBirthProfile(profile: BirthProfile): BaziChartResult;
/** 将统一出生档案转换为紫微斗数传统盘的 ChartInput。 */
export declare function birthProfileToZiweiChartInput(profile: BirthProfile): ChartInput;
/** 将统一出生档案转换为星盘既有输入。星盘必须有经纬度和准确时辰。 */
export declare function birthProfileToAstrolabeInput(profile: BirthProfile): AstrolabeBirthInput;
/**
 * 将统一出生档案转换为七政四余输入。
 *
 * 七政四余只接受公历时刻，因此农历档案先沿用统一档案的公历钟表时间。
 * 启用真太阳时后，把原始民用时间交给七政四余自身校正，避免重复校正；
 * 这与八字、紫微适配器的输出口径不同，调用方不应混用已校正时间。
 */
export declare function birthProfileToQizhengInput(profile: BirthProfile): QizhengInput;
/** 将统一档案转换为择日参与人既有输入。 */
export declare function birthProfileToAlmanacParticipant(profile: BirthProfile, id?: string): AlmanacParticipantInput;
