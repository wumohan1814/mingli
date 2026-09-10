// 国学域视图（节110 阶段3）：黄历择日 AlmanacPage + ALMANAC_* 常量/助手（后续 TaiyiPage/HuangjiPage 等追加本文件）
// 加载于 components.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- REQ-121：黄历择日（免档案纯国学工具：免费确定性起算 + 可选付费深度解读） ---------- */
// 事项 10 类（key 对齐 vendored mingyu-core AlmanacTopic：move/marriage/opening/contract/
// travel/medical/study/burial/renovation/custom；custom 关键词为空，仅按通用历书比较，
// 用户填写的具体事项文本随 customTopicLabel 透传后端供展示与深度解读引用）
const ALMANAC_TOPIC_OPTIONS = [
  { key: 'move', label: '搬家入宅' },
  { key: 'marriage', label: '订婚结婚' },
  { key: 'opening', label: '开业启动' },
  { key: 'contract', label: '签约合作' },
  { key: 'travel', label: '出行赴任' },
  { key: 'medical', label: '就医手术' },
  { key: 'study', label: '考试学习' },
  { key: 'burial', label: '安葬修坟' },
  { key: 'renovation', label: '修造动土' },
  { key: 'custom', label: '自定义' }
];
// 参与人时辰（index 对齐引擎 SHICHEN_PERIODS：0 早子时 … 11 亥时 / 12 晚子时）
const ALMANAC_SHICHEN = [
  { i: 0, label: '早子时（00-01）' },
  { i: 1, label: '丑时（01-03）' },
  { i: 2, label: '寅时（03-05）' },
  { i: 3, label: '卯时（05-07）' },
  { i: 4, label: '辰时（07-09）' },
  { i: 5, label: '巳时（09-11）' },
  { i: 6, label: '午时（11-13）' },
  { i: 7, label: '未时（13-15）' },
  { i: 8, label: '申时（15-17）' },
  { i: 9, label: '酉时（17-19）' },
  { i: 10, label: '戌时（19-21）' },
  { i: 11, label: '亥时（21-23）' },
  { i: 12, label: '晚子时（23-24）' }
];
const ALMANAC_MAX_DAYS = 180;
// candidateGroups.statusByDate[date] = '可用候选'|'条件候选'|'慎用候选' → 展示态
const almanacStatusOf = function (groups, date) {
  const s = groups && groups.statusByDate ? groups.statusByDate[date] : '';
  if (s === '可用候选') return 'preferred';
  if (s === '条件候选') return 'conditional';
  return 'caution'; // 未知/缺失状态一律按慎用兜底展示，不臆造更高级别
};
const almanacStatusRank = function (cls) {
  return cls === 'preferred' ? 0 : cls === 'conditional' ? 1 : 2;
};
const ALMANAC_STATUS_CN = { preferred: '可用候选', conditional: '条件候选', caution: '慎用候选' };
function AlmanacPage({
  onNavigate
}) {
  const payEnough = usePaySufficient();
  const A = UI_COPY.almanac;
  const [topic, setTopic] = useState('move');
  const [customText, setCustomText] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(function () {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  });
  const [participants, setParticipants] = useState([]);
  const [data, setData] = useState(null); // {id, method, result}
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  const [hoursOpen, setHoursOpen] = useState({}); // date → bool（逐时时课展开态）
  // REQ-133③：日期折叠（默认折叠，点击展开）
  const [dayOpen, setDayOpen] = useState({});
  // REQ-133④：参与人多选已有档案（null=加载中 / [] =无档案 / 数组=已就绪）
  const [caseList, setCaseList] = useState(null);
  const [caseErr, setCaseErr] = useState('');
  const [pickingCases, setPickingCases] = useState(false);
  const toggleDay = function (date) {
    setDayOpen(prev => Object.assign({}, prev, { [date]: !prev[date] }));
  };
  const removePart = function (idx) {
    setParticipants(prev => prev.filter(function (_, i) { return i !== idx; }));
  };
  // REQ-133④：小时(0-23) → 时辰档（ALMANAC_SHICHEN i；0=早子时、23=晚子时）
  const hourToShichen = function (h) {
    const n = Number(h);
    if (isNaN(n)) return 6;
    if (n === 0) return 0;
    if (n === 23) return 12;
    return Math.floor((n + 1) / 2);
  };
  const loadCases = async function () {
    if (caseList !== null) return;
    setCaseErr('');
    try {
      const r = await api('/cases', { method: 'GET' });
      const arr = (r && r.data && r.data.cases) || (r && r.cases) || [];
      setCaseList(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setCaseErr((e && e.message) || '档案列表加载失败，请重试。');
      setCaseList([]);
    }
  };
  // REQ-133④：档案 → 参与人（拉 archive 取完整生辰；缺失引导补全，不做现场新建临时档案）
  const addCaseParticipant = async function (c) {
    if (participants.length >= 30) {
      toast(A.part_max_warn);
      return;
    }
    const cid = String(c.caseId);
    if (participants.some(function (p) { return p.caseId === cid; })) {
      toast('该档案已在参与人中');
      return;
    }
    try {
      const r = await api('/cases/' + cid + '/archive');
      const d = (r && r.data) || {};
      const inp = (d && d.input) || {};
      const y = inp.birth_year != null ? String(inp.birth_year) : '';
      const m = inp.birth_month != null ? String(inp.birth_month) : '';
      const dd = inp.birth_day != null ? String(inp.birth_day) : '';
      if (!y || !m || !dd) {
        toast('档案「' + ((c.name && String(c.name).trim()) || c.caseId) + '」缺少完整出生日期，请先到档案管理补全');
        return;
      }
      setParticipants(prev => prev.concat([{
        caseId: cid,
        name: (c.name && String(c.name).trim()) || '档案 ' + c.caseId,
        gender: inp.gender === 'female' ? '女' : '男',
        year: y,
        month: m,
        day: dd,
        timeIndex: hourToShichen(inp.birth_hour)
      }]));
    } catch (e) {
      toast((e && e.message) || '档案信息加载失败，请重试。');
    }
  };
  const toggleHours = function (date) {
    setHoursOpen(prev => Object.assign({}, prev, { [date]: !prev[date] }));
  };
  const rangeValid = function () {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      toast('请填写起止日期（YYYY-MM-DD）');
      return false;
    }
    const s = new Date(startDate + 'T00:00:00+08:00').getTime();
    const e = new Date(endDate + 'T00:00:00+08:00').getTime();
    if (isNaN(s) || isNaN(e) || e < s) {
      toast('结束日期不得早于开始日期');
      return false;
    }
    if (Math.round((e - s) / 86400000) > ALMANAC_MAX_DAYS - 1) {
      toast('一次最多比较 180 天，请缩小日期范围');
      return false;
    }
    return true;
  };
  const partsValid = function () {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const y = Number(p.year), m = Number(p.month), d = Number(p.day);
      if (!/^\d{4}$/.test(String(p.year).trim()) || y < 1900 || y > 2100) {
        toast('参与人 ' + (i + 1) + '：出生年份需为 1900-2100 的整数');
        return false;
      }
      if (!/^\d{1,2}$/.test(String(p.month).trim()) || m < 1 || m > 12) {
        toast('参与人 ' + (i + 1) + '：出生月份需为 1-12');
        return false;
      }
      if (!/^\d{1,2}$/.test(String(p.day).trim()) || d < 1 || d > 31) {
        toast('参与人 ' + (i + 1) + '：出生日期需为 1-31');
        return false;
      }
    }
    return true;
  };
  const run = async function () {
    if (loading) return;
    if (!token) {
      toast(A.login_hint);
      onNavigate('auth');
      return;
    }
    if (!rangeValid()) return;
    if (!partsValid()) return;
    const seed = {
      almanac: { topic: topic, startDate: startDate, endDate: endDate }
    };
    if (topic === 'custom' && customText.trim()) seed.almanac.customTopicLabel = customText.trim();
    if (participants.length) {
      // 引擎要求参与人完整生辰（生肖/年命须由年支推算），缺生日资料无法核验刑冲破害；
      // 因此参与者按「完整公历生日」收集，dateType 恒为 solar。
      seed.almanac.participants = participants.map(function (p, i) {
        return {
          id: 'p' + (i + 1),
          name: (p.name || '').trim() || ('参与人' + (i + 1)),
          gender: p.gender,
          year: String(p.year).trim(),
          month: String(p.month).trim(),
          day: String(p.day).trim(),
          timeIndex: String(p.timeIndex),
          dateType: 'solar'
        };
      });
    }
    setLoading(true);
    setErrored('');
    setData(null);
    setInterp('');
    setInterpErr('');
    setHoursOpen({});
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: 'almanac', case_id: null, seed: seed })
      });
      const d = (res && res.data) || res;
      setData(d);
      track('almanac_cast', { topic: topic });
    } catch (e) {
      setErrored((e && e.message) || '起算失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  const interpret = async function () {
    if (!data || !data.id || interpLoading) return;
    setInterpLoading(true);
    setInterpErr('');
    try {
      const res = await api('/divinations' + '/' + data.id + '/interpret', { method: 'POST', body: '{}' });
      setInterp((res && res.data && res.data.interpretation) || '（暂无深度解读内容）');
      track('almanac_interpret', {});
    } catch (e) {
      setInterpErr((e && e.message) || '深度解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  const result = (data && data.result) || null;
  const groups = (result && result.candidateGroups) || null;
  const days = Array.isArray(result && result.days) ? result.days.slice() : [];
  const sortedDays = days.sort(function (a, b) {
    return almanacStatusRank(almanacStatusOf(groups, a.date)) - almanacStatusRank(almanacStatusOf(groups, b.date));
  });
  const statCount = function (cls) {
    return sortedDays.filter(function (d) { return almanacStatusOf(groups, d.date) === cls; }).length;
  };
  // REQ-128：逐日卡片渲染出的名词（建除/十二神/宜忌项/宿曜九星/百忌/冲煞/方位神）供内嵌白话卡标签；
  // 建除日名引擎值为单字（如「建」），对齐名词卡 term（「建日」）作 +日 归一
  const almNouns = [];
  sortedDays.forEach(function (d) {
    if (!d) return;
    if (d.dayOfficer) almNouns.push(d.dayOfficer + '日');
    if (d.twelveStar) almNouns.push(d.twelveStar);
    (Array.isArray(d.recommends) ? d.recommends : []).forEach(function (r) { if (r) almNouns.push(r); });
    (Array.isArray(d.avoids) ? d.avoids : []).forEach(function (a) { if (a) almNouns.push(a); });
    if (d.twentyEightStar) almNouns.push('二十八宿');
    if (d.nineStar) almNouns.push('九星');
    if (d.pengZu) almNouns.push('百忌');
    almNouns.push('冲煞');
    (Array.isArray(d.annualDirectionGods) ? d.annualDirectionGods : []).forEach(function (g) { if (g && g.god) almNouns.push(g.god); });
  });
  const topicLabel = (result && result.topicLabel) || (ALMANAC_TOPIC_OPTIONS.find(function (t) { return t.key === topic; }) || {}).label || '自定义事项';
  // 逐日卡片
  const dayCard = function (d) {
    const cls = almanacStatusOf(groups, d.date);
    const dayIsOpen = Boolean(dayOpen[d.date]); // REQ-133③：日期折叠默认收起
    const gz = d.ganzhi || {};
    const gzText = [gz.year, gz.month, gz.day].filter(Boolean).join(' ');
    const star28 = d.twentyEightStarDetail || null;
    const star9 = d.nineStarDetail || null;
    const rows = [];
    rows.push(React.createElement('div', { key: 'meta', className: 'alm-day-meta' },
      React.createElement('b', null, '农历'), d.lunarDate || '—', ' · ',
      React.createElement('b', null, '干支'), gzText || '—', ' · ',
      React.createElement('b', null, '建除'), d.dayOfficer || '—', ' · ',
      React.createElement('b', null, '十二神'), d.twelveStar || '—', ' · ',
      React.createElement('b', null, '冲煞'), d.clash || '—'));
    const rec = Array.isArray(d.recommends) && d.recommends.length;
    const avd = Array.isArray(d.avoids) && d.avoids.length;
    if (rec) rows.push(React.createElement('div', { key: 'rec', className: 'alm-row rec' },
      React.createElement('span', { className: 'alm-row-label' }, '宜'), d.recommends.join('、')));
    if (avd) rows.push(React.createElement('div', { key: 'avd', className: 'alm-row avd' },
      React.createElement('span', { className: 'alm-row-label' }, '忌'), d.avoids.join('、')));
    const starLine = [];
    starLine.push('二十八宿 ' + (d.twentyEightStar || '—') + (star28 ? '（' + [star28.fullName, star28.zone, star28.fortune].filter(Boolean).join(' · ') + '）' : ''));
    starLine.push('九星 ' + (d.nineStar || '—') + (star9 ? '（' + [star9.fullName, star9.color, star9.wuxing].filter(Boolean).join(' · ') + '）' : ''));
    if (starLine.length) rows.push(React.createElement('div', { key: 'star', className: 'alm-row neu' },
      React.createElement('span', { className: 'alm-row-label' }, '宿曜'), starLine.join('　')));
    if (d.pengZu) rows.push(React.createElement('div', { key: 'pz', className: 'alm-row neu' },
      React.createElement('span', { className: 'alm-row-label' }, '百忌'), d.pengZu));
    if (Array.isArray(d.annualDirectionGods) && d.annualDirectionGods.length) {
      rows.push(React.createElement('div', { key: 'dir', className: 'alm-row neu' },
        React.createElement('span', { className: 'alm-row-label' }, '方位'), d.annualDirectionGods.map(function (g) {
          return (g.god || '') + (g.direction ? '（' + g.direction + '）' : '');
        }).join('、')));
    }
    const tags = [];
    (Array.isArray(d.highlights) ? d.highlights : []).forEach(function (h, i) {
      tags.push(React.createElement('span', { key: 'h' + i, className: 'alm-tag' }, h));
    });
    (Array.isArray(d.cautions) ? d.cautions : []).forEach(function (c, i) {
      tags.push(React.createElement('span', { key: 'c' + i, className: 'alm-tag warn' }, c));
    });
    (Array.isArray(d.participantNotes) ? d.participantNotes : []).forEach(function (n, i) {
      tags.push(React.createElement('span', { key: 'p' + i, className: 'alm-tag dim' }, n));
    });
    if (tags.length) rows.push(React.createElement('div', { key: 'tags', className: 'alm-hls' }, tags));
    // 逐时时课（折叠展示：默认前 6 个时辰，展开看全部）
    const hours = Array.isArray(d.hours) ? d.hours : [];
    const open = Boolean(hoursOpen[d.date]);
    if (hours.length) {
      const shown = open ? hours : hours.slice(0, 6);
      const hourItems = shown.map(function (h, i) {
        const hTags = [];
        (Array.isArray(h.highlights) ? h.highlights : []).forEach(function (x, j) {
          hTags.push(React.createElement('span', { key: 'g' + j, className: 'ah-good' }, x));
        });
        (Array.isArray(h.cautions) ? h.cautions : []).forEach(function (x, j) {
          hTags.push(React.createElement('span', { key: 'b' + j, className: 'ah-bad' }, x));
        });
        const pn = (Array.isArray(h.participantNotes) ? h.participantNotes : []).join('；');
        return React.createElement('div', { key: 'hr' + i, className: 'alm-hour-item' },
          React.createElement('span', { className: 'ah-name' }, h.name || ''),
          h.range ? React.createElement('span', { className: 'ah-sub' }, h.range + ' · ' + (h.ganzhi || '') + ' · ' + (h.twelveStar || '')) : null,
          hTags.length ? React.createElement('span', null, hTags) : null,
          pn ? React.createElement('span', { className: 'ah-sub' }, pn) : null);
      });
      rows.push(React.createElement('div', { key: 'hours', className: 'alm-hours' },
        React.createElement('div', { className: 'alm-hour-cap' }, A.hour_cap),
        React.createElement('div', { className: 'alm-hour-grid' }, hourItems),
        React.createElement('button', { type: 'button', className: 'focus-btn', style: { marginTop: 6 }, onClick: function () { toggleHours(d.date); } },
          open ? A.hour_less : A.hour_more)));
    } else {
      rows.push(React.createElement('div', { key: 'hours', className: 'alm-hours' },
        React.createElement('div', { className: 'alm-hour-cap' }, A.hour_cap), A.no_hours));
    }
    return React.createElement('div', { key: d.date, className: 'alm-day-card ' + cls },
      React.createElement('button', { type: 'button', className: 'alm-day-toggle', 'aria-expanded': dayIsOpen, onClick: function () { toggleDay(d.date); } },
        React.createElement('div', { className: 'alm-day-date' }, d.date,
          React.createElement('small', null, (d.weekday || '') + ' · ' + (d.zodiac ? d.zodiac + '日' : ''))),
        React.createElement('span', { className: 'alm-status ' + cls }, ALMANAC_STATUS_CN[cls] || '慎用候选'),
        React.createElement('span', { className: 'alm-day-arrow' + (dayIsOpen ? ' open' : '') }, '▾')),
      dayIsOpen ? React.createElement('div', { className: 'alm-day-body' }, rows) : null);
  };
  let body = null;
  if (loading) {
    body = React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'skeleton sk-line' }),
      React.createElement('div', { className: 'skeleton sk-line', style: { width: '60%' } }));
  } else if (errored) {
    body = React.createElement('div', { className: 'card failed-box' },
      React.createElement('div', { className: 'section-title' }, '起算失败'),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: run }, UI_COPY.buttons.retry));
  } else if (result && typeof result === 'object') {
    const freeTxt = A.free_reading
      .replace('{topic}', topicLabel + (result.customTopicLabel ? '（' + result.customTopicLabel + '）' : ''))
      .replace('{start}', result.startDate || startDate)
      .replace('{end}', result.endDate || endDate);
    const constr = [];
    (groups && Array.isArray(groups.hardConstraints) ? groups.hardConstraints : []).forEach(function (h) { constr.push(h); });
    (groups && Array.isArray(groups.realityConstraints) ? groups.realityConstraints : []).forEach(function (r) { constr.push(r); });
    const partLine = (Array.isArray(result.participants) && result.participants.length)
      ? result.participants.map(function (p) { return (p.name || '') + (p.zodiac ? '（' + p.zodiac + '）' : ''); }).join('、')
      : '';
    body = React.createElement('div', null,
      // REQ-133②：顶部独立操作色块（趋势免费解读 + 深度解读），置于起算下方、不再贴底被压
      React.createElement('div', { className: 'alm-op-zone' },
        React.createElement('div', { className: 'af-title' }, A.free_reading_title),
        React.createElement('div', { className: 'af-txt' }, freeTxt),
        React.createElement('div', { className: 'pay-hint' }, A.pay_hint),
        React.createElement('div', { style: { marginTop: 8 } },
          React.createElement('button', { className: 'btn btn-outline', disabled: interpLoading, onClick: interpret },
            interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)])),
        interpErr ? React.createElement('div', { className: 'error', style: { marginTop: 10 } }, interpErr) : null,
        interp ? React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'interp-title' }, A.interp_title),
          React.createElement('div', { className: 'interp-body' }, interp)) : null),
      // 结果标题卡（日期统计 + 折叠日期菜单 + 本盘名词 + 说明 + 免责）
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'section-title' }, A.result_title,
          result.customTopicLabel ? React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginLeft: 8 } }, '· ' + result.customTopicLabel) : null),
        React.createElement('div', { className: 'alm-group-bar' },
          React.createElement('span', { className: 'alm-gstat' }, A.status_preferred, React.createElement('b', null, statCount('preferred')), ' 天'),
          React.createElement('span', { className: 'alm-gstat' }, A.status_conditional, React.createElement('b', null, statCount('conditional')), ' 天'),
          React.createElement('span', { className: 'alm-gstat' }, A.status_caution, React.createElement('b', null, statCount('caution')), ' 天')),
        React.createElement('div', { className: 'alm-constr' }, A.group_summary),
        partLine ? React.createElement('div', { className: 'alm-constr', style: { color: 'var(--text-2)' } }, '参与人：' + partLine) : null,
        sortedDays.map(dayCard),
        React.createElement(TCTermRow, { key: 'tc', method: 'almanac', label: '本盘名词', items: almNouns, chipClass: 'alm-tag' }),
        constr.length ? React.createElement('div', { className: 'alm-constr' }, '说明：' + constr.join('\n')) : null,
        React.createElement('div', { className: 'alm-disc' }, A.disclaimer)));
  }
  const formCard = React.createElement('div', { className: 'card' },
    React.createElement('div', { className: 'section-title' }, '择日信息'),
    React.createElement('div', { className: 'ask-cap' }, A.topic_label, React.createElement('em', null, '*')),
    React.createElement('div', { className: 'alm-topics' }, ALMANAC_TOPIC_OPTIONS.map(function (t) {
      return React.createElement('button', {
        key: t.key,
        type: 'button',
        className: 'alm-topic-chip' + (topic === t.key ? ' sel' : ''),
        onClick: function () { setTopic(t.key); }
      }, t.label);
    })),
    topic === 'custom' ? React.createElement('input', {
      key: 'cst',
      className: 'alm-part-input alm-custom-in',
      type: 'text',
      maxLength: 60,
      placeholder: A.topic_custom_ph,
      value: customText,
      onChange: function (e) { setCustomText(e.target.value); }
    }) : null,
    React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, A.range_label, React.createElement('em', null, '*')),
    React.createElement('div', { className: 'dt-row' },
      React.createElement('label', { className: 'dt-field' },
        React.createElement('span', { className: 'dt-cap' }, A.start_label, React.createElement('em', null, '*')),
        React.createElement('input', { type: 'date', className: 'dt-input', value: startDate, onChange: function (e) { setStartDate(e.target.value); } })),
      React.createElement('label', { className: 'dt-field' },
        React.createElement('span', { className: 'dt-cap' }, A.end_label, React.createElement('em', null, '*')),
        React.createElement('input', { type: 'date', className: 'dt-input', value: endDate, onChange: function (e) { setEndDate(e.target.value); } }))),
    React.createElement('div', { className: 'alm-range-note' }, '起止日期默认今天起 30 天，可调整；一次最多比较 180 天。'),
    React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, A.part_label),
    React.createElement('div', { className: 'alm-parts' }, participants.map(function (p, idx) {
      return React.createElement('div', { key: 'p' + idx, className: 'alm-part-item' },
        React.createElement('div', { className: 'alm-part-head' },
          React.createElement('span', { className: 'alm-part-title' }, p.name || ('参与人 ' + (idx + 1))),
          React.createElement('button', { type: 'button', className: 'focus-btn off', onClick: function () { removePart(idx); } }, A.part_remove)),
        React.createElement('div', { className: 'alm-part-grid' },
          React.createElement('div', { className: 'alm-part-field wide' },
            React.createElement('span', { className: 'alm-part-cap' }, '出生'),
            React.createElement('span', { className: 'alm-part-birth' }, [p.year, p.month, p.day].filter(Boolean).join('-') + (p.timeIndex != null && ALMANAC_SHICHEN[p.timeIndex] ? ' · ' + ALMANAC_SHICHEN[p.timeIndex].label : ''))),
          React.createElement('div', { className: 'alm-part-field wide' },
            React.createElement('span', { className: 'alm-part-cap' }, A.part_gender),
            React.createElement('span', { className: 'alm-part-birth' }, p.gender))));
    })),
    // REQ-133④：参与人改为多选已有档案（不做现场新建临时档案）
    React.createElement('button', { type: 'button', className: 'alm-part-add', onClick: function () { if (caseList === null) loadCases(); setPickingCases(!pickingCases); } },
      pickingCases ? '收起档案选择' : '＋ 选择档案作为参与人'),
    pickingCases ? React.createElement('div', { className: 'alm-part-pick' },
      caseErr ? React.createElement('div', { className: 'error' }, caseErr) : null,
      !caseList || !caseList.length ? React.createElement('div', { className: 'alm-part-pick-hint' },
        caseList === null ? '加载档案中…' : '暂无档案，请先到「档案管理」建立档案后再来择日。') :
        React.createElement('div', { className: 'case-opts' }, caseList.map(function (c) {
          const sel = participants.some(function (p) { return p.caseId === String(c.caseId); });
          const meta = [c.birthYear ? c.birthYear + ' 年' : '', c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '', c.birthplace || ''].filter(Boolean).join(' · ') || '出生信息未补充';
          return React.createElement('button', { key: c.caseId, type: 'button', className: 'case-opt' + (sel ? ' sel' : ''), onClick: function () { if (!sel) addCaseParticipant(c); } },
            React.createElement('div', { className: 'co-main' },
              React.createElement('span', { className: 'co-name' }, c.name || '档案 ' + c.caseId),
              React.createElement('span', { className: 'co-meta' }, meta)),
            React.createElement('span', { className: 'co-check' }, sel ? '✓' : ''));
        }))) : null,
    React.createElement('div', { className: 'alm-range-note' }, A.part_hint),
    // REQ-134：起算按钮与说明独立分层（不再 flex 并排挤压）
    React.createElement('div', { className: 'op-run' },
      React.createElement('button', { className: 'btn btn-primary', type: 'button', disabled: loading, onClick: run },
        loading ? A.running : A.run),
      React.createElement('span', { className: 'op-run-note' }, '确定性计算、零 LLM、免费；深度解读为可选付费（按实际用量扣余额）。')));
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'calendar', size: 22 }), ' ' + A.title),
    !token ? React.createElement('div', { className: 'card' },
      React.createElement('p', { style: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 } }, A.login_hint),
      React.createElement('button', { className: 'btn btn-primary', onClick: function () { onNavigate('auth'); } }, A.login_btn)) : React.createElement(React.Fragment, null,
      formCard,
      body,
      React.createElement('div', { className: 'back-row fill' },
        React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('guoxue-hub'); } }, UI_COPY.buttons.back_options))));
}