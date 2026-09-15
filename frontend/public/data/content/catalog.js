// 命理 · 方法目录（节140 T3a，2026-09-14）—— 全站功能目录唯一事实源
//
// 定位：节140「丁方案 · 功能元数据表」（用户 2026-09-14 拍板接受）。所有「工具浏览器 /
// 意图推荐 / 文化角标 / 难度排序」都从这里读，不再散落各视图。与 ML_COPY 的关系：
// 本文件管「方法元数据 + 标签 + 意图推荐表」，界面文案仍在 ML_COPY（ui.*）。
//
// 结构：CONTENT.catalog = { methods[], intents[], tagMeta{} }
//   methods[].level  L1 秒懂 → L4 合参（节140 难度新口径：时间成本 + 看懂门槛，与生辰无关）
//   methods[].needCase  'none' 开箱即用 / 'case' 要档案 / 'pair' 要双档案
//   methods[].pay      'free' 全免费 / 'freemium' 免费起+付费深挖 / 'paid' 付费
//   methods[].page     导航目标页名（App pages 表）；params 透传（divination 方法等）
//   intents[].recs     意图 → 推荐方法（带理由），冷启动人工配置表（T3b 意图推荐页消费）
//
// 数据口径（2026-09-14 现场核对）：
//   - 命盘单法（八字格局/紫微/七政/奇门终身/五运六气）暂无独立页，统一走 nine-pick（八法合一，
//     其中含该法）；single:true 标记「将来单飞」（节130 议题，已被标签方案吸收）时改 page。
//   - 塔罗一条（单张/牌阵同一页面，L2 主口径；L1 快感由意图⑥随手抽体现）；雷诺曼同。
//   - 时势推演拆 taiyi/huangji 两条（各自独立页）。
//   - 配对解析无独立页（弹窗 openPairAnalyze），page:'pair' 由 T3b 导航层特殊处理。
//   - 起名（NamerModal）在 guoxue-tools 页内，page:'guoxue-tools'。

(function () {
  if (typeof window.CONTENT === 'undefined') return; // 依赖 content/index.js 先行初始化
  var methods = [
    // ---- L1 · 30 秒零学习（点一下就出结果）----
    { id: 'sign', name: '观音灵签', blurb: '心里有事抽一支，签文给个干脆指引', culture: ['中华'], play: ['抽签'], answer: ['问当下事'], level: 'L1', mins: '<1 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'sign' } },
    { id: 'tarot', name: '塔罗', blurb: '抽一张牌看此刻提示，或布牌阵看事件脉络', culture: ['西方'], play: ['抽牌'], answer: ['问当下事'], level: 'L2', mins: '1–5 分钟', pay: 'freemium', needCase: 'none', page: 'tarot' },
    { id: 'almanac', name: '黄历择日', blurb: '按事项挑吉日，宜忌冲煞时辰一目了然', culture: ['中华'], play: ['择日'], answer: ['择吉取名'], level: 'L1', mins: '即时', pay: 'free', needCase: 'none', page: 'almanac' },
    { id: 'zodiac', name: '生肖流年', blurb: '看你的生肖今年运势与宜忌', culture: ['中华'], play: ['流年'], answer: ['看流年'], level: 'L1', mins: '即时', pay: 'free', needCase: 'case', page: 'zodiac' },
    { id: 'mbti', name: '大五人格', blurb: '现代心理学问卷，从五个维度认识自己', culture: ['心理'], play: ['问卷'], answer: ['看自己'], level: 'L1', mins: '15–20 分钟', pay: 'free', needCase: 'none', page: 'mbti' },
    // ---- L2 · 1-3 分钟轻仪式（摇/洗牌选阵，结果白话）----
    { id: 'liuyao', name: '六爻', blurb: '摇卦问事，看当下吉凶走向', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L2', mins: '1–3 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'liuyao' } },
    { id: 'meihua', name: '梅花易数', blurb: '依时起卦，看事情的变化趋势', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L2', mins: '1–3 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'meihua' } },
    { id: 'xiaoliuren', name: '小六壬', blurb: '报三个数，速断当下吉凶', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L2', mins: '<1 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'xiaoliuren' } },
    { id: 'lenormand', name: '雷诺曼', blurb: '36 张小牌，逐张对应人物/时间看细节', culture: ['西方'], play: ['抽牌'], answer: ['问当下事'], level: 'L2', mins: '3–5 分钟', pay: 'freemium', needCase: 'none', page: 'lenormand' },
    { id: 'namer', name: '八字起名', blurb: '按八字五行喜忌，推荐 1–2 字好名', culture: ['中华'], play: ['择日'], answer: ['择吉取名'], level: 'L2', mins: '即时', pay: 'paid', needCase: 'case', page: 'guoxue-tools' },
    { id: 'pair', name: '配对解析', blurb: '两份档案合参，看关系契合与相处之道', culture: ['中华', '西方', '心理'], play: ['合盘'], answer: ['双人关系'], level: 'L2', mins: '10–40 秒', pay: 'paid', needCase: 'pair', page: 'pair' },
    // ---- L3 · 专业盘有读懂门槛（信息密度大，靠免费解读辅助）----
    { id: 'liuren', name: '大六壬', blurb: '三传四课，断事体精细入微', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L3', mins: '5–10 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'liuren' } },
    { id: 'jinkoujue', name: '金口诀', blurb: '一诀断吉凶，起课快、断事直', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L3', mins: '5–10 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'jinkoujue' } },
    { id: 'qimen', name: '奇门时家', blurb: '用时家奇门看当下的天时地利人和', culture: ['中华'], play: ['摇卦'], answer: ['问当下事'], level: 'L3', mins: '5–10 分钟', pay: 'freemium', needCase: 'none', page: 'divination', params: { method: 'qimen' } },
    { id: 'astrology', name: '西洋占星', blurb: '本命星盘，看性格原型与人生格局', culture: ['西方'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'astrology' },
    { id: 'bazi-pattern', name: '八字格局', blurb: '以生辰八字看命局格局与用神', culture: ['中华'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'nine-pick', single: true },
    { id: 'ziwei', name: '紫微斗数', blurb: '十二宫星曜，看一生格局与流年', culture: ['中华'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'nine-pick', single: true },
    { id: 'qizheng', name: '七政四余', blurb: '中西合璧的星命术，看格局与运势', culture: ['中华', '印度源流'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'nine-pick', single: true },
    { id: 'qimen-lifetime', name: '奇门终身局', blurb: '奇门终身盘，看一生的大局走向', culture: ['中华'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'nine-pick', single: true },
    { id: 'wuyun-liuqi', name: '五运六气', blurb: '中医运气学，看体质与天时相应', culture: ['中华'], play: ['排盘'], answer: ['看一生格局'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'case', page: 'nine-pick', single: true },
    { id: 'taiyi', name: '太乙神数', blurb: '古三式之一，推演国运大势', culture: ['中华'], play: ['择日'], answer: ['择吉取名'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'none', page: 'taiyi' },
    { id: 'huangji', name: '皇极经世', blurb: '以元会运世推演时代大势', culture: ['中华'], play: ['择日'], answer: ['择吉取名'], level: 'L3', mins: '即时', pay: 'freemium', needCase: 'none', page: 'huangji' },
    // ---- L4 · 多法合参（异步等待、消耗高、报告长）----
    { id: 'nine-pick', name: '八法合一', blurb: '八种命术同参共断，看一生的综合报告', culture: ['中华'], play: ['排盘'], answer: ['看一生格局'], level: 'L4', mins: '需等待（异步）', pay: 'freemium', needCase: 'case', page: 'nine-pick' }
  ];

  // 6 意图（节140 2026-09-13 用户确认）→ 推荐带理由（冷启动人工配置表）
  var intents = [
    { key: 'ask', title: '问件事', sub: '心里有件事，想看看走向', icon: 'orbit',
      recs: [
        { methodId: 'liuyao', why: '看事件走向最直接，摇卦问当下吉凶' },
        { methodId: 'tarot', why: '看心理动机与局面张力，牌面叙事强' },
        { methodId: 'sign', why: '要干脆指引，一签一答不纠结' },
        { methodId: 'lenormand', why: '看事件细节脉络，逐张对应人物/时间' }
      ] },
    { key: 'self', title: '了解我自己', sub: '性格·天赋·命格，三种视角认识自己', icon: 'spark',
      recs: [
        { methodId: 'mbti', why: '现代心理学量表（OCEAN），问卷免费无需生辰' },
        { methodId: 'bazi-pattern', why: '传统命理格局，看命局与用神' },
        { methodId: 'astrology', why: '星象性格原型，看本命星盘' }
      ] },
    { key: 'pair', title: '我和 TA', sub: '关系·配对·缘分', icon: 'heart',
      recs: [
        { methodId: 'pair', why: '两份档案合参，看契合与相处之道' },
        { methodId: 'tarot', why: '关系牌阵，看两人当下互动' },
        { methodId: 'lenormand', why: '小牌看关系细节与相处建议' }
      ] },
    { key: 'calendar', title: '挑日子取名', sub: '择吉·起名·时势', icon: 'calendar',
      recs: [
        { methodId: 'almanac', why: '黄历择日，免档案开箱即用' },
        { methodId: 'namer', why: '按八字喜忌取名' },
        { methodId: 'taiyi', why: '太乙神数推演大势' },
        { methodId: 'huangji', why: '皇极经世推演时势' }
      ] },
    { key: 'fortune', title: '看流运', sub: '今年运势·流年', icon: 'trend',
      recs: [
        { methodId: 'zodiac', why: '生肖流年，免费引流快速' },
        { methodId: 'nine-pick', why: '八法合一深度看一年运势' },
        { methodId: 'tarot', why: '年运十二牌阵' }
      ] },
    { key: 'random', title: '随手抽', sub: '抽张牌·签随便玩', icon: 'card',
      recs: [
        { methodId: 'sign', why: '观音灵签，一签一答' },
        { methodId: 'tarot', why: '塔罗单张，看此刻提示' },
        { methodId: 'lenormand', why: '雷诺曼单张，随手一抽' }
      ] }
  ];

  // 标签文案（explore 筛选条 / 卡片角标 chip）
  var tagMeta = {
    culture: { '中华': '中华', '西方': '西方', '心理': '心理', '印度源流': '印度源流' },
    play: { '排盘': '生辰排盘', '摇卦': '摇卦起课', '抽牌': '抽牌', '抽签': '抽签', '择日': '择日工具', '问卷': '问卷', '流年': '流年', '合盘': '双人合盘' },
    answer: { '看一生格局': '看一生格局', '问当下事': '问当下事', '看流年': '看流年', '择吉取名': '择吉取名', '双人关系': '双人关系', '看自己': '看自己' },
    level: { L1: 'L1 秒懂', L2: 'L2 轻仪式', L3: 'L3 专业', L4: 'L4 合参' },
    pay: { free: '全免费', freemium: '免费起+付费深挖', paid: '付费' },
    needCase: { none: '开箱即用', case: '要档案', pair: '要双档案' }
  };

  window.CONTENT.catalog = { methods: methods, intents: intents, tagMeta: tagMeta };
})();
