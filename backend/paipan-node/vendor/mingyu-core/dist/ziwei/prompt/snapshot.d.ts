import type { AnalysisPayloadV1 } from '../../types/analysis';
import type { ZiweiPromptContext } from './types';
export declare function buildPromptContextSnapshot(params: {
    payload: AnalysisPayloadV1;
    reportContext: ZiweiPromptContext;
}): {
    命主基础信息: {
        阳历生日: string;
        农历生日: string;
        四柱八字: string | undefined;
        出生时辰: string;
        命主: string;
        身主: string;
        五行局: string;
        身宫: string | undefined;
        命身主轴: string | undefined;
        来因宫: string | undefined;
    };
    当前运限信息: {
        时限类型: string;
        时限标签: string;
        当前落宫: string | undefined;
        当前四化: string[] | undefined;
    };
    命盘格局: {
        格局: string;
        传统分类: string;
        命中条件: string | undefined;
        涉及宫位: string;
        涉及星曜: string;
        古籍依据: string | undefined;
    }[];
    运限结构: ({
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
    重点宫位摘要: {
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
    }[];
    全盘宫位索引: {
        宫位: string;
        宫干支: string;
        主星: string[];
        辅曜: string[] | undefined;
        当前动态宫名: string | undefined;
        自化: string | undefined;
        宫干飞化: string | undefined;
    }[];
};
export declare function buildZiweiReadableSnapshot(params: {
    payload: AnalysisPayloadV1;
    reportContext: ZiweiPromptContext;
}): string;
export declare function buildZiweiTaskBookSnapshot(params: {
    payload: AnalysisPayloadV1;
    reportContext: ZiweiPromptContext;
}): string;
