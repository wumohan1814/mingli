import type { UsefulGodPlacementProfile } from '../types/analysis';
export declare function analyzeUsefulGodPlacement(pillars: Array<{
    gan: string;
    zhi: string;
}>, dayMaster: string, getTenGod: (g: string, d: string) => string, favorableWuxing: string[], unfavorableWuxing: string[]): UsefulGodPlacementProfile;
