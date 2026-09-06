import type { TombStorageProfile } from '../types/analysis';
export declare function analyzeTombStorage(pillars: Array<{
    gan: string;
    zhi: string;
}>, dayMaster: string, getWuxing: (s: string) => string, getTenGod: (g: string, d: string) => string): TombStorageProfile;
