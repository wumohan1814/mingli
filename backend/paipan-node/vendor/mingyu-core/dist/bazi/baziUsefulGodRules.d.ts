export type UsefulGodWuxingBundle = 'resource_companion_output' | 'wealth_officer' | 'output_wealth_officer' | 'resource_companion';
export interface BaseUsefulGodRule {
    id: string;
    label: string;
    description: string;
    priority?: number;
    patterns?: string[];
    strengths?: string[];
    favorable: UsefulGodWuxingBundle;
    unfavorable: UsefulGodWuxingBundle;
    trace: string;
    primaryReason: string;
}
export declare const BASE_USEFUL_GOD_RULES: BaseUsefulGodRule[];
