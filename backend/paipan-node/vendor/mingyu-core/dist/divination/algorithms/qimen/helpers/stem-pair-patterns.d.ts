/**
 * @file 天盘干与地盘干组合格局表（81局）
 * @description 奇门遁甲81种天盘干+地盘干组合的传统格局判定，
 * 包含吉格、凶格和一般五行生克关系。
 *
 * 奇门中甲始终遁藏，故天盘与地盘各取九干：乙丙丁戊己庚辛壬癸，
 * 两两配对共 9 x 9 = 81 种组合。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「三奇六仪分吉凶，天盘地盘合参用」
 *   - 《奇门遁甲秘籍大全·十干吉凶章》：「十干相配各有格局，
 *     或名青龙返首，或名飞鸟跌穴，吉凶各有所主」
 *   - 《遁甲演义》：「三奇入雾、五凶格、天网地网，皆十干之变也」
 *   - 《太白阴经》：「天乙青龙、朱雀、白虎、玄武、螣蛇，各有本象」
 *
 * 判断思路：
 *   1. 优先匹配传统命名格局（如青龙返首、白虎猖狂等）；
 *   2. 无命名格局则按天盘地盘五行生克自动判定：
 *      - 天盘克地盘 → 冲（凶，-2）
 *      - 地盘克天盘 → 受阻（凶，-1）
 *      - 天盘生地盘 → 泄（凶，-1）
 *      - 地盘生天盘 → 生（吉，+1）
 *      - 五行相同 → 比和（平，0）
 */
export interface StemPairPattern {
    /** 传统格局名称 */
    name: string;
    /** 吉凶类型 */
    type: 'good' | 'bad' | 'neutral';
    /** 评分 -10 ~ +10（负数越凶、正数越吉） */
    score: number;
    /** 传统描述 */
    summary: string;
    /** 现代解读 */
    interpretation: string;
    /** 现实表现 */
    manifestation: string;
}
/**
 * 获取天盘干与地盘干的组合格局
 *
 * 在奇门遁甲中，天盘干随九星飞转至某宫，与该宫地盘干形成特定的生克关系。
 * 部分组合有传统的命名格局（如青龙返首、白虎猖狂等），
 * 其余按五行生克关系自动判定。
 *
 * @param heavenStem 天盘干（乙/丙/丁/戊/己/庚/辛/壬/癸）
 * @param earthStem  地盘干（乙/丙/丁/戊/己/庚/辛/壬/癸）
 * @returns 格局对象，若参数不合法则返回 null
 *
 * @example
 * ```ts
 * getStemPairPattern('戊', '丙');
 * // { name: '青龙返首', type: 'good', score: 8, ... }
 *
 * getStemPairPattern('乙', '辛');
 * // { name: '青龙逃走', type: 'bad', score: -8, ... }
 *
 * getStemPairPattern('壬', '癸');
 * // { name: '比和', type: 'neutral', score: 0, ... }
 * ```
 */
export declare function getStemPairPattern(heavenStem: string, earthStem: string): StemPairPattern;
/**
 * 获取天盘干与地盘干的传统命名格局。
 *
 * 与 getStemPairPattern 不同，本函数只返回古籍中有固定名称的格局；
 * 没有命名格局时返回 null，便于主排盘只接入有辨识度的经典格局。
 */
export declare function getNamedStemPairPattern(heavenStem: string, earthStem: string): StemPairPattern | null;
/**
 * 获取所有81种天盘干与地盘干组合的格局列表
 *
 * @returns 全部81种格局对象数组（按天盘干分组排列）
 *
 * @example
 * ```ts
 * const allPairs = listAllStemPairs();
 * console.log(allPairs.length); // 81
 * ```
 */
export declare function listAllStemPairs(): StemPairPattern[];
