import { type QizhengInput, type QizhengResult } from '../qi_zheng';
import { type BirthProfile, type NormalizedBirthProfile } from '../profile';
import { type ZiweiRuntime, type ZiweiRuntimeOptions } from '../ziwei/runtime';
import type { AstrolabeBirthInput, AstrolabeData } from '../types/divination';
import type { BaziChartResult, Person } from '../bazi/baziTypes';
import type { ChartInput } from '../types/chart';
export type { BirthProfile } from '../profile';
export type BirthChartSystem = 'bazi' | 'ziwei' | 'astrolabe' | 'qizheng';
export interface BirthChartBundleInputs {
    bazi?: Person;
    ziwei?: ChartInput;
    astrolabe?: AstrolabeBirthInput;
    qizheng?: QizhengInput;
}
/** 一份出生档案按所选系统生成的完整结果集合。 */
export interface BirthChartBundle {
    profile: BirthProfile;
    normalized: NormalizedBirthProfile;
    systems: BirthChartSystem[];
    inputs: BirthChartBundleInputs;
    bazi?: BaziChartResult;
    ziwei?: ZiweiRuntime;
    astrolabe?: AstrolabeData;
    qizheng?: QizhengResult;
}
export interface BirthChartBundleOptions {
    /** 默认只计算八字；紫微需要调用方安装可选 peerDependency iztro。 */
    systems?: BirthChartSystem[];
    ziwei?: ZiweiRuntimeOptions;
}
/**
 * 从同一份出生档案生成多个盘面。
 *
 * 该入口只负责输入统一、算法调用和结果归组，不生成报告，也不把缺失资料
 * 静默替换成候选盘。所选系统所需的资料不足时，沿用各适配器的结构化错误。
 */
export declare function calculateBirthChartBundle(profile: BirthProfile, options?: BirthChartBundleOptions): Promise<BirthChartBundle>;
