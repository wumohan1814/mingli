import type { IztroAstrolabe, IztroStar } from '../../../../types/iztro';
import type { MutagenName, ScopeMutagenItem, StarFact } from '../../../../types/analysis';
export declare const MUTAGEN_ORDER: MutagenName[];
export declare function mapScopeMutagenMap(stars: string[], astrolabe: IztroAstrolabe, dynamicPalaceNames?: string[]): ScopeMutagenItem[];
export declare function mapStarFact(star: IztroStar, activeScopeMutagenMap: ScopeMutagenItem[], options?: {
    isHoroscopeStar?: boolean;
}): StarFact;
