import { SolarTime } from 'tyme4ts';
import { Person, BaziChartResult, InternalBaziChartResult, LiunianInfo } from './baziTypes';
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
/**
 * 八字计算工具类
 * 整合了所有计算逻辑
 */
export declare class BaziCalculator {
    private timeMap;
    private shenShaCalculator;
    private analyzer;
    private luckCalculator;
    private wuxingCalculator;
    constructor();
    /**
     * 获取天干的十神
     * @param gan 天干
     * @param dayMaster 日主
     */
    getTenGod(gan: string, dayMaster: string): string;
    /**
     * 获取地支的十神 (基于藏干主气)
     * @param zhi 地支
     * @param dayMaster 日主
     */
    getTenGodForBranch(zhi: string, dayMaster: string): string;
    /**
     * 计算核心八字数据（同步）
     */
    calculateCoreBazi(person: Person): InternalBaziChartResult;
    /**
     * 统一计算八字所有数据
     */
    calculateBazi(person: Person): BaziChartResult;
    /**
     * 计算扩展八字数据（异步）
     */
    private calculateExtendedBazi;
    calculateLiuyue(year: number, month: number, dayMaster: string): import("./baziCalculatorTime").LiuyueInfo;
    calculateLiuri(year: number, month: number, day: number, dayMaster: string): import("./baziCalculatorTime").LiuriInfo;
    calculateLiuriRange(startDate: string, endDate: string, dayMaster: string): import("./baziCalculatorTime").LiuriInfo[];
    calculateSeasonInfo(solarTime: SolarTimeInstance): import("./baziTypes").SeasonInfo;
    /**
     * 计算并分类流年神煞
     */
    getCategorizedYearShenSha(yearData: Pick<LiunianInfo, 'ganZhi'> | null | undefined, baziResult: BaziChartResult): {
        lucky: string[];
        unlucky: string[];
        neutral: string[];
    };
    private getTimeInfoFromClock;
    private flattenLiunian;
}
export declare const baziCalculator: BaziCalculator;
export default baziCalculator;
