import type { BaziChartResult, Person } from './baziTypes';
import type { ShenShaScope } from './baziShenSha/scope';
export type BaziInputText = string | number;
/** 面向 JSON、表单和服务端请求的八字出生资料草稿。 */
export interface BaziChartInputDraft {
    gender: 'male' | 'female' | '';
    year: BaziInputText;
    month: BaziInputText;
    day: BaziInputText;
    timeIndex: number | '';
    dateType?: 'solar' | 'lunar';
    isLeapMonth?: boolean;
    useTrueSolarTime?: boolean;
    birthHour?: BaziInputText;
    birthMinute?: BaziInputText;
    birthPlace?: string;
    birthLongitude?: BaziInputText;
    timezone?: number;
    timeZoneId?: string;
    applyChinaDst?: boolean;
    age?: number;
    shenShaScope?: ShenShaScope;
}
/** 将普通 JSON 或页面表单值转换为严格的八字 Person 输入。 */
export declare function buildBaziPersonInput(input: BaziChartInputDraft): Person;
/** 直接从普通 JSON/表单输入完成八字排盘。 */
export declare function calculateBaziChartFromInput(input: BaziChartInputDraft): BaziChartResult;
