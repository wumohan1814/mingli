/**
 * @file 生肖犯太岁 / 流年运程
 * @description 由年支推算值/冲/刑/害/破太岁，并逐项返回流年干支五行、三合六合与三会关系及解释边界。
 * @传统依据 十二地支同支、合冲刑害破与三合三会固定关系表，以及天干地支五行公共规则。
 * 复用 ganzhi 的干支关系函数。生肖按立春为年界（调用方传入立春校正后的年柱）。
 */
import { getStemWuxing, getBranchWuxing, isSheng, isKe, isLiuchong, isLiuhai, isLiupo, isSanxing, isLiuhe, isValidGanZhi, getBranchIndex, BRANCH_SANHE, SANHUI_GROUPS, ZODIACS, EARTHLY_BRANCHES, SIXTY_CYCLE, getGanZhiFromDate, } from '../ganzhi/index.js';
import { analyzeZodiacEvidence } from './evidence.js';
export { analyzeZodiacEvidence } from './evidence.js';
/** 六十甲子值年太岁星君 */
export const TAI_SUI_STARS = Object.freeze({
    甲子: '金辨',
    乙丑: '陈材',
    丙寅: '耿章',
    丁卯: '沈悌',
    戊辰: '赵达',
    己巳: '郭灿',
    庚午: '王济',
    辛未: '李素',
    壬申: '刘旺',
    癸酉: '康志',
    甲戌: '施广',
    乙亥: '任保',
    丙子: '郭嘉',
    丁丑: '汪文',
    戊寅: '鲁先',
    己卯: '龙仲',
    庚辰: '董德',
    辛巳: '郑但',
    壬午: '陆明',
    癸未: '魏仁',
    甲申: '方杰',
    乙酉: '蒋崇',
    丙戌: '白敏',
    丁亥: '封济',
    戊子: '邹铛',
    己丑: '潘佐',
    庚寅: '邬桓',
    辛卯: '范宁',
    壬辰: '彭泰',
    癸巳: '徐斝',
    甲午: '章词',
    乙未: '杨仙',
    丙申: '管仲',
    丁酉: '唐杰',
    戊戌: '姜武',
    己亥: '谢焘',
    庚子: '卢秘',
    辛丑: '杨信',
    壬寅: '贺谔',
    癸卯: '皮时',
    甲辰: '李诚',
    乙巳: '吴遂',
    丙午: '文哲',
    丁未: '缪丙',
    戊申: '徐浩',
    己酉: '程宝',
    庚戌: '倪秘',
    辛亥: '叶坚',
    壬子: '丘德',
    癸丑: '朱得',
    甲寅: '张朝',
    乙卯: '万清',
    丙辰: '辛亚',
    丁巳: '杨彦',
    戊午: '黎卿',
    己未: '傅党',
    庚申: '毛梓',
    辛酉: '石政',
    壬戌: '洪充',
    癸亥: '虞程',
});
function assertTaiSuiStarTable() {
    const expected = new Set(SIXTY_CYCLE);
    const keys = Object.keys(TAI_SUI_STARS);
    const missing = SIXTY_CYCLE.filter((ganZhi) => !TAI_SUI_STARS[ganZhi]?.trim());
    const unexpected = keys.filter((ganZhi) => !expected.has(ganZhi));
    const duplicateNames = [...new Set(Object.values(TAI_SUI_STARS))].filter((name) => Object.values(TAI_SUI_STARS).filter((item) => item === name).length > 1);
    if (missing.length || unexpected.length || duplicateNames.length || keys.length !== 60) {
        throw new Error(`六十甲子太岁星君资料不完整：缺失${missing.join('、') || '无'}；多余${unexpected.join('、') || '无'}；重名${duplicateNames.join('、') || '无'}；当前${keys.length}项`);
    }
}
assertTaiSuiStarTable();
/**
 * BUG-003 确定性文案（来源：docs/文案交付/B2_zodiac_annual.json，UTF-8 原文逐字收录）。
 * 仅作“计算未覆盖”时的回填兜底，纯确定性、零 LLM、零新依赖：
 * - 本气五行：该生肖地支本气的展示文案（机读五行见 elementRelation.zodiacWuxing）。
 * - 贵人/风险关系/行动建议：按地支固定关系（三合/六合/冲/害/刑/破）生成的固定文案，
 *   与流年年支是否命中无关，故仅用于对应计算字段为空的场景。
 * 键按十二生肖名（与 ZODIACS 同序），无内部字段名（evidenceAnalysis/prompt 等），
 * 不会被 stripInternal 剥离。
 */
const ZODIAC_ANNUAL_COPY = Object.freeze({
    鼠: Object.freeze({
        本气五行: '水（子）',
        贵人: '三合：猴、龙；六合：牛',
        风险关系: '相冲：马；相害：羊；相破：鸡；相刑：兔（无礼之刑）',
        行动建议: '水主智，宜以灵活与积淀应对变化；顺势之年多结善缘，逆势之年忌冒进与口舌。',
    }),
    牛: Object.freeze({
        本气五行: '土（丑，己土）',
        贵人: '三合：蛇、鸡；六合：鼠',
        风险关系: '相冲：羊；相害：马；相破：龙；相刑：狗、羊（恃势之刑）',
        行动建议: '土主稳，宜守成与深耕；顺势之年可拓展根基，逆势之年忌固执与硬扛。',
    }),
    虎: Object.freeze({
        本气五行: '木（寅）',
        贵人: '三合：马、狗；六合：猪',
        风险关系: '相冲：猴；相害：蛇；相破：猪；相刑：蛇、猴（无恩之刑）',
        行动建议: '木主生发，宜主动开拓；顺势之年借势向前，逆势之年忌冲动与孤行。',
    }),
    兔: Object.freeze({
        本气五行: '木（卯）',
        贵人: '三合：猪、羊；六合：狗',
        风险关系: '相冲：鸡；相害：龙；相破：马；相刑：鼠（无礼之刑）',
        行动建议: '木主柔韧，宜以巧劲化解阻力；顺势之年多谋善断，逆势之年忌优柔与内耗。',
    }),
    龙: Object.freeze({
        本气五行: '土（辰，戊土）',
        贵人: '三合：猴、鼠；六合：鸡',
        风险关系: '相冲：狗；相害：兔；相破：牛；自刑：辰',
        行动建议: '土主承载，宜以格局与信誉立身；顺势之年可担大任，逆势之年忌张扬与专断。',
    }),
    蛇: Object.freeze({
        本气五行: '火（巳）',
        贵人: '三合：鸡、牛；六合：猴',
        风险关系: '相冲：猪；相害：虎；相破：申；相刑：虎、猴（无恩之刑）',
        行动建议: '火主明，宜以洞察与谋定后动；顺势之年借智慧破局，逆势之年忌猜忌与纠缠。',
    }),
    马: Object.freeze({
        本气五行: '火（午）',
        贵人: '三合：虎、狗；六合：羊',
        风险关系: '相冲：鼠；相害：牛；相破：兔；自刑：午',
        行动建议: '火主跃动，宜把控节奏、张弛有度；顺势之年可放手一搏，逆势之年忌急躁与分散。',
    }),
    羊: Object.freeze({
        本气五行: '土（未，己土）',
        贵人: '三合：猪、兔；六合：马',
        风险关系: '相冲：牛；相害：鼠；相破：狗；相刑：牛、狗（恃势之刑）',
        行动建议: '土主温厚，宜以和顺聚人聚气；顺势之年广结善缘，逆势之年忌犹疑与跟风。',
    }),
    猴: Object.freeze({
        本气五行: '金（申）',
        贵人: '三合：鼠、龙；六合：蛇',
        风险关系: '相冲：虎；相害：猪；相破：巳；相刑：虎、蛇（无恩之刑）',
        行动建议: '金主锐，宜以机变与务实并进；顺势之年多路开花，逆势之年忌投机与口舌。',
    }),
    鸡: Object.freeze({
        本气五行: '金（酉）',
        贵人: '三合：蛇、牛；六合：龙',
        风险关系: '相冲：兔；相害：狗；相破：子；自刑：酉',
        行动建议: '金主精，宜以专业与细致见长；顺势之年可求精进，逆势之年忌苛责与孤芳。',
    }),
    狗: Object.freeze({
        本气五行: '土（戌，戊土）',
        贵人: '三合：虎、马；六合：兔',
        风险关系: '相冲：龙；相害：鸡；相破：羊；相刑：牛、羊（恃势之刑）',
        行动建议: '土主忠，宜以可靠与守约立信；顺势之年得同伴助，逆势之年忌较真与硬碰。',
    }),
    猪: Object.freeze({
        本气五行: '水（亥）',
        贵人: '三合：兔、羊；六合：虎',
        风险关系: '相冲：蛇；相害：猴；相破：寅；自刑：亥',
        行动建议: '水主容，宜以豁达与积累并行；顺势之年多遇贵人，逆势之年忌懈怠与拖延。',
    }),
});
/** B2 note_year_relation.templates['有利关系']（favorableRelations 计算为空时的兜底文案） */
const FAVORABLE_RELATION_TEMPLATE = '流年天干五行与你的生肖本气相生相成，整体气场较为和顺，宜把握顺势而为的窗口。';
function assertZodiacAnnualCopyTable() {
    const required = ['本气五行', '贵人', '风险关系', '行动建议'];
    const missingZodiac = ZODIACS.filter((name) => !ZODIAC_ANNUAL_COPY[name]);
    const missingFields = ZODIACS.filter((name) => {
        const entry = ZODIAC_ANNUAL_COPY[name];
        return !entry || required.some((field) => !String(entry[field] || '').trim());
    });
    if (missingZodiac.length || missingFields.length) {
        throw new Error(`B2 生肖流年确定性文案不完整：缺生肖${missingZodiac.join('、') || '无'}；字段缺失/为空${missingFields.join('、') || '无'}`);
    }
}
assertZodiacAnnualCopyTable();
/** 生肖是否犯太岁（年支视角） */
export function getTaiSuiConflicts(zodiacBranch, yearBranch) {
    try {
        getBranchIndex(zodiacBranch);
    }
    catch {
        throw new Error(`生肖地支无效：${zodiacBranch}`);
    }
    try {
        getBranchIndex(yearBranch);
    }
    catch {
        throw new Error(`流年地支无效：${yearBranch}`);
    }
    const out = [];
    if (zodiacBranch === yearBranch) {
        out.push({
            type: '值太岁',
            with: yearBranch,
            desc: '本命年，环境变化与自我要求容易放大，重要事项多做复核。',
        });
    }
    if (isLiuchong(zodiacBranch, yearBranch)) {
        out.push({
            type: '冲太岁',
            with: yearBranch,
            desc: '岁冲，变动和对立感容易增加，适合预留调整空间。',
        });
    }
    if (isSanxing(zodiacBranch, yearBranch)) {
        out.push({
            type: '刑太岁',
            with: yearBranch,
            desc: '相刑，规则、沟通和重复摩擦需要更仔细处理。',
        });
    }
    if (isLiuhai(zodiacBranch, yearBranch)) {
        out.push({
            type: '害太岁',
            with: yearBranch,
            desc: '相害，信息差、边界不清和间接影响值得留意。',
        });
    }
    if (isLiupo(zodiacBranch, yearBranch)) {
        out.push({
            type: '破太岁',
            with: yearBranch,
            desc: '相破，计划容易出现小缺口，需提前检查资源和约定。',
        });
    }
    return out;
}
/** 流年值年太岁 */
export function getYearTaiSui(yearGanZhi) {
    if (!isValidGanZhi(yearGanZhi)) {
        throw new Error(`流年干支无效：${yearGanZhi}`);
    }
    const star = TAI_SUI_STARS[yearGanZhi];
    if (!star)
        throw new Error(`太岁星君数据缺失：${yearGanZhi}`);
    return { yearBranch: yearGanZhi[1], star };
}
function resolveZodiacBranch(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError('zodiac 必须是生肖名称或十二地支。');
    }
    const normalized = value.trim();
    if (EARTHLY_BRANCHES.includes(normalized))
        return normalized;
    const index = ZODIACS.findIndex((name) => name === normalized);
    if (index >= 0)
        return EARTHLY_BRANCHES[index];
    throw new TypeError(`无法识别的生肖或地支：${normalized}。`);
}
function resolveYearGanZhi(input) {
    const year = input.year;
    if (year !== undefined && (!Number.isSafeInteger(year) || year < 1900 || year > 2200)) {
        throw new RangeError('year 必须是 1900-2200 之间的整数。');
    }
    const derived = year === undefined
        ? undefined
        : // 2 月 10 日一定在立春之后，可稳定取得该公历流年的年柱。
            getGanZhiFromDate(new Date(year, 1, 10, 12, 0, 0)).year;
    if (input.yearGanZhi !== undefined) {
        const value = input.yearGanZhi.trim();
        if (!isValidGanZhi(value))
            throw new TypeError(`yearGanZhi 不是有效的六十甲子：${value}。`);
        if (derived !== undefined && derived !== value) {
            throw new RangeError(`year 与 yearGanZhi 不一致：${year} 年为 ${derived}。`);
        }
        return value;
    }
    if (derived === undefined) {
        throw new TypeError('生肖流年必须提供 year 或 yearGanZhi。');
    }
    return derived;
}
function getElementRelation(yearStemWuxing, zodiacWuxing) {
    if (isSheng(yearStemWuxing, zodiacWuxing)) {
        return {
            kind: '年干生生肖',
            label: '年干五行生生肖地支本气',
            classification: '有利关系',
            yearStemWuxing,
            zodiacWuxing,
        };
    }
    if (isSheng(zodiacWuxing, yearStemWuxing)) {
        return {
            kind: '生肖生年干',
            label: '生肖地支本气生年干五行',
            classification: '风险关系',
            yearStemWuxing,
            zodiacWuxing,
        };
    }
    if (isKe(yearStemWuxing, zodiacWuxing)) {
        return {
            kind: '年干克生肖',
            label: '年干五行克生肖地支本气',
            classification: '风险关系',
            yearStemWuxing,
            zodiacWuxing,
        };
    }
    if (isKe(zodiacWuxing, yearStemWuxing)) {
        return {
            kind: '生肖克年干',
            label: '生肖地支本气克年干五行',
            classification: '中性关系',
            yearStemWuxing,
            zodiacWuxing,
        };
    }
    return {
        kind: '同类',
        label: '年干五行与生肖地支本气同类',
        classification: '中性关系',
        yearStemWuxing,
        zodiacWuxing,
    };
}
function getSanhuiRelation(zodiacBranch, yearBranch) {
    if (zodiacBranch === yearBranch)
        return null;
    const group = Object.entries(SANHUI_GROUPS).find(([, members]) => members.includes(zodiacBranch) && members.includes(yearBranch));
    return group ? `三会关系（${group[0]}）` : null;
}
/** 生肖流年运程 */
export function getZodiacYearFortune(zodiacBranch, yearGanZhi) {
    const taiSui = getYearTaiSui(yearGanZhi);
    const yearBranch = taiSui.yearBranch;
    const zodiacIdx = EARTHLY_BRANCHES.indexOf(zodiacBranch);
    if (zodiacIdx < 0)
        throw new Error(`生肖地支无效：${zodiacBranch}`);
    const zodiac = ZODIACS[zodiacIdx];
    const conflicts = getTaiSuiConflicts(zodiacBranch, yearBranch);
    const yearStemWuxing = getStemWuxing(yearGanZhi[0]);
    const zodiacWuxing = getBranchWuxing(zodiacBranch);
    const elementRelation = getElementRelation(yearStemWuxing, zodiacWuxing);
    const relation = elementRelation.label;
    let noble = null;
    if (isLiuhe(zodiacBranch, yearBranch))
        noble = '六合贵人';
    else {
        const sanhe = BRANCH_SANHE[zodiacBranch];
        if (sanhe?.partners.includes(yearBranch))
            noble = `三合贵人（${sanhe.group}）`;
    }
    const meeting = getSanhuiRelation(zodiacBranch, yearBranch);
    const favorableRelations = [
        noble ? noble : '',
        elementRelation.classification === '有利关系' ? relation : '',
    ].filter(Boolean);
    const riskRelations = [
        ...conflicts.map((conflict) => `${conflict.type}：${conflict.desc}`),
        elementRelation.classification === '风险关系' ? relation : '',
    ].filter(Boolean);
    const actionSignals = [
        conflicts.some((item) => item.type === '冲太岁') ? '重大变动前预留备选方案' : '',
        conflicts.some((item) => item.type === '值太岁') ? '重要决定多做一轮现实复核' : '',
        conflicts.some((item) => item.type === '刑太岁') ? '合同、规则和沟通内容尽量留痕' : '',
        noble ? '有合作或求助机会时，优先看对方是否真正可靠' : '',
    ].filter(Boolean);
    const resultBase = {
        zodiacBranch,
        zodiac,
        yearGanZhi,
        yearBranch,
        relation,
        elementRelation,
        noble,
        meeting,
        conflicts,
        evidenceGrade: '轻量',
        interpretationBoundary: '仅限生肖与流年关系',
        favorableRelations,
        riskRelations,
        actionSignals,
    };
    const evidenceAnalysis = analyzeZodiacEvidence(resultBase);
    const prompt = [
        `【生肖与流年关系简析】`,
        `${zodiac}（${zodiacBranch}）遇${yearGanZhi}年（${taiSui.star}太岁）。`,
        `五行关系：流年年干${yearGanZhi[0]}属${yearStemWuxing}，生肖地支${zodiacBranch}属${zodiacWuxing}，${relation}。`,
        noble ? `贵人：${noble}。` : '',
        meeting ? `三会关系：${meeting}` : '',
        conflicts.length
            ? `太岁关系：${conflicts
                .map((conflict) => {
                const relationLabel = {
                    值太岁: '同支',
                    冲太岁: '相冲',
                    刑太岁: '相刑',
                    害太岁: '相害',
                    破太岁: '相破',
                };
                return `${conflict.type}（生肖年支${zodiacBranch}与流年年支${conflict.with}${relationLabel[conflict.type]}）`;
            })
                .join('；')}`
            : '太岁关系：未命中值、冲、刑、害、破关系。',
        '信息范围：仅使用出生年支与流年干支进行关系分类。',
    ]
        .filter(Boolean)
        .join('\n');
    // BUG-003（B2 确定性文案接入）：对计算未覆盖的空白字段做回填，保证
    // noble / favorableRelations / riskRelations / actionSignals / 本气五行 永不为空。
    // 注意：evidenceAnalysis / prompt 已在上方按“未命中”的原始计算结果生成——
    // 回填仅补充面向展示的字段，不把固定文案伪装成流年关系命中。
    // 贵人优先级：流年命中六合/三合(引擎计算) > B2 贵人(此处回填) > 天乙贵人(server.mjs 最终兜底)。
    const annualCopy = ZODIAC_ANNUAL_COPY[zodiac];
    if (annualCopy) {
        if (!resultBase.noble && annualCopy.贵人) resultBase.noble = annualCopy.贵人;
        if (!resultBase.favorableRelations.length) resultBase.favorableRelations.push(FAVORABLE_RELATION_TEMPLATE);
        if (!resultBase.riskRelations.length && annualCopy.风险关系) {
            resultBase.riskRelations.push(...annualCopy.风险关系.split('；').map((text) => text.trim()).filter(Boolean));
        }
        if (!resultBase.actionSignals.length && annualCopy.行动建议) resultBase.actionSignals.push(annualCopy.行动建议);
        // 顶层 zodiacWuxing 为 B2 展示文案（如“水（子）”，含地支本气）；
        // elementRelation.zodiacWuxing 保持机读五行（如“水”），二者不重复职责。
        resultBase.zodiacWuxing = annualCopy.本气五行 || zodiacWuxing;
    }
    return {
        ...resultBase,
        evidenceAnalysis,
        prompt,
    };
}
/** 从前端常用的“生肖/年支 + 公历年”输入直接生成生肖流年结果。 */
export function calculateZodiacYearFortune(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('生肖流年参数必须是对象。');
    }
    return getZodiacYearFortune(resolveZodiacBranch(input.zodiac), resolveYearGanZhi(input));
}
export const zodiac = {
    TAI_SUI_STARS,
    getTaiSuiConflicts,
    getYearTaiSui,
    getZodiacYearFortune,
    calculateZodiacYearFortune,
};
