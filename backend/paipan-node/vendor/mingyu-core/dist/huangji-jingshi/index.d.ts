/**
 * @file 皇极经世元会运世周期
 * @description 提供通行公元值年卦排盘，以及可选的自定义纪元元会运世换算。
 * @传统依据 《皇极经世》与蔡元定《皇极经世指要》所传一元消长之数。
 */
import { calculateStandardHuangjiForecast, type HuangjiStandardForecast } from './standard';
import { type PromptSchoolId } from '../prompt/schools';
import { calculateHuangjiDateTimeForecast, type HuangjiDateTimeForecast } from './datetime';
import { type HuangjiEraTrendResult } from './trend';
export * from './standard';
export * from './datetime';
export * from './trend';
export declare const HUANGJI_CYCLE_YEARS: Readonly<{
    shi: 30;
    yun: 360;
    hui: 10800;
    yuan: 129600;
}>;
export declare const HUANGJI_CYCLE_COUNTS: Readonly<{
    huiPerYuan: 12;
    yunPerHui: 30;
    yunPerYuan: 360;
    shiPerYun: 12;
    shiPerYuan: 4320;
    yearsPerShi: 30;
}>;
export declare const HUANGJI_JINGSHI_SOURCES: readonly [{
    readonly title: "《皇极经世》";
    readonly scope: "元、会、运、世的层级周期框架。";
}, {
    readonly title: "蔡元定《皇极经世指要》";
    readonly scope: "一元消长之数及元会运世换算的传统整理。";
}, {
    readonly title: "先天六十四卦圆图值年卦通行排法";
    readonly scope: "会内统卦、运卦、六十年统卦、十年卦和值年卦的层级推演。";
}, {
    readonly title: "黄畿《皇极经世书传》";
    readonly scope: "月日时分直卦的分形同构推衍，以及“一六为经、六六为纬”的经纬规则。";
}];
export interface HuangjiJingshiInput {
    /** 自定义纪元模式下某一元第一年的整数坐标；省略时按通行公元值年卦排法。 */
    epochYear?: number;
    /** 公元年或自定义纪元下的目标整数年坐标；通行模式不接受公元 0 年。 */
    year?: number;
    /** 自定义纪元模式下，从纪元第一年起已经过的完整年数。 */
    elapsedYears?: number;
    /** 年月日时起盘时间；提供时不得同时提供 epochYear、year 或 elapsedYears。 */
    date?: Date;
    /** 可选问题，只用于生成完整提示词，不改变换算。 */
    question?: string;
}
export interface HuangjiCycleRange {
    startYear: number;
    endYear: number;
}
export interface HuangjiCycleProgress {
    currentYearIndex: number;
    completedYears: number;
    remainingYearsAfterCurrent: number;
    nextCycleStartYear: number;
}
export interface HuangjiJingshiCalculation {
    input: {
        mode: '通行公元年' | '年月日时' | '年坐标' | '已过年数';
        calendar: '公元纪年（无公元0年）' | '整数坐标';
        epochYear: number;
        year: number;
        elapsedYears: number;
    };
    position: {
        yuan: HuangjiCycleRange & {
            indexFromEpoch: number;
        };
        hui: HuangjiCycleRange & {
            indexInYuan: number;
        };
        yun: HuangjiCycleRange & {
            indexInYuan: number;
            indexInHui: number;
        };
        shi: HuangjiCycleRange & {
            indexInYuan: number;
            indexInYun: number;
        };
        year: {
            coordinate: number;
            indexInShi: number;
            indexInYuan: number;
        };
    };
    progress: {
        yuan: HuangjiCycleProgress;
        hui: HuangjiCycleProgress;
        yun: HuangjiCycleProgress;
        shi: HuangjiCycleProgress;
    };
    conversion: {
        yearsPerShi: 30;
        shiPerYun: 12;
        yearsPerYun: 360;
        yunPerHui: 30;
        yearsPerHui: 10800;
        huiPerYuan: 12;
        yearsPerYuan: 129600;
    };
    calculationChain: string[];
    sources: Array<{
        title: string;
        scope: string;
    }>;
    limitations: string[];
    forecast?: HuangjiStandardForecast;
    dateTimeForecast?: HuangjiDateTimeForecast;
    eraTrend?: HuangjiEraTrendResult;
}
export interface HuangjiJingshiResult extends HuangjiJingshiCalculation {
    prompt: string;
}
export declare function buildHuangjiJingshiPrompt(result: HuangjiJingshiCalculation, question?: string, schools?: readonly PromptSchoolId<'huangji-jingshi'>[]): string;
export declare function calculateHuangjiJingshi(input: HuangjiJingshiInput): HuangjiJingshiResult;
export declare const huangjiJingshi: {
    HUANGJI_CYCLE_YEARS: Readonly<{
        shi: 30;
        yun: 360;
        hui: 10800;
        yuan: 129600;
    }>;
    HUANGJI_CYCLE_COUNTS: Readonly<{
        huiPerYuan: 12;
        yunPerHui: 30;
        yunPerYuan: 360;
        shiPerYun: 12;
        shiPerYuan: 4320;
        yearsPerShi: 30;
    }>;
    HUANGJI_JINGSHI_SOURCES: readonly [{
        readonly title: "《皇极经世》";
        readonly scope: "元、会、运、世的层级周期框架。";
    }, {
        readonly title: "蔡元定《皇极经世指要》";
        readonly scope: "一元消长之数及元会运世换算的传统整理。";
    }, {
        readonly title: "先天六十四卦圆图值年卦通行排法";
        readonly scope: "会内统卦、运卦、六十年统卦、十年卦和值年卦的层级推演。";
    }, {
        readonly title: "黄畿《皇极经世书传》";
        readonly scope: "月日时分直卦的分形同构推衍，以及“一六为经、六六为纬”的经纬规则。";
    }];
    HUANGJI_STANDARD_EPOCH: Readonly<{
        model: "先天圆图值年卦通行排法";
        yuanStartYear: -67017;
        annualAnchorYear: 1984;
        annualAnchorHexagram: "鼎";
        calendar: "公元纪年（无公元0年）";
    }>;
    calculateHuangjiJingshi: typeof calculateHuangjiJingshi;
    calculateStandardHuangjiForecast: typeof calculateStandardHuangjiForecast;
    calculateHuangjiDateTimeForecast: typeof calculateHuangjiDateTimeForecast;
    buildHuangjiJingshiPrompt: typeof buildHuangjiJingshiPrompt;
};
