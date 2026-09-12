// 生肖流年域视图（节110 阶段3）：生肖 ZodiacPage + 生肖 medallion/关系图标 + 生肖三关系/名词解释弹窗
// （PairRelIcon/PAIR_REL_ICONS 亦被配对解析 PairModal 复用，故保持全局可见）
// 加载于 views-mbti.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- 生肖流年（确定性，零 LLM） ---------- */
// 十二生肖名 · 来自 CONTENT 基础名词表（节135；顺序对齐地支与 ZE_IDS 图标）
const ZODIAC = CONTENT.basics.zodiacAnimals;
// REQ-041：生肖 medallion 走 art/zodiac/zodiac-icons.svg 的 symbol（顺序对齐 ZODIAC 12 生肖）
const ZE_IDS = ['zx-rat', 'zx-ox', 'zx-tiger', 'zx-rabbit', 'zx-dragon', 'zx-snake', 'zx-horse', 'zx-goat', 'zx-monkey', 'zx-rooster', 'zx-dog', 'zx-pig'];
const ZODIAC_SPRITE = './art/zodiac/zodiac-icons.svg';
function ZodiacMedallion({
  index,
  size = 32,
  className
}) {
  const id = ZE_IDS[index];
  if (!id) return null;
  return /*#__PURE__*/React.createElement("svg", {
    className: 'zodiac-medallion' + (className ? ' ' + className : ''),
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    role: "img",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("use", {
    href: ZODIAC_SPRITE + '#' + id
  }));
}
/* REQ-102：三关系按键图标 —— 引用 art/icons/icon-sprite-i1-i4.svg（I1–I4 正式美术 23 枚 symbol）的
   symbol：恋爱=rel-love、朋友=rel-friend、上下级=rel-boss。与 ZODIAC_SPRITE 同机制（<use href> 外部引用），
   尺寸 28–36px，此处取 28px；只做引用、不改动 SVG 内容。kind: 'love' | 'friend' | 'boss' */
const REL_SPRITE = '/art/icons/icon-sprite-i1-i4.svg';
function RelIcon({
  kind,
  size = 28
}) {
  const id = kind === 'friend' ? 'rel-friend' : kind === 'boss' ? 'rel-boss' : 'rel-love';
  return React.createElement('svg', {
    className: 'ic',
    style: {
      width: size,
      height: size,
      flex: 'none'
    },
    viewBox: '0 0 100 100',
    role: 'img',
    'aria-hidden': 'true'
  }, React.createElement('use', {
    href: REL_SPRITE + '#' + id
  }));
}
/* REQ-115 / REQ-100：I1 星座 ×12（cx-*）+ I4 三功能 ×3（fn-*）图标 —— 复用 REL_SPRITE
   （art/icons/icon-sprite-i1-i4.svg）的 symbol，与 RelIcon 同机制（<use href> 外部引用），
   只做引用、不改动 SVG 内容。SpriteIcon 按 symbol id 通用引用；CxIcon 按中文星座名映射 cx-*。 */
const SIGN_CX_IDS = {
  '白羊': 'cx-aries', '金牛': 'cx-taurus', '双子': 'cx-gemini', '巨蟹': 'cx-cancer',
  '狮子': 'cx-leo', '处女': 'cx-virgo', '天秤': 'cx-libra', '天蝎': 'cx-scorpio',
  '射手': 'cx-sagittarius', '摩羯': 'cx-capricorn', '水瓶': 'cx-aquarius', '双鱼': 'cx-pisces'
};
function SpriteIcon({
  id,
  size = 24
}) {
  return React.createElement('svg', {
    className: 'ic',
    style: {
      width: size,
      height: size,
      flex: 'none'
    },
    viewBox: '0 0 100 100',
    role: 'img',
    'aria-hidden': 'true'
  }, React.createElement('use', {
    href: REL_SPRITE + '#' + id
  }));
}
function CxIcon({
  cn,
  size = 22
}) {
  const id = SIGN_CX_IDS[cn];
  return id ? React.createElement(SpriteIcon, {
    id: id,
    size: size
  }) : null;
}
/* REQ-110：配对解析「关系类型」按钮图标 —— 复用 REL_SPRITE（icon-sprite-i1-i4.svg，I3 正式美术）的
   pair-* 五枚 symbol：pair-love 恋爱 / pair-friend 朋友 / pair-family 家人 / pair-colleague 同事 /
   pair-other 其他。与 RelIcon 同机制（<use href> 外部引用，只做引用、不改动 SVG 内容）。 */
const PAIR_REL_ICONS = {
  [UI_COPY.zodiac.love]: 'pair-love',
  [UI_COPY.zodiac.friend]: 'pair-friend',
  '家人': 'pair-family',
  '同事': 'pair-colleague',
  '其他': 'pair-other'
};
function PairRelIcon({
  name,
  size = 22
}) {
  return React.createElement('svg', {
    className: 'ic',
    style: {
      width: size,
      height: size,
      flex: 'none'
    },
    viewBox: '0 0 100 100',
    role: 'img',
    'aria-hidden': 'true'
  }, React.createElement('use', {
    href: REL_SPRITE + '#' + name
  }));
}
/* ================= REQ-095：生肖流年「恋爱 / 朋友 / 上下级」三关系匹配 =================
   与星座 REQ-083 同机制：以「当前档案生肖（出生属相，对应地支）× 其余 11 生肖」给固定匹配分值
   + 静态说明（12×11）。分值用地支关系基础规则：六合=5、三合=4.5、相冲=2.0、相害=2.5、三刑=2.0、
   其余=3.0（换算成百分/星级展示参考星座宫格样式）。
   文案（T4 生肖 132×3 对「分值 + 说明」）从 window.TC_PAIRS 查表（frontend/public/data/pairs.js，
   文案轮次交付物，更新时只替换该文件；键 = 生肖单字名 self/other，如 鼠_牛）。分值沿用下方确定性
   地支规则换算（与 T4 JSON 分值逐一一致，已验证），故展示逻辑不需改动；查表失败时优雅降级为兜底说明
   （不报错）。本模块展示纯前端固定数据（免费、零请求、非双人生辰合盘）。 */
/* 地支基础关系集（index 与 ZODIAC 12 生肖对齐：0=鼠(子) … 11=猪(亥)） */
// 十二地支 · 来自 CONTENT 基础名词表（节135；index 与 ZODIAC 12 生肖对齐：0=鼠(子) … 11=猪(亥)）
const ZD_BRANCH = CONTENT.basics.dizhi;
const LIUHE_PAIRS = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 六合：子丑 寅亥 卯戌 辰酉 巳申 午未
const SANHE_GROUPS = [[0, 4, 8], [2, 6, 10], [3, 7, 11], [5, 9, 1]]; // 三合：申子辰 亥卯未 寅午戌 巳酉丑
const CHONG_PAIRS = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]; // 相冲：子午 丑未 寅申 卯酉 辰戌 巳亥
const HAI_PAIRS = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]; // 相害：子未 丑午 寅巳 卯辰 申亥 酉戌
const XING_PAIRS = [[0, 3], [2, 5], [2, 8], [5, 8], [1, 10], [7, 10], [1, 7]]; // 相刑：子卯 / 寅巳申 / 丑戌未（去重）
/* 三合按组展开为无序对（升序），供统一判定 */
const SANHE_PAIRS = [];
for (let gi = 0; gi < SANHE_GROUPS.length; gi++) {
  const g = SANHE_GROUPS[gi];
  for (let ai = 0; ai < g.length; ai++) {
    for (let bi = ai + 1; bi < g.length; bi++) {
      SANHE_PAIRS.push([Math.min(g[ai], g[bi]), Math.max(g[ai], g[bi])]);
    }
  }
}
function zdPairHit(pairs, a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (p[0] === lo && p[1] === hi) return true;
  }
  return false;
}
/* 分值判定（确定性）：六合 → 三合 → 相冲 → 相害 → 三刑 → 其余；重复命中按更高分值关系计
   （如 巳申=六合+三刑 → 六合；寅巳=相害+三刑 → 相害；寅申/丑未=相冲+三刑 → 相冲，同分无歧义） */
function zodiacRelScore(a, b) {
  if (a === b) return 0;
  if (zdPairHit(LIUHE_PAIRS, a, b)) return 5;
  if (zdPairHit(SANHE_PAIRS, a, b)) return 4.5;
  if (zdPairHit(CHONG_PAIRS, a, b)) return 2;
  if (zdPairHit(HAI_PAIRS, a, b)) return 2.5;
  if (zdPairHit(XING_PAIRS, a, b)) return 2;
  return 3;
}
function zodiacRelCode(a, b) {
  if (a === b) return '';
  const s = zodiacRelScore(a, b);
  if (s === 5) return '六合';
  if (s === 4.5) return '三合';
  if (s === 2.5) return '相害';
  if (s === 2) return zdPairHit(CHONG_PAIRS, a, b) ? '相冲' : '相刑';
  return '中性';
}
/* 说明正文：从 window.TC_PAIRS 查表（self=当前生肖单字名、other=对方；kind 映射 shengxiao_love /
   shengxiao_friend / shengxiao_boss）。查表失败 → 兜底说明（优雅降级，不报错） */
const REL_TEXT_FALLBACK = '该组合的详细说明暂未收录，以上分值仅供趋势参考。';
function zodiacRelText(kind, mine, other) {
  const key = kind === 'friend' ? 'shengxiao_friend' : kind === 'boss' ? 'shengxiao_boss' : 'shengxiao_love';
  const mod = window.TC_PAIRS && window.TC_PAIRS[key];
  const pairs = mod && Array.isArray(mod.pairs) ? mod.pairs : null;
  if (pairs) {
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      if (p && String(p.self) === String(mine) && String(p.other) === String(other)) {
        return p.text && String(p.text).trim() ? p.text : REL_TEXT_FALLBACK;
      }
    }
  }
  return REL_TEXT_FALLBACK;
}
/* 生成「当前生肖 index × 其余 11 生肖」匹配列表（分值/关系/百分 + 静态文案），分值降序、同分按生肖序 */
function zodiacRelPairs(mineIdx, kind) {
  const me = mineIdx != null && ZODIAC[mineIdx] ? ZODIAC[mineIdx] : '';
  if (!me) return [];
  const out = [];
  for (let i = 0; i < ZODIAC.length; i++) {
    if (i === mineIdx) continue;
    const sc = zodiacRelScore(mineIdx, i);
    out.push({
      sign: ZODIAC[i],
      idx: i,
      score: sc,
      code: zodiacRelCode(mineIdx, i),
      pct: Math.round(sc / 5 * 100),
      txt: zodiacRelText(kind, me, ZODIAC[i])
    });
  }
  out.sort(function (x, y) {
    return y.score - x.score || x.idx - y.idx;
  });
  return out;
}
/* REQ-095：生肖三关系弹窗（PairModal / 星座 SunRelationModal 同款容器与宫格样式；生肖由出生年份
   推算、固定不变，故必有数据，无「先生成星盘」引导态）。kind: 'love' | 'friend' | 'boss'。 */
function ZodiacRelModal({
  kind,
  mineIdx,
  caseName,
  onClose
}) {
  const el = React.createElement;
  const k = kind === 'friend' || kind === 'boss' ? kind : 'love';
  const meta = UI_COPY.zodiacRel;
  const relCn = meta.relName && meta.relName[k] ? meta.relName[k] : '';
  const mTitle = meta.modalTitle && meta.modalTitle[k] ? meta.modalTitle[k] : '关系匹配 · 生肖';
  const me = mineIdx != null && ZODIAC[mineIdx] ? ZODIAC[mineIdx] : '';
  const hasMe = !!me;
  const list = hasMe ? zodiacRelPairs(mineIdx, k) : [];
  const starN = sc => sc >= 5 ? 5 : sc >= 4.5 ? 4 : sc >= 3 ? 3 : 2;
  const FULL = '★★★★★';
  const EMPTY = '☆☆☆☆☆';
  const tagCls = code => code === '六合' || code === '三合' ? 'var(--skin-accent)' : code === '中性' ? 'var(--text-3)' : 'var(--cinnabar)';
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
    }, p.sign + '（' + ZD_BRANCH[p.idx] + '）'), el('span', {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: 'var(--skin-accent)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
      }
    }, p.pct + '%')), el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap'
      }
    }, el('span', {
      style: {
        color: tagCls(p.code),
        background: 'transparent',
        padding: 0
      }
    }, p.code), el('span', {
      style: {
        color: 'var(--text-3)',
        fontWeight: 400
      }
    }, '分 ' + p.score)), el('div', {
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
    name: 'spark',
    size: 20,
    color: 'var(--skin-accent)'
  }), mTitle), el('button', {
    type: 'button',
    className: 'pair-x',
    onClick: onClose,
    title: UI_COPY.buttons.close
  }, '✕'));
  const sub = el('div', {
    className: 'pair-sub'
  }, hasMe ? fmtTpl(meta.modalSub, {
    case: caseName ? caseName : '当前档案',
    me: me,
    rel: relCn
  }) : '生肖未知：请先在生肖流年页选择一份档案。');
  let inner = null;
  if (hasMe) {
    inner = el('div', null, el('div', {
      className: 'pair-sec-label',
      style: {
        marginTop: 4
      }
    }, el('span', {
      className: 'ps-n'
    }, '我'), '生肖 · ', me, '（', ZD_BRANCH[mineIdx], '）对 其余 11 生肖匹配度，按地支基础分值从高到低'), el('div', {
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
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-2)',
        lineHeight: 1.8
      }
    }, '未取得当前档案生肖，无法生成匹配表。');
  }
  const disclaimer = el('div', {
    className: 'pair-pay'
  }, meta.modalFoot);
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 有自定义标题栏（pair-hd）和底部（pair-foot），通过 children 自定义
  return el(ModalBase, {
    onClose: onClose,
    className: 'pair-modal',
    width: 620,
    align: 'left',
    scrollable: true,
    bodyClassName: 'pair-body',
    footer: hasMe ? el('div', { className: 'pair-foot' },
      el('button', { type: 'button', className: 'btn btn-outline', onClick: onClose }, UI_COPY.buttons.close)
    ) : null
  }, hd, sub, inner, disclaimer);
}
/* REQ-103：生肖流年「风险关系 / 五行关系」名词解释弹窗 —— 结果页下方原直接展示的解释文案改为
   超链接「查看解析」+ 弹出窗口；正文复用 UI_COPY.zodiacGuide 既有解释内容（不新增文案）。
   kind: 'element'（五行关系）| 'risk'（风险关系），对应 zodiacGuide.elementRelation / riskRelation。 */
function ZodiacGuideModal({
  kind,
  onClose
}) {
  const el = React.createElement;
  const k = kind === 'risk' ? 'risk' : 'element';
  const title = k === 'risk' ? '风险关系 · 名词解释' : '五行关系 · 名词解释';
  const body = k === 'risk' ? UI_COPY.zodiacGuide.riskRelation : UI_COPY.zodiacGuide.elementRelation;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 自定义标题栏
  const hd = el('div', { className: 'pair-hd' },
    el('div', { className: 'pair-hd-title' },
      el(Icon, { name: 'spark', size: 18, color: 'var(--skin-accent)' }), title
    ),
    el('button', { type: 'button', className: 'pair-x', onClick: onClose, title: UI_COPY.buttons.close }, '✕')
  );
  const content = el('div', {
    style: {
      fontSize: 13,
      color: 'var(--text-2)',
      lineHeight: 1.9,
      textAlign: 'left',
      wordBreak: 'break-word',
      maxHeight: '60vh',
      overflowY: 'auto',
      padding: '2px 2px 4px'
    }
  }, body);
  return el(ModalBase, {
    onClose: onClose,
    className: 'pair-modal',
    width: 560,
    footer: el('div', { className: 'pair-foot' },
      el('button', { type: 'button', className: 'btn btn-outline', onClick: onClose }, UI_COPY.buttons.close)
    )
  }, hd, content);
}
function ZodiacPage({
  onNavigate
}) {
  // 生肖流年档案驱动：选择档案 → 出生年份自动推算生肖（生肖固定不变，仅流年年份可切换）。
  // 流年年份默认当前年；出结果后点结果标题两侧「← / →」箭头切换（范围 当前年±10），切换后自动重新推演。
  const curYear = new Date().getFullYear();
  const MIN_YEAR = curYear - 10;
  const MAX_YEAR = curYear + 10;
  const [year, setYear] = useState(curYear);
  const [z, setZ] = useState(-1); // 推算出的生肖 index（-1 = 尚未选档案）
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [caseList, setCaseList] = useState(null); // null=读取中；[]=无档案/未登录
  const [selId, setSelId] = useState(''); // 当前选中档案 caseId
  const runRef = useRef(0); // 选中档案次数（同生肖档案重复选择也强制重跑）
  const [runId, setRunId] = useState(0);
  // REQ-095：生肖三关系弹窗（null | 'love' | 'friend' | 'boss'；值年星君上方三键 → ZodiacRelModal）
  const [relKind, setRelKind] = useState(null);
  // REQ-103：五行关系 / 风险关系 名词解释弹窗（null | 'element' | 'risk'；「查看解析」链接 → ZodiacGuideModal）
  const [guideOpen, setGuideOpen] = useState(null);
  // 切换流年年份：生肖 z 不变，仅改 year；已选档案（z ≥ 0）时递增 runId → 下方 effect 依新 year 自动重跑
  const shiftYear = d => {
    const n = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year + d));
    if (n === year) return;
    if (z >= 0) {
      setLoading(true); // 立即进入「推演中」，避免残留上一年结果闪现
      runRef.current += 1; // 新 runId：丢弃上一年的在途响应
      setRunId(runRef.current);
    }
    setYear(n);
  };
  const load = async () => {
    const myRun = runRef.current;
    setLoading(true);
    setErrored('');
    try {
      const res = await api('/zodiac/fortune', {
        method: 'POST',
        body: JSON.stringify({
          zodiac: ZODIAC[z],
          year
        })
      });
      if (runRef.current !== myRun) return;
      setData(res && res.data || res);
    } catch (e) {
      if (runRef.current !== myRun) return;
      setErrored(e.message || '生肖流年加载失败，请重试。');
    } finally {
      if (runRef.current === myRun) setLoading(false);
    }
  };
  // 自动出结果：选档案（z 生效 + runId 递增）或 流年年份变化（点结果标题 ←/→ 箭头）→ 触发一次 load
  useEffect(() => {
    if (z >= 0 && runId > 0) load();
  }, [z, runId, year]);
  // 拉当前用户档案列表（列表项含 birthYear，用于出生年 → 生肖）
  useEffect(() => {
    let alive = true;
    if (!token) {
      setCaseList([]);
      return;
    }
    (async () => {
      try {
        const res = await api('/cases', {
          method: 'GET'
        });
        const list = (res && res.data && Array.isArray(res.data.cases)) ? res.data.cases : (res && Array.isArray(res.cases)) ? res.cases : [];
        if (alive) setCaseList(list);
      } catch (e) {
        if (alive) setCaseList([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // 选中档案 → 出生年份换算生肖（(year−4)%12 → ZODIAC index）；列表无 birthYear 时回查 /cases/{id}/archive
  const pickCase = async id => {
    if (!id) {
      setSelId('');
      setZ(-1);
      setData(null);
      setErrored('');
      return;
    }
    const c = (caseList || []).find(x => String(x.caseId) === String(id));
    if (!c) return;
    let by = c && c.birthYear != null && c.birthYear !== '' ? Number(c.birthYear) : NaN;
    if (!Number.isFinite(by) || by < 1900 || by > 2200) {
      try {
        const ar = await api('/cases/' + id + '/archive');
        const payload = ar && ar.data || ar || {};
        const inp = payload.input || payload.input_json || {};
        const fb = Number(inp.birth_year);
        if (Number.isFinite(fb)) by = fb;
      } catch (e) {/* 回查失败按无出生年处理 */}
    }
    if (!Number.isFinite(by) || by < 1900 || by > 2200) {
      toast(TC_COPY.ui.toast['zodiac-birth-year-missing']);
      return;
    }
    const idx = ((by - 4) % 12 + 12) % 12;
    runRef.current += 1;
    setSelId(String(id));
    setData(null);
    setErrored('');
    setLoading(true);
    setZ(idx);
    setRunId(runRef.current);
  };
  const CONFLICT_CLS = {
    '值太岁': 'c-zhi',
    '冲太岁': 'c-chong',
    '刑太岁': 'c-xing',
    '害太岁': 'c-hai',
    '破太岁': 'c-po'
  };
  const conflictCls = t => CONFLICT_CLS[t] || 'c-po';
  const relCls = c => ({
    '有利关系': 'rel-good',
    '风险关系': 'rel-risk',
    '中性关系': 'rel-neutral'
  })[c] || 'rel-neutral';
  const conflicts = data && data.conflicts && data.conflicts.length ? data.conflicts : [{
    type: '平顺无冲'
  }];
  const starName = data && data.yearGanZhi && data.taiSui && data.taiSui.star ? data.yearGanZhi + ' · ' + data.taiSui.star + '星君' : '';
  // BUG-003：五行关系中段字段（elementRelation / relation / zodiacWuxing 全量容错，空值兜底 '—'）
  const er = data && data.elementRelation && typeof data.elementRelation === 'object' ? data.elementRelation : null;
  const erCls = er && typeof er.classification === 'string' && er.classification ? er.classification : '';
  const erKind = er && typeof er.kind === 'string' && er.kind ? er.kind : '';
  const erLabel = er && typeof er.label === 'string' && er.label ? er.label : '';
  const erYearWx = er && typeof er.yearStemWuxing === 'string' && er.yearStemWuxing ? er.yearStemWuxing : '';
  const erZodiacWx = er && typeof er.zodiacWuxing === 'string' && er.zodiacWuxing ? er.zodiacWuxing : '';
  const relRaw = data && typeof data.relation === 'string' && data.relation ? data.relation : erLabel;
  // 生克详情带双方五行注释：生肖地支本气（X）生/克 年干五行（Y）
  const relTxt = relRaw ? relRaw
    .replace('生肖地支本气', erZodiacWx ? '生肖地支本气（' + erZodiacWx + '）' : '生肖地支本气')
    .replace('年干五行', erYearWx ? '年干五行（' + erYearWx + '）' : '年干五行') : '';
  // 本气五行文案：优先后端 B2 顶层 zodiacWuxing（如「水（子）」）；缺失回退机读五行+地支
  const zxTxt = data && typeof data.zodiacWuxing === 'string' && data.zodiacWuxing.trim() ? data.zodiacWuxing : (erZodiacWx ? erZodiacWx + (data && data.zodiacBranch ? '（' + data.zodiacBranch + '）' : '') : '');
  // 流年年干五行：如「丙（火）」（丙午年）
  const yswxTxt = erYearWx ? ((data && data.yearGanZhi && String(data.yearGanZhi).charAt(0)) ? String(data.yearGanZhi).charAt(0) + '（' + erYearWx + '）' : erYearWx) : '';
  const gzTxt = data && typeof data.yearGanZhi === 'string' ? data.yearGanZhi : '';
  const elemCls = relCls(erCls);
  // BUG-003：风险/有利关系仅在后端返回非空数组时展示
  const hasRisk = !!(data && Array.isArray(data.riskRelations) && data.riskRelations.length);
  const hasFav = !!(data && Array.isArray(data.favorableRelations) && data.favorableRelations.length);
  // C1：五行关系一句话解读（有则展示，无则兜底 '—'）
  const relCopyTxt = data && typeof data.relationCopy === 'string' && data.relationCopy.trim() ? data.relationCopy : '—';
  // C2：贵人静态解读行（nobleDetail 为对象且有内容才渲染；子字段缺失/空串兜底 '—'）
  const nobleLines = [];
  {
    const nd = data && data.nobleDetail && typeof data.nobleDetail === 'object' ? data.nobleDetail : null;
    const pushLine = (label, v, who, exp) => {
      if (v) nobleLines.push(label + '（' + (who || '—') + '）' + (exp ? '：' + exp : ''));
    };
    if (nd) {
      pushLine('六合贵人', nd['六合'], (nd['六合'] && nd['六合'].partner) || '', (nd['六合'] && nd['六合'].explain) || '');
      pushLine('三合贵人', nd['三合'], (nd['三合'] && nd['三合'].partners) || '', (nd['三合'] && nd['三合'].explain) || '');
      if (nd['天乙贵人']) nobleLines.push('天乙贵人（' + ((nd['天乙贵人'].partners) || '—') + '）' + ((nd['天乙贵人'].note) ? '：' + nd['天乙贵人'].note : ''));
    }
  }
  const selCase = (caseList || []).find(x => String(x.caseId) === String(selId)) || null;
  const zName = z >= 0 && ZODIAC[z] ? ZODIAC[z] : '';
  const erLine = (k, v) => React.createElement("div", {
    className: "zrel"
  }, React.createElement("span", {
    className: "zl"
  }, k), React.createElement("span", {
    className: "zv"
  }, v));
  // REQ-095：值年星君色块上方「恋爱 / 朋友 / 上下级」三关系入口（REQ-102：圆角矩形按键 + 标题前图标
  // rel-love / rel-friend / rel-boss，与星座 REQ-083 三键同样式统一；仅已选档案并出结果后渲染 —— 未选择档案时不显示）
  const relEntry = z >= 0 && data ? React.createElement("div", {
    className: "card",
    style: {
      padding: '14px 16px'
    }
  }, React.createElement("div", {
    className: "section-title",
    style: {
      marginBottom: 4
    }
  }, UI_COPY.zodiacRel.cardTitle), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.7,
      marginBottom: 8
    }
  }, UI_COPY.zodiacRel.entryNote), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, [['love', UI_COPY.zodiacRel.btnLove], ['friend', UI_COPY.zodiacRel.btnFriend], ['boss', UI_COPY.zodiacRel.btnBoss]].map(function (it) {
    return React.createElement("button", {
      key: it[0],
      type: "button",
      className: 'btn btn-outline',
      style: {
        width: 'auto',
        flex: 'none',
        padding: '9px 14px',
        fontSize: 14,
        borderRadius: 'var(--radius-md)'
      },
      onClick: function () {
        setRelKind(it[0]);
      }
    }, React.createElement(RelIcon, {
      kind: it[0],
      size: 28
    }), it[1]);
  }))) : null;
  // —— 档案选择区（REQ-052）：未登录/无档案 → 引导按钮；有档案 → 下拉，选中即自动推演 ——
  let picker = null;
  if (!token) {
    picker = React.createElement(React.Fragment, null, React.createElement("p", {
      className: "zodiac-pick-hint"
    }, "生肖流年需登录后按档案出生年份自动推算，请先登录。"), React.createElement("div", {
      className: "zodiac-pick-actions"
    }, React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => onNavigate('auth')
    }, "去登录")));
  } else if (caseList === null) {
    picker = React.createElement("p", {
      className: "zodiac-pick-hint"
    }, "正在读取档案…");
  } else if (!caseList.length) {
    picker = React.createElement(React.Fragment, null, React.createElement("p", {
      className: "zodiac-pick-hint"
    }, "还没有可用档案。建档后将按出生年份自动推算对应生肖与流年运程。"), React.createElement("div", {
      className: "zodiac-pick-actions"
    }, React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => onNavigate('onboarding')
    }, "去建档"), React.createElement("button", {
      className: "btn btn-outline",
      onClick: () => onNavigate('cases')
    }, "去档案管理")));
  } else {
    picker = React.createElement(React.Fragment, null, React.createElement("select", {
      className: "input",
      value: selId,
      onChange: e => pickCase(e.target.value),
      style: {
        marginBottom: 0
      }
    }, React.createElement("option", {
      value: ""
    }, "请选择档案"), caseList.map(c => React.createElement("option", {
      key: String(c.caseId),
      value: String(c.caseId)
    }, (c.name || '未命名档案') + (c.birthYear ? '（' + c.birthYear + ' 年生）' : '')))), selCase ? React.createElement("p", {
      className: "zodiac-pick-hint"
    }, "档案「", selCase.name || '未命名档案', "」", selCase.birthYear ? ' · ' + selCase.birthYear + ' 年生' : '', " → 生肖 ", zName || '—', "；当前查看流年 ", year, " 年（生肖由出生年推算、固定不变；出结果后点标题两侧箭头切换年份）") : React.createElement("p", {
      className: "zodiac-pick-hint"
    }, "选中档案后自动推演该生肖在 ", year, " 年的流年运程（生肖 = 出生年份推算；出结果后点标题两侧箭头切换 2027、2028 等其它流年年份）"));
  }
  return React.createElement("div", {
    className: "container"
  }, React.createElement("div", {
    className: "hub-title"
  }, React.createElement(Icon, {
    name: "spark",
    size: 22
  }), " 生肖流年"), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "label"
  }, "选择档案"), picker), loading ? React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      color: 'var(--text-2)',
      padding: '28px 16px'
    }
  }, "推演中…") : errored ? React.createElement("div", {
    className: "card failed-box"
  }, React.createElement("div", {
    className: "section-title"
  }, "生肖流年加载失败"), React.createElement("div", {
    className: "error"
  }, errored), React.createElement("button", {
    className: "btn btn-primary",
    onClick: load
  }, "重试")) : data ? React.createElement(React.Fragment, null,
  /* —— 生肖 medallion + 年运程标题（保留展示；标题左右各加 ← / → 箭头切换流年年份，生肖不变） —— */
  React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center'
    }
  }, React.createElement(ZodiacMedallion, {
    index: z,
    size: 40
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12
    }
  }, React.createElement("button", {
    type: "button",
    className: "zodiac-year-arrow",
    "aria-label": "上一年",
    disabled: year <= MIN_YEAR,
    onClick: () => shiftYear(-1)
  }, "←"), React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, data.zodiac, " · ", year, " 年运程"), React.createElement("button", {
    type: "button",
    className: "zodiac-year-arrow",
    "aria-label": "下一年",
    disabled: year >= MAX_YEAR,
    onClick: () => shiftYear(1)
  }, "→")), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, conflicts.map((c, i) => React.createElement("span", {
    key: i,
    className: 'conflict-tag ' + conflictCls(c.type)
  }, c.type)))), relEntry, starName ? React.createElement("div", {
    className: "card taisui-card"
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--cinnabar)'
    }
  }, "值年星君"), React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700
    }
  }, starName)) : null,
  /* —— 贵人色块（内容保留；C2 nobleDetail 有内容才追加解读，子字段缺失兜底 '—'） —— */
  React.createElement("div", {
    className: "noble-card"
  }, "贵人", React.createElement("br", null), data.noble || data.tianyiNoble || '本年无', nobleLines.length ? React.createElement("div", {
    className: "noble-sub"
  }, nobleLines.map((ln, i) => React.createElement("div", {
    key: i,
    style: i ? {
      marginTop: 6
    } : undefined
  }, ln))) : null),
  /* —— 五行关系：summary 色块 + 明细 合并为一张卡（色块标题区 = classification + C1 一句话；
        其下直接接明细行（流年干支/关系类型/关系判定/生克详情/生肖地支本气/流年年干五行）+ C6 通用解读） —— */
  React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: 'rel-card ' + elemCls
  }, React.createElement("div", {
    className: "wx-hd"
  }, "五行关系", React.createElement("span", {
    className: "wx-cls"
  }, erCls || '—')), React.createElement("p", {
    className: "wx-s"
  }, relCopyTxt)), React.createElement("div", {
    className: "zrel-box"
  }, erLine('流年干支', gzTxt || '—'), erLine('关系类型', erKind || '—'), erLine('关系判定', erCls || '—'), erLine('生克详情', relTxt || '—'), erLine('生肖地支本气', zxTxt || '—'), erLine('流年年干五行', yswxTxt || erYearWx || '—')), React.createElement("p", {
    className: "zrel-guide"
  }, React.createElement("a", {
    href: "javascript:void(0)",
    className: "zrel-guide-link",
    onClick: function (e) {
      e.preventDefault();
      setGuideOpen('element');
    }
  }, "查看解析：五行关系"))),
  /* BUG-003：风险关系区块（非空数组才渲染，空则跳过不占位） */
  hasRisk ? React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-title",
    style: {
      color: 'var(--cinnabar)'
    }
  }, "风险关系"), React.createElement("div", {
    className: "signal-list"
  }, data.riskRelations.map((s, i) => React.createElement("div", {
    key: i,
    className: "signal-item"
  }, "· ", React.createElement("span", null, s))), React.createElement("p", {
    className: "zrel-guide"
  }, React.createElement("a", {
    href: "javascript:void(0)",
    className: "zrel-guide-link",
    onClick: function (e) {
      e.preventDefault();
      setGuideOpen('risk');
    }
  }, "查看解析：风险关系")))) : null,
  /* BUG-003：有利关系区块（同上，空则不渲染） */
  hasFav ? React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-title",
    style: {
      color: 'var(--skin-accent)'
    }
  }, "有利关系"), React.createElement("div", {
    className: "signal-list"
  }, data.favorableRelations.map((s, i) => React.createElement("div", {
    key: i,
    className: "signal-item"
  }, "· ", React.createElement("span", null, s))))) : null,
  React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-title"
  }, "行动建议"), React.createElement("div", {
    className: "signal-list"
  }, (data.actionSignals || []).map((s, i) => React.createElement("div", {
    key: i,
    className: "signal-item"
  }, "💡 ", React.createElement("span", null, s)))))) : React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      color: 'var(--text-2)',
      padding: '28px 16px'
    }
  }, "选择档案后将自动推演（生肖 = 出生年份推算、固定不变 · 流年默认当前年份，可在上方切换 2027、2028 等）"), React.createElement("div", {
    className: "back-row"
  }, React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('guoxue-hub')
  }, "返回选项"), React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home)), relKind ? React.createElement(ZodiacRelModal, {
    kind: relKind,
    mineIdx: z,
    caseName: selCase ? (selCase.name || '档案 ' + selCase.caseId) : '',
    onClose: () => setRelKind(null)
  }) : null, guideOpen ? React.createElement(ZodiacGuideModal, {
    kind: guideOpen,
    onClose: () => setGuideOpen(null)
  }) : null);
}
