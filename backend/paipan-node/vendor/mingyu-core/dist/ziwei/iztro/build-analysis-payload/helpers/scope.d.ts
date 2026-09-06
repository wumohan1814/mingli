import type { IztroHoroscope, IztroHoroscopeScope } from '../../../../types/iztro';
import type { ScopeType } from '../../../../types/analysis';
export type HoroscopeScopeItem = IztroHoroscopeScope;
export declare const VALID_SCOPE_TYPES: readonly ScopeType[];
export declare function assertScopeType(value: unknown): asserts value is ScopeType;
export declare function mapScopeLabel(scope: ScopeType): string;
export declare function resolveScopeLabel(currentScope: ScopeType, currentScopeItem?: HoroscopeScopeItem): string;
export declare function getCurrentScopeItem(horoscope: IztroHoroscope, currentScope: ScopeType): HoroscopeScopeItem | undefined;
