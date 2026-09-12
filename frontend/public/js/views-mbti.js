// 心理测试域视图（节110 阶段3）：心理 HUB MbtiHubPage + 人格测试 MbtiPage + 免登录分享 MbtiSharePage
// （MBTI_FIELDS 常量亦被档案页 ArchivePage「档案内心理测试板块」复用，故保持全局可见）
// 加载于 views-xishi.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- 心理测试 HUB（REQ-112：与国学预测 / 西式占卜同级的 Hub 页） ---------- */
// 点击首页「心理测试」进入；Hub 页仅聚合「人格测试」主功能入口（配对解析入口按 REQ-109
// 保留在人格测试页底部操作区，不聚合于此；文案口径：模块名「心理测试」、类型仍称 MBTI 类型）。
function MbtiHubPage({
  onNavigate,
  applySkin
}) {
  const cards = [{
    name: TC_COPY.ui.hub['mbti-name'],
    sub: TC_COPY.ui.hub['mbti-sub'],
    bar: 'var(--skin-accent)',
    ico: 'spark',
    to: () => {
      applySkin('mbti');
      onNavigate('mbti');
    }
  }];
  return React.createElement('div', {
    className: 'container'
  }, React.createElement('div', {
    className: 'hub-title'
  }, React.createElement(Icon, {
    name: 'spark',
    size: 22
  }), TC_COPY.ui.module_hub.mbti_title), React.createElement('div', {
    className: 'hub-grid'
  }, cards.map((c, i) => React.createElement('div', {
    key: i,
    className: 'hub-card',
    onClick: () => c.to()
  }, React.createElement('span', {
    className: 'hc-bar',
    style: {
      background: c.bar
    }
  }), React.createElement(Icon, {
    name: c.ico,
    size: 28,
    className: 'hc-ico'
  }), React.createElement('div', {
    className: 'hc-body'
  }, React.createElement('div', {
    className: 'hc-name'
  }, c.name), React.createElement('div', {
    className: 'hc-sub'
  }, c.sub))))));
}

/* ---------- MBTI 人格测试（后端题库 /api/mbti/questions · 计分 /api/mbti/score · 文案 /api/mbti/results） ---------- */
const ALL_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const MBTI_DIMS = [{k: 'EI', l: 'E', r: 'I'}, {k: 'SN', l: 'S', r: 'N'}, {k: 'TF', l: 'T', r: 'F'}, {k: 'JP', l: 'J', r: 'P'}];
const MBTI_FIELDS = [['strengths', '优势'], ['blindspots', '盲点'], ['career', '职场'], ['relationships', '关系'], ['growth', '成长建议']];
function MbtiPage({
  onNavigate,
  initCaseId
}) {
  const el = React.createElement;
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [view, setView] = useState('quiz'); // quiz | grid | result
  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(true);
  const [qErrored, setQErrored] = useState('');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // [{question_id, choice}]
  const [scoring, setScoring] = useState(false);
  const [scoreErr, setScoreErr] = useState('');
  const [result, setResult] = useState(null); // {id,type,scores,mode:'scored'|'manual'}
  const [info, setInfo] = useState(null); // type_info {alias,strengths,blindspots,career,relationships,growth}
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoErr, setInfoErr] = useState('');
  const [caseList, setCaseList] = useState([]);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseErrored, setCaseErrored] = useState('');
  // REQ-056 v3：选档案阶段与答题阶段分离 —— 勾选档案后一律停留在「选档案 + 操作区」，
  // 点「开始测试」才进入答题；「查看已完成 MBTI 类型」为显式按钮，点击才进结果页
  // （已删除 checkedCase 的「已测档案勾选即自动 setView('result')」直达逻辑，含档案内
  // initCaseId 预选入口：同样落到选档案阶段，由用户自行选择开始测试或查看已完成）。
  const [started, setStarted] = useState(false); // false=选档案阶段（勾选档案后展示操作区）
  // REQ-056①：档案卡片「已测 MBTI 类型 / 未测试」。GET /api/cases 列表项当前不含
  // mbti_type，故前端按 caseId 并行 GET /mbti/results?case_id= 取「最近一条判型」作为
  // 已测类型（与「查看已完成 MBTI 类型」展示口径一致：他人经分享填写的最新记录同样算作已测）；
  // 判空容错：探测失败按未测兜底，不阻塞档案列表。
  const [typeMap, setTypeMap] = useState({}); // {caseId: type}；''=已确认未测
  const [typeLoading, setTypeLoading] = useState(false);
  const [caseId, setCaseId] = useState(initCaseId || null); // 判型结果将回写该档案 case.mbti_type（档案内「MBTI」进入时由 App 传 initCaseId 预选）
  // REQ-047（退回①）：分享入口只看 caseId —— 选档案后即可邀请朋友代填（档案不必是本人作答），
  // 不再限定「答完题 / scored」；shareUrl/shareLoading/shareErr 状态与生成逻辑原样复用。
  const [shareUrl, setShareUrl] = useState(null); // 完整分享链接（window.location.origin + d.url）
  const [shareLoading, setShareLoading] = useState(false);
  const [shareErr, setShareErr] = useState('');
  const total = questions && questions.length ? questions.length : 0;
  // —— 拉取题库（GET /api/mbti/questions）——
  const load = async () => {
    setQLoading(true);
    setQErrored('');
    try {
      const res = await api('/mbti/questions');
      const d = res && res.data || res || {};
      const list = d.questions || [];
      if (!list.length) throw new Error('题库为空');
      setQuestions(list);
    } catch (e) {
      setQErrored(e && e.message || UI_COPY.mbti['qbank-load-fail']);
    } finally {
      setQLoading(false);
    }
  };
  // —— 拉取档案列表（GET /api/cases）：判型需写入档案 mbti_type ——
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
      setCaseErrored(e && e.message ? e.message : UI_COPY.mbti['case-load-fail']);
    } finally {
      setCaseLoading(false);
    }
  };
  // —— REQ-056①：按 caseId 批量探测「已测类型」（GET /mbti/results?case_id= 最近一条）——
  // 逐档案并行请求，任一条失败不影响其余（判空容错：失败/无记录 → 未测）。
  const probeTypes = async list => {
    const arr = (list || []).filter(c => c && c.caseId != null);
    if (!arr.length) {
      setTypeMap({});
      setTypeLoading(false);
      return;
    }
    setTypeLoading(true);
    await Promise.all(arr.map(async c => {
      const k = String(c.caseId);
      let t = '';
      try {
        const rr = await api('/mbti/results?case_id=' + encodeURIComponent(k));
        const items = rr && rr.data && rr.data.items || (rr && rr.items) || [];
        const latest = items && items.length ? items[0] : null;
        t = latest && latest.type ? String(latest.type).toUpperCase() : '';
      } catch (e) {
        t = ''; // 探测失败按未测兜底
      }
      setTypeMap(prev => Object.assign({}, prev, {[k]: t}));
    }));
    setTypeLoading(false);
  };
  // 档案卡片的「已测 MBTI 类型」展示值：优先档案自带 mbti_type（后端列表若未来回传直接读），
  // 否则用 typeMap 探测值；返回 null = 尚未探测到（typeLoading 期间卡片显示占位）。
  const caseTypeOf = c => {
    if (!c || c.caseId == null) return '';
    const own = c.mbti_type ? String(c.mbti_type).trim().toUpperCase() : '';
    if (own) return own;
    const k = String(c.caseId);
    return Object.prototype.hasOwnProperty.call(typeMap, k) ? typeMap[k] : null;
  };
  // 惰性探测：仅当「选档案阶段」实际在展示（view=quiz 且未开考）且档案列表就绪时，
  // 才按当前列表批量探测一次（同一份列表不重复探测）；进入即预选（initCaseId）或
  // 勾选档案都停留在选档案阶段，同样触发探测以正确标注「已测类型/未测试」标签。
  // 同会话内判型结果由 submitScore / viewExisting 即时刷新角标。
  const probedKey = useRef(null);
  useEffect(() => {
    if (view !== 'quiz' || started || caseLoading || !caseList.length) return;
    const key = caseList.map(c => c.caseId).join(',');
    if (probedKey.current === key) return;
    probedKey.current = key;
    probeTypes(caseList);
  }, [view, started, caseList, caseLoading]);
  useEffect(() => {
    load();
    loadCases();
  }, []);
  // 前端改造：已删除 checkedCase 的「勾选已测档案即自动 setView('result')」直达逻辑，
  // 查看已完成结果改为下方操作区的显式按钮（viewExisting，见选档案阶段渲染）——
  // 普通勾选与档案内 MBTI（initCaseId 预选）一律先落在选档案阶段，不自动进结果/答题。
  // 本 effect 仅保留 caseId 变更时的串档清理（分享链接/旧结果/旧文案归零）。
  const checkedCase = useRef(null);
  useEffect(() => {
    if (caseId == null || checkedCase.current === String(caseId)) return;
    checkedCase.current = String(caseId);
    // REQ-047（退回①）：caseId 变更（换档案）即清空上一档案生成的分享链接与旧结果态，
    // 防止分享链接/结果跨档案串用
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
    setResult(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoreErr('');
  }, [caseId]);
  // —— 拉取判型文案（GET /api/mbti/results/{id}）——
  const fetchInfo = async id => {
    if (!id) return;
    setInfoLoading(true);
    setInfoErr('');
    try {
      const rr = await api('/mbti/results' + '/' + encodeURIComponent(id));
      const dd = rr && rr.data || rr || {};
      setInfo(dd.type_info || null);
    } catch (e) {
      setInfoErr(e && e.message || UI_COPY.mbti['info-load-fail']);
    } finally {
      setInfoLoading(false);
    }
  };
  // —— 查看已完成 MBTI 类型：操作区显式按钮（替代旧「勾选已测档案自动直达结果页」）——
  // 取该档案最近一条判型 {type,scores} 并 fetchInfo 拉五栏评语；无记录则 toast 提示不进入。
  const viewExisting = async () => {
    if (caseId == null) return;
    try {
      const rr = await api('/mbti/results?case_id=' + encodeURIComponent(caseId));
      const items = rr && rr.data && rr.data.items || (rr && rr.items) || [];
      const latest = items && items.length ? items[0] : null;
      if (!latest || !latest.type) {
        toast(UI_COPY.mbti['no-test']);
        return;
      }
      // 同步刷新该档案「已测类型」角标（含他人分享填写的最新记录口径）
      setTypeMap(prev => Object.assign({}, prev, {[String(caseId)]: String(latest.type).toUpperCase()}));
      setResult({
        id: latest.id != null ? latest.id : null,
        type: latest.type,
        scores: latest.scores || {},
        mode: 'scored'
      });
      setInfo(null);
      setInfoLoading(false);
      setInfoErr('');
      setScoreErr('');
      setView('result');
      if (latest.id != null) fetchInfo(latest.id);
    } catch (e) {
      toast(e && e.message || UI_COPY.mbti['result-read-fail']);
    }
  };
  // —— 提交答案并判型（POST /api/mbti/score，case_id 必填；判型结果回写档案 mbti_type）——
  const submitScore = async list => {
    if (!list || !total || list.length !== total) return;
    if (!caseId) {
      setScoreErr(UI_COPY.mbti['select-case-first']);
      return;
    }
    setScoring(true);
    setScoreErr('');
    try {
      const res = await api('/mbti/score', {
        method: 'POST',
        body: JSON.stringify({
          case_id: Number(caseId),
          answers: list
        })
      });
      const d = res && res.data || res || {};
      if (!d || !d.type) throw new Error(d && d.message || UI_COPY.mbti['score-fail']);
      // 判型成功同步刷新该档案卡片「已测类型」角标（同一会话内不必重进列表）
      setTypeMap(prev => Object.assign({}, prev, {[String(caseId)]: String(d.type).toUpperCase()}));
      setResult({id: d.id || null, type: d.type, scores: d.scores || {}, mode: 'scored'});
      setInfo(null);
      setInfoLoading(false);
      setInfoErr('');
      setView('result');
      if (d.id) fetchInfo(d.id);
    } catch (e) {
      setScoreErr(e && e.message || UI_COPY.mbti['score-fail']);
    } finally {
      setScoring(false);
    }
  };
  // 点击选项：记录该题答案（{question_id, choice}）并自动进入下一题；最后一题则自动判型
  const choose = key => {
    if (scoring || !total) return;
    if (!caseId) {
      toast(UI_COPY.mbti['select-case-result']);
      return;
    }
    const q = questions[idx];
    if (!q) return;
    const next = answers.slice();
    next[idx] = {question_id: q.id, choice: key};
    setAnswers(next);
    if (idx + 1 < total) setIdx(idx + 1); else submitScore(next);
  };
  // —— 回到阶段 1：清空答案与结果 ——
  // REQ-056 v2：reset() 语义为「重新测试」→ 直接回到答题流程（started 置 true，
  // 不再回落到选档案操作区；若 caseId 为空则仍由选档案阶段接管）。
  const reset = () => {
    setView('quiz');
    setStarted(true);
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoring(false);
    setScoreErr('');
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
  };
  // —— 回到选档案阶段（更换档案 / 选择其它档案）：清空所选档案与判型态 ——
  const pickAnother = () => {
    setView('quiz');
    setStarted(false);
    setCaseId(null);
    checkedCase.current = null; // 重开选档案阶段：列表重新按档案探测已测类型（含再勾选已测档案）
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoring(false);
    setScoreErr('');
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
  };
  // —— 我已知道类型：直接输入（BUG-005：拉取 GET /api/mbti/types/{type_code} 的类型详解，不再固定"暂无文案"）——
  const pickType = async t => {
    setResult({id: null, type: t, scores: null, mode: 'manual'});
    setInfo(null);
    setInfoLoading(true);
    setInfoErr('');
    setView('result');
    try {
      const rr = await api('/mbti/types' + '/' + encodeURIComponent(t));
      const dd = rr && rr.data || rr || {};
      setInfo(dd.type_info || null);
      if (!dd.type_info) setInfoErr(UI_COPY.mbti['no-info']);
    } catch (e) {
      setInfoErr(e && e.message || UI_COPY.mbti['info-load-fail']);
    } finally {
      setInfoLoading(false);
    }
  };
  // —— REQ-047：生成分享链接（POST /api/mbti/share，需鉴权；后端返回相对路径 /mbti/share/{token}）——
  const shareResult = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    setShareErr('');
    try {
      const res = await api('/mbti/share', {
        method: 'POST',
        body: JSON.stringify({
          case_id: Number(caseId)
        })
      });
      const d = res && res.data || res || {};
      if (!d || !d.token || !d.url) throw new Error(d && d.message || UI_COPY.mbti['share-fail']);
      setShareUrl(window.location.origin + d.url);
    } catch (e) {
      setShareErr(e && e.message || UI_COPY.mbti['share-fail']);
    } finally {
      setShareLoading(false);
    }
  };
  // —— 复制分享链接：优先 Clipboard API，失败回退 window.prompt 供手动复制 ——
  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast(UI_COPY.mbti['link-copied']);
        return;
      }
    } catch (e) {/* 走下方回退 */}
    try {
      window.prompt('请复制以下分享链接：', shareUrl);
    } catch (e) {/* prompt 不可用则仅提示 */}
    toast(UI_COPY.mbti['link-copy-manual']);
  };
  // —— 五栏文案值 → 段落行数组（兼容 string / string[] / 换行分隔）——
  const toLines = v => {
    const out = [];
    const push = s => {
      if (s == null) return;
      String(s).split('\n').forEach(x => {
        x = x.trim();
        if (x) out.push(x);
      });
    };
    if (Array.isArray(v)) v.forEach(push); else push(v);
    return out;
  };
  const cur = view === 'quiz' && total ? questions[idx] : null;
  const isManual = result && result.mode === 'manual';
  // BUG-005：无论 scored / manual，只要 info 就展示别名；manual 拉取中则显示加载中
  const alias = info && info.alias ? info.alias : infoLoading && !info ? UI_COPY.mbti.loading : '—';
  // —— 结果页：单维双向比例条（左端计数 / 右端计数 / 中间双向填充）——
  const bar = d => {
    const s = result && result.scores ? result.scores[d.k] || {} : {};
    const lc = s[d.l] || 0;
    const rc = s[d.r] || 0;
    const sum = lc + rc || 1;
    const lp = Math.round(lc / sum * 100);
    const rp = 100 - lp;
    return el('div', {key: d.k, className: 'mbti-bar'},
      el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 44, textAlign: 'left'}}, d.l + ' ' + lc),
      el('span', {className: 'bb-track'},
        el('span', {className: 'bb-fill', style: {left: 0, width: lp + '%', background: 'var(--skin-accent)'}}),
        el('span', {className: 'bb-fill', style: {right: 0, width: rp + '%', background: 'var(--skin-accent-soft)'}})),
      el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 44, textAlign: 'right'}}, d.r + ' ' + rc));
  };
  // —— 结果页：16 型宫格（仅当前结果，点其它类型提示敬请期待）——
  const typeGrid = (t) => el('div', {className: 'mbti-grid', style: {marginTop: 10}}, ALL_TYPES.map(x =>
    el('div', {key: x, className: 'mbti-cell' + (x === t ? ' cur' : ''), onClick: () => { if (x !== t) toast('查看其它类型敬请期待'); }}, x)));
  // —— REQ-056④：分享测试链接 —— 不再顶部常驻，仅在「勾选档案后的操作区」展示
  // （仍复用 shareResult / copyShare / shareUrl / shareErr / shareLoading 原逻辑）。
  const shareZone = el('div', {style: {display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%'}},
    shareUrl ? el(React.Fragment, null,
      el('span', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600}}, UI_COPY.mbti['share-link-title']),
      el('input', {readOnly: true, value: shareUrl, onFocus: e => e.target.select(), title: shareUrl,
        style: {flex: '1 1 160px', minWidth: 0, fontSize: 12, color: 'var(--text-2)', border: '1px solid var(--border)', background: 'var(--paper)', borderRadius: 8, padding: '6px 10px', outline: 'none'}}),
      el('button', {type: 'button', className: 'btn btn-outline', style: {width: 'auto', flex: 'none', fontSize: 13}, onClick: copyShare}, '复制'))
    : el(React.Fragment, null,
        shareErr ? el('div', {className: 'error', style: {width: '100%', textAlign: 'left', margin: '0 0 4px'}}, shareErr) : null,
        el('span', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600}}, UI_COPY.mbti['share-link-title']),
        el('button', {type: 'button', className: 'btn btn-outline', style: {width: 'auto', fontSize: 13}, onClick: shareResult}, shareLoading ? '生成中…' : '生成分享链接')),
    el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, width: '100%'}},
      '生成该档案专属链接：他人免登录填写后，档案当前心理测试结果将更新为最新填写内容，各次填写保留可回看。'));
  // —— 结果页主体 ——
  let body;
  if (view === 'grid') {
    body = el('div', {className: 'card'},
      el('div', {className: 'section-title'}, '选择你的人格类型'),
      el('div', {className: 'grid16'}, ALL_TYPES.map(t =>
        el('div', {key: t, className: 'g', onClick: () => pickType(t)}, t))),
      total > 0 ? el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('quiz')}, '返回答题')) : qErrored ? el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => {
          setView('quiz');
          load();
        }}, '返回重试题库')) : null);
  } else if (view === 'result' && result) {
    const t = result.type || 'INTJ';
    // BUG-005：优先渲染 info 五栏文案（无论 scored / manual）；仅当 isManual 且无 info 时显示手动占位提示
    const colsCard = info ? el('div', {className: 'card'}, MBTI_FIELDS.map(f => {
          const lines = toLines(info[f[0]]);
          return el('div', {key: f[0], style: {margin: '6px 0'}},
            el('div', {className: 'section-title', style: {marginBottom: 4}}, f[1]),
            lines.length ? lines.map((x, i) => el('p', {key: i, style: {fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8}}, '· ' + x)) : el('p', {style: {fontSize: 13, color: 'var(--text-3)'}}, '—'));
        }))
      : isManual ? el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}}, '（手动输入类型，暂无详细文案）')
      : el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}},
          infoLoading ? '类型文案加载中…' : (infoErr || '暂无类型文案'), result.id ? el('div', {className: 'back-row', style: {justifyContent: 'center'}},
            el('button', {className: 'btn btn-outline', style: {width: 'auto', fontSize: 13}, onClick: () => fetchInfo(result.id)}, '重新加载文案')) : null);
    const barsCard = isManual || !result.scores ? el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}}, '手动输入类型（未答题），暂无倾向数据')
      : el('div', {className: 'card'},
          el('div', {className: 'section-title'}, '四维倾向（各维度答题数）'),
          MBTI_DIMS.map(bar));
    // REQ-056④：分享入口不再放结果页/顶部，仅存在于「勾选档案后的操作区」，
    // 此处保持纯结果展示；结果页底部提供「重新测试」（reset 回到答题）与返回选档案入口。
    body = el(React.Fragment, null,
      el('div', {className: 'card', style: {textAlign: 'center'}},
        el('div', {className: 'mbti-type-big'}, t),
        el('div', {className: 'mbti-alias'}, alias),
        isManual ? el('div', {style: {fontSize: 12, color: 'var(--text-3)'}}, '手动输入类型') : null),
      barsCard, colsCard,
      el('div', {className: 'card'},
        el('div', {className: 'section-title'}, '16 型人格'),
        typeGrid(t)),
      el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: reset}, '重新测试'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: pickAnother}, '选择其它档案'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else {
    // —— 阶段 1：答题 ——
    if (qLoading) {
      body = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '28px 16px'}}, '题库加载中…');
    } else if (qErrored) {
      body = el('div', {className: 'card failed-box'},
        el('div', {className: 'section-title'}, '题库加载失败'),
        el('div', {className: 'error'}, qErrored),
        el('div', {className: 'back-row', style: {justifyContent: 'center'}},
          el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: load}, UI_COPY.buttons.retry),
          el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, '我已知道类型，直接输入')));
    } else if (!cur) {
      body = el('div', {className: 'card failed-box'}, el('div', {className: 'section-title'}, '题库为空'));
    } else if (!started || !caseId) {
      // REQ-056 v3 选档案阶段：判型结果需回写档案 mbti_type；勾选档案后停留本阶段
      // （下方「档案操作」区出现：开始测试 / 查看已完成 MBTI 类型(仅已测) / 我已知道类型 /
      // 新建档案 / 管理档案 + 分享测试链接），不自动进入答题或结果页。
      let gate = null;
      if (caseLoading) {
        gate = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '24px 16px'}}, '档案列表加载中…');
      } else if (caseErrored && !caseList.length) {
        gate = el('div', {className: 'card failed-box'},
          el('div', {className: 'section-title'}, '档案列表加载失败'),
          el('div', {className: 'error'}, caseErrored),
          el('div', {className: 'back-row', style: {justifyContent: 'center'}},
            el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: loadCases}, UI_COPY.buttons.retry)));
      } else if (!caseList.length) {
        gate = el('div', {className: 'card', style: {textAlign: 'center', padding: '22px 16px'}},
          el('div', {style: {fontSize: 15, fontWeight: 700, marginBottom: 8}}, '请先在国学预测中建档'),
          el('p', {style: {fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 4}}, '测试结果会写入所选档案。你还没有任何档案，请先建立一份出生档案再回来测试。'),
          el('div', {className: 'back-row', style: {justifyContent: 'center'}},
            el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => onNavigate('onboarding', {returnTo: 'mbti'})}, '去建档'),
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('cases')}, '管理档案'),
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, '我已知道类型，直接输入')));
      } else {
        // —— REQ-056①：档案卡片 = 档案名称 + 出生 meta + 「已测 MBTI 类型 / 未测试」标签 ——
        const selCase = caseId != null ? (caseList.find(c => Number(c.caseId) === Number(caseId)) || null) : null;
        const selNm = selCase ? (selCase.name || '档案 ' + selCase.caseId) : '';
        const selTval = selCase ? caseTypeOf(selCase) : ''; // 已测类型：非空才展示「查看已完成 MBTI 类型」按钮
        gate = el(React.Fragment, null,
          el('div', {className: 'card'},
            el('div', {className: 'section-title'}, '选择档案 · 心理测试'),
            el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6}}, '判型结果将写入所选档案。勾选档案后不会自动进入答题或结果页，请从下方操作区选择「开始测试」或「查看已完成测试结果」（已测档案才显示）。'),
            el('div', {className: 'step-hint'},
              el('span', {className: 'sh cur'}, '① 选择档案'),
              el('span', {className: 'sh-arr'}, '→'),
              el('span', {className: 'sh'}, '② 开始测试 / 查看已完成结果')),
            el('select', {className: 'input', value: caseId != null ? String(caseId) : '', onChange: e => { const id = e.target.value; if (!id) return; const c = caseList.find(x => Number(x.caseId) === Number(id)); setStarted(false); setCaseId(c ? c.caseId : id); }, style: {marginBottom: 0}},
              el('option', {value: ''}, '请选择档案'),
              caseList.map(c => {
                const nm = c.name || '档案 ' + c.caseId;
                const tval = caseTypeOf(c); // 已测类型 / ''=已确认未测 / null=探测中
                const tTxt = tval ? '已测 ' + tval : (tval === null && typeLoading) ? '检测中…' : '未测试';
                return el('option', {key: c.caseId, value: String(c.caseId)},
                  nm + (c.birthYear ? '（' + c.birthYear + ' 年生）' : '') + ' · ' + tTxt);
              }))),
          // —— REQ-056②④ 操作区：勾选档案（caseId 非空）后出现完整操作；「分享测试链接」
          // 仅在此操作区展示（不再顶部常驻），仍复用 shareResult/copyShare/shareUrl/shareErr ——
          el('div', {className: 'card', style: {marginTop: 10}},
            el('div', {className: 'section-title'}, '档案操作'),
            selCase ? el(React.Fragment, null,
              el('div', {style: {fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10}}, '已选档案：' + selNm),
              el('div', {style: {display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%', paddingBottom: 10, marginBottom: 10, borderBottom: '1px dashed var(--border)'}}, shareZone))
              : el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 10}}, '请先勾选上方一份档案：勾选后停留本操作区，可点「开始测试」答题；已测档案可再点「查看已完成测试结果」回看结果（不自动进入）。'),
            el('div', {className: 'back-row', style: {justifyContent: 'center', margin: 0}},
              el('button', {className: 'btn btn-primary', style: {width: 'auto'}, disabled: !selCase, title: selCase ? '' : '请先勾选档案', onClick: () => setStarted(true)}, UI_COPY.buttons.start_quiz),
              selTval ? el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: viewExisting}, '查看已完成测试结果') : null,
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, '我已知道类型，直接输入'),
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('onboarding', {returnTo: 'mbti'})}, UI_COPY.buttons.create_case),
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('cases')}, '管理档案')),
            // REQ-109：MBTI「配对解析」入口移至底部操作区（原 REQ-082④「档案操作」与「选择档案」
            // 之间的条状入口已移除），样式对齐 REQ-108 星座入口：横跨屏幕大按键（功能标题 + 解释文字）
            el('button', {type: 'button', className: 'pair-big', style: {marginTop: 12, marginBottom: 0}, onClick: () => openPairAnalyze({module: 'mbti'})},
              el('span', {className: 'pb-title'}, el(Icon, {name: 'spark', size: 20, color: 'var(--skin-accent)'}), '配对解析', payBadge(payEnough)),
              el('span', {className: 'pb-sub'}, '选择两份已测心理测试档案，基于双方人格信息解读两人相处与协作（付费 LLM，按实际用量扣余额 ¥）'))));
      }
      body = gate;
    } else {
      const answered = Math.min(answers.length, total);
      const pct = total ? Math.round(answered / total * 100) : 0;
      body = el('div', {className: 'card'},
        el('div', {style: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-3)', marginBottom: 2}},
          el('span', null, '第 ' + (idx + 1) + ' / ' + total + ' 题'),
          el('span', {style: {display: 'flex', gap: 10, alignItems: 'center'}},
            el('button', {style: {fontSize: 12, color: 'var(--skin-accent)', fontWeight: 600}, onClick: pickAnother}, '更换档案'),
            el('button', {style: {fontSize: 12, color: 'var(--skin-accent)', fontWeight: 600}, onClick: () => setView('grid')}, '我已知道类型，直接输入'))),
        el('div', {className: 'mbti-progress'}, el('i', {style: {width: pct + '%'}})),
        scoring ? el('div', {style: {textAlign: 'center', color: 'var(--text-2)', padding: '18px 0'}}, '判型中…') : el(React.Fragment, null,
          el('div', {style: {fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.6, margin: '10px 0'}}, cur.text),
          el('div', {style: {display: 'flex', flexDirection: 'column', gap: 10}},
            (cur.options || []).map(o => el('button', {key: o.key, className: 'btn btn-outline', onClick: () => choose(o.key)}, o.key + '. ' + o.text))),
          el('div', {className: 'back-row'},
            idx > 0 ? el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setIdx(idx - 1)}, '上一题') : null,
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => {
              setIdx(0);
              setAnswers([]);
              setScoreErr('');
            }}, '重新开始'))),
        scoreErr ? el('div', {className: 'card failed-box', style: {margin: '10px 0 0'}},
          el('div', {className: 'section-title'}, '判型失败'),
          el('div', {className: 'error'}, scoreErr),
          el('div', {className: 'back-row', style: {justifyContent: 'center'}},
            el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => submitScore(answers)}, '重试判型'),
            idx > 0 ? el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setIdx(idx - 1)}, '返回上一题') : null,
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: reset}, '重新开始'))) : null);
    }
  }
  return el('div', {className: 'container'},
    el('div', {className: 'hub-title'}, el(Icon, {name: 'spark', size: 22}), ' 人格测试'),
    el('div', {style: {fontSize: 12, color: 'var(--text-3)', marginBottom: 4}}, '16 型人格测评 · 60 题 · 判型与文案由后端接口提供'),
    body);
}

/* ---------- REQ-047：免登录分享答题页（/mbti/share/{token} 直达 · 公开免登录） ---------- */
function MbtiSharePage({
  token,
  onNavigate
}) {
  const el = React.createElement;
  // REQ-066④：分享表单太初 UI —— share_taichu_ui 开 → 答题表单内显示太初 logo、登录注册与免责提示；
  // 关 → 仅表单（填完仅保存结果；访客会话隔离与受限页拦截由 BUG-011 / BUG-002 负责）。
  const shareUiOn = TC_SETTINGS.share_taichu_ui !== false;
  const shareBrand = shareUiOn ? el('div', {className: 'tc-share-brand'},
    el('div', {className: 'tc-share-brand-head'},
      el(Icon, {name: 'spark', size: 18}),
      el('span', {className: 'tc-share-brand-name'}, UI_COPY.brand.name),
      el('span', {className: 'tc-share-brand-tag'}, UI_COPY.brand.tagline)),
    el('div', {className: 'tc-share-brand-note'}, UI_COPY.landing.disclaimer_short),
    el('div', {className: 'tc-share-brand-links'},
      el('button', {type: 'button', className: 'btn btn-outline', onClick: () => onNavigate('auth')}, '登录 / 注册'),
      el('button', {type: 'button', className: 'btn btn-outline', onClick: () => onNavigate('landing')}, '了解太初'))) : null;
  const [caseName, setCaseName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // [{question_id, choice}]
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null); // {type, scores}
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const total = questions && questions.length ? questions.length : 0;
  // BUG-009 加固①：token 判空/去空白 —— 直接访问 /mbti/share 无 token、或 token 在路由/传参环节
  // 丢失时，立即按「分享链接无效」渲染（见下方 !tk 分支），绝不发起 /mbti/share/undefined 之类请求。
  const tk = token && String(token).trim() ? String(token).trim() : '';
  const base = tk ? '/mbti/share/' + encodeURIComponent(tk) : null;
  // —— 拉取分享题库（GET /api/mbti/share/{token}，免登录；BUG-011：noAuth 强制不带 Authorization）——
  useEffect(() => {
    let alive = true;
    if (!tk) {
      setLoading(false);
      setErrored('分享链接无效');
      return () => { alive = false; };
    }
    (async () => {
      setLoading(true);
      setErrored('');
      try {
        const res = await api(base, {noAuth: true});
        const d = res && res.data || res || {};
        const list = d.questions || [];
        if (!list.length) throw new Error('题库为空');
        if (alive) {
          setCaseName(d.case_name || '');
          setQuestions(list);
        }
      } catch (e) {
        // 404（code1002）/ 网络失败 → 统一按「链接失效」提示
        if (alive) setErrored('分享链接不存在或已失效');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tk]);
  // —— 提交答案并判型（POST /api/mbti/share/{token}/score，免登录；BUG-011：noAuth 强制不带 Authorization）——
  const submitShare = async list => {
    if (!list || !total || list.length !== total) return;
    setScoring(true);
    try {
      const res = await api(base + '/score', {
        method: 'POST',
        noAuth: true,
        body: JSON.stringify({
          answers: list
        })
      });
      const d = res && res.data || res || {};
      if (!d || !d.type) throw new Error(d && d.message || UI_COPY.mbti['score-fail']);
      setResult({
        type: d.type,
        scores: d.scores || {}
      });
    } catch (e) {
      // 保留在最后一题，用户可重新点选项重试
      toast(e && e.message || UI_COPY.mbti['score-fail']);
    } finally {
      setScoring(false);
    }
  };
  // 点击选项：记录该题答案并自动下一题；最后一题则自动提交判型
  const choose = key => {
    if (scoring || !total) return;
    const q = questions[idx];
    if (!q) return;
    const next = answers.slice();
    next[idx] = {
      question_id: q.id,
      choice: key
    };
    setAnswers(next);
    if (idx + 1 < total) setIdx(idx + 1); else submitShare(next);
  };
  // —— 再测一次：清空答案与结果 ——
  const reset = () => {
    setIdx(0);
    setAnswers([]);
    setScoring(false);
    setResult(null);
    setErrored('');
  };
  let body;
  if (!tk) {
    // BUG-009 加固①（渲染兜底）：token 为空/缺失 → 不等 effect、不闪 loading，直接渲染「无法打开分享」
    body = el('div', {className: 'card failed-box'},
      el('div', {className: 'section-title'}, '无法打开分享'),
      el('div', {className: 'error'}, '分享链接无效（缺少链接参数）'),
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (result) {
    const t = result.type || 'INTJ';
    // —— 单维双向比例条（复用 MbtiPage 视觉）——
    const bar = d => {
      const s = result.scores ? result.scores[d.k] || {} : {};
      const lc = s[d.l] || 0;
      const rc = s[d.r] || 0;
      const sum = lc + rc || 1;
      const lp = Math.round(lc / sum * 100);
      const rp = 100 - lp;
      return el('div', {key: d.k, className: 'mbti-bar'},
        el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 44, textAlign: 'left'}}, d.l + ' ' + lc),
        el('span', {className: 'bb-track'},
          el('span', {className: 'bb-fill', style: {left: 0, width: lp + '%', background: 'var(--skin-accent)'}}),
          el('span', {className: 'bb-fill', style: {right: 0, width: rp + '%', background: 'var(--skin-accent-soft)'}})),
        el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 44, textAlign: 'right'}}, d.r + ' ' + rc));
    };
    const barsCard = result.scores ? el('div', {className: 'card'},
      el('div', {className: 'section-title'}, '四维倾向（各维度答题数）'),
      MBTI_DIMS.map(bar)) : null;
    // 简化展示：大字类型 + 「结果已记录」；如需完整五栏文案可在后续复用 GET /api/mbti/types/{type}
    body = el(React.Fragment, null,
      el('div', {className: 'card', style: {textAlign: 'center'}},
        el('div', {className: 'mbti-type-big'}, t),
        el('div', {className: 'mbti-alias'}, caseName ? '已完成「' + caseName + '」的测评 · 结果已记录' : '测评完成 · 结果已记录')),
      barsCard,
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: reset}, '再测一次'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (loading) {
    body = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '28px 16px'}}, '分享题库加载中…');
  } else if (errored) {
    body = el('div', {className: 'card failed-box'},
      el('div', {className: 'section-title'}, '无法打开分享'),
      el('div', {className: 'error'}, errored),
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (!total) {
    body = el('div', {className: 'card failed-box'}, el('div', {className: 'section-title'}, '题库为空'));
  } else {
    // —— 免登录答题视图 ——
    // BUG-009 加固②：questions[idx] 可能为 undefined（idx 越界 / 数据异常），
    // 先判空再渲染，避免 q.text 抛错导致整页白屏。
    const q = questions[idx] || null;
    if (!q) {
      body = el('div', {className: 'card failed-box'},
        el('div', {className: 'section-title'}, '题目加载异常'),
        el('div', {className: 'error'}, '当前题目不存在，请重新开始。'),
        el('div', {className: 'back-row', style: {justifyContent: 'center'}},
          el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => {
            setIdx(0);
            setAnswers([]);
          }}, '重新开始')));
    } else {
      const opts = q.options || [];
      const answered = Math.min(answers.length, total);
      const pct = total ? Math.round(answered / total * 100) : 0;
      body = el('div', {className: 'card'},
        el('div', {style: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-3)', marginBottom: 2}},
          el('span', null, '第 ' + (idx + 1) + ' / ' + total + ' 题'),
          el('span', {style: {display: 'flex', gap: 10, alignItems: 'center'}},
            el('button', {style: {fontSize: 12, color: 'var(--skin-accent)', fontWeight: 600}, onClick: () => {
              setIdx(0);
              setAnswers([]);
            }}, '重新开始'))),
        el('div', {className: 'mbti-progress'}, el('i', {style: {width: pct + '%'}})),
        scoring ? el('div', {style: {textAlign: 'center', color: 'var(--text-2)', padding: '18px 0'}}, '判型中…') : el(React.Fragment, null,
          el('div', {style: {fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.6, margin: '10px 0'}}, q.text),
          el('div', {style: {display: 'flex', flexDirection: 'column', gap: 10}},
            opts.length ? opts.map(o => el('button', {key: o.key, className: 'btn btn-outline', onClick: () => choose(o.key)}, o.key + '. ' + o.text))
              : el('div', {style: {fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0'}}, '该题缺少选项，请点击右上角「重新开始」')),
          idx > 0 ? el('div', {className: 'back-row'},
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setIdx(idx - 1)}, '上一题')) : null));
    }
  }
  // REQ-066④：品牌条仅在「答题表单视图」出现（loading/失败/结果/无效链接时不渲染）
  const inForm = !!tk && !result && !loading && !errored && total > 0 && !!questions[idx];
  return el('div', {className: 'container'},
    el('div', {className: 'hub-title'}, el(Icon, {name: 'spark', size: 22}), ' 人格测试'),
    caseName && !result ? el('div', {style: {fontSize: 13, color: 'var(--text-2)', marginBottom: 2}}, '为「' + caseName + '」填写心理测试') : null,
    inForm && shareUiOn ? el('div', {className: 'card', style: {padding: '14px 20px 10px', margin: '12px 0 0'}}, shareBrand) : null,
    body);
}