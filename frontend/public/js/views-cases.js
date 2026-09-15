// 档案域视图（节110 阶段3）：档案列表 CasesPage + 建档弹窗 RenameModal/CaseContactModal/ShareFillModal + 解读流程 WaitingPage/CalibrationPage/PredictPage/RevisePage/TopicPage + 档案详情 ArchivePage + 命盘渲染（八字/紫微/西占/七政/奇门/五运六气 各 Plate + ChartView Tab 容器 + EmptyNote + 盘面工具 arr/val/joinArr）+ 分享帮填 CaseSharePage
// 加载于 views-zodiac.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

// ===== 完整盘面组件（直接消费 archive 的 data.chart.data，零 LLM） =====
const arr = x => Array.isArray(x) ? x : [];
const val = (x, d = '') => x == null ? d : x;
const joinArr = (x, sep = '、') => {
  if (Array.isArray(x)) return x.filter(v => v != null && v !== '').join(sep);
  return x == null || x === '' ? '' : String(x);
};
function EmptyNote({
  deg,
  name
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty-note"
  }, name, UI_COPY.chartLabels.colon, deg ? UI_COPY.chartLabels['not-ranked'] : UI_COPY.chartLabels['no-data']);
}

// —— 八字盘（最核心）——
function FourPillars({
  pillars
}) {
  if (!pillars) return /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, UI_COPY.chartLabels['bazi-missing']);
  const cols = [[UI_COPY.chartLabels['pillar-year'], pillars.year], [UI_COPY.chartLabels['pillar-month'], pillars.month], [UI_COPY.chartLabels['pillar-day'], pillars.day], [UI_COPY.chartLabels['pillar-hour'], pillars.hour]];
  const rowDefs = [{
    label: UI_COPY.chartLabels['heaven-stem'],
    get: p => p && p.gan
  }, {
    label: UI_COPY.chartLabels['earth-branch'],
    get: p => p && p.zhi
  }, {
    label: UI_COPY.chartLabels['stem-wuxing'],
    get: p => p && p.gan_wuxing
  }, {
    label: UI_COPY.chartLabels['branch-wuxing'],
    get: p => p && p.zhi_wuxing
  }, {
    label: UI_COPY.chartLabels['ten-god-stem'],
    get: p => p && p.shishen_gan
  }, {
    label: UI_COPY.chartLabels['ten-god-branch'],
    get: p => joinArr(p && p.shishen_zhi)
  }, {
    label: UI_COPY.chartLabels['hidden-stem'],
    get: p => joinArr(p && p.hide_gan && p.hide_gan.map(h => h.gan + '(' + h.shishen + ')'))
  }, {
    label: UI_COPY.chartLabels.nayin,
    get: p => p && p.nayin
  }, {
    label: UI_COPY.chartLabels['twelve-longevity'],
    get: p => p && p.dish
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "four-pillars"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fp-cell fp-rowhead"
  }), cols.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: 'h' + i,
    className: 'fp-cell fp-head' + (i === 2 ? ' fp-day' : '')
  }, c[0])), rowDefs.map((r, ri) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: 'r' + ri
  }, /*#__PURE__*/React.createElement("div", {
    className: "fp-cell fp-rowhead"
  }, r.label), cols.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: 'c' + i,
    className: 'fp-cell' + (i === 2 ? ' fp-day' : '')
  }, val(r.get(c[1])))))));
}
function ShenshaTags({
  list
}) {
  const items = arr(list);
  if (!items.length) return null;
  const cls = s => {
    const c = s && s.category || '';
    if (/贵人|吉/.test(c)) return 'green';
    if (/煞|凶|亡|空|破|灾/.test(c)) return 'red';
    return 'gold';
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "shensha-tags"
  }, items.map((s, i) => {
    const pillars = joinArr(s.pillars);
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      className: 'shensha-tag ' + cls(s),
      title: (s.note || '') + (pillars ? UI_COPY.chartLabels['luo-prefix'] + pillars : '')
    }, s.name, pillars ? '·' + pillars : '');
  }));
}
function DaYun({
  qiYun,
  daYun
}) {
  const list = arr(daYun);
  if (!list.length) return null;
  const q = qiYun || {};
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, UI_COPY.chartLabels['qi-yun'], /*#__PURE__*/React.createElement("b", null, q.forward ? UI_COPY.chartLabels.forward : UI_COPY.chartLabels.backward), " · ", val(q.start, UI_COPY.chartLabels.dash), " · ", /*#__PURE__*/React.createElement("b", null, val(q.start_age, '?')), UI_COPY.chartLabels['age-suffix'] + "起运"), /*#__PURE__*/React.createElement("table", {
    className: "mini-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['dayun-step']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['dayun-ganzhi']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['dayun-year-range']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['dayun-age-range']))), /*#__PURE__*/React.createElement("tbody", null, list.map(dy => /*#__PURE__*/React.createElement("tr", {
    key: dy.index
  }, /*#__PURE__*/React.createElement("td", null, dy.index), /*#__PURE__*/React.createElement("td", null, dy.ganzhi), /*#__PURE__*/React.createElement("td", null, dy.start_year, "–", dy.end_year), /*#__PURE__*/React.createElement("td", null, dy.age_start, "–", dy.age_end + UI_COPY.chartLabels['age-suffix']))))));
}
function Timeline({
  timeline
}) {
  const items = arr(timeline);
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "timeline"
  }, items.map((t, i) => /*#__PURE__*/React.createElement("div", {
    className: "tl-item",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl-year"
  }, t.year + UI_COPY.chartLabels['year-suffix'], /*#__PURE__*/React.createElement("span", {
    className: "tl-age"
  }, t.age + UI_COPY.chartLabels['age-suffix'])), /*#__PURE__*/React.createElement("div", {
    className: "tl-ganzhi"
  }, t.liu_nian_ganzhi, /*#__PURE__*/React.createElement("span", {
    className: "tl-dy"
  }, UI_COPY.chartLabels['dayun-prefix'] + t.da_yun_ganzhi)), /*#__PURE__*/React.createElement("div", {
    className: "tl-events"
  }, arr(t.events).map((e, j) => /*#__PURE__*/React.createElement("span", {
    className: "tl-ev",
    key: j
  }, e.desc))))));
}
function BaziPlate({
  d
}) {
  const bazi = d.bazi || {};
  const cal = d.calendar || {};
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "daymaster"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dm"
  }, UI_COPY.chartLabels['day-master'] + val(bazi.day_master, UI_COPY.chartLabels.dash)), /*#__PURE__*/React.createElement("span", {
    className: "dm-wx"
  }, val(bazi.day_master_wuxing, '')), cal.lunar && /*#__PURE__*/React.createElement("span", {
    className: "dm-wx"
  }, "· ", cal.lunar)), /*#__PURE__*/React.createElement(FourPillars, {
    pillars: bazi.pillars
  }), /*#__PURE__*/React.createElement("div", {
    className: "aux-line",
    style: {
      marginTop: 10
    }
  }, UI_COPY.chartLabels['ming-gong'] + " " + val(bazi.ming_gong), " · " + UI_COPY.chartLabels['shen-gong'] + " " + val(bazi.shen_gong), " · " + UI_COPY.chartLabels['tai-yuan'] + " " + val(bazi.tai_yuan), " · " + UI_COPY.chartLabels['xun-kong'] + " " + joinArr(bazi.xun_kong)), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels.shensha), /*#__PURE__*/React.createElement(ShenshaTags, {
    list: bazi.shensha
  }), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['da-yun']), /*#__PURE__*/React.createElement(DaYun, {
    qiYun: bazi.qi_yun,
    daYun: bazi.da_yun
  }), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['liu-nian']), /*#__PURE__*/React.createElement(Timeline, {
    timeline: d.timeline_20y
  }));
}

// —— 紫微盘 ——
function ZiweiWheel({
  palaces,
  soulPalace,
  bodyPalace
}) {
  const cx = 130,
    cy = 130,
    R = 108;
  const items = arr(palaces);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 260 260",
    className: "ziwei-wheel"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: R,
    className: "zw-ring"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: R * 0.52,
    className: "zw-ring-inner"
  }), items.map((p, i) => {
    const ang = i / 12 * 2 * Math.PI - Math.PI / 2;
    const x = cx + R * Math.cos(ang);
    const y = cy + R * Math.sin(ang);
    return /*#__PURE__*/React.createElement("text", {
      key: i,
      x: x,
      y: y,
      className: "zw-label",
      textAnchor: "middle",
      dominantBaseline: "middle"
    }, p.name);
  }), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy - 8,
    textAnchor: "middle",
    className: "zw-center"
  }, UI_COPY.chartLabels['ming-gong'] + " " + val(soulPalace)), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 12,
    textAnchor: "middle",
    className: "zw-center2"
  }, "身宫 ", val(bodyPalace)));
}
function ZiweiPlate({
  d,
  deg
}) {
  const z = d.ziwei || {};
  if (!z.palaces) return /*#__PURE__*/React.createElement(EmptyNote, {
    deg: deg,
    name: UI_COPY.chartLabels['ziwei-name']
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, UI_COPY.chartLabels['five-elements-bureau'] + " ", /*#__PURE__*/React.createElement("b", null, val(z.five_elements_class)), UI_COPY.chartLabels['lunar-prefix'] + val(z.lunar_date), " · " + UI_COPY.chartLabels['ming-gong'] + " ", /*#__PURE__*/React.createElement("b", null, val(z.soul_palace)), " / " + UI_COPY.chartLabels['shen-gong'] + " ", /*#__PURE__*/React.createElement("b", null, val(z.body_palace)), " · 命主 ", val(z.soul), " / 身主 ", val(z.body)), /*#__PURE__*/React.createElement("div", {
    className: "ziwei-wrap"
  }, /*#__PURE__*/React.createElement(ZiweiWheel, {
    palaces: z.palaces,
    soulPalace: z.soul_palace,
    bodyPalace: z.body_palace
  }), /*#__PURE__*/React.createElement("div", {
    className: "palace-grid"
  }, arr(z.palaces).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'palace-card' + (p.is_body_palace ? ' body' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-name"
  }, p.name, p.is_body_palace && /*#__PURE__*/React.createElement("span", {
    className: "pc-badge"
  }, UI_COPY.chartLabels['shen-gong'])), /*#__PURE__*/React.createElement("div", {
    className: "pc-stem"
  }, val(p.heavenly_stem), val(p.earthly_branch)), /*#__PURE__*/React.createElement("div", {
    className: "pc-stars"
  }, arr(p.major_stars).map((s, j) => /*#__PURE__*/React.createElement("span", {
    className: "pc-major",
    key: j
  }, s))), arr(p.minor_stars).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pc-stars sm"
  }, joinArr(p.minor_stars)), arr(p.adjective_stars).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pc-stars adj"
  }, joinArr(p.adjective_stars)), arr(p.sihua).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pc-sihua"
  }, joinArr(p.sihua)))))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['four-hua-table']), /*#__PURE__*/React.createElement("table", {
    className: "mini-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['sihua-star']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['sihua-mutagen']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['sihua-palace']))), /*#__PURE__*/React.createElement("tbody", null, arr(z.sihua).map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(s.star)), /*#__PURE__*/React.createElement("td", null, val(s.mutagen)), /*#__PURE__*/React.createElement("td", null, val(s.palace)))))));
}

// —— 占星盘 ——
// 行星/格局/相位中译 · 来自 CONTENT 统一正文数据（节135）
const PLANET_CN = CONTENT.astrology.planetCn;
const PATTERN_CN = CONTENT.astrology.patternCn;
const ASPECT_CN = CONTENT.astrology.aspectCn;
const translateAspect = t => {
  const k = String(t == null ? '' : t).trim().toLowerCase();
  return ASPECT_CN[k] || t;
};
const translatePattern = p => {
  const s = String(p || '');
  const idx = s.indexOf(':');
  const type = idx >= 0 ? s.slice(0, idx).trim() : s;
  const bodies = idx >= 0 ? s.slice(idx + 1) : '';
  const typeCn = PATTERN_CN[type] || type;
  const bodiesCn = bodies.split(',').map(b => PLANET_CN[b.trim()] || b.trim()).filter(Boolean).join('、');
  return bodiesCn ? typeCn + '：' + bodiesCn : typeCn;
};
function WesternSummary({
  s
}) {
  if (!s || typeof s !== 'object') return null;
  const sec = (title, obj) => obj && typeof obj === 'object' && Object.keys(obj).length ? /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, /*#__PURE__*/React.createElement("b", null, title, "："), Object.entries(obj).map(([k, v]) => `${k}(${Array.isArray(v) ? v.join('、') : v})`).join('  ')) : null;
  return /*#__PURE__*/React.createElement("div", null, sec('四元素', s.elements), sec('三方', s.modalities), s.retrograde && s.retrograde.length ? /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, /*#__PURE__*/React.createElement("b", null, UI_COPY.chartLabels['retrograde-label']), s.retrograde.join('、')) : null, s.patterns && s.patterns.length ? /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, /*#__PURE__*/React.createElement("b", null, UI_COPY.chartLabels['patterns-label']), s.patterns.map(translatePattern).join('、')) : null);
}
function WesternPlate({
  d,
  deg
}) {
  const w = d.western || {};
  if (!w.planets) return /*#__PURE__*/React.createElement(EmptyNote, {
    deg: deg,
    name: UI_COPY.chartLabels['astrology-name']
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(WesternSummary, {
    s: w.summary
  }), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['planets-positions']), /*#__PURE__*/React.createElement("table", {
    className: "planet-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-star']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-sign']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-house']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-degree']), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, arr(w.planets).map((p, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(p.label), p.name && p.label !== p.name ? ' (' + p.name + ')' : ''), /*#__PURE__*/React.createElement("td", null, val(p.sign)), /*#__PURE__*/React.createElement("td", null, val(p.house)), /*#__PURE__*/React.createElement("td", null, val(p.formatted)), /*#__PURE__*/React.createElement("td", null, p.retrograde ? /*#__PURE__*/React.createElement("span", {
    className: "retro"
  }, "逆") : ''))))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['four-angles']), /*#__PURE__*/React.createElement("table", {
    className: "planet-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-axis']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-sign']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-degree']))), /*#__PURE__*/React.createElement("tbody", null, arr(w.angles).map((a, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(a.label)), /*#__PURE__*/React.createElement("td", null, val(a.sign)), /*#__PURE__*/React.createElement("td", null, val(a.formatted)))))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels.houses), /*#__PURE__*/React.createElement("table", {
    className: "planet-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-palace']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-sign']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-degree']))), /*#__PURE__*/React.createElement("tbody", null, arr(w.houses).map((h, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(h.label)), /*#__PURE__*/React.createElement("td", null, val(h.sign)), /*#__PURE__*/React.createElement("td", null, val(h.formatted)))))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['major-aspects']), /*#__PURE__*/React.createElement("table", {
    className: "aspect-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-star1']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-star2']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-aspect']), /*#__PURE__*/React.createElement("th", null, UI_COPY.chartLabels['th-closeness']))), /*#__PURE__*/React.createElement("tbody", null, arr(w.aspects).map((a, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(a.body1)), /*#__PURE__*/React.createElement("td", null, val(a.body2)), /*#__PURE__*/React.createElement("td", null, translateAspect(a.type)), /*#__PURE__*/React.createElement("td", null, val(a.closeness)))))));
}

// —— 七政四余 ——
function QizhengPlate({
  d,
  deg
}) {
  const q = d.qizheng || {};
  if (!q.stars) return /*#__PURE__*/React.createElement(EmptyNote, {
    deg: deg,
    name: UI_COPY.chartLabels['qizheng-name']
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, "命宫 ", /*#__PURE__*/React.createElement("b", null, val(q.mingGong)), " · 身宫 ", /*#__PURE__*/React.createElement("b", null, val(q.shenGong)), " · 命主 ", /*#__PURE__*/React.createElement("b", null, val(q.mingZhu))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['xingyao-chanci']), /*#__PURE__*/React.createElement("table", {
    className: "star-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "星"), /*#__PURE__*/React.createElement("th", null, "种类"), /*#__PURE__*/React.createElement("th", null, "宿"), /*#__PURE__*/React.createElement("th", null, "落宫"), /*#__PURE__*/React.createElement("th", null, "庙旺"))), /*#__PURE__*/React.createElement("tbody", null, arr(q.stars).map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, val(s.name)), /*#__PURE__*/React.createElement("td", null, val(s.kind)), /*#__PURE__*/React.createElement("td", null, val(s.xiu)), /*#__PURE__*/React.createElement("td", null, val(s.palace)), /*#__PURE__*/React.createElement("td", null, val(s.dignity)))))), arr(q.twelvePalaces).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['twelve-palaces']), /*#__PURE__*/React.createElement("div", {
    className: "palace-grid"
  }, arr(q.twelvePalaces).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "palace-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-name"
  }, val(p.name || p.palace || '宫' + i)), /*#__PURE__*/React.createElement("div", {
    className: "pc-stars sm"
  }, joinArr([p.stars || p.mainStar, p.notes || p.note].filter(Boolean))))))), arr(q.shensha).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels.shensha), /*#__PURE__*/React.createElement(ShenshaTags, {
    list: q.shensha
  })));
}

// —— 奇门终身局 ——
const GONG_POS = {
  4: [0, 0],
  9: [0, 1],
  2: [0, 2],
  3: [1, 0],
  5: [1, 1],
  7: [1, 2],
  8: [2, 0],
  1: [2, 1],
  6: [2, 2]
};
function QimenPlate({
  d,
  deg
}) {
  const q = d.qimen_lifetime || {};
  const bc = q.baseChart || {};
  if (!bc.jiuGongGe) return /*#__PURE__*/React.createElement(EmptyNote, {
    deg: deg,
    name: UI_COPY.chartLabels['qimen-name']
  });
  const cells = arr(bc.jiuGongGe).slice().sort((a, b) => {
    const pa = GONG_POS[a.gong] || [9, 9],
      pb = GONG_POS[b.gong] || [9, 9];
    return pa[0] - pb[0] || pa[1] - pb[1];
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aux-line"
  }, val(bc.juMethod, '排盘'), " · ", bc.isYangDun ? '阳遁' : '阴遁', " · 局数 ", /*#__PURE__*/React.createElement("b", null, val(bc.juShu)), " · 值符 ", /*#__PURE__*/React.createElement("b", null, val(bc.zhiFu)), " · 值使 ", /*#__PURE__*/React.createElement("b", null, val(bc.zhiShi))), /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['nine-palace-grid']), /*#__PURE__*/React.createElement("div", {
    className: "qimen-grid"
  }, cells.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "qimen-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qc-name"
  }, val(c.name)), /*#__PURE__*/React.createElement("div", {
    className: "qc-meta"
  }, val(c.direction), "·", val(c.element)), /*#__PURE__*/React.createElement("div", {
    className: "qc-lines"
  }, c.tianPan && /*#__PURE__*/React.createElement("div", null, "天盘 ", val(c.tianPan.star), val(c.tianPan.stem)), c.diPan && /*#__PURE__*/React.createElement("div", null, "地盘 ", val(c.diPan.stem)), c.renPan && /*#__PURE__*/React.createElement("div", null, "人盘 ", val(c.renPan.door)), c.shenPan && /*#__PURE__*/React.createElement("div", null, "神盘 ", val(c.shenPan.god)))))), arr(q.stages).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, UI_COPY.chartLabels['fenxian-xingyun']), /*#__PURE__*/React.createElement("table", {
    className: "mini-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "限"), /*#__PURE__*/React.createElement("th", null, "主题"), /*#__PURE__*/React.createElement("th", null, "年龄"), /*#__PURE__*/React.createElement("th", null, "倾向"))), /*#__PURE__*/React.createElement("tbody", null, arr(q.stages).map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, s.stageIndex), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, val(s.title)), /*#__PURE__*/React.createElement("td", null, val(s.ageStart), "–", val(s.ageEnd)), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'left',
      fontSize: 11
    }
  }, val(s.stageTheme))))))));
}

// —— 五运六气 ——
function WuyunPlate({
  d,
  deg
}) {
  const w = d.wuyun_liuqi || {};
  const by = w.birth_year || {};
  const cy = w.current_year || {};
  if (!by.annualMovement && !by.sitian) return /*#__PURE__*/React.createElement(EmptyNote, {
    deg: deg,
    name: UI_COPY.chartLabels['wuyun-liuqi-name']
  });
  const Row = ({
    label,
    v
  }) => /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, val(v, '-')));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "wuyun-compare"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wuyun-col"
  }, /*#__PURE__*/React.createElement("h4", null, "出生年运气（", val(by.input && by.input.yearGanZhi), "）"), /*#__PURE__*/React.createElement(Row, {
    label: "岁运",
    v: by.annualMovement && by.annualMovement.name + ' ' + (by.annualMovement.strength || '')
  }), /*#__PURE__*/React.createElement(Row, {
    label: "司天",
    v: by.sitian && by.sitian.name
  }), /*#__PURE__*/React.createElement(Row, {
    label: "在泉",
    v: by.zaiquan && by.zaiquan.name
  }), /*#__PURE__*/React.createElement(Row, {
    label: "天符关系",
    v: by.annualRelation && by.annualRelation.kind
  }), by.annualConformities && arr(by.annualConformities.names).length > 0 && /*#__PURE__*/React.createElement(Row, {
    label: "同化",
    v: joinArr(by.annualConformities.names)
  })), /*#__PURE__*/React.createElement("div", {
    className: "wuyun-col"
  }, /*#__PURE__*/React.createElement("h4", null, "当前年运气（", val(cy.input && cy.input.yearGanZhi), "）"), /*#__PURE__*/React.createElement(Row, {
    label: "岁运",
    v: cy.annualMovement && cy.annualMovement.name + ' ' + (cy.annualMovement.strength || '')
  }), /*#__PURE__*/React.createElement(Row, {
    label: "司天",
    v: cy.sitian && cy.sitian.name
  }), /*#__PURE__*/React.createElement(Row, {
    label: "在泉",
    v: cy.zaiquan && cy.zaiquan.name
  }), /*#__PURE__*/React.createElement(Row, {
    label: "天符关系",
    v: cy.annualRelation && cy.annualRelation.kind
  }), cy.annualConformities && arr(cy.annualConformities.names).length > 0 && /*#__PURE__*/React.createElement(Row, {
    label: "同化",
    v: joinArr(cy.annualConformities.names)
  }))));
}

// —— 盘面 Tab 容器（默认展开八字盘）——
// REQ-053 L2：档案页已展示 natal 完整盘面（AstroNatalPanel）时 hideWestern=true，
// 「占星盘」tab（charts.western）从完整盘面中隐去 —— 同档案只呈现一份完整占星展示；
// 无 natal（回退 charts.western 归一化展示）时保留该 tab。
function ChartView({
  chartData,
  degraded,
  hideWestern
}) {
  const d = chartData || {};
  const deg = arr(degraded).map(s => s.replace(/-/g, '_'));
  const isDeg = k => deg.includes(k);
  const [tab, setTab] = useState('bazi');
  useEffect(() => {
    if (hideWestern && tab === 'western') setTab('bazi');
  }, [hideWestern, tab]);
  const tabs = [{
    id: 'bazi',
    label: '八字盘'
  }, {
    id: 'ziwei',
    label: '紫微盘'
  }, {
    id: 'western',
    label: '占星盘'
  }, {
    id: 'qizheng',
    label: '七政四余'
  }, {
    id: 'qimen',
    label: '奇门终身局'
  }, {
    id: 'wuyun',
    label: '五运六气'
  }].filter(t => !(hideWestern && t.id === 'western'));
  return /*#__PURE__*/React.createElement("div", {
    className: "card chart-view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, "完整盘面"), deg.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "deg-banner"
  }, "已降级方法：", arr(degraded).join('、'), "（相关盘面数据缺失，对应标签页将提示未排）。"), /*#__PURE__*/React.createElement("div", {
    className: "chart-tabs"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: 'chart-tab' + (tab === t.id ? ' active' : ''),
    onClick: () => setTab(t.id)
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    className: "chart-body"
  }, tab === 'bazi' && /*#__PURE__*/React.createElement(BaziPlate, {
    d: d
  }), tab === 'ziwei' && /*#__PURE__*/React.createElement(ZiweiPlate, {
    d: d,
    deg: isDeg('ziwei')
  }), tab === 'western' && /*#__PURE__*/React.createElement(WesternPlate, {
    d: d,
    deg: isDeg('western')
  }), tab === 'qizheng' && /*#__PURE__*/React.createElement(QizhengPlate, {
    d: d,
    deg: isDeg('qizheng')
  }), tab === 'qimen' && /*#__PURE__*/React.createElement(QimenPlate, {
    d: d,
    deg: isDeg('qimen_lifetime')
  }), tab === 'wuyun' && /*#__PURE__*/React.createElement(WuyunPlate, {
    d: d,
    deg: isDeg('wuyun_liuqi')
  })));
}
function ArchivePage({
  caseId,
  onNavigate
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [caseTitle, setCaseTitle] = useState('未命名档案');
  // REQ-089 v2：联系方式回填 —— case 表字段可能不在 /archive 聚合包内，由 load() 回查后写入
  const [casePhone, setCasePhone] = useState('');
  const [caseEmail, setCaseEmail] = useState('');
  // REQ-114 + BUG-022：「修改信息」改内联编辑（替代弹窗）——editing=true 时建档信息卡
  // 的 档案名称/手机号/邮箱 行直接变为可编辑文本框（预填原信息），保存/取消就地完成，
  // 不再使用弹窗（原弹窗在长页面弹出位置偏下，用户误以为卡死）。
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // REQ-112③：档案内「心理测试」板块最新一次结果「点击查看详情」的展开态
  const [mbtiDetailOpen, setMbtiDetailOpen] = useState(false);
  // REQ-054：删除星盘 / MBTI 历史记录成功后 +1，驱动下方 useEffect 重跑 load() 重新拉取档案
  const [reloadTick, setReloadTick] = useState(0);
  // REQ-040：页头取「当前档案的用户命名」。后端 /archive 聚合包可能不带顶层 name、
  // input_json 亦无 name（case 名只存在 case 表），因此取值链：input.name → payload 顶层
  // name/case_name → 静默回查 GET /cases 列表按 caseId 匹配 → 兜底「未命名档案」。
  const pickName = v => v && typeof v === 'string' && v.trim() ? v.trim() : '';
  useEffect(() => {
    const load = async () => {
      // BUG-015：navigate 的 setPage/setParams 在异步上下文（如 saveCase 的
      // onNavigate('archive', {caseId})）下不合并，本页会先以 caseId=undefined
      // 挂载一次；缺 caseId 时禁止发 /cases/undefined/archive（后端 422），
      // 退出 loading 等真实 caseId 到来重跑本 effect（其余 caseId 页面同款防御）。
      if (!caseId) {
        setLoading(false);
        return;
      }
      // BUG-015：新一轮加载先清旧错误 —— 首次 undefined 请求的 422 失败若不清，
      // 真实 caseId 加载成功后本页仍卡在「档案加载失败」错误态，用户误判档案保存失败。
      setErrored('');
      try {
        const res = await api('/cases/' + caseId + '/archive');
        const payload = (res && res.data) || res || {};
        setData(payload);
        const inp0 = payload.input || {};
        let nm = pickName(inp0.name) || pickName(payload.name) || pickName(payload.case_name);
        // REQ-089 v2：联系方式（手机号/邮箱）同样可能不在 /archive 聚合包内 —— 取值链
        // input → payload 顶层 → GET /cases 列表回查；与档案名一样缺则留空（建档信息区显示「—」）。
        let ph = pickName(inp0.phone) || pickName(payload.phone) || pickName(payload.phone_number);
        let em = pickName(inp0.email) || pickName(payload.email);
        if (!nm || !ph || !em) {
          try {
            const lr = await api('/cases', {
              method: 'GET'
            });
            const list = (lr && lr.data && lr.data.cases) || (lr && lr.cases) || [];
            const hit = list.find(x => String(x.caseId) === String(caseId));
            if (hit) {
              if (!nm) nm = pickName(hit.name);
              if (!ph) ph = pickName(hit.phone);
              if (!em) em = pickName(hit.email);
            }
          } catch (e) {/* 回查失败静默，走兜底文案 */}
        }
        setCaseTitle(nm || '未命名档案');
        setCasePhone(ph || '');
        setCaseEmail(em || '');
      } catch (e) {
        setErrored(e.message || '加载档案失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [caseId, reloadTick]);
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title"
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '70%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '50%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '80%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '65%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '55%'
      }
    })));
  }
  if (errored) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "档案加载失败"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate('landing')
    }, UI_COPY.buttons.back_home)));
  }
  const inp = data && data.input || {};
  const statusMap = {
    created: UI_COPY.caseDetail['status-created'],
    paipan_done: UI_COPY.caseDetail['status-paipan'],
    calibrated: UI_COPY.caseDetail['status-calibrated'],
    predicted: UI_COPY.caseDetail['status-predicted']
  };
  // REQ-053 ①②③：完整盘面 chart.data 即后端 chart_json（含八字/紫微/占星/七政/奇门/五运六气）；
  // degraded 为已降级方法列表 —— 干支/农历/生肖等展示需先取到它，故移到此处在 rows 之前。
  const chart = data && data.chart || {};
  const chartData = chart.data || {};
  const degradedList = Array.isArray(chart.degraded) ? chart.degraded : chart.degraded ? [chart.degraded] : [];
  const notEmpty = v => v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : null;
  // —— ① 出生年月日时辰：公历 年/月/日 合并；时辰取 input 的 birth_hour（0-23 小时，
  //    旧档案兼容 hour 字段）折算十二时辰地支名（与 REQ-055 SHICHEN 同规则：23/0 子时）
  const BIRTH_BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const yTxt = notEmpty(inp.birth_year);
  const mTxt = notEmpty(inp.birth_month);
  const dTxt = notEmpty(inp.birth_day);
  const hRaw = inp.birth_hour != null && String(inp.birth_hour).trim() !== '' ? inp.birth_hour : inp.hour != null && String(inp.hour).trim() !== '' ? inp.hour : null;
  const hBranch = hRaw != null && Number.isFinite(Number(hRaw)) ? BIRTH_BRANCH[Math.floor((Number(hRaw) + 1) / 2) % 12] || null : null;
  const birthDT = [yTxt ? yTxt + ' 年' : null, mTxt ? mTxt + ' 月' : null, dTxt ? dTxt + ' 日' : null, hBranch ? hBranch + '时' : null].filter(Boolean).join(' ') || null;
  // —— ① 中式干支传统写法：取 chart.data 八字四柱 ganzhi（年/月/日/时柱；未提供时辰则省略时柱）
  const baziP = chartData.bazi && chartData.bazi.pillars && typeof chartData.bazi.pillars === 'object' ? chartData.bazi.pillars : null;
  const pillarGz = p => p && typeof p === 'object' && ((p.gan || '') + (p.zhi || '')) ? String(p.gan || '') + String(p.zhi || '') : null;
  const ganzhiText = [['year', '年'], ['month', '月'], ['day', '日'], ['hour', '时']].map(([k, suf]) => {
    const g = baziP && pillarGz(baziP[k]);
    return g ? g + suf : null;
  }).filter(Boolean).join(' ') || null;
  // —— ① 农历生日：chart.data.calendar.lunar（如「一九九〇年四月廿六」）
  const lunarText = chartData.calendar && notEmpty(chartData.calendar.lunar);
  // —— ③ 生肖：按公历出生年份（年 % 12 → 鼠牛虎兔龙蛇马羊猴鸡狗猪；简单按公历年，不追农历年界）
  const ZODIAC_CN = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const ySrc = yTxt || notEmpty(chartData.input && chartData.input.year) || (chartData.calendar && typeof chartData.calendar.solar === 'string' ? chartData.calendar.solar.slice(0, 4) : null);
  const zodiacText = (() => {
    const y = Number(ySrc);
    if (!Number.isFinite(y)) return null;
    return ZODIAC_CN[((y - 4) % 12 + 12) % 12] || null;
  })();
  const genderText = inp.gender === 'female' ? UI_COPY.onboarding['gender-female'] : inp.gender === 'male' ? UI_COPY.onboarding['gender-male'] : null;
  // —— ② 出生地坐标：经度/纬度合并单字段（如「经度 116.4°E · 纬度 39.9°N」；缺则「未提供」）
  const fmtDir = (v, posSuf, negSuf) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return String(Math.abs(n)) + '°' + (n >= 0 ? posSuf : negSuf);
  };
  const lngTxt = fmtDir(inp.longitude, 'E', 'W');
  const latTxt = fmtDir(inp.latitude, 'N', 'S');
  const coordText = [lngTxt ? UI_COPY.caseDetail['coord-lng-prefix'] + lngTxt : null, latTxt ? UI_COPY.caseDetail['coord-lat-prefix'] + latTxt : null].filter(Boolean).join(' · ') || UI_COPY.caseDetail['coord-not-provided'];
  // 节149 N3：夏令时校正（1986–1991 官方表）与出生时间不确定项声明（message 由后端单一源下发）
  const calMeta = chartData.meta || {};
  const uncertList = Array.isArray(calMeta.input_uncertainties) ? calMeta.input_uncertainties.filter(u => u && u.message) : [];
  const dstVal = chartData.calendar && typeof chartData.calendar.dst_applied === 'boolean' ? (chartData.calendar.dst_applied ? UI_COPY.caseDetail.yes : UI_COPY.caseDetail.no) : null;
  const rows = [[UI_COPY.caseDetail['row-birth-dt'], birthDT], [UI_COPY.caseDetail['row-ganzhi'], ganzhiText], [UI_COPY.caseDetail['row-lunar'], lunarText], [UI_COPY.caseDetail['row-zodiac'], zodiacText], [UI_COPY.caseDetail['row-gender'], genderText], [UI_COPY.caseDetail['row-birthplace'], notEmpty(inp.birthplace)], [UI_COPY.caseDetail['row-coord'], coordText], [UI_COPY.caseDetail['row-true-solar'], inp.true_solar_time ? UI_COPY.caseDetail.yes : UI_COPY.caseDetail.no], [UI_COPY.caseDetail['row-dst'], dstVal], [UI_COPY.caseDetail.phone_label, casePhone], [UI_COPY.caseDetail.email_label, caseEmail]];

  // 校准记录：record 为反馈条数（可能是数组/数字），fit 为 score_fit 结果对象；
  // 整体契合度若能取到数值则展示，否则只展示反馈条数
  const calib = data && data.calibrations || {};
  const calibCount = Array.isArray(calib.record) ? calib.record.length : typeof calib.record === 'number' ? calib.record : null;
  const probeNum = v => typeof v === 'number' && isFinite(v) ? v : null;
  const calibFit = (() => {
    const f = calib.fit;
    if (f == null) return null;
    if (typeof f === 'number' && isFinite(f)) return f;
    if (probeNum(f.fit) != null) return probeNum(f.fit);
    if (probeNum(f.score) != null) return probeNum(f.score);
    if (probeNum(f.overall) != null) return probeNum(f.overall);
    const inner = f.fit && typeof f.fit === 'object' ? f.fit : null;
    if (inner) {
      const hit = ['fit', 'score', 'value', 'overall', 'accuracy'].map(k => probeNum(inner[k])).find(v => v != null);
      if (hit != null) return hit;
    }
    return null;
  })();
  const calibFitText = calibFit == null ? null : calibFit <= 1 ? Math.round(calibFit * 100) + '%' : String(calibFit);

  // 对话历史：仅最近 10 条
  const convos = data && Array.isArray(data.conversations) ? data.conversations.slice(-10).filter(m => m && m.content) : [];

  // REQ-039 ②③：只读展示「占星盘」已生成记录 与「MBTI 人格」判型结果
  // （build_archive 新增字段，可能为 undefined / 空，空则两卡均不占位渲染）
  const astroRecords = data && Array.isArray(data.astrology) ? data.astrology : [];
  const mbtiInfo = data && data.mbti && typeof data.mbti === 'object' ? data.mbti : null;
  const mbtiRecords = mbtiInfo && Array.isArray(mbtiInfo.results) ? mbtiInfo.results : [];
  const fmtArchiveTime = t => t ? String(t).replace('T', ' ').slice(0, 16) : '';

  // REQ-054：档案内历史记录逐条删除 —— 二次确认后 DELETE 对应记录，成功后 toast + 触发
  // reloadArchive()（reloadTick+1 重跑上方 useEffect 的 load()，astroCard/mbtiCard 由 data
  // 派生自动重渲染；删除主展示记录后其余记录 / 空态亦由派生逻辑判空兜底）。
  const reloadArchive = () => setReloadTick(t => t + 1);
  // REQ-114 + BUG-022：「修改信息」内联编辑 —— 打开（预填原信息）/ 取消 / 提交。
  // 提交 PATCH name+phone+email，成功后重拉档案（页头档案名 + 建档信息手机号/邮箱随之刷新）。
  // 不改动出生等排盘信息。不再使用弹窗（BUG-022：长页面弹窗错位偏下）。
  const openEditInfo = () => {
    setEditName(caseTitle === UI_COPY.caseDetail.unnamed ? '' : caseTitle);
    setEditPhone(casePhone);
    setEditEmail(caseEmail);
    setEditBusy(false);
    setEditing(true);
  };
  const closeEditInfo = () => {
    if (editBusy) return;
    setEditing(false);
    setEditName('');
    setEditPhone('');
    setEditEmail('');
  };
  const submitEditInfo = async () => {
    const name = String(editName || '').trim();
    const phone = String(editPhone || '').trim();
    const email = String(editEmail || '').trim();
    if (phone && !/^\d{11}$/.test(phone)) {
      toast(UI_COPY.caseDetail['phone-err']);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) {
      toast(UI_COPY.caseDetail['email-err']);
      return;
    }
    setEditBusy(true);
    try {
      const res = await api('/cases/' + caseId, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name || UI_COPY.caseDetail.unnamed,
          phone: phone || null,
          email: email || null
        })
      });
      if (res && res.code != null && res.code !== 0) throw new Error(res && res.message || UI_COPY.caseDetail['save-fail']);
      toast(UI_COPY.caseDetail['save-ok']);
      setEditing(false);
      reloadArchive();
    } catch (err) {
      toast(err && err.message || UI_COPY.caseDetail['save-fail-retry']);
    } finally {
      setEditBusy(false);
    }
  };
  const doDeleteRecord = async (e, rec, kind) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const rid = rec && rec.id;
    if (rid == null) {
      toast(UI_COPY.caseDetail['delete-no-id']);
      return;
    }
    const tip = kind === 'astro' ? UI_COPY.caseDetail['delete-confirm-astro'] : UI_COPY.caseDetail['delete-confirm-mbti'];
    if (!window.confirm(tip)) return;
    try {
      const path = kind === 'astro' ? '/astrology/charts/' : '/mbti/results/';
      const res = await api(path + rid, {
        method: 'DELETE'
      });
      // 双信封约定：code:0 视为成功；HTTP 错误已由 api() 抛异常
      if (res && res.code != null && res.code !== 0) throw new Error(res && res.message || UI_COPY.caseDetail['delete-fail']);
      toast(UI_COPY.caseDetail['delete-ok']);
      reloadArchive();
    } catch (err) {
      toast(err && err.message || UI_COPY.caseDetail['delete-fail-retry']);
    }
  };
  const removeAstroRecord = (e, rec) => doDeleteRecord(e, rec, 'astro');

  // REQ-089 v2：占星盘板块 —— 只取「最新一条记录」（created_at 倒序，优先选含完整 natal
  // 盘面的记录），且仅展示盘面（星盘图）；不展示行星落座落宫 / 四轴 / 逆行格局 / 文字说明，
  // 不保留历史列表（删除当前记录后重拉自动展示次新一条）。
  const astroSorted = astroRecords.slice().sort((x, y) => String((y && y.created_at) || '').localeCompare(String((x && x.created_at) || '')));
  const astroMain = astroSorted.find(a => a && a.chart && a.chart.natal) || astroSorted[0] || null;
  const astroNatalNorm = astroMain && astroMain.chart ? astroNorm(astroMain.chart.natal || null) : null;
  // REQ-053 L2：同档案只呈现一份完整占星展示 —— natal 完整盘面可正常渲染（AstroNatalPanel）
  // 时，完整盘面的「占星盘」tab（charts.western）隐去，避免双份重复；无 natal 时该 tab 保留
  // 作 charts.western 归一化兜底。无经纬度建档（western=null 降级）而 natal 已有记录时，
  // natal 为唯一占星来源（AstroNatalPanel），western tab 本就无数据，一并隐藏保持一致。
  const hideWesternTab = (() => {
    if (!astroMain || !astroMain.chart) return false;
    const n = astroNorm(astroMain.chart.natal || null);
    return n.planets.length > 0 || n.angles.length > 0;
  })();
  const astroCard = astroMain && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "section-title",
    style: {
      marginBottom: 0
    }
  }, UI_COPY.caseDetail['astro-card-title']), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      marginTop: 2
    }
  }, astroScopeLabel(astroMain && astroMain.scope), fmtArchiveTime(astroMain && astroMain.created_at) ? UI_COPY.caseDetail['generated-prefix'] + fmtArchiveTime(astroMain && astroMain.created_at) : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-mini",
    onClick: () => onNavigate('astrology', {
      caseId
    })
  }, UI_COPY.caseDetail['view-btn']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-mini",
    onClick: e => removeAstroRecord(e, astroMain)
  }, UI_COPY.caseDetail['delete-btn']))), astroNatalNorm && (astroNatalNorm.planets.length > 0 || astroNatalNorm.angles.length > 0) ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      margin: '4px 0 2px'
    }
  }, /*#__PURE__*/React.createElement(AstroWheel, {
    data: astroNatalNorm
  })) : /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-3)',
      margin: '6px 0 2px'
    }
  }, UI_COPY.caseDetail['data-missing']));

  // REQ-112②③ + REQ-114：档案内「心理测试」板块 —— 只展示并保存「最新一次」判型结果：
  // 以类表格形式展示「MBTI 类型」与「人格类型」（alias）；不再保留历史判型记录、不再显示
  // 「四维倾向（答题计数）」（REQ-114）、不提供单条删除；结果支持点击查看详情（展开该型五栏文案）。
  const R = React.createElement;
  const mbtiType = mbtiInfo && mbtiInfo.mbti_type ? String(mbtiInfo.mbti_type).toUpperCase() : '';
  const mbtiTypeInfo = mbtiInfo && mbtiInfo.type_info && typeof mbtiInfo.type_info === 'object' ? mbtiInfo.type_info : null;
  // created_at 倒序 → 首位为「最新一次判型」；与 case.mbti_type 一致者优先。
  const mbtiSorted = mbtiRecords.slice().sort((x, y) => String((y && y.created_at) || '').localeCompare(String((x && x.created_at) || '')));
  const mbtiMainRes = (mbtiSorted.find(r => r && r.type && mbtiType && String(r.type).toUpperCase() === mbtiType) || null) || (mbtiSorted.length ? mbtiSorted[0] : null);
  const mbtiShowType = mbtiType || (mbtiMainRes && mbtiMainRes.type ? String(mbtiMainRes.type).toUpperCase() : '');
  const mbtiAlias = mbtiTypeInfo && mbtiTypeInfo.alias ? String(mbtiTypeInfo.alias) : '';
  // 「点击查看详情」展开内容：该型五栏文案（优势/盲点/职场/关系/成长建议，与结果页同口径）
  const mbtiDetailSections = (() => {
    const out = [];
    MBTI_FIELDS.forEach(f => {
      const v = mbtiTypeInfo && mbtiTypeInfo[f[0]];
      const lines = [];
      const push = s => {
        if (s == null) return;
        String(s).split('\n').forEach(x => {
          x = x.trim();
          if (x) lines.push(x);
        });
      };
      if (Array.isArray(v)) v.forEach(push); else push(v);
      if (lines.length) out.push({ title: f[1], lines: lines });
    });
    return out;
  })();
  // 节125：档案「人格类型」行的来源语义（后端 archive._get_mbti 零 DDL 推导）：
  // mapped = 由大五参考换算并保存；manual = 用户自填；有类型但无同型记录之外的兜底。
  const mbtiSourceTxt = mbtiInfo && mbtiInfo.source === 'mapped'
    ? UI_COPY.caseDetail['mbti-source-mapped']
    : mbtiInfo && mbtiInfo.source === 'manual'
      ? UI_COPY.caseDetail['mbti-source-manual']
      : UI_COPY.caseDetail['mbti-source-unknown'];
  // 节125：OCEAN 五维（平台产出）—— 来自最近一次判型记录 scores_json
  const mbtiScores = mbtiInfo && mbtiInfo.scores && typeof mbtiInfo.scores === 'object' ? mbtiInfo.scores : null;
  const OCEAN_ROWS = [['O', '开放性'], ['C', '尽责性'], ['E', '外向性'], ['A', '宜人性'], ['N', '神经质']];
  const oceanRows = mbtiScores && OCEAN_ROWS.some(d => mbtiScores[d[0]] != null) && R('div', {
    style: {
      marginTop: 10
    }
  }, R('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      marginBottom: 4
    }
  }, UI_COPY.caseDetail['mbti-ocean-title']), R('div', {
    className: 'mbti-tbl'
  }, OCEAN_ROWS.map(d => R('div', {
    key: d[0],
    className: 'mbti-tbl-row'
  }, R('span', {
    className: 'k'
  }, d[1]), R('span', {
    className: 'v',
    style: {
      fontWeight: 400,
      fontSize: 13
    }
  }, mbtiScores[d[0]] != null ? Math.round(Number(mbtiScores[d[0]])) : '—')))));
  const mbtiCard = mbtiInfo && (mbtiInfo.mbti_type || mbtiRecords.length > 0) && R('div', {
    className: 'card'
  }, R('div', {
    className: 'section-title',
    style: {
      margin: '4px 0 8px'
    }
  }, UI_COPY.caseDetail['mbti-card-title']), mbtiShowType ? R('div', null, R('div', {
    className: 'mbti-tbl',
    style: {
      cursor: 'pointer'
    },
    title: mbtiDetailSections.length ? UI_COPY.caseDetail['mbti-tap-detail'] : UI_COPY.caseDetail['mbti-no-detail'],
    onClick: () => setMbtiDetailOpen(o => !o)
  }, R('div', {
    className: 'mbti-tbl-row'
  }, R('span', {
    className: 'k'
  }, UI_COPY.caseDetail['mbti-type-label']), R('span', {
    className: 'v'
  }, mbtiShowType)), R('div', {
    className: 'mbti-tbl-row'
  }, R('span', {
    className: 'k'
  }, UI_COPY.caseDetail['mbti-personality-label']), R('span', {
    className: 'v'
  }, mbtiAlias || '—')), R('div', {
    className: 'mbti-tbl-row'
  }, R('span', {
    className: 'k'
  }, UI_COPY.caseDetail['mbti-source-label']), R('span', {
    className: 'v',
    style: {
      fontWeight: 400,
      fontSize: 13
    }
  }, mbtiSourceTxt))), oceanRows, R('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 8
    }
  }, R('span', {
    style: {
      fontSize: 12,
      color: 'var(--text-3)'
    }
  }, mbtiDetailSections.length ? '点击上方结果可查看详情' : ''), mbtiDetailSections.length ? R('button', {
    className: 'btn btn-outline btn-mini',
    type: 'button',
    onClick: e => {
      e.stopPropagation();
      setMbtiDetailOpen(o => !o);
    }
  }, mbtiDetailOpen ? UI_COPY.caseDetail['mbti-collapse'] : UI_COPY.caseDetail['mbti-expand']) : null), mbtiDetailOpen ? R('div', {
    className: 'mbti-detail'
  }, mbtiDetailSections.length ? mbtiDetailSections.map(f => R('div', {
    key: f.title,
    style: {
      margin: '6px 0'
    }
  }, R('div', {
    className: 'sub-title',
    style: {
      fontSize: 12
    }
  }, f.title), f.lines.map((x, i) => R('p', {
    key: i,
    style: {
      fontSize: 13,
      color: 'var(--text-2)',
      lineHeight: 1.8,
      margin: '2px 0'
    }
  }, '· ' + x)))) : R('p', {
    style: {
      fontSize: 13,
      color: 'var(--text-3)',
      margin: '2px 0'
    }
  }, UI_COPY.caseDetail['mbti-no-copy'])) : null) : R('p', {
    style: {
      fontSize: 13,
      color: 'var(--text-3)',
      margin: '4px 0'
    }
  }, UI_COPY.caseDetail['mbti-empty']));
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title",
    style: {
      marginBottom: 6
    }
  }, caseTitle), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-2)',
      marginBottom: 8
    }
  }, UI_COPY.caseDetail['case-id-label'], caseId, UI_COPY.caseDetail['status-label'], statusMap[data && data.status] || data && data.status || '-'), /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, UI_COPY.caseDetail['info-title']), /* REQ-114 + BUG-022：内联编辑态 —— 档案名称/手机号/邮箱 行直接变为可编辑
      文本框（预填原信息），保存/取消就地完成，不再使用弹窗 */
  editing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, UI_COPY.caseDetail['name-label']), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("input", {
    id: "edit-case-name",
    className: "input",
    type: "text",
    maxLength: 30,
    value: editName,
    onChange: e => setEditName(e.target.value),
    placeholder: UI_COPY.caseDetail['name-ph'],
    onKeyDown: e => {
      if (e.key === 'Enter') submitEditInfo();
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, UI_COPY.caseDetail.phone_label), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("input", {
    id: "edit-phone",
    className: "input",
    type: "tel",
    inputMode: "numeric",
    maxLength: 11,
    value: editPhone,
    onChange: e => setEditPhone(e.target.value),
    placeholder: UI_COPY.caseDetail['phone-ph']
  }))), /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, UI_COPY.caseDetail.email_label), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("input", {
    id: "edit-email",
    className: "input",
    type: "email",
    value: editEmail,
    onChange: e => setEditEmail(e.target.value),
    placeholder: UI_COPY.caseDetail['email-ph'],
    onKeyDown: e => {
      if (e.key === 'Enter') submitEditInfo();
    }
  })))) : rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "kv",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, r[0]), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, r[1] != null && r[1] !== '' ? r[1] : '—'))), uncertList.length ? /*#__PURE__*/React.createElement("p", {
    className: "coord-hint",
    style: {
      marginTop: 8
    }
  }, UI_COPY.caseDetail['birth-time-note'] + '：' + uncertList.map(u => u.message).join('；')) : null, (!inp.longitude || !inp.latitude) && /*#__PURE__*/React.createElement("p", {
    className: "coord-hint",
    style: {
      marginTop: 8
    }
  }, UI_COPY.caseDetail['coord-missing-hint'])), /* REQ-114 + BUG-022：建档信息卡下方的「修改信息」入口 —— 内联编辑态就地渲染 保存/取消（无弹窗） */
  /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      flexWrap: 'wrap'
    }
  }, editing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "button",
    disabled: editBusy,
    onClick: submitEditInfo
  }, editBusy ? UI_COPY.caseDetail['saving-btn'] : UI_COPY.caseDetail['save-btn']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    disabled: editBusy,
    onClick: closeEditInfo
  }, UI_COPY.buttons.cancel)) : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    onClick: openEditInfo
  }, UI_COPY.caseDetail.edit_btn)), astroCard, mbtiCard, data && data.chart && chartData && /*#__PURE__*/React.createElement(ChartView, {
    chartData: chartData,
    degraded: degradedList,
    hideWestern: hideWesternTab
  }), data && data.calibrations && (calibCount != null || calibFitText != null) && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, UI_COPY.caseDetail['calib-title']), calibCount != null && /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, UI_COPY.caseDetail['feedback-title']), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, calibCount, UI_COPY.caseDetail['feedback-suffix'])), calibFitText != null && /*#__PURE__*/React.createElement("div", {
    className: "kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, UI_COPY.caseDetail['fit-title']), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, calibFitText))), convos.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, UI_COPY.caseDetail['conv-title']), convos.map((m, i) => {
    const isUser = m.role === 'user';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        margin: '4px 0',
        justifyContent: isUser ? 'flex-end' : 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: '85%',
        padding: '8px 12px',
        borderRadius: 12,
        background: isUser ? 'var(--skin-accent)' : 'var(--paper)',
        color: isUser ? 'var(--skin-accent-ink)' : 'var(--text-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        opacity: .65,
        marginBottom: 2
      }
    }, isUser ? UI_COPY.caseDetail['role-user'] : UI_COPY.caseDetail['role-assistant']), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap'
      }
    }, m.content)));
  })), /* REQ-090 v2：底部按钮 —— 第一行「回到档案列表 / 回到首页」两键并列 */
  /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('cases')
  }, UI_COPY.buttons.back_to_list), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home)), /* REQ-090 v2：第二行「国学预测 / 西式占卜 / MBTI」三键并列且颜色一致，
      携带当前档案直达对应模块（八法合一 / 塔罗 / MBTI 均带 caseId 预选当前档案） */
  /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate('nine-pick', {
      caseId
    })
  }, UI_COPY.caseDetail['enter-guoxue']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate('tarot', {
      caseId
    })
  }, UI_COPY.caseDetail['enter-xishi']), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate('mbti', {
      caseId
    })
  }, UI_COPY.caseDetail['enter-mbti'] )));
}

// 档案命名模态框：受控输入 + 取消/确定，确定中禁用按钮防重复提交
function RenameModal({
  value,
  onChange,
  onConfirm,
  onCancel,
  busy
}) {
  const el = React.createElement;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  return el(ModalBase, {
    title: '给这份档案起个名字',
    onClose: onCancel,
    footer: el(React.Fragment, null,
      el('button', {
        className: 'btn btn-outline',
        type: 'button',
        onClick: onCancel,
        disabled: busy
      }, UI_COPY.buttons.cancel),
      el('button', {
        className: 'btn btn-primary',
        type: 'button',
        onClick: onConfirm,
        disabled: busy
      }, '确定')
    )
  },
  el('input', {
    className: 'input',
    value: value,
    onChange: onChange,
    placeholder: '请输入档案名称',
    autoFocus: true,
    onKeyDown: function onKeyDown(e) {
      if (e.key === 'Enter') onConfirm();
    }
  })
  );
}

// REQ-065「修改联系方式」模态框：可编辑 手机号/邮箱（均选填，空串=清空），格式校验在提交侧
// （手机号 11 位数字、邮箱含 @）；提交由父级 PATCH /cases/{id} 传 name+phone+email。
// REQ-089 v2：档案详情「修改信息」复用本框 —— nameEditable=true 时额外开放档案名输入框，
// title 可自定义；CasesPage（档案列表）不传这些参数即保持原「修改联系方式」形态。
function CaseContactModal({
  title,
  name,
  phone,
  email,
  nameEditable,
  nameValue,
  onName,
  onPhone,
  onEmail,
  onConfirm,
  onCancel,
  busy
}) {
  const el = React.createElement;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  return el(ModalBase, {
    title: title || '修改联系方式',
    onClose: onCancel,
    align: 'left',
    scrollable: true,
    footer: el(React.Fragment, null,
      el('button', {
        className: 'btn btn-outline',
        type: 'button',
        onClick: onCancel,
        disabled: busy
      }, UI_COPY.buttons.cancel),
      el('button', {
        className: 'btn btn-primary',
        type: 'button',
        onClick: onConfirm,
        disabled: busy
      }, busy ? '保存中...' : '保存')
    )
  },
  nameEditable
    ? el(React.Fragment, null,
        el('label', { className: 'label', htmlFor: 'edit-case-name' }, '档案名称'),
        el('input', {
          id: 'edit-case-name',
          className: 'input',
          type: 'text',
          maxLength: 30,
          value: nameValue || '',
          onChange: onName,
          placeholder: '请输入档案名称',
          onKeyDown: function onKeyDown(e) { if (e.key === 'Enter') onConfirm(); }
        })
      )
    : el('div', {
        style: {
          fontSize: 12,
          color: 'var(--text-3)',
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, '档案：', name, '（改名称请用「重命名」）'),
  el('label', { className: 'label', htmlFor: 'edit-phone' }, '手机号（选填）'),
  el('input', {
    id: 'edit-phone',
    className: 'input',
    type: 'tel',
    inputMode: 'numeric',
    maxLength: 11,
    value: phone,
    onChange: onPhone,
    placeholder: '请输入 11 位手机号'
  }),
  el('label', { className: 'label', htmlFor: 'edit-email' }, '电子邮箱（选填）'),
  el('input', {
    id: 'edit-email',
    className: 'input',
    type: 'email',
    value: email,
    onChange: onEmail,
    placeholder: '请输入电子邮箱（需包含 @）',
    onKeyDown: function onKeyDown(e) { if (e.key === 'Enter') onConfirm(); }
  })
  );
}

// REQ-070 / BUG-012：档案「分享帮填」模态框 —— 展示一次性帮填链接（完整 URL = location.origin + data.url），
// 含「复制链接」按钮与「一次性、被填写后失效」提示；生成中 / 失败（可重试）状态也在此呈现。
function ShareFillModal({
  url,
  err,
  busy,
  onCopy,
  onRetry,
  onClose
}) {
  const el = React.createElement;
  // 已迁移至 ModalBase 通用基座（2026-09-10）
  // 三态内容：有url（成功）→ 复制链接；busy（生成中）→ 加载文案；err（失败）→ 重试
  let body = null;
  let footer = null;

  if (url) {
    body = el(React.Fragment, null,
      el('p', {
        style: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.6, textAlign: 'left' }
      }, UI_COPY.shareFill.desc),
      el('input', {
        className: 'input',
        readOnly: true,
        value: url,
        title: url,
        onFocus: function onFocus(e) { e.target.select(); },
        style: { textAlign: 'left' }
      }),
      el('p', {
        style: { fontSize: 12, color: 'var(--cinnabar)', margin: '8px 0 0', lineHeight: 1.6 }
      }, UI_COPY.shareFill.hint)
    );
    footer = el(React.Fragment, null,
      el('button', { className: 'btn btn-outline', type: 'button', onClick: onClose }, UI_COPY.buttons.close),
      el('button', { className: 'btn btn-primary', type: 'button', onClick: onCopy }, UI_COPY.buttons.copy_link)
    );
  } else if (busy) {
    body = el('p', {
      style: { fontSize: 13, color: 'var(--text-2)', margin: '6px 0 2px' }
    }, UI_COPY.shareFill.generating);
  } else if (err) {
    body = el(React.Fragment, null,
      el('div', { className: 'error', style: { marginBottom: 10 } }, err)
    );
    footer = el(React.Fragment, null,
      el('button', { className: 'btn btn-outline', type: 'button', onClick: onClose }, UI_COPY.buttons.close),
      el('button', { className: 'btn btn-primary', type: 'button', onClick: onRetry }, UI_COPY.buttons.retry)
    );
  }

  return el(ModalBase, {
    title: UI_COPY.shareFill.title,
    onClose: onClose,
    footer: footer
  }, body);
}
// REQ-070 / BUG-012：分享帮填状态与动作 —— openShareFill 点击即 POST /case/share（幂等：同发起者重复点击
// 复用同一条未用链接），成功后弹窗展示完整链接；复制优先 Clipboard API，失败回退 window.prompt 并 toast 手动复制。
function useCaseShareFill() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const openShareFill = async () => {
    if (busy) return;
    setOpen(true);
    setBusy(true);
    setUrl('');
    setErr('');
    try {
      const res = await api('/case/share', {
        method: 'POST'
      });
      const d = res && res.data || res || {};
      if (res && res.code != null && res.code !== 0) throw new Error(d && d.message || UI_COPY.shareFill.err);
      if (!d || !d.url) throw new Error(d && d.message || UI_COPY.shareFill.err);
      setUrl((window.location.origin || '') + d.url);
    } catch (e) {
      setErr(e && e.message || UI_COPY.shareFill.err);
    } finally {
      setBusy(false);
    }
  };
  const closeShareFill = () => {
    if (busy) return;
    setOpen(false);
    setUrl('');
    setErr('');
  };
  const copyShareFill = async () => {
    if (!url) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast(UI_COPY.shareFill.copy_ok);
        return;
      }
    } catch (e) {/* 浏览器限制（如非 HTTPS），走下方手动复制 */}
    try {
      window.prompt(UI_COPY.shareFill.copy_prompt, url);
    } catch (e) {/* prompt 不可用则仅提示 */}
    toast(UI_COPY.shareFill.copy_fail);
  };
  return {
    open,
    busy,
    url,
    err,
    openShareFill,
    closeShareFill,
    copyShareFill
  };
}

// 档案列表页：GET /api/cases 展示用户全部命理档案。REQ-065 CRM 行式列表（单行条目 + 行尾查看/修改/重命名/删除四键），
// 保留 + 新建档案 与 回首页；行点击进入 archive（查看）。不展示模块主流程按钮。
function CasesPage({
  onNavigate
}) {
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  // REQ-065「修改」弹窗（编辑 手机号/邮箱，PATCH name+phone+email）
  const [editTarget, setEditTarget] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // REQ-070 / BUG-012：分享帮填（状态/动作见 useCaseShareFill，模板处渲染 ShareFillModal）
  const shareFill = useCaseShareFill();
  const load = async () => {
    setLoading(true);
    setErrored('');
    try {
      // 列表接口返回 {code,data:{cases:[...]}} 双信封；兼容裸 {cases:[...]}
      const res = await api('/cases', {
        method: 'GET'
      });
      const list = res.data && res.data.cases || res.cases || [];
      setCaseList(list);
    } catch (e) {
      setErrored(e.message || '读取档案列表失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  // REQ-065「修改」：打开修改弹窗（可编辑 手机号/邮箱），确定后 PATCH name+phone+email
  const openEdit = c => {
    setEditTarget(c);
    setEditPhone(c.phone || '');
    setEditEmail(c.email || '');
    setEditBusy(false);
  };
  const closeEdit = () => {
    if (!editBusy) setEditTarget(null);
  };
  const submitEdit = async () => {
    if (!editTarget) return;
    // 格式校验：手机号 11 位数字；邮箱含 @（两侧非空、无空白）
    const phone = String(editPhone || '').trim();
    const email = String(editEmail || '').trim();
    if (phone && !/^\d{11}$/.test(phone)) {
      toast(UI_COPY.caseDetail['phone-err']);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) {
      toast(UI_COPY.caseDetail['email-err']);
      return;
    }
    setEditBusy(true);
    try {
      const res = await api('/cases/' + editTarget.caseId, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(editTarget.name || '').trim() || '未命名档案',
          phone: phone || null,
          email: email || null
        })
      });
      const data = res && res.data || {};
      setCaseList(list => list.map(x => x.caseId === editTarget.caseId ? {
        ...x,
        name: data.name != null ? data.name : x.name,
        phone: data.phone != null ? data.phone : (phone || null),
        email: data.email != null ? data.email : (email || null)
      } : x));
      toast(ML_COPY.ui.toast['case-edit-ok']);
      setEditTarget(null);
    } catch (e) {
      toast(e.message || ML_COPY.ui.toast['case-edit-fail']);
    } finally {
      setEditBusy(false);
    }
  };

  // 命名：点「命名」打开模态框，输入后确定提交；空名提示
  const openRename = c => {
    setRenameTarget(c);
    setRenameValue(c.name || '');
    setRenameBusy(false);
  };
  const closeRename = () => {
    if (!renameBusy) setRenameTarget(null);
  };
  const submitRename = async () => {
    if (!renameTarget) return;
    const name = String(renameValue || '').trim();
    if (!name) {
      toast(ML_COPY.ui.toast['case-name-required']);
      return;
    }
    setRenameBusy(true);
    try {
      const res = await api('/cases/' + renameTarget.caseId, {
        method: 'PATCH',
        body: JSON.stringify({
          name
        })
      });
      const data = res && res.data || {};
      const savedName = data.name || name;
      setCaseList(list => list.map(x => x.caseId === renameTarget.caseId ? {
        ...x,
        name: savedName
      } : x));
      toast(ML_COPY.ui.toast['case-rename-ok']);
      setRenameTarget(null);
    } catch (e) {
      toast(e.message || ML_COPY.ui.toast['case-rename-fail']);
    } finally {
      setRenameBusy(false);
    }
  };
  // 删除：confirm 确认 → DELETE /cases/{caseId} → 从列表移除
  // REQ-113 补全：删的是默认档案且还有剩余 → 列表最新一条（id 最大）自动成为新默认
  const handleDelete = async c => {
    if (!confirm('确定删除该档案？相关解读也将一并删除')) return;
    try {
      const res = await api('/cases/' + c.caseId, {
        method: 'DELETE'
      });
      // 双信封约定：code:0 视为成功；HTTP 错误已由 api() 抛异常
      if (res && res.code != null && res.code !== 0) throw new Error(res.message || '删除失败');
      const wasDefault = !!(res && res.data && res.data.wasDefault) || !!c.isDefault;
      setCaseList(list => {
        const next = list.filter(x => x.caseId !== c.caseId);
        if (wasDefault && next.length > 0) {
          // 后端已把最新一条设为默认；本地同步：找 id 最大的那条标 isDefault
          let maxIdx = 0;
          for (let i = 1; i < next.length; i++) {
            if ((next[i].caseId || 0) > (next[maxIdx].caseId || 0)) maxIdx = i;
          }
          return next.map((x, i) => i === maxIdx ? Object.assign({}, x, { isDefault: true }) : Object.assign({}, x, { isDefault: false }));
        }
        return next;
      });
      toast(wasDefault && caseList.length > 1 ? ML_COPY.ui.toast['case-deleted-with-default'] : ML_COPY.ui.toast['case-deleted']);
      // REQ-092：删光全部档案（当前列表只剩被删这一条）→ 重校验触发强制建档门禁：
      // 0 档 → 立即强制进入新建档案（与「新注册/无档案存量账号」同一口径）
      if (caseList.length === 1) {
        checkCaseGate().then(() => {
          if (forceOnboarding === true) onNavigate('onboarding');
        });
      }
    } catch (e) {
      alert(e.message || '删除失败，请重试。');
    }
  };
  // REQ-113③：默认档案「打勾切换」—— 点击非默认档案条目的右上角打勾 → PATCH set_default=true，
  // 由后端先清该用户全部默认再设本档案（多用户隔离）；成功后重拉列表刷新打勾标记。
  const setCaseDefault = async c => {
    if (!c || c.caseId == null) return;
    if (c.isDefault) {
      toast(ML_COPY.ui.toast['case-already-default']);
      return;
    }
    try {
      const res = await api('/cases/' + c.caseId, {
        method: 'PATCH',
        body: JSON.stringify({
          set_default: true
        })
      });
      // 双信封约定：code:0 视为成功；HTTP 错误已由 api() 抛异常
      if (res && res.code != null && res.code !== 0) throw new Error(res.message || '设置失败');
      toast(ML_COPY.ui.toast['case-set-default-ok']);
      load();
    } catch (e) {
      toast(e.message || ML_COPY.ui.toast['case-set-default-fail']);
    }
  };
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title",
      style: {
        width: '36%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '88%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '62%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title",
      style: {
        width: '36%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '88%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '62%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title",
      style: {
        width: '36%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '88%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '62%'
      }
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-3)'
      }
    }, "正在加载档案…"));
  }
  if (errored) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "档案加载失败"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: load
    }, "重试"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate('landing')
    }, UI_COPY.buttons.back_home)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, shareFill.open && /*#__PURE__*/React.createElement(ShareFillModal, {
    url: shareFill.url,
    err: shareFill.err,
    busy: shareFill.busy,
    onCopy: shareFill.copyShareFill,
    onRetry: shareFill.openShareFill,
    onClose: shareFill.closeShareFill
  }), /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, "我的档案"), caseList.length > 0 && /*#__PURE__*/React.createElement("p", {
    className: "subtitle",
    style: {
      marginTop: -10
    }
  }, "共 ", caseList.length, " 份档案 · 每条目行尾可查看 / 修改 / 重命名 / 删除 · 右上角打勾标记默认档案"), /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate('onboarding')
  }, '+ ' + UI_COPY.buttons.create_case), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    type: "button",
    disabled: shareFill.busy,
    onClick: shareFill.openShareFill
  }, shareFill.busy ? UI_COPY.shareFill.generating : UI_COPY.buttons.share_fill), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('landing')
  }, "回首页")), caseList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 24px',
      color: 'var(--text-3)',
      fontSize: 14
    }
  }, UI_COPY.empty.no_case) : caseList.map(c => {
    // CRM 行式列表（REQ-065，取代 REQ-046③ 卡片口径）：每行 = 档案名 + 生日（birthYear）+ 手机号/邮箱（有则显示），
    // 行尾排「查看 / 修改 / 重命名 / 删除」四键；点击行进入 archive（查看），行尾按键不触发行跳转
    const openArchive = () => onNavigate('archive', {
      caseId: c.caseId
    });
    const byName = String(c.name || '').trim() || '未命名档案';
    const birthText = c.birthYear != null ? c.birthYear + ' 年' : '—';
    const phoneText = c.phone ? String(c.phone).trim() : '';
    const emailText = c.email ? String(c.email).trim() : '';
    return /*#__PURE__*/React.createElement("div", {
      className: 'case-row' + (c.isDefault ? ' has-default' : ''),
      key: c.caseId,
      onClick: openArchive
    }, /* REQ-113②③：默认档案「每条目右上角打勾」标记（打勾切换）——默认=实心✓，
        非默认=空心可点，点击即 PATCH set_default 切换默认（stopPropagation 不触发行跳转） */
    /*#__PURE__*/React.createElement("span", {
      className: 'case-def-badge' + (c.isDefault ? '' : ' off'),
      title: c.isDefault ? '默认档案（王先生会话默认选中）' : '点击设为默认档案',
      role: "button",
      onClick: e => {
        e.stopPropagation();
        setCaseDefault(c);
      }
    }, "✓"), /*#__PURE__*/React.createElement("div", {
      className: "case-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "case-name"
    }, byName), /*#__PURE__*/React.createElement("span", {
      className: "case-meta"
    }, "生日：", /*#__PURE__*/React.createElement("b", null, birthText)), phoneText ? /*#__PURE__*/React.createElement("span", {
      className: "case-meta"
    }, "手机：", /*#__PURE__*/React.createElement("b", null, phoneText)) : null, emailText ? /*#__PURE__*/React.createElement("span", {
      className: "case-meta"
    }, "邮箱：", /*#__PURE__*/React.createElement("b", null, emailText)) : null), /*#__PURE__*/React.createElement("div", {
      className: "case-actions",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      type: "button",
      onClick: openArchive
    }, UI_COPY.caseDetail['view-btn']), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      type: "button",
      onClick: () => openEdit(c)
    }, "修改"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      type: "button",
      onClick: () => openRename(c)
    }, "重命名"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-del",
      type: "button",
      onClick: () => handleDelete(c)
    }, "删除")));
  }), renameTarget && /*#__PURE__*/React.createElement(RenameModal, {
    value: renameValue,
    onChange: e => setRenameValue(e.target.value),
    onConfirm: submitRename,
    onCancel: closeRename,
    busy: renameBusy
  }), editTarget && /*#__PURE__*/React.createElement(CaseContactModal, {
    name: String(editTarget.name || '').trim() || '未命名档案',
    phone: editPhone,
    email: editEmail,
    onPhone: e => setEditPhone(e.target.value),
    onEmail: e => setEditEmail(e.target.value),
    onConfirm: submitEdit,
    onCancel: closeEdit,
    busy: editBusy
  }));
}

const POLL_MESSAGES = ['算命师傅正推演四柱干支…', '紫微星曜正在排布…', '大运流年逐一推敲…', '神煞纳音细细参详…', '奇门九宫正在起局…', '占星相位正在演算…', '七政躔次正在排定…', '五运六气正在推演…', '师傅正在斟酌格局喜忌…', '命盘已定，正在核验应期…'];
function WaitingPage({
  caseId,
  onNavigate
}) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(9);
  const [status, setStatus] = useState('pending');
  const [errored, setErrored] = useState('');
  const [pollMsg, setPollMsg] = useState(POLL_MESSAGES[0]);
  const ref = useRef({
    timer: null,
    timeout: null,
    done: false,
    lastCompleted: 0
  });
  const stop = () => {
    clearTimeout(ref.current.timer);
    clearTimeout(ref.current.timeout);
  };

  // 轨道动画随真实进度点亮
  useEffect(() => {
    if (errored) return;
    const svg = document.getElementById('dqcPlate');
    if (svg && !svg.dataset.built) {
      buildOrbit('dqcPlate', DQC_METHODS);
      svg.dataset.built = '1';
    }
    setOrbitProgress('dqcPlate', DQC_METHODS, progress, total || 8);
  }, [progress, total, errored, caseId]);
  const start = async () => {
    stop();
    ref.current.done = false;
    ref.current.lastCompleted = 0;
    setErrored('');
    setStatus('pending');
    setProgress(0);
    setTotal(9);
    setPollMsg(POLL_MESSAGES[Math.floor(Math.random() * POLL_MESSAGES.length)]);
    // 超时按「单法进度」计：每完成一个 method（completed 变化）重新计时；
    // 只有某个 method 卡住超过 10 分钟（进度不动）才超时。
    const resetTimeout = () => {
      clearTimeout(ref.current.timeout);
      ref.current.timeout = setTimeout(() => {
        if (!ref.current.done) {
          ref.current.done = true;
          stop();
          setErrored('某个方法超过 10 分钟无进展，请重试。');
        }
      }, 600000);
    };
    try {
      const res = await api('/cases/' + caseId + '/duan-qian-chen', {
        method: 'POST'
      });
      const jobId = res.data && res.data.jobId || res.jobId;
      resetTimeout();
      let pollDelay = 2000;
      const pollJob = async () => {
        let advanced = false;
        try {
          const job = await api('/jobs/' + jobId);
          const data = job.data || job;
          setProgress(data.completed);
          setTotal(data.total);
          setStatus(data.status);
          // 进度推进 → 重新计时 + 换一句等待短句
          if ((data.completed || 0) > (ref.current.lastCompleted || 0)) {
            ref.current.lastCompleted = data.completed;
            resetTimeout();
            setPollMsg(POLL_MESSAGES[Math.floor(Math.random() * POLL_MESSAGES.length)]);
            advanced = true;
          }
          if (data.status === 'succeeded') {
            ref.current.done = true;
            stop();
            setTimeout(() => onNavigate('calibration', {
              caseId
            }), 500);
            return;
          } else if (data.status === 'failed') {
            ref.current.done = true;
            stop();
            setErrored('推演任务失败，请点击重试。');
            return;
          }
        } catch (e) {
          ref.current.done = true;
          stop();
          setErrored(e.message || '网络异常，请重试。');
          return;
        }
        // 有进展回到 2s，无进展指数退避到 30s 上限
        pollDelay = advanced ? 2000 : Math.min(pollDelay * 2, 30000);
        if (!ref.current.done) ref.current.timer = setTimeout(pollJob, pollDelay);
      };
      ref.current.timer = setTimeout(pollJob, 2000);
    } catch (e) {
      ref.current.done = true;
      stop();
      setErrored(e.message || '启动推演失败。');
    }
  };
  useEffect(() => {
    if (caseId) {
      start();
    }
    return stop;
  }, [caseId]);
  const pct = total > 0 ? Math.round(progress / total * 100) : 0;
  const lit = Math.min(DQC_METHODS.length, Math.round(progress / (total || 8) * DQC_METHODS.length));
  if (errored) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "推演未完成"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: start
    }, "重试"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate('onboarding')
    }, "返回建档")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dqc-stage"
  }, /*#__PURE__*/React.createElement("svg", {
    id: "dqcPlate",
    className: "dqc-plate",
    viewBox: "0 0 240 240"
  }), /*#__PURE__*/React.createElement("div", {
    className: "dqc-progress"
  }, progress, " / ", total), /*#__PURE__*/React.createElement("div", {
    className: "dqc-method"
  }, status === 'succeeded' ? '八法推演完成' : '正在综合八流派推演'), /*#__PURE__*/React.createElement("div", {
    className: "dqc-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "dqc-status"
  }, status === 'succeeded' ? '推演完成' : pollMsg), /*#__PURE__*/React.createElement("div", {
    className: "dqc-list"
  }, DQC_METHODS.map((m, i) => {
    const cls = i < lit ? 'done' : i === lit && progress < total ? 'active' : '';
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      className: cls
    }, m);
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 12,
      color: 'var(--text-2)',
      marginTop: 14
    }
  }, status === 'succeeded' ? '推演完成，正在进入问卷校准...' : '已完成 ' + progress + ' / ' + total + '，请稍候...'), status !== 'succeeded' && /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 4
    }
  }, "每个方法约需数分钟，全程约 30–60 分钟；可先去做别的事，本页会持续等待。"), status !== 'succeeded' && /*#__PURE__*/React.createElement("p", {
    // REQ-058：等待开始时展示提醒文案（回到首页入口本页已有，位于下方按钮）
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: 'var(--text-3)',
      marginTop: 2
    }
  }, "排盘等待时间偏长，可先去体验其他功能"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      marginTop: 12
    },
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home));
}
function CalibrationPage({
  caseId,
  onNavigate
}) {
  const [propositions, setPropositions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  // 校准提交结果过渡态：{ fit, complete }，用于短暂展示契合度后再跳预测
  const [calibResult, setCalibResult] = useState(null);
  // 问卷加载状态机：loading 读取中 / empty 后端无命题 / error 失败 / ready 正常展示
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const ref = useRef({
    timer: null,
    timeout: null,
    done: false
  });
  const stop = () => {
    clearTimeout(ref.current.timer);
    clearTimeout(ref.current.timeout);
    clearTimeout(ref.current.navTimer);
  };

  // 后端命题字段 method/domain/claim/year_range/confidence_level → 卡片所需 method/domain/claim/yearRange/confidence
  const mapPropositions = list => (list || []).map(p => ({
    method: p.method || '',
    domain: p.domain || '',
    claim: p.claim || '',
    yearRange: p.year_range || '',
    confidence: p.confidence_level || ''
  })).filter(p => p.claim);
  const start = async () => {
    stop();
    ref.current.done = false;
    setLoadState('loading');
    setLoadError('');
    try {
      // Phase 4：发起断前尘任务取真实问卷（各法结果后端已落库缓存，重复进入走缓存快速返回）
      const res = await api('/cases/' + caseId + '/duan-qian-chen', {
        method: 'POST'
      });
      const jobId = res.data && res.data.jobId || res.jobId;
      let pollDelay = 2000;
      const pollJob = async () => {
        try {
          const job = await api('/jobs/' + jobId);
          const data = job.data || job;
          if (data.status === 'succeeded') {
            ref.current.done = true;
            stop();
            const result = data.result || {};
            const props = mapPropositions(result.propositions);
            if (!props.length) setLoadState('empty');else {
              setPropositions(props);
              setLoadState('ready');
            }
            return;
          } else if (data.status === 'failed') {
            ref.current.done = true;
            stop();
            setLoadState('error');
            setLoadError('问卷推演任务失败，请点击重试。');
            return;
          }
        } catch (e) {
          ref.current.done = true;
          stop();
          setLoadState('error');
          setLoadError(e.message || '网络异常，请重试。');
          return;
        }
        // 问卷就绪即结束、无进度概念 → 纯指数退避到 30s 上限
        pollDelay = Math.min(pollDelay * 2, 30000);
        if (!ref.current.done) ref.current.timer = setTimeout(pollJob, pollDelay);
      };
      ref.current.timer = setTimeout(pollJob, 2000);
      // 硬超时：断前尘 10 分钟（§5.1）
      ref.current.timeout = setTimeout(() => {
        if (!ref.current.done) {
          ref.current.done = true;
          stop();
          setLoadState('error');
          setLoadError('等待问卷超时（约 10 分钟），请重试。');
        }
      }, 600000);
    } catch (e) {
      ref.current.done = true;
      stop();
      setLoadState('error');
      setLoadError(e.message || '启动问卷推演失败。');
    }
  };
  useEffect(() => {
    if (caseId) {
      start();
    }
    return stop;
  }, [caseId]);
  const handleFeedback = (idx, type, noteText) => {
    const prop = propositions[idx];
    const fb = {
      method: prop.method,
      domain: prop.domain,
      claim: prop.claim,
      feedback: type
    };
    if (type === 'corrected' && noteText) fb.user_note = noteText;
    setFeedback([...feedback, fb]);
    const newProps = [...propositions];
    newProps.splice(idx, 1);
    setPropositions(newProps);
    setCorrecting(false);
    setNote('');
  };
  const submitCorrect = () => handleFeedback(0, 'corrected', note.trim());
  const handleSubmit = async () => {
    if (calibResult) return; // 防重复提交
    try {
      const res = await api('/cases/' + caseId + '/calibration', {
        method: 'POST',
        body: JSON.stringify({
          feedback
        })
      });
      const data = res.data || res;
      // 双信封：取返回 fit（数值 0–1）与 complete；兼容字符串数字
      const rawFit = data && data.fit;
      const fitNum = typeof rawFit === 'number' ? rawFit : typeof rawFit === 'string' && rawFit !== '' ? Number(rawFit) : NaN;
      if (isFinite(fitNum)) {
        // 有 fit：短暂展示「校准完成 · 契合度 x%」后再跳转 predict
        setCalibResult({
          fit: fitNum,
          complete: !!(data && data.complete)
        });
        ref.current.navTimer = setTimeout(() => onNavigate('predict', {
          caseId
        }), 1500);
      } else {
        // 兜底：返回无 fit 时沿用直接跳转行为
        onNavigate('predict', {
          caseId
        });
      }
    } catch (e) {
      alert(e.message || '提交失败');
    }
  };

  // 读取问卷中
  if (loadState === 'loading') {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title"
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '90%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '70%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '85%'
      }
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-2)'
      }
    }, "正在读取校准断言…"));
  }

  // 拉取/推演失败
  if (loadState === 'error') {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "问卷加载失败"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, loadError), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: start
    }, "重试"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate('landing')
    }, UI_COPY.buttons.back_home)));
  }

  // 后端无待校准断言：友好空态 + 跳过校准
  if (loadState === 'empty') {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "问卷校准"), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-2)',
        marginBottom: 16
      }
    }, "暂无待校准断言，可直接查看预测"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: () => onNavigate('predict', {
        caseId
      })
    }, "跳过校准")));
  }

  // 已逐条确认/否认/修正完 → 提交反馈后短暂展示契合度，再进入预测
  if (propositions.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "校准完成"), calibResult ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 20,
        fontWeight: 600,
        color: 'var(--skin-accent)',
        margin: '8px 0 4px'
      }
    }, "校准完成 · 契合度 ", Math.round((calibResult.fit || 0) * 100), "%"), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-2)',
        fontSize: 13,
        marginBottom: 16
      }
    }, calibResult.complete ? '校准已完成，正在为您生成预测…' : '正在为您生成预测…')) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-2)',
        marginBottom: 16
      }
    }, "已确认 ", feedback.length, " 条断言"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: handleSubmit
    }, "查看预测结果"))));
  }
  const prop = propositions[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, "问卷校准"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--text-2)',
      marginBottom: 16
    }
  }, "剩余 ", propositions.length, " 条 · 已确认 ", feedback.length, " 条"), /*#__PURE__*/React.createElement("div", {
    className: "progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "progress-bar",
    style: {
      width: feedback.length / (feedback.length + propositions.length) * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 16,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag"
  }, prop.method), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginLeft: 8
    }
  }, prop.domain), prop.yearRange && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginLeft: 8
    }
  }, prop.yearRange), prop.confidence && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginLeft: 8
    }
  }, "置信度 ", prop.confidence === 'high' ? '高' : prop.confidence === 'medium' ? '中' : prop.confidence)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      margin: '12px 0'
    }
  }, prop.claim), correcting ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("textarea", {
    className: "note-input",
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "请说明您认为更准确的实际情况，例如具体年份或事件..."
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: submitCorrect
  }, "提交修正"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => {
      setCorrecting(false);
      setNote('');
    }
  }, UI_COPY.buttons.cancel))) : /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      justifyContent: 'flex-end',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      background: 'var(--skin-accent-soft)',
      color: 'var(--skin-accent)',
      fontWeight: 600,
      borderColor: 'var(--skin-accent)'
    },
    onClick: () => handleFeedback(0, 'confirmed')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15
  }), UI_COPY.buttons.confirm), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      background: 'var(--tc-danger-bg)',
      color: 'var(--cinnabar)',
      fontWeight: 600
    },
    onClick: () => handleFeedback(0, 'denied')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cross",
    size: 15
  }), "否认"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => setCorrecting(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 15
  }), "修正")))));
}
// REQ-126：8 法 method_key → 中文名（degraded 法仅有 key，无后端 name；映射对齐 backend/app/credits/labels.py METHOD_ZH）
// 节139：xizhan 条目保留——仅作历史读数/degraded 键的兜底显示，xizhan 已不在八法注册表内
const REQ126_METHOD_KEY_ZH = {
  'bazi-pattern': '八字格局',
  'bazi-dayun-liunian': '大运流年',
  'bazi-shensha-nayin': '神煞纳音',
  'bazi-hunyin-caiyun': '婚姻财运',
  ziwei: '紫微',
  xizhan: '西占',
  qizheng: '七政',
  'qimen-lifetime': '奇门',
  'wuyun-liuqi': '五运六气'
};
function PredictPage({
  caseId,
  onNavigate
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [history, setHistory] = useState([]);
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  // REQ-126：8 法内部 tab（综合 / 八法解读，逐法数据源 GET /api/cases/{id}/readings，纯读库零 LLM）
  const [tab, setTab] = useState('all');
  const [readings, setReadings] = useState(null);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [readingsErr, setReadingsErr] = useState('');
  const ref = useRef({
    timer: null,
    timeout: null,
    done: false,
    lastCompleted: 0
  });
  const stop = () => {
    clearTimeout(ref.current.timer);
    clearTimeout(ref.current.timeout);
  };
  const start = async () => {
    stop();
    ref.current.done = false;
    ref.current.lastCompleted = 0;
    setErrored('');
    setLoading(true);
    // 超时按「单法进度」计：每完成一个 method（completed 变化）重新计时；
    // 只有某个 method 卡住超过 10 分钟（进度不动）才超时。
    const resetTimeout = () => {
      clearTimeout(ref.current.timeout);
      ref.current.timeout = setTimeout(() => {
        if (!ref.current.done) {
          ref.current.done = true;
          stop();
          setErrored('某个方法超过 10 分钟无进展，请重试。');
          setLoading(false);
        }
      }, 600000);
    };
    // 先查历史报告：已有解读直接展示，不重复调 LLM；无历史（404 或空）才走原 predict 流程
    try {
      const rr = await api('/cases/' + caseId + '/report');
      const rdata = rr && rr.data || rr;
      if (rdata && rdata.report) {
        setReport(rdata.report);
        setLoading(false);
        return;
      }
    } catch (e) {/* 无历史报告，走原 predict 流程 */}
    try {
      const res = await api('/cases/' + caseId + '/predict', {
        method: 'POST'
      });
      const jobId = res.data && res.data.jobId || res.jobId;
      resetTimeout();
      let pollDelay = 2000;
      const pollJob = async () => {
        let advanced = false;
        try {
          const job = await api('/jobs/' + jobId);
          const data = job.data || job;
          if ((data.completed || 0) > (ref.current.lastCompleted || 0)) {
            ref.current.lastCompleted = data.completed;
            resetTimeout();
            advanced = true;
          }
          if (data.status === 'succeeded') {
            ref.current.done = true;
            stop();
            // Phase 4：取真实 job result 里的 report（summary/trend/details）
            if (data.result && data.result.report) {
              setReport(data.result.report);
            } else {
              // result 或 report 缺失 → 错误态 + 重试
              setErrored('预测任务已完成但报告数据缺失，请点击重试。');
            }
            setLoading(false);
            return;
          } else if (data.status === 'failed') {
            ref.current.done = true;
            stop();
            setErrored('预测任务失败，请点击重试。');
            setLoading(false);
            return;
          }
        } catch (e) {
          ref.current.done = true;
          stop();
          setErrored(e.message || '网络异常，请重试。');
          setLoading(false);
          return;
        }
        // 有进展回到 2s，无进展指数退避到 30s 上限
        pollDelay = advanced ? 2000 : Math.min(pollDelay * 2, 30000);
        if (!ref.current.done) ref.current.timer = setTimeout(pollJob, pollDelay);
      };
      ref.current.timer = setTimeout(pollJob, 2000);
    } catch (e) {
      ref.current.done = true;
      stop();
      setErrored(e.message || '启动预测失败。');
      setLoading(false);
    }
  };
  useEffect(() => {
    if (caseId) {
      start();
    }
    return stop;
  }, [caseId]);

  // 挂载时拉历史追问（只取最近 10 条 user 提问；archive 失败静默，不影响解读主流程）
  useEffect(() => {
    let alive = true;
    if (!caseId) return;
    (async () => {
      try {
        const res = await api('/cases/' + caseId + '/archive');
        const data = res && res.data || res || {};
        const convs = (Array.isArray(data.conversations) ? data.conversations : []).filter(m => m && m.role === 'user').slice(-10);
        if (alive) setHistory(convs);
      } catch (e) {/* 无历史/加载失败 → 板块不展示 */}
    })();
    return () => {
      alive = false;
    };
  }, [caseId]);
  // REQ-126：八法解读 tab —— 懒加载 readings（切到该 tab 才请求；纯读库零 LLM）
  const loadReadings = async () => {
    if (readings || readingsLoading) return;
    setReadingsLoading(true);
    setReadingsErr('');
    try {
      const rr = await api('/cases/' + caseId + '/readings');
      const d = (rr && rr.data) || rr || {};
      setReadings(d);
    } catch (e) {
      setReadingsErr((e && e.message) || ML_COPY.ui.hub['readings-load-fail']);
    } finally {
      setReadingsLoading(false);
    }
  };
  const switchTab = t => {
    setTab(t);
    if (t === 'methods') loadReadings();
  };
  const CONF_ZH = {
    high: '高',
    medium: '中',
    low: '低',
    speculative: '推测'
  };
  // 逐法解读卡流：prediction conclusions 优先，空则回退断前尘 past_propositions；degraded 显示「未生成」
  const readingsView = () => {
    const rows = readings && Array.isArray(readings.methods) ? readings.methods : null;
    const degraded = readings && Array.isArray(readings.degraded) ? readings.degraded : [];
    let body;
    if (readingsLoading && !rows) {
      body = /*#__PURE__*/React.createElement("div", {
        className: "sk-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "skeleton sk-line",
        style: {
          width: '90%'
        }
      }), /*#__PURE__*/React.createElement("div", {
        className: "skeleton sk-line",
        style: {
          width: '70%'
        }
      }), /*#__PURE__*/React.createElement("div", {
        className: "skeleton sk-line",
        style: {
          width: '85%'
        }
      }));
    } else if (readingsErr && !rows) {
      body = /*#__PURE__*/React.createElement("div", {
        className: "card failed-box"
      }, /*#__PURE__*/React.createElement("div", {
        className: "error"
      }, readingsErr), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline",
        onClick: loadReadings
      }, UI_COPY.buttons.retry));
    } else if (!rows || !rows.length) {
      body = /*#__PURE__*/React.createElement("div", {
        className: "card"
      }, ML_COPY.ui.hub['readings-empty']);
    } else {
      const cards = rows.map(r => {
        const conclusions = Array.isArray(r.conclusions) ? r.conclusions : [];
        const props = Array.isArray(r.past_propositions) ? r.past_propositions : [];
        const degradedThis = degraded.indexOf(r.method_key) >= 0;
        const badge = /*#__PURE__*/React.createElement("span", {
          className: "rd-badge" + (r.phase === 'duan-qian-chen' ? ' dqc' : '')
        }, r.phase === 'prediction' ? ML_COPY.ui.hub['readings-phase-prediction'] : ML_COPY.ui.hub['readings-phase-dqc']);
        const items = [];
        if (degradedThis) {
          items.push(/*#__PURE__*/React.createElement("div", {
            key: 'dg',
            className: "rd-degraded"
          }, /*#__PURE__*/React.createElement("span", {
            className: "dg-tag"
          }, ML_COPY.ui.hub['readings-degraded']), '该法尚未生成解读'));
        } else if (conclusions.length) {
          conclusions.forEach((c, i) => {
            const dir = c.direction === '吉' ? 'ji' : c.direction === '凶' ? 'xiong' : 'ping';
            items.push(/*#__PURE__*/React.createElement("div", {
              key: 'c' + i,
              className: "rd-item"
            }, /*#__PURE__*/React.createElement("span", {
              className: "rd-dir " + dir
            }, c.direction || '平'), c.domain ? /*#__PURE__*/React.createElement("span", {
              style: {
                fontWeight: 600,
                marginRight: 6
              }
            }, c.domain) : null, c.claim || ''));
          });
        } else if (props.length) {
          props.forEach((p, i) => {
            const conf = CONF_ZH[p.confidence_level] || '';
            items.push(/*#__PURE__*/React.createElement("div", {
              key: 'p' + i,
              className: "rd-item"
            }, /*#__PURE__*/React.createElement("span", {
              style: {
                fontWeight: 600,
                marginRight: 6,
                color: 'var(--text-1)'
              }
            }, [p.year_range, p.domain].filter(Boolean).join(' · ') || ''), p.claim || '', conf ? /*#__PURE__*/React.createElement("span", {
              style: {
                color: 'var(--text-3)',
                marginLeft: 6
              }
            }, '（置信 ' + conf + '）') : null));
          });
        } else {
          items.push(/*#__PURE__*/React.createElement("div", {
            key: 'e',
            className: "rd-empty"
          }, ML_COPY.ui.hub['readings-empty']));
        }
        return /*#__PURE__*/React.createElement("div", {
          key: r.method_key,
          className: "rd-method"
        }, /*#__PURE__*/React.createElement("div", {
          className: "rd-head"
        }, /*#__PURE__*/React.createElement("span", {
          className: "rd-name"
        }, r.name), badge), items);
      });
      // degraded：后端仅列 key（无 name），用前端映射补中文名（对齐后端 METHOD_ZH），显示「未生成」
      degraded.forEach(k => {
        const nm = REQ126_METHOD_KEY_ZH[k] || k;
        cards.push(/*#__PURE__*/React.createElement("div", {
          key: 'dg-' + k,
          className: "rd-method"
        }, /*#__PURE__*/React.createElement("div", {
          className: "rd-head"
        }, /*#__PURE__*/React.createElement("span", {
          className: "rd-name"
        }, nm), /*#__PURE__*/React.createElement("span", {
          className: "rd-badge dqc"
        }, ML_COPY.ui.hub['readings-degraded'])), /*#__PURE__*/React.createElement("div", {
          className: "rd-degraded"
        }, '该法尚未生成解读')));
      });
      body = cards;
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-title"
    }, ML_COPY.ui.hub['readings-title']), body);
  };
  const tabBar = /*#__PURE__*/React.createElement("div", {
    className: "readings-tabs",
    role: "tablist"
  }, /*#__PURE__*/React.createElement("button", {
    key: "all",
    type: "button",
    className: "rt-tab" + (tab === 'all' ? ' on' : ''),
    onClick: function () {
      switchTab('all');
    }
  }, ML_COPY.ui.hub['readings-tab-all']), /*#__PURE__*/React.createElement("button", {
    key: "methods",
    type: "button",
    className: "rt-tab" + (tab === 'methods' ? ' on' : ''),
    onClick: function () {
      switchTab('methods');
    }
  }, ML_COPY.ui.hub['readings-tab-methods']));
  if (errored) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "解读未完成"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, errored), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: start
    }, "重试"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      style: {
        marginTop: 8
      },
      onClick: () => onNavigate('landing')
    }, UI_COPY.buttons.back_home)));
  }
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-title"
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '90%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '75%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '85%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '40%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '95%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '60%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "sk-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '40%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '95%'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "skeleton sk-line",
      style: {
        width: '60%'
      }
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, tabBar, tab === 'methods' ? readingsView() : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      borderLeft: '3px solid var(--gold-500)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, "综合解读"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      margin: '8px 0 4px',
      color: 'var(--gold-500)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "orbit",
    size: 48
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      color: 'var(--skin-accent)'
    }
  }, "总体趋势：温和上扬"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-2)',
      fontSize: 14,
      marginTop: 8
    }
  }, report?.summary)), (report?.details || []).map((d, i) => {
    const goTopic = () => onNavigate('topic', {
      caseId,
      topic: d.title,
      context: d.description,
      direction: d.direction
    });
    const m = trendMeta(d.direction);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'card trend-' + (d.direction === '吉' ? 'ji' : d.direction === '凶' ? 'xiong' : 'ping'),
      style: {
        cursor: 'pointer'
      },
      title: '查看「' + d.title + '」板块详情',
      onClick: goTopic
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 24,
        color: m.color
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: m.icon,
      size: 24
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("h4", null, d.title), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-2)',
        fontSize: 13
      }
    }, d.description)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn btn-outline",
      style: {
        flex: 'none',
        width: 'auto',
        padding: '6px 12px',
        fontSize: 12,
        whiteSpace: 'nowrap'
      },
      onClick: e => {
        e.stopPropagation();
        goTopic();
      }
    }, "查看详情")));
  }), history.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, "历史追问 / 矫正"), /*#__PURE__*/React.createElement("div", {
    className: "hist-list"
  }, history.map((m, i) => {
    const t = m && m.content != null ? String(m.content).replace(/\s+/g, ' ').trim() : '';
    const shown = t.length > 40 ? t.slice(0, 40) + '…' : t;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "hist-item",
      onClick: () => onNavigate('revise', {
        caseId,
        topic: null,
        context: m.content
      })
    }, shown);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onNavigate('revise', {
      caseId,
      context: report && report.summary || ''
    })
  }, ["追问解读", payBadge(payEnough)]), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('archive', {
      caseId
    })
  }, "回到档案")), /*#__PURE__*/React.createElement("div", {
    className: "flex-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('cases')
  }, UI_COPY.buttons.back_to_list), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => onNavigate('landing')
  }, UI_COPY.buttons.back_home)), /*#__PURE__*/React.createElement("div", {
    className: "flex-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: logout
  }, UI_COPY.buttons.logout))));
}
function RevisePage({
  caseId,
  topic,
  context,
  onNavigate
}) {
  const [messages, setMessages] = useState(() => {
    const first = context || (topic ? '关于「' + topic + '」这一板块，请说出您的疑问或不同看法。' : null);
    const guide = '关于这份解读，您还有什么想追问的？';
    return first ? [{
      role: 'assistant',
      content: first
    }, {
      role: 'assistant',
      content: guide
    }] : [{
      role: 'assistant',
      content: guide
    }];
  });
  const [input, setInput] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();

  // 重新生成解读：POST predict 拿 jobId，轮询到 succeeded（或 failed/超时）再回解读页；
  // 此时 PredictPage 读 /report 已是最新成功的预测任务，直接展示新解读。
  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await api('/cases/' + caseId + '/predict', {
        method: 'POST'
      });
      const jobId = res.data && res.data.jobId || res.jobId;
      if (jobId && token) {
        for (let i = 0; i < 150; i++) {
          // 至多约 5 分钟
          await new Promise(r => setTimeout(r, 2000));
          if (!token) break; // 轮询途中登出则中止
          try {
            const job = await api('/jobs/' + jobId);
            const jd = job.data || job;
            if (jd.status === 'succeeded') break;
            if (jd.status === 'failed') {
              toast(ML_COPY.ui.toast['case-reinterpret-fail']);
              break;
            }
          } catch (e) {
            break;
          } // job 查询异常 → 直接回解读页（PredictPage 自行处理）
        }
      }
      if (token) onNavigate('predict', {
        caseId
      });
    } catch (e) {
      if (token) onNavigate('predict', {
        caseId
      }); // predict 启动失败也回解读页（可重试）
    }
  };
  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = {
      role: 'user',
      content: input
    };
    setMessages([...messages, userMsg]);
    setInput('');
    try {
      const body = {
        message: input
      };
      if (topic) body.topic = topic; // 板块追问：标注是针对哪个板块（如「事业趋势」）
      const res = await api('/cases/' + caseId + '/revise', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const reply = res.data && res.data.reply || res.reply || '根据您的命盘综合来看，建议保持耐心，等待时机成熟。';
      setMessages(msgs => [...msgs, {
        role: 'assistant',
        content: reply
      }]);
    } catch (e) {
      setMessages(msgs => [...msgs, {
        role: 'assistant',
        content: '抱歉，暂时无法回复，请稍后重试。'
      }]);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "title"
  }, topic ? '追问：' + topic : '追问解读'), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 400,
      overflowY: 'auto',
      marginBottom: 12
    }
  }, messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 12px',
      margin: '4px 0',
      borderRadius: 12,
      background: m.role === 'user' ? 'var(--skin-accent)' : 'var(--paper)',
      color: m.role === 'user' ? 'var(--skin-accent-ink)' : 'var(--text-1)',
      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      marginLeft: m.role === 'user' ? 'auto' : '0'
    }
  }, m.content))), /*#__PURE__*/React.createElement("div", {
    className: "flex-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: input,
    onChange: e => setInput(e.target.value),
    placeholder: topic ? '就「' + topic + '」继续提问...' : '输入您的问题...',
    onKeyDown: e => e.key === 'Enter' && handleSend()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      width: 80
    },
    onClick: handleSend
  }, ["发送", payBadge(payEnough)])), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      marginTop: 12
    },
    onClick: handleRegenerate,
    disabled: regenerating
  }, regenerating ? '重新生成中…' : ['重新生成解读', payBadge(payEnough)]), /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      padding: '8px 12px',
      fontSize: 13
    },
    onClick: () => onNavigate('predict', {
      caseId
    })
  }, "返回解读"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      padding: '8px 12px',
      fontSize: 13
    },
    onClick: () => onNavigate('archive', {
      caseId
    })
  }, "我的档案"))));
}

// ===== 板块独立详情页（report.details 每个板块的专属界面） =====
// 标题=板块领域名 + 趋势 direction（TREND_META 映射颜色/图标）；正文=完整展示该板块 description；
// 下方=针对本板块的追问对话，复用 /revise 端点、body 带 topic=板块名。
function TopicPage({
  caseId,
  topic,
  context,
  direction,
  onNavigate
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [messages, setMessages] = useState(() => [{
    role: 'assistant',
    content: topic ? '以上是「' + topic + '」板块的完整解读，您可就这一板块继续追问。' : '您想进一步了解哪些细节？'
  }]);
  const goPredict = () => onNavigate('predict', {
    caseId
  });
  const handleSend = async () => {
    const text = String(input || '').trim();
    if (!text || sending || !topic || !caseId) return;
    setSending(true);
    setMessages(msgs => [...msgs, {
      role: 'user',
      content: text
    }]);
    setInput('');
    try {
      const body = {
        message: text
      };
      if (topic) body.topic = topic; // 板块追问：body 带 topic=板块名，走同一 /revise 端点
      const res = await api('/cases/' + caseId + '/revise', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const reply = res.data && res.data.reply || res.reply || '根据您的命盘综合来看，建议保持耐心，等待时机成熟。';
      setMessages(msgs => [...msgs, {
        role: 'assistant',
        content: reply
      }]);
    } catch (e) {
      setMessages(msgs => [...msgs, {
        role: 'assistant',
        content: '抱歉，暂时无法回复，请稍后重试。'
      }]);
    } finally {
      setSending(false);
    }
  };

  // 挂载时回显该板块历史追问：GET archive → data.conversations（防御解包），
  // 按 topic === 当前板块名 过滤、turn 升序，映射成 role/content 气泡，插在引导语之后；
  // archive 失败或无该板块记录 → 静默，仅保留引导语（不报错）
  useEffect(() => {
    let alive = true;
    if (!caseId || !topic) return;
    (async () => {
      try {
        const res = await api('/cases/' + caseId + '/archive');
        const data = res && res.data || res || {};
        const convs = (Array.isArray(data.conversations) ? data.conversations : []).filter(c => c && (c.role === 'user' || c.role === 'assistant') && c.content && c.topic === topic).sort((a, b) => (a.turn || 0) - (b.turn || 0)).map(c => ({
          role: c.role,
          content: c.content
        }));
        if (!alive || !convs.length) return;
        setMessages(msgs => {
          // 引导语恒在 index 0，历史紧跟其后，本会话新追问保持在队尾
          return msgs.slice(0, 1).concat(convs, msgs.slice(1));
        });
      } catch (e) {/* 无历史/加载失败 → 不展示、不报错 */}
    })();
    return () => {
      alive = false;
    };
  }, [caseId, topic]);
  const meta = trendMeta(direction); // 吉/凶/平 → 颜色 / 图标 / 文案
  const trendName = direction || '平';
  if (!caseId || !topic) {
    return /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card failed-box"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, "板块详情不可用"), /*#__PURE__*/React.createElement("div", {
      className: "error"
    }, "缺少档案或板块信息，请从综合解读页进入具体板块。"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      onClick: goPredict
    }, "返回综合解读")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'card ' + meta.cls,
    style: {
      padding: '18px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: meta.color,
      display: 'inline-flex',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: meta.icon,
    size: 30
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 23,
      fontWeight: 700,
      color: 'var(--ink-700)',
      letterSpacing: '.03em'
    }
  }, topic), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)',
      marginTop: 3
    }
  }, "板块独立解读 · 趋势 ", trendName, "（", meta.label, "）")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      fontSize: 13,
      fontWeight: 700,
      padding: '4px 14px',
      borderRadius: 999,
      background: meta.color,
      color: 'var(--tc-white)',
      boxShadow: '0 2px 8px var(--tc-ink-a16)'
    }
  }, trendName))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, topic, " · 独立解读"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      lineHeight: 1.9,
      color: 'var(--text-1)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }
  }, context || '该板块暂无更多解读内容，可通过下方追问进一步了解。')), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sub-title"
  }, "追问 · ", topic), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 340,
      overflowY: 'auto',
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column'
    }
  }, messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 12px',
      margin: '4px 0',
      borderRadius: 12,
      background: m.role === 'user' ? 'var(--skin-accent)' : 'var(--paper)',
      color: m.role === 'user' ? 'var(--skin-accent-ink)' : 'var(--text-1)',
      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '86%'
    }
  }, m.content)), sending && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      margin: '4px 0',
      borderRadius: 12,
      background: 'var(--paper)',
      color: 'var(--text-3)',
      alignSelf: 'flex-start',
      fontSize: 13
    }
  }, "解读中…")), /*#__PURE__*/React.createElement("div", {
    className: "flex-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    style: {
      margin: 0
    },
    value: input,
    onChange: e => setInput(e.target.value),
    placeholder: '就「' + topic + '」继续提问…',
    onKeyDown: e => {
      if (e.key === 'Enter') handleSend();
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-primary",
    style: {
      flex: 'none',
      width: 84
    },
    onClick: handleSend,
    disabled: sending
  }, sending ? '回复中' : ['发送', payBadge(payEnough)])), /*#__PURE__*/React.createElement("div", {
    className: "flex-row",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      padding: '8px 12px',
      fontSize: 13
    },
    onClick: goPredict
  }, "返回综合解读"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    style: {
      padding: '8px 12px',
      fontSize: 13
    },
    onClick: () => onNavigate('archive', {
      caseId
    })
  }, "我的档案"))));
}

/* ---------- REQ-070：档案「分享帮填」落地页（/case/share/{token} 免登录代建档案，归发起者） ---------- */
// 访客打开发起者分享的一次性链接：GET /api/case/share/{token}（免登录；noAuth 强制不带
// Authorization）→ 展示「为 {owner_name} 填写档案」+ 与统一建档组件（OnboardingPage）同构的表单：
// 姓名（必填，即代建档案名）+ 出生年/月/日/时辰 + 性别 + 出生地（省市区级联，选到区县自动带经纬度）
// + 真太阳时 + 选填手机号/邮箱。POST /api/case/share/{token}/submit 代建档案（一次性，成功后后端
// 原子置 used 失效），成功 toast「已提交，档案归发起者」并停在成功态（不跳发起者档案列表）。
// 访客隔离：本页为独立表单页——全程 noAuth + App 访客会话置空，不展示/不可访问发起者任何既有档案
// 数据；链接不存在/已使用/已过期（404）统一渲染「分享链接不存在或已失效」。
function CaseSharePage({
  token,
  onNavigate
}) {
  const el = React.createElement;
  const C = UI_COPY.caseShareLanding;
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
  // BUG-009 加固：token 判空/去空白 —— 直接访问 /case/share 无 token、或 token 在路由/传参环节
  // 丢失时，立即按「缺少链接参数」渲染（见下方 !tk 分支），绝不发起 /case/share/undefined 之类请求。
  const tk = token && String(token).trim() ? String(token).trim() : '';
  const base = tk ? '/case/share/' + encodeURIComponent(tk) : null;
  // 表单默认值镜像统一建档组件：年份预置默认年，月/日留空由访客选择，时辰/性别带后端同款默认值
  const blankForm = () => ({
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
    phone: '',
    email: ''
  });
  const [meta, setMeta] = useState(null); // GET 返回 {owner_name, fields}（仅发起者昵称，无档案数据）
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState('');
  const [form, setForm] = useState(blankForm);
  const [coordTouched, setCoordTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false); // 提交成功 → 停在成功态，不回跳发起者档案列表
  const [err, setErr] = useState('');
  // —— 拉取落地页信息（GET /api/case/share/{token}，免登录；noAuth 强制不带 Authorization）——
  useEffect(() => {
    let alive = true;
    if (!tk) {
      setLoading(false);
      setErrored(C.invalid_no_token);
      return () => {
        alive = false;
      };
    }
    (async () => {
      setLoading(true);
      setErrored('');
      try {
        const res = await api(base, { noAuth: true });
        const d = res && res.data || res || {};
        if (!d || !d.owner_name) throw new Error(C.invalid_link);
        if (alive) setMeta({
          owner_name: d.owner_name
        });
      } catch (e) {
        // 404（不存在/已用/过期，后端不区分细节）→ 统一按「链接不存在或已失效」提示
        if (alive) setErrored(e && e.status === 404 ? C.invalid_link : (e && e.message ? e.message : C.load_fail));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tk]);
  // —— 表单联动（与 OnboardingPage 建档组件同构：原生 select 点击即填；出生地级联自动带经纬度）——
  const update = k => e => setForm(Object.assign({}, form, {
    [k]: e.target.value
  }));
  const updateProvince = e => {
    const p = e.target.value;
    const cs = p && reg[p] ? Object.keys(reg[p]) : [];
    const next = Object.assign({}, form, {
      birth_province: p,
      birth_city: '',
      birth_district: ''
    });
    if (cs.length === 1) next.birth_city = cs[0]; // 直辖市等单「市/市辖区」结构：市自动带出
    if (!coordTouched) {
      next.longitude = '';
      next.latitude = '';
    }
    setForm(next);
  };
  const updateCity = e => {
    const c = e.target.value;
    const next = Object.assign({}, form, {
      birth_city: c,
      birth_district: ''
    });
    if (!coordTouched) {
      next.longitude = '';
      next.latitude = '';
    }
    setForm(next);
  };
  const updateDistrict = e => {
    const d = e.target.value;
    const next = Object.assign({}, form, {
      birth_district: d
    });
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
    setForm(Object.assign({}, form, {
      [k]: e.target.value
    }));
  };
  const toggleSolar = e => setForm(Object.assign({}, form, {
    true_solar_time: e.target.checked
  }));
  // —— 提交代建（POST /api/case/share/{token}/submit，免登录；字段名与后端 CaseShareSubmitRequest 精确对齐）——
  const submitCase = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErr('');
    const y = +form.birth_year,
      m = +form.birth_month,
      d = +form.birth_day,
      h = +form.birth_hour;
    const nameRaw = String(form.name || '').trim();
    const phoneRaw = String(form.phone || '').trim();
    const emailRaw = String(form.email || '').trim();
    // 姓名必填（strip 后非空，与后端口径一致）
    if (!nameRaw) {
      setErr(C.name_required);
      setSubmitting(false);
      return;
    }
    if (!y || y < 1900 || y > 2100) {
      setErr(C.year_err);
      setSubmitting(false);
      return;
    }
    if (!m || m < 1 || m > 12) {
      setErr(C.month_err);
      setSubmitting(false);
      return;
    }
    if (!d || d < 1 || d > 31) {
      setErr(C.day_err);
      setSubmitting(false);
      return;
    }
    if (h < 0 || h > 23 || isNaN(h)) {
      setErr(C.hour_err);
      setSubmitting(false);
      return;
    }
    // 选填联系方式格式校验（与 REQ-065 / 建档同口径）
    if (phoneRaw && !/^\d{11}$/.test(phoneRaw)) {
      toast(C.phone_err);
      setSubmitting(false);
      return;
    }
    if (emailRaw && !/^[^\s@]+@[^\s@]+$/.test(emailRaw)) {
      toast(C.email_err);
      setSubmitting(false);
      return;
    }
    const birthplace = [form.birth_province, form.birth_city, form.birth_district].filter(Boolean).join('/');
    try {
      const res = await api(base + '/submit', {
        method: 'POST',
        noAuth: true,
        body: JSON.stringify({
          name: nameRaw,
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
          email: emailRaw || null
        })
      });
      const rd = res && res.data || res || {};
      if (!rd || !rd.caseId) throw new Error(C.submit_fail);
      toast(C.ok_toast); // 已提交，档案归发起者
      setDone(true); // 停在成功态（一次性链接后端已置 used，本页不再跳转发起者档案列表）
    } catch (e) {
      // 404：链接已被并发消费/过期 → 按「链接不存在或已失效」提示；其余透传后端/通用文案
      if (e && e.status === 404) toast(C.submit_link_dead); else toast(e && e.message ? e.message : C.submit_fail);
    } finally {
      setSubmitting(false);
    }
  };
  const handleSubmit = e => {
    e.preventDefault();
    submitCase();
  };
  let body;
  if (done) {
    // —— 成功态：提交后停留本页（不跳发起者档案列表）——
    body = el('div', { className: 'card', style: { textAlign: 'center', padding: '28px 18px' } },
      el('div', { className: 'section-title' }, C.ok_title),
      el('div', { style: { fontSize: 17, fontWeight: 700, color: 'var(--text-1)', margin: '10px 0 6px' } }, C.ok_toast),
      el('div', { style: { fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.7, margin: '0 0 16px' } }, C.ok_note),
      el('div', { className: 'back-row', style: { justifyContent: 'center' } },
        el('button', { className: 'btn btn-primary', style: { width: 'auto' }, onClick: () => onNavigate('landing') }, C.done_btn)));
  } else if (!tk) {
    // BUG-009 加固（渲染兜底）：token 为空/缺失 → 不等 effect、不闪 loading，直接渲染「无法打开分享」
    body = el('div', { className: 'card failed-box' },
      el('div', { className: 'section-title' }, C.invalid_title),
      el('div', { className: 'error' }, C.invalid_no_token),
      el('div', { className: 'back-row', style: { justifyContent: 'center' } },
        el('button', { className: 'btn btn-primary', style: { width: 'auto' }, onClick: () => onNavigate('landing') }, UI_COPY.buttons.back_home)));
  } else if (loading) {
    body = el('div', { className: 'card', style: { textAlign: 'center', color: 'var(--text-2)', padding: '28px 16px' } }, C.loading);
  } else if (errored) {
    // 404（不存在/已用/过期）→ 统一失败态
    body = el('div', { className: 'card failed-box' },
      el('div', { className: 'section-title' }, C.invalid_title),
      el('div', { className: 'error' }, errored),
      el('div', { className: 'back-row', style: { justifyContent: 'center' } },
        el('button', { className: 'btn btn-primary', style: { width: 'auto' }, onClick: () => onNavigate('landing') }, UI_COPY.buttons.back_home)));
  } else {
    // —— 免登录代填表单视图 ——
    const ownerName = meta && meta.owner_name ? meta.owner_name : '';
    const cityNames = form.birth_province && reg[form.birth_province] ? Object.keys(reg[form.birth_province]) : [];
    const districtNames = form.birth_province && form.birth_city && reg[form.birth_province] && reg[form.birth_province][form.birth_city] ? Object.keys(reg[form.birth_province][form.birth_city]) : [];
    body = el('div', { className: 'card' },
      el('h2', { className: 'title' }, C.fill_for.replace('{owner}', ownerName)),
      el('p', { style: { fontSize: 12.5, color: 'var(--text-2)', margin: '2px 0 12px', lineHeight: 1.7 } }, C.intro),
      err ? el('div', { className: 'error', style: { marginBottom: 12 } }, err) : null,
      el('form', { onSubmit: handleSubmit },
        el('label', { className: 'label', htmlFor: 'cs_name' }, C.name_label),
        el('input', { id: 'cs_name', className: 'input', type: 'text', maxLength: 128, value: form.name, onChange: update('name'), placeholder: C.name_ph, required: true }),
        el('label', { className: 'label', htmlFor: 'cs_year' }, C.year_label),
        el('select', { id: 'cs_year', className: 'input', value: form.birth_year, onChange: update('birth_year'), required: true },
          el('option', { value: '' }, C.select_ph),
          YEARS.map(v => el('option', { key: v, value: v }, v))),
        el('label', { className: 'label', htmlFor: 'cs_month' }, C.month_label),
        el('select', { id: 'cs_month', className: 'input', value: form.birth_month, onChange: update('birth_month'), required: true },
          el('option', { value: '' }, C.select_ph),
          MONTHS.map(v => el('option', { key: v, value: v }, v))),
        el('label', { className: 'label', htmlFor: 'cs_day' }, C.day_label),
        el('select', { id: 'cs_day', className: 'input', value: form.birth_day, onChange: update('birth_day'), required: true },
          el('option', { value: '' }, C.select_ph),
          DAYS.map(v => el('option', { key: v, value: v }, v))),
        el('label', { className: 'label', htmlFor: 'cs_hour' }, C.hour_label),
        el('select', { id: 'cs_hour', className: 'input', value: form.birth_hour, onChange: update('birth_hour') },
          HOURS.map(v => el('option', { key: v, value: v }, v))),
        el('label', { className: 'label', htmlFor: 'cs_gender' }, C.gender_label),
        el('select', { id: 'cs_gender', className: 'input', value: form.gender, onChange: update('gender') },
          el('option', { value: 'male' }, C.gender_male),
          el('option', { value: 'female' }, C.gender_female)),
        el('label', { className: 'label' }, C.birth_place_label),
        el('div', { className: 'field-row' },
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_province' }, C.province_label),
            el('select', { id: 'cs_province', className: 'input', value: form.birth_province, onChange: updateProvince },
              el('option', { value: '' }, C.select_ph),
              Object.keys(reg).map(p => el('option', { key: p, value: p }, p)))),
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_city' }, C.city_label),
            el('select', { id: 'cs_city', className: 'input', value: form.birth_city, onChange: updateCity, disabled: !form.birth_province },
              el('option', { value: '' }, C.select_ph),
              cityNames.map(c => el('option', { key: c, value: c }, c)))),
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_district' }, C.district_label),
            el('select', { id: 'cs_district', className: 'input', value: form.birth_district, onChange: updateDistrict, disabled: !form.birth_city },
              el('option', { value: '' }, C.select_ph),
              districtNames.map(x => el('option', { key: x, value: x }, x))))),
        el('div', { className: 'field-row' },
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_lng' }, C.lng_label),
            el('input', { id: 'cs_lng', className: 'input', type: 'number', step: '0.0001', value: form.longitude, onChange: updateCoord('longitude'), placeholder: C.lng_ph })),
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_lat' }, C.lat_label),
            el('input', { id: 'cs_lat', className: 'input', type: 'number', step: '0.0001', value: form.latitude, onChange: updateCoord('latitude'), placeholder: C.lat_ph }))),
        !coordTouched && form.longitude && form.latitude ? el('p', { className: 'coord-hint' }, C.coord_auto_note) : null,
        el('div', { className: 'field-row', style: { marginTop: 12 } },
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_phone' }, C.phone_label),
            el('input', { id: 'cs_phone', className: 'input', type: 'tel', inputMode: 'numeric', maxLength: 11, value: form.phone, onChange: update('phone'), placeholder: C.phone_ph })),
          el('div', null,
            el('label', { className: 'label', htmlFor: 'cs_email' }, C.email_label),
            el('input', { id: 'cs_email', className: 'input', type: 'email', value: form.email, onChange: update('email'), placeholder: C.email_ph }))),
        el('p', { style: { fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0', lineHeight: 1.5 } }, C.contact_note),
        el('div', { className: 'switch-row' },
          el('label', { className: 'switch' },
            el('input', { type: 'checkbox', id: 'cs_solar', checked: form.true_solar_time, onChange: toggleSolar }),
            el('span', { className: 'slider' })),
          el('label', { htmlFor: 'cs_solar', style: { fontSize: 13, color: 'var(--text-2)' } }, C.solar_label)),
        el('div', { className: 'field-row', style: { marginTop: 14 } },
          el('button', { className: 'btn btn-primary', type: 'submit', disabled: submitting, style: { flex: '1 1 auto' } }, submitting ? C.submitting : C.submit)),
        el('p', { style: { fontSize: 11.5, color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.7 } }, C.privacy_note),
        el('p', { style: { fontSize: 11.5, color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.7 } }, UI_COPY.landing.disclaimer_short)));
  }
  return el('div', { className: 'container' },
    el('div', { className: 'hub-title' }, el(Icon, { name: 'spark', size: 22 }), ' ' + C.hub_title),
    body);
}
