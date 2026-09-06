/**
 * @file 金口诀（大六壬金口诀）起课算法
 * @description 以地分、将神、贵神、人元四位一体完成起课，并输出旺衰、生克、空亡与结构化证据。
 * @流派 大六壬金口诀
 * @古籍依据 《六壬神课金口诀古本》入式歌解、贵神起例、五子元遁、阴阳次第五用与五动三动
 * @核心算法
 * 1. 地分：可直接指定方位地支；时间起课取占时地支；数字起课 1-12 映射子至亥，大于 12 按 12 归一；随机起课在十二支中可复现抽取。
 * 2. 将神：按已交中气定月将，月将加占时顺布天盘，取地分上所临天盘地支。
 * 3. 贵神：按本门昼夜贵人起例，将贵神直接顺逆排至地分，贵神五行取十二贵神本属。
 * 4. 遁干：按日干五子元遁分别求地分人元、贵神神干与月将将干。
 * 5. 发用：依四位阴阳取用，再列五动、三动的实际触发条件，不预断现实吉凶。
 */
import type { JinkoujueData, JinkoujueDivinationMethod, JinkoujueFourPosition } from '../../types/divination';
import type { RandomOptions } from '../../shared/random';
/**
 * 依据《六壬神课金口诀古本》卷二“四位比合歌”推导四位五行比合定性：
 * 二木为爻（事多牵连）、二火为灾（防口舌焦躁）、二土为滞（迟疑不通）、二金为刑（刑伤折损）、二水为盗（暗耗漂流）。
 */
export declare function evaluateJinkoujueBihePoems(positions: {
    renYuan: JinkoujueFourPosition;
    guiShen: JinkoujueFourPosition;
    jiangShen: JinkoujueFourPosition;
    diFen: JinkoujueFourPosition;
}): string;
/**
 * 生成金口诀完整课盘。
 */
export declare function generateJinkoujue(params?: {
    method?: JinkoujueDivinationMethod;
    branch?: string;
    number?: number;
    customDate?: Date;
} & RandomOptions): JinkoujueData;
export { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';
export type { JinkoujueEvidenceAnalysis, JinkoujuePositionFact, JinkoujueRelationFact, } from '../jinkoujue-evidence';
