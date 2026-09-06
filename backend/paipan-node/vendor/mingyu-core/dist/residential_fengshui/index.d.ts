/**
 * @file 住宅风水（八宅 + 玄空飞星 一站式）
 * @description 产品入口收敛为“住宅风水”；算法仍分层计算八宅与玄空，再合成统一结果与提示词。
 * @传统依据 八宅参照《八宅明镜》《阳宅十书》；玄空参照三元九运、下卦山向飞布等通行口径。
 * 不生成综合吉凶总分，不把两套体系互相改写。
 */
import { type BaZhaiResult } from '../ba_zhai';
import { type XuanKongResult } from '../xuan_kong';
export interface ResidentialFengshuiInput {
    /** 建造年或起运年；排玄空宅运盘时必需 */
    year?: number;
    /** 出生公历年，用于八宅命卦 */
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    gender?: 'male' | 'female';
    mingGua?: string;
    sitMountain?: string;
    facingMountain?: string;
    facingDegree?: number;
    sitDegree?: number;
    /** 八宅门向测量：站在大门处面向屋内 */
    doorToInteriorDegree?: number;
    northReference?: 'unspecified' | 'magnetic' | 'true';
    magneticDeclinationDegrees?: number;
    measurementUncertaintyDegrees?: number;
    flowYear?: number;
    flowMonth?: number;
    flowDay?: number;
}
export interface ResidentialFengshuiAgreement {
    level: '一致关注' | '可互补' | '资料不足' | '口径不同需分述';
    title: string;
    detail: string;
}
export interface ResidentialFengshuiResult {
    key: 'residential-fengshui';
    label: '住宅风水';
    inputSummary: {
        hasPerson: boolean;
        hasHouseOrientation: boolean;
        houseYear: number | null;
        orientationText: string;
        xuankongStatus: '已排盘' | '缺少山向' | '缺少建造年或起运年';
    };
    bazhai: BaZhaiResult | null;
    xuankong: XuanKongResult | null;
    agreements: ResidentialFengshuiAgreement[];
    advice: string[];
    prompt: string;
    evidencePromptText: string;
}
export declare function generateResidentialFengshui(input?: ResidentialFengshuiInput): ResidentialFengshuiResult;
export declare const residentialFengshui: {
    generateResidentialFengshui: typeof generateResidentialFengshui;
};
