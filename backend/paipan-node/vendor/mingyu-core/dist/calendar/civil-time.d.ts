/**
 * @file 民用时间统一解析
 * @description 统一处理当地钟表时间、固定 UTC 偏移与 IANA 历史时区，供真太阳时、星盘和天文时间共用。
 */
import { type HistoricalTimezoneEvidence } from './historical-timezone';
export declare const MIN_FIXED_TIMEZONE_HOURS = -12;
export declare const MAX_FIXED_TIMEZONE_HOURS = 14;
export declare const DEFAULT_CHINA_TIMEZONE_HOURS = 8;
export declare const DEFAULT_CHINA_TIME_ZONE_ID = "Asia/Shanghai";
export interface CivilDateTimeParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}
export interface CivilTimeZoneInput {
    /** 已确认的法定 UTC 偏移；有 IANA 时区时仅用于重复时刻消歧和一致性核验。 */
    timezone?: number;
    /** IANA 历史时区，例如 Asia/Shanghai、America/New_York。 */
    timeZoneId?: string;
}
export interface CivilTimeResolutionInput extends CivilDateTimeParts, CivilTimeZoneInput {
}
export interface CivilTimeResolutionOptions {
    /** 没有提供任何时区时使用的固定偏移；省略表示必须显式提供时区。 */
    defaultTimezone?: number;
}
export interface CivilTimeResolution {
    localTime: CivilDateTimeParts;
    localDateTime: string;
    timezone: number;
    timeZoneId?: string;
    timezoneEvidence?: HistoricalTimezoneEvidence;
    timezoneSource: 'default-fixed-offset' | 'fixed-offset' | 'iana-time-zone';
    utcTimestamp: number;
    utcDateTime: string;
}
export declare function formatCivilDateTime(value: CivilDateTimeParts): string;
/** 将固定 UTC 偏移格式化为 ISO 8601 后缀，保留历史时区可能出现的秒级偏移。 */
export declare function formatFixedTimezoneOffset(timezone: number): string;
export declare function assertFixedTimezoneHours(value: number, label?: string): void;
/**
 * 将当地钟表时间解析为唯一 UTC 时刻。
 *
 * 统一口径：IANA 时区优先；同时提供 timezone 时只用于回拨消歧和一致性核验；
 * 不存在的当地时刻、未消解的重复时刻及固定偏移冲突都拒绝继续计算。
 */
export declare function resolveCivilTime(input: CivilTimeResolutionInput, options?: CivilTimeResolutionOptions): CivilTimeResolution;
