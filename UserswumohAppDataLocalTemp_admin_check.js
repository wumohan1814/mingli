
const {
  useState,
  useEffect
} = React;
const TOKEN_KEY = 'taichu_admin_token';
const ROLE_KEY = 'taichu_admin_role';
let onUnauthorized = null; // 由 App 注册：401 时回登录页

const STATUS_TEXT = {
  created: '已建档',
  paipan_done: '已排盘',
  calibrated: '已校准',
  predicted: '已预测',
  predict_done: '已解读',
  failed: '失败'
};
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
function logoutLocal() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

// 轻提示
function toast(msg) {
  let t = document.getElementById('taichu-admin-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'taichu-admin-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(function () {
    t.classList.remove('show');
  }, 2400);
}

// 统一请求：path 传完整 /admin/... 路径；响应 {code,data} 信封，code!==0 抛错；401 自动登出
async function api(path, options) {
  options = options || {};
  const headers = Object.assign({}, options.headers || {});
  // FormData（素材上传）由浏览器自动带 multipart boundary，禁止手动设 JSON Content-Type
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const tk = getToken();
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  let res;
  try {
    res = await fetch(path, Object.assign({}, options, {
      headers: headers
    }));
  } catch (e) {
    throw new Error('网络错误，无法连接服务器');
  }
  let body = null;
  try {
    body = await res.json();
  } catch (e) {/* 非 JSON 响应 */}
  const pickMsg = function (b) {
    if (!b) return '';
    const d = b.detail;
    if (typeof d === 'string' && d) return d;
    if (Array.isArray(d) && d.length) return d.map(function (x) {
      return x && x.msg || JSON.stringify(x);
    }).join('；');
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.msg === 'string' && b.msg) return b.msg;
    return '';
  };
  if (res.status === 401) {
    logoutLocal();
    if (onUnauthorized) onUnauthorized();
    throw new Error('登录已过期或无权访问，请重新登录');
  }
  if (!res.ok) throw new Error(pickMsg(body) || '请求失败（HTTP ' + res.status + '）');
  const code = body && typeof body.code === 'number' ? body.code : 0;
  if (code !== 0) throw new Error(pickMsg(body) || '操作失败（code ' + code + '）');
  return body;
}
// 解 {code,data} 信封
function pickData(res) {
  return res && res.data != null ? res.data : res || {};
}
// 时间显示（ISO / 时间戳 容错）
function fmtTime(t) {
  if (t == null || t === '') return '-';
  const s = String(t).replace('T', ' ').replace('Z', '').trim();
  return s.slice(0, 19) || s;
}
function statusText(s) {
  return STATUS_TEXT[s] || s || '-';
}
function statusTag(s) {
  const cls = s === 'failed' ? 'bad' : s && s.indexOf('done') >= 0 ? 'ok' : 'gray';
  return /*#__PURE__*/React.createElement("span", {
    className: 'tag ' + cls
  }, statusText(s));
}

/* ============ 登录页 ============ */
function LoginPage({
  onLoggedIn
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async function (e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api('/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username,
          password: password
        })
      });
      const d = pickData(res);
      if (!d.token) throw new Error('登录失败：未返回令牌');
      localStorage.setItem(TOKEN_KEY, d.token);
      if (d.role) localStorage.setItem(ROLE_KEY, d.role);
      toast('登录成功');
      onLoggedIn(d.token, d.role || localStorage.getItem(ROLE_KEY) || '');
    } catch (err) {
      setError(err.message || '登录失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "login-wrap",
    style: {
      background: 'var(--paper)'
    }
  }, /*#__PURE__*/React.createElement("form", {
    className: "card login-card",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("div", {
    className: "login-brand"
  }, "太初 · 后台管理"), /*#__PURE__*/React.createElement("p", {
    className: "login-sub"
  }, "管理端仅限授权账号登录"), error && /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, error), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "admin-user"
  }, "用户名"), /*#__PURE__*/React.createElement("input", {
    id: "admin-user",
    className: "input",
    value: username,
    onChange: function (e) {
      setUsername(e.target.value);
    },
    placeholder: "请输入管理员用户名",
    autoComplete: "username",
    required: true
  }), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "admin-pass"
  }, "密码"), /*#__PURE__*/React.createElement("input", {
    id: "admin-pass",
    className: "input",
    type: "password",
    value: password,
    onChange: function (e) {
      setPassword(e.target.value);
    },
    placeholder: "请输入密码",
    autoComplete: "current-password",
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 20,
      padding: '12px'
    }
  }, busy ? '登录中…' : '登录')));
}

/* ============ 报表（4 个 metric，表格渲染） ============ */
const REPORT_TABS = [{
  key: 'overview',
  label: '概览',
  desc: '整体业务概览'
}, {
  key: 'funnel',
  label: '漏斗',
  desc: '各环节转化漏斗'
}, {
  key: 'llm_cost',
  label: 'LLM 成本',
  desc: '大模型调用成本统计'
}, {
  key: 'errors',
  label: '错误',
  desc: '错误统计'
}];

// 通用表格：items 为对象数组，列按首次出现顺序展开；对象/数组值 JSON 序列化
function GenericTable({
  items
}) {
  const list = Array.isArray(items) ? items : [];
  const cols = [];
  const seen = {};
  list.forEach(function (it) {
    if (it && typeof it === 'object') {
      Object.keys(it).forEach(function (k) {
        if (!seen[k]) {
          seen[k] = true;
          cols.push(k);
        }
      });
    }
  });
  if (list.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "empty-note"
  }, "暂无数据");
  if (cols.length === 0) {
    // 纯标量列表 → 单列展示
    return /*#__PURE__*/React.createElement("table", {
      className: "admin-table"
    }, /*#__PURE__*/React.createElement("tbody", null, list.map(function (it, i) {
      return /*#__PURE__*/React.createElement("tr", {
        key: i
      }, /*#__PURE__*/React.createElement("td", {
        style: {
          textAlign: 'left'
        }
      }, String(it)));
    })));
  }
  const cellText = function (v) {
    if (v == null || v === '') return '-';
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    }
    return String(v);
  };
  return /*#__PURE__*/React.createElement("table", {
    className: "admin-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map(function (c) {
    return /*#__PURE__*/React.createElement("th", {
      key: c
    }, c);
  }))), /*#__PURE__*/React.createElement("tbody", null, list.map(function (it, i) {
    return /*#__PURE__*/React.createElement("tr", {
      key: i
    }, cols.map(function (c) {
      const txt = cellText(it[c]);
      return /*#__PURE__*/React.createElement("td", {
        key: c,
        title: txt
      }, txt);
    }));
  })));
}
function ReportsSection() {
  const [metric, setMetric] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  useEffect(function () {
    let alive = true;
    setLoading(true);
    setErrored('');
    setData(null);
    (async function () {
      try {
        const res = await api('/admin/reports/' + metric);
        if (alive) {
          setData(pickData(res));
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setErrored(e.message || '报表加载失败');
          setLoading(false);
        }
      }
    })();
    return function () {
      alive = false;
    };
  }, [metric]);
  const active = REPORT_TABS.filter(function (t) {
    return t.key === metric;
  })[0] || REPORT_TABS[0];
  const items = data && Array.isArray(data.items) ? data.items : [];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, "报表"), /*#__PURE__*/React.createElement("p", {
    className: "page-desc"
  }, "按维度查看运营统计（MVP 以表格展示原始 items）"), /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, REPORT_TABS.map(function (t) {
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      className: 'tab' + (metric === t.key ? ' active' : ''),
      onClick: function () {
        setMetric(t.key);
      }
    }, t.label);
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h3", null, active.label, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      fontSize: 12,
      color: 'var(--ink-3)',
      marginLeft: 10
    }
  }, active.desc)), /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginBottom: 12
    }
  }, "接口：/admin/reports/", metric, " · ", items.length, " 条"), errored && /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, errored), loading && /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "正在加载报表…"), !loading && !errored && /*#__PURE__*/React.createElement("div", {
    className: "table-scroll"
  }, /*#__PURE__*/React.createElement(GenericTable, {
    items: items
  }))));
}

/* ============ 档案展示（用户 case 详情） ============ */
function fmtInput(k, v) {
  if (k === 'gender') return v === 'male' ? '男' : v === 'female' ? '女' : v || '-';
  if (v == null || v === '') return '-';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  }
  return String(v);
}
const INPUT_LABELS = {
  name: '档案名',
  birth_year: '出生年',
  birth_month: '出生月',
  birth_day: '出生日',
  birth_hour: '出生时辰',
  gender: '性别',
  birthplace: '出生地',
  longitude: '经度',
  latitude: '纬度',
  true_solar_time: '真太阳时',
  created_at: '建档时间',
  case_id: '档案编号'
};
function inputRows(inp) {
  const obj = inp && typeof inp === 'object' ? inp : {};
  const knownOrder = ['name', 'birth_year', 'birth_month', 'birth_day', 'birth_hour', 'gender', 'birthplace', 'longitude', 'latitude', 'true_solar_time', 'created_at'];
  const rows = [];
  const used = {};
  knownOrder.forEach(function (k) {
    if (k in obj) {
      used[k] = true;
      rows.push([INPUT_LABELS[k] || k, fmtInput(k, obj[k])]);
    }
  });
  Object.keys(obj).forEach(function (k) {
    if (!used[k]) rows.push([INPUT_LABELS[k] || k, fmtInput(k, obj[k])]);
  });
  return rows;
}
// 契合度数值提取（与 C 端 archive 一致）
function probeNum(v) {
  return typeof v === 'number' && isFinite(v) ? v : null;
}
function calibFitValue(calib) {
  const f = (calib && calib.fit) != null ? calib.fit : null;
  if (f == null) return null;
  if (probeNum(f) != null) return probeNum(f);
  if (typeof f !== 'object') return null;
  const keys = ['fit', 'score', 'overall', 'value', 'accuracy'];
  for (let i = 0; i < keys.length; i++) {
    const hit = probeNum(f[keys[i]]);
    if (hit != null) return hit;
  }
  const inner = f.fit && typeof f.fit === 'object' ? f.fit : null;
  if (inner) {
    for (let i = 0; i < keys.length; i++) {
      const hit = probeNum(inner[keys[i]]);
      if (hit != null) return hit;
    }
  }
  return null;
}
function calibCountOf(calib) {
  if (!calib) return null;
  const r = calib.record;
  if (Array.isArray(r)) return r.length;
  if (typeof r === 'number') return r;
  if (typeof r === 'object' && Array.isArray(r.items)) return r.items.length;
  return null;
}
// 盘面摘要：尽力提取文本型摘要；未知结构时给原始 JSON 折叠
function chartSummary(chart) {
  if (!chart || typeof chart !== 'object') return '';
  const src = chart.data && typeof chart.data === 'object' ? chart.data : chart;
  const lines = [];
  if (typeof src.summary === 'string' && src.summary) lines.push(src.summary);else if (src.summary && typeof src.summary === 'object') {
    try {
      lines.push(JSON.stringify(src.summary));
    } catch (e) {}
  }
  if (src.dayMaster) lines.push('日主：' + src.dayMaster + (src.dayMasterWuxing || ''));
  if (typeof src.lunar === 'string' && src.lunar) lines.push('农历 ' + src.lunar);
  if (Array.isArray(chart.degraded) && chart.degraded.length) lines.push('已降级方法：' + chart.degraded.join('、'));
  return lines.join('　');
}
function RawJson({
  data,
  label
}) {
  let txt = '';
  try {
    txt = JSON.stringify(data, null, 2);
  } catch (e) {
    txt = String(data);
  }
  return /*#__PURE__*/React.createElement("details", {
    className: "raw"
  }, /*#__PURE__*/React.createElement("summary", null, label || '查看原始数据'), /*#__PURE__*/React.createElement("pre", {
    className: "json-pre"
  }, txt));
}
function methodName(m, i) {
  if (!m || typeof m !== 'object') return '方法 ' + (i + 1);
  return String(m.method || m.name || m.key || m.method_name || '方法 ' + (i + 1));
}
function CaseArchive({
  userId,
  caseId,
  onBack
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  useEffect(function () {
    let alive = true;
    setLoading(true);
    setErrored('');
    setData(null);
    (async function () {
      try {
        const res = await api('/admin/users/' + encodeURIComponent(userId) + '/cases/' + encodeURIComponent(caseId));
        if (alive) {
          setData(pickData(res));
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setErrored(e.message || '档案加载失败');
          setLoading(false);
        }
      }
    })();
    return function () {
      alive = false;
    };
  }, [userId, caseId]);
  if (loading) return /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "正在加载档案…");
  if (errored) return /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, errored);
  const inp = data && data.input || {};
  const calib = data && data.calibrations || {};
  const calibCount = calibCountOf(calib);
  const calibFit = calibFitValue(calib);
  const calibFitText = calibFit == null ? null : calibFit <= 1 ? Math.round(calibFit * 100) + '%' : String(calibFit);
  const convos = data && Array.isArray(data.conversations) ? data.conversations.filter(function (m) {
    return m && (m.content || m.text);
  }) : [];
  const summary = chartSummary(data && data.chart);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "crumb"
  }, /*#__PURE__*/React.createElement("a", {
    onClick: onBack
  }, "← 返回该用户的 case 列表"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", null, "档案 ", data ? data.caseId : caseId)), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "我的命理档案（管理员视角）"), statusTag(data && data.status)), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "建档信息"), inputRows(inp).length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "无建档信息（input 为空）") : inputRows(inp).map(function (r, i) {
    return /*#__PURE__*/React.createElement("div", {
      className: "kv",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, r[0]), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, r[1]));
  }), /*#__PURE__*/React.createElement(RawJson, {
    data: inp,
    label: "建档信息原始 JSON"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "盘面摘要"), summary ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--ink-1)',
      marginBottom: 6
    }
  }, summary) : /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginBottom: 6
    }
  }, "暂无文本摘要（chart 结构请查看原始数据）"), data && data.chart != null && /*#__PURE__*/React.createElement(RawJson, {
    data: data.chart,
    label: "盘面（chart）原始 JSON"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "校准"), calibCount != null && /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "用户反馈"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, calibCount, " 条断言")), calibFitText != null && /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "整体契合度"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, calibFitText)), calibCount == null && calibFitText == null && /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "暂无校准记录"), data && data.calibrations != null && /*#__PURE__*/React.createElement(RawJson, {
    data: data.calibrations,
    label: "校准原始数据"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "对话（最近 ", Math.min(convos.length, 20), " 条）"), convos.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "暂无对话记录") : convos.slice(-20).map(function (m, i) {
    const isUser = m.role === 'user';
    return /*#__PURE__*/React.createElement("div", {
      className: 'bubble-row' + (isUser ? '' : ' left'),
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: 'bubble ' + (isUser ? 'user' : 'assistant')
    }, /*#__PURE__*/React.createElement("div", {
      className: "who"
    }, isUser ? '用户' : '助手'), m.content != null ? m.content : m.text));
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "方法结果（method_results）"), data && Array.isArray(data.method_results) && data.method_results.length > 0 ? data.method_results.map(function (m, i) {
    const nm = methodName(m, i);
    const st = m && m.status;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: '8px 0',
        borderBottom: '1px dashed var(--line)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: 'var(--jade-deep)'
      }
    }, nm), st ? /*#__PURE__*/React.createElement("span", {
      className: 'tag ' + (st === 'ok' || st === 'done' || st === 'success' ? 'ok' : 'gray')
    }, String(st)) : null), /*#__PURE__*/React.createElement(RawJson, {
      data: m,
      label: "方法结果原始 JSON"
    }));
  }) : /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "暂无方法结果"), data && data.method_results != null && !Array.isArray(data.method_results) && /*#__PURE__*/React.createElement(RawJson, {
    data: data.method_results,
    label: "方法结果原始数据（非数组）"
  })));
}

/* ============ 用户 ============ */
function UsersSection() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errored, setErrored] = useState('');
  // 导航层级：user=null 显示用户列表；casesUser=对象 显示其 case 列表；caseId 显示档案
  const [casesUser, setCasesUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesErr, setCasesErr] = useState('');
  const [caseId, setCaseId] = useState(null);
  // —— 新增 / 删除用户（仅 operator/admin 显示操作；viewer 保持只读）——
  const [showForm, setShowForm] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', nickname: '' });
  const canWrite = (localStorage.getItem(ROLE_KEY) || '') === 'admin' || (localStorage.getItem(ROLE_KEY) || '') === 'operator';
  const search = async function (keyword) {
    setLoadingList(true);
    setErrored('');
    try {
      const kw = String(keyword || '').trim();
      const res = await api('/admin/users?q=' + encodeURIComponent(kw));
      const d = pickData(res);
      setUsers(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setErrored(e.message || '用户列表加载失败');
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(function () {
    search('');
  }, []);
  const createUser = async function (e) {
    e.preventDefault();
    setFormErr('');
    const username = String(newUser.username || '').trim();
    const password = String(newUser.password || '');
    if (!username || !password) {
      setFormErr('用户名与密码均为必填');
      return;
    }
    const payload = { username: username, password: password };
    const nickname = String(newUser.nickname || '').trim();
    if (nickname) payload.nickname = nickname;
    setSavingUser(true);
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      toast('新增用户成功：' + username);
      setNewUser({ username: '', password: '', nickname: '' });
      setShowForm(false);
      search(q); // 刷新列表（新用户按 id 倒序排在最前）
    } catch (err) {
      setFormErr(err.message || '新增用户失败');
    } finally {
      setSavingUser(false);
    }
  };
  const deleteUser = async function (u) {
    if (!window.confirm('确认删除用户「' + u.username + '」（id: ' + u.id + '）？\n将级联删除该用户的全部档案、对话、余额等数据，且不可恢复！')) return;
    setDeletingId(u.id);
    try {
      await api('/admin/users/' + encodeURIComponent(u.id), { method: 'DELETE' });
      toast('已删除用户：' + u.username);
    } catch (err) {
      toast(err.message || '删除失败');
    } finally {
      setDeletingId(null);
      search(q); // 成功/失败都刷新（失败如 1002 说明已被他人删除）
    }
  };
  // 余额充值 / 余额调整（operator+ 才有此按钮；POST /admin/credits/manual，
  // 后端 CreditManualRequest = {user_id, amount_yuan(元口径，可正可负), note}，留审计）
  const adjustBalance = async function (u) {
    const raw = window.prompt('为「' + u.username + '」（id: ' + u.id + '）余额充值 / 余额调整\n请输入金额（单位：元，可带 2 位小数）：\n正数 = 充值（增加余额）\n负数 = 扣减（减少余额）', '');
    if (raw === null) return; // 用户取消
    const text = String(raw).trim();
    const amount = parseFloat(text);
    if (!/^-?\d+(\.\d{1,2})?$/.test(text) || !isFinite(amount) || amount === 0) {
      alert('金额必须为非零数字（元，最多 2 位小数），未提交');
      return;
    }
    const noteRaw = window.prompt('备注（可选，直接点击确定跳过；会写入审计记录）：', '');
    const note = noteRaw === null ? '' : String(noteRaw).trim().slice(0, 500);
    setAdjustingId(u.id);
    try {
      const res = await api('/admin/credits/manual', {
        method: 'POST',
        body: JSON.stringify({
          user_id: u.id,
          amount_yuan: amount,
          note: note
        })
      });
      const d = pickData(res);
      const yuan = d && d.balance_yuan != null ? d.balance_yuan : amount;
      toast('余额调整成功，当前余额 ¥' + yuan);
      search(q); // 刷新列表（重新拉取余额）
    } catch (err) {
      alert(err.message || '余额调整失败');
    } finally {
      setAdjustingId(null);
    }
  };
  const openUser = async function (u) {
    setCasesUser(u);
    setCaseId(null);
    setCases([]);
    setCasesErr('');
    setLoadingCases(true);
    try {
      const res = await api('/admin/users/' + encodeURIComponent(u.id) + '/cases');
      const d = pickData(res);
      setCases(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setCasesErr(e.message || '该用户的 case 列表加载失败');
    } finally {
      setLoadingCases(false);
    }
  };
  const backToUsers = function () {
    setCasesUser(null);
    setCaseId(null);
    setCases([]);
    setCasesErr('');
    search(q); // 返回列表时刷新
  };

  // —— 档案详情层 ——
  if (caseId != null && casesUser) {
    return /*#__PURE__*/React.createElement(CaseArchive, {
      userId: casesUser.id,
      caseId: caseId,
      onBack: function () {
        setCaseId(null);
      }
    });
  }

  // —— case 列表层 ——
  if (casesUser) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      className: "page-title"
    }, "用户档案"), /*#__PURE__*/React.createElement("p", {
      className: "page-desc"
    }, "当前用户：", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--jade-deep)'
      }
    }, casesUser.username), "（id: ", casesUser.id, "）"), /*#__PURE__*/React.createElement("div", {
      className: "crumb"
    }, /*#__PURE__*/React.createElement("a", {
      onClick: backToUsers
    }, "← 返回用户列表")), casesErr && /*#__PURE__*/React.createElement("div", {
      className: "error-box"
    }, casesErr), /*#__PURE__*/React.createElement("div", {
      className: "row-count"
    }, "共 ", cases.length, " 个 case · 点击查看档案详情"), loadingCases && /*#__PURE__*/React.createElement("p", {
      className: "hint"
    }, "正在加载 case 列表…"), !loadingCases && cases.length === 0 && !casesErr && /*#__PURE__*/React.createElement("div", {
      className: "empty-note"
    }, "该用户暂无档案"), !loadingCases && cases.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "table-scroll",
      style: {
        border: 'none'
      }
    }, /*#__PURE__*/React.createElement("table", {
      className: "admin-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "case id"), /*#__PURE__*/React.createElement("th", null, "名称"), /*#__PURE__*/React.createElement("th", null, "状态"), /*#__PURE__*/React.createElement("th", null, "创建时间"), /*#__PURE__*/React.createElement("th", null, "操作"))), /*#__PURE__*/React.createElement("tbody", null, cases.map(function (c) {
      return /*#__PURE__*/React.createElement("tr", {
        key: c.id || c.caseId,
        className: "clickable",
        onClick: function () {
          setCaseId(c.id != null ? c.id : c.caseId);
        }
      }, /*#__PURE__*/React.createElement("td", null, c.id != null ? c.id : c.caseId), /*#__PURE__*/React.createElement("td", null, c.name || '未命名档案'), /*#__PURE__*/React.createElement("td", null, statusTag(c.status)), /*#__PURE__*/React.createElement("td", null, fmtTime(c.created_at)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-mini"
      }, "查看档案")));
    }))))));
  }

  // —— 用户列表层 ——
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, "用户"), /*#__PURE__*/React.createElement("p", {
    className: "page-desc"
  }, "搜索并查看用户及其推演档案"), /*#__PURE__*/React.createElement("form", {
    className: "toolbar",
    onSubmit: function (e) {
      e.preventDefault();
      search(q);
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    style: {
      maxWidth: 260,
      margin: 0
    },
    value: q,
    onChange: function (e) {
      setQ(e.target.value);
    },
    placeholder: "按用户名搜索（留空查全部）"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit"
  }, "搜索"), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "共 ", users.length, " 个用户"), /*#__PURE__*/React.createElement("span", {
    className: "spacer"
  }), canWrite && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "button",
    onClick: function () {
      setFormErr('');
      setShowForm(!showForm);
    }
  }, showForm ? '收起表单' : '＋ 新增用户')), showForm && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "新增用户"), /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      margin: '0 0 6px'
    }
  }, "后台直接创建 C 端账号（免验证码），注册赠送余额按系统配置自动到账。"), formErr && /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, formErr), /*#__PURE__*/React.createElement("form", {
    onSubmit: createUser
  }, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "nu-username"
  }, "用户名（必填）"), /*#__PURE__*/React.createElement("input", {
    id: "nu-username",
    className: "input",
    value: newUser.username,
    onChange: function (e) {
      setNewUser(Object.assign({}, newUser, {
        username: e.target.value
      }));
    },
    placeholder: "3-64 字符，需唯一",
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "nu-password"
  }, "密码（必填）"), /*#__PURE__*/React.createElement("input", {
    id: "nu-password",
    className: "input",
    type: "password",
    value: newUser.password,
    onChange: function (e) {
      setNewUser(Object.assign({}, newUser, {
        password: e.target.value
      }));
    },
    placeholder: "至少 6 位",
    autoComplete: "new-password"
  }), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "nu-nickname"
  }, "昵称（可选）"), /*#__PURE__*/React.createElement("input", {
    id: "nu-nickname",
    className: "input",
    value: newUser.nickname,
    onChange: function (e) {
      setNewUser(Object.assign({}, newUser, {
        nickname: e.target.value
      }));
    },
    placeholder: "用户昵称",
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: savingUser
  }, savingUser ? '创建中…' : '创建用户'), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    disabled: savingUser,
    onClick: function () {
      setFormErr('');
      setShowForm(false);
      setNewUser({
        username: '',
        password: '',
        nickname: ''
      });
    }
  }, "取消")))), errored && /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, errored), loadingList && /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "正在加载用户…"), !loadingList && users.length === 0 && !errored && /*#__PURE__*/React.createElement("div", {
    className: "empty-note"
  }, "未找到匹配的用户"), !loadingList && users.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "table-scroll",
    style: {
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "admin-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "id"), /*#__PURE__*/React.createElement("th", null, "用户名"), /*#__PURE__*/React.createElement("th", null, "余额"), /*#__PURE__*/React.createElement("th", null, "创建时间"), /*#__PURE__*/React.createElement("th", null, "操作"))), /*#__PURE__*/React.createElement("tbody", null, users.map(function (u) {
    return /*#__PURE__*/React.createElement("tr", {
      key: u.id,
      className: "clickable",
      onClick: function () {
        openUser(u);
      }
    }, /*#__PURE__*/React.createElement("td", null, u.id), /*#__PURE__*/React.createElement("td", {
      style: {
        fontWeight: 600,
        color: 'var(--jade-deep)'
      }
    }, u.username), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "tag gold",
      title: u.balance != null ? u.balance + ' 存储单位（1 元 = 10 存储单位 = 10,000 tokens）' : ''
    }, "¥", u.balance_yuan != null ? u.balance_yuan : u.balance != null ? Math.round(u.balance / 10 * 100) / 100 : 0)), /*#__PURE__*/React.createElement("td", null, fmtTime(u.created_at)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-mini"
    }, "查看用户"), canWrite && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-mini",
      disabled: adjustingId === u.id,
      onClick: function (e) {
        e.stopPropagation();
        adjustBalance(u);
      }
    }, adjustingId === u.id ? '调整中…' : '余额充值/调整'), canWrite && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-danger btn-mini",
      disabled: deletingId === u.id,
      onClick: function (e) {
        e.stopPropagation();
        deleteUser(u);
      }
    }, deletingId === u.id ? '删除中…' : '删除'))));
  }))))));
}

/* ============ 提示词管理 ============ */
const PROMPT_CATEGORY_ORDER = ['方法', '校验/追问', '解读'];
function PromptsSection() {
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [errored, setErrored] = useState('');
  const [activeKey, setActiveKey] = useState(null);
  const [content, setContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [contentErr, setContentErr] = useState('');
  // 版本历史（选中 key 后加载；列表不含全量 content）
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsErr, setVersionsErr] = useState('');
  const [rollbackingId, setRollbackingId] = useState(null);
  // 查看版本全文（弹窗）
  const [viewingVer, setViewingVer] = useState(null);
  const [viewContent, setViewContent] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState('');
  const loadList = async function () {
    setLoadingList(true);
    setErrored('');
    try {
      const res = await api('/admin/prompts');
      const d = pickData(res);
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setErrored(e.message || '提示词列表加载失败');
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(function () {
    loadList();
  }, []);
  // 拉取当前 key 全文（编辑器 + 回滚后刷新共用）
  const refreshContent = async function () {
    if (!activeKey) return;
    setContentErr('');
    setContent('');
    setLoadingContent(true);
    try {
      const res = await api('/admin/prompts/' + encodeURIComponent(activeKey));
      const d = pickData(res);
      setContent(d && d.content != null ? d.content : '');
    } catch (e) {
      setContentErr(e.message || '提示词内容加载失败');
    } finally {
      setLoadingContent(false);
    }
  };
  // 拉取版本历史（按 id 倒序，最新在前）
  const loadVersions = async function (k) {
    setLoadingVersions(true);
    setVersionsErr('');
    try {
      const res = await api('/admin/prompts/' + encodeURIComponent(k) + '/versions');
      const d = pickData(res);
      setVersions(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setVersionsErr(e.message || '版本历史加载失败');
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };
  const openKey = function (k) {
    setActiveKey(k);
    setSavedMsg('');
    setContentErr('');
    setVersionsErr('');
    setContent('');
    setVersions([]);
    setViewingVer(null);
    setViewContent('');
    setViewErr('');
    refreshContent();
    loadVersions(k);
  };
  const closeEditor = function () {
    setActiveKey(null);
    setContent('');
    setSavedMsg('');
    setVersions([]);
    setVersionsErr('');
    setViewingVer(null);
  };
  const saveKey = async function () {
    if (!activeKey) return;
    setSaving(true);
    setSavedMsg('');
    setContentErr('');
    try {
      await api('/admin/prompts/' + encodeURIComponent(activeKey), {
        method: 'PUT',
        body: JSON.stringify({
          content: content
        })
      });
      setSavedMsg('已保存：' + activeKey);
      toast('保存成功');
      loadList(); // 刷新 mtime
      loadVersions(activeKey); // 本次保存已落一条新快照
    } catch (e) {
      setContentErr(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };
  // 查看某版本全文（弹窗）
  const openVersionView = async function (ver) {
    if (!activeKey || !ver) return;
    setViewingVer(ver);
    setViewContent('');
    setViewErr('');
    setViewLoading(true);
    try {
      const res = await api('/admin/prompts/' + encodeURIComponent(activeKey) + '/versions/' + ver.id);
      const d = pickData(res);
      setViewContent(d && d.content != null ? d.content : '');
    } catch (e) {
      setViewErr(e.message || '版本内容加载失败');
    } finally {
      setViewLoading(false);
    }
  };
  // 回滚到某版本：POST rollback → toast + 刷新当前内容 + 刷新版本列表
  const rollbackTo = async function (ver) {
    if (!activeKey || !ver || rollbackingId != null) return;
    if (!window.confirm('确认把 [' + activeKey + '] 回滚到 ' + fmtTime(ver.created_at) + '（v' + ver.id + '）的内容？当前文件将被覆盖，并自动生成一条回滚后的新快照。')) return;
    setRollbackingId(ver.id);
    setContentErr('');
    try {
      const res = await api('/admin/prompts/' + encodeURIComponent(activeKey) + '/rollback/' + ver.id, {
        method: 'POST'
      });
      const d = pickData(res);
      const vid = d && d.version_id != null ? d.version_id : ver.id;
      setSavedMsg('已回滚：' + activeKey + ' → v' + vid);
      toast('已回滚到 v' + vid);
      loadList();
      refreshContent();
      loadVersions(activeKey);
    } catch (e) {
      setContentErr(e.message || '回滚失败');
    } finally {
      setRollbackingId(null);
    }
  };
  // 按分类分组（固定顺序：方法 → 校验/追问 → 解读；未知分类归"其他"追加在后）
  const grouped = function () {
    const byCat = {};
    items.forEach(function (p) {
      const c = p.category || '其他';
      (byCat[c] = byCat[c] || []).push(p);
    });
    const order = PROMPT_CATEGORY_ORDER.concat(Object.keys(byCat).filter(function (c) {
      return PROMPT_CATEGORY_ORDER.indexOf(c) < 0;
    }));
    return order.filter(function (c) {
      return byCat[c] && byCat[c].length;
    }).map(function (c) {
      return {
        category: c,
        rows: byCat[c]
      };
    });
  }();
  return React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, "提示词"), /*#__PURE__*/React.createElement("p", {
    className: "page-desc"
  }, "查看与编辑系统提示词（方法 9 / 校验·追问 2 / 解读 4，共 15 个）。保存后立即生效于新请求；每次保存自动生成版本快照，可查看历史并回滚。"), errored && /*#__PURE__*/React.createElement("div", {
    className: "error-box"
  }, errored), loadingList && /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "正在加载提示词列表…"), !loadingList && items.length === 0 && !errored && /*#__PURE__*/React.createElement("div", {
    className: "empty-note"
  }, "暂无提示词"), !loadingList && items.length > 0 && grouped.map(function (g) {
    return /*#__PURE__*/React.createElement("div", {
      key: g.category,
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-title",
      style: {
        margin: '0 0 4px'
      }
    }, g.category, /*#__PURE__*/React.createElement("span", {
      className: "tag gray",
      style: {
        marginLeft: 8
      }
    }, g.rows.length))), /*#__PURE__*/React.createElement("div", {
      className: "table-scroll",
      style: {
        border: 'none'
      }
    }, /*#__PURE__*/React.createElement("table", {
      className: "admin-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "key"), /*#__PURE__*/React.createElement("th", null, "文件"), /*#__PURE__*/React.createElement("th", null, "修改时间"), /*#__PURE__*/React.createElement("th", null, "操作"))), /*#__PURE__*/React.createElement("tbody", null, g.rows.map(function (p) {
      const k = p.key != null ? p.key : p.name;
      return /*#__PURE__*/React.createElement("tr", {
        key: k,
        className: "clickable",
        onClick: function () {
          openKey(k);
        }
      }, /*#__PURE__*/React.createElement("td", {
        style: {
          fontWeight: 600,
          color: 'var(--jade-deep)'
        }
      }, k), /*#__PURE__*/React.createElement("td", null, p.file || '-'), /*#__PURE__*/React.createElement("td", null, fmtTime(p.updated_at)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-mini"
      }, "编辑")));
    })))));
  }), activeKey != null && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "编辑：", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Consolas,Menlo,monospace',
      fontSize: 13
    }
  }, activeKey)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-mini",
    onClick: closeEditor
  }, "关闭编辑器")), loadingContent && /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginTop: 10
    }
  }, "正在加载内容…"), contentErr && /*#__PURE__*/React.createElement("div", {
    className: "error-box",
    style: {
      marginTop: 10
    }
  }, contentErr), savedMsg && /*#__PURE__*/React.createElement("div", {
    className: "ok-box",
    style: {
      marginTop: 10
    }
  }, savedMsg), !loadingContent && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "prompt-content"
  }, "提示词内容（纯文本）"), /*#__PURE__*/React.createElement("textarea", {
    id: "prompt-content",
    className: "input",
    style: {
      width: '100%',
      maxWidth: 'none',
      minHeight: 260,
      resize: 'vertical',
      lineHeight: 1.7
    },
    value: content,
    onChange: function (e) {
      setContent(e.target.value);
      setSavedMsg('');
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    disabled: saving,
    onClick: saveKey
  }, saving ? '保存中…' : '保存'), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    disabled: saving,
    onClick: closeEditor
  }, "放弃修改"))), /*#__PURE__*/React.createElement("div", {
    className: "section-title",
    style: {
      marginTop: 20,
      marginBottom: 2
    }
  }, "版本历史", !loadingVersions && versions.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "tag gray",
    style: {
      marginLeft: 8
    }
  }, versions.length)), loadingVersions && /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginTop: 6
    }
  }, "正在加载版本历史…"), versionsErr && /*#__PURE__*/React.createElement("div", {
    className: "error-box",
    style: {
      marginTop: 8
    }
  }, versionsErr), !loadingVersions && !versionsErr && versions.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginTop: 6
    }
  }, "暂无版本记录：保存一次后自动生成快照"), !loadingVersions && !versionsErr && versions.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "table-scroll",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "admin-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "版本"), /*#__PURE__*/React.createElement("th", null, "保存时间"), /*#__PURE__*/React.createElement("th", null, "操作人"), /*#__PURE__*/React.createElement("th", null, "长度"), /*#__PURE__*/React.createElement("th", null, "操作"))), /*#__PURE__*/React.createElement("tbody", null, versions.map(function (v) {
    return /*#__PURE__*/React.createElement("tr", {
      key: v.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "tag gray"
    }, "v" + v.id)), /*#__PURE__*/React.createElement("td", null, fmtTime(v.created_at)), /*#__PURE__*/React.createElement("td", null, v.admin_user_id != null ? '#' + v.admin_user_id : '-'), /*#__PURE__*/React.createElement("td", null, (v.length != null ? v.length : '-') + " 字符"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-mini",
      disabled: viewLoading,
      onClick: function () {
        openVersionView(v);
      }
    }, "查看"), " ", /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-mini",
      style: {
        color: 'var(--cinnabar)',
        borderColor: 'rgba(178,58,58,.45)'
      },
      disabled: rollbackingId === v.id,
      onClick: function () {
        rollbackTo(v);
      }
    }, rollbackingId === v.id ? '回滚中…' : '回滚')));

  }))))), viewingVer && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(18,24,38,.55)',
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      width: '100%',
      maxWidth: 880,
      maxHeight: '82vh',
      display: 'flex',
      flexDirection: 'column',
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "查看版本：", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Consolas,Menlo,monospace',
      fontSize: 13
    }
  }, activeKey), " · v" + viewingVer.id + " · " + fmtTime(viewingVer.created_at)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-mini",
    onClick: function () {
      setViewingVer(null);
      setViewContent('');
      setViewErr('');
    }
  }, "关闭")), viewErr && /*#__PURE__*/React.createElement("div", {
    className: "error-box",
    style: {
      marginTop: 10
    }
  }, viewErr), viewLoading && /*#__PURE__*/React.createElement("p", {
    className: "hint",
    style: {
      marginTop: 10
    }
  }, "正在加载版本内容…"), !viewLoading && viewContent && /*#__PURE__*/React.createElement("pre", {
    style: {
      flex: 1,
      overflow: 'auto',
      background: '#f4f0e6',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-m)',
      padding: '12px 14px',
      marginTop: 12,
      marginBottom: 0,
      fontFamily: 'Consolas,Menlo,monospace',
      fontSize: 12.5,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }
  }, viewContent))));
}


/* ============ 素材管理（REQ-059 / BUG-018） ============ */
// 槽位全集（与 backend/app/admin/router.py /admin/assets/* 契约一致）：
//   module(3) / method(6) / mbti_type(16) / card(塔罗 78 + 雷诺曼 36) / agent(5)
// 卡面 key 约定：tarot-<牌名文件 stem>（对齐 frontend/public/tarot/rider-waite/webp/*）/
// lenormand-01…36（对齐 frontend/public/lenormand/*）。蒙版字段：opacity(0~1) + mask_color(hex)。
const ASSET_MBTI_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const ASSET_TAROT = [
  ['00_Fool', '愚者'], ['01_Magician', '魔术师'], ['02_High_Priestess', '女祭司'], ['03_Empress', '皇后'],
  ['04_Emperor', '皇帝'], ['05_Hierophant', '教皇'], ['06_Lovers', '恋人'], ['07_Chariot', '战车'],
  ['08_Strength', '力量'], ['09_Hermit', '隐士'], ['10_Wheel_of_Fortune', '命运之轮'], ['11_Justice', '正义'],
  ['12_Hanged_Man', '倒吊人'], ['13_Death', '死神'], ['14_Temperance', '节制'], ['15_Devil', '恶魔'],
  ['16_Tower', '高塔'], ['17_Star', '星星'], ['18_Moon', '月亮'], ['19_Sun', '太阳'],
  ['20_Judgement', '审判'], ['21_World', '世界'],
  ['Wands01', '权杖王牌'], ['Wands02', '权杖二'], ['Wands03', '权杖三'], ['Wands04', '权杖四'],
  ['Wands05', '权杖五'], ['Wands06', '权杖六'], ['Wands07', '权杖七'], ['Wands08', '权杖八'],
  ['Wands09', '权杖九'], ['Wands10', '权杖十'], ['Wands11', '权杖侍从'], ['Wands12', '权杖骑士'],
  ['Wands13', '权杖王后'], ['Wands14', '权杖国王'],
  ['Cups01', '圣杯王牌'], ['Cups02', '圣杯二'], ['Cups03', '圣杯三'], ['Cups04', '圣杯四'],
  ['Cups05', '圣杯五'], ['Cups06', '圣杯六'], ['Cups07', '圣杯七'], ['Cups08', '圣杯八'],
  ['Cups09', '圣杯九'], ['Cups10', '圣杯十'], ['Cups11', '圣杯侍从'], ['Cups12', '圣杯骑士'],
  ['Cups13', '圣杯王后'], ['Cups14', '圣杯国王'],
  ['Swords01', '宝剑王牌'], ['Swords02', '宝剑二'], ['Swords03', '宝剑三'], ['Swords04', '宝剑四'],
  ['Swords05', '宝剑五'], ['Swords06', '宝剑六'], ['Swords07', '宝剑七'], ['Swords08', '宝剑八'],
  ['Swords09', '宝剑九'], ['Swords10', '宝剑十'], ['Swords11', '宝剑侍从'], ['Swords12', '宝剑骑士'],
  ['Swords13', '宝剑王后'], ['Swords14', '宝剑国王'],
  ['Pents01', '钱币王牌'], ['Pents02', '钱币二'], ['Pents03', '钱币三'], ['Pents04', '钱币四'],
  ['Pents05', '钱币五'], ['Pents06', '钱币六'], ['Pents07', '钱币七'], ['Pents08', '钱币八'],
  ['Pents09', '钱币九'], ['Pents10', '钱币十'], ['Pents11', '钱币侍从'], ['Pents12', '钱币骑士'],
  ['Pents13', '钱币王后'], ['Pents14', '钱币国王']
].map(function (p) {
  return { key: 'tarot-' + p[0], label: p[1] };
});
const ASSET_LENORMAND = [
  ['01', '骑手'], ['02', '三叶草'], ['03', '船'], ['04', '房子'], ['05', '树'], ['06', '云'],
  ['07', '蛇'], ['08', '棺材'], ['09', '花束'], ['10', '镰刀'], ['11', '鞭子'], ['12', '鸟'],
  ['13', '小孩'], ['14', '狐狸'], ['15', '熊'], ['16', '星星'], ['17', '鹳'], ['18', '狗'],
  ['19', '塔'], ['20', '花园'], ['21', '山'], ['22', '路口'], ['23', '老鼠'], ['24', '心'],
  ['25', '戒指'], ['26', '书'], ['27', '信'], ['28', '男人'], ['29', '女人'], ['30', '百合'],
  ['31', '太阳'], ['32', '月亮'], ['33', '钥匙'], ['34', '鱼'], ['35', '锚'], ['36', '十字']
].map(function (p) {
  return { key: 'lenormand-' + p[0], label: p[1] };
});
const ASSET_CATALOG = [{
  kind: 'module',
  title: '模块级背景（3 槽）',
  desc: '落地页与对应 Hub 页复用同一张背景（REQ-059①），未配置回退 CSS 渐变。',
  slots: [{ key: 'module-guoxue', label: '国学预测' }, { key: 'module-xishi', label: '西式占卜' }, { key: 'module-mbti', label: 'MBTI' }]
}, {
  kind: 'method',
  title: 'Hub 方法级背景（6 槽）',
  desc: '国学 Hub 与西式 Hub 中每个方法选项独立背景，按选项 key（REQ-059②）。',
  slots: [{ key: 'method-nine', label: '九法合一' }, { key: 'method-zodiac', label: '生肖流年' }, { key: 'method-divination', label: '六爻起卦' }, { key: 'method-astrology', label: '星座星盘' }, { key: 'method-tarot', label: '塔罗' }, { key: 'method-lenormand', label: '雷诺曼' }]
}, {
  kind: 'mbti_type',
  title: 'MBTI 16 型结果背景（16 槽）',
  desc: '按类型代码（INTJ…ESFP），仅 MBTI 结果页 / 人格详情展示，未上传回退默认（REQ-059④）。',
  slots: ASSET_MBTI_TYPES.map(function (t) {
    return { key: t, label: t };
  })
}, {
  kind: 'card',
  title: '塔罗卡面（78 张）',
  desc: 'key 为 tarot-<牌名文件 stem>；上传替换后前台抽牌 / 翻牌 / 结果即时生效（REQ-059⑤）。',
  slots: ASSET_TAROT
}, {
  kind: 'card',
  title: '雷诺曼卡面（36 张）',
  desc: 'key 为 lenormand-01…36（REQ-059⑤）。',
  slots: ASSET_LENORMAND
}, {
  kind: 'agent',
  title: '太初先生会话背景（5 槽）',
  desc: 'agent-1…agent-5：每次进入会话 / 对话中每 10 分钟从已填充槽随机抽取 1 张；空白槽不参与抽取，全部空白回退默认样式（REQ-059⑥）。',
  slots: [1, 2, 3, 4, 5].map(function (n) {
    return { key: 'agent-' + n, label: '会话背景 ' + n };
  })
}];
function AssetsSection() {
  const canWrite = (localStorage.getItem(ROLE_KEY) || '') === 'admin' || (localStorage.getItem(ROLE_KEY) || '') === 'operator';
  const [byKey, setByKey] = useState({}); // key → {key,kind,url,opacity,mask_color,updated_at}
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [busy, setBusy] = useState({}); // key → 'upload'|'save'|'delete'
  const [draft, setDraft] = useState({ url: '', opacity: '', maskColor: '#000000' });
  const load = async function () {
    setLoading(true);
    setErrored('');
    try {
      const res = await api('/admin/assets');
      const d = pickData(res);
      const map = {};
      (Array.isArray(d.items) ? d.items : []).forEach(function (it) {
        map[it.key] = it;
      });
      setByKey(map);
    } catch (e) {
      setErrored(e.message || '素材列表加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(function () {
    load();
  }, []);
  const openEditor = function (slot) {
    const it = byKey[slot.key];
    setOpenKey(slot.key);
    setDraft({
      url: it && it.url ? it.url : '',
      opacity: it && it.opacity != null ? String(it.opacity) : '',
      maskColor: it && it.mask_color ? it.mask_color : '#000000'
    });
  };
  const closeEditor = function () {
    setOpenKey(null);
  };
  // 按后端 AssetUpsertRequest 组装 PUT body：{kind, url, key, opacity?, mask_color?}
  const buildBody = function (slot, url) {
    const body = { kind: slot.kind, key: slot.key, url: String(url || '').trim() };
    const raw = String(draft.opacity || '').trim();
    const op = parseFloat(raw);
    if (raw !== '' && isFinite(op) && op >= 0 && op <= 1) {
      body.opacity = op;
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.maskColor)) body.mask_color = draft.maskColor;
    }
    return body;
  };
  const saveSlot = async function (slot) {
    const url = String(draft.url || '').trim();
    if (!url) {
      toast('请先填写素材地址或上传文件');
      return;
    }
    setBusy(Object.assign({}, busy, (function () {
      const o = {};
      o[slot.key] = 'save';
      return o;
    })()));
    try {
      await api('/admin/assets/' + encodeURIComponent(slot.key), {
        method: 'PUT',
        body: JSON.stringify(buildBody(slot, url))
      });
      toast('已保存：' + slot.label + '（' + slot.key + '）');
      setOpenKey(null);
      load();
    } catch (e) {
      toast(e.message || '保存失败');
    } finally {
      setBusy(Object.assign({}, busy, (function () {
        const o = {};
        o[slot.key] = null;
        return o;
      })()));
    }
  };
  const uploadFile = async function (slot, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(Object.assign({}, busy, (function () {
      const o = {};
      o[slot.key] = 'upload';
      return o;
    })()));
    try {
      // ① POST /admin/assets/upload（multipart，字段名 file）→ 返回相对路径
      const res = await api('/admin/assets/upload', { method: 'POST', body: fd });
      const d = pickData(res);
      if (!d || !d.url) throw new Error('上传未返回素材地址');
      // ② PUT /admin/assets/{key} 绑定入槽（上传即替换，保留蒙版草稿）
      setDraft(Object.assign({}, draft, { url: d.url }));
      await api('/admin/assets/' + encodeURIComponent(slot.key), {
        method: 'PUT',
        body: JSON.stringify(buildBody(slot, d.url))
      });
      toast('已上传并替换：' + slot.label);
      setOpenKey(null);
      load();
    } catch (e) {
      toast(e.message || '上传失败');
    } finally {
      setBusy(Object.assign({}, busy, (function () {
        const o = {};
        o[slot.key] = null;
        return o;
      })()));
    }
  };
  const deleteSlot = async function (slot) {
    if (!window.confirm('确认删除素材槽「' + slot.key + '」并恢复默认？\n前台将回退该槽的 CSS 艺术背景（已上传文件保留在服务器，可被其他槽复用）。')) return;
    setBusy(Object.assign({}, busy, (function () {
      const o = {};
      o[slot.key] = 'delete';
      return o;
    })()));
    try {
      await api('/admin/assets/' + encodeURIComponent(slot.key), { method: 'DELETE' });
      toast('已删除恢复默认：' + slot.key);
      if (openKey === slot.key) setOpenKey(null);
      load();
    } catch (e) {
      toast(e.message || '删除失败');
    } finally {
      setBusy(Object.assign({}, busy, (function () {
        const o = {};
        o[slot.key] = null;
        return o;
      })()));
    }
  };
  const configuredCount = function (keys) {
    return keys.filter(function (k) {
      return byKey[k] && byKey[k].url;
    }).length;
  };
  // 单个槽卡片：预览（含蒙版示意） + 状态 + operator 配置区
  const renderSlot = function (slot) {
    const it = byKey[slot.key];
    const url = it && it.url ? it.url : '';
    const opacity = it && it.opacity != null ? it.opacity : null;
    const color = it && it.mask_color ? it.mask_color : '#000000';
    const isOpen = openKey === slot.key;
    const b = busy[slot.key];
    return React.createElement("div", {
      key: slot.key,
      className: "asset-slot"
    }, React.createElement("div", {
      className: "asset-preview"
    }, url ? React.createElement("img", {
      src: url,
      alt: slot.label,
      loading: "lazy"
    }) : React.createElement("div", {
      className: "asset-ph"
    }, "未配置 · 回退 CSS 渐变"), opacity != null && React.createElement("div", {
      className: "asset-mask",
      style: {
        background: color,
        opacity: opacity
      }
    })), React.createElement("div", {
      className: "asset-title"
    }, React.createElement("span", null, slot.label), React.createElement("span", {
      className: "asset-key"
    }, slot.key)), React.createElement("div", {
      className: "asset-meta"
    }, url ? React.createElement("span", {
      className: "tag ok"
    }, "已配置") : React.createElement("span", {
      className: "tag gray"
    }, "未配置"), opacity != null && React.createElement("span", {
      className: "tag gold"
    }, "蒙版 ", opacity, " @ ", color)), canWrite && React.createElement("div", {
      className: "asset-actions"
    }, isOpen ? React.createElement("button", {
      className: "btn btn-outline btn-mini",
      onClick: closeEditor
    }, "收起") : React.createElement("button", {
      className: "btn btn-outline btn-mini",
      onClick: function () {
        openEditor(slot);
      }
    }, "配置")), isOpen && canWrite && React.createElement("div", {
      className: "asset-form"
    }, React.createElement("label", {
      className: "label"
    }, "素材地址（完整 URL 或以 / 开头的相对路径）"), React.createElement("div", {
      className: "asset-form-row"
    }, React.createElement("input", {
      className: "input",
      value: draft.url,
      placeholder: "/uploads/assets/xxx.webp 或 https://…",
      onChange: function (e) {
        setDraft(Object.assign({}, draft, {
          url: e.target.value
        }));
      }
    }), React.createElement("label", {
      className: "btn btn-outline btn-mini",
      style: {
        flex: 'none',
        cursor: 'pointer',
        margin: 0
      }
    }, b === 'upload' ? '上传中…' : '上传文件替换', React.createElement("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
      style: {
        display: 'none'
      },
      onChange: function (e) {
        const f = e.target.files && e.target.files[0];
        if (f) uploadFile(slot, f);
        e.target.value = '';
      }
    }))), React.createElement("div", {
      className: "asset-mask-row"
    }, React.createElement("div", null, React.createElement("label", {
      className: "label"
    }, "蒙版不透明度（0~1，留空=不启用）"), React.createElement("input", {
      className: "input",
      type: "number",
      min: 0,
      max: 1,
      step: 0.05,
      value: draft.opacity,
      placeholder: "如 0.35",
      onChange: function (e) {
        setDraft(Object.assign({}, draft, {
          opacity: e.target.value
        }));
      }
    })), React.createElement("div", null, React.createElement("label", {
      className: "label"
    }, "蒙版颜色（hex）"), React.createElement("input", {
      className: "input",
      type: "color",
      value: /^#[0-9a-fA-F]{6}$/.test(draft.maskColor) ? draft.maskColor : '#000000',
      onChange: function (e) {
        setDraft(Object.assign({}, draft, {
          maskColor: e.target.value
        }));
      }
    }))), React.createElement("div", {
      className: "asset-form-row",
      style: {
        marginTop: 8
      }
    }, React.createElement("button", {
      className: "btn btn-primary btn-mini",
      disabled: b != null,
      onClick: function () {
        saveSlot(slot);
      }
    }, b === 'save' ? '保存中…' : '保存配置'), React.createElement("button", {
      className: "btn btn-danger btn-mini",
      disabled: b != null,
      onClick: function () {
        deleteSlot(slot);
      }
    }, b === 'delete' ? '删除中…' : '删除恢复默认'))));
  };
  const renderGroup = function (g) {
    const keys = g.slots.map(function (s) {
      return s.key;
    });
    const done = configuredCount(keys);
    return React.createElement("div", {
      key: g.kind + '|' + g.title,
      className: "card"
    }, React.createElement("div", {
      className: "section-title",
      style: {
        marginTop: 0
      }
    }, g.title, React.createElement("span", {
      className: "tag gray",
      style: {
        marginLeft: 8
      }
    }, g.slots.length, " 槽"), React.createElement("span", {
      className: 'tag ' + (done > 0 ? 'ok' : 'gray'),
      style: {
        marginLeft: 6
      }
    }, "已配置 ", done, " 槽")), React.createElement("p", {
      className: "hint",
      style: {
        margin: '0 0 12px'
      }
    }, g.desc), React.createElement("div", {
      className: "asset-grid"
    }, g.slots.map(renderSlot)));
  };
  return React.createElement("div", null, React.createElement("h2", {
    className: "page-title"
  }, "素材管理"), React.createElement("p", {
    className: "page-desc"
  }, "背景图与卡牌素材热更（REQ-059）：上传即替换，前台 GET /api/assets 实时生效、无需重启；未配置 / 删除的槽回退既有 CSS 艺术背景。每槽可配蒙版（不透明度 0~1 + 颜色 hex，REQ-059⑧）。"), errored && React.createElement("div", {
    className: "error-box"
  }, errored), loading && React.createElement("p", {
    className: "hint"
  }, "正在加载素材槽…"), !loading && !errored && ASSET_CATALOG.map(renderGroup));
}

/* ============ 运营配置（REQ-085） ============ */
// 键 → 前端输入提示（仅展示层：数值键用 number 输入；后端做权威类型校验）
const CONFIG_INPUT_HINTS = {
  recharge_rate: { inputType: 'number', step: 'any', min: 0, unit: '存储单位/元' },
  free_credit_on_register: { inputType: 'number', step: 1, min: 0, unit: '存储单位' }
};
function ConfigSection() {
  const canWrite = (localStorage.getItem(ROLE_KEY) || '') === 'admin' || (localStorage.getItem(ROLE_KEY) || '') === 'operator';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [drafts, setDrafts] = useState({}); // key → 编辑草稿（字符串）
  const [saving, setSaving] = useState({}); // key → true 保存中
  const load = async function () {
    setLoading(true);
    setErrored('');
    try {
      const res = await api('/admin/config');
      const d = pickData(res);
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setErrored(e.message || '运营配置加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(function () {
    load();
  }, []);
  const setDraft = function (key, val) {
    const o = {};
    o[key] = val;
    setDrafts(Object.assign({}, drafts, o));
  };
  const save = async function (it) {
    const raw = String(drafts[it.key] != null ? drafts[it.key] : it.value).trim();
    if (raw === '') {
      toast('配置值不能为空');
      return;
    }
    setSaving(Object.assign({}, saving, (function () {
      const o = {};
      o[it.key] = true;
      return o;
    })()));
    try {
      await api('/admin/config/' + encodeURIComponent(it.key), {
        method: 'PUT',
        body: JSON.stringify({ value: raw })
      });
      toast('已保存：' + it.key + '（立即生效）');
      setDraft(it.key, null);
      load();
    } catch (e) {
      toast(e.message || '保存失败');
    } finally {
      setSaving(Object.assign({}, saving, (function () {
        const o = {};
        o[it.key] = false;
        return o;
      })()));
    }
  };
  return React.createElement("div", null, React.createElement("h2", {
    className: "page-title"
  }, "运营配置"), React.createElement("p", {
    className: "page-desc"
  }, "运营参数热改（REQ-085）：保存即写入 system_configs，运行时读取点每次查表、立即生效无需重启。viewer 只读；operator / admin 可编辑，改动记入审计日志。"), errored && React.createElement("div", {
    className: "error-box"
  }, errored), loading && React.createElement("p", {
    className: "hint"
  }, "正在加载运营配置…"), !loading && !errored && items.length === 0 && React.createElement("div", {
    className: "empty-note"
  }, "暂无运营配置"), !loading && !errored && items.length > 0 && React.createElement("div", {
    className: "table-scroll"
  }, React.createElement("table", {
    className: "admin-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "配置键"), React.createElement("th", null, "说明"), React.createElement("th", null, "当前值"), React.createElement("th", null, "更新时间"), canWrite && React.createElement("th", null, "操作"))), React.createElement("tbody", null, items.map(function (it) {
    const h = CONFIG_INPUT_HINTS[it.key] || {};
    const inputVal = drafts[it.key] != null ? drafts[it.key] : String(it.value != null ? it.value : '');
    return React.createElement("tr", {
      key: it.key
    }, React.createElement("td", null, React.createElement("span", {
      className: "config-key"
    }, it.key)), React.createElement("td", null, React.createElement("span", {
      className: "hint"
    }, it.description || '—')), React.createElement("td", null, canWrite ? React.createElement("input", {
      className: "input config-value-input",
      type: h.inputType || 'text',
      step: h.step,
      min: h.min,
      value: inputVal,
      onChange: function (e) {
        setDraft(it.key, e.target.value);
      }
    }) : React.createElement("span", {
      className: "config-value"
    }, inputVal), h.unit ? React.createElement("span", {
      className: "config-unit"
    }, h.unit) : null), React.createElement("td", null, React.createElement("span", {
      className: "hint"
    }, fmtTime(it.updated_at), it.updated_by ? ' · ' + it.updated_by : '')), canWrite && React.createElement("td", null, React.createElement("button", {
      className: "btn btn-primary btn-mini",
      disabled: saving[it.key] === true,
      onClick: function () {
        save(it);
      }
    }, saving[it.key] === true ? '保存中…' : '保存'))));
  })))));
}

/* ============ App：登录态 + 布局 + 路由 ============ */
function App() {
  const [authed, setAuthed] = useState(function () {
    return !!localStorage.getItem(TOKEN_KEY);
  });
  const [role, setRole] = useState(function () {
    return localStorage.getItem(ROLE_KEY) || '';
  });
  const [section, setSection] = useState('reports');
  useEffect(function () {
    onUnauthorized = function () {
      setAuthed(false);
      setSection('reports');
    };
    return function () {
      onUnauthorized = null;
    };
  }, []);
  const handleLoggedIn = function (tk, r) {
    setAuthed(true);
    setRole(r || localStorage.getItem(ROLE_KEY) || '');
    setSection('reports');
  };
  const handleLogout = function () {
    logoutLocal();
    toast('已退出登录');
    setAuthed(false);
    setSection('reports');
  };
  if (!authed) return /*#__PURE__*/React.createElement(LoginPage, {
    onLoggedIn: handleLoggedIn
  });
  const navs = [{
    key: 'reports',
    label: '报表',
    icon: '📊'
  }, {
    key: 'users',
    label: '用户',
    icon: '👥'
  }, {
    key: 'prompts',
    label: '提示词',
    icon: '📝'
  }, {
    key: 'assets',
    label: '素材',
    icon: '🖼️'
  }, {
    key: 'config',
    label: '运营配置',
    icon: '⚙️'
  }];
  const go = function (k) {
    setSection(k);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand"
  }, "太初", /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "·"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "后台管理")), /*#__PURE__*/React.createElement("div", {
    className: "top-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "role-chip"
  }, "当前角色：", /*#__PURE__*/React.createElement("b", null, role || '—')), /*#__PURE__*/React.createElement("button", {
    className: "logout-btn",
    onClick: handleLogout
  }, "退出登录"))), /*#__PURE__*/React.createElement("div", {
    className: "admin-body"
  }, /*#__PURE__*/React.createElement("nav", {
    className: "sidebar",
    "aria-label": "后台导航"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side-title"
  }, "管理"), navs.map(function (n) {
    return /*#__PURE__*/React.createElement("button", {
      key: n.key,
      className: 'nav-item' + (section === n.key ? ' active' : ''),
      onClick: function () {
        go(n.key);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "nav-icon"
    }, n.icon), n.label);
  })), /*#__PURE__*/React.createElement("main", {
    className: "admin-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "view-enter",
    key: section
  }, section === 'reports' && /*#__PURE__*/React.createElement(ReportsSection, null), section === 'users' && /*#__PURE__*/React.createElement(UsersSection, null), section === 'prompts' && /*#__PURE__*/React.createElement(PromptsSection, null), section === 'assets' && /*#__PURE__*/React.createElement(AssetsSection, null), section === 'config' && /*#__PURE__*/React.createElement(ConfigSection, null)))));
}
ReactDOM.render(/*#__PURE__*/React.createElement(App, null), document.getElementById('root'));
  