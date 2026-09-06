/**
 * 八神旺衰评估（《奇门遁甲秘籍大全》神煞落宫章）
 *
 * 八神各有五行，落宫后有旺衰之分：
 * - 比和（神与宫同五行）→ 强
 * - 神克宫 → 强
 * - 宫生神 → 中
 * - 神生宫 → 弱
 * - 宫克神 → 弱
 * - 空亡会使强降为中，中降为弱
 */
/** 八神五行 */
export declare const GOD_WUXING: Record<string, string>;
export type GodStrength = '强' | '中' | '弱';
export interface GodStrengthResult {
    god: string;
    palace: number;
    gong: number;
    strength: GodStrength;
    score: number;
}
/**
 * 评估单个八神在宫位中的旺衰
 */
export declare function evaluateSingleGodStrength(god: string, gong: number, palaceElement: string, isVoid?: boolean): GodStrengthResult;
/**
 * 评估整盘中所有八神的旺衰
 *
 * @param jiuGongGe - 九宫格数组，每项须含 gong、element、shenPan.god
 * @param voidBranches - 空亡地支数组（如 ['寅', '卯']），用于判断宫位是否逢空
 * @returns 每个有神宫位的旺衰评估结果
 */
export declare function evaluateGodPalaceStrength(jiuGongGe: Array<{
    gong: number;
    name: string;
    element: string;
    shenPan: {
        god: string;
    };
}>, voidBranches?: string[]): GodStrengthResult[];
