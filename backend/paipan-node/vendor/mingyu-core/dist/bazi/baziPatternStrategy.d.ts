import type { PatternAnalysis, Pillars } from './baziTypes';
type GetTenGodFn = (gan: string, dayMaster: string) => string;
export declare function determinePattern(pillars: Pillars, strengthStatus: string, getTenGod: GetTenGodFn, monthCommander?: string): PatternAnalysis;
export {};
