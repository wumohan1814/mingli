/**
 * @file 西洋古典占星合盘互溶与接纳（Mutual Reception & Reception）算法
 * @传统依据 托勒密与中世纪传统占星：行星落入对方本征尊贵（庙/旺）之座，形成互溶或接纳，为合盘化解刑冲、促成默契之核心依据。
 */
import type { AstrolabeData, AstrolabeSynastryAspect } from '../types/divination';
export interface AstrolabeSynastryReception {
    type: '互溶' | '接纳';
    person1Planet: string;
    person2Planet: string;
    person1PlanetLabel: string;
    person2PlanetLabel: string;
    sign1: string;
    sign2: string;
    summary: string;
}
/**
 * 依据古典占星守护与曜升计算双方行星互溶与接纳关系
 */
export declare function evaluateAstrolabeSynastryReceptions(chart1: AstrolabeData, chart2: AstrolabeData, aspects?: AstrolabeSynastryAspect[]): {
    receptions: AstrolabeSynastryReception[];
    summary: string;
};
