/**
 * @file 大运方向与小运（童限逐年）计算
 * @description
 *   - 大运顺逆：阳男阴女顺行，阴男阳女逆行（《渊海子平》起运法）
 *   - 小运（童限）：起运前的逐年干支，沿用 tyme4ts 的 ChildLimit.getStartFortune() 顺推
 *
 * @古籍依据 《渊海子平》"论行运"、《子平真诠》"论行运岁运"
 */
import { SolarTime } from 'tyme4ts';
import type { XiaoYunProfile, LuckDirectionProfile } from '../types/analysis';
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
/**
 * 计算大运顺逆方向
 *
 * 法理：阳男阴女顺行，阴男阳女逆行
 *
 * @param gender 'male' | 'female'
 * @param yearStem 年柱天干
 * @returns 大运方向
 */
export declare function buildLuckDirectionProfile(gender: string, yearStem: string): LuckDirectionProfile;
/**
 * 计算小运（童限逐年干支）
 *
 * 法理：以 tyme4ts 的 ChildLimit 取起运前的童限（getStartFortune），
 *   从起运岁向前逐年推算干支，直到第一步大运起运岁为止。
 *   逐年干支取 fortune.next(age - startAge)。
 *
 * @param solarTime 出生太阳时（已做真太阳时校正）
 * @param gender 性别
 * @param dayMasterGan 日主天干
 * @param getTenGod 十神取法
 * @returns 小运逐年列表
 */
export declare function calculateXiaoYunProfile(solarTime: SolarTimeInstance, gender: string, dayMasterGan: string, getTenGod: (gan: string, dayMaster: string) => string): XiaoYunProfile;
export {};
