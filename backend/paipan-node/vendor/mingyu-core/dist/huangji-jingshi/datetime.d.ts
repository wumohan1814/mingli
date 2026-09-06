/**
 * @file 皇极经世年月日时卦
 * @description 依黄畿所释“一六为经、六六为纬”的分形推衍，将值年卦继续细分至月经、旬纬、日与时经。
 * @传统依据 《皇极经世书传》所述“求月日时分直之卦，又岂有异乎”及“自子半至寅半”时段规则。
 */
import { type HuangjiHexagramSummary } from './standard';
export interface HuangjiDerivedHexagram extends HuangjiHexagramSummary {
    derivedFrom?: string;
    changedLine?: number;
    sequenceOffset?: number;
}
export interface HuangjiDateTimeForecast {
    model: '黄畿分形同构年月日时推衍';
    civilTime: {
        dateTime: string;
        timezone: '北京时间（UTC+8）';
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    };
    calendar: {
        forecastYear: number;
        activeSolarTerm: string;
        actualDayInSolarTerm: number;
        mappedDayInSolarTerm: number;
        monthIndex: number;
        monthBranch: string;
        dayOfMonth: number;
        dayOfYear: number;
        hourSegment: number;
        hourRange: string;
    };
    hexagrams: {
        annual: HuangjiHexagramSummary & {
            year: number;
            ganzhi: string;
        };
        monthJing: HuangjiDerivedHexagram;
        xunWei: HuangjiDerivedHexagram;
        daily: HuangjiDerivedHexagram;
        hourJing: HuangjiDerivedHexagram;
    };
    calculationChain: string[];
    sources: Array<{
        title: string;
        scope: string;
    }>;
    limitations: string[];
}
export declare function calculateHuangjiDateTimeForecast(date: Date): HuangjiDateTimeForecast;
