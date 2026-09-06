import { daysInSolarMonth as getDaysInMonth } from '../calendar/date-validation.js';
import { buildAstrolabeFromInput, buildHoroscope, shiftLunarYear } from './iztro/runtime-helpers.js';
function parseDateParts(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match)
        throw new Error(`日期格式无效：${dateStr}。`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month)) {
        throw new Error(`日期无效：${dateStr}。`);
    }
    return { year, month, day };
}
function assertDecadal(selected) {
    if (!Number.isInteger(selected.startAge) ||
        !Number.isInteger(selected.endAge) ||
        selected.startAge < 1 ||
        selected.endAge < selected.startAge) {
        throw new Error('紫微童限或大限年龄范围无效。');
    }
}
/** 从一个童限或大限直接生成流年、流月、流日选项及其干支。 */
export async function buildZiweiFortuneOptions(input, selectedDecadal, options = {}) {
    assertDecadal(selectedDecadal);
    const astrolabe = await buildAstrolabeFromInput(input);
    const birthSolarDate = options.birthSolarDate?.trim() || astrolabe.solarDate;
    parseDateParts(birthSolarDate);
    const hourIndex = options.hourIndex ?? input.birthTimeIndex;
    if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex > 12) {
        throw new Error('紫微运限时辰索引需在 0-12 之间。');
    }
    const yearOptions = [];
    for (let age = selectedDecadal.startAge; age <= selectedDecadal.endAge; age += 1) {
        const dateStr = shiftLunarYear(birthSolarDate, age - 1);
        const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);
        const year = parseDateParts(dateStr).year;
        yearOptions.push({
            year,
            age,
            dateStr,
            label: `${year}年`,
            ganZhi: `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`,
        });
    }
    const effectiveYearDateStr = yearOptions.find((item) => item.dateStr === options.selectedYearDateStr)?.dateStr ??
        yearOptions[0]?.dateStr ??
        '';
    const selectedYear = effectiveYearDateStr ? parseDateParts(effectiveYearDateStr).year : undefined;
    const monthOptions = selectedYear
        ? Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const dateStr = `${selectedYear}-${String(month).padStart(2, '0')}-15`;
            const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);
            return {
                month,
                dateStr,
                label: `${month}月`,
                ganZhi: `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}`,
            };
        })
        : [];
    const effectiveMonthDateStr = monthOptions.find((item) => item.dateStr === options.selectedMonthDateStr)?.dateStr ??
        monthOptions[0]?.dateStr ??
        '';
    const selectedMonth = effectiveMonthDateStr ? parseDateParts(effectiveMonthDateStr) : undefined;
    const dayOptions = selectedMonth
        ? Array.from({ length: getDaysInMonth(selectedMonth.year, selectedMonth.month) }, (_, index) => {
            const day = index + 1;
            const dateStr = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);
            return {
                day,
                dateStr,
                label: `${String(selectedMonth.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
                ganZhi: `${horoscope.daily.heavenlyStem}${horoscope.daily.earthlyBranch}`,
            };
        })
        : [];
    return {
        yearOptions,
        monthOptions,
        dayOptions,
        effectiveYearDateStr,
        effectiveMonthDateStr,
    };
}
