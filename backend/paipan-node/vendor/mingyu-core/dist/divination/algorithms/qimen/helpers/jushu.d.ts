/**
 * @file 奇门遁甲定局数、值符值使、特殊时辰和遁干
 * @description 基于拆补法或置闰法实现时家/日家奇门的定局数、值符值使、特殊时辰检查和遁干。
 *
 * 拆补法以节气为界，不置闰，是当代主流排盘软件（元亨利贞、各在线排盘）普遍采用的定局法。
 *
 * ── 法理依据 ──
 *
 * 《烟波钓叟歌》：
 *   "阴阳二遁分顺逆，一气三元人莫测。
 *    五日都来换一元，接气超神为准则。"
 *
 * 《遁甲演义》卷一：
 *   "冬至后用阳遁，顺布六仪逆布三奇；
 *    夏至后用阴遁，逆布六仪顺布三奇。"
 *
 * 《奇门遁甲秘籍大全》卷三"定局成局诀"列二十四节气三元局数：
 *   冬至惊蛰一七四，小寒二八五为嗣。
 *   大寒春分三九六，立春八五二相随。
 *   ……（二十四节气各有所属）
 *
 * 旬首法源出《秘籍大全》卷四"年家奇门定局"篇：
 *   由干支求旬首地支，旬首地支对应地盘宫位，
 *   该宫之星为值符，该宫之门为值使。
 */
export type QimenJuMethod = 'chaibu' | 'zhirun';
export type QimenChaoShenState = '正授' | '超神' | '接气';
export interface QimenJuShuResult {
    isYangDun: boolean;
    juShu: number;
    yuan: string;
    jieQi: string;
    actualJieQi?: string;
    juMethod: QimenJuMethod;
    fuTou?: string;
    fuTouDate?: string;
    chaoShenOrJieQi?: QimenChaoShenState;
    isZhiRun?: boolean;
    juMethodNote?: string;
}
export interface QimenLayoutContext {
    isYangDun: boolean;
    juShu: number;
}
/**
 * 拆补法 / 置闰法定三元局数
 *
 * 拆补法：
 *   1. 节气按实际交节时刻切换，决定阴阳遁和三元局数表。
 *   2. 每五日一元，以当日向前最近的甲日或己日为符头。
 *   3. 符头所在五日按六十甲子序分属上、中、下元，形成超神、接气时的拆补。
 *   4. 本法不置闰，不把交节后至下一符头前强行改用上一节气。
 *
 * 置闰法：
 *   1. 甲子、己卯、甲午、己酉为四个上元符头，每十五日统领上中下三元。
 *   2. 从最近的天然正授点连续推演；符头先到为超神，交节先到为接气。
 *   3. 累计超神达到传统首尾兼算九日时，仅在芒种或大雪重复本节三元十五日。
 *   4. 闰奇后转为接气，继续推演至下一次正授，不按单个节气局部猜测。
 */
export declare function getQimenJuShu(timeInfo: {
    solar?: {
        year: number;
        month: number;
        day: number;
        hour?: number;
        minute?: number;
        second?: number;
    };
    jieQi: string;
    ganzhi: {
        day: string;
    };
}, juMethod?: QimenJuMethod): QimenJuShuResult;
/**
 * 检查特殊时辰情况
 *
 * 包括：六甲时、六癸时、时干入墓、五不遇时。
 *
 * 时干入墓法理依据：
 *   《奇门宝鉴御定》校正为戊辰、壬辰、己未、癸未、辛丑五时；
 *   另列乙未、丙戌、丁丑为日时干三奇入墓，其凶与墓制同。
 *
 * 五不遇时法理依据（《遁甲演义》）：
 *   时干克日干，名为五不遇，主事多不顺，好事被阻，凶时。
 *
 * @param hourGanZhi 时辰干支字符串（如 "甲子"、"乙丑"）
 * @param dayGanZhi  日干支字符串（用于判断五不遇时）
 * @returns 包含各项特殊条件的检查结果
 */
export declare function checkSpecialHourConditions(hourGanZhi: string, dayGanZhi?: string): {
    isLiuJiaHour: boolean;
    isLiuGuiHour: boolean;
    isShiGanRuMu: boolean;
    isWuBuYuShi: boolean;
    description: string;
};
/**
 * 寻值符与值使（旬首法）
 *
 * 法理：
 *   值符（九星之主）与值使（八门之主）由时辰干支所属的"旬"来决定。
 *   旬首（如甲子、甲戌、甲申等）所遁六仪在当前局地盘所在的九宫，其对应的星即为值符，
 *   其对应的门即为值使。
 *
 * 《奇门遁甲统宗》：
 *   "地盘旬首所临之宫，其星即为值符，其门即为值使。"
 *
 * 计算步骤：
 *   1. 求旬首地支：旬首地支序数 = (时支序 - 时干序 + 12) % 12
 *   2. 以旬首所遁六仪在当前局地盘的落宫作为旬首落宫
 *   3. 该宫之星 = 值符，该宫之门 = 值使；旬首落中五宫时，借坤二死门为值使
 *
 * @param hourGanZhi 时辰干支（如 "甲子"、"乙丑"）
 * @param dayGanZhi  日干支（用于特殊时辰中的五不遇时判断）
 * @param layout      当前奇门局数，用于定位旬首所遁六仪的地盘落宫
 * @returns { zhiFu, zhiShi, zhiFuPalace, specialConditions }
 *    zhiFu            - 值符星名
 *    zhiShi           - 值使门名
 *    zhiFuPalace      - 值符所在宫位（即旬首落宫）
 *    specialConditions - 当前时辰的特殊情况
 *
 * @throws 当时辰干支无法识别时
 */
export declare function getZhiFuZhiShi(hourGanZhi: string, dayGanZhi?: string, layout?: QimenLayoutContext): {
    zhiFu: string;
    zhiShi: string;
    zhiFuPalace: number;
    specialConditions: ReturnType<typeof checkSpecialHourConditions>;
};
/**
 * 通用寻值符与值使（旬首法）
 *
 * 与 getZhiFuZhiShi 的区别：不检查特殊时辰条件（六甲时/五不遇时等），
 * 适用于任意干支（年柱、月柱、日柱、时柱均可）。
 *
 * 旬首法源出《奇门遁甲秘籍大全》：
 *   由干支求旬首，再以旬首所遁六仪在当前局地盘所临之宫定值符值使。
 *
 * @param ganZhi 任意干支字符串（如 "甲子"、"乙丑"）
 * @param layout 当前奇门局数，用于定位旬首所遁六仪的地盘落宫
 * @returns { zhiFu, zhiShi, xunShouPalace }
 *    zhiFu         - 值符星名
 *    zhiShi        - 值使门名
 *    xunShouPalace - 旬首所在宫位编号
 *
 * @throws 当干支无法识别时
 */
export declare function getZhiFuZhiShiByGanZhi(ganZhi: string, layout?: QimenLayoutContext): {
    zhiFu: string;
    zhiShi: string;
    xunShouPalace: number;
};
/**
 * 获取时辰的遁干（甲遁于六仪之下）
 *
 * 法理依据（《烟波钓叟歌》）：
 *   "六甲元号六仪名，三奇即是乙丙丁。
 *    阳遁顺仪奇逆布，阴遁逆仪奇顺行。"
 *
 * 六甲所遁：
 *   甲子遁戊、甲戌遁己、甲申遁庚、
 *   甲午遁辛、甲辰遁壬、甲寅遁癸。
 *
 * 非六甲时辰（时干不为"甲"）返回时干本身。
 *
 * @param hourGanZhi 时辰干支（如 "甲子"、"乙丑"）
 * @returns 遁干后的天干名
 *
 * @example
 *   getDunJiaStem('甲子') // => '戊'
 *   getDunJiaStem('甲戌') // => '己'
 *   getDunJiaStem('乙丑') // => '乙'（非六甲时返回时干本身）
 */
export declare function getDunJiaStem(hourGanZhi: string): string;
