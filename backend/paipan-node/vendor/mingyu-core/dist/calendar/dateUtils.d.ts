/**
 * 日期时间工具函数
 */
export { daysInSolarMonth as getDaysInMonth } from './date-validation';
export interface ShichenPeriod {
    index: number;
    branch: string;
    name: string;
    range: string;
    /** 排盘用代表小时（传统时辰时段的中间时刻）。 */
    hour: number;
    /** 排盘用代表分钟（传统时辰时段的中间时刻）。 */
    minute: number;
}
/**
 * 十二时辰目录；子时按本项目排盘口径拆成早子时与晚子时。
 * `hour`、`minute` 是仅有时辰精度时为完成历法日期换算而采用的时段中点。
 */
export declare const SHICHEN_PERIODS: readonly [{
    readonly index: 0;
    readonly branch: "子";
    readonly name: "早子时";
    readonly range: "00:00-01:00";
    readonly hour: 0;
    readonly minute: 30;
}, {
    readonly index: 1;
    readonly branch: "丑";
    readonly name: "丑时";
    readonly range: "01:00-03:00";
    readonly hour: 2;
    readonly minute: 0;
}, {
    readonly index: 2;
    readonly branch: "寅";
    readonly name: "寅时";
    readonly range: "03:00-05:00";
    readonly hour: 4;
    readonly minute: 0;
}, {
    readonly index: 3;
    readonly branch: "卯";
    readonly name: "卯时";
    readonly range: "05:00-07:00";
    readonly hour: 6;
    readonly minute: 0;
}, {
    readonly index: 4;
    readonly branch: "辰";
    readonly name: "辰时";
    readonly range: "07:00-09:00";
    readonly hour: 8;
    readonly minute: 0;
}, {
    readonly index: 5;
    readonly branch: "巳";
    readonly name: "巳时";
    readonly range: "09:00-11:00";
    readonly hour: 10;
    readonly minute: 0;
}, {
    readonly index: 6;
    readonly branch: "午";
    readonly name: "午时";
    readonly range: "11:00-13:00";
    readonly hour: 12;
    readonly minute: 0;
}, {
    readonly index: 7;
    readonly branch: "未";
    readonly name: "未时";
    readonly range: "13:00-15:00";
    readonly hour: 14;
    readonly minute: 0;
}, {
    readonly index: 8;
    readonly branch: "申";
    readonly name: "申时";
    readonly range: "15:00-17:00";
    readonly hour: 16;
    readonly minute: 0;
}, {
    readonly index: 9;
    readonly branch: "酉";
    readonly name: "酉时";
    readonly range: "17:00-19:00";
    readonly hour: 18;
    readonly minute: 0;
}, {
    readonly index: 10;
    readonly branch: "戌";
    readonly name: "戌时";
    readonly range: "19:00-21:00";
    readonly hour: 20;
    readonly minute: 0;
}, {
    readonly index: 11;
    readonly branch: "亥";
    readonly name: "亥时";
    readonly range: "21:00-23:00";
    readonly hour: 22;
    readonly minute: 0;
}, {
    readonly index: 12;
    readonly branch: "子";
    readonly name: "晚子时";
    readonly range: "23:00-24:00";
    readonly hour: 23;
    readonly minute: 30;
}];
export declare function getShichenByIndex(index: number): ShichenPeriod | null;
export declare function getTimeIndexFromClock(hour: number, minute?: number): number;
export declare function getShichenFromClock(hour: number, minute?: number): ShichenPeriod | null;
