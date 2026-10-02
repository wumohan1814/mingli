// 合参页视图（节161）：HecanPage —— 一页两标签
//   ① 命盘合参（要生辰）：选档案 + 方法多选 → 断前尘 → 问卷校准 → 综合预测（跳 waiting 页）
//   ② 当下事合参（不要生辰）：问事 + 方法多选 + 起卦参数 → POST /api/combine/moment → 轮询作业 → 按板块标题渲染
//
// 单一事实源（后端）：方法名与方法 key 读 GET /api/combine/pools；作业标题 label 与结果板块标题
//   reportTitles 读 GET /api/jobs/{id}。前端**不写死任何方法名**，只做「中文数字 + 法合一 / 法合参」
//   的即时预览（文案在 ML_COPY.ui.hecan，占位符由 fmtTpl 填充），提交后一律以后端 label 为准。
//
// 降级（对齐 data/runtime.js「取不到就按兜底，不许因读不到而少渲染功能、不许白屏」）：
//   pools 取不到 → 多选区改为提示 + 重试（页面其余部分照常渲染）；命盘合参仍可开始（不带 methods
//   ＝ 按后端默认方法集，行为与接口存在之前完全一致）；当下事合参没有可选 key 时按钮禁用并说明原因。
//
// 复用（不自创一套）：起卦参数沿用「临时起卦」既有口径 —— 时辰表 SHICHEN_ARR、todayStr /
//   nowShichen / pad2（views-divination.js），时刻组装为东八区 ISO 后按**逐法 seed** 提交
//   （`cast` 形状 = `method_key → seed`，见 buildCast）；抽签 / 掷筊 / 摇卦 / 抽牌一律沿用各法
//   既有的「随手抽」自动口径（由引擎确定性成卦），合参页不提供逐爻手动录入。
//
// 加载于 views-divination.js / views-guoxue-tools.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用。

/* ---------- 方法集名（提交前的即时预览；后端 202 的 label 与作业 label 才是权威） ---------- */
// 中文数字 1–10 走文案表（避免在视图里硬编码中文）；超出范围回退阿拉伯数字
function hecanNumCn(n) {
  return UI_COPY.hecan['num-' + n] || String(n);
}
// kind 'natal' → 「N 法合一」；kind 'moment' → 「N 法合参」；n=0 → 通用名「合参」
function hecanLabel(kind, n) {
  const C = UI_COPY.hecan;
  if (!n) return C['label-generic'];
  return fmtTpl(C['label-tpl'], {
    num: hecanNumCn(n),
    kind: kind === 'natal' ? C['kind-natal'] : C['kind-moment']
  });
}

/* ---------- 档案「合参」状态（依赖 /cases 列表的 status / hasReport / methodCount） ----------
   view=true  已有结果 → 「查看 / 修改结果」可用（进入结果查看，含校准/追问/重跑修改链路）
   go=false   未排盘（无 Chart 盘面，断前尘链路无法启动）→ 引导先去档案管理执行排盘
   档案是独立数据实体：合参只是一种使用方式，未跑合参不影响建档/排盘/档案查看。 */
function hecanRunState(c) {
  const C = UI_COPY.hecan;
  const st = String(c && c.status || '');
  const mc = Number(c && c.methodCount) || 0;
  if (!c || st === 'created') {
    return { view: false, go: false, label: C['status-not-paipan'], cls: 'none' };
  }
  if ((c && c.hasReport) || st === 'predict_done') return { view: true, go: true, label: C['status-done'], cls: '' };
  if (st === 'predict_running') return { view: true, go: true, label: C['status-generating'], cls: '' };
  if (st === 'calibrated') return { view: true, go: true, label: C['status-calibrated'], cls: '' };
  if (st === 'dqc_done') return { view: true, go: true, label: C['status-duanqianchen'], cls: '' };
  if (st === 'dqc_running') return { view: false, go: true, label: C['status-running'], cls: 'none' };
  if (mc > 0) return { view: false, go: true, label: fmtTpl(C['status-progress-tpl'], { done: mc }), cls: 'none' };
  return { view: false, go: true, label: C['status-not-run'], cls: 'none' };
}

/* ---------- 方法清单读取（GET /api/combine/pools） ----------
   成功 → {natal:[{key,name}], moment:[{key,name}]}；失败 → 空清单 + err（调用方按降级路径渲染）。 */
function useCombinePools() {
  const [pools, setPools] = useState(null); // null=读取中
  const [err, setErr] = useState('');
  const load = async () => {
    setErr('');
    try {
      const r = await api('/combine/pools', { method: 'GET' });
      const d = (r && r.data) || r || {};
      const pick = arr => (Array.isArray(arr) ? arr : [])
        .filter(x => x && x.key)
        .map(x => ({ key: String(x.key), name: String(x.name == null ? x.key : x.name) }));
      setPools({ natal: pick(d.natal), moment: pick(d.moment) });
    } catch (e) {
      setPools({ natal: [], moment: [] });
      setErr((e && e.message) || '');
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { pools: pools, err: err, reload: load };
}

/* ---------- 当下事合参：作业结果 → 板块列表 ----------
   板块标题只从作业数据读（GET /api/jobs/{id} 的 reportTitles；作业结果里也有同源一份），
   内容取 result.report.sections[].description（后端 `_parse_moment_report` 的稳定形状），
   查不到结构时按「整段文本」兜底，绝不白屏。 */
function hecanCellText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const keys = ['description', 'content', 'text', 'interpretation', 'report', 'body', 'summary', 'markdown'];
    for (let i = 0; i < keys.length; i++) {
      const t = v[keys[i]];
      if (typeof t === 'string' && t.trim()) return t;
    }
    return '';
  }
  return String(v);
}
function hecanMomentSections(d) {
  const data = d || {};
  const res = data.result && typeof data.result === 'object' && !Array.isArray(data.result) ? data.result : null;
  const rep = res && res.report && typeof res.report === 'object' ? res.report : null;
  const titles = Array.isArray(data.reportTitles) ? data.reportTitles
    : (res && Array.isArray(res.reportTitles) ? res.reportTitles : []);
  const raw = rep && Array.isArray(rep.sections) ? rep.sections : [];
  const out = [];
  titles.forEach((t, i) => {
    const title = String(t);
    const hit = raw.filter(x => x && String(x.title || '') === title)[0] || raw[i];
    out.push({ key: title + '#' + i, title: title, text: hit ? hecanCellText(hit) : '' });
  });
  // 骨架外的额外板块（后端把模型多给的标题追加在末尾）→ 一并展示，不丢信息
  raw.slice(titles.length).forEach((s, i) => {
    if (s) out.push({ key: 'extra#' + i, title: String(s.title || ''), text: hecanCellText(s) });
  });
  if (!out.length && rep) {
    const plain = hecanCellText(rep.summary);
    if (plain) out.push({ key: 'all', title: '', text: plain });
  }
  return out;
}

/* ---------- 方法多选（药丸式；复用既有 .chart-tabs / .chart-tab 样式，不新增 CSS） ---------- */
function HecanMethodPills({ items, selected, onToggle }) {
  const el = React.createElement;
  const sel = selected || [];
  return el('div', { className: 'chart-tabs' }, items.map(m => el('button', {
    key: m.key,
    type: 'button',
    className: 'chart-tab' + (sel.indexOf(m.key) >= 0 ? ' active' : ''),
    'aria-pressed': sel.indexOf(m.key) >= 0,
    onClick: () => onToggle(m.key)
  }, m.name)));
}

/* ---------- 合参页 ---------- */
function HecanPage({ caseId, onNavigate }) {
  const el = React.createElement;
  const C = UI_COPY.hecan;
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [tab, setTab] = useState('natal');
  const poolsQ = useCombinePools();
  const pools = poolsQ.pools;
  const natalAll = pools ? pools.natal : [];
  const momentAll = pools ? pools.moment : [];
  const poolsLoading = !pools;
  const poolsFailed = !!poolsQ.err;
  // 方法清单读不到时 unknown=true：命盘合参按「不带方法集」降级提交（后端默认方法集），不阻断主流程
  const poolsUnknown = poolsFailed || (pools && !natalAll.length);

  /* ===== 标签①：命盘合参 ===== */
  const [list, setList] = useState(null); // null=读取中；[]=无档案
  const [errored, setErrored] = useState('');
  const [selId, setSelId] = useState(caseId != null && String(caseId).trim() ? String(caseId) : '');
  const [natalKeys, setNatalKeys] = useState(null); // null=未初始化（清单到齐后默认全选）
  const [runSet, setRunSet] = useState(null);       // null=核对中；{ok,keys} / {ok:false,msg}
  const load = async () => {
    setErrored('');
    try {
      const res = await api('/cases', { method: 'GET' });
      const arr = (res.data && res.data.cases) || res.cases || [];
      setList(arr);
      // 预选档案（如 returnTo=hecan 建档回跳）在列表中不存在时清空，避免悬空选中
      if (selId && !arr.some(c => String(c.caseId) === String(selId))) setSelId('');
    } catch (e) {
      setErrored(e.message || C['case-list-fail']);
    }
  };
  // 初次进入加载档案；从建档页回跳（caseId 变化，本页复用不重挂载）时重载并预选新档案
  useEffect(() => {
    if (caseId != null && String(caseId).trim()) setSelId(String(caseId));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);
  // 方法清单到齐 → 默认全选（用户此后的增删不被覆盖）
  useEffect(() => {
    if (!pools) return;
    setNatalKeys(prev => (prev === null ? pools.natal.map(x => x.key) : prev));
  }, [pools]);
  const natalSel = natalKeys || [];
  const natalNames = natalAll.filter(m => natalSel.indexOf(m.key) >= 0).map(m => m.name);
  const natalLabel = natalKeys && natalKeys.length ? hecanLabel('natal', natalKeys.length) : '';
  const toggleNatal = key => setNatalKeys(prev => {
    const cur = prev || [];
    return cur.indexOf(key) >= 0 ? cur.filter(k => k !== key) : cur.concat([key]);
  });
  const selCase = selId ? (list || []).find(c => String(c.caseId) === String(selId)) || null : null;
  const stSel = hecanRunState(selCase);
  const selNm = selCase ? (selCase.name || C['case-prefix'] + selCase.caseId) : '';
  // 该档案已跑过的方法集（GET /cases/{id}/readings：纯读库零 LLM）→ 用于区分「复用旧结果」与「按新选择重跑」
  useEffect(() => {
    if (!selId) {
      setRunSet(null);
      return;
    }
    let alive = true;
    setRunSet(null);
    (async () => {
      try {
        const r = await api('/cases/' + encodeURIComponent(selId) + '/readings');
        const d = (r && r.data) || r || {};
        const keys = [];
        const rows = Array.isArray(d.methods) ? d.methods : [];
        rows.forEach(x => {
          const k = x && x.method_key;
          if (k && keys.indexOf(String(k)) < 0) keys.push(String(k));
        });
        (Array.isArray(d.degraded) ? d.degraded : []).forEach(k => {
          if (k && keys.indexOf(String(k)) < 0) keys.push(String(k));
        });
        if (alive) setRunSet({ ok: true, keys: keys });
      } catch (e) {
        if (alive) setRunSet({ ok: false, msg: (e && e.message) || '' });
      }
    })();
    return () => { alive = false; };
  }, [selId]);
  const sameRunSet = () => {
    if (!runSet || !runSet.ok || !runSet.keys.length) return false;
    if (runSet.keys.length !== natalSel.length) return false;
    return natalSel.every(k => runSet.keys.indexOf(k) >= 0);
  };
  // 有方法可选但一个都没勾 → 阻断（清单读不到时不阻断：按后端默认方法集降级提交）
  const natalBlocked = natalAll.length > 0 && natalSel.length === 0;
  const natalCanStart = stSel.go && !natalBlocked;
  let setNote = C['set-loading'];
  if (runSet && !runSet.ok) setNote = fmtTpl(C['set-fail'], { msg: runSet.msg });
  else if (runSet && runSet.ok) {
    if (!runSet.keys.length) setNote = natalSel.length
      ? fmtTpl(C['set-none-methods'], { cur: natalSel.length })
      : C['set-none'];
    else if (sameRunSet()) setNote = fmtTpl(C['set-reuse-tpl'], { n: runSet.keys.length });
    else setNote = fmtTpl(C['set-diff-tpl'], { old: runSet.keys.length, cur: natalSel.length });
  }
  // —— 档案选择卡片（复用 星座/MBTI 的 case-opt 可选卡样式：明显可选 + 选中态 ✓）——
  let pickBody;
  if (!list && !errored) {
    pickBody = el('div', { style: { textAlign: 'center', color: 'var(--text-2)', padding: '24px 12px', fontSize: 13 } }, C['case-loading']);
  } else if (errored && !(list && list.length)) {
    pickBody = el('div', { className: 'card failed-box', style: { marginTop: 4 } },
      el('div', { className: 'section-title' }, C['case-load-fail']),
      el('div', { className: 'error' }, errored),
      el('div', { className: 'back-row', style: { justifyContent: 'center' } },
        el('button', { className: 'btn btn-primary', style: { width: 'auto' }, onClick: load }, UI_COPY.buttons.retry),
        el('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: () => onNavigate('landing') }, UI_COPY.buttons.back_home)));
  } else if (!list || list.length === 0) {
    pickBody = el('div', { style: { textAlign: 'center', padding: '16px 8px' } },
      el('div', { style: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 10 } }, C['no-case']),
      el('div', { className: 'back-row', style: { justifyContent: 'center' } },
        el('button', { className: 'btn btn-primary', style: { width: 'auto' }, onClick: () => onNavigate('onboarding', { returnTo: 'hecan' }) }, UI_COPY.buttons.create_case),
        el('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: () => onNavigate('cases') }, C['manage-case'])));
  } else {
    // 档案下拉（对齐生肖流年下拉样式：档案名/生日展示、选中即用）；合参状态短标并入选项文本
    pickBody = el('select', {
      className: 'input',
      value: selId || '',
      onChange: e => setSelId(e.target.value),
      style: { marginBottom: 0 }
    }, el('option', { value: '' }, C['select-case-ph']), list.map(c => {
      const st = hecanRunState(c);
      const nm = c.name || C['case-prefix'] + c.caseId;
      const birth = c.birthYear ? fmtTpl(C['birth-year-tpl'], { year: c.birthYear }) : '';
      return el('option', { key: c.caseId, value: String(c.caseId) }, nm + birth + (st.label ? ' · ' + st.label : ''));
    }));
  }
  // —— 方法多选区（清单读不到 → 提示 + 重试；读取中 → 提示；可选 → 药丸多选 + 已选方法集名）——
  let methodsBody;
  if (poolsLoading) {
    methodsBody = el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 } }, C['methods-loading']);
  } else if (poolsFailed) {
    methodsBody = el('div', null,
      el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 8 } }, fmtTpl(C['methods-fail'], { msg: poolsQ.err || '' })),
      el('button', { type: 'button', className: 'btn btn-outline', style: { width: 'auto' }, onClick: poolsQ.reload }, C['methods-retry']));
  } else if (!natalAll.length) {
    methodsBody = el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 } },
      C['methods-empty'], ' ', C['methods-fallback-note']);
  } else {
    methodsBody = el('div', null,
      el(HecanMethodPills, { items: natalAll, selected: natalSel, onToggle: toggleNatal }),
      el('div', { style: { fontSize: 12, fontWeight: 600, marginTop: 6 } },
        natalSel.length ? fmtTpl(C['selected-methods-tpl'], { label: natalLabel, n: natalSel.length }) : C['selected-methods-none']),
      natalBlocked ? el('div', { style: { fontSize: 12, color: 'var(--cinnabar)', fontWeight: 600, marginTop: 4 } }, C['none-selected']) : null);
  }
  // —— 操作区：选中档案后出现两个动作 ——
  const actionCard = el('div', { className: 'card', style: { marginTop: 10 } },
    el('div', { className: 'section-title' }, natalLabel
      ? fmtTpl(C['start-btn-tpl'], { label: natalLabel })
      : C['start-btn-generic']),
    selCase ? el('div', null,
      el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 8 } },
        C['selected-label'], el('b', null, selNm), '（', stSel.label, '）'),
      stSel.view
        ? el('p', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, margin: '0 0 10px' } }, C['already-run'])
        : stSel.go
          ? el('p', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, margin: '0 0 10px' } }, C['ready-text'])
          : el('p', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, margin: '0 0 10px' } }, C['not-paipan']),
      // 复用 / 重跑 的区分说明（依据该档案已跑过的方法集，而非猜测）
      el('p', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, margin: '0 0 10px' } }, setNote),
      el('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        el('button', {
          className: 'btn btn-primary',
          style: { flex: '1 1 190px' },
          disabled: !natalCanStart,
          title: !stSel.go ? C['title-no-paipan'] : (natalBlocked ? C['title-no-methods'] : ''),
          onClick: () => onNavigate('waiting', {
            caseId: selId,
            // 方法集读不到时**不传** methods（后端按默认方法集推演，与接口存在之前一致）
            methods: poolsUnknown ? null : natalSel.slice(),
            methodNames: poolsUnknown ? null : natalNames,
            runLabel: natalLabel || null
          })
        }, [natalLabel ? fmtTpl(C['start-btn-tpl'], { label: natalLabel }) : C['start-btn-generic'], payBadge(payEnough)]),
        el('button', {
          className: 'btn btn-outline',
          style: { flex: '1 1 190px' },
          disabled: !stSel.view,
          title: stSel.view ? '' : C['title-not-run'],
          onClick: () => onNavigate('predict', { caseId: selId })
        }, C['view-btn'])))
      : el('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 } }, C['select-first']),
    el('div', { style: { fontSize: 12, color: 'var(--cinnabar)', fontWeight: 600, marginTop: 8, lineHeight: 1.7 } },
      natalLabel ? fmtTpl(C['cost-note-tpl'], { label: natalLabel }) : C['cost-note-generic']));
  const listActions = list && list.length > 0 ? el('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 2px' } },
    el('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: () => onNavigate('onboarding', { returnTo: 'hecan' }) }, '+ ' + UI_COPY.buttons.create_case),
    el('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: () => onNavigate('cases') }, C['manage-case'])) : null;
  const natalTab = el('div', null,
    el('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['case-note']),
    el('div', { className: 'step-hint' },
      el('span', { className: 'sh' + (selCase ? '' : ' cur') }, C['step-1']),
      el('span', { className: 'sh-arr' }, '→'),
      el('span', { className: 'sh' + (selCase ? ' cur' : '') }, C['step-2'])),
    el('div', { className: 'card' },
      el('div', { className: 'section-title' }, C['pick-title']),
      el('div', { style: { fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 4 } }, C['pick-note']),
      pickBody, listActions),
    el('div', { className: 'card' },
      el('div', { className: 'section-title' }, C['methods-title']),
      el('div', { style: { fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['methods-note']),
      methodsBody),
    actionCard);

  /* ===== 标签②：当下事合参（不要生辰；无断前尘、无问卷校准） ===== */
  const [q, setQ] = useState('');
  const [askedQ, setAskedQ] = useState('');
  const [momentKeys, setMomentKeys] = useState(null);
  const [castMode, setCastMode] = useState('now');
  const [mDate, setMDate] = useState(todayStr());
  const [mShen, setMShen] = useState(nowShichen());
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState('');
  const [mJob, setMJob] = useState(null); // {jobId,label,total,status,completed,data}
  const mTimer = useRef(null);
  useEffect(() => () => clearTimeout(mTimer.current), []);
  useEffect(() => {
    if (!pools) return;
    setMomentKeys(prev => (prev === null ? pools.moment.map(x => x.key) : prev));
  }, [pools]);
  const momentSel = momentKeys || [];
  const momentNames = momentAll.filter(m => momentSel.indexOf(m.key) >= 0).map(m => m.name);
  const momentLabel = momentKeys && momentKeys.length ? hecanLabel('moment', momentKeys.length) : '';
  const toggleMoment = key => setMomentKeys(prev => {
    const cur = prev || [];
    return cur.indexOf(key) >= 0 ? cur.filter(k => k !== key) : cur.concat([key]);
  });
  // 起卦时刻（东八区 ISO）：默认「此刻」= 今天 + 当前时辰；指定模式取用户所选日期/时辰
  const castAt = () => {
    const useNow = castMode === 'now';
    const d = useNow ? todayStr() : mDate;
    const si = useNow ? nowShichen() : mShen;
    const sh = SHICHEN_ARR[si] || SHICHEN_ARR[0];
    return d + 'T' + pad2(sh.start) + ':00:00+08:00';
  };
  // 起卦参数（cast 的形状 = `method_key → seed`，后端 `_normalize_cast` 只接受本次请求的方法）——
  // 逐字对齐「临时起卦」页 run() 的既有种子口径，不自创一套：
  //   梅花易数 / 大六壬：seed.customDate
  //   奇门时家：customDate + 时家 / 转盘 / 拆补（＝临时起卦页的默认起局参数）
  //   小六壬：seed.params.customDate
  //   金口诀：seed.params = { method:'time', customDate }（＝页面默认「时间起课」）
  //   观音灵签 / 潮汕圣杯 / 六爻 / 塔罗 / 雷诺曼：**不传** —— 走引擎默认的「随手抽 / 摇卦 / 掷筊」
  //   （确定性随机成卦，不需要你逐爻录入）；抽牌类引擎默认单张牌阵（spreadType || 'single'）。
  const buildCast = () => {
    const iso = castAt();
    const pick = k => momentSel.indexOf(k) >= 0;
    const out = {};
    if (pick('meihua')) out.meihua = { customDate: iso };
    if (pick('liuren')) out.liuren = { customDate: iso };
    if (pick('qimen')) out.qimen = { customDate: iso, scope: 'hour', qimenMethod: 'zhuanpan', qimenJuMethod: 'chaibu' };
    if (pick('xiaoliuren')) out.xiaoliuren = { params: { customDate: iso } };
    if (pick('jinkoujue')) out.jinkoujue = { params: { method: 'time', customDate: iso } };
    return out;
  };
  const momentBlocked = momentAll.length > 0 && momentSel.length === 0;
  const momentCanRun = momentSel.length > 0 && !mBusy;
  const runMoment = async () => {
    if (mBusy) return;
    const qt = (q || '').trim();
    if (!qt) {
      toast(C['moment-q-required']);
      return;
    }
    if (!momentSel.length) {
      toast(C['none-selected']);
      return;
    }
    if (castMode === 'pick') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(mDate || ''))) {
        toast(C['moment-date-required']);
        return;
      }
      if (!(typeof mShen === 'number' && mShen >= 0 && mShen < SHICHEN_ARR.length)) {
        toast(C['moment-shichen-required']);
        return;
      }
    }
    clearTimeout(mTimer.current);
    setMBusy(true);
    setMErr('');
    setMJob(null);
    setAskedQ(qt);
    try {
      const body = {
        question: qt,
        methods: momentSel.slice(),
        cast: buildCast()
      };
      const r = await api('/combine/moment', { method: 'POST', body: JSON.stringify(body) });
      const d = (r && r.data) || r || {};
      const jobId = d.jobId;
      if (!jobId) throw new Error('no jobId');
      let pollDelay = 2000;
      let last = -1;
      const tick = async () => {
        try {
          const jr = await api('/jobs/' + jobId);
          const jd = (jr && jr.data) || jr || {};
          const done = Number(jd.completed) || 0;
          setMJob({
            jobId: jobId,
            label: jd.label || d.label || momentLabel,
            total: Number(jd.total) || Number(d.total) || momentSel.length,
            status: jd.status,
            completed: done,
            data: jd
          });
          if (done > last) {
            last = done;
            pollDelay = 2000;
          }
          if (jd.status === 'succeeded') {
            setMBusy(false);
            return;
          }
          if (jd.status === 'failed') {
            setMBusy(false);
            setMErr(fmtTpl(C['moment-run-fail'], { msg: jd.error || '' }));
            return;
          }
        } catch (e) {
          setMBusy(false);
          setMErr(fmtTpl(C['moment-job-fail'], { msg: (e && e.message) || '' }));
          return;
        }
        pollDelay = Math.min(pollDelay * 2, 30000);
        mTimer.current = setTimeout(tick, pollDelay);
      };
      mTimer.current = setTimeout(tick, 2000);
    } catch (e) {
      setMBusy(false);
      setMErr(fmtTpl(C['moment-start-fail'], { msg: (e && e.message) || '' }));
    }
  };
  const mData = mJob && mJob.data ? mJob.data : null;
  const mDone = !!(mData && mData.status === 'succeeded');
  const mRes = mData && mData.result && typeof mData.result === 'object' && !Array.isArray(mData.result) ? mData.result : null;
  const mLabel = (mData && mData.label) || (mJob && mJob.label) || momentLabel;
  // 参与方法名与「未成功起卦」的法：以后端作业数据为准（本地清单只作兜底）
  const mNames = mRes && Array.isArray(mRes.methodNames) && mRes.methodNames.length
    ? mRes.methodNames.map(String)
    : momentNames;
  const mFailed = mDone && mRes && Array.isArray(mRes.failed_methods) && mRes.failed_methods.length
    ? mRes.failed_methods.map(k => {
      const hit = momentAll.filter(x => x.key === String(k))[0];
      return hit ? hit.name : String(k);
    })
    : [];
  const mSummary = mDone && mRes && mRes.report && typeof mRes.report.summary === 'string' ? mRes.report.summary.trim() : '';
  const sections = mDone ? hecanMomentSections(mData) : [];
  let momentMethodsBody;
  if (poolsLoading) {
    momentMethodsBody = el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 } }, C['methods-loading']);
  } else if (!momentAll.length) {
    momentMethodsBody = el('div', null,
      el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 8 } },
        fmtTpl(C['methods-fail'], { msg: poolsQ.err || '' })),
      el('button', { type: 'button', className: 'btn btn-outline', style: { width: 'auto' }, onClick: poolsQ.reload }, C['methods-retry']));
  } else {
    momentMethodsBody = el('div', null,
      el(HecanMethodPills, { items: momentAll, selected: momentSel, onToggle: toggleMoment }),
      el('div', { style: { fontSize: 12, fontWeight: 600, marginTop: 6 } },
        momentSel.length ? fmtTpl(C['selected-methods-tpl'], { label: momentLabel, n: momentSel.length }) : C['selected-methods-none']),
      momentBlocked ? el('div', { style: { fontSize: 12, color: 'var(--cinnabar)', fontWeight: 600, marginTop: 4 } }, C['none-selected']) : null);
  }
  const momentResult = mErr ? el('div', { className: 'card failed-box' }, el('div', { className: 'error' }, mErr))
    : mBusy ? el('div', { className: 'card' },
      el('div', { className: 'section-title' }, momentLabel ? fmtTpl(C['moment-submit-tpl'], { label: momentLabel }) : C['moment-submit-generic']),
      el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 } }, C['moment-running']),
      mJob ? el('div', { style: { fontSize: 12, color: 'var(--text-3)', marginTop: 6 } },
        fmtTpl(C['moment-progress-tpl'], { done: mJob.completed || 0, total: mJob.total || momentSel.length })) : null)
      : mDone ? el('div', { className: 'card' },
        el('div', { className: 'section-title' }, mLabel ? fmtTpl(C['moment-result-title-tpl'], { label: mLabel }) : C['moment-result-title-generic']),
        el('div', { style: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 } }, fmtTpl(C['moment-result-question-tpl'], { q: askedQ })),
        el('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, marginBottom: 6 } },
          fmtTpl(C['moment-result-methods-tpl'], { names: mNames.join(' · ') })),
        mFailed.length ? el('div', { style: { fontSize: 12, color: 'var(--cinnabar)', lineHeight: 1.8, marginBottom: 6 } },
          fmtTpl(C['moment-result-failed-tpl'], { names: mFailed.join(' · ') })) : null,
        mSummary ? el('div', { className: 'pair-busy' }, mSummary) : null,
        sections.length
          ? sections.map(s => el('div', { className: 'rd-method', key: s.key },
            s.title ? el('div', { className: 'rd-head' }, el('span', { className: 'rd-name' }, s.title)) : null,
            el('div', { style: { whiteSpace: 'pre-line' } }, s.text || C['moment-section-empty'])))
          : el('div', { className: 'rd-empty' }, C['moment-result-empty']),
        el('div', { style: { fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 10 } }, C['moment-result-note']),
        el('div', { className: 'back-row', style: { marginTop: 8 } },
          el('button', { className: 'btn btn-outline', style: { width: 'auto' }, onClick: () => { setMJob(null); setMErr(''); } }, C['moment-again'])))
        : null;
  const momentTab = el('div', null,
    el('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['moment-scope-note']),
    el('div', { className: 'card' },
      el('div', { className: 'section-title' }, C['moment-q-title']),
      el('div', { style: { fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['moment-q-label']),
      el('input', {
        className: 'input',
        value: q,
        maxLength: 200,
        placeholder: C['moment-q-ph'],
        onChange: e => setQ(e.target.value),
        style: { marginBottom: 0 }
      })),
    el('div', { className: 'card' },
      el('div', { className: 'section-title' }, C['moment-methods-title']),
      el('div', { style: { fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['methods-note']),
      momentMethodsBody),
    el('div', { className: 'card' },
      el('div', { className: 'section-title' }, C['moment-cast-title']),
      el('div', { style: { fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } }, C['moment-cast-note']),
      el('div', { className: 'xlr-tabs' },
        el('button', {
          type: 'button',
          className: 'xlr-tab' + (castMode === 'now' ? ' sel' : ''),
          onClick: () => setCastMode('now')
        }, C['moment-cast-now']),
        el('button', {
          type: 'button',
          className: 'xlr-tab' + (castMode === 'pick' ? ' sel' : ''),
          onClick: () => setCastMode('pick')
        }, C['moment-cast-pick'])),
      castMode === 'pick' ? el('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        el('div', { style: { flex: '1 1 150px' } },
          el('div', { style: { fontSize: 11, color: 'var(--text-3)', marginBottom: 4 } }, C['moment-date-label']),
          el('input', { className: 'input', type: 'date', value: mDate, onChange: e => setMDate(e.target.value), style: { marginBottom: 0 } })),
        el('div', { style: { flex: '1 1 150px' } },
          el('div', { style: { fontSize: 11, color: 'var(--text-3)', marginBottom: 4 } }, C['moment-shichen-label']),
          el('select', { className: 'input', value: String(mShen), onChange: e => setMShen(Number(e.target.value)), style: { marginBottom: 0 } },
            SHICHEN_ARR.map((s, i) => el('option', { key: s.n || i, value: String(i) }, s.n))))) : null),
    el('div', { className: 'card' },
      el('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        el('button', {
          className: 'btn btn-primary',
          style: { flex: '1 1 190px' },
          disabled: !momentCanRun,
          title: momentSel.length ? '' : (momentAll.length ? C['none-selected'] : C['methods-empty']),
          onClick: runMoment
        }, [momentLabel ? fmtTpl(C['moment-submit-tpl'], { label: momentLabel }) : C['moment-submit-generic'], payBadge(payEnough)])),
      el('div', { style: { fontSize: 12, color: 'var(--cinnabar)', fontWeight: 600, marginTop: 8, lineHeight: 1.7 } },
        momentLabel ? fmtTpl(C['moment-cost-tpl'], { label: momentLabel }) : C['moment-cost-generic'])),
    momentResult);

  /* ===== 页头 + 标签切换 ===== */
  const tabBtn = (key, text) => el('button', {
    key: key,
    type: 'button',
    className: 'rt-tab' + (tab === key ? ' on' : ''),
    onClick: () => setTab(key)
  }, text);
  return el('div', { className: 'container' },
    el('div', { className: 'hub-title' }, el(Icon, { name: 'nine', size: 22 }), C['title']),
    el('div', { className: 'readings-tabs' }, tabBtn('natal', C['tab-natal']), tabBtn('moment', C['tab-moment'])),
    el('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6 } },
      tab === 'natal' ? C['tab-natal-note'] : C['tab-moment-note']),
    tab === 'natal' ? natalTab : momentTab,
    el('div', { className: 'back-row' },
      el('button', { className: 'btn btn-outline', onClick: () => onNavigate('guoxue-hub') }, UI_COPY.buttons.back_options),
      el('button', { className: 'btn btn-outline', onClick: () => onNavigate('landing') }, UI_COPY.buttons.back_home)));
}
