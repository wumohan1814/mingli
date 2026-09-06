import type { AstrolabeData, DivinationData, SupplementaryInfo, TaiyiResult } from '../types/divination';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import type { HuangjiJingshiResult } from '../huangji-jingshi';
export declare function formatAstrolabeInfo(data: AstrolabeData): string;
export declare function formatTaiyiTradition(data: TaiyiResult): string;
export declare function formatTaiyiInfo(data: TaiyiResult): string;
export declare function formatHuangjiInfo(data: HuangjiJingshiResult): string;
export declare function formatEnhancedDivinationInfo(method: Exclude<DivinationMethodId, 'random'>, data: DivinationData, _question?: string, _supplementaryInfo?: SupplementaryInfo, options?: {
    liuyaoTemplate?: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';
}): string;
