/**
 * @file 五行生克模块（地基层）
 * @description 五行生克乘侮、旺相休囚死、五行强度统计等可复用基础能力。
 *
 * 深度整合 tyme4ts：五行生克（生我/我生/克我/我克）委托 tyme4ts 的 `Element`
 * （权威经典实现）；旺相休囚死(getSeasonState)、五行强度统计(tallyWuxing)保留本库实现。
 */
import { Element } from 'tyme4ts';
import { BRANCH_WUXING, MONTH_LING_WUXING, getSeasonState, getBranchWuxing, STEM_ORDER, BRANCH_ORDER, BRANCH_HIDDEN_STEMS, WUXING, } from '../ganzhi/relations.js';
import { STEM_WUXING } from '../ganzhi/data.js';
export { WUXING } from '../ganzhi/relations.js';
/** 五行相生：a 生 b？委托 tyme4ts Element */
export function isSheng(a, b) {
    return Element.fromName(a).getReinforce().getName() === b;
}
/** 五行相克：a 克 b？委托 tyme4ts Element */
export function isKe(a, b) {
    return Element.fromName(a).getRestrain().getName() === b;
}
export { BRANCH_WUXING, MONTH_LING_WUXING, getSeasonState, getBranchWuxing };
/**
 * 统计一组干支的五行分布
 * @param items 天干或地支数组（混合亦可）
 * @param options.weightHidden 是否把地支藏干计入（本气权重 1，中气 0.5，余气 0.3）
 * @returns 各五行加权计数
 */
export function tallyWuxing(items, options = {}) {
    const result = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    for (const item of items) {
        if (STEM_ORDER.includes(item)) {
            const w = STEM_WUXING[item];
            if (w)
                result[w] += 1;
        }
        else if (BRANCH_ORDER.includes(item)) {
            const main = BRANCH_WUXING[item];
            if (main)
                result[main] += 1;
            if (options.weightHidden) {
                const hidden = BRANCH_HIDDEN_STEMS[item] || [];
                const weights = [1, 0.5, 0.3];
                hidden.forEach((stem, i) => {
                    const w = STEM_WUXING[stem];
                    if (w)
                        result[w] += weights[i] ?? 0.3;
                });
            }
        }
    }
    return result;
}
/** 生成五行强弱画像（仅统计，不含日主旺衰判定） */
export function getWuxingStrengthProfile(items) {
    const counts = tallyWuxing(items, { weightHidden: true });
    return buildStrengthProfile(counts);
}
function buildStrengthProfile(counts) {
    let dominant = WUXING[0];
    let weakest = WUXING[0];
    let max = -Infinity;
    let min = Infinity;
    for (const w of WUXING) {
        if (counts[w] > max) {
            max = counts[w];
            dominant = w;
        }
        if (counts[w] < min) {
            min = counts[w];
            weakest = w;
        }
    }
    const dominantElements = WUXING.filter((w) => counts[w] === max);
    const weakestElements = WUXING.filter((w) => counts[w] === min);
    const lacking = WUXING.filter((w) => counts[w] === 0);
    return { counts, dominant, dominantElements, weakest, weakestElements, lacking };
}
const WUXING_STEP_LIMITATION = '五行统计步骤只证明输入符号如何按天干、地支及可选藏干权重形成当前计数；不得把计数、步骤数量或并列顺序解释为命局旺衰、吉凶分数、事件概率或现实结论';
const WUXING_ITEM_FACT_LIMITATION = '逐项五行事实只记录当前符号对统计结果的公开贡献；藏干权重是本工具的明确统计口径，不等同于月令司权、日主旺衰、格局成败或现实吉凶';
const WUXING_LIMITATION_FACT_LIMITATION = '五行限制事实用于约束加权计数的解释范围，不得被反向当作命局强弱、用神、健康、财富、职业或事件结果的证据';
const WUXING_SUMMARY_LIMITATION = '五行证据汇总只统计输入映射、公开权重、计数结果、并列情况与解释边界的覆盖，不表示已完成八字旺衰、格局、取用或现实预测';
function buildWuxingEvidence(params) {
    const inputStepKey = 'foundation:wuxing:calculation:input';
    const mappingStepKey = 'foundation:wuxing:calculation:item-mapping';
    const tallyStepKey = 'foundation:wuxing:calculation:tally';
    const summaryStepKey = 'foundation:wuxing:calculation:summary';
    const hiddenWeights = [1, 0.5, 0.3];
    const hiddenRanks = ['本气', '中气', '余气'];
    const itemFacts = params.items.map((item, itemIndex) => {
        const isStem = STEM_ORDER.includes(item);
        const primaryWuxing = isStem ? STEM_WUXING[item] : BRANCH_WUXING[item];
        if (!primaryWuxing)
            throw new Error(`五行映射数据缺失：${item}`);
        const hiddenContributions = !isStem && params.weightHidden
            ? (BRANCH_HIDDEN_STEMS[item] ?? []).map((stem, index) => {
                const wuxing = STEM_WUXING[stem];
                if (!wuxing)
                    throw new Error(`藏干五行数据缺失：${stem}`);
                return {
                    stem,
                    wuxing,
                    weight: hiddenWeights[index] ?? 0.3,
                    rank: hiddenRanks[index] ?? '余气',
                };
            })
            : [];
        const hiddenText = hiddenContributions.length > 0
            ? `；另计藏干${hiddenContributions.map((entry) => `${entry.rank}${entry.stem}${entry.wuxing}×${entry.weight}`).join('、')}`
            : '';
        return {
            key: `foundation:wuxing:fact:item:${itemIndex}:${item}`,
            status: '已映射',
            itemIndex,
            item,
            itemType: isStem ? '天干' : '地支',
            primaryWuxing,
            primaryContribution: 1,
            hiddenContributions,
            ownerStepKeys: [mappingStepKey, tallyStepKey],
            promptText: `第${itemIndex + 1}项${item}为${isStem ? '天干' : '地支'}，主五行${primaryWuxing}计1${hiddenText}`,
            sources: isStem
                ? ['公共天干五行表']
                : ['公共地支五行与藏干顺序表', '藏干权重本气1、中气0.5、余气0.3'],
            limitation: WUXING_ITEM_FACT_LIMITATION,
        };
    });
    const countText = WUXING.map((wuxing) => `${wuxing}${params.profile.counts[wuxing]}`).join('、');
    const calculationSteps = [
        {
            key: inputStepKey,
            stage: '输入核验',
            status: '已核验',
            dependsOnStepKeys: [],
            promptText: `核验${params.items.length}个天干或地支输入；${params.weightHidden ? '启用' : '关闭'}藏干加权`,
            sources: ['公共天干、地支目录与输入范围校验'],
            limitation: WUXING_STEP_LIMITATION,
        },
        {
            key: mappingStepKey,
            stage: '逐项五行映射',
            status: '已映射',
            dependsOnStepKeys: [inputStepKey],
            promptText: `逐项映射：${itemFacts.map((fact) => fact.promptText).join('；')}`,
            sources: ['天干五行、地支五行与藏干公共表'],
            limitation: WUXING_STEP_LIMITATION,
        },
        {
            key: tallyStepKey,
            stage: '加权汇总',
            status: '已统计',
            dependsOnStepKeys: [mappingStepKey],
            promptText: `按公开贡献相加得到${countText}`,
            sources: ['逐项主五行贡献与可选藏干权重汇总'],
            limitation: WUXING_STEP_LIMITATION,
        },
        {
            key: summaryStepKey,
            stage: '分布摘要',
            status: '已汇总',
            dependsOnStepKeys: [tallyStepKey],
            promptText: `最高计数五行为${params.profile.dominantElements.join('、')}，最低计数五行为${params.profile.weakestElements.join('、')}，零计数五行为${params.profile.lacking.join('、') || '无'}`,
            sources: ['木火土金水固定顺序下的计数最大值、最小值与零值比较'],
            limitation: WUXING_STEP_LIMITATION,
        },
    ];
    const limitations = [
        '本结果只统计输入天干、地支及可选藏干的五行贡献，不包含月令司权、季节旺衰、日主、格局、合化或运限。',
        '启用藏干时采用本气1、中气0.5、余气0.3的公开统计权重；该权重用于展示构成，不是命理吉凶评分。',
        '最高或最低计数可能并列；dominantElements 与 weakestElements 保留全部并列项，单数 dominant 与 weakest 仅按木火土金水固定顺序返回首项以兼容旧调用。',
    ];
    const hiddenOwnerFactKeys = itemFacts
        .filter((item) => item.hiddenContributions.length > 0)
        .map((item) => item.key);
    const limitationFacts = [
        {
            key: 'foundation:wuxing:limitation:scope',
            type: '统计范围边界',
            status: '适用',
            ownerFactKeys: itemFacts.map((item) => item.key),
            ownerStepKeys: [inputStepKey, mappingStepKey, tallyStepKey, summaryStepKey],
            promptText: limitations[0],
            sources: ['五行分布工具的输入与输出范围'],
            limitation: WUXING_LIMITATION_FACT_LIMITATION,
        },
        {
            key: 'foundation:wuxing:limitation:hidden-weight',
            type: '藏干权重边界',
            status: '适用',
            ownerFactKeys: hiddenOwnerFactKeys.length > 0 ? hiddenOwnerFactKeys : itemFacts.map((item) => item.key),
            ownerStepKeys: [mappingStepKey, tallyStepKey],
            promptText: limitations[1],
            sources: ['藏干本气、中气、余气公开权重口径'],
            limitation: WUXING_LIMITATION_FACT_LIMITATION,
        },
        {
            key: 'foundation:wuxing:limitation:ties',
            type: '并列结果边界',
            status: '适用',
            ownerFactKeys: itemFacts.map((item) => item.key),
            ownerStepKeys: [summaryStepKey],
            promptText: limitations[2],
            sources: ['五行计数并列与兼容字段返回规则'],
            limitation: WUXING_LIMITATION_FACT_LIMITATION,
        },
    ];
    const summaryFact = {
        key: 'foundation:wuxing:evidence-summary',
        status: '证据链完整',
        factKeys: [
            ...calculationSteps.map((item) => item.key),
            ...itemFacts.map((item) => item.key),
            ...limitationFacts.map((item) => item.key),
        ],
        calculationStepCount: calculationSteps.length,
        itemFactCount: itemFacts.length,
        limitationFactCount: limitationFacts.length,
        promptText: `五行分布证据链完整：计算步骤${calculationSteps.length}项、逐项事实${itemFacts.length}项、限制${limitationFacts.length}项`,
        sources: ['输入映射、公开权重、计数分布、并列状态与解释边界汇总'],
        limitation: WUXING_SUMMARY_LIMITATION,
    };
    const source = '天干五行、地支五行与藏干顺序来自公共干支单一真相源；藏干加权采用公开的本气1、中气0.5、余气0.3统计口径';
    return {
        key: `foundation:wuxing:${params.weightHidden ? 'with-hidden' : 'surface'}:${params.items.join('-')}`,
        status: '已统计',
        calculationSteps,
        calculationChain: calculationSteps.map((item) => item.promptText),
        itemFacts,
        summaryFact,
        limitations,
        limitationFacts,
        source,
        promptText: `五行分布：${calculationSteps.map((item) => item.promptText).join(' → ')}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.map((item) => item.replace(/[。；]+$/, '')).join('；')}。`,
    };
}
/** 严格校验输入后生成可直接给 API/MCP 使用的五行分布结果。 */
export function analyzeWuxing(items, options = {}) {
    if (items.length === 0)
        throw new Error('五行分析至少需要一个天干或地支。');
    const invalid = items.find((item) => !STEM_ORDER.includes(item) &&
        !BRANCH_ORDER.includes(item));
    if (invalid)
        throw new Error(`五行分析输入无效：${invalid}`);
    const weightHidden = options.weightHidden ?? true;
    const counts = tallyWuxing(items, { weightHidden });
    const profile = buildStrengthProfile(counts);
    return {
        items: [...items],
        weightHidden,
        ...profile,
        ...buildWuxingEvidence({ items, weightHidden, profile }),
    };
}
export const wuxing = {
    isSheng,
    isKe,
    getSeasonState,
    getBranchWuxing,
    tallyWuxing,
    getWuxingStrengthProfile,
    analyzeWuxing,
};
