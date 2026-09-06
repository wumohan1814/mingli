import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import type { EvidenceFact, PalaceFact, ScopeType, ZiweiEvidenceAnalysis } from '../../types/analysis';
export declare function buildEvidenceAnalysis(params: {
    evidencePool: EvidenceFact[];
    currentScope: ScopeType;
    palaces: PalaceFact[];
    skipped?: boolean;
}): ZiweiEvidenceAnalysis;
export declare function buildEvidencePool(params: {
    astrolabe: IFunctionalAstrolabe;
    horoscope: IFunctionalHoroscope;
    currentScope: ScopeType;
    palaces: PalaceFact[];
}): EvidenceFact[];
