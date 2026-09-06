import { type BaziCompatibilityEvidenceResult, type BaziCompatibilityOptions } from '../bazi';
import { type AstrolabeSynastryData, type AstrolabeSynastryOptions } from '../divination';
import { type ZiweiCompatibilityEvidenceResult, type ZiweiCompatibilityOptions } from '../ziwei/iztro';
import { type BirthChartBundle, type BirthChartBundleOptions, type BirthChartSystem } from '../birth';
import type { BirthProfile } from '../profile';
export type CompatibilitySystem = Exclude<BirthChartSystem, 'qizheng'>;
export interface CompatibilityBundleOptions {
    /** 默认只计算八字；需要紫微或星盘时显式加入对应系统。 */
    systems?: CompatibilitySystem[];
    bazi?: BaziCompatibilityOptions;
    ziwei?: ZiweiCompatibilityOptions;
    astrolabe?: AstrolabeSynastryOptions;
    /** 同时传给双方出生盘生成器，例如紫微运限范围与固定计算时刻。 */
    chart?: BirthChartBundleOptions;
}
export interface CompatibilityBundle {
    systems: CompatibilitySystem[];
    primary: BirthChartBundle;
    partner: BirthChartBundle;
    bazi?: BaziCompatibilityEvidenceResult;
    ziwei?: ZiweiCompatibilityEvidenceResult;
    astrolabe?: AstrolabeSynastryData;
}
/** 从两份 BirthProfile 直接生成八字、紫微和西占合盘证据。 */
export declare function calculateCompatibilityBundle(primary: BirthProfile, partner: BirthProfile, options?: CompatibilityBundleOptions): Promise<CompatibilityBundle>;
