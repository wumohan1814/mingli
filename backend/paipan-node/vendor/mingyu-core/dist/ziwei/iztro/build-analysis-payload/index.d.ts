import type { IztroAstrolabe, IztroHoroscope } from '../../../types/iztro';
import type { AnalysisPayloadV1, ScopeType, ZiweiCalculationConfig } from '../../../types/analysis';
export declare function buildAnalysisPayloadV1(params: {
    astrolabe: IztroAstrolabe;
    horoscope: IztroHoroscope;
    currentScope: ScopeType;
    calculationConfig?: ZiweiCalculationConfig;
    skipAnalysis?: boolean;
}): AnalysisPayloadV1;
