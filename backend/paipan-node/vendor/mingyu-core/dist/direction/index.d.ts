/**
 * @file 方位 / 罗盘模块（地基层）
 * @description 八卦方位、二十四山、坐向→宅卦、八宅大游年（四吉四凶方）。
 * 供八宅风水、奇门方位应期、玄空等系统复用。设计为可继续拓展。
 */
/** 八卦（后天方位） */
export declare const BAGUA: string[];
/** 八卦方位（后天八卦） */
export declare const BAGUA_DIRECTION: Record<string, string>;
/** 八卦中心度数（罗盘，正北为 0°，顺时针） */
export declare const BAGUA_DEGREE: Record<string, number>;
/** 二十四山（罗盘顺序，自正北子山起顺时针） */
export declare const TWENTY_FOUR_MOUNTAINS: string[];
export interface CompassMountainPosition {
    /** 归一化后的罗盘度数；360° 归入 0°。 */
    degree: number;
    mountain: string;
    index: number;
    centerDegree: number;
    startDegree: number;
    endDegree: number;
    isBoundary: boolean;
    boundaryMountains?: [string, string];
}
export interface SitFacingPosition {
    facing: CompassMountainPosition;
    sit: CompassMountainPosition;
    label: string;
}
export interface CompassDirectionCalculationStep {
    key: string;
    stage: '度数归一化' | '向山映射' | '坐山换算' | '八卦归属';
    status: '已核验' | '已映射' | '已换算';
    dependsOnStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '罗盘计算步骤只证明输入度数如何按正北0度顺时针、每山15度的口径映射为向山、坐山和八卦；不得把步骤完整度解释为风水吉凶、现实结果或测量精度保证';
}
export interface CompassDirectionFact {
    key: string;
    type: '向山' | '坐山' | '分界状态' | '八卦归属';
    status: '已确定' | '位于分界线';
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '罗盘事实只记录当前度数在二十四山和后天八卦表中的映射；分界线、磁偏角、测量误差与实际建筑朝向仍需由上层测量流程处理';
}
export interface CompassDirectionLimitationFact {
    key: string;
    type: '基准方向边界' | '分界线边界' | '解释范围边界';
    status: '适用';
    ownerFactKeys: string[];
    ownerStepKeys: string[];
    promptText: string;
    sources: string[];
    limitation: '罗盘限制事实用于约束度数换算的基准、分界与解释范围，不得被反向当作宅运、吉凶、事件概率或唯一风水结论的证据';
}
export interface CompassDirectionSummaryFact {
    key: 'foundation:direction:evidence-summary';
    status: '映射稳定' | '向山位于分界线' | '坐向均位于分界线';
    factKeys: string[];
    calculationStepCount: number;
    directionFactCount: number;
    limitationFactCount: number;
    promptText: string;
    sources: string[];
    limitation: '罗盘证据汇总只统计向山、坐山、八卦和分界状态的覆盖，不表示已完成磁偏角修正、现场复测、宅卦稳定性或风水吉凶判断';
}
export interface CompassDirectionAnalysis {
    key: string;
    status: '已换算' | '存在分界线';
    inputDegree: number;
    normalizedDegree: number;
    facing: CompassMountainPosition;
    sit: CompassMountainPosition;
    facingBagua: string;
    sitBagua: string;
    label: string;
    calculationSteps: CompassDirectionCalculationStep[];
    calculationChain: string[];
    directionFacts: CompassDirectionFact[];
    summaryFact: CompassDirectionSummaryFact;
    limitations: string[];
    limitationFacts: CompassDirectionLimitationFact[];
    source: string;
    promptText: string;
}
/**
 * 按每山 15°、子山中心 0° 的罗盘口径，把度数换算为二十四山。
 * 分界线仍返回相邻山位，但会以 isBoundary 标记，调用方不应静默采用。
 */
export declare function getMountainFromDegree(degree: number): CompassMountainPosition;
/** 输入房屋朝向度数，自动换算相反方向的坐山。 */
export declare function getSitFacingFromFacingDegree(facingDegree: number): SitFacingPosition;
/**
 * 公共罗盘证据入口：把朝向度数换算为向山、坐山与所属八卦，并显式保留分界线和解释边界。
 */
export declare function analyzeCompassDirection(facingDegree: number): CompassDirectionAnalysis;
/**
 * tyme4ts 的 `Zone` 表示二十八宿四象（东、北、西、南），并不包含二十四山。
 * 这里公开权威名称供星宿/方位模块复用；二十四山仍保留罗盘专用表，避免错误替换。
 */
export declare const FOUR_ZONES: string[];
export interface NineStarProfile {
    number: string;
    color: string;
    element: string;
    dipper: string;
    direction: string;
    name: string;
}
/** 九星资料（委托 tyme4ts） */
export declare function getNineStarProfile(index: number): NineStarProfile;
export declare const NINE_STARS: NineStarProfile[];
/** 二十四山所属八卦 */
export declare const MOUNTAIN_TO_BAGUA: Record<string, string>;
/** 由坐山（二十四山）取宅卦 */
export declare function getHouseTrigram(mountain: string): string;
/** 由坐向（如「子山午向」）取宅卦 */
export declare function getHouseTrigramFromSitFacing(sitMountain: string): string;
/** 八宅大游年吉凶标签 */
export type BaZhaiLabel = '伏位' | '生气' | '延年' | '天医' | '绝命' | '五鬼' | '六煞' | '祸害';
export interface BaZhaiPalace {
    gua: string;
    direction: string;
    degree: number;
    label: BaZhaiLabel;
    luck: '吉' | '凶';
}
/**
 * 八宅大游年盘
 * @param baseGua 基准卦（可为命卦或宅卦）
 * @returns 八个方位的吉凶
 */
export declare function getBaZhaiPalace(baseGua: string): BaZhaiPalace[];
/** 命卦所属东四/西四 */
export declare function getEastWestGroup(gua: string): '东四命' | '西四命';
export interface EightMansionResult {
    mingGua: string;
    group: '东四命' | '西四命';
    lucky: BaZhaiPalace[];
    unlucky: BaZhaiPalace[];
    summary: string;
}
/** 命卦 → 八宅四吉四凶方 */
export declare function getEightMansion(mingGua: string): EightMansionResult;
export declare const direction: {
    BAGUA: string[];
    BAGUA_DIRECTION: Record<string, string>;
    BAGUA_DEGREE: Record<string, number>;
    TWENTY_FOUR_MOUNTAINS: string[];
    FOUR_ZONES: string[];
    NINE_STARS: NineStarProfile[];
    MOUNTAIN_TO_BAGUA: Record<string, string>;
    getNineStarProfile: typeof getNineStarProfile;
    getMountainFromDegree: typeof getMountainFromDegree;
    getSitFacingFromFacingDegree: typeof getSitFacingFromFacingDegree;
    analyzeCompassDirection: typeof analyzeCompassDirection;
    getHouseTrigram: typeof getHouseTrigram;
    getHouseTrigramFromSitFacing: typeof getHouseTrigramFromSitFacing;
    getBaZhaiPalace: typeof getBaZhaiPalace;
    getEastWestGroup: typeof getEastWestGroup;
    getEightMansion: typeof getEightMansion;
};
