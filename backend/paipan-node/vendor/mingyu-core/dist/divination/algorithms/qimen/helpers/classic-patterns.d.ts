/**
 * @file 奇门遁甲经典格局识别
 * @description 实现九大遁格、三奇格局、三诈五假、值符值使关系、相佐、守户、玉女守门、门迫、击刑、入墓、
 * 天地盘干关系等经典格局的完整检测。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「天遁地遁与人遁，龙遁虎遁与风遁，云遁鬼遁与神遁，九遁合参最上乘」
 *   - 《遁甲演义》：「三奇得使最为良，玉女守门喜非常」
 *   - 《奇门遁甲秘籍大全》：「符使同宫事必成，门迫宫兮事难行」
 *   - 《烟波钓叟歌》：「十干入墓主事迟，击刑之处防官非」
 *
 * 本模块集中输出会进入主排盘的经典格局。单一干干加临格局
 * （青龙返首、飞鸟跌穴、青龙逃走、白虎猖狂等）由
 * stem-pair-patterns.ts 维护表义，此处只接入有固定名称的格局。
 */
import type { QimenJiuGongGe } from '../../../../types/divination';
/** 经典格局 */
export interface ClassicPattern {
    /** 内部稳定标识 */
    key: string;
    /** 格局名称（用于显示） */
    name: string;
    /** 吉/凶/中 */
    tone: 'good' | 'bad' | 'neutral';
    /** 评分增减（吉为正，凶为负，绝对值越大影响越强） */
    score: number;
    /** 简要说明 */
    summary: string;
    /** 现代解读 */
    modern: string;
    /** 格局应验表现 */
    manifestation?: string;
    /** 涉及的宫位 */
    palace?: number;
    /** 涉及的天干/星/门/神（用于解释） */
    tokens?: string[];
}
/** 天地盘干关系 */
export interface StemRelation {
    /** 天盘干 */
    heaven: string;
    /** 地盘干 */
    earth: string;
    /** 宫位 */
    palace: number;
    /** 关系类型 */
    type: '克上' | '克下' | '相佐' | '比和' | '生上' | '生下' | '奇仪相合' | '命名格局' | '入墓' | '击刑' | '空亡';
    /** 现代说明 */
    note: string;
}
/**
 * 识别天地盘干关系
 *
 * 每个宫位最多输出一条主关系，并附加最多一条特殊（入墓/击刑/奇仪相合）。
 *
 * 入墓与击刑为独立判定，与五行关系可以共存不同宫位，但同宫内
 * 若已有入墓或击刑，则不再输出五行生克/奇仪相合（避免关系过多）。
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 天地盘干关系列表
 */
export declare function getStemRelations(jiuGongGe: QimenJiuGongGe[]): StemRelation[];
/** 经典格局识别上下文 */
export interface PatternContext {
    /** 九宫格数据 */
    jiuGongGe: QimenJiuGongGe[];
    /** 值符星 */
    zhiFu: string;
    /** 值使门 */
    zhiShi: string;
    /** 年干支，用于岁格 */
    yearGanZhi?: string;
    /** 月干支，用于月格 */
    monthGanZhi?: string;
    /** 日干 */
    dayStem?: string;
    /** 日干支，用于甲日遁干与日干飞伏格 */
    dayGanZhi?: string;
    /** 时辰干支，用于时格、天辅时等按日时组合成立的格局 */
    hourGanZhi?: string;
}
/**
 * 识别所有经典奇门格局
 *
 * 涵盖：
 *   九大遁格（天遁、地遁、人遁、神遁、鬼遁、龙遁、虎遁、风遁、云遁）
 *   三奇格局（得使、升殿、入墓、会甲）与三诈五假
 *   值符值使关系（符使同宫、相佐、守户、天乙飞宫格、天乙伏宫格、天辅时）
 *   玉女守门
 *   门迫与门宫相生
 *   击刑
 *   入墓
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「天遁地遁与人遁，龙遁虎遁与风遁，云遁鬼遁与神遁」
 *   - 《奇门遁甲秘籍大全》：「三奇得使最为良，玉女守门喜非常」
 *   - 《烟波钓叟歌》：「十干入墓主事迟，击刑之处防官非」
 *   - 《五行大义》：「门迫则事阻，宫生则事成」
 *
 * @param ctx - 识别上下文
 * @returns 检测到的所有经典格局列表
 */
export declare function getClassicPatterns(ctx: PatternContext): ClassicPattern[];
