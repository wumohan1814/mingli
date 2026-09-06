import type { BaziDitiansuiEntry } from './types';
/**
 * 《滴天髓》十干体象与性情全篇精解
 */
export declare const BAZI_DITIANSUI_TABLE: Record<string, BaziDitiansuiEntry>;
/**
 * 查询八字日主《滴天髓》十干体象
 */
export declare function getBaziDitiansuiAdvice(dayMaster: string): BaziDitiansuiEntry | undefined;
