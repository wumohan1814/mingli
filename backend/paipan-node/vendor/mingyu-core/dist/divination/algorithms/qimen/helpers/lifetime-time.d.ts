/**
 * @file 奇门终身局时间标准化与校正模块
 * @description 统一处理出生时刻、历法换算、时区/历史夏令时解析以及真太阳时计算。
 */
import type { QimenLifetimeInput, QimenStagePolicy } from '../../../../types/divination';
import { type CivilDateTimeParts } from '../../../../calendar/civil-time';
export interface QimenNormalizedTimeResult {
    /** 用于排盘计算的标准化 Date 对象 */
    normalizedDate: Date;
    /** 四柱计算基准日期（真太阳时模式下为经度修正后的时刻） */
    calculationParts: CivilDateTimeParts;
    /** 依据元数据快照 */
    basis: {
        calendar: string;
        solarTerm: string;
        timeStandard: string;
        timeZoneUsed: string;
        trueSolarOffsetSeconds?: number;
        isDstApplied?: boolean;
        crossesDate?: boolean;
        method: 'zhuanpan' | 'feipan';
        juMethod: 'chaibu' | 'zhirun';
        stagePolicy: QimenStagePolicy;
    };
}
/**
 * 标准化奇门终身局时间输入
 */
export declare function normalizeQimenLifetimeTime(input: QimenLifetimeInput): QimenNormalizedTimeResult;
