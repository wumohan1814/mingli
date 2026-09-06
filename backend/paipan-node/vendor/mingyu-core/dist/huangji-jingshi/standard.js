import { hexagramsData } from '../divination/hexagram-data.js';
import { EARTHLY_BRANCHES, SIXTY_CYCLE } from '../ganzhi/data.js';
export const HUANGJI_STANDARD_EPOCH = Object.freeze({
    model: '先天圆图值年卦通行排法',
    yuanStartYear: -67_017,
    annualAnchorYear: 1984,
    annualAnchorHexagram: '鼎',
    calendar: '公元纪年（无公元0年）',
});
export const HUANGJI_CIRCLE_HEXAGRAMS = Object.freeze([
    '复',
    '颐',
    '屯',
    '益',
    '震',
    '噬嗑',
    '随',
    '无妄',
    '明夷',
    '贲',
    '既济',
    '家人',
    '丰',
    '革',
    '同人',
    '临',
    '损',
    '节',
    '中孚',
    '归妹',
    '睽',
    '兑',
    '履',
    '泰',
    '大畜',
    '需',
    '小畜',
    '大壮',
    '大有',
    '夬',
    '姤',
    '大过',
    '鼎',
    '恒',
    '巽',
    '井',
    '蛊',
    '升',
    '讼',
    '困',
    '未济',
    '解',
    '涣',
    '蒙',
    '师',
    '遁',
    '咸',
    '旅',
    '小过',
    '渐',
    '蹇',
    '艮',
    '谦',
    '否',
    '萃',
    '晋',
    '豫',
    '观',
    '比',
    '剥',
]);
const PURE_HEXAGRAM_NAMES = {
    乾: '乾为天',
    兑: '兑为泽',
    离: '离为火',
    震: '震为雷',
    巽: '巽为风',
    坎: '坎为水',
    艮: '艮为山',
    坤: '坤为地',
};
const NEXT_AFTER_CARDINAL = {
    乾: '姤',
    坤: '复',
    离: '革',
    坎: '蒙',
};
const YEARS_PER_GOVERNING_HEXAGRAM = 2_160;
const YEARS_PER_YUN_HEXAGRAM = 360;
const YEARS_PER_SIXTY_YEAR_HEXAGRAM = 60;
const YEARS_PER_DECADE_HEXAGRAM = 10;
const YEARS_PER_YUAN = 129_600;
const YEARS_PER_HUI = 10_800;
export function civilYearToSerial(year) {
    if (!Number.isSafeInteger(year) || year === 0) {
        throw new Error('公元纪年必须是非零安全整数。');
    }
    return year > 0 ? year : year + 1;
}
export function serialYearToCivil(year) {
    if (!Number.isSafeInteger(year))
        throw new Error('内部年份超出安全整数范围。');
    return year > 0 ? year : year - 1;
}
export function formatHuangjiCivilYear(year) {
    return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`;
}
function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
}
function getHexagramByShortName(shortName) {
    const fullName = PURE_HEXAGRAM_NAMES[shortName];
    const found = hexagramsData.find((item) => fullName ? item.name === fullName : item.name.endsWith(shortName));
    if (!found)
        throw new Error(`缺少皇极经世卦象资料：${shortName}。`);
    return found;
}
function getHexagramByBinary(binarySymbol) {
    const found = hexagramsData.find((item) => item.binarySymbol === binarySymbol);
    if (!found)
        throw new Error(`缺少皇极经世卦画资料：${binarySymbol}。`);
    return found;
}
function shortHexagramName(hexagram) {
    const pure = Object.entries(PURE_HEXAGRAM_NAMES).find(([, name]) => name === hexagram.name);
    return pure?.[0] || hexagram.name.slice(2);
}
function summarizeHexagram(hexagram) {
    return {
        id: hexagram.id,
        name: hexagram.name,
        shortName: shortHexagramName(hexagram),
        symbol: hexagram.symbol,
        upper: hexagram.upper,
        lower: hexagram.lower,
        judgment: hexagram.description,
    };
}
function toBottomUpLines(binarySymbol) {
    return [
        binarySymbol[3],
        binarySymbol[4],
        binarySymbol[5],
        binarySymbol[0],
        binarySymbol[1],
        binarySymbol[2],
    ];
}
function fromBottomUpLines(lines) {
    return `${lines.slice(3, 6).join('')}${lines.slice(0, 3).join('')}`;
}
function changeLine(hexagram, line) {
    if (!Number.isInteger(line) || line < 1 || line > 6)
        throw new Error('变爻必须介于1至6。');
    const lines = toBottomUpLines(hexagram.binarySymbol);
    lines[line - 1] = lines[line - 1] === '1' ? '0' : '1';
    return getHexagramByBinary(fromBottomUpLines(lines));
}
function normalizeSixtyYearHexagram(hexagram) {
    const shortName = shortHexagramName(hexagram);
    const nextName = NEXT_AFTER_CARDINAL[shortName];
    return nextName ? getHexagramByShortName(nextName) : hexagram;
}
function buildPeriod(hexagram, startSerialYear, durationYears, derivedFrom, changedLine) {
    return {
        hexagram: summarizeHexagram(hexagram),
        startYear: serialYearToCivil(startSerialYear),
        endYear: serialYearToCivil(startSerialYear + durationYears - 1),
        durationYears,
        ...(derivedFrom ? { derivedFrom: shortHexagramName(derivedFrom) } : {}),
        ...(changedLine
            ? {
                changedLine,
                ...(derivedFrom?.yaoCi?.[changedLine - 1]
                    ? { changedLineText: derivedFrom.yaoCi[changedLine - 1] }
                    : {}),
            }
            : {}),
    };
}
function relatedHexagrams(hexagram) {
    const lines = toBottomUpLines(hexagram.binarySymbol);
    const mutualLines = [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]];
    const oppositeLines = lines.map((line) => (line === '1' ? '0' : '1'));
    const reversedLines = [...lines].reverse();
    return {
        mutual: summarizeHexagram(getHexagramByBinary(fromBottomUpLines(mutualLines))),
        opposite: summarizeHexagram(getHexagramByBinary(fromBottomUpLines(oppositeLines))),
        reversed: summarizeHexagram(getHexagramByBinary(fromBottomUpLines(reversedLines))),
    };
}
export function calculateStandardHuangjiForecast(year) {
    const yearSerial = civilYearToSerial(year);
    const epochSerial = civilYearToSerial(HUANGJI_STANDARD_EPOCH.yuanStartYear);
    const elapsedYears = yearSerial - epochSerial;
    if (elapsedYears < 0) {
        throw new Error(`year 不能早于${formatHuangjiCivilYear(HUANGJI_STANDARD_EPOCH.yuanStartYear)}。`);
    }
    const offsetInYuan = mod(elapsedYears, YEARS_PER_YUAN);
    const yuanStartSerial = yearSerial - offsetInYuan;
    const huiIndex = Math.floor(offsetInYuan / YEARS_PER_HUI) + 1;
    const huiStartSerial = yuanStartSerial + (huiIndex - 1) * YEARS_PER_HUI;
    const governingIndex = Math.floor(offsetInYuan / YEARS_PER_GOVERNING_HEXAGRAM);
    const governingHexagram = getHexagramByShortName(HUANGJI_CIRCLE_HEXAGRAMS[governingIndex]);
    const governingStartSerial = yuanStartSerial + governingIndex * YEARS_PER_GOVERNING_HEXAGRAM;
    const offsetInGoverning = yearSerial - governingStartSerial;
    const yunLine = Math.floor(offsetInGoverning / YEARS_PER_YUN_HEXAGRAM) + 1;
    const yunHexagram = changeLine(governingHexagram, yunLine);
    const yunStartSerial = governingStartSerial + (yunLine - 1) * YEARS_PER_YUN_HEXAGRAM;
    const offsetInYun = yearSerial - yunStartSerial;
    const sixtyYearLine = Math.floor(offsetInYun / YEARS_PER_SIXTY_YEAR_HEXAGRAM) + 1;
    const rawSixtyYearHexagram = changeLine(yunHexagram, sixtyYearLine);
    const sixtyYearHexagram = normalizeSixtyYearHexagram(rawSixtyYearHexagram);
    const sixtyYearStartSerial = yunStartSerial + (sixtyYearLine - 1) * YEARS_PER_SIXTY_YEAR_HEXAGRAM;
    const offsetInSixtyYears = yearSerial - sixtyYearStartSerial;
    const decadeLine = Math.floor(offsetInSixtyYears / YEARS_PER_DECADE_HEXAGRAM) + 1;
    const decadeHexagram = changeLine(sixtyYearHexagram, decadeLine);
    const decadeStartSerial = sixtyYearStartSerial + (decadeLine - 1) * YEARS_PER_DECADE_HEXAGRAM;
    const sixtyYearName = shortHexagramName(sixtyYearHexagram);
    const annualStartIndex = HUANGJI_CIRCLE_HEXAGRAMS.indexOf(sixtyYearName);
    if (annualStartIndex < 0)
        throw new Error(`值年卦序缺少六十年统卦：${sixtyYearName}。`);
    const annualName = HUANGJI_CIRCLE_HEXAGRAMS[(annualStartIndex + offsetInSixtyYears) % HUANGJI_CIRCLE_HEXAGRAMS.length];
    const annualHexagram = getHexagramByShortName(annualName);
    const ganzhiOffset = yearSerial - civilYearToSerial(HUANGJI_STANDARD_EPOCH.annualAnchorYear);
    const ganzhi = SIXTY_CYCLE[mod(ganzhiOffset, SIXTY_CYCLE.length)];
    const governing = buildPeriod(governingHexagram, governingStartSerial, YEARS_PER_GOVERNING_HEXAGRAM);
    const yun = buildPeriod(yunHexagram, yunStartSerial, YEARS_PER_YUN_HEXAGRAM, governingHexagram, yunLine);
    const sixtyYear = buildPeriod(sixtyYearHexagram, sixtyYearStartSerial, YEARS_PER_SIXTY_YEAR_HEXAGRAM, yunHexagram, sixtyYearLine);
    const decade = buildPeriod(decadeHexagram, decadeStartSerial, YEARS_PER_DECADE_HEXAGRAM, sixtyYearHexagram, decadeLine);
    const annual = { ...summarizeHexagram(annualHexagram), year, ganzhi };
    return {
        model: HUANGJI_STANDARD_EPOCH,
        hui: {
            indexInYuan: huiIndex,
            branch: EARTHLY_BRANCHES[huiIndex - 1],
            startYear: serialYearToCivil(huiStartSerial),
            endYear: serialYearToCivil(huiStartSerial + YEARS_PER_HUI - 1),
        },
        hexagrams: { governing, yun, sixtyYear, decade, annual },
        relatedHexagrams: relatedHexagrams(annualHexagram),
        reading: {
            headline: `${formatHuangjiCivilYear(year)}（${ganzhi}）值年卦为${annual.name}`,
            cycleContext: `${EARTHLY_BRANCHES[huiIndex - 1]}会，${governing.hexagram.shortName}统卦、${yun.hexagram.shortName}运卦、${sixtyYear.hexagram.shortName}六十年统卦、${decade.hexagram.shortName}十年卦`,
            annualFocus: `${annual.upper}上${annual.lower}下；卦辞：${annual.judgment}`,
            interpretationOrder: [
                `以${annual.shortName}值年卦为目标年的主要取象`,
                `以${decade.hexagram.shortName}十年卦和${sixtyYear.hexagram.shortName}六十年统卦说明当前阶段`,
                `以${yun.hexagram.shortName}运卦和${governing.hexagram.shortName}统卦说明长期背景`,
                `以互卦、错卦、综卦补充过程、对照与换位观察`,
            ],
        },
    };
}
