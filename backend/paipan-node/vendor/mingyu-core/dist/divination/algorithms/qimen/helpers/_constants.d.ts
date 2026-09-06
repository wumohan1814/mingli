/**
 * @file 奇门遁甲基础常量
 * @description 集中定义五行、八门、九星、八神、三奇六仪、宫位等所有基础数据，
 * 以及节气局数表、洛书轨迹等排盘所需常量，供各 helper 模块统一引用。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「阴阳五行分旺相，八卦甲子论神明」
 *   - 《遁甲演义》卷一：「五行相生相克，万物之纲纪也」
 *   - 《奇门遁甲秘籍大全》：「八门九星八神各有本气，五行判吉凶」
 *   - 《太白阴经》：「九天九地，太阴六合，螣蛇白虎，玄武勾陈」
 *   - 《易纬·乾凿度》太一九宫之说
 *
 * 五行生克为奇门所有判读的基础：
 *   相生：木 → 火 → 土 → 金 → 水 → 木（循环相生）
 *   相克：木 → 土 → 水 → 火 → 金 → 木（循环相克）
 *
 * 三吉门（开、休、生）对应黄道，主顺遂
 * 三凶门（伤、死、惊）对应黑道，主损耗
 */
/**
 * 五行相生表（由函数 isGenerating 委托公共 isSheng）
 * @deprecated 请直接使用公共干支模块的 isSheng
 */
export declare const elementGenerates: Record<string, string>;
/**
 * 五行相克表（由函数 isControlling 委托公共 isKe）
 * @deprecated 请直接使用公共干支模块的 isKe
 */
export declare const elementControls: Record<string, string>;
/**
 * 天干五行属性
 * 《遁甲演义》：「甲乙木、丙丁火、戊己土、庚辛金、壬癸水」
 */
export declare const stemElements: Record<string, string>;
/**
 * 地支五行属性
 * 子水、丑土、寅木、卯木、辰土、巳火、
 * 午火、未土、申金、酉金、戌土、亥水
 */
export declare const branchElements: Record<string, string>;
/**
 * 八门五行属性
 * 《奇门遁甲秘籍大全》：「休属水、生属土、伤属木、杜属木、
 * 景属火、死属土、惊属金、开属金」
 */
export declare const doorElements: Record<string, string>;
/**
 * 九星五行属性
 * 《北斗九星应象诀》：
 *   天蓬水星主暗伏，天芮土星主病符，天冲木星主震动，
 *   天辅木星主文书，天禽土星主中正，天心金星主医药，
 *   天柱金星主口舌，天任土星主承载，天英火星主显达
 */
export declare const starElements: Record<string, string>;
/** 三吉门：开门、休门、生门（《烟波钓叟歌》） */
export declare const auspiciousDoors: string[];
/** 三凶门：伤门、死门、惊门 */
export declare const difficultDoors: string[];
/** 吉神（黄道之神）：值符、太阴、六合、九天、九地 */
export declare const supportiveGods: string[];
/** 凶神（黑道之神）：螣蛇、白虎、玄武 */
export declare const difficultGods: string[];
/** 三奇：乙（日奇）、丙（月奇）、丁（星奇） */
export declare const sanQiStems: string[];
/** 六仪：戊、己、庚、辛、壬、癸 */
export declare const liuYiStems: string[];
/**
 * 三奇六仪固定顺序（排地盘所用）
 * 阳顺阴逆，从局数宫位开始依次布列九宫：
 *   戊 → 己 → 庚 → 辛 → 壬 → 癸 → 丁 → 丙 → 乙
 * 《奇门遁甲秘籍大全》：「阳遁顺布六仪，逆布三奇；阴遁逆布六仪，顺布三奇」
 */
export declare const sanQiLiuYi: string[];
/**
 * 九宫位置信息
 * 《易纬·乾凿度》太一九宫法：
 * 戴九履一，左三右七，二四为肩，六八为足，五居中央
 */
export declare const ninePositions: {
    name: string;
    direction: string;
    element: string;
    gong: number;
}[];
/**
 * 宫位地支
 * 各宫所对应的地支范围，用于时干入墓、地支落宫等判断
 */
export declare const palaceBranches: Record<number, string[]>;
/** 地支到宫位的映射（地盘） */
export declare const diPanPalaces: Record<string, number>;
/**
 * 天干入墓表：天干 → 墓支 → 墓宫
 * 《烟波钓叟歌》：「十干入墓主事迟」
 * 奇门中天干入墓的统一判定依据（《奇门遁甲秘籍大全》）：
 *   乙入未(坤2)、丙入戌(乾6)、丁入丑(艮8)
 *   戊入戌(乾6/中5寄乾6)、己入辰(巽4/中5寄巽4)
 *   庚入未(坤2)、辛入丑(艮8)
 *   壬入辰(巽4)、癸入辰(巽4)
 *
 * @property {string} branch - 墓支
 * @property {number} palace - 墓宫编号
 */
export declare const STEM_TOMB_MAP: Record<string, {
    branch: string;
    palace: number;
}>;
/** 地支列表（十二支顺序） */
export declare const branches: string[];
/** 天干列表（十干顺序） */
export declare const tiangan: string[];
/** 地支序号（子=0, 丑=1, ..., 亥=11） */
export declare const branchIndex: Record<string, number>;
/**
 * 九星顺序（按九宫固定位排列）
 * 坎一(天蓬) → 坤二(天芮) → 震三(天冲) → 巽四(天辅) →
 * 中五(天禽) → 乾六(天心) → 兑七(天柱) → 艮八(天任) → 离九(天英)
 */
export declare const palaceStars: string[];
/**
 * 八门顺序（按洛书轨迹排列）
 * 休门(1) → 生门(8) → 伤门(3) → 杜门(4) →
 * 景门(9) → 死门(2) → 惊门(7) → 开门(6)
 * 此顺序对应洛书轨迹路径，用于排人盘时旋转取值。
 */
export declare const palaceDoors: string[];
/** 八门 → 宫位映射 */
export declare const doorPalaceMap: Record<string, number>;
/** 宫位 → 八门映射 */
export declare const palaceDoorMap: Record<number, string>;
/**
 * 阳遁八神顺序
 * 《奇门宝鉴御定》：“直符前三六合位，太阴之神在前二，后一宫中为九天，后二之神为九地。”
 */
export declare const yangGods: string[];
/**
 * 阴遁八神顺序
 * 阴阳遁差异由排布方向决定，神序同从值符后一宫九天起。
 */
export declare const yinGods: string[];
/**
 * 洛书轨迹（飞宫路径）
 * 用于八门、九星飞布时的落宫顺序（跳过中五宫）。
 * 《洛书九宫数》：「戴九履一，左三右七，二四为肩，六八为足」
 * 飞宫路径：1 → 8 → 3 → 4 → 9 → 2 → 7 → 6
 */
export declare const luoShuPath: number[];
/**
 * 节气与三元局数对应表（置闰法）
 *
 * 奇门定局之枢纽。每个节气统管三元（上元、中元、下元），
 * 每元五日，各对应一个局数。
 *
 * 《烟波钓叟歌》：「先须掌上排九宫，纵横十五在其中。
 *  次将八卦论八节，一气统三为正宗。」
 *
 * 阳遁：冬至 → 芒种（共十二节气）
 * 阴遁：夏至 → 大雪（共十二节气）
 */
export declare const jieQiJuShuMap: Record<string, {
    dun: '阳' | '阴';
    ju: [number, number, number];
}>;
/**
 * 判断五行相生关系
 * @param source 源五行
 * @param target 目标五行
 * @returns source 是否生 target
 */
export declare function isGenerating(source: string, target: string): boolean;
/**
 * 判断五行相克关系
 * @param source 源五行
 * @param target 目标五行
 * @returns source 是否克 target
 */
export declare function isControlling(source: string, target: string): boolean;
/**
 * 获取五行在节令中的旺衰状态
 *
 * 《五行大义》论旺相休囚死：
 *   同令为旺（我当令），令生为相（我生者为相），
 *   生令为休（生我者为休），令克为死（克我者为死），
 *   克令为囚（我克者为囚）。
 *
 * @param element 要判断的元素五行
 * @param seasonElement 当前季节的当令五行
 * @returns '旺' | '相' | '休' | '囚' | '死' | ''
 */
export declare function getElementStrengthInSeason(element: string, seasonElement: string): '旺' | '相' | '休' | '囚' | '死' | '';
