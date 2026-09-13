/**
 * 命理 · 自研排盘内核 · 规则源：塔罗牌义（正文数据）
 * ---------------------------------------------------------------------------
 * 本文件是塔罗**牌义正文的唯一权威位置**（与 rules/tarot.js 的盘面事实分开：
 * 那边管 id/牌名/牌位/发牌，这边管每张牌的正文与关键词）。
 *
 * == 来源登记 ==
 *   - 全部正文（upright / reversedText / 各关键词 / element / archetype）为
 *     **本内核自撰**（按牌组传统主题从零生成），不是任何既有资料的复制或改写。
 *   - 传统主题事实（权杖=火、圣杯=水、宝剑=风、钱币=土；大阿卡纳为人生主轴；
 *     数字与宫廷牌的发展阶段）属**公有领域传统牌组结构**，据此定 element / archetype。
 *   - 文案风格：中性陈述 + 行动提示；不下绝对吉凶结论（不写「必然会」「一定是」）。
 */

import { deepFreeze } from './tarot.js';

/** 花色 → element 文本（大阿卡纳单列）。 */
export const TAROT_ELEMENTS = deepFreeze({
  wands: '火（行动与热情）',
  cups: '水（情感与关系）',
  swords: '风（思维与沟通）',
  pentacles: '土（现实与资源）',
  major: '大阿卡纳（人生课题与阶段）',
});

/** 牌阶/宫廷/大阿卡纳 → archetype 文本（见下方固定表，逐字照用，不许自创别种写法）。 */
export const TAROT_ARCHETYPES = deepFreeze({
  major: '大阿卡纳·人生主轴',
  王牌: '牌阶·起点与契机',
  二: '牌阶·成对与权衡',
  三: '牌阶·成长与协作',
  四: '牌阶·稳定与结构',
  五: '牌阶·冲突与失衡',
  六: '牌阶·调和与回馈',
  七: '牌阶·评估与坚持',
  八: '牌阶·推进与熟练',
  九: '牌阶·临界与自省',
  十: '牌阶·圆满与转换',
  侍者: '宫廷·学习与消息',
  骑士: '宫廷·行动与推进',
  王后: '宫廷·内在成熟与滋养',
  国王: '宫廷·外在掌控与责任',
});

/** 78 张牌正文：键为牌 id（1–78）。 */
export const TAROT_MEANINGS = deepFreeze({
  // ── 大阿卡纳（id 1–22：人生课题与阶段） ──────────────────────────────
  1: { upright: '代表轻装出发与未知的开端，宜先小步试探，把好奇心当作向导。', reversedText: '心意未定而贸然行动，宜停下来补足准备，别把冲动当作勇敢。', uprightKeywords: ['启程', '纯粹', '冒险'], reversedKeywords: ['莽撞', '迟疑', '失控'], keywords: ['新的开始', '可能性', '自由'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  2: { upright: '代表手边已有可用的工具与能力，宜主动出手，把想法落成第一个具体动作。', reversedText: '能力被闲置或用力过头，宜先校准目标，谨防自说自话式的消耗。', uprightKeywords: ['主动', '整合', '技巧'], reversedKeywords: ['虚饰', '拖延', '误用'], keywords: ['创造', '资源', '意志'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  3: { upright: '代表静默中的直觉与潜藏信息，宜少说多听，让答案在安静里浮现。', reversedText: '直觉被喧闹盖住或过度封闭，宜回到可靠的依据，别把猜测当定论。', uprightKeywords: ['直觉', '沉静', '潜藏'], reversedKeywords: ['封闭', '多疑', '失察'], keywords: ['内在智慧', '等待', '秘密'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  4: { upright: '代表丰盛与滋养的力量，宜善待身体与关系，让成果自然生长。', reversedText: '付出过满或照护缺位，宜把精力收回自身，先补足再给予。', uprightKeywords: ['丰盛', '滋养', '创造'], reversedKeywords: ['耗竭', '依赖', '忽略'], keywords: ['孕育', '感官', '包容'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  5: { upright: '代表秩序与担当，宜立下清晰的规则与边界，用稳定换来信任。', reversedText: '掌控过头或权威松动，宜松手一点，把规定改成可执行的约定。', uprightKeywords: ['权威', '秩序', '稳固'], reversedKeywords: ['僵化', '专断', '失守'], keywords: ['责任', '结构', '父亲'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  6: { upright: '代表传统经验与可循的路径，宜请教前辈或查阅既有规范，少走弯路。', reversedText: '旧规矩不再合用或盲目从众，宜分辨哪些约束已失效，再自行定夺。', uprightKeywords: ['传统', '指引', '规范'], reversedKeywords: ['教条', '迎合', '脱轨'], keywords: ['信念体系', '教诲', '归属'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  7: { upright: '代表关系中的连结与需要做的选择，宜听从真实心意，并承担选择的代价。', reversedText: '价值冲突或关系失衡，宜把分歧摊开谈，别用回避维持表面和平。', uprightKeywords: ['连结', '抉择', '共鸣'], reversedKeywords: ['摇摆', '失衡', '逃避'], keywords: ['爱与选择', '契合', '价值'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  8: { upright: '代表以意志驾驭方向，宜集中目标全力推进，同时握稳手里的缰绳。', reversedText: '方向失控或用力过猛，宜减压并重设路线，避免硬闯带来的消耗。', uprightKeywords: ['意志', '推进', '掌控'], reversedKeywords: ['脱轨', '躁进', '受阻'], keywords: ['胜利', '前行', '自律'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  9: { upright: '代表以柔韧化解强硬，宜用耐心与善意驯服内在的冲动。', reversedText: '信心不足或硬撑逞强，宜承认疲惫，先安抚自己再面对外部。', uprightKeywords: ['柔韧', '勇气', '耐心'], reversedKeywords: ['逞强', '气馁', '易怒'], keywords: ['内在力量', '自制', '包容'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  10: { upright: '代表向内探寻与独处的需要，宜暂离喧闹，把经验整理成自己的判断。', reversedText: '过度封闭或拒绝反思，宜与可信的人交换看法，别独自绕圈。', uprightKeywords: ['独处', '内省', '求索'], reversedKeywords: ['孤僻', '回避', '迷失'], keywords: ['指引之光', '沉淀', '探究'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  11: { upright: '代表周期轮转与时机变化，宜顺着趋势调整位置，把握转机出现的窗口。', reversedText: '时机未到或反复受挫，宜接受暂缓，把节奏放慢等待条件成熟。', uprightKeywords: ['转机', '周期', '时机'], reversedKeywords: ['停滞', '逆流', '反复'], keywords: ['命运流转', '机遇', '因果'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  12: { upright: '代表公平的衡量与应负的责任，宜按事实与规则行事，结论自会站得住。', reversedText: '标准失衡或回避责任，宜重新核对事实，别用偏袒换取一时安宁。', uprightKeywords: ['公正', '权衡', '责任'], reversedKeywords: ['偏倚', '迟疑', '失准'], keywords: ['因果', '真相', '平衡'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  13: { upright: '代表主动的停顿与视角转换，宜先放下成见，换个位置看同一件事。', reversedText: '拖延太久或牺牲无谓，宜分清必要的等待与纯粹的消耗。', uprightKeywords: ['换位', '暂停', '放舍'], reversedKeywords: ['拖延', '白费', '执拗'], keywords: ['视角转换', '等待', '献出'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  14: { upright: '代表旧阶段自然结束，宜如实告别不再适用的部分，为新生腾出位置。', reversedText: '抗拒改变或收尾拖沓，宜先处理未了之事，别让旧关系继续牵扯。', uprightKeywords: ['终结', '蜕变', '清空'], reversedKeywords: ['滞留', '抗拒', '纠缠'], keywords: ['转变', '放下', '新生'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  15: { upright: '代表调和的火候与分寸，宜取中道而行，让不同的部分慢慢融合。', reversedText: '节奏失调或过度混杂，宜回到基本作息，把注意力放回一件事。', uprightKeywords: ['调和', '节度', '耐心'], reversedKeywords: ['失衡', '急躁', '过量'], keywords: ['中庸', '融合', '疗愈'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  16: { upright: '代表被欲望或习惯牵制的处境，宜看清牵绊的真实成本，再决定是否松手。', reversedText: '牵绊松动但反复回拉，宜用可行的小替代方案，逐步削弱旧习惯。', uprightKeywords: ['束缚', '欲望', '沉迷'], reversedKeywords: ['反复', '挣脱', '拉扯'], keywords: ['执着', '诱惑', '阴影'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  17: { upright: '代表结构被突然打破，宜先接受既成事实，再从废墟上重建更稳的地基。', reversedText: '危机被延后或勉强维持，宜主动修补松动之处，别等它自行坍塌。', uprightKeywords: ['崩解', '突变', '觉醒'], reversedKeywords: ['拖延', '隐患', '侥幸'], keywords: ['结构瓦解', '真相', '重建'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  18: { upright: '代表风波之后的希望与疗愈，宜踏实休养，继续做那些看似微小的事。', reversedText: '信心低落或期待落空，宜把目标缩小到可完成的一步，避免自弃。', uprightKeywords: ['希望', '疗愈', '坦荡'], reversedKeywords: ['失望', '消沉', '迷惘'], keywords: ['指引', '复原', '信念'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  19: { upright: '代表模糊不清与情绪起伏，宜承认不安，用事实核对代替胡思乱想。', reversedText: '迷雾渐散或错觉消退，宜记录真实进展，稳住刚恢复的清醒。', uprightKeywords: ['迷雾', '不安', '幻象'], reversedKeywords: ['渐明', '惊觉', '平复'], keywords: ['潜意识', '情绪波动', '隐忧'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  20: { upright: '代表明朗的成果与活力，宜把好消息分享出去，也留出休息的余地。', reversedText: '光热过盛或兴致减退，宜降低消耗，找回简单的快乐来源。', uprightKeywords: ['明朗', '活力', '成功'], reversedKeywords: ['过热', '疲软', '浮夸'], keywords: ['喜悦', '光热', '真诚'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  21: { upright: '代表阶段性的总结与新召唤，宜回看走过的路，再对下一步给出明确答复。', reversedText: '该回应时仍在拖延，宜处理未结的旧账，别让犹疑拖长空转。', uprightKeywords: ['觉醒', '总结', '召唤'], reversedKeywords: ['拖延', '自责', '空转'], keywords: ['更新', '裁决', '回应'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  22: { upright: '代表一个循环的圆满收束，宜为已完成的事做记录，再开启更大的舞台。', reversedText: '收尾未竟或缺少临门一脚，宜补齐最后环节，别急着跳到下一件。', uprightKeywords: ['圆满', '完成', '整合'], reversedKeywords: ['未竟', '迟到', '缺环'], keywords: ['终点', '成就', '整体'], element: '大阿卡纳（人生课题与阶段）', archetype: '大阿卡纳·人生主轴' },
  // ── 权杖（id 23–36：火，行动与热情） ────────────────────────────────
  23: { upright: '代表新的热忱与行动契机，宜趁热立下第一个小目标，马上开始。', reversedText: '热情起不来或起步散乱，宜缩小范围，先从最容易的一件事入手。', uprightKeywords: ['热忱', '契机', '开端'], reversedKeywords: ['乏力', '散乱', '搁置'], keywords: ['灵感火花', '动能', '尝试'], element: '火（行动与热情）', archetype: '牌阶·起点与契机' },
  24: { upright: '代表站在既有成果上向外眺望，宜比较可行路径，为扩展做初步规划。', reversedText: '眼界受限或迟迟不决，宜先取回可控的小进展，别只停在设想。', uprightKeywords: ['远望', '规划', '取舍'], reversedKeywords: ['短视', '观望', '退缩'], keywords: ['视野', '抉择', '领地'], element: '火（行动与热情）', archetype: '牌阶·成对与权衡' },
  25: { upright: '代表布局已成只待时机，宜保持耐心，同时维持与外部的联络。', reversedText: '进程延误或方向偏离，宜核准航线，别让等待变成放任。', uprightKeywords: ['远景', '布局', '等待'], reversedKeywords: ['延误', '偏差', '松散'], keywords: ['拓展', '通商', '前瞻'], element: '火（行动与热情）', archetype: '牌阶·成长与协作' },
  26: { upright: '代表阶段性的安顿与庆贺，宜稍作休息，与共同付出的人分享成果。', reversedText: '根基未稳或庆祝过早，宜先修补基础，把仪式留到真正安定之后。', uprightKeywords: ['安顿', '庆祝', '和睦'], reversedKeywords: ['未稳', '虚热闹', '失和'], keywords: ['归属', '家园', '稳固'], element: '火（行动与热情）', archetype: '牌阶·稳定与结构' },
  27: { upright: '代表多方角力与意见冲撞，宜把竞争导向具体事务，先论做法再论立场。', reversedText: '内耗增加或回避冲突，宜定下议事规则，让分歧有一个出口。', uprightKeywords: ['竞争', '冲撞', '角力'], reversedKeywords: ['内耗', '回避', '混战'], keywords: ['较量', '分歧', '多方拉锯'], element: '火（行动与热情）', archetype: '牌阶·冲突与失衡' },
  28: { upright: '代表努力获得认可与信任，宜接受掌声但保持谦逊，把势头用在下一步。', reversedText: '认可不足或虚名过重，宜以实际结果换取信任，别依赖外部评价。', uprightKeywords: ['认可', '凯旋', '自信'], reversedKeywords: ['虚名', '轻敌', '失信'], keywords: ['荣誉', '进展', '众望'], element: '火（行动与热情）', archetype: '牌阶·调和与回馈' },
  29: { upright: '代表在有利位置上守住阵地，宜坚定回应挑战，不必退让也无需硬碰。', reversedText: '疲于应付或立场动摇，宜判断哪些战场值得守，及时收拢力量。', uprightKeywords: ['坚守', '应对', '立场'], reversedKeywords: ['疲软', '动摇', '失守'], keywords: ['防守', '勇气', '位置'], element: '火（行动与热情）', archetype: '牌阶·评估与坚持' },
  30: { upright: '代表进展突然加快，宜顺势推进要事，把节奏用在最关键的一环。', reversedText: '进度卡顿或消息延迟，宜核对沟通环节，别因急躁反而返工。', uprightKeywords: ['迅速', '畅行', '消息'], reversedKeywords: ['延迟', '卡顿', '急躁'], keywords: ['加速', '传达', '时机'], element: '火（行动与热情）', archetype: '牌阶·推进与熟练' },
  31: { upright: '代表久战后仍守着最后关口，宜回头核对来路，再决定继续或休整。', reversedText: '戒备过重或心力交瘁，宜放下不必要的防备，先恢复体力。', uprightKeywords: ['警戒', '坚韧', '经验'], reversedKeywords: ['疲倦', '多疑', '透支'], keywords: ['最后防线', '坚持', '防御'], element: '火（行动与热情）', archetype: '牌阶·临界与自省' },
  32: { upright: '代表责任压顶仍坚持前行，宜盘点手头任务，把能分出去的分出去。', reversedText: '负担超出承受或拒绝卸下，宜明确说不，避免硬撑到难以收拾。', uprightKeywords: ['重担', '承担', '疲惫'], reversedKeywords: ['超载', '硬撑', '放手'], keywords: ['负荷', '责任', '临近终点'], element: '火（行动与热情）', archetype: '牌阶·圆满与转换' },
  33: { upright: '代表初生的热情与探索欲，宜多问多试，把新鲜想法记下来再动手。', reversedText: '兴致易散或听信传闻，宜核实信息来源，别凭一时兴致许诺。', uprightKeywords: ['好奇', '初学', '消息'], reversedKeywords: ['浮躁', '轻信', '半途'], keywords: ['探索', '热情萌芽', '试用'], element: '火（行动与热情）', archetype: '宫廷·学习与消息' },
  34: { upright: '代表带着热忱快速出征，宜锁定一个目标冲刺，同时留意身边人的节奏。', reversedText: '冒进或三分钟热度，宜先做风险评估，让行动配合现实条件。', uprightKeywords: ['冲劲', '出征', '爽快'], reversedKeywords: ['冒进', '善变', '鲁莽'], keywords: ['行动力', '远行', '魄力'], element: '火（行动与热情）', archetype: '宫廷·行动与推进' },
  35: { upright: '代表温暖而有主见的感染力，宜以真诚带动气氛，并守住自己的界限。', reversedText: '情绪外放或自我怀疑，宜先安顿内心，再谈照顾他人。', uprightKeywords: ['感染力', '温暖', '主见'], reversedKeywords: ['善妒', '怨气', '自卑'], keywords: ['魅力', '自信', '关照'], element: '火（行动与热情）', archetype: '宫廷·内在成熟与滋养' },
  36: { upright: '代表成熟的领导与远见，宜带头定下方向，把功劳留给一起做事的人。', reversedText: '强势过头或推卸决断，宜听取异议，用协商代替命令。', uprightKeywords: ['领导', '远见', '果断'], reversedKeywords: ['专横', '急躁', '卸责'], keywords: ['掌舵', '愿景', '担当'], element: '火（行动与热情）', archetype: '宫廷·外在掌控与责任' },
  // ── 圣杯（id 37–50：水，情感与关系） ────────────────────────────────
  37: { upright: '代表情感或灵感的新泉涌，宜接纳这份柔软，并把它化为具体的表达。', reversedText: '情绪被压住或泛滥，宜先辨识真实感受，别用忙碌盖住难过。', uprightKeywords: ['新生情感', '喜悦', '敞开'], reversedKeywords: ['压抑', '泛滥', '空落'], keywords: ['心之泉源', '爱意', '感受'], element: '水（情感与关系）', archetype: '牌阶·起点与契机' },
  38: { upright: '代表彼此吸引与平等往来，宜坦诚表达需要，让关系在互惠中生长。', reversedText: '关系失衡或沟通错位，宜重新核对彼此的期待，别各说各话。', uprightKeywords: ['结盟', '互惠', '吸引'], reversedKeywords: ['错位', '猜忌', '疏远'], keywords: ['伴侣', '合作', '对等'], element: '水（情感与关系）', archetype: '牌阶·成对与权衡' },
  39: { upright: '代表友谊与欢聚的支持，宜与同伴共享成果，为关系留出庆祝的时间。', reversedText: '社交过载或圈子消耗，宜筛掉勉强的应酬，把时间留给真心的人。', uprightKeywords: ['友谊', '欢聚', '共享'], reversedKeywords: ['应酬', '排挤', '过度社交'], keywords: ['团体', '庆祝', '同乐'], element: '水（情感与关系）', archetype: '牌阶·成长与协作' },
  40: { upright: '代表对现状提不起劲，宜先承认倦意，留意手边被忽略的邀约。', reversedText: '情绪停滞开始松动，宜及时接住新出现的机会，别又退回原处。', uprightKeywords: ['倦怠', '无感', '静观'], reversedKeywords: ['松动', '新意', '接住'], keywords: ['不满足', '内省', '转机'], element: '水（情感与关系）', archetype: '牌阶·稳定与结构' },
  41: { upright: '代表失去带来的哀伤，宜允许自己难过一阵，同时看见仍留在手边的部分。', reversedText: '沉溺于遗憾或难以释怀，宜把注意力移回可用资源，逐步走出。', uprightKeywords: ['失落', '悔意', '哀伤'], reversedKeywords: ['沉溺', '难舍', '自责'], keywords: ['遗憾', '接受', '剩余'], element: '水（情感与关系）', archetype: '牌阶·冲突与失衡' },
  42: { upright: '代表旧情与温情的照拂，宜珍视熟悉的支持，也把善意传递下去。', reversedText: '困在过去或依赖旧关系，宜分清怀念与当下，避免用回忆替代现实。', uprightKeywords: ['回忆', '温情', '馈赠'], reversedKeywords: ['恋旧', '依赖', '停驻'], keywords: ['童年', '熟悉感', '关照'], element: '水（情感与关系）', archetype: '牌阶·调和与回馈' },
  43: { upright: '代表众多诱人的选项与想象，宜先分清哪些可兑现，再挑一个开始。', reversedText: '选项过多或自欺，宜删去不现实的期待，回到可执行的一件事。', uprightKeywords: ['想象', '多选项', '诱惑'], reversedKeywords: ['自欺', '茫然', '空转'], keywords: ['幻象', '抉择', '白日梦'], element: '水（情感与关系）', archetype: '牌阶·评估与坚持' },
  44: { upright: '代表主动离开不再满足的局面，宜弄清自己要找什么，再从容转身。', reversedText: '该走未走或反复回头，宜承认已有裂缝，避免长期勉强将就。', uprightKeywords: ['离席', '寻索', '转身'], reversedKeywords: ['拖留', '将就', '反复'], keywords: ['放弃', '远行', '更深满足'], element: '水（情感与关系）', archetype: '牌阶·推进与熟练' },
  45: { upright: '代表心愿达成的满足感，宜安心享受成果，别把幸福建立在比较上。', reversedText: '满足打折或向外索求认可，宜回到真实需求，减少攀比带来的空耗。', uprightKeywords: ['满足', '心愿', '享受'], reversedKeywords: ['空虚', '攀比', '贪求'], keywords: ['如意', '丰足', '知足'], element: '水（情感与关系）', archetype: '牌阶·临界与自省' },
  46: { upright: '代表情感上的圆满与归属，宜与重要的人共享安宁，把关心说明白。', reversedText: '表面和睦或家中张力，宜先处理被搁置的话题，别维持假象。', uprightKeywords: ['归属', '和谐', '幸福'], reversedKeywords: ['疏离', '裂痕', '假象'], keywords: ['家庭', '圆满情感', '安宁'], element: '水（情感与关系）', archetype: '牌阶·圆满与转换' },
  47: { upright: '代表敏感而天真的感受力，宜写下心里冒出的念头，用温和方式表达。', reversedText: '情绪化或逃避现实，宜给感受一个名字，别用幻想代替沟通。', uprightKeywords: ['天真', '感受力', '灵感'], reversedKeywords: ['情绪化', '怯懦', '做梦'], keywords: ['初心', '直觉讯息', '善意'], element: '水（情感与关系）', archetype: '宫廷·学习与消息' },
  48: { upright: '代表带着情意前来的邀约或行动，宜以诚相待，把承诺落到具体安排。', reversedText: '承诺空悬或情绪化推进，宜先分辨真心与冲动，再决定是否同行。', uprightKeywords: ['邀约', '浪漫', '诚意'], reversedKeywords: ['空诺', '善变', '幻灭'], keywords: ['追求', '骑士风度', '情意'], element: '水（情感与关系）', archetype: '宫廷·行动与推进' },
  49: { upright: '代表共情与包容的成熟，宜信任直觉，同时照顾好自身的情绪容量。', reversedText: '情绪受累或过度融入他人，宜为自己设限，先补给再陪伴。', uprightKeywords: ['共情', '包容', '直觉'], reversedKeywords: ['内耗', '界限模糊', '哀怨'], keywords: ['温柔', '体察', '照拂'], element: '水（情感与关系）', archetype: '宫廷·内在成熟与滋养' },
  50: { upright: '代表情绪的稳定掌控，宜以平和回应冲突，用倾听化解对立。', reversedText: '情绪压得过深或操控感受，宜坦白说出需要，别用冷淡表态。', uprightKeywords: ['稳重', '包容力', '调和'], reversedKeywords: ['压抑', '操控', '冷淡'], keywords: ['成熟', '定力', '慈悲'], element: '水（情感与关系）', archetype: '宫廷·外在掌控与责任' },
  // ── 宝剑（id 51–64：风，思维与沟通） ────────────────────────────────
  51: { upright: '代表思路忽然清晰，宜趁清醒定下判断，用一句明确的话切开含糊。', reversedText: '思路混乱或用词伤人，宜先弄清事实，再决定要不要开口。', uprightKeywords: ['清晰', '洞见', '破局'], reversedKeywords: ['混乱', '误判', '口舌'], keywords: ['真相', '突破', '决断'], element: '风（思维与沟通）', archetype: '牌阶·起点与契机' },
  52: { upright: '代表刻意的回避与两难权衡，宜先承认不愿面对的部分，给决定设一个期限。', reversedText: '僵局松动或被迫摊牌，宜准备好信息，别在压力下仓促表态。', uprightKeywords: ['僵持', '权衡', '回避'], reversedKeywords: ['破局', '被动', '信息不足'], keywords: ['两难', '抉择', '悬置'], element: '风（思维与沟通）', archetype: '牌阶·成对与权衡' },
  53: { upright: '代表被事实刺伤的痛感，宜如实说出受伤，让情绪有排出的路径。', reversedText: '旧伤未愈或痛感麻木，宜寻求可信任的陪伴，避免独自硬扛。', uprightKeywords: ['刺痛', '伤心', '真相'], reversedKeywords: ['积压', '麻木', '难释'], keywords: ['心碎', '分离', '承受'], element: '风（思维与沟通）', archetype: '牌阶·成长与协作' },
  54: { upright: '代表需要暂停与休整，宜放下待办清单，先让头脑安静几天。', reversedText: '休息不足或被迫停摆，宜调整作息与节奏，别硬撑到效率归零。', uprightKeywords: ['休息', '静养', '沉淀'], reversedKeywords: ['焦躁', '失眠', '透支'], keywords: ['停顿', '恢复', '清气'], element: '风（思维与沟通）', archetype: '牌阶·稳定与结构' },
  55: { upright: '代表争胜带来的代价，宜评估赢下这一局是否值得，必要时收手。', reversedText: '争执延续或不服输，宜放下要赢的执念，把资源留给重要的事。', uprightKeywords: ['争胜', '算计', '代价'], reversedKeywords: ['记恨', '纠缠', '失和'], keywords: ['冲突', '得失', '退让'], element: '风（思维与沟通）', archetype: '牌阶·冲突与失衡' },
  56: { upright: '代表离开动荡走向平稳，宜带着必要的经验上船，别拖走整片旧岸。', reversedText: '迁移受阻或旧事牵连，宜先处理未了的牵扯，再谈启程。', uprightKeywords: ['过渡', '转移', '平缓'], reversedKeywords: ['滞留', '牵累', '动荡'], keywords: ['远行', '疗愈之旅', '摆渡'], element: '风（思维与沟通）', archetype: '牌阶·调和与回馈' },
  57: { upright: '代表以巧取胜或另有隐情，宜核对对方话语里的空隙，再定应对方式。', reversedText: '隐匿暴露或自我欺骗，宜直面问题本身，别用小聪明绕开。', uprightKeywords: ['策略', '回避', '隐情'], reversedKeywords: ['败露', '自欺', '失信'], keywords: ['取巧', '独行', '周旋'], element: '风（思维与沟通）', archetype: '牌阶·评估与坚持' },
  58: { upright: '代表感觉处处受限，宜先分辨哪些绳索是真的，再动第一步。', reversedText: '束缚开始松动或越挣越紧，宜向外求援，别在脑中反复推演。', uprightKeywords: ['受限', '自缚', '无力感'], reversedKeywords: ['解缚', '求援', '松动'], keywords: ['困境', '视野受限', '恐惧'], element: '风（思维与沟通）', archetype: '牌阶·推进与熟练' },
  59: { upright: '代表夜半的焦虑与反复思虑，宜把担心写成清单，逐条分清真假。', reversedText: '焦虑加深或已现转机，宜借助专业支持，别独自消化所有恐惧。', uprightKeywords: ['焦虑', '失眠', '忧思'], reversedKeywords: ['深陷', '无助', '惊惶'], keywords: ['恐惧', '内耗', '午夜'], element: '风（思维与沟通）', archetype: '牌阶·临界与自省' },
  60: { upright: '代表事情走到最低处，宜接受这一轮已经结束，让新的开始有机会。', reversedText: '余波未平或难以下咽，宜处理收尾与告别，别反复回想当初。', uprightKeywords: ['触底', '终结', '痛楚'], reversedKeywords: ['余波', '难舍', '复原中'], keywords: ['结束', '谷底', '重启'], element: '风（思维与沟通）', archetype: '牌阶·圆满与转换' },
  61: { upright: '代表敏锐的观察与求知，宜多问多想，先核实再下结论。', reversedText: '言语轻率或窥探成瘾，宜把好奇心用在正处，避免散播未证消息。', uprightKeywords: ['敏锐', '求知', '观察'], reversedKeywords: ['八卦', '多疑', '轻率'], keywords: ['警觉', '学习', '探问'], element: '风（思维与沟通）', archetype: '宫廷·学习与消息' },
  62: { upright: '代表以言辞或速度直取目标，宜先对齐事实，再全力出击。', reversedText: '急躁冲突或话不择言，宜放慢一步，把论点排成条目再说。', uprightKeywords: ['果断', '疾行', '直言'], reversedKeywords: ['急躁', '挑衅', '失言'], keywords: ['冲锋', '效率', '气势'], element: '风（思维与沟通）', archetype: '宫廷·行动与推进' },
  63: { upright: '代表清醒的判断与独立，宜用事实说话，也留一分体谅给他人处境。', reversedText: '苛刻或情绪化判断，宜检查标准是否公平，别用冷淡保护自己。', uprightKeywords: ['清醒', '独立', '洞察'], reversedKeywords: ['苛刻', '尖刻', '冷硬'], keywords: ['理性', '界限', '诚实'], element: '风（思维与沟通）', archetype: '宫廷·内在成熟与滋养' },
  64: { upright: '代表成熟的理智与决断，宜以原则服人，把复杂问题拆成可执行的步骤。', reversedText: '理智用于压制或决断失当，宜听取不同的证据，避免用道理代替倾听。', uprightKeywords: ['理智', '权威', '决断'], reversedKeywords: ['强辩', '独断', '冷漠'], keywords: ['公正判断', '逻辑', '秩序'], element: '风（思维与沟通）', archetype: '宫廷·外在掌控与责任' },
  // ── 钱币（id 65–78：土，现实与资源） ────────────────────────────────
  65: { upright: '代表现实层面的新机会，宜把想法换算成时间与预算，踏实开始。', reversedText: '机会未落实或贪图捷径，宜回到基本功，别让计划停在打算上。', uprightKeywords: ['机会', '务实', '启动'], reversedKeywords: ['落空', '短视', '拖延'], keywords: ['资源', '种子', '物质基础'], element: '土（现实与资源）', archetype: '牌阶·起点与契机' },
  66: { upright: '代表在多项事务间保持平衡，宜分清轻重缓急，给转换留出余量。', reversedText: '顾此失彼或收支失控，宜暂时减少承诺，稳住最要紧的一项。', uprightKeywords: ['平衡', '灵活', '兼顾'], reversedKeywords: ['失衡', '超支', '混乱'], keywords: ['周转', '权衡', '波动'], element: '土（现实与资源）', archetype: '牌阶·成对与权衡' },
  67: { upright: '代表技艺与协作的初步成形，宜与专业的人一起做，重视反馈与打磨。', reversedText: '配合不佳或敷衍了事，宜明确分工与验收标准，别靠临时凑合。', uprightKeywords: ['协作', '技艺', '打磨'], reversedKeywords: ['怠工', '标准模糊', '各自为政'], keywords: ['团队', '建造', '认可手艺'], element: '土（现实与资源）', archetype: '牌阶·成长与协作' },
  68: { upright: '代表保守的积累与持有，宜守住已有资源，也适度让钱流动起来。', reversedText: '过度紧握或支出失控，宜重新分配用途，别让安全感变成束缚。', uprightKeywords: ['守成', '积累', '稳固'], reversedKeywords: ['吝啬', '失控', '僵化'], keywords: ['资源', '安全', '掌控感'], element: '土（现实与资源）', archetype: '牌阶·稳定与结构' },
  69: { upright: '代表物质或健康上的短缺，宜主动开口求援，别独自在冷处硬撑。', reversedText: '困境渐缓或封闭自守，宜留意近处的帮助，逐步恢复行动能力。', uprightKeywords: ['匮乏', '困顿', '孤立'], reversedKeywords: ['转缓', '封闭', '怯于求助'], keywords: ['短缺', '艰难', '求助'], element: '土（现实与资源）', archetype: '牌阶·冲突与失衡' },
  70: { upright: '代表给予与接受的流动，宜清楚自己的能力边界，把帮助给到需要的人。', reversedText: '施受失衡或附带条件，宜调整关系的对等，别让善意带来亏欠感。', uprightKeywords: ['慷慨', '施与', '公平分配'], reversedKeywords: ['失衡', '条件', '依赖'], keywords: ['分享', '援助', '互惠'], element: '土（现实与资源）', archetype: '牌阶·调和与回馈' },
  71: { upright: '代表对投入产出的评估，宜停下来盘点成果，再决定继续或调整。', reversedText: '投入无回或急于求成，宜承认前期方法有误，及时调整方向。', uprightKeywords: ['评估', '等待', '投资'], reversedKeywords: ['焦躁', '白费', '失算'], keywords: ['耐心', '耕耘', '收获期'], element: '土（现实与资源）', archetype: '牌阶·评估与坚持' },
  72: { upright: '代表专注的练习与手艺精进，宜把大目标拆成每日可完成的一小步。', reversedText: '重复而缺乏长进或急于炫技，宜回归基本功，耐住枯燥。', uprightKeywords: ['专注', '练习', '精进'], reversedKeywords: ['敷衍', '浮躁', '停滞'], keywords: ['学徒', '勤奋', '基础'], element: '土（现实与资源）', archetype: '牌阶·推进与熟练' },
  73: { upright: '代表自食其力的从容，宜享受独立带来的余裕，同时为长期做准备。', reversedText: '成果不安或过分依赖，宜重新核定开支与目标，别用忙碌证明自己。', uprightKeywords: ['自立', '富足', '从容'], reversedKeywords: ['不安', '依赖', '虚耗'], keywords: ['成果', '自律', '逸乐'], element: '土（现实与资源）', archetype: '牌阶·临界与自省' },
  74: { upright: '代表长期的积累与家族支持，宜把资源用于可持续的安排，兼顾亲人。', reversedText: '财务纠纷或传承未定，宜提前把分配与责任谈清楚。', uprightKeywords: ['传承', '富足', '家族'], reversedKeywords: ['纠纷', '短视', '失序'], keywords: ['家业', '长久', '根基'], element: '土（现实与资源）', archetype: '牌阶·圆满与转换' },
  75: { upright: '代表踏实的学习与新的实务机会，宜从小事练手，把知识换成技能。', reversedText: '学习散漫或眼高手低，宜定下可衡量的日程，别只停留在兴趣。', uprightKeywords: ['务实', '上进', '新机会'], reversedKeywords: ['拖延', '浪费', '贪多'], keywords: ['学徒心', '勤勉', '起步'], element: '土（现实与资源）', archetype: '宫廷·学习与消息' },
  76: { upright: '代表按部就班地推进要务，宜守住既有节奏，把承诺按期交付。', reversedText: '进度缓慢或过分保守，宜检视流程中的卡点，适度调整方法。', uprightKeywords: ['稳健', '尽责', '守时'], reversedKeywords: ['迟缓', '固执', '停滞'], keywords: ['耐心', '务实推进', '可靠'], element: '土（现实与资源）', archetype: '宫廷·行动与推进' },
  77: { upright: '代表务实而温厚的照护，宜把资源用在日常所需，让生活有序安稳。', reversedText: '忙于操持或忽略自身，宜先安排自己的休息与开支，再谈照顾别人。', uprightKeywords: ['温厚', '务实', '照护'], reversedKeywords: ['操劳', '忽视自我', '琐碎'], keywords: ['滋养', '居家', '富足'], element: '土（现实与资源）', archetype: '宫廷·内在成熟与滋养' },
  78: { upright: '代表稳固的掌控与资源调配，宜以长期眼光经营，把成功变成共享的基础。', reversedText: '贪于掌控或挥霍无度，宜重新审视目标，别以物质衡量全部价值。', uprightKeywords: ['经营', '成功', '慷慨'], reversedKeywords: ['贪占', '挥霍', '固执'], keywords: ['财富', '担当', '稳固根基'], element: '土（现实与资源）', archetype: '宫廷·外在掌控与责任' },
});

export default TAROT_MEANINGS;
