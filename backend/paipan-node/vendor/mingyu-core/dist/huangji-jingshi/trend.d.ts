/**
 * @file 皇极经世世运消息与气数演进断诀算法
 * @传统依据 邵雍《皇极经世》先天六十四卦圆图：阳进阴消（复至乾三十二卦为阳息）、阴进阳消（姤至坤三十二卦为阴消）；世卦与旬卦消长气数定性。
 */
import type { HuangjiStandardForecast } from './standard';
export interface HuangjiEraTrendResult {
    phase: '阳息进取' | '阴消蓄养' | '极盛防变' | '剥极将生';
    yangLineCount: number;
    yinLineCount: number;
    trendNature: string;
    summary: string;
}
/**
 * 依据先天圆图与值年/十年卦象分析世运消长大势
 */
export declare function evaluateHuangjiEraTrend(forecast: HuangjiStandardForecast): HuangjiEraTrendResult;
