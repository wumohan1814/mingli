// 认证/引导域视图（节110 阶段3）：登录注册 AuthPage + 新用户建档引导 OnboardingPage
// （OnboardingPage 复用 views-cases.js 的 ShareFillModal/useCaseShareFill，故加载于 views-cases.js 之后）
// 加载于 views-divination.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用
function AuthPage({
  onNavigate
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 节141：**公开注册已关闭**（内测白名单制，新账号只能由开发者经后台创建）。
  // 本页从此只剩登录表单：原注册分支（确认密码 / 图形验证码 / 协议勾选）、
  // 「没有账号？去注册」切换入口、验证码拉取与注册赠送提示全部移除。
  // 后端 POST /api/auth/register 同步加了开关防护（MINGLI_ALLOW_PUBLIC_REGISTER，默认 false）。
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password
        }),
        // REQ-049：登录的 401（如「用户名或密码错误」）属业务失败而非会话过期，
        // skip401 跳过统一踢出拦截，让下方 catch 拿到后端真实 message
        skip401: true
      });
      // 注意：auth 接口返回裸 {access_token, refresh_token}，非 {code,data} 信封
      token = res.access_token || res.data && res.data.access_token;
      refreshToken = res.refresh_token || res.data && res.data.refresh_token;
      localStorage.setItem('mingli_token', token || '');
      localStorage.setItem('mingli_refresh_token', refreshToken || '');
      // REQ-092：登录成功 → 先实时校验档案数（0 档 → forceOnboarding=true，下方受限落页
      // 会被 App navigate 守卫统一重定向到新建档案；≥1 档 → 正常回跳 / 进入档案列表）
      await checkCaseGate();
      // BUG-002: 登录成功 → 若有被拦截的受限页回跳目标则先回跳，否则进入档案列表
      if (authRedirect) {
        const r = authRedirect;
        authRedirect = null;
        onNavigate(r.p, r.p2);
      } else {
        onNavigate('cases'); // 登录成功 → 进入档案列表（可从中新建或继续档案）
      }
    } catch (e) {
      setError(e && e.message || ML_COPY.ui.error['request-failed']);
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, ML_COPY.ui.buttons.login), error && /*#__PURE__*/React.createElement("div", {
    className: "error",
    style: {
      marginBottom: 12
    }
  }, error), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit
  }, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "auth-user"
  }, ML_COPY.ui.auth['phone-label']), /*#__PURE__*/React.createElement("input", {
    id: "auth-user",
    className: "input",
    type: "tel",
    inputMode: "numeric",
    value: username,
    onChange: e => setUsername(e.target.value),
    placeholder: ML_COPY.ui.auth['phone-placeholder'],
    maxLength: 11,
    required: true,
    autoComplete: "tel"
  }), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "auth-pass"
  }, ML_COPY.ui.auth['password-label']), /*#__PURE__*/React.createElement("input", {
    id: "auth-pass",
    className: "input",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: ML_COPY.ui.auth['password-placeholder'],
    required: true,
    minLength: 6
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: loading,
    style: {
      marginTop: 16
    }
  }, loading ? ML_COPY.ui.tips.processing : ML_COPY.ui.buttons.login)), /*#__PURE__*/React.createElement("div", {
    className: "auth-internal-tip",
    style: {
      marginTop: 16,
      padding: '10px 12px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--skin-accent)',
      background: 'var(--skin-accent-soft)',
      color: 'var(--text-2)',
      fontSize: 13,
      lineHeight: 1.7,
      textAlign: 'center'
    }
  }, ML_COPY.ui.auth['internal-only-tip'])));
}

function OnboardingPage({
  onNavigate,
  returnTo,
  // REQ-092：true=本账号 0 档案被强制建档中 → 顶部提示解锁规则
  forced
}) {
  const reg = typeof window !== 'undefined' && window.REGIONS || {};
  const curYear = new Date().getFullYear();
  const defaultYear = String(Math.max(1940, curYear - 35));
  const YEARS = [];
  for (let y = curYear - 18; y >= 1940; y--) YEARS.push(String(y));
  const MONTHS = [];
  for (let m = 1; m <= 12; m++) MONTHS.push(String(m));
  const DAYS = [];
  for (let d = 1; d <= 31; d++) DAYS.push(String(d));
  const HOURS = [];
  for (let h = 0; h <= 23; h++) HOURS.push(String(h));
  // REQ-067：档案与八法合一解耦 —— 建档表单默认值（含选填「档案名」；空表单供清空后连建）
  const blankForm = () => ({
    // REQ-067：档案名（选填）—— 建档后 PATCH 写入；留空则由前端按「未命名档案」展示
    name: '',
    birth_year: defaultYear,
    birth_month: '',
    birth_day: '',
    birth_hour: '0',
    gender: 'male',
    birth_province: '',
    birth_city: '',
    birth_district: '',
    longitude: '',
    latitude: '',
    true_solar_time: false,
    // REQ-065：建档选填联系方式（非必填；为空不提交或提交 null）
    phone: '',
    email: ''
  });
  const [form, setForm] = useState(() => {
    const base = blankForm();
    try {
      const saved = localStorage.getItem('mingli_onboarding_form');
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj && typeof obj === 'object') {
          const merged = {
            ...base,
            ...obj
          };
          if (!merged.birth_year || !YEARS.includes(merged.birth_year)) {
            merged.birth_year = defaultYear;
          }
          return merged;
        }
      }
    } catch (e) {/* 本地存档损坏时忽略，退回默认空表单 */}
    return base;
  });
  const yearRef = useRef(null);
  const focusYear = e => {
    if (!form.birth_year) {
      const el = e && e.target;
      if (el && el.value === '') {
        el.value = defaultYear;
      }
      setForm({
        ...form,
        birth_year: defaultYear
      });
    }
  };
  const [coordTouched, setCoordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // REQ-070 / BUG-012：分享帮填（状态/动作见 useCaseShareFill，模板底部渲染 ShareFillModal）
  const shareFill = useCaseShareFill();
  // REQ-099：进入建档页默认落在页面顶部 —— SPA 视图切换会保留上一页滚动位置（用户反馈进页自动滚到底部），
  // 统一在本页挂载时回顶（覆盖 REQ-092 强制建档门与各模块「新建档案」入口的落地位置）
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // 表单防丢失：建档成功进入 waiting 前，form 每次变化都写入 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mingli_onboarding_form', JSON.stringify(form));
    } catch (e) {/* 忽略 */}
  }, [form]);
  const cityNames = form.birth_province && reg[form.birth_province] ? Object.keys(reg[form.birth_province]) : [];
  const districtNames = form.birth_province && form.birth_city && reg[form.birth_province] && reg[form.birth_province][form.birth_city] ? Object.keys(reg[form.birth_province][form.birth_city]) : [];
  // REQ-091：建档下拉「点击即填入」—— 出生年/月/日/时辰/性别/出生地均使用原生 <select>，
  // onChange 即点即填（选项点选即提交，无「确定/取消」步骤）；原生选择器移动端自带取消（点外部/返回键），
  // 非滑动式选择器故无「滑动预览自动提交」问题；日期/时辰/闰月联动校验由 saveCase 边界检查与出生地级联保留。
  const update = k => e => setForm({
    ...form,
    [k]: e.target.value
  });
  const updateProvince = e => {
    const p = e.target.value;
    const cs = p && reg[p] ? Object.keys(reg[p]) : [];
    const next = {
      ...form,
      birth_province: p,
      birth_city: '',
      birth_district: ''
    };
    if (cs.length === 1) next.birth_city = cs[0]; // 直辖市等单“市/市辖区”结构：市自动带出
    if (!coordTouched) {
      next.longitude = '';
      next.latitude = '';
    }
    setForm(next);
  };
  const updateCity = e => {
    const c = e.target.value;
    const next = {
      ...form,
      birth_city: c,
      birth_district: ''
    };
    if (!coordTouched) {
      next.longitude = '';
      next.latitude = '';
    }
    setForm(next);
  };
  const updateDistrict = e => {
    const d = e.target.value;
    const next = {
      ...form,
      birth_district: d
    };
    if (!coordTouched && d) {
      const coord = reg[form.birth_province] && reg[form.birth_province][form.birth_city] && reg[form.birth_province][form.birth_city][d];
      if (coord) {
        next.longitude = String(coord[0]);
        next.latitude = String(coord[1]);
      }
    }
    setForm(next);
  };
  const updateCoord = k => e => {
    setCoordTouched(true);
    setForm({
      ...form,
      [k]: e.target.value
    });
  };
  const toggleSolar = e => setForm({
    ...form,
    true_solar_time: e.target.checked
  });
  // REQ-067：档案与八法合一解耦 —— 「开始排盘」仅 = 建档 + 确定性非 LLM 排盘（不再自动进入
  // waiting/断前尘/预测链路），盘面生成后入档案查看；八法合一等深度解读由各模块另行衔接。
  // mode='go'：保存后按 returnTo 回跳模块或进档案；mode='next'：保存当前档案、清空表单继续建下一个。
  const saveCase = async mode => {
    setLoading(true);
    setError('');
    const y = +form.birth_year,
      m = +form.birth_month,
      d = +form.birth_day,
      h = +form.birth_hour;
    if (!y || y < 1900 || y > 2100) {
      setError(UI_COPY.onboarding['year-err']);
      setLoading(false);
      return;
    }
    if (!m || m < 1 || m > 12) {
      setError(UI_COPY.onboarding['month-err']);
      setLoading(false);
      return;
    }
    if (!d || d < 1 || d > 31) {
      setError(UI_COPY.onboarding['day-err']);
      setLoading(false);
      return;
    }
    if (h < 0 || h > 23 || isNaN(h)) {
      setError(UI_COPY.onboarding['hour-err']);
      setLoading(false);
      return;
    }
    // REQ-065：建档选填 手机号/邮箱 —— 格式非法（手机号非 11 位数字 / 邮箱不含 @）toast 提示不提交
    const phoneRaw = String(form.phone || '').trim();
    const emailRaw = String(form.email || '').trim();
    if (phoneRaw && !/^\d{11}$/.test(phoneRaw)) {
      toast(UI_COPY.onboarding['phone-err']);
      setLoading(false);
      return;
    }
    if (emailRaw && !/^[^\s@]+@[^\s@]+$/.test(emailRaw)) {
      toast(UI_COPY.onboarding['email-err']);
      setLoading(false);
      return;
    }
    // REQ-067：档案名（选填）—— 后端 POST /cases 不接收 name，有填则建档后 PATCH 命名；
    // 留空则后端 name 为空，前端统一按「未命名档案」展示（可随时在档案管理重命名）
    const nameRaw = String(form.name || '').trim();
    const birthplace = [form.birth_province, form.birth_city, form.birth_district].filter(Boolean).join('/');
    let warn = '';
    try {
      const res = await api('/cases', {
        method: 'POST',
        body: JSON.stringify({
          birth_year: y,
          birth_month: m,
          birth_day: d,
          birth_hour: h,
          gender: form.gender,
          birthplace: birthplace,
          longitude: form.longitude ? +form.longitude : null,
          latitude: form.latitude ? +form.latitude : null,
          true_solar_time: !!form.true_solar_time,
          phone: phoneRaw || null,
          email: emailRaw || null,
          question: UI_COPY.onboarding['default-question']
        })
      });
      // 注意：cases 接口返回 {code,data:{caseId}} 信封
      const caseId = res.data && res.data.caseId || res.caseId;
      // REQ-092：建档成功（账号已有 ≥1 档案）→ 强制门禁立即解锁放行，后续进入档案/模块流程
      // 不再被 navigate 守卫重定向回本页
      forceOnboarding = false;
      if (nameRaw) {
        try {
          await api('/cases/' + caseId, {
            method: 'PATCH',
            body: JSON.stringify({
              name: nameRaw
            })
          });
        } catch (e) {
          // 命名失败不阻断建档：档案仍可用（展示「未命名档案」），提示稍后可到档案管理重命名
          warn = UI_COPY.onboarding['name-fail-warn'];
        }
      }
      // 仅排盘：确定性非 LLM 计算产出盘面（后端幂等 upsert charts 表，不进入断前尘/预测扣费通道）
      await api('/cases/' + caseId + '/paipan', {
        method: 'POST'
      });
      try {
        localStorage.removeItem('mingli_onboarding_form');
      } catch (e) {/* 忽略 */}
      if (mode === 'next') {
        // 「新建下一个档案」：保存当前并继续建下一个 —— 清空表单留在建档页
        setForm(blankForm());
        setCoordTouched(false);
        toast(warn || UI_COPY.onboarding['save-ok-toast']);
      } else {
        // REQ-067③：模块直达由各模块自行衔接（REQ-046② 保留）：模块页进入建档成功后回跳该模块
        // 主流程页（携带 caseId）；其余默认进档案查看盘面 —— 不再自动进 waiting/断前尘
        if (returnTo === 'astrology') {
          onNavigate('astrology', {
            caseId
          });
        } else if (returnTo === 'mbti') {
          onNavigate('mbti', {
            caseId
          });
        } else if (returnTo === 'nine') {
          // REQ-068：八法合一选档案页内新建 → 回跳选档案并预选该档案（由用户自行决定查看/跑预测）
          onNavigate('nine-pick', {
            caseId
          });
        } else {
          toast(warn || UI_COPY.onboarding['chart-ok-toast']);
          onNavigate('archive', {
            caseId
          });
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = e => {
    e.preventDefault();
    saveCase('go');
  };
  const handleSaveNext = () => {
    saveCase('next');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, shareFill.open && /*#__PURE__*/React.createElement(ShareFillModal, {
    url: shareFill.url,
    err: shareFill.err,
    busy: shareFill.busy,
    onCopy: shareFill.copyShareFill,
    onRetry: shareFill.openShareFill,
    onClose: shareFill.closeShareFill
  }), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, UI_COPY.onboarding.title), forced && /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      background: 'var(--tc-gold-a12)',
      border: '1px solid var(--tc-gold-a45)',
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 12,
      color: 'var(--text-1)',
      fontSize: 13,
      lineHeight: 1.7
    }
  }, UI_COPY.forceGate.tip), error && /*#__PURE__*/React.createElement("div", {
    className: "error",
    style: {
      marginBottom: 12
    }
  }, error), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit
  }, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_name"
  }, UI_COPY.onboarding['case-name-label']), /*#__PURE__*/React.createElement("input", {
    id: "f_name",
    className: "input",
    type: "text",
    maxLength: 40,
    value: form.name,
    onChange: update('name'),
    placeholder: UI_COPY.onboarding['case-name-ph']
  }), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_year"
  }, UI_COPY.onboarding['year-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_year",
    className: "input",
    ref: yearRef,
    value: form.birth_year,
    onChange: update('birth_year'),
    onFocus: focusYear,
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), YEARS.map(v => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, v))), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_month"
  }, UI_COPY.onboarding['month-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_month",
    className: "input",
    value: form.birth_month,
    onChange: update('birth_month'),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), MONTHS.map(v => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, v))), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_day"
  }, UI_COPY.onboarding['day-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_day",
    className: "input",
    value: form.birth_day,
    onChange: update('birth_day'),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), DAYS.map(v => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, v))), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_hour"
  }, UI_COPY.onboarding['hour-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_hour",
    className: "input",
    value: form.birth_hour,
    onChange: update('birth_hour')
  }, HOURS.map(v => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, v))), /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_gender"
  }, UI_COPY.onboarding['gender-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_gender",
    className: "input",
    value: form.gender,
    onChange: update('gender')
  }, /*#__PURE__*/React.createElement("option", {
    value: "male"
  }, UI_COPY.onboarding['gender-male']), /*#__PURE__*/React.createElement("option", {
    value: "female"
  }, UI_COPY.onboarding['gender-female'])), /*#__PURE__*/React.createElement("label", {
    className: "label"
  }, UI_COPY.onboarding['birth-place-label']), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_province"
  }, UI_COPY.onboarding['province-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_province",
    className: "input",
    value: form.birth_province,
    onChange: updateProvince
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), Object.keys(reg).map(p => /*#__PURE__*/React.createElement("option", {
    key: p,
    value: p
  }, p)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_city"
  }, UI_COPY.onboarding['city-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_city",
    className: "input",
    value: form.birth_city,
    onChange: updateCity,
    disabled: !form.birth_province
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), cityNames.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_district"
  }, UI_COPY.onboarding['district-label']), /*#__PURE__*/React.createElement("select", {
    id: "f_district",
    className: "input",
    value: form.birth_district,
    onChange: updateDistrict,
    disabled: !form.birth_city
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, UI_COPY.onboarding['select-ph']), districtNames.map(x => /*#__PURE__*/React.createElement("option", {
    key: x,
    value: x
  }, x))))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_lng"
  }, UI_COPY.onboarding['lng-label']), /*#__PURE__*/React.createElement("input", {
    id: "f_lng",
    className: "input",
    type: "number",
    step: "0.0001",
    value: form.longitude,
    onChange: updateCoord('longitude'),
    placeholder: UI_COPY.onboarding['lng-ph']
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_lat"
  }, UI_COPY.onboarding['lat-label']), /*#__PURE__*/React.createElement("input", {
    id: "f_lat",
    className: "input",
    type: "number",
    step: "0.0001",
    value: form.latitude,
    onChange: updateCoord('latitude'),
    placeholder: UI_COPY.onboarding['lat-ph']
  }))), !coordTouched && form.longitude && form.latitude && /*#__PURE__*/React.createElement("p", {
    className: "coord-hint"
  }, UI_COPY.onboarding['coord-auto-note']), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_phone"
  }, UI_COPY.onboarding['phone-label']), /*#__PURE__*/React.createElement("input", {
    id: "f_phone",
    className: "input",
    type: "tel",
    inputMode: "numeric",
    maxLength: 11,
    value: form.phone,
    onChange: update('phone'),
    placeholder: UI_COPY.onboarding['phone-ph']
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "label",
    htmlFor: "f_email"
  }, UI_COPY.onboarding['email-label']), /*#__PURE__*/React.createElement("input", {
    id: "f_email",
    className: "input",
    type: "email",
    value: form.email,
    onChange: update('email'),
    placeholder: UI_COPY.onboarding['email-ph']
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      margin: '2px 0 0',
      lineHeight: 1.5
    }
  }, UI_COPY.onboarding['contact-note'])))), /*#__PURE__*/React.createElement("div", {
    className: "switch-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    id: "f_solar",
    checked: form.true_solar_time,
    onChange: toggleSolar
  }), /*#__PURE__*/React.createElement("span", {
    className: "slider"
  })), /*#__PURE__*/React.createElement("label", {
    htmlFor: "f_solar",
    style: {
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, UI_COPY.onboarding['solar-label'])), /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      marginTop: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: loading,
    style: {
      flex: '1 1 160px'
    }
  }, loading ? UI_COPY.onboarding['loading-btn'] : UI_COPY.onboarding['submit-btn']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    disabled: loading,
    onClick: handleSaveNext,
    style: {
      flex: '1 1 160px'
    }
  }, UI_COPY.onboarding['next-btn']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    disabled: loading,
    onClick: shareFill.openShareFill,
    style: {
      flex: '1 1 160px'
    }
  }, shareFill.busy ? UI_COPY.shareFill.generating : UI_COPY.buttons.share_fill)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      margin: '10px 0 0',
      lineHeight: 1.7
    }
  }, UI_COPY.onboarding['free-note']))));
}
