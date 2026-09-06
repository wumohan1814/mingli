import { type BaziChartResult } from '../bazi/index';
import { type TrueSolarTimeConversionResult } from '../calendar/true-solar-time';
import type { AstrolabeData } from '../types/divination';
import type { ActiveScopeInfo, BasicInfo, PalaceFact, ZiweiCalculationConfig } from '../types/analysis';
import { type QizhengResult } from '../qi_zheng/index';
export declare const INSTANT_CHART_TYPES: readonly ["bazi", "ziwei", "bazi-ziwei", "astrolabe", "qizheng"];
export type InstantChartType = (typeof INSTANT_CHART_TYPES)[number];
export type InstantTimeStandard = 'beijing' | 'true-solar';
export interface InstantObserver {
    longitude: number;
    latitude?: number;
    timezone?: number;
    timeZoneId?: string;
    locationName?: string;
}
export interface InstantChartRequest<T extends InstantChartType = InstantChartType> {
    type: T;
    /** 不传时使用调用当刻；传入时必须是有效 Date。 */
    customDate?: Date;
    /** 默认按北京时间；真太阳时必须同时提供 observer。 */
    timeStandard?: InstantTimeStandard;
    observer?: InstantObserver;
    ziweiAlgorithm?: 'default' | 'zhongzhou';
}
export interface InstantWallClockParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}
export interface InstantChartDefinition {
    type: InstantChartType;
    label: string;
    shortLabel: string;
    mark: string;
    description: string;
    requiresObserver: 'never' | 'true-solar' | 'always';
}
export declare const INSTANT_CHART_DEFINITIONS: readonly InstantChartDefinition[];
type BaziPersonalField = 'gender' | 'age' | 'mingGua' | 'luckInfo' | 'liunian' | 'shensha' | 'shenShaAnalysis';
export type InstantBaziChartResult = Omit<BaziChartResult, BaziPersonalField>;
export type InstantZiweiPalace = Pick<PalaceFact, 'index' | 'name' | 'is_body_palace' | 'is_original_palace' | 'heavenly_stem' | 'earthly_branch' | 'major_stars' | 'minor_stars' | 'other_stars' | 'base_jiangqian12' | 'base_suiqian12' | 'empty_state' | 'opposite_palace_index' | 'surrounded_palace_indexes' | 'mutaged_palaces' | 'self_mutagens'>;
export interface InstantZiweiChartResult {
    calculationConfig: ZiweiCalculationConfig;
    basicInfo: Omit<BasicInfo, 'gender'>;
    activeScope: Pick<ActiveScopeInfo, 'scope' | 'label' | 'solar_date' | 'lunar_date' | 'mutagen_map'>;
    palaces: InstantZiweiPalace[];
}
export type InstantAstrolabeChartResult = Omit<AstrolabeData, 'birth'> & {
    birth: Omit<AstrolabeData['birth'], 'gender'>;
};
export type InstantChartResultMap = {
    bazi: InstantBaziChartResult;
    ziwei: InstantZiweiChartResult;
    'bazi-ziwei': {
        bazi: InstantBaziChartResult;
        ziwei: InstantZiweiChartResult;
    };
    astrolabe: InstantAstrolabeChartResult;
    qizheng: QizhengResult;
};
export interface InstantChartResponse<T extends InstantChartType = InstantChartType> {
    type: T;
    label: string;
    generatedAt: string;
    timeStandard: InstantTimeStandard;
    wallClock: InstantWallClockParts;
    observer?: InstantObserver;
    trueSolarTime?: TrueSolarTimeConversionResult;
    result: InstantChartResultMap[T];
}
export declare function buildInstantChartContext(request: Pick<InstantChartRequest, 'type' | 'customDate' | 'timeStandard' | 'observer'>): {
    customDate: Date;
    timeStandard: InstantTimeStandard;
    definition: InstantChartDefinition;
    observer: InstantObserver | undefined;
    wallClock: InstantWallClockParts;
    trueSolarTime: TrueSolarTimeConversionResult | undefined;
};
export declare function calculateInstantChart<T extends InstantChartType>(request: InstantChartRequest<T>): Promise<InstantChartResponse<T>>;
export {};
