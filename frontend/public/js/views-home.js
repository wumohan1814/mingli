// 首页/导航/账户域视图（节110 阶段3）：首页 LandingPage + 积分 CreditBalance/BannerBalance/MenuBalance/CreditInsufficientModal + 配对 PairModal + 余额明细 CreditTransactionsPage + 导航 NavRail/TopbarModNav/TopbarMenu + 设置 SettingsPage
// （usePaySufficient 亦被档案/解读域 views-cases.js 复用，故保持全局可见）
// 加载于 views-onboarding.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

// ---- Pages ----
// REQ-064 v2：三大模块落地宣传页 —— 主按钮下方「档案管理」透明小按钮（仅登录显示，点击进档案管理列表）
function LandingPage({
  module,
  onNavigate,
  loggedIn
}) {
  // 各模块的「落地宣传页」配置：主标题 / 副标题 / 简介 / 主按钮 → 对应 HUB 或测试页
  const MODS = {
    guoxue: {
      icon: 'nine',
      title: TC_COPY.ui.module_hub.guoxue_title,
      subtitle: TC_COPY.ui.module_hub.guoxue_desc,
      intro: TC_COPY.ui.landing.value_1_desc,
      cta: TC_COPY.ui.module_hub.enter_guoxue,
      to: 'guoxue-hub'
    },
    xishi: {
      icon: 'orbit',
      title: TC_COPY.ui.module_hub.western_title,
      subtitle: TC_COPY.ui.module_hub.western_desc,
      intro: TC_COPY.ui.landing['xishi-intro'],
      cta: TC_COPY.ui.module_hub.enter_western,
      to: 'xishi-hub'
    },
    mbti: {
      icon: 'spark',
      title: TC_COPY.ui.module_hub.mbti_title,
      subtitle: TC_COPY.ui.module_hub.mbti_desc,
      intro: TC_COPY.ui.landing['mbti-intro'],
      cta: TC_COPY.ui.module_hub.enter_mbti,
      to: 'mbti-hub'
    }
  };
  const c = MODS[module] || MODS.guoxue;
  // BUG-001：外层加 landing-hero 类，小屏媒体查询负责右移避开左侧导航栏按钮
  return /*#__PURE__*/React.createElement("div", {
    className: "container landing-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      paddingTop: 32,
      paddingBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--skin-accent)',
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 44
  })), /*#__PURE__*/React.createElement("h1", {
    className: "title"
  }, c.title), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, c.subtitle), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-2)',
      fontSize: 13,
      lineHeight: 1.9,
      marginBottom: 26
    }
  }, c.intro), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate(c.to)
  }, c.cta), /* REQ-064：主按钮正下方「档案管理」透明小按钮（字号小于主按钮；仅登录显示；点击进档案管理列表） */
  loggedIn && /*#__PURE__*/React.createElement("button", {
    className: "landing-cases-btn",
    type: "button",
    onClick: () => onNavigate('cases')
  }, TC_COPY.ui.buttons.manage_cases)));
}

// —— 余额系统组件（沿用国学皮肤令牌，不新增配色）——

// 余额胶囊：自拉数据，loading 骨架，余额≤0 红字警示；点击进明细页
function CreditBalance({
  onClick
}) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api('/credits/balance');
        const b = res.data && res.data.balance != null ? res.data.balance : res.balance;
        if (alive) {
          setBalance(b != null ? Number(b) : null);
          setLoading(false);
        }
      } catch (e) {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (loading) return /*#__PURE__*/React.createElement("div", {
    className: "credit-pill skeleton",
    "aria-label": TC_COPY.ui.balance.loading
  });
  const neg = balance == null || Number(balance) <= 0;
  // 节146：充值入口已随付款充值链路整条拆除（不再有「充值」链接可隐藏，也无到账轮询）——
  // 此处只保留余额胶囊展示与「查看余额明细」跳转
  return /*#__PURE__*/React.createElement("span", {
    className: "credit-balance-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'credit-pill' + (neg ? ' warn' : ''),
    role: "button",
    tabIndex: 0,
    onClick: onClick,
    title: neg ? TC_COPY.ui.balance.insufficient : TC_COPY.ui.balance['view-detail']
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "spark",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    className: "pill-bal"
  }, TC_COPY.ui.balance.label, " ¥", balance == null ? '—' : (Number(balance) / CREDIT_YUAN_RATE).toFixed(2))));
}


// —— REQ-051/REQ-087：右上角菜单余额（¥）——
// 汇率：1 元 = N 存储单位，与后端 system_configs.recharge_rate 对齐（默认 10）。
// 后端当前未开放公开配置接口：先探测 /system/configs 的 recharge_rate，404/失败静默回退常量 10；
// 模块级记忆保证单次会话只探测一次。换算仅作用于前端展示，余额底层计费/扣费逻辑不变。
const CREDIT_YUAN_RATE = 10;
let yuanRatePromise = null;
function fetchCreditYuanRate() {
  if (!yuanRatePromise) {
    yuanRatePromise = (async () => {
      let rate = CREDIT_YUAN_RATE;
      try {
        const r = await api('/system/configs');
        const cfg = r && r.data && typeof r.data === 'object' ? r.data : r && typeof r === 'object' ? r : null;
        const raw = cfg && (cfg.recharge_rate != null ? cfg.recharge_rate : cfg.rate != null ? cfg.rate : null);
        const num = Number(raw);
        if (Number.isFinite(num) && num > 0) rate = num;
      } catch (e) {/* 接口未开放/无权限 → 保持默认汇率 */}
      return rate;
    })();
  }
  return yuanRatePromise;
}
// Banner 余额胶囊（REQ-087 后不再直接渲染于 Banner，保留为通用余额读数组件；点击进余额明细）
function BannerBalance({
  onClick
}) {
  const [yuan, setYuan] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      let credits = null;
      let rate = CREDIT_YUAN_RATE;
      try {
        credits = await fetchCreditBalance();
      } catch (e) {/* 单次拉取失败静默，按失败态展示 */}
      try {
        rate = await fetchCreditYuanRate();
      } catch (e) {/* 保持默认汇率 */}
      if (!alive) return;
      if (credits == null) {
        setFailed(true);
        setYuan(null);
      } else {
        const rn = Number(rate);
        setYuan(Number(credits) / (Number.isFinite(rn) && rn > 0 ? rn : CREDIT_YUAN_RATE));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const txt = failed ? '--' : yuan == null ? '…' : yuan.toFixed(2);
  const Tag = onClick ? 'button' : 'span';
  const tagProps = {
    className: 'topbar-balance' + (onClick ? '' : ' static'),
    title: fmtTpl(TC_COPY.ui.balance['title-format'], { rate: CREDIT_YUAN_RATE }) + (onClick ? TC_COPY.ui.balance['view-detail-suffix'] : '')
  };
  if (onClick) {
    tagProps.type = 'button';
    tagProps.onClick = onClick;
  }
  return React.createElement(Tag, tagProps, React.createElement("span", {
    className: "tb-k"
  }, TC_COPY.ui.balance.label), React.createElement("span", {
    className: "tb-sym"
  }, "¥"), txt);
}

// ===== REQ-086：付费操作统一「¥ 消耗」角标 =====
// payBadge(enabled)：返回角标元素（小函数，可复用于所有会扣余额的按钮）。
//   enabled=true（默认）→ 主题色角标 + title「按实际用量从余额扣除」；
//   enabled=false（余额 0 / 不足）→ 警示红（warn）+ title「余额不足」。
// 模块级共享余额查询（fetchPayBalanceYuan）：同会话内所有角标只发一次 /credits/balance，
// 失败静默按「充足」处理（真正扣费仍由后端 5002 拦截兜底，本查询仅驱动角标警示色）。
let payBalanceQuery = null;
function fetchPayBalanceYuan() {
  if (!payBalanceQuery) {
    payBalanceQuery = (async () => {
      let credits = null;
      let rate = CREDIT_YUAN_RATE;
      try {
        credits = await fetchCreditBalance();
      } catch (e) {/* 失败按充足处理 */}
      try {
        rate = await fetchCreditYuanRate();
      } catch (e) {/* 保持默认汇率 */}
      if (credits == null) return null;
      const rn = Number(rate);
      return Number(credits) / (Number.isFinite(rn) && rn > 0 ? rn : CREDIT_YUAN_RATE);
    })();
  }
  return payBalanceQuery;
}
function usePaySufficient() {
  const [enough, setEnough] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchPayBalanceYuan().then(function (y) {
      if (alive) setEnough(y == null ? true : y > 0);
    }).catch(function () {
      if (alive) setEnough(true);
    });
    return function () { alive = false; };
  }, []);
  return enough;
}
function payBadge(enabled) {
  const ok = enabled !== false;
  return React.createElement("span", {
    key: 'paybadge',
    className: 'pay-badge' + (ok ? '' : ' warn'),
    title: ok ? TC_COPY.ui.balance['pay-hint'] : TC_COPY.ui.balance['pay-insufficient'],
    "aria-label": ok ? TC_COPY.ui.balance['pay-badge-ok'] : TC_COPY.ui.balance['pay-badge-warn']
  }, TC_COPY.ui.balance['pay-badge']);
}

// REQ-087：右上角菜单面板最顶部「余额 ¥X」（仅登录、点开菜单即见；点击进余额消耗明细）。
// 复用 fetchCreditBalance()（拉余额）与 fetchCreditYuanRate()（汇率）→ ¥ = 余额 ÷ 汇率；
// 余额 ≤ 0 → 警示红（warn）。明细口径对齐 REQ-063（项目中文标签 + 消耗档案名 + 余额单位），跳转即 credits 页。
function MenuBalance({
  onClick
}) {
  const [yuan, setYuan] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      let credits = null;
      let rate = CREDIT_YUAN_RATE;
      try {
        credits = await fetchCreditBalance();
      } catch (e) {/* 单次拉取失败静默，按失败态展示 */}
      try {
        rate = await fetchCreditYuanRate();
      } catch (e) {/* 保持默认汇率 */}
      if (!alive) return;
      if (credits == null) {
        setFailed(true);
        setYuan(null);
      } else {
        const rn = Number(rate);
        setYuan(Number(credits) / (Number.isFinite(rn) && rn > 0 ? rn : CREDIT_YUAN_RATE));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const txt = failed ? '--' : yuan == null ? '…' : yuan.toFixed(2);
  const neg = yuan != null && yuan <= 0;
  return React.createElement("button", {
    type: "button",
    className: 'menu-item menu-balance' + (neg ? ' warn' : ''),
    role: "menuitem",
    title: (neg ? TC_COPY.ui.balance['insufficient-view-detail'] : TC_COPY.ui.balance['view-detail']),
    onClick: function () {
      if (onClick) onClick();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mi-dot",
    style: {
      background: 'var(--gold-500)'
    }
  }), TC_COPY.ui.balance.label, " ", /*#__PURE__*/React.createElement("span", {
    className: "mb-val"
  }, "¥", txt));
}
// 节146：原「充值按钮组件」占位注释已删除（付款充值链路整条拆除，不再恢复）。
function CreditInsufficientModal({
  info,
  onClose
}) {
  const el = React.createElement;
  const detail = info && (info.detail || info.message) || '';
  const nums = (String(detail).match(/\d+/g) || []).map(Number);
  const have = nums.length >= 2 ? nums[nums.length - 2] : null;
  const need = nums.length >= 2 ? nums[nums.length - 1] : null;
  // 节146：中性提示，不引导充值（充值链路已拆除）
  const body = need != null && have != null ? fmtTpl(UI_COPY.home['credit-need-have-tpl'], {
    need: (Number(need) / CREDIT_YUAN_RATE).toFixed(2),
    have: (Number(have) / CREDIT_YUAN_RATE).toFixed(2)
  }) : UI_COPY.error.points_insufficient;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  return el(ModalBase, {
    title: UI_COPY.error.points_insufficient,
    onClose: onClose,
    footer: el('button', {
      className: 'btn btn-outline',
      type: 'button',
      onClick: onClose,
      style: { marginTop: 8 }
    }, UI_COPY.home['credit-know-btn'])
  }, body);
}

// ===== REQ-072：配对解析弹窗（国学 / 西式 / MBTI 三大模块共用，module 参数不同） =====
// 交互：选两份不同档案（GET /cases）→ 关系类型单选（恋爱/朋友/家人/同事/其他）→ 可选自由关注点
// → POST /api/pair/analyze（module 由入口带入）→ 展示 interpretation。
// 缺数据档案由后端 400 detail 直接展示（提示先生成，不自动生成）；余额不足走既有 5002 → creditInsuffHandler。
// REQ-128 阶段5：meta 四套与关系类型表迁入 TC_COPY.ui.pair（文案总表统一管理）
const PAIR_MODULE_META = UI_COPY.pair.meta;
// relations 数组同时作按钮文案与提交值（与 views-zodiac PAIR_REL_ICONS 键一致），值不变仅改来源
const PAIR_RELATIONS = UI_COPY.pair.relations;
function PairModal({
  cfg,
  onClose
}) {
  const el = React.createElement;
  const meta = (cfg && PAIR_MODULE_META[cfg.module]) || PAIR_MODULE_META.guoxue;
  const [caseList, setCaseList] = useState(null); // null=加载中 / [] = 无档案 / 数组=已就绪
  const [listErr, setListErr] = useState('');
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [rel, setRel] = useState('');
  const [relOther, setRelOther] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null); // {id, interpretation}
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  // 档案选项展示：档案名 + 出生年（MBTI 模块附加已测类型标签）
  const optLabel = c => {
    const id = c.caseId;
    const nm = (c.name && String(c.name).trim()) || fmtTpl(UI_COPY.pair['case-fallback-tpl'], { id: id });
    const bits = [];
    if (c.birthYear != null && c.birthYear !== '') bits.push(fmtTpl(UI_COPY.pair['birth-year-tpl'], { year: c.birthYear }));
    if (cfg && cfg.module === 'mbti' && c.mbti_type) bits.push(fmtTpl(UI_COPY.pair['mbti-tested-tpl'], { type: c.mbti_type }));
    return nm + (bits.length ? '（' + bits.join(' · ') + '）' : '');
  };
  const caseName = id => {
    const c = (caseList || []).find(x => String(x.caseId) === String(id));
    return c ? ((c.name && String(c.name).trim()) || fmtTpl(UI_COPY.pair['case-fallback-tpl'], { id: c.caseId })) : '';
  };
  // 打开即拉档案列表（PairModal 每次打开都是全新挂载，无需清表单）
  const load = async () => {
    setListErr('');
    setCaseList(null);
    try {
      const r = await api('/cases', {
        method: 'GET'
      });
      const list = r && r.data && r.data.cases || r && r.cases || [];
      setCaseList(list);
    } catch (e) {
      // 未登录/会话过期（401）：App 已跳登录页（onUnauthorized），直接关掉弹窗即可
      if (e && e.status === 401) {
        onClose();
        return;
      }
      setListErr(e && e.message ? e.message : UI_COPY.pair['list-fail']);
      setCaseList([]);
    }
  };
  useEffect(() => {
    load();
    return () => {};
  }, []);
  const pick = which => e => {
    const v = e.target.value;
    const other = which === 'a' ? bId : aId;
    if (v && other && String(v) === String(other)) {
      toast(TC_COPY.ui.toast['pair-cases-must-differ-pick-another']);
      if (which === 'a') setAId('');else setBId('');
      return;
    }
    setErr('');
    setRes(null);
    if (which === 'a') setAId(v);else setBId(v);
  };
  const pickRel = r => {
    setRel(r);
    setErr('');
    setRes(null);
  };
  const submit = async () => {
    if (busy) return;
    if (!aId) {
      toast(TC_COPY.ui.toast['pair-case-a-required']);
      return;
    }
    if (!bId) {
      toast(TC_COPY.ui.toast['pair-case-b-required']);
      return;
    }
    if (String(aId) === String(bId)) {
      toast(TC_COPY.ui.toast['pair-cases-must-differ']);
      return;
    }
    let relation = rel;
    if (!relation) {
      toast(TC_COPY.ui.toast['pair-rel-type-required']);
      return;
    }
    if (relation === '其他') {
      const custom = String(relOther || '').trim();
      relation = custom || '其他';
    }
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      const body = {
        case_id_1: Number(aId),
        case_id_2: Number(bId),
        relation_type: relation,
        module: cfg.module
      };
      const qq = String(question || '').trim();
      if (qq) body.question = qq;
      const r = await api('/pair/analyze', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const d = r && r.data ? r.data : r;
      setRes({
        id: d && d.id != null ? d.id : null,
        relation: relation,
        interpretation: (d && d.interpretation) || UI_COPY.pair['no-interpretation']
      });
    } catch (e) {
      // 余额不足 5002：api() 已自动弹既有 creditInsuffHandler（节146 起为中性提示），此处同文案展示
      if (e && e.status === 401) {
        onClose();
        return;
      }
      // BUG-021：后端 400 缺数据提示只带 case id（如「该档案未生成星盘，请先生成后再配对解析（case 12）」），
      // 前端解析 case id 映射档案名，明确指出**是哪个档案**缺数据并引导先生成（关联 REQ-072）。
      const em = e && e.message ? String(e.message) : '';
      const m = em.match(/（case\s*(\d+)）/);
      if (m) {
        const cid = m[1];
        const nm = caseName(cid) || fmtTpl(UI_COPY.pair['case-fallback-tpl'], { id: cid });
        const head = em.indexOf('（case') >= 0 ? em.slice(0, em.indexOf('（case')) : em;
        const reason = head.replace(/^该档案/, '').trim() || UI_COPY.pair['reason-default'];
        setErr(fmtTpl(UI_COPY.pair['err-case'], { name: nm, reason: reason, guide: meta.guideTxt || UI_COPY.pair['guide-default'] }));
      } else {
        setErr(em || UI_COPY.pair['submit-fail']);
      }
    } finally {
      setBusy(false);
    }
  };
  const listLoading = caseList === null;
  const listEmpty = !listLoading && !listErr && Array.isArray(caseList) && caseList.length === 0;
  // 档案下拉共用选项
  const caseOptions = [el('option', {
    key: '__ph__',
    value: ''
  }, UI_COPY.pair['ph-case'])].concat(Array.isArray(caseList) ? caseList.map(c => el('option', {
    key: String(c.caseId),
    value: String(c.caseId)
  }, optLabel(c))) : []);
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 风格：自定义 pair-hd 头部 + pair-foot 底部 + 复杂多步内容
  const hd = el('div', { className: 'pair-hd' },
    el('div', { className: 'pair-hd-title' },
      el(Icon, {
        name: cfg && cfg.module === 'xishi' ? 'orbit' : cfg && cfg.module === 'mbti' ? 'spark' : 'nine',
        size: 20,
        color: 'var(--skin-accent)'
      }), meta.title
    ),
    el('button', {
      type: 'button',
      className: 'pair-x',
      onClick: onClose,
      title: UI_COPY.buttons.close
    }, '✕')
  );
  const content = [
    el('div', { key: 'sub', className: 'pair-sub' }, fmtTpl(UI_COPY.pair.sub, { data: meta.dataTxt })),
    el('div', { key: 'pay', className: 'pair-pay' }, UI_COPY.pair.pay),
    err ? el('div', { key: 'err', className: 'pair-err' }, err) : null,
    busy ? el('div', { key: 'busy', className: 'pair-busy' }, UI_COPY.pair.busy) : null,
    res ? el('div', { key: 'res' },
      el('div', { className: 'interp-title' }, UI_COPY.pair['result-title']),
      el('div', { style: { fontSize: 12, color: 'var(--text-3)', margin: '8px 0 2px', lineHeight: 1.7 } }, fmtTpl(UI_COPY.pair['result-sub'], { a: caseName(aId), b: caseName(bId), rel: res.relation })),
      el('div', { className: 'interp-body', style: { marginBottom: 12 } }, res.interpretation)
    ) : null,
    listLoading
      ? el('div', { key: 'loading', className: 'pair-busy' }, UI_COPY.pair['list-loading'])
      : listErr
        ? el('div', { key: 'listerr' },
            el('div', { className: 'pair-err' }, listErr),
            el('div', { className: 'pair-foot', style: { marginTop: 0 } },
              el('button', { type: 'button', className: 'btn btn-outline', onClick: load }, UI_COPY.pair['retry-list'])
            )
          )
        : listEmpty
          ? el('div', { key: 'empty', className: 'pair-err' }, fmtTpl(UI_COPY.pair['list-empty'], { prep: meta.prepTxt }))
          : el(React.Fragment, { key: 'form' },
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, 'A'), UI_COPY.pair['case-a']
                ),
                el('select', { className: 'pair-field', value: aId, onChange: pick('a') }, caseOptions)
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, 'B'), UI_COPY.pair['case-b'],
                  el('span', { style: { fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 } }, UI_COPY.pair['case-b-note']),
                  bId && aId ? el('span', { style: { fontWeight: 400, color: 'var(--skin-accent)', fontSize: 11.5 } }, fmtTpl(UI_COPY.pair.picked, { name: caseName(bId) })) : null
                ),
                el('select', { className: 'pair-field', value: bId, onChange: pick('b') }, caseOptions)
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, '①'), UI_COPY.pair['rel-label']
                ),
                el('div', { className: 'pair-rel' },
                  PAIR_RELATIONS.map(r => el('button', {
                    key: r, type: 'button',
                    className: 'btn btn-outline' + (rel === r ? ' sel' : ''),
                    onClick: () => pickRel(r)
                  }, el(PairRelIcon, { name: PAIR_REL_ICONS[r], size: 22 }), r))
                ),
                rel === '其他' ? el('input', {
                  className: 'pair-field',
                  style: { marginTop: 8 },
                  value: relOther,
                  onChange: e => setRelOther(e.target.value),
                  placeholder: UI_COPY.pair['rel-other-ph'],
                  maxLength: 20
                }) : null
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, '②'), UI_COPY.pair['focus-label'],
                  el('span', { style: { fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 } }, UI_COPY.pair['focus-note'])
                ),
                el('textarea', {
                  className: 'pair-field',
                  value: question,
                  onChange: e => setQuestion(e.target.value),
                  placeholder: UI_COPY.pair['focus-ph']
                })
              )
            )
  ];
  const footer = !listLoading && !listErr && !listEmpty && !res ? el('div', {
    // BUG-023：底部「关闭 / 开始配对」两按钮等宽并排、均匀占满底栏（pair-foot-eq）；
    className: 'pair-foot pair-foot-eq'
  },
    el('button', { type: 'button', className: 'btn btn-outline', onClick: onClose }, UI_COPY.buttons.close),
    el('button', {
      type: 'button',
      className: 'btn btn-primary',
      disabled: busy || listLoading || listEmpty,
      onClick: submit
    }, busy ? UI_COPY.pair.submitting : [UI_COPY.pair.submit, payBadge(payEnough)])
  ) : null;

  return el(ModalBase, {
    onClose: busy ? null : onClose,
    className: 'pair-modal',
    scrollable: true,
    align: 'left',
    footer: footer
  }, hd, ...content.filter(Boolean));
}

// 余额明细页
function CreditTransactionsPage({
  caseId,
  onNavigate
}) {
  const LIMIT = 20;
  const [balance, setBalance] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // REQ-063：本页余额记载统一按余额单位展示（¥ = 余额 ÷ 汇率）。
  // 复用 REQ-051 的 fetchCreditYuanRate()（模块级记忆只探测一次），失败/未就绪回退常量 10。
  const [yuanRate, setYuanRate] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchCreditYuanRate().then(r => {
      if (alive) setYuanRate(r);
    }).catch(() => {
      if (alive) setYuanRate(CREDIT_YUAN_RATE);
    });
    return () => {
      alive = false;
    };
  }, []);
  const rate = Number(yuanRate) > 0 ? Number(yuanRate) : CREDIT_YUAN_RATE;
  const fmtYuan = pts => pts == null ? '—' : '¥' + (Number(pts) / rate).toFixed(2);
  const loadBalance = async () => {
    try {
      const r = await api('/credits/balance');
      const b = r.data && r.data.balance != null ? r.data.balance : r.balance;
      if (b != null) setBalance(Number(b));
    } catch (_) {}
  };
  const load = async (off, append) => {
    if (append) setLoadingMore(true);else {
      setLoading(true);
      setErrored('');
    }
    try {
      const r = await api('/credits/transactions?limit=' + LIMIT + '&offset=' + off);
      const data = r.data || r;
      const list = Array.isArray(data.items) ? data.items : [];
      const total = data && typeof data.total === 'number' ? data.total : null;
      setItems(prev => append ? prev.concat(list) : list);
      setHasMore(list.length >= LIMIT && (total == null || off + list.length < total));
      setOffset(off + list.length);
      await loadBalance();
    } catch (e) {
      if (!append) setErrored(e.message || UI_COPY.balance['txn-list-fail']);
    } finally {
      if (append) setLoadingMore(false);else setLoading(false);
    }
  };
  useEffect(() => {
    load(0, false);
  }, []);

  // REQ-063：后端流水每条已带中文 label（断前尘·八字格局 / 塔罗解读 / 追问 / 充值 等），
  // 列表直接取 it.label；typeText 仅作后端 label 缺失时的兜底，不再回退显示裸 ref / consume。
  const typeText = t => ({
    recharge: '充值',
    manual: '手动赠送',
    grant: '手动赠送',
    free: '注册赠送',
    refund: '退款',
    predict: '预测推演',
    dqch: '断前尘推演',
    revise: '修正对话',
    single: '单法直问'
  })[t] || '';
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title",
      style: {
        width: '40%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '70%'
      }
    })), [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
      className: "sk-card",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '90%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '55%'
      }
    }))));
  }
  if (errored) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, UI_COPY.balance['txn-page-fail-title']), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => load(0, false)
    }, UI_COPY.buttons.retry), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate(caseId ? 'archive' : 'cases', {
        caseId
      })
    }, UI_COPY.buttons.back)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)'
    }
  }, UI_COPY.balance['txn-current-balance']), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      color: 'var(--ink-700)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtYuan(balance)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 4
    }
  }, fmtTpl(UI_COPY.balance['txn-rate-note-tpl'], {
    rate: rate
  })))), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, UI_COPY.balance['txn-page-title']), items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      color: 'var(--text-3)'
    }
  }, UI_COPY.balance['txn-empty']) : /*#__PURE__*/React.createElement("div", {
    className: "txn-list"
  }, items.map((it, i) => {
    const delta = it.delta != null ? Number(it.delta) : null;
    const income = delta != null && delta >= 0;
    const cls = delta == null ? '' : income ? ' plus' : ' minus';
    const amt = delta == null ? '—' : (income ? '+' : '-') + '¥' + (Math.abs(delta) / rate).toFixed(2);
    const time = String(it.createdAt || it.time || '').replace('T', ' ').slice(0, 16);
    const title = it.label || typeText(it.type) || UI_COPY.balance['txn-type-fallback'];
    const caseName = it.case_name ? String(it.case_name) : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "txn-item",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: 'txn-icon ' + (income ? 'up' : 'down')
    }, /*#__PURE__*/React.createElement(Icon, {
      name: income ? 'up' : 'down',
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      className: "txn-main"
    }, /*#__PURE__*/React.createElement("div", {
      className: "txn-title"
    }, title, it.note ? ' · ' + it.note : ''), /*#__PURE__*/React.createElement("div", {
      className: "txn-time"
    }, time), caseName ? /*#__PURE__*/React.createElement("div", {
      className: "txn-case"
    }, UI_COPY.balance['txn-case-consume'], caseName) : null), /*#__PURE__*/React.createElement("div", {
      className: "txn-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: 'txn-delta' + cls
    }, amt)));
  }), hasMore && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    disabled: loadingMore,
    onClick: () => load(offset, true)
  }, loadingMore ? UI_COPY.balance['txn-loading-more'] : UI_COPY.balance['txn-load-more'])), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      marginTop: 12
    },
    onClick: () => onNavigate(caseId ? 'archive' : 'cases', {
      caseId
    })
  }, UI_COPY.buttons.back));
}


// ===== 横向扩展：左侧导航栏 + 各模块页面 =====
const MODULE_HUB = {
  guoxue: {
    page: 'guoxue-hub',
    skin: 'guoxue'
  },
  xishi: {
    page: 'xishi-hub',
    skin: 'xishi'
  },
  mbti: {
    page: 'mbti-hub',
    skin: 'mbti'
  }
};
const RAIL_MODS = [{
  id: 'guoxue',
  label: TC_COPY.ui.nav.guoxue,
  color: 'var(--jade-500)',
  icon: 'nine'
}, {
  id: 'xishi',
  label: TC_COPY.ui.nav.xishi,
  color: 'var(--tc-amethyst)',
  icon: 'orbit'
}, {
  id: 'mbti',
  label: TC_COPY.ui.nav.mbti,
  color: 'var(--tc-indigo)',
  icon: 'spark'
}];
// REQ-064 v2：首页左侧导航恢复为 3 键（国学预测 / 西式占卜 / MBTI）；
// 「档案管理」第 4 键已撤销，入口迁移至三大模块落地宣传页主按钮下方的透明小按钮（仅登录显示）。
function NavRail({
  module,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "nav-rail",
    "aria-label": TC_COPY.ui.nav['module-aria']
  }, RAIL_MODS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    className: module === m.id ? 'active expanded' : '',
    style: {
      background: m.color
    },
    onClick: () => onSelect(m.id),
    "aria-pressed": module === m.id ? 'true' : 'false'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: m.icon,
    size: 20,
    color: "var(--tc-white)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "rail-label"
  }, m.label))));
}

// REQ-071：Banner 正中「模块」下拉导航 —— 全部支持功能（按三大模块分组，仅标题）。
// 直达页：八法合一→nine-pick / 生肖流年→zodiac / 临时起卦→divination /
// 星座→astrology / 塔罗→tarot / 雷诺曼→lenormand / MBTI→mbti。
// item: {label, page, module, skin} —— module 同步左侧 bg/落地面板，skin 与 HUB 卡片跳转口径一致。
const MOD_NAV_GROUPS = [{
  title: TC_COPY.ui.nav.guoxue,
  color: 'var(--jade-500)',
  // REQ-126：国学组按 4 张场景大卡同步（① 命盘·八法合一 / ② 问事·即时起卦 / ③ 择吉与时势 / ④ 生肖流年）
  items: [{
    label: TC_COPY.ui.nav['item-nine-pick'],
    page: 'nine-pick',
    module: 'guoxue',
    skin: 'guoxue'
  }, {
    label: TC_COPY.ui.nav['item-divination'],
    page: 'divination',
    module: 'guoxue',
    skin: 'guoxue'
  }, {
    label: TC_COPY.ui.nav['item-tools'],
    page: 'guoxue-tools',
    module: 'guoxue',
    skin: 'guoxue'
  }, {
    label: TC_COPY.ui.nav['item-zodiac'],
    page: 'zodiac',
    module: 'guoxue',
    skin: 'guoxue'
  }]
}, {
  title: TC_COPY.ui.nav.xishi,
  color: 'var(--tc-amethyst)',
  items: [{
    label: TC_COPY.ui.nav['item-astrology'],
    page: 'astrology',
    module: 'xishi',
    skin: 'xingzuo'
  }, {
    label: TC_COPY.ui.nav['item-tarot'],
    page: 'tarot',
    module: 'xishi',
    skin: 'tarot'
  }, {
    label: TC_COPY.ui.nav['item-lenormand'],
    page: 'lenormand',
    module: 'xishi',
    skin: 'tarot'
  }]
}, {
  title: TC_COPY.ui.nav.mbti,
  color: 'var(--tc-indigo)',
  items: [{
    label: TC_COPY.ui.nav['item-mbti'],
    page: 'mbti',
    module: 'mbti',
    skin: 'mbti'
  }]
}];
// Banner 正中「模块」下拉按钮：点击弹出分组直达列表；点项即达对应功能页
function TopbarModNav({
  onGo
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const go = item => {
    setOpen(false);
    onGo(item);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "topbar-modnav",
    ref: wrapRef
  }, /*#__PURE__*/React.createElement("button", {
    className: "modnav-btn",
    type: "button",
    onClick: () => setOpen(o => !o),
    "aria-haspopup": "menu",
    "aria-expanded": open ? 'true' : 'false',
    "aria-label": TC_COPY.ui.nav['module-aria']
  }, TC_COPY.ui.nav.module, /*#__PURE__*/React.createElement("span", {
    className: "caret",
    "aria-hidden": "true"
  })), open && /*#__PURE__*/React.createElement("div", {
    className: "modnav-drop",
    role: "menu",
    "aria-label": TC_COPY.ui.nav['all-modules-aria']
  }, MOD_NAV_GROUPS.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.title,
    className: "modnav-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modnav-group-title"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mg-dot",
    style: {
      background: g.color
    }
  }), g.title), g.items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.page,
    className: "modnav-item",
    role: "menuitem",
    type: "button",
    onClick: () => go(it)
  }, it.label))))));
}

// Banner 右上角菜单：未登录显示「登录 / 注册」；已登录显示 汉堡按钮 + 下拉（余额¥置顶 + 切模块回落地页 / 功能设置 / 档案管理 / 安装到桌面 / 退出登录）
/* ---------- PWA：右上角菜单「安装到桌面」常驻按钮（配合已部署 manifest.webmanifest + sw.js） ---------- */
// beforeinstallprompt 只在满足可安装条件时派发一次 → 模块级保存事件引用，点击时再 prompt()
let deferredInstallPrompt = null;
// 已安装判定：PWA 独立窗口（display-mode: standalone）或 iOS Safari 主屏模式（navigator.standalone）
function pwaStandalone() {
  return !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone);
}
function TopbarMenu({
  loggedIn,
  onAuth,
  onPickModule,
  onCases,
  onSettings,
  onLogout,
  onCredits,
  onAgent,
  agentEnabled
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  /* PWA：安装引导状态机 —— ready=已捕获 beforeinstallprompt（可一键安装） / installed=已处于应用模式 / plain=暂不可一键安装（点击走浏览器菜单指引）。
     监听常驻注册：TopbarMenu 无论登录与否都随顶栏挂载，beforeinstallprompt/appinstalled 不因菜单开合而丢失；state 变化驱动按钮文案/高亮。 */
  const [pwaState, setPwaState] = useState(() => pwaStandalone() ? 'installed' : deferredInstallPrompt ? 'ready' : 'plain');
  useEffect(() => {
    const onBeforeInstall = e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      setPwaState(s => s === 'installed' ? s : 'ready');
    };
    const onInstalled = () => {
      deferredInstallPrompt = null;
      setPwaState('installed');
      toast(UI_COPY.pwa.installed_toast);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const onInstallClick = async () => {
    setOpen(false);
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') toast(UI_COPY.pwa.install_success);else toast(UI_COPY.pwa.install_cancelled);
      } catch (err) {
        toast(UI_COPY.pwa.install_failed);
      } finally {
        deferredInstallPrompt = null;
        setPwaState(pwaStandalone() ? 'installed' : 'plain');
      }
      return;
    }
    if (pwaStandalone()) {
      toast(UI_COPY.pwa.already_installed);
      return;
    }
    toast(UI_COPY.pwa.install_hint);
  };
  if (!loggedIn) return /*#__PURE__*/React.createElement("div", {
    className: "topbar-menu"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-login-btn",
    onClick: onAuth
  }, TC_COPY.ui.menu['login-register']));
  // REQ-087：已登录 → 余额（¥，余额÷汇率换算）不再直接显示在 Banner，移入右上角菜单面板最顶部；点击进余额明细
  return /*#__PURE__*/React.createElement("div", {
    className: "topbar-menu",
    ref: wrapRef
  }, /* REQ-076 + REQ-097：王先生 Agent 文字按钮「对坐谈心」 —— 位于右上角菜单（汉堡）左侧；
      agent_enabled 开（默认）才显示；关闭入口时隐藏（既有会话与数据保留，重开可见） */
  agentEnabled && /*#__PURE__*/React.createElement("button", {
    className: "agent-top-text",
    type: "button",
    title: TC_COPY.ui.agent.name,
    "aria-label": TC_COPY.ui.agent.name,
    onClick: onAgent
  }, TC_COPY.ui.agent.talk), /*#__PURE__*/React.createElement("button", {
    className: "menu-btn",
    type: "button",
    onClick: () => setOpen(o => !o),
    "aria-label": open ? TC_COPY.ui.menu.close : TC_COPY.ui.menu.open,
    "aria-expanded": open ? 'true' : 'false'
  }, /*#__PURE__*/React.createElement("span", {
    className: "bars"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bar"
  }), /*#__PURE__*/React.createElement("span", {
    className: "bar"
  }), /*#__PURE__*/React.createElement("span", {
    className: "bar"
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "menu-drop",
    role: "menu"
  }, /* REQ-087：菜单面板最顶部 = 「余额 ¥X」（仅登录、点开菜单即见；点击进余额消耗明细） */
  /*#__PURE__*/React.createElement(MenuBalance, {
    key: 'menu-balance',
    onClick: () => {
      setOpen(false);
      onCredits && onCredits();
    }
  }), RAIL_MODS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    className: "menu-item",
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      onPickModule(m.id);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mi-dot",
    style: {
      background: m.color
    }
  }), m.label)), /* REQ-066：右上角菜单「功能设置」入口（菜单按钮名统一为「功能设置」）→ 设置页 */
  /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      onSettings && onSettings();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mi-dot",
    style: {
      background: 'var(--ink-500)'
    }
  }), TC_COPY.ui.menu.settings), /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      onCases();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mi-dot",
    style: {
      background: 'var(--jade-500)'
    }
  }), TC_COPY.ui.menu.cases), /* PWA：「安装到桌面」常驻菜单项（永不消失；点击按状态机分派：a 可安装→prompt / b 已安装→提示 / c 其他→浏览器菜单手动安装指引） */
  /*#__PURE__*/React.createElement("button", {
    className: pwaState === 'ready' ? 'menu-item install-ready' : pwaState === 'installed' ? 'menu-item install-done' : 'menu-item',
    role: "menuitem",
    title: pwaState === 'ready' ? UI_COPY.pwa.install_app : UI_COPY.pwa.install_hint,
    onClick: onInstallClick
  }, /*#__PURE__*/React.createElement("span", {
    className: "mi-dot install-dot"
  }), UI_COPY.pwa.install_app, pwaState !== 'plain' && /*#__PURE__*/React.createElement("span", {
    className: "mi-tag"
  }, pwaState === 'ready' ? UI_COPY.pwa.state_ready : UI_COPY.pwa.state_installed)), /*#__PURE__*/React.createElement("div", {
    className: "menu-sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "menu-item logout",
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      onLogout();
    }
  }, UI_COPY.buttons.logout)));
}

/* ---------- REQ-066：功能设置页（右上角菜单「功能设置」→ 此视图） ---------- */
// 7 项设置：①动画与抽卡模拟 ②占卜界面默认模式（三选一）③Banner 模块下拉导航
// ④分享表单命理太初 UI ⑤背景图显示 ⑥牌面图片显示 ⑦王先生 Agent（存值 + 暴露 agentEnabled
// 钩子，入口待 REQ-076 接入）。改动即保存：props.onPatch 本地即时生效，App 防抖 PUT，
// saveState 展示 已保存 / 保存中… / 失败回退。未登录（访客）只读展示前端默认值。
function SettingsPage({
  settings,
  saveState,
  loggedIn,
  onPatch,
  onNavigate,
  applySkin,
  skin
}) {
  const disabled = !loggedIn;
  // 默认模式三选一（与后端 default_mode 契约一致）
  const dmOpts = [{
    v: 'auto',
    t: UI_COPY.home['mode-auto'],
    d: UI_COPY.home['mode-auto-desc']
  }, {
    v: 'manual',
    t: UI_COPY.home['mode-manual'],
    d: UI_COPY.home['mode-manual-desc']
  }, {
    v: 'both',
    t: UI_COPY.home['mode-both'],
    d: UI_COPY.home['mode-both-desc']
  }];
  const curDm = settings.default_mode === 'manual' || settings.default_mode === 'both' ? settings.default_mode : 'auto';
  // 开关行渲染（label.switch 复用既有 .switch/.slider 样式）
  const switchRow = function (key, name, desc, checked) {
    return React.createElement('div', { className: 'tc-set-row' },
      React.createElement('div', { className: 'tc-set-text' },
        React.createElement('span', { className: 'tc-set-name' }, name),
        desc ? React.createElement('span', { className: 'tc-set-desc' }, desc) : null),
      React.createElement('label', { className: 'switch', 'aria-label': name },
        React.createElement('input', {
          type: 'checkbox',
          checked: !!checked,
          disabled: disabled,
          onChange: function (e) { onPatch(key, e.target.checked); }
        }),
        React.createElement('span', { className: 'slider' })));
  };
  // 默认模式行（三选一单选行）
  const dmRow = React.createElement('div', { className: 'tc-set-row col' },
    React.createElement('div', { className: 'tc-set-text' },
      React.createElement('span', { className: 'tc-set-name' }, UI_COPY.home['set-div-mode']),
      React.createElement('span', { className: 'tc-set-desc' }, UI_COPY.home['set-div-mode-desc'])),
    React.createElement('div', { className: 'tc-set-opts' }, dmOpts.map(function (o) {
      return React.createElement('button', {
        key: o.v,
        type: 'button',
        className: 'tc-set-opt' + (curDm === o.v ? ' sel' : ''),
        disabled: disabled,
        onClick: function () { onPatch('default_mode', o.v); }
      },
      React.createElement('span', { className: 'so-dot' }),
      React.createElement('span', { className: 'so-main' },
        React.createElement('span', { className: 'so-t' }, o.t),
        React.createElement('span', { className: 'so-d' }, o.d)));
    })));
  const saveCls = saveState === 'failed' ? 'failed' : saveState === 'saving' ? 'saving' : 'ok';
  const saveTxt = !loggedIn ? UI_COPY.home['save-not-login']
    : saveState === 'saving' ? UI_COPY.home['save-saving']
      : saveState === 'failed' ? UI_COPY.home['save-fail']
        : UI_COPY.home['save-done'];
  const goBack = function () {
    try {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (e) {/* 忽略，走 fallback */}
    onNavigate('landing');
  };
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'spark', size: 22 }), ' ' + UI_COPY.home['settings-title']),
    React.createElement('div', { className: 'tc-set-sub' }, UI_COPY.home['settings-sub']),
    React.createElement('div', { className: 'card tc-set-card' },
      switchRow('anim_enabled', UI_COPY.home['set-anim'], UI_COPY.home['set-anim-desc'], settings.anim_enabled),
      dmRow,
      switchRow('banner_dropdown', UI_COPY.home['set-banner'], UI_COPY.home['set-banner-desc'], settings.banner_dropdown),
      switchRow('share_taichu_ui', UI_COPY.home['set-share-ui'], UI_COPY.home['set-share-ui-desc'], settings.share_taichu_ui),
      switchRow('bg_enabled', UI_COPY.home['set-bg'], UI_COPY.home['set-bg-desc'], settings.bg_enabled),
      switchRow('card_images', UI_COPY.home['set-card-images'], UI_COPY.home['set-card-images-desc'], settings.card_images),
      switchRow('agent_enabled', UI_COPY.home['set-agent'], UI_COPY.home['set-agent-desc'], settings.agent_enabled),
      React.createElement('div', { className: 'tc-set-row col' },
        React.createElement('div', { className: 'tc-set-text' },
          React.createElement('span', { className: 'tc-set-name' }, UI_COPY.home['set-skin']),
          React.createElement('span', { className: 'tc-set-desc' }, UI_COPY.home['set-skin-desc'])),
        React.createElement(SkinSwitcher, {
          skin: skin || 'guoxue',
          onPick: function (id) { applySkin(id); }
        }))),
    React.createElement('div', { className: 'tc-set-status ' + saveCls },
      React.createElement('span', { className: 'ss-dot' }),
      React.createElement('span', null, saveTxt)),
    !loggedIn ? React.createElement('div', { className: 'tc-set-guest' }, UI_COPY.home['guest-note']) : null,
    React.createElement('div', { className: 'back-row' },
      React.createElement('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: goBack }, UI_COPY.buttons.back),
      React.createElement('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: function () { onNavigate('landing'); } }, UI_COPY.buttons.back_home)));
}
