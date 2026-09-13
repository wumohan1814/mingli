// 西式占卜域视图（节110 阶段3）：西式 HUB XishiHubPage + 塔罗 TarotPage + 雷诺曼 LenormandPage + 星座 AstrologyPage
// （星座页依赖共享盘面，本轮已随「共享盘面→components.js」就绪）
// 加载于 components.js/views-guoxue.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- 西式占卜 HUB ---------- */
function XishiHubPage({
  onNavigate,
  applySkin
}) {
  const cards = [{
    name: ML_COPY.ui.hub['xishi-astrology-name'],
    sub: ML_COPY.ui.hub['xishi-astrology-sub'],
    bar: 'var(--tc-astro)',
    ico: 'orbit',
    to: () => {
      applySkin('xingzuo');
      onNavigate('astrology');
    }
  }, {
    name: ML_COPY.ui.hub['xishi-tarot-name'],
    sub: ML_COPY.ui.hub['xishi-tarot-sub'],
    bar: 'var(--tc-amber)',
    ico: 'spark',
    to: () => {
      applySkin('tarot');
      onNavigate('tarot');
    }
  }, {
    name: ML_COPY.ui.hub['xishi-lenormand-name'],
    sub: ML_COPY.ui.hub['xishi-lenormand-sub'],
    bar: 'var(--tc-amethyst)',
    ico: 'nine',
    to: () => {
      applySkin('tarot');
      onNavigate('lenormand');
    }
  }, {
    name: ML_COPY.ui.hub['xishi-more-name'],
    sub: ML_COPY.ui.hub['xishi-more-sub'],
    bar: 'var(--tc-gray-dark)',
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
  }), ML_COPY.ui.module_hub.western_title), /*#__PURE__*/React.createElement("div", {
    className: "hub-grid"
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'hub-card' + (c.disabled ? ' disabled' : ''),
    onClick: () => c.disabled ? toast(ML_COPY.ui.hub['coming-soon-toast']) : c.to()
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
// 节135：塔罗牌组数据已迁至正文数据总表 content/tarot/cards-zh.js
// 此处保留别名，供本文件内原有代码零改动使用
const TAROT_DECK = CONTENT.tarot.cards;
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
const TAROT_NAME_ALIAS = { '女皇': '皇后', '塔': '高塔', '权杖侍者': '权杖侍从', '圣杯侍者': '圣杯侍从', '宝剑侍者': '宝剑侍从', '钱币侍者': '钱币侍从' };
const TAROT_SUIT_COLOR = { major: 'var(--tc-suit-major)', wands: 'var(--tc-suit-wands)', cups: 'var(--tc-suit-cups)', swords: 'var(--tc-suit-swords)', pentacles: 'var(--tc-suit-pentacles)' };
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
  // 逆位判定兼容三种来源：random 分支 item.isReversed、interactive/manual 分支布尔 item.reversed、以及 orientation===UI_COPY.xishi['reversed']
  let reversed = false;
  if (c) {
    if (typeof c.isReversed === 'boolean') reversed = c.isReversed;
    else if (typeof c.reversed === 'boolean') reversed = c.reversed;
    else if (src && typeof src.reversed === 'boolean') reversed = src.reversed;
    else if (c.orientation === UI_COPY.xishi['reversed'] || (src && src.orientation === UI_COPY.xishi['reversed'])) reversed = true;
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
      background: TAROT_SUIT_COLOR[suit] || 'var(--tc-suit-major)'
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
        : React.createElement('div', { className: 'rd-ph', style: { background: (TAROT_SUIT_COLOR[c.suit] || 'var(--tc-suit-major)') } }, c.name);
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
        React.createElement('button', { type: 'button', className: 'tp-act', onClick: props.onRedo }, UI_COPY.xishi['shuffle-again']))),
    React.createElement('div', {
      className: 'rd-box tp-table' + (isLeno ? ' leno-table' : ''),
      style: { aspectRatio: String(ratio), '--rd-cap-fs': capFs + 'px' }
    }, slotKids),
    React.createElement('div', { className: 'tp-fan' + (closing ? ' closing' : '') },
      React.createElement('div', { className: 'tp-fan-cap' }, UI_COPY.xishi['fan-hint']),
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
      : React.createElement('div', { className: 'rd-ph', style: { background: TAROT_SUIT_COLOR[c.suit] || 'var(--tc-suit-major)' } }, c.name);
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
  const sub = React.createElement('div', { className: 'rd-zsub' }, UI_COPY.xishi['zoom-hint']);
  const imgEl = card.img
    ? React.createElement('img', { key: 'im' + idx, className: 'rd-zimg' + (rev ? ' reversed' : ''), src: card.img, alt: card.name })
    : React.createElement('div', { className: 'rd-zimg rd-zph', style: { background: TAROT_SUIT_COLOR[card.suit] || 'var(--tc-suit-major)' } }, card.name);
  const nameRow = React.createElement('div', { className: 'rd-zname' }, card.name || '', React.createElement('span', { className: 'rd-zori ' + (rev ? 'rev' : 'up') }, rev ? UI_COPY.xishi['reversed'] : UI_COPY.xishi['up']));
  const bodyEl = bodyText ? React.createElement('div', { className: 'rd-zbody' }, bodyText) : null;
  const kwEl = kwLine ? React.createElement('div', { className: 'rd-zkw' }, UI_COPY.xishi.keywords, kwLine) : null;
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
  const [mode, setMode] = useState(function () { return mlAskNextDefault('auto'); }); // 'auto' | 'manual'
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
      if (mlShouldPlayAnim() && mlShouldShowCards()) setDealStage('shuffle'); else setDealStage('done');
    } catch (e) {
      setErrored((e && e.message) || UI_COPY.xishi['pick-fail']);
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
      toast(fmtTpl(ML_COPY.ui.toast['xishi-pick-all-positions'], { name: spread.name, count: spread.pos.length }));
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
      setErrored((e && e.message) || UI_COPY.xishi['pick-submit-fail']);
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
      setInterp((res && res.data && res.data.interpretation) || UI_COPY.xishi['no-content']);
    } catch (e) {
      setInterpErr((e && e.message) || UI_COPY.xishi['interp-fail']);
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
    setMode(mlAskNextDefault(mode));
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
  const spreadName = (drawData && drawData.spreadName) || (spread && spread.name) || UI_COPY.xishi['result-title'];
  // REQ-066⑥：牌面图片显示（塔罗/雷诺曼）—— 关 = 纯文字列表模式（隐藏牌面图/扇形）
  const cardImagesOn = ML_SETTINGS.card_images !== false;
  const askQ = (question || '').trim();
  // REQ-042 v2：draw 顶部承接所填占问问题文本（保留）
  const askEcho = askQ ? React.createElement('div', { className: 'ask-echo' }, UI_COPY.xishi.question, askQ) : null;
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
        React.createElement('span', { className: 'mi-orient' + (n.reversed ? ' rev' : ' up') }, n.reversed ? UI_COPY.xishi['reversed'] : UI_COPY.xishi['up'])),
      meanText ? React.createElement('div', { className: 'mi-txt' }, meanText) : null,
      kwLine ? React.createElement('div', { className: 'mi-kw' }, UI_COPY.xishi.keywords, kwLine) : null);
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
      React.createElement('div', { className: 'section-title' }, UI_COPY.xishi['draw-fail']),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: redo }, UI_COPY.buttons.retry));
  } else if (data) {
    // ================= REQ-129：取牌段（shuffle/cut/fan）与结果段（done）分流 =================
    // 取牌段演出仅当 动画开 && 牌面图开 && 牌阵有 pos && 非手动路径 时进入（手动路径直接 done）
    const animOn = mlShouldPlayAnim();
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
    ML_SETTINGS.default_mode === 'both'
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
      React.createElement('div', { className: 'dk-thumb' }, d.thumb && cardImagesOn ? React.createElement('img', { src: d.thumb, alt: d.name, loading: 'lazy', decoding: 'async' }) : React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--tc-white)', fontSize: 17, fontWeight: 700 } }, d.name.slice(0, 1))),
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
  const inPickPlay = Boolean(data && cardImagesOn && mlShouldPlayAnim() && dealStage !== 'done');
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
const LN_SUIT_COLOR = { hearts: 'var(--tc-suit-hearts)', diamonds: 'var(--tc-suit-diamonds)', spades: 'var(--tc-suit-spades)', clubs: 'var(--tc-suit-clubs)' };
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
        item.img ? React.createElement('img', { className: 'tc-img', src: item.img, alt: item.name, loading: 'lazy', decoding: 'async' }) : React.createElement('div', { className: 'tc-ph', style: { background: LN_SUIT_COLOR[item.suit] || 'var(--tc-suit-clubs)' } }, item.name)),
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
      : React.createElement('div', { className: 'rd-ph', style: { background: LN_SUIT_COLOR[c.suit] || 'var(--tc-suit-clubs)' } }, c.name);
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
  const sub = React.createElement('div', { className: 'rd-zsub' }, UI_COPY.xishi['zoom-hint']);
  const imgEl = card.img
    ? React.createElement('img', { key: 'im' + idx, className: 'rd-zimg', src: card.img, alt: card.name })
    : React.createElement('div', { className: 'rd-zimg rd-zph', style: { background: LN_SUIT_COLOR[card.suit] || 'var(--tc-suit-clubs)' } }, card.name);
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
  if (kwLine) boxKids.push(React.createElement('div', { key: 'kw', className: 'rd-zkw' }, UI_COPY.xishi.keywords, kwLine));
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
  const [mode, setMode] = useState(function () { return mlAskNextDefault('auto'); }); // 'auto' | 'manual'
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
      if (mlShouldPlayAnim() && mlShouldShowCards()) setDealStage('shuffle'); else setDealStage('done');
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
      toast(fmtTpl(ML_COPY.ui.toast['xishi-pick-all-positions'], { name: spread.name, count: need }));
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
      setInterp((res && res.data && res.data.interpretation) || UI_COPY.xishi['no-content']);
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
    setMode(mlAskNextDefault(mode));
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
  const cardImagesOn = ML_SETTINGS.card_images !== false;
  const askQ = (question || '').trim();
  // REQ-043 v2：draw 顶部承接所填占问问题文本
  const askEcho = askQ ? React.createElement('div', { className: 'ask-echo' }, UI_COPY.xishi.question, askQ) : null;
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
      kwLine ? React.createElement('div', { className: 'mi-kw' }, UI_COPY.xishi.keywords, kwLine) : null);
  });
  let body = null;
  if (loading && step === 'draw') {
    body = React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'section-title' }, spreadName, ' · 抽牌中'),
      React.createElement('div', { className: 'skeleton sk-line' }),
      React.createElement('div', { className: 'skeleton sk-line', style: { width: '60%' } }));
  } else if (errored && step === 'draw') {
    body = React.createElement('div', { className: 'card failed-box' },
      React.createElement('div', { className: 'section-title' }, UI_COPY.xishi['draw-fail']),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: redo }, UI_COPY.buttons.retry));
  } else if (data) {
    // ================= REQ-130：取牌段（shuffle/cut/fan）与结果段（done）分流 =================
    // 取牌段演出仅当 动画开 && 牌面图开 && 牌阵有 pos && 非手动路径 时进入（手动路径直接 done）
    const animOn = mlShouldPlayAnim();
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
    ML_SETTINGS.default_mode === 'both'
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
      React.createElement('div', { className: 'dk-thumb' }, d.thumb && cardImagesOn ? React.createElement('img', { src: d.thumb, alt: d.name, loading: 'lazy', decoding: 'async' }) : React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--tc-white)', fontSize: 17, fontWeight: 700 } }, String(d.num))),
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
  const inPickPlay = Boolean(data && cardImagesOn && mlShouldPlayAnim() && dealStage !== 'done');
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

/* REQ-045：A1 星座三格（太阳/月亮/上升）趋势文案。72 篇 = 3 类 x 12 星座 x male/female。
   文案源 docs/文案交付/A1_zodiac_trends.json（_meta 不入前端，正文替换「文案待补充」占位） */
/* 12 星座英文→中文映射（兼容后端可能返回的英文 sign；带「座」的中文输入在 signToCn 里去「座」归一化） */
const SIGN_EN_TO_CN = {
  aries: '白羊',
  taurus: '金牛',
  gemini: '双子',
  cancer: '巨蟹',
  leo: '狮子',
  virgo: '处女',
  libra: '天秤',
  scorpio: '天蝎',
  sagittarius: '射手',
  capricorn: '摩羯',
  aquarius: '水瓶',
  pisces: '双鱼'
};
function signToCn(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const hit = SIGN_EN_TO_CN[s.toLowerCase()];
  if (hit) return hit;
  /* 已兼容中文输入：Aries 之外一律按中文处理，去掉末尾「座」后即数据 key（如 金牛座→金牛） */
  return s.slice(-1) === '座' ? s.slice(0, -1) : s;
}
const A1_ZODIAC_TRENDS = {
  'sun': {
    '白羊':{male:'太阳白羊的男士，天生一股向前冲的劲头，事业上敢抢先机、扛得起事；感情里坦荡直接，吃软不吃硬。阶段趋势更宜把冲劲落在具体目标上，少些无谓的较劲。',female:'太阳白羊的女士，明快热烈、遇事愿意兜底，事业上行动力是最大底气；感情中偏爱坦荡公开的偏爱。趋势更宜把热情导向可沉淀的事，而非一时的胜负。'},
    '金牛':{male:'太阳金牛的男士，稳重隐忍、慢热靠谱，事业靠长期深耕与坚持见功；感情中不擅甜言，只用踏实陪伴说话。趋势宜守住节奏，莫因外界喧嚣打乱自己的步调。',female:'太阳金牛的女士，温柔文静、气质治愈，事业上人缘与口碑俱佳、稳中进阶；感情偏爱细水长流的认定。趋势宜在安稳中给自己留一点绽放的空间。'},
    '双子':{male:'太阳双子的男士，思维灵活、反应极快，事业靠沟通与变通破局；感情里需要持续的同频与新鲜感。趋势宜把通透用于成事，别让跳跃的心思散了重点。',female:'太阳双子的女士，通透会说、内核比外表更稳，事业擅对接与统筹；感情重沟通、受不了冷战。趋势宜在多变中留一处安定，让关系有处落脚。'},
    '巨蟹':{male:'太阳巨蟹的男士，温柔大气、柔中带刚，事业里责任心与团队感强；感情极致顾家、最怕冷落与背叛。趋势宜把共情化作稳健的行动，别让情绪替你做决定。',female:'太阳巨蟹的女士，温柔体贴、共情力满格，事业适合服务与人文类赛道；感情全心付出、偏爱长久安稳。趋势宜在照顾他人之余，先安顿好自己。'},
    '狮子':{male:'太阳狮子的男士，自信大气、自带气场，事业里天生有号召力、敢扛事；感情偏爱公开坦荡、需要被认可。趋势宜把要强化为担当，少些对面子的执念。',female:'太阳狮子的女士，大方仗义、爱体面，事业适合带队与统筹；感情浪漫热情、绝不将就。趋势宜在发光的同时留一份柔软，让强也显得温柔。'},
    '处女':{male:'太阳处女的男士，细致周全、温柔包容，事业以严谨与靠谱立身；感情默默付出、用行动证明爱意。趋势宜在追求完美时放过自己，别被细节拖垮节奏。',female:'太阳处女的女士，心思细腻、观察入微，事业是团队里最让人放心的存在；感情细节拉满、长情专一。趋势宜把标准用在成事，而非苛责已足够好的自己。'},
    '天秤':{male:'太阳天秤的男士，温柔有底线、外柔内刚，事业擅协调与化解矛盾；感情向往平等尊重的双向奔赴。趋势宜在顾及他人时守住自己的原则，别总说『都行』。',female:'太阳天秤的女士，温柔谦和、情商出众，事业适合公关与人际赛道；感情讲究相处舒服、三观契合。趋势宜在维持和谐时，也把真实的需求说出口。'},
    '天蝎':{male:'太阳天蝎的男士，沉稳内敛、观察入微，事业靠隐忍蓄力与精准出击；感情爱憎分明、极度专一。趋势宜把掌控欲化为深度，别让防备隔绝了值得信任的人。',female:'太阳天蝎的女士，低调神秘、心思缜密，事业擅长洞察与深耕；感情纯粹而较真、容不得敷衍。趋势宜在深情里留一分松弛，让信任有机会靠近。'},
    '射手':{male:'太阳射手的男士，阳光豁达、正直坦荡，事业格局开阔、擅开拓；感情坦荡不套路、认定后极负责。趋势宜把自由心性用于探索，别让洒脱变成回避。',female:'太阳射手的女士，开朗通透、自带元气，事业擅对外拓展与资源对接；感情真诚不藏心机。趋势宜在奔向世界时，也给身边人留一个温柔的落点。'},
    '摩羯':{male:'太阳摩羯的男士，坚韧务实、有担当，事业以深耕与责任见长；感情不擅表达、却以稳定予人依靠。趋势宜在攀登时允许自己休息，别把全部重量都扛在肩上。',female:'太阳摩羯的女士，稳重有毅、低调进阶，事业靠靠谱与沉淀赢得位置；感情慢热专一、重长久。趋势宜在务实中留一点浪漫，让努力也被自己看见。'},
    '水瓶':{male:'太阳水瓶的男士，独立创新、理性清醒，事业擅长破局与新方向；感情需要空间与同频，不喜捆绑。趋势宜在特立独行时，也接住身边人朴素的陪伴。',female:'太阳水瓶的女士，前卫独特、思想通透，事业适合创新与人文交织的赛道；感情重精神契合。趋势宜在保持自我的同时，给关系一点可被靠近的温度。'},
    '双鱼':{male:'太阳双鱼的男士，浪漫敏感、富有同情，事业适合以想象与温度打动人；感情深情而易内耗。趋势宜把柔软化作创作力，别让情绪替你淹没现实。',female:'太阳双鱼的女士，梦幻善良、共情满格，事业适合艺术与治愈类方向；感情纯粹、渴望被懂。趋势宜在浪漫中落地一步，让温柔也有骨气。'}
  },
  'moon': {
    '白羊':{male:'月亮白羊的男士，内心刚烈而护短，情绪来得快去得也快；亲密关系里占有欲藏在温柔之下。趋势宜给情绪一个出口，别让一时的硬碰硬伤了亲近的人。',female:'月亮白羊的女士，外显随性、内里刚强，触碰底线会瞬间强硬反击；感情中极度护短。趋势宜练习把情绪说出口，而非独自消化后再爆发。'},
    '金牛':{male:'月亮金牛的男士，内心恋旧、极度贪稳，依赖熟悉的环境与人；感情需要踏实靠谱的陪伴。趋势宜在求稳中允许一点新意，别让惯性变成退缩。',female:'月亮金牛的女士，情感稳定、追求舒适与安全，偏爱物质与情绪都安稳的关系。趋势宜在享受平顺时，也留意那些被习惯掩盖的真实需求。'},
    '双子':{male:'月亮双子的男士，内心怕闷、极度需要陪伴与交谈，独处易生内耗；感情最看重沟通。趋势宜用分享连接彼此，也给自己留一处安静。',female:'月亮双子的女士，情绪多变、怕无聊，靠互动治愈孤单；感情里敏感易被细节打动也易受伤。趋势宜在丰富日常时，守住内心的重心。'},
    '巨蟹':{male:'月亮巨蟹的男士，敏感细腻、极度缺安全感，习惯自我消化委屈；感情里最怕冷淡与背叛。趋势宜把需求说清，别让沉默替你积攒隔阂。',female:'月亮巨蟹的女士，内心柔软、恋家念旧，一点冷淡就能掀起情绪波澜；感情需要持续偏爱。趋势宜在求稳中练习表达，让对方知道你的真实。'},
    '狮子':{male:'月亮狮子的男士，内心骄傲、受不了否定，被认可便满血；感情里要被崇拜与坚定选择。趋势宜在好强时留一分柔软，别让面子挡了亲密。',female:'月亮狮子的女士，内在傲娇、自尊心强，可以不被夸但不容被轻视；感情渴望被偏爱。趋势宜在期待被看见时，也主动说出你的需要。'},
    '处女':{male:'月亮处女的男士，完美主义拉满、易因细节焦虑，感情里走心且容不得敷衍。趋势宜把标准留给事、把宽容留给人，别让苛求困住关系。',female:'月亮处女的女士，情感细腻、细节洁癖，默默付出却易多想内耗；感情里极度走心。趋势宜在追求完美时，先接纳那份『足够好』。'},
    '天秤':{male:'月亮天秤的男士，内心依赖关系、怕冲突，习惯迁就以维持体面；感情里是温柔的恋爱脑。趋势宜在维持和谐时，也守住自己的边界。',female:'月亮天秤的女士，情感依赖、需要陪伴，爱情几乎是生活的必需品；感情里容易心软妥协。趋势宜在迁就他人时，也问问自己真正想要什么。'},
    '天蝎':{male:'月亮天蝎的男士，深情而防备，安全感只来自真诚与唯一偏爱；感情里极度较真。趋势宜在洞察人心时，也给信任一个落脚的机会。',female:'月亮天蝎的女士，敏感通透、藏得住情绪，感情极致纯粹、难再信任；受伤后久久难愈。趋势宜在自我保护时，别把值得的人也隔在门外。'},
    '射手':{male:'月亮射手的男士，内心爱自由、最怕束缚，情绪来去都快、不记仇；感情需私人空间。趋势宜在奔放时，给对方一个可被抓住的锚。',female:'月亮射手的女士，情感自由、乐观少内耗，最窒息的是被管控；感情里看似随性关键时刻却靠谱。趋势宜在给彼此空间时，也回一句安心的信号。'},
    '摩羯':{male:'月亮摩羯的男士，情感克制、责任感强，习惯把情绪压成动力；感情里深沉不张扬。趋势宜在扛住一切时，也允许自己被照顾一次。',female:'月亮摩羯的女士，情感务实、责任为重，常把感受藏在工作与担当之下；感情慢热而长情。趋势宜在稳固外界时，别忽略内心那个也需要被哄的自己。'},
    '水瓶':{male:'月亮水瓶的男士，情感独立、理性疏离，习惯与情绪保持距离；感情里需要空间与尊重。趋势宜在保持清醒时，也试着靠近真实的温热。',female:'月亮水瓶的女士，内心独立、理性通透，感情不喜黏腻、重精神同频。趋势宜在自由自在时，给关系留一点可被依靠的实处。'},
    '双鱼':{male:'月亮双鱼男士，情感细腻易感、富有同情，常把他人情绪揽在自己身上；感情里极易共情。趋势宜在善待世界时，先分清哪些是你的、哪些不是。',female:'月亮双鱼女士，温柔多感、直觉敏锐，感情里浪漫而牺牲型；易因他人起伏而乱己心。趋势宜在深爱时保留自我，别在共情中弄丢边界。'}
  },
  'rising': {
    '白羊':{male:'上升白羊的男士，初见便带锋芒，处事干脆利落、好胜心强；社交中自带领跑气场。趋势宜把争先的劲头用于开拓，留意别因太快忽略他人节奏。',female:'上升白羊的女士，第一印象利落明亮、敢爱敢冲，社交中自然成焦点般的存在。趋势宜在主动中保留余地，让锋芒更显从容。'},
    '金牛':{male:'上升金牛的男士，初见温柔文静、气质舒服，待人平和有礼；社交里自带岁月静好的松弛。趋势宜在让人放心时，也适时露出你的主张。',female:'上升金牛的女士，第一眼踏实治愈、举止优雅，社交中给人极好的安稳感。趋势宜在温柔包容时，也让人看见你清晰的边界。'},
    '双子':{male:'上升双子的男士，初见健谈幽默、情商极高，自来熟而不怯场；社交里是轻松的破冰者。趋势宜在八面玲珑时，让人也触到你的真心。',female:'上升双子的女士，初见话多通透、风趣迷人，社交中自带轻盈的气场。趋势宜在广结善缘时，留一处只给少数人的深度。'},
    '巨蟹':{male:'上升巨蟹的男士，初见内向慢热、不善言辞，人多时略显拘谨；熟了才显温柔本性。趋势宜在慢热中主动给一点信号，别让腼腆误读为疏离。',female:'上升巨蟹的女士，初见害羞被动、慢热腼腆，相处越久越显温柔依赖。趋势宜在保护壳里，也试着先迈出一小步靠近。'},
    '狮子':{male:'上升狮子的男士，初见自带高光、气场全开，大方自信、落落大方；社交里天然是焦点。趋势宜在耀眼时，也把光分一点给他人。',female:'上升狮子的女士，第一眼耀眼夺目、浪漫热情，社交中从容自信、自带存在感。趋势宜在发光时留一份倾听，让强也显得亲和。'},
    '处女':{male:'上升处女的男士，初见自律克制、严谨礼貌，言行分寸感极强；社交里让人觉可靠。趋势宜在规矩得体的同时，也放松一点让人靠近。',female:'上升处女的女士，初见高冷克制、不好接近，熟了才显温柔细致；社交中严谨自律。趋势宜在自我保护时，先给人一个可走近的缝隙。'},
    '天秤':{male:'上升天秤的男士，初见气质绝佳、谈吐优雅，天生外交家、好感度拉满；社交里游刃有余。趋势宜在面面俱到时，也亮出你真实的好恶。',female:'上升天秤的女士，第一眼完美得体、温柔有礼，社交中情商天花板般的存在。趋势宜在外柔内刚时，也把底线讲得清楚明白。'},
    '天蝎':{male:'上升天蝎的男士，初见高冷疏离、自带神秘气场，沉默寡言、不轻易社交；让人不敢随意招惹。趋势宜在保持距离时，给可信者一个入口。',female:'上升天蝎的女士，初见高冷难追、神秘感拉满，社交中自带让人想探究的气场。趋势宜在设防时，也为真诚留一扇半开的门。'},
    '射手':{male:'上升射手的男士，初见阳光元气、豁达洒脱，爱笑开朗、亲和力满格；社交里让人极舒服。趋势宜在自在松弛时，也让人感到被你认真对待。',female:'上升射手的女士，第一眼阳光迷人、毫无距离感，社交中元气满满、让人想靠近。趋势宜在开朗外向时，也给深情留一处安静。'},
    '摩羯':{male:'上升摩羯的男士，初见稳重有魄、不苟言笑，社交里自带让人信服的权威感。趋势宜在靠谱专业时，也露一点温度，别总让人不敢走近。',female:'上升摩羯的女士，初见沉稳大气、低调有魅力，社交中让人觉可托付。趋势宜在克制得体时，也大胆展现你的光彩。'},
    '水瓶':{male:'上升水瓶的男士，初见独立特别、思维跳脱，社交里疏离中带点迷人怪趣。趋势宜在保持自我时，也让人触到你的善意。',female:'上升水瓶的女士，第一眼独特前卫、思绪飞扬，社交中清新不流俗。趋势宜在特立独行时，也给关系一个可被牵住的手。'},
    '双鱼':{male:'上升双鱼男士，初见温柔梦幻、气质柔和，社交里让人想呵护；自带一层朦胧的好感。趋势宜在柔软亲切时，也让人看见你的清醒。',female:'上升双鱼女士，第一眼浪漫温柔、眼神含情，社交中自带让人想靠近的柔光。趋势宜在善解人意时，也守住不被轻易消耗的边界。'}
  },
};
/* kind: 'sun'|'moon'|'rising'；signCn：中文星座名（不带「座」）；gender: 'male'|'female'。未命中返回「文案待补充」 */
function zodiacTrendText(kind, signCn, gender) {
  try {
    const set = A1_ZODIAC_TRENDS[kind];
    const g = gender === 'female' ? 'female' : gender === 'male' ? 'male' : '';
    const t = set && signCn && set[signCn] && g ? set[signCn][g] : '';
    return t && typeof t === 'string' ? t : '文案待补充';
  } catch (e) {
    return '文案待补充';
  }
}
/* ================= REQ-057：星座 · 恋爱关系（太阳星座匹配轻板块） =================
   P3 区分：与 REQ-030「配对解析」（双档案合盘、付费 LLM、独立入口）不同，本条仅展示
   「当前档案太阳星座 × 其余 11 星座」的静态固定匹配（免费、零请求、非双人生辰合盘）。
   文案（T1–T3 星座 132×3 对「分值 + 说明」）从 window.ML_PAIRS 查表（frontend/public/data/pairs.js，
   文案轮次交付物，更新时只替换该文件；self/other 用「白羊座…双鱼座」全名，与 T1T3_zodiac_*.json 一致）。
   查表失败时优雅降级为兜底说明（不报错）。
   合规口径：与 REQ-045 三格 / 文案轮次同一体系 —— 趋势参考口吻，页面级免责沿用全局页脚。 */
const SUN_LOVE_ORDER = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
/* 星座全名（与 T1T3_zodiac_*.json 的 self/other 取值一致；索引对齐 SUN_LOVE_ORDER） */
const SUN_FULL = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
function sunFullOf(short) {
  const i = SUN_LOVE_ORDER.indexOf(short);
  return i >= 0 ? SUN_FULL[i] : '';
}
/* 按关系 kind 从 window.ML_PAIRS 查 self=全名 mineFull、other=全名 otherFull 的配对；命中返回该条，未命中返回 null */
function sunPairLookup(kind, mineFull, otherFull) {
  const key = kind === 'friend' ? 'zodiac_friend' : kind === 'boss' ? 'zodiac_boss' : 'zodiac_love';
  const mod = window.ML_PAIRS && window.ML_PAIRS[key];
  const pairs = mod && Array.isArray(mod.pairs) ? mod.pairs : null;
  if (!pairs) return null;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (p && String(p.self) === String(mineFull) && String(p.other) === String(otherFull)) {
      return p;
    }
  }
  return null;
}
/* 生成「当前太阳星座 × 其余 11 星座」匹配列表（kind: 'love' | 'friend' | 'boss'；分值 + 说明文字
   取自 ML_PAIRS，分值降序、同分按星座序）。REQ-083 恋爱 / 朋友 / 上下级三关系统一走本函数 */
function sunRelPairs(mine, kind) {
  const k = kind === 'friend' || kind === 'boss' ? kind : 'love';
  const mineFull = sunFullOf(mine);
  if (!mineFull) return [];
  return SUN_LOVE_ORDER.filter(function (s) {
    return s !== mine;
  }).map(function (s) {
    const hit = sunPairLookup(k, mineFull, sunFullOf(s));
    return {
      sign: s,
      score: hit && hit.score != null ? hit.score : null,
      pct: hit && hit.score != null ? Math.round(hit.score / 5 * 100) : 0,
      txt: hit && hit.text && String(hit.text).trim() ? hit.text : REL_TEXT_FALLBACK
    };
  }).sort(function (x, y) {
    return (y.score == null ? -1 : y.score) - (x.score == null ? -1 : x.score) || SUN_LOVE_ORDER.indexOf(x.sign) - SUN_LOVE_ORDER.indexOf(y.sign);
  });
}
/* REQ-057：恋爱关系弹窗沿用 sunRelPairs(mine, 'love') */
function sunLovePairs(mine) {
  return sunRelPairs(mine, 'love');
}
/* 恋爱关系弹窗（PairModal 同款容器样式）：有太阳星座 → 与其余 11 星座匹配宫格；
   无太阳星座（未生成星盘/未选档案）→ 「请先生成星盘」引导，不展示空表 */
function SunLoveModal({
  sunCn,
  caseName,
  onClose,
  onGoChart
}) {
  const el = React.createElement;
  const me = String(sunCn || '').trim();
  const hasSun = !!me && SUN_LOVE_ORDER.indexOf(me) !== -1;
  const list = hasSun ? sunLovePairs(me) : [];
  const starN = sc => sc >= 5 ? 5 : sc >= 4.5 ? 4 : sc >= 3 ? 3 : 2;
  const FULL = '★★★★★';
  const EMPTY = '☆☆☆☆☆';
  const cells = list.map(function (p) {
    const n = starN(p.score);
    return el('div', {
      key: p.sign,
      style: {
        border: '1px solid var(--border)',
        background: 'var(--paper)',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0
      }
    }, el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6
      }
    }, el('span', {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--text-1)',
        whiteSpace: 'nowrap'
      }
    }, SIGN_SYM[SUN_LOVE_ORDER.indexOf(p.sign)] + ' ' + p.sign), el('span', {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--skin-accent)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
      }
    }, p.score != null ? '分 ' + p.score : '—')), el('div', {
      style: {
        fontSize: 12,
        lineHeight: 1,
        letterSpacing: 1
      }
    }, el('span', {
      style: {
        color: 'var(--tc-amber)'
      }
    }, FULL.slice(0, n)), el('span', {
      style: {
        color: 'var(--text-3)',
        opacity: .5
      }
    }, EMPTY.slice(0, 5 - n))), el('div', {
      style: {
        fontSize: 11.5,
        color: 'var(--text-3)',
        lineHeight: 1.6
      }
    }, p.txt));
  });
  const hd = el('div', {
    className: 'pair-hd'
  }, el('div', {
    className: 'pair-hd-title'
  }, el(Icon, {
    name: 'orbit',
    size: 20,
    color: 'var(--skin-accent)'
  }), '恋爱关系 · 太阳星座匹配'), el('button', {
    type: 'button',
    className: 'pair-x',
    onClick: onClose,
    title: UI_COPY.buttons.close
  }, '✕'));
  const sub = el('div', {
    className: 'pair-sub'
  }, hasSun ? '以「' + (caseName ? caseName : '当前档案') + ' · 太阳' + me + '」为基准，查看与其余 11 星座的恋爱匹配度。分值越高表示性格层面越合拍（静态轻内容、免费、不扣余额）。' : '本板块以档案的太阳星座为基准做恋爱匹配（免费静态轻内容，区别于双档案合盘的「配对解析」）。');
  let inner = null;
  if (hasSun) {
    inner = el('div', null, el('div', {
      className: 'pair-sec-label',
      style: {
        marginTop: 4
      }
    }, el('span', {
      className: 'ps-n'
    }, '我'), '太阳星座 · ', me, '（其余 11 星座匹配度，按基础合意从高到低）'), el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: 8,
        marginTop: 6
      }
    }, cells));
  } else {
    inner = el('div', {
      style: {
        background: 'var(--paper)',
        border: '1px dashed var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        textAlign: 'center'
      }
    }, el('div', {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--text-1)',
        marginBottom: 6
      }
    }, '太阳星座未知 · ' + (caseName ? '请先生成星盘' : '请先选择档案')), el('div', {
      style: {
        fontSize: 12.5,
        color: 'var(--text-2)',
        lineHeight: 1.8
      }
    }, caseName ? '当前已选档案「' + caseName + '」尚未生成本命星盘，无法确定太阳星座。点击「去生成星盘」免费排盘（确定性计算；该档案已生成过则直接复用、不重复计费），成功后再次点击「恋爱关系」入口即可查看。' : '尚未选择档案。请先在上方「选择档案 · 生成免费本命盘」中选择一份档案并生成/查看星盘，确定太阳星座后再来查看恋爱匹配。'), el('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        gap: 10,
        marginTop: 12,
        flexWrap: 'wrap'
      }
    }, caseName ? el('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: {
        width: 'auto'
      },
      onClick: onGoChart
    }, '去生成星盘') : null, el('button', {
      type: 'button',
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: onClose
    }, UI_COPY.buttons.close)));
  }
  const disclaimer = el('div', {
    className: 'pair-pay'
  }, '说明：太阳星座匹配仅为性格层面的娱乐参考（5 星制分值 + 趋势参考说明，仅供娱乐与启发），不构成婚恋或其他现实建议；如需基于双方完整星盘的深度合盘，请使用上方「配对解析」。');
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 风格
  return el(ModalBase, {
    onClose: onClose,
    className: 'pair-modal',
    width: 620,
    scrollable: true,
    align: 'left',
    footer: hasSun ? el('div', { className: 'pair-foot' },
      el('button', { type: 'button', className: 'btn btn-outline', onClick: onClose }, UI_COPY.buttons.close)
    ) : null
  }, hd, sub, inner, disclaimer);
}

/* REQ-083：朋友 / 上下级关系弹窗 —— 与 SunLoveModal 同款容器（PairModal 同款样式）：
   分值 + 说明文字从 window.ML_PAIRS 查表（sunRelPairs(mine, kind)，T2 / T3 文案交付）；
   kind: 'friend' | 'boss'，标题分别「朋友关系 / 上下级关系 · 太阳星座匹配」。 */
function fmtTpl(t, kv) {
  return String(t == null ? '' : t).replace(/\{(\w+)\}/g, function (_, k) {
    return kv && kv[k] != null ? kv[k] : '{' + k + '}';
  });
}
const SUN_REL_KINDS = {
  friend: { title: UI_COPY.sunRel.modalFriendTitle, rel: UI_COPY.sunRel.relName.friend, kind: 'friend' },
  boss: { title: UI_COPY.sunRel.modalBossTitle, rel: UI_COPY.sunRel.relName.boss, kind: 'boss' }
};
function SunRelationModal({
  kind,
  sunCn,
  caseName,
  onClose,
  onGoChart
}) {
  const el = React.createElement;
  const meta = SUN_REL_KINDS[kind] || SUN_REL_KINDS.friend;
  const me = String(sunCn || '').trim();
  const hasSun = !!me && SUN_LOVE_ORDER.indexOf(me) !== -1;
  const list = hasSun ? sunRelPairs(me, meta.kind) : [];
  const relCn = meta.rel;
  const starN = sc => sc >= 5 ? 5 : sc >= 4.5 ? 4 : sc >= 3 ? 3 : 2;
  const FULL = '★★★★★';
  const EMPTY = '☆☆☆☆☆';
  const cells = list.map(function (p) {
    const n = starN(p.score);
    return el('div', {
      key: p.sign,
      style: {
        border: '1px solid var(--border)',
        background: 'var(--paper)',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0
      }
    }, el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6
      }
    }, el('span', {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--text-1)',
        whiteSpace: 'nowrap'
      }
    }, SIGN_SYM[SUN_LOVE_ORDER.indexOf(p.sign)] + ' ' + p.sign), el('span', {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--skin-accent)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
      }
    }, p.score != null ? '分 ' + p.score : '—')), el('div', {
      style: {
        fontSize: 12,
        lineHeight: 1,
        letterSpacing: 1
      }
    }, el('span', {
      style: {
        color: 'var(--tc-amber)'
      }
    }, FULL.slice(0, n)), el('span', {
      style: {
        color: 'var(--text-3)',
        opacity: .5
      }
    }, EMPTY.slice(0, 5 - n))), el('div', {
      style: {
        fontSize: 11.5,
        color: 'var(--text-3)',
        lineHeight: 1.6
      }
    }, p.txt));
  });
  const hd = el('div', {
    className: 'pair-hd'
  }, el('div', {
    className: 'pair-hd-title'
  }, el(Icon, {
    name: 'orbit',
    size: 20,
    color: 'var(--skin-accent)'
  }), meta.title), el('button', {
    type: 'button',
    className: 'pair-x',
    onClick: onClose,
    title: UI_COPY.buttons.close
  }, '✕'));
  const sub = el('div', {
    className: 'pair-sub'
  }, hasSun
    ? fmtTpl(UI_COPY.sunRel.modalHasSun, { case: caseName ? caseName : '当前档案', me: me, rel: relCn })
    : fmtTpl(UI_COPY.sunRel.modalNoCase, { rel: relCn }));
  let inner = null;
  if (hasSun) {
    inner = el('div', null, el('div', {
      className: 'pair-sec-label',
      style: {
        marginTop: 4
      }
    }, el('span', {
      className: 'ps-n'
    }, '我'), '太阳星座 · ', me, '（其余 11 星座匹配度，按基础合意从高到低）'), el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: 8,
        marginTop: 6
      }
    }, cells));
  } else {
    const noCase = !caseName;
    inner = el('div', {
      style: {
        background: 'var(--paper)',
        border: '1px dashed var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        textAlign: 'center'
      }
    }, el('div', {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--text-1)',
        marginBottom: 6
      }
    }, noCase ? UI_COPY.sunRel.noSunHeadNoCase : UI_COPY.sunRel.noSunHeadCase), el('div', {
      style: {
        fontSize: 12.5,
        color: 'var(--text-2)',
        lineHeight: 1.8
      }
    }, fmtTpl(noCase ? UI_COPY.sunRel.modalNoSunNoCase : UI_COPY.sunRel.modalNoSunCase, { case: caseName || '', rel: relCn })), el('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        gap: 10,
        marginTop: 12,
        flexWrap: 'wrap'
      }
    }, noCase ? null : el('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: {
        width: 'auto'
      },
      onClick: onGoChart
    }, '去生成星盘'), el('button', {
      type: 'button',
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: onClose
    }, UI_COPY.buttons.close)));
  }
  const disclaimer = el('div', {
    className: 'pair-pay'
  }, UI_COPY.sunRel.modalFoot);
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 风格
  return el(ModalBase, {
    onClose: onClose,
    className: 'pair-modal',
    width: 620,
    scrollable: true,
    align: 'left',
    footer: hasSun ? el('div', { className: 'pair-foot' },
      el('button', { type: 'button', className: 'btn btn-outline', onClick: onClose }, UI_COPY.buttons.close)
    ) : null
  }, hd, sub, inner, disclaimer);
}

function AstrologyPage({
  onNavigate,
  initCaseId
}) {
  const el = React.createElement;
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [tab, setTab] = useState('natal');
  const [caseList, setCaseList] = useState([]);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseErrored, setCaseErrored] = useState('');
  const [caseId, setCaseId] = useState(initCaseId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  // REQ-057 / REQ-083：恋爱 / 朋友 / 上下级 关系匹配弹窗开关（null=关；'love' | 'friend' | 'boss'）
  const [relOpen, setRelOpen] = useState(null);
  const TAB_LIST = [['natal', '本命盘'], ['yearly', '流年'], ['monthly', '流月'], ['daily', '流日']];
  const chart = data && data.chart ? data.chart : null;
  const natalRaw = chart && chart.natal ? chart.natal : null;
  const natal = astroNorm(natalRaw);
  const birthInfo = natal.birth || {};
  // 星盘复用国学档案：挂载时拉档案列表，生辰（出生日期/时间/性别/出生地经纬度）由后端从档案读取
  const loadCases = async () => {
    setCaseLoading(true);
    setCaseErrored('');
    try {
      const res = await api('/cases', {
        method: 'GET'
      });
      const list = res && res.data && res.data.cases || res && res.cases || [];
      setCaseList(list);
    } catch (e) {
      setCaseErrored(e && e.message ? e.message : '档案列表加载失败，请重试。');
    } finally {
      setCaseLoading(false);
    }
  };
  useEffect(() => {
    loadCases();
  }, []);

  // 档案卡 meta 升级：由「出生年/性别/出生地」改为「出生年月日 + 太阳星座(若有)」。
  // GET /cases 列表项只带 birthYear/gender/birthplace（无出生月日、无星盘存在性），故列表
  // 就绪后对每份档案并行拉一次 archive（GET /cases/{id}/archive，结果缓存在 detailMap，
  // 同列表不重复探测）：
  //   - input.birth_year/month/day → 出生年月日（如 1990年5月20日）；
  //   - astrology 最近一条带 chart.natal 的记录 → 太阳落座 → 「太阳白羊」（已生成过星盘才附上）。
  // 失败/缺字段一律判空兜底（meta 退化为档案出生年），不阻塞档案选择与排盘。
  const [detailMap, setDetailMap] = useState({}); // {caseId: {birthCn, sunCn, hasNatal}}
  const dataCaseId = useRef(null); // 当前下方展示星盘所属档案 id（切换档案即清空盘面，防串档）
  const sunCnOfChart = raw => {
    try {
      const n = astroNorm(raw);
      const arr = n.planets || [];
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (!p) continue;
        const nm = String(p.name || '').toLowerCase();
        const lb = String(p.label || '').toLowerCase();
        if (nm === 'sun' || nm === '太阳' || lb === 'sun' || lb === '太阳') {
          const cn = signToCn(p.sign);
          return cn ? cn : '';
        }
      }
    } catch (e) {}
    return '';
  };
  const birthCnFromDt = s => {
    try {
      const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!m) return '';
      return Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
    } catch (e) {
      return '';
    }
  };
  const patchDetail = (k, patch) => {
    setDetailMap(prev => {
      const cur = prev[k] || {};
      return Object.assign({}, prev, {[k]: {
        birthCn: patch.birthCn || cur.birthCn || '',
        sunCn: patch.sunCn || cur.sunCn || '',
        hasNatal: !!(patch.hasNatal || cur.hasNatal)
      }});
    });
  };
  const probeDetail = async list => {
    const arr = (list || []).filter(c => c && c.caseId != null);
    if (!arr.length) return;
    await Promise.all(arr.map(async c => {
      const k = String(c.caseId);
      try {
        const rr = await api('/cases/' + encodeURIComponent(k) + '/archive');
        const d = rr && rr.data || rr || {};
        const inp = d.input && typeof d.input === 'object' ? d.input : {};
        const y = inp.birth_year;
        const mo = inp.birth_month;
        const dd = inp.birth_day;
        const birthCn = (y != null && mo != null && dd != null)
          ? Number(y) + '年' + Number(mo) + '月' + Number(dd) + '日'
          : '';
        let sunCn = '';
        let hasNatal = false;
        const recs = Array.isArray(d.astrology) ? d.astrology : [];
        for (let i = 0; i < recs.length; i++) {
          const a = recs[i];
          if (a && a.chart && a.chart.natal && typeof a.chart.natal === 'object') {
            hasNatal = true;
            sunCn = sunCnOfChart(a.chart.natal);
            break;
          }
        }
        patchDetail(k, {birthCn: birthCn, sunCn: sunCn, hasNatal: hasNatal});
      } catch (e) {
        /* archive 探测失败：该档案卡 meta 退化为出生年兜底，不阻塞 */
      }
    }));
  };
  const detailKeyRef = useRef(null);
  useEffect(() => {
    if (caseLoading || !caseList.length) return;
    const key = caseList.map(c => c.caseId).join(',');
    if (detailKeyRef.current === key) return;
    detailKeyRef.current = key;
    probeDetail(caseList);
  }, [caseLoading, caseList]);

  // REQ-039 退回细化②：携 caseId 进入本页（档案「查看星盘」/ 建档 returnTo）→ 自动选中
  // 该档案并复用已生成的本命盘（后端按 档案+scope 幂等，命中直接返回已有 chart，零扣费），
  // 不再要求手动「重新生成」；重挂载（再从档案进入）时按新 initCaseId 重新自动加载。
  const autoLoadRef = useRef(null);
  useEffect(() => {
    if (initCaseId == null || autoLoadRef.current === initCaseId) return;
    if (caseLoading) return;
    setCaseId(initCaseId);
  }, [initCaseId, caseLoading]);
  useEffect(() => {
    if (initCaseId == null || autoLoadRef.current === initCaseId) return;
    if (caseId == null || Number(caseId) !== Number(initCaseId)) return;
    if (loading || data || errored) return;
    autoLoadRef.current = initCaseId;
    load('natal');
  }, [initCaseId, caseId, loading, data, errored]);

  // 生成星盘 / 查看星盘：选档案 → POST /astrology/chart，生辰由后端从档案 case.input_json 取。
  // 后端按 (user, case_id, scope) 幂等：已生成过直接返回已有 chart（零扣费、不重复计算），
  // 故「生成星盘」与「查看星盘」共用本函数即可实现「查看已有盘 / 首次生成」两种语义。
  const load = async scope => {
    const sc = scope || 'natal';
    setErrored('');
    setData(null);
    setInterp('');
    setInterpErr('');
    dataCaseId.current = null;
    if (!caseId) {
      setErrored('请先选择一份档案');
      return;
    }
    setLoading(true);
    try {
      const res = await api('/astrology/chart', {
        method: 'POST',
        body: JSON.stringify({
          case_id: Number(caseId),
          scope: sc
        })
      });
      const d = res && res.data ? res.data : res;
      setData(d);
      dataCaseId.current = caseId == null ? null : Number(caseId);
      setTab('natal');
      // 生成/复用成功后即时回填该档案卡 meta：太阳星座（+出生年月日，若盘上可解析）
      if (d && d.chart && d.chart.natal && typeof d.chart.natal === 'object') {
        patchDetail(String(caseId), {
          hasNatal: true,
          sunCn: sunCnOfChart(d.chart.natal),
          birthCn: birthCnFromDt(astroNorm(d.chart.natal).birth && astroNorm(d.chart.natal).birth.dateTime)
        });
      }
    } catch (e) {
      setErrored(e && e.message ? e.message : '星盘生成失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  // 付费解读：命中 reading_json 缓存零扣费，未命中先预检余额再调 LLM
  const interpret = async () => {
    if (!data || !data.id || interpLoading) return;
    setInterpLoading(true);
    setInterpErr('');
    try {
      const res = await api('/astrology/charts' + '/' + data.id + '/interpret', {
        method: 'POST',
        body: '{}'
      });
      setInterp(res && res.data && res.data.interpretation ? res.data.interpretation : UI_COPY.xishi['no-content']);
    } catch (e) {
      setInterpErr(e && e.message ? e.message : '本命深度解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };

  // ---- 档案选择卡片（生辰自动取自档案，不再单独填出生表单） ----
  let casePick = null;
  if (caseLoading) {
    casePick = el('div', {
      style: {
        textAlign: 'center',
        color: 'var(--text-3)',
        fontSize: 13,
        padding: '14px 0'
      }
    }, '档案加载中…');
  } else if (caseErrored && !caseList.length) {
    casePick = el('div', null, el('div', {
      className: 'error'
    }, caseErrored), el('div', {
      className: 'back-row',
      style: {
        justifyContent: 'center'
      }
    }, el('button', {
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: loadCases
    }, '重试档案')));
  } else if (!caseList.length) {
    casePick = el('div', {
      style: {
        textAlign: 'center',
        padding: '16px 8px'
      }
    }, el('div', {
      style: {
        fontSize: 14,
        color: 'var(--text-2)',
        lineHeight: 1.8,
        marginBottom: 10
      }
    }, '暂无档案：请先在「国学预测」中建立出生档案（含出生时间与出生地经纬度），星盘将复用档案生辰，无需重复填写。'), el('div', {
      className: 'back-row',
      style: {
        justifyContent: 'center'
      }
    }, el('button', {
      className: 'btn btn-primary',
      style: {
        width: 'auto'
      },
      onClick: () => onNavigate('onboarding', { returnTo: 'astrology' })
    }, '去建档'), el('button', {
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: () => onNavigate('cases')
    }, '管理档案')));
  } else {
    // REQ-137：星座选档案改下拉（对齐生肖流年下拉样式：档案名/生日展示、选中即用）；
    // 太阳星座（已生成过星盘才附上）并入选项文本。
    const handlePickCase = c => {
      // 切换档案：清空上一档案已生成的星盘/解读展示，防止盘面串档（下方引导重新生成/查看）
      if (data && dataCaseId.current != null && Number(dataCaseId.current) !== Number(c.caseId)) {
        dataCaseId.current = null;
        setData(null);
        setInterp('');
        setInterpErr('');
      }
      setCaseId(c.caseId);
    };
    casePick = el('select', {
      className: 'input',
      value: caseId != null ? String(caseId) : '',
      onChange: e => {
        const id = e.target.value;
        const c = id ? caseList.find(x => Number(x.caseId) === Number(id)) : null;
        if (c) handlePickCase(c);
      },
      style: {
        marginBottom: 0
      }
    }, el('option', {
      value: ''
    }, '请选择档案'), caseList.map(c => {
      const det = detailMap[String(c.caseId)];
      const birthCn = (det && det.birthCn) || (c.birthYear ? c.birthYear + '年' : '');
      const sunTxt = (det && det.hasNatal && det.sunCn) ? '太阳' + det.sunCn : '';
      const nm = c.name || '档案 ' + c.caseId;
      return el('option', {
        key: c.caseId,
        value: String(c.caseId)
      }, nm + (birthCn ? '（' + birthCn + '）' : '') + (sunTxt ? ' · ' + sunTxt : ''));
    }));
  }
  const formCard = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '选择档案 · 生成免费本命盘'), el('div', {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      lineHeight: 1.7,
      marginBottom: 4
    }
  }, '生辰信息自动取自所选档案（出生日期 / 时间 / 性别 / 出生地经纬度），排盘为确定性计算、免费。'), el('div', {
    className: 'step-hint'
  }, el('span', {
    className: 'sh' + (caseId ? '' : ' cur')
  }, '① 选择档案'), el('span', {
    className: 'sh-arr'
  }, '→'), el('span', {
    className: 'sh' + (caseId && !data ? ' cur' : '')
  }, '② ' + UI_COPY.buttons.generate_chart), el('span', {
    className: 'sh-arr'
  }, '→'), el('span', {
    className: 'sh' + (data ? ' cur' : '')
  }, '③ 查看解读')), casePick, el('div', {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4,
      flexWrap: 'wrap'
    }
  },
    // 操作区：选档案后出现并排等宽的「生成星盘 / 查看星盘」双按钮 —— 生成=重新/首次生成；
    // 查看=后端按档案幂等直接复用已有盘（已生成过则零重复计费，等价直接查看）。
    el('button', {
      className: 'btn btn-primary',
      style: {
        flex: '1 1 0',
        minWidth: 0
      },
      disabled: loading || !caseId,
      title: caseId ? '' : '请先选择一份档案',
      onClick: () => load('natal')
    }, loading ? UI_COPY.tips.generating_chart : UI_COPY.buttons.generate_chart),
    caseId ? el('button', {
      className: 'btn btn-outline',
      style: {
        flex: '1 1 0',
        minWidth: 0
      },
      disabled: loading,
      title: '该档案已生成过星盘将直接展示（幂等复用，不重复计费）',
      onClick: () => load('natal')
    }, '查看星盘') : null,
    // 「新建命理档案」横向扩大：与「生成星盘」按钮等宽（同一操作行 flex 均分）
    el('button', {
      className: 'btn btn-outline',
      style: {
        flex: '1 1 0',
        minWidth: 0
      },
      onClick: () => onNavigate('onboarding', { returnTo: 'astrology' })
    }, UI_COPY.buttons.create_case)));

  // ---- 盘型 tab：MVP 先只开放本命盘，其余置灰「敬请期待」 ----
  const tabsNode = el('div', {
    className: 'astro-tabs'
  }, TAB_LIST.map(t => el('div', {
    key: t[0],
    className: 'astro-tab' + (tab === t[0] ? ' sel' : '') + (t[0] !== 'natal' ? ' off' : ''),
    title: t[0] === 'natal' ? '' : '敬请期待（MVP 暂只支持本命盘）',
    style: t[0] === 'natal' ? undefined : {
      opacity: .5,
      cursor: 'not-allowed'
    },
    onClick: () => {
      if (t[0] === 'natal') setTab('natal');
      else toast(fmtTpl(ML_COPY.ui.toast['xishi-tab-coming-soon-birth-only'], { name: t[1] }));
    }
  }, t[1])));

  // ---- 本命盘渲染（行星/四轴行、元素/模式/逆行/格局 chips 均复用 REQ-053 L1 共享单元） ----
  const birthMeta = [birthInfo.dateTime ? '出生 ' + birthInfo.dateTime : '', birthInfo.location ? '地点 ' + birthInfo.location : ''].filter(Boolean).join(' ｜ ');
  const natalCard = el('div', {
    className: 'card',
    style: {
      textAlign: 'center'
    }
  }, el(AstroWheel, {
    data: natal
  }), birthMeta ? el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      marginTop: 8,
      lineHeight: 1.7
    }
  }, birthMeta) : null);
  // ---- REQ-045 三格卡片：太阳 / 月亮 / 上升 各一格（A1 趋势文案，正文替换占位） ----
  const findPoint = (list, names) => {
    const arr = list && Array.isArray(list) ? list : [];
    const want = names.map(n => String(n).toLowerCase());
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || typeof p !== 'object') continue;
      const nm = String(p.name || '').toLowerCase();
      const lb = String(p.label || '').toLowerCase();
      if (want.indexOf(nm) !== -1 || want.indexOf(lb) !== -1) return p;
    }
    return null;
  };
  const sunPoint = findPoint(natal.planets, ['sun', '太阳']);
  const moonPoint = findPoint(natal.planets, ['moon', '月亮']);
  const ascPoint = findPoint(natal.angles, ['ascendant', 'asc', '上升']);
  const sunSign = signToCn(sunPoint && sunPoint.sign);
  const moonSign = signToCn(moonPoint && moonPoint.sign);
  const ascSign = signToCn(ascPoint && ascPoint.sign);
  const trendGender = birthInfo.gender === 'female' || birthInfo.gender === '女' ? 'female' : 'male';
  const trendCells = [
    { key: 'sun', title: '太阳', sign: sunSign },
    { key: 'moon', title: '月亮', sign: moonSign },
    { key: 'rising', title: '上升', sign: ascSign }
  ];
  // ---- 节100③：三卡牌堆式堆叠（取代 REQ-132 五槽位虚拟 track）——
  //      三张牌全部绝对定位，容器高度由顶卡实测撑开（趋势全文完整不裁切）；
  //      顶卡居左完整展示，底两张向右错开各 30px、右缘圆形位露星座 logo；
  //      左右滑 / 点按露边 / 箭头 / 圆点切换，3 张环形无限循环：
  //      前进 = 旧顶卡加 .exit 向左飞出、380ms 后绕回最底张；后退 = 底牌自右滑上。 ----
  const TRIPLE_N = trendCells.length;
  const [tripleCur, setTripleCur] = useState(0);
  const [tripleExit, setTripleExit] = useState(null);
  const [tripleH, setTripleH] = useState(null);
  const tripleStart = useRef(0);
  const tripleMoved = useRef(false);
  const tripleTimer = useRef(null);
  const tripleCurEl = useRef(null);
  useLayoutEffect(() => {
    const node = tripleCurEl.current;
    if (node) setTripleH(node.offsetHeight);
  });
  const tripleGo = dir => {
    clearTimeout(tripleTimer.current);
    if (dir > 0) {
      setTripleExit(tripleCur);
      setTripleCur((tripleCur + 1) % TRIPLE_N);
      tripleTimer.current = setTimeout(() => setTripleExit(null), 380);
    } else {
      setTripleExit(null);
      setTripleCur((tripleCur + TRIPLE_N - 1) % TRIPLE_N);
    }
  };
  const tripleDown = e => {
    tripleStart.current = e.clientX;
    tripleMoved.current = false;
  };
  const tripleEnd = e => {
    if (e && e.type === 'pointercancel') return;
    const d = e.clientX - tripleStart.current;
    if (Math.abs(d) > 48) tripleGo(d < 0 ? 1 : -1);
  };
  const tripleCard = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '太阳 / 月亮 / 上升 · 整体趋势'), el('div', {
    className: 'triple-stack',
    style: tripleH ? { height: tripleH + 'px' } : undefined,
    onPointerDown: tripleDown,
    onPointerUp: tripleEnd,
    onPointerCancel: tripleEnd,
    role: 'group',
    'aria-label': '太阳 / 月亮 / 上升 三张趋势卡，可左右环形滑动切换'
  }, trendCells.map((cell, i) => {
    const isExit = i === tripleExit;
    const depth = (i - tripleCur + TRIPLE_N) % TRIPLE_N;
    const isCur = !isExit && depth === 0;
    const isSide = !isExit && depth !== 0;
    const txt = zodiacTrendText(cell.key, cell.sign, trendGender);
    const cardStyle = isSide
      ? (depth === 1 ? { right: '30px', left: 'auto', top: '5px', zIndex: 2 } : { right: '0px', left: 'auto', top: '10px', zIndex: 1 })
      : undefined;
    return el('div', {
      key: 'ts' + i,
      ref: isCur ? tripleCurEl : undefined,
      className: 'triple-card' + (isExit ? ' exit' : isCur ? ' cur' : ' side'),
      style: cardStyle,
      onClick: isSide && !tripleMoved.current ? () => tripleGo(1) : undefined,
      'aria-label': (isCur ? '当前卡：' : isExit ? '切出：' : '牌堆下一张：') + cell.title + ' · ' + (cell.sign || '未知')
    }, el('div', {
      className: 'tc-head'
    }, el('div', {
      className: 'tc-title'
    }, cell.title), el('span', {
      className: 'tc-sign'
    }, el(CxIcon, {
      cn: cell.sign,
      size: 22
    }), cell.sign || '——')), isSide ? el('div', {
      className: 'tc-peek'
    }, el(CxIcon, {
      cn: cell.sign,
      size: 15
    })) : el('div', {
      className: 'tc-txt'
    }, txt));
  })), el('div', {
    className: 'triple-nav'
  }, el('button', {
    type: 'button',
    className: 'triple-arrow',
    'aria-label': UI_COPY.xishi['prev-btn'],
    onClick: () => tripleGo(-1)
  }, '‹'), el('div', {
    className: 'triple-dots'
  }, trendCells.map((cell, i) => el('button', {
    key: 'td' + i,
    type: 'button',
    className: 'triple-dot' + (i === tripleCur ? ' on' : ''),
    'aria-label': '第 ' + (i + 1) + ' 张：' + cell.title,
    onClick: () => {
      const diff = (i - tripleCur + TRIPLE_N) % TRIPLE_N;
      if (diff === 1) tripleGo(1);
      else if (diff === 2) tripleGo(-1);
    }
  }))), el('button', {
    type: 'button',
    className: 'triple-arrow',
    'aria-label': UI_COPY.xishi['next-btn'],
    onClick: () => tripleGo(1)
  }, '›')));
  const planetCard = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '行星落座落宫'), natal.planets.length ? natal.planets.map(astroPointRow) : el('div', {
    className: 'error'
  }, '暂无行星数据'), el('div', {
    className: 'section-title',
    style: {
      marginTop: 12
    }
  }, '四轴（上升 / 天顶 / 下降 / 天底）'), natal.angles.length ? natal.angles.map(astroPointRow) : el('div', {
    className: 'error'
  }, '暂无四轴数据'));

  const sumCard = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '元素 / 模式 / 格局'), el(AstroSummaryChips, {
    s: natal.summary,
    detail: true
  }));
  const interpCard = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '本命深度解读'), interpErr ? el('div', {
    className: 'error',
    style: {
      marginTop: 10
    }
  }, interpErr) : null, el('div', {
    className: 'pay-hint'
  }, '本命深度解读为付费 LLM，按实际用量扣余额（¥）（点击前将预检余额；缓存命中零扣费）'), el('button', {
    className: 'btn btn-outline',
    style: {
      marginTop: 8
    },
    disabled: interpLoading || !data || !data.id,
    onClick: interpret
  }, interpLoading ? '解读生成中…' : ['[可选] 本命深度解读（付费）', payBadge(payEnough)]), interp ? el(React.Fragment, null, el('div', {
    className: 'interp-title'
  }, '解读结果'), el('div', {
    className: 'interp-body'
  }, interp)) : null);

  // ---- REQ-057 / REQ-083：星座关系匹配（恋爱 / 朋友 / 上下级）入口与数据源 ----
  // 太阳星座优先取「当前已生成/查看的本命盘」（与盘面三格同源）；本会话未生成但该档案历史已排过盘
  // （detailMap.hasNatal + sunCn，与档案卡 meta「太阳X」同口径）也可直接判定，无需重复排盘；
  // 两者皆无 → 弹窗内给「请先生成星盘 / 请先选择档案」引导。
  // REQ-082③ / REQ-083：入口位置移到「太阳/月亮/上升 · 整体趋势」卡与「本命深度解读」卡之间
  // （仅盘面数据就绪时随盘展示）；未选择档案时不渲染。同排三个按键（REQ-102：圆角矩形 + 标题前图标
  // rel-love / rel-friend / rel-boss，与生肖 REQ-095 三键同样式统一）：恋爱 / 朋友 / 上下级。
  const relSelCase = caseId == null ? null : (caseList.find(c => Number(c.caseId) === Number(caseId)) || null);
  const relCaseName = relSelCase ? ((relSelCase.name && String(relSelCase.name).trim()) || '档案 ' + relSelCase.caseId) : '';
  const relDet = detailMap[caseId == null ? '' : String(caseId)];
  const relSunCn = data && natalRaw && dataCaseId.current != null && caseId != null && Number(dataCaseId.current) === Number(caseId) && sunSign
    ? sunSign
    : (relDet && relDet.hasNatal && relDet.sunCn ? relDet.sunCn : '');
  const relEntry = el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, UI_COPY.sunRel.cardTitle), el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.7,
      marginBottom: 4
    }
  }, UI_COPY.sunRel.entryNote), el('div', {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, [['love', UI_COPY.sunRel.btnLove], ['friend', UI_COPY.sunRel.btnFriend], ['boss', UI_COPY.sunRel.btnBoss]].map(function (it) {
    return el('button', {
      key: it[0],
      type: 'button',
      className: 'btn btn-outline',
      style: {
        width: 'auto',
        flex: 'none',
        padding: '9px 14px',
        fontSize: 14,
        borderRadius: 'var(--radius-md)'
      },
      onClick: function () {
        track('zodiac_match', {});
        setRelOpen(it[0]);
      }
    }, el(RelIcon, {
      kind: it[0],
      size: 28
    }), it[1]);
  })));

  // ---- 三态 body ----
  let body = null;
  if (loading) {
    body = el('div', {
      className: 'sk-card'
    }, el('div', {
      className: 'sk-title'
    }), el('div', {
      className: 'skeleton sk-line'
    }), el('div', {
      className: 'skeleton sk-line',
      style: {
        width: '70%'
      }
    }), el('div', {
      className: 'skeleton sk-line',
      style: {
        width: '55%'
      }
    }), el('div', {
      className: 'skeleton sk-line'
    }));
  } else if (errored) {
    body = el('div', {
      className: 'card failed-box'
    }, el('div', {
      className: 'section-title'
    }, '星盘生成失败'), el('div', {
      className: 'error'
    }, errored), el('button', {
      className: 'btn btn-primary',
      onClick: () => load('natal')
    }, UI_COPY.buttons.retry));
  } else if (data && !natalRaw) {
    body = el('div', {
      className: 'card failed-box'
    }, el('div', {
      className: 'section-title'
    }, '星盘数据异常'), el('div', {
      className: 'error'
    }, '服务未返回本命盘数据，请稍后重试。'), el('button', {
      className: 'btn btn-primary',
      onClick: () => load('natal')
    }, '重新生成'));
  } else if (data && natalRaw) {
    body = el(React.Fragment, null, natalCard, tripleCard, caseId == null ? null : relEntry, interpCard, planetCard, sumCard);
  } else {
    body = el('div', {
      className: 'card',
      style: {
        textAlign: 'center',
        color: 'var(--text-3)',
        padding: '22px 16px'
      }
    }, '在上方选择一份档案，点击「生成星盘」或「查看星盘」（该档案已生成过的星盘会直接展示、不重复计费；生辰自动取自档案），即可免费查看行星落座、四轴、相位与元素格局。');
  }

  // REQ-108：星座（西式）配对解析入口 —— 横跨屏幕大按键（功能标题 + 解释文字，整键可点），
  // 位置在「生成星盘」（formCard）下方、本命盘（tabsNode + body）上方；原页面顶部
  // .pair-entry 条移除（覆盖 REQ-082②「西式配对解析保持现状」口径）。
  const pairBig = el('button', {
    type: 'button',
    className: 'pair-big',
    onClick: () => openPairAnalyze({
      module: 'xishi'
    })
  }, el('span', {
    className: 'pb-title'
  }, el(Icon, {
    name: 'orbit',
    size: 20,
    color: 'var(--skin-accent)'
  }), '配对解析', payBadge(payEnough)), el('span', {
    className: 'pb-sub'
  }, '选择两份档案，基于双方星座本命星盘解读两人的关系契合、相处模式与建议（付费 LLM，按实际用量扣余额 ¥）'));

  return el(React.Fragment, null, el('div', {
    className: 'container'
  }, el('div', {
    className: 'hub-title'
  }, el(Icon, {
    name: 'orbit',
    size: 22
  }), ' 星座'), formCard, pairBig, tabsNode, body, el('div', {
    // REQ-117：星座页底部操作按键由靠左对齐改为均匀分布 —— 等宽均分占满一行（back-row fill）
    className: 'back-row fill'
  }, data ? el('button', {
    className: 'btn btn-outline',
    style: {
      width: 'auto'
    },
    onClick: () => load('natal')
  }, '重新生成') : null, el('button', {
    className: 'btn btn-outline',
    style: {
      width: 'auto'
    },
    onClick: () => onNavigate('xishi-hub')
  }, UI_COPY.buttons.back_options), el('button', {
    className: 'btn btn-outline',
    style: {
      width: 'auto'
    },
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home))), relOpen === 'love' ? el(SunLoveModal, {
    sunCn: relSunCn,
    caseName: relCaseName,
    onClose: () => setRelOpen(null),
    onGoChart: () => {
      setRelOpen(null);
      load('natal');
    }
  }) : (relOpen === 'friend' || relOpen === 'boss') ? el(SunRelationModal, {
    kind: relOpen,
    sunCn: relSunCn,
    caseName: relCaseName,
    onClose: () => setRelOpen(null),
    onGoChart: () => {
      setRelOpen(null);
      load('natal');
    }
  }) : null);
}
