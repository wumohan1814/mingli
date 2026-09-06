import type { BaziArray } from './types';
import type { ShenShaReferenceProfile } from '../variants';
export declare function analyzeGlobalShenSha(shenShaList: string[]): string[];
export declare function calculateGlobalShenSha(baziArray: BaziArray, referenceProfile?: ShenShaReferenceProfile): string[];
