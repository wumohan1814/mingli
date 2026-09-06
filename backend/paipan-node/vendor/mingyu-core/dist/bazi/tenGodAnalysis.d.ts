/**
 * @file 十神结构与流动关系分析
 * @description 分别统计四柱天干透出与地支藏干的十神分布，按五大家族聚合，
 *   并识别十神之间的生克流动链条；不以自定权重裁定十神强弱。
 * @古籍依据 《渊海子平》"论十神"、《子平真诠》"论用神成败"
 */
import type { TenGodStructureProfile, TenGodFlowProfile } from '../types/analysis';
export declare function analyzeTenGodStructure(pillars: Array<{
    gan: string;
    zhi: string;
    hiddenStems: string[];
}>, dayMaster: string, getTenGod: (g: string, d: string) => string): TenGodStructureProfile;
/**
 * 十神流动关系：识别十神家族之间构成的标准生克链条
 * - 比劫泄秀：比劫→食伤
 * - 食伤生财：食伤→财才
 * - 财生官杀：财才→官杀
 * - 印比相生：印绶→比劫
 */
export declare function analyzeTenGodFlow(structure: TenGodStructureProfile): TenGodFlowProfile;
