/**
 * @file 七政四余行限
 * @description 以命宫起大限、小限；阳男阴女顺行，阴男阳女逆行。
 * @传统依据 《果老星宗》《星学大成》命宫起限、一宫十年、一岁一宫及阳男阴女顺逆口径。
 * 虚岁按流年减出生年加一，不以生日时刻切分。
 */
import type { QizhengSignBranch } from './index';
export type QizhengLimitDirection = '顺行' | '逆行';
export interface QizhengLimitStep {
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
    startNominalAge: number;
    endNominalAge: number;
}
export interface QizhengCurrentLimit {
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
    nominalAge: number;
    startNominalAge: number;
    endNominalAge: number;
}
export interface QizhengTimeLordResult {
    yearStem: string;
    yearStemYinYang: '阳' | '阴';
    gender: 'male' | 'female';
    direction: QizhengLimitDirection;
    nominalAge: number;
    ageNote: string;
    majorLimits: QizhengLimitStep[];
    currentMajorLimit: QizhengCurrentLimit;
    currentMinorLimit: {
        palace: string;
        signIndex: number;
        signBranch: QizhengSignBranch;
        nominalAge: number;
    };
    annualBranch: string;
    annualPalace: {
        palace: string;
        signIndex: number;
        signBranch: QizhengSignBranch;
    };
}
export declare function resolveQizhengLimitDirection(gender: 'male' | 'female', yearStemYinYang: '阳' | '阴'): QizhengLimitDirection;
export declare function palaceIndexByLimitStep(step: number, direction: QizhengLimitDirection): number;
export declare function resolveQizhengNominalAge(birthYear: number, flowYear: number): number;
export declare function buildQizhengTimeLords(params: {
    gender: 'male' | 'female';
    yearStem: string;
    yearStemYinYang: '阳' | '阴';
    birthYear: number;
    flowYear: number;
    flowYearBranch: string;
    twelvePalaces: ReadonlyArray<{
        palace: string;
        signIndex: number;
        signBranch: QizhengSignBranch;
    }>;
}): QizhengTimeLordResult;
export declare function formatQizhengTimeLordPrompt(result: QizhengTimeLordResult): string[];
