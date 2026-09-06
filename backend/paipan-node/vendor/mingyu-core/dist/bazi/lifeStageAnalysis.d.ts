import type { TenGodLifeStageProfile } from '../types/analysis';
export declare function analyzeLifeStageProfile(pillars: Array<{
    gan: string;
    zhi: string;
}>): Array<{
    pillar: string;
    stage: string;
}>;
export declare function analyzeTenGodLifeStageProfile(pillars: Array<{
    gan: string;
    zhi: string;
    hiddenStems: string[];
}>, dayMaster: string, getTenGod: (g: string, d: string) => string): TenGodLifeStageProfile;
