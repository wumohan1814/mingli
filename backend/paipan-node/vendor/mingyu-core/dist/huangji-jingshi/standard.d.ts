export declare const HUANGJI_STANDARD_EPOCH: Readonly<{
    model: "先天圆图值年卦通行排法";
    yuanStartYear: -67017;
    annualAnchorYear: 1984;
    annualAnchorHexagram: "鼎";
    calendar: "公元纪年（无公元0年）";
}>;
export declare const HUANGJI_CIRCLE_HEXAGRAMS: readonly ["复", "颐", "屯", "益", "震", "噬嗑", "随", "无妄", "明夷", "贲", "既济", "家人", "丰", "革", "同人", "临", "损", "节", "中孚", "归妹", "睽", "兑", "履", "泰", "大畜", "需", "小畜", "大壮", "大有", "夬", "姤", "大过", "鼎", "恒", "巽", "井", "蛊", "升", "讼", "困", "未济", "解", "涣", "蒙", "师", "遁", "咸", "旅", "小过", "渐", "蹇", "艮", "谦", "否", "萃", "晋", "豫", "观", "比", "剥"];
export interface HuangjiHexagramSummary {
    id: number;
    name: string;
    shortName: string;
    symbol: string;
    upper: string;
    lower: string;
    judgment: string;
}
export interface HuangjiPeriodHexagram {
    hexagram: HuangjiHexagramSummary;
    startYear: number;
    endYear: number;
    durationYears: number;
    derivedFrom?: string;
    changedLine?: number;
    changedLineText?: string;
}
export interface HuangjiStandardForecast {
    model: typeof HUANGJI_STANDARD_EPOCH;
    hui: {
        indexInYuan: number;
        branch: string;
        startYear: number;
        endYear: number;
    };
    hexagrams: {
        governing: HuangjiPeriodHexagram;
        yun: HuangjiPeriodHexagram;
        sixtyYear: HuangjiPeriodHexagram;
        decade: HuangjiPeriodHexagram;
        annual: HuangjiHexagramSummary & {
            year: number;
            ganzhi: string;
        };
    };
    relatedHexagrams: {
        mutual: HuangjiHexagramSummary;
        opposite: HuangjiHexagramSummary;
        reversed: HuangjiHexagramSummary;
    };
    reading: {
        headline: string;
        cycleContext: string;
        annualFocus: string;
        interpretationOrder: string[];
    };
}
export declare function civilYearToSerial(year: number): number;
export declare function serialYearToCivil(year: number): number;
export declare function formatHuangjiCivilYear(year: number): string;
export declare function calculateStandardHuangjiForecast(year: number): HuangjiStandardForecast;
