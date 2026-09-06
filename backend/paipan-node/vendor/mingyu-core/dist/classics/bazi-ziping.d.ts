import type { BaziZipingPatternEntry } from './types';
/**
 * 《子平真诠》《渊海子平》八字正格与用神纯杂格局释义
 */
export declare const BAZI_ZIPING_PATTERNS: Record<string, BaziZipingPatternEntry>;
/**
 * 查询八字子平格局经典释义
 */
export declare function getBaziZipingPatternAdvice(pattern: string): BaziZipingPatternEntry | undefined;
