/**
 * @file 奇门终身局阶段划分引擎（Stage Engine）
 * @description 支持四柱分限法（默认）、洛书九宫巡行法以及符使卦轨法，生成结构化人生阶段卡。
 */
import type { QimenData, QimenLifetimeStage, QimenPersonalMarker, QimenStagePolicy, QimenTopicCandidate } from '../../../../types/divination';
/**
 * 构建终身局阶段卡列表
 */
export declare function buildLifetimeStages(baseChart: QimenData, _personalMarkers: QimenPersonalMarker[], _topicCandidates: QimenTopicCandidate[], policy: QimenStagePolicy, birthDate: Date, gender?: 'male' | 'female'): QimenLifetimeStage[];
