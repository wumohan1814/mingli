/**
 * @file 奇门遁甲九宫排盘算法
 * @description 实现时家奇门转盘法与飞盘法的完整九宫格排盘，包含地盘、天盘、人盘、神盘四层。
 *
 * ─── 古籍依据 ───
 *
 * 《烟波钓叟歌》：
 *   "先观九宫分八卦，次详六甲与三奇。
 *    直符直使从中起，顺逆推算莫差迟。"
 *
 * 《御定奇门宝鉴》：
 *   "布五宫则寄坤土……此寄宫终非正位，故遇直符直使在五则皆注避五。"
 *   故本盘转盘值使遇中五时统一寄坤二，另有一派作阳遁寄艮八、阴遁寄坤二，
 *   因与《御定奇门宝鉴》所遵旧本不同，本项目保留前者为默认口径。
 *
 * 《奇门遁甲秘籍大全》卷三"排盘诀"：
 *   第一步 布地盘三奇六仪 —— "阳遁顺布六仪，逆布三奇；阴遁逆布六仪，顺布三奇"
 *   第二步 定值符值使落宫 —— "旬首所值之星为值符，所值之门为值使"
 *   第三步 排天盘九星 —— "星随符转，各归其所"（《遁甲演义》）
 *   第四步 排人盘八门 —— "门随地转，宫中无门不入"
 *   第五步 排神盘八神 —— "八神随遁顺逆，中宫无神位"（《遁甲演义》）
 *
 * 《易纬·乾凿度》：
 *   太一九宫体系 —— "戴九履一，左三右七，二四为肩，六八为足，五居中央"
 *   洛书轨迹 —— "一居坎、八居艮、三居震、四居巽、九居离、二居坤、七居兑、六居乾"
 *
 * 流派说明：
 *   转盘法（zhuanpan）为时家奇门主流，天盘九星整体旋转、人盘八门沿洛书轨迹旋转。
 *   飞盘法（feipan）按洛书飞宫路径布九星，作为可选争议口径提供。
 */
import type { QimenJiuGongGe } from '../../../../types/divination';
/**
 * 奇门排盘方法
 * - 'zhuanpan': 转盘法（默认），天盘九星、人盘八门整体旋转，神盘八神飞布
 * - 'feipan': 飞盘法，天盘九星按洛书轨迹飞布，人盘八门仍随值使旋转
 */
export type QimenMethod = 'zhuanpan' | 'feipan';
export declare function resolveZhiShiLandingPalace(isYangDun: boolean, zhiShi: string, ganZhi: string, startPalace?: number, method?: QimenMethod): number;
/**
 * 排九宫格（转盘法）
 *
 * 按照《奇门遁甲秘籍大全》卷三"排盘诀"所述五大步骤，生成完整的九宫格数据。
 * 每宫包含：宫位信息、地盘干、天盘星与干、人盘门、神盘神。
 *
 * @param isYangDun  是否为阳遁
 * @param juShu      局数（1-9）
 * @param zhiFu      值符星名（如 "天蓬"）
 * @param zhiShi     值使门名（如 "休门"）
 * @param ganzhi     时辰干支，如 { hour: "甲子" }
 * @param method     排盘方法，默认 'zhuanpan'（转盘法）
 *
 * @returns 包含九宫完整排盘数据的数组，每宫含 tianPan / diPan / renPan / shenPan 四盘
 *
 * @throws 当找不到时干落宫或时支对应的地盘宫位时
 *
 * @example
 * ```ts
 * const jiuGong = arrangeJiuGongGe(true, 3, '天冲', '伤门', { hour: '乙丑' });
 * console.log(jiuGong[0]); // { gong: 1, name: '坎一宫', tianPan: {...}, ... }
 * ```
 */
export declare function arrangeJiuGongGe(isYangDun: boolean, juShu: number, zhiFu: string, zhiShi: string, ganzhi: {
    hour: string;
}, method?: QimenMethod): QimenJiuGongGe[];
