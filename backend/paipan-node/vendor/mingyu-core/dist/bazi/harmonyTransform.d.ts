/**
 * @file 干支相合与天干成化条件
 * @description 依据《三命通会》可复核条件区分成化、合而不化、争合与破合，不使用百分制权重。
 */
import type { HarmonyTransformProfile } from '../types/analysis';
export interface HarmonyPillarInput {
    label?: string;
    gan: string;
    zhi: string;
    hiddenStems?: string[];
}
export declare function assessStemHarmonyTransform(stem1: string, pillar1: string, stem2: string, pillar2: string, monthBranch: string, allPillars: HarmonyPillarInput[]): HarmonyTransformProfile;
export declare function assessBranchHarmonyTransform(branch1: string, pillar1: string, branch2: string, pillar2: string, monthBranch: string, allPillars: HarmonyPillarInput[]): HarmonyTransformProfile;
export declare function assessAllHarmonyTransforms(pillars: HarmonyPillarInput[], monthBranch?: string): HarmonyTransformProfile[];
export declare function formatHarmonyTransformProfile(profile: HarmonyTransformProfile): string[];
