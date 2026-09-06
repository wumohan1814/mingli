/**
 * @file 应期判断（《奇门遁甲大全》应期章、《奇门旨归》）
 * @description 综合多种盘内条件判断应期节奏与触发条件：
 *   1. 用神落宫 → 按阴阳遁内外宫取远近基线
 *   2. 值符落宫数 → 辅助基线
 *   3. 值使落宫数 → 辅助基线
 *   4. 庚格定应期：阳日看庚下（地盘庚），阴日看庚上（天盘庚），地支逢冲为应
 *   5. 马星加快、用神落空则待填实/冲实、伏吟延迟、反吟加快
 *   6. 格局只作快慢辅助，不机械换算固定天数
 */
export interface YingQiEstimate {
    /** 旧版固定天数下界；不再生成，仅保留类型兼容 */
    minDays?: number;
    /** 旧版固定天数上界；不再生成，仅保留类型兼容 */
    maxDays?: number;
    /** 应期节奏 */
    rhythm: '快' | '中' | '慢';
    /** 判断依据列表 */
    sources: string[];
    /** 可以据盘复核的触发条件 */
    triggerConditions: string[];
    /** 不确定性与解释边界 */
    limitations: string[];
    /** 综合描述 */
    description: string;
}
/**
 * 估算应期
 *
 * @param jiuGongGe     - 九宫格数据（含天盘星干、地盘干）
 * @param useShenPalace - 用神落宫（若无则回退至值符落宫）
 * @param options       - 可选参数
 * @returns 应期估算结果
 *
 * @example
 * ```ts
 * const result = estimateYingQi(jiuGongGe, 3, {
 *   isFuyin: false,
 *   isFanyin: true,
 *   hasHorse: false,
 *   hasVoid: true,
 *   zhiFuLandingPalace: 1,
 *   zhiShiLandingPalace: 8,
 *   dayGanZhi: '甲子',
 *   classicPatterns: [{ name: '青龙返首', tone: 'good' }],
 *   voidBranches: ['寅', '卯'],
 * });
 * ```
 */
export declare function estimateYingQi(jiuGongGe: Array<{
    gong: number;
    tianPan: {
        stem: string;
        star: string;
    };
    diPan: {
        stem: string;
    };
}>, useShenPalace?: number, options?: {
    /** 是否伏吟 */
    isFuyin?: boolean;
    /** 是否反吟 */
    isFanyin?: boolean;
    /** 是否有马星冲动 */
    hasHorse?: boolean;
    /** 用神落宫是否逢空亡 */
    hasVoid?: boolean;
    /** 值符落宫 */
    zhiFuLandingPalace?: number;
    /** 值使落宫 */
    zhiShiLandingPalace?: number;
    /** 日干支（如 "甲子"），用于庚格定应期的阳日/阴日判断 */
    dayGanZhi?: string;
    /** 旧字段兼容：历史上误传时干支，新调用请使用 dayGanZhi */
    hourGanZhi?: string;
    /** 经典格局列表 */
    classicPatterns?: Array<{
        name: string;
        tone: 'good' | 'bad' | 'neutral';
    }>;
    /** 命中用神落宫的空亡地支列表（用于细化说明填实时间） */
    voidBranches?: string[];
    /** 是否阳遁；用于按冬至/夏至后内外宫判断应期远近 */
    isYangDun?: boolean;
}): YingQiEstimate;
