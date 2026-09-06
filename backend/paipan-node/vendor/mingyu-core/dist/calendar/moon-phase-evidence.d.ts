declare const PRINCIPAL_PHASES: readonly [{
    readonly angle: 0;
    readonly name: "朔";
}, {
    readonly angle: 90;
    readonly name: "上弦";
}, {
    readonly angle: 180;
    readonly name: "望";
}, {
    readonly angle: 270;
    readonly name: "下弦";
}];
declare const EIGHT_PHASE_NAMES: readonly ["新月", "蛾眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];
export type PrincipalMoonPhaseName = (typeof PRINCIPAL_PHASES)[number]['name'];
export type EightMoonPhaseName = (typeof EIGHT_PHASE_NAMES)[number];
export interface PrincipalMoonPhaseEvent {
    key: string;
    name: PrincipalMoonPhaseName;
    status: '已求根';
    targetAngleDegrees: number;
    utcTimestamp: number;
    utcDateTime: string;
    residualDegrees: number;
    refinementIterations: number;
    ownerFactKeys: string[];
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    calculation: string;
    limitation: '四正月相事件是日月地心黄经差对目标角度的数值求根结果；1秒求根区间不等于观测级精度，也不证明月食可见性、现实事件、吉凶或固定应期';
}
export interface MoonPhaseCalculationStep {
    key: string;
    stage: '日月位置' | '月相角与照明' | '前一四正相位' | '下一四正相位';
    status: '已计算' | '已求根';
    dependsOnStepKeys: string[];
    inputs: Record<string, string | number>;
    result: Record<string, string | number>;
    promptText: string;
    sources: string[];
    limitation: '月相步骤只证明日月黄经、几何照明和前后四正相位求根如何形成；不得把求根区间解释为观测级精度、月食可见性或现实事件证据';
}
export interface MoonPhaseEventSummaryFact {
    key: 'moon-phase:event-summary';
    status: '已记录前后四正相位';
    previousEventKey: string;
    nextEventKey: string;
    factKeys: string[];
    ownerFactKeys: string[];
    calculationStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '事件汇总只说明当前时刻前后相邻的四正月相，不等于观测地点可见性、月食判断或现实应期';
}
export interface MoonPhaseLimitationFact {
    key: string;
    type: '平均月龄近似' | '几何照明近似' | '星历精度边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '限制事实用于约束月相角、照明比例、近似月龄与四正事件可以支持的解释范围，不得被反向当作月食、天气、吉凶或固定应期证据';
}
export interface MoonPhaseSummaryFact {
    key: 'moon-phase:evidence-summary';
    status: '证据链完整';
    factKeys: string[];
    calculationStepCount: number;
    principalEventCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '月相证据汇总只统计日月黄经、月相角、几何照明、前后四正事件与限制覆盖；不得按数量生成月相吉凶、月食可见性、可信度或现实应期';
}
export interface MoonPhaseEvidence {
    key: string;
    status: '已计算';
    utcTimestamp: number;
    utcDateTime: string;
    julianDayUtc: number;
    sunLongitudeDegrees: number;
    moonLongitudeDegrees: number;
    phaseAngleDegrees: number;
    elongationDegrees: number;
    illuminationFraction: number;
    illuminationPercent: number;
    waxing: boolean;
    eightPhaseName: EightMoonPhaseName;
    approximateMoonAgeDays: number;
    previousPrincipalPhase: PrincipalMoonPhaseEvent;
    nextPrincipalPhase: PrincipalMoonPhaseEvent;
    method: string;
    source: string;
    calculationSteps: MoonPhaseCalculationStep[];
    calculationChain: string[];
    eventSummaryFact: MoonPhaseEventSummaryFact;
    summaryFact: MoonPhaseSummaryFact;
    limitations: string[];
    limitationFacts: MoonPhaseLimitationFact[];
    promptText: string;
}
export declare function calculateMoonPhaseEvidence(utcTimestamp: number): MoonPhaseEvidence;
export {};
