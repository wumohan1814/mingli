/**
 * @file 月家、年家奇门局数计算
 * @description 月家奇门和年家奇门的定局算法。
 *
 * 月家奇门以月干支起局，用于查看一月运势；
 * 年家奇门以年干支起局，用于查看一年大势。
 *
 * 古籍依据：
 *   - 《奇门遁甲秘籍大全》年家奇门："三元共一百八十年，上元甲子起一宫"
 *   - 《奇门旨归》年家阳遁诀："甲己一二三四五，乙庚三四五678..."
 *   - 《遁甲演义》月家奇门："寅上起月，顺逆布之"
 */
/**
 * 月家奇门定局
 *
 * 以月干支定阴阳遁和局数：
 *   寅~未（正月~六月）为阳遁，申~丑（七月~腊月）为阴遁。
 *   阳遁顺起：寅=1局，卯=2局，…
 *   阴遁逆起：申=9局，酉=8局，…
 *   月家每月一局，无"上中下三元"概念。
 *
 * @param monthGanZhi 月干支（如 "甲寅"）
 * @param yearGanZhi  年干支（如 "甲辰"），部分流派可能需要，暂未使用
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当月支无法识别时
 */
export declare function getMonthQimenJuShu(monthGanZhi: string, yearGanZhi: string): {
    isYangDun: boolean;
    juShu: number;
    yuan: string;
};
/**
 * 年家奇门定局
 *
 * 古法：甲己之年起1局，乙庚之年起7局，丙辛之年起4局，
 *       丁壬之年起1局，戊癸之年起7局。
 * 同年干各年均起同局，不随旬变。
 *
 * 阴阳遁以三元甲子定（180 年大循环）：
 *   上元（第 1-60 年）= 阳遁
 *   中元（第 61-120 年）= 阴遁
 *   下元（第 121-180 年）= 阳遁
 *   基准：1864 甲子年属上元，1924 甲子年属中元，1984 甲子年属下元。
 *
 * @param yearGanZhi 年干支（如 "甲辰"）
 * @param solarYear  实际公历年，用于区分同一干支所在的 180 年三元周期
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当年干支无法识别时
 */
export declare function getYearQimenJuShu(yearGanZhi: string, solarYear?: number): {
    isYangDun: boolean;
    juShu: number;
    yuan: string;
};
