import type { AstrolabeData, AstrolabeSynastryAspectType, AstrolabeSynastryData } from '../types/divination';
import { evaluateAstrolabeSynastryReceptions, type AstrolabeSynastryReception } from './astrolabe-reception';
export { evaluateAstrolabeSynastryReceptions };
export type { AstrolabeSynastryReception };
export interface AstrolabeSynastryOptions {
    pointNames?: string[];
    aspectOrbs?: Partial<Record<AstrolabeSynastryAspectType, number>>;
    includeHouseOverlays?: boolean;
    maxAspects?: number;
}
export declare function analyzeAstrolabeSynastry(chart1: AstrolabeData, chart2: AstrolabeData, options?: AstrolabeSynastryOptions): AstrolabeSynastryData;
