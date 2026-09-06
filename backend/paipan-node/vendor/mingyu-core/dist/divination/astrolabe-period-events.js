/**
 * 星盘周期内动态点关键星象：精准行运相位、天象互相位、停逆、换座、换宫、朔望与交食。
 */
import { findLunarEclipses, findSolarEclipses, getApparentPosition, julianDateToUnix, unixToJulianDate, } from '../astrology/engine.js';
import { daysInGregorianMonth } from '../calendar/date-validation.js';
import { resolveCivilTime } from '../calendar/civil-time.js';
const BODY_LABELS = {
    Sun: '太阳',
    Moon: '月亮',
    Mercury: '水星',
    Venus: '金星',
    Mars: '火星',
    Jupiter: '木星',
    Saturn: '土星',
    Uranus: '天王星',
    Neptune: '海王星',
    Pluto: '冥王星',
    'North Node': '北交点',
    'South Node': '南交点',
    Ascendant: '上升',
    Midheaven: '天顶',
};
const BODY_IDS = {
    Sun: 'sun',
    Moon: 'moon',
    Mercury: 'mercury',
    Venus: 'venus',
    Mars: 'mars',
    Jupiter: 'jupiter',
    Saturn: 'saturn',
    Uranus: 'uranus',
    Neptune: 'neptune',
    Pluto: 'pluto',
    'North Node': 'true_node',
};
const SIGN_LABELS = [
    '白羊座',
    '金牛座',
    '双子座',
    '巨蟹座',
    '狮子座',
    '处女座',
    '天秤座',
    '天蝎座',
    '射手座',
    '摩羯座',
    '水瓶座',
    '双鱼座',
];
const MAJOR_ASPECTS = [
    { name: '合相', angle: 0, symbol: '合' },
    { name: '六合', angle: 60, symbol: '六合' },
    { name: '刑相', angle: 90, symbol: '刑' },
    { name: '拱相', angle: 120, symbol: '拱' },
    { name: '冲相', angle: 180, symbol: '冲' },
];
const LUNATION_ASPECTS = [
    { name: '合相', angle: 0, symbol: '合' },
    { name: '刑相', angle: 90, symbol: '刑' },
    { name: '冲相', angle: 180, symbol: '冲' },
];
const LUNATION_ORB = 3;
const MINUTE_IN_DAYS = 1 / 1440;
const YEARLY_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node'];
const MONTHLY_EXTRA_BODIES = ['Mars', 'Venus', 'Mercury', 'Sun'];
const DAILY_EXTRA_BODIES = ['Moon'];
const NATAL_POINT_NAMES = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
    'North Node',
    'South Node',
    'Ascendant',
    'Midheaven',
];
const LUNATION_NATAL_NAMES = new Set([
    'Sun',
    'Moon',
    'Ascendant',
    'Midheaven',
    'North Node',
    'South Node',
]);
function pad(value) {
    return String(value).padStart(2, '0');
}
function normalizeLongitude(value) {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}
function wrap180(value) {
    const normalized = normalizeLongitude(value);
    return normalized > 180 ? normalized - 360 : normalized;
}
function labelOf(name) {
    return BODY_LABELS[name] ?? name;
}
function aspectTargets(angle) {
    if (angle === 0 || angle === 180)
        return [angle];
    return [angle, 360 - angle];
}
function bodyIdOf(name) {
    return BODY_IDS[name];
}
function longitudeOf(name, jd) {
    return normalizeLongitude(getApparentPosition(bodyIdOf(name), jd).longitude);
}
function positionOf(name, jd) {
    const position = getApparentPosition(bodyIdOf(name), jd);
    return { longitude: normalizeLongitude(position.longitude), speed: position.speed };
}
function movingBodiesForScope(scope) {
    if (scope === 'yearly')
        return [...YEARLY_BODIES];
    if (scope === 'monthly')
        return [...YEARLY_BODIES, ...MONTHLY_EXTRA_BODIES];
    return [...YEARLY_BODIES, ...MONTHLY_EXTRA_BODIES, ...DAILY_EXTRA_BODIES];
}
function sampleStepDays(scope) {
    if (scope === 'daily')
        return 1 / 24;
    if (scope === 'monthly')
        return 0.25;
    return 1;
}
function houseForLongitude(cusps, longitude) {
    for (let index = 0; index < cusps.length; index += 1) {
        const current = cusps[index];
        const next = cusps[(index + 1) % cusps.length];
        const span = normalizeLongitude(next - current) || 360;
        if (normalizeLongitude(longitude - current) < span)
            return index + 1;
    }
    return 0;
}
function getTimeZoneInput(data) {
    if (data.birth.timeZoneId)
        return { timeZoneId: data.birth.timeZoneId };
    if (!Number.isFinite(data.birth.timezone)) {
        throw new Error('星盘缺少有效时区，无法计算周期星象。');
    }
    return { timezone: data.birth.timezone };
}
function addCalendarMonths(year, month, count) {
    const index = year * 12 + (month - 1) + count;
    return { year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 };
}
function nextDate(year, month, day) {
    const lastDay = daysInGregorianMonth(year, month);
    if (day < lastDay)
        return { year, month, day: day + 1 };
    if (month < 12)
        return { year, month: month + 1, day: 1 };
    return { year: year + 1, month: 1, day: 1 };
}
function resolveLocalInstant(data, date, hour = 0, minute = 0, second = 0) {
    return resolveCivilTime({
        ...date,
        hour,
        minute,
        second,
        ...getTimeZoneInput(data),
    });
}
function formatCivilStamp(value) {
    return `${value.year}-${pad(value.month)}-${pad(value.day)} ${pad(value.hour)}:${pad(value.minute)}`;
}
function formatEventDateTime(jd, timeZoneId, timezone) {
    const utc = new Date(julianDateToUnix(jd));
    if (timeZoneId) {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timeZoneId,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(utc);
        const read = (type) => parts.find((item) => item.type === type)?.value ?? '00';
        return `${read('year')}-${read('month')}-${read('day')} ${read('hour')}:${read('minute')}`;
    }
    const local = new Date(utc.getTime() + timezone * 3_600_000);
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
export function resolveAstrolabePeriodWindow(data, scope, target) {
    const startDate = scope === 'yearly'
        ? { year: target.year, month: 1, day: 1 }
        : scope === 'monthly'
            ? { year: target.year, month: target.month, day: 1 }
            : { year: target.year, month: target.month, day: target.day };
    const endDate = scope === 'yearly'
        ? { year: target.year + 1, month: 1, day: 1 }
        : scope === 'monthly'
            ? addCalendarMonths(target.year, target.month, 1)
            : nextDate(target.year, target.month, target.day);
    const start = resolveLocalInstant(data, startDate);
    const end = resolveLocalInstant(data, endDate);
    const timezoneLabel = data.birth.timeZoneId
        ? `${data.birth.timeZoneId}（UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}）`
        : `UTC${start.timezone >= 0 ? '+' : ''}${start.timezone}`;
    return {
        start,
        end,
        startJd: unixToJulianDate(start.utcTimestamp),
        endJd: unixToJulianDate(end.utcTimestamp),
        timezoneLabel,
        startDateTime: formatCivilStamp(start.localTime),
        endDateTime: formatCivilStamp(end.localTime),
    };
}
function bisectZero(fn, left, right, leftValue) {
    let low = left;
    let high = right;
    let lowValue = leftValue;
    for (let index = 0; index < 40 && high - low > MINUTE_IN_DAYS; index += 1) {
        const middle = (low + high) / 2;
        const middleValue = fn(middle);
        if (lowValue * middleValue <= 0) {
            high = middle;
        }
        else {
            low = middle;
            lowValue = middleValue;
        }
    }
    return (low + high) / 2;
}
function crossingsFromSamples(samples, residualAt, exactAt) {
    const hits = [];
    for (let index = 1; index < samples.length; index += 1) {
        const previous = residualAt(samples[index - 1], index - 1);
        const current = residualAt(samples[index], index);
        if (previous === 0) {
            hits.push(samples[index - 1].jd);
            continue;
        }
        if (previous * current <= 0 && Math.abs(current - previous) < 180) {
            hits.push(bisectZero(exactAt, samples[index - 1].jd, samples[index].jd, previous));
        }
    }
    return hits;
}
function sampleBody(name, startJd, endJd, step) {
    const samples = [];
    const last = endJd + step * 0.5;
    for (let jd = startJd; jd <= last; jd += step) {
        const clamped = Math.min(jd, endJd);
        const position = positionOf(name, clamped);
        samples.push({ jd: clamped, longitude: position.longitude, speed: position.speed });
        if (clamped === endJd)
            break;
    }
    if (samples.length === 0 || samples[samples.length - 1].jd < endJd) {
        const position = positionOf(name, endJd);
        samples.push({ jd: endJd, longitude: position.longitude, speed: position.speed });
    }
    return samples;
}
function isFiniteLongitude(point) {
    return typeof point.longitude === 'number' && Number.isFinite(point.longitude);
}
function natalPointsOf(data) {
    const byName = new Map();
    for (const point of [...data.planets, ...data.angles]) {
        if (!NATAL_POINT_NAMES.includes(point.name))
            continue;
        if (!isFiniteLongitude(point))
            continue;
        byName.set(point.name, normalizeLongitude(point.longitude));
    }
    return [...byName.entries()].map(([name, longitude]) => ({ name, longitude }));
}
function natalCuspsOf(data) {
    const cusps = data.houses
        .slice()
        .sort((first, second) => first.house - second.house)
        .map((item) => item.longitude);
    return cusps.length === 12 && cusps.every((item) => Number.isFinite(item))
        ? cusps.map(normalizeLongitude)
        : null;
}
function eventKey(kind, movingPoint, jd, extra = '') {
    return `${kind}:${movingPoint}:${extra}:${Math.round(jd * 1440)}`;
}
function solarEclipseName(type) {
    if (type === 'total')
        return '日全食';
    if (type === 'annular')
        return '日环食';
    if (type === 'hybrid')
        return '日全环食';
    return '日偏食';
}
function lunarEclipseName(type) {
    if (type === 'total')
        return '月全食';
    if (type === 'partial')
        return '月偏食';
    return '月半影食';
}
function lunationHitsNatal(lunationLongitude, natalPoints) {
    return natalPoints
        .filter((point) => LUNATION_NATAL_NAMES.has(point.name))
        .flatMap((point) => LUNATION_ASPECTS.map((aspect) => ({
        point,
        aspect,
        deviation: Math.abs(wrap180(lunationLongitude - point.longitude - aspect.angle)),
    })))
        .filter((item) => item.deviation <= LUNATION_ORB)
        .sort((first, second) => first.deviation - second.deviation)
        .slice(0, 2)
        .map((item) => `${item.aspect.symbol}本命${labelOf(item.point.name)}`);
}
function inWindow(jd, startJd, endJd) {
    return jd >= startJd && jd < endJd;
}
export function mergeAstrolabePeriodEvents(groups) {
    const seen = new Set();
    return groups
        .flat()
        .filter((event) => {
        if (seen.has(event.key))
            return false;
        seen.add(event.key);
        return true;
    })
        .sort((first, second) => first.julianDate - second.julianDate || first.key.localeCompare(second.key));
}
const CORE_POINT_LABELS = new Set([
    '太阳',
    '月亮',
    '上升',
    '天顶',
    '本命太阳',
    '本命月亮',
    '本命上升',
    '本命天顶',
]);
const SLOW_POINT_LABELS = new Set(['木星', '土星', '天王星', '海王星', '冥王星', '北交点']);
const HARD_ASPECTS = new Set(['合相', '刑相', '冲相']);
function isCorePoint(value) {
    if (!value)
        return false;
    return (CORE_POINT_LABELS.has(value) || [...CORE_POINT_LABELS].some((item) => value.includes(item)));
}
function isSlowPoint(value) {
    return Boolean(value && SLOW_POINT_LABELS.has(value));
}
export function scoreAstrolabePeriodEvent(event) {
    let score = 10;
    if (event.kind === '交食')
        score += 100;
    if (event.kind === '停逆' && isSlowPoint(event.movingPoint))
        score += 80;
    if (event.kind === '行运相位') {
        score += isSlowPoint(event.movingPoint) ? 55 : 25;
        if (isCorePoint(event.targetPoint))
            score += 25;
        if (event.aspectName && HARD_ASPECTS.has(event.aspectName))
            score += 12;
    }
    if (event.kind === '换座' && isSlowPoint(event.movingPoint))
        score += 45;
    if (event.kind === '换宫' &&
        isSlowPoint(event.movingPoint) &&
        (event.house === 1 || event.house === 10)) {
        score += 35;
    }
    if (event.kind === '朔望')
        score += event.promptText.includes('本命') ? 50 : 15;
    if (event.kind === '天象相位' &&
        isSlowPoint(event.movingPoint) &&
        isSlowPoint(event.targetPoint)) {
        score += 40;
    }
    return score;
}
function transitGroupKey(event) {
    if (event.kind !== '行运相位' || !event.targetPoint || !event.aspectName)
        return null;
    return `${event.movingPoint}|${event.aspectName}|${event.targetPoint}`;
}
function formatDateRange(startDateTime, endDateTime) {
    const startDay = startDateTime.slice(0, 10);
    const endDay = endDateTime.slice(0, 10);
    return startDay === endDay ? startDay : `${startDateTime}至${endDateTime}`;
}
function buildTransitGroups(events) {
    const grouped = new Map();
    for (const event of events) {
        const key = transitGroupKey(event);
        if (!key)
            continue;
        const list = grouped.get(key) ?? [];
        list.push(event);
        grouped.set(key, list);
    }
    return [...grouped.entries()]
        .map(([key, list]) => {
        const sorted = [...list].sort((first, second) => first.julianDate - second.julianDate);
        const sample = sorted[0];
        const times = sorted.map((item) => item.dateTime).join('、');
        const countLabel = sorted.length >= 3 ? `${sorted.length}次过境` : `${sorted.length}次触发`;
        return {
            key,
            movingPoint: sample.movingPoint,
            targetPoint: sample.targetPoint ?? '',
            aspectName: sample.aspectName ?? '',
            events: sorted,
            promptText: `${sample.movingPoint}${sample.aspectName === '合相' ? '合' : sample.aspectName === '刑相' ? '刑' : sample.aspectName === '冲相' ? '冲' : sample.aspectName === '拱相' ? '拱' : sample.aspectName === '六合' ? '六合' : ''}${sample.targetPoint} ${countLabel}（${times}）`,
        };
    })
        .filter((item) => item.events.length >= 2)
        .sort((first, second) => second.events.length - first.events.length || first.key.localeCompare(second.key));
}
function windowGapDays(scope) {
    if (scope === 'daily')
        return 0.25;
    if (scope === 'monthly')
        return 3;
    return 14;
}
function buildKeyWindows(events, scope) {
    if (events.length === 0)
        return [];
    const gap = windowGapDays(scope);
    const clusters = [];
    let current = [events[0]];
    for (let index = 1; index < events.length; index += 1) {
        const event = events[index];
        const previous = current[current.length - 1];
        if (event.julianDate - previous.julianDate <= gap) {
            current.push(event);
        }
        else {
            clusters.push(current);
            current = [event];
        }
    }
    clusters.push(current);
    return clusters
        .filter((cluster) => {
        const scores = cluster.map(scoreAstrolabePeriodEvent);
        return (scores.some((score) => score >= 70) ||
            (cluster.length >= 3 && scores.some((score) => score >= 50)));
    })
        .map((cluster) => {
        const highlights = [...cluster]
            .sort((first, second) => scoreAstrolabePeriodEvent(second) - scoreAstrolabePeriodEvent(first))
            .slice(0, 3)
            .map((item) => item.promptText);
        const startDateTime = cluster[0].dateTime;
        const endDateTime = cluster[cluster.length - 1].dateTime;
        return {
            startDateTime,
            endDateTime,
            eventKeys: cluster.map((item) => item.key),
            promptText: `${formatDateRange(startDateTime, endDateTime)} ${highlights.join('，')}`,
        };
    });
}
function buildAxis(events, groups) {
    const groupedKeys = new Set(groups.flatMap((item) => item.events.map((event) => event.key)));
    const groupItems = groups.map((group) => ({
        key: group.key,
        promptText: group.promptText,
        score: Math.max(...group.events.map(scoreAstrolabePeriodEvent)) + group.events.length * 8,
    }));
    const singles = events
        .filter((event) => !groupedKeys.has(event.key) && scoreAstrolabePeriodEvent(event) >= 70)
        .map((event) => ({
        key: event.key,
        promptText: `${event.dateTime} ${event.promptText}`,
        score: scoreAstrolabePeriodEvent(event),
    }));
    return [...groupItems, ...singles]
        .sort((first, second) => second.score - first.score || first.key.localeCompare(second.key))
        .slice(0, 8)
        .map(({ key, promptText }) => ({ key, promptText }));
}
export function buildAstrolabePeriodEventLayers(events, startDateTime, endDateTime, scope) {
    const groups = buildTransitGroups(events);
    const windows = buildKeyWindows(events, scope);
    const axis = buildAxis(events, groups);
    const lines = [
        events.length
            ? `周期关键星象（${startDateTime}至${endDateTime}，共${events.length}项）。`
            : `周期关键星象（${startDateTime}至${endDateTime}）：所选周期内未见当前筛选范围内的精准相位、停逆、换座、换宫、朔望或交食。`,
    ];
    if (axis.length)
        lines.push(`周期主轴：${axis.map((item) => item.promptText).join('；')}。`);
    if (windows.length)
        lines.push(`关键窗口：${windows.map((item) => item.promptText).join('；')}。`);
    if (groups.length)
        lines.push(`过境归组：${groups.map((item) => item.promptText).join('；')}。`);
    if (events.length) {
        lines.push(`完整明细：${events.map((item) => `${item.dateTime} ${item.promptText}`).join('；')}。`);
    }
    return {
        groups,
        windows,
        axis,
        promptText: lines.join('\n'),
    };
}
export function mergeAstrolabePeriodCollections(collections, scope = 'yearly') {
    const available = collections.filter(Boolean);
    if (available.length === 0)
        return undefined;
    const events = mergeAstrolabePeriodEvents(available.map((item) => item.events));
    const startDateTime = available.map((item) => item.startDateTime).sort()[0];
    const endDateTime = available
        .map((item) => item.endDateTime)
        .sort()
        .at(-1);
    const layers = buildAstrolabePeriodEventLayers(events, startDateTime, endDateTime, scope);
    return {
        startDateTime,
        endDateTime,
        timezoneLabel: available[0].timezoneLabel,
        events,
        ...layers,
    };
}
function formatCollectionPrompt(startDateTime, endDateTime, events, scope) {
    return buildAstrolabePeriodEventLayers(events, startDateTime, endDateTime, scope);
}
export function buildAstrolabePeriodEvents(data, scope, target) {
    const window = resolveAstrolabePeriodWindow(data, scope, target);
    const bodies = movingBodiesForScope(scope);
    const step = sampleStepDays(scope);
    const natalPoints = natalPointsOf(data);
    const cusps = natalCuspsOf(data);
    const samples = new Map();
    for (const body of bodies) {
        samples.set(body, sampleBody(body, window.startJd, window.endJd, step));
    }
    const events = [];
    const pushEvent = (event) => {
        if (!inWindow(event.julianDate, window.startJd, window.endJd))
            return;
        const dateTime = formatEventDateTime(event.julianDate, data.birth.timeZoneId, window.start.timezone);
        events.push({
            ...event,
            key: event.key ??
                eventKey(event.kind, event.movingPoint, event.julianDate, event.targetPoint ?? event.aspectName ?? ''),
            dateTime,
        });
    };
    for (const body of bodies) {
        const bodySamples = samples.get(body);
        if (!bodySamples)
            continue;
        const movingLabel = labelOf(body);
        for (const natal of natalPoints) {
            for (const aspect of MAJOR_ASPECTS) {
                for (const offset of aspectTargets(aspect.angle)) {
                    const residualAt = (sample) => wrap180(sample.longitude - natal.longitude - offset);
                    const exactAt = (jd) => wrap180(longitudeOf(body, jd) - natal.longitude - offset);
                    for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
                        pushEvent({
                            kind: '行运相位',
                            julianDate: jd,
                            promptText: `${movingLabel}${aspect.symbol}本命${labelOf(natal.name)}`,
                            movingPoint: movingLabel,
                            targetPoint: `本命${labelOf(natal.name)}`,
                            aspectName: aspect.name,
                            key: eventKey('行运相位', body, jd, `${natal.name}:${aspect.name}:${offset}`),
                        });
                    }
                }
            }
        }
        if (body !== 'Sun' && body !== 'Moon' && body !== 'North Node') {
            const residualAt = (sample) => sample.speed;
            const exactAt = (jd) => positionOf(body, jd).speed;
            for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
                const speedAfter = positionOf(body, jd + MINUTE_IN_DAYS).speed;
                const direction = speedAfter < 0 ? '逆行' : '顺行';
                pushEvent({
                    kind: '停逆',
                    julianDate: jd,
                    promptText: `${movingLabel}${direction}`,
                    movingPoint: movingLabel,
                    stationDirection: direction,
                    key: eventKey('停逆', body, jd, direction),
                });
            }
        }
        for (let sign = 0; sign < 12; sign += 1) {
            const targetLongitude = sign * 30;
            const residualAt = (sample) => wrap180(sample.longitude - targetLongitude);
            const exactAt = (jd) => wrap180(longitudeOf(body, jd) - targetLongitude);
            for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
                const speed = positionOf(body, jd).speed;
                const entered = SIGN_LABELS[speed < 0 ? (sign + 11) % 12 : sign];
                const verb = speed < 0 ? '退入' : '进入';
                pushEvent({
                    kind: '换座',
                    julianDate: jd,
                    promptText: `${movingLabel}${verb}${entered}`,
                    movingPoint: movingLabel,
                    signName: entered,
                    key: eventKey('换座', body, jd, entered),
                });
            }
        }
        if (cusps) {
            for (let house = 1; house <= 12; house += 1) {
                const cusp = cusps[house - 1];
                const residualAt = (sample) => wrap180(sample.longitude - cusp);
                const exactAt = (jd) => wrap180(longitudeOf(body, jd) - cusp);
                for (const jd of crossingsFromSamples(bodySamples, residualAt, exactAt)) {
                    const speed = positionOf(body, jd).speed;
                    const arrivedHouse = speed < 0 ? houseForLongitude(cusps, normalizeLongitude(cusp - 0.01)) : house;
                    const verb = speed < 0 ? '退入' : '进入';
                    pushEvent({
                        kind: '换宫',
                        julianDate: jd,
                        promptText: `${movingLabel}${verb}本命第${arrivedHouse}宫`,
                        movingPoint: movingLabel,
                        house: arrivedHouse,
                        key: eventKey('换宫', body, jd, String(arrivedHouse)),
                    });
                }
            }
        }
    }
    for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
        const first = bodies[firstIndex];
        const firstSamples = samples.get(first);
        if (!firstSamples)
            continue;
        for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
            const second = bodies[secondIndex];
            const secondSamples = samples.get(second);
            if (!secondSamples || secondSamples.length !== firstSamples.length)
                continue;
            if ((first === 'Sun' && second === 'Moon') || (first === 'Moon' && second === 'Sun')) {
                continue;
            }
            for (const aspect of MAJOR_ASPECTS) {
                for (const offset of aspectTargets(aspect.angle)) {
                    const residualAt = (sample, index) => wrap180(sample.longitude - secondSamples[index].longitude - offset);
                    const exactAt = (jd) => wrap180(longitudeOf(first, jd) - longitudeOf(second, jd) - offset);
                    for (const jd of crossingsFromSamples(firstSamples, residualAt, exactAt)) {
                        pushEvent({
                            kind: '天象相位',
                            julianDate: jd,
                            promptText: `${labelOf(first)}${aspect.symbol}${labelOf(second)}`,
                            movingPoint: labelOf(first),
                            targetPoint: labelOf(second),
                            aspectName: aspect.name,
                            key: eventKey('天象相位', first, jd, `${second}:${aspect.name}:${offset}`),
                        });
                    }
                }
            }
        }
    }
    const eclipseTimes = [];
    for (const eclipse of findSolarEclipses(window.startJd, window.endJd)) {
        const name = solarEclipseName(eclipse.type);
        eclipseTimes.push(eclipse.julianDate);
        pushEvent({
            kind: '交食',
            julianDate: eclipse.julianDate,
            promptText: name,
            movingPoint: '太阳',
            targetPoint: '月亮',
            eclipseName: name,
            key: eventKey('交食', 'Sun', eclipse.julianDate, eclipse.type),
        });
    }
    for (const eclipse of findLunarEclipses(window.startJd, window.endJd)) {
        const name = lunarEclipseName(eclipse.type);
        eclipseTimes.push(eclipse.julianDate);
        pushEvent({
            kind: '交食',
            julianDate: eclipse.julianDate,
            promptText: name,
            movingPoint: '月亮',
            targetPoint: '太阳',
            eclipseName: name,
            key: eventKey('交食', 'Moon', eclipse.julianDate, eclipse.type),
        });
    }
    const includeQuarters = scope !== 'yearly';
    const lunationAngles = includeQuarters
        ? [
            { name: '朔', angle: 0 },
            { name: '上弦', angle: 90 },
            { name: '望', angle: 180 },
            { name: '下弦', angle: 270 },
        ]
        : [
            { name: '朔', angle: 0 },
            { name: '望', angle: 180 },
        ];
    const moonSamples = samples.get('Moon') ?? sampleBody('Moon', window.startJd, window.endJd, 0.25);
    for (const lunation of lunationAngles) {
        const residualAt = (sample) => wrap180(sample.longitude - longitudeOf('Sun', sample.jd) - lunation.angle);
        const exactAt = (jd) => wrap180(longitudeOf('Moon', jd) - longitudeOf('Sun', jd) - lunation.angle);
        for (const jd of crossingsFromSamples(moonSamples, residualAt, exactAt)) {
            if (eclipseTimes.some((item) => Math.abs(item - jd) < 0.75))
                continue;
            const moonLongitude = longitudeOf('Moon', jd);
            const touches = lunationHitsNatal(moonLongitude, natalPoints);
            const suffix = touches.length ? touches.join('，') : '';
            pushEvent({
                kind: '朔望',
                julianDate: jd,
                promptText: suffix ? `${lunation.name}${suffix}` : lunation.name,
                movingPoint: '月亮',
                targetPoint: '太阳',
                lunationName: lunation.name,
                key: eventKey('朔望', 'Moon', jd, lunation.name),
            });
        }
    }
    const unique = mergeAstrolabePeriodEvents([events]);
    const layers = formatCollectionPrompt(window.startDateTime, window.endDateTime, unique, scope);
    return {
        startDateTime: window.startDateTime,
        endDateTime: window.endDateTime,
        timezoneLabel: window.timezoneLabel,
        events: unique,
        ...layers,
    };
}
