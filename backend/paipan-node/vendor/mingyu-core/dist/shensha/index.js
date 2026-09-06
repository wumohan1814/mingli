/**
 * @file 神煞注册框架（地基层 · 可扩展）
 * @description
 *  八字、六壬、奇门的神煞起法"基本不一样"（用户明确指示不强行统一），
 *  因此本模块提供两层能力：
 *
 *  1) 可扩展注册框架（命理神煞层）：
 *     - 通用命理神煞（空亡、驿马、桃花等跨系统共通者）在此注册；
 *     - 八字/六壬/奇门可保留各自不同的实现，仅在需要时把结果挂到统一接口；
 *     - 新术数系统（太乙、七政四余、八宅等）可自由注册自己的神煞，地基可持续拓展。
 *
 *  2) 黄历/择日神煞层（委托 tyme4ts）：
 *     - tyme4ts 内建 151 个黄历神煞（God），每个带吉凶，并由 `SixtyCycleDay`
 *       提供当日值神(十二建除)、九星、宜忌等。此为"通用黄历"语义，与命理神煞
 *       分属不同层面，故独立暴露，不并入命理注册表，以免与八字/六壬/奇门各自的
 *       神煞体系混淆。
 */
import { SolarDay, SixtyCycle, SixtyCycleDay, God } from 'tyme4ts';
import { EARTHLY_BRANCHES, getYiMa, getTaoHua, isValidGanZhi } from '../ganzhi/index.js';
const REGISTRY = new Map();
/** 注册神煞（可重复覆盖） */
export function registerShensha(def) {
    REGISTRY.set(def.id, def);
}
/** 批量注册 */
export function registerShenshas(defs) {
    for (const def of defs)
        REGISTRY.set(def.id, def);
}
/** 列出已注册神煞（可按 scope 过滤） */
export function listShensha(scope) {
    const all = Array.from(REGISTRY.values());
    return scope ? all.filter((d) => d.scope === scope || d.scope === 'common') : all;
}
/** 列出可安全序列化的神煞目录，不暴露计算函数。 */
export function listShenshaCatalog(scope) {
    return listShensha(scope).map((definition) => ({
        id: definition.id,
        name: definition.name,
        scope: definition.scope,
        evidenceStatus: definition.evidence?.sources.length ? '来源已声明' : '来源未声明',
        inputDependencies: [...(definition.evidence?.inputDependencies ?? [])],
        ruleText: definition.evidence?.ruleText ?? '',
        sources: [...(definition.evidence?.sources ?? [])],
    }));
}
/** 计算指定神煞 */
export function computeShensha(ids, ctx) {
    const out = [];
    for (const id of ids) {
        const def = REGISTRY.get(id);
        if (!def)
            continue;
        const r = def.compute(ctx);
        if (r)
            out.push(r);
    }
    return out;
}
function branchOf(ganZhi) {
    return ganZhi[1];
}
const PILLAR_LABELS = {
    yearGanZhi: '年柱',
    monthGanZhi: '月柱',
    dayGanZhi: '日柱',
    hourGanZhi: '时柱',
};
const SHENSHA_STEP_LIMITATION = '神煞计算步骤只证明规则如何从四柱取得目标并逐柱核对；不得把步骤完整度解释为吉凶、性格、事件概率或必然结果';
const SHENSHA_PILLAR_FACT_LIMITATION = '四柱输入事实只证明当前查询采用了哪些有效干支，不证明神煞已经命中或具有现实因果';
const SHENSHA_MATCH_FACT_LIMITATION = '神煞命中事实只记录当前注册规则与四柱地支的核对结果，只能作为相应传统体系的辅助资料，不得单独定吉凶或现实事件';
const SHENSHA_LIMITATION_FACT_LIMITATION = '神煞限制事实用于约束通用规则可以支持的解释范围，不得被反向当作吉凶、人物定性、现实因果、事件概率或固定应期的证据';
const SHENSHA_SUMMARY_LIMITATION = '神煞证据汇总只统计输入、规则取值、逐柱命中与来源声明的覆盖，不表示传统神煞具有现代实证效力或现实预测准确率';
/** 旬空（日柱旬空）：甲子旬戌亥空 … 甲寅旬子丑空 */
function getVoidBranchesFromDay(dayGanZhi) {
    return SixtyCycle.fromName(dayGanZhi)
        .getExtraEarthBranches()
        .map((branch) => branch.getName());
}
/** 通用命理神煞：空亡、驿马、桃花 */
export const COMMON_SHENSHA = [
    {
        id: 'kongwang',
        name: '空亡',
        scope: 'common',
        evidence: {
            inputDependencies: ['dayGanZhi'],
            ruleText: '按日柱所属旬取得两支旬空，再核对年、月、日、时四柱地支',
            sources: ['六十甲子旬空固定规则', 'tyme4ts 六十甲子旬空资料'],
            resultMeaning: 'target-branches',
        },
        compute: (ctx) => {
            const branches = getVoidBranchesFromDay(ctx.dayGanZhi);
            return {
                id: 'kongwang',
                name: '空亡',
                value: branches,
                detail: `日柱${ctx.dayGanZhi}旬空：${branches.join('、')}`,
            };
        },
    },
    {
        id: 'yima',
        name: '驿马',
        scope: 'common',
        evidence: {
            inputDependencies: ['yearGanZhi'],
            ruleText: '按年支所属三合局取得驿马地支，再核对年、月、日、时四柱地支',
            sources: ['年支三合局对应驿马固定表', '公共干支驿马映射'],
            resultMeaning: 'target-branches',
        },
        compute: (ctx) => {
            const yb = branchOf(ctx.yearGanZhi);
            const m = getYiMa(yb);
            return { id: 'yima', name: '驿马', value: m, detail: `年支${yb}驿马在${m}` };
        },
    },
    {
        id: 'taohua',
        name: '桃花',
        scope: 'common',
        evidence: {
            inputDependencies: ['yearGanZhi'],
            ruleText: '按年支所属三合局取得桃花地支，再核对年、月、日、时四柱地支',
            sources: ['年支三合局对应桃花固定表', '公共干支桃花映射'],
            resultMeaning: 'target-branches',
        },
        compute: (ctx) => {
            const yb = branchOf(ctx.yearGanZhi);
            const t = getTaoHua(yb);
            return { id: 'taohua', name: '桃花', value: t, detail: `年支${yb}桃花在${t}` };
        },
    },
];
// 注册通用命理神煞
registerShenshas(COMMON_SHENSHA);
function validateShenshaContext(ctx) {
    const entries = Object.entries(PILLAR_LABELS);
    return entries.map(([pillar, label]) => {
        const ganZhi = ctx[pillar];
        if (typeof ganZhi !== 'string' || !isValidGanZhi(ganZhi)) {
            throw new Error(`${label}必须是有效六十甲子。`);
        }
        return {
            key: `foundation:shensha:pillar:${pillar}`,
            pillar,
            label,
            ganZhi,
            stem: ganZhi[0],
            branch: ganZhi[1],
            status: '有效六十甲子',
            promptText: `${label}${ganZhi}，天干${ganZhi[0]}、地支${ganZhi[1]}`,
            sources: ['公共六十甲子顺序表'],
            limitation: SHENSHA_PILLAR_FACT_LIMITATION,
        };
    });
}
function normalizeRequestedShenshaIds(ids) {
    const requested = ids ?? listShensha('common').map((item) => item.id);
    if (!Array.isArray(requested) || requested.length === 0) {
        throw new Error('至少需要查询一个神煞。');
    }
    const normalized = Array.from(new Set(requested));
    const unknown = normalized.filter((id) => typeof id !== 'string' || !REGISTRY.has(id));
    if (unknown.length > 0) {
        throw new Error(`未注册神煞：${unknown.join('、')}`);
    }
    return normalized;
}
function getTargetBranches(result) {
    if (!result)
        return [];
    const values = Array.isArray(result.value) ? result.value : [result.value];
    return Array.from(new Set(values.filter((value) => EARTHLY_BRANCHES.includes(value))));
}
/**
 * 严格查询通用神煞结构化证据：核验完整四柱、拒绝未知编号，逐项返回起法、目标、命中柱位、来源与限制。
 * 各术数体系特有神煞仍由各自算法处理，不在此强行统一。
 */
export function analyzeShenshaEvidence(ctx, ids) {
    const pillarFacts = validateShenshaContext(ctx);
    const requestedIds = normalizeRequestedShenshaIds(ids);
    const inputStepKey = 'foundation:shensha:calculation:input';
    const calculationSteps = [
        {
            key: inputStepKey,
            stage: '四柱输入核验',
            status: '已核验',
            dependsOnStepKeys: [],
            promptText: `核验完整四柱：${pillarFacts.map((item) => `${item.label}${item.ganZhi}`).join('、')}`,
            sources: ['公共六十甲子顺序表'],
            limitation: SHENSHA_STEP_LIMITATION,
        },
    ];
    const matchFacts = [];
    for (const id of requestedIds) {
        const definition = REGISTRY.get(id);
        const result = definition.compute(ctx);
        const ruleStepKey = `foundation:shensha:calculation:${id}:rule`;
        const matchStepKey = `foundation:shensha:calculation:${id}:match`;
        const metadata = definition.evidence;
        const evidenceStatus = metadata?.sources.length
            ? '来源已声明'
            : '来源未声明';
        const targetBranches = metadata?.resultMeaning === 'target-branches' ? getTargetBranches(result) : [];
        const matchedPillars = metadata?.resultMeaning === 'target-branches'
            ? pillarFacts
                .filter((pillar) => targetBranches.includes(pillar.branch))
                .map(({ pillar, label, ganZhi, branch }) => ({ pillar, label, ganZhi, branch }))
            : [];
        const status = metadata?.resultMeaning === 'target-branches'
            ? matchedPillars.length > 0
                ? '命中'
                : '未命中'
            : result
                ? '命中'
                : '未命中';
        const ruleText = metadata?.ruleText || '当前动态注册规则未声明公开起法';
        const sources = metadata?.sources.length ? [...metadata.sources] : ['动态注册项未声明来源'];
        const targetText = targetBranches.length > 0 ? targetBranches.join('、') : '未返回目标地支';
        const matchText = matchedPillars.length > 0
            ? matchedPillars.map((item) => `${item.label}${item.ganZhi}`).join('、')
            : '四柱地支均未落入目标';
        calculationSteps.push({
            key: ruleStepKey,
            stage: '规则取值',
            status: '已计算',
            dependsOnStepKeys: [inputStepKey],
            promptText: `${definition.name}：${result?.detail || ruleText}${metadata?.resultMeaning === 'target-branches' ? `，目标地支为${targetText}` : ''}`,
            sources,
            limitation: SHENSHA_STEP_LIMITATION,
        }, {
            key: matchStepKey,
            stage: '逐柱定位',
            status: '已定位',
            dependsOnStepKeys: [ruleStepKey],
            promptText: `${definition.name}${status}：${metadata?.resultMeaning === 'target-branches' ? matchText : result?.detail || '注册函数未返回命中结果'}`,
            sources,
            limitation: SHENSHA_STEP_LIMITATION,
        });
        matchFacts.push({
            key: `foundation:shensha:fact:${id}`,
            id,
            name: definition.name,
            scope: definition.scope,
            status,
            evidenceStatus,
            inputDependencies: [...(metadata?.inputDependencies ?? [])],
            targetBranches,
            matchedPillars,
            ...(result ? { result } : {}),
            ruleText,
            ownerStepKeys: [ruleStepKey, matchStepKey],
            promptText: `${definition.name}${status}；起法：${ruleText}；${metadata?.resultMeaning === 'target-branches' ? `目标地支${targetText}；${matchText}` : result?.detail || '未返回命中结果'}`,
            sources,
            limitation: SHENSHA_MATCH_FACT_LIMITATION,
        });
    }
    const summaryStepKey = 'foundation:shensha:calculation:summary';
    calculationSteps.push({
        key: summaryStepKey,
        stage: '证据汇总',
        status: '已汇总',
        dependsOnStepKeys: matchFacts.flatMap((item) => item.ownerStepKeys.slice(-1)),
        promptText: `汇总${matchFacts.length}项规则：命中${matchFacts.filter((item) => item.status === '命中').length}项、未命中${matchFacts.filter((item) => item.status === '未命中').length}项、来源未声明${matchFacts.filter((item) => item.evidenceStatus === '来源未声明').length}项`,
        sources: ['本次逐项规则取值与四柱定位结果'],
        limitation: SHENSHA_STEP_LIMITATION,
    });
    const limitations = [
        '本入口只统一空亡、驿马、桃花等已注册公共规则；八字、六壬、奇门、七政四余等体系的特有起法仍由各自算法独立核验。',
        '神煞命中只能作为传统辅助资料，必须与所属体系的主线结构、反证和现实信息并列，不得凭单项神煞定吉凶、性格、健康、婚恋、财富或事件结果。',
        '动态注册规则若未声明公开起法与来源，会明确标为来源未声明，不得补造出处或把该结果当作完整证据。',
    ];
    const limitationFacts = [
        {
            key: 'foundation:shensha:limitation:scope',
            type: '体系范围边界',
            status: '适用',
            ownerFactKeys: matchFacts.map((item) => item.key),
            ownerStepKeys: calculationSteps.map((item) => item.key),
            promptText: limitations[0],
            sources: ['通用神煞与各术数体系专用神煞分层原则'],
            limitation: SHENSHA_LIMITATION_FACT_LIMITATION,
        },
        {
            key: 'foundation:shensha:limitation:auxiliary',
            type: '辅助证据边界',
            status: '适用',
            ownerFactKeys: matchFacts.map((item) => item.key),
            ownerStepKeys: calculationSteps.slice(1).map((item) => item.key),
            promptText: limitations[1],
            sources: ['神煞辅助定位与体系主线证据分离原则'],
            limitation: SHENSHA_LIMITATION_FACT_LIMITATION,
        },
        {
            key: 'foundation:shensha:limitation:source',
            type: '来源声明边界',
            status: '适用',
            ownerFactKeys: matchFacts.map((item) => item.key),
            ownerStepKeys: calculationSteps.slice(1).map((item) => item.key),
            promptText: limitations[2],
            sources: ['可扩展注册表的来源声明状态'],
            limitation: SHENSHA_LIMITATION_FACT_LIMITATION,
        },
    ];
    const matchedRuleCount = matchFacts.filter((item) => item.status === '命中').length;
    const undeclaredSourceRuleCount = matchFacts.filter((item) => item.evidenceStatus === '来源未声明').length;
    const summaryFact = {
        key: 'foundation:shensha:evidence-summary',
        status: undeclaredSourceRuleCount > 0 ? '存在来源未声明' : '证据链完整',
        factKeys: [
            ...pillarFacts.map((item) => item.key),
            ...calculationSteps.map((item) => item.key),
            ...matchFacts.map((item) => item.key),
            ...limitationFacts.map((item) => item.key),
        ],
        requestedRuleCount: matchFacts.length,
        matchedRuleCount,
        unmatchedRuleCount: matchFacts.length - matchedRuleCount,
        declaredSourceRuleCount: matchFacts.length - undeclaredSourceRuleCount,
        undeclaredSourceRuleCount,
        calculationStepCount: calculationSteps.length,
        matchFactCount: matchFacts.length,
        limitationFactCount: limitationFacts.length,
        promptText: `通用神煞证据状态为${undeclaredSourceRuleCount > 0 ? '存在来源未声明' : '证据链完整'}：查询${matchFacts.length}项，命中${matchedRuleCount}项、未命中${matchFacts.length - matchedRuleCount}项，来源未声明${undeclaredSourceRuleCount}项`,
        sources: ['完整四柱、注册规则元数据、逐柱命中与解释边界汇总'],
        limitation: SHENSHA_SUMMARY_LIMITATION,
    };
    const source = Array.from(new Set(matchFacts.flatMap((item) => item.sources).filter((item) => !item.includes('未声明')))).join('、');
    const promptSourceFor = (itemSources) => Array.from(new Set(itemSources
        .filter((item) => !item.includes('未声明'))
        .map((item) => item.replace(/^tyme4ts /, '').replace(/^公共/, '')))).join('、') || '未提供公开出处';
    const promptText = [
        '【通用神煞资料】',
        `【四柱】${pillarFacts.map((item) => `${item.label}${item.ganZhi}`).join('、')}。`,
        `【神煞】${matchFacts.map((item) => item.promptText).join('；')}。`,
        `【传统依据】${matchFacts
            .map((item) => `${item.name}：${item.ruleText}（${promptSourceFor(item.sources)}）`)
            .join('；')}。`,
    ].join('\n');
    return {
        key: `foundation:shensha:${requestedIds.join('-')}:${pillarFacts.map((item) => item.ganZhi).join('-')}`,
        status: '已核验',
        context: { ...ctx },
        requestedIds,
        pillarFacts,
        calculationSteps,
        calculationChain: calculationSteps.map((item) => item.promptText),
        matchFacts,
        summaryFact,
        limitations,
        limitationFacts,
        source,
        promptText,
    };
}
/** 列出 tyme4ts 内建的全部黄历神煞名（共 151 个），供能力发现/文档用 */
export function listHuangliShenshaNames() {
    return God.NAMES.slice();
}
/**
 * 查询指定公历日期的黄历神煞（委托 tyme4ts，权威黄历体系）。
 * 返回的 shensha 含吉凶分类，duty 为十二建除，nineStar 为九星。
 */
export function getHuangliShensha(year, month, day) {
    const solarDay = SolarDay.fromYmd(year, month, day);
    const scDay = SixtyCycleDay.fromSolarDay(solarDay);
    const gods = scDay.getGods();
    const shensha = gods.map((g) => ({
        name: g.getName(),
        luck: g.getLuck().getName(),
    }));
    const duty = scDay.getDuty().getName();
    const nineStar = scDay.getNineStar();
    return {
        shensha,
        duty,
        nineStar: nineStar.getName(),
        nineStarColor: nineStar.getColor(),
    };
}
export const shensha = {
    registerShensha,
    registerShenshas,
    listShensha,
    listShenshaCatalog,
    computeShensha,
    analyzeShenshaEvidence,
    COMMON_SHENSHA,
    getHuangliShensha,
    listHuangliShenshaNames,
};
