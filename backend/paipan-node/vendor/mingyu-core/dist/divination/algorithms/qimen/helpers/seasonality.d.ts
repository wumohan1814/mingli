/**
 * @file 节令背景（Seasonal Context）分析
 * @description 奇门遁甲节气背景分析：二十四节气五行属性映射、
 * 节气内自然日阶段、日干与节令五行的旺相关系、月相、
 * 十二建除、以及干支互动（六合/三合/半合/六冲/相刑/相害）。
 *
 * 古籍依据：
 *   - 《协纪辨方书》卷三"二十四节气"篇：「立春寅月节……大寒丑月中」
 *   - 《淮南子·天文训》：「日行一度，十五日为一节，以生二十四时之变」
 *   - 《淮南子·时则训》四时五行配属
 *   - 《奇门遁甲秘籍大全》卷三"定局成局诀"
 *   - 《烟波钓叟歌》：「先须掌上排九宫，纵横十五其中。次将八卦论八节，一气统三为正宗。」
 *   - 《太白阴经》卷四"建除十二神"篇
 *   - 《礼记·月令》「孟春之月，日在营室；仲春之月，日在奎……」
 *   - 《五行大义》论旺相休囚死
 */
import { type SolarTermEvidence } from '../../../../calendar/solar-term-evidence';
import { type MoonPhaseEvidence } from '../../../../calendar/moon-phase-evidence';
import type { BaseGanZhi } from '../../../../types/divination';
/**
 * 二十四节气五行属性映射表
 *
 * 以月建（地支）之五行定节气所属。每月含一个节一个气（节为月首，气为月中）。
 * 十二月建分属五行：
 *   寅卯属木，巳午属火，申酉属金，亥子属水，辰戌丑未属土。
 *
 * 《协纪辨方书》卷三"二十四节气"：
 *   "正月立春寅节、雨水寅中……二月惊蛰卯节、春分卯中……
 *    三月清明辰节、谷雨辰中……四月立夏巳节、小满巳中……
 *    五月芒种午节、夏至午中……六月小暑未节、大暑未中……
 *    七月立秋申节、处暑申中……八月白露酉节、秋分酉中……
 *    九月寒露戌节、霜降戌中……十月立冬亥节、小雪亥中……
 *    十一月大雪子节、冬至子中……十二月小寒丑节、大寒丑中。"
 *
 * 《淮南子·天文训》：
 *   "日行一度，十五日为一节，以生二十四时之变。"
 *   十二月建分属五行：寅卯属木，巳午属火，申酉属金，亥子属水，辰戌丑未属土。
 */
export declare const JIE_QI_SEASONS: Record<string, string>;
/**
 * 获取节气对应的五行属性
 * @param jieQi 节气名称（如 "立春"、"冬至"）
 * @returns 五行名
 */
export declare function getSeasonalElement(jieQi: string): string;
/**
 * 交节后自然日阶段结果
 */
export interface JieQiPhaseResult {
    /** 节气名称 */
    jieQi: string;
    /** 节气内自然日阶段：上元（初）、中元、下元（末），不作为奇门正式定局三元 */
    phase: '上元' | '中元' | '下元';
    /** 数字索引：0 → 上元，1 → 中元，2 → 下元 */
    phaseIndex: number;
    /** 当前节气的历表边界、太阳视黄经核验和精度限制 */
    solarTermEvidence: SolarTermEvidence;
}
/**
 * 由太阳历日期计算交节后的自然日阶段
 *
 * 每个节气跨度约 15 天，拆分为上元（第 1-5 天）、中元（第 6-10 天）、
 * 下元（第 11-15 天）。此字段只描述节气内日期位置；正式定局三元由定局算法给出。
 *
 * @param date 太阳历（公历）日期
 * @returns 节气内自然日阶段信息
 */
export declare function getJieQiPhaseByDate(date: Date): JieQiPhaseResult;
/**
 * 日干与节令五行关系类型
 *
 * 《五行大义》论旺相休囚死：
 *   同令为旺（日干与当令五行相同）→ 得时
 *   令生为相（当令五行生日干）   → 受生
 *   克令为囚（日干克当令五行）   → 持平
 *   生令为休（日干生当令五行）   → 被耗
 *   令克为死（当令五行克日干）   → 受克
 */
export type DaySeasonRelation = '得时' | '受生' | '受克' | '被耗' | '持平';
/**
 * 计算日干与节令五行的关系
 *
 * @param dayStem 日干（如 "甲"、"乙"）
 * @param seasonalElement 当前节气的当令五行
 * @returns 日干在节令中的状态
 *
 * @example
 *   getDaySeasonRelation('甲', '木') // => '得时'（同为木）
 *   getDaySeasonRelation('乙', '火') // => '受生'（木生火→季节生日干…实际需反向：火→木？）
 *
 * 分析逻辑：
 *   以"我"为日干五行，"令"为季节当令五行：
 *   同令 → 旺（得时）相 → 令生为相（受生）
 *   令克 → 死（受克）  生令 → 休（被耗）
 *   克令 → 囚（持平）
 */
export declare function getDaySeasonRelation(dayStem: string, seasonalElement: string): {
    relation: DaySeasonRelation;
    description: string;
};
/**
 * 四相月相类型
 *
 * 《协纪辨方书》引《淮南子》：
 *   月有盈亏，朔（新月）望（满月）弦（上下弦）为四正相位，
 *   各主阴阳消长之机。
 */
export type LunarPhase = '新月' | '上弦' | '满月' | '下弦';
export declare function getLunarPhaseByIndex(index: number): LunarPhase;
/**
 * 获取农历日对应的四相月相
 * @param date 公历日期
 * @returns 月相
 */
export declare function getLunarPhase(date: Date): LunarPhase;
/**
 * 节令背景信息
 */
export interface SeasonalityInfo {
    /** 当前节气名称 */
    currentJieQi: string;
    /** 节气对应的五行属性 */
    seasonalElement: string;
    /** 交节后自然日阶段（上元/中元/下元），不作为正式定局三元 */
    jieQiPhase: JieQiPhaseResult;
    /** 日干 */
    dayStem: string;
    /** 日干五行属性 */
    dayElement: string;
    /** 日干与节令关系 */
    seasonRelation: DaySeasonRelation;
    /** 关系描述文本 */
    seasonRelationDescription: string;
    /** 四相月相 */
    lunarPhase: LunarPhase;
    /** 月相详细名称（来自 tyme4ts 的八相名，如蛾眉月、盈凸月等） */
    lunarPhaseDetail: string;
    /** 日月黄经差、照明比例及前后朔弦望时刻 */
    moonPhaseEvidence: MoonPhaseEvidence;
    /** 历法八相名称与天文相位八分法是否一致 */
    lunarPhaseConsistency: boolean;
    /** 十二建除（建/除/满/平/定/执/破/危/成/收/开/闭） */
    dayOfficer: string;
    /** 建除十二神吉凶倾向 */
    dayOfficerFortuneLabel: '吉' | '凶' | '平';
    /** 建除十二神宜忌简述 */
    dayOfficerAdvice: string;
    /** 干支互动分析结果 */
    ganzhiInteractions: GanzhiInteraction[];
}
export declare function getDayOfficerInfo(dayOfficer: string): {
    fortune: "\u5409" | "\u51F6" | "\u5E73";
    meaning: string;
};
/**
 * 构建完整节令背景信息
 *
 * 综合节气、三元、日干旺衰、月相、建除十二神及干支互动，
 * 产出奇门遁甲起盘时所需的完整时令季节上下文。
 *
 * @param ganzhi 四柱干支
 * @param jieQi 节气名称
 * @param date 公历日期（用于从 tyme4ts 获取精确节气、月相、建除等数据）
 * @returns 节令背景信息
 */
export declare function buildSeasonality(ganzhi: BaseGanZhi, jieQi: string, date: Date): SeasonalityInfo;
/**
 * 干支互动类型
 */
export interface GanzhiInteraction {
    /** 互动类型 */
    type: '六合' | '三合' | '半合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲';
    /** 涉及的四柱字段（如 "year"、"month"、"day"、"hour"） */
    pillars: string[];
    /** 涉及的具体干支值 */
    values: string[];
    /** 互动描述文本 */
    description: string;
}
/**
 * 分析四柱干支之间的互动关系
 *
 * 涵盖：
 *   地支：六合、三合、半合、六冲、相刑、相害
 *   天干：天干五合、天干相冲
 *
 * 《协纪辨方书》论三合六合：
 *   "三合者，申子辰合水、亥卯未合木、寅午戌合火、巳酉丑合金。"
 *   "六合者，子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土。"
 *
 * 《淮南子·天文训》：
 *   "子午、丑未、寅申、卯酉、辰戌、巳亥相冲。"
 *   "子卯相刑，寅巳申三刑，丑未戌三刑。"
 *
 * @param ganzhi 四柱干支
 * @returns 所有检测到的干支互动关系
 */
export declare function analyzeGanzhiInteractions(ganzhi: BaseGanZhi): GanzhiInteraction[];
