/**
 * @file 八宅明镜九星克制与门主气口相生算法
 * @传统依据 《八宅明镜》《阳宅三要》：以贪狼木克绝命金，延年金制祸害土，天医土降六煞水；门主相生化煞。
 */
export interface BaZhaiSuppressionFact {
    star: string;
    element: '木' | '火' | '土' | '金' | '水';
    counterpart: string;
    suppressionRule: string;
    advice: string;
}
export interface BaZhaiGasRegulationResult {
    suppressionLaws: BaZhaiSuppressionFact[];
    doorMasterSummary: string;
    promptSummary: string;
}
export declare const NINE_STAR_WUXING: Record<string, {
    star: string;
    element: '木' | '火' | '土' | '金' | '水';
    nature: '吉' | '凶';
}>;
/**
 * 依据《八宅明镜》评估九星相制化煞与门主气口配合
 */
export declare function evaluateBaZhaiRegulation(params: {
    mingGua: string;
    houseGua: string | null;
    mingGroup: '东四命' | '西四命';
    houseGroup: '东四命' | '西四命' | null;
}): BaZhaiGasRegulationResult;
