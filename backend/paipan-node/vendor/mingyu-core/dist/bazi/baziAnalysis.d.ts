import { Wuxing, BaziAnalysisResult, SeasonInfo } from './baziTypes';
import type { HiddenStems, Pillars } from './baziTypes';
export declare class BaziAnalyzer {
    private getWuxing;
    private getTenGod;
    private getSeasonStatus;
    private pipeline;
    constructor(getWuxing: (ganOrZhi: string) => Wuxing, getTenGod: (gan: string, dayMaster: string) => string, getSeasonStatus: (zhi: string) => Record<string, string>);
    analyzeBaziChart(pillars: Pillars, hiddenStems: HiddenStems, monthCommander?: string, seasonInfo?: Pick<SeasonInfo, 'currentJieqi'>): BaziAnalysisResult;
}
