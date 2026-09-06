/**
 * @file 七政流曜周期事件
 * @description 在流年或流月窗口内扫描换宫、停逆与精确吊照，不以单一时刻代替整段周期。
 */
declare const SIGN_BRANCHES: readonly ["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"];
type QizhengSignBranch = (typeof SIGN_BRANCHES)[number];
export interface QizhengNatalStarRef {
    name: string;
    longitude: number;
}
export type QizhengPeriodMode = 'yearly' | 'monthly' | 'daily';
export type QizhengPeriodEventKind = '精确吊照' | '停逆' | '换宫';
export interface QizhengLongitudeSample {
    name: string;
    longitude: number;
}
export interface QizhengPeriodEvent {
    key: string;
    kind: QizhengPeriodEventKind;
    utcMs: number;
    dateTime: string;
    promptText: string;
    movingStar: string;
    targetStar?: string;
    aspectType?: string;
    palace?: string;
    signBranch?: QizhengSignBranch;
    stationDirection?: '逆行' | '顺行';
}
export interface QizhengPeriodEventCollection {
    startDateTime: string;
    endDateTime: string;
    mode: QizhengPeriodMode;
    events: QizhengPeriodEvent[];
    axis: string[];
    windows: string[];
    promptText: string;
}
export declare function scanQizhengPeriodEvents(params: {
    natalStars: QizhengNatalStarRef[];
    twelvePalaces: ReadonlyArray<{
        palace: string;
        signIndex: number;
        signBranch: QizhengSignBranch;
    }>;
    startUtcMs: number;
    endUtcMs: number;
    timezone: number;
    mode: QizhengPeriodMode;
    sampleLongitudes: (utcMs: number) => QizhengLongitudeSample[];
}): QizhengPeriodEventCollection;
export {};
