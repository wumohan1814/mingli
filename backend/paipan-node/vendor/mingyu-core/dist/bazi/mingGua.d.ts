/**
 * @file 命卦（八宅）计算
 * @description 按传统八宅明镜法计算命卦，用于东四命/西四命判定。
 * @古籍依据 《八宅明镜》
 *
 * 法理：
 *   - 以立春为年界，立春前出生按上一年计算
 *   - 年数取九余数（年命数）
 *   - 男命：(11 - 余数) 归一到 1-9
 *   - 女命：(4 + 余数) 归一到 1-9
 *   - 逢五黄入中：男命寄坤二，女命寄艮八
 *   - 1坎 2坤 3震 4巽 6乾 7兑 8艮 9离（5为中央无卦）
 *   - 东四命：坎离震巽；西四命：乾坤艮兑
 */
import type { MingGuaProfile } from '../types/analysis';
/**
 * 计算命卦
 * @param birthYear 出生公历年份（已按立春换年处理）
 * @param gender 性别 'male' | 'female'
 * @returns 命卦信息
 */
export declare function calculateMingGua(birthYear: number, gender: string): MingGuaProfile;
