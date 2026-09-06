/**
 * 用神体系扩充：病药法与通关法规则。
 */
import { type PatternAnalysis } from '../baziTypes';
interface DiseaseMedicineRule {
    id: string;
    label: string;
    description: string;
    diseasePatterns: string[];
    medicinePatterns: string[];
    priority: number;
}
interface TongguanRule {
    id: string;
    label: string;
    description: string;
    conflictWuxings: [string, string];
    tongguanWuxing: string;
    priority: number;
}
export declare function detectTongguanNeed(wuxingCounts: Record<string, number>, favorableWuxing: string[], unfavorableWuxing: string[]): {
    need: boolean;
    conflict?: [string, string];
    tongguan?: string;
    rule?: TongguanRule;
};
export declare function detectDiseaseMedicine(wuxingCounts: Record<string, number>, pattern: PatternAnalysis, _strengthStatus: string): {
    hasDisease: boolean;
    disease?: string;
    medicine?: string;
    rule?: DiseaseMedicineRule;
};
export declare function getDrainWuxing(wuxing: string): string;
export {};
