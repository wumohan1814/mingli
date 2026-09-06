import { generateAlmanacSelection } from './algorithms/almanac.js';
import { generateAstrolabe } from './algorithms/astrolabe.js';
import { generateJinkoujue } from './algorithms/jinkoujue.js';
import { generateLiuyao } from './algorithms/liuyao.js';
import { generateLiuren } from './algorithms/liuren/index.js';
import { drawLenormandSpread } from './algorithms/lenormand.js';
import { generateMeihua } from './algorithms/meihua/index.js';
import { generateQimen } from './algorithms/qimen/index.js';
import { drawRandomSign, resolveSignByNumber } from './algorithms/ssgw.js';
import { generateXiaoliuren } from './algorithms/xiaoliuren.js';
import { generateTaiyi } from '../taiyi/index.js';
import { calculateHuangjiJingshi } from '../huangji-jingshi/index.js';
import { drawTarotSpread } from './tarot.js';
import { isEarthlyBranch } from '../ganzhi/index.js';
import { createRandomContext, randomInt } from '../shared/random.js';
import { serializeCoreResult } from '../shared/result.js';
import { buildDivinationPromptDocument, formatDivinationInfo, formatSupplementaryInfo, getDivinationSummaryBlocks, } from '../prompt/divination.js';
import { formatPromptCurrentTime } from '../prompt/current-time.js';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from '../prompt/sections.js';
import { buildTaskText } from './engine/method-text.js';
import { buildTarotSpreadTask } from '../prompt/tarot-spread.js';
import { buildPromptTask } from '../prompt/guidance.js';
import { createUnifiedResultView, partitionResultForConsumption, } from '../consumption/index.js';
export function summarizeDivinationResult(method, data) {
    return getDivinationSummaryBlocks(method, data);
}
export function formatDivinationResult(method, data) {
    return formatDivinationInfo(method, data);
}
export function serializeDivinationResult(data) {
    return serializeCoreResult(data);
}
function buildDivinationAiPrompt(options) {
    if (options.method === 'ssgw') {
        return buildDivinationPromptDocument({
            method: options.method,
            data: options.data,
            question: options.question,
            currentTime: options.currentTime,
        });
    }
    const supplementary = formatSupplementaryInfo(options.supplementaryInfo, options.method);
    return buildPromptDocument(joinPromptSections([
        buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
        supplementary ? buildPromptSection('补充信息', supplementary) : '',
        buildPromptSection('占卜资料', options.chartText),
        buildPromptSection('任务', options.method === 'tarot'
            ? buildTarotSpreadTask(options.data)
            : options.method === 'lenormand' && options.data.cards.length === 1
                ? buildPromptTask('依据唯一牌位与基础牌义回答【问题】。', 'lenormand-single')
                : buildTaskText(options.method)),
        buildPromptSection('问题', options.question || '请依据本次盘面资料完成解读。'),
    ]));
}
function formatAiChart(method, data, summary) {
    const base = [summary.title, summary.tags.filter(Boolean).join('；'), ...summary.lines].filter(Boolean);
    if (method === 'liuyao') {
        const item = data;
        base.push('六爻明细：', ...item.yaosDetail.map((yao) => `第${yao.position}爻：${yao.yaoType}爻，${yao.sixGod}${yao.sixRelative}${yao.najiaDizhi}${yao.wuxing}${yao.isWorld ? '，世爻' : ''}${yao.isResponse ? '，应爻' : ''}${yao.isChanging ? `，动爻${yao.changedYao ? `化${yao.changedYao.liuqin}${yao.changedYao.dizhi}${yao.changedYao.wuxing}` : ''}` : ''}${yao.isVoid ? '，空亡' : ''}`));
    }
    else if (method === 'qimen') {
        const item = data;
        base.push('九宫明细：', ...item.jiuGongGe.map((palace) => `${palace.name}（${palace.direction}、${palace.element}）：天盘${palace.tianPan.stem}${palace.tianPan.star}${palace.tianPan.companionStem ? `，随${palace.tianPan.companionStem}${palace.tianPan.companionStar || ''}` : ''}；地盘${palace.diPan.stem}；门${palace.renPan.door}；神${palace.shenPan.god}`));
    }
    else if (method === 'astrolabe') {
        const item = data;
        base.push(`出生资料：${item.birth.dateTime}，${item.birth.location}`, `星体：${item.planets.map((point) => `${point.name}${point.formatted}`).join('；')}`, `四轴：${item.angles.map((point) => `${point.name}${point.formatted}`).join('；')}`, `宫位：${item.houses.map((point) => `第${point.house}宫宫头${point.formatted}`).join('；')}`, `相位：${item.aspects.map((aspect) => `${aspect.body1}${aspect.symbol}${aspect.body2}，容许度${aspect.orb.toFixed(2)}°`).join('；') || '无'}`);
    }
    return base.join('\n');
}
const RANDOM_METHODS = [
    'liuyao',
    'meihua',
    'xiaoliuren',
    'jinkoujue',
    'qimen',
    'liuren',
    'taiyi',
    'tarot',
    'ssgw',
    'lenormand',
];
function assertRequestRecord(request) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
        throw new Error('占法请求必须是对象。');
    }
    if (!RANDOM_METHODS.includes(request.method) &&
        request.method !== 'astrolabe' &&
        request.method !== 'almanac' &&
        request.method !== 'huangji') {
        if (request.method !== 'random')
            throw new Error(`未知的占法：${String(request.method)}`);
    }
}
function normalizeDate(value, field) {
    if (value === undefined)
        return undefined;
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime()))
        throw new Error(`${field}必须是有效日期。`);
    return date;
}
function normalizeCurrentTime(value) {
    return normalizeDate(value, '当前时间');
}
function resolveMethod(request) {
    if (request.method !== 'random')
        return { method: request.method };
    const random = createRandomContext(request.random);
    return { method: RANDOM_METHODS[randomInt(RANDOM_METHODS.length, random.random)], random };
}
function withSessionRandom(options, selectionRandom) {
    if (!selectionRandom)
        return options;
    return { random: selectionRandom.random };
}
function buildQuestion(method, question, data) {
    const normalized = question?.trim() ?? '';
    if (normalized)
        return normalized;
    if (method === 'almanac') {
        const item = data;
        return `黄历择日：${item.topicLabel}（${item.startDate} 至 ${item.endDate}）`;
    }
    return '';
}
/** 只做请求层校验，不执行排盘；适合表单和 API 在提交前调用。 */
export function validateDivinationRequest(request) {
    assertRequestRecord(request);
    if (request.method !== 'almanac' && !request.question?.trim()) {
        throw new Error('占法请求需要提供问题；黄历择日可省略问题。');
    }
    normalizeDate(request.divinationTime, '起课时间');
    normalizeCurrentTime(request.currentTime);
    if (request.method === 'almanac') {
        const value = request.almanac;
        if (!value)
            throw new Error('黄历择日需要提供 almanac 参数。');
        if (!value.startDate || !value.endDate)
            throw new Error('黄历择日需要提供开始日期和结束日期。');
    }
    if (request.method === 'astrolabe' && !request.astrolabe) {
        throw new Error('星盘需要提供 astrolabe 出生资料。');
    }
    if (request.method === 'jinkoujue') {
        const method = request.jinkoujue?.method ?? 'time';
        if (!['time', 'branch', 'number', 'random'].includes(method)) {
            throw new Error('金口诀起课方式必须是 time、branch、number 或 random。');
        }
        if (method === 'branch' && !isEarthlyBranch(request.jinkoujue?.branch)) {
            throw new Error('金口诀指定地分必须是子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥之一。');
        }
        if (method === 'number' &&
            (!Number.isSafeInteger(request.jinkoujue?.number) || (request.jinkoujue?.number ?? 0) < 1)) {
            throw new Error('金口诀数字起课必须提供不小于 1 的整数。');
        }
    }
    if (request.method === 'taiyi') {
        if (!request.taiyi) {
            throw new Error('太乙需要提供 taiyi 参数。');
        }
        const scope = request.taiyi.scope ?? 'year';
        if (!['year', 'month', 'day', 'hour'].includes(scope)) {
            throw new Error('太乙 scope 必须是 year、month、day 或 hour。');
        }
        if (scope === 'year' && !Number.isSafeInteger(request.taiyi.year)) {
            throw new Error('太乙年计年份必须是整数。');
        }
    }
    if (request.method === 'huangji') {
        const year = request.huangji?.year;
        if (year !== undefined && !Number.isSafeInteger(year)) {
            throw new Error('皇极经世年份必须是非零整数。');
        }
        if (year === 0) {
            throw new Error('皇极经世采用无公元0年的公元纪年。');
        }
        if (year !== undefined && year < -67_017) {
            throw new Error('皇极经世目标年份不能早于公元前67017年。');
        }
        if (year !== undefined && request.divinationTime !== undefined) {
            throw new Error('皇极经世年份与年月日时起盘时间不能同时提供。');
        }
    }
}
function generateData(request, method, customDate, selectionRandom) {
    const randomOptions = withSessionRandom(request.random, selectionRandom);
    switch (method) {
        case 'liuyao':
            return generateLiuyao(customDate, {
                ...(request.liuyao ?? {}),
                ...((request.liuyao?.method ?? (request.liuyao?.yaos ? 'manual' : 'time')) === 'coins' &&
                    randomOptions
                    ? randomOptions
                    : {}),
            });
        case 'meihua':
            return generateMeihua(customDate, {
                ...(request.meihua ?? {}),
                ...(request.meihua?.method === 'random' && randomOptions ? randomOptions : {}),
            });
        case 'xiaoliuren':
            return generateXiaoliuren({ ...request.xiaoliuren, customDate });
        case 'jinkoujue':
            return generateJinkoujue({
                ...request.jinkoujue,
                ...(request.jinkoujue?.method === 'random' && randomOptions ? randomOptions : {}),
                customDate,
            });
        case 'qimen':
            return generateQimen(customDate, request.qimen?.method, request.qimen?.scope, request.qimen?.juMethod);
        case 'liuren':
            return generateLiuren(customDate);
        case 'tarot':
            return drawTarotSpread(request.tarot?.spread ?? 'single', {
                ...(request.tarot?.manualCards ? { manualCards: request.tarot.manualCards } : {}),
                ...(request.tarot?.interactiveSamples
                    ? { interactiveSamples: request.tarot.interactiveSamples }
                    : {}),
                ...(!request.tarot?.manualCards && !request.tarot?.interactiveSamples && randomOptions
                    ? randomOptions
                    : {}),
            });
        case 'ssgw':
            return request.ssgw?.method === 'manual'
                ? resolveSignByNumber(request.ssgw.number ?? 0, customDate)
                : drawRandomSign(customDate, randomOptions);
        case 'almanac':
            if (!request.almanac)
                throw new Error('黄历择日需要提供 almanac 参数。');
            return generateAlmanacSelection(request.almanac);
        case 'lenormand':
            return drawLenormandSpread(request.lenormand?.spread ?? 'single', {
                ...(request.lenormand?.manualCardIds
                    ? { manualCardIds: request.lenormand.manualCardIds }
                    : {}),
                ...(request.lenormand?.interactiveSamples
                    ? { interactiveSamples: request.lenormand.interactiveSamples }
                    : {}),
                ...(!request.lenormand?.manualCardIds &&
                    !request.lenormand?.interactiveSamples &&
                    randomOptions
                    ? randomOptions
                    : {}),
            });
        case 'astrolabe':
            if (!request.astrolabe)
                throw new Error('星盘需要提供 astrolabe 出生资料。');
            return generateAstrolabe(request.astrolabe);
        case 'taiyi':
            if (!request.taiyi)
                throw new Error('太乙需要提供 taiyi 参数。');
            if ((request.taiyi.scope ?? 'year') === 'year') {
                return generateTaiyi({ year: request.taiyi.year, scope: 'year' });
            }
            return generateTaiyi({
                date: customDate ?? new Date(),
                scope: request.taiyi.scope,
            });
        case 'huangji':
            return calculateHuangjiJingshi(request.huangji?.year !== undefined
                ? {
                    year: request.huangji.year,
                    question: request.question?.trim(),
                }
                : {
                    date: customDate ?? new Date(),
                    question: request.question?.trim(),
                });
    }
}
/** 以框架无关的纯数据请求完成一次占法，返回可展示、可缓存、可传输的统一结果。 */
export function generateDivinationSession(request) {
    validateDivinationRequest(request);
    const { method, random: selectionRandom } = resolveMethod(request);
    const customDate = normalizeDate(request.divinationTime, '起课时间');
    const data = generateData(request, method, customDate, selectionRandom);
    const question = buildQuestion(method, request.question, data);
    const currentTime = normalizeCurrentTime(request.currentTime);
    const promptOptions = {
        method,
        data,
        question,
        currentTime,
        ...request.prompt,
        supplementaryInfo: request.supplementaryInfo,
        isCustomQuestion: request.questionSource === 'custom',
    };
    const promptDocument = method === 'huangji'
        ? buildPromptDocument(data.prompt)
        : buildDivinationPromptDocument(promptOptions);
    const summary = summarizeDivinationResult(method, data);
    const { chart, auditEvidence } = partitionResultForConsumption(data);
    const aiPromptDocument = method === 'huangji'
        ? buildPromptDocument(data.prompt)
        : buildDivinationAiPrompt({
            method,
            question,
            currentTime,
            supplementaryInfo: request.supplementaryInfo,
            chartText: formatAiChart(method, data, summary),
            data,
        });
    const aiPrompt = aiPromptDocument.text;
    const view = createUnifiedResultView({
        kind: method,
        input: request,
        calendar: null,
        chart,
        timing: null,
        summary,
        evidence: auditEvidence,
        raw: data,
    });
    return {
        requestedMethod: request.method,
        method,
        question,
        data,
        summary,
        formattedResult: formatDivinationResult(method, data),
        serializedResult: serializeDivinationResult(data),
        prompt: promptDocument.text,
        promptDocument,
        displaySummary: summary,
        aiPrompt,
        auditEvidence,
        view,
    };
}
/** 兼容只需要一个函数名的调用方。 */
export const generateDivination = generateDivinationSession;
