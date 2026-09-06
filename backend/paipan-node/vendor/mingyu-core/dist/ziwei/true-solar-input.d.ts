import { type TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
export interface ZiweiTrueSolarInput {
    dateType: 'solar' | 'lunar';
    year: string;
    month: string;
    day: string;
    isLeapMonth: boolean;
    birthHour: string;
    birthMinute: string;
    birthLongitude: string;
    timezone?: number;
    timeZoneId?: string;
    applyChinaDst?: boolean;
}
export interface ZiweiTrueSolarBirth {
    /** 真太阳时校正后的公历日期，格式 YYYY-MM-DD。 */
    birthDate: string;
    /** 紫微排盘使用的时辰索引，范围 0-12。 */
    birthTimeIndex: number;
    /** 历法换算、夏令时、经度时差、均时差、跨日与时辰映射的统一证据。 */
    trueSolarEvidence: TrueSolarTimeEvidenceFields;
}
/** 将紫微出生资料按经度校正为真太阳时日期和时辰索引。 */
export declare function resolveZiweiTrueSolarBirth(input: ZiweiTrueSolarInput): ZiweiTrueSolarBirth;
