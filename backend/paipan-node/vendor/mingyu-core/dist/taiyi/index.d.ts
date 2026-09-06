import type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
import { buildTaiyiEvidence } from './evidence';
export type { TaiyiModelInfo, TaiyiResult, TaiyiScope } from '../types/divination';
export type { TaiyiConditionFact, TaiyiCounterEvidenceFact, TaiyiCounterSummaryFact, TaiyiEvidenceAnalysis, TaiyiForceFact, TaiyiLimitationFact, TaiyiPositionFact, TaiyiSixteenGodFact, } from './evidence';
/** 太乙统宗年家积年基数。 */
export declare const TAIYI_BASE_YEARS = 10153917;
export interface TaiyiPalaceProfile {
    gua: string;
    dir: string;
    wu: string;
}
/** 太乙八宫编号不是洛书九宫编号：1乾、2午、3艮、4卯、6酉、7坤、8子、9巽。 */
export declare const TAIYI_PALACES: Readonly<Record<number, Readonly<TaiyiPalaceProfile>>>;
/** 十六神固定宫位。 */
export declare const TAIYI_16_GODS: {
    name: string;
    branch: string;
}[];
export interface TaiyiInput {
    date?: Date;
    ganZhi?: string;
    scope?: TaiyiScope;
    year?: number;
}
export declare const TAIYI_MODEL_INFO: TaiyiModelInfo;
/**
 * 依据《太乙金镜式经》卷二“五和、长短、纯阳纯阴”推导大局攻守与策数博弈定性：
 * - 逢“和算”（上和、下和、次和等）：和解调停，宜息争修好、不战屈人；
 * - 纯阳纯阴：纯阳过刚易躁进，纯阴退伏多沉潜；
 * - 主客多寡：主多利主，客多利客。
 */
export declare function evaluateTaiyiTacticGuidance(params: {
    lordCount: number;
    guestCount: number;
    lordNature?: string;
    guestNature?: string;
}): string;
/** 生成太乙年、月、日、时四计七十二局基础盘。 */
export declare function generateTaiyi(input: TaiyiInput): TaiyiResult;
export declare const taiyi: {
    generateTaiyi: typeof generateTaiyi;
    evaluateTaiyiTacticGuidance: typeof evaluateTaiyiTacticGuidance;
    TAIYI_16_GODS: {
        name: string;
        branch: string;
    }[];
    TAIYI_BASE_YEARS: number;
    TAIYI_PALACES: Readonly<Record<number, Readonly<TaiyiPalaceProfile>>>;
    TAIYI_MODEL_INFO: TaiyiModelInfo;
    buildTaiyiEvidence: typeof buildTaiyiEvidence;
};
