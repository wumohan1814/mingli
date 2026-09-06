/**
 * @file 梅花易数排盘算法
 * @description 基于邵雍（康节）先生所传之《梅花易数》，实现年月日时、数字、随机起卦法。
 * @来源 通行本《梅花易数》（传为邵雍所传）；版本、卦序与体用互变口径以当前固定数据为准。
 * @流派 邵氏心易
 * @核心思想
 * 1. 以数起卦：将农历的年、月、日、时辰之数，通过特定运算转换为八卦。
 *    - (年支序 + 月 + 日) % 8  => 上卦
 *    - (年支序 + 月 + 日 + 时支序) % 8 => 下卦
 *    - (年支序 + 月 + 日 + 时支序) % 6 => 动爻
 * 2. 定体用：此乃梅花心法之灵魂。以动爻所在的经卦为“用”，静止的另一经卦为“体”。
 * 3. 论生克：以体卦为中心（我），分析用卦、互卦、变卦对体卦的五行生克关系，以此判断吉凶。
 *    - 生体为吉，克体为凶。体用比和，事顺。
 *    - 用为事之始，互为事之中，变为事之终。
 */
import type { MeihuaData, MeihuaSettings } from '../../../types/divination';
/**
 * 依据《梅花易数》“用为始，互为中，变为终”的事态三阶段演化趋势机
 */
export declare function evaluateMeihuaTimelineTrend(params: {
    tiElement: string;
    originalYongElement: string;
    interTiElement: string;
    interYongElement: string;
    changedYongElement: string;
}): {
    trend: '先难后易' | '先顺后阻' | '始末顺畅' | '始终受制' | '中途多阻' | '平稳演进';
    summary: string;
};
/**
 * 生成梅花易数卦盘
 *
 * 支持时间起卦、数字起卦和随机起卦；timeTrigram 作为历史兼容入口按时间起卦计算。
 * 不传 `customDate` 则使用当前时间。
 *
 * @param customDate 自定义起卦时间（可选），影响时间卦的时间干支。
 * @param settings   起卦设置，含 method（起卦方式）、number（数字起卦用）等。
 * @returns 完整的梅花易数卦盘数据对象 MeihuaData。
 *
 * @example
 * ```ts
 * // 时间起卦（默认）
 * const result = generateMeihua();
 *
 * // 数字起卦
 * const result = generateMeihua(undefined, { method: 'number', number: 123 });
 * ```
 */
export declare function generateMeihua(customDate?: Date, settings?: MeihuaSettings): MeihuaData;
export { analyzeMeihuaEvidence, conditionMeihuaTraditionalText } from '../../meihua-evidence';
export type { MeihuaCounterEvidenceFact, MeihuaCounterSummaryFact, MeihuaEvidenceAnalysis, MeihuaEvidenceStageKey, MeihuaHexagramFact, MeihuaStageEvidence, MeihuaStageCoverageFact, MeihuaTimingFact, MeihuaTimingSummaryFact, MeihuaTraditionalFact, MeihuaTransitionFact, MeihuaYaoCoverageFact, MeihuaYaoFact, } from '../../meihua-evidence';
