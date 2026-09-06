/**
 * @file 奇门终身局个人标记与六亲主题宫映射模块
 * @description 依据《奇门遁甲统宗》推人年命法与传统八门八神专司，
 * 提取年命、日干、时干、值符值使等个人标记，并系统映射人生九大主题候选宫。
 */
import type { QimenData, QimenPersonalMarker, QimenTopic, QimenTopicCandidate } from '../../../../types/divination';
export type SixRelative = '父母' | '子息' | '兄弟' | '官鬼' | '妻财';
/**
 * 提取个人标记落宫
 */
export declare function extractPersonalMarkers(baseChart: QimenData): QimenPersonalMarker[];
/**
 * 构建人生主题候选宫
 */
export declare function buildTopicCandidates(baseChart: QimenData, gender?: 'male' | 'female', selectedTopics?: QimenTopic[]): QimenTopicCandidate[];
