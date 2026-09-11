// 首页/导航/账户域视图（节110 阶段3）：首页 LandingPage + 积分 CreditBalance/BannerBalance/MenuBalance/CreditInsufficientModal + 配对 PairModal + 余额明细 CreditTransactionsPage + 导航 NavRail/TopbarModNav/TopbarMenu + 设置 SettingsPage
// （usePaySufficient 亦被档案/解读域 views-cases.js 复用，故保持全局可见）
// 加载于 views-onboarding.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

// ---- Pages ----
// REQ-064 v2：三大模块落地宣传页 —— 主按钮下方「档案管理」透明小按钮（仅登录显示，点击进档案管理列表）
function LandingPage({
  module,
  onNavigate,
  loggedIn,
  agentEnabled
}) {
  // 各模块的「落地宣传页」配置：主标题 / 副标题 / 简介 / 主按钮 → 对应 HUB 或测试页
  const MODS = {
    guoxue: {
      icon: 'nine',
      title: TC_COPY.ui.module_hub.guoxue_title,
      subtitle: TC_COPY.ui.module_hub.guoxue_desc,
      intro: TC_COPY.ui.landing.value_1_desc,
      cta: TC_COPY.ui.module_hub.enter_guoxue,
      to: 'guoxue-hub',
      /* REQ-084：Q 版动画（素材：美术素材表-第三轮 §0.4 主图，静态单图 + CSS keyframes）
         REQ-084：序列帧 sprite sheet 播放器配置 —— sprite.ready=false 走旧 CSS 动画（零回归）；
         美术动作帧素材回传后置 ready=true 并填 src 即可（cols/rows/frames/width 按回传网格约定调整）；
         interact 为叠加互动小元素（透明小图 + CSS 路径动画 class 占位），素材未回传保持空数组 */
      mascot: {
        cls: 'guoxue',
        src: '/art/module-mascot/guoxue-mascot.webp',
        alt: TC_COPY.ui.landing['mascot-guoxue-alt'],
        sprite: { ready: true, src: '/art/taichu-pet/mascot-guoxue.webp', cols: 5, rows: 2, frames: 10, duration: 2.0, width: 256 },
        interact: [
          { key: 'bird', src: '/art/taichu-pet/fx-bird.webp', cls: 'fx-fly-bird' },
          { key: 'butterfly', src: '/art/taichu-pet/fx-butterfly.webp', cls: 'fx-fly-butterfly' }
        ]
      }
    },
    xishi: {
      icon: 'orbit',
      title: TC_COPY.ui.module_hub.western_title,
      subtitle: TC_COPY.ui.module_hub.western_desc,
      intro: TC_COPY.ui.landing['xishi-intro'],
      cta: TC_COPY.ui.module_hub.enter_western,
      to: 'xishi-hub',
      /* REQ-084：Q 版动画（素材：美术素材表-第三轮 §0.4 主图，静态单图 + CSS keyframes）
         REQ-084：序列帧 sprite sheet 播放器配置 —— 见 guoxue 处注释 */
      mascot: {
        cls: 'xishi',
        src: '/art/module-mascot/xishi-mascot.webp',
        alt: TC_COPY.ui.landing['mascot-xishi-alt'],
        sprite: { ready: true, src: '/art/taichu-pet/mascot-xishi.webp', cols: 5, rows: 2, frames: 10, duration: 3.6, width: 256 },
        interact: [
          { key: 'star-five', src: '/art/taichu-pet/fx-star-five.webp', cls: 'fx-spin-star' },
          { key: 'star-sparkle', src: '/art/taichu-pet/fx-star-sparkle.webp', cls: 'fx-spin-star fx-sparkle' },
          { key: 'constellation', src: '/art/taichu-pet/fx-constellation.webp', cls: 'fx-fade-constellation' }
        ]
      }
    },
    mbti: {
      icon: 'spark',
      title: TC_COPY.ui.module_hub.mbti_title,
      subtitle: TC_COPY.ui.module_hub.mbti_desc,
      intro: TC_COPY.ui.landing['mbti-intro'],
      cta: TC_COPY.ui.module_hub.enter_mbti,
      to: 'mbti-hub',
      /* REQ-084：Q 版动画（素材：美术素材表-第三轮 §0.4 主图，静态单图 + CSS keyframes）
         REQ-084：序列帧 sprite sheet 播放器配置 —— 见 guoxue 处注释 */
      mascot: {
        cls: 'mbti',
        src: '/art/module-mascot/mbti-mascot.webp',
        alt: TC_COPY.ui.landing['mascot-mbti-alt'],
        sprite: { ready: true, src: '/art/taichu-pet/mascot-mbti.webp', cols: 5, rows: 2, frames: 10, duration: 3.2, width: 256 },
        interact: [
          { key: 'star-five', src: '/art/taichu-pet/fx-star-five.webp', cls: 'fx-spin-star' },
          { key: 'star-sparkle', src: '/art/taichu-pet/fx-star-sparkle.webp', cls: 'fx-spin-star fx-sparkle' }
        ]
      }
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
  }, c.intro), /* REQ-084：模块 Q 版循环动画（旧：静态单图 + CSS keyframes；新：sprite.ready=true 时
      走序列帧播放器，div 宽=高=sprite.width、background-size=width*cols × width*rows，
      keyframes 由 ensureSpriteKeyframes 按配置生成，CSS steps(1) 逐帧播放，不渲染旧 <img>）——
      两种状态整块均可点击进入太初先生会话（与 banner「对坐谈心」同一 navigate('agent') 入口，REQ-076）；
      REQ-116：agent_enabled 关 → 不渲染，与「对坐谈心」按钮同一开关源 */
  agentEnabled && c.mascot && /*#__PURE__*/React.createElement("button", {
    className: "landing-mascot landing-mascot--side anim-mascot " + c.mascot.cls,
    type: "button",
    title: TC_COPY.ui.agent['chat-title'],
    "aria-label": TC_COPY.ui.agent['chat-title'],
    onClick: () => onNavigate('agent')
  }, c.mascot.sprite && c.mascot.sprite.ready ? /*#__PURE__*/React.createElement("div", {
    className: "mascot-sprite play",
    role: "img",
    "aria-label": c.mascot.alt,
    style: {
      width: c.mascot.sprite.width,
      height: c.mascot.sprite.width,
      backgroundImage: 'url("' + c.mascot.sprite.src + '")',
      backgroundSize: c.mascot.sprite.width * c.mascot.sprite.cols + 'px ' + c.mascot.sprite.width * c.mascot.sprite.rows + 'px',
      '--sprite-anim': ensureSpriteKeyframes(c.mascot.sprite) + ' ' + c.mascot.sprite.duration + 's steps(1) infinite'
    }
  }) : /*#__PURE__*/React.createElement("img", {
    src: c.mascot.src,
    alt: c.mascot.alt,
    loading: "lazy",
    decoding: "async"
  }), /* REQ-084：互动小元素叠加层（绝对定位，默认空；interact 配置非空时渲染各透明小图 + 路径动画 class） */
  /*#__PURE__*/React.createElement("div", {
    className: "lm-fx"
  }, (c.mascot.interact || []).map(function (it) {
    return /*#__PURE__*/React.createElement("img", {
      key: it.key,
      src: it.src,
      alt: "",
      className: it.cls,
      loading: "lazy",
      decoding: "async"
    });
  })), /*#__PURE__*/React.createElement("span", {
    className: "lm-cap"
  }, TC_COPY.ui.agent.talk)), /*#__PURE__*/React.createElement("button", {
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
  // 充值入口暂时隐藏（商户认证未完成）：仅保留余额胶囊展示与「查看余额明细」跳转，不再渲染「充值」链接
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
      background: '#B8893E'
    }
  }), TC_COPY.ui.balance.label, " ", /*#__PURE__*/React.createElement("span", {
    className: "mb-val"
  }, "¥", txt));
}
// 充值按钮组件已随充值入口一并隐藏（商户认证未完成）；恢复开放时按需重建：
// 原实现为一个 btn btn-primary 的「充值」按钮（class 含 btn btn-primary，type=button），
// onClick 缺省时调用 startRecharge()（charge-code 换金数据表单并轮询到账）。
function CreditInsufficientModal({
  info,
  onClose
}) {
  const el = React.createElement;
  const detail = info && (info.detail || info.message) || '';
  const nums = (String(detail).match(/\d+/g) || []).map(Number);
  const have = nums.length >= 2 ? nums[nums.length - 2] : null;
  const need = nums.length >= 2 ? nums[nums.length - 1] : null;
  // 充值入口暂时隐藏：中性提示，不引导充值
  const body = need != null && have != null ? '本次推演约需 ¥' + (Number(need) / CREDIT_YUAN_RATE).toFixed(2) + '，当前余额 ¥' + (Number(have) / CREDIT_YUAN_RATE).toFixed(2) + '。' : UI_COPY.error.points_insufficient;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  return el(ModalBase, {
    title: UI_COPY.error.points_insufficient,
    onClose: onClose,
    footer: el('button', {
      className: 'btn btn-outline',
      type: 'button',
      onClick: onClose,
      style: { marginTop: 8 }
    }, '知道了')
  }, body);
}

// ===== REQ-072：配对解析弹窗（国学 / 西式 / MBTI 三大模块共用，module 参数不同） =====
// 交互：选两份不同档案（GET /cases）→ 关系类型单选（恋爱/朋友/家人/同事/其他）→ 可选自由关注点
// → POST /api/pair/analyze（module 由入口带入）→ 展示 interpretation。
// 缺数据档案由后端 400 detail 直接展示（提示先生成，不自动生成）；余额不足走既有 5002 → creditInsuffHandler。
const PAIR_MODULE_META = {
  guoxue: { title: '国学 · 九法配对', dataTxt: '双方排盘信息（九法合一）', prepTxt: '档案需先生成排盘数据（未排盘的档案提交后将提示先生成）', guideTxt: '在「国学预测 · 九法合一」为该档案完成排盘（确定性计算、免费）' },
  xishi: { title: '星座 · 配对解析', dataTxt: '双方星座本命星盘', prepTxt: '档案需先生成星座本命星盘（未生成星盘的档案提交后将提示先生成）', guideTxt: '在「星座」页选择该档案并点击「生成星盘」（免费；已生成过则直接复用、不重复计费）' },
  mbti: { title: '心理测试 · 配对解析', dataTxt: '双方 MBTI 人格信息', prepTxt: '档案需先完成心理测试（未测的档案提交后将提示先生成）', guideTxt: '在「心理测试」页选择该档案并完成测试判型（结果会写入档案）' },
  // REQ-100：八字配对 —— 入口在国学 HUB「九法配对 / 八字配对 / 档案起名」同排 3 键；
  // module='bazi' 走同一 POST /api/pair/analyze
  bazi: { title: '八字 · 配对解析', dataTxt: '双方八字排盘信息', prepTxt: '档案需先生成八字排盘（未排盘的档案提交后将提示先生成）', guideTxt: '在「九法合一 · 选择档案」页为该档案完成排盘（确定性计算、免费）' }
};
const PAIR_RELATIONS = ['恋爱', '朋友', '家人', '同事', '其他'];
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
    const nm = (c.name && String(c.name).trim()) || '档案 ' + id;
    const bits = [];
    if (c.birthYear != null && c.birthYear !== '') bits.push(String(c.birthYear) + ' 年');
    if (cfg && cfg.module === 'mbti' && c.mbti_type) bits.push('已测 ' + String(c.mbti_type));
    return nm + (bits.length ? '（' + bits.join(' · ') + '）' : '');
  };
  const caseName = id => {
    const c = (caseList || []).find(x => String(x.caseId) === String(id));
    return c ? ((c.name && String(c.name).trim()) || '档案 ' + c.caseId) : '';
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
      setListErr(e && e.message ? e.message : '档案列表加载失败，请重试。');
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
      toast('两份档案不能相同，请另选一份');
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
      toast('请先选择档案 A');
      return;
    }
    if (!bId) {
      toast('请先选择档案 B');
      return;
    }
    if (String(aId) === String(bId)) {
      toast('两份档案不能相同');
      return;
    }
    let relation = rel;
    if (!relation) {
      toast('请选择关系类型（恋爱 / 朋友 / 家人 / 同事…）');
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
        interpretation: (d && d.interpretation) || '（暂无解读内容）'
      });
    } catch (e) {
      // 余额不足 5002：api() 已自动弹既有 creditInsuffHandler 充值引导，此处同文案展示
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
        const nm = caseName(cid) || ('档案 ' + cid);
        const head = em.indexOf('（case') >= 0 ? em.slice(0, em.indexOf('（case')) : em;
        const reason = head.replace(/^该档案/, '').trim() || '数据未生成';
        setErr('档案「' + nm + '」' + reason + '。\n生成指引：' + (meta.guideTxt || '在对应模块为该档案先生成所需数据'));
      } else {
        setErr(em || '配对解析失败，请重试。');
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
  }, '— 请选择档案 —')].concat(Array.isArray(caseList) ? caseList.map(c => el('option', {
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
    el('div', { key: 'sub', className: 'pair-sub' }, '选择两份档案，基于' + meta.dataTxt + '，让 AI 解析两人的关系契合、相处模式与建议。'),
    el('div', { key: 'pay', className: 'pair-pay' }, '配对解析为付费 LLM 解读：按实际用量扣余额（¥），解读成功后即时扣费（余额不足将自动提示）。'),
    err ? el('div', { key: 'err', className: 'pair-err' }, err) : null,
    busy ? el('div', { key: 'busy', className: 'pair-busy' }, '配对解析生成中（LLM 撰写约需 10–40 秒），请勿重复提交…') : null,
    res ? el('div', { key: 'res' },
      el('div', { className: 'interp-title' }, '配对解析结果'),
      el('div', { style: { fontSize: 12, color: 'var(--text-3)', margin: '8px 0 2px', lineHeight: 1.7 } }, '「' + caseName(aId) + ' × ' + caseName(bId) + '」 · ' + res.relation),
      el('div', { className: 'interp-body', style: { marginBottom: 12 } }, res.interpretation)
    ) : null,
    listLoading
      ? el('div', { key: 'loading', className: 'pair-busy' }, '档案列表加载中…')
      : listErr
        ? el('div', { key: 'listerr' },
            el('div', { className: 'pair-err' }, listErr),
            el('div', { className: 'pair-foot', style: { marginTop: 0 } },
              el('button', { type: 'button', className: 'btn btn-outline', onClick: load }, '重试档案')
            )
          )
        : listEmpty
          ? el('div', { key: 'empty', className: 'pair-err' }, '暂无可用档案：' + meta.prepTxt + '。')
          : el(React.Fragment, { key: 'form' },
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, 'A'), '档案一'
                ),
                el('select', { className: 'pair-field', value: aId, onChange: pick('a') }, caseOptions)
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, 'B'), '档案二',
                  el('span', { style: { fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 } }, '（需与档案一不同）'),
                  bId && aId ? el('span', { style: { fontWeight: 400, color: 'var(--skin-accent)', fontSize: 11.5 } }, '已选：' + caseName(bId)) : null
                ),
                el('select', { className: 'pair-field', value: bId, onChange: pick('b') }, caseOptions)
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, '①'), '关系类型'
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
                  placeholder: '自定义关系类型（如：合伙人 / 师徒 / 暧昧）',
                  maxLength: 20
                }) : null
              ),
              el('div', { className: 'pair-sec' },
                el('div', { className: 'pair-sec-label' },
                  el('span', { className: 'ps-n' }, '②'), '自由关注点',
                  el('span', { style: { fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 } }, '（选填）')
                ),
                el('textarea', {
                  className: 'pair-field',
                  value: question,
                  onChange: e => setQuestion(e.target.value),
                  placeholder: '想重点看什么？如：性格是否合拍、容易在哪些方面起冲突、相处建议…'
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
    }, busy ? '配对解析中…' : ['开始配对解析', payBadge(payEnough)])
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
  const enterBalance = useRef(null);
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
      if (!append) setErrored(e.message || '余额记录加载失败，请重试。');
    } finally {
      if (append) setLoadingMore(false);else setLoading(false);
    }
  };
  useEffect(() => {
    load(0, false);
  }, []);

  // 从充值页返回后检测余额增加 → 到账提示
  useEffect(() => {
    enterBalance.current = balance;
  }, [balance]);
  useEffect(() => {
    const onFocus = async () => {
      try {
        const r = await api('/credits/balance');
        const b = r.data && r.data.balance != null ? r.data.balance : r.balance;
        if (b != null && enterBalance.current != null && Number(b) > enterBalance.current) {
          toast(TC_COPY.ui.balance['recharge-ok']);
          setBalance(Number(b));
          load(0, false);
        }
      } catch (_) {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
    }, "余额明细加载失败"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => load(0, false)
    }, "重试"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate(caseId ? 'archive' : 'cases', {
        caseId
      })
    }, "返回")));
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
  }, "当前余额"), /*#__PURE__*/React.createElement("div", {
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
  }, "换算：1 元 = ", rate, " 存储单位（余额 ¥ = 存储单位 ÷ 汇率）"))), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "余额明细"), items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      color: 'var(--text-3)'
    }
  }, "暂无消费记录") : /*#__PURE__*/React.createElement("div", {
    className: "txn-list"
  }, items.map((it, i) => {
    const delta = it.delta != null ? Number(it.delta) : null;
    const income = delta != null && delta >= 0;
    const cls = delta == null ? '' : income ? ' plus' : ' minus';
    const amt = delta == null ? '—' : (income ? '+' : '-') + '¥' + (Math.abs(delta) / rate).toFixed(2);
    const time = String(it.createdAt || it.time || '').replace('T', ' ').slice(0, 16);
    const title = it.label || typeText(it.type) || '交易';
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
    }, "消耗档案：", caseName) : null), /*#__PURE__*/React.createElement("div", {
      className: "txn-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: 'txn-delta' + cls
    }, amt)));
  }), hasMore && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    disabled: loadingMore,
    onClick: () => load(offset, true)
  }, loadingMore ? '加载中...' : '加载更多')), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      marginTop: 12
    },
    onClick: () => onNavigate(caseId ? 'archive' : 'cases', {
      caseId
    })
  }, "返回"));
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
  color: '#3E7C6B',
  icon: 'nine'
}, {
  id: 'xishi',
  label: TC_COPY.ui.nav.xishi,
  color: '#5B4B8A',
  icon: 'orbit'
}, {
  id: 'mbti',
  label: TC_COPY.ui.nav.mbti,
  color: '#4A5BB5',
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
    color: "#fff"
  }), /*#__PURE__*/React.createElement("span", {
    className: "rail-label"
  }, m.label))));
}

// REQ-071：Banner 正中「模块」下拉导航 —— 全部支持功能（按三大模块分组，仅标题）。
// 直达页：九法合一→nine-pick / 生肖流年→zodiac / 临时起卦→divination /
// 星座→astrology / 塔罗→tarot / 雷诺曼→lenormand / MBTI→mbti。
// item: {label, page, module, skin} —— module 同步左侧 bg/落地面板，skin 与 HUB 卡片跳转口径一致。
const MOD_NAV_GROUPS = [{
  title: TC_COPY.ui.nav.guoxue,
  color: '#3E7C6B',
  // REQ-126：国学组按 4 张场景大卡同步（① 命盘·九法合一 / ② 问事·即时起卦 / ③ 择吉与时势 / ④ 生肖流年）
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
  color: '#5B4B8A',
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
  color: '#4A5BB5',
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
  }, /* REQ-076 + REQ-097：太初先生 Agent 文字按钮「对坐谈心」 —— 位于右上角菜单（汉堡）左侧；
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
      background: '#44558F'
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
      background: '#3E7C6B'
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
// ④分享表单太初 UI ⑤背景图显示 ⑥牌面图片显示 ⑦太初先生 Agent（存值 + 暴露 agentEnabled
// 钩子，入口待 REQ-076 接入）。改动即保存：props.onPatch 本地即时生效，App 防抖 PUT，
// saveState 展示 已保存 / 保存中… / 失败回退。未登录（访客）只读展示前端默认值。
function SettingsPage({
  settings,
  saveState,
  loggedIn,
  onPatch,
  onNavigate
}) {
  const disabled = !loggedIn;
  // 默认模式三选一（与后端 default_mode 契约一致）
  const dmOpts = [{
    v: 'auto',
    t: '默认项目起卦 / 抽卡方式（默认）',
    d: '保持现状：进入占卜界面默认停在自动起卦 / 自动抽卡。'
  }, {
    v: 'manual',
    t: '默认手动快速填写',
    d: '进入后默认停在手动录入 / 手动选牌入口，直接填写真实结果。'
  }, {
    v: 'both',
    t: '两方式都可用',
    d: '自动与手动两入口并行展示、不强行预设（保留上次所选）。'
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
      React.createElement('span', { className: 'tc-set-name' }, '占卜界面默认模式'),
      React.createElement('span', { className: 'tc-set-desc' }, '控制塔罗 / 雷诺曼 / 临时起卦等占卜界面的默认入口方式。')),
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
  const saveTxt = !loggedIn ? '未登录：以下为前端默认值，登录后调整将同步保存到账户。'
    : saveState === 'saving' ? '保存中…'
      : saveState === 'failed' ? '保存失败，已回退为最近一次保存值，请重试。'
        : '已保存';
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
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'spark', size: 22 }), ' 功能设置'),
    React.createElement('div', { className: 'tc-set-sub' }, '功能设置 · 全部改动即时生效并自动保存（无需额外保存按钮）'),
    React.createElement('div', { className: 'card tc-set-card' },
      switchRow('anim_enabled', '动画与抽卡模拟', '关闭后各占卜界面跳过动效直接出结果。', settings.anim_enabled),
      dmRow,
      switchRow('banner_dropdown', 'Banner 模块下拉导航', '开启后顶部横幅正中显示「模块」下拉，直达各功能页；关闭则不展示。', settings.banner_dropdown),
      switchRow('share_taichu_ui', '分享表单太初 UI', '开启后分享答题表单内显示太初 logo、登录注册与免责提示；关闭后仅表单。', settings.share_taichu_ui),
      switchRow('bg_enabled', '背景图显示', '开启显示模块主题运营背景（含星点背景）；关闭后为纯色默认样式。', settings.bg_enabled),
      switchRow('card_images', '牌面图片显示（塔罗 / 雷诺曼）', '关闭后为纯文字列表模式：仅显示抽到的卡名、正 / 逆位与含义段落。', settings.card_images),
      switchRow('agent_enabled', '太初先生 Agent', '预留开关：开启后由「太初先生」提供对话式陪伴与解读（入口随 Agent 功能上线）。', settings.agent_enabled)),
    React.createElement('div', { className: 'tc-set-status ' + saveCls },
      React.createElement('span', { className: 'ss-dot' }),
      React.createElement('span', null, saveTxt)),
    !loggedIn ? React.createElement('div', { className: 'tc-set-guest' }, '当前为未登录状态：设置仅按前端默认值展示，暂不可修改；登录后将从账户拉取并保存。') : null,
    React.createElement('div', { className: 'back-row' },
      React.createElement('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: goBack }, '返回'),
      React.createElement('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: function () { onNavigate('landing'); } }, UI_COPY.buttons.back_home)));
}
