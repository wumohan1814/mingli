export type FlyDirection = '顺飞' | '逆飞';
/**
 * 九星入中后按显式方向飞布。
 * 返回长度 9 的数组，下标 0..8 对应宫 1..9。
 */
export declare function flyStars(centerStar: number, direction: FlyDirection): number[];
export declare const FLYING_STAR_WUXING: Record<number, '水' | '土' | '木' | '金' | '火'>;
export type FlyingStarYunState = '当运' | '生气' | '退气' | '死气' | '平气';
export type ShanXiangRelation = '生入' | '生出' | '克入' | '克出' | '比和';
export interface XuanKongPeriodStarPlate {
    year: number;
    month?: number;
    day?: number;
    centerStar: number;
    starName: string;
    plate: number[];
    calendarNote: string;
}
export interface XuanKongFlowStars {
    yearPlate: XuanKongPeriodStarPlate;
    monthPlate?: XuanKongPeriodStarPlate;
}
export declare function resolveYearFlyingStar(year: number): XuanKongPeriodStarPlate;
export declare function resolveMonthFlyingStar(year: number, month: number, day?: number): XuanKongPeriodStarPlate;
export declare function resolveXuanKongFlowStars(input: {
    flowYear?: number;
    flowMonth?: number;
    flowDay?: number;
}): XuanKongFlowStars | undefined;
export declare function resolveFlyingStarYunState(star: number, yun: number): FlyingStarYunState;
export declare function resolveShanXiangRelation(shanStar: number, xiangStar: number): ShanXiangRelation;
