/** 地点树中的区县节点。 */
export interface BirthPlaceDistrictOption {
    id: string;
    label: string;
    displayName: string;
    pinyin?: string;
    longitude: number;
    latitude?: number;
    [key: string]: unknown;
}
/** 地点树中的城市节点。 */
export interface BirthPlaceCityOption {
    id: string;
    label: string;
    displayName: string;
    pinyin?: string;
    longitude: number;
    latitude?: number;
    districts: readonly BirthPlaceDistrictOption[];
    [key: string]: unknown;
}
/** 地点树中的省级节点。 */
export interface BirthPlaceProvinceOption {
    id: string;
    label: string;
    displayName?: string;
    pinyin?: string;
    longitude: number;
    latitude?: number;
    cities: readonly BirthPlaceCityOption[];
    [key: string]: unknown;
}
export interface BirthPlaceCascadePath {
    province: BirthPlaceProvinceOption;
    city?: BirthPlaceCityOption;
    district?: BirthPlaceDistrictOption;
}
export type BirthPlaceLevel = 'province' | 'city' | 'district';
export type BirthPlaceCoordinateAccuracy = 'administrative-center' | 'province-approximation';
/** 可直接交给出生档案使用的地点解析结果。 */
export interface ResolvedBirthPlace {
    regionId: string;
    level: BirthPlaceLevel;
    label: string;
    displayName: string;
    pinyin?: string;
    longitude: number;
    /** 行政中心纬度或省级近似纬度；自定义地点树没有可用来源时省略。 */
    latitude?: number;
    timezone: 8;
    coordinateAccuracy?: BirthPlaceCoordinateAccuracy;
    path: BirthPlaceCascadePath;
}
export interface BirthPlaceSearchOptions {
    /** 最多返回多少项，默认 20，最大 100。 */
    limit?: number;
    /** 限定省、市、区县层级。 */
    levels?: readonly BirthPlaceLevel[];
}
export interface BirthPlaceIndex {
    getProvinceOptions(): readonly BirthPlaceProvinceOption[];
    getCityOptions(provinceId: string): readonly BirthPlaceCityOption[];
    getDistrictOptions(cityId: string): readonly BirthPlaceDistrictOption[];
    findByRegionId(regionId: string): BirthPlaceCascadePath | null;
    findByDisplayName(displayName: string): BirthPlaceCascadePath | null;
    search(query: string, options?: BirthPlaceSearchOptions): ResolvedBirthPlace[];
    resolve(regionIdOrDisplayName: string): ResolvedBirthPlace | null;
    resolveLongitude(regionIdOrDisplayName: string): number | null;
}
/**
 * 返回省级近似纬度，仅用于缺少行政中心纬度时的兼容回退。
 * 精确星盘计算仍应优先使用真实出生地坐标。
 */
export declare function resolveBirthPlaceApproximateLatitude(regionId: string, fallback?: number): number;
/** 从任意省市区树创建地点索引。 */
export declare function createBirthPlaceIndex(tree: readonly BirthPlaceProvinceOption[]): BirthPlaceIndex;
/** 中国省、市、区出生地点树。 */
export declare const chinaBirthPlaceTree: readonly BirthPlaceProvinceOption[];
/** 预先构建的中国地点索引。 */
export declare const chinaBirthPlaceIndex: BirthPlaceIndex;
export declare function getBirthPlaceProvinceOptions(): readonly BirthPlaceProvinceOption[];
export declare function getBirthPlaceCityOptions(provinceId: string): readonly BirthPlaceCityOption[];
export declare function getBirthPlaceDistrictOptions(cityId: string): readonly BirthPlaceDistrictOption[];
export declare function findBirthPlaceByRegionId(regionId: string): BirthPlaceCascadePath | null;
export declare function findBirthPlaceByDisplayName(displayName: string): BirthPlaceCascadePath | null;
/** 按名称、完整路径、拼音或行政区代码搜索，重名地点会分别返回。 */
export declare function searchBirthPlaces(query: string, options?: BirthPlaceSearchOptions): ResolvedBirthPlace[];
/** 将行政区代码或完整地点名称解析成排盘可用坐标。 */
export declare function resolveBirthPlace(regionIdOrDisplayName: string): ResolvedBirthPlace | null;
export declare function resolveBirthPlaceLongitude(regionIdOrDisplayName: string): number | null;
/** 确认查询结果包含区县节点，便于表单从通用路径收窄类型。 */
export declare function isDistrictBirthPlacePath(path: BirthPlaceCascadePath | null): path is BirthPlaceCascadePath & {
    city: BirthPlaceCityOption;
    district: BirthPlaceDistrictOption;
};
