import type { PalaceFact } from '../../types/analysis';
import type { ChartInput } from '../../types/chart';
import type { IztroAstrolabe } from '../../types/iztro';
export type DecadalTimelineOption = {
    kind: 'childhood' | 'decadal';
    label: string;
    startAge: number;
    endAge: number;
    dateStr: string;
    endDateStr?: string;
    palaceIndex?: number;
    palaceName?: string;
    source: 'payload-compatibility' | 'iztro-horoscope';
};
export declare function getChildhoodAgeRange(palaces: PalaceFact[]): [number, number] | null;
export declare function buildDecadalTimelineOptions(palaces: PalaceFact[], birthSolarDate: string): DecadalTimelineOption[];
export declare function buildVerifiedDecadalTimelineOptions(astrolabe: IztroAstrolabe, input: ChartInput): Promise<DecadalTimelineOption[]>;
export declare function findCurrentDecadalOption(options: DecadalTimelineOption[], nominalAge: number): DecadalTimelineOption | null;
export declare function formatDecadalAgeRange(option: {
    startAge: number;
    endAge: number;
}): string;
