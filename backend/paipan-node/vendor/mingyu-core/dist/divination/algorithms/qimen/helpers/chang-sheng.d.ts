/**
 * @file 十二长生（12 growth cycles）评估
 * @description 实现奇门遁甲中十二长生的判断与评分。
 * 十二长生代表事物从发生到消亡的十二个阶段，
 * 用于评估天干在特定宫位的旺衰状态。
 *
 * 古籍依据：
 *   - 《五行大义》论五行长生：「五行金木水火土，各有生长收藏之序」
 *   - 《五行大义·论五行所生》：「木长生在亥，火长生在寅，金长生在巳，水土长生在申」
 *   - 《三命通会》：「阳顺阴逆，各以五行论长生之位」
 *   - 《协纪辨方书》：「长生者，物生之位；沐浴者，物出胎而浴；
 *     冠带者，物渐成；临官者，物壮盛；帝旺者，物极盛；
 *     衰者，物始衰；病者，物病；死者，物死；墓者，物藏；
 *     绝者，物绝；胎者，物萌芽；养者，物养成」
 *   - 《烟波钓叟歌》：「阴阳五行分旺相，八卦甲子论神明」
 */
import type { QimenJiuGongGe } from '../../../../types/divination';
/**
 * 十二长生阶段评估结果
 *
 * 包含阶段名称、索引和评分系数，用于奇门断局中
 * 量化评估天干在某宫位的能量状态。
 */
export interface ChangShengStage {
    /** 十二长生阶段名称（长生/沐浴/冠带/临官/帝旺/衰/病/死/墓/绝/胎/养） */
    stage: string;
    /** 阶段索引（0-11，对应 TWELVE_STAGES 数组顺序） */
    index: number;
    /**
     * 评分系数，用于评估该位置的旺衰力量：
     * - 1.2：旺（临官、帝旺）
     * - 1.0：平（长生、沐浴、冠带、衰、病、死、胎、养）
     * - 0.6：弱（墓、绝）
     */
    scoreFactor: number;
}
/**
 * 十二长生完整序列
 *
 * 《协纪辨方书》论述十二长生顺序：
 * 「长生者，物生之位；沐浴者，物出胎而浴；
 *  冠带者，物渐成；临官者，物壮盛；帝旺者，物极盛；
 *  衰者，物始衰；病者，物病；死者，物死；墓者，物藏；
 *  绝者，物绝；胎者，物萌芽；养者，物养成。」
 */
export declare const CHANG_SHENG_STAGES: readonly ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];
/** 十二长生阶段字面量类型 */
export type ChangShengStageName = (typeof CHANG_SHENG_STAGES)[number];
/**
 * 获取天干五行在目标地支的十二长生阶段（核心计算）
 *
 * 法理（《五行大义》《三命通会》）：
 *   "阳顺阴逆，各以五行论长生之位"
 *
 * 计算步骤：
 *   1. 五行各有长生起始地支（WUXING_CHANGSHENG_START）。
 *   2. 阳干从该起始地支向前（顺时针）逐支推算 12 个阶段。
 *   3. 阴干从该起始地支向后（逆时针）逐支推算 12 个阶段。
 *
 * @param stemWuxing 天干五行（木/火/土/金/水）
 * @param startBranch 长生起始地支（如木为 "亥"、火为 "寅"）
 * @param targetBranch 要判断的目标地支
 * @param isYang 是否为阳干（true=阳干顺行，false=阴干逆行）；默认 true
 * @returns 十二长生阶段结果，包含阶段名、索引（0-11）和评分系数。
 *          参数不合法时返回 stage=''、index=-1、scoreFactor=1.0 的空结果。
 *
 * @example
 * ```ts
 * // 甲木（阳）长生在亥，看寅位 → 临官（旺相）
 * getChangSheng('木', '亥', '寅');
 * // => { stage: '临官', index: 3, scoreFactor: 1.2 }
 *
 * // 乙木（阴）长生在午，看寅位 → 帝旺（逆行 4 位）
 * getChangSheng('木', '午', '寅', false);
 * // => { stage: '帝旺', index: 4, scoreFactor: 1.2 }
 *
 * // 甲木在未位 → 墓
 * getChangSheng('木', '亥', '未');
 * // => { stage: '墓', index: 8, scoreFactor: 0.6 }
 * ```
 */
export declare function getChangSheng(stemWuxing: string, startBranch: string, targetBranch: string, isYang?: boolean): ChangShengStage;
/**
 * 评估某天干在指定宫位的十二长生状态
 *
 * 将天干的五行属性和阴阳性质与宫位的地支相结合，
 * 判断天干在此宫位所处的长生阶段。
 *
 * 法理（《五行大义》）：
 *   天干各有五行，宫位各有地支，地支各有五行。
 *   以天干五行定长生之始，以宫位地支定长生之位，
 *   以天干阴阳定顺逆之行，三合而断旺衰。
 *
 * @param stem 天干（甲/乙/丙/丁/戊/己/庚/辛/壬/癸）
 * @param palaceGong 宫位数（1-9），中五宫（5）无专属地支，返回空结果
 * @returns 十二长生阶段结果
 *
 * @example
 * ```ts
 * // 甲木在震三宫（卯位）→ 帝旺（旺相，峰值）
 * evaluateChangSheng('甲', 3);
 * // => { stage: '帝旺', index: 4, scoreFactor: 1.2 }
 *
 * // 甲木在乾六宫（戌位）→ 养（能量蓄积期）
 * evaluateChangSheng('甲', 6);
 * // => { stage: '养', index: 11, scoreFactor: 1.0 }
 *
 * // 乙木在坎一宫（子位）→ 病（能量衰退）
 * evaluateChangSheng('乙', 1);
 * // => { stage: '病', index: 6, scoreFactor: 1.0 }
 * ```
 */
export declare function evaluateChangSheng(stem: string, palaceGong: number): ChangShengStage;
/**
 * 评估值符星原宫天干在当前落宫的十二长生状态
 *
 * 值符星（大值符）为九星之首，统领全局。在奇门排盘中，
 * 值符星从其原宫起飞，携带原宫地盘干至当前落宫。
 * 该天干在当前宫位所处的长生阶段，反映了值符的能量状态，
 * 进而影响全局的吉凶走向。
 *
 * 《奇门遁甲秘籍大全》：
 *   "值符为九星之主，其所在宫得令则吉，失令则减"
 *   值符星所带天干的旺衰，直接影响值符力量的发挥。
 *
 * 计算步骤：
 *   1. 根据值符星名找到其原宫序号（如 天蓬→0→坎一宫）。
 *   2. 取原宫地盘干作为值符所带天干。
 *   3. 找到值符星当前落宫（天盘中该星所在宫位）。
 *   4. 以当前落宫的地支评估该天干的十二长生阶段。
 *
 * @param result 包含九宫格和值符信息的结果对象
 * @param result.jiuGongGe 九宫格数据（每宫含 tianPan 天盘、diPan 地盘）
 * @param result.zhiFu 值符星名（如 "天蓬"、"天芮"）
 * @returns 十二长生阶段结果。若找不到值符星或其原宫无干，返回空结果。
 *
 * @example
 * ```ts
 * evaluateZhiFuChangSheng({
 *   jiuGongGe: qimenResult.jiuGongGe,
 *   zhiFu: qimenResult.zhiFu,
 * });
 * ```
 */
export declare function evaluateZhiFuChangSheng(result: {
    jiuGongGe: QimenJiuGongGe[];
    zhiFu: string;
}): ChangShengStage;
/**
 * 评估时干（当天时辰的天干）在当前宫位的十二长生状态
 *
 * 时干代表当前时辰和问事主题。在奇门遁甲中，值符星追踪时干遁干，
 * 时干遁干的落宫反映事体的核心状态。通过十二长生评估时干在其落宫的
 * 旺衰，可判断事体当前所处的阶段是起步、鼎盛还是衰败。
 *
 * 甲日干时，甲遁藏于六仪之下（甲子遁戊、甲戌遁己、甲申遁庚、
 * 甲午遁辛、甲辰遁壬、甲寅遁癸），故取遁干进行判断。
 *
 * 《烟波钓叟歌》：
 *   "时干值符同宫位，此方做事最为强"
 *   时干的旺衰状态，直接贡献于断局的吉凶判断。
 *
 * 查找顺序：
 *   1. 优先在天盘（tianPan.stem）中查找时干（遁干）落宫。
 *   2. 若天盘未找到，则在地盘（diPan.stem）中查找。
 *      （如中五宫寄宫等特殊情况）
 *   3. 均未找到则返回空结果。
 *
 * @param result 包含九宫格和时辰干支的结果对象
 * @param result.jiuGongGe 九宫格数据（每宫含 tianPan 天盘、diPan 地盘）
 * @param result.ganzhi 时辰干支，含 hour 字段（如 { hour: '甲子' }）
 * @returns 十二长生阶段结果。若找不到时干落宫，返回空结果。
 *
 * @example
 * ```ts
 * evaluateHourStemChangSheng({
 *   jiuGongGe: qimenResult.jiuGongGe,
 *   ganzhi: qimenResult.ganzhi,
 * });
 * ```
 */
export declare function evaluateHourStemChangSheng(result: {
    jiuGongGe: QimenJiuGongGe[];
    ganzhi: {
        hour: string;
    };
}): ChangShengStage;
