/**
 * @file 经典格局库与识别函数
 * @description 八字经典格局体系扩充，按《渊海子平》《三命通会》《子平真诠》收录传统外格。
 * @古籍依据 《渊海子平》卷二"论外格"、《三命通会》卷六"论诸格"
 *
 * 格局分类：
 * - 专旺格：曲直(木)/炎上(火)/稼穑(土)/从革(金)/润下(水)
 * - 化气格：甲己化土/乙庚化金/丙辛化水/丁壬化木/戊癸化火
 * - 特殊结构：金神/日贵/日德/福德秀气/子午双包
 * - 逸格局：井栏叉格/壬骑龙背/六阴朝阳/飞天禄马等
 */
import type { BaziChartResult } from '../baziTypes';
export interface ClassicPattern {
    id: string;
    name: string;
    description: string;
    conditions: {
        dayStems?: string[];
        monthBranch?: string[];
        otherConditions?: string[];
        anyConditions?: string[];
        exactMonthBranchMap?: Record<string, string>;
        excludePatterns?: string[];
    };
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    level: '极品' | '上等' | '中等';
    source?: {
        title: string;
        quote: string;
        url: string;
    };
}
export declare function identifyClassicPattern(dayStem: string, monthBranch: string, pillars: BaziChartResult['pillars'], hiddenStems: BaziChartResult['hiddenStems'], currentPattern?: string): ClassicPattern | null;
