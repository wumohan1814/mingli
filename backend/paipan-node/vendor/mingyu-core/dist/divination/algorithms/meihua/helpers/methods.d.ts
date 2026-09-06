import type { MeihuaCalculation } from '../../../../types/divination';
import { getDivinationTime } from '../../../../calendar/timeManager';
import type { RandomOptions, RandomTrace } from '../../../../shared/random';
export interface MeihuaMethodResult {
    upperTrigramIndex: number;
    lowerTrigramIndex: number;
    movingYaoIndex: number;
    calculation: MeihuaCalculation;
    randomTrace?: RandomTrace;
}
type DivinationTime = ReturnType<typeof getDivinationTime>;
type DivinationGanzhi = DivinationTime['ganzhi'];
type DivinationLunar = DivinationTime['timeInfo']['lunar'];
export declare function resolveTimeMethod(ganzhi: DivinationGanzhi, lunar: DivinationLunar): MeihuaMethodResult;
export declare function resolveTimeTrigramMethod(ganzhi: DivinationGanzhi, lunar: DivinationLunar): MeihuaMethodResult;
export declare function resolveNumberMethod(number: number, timeBranch: string): MeihuaMethodResult;
export declare function resolveRandomMethod(options?: RandomOptions): MeihuaMethodResult;
export {};
