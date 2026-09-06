/**
 * @file 小六壬通行时间课
 * @description 仅实现可复核的月、日、时逐宫顺数，不混入现代扩展断法。
 * @口径 正月从大安起，月上起初一，日上起子时，均按六宫顺行；时宫为占得宫。
 * @来源 通行俗传小六壬掌诀。作者、成书年代及“李淳风”署名暂无可靠版本学证据。
 */
import type { XiaoliurenData, XiaoliurenDivinationMethod } from '../../types/divination';
export { analyzeXiaoliurenEvidence } from '../xiaoliuren-evidence';
export type { XiaoliurenCalculationFact, XiaoliurenCalculationStep, XiaoliurenEvidenceAnalysis, XiaoliurenLimitationFact, XiaoliurenPalaceFact, XiaoliurenSummaryFact, } from '../xiaoliuren-evidence';
/**
 * 生成通行小六壬时间课。
 *
 * 闰月沿用同名月序；农历日按东八区民用日零点换日。两项均在结果中显式标注，
 * 以免把有分歧的历法边界伪装成唯一传统口径。
 */
export declare function generateXiaoliuren(params?: {
    method?: XiaoliurenDivinationMethod;
    customDate?: Date;
}): XiaoliurenData;
