import type { AstrolabeData } from '../types/divination';
export type AstrolabePeriodScopeMode = 'yearly' | 'monthly' | 'daily';
export type AstrolabePeriodEventKind = '行运相位' | '天象相位' | '停逆' | '换座' | '换宫' | '朔望' | '交食';
export interface AstrolabePeriodEvent {
    key: string;
    kind: AstrolabePeriodEventKind;
    julianDate: number;
    dateTime: string;
    promptText: string;
    movingPoint: string;
    targetPoint?: string;
    aspectName?: string;
    signName?: string;
    house?: number;
    stationDirection?: '逆行' | '顺行';
    lunationName?: '朔' | '望' | '上弦' | '下弦';
    eclipseName?: string;
}
export interface AstrolabePeriodTransitGroup {
    key: string;
    movingPoint: string;
    targetPoint: string;
    aspectName: string;
    events: AstrolabePeriodEvent[];
    promptText: string;
}
export interface AstrolabePeriodWindow {
    startDateTime: string;
    endDateTime: string;
    eventKeys: string[];
    promptText: string;
}
export interface AstrolabePeriodAxisItem {
    key: string;
    promptText: string;
}
export interface AstrolabePeriodEventCollection {
    startDateTime: string;
    endDateTime: string;
    timezoneLabel: string;
    events: AstrolabePeriodEvent[];
    groups: AstrolabePeriodTransitGroup[];
    windows: AstrolabePeriodWindow[];
    axis: AstrolabePeriodAxisItem[];
    promptText: string;
}
export declare function resolveAstrolabePeriodWindow(data: AstrolabeData, scope: AstrolabePeriodScopeMode, target: {
    year: number;
    month: number;
    day: number;
}): {
    start: import("../calendar").CivilTimeResolution;
    end: import("../calendar").CivilTimeResolution;
    startJd: number;
    endJd: number;
    timezoneLabel: string;
    startDateTime: string;
    endDateTime: string;
};
export declare function mergeAstrolabePeriodEvents(groups: AstrolabePeriodEvent[][]): AstrolabePeriodEvent[];
export declare function scoreAstrolabePeriodEvent(event: AstrolabePeriodEvent): number;
export declare function buildAstrolabePeriodEventLayers(events: AstrolabePeriodEvent[], startDateTime: string, endDateTime: string, scope: AstrolabePeriodScopeMode): {
    groups: AstrolabePeriodTransitGroup[];
    windows: AstrolabePeriodWindow[];
    axis: AstrolabePeriodAxisItem[];
    promptText: string;
};
export declare function mergeAstrolabePeriodCollections(collections: AstrolabePeriodEventCollection[], scope?: AstrolabePeriodScopeMode): AstrolabePeriodEventCollection | undefined;
export declare function buildAstrolabePeriodEvents(data: AstrolabeData, scope: AstrolabePeriodScopeMode, target: {
    year: number;
    month: number;
    day: number;
}): AstrolabePeriodEventCollection;
