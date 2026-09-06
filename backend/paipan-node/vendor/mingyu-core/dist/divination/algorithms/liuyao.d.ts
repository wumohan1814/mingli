/**
 * @file 六爻排盘算法
 * @description 基于京房八宫法，实现六爻卦象的完整排盘。
 * @古籍依据 《京氏易传》《火珠林》《卜筮正宗》《增删卜易》；具体事项取用随问题关系取证。
 * @流派 京房易
 * @核心思想
 * 1. 时间起卦：通过时间获取卦象的六个爻。
 * 2. 卦象转换：将主卦、变卦、互卦转换为二进制表示，并从数据中查找对应卦象。
 * 3. 安世应：根据主卦在其所属八宫中的位置（首卦、一世、二世...归魂）来确定世爻和应爻。
 * 4. 纳甲：为六个爻配上天干地支，此为定五行、六亲之本。
 * 5. 六亲：根据主卦宫位五行与各爻纳甲地支五行的生克关系，确定父母、官鬼、妻财、子孙、兄弟。
 * 6. 六神：根据起卦日的日干，安上青龙、朱雀、勾陈、螣蛇、白虎、玄武。
 * 7. 变卦分析：分析动爻变化后的爻，形成“父化财”等判断依据。
 */
import type { RandomOptions } from '../../shared/random';
import type { LiuyaoChangeRelation } from '../../types/divination';
export declare function getLiuyaoChangeRelation(originalWuxing: string, changedWuxing: string, originalBranch: string, changedBranch: string, changedIsVoid: boolean): LiuyaoChangeRelation;
/**
 * 返回动变条件的完整并见列表。
 * 《增删卜易》分别论回头生克冲、化空、进退等条件；化空描述变爻旬空，
 * 不会抹掉变爻对本爻原有的生、克、冲或比泄耗关系。卷二《六冲章》又以
 * “酉金化卯冲世而不克世”明确区分冲与克，故相冲和五行关系也分别保存。
 */
export declare function getLiuyaoChangeRelations(originalWuxing: string, changedWuxing: string, originalBranch: string, changedBranch: string, changedIsVoid: boolean): LiuyaoChangeRelation[];
export declare function getLiuyaoGuaShenBranch(shiPosition: number, shiYaoIsYang: boolean): string;
/**
 * 判断化进神/退神。
 * 按《增删卜易》进神退神章明表取用，不按十二地支循环外推。
 */
export declare function getLiuyaoChangeDirection(originalBranch: string, changedBranch: string): '化进神' | '化退神' | null;
export type LiuyaoHexagramRelation = '六合卦' | '六冲卦';
export type LiuyaoFanFuScope = '内卦' | '外卦' | '内外';
export type LiuyaoFanFuKind = '卦反吟' | '爻反吟' | '伏吟';
export interface LiuyaoFanFuRelationItem {
    kind: LiuyaoFanFuKind;
    scope: LiuyaoFanFuScope;
    label: string;
    description: string;
}
export interface LiuyaoFanFuRelations {
    /** 反吟结构，可能同时存在内卦、外卦不同类型 */
    fanyin: LiuyaoFanFuRelationItem[];
    /** 伏吟结构，按动变后纳甲地支不变识别 */
    fuyin: LiuyaoFanFuRelationItem[];
    /** 便于前端与提示词直接展示的标签 */
    labels: string[];
}
export type LiuyaoPalaceStage = '首卦' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';
/**
 * 判断整卦层面的六合卦/六冲卦。
 * 《增删卜易》六合章、六冲章以初四、二五、三上三组爻支相合/相冲定整卦关系，
 * 如天地否为六合卦、乾为天为六冲卦。
 */
export declare function getLiuyaoHexagramRelation(hexagramName: string): LiuyaoHexagramRelation | null;
export declare function getLiuyaoHexagramRelations(originalName: string, changedName: string | undefined, hasChangingYaos: boolean): {
    original: LiuyaoHexagramRelation | null;
    changed: LiuyaoHexagramRelation | null;
    transition: string | null;
};
/**
 * 判断六爻卦变层面的反吟、伏吟。
 *
 * 《增删卜易》“反吟伏吟”：
 * - 卦反吟：乾巽、坎离、震兑、坤艮相变。
 * - 爻反吟：对应爻纳甲地支逐位相冲。
 * - 伏吟：卦有动变，但变后六爻纳甲地支不变，并分内卦、外卦、内外。
 */
export declare function getLiuyaoFanFuRelations(originalName: string, changedName: string | undefined, hasChangingYaos: boolean): LiuyaoFanFuRelations;
/**
 * 飞伏生克与出伏难易判定（依据《增删卜易·伏神章》与《卜筮正宗》）
 */
export declare function evaluateLiuyaoHiddenSpiritInteraction(params: {
    hiddenWuxing: string;
    hiddenVoid: boolean;
    flyingWuxing: string;
    flyingDizhi: string;
    flyingVoid: boolean;
    monthBranch?: string;
}): string;
declare function buildHiddenSpirits(params: {
    originalName: string;
    palace: {
        name: string;
        wuxing: string;
    };
    yaosDetail: Array<{
        position: number;
        sixRelative: string;
        najiaDizhi: string;
        wuxing: string;
    }>;
    voidBranches: string[];
    monthBranch?: string;
}): {
    sixRelative: string;
    position: number;
    najiaDizhi: string;
    wuxing: string;
    isVoid: boolean;
    underYao: {
        position: number;
        sixRelative: string;
        najiaDizhi: string;
        wuxing: string;
    };
    interactionEffect: string;
}[];
/**
 * 安世应
 * @param hexagramName 卦名
 * @param palaceName 宫位名
 * @returns 返回世爻和应爻所在的爻位（1-6）
 */
export declare function getLiuyaoPalaceStage(hexagramName: string, palaceName?: string): LiuyaoPalaceStage;
/**
 * 生成六爻卦盘
 *
 * 使用京房八宫法，按时间起卦。支持传入自定义时间，不传则使用当前时间。
 * 返回完整的六爻卦盘，包含主卦、变卦、互卦、世应、纳甲、六亲、六神等信息。
 *
 * @param customDate 自定义起卦时间（可选），若不提供则使用当前时间。
 * @param options 可选手工三钱法爻值，用于复现真实投掷或固定卦例。
 * @returns 完整的六爻卦盘数据对象 LiuyaoData。
 *
 * @example
 * ```ts
 * const result = generateLiuyao();
 * // result 包含 mainHexagram、changedHexagram、yaos（六爻详情）等字段
 * ```
 */
export type LiuyaoGenerationMethod = 'time' | 'manual' | 'coins';
export interface LiuyaoGenerationOptions extends RandomOptions {
    /** 起卦方式；默认有 yaos 时为 manual，否则为 time。 */
    method?: LiuyaoGenerationMethod;
    /** 可选手工三钱法爻值，按初爻到上爻传入 6、7、8、9。 */
    yaos?: readonly number[];
    /** 用户逐爻手摇得到的三钱记录，按初爻到上爻传入。 */
    coinThrows?: readonly {
        coins: readonly (2 | 3)[];
        total: 6 | 7 | 8 | 9;
    }[];
}
export declare function generateLiuyao(customDate?: Date, options?: LiuyaoGenerationOptions): {
    evidenceAnalysis: import("./liuyao").LiuyaoEvidenceAnalysis;
    generation?: {
        method: "time" | "manual" | "coins";
        coinThrows?: Array<{
            coins: [2 | 3, 2 | 3, 2 | 3];
            total: 6 | 7 | 8 | 9;
        }>;
    };
    yaoArray: number[];
    changingYaos: Array<{
        position: number;
        isChanging: boolean;
        type: string;
    }>;
    sixGods: string[];
    sixRelatives: string[];
    najiaDizhi: string[];
    wuxing: string[];
    worldAndResponse: string[];
    voidBranches: string[];
    palace: {
        name: string;
        wuxing: string;
    };
    palaceStage?: import("..").LiuyaoPalaceStage;
    yaosDetail: import("..").LiuyaoYaoDetail[];
    hiddenSpirits?: import("..").LiuyaoHiddenSpirit[];
    hexagramRelations?: import("..").LiuyaoHexagramRelations;
    fanfuRelations?: import("..").LiuyaoFanFuRelations;
    specialPattern?: "\u9759\u5366" | "\u72EC\u9759\u5366" | "\u5168\u52A8\u5366" | "\u4E7E\u5366\u7528\u4E5D" | "\u5764\u5366\u7528\u516D";
    specialAdvice?: string;
    isChaotic?: boolean;
    chaoticReason?: string;
    sanheWithDay?: {
        group: string;
        members: string[];
        description: string;
    } | null;
    sanheWithMonth?: {
        group: string;
        members: string[];
        description: string;
    } | null;
    sanxingInYaos?: Array<{
        branches: string[];
        type: string;
    }>;
    guaShen?: {
        branch: string;
        sixRelative: string;
        position: number;
    } | null;
    meta: import("..").CoreResultMeta;
    originalName: string;
    changedName?: string;
    interName?: string;
    ganzhi: import("..").BaseGanZhi;
    timestamp: number;
};
export { buildHiddenSpirits };
export { analyzeLiuyaoEvidence, conditionLiuyaoTraditionalText } from '../liuyao-evidence';
export type { LiuyaoCounterEvidenceFact, LiuyaoCounterSummaryFact, LiuyaoEvidenceAnalysis, LiuyaoEvidenceOptions, LiuyaoEvidenceTopic, LiuyaoGodChainItem, LiuyaoGodRole, LiuyaoHexagramStructureFact, LiuyaoHiddenSpiritCoverageFact, LiuyaoHiddenSpiritFact, LiuyaoLineCoverageFact, LiuyaoLineFact, LiuyaoTimingFact, LiuyaoTimingSummaryFact, LiuyaoTraditionalSymbolFact, LiuyaoUsefulGodCandidate, LiuyaoUsefulGodSelectionFact, LiuyaoYaoReference, } from '../liuyao-evidence';
