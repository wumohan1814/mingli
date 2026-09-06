import type { AlmanacOfficerClassic } from './types';
/**
 * 清代《协纪辨方书》《玉匣记》建除十二神歌诀与吉凶宜忌
 */
export declare const ALMANAC_OFFICER_CLASSICS: Record<string, AlmanacOfficerClassic>;
export declare function getAlmanacOfficerClassic(officer: string): AlmanacOfficerClassic | undefined;
