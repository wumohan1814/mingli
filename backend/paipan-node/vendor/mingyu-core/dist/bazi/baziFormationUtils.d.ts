import type { Pillars, Wuxing } from './baziTypes';
export interface CompleteBranchFormation {
    type: '三合' | '三会';
    branches: string[];
    wuxing: Wuxing;
    includesMonthBranch: boolean;
}
export interface EstablishedBranchFormation extends CompleteBranchFormation {
    monthStatus: string;
    clashBreakBranches: string[];
}
export declare function getRepresentativeStemByWuxing(wuxing: Wuxing): string;
export declare function collectCompleteBranchFormations(pillars: Pillars): CompleteBranchFormation[];
/**
 * 三支齐全只证明会合结构存在；只有化神得月令且没有被局外地支冲破时，
 * 才把该结构作为旺衰、特殊格和用神判断中的成势力量。
 */
export declare function collectEstablishedBranchFormations(pillars: Pillars): EstablishedBranchFormation[];
