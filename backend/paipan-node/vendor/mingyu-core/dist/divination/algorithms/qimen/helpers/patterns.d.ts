/**
 * @file 奇门遁甲模式标签与宫位洞察
 * @description 提供奇门遁甲基础格局标签识别（伏吟、反吟、门迫、击刑、入墓、
 * 三奇得、符使同宫、三奇得使、三奇游六仪、马星）、标签转详情、以及宫位级洞察。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「星反吟兮门反吟，门迫宫兮事难行」
 *   - 《烟波钓叟歌》：「击刑之处防官非，十干入墓主事迟」
 *   - 《遁甲演义》：「三奇倘合开休生，便是吉门利出行」
 *   - 《烟波钓叟歌》：「三奇得使最为良，符使同宫事必成」
 *   - 《遁甲演义》：「天马方为动应之神，驿马冲则事速」
 *
 * @module patterns
 */
import type { QimenJiuGongGe } from '../../../../types/divination';
/**
 * 标签识别函数 getQimenPatternTags 的输入参数
 */
export interface QimenPatternTagParams {
    /** 值符星名称（如 天蓬、天芮） */
    zhiFu: string;
    /** 值使门名称（如 休门、生门） */
    zhiShi: string;
    /** 值符星落宫编号（1-9） */
    zhiFuLandingPalace: number;
    /** 值使门落宫编号（1-9） */
    zhiShiLandingPalace: number;
    /** 九宫格完整数据 */
    jiuGongGe: QimenJiuGongGe[];
    /** 时干遁干（用于击刑/入墓判断） */
    hourGanForFind: string;
    /**
     * 马星落宫编号（可选）
     * 由调用方传入（通常为时支驿马所在宫位）。
     * 不传或 undefined 时不输出马星标签。
     */
    horsePalace?: number;
    /**
     * 马星名称（可选，配合 horsePalace 使用）
     * 如果不传则默认以 "驿马" 称呼。
     */
    horsePalaceName?: string;
}
/**
 * 识别奇门遁甲基础模式标签
 *
 * 依次检测以下标签（每类标签可能输出0到多条）：
 *
 * **伏吟 / 反吟（全局层面）**
 *   - 星伏吟：值符星落回原宫（九星原位），主事缓盘桓
 *   - 星反吟：值符星落原宫对冲宫，主波动反复
 *   - 门伏吟：值使门落回原宫（八门本位），主事迟待机
 *   - 门反吟：值使门落原宫对冲宫，主突变调整
 *
 * **宫位层面**
 *   - 门迫：门克宫，该宫事务易受阻
 *   - 击刑：时干遁干落击刑宫，主压力掣肘
 *   - 入墓：时干遁干落入墓宫，主能量被困
 *
 * **吉格局**
 *   - 三奇得：乙/丙/丁与开/休/生三吉门同宫
 *   - 符使同宫：值符星与值使门同落一宫
 *   - 三奇得使：乙/丙/丁加特定六甲旬首所遁六仪
 *   - 马星：驿马所在宫（需传入 horsePalace）
 *
 * @param params - 标签识别参数
 * @returns 模式标签字符串数组
 *
 * @example
 * ```ts
 * const tags = getQimenPatternTags({
 *   zhiFu: '天蓬',
 *   zhiShi: '休门',
 *   zhiFuLandingPalace: 1,
 *   zhiShiLandingPalace: 8,
 *   jiuGongGe,
 *   hourGanForFind: '戊',
 *   horsePalace: 3,
 * });
 * // => ['星伏吟', '三奇得（乙奇（日奇）合休门于震三宫）', '马星（驿马落震三宫）']
 * ```
 */
export declare function getQimenPatternTags(params: QimenPatternTagParams): string[];
/**
 * 模式标签详情条目
 */
export interface PatternDetail {
    /** 原始标签文本 */
    tag: string;
    /** 面向用户的简要解读 */
    summary: string;
}
/**
 * 将模式标签数组转换为带解读的详情对象数组
 *
 * 每个标签映射为 { tag, summary } 结构，方便前端直接使用。
 *
 * @param patternTags - 模式标签字符串数组
 * @returns 详情对象数组
 *
 * @example
 * ```ts
 * buildPatternDetails(['星伏吟', '门迫（离九宫景门）']);
 * // => [
 * //   { tag: '星伏吟', summary: '九星回原位，事情多原地盘旋、推进偏慢。' },
 * //   { tag: '门迫（离九宫景门）', summary: '门克宫，该宫事项易受压制，行动阻力偏大。' },
 * // ]
 * ```
 */
export declare function buildPatternDetails(patternTags: string[]): PatternDetail[];
/**
 * 宫位洞察函数 buildPalaceInsights 的输入参数
 */
export interface PalaceInsightParams {
    /** 九宫格完整数据 */
    jiuGongGe: QimenJiuGongGe[];
    /** 值符星名称 */
    zhiFu: string;
    /** 值使门名称 */
    zhiShi: string;
    /** 全部模式标签（用于风险类标签匹配检测） */
    patternTags: string[];
}
/**
 * 宫位洞察条目
 */
export interface PalaceInsight {
    /** 宫位编号（1-9） */
    gong: number;
    /** 宫位中文名（如 坎一宫、离九宫） */
    name: string;
    /**
     * 洞察等级：
     *   - 有利：该宫有吉门、吉神或值使，适合行动
     *   - 关注：该宫有值符，是全局核心观察位
     *   - 风险：该宫有凶门、凶神或携带风险类标签
     */
    level: '有利' | '风险' | '关注';
    /** 面向用户的中文解读 */
    summary: string;
}
/**
 * 生成宫位级洞察
 *
 * 对每个宫位，综合门、神、星和现有模式标签，给出以下三类判断：
 *
 * **有利（绿色）**
 *   该宫携带值使门、吉门（开/休/生）或吉神（值符/六合/九天/太阴）。
 *   可作为推进、求助或争取资源的优先方位。
 *
 * **关注（黄色）**
 *   该宫有值符星（大值符），是局核心观察位。
 *   代表当前事体的统领方，需重点关注此宫动静。
 *
 * **风险（红色）**
 *   该宫带有门迫/击刑/入墓等风险标签，或携凶门（伤/死/惊）/凶神（白虎/玄武/螣蛇）。
 *   行为阻滞和牵制较明显，宜谨慎行事。
 *
 * 注意：同一宫位可能同时属于多个等级（如有值符同时也有凶门），
 * 此时会输出多条洞察，风险优先展示。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「八门若遇开休生，诸事逢之总称情」
 *   - 《烟波钓叟歌》：「伤死惊门皆凶恶，杜门无事好躲藏」
 *   - 《遁甲演义》：「值符为八神之主，其所在宫为全局枢纽」
 *
 * @param args - 宫位洞察输入参数
 * @returns 宫位洞察条目数组
 *
 * @example
 * ```ts
 * const insights = buildPalaceInsights({
 *   jiuGongGe,
 *   zhiFu: '天蓬',
 *   zhiShi: '休门',
 *   patternTags,
 * });
 * // 返回值示例：
 * // [
 * //   { gong: 1, name: '坎一宫', level: '风险',
 * //     summary: '该宫带有门迫（坎一宫休门），行事阻滞和牵制较明显。' },
 * //   { gong: 1, name: '坎一宫', level: '关注',
 * //     summary: '值符落坎一宫，是当前局的核心观察位。' },
 * // ]
 * ```
 */
export declare function buildPalaceInsights(args: PalaceInsightParams): PalaceInsight[];
