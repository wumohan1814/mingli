/**
 * @file 透干通根分析
 * @description 检查每个透出天干在地支藏干中是否有根：
 *   - 本根：藏干与透干为同一干
 *   - 同气根：藏干与透干同五行但不同干
 *   - 无根：地支藏干中既无同干也无同五行
 * @古籍依据 《子平真诠》"论根基"、《渊海子平》"论通根"
 *
 * 结果只公开本根、同气根或无根的逐项事实，不生成通根分值。
 */
import type { StemRootProfile, ExposedStemProfile } from '../types/analysis';
export declare function analyzeStemRootProfile(pillars: Array<{
    gan: string;
    zhi: string;
}>, dayMaster: string, getWuxing: (s: string) => string, getTenGod: (g: string, d: string) => string): StemRootProfile;
/**
 * 透干综合画像：每个透出天干的月令地位、力量状态
 *
 * commandStatus:
 *   - 司令透出：透干与月令司令同干
 *   - 月令藏干透出：透干为月支藏干之一
 *   - 得月令同气：透干与月令同五行
 *   - 不得月令：以上都不是
 */
export declare function analyzeExposedStemProfile(pillars: Array<{
    gan: string;
    zhi: string;
}>, dayMaster: string, getWuxing: (s: string) => string, getTenGod: (g: string, d: string) => string, commanderStem?: string, monthBranch?: string): ExposedStemProfile;
