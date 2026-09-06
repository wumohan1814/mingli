import { getBaziDayIndexByDate, getBaziMonthIndexByDate } from '../calendarTool.js';
import { getLuckCycleForDate } from '../luckTiming.js';
function assertValidDate(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new TypeError('当前运势定位需要有效日期。');
    }
}
/** 按精确交运时刻定位大运；数字年份参数仅为旧调用方式保留。 */
export function getCurrentBaziLuckCycle(result, reference = new Date()) {
    if (reference instanceof Date)
        return getLuckCycleForDate(result.luckInfo.cycles, reference);
    if (!Number.isInteger(reference))
        throw new TypeError('当前年份必须是整数。');
    return getLuckCycleForDate(result.luckInfo.cycles, new Date(reference, 6, 1, 12, 0, 0));
}
/** 生成可直接传给 buildFortuneSelectionContext 的当前流日选择。 */
export function buildCurrentBaziFortuneSelection(result, now = new Date()) {
    assertValidDate(now);
    const year = now.getFullYear();
    const currentCycle = getCurrentBaziLuckCycle(result, now);
    if (!currentCycle)
        return null;
    const cycleIndex = result.luckInfo.cycles.findIndex((item) => item === currentCycle);
    const month = getBaziMonthIndexByDate(year, now) ?? 1;
    const day = getBaziDayIndexByDate(year, month, now) ?? 1;
    return { scope: 'day', cycleIndex, year, month, day };
}
/** 生成当前节令月选择，适合“近期趋势”类入口。 */
export function buildRecentBaziFortuneSelection(result, now = new Date()) {
    const current = buildCurrentBaziFortuneSelection(result, now);
    if (!current)
        return null;
    return {
        scope: 'month',
        cycleIndex: current.cycleIndex,
        year: current.year,
        month: current.month,
    };
}
