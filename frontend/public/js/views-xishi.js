// 西式占卜域视图（节110 阶段3）：西式 HUB XishiHubPage + 塔罗 TarotPage + 雷诺曼 LenormandPage
// （星座 AstrologyPage 与档案共享盘面 AstroWheel 耦合，留待「共享盘面→components.js」后追加）
// 加载于 views-guoxue.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- 西式占卜 HUB ---------- */
function XishiHubPage({
  onNavigate,
  applySkin
}) {
  const cards = [{
    name: TC_COPY.ui.hub['xishi-astrology-name'],
    sub: TC_COPY.ui.hub['xishi-astrology-sub'],
    bar: '#2A3A5C',
    ico: 'orbit',
    to: () => {
      applySkin('xingzuo');
      onNavigate('astrology');
    }
  }, {
    name: TC_COPY.ui.hub['xishi-tarot-name'],
    sub: TC_COPY.ui.hub['xishi-tarot-sub'],
    bar: '#C9A24B',
    ico: 'spark',
    to: () => {
      applySkin('tarot');
      onNavigate('tarot');
    }
  }, {
    name: TC_COPY.ui.hub['xishi-lenormand-name'],
    sub: TC_COPY.ui.hub['xishi-lenormand-sub'],
    bar: '#5B4B8A',
    ico: 'nine',
    to: () => {
      applySkin('tarot');
      onNavigate('lenormand');
    }
  }, {
    name: TC_COPY.ui.hub['xishi-more-name'],
    sub: TC_COPY.ui.hub['xishi-more-sub'],
    bar: '#888',
    ico: 'flat',
    disabled: true
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hub-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "orbit",
    size: 22
  }), TC_COPY.ui.module_hub.western_title), /*#__PURE__*/React.createElement("div", {
    className: "hub-grid"
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'hub-card' + (c.disabled ? ' disabled' : ''),
    onClick: () => c.disabled ? toast(TC_COPY.ui.hub['coming-soon-toast']) : c.to()
  }, /*#__PURE__*/React.createElement("span", {
    className: "hc-bar",
    style: {
      background: c.bar
    }
  }), /*#__PURE__*/React.createElement(Icon, {
    name: c.ico,
    size: 28,
    className: "hc-ico"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hc-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-name"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "hc-sub"
  }, c.sub))))));
}

/* ---------- 塔罗牌（占位卡：空白+文字，美术后续补充） ---------- */
const TAROT_DECK = [{
  name: '愚者',
  roman: '0',
  suit: 'major',
  img: './tarot/rider-waite/webp/00_Fool.webp',
  thumb: './tarot/rider-waite/thumb/00_Fool.webp'
}, {
  name: '魔术师',
  roman: 'I',
  suit: 'major',
  img: './tarot/rider-waite/webp/01_Magician.webp',
  thumb: './tarot/rider-waite/thumb/01_Magician.webp'
}, {
  name: '女祭司',
  roman: 'II',
  suit: 'major',
  img: './tarot/rider-waite/webp/02_High_Priestess.webp',
  thumb: './tarot/rider-waite/thumb/02_High_Priestess.webp'
}, {
  name: '皇后',
  roman: 'III',
  suit: 'major',
  img: './tarot/rider-waite/webp/03_Empress.webp',
  thumb: './tarot/rider-waite/thumb/03_Empress.webp'
}, {
  name: '皇帝',
  roman: 'IV',
  suit: 'major',
  img: './tarot/rider-waite/webp/04_Emperor.webp',
  thumb: './tarot/rider-waite/thumb/04_Emperor.webp'
}, {
  name: '教皇',
  roman: 'V',
  suit: 'major',
  img: './tarot/rider-waite/webp/05_Hierophant.webp',
  thumb: './tarot/rider-waite/thumb/05_Hierophant.webp'
}, {
  name: '恋人',
  roman: 'VI',
  suit: 'major',
  img: './tarot/rider-waite/webp/06_Lovers.webp',
  thumb: './tarot/rider-waite/thumb/06_Lovers.webp'
}, {
  name: '战车',
  roman: 'VII',
  suit: 'major',
  img: './tarot/rider-waite/webp/07_Chariot.webp',
  thumb: './tarot/rider-waite/thumb/07_Chariot.webp'
}, {
  name: '力量',
  roman: 'VIII',
  suit: 'major',
  img: './tarot/rider-waite/webp/08_Strength.webp',
  thumb: './tarot/rider-waite/thumb/08_Strength.webp'
}, {
  name: '隐士',
  roman: 'IX',
  suit: 'major',
  img: './tarot/rider-waite/webp/09_Hermit.webp',
  thumb: './tarot/rider-waite/thumb/09_Hermit.webp'
}, {
  name: '命运之轮',
  roman: 'X',
  suit: 'major',
  img: './tarot/rider-waite/webp/10_Wheel_of_Fortune.webp',
  thumb: './tarot/rider-waite/thumb/10_Wheel_of_Fortune.webp'
}, {
  name: '正义',
  roman: 'XI',
  suit: 'major',
  img: './tarot/rider-waite/webp/11_Justice.webp',
  thumb: './tarot/rider-waite/thumb/11_Justice.webp'
}, {
  name: '倒吊人',
  roman: 'XII',
  suit: 'major',
  img: './tarot/rider-waite/webp/12_Hanged_Man.webp',
  thumb: './tarot/rider-waite/thumb/12_Hanged_Man.webp'
}, {
  name: '死神',
  roman: 'XIII',
  suit: 'major',
  img: './tarot/rider-waite/webp/13_Death.webp',
  thumb: './tarot/rider-waite/thumb/13_Death.webp'
}, {
  name: '节制',
  roman: 'XIV',
  suit: 'major',
  img: './tarot/rider-waite/webp/14_Temperance.webp',
  thumb: './tarot/rider-waite/thumb/14_Temperance.webp'
}, {
  name: '恶魔',
  roman: 'XV',
  suit: 'major',
  img: './tarot/rider-waite/webp/15_Devil.webp',
  thumb: './tarot/rider-waite/thumb/15_Devil.webp'
}, {
  name: '高塔',
  roman: 'XVI',
  suit: 'major',
  img: './tarot/rider-waite/webp/16_Tower.webp',
  thumb: './tarot/rider-waite/thumb/16_Tower.webp'
}, {
  name: '星星',
  roman: 'XVII',
  suit: 'major',
  img: './tarot/rider-waite/webp/17_Star.webp',
  thumb: './tarot/rider-waite/thumb/17_Star.webp'
}, {
  name: '月亮',
  roman: 'XVIII',
  suit: 'major',
  img: './tarot/rider-waite/webp/18_Moon.webp',
  thumb: './tarot/rider-waite/thumb/18_Moon.webp'
}, {
  name: '太阳',
  roman: 'XIX',
  suit: 'major',
  img: './tarot/rider-waite/webp/19_Sun.webp',
  thumb: './tarot/rider-waite/thumb/19_Sun.webp'
}, {
  name: '审判',
  roman: 'XX',
  suit: 'major',
  img: './tarot/rider-waite/webp/20_Judgement.webp',
  thumb: './tarot/rider-waite/thumb/20_Judgement.webp'
}, {
  name: '世界',
  roman: 'XXI',
  suit: 'major',
  img: './tarot/rider-waite/webp/21_World.webp',
  thumb: './tarot/rider-waite/thumb/21_World.webp'
}, {
  name: '权杖王牌',
  roman: 'A',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands01.webp',
  thumb: './tarot/rider-waite/thumb/Wands01.webp'
}, {
  name: '权杖二',
  roman: '2',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands02.webp',
  thumb: './tarot/rider-waite/thumb/Wands02.webp'
}, {
  name: '权杖三',
  roman: '3',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands03.webp',
  thumb: './tarot/rider-waite/thumb/Wands03.webp'
}, {
  name: '权杖四',
  roman: '4',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands04.webp',
  thumb: './tarot/rider-waite/thumb/Wands04.webp'
}, {
  name: '权杖五',
  roman: '5',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands05.webp',
  thumb: './tarot/rider-waite/thumb/Wands05.webp'
}, {
  name: '权杖六',
  roman: '6',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands06.webp',
  thumb: './tarot/rider-waite/thumb/Wands06.webp'
}, {
  name: '权杖七',
  roman: '7',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands07.webp',
  thumb: './tarot/rider-waite/thumb/Wands07.webp'
}, {
  name: '权杖八',
  roman: '8',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands08.webp',
  thumb: './tarot/rider-waite/thumb/Wands08.webp'
}, {
  name: '权杖九',
  roman: '9',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands09.webp',
  thumb: './tarot/rider-waite/thumb/Wands09.webp'
}, {
  name: '权杖十',
  roman: '10',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands10.webp',
  thumb: './tarot/rider-waite/thumb/Wands10.webp'
}, {
  name: '权杖侍从',
  roman: 'Pa',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands11.webp',
  thumb: './tarot/rider-waite/thumb/Wands11.webp'
}, {
  name: '权杖骑士',
  roman: 'Kn',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands12.webp',
  thumb: './tarot/rider-waite/thumb/Wands12.webp'
}, {
  name: '权杖王后',
  roman: 'Q',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands13.webp',
  thumb: './tarot/rider-waite/thumb/Wands13.webp'
}, {
  name: '权杖国王',
  roman: 'K',
  suit: 'wands',
  img: './tarot/rider-waite/webp/Wands14.webp',
  thumb: './tarot/rider-waite/thumb/Wands14.webp'
}, {
  name: '圣杯王牌',
  roman: 'A',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups01.webp',
  thumb: './tarot/rider-waite/thumb/Cups01.webp'
}, {
  name: '圣杯二',
  roman: '2',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups02.webp',
  thumb: './tarot/rider-waite/thumb/Cups02.webp'
}, {
  name: '圣杯三',
  roman: '3',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups03.webp',
  thumb: './tarot/rider-waite/thumb/Cups03.webp'
}, {
  name: '圣杯四',
  roman: '4',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups04.webp',
  thumb: './tarot/rider-waite/thumb/Cups04.webp'
}, {
  name: '圣杯五',
  roman: '5',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups05.webp',
  thumb: './tarot/rider-waite/thumb/Cups05.webp'
}, {
  name: '圣杯六',
  roman: '6',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups06.webp',
  thumb: './tarot/rider-waite/thumb/Cups06.webp'
}, {
  name: '圣杯七',
  roman: '7',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups07.webp',
  thumb: './tarot/rider-waite/thumb/Cups07.webp'
}, {
  name: '圣杯八',
  roman: '8',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups08.webp',
  thumb: './tarot/rider-waite/thumb/Cups08.webp'
}, {
  name: '圣杯九',
  roman: '9',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups09.webp',
  thumb: './tarot/rider-waite/thumb/Cups09.webp'
}, {
  name: '圣杯十',
  roman: '10',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups10.webp',
  thumb: './tarot/rider-waite/thumb/Cups10.webp'
}, {
  name: '圣杯侍从',
  roman: 'Pa',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups11.webp',
  thumb: './tarot/rider-waite/thumb/Cups11.webp'
}, {
  name: '圣杯骑士',
  roman: 'Kn',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups12.webp',
  thumb: './tarot/rider-waite/thumb/Cups12.webp'
}, {
  name: '圣杯王后',
  roman: 'Q',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups13.webp',
  thumb: './tarot/rider-waite/thumb/Cups13.webp'
}, {
  name: '圣杯国王',
  roman: 'K',
  suit: 'cups',
  img: './tarot/rider-waite/webp/Cups14.webp',
  thumb: './tarot/rider-waite/thumb/Cups14.webp'
}, {
  name: '宝剑王牌',
  roman: 'A',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords01.webp',
  thumb: './tarot/rider-waite/thumb/Swords01.webp'
}, {
  name: '宝剑二',
  roman: '2',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords02.webp',
  thumb: './tarot/rider-waite/thumb/Swords02.webp'
}, {
  name: '宝剑三',
  roman: '3',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords03.webp',
  thumb: './tarot/rider-waite/thumb/Swords03.webp'
}, {
  name: '宝剑四',
  roman: '4',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords04.webp',
  thumb: './tarot/rider-waite/thumb/Swords04.webp'
}, {
  name: '宝剑五',
  roman: '5',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords05.webp',
  thumb: './tarot/rider-waite/thumb/Swords05.webp'
}, {
  name: '宝剑六',
  roman: '6',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords06.webp',
  thumb: './tarot/rider-waite/thumb/Swords06.webp'
}, {
  name: '宝剑七',
  roman: '7',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords07.webp',
  thumb: './tarot/rider-waite/thumb/Swords07.webp'
}, {
  name: '宝剑八',
  roman: '8',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords08.webp',
  thumb: './tarot/rider-waite/thumb/Swords08.webp'
}, {
  name: '宝剑九',
  roman: '9',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords09.webp',
  thumb: './tarot/rider-waite/thumb/Swords09.webp'
}, {
  name: '宝剑十',
  roman: '10',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords10.webp',
  thumb: './tarot/rider-waite/thumb/Swords10.webp'
}, {
  name: '宝剑侍从',
  roman: 'Pa',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords11.webp',
  thumb: './tarot/rider-waite/thumb/Swords11.webp'
}, {
  name: '宝剑骑士',
  roman: 'Kn',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords12.webp',
  thumb: './tarot/rider-waite/thumb/Swords12.webp'
}, {
  name: '宝剑王后',
  roman: 'Q',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords13.webp',
  thumb: './tarot/rider-waite/thumb/Swords13.webp'
}, {
  name: '宝剑国王',
  roman: 'K',
  suit: 'swords',
  img: './tarot/rider-waite/webp/Swords14.webp',
  thumb: './tarot/rider-waite/thumb/Swords14.webp'
}, {
  name: '钱币王牌',
  roman: 'A',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents01.webp',
  thumb: './tarot/rider-waite/thumb/Pents01.webp'
}, {
  name: '钱币二',
  roman: '2',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents02.webp',
  thumb: './tarot/rider-waite/thumb/Pents02.webp'
}, {
  name: '钱币三',
  roman: '3',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents03.webp',
  thumb: './tarot/rider-waite/thumb/Pents03.webp'
}, {
  name: '钱币四',
  roman: '4',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents04.webp',
  thumb: './tarot/rider-waite/thumb/Pents04.webp'
}, {
  name: '钱币五',
  roman: '5',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents05.webp',
  thumb: './tarot/rider-waite/thumb/Pents05.webp'
}, {
  name: '钱币六',
  roman: '6',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents06.webp',
  thumb: './tarot/rider-waite/thumb/Pents06.webp'
}, {
  name: '钱币七',
  roman: '7',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents07.webp',
  thumb: './tarot/rider-waite/thumb/Pents07.webp'
}, {
  name: '钱币八',
  roman: '8',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents08.webp',
  thumb: './tarot/rider-waite/thumb/Pents08.webp'
}, {
  name: '钱币九',
  roman: '9',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents09.webp',
  thumb: './tarot/rider-waite/thumb/Pents09.webp'
}, {
  name: '钱币十',
  roman: '10',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents10.webp',
  thumb: './tarot/rider-waite/thumb/Pents10.webp'
}, {
  name: '钱币侍从',
  roman: 'Pa',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents11.webp',
  thumb: './tarot/rider-waite/thumb/Pents11.webp'
}, {
  name: '钱币骑士',
  roman: 'Kn',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents12.webp',
  thumb: './tarot/rider-waite/thumb/Pents12.webp'
}, {
  name: '钱币王后',
  roman: 'Q',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents13.webp',
  thumb: './tarot/rider-waite/thumb/Pents13.webp'
}, {
  name: '钱币国王',
  roman: 'K',
  suit: 'pentacles',
  img: './tarot/rider-waite/webp/Pents14.webp',
  thumb: './tarot/rider-waite/thumb/Pents14.webp'
}];
const TAROT_SPREADS = [{
  id: 'single',
  name: '单张',
  desc: '快速指引 · 一事一问，直接看核心建议',
  pos: ['核心']
}, {
  id: 'three',
  name: '三张',
  desc: '过去-现在-未来 · 看清事情的发展脉络',
  pos: ['过去', '现在', '未来']
}, {
  id: 'love',
  name: '爱情',
  desc: '感情关系 · 双方内心、现状与走向建议',
  pos: ['你的内心', '对方的内心', '关系现状', '发展建议', '未来走向']
}, {
  id: 'career',
  name: '事业',
  desc: '职场抉择 · 现状、优劣势与行动建议',
  pos: ['当前状况', '优势', '挑战', '机会', '行动建议', '结果']
}, {
  id: 'decision',
  name: '选择',
  desc: '二择一决策 · 比较两条路径并给最佳建议',
  pos: ['现状', '选择A', '选择A结果', '选择B', '选择B结果', '最佳建议']
}, {
  id: 'universal',
  name: '万能',
  desc: '通用问题全景 · 现状、阻力、资源与趋势',
  pos: ['当前状况', '主要阻力', '可用资源', '建议行动', '发展趋势']
}, {
  id: 'holyTriangle',
  name: '圣三角',
  desc: '快速把握主线 · 根源、现状与发展结果',
  pos: ['问题根源', '当前状况', '发展结果']
}, {
  id: 'relationship',
  name: '关系牌阵',
  desc: '关系互动 · 双方状态、需求与走向（vendored 6 张）',
  pos: ['你的状态', '对方的状态', '你的需求', '对方的需求', '关系核心', '关系走向']
}, {
  id: 'mindBodySpirit',
  name: '身心灵',
  desc: '内在平衡 · 思想、身体与精神三层',
  pos: ['心灵/思想', '身体/行动', '精神/灵性']
}, {
  id: 'wealth',
  name: '财富',
  desc: '财务现状 · 收入机会、风险与改善路径',
  pos: ['当前财务状态', '收入机会', '支出与风险', '可用资源', '改善建议']
}, {
  id: 'problemSolving',
  name: '问题解决',
  desc: '拆解难题 · 表象、根源、阻力与突破口',
  pos: ['问题表象', '根本原因', '主要阻力', '突破方向', '行动结果']
}, {
  id: 'celtic',
  name: '凯尔特十字',
  desc: '深层拆解 · 十张牌层层展开复杂局面（Waite 位次）',
  pos: ['现状', '交叉影响', '目标与理想', '根基', '近期过去', '临近未来', '你的立场', '环境与他人', '希望与恐惧', '结果']
}, {
  id: 'horseshoe',
  name: '七张马蹄',
  desc: '全局总览 · 七张马蹄从过去看到结果（Barbara Moore 经典）',
  pos: ['过去', '现在', '近期未来', '你的态度', '外部影响', '阻碍', '结果']
}, {
  id: 'hexagram',
  name: '六芒星',
  desc: '双层透视 · 精神与现实双层加核心牌（Star of David）',
  pos: ['过去', '现在', '未来', '原因', '环境', '策略', '核心/指示牌']
}, {
  id: 'fourElements',
  name: '四元素',
  desc: '元素平衡 · 行动、情感、思考与现实',
  pos: ['核心主题', '火元素·行动', '水元素·情感', '风元素·思考', '土元素·现实']
}, {
  id: 'chakra',
  name: '七脉轮',
  desc: '能量观察 · 七个脉轮看身心状态',
  pos: ['海底轮(生存)', '脐轮(情感)', '太阳轮(意志)', '心轮(爱)', '喉轮(表达)', '眉心轮(直觉)', '顶轮(灵性)']
}, {
  id: 'twelveHouses',
  name: '十二宫',
  desc: '全景复盘 · 十二个生活领域逐宫展开',
  pos: ['自我与外在', '金钱与价值', '学习与沟通', '家庭与根基', '创造与恋爱', '工作与日常', '伴侣与合作', '共享资源与转变', '远行与信念', '事业与名望', '社群与愿景', '潜意识与休整']
}, {
  id: 'fourSeasons',
  name: '四牌四季',
  desc: '四季运势 · 春夏秋冬四张牌看一年节奏',
  pos: ['春', '夏', '秋', '冬']
}, {
  id: 'year',
  name: '年运牌阵',
  desc: '全年展望 · 十二张牌看整年阶段与领域重点（vendored 12 张）',
  pos: ['整体运势', '1-3月', '4-6月', '7-9月', '10-12月', '爱情', '事业', '财运', '健康', '建议', '挑战', '机遇']
}];
/* REQ-123：塔罗「选择牌阵」分组（仅作用于选择牌阵步骤；分组名/归类为可调项，落地回填） */
const TAROT_SPREAD_GROUPS = [{
  title: '基础',
  ids: ['single', 'three', 'universal', 'holyTriangle']
}, {
  title: '爱情关系',
  ids: ['love', 'relationship', 'mindBodySpirit']
}, {
  title: '事业财富',
  ids: ['career', 'wealth', 'problemSolving', 'decision']
}, {
  title: '综合深度',
  ids: ['celtic', 'horseshoe', 'hexagram', 'fourElements', 'chakra', 'twelveHouses']
}, {
  title: '时间周期',
  ids: ['fourSeasons', 'year']
}];
/* 后端塔罗牌名 → 前端 TAROT_DECK 卡面映射（个别译名差异） */
const TAROT_NAME_ALIAS = { '女皇': '皇后', '塔': '高塔' };
const TAROT_SUIT_COLOR = { major: '#5B4B8A', wands: '#b8893e', cups: '#c0392b', swords: '#2c3e6e', pentacles: '#4a7c59' };
function tarotDeckMatch(name) {
  if (!name) return null;
  return TAROT_DECK.find(d => d.name === (TAROT_NAME_ALIAS[name] || name)) || TAROT_DECK.find(d => d.name === name) || null;
}
function tarotSuitOf(name) {
  if (!name) return 'major';
  if (name.indexOf('权杖') === 0) return 'wands';
  if (name.indexOf('圣杯') === 0) return 'cups';
  if (name.indexOf('宝剑') === 0) return 'swords';
  if (name.indexOf('钱币') === 0) return 'pentacles';
  return 'major';
}
function normTarotCard(c) {
  const src = c && c.card && typeof c.card === 'object' ? c.card : c;
  const name = (src && (src.name || src.cardName)) || '';
  const pos = (c && (c.position || c.pos)) || '';
  // 逆位判定兼容三种来源：random 分支 item.isReversed、interactive/manual 分支布尔 item.reversed、以及 orientation==='逆位'
  let reversed = false;
  if (c) {
    if (typeof c.isReversed === 'boolean') reversed = c.isReversed;
    else if (typeof c.reversed === 'boolean') reversed = c.reversed;
    else if (src && typeof src.reversed === 'boolean') reversed = src.reversed;
    else if (c.orientation === '逆位' || (src && src.orientation === '逆位')) reversed = true;
  }
  const strOf = function (o, key) {
    return (o && typeof o[key] === 'string' && o[key].trim()) ? o[key] : '';
  };
  const arrOf = function (o, key) {
    return (o && Array.isArray(o[key])) ? o[key] : [];
  };
  // A2：固定牌义正文与分方向关键词（判空容错；reversed 为布尔逆位标记，逆位正文存 reversedText）
  const upright = strOf(src, 'upright') || strOf(c, 'upright');
  const revText = strOf(src, 'reversedText') || strOf(c, 'reversedText');
  const uprightKeywords = arrOf(src, 'uprightKeywords').length ? arrOf(src, 'uprightKeywords') : arrOf(c, 'uprightKeywords');
  const reversedKeywords = arrOf(src, 'reversedKeywords').length ? arrOf(src, 'reversedKeywords') : arrOf(c, 'reversedKeywords');
  const keywords = Array.isArray(src && src.keywords) ? src.keywords : (Array.isArray(c && c.keywords) ? c.keywords : []);
  // 按当前正逆位把对应方向关键词并入展示行（去重），原始 uprightKeywords/reversedKeywords 仍单独保留
  const oriKw = reversed ? reversedKeywords : uprightKeywords;
  const mergedKw = keywords.concat(oriKw.filter(function (k) {
    return keywords.indexOf(k) === -1;
  }));
  const deck = tarotDeckMatch(name);
  return {
    name: name,
    pos: pos,
    reversed: !!reversed,
    keywords: mergedKw,
    upright: upright,
    reversedText: revText,
    uprightKeywords: uprightKeywords.slice(),
    reversedKeywords: reversedKeywords.slice(),
    element: (src && src.element) || '',
    archetype: (src && src.archetype) || '',
    suit: (deck && deck.suit) || tarotSuitOf(name),
    img: (deck && deck.img) || ''
  };
}
function TarotCard({
  item,
  showMeaning
}) {
  const rev = !!(item && item.reversed);
  const suit = (item && item.suit) || 'major';
  const name = (item && item.name) || '牌';
  // A2：固定牌义正文（后端 upright/reversed 字段，非 LLM；判空容错，无正文时不渲染该区块）
  // REQ-042 v2：showMeaning=false 时卡内不嵌牌义（仅图/标题/关键词标签），牌义统一走下方段落
  const bodyText = rev
    ? ((item && (item.reversedText || (typeof item.reversed === 'string' ? item.reversed : ''))) || '')
    : ((item && item.upright) || '');
  const withMean = showMeaning !== false && !!bodyText;
  const bodyTag = rev ? '逆位含义' : '正位含义';
  const body = withMean ? React.createElement('div', {
    className: 'tc-mean'
  }, React.createElement('div', {
    className: 'tc-mean-tag'
  }, bodyTag), React.createElement('div', {
    className: 'tc-mean-txt'
  }, bodyText)) : null;
  return React.createElement('div', {
    style: {
      textAlign: 'center'
    }
  }, item && item.pos ? React.createElement('div', {
    className: 'tc-pos'
  }, item.pos) : null, React.createElement('div', {
    className: 'tarot-card suit-' + suit + (rev ? ' reversed' : '') + (withMean ? ' has-mean' : '')
  }, React.createElement('div', {
    className: 'tc-imgwrap'
  }, item && item.img ? React.createElement('img', {
    className: 'tc-img',
    src: item.img,
    alt: name,
    loading: 'lazy',
    decoding: 'async'
  }) : React.createElement('div', {
    className: 'tc-ph',
    style: {
      background: TAROT_SUIT_COLOR[suit] || '#5B4B8A'
    }
  }, name)), React.createElement('div', {
    className: 'tc-name'
  }, name, rev ? '（逆位）' : ''), item && item.keywords && item.keywords.length ? React.createElement('div', {
    className: 'tc-kw'
  }, item.keywords.join(' · ')) : null, body));
}
/* REQ-123：塔罗「选择牌阵」分组折叠 —— 分组标题默认收起，点击展开该组牌阵列表；
   交互对齐 REQ-107 折叠菜单风格（标题作点击头 + ▸ 箭头旋转）；独立函数组件（自带 useState），
   避免在父级渲染函数里按条件增减 hooks 破坏钩子顺序；组内保持 REQ-042 v2 单列按钮 + 适用说明。 */
function TarotSpreadGroup({ title, spreads, mode, onPick }) {
  const [open, setOpen] = useState(false);
  const count = (spreads && spreads.length) || 0;
  const kids = [React.createElement('button', {
    key: 'h',
    type: 'button',
    className: 'spread-group-head' + (open ? ' open' : ''),
    onClick: function () { setOpen(!open); },
    'aria-expanded': open ? 'true' : 'false'
  }, React.createElement('span', { className: 'sg-t' }, title),
    React.createElement('span', { className: 'sg-meta' }, '共 ' + count + ' 个牌阵'),
    React.createElement('span', { className: 'sg-chev' }, '▸'))];
  if (open) {
    kids.push(React.createElement('div', { key: 'list', className: 'method-list' }, spreads.map(function (s) {
      return React.createElement('div', {
        key: s.id,
        className: 'method-cell',
        onClick: function () { onPick(s); }
      }, React.createElement('div', { className: 'mn' }, s.name), s.desc ? React.createElement('div', { className: 'md' }, s.desc) : null,
        React.createElement('div', { className: 'md', style: { marginTop: 2, color: 'var(--text-3)' } }, mode === 'manual' ? '手动模式：按 ' + s.pos.length + ' 个牌位从牌库逐张选牌并定正/逆位' : '点击即自动抽取 ' + s.pos.length + ' 张'));
    })));
  }
  return React.createElement('div', { className: 'spread-group' }, kids);
}
/* ================= REQ-129：塔罗 B 取牌段（洗牌 → 切牌 → 扇形自选 → 逐张弹入阵位自动翻开 → 抽满收扇） =================
   结果不变的取舍：后端 draw 一次性真实成牌（一次请求、计费不变）；扇形 78 张只承担「点选 + 仪式感」，
   第 i 次点选揭开的是 draw 返回牌序的第 i 张（draw.cards[i-1]），已选即定不可反悔。
   读牌段数据流：抽满收扇时经 buildTarotPickStream 产出 { spread, cards:[{index,position,name,img,...}] }，
   写入模块级 lastTarotPickStream —— 读牌段（19 阵摆位渲染，后续任务）经 getTarotPickStream() 消费。 */
let lastTarotPickStream = null;
function buildTarotPickStream(sp, cardsArr) {
  if (!sp) return null;
  const posArr = (sp && Array.isArray(sp.pos)) ? sp.pos : [];
  const list = (cardsArr || []).map(function (c, i) {
    const n = normTarotCard(c);
    return {
      index: i + 1,
      position: posArr[i] || n.pos || ('第' + (i + 1) + '张'),
      name: n.name,
      img: n.img,
      suit: n.suit,
      reversed: n.reversed,
      keywords: (n.keywords || []).slice(),
      upright: n.upright,
      reversedText: n.reversedText
    };
  });
  return { spread: { id: sp.id, name: sp.name, pos: posArr.slice() }, cards: list };
}
function getTarotPickStream() {
  return lastTarotPickStream;
}
/* ① 洗牌动画（全屏舞台，约 2.2s 程序化抖动；「跳过动画」= 直接出结果，不改变全局开关） */
function TarotShuffleStage(props) {
  const fired = useRef(false);
  useEffect(function () {
    const t = setTimeout(function () {
      if (fired.current) return;
      fired.current = true;
      props.onDone();
    }, 2200);
    return function () { clearTimeout(t); };
  }, []);
  const fire = function (fn) {
    return function () {
      if (fired.current) return;
      fired.current = true;
      if (fn) fn();
    };
  };
  const kids = [];
  for (let i = 0; i < 7; i++) kids.push(React.createElement('i', { key: 'c' + i, className: 'tpsh-card' }));
  return ArtStageFrame({
    title: '洗牌',
    sub: '集中意念 · 请静心默念你的问题',
    skip: fire(props.onSkip),
    children: [
      React.createElement('div', { key: 'd', className: 'tpsh-deck' }, kids),
      React.createElement('div', { key: 'h', className: 'stage-hint' }, '洗牌中… 心念流转 · 牌灵就位')
    ]
  });
}
/* ② 切牌（可关）：牌分三摞，点选即收拢；三摞收拢完毕自动进入扇形；「跳过动画」= 直接出结果 */
function TarotCutStage(props) {
  const [picked, setPicked] = useState([]);
  const fired = useRef(false);
  const done = useRef(false);
  const timers = useRef([]);
  const later = function (fn, ms) { timers.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);
  const tapPile = function (idx, e) {
    if (done.current || fired.current) return;
    if (picked.indexOf(idx) !== -1) return;
    const el = e && e.currentTarget;
    if (el) {
      const zone = el.closest('.tpc-stage');
      const zr = zone ? zone.getBoundingClientRect() : null;
      const r = el.getBoundingClientRect();
      if (zr && r) el.style.setProperty('--tx', ((zr.left + zr.width / 2) - (r.left + r.width / 2)).toFixed(1) + 'px');
      el.classList.add('taken');
    }
    const next = picked.concat([idx]);
    setPicked(next);
    if (next.length >= 3) {
      done.current = true;
      later(function () {
        if (fired.current) return;
        fired.current = true;
        props.onDone();
      }, 560);
    }
  };
  const piles = [0, 1, 2].map(function (idx) {
    const taken = picked.indexOf(idx) !== -1;
    return React.createElement('div', {
      key: 'p' + idx,
      className: 'tpc-pile' + (taken ? ' taken' : ''),
      role: 'button',
      'aria-label': '收拢第 ' + (idx + 1) + ' 摞',
      onClick: function (e) { tapPile(idx, e); }
    }, React.createElement('div', { className: 'tpc-stack' }));
  });
  const cap = picked.length >= 3 ? '三摞收拢 · 牌序入定' : ('已收拢 ' + picked.length + ' 摞 / 3 · 依直觉依次点选');
  return ArtStageFrame({
    title: '切牌',
    sub: '牌分三摞 · 依直觉点选收拢',
    skip: function () {
      if (fired.current) return;
      fired.current = true;
      props.onSkip();
    },
    children: [
      React.createElement('div', { key: 'p', className: 'tpc-stage' }, piles),
      React.createElement('div', { key: 'c', className: 'tpc-cap' }, cap),
      React.createElement('button', { key: 's', type: 'button', className: 'tpc-skipcut', onClick: function () {
        if (fired.current) return;
        fired.current = true;
        props.onSkipCut();
      } }, '跳过切牌，直接进入扇形选牌')
    ]
  });
}
/* ③④⑤ 扇形自选：78 张牌背叠扇形列于下方、可左右滑动、不标序号/朝向；
   点某张 → 该牌（牌背幽灵）弹向当前序号位 → 落位自动翻开（微放大揭晓）→ 抽满 N 张自动收扇 → onAllRevealed */
function TarotPickBoard(props) {
  const total = (props.pos && props.pos.length) || (props.cards ? props.cards.length : 0);
  const deckLen = (typeof props.deckLen === 'number' && props.deckLen > 0) ? props.deckLen : 78;
  const isLeno = props.kind === 'leno';
  const [n, setN] = useState(0);
  const [removed, setRemoved] = useState([]);
  const [closing, setClosing] = useState(false);
  const orderRef = useRef(null);
  if (!orderRef.current) {
    const arr = [];
    for (let i = 0; i < deckLen; i++) arr.push(i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    orderRef.current = arr;
  }
  const order = orderRef.current;
  const busyRef = useRef(false);
  const firedAll = useRef(false);
  const slotEls = useRef([]);
  const ghostRef = useRef(null);
  const timers = useRef([]);
  const later = function (fn, ms) { timers.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    // 预载真实牌面：落位翻开的瞬间不白闪
    (props.cards || []).forEach(function (c) {
      if (c && c.img) { const im = new Image(); im.src = c.img; }
    });
    return function () {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (ghostRef.current && ghostRef.current.parentNode) {
        ghostRef.current.parentNode.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
    };
  }, []);
  // 节100③：槽位板复用读牌板真实阵型坐标（spots 由调用方传入；未知阵兜底行式），
  // 摆位数学与 TarotReadBoard 完全一致 —— 抽满后切读牌板同位无缝衔接。
  let ratio = 0.9;
  let cells = null;
  let sideCap = false;
  const spot = props.spots || null;
  if (spot) {
    ratio = spot.ratio;
    cells = spot.cells;
    sideCap = !!spot.sideCap;
  } else if (total <= 1) {
    ratio = 1.05; cells = [{ x: 50, y: 45, w: 30, rot: 0 }];
  } else if (total <= 5) {
    ratio = 1.9; cells = tarotRowCells(total, total <= 3 ? 22 : 15.5, 46);
  } else {
    ratio = 1.25;
    const rows = Math.ceil(total / 3);
    const ys = []; for (let r = 0; r < rows; r++) ys.push(rows === 1 ? 50 : 36 + r * (72 / (rows - 1)));
    const all = [];
    for (let r = 0; r < rows; r++) for (let cc = 0; cc < 3; cc++) {
      const k = r * 3 + cc;
      if (k < total) all.push({ x: TAROT_GRID6_XS[cc], y: ys[r], w: total <= 6 ? 15 : 13, rot: 0 });
    }
    cells = all;
  }
  const capShow = sideCap ? false : (spot ? spot.cap !== false : total <= 5);
  const capFs = total <= 1 ? 12.5 : (total <= 3 ? 11 : (total <= 5 ? 9.5 : 8.6));
  const bdgFs = total <= 3 ? 12 : (total <= 5 ? 11 : (total <= 7 ? 10 : 9.5));
  // 阵位自动滚动：保证当前待取格在可视区内（长牌阵如十二宫 / 年运也无需手滑）
  useEffect(function () {
    const el = slotEls.current[n];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [n]);
  // ---- 节100③：底部圆弧扇形（横滑浏览 + 轻点抽牌）。原生横向滚动 + rAF，
  //      每张牌按「距滚动中心位次 d」实时写 transform：横移 x、下沉 d²·k、倾斜 d·4.6°，
  //      中直立、两边渐低渐斜；|d|>3.6 渐隐，>5.4 不渲染点击。取走的牌留位不塌（扇形不跳）。
  //      牌距 = 卡宽 22%（密集扇形）；触摸端走原生横滑（touch-action:pan-x），
  //      桌面端鼠标滚轮在扇形上自动转为横向滚动（方便无触屏环境验证滑动）。 ----
  const rowRef = useRef(null);
  const stripRef = useRef(null);
  const btnEls = useRef([]);
  const fanG = useRef({ cardW: 88, step: 26, pad: 120 });
  const fanInit = useRef(false);
  const rafRef = useRef(0);
  const removedSet = useRef({});
  removedSet.current = {};
  removed.forEach(function (tok) { removedSet.current[tok] = true; });
  const applyFan = function () {
    const row = rowRef.current;
    if (!row) return;
    const g = fanG.current;
    const ci = (row.scrollLeft + row.clientWidth / 2 - g.pad - g.cardW / 2) / g.step;
    for (let i = 0; i < btnEls.current.length; i++) {
      const btn = btnEls.current[i];
      if (!btn) continue;
      const d = i - ci;
      const ad = Math.abs(d);
      const ang = Math.max(-26, Math.min(26, d * 4.6));
      const dip = d * d * g.cardW * 0.075;
      const x = g.pad + i * g.step;
      let op = 1;
      if (ad > 3.6 && !removedSet.current[order[i]]) op = Math.max(0, Math.min(1, (4.8 - ad) / 1.2));
      if (removedSet.current[order[i]]) op = 0;
      btn.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (dip + 12).toFixed(1) + 'px,0) rotate(' + ang.toFixed(2) + 'deg)';
      btn.style.transformOrigin = '50% 100%';
      btn.style.opacity = String(op);
      btn.style.zIndex = String(70 - Math.min(70, Math.round(ad * 2)));
      btn.style.visibility = ad > 5.4 ? 'hidden' : 'visible';
    }
  };
  const layoutFan = function () {
    const row = rowRef.current, strip = stripRef.current;
    if (!row || !strip) return;
    const first = btnEls.current[0];
    const cardW = first ? first.offsetWidth : 88;
    const step = cardW * 0.22;
    const pad = row.clientWidth / 2 - cardW / 2;
    fanG.current = { cardW: cardW, step: step, pad: pad };
    strip.style.width = (pad * 2 + (deckLen - 1) * step + cardW) + 'px';
    strip.style.height = (first ? first.offsetHeight : 142) + 'px';
    applyFan();
  };
  useEffect(function () {
    layoutFan();
    if (!fanInit.current && rowRef.current) {
      fanInit.current = true;
      const m = Math.floor(deckLen / 2);
      rowRef.current.scrollLeft = fanG.current.pad + m * fanG.current.step + fanG.current.cardW / 2 - rowRef.current.clientWidth / 2;
    }
    const onScroll = function () {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(function () { rafRef.current = 0; applyFan(); });
    };
    // 桌面端：鼠标滚轮（竖向 deltaY）在扇形上转为横向滚动；触控板横向 deltaX 直通
    const onWheel = function (e) {
      const rowEl2 = rowRef.current;
      if (!rowEl2) return;
      const atStart = rowEl2.scrollLeft <= 0;
      const atEnd = rowEl2.scrollLeft + rowEl2.clientWidth >= rowEl2.scrollWidth - 1;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      // 已到扇形两端时放行页面竖向滚动，避免把页面滚动弹死
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      e.preventDefault();
      rowEl2.scrollLeft += delta;
    };
    const rowEl = rowRef.current;
    rowEl.addEventListener('scroll', onScroll, { passive: true });
    rowEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', layoutFan);
    return function () {
      rowEl.removeEventListener('scroll', onScroll);
      rowEl.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', layoutFan);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [deckLen]);
  useEffect(function () { applyFan(); }, [removed]);
  const pickCard = function (tok, e) {
    if (firedAll.current || busyRef.current || n >= total) return;
    const btn = e && e.currentTarget;
    const frame = slotEls.current[n];
    if (!btn || !frame) return;
    const target = n; // 第 i 次点选 → 翻开 draw 第 i 张（真实牌序不变）
    busyRef.current = true;
    const br = btn.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    // 幽灵牌（牌背）自扇形飞向当前真实阵位
    const ghost = btn.cloneNode(true);
    const gs = ghost.style;
    gs.cssText = 'position:fixed;left:' + br.left + 'px;top:' + br.top + 'px;width:' + br.width + 'px;height:' + br.height +
      'px;z-index:240;margin:0;padding:0;border:none;background:none;transform:none;transition:none;opacity:1;pointer-events:none;';
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    // 原扇卡退场（保留扇形位次，不塌不跳）
    setRemoved(function (prev) { return prev.concat([tok]); });
    const dx = (fr.left + fr.width / 2) - (br.left + br.width / 2);
    const dy = (fr.top + fr.height / 2) - (br.top + br.height / 2);
    const sc = fr.width / br.width;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ghost.style.transition = 'transform .44s cubic-bezier(.34,.66,.4,1)';
        ghost.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
      });
    });
    // 落位 → 该格自动翻开（微放大揭晓，CSS tpReveal）
    later(function () {
      if (ghostRef.current) {
        if (ghostRef.current.parentNode) ghostRef.current.parentNode.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
      setN(target + 1);
      later(function () { busyRef.current = false; }, 430);
      if (target + 1 >= total) {
        // 抽满 N 张 → 收扇 → 交读牌段
        later(function () { setClosing(true); }, 540);
        later(function () {
          if (firedAll.current) return;
          firedAll.current = true;
          props.onAllRevealed();
        }, 540 + 540);
      }
    }, 500);
  };
  const slotKids = [];
  for (let i = 0; i < total; i++) {
    const cell = cells[i] || { x: 50, y: 50, w: 13, rot: 0 };
    const wP = cell.w || 13;
    const rot = cell.rot || 0;
    const hF = (wP * ratio) / 0.619; // 卡高占板 %（同读牌板）
    const leftP = cell.x - wP / 2;
    const topP = cell.y - hF / 2;
    const revealed = i < n;
    const c = revealed ? ((props.cards && props.cards[i]) || null) : null;
    const label = (props.pos && props.pos[i]) || ('第' + (i + 1) + '位');
    const cardKids = [];
    if (c) {
      const imgInner = c.img
        ? React.createElement('img', { src: c.img, alt: c.name, loading: 'lazy', decoding: 'async' })
        : React.createElement('div', { className: 'rd-ph', style: { background: (TAROT_SUIT_COLOR[c.suit] || '#5B4B8A') } }, c.name);
      const face = React.createElement('div', {
        className: 'rd-imgwrap suit-' + (c.suit || 'major') + (c.reversed ? ' reversed' : ''),
        ref: function (el) { slotEls.current[i] = el; }
      }, imgInner);
      cardKids.push(rot
        ? React.createElement('div', { className: 'rd-rot' + (rot === 90 ? ' layer2' : ''), style: { transform: 'rotate(' + rot + 'deg)' } }, face)
        : face);
      cardKids.push(React.createElement('span', { key: 'b', className: 'rd-badge', style: { fontSize: bdgFs } }, i + 1));
    } else {
      cardKids.push(React.createElement('div', {
        key: 'd',
        className: 'tp-dash',
        ref: function (el) { slotEls.current[i] = el; }
      }, React.createElement('span', { className: 'tp-dnum' }, i + 1)));
    }
    if (sideCap) {
      cardKids.push(React.createElement('span', {
        key: 'sc',
        className: 'rd-sidecap',
        style: { left: (cell.x + wP / 2 + 1.8) + '%', top: cell.y + '%', width: (96 - (cell.x + wP / 2 + 1.8)) + '%' }
      }, (TAROT_READ_CN[i] || (i + 1)) + ' ' + label));
    } else if (capShow) {
      cardKids.push(React.createElement('div', { key: 'cap', className: 'rd-cap' }, label));
    }
    slotKids.push(React.createElement('div', {
      key: 's' + i,
      className: 'tp-cell' + (revealed ? ' filled' : '') + (i === n ? ' cur' : ''),
      style: { left: leftP + '%', top: topP + '%', width: wP + '%' }
    }, cardKids));
  }
  const fanBtns = order.map(function (tok, idx) {
    const isRemoved = removed.indexOf(tok) !== -1;
    return React.createElement('button', {
      key: 'fan' + tok,
      type: 'button',
      ref: function (el) { btnEls.current[idx] = el; },
      className: 'tp-fanbtn' + (isRemoved ? ' picked' : ''),
      disabled: isRemoved,
      'aria-label': '从扇形中取第 ' + Math.min(n + 1, total) + ' 张牌',
      onClick: function (e) { if (!isRemoved) pickCard(tok, e); }
    }, React.createElement('i', { className: 'tp-back' + (isLeno ? ' leno' : '') }));
  });
  return React.createElement('div', { className: 'tp-board' },
    React.createElement('div', { className: 'tp-progress' },
      React.createElement('div', { className: 'tp-progress-t' },
        '已取 ', React.createElement('b', null, n), '/', total, ' 张',
        n < total ? ' · 轻点下方扇形牌背取下一张' : ' · 全部取毕，正在收扇…'),
      React.createElement('div', { className: 'tp-acts' },
        React.createElement('button', { type: 'button', className: 'tp-act', onClick: props.onBackMenu }, '← 返回重选牌阵'),
        React.createElement('button', { type: 'button', className: 'tp-act', onClick: props.onRedo }, '重新洗牌'))),
    React.createElement('div', {
      className: 'rd-box tp-table' + (isLeno ? ' leno-table' : ''),
      style: { aspectRatio: String(ratio), '--rd-cap-fs': capFs + 'px' }
    }, slotKids),
    React.createElement('div', { className: 'tp-fan' + (closing ? ' closing' : '') },
      React.createElement('div', { className: 'tp-fan-cap' }, '牌背朝下 · 沿底部左右滑动浏览整副牌 · 依直觉轻点一张 · 选过即定不可反悔'),
      React.createElement('div', { className: 'tp-fanrow', ref: rowRef },
        React.createElement('div', { className: 'tp-fanstrip', ref: stripRef }, fanBtns))));
}
/* ================= REQ-129 C：读牌段（19 牌阵官方真实阵型摆位 + 一屏原则 + 点开放大连看） =================
   消费取牌段 lastTarotPickStream（getTarotPickStream()，动画关/手动录入等直出路径按当前成牌确定性重建）：
   { spread:{id,name,pos[]}, cards:[{index(1-based),position=pos[i],name,img,suit,reversed,keywords,upright,reversedText}] }
   摆位实现：每阵坐标按 docs/exchange/塔罗阵型摆位示意.md（2026-09-09 需求方确认）的 ASCII 点位换算为
   板内百分位卡心坐标（x/y/w 占板 %），板高以 aspect-ratio=ratio 收口（全牌一屏摆全、不横向翻页）；
   卡宽按张数分级（1~3 大 / 4~5 中大 / 6~7 中 / 10 中小 / 12 小，见各阵 w）。 */
const TAROT_READ_CN = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
/* 行式坐标：均匀留边/留缝排 n 张卡（yArc 可给两端微弧的逐卡 y） */
function tarotRowCells(n, w, y, yArc) {
  const g = (100 - n * w) / (n + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: +(g + w / 2 + i * (w + g)).toFixed(2), y: (yArc && yArc[i]) ? yArc[i] : y, w: w, rot: 0 });
  }
  return out;
}
/* 宫格坐标：ys 行 × xs 列逐行填充（抽牌位次先行后列） */
function tarotGridCells(xs, ys, w) {
  const out = [];
  ys.forEach(function (yy) { xs.forEach(function (xx) { out.push({ x: xx, y: yy, w: w, rot: 0 }); }); });
  return out;
}
/* 圆环坐标：① 在顶部、顺时针 1→N（需求方默认）；ratio 参与把同一半径换算为板高 % */
function tarotRingCells(n, cx, cy, rx, ratio, w) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = ((-90 + i * (360 / n)) * Math.PI) / 180;
    out.push({ x: +(cx + rx * Math.cos(th)).toFixed(2), y: +(cy + rx * ratio * Math.sin(th)).toFixed(2), w: w, rot: 0 });
  }
  return out;
}
/* 5 张小扇（万能/问题解决）：ASCII ① 上中、②⑤ 中排、③④ 底排，左右扇张微旋 */
const TAROT_FAN5_CELLS = [
  { x: 50, y: 17, w: 16, rot: 0 }, { x: 28, y: 40, w: 15.5, rot: -6 },
  { x: 11.5, y: 72, w: 15, rot: -12 }, { x: 88.5, y: 72, w: 15, rot: 12 }, { x: 72, y: 40, w: 15.5, rot: 6 }
];
const TAROT_GRID6_XS = [21.5, 50, 78.5];
/* 19 阵点位表（key=牌阵 id，与 TAROT_SPREADS 对齐）：
   卡高占板 % = w × ratio ÷ 0.619（对应 .rd-imgwrap aspect-ratio:100/161）。
   ratio（板宽:板高）| 阵名 | 实现：
   single 1.05           居中大卡（示意：正中偏上）
   three/mindBodySpirit 1.85  一行 3 张大卡（横排居中）
   holyTriangle 1.06     三角：上 1（根源）下 2（等腰）
   love/wealth/fourElements 2.0 一行 5 张（爱情两端微弧，love 用 yArc）
   universal/problemSolving 1.12 小扇 5 张（扇状放射 + 边张微旋）
   career/decision/relationship 1.25 对排 6 = 两排三列（ASCII 简化口径）
   horseshoe 1.0         马蹄 7 = 倒 U 弧（ASCII 点位；示意图自注弧向待确认，见交付报告）
   hexagram 0.86         六芒星 7 = 上正三角 + 下倒三角 + 中心（①②③ 与 ④⑤⑥ 分列上下两三角顶点、⑦ 中心）
   chakra 0.55           七脉轮竖列：按脉轮语义上 ⑦顶轮 → 下 ①海底轮（示意图仅列竖列，方向按确认默认）
   fourSeasons 1.35      四牌四季 2×2 宫格
   celtic 0.86           凯尔特十字：中心 ①②(横压) + 四臂 ③上 ④下 ⑤左 ⑥右 + 右旁柱 ⑦⑧⑨⑩ 自上而下（⑩ 顶部=结果）
   year/twelveHouses 0.93 12 宫圆环：① 顶部顺时针 */
const TAROT_READ_SPOTS = {
  single: { ratio: 1.05, cap: true, cells: [{ x: 50, y: 45, w: 33, rot: 0 }] },
  three: { ratio: 1.85, cap: true, cells: tarotRowCells(3, 22.5, 43) },
  mindBodySpirit: { ratio: 1.85, cap: true, cells: tarotRowCells(3, 22.5, 43) },
  holyTriangle: { ratio: 1.06, cap: true, cells: [{ x: 50, y: 22, w: 23, rot: 0 }, { x: 26, y: 75, w: 23, rot: 0 }, { x: 74, y: 75, w: 23, rot: 0 }] },
  love: { ratio: 2.0, cap: true, cells: tarotRowCells(5, 16.5, 45.5, [43.6, 45.1, 46, 45.1, 43.6]) },
  wealth: { ratio: 2.0, cap: true, cells: tarotRowCells(5, 16.5, 45.5) },
  fourElements: { ratio: 2.0, cap: true, cells: tarotRowCells(5, 16.5, 45.5) },
  universal: { ratio: 1.12, cap: true, cells: TAROT_FAN5_CELLS },
  problemSolving: { ratio: 1.12, cap: true, cells: TAROT_FAN5_CELLS },
  career: { ratio: 1.25, cap: true, cells: tarotGridCells(TAROT_GRID6_XS, [36, 72], 14) },
  decision: { ratio: 1.25, cap: true, cells: tarotGridCells(TAROT_GRID6_XS, [36, 72], 14) },
  relationship: { ratio: 1.25, cap: true, cells: tarotGridCells(TAROT_GRID6_XS, [36, 72], 14) },
  horseshoe: { ratio: 1.0, cap: false, cells: [{ x: 21, y: 20, w: 13.5, rot: 0 }, { x: 50, y: 17, w: 13.5, rot: 0 }, { x: 79, y: 20, w: 13.5, rot: 0 }, { x: 68, y: 51, w: 13.5, rot: 0 }, { x: 63, y: 79, w: 13.5, rot: 0 }, { x: 37, y: 79, w: 13.5, rot: 0 }, { x: 32, y: 51, w: 13.5, rot: 0 }] },
  hexagram: { ratio: 0.86, cap: false, cells: [{ x: 50, y: 12, w: 12.5, rot: 0 }, { x: 16, y: 31, w: 12.5, rot: 0 }, { x: 84, y: 31, w: 12.5, rot: 0 }, { x: 50, y: 52, w: 12.5, rot: 0 }, { x: 16, y: 71, w: 12.5, rot: 0 }, { x: 84, y: 71, w: 12.5, rot: 0 }, { x: 50, y: 88, w: 12.5, rot: 0 }] },
  chakra: { ratio: 0.55, cap: false, sideCap: true, cells: (function () { const out = []; for (let k = 0; k < 7; k++) out.push({ x: 36, y: +(9.5 + (6 - k) * 13.5).toFixed(2), w: 13.5, rot: 0 }); return out; })() },
  fourSeasons: { ratio: 1.35, cap: true, cells: tarotGridCells([30, 70], [34, 73], 17) },
  celtic: { ratio: 0.86, cap: false, cells: [{ x: 30, y: 50, w: 12, rot: 0 }, { x: 30, y: 50, w: 12, rot: 90 }, { x: 30, y: 26, w: 12, rot: 0 }, { x: 30, y: 74, w: 12, rot: 0 }, { x: 16, y: 50, w: 12, rot: 0 }, { x: 44, y: 50, w: 12, rot: 0 }, { x: 85, y: 76, w: 10.5, rot: 0 }, { x: 85, y: 55, w: 10.5, rot: 0 }, { x: 85, y: 34, w: 10.5, rot: 0 }, { x: 85, y: 12, w: 10.5, rot: 0 }] },
  year: { ratio: 0.93, cap: false, cells: tarotRingCells(12, 50, 50, 38, 0.93, 11.5) },
  twelveHouses: { ratio: 0.93, cap: false, cells: tarotRingCells(12, 50, 50, 38, 0.93, 11.5) }
};
/* 读牌板：按阵型点位全牌一屏摆放（已翻开正面卡；序号角标 + 可点放大） */
function TarotReadBoard({ spread, cards, onOpen }) {
  const n = cards.length;
  const spot = (spread && TAROT_READ_SPOTS[spread.id]) || null;
  let ratio = 0.9;
  let cells = null;
  let sideCap = false;
  if (spot) {
    ratio = spot.ratio;
    cells = spot.cells;
    sideCap = !!spot.sideCap;
  } else {
    // 兜底：未知牌阵按张数行排布（仍一屏摆全、可点放大）
    if (n <= 1) { ratio = 1.05; cells = [{ x: 50, y: 45, w: 30, rot: 0 }]; }
    else if (n <= 5) { ratio = 1.9; cells = tarotRowCells(n, n <= 3 ? 22 : 15.5, 46); }
    else {
      ratio = 1.25;
      const rows = Math.ceil(n / 3);
      const ys = []; for (let r = 0; r < rows; r++) ys.push(rows === 1 ? 50 : 36 + r * (72 / (rows - 1)));
      const all = [];
      for (let r = 0; r < rows; r++) for (let cc = 0; cc < 3; cc++) { const k = r * 3 + cc; if (k < n) all.push({ x: TAROT_GRID6_XS[cc], y: ys[r], w: n <= 6 ? 15 : 13, rot: 0 }); }
      cells = all;
    }
  }
  const capShow = sideCap ? false : (spot ? spot.cap !== false : n <= 5);
  const capFs = n <= 1 ? 12.5 : (n <= 3 ? 11 : (n <= 5 ? 9.5 : 8.6));
  const bdgFs = n <= 3 ? 12 : (n <= 5 ? 11 : (n <= 7 ? 10 : 9.5));
  const kids = cards.map(function (c, i) {
    const cell = (cells && cells[i]) || { x: 50, y: 50, w: 13, rot: 0 };
    const wP = cell.w || 13;
    const rot = cell.rot || 0;
    const hF = (wP * ratio) / 0.619; // 卡高占板 %
    const leftP = cell.x - wP / 2;
    const topP = cell.y - hF / 2;
    const label = c.position || ('第' + (i + 1) + '位');
    const imgInner = c.img
      ? React.createElement('img', { src: c.img, alt: c.name, loading: 'lazy', decoding: 'async' })
      : React.createElement('div', { className: 'rd-ph', style: { background: TAROT_SUIT_COLOR[c.suit] || '#5B4B8A' } }, c.name);
    const face = React.createElement('div', { className: 'rd-imgwrap suit-' + (c.suit || 'major') + (c.reversed ? ' reversed' : '') }, imgInner);
    const inner = rot ? React.createElement('div', { className: 'rd-rot' + (rot === 90 ? ' layer2' : ''), style: { transform: 'rotate(' + rot + 'deg)' } }, face) : face;
    const cellKids = [inner];
    cellKids.push(React.createElement('span', { key: 'b', className: 'rd-badge', style: { fontSize: bdgFs } }, (i + 1)));
    if (sideCap) {
      cellKids.push(React.createElement('span', { key: 'sc', className: 'rd-sidecap', style: { left: (cell.x + wP / 2 + 1.8) + '%', top: cell.y + '%', width: (96 - (cell.x + wP / 2 + 1.8)) + '%' } }, TAROT_READ_CN[i] + ' ' + label));
    } else if (capShow) {
      cellKids.push(React.createElement('div', { key: 'cap', className: 'rd-cap' }, label));
    }
    return React.createElement('div', { key: 'c' + i, className: 'rd-cell', style: { left: leftP + '%', top: topP + '%', width: wP + '%' }, role: 'button', 'aria-label': '第' + (i + 1) + '位·' + label, onClick: function () { if (onOpen) onOpen(i); } }, cellKids);
  });
  return React.createElement('div', { className: 'rd-box', style: { aspectRatio: String(ratio), '--rd-cap-fs': capFs + 'px' } }, kids);
}
/* 放大连看浮层：点卡/清单条目打开 → 约 2.5s 自动收起；「上一张/下一张」手动连看可重温 */
function TarotReadZoom({ cards, idx, onClose, onGo }) {
  const card = (cards && cards[idx]) || null;
  const [closing, setClosing] = useState(false);
  const closeOnce = useRef(false);
  const fireClose = function () {
    if (closeOnce.current) return;
    closeOnce.current = true;
    setClosing(true);
    setTimeout(function () { if (onClose) onClose(); }, 190);
  };
  const fireRef = useRef(fireClose);
  fireRef.current = fireClose;
  useEffect(function () {
    if (!card) return undefined;
    const t = setTimeout(function () { fireRef.current(); }, 2500);
    return function () { clearTimeout(t); };
  }, [idx]);
  if (!card) return null;
  const n = cards.length;
  const rev = !!card.reversed;
  const bodyText = rev ? (card.reversedText || '') : (card.upright || '');
  const kwLine = (card.keywords && card.keywords.length) ? card.keywords.join(' / ') : '';
  const go = function (e, ni) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (ni < 0 || ni >= n || !onGo) return;
    onGo(ni);
  };
  const title = React.createElement('div', { className: 'rd-ztitle' }, React.createElement('b', null, '第 ' + (card.index || (idx + 1)) + ' 位'), ' · ', card.position || '');
  const closeBtn = React.createElement('button', { type: 'button', className: 'rd-zclose', 'aria-label': '收起大图', onClick: function (e) { e.stopPropagation(); fireClose(); } }, '✕');
  const sub = React.createElement('div', { className: 'rd-zsub' }, '约 2.5 秒后自动收起 · 可点「上一张 / 下一张」连看');
  const imgEl = card.img
    ? React.createElement('img', { key: 'im' + idx, className: 'rd-zimg' + (rev ? ' reversed' : ''), src: card.img, alt: card.name })
    : React.createElement('div', { className: 'rd-zimg rd-zph', style: { background: TAROT_SUIT_COLOR[card.suit] || '#5B4B8A' } }, card.name);
  const nameRow = React.createElement('div', { className: 'rd-zname' }, card.name || '', React.createElement('span', { className: 'rd-zori ' + (rev ? 'rev' : 'up') }, rev ? '逆位' : '正位'));
  const bodyEl = bodyText ? React.createElement('div', { className: 'rd-zbody' }, bodyText) : null;
  const kwEl = kwLine ? React.createElement('div', { className: 'rd-zkw' }, '关键词：', kwLine) : null;
  const boxKids = [
    React.createElement('div', { key: 'bar' + idx, className: 'rd-count' }),
    React.createElement('div', { key: 'top', className: 'rd-ztop' }, title, closeBtn),
    sub,
    imgEl,
    nameRow
  ];
  if (bodyEl) boxKids.push(bodyEl);
  if (kwEl) boxKids.push(kwEl);
  boxKids.push(React.createElement('div', { key: 'nav', className: 'rd-znav' },
    React.createElement('button', { type: 'button', className: 'rd-zbtn', disabled: idx <= 0, onClick: function (e) { go(e, idx - 1); } }, '‹ 上一张'),
    React.createElement('span', { className: 'rd-zcount' }, (idx + 1) + '/' + n),
    React.createElement('button', { type: 'button', className: 'rd-zbtn', disabled: idx >= n - 1, onClick: function (e) { go(e, idx + 1); } }, '下一张 ›')));
  const box = React.createElement('div', { className: 'rd-zoom-box', onClick: function (e) { e.stopPropagation(); } }, boxKids);
  return React.createElement('div', { className: 'rd-zoom' + (closing ? ' closing' : ''), onClick: function () { fireClose(); } }, box);
}
function TarotPage({
  onNavigate
}) {
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [step, setStep] = useState('menu'); // menu -> pick(手动选牌) | draw
  const [spread, setSpread] = useState(null);
  const [question, setQuestion] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  // REQ-069：手动选牌（真实世界已抽好 → 从牌库按牌位录入 + 定正/逆位）与自动抽牌并行
  // REQ-066②：默认入口按功能设置 default_mode —— manual=手动选牌 / auto=自动抽牌（现状）/ both=并行不预设
  const [mode, setMode] = useState(function () { return tcAskNextDefault('auto'); }); // 'auto' | 'manual'
  const [picks, setPicks] = useState([]); // {id,name,reversed}
  const [pickOri, setPickOri] = useState('up'); // 当前待选牌的正/逆位
  const [dkFilter, setDkFilter] = useState('all');
  const [wasManual, setWasManual] = useState(false); // 当前结果是否由手动录入产生（决定「重新抽卡」去向）
  // REQ-129：塔罗取牌段阶段机（shuffle=洗牌 → cut=切牌三摞（可跳过） → fan=扇形自选 → done=收扇交读牌段）
  // 与 REQ-061 翻牌演出不同：done 即结果段（动画关/牌面图关/manual 录入/收扇后均直接落此）；一键全翻与
  // 「背朝上待翻」已停用（REQ-129⑤），揭示改为取牌段内逐张自动翻开；雷诺曼页另有自己的翻牌阶段机。
  const [dealStage, setDealStage] = useState('done');
  // REQ-129 C：读牌段「点开放大连看」当前牌索引（null=收起；0-based，对应 readStream.cards）
  const [zoomIdx, setZoomIdx] = useState(null);
  // REQ-042 v2：已删除「预测方向」步骤与入口扇形 —— 流程 = ① 占问问题（选填，REQ-079）→ ② 选择牌阵
  const draw = async sp => {
    if (loading || !sp) return;
    setSpread(sp);
    setStep('draw');
    setData(null);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setLoading(true);
    setWasManual(false);
    setDealStage('done');
    setZoomIdx(null);
    lastTarotPickStream = null;
    // REQ-042 v2：问题文本直接透传给后端（方向已删，不再拼接「占问方向：」前缀）
    const askTrim = (question || '').trim();
    const askBodyQ = askTrim ? askTrim : null;
    try {
      const res = await api('/tarot/draw', {
        method: 'POST',
        body: JSON.stringify({ spread_type: sp.id, question: askBodyQ })
      });
      const d = (res && res.data) || res;
      setData(d);
      // REQ-129：取数先行（结果不变）→ 动画开（且图开）进入「洗牌→切牌→扇形自选」取牌段；关=直接 v2 布局出结果
      if (tcShouldPlayAnim() && tcShouldShowCards()) setDealStage('shuffle'); else setDealStage('done');
    } catch (e) {
      setErrored((e && e.message) || '塔罗抽牌失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  // REQ-069：进入手动选牌步骤（问题选填，留空可直接按牌位选牌）
  const openManualPick = sp => {
    if (loading || !sp) return;
    setSpread(sp);
    setPicks([]);
    setPickOri('up');
    setDkFilter('all');
    setErrored('');
    setInterp('');
    setInterpErr('');
    setData(null);
    setWasManual(true);
    setDealStage('done');
    setZoomIdx(null);
    setStep('pick');
  };
  // 点牌库卡片 → 写入当前牌位并推进
  const placeCard = (di) => {
    if (!spread) return;
    if (picks.length >= spread.pos.length) return;
    const card = TAROT_DECK[di];
    if (!card) return;
    setPicks(function (prev) {
      return prev.concat([{ id: di + 1, name: card.name, reversed: pickOri === 'rev' }]);
    });
  };
  const undoPick = () => setPicks(function (prev) { return prev.slice(0, Math.max(0, prev.length - 1)); });
  const clearPicks = () => setPicks([]);
  // REQ-069：手动选牌完成 → drawTarotSpread options.manualCards = [{id,reversed}]（后端按牌位确定性成牌）
  const submitManual = async () => {
    if (loading || !spread) return;
    if (!picks || picks.length !== spread.pos.length) {
      toast('请把「' + spread.name + '」的 ' + spread.pos.length + ' 个牌位逐张选完');
      return;
    }
    track('manual_input', { method: 'tarot' });
    setLoading(true);
    setErrored('');
    setInterp('');
    setInterpErr('');
    const askTrim = (question || '').trim();
    try {
      const res = await api('/tarot/draw', {
        method: 'POST',
        body: JSON.stringify({
          spread_type: spread.id,
          question: askTrim ? askTrim : null,
          options: { manualCards: picks.map(function (p) { return { id: p.id, reversed: !!p.reversed }; }) }
        })
      });
      const d = (res && res.data) || res;
      setData(d);
      setStep('draw');
      // REQ-061：手动路径不重演抽牌动画（用户已真实抽牌）→ 直接 v2 正面布局
      setDealStage('done');
      setZoomIdx(null);
      lastTarotPickStream = null;
    } catch (e) {
      setErrored((e && e.message) || '塔罗手动选牌提交失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  const interpret = async () => {
    if (!data || !data.id || interpLoading) return;
    setInterpLoading(true);
    setInterpErr('');
    try {
      const res = await api('/tarot/readings' + '/' + data.id + '/interpret', { method: 'POST', body: '{}' });
      setInterp((res && res.data && res.data.interpretation) || '（暂无解读内容）');
    } catch (e) {
      setInterpErr((e && e.message) || '综合解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  const backMenu = () => {
    setStep('menu');
    setSpread(null);
    setData(null);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setPicks([]);
    setPickOri('up');
    setDkFilter('all');
    setDealStage('done');
    setZoomIdx(null);
    lastTarotPickStream = null;
    // REQ-066②：按 default_mode 决定返回后的出牌方式（manual=手动 / auto=自动 / both=保留上次）
    setMode(tcAskNextDefault(mode));
    setWasManual(false);
  };
  // 重新出牌：手动结果回到选牌步骤重录；自动结果重新自动抽牌
  const redo = () => {
    if (!spread) return backMenu();
    if (wasManual) {
      setData(null);
      setErrored('');
      setInterp('');
      setInterpErr('');
      setPicks([]);
      setPickOri('up');
      setDkFilter('all');
      setDealStage('done');
      setZoomIdx(null);
      setStep('pick');
    } else {
      draw(spread);
    }
  };
  const drawData = (data && data.draw) || null;
  const cards = drawData && Array.isArray(drawData.cards) ? drawData.cards : [];
  const spreadName = (drawData && drawData.spreadName) || (spread && spread.name) || '抽卡结果';
  // REQ-066⑥：牌面图片显示（塔罗/雷诺曼）—— 关 = 纯文字列表模式（隐藏牌面图/扇形）
  const cardImagesOn = TC_SETTINGS.card_images !== false;
  const askQ = (question || '').trim();
  // REQ-042 v2：draw 顶部承接所填占问问题文本（保留）
  const askEcho = askQ ? React.createElement('div', { className: 'ask-echo' }, '问题：', askQ) : null;
  // REQ-129 C：读牌段数据流 —— 优先消费取牌段 lastTarotPickStream（getTarotPickStream()）；
  // 动画关/手动录入等直出路径在缓存缺失或不匹配当前牌阵时，按当前成牌确定性重建（只读消费，不改抽牌结果/计费/数据流结构）
  let readStream = getTarotPickStream();
  if (readStream && (!spread || !readStream.spread || readStream.spread.id !== spread.id)) readStream = null;
  if (!readStream && data && spread && cards.length) readStream = buildTarotPickStream(spread, cards);
  const readSpread = (readStream && readStream.spread) || null;
  const readCards = (readStream && Array.isArray(readStream.cards)) ? readStream.cards : [];
  // REQ-042 v2：下方集中牌义段落 —— 自第一张起逐张：卡位 + 牌名 + 正/逆位标签 + 含义正文 + 关键词
  // REQ-129 C：读牌段保持该清单展示（收扇后各牌均已翻开 → 逐条全量放行，对齐「随翻牌逐条放行」语义）；
  // 条目可点按放大对应牌（与摆位区点卡同源）
  const meanTappable = cardImagesOn && readCards.length > 0;
  const meanItems = cards.map(function (c, i) {
    const n = normTarotCard(c);
    const kwLine = (n.keywords && n.keywords.length) ? n.keywords.join(' / ') : '';
    const meanText = n.reversed ? (n.reversedText || '') : (n.upright || '');
    const itemProps = meanTappable
      ? { key: 'mean' + i, className: 'mean-item rd-mean-item rd-item-in', style: { animationDelay: (i * 70) + 'ms' }, role: 'button', 'aria-label': '查看第' + (i + 1) + '张牌详解', onClick: function () { setZoomIdx(i); } }
      : { key: 'mean' + i, className: 'mean-item' };
    return React.createElement('div', itemProps,
      React.createElement('div', { className: 'mi-head' },
        React.createElement('span', { className: 'mi-pos' }, n.pos || ('第' + (i + 1) + '张')),
        React.createElement('span', { className: 'mi-name' }, n.name),
        React.createElement('span', { className: 'mi-orient' + (n.reversed ? ' rev' : ' up') }, n.reversed ? '逆位' : '正位')),
      meanText ? React.createElement('div', { className: 'mi-txt' }, meanText) : null,
      kwLine ? React.createElement('div', { className: 'mi-kw' }, '关键词：', kwLine) : null);
  });
  // REQ-129：扇形抽满 N 张自动收扇 → 落定真实牌序数据流（读牌段经 getTarotPickStream() 消费，position 即 pos[i]）→ 进入结果段
  const handlePickAllRevealed = function () {
    const stream = buildTarotPickStream(spread, cards);
    if (stream) lastTarotPickStream = stream;
    setDealStage('done');
  };
  let drawBody = null;
  if (loading) {
    drawBody = React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'section-title' }, spreadName, ' · 抽卡中'),
      React.createElement('div', { className: 'skeleton sk-line' }),
      React.createElement('div', { className: 'skeleton sk-line', style: { width: '60%' } }));
  } else if (errored && step === 'draw') {
    drawBody = React.createElement('div', { className: 'card failed-box' },
      React.createElement('div', { className: 'section-title' }, '抽牌失败'),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: redo }, UI_COPY.buttons.retry));
  } else if (data) {
    // ================= REQ-129：取牌段（shuffle/cut/fan）与结果段（done）分流 =================
    // 取牌段演出仅当 动画开 && 牌面图开 && 牌阵有 pos && 非手动路径 时进入（手动路径直接 done）
    const animOn = tcShouldPlayAnim();
    const hasPos = Boolean(spread && spread.pos && spread.pos.length);
    const pickPlaying = cardImagesOn && animOn && hasPos && (dealStage === 'shuffle' || dealStage === 'cut' || dealStage === 'fan');
    if (pickPlaying) {
      const bodyKids = [
        React.createElement('div', { key: 't', className: 'section-title' }, spreadName),
        askEcho
      ];
      if (dealStage === 'shuffle') {
        bodyKids.push(React.createElement(TarotShuffleStage, {
          key: 'pk',
          onDone: function () { setDealStage('cut'); },
          onSkip: function () { setDealStage('done'); }
        }));
      } else if (dealStage === 'cut') {
        bodyKids.push(React.createElement(TarotCutStage, {
          key: 'pk',
          onDone: function () { setDealStage('fan'); },
          onSkip: function () { setDealStage('done'); },
          onSkipCut: function () { setDealStage('fan'); }
        }));
      } else if (dealStage === 'fan') {
        bodyKids.push(React.createElement(TarotPickBoard, {
          key: 'pk' + (data.id || 'draw'),
          pos: spread.pos,
          cards: cards.map(function (c) { return normTarotCard(c); }),
          deckLen: TAROT_DECK.length,
          spots: (spread && TAROT_READ_SPOTS[spread.id]) || null,
          kind: 'taro',
          onAllRevealed: handlePickAllRevealed,
          onRedo: function () { redo(); },
          onBackMenu: backMenu
        }));
      }
      drawBody = React.createElement('div', { className: 'card' }, bodyKids);
    } else {
      // 结果段（done）：收扇后 / 动画关 / 牌面图关 / 手动录入 —— 读牌段（REQ-129 C：19 阵摆位一屏 + 点开放大连看）；牌面图关走纯文字
      const bodyKids = [
        React.createElement('div', { key: 't', className: 'section-title' }, spreadName),
        askEcho
      ];
      if (cardImagesOn && readCards.length && readSpread) {
        // REQ-129 C 读牌段：19 牌阵官方真实摆位一屏展示（已翻开正面卡）→ 点卡放大连看
        bodyKids.push(React.createElement('div', { key: 'rdh', className: 'rd-hint' }, '全牌按「' + readSpread.name + '」官方阵型一屏摆位 · 点任意一张放大读解（约 2.5 秒后自动收起，可「上一张 / 下一张」连看）'));
        bodyKids.push(React.createElement(TarotReadBoard, { key: 'rdb', spread: readSpread, cards: readCards, onOpen: function (i) { setZoomIdx(i); } }));
        bodyKids.push(React.createElement('div', { key: 'mp', className: 'mean-panel' },
          React.createElement('div', { className: 'mp-title' }, '各张牌义'),
          meanItems));
      } else {
        // REQ-066⑥ 关 / 无牌面数据兜底：纯文字列表模式（无任何卡面/牌背/扇形渲染）
        bodyKids.push(React.createElement('div', { key: 'mp', className: 'mean-panel' },
          React.createElement('div', { className: 'mp-title' }, cardImagesOn ? '抽到的牌' : '抽到的牌（纯文字模式）'),
          meanItems));
      }
      if (interpErr) bodyKids.push(React.createElement('div', { key: 'e', className: 'error', style: { marginTop: 10 } }, interpErr));
      bodyKids.push(React.createElement('div', { key: 'ph', className: 'pay-hint' }, '综合解读为付费 LLM，按实际用量扣余额（¥）（点击前将预检余额）'));
      bodyKids.push(React.createElement('button', { key: 'ib', className: 'btn btn-outline', style: { marginTop: 8 }, disabled: interpLoading, onClick: interpret }, interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)]));
      if (interp) bodyKids.push(React.createElement(React.Fragment, { key: 'ir' },
        React.createElement('div', { className: 'interp-title' }, '综合解读'),
        React.createElement('div', { className: 'interp-body' }, interp)));
      drawBody = React.createElement('div', { className: 'card' }, bodyKids);
    }
  }
  // REQ-042 v2：menu 顶部无扇形 —— 直入 ① 占问问题（选填，REQ-079）→ ② 选择牌阵（单列按钮 + 适用说明）
  // REQ-069：选择牌阵上方提供「自动抽牌 / 手动选牌」并行切换（手动=从牌库按牌位录入实际结果）
  const menuBody = React.createElement('div', { className: 'card' },
    React.createElement('div', { className: 'section-title step-title' }, React.createElement('span', { className: 'st-no' }, '1'), '占问问题（选填）'),
    React.createElement('textarea', {
      className: 'q-input',
      rows: 2,
      maxLength: 300,
      placeholder: '示例：我与TA的关系走向？ / 这段事业该如何选择？',
      value: question,
      onChange: function (e) { setQuestion(e.target.value); }
    }),
    React.createElement('div', { className: 'section-title step-title', style: { marginTop: 10 } }, React.createElement('span', { className: 'st-no' }, '2'), '选择牌阵'),
    React.createElement('div', { className: 'ask-cap', style: { marginTop: 2 } }, '出牌方式'),
    /* BUG-017：默认模式=auto/manual 时另一入口收起到切换入口，仅 both 保留双栏（REQ-066②） */
    TC_SETTINGS.default_mode === 'both'
      ? React.createElement('div', { className: 'mode-switch' },
          React.createElement('button', { type: 'button', className: mode === 'auto' ? 'sel' : '', onClick: function () { setMode('auto'); } }, UI_COPY.buttons.auto_pick),
          React.createElement('button', { type: 'button', className: mode === 'manual' ? 'sel' : '', onClick: function () { setMode('manual'); } }, UI_COPY.buttons.manual_pick))
      : React.createElement('button', { type: 'button', className: 'mode-switch-link', onClick: function () { setMode(mode === 'auto' ? 'manual' : 'auto'); } },
          mode === 'auto' ? ('改为' + UI_COPY.buttons.manual_pick) : ('返回' + UI_COPY.buttons.auto_pick)),
    React.createElement('div', { className: 'spread-groups' }, TAROT_SPREAD_GROUPS.map(function (g) {
      const spreads = g.ids.map(function (id) {
        return TAROT_SPREADS.find(function (s) { return s.id === id; });
      }).filter(Boolean);
      return React.createElement(TarotSpreadGroup, {
        key: g.title,
        title: g.title,
        spreads: spreads,
        mode: mode,
        onPick: function (s) { if (mode === 'manual') openManualPick(s); else draw(s); }
      });
    })));
  // REQ-069：手动选牌面板（真实抽牌结果的牌位录入）
  const posLen = (spread && spread.pos && spread.pos.length) || 0;
  const slotChips = [];
  if (spread && Array.isArray(spread.pos)) {
    spread.pos.forEach(function (p, i) {
      const done = i < picks.length;
      slotChips.push(React.createElement('span', {
        key: 'slot' + i,
        className: 'pk-slot' + (done ? ' filled' : '') + (i === picks.length ? ' cur' : '')
      }, done ? (i + 1) + '. ' + p + '：' + picks[i].name + (picks[i].reversed ? '（逆）' : '') : (i + 1) + '. ' + p));
    });
  }
  const usedSet = {};
  picks.forEach(function (p) { usedSet[p.id] = true; });
  const suitFilters = [{ id: 'all', name: '全部' }, { id: 'major', name: '大阿卡纳' }, { id: 'wands', name: '权杖' }, { id: 'cups', name: '圣杯' }, { id: 'swords', name: '宝剑' }, { id: 'pentacles', name: '钱币' }];
  const dkCells = [];
  TAROT_DECK.forEach(function (d, di) {
    if (dkFilter !== 'all' && d.suit !== dkFilter) return;
    if (usedSet[di + 1]) return;
    dkCells.push(React.createElement('div', {
      key: 'dk' + di,
      className: 'dk-cell',
      onClick: function () { placeCard(di); }
    },
      React.createElement('div', { className: 'dk-thumb' }, d.thumb && cardImagesOn ? React.createElement('img', { src: d.thumb, alt: d.name, loading: 'lazy', decoding: 'async' }) : React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#fff', fontSize: 17, fontWeight: 700 } }, d.name.slice(0, 1))),
      React.createElement('div', { className: 'dk-n' }, d.name)));
  });
  const pickBody = React.createElement('div', { className: 'card pick-box' },
    React.createElement('div', { className: 'section-title' }, (spread ? spread.name : '') + ' · 手动选牌'),
    askEcho,
    errored && step === 'pick' ? React.createElement('div', { className: 'error', style: { marginBottom: 8 } }, errored) : null,
    React.createElement('div', { className: 'pick-progress' },
      '正在选第 ', React.createElement('b', null, Math.min(picks.length + 1, posLen)), '/', posLen, ' 张：', React.createElement('b', null, spread && spread.pos[picks.length] ? spread.pos[picks.length] : ''), ' — 请先在下方定这张牌的正/逆位，再点选牌库中的牌。'),
    React.createElement('div', { className: 'or-row' },
      React.createElement('button', { type: 'button', className: 'or-btn up' + (pickOri === 'up' ? ' sel' : ''), onClick: function () { setPickOri('up'); } }, UI_COPY.buttons.upright),
      React.createElement('button', { type: 'button', className: 'or-btn rev' + (pickOri === 'rev' ? ' sel' : ''), onClick: function () { setPickOri('rev'); } }, UI_COPY.buttons.reversed)),
    React.createElement('div', { className: 'pick-slots' }, slotChips),
    React.createElement('div', { className: 'dk-filters' }, suitFilters.map(function (f) {
      return React.createElement('button', {
        key: f.id,
        type: 'button',
        className: 'dk-f' + (dkFilter === f.id ? ' sel' : ''),
        onClick: function () { setDkFilter(f.id); }
      }, f.name);
    })),
    React.createElement('div', { className: 'dk-hint' }, '牌库共 ' + TAROT_DECK.length + ' 张，每张限用一次；选完 ' + posLen + ' 个牌位后可提交（复用牌义展示与付费综合解读）。'),
    dkCells.length ? React.createElement('div', { className: 'dk-grid' }, dkCells)
      : React.createElement('div', { className: 'dk-hint' }, '当前筛选下无可用牌（或该牌阵已选满）。'),
    React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } },
      React.createElement('button', { className: 'btn btn-outline', type: 'button', style: { flex: 1 }, onClick: undoPick, disabled: !picks.length }, UI_COPY.buttons.step_back),
      React.createElement('button', { className: 'btn btn-outline', type: 'button', style: { flex: 1 }, onClick: clearPicks, disabled: !picks.length }, UI_COPY.buttons.reselect_all)),
    React.createElement('div', { className: 'back-row fill', style: { marginTop: 8 } },
      React.createElement('button', { className: 'btn btn-outline', onClick: backMenu }, UI_COPY.buttons.reselect_spread),
      React.createElement('button', { className: 'btn btn-primary', onClick: submitManual, disabled: loading || picks.length !== posLen || !posLen }, loading ? UI_COPY.tips.submitting : UI_COPY.buttons.finish_pick + '（' + picks.length + '/' + posLen + '）')));
  // REQ-042 v2：draw 底部三按钮全宽并列大按钮（重新抽卡/重选牌阵/返回，保持）
  // REQ-129：取牌段演出中（shuffle/cut/fan）隐藏底栏大按钮 —— 演出段内自带「返回重选牌阵 / 重新洗牌」小入口
  const inPickPlay = Boolean(data && cardImagesOn && tcShouldPlayAnim() && dealStage !== 'done');
  // 节100③：取牌演出段（洗牌/切牌/扇形）底栏统一为标准「返回选项 / 回到首页」（同星座页底部）
  const hubHomeRow = React.createElement('div', { className: 'back-row fill' },
    React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('xishi-hub'); } }, UI_COPY.buttons.back_options),
    React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('landing'); } }, UI_COPY.buttons.back_home));
  const drawFoot = React.createElement(React.Fragment, null,
    drawBody,
    inPickPlay ? hubHomeRow : React.createElement('div', { className: 'back-row fill' },
      React.createElement('button', { className: 'btn btn-outline', onClick: redo }, UI_COPY.buttons.redo),
      React.createElement('button', { className: 'btn btn-outline', onClick: backMenu }, UI_COPY.buttons.rechoose),
      React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('xishi-hub'); } }, UI_COPY.buttons.back_options)));
  // REQ-129 C：放大连看浮层（点牌/点清单条目打开；约 2.5s 自动收起；「上一张/下一张」手动连看）
  const zoomCard = (zoomIdx !== null && cardImagesOn && readCards[zoomIdx]) ? readCards[zoomIdx] : null;
  const zoomOverlay = zoomCard
    ? React.createElement(TarotReadZoom, {
        key: 'zoom' + zoomIdx,
        cards: readCards,
        idx: zoomIdx,
        onClose: function () { setZoomIdx(null); },
        onGo: function (ni) { if (ni >= 0 && ni < readCards.length) setZoomIdx(ni); }
      })
    : null;
  // 节100③：menu 阶段底栏统一为标准「返回选项 / 回到首页」（同星座页底部，取代虚线链接）
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'spark', size: 22 }), ' 塔罗牌'),
    step === 'menu' ? React.createElement(React.Fragment, null, menuBody, hubHomeRow) : (step === 'pick' ? pickBody : drawFoot),
    zoomOverlay,
    // REQ-042：公版署名以页脚小字展示（保持）
    React.createElement('div', { className: 'deck-credit' }, 'Rider-Waite-Smith 1909 公版'));
}

/* ---------- 雷诺曼（36 张占位卡） ---------- */
const LENORMAND_DECK = [{
  num: 1,
  name: '骑手',
  suit: 'Hearts',
  kw: '消息 / 到来',
  img: './lenormand/webp/01-Rider.webp',
  thumb: './lenormand/thumb/01-Rider.webp'
}, {
  num: 2,
  name: '三叶草',
  suit: 'Diamonds',
  kw: '小确幸',
  img: './lenormand/webp/02-Clover.webp',
  thumb: './lenormand/thumb/02-Clover.webp'
}, {
  num: 3,
  name: '船',
  suit: 'Spades',
  kw: '远方 / 旅行',
  img: './lenormand/webp/03-Ship.webp',
  thumb: './lenormand/thumb/03-Ship.webp'
}, {
  num: 4,
  name: '房子',
  suit: 'Hearts',
  kw: '家',
  img: './lenormand/webp/04-House.webp',
  thumb: './lenormand/thumb/04-House.webp'
}, {
  num: 5,
  name: '树',
  suit: 'Hearts',
  kw: '健康 / 成长',
  img: './lenormand/webp/05-Tree.webp',
  thumb: './lenormand/thumb/05-Tree.webp'
}, {
  num: 6,
  name: '云',
  suit: 'Clubs',
  kw: '困惑',
  img: './lenormand/webp/06-Clouds.webp',
  thumb: './lenormand/thumb/06-Clouds.webp'
}, {
  num: 7,
  name: '蛇',
  suit: 'Clubs',
  kw: '智慧 / 隐忧',
  img: './lenormand/webp/07-Snake.webp',
  thumb: './lenormand/thumb/07-Snake.webp'
}, {
  num: 8,
  name: '棺材',
  suit: 'Diamonds',
  kw: '终结 / 转化',
  img: './lenormand/webp/08-Coffin.webp',
  thumb: './lenormand/thumb/08-Coffin.webp'
}, {
  num: 9,
  name: '花束',
  suit: 'Spades',
  kw: '礼物 / 喜悦',
  img: './lenormand/webp/09-Bouquet.webp',
  thumb: './lenormand/thumb/09-Bouquet.webp'
}, {
  num: 10,
  name: '镰刀',
  suit: 'Diamonds',
  kw: '突发 / 切断',
  img: './lenormand/webp/10-Scythe.webp',
  thumb: './lenormand/thumb/10-Scythe.webp'
}, {
  num: 11,
  name: '鞭子',
  suit: 'Clubs',
  kw: '冲突 / 反复',
  img: './lenormand/webp/11-Whip.webp',
  thumb: './lenormand/thumb/11-Whip.webp'
}, {
  num: 12,
  name: '鸟',
  suit: 'Diamonds',
  kw: '闲谈 / 焦虑',
  img: './lenormand/webp/12-Birds.webp',
  thumb: './lenormand/thumb/12-Birds.webp'
}, {
  num: 13,
  name: '小孩',
  suit: 'Spades',
  kw: '纯真 / 新事',
  img: './lenormand/webp/13-Child.webp',
  thumb: './lenormand/thumb/13-Child.webp'
}, {
  num: 14,
  name: '狐狸',
  suit: 'Clubs',
  kw: '机敏 / 自保',
  img: './lenormand/webp/14-Fox.webp',
  thumb: './lenormand/thumb/14-Fox.webp'
}, {
  num: 15,
  name: '熊',
  suit: 'Clubs',
  kw: '力量 / 保护',
  img: './lenormand/webp/15-Bear.webp',
  thumb: './lenormand/thumb/15-Bear.webp'
}, {
  num: 16,
  name: '星星',
  suit: 'Hearts',
  kw: '希望 / 指引',
  img: './lenormand/webp/16-Stars.webp',
  thumb: './lenormand/thumb/16-Stars.webp'
}, {
  num: 17,
  name: '鹳',
  suit: 'Hearts',
  kw: '转变 / 更新',
  img: './lenormand/webp/17-Stork.webp',
  thumb: './lenormand/thumb/17-Stork.webp'
}, {
  num: 18,
  name: '狗',
  suit: 'Hearts',
  kw: '忠诚 / 朋友',
  img: './lenormand/webp/18-Dog.webp',
  thumb: './lenormand/thumb/18-Dog.webp'
}, {
  num: 19,
  name: '塔',
  suit: 'Spades',
  kw: '孤独 / 权威',
  img: './lenormand/webp/19-Tower.webp',
  thumb: './lenormand/thumb/19-Tower.webp'
}, {
  num: 20,
  name: '花园',
  suit: 'Spades',
  kw: '公开 / 社交',
  img: './lenormand/webp/20-Garden.webp',
  thumb: './lenormand/thumb/20-Garden.webp'
}, {
  num: 21,
  name: '山',
  suit: 'Clubs',
  kw: '障碍 / 延迟',
  img: './lenormand/webp/21-Mountain.webp',
  thumb: './lenormand/thumb/21-Mountain.webp'
}, {
  num: 22,
  name: '路口',
  suit: 'Diamonds',
  kw: '选择',
  img: './lenormand/webp/22-Crossroads.webp',
  thumb: './lenormand/thumb/22-Crossroads.webp'
}, {
  num: 23,
  name: '老鼠',
  suit: 'Clubs',
  kw: '损耗 / 担忧',
  img: './lenormand/webp/23-Mice.webp',
  thumb: './lenormand/thumb/23-Mice.webp'
}, {
  num: 24,
  name: '心',
  suit: 'Hearts',
  kw: '爱 / 情感',
  img: './lenormand/webp/24-Heart.webp',
  thumb: './lenormand/thumb/24-Heart.webp'
}, {
  num: 25,
  name: '戒指',
  suit: 'Clubs',
  kw: '承诺 / 循环',
  img: './lenormand/webp/25-Ring.webp',
  thumb: './lenormand/thumb/25-Ring.webp'
}, {
  num: 26,
  name: '书',
  suit: 'Diamonds',
  kw: '学问 / 秘密',
  img: './lenormand/webp/26-Book.webp',
  thumb: './lenormand/thumb/26-Book.webp'
}, {
  num: 27,
  name: '信',
  suit: 'Spades',
  kw: '消息 / 文件',
  img: './lenormand/webp/27-Letter.webp',
  thumb: './lenormand/thumb/27-Letter.webp'
}, {
  num: 28,
  name: '男人',
  suit: 'Hearts',
  kw: '男士',
  img: './lenormand/webp/28-Man.webp',
  thumb: './lenormand/thumb/28-Man.webp'
}, {
  num: 29,
  name: '女人',
  suit: 'Spades',
  kw: '女士',
  img: './lenormand/webp/29-Woman.webp',
  thumb: './lenormand/thumb/29-Woman.webp'
}, {
  num: 30,
  name: '百合',
  suit: 'Spades',
  kw: '纯洁 / 成熟',
  img: './lenormand/webp/30-Lily.webp',
  thumb: './lenormand/thumb/30-Lily.webp'
}, {
  num: 31,
  name: '太阳',
  suit: 'Diamonds',
  kw: '成功 / 活力',
  img: './lenormand/webp/31-Sun.webp',
  thumb: './lenormand/thumb/31-Sun.webp'
}, {
  num: 32,
  name: '月亮',
  suit: 'Hearts',
  kw: '情绪 / 名声',
  img: './lenormand/webp/32-Moon.webp',
  thumb: './lenormand/thumb/32-Moon.webp'
}, {
  num: 33,
  name: '钥匙',
  suit: 'Diamonds',
  kw: '解答 / 开启',
  img: './lenormand/webp/33-Key.webp',
  thumb: './lenormand/thumb/33-Key.webp'
}, {
  num: 34,
  name: '鱼',
  suit: 'Diamonds',
  kw: '财富 / 充裕',
  img: './lenormand/webp/34-Fish.webp',
  thumb: './lenormand/thumb/34-Fish.webp'
}, {
  num: 35,
  name: '锚',
  suit: 'Spades',
  kw: '稳定 / 坚持',
  img: './lenormand/webp/35-Anchor.webp',
  thumb: './lenormand/thumb/35-Anchor.webp'
}, {
  num: 36,
  name: '十字',
  suit: 'Clubs',
  kw: '命运 / 负担',
  img: './lenormand/webp/36-Cross.webp',
  thumb: './lenormand/thumb/36-Cross.webp'
}];
const LENORMAND_SPREADS = [{
  id: 'single',
  name: '单张',
  desc: '快速指引 · 一事一问，直取核心线索',
  n: 1,
  pos: ['核心线索']
}, {
  id: 'three',
  name: '三张',
  desc: '起因-现状-走向 · 串联事件的发展脉络',
  n: 3,
  pos: ['起因', '现状', '走向']
}, {
  id: 'five',
  name: '五牌十字',
  desc: '十字展开 · 背景、处境、隐藏、助力与走向',
  n: 5,
  pos: ['过去背景', '当前处境', '隐藏因素', '外在助力', '最终走向']
}, {
  id: 'relationship',
  name: '关系',
  desc: '关系透视 · 状态、纽带、隐藏与后续走向',
  n: 5,
  pos: ['你的状态', '对方状态', '关系纽带', '隐藏因素', '后续走向']
}, {
  id: 'decision',
  name: '选择',
  desc: '二择一 · 处境、两路走向与关键建议',
  n: 6,
  pos: ['当前处境', '选择A', '选择A走向', '选择B', '选择B走向', '关键建议']
}, {
  id: 'grid',
  name: '九宫格',
  desc: '九格大局 · 环绕中心展开完整图景',
  n: 9,
  pos: ['左上', '上方', '右上', '左侧', '核心', '右侧', '左下', '下方', '右下']
}, {
  id: 'element',
  name: '元素',
  desc: '四元素 · 火水风土的能量侧重',
  n: 4,
  pos: ['火（行动/能量）', '水（情感/直觉）', '风（思维/沟通）', '土（物质/根基）']
}];
/* REQ-130①：雷诺曼牌阵 spreadType → 后端 vendored key 映射（grid→nine，其余与
   vendored LENORMAND_SPREADS key 一致：single/three/five/relationship/decision/element；
   grandTableau 大桌按需求方口径「单独评估另行」不做） */
/* 后端雷诺曼牌名 → 前端 LENORMAND_DECK 卡面映射（个别译名差异） */
const LN_NAME_ALIAS = { '骑士': '骑手', '孩子': '小孩', '路': '路口', '男士': '男人', '女士': '女人', '十字架': '十字' };
const LN_SUIT_COLOR = { hearts: '#b94a4a', diamonds: '#3a6ea5', spades: '#2c2c2c', clubs: '#4a8a5e' };
function lnCardOf(c) {
  const name = (c && (c.name || c.cardName)) || '';
  const pos = (c && (c.position || c.pos)) || '';
  const deck = name ? (LENORMAND_DECK.find(d => d.name === (LN_NAME_ALIAS[name] || name)) || LENORMAND_DECK.find(d => d.name === name) || null) : null;
  // A3：雷诺曼固定主题/细节文案（判空容错；c 为 LENORMAND_CARDS 对象引用时自带 theme/detail）
  const theme = (c && typeof c.theme === 'string' && c.theme.trim()) ? c.theme : '';
  const detail = (c && typeof c.detail === 'string' && c.detail.trim()) ? c.detail : '';
  return {
    name: name || '？',
    pos: pos,
    img: deck ? deck.img : '',
    suit: deck ? String(deck.suit).toLowerCase() : 'hearts',
    kw: deck ? deck.kw : '',
    keywords: Array.isArray(c && c.keywords) && c.keywords.length ? c.keywords.slice(0, 3) : (deck && deck.kw ? deck.kw.split('/') : []),
    theme: theme,
    detail: detail
  };
}
function lnCardEl(item, idx) {
  // REQ-043 v2：卡位仅放卡面（图/标题/关键词标签），theme/detail 解释全部归拢到下方段落
  return React.createElement('div', { key: idx, style: { textAlign: 'center' } },
    item.pos ? React.createElement('div', { className: 'tc-pos' }, item.pos) : null,
    React.createElement('div', { className: 'tarot-card suit-' + item.suit },
      React.createElement('div', { className: 'tc-imgwrap' },
        item.img ? React.createElement('img', { className: 'tc-img', src: item.img, alt: item.name, loading: 'lazy', decoding: 'async' }) : React.createElement('div', { className: 'tc-ph', style: { background: LN_SUIT_COLOR[item.suit] || '#3E7C6B' } }, item.name)),
      React.createElement('div', { className: 'tc-name' }, item.name),
      React.createElement('div', { className: 'tc-kw' }, item.keywords.join(' / '))));
}
/* ================= REQ-130：雷诺曼两段式（取牌段复用塔罗 REQ-129 机制 + 专属读牌段） =================
   取牌段：TarotShuffleStage / TarotCutStage / TarotPickBoard 均为参数化通用组件
   （deckLen 可覆盖为 36、无正逆位、雷诺曼卡面自带 img），仅做别名引用、不改动塔罗实现；
   读牌段：雷诺曼专属（无正逆位 + 数字角标 + 航海桌布 + 点开放大连看），官方阵型坐标见
   LENORMAND_READ_SPOTS（参照塔罗 TAROT_READ_SPOTS 坐标模型，positions 对齐 vendored
   LENORMAND_SPREADS，大桌 grandTableau 按需求方口径不做）。 */
const LenormandShuffleStage = TarotShuffleStage;
const LenormandCutStage = TarotCutStage;
const LenormandPickBoard = TarotPickBoard;

let lastLenormandPickStream = null;
function buildLenormandPickStream(sp, cardsArr) {
  if (!sp) return null;
  const posArr = (sp && Array.isArray(sp.pos)) ? sp.pos : [];
  const list = (cardsArr || []).map(function (c, i) {
    const n = lnCardOf(c);
    return {
      index: i + 1,
      position: posArr[i] || n.pos || ('第' + (i + 1) + '张'),
      name: n.name,
      img: n.img,
      suit: n.suit,
      keywords: (n.keywords || []).slice(),
      theme: n.theme,
      detail: n.detail
    };
  });
  return { spread: { id: sp.id, name: sp.name, pos: posArr.slice() }, cards: list };
}
function getLenormandPickStream() {
  return lastLenormandPickStream;
}
/* 雷诺曼阵型点位（key=牌阵 id，与 LENORMAND_SPREADS 对齐；无正逆位、卡不旋转 rot 全 0；
   卡高占板 % = w × ratio ÷ 0.619（对齐 .rd-imgwrap aspect-ratio:100/161）） */
const LENORMAND_READ_SPOTS = {
  single: { ratio: 1.05, cap: true, cells: [{ x: 50, y: 45, w: 33, rot: 0 }] },
  three: { ratio: 1.85, cap: true, cells: tarotRowCells(3, 22.5, 43) },
  five: { ratio: 1.1, cap: true, cells: [{ x: 50, y: 17, w: 16, rot: 0 }, { x: 50, y: 50, w: 17, rot: 0 }, { x: 50, y: 82, w: 16, rot: 0 }, { x: 24, y: 50, w: 16, rot: 0 }, { x: 76, y: 50, w: 16, rot: 0 }] },
  relationship: { ratio: 1.9, cap: true, cells: tarotRowCells(5, 15, 45.5) },
  decision: { ratio: 1.2, cap: true, cells: [{ x: 50, y: 14, w: 13, rot: 0 }, { x: 24, y: 42, w: 15, rot: 0 }, { x: 76, y: 42, w: 15, rot: 0 }, { x: 24, y: 76, w: 15, rot: 0 }, { x: 76, y: 76, w: 15, rot: 0 }, { x: 50, y: 58, w: 14, rot: 0 }] },
  grid: { ratio: 1.0, cap: false, sideCap: true, cells: tarotGridCells([21.5, 50, 78.5], [20, 50, 80], 15.5) },
  element: { ratio: 1.0, cap: true, cells: tarotGridCells([30, 70], [35, 65], 18) }
};
/* 雷诺曼读牌板：按官方阵型全牌一屏摆放（已翻开正面卡；数字角标 + 可点放大；航海桌布） */
function LenormandReadBoard({ spread, cards, onOpen }) {
  const n = cards.length;
  const spot = (spread && LENORMAND_READ_SPOTS[spread.id]) || null;
  let ratio = 0.9;
  let cells = null;
  let sideCap = false;
  if (spot) {
    ratio = spot.ratio;
    cells = spot.cells;
    sideCap = !!spot.sideCap;
  } else {
    // 兜底：未知牌阵按张数行排布（仍一屏摆全、可点放大）
    if (n <= 1) { ratio = 1.05; cells = [{ x: 50, y: 45, w: 30, rot: 0 }]; }
    else if (n <= 5) { ratio = 1.9; cells = tarotRowCells(n, n <= 3 ? 22 : 15.5, 46); }
    else {
      ratio = 1.25;
      const rows = Math.ceil(n / 3);
      const ys = []; for (let r = 0; r < rows; r++) ys.push(rows === 1 ? 50 : 36 + r * (72 / (rows - 1)));
      const all = [];
      for (let r = 0; r < rows; r++) for (let cc = 0; cc < 3; cc++) { const k = r * 3 + cc; if (k < n) all.push({ x: [21.5, 50, 78.5][cc], y: ys[r], w: n <= 6 ? 15 : 13, rot: 0 }); }
      cells = all;
    }
  }
  const capShow = sideCap ? false : (spot ? spot.cap !== false : n <= 5);
  const capFs = n <= 1 ? 12.5 : (n <= 3 ? 11 : (n <= 5 ? 9.5 : 8.6));
  const bdgFs = n <= 3 ? 12 : (n <= 5 ? 11 : (n <= 7 ? 10 : 9.5));
  const kids = cards.map(function (c, i) {
    const cell = (cells && cells[i]) || { x: 50, y: 50, w: 13, rot: 0 };
    const wP = cell.w || 13;
    const rot = cell.rot || 0;
    const hF = (wP * ratio) / 0.619;
    const leftP = cell.x - wP / 2;
    const topP = cell.y - hF / 2;
    const label = c.position || ('第' + (i + 1) + '位');
    const imgInner = c.img
      ? React.createElement('img', { src: c.img, alt: c.name, loading: 'lazy', decoding: 'async' })
      : React.createElement('div', { className: 'rd-ph', style: { background: LN_SUIT_COLOR[c.suit] || '#3E7C6B' } }, c.name);
    const face = React.createElement('div', { className: 'rd-imgwrap' }, imgInner);
    const inner = rot ? React.createElement('div', { className: 'rd-rot' + (rot === 90 ? ' layer2' : ''), style: { transform: 'rotate(' + rot + 'deg)' } }, face) : face;
    const cellKids = [inner];
    cellKids.push(React.createElement('span', { key: 'b', className: 'rd-badge', style: { fontSize: bdgFs } }, (i + 1)));
    if (sideCap) {
      cellKids.push(React.createElement('span', { key: 'sc', className: 'rd-sidecap', style: { left: (cell.x + wP / 2 + 1.8) + '%', top: cell.y + '%', width: (96 - (cell.x + wP / 2 + 1.8)) + '%' } }, (i + 1) + '、' + label));
    } else if (capShow) {
      cellKids.push(React.createElement('div', { key: 'cap', className: 'rd-cap' }, label));
    }
    return React.createElement('div', { key: 'c' + i, className: 'rd-cell', style: { left: leftP + '%', top: topP + '%', width: wP + '%' }, role: 'button', 'aria-label': '第' + (i + 1) + '位·' + label, onClick: function () { if (onOpen) onOpen(i); } }, cellKids);
  });
  return React.createElement('div', { className: 'rd-box leno-table', style: { aspectRatio: String(ratio), '--rd-cap-fs': capFs + 'px' } }, kids);
}
/* 放大连看浮层（雷诺曼无正逆位；正文=主题/细节段落 + 关键词；约 2.5s 自动收起；上一张/下一张连看） */
function LenormandReadZoom({ cards, idx, onClose, onGo }) {
  const card = (cards && cards[idx]) || null;
  const [closing, setClosing] = useState(false);
  const closeOnce = useRef(false);
  const fireClose = function () {
    if (closeOnce.current) return;
    closeOnce.current = true;
    setClosing(true);
    setTimeout(function () { if (onClose) onClose(); }, 190);
  };
  const fireRef = useRef(fireClose);
  fireRef.current = fireClose;
  useEffect(function () {
    if (!card) return undefined;
    const t = setTimeout(function () { fireRef.current(); }, 2500);
    return function () { clearTimeout(t); };
  }, [idx]);
  if (!card) return null;
  const n = cards.length;
  const bodyLines = [];
  if (card.theme) bodyLines.push(card.theme);
  if (card.detail) bodyLines.push(card.detail);
  const kwLine = (card.keywords && card.keywords.length) ? card.keywords.join(' / ') : '';
  const go = function (e, ni) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (ni < 0 || ni >= n || !onGo) return;
    onGo(ni);
  };
  const title = React.createElement('div', { className: 'rd-ztitle' }, React.createElement('b', null, '第 ' + (card.index || (idx + 1)) + ' 位'), ' · ', card.position || '');
  const closeBtn = React.createElement('button', { type: 'button', className: 'rd-zclose', 'aria-label': '收起大图', onClick: function (e) { e.stopPropagation(); fireClose(); } }, '✕');
  const sub = React.createElement('div', { className: 'rd-zsub' }, '约 2.5 秒后自动收起 · 可点「上一张 / 下一张」连看');
  const imgEl = card.img
    ? React.createElement('img', { key: 'im' + idx, className: 'rd-zimg', src: card.img, alt: card.name })
    : React.createElement('div', { className: 'rd-zimg rd-zph', style: { background: LN_SUIT_COLOR[card.suit] || '#3E7C6B' } }, card.name);
  const nameRow = React.createElement('div', { className: 'rd-zname' }, card.name || '');
  const boxKids = [
    React.createElement('div', { key: 'bar' + idx, className: 'rd-count' }),
    React.createElement('div', { key: 'top', className: 'rd-ztop' }, title, closeBtn),
    sub,
    imgEl,
    nameRow
  ];
  bodyLines.forEach(function (t, k) {
    boxKids.push(React.createElement('div', { key: 'b' + k, className: 'rd-zbody' }, t));
  });
  if (kwLine) boxKids.push(React.createElement('div', { key: 'kw', className: 'rd-zkw' }, '关键词：', kwLine));
  boxKids.push(React.createElement('div', { key: 'nav', className: 'rd-znav' },
    React.createElement('button', { type: 'button', className: 'rd-zbtn', disabled: idx <= 0, onClick: function (e) { go(e, idx - 1); } }, '‹ 上一张'),
    React.createElement('span', { className: 'rd-zcount' }, (idx + 1) + '/' + n),
    React.createElement('button', { type: 'button', className: 'rd-zbtn', disabled: idx >= n - 1, onClick: function (e) { go(e, idx + 1); } }, '下一张 ›')));
  const box = React.createElement('div', { className: 'rd-zoom-box', onClick: function (e) { e.stopPropagation(); } }, boxKids);
  return React.createElement('div', { className: 'rd-zoom' + (closing ? ' closing' : ''), onClick: function () { fireClose(); } }, box);
}
function LenormandPage({
  onNavigate
}) {
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [step, setStep] = useState('menu'); // menu -> pick(手动选牌) | draw
  const [spread, setSpread] = useState(null);
  const [question, setQuestion] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  // REQ-069：手动选牌（真实世界已抽好 → 从 36 张牌库按牌位数录入）与自动抽牌并行
  // REQ-066②：默认入口按功能设置 default_mode（manual=手动选牌 / auto=自动抽牌 / both=并行不预设）
  const [mode, setMode] = useState(function () { return tcAskNextDefault('auto'); }); // 'auto' | 'manual'
  const [picks, setPicks] = useState([]); // LENORMAND_DECK 条目（含 num）
  const [wasManual, setWasManual] = useState(false);
  // REQ-130③：雷诺曼取牌段阶段机（复用塔罗 REQ-129：shuffle=洗牌 → cut=切牌三摞（可跳过） →
  // fan=扇形自选 → done=收扇交读牌段）；雷诺曼无正逆位；旧「一键全翻 + 背朝上待翻」呈现已被
  // REQ-130 两段式取代（对应塔罗 REQ-129 C 口径，雷诺曼侧同构）。
  const [dealStage, setDealStage] = useState('done');
  // REQ-130②：读牌段「点开放大连看」当前牌索引（null=收起；0-based，对应 readStream.cards）
  const [zoomIdx, setZoomIdx] = useState(null);
  const lnApiType = function (sp) { return sp && sp.id === 'grid' ? 'nine' : (sp ? (sp.id || 'single') : 'single'); };
  // REQ-043 v2：与塔罗对齐 —— 已删除「预测方向」步骤，流程 = ① 占问问题（选填，REQ-079）→ ② 选择牌阵
  const load = async sp => {
    if (loading || !sp) return;
    // REQ-043 v2：问题文本直接放入 seed.question（方向已删，不再拼接前缀）
    const askTrim = (question || '').trim();
    const seedObj = { spreadType: lnApiType(sp) };
    if (askTrim) seedObj.question = askTrim;
    setSpread(sp);
    setStep('draw');
    setData(null);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setLoading(true);
    setWasManual(false);
    setZoomIdx(null);
    lastLenormandPickStream = null;
    setDealStage('done');
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: 'lenormand', case_id: null, seed: seedObj })
      });
      const d = (res && res.data) || res;
      setData(d);
      // REQ-130：取数先行（结果不变）→ 动画开（且图开）进入「洗牌→切牌→扇形自选」取牌段；关=直接 v2 布局出结果
      if (tcShouldPlayAnim() && tcShouldShowCards()) setDealStage('shuffle'); else setDealStage('done');
    } catch (e) {
      setErrored((e && e.message) || '雷诺曼抽牌失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  // REQ-069：进入手动选牌步骤（问题选填，留空可直接按牌位选牌）
  const openManualPick = sp => {
    if (loading || !sp) return;
    setSpread(sp);
    setPicks([]);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setData(null);
    setWasManual(true);
    setZoomIdx(null);
    lastLenormandPickStream = null;
    setDealStage('done');
    setStep('pick');
  };
  const placeCard = (di) => {
    if (!spread) return;
    const need = spread.n || 1;
    if (picks.length >= need) return;
    const card = LENORMAND_DECK[di];
    if (!card) return;
    setPicks(function (prev) { return prev.concat([card]); });
  };
  const undoPick = () => setPicks(function (prev) { return prev.slice(0, Math.max(0, prev.length - 1)); });
  const clearPicks = () => setPicks([]);
  // REQ-069：手动选牌完成 → drawLenormandSpread options.manualCardIds（后端按牌位确定性成牌）
  const submitManual = async () => {
    if (loading || !spread) return;
    const need = spread.n || 1;
    if (!picks || picks.length !== need) {
      toast('请把「' + spread.name + '」的 ' + need + ' 个牌位逐张选完');
      return;
    }
    const askTrim = (question || '').trim();
    const seedObj = { spreadType: lnApiType(spread), options: { manualCardIds: picks.map(function (c) { return c.num; }) } };
    if (askTrim) seedObj.question = askTrim;
    track('manual_input', { method: 'lenormand' });
    setLoading(true);
    setErrored('');
    setInterp('');
    setInterpErr('');
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: 'lenormand', case_id: null, seed: seedObj })
      });
      const d = (res && res.data) || res;
      setData(d);
      setStep('draw');
      // REQ-130：手动路径不重演抽牌演出（用户已真实抽牌）→ 直接读牌段布局
      setDealStage('done');
      setZoomIdx(null);
      lastLenormandPickStream = null;
    } catch (e) {
      setErrored((e && e.message) || '雷诺曼手动选牌提交失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  const interpret = async () => {
    if (!data || !data.id || interpLoading) return;
    setInterpLoading(true);
    setInterpErr('');
    try {
      const res = await api('/divinations' + '/' + data.id + '/interpret', { method: 'POST', body: '{}' });
      setInterp((res && res.data && res.data.interpretation) || '（暂无解读内容）');
    } catch (e) {
      setInterpErr((e && e.message) || '深度解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  const backMenu = () => {
    setStep('menu');
    setSpread(null);
    setData(null);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setPicks([]);
    setZoomIdx(null);
    lastLenormandPickStream = null;
    setDealStage('done');
    // REQ-066②：按 default_mode 决定返回后的出牌方式（manual=手动 / auto=自动 / both=保留上次）
    setMode(tcAskNextDefault(mode));
    setWasManual(false);
  };
  const redo = () => {
    if (!spread) return backMenu();
    if (wasManual) {
      setData(null);
      setErrored('');
      setInterp('');
      setInterpErr('');
      setPicks([]);
      setZoomIdx(null);
      lastLenormandPickStream = null;
      setDealStage('done');
      setStep('pick');
    } else {
      load(spread);
    }
  };
  const result = (data && data.result) || null;
  const cards = result && Array.isArray(result.cards) ? result.cards : [];
  const spreadName = (result && result.spreadName) || (spread && spread.name) || '抽牌结果';
  // REQ-066⑥：牌面图片显示（塔罗/雷诺曼）—— 关 = 纯文字列表模式（隐藏牌面图/扇形）
  const cardImagesOn = TC_SETTINGS.card_images !== false;
  const askQ = (question || '').trim();
  // REQ-043 v2：draw 顶部承接所填占问问题文本
  const askEcho = askQ ? React.createElement('div', { className: 'ask-echo' }, '问题：', askQ) : null;
  // REQ-130②：读牌段数据流 —— 优先消费取牌段 lastLenormandPickStream（getLenormandPickStream()）；
  // 动画关/手动录入等直出路径在缓存缺失或不匹配当前牌阵时，按当前成牌确定性重建（只读消费，不改抽牌结果/计费/数据流结构）
  let readStream = getLenormandPickStream();
  if (readStream && (!spread || !readStream.spread || readStream.spread.id !== spread.id)) readStream = null;
  if (!readStream && data && spread && cards.length) readStream = buildLenormandPickStream(spread, cards);
  const readSpread = (readStream && readStream.spread) || null;
  const readCards = (readStream && Array.isArray(readStream.cards)) ? readStream.cards : [];
  // REQ-130：扇形抽满 N 张自动收扇 → 落定真实牌序数据流（读牌段经 getLenormandPickStream() 消费，position 即 pos[i]）→ 进入结果段
  const handlePickAllRevealed = function () {
    const stream = buildLenormandPickStream(spread, cards);
    if (stream) lastLenormandPickStream = stream;
    setDealStage('done');
  };
  // REQ-043 v2：解释全部归拢到下方段落 —— 自第一张起：卡位 + 牌名 + 主题 + 细节
  // REQ-130②：收扇后各牌均已翻开 → 条目逐条放行，且可点按放大对应牌（与摆位区点卡同源）
  const meanTappable = cardImagesOn && readCards.length > 0;
  const meanItems = cards.map(function (c, i) {
    const it = lnCardOf(c);
    const kwLine = (it.keywords && it.keywords.length) ? it.keywords.join(' / ') : '';
    const itemProps = meanTappable
      ? { key: 'mean' + i, className: 'mean-item rd-mean-item rd-item-in', style: { animationDelay: (i * 70) + 'ms' }, role: 'button', 'aria-label': '查看第' + (i + 1) + '张牌详解', onClick: function () { setZoomIdx(i); } }
      : { key: 'mean' + i, className: 'mean-item' };
    return React.createElement('div', itemProps,
      React.createElement('div', { className: 'mi-head' },
        React.createElement('span', { className: 'mi-pos' }, it.pos || ('第' + (i + 1) + '张')),
        React.createElement('span', { className: 'mi-name' }, it.name)),
      it.theme ? React.createElement('div', { className: 'mi-theme' }, it.theme) : null,
      it.detail ? React.createElement('div', { className: 'mi-txt' }, it.detail) : null,
      kwLine ? React.createElement('div', { className: 'mi-kw' }, '关键词：', kwLine) : null);
  });
  let body = null;
  if (loading && step === 'draw') {
    body = React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'section-title' }, spreadName, ' · 抽牌中'),
      React.createElement('div', { className: 'skeleton sk-line' }),
      React.createElement('div', { className: 'skeleton sk-line', style: { width: '60%' } }));
  } else if (errored && step === 'draw') {
    body = React.createElement('div', { className: 'card failed-box' },
      React.createElement('div', { className: 'section-title' }, '抽牌失败'),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: redo }, UI_COPY.buttons.retry));
  } else if (data) {
    // ================= REQ-130：取牌段（shuffle/cut/fan）与结果段（done）分流 =================
    // 取牌段演出仅当 动画开 && 牌面图开 && 牌阵有 pos && 非手动路径 时进入（手动路径直接 done）
    const animOn = tcShouldPlayAnim();
    const hasPos = Boolean(spread && spread.pos && spread.pos.length);
    const pickPlaying = cardImagesOn && animOn && hasPos && (dealStage === 'shuffle' || dealStage === 'cut' || dealStage === 'fan');
    if (pickPlaying) {
      const bodyKids = [
        React.createElement('div', { key: 't', className: 'section-title' }, spreadName),
        askEcho
      ];
      if (dealStage === 'shuffle') {
        bodyKids.push(React.createElement(LenormandShuffleStage, {
          key: 'pk',
          onDone: function () { setDealStage('cut'); },
          onSkip: function () { setDealStage('done'); }
        }));
      } else if (dealStage === 'cut') {
        bodyKids.push(React.createElement(LenormandCutStage, {
          key: 'pk',
          onDone: function () { setDealStage('fan'); },
          onSkip: function () { setDealStage('done'); },
          onSkipCut: function () { setDealStage('fan'); }
        }));
      } else if (dealStage === 'fan') {
        bodyKids.push(React.createElement(LenormandPickBoard, {
          key: 'pk' + (data.id || 'draw'),
          pos: spread.pos,
          cards: cards.map(function (c) { return lnCardOf(c); }),
          deckLen: LENORMAND_DECK.length,
          spots: (spread && LENORMAND_READ_SPOTS[spread.id]) || null,
          kind: 'leno',
          onAllRevealed: handlePickAllRevealed,
          onRedo: function () { redo(); },
          onBackMenu: backMenu
        }));
      }
      body = React.createElement('div', { className: 'card' }, bodyKids);
    } else {
      // 结果段（done）：收扇后 / 动画关 / 牌面图关 / 手动录入 —— 读牌段（REQ-130②：官方阵型摆位一屏 + 点开放大连看）；牌面图关走纯文字
      const bodyKids = [
        React.createElement('div', { key: 't', className: 'section-title' }, spreadName),
        askEcho
      ];
      if (cardImagesOn && readCards.length && readSpread) {
        // REQ-130② 读牌段：官方真实阵型一屏展示（已翻开正面卡）→ 点卡放大连看
        bodyKids.push(React.createElement('div', { key: 'rdh', className: 'rd-hint' }, '全牌按「' + readSpread.name + '」官方阵型一屏摆位 · 点任意一张放大读解（约 2.5 秒后自动收起，可「上一张 / 下一张」连看）'));
        bodyKids.push(React.createElement(LenormandReadBoard, { key: 'rdb', spread: readSpread, cards: readCards, onOpen: function (i) { setZoomIdx(i); } }));
        bodyKids.push(React.createElement('div', { key: 'mp', className: 'mean-panel' },
          React.createElement('div', { className: 'mp-title' }, '各张牌义'),
          meanItems));
      } else {
        // REQ-066⑥ 关 / 无牌面数据兜底：纯文字列表模式（无任何卡面/牌背/扇形渲染）
        bodyKids.push(React.createElement('div', { key: 'mp', className: 'mean-panel' },
          React.createElement('div', { className: 'mp-title' }, cardImagesOn ? '抽到的牌' : '抽到的牌（纯文字模式）'),
          meanItems));
      }
      if (interpErr) bodyKids.push(React.createElement('div', { key: 'e', className: 'error', style: { marginTop: 10 } }, interpErr));
      bodyKids.push(React.createElement('div', { key: 'ph', className: 'pay-hint' }, '深度解读为付费 LLM，按实际用量扣余额（¥）（点击前将预检余额）'));
      bodyKids.push(React.createElement('button', { key: 'ib', className: 'btn btn-outline', style: { marginTop: 8 }, disabled: interpLoading, onClick: interpret }, interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)]));
      if (interp) bodyKids.push(React.createElement(React.Fragment, { key: 'ir' },
        React.createElement('div', { className: 'interp-title' }, '深度解读'),
        React.createElement('div', { className: 'interp-body' }, interp)));
      body = React.createElement('div', { className: 'card' }, bodyKids);
    }
  }
  // REQ-043 v2：menu = ① 占问问题（选填，REQ-079）→ ② 选择牌阵（单列按钮 + 适用说明）
  // REQ-069：牌阵上方提供「自动抽牌 / 手动选牌」并行切换
  const menuBody = React.createElement('div', { className: 'card' },
    React.createElement('div', { className: 'section-title step-title' }, React.createElement('span', { className: 'st-no' }, '1'), '占问问题（选填）'),
    React.createElement('textarea', {
      className: 'q-input',
      rows: 2,
      maxLength: 300,
      placeholder: '示例：我与TA的关系走向？ / 这段事业该如何选择？',
      value: question,
      onChange: function (e) { setQuestion(e.target.value); }
    }),
    React.createElement('div', { className: 'section-title step-title', style: { marginTop: 10 } }, React.createElement('span', { className: 'st-no' }, '2'), '选择牌阵'),
    React.createElement('div', { className: 'ask-cap', style: { marginTop: 2 } }, '出牌方式'),
    /* BUG-017：默认模式=auto/manual 时另一入口收起到切换入口，仅 both 保留双栏（REQ-066②） */
    TC_SETTINGS.default_mode === 'both'
      ? React.createElement('div', { className: 'mode-switch' },
          React.createElement('button', { type: 'button', className: mode === 'auto' ? 'sel' : '', onClick: function () { setMode('auto'); } }, UI_COPY.buttons.auto_pick),
          React.createElement('button', { type: 'button', className: mode === 'manual' ? 'sel' : '', onClick: function () { setMode('manual'); } }, UI_COPY.buttons.manual_pick))
      : React.createElement('button', { type: 'button', className: 'mode-switch-link', onClick: function () { setMode(mode === 'auto' ? 'manual' : 'auto'); } },
          mode === 'auto' ? ('改为' + UI_COPY.buttons.manual_pick) : ('返回' + UI_COPY.buttons.auto_pick)),
    React.createElement('div', { className: 'method-list' }, LENORMAND_SPREADS.map(function (s) {
      return React.createElement('div', {
        key: s.id,
        className: 'method-cell',
        onClick: function () { if (mode === 'manual') openManualPick(s); else load(s); }
      }, React.createElement('div', { className: 'mn' }, s.name), s.desc ? React.createElement('div', { className: 'md' }, s.desc) : null,
        React.createElement('div', { className: 'md', style: { marginTop: 2, color: 'var(--text-3)' } }, mode === 'manual' ? '手动模式：按 ' + (s.n || 1) + ' 个牌位从牌库逐张选牌' : '点击即自动抽取 ' + (s.n || 1) + ' 张'));
    })));
  // REQ-069：手动选牌面板
  const need = (spread && (spread.n || 1)) || 1;
  const slotChips = [];
  for (let i = 0; i < need; i++) {
    const done = i < picks.length;
    slotChips.push(React.createElement('span', {
      key: 'slot' + i,
      className: 'pk-slot' + (done ? ' filled' : '') + (i === picks.length ? ' cur' : '')
    }, done ? (i + 1) + '：' + picks[i].name : '第 ' + (i + 1) + ' 位'));
  }
  const usedNum = {};
  picks.forEach(function (c) { usedNum[c.num] = true; });
  const dkCells = [];
  LENORMAND_DECK.forEach(function (d, di) {
    if (usedNum[d.num]) return;
    dkCells.push(React.createElement('div', {
      key: 'dk' + di,
      className: 'dk-cell',
      onClick: function () { placeCard(di); }
    },
      React.createElement('div', { className: 'dk-thumb' }, d.thumb && cardImagesOn ? React.createElement('img', { src: d.thumb, alt: d.name, loading: 'lazy', decoding: 'async' }) : React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#fff', fontSize: 17, fontWeight: 700 } }, String(d.num))),
      React.createElement('div', { className: 'dk-n' }, d.name)));
  });
  const pickBody = React.createElement('div', { className: 'card pick-box' },
    React.createElement('div', { className: 'section-title' }, (spread ? spread.name : '') + ' · 手动选牌'),
    askEcho,
    errored && step === 'pick' ? React.createElement('div', { className: 'error', style: { marginBottom: 8 } }, errored) : null,
    React.createElement('div', { className: 'pick-progress' },
      '正在选第 ', React.createElement('b', null, Math.min(picks.length + 1, need)), '/', need, ' 张 —— 点击下方牌库中的牌放入当前牌位（雷诺曼不设正逆位）。'),
    React.createElement('div', { className: 'pick-slots' }, slotChips),
    React.createElement('div', { className: 'dk-hint' }, '牌库共 ' + LENORMAND_DECK.length + ' 张，每张限用一次；选完 ' + need + ' 个牌位后可提交（复用主题/细节展示与付费深度解读）。'),
    dkCells.length ? React.createElement('div', { className: 'dk-grid' }, dkCells)
      : React.createElement('div', { className: 'dk-hint' }, '该牌阵已选满。'),
    React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } },
      React.createElement('button', { className: 'btn btn-outline', type: 'button', style: { flex: 1 }, onClick: undoPick, disabled: !picks.length }, UI_COPY.buttons.step_back),
      React.createElement('button', { className: 'btn btn-outline', type: 'button', style: { flex: 1 }, onClick: clearPicks, disabled: !picks.length }, UI_COPY.buttons.reselect_all)),
    React.createElement('div', { className: 'back-row fill', style: { marginTop: 8 } },
      React.createElement('button', { className: 'btn btn-outline', onClick: backMenu }, UI_COPY.buttons.reselect_spread),
      React.createElement('button', { className: 'btn btn-primary', onClick: submitManual, disabled: loading || picks.length !== need }, loading ? UI_COPY.tips.submitting : UI_COPY.buttons.finish_pick + '（' + picks.length + '/' + need + '）')));
  // REQ-043 v2：draw 底部三按钮全宽并列大按钮（重新抽牌 / 重选牌阵 / 返回选项，保持）
  // REQ-130：取牌段演出中（shuffle/cut/fan）隐藏底栏大按钮 —— 演出段内自带「返回重选牌阵 / 重新洗牌」小入口
  const inPickPlay = Boolean(data && cardImagesOn && tcShouldPlayAnim() && dealStage !== 'done');
  // 节100③：取牌演出段（洗牌/切牌/扇形）底栏统一为标准「返回选项 / 回到首页」（同星座页底部）
  const hubHomeRow = React.createElement('div', { className: 'back-row fill' },
    React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('xishi-hub'); } }, UI_COPY.buttons.back_options),
    React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('landing'); } }, UI_COPY.buttons.back_home));
  const drawFoot = React.createElement(React.Fragment, null,
    body,
    inPickPlay ? hubHomeRow : React.createElement('div', { className: 'back-row fill' },
      React.createElement('button', { className: 'btn btn-outline', onClick: redo }, UI_COPY.buttons.redo),
      React.createElement('button', { className: 'btn btn-outline', onClick: backMenu }, UI_COPY.buttons.rechoose),
      React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('xishi-hub'); } }, UI_COPY.buttons.back_options)));
  // REQ-130②：放大连看浮层（点牌/点清单条目打开；约 2.5s 自动收起；「上一张/下一张」手动连看）
  const zoomCard = (zoomIdx !== null && cardImagesOn && readCards[zoomIdx]) ? readCards[zoomIdx] : null;
  const zoomOverlay = zoomCard
    ? React.createElement(LenormandReadZoom, {
        key: 'zoom' + zoomIdx,
        cards: readCards,
        idx: zoomIdx,
        onClose: function () { setZoomIdx(null); },
        onGo: function (ni) { if (ni >= 0 && ni < readCards.length) setZoomIdx(ni); }
      })
    : null;
  // 节100③：menu 阶段底栏统一为标准「返回选项 / 回到首页」（同星座页底部，取代虚线链接）
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'nine', size: 22 }), ' 雷诺曼'),
    step === 'menu' ? React.createElement(React.Fragment, null, menuBody, hubHomeRow) : (step === 'pick' ? pickBody : drawFoot),
    zoomOverlay);
}