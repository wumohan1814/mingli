// 国学域视图（节110 阶段3）：黄历 AlmanacPage / 太乙 TaiyiPage / 皇极 HuangjiPage（后续其他国学视图追加本文件）
// 加载于 components.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- REQ-121：黄历择日（免档案纯国学工具：免费确定性起算 + 可选付费深度解读） ---------- */
// 事项 10 类（key 对齐 vendored mingyu-core AlmanacTopic：move/marriage/opening/contract/
// travel/medical/study/burial/renovation/custom；custom 关键词为空，仅按通用历书比较，
// 用户填写的具体事项文本随 customTopicLabel 透传后端供展示与深度解读引用）
const ALMANAC_TOPIC_OPTIONS = [
  { key: 'move', label: UI_COPY.guoxue.move },
  { key: 'marriage', label: UI_COPY.guoxue.marriage },
  { key: 'opening', label: UI_COPY.guoxue.opening },
  { key: 'contract', label: UI_COPY.guoxue.contract },
  { key: 'travel', label: UI_COPY.guoxue.travel },
  { key: 'medical', label: UI_COPY.guoxue.medical },
  { key: 'study', label: UI_COPY.guoxue.study },
  { key: 'burial', label: UI_COPY.guoxue.burial },
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
      toast(ML_COPY.ui.toast['guoxue-participant-duplicate']);
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
        toast(fmtTpl(ML_COPY.ui.toast['guoxue-case-birth-missing'], { name: (c.name && String(c.name).trim()) || c.caseId }));
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
      toast((e && e.message) || ML_COPY.ui.toast['guoxue-case-load-fail']);
    }
  };
  const toggleHours = function (date) {
    setHoursOpen(prev => Object.assign({}, prev, { [date]: !prev[date] }));
  };
  const rangeValid = function () {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      toast(ML_COPY.ui.toast['guoxue-date-range-required']);
      return false;
    }
    const s = new Date(startDate + 'T00:00:00+08:00').getTime();
    const e = new Date(endDate + 'T00:00:00+08:00').getTime();
    if (isNaN(s) || isNaN(e) || e < s) {
      toast(ML_COPY.ui.toast['guoxue-end-before-start']);
      return false;
    }
    if (Math.round((e - s) / 86400000) > ALMANAC_MAX_DAYS - 1) {
      toast(ML_COPY.ui.toast['guoxue-range-too-long-180']);
      return false;
    }
    return true;
  };
  const partsValid = function () {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const y = Number(p.year), m = Number(p.month), d = Number(p.day);
      if (!/^\d{4}$/.test(String(p.year).trim()) || y < 1900 || y > 2100) {
        toast(fmtTpl(ML_COPY.ui.toast['guoxue-participant-year-range'], { n: i + 1 }));
        return false;
      }
      if (!/^\d{1,2}$/.test(String(p.month).trim()) || m < 1 || m > 12) {
        toast(fmtTpl(ML_COPY.ui.toast['guoxue-participant-month-range'], { n: i + 1 }));
        return false;
      }
      if (!/^\d{1,2}$/.test(String(p.day).trim()) || d < 1 || d > 31) {
        toast(fmtTpl(ML_COPY.ui.toast['guoxue-participant-day-range'], { n: i + 1 }));
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
        React.createElement(MLTermRow, { key: 'tc', method: 'almanac', label: '本盘名词', items: almNouns, chipClass: 'alm-tag' }),
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

/* ---------- REQ-124：太乙神数（免档案纯国学大势工具：免费确定性起算 + 可选付费深度解读） ---------- */
// 计式 4 选 1（key 对齐 vendored mingyu-core TaiyiScope：year 年家 / month 月家 / day 日家 / hour 时家；
// 年家须传公历年份，月/日/时家须传 日期+时辰 组装的东八区 ISO customDate，引擎契约见 server.mjs）
const TAIYI_SCOPES = [{
  key: 'year',
  label: '年家',
  hint: '以公历年份定年计积年，看一年大势（默认）'
}, {
  key: 'month',
  label: '月家',
  hint: '以日期定月计积月，看一月大势'
}, {
  key: 'day',
  label: '日家',
  hint: '以日期定日计积日，看一日大势'
}, {
  key: 'hour',
  label: '时家',
  hint: '以日期+时辰定时计积时，看一时辰大势'
}];
const TAIYI_SCOPE_CN = { year: '年家', month: '月家', day: '日家', hour: '时家' };
function TaiyiPage({
  onNavigate
}) {
  const payEnough = usePaySufficient();
  const A = UI_COPY.taiyi;
  const [scope, setScope] = useState('year');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [timeDate, setTimeDate] = useState(todayStr());
  const [shichen, setShichen] = useState(nowShichen());
  const [data, setData] = useState(null); // {id, method, result}
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  const [chainOpen, setChainOpen] = useState(false); // 证据链折叠态
  const scopeValid = function () {
    if (scope === 'year') {
      const y = Number(year);
      if (!/^\d{1,4}$/.test(String(year).trim()) || !Number.isInteger(y) || y < 1 || y > 9999) {
        toast(ML_COPY.ui.toast['guoxue-taiyi-year-range']);
        return false;
      }
    } else {
      if (typeof timeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(timeDate)) {
        toast(ML_COPY.ui.toast['guoxue-date-required']);
        return false;
      }
      if (!(typeof shichen === 'number' && shichen >= 0 && shichen < SHICHEN_ARR.length)) {
        toast(ML_COPY.ui.toast['guoxue-shichen-required']);
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
    if (!scopeValid()) return;
    const seed = { taiyi: { scope: scope } };
    if (scope === 'year') {
      seed.taiyi.year = Number(year);
    } else {
      const startH = (SHICHEN_ARR[shichen] || SHICHEN_ARR[0]).start;
      seed.taiyi.customDate = timeDate + 'T' + pad2(startH) + ':00:00+08:00';
    }
    setLoading(true);
    setErrored('');
    setData(null);
    setInterp('');
    setInterpErr('');
    setChainOpen(false);
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: 'taiyi', case_id: null, seed: seed })
      });
      const d = (res && res.data) || res;
      setData(d);
      track('taiyi_cast', { scope: scope });
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
      track('taiyi_interpret', {});
    } catch (e) {
      setInterpErr((e && e.message) || '深度解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  const result = (data && data.result) || null;
  const chain = (result && result.evidenceChain) || null;
  const scopeLabel = TAIYI_SCOPE_CN[(result && result.scope) || scope] || '年家';
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
    const posCells = [{
      role: A.pos_taiyi,
      val: result.taiyiPosition || '—',
      sub: (result.taiyiPalace != null ? '宫' + result.taiyiPalace : '') + [result.taiyiGua, result.taiyiDir].filter(Boolean).join(' '),
      cls: ''
    }, {
      role: A.pos_wenchang,
      val: result.wenChangPosition || '—',
      sub: result.wenChangPalace != null ? '宫' + result.wenChangPalace : '',
      cls: ''
    }, {
      role: A.pos_shiJi,
      val: result.shiJiPosition || '—',
      sub: result.shiJiPalace != null ? '宫' + result.shiJiPalace : '',
      cls: ''
    }, {
      role: A.pos_jiShen,
      val: result.jiShenPosition || '—',
      sub: result.jiShenPalace != null ? '宫' + result.jiShenPalace : '',
      cls: ''
    }];
    const natures = (result.countNatures && typeof result.countNatures === 'object') ? result.countNatures : {};
    const countCells = [{
      side: A.side_lord,
      num: result.lordCount,
      nat: natures.lord || '',
      sub: '大将' + (result.lordGeneral != null ? result.lordGeneral + '宫' : '—') + ' · 参将' + (result.lordAssistant != null ? result.lordAssistant + '宫' : '—'),
      cls: 'lord'
    }, {
      side: A.side_guest,
      num: result.guestCount,
      nat: natures.guest || '',
      sub: '大将' + (result.guestGeneral != null ? result.guestGeneral + '宫' : '—') + ' · 参将' + (result.guestAssistant != null ? result.guestAssistant + '宫' : '—'),
      cls: 'guest'
    }, {
      side: A.side_set,
      num: result.setCount,
      nat: natures.set || '',
      sub: '大将' + (result.setGeneral != null ? result.setGeneral + '宫' : '—') + ' · 参将' + (result.setAssistant != null ? result.setAssistant + '宫' : '—'),
      cls: 'set'
    }];
    const freeTxt = A.free_reading
      .split('{scopeLabel}').join(scopeLabel)
      .replace('{bureau}', result.bureau != null ? result.bureau : '—')
      .replace('{ganZhi}', result.ganZhi || '—')
      .replace('{taiyi}', ((result.taiyiPosition || '') + (result.taiyiPalace != null ? result.taiyiPalace : '') + (result.taiyiDir || '')).trim() || '—');
    const kids = [];
    kids.push(React.createElement('div', { key: 'hero', className: 'ty-hero' },
      React.createElement('div', { className: 'ty-bureau' },
        React.createElement('span', { className: 'tb-name' }, result.bureau != null ? result.bureau + '局' : '—'),
        React.createElement('span', { className: 'tb-sub' }, result.yinYang || '')),
      React.createElement('div', { className: 'ty-hero-meta' },
        React.createElement('b', null, '干支'), result.ganZhi || '—', ' · ',
        React.createElement('b', null, '起算'), result.dateTime || '—', React.createElement('br', null),
        React.createElement('b', null, '积数'), '积' + (result.accumulatedLabel || '') + (result.accumulatedValue != null ? result.accumulatedValue : '—'),
        '（360 周期余数 ' + (result.entryYears != null ? result.entryYears : '—') + '）')));
    kids.push(React.createElement('div', { key: 'pos', className: 'card', style: { marginTop: 10 } },
      React.createElement('div', { className: 'section-title' }, A.pos_title),
      React.createElement('div', { className: 'ty-pos-grid' }, posCells.map(function (c, i) {
        return React.createElement('div', { key: i, className: 'ty-pos-cell' },
          React.createElement('div', { className: 'tp-role' }, c.role),
          React.createElement('div', { className: 'tp-val' }, c.val),
          c.sub ? React.createElement('div', { className: 'tp-sub' }, c.sub) : null);
      })),
      React.createElement(MLTermRow, { key: 'tc-pos', method: 'taiyi', items: [A.pos_taiyi, A.pos_wenchang, A.pos_shiJi, A.pos_jiShen] })));
    kids.push(React.createElement('div', { key: 'count', className: 'card', style: { marginTop: 10 } },
      React.createElement('div', { className: 'section-title' }, A.count_title),
      React.createElement('div', { className: 'ty-count-grid' }, countCells.map(function (c, i) {
        return React.createElement('div', { key: i, className: 'ty-count-cell ' + c.cls },
          React.createElement('div', { className: 'tc-side' }, c.side),
          React.createElement('div', { className: 'tc-num' }, c.num != null ? c.num : '—',
            c.nat ? React.createElement('span', { className: 'tc-nat' }, c.nat) : null),
          React.createElement('div', { className: 'tc-sub' }, c.sub));
      })),
      React.createElement(MLTermRow, { key: 'tc-count', method: 'taiyi', items: [A.side_lord, A.side_guest, A.side_set] })));
    if (result.tacticGuidance) {
      kids.push(React.createElement('div', { key: 'tac', className: 'ty-tactic' },
        React.createElement('div', { className: 'tt-cap' }, A.tactic_title),
        React.createElement('div', { className: 'tt-txt' }, result.tacticGuidance)));
    }
    if (Array.isArray(result.judgments) && result.judgments.length) {
      kids.push(React.createElement('div', { key: 'judge', className: 'card', style: { marginTop: 10 } },
        React.createElement('div', { className: 'section-title' }, A.judge_title),
        result.judgments.map(function (j, i) {
          return React.createElement('div', { key: i, className: 'ty-judge' }, j);
        })));
    }
    if (Array.isArray(result.sixteenGods) && result.sixteenGods.length) {
      kids.push(React.createElement('div', { key: 'gods', className: 'card', style: { marginTop: 10 } },
        React.createElement('div', { className: 'section-title' }, A.gods_title),
        React.createElement('div', { className: 'ty-gods' }, result.sixteenGods.map(function (g, i) {
          return React.createElement('span', { key: i, className: 'ty-god' },
            React.createElement('b', null, g.god || '—'), '（' + (g.branch || '—') + '）');
        }))));
    }
    if (chain) {
      const chainLines = [].concat(
        Array.isArray(chain.calculationChain) ? chain.calculationChain : [],
        Array.isArray(chain.primaryFacts) ? chain.primaryFacts : [],
        Array.isArray(chain.supportingFacts) ? chain.supportingFacts : [],
        Array.isArray(chain.limitations) ? chain.limitations : [],
        chain.summaryFact ? [chain.summaryFact] : []
      );
      kids.push(React.createElement('div', { key: 'chain', className: 'ty-chain' },
        React.createElement('button', { type: 'button', className: 'focus-btn', onClick: function () { setChainOpen(!chainOpen); } },
          chainOpen ? A.chain_less : A.chain_more),
        chainOpen ? chainLines.map(function (ln, i) {
          return React.createElement('div', { key: i, className: 'tc-line' }, ln);
        }) : null));
    }
    kids.push(React.createElement('div', { key: 'free', className: 'alm-free' },
      React.createElement('div', { className: 'af-title' }, A.free_reading_title),
      React.createElement('div', { className: 'af-txt' }, freeTxt)));
    kids.push(React.createElement(MLTermPanel, { key: 'tcpanel', method: 'taiyi' }));
    // REQ-134：付费操作区独立分层（按钮全宽一行 + 说明独立块，不再并排挤压）
    kids.push(React.createElement('div', { key: 'payzone', className: 'op-zone' },
      React.createElement('button', {
        className: 'btn btn-outline',
        disabled: interpLoading,
        onClick: interpret
      }, interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)]),
      React.createElement('div', { key: 'payhint', className: 'pay-hint' }, A.pay_hint)));
    if (interpErr) kids.push(React.createElement('div', { key: 'interr', className: 'error', style: { marginTop: 10 } }, interpErr));
    if (interp) kids.push(React.createElement(React.Fragment, { key: 'interp' },
      React.createElement('div', { className: 'interp-title' }, A.interp_title),
      React.createElement('div', { className: 'interp-body' }, interp)));
    kids.push(React.createElement('div', { key: 'disc', className: 'alm-disc' }, A.disclaimer));
    body = React.createElement('div', null, kids);
  }
  const formCard = React.createElement('div', { className: 'card' },
    React.createElement('div', { className: 'section-title' }, '太乙信息'),
    React.createElement('div', { className: 'ask-cap' }, A.scope_label, React.createElement('em', null, '*')),
    React.createElement('div', { className: 'ty-scopes' }, TAIYI_SCOPES.map(function (s) {
      return React.createElement('button', {
        key: s.key,
        type: 'button',
        className: 'ty-scope-chip' + (scope === s.key ? ' sel' : ''),
        onClick: function () { setScope(s.key); }
      }, s.label);
    })),
    React.createElement('div', { className: 'ty-scope-hint' }, (TAIYI_SCOPES.find(function (s) { return s.key === scope; }) || {}).hint || ''),
    scope === 'year'
      ? React.createElement('div', { key: 'yr', style: { marginTop: 12 } },
          React.createElement('div', { className: 'ask-cap' }, A.year_label, React.createElement('em', null, '*')),
          React.createElement('input', {
            className: 'dt-input',
            type: 'number',
            min: 1,
            max: 9999,
            step: 1,
            inputMode: 'numeric',
            placeholder: A.year_ph,
            value: year,
            onChange: function (e) { setYear(e.target.value); }
          }))
      : React.createElement('div', { key: 'dt', style: { marginTop: 12 } },
          React.createElement('div', { className: 'ask-cap' }, A.time_label, React.createElement('em', null, '*')),
          React.createElement('div', { className: 'dt-row' },
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, A.date_label, React.createElement('em', null, '*')),
              React.createElement('input', {
                type: 'date',
                className: 'dt-input',
                value: timeDate,
                onChange: function (e) { setTimeDate(e.target.value); }
              })),
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, A.shichen_label, React.createElement('em', null, '*')),
              React.createElement('select', {
                className: 'dt-input',
                value: shichen,
                onChange: function (e) { setShichen(Number(e.target.value)); }
              }, SHICHEN_ARR.map(function (s, i) {
                return React.createElement('option', { key: i, value: i }, s.n + '时（' + s.range + '）');
              }))))),
    // REQ-134：起算按钮与说明独立分层（不再 flex 并排挤压）
    React.createElement('div', { className: 'op-run' },
      React.createElement('button', { className: 'btn btn-primary', type: 'button', disabled: loading, onClick: run },
        loading ? A.running : A.run),
      React.createElement('span', { className: 'op-run-note' }, '确定性计算、零 LLM、免费；深度解读为可选付费（按实际用量扣余额）。')));
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'taiyi', size: 22 }), ' ' + A.title),
    React.createElement('div', { className: 'hub-sub' }, A.sub),
    !token ? React.createElement('div', { className: 'card' },
      React.createElement('p', { style: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 } }, A.login_hint),
      React.createElement('button', { className: 'btn btn-primary', onClick: function () { onNavigate('auth'); } }, A.login_btn)) : React.createElement(React.Fragment, null,
      formCard,
      body,
      React.createElement('div', { className: 'back-row fill' },
        React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('guoxue-hub'); } }, UI_COPY.buttons.back_options))));
}

/* ---------- REQ-125：皇极经世（免档案纯国学大势工具：免费确定性起算 + 可选付费深度解读） ---------- */
// 模式 2 选 1（对齐 vendored mingyu-core HuangjiJingshiInput：year 值年模式传公元年份；
// datetime 年月日时模式传 日期+时辰 组装的东八区 ISO customDate，引擎契约见 server.mjs）
const HUANGJI_MODES = [{
  key: 'year',
  label: '值年卦 · 元会运世',
  hint: '以公元年份排元会运世周期与值年卦（统卦/运卦/十年卦）'
}, {
  key: 'datetime',
  label: '年月日时卦',
  hint: '以日期+时辰排值年/月经/旬纬/日卦/时经卦五层'
}];
const HUANGJI_CYCLE_LAYERS = [{ key: 'yuan', label: '元' }, { key: 'hui', label: '会' }, { key: 'yun', label: '运' }, { key: 'shi', label: '世' }];
function hjGuaCard(layerLabel, g, extraCls) {
  // 皇极经世卦卡：层名 + 卦名 + 卦符 + 上下卦 + 卦辞 + 变卦来源/年份区间
  if (!g || typeof g !== 'object') {
    return React.createElement('div', { key: layerLabel, className: 'hj-gua-card' },
      React.createElement('div', { className: 'hg-layer' }, layerLabel), '—');
  }
  const derive = [];
  if (g.derivedFrom) {
    if (g.changedLine != null) derive.push('由' + g.derivedFrom + '第' + g.changedLine + '爻变');
    else if (g.sequenceOffset != null) derive.push('由' + g.derivedFrom + '顺行' + g.sequenceOffset + '位');
    else derive.push('承' + g.derivedFrom);
  }
  if (g.startYear != null && g.endYear != null) derive.push(g.startYear + '–' + g.endYear + '（' + (g.durationYears != null ? g.durationYears + '年' : '') + '）');
  if (g.changedLineText) derive.push('变爻辞：' + g.changedLineText);
  if (g.year != null && g.ganzhi) derive.push(g.year + '年 ' + g.ganzhi);
  const upperLower = [g.upper, g.lower].filter(Boolean).join(' · ');
  const guaDesc = upperLower + (g.judgment ? (upperLower ? '｜' : '') + g.judgment : '');
  return React.createElement('div', { className: 'hj-gua-card' + (extraCls ? ' ' + extraCls : '') },
    React.createElement('div', { className: 'hg-layer' }, layerLabel),
    React.createElement('div', { className: 'hg-name' }, g.name || g.shortName || '—'),
    g.symbol ? React.createElement('div', { className: 'hg-sym' }, g.symbol) : null,
    guaDesc ? React.createElement('div', { className: 'hg-judge' }, guaDesc) : null,
    derive.length ? React.createElement('div', { className: 'hg-derive' }, derive.join('；')) : null);
}
function HuangjiPage({
  onNavigate
}) {
  const payEnough = usePaySufficient();
  const A = UI_COPY.huangji;
  const [mode, setMode] = useState('year');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [timeDate, setTimeDate] = useState(todayStr());
  const [shichen, setShichen] = useState(nowShichen());
  const [data, setData] = useState(null); // {id, method, result}
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  const [chainOpen, setChainOpen] = useState(false); // 推演链折叠态
  const modeValid = function () {
    if (mode === 'year') {
      const y = Number(year);
      if (!/^-?\d{1,6}$/.test(String(year).trim()) || !Number.isInteger(y) || y === 0 || y < -67017 || y > 9999) {
        toast(ML_COPY.ui.toast['guoxue-huangji-year-range']);
        return false;
      }
    } else {
      if (typeof timeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(timeDate)) {
        toast(ML_COPY.ui.toast['guoxue-date-required']);
        return false;
      }
      if (!(typeof shichen === 'number' && shichen >= 0 && shichen < SHICHEN_ARR.length)) {
        toast(ML_COPY.ui.toast['guoxue-shichen-required']);
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
    if (!modeValid()) return;
    const seed = { huangji: { mode: mode } };
    if (mode === 'year') {
      seed.huangji.year = Number(year);
    } else {
      const startH = (SHICHEN_ARR[shichen] || SHICHEN_ARR[0]).start;
      seed.huangji.customDate = timeDate + 'T' + pad2(startH) + ':00:00+08:00';
    }
    setLoading(true);
    setErrored('');
    setData(null);
    setInterp('');
    setInterpErr('');
    setChainOpen(false);
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: 'huangji', case_id: null, seed: seed })
      });
      const d = (res && res.data) || res;
      setData(d);
      track('huangji_cast', { mode: mode });
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
      track('huangji_interpret', {});
    } catch (e) {
      setInterpErr((e && e.message) || '深度解读失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  const result = (data && data.result) || null;
  const chain = (result && result.evidenceChain) || null;
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
    const kids = [];
    const dtf = (result.dateTimeForecast && typeof result.dateTimeForecast === 'object') ? result.dateTimeForecast : null;
    const hex = dtf ? dtf.hexagrams : ((result.forecast && result.forecast.hexagrams) || null);
    const annual = (hex && (hex.annual || hex.hexagram)) || null;
    // 顶部 hero：值年卦 / 民用时间
    if (dtf) {
      const civ = dtf.civilTime || {};
      const cal = dtf.calendar || {};
      kids.push(React.createElement('div', { key: 'hero', className: 'hj-hero' },
        React.createElement('div', { className: 'hh-cap' }, '年月日时起盘 · ' + (civ.dateTime || '—')),
        React.createElement('div', { className: 'hh-txt' },
          '值年卦 ' + ((annual && annual.name) || '—'),
          React.createElement('small', null, (annual && annual.ganzhi) ? (annual.year + ' ' + annual.ganzhi) : ''))));
      kids.push(React.createElement('div', { key: 'cal', className: 'card', style: { marginTop: 10 } },
        React.createElement('div', { className: 'section-title' }, A.cal_title),
        React.createElement('div', { className: 'alm-day-meta' },
          React.createElement('b', null, '节气'), (cal.activeSolarTerm || '—') + ' 后第 ' + (cal.actualDayInSolarTerm != null ? cal.actualDayInSolarTerm : '—') + ' 日', ' · ',
          React.createElement('b', null, '皇极月'), '第 ' + (cal.monthIndex != null ? cal.monthIndex : '—') + ' 月（' + (cal.monthBranch || '—') + '月）', ' · ',
          React.createElement('b', null, '日序'), '月内第 ' + (cal.dayOfMonth != null ? cal.dayOfMonth : '—') + ' 日 / 年内第 ' + (cal.dayOfYear != null ? cal.dayOfYear : '—') + ' 日', ' · ',
          React.createElement('b', null, '时段'), (cal.hourRange || '—') + '（第 ' + (cal.hourSegment != null ? cal.hourSegment : '—') + ' 段）')));
    } else {
      const f = result.forecast || {};
      kids.push(React.createElement('div', { key: 'hero', className: 'hj-hero' },
        React.createElement('div', { className: 'hh-cap' }, '值年卦 · ' + ((result.input && result.input.calendar) || '通行公元年')),
        React.createElement('div', { className: 'hh-txt' },
          (annual && annual.name) || '—',
          React.createElement('small', null, (result.input && result.input.year != null) ? ((result.input.year > 0 ? '公元 ' : '公元前 ') + Math.abs(result.input.year)) + ' 年' : ''))));
    }
    // 元会运世周期定位（两种模式都有）
    const pos = (result.position && typeof result.position === 'object') ? result.position : null;
    if (pos) {
      const cycleCells = HUANGJI_CYCLE_LAYERS.map(function (ly) {
        const r = pos[ly.key];
        return React.createElement('div', { key: ly.key, className: 'hj-cycle-cell' },
          React.createElement('div', { className: 'hc-name' }, ly.label),
          React.createElement('div', { className: 'hc-range' }, (r && r.startYear != null && r.endYear != null) ? (r.startYear + ' – ' + r.endYear) : '—'),
          React.createElement('div', { className: 'hc-idx' }, (r && r.indexInYuan != null) ? ('本元第 ' + r.indexInYuan + (ly.key === 'hui' && r.branch ? '（' + r.branch + '会）' : '') + ' · ' + (ly.key === 'yun' && r.indexInHui != null ? '会内第 ' + r.indexInHui : '') + (ly.key === 'shi' && r.indexInYun != null ? '运内第 ' + r.indexInYun : '')) : ''));
      });
      if (pos.year && typeof pos.year === 'object') {
        cycleCells.push(React.createElement('div', { key: 'yr', className: 'hj-cycle-cell' },
          React.createElement('div', { className: 'hc-name' }, A.cycle_year),
          React.createElement('div', { className: 'hc-range' }, pos.year.coordinate != null ? pos.year.coordinate : '—'),
          React.createElement('div', { className: 'hc-idx' }, (pos.year.indexInShi != null ? '本世第 ' + pos.year.indexInShi + ' 年' : '') + (pos.year.indexInYuan != null ? ' · 本元第 ' + pos.year.indexInYuan + ' 年' : ''))));
      }
      kids.push(React.createElement('div', { key: 'cycle', className: 'card', style: { marginTop: 10 } },
        React.createElement('div', { className: 'section-title' }, A.cycle_title),
        React.createElement('div', { className: 'hj-cycle' }, cycleCells),
        React.createElement(MLTermRow, { key: 'tc-cycle', method: 'huangji', items: [A.cycle_yuan, A.cycle_hui, A.cycle_yun, A.cycle_shi, A.layer_annual, A.layer_yun, A.title] })));
    }
    // 卦变层级
    if (hex && typeof hex === 'object') {
      const guaKids = [];
      if (dtf) {
        const layers = [
          { label: A.layer_annual, g: hex.annual, cls: 'annual' },
          { label: A.layer_month, g: hex.monthJing, cls: '' },
          { label: A.layer_xun, g: hex.xunWei, cls: '' },
          { label: A.layer_daily, g: hex.daily, cls: '' },
          { label: A.layer_hour, g: hex.hourJing, cls: '' }
        ];
        layers.forEach(function (l) { guaKids.push(hjGuaCard(l.label, l.g, l.cls)); });
      } else {
        const layers = [
          { label: A.layer_governing, g: hex.governing && hex.governing.hexagram, cls: '' },
          { label: A.layer_yun, g: hex.yun && hex.yun.hexagram, cls: '' },
          { label: A.layer_sixty, g: hex.sixtyYear && hex.sixtyYear.hexagram, cls: '' },
          { label: A.layer_decade, g: hex.decade && hex.decade.hexagram, cls: '' },
          { label: A.layer_annual, g: hex.annual, cls: 'annual' }
        ];
        layers.forEach(function (l) { guaKids.push(hjGuaCard(l.label, l.g, l.cls)); });
        const rel = (result.forecast && result.forecast.relatedHexagrams) || null;
        if (rel && typeof rel === 'object') {
          guaKids.push(hjGuaCard(A.layer_related.split(' / ')[0], rel.mutual, ''));
          guaKids.push(hjGuaCard(A.layer_related.split(' / ')[1], rel.opposite, ''));
          guaKids.push(hjGuaCard(A.layer_related.split(' / ')[2], rel.reversed, ''));
        }
      }
      kids.push(React.createElement('div', { key: 'gua', className: 'card', style: { marginTop: 10 } },
        React.createElement('div', { className: 'section-title' }, A.gua_title),
        React.createElement('div', { className: 'hj-gua-grid' }, guaKids)));
    }
    // 世运消息（year 模式）
    if (result.eraTrend && typeof result.eraTrend === 'object') {
      kids.push(React.createElement('div', { key: 'era', className: 'hj-era' },
        React.createElement('div', { className: 'he-cap' }, A.era_title + ' · ' + (result.eraTrend.phase || '')),
        React.createElement('div', { className: 'he-txt' }, result.eraTrend.summary || result.eraTrend.trendNature || '')));
    }
    // 值年卦读法（year 模式，引擎已算好）
    const rd = (result.forecast && result.forecast.reading) || null;
    if (rd && typeof rd === 'object') {
      const rdLines = [rd.headline, rd.cycleContext, rd.annualFocus].filter(Boolean);
      if (Array.isArray(rd.interpretationOrder)) rdLines.push('解读顺序：' + rd.interpretationOrder.join(' → '));
      kids.push(React.createElement('div', { key: 'reading', className: 'ty-chain' },
        React.createElement('div', { className: 'tc-cap' }, A.reading_title),
        rdLines.map(function (ln, i) {
          return React.createElement('div', { key: i, className: 'tc-line' }, ln);
        })));
    }
    // 推演链
    if (chain) {
      const chainLines = [].concat(
        Array.isArray(chain.calculationChain) ? chain.calculationChain : [],
        Array.isArray(chain.limitations) ? chain.limitations : []
      );
      kids.push(React.createElement('div', { key: 'chain', className: 'ty-chain' },
        React.createElement('button', { type: 'button', className: 'focus-btn', onClick: function () { setChainOpen(!chainOpen); } },
          chainOpen ? A.chain_less : A.chain_more),
        chainOpen ? chainLines.map(function (ln, i) {
          return React.createElement('div', { key: i, className: 'tc-line' }, ln);
        }) : null));
    }
    // 趋势参考（免费）
    let freeTxt;
    if (dtf) {
      freeTxt = A.free_reading_dt
        .replace('{dateTime}', (dtf.civilTime && dtf.civilTime.dateTime) || '—')
        .replace('{annual}', ((dtf.hexagrams.annual && dtf.hexagrams.annual.shortName) || '—'))
        .replace('{monthJing}', ((dtf.hexagrams.monthJing && dtf.hexagrams.monthJing.shortName) || '—'))
        .replace('{xunWei}', ((dtf.hexagrams.xunWei && dtf.hexagrams.xunWei.shortName) || '—'))
        .replace('{daily}', ((dtf.hexagrams.daily && dtf.hexagrams.daily.shortName) || '—'))
        .replace('{hourJing}', ((dtf.hexagrams.hourJing && dtf.hexagrams.hourJing.shortName) || '—'));
    } else {
      const y = (result.input && result.input.year != null) ? result.input.year : '';
      const posH = (result.position && result.position.hui) || {};
      const posY2 = (result.position && result.position.yun) || {};
      const posS = (result.position && result.position.shi) || {};
      freeTxt = A.free_reading_year
        .replace('{year}', y)
        .replace('{annual}', ((result.forecast && result.forecast.hexagrams && result.forecast.hexagrams.annual && result.forecast.hexagrams.annual.shortName) || '—'))
        .replace('{ganzhi}', ((result.forecast && result.forecast.hexagrams && result.forecast.hexagrams.annual && result.forecast.hexagrams.annual.ganzhi) || '—'))
        .replace('{hui}', posH.branch || (posH.indexInYuan != null ? posH.indexInYuan : '—'))
        .replace('{yun}', posY2.indexInYuan != null ? posY2.indexInYuan : '—')
        .replace('{shi}', posS.indexInYun != null ? posS.indexInYun : '—');
    }
    kids.push(React.createElement('div', { key: 'free', className: 'alm-free' },
      React.createElement('div', { className: 'af-title' }, A.free_reading_title),
      React.createElement('div', { className: 'af-txt' }, freeTxt)));
    kids.push(React.createElement(MLTermPanel, { key: 'tcpanel', method: 'huangji' }));
    // REQ-134：付费操作区独立分层（按钮全宽一行 + 说明独立块，不再并排挤压）
    kids.push(React.createElement('div', { key: 'payzone', className: 'op-zone' },
      React.createElement('button', {
        className: 'btn btn-outline',
        disabled: interpLoading,
        onClick: interpret
      }, interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)]),
      React.createElement('div', { key: 'payhint', className: 'pay-hint' }, A.pay_hint)));
    if (interpErr) kids.push(React.createElement('div', { key: 'interr', className: 'error', style: { marginTop: 10 } }, interpErr));
    if (interp) kids.push(React.createElement(React.Fragment, { key: 'interp' },
      React.createElement('div', { className: 'interp-title' }, A.interp_title),
      React.createElement('div', { className: 'interp-body' }, interp)));
    kids.push(React.createElement('div', { key: 'disc', className: 'alm-disc' }, A.disclaimer));
    body = React.createElement('div', null, kids);
  }
  const formCard = React.createElement('div', { className: 'card' },
    React.createElement('div', { className: 'section-title' }, '皇极信息'),
    React.createElement('div', { className: 'ask-cap' }, A.mode_label, React.createElement('em', null, '*')),
    React.createElement('div', { className: 'hj-modes' }, HUANGJI_MODES.map(function (m) {
      return React.createElement('button', {
        key: m.key,
        type: 'button',
        className: 'hj-mode-chip' + (mode === m.key ? ' sel' : ''),
        onClick: function () { setMode(m.key); }
      }, m.label);
    })),
    React.createElement('div', { className: 'ty-scope-hint' }, (HUANGJI_MODES.find(function (m) { return m.key === mode; }) || {}).hint || ''),
    mode === 'year'
      ? React.createElement('div', { key: 'yr', style: { marginTop: 12 } },
          React.createElement('div', { className: 'ask-cap' }, A.year_label, React.createElement('em', null, '*')),
          React.createElement('input', {
            className: 'dt-input',
            type: 'number',
            step: 1,
            inputMode: 'numeric',
            placeholder: A.year_ph,
            value: year,
            onChange: function (e) { setYear(e.target.value); }
          }))
      : React.createElement('div', { key: 'dt', style: { marginTop: 12 } },
          React.createElement('div', { className: 'ask-cap' }, A.time_label, React.createElement('em', null, '*')),
          React.createElement('div', { className: 'dt-row' },
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, A.date_label, React.createElement('em', null, '*')),
              React.createElement('input', {
                type: 'date',
                className: 'dt-input',
                value: timeDate,
                onChange: function (e) { setTimeDate(e.target.value); }
              })),
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, A.shichen_label, React.createElement('em', null, '*')),
              React.createElement('select', {
                className: 'dt-input',
                value: shichen,
                onChange: function (e) { setShichen(Number(e.target.value)); }
              }, SHICHEN_ARR.map(function (s, i) {
                return React.createElement('option', { key: i, value: i }, s.n + '时（' + s.range + '）');
              }))))),
    // REQ-134：起算按钮与说明独立分层（不再 flex 并排挤压）
    React.createElement('div', { className: 'op-run' },
      React.createElement('button', { className: 'btn btn-primary', type: 'button', disabled: loading, onClick: run },
        loading ? A.running : A.run),
      React.createElement('span', { className: 'op-run-note' }, '确定性计算、零 LLM、免费；深度解读为可选付费（按实际用量扣余额）。')));
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' }, React.createElement(Icon, { name: 'huangji', size: 22 }), ' ' + A.title),
    React.createElement('div', { className: 'hub-sub' }, A.sub),
    !token ? React.createElement('div', { className: 'card' },
      React.createElement('p', { style: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 } }, A.login_hint),
      React.createElement('button', { className: 'btn btn-primary', onClick: function () { onNavigate('auth'); } }, A.login_btn)) : React.createElement(React.Fragment, null,
      formCard,
      body,
      React.createElement('div', { className: 'back-row fill' },
        React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('guoxue-hub'); } }, UI_COPY.buttons.back_options))));
}