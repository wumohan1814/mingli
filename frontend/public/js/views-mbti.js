// 心理测试域视图（节110 阶段3 / 节124 大五重写 / 节140 T3d 去 HUB）：人格测试 MbtiPage + 免登录分享 MbtiSharePage
// 节124（2026-09-14）：题库已由后端切换为 IPIP-NEO-300 大五人格（节123），本文件随之重写——
//   ① 答题 UI 由「二选一」改为「5 点量表」（选项文案取 GET /api/mbti/questions 的 scale）
//   ② 结果页 = 大五（OCEAN）五维条形图 + 四字母「类型倾向对照」（次级、带边界标注）+ 脚注免责
//   ③ 判型不再回写档案（节125：档案人格类型只存用户认定过的值）→ 结果页提供「保存为我的类型」动作
//      （POST /api/mbti/save-type）；「我已知道类型，直接输入」同样走 save-type 落库
//   ④ 答题进度存 localStorage（300 题防丢失，零后端存储）
// （MBTI_FIELDS 常量亦被档案页 ArchivePage「档案内心理测试板块」复用，故保持全局可见）
// 加载于 views-xishi.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用
// （节140 T3d：MbtiHubPage 已删除，入口由首页意图②/explore 提供）

/* ---------- 人格测试（后端题库 /api/mbti/questions · 计分 /api/mbti/score ·
   保存类型 /api/mbti/save-type · 结果 /api/mbti/results） ---------- */
// 16 型枚举（节125：手输限枚举；同时作为「类型倾向对照」的候选集）
const ALL_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
// 大五五维展示配置（O/C/E/A/N；N 高分 = 敏感多虑，文案按中性描述）
const OCEAN_DIMS = [
  { k: 'O', cn: '开放性', low: '务实守成', high: '好奇开放' },
  { k: 'C', cn: '尽责性', low: '随性灵活', high: '自律可靠' },
  { k: 'E', cn: '外向性', low: '安静内敛', high: '热情外向' },
  { k: 'A', cn: '宜人性', low: '直接犀利', high: '温和友善' },
  { k: 'N', cn: '神经质', low: '沉稳安定', high: '敏感细腻' }
];
// 四字母对照换算的四对（左字母 = 边界标注记号，见 scoring.map_to_mbti）
const TYPE_PAIRS = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
// 五栏文案（节122 §7.3-⑤ 暂缓处置：别名与五栏文案先保留；档案页 ArchivePage 亦复用）
const MBTI_FIELDS = [['strengths', '优势'], ['blindspots', '盲点'], ['career', '职场'], ['relationships', '关系'], ['growth', '成长建议']];
// 答题进度 localStorage 键（按档案 + 题库版本隔离；节124：防刷新丢失；120/300 版进度互不覆盖）
const mbtiProgressKey = (caseId, version) => 'mingli_mbti_progress_' + (version || '300') + '_' + (caseId == null ? 'none' : String(caseId));
function MbtiPage({
  onNavigate,
  initCaseId
}) {
  const el = React.createElement;
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [view, setView] = useState('quiz'); // quiz | grid | result
  const [questions, setQuestions] = useState([]);
  const [scale, setScale] = useState([]); // 5 档李克特选项文案（来自后端）
  const [qLoading, setQLoading] = useState(true);
  const [qErrored, setQErrored] = useState('');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // [{question_id, value:1..5}]
  const [scoring, setScoring] = useState(false);
  const [scoreErr, setScoreErr] = useState('');
  const [result, setResult] = useState(null); // {id,type,scores,boundaries,mode:'scored'|'manual'}
  const [savedType, setSavedType] = useState(null); // 已保存到档案的类型（节125：判型后用户点「保存」）
  const [savingType, setSavingType] = useState(false);
  const [info, setInfo] = useState(null); // type_info {alias,strengths,blindspots,career,relationships,growth}
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoErr, setInfoErr] = useState('');
  const [caseList, setCaseList] = useState([]);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseErrored, setCaseErrored] = useState('');
  // REQ-056 v3：选档案阶段与答题阶段分离 —— 勾选档案后一律停留在「选档案 + 操作区」，
  // 点「开始测试」才进入答题；「查看已完成类型」为显式按钮，点击才进结果页。
  const [started, setStarted] = useState(false); // false=选档案阶段（勾选档案后展示操作区）
  // 题库版本：120=快速版（IPIP-NEO-120 官方普通话译本，约 8 分钟）/ 300=完整版（IPIP-NEO-300，约 20 分钟）
  const [version, setVersion] = useState('120');
  // REQ-056①：档案卡片「已测类型 / 未测试」。GET /api/cases 列表项当前不含
  // mbti_type，故前端按 caseId 并行 GET /mbti/results?case_id= 取「最近一条判型」作为
  // 已测类型（与「查看已完成结果」展示口径一致：他人经分享填写的最新记录同样算作已测）；
  // 判空容错：探测失败按未测兜底，不阻塞档案列表。
  const [typeMap, setTypeMap] = useState({}); // {caseId: type}；''=已确认未测
  const [typeLoading, setTypeLoading] = useState(false);
  const [caseId, setCaseId] = useState(initCaseId || null);
  // REQ-047（退回①）：分享入口只看 caseId —— 选档案后即可邀请朋友代填（档案不必是本人作答）
  const [shareUrl, setShareUrl] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareErr, setShareErr] = useState('');
  const total = questions && questions.length ? questions.length : 0;
  // —— 拉取题库（GET /api/mbti/questions?version=：{scale, questions}，按所选版本）——
  const load = async v => {
    setQLoading(true);
    setQErrored('');
    try {
      const res = await api('/mbti/questions?version=' + encodeURIComponent(v || '300'));
      const d = res && res.data || res || {};
      const list = d.questions || [];
      if (!list.length) throw new Error(UI_COPY.mbti['qbank-empty']);
      setQuestions(list);
      setScale(d.scale && d.scale.length === 5 ? d.scale : UI_COPY.mbti['scale-default']);
    } catch (e) {
      setQErrored(e && e.message || UI_COPY.mbti['qbank-load-fail']);
    } finally {
      setQLoading(false);
    }
  };
  // —— 拉取档案列表（GET /api/cases）：保存类型需写入档案 case.mbti_type ——
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
        t = '';
      }
      setTypeMap(prev => Object.assign({}, prev, {[k]: t}));
    }));
    setTypeLoading(false);
  };
  const caseTypeOf = c => {
    if (!c || c.caseId == null) return '';
    const own = c.mbti_type ? String(c.mbti_type).trim().toUpperCase() : '';
    if (own) return own;
    const k = String(c.caseId);
    return Object.prototype.hasOwnProperty.call(typeMap, k) ? typeMap[k] : null;
  };
  const probedKey = useRef(null);
  useEffect(() => {
    if (view !== 'quiz' || started || caseLoading || !caseList.length) return;
    const key = caseList.map(c => c.caseId).join(',');
    if (probedKey.current === key) return;
    probedKey.current = key;
    probeTypes(caseList);
  }, [view, started, caseList, caseLoading]);
  useEffect(() => {
    // 题库改为点「开始测试」时才按所选版本拉取（选档案阶段不需要题库，见 startQuiz）
    loadCases();
  }, []);
  // caseId 变更时串档清理（分享链接/旧结果/旧文案归零；切档案后进度不串用）
  const checkedCase = useRef(null);
  useEffect(() => {
    if (caseId == null || checkedCase.current === String(caseId)) return;
    checkedCase.current = String(caseId);
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
    setResult(null);
    setSavedType(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoreErr('');
  }, [caseId]);
  // —— 答题进度：localStorage 存取（节124，防丢失；按档案 + 版本隔离）——
  const saveProgress = (cId, v, i, ans) => {
    try {
      localStorage.setItem(mbtiProgressKey(cId, v), JSON.stringify({ idx: i, answers: ans }));
    } catch (e) {/* localStorage 不可用时静默降级 */}
  };
  const clearProgress = (cId, v) => {
    try {
      localStorage.removeItem(mbtiProgressKey(cId, v));
    } catch (e) {/* 忽略 */}
  };
  const restoreProgress = (cId, v) => {
    try {
      const raw = localStorage.getItem(mbtiProgressKey(cId, v));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.answers) || typeof p.idx !== 'number') return null;
      return p;
    } catch (e) {
      return null;
    }
  };
  // —— 拉取类型文案（GET /api/mbti/results/{id} 或 /api/mbti/types/{code}）——
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
  // —— 查看已完成结果：操作区显式按钮（取该档案最近一条判型）——
  const viewExisting = async () => {
    if (caseId == null) return;
    try {
      const rr = await api('/mbti/results?case_id=' + encodeURIComponent(caseId));
      const items = rr && rr.data && rr.data.items || (rr && rr.items) || [];
      const latest = items && items.length ? items[0] : null;
      // 四维全边界时 type 可能为空串，仍视为一条已完成结果
      if (!latest || latest.type == null) {
        toast(UI_COPY.mbti['no-test']);
        return;
      }
      setTypeMap(prev => Object.assign({}, prev, {[String(caseId)]: latest.type ? String(latest.type).toUpperCase() : ''}));
      setResult({
        id: latest.id != null ? latest.id : null,
        type: latest.type || '',
        scores: latest.scores || {},
        boundaries: latest.boundaries || [],
        mode: 'scored'
      });
      setSavedType(null);
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
  // —— 提交答案并判型（POST /api/mbti/score，case_id 必填；节125：判型不回写档案类型）——
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
          version: version,
          answers: list
        })
      });
      const d = res && res.data || res || {};
      // 四维全落在边界区时后端 type 可能为空串（「介于多型之间」），属合法结果
      if (!d || d.type == null) throw new Error(d && d.message || UI_COPY.mbti['score-fail']);
      setTypeMap(prev => Object.assign({}, prev, {[String(caseId)]: d.type ? String(d.type).toUpperCase() : ''}));
      setResult({id: d.id || null, type: d.type || '', scores: d.scores || {}, boundaries: d.boundaries || [], mode: 'scored'});
      setSavedType(null);
      setInfo(null);
      setInfoLoading(false);
      setInfoErr('');
      setView('result');
      clearProgress(caseId, version); // 答完即清进度
      if (d.id) fetchInfo(d.id);
    } catch (e) {
      setScoreErr(e && e.message || UI_COPY.mbti['score-fail']);
    } finally {
      setScoring(false);
    }
  };
  // —— 保存类型到档案（节125：POST /api/mbti/save-type；判定/手输都走这里落库）——
  const saveType = async t => {
    if (!caseId || savingType) return;
    setSavingType(true);
    try {
      const res = await api('/mbti/save-type', {
        method: 'POST',
        body: JSON.stringify({
          case_id: Number(caseId),
          type: t
        })
      });
      const d = res && res.data || res || {};
      if (!d || !d.type) throw new Error(d && d.message || UI_COPY.mbti['adopt-fail']);
      setSavedType(String(d.type).toUpperCase());
      setTypeMap(prev => Object.assign({}, prev, {[String(caseId)]: String(d.type).toUpperCase()}));
      toast(UI_COPY.mbti['adopt-saved-toast']);
    } catch (e) {
      toast(e && e.message || UI_COPY.mbti['adopt-fail']);
    } finally {
      setSavingType(false);
    }
  };
  // —— 点击选项：记录该题答案（{question_id, value}）并自动进入下一题；最后一题自动判型 ——
  const choose = value => {
    if (scoring || !total) return;
    if (!caseId) {
      toast(UI_COPY.mbti['select-case-result']);
      return;
    }
    const q = questions[idx];
    if (!q) return;
    const next = answers.slice();
    next[idx] = {question_id: q.id, value: value};
    setAnswers(next);
    saveProgress(caseId, version, idx + 1, next);
    if (idx + 1 < total) setIdx(idx + 1); else submitScore(next);
  };
  // —— 进入答题：点「开始测试」才按所选版本拉题库；进度在题库就绪后由 effect 恢复 ——
  const startQuiz = () => {
    setStarted(true);
    setScoreErr('');
    if (caseId == null) return;
    load(version);
  };
  // —— 答题进度恢复：题库（按所选版本）就绪后，恢复该 (档案, 版本) 的 localStorage 进度 ——
  const restoredKey = useRef(null);
  useEffect(() => {
    if (!started || caseId == null || !questions.length) return;
    const key = String(caseId) + ':' + version;
    if (restoredKey.current === key) return;
    restoredKey.current = key;
    const p = restoreProgress(caseId, version);
    if (p && Array.isArray(p.answers) && p.answers.length > 0 && p.answers.length <= questions.length) {
      setAnswers(p.answers);
      setIdx(Math.min(p.idx || 0, questions.length - 1));
      toast(UI_COPY.mbti['progress-restored']);
    }
  }, [started, caseId, version, questions]);
  // —— 重新测试：清空答案/结果/进度 ——
  const reset = () => {
    setView('quiz');
    setStarted(true);
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setSavedType(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoring(false);
    setScoreErr('');
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
    if (caseId != null) clearProgress(caseId, version);
  };
  // —— 回到选档案阶段（更换档案 / 选择其它档案）——
  const pickAnother = () => {
    setView('quiz');
    setStarted(false);
    setCaseId(null);
    checkedCase.current = null;
    restoredKey.current = null; // 重新选档案后，同 (档案, 版本) 也要能再次恢复进度
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setSavedType(null);
    setInfo(null);
    setInfoLoading(false);
    setInfoErr('');
    setScoring(false);
    setScoreErr('');
    setShareUrl(null);
    setShareLoading(false);
    setShareErr('');
  };
  // —— 我已知道类型：直接输入（节125：选择后立即保存到档案；同时取类型详解文案）——
  const pickType = async t => {
    setResult({id: null, type: t, scores: null, boundaries: [], mode: 'manual'});
    setSavedType(null);
    setInfo(null);
    setInfoLoading(true);
    setInfoErr('');
    setView('result');
    if (caseId != null) {
      await saveType(t); // 手输 = 用户认定，直接落库（修通旧「手输不落库 → 配对解析报未测」堵塞）
    }
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
  // —— REQ-047：生成分享链接（POST /api/mbti/share，需鉴权）——
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
  const alias = info && info.alias ? info.alias : infoLoading && !info ? UI_COPY.mbti.loading : '—';
  // —— 五维条形图（0–100 单条填充 + 档位文字；不给人群百分位）——
  const dimBand = v => {
    if (v == null) return '—';
    return v >= 67 ? UI_COPY.mbti['band-high'] : v >= 34 ? UI_COPY.mbti['band-mid'] : UI_COPY.mbti['band-low'];
  };
  const oceanBar = d => {
    const s = result && result.scores ? result.scores[d.k] : null;
    const v = s == null ? 0 : Math.max(0, Math.min(100, Number(s) || 0));
    return el('div', {key: d.k, className: 'mbti-bar'},
      el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 52, textAlign: 'left'}}, d.cn),
      el('span', {className: 'bb-track'},
        el('span', {className: 'bb-fill', style: {left: 0, width: v + '%', background: 'var(--skin-accent)'}})),
      el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 30, textAlign: 'right'}}, s == null ? '—' : Math.round(v) + ''),
      el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 52, textAlign: 'right', fontWeight: 400, color: 'var(--text-2)'}}, dimBand(s)));
  };
  // —— 四字母「类型倾向对照」：次级展示 + 边界标注（节122 §4.3 分级谦虚）——
  const boundarySet = (result && result.boundaries) || [];
  const lettersOf = t => {
    if (!t) return [];
    const up = String(t).toUpperCase();
    const out = [];
    for (let i = 0; i < TYPE_PAIRS.length && i < up.length; i++) {
      const ch = up[i];
      const left = TYPE_PAIRS[i][0];
      out.push({ch: ch, boundary: boundarySet.indexOf(left) >= 0});
    }
    return out;
  };
  // —— 结果页主体 ——
  let body;
  if (view === 'grid') {
    body = el('div', {className: 'card'},
      el('div', {className: 'section-title'}, UI_COPY.mbti['grid-title']),
      el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 8}}, UI_COPY.mbti['grid-note']),
      el('div', {className: 'grid16'}, ALL_TYPES.map(t =>
        el('div', {key: t, className: 'g', onClick: () => pickType(t)}, t))),
      total > 0 ? el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('quiz')}, '返回答题')) : qErrored ? el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => {
          setView('quiz');
          if (started) load(version);
        }}, '返回重试题库')) : el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('quiz')}, '返回')));
  } else if (view === 'result' && result) {
    const t = result.type || '';
    const letters = lettersOf(t);
    // 类型详情（五栏文案；别名/五栏暂保留，节122 §7.3-⑤）
    const colsCard = info ? el('div', {className: 'card'}, MBTI_FIELDS.map(f => {
          const lines = toLines(info[f[0]]);
          return el('div', {key: f[0], style: {margin: '6px 0'}},
            el('div', {className: 'section-title', style: {marginBottom: 4}}, f[1]),
            lines.length ? lines.map((x, i) => el('p', {key: i, style: {fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8}}, '· ' + x)) : el('p', {style: {fontSize: 13, color: 'var(--text-3)'}}, '—'));
        }))
      : isManual ? el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}}, UI_COPY.mbti['manual-no-info'])
      : el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}},
          infoLoading ? UI_COPY.mbti.loading : (infoErr || UI_COPY.mbti['no-info']), result.id ? el('div', {className: 'back-row', style: {justifyContent: 'center'}},
            el('button', {className: 'btn btn-outline', style: {width: 'auto', fontSize: 13}, onClick: () => fetchInfo(result.id)}, '重新加载文案')) : null);
    // 五维条形图卡（判型有 scores；手输无 scores → 提示）
    const barsCard = isManual || !result.scores ? el('div', {className: 'card', style: {color: 'var(--text-3)', fontSize: 13, textAlign: 'center'}}, UI_COPY.mbti['manual-no-scores'])
      : el('div', {className: 'card'},
          el('div', {className: 'section-title'}, UI_COPY.mbti['dim-title']),
          OCEAN_DIMS.map(oceanBar),
          el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6}}, UI_COPY.mbti['dim-note']));
    // 类型倾向对照卡（四字母次级展示）
    const mappedCard = !isManual && result.scores ? el('div', {className: 'card', style: {textAlign: 'center'}},
      el('div', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 6}}, UI_COPY.mbti['mapped-label']),
      letters.length ? el('div', {className: 'mbti-type-big', style: {fontSize: 30, letterSpacing: 6}}, letters.map((L, i) =>
        el('span', {key: i, style: L.boundary ? {opacity: 0.55, textDecoration: 'underline dotted'} : undefined}, L.ch))) : null,
      el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 4}}, UI_COPY.mbti['mapped-note']),
      letters.some(L => L.boundary) ? el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 2}}, UI_COPY.mbti['boundary-note']) : null,
      !isManual && result.scores && t ? el('div', {style: {marginTop: 8}},
        savedType ? el('span', {className: 'badge-ok', style: {display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600}}, '✓ ' + UI_COPY.mbti['adopted'])
        : el('button', {className: 'btn btn-primary', style: {width: 'auto'}, disabled: savingType, onClick: () => saveType(t)}, savingType ? UI_COPY.mbti.loading : UI_COPY.mbti['adopt-btn']))
      : null,
      !isManual && result.scores && t && !savedType ? el('div', {style: {fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 8}}, fmtTpl(UI_COPY.mbti['adopt-ask'], {type: t})) : null)
      : null;
    // 脚注免责（节122 §3.2：全站唯一出现 MBTI 商标的地方，附权利人官方致谢句）
    const footCard = el('div', {className: 'card', style: {background: 'transparent', borderColor: 'var(--border)'}},
      el('p', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, margin: 0}}, UI_COPY.mbti['ocean-footnote']));
    body = el(React.Fragment, null,
      el('div', {className: 'card', style: {textAlign: 'center'}},
        el('div', {style: {fontSize: 18, fontWeight: 800, color: 'var(--text-1)'}}, UI_COPY.mbti['result-title']),
        el('div', {style: {fontSize: 12, color: 'var(--text-3)', marginTop: 4}}, UI_COPY.mbti['result-sub']),
        isManual ? el('div', {style: {fontSize: 14, fontWeight: 700, color: 'var(--skin-accent)', marginTop: 8}}, t + ' · ' + UI_COPY.mbti['manual-tag'])
        : !t && result.scores ? el('div', {style: {fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginTop: 8}}, UI_COPY.mbti['multi-type']) : null),
      barsCard, mappedCard, colsCard,
      el('div', {className: 'card'},
        el('div', {className: 'section-title'}, UI_COPY.mbti['type-grid-title']),
        el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6}}, UI_COPY.mbti['type-grid-note']),
        el('div', {className: 'grid16'}, ALL_TYPES.map(x =>
          el('div', {key: x, className: 'g' + (x === t ? ' cur' : ''), onClick: () => { if (x !== t) toast(ML_COPY.ui.toast['mbti-other-types-coming-soon']); }}, x)))),
      footCard,
      el('div', {className: 'back-row'},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: reset}, '重新测试'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: pickAnother}, '选择其它档案'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else {
    // —— 阶段 1：答题 ——
    if (!started || !caseId) {
      // 选档案阶段（含版本选择器）：未开始前不需要题库，先展示档案选择与操作区
      let gate = null;
      if (caseLoading) {
        gate = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '24px 16px'}}, UI_COPY.mbti['case-loading']);
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
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, UI_COPY.mbti['manual-entry'])));
      } else {
        const selCase = caseId != null ? (caseList.find(c => Number(c.caseId) === Number(caseId)) || null) : null;
        const selNm = selCase ? (selCase.name || '档案 ' + selCase.caseId) : '';
        const selTval = selCase ? caseTypeOf(selCase) : '';
        // 版本选择器：选版本后点「开始测试」才按所选版本拉题库（紧凑 chip，复用 .chip/.on + 皮肤令牌）
        const versionSelector = el('div', {style: {display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', margin: '0 0 12px'}},
          el('span', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600}}, '测试版本'),
          el('button', {type: 'button', className: 'chip' + (version === '120' ? ' on' : ''), onClick: () => setVersion('120')}, '快速版 120 题（约 8 分钟）'),
          el('button', {type: 'button', className: 'chip' + (version === '300' ? ' on' : ''), onClick: () => setVersion('300')}, '完整版 300 题（约 20 分钟）'));
        gate = el(React.Fragment, null,
          el('div', {className: 'card'},
            el('div', {className: 'section-title'}, '选择档案 · 心理测试'),
            el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 6}}, UI_COPY.mbti['case-select-note']),
            el('div', {className: 'step-hint'},
              el('span', {className: 'sh cur'}, '① 选择档案'),
              el('span', {className: 'sh-arr'}, '→'),
              el('span', {className: 'sh'}, '② 开始测试 / 查看已完成结果')),
            el('select', {className: 'input', value: caseId != null ? String(caseId) : '', onChange: e => { const id = e.target.value; if (!id) return; const c = caseList.find(x => Number(x.caseId) === Number(id)); setStarted(false); setCaseId(c ? c.caseId : id); }, style: {marginBottom: 0}},
              el('option', {value: ''}, '请选择档案'),
              caseList.map(c => {
                const nm = c.name || '档案 ' + c.caseId;
                const tval = caseTypeOf(c);
                const tTxt = tval ? '已测 ' + tval : (tval === null && typeLoading) ? '检测中…' : '未测试';
                return el('option', {key: c.caseId, value: String(c.caseId)},
                  nm + (c.birthYear ? '（' + c.birthYear + ' 年生）' : '') + ' · ' + tTxt);
              }))),
          el('div', {className: 'card', style: {marginTop: 10}},
            el('div', {className: 'section-title'}, '档案操作'),
            selCase ? el(React.Fragment, null,
              el('div', {style: {fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10}}, '已选档案：' + selNm),
              el('div', {style: {display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%', paddingBottom: 10, marginBottom: 10, borderBottom: '1px dashed var(--border)'}},
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
                  UI_COPY.mbti['share-note'])))
              : el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 10}}, UI_COPY.mbti['case-op-note']),
            versionSelector,
            el('div', {className: 'back-row', style: {justifyContent: 'center', margin: 0}},
              el('button', {className: 'btn btn-primary', style: {width: 'auto'}, disabled: !selCase, title: selCase ? '' : '请先勾选档案', onClick: startQuiz}, UI_COPY.buttons.start_quiz),
              selTval ? el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: viewExisting}, UI_COPY.mbti['view-existing']) : null,
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, UI_COPY.mbti['manual-entry']),
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('onboarding', {returnTo: 'mbti'})}, UI_COPY.buttons.create_case),
              el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('cases')}, '管理档案')),
            el('button', {type: 'button', className: 'pair-big', style: {marginTop: 12, marginBottom: 0}, onClick: () => openPairAnalyze({module: 'mbti'})},
              el('span', {className: 'pb-title'}, el(Icon, {name: 'spark', size: 20, color: 'var(--skin-accent)'}), '配对解析', payBadge(payEnough)),
              el('span', {className: 'pb-sub'}, UI_COPY.mbti['pair-sub']))));
      }
      body = gate;
    } else if (qLoading) {
      body = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '28px 16px'}}, UI_COPY.mbti['qbank-loading']);
    } else if (qErrored) {
      body = el('div', {className: 'card failed-box'},
        el('div', {className: 'section-title'}, '题库加载失败'),
        el('div', {className: 'error'}, qErrored),
        el('div', {className: 'back-row', style: {justifyContent: 'center'}},
          el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => load(version)}, UI_COPY.buttons.retry),
          el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setView('grid')}, UI_COPY.mbti['manual-entry'])));
    } else if (!cur) {
      body = el('div', {className: 'card failed-box'}, el('div', {className: 'section-title'}, UI_COPY.mbti['qbank-empty']));
    } else {
      const answered = Math.min(answers.length, total);
      const pct = total ? Math.round(answered / total * 100) : 0;
      const opts = scale && scale.length === 5 ? scale : UI_COPY.mbti['scale-default'];
      body = el('div', {className: 'card'},
        el('div', {style: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-3)', marginBottom: 2}},
          el('span', null, '第 ' + (idx + 1) + ' / ' + total + ' 题'),
          el('span', {style: {display: 'flex', gap: 10, alignItems: 'center'}},
            el('button', {style: {fontSize: 12, color: 'var(--skin-accent)', fontWeight: 600}, onClick: pickAnother}, '更换档案'),
            el('button', {style: {fontSize: 12, color: 'var(--skin-accent)', fontWeight: 600}, onClick: () => setView('grid')}, UI_COPY.mbti['manual-entry']))),
        el('div', {className: 'mbti-progress'}, el('i', {style: {width: pct + '%'}})),
        scoring ? el('div', {style: {textAlign: 'center', color: 'var(--text-2)', padding: '18px 0'}}, UI_COPY.mbti['scoring']) : el(React.Fragment, null,
          el('div', {style: {fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.6, margin: '10px 0'}}, cur.text),
          el('div', {style: {display: 'flex', flexDirection: 'column', gap: 8}},
            opts.map((label, i) => el('button', {key: i, className: 'btn btn-outline', style: {textAlign: 'left', justifyContent: 'flex-start'}, onClick: () => choose(i + 1)}, (i + 1) + '. ' + label))),
          el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6}}, fmtTpl(UI_COPY.mbti['answer-note'], {n: total})),
          el('div', {className: 'back-row'},
            idx > 0 ? el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setIdx(idx - 1)}, '上一题') : null,
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => {
              setIdx(0);
              setAnswers([]);
              setScoreErr('');
              if (caseId != null) clearProgress(caseId, version);
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
    el('div', {style: {fontSize: 12, color: 'var(--text-3)', marginBottom: 4}}, fmtTpl(UI_COPY.mbti['q-subtitle'], {n: total || (version === '120' ? 120 : 300)})),
    body);
}

/* ---------- REQ-047：免登录分享答题页（/mbti/share/{token} 直达 · 公开免登录） ---------- */
function MbtiSharePage({
  token,
  onNavigate
}) {
  const el = React.createElement;
  const shareUiOn = ML_SETTINGS.share_mingli_ui !== false;
  const shareBrand = shareUiOn ? el('div', {className: 'tc-share-brand'},
    el('div', {className: 'tc-share-brand-head'},
      el(Icon, {name: 'spark', size: 18}),
      el('span', {className: 'tc-share-brand-name'}, UI_COPY.brand.name),
      el('span', {className: 'tc-share-brand-tag'}, UI_COPY.brand.tagline)),
    el('div', {className: 'tc-share-brand-note'}, UI_COPY.landing.disclaimer_short),
    el('div', {className: 'tc-share-brand-links'},
      el('button', {type: 'button', className: 'btn btn-outline', onClick: () => onNavigate('auth')}, UI_COPY.menu['login-register']),
      el('button', {type: 'button', className: 'btn btn-outline', onClick: () => onNavigate('landing')}, '了解命理'))) : null;
  const [caseName, setCaseName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [scale, setScale] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // [{question_id, value}]
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null); // {type, scores, boundaries}
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [version, setVersion] = useState('120'); // 题库版本：120=快速版 / 300=完整版
  const total = questions && questions.length ? questions.length : 0;
  const tk = token && String(token).trim() ? String(token).trim() : '';
  const base = tk ? '/mbti/share/' + encodeURIComponent(tk) : null;
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
        const res = await api(base + '?version=' + encodeURIComponent(version), {noAuth: true});
        const d = res && res.data || res || {};
        const list = d.questions || [];
        if (!list.length) throw new Error('题库为空');
        if (alive) {
          setCaseName(d.case_name || '');
          setQuestions(list);
          setScale(d.scale && d.scale.length === 5 ? d.scale : UI_COPY.mbti['scale-default']);
        }
      } catch (e) {
        if (alive) setErrored('分享链接不存在或已失效');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tk, version]);
  const submitShare = async list => {
    if (!list || !total || list.length !== total) return;
    setScoring(true);
    try {
      const res = await api(base + '/score', {
        method: 'POST',
        noAuth: true,
        body: JSON.stringify({
          answers: list,
          version: version
        })
      });
      const d = res && res.data || res || {};
      if (!d || !d.type) throw new Error(d && d.message || UI_COPY.mbti['score-fail']);
      setResult({
        type: d.type,
        scores: d.scores || {},
        boundaries: d.boundaries || []
      });
    } catch (e) {
      toast(e && e.message || UI_COPY.mbti['score-fail']);
    } finally {
      setScoring(false);
    }
  };
  const choose = value => {
    if (scoring || !total) return;
    const q = questions[idx];
    if (!q) return;
    const next = answers.slice();
    next[idx] = {
      question_id: q.id,
      value: value
    };
    setAnswers(next);
    if (idx + 1 < total) setIdx(idx + 1); else submitShare(next);
  };
  const reset = () => {
    setIdx(0);
    setAnswers([]);
    setScoring(false);
    setResult(null);
    setErrored('');
  };
  // —— 版本选择：切换即清空当前作答，并按新版本重拉题库 ——
  const chooseVersion = v => {
    if (v === version) return;
    setIdx(0);
    setAnswers([]);
    setScoring(false);
    setResult(null);
    setErrored('');
    setVersion(v);
  };
  const versionSelector = tk && !result ? el('div', {className: 'card', style: {padding: '12px 16px', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center'}},
    el('span', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600}}, '测试版本'),
    el('button', {type: 'button', className: 'chip' + (version === '120' ? ' on' : ''), onClick: () => chooseVersion('120')}, '快速版 120 题（约 8 分钟）'),
    el('button', {type: 'button', className: 'chip' + (version === '300' ? ' on' : ''), onClick: () => chooseVersion('300')}, '完整版 300 题（约 20 分钟）')) : null;
  let body;
  if (!tk) {
    body = el('div', {className: 'card failed-box'},
      el('div', {className: 'section-title'}, '无法打开分享'),
      el('div', {className: 'error'}, '分享链接无效（缺少链接参数）'),
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (result) {
    const t = result.type || '';
    const boundarySet = result.boundaries || [];
    const letters = [];
    for (let i = 0; i < TYPE_PAIRS.length && i < t.length; i++) {
      letters.push({ch: t[i].toUpperCase(), boundary: boundarySet.indexOf(TYPE_PAIRS[i][0]) >= 0});
    }
    const barsCard = result.scores ? el('div', {className: 'card'},
      el('div', {className: 'section-title'}, UI_COPY.mbti['dim-title']),
      OCEAN_DIMS.map(d => {
        const v = result.scores[d.k] == null ? 0 : Math.max(0, Math.min(100, Number(result.scores[d.k]) || 0));
        return el('div', {key: d.k, className: 'mbti-bar'},
          el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 52, textAlign: 'left'}}, d.cn),
          el('span', {className: 'bb-track'},
            el('span', {className: 'bb-fill', style: {left: 0, width: v + '%', background: 'var(--skin-accent)'}})),
          el('span', {className: 'bb-label', style: {width: 'auto', minWidth: 30, textAlign: 'right'}}, Math.round(v) + ''));
      }),
      el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6}}, UI_COPY.mbti['dim-note'])) : null;
    const mappedCard = result.scores ? el('div', {className: 'card', style: {textAlign: 'center'}},
      el('div', {style: {fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 6}}, UI_COPY.mbti['mapped-label']),
      letters.length ? el('div', {className: 'mbti-type-big', style: {fontSize: 30, letterSpacing: 6}}, letters.map((L, i) =>
        el('span', {key: i, style: L.boundary ? {opacity: 0.55, textDecoration: 'underline dotted'} : undefined}, L.ch))) : null,
      el('div', {style: {fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 4}}, UI_COPY.mbti['mapped-note']),
      letters.some(L => L.boundary) ? el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 2}}, UI_COPY.mbti['boundary-note']) : null) : null;
    body = el(React.Fragment, null,
      el('div', {className: 'card', style: {textAlign: 'center'}},
        el('div', {style: {fontSize: 18, fontWeight: 800, color: 'var(--text-1)'}}, UI_COPY.mbti['result-title']),
        el('div', {style: {fontSize: 12, color: 'var(--text-3)', marginTop: 4}}, caseName ? '已完成「' + caseName + '」的测评 · 结果已记录' : '测评完成 · 结果已记录')),
      barsCard, mappedCard,
      el('div', {className: 'card', style: {background: 'transparent', borderColor: 'var(--border)'}},
        el('p', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, margin: 0}}, UI_COPY.mbti['ocean-footnote'])),
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: reset}, '再测一次'),
        el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (loading) {
    body = el('div', {className: 'card', style: {textAlign: 'center', color: 'var(--text-2)', padding: '28px 16px'}}, UI_COPY.mbti['qbank-loading']);
  } else if (errored) {
    body = el('div', {className: 'card failed-box'},
      el('div', {className: 'section-title'}, '无法打开分享'),
      el('div', {className: 'error'}, errored),
      el('div', {className: 'back-row', style: {justifyContent: 'center'}},
        el('button', {className: 'btn btn-primary', style: {width: 'auto'}, onClick: () => onNavigate('landing')}, UI_COPY.buttons.back_home)));
  } else if (!total) {
    body = el('div', {className: 'card failed-box'}, el('div', {className: 'section-title'}, UI_COPY.mbti['qbank-empty']));
  } else {
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
      const opts = scale && scale.length === 5 ? scale : UI_COPY.mbti['scale-default'];
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
        scoring ? el('div', {style: {textAlign: 'center', color: 'var(--text-2)', padding: '18px 0'}}, UI_COPY.mbti['scoring']) : el(React.Fragment, null,
          el('div', {style: {fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.6, margin: '10px 0'}}, q.text),
          el('div', {style: {display: 'flex', flexDirection: 'column', gap: 8}},
            opts.map((label, i) => el('button', {key: i, className: 'btn btn-outline', style: {textAlign: 'left', justifyContent: 'flex-start'}, onClick: () => choose(i + 1)}, (i + 1) + '. ' + label))),
          el('div', {style: {fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6}}, fmtTpl(UI_COPY.mbti['answer-note'], {n: total})),
          idx > 0 ? el('div', {className: 'back-row'},
            el('button', {className: 'btn btn-outline', style: {width: 'auto'}, onClick: () => setIdx(idx - 1)}, '上一题')) : null));
    }
  }
  const inForm = !!tk && !result && !loading && !errored && total > 0 && !!questions[idx];
  return el('div', {className: 'container'},
    el('div', {className: 'hub-title'}, el(Icon, {name: 'spark', size: 22}), ' 人格测试'),
    caseName && !result ? el('div', {style: {fontSize: 13, color: 'var(--text-2)', marginBottom: 2}}, '为「' + caseName + '」填写心理测试') : null,
    versionSelector,
    inForm && shareUiOn ? el('div', {className: 'card', style: {padding: '14px 20px 10px', margin: '12px 0 0'}}, shareBrand) : null,
    body);
}
