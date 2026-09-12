// 国学工具域视图（节110 阶段3）：九法合一 NinePickPage + 起名 NamerModal + 国学 HUB GuoxueHubPage + 择吉与时势 GuoxueToolsPage + 九法状态 nineRunState
// 加载于 views-home.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- REQ-068：九法合一 · 选择档案（档案与九法解耦后的九法入口） ---------- */
// 档案「九法」状态（依赖 /cases 列表的 status / hasReport / methodCount）：
//   view=true  已跑过九法 → 「查看 / 修改结果」可用（进入结果查看，含校准/追问/重跑修改链路）
//   go=false   未排盘（无 Chart 盘面，断前尘链路无法启动）→ 引导先去档案管理执行排盘
// 档案是独立数据实体：九法合一只是一种使用方式，未跑九法不影响建档/排盘/档案查看。
function nineRunState(c) {
  const st = String(c && c.status || '');
  const mc = Number(c && c.methodCount) || 0;
  if (!c || st === 'created') {
    return {
      view: false,
      go: false,
      label: UI_COPY.guoxueTools['status-not-paipan'],
      cls: 'none'
    };
  }
  if ((c && c.hasReport) || st === 'predict_done') return {
    view: true,
    go: true,
    label: UI_COPY.guoxueTools['status-done'],
    cls: ''
  };
  if (st === 'predict_running') return {
    view: true,
    go: true,
    label: UI_COPY.guoxueTools['status-generating'],
    cls: ''
  };
  if (st === 'calibrated') return {
    view: true,
    go: true,
    label: UI_COPY.guoxueTools['status-calibrated'],
    cls: ''
  };
  if (st === 'dqc_done') return {
    view: true,
    go: true,
    label: UI_COPY.guoxueTools['status-duanqianchen'],
    cls: ''
  };
  if (st === 'dqc_running') return {
    view: false,
    go: true,
    label: UI_COPY.guoxueTools['status-running'],
    cls: 'none'
  };
  if (mc > 0) return {
    view: false,
    go: true,
    label: '九法进行中（' + mc + '/9）',
    cls: 'none'
  };
  return {
    view: false,
    go: true,
    label: UI_COPY.guoxueTools['status-not-run'],
    cls: 'none'
  };
}
function NinePickPage({
  caseId,
  onNavigate
}) {
  const el = React.createElement;
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  // null = 读取中；[] = 无档案
  const [list, setList] = useState(null);
  const [errored, setErrored] = useState('');
  const [selId, setSelId] = useState(caseId != null && String(caseId).trim() ? String(caseId) : '');
  const load = async () => {
    setErrored('');
    try {
      const res = await api('/cases', {
        method: 'GET'
      });
      const arr = res.data && res.data.cases || res.cases || [];
      setList(arr);
      // 预选档案（如 returnTo=nine 建档回跳）在列表中不存在时清空，避免悬空选中
      if (selId && !arr.some(c => String(c.caseId) === String(selId))) setSelId('');
    } catch (e) {
      setErrored(e.message || UI_COPY.guoxueTools['case-list-fail']);
    }
  };
  // 初次进入加载档案；从建档页回跳（caseId 变化，本页复用不重挂载）时重载并预选新档案
  useEffect(() => {
    if (caseId != null && String(caseId).trim()) setSelId(String(caseId));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);
  const selCase = selId ? (list || []).find(c => String(c.caseId) === String(selId)) || null : null;
  const stSel = nineRunState(selCase);
  const selNm = selCase ? (selCase.name || '档案 ' + selCase.caseId) : '';
  // —— 档案选择卡片（复用 星座/MBTI 的 case-opt 可选卡样式：明显可选 + 选中态 ✓）——
  let pickBody;
  if (!list && !errored) {
    pickBody = el('div', {
      style: {
        textAlign: 'center',
        color: 'var(--text-2)',
        padding: '24px 12px',
        fontSize: 13
      }
    }, UI_COPY.guoxueTools['case-loading']);
  } else if (errored && !(list && list.length)) {
    pickBody = el('div', {
      className: 'card failed-box',
      style: {
        marginTop: 4
      }
    }, el('div', {
      className: 'section-title'
    }, UI_COPY.guoxueTools['case-load-fail']), el('div', {
      className: 'error'
    }, errored), el('div', {
      className: 'back-row',
      style: {
        justifyContent: 'center'
      }
    }, el('button', {
      className: 'btn btn-primary',
      style: {
        width: 'auto'
      },
      onClick: load
    }, UI_COPY.buttons.retry), el('button', {
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: () => onNavigate('landing')
    }, UI_COPY.buttons.back_home)));
  } else if (!list || list.length === 0) {
    pickBody = el('div', {
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
    }, '暂无档案：请先建立一份出生档案并排盘（确定性计算、零 LLM），再回到这里发起九法合一；九法合一只针对所选档案，建档本身不启动九法流程。'), el('div', {
      className: 'back-row',
      style: {
        justifyContent: 'center'
      }
    }, el('button', {
      className: 'btn btn-primary',
      style: {
        width: 'auto'
      },
      onClick: () => onNavigate('onboarding', {
        returnTo: 'nine'
      })
    }, UI_COPY.buttons.create_case), el('button', {
      className: 'btn btn-outline',
      style: {
        width: 'auto'
      },
      onClick: () => onNavigate('cases')
    }, UI_COPY.guoxueTools['manage-case'])));
  } else {
    // REQ-137：九法合一选档案改下拉（对齐生肖流年下拉样式：档案名/生日展示、选中即用）；
    // 九法状态短标并入选项文本，选中后操作区展示完整状态与可用动作。
    pickBody = el('select', {
      className: 'input',
      value: selId || '',
      onChange: e => setSelId(e.target.value),
      style: {
        marginBottom: 0
      }
    }, el('option', {
      value: ''
    }, UI_COPY.guoxueTools['select-case-ph']), list.map(c => {
      const st = nineRunState(c);
      const nm = c.name || '档案 ' + c.caseId;
      const birth = c.birthYear ? '（' + c.birthYear + ' 年生）' : '';
      return el('option', {
        key: c.caseId,
        value: String(c.caseId)
      }, nm + birth + (st.label ? ' · ' + st.label : ''));
    }));
  }
  // —— 操作区：勾选档案后出现两个动作 ——
  const actionCard = el('div', {
    className: 'card',
    style: {
      marginTop: 10
    }
  }, el('div', {
    className: 'section-title'
  }, UI_COPY.guoxueTools['start-btn']), selCase ? el('div', null, el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      lineHeight: 1.7,
      marginBottom: 8
    }
  }, '已选档案：', el('b', null, selNm), '（', stSel.label, '）'), stSel.view ? el('p', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.8,
      margin: '0 0 10px'
    }
  }, '该档案已跑过九法：可点「查看 / 修改结果」进入结果查看（综合解读 + 校准记录/追问/重跑修改）；如校准或档案信息有更新，可再点「跑九法合一开始预测」重跑，沿用现有异步编排、幂等与断点续跑。') : stSel.go ? el('p', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.8,
      margin: '0 0 10px'
    }
  }, '命盘已备，九法待启。先生将以此盘为基，综九家之言，解您所问') : el('p', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.8,
      margin: '0 0 10px'
    }
  }, '该档案尚未排盘（无盘面数据）：请先到「管理档案」对该档案执行排盘（确定性计算、零 LLM）后，再回来发起九法合一。'), el('div', {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, el('button', {
    className: 'btn btn-primary',
    style: {
      flex: '1 1 190px'
    },
    disabled: !stSel.go,
    title: stSel.go ? '' : '该档案尚未排盘，请先执行排盘',
    onClick: () => onNavigate('waiting', {
      caseId: selId
    })
  }, [UI_COPY.buttons.start_predict, payBadge(payEnough)]), el('button', {
    className: 'btn btn-outline',
    style: {
      flex: '1 1 190px'
    },
    disabled: !stSel.view,
    title: stSel.view ? '' : '该档案尚未跑过九法，请先点击「跑九法合一开始预测」',
    onClick: () => onNavigate('predict', {
      caseId: selId
    })
  }, UI_COPY.guoxueTools['view-btn']))) : el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.7
    }
  }, '请先在上方选择一份档案：勾选后此处出现「查看 / 修改结果」（已跑九法）与「跑九法合一开始预测」（未跑 / 续跑）两个操作。'), el('div', {
    style: {
      fontSize: 12,
      color: 'var(--cinnabar)',
      fontWeight: 600,
      marginTop: 8,
      lineHeight: 1.7
    }
  }, '九法合一汇聚九术同参共断，所耗余额相应较多，将按实际用量从账户扣除。此为趋势参考，不作任何决策建议'));
  const listActions = list && list.length > 0 ? el('div', {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      margin: '4px 0 2px'
    }
  }, el('button', {
    className: 'btn btn-outline',
    style: {
      width: 'auto'
    },
    onClick: () => onNavigate('onboarding', {
      returnTo: 'nine'
    })
  }, '+ ' + UI_COPY.buttons.create_case), el('button', {
    className: 'btn btn-outline',
    style: {
      width: 'auto'
    },
    onClick: () => onNavigate('cases')
  }, UI_COPY.guoxueTools['manage-case'])) : null;
  return el('div', {
    className: 'container'
  }, el('div', {
    className: 'hub-title'
  }, el(Icon, {
    name: 'nine',
    size: 22
  }), UI_COPY.guoxueTools.title), el('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      lineHeight: 1.7,
      marginBottom: 6
    }
  }, '档案是独立数据实体，九法合一只是一种使用方式：选中档案后可发起「断前尘 → 问卷校准 → 综合预测」，或查看/修改已跑过的九法解读结果。'), el('div', {
    className: 'step-hint'
  }, el('span', {
    className: 'sh' + (selCase ? '' : ' cur')
  }, '① 选择档案'), el('span', {
    className: 'sh-arr'
  }, '→'), el('span', {
    className: 'sh' + (selCase ? ' cur' : '')
  }, '② 查看 / 修改结果 · 跑九法合一开始预测')), el('div', {
    className: 'card'
  }, el('div', {
    className: 'section-title'
  }, '选择档案 · 九法合一'), el('div', {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      lineHeight: 1.7,
      marginBottom: 4
    }
  }, '勾选档案后不会自动启动九法流程：请在下方操作区选择「查看 / 修改结果」或「跑九法合一开始预测」。'), pickBody, listActions, actionCard), el('div', {
    className: 'back-row'
  }, el('button', {
    className: 'btn btn-outline',
    onClick: () => onNavigate('guoxue-hub')
  }, UI_COPY.buttons.back_options), el('button', {
    className: 'btn btn-outline',
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home)));
}

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
      toast('请先选择档案');
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
      setListErr(e && e.message ? e.message : '档案列表加载失败，请重试。');
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
    ? (caseName || '档案 ' + caseId)
    : (curCase ? ((curCase.name && String(curCase.name).trim()) || '档案 ' + curCase.caseId) : '');
  const sub = curName ? el('div', {
    className: 'pair-sub'
  }, fmtTpl(C.caseLine, {
    case: curName
  })) : null;
  const caseOptions = [el('option', {
    key: '__ph__',
    value: ''
  }, '— 请选择档案 —')].concat((Array.isArray(caseList) ? caseList : []).map(c => el('option', {
    key: String(c.caseId),
    value: String(c.caseId)
  }, (c.name && String(c.name).trim()) || '档案 ' + c.caseId)));
  // REQ-100：未预选档案时弹窗内自选档案（默认已选中默认档案/最新一份），起名主流程不变
  const picker = caseId != null && String(caseId).trim() ? null : el('div', {
    className: 'pair-sec'
  }, el('div', {
    className: 'pair-sec-label'
  }, el('span', {
    className: 'ps-n'
  }, '档'), '档案'), caseList === null ? el('div', {
    className: 'pair-busy'
  }, '档案列表加载中…') : listErr ? el('div', null, el('div', {
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
  }, '重试档案'))) : Array.isArray(caseList) && caseList.length === 0 ? el('div', {
    className: 'pair-err'
  }, '暂无可用档案：请先建立一份出生档案并完成排盘后再来起名。') : el('select', {
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
  }, '姓'), '姓氏'), el('input', {
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
  }, '向'), '起名方向', el('span', {
    style: {
      fontWeight: 400,
      color: 'var(--text-3)',
      fontSize: 11.5
    }
  }, '（选填）')), el('input', {
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
    }, '名「' + given + '」') : null, adjusted ? el('span', {
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

/* ---------- 国学预测 HUB ---------- */
function GuoxueHubPage({
  onNavigate,
  applySkin
}) {
  // REQ-126：国学 HUB 改 4 张场景大卡（① 命盘·九法合一 / ② 问事·即时起卦 / ③ 择吉与时势 /
  // ④ 生肖流年）。原 6 方法卡（黄历择日/太乙/皇极）与 REQ-100 同排 3 键（九法配对/八字配对/
  // 档案起名）收归 ③「择吉与时势」新页 GuoxueToolsPage（/guoxue/tools，需登录）。本 HUB 保持公开页。
  const cards = [{
    name: TC_COPY.ui.hub['guoxue-card-nine-name'],
    sub: TC_COPY.ui.hub['guoxue-card-nine-sub'],
    bar: 'var(--skin-accent)',
    ico: 'nine',
    to: () => onNavigate('nine-pick')
  }, {
    name: TC_COPY.ui.hub['guoxue-card-divination-name'],
    sub: TC_COPY.ui.hub['guoxue-card-divination-sub'],
    bar: 'var(--gold-500)',
    ico: 'orbit',
    to: () => onNavigate('divination')
  }, {
    name: TC_COPY.ui.hub['guoxue-card-tools-name'],
    sub: TC_COPY.ui.hub['guoxue-card-tools-sub'],
    bar: 'var(--cinnabar)',
    ico: 'calendar',
    to: () => onNavigate('guoxue-tools')
  }, {
    name: TC_COPY.ui.hub['guoxue-zodiac-name'],
    sub: TC_COPY.ui.hub['guoxue-zodiac-sub'],
    bar: 'var(--cinnabar)',
    ico: 'spark',
    to: () => onNavigate('zodiac')
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hub-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "nine",
    size: 22
  }), TC_COPY.ui.module_hub.guoxue_title), /*#__PURE__*/React.createElement("div", {
    className: "hub-grid"
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hub-card",
    onClick: () => c.to()
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

/* ---------- REQ-126：③ 择吉与时势 新页（/guoxue/tools，需登录） ----------
   4 功能卡：黄历择日（→almanac，免档案）/ 八字起名（复用 NamerModal）/
   双人配对（九法配对 + 八字配对 → openPairAnalyze）/ 时势推演（皇极经世 + 太乙神数，均已实现）。
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
    name: TC_COPY.ui.hub['tools-almanac-name'],
    sub: TC_COPY.ui.hub['tools-almanac-sub'],
    bar: 'var(--skin-accent)',
    ico: 'calendar',
    to: () => onNavigate('almanac')
  }, {
    name: TC_COPY.ui.hub['tools-namer-name'],
    sub: TC_COPY.ui.hub['tools-namer-sub'],
    bar: 'var(--gold-500)',
    ico: 'nine',
    to: () => setNamerOpen(true)
  }, {
    name: TC_COPY.ui.hub['tools-pair-name'],
    sub: TC_COPY.ui.hub['tools-pair-sub'],
    bar: 'var(--cinnabar)',
    ico: 'orbit',
    actions: [
      actBtn(TC_COPY.ui.hub['tools-pair-guoxue'], function () { return openPairAnalyze({ module: 'guoxue' }); }),
      actBtn(TC_COPY.ui.hub['tools-pair-bazi'], function () { return openPairAnalyze({ module: 'bazi' }); })
    ]
  }, {
    name: TC_COPY.ui.hub['tools-shishi-name'],
    sub: TC_COPY.ui.hub['tools-shishi-sub'],
    bar: 'var(--cinnabar)',
    ico: 'huangji',
    actions: [
      actBtn(TC_COPY.ui.hub['tools-shishi-huangji'], function () { return onNavigate('huangji'); }),
      actBtn(TC_COPY.ui.hub['tools-shishi-taiyi'], function () { return onNavigate('taiyi'); })
    ]
  }];
  return el('div', {
    className: 'container'
  }, el('div', {
    className: 'hub-title'
  }, el(Icon, {
    name: 'calendar',
    size: 22
  }), TC_COPY.ui.hub['guoxue-card-tools-name']), el('div', {
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
