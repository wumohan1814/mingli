import { type PromptSchoolId } from '../prompt/schools';
import { evaluateWuyunLiuqiPathomechanism, type WuyunLiuqiPathomechanismResult } from './pathomechanism';
export { evaluateWuyunLiuqiPathomechanism };
export type { WuyunLiuqiPathomechanismResult };
export declare const WUYUN_LIUQI_SOURCES: readonly [{
    readonly title: "《素问·天元纪大论》";
    readonly scope: "天干化五运、地支配司天以及运气年度纲领。";
}, {
    readonly title: "《素问·五运行大论》";
    readonly scope: "五运与五行、气候属性的传统关系。";
}, {
    readonly title: "《素问·六微旨大论》";
    readonly scope: "六气司天、在泉与主客气位置关系。";
}, {
    readonly title: "吴谦《运气要诀》";
    readonly scope: "五步主客运、五音太少、交司日期、六步节令、气运相临以及天符、岁会、太乙天符、同天符、同岁会。";
}];
export type WuyunElement = '木' | '火' | '土' | '金' | '水';
export type WuyunStrength = '太过' | '不及';
export type WuyunTone = '角' | '徵' | '宫' | '商' | '羽';
export type WuyunToneStrength = '太' | '少';
export type LiuqiName = '厥阴风木' | '少阴君火' | '少阳相火' | '太阴湿土' | '阳明燥金' | '太阳寒水';
export type AnnualQiMovementRelationKind = '同气' | '顺化' | '天刑' | '小逆' | '不和';
export type HostGuestRelationKind = '同气' | '客生主' | '主生客' | '客克主' | '主克客';
export type AnnualConformityName = '天符' | '岁会' | '太乙天符' | '同天符' | '同岁会';
export interface WuyunLiuqiInput {
    /** 公历年；按该年年中所属年柱换算，避免元旦与立春边界混淆。 */
    year?: number;
    /** 明确指定年干支；提供后以此为准。 */
    yearGanZhi?: string;
    /** 可选问题，只用于生成完整提示词，不改变排盘。 */
    question?: string;
}
export interface AnnualMovement {
    stem: string;
    element: WuyunElement;
    name: string;
    tone: WuyunTone;
    toneStrength: WuyunToneStrength;
    toneName: string;
    yinYang: '阳' | '阴';
    strength: WuyunStrength;
    basis: string;
}
export interface WuyunMovementProfile {
    element: WuyunElement;
    tone: WuyunTone;
    toneStrength: WuyunToneStrength;
    toneName: string;
    strength: WuyunStrength;
    climateQi: '风' | '热' | '湿' | '燥' | '寒';
}
export interface WuyunMovementStep {
    order: number;
    label: '初运' | '二运' | '三运' | '四运' | '五运';
    startBoundary: {
        solarTerm: '大寒' | '春分' | '芒种' | '处暑' | '立冬';
        offsetDays: number;
        description: string;
        precision: '传统日期序号';
    };
    gregorianStart?: string;
    gregorianEnd?: string;
    periodRule: string;
    hostMovement: WuyunMovementProfile;
    guestMovement: WuyunMovementProfile;
    hostGuestRelation: {
        kind: HostGuestRelationKind;
        basis: string;
    };
    guestRole?: '中运起点';
}
export interface LiuqiProfile {
    name: LiuqiName;
    phase: '厥阴' | '少阴' | '少阳' | '太阴' | '阳明' | '太阳';
    qi: '风' | '君火' | '相火' | '湿' | '燥' | '寒';
    element: WuyunElement;
}
export interface LiuqiStep {
    order: number;
    label: '初之气' | '二之气' | '三之气' | '四之气' | '五之气' | '终之气';
    solarTerms: string[];
    gregorianStart?: string;
    gregorianEnd?: string;
    hostQi: LiuqiProfile;
    guestQi: LiuqiProfile;
    hostGuestRelation: {
        kind: HostGuestRelationKind;
        basis: string;
    };
    guestRole?: '司天' | '在泉';
}
export interface AnnualQiMovementRelation {
    kind: AnnualQiMovementRelationKind;
    movementElement: WuyunElement;
    sitianElement: WuyunElement;
    basis: string;
}
export interface AnnualConformityFact {
    name: AnnualConformityName;
    matched: boolean;
    rule: string;
    basis: string;
}
export interface AnnualConformities {
    names: AnnualConformityName[];
    tianfu: boolean;
    suihui: boolean;
    taiyiTianfu: boolean;
    tongTianfu: boolean;
    tongSuihui: boolean;
    facts: AnnualConformityFact[];
    sourceReconciliation: {
        distinctYearsByListedRules: 26;
        sourceSummaryYears: 28;
        handling: string;
    };
}
export interface WuyunLiuqiCalculation {
    input: {
        year?: number;
        yearGanZhi: string;
        yearGanZhiSource: '明确年干支' | '公历年年中换算';
    };
    annualMovement: AnnualMovement;
    sitian: LiuqiProfile;
    zaiquan: LiuqiProfile;
    annualRelation: AnnualQiMovementRelation;
    annualConformities: AnnualConformities;
    movementSteps: WuyunMovementStep[];
    qiSteps: LiuqiStep[];
    calculationChain: string[];
    sources: Array<{
        title: string;
        scope: string;
    }>;
    limitations: string[];
    pathomechanism?: WuyunLiuqiPathomechanismResult;
}
export interface WuyunLiuqiResult extends WuyunLiuqiCalculation {
    prompt: string;
}
export declare const HOST_MOVEMENT_ORDER: readonly WuyunElement[];
/**
 * 《运气要诀》五运交司日期。offsetDays 表示原文“节气后第几日”的日期序号，
 * 不把它解释成自交节时刻起累计若干个 24 小时的现代精确时刻。
 */
export declare const MOVEMENT_STEP_BOUNDARIES: readonly {
    solarTerm: WuyunMovementStep['startBoundary']['solarTerm'];
    offsetDays: number;
    description: string;
    periodRule: string;
}[];
/** 主气的少阳、太阴次序与客气轮转不同。 */
export declare const HOST_QI_ORDER: readonly LiuqiName[];
export declare const GUEST_QI_ORDER: readonly LiuqiName[];
/** 一年二十四节气按六步分主，每步四个节气。 */
export declare const QI_STEP_SOLAR_TERMS: readonly (readonly [string, string, string, string])[];
export declare const ANNUAL_CONFORMITY_SOURCE_RECONCILIATION: Readonly<{
    distinctYearsByListedRules: 26;
    sourceSummaryYears: 28;
    handling: "吴谦《运气要诀》逐项名单按六十甲子去重为26年，与原文“二十八年”汇总不一致；计算采用逐项定义和逐年名单，不用汇总数反改规则。";
}>;
/** 公历年中对应的年柱；1984 年为甲子年。 */
export declare function getWuyunLiuqiYearGanZhi(year: number): string;
export declare function buildWuyunLiuqiPrompt(result: WuyunLiuqiCalculation, question?: string, schools?: readonly PromptSchoolId<'wuyun-liuqi'>[]): string;
export declare function calculateWuyunLiuqi(input: WuyunLiuqiInput): WuyunLiuqiResult;
export declare const wuyunLiuqi: {
    HOST_MOVEMENT_ORDER: readonly WuyunElement[];
    MOVEMENT_STEP_BOUNDARIES: readonly {
        solarTerm: WuyunMovementStep["startBoundary"]["solarTerm"];
        offsetDays: number;
        description: string;
        periodRule: string;
    }[];
    HOST_QI_ORDER: readonly LiuqiName[];
    GUEST_QI_ORDER: readonly LiuqiName[];
    QI_STEP_SOLAR_TERMS: readonly (readonly [string, string, string, string])[];
    ANNUAL_CONFORMITY_SOURCE_RECONCILIATION: Readonly<{
        distinctYearsByListedRules: 26;
        sourceSummaryYears: 28;
        handling: "吴谦《运气要诀》逐项名单按六十甲子去重为26年，与原文“二十八年”汇总不一致；计算采用逐项定义和逐年名单，不用汇总数反改规则。";
    }>;
    WUYUN_LIUQI_SOURCES: readonly [{
        readonly title: "《素问·天元纪大论》";
        readonly scope: "天干化五运、地支配司天以及运气年度纲领。";
    }, {
        readonly title: "《素问·五运行大论》";
        readonly scope: "五运与五行、气候属性的传统关系。";
    }, {
        readonly title: "《素问·六微旨大论》";
        readonly scope: "六气司天、在泉与主客气位置关系。";
    }, {
        readonly title: "吴谦《运气要诀》";
        readonly scope: "五步主客运、五音太少、交司日期、六步节令、气运相临以及天符、岁会、太乙天符、同天符、同岁会。";
    }];
    getWuyunLiuqiYearGanZhi: typeof getWuyunLiuqiYearGanZhi;
    calculateWuyunLiuqi: typeof calculateWuyunLiuqi;
    buildWuyunLiuqiPrompt: typeof buildWuyunLiuqiPrompt;
};
