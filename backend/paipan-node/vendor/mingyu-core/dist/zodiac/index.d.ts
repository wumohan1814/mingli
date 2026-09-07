export { analyzeZodiacEvidence } from './evidence';
export type { ZodiacCalculationStep, ZodiacCounterEvidenceFact, ZodiacCounterSummaryFact, ZodiacEvidenceAnalysis, ZodiacLimitationFact, ZodiacRelationEvidence, } from './evidence';
/** 六十甲子值年太岁星君 */
export declare const TAI_SUI_STARS: Readonly<Record<string, string>>;
export interface TaiSuiConflict {
    type: '值太岁' | '冲太岁' | '刑太岁' | '害太岁' | '破太岁';
    with: string;
    desc: string;
}
/** 生肖是否犯太岁（年支视角） */
export declare function getTaiSuiConflicts(zodiacBranch: string, yearBranch: string): TaiSuiConflict[];
/** 流年值年太岁 */
export declare function getYearTaiSui(yearGanZhi: string): {
    yearBranch: string;
    star: string;
};
export interface ZodiacYearFortune {
    zodiacBranch: string;
    zodiac: string;
    yearGanZhi: string;
    yearBranch: string;
    /** 年干与生肖五行关系 */
    relation: string;
    elementRelation: ZodiacElementRelation;
    /** 本气五行展示文案（B2 确定性文案，如“水（子）”；elementRelation.zodiacWuxing 为机读五行） */
    zodiacWuxing: string;
    /** 三合/六合贵人（流年命中时）；否则为 B2 贵人兜底文案（BUG-003），保证非空 */
    noble: string;
    /** 两支同属固定三会组；只记录关系，不表示完整三会成局 */
    meeting: string | null;
    conflicts: TaiSuiConflict[];
    evidenceGrade: '轻量';
    interpretationBoundary: '仅限生肖与流年关系';
    /** 流年有利关系；计算为空时以 B2「有利关系」模板回填，保证非空 */
    favorableRelations: string[];
    /** 流年风险关系；计算为空时以 B2 该生肖「风险关系」文案回填，保证非空 */
    riskRelations: string[];
    /** 行动建议；计算为空时以 B2 该生肖「行动建议」回填，保证非空 */
    actionSignals: string[];
    evidenceAnalysis: import('./evidence').ZodiacEvidenceAnalysis;
    prompt: string;
}
export interface ZodiacElementRelation {
    kind: '年干生生肖' | '生肖生年干' | '年干克生肖' | '生肖克年干' | '同类';
    label: string;
    classification: '有利关系' | '风险关系' | '中性关系';
    yearStemWuxing: string;
    zodiacWuxing: string;
}
/** 生肖流年便捷输入；可传生肖名称或年支，并明确提供公历年或流年干支。 */
export interface ZodiacYearFortuneInput {
    zodiac: string;
    /** 公历流年；与 yearGanZhi 至少提供一项。 */
    year?: number;
    /** 直接指定六十甲子；与 year 同时提供时会校验一致性。 */
    yearGanZhi?: string;
}
/** 生肖流年运程 */
export declare function getZodiacYearFortune(zodiacBranch: string, yearGanZhi: string): ZodiacYearFortune;
/** 从前端常用的“生肖/年支 + 公历年”输入直接生成生肖流年结果。 */
export declare function calculateZodiacYearFortune(input: ZodiacYearFortuneInput): ZodiacYearFortune;
export declare const zodiac: {
    TAI_SUI_STARS: Readonly<Record<string, string>>;
    getTaiSuiConflicts: typeof getTaiSuiConflicts;
    getYearTaiSui: typeof getYearTaiSui;
    getZodiacYearFortune: typeof getZodiacYearFortune;
    calculateZodiacYearFortune: typeof calculateZodiacYearFortune;
};
