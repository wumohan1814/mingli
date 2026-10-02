// 国学工具域视图（节110 阶段3 / 节140 T3d 去 HUB / 节161 合参页拆出独立文件）：
// 起名 NamerModal + 择吉与时势 GuoxueToolsPage（原命盘多法选档案页 NinePickPage 已改造成
// 「合参」页并移至 /js/views-hecan.js，一页两标签：命盘合参 / 当下事合参）。
// 加载于 views-home.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- REQ-094UI：起名弹窗（单档案 → POST /api/namer/name；姓氏必填 ≤2 字 + 方向选填） ----------
   契约：body {case_id:int, surname:str(必填), direction?:str} → {code:0, data:{names:[{name,full,reason,adjusted}],
   notes, adjusted}}；name=不含姓氏的名、full=全名、reason=理由、adjusted=是否按规则调整。
   未选档案 / 档案未排盘：后端 400 detail 直接展示于弹窗（提示先生成排盘），前端不重复造文案。 */
function NamerModal({
  caseId,
  caseName,
  onClose
}) {
  const el = React.createElement;
  const C = UI_COPY.namer;
  const [surname, setSurname] = useState('');
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null); // {names:[{name,full,reason,adjusted}], notes, adjusted}
  // REQ-100：档案起名入口上移国学 HUB（不再由选档案页带入 caseId）——未预选档案（caseId 为空）时
  // 弹窗内自拉档案列表，默认选中默认档案（无默认则最新一份）；起名主流程（姓氏必填≤2字+方向选填）不变。
  const [caseList, setCaseList] = useState(null); // null=加载中 / [] = 无档案 / 数组=已就绪
  const [listErr, setListErr] = useState('');
  const [pickId, setPickId] = useState(caseId != null && String(caseId).trim() ? String(caseId) : '');
  const submit = async () => {
    if (busy) return;
    if (!pickId) {
      toast(ML_COPY.ui.toast['tools-case-required']);
      return;
    }
    const sn = String(surname || '').trim();
    if (!sn) {
      toast(C.surnameRequired);
      return;
    }
    if (sn.length > 2) {
      toast(C.surnameTooLong);
      return;
    }
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      const body = {
        case_id: Number(pickId),
        surname: sn
      };
      const dd = String(direction || '').trim();
      if (dd) body.direction = dd;
      const r = await api('/namer/name', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const d = r && r.data ? r.data : (r || {});
      setRes(d && typeof d === 'object' ? d : {});
    } catch (e) {
      // 未排盘等业务 400：后端 detail（如「先生成排盘…」）直接透传展示
      setErr(e && e.message ? e.message : C.submitFail);
    } finally {
      setBusy(false);
    }
  };
  const loadCases = async () => {
    setListErr('');
    setCaseList(null);
    try {
      const r = await api('/cases', {
        method: 'GET'
      });
      const arr = r && r.data && r.data.cases || r && r.cases || [];
      setCaseList(arr);
      if (!pickId && arr.length) {
        const def = arr.find(c => c && c.isDefault) || arr[0];
        if (def) setPickId(String(def.caseId));
      }
    } catch (e) {
      // 未登录/会话过期（401）：App 已跳登录页（onUnauthorized），直接关掉弹窗即可
      if (e && e.status === 401) {
        onClose();
        return;
      }
      setListErr(e && e.message ? e.message : UI_COPY.namer['list-fail']);
      setCaseList([]);
    }
  };
  useEffect(() => {
    if (!caseId) loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const list = res && Array.isArray(res.names) ? res.names : [];
  const notesTxt = res && typeof res.notes === 'string' && res.notes.trim() ? res.notes.trim() : '';
  const hd = el('div', {
    className: 'pair-hd'
  }, el('div', {
    className: 'pair-hd-title'
  }, el(Icon, {
    name: 'nine',
    size: 20,
    color: 'var(--skin-accent)'
  }), C.title), el('button', {
    type: 'button',
    className: 'pair-x',
    onClick: onClose,
    title: UI_COPY.buttons.close
  }, '✕'));
  const curCase = (Array.isArray(caseList) ? caseList : []).find(c => String(c.caseId) === String(pickId)) || null;
  const curName = caseId != null && String(caseId).trim()
    ? (caseName || fmtTpl(UI_COPY.namer['case-fallback-tpl'], { id: caseId }))
    : (curCase ? ((curCase.name && String(curCase.name).trim()) || fmtTpl(UI_COPY.namer['case-fallback-tpl'], { id: curCase.caseId })) : '');
  const sub = curName ? el('div', {
    className: 'pair-sub'
  }, fmtTpl(C.caseLine, {
    case: curName
  })) : null;
  const caseOptions = [el('option', {
    key: '__ph__',
    value: ''
  }, UI_COPY.namer['case-ph'])].concat((Array.isArray(caseList) ? caseList : []).map(c => el('option', {
    key: String(c.caseId),
    value: String(c.caseId)
  }, (c.name && String(c.name).trim()) || fmtTpl(UI_COPY.namer['case-fallback-tpl'], { id: c.caseId }))));
  // REQ-100：未预选档案时弹窗内自选档案（默认已选中默认档案/最新一份），起名主流程不变
  const picker = caseId != null && String(caseId).trim() ? null : el('div', {
    className: 'pair-sec'
  }, el('div', {
    className: 'pair-sec-label'
  }, el('span', {
    className: 'ps-n'
  }, UI_COPY.namer['sec-case-ps']), UI_COPY.namer['sec-case-label']), caseList === null ? el('div', {
    className: 'pair-busy'
  }, UI_COPY.namer['list-loading']) : listErr ? el('div', null, el('div', {
    className: 'pair-err'
  }, listErr), el('div', {
    className: 'pair-foot',
    style: {
      marginTop: 0
    }
  }, el('button', {
    type: 'button',
    className: 'btn btn-outline',
    onClick: loadCases
  }, UI_COPY.namer['retry-cases']))) : Array.isArray(caseList) && caseList.length === 0 ? el('div', {
    className: 'pair-err'
  }, UI_COPY.namer['no-case']) : el('select', {
    className: 'pair-field',
    value: pickId,
    onChange: e => {
      setPickId(e.target.value);
      setErr('');
      setRes(null);
    }
  }, caseOptions));
  const form = el('div', null, el('div', {
    className: 'pair-sec'
  }, el('div', {
    className: 'pair-sec-label'
  }, el('span', {
    className: 'ps-n'
  }, UI_COPY.namer['sec-surname-ps']), UI_COPY.namer['sec-surname-label']), el('input', {
    className: 'pair-field',
    value: surname,
    onChange: e => setSurname(e.target.value),
    placeholder: C.surnamePh,
    maxLength: 2
  })), el('div', {
    className: 'pair-sec'
  }, el('div', {
    className: 'pair-sec-label'
  }, el('span', {
    className: 'ps-n'
  }, UI_COPY.namer['sec-direction-ps']), UI_COPY.namer['sec-direction-label'], el('span', {
    style: {
      fontWeight: 400,
      color: 'var(--text-3)',
      fontSize: 11.5
    }
  }, UI_COPY.namer['optional-note'])), el('input', {
    className: 'pair-field',
    value: direction,
    onChange: e => setDirection(e.target.value),
    placeholder: C.directionPh,
    maxLength: 40
  })));
  const result = res ? el('div', null, el('div', {
    className: 'interp-title'
  }, C.resultTitle), list.length ? list.map(function (it, i) {
    const full = it && typeof it.full === 'string' && it.full.trim() ? it.full.trim() : '';
    const given = it && typeof it.name === 'string' && it.name.trim() ? it.name.trim() : '';
    const reason = it && typeof it.reason === 'string' && it.reason.trim() ? it.reason.trim() : '';
    const adjusted = !!(it && it.adjusted);
    return el('div', {
      key: i,
      style: {
        border: '1px solid var(--border)',
        background: 'var(--paper)',
        borderRadius: 10,
        padding: '10px 12px',
        marginTop: 8
      }
    }, el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, full ? el('span', {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: 'var(--skin-accent)'
      }
    }, full) : null, given ? el('span', {
      style: {
        fontSize: 12.5,
        color: 'var(--text-2)',
        fontWeight: 600
      }
    }, fmtTpl(UI_COPY.namer['given-tpl'], { name: given })) : null, adjusted ? el('span', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--tc-amber)',
        border: '1px solid var(--tc-amber)',
        borderRadius: 'var(--radius-pill)',
        padding: '1px 7px'
      }
    }, C.adjustedTag) : null), reason ? el('div', {
      style: {
        fontSize: 12,
        color: 'var(--text-2)',
        lineHeight: 1.75,
        marginTop: 6,
        whiteSpace: 'pre-line'
      }
    }, C.reasonLabel + '：' + reason) : null);
  }) : el('div', {
    style: {
      fontSize: 12.5,
      color: 'var(--text-3)',
      padding: '6px 2px'
    }
  }, C.emptyNames), notesTxt ? el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      background: 'var(--skin-accent-soft)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 11px',
      marginTop: 10,
      lineHeight: 1.7
    }
  }, notesTxt) : null) : null;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // pair-modal 风格：自定义标题栏 + 底部按钮
  return el(ModalBase, {
    onClose: busy ? null : onClose,
    className: 'pair-modal',
    scrollable: true,
    align: 'left',
    footer: el('div', { className: 'pair-foot' },
      el('button', {
        type: 'button',
        className: 'btn btn-outline',
        onClick: onClose,
        disabled: busy
      }, UI_COPY.buttons.close),
      el('button', {
        type: 'button',
        className: 'btn btn-primary',
        disabled: busy || (!(caseId != null && String(caseId).trim()) && !pickId),
        onClick: submit
      }, busy ? C.submitting : C.submit)
    )
  }, hd, sub, picker,
    err ? el('div', { className: 'pair-err' }, err) : null,
    busy ? el('div', { className: 'pair-busy' }, C.submitting) : null,
    form, result,
    el('div', { className: 'pair-pay' }, C.notes)
  );
}

/* ---------- 节140 T3d：GuoxueHubPage 已删除（入口由首页意图卡 / /explore 提供） ---------- */

/* ---------- REQ-126：③ 择吉与时势 新页（/guoxue/tools，需登录） ----------
   4 功能卡：黄历择日（→almanac，免档案）/ 八字起名（复用 NamerModal）/
   双人配对（八法配对 + 八字配对 → openPairAnalyze）/ 时势推演（皇极经世 + 太乙神数，均已实现）。
   「黄历免档案」仅指已登录下无需选档案；整页需登录（AUTH_REQUIRED_PAGES 含 guoxue-tools）。 */
function GuoxueToolsPage({
  onNavigate,
  applySkin
}) {
  const el = React.createElement;
  const [namerOpen, setNamerOpen] = useState(false);
  const actBtn = (label, onClick) => el('button', {
    type: 'button',
    className: 'btn btn-outline tools-act',
    onClick: onClick
  }, label);
  const cards = [{
    name: ML_COPY.ui.hub['tools-almanac-name'],
    sub: ML_COPY.ui.hub['tools-almanac-sub'],
    bar: 'var(--skin-accent)',
    ico: 'calendar',
    to: () => onNavigate('almanac')
  }, {
    name: ML_COPY.ui.hub['tools-namer-name'],
    sub: ML_COPY.ui.hub['tools-namer-sub'],
    bar: 'var(--gold-500)',
    ico: 'nine',
    to: () => setNamerOpen(true)
  }, {
    name: ML_COPY.ui.hub['tools-pair-name'],
    sub: ML_COPY.ui.hub['tools-pair-sub'],
    bar: 'var(--cinnabar)',
    ico: 'orbit',
    actions: [
      actBtn(ML_COPY.ui.hub['tools-pair-guoxue'], function () { return openPairAnalyze({ module: 'guoxue' }); }),
      actBtn(ML_COPY.ui.hub['tools-pair-bazi'], function () { return openPairAnalyze({ module: 'bazi' }); })
    ]
  }, {
    name: ML_COPY.ui.hub['tools-shishi-name'],
    sub: ML_COPY.ui.hub['tools-shishi-sub'],
    bar: 'var(--cinnabar)',
    ico: 'huangji',
    actions: [
      actBtn(ML_COPY.ui.hub['tools-shishi-huangji'], function () { return onNavigate('huangji'); }),
      actBtn(ML_COPY.ui.hub['tools-shishi-taiyi'], function () { return onNavigate('taiyi'); })
    ]
  }];
  return el('div', {
    className: 'container'
  }, el('div', {
    className: 'hub-title'
  }, el(Icon, {
    name: 'calendar',
    size: 22
  }), ML_COPY.ui.hub['guoxue-card-tools-name']), el('div', {
    className: 'hub-grid'
  }, cards.map((c, i) => el('div', {
    key: i,
    className: 'hub-card',
    onClick: c.to || undefined
  }, el('span', {
    className: 'hc-bar',
    style: {
      background: c.bar
    }
  }), el(Icon, {
    name: c.ico,
    size: 28,
    className: 'hc-ico'
  }), el('div', {
    className: 'hc-body'
  }, el('div', {
    className: 'hc-name'
  }, c.name), el('div', {
    className: 'hc-sub'
  }, c.sub), c.actions ? el('div', {
    className: 'tools-actions',
    onClick: function (e) {
      e.stopPropagation();
    }
  }, c.actions) : null)))), namerOpen ? el(NamerModal, {
    caseId: null,
    caseName: '',
    onClose: function () {
      setNamerOpen(false);
    }
  }) : null);
}
