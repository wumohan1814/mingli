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

/**
 * BUG-003 第二轮（C1 五行关系文案；来源：docs/文案交付-第二轮/C1_zodiac_element_relations.json，
 * UTF-8 原文逐字收录，共 12 生肖 × 5 关系标签 = 60 条）。
 * 键 = 关系标签（严格对齐 getElementRelation 输出的 label），值 = 该生肖的固定解读文案；
 * 文案不点名流年天干具体五行（交付口径），引擎按 relation 纯查表，
 * 结果顶层 relationCopy 供前端中段「五行关系明细」区展示（查无则空串）。
 * 纯确定性、零 LLM、零新依赖，不含内部字段名（不受 stripInternal 影响）。
 */
const ZODIAC_ELEMENT_RELATION_COPY = Object.freeze({
    鼠: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之水，如源头活水相济，整体气场较为和顺，宜把握顺势而为的窗口，借力成事。',
        生肖地支本气生年干五行: '你生肖本气之水外泄以生流年天干五行，主付出与消耗，宜量力而行、忌过度铺陈，凡事预留回转余地。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之水，如堤外有压，阻力或隐现，宜稳守根基、预留缓冲，不与大势硬碰。',
        生肖地支本气克年干五行: '你生肖本气之水克制流年天干五行，主你掌握主动，然克中亦有耗，宜张弛有度、顺势收束，忌得理不饶人。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，气场相合、少有牵扯，宜顺势而为、忌节外生枝，平稳之中亦要守住节奏。',
    }),
    牛: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之土，如雨润厚壤，承载之力渐足，宜深耕守成、广积而稳发，忌贪多冒进。',
        生肖地支本气生年干五行: '你生肖本气之土外泄以生流年天干五行，主资源与信用的让渡，宜量入为出、忌竭泽而渔，守稳方能长久。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之土，如风蚀丘垄，根基受扰或松懈，宜固本培元、以静制动，勿轻移其重。',
        生肖地支本气克年干五行: '你生肖本气之土克制流年天干五行，主你镇守得当、化散为聚，然负重亦深，宜分责共担、忌独扛硬扛。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，厚土相叠、安稳少波，宜积跬步至千里、忌空转虚耗，扎实便有回响。',
    }),
    虎: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之木，如春风拂条，生发之势顺遂，宜主动开拓、借势向前，但忌冒进无根。',
        生肖地支本气生年干五行: '你生肖本气之木外泄以生流年天干五行，主精力与资源的输出，宜专注要务、忌四面出击，留得根基方能长青。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之木，如风折新枝，成长受阻或反复，宜沉淀内修、以柔化刚，待时而动。',
        生肖地支本气克年干五行: '你生肖本气之木克制流年天干五行，主你破局有力，然克伐亦伤己，宜谋定后动、与人和济，忌孤行独断。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，同气相求、少有掣肘，宜合力共进、忌内耗相争，顺势便见生机。',
    }),
    兔: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之木，如春风拂条，生发之势顺遂，宜主动开拓、借势向前，但忌冒进无根。',
        生肖地支本气生年干五行: '你生肖本气之木外泄以生流年天干五行，主精力与资源的输出，宜专注要务、忌四面出击，留得根基方能长青。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之木，如风折新枝，成长受阻或反复，宜沉淀内修、以柔化刚，待时而动。',
        生肖地支本气克年干五行: '你生肖本气之木克制流年天干五行，主你破局有力，然克伐亦伤己，宜谋定后动、与人和济，忌孤行独断。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，同气相求、少有掣肘，宜合力共进、忌内耗相争，顺势便见生机。',
    }),
    龙: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之土，如雨润厚壤，承载之力渐足，宜深耕守成、广积而稳发，忌贪多冒进。',
        生肖地支本气生年干五行: '你生肖本气之土外泄以生流年天干五行，主资源与信用的让渡，宜量入为出、忌竭泽而渔，守稳方能长久。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之土，如风蚀丘垄，根基受扰或松懈，宜固本培元、以静制动，勿轻移其重。',
        生肖地支本气克年干五行: '你生肖本气之土克制流年天干五行，主你镇守得当、化散为聚，然负重亦深，宜分责共担、忌独扛硬扛。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，厚土相叠、安稳少波，宜积跬步至千里、忌空转虚耗，扎实便有回响。',
    }),
    蛇: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之火，如添薪助焰，明彻之势得彰，宜以洞察破局、借光前行，忌虚火张扬。',
        生肖地支本气生年干五行: '你生肖本气之火外泄以生流年天干五行，主热忱与势能的输出，宜张弛有节、忌燃尽无续，留一分余温。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之火，如水浇烈焰，势头受抑或转暗，宜收敛锋芒、谋定后动，勿强求出头。',
        生肖地支本气克年干五行: '你生肖本气之火克制流年天干五行，主你照亮局面、主导节奏，然灼亦自损，宜控温守度、忌灼人误己。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，焰色相映、彼此成全，宜并肩同行、忌争辉相夺，火候到自见光明。',
    }),
    马: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之火，如添薪助焰，明彻之势得彰，宜以洞察破局、借光前行，忌虚火张扬。',
        生肖地支本气生年干五行: '你生肖本气之火外泄以生流年天干五行，主热忱与势能的输出，宜张弛有节、忌燃尽无续，留一分余温。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之火，如水浇烈焰，势头受抑或转暗，宜收敛锋芒、谋定后动，勿强求出头。',
        生肖地支本气克年干五行: '你生肖本气之火克制流年天干五行，主你照亮局面、主导节奏，然灼亦自损，宜控温守度、忌灼人误己。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，焰色相映、彼此成全，宜并肩同行、忌争辉相夺，火候到自见光明。',
    }),
    羊: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之土，如雨润厚壤，承载之力渐足，宜深耕守成、广积而稳发，忌贪多冒进。',
        生肖地支本气生年干五行: '你生肖本气之土外泄以生流年天干五行，主资源与信用的让渡，宜量入为出、忌竭泽而渔，守稳方能长久。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之土，如风蚀丘垄，根基受扰或松懈，宜固本培元、以静制动，勿轻移其重。',
        生肖地支本气克年干五行: '你生肖本气之土克制流年天干五行，主你镇守得当、化散为聚，然负重亦深，宜分责共担、忌独扛硬扛。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，厚土相叠、安稳少波，宜积跬步至千里、忌空转虚耗，扎实便有回响。',
    }),
    猴: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之金，如淬火得砺，锐气渐成，宜以专业精进、借势成形，忌锋芒过露。',
        生肖地支本气生年干五行: '你生肖本气之金外泄以生流年天干五行，主机变与精力的倾注，宜务实聚焦、忌散而无力，留钢于刃。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之金，如锤下受锻，承压或受挫，宜韧性以对、化压为器，勿折于一时。',
        生肖地支本气克年干五行: '你生肖本气之金克制流年天干五行，主你裁断有力、破碍有功，然刚极易折，宜刚柔并济、忌苛责逼人。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，金声相和、彼此成锋，宜同心协力、忌内斗相销，磨砺见真章。',
    }),
    鸡: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之金，如淬火得砺，锐气渐成，宜以专业精进、借势成形，忌锋芒过露。',
        生肖地支本气生年干五行: '你生肖本气之金外泄以生流年天干五行，主机变与精力的倾注，宜务实聚焦、忌散而无力，留钢于刃。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之金，如锤下受锻，承压或受挫，宜韧性以对、化压为器，勿折于一时。',
        生肖地支本气克年干五行: '你生肖本气之金克制流年天干五行，主你裁断有力、破碍有功，然刚极易折，宜刚柔并济、忌苛责逼人。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，金声相和、彼此成锋，宜同心协力、忌内斗相销，磨砺见真章。',
    }),
    狗: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之土，如雨润厚壤，承载之力渐足，宜深耕守成、广积而稳发，忌贪多冒进。',
        生肖地支本气生年干五行: '你生肖本气之土外泄以生流年天干五行，主资源与信用的让渡，宜量入为出、忌竭泽而渔，守稳方能长久。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之土，如风蚀丘垄，根基受扰或松懈，宜固本培元、以静制动，勿轻移其重。',
        生肖地支本气克年干五行: '你生肖本气之土克制流年天干五行，主你镇守得当、化散为聚，然负重亦深，宜分责共担、忌独扛硬扛。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，厚土相叠、安稳少波，宜积跬步至千里、忌空转虚耗，扎实便有回响。',
    }),
    猪: Object.freeze({
        年干五行生生肖地支本气: '流年天干五行生旺你生肖本气之水，如源头活水相济，整体气场较为和顺，宜把握顺势而为的窗口，借力成事。',
        生肖地支本气生年干五行: '你生肖本气之水外泄以生流年天干五行，主付出与消耗，宜量力而行、忌过度铺陈，凡事预留回转余地。',
        年干五行克生肖地支本气: '流年天干五行克制你生肖本气之水，如堤外有压，阻力或隐现，宜稳守根基、预留缓冲，不与大势硬碰。',
        生肖地支本气克年干五行: '你生肖本气之水克制流年天干五行，主你掌握主动，然克中亦有耗，宜张弛有度、顺势收束，忌得理不饶人。',
        年干五行与生肖地支本气同类: '流年五行与生肖本气同类比和，气场相合、少有牵扯，宜顺势而为、忌节外生枝，平稳之中亦要守住节奏。',
    }),
});
function assertC1ElementRelationCopyTable() {
    // 由 getElementRelation 对 5×5 五行有序组合的输出反推标签全集，
    // 保证文案键与引擎关系标签严格一致（引擎侧改标签 → 此处立即抛错）。
    const wuxing = ['木', '火', '土', '金', '水'];
    const engineLabels = [...new Set(wuxing.flatMap((a) => wuxing.map((b) => getElementRelation(a, b).label)))];
    if (engineLabels.length !== 5) {
        throw new Error(`C1 关系标签全集异常（应为 5 个，实际 ${engineLabels.length} 个）`);
    }
    const missing = ZODIACS.filter((name) => {
        const entry = ZODIAC_ELEMENT_RELATION_COPY[name];
        if (!entry)
            return true;
        const keys = Object.keys(entry);
        if (keys.length !== engineLabels.length)
            return true;
        return engineLabels.some((label) => !(label in entry) || !String(entry[label] || '').trim());
    });
    if (missing.length) {
        throw new Error(`C1 生肖五行关系文案不完整（缺生肖/缺标签/文案为空）：${missing.join('、')}`);
    }
}
assertC1ElementRelationCopyTable();

/**
 * BUG-003 第二轮（C2 贵人静态解读；来源：docs/文案交付-第二轮/C2_zodiac_noble.json，
 * UTF-8 原文逐字收录：12 生肖六合/三合的 partner(s) + 一句话 explain
 * （解释关系之「质」的软性措辞，不点名流年命中），以及该生肖天乙贵人固定 note；
 * TIANYI_NOBLE_BY_GAN = C2 tianyiByGan[年干] → “生肖、生肖”。
 * 纯确定性、零 LLM、零新依赖，不含内部字段名。
 */
const ZODIAC_NOBLE_COPY = Object.freeze({
    鼠: Object.freeze({
        六合: Object.freeze({ partner: '牛', explain: '鼠与牛六合，机敏配沉稳，牛的笃定能安住鼠的思虑，是共担实务、互补长短的稳固搭档。' }),
        三合: Object.freeze({ partners: '猴、龙', explain: '鼠与猴、龙三合水局，三者皆灵动善谋，聚则思路开阔、转圜有余，利于协作与借势成事。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    牛: Object.freeze({
        六合: Object.freeze({ partner: '鼠', explain: '牛与鼠六合，踏实遇机巧，鼠的灵活能松动牛的固执，是务实推进、彼此兜底的组合。' }),
        三合: Object.freeze({ partners: '蛇、鸡', explain: '牛与蛇、鸡三合金局，三者皆重秩序与成效，聚则条理分明、稳步积累，利于守成与精进。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    虎: Object.freeze({
        六合: Object.freeze({ partner: '猪', explain: '虎与猪六合，刚勇遇宽厚，猪的包容能柔化虎的锋芒，是敢闯敢担、后顾有依的搭配。' }),
        三合: Object.freeze({ partners: '马、狗', explain: '虎与马、狗三合火局，三者皆热情重义，聚则行动果决、相互壮胆，利于开拓与担当。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    兔: Object.freeze({
        六合: Object.freeze({ partner: '狗', explain: '兔与狗六合，温婉遇忠诚，狗的守护能安住兔的敏感，是细致体贴、彼此照应的组合。' }),
        三合: Object.freeze({ partners: '猪、羊', explain: '兔与猪、羊三合木局，三者皆温和包容，聚则氛围松弛、少有冲撞，利于维系与滋养。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    龙: Object.freeze({
        六合: Object.freeze({ partner: '鸡', explain: '龙与鸡六合，恢弘遇精致，鸡的明察能补齐龙的粗线条，是宏大构想配上落地细节的搭档。' }),
        三合: Object.freeze({ partners: '猴、鼠', explain: '龙与猴、鼠三合水局，三者皆善谋多变，聚则格局开阔、点子不断，利于布局与变通。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    蛇: Object.freeze({
        六合: Object.freeze({ partner: '猴', explain: '蛇与猴六合，深沉遇灵巧，猴的机变能激活蛇的谋略，是静中藏动、互为臂助的组合。' }),
        三合: Object.freeze({ partners: '鸡、牛', explain: '蛇与鸡、牛三合金局，三者皆重分寸与积累，聚则沉稳有度、步步为营，利于深耕与守成。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    马: Object.freeze({
        六合: Object.freeze({ partner: '羊', explain: '马与羊六合，奔放遇温厚，羊的柔顺能收束马的躁进，是驰骋有度、彼此安抚的搭配。' }),
        三合: Object.freeze({ partners: '虎、狗', explain: '马与虎、狗三合火局，三者皆直率重情，聚则意气风发、相互策应，利于冲刺与结盟。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    羊: Object.freeze({
        六合: Object.freeze({ partner: '马', explain: '羊与马六合，温润遇昂扬，马的劲头能带动羊的迟疑，是柔和中有方向、彼此助力的组合。' }),
        三合: Object.freeze({ partners: '猪、兔', explain: '羊与猪、兔三合木局，三者皆平和包容，聚则气息相融、少生龃龉，利于涵养与协作。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    猴: Object.freeze({
        六合: Object.freeze({ partner: '蛇', explain: '猴与蛇六合，灵动遇沉静，蛇的定力能稳住猴的飘忽，是机变不失章法、互为补益的搭档。' }),
        三合: Object.freeze({ partners: '鼠、龙', explain: '猴与鼠、龙三合水局，三者皆善思善变，聚则智计绵密、腾挪有方，利于谋划与破局。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    鸡: Object.freeze({
        六合: Object.freeze({ partner: '龙', explain: '鸡与龙六合，精细遇恢弘，龙的格局能托起鸡的考究，是细节嵌入宏图、彼此成全的组合。' }),
        三合: Object.freeze({ partners: '蛇、牛', explain: '鸡与蛇、牛三合金局，三者皆讲究分寸与成效，聚则稳健扎实、循序渐进，利于打磨与积累。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    狗: Object.freeze({
        六合: Object.freeze({ partner: '兔', explain: '狗与兔六合，忠诚遇温婉，兔的细腻能柔化狗的硬朗，是守护中有体贴、彼此安心的搭配。' }),
        三合: Object.freeze({ partners: '虎、马', explain: '狗与虎、马三合火局，三者皆重情重义，聚则肝胆相照、共赴一事，利于结盟与进取。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
    猪: Object.freeze({
        六合: Object.freeze({ partner: '虎', explain: '猪与虎六合，宽厚遇刚勇，虎的冲劲能带动猪的松弛，是包容中有担当、彼此倚仗的组合。' }),
        三合: Object.freeze({ partners: '兔、羊', explain: '猪与兔、羊三合木局，三者皆温润少争，聚则安和顺遂、相互濡养，利于经营与守成。' }),
        天乙贵人: Object.freeze({ note: '天乙贵人随出生年天干而定（见下方「天乙贵人·按年干」表），并非固定属相，故不单列于本属相之下。' }),
    }),
});
const TIANYI_NOBLE_BY_GAN = Object.freeze({
    甲: '牛、羊',
    戊: '牛、羊',
    庚: '牛、羊',
    乙: '鼠、猴',
    己: '鼠、猴',
    丙: '猪、鸡',
    丁: '猪、鸡',
    壬: '兔、蛇',
    癸: '兔、蛇',
    辛: '马、虎',
});
function assertC2NobleCopyTable() {
    const requiredSections = [
        ['六合', ['partner', 'explain']],
        ['三合', ['partners', 'explain']],
        ['天乙贵人', ['note']],
    ];
    const missingZodiac = ZODIACS.filter((name) => !ZODIAC_NOBLE_COPY[name]);
    const missingFields = ZODIACS.filter((name) => {
        const entry = ZODIAC_NOBLE_COPY[name];
        if (!entry)
            return false;
        for (const [section, fields] of requiredSections) {
            const sub = entry[section];
            if (!sub)
                return true;
            if (fields.some((field) => !String(sub[field] || '').trim()))
                return true;
        }
        return false;
    });
    const stems = '甲乙丙丁戊己庚辛壬癸'.split('');
    const missingGan = stems.filter((gan) => !String(TIANYI_NOBLE_BY_GAN[gan] || '').trim());
    // 一致性校验：六合 partner 与三合 partners 须与引擎地支固定关系表一致（C2 交付口径“严格对齐”）。
    const relationMismatch = ZODIACS.filter((name, idx) => {
        const entry = ZODIAC_NOBLE_COPY[name];
        if (!entry)
            return false;
        const branch = EARTHLY_BRANCHES[idx];
        const partnerBranch = EARTHLY_BRANCHES[ZODIACS.indexOf(entry['六合'].partner)];
        if (!partnerBranch || !isLiuhe(branch, partnerBranch))
            return true;
        const c2Sanhe = entry['三合'].partners.split('、')
            .map((z) => EARTHLY_BRANCHES[ZODIACS.indexOf(z)])
            .sort()
            .join(',');
        const engineSanhe = [...BRANCH_SANHE[branch].partners].sort().join(',');
        return c2Sanhe !== engineSanhe;
    });
    if (missingZodiac.length || missingFields.length || missingGan.length || relationMismatch.length) {
        throw new Error(`C2 贵人静态解读不完整：缺生肖${missingZodiac.join('、') || '无'}；字段缺失/为空${missingFields.join('、') || '无'}；年干缺${missingGan.join('、') || '无'}；六合/三合与引擎不一致${relationMismatch.join('、') || '无'}`);
    }
}
assertC2NobleCopyTable();

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
    // C2 贵人静态解读：nobleHit 记录“引擎计算命中”的贵人关系（六合/三合）。
    // 与 B2 静态回填的 noble 文本区分开：只有真正的流年命中才带出 C2 对应 explain。
    let nobleHit = null;
    if (isLiuhe(zodiacBranch, yearBranch)) {
        noble = '六合贵人';
        nobleHit = '六合';
    }
    else {
        const sanhe = BRANCH_SANHE[zodiacBranch];
        if (sanhe?.partners.includes(yearBranch)) {
            noble = `三合贵人（${sanhe.group}）`;
            nobleHit = '三合';
        }
    }
    // BUG-003（C2 确定性文案接入）：nobleDetail = 该生肖贵人关系的固定解读：
    // - 六合/三合：仅当 nobleHit 命中（引擎计算，非 B2 回填）时，带上 C2 对应 partner(s) + explain；
    // - 天乙贵人：无论是否命中都带 C2 该生肖的 note，并按流年年干查 C2 tianyiByGan
    //   （如 2026 丙年 → “猪、鸡”）得到 partners；对应年干查无则仅带 note。判空兜底为 {}
    const nobleDetail = {};
    const nobleCopy = ZODIAC_NOBLE_COPY[zodiac];
    if (nobleCopy) {
        if (nobleHit === '六合' && nobleCopy['六合']?.explain) {
            nobleDetail['六合'] = { partner: nobleCopy['六合'].partner || '', explain: nobleCopy['六合'].explain };
        }
        else if (nobleHit === '三合' && nobleCopy['三合']?.explain) {
            nobleDetail['三合'] = { partners: nobleCopy['三合'].partners || '', explain: nobleCopy['三合'].explain };
        }
        const note = nobleCopy['天乙贵人']?.note || '';
        if (note) {
            const byYearGan = TIANYI_NOBLE_BY_GAN[yearGanZhi[0]] || '';
            nobleDetail['天乙贵人'] = byYearGan ? { note, partners: byYearGan } : { note };
        }
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
        // BUG-003 第二轮（C1/C2 确定性文案接入，纯查表、零 LLM）：
        // relationCopy = C1 按 elementRelation.label（即 relation）查该生肖的固定解读文案，
        //   供前端中段「五行关系明细」区展示；查无为空串，不点名流年天干具体五行。
        // nobleDetail = C2 贵人静态解读（见上方构造逻辑），判空兜底为 {}
        nobleDetail,
        relationCopy: (ZODIAC_ELEMENT_RELATION_COPY[zodiac] && ZODIAC_ELEMENT_RELATION_COPY[zodiac][relation]) || '',
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
