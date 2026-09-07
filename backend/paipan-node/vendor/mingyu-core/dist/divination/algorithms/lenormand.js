import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random.js';
import { attachResultMeta } from '../../shared/result.js';
import { analyzeLenormandEvidence } from '../lenormand-evidence.js';
export { analyzeLenormandEvidence, conditionLenormandTraditionalText } from '../lenormand-evidence.js';
export const LENORMAND_CARDS = [
    {
        id: 1,
        name: '骑士',
        keywords: ['消息', '到来', '进展'],
        meaning: '消息抵达，事情开始移动。',
        theme: '动态与讯息',
        detail: '象征新动静的抵达，事情开始向前移动；多指消息、来访或某项进展的临近，宜留意近期出现的信号。',
    },
    {
        id: 2,
        name: '三叶草',
        keywords: ['机会', '短暂好运', '轻松'],
        meaning: '短期机会出现，宜快不宜拖。',
        theme: '短暂好运',
        detail: '代表轻巧而至的运气与片刻欢愉，宜把握但勿过度依赖；好运来得快，往往也去得快。',
    },
    {
        id: 3,
        name: '船',
        keywords: ['远方', '变化', '出行'],
        meaning: '有距离、迁移或方向转换。',
        theme: '距离与迁移',
        detail: '指向远方、出行或状态的转换，可指旅行、异地关系或环境的改变；宜以开放之心迎接变化。',
    },
    {
        id: 4,
        name: '房子',
        keywords: ['家庭', '稳定', '根基'],
        meaning: '关注安全感、住所和基础条件。',
        theme: '居所与安全',
        detail: '象征家庭、不动产与内心的安全感，关注根基与归属；宜在稳定中养护身边最亲近的关系。',
    },
    {
        id: 5,
        name: '树',
        keywords: ['成长', '健康', '长期'],
        meaning: '事情发展较慢，但有长期根系。',
        theme: '生命力与积淀',
        detail: '代表缓慢而扎实的生长，常与健康、家族或长期积累相关；宜给时间以耐心，根基越深越稳。',
    },
    {
        id: 6,
        name: '云',
        keywords: ['不明朗', '混乱', '遮蔽'],
        meaning: '信息不清，需要先辨别真假。',
        theme: '迷雾与存疑',
        detail: '提示局面暂不明朗，信息或有遮蔽；雾终会散，宜先辨清再下判断，不必急于定论。',
    },
    {
        id: 7,
        name: '蛇',
        keywords: ['复杂', '诱惑', '迂回'],
        meaning: '关系或路径有绕行与隐藏动机。',
        theme: '暗流与智识',
        detail: '传统读为欺骗与纠葛，亦可解为看穿复杂、辨认暗流之智；宜自问：此事有什么我尚未看清？',
    },
    {
        id: 8,
        name: '棺材',
        keywords: ['结束', '停滞', '转折'],
        meaning: '旧阶段需要收尾，不能强行续命。',
        theme: '阶段的落幕',
        detail: '象征一个段落的结束与转化，空出的位置才装得下新的；宜坦然放下早已走完的事。',
    },
    {
        id: 9,
        name: '花束',
        keywords: ['喜悦', '礼物', '好感'],
        meaning: '有善意、邀请或被认可的机会。',
        theme: '善意与美好',
        detail: '代表善意、邀约或被认可的时刻，宜欣然承接；也提示以礼物般的心意经营关系。',
    },
    {
        id: 10,
        name: '镰刀',
        keywords: ['切断', '突发', '决断'],
        meaning: '快速分割或突然变化，需要果断。',
        theme: '果断与收割',
        detail: '象征快速而明确的切割，或突然而至的转折；宜在犹豫处给一个干净利落的决定。',
    },
    {
        id: 11,
        name: '鞭子',
        keywords: ['争执', '重复', '压力'],
        meaning: '反复拉扯，容易因沟通产生摩擦。',
        theme: '反复与消耗',
        detail: '代表反复出现的拉扯、争执或消耗性模式；宜识别那件不断磨耗你的事，并设法止住。',
    },
    {
        id: 12,
        name: '鸟',
        keywords: ['沟通', '焦虑', '讨论'],
        meaning: '消息频繁，但情绪也容易放大。',
        theme: '交流与喧响',
        detail: '象征消息往来、对话或社交噪声，情绪易被放大；宜多沟通，也别让闲言乱了心神。',
    },
    {
        id: 13,
        name: '孩子',
        keywords: ['新开始', '单纯', '试探'],
        meaning: '事情尚早，适合从小步尝试。',
        theme: '初生与萌芽',
        detail: '代表新开始、纯真或尚早的阶段；宜以小步试水，不必急于求成，保持一份天真与可塑。',
    },
    {
        id: 14,
        name: '狐狸',
        keywords: ['策略', '警惕', '工作'],
        meaning: '需要看清利益结构，避免被套路。',
        theme: '机变与分寸',
        detail: '象征机巧、谋略与工作实务，也提醒辨明利益结构、谨防套路；宜清醒应对，不轻易托付。',
    },
    {
        id: 15,
        name: '熊',
        keywords: ['力量', '资源', '保护'],
        meaning: '资源和权力是关键，也可能有人强势介入。',
        theme: '权能与护持',
        detail: '代表资源、权威与保护之力，也可能指强势者的介入；宜善用手中的底气，也尊重他人的分量。',
    },
    {
        id: 16,
        name: '星星',
        keywords: ['希望', '愿景', '网络'],
        meaning: '目标感增强，远景或线上资源有帮助。',
        theme: '方向与指引',
        detail: '象征希望、目标感与远景，也常指线上或远程的助力；宜让愿景成为前行的罗盘。',
    },
    {
        id: 17,
        name: '鹳',
        keywords: ['变化', '迁移', '改善'],
        meaning: '适合调整环境，局势有改善空间。',
        theme: '焕新与迁徙',
        detail: '代表环境的调整与向好的迁移，如搬家、转岗或关系的新阶段；宜主动优化所处的土壤。',
    },
    {
        id: 18,
        name: '狗',
        keywords: ['忠诚', '朋友', '支持'],
        meaning: '可信任的人或长期关系会提供支持。',
        theme: '情谊与信赖',
        detail: '象征可信赖的人、友谊与长期支持；宜珍惜身边忠诚的陪伴，也以同等的真诚回馈。',
    },
    {
        id: 19,
        name: '塔',
        keywords: ['机构', '隔离', '规则'],
        meaning: '制度、边界或距离感是重点。',
        theme: '边界与体制',
        detail: '代表机构、规则或刻意的疏离与边界；宜理解制度与距离的存在，必要时保持专业的距离感。',
    },
    {
        id: 20,
        name: '花园',
        keywords: ['社交', '公开', '圈层'],
        meaning: '事情会进入公开场域或社交圈。',
        theme: '公共与社群',
        detail: '象征进入公开场域、社交圈或公众视野；宜把握露脸与连接的机会，也留意圈层中的口碑。',
    },
    {
        id: 21,
        name: '山',
        keywords: ['阻碍', '延迟', '困难'],
        meaning: '推进受阻，需要绕路或等待。',
        theme: '阻滞与等待',
        detail: '代表推进中的阻碍或暂缓，宜绕路或耐心等待时机；山不是终点，只是需要更稳的步伐。',
    },
    {
        id: 22,
        name: '路',
        keywords: ['选择', '分岔', '决定'],
        meaning: '关键在选择路径，不能两头都要。',
        theme: '抉择与方向',
        detail: '象征站在岔路口，关键在选哪条路，宜看清各选项的代价，不贪两头。',
    },
    {
        id: 23,
        name: '老鼠',
        keywords: ['消耗', '损失', '焦虑'],
        meaning: '小问题会持续消耗，需要止损。',
        theme: '侵蚀与流失',
        detail: '代表缓慢而持续的消耗，或小事累积成的损失；宜及早止损，别让蚁穴拖垮堤坝。',
    },
    {
        id: 24,
        name: '心',
        keywords: ['感情', '喜欢', '热情'],
        meaning: '情感动机强，适合看真实心意。',
        theme: '情感与意愿',
        detail: '象征真实的情感动机与在意之事；宜倾听内心真正所向，让心意成为判断的准星。',
    },
    {
        id: 25,
        name: '戒指',
        keywords: ['承诺', '契约', '循环'],
        meaning: '关系、合同或重复模式成为主轴。',
        theme: '约定与联结',
        detail: '代表承诺、合同或不断回环的关系与模式；宜重视白纸黑字的约定，也守住对他人的诺言。',
    },
    {
        id: 26,
        name: '书',
        keywords: ['秘密', '知识', '未知'],
        meaning: '仍有未公开信息，需继续了解。',
        theme: '隐学与前因',
        detail: '象征尚未公开的知识、秘密或需进一步了解的事；宜保持好奇，也尊重有些事暂不宜揭开。',
    },
    {
        id: 27,
        name: '信',
        keywords: ['文本', '通知', '文件'],
        meaning: '书面消息、通知或证据很重要。',
        theme: '文书与凭证',
        detail: '代表书面消息、通知或具效力的文件；宜重视文字往来与证据，关键事宜落到纸面更稳。',
    },
    {
        id: 28,
        name: '男士',
        keywords: ['男性', '主动方', '本人'],
        meaning: '男性角色或主动方成为焦点。',
        theme: '阳性与主动',
        detail: '指男性角色或主动、主导的一方（问者本人为男时多指自身）；宜关注其在事件中的姿态。',
    },
    {
        id: 29,
        name: '女士',
        keywords: ['女性', '接收方', '本人'],
        meaning: '女性角色或接收方成为焦点。',
        theme: '阴性与承接',
        detail: '指女性角色或接收、承载的一方（问者本人为女时多指自身）；宜关注其在事件中的感受。',
    },
    {
        id: 30,
        name: '百合',
        keywords: ['成熟', '平和', '伦理'],
        meaning: '需要成熟处理，重视体面与长期安稳。',
        theme: '沉静与体面',
        detail: '象征成熟、平和与对分寸的尊重，也常指年长或稳重之人；宜以从容与体面处理长久之事。',
    },
    {
        id: 31,
        name: '太阳',
        keywords: ['成功', '清晰', '能量'],
        meaning: '局势转明，推进条件增强。',
        theme: '光明与顺遂',
        detail: '代表局势转明、能量充沛与可期的成果；宜借这束光把事情推向明朗的完成。',
    },
    {
        id: 32,
        name: '月亮',
        keywords: ['情绪', '名声', '直觉'],
        meaning: '情绪和外界评价会影响判断。',
        theme: '情绪与他人观感',
        detail: '象征情绪潮汐、外界的评价与直觉；宜倾听内在感受，也留意自己在他人眼中的样子。',
    },
    {
        id: 33,
        name: '钥匙',
        keywords: ['答案', '突破', '关键'],
        meaning: '关键条件出现，问题有解。',
        theme: '解锁与枢机',
        detail: '代表关键条件的出现、问题的答案或突破口；宜抓住那把对的钥匙，顺势解开困局。',
    },
    {
        id: 34,
        name: '鱼',
        keywords: ['金钱', '流动', '资源'],
        meaning: '钱、资源和流动性是重点。',
        theme: '财富与丰盛',
        detail: '象征金钱、资源与流动性，也指生意与丰饶；宜让资源活起来，也别被短期的丰盈迷了眼。',
    },
    {
        id: 35,
        name: '锚',
        keywords: ['稳定', '工作', '坚持'],
        meaning: '稳定和长期承诺能带来结果。',
        theme: '定力与坚守',
        detail: '代表稳定、长期承诺与可依靠的坚持；宜把根扎深，以恒心换来真正的结果。',
    },
    {
        id: 36,
        name: '十字架',
        keywords: ['压力', '宿命感', '责任'],
        meaning: '责任较重，需要承担代价或接受现实。',
        theme: '担当与试炼',
        detail: '象征较重的责任、必须承担的代价或一段试炼；宜把担子化为前行的重量，而非压垮自己的石头。',
    },
];
export const LENORMAND_SPREADS = {
    single: { name: '单牌线索', positions: ['核心线索'] },
    three: { name: '三牌事件线', positions: ['起因', '现状', '走向'] },
    five: {
        name: '五牌十字阵',
        positions: ['过去背景', '当前处境', '隐藏因素', '外在助力', '最终走向'],
    },
    relationship: {
        name: '关系牌阵',
        positions: ['你的状态', '对方状态', '关系纽带', '隐藏因素', '后续走向'],
    },
    decision: {
        name: '选择牌阵',
        positions: ['当前处境', '选择A', '选择A走向', '选择B', '选择B走向', '关键建议'],
    },
    nine: {
        name: '九宫牌阵',
        positions: ['左上', '上方', '右上', '左侧', '核心', '右侧', '左下', '下方', '右下'],
    },
    element: {
        name: '元素牌阵',
        positions: ['火（行动/能量）', '水（情感/直觉）', '风（思维/沟通）', '土（物质/根基）'],
    },
    grandTableau: {
        name: '大桌牌阵',
        positions: Array.from({ length: 36 }, (_, i) => {
            const card = LENORMAND_CARDS[i];
            if (!card)
                throw new Error(`雷诺曼第${i + 1}宫缺少对应宫位牌`);
            return `第${i + 1}宫（${card.name}宫）`;
        }),
    },
};
function assertInteractiveSample(sample, index) {
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new Error(`第${index + 1}个雷诺曼抽牌随机样本无效`);
    }
}
/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export function resolveInteractiveLenormandCards(spreadType, samples) {
    const spread = LENORMAND_SPREADS[spreadType];
    if (!spread)
        throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
    if (samples.length > spread.positions.length) {
        throw new Error(`${spread.name}最多抽取${spread.positions.length}张牌`);
    }
    samples.forEach(assertInteractiveSample);
    const remaining = [...LENORMAND_CARDS];
    return samples.map((sample) => {
        const index = Math.floor(sample * remaining.length);
        const card = remaining.splice(index, 1)[0];
        if (!card)
            throw new Error(`第${remaining.length + 1}张雷诺曼抽牌无法映射到剩余牌组`);
        return card;
    });
}
function shuffleCards(rng) {
    const shuffled = [...LENORMAND_CARDS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(i + 1, rng);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
/**
 * 雷诺曼牌组两牌组合含义（为配对解读提供传统关键词）
 * 如 "太阳+鱼" = 财运好、"鞭子+鼠" = 消耗性争执
 */
export const LENORMAND_FIXED_COMBINATIONS = {
    '骑士+心': '消息带来感情进展',
    '心+戒指': '感情的承诺或婚约',
    '心+花束': '被人喜欢或表白',
    '心+百合': '成熟的感情关系',
    '戒指+花束': '订婚或喜讯',
    '戒指+房子': '家庭契约/购房',
    '花束+花园': '社交上受到欢迎',
    '房子+锚': '稳定安家',
    '锚+星星': '目标明确并趋于稳定',
    '星星+月亮': '直觉准确的时期',
    '月亮+太阳': '从迷茫走向清晰',
    '蛇+狐狸': '欺骗与策略',
    '云+蛇': '隐藏在迷雾中的欺骗',
    '棺材+十字架': '沉重的结束与考验',
    '镰刀+棺材': '突然的结束/切割',
    '老鼠+十字架': '消耗性的压力',
    '鱼+星星': '通过网络/远程获利',
    '鱼+船': '跨国或远距离财运',
    '船+鹳': '改善环境的搬迁',
    '书+信': '秘密文件或消息',
    '钥匙+心': '关键的情感答案',
    '狗+花束': '朋友的善意',
    '孩子+房子': '家庭添丁',
    '塔+山': '制度性阻碍',
    '路+十字架': '两难选择',
    '鸟+蛇': '流言蜚语',
    '鞭子+鸟': '争吵与焦虑',
    '熊+鱼': '资源或资金充裕',
    '树+心': '深厚的感情基础',
};
function getFixedCombinationMeaning(firstName, secondName) {
    return (LENORMAND_FIXED_COMBINATIONS[`${firstName}+${secondName}`] ??
        LENORMAND_FIXED_COMBINATIONS[`${secondName}+${firstName}`] ??
        null);
}
function getGridCombinationCandidates(cards) {
    cards.forEach((card, index) => {
        if (!card.row || !card.column) {
            throw new Error(`雷诺曼网格牌阵第${index + 1}张缺少行列坐标`);
        }
    });
    return cards.flatMap((first, firstIndex) => cards.slice(firstIndex + 1).flatMap((second) => {
        const rowDistance = Math.abs(first.row - second.row);
        const columnDistance = Math.abs(first.column - second.column);
        if (rowDistance > 1 || columnDistance > 1 || (rowDistance === 0 && columnDistance === 0)) {
            return [];
        }
        return [
            {
                first,
                second,
                rowDistance,
                columnDistance,
                relation: rowDistance === 0
                    ? '横向相邻'
                    : columnDistance === 0
                        ? '纵向相邻'
                        : '对角相邻',
            },
        ];
    }));
}
function buildLenormandCombinations(spreadType, cards) {
    const candidates = spreadType === 'nine' || spreadType === 'grandTableau'
        ? getGridCombinationCandidates(cards)
        : cards.slice(1).map((second, index) => ({
            first: cards[index],
            second,
            rowDistance: 0,
            columnDistance: 0,
            relation: '牌序相邻',
        }));
    return candidates.flatMap(({ first, second, relation, rowDistance, columnDistance }) => {
        const fixedMeaning = getFixedCombinationMeaning(first.name, second.name);
        const isPersonNeighborhood = spreadType === 'grandTableau' &&
            (first.name === '男士' ||
                first.name === '女士' ||
                second.name === '男士' ||
                second.name === '女士');
        if (spreadType === 'grandTableau' && !fixedMeaning && !isPersonNeighborhood) {
            return [];
        }
        const isSequential = relation === '牌序相邻';
        const meaning = fixedMeaning ??
            (isSequential
                ? `${first.position}${first.name}的“${first.keywords.slice(0, 2).join('、')}”与${second.position}${second.name}的“${second.keywords.slice(0, 2).join('、')}”前后相接，先按${first.meaning}，再看${second.meaning}`
                : `${first.position}${first.name}与${second.position}${second.name}为${relation}，互参“${first.keywords.slice(0, 2).join('、')}”与“${second.keywords.slice(0, 2).join('、')}”两组线索`);
        const combination = {
            card1: first.name,
            card2: second.name,
            position1: first.position,
            position2: second.position,
            relation,
            rowDistance,
            columnDistance,
            meaning,
            source: fixedMeaning ? '固定组合' : '相邻牌义合读',
        };
        return [combination];
    });
}
export function validateLenormandReferenceData() {
    const ids = LENORMAND_CARDS.map((card) => card.id);
    const names = LENORMAND_CARDS.map((card) => card.name);
    if (LENORMAND_CARDS.length !== 36 ||
        ids.some((id, index) => id !== index + 1) ||
        new Set(ids).size !== 36 ||
        new Set(names).size !== 36) {
        throw new Error('雷诺曼牌组必须按 1-36 完整登记且牌号、牌名不重复');
    }
    if (LENORMAND_SPREADS.grandTableau.positions.length !== 36 ||
        LENORMAND_SPREADS.grandTableau.positions.some((position) => position.includes('未知'))) {
        throw new Error('雷诺曼大桌必须完整登记 36 个同序宫位');
    }
    for (const pair of Object.keys(LENORMAND_FIXED_COMBINATIONS)) {
        const namesInPair = pair.split('+');
        if (namesInPair.length !== 2 ||
            namesInPair.some((name) => !names.includes(name)) ||
            namesInPair[0] === namesInPair[1]) {
            throw new Error(`雷诺曼固定组合引用无效牌名：${pair}`);
        }
    }
}
validateLenormandReferenceData();
/**
 * 抽取雷诺曼牌阵
 *
 * 支持 single（单牌）、three（三张）、relationship（感情）、
 * decision（决策）、nine（九宫格）等 8 种牌阵。
 * 抽牌为随机洗牌，每次独立。
 *
 * @param spreadType 牌阵类型，默认 'single'。
 * @returns 雷诺曼牌阵数据对象 LenormandData，含牌面、位置和两牌组合含义。
 *
 * @example
 * ```ts
 * const result = drawLenormandSpread('single');
 * // result 包含 cards（牌面列表）和 combinations（组合含义）
 * ```
 */
export function drawLenormandSpread(spreadType = 'single', options) {
    const spread = LENORMAND_SPREADS[spreadType];
    if (!spread) {
        throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
    }
    const manualCardIds = options?.manualCardIds;
    const interactiveSamples = options?.interactiveSamples;
    if (manualCardIds && interactiveSamples) {
        throw new Error('雷诺曼手动抽取不能同时提供手工录入牌面');
    }
    if (interactiveSamples && hasRandomOptions(options)) {
        throw new Error('雷诺曼手动抽取样本不能同时提供随机选项');
    }
    if (interactiveSamples && interactiveSamples.length !== spread.positions.length) {
        throw new Error(`${spread.name}需要逐张抽取${spread.positions.length}张牌`);
    }
    if (manualCardIds && hasRandomOptions(options)) {
        throw new Error('手工录入雷诺曼牌时不能同时提供随机选项');
    }
    if (manualCardIds && manualCardIds.length !== spread.positions.length) {
        throw new Error(`${spread.name}需要按牌位录入${spread.positions.length}张牌`);
    }
    if (manualCardIds && new Set(manualCardIds).size !== manualCardIds.length) {
        throw new Error('同一次雷诺曼牌阵不能重复录入同一张牌');
    }
    const context = manualCardIds || interactiveSamples ? null : createRandomContext(options);
    const selectedCards = manualCardIds
        ? manualCardIds.map((id, index) => {
            const card = LENORMAND_CARDS.find((item) => item.id === id);
            if (!card)
                throw new Error(`第${index + 1}张雷诺曼牌录入无效`);
            return card;
        })
        : interactiveSamples
            ? resolveInteractiveLenormandCards(spreadType, interactiveSamples)
            : shuffleCards(context.random).slice(0, spread.positions.length);
    const cards = selectedCards.map((card, index) => {
        const columns = spreadType === 'grandTableau' ? 9 : spreadType === 'nine' ? 3 : 0;
        const houseCard = spreadType === 'grandTableau' ? LENORMAND_CARDS[index] : undefined;
        if (spreadType === 'grandTableau' && !houseCard) {
            throw new Error(`雷诺曼第${index + 1}宫缺少对应宫位牌`);
        }
        return {
            ...card,
            position: spread.positions[index],
            house: houseCard?.name,
            row: columns ? Math.floor(index / columns) + 1 : undefined,
            column: columns ? (index % columns) + 1 : undefined,
        };
    });
    const combinations = buildLenormandCombinations(spreadType, cards);
    const layoutEvidence = [];
    if (spreadType === 'nine') {
        const center = cards[4];
        layoutEvidence.push(`中心牌${center.name}是九宫主轴；上排为背景与思考，中排为当下，下排为落地走向`);
        layoutEvidence.push(`横向：${cards
            .slice(3, 6)
            .map((card) => card.name)
            .join('→')}；纵向：${[cards[1], cards[4], cards[7]].map((card) => card.name).join('→')}`);
        layoutEvidence.push(`对角线：${[cards[0], cards[4], cards[8]].map((card) => card.name).join('→')}；${[cards[2], cards[4], cards[6]].map((card) => card.name).join('→')}`);
    }
    if (spreadType === 'grandTableau') {
        const keyCards = ['男士', '女士'];
        keyCards.forEach((name) => {
            const index = cards.findIndex((card) => card.name === name);
            if (index < 0)
                return;
            const card = cards[index];
            const neighbors = cards.filter((candidate) => {
                if (!candidate.row || !candidate.column || !card.row || !card.column)
                    return false;
                const rowDistance = Math.abs(candidate.row - card.row);
                const columnDistance = Math.abs(candidate.column - card.column);
                return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
            });
            layoutEvidence.push(`${name}落第${index + 1}宫（${card.house}宫，第${card.row}排第${card.column}列）；近身牌${neighbors.map((item) => item.name).join('、')}`);
        });
        const houseMatches = cards.filter((card) => card.house === card.name);
        if (houseMatches.length) {
            layoutEvidence.push(`归宫牌：${houseMatches.map((card) => `${card.name}回到本宫`).join('、')}`);
        }
    }
    const timestamp = Date.now();
    const draw = {
        deckSize: LENORMAND_CARDS.length,
        method: manualCardIds
            ? '用户按牌位手工录入'
            : interactiveSamples
                ? '用户逐张触发前端随机抽取'
                : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
        order: cards.map((card, index) => ({
            index: index + 1,
            position: card.position,
            cardId: card.id,
            cardName: card.name,
            house: card.house,
            row: card.row,
            column: card.column,
        })),
    };
    const result = attachResultMeta({
        spreadType,
        spreadName: spread.name,
        draw,
        cards,
        combinations,
        layoutEvidence,
        timestamp,
    }, {
        algorithm: manualCardIds
            ? 'lenormand.spread.manual'
            : interactiveSamples
                ? 'lenormand.spread.interactive'
                : 'lenormand.spread',
        input: manualCardIds ? { spreadType, manualCardIds } : { spreadType },
        calculatedAt: timestamp,
        ...(context
            ? { random: context.getTrace() }
            : interactiveSamples
                ? { random: { mode: 'system', samples: [...interactiveSamples] } }
                : {}),
    });
    return { ...result, evidenceAnalysis: analyzeLenormandEvidence(result) };
}
