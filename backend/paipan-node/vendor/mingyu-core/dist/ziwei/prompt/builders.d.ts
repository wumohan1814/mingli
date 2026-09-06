import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import type { ZiweiPromptContext } from './types';
export declare function buildPalaceSummary(payload: AnalysisPayloadV1, palace: PalaceFact): {
    宫位: string;
    宫干支: string;
    空宫: string | undefined;
    主星: string[];
    辅星: string[];
    杂曜: string[];
    当前运限加临星曜: string[] | undefined;
    生年四化: string[];
    流耀四化: string[] | undefined;
    当前运限四化: string[] | undefined;
    自化情况: string[];
    飞星走向: string[];
    运限命中: string[] | undefined;
    对宫: string;
    三方四正: string[];
    大限范围: string;
    传统辅证: string | undefined;
};
export declare function buildEvidenceSummary(payload: AnalysisPayloadV1, focusPalaces: PalaceFact[], reportContext: ZiweiPromptContext): {
    判断线索: string;
    适用范围: string;
    关联宫位: string[];
    关联星曜: string[];
    关联四化: string[];
    说明: string;
}[];
export declare function buildScopeStructureSummary(payload: AnalysisPayloadV1): ({
    类型: string;
    运限: string;
    本命落宫: string;
    当前动态宫名: string | undefined;
    宫位干支: string;
    主星: string[];
} | {
    类型: string;
    运限: string;
    星曜: string;
    四化: string;
    飞入宫位: string;
    动态飞入宫位: string | undefined;
})[];
export declare function buildScopeHitSummary(payload: AnalysisPayloadV1): string[];
export declare function buildPalaceIndex(payload: AnalysisPayloadV1): {
    宫位: string;
    宫干支: string;
    主星: string[];
    辅曜: string[] | undefined;
    当前动态宫名: string | undefined;
    自化: string | undefined;
    宫干飞化: string | undefined;
}[];
