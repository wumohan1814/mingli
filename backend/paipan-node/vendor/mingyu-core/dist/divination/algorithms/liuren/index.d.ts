import type { LiurenData } from '../../../types/divination';
/**
 * 生成大六壬完整课盘
 *
 * 按月将加时、天地盘、四课、三传、天将、神煞顺序完成排盘。
 * 支持传入自定义时间，不传则使用当前时间。
 *
 * @param customDate 自定义排盘时间（可选），不传则使用当前时间。
 * @returns 完整的大六壬课盘数据对象 LiurenData。
 *
 * @example
 * ```ts
 * const result = generateLiuren();
 * // result 包含 fourLessons（四课）、threeTransmissions（三传）等字段
 * ```
 */
export declare function generateLiuren(customDate?: Date): LiurenData;
export { analyzeLiurenEvidence } from '../../liuren-evidence';
export { getLiurenGuaTiFacts, getLiurenTransmissionGuaTi, REGISTERED_LIUREN_GUA_TI_COUNT, } from './helpers/transmission';
export type { LiurenCounterEvidenceFact, LiurenCounterSummaryFact, LiurenEvidenceAnalysis, LiurenFocusFact, LiurenFocusSummaryFact, LiurenLessonEvidence, LiurenRelationEvidenceFact, LiurenTimingFact, LiurenTraditionalFact, LiurenTransitionFact, LiurenTransmissionEvidence, LiurenTransmissionRuleFact, } from '../../liuren-evidence';
