import type { BaziChartResult } from '../bazi/index.js';
import type { TermContextData } from './types.js';
/**
 * 分析特定术语在当前八字排盘中的具体角色与实际作用
 */
export declare function getBaziTermContext(term: string, result: BaziChartResult, options?: {
    pillarLabel?: string;
    ganZhi?: string;
    wuxing?: string;
}): TermContextData | undefined;
/**
 * 分析特定术语在当前六爻卦盘中的具体角色与实际作用
 */
export declare function getLiuyaoTermContext(term: string, data: {
    originalName: string;
    changedName?: string;
    palace?: {
        name: string;
    };
    worldPosition?: number;
    responsePosition?: number;
    changingPositions?: number[];
    voidBranches?: string[];
}, yaoInfo?: {
    position: number;
    sixGod?: string;
    sixRelative?: string;
    najia?: string;
    isWorld?: boolean;
    isResponse?: boolean;
    isChanging?: boolean;
}): TermContextData | undefined;
/**
 * 分析特定术语在当前紫微斗数命盘中的具体角色与实际作用
 */
export declare function getZiweiTermContext(term: string, options?: {
    palaceName?: string;
    starName?: string;
    mutagen?: string;
    brightness?: string;
}): TermContextData | undefined;
