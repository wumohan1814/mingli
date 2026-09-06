import { SolarTerm, SolarTime } from 'tyme4ts';
import { MONTH_COMMANDER } from './baziDefinitions.js';
import { assertBaziGender, assertEarthlyBranch, assertGanZhiName, assertHeavenlyStem, assertPillars, getTenGod, getTenGodForBranch, } from './baziUtils.js';
import { daysInSolarMonth } from '../calendar/date-validation.js';
import { calculateSolarTermEvidence } from '../calendar/solar-term-evidence.js';
function assertSolarDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error('年份需在 1900-2100 之间。');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('月份需在 1-12 之间。');
    }
    if (!Number.isInteger(day) || day < 1) {
        throw new Error('日期不能小于 1。');
    }
    const maxDay = daysInSolarMonth(year, month);
    if (day > maxDay) {
        throw new Error(`日期需在 1-${maxDay} 之间。`);
    }
}
function createUtcDate(year, month, day) {
    assertSolarDate(year, month, day);
    return new Date(Date.UTC(year, month - 1, day));
}
function formatLocalDateTime(time) {
    return `${time.getYear()}-${String(time.getMonth()).padStart(2, '0')}-${String(time.getDay()).padStart(2, '0')} ${String(time.getHour()).padStart(2, '0')}:${String(time.getMinute()).padStart(2, '0')}`;
}
function parseDateKey(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) {
        throw new Error('日期格式需为 YYYY-MM-DD。');
    }
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    assertSolarDate(year, month, day);
    return { year, month, day };
}
function getNextMonth(year, month) {
    if (month === 12) {
        return { year: year + 1, month: 1 };
    }
    return { year, month: month + 1 };
}
function collectSolarTermsInMonth(year, month) {
    const terms = [];
    for (const scanYear of [year - 1, year, year + 1]) {
        for (let i = 0; i < 24; i++) {
            const term = SolarTerm.fromIndex(scanYear, i);
            const solarTime = term.getJulianDay().getSolarTime();
            const solarDay = solarTime.getSolarDay();
            if (solarDay.getYear() === year && solarDay.getMonth() === month) {
                terms.push({
                    term,
                    solarTime,
                    date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`,
                });
            }
        }
    }
    return terms.sort((left, right) => left.solarTime.getJulianDay().getDay() - right.solarTime.getJulianDay().getDay());
}
export function calculateLiuyue(year, month, dayMaster) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error('年份需在 1900-2100 之间。');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('月份需在 1-12 之间。');
    }
    assertHeavenlyStem(dayMaster, '日主');
    const solarTermsInMonth = collectSolarTermsInMonth(year, month);
    const firstJie = solarTermsInMonth.find(({ term }) => term.isJie());
    const nextMonth = getNextMonth(year, month);
    const nextMonthTerms = collectSolarTermsInMonth(nextMonth.year, nextMonth.month);
    const nextJie = nextMonthTerms.find(({ term }) => term.isJie());
    const solarTime = firstJie?.solarTime ?? SolarTime.fromYmdHms(year, month, 15, 12, 0, 0);
    const monthColumn = solarTime.getLunarHour().getEightChar().getMonth();
    const gan = monthColumn.getHeavenStem().getName();
    const zhi = monthColumn.getEarthBranch().getName();
    const startDate = firstJie?.date ?? `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = nextJie
        ? nextJie.date
        : `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;
    return {
        month,
        gan,
        zhi,
        ganZhi: `${gan}${zhi}`,
        tenGod: getTenGod(gan, dayMaster),
        tenGodZhi: getTenGodForBranch(zhi, dayMaster),
        startDate,
        endDate,
        startDateTime: firstJie ? formatLocalDateTime(firstJie.solarTime) : undefined,
        endDateTime: nextJie ? formatLocalDateTime(nextJie.solarTime) : undefined,
        startTermName: firstJie?.term.getName(),
        endTermName: nextJie?.term.getName(),
        jieqi: solarTermsInMonth.map(({ term, date }) => ({
            name: term.getName(),
            date,
        })),
    };
}
export function calculateLiuri(year, month, day, dayMaster) {
    assertSolarDate(year, month, day);
    assertHeavenlyStem(dayMaster, '日主');
    const solarTime = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
    const dayPillar = solarTime.getLunarHour().getEightChar().getDay();
    const gan = dayPillar.getHeavenStem().getName();
    const zhi = dayPillar.getEarthBranch().getName();
    return {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year,
        month,
        day,
        gan,
        zhi,
        ganZhi: `${gan}${zhi}`,
        tenGod: getTenGod(gan, dayMaster),
        tenGodZhi: getTenGodForBranch(zhi, dayMaster),
    };
}
export function calculateLiuriRange(startDate, endDate, dayMaster) {
    assertHeavenlyStem(dayMaster, '日主');
    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    const currentDate = createUtcDate(start.year, start.month, start.day);
    const endDateUtc = createUtcDate(end.year, end.month, end.day);
    const result = [];
    if (currentDate.getTime() > endDateUtc.getTime()) {
        throw new Error('开始日期不能晚于结束日期。');
    }
    while (currentDate.getTime() <= endDateUtc.getTime()) {
        result.push(calculateLiuri(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, currentDate.getUTCDate(), dayMaster));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return result;
}
export function getMonthCommander(solarTime, monthBranch) {
    assertEarthlyBranch(monthBranch, '月支');
    const commanders = MONTH_COMMANDER[monthBranch];
    const birthYear = solarTime.getSolarDay().getYear();
    const birthTime = solarTime.getJulianDay();
    let jieBefore = null;
    const terms = [];
    for (let i = 0; i < 24; i++) {
        terms.push(SolarTerm.fromIndex(birthYear, i));
        terms.push(SolarTerm.fromIndex(birthYear - 1, i));
    }
    for (const term of terms) {
        if (term.isJie() && term.getJulianDay().getDay() <= birthTime.getDay()) {
            if (!jieBefore || term.getJulianDay().getDay() > jieBefore.getJulianDay().getDay()) {
                jieBefore = term;
            }
        }
    }
    if (!jieBefore) {
        return '未知(节气未找到)';
    }
    const daysSinceJie = birthTime.getDay() - jieBefore.getJulianDay().getDay();
    let accumulatedDays = 0;
    for (const commander of commanders) {
        accumulatedDays += commander[1];
        if (daysSinceJie < accumulatedDays) {
            return commander[0];
        }
    }
    return commanders[commanders.length - 1][0];
}
export function calculateSeasonInfo(solarTime) {
    const solarTerms = [];
    const scanTerms = [];
    const currentYear = solarTime.getSolarDay().getYear();
    const birthJulianDay = solarTime.getJulianDay();
    for (let i = 0; i < 24; i++) {
        const term = SolarTerm.fromIndex(currentYear, i);
        const julianDay = term.getJulianDay();
        const solarDay = julianDay.getSolarDay();
        solarTerms.push({
            name: term.getName(),
            date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`,
            jd: julianDay.getDay(),
            index: i,
            isJie: term.isJie(),
        });
    }
    for (const scanYear of [currentYear - 1, currentYear, currentYear + 1]) {
        for (let i = 0; i < 24; i++) {
            const term = SolarTerm.fromIndex(scanYear, i);
            const julianDay = term.getJulianDay();
            const solarDay = julianDay.getSolarDay();
            scanTerms.push({
                name: term.getName(),
                date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`,
                jd: julianDay.getDay(),
                index: i,
                isJie: term.isJie(),
            });
        }
    }
    const orderedTerms = Array.from(new Map(scanTerms
        .sort((left, right) => left.jd - right.jd)
        .map((term) => [`${term.name}-${term.date}`, term])).values());
    let prevTerm = null;
    let nextTerm = null;
    for (const term of orderedTerms) {
        if (term.jd <= birthJulianDay.getDay()) {
            prevTerm = term;
        }
        else {
            nextTerm = term;
            break;
        }
    }
    const daysSincePrev = prevTerm ? Math.floor(birthJulianDay.getDay() - prevTerm.jd) : 0;
    const daysToNext = nextTerm ? Math.floor(nextTerm.jd - birthJulianDay.getDay()) : 0;
    // tyme4ts SolarTerm 索引：0=冬至,3=立春,6=春分,9=立夏,12=夏至,15=立秋,18=秋分,21=立冬。
    // 传统以「四立」分季：立春(3)起春、立夏(9)起夏、立秋(15)起秋、立冬(21)起冬。
    const seasonIndexMap = {
        3: '春',
        4: '春',
        5: '春',
        6: '春',
        7: '春',
        8: '春',
        9: '夏',
        10: '夏',
        11: '夏',
        12: '夏',
        13: '夏',
        14: '夏',
        15: '秋',
        16: '秋',
        17: '秋',
        18: '秋',
        19: '秋',
        20: '秋',
        21: '冬',
        22: '冬',
        23: '冬',
        0: '冬',
        1: '冬',
        2: '冬',
    };
    return {
        currentJieqi: prevTerm ? prevTerm.name : '未知',
        nextJieqi: nextTerm ? nextTerm.name : '未知',
        daysSincePrev,
        daysToNext,
        currentSeason: prevTerm ? seasonIndexMap[prevTerm.index] : '未知',
        jieqiList: solarTerms.map((term) => ({ name: term.name, date: term.date })),
        previousTermEvidence: prevTerm
            ? calculateSolarTermEvidence(prevTerm.index === 0
                ? Number(prevTerm.date.slice(0, 4)) + 1
                : Number(prevTerm.date.slice(0, 4)), prevTerm.index)
            : undefined,
        nextTermEvidence: nextTerm
            ? calculateSolarTermEvidence(nextTerm.index === 0
                ? Number(nextTerm.date.slice(0, 4)) + 1
                : Number(nextTerm.date.slice(0, 4)), nextTerm.index)
            : undefined,
    };
}
export function calculateSeasonInfoFromDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error('时间不是有效日期。');
    }
    return calculateSeasonInfo(SolarTime.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
}
export function getCategorizedYearShenSha(yearData, baziResult, calculateAllShenSha, getShenShaType) {
    if (!yearData?.ganZhi || !baziResult?.pillars) {
        return { lucky: [], unlucky: [], neutral: [] };
    }
    assertGanZhiName(yearData.ganZhi, '流年干支');
    assertPillars(baziResult.pillars);
    assertBaziGender(baziResult.gender);
    const baziArray = [
        [yearData.ganZhi[0], yearData.ganZhi[1]],
        [baziResult.pillars.month.gan, baziResult.pillars.month.zhi],
        [baziResult.pillars.day.gan, baziResult.pillars.day.zhi],
        [baziResult.pillars.hour.gan, baziResult.pillars.hour.zhi],
    ];
    const shenShaResult = calculateAllShenSha(baziArray, baziResult.gender);
    const yearShenSha = [...(shenShaResult.global || []), ...(shenShaResult.year || [])];
    return {
        lucky: yearShenSha.filter((shensha) => getShenShaType(shensha) === '吉'),
        unlucky: yearShenSha.filter((shensha) => getShenShaType(shensha) === '凶'),
        neutral: yearShenSha.filter((shensha) => getShenShaType(shensha) === '中性'),
    };
}
