import type { AlmanacAnnualDirectionGod, AlmanacData, AlmanacParticipantInput, AlmanacTopic } from '../../types/divination';
export declare const ALMANAC_TOPIC_LABELS: Record<AlmanacTopic, string>;
export declare function getAlmanacTwentyEightStarDetail(name: string): {
    fullName: string;
    sevenStar: string;
    animal: string;
    zone: string;
    fortune: string;
    source: string;
};
export declare function getAlmanacNineStarDetail(name: string): {
    fullName: string;
    color: string;
    wuxing: string;
    dipper: string;
    direction: string;
    source: string;
};
export declare function getAlmanacAnnualDirectionGods(yearBranch: string): AlmanacAnnualDirectionGod[];
export declare function validateAlmanacReferenceData(): void;
export declare function getAlmanacPengZuDetails(dayStem: string, dayBranch: string): {
    gan: string;
    zhi: string;
};
/**
 * 生成黄历择日结果
 *
 * 对指定日期范围内逐日分析宜忌、神煞、冲煞、建除十二值、
 * 二十八宿、彭祖百忌等，并基于参与人八字进行刑冲破害校验。
 *
 * @param params 择日参数：
 *   - topic: 事项类型（marriage/move/opening/…）
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)，最多比较 180 天
 *   - participants: 参与人信息（可选），含八字用于刑冲破害校验
 * @returns 黄历择日数据对象 AlmanacData。
 *
 * @example
 * ```ts
 * const result = generateAlmanacSelection({
 *   topic: 'marriage',
 *   startDate: '2025-06-01',
 *   endDate: '2025-06-30',
 * });
 * // result 包含按透明候选分组排列的逐日资料与证据链
 * ```
 */
export declare function generateAlmanacSelection(params: {
    topic: AlmanacTopic;
    startDate: string;
    endDate: string;
    participants?: AlmanacParticipantInput[];
    weekendPreference?: 'any' | 'prefer' | 'avoid';
    timePreferences?: Array<'work-hours' | 'morning' | 'afternoon'>;
}): AlmanacData;
export { analyzeAlmanacEvidence, conditionAlmanacTraditionalText } from '../almanac-evidence';
export type { AlmanacCandidateEvidence, AlmanacCandidateDecisionFact, AlmanacCandidateStatus, AlmanacDecisionStep, AlmanacEvidenceAnalysis, AlmanacHourEvidence, AlmanacRawTabooFact, AlmanacTraditionalFact, } from '../almanac-evidence';
