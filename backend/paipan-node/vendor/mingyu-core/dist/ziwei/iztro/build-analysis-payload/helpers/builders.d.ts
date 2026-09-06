import type { IztroAstrolabe, IztroHoroscope, IztroPalace, IztroSurpalaces } from '../../../../types/iztro';
import type { ActiveScopeInfo, BasicInfo, FourPillars, HiddenPalaces, MutagedPlaceItem, MutagenName, PalaceFact, ScopeType } from '../../../../types/analysis';
import { type HoroscopeScopeItem } from './scope';
declare function buildFourPillars(astrolabe: IztroAstrolabe): FourPillars | undefined;
declare function buildHiddenPalaces(astrolabe: IztroAstrolabe): HiddenPalaces | undefined;
declare function assertValidAstrolabePalaces(palaces: IztroPalace[] | undefined): asserts palaces is IztroPalace[];
export declare function buildBasicInfo(astrolabe: IztroAstrolabe): BasicInfo;
export declare function buildActiveScope(params: {
    astrolabe: IztroAstrolabe;
    horoscope: IztroHoroscope;
    currentScope: ScopeType;
    currentScopeItem?: HoroscopeScopeItem;
}): ActiveScopeInfo;
declare function buildScopeHits(horoscope: IztroHoroscope, palaceIndex: number): string[];
declare function buildMutagedPlaces(palace: IztroPalace): MutagedPlaceItem[];
declare function buildSelfMutagens(palace: IztroPalace): MutagenName[];
declare function buildSummaryTags(params: {
    palace: IztroPalace;
    horoscope: IztroHoroscope;
    currentScope: ScopeType;
    dynamicPalaceName?: string;
    scopeHits: string[];
    surrounded: IztroSurpalaces;
    selfMutagens: MutagenName[];
}): string[];
export declare function buildPalaceFacts(params: {
    astrolabe: IztroAstrolabe;
    horoscope: IztroHoroscope;
    currentScope: ScopeType;
    currentScopeItem?: HoroscopeScopeItem;
}): PalaceFact[];
export { buildFourPillars, buildHiddenPalaces, buildScopeHits, buildMutagedPlaces, buildSelfMutagens, buildSummaryTags, assertValidAstrolabePalaces, };
