/**
 * @file 奇门终身局动态扫描与事件聚类模块
 * @description 根据用户请求的时间区间（periodRange），按年扫描流年太岁引动、
 * 空亡填实、马星引动与年家盘叠合，聚类生成结构化事件簇（Event Clusters）。
 */
import type { QimenData, QimenEventCluster, QimenLifetimeStage } from '../../../../types/divination';
/**
 * 扫描指定时间范围内的流年动态事件簇
 */
export declare function scanLifetimeDynamicEvents(baseChart: QimenData, stages: QimenLifetimeStage[], periodRange: {
    startDate: string;
    endDate: string;
}, method?: 'zhuanpan' | 'feipan', juMethod?: 'chaibu' | 'zhirun'): QimenEventCluster[];
