import type { BaziQiongtongEntry } from './types';
export declare const BAZI_QIONGTONG_TABLE: Record<string, BaziQiongtongEntry>;
export declare function getBaziQiongtongAdvice(dayMaster: string, monthBranch: string): BaziQiongtongEntry | undefined;
