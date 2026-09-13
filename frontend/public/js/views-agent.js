// 王先生 Agent 域视图（节110 阶段3）：王先生会话页 AgentPage + 开场白候选 AGENT_GREETINGS + 档案关键词 AGENT_CASE_KEYWORDS + randomAgentGreeting/agentLooksCaseRelated
// 加载于 views-guoxue-tools.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

// ===== REQ-076：王先生 Agent 会话页 =====
// 固定 session 对话（C 端对话大师）：顶部档案下拉（仅本人档案，可随时切换）。
// REQ-113④：会话不提供不选档案的闲聊 —— 进入默认选中「默认档案」（无默认的存量账号
// 回退选中最新一份），无档案时提示先建档；下拉切换到非默认档案时弹确认窗口
// （「设为默认档案」重新定义默认 / 「仅临时使用」，对应 PATCH /api/cases/{id} set_default）。
// 接口：GET /api/agent/messages（本人历史，id 升序，limit=50）、POST /api/agent/chat
// （每来回按 LLM 实际 token 扣余额，小额计费；5002 余额不足由 api() 拦截弹 CreditInsufficientModal）。
// BUG-014：开场白不再取 GET /api/agent/greeting（后端当前返回的是开发说明文件文本，不应作为开场展示）；
// 改由前端「既有 4 候选」随机 4 选 1 作为首条 assistant 消息（对齐 REQ-076⑤⑥：候选池独立、仅开场用、不并回 system prompt）。
// 纯文本 pre-wrap 展示（assistant 为自然语言纯文本），无 dangerouslySetInnerHTML。
const AGENT_CASE_KEYWORDS = ['档案','命盘','八字','紫微','星盘','本命','排盘','命宫','身宫','大运','流年'];
// BUG-014：开场白候选池（对齐 backend/prompts/agent/greeting.md 既有 4 条话术；仅开场展示用，不入 system prompt）
const AGENT_GREETINGS = [
  '有缘相见，我是王先生。人生如棋局，落子无悔；心事如浮云，看开即散。今日有什么想说的，不妨慢慢道来。',
  '来，先坐，喝口茶。命里的事急不来，心里的事放得下。你我闲话几句，你想从哪儿说起？',
  '我是王先生，陪你聊聊这烟火人间。悲欢离合、得失起落，看开了都是修行。近来可有什么心事？',
  '一盏清茶，几句闲话。我是王先生，懂些命理，更懂人心。今日相逢，你想问些什么，或只是想找人说说话？'
];
function randomAgentGreeting() {
  return AGENT_GREETINGS[Math.floor(Math.random() * AGENT_GREETINGS.length)];
}
function agentLooksCaseRelated(text) {
  return AGENT_CASE_KEYWORDS.some(function (k) { return text.indexOf(k) >= 0; });
}
function AgentPage({
  onNavigate
}) {
  const el = React.createElement;
  // null=加载中；[]=无档案；数组=已就绪（仅本人档案）
  const [caseList, setCaseList] = useState(null);
  const [caseErr, setCaseErr] = useState('');
  const [caseId, setCaseId] = useState(''); // ''=未选（无档案/加载中；REQ-113④ 不提供无档案闲聊）
  // REQ-113④：切换非默认档案的确认弹窗 {id, name}；null=关闭
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switchBusy, setSwitchBusy] = useState(false);
  // 会话：null=加载中；数组=已就绪 [{role:'user'|'assistant', content, hint?, pending?}]
  const [messages, setMessages] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const chatRef = useRef(null);
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();

  // ① 档案下拉数据源：GET /cases（登录后本人档案列表）。
  //    REQ-113④：进入会话默认选中「默认档案」（列表 isDefault）；无默认档案的存量账号
  //    （老数据未标默认）回退选中最新一份（仅临时选中，不改默认）；无档案则留空提示先建档。
  useEffect(function () {
    let alive = true;
    (async function () {
      try {
        const r = await api('/cases', { method: 'GET' });
        if (!alive) return;
        const arr = (r && r.data && r.data.cases) || (r && r.cases) || [];
        const list = Array.isArray(arr) ? arr : [];
        setCaseList(list);
        if (list.length) {
          const def = list.find(function (c) { return c && c.isDefault; }) || list[0];
          setCaseId(String(def.caseId));
        }
      } catch (e) {
        if (!alive) return;
        if (e && e.status === 401) return; // 401 由 App 统一跳登录
        setCaseErr((e && e.message) || UI_COPY.agent['case-list-fail']);
        setCaseList([]);
      }
    })();
    return function () { alive = false; };
  }, []);

  // ② 进入页面：开场白 + 历史。开场白作为第一条 assistant 消息展示；
  //    BUG-014：开场白由前端 4 候选随机 4 选 1（不再取 /agent/greeting，避免把「开发说明文件」文本当开场展示）；
  //    有历史 → 原样展示历史（开场白只在全新会话出现，不重复前置）。
  useEffect(function () {
    let alive = true;
    (async function () {
      let hist = [];
      let err = '';
      try {
        const hr = await api('/agent/messages?limit=50');
        const list = (hr && hr.data && hr.data.messages) || (hr && hr.messages) || [];
        hist = (Array.isArray(list) ? list : []).map(function (m) {
          return { role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content != null ? m.content : '') };
        });
      } catch (e) {
        err = (e && e.message) || '历史消息加载失败，请重试。';
      }
      if (!alive) return;
      let msgs;
      if (hist.length) {
        // BUG-014：有历史 → 原样展示（开场白仅在全新会话随机 4 选 1 作为首条，不重复前置）
        msgs = hist;
      } else {
        msgs = [{ role: 'assistant', content: randomAgentGreeting(), greeting: true }];
      }
      setMessages(msgs);
      if (err) setLoadErr(err);
    })();
    return function () { alive = false; };
  }, []);

  // ③ 消息变化 → 滚动到底
  useEffect(function () {
    const node = chatRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  const caseName = function (id) {
    const c = (caseList || []).find(function (x) { return String(x.caseId) === String(id); });
    if (!c) return '';
    const nm = (c.name && String(c.name).trim()) || '档案 ' + c.caseId;
    if (c.birthYear != null && c.birthYear !== '') return nm + '（' + String(c.birthYear) + ' 年）';
    return nm;
  };

  // ④ 发送：追加 user 气泡 + 「正在聆听…」占位 → POST chat
  //    → 用 reply 替换占位；失败（5002 余额不足已弹充值引导）移除占位并展示错误文本。
  //    REQ-113④：不提供不选档案的闲聊 —— caseId 为空（无档案）时引导先建档，不发请求。
  const handleSend = async function () {
    const text = input.trim();
    if (!text || sending) return;
    if (!caseId) {
      toast(TC_COPY.ui.toast['agent-please-create-case']);
      return;
    }
    setSendErr('');
    setInput('');
    const next = [{ role: 'user', content: text }];
    next.push({ role: 'assistant', content: '正在聆听…', pending: true });
    setMessages(function (prev) { return (prev || []).concat(next); });
    setSending(true);
    try {
      const r = await api('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, case_id: Number(caseId) })
      });
      const reply = (r && r.data && r.data.reply) ? String(r.data.reply) : '';
      setMessages(function (prev) {
        const arr = prev.slice();
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].pending) {
            arr[i] = { role: 'assistant', content: reply };
            break;
          }
        }
        return arr;
      });
    } catch (e) {
      setSendErr((e && e.message) || '王先生暂时没有回应，请稍后重试。');
      setMessages(function (prev) { return (prev || []).filter(function (m) { return !m.pending; }); });
    } finally {
      setSending(false);
    }
  };
  const onInputKey = function (e) {
    if (e.key === 'Enter' && !(e.nativeEvent && e.nativeEvent.isComposing)) {
      e.preventDefault();
      handleSend();
    }
  };

  const selName = caseId ? caseName(caseId) : '';
  // REQ-113④：下拉切换档案 —— 目标即默认档案直接选中；目标为非默认档案时弹确认窗口
  // （「设为默认档案」重新定义默认 / 「仅临时使用」），确认前不改变当前选择。
  const onPickCase = function (id) {
    setSendErr('');
    if (!id || String(id) === String(caseId)) return;
    const target = (caseList || []).find(function (c) { return String(c.caseId) === String(id); });
    if (!target) return;
    const def = (caseList || []).find(function (c) { return c && c.isDefault; });
    if (def && String(def.caseId) === String(id)) {
      setCaseId(id);
      return;
    }
    const nm = (target.name && String(target.name).trim()) || '档案 ' + target.caseId;
    setSwitchTarget({ id: String(target.caseId), name: nm });
  };
  const confirmSwitchAsDefault = async function () {
    if (!switchTarget || switchBusy) return;
    setSwitchBusy(true);
    try {
      const res = await api('/cases/' + switchTarget.id, {
        method: 'PATCH',
        body: JSON.stringify({ set_default: true })
      });
      if (res && res.code != null && res.code !== 0) throw new Error(res && res.message || '设置失败');
      setCaseId(switchTarget.id);
      setCaseList(function (prev) {
        return (prev || []).map(function (c) {
          return Object.assign({}, c, { isDefault: String(c.caseId) === switchTarget.id });
        });
      });
      setSwitchTarget(null);
      toast(TC_COPY.ui.toast['agent-set-default-ok']);
    } catch (e) {
      toast((e && e.message) || TC_COPY.ui.toast['agent-set-default-fail']);
    } finally {
      setSwitchBusy(false);
    }
  };
  const confirmSwitchTemporary = function () {
    if (!switchTarget) return;
    setCaseId(switchTarget.id);
    setSwitchTarget(null);
    toast(TC_COPY.ui.toast['agent-temp-switch-ok']);
  };
  // 档案下拉：无档案时不提供「暂不选（闲聊）」选项（REQ-113④：不提供无档案闲聊）
  const pick = el('div', { className: 'agent-pick' },
    el('select', {
      value: caseId,
      onChange: function (e) { onPickCase(e.target.value); },
      disabled: sending || caseList === null || !(caseList && caseList.length),
      'aria-label': '选择档案（仅本人档案）'
    },
    caseList && caseList.length ? caseList.map(function (c) {
      const id = String(c.caseId);
      const nm = (c.name && String(c.name).trim()) || '档案 ' + c.caseId;
      const label = c.birthYear != null && c.birthYear !== '' ? nm + '（' + String(c.birthYear) + ' 年）' : nm;
      return el('option', { key: id, value: id }, label);
    }) : el('option', { value: '' }, '暂无档案')),
    caseList === null ? el('div', { className: 'agent-pick-hint' }, '档案加载中…')
      : caseList && caseList.length ? null
      : el('div', { className: 'agent-pick-hint' }, '暂无档案，请先建立一份'));

  // 计费提示（可点击跳转余额明细，复用既有 credits 入口）
  const bill = el('div', { className: 'agent-bill' },
    el('span', null, '每轮对话按实际用量扣余额（¥）'),
    el('span', { className: 'bill-link', onClick: function () { onNavigate('credits'); } }, '查看余额明细'),
    selName ? el('span', { className: 'agent-sel-tag' }, '已选：' + selName) : null);

  // 消息区：加载 / 空态 / 气泡列表 三态
  let chatBody;
  if (messages === null) {
    chatBody = el('div', { className: 'agent-chat' },
      el('div', { className: 'agent-loading' },
        el('div', { className: 'agent-loading-dot' }),
        el('span', null, '正在为你沏茶…')));
  } else if (messages.length === 0) {
    chatBody = el('div', { className: 'agent-chat' },
      el('div', { className: 'agent-empty' },
        el('div', { className: 'agent-empty-icon' }, el(Icon, { name: 'chat', size: 28 })),
        el('div', null, '王先生在这儿，有什么想聊聊的？'),
        el('div', null, caseList && caseList.length ? '已默认选中你的档案，可直接开口。' : '请先建立一份档案，再与王先生对话。')));
  } else {
    chatBody = el('div', { className: 'agent-chat', ref: chatRef },
      messages.map(function (m, i) {
        return el('div', {
          key: i,
          className: 'agent-msg ' + m.role + (m.hint ? ' hint' : '') + (m.pending ? ' pending' : '')
        },
        el('div', { className: 'agent-bubble' }, m.content));
      }));
  }

  const inputRow = el('div', { className: 'agent-input-row' },
    el('input', {
      className: 'agent-input',
      type: 'text',
      value: input,
      onChange: function (e) { setInput(e.target.value); },
      onKeyDown: onInputKey,
      placeholder: selName ? '向王先生提问（已结合「' + selName + '」）…' : '请先建立档案，再与王先生对话…',
      disabled: sending || !caseId,
      maxLength: 500
    }),
    el('button', {
      type: 'button',
      className: 'agent-send',
      onClick: handleSend,
      disabled: sending || !input.trim() || !caseId
    }, sending ? '聆听中' : ['发送', payBadge(payEnough)]));

  // REQ-113④：切换非默认档案的确认弹窗 —— 「设为默认档案」重新定义默认 / 「仅临时使用」
  // REQ-113④：切换非默认档案的确认弹窗 —— 已迁移至 ModalBase（2026-09-10）
  const switchModal = switchTarget ? el(ModalBase, {
    title: '切换档案',
    onClose: function () { if (!switchBusy) setSwitchTarget(null); },
    maskClosable: !switchBusy,
    footer: el(React.Fragment, null,
      el('button', { type: 'button', className: 'btn btn-primary', disabled: switchBusy, onClick: confirmSwitchAsDefault }, switchBusy ? '设置中…' : '设为默认档案'),
      el('button', { type: 'button', className: 'btn btn-outline', disabled: switchBusy, onClick: confirmSwitchTemporary }, '仅临时使用'),
      el('button', { type: 'button', className: 'btn btn-outline', disabled: switchBusy, onClick: function () { setSwitchTarget(null); } }, UI_COPY.buttons.cancel)
    )
  },
    el('p', { style: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '6px 0 2px' } },
      '「' + switchTarget.name + '」不是当前默认档案。'),
    el('p', { style: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 6px' } },
      '要将它设为默认档案，还是仅本次临时使用？')
  ) : null;

  return el('div', { className: 'agent-page' },
    el('div', { className: 'agent-head' },
      el('div', { className: 'agent-title' }, el(Icon, { name: 'chat', size: 20 }), ' 王先生'),
      pick),
    bill,
    loadErr ? el('div', { className: 'agent-err' }, loadErr) : null,
    caseErr && !(caseList && caseList.length) ? el('div', { className: 'agent-err' }, caseErr) : null,
    chatBody,
    sendErr ? el('div', { className: 'agent-err' }, sendErr) : null,
    inputRow,
    switchModal);
}
