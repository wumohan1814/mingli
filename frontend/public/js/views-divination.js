// 占卜域视图（节110 阶段3）：临时起卦 DivinationPage + 六爻/梅花/小六壬/六壬/金口诀/奇门/文王圣卦 各结果视图与抽卡动画 + HEX_*/LIUQIN_*/LIUSHEN_*/TERMS_* 卦辞常量 + 起卦工具(pad2/todayStr/nowShichen/artFxEls/shuffleArr/yaosPartsOf 等)
// 加载于 views-cases.js 之后、主脚本之前；全局作用域，由 App pages 表按页名引用

/* ---------- 临时起卦 ---------- */
const DIVIN_METHODS = [{
  id: 'liuyao',
  name: UI_COPY.divination['method-liuyao'],
  desc: UI_COPY.divination['method-liuyao-desc'],
  group: 'yao',
  todo: false
}, {
  id: 'meihua',
  name: UI_COPY.divination['method-meihua'],
  desc: UI_COPY.divination['method-meihua-desc'],
  group: 'yao',
  todo: false
}, {
  id: 'xiaoliuren',
  name: UI_COPY.divination['method-xiaoliuren'],
  desc: UI_COPY.divination['method-xiaoliuren-desc'],
  group: 'su',
  todo: false
}, {
  id: 'sign',
  name: UI_COPY.divination['method-guanyin'],
  desc: UI_COPY.divination['method-guanyin-desc'],
  group: 'su',
  todo: false
}, {
  id: 'liuren',
  name: UI_COPY.divination['method-daliuren'],
  desc: UI_COPY.divination['method-daliuren-desc'],
  group: 'shi',
  todo: false
}, {
  id: 'jinkoujue',
  name: UI_COPY.divination['method-jinkoujue'],
  desc: UI_COPY.divination['method-jinkoujue-desc'],
  group: 'shi',
  todo: false
}, {
  id: 'qimen',
  name: UI_COPY.divination['method-qimen'],
  desc: UI_COPY.divination['method-qimen-desc'],
  group: 'shi',
  todo: false
}];

// REQ-126：起卦列表按起课类型 3 分区（摇卦报数 / 时辰起局 / 速断抽签），顺序与分组为已拍板口径
const DIVIN_GROUP_META = [{
  key: 'yao',
  title: TC_COPY.ui.hub['divin-group-yao']
}, {
  key: 'shi',
  title: TC_COPY.ui.hub['divin-group-shi']
}, {
  key: 'su',
  title: TC_COPY.ui.hub['divin-group-su']
}];

const DIVIN_API_METHOD = { sign: 'ssgw' };
const YAO_LABEL = ['初', '二', '三', '四', '五', '上'];
/* REQ-055：梅花/小六壬 时间选项（12 时辰，date 默认今天、时辰默认当前） */
const SHICHEN_ARR = [
  { n: '子', start: 23, range: '23:00–00:59' },
  { n: '丑', start: 1, range: '01:00–02:59' },
  { n: '寅', start: 3, range: '03:00–04:59' },
  { n: '卯', start: 5, range: '05:00–06:59' },
  { n: '辰', start: 7, range: '07:00–08:59' },
  { n: '巳', start: 9, range: '09:00–10:59' },
  { n: '午', start: 11, range: '11:00–12:59' },
  { n: '未', start: 13, range: '13:00–14:59' },
  { n: '申', start: 15, range: '15:00–16:59' },
  { n: '酉', start: 17, range: '17:00–18:59' },
  { n: '戌', start: 19, range: '19:00–20:59' },
  { n: '亥', start: 21, range: '21:00–22:59' }
];
const TIME_METHODS = { meihua: true, xiaoliuren: true, liuren: true, jinkoujue: true, qimen: true };
/* REQ-118：大六壬断课模板（对齐 vendored mingyu-core LiurenTemplateType：
   general 通用 / ganqing 感情 / shiye 事业 / caifu 财富；仅影响断课侧重点） */
const LIUREN_TEMPLATES = [
  { key: 'general', label: '通用' },
  { key: 'ganqing', label: '感情' },
  { key: 'shiye', label: '事业' },
  { key: 'caifu', label: '财富' }
];
/* REQ-119：金口诀起课方式（对齐 vendored mingyu-core JINKOUJUE_METHOD_OPTIONS：
   time 时间起课 / branch 指定地分 / number 数字起课 / random 随机起课） */
const JINKOUJUE_METHODS = [
  { key: 'time', label: '时间起课' },
  { key: 'branch', label: '指定地分' },
  { key: 'number', label: '数字起课' },
  { key: 'random', label: '随机起课' }
];
/* REQ-120：奇门时家起局参数（对齐 vendored mingyu-core QimenScope / QimenMethod / QimenJuMethod）：
   起局级别四选一（hour 时家默认 / day 日家 / month 月家 / year 年家）；
   排盘方法二选一（zhuanpan 转盘默认 / feipan 飞盘）；
   定局方法二选一（chaibu 拆补默认 / zhirun 置闰，仅时家/日家生效，月家/年家固定用月家/年家定局法） */
const QIMEN_SCOPES = [
  { key: 'hour', label: '时家', hint: '以时辰定局，精确到时辰' },
  { key: 'day', label: '日家', hint: '以日干支定局，看一日大势' },
  { key: 'month', label: '月家', hint: '以月干支定局，看一月运势' },
  { key: 'year', label: '年家', hint: '以年干支定局，看一年大势' }
];
const QIMEN_METHODS = [
  { key: 'zhuanpan', label: '转盘', hint: '主流口径：九星八门整体旋转' },
  { key: 'feipan', label: '飞盘', hint: '备选口径：九星沿洛书飞布' }
];
const QIMEN_JU_METHODS = [
  { key: 'chaibu', label: '拆补', hint: '以节气为界，当代主流定局法' },
  { key: 'zhirun', label: '置闰', hint: '累计超神置闰的定局法' }
];
const QIMEN_SCOPE_CN = { hour: UI_COPY.divination['qm-scope-hour'], day: UI_COPY.divination['qm-scope-day'], month: UI_COPY.divination['qm-scope-month'], year: UI_COPY.divination['qm-scope-year'] };
const QIMEN_METHOD_CN = { zhuanpan: UI_COPY.divination['qm-method-zhuanpan'], feipan: UI_COPY.divination['qm-method-feipan'] };
const QIMEN_JU_CN = { chaibu: UI_COPY.divination['qm-ju-chaibu'], zhirun: UI_COPY.divination['qm-ju-zhirun'] };
const pad2 = function (x) { return String(x).padStart(2, '0'); };
const todayStr = function () { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
/* 当前小时 → 时辰下标（23:00/00:00 均为子时），时辰起始小时即该时辰内任一可解析时刻 */
const nowShichen = function () { return Math.floor((new Date().getHours() + 1) / 2) % 12; };
function yaoView(v) {
  const n = typeof v === 'number' ? v : null;
  const s = String(v);
  if (n === 9 || s === UI_COPY.divination['ly-old-yang']) return { name: UI_COPY.divination['ly-old-yang'], cls: 'old-yang', moving: true };
  if (n === 6 || s === UI_COPY.divination['ly-old-yin']) return { name: UI_COPY.divination['ly-old-yin'], cls: 'old-yin', moving: true };
  if (n === 8 || s === UI_COPY.divination['ly-shao-yin'] || s === UI_COPY.divination['ly-yin']) return { name: UI_COPY.divination['ly-shao-yin'], cls: 'yin', moving: false };
  if (n === 7 || s === UI_COPY.divination['ly-shao-yang'] || s === UI_COPY.divination['ly-yang']) return { name: UI_COPY.divination['ly-shao-yang'], cls: '', moving: false };
  return { name: s || UI_COPY.divination['ly-yao'], cls: '', moving: /老|动/.test(s) };
}
/* REQ-055：六爻整齐列表 —— 爻位|爻线|六亲|纳甲|世应|阴阳(动)|六神 固定分列对齐 */
function wrCellAt(wrArr, i) {
  if (!wrArr) return '';
  // 兼容旧结果：worldAndResponse = [世爻位, 应爻位] 的数字数组（需先于通用字符串分支判断）
  if (wrArr.length === 2 && typeof wrArr[0] === 'number' && typeof wrArr[1] === 'number') {
    if (i + 1 === wrArr[0]) return UI_COPY.divination['ly-shi'];
    if (i + 1 === wrArr[1]) return UI_COPY.divination['ly-ying'];
    return '';
  }
  const v = wrArr[i];
  if (v != null && v !== '') return String(v);
  return '';
}
function DivLiuyaoView(res) {
  const changing = {};
  (Array.isArray(res.changingYaos) ? res.changingYaos : []).forEach(function (y) {
    if (y && y.position != null) changing[y.position] = true;
  });
  const arr = Array.isArray(res.yaoArray) ? res.yaoArray : null;
  const oldLines = Array.isArray(res.lines) ? res.lines : null;
  // BUG-004: 后端增强字段（可能缺失或长度不足，需判空容错）
  const sixRel = Array.isArray(res.sixRelatives) ? res.sixRelatives : null;
  const najia = Array.isArray(res.najiaDizhi) ? res.najiaDizhi : null;
  const sGods = Array.isArray(res.sixGods) ? res.sixGods : null;
  const wAndR = Array.isArray(res.worldAndResponse) ? res.worldAndResponse : null;
  const src = arr || oldLines;
  const rowEls = [];
  if (src) {
    const n = Math.min(src.length, 6);
    for (let i = 0; i < n; i++) {
      const raw = arr ? src[i] : (Array.isArray(src[i]) ? src[i][0] : src[i]);
      const info = yaoView(raw);
      const mv = changing[i + 1] || info.moving;
      const sr = sixRel && sixRel[i] != null ? String(sixRel[i]) : '';
      const nj = najia && najia[i] != null ? String(najia[i]) : '';
      const sg = sGods && sGods[i] != null ? String(sGods[i]) : '';
      const wr = wrCellAt(wAndR, i);
      const cells = [];
      // 列序：爻位 | 爻线(阴阳符号) | 六亲 | 纳甲地支 | 世/应 | 阴阳名(含动爻标记) | 六神
      cells.push(React.createElement('span', { key: 'pos', className: 'c c-pos' }, YAO_LABEL[i] + UI_COPY.divination['ly-yao']));
      cells.push(React.createElement('span', { key: 'bar', className: 'yao-bar c-bar ' + info.cls }));
      cells.push(React.createElement('span', { key: 'rel', className: 'c c-rel' }, sr));
      cells.push(React.createElement('span', { key: 'nj', className: 'c c-nj' }, nj));
      cells.push(React.createElement('span', { key: 'wr', className: 'c c-wr' }, wr ? React.createElement('span', { className: 'wr-badge' }, wr) : null));
      cells.push(React.createElement('span', { key: 'name', className: 'c-name' }, info.name, mv ? React.createElement('span', { key: 'mvb', className: 'mv-badge' }, '动') : null));
      cells.push(React.createElement('span', { key: 'god', className: 'c c-god' }, sg));
      rowEls.push(React.createElement('div', { key: i, className: 'ly-row' + (mv ? ' moving' : '') }, cells));
    }
  }
  let grid = null;
  if (rowEls.length) {
    const head = [UI_COPY.divination['ly-th-yaowei'], UI_COPY.divination['ly-th-yaoxiang'], UI_COPY.divination['ly-th-liuqin'], UI_COPY.divination['ly-th-najia'], UI_COPY.divination['ly-th-shiying'], UI_COPY.divination['ly-th-yinyang'], UI_COPY.divination['ly-th-liushen']].map(function (h, i) {
      return React.createElement('span', { key: i, className: 'c' }, h);
    });
    grid = React.createElement('div', { className: 'ly-wrap' },
      React.createElement('div', { className: 'ly-grid' },
        React.createElement('div', { className: 'ly-head' }, head),
        rowEls));
  }
  const nameText = res.originalName ? (res.originalName + (res.changedName ? ' 之 ' + res.changedName : '') + (res.interName && !res.changedName ? '（互卦 ' + res.interName + '）' : '')) : (res.name || '');
  const palaceText = res.palace ? ((res.palace.name || '') + (res.palace.wuxing ? '（' + res.palace.wuxing + '）' : '') + (res.palaceStage ? ' · ' + res.palaceStage : '')) : (res.palaceStage || '');
  const ganzhiText = res.ganzhi ? [res.ganzhi.year, res.ganzhi.month, res.ganzhi.day, res.ganzhi.hour].filter(Boolean).join(' ') : '';
  const meta = [];
  if (palaceText) meta.push(React.createElement('div', { key: 'p' }, UI_COPY.divination['ly-gongwei'] + palaceText));
  if (ganzhiText) meta.push(React.createElement('div', { key: 'g' }, UI_COPY.divination['ly-ganzhi'] + ganzhiText));
  return React.createElement('div', null,
    grid,
    nameText ? React.createElement('div', { style: { fontWeight: 700, marginTop: grid ? 8 : 0 } }, nameText) : null,
    meta.length ? React.createElement('div', { style: { marginTop: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 } }, meta) : null);
}
function DivMeihuaView(res) {
  const gua = function (g) { return g && g.name ? g.name + (g.element ? '（' + g.element + '）' : '') : ''; };
  const sym = function (h) { return h && h.symbol ? h.symbol : ''; };
  const parts = [];
  if (res.originalName) parts.push(UI_COPY.divination['ly-ben-gua'] + res.originalName + (sym(res.mainHexagram) ? ' ' + sym(res.mainHexagram) : ''));
  if (res.interName) parts.push(UI_COPY.divination['ly-hu-gua'] + res.interName + (sym(res.interHexagram) ? ' ' + sym(res.interHexagram) : ''));
  if (res.changedName && res.changedName !== res.originalName) parts.push(UI_COPY.divination['ly-bian-gua'] + res.changedName + (sym(res.changedHexagram) ? ' ' + sym(res.changedHexagram) : ''));
  const items = [];
  if (parts.length) items.push(React.createElement('div', { key: 'head', style: { fontWeight: 700, lineHeight: 1.8 } }, parts.join(' · ')));
  // REQ-055 ③：本卦爻列（类六爻：爻位|爻象|阴阳(含动)|体用），其余卦以卦名+卦符展示
  const rowEls = [];
  if (Array.isArray(res.yaosDetail) && res.yaosDetail.length) {
    const ys = res.yaosDetail.slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    for (let i = 0; i < Math.min(ys.length, 6); i++) {
      const y = ys[i] || {};
      const pos = y.position != null ? y.position : (i + 1);
      const moving = Boolean(y.isChanging);
      const yang = y.yaoType === UI_COPY.divination['ly-yang'];
      const ty = String(y.tiYong || '');
      const barCls = moving ? (yang ? 'old-yang' : 'old-yin') : (yang ? '' : 'yin');
      const cells = [];
      cells.push(React.createElement('span', { key: 'p', className: 'c c-pos' }, YAO_LABEL[pos - 1] + UI_COPY.divination['ly-yao']));
      cells.push(React.createElement('span', { key: 'b', className: 'yao-bar c-bar ' + barCls }));
      cells.push(React.createElement('span', { key: 'n', className: 'c-name' }, yang ? UI_COPY.divination['ly-yang'] : UI_COPY.divination['ly-yin'], moving ? React.createElement('span', { key: 'm', className: 'mv-badge' }, '动') : null));
      cells.push(React.createElement('span', { key: 't', className: 'c' }, ty ? React.createElement('span', { className: 'ty-badge ' + (ty === '体' ? 'ti' : 'yong') }, ty) : null));
      rowEls.push(React.createElement('div', { key: pos, className: 'mh-row' }, cells));
    }
  }
  if (rowEls.length) {
    const head = [UI_COPY.divination['ly-th-yaowei'], UI_COPY.divination['ly-th-yaoxiang'], UI_COPY.divination['ly-th-yinyang'], '体用'].map(function (h, i) { return React.createElement('span', { key: i, className: 'c' }, h); });
    items.push(React.createElement('div', { key: 'gua', className: 'mh-gua' },
      React.createElement('div', { className: 'mh-gua-t' }, UI_COPY.divination['ly-ben-gua-yaoxiang']),
      React.createElement('div', { className: 'mh-wrap' },
        React.createElement('div', { className: 'mh-grid' },
          React.createElement('div', { className: 'mh-head' }, head),
          rowEls))));
  }
  const detail = [];
  const ti = res.tiGua || {};
  const yo = res.yongGua || {};
  if (ti.name || yo.name) detail.push('体卦 ' + gua(res.tiGua) + (yo.name ? ' · 用卦 ' + gua(res.yongGua) : ''));
  const mv = res.movingYao || {};
  if (mv.description || mv.yaoName || mv.position) detail.push(UI_COPY.divination['ly-dong-yao'] + (mv.description || '第' + mv.position + '爻动'));
  const an = res.analysis || {};
  if (an.tiYongRelation) detail.push(UI_COPY.divination['ly-ti-yong-rel'] + an.tiYongRelation + (an.tiYongSeasonEvaluation ? '；' + an.tiYongSeasonEvaluation : ''));
  if (an.timelineTrend && an.timelineTrend.summary) detail.push(UI_COPY.divination['ly-jieduan-qushi'] + (an.timelineTrend.trend ? an.timelineTrend.trend + '。' : '') + an.timelineTrend.summary);
  if (res.up || res.down || res.dong) detail.push('上卦 ' + res.up + ' · 下卦 ' + res.down + ' · 动爻 ' + res.dong);
  detail.forEach(function (t, i) {
    items.push(React.createElement('div', { key: 'd' + i, style: { marginTop: 6, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 } }, t));
  });
  const meta = [];
  const gz = res.ganzhi;
  if (gz) {
    const gzText = [gz.year, gz.month, gz.day, gz.hour].filter(Boolean).join(' ');
    if (gzText) meta.push(UI_COPY.divination['ly-ganzhi'] + gzText);
  }
  const calc = res.calculation || {};
  if (calc.method || calc.methodKey) meta.push(UI_COPY.divination['ly-qi-gua'] + (calc.method || calc.methodKey));
  if (meta.length) items.push(React.createElement('div', { key: 'meta', style: { marginTop: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 } }, meta.join(' · ')));
  return React.createElement('div', null, items);
}
function DivXiaoliurenView(res) {
  const primary = res.primary || {};
  const point = primary.name || res.point || '？';
  const seq = res.sequence || {};
  const seqNames = [seq.month, seq.day, seq.hour].map(function (p) { return p && p.name ? p.name : ''; }).filter(Boolean);
  const items = [];
  items.push(React.createElement('div', { key: 'disk', className: 'palm-disk' }, React.createElement('span', { className: 'pd-point hit' }, point)));
  if (seqNames.length) items.push(React.createElement('div', { key: 'seq', style: { textAlign: 'center', fontSize: 13, color: 'var(--text-2)', marginBottom: 4 } }, '月 ' + seqNames[0] + (seqNames[1] ? ' → 日 ' + seqNames[1] : '') + (seqNames[2] ? ' → 时 ' + seqNames[2] : '')));
  const meta = [];
  if (res.methodLabel) meta.push(res.methodLabel);
  if (res.hourLabel) meta.push(UI_COPY.divination['ly-shichen'] + res.hourLabel);
  if (res.lunarMonth) meta.push(UI_COPY.divination['ly-nongli'] + res.lunarMonth + '月' + (res.lunarDay != null ? res.lunarDay + '日' : ''));
  if (meta.length) items.push(React.createElement('div', { key: 'meta', style: { textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 2 } }, meta.join(' · ')));
  if (primary.verse) items.push(React.createElement('div', { key: 'verse', style: { marginTop: 10, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 } }, primary.verse));
  return React.createElement('div', null, items);
}
/* REQ-118：大六壬课盘 —— 天地盘（12 位）+ 四课三传 + 课体/类神/天将/神煞/应期（确定性免费展示） */
function DivLiurenView(res) {
  const items = [];
  const gz = (res && typeof res === 'object' && res.ganzhi) || {};
  const meta = [];
  if (gz.year) meta.push([gz.year, gz.month, gz.day, gz.hour].filter(Boolean).join(' '));
  if (res.monthLeader) meta.push(UI_COPY.divination['dlr-yuejiang'] + res.monthLeader);
  if (res.divinationBranch) meta.push(UI_COPY.divination['dlr-zhanshi'] + res.divinationBranch);
  if (res.dayNight) meta.push(res.dayNight);
  if (res.xunKong && res.xunKong.length) meta.push(UI_COPY.divination['dlr-xunkong'] + res.xunKong.join('、'));
  if (res.noblemanBranch) meta.push(UI_COPY.divination['dlr-guiren'] + res.noblemanBranch + (res.noblemanGroundBranch ? '（临' + res.noblemanGroundBranch + '）' : ''));
  if (res.dayStemResidence) meta.push(UI_COPY.divination['dlr-rijiji'] + res.dayStemResidence);
  if (meta.length) items.push(React.createElement('div', { key: 'meta', className: 'lr-meta' }, meta.join(' · ')));

  // 天地盘 12 位（天将 / 天盘支 / 所临地盘支）
  const plate = Array.isArray(res.heavenlyPlate) ? res.heavenlyPlate : [];
  if (plate.length) {
    const plateEls = plate.map(function (p, i) {
      return React.createElement('div', { key: i, className: 'lr-plate-cell' },
        React.createElement('span', { className: 'lpc-god' }, p.god || ''),
        React.createElement('span', { className: 'lpc-tian' }, p.branch || ''),
        React.createElement('span', { className: 'lpc-di' }, UI_COPY.divination['dlr-lin'] + (p.under || '')));
    });
    items.push(React.createElement('div', { key: 'plate-h', className: 'lr-sec' }, UI_COPY.divination['dlr-tiandipan']),
      React.createElement('div', { key: 'plate', className: 'lr-plate' }, plateEls),
      React.createElement('div', { key: 'plate-note', className: 'lr-note' }, UI_COPY.divination['dlr-tiandipan-note']));
  }

  // 四课
  const lessons = Array.isArray(res.fourLessons) ? res.fourLessons : [];
  if (lessons.length) {
    const lessonEls = lessons.map(function (l) {
      return React.createElement('div', { key: l.name || 'x', className: 'lr-lesson' },
        React.createElement('div', { className: 'lrl-name' }, l.name || ''),
        React.createElement('div', { className: 'lrl-row' }, React.createElement('span', { className: 'lrl-cap' }, UI_COPY.divination['dlr-shangshen']), React.createElement('b', null, l.upper || '')),
        React.createElement('div', { className: 'lrl-row' }, React.createElement('span', { className: 'lrl-cap' }, UI_COPY.divination['dlr-xiawei']), React.createElement('b', null, l.lower || '')),
        React.createElement('div', { className: 'lrl-row' }, React.createElement('span', { className: 'lrl-cap' }, UI_COPY.divination['dlr-tianjiang-sec']), React.createElement('b', null, l.god || '')),
        React.createElement('div', { className: 'lrl-rel' }, UI_COPY.divination['dlr-guanxi'] + (l.relation || '')));
    });
    items.push(React.createElement('div', { key: 'l4-h', className: 'lr-sec' }, UI_COPY.divination['dlr-sike']),
      React.createElement('div', { key: 'l4', className: 'lr-lessons' }, lessonEls));
  }

  // 三传（初传 → 中传 → 末传）
  const trans = Array.isArray(res.threeTransmissions) ? res.threeTransmissions : [];
  if (trans.length) {
    const transEls = trans.map(function (t, i) {
      const kid = [
        React.createElement('div', { key: 'stage', className: 'lrt-stage' }, t.stage || ''),
        React.createElement('div', { key: 'main', className: 'lrt-main' }, t.branch || ''),
        React.createElement('div', { key: 'god', className: 'lrt-god' }, UI_COPY.divination['dlr-cheng'] + (t.god || '')),
        React.createElement('div', { key: 'sub', className: 'lrt-sub' },
          [t.wuxing ? t.wuxing : '', t.seasonState ? t.seasonState : '', t.relation ? t.relation : ''].filter(Boolean).join(' · ')),
        (t.isVoid ? React.createElement('div', { key: 'void', className: 'lrt-note' }, React.createElement('span', { className: 'lr-badge' }, UI_COPY.divination['qm-kongwang'])) : null)
      ];
      if (t.dayRelation) kid.push(React.createElement('div', { key: 'dr', className: 'lrt-note' }, UI_COPY.divination['dlr-yuerizhi'] + t.dayRelation));
      return React.createElement('div', { key: t.stage || i, className: 'lr-trans' + (i < trans.length - 1 ? ' with-arrow' : '') }, kid);
    });
    const transHead = (res.transmissionRule || '') + ((res.transmissionRule && res.transmissionPattern) ? ' · ' : '') + (res.transmissionPattern || '');
    items.push(React.createElement('div', { key: 't3-h', className: 'lr-sec' }, UI_COPY.divination['dlr-sanzhuan'] + (transHead ? '（' + transHead + '）' : '')),
      React.createElement('div', { key: 't3', className: 'lr-trans-row' }, transEls));
    if (res.transmissionDetail) items.push(React.createElement('div', { key: 't3d', className: 'lr-rule' }, res.transmissionDetail));
  }

  // 课体（guaTi / patternTags）
  const guaTi = Array.isArray(res.guaTi) ? res.guaTi : [];
  const pTags = Array.isArray(res.patternTags) ? res.patternTags : [];
  if (guaTi.length || pTags.length) {
    const tags = [].concat(pTags, guaTi).filter(function (v, i, arr) { return v && arr.indexOf(v) === i; });
    items.push(React.createElement('div', { key: 'gt-h', className: 'lr-sec' }, UI_COPY.divination['dlr-keti']),
      React.createElement(TCTermRow, { key: 'gt', method: 'liuren', items: tags, chipClass: 'lr-tag' }));
    const rules = Array.isArray(res.classicalRules) ? res.classicalRules : [];
    if (rules.length) {
      const ruleEls = rules.map(function (r, i) {
        return React.createElement('li', { key: i },
          (r.source ? '【' + r.source + '】' : '') + (r.rule ? r.rule + '：' : '') + (r.summary || ''));
      });
      items.push(React.createElement('div', { key: 'rules', className: 'lr-sec' }, UI_COPY.divination['dlr-guji-yiju']),
        React.createElement('ul', { key: 'rules-l', className: 'lr-list' }, ruleEls));
    }
  }

  // 类神（focusEvidence：主证/辅证）
  const focus = Array.isArray(res.focusEvidence) ? res.focusEvidence : [];
  if (focus.length) {
    const focusEls = focus.map(function (f, i) {
      const lv = f.level === UI_COPY.divination['dlr-zhuzheng'] ? 'master' : 'assist';
      const evLines = Array.isArray(f.evidence) ? f.evidence : [];
      const lim = Array.isArray(f.limitations) ? f.limitations : [];
      const dParts = [];
      if (evLines.length) dParts.push(evLines.join('；'));
      if (lim.length) dParts.push(UI_COPY.divination['dlr-xianzhi'] + lim.join('；'));
      return React.createElement('div', { key: i, className: 'lr-ev' },
        React.createElement('span', { className: 'lr-ev-lv ' + lv }, f.level || ''),
        React.createElement('div', { className: 'lr-ev-body' },
          React.createElement('div', { className: 'lr-ev-t' }, (f.target || '') + (f.role ? '（' + f.role + '）' : '')),
          dParts.length ? React.createElement('div', { className: 'lr-ev-d' }, dParts.join('\n')) : null));
    });
    items.push(React.createElement('div', { key: 'fc-h', className: 'lr-sec' }, UI_COPY.divination['dlr-leishen']),
      React.createElement('div', { key: 'fc', className: 'lr-ev-wrap' }, focusEls));
  }

  // 天将属性（入传天将）
  const tjp = (res && typeof res === 'object' && res.tianJiangProps) || {};
  const tjpKeys = Object.keys(tjp);
  if (tjpKeys.length) {
    const tjpText = function (k) {
      const v = tjp[k] || {};
      const line = [v.wuxing ? v.wuxing : '', v.yinYang ? v.yinYang : '', v.category ? v.category : ''].filter(Boolean).join(' · ');
      return k + (line ? '：' + line : '') + (v.description ? '（' + v.description + '）' : '');
    };
    items.push(React.createElement('div', { key: 'tj-h', className: 'lr-sec' }, UI_COPY.divination['dlr-tianjiang-sec']),
      React.createElement(TCTermRow, { key: 'tj', method: 'liuren', items: tjpKeys, chipClass: 'lr-tag', matchOf: function (k) { return k; }, textOf: tjpText }));
  }

  // 神煞
  const ss = Array.isArray(res.shenShaSummary) ? res.shenShaSummary : [];
  if (ss.length) {
    items.push(React.createElement('div', { key: 'ss-h', className: 'lr-sec' }, UI_COPY.divination['dlr-shensha']),
      React.createElement(TCTermRow, { key: 'ss', method: 'liuren', items: ss, chipClass: 'lr-tag' }),
      React.createElement('div', { key: 'ss-n', className: 'lr-note' }, UI_COPY.divination['dlr-shensha-note']));
  }

  // 应期参考
  const timing = Array.isArray(res.timingEvidence) ? res.timingEvidence : [];
  if (timing.length) {
    items.push(React.createElement('div', { key: 'tm-h', className: 'lr-sec' }, UI_COPY.divination['dlr-yingqi']),
      React.createElement('ul', { key: 'tm', className: 'lr-list' },
        timing.map(function (t, i) { return React.createElement('li', { key: i }, t); })));
  }

  return React.createElement('div', null, items);
}
/* REQ-119：金口诀课盘 —— 四位一体（人元/贵神/将神/地分）+ 阴阳发用 + 五动三动
   + 四位生克 + 比合歌诀 + 古籍依据（calculation/focusEvidence，确定性免费展示） */
function DivJinkoujueView(res) {
  const items = [];
  const gz = (res && typeof res === 'object' && res.ganzhi) || {};
  const meta = [];
  if (gz.year) meta.push([gz.year, gz.month, gz.day, gz.hour].filter(Boolean).join(' '));
  if (res.methodLabel) meta.push(res.methodLabel);
  if (res.monthLeader) meta.push(UI_COPY.divination['dlr-yuejiang'] + res.monthLeader);
  if (res.divinationBranch) meta.push(UI_COPY.divination['dlr-zhanshi'] + res.divinationBranch);
  if (res.dayNight) meta.push(res.dayNight);
  if (res.noblemanBranch) meta.push(UI_COPY.divination['dlr-guiren'] + res.noblemanBranch);
  if (res.xunKong && res.xunKong.length) meta.push(UI_COPY.divination['dlr-xunkong'] + res.xunKong.join('、'));
  if (meta.length) items.push(React.createElement('div', { key: 'meta', className: 'jk-meta' }, meta.join(' · ')));

  // 四位一体（自上而下：人元 → 贵神 → 将神 → 地分）
  const pos = (res && typeof res === 'object' && res.positions) || {};
  const posOrder = ['renYuan', 'guiShen', 'jiangShen', 'diFen'];
  const posName = { renYuan: UI_COPY.divination['jk-renyuan'], guiShen: UI_COPY.divination['jk-guishen'], jiangShen: UI_COPY.divination['jk-jiangshen'], diFen: UI_COPY.divination['jk-difen'] };
  const rows = [];
  posOrder.forEach(function (k) {
    const p = pos[k];
    if (!p) return;
    const subBits = [];
    if (p.elementBasis) subBits.push(p.elementBasis);
    if (p.element) subBits.push(p.element + (p.yinYang || ''));
    if (p.seasonState) subBits.push(UI_COPY.divination['jk-yueling'] + p.seasonState);
    rows.push(React.createElement('div', { key: k, className: 'jk-four-row' },
      React.createElement('span', { className: 'jkf-name' }, posName[k]),
      React.createElement('span', { className: 'jkf-main' }, (p.stem || '') + (p.branch || '')),
      p.god ? React.createElement('span', { className: 'jkf-god' }, UI_COPY.divination['dlr-cheng'] + p.god) : null,
      React.createElement('span', { className: 'jkf-sub' },
        React.createElement('span', null, subBits.join(' · ')),
        p.isVoid ? React.createElement('span', { className: 'jkf-void' }, UI_COPY.divination['jk-xunkong']) : null)));
  });
  // REQ-128：四位一体渲染出的名词（位置名 + 贵神名）供内嵌白话卡标签
  const jkNounNames = [];
  posOrder.forEach(function (k) {
    const p = pos[k];
    if (!p) return;
    jkNounNames.push(posName[k]);
    if (p.god) jkNounNames.push(p.god);
  });
  if (rows.length) {
    items.push(React.createElement('div', { key: 'four-h', className: 'jk-sec' }, UI_COPY.divination['jk-siwei']),
      React.createElement('div', { key: 'four', className: 'jk-four' }, rows),
      React.createElement(TCTermRow, { key: 'four-tc', method: 'jinkoujue', items: jkNounNames, chipClass: 'jk-tag' }));
  }

  // 阴阳发用
  const yy = (res && typeof res === 'object' && res.yinYangUse) || {};
  if (yy.pattern) {
    const yyBits = [yy.pattern + '（' + (yy.yangCount != null ? yy.yangCount : '') + UI_COPY.divination['ly-yang'] + (yy.yinCount != null ? yy.yinCount : '') + '阴）'];
    if (yy.rule) yyBits.push(yy.rule);
    if (yy.usePosition) yyBits.push('取「' + yy.usePosition + '」为用');
    if (yy.isVoid) yyBits.push('发用旬空');
    items.push(React.createElement('div', { key: 'yy-h', className: 'jk-sec' }, UI_COPY.divination['jk-yinyang-fayong']),
      React.createElement('div', { key: 'yy', className: 'jk-rule' }, yyBits.join('；')),
      React.createElement('div', { key: 'yy-n', className: 'jk-note' }, '发用位为断事主轴：三阴一阳取唯一阴位、三阳一阴取唯一阳位、二阴二阳以旺相者取用、纯阴/纯阳按次第取用。'));
  }

  // 五动三动
  const mv = Array.isArray(res.movements) ? res.movements : [];
  if (mv.length) {
    const mvEls = mv.map(function (m2, i) {
      return React.createElement('div', { key: i, className: 'jk-mv' },
        React.createElement('span', { className: 'jkm-cat ' + (m2.category === '五动' ? 'wu' : 'san') }, m2.category || ''),
        React.createElement('div', { className: 'jkm-body' },
          React.createElement('div', { className: 'jkm-t' }, (m2.name || '') + (m2.from && m2.to ? '（' + m2.from + '→' + m2.to + '）' : '')),
          React.createElement('div', { className: 'jkm-d' }, [m2.trigger, m2.relation ? '关系' + m2.relation : '', m2.source].filter(Boolean).join(' · '))));
    });
    items.push(React.createElement('div', { key: 'mv-h', className: 'jk-sec' }, UI_COPY.divination['jk-wudong-sandong']),
      React.createElement('div', { key: 'mv', className: 'jk-mv-wrap' }, mvEls),
      React.createElement(TCTermRow, { key: 'mv-tc', method: 'jinkoujue', items: mv.map(function (m2) { return m2.name; }).filter(Boolean), chipClass: 'jk-tag' }),
      React.createElement('div', { key: 'mv-n', className: 'jk-note' }, '动名须结合所问与用位综合体会，不按动名直接定现实结果。'));
  }

  // 四位生克
  const rel = (res && typeof res === 'object' && res.relations) || {};
  const relKeys = [['guiToJiang', '贵神→将神'], ['guiToRen', '贵神→人元'], ['jiangToDi', '将神→地分'], ['renToDi', '人元→地分'], ['guiToDi', '贵神→地分']];
  const relBits = relKeys.filter(function (rk) { return rel[rk[0]]; }).map(function (rk) { return rk[1] + rel[rk[0]]; });
  if (relBits.length) {
    items.push(React.createElement('div', { key: 'rel-h', className: 'jk-sec' }, UI_COPY.divination['jk-siwei-shengke']),
      React.createElement('div', { key: 'rel', className: 'jk-tags' }, relBits.map(function (b, i) { return React.createElement('span', { key: i, className: 'jk-tag' }, b); })),
      React.createElement('div', { key: 'rel-n', className: 'jk-note' }, '生克只表盘内作用方向，不直接写成现实顺利/受阻。'));
  }

  // 比合歌诀（二木为爻 / 二火为灾 / 二土为滞 / 二金为刑 / 二水为盗）
  if (res.bihePoem) {
    items.push(React.createElement('div', { key: 'bh-h', className: 'jk-sec' }, UI_COPY.divination['jk-bihe-gejue']),
      React.createElement('div', { key: 'bh', className: 'jk-rule' }, res.bihePoem),
      React.createElement('div', { key: 'bh-n', className: 'jk-note' }, '歌诀为四位五行比合气质的概括性提示（二木为爻、二火为灾、二土为滞、二金为刑、二水为盗），只作辅助取象。'));
  }

  // 古籍依据：起课计算规则（《六壬神课金口诀古本》）
  const calc = (res && typeof res === 'object' && res.calculation) || {};
  const calcBits = [calc.diFenNote, calc.monthLeaderRule, calc.yuanDunRule, calc.dayNightRule, calc.noblemanRule, calc.guiShenRule].filter(Boolean);
  if (calcBits.length) {
    items.push(React.createElement('div', { key: 'calc-h', className: 'jk-sec' }, UI_COPY.divination['jk-qike-yiju']),
      React.createElement('ul', { key: 'calc', className: 'jk-list' },
        calcBits.map(function (b, i) { return React.createElement('li', { key: i }, b); })),
      React.createElement('div', { key: 'calc-n', className: 'jk-note' }, '依据《六壬神课金口诀古本》（入式歌解 / 贵神起例 / 五子元遁起例 / 阴阳次第五用）。'));
  }

  // 类神标定（focusEvidence 主证/辅证）
  const focus = Array.isArray(res.focusEvidence) ? res.focusEvidence : [];
  if (focus.length) {
    const focusEls = focus.map(function (f, i) {
      const lv = f.level === UI_COPY.divination['dlr-zhuzheng'] ? 'master' : 'assist';
      const evLines = Array.isArray(f.evidence) ? f.evidence : [];
      const lim = Array.isArray(f.limitations) ? f.limitations : [];
      const dParts = [];
      if (evLines.length) dParts.push(evLines.join('；'));
      if (lim.length) dParts.push(UI_COPY.divination['dlr-xianzhi'] + lim.join('；'));
      return React.createElement('div', { key: i, className: 'jk-ev' },
        React.createElement('span', { className: 'jke-lv ' + lv }, f.level || ''),
        React.createElement('div', { className: 'jke-body' },
          React.createElement('div', { className: 'jke-t' }, (f.target || '') + (f.role ? '（' + f.role + '）' : '')),
          dParts.length ? React.createElement('div', { className: 'jke-d' }, dParts.join('\n')) : null));
    });
    items.push(React.createElement('div', { key: 'fc-h', className: 'jk-sec' }, UI_COPY.divination['jk-leishen']),
      React.createElement('div', { key: 'fc', className: 'jk-ev-wrap' }, focusEls));
  }

  return React.createElement('div', null, items);
}
/* REQ-120：奇门时家局盘 —— 九宫四盘（九星/八门/八神/天地盘干）+ 定局信息 + 格局
   （基础标签/经典格局/复合格局）+ 反证（空亡/特殊时辰/风险宫位/凶格）+ 应期 + 方位
   （引擎确定性字段，免费展示；与 9 法「奇门终身局」命盘类区分） */
function DivQimenView(res) {
  const items = [];
  const gz = (res && typeof res === 'object' && res.ganzhi) || {};
  const meta = [];
  if (gz.year) meta.push([gz.year, gz.month, gz.day, gz.hour].filter(Boolean).join(' '));
  meta.push((QIMEN_SCOPE_CN[res.scope] || res.scope || '时家') + '奇门');
  meta.push((res.isYangDun ? UI_COPY.divination['qm-yangdun'] : UI_COPY.divination['qm-yindun']) + (res.juShu != null ? res.juShu + '局' : ''));
  meta.push((QIMEN_METHOD_CN[res.method] || res.method || '转盘') + '法');
  meta.push(QIMEN_JU_CN[res.juMethod] || res.juMethod || '拆补');
  const ti = (res && typeof res === 'object' && res.timeInfo) || {};
  if (ti.solarTerm) meta.push(ti.solarTerm + (ti.epoch ? ti.epoch : ''));
  if (res.zhiFu) meta.push(UI_COPY.divination['qm-zhifu'] + res.zhiFu);
  if (res.zhiShi) meta.push(UI_COPY.divination['qm-zhishi'] + res.zhiShi);
  if (Array.isArray(res.voidBranches) && res.voidBranches.length) meta.push(UI_COPY.divination['dlr-xunkong'] + res.voidBranches.join('、'));
  if (res.horseStar) meta.push(UI_COPY.divination['qm-yima'] + (res.horseStar.name || res.horseStar.palace));
  if (meta.length) items.push(React.createElement('div', { key: 'meta', className: 'qm-meta' }, meta.join(' · ')));

  // 定局说明（节气/符头/超神接气/置闰说明）
  const tiBits = [];
  if (ti.juTerm && ti.juTerm !== ti.solarTerm) tiBits.push(UI_COPY.divination['qm-dingju-jie'] + ti.juTerm);
  if (ti.fuTou) tiBits.push(UI_COPY.divination['qm-futou'] + ti.fuTou + (ti.fuTouDate ? '（' + ti.fuTouDate + '）' : ''));
  if (ti.chaoShenOrJieQi) tiBits.push(ti.chaoShenOrJieQi);
  if (ti.juMethodNote) tiBits.push(ti.juMethodNote);
  if (tiBits.length) items.push(React.createElement('div', { key: 'ju', className: 'qm-note' }, tiBits.join('；')));

  // 九宫四盘（按洛书布局排列：戴九履一，左三右七，二四为肩，六八为足）
  const gongs = Array.isArray(res.jiuGongGe) ? res.jiuGongGe : [];
  if (gongs.length) {
    const order = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    const byGong = {};
    gongs.forEach(function (g) { if (g && g.gong != null) byGong[g.gong] = g; });
    const voidSet = {};
    (Array.isArray(res.voidPalaces) ? res.voidPalaces : []).forEach(function (v) { if (v) voidSet[v.palace] = true; });
    const horseGong = (res.horseStar && res.horseStar.palace != null) ? res.horseStar.palace : null;
    // REQ-128：九宫四盘渲染出的星/门/神名 + 值符值使，供内嵌白话卡标签（去重交给 TCTermRow）
    const qmNounNames = [];
    gongs.forEach(function (g) {
      if (!g) return;
      const tp0 = g.tianPan || {}, rp0 = g.renPan || {}, sp0 = g.shenPan || {};
      if (tp0.star) qmNounNames.push(tp0.star);
      if (rp0.door) qmNounNames.push(rp0.door);
      if (sp0.god) qmNounNames.push(sp0.god);
    });
    if (res.zhiFu) qmNounNames.push(res.zhiFu);
    if (res.zhiShi) qmNounNames.push(res.zhiShi);
    const cellEls = order.map(function (n) {
      const g = byGong[n];
      if (!g) return React.createElement('div', { key: n, className: 'qm-cell' }, '');
      const marks = [];
      const tp = g.tianPan || {};
      if (tp.star && tp.star === res.zhiFu) marks.push(React.createElement('span', { key: 'zf', className: 'qmc-mark zhi' }, UI_COPY.divination['qm-zhifu']));
      const rp = g.renPan || {};
      if (rp.door && rp.door === res.zhiShi) marks.push(React.createElement('span', { key: 'zs', className: 'qmc-mark zhi' }, UI_COPY.divination['qm-zhishi']));
      if (voidSet[g.gong]) marks.push(React.createElement('span', { key: 'v', className: 'qmc-mark void' }, UI_COPY.divination['qm-kongwang']));
      if (horseGong != null && horseGong === g.gong) marks.push(React.createElement('span', { key: 'h', className: 'qmc-mark horse' }, '马星'));
      const dp = g.diPan || {};
      const sp = g.shenPan || {};
      const starLine = (tp.star || '') + (tp.stem || '')
        + (tp.companionStar ? '（随' + tp.companionStar + (tp.companionStem || '') + '）' : '');
      const diLine = UI_COPY.divination['qm-di'] + (dp.stem || '') + (rp.door ? ' · ' + rp.door : '');
      return React.createElement('div', { key: n, className: 'qm-cell' },
        React.createElement('div', { className: 'qmc-head' }, (g.name || g.gong + '宫') + (g.direction ? ' · ' + g.direction : '') + (g.element ? ' · ' + g.element : '')),
        React.createElement('div', { className: 'qmc-main' }, starLine || '—'),
        React.createElement('div', { className: 'qmc-sub' }, diLine || '—'),
        React.createElement('div', { className: 'qmc-god' }, sp.god || ''),
        marks.length ? React.createElement('div', { className: 'qmc-marks' }, marks) : null);
    });
    items.push(React.createElement('div', { key: 'grid-h', className: 'qm-sec' }, UI_COPY.divination['qm-jiugong-sipan']),
      React.createElement('div', { key: 'grid', className: 'qm-grid' }, cellEls),
      React.createElement('div', { key: 'grid-n', className: 'qm-note' }, '每格：宫名·方位·五行 / 天盘星干（随星） / 地盘干·门 / 八神；值符、值使、空亡、马星以角标标出。'),
      React.createElement(TCTermRow, { key: 'grid-tc', method: 'qimen', items: qmNounNames, chipClass: 'qm-tag' }));
  }

  // 格局：基础标签 + 标签白话
  const tags = Array.isArray(res.patternTags) ? res.patternTags : [];
  const details = Array.isArray(res.patternDetails) ? res.patternDetails : [];
  if (tags.length) {
    items.push(React.createElement('div', { key: 'pt-h', className: 'qm-sec' }, UI_COPY.divination['qm-geju-jichu']),
      React.createElement(TCTermRow, { key: 'pt', method: 'qimen', items: tags, chipClass: 'qm-tag' }),
      details.length ? React.createElement('ul', { key: 'pd', className: 'qm-list' },
        details.map(function (d, i) { return React.createElement('li', { key: i }, (d.tag || '') + '：' + (d.summary || '')); })) : null);
  }

  // 经典格局（九遁/三奇/门迫等）
  const cls = Array.isArray(res.classicPatterns) ? res.classicPatterns : [];
  if (cls.length) {
    const clsChips = cls.map(function (c, i) {
      const clsTone = c.type === 'good' ? 't-good' : c.type === 'bad' ? 't-bad' : 't-neutral';
      return React.createElement('span', { key: i, className: 'qm-tag ' + clsTone },
        c.name + (Array.isArray(c.palaces) && c.palaces.length ? '（' + c.palaces.map(function (p) { return p + '宫'; }).join('、') + '）' : ''));
    });
    items.push(React.createElement('div', { key: 'cp-h', className: 'qm-sec' }, UI_COPY.divination['qm-geju-jingdian']),
      React.createElement('div', { key: 'cp', className: 'qm-tags' }, clsChips),
      React.createElement('ul', { key: 'cp-l', className: 'qm-list' },
        cls.map(function (c, i) { return React.createElement('li', { key: i }, (c.name || '') + '：' + (c.summary || '')); })),
      React.createElement('div', { key: 'cp-n', className: 'qm-note' }, '经典格局据《烟波钓叟歌》《御定奇门宝鉴》《奇门遁甲秘籍大全》规则命中；只作盘面组合提示，不直接断现实吉凶。'));
  }

  // 复合格局（同宫叠加 / 吉凶混杂）
  const combos = Array.isArray(res.patternCombos) ? res.patternCombos : [];
  if (combos.length) {
    const comboEls = combos.map(function (c, i) {
      const toneCls = c.tone === 'super-good' ? 't-good' : c.tone === 'super-bad' ? 't-bad' : 't-mixed';
      return React.createElement('li', { key: i },
        React.createElement('span', { className: 'qm-tag ' + toneCls, style: { marginRight: 6 } }, c.name || ''),
        (c.summary || ''));
    });
    items.push(React.createElement('div', { key: 'cb-h', className: 'qm-sec' }, UI_COPY.divination['qm-geju-fuhe']),
      React.createElement('ul', { key: 'cb', className: 'qm-list' }, comboEls));
  }

  // 反证：空亡 / 特殊时辰 / 风险宫位 / 凶性格局
  const counter = [];
  const voidPalaces = Array.isArray(res.voidPalaces) ? res.voidPalaces : [];
  if (voidPalaces.length) {
    counter.push(React.createElement('li', { key: 'vp' },
      UI_COPY.divination['qm-xunkong-prefix'] + voidPalaces.map(function (v) { return (v.branch || '') + '·' + (v.name || ''); }).join('、')
      + UI_COPY.divination['qm-xunkong-note']));
  }
  const sc = (res && typeof res === 'object' && res.specialConditions) || {};
  if (sc.description) counter.push(React.createElement('li', { key: 'sc' }, UI_COPY.divination['qm-teshu-shichen'] + sc.description));
  const risks = Array.isArray(res.palaceInsights) ? res.palaceInsights.filter(function (p) { return p.level === '风险' || p.level === '关注'; }) : [];
  if (risks.length) {
    counter.push(React.createElement('li', { key: 'ri' },
      UI_COPY.divination['qm-fengxian-gongwei'] + risks.map(function (p) { return p.name + '（' + p.level + '）' + (p.summary || ''); }).join('；')));
  }
  const badCls = cls.filter(function (c) { return c.type === 'bad'; });
  if (badCls.length) {
    counter.push(React.createElement('li', { key: 'bc' },
      UI_COPY.divination['qm-xiongxing-geju'] + badCls.map(function (c) { return c.name; }).join('、') + '（见上方经典格局，构成盘面限制）'));
  }
  if (counter.length) {
    items.push(React.createElement('div', { key: 'ct-h', className: 'qm-sec' }, UI_COPY.divination['qm-fanzheng-xianzhi']),
      React.createElement('ul', { key: 'ct', className: 'qm-list' }, counter),
      React.createElement('div', { key: 'ct-n', className: 'qm-note' }, '反证只提示盘面限制与反向条件，不把单项限制写成现实失败或灾祸。'));
  }

  // 应期
  const yq = (res && typeof res === 'object' && res.yingQi) || {};
  if (yq.rhythm || yq.description || yq.triggerConditions) {
    const yqBits = [];
    if (yq.rhythm) yqBits.push(UI_COPY.divination['qm-pan-nei-jiezou'] + yq.rhythm);
    if (yq.description) yqBits.push(yq.description);
    const tc = Array.isArray(yq.triggerConditions) ? yq.triggerConditions : [];
    if (tc.length) yqBits.push(UI_COPY.divination['qm-chufa-tiaojian'] + tc.join('；'));
    const lm = Array.isArray(yq.limitations) ? yq.limitations : [];
    if (lm.length) yqBits.push(UI_COPY.divination['dlr-xianzhi'] + lm.join('；'));
    items.push(React.createElement('div', { key: 'yq-h', className: 'qm-sec' }, UI_COPY.divination['dlr-yingqi']),
      React.createElement('div', { key: 'yq', className: 'qm-pat' }, yqBits.join('\n')),
      React.createElement('div', { key: 'yq-n', className: 'qm-note' }, '应期只给相对节奏与触发条件（出空/填实/马星/冲合），不换算固定天数或具体日期。'));
  }

  // 方位
  const dir = (res && typeof res === 'object' && res.directions) || {};
  const goodDirs = Array.isArray(dir.goodDirections) ? dir.goodDirections : [];
  const avoidDirs = Array.isArray(dir.avoidDirections) ? dir.avoidDirections : [];
  if (goodDirs.length || avoidDirs.length) {
    const dirRows = [];
    goodDirs.forEach(function (d2, i) {
      dirRows.push(React.createElement('div', { key: 'g' + i, className: 'qm-dir-row' },
        React.createElement('span', { className: 'qmd-tag good' }, UI_COPY.divination['qm-jianyi-fangwei']),
        React.createElement('div', { className: 'qmd-body' },
          React.createElement('div', { className: 'qmd-t' }, (d2.direction || '') + (d2.name ? '（' + d2.name + '）' : '') + (d2.use ? ' · 宜' + d2.use : '')),
          React.createElement('div', { className: 'qmd-d' }, (Array.isArray(d2.reasons) ? d2.reasons.join('；') : '') || ''))));
    });
    avoidDirs.forEach(function (d2, i) {
      dirRows.push(React.createElement('div', { key: 'a' + i, className: 'qm-dir-row' },
        React.createElement('span', { className: 'qmd-tag avoid' }, UI_COPY.divination['qm-biyong-fangwei']),
        React.createElement('div', { className: 'qmd-body' },
          React.createElement('div', { className: 'qmd-t' }, (d2.direction || '') + (d2.name ? '（' + d2.name + '）' : '') + (d2.use ? ' · 宜' + d2.use : '')),
          React.createElement('div', { className: 'qmd-d' }, (Array.isArray(d2.reasons) ? d2.reasons.join('；') : '') || ''))));
    });
    items.push(React.createElement('div', { key: 'dr-h', className: 'qm-sec' }, UI_COPY.divination['qm-fangwei-cankao']),
      React.createElement('div', { key: 'dr', className: 'qm-dir' }, dirRows),
      React.createElement('div', { key: 'dr-n', className: 'qm-note' }, '方位为盘面象义参考，采用前须核实现实路线、安全与条件，不构成行动保证。'));
  }

  return React.createElement('div', null, items);
}
function DivSsgwView(res) {
  const number = res.number != null ? res.number : (res.no != null ? res.no : null);
  const items = [];
  items.push(React.createElement('div', { key: 'no', style: { fontWeight: 700, fontSize: 16 } }, (number != null ? '第 ' + number + ' 签' : '灵签') + (res.title ? ' · ' + res.title : '')));
  if (res.poem) items.push(React.createElement('div', { key: 'poem', style: { fontStyle: 'italic', color: 'var(--text-2)', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.8 } }, String(res.poem)));
  const draw = res.draw || {};
  const extra = [];
  if (res.number != null && draw.poolSize) extra.push(UI_COPY.divination['gylq-qianchi'] + draw.poolSize + ' 支');
  if (draw.method) extra.push(UI_COPY.divination['gylq-chouqian-fangshi'] + String(draw.method));
  if (extra.length) items.push(React.createElement('div', { key: 'extra', style: { marginTop: 8, fontSize: 12, color: 'var(--text-3)' } }, extra.join(' · ')));
  return React.createElement('div', null, items);
}

/* ---------- REQ-073：六爻静态文案补齐（S01~S07 落地；免费解读区占位文案已全部替换，64 卦正文由 C3 + HEX_TEXT 补齐） ---------- */
/* S01：64 卦「局面 + 宜/留意」单段大意（docs 成稿），键 = 卦全名（与 result_json 的 originalName 一致，如「乾为天」）；用于词条/引文小字与大意兜底。 */
const HEX_MEANINGS = {
  '乾为天': '纯阳刚健、动力充沛之时。宜自强进取、把握主导；留意勿恃强冒进，刚极则折。',
  '坤为地': '厚德载物、顺势承接之局。宜包容配合、按部就班；留意只宜跟随辅佐，不宜强自出头。',
  '水雷屯': '初始维艰、万事起头难。宜扎稳根基、缓步经营；留意仓促冒进反生蹉跎，蓄力待发为佳。',
  '山水蒙': '蒙昧初开、有待启发之象。宜虚心求教、先明理再行动；留意忌自以为是，草率定论。',
  '水天需': '云上于天、时机未至。宜耐心等待、养精蓄锐；留意急躁抢进易遇险，待条件成熟再行。',
  '天水讼': '争执分歧、立场相左之象。宜先和解沟通、减少对抗；留意争讼费时费力，能退则退。',
  '地水师': '兴师动众、以众行事之局。宜严明有序、依规而行；留意须师出有名、节制用众。',
  '水地比': '亲附团结、择善而从之象。宜亲近正道、彼此呼应；留意所亲须正，警惕盲从。',
  '风天小畜': '力量尚微、小有积蓄。宜小步推进、积少成多；留意暂不宜大举扩张，待力足再动。',
  '天泽履': '如履虎尾、谨慎而行之象。宜守礼持敬、步步为营；留意处危知惧方能转安。',
  '地天泰': '天地交泰、上下通顺。宜乘势而为、广开局面；留意泰中有否极之机，居安思危。',
  '天地否': '天地不交、上下隔塞。宜收敛自守、明哲待时；留意闭塞终将过去，不宜强求通达。',
  '天火同人': '与人同心、协力共事。宜坦诚协作、求同存异；留意须辨明同道，防表面和气。',
  '火天大有': '大有所获、光明丰盛。宜善用所得、谦以守成；留意盛时易骄，德位相配方能长久。',
  '地山谦': '谦逊持中、卑以自牧。宜低调务实、礼让于人；留意谦者终受益，骄者先受损。',
  '雷地豫': '欢愉振奋、顺势而动。宜借势而起、见机行事；留意乐极易生惰，动前先安内。',
  '泽雷随': '随顺时势、择善而从。宜灵活随缘、跟对方向；留意随不可失主见，谨防随波逐流。',
  '山风蛊': '积弊待整、拨乱反正之象。宜直面旧疾、果断整饬；留意革弊须有章法，忌半途而废。',
  '地泽临': '阳长阴消、亲临其境之局。宜顺势推进、关怀下位；留意盛极将转，早作绸缪。',
  '风地观': '观仰省察、反观自照。宜静心观察、审时度势；留意看人先看己，谋定而后动。',
  '火雷噬嗑': '咬合决断、清除梗阻之象。宜明断是非、扫除障碍；留意用刚须有度，戒苛急。',
  '山火贲': '文饰润色、讲究形式之象。宜得体修饰、注重形象；留意文不胜质则虚，本末勿倒。',
  '山地剥': '剥落侵蚀、阴盛阳衰。宜谨守根基、蓄力待时；留意不利进取之时，守成为上。',
  '地雷复': '一阳来复、生机回还。宜把握转机、从头起步；留意初复力微，宜养不宜躁。',
  '天雷无妄': '不妄为、守正而行。宜顺理而动、诚意正心；留意守正则吉，妄动生灾。',
  '山天大畜': '大为积蓄、厚积待发。宜多学多蓄、克制当前；留意蓄足自然可发，不必急于一时。',
  '山雷颐': '颐养之道、慎言节食。宜养身养德、正己安人；留意戒口舌是非，谨防依赖他人。',
  '泽风大过': '栋梁受压、非常之局。宜非常之时行非常之断；留意承重已满，须借外力共担。',
  '坎为水': '重险在前、陷而不失。宜守心坚定、以信渡险；留意险中求进须步步为营。',
  '离为火': '光明依附、洞察明达。宜附丽正道、以明处事；留意过明易苛，防刚火伤人。',
  '泽山咸': '两感相应、真诚沟通。宜以心相交、顺势而为；留意感贵乎诚，忌一厢情愿。',
  '雷风恒': '恒久守常、持之以恒。宜守正有恒、避免朝令夕改；留意久处易倦，当以柔济之。',
  '天山遁': '退避隐遁、保全实力。宜适时而退、远小人以自处；留意退非消极，是待时而动。',
  '雷天大壮': '阳刚壮盛、势强力足。宜善用其势、以正取胜；留意壮而勿躁，戒恃强妄为。',
  '火地晋': '旭日东升、进而有光。宜顺势上进、光明磊落；留意进阶须有凭据，戒急功。',
  '地火明夷': '光明受损、晦暗之时。宜收敛锋芒、内明外晦；留意逆境守正，韬光以保身。',
  '风火家人': '家道整肃、内外有分。宜正家正己、各安其位；留意家庭和谐从自身作则起。',
  '火泽睽': '乖离相背、求同存异。宜以小异求大同、耐心弥合；留意分歧时先缓后通。',
  '水山蹇': '山高水险、行路艰难。宜见险而止、回头求援；留意难中需借他人之力。',
  '雷水解': '险难化解、松绑释放。宜及时排解、宽以待人；留意疑难既解勿再纠缠。',
  '山泽损': '损下益上、有所减省。宜先舍后得、去其浮华；留意损己以诚方为真益。',
  '风雷益': '损上益下、增益成长。宜顺势助人、广结善缘；留意受益当思报，防贪多。',
  '泽天夬': '决而能和、当断则断。宜明辨果断、公开处断；留意断事忌冲动，留有转圜。',
  '天风姤': '不期而遇、暗流潜生。宜提高警觉、防微杜渐；留意不当之缘须及早疏远。',
  '泽地萃': '荟萃聚集、群英相会。宜借众力成事、真诚聚人；留意聚时防纷争，须立规矩。',
  '地风升': '地中生木、循序上升。宜稳步向上、积小成大；留意升势虽好，根基须实。',
  '泽水困': '困顿受制、守正待时。宜安守本分、少说多做；留意困境中言语最易招尤。',
  '水风井': '井养不穷、修己及人。宜完善自身、惠及他人；留意固守根本，勿弃现成之利。',
  '泽火革': '变革除旧、顺天应人。宜适时革新、把握人心；留意革贵乎时，忌轻举妄动。',
  '火风鼎': '鼎新之象、稳重成事。宜建立新局、任贤用能；留意鼎器须稳，戒躁进。',
  '震为雷': '震惊百里、动而有戒。宜临变镇定、先惧后行；留意惊后当自省，借势而动。',
  '艮为山': '止于当止、动静合宜。宜适可而止、内省自制；留意当止不止反致其咎。',
  '风山渐': '循序渐进、按部就班。宜缓步推进、择正而进；留意欲速不达，宁缓勿乱。',
  '雷泽归妹': '位置失当、宜慎结合。宜端正动机、量力而行；留意名位不配时先安其位。',
  '雷火丰': '丰盛盈满、光明盛大。宜把握盛时、及时作为；留意日中则昃，盛时留余地。',
  '火山旅': '行旅在外、寄人篱下。宜谦和自处、谨言慎行；留意羁旅之中少惹是非。',
  '巽为风': '随风而入、谦柔渗透。宜以柔济事、反复申命；留意柔顺过甚则失主见。',
  '兑为泽': '喜悦和悦、以诚相待。宜和颜悦色、以善相交；留意悦须出于正，防乐而失节。',
  '风水涣': '涣散之象、散而复聚。宜及时聚拢人心、消解隔阂；留意涣时先正己再正众。',
  '水泽节': '节制有度、量入为出。宜立规守度、适可而止；留意过俭过苛亦伤，当得其中。',
  '风泽中孚': '诚信发于中、内外相应。宜以至诚待人、言行一致；留意诚贵笃实，防轻诺。',
  '雷山小过': '小有过越、宜下不宜上。宜在小事上求进、谦抑自处；留意大者不可妄动。',
  '水火既济': '事已成、诸事初定。宜善守成果、防微杜渐；留意成后即藏败机，慎终如始。',
  '火水未济': '事未竟、火水未交。宜重整旗鼓、再理头绪；留意将成未成之际最需耐心。',
};

/* S01 正文复用（docs/文案交付-第二轮/C3_hexagram_generic.json，64 卦 × 本卦大意/变卦大意，现代白话零占位）：键 = 卦全名。 */
const HEX_GENERIC = {
  '乾为天': {
    '本卦大意': '纯阳刚健，主开创与进取之象。当下宜守正持恒、循序发力，于顺势之中蓄积气象。',
    '变卦大意': '若以此卦为走向，预示一段奋发向上的趋势；宜把握时机、乘势而上，然盛极当知收敛。'
  },
  '坤为地': {
    '本卦大意': '厚德载物、柔顺伸展之象。当下宜包容承顺、低调承载，顺势则安。',
    '变卦大意': '若以此卦为走向，预示厚积之期；宜含弘光大、承天而行，柔中见其长久。'
  },
  '水雷屯': {
    '本卦大意': '雷雨交作、万物始生之象。当下宜稳扎根基、徐图起步，初创虽艰而有机。',
    '变卦大意': '若以此卦为走向，预示初生维艰的阶段；宜耐心扎根，顺势应时自见欣荣。'
  },
  '山水蒙': {
    '本卦大意': '山下出泉、蒙昧待启之象。当下宜虚心受教、循序启发，忌固蔽自是。',
    '变卦大意': '若以此卦为走向，预示启蒙之期；宜敏而好学、求明于师，蒙以养正乃通。'
  },
  '水天需': {
    '本卦大意': '云上于天、待时而进之象。当下宜守正待机、蓄力不躁，时未至则安。',
    '变卦大意': '若以此卦为走向，预示宜待之期；宜沉住气、蓄其势，时机到时自然显露。'
  },
  '天水讼': {
    '本卦大意': '天西水东、违行争讼之象。当下宜慎争戒讼、求同化解，忌硬碰两伤。',
    '变卦大意': '若以此卦为走向，预示争执之局；宜和解为上、以退为进，讼终凶、和则吉。'
  },
  '地水师': {
    '本卦大意': '地中有水、众聚行险之象。当下宜正道率众、纪律为先，慎用其力。',
    '变卦大意': '若以此卦为走向，提示需聚众成事；宜以正御众、稳而行之，化险为通。'
  },
  '水地比': {
    '本卦大意': '地上有水、亲比相辅之象。当下宜择善依附、同心相济，比而当则吉。',
    '变卦大意': '若以此卦为走向，提示亲附之期；宜结善缘、以信相从，比之无首则凶。'
  },
  '风天小畜': {
    '本卦大意': '风行天上、小有蓄积之象。当下宜积微成著、暂忍待发，力量未足勿大展。',
    '变卦大意': '若以此卦为走向，提示蓄势之期；宜徐徐积累、不宜冒进，小畜终成大。'
  },
  '天泽履': {
    '本卦大意': '上天下泽、慎行履危之象。当下宜循礼守分、如履薄冰，步步稳妥。',
    '变卦大意': '若以此卦为走向，提示行事需谨；敬畏分寸、踏实而行，履危反得亨通。'
  },
  '地天泰': {
    '本卦大意': '天地交泰、阴阳和畅之象。当下宜上下相通、顺势而为，百事顺遂。',
    '变卦大意': '若以此卦为走向，提示通达之期；宜把握和合、居安思危，泰中藏否须防满。'
  },
  '天地否': {
    '本卦大意': '天地不交、闭塞阻隔之象。当下宜沉潜忍耐、勿强通塞，静待气机回转。',
    '变卦大意': '若以此卦为走向，提示阻碍仍存；宜内守外柔，待否极而倾、先否后喜。'
  },
  '天火同人': {
    '本卦大意': '天与火同、志合道凝之象。当下宜同心协力、广结善缘，和同乃成大。',
    '变卦大意': '若以此卦为走向，提示协和之期；宜类族辨物、与众共行，同人于野亨通。'
  },
  '火天大有': {
    '本卦大意': '火在天上、丰盛盈满之象。当下宜守成不骄、善用其富，满而不溢为上。',
    '变卦大意': '若以此卦为走向，提示收获丰厚的阶段；宜谦守分际，富贵长久在守不在取。'
  },
  '地山谦': {
    '本卦大意': '山在地下、谦卑有终之象。当下宜低调守谦、敛锋藏芒，谦尊而光。',
    '变卦大意': '若以此卦为走向，预示谦吉之期；宜谦退不争、以谦受益，谦谦君子终有成。'
  },
  '雷地豫': {
    '本卦大意': '雷出地奋、和乐顺动之象。当下宜顺时预备、适度欢愉，然乐极生怠。',
    '变卦大意': '若以此卦为走向，提示安豫之期；宜居安思危、预为之计，免逸乐招损。'
  },
  '泽雷随': {
    '本卦大意': '泽中有雷、随时顺从之象。当下宜随顺时势、择善而从，忌固守己见。',
    '变卦大意': '若以此卦为走向，提示宜随宜变通；顺时而动、与人偕行，随和乃通。'
  },
  '山风蛊': {
    '本卦大意': '山下有风、积弊待治之象。当下宜整顿修复、除旧布新，治乱须下功。',
    '变卦大意': '若以此卦为走向，提示振疲之期；宜直面陈弊、循序整治，拨乱可期复振。'
  },
  '地泽临': {
    '本卦大意': '泽上有地、临下教保之象。当下宜亲临务实、以德临人，渐进而治。',
    '变卦大意': '若以此卦为走向，预示临近之期；宜以诚临民、把握当下，临事而能保民。'
  },
  '风地观': {
    '本卦大意': '风行地上、观察省思之象。当下宜登高望远、审势而后动，毋急于表露。',
    '变卦大意': '若以此卦为走向，预示宜以观代争；看清情势与人心的脉络，再从容落子。'
  },
  '火雷噬嗑': {
    '本卦大意': '火雷相合、刚柔相济之象。当下宜决断除碍、以法度断，难处见通。',
    '变卦大意': '若以此卦为走向，提示宜断宜合；去其梗碍、刚柔并施，咬合而后通达。'
  },
  '山火贲': {
    '本卦大意': '山下有火、文饰润色之象。当下宜修饰外表、以质为本，忌徒有其华。',
    '变卦大意': '若以此卦为走向，提示宜饰以成文；内外兼修、扬质于饰，乃见其美。'
  },
  '山地剥': {
    '本卦大意': '山附于地、层层剥落之象。当下宜顺势而止、减损虚饰，勿逆势强撑。',
    '变卦大意': '若以此卦为走向，提示消退之期；宜守静养正，剥尽之处自有复生之机。'
  },
  '地雷复': {
    '本卦大意': '雷在地中、一阳来复之象。当下宜见微知著、静待生机，迷途知返则吉。',
    '变卦大意': '若以此卦为走向，提示复苏之期；宜顺势归正、蓄阳待发，复其见天地心。'
  },
  '天雷无妄': {
    '本卦大意': '天下雷行、不妄而动之象。当下宜守诚务实、顺理而行，忌妄动生灾。',
    '变卦大意': '若以此卦为走向，预示宜正宜静；不妄求、不侥幸，顺其自然反得无妄之福。'
  },
  '山天大畜': {
    '本卦大意': '山天相涵、厚积成畜之象。当下宜蓄德储能、稳扎稳打，厚积方能薄发。',
    '变卦大意': '若以此卦为走向，预示蓄积丰盈；宜静养其力、待时而发，止中有进。'
  },
  '山雷颐': {
    '本卦大意': '山下有雷、颐养正道之象。当下宜谨言节养、纯正自守，忌贪侈妄求。',
    '变卦大意': '若以此卦为走向，预示宜养宜守；养正于内、慎择所守，颐和方得安宁。'
  },
  '泽风大过': {
    '本卦大意': '泽灭木、非常之举之象。当下宜审力而行、担当非常，忌轻率涉险。',
    '变卦大意': '若以此卦为走向，预示非常之时；宜审慎负重、量力而动，过中思稳方免倾。'
  },
  '坎为水': {
    '本卦大意': '重重险陷、流水不息之象。当下宜谨慎周旋、以韧渡险，勿冒进触礁。',
    '变卦大意': '若以此卦为走向，预示险阻仍在；宜持恒守心，于流变中寻稳妥之径。'
  },
  '离为火': {
    '本卦大意': '两火相丽、附丽光明之象。当下宜依凭正道、明照而行，忌虚浮无依。',
    '变卦大意': '若以此卦为走向，预示光明渐进；宜附善而居、守中持明，丽而不眩方久。'
  },
  '泽山咸': {
    '本卦大意': '山上有泽、相互感应之象。当下宜以诚相感、自然相契，忌强求攀附。',
    '变卦大意': '若以此卦为走向，提示感应之期；宜虚怀相与、情通意合，咸感乃两相宜。'
  },
  '雷风恒': {
    '本卦大意': '雷风相与、恒久不已之象。当下宜守恒有常、持中耐久，忌朝更夕改。',
    '变卦大意': '若以此卦为走向，提示长久可期；宜立恒心、守正道，日久自见其功。'
  },
  '天山遁': {
    '本卦大意': '山高天远、退避隐守之象。当下宜审时度势、知退养晦，不为一时之争所累。',
    '变卦大意': '若以此卦为走向，预示宜退守以待时；退非怯也，留得从容方见转机。'
  },
  '雷天大壮': {
    '本卦大意': '雷在天上、阳刚壮盛之象。当下宜壮勿妄动、恃正而行，盛壮当知敛。',
    '变卦大意': '若以此卦为走向，预示壮盛之期；宜正固其势、戒躁进，壮而不妄方保其强。'
  },
  '火地晋': {
    '本卦大意': '火出地上、光明上进之象。当下宜进取有为、借势扬升，然须以德自守。',
    '变卦大意': '若以此卦为走向，预示节节向前的趋势；宜把握升进之机，戒骄戒躁方得长久。'
  },
  '地火明夷': {
    '本卦大意': '明入地中、韬光养晦之象。当下宜内敛守正、避其锋芒，于暗处蓄明。',
    '变卦大意': '若以此卦为走向，预示晦蔽之时；宜沉静待明、不逞强争，转暗为明在耐心。'
  },
  '风火家人': {
    '本卦大意': '风自火出、齐家有方之象。当下宜正内固本、各安其分，家和则事兴。',
    '变卦大意': '若以此卦为走向，预示宜修内务；正本清源、以诚齐家，内和而后外顺。'
  },
  '火泽睽': {
    '本卦大意': '火泽相违、乖离异向之象。当下宜求同存异、以诚化隔，忌固执相左。',
    '变卦大意': '若以此卦为走向，预示乖睽之局；宜异中求同、通权达变，转隔阂为呼应。'
  },
  '水山蹇': {
    '本卦大意': '水在山上、险阻在前之象。当下宜知难而止、反身修德，忌冒进触困。',
    '变卦大意': '若以此卦为走向，提示蹇滞之局；宜止而思反、待时而行，蹇中见智方通。'
  },
  '雷水解': {
    '本卦大意': '雷雨作解、险难消散之象。当下宜顺势纾困、宽以待人，解冻之处生机现。',
    '变卦大意': '若以此卦为走向，预示困局将解；宜柔道致治、及时化解，涣释而后通。'
  },
  '山泽损': {
    '本卦大意': '山下有泽、损下益上之象。当下宜有所减损、割爱就理，损中有得。',
    '变卦大意': '若以此卦为走向，提示当舍当损；适时节制、以损致益，方合权衡之道。'
  },
  '风雷益': {
    '本卦大意': '风雷相益、损上益下之象。当下宜施惠共赢、与时偕行，益人亦自益。',
    '变卦大意': '若以此卦为走向，提示增益之期；宜损上益下、把握时机，互惠乃长。'
  },
  '泽天夬': {
    '本卦大意': '泽上于天、决而能和之象。当下宜果决去私、柔中持正，忌刚愎独断。',
    '变卦大意': '若以此卦为走向，提示决断之期；宜公开明断、以正去邪，夬而能和乃吉。'
  },
  '天风姤': {
    '本卦大意': '风行天下、不期而遇之象。当下宜以开放之心接纳意外之人事物，忌轻率定夺。',
    '变卦大意': '若以此卦为走向，提示邂逅与变动将至；宜审慎分辨、勿急于依附，守分则吉。'
  },
  '泽地萃': {
    '本卦大意': '泽上于地、荟萃聚集之象。当下宜聚贤汇众、以正相感，聚而当则成。',
    '变卦大意': '若以此卦为走向，预示汇聚之期；宜择正而聚、慎防无首，萃而能固乃兴。'
  },
  '地风升': {
    '本卦大意': '地中生木、柔顺上升之象。当下宜谦逊积德、自下而上，渐进得升。',
    '变卦大意': '若以此卦为走向，预示步步高升；宜顺势涵养、不躁不馁，升而有道。'
  },
  '泽水困': {
    '本卦大意': '泽中无水、困穷守志之象。当下宜处困守正、静待时通，忌妄动招损。',
    '变卦大意': '若以此卦为走向，提示困顿之局；宜坚心守道、徐图其通，困而能悟方脱。'
  },
  '水风井': {
    '本卦大意': '木上有水、养而不穷之象。当下宜守位惠民、源源供济，忌竭泽而渔。',
    '变卦大意': '若以此卦为走向，提示宜养宜济；守其源、施其润，久处不厌方见其功。'
  },
  '泽火革': {
    '本卦大意': '泽中有火、破旧立新之象。当下宜顺天应人、审时变革，忌贸然躁动。',
    '变卦大意': '若以此卦为走向，预示更张之期；宜谋定而后动，顺势除弊、焕然可期。'
  },
  '火风鼎': {
    '本卦大意': '火燃风起、鼎新养贤之象。当下宜稳重图变、以新代旧，鼎成在序。',
    '变卦大意': '若以此卦为走向，预示鼎革之期；宜调和众力、革故鼎新，稳中致变乃成。'
  },
  '震为雷': {
    '本卦大意': '震雷迭至、惊动奋发之象。当下宜临危不乱、因动而生，惧则慎、慎则安。',
    '变卦大意': '若以此卦为走向，预示变动将起；宜镇定应变、乘震而动，乱中自见秩序。'
  },
  '艮为山': {
    '本卦大意': '两山相叠、静止不动之象。当下宜止其所止、安分守静，不为外扰所动。',
    '变卦大意': '若以此卦为走向，预示宜止不宜进；及时收手、动极思静，方得安稳。'
  },
  '风山渐': {
    '本卦大意': '山上有木、循序渐进之象。当下宜稳序而行、积小成大，忌躐等冒进。',
    '变卦大意': '若以此卦为走向，提示渐次向好；宜按部就班、涵养德行，功到自然成。'
  },
  '雷泽归妹': {
    '本卦大意': '泽上有雷、归妹立家之象。当下宜依礼而行、正本清源，忌苟合妄动。',
    '变卦大意': '若以此卦为走向，预示立家之期；宜循分守礼、以正相合，归妹当谨始乃安。'
  },
  '雷火丰': {
    '本卦大意': '雷电皆至、盛大丰盈之象。当下宜乘势建功、光明行事，然盛极防溢。',
    '变卦大意': '若以此卦为走向，提示丰盛将至；宜把握当下、戒盈守中，免日中则昃之患。'
  },
  '火山旅': {
    '本卦大意': '火在山上、行旅飘寄之象。当下宜随遇而安、谨慎栖止，忌久留无根。',
    '变卦大意': '若以此卦为走向，提示飘泊之期；宜依义顺时、妥为安顿，旅中守静免失。'
  },
  '巽为风': {
    '本卦大意': '两风相随、谦逊入理之象。当下宜因势利导、柔中行权，忌刚愎强为。',
    '变卦大意': '若以此卦为走向，预示宜顺宜入；以柔克刚、渐进得遂，谦逊可成事。'
  },
  '兑为泽': {
    '本卦大意': '两泽相涵、欣悦以言之象。当下宜以悦待人、言辞有节，忌巧言取宠。',
    '变卦大意': '若以此卦为走向，预示和悦之期；宜诚信悦人、内外相孚，悦而不流于佞。'
  },
  '风水涣': {
    '本卦大意': '风行水上、涣散舒解之象。当下宜拯涣聚心、因势疏导，忌涣而无统。',
    '变卦大意': '若以此卦为走向，提示宜散宜导；化隔阂为流通、聚离散为一心，涣而后通。'
  },
  '水泽节': {
    '本卦大意': '泽上有水、节制有度之象。当下宜量入为出、张弛有节，过犹不及。',
    '变卦大意': '若以此卦为走向，提示当有所约束；凡事守界、适可而止，方免溢泛之失。'
  },
  '风泽中孚': {
    '本卦大意': '风拂泽上、诚信感通之象。当下宜以信立身、心意相孚，忌虚饰浮夸。',
    '变卦大意': '若以此卦为走向，预示诚信可通；宜守诺重信、以诚相感，事可成于信。'
  },
  '雷山小过': {
    '本卦大意': '山上有雷、小有过越之象。当下宜行而有度、守小勿大，过中求稳。',
    '变卦大意': '若以此卦为走向，提示宜小不宜大；宜谨守分寸、过而能改，小过无咎大过凶。'
  },
  '水火既济': {
    '本卦大意': '水火相交、事已成定之象。当下宜居安思危、善保成果，防盛极将衰。',
    '变卦大意': '若以此卦为走向，提示功成在即；宜稳守收尾、勿生松懈，盛时更需戒满。'
  },
  '火水未济': {
    '本卦大意': '火在水上、事未竟成之象。当下宜慎终如始、防功亏一篑，待续而未止。',
    '变卦大意': '若以此卦为走向，提示未竟之局；宜持恒收尾、勿懈于终，济而未济方见生机。'
  },
};

/* S08 素材（docs/文案交付-第二轮/liuyao_hexagram_texts.json：64 卦辞 + 64 大象 + 386 爻辞「原文+白话」）：键 = 卦全名；yaoCi 自初爻起按爻位排序（乾/坤末尾含用九/用六）。 */
const HEX_TEXT = {
  '乾为天': {
    number: 1,
    short: '乾',
    guaCi: { original: '乾，元亨，利貞。', baihua: '乾卦，开头亨通，利于守正。喻示刚健开创的态势，宜把握时机、行得正路。' },
    xiangCi: { original: '天行健，君子以自強不息。', baihua: '天体运行刚健不息，人亦当效法，自立自强、不懈不怠。' },
    yaoCi: [
      { name: '初九', original: '潛龍勿用。', baihua: '初爻阳位：如潜藏的龙暂不显露，此时宜沉潜蓄力，不宜急于表现或行动。' },
      { name: '九二', original: '見龍在田，利見大人。', baihua: '二爻阳位：龙已现于田间，时机渐明，宜把握可见的机遇，亦利于向有经验者请教。' },
      { name: '九三', original: '君子終日乾乾，夕惕若，厲，無咎。', baihua: '三爻阳位：君子整日勤勉戒慎，虽处险兢却无大过，宜恒心与自省并行。' },
      { name: '九四', original: '或躍在淵，無咎。', baihua: '四爻阳位：龙或跃或潜于渊，进退有度则无咎，宜审时度势、不强行。' },
      { name: '九五', original: '飛龍在天，利見大人。', baihua: '五爻阳位：龙飞于天，气势正盛，宜把握主导时机，亦利于得贵人相助。' },
      { name: '上九', original: '亢龍有悔。', baihua: '上爻阳位：龙飞至极处易生悔吝，盛极当知收敛，过亢则失。' },
      { name: '用九', original: '見群龍無首，吉。', baihua: '用九：群龙无首、各安其位，反得吉祥，喻不拘一格、和而不同。' },
    ]
  },
  '坤为地': {
    number: 2,
    short: '坤',
    guaCi: { original: '坤，元亨，利牝馬之貞。君子有攸往，先迷后得主。利西南，得朋，東北，喪朋。安貞，吉。', baihua: '坤卦，开头亨通，宜如牝马般柔顺守正。君子有所往，先迷后得，安于守正则吉。' },
    xiangCi: { original: '地勢坤，君子以厚德載物。', baihua: '大地厚重顺势，人当以厚德承载、包容万物。' },
    yaoCi: [
      { name: '初六', original: '履霜，堅冰至。', baihua: '初爻阴位：踏霜便知坚冰将至，见微知著，宜早作防备。' },
      { name: '六二', original: '直，方，大，不習無不利。', baihua: '二爻阴位：正直、端方、宽大，虽不刻意学习亦无不利，守住本分即可。' },
      { name: '六三', original: '含章，可貞。或從王事，無成有終。', baihua: '三爻阴位：内含美质、守正可安；或从王事不居功，终能有成。' },
      { name: '六四', original: '括囊，無咎，無譽。', baihua: '四爻阴位：缄口如扎紧囊袋，不张扬则无咎亦无誉，宜谨守。' },
      { name: '六五', original: '黃裳，元吉。', baihua: '五爻阴位：身着黄裳、居尊而谦，大吉，柔中带尊为美。' },
      { name: '上六', original: '龍戰於野，其血玄黃。', baihua: '上爻阴位：龙战于野、血气玄黄，阴阳相争至极，宜防激烈冲突。' },
      { name: '用六', original: '利永貞。', baihua: '用六：利于长久守正，柔顺持久方得其利。' },
    ]
  },
  '水雷屯': {
    number: 3,
    short: '屯',
    guaCi: { original: '屯，元亨，利貞，勿用有攸往，利建侯。', baihua: '屯卦，开头亨通，利于守正；不宜轻动远行，宜立贤能、聚众奠基。' },
    xiangCi: { original: '云雷，屯。君子以經綸。', baihua: '云雷郁结未散，君子当理清头绪、经营初创。' },
    yaoCi: [
      { name: '初九', original: '磐桓，利居貞，利建侯。', baihua: '初爻阳位：徘徊难进，宜安居守正并倚重贤才，缓步立业。' },
      { name: '六二', original: '屯如邅如，乘馬班如，匪寇，婚媾。女子貞不字，十年乃字。', baihua: '二爻阴位：进退两难如乘马盘旋；非寇而是求亲，女子守正久乃得配。' },
      { name: '六三', original: '即鹿無虞，惟入于林中，君子几不如舍，往吝。', baihua: '三爻阴位：逐鹿无向导而入林，不如舍下；冒进易生遗憾。' },
      { name: '六四', original: '乘馬班如，求婚媾，無不利。', baihua: '四爻阴位：乘马盘旋终得婚配，所求渐顺，无不利。' },
      { name: '九五', original: '屯其膏，小貞吉，大貞凶。', baihua: '五爻阳位：恩泽未普，小处守正吉、大处守正凶，宜量力。' },
      { name: '上六', original: '乘馬班如，泣血漣如。', baihua: '上爻阴位：乘马盘旋、泣血涟涟，强进无路，宜止而自省。' },
    ]
  },
  '山水蒙': {
    number: 4,
    short: '蒙',
    guaCi: { original: '蒙，亨。匪我求童蒙，童蒙求我。初筮告，再三瀆，瀆則不告。利貞。', baihua: '蒙卦，亨通。非我求蒙童，乃蒙童求我；诚心一问则告，再三轻慢则不告，利于守正。' },
    xiangCi: { original: '山下出泉，蒙。君子以果行育德。', baihua: '山下涌泉蒙昧初开，君子当果决行事、培育德行。' },
    yaoCi: [
      { name: '初六', original: '發蒙，利用刑人，用說桎梏，以往吝。', baihua: '初爻阴位：启发蒙昧可用规范，解除束缚；执迷以往则生遗憾。' },
      { name: '九二', original: '包蒙吉。納婦吉。子克家。', baihua: '二爻阳位：包容蒙童则吉，纳配亦吉，子能持家。' },
      { name: '六三', original: '勿用娶女，見金，夫不有躬，無攸利。', baihua: '三爻阴位：不宜娶此女，见利而失身，无所利，宜远之。' },
      { name: '六四', original: '困蒙，吝。', baihua: '四爻阴位：困于蒙昧，孤立无援，宜求教脱困。' },
      { name: '六五', original: '童蒙，吉。', baihua: '五爻阴位：童蒙纯一，吉，虚心受教者得其益。' },
      { name: '上九', original: '擊蒙。不利為寇，利御寇。', baihua: '上爻阳位：击治蒙昧，不宜为寇、宜御寇，刚柔有度。' },
    ]
  },
  '水天需': {
    number: 5,
    short: '需',
    guaCi: { original: '需，有孚，光亨，貞吉。利涉大川。', baihua: '需卦，有诚信则光明亨通、守正吉，利于涉越大川。喻等待时机。' },
    xiangCi: { original: '云上於天，需。君子以飲食宴樂。', baihua: '云上于天、待时而雨，君子当饮食宴乐、养精蓄锐。' },
    yaoCi: [
      { name: '初九', original: '需于郊，利用恆，無咎。', baihua: '初爻阳位：在郊野等待，宜恒心守常则无咎。' },
      { name: '九二', original: '需于沙，小有言，終吉。', baihua: '二爻阳位：在沙地等待，小有口舌终吉，勿急。' },
      { name: '九三', original: '需于泥，致寇至。', baihua: '三爻阳位：在泥泞等待，易招寇至，宜谨慎防险。' },
      { name: '六四', original: '需于血，出自穴。', baihua: '四爻阴位：在血泊中等待，能自穴中脱险，宜退守。' },
      { name: '九五', original: '需于酒食，貞吉。', baihua: '五爻阳位：在酒食中等待，守正则吉，安享其成。' },
      { name: '上六', original: '入于穴，有不速之客三人來，敬之終吉。', baihua: '上爻阴位：陷入穴中，有不速之客三人来，以礼待之终吉。' },
    ]
  },
  '天水讼': {
    number: 6,
    short: '讼',
    guaCi: { original: '訟，有孚，窒惕，中吉，終凶。利見大人，不利涉大川。', baihua: '讼卦，有诚信而受阻生疑，中道吉、终局凶；利于见大人，不宜涉大川。喻争讼。' },
    xiangCi: { original: '天與水違行，訟。君子以作事謀始。', baihua: '天与水背道而行，君子当谋定于始、息事宁人。' },
    yaoCi: [
      { name: '初六', original: '不永所事，小有言，終吉。', baihua: '初爻阴位：不把小事闹大，小有口舌终吉。' },
      { name: '九二', original: '不克訟，歸而逋，其邑人三百戶，無眚。', baihua: '二爻阳位：争讼不胜，退归避祸，其邑三百户无灾。' },
      { name: '六三', original: '食舊德，貞厲，終吉。或從王事，無成。', baihua: '三爻阴位：安享旧德、守正防危终吉；或从王事不居功。' },
      { name: '九四', original: '不克訟，復自命渝，安貞，吉。', baihua: '四爻阳位：争讼不胜，回心转意安于守正则吉。' },
      { name: '九五', original: '訟元吉。', baihua: '五爻阳位：讼得中正，大吉，裁决清明。' },
      { name: '上九', original: '或錫之鞶帶，終朝三褫之。', baihua: '上爻阳位：或赐官带，终朝三夺之，荣宠难久，宜淡。' },
    ]
  },
  '地水师': {
    number: 7,
    short: '师',
    guaCi: { original: '師，貞丈人吉，無咎。', baihua: '师卦，守正、倚重老成则吉无咎。喻兴众行事。' },
    xiangCi: { original: '地中有水，師。君子以容民畜眾。', baihua: '地中有水、兵众潜藏，君子当容民畜众、纪律为先。' },
    yaoCi: [
      { name: '初六', original: '師出以律，否臧凶。', baihua: '初爻阴位：出兵以纪律为先，失律则凶。' },
      { name: '九二', original: '在師中，吉，無咎，王三錫命。', baihua: '二爻阳位：身在军中、吉无咎，君王再三嘉奖。' },
      { name: '六三', original: '師或輿尸，凶。', baihua: '三爻阴位：军中或载尸而归，凶，统御失当。' },
      { name: '六四', original: '師左次，無咎。', baihua: '四爻阴位：退守左侧营地，无咎，知止。' },
      { name: '六五', original: '田有禽，利執言，無咎。長子帥師，弟子輿尸，貞凶。', baihua: '五爻阴位：田有禽利捕捉无咎；长子帅师、弟子载尸则凶，用人宜专。' },
      { name: '上六', original: '大君有命，開國承家，小人勿用。', baihua: '上爻阴位：大君颁命、开国承家，小人不可任用。' },
    ]
  },
  '水地比': {
    number: 8,
    short: '比',
    guaCi: { original: '比，吉。原筮元永貞，無咎。不寧方來，后夫凶。', baihua: '比卦，吉。原筮永守正则无咎；不安者来归，迟疑者凶。喻亲附。' },
    xiangCi: { original: '地上有水，比。先王以建萬國，親諸侯。', baihua: '地上有水、相亲相比，先王建诸侯、亲诸侯。' },
    yaoCi: [
      { name: '初六', original: '有孚比之，無咎。有孚盈缶，終來有他，吉。', baihua: '初爻阴位：有诚信而亲附则无咎，诚满如缶终来有他吉。' },
      { name: '六二', original: '比之自內，貞吉。', baihua: '二爻阴位：由内而亲附，守正吉。' },
      { name: '六三', original: '比之匪人。', baihua: '三爻阴位：亲附非其人，所交不正，宜慎。' },
      { name: '六四', original: '外比之，貞吉。', baihua: '四爻阴位：向外亲附正人，守正吉。' },
      { name: '九五', original: '顯比，王用三驅，失前禽，邑人不誡，吉。', baihua: '五爻阳位：显明亲附之道，王三驱失前禽、邑人不诫，吉。' },
      { name: '上六', original: '比之無首，凶。', baihua: '上爻阴位：亲附而无首领，凶，失所依。' },
    ]
  },
  '风天小畜': {
    number: 9,
    short: '小畜',
    guaCi: { original: '小畜，亨。密云不雨，自我西郊。', baihua: '小畜卦，亨通。密云不雨、自西郊来，小有积蓄未成大雨。喻力量尚微。' },
    xiangCi: { original: '風行天上，小畜。君子以懿文德。', baihua: '风行天上、小有蓄养，君子当美化文德。' },
    yaoCi: [
      { name: '初九', original: '復自道，何其咎？吉。', baihua: '初爻阳位：由正道返回，何咎之有，吉。' },
      { name: '九二', original: '牽復，吉。', baihua: '二爻阳位：被牵而返正，吉，不失其群。' },
      { name: '九三', original: '輿說輻，夫妻反目。', baihua: '三爻阳位：车轮脱辐、夫妻反目，宜防内耗。' },
      { name: '六四', original: '有孚，血去惕出，無咎。', baihua: '四爻阴位：有诚信则忧惧去、无咎。' },
      { name: '九五', original: '有孚攣如，富以其鄰。', baihua: '五爻阳位：诚信牵系、富及邻里，共济。' },
      { name: '上九', original: '既雨既處，尚德載，婦貞厲。月几望，君子征凶。', baihua: '上爻阳位：既雨既止、尚德载；妇守正防危，月近望而征凶。' },
    ]
  },
  '天泽履': {
    number: 10,
    short: '履',
    guaCi: { original: '履，履虎尾，不咥人，亨。', baihua: '履卦，如履虎尾而不被咬，亨通。喻谨慎而行。' },
    xiangCi: { original: '上天下澤，履。君子以辨上下、定民志。', baihua: '上天下泽、尊卑有别，君子当辨上下、定民志。' },
    yaoCi: [
      { name: '初九', original: '素履往，無咎。', baihua: '初爻阳位：素位而行则无咎。' },
      { name: '九二', original: '履道坦坦，幽人貞吉。', baihua: '二爻阳位：履道坦坦、幽人守正吉。' },
      { name: '六三', original: '眇能視，跛能履，履虎尾，咥人，凶。武人為于大君。', baihua: '三爻阴位：盲目视物、跛足强行、履虎尾被咬，凶；武人僭越亦凶。' },
      { name: '九四', original: '履虎尾，愬愬，終吉。', baihua: '四爻阳位：履虎尾而戒惧，终吉。' },
      { name: '九五', original: '夬履，貞厲。', baihua: '五爻阳位：果决行事、守正防危。' },
      { name: '上九', original: '視履考祥，其旋元吉。', baihua: '上爻阳位：审视所履、考其祥善，周旋得宜则大吉。' },
    ]
  },
  '地天泰': {
    number: 11,
    short: '泰',
    guaCi: { original: '泰，小往大來，吉亨。', baihua: '泰卦，小往大来，吉而亨。天地交泰、上下通顺。' },
    xiangCi: { original: '天地交，泰，后以財（裁）成天地之道，輔相天地之宜，以左右民。', baihua: '天地交泰，人君当裁成天道、辅相地宜、左右民生。' },
    yaoCi: [
      { name: '初九', original: '拔茅茹，以其夤，征吉。', baihua: '初爻阳位：拔茅连根、汇志同者，征吉。' },
      { name: '九二', original: '包荒，用馮河，不遐遺，朋亡，得尚于中行。', baihua: '二爻阳位：包容荒远、涉大川、不弃朋类，得中道之助。' },
      { name: '九三', original: '無平不陂，無往不復，艱貞無咎。勿恤其孚，于食有福。', baihua: '三爻阳位：无平不陂、无往不复，艰守无咎；勿忧其信，食自有福。' },
      { name: '六四', original: '翩翩不富，以其鄰，不戒以孚。', baihua: '四爻阴位：翩翩不富而亲邻，不戒以信，自然相和。' },
      { name: '六五', original: '帝乙歸妹，以祉元吉。', baihua: '五爻阴位：帝乙嫁妹、以祉元吉，尊而能和。' },
      { name: '上六', original: '城復于隍，勿用師。自邑告命，貞吝。', baihua: '上爻阴位：城墙倾复于壕，勿动干戈；自邑告命，守正防吝。' },
    ]
  },
  '天地否': {
    number: 12,
    short: '否',
    guaCi: { original: '否，否之匪人，不利君子貞，大往小來。', baihua: '否卦，闭塞非人愿，不利君子守正，大往小来。天地不交。' },
    xiangCi: { original: '天地不交，否。君子以儉德辟難，不可榮以祿。', baihua: '天地不交，君子当俭德避难、不恋禄位。' },
    yaoCi: [
      { name: '初六', original: '拔茅茹，以其夤，貞吉亨。', baihua: '初爻阴位：拔茅连根、守正吉亨，先难后通。' },
      { name: '六二', original: '包承，小人吉，大人否亨。', baihua: '二爻阴位：包容承顺，小人吉、大人否而终亨。' },
      { name: '六三', original: '包羞。', baihua: '三爻阴位：包容招羞，宜自敛。' },
      { name: '九四', original: '有命無咎，疇離祉。', baihua: '四爻阳位：有命无咎，同道离碍得祉。' },
      { name: '九五', original: '休否，大人吉。其亡其亡，系于苞桑。', baihua: '五爻阳位：否极将休，大人吉；其亡其亡，系于苞桑，居安思危。' },
      { name: '上九', original: '傾否，先否后喜。', baihua: '上爻阳位：倾覆否局，先否后喜，闭塞终开。' },
    ]
  },
  '天火同人': {
    number: 13,
    short: '同人',
    guaCi: { original: '同人，同人于野，亨，利涉大川，利君子貞。', baihua: '同人卦，与人和同于野，亨通，利涉大川，利君子守正。' },
    xiangCi: { original: '天與火，同人。君子以類族辨物。', baihua: '天与火相映、和同于人，君子当类族辨物、求同存异。' },
    yaoCi: [
      { name: '初九', original: '同人于門，無咎。', baihua: '初爻阳位：出门即与人和同，无咎。' },
      { name: '六二', original: '同人于宗，吝。', baihua: '二爻阴位：只与宗族和同，狭隘生吝。' },
      { name: '九三', original: '伏戎于莽，升其高陵，三歲不興。', baihua: '三爻阳位：伏兵于莽、登陵三年不兴，防暗争。' },
      { name: '九四', original: '乘其墉，弗克攻，吉。', baihua: '四爻阳位：登墙欲攻而弗克，转吉，知止。' },
      { name: '九五', original: '同人，先號啕而后笑，大師克相遇。', baihua: '五爻阳位：先号啕后欢笑，大军克敌相遇，终和。' },
      { name: '上九', original: '同人于郊，無悔。', baihua: '上爻阳位：与人和同于郊，无后悔，疏而不迫。' },
    ]
  },
  '火天大有': {
    number: 14,
    short: '大有',
    guaCi: { original: '大有，元亨。', baihua: '大有卦，大有所获、光明丰盛，元亨。' },
    xiangCi: { original: '火在天上，大有。君子以竭惡揚善，順天休命。', baihua: '火在天上、大有，君子当遏恶扬善、顺天休命。' },
    yaoCi: [
      { name: '初九', original: '無交害，匪咎，艱則無咎。', baihua: '初爻阳位：无交害、非咎，处艰则无咎。' },
      { name: '九二', original: '大車以載，有攸往，無咎。', baihua: '二爻阳位：大车载物、有所往无咎，能任。' },
      { name: '九三', original: '公用亨于天子，小人弗克。', baihua: '三爻阳位：公享天子之宴，小人不能当，分际有别。' },
      { name: '九四', original: '匪其彭，無咎。', baihua: '四爻阳位：不恃盛大、谦退无咎。' },
      { name: '六五', original: '厥孚交如，威如，吉。', baihua: '五爻阴位：诚信交孚、威仪自显，吉。' },
      { name: '上九', original: '自天佑之，吉無不利。', baihua: '上爻阳位：自天佑之，吉无不利，盛而得天助。' },
    ]
  },
  '地山谦': {
    number: 15,
    short: '谦',
    guaCi: { original: '謙，亨，君子有終。', baihua: '谦卦，亨通，君子有终。谦逊持中。' },
    xiangCi: { original: '地中有山，謙。君子以裒多益寡，稱物平施。', baihua: '地中有山、谦，君子当损多益寡、称量均施。' },
    yaoCi: [
      { name: '初六', original: '謙謙君子，用涉大川，吉。', baihua: '初爻阴位：谦而又谦的君子，涉大川吉。' },
      { name: '六二', original: '鳴謙，貞吉。', baihua: '二爻阴位：谦名外闻、守正吉。' },
      { name: '九三', original: '勞謙君子，有終吉。', baihua: '三爻阳位：劳苦而谦的君子，有终吉。' },
      { name: '六四', original: '無不利，撝謙。', baihua: '四爻阴位：无所不利、发挥谦德。' },
      { name: '六五', original: '不富，以其鄰，利用侵伐，無不利。', baihua: '五爻阴位：不富而亲邻，利于征伐、无不利。' },
      { name: '上六', original: '鳴謙，利用行師，征邑國。', baihua: '上爻阴位：谦名外闻、利于行师征邑国。' },
    ]
  },
  '雷地豫': {
    number: 16,
    short: '豫',
    guaCi: { original: '豫，利建侯行師。', baihua: '豫卦，利于建侯行师。欢愉振奋、顺势而动。' },
    xiangCi: { original: '雷出地奮，豫。先王以作樂崇德，殷荐之上帝，以配祖考。', baihua: '雷出地奋、豫，先王作乐崇德、荐之上帝配祖考。' },
    yaoCi: [
      { name: '初六', original: '鳴豫，凶。', baihua: '初爻阴位：自鸣得意之豫，凶。' },
      { name: '六二', original: '介于石，不終日，貞吉。', baihua: '二爻阴位：介然如石、不终日，守正吉。' },
      { name: '六三', original: '盱豫，悔。遲有悔。', baihua: '三爻阴位：媚上之豫，悔；迟则更悔。' },
      { name: '九四', original: '由豫，大有得。勿疑朋盍簪。', baihua: '四爻阳位：由豫大有所得，勿疑、朋友聚来。' },
      { name: '六五', original: '貞疾，恆不死。', baihua: '五爻阴位：守正防疾、恒而不死，宜持。' },
      { name: '上六', original: '冥豫，成有渝，無咎。', baihua: '上爻阴位：冥顽之豫，成而能变则无咎。' },
    ]
  },
  '泽雷随': {
    number: 17,
    short: '随',
    guaCi: { original: '隨，元亨，利貞，無咎。', baihua: '随卦，元亨，利贞无咎。随顺时势。' },
    xiangCi: { original: '澤中有雷，隨。君子以向晦入宴息。', baihua: '泽中有雷、随，君子当日入则息、随时宴安。' },
    yaoCi: [
      { name: '初九', original: '官有渝，貞吉。出門交有功。', baihua: '初爻阳位：职事有变、守正吉，出门交则有功。' },
      { name: '六二', original: '系小子，失丈夫。', baihua: '二爻阴位：系恋小子、失丈夫，取舍宜明。' },
      { name: '六三', original: '系丈夫，失小子。隨有求得，利居貞。', baihua: '三爻阴位：系恋丈夫、失小子，随而有得、利居守。' },
      { name: '九四', original: '隨有獲，貞凶。有孚在道，以明，何咎？', baihua: '四爻阳位：随而有获、守正防凶；有信在道、明则无咎。' },
      { name: '九五', original: '孚于嘉，吉。', baihua: '五爻阳位：信于美善，吉。' },
      { name: '上六', original: '拘系之，乃從維之。王用亨于西山。', baihua: '上爻阴位：拘系维絷，王享于西山，礼成。' },
    ]
  },
  '山风蛊': {
    number: 18,
    short: '蛊',
    guaCi: { original: '蠱，元亨，利涉大川。先甲三日，后甲三日。', baihua: '蛊卦，元亨，利涉大川。先甲三日、后甲三日，整饬积弊。' },
    xiangCi: { original: '山下有風，蠱。君子以振民育德。', baihua: '山下有风、蛊，君子当振民育德、拨乱反正。' },
    yaoCi: [
      { name: '初六', original: '干父之蠱，有子，考無咎，厲，終吉。', baihua: '初爻阴位：整治父辈之积弊，有子则父无咎，危而终吉。' },
      { name: '九二', original: '干母之蠱，不可貞。', baihua: '二爻阳位：整治母辈之积弊，不可强正，宜柔。' },
      { name: '九三', original: '干父之蠱，小有晦，無大咎。', baihua: '三爻阳位：整治父弊、小有悔无大咎。' },
      { name: '六四', original: '裕父之蠱，往見吝。', baihua: '四爻阴位：宽容父弊、往见吝，治之不力。' },
      { name: '六五', original: '干父之蠱，用譽。', baihua: '五爻阴位：整治父弊、用誉，得称道。' },
      { name: '上九', original: '不事王侯，高尚其事。', baihua: '上爻阳位：不事王侯、高尚其事，退守其志。' },
    ]
  },
  '地泽临': {
    number: 19,
    short: UI_COPY.divination['dlr-lin'],
    guaCi: { original: '臨，元亨，利貞。至于八月有凶。', baihua: '临卦，元亨利贞，至八月有凶。阳长临物。' },
    xiangCi: { original: '澤上有地，臨。君子以教思無窮、容保民無疆。', baihua: '泽上有地、临，君子当教思无穷、容保民无疆。' },
    yaoCi: [
      { name: '初九', original: '咸臨，貞吉。', baihua: '初爻阳位：以感临之、守正吉。' },
      { name: '九二', original: '咸臨，吉無不利。', baihua: '二爻阳位：以感临之、吉无不利。' },
      { name: '六三', original: '甘臨，無攸利。既憂之，無咎。', baihua: '三爻阴位：以甘临之、无所利；既知忧则无咎。' },
      { name: '六四', original: '至臨，無咎。', baihua: '四爻阴位：至诚亲临，无咎。' },
      { name: '六五', original: '知臨，大君之宜，吉。', baihua: '五爻阴位：以睿临之、大君之宜，吉。' },
      { name: '上六', original: '敦臨，吉，無咎。', baihua: '上爻阴位：敦厚亲临，吉无咎。' },
    ]
  },
  '风地观': {
    number: 20,
    short: '观',
    guaCi: { original: '觀，盥而不荐，有孚顒若。', baihua: '观卦，盥洗诚敬而未献，有孚颙然。观瞻省察。' },
    xiangCi: { original: '風行地上，觀。先王以省方，觀民設教。', baihua: '风行地上、观，先王省方观民、设教化。' },
    yaoCi: [
      { name: '初六', original: '童觀，小人無咎，君子吝。', baihua: '初爻阴位：幼稚之观，小人无咎、君子吝，宜深察。' },
      { name: '六二', original: '窺觀，利女貞。', baihua: '二爻阴位：窥视之观，利女守正，所见狭隘。' },
      { name: '六三', original: '觀我生，進退。', baihua: '三爻阴位：观我生而进退，自审行藏。' },
      { name: '六四', original: '觀國之光，利用賓于王。', baihua: '四爻阴位：观国之光，利于为王者宾。' },
      { name: '九五', original: '觀我生，君子無咎。', baihua: '五爻阳位：观我生、君子无咎，反身自省。' },
      { name: '上九', original: '觀其生，君子無咎。', baihua: '上爻阳位：观其生、君子无咎，观人亦观己。' },
    ]
  },
  '火雷噬嗑': {
    number: 21,
    short: '噬嗑',
    guaCi: { original: '噬嗑，亨。利用獄。', baihua: '噬嗑卦，亨通，利于用刑狱。咬合决断。' },
    xiangCi: { original: '雷電噬嗑。先王以明罰敕法。', baihua: '雷电噬嗑，先王明罚敕法、清除梗阻。' },
    yaoCi: [
      { name: '初九', original: '履校滅趾，無咎。', baihua: '初爻阳位：足戴刑械、灭趾，小惩大诫无咎。' },
      { name: '六二', original: '噬膚滅鼻，無咎。', baihua: '二爻阴位：咬肤灭鼻，去碍无咎。' },
      { name: '六三', original: '噬臘肉，遇毒。小吝，無咎。', baihua: '三爻阴位：咬腊肉遇毒，小吝无咎，宜缓。' },
      { name: '九四', original: '噬乾胏，得金矢，利艱貞，吉。', baihua: '四爻阳位：咬干胏得金矢，利艰守吉，刚中。' },
      { name: '六五', original: '噬乾肉，得黃金，貞厲，無咎。', baihua: '五爻阴位：咬干肉得黄金，守正防危无咎。' },
      { name: '上九', original: '何校滅耳，凶。', baihua: '上爻阳位：肩扛刑械灭耳，凶，罚及其身。' },
    ]
  },
  '山火贲': {
    number: 22,
    short: '贲',
    guaCi: { original: '賁，亨。小利有所往。', baihua: '贲卦，亨通，小利有所往。文饰润色。' },
    xiangCi: { original: '山下有火，賁。君子以明庶政，無敢折獄。', baihua: '山下有火、贲，君子明庶政、不敢折狱。' },
    yaoCi: [
      { name: '初九', original: '賁其趾，舍車而徒。', baihua: '初爻阳位：文饰其趾，舍车徒步，守质。' },
      { name: '六二', original: '賁其須。', baihua: '二爻阴位：文饰其须，附从而美。' },
      { name: '九三', original: '賁如濡如，永貞吉。', baihua: '三爻阳位：文饰润泽、永守正吉。' },
      { name: '六四', original: '賁如皤如，白馬翰如，匪寇婚媾。', baihua: '四爻阴位：文饰皤然、白马翰如，非寇乃婚媾。' },
      { name: '六五', original: '賁于丘園，束帛戔戔，吝，終吉。', baihua: '五爻阴位：文饰丘园、束帛戋戋，吝而终吉。' },
      { name: '上九', original: '白賁，無咎。', baihua: '上爻阳位：白贲无饰，返璞无咎。' },
    ]
  },
  '山地剥': {
    number: 23,
    short: '剥',
    guaCi: { original: '剝，不利有攸往。', baihua: '剥卦，不利有攸往。剥落侵蚀。' },
    xiangCi: { original: '山附地上，剝。上以厚下安宅。', baihua: '山附地上、剥，上位者当厚下安宅。' },
    yaoCi: [
      { name: '初六', original: '剝床以足，蔑貞凶。', baihua: '初爻阴位：剥床及足，灭正凶，根基先伤。' },
      { name: '六二', original: '剝床以辨，蔑貞凶。', baihua: '二爻阴位：剥床及辨，灭正凶，渐及身上。' },
      { name: '六三', original: '剝之，無咎。', baihua: '三爻阴位：剥之无咎，独善其身。' },
      { name: '六四', original: '剝床以膚，凶。', baihua: '四爻阴位：剥床及肤，凶，切身之患。' },
      { name: '六五', original: '貫魚，以宮人寵，無不利。', baihua: '五爻阴位：贯鱼以宫人宠，顺序无不利。' },
      { name: '上九', original: '碩果不食，君子得輿，小人剝廬。', baihua: '上爻阳位：硕果不食，君子得舆、小人剥庐，存仁则兴。' },
    ]
  },
  '地雷复': {
    number: 24,
    short: '复',
    guaCi: { original: '復，亨。出入無疾，朋來無咎。反復其道，七日來復，利有攸往。', baihua: '复卦，亨通。出入无疾、朋来无咎，反复其道、七日来复，利有攸往。生机回还。' },
    xiangCi: { original: '雷在地中，復。先王以至日閉關，商旅不行，后不省方。', baihua: '雷在地中、复，先王至日闭关、商旅不行。' },
    yaoCi: [
      { name: '初九', original: '不復遠，無只悔，元吉。', baihua: '初爻阳位：不远即复、无大悔，元吉。' },
      { name: '六二', original: '休復，吉。', baihua: '二爻阴位：从容而复，吉。' },
      { name: '六三', original: '頻復，厲，無咎。', baihua: '三爻阴位：频失频复、危无咎，宜稳。' },
      { name: '六四', original: '中行獨復。', baihua: '四爻阴位：中行独复，守其本。' },
      { name: '六五', original: '敦復，無悔。', baihua: '五爻阴位：敦厚而复，无悔。' },
      { name: '上六', original: '迷復，凶，有災眚。用行師，終有大敗，以其國君凶。至于十年不克征。', baihua: '上爻阴位：迷而不复，凶有灾眚；用师大败、国君凶，十年不克征。' },
    ]
  },
  '天雷无妄': {
    number: 25,
    short: '无妄',
    guaCi: { original: '無妄，元亨，利貞。其匪正有眚，不利有攸往。', baihua: '无妄卦，元亨利贞。不妄为、守正；若心术不正则有灾，不宜妄动。' },
    xiangCi: { original: '天下雷行，物與無妄。先王以茂對時，育萬物。', baihua: '天下雷行、物与无妄，先王对时育物。' },
    yaoCi: [
      { name: '初九', original: '無妄往，吉。', baihua: '初爻阳位：不妄为而往，吉。' },
      { name: '六二', original: '不耕獲，不菑畬，則利有攸往。', baihua: '二爻阴位：不耕而获、不垦而熟，则利有攸往，顺其自然。' },
      { name: '六三', original: '無妄之災，或系之牛，行人之得，邑人之災。', baihua: '三爻阴位：无妄之灾，如牛被系、行人得之、邑人受灾，祸非自取。' },
      { name: '九四', original: '可貞，無咎。', baihua: '四爻阳位：可守正无咎，安分。' },
      { name: '九五', original: '無妄之疾，勿藥有喜。', baihua: '五爻阳位：无妄之疾，勿药有喜，不药而愈。' },
      { name: '上九', original: '無妄行，有眚，無攸利。', baihua: '上爻阳位：无妄而行有灾、无所利，妄动招损。' },
    ]
  },
  '山天大畜': {
    number: 26,
    short: '大畜',
    guaCi: { original: '大畜，利貞。不家食吉，利涉大川。', baihua: '大畜卦，利贞。不家食吉，利涉大川。大为积蓄。' },
    xiangCi: { original: '天在山中，大畜。君子以多識前言往行，以畜其德。', baihua: '天在山中、大畜，君子多识前言往行、以畜其德。' },
    yaoCi: [
      { name: '初九', original: '有厲，利已。', baihua: '初爻阳位：有危宜止，利已。' },
      { name: '九二', original: '輿說輻。', baihua: '二爻阳位：车轮脱辐，小碍宜停。' },
      { name: '九三', original: '良馬逐，利艱貞。曰閑輿衛，利有攸往。', baihua: '三爻阳位：良马驰逐、利艰守；闲习车卫，利有攸往。' },
      { name: '六四', original: '童豕之牿，元吉。', baihua: '四爻阴位：童牛加牿、元吉，豫防其角。' },
      { name: '六五', original: '豶豕之牙，吉。', baihua: '五爻阴位：豶豕去势其牙、吉，去其悍。' },
      { name: '上九', original: '何天之衢，亨。', baihua: '上爻阳位：何天之衢、亨，通达无碍。' },
    ]
  },
  '山雷颐': {
    number: 27,
    short: '颐',
    guaCi: { original: '頤，貞吉。觀頤，自求口實。', baihua: '颐卦，守正吉。观颐、自求口实。颐养之道。' },
    xiangCi: { original: '山下有雷，頤。君子以慎言語，節飲食。', baihua: '山下有雷、颐，君子慎言语、节饮食。' },
    yaoCi: [
      { name: '初九', original: '舍爾靈龜，觀我朵頤，凶。', baihua: '初爻阳位：舍灵龟而观我朵颐，凶，弃本逐末。' },
      { name: '六二', original: '顛頤，拂經，于丘頤，征凶。', baihua: '二爻阴位：颠颐拂经、于丘颐，征凶，养非其所。' },
      { name: '六三', original: '拂頤，貞凶，十年勿用，無攸利。', baihua: '三爻阴位：拂颐守正凶，十年勿用、无所利，违养。' },
      { name: '六四', original: '顛頤吉，虎視眈眈，其欲逐逐，無咎。', baihua: '四爻阴位：颠颐吉，虎视眈眈、其欲逐逐，无咎，专养。' },
      { name: '六五', original: '拂經，居貞吉，不可涉大川。', baihua: '五爻阴位：拂经居守吉，不可涉大川，宜静养。' },
      { name: '上九', original: '由頤，厲，吉，利涉大川。', baihua: '上爻阳位：由颐、危吉，利涉大川，养得其道。' },
    ]
  },
  '泽风大过': {
    number: 28,
    short: '大过',
    guaCi: { original: '大過，棟橈，利有攸往，亨。', baihua: '大过卦，栋梁受压弯曲，利有攸往、亨。非常之局。' },
    xiangCi: { original: '澤滅木，大過。君子以獨立不懼，遯世無悶。', baihua: '泽灭木、大过，君子独立不惧、遁世无闷。' },
    yaoCi: [
      { name: '初六', original: '藉用白茅，無咎。', baihua: '初爻阴位：藉用白茅、无咎，谨慎承托。' },
      { name: '九二', original: '枯楊生稊，老夫得其女妻，無不利。', baihua: '二爻阳位：枯杨生稊、老夫得女妻，无不利，枯木逢春。' },
      { name: '九三', original: '棟橈，凶。', baihua: '三爻阳位：栋梁弯曲，凶，承重过甚。' },
      { name: '九四', original: '棟隆，吉。有它吝。', baihua: '四爻阳位：栋梁隆起、吉，有他吝，纠偏得正。' },
      { name: '九五', original: '枯楊生華，老婦得其士夫，無咎無譽。', baihua: '五爻阳位：枯杨生华、老妇得士夫，无咎无誉，虚华。' },
      { name: '上六', original: '過涉滅頂，凶，無咎。', baihua: '上爻阴位：过涉灭顶，凶，然志可无咎，赴义。' },
    ]
  },
  '坎为水': {
    number: 29,
    short: '坎',
    guaCi: { original: '坎，習坎，有孚，維心亨，行有尚。', baihua: '坎卦，重险习坎，有孚、维系心亨，行有尚。险陷。' },
    xiangCi: { original: '水洊至，習坎。君子以常德行，習教事。', baihua: '水洊至、习坎，君子常德行、习教事。' },
    yaoCi: [
      { name: '初六', original: '習坎，入于坎窞，凶。', baihua: '初爻阴位：习坎入于坎窞，凶，陷之又陷。' },
      { name: '九二', original: '坎有險，求小得。', baihua: '二爻阳位：坎中有险，求小得，缓图。' },
      { name: '六三', original: '來之坎坎，險且枕，入于坎窞，勿用。', baihua: '三爻阴位：来去皆坎、险且枕，入窞勿用，宜止。' },
      { name: '六四', original: '樽酒簋貳，用缶，納約自牖，終無咎。', baihua: '四爻阴位：樽酒簋贰用缶、纳约自牖，终无咎，以诚通。' },
      { name: '九五', original: '坎不盈，祇既平，無咎。', baihua: '五爻阳位：坎不盈、祇既平，无咎，险将平。' },
      { name: '上六', original: '係用徽纆，置于叢棘，三歲不得，凶。', baihua: '上爻阴位：系用徽纆、置于丛棘，三岁不得，凶，久困。' },
    ]
  },
  '离为火': {
    number: 30,
    short: '离',
    guaCi: { original: '離，利貞，亨。畜牝牛吉。', baihua: '离卦，利贞亨，畜牝牛吉。光明依附。' },
    xiangCi: { original: '明兩作，離。大人以繼明照于四方。', baihua: '明两作、离，大人继明照于四方。' },
    yaoCi: [
      { name: '初九', original: '履錯然，敬之無咎。', baihua: '初爻阳位：履错然、敬之无咎，起步宜慎。' },
      { name: '六二', original: '黃離，元吉。', baihua: '二爻阴位：黄离、元吉，中正附丽。' },
      { name: '九三', original: '日昃之離，不鼓缶而歌，則大耋之嗟，凶。', baihua: '三爻阳位：日昃之离，不歌则嗟、大耋凶，暮景宜安。' },
      { name: '九四', original: '突如其來如，焚如，死如，棄如。', baihua: '四爻阳位：突如其来如、焚如死如弃如，骤变凶。' },
      { name: '六五', original: '出涕沱若，戚嗟若，吉。', baihua: '五爻阴位：出涕沱若、戚嗟若，吉，忧而能惧。' },
      { name: '上九', original: '王用出征，有嘉折首，獲其匪丑，無咎。', baihua: '上爻阳位：王用出征、折首获丑，无咎，明罚。' },
    ]
  },
  '泽山咸': {
    number: 31,
    short: '咸',
    guaCi: { original: '咸，亨，利貞。取女吉。', baihua: '咸卦，亨，利贞，取女吉。两感相应。' },
    xiangCi: { original: '山上有澤，咸。君子以虛受人。', baihua: '山上有泽、咸，君子以虚受人。' },
    yaoCi: [
      { name: '初六', original: '咸其拇。', baihua: '初爻阴位：感其拇，微动于下。' },
      { name: '六二', original: '咸其腓，凶，居吉。', baihua: '二爻阴位：感其腓、凶，居则吉，妄动不宜。' },
      { name: '九三', original: '咸其股，執其隨，往吝。', baihua: '三爻阴位：感其股、执其随，往吝，随人失主。' },
      { name: '九四', original: '貞吉悔亡，憧憧往來，朋從爾思。', baihua: '四爻阳位：守正吉悔亡，憧憧往来、朋从尔思，感应有方。' },
      { name: '九五', original: '咸其脢，無悔。', baihua: '五爻阳位：感其脢、无悔，感于不动之处。' },
      { name: '上六', original: '咸其輔、頰、舌。', baihua: '上爻阴位：感其辅颊舌，感于言辞。' },
    ]
  },
  '雷风恒': {
    number: 32,
    short: '恒',
    guaCi: { original: '恆，亨，無咎，利貞，利有攸往。', baihua: '恒卦，亨无咎，利贞，利有攸往。恒久守常。' },
    xiangCi: { original: '雷風，恆。君子以立不易方。', baihua: '雷风、恒，君子立不易方。' },
    yaoCi: [
      { name: '初六', original: '浚恆，貞凶，無攸利。', baihua: '初爻阴位：浚深其恒、守正凶，无所利，求恒太急。' },
      { name: '九二', original: '悔亡。', baihua: '二爻阳位：悔亡，恒而得中。' },
      { name: '九三', original: '不恆其德，或承之羞，貞吝。', baihua: '三爻阴位：不恒其德、或承之羞，守正吝，德不一。' },
      { name: '九四', original: '田無禽。', baihua: '四爻阳位：田无禽，徒劳无获。' },
      { name: '六五', original: '恆其德，貞婦人吉，夫子凶。', baihua: '五爻阴位：恒其德、贞妇人吉、夫子凶，守宜有别。' },
      { name: '上六', original: '振恆，凶。', baihua: '上爻阴位：振恒、凶，恒而失度。' },
    ]
  },
  '天山遁': {
    number: 33,
    short: '遁',
    guaCi: { original: '遯，亨，小利貞。', baihua: '遁卦，亨，小利贞。退避隐遁。' },
    xiangCi: { original: '天下有山，遯。君子以遠小人，不惡而嚴。', baihua: '天下有山、遁，君子远小人、不恶而严。' },
    yaoCi: [
      { name: '初六', original: '遯尾，厲，勿用有攸往。', baihua: '初爻阴位：遁尾、危，勿用有攸往，退已晚。' },
      { name: '六二', original: '執之用黃牛之革，莫之勝說。', baihua: '二爻阴位：执之用黄牛之革，莫能脱，坚隐。' },
      { name: '九三', original: '系遯，有疾厲，畜臣妾吉。', baihua: '三爻阴位：系恋而遁、有疾厉，畜臣妾吉，牵绊。' },
      { name: '九四', original: '好遯，君子吉，小人否。', baihua: '四爻阳位：好遁、君子吉，小人否，洒脱。' },
      { name: '九五', original: '嘉遯，貞吉。', baihua: '五爻阳位：嘉遁、守正吉，美退。' },
      { name: '上九', original: '肥遯，無不利。', baihua: '上爻阳位：肥遁、无不利，远走高飞。' },
    ]
  },
  '雷天大壮': {
    number: 34,
    short: '大壮',
    guaCi: { original: '大壯，利貞。', baihua: '大壮卦，利贞。阳刚壮盛。' },
    xiangCi: { original: '雷在天上，大壯。君子以非禮勿履。', baihua: '雷在天上、大壮，君子非礼勿履。' },
    yaoCi: [
      { name: '初九', original: '壯于趾，征凶，有孚。', baihua: '初爻阳位：壮于趾、征凶，有孚，进宜慎。' },
      { name: '九二', original: '貞吉。', baihua: '二爻阳位：守正吉，壮而能正。' },
      { name: '九三', original: '小人用壯，君子用罔，貞厲。羝羊觸藩，羸其角。', baihua: '三爻阳位：小人用壮、君子用罔，守正危；羝羊触藩、羸其角，妄进受困。' },
      { name: '九四', original: '貞吉悔亡，藩決不羸，壯于大輿之輹。', baihua: '四爻阳位：守正吉悔亡，藩决不羸、壮于大舆之輹，碍去。' },
      { name: '六五', original: '喪羊于易，無悔。', baihua: '五爻阴位：丧羊于易、无悔，失而能安。' },
      { name: '上六', original: '羝羊觸藩，不能退，不能遂，無攸利，艱則吉。', baihua: '上爻阴位：羝羊触藩、不能退不能遂，无所利，艰则吉。' },
    ]
  },
  '火地晋': {
    number: 35,
    short: '晋',
    guaCi: { original: '晉，康侯用錫馬蕃庶，晝日三接。', baihua: '晋卦，康侯用锡马蕃庶、昼日三接。进而有光。' },
    xiangCi: { original: '明出地上，晉。君子以自昭明德。', baihua: '明出地上、晋，君子自昭明德。' },
    yaoCi: [
      { name: '初六', original: '晉如，摧如，貞吉。罔孚，裕，無咎。', baihua: '初爻阴位：晋如摧如、守正吉；未孚而宽裕无咎。' },
      { name: '六二', original: '晉如，愁如，貞吉。受茲介福于其王母。', baihua: '二爻阴位：晋如愁如、守正吉，受福于王母。' },
      { name: '六三', original: '眾允，悔亡。', baihua: '三爻阴位：众信、悔亡，得人助。' },
      { name: '九四', original: '晉如碩鼠，貞厲。', baihua: '四爻阳位：晋如硕鼠、守正危，贪进如鼠。' },
      { name: '六五', original: '悔亡，失得勿恤，往吉，無不利。', baihua: '五爻阴位：悔亡、失得勿恤，往吉无不利。' },
      { name: '上九', original: '晉其角，維用伐邑，厲，吉，無咎，貞吝。', baihua: '上爻阳位：晋其角、维用伐邑，危吉无咎，守正吝。' },
    ]
  },
  '地火明夷': {
    number: 36,
    short: '明夷',
    guaCi: { original: '明夷，利艱貞。', baihua: '明夷卦，利艰贞。光明受损、晦暗之时。' },
    xiangCi: { original: '明入地中，明夷。君子以蒞眾，用晦而明。', baihua: '明入地中、明夷，君子莅众、用晦而明。' },
    yaoCi: [
      { name: '初九', original: '明夷于飛，垂其翼。君子于行，三日不食。有攸往，主人有言。', baihua: '初爻阳位：明夷于飞、垂其翼；君子于行、三日不食，往则主人有言，宜忍。' },
      { name: '六二', original: '明夷，夷于左股，用拯馬壯，吉。', baihua: '二爻阴位：明夷伤左股，用壮马拯之吉，得助。' },
      { name: '九三', original: '明夷于南狩，得其大首，不可疾貞。', baihua: '三爻阳位：明夷南狩、得其大首，不可疾贞，缓图。' },
      { name: '六四', original: '入于左腹，獲明夷之心，于出門庭。', baihua: '四爻阴位：入左腹、获明夷之心，于出门庭，内省得要。' },
      { name: '六五', original: '箕子之明夷，利貞。', baihua: '五爻阴位：箕子之明夷、利贞，晦其明而守。' },
      { name: '上六', original: '不明晦，初登于天，后入于地。', baihua: '上爻阴位：不明晦、初登天后天入地，明暗反转。' },
    ]
  },
  '风火家人': {
    number: 37,
    short: '家人',
    guaCi: { original: '家人，利女貞。', baihua: '家人卦，利女贞。家道整肃。' },
    xiangCi: { original: '風自火出，家人。君子以言有物，而行有恆。', baihua: '风自火出、家人，君子言有物、行有恒。' },
    yaoCi: [
      { name: '初九', original: '閑有家，悔亡。', baihua: '初爻阳位：闲有家、悔亡，治家先立规。' },
      { name: '六二', original: '無攸遂，在中饋，貞吉。', baihua: '二爻阴位：无所专遂、主中馈，守正吉，妇职。' },
      { name: '九三', original: '家人嗃嗃，悔厲吉。婦子嘻嘻，終吝。', baihua: '三爻阳位：家人嗃嗃、悔厉吉；妇子嘻嘻、终吝，严而过宽皆失。' },
      { name: '六四', original: '富家，大吉。', baihua: '四爻阴位：富家、大吉，家和生财。' },
      { name: '九五', original: '王假有家，勿恤吉。', baihua: '五爻阳位：王假有家、勿恤吉，家齐国治。' },
      { name: '上九', original: '有孚威如，終吉。', baihua: '上爻阳位：有孚威如、终吉，威恩并施。' },
    ]
  },
  '火泽睽': {
    number: 38,
    short: '睽',
    guaCi: { original: '睽，小事吉。', baihua: '睽卦，小事吉。乖离相背。' },
    xiangCi: { original: '上火下澤，睽。君子以同而異。', baihua: '上火下泽、睽，君子同而异。' },
    yaoCi: [
      { name: '初九', original: '悔亡，喪馬勿逐，自復。見惡人無咎。', baihua: '初爻阳位：悔亡，丧马勿逐自复；见恶人无咎，化敌。' },
      { name: '九二', original: '遇主于巷，無咎。', baihua: '二爻阳位：遇主于巷、无咎，不期而遇。' },
      { name: '六三', original: '見輿曳，其牛掣，其人天且劓，無初有終。', baihua: '三爻阴位：见舆曳、其牛掣，人天且劓，无初有终，困而通。' },
      { name: '九四', original: '睽孤，遇元夫，交孚，厲，無咎。', baihua: '四爻阳位：睽孤遇元夫、交孚，危无咎，孤而得助。' },
      { name: '六五', original: '悔亡，厥宗噬膚，往何咎。', baihua: '五爻阴位：悔亡、厥宗噬肤，往何咎，亲族相和。' },
      { name: '上九', original: '睽孤，見豕負涂，載鬼一車，先張之弧，后說之弧，匪寇婚媾，往遇雨則吉。', baihua: '上爻阳位：睽孤见豕负涂、载鬼一车，先张弧后说弧，匪寇婚媾，遇雨则吉，疑释。' },
    ]
  },
  '水山蹇': {
    number: 39,
    short: '蹇',
    guaCi: { original: '蹇，利西南，不利東北。利見大人。貞吉。', baihua: '蹇卦，利西南、不利东北，利见大人，守正吉。山高水险。' },
    xiangCi: { original: '山上有水，蹇。君子以反身修德。', baihua: '山上有水、蹇，君子反身修德。' },
    yaoCi: [
      { name: '初六', original: '往蹇，來譽。', baihua: '初爻阴位：往蹇来誉，退而有名。' },
      { name: '六二', original: '王臣蹇蹇，匪躬之故。', baihua: '二爻阴位：王臣蹇蹇、匪躬之故，尽忠不避。' },
      { name: '九三', original: '往蹇來反。', baihua: '三爻阳位：往蹇来反，退而自守。' },
      { name: '六四', original: '往蹇來連。', baihua: '四爻阴位：往蹇来连，退而相连。' },
      { name: '九五', original: '大蹇朋來。', baihua: '五爻阳位：大蹇朋来，困极得助。' },
      { name: '上六', original: '往蹇來碩，吉。利見大人。', baihua: '上爻阴位：往蹇来硕、吉，利见大人，终得转机。' },
    ]
  },
  '雷水解': {
    number: 40,
    short: '解',
    guaCi: { original: '解，利西南。無所往，其來復吉。有攸往，夙吉。', baihua: '解卦，利西南。无所往则来复吉，有攸往夙吉。险难化解。' },
    xiangCi: { original: '雷雨作，解。君子以赦過宥罪。', baihua: '雷雨作、解，君子赦过宥罪。' },
    yaoCi: [
      { name: '初六', original: '無咎。', baihua: '初爻阴位：无咎，初解无忧。' },
      { name: '九二', original: '田獲三狐，得黃矢，貞吉。', baihua: '二爻阳位：田获三狐、得黄矢，守正吉，去邪得直。' },
      { name: '六三', original: '負且乘，致寇至，貞吝。', baihua: '三爻阴位：负且乘、致寇至，守正吝，露财招盗。' },
      { name: '九四', original: '解而拇，朋至斯孚。', baihua: '四爻阳位：解其拇、朋至斯孚，释小碍得友。' },
      { name: '六五', original: '君子維有解，吉。有孚于小人。', baihua: '五爻阴位：君子维有解、吉，有孚于小人，化敌。' },
      { name: '上六', original: '公用射隼于高墉之上，獲之，無不利。', baihua: '上爻阳位：公用射隼于高墉、获之无不利，除害。' },
    ]
  },
  '山泽损': {
    number: 41,
    short: '损',
    guaCi: { original: '損，有孚，元吉，無咎，可貞，利有攸往。曷之用二簋，可用享。', baihua: '损卦，有孚、元吉无咎、可贞，利有攸往。二簋可用享，减省。' },
    xiangCi: { original: '山下有澤，損。君子以懲忿窒欲。', baihua: '山下有泽、损，君子惩忿窒欲。' },
    yaoCi: [
      { name: '初九', original: '已事遄往，無咎，酌損之。', baihua: '初爻阳位：已事遄往无咎，酌损之，速行小损。' },
      { name: '九二', original: '利貞，征凶，弗損益之。', baihua: '二爻阳位：利贞、征凶，弗损益之，不损反益。' },
      { name: '六三', original: '三人行，則損一人。一人行，則得其友。', baihua: '三爻阴位：三人行则损一人，一人行则得其友，损益相得。' },
      { name: '六四', original: '損其疾，使遄有喜，無咎。', baihua: '四爻阴位：损其疾、使遄有喜无咎，去病。' },
      { name: '六五', original: '或益之，十朋之龜弗克違，元吉。', baihua: '五爻阴位：或益之十朋之龟弗克违，元吉，受大益。' },
      { name: '上九', original: '弗損，益之，無咎，貞吉，利有攸往。得臣無家。', baihua: '上爻阳位：弗损益之、无咎贞吉，利有攸往，得臣无家，不损而益。' },
    ]
  },
  '风雷益': {
    number: 42,
    short: '益',
    guaCi: { original: '益，利有攸往，利涉大川。', baihua: '益卦，利有攸往、利涉大川。增益成长。' },
    xiangCi: { original: '風雷，益。君子以見善則遷，有過則改。', baihua: '风雷、益，君子见善则迁、有过则改。' },
    yaoCi: [
      { name: '初九', original: '利用為大作，元吉，無咎。', baihua: '初爻阳位：利用为大作、元吉无咎，乘时而兴。' },
      { name: '六二', original: '或益之，十朋之龜弗克違，永貞吉。王用享于帝，吉。', baihua: '二爻阴位：或益之十朋之龟弗克违，永贞吉；王享于帝吉，受大益。' },
      { name: '六三', original: '益之用凶事，無咎。有孚中行，告公用圭。', baihua: '三爻阴位：益用于凶事无咎，有孚中行、告公用圭，因危得益。' },
      { name: '六四', original: '中行，告公從，利用為依遷國。', baihua: '四爻阴位：中行告公从、利用为依迁国，中道得人。' },
      { name: '九五', original: '有孚惠心，勿問元吉。有孚惠我德。', baihua: '五爻阳位：有孚惠心、勿问元吉，有孚惠我德，施惠得报。' },
      { name: '上九', original: '莫益之，或擊之，立心勿恆，凶。', baihua: '上爻阳位：莫益之、或击之，立心勿恒凶，贪益招损。' },
    ]
  },
  '泽天夬': {
    number: 43,
    short: '夬',
    guaCi: { original: '夬，揚于王庭，孚號，有厲，告自邑，不利即戎，利有攸往。', baihua: '夬卦，扬于王庭、孚号有厉，告自邑、不利即戎，利有攸往。决而能和。' },
    xiangCi: { original: '澤上于天，夬。君子以施祿及下，居德則忌。', baihua: '泽上于天、夬，君子施禄及下、居德则忌。' },
    yaoCi: [
      { name: '初九', original: '壯于前趾，往不勝為吝。', baihua: '初爻阳位：壮于前趾、往不胜为吝，轻进难成。' },
      { name: '九二', original: '惕號，莫夜有戎，勿恤。', baihua: '二爻阳位：惕号、莫夜有戎勿恤，警备无忧。' },
      { name: '九三', original: '壯于頄，有凶。君子夬夬獨行，遇雨若濡，有慍，無咎。', baihua: '三爻阳位：壮于頄、有凶；君子夬夬独行、遇雨若濡，有愠无咎，刚断。' },
      { name: '九四', original: '臀無膚，其行次且。牽羊悔亡，聞言不信。', baihua: '四爻阳位：臀无肤、其行次且，牵羊悔亡，闻言不信，行滞。' },
      { name: '九五', original: '莧陸夬夬中行，無咎。', baihua: '五爻阳位：苋陆夬夬中行、无咎，果断中道。' },
      { name: '上六', original: '無號，終有凶。', baihua: '上爻阴位：无号、终有凶，失警则危。' },
    ]
  },
  '天风姤': {
    number: 44,
    short: '姤',
    guaCi: { original: '姤，女壯，勿用取女。', baihua: '姤卦，女壮，勿用取女。不期而遇。' },
    xiangCi: { original: '天下有風，姤。后以施命誥四方。', baihua: '天下有风、姤，后施命诰四方。' },
    yaoCi: [
      { name: '初六', original: '系于金柅，貞吉，有攸往，見凶，羸豕踟躅。', baihua: '初爻阴位：系于金柅、守正吉；有攸往见凶，羸豕踟躅，微动宜制。' },
      { name: '九二', original: '包有魚，無咎，不利賓。', baihua: '二爻阳位：包有鱼、无咎，不利宾，近者得之。' },
      { name: '九三', original: '臀無膚，其行次且，厲，無大咎。', baihua: '三爻阳位：臀无肤、其行次且，厉无大咎，行滞。' },
      { name: '九四', original: '包無魚，起凶。', baihua: '四爻阳位：包无鱼、起凶，失所据。' },
      { name: '九五', original: '以杞包瓜，含章，有隕自天。', baihua: '五爻阳位：以杞包瓜、含章，有陨自天，含蓄待时。' },
      { name: '上九', original: '姤其角，吝，無咎。', baihua: '上爻阳位：姤其角、吝无咎，遇于角无争。' },
    ]
  },
  '泽地萃': {
    number: 45,
    short: '萃',
    guaCi: { original: '萃，亨。王假有廟，利見大人，亨，利貞。用大牲吉，利有攸往。', baihua: '萃卦，亨。王假有庙，利见大人，亨，利贞，用大牲吉，利有攸往。荟萃聚集。' },
    xiangCi: { original: '澤上於地，萃。君子以除戎器，戒不虞。', baihua: '泽上于地、萃，君子除戎器、戒不虞。' },
    yaoCi: [
      { name: '初六', original: '有孚不終，乃亂乃萃，若號，一握為笑，勿恤，往無咎。', baihua: '初爻阴位：有孚不终、乃乱乃萃，若号一握为笑，勿恤往无咎，诚乱复聚。' },
      { name: '六二', original: '引吉，無咎，孚乃利用禴。', baihua: '二爻阴位：引吉无咎，孚乃利用禴，牵引相聚。' },
      { name: '六三', original: '萃如，嗟如，無攸利，往無咎，小吝。', baihua: '三爻阴位：萃如嗟如、无所利，往无咎小吝，孤而不聚。' },
      { name: '九四', original: '大吉，無咎。', baihua: '四爻阳位：大吉无咎，聚得其位。' },
      { name: '九五', original: '萃有位，無咎。匪孚，元永貞，悔亡。', baihua: '五爻阴位：萃有位、无咎，匪孚、元永贞悔亡，居位聚人。' },
      { name: '上六', original: '齎咨涕洟，無咎。', baihua: '上爻阴位：齎咨涕洟、无咎，忧聚而通。' },
    ]
  },
  '地风升': {
    number: 46,
    short: '升',
    guaCi: { original: '升，元亨，用見大人，勿恤。南征吉。', baihua: '升卦，元亨，用见大人勿恤，南征吉。循序上升。' },
    xiangCi: { original: '地中生木，升。君子以順德，積小以高大。', baihua: '地中生木、升，君子顺德、积小以高大。' },
    yaoCi: [
      { name: '初六', original: '允升，大吉。', baihua: '初爻阴位：允升、大吉，信而上升。' },
      { name: '九二', original: '孚乃利用禴，無咎。', baihua: '二爻阳位：孚乃利用禴、无咎，诚而上升。' },
      { name: '九三', original: '升虛邑。', baihua: '三爻阳位：升虚邑，无阻而升。' },
      { name: '六四', original: '王用亨于岐山，吉無咎。', baihua: '四爻阴位：王用亨于岐山、吉无咎，顺天上升。' },
      { name: '六五', original: '貞吉，升階。', baihua: '五爻阴位：守正吉、升阶，步步登高。' },
      { name: '上六', original: '冥升，利于不息之貞。', baihua: '上爻阴位：冥升、利于不息之贞，昧进不止。' },
    ]
  },
  '泽水困': {
    number: 47,
    short: '困',
    guaCi: { original: '困，亨，貞大人吉，無咎。有言不信。', baihua: '困卦，亨，守正大人吉无咎，有言不信。困顿受制。' },
    xiangCi: { original: '澤無水，困。君子以致命遂志。', baihua: '泽无水、困，君子致命遂志。' },
    yaoCi: [
      { name: '初六', original: '臀困于株木，入于幽谷，三歲不見。', baihua: '初爻阴位：臀困于株木、入幽谷，三岁不见，久困。' },
      { name: '九二', original: '困于酒食，朱紱方來，利用亨祀，征凶，無咎。', baihua: '二爻阳位：困于酒食、朱紱方来，利用亨祀，征凶无咎，困而有享。' },
      { name: '六三', original: '困于石，據于蒺藜，入于其宮，不見其妻，凶。', baihua: '三爻阴位：困于石、据于蒺藜，入宫不见其妻，凶，进退皆碍。' },
      { name: '九四', original: '來徐徐，困于金車，吝，有終。', baihua: '四爻阳位：来徐徐、困于金车，吝有终，迟助。' },
      { name: '九五', original: '劓刖，困于赤紱，乃徐有說，利用祭祀。', baihua: '五爻阳位：劓刖、困于赤紱，乃徐有说，利用祭祀，困而缓释。' },
      { name: '上六', original: '困于葛藟，于臲卼，曰動悔，有悔，征吉。', baihua: '上爻阴位：困于葛藟、于臲卼，曰动悔有悔，征吉，困极思动。' },
    ]
  },
  '水风井': {
    number: 48,
    short: '井',
    guaCi: { original: '井，改邑不改井，無喪無得。往來井井，汔至亦未繘井，羸其瓶，凶。', baihua: '井卦，改邑不改井，无丧无得，往来井井；汔至亦未繘井、羸其瓶，凶。井养不穷。' },
    xiangCi: { original: '木上有水，井。君子以勞民勸相。', baihua: '木上有水、井，君子劳民劝相。' },
    yaoCi: [
      { name: '初六', original: '井泥不食，舊井無禽。', baihua: '初爻阴位：井泥不食、旧井无禽，废弃不治。' },
      { name: '九二', original: '井谷射鮒，瓮敝漏。', baihua: '二爻阳位：井谷射鲋、瓮敝漏，养而未成。' },
      { name: '九三', original: '井渫不食，為我民惻，可用汲，王明，并受其福。', baihua: '三爻阳位：井渫不食、为我民恻，可用汲，王明并受其福，洁净待用。' },
      { name: '六四', original: '井甃，無咎。', baihua: '四爻阴位：井甃、无咎，修治其壁。' },
      { name: '九五', original: '井冽，寒泉食。', baihua: '五爻阳位：井冽、寒泉食，清美可饮。' },
      { name: '上六', original: '井收勿幕，有孚元吉。', baihua: '上爻阴位：井收勿幕、有孚元吉，功成不掩。' },
    ]
  },
  '泽火革': {
    number: 49,
    short: '革',
    guaCi: { original: '革，己日乃孚，元亨利貞，悔亡。', baihua: '革卦，己日乃孚，元亨利贞，悔亡。变革除旧。' },
    xiangCi: { original: '澤中有火，革。君子以治歷明時。', baihua: '泽中有火、革，君子治历明时。' },
    yaoCi: [
      { name: '初九', original: '鞏用黃牛之革。', baihua: '初爻阳位：巩用黄牛之革，坚守待时。' },
      { name: '六二', original: '己日乃革之，征吉，無咎。', baihua: '二爻阴位：己日乃革之、征吉无咎，当革而革。' },
      { name: '九三', original: '征凶，貞厲，革言三就，有孚。', baihua: '三爻阳位：征凶守正危，革言三就、有孚，审而后行。' },
      { name: '九四', original: '悔亡，有孚改命，吉。', baihua: '四爻阳位：悔亡、有孚改命吉，信而变革。' },
      { name: '九五', original: '大人虎變，未占有孚。', baihua: '五爻阳位：大人虎变、未占有孚，变革昭明。' },
      { name: '上六', original: '君子豹變，小人革面，征凶，居貞吉。', baihua: '上爻阴位：君子豹变、小人革面，征凶居贞吉，变而有度。' },
    ]
  },
  '火风鼎': {
    number: 50,
    short: '鼎',
    guaCi: { original: '鼎，元吉，亨。', baihua: '鼎卦，元吉亨。鼎新之象。' },
    xiangCi: { original: '木上有火，鼎。君子以正位凝命。', baihua: '木上有火、鼎，君子正位凝命。' },
    yaoCi: [
      { name: '初六', original: '鼎顛趾，利出否，得妾以其子，無咎。', baihua: '初爻阴位：鼎颠趾、利出否，得妾以其子无咎，去故。' },
      { name: '九二', original: '鼎有實，我仇有疾，不我能即，吉。', baihua: '二爻阳位：鼎有实、我仇有疾不我能即，吉，实而待时。' },
      { name: '九三', original: '鼎耳革，其行塞，雉膏不食，方雨虧悔，終吉。', baihua: '三爻阳位：鼎耳革、其行塞，雉膏不食，方雨亏悔终吉，暂滞。' },
      { name: '九四', original: '鼎折足，覆公餗，其形渥，凶。', baihua: '四爻阴位：鼎折足、覆公餗、其形渥，凶，不胜其任。' },
      { name: '六五', original: '鼎黃耳金鉉，利貞。', baihua: '五爻阴位：鼎黄耳金铉、利贞，中正可用。' },
      { name: '上九', original: '鼎玉鉉，大吉，無不利。', baihua: '上爻阳位：鼎玉铉、大吉无不利，柔节而成。' },
    ]
  },
  '震为雷': {
    number: 51,
    short: '震',
    guaCi: { original: '震，亨。震來虩虩，笑言啞啞。震驚百里，不喪匕鬯。', baihua: '震卦，亨。震来虩虩、笑言哑哑，震惊百里、不丧匕鬯。震动戒惧。' },
    xiangCi: { original: '洊雷，震。君子以恐懼修身。', baihua: '洊雷、震，君子恐惧修身。' },
    yaoCi: [
      { name: '初九', original: '震來虩虩，后笑言啞啞，吉。', baihua: '初爻阳位：震来虩虩、后笑言哑哑，吉，惊而定。' },
      { name: '六二', original: '震來厲，億喪貝，躋于九陵，勿逐，七日得。', baihua: '二爻阴位：震来厉、亿丧贝，跻于九陵勿逐，七日得，失而复。' },
      { name: '六三', original: '震蘇蘇，震行無眚。', baihua: '三爻阴位：震苏苏、震行无眚，惧而能行。' },
      { name: '九四', original: '震遂泥。', baihua: '四爻阳位：震遂泥，陷于震中。' },
      { name: '六五', original: '震往來厲，億無喪，有事。', baihua: '五爻阴位：震往来厉、亿无丧有事，危而守业。' },
      { name: '上六', original: '震索索，視矍矍，征凶。震不于其躬，于其鄰，無咎。婚媾有言。', baihua: '上爻阴位：震索索、视矍矍，征凶；震不在躬在邻无咎，婚媾有言，惊及旁。' },
    ]
  },
  '艮为山': {
    number: 52,
    short: '艮',
    guaCi: { original: '艮，艮其背，不獲其身，行其庭，不見其人，無咎。', baihua: '艮卦，艮其背、不获其身，行其庭、不见其人，无咎。止当其止。' },
    xiangCi: { original: '兼山，艮。君子以思不出其位。', baihua: '兼山、艮，君子思不出其位。' },
    yaoCi: [
      { name: '初六', original: '艮其趾，無咎，利永貞。', baihua: '初爻阴位：艮其趾、无咎，利永贞，止之于始。' },
      { name: '六二', original: '艮其腓，不拯其隨，其心不快。', baihua: '二爻阴位：艮其腓、不拯其随，其心不快，止而难随。' },
      { name: '九三', original: '艮其限，列其夤，厲薰心。', baihua: '三爻阳位：艮其限、列其夤，厉薰心，止而受伤。' },
      { name: '六四', original: '艮其身，無咎。', baihua: '四爻阴位：艮其身、无咎，安其位。' },
      { name: '六五', original: '艮其輔，言有序，悔亡。', baihua: '五爻阴位：艮其辅、言有序，悔亡，止其言。' },
      { name: '上九', original: '敦艮，吉。', baihua: '上爻阳位：敦艮、吉，厚止。' },
    ]
  },
  '风山渐': {
    number: 53,
    short: '渐',
    guaCi: { original: '漸，女歸吉，利貞。', baihua: '渐卦，女归吉，利贞。循序渐进。' },
    xiangCi: { original: '山上有木，漸。君子以居賢德善俗。', baihua: '山上有木、渐，君子居贤德善俗。' },
    yaoCi: [
      { name: '初六', original: '鴻漸于干，小子厲。有言，無咎。', baihua: '初爻阴位：鸿渐于干、小子厉，有言无咎，始进宜慎。' },
      { name: '六二', original: '鴻漸于磐，飲食衎衎，吉。', baihua: '二爻阴位：鸿渐于磐、饮食衎衎，吉，安渐。' },
      { name: '九三', original: '鴻漸于陸，夫征不復，婦孕不育，凶。利御寇。', baihua: '三爻阳位：鸿渐于陆、夫征不复、妇孕不育，凶；利御寇，进失其偶。' },
      { name: '六四', original: '鴻漸于木，或得其桷，無咎。', baihua: '四爻阴位：鸿渐于木、或得其桷，无咎，得所依。' },
      { name: '九五', original: '鴻漸于陵，婦三歲不孕，終莫之勝，吉。', baihua: '五爻阳位：鸿渐于陵、妇三岁不孕终莫之胜，吉，久进得成。' },
      { name: '上九', original: '鴻漸于逵，其羽可用為儀，吉。', baihua: '上爻阳位：鸿渐于逵、其羽可用为仪，吉，进于高位。' },
    ]
  },
  '雷泽归妹': {
    number: 54,
    short: '归妹',
    guaCi: { original: '歸妹，征凶，無攸利。', baihua: '归妹卦，征凶、无所利。位置失当。' },
    xiangCi: { original: '澤上有雷，歸妹。君子以永終知敝。', baihua: '泽上有雷、归妹，君子永终知敝。' },
    yaoCi: [
      { name: '初九', original: '歸妹以娣，跛能履，征吉。', baihua: '初爻阳位：归妹以娣、跛能履，征吉，次之而进。' },
      { name: '九二', original: '眇能視，利幽人之貞。', baihua: '二爻阳位：眇能视、利幽人之贞，偏而能明。' },
      { name: '六三', original: '歸妹以須，反歸以娣。', baihua: '三爻阴位：归妹以须、反归于娣，待时而降。' },
      { name: '九四', original: '歸妹愆期，遲歸有時。', baihua: '四爻阳位：归妹愆期、迟归有时，延期得宜。' },
      { name: '六五', original: '帝乙歸妹，其君之袂，不如其娣之袂良，月几望，吉。', baihua: '五爻阴位：帝乙归妹、其君之袂不如其娣之袂良，月几望吉，谦而尊。' },
      { name: '上六', original: '女承筐無實，士刲羊無血，無攸利。', baihua: '上爻阴位：女承筐无实、士刲羊无血，无所利，名实不副。' },
    ]
  },
  '雷火丰': {
    number: 55,
    short: '丰',
    guaCi: { original: '丰，亨，王假之，勿憂，宜日中。', baihua: '丰卦，亨，王假之，勿忧，宜日中。丰盛盈满。' },
    xiangCi: { original: '雷電皆至，丰。君子以折獄致刑。', baihua: '雷电皆至、丰，君子折狱致刑。' },
    yaoCi: [
      { name: '初九', original: '遇其配主，雖旬無咎，往有尚。', baihua: '初爻阳位：遇其配主、虽旬无咎，往有尚，势均相得。' },
      { name: '六二', original: '丰其蔀，日中見斗，往得疑疾，有孚發若，吉。', baihua: '二爻阴位：丰其蔀、日中见斗，往得疑疾，有孚发若吉，蔽而能明。' },
      { name: '九三', original: '丰其沛，日中見昧，折其右肱，無咎。', baihua: '三爻阳位：丰其沛、日中见昧，折其右肱无咎，助失其一。' },
      { name: '九四', original: '丰其蔀，日中見斗，遇其夷主，吉。', baihua: '四爻阳位：丰其蔀、日中见斗，遇其夷主吉，得同道。' },
      { name: '六五', original: '來章，有慶譽，吉。', baihua: '五爻阴位：来章、有庆誉吉，显其文采。' },
      { name: '上六', original: '丰其屋，蔀其家，窺其戶，闃其無人，三歲不見，凶。', baihua: '上爻阴位：丰其屋、蔀其家，窥户阒其无人、三岁不见，凶，盛极孤蔽。' },
    ]
  },
  '火山旅': {
    number: 56,
    short: '旅',
    guaCi: { original: '旅，小亨，旅貞吉。', baihua: '旅卦，小亨，旅贞吉。行旅在外。' },
    xiangCi: { original: '山上有火，旅。君子以明慎用刑而不留獄。', baihua: '山上有火、旅，君子明慎用刑、不留狱。' },
    yaoCi: [
      { name: '初六', original: '旅瑣瑣，斯其所取災。', baihua: '初爻阴位：旅琐琐、斯其所取灾，琐碎招患。' },
      { name: '六二', original: '旅即次，懷其資，得童仆貞。', baihua: '二爻阴位：旅即次、怀其资、得童仆贞，安旅有资。' },
      { name: '九三', original: '旅焚其次，喪其童仆，貞厲。', baihua: '三爻阳位：旅焚其次、丧其童仆，守正危，失所依。' },
      { name: '九四', original: '旅于處，得其資斧，我心不快。', baihua: '四爻阳位：旅于处、得其资斧，我心不快，暂安未惬。' },
      { name: '六五', original: '射雉一矢亡，終以譽命。', baihua: '五爻阴位：射雉一矢亡、终以誉命，小有所失得誉。' },
      { name: '上九', original: '鳥焚其巢，旅人先笑后號啕。喪牛于易，凶。', baihua: '上爻阴位：鸟焚其巢、旅人先笑后号啕，丧牛于易，凶，乐极生悲。' },
    ]
  },
  '巽为风': {
    number: 57,
    short: '巽',
    guaCi: { original: '巽，小亨，利有攸往，利見大人。', baihua: '巽卦，小亨，利有攸往，利见大人。谦柔渗透。' },
    xiangCi: { original: '隨風，巽。君子以申命行事。', baihua: '随风、巽，君子申命行事。' },
    yaoCi: [
      { name: '初六', original: '進退，利武人之貞。', baihua: '初爻阴位：进退、利武人之贞，疑而宜决。' },
      { name: '九二', original: '巽在床下，用史巫紛若，吉無咎。', baihua: '二爻阳位：巽在床下、用史巫纷若，吉无咎，谦卑得助。' },
      { name: '九三', original: '頻巽，吝。', baihua: '三爻阳位：频巽、吝，屡顺失宜。' },
      { name: '六四', original: '悔亡，田獲三品。', baihua: '四爻阴位：悔亡、田获三品，顺而有得。' },
      { name: '九五', original: '貞吉悔亡，無不利。無初有終，先庚三日，后庚三日，吉。', baihua: '五爻阳位：守正吉悔亡无不利，无初有终，先庚后庚吉，申命有节。' },
      { name: '上九', original: '巽在床下，喪其資斧，貞凶。', baihua: '上爻阳位：巽在床下、丧其资斧，守正凶，谦极失持。' },
    ]
  },
  '兑为泽': {
    number: 58,
    short: '兑',
    guaCi: { original: '兌，亨，利貞。', baihua: '兑卦，亨，利贞。喜悦和悦。' },
    xiangCi: { original: '麗澤，兌。君子以朋友講習。', baihua: '丽泽、兑，君子朋友讲习。' },
    yaoCi: [
      { name: '初九', original: '和兌，吉。', baihua: '初爻阳位：和兑、吉，和悦待人。' },
      { name: '九二', original: '孚兌，吉，悔亡。', baihua: '二爻阳位：孚兑、吉悔亡，诚信而悦。' },
      { name: '六三', original: '來兌，凶。', baihua: '三爻阴位：来兑、凶，媚悦外来。' },
      { name: '九四', original: '商兌，未寧，介疾有喜。', baihua: '四爻阳位：商兑未宁、介疾有喜，斟酌得安。' },
      { name: '九五', original: '孚于剝，有厲。', baihua: '五爻阳位：孚于剥、有厉，信于剥落之道危。' },
      { name: '上六', original: '引兌。', baihua: '上爻阴位：引兑，牵引而悦，宜慎。' },
    ]
  },
  '风水涣': {
    number: 59,
    short: '涣',
    guaCi: { original: '渙，亨。王假有廟，利涉大川，利貞。', baihua: '涣卦，亨。王假有庙，利涉大川，利贞。涣散之象。' },
    xiangCi: { original: '風行水上，渙。先王以享于帝立廟。', baihua: '风行水上、涣，先王享于帝立庙。' },
    yaoCi: [
      { name: '初六', original: '用拯馬壯，吉。', baihua: '初爻阴位：用拯马壮、吉，借力脱散。' },
      { name: '九二', original: '渙奔其機，悔亡。', baihua: '二爻阳位：涣奔其机、悔亡，就安以止散。' },
      { name: '六三', original: '渙其躬，無悔。', baihua: '三爻阴位：涣其躬、无悔，散及自身、无私。' },
      { name: '六四', original: '渙其群，元吉。渙有丘，匪夷所思。', baihua: '四爻阴位：涣其群、元吉；涣有丘、匪夷所思，散私聚公。' },
      { name: '九五', original: '渙汗其大號，渙王居，無咎。', baihua: '五爻阳位：涣汗其大号、涣王居，无咎，敷号令、散积蓄。' },
      { name: '上九', original: '渙其血，去逖出，無咎。', baihua: '上爻阴位：涣其血、去逖出，无咎，远祸。' },
    ]
  },
  '水泽节': {
    number: 60,
    short: '节',
    guaCi: { original: '節，亨。苦節，不可貞。', baihua: '节卦，亨。苦节不可贞。节制有度。' },
    xiangCi: { original: '澤上有水，節。君子以制數度、議德行。', baihua: '泽上有水、节，君子制数度、议德行。' },
    yaoCi: [
      { name: '初九', original: '不出戶庭，無咎。', baihua: '初爻阳位：不出户庭、无咎，慎言于始。' },
      { name: '九二', original: '不出門庭，凶。', baihua: '二爻阳位：不出门庭、凶，失机于内。' },
      { name: '六三', original: '不節若，則嗟若，無咎。', baihua: '三爻阴位：不节若、则嗟若，无咎，失节而后悔。' },
      { name: '六四', original: '安節，亨。', baihua: '四爻阴位：安节、亨，安于节度。' },
      { name: '九五', original: '甘節，吉。往有尚。', baihua: '五爻阳位：甘节、吉，往有尚，节而甘美。' },
      { name: '上六', original: '苦節，貞凶，悔亡。', baihua: '上爻阴位：苦节、贞凶悔亡，过苛则苦。' },
    ]
  },
  '风泽中孚': {
    number: 61,
    short: '中孚',
    guaCi: { original: '中孚，豚魚吉，利涉大川，利貞。', baihua: '中孚卦，豚鱼吉，利涉大川，利贞。诚信发于中。' },
    xiangCi: { original: '澤上有風，中孚。君子以議獄緩死。', baihua: '泽上有风、中孚，君子议狱缓死。' },
    yaoCi: [
      { name: '初九', original: '虞吉，有他不燕。', baihua: '初爻阳位：虞吉、有他不燕，安虞则吉、心分则不安。' },
      { name: '九二', original: '鳴鶴在陰，其子和之，我有好爵，吾與爾靡之。', baihua: '二爻阳位：鸣鹤在阴、其子和之，我有好爵、吾与尔靡之，诚感相应。' },
      { name: '六三', original: '得敵，或鼓或罷，或泣或歌。', baihua: '三爻阴位：得敌、或鼓或罢、或泣或歌，敌存心动。' },
      { name: '六四', original: '月几望，馬匹亡，無咎。', baihua: '四爻阴位：月几望、马匹亡，无咎，弃私党。' },
      { name: '九五', original: '有孚攣如，無咎。', baihua: '五爻阳位：有孚挛如、无咎，诚信牵系。' },
      { name: '上九', original: '翰音登于天，貞凶。', baihua: '上爻阳位：翰音登于天、守正凶，虚声外扬。' },
    ]
  },
  '雷山小过': {
    number: 62,
    short: '小过',
    guaCi: { original: '小過，亨，利貞，可小事，不可大事。飛鳥遺之音，不宜上宜下，大吉。', baihua: '小过卦，亨，利贞，可小事不可大事。飞鸟遗音、不宜上宜下，大吉。小有过越。' },
    xiangCi: { original: '山上有雷，小過。君子以行過乎恭，喪過乎哀，用過乎儉。', baihua: '山上有雷、小过，君子行过乎恭、丧过乎哀、用过乎俭。' },
    yaoCi: [
      { name: '初六', original: '飛鳥以凶。', baihua: '初爻阴位：飞鸟以凶，妄飞招祸。' },
      { name: '六二', original: '過其祖，遇其妣，不及其君，遇其臣，無咎。', baihua: '二爻阴位：过其祖、遇其妣，不及其君、遇其臣，无咎，越过而得其当。' },
      { name: '九三', original: '弗過防之，從或戕之，凶。', baihua: '三爻阳位：弗过防之、从或戕之，凶，不防则伤。' },
      { name: '九四', original: '無咎，弗過遇之。往厲必戒，勿用永貞。', baihua: '四爻阳位：无咎、弗过遇之，往厉必戒，勿用永贞，守分。' },
      { name: '六五', original: '密云不雨，自我西郊，公弋，取彼在穴。', baihua: '五爻阴位：密云不雨、自我西郊，公弋取彼在穴，小施可得。' },
      { name: '上六', original: '弗遇過之，飛鳥離之，凶，是謂災眚。', baihua: '上爻阴位：弗遇过之、飞鸟离之，凶，是谓灾眚，过越失所。' },
    ]
  },
  '水火既济': {
    number: 63,
    short: '既济',
    guaCi: { original: '既濟，亨，小利貞，初吉終亂。', baihua: '既济卦，亨，小利贞，初吉终乱。事已成。' },
    xiangCi: { original: '水在火上，既濟。君子以思患而預防之。', baihua: '水在火上、既济，君子思患而预防之。' },
    yaoCi: [
      { name: '初九', original: '曳其輪，濡其尾，無咎。', baihua: '初爻阳位：曳其轮、濡其尾，无咎，始进缓稳。' },
      { name: '六二', original: '婦喪其茀，勿逐，七日得。', baihua: '二爻阴位：妇丧其茀、勿逐，七日得，失而复。' },
      { name: '九三', original: '高宗伐鬼方，三年克之，小人勿用。', baihua: '三爻阳位：高宗伐鬼方、三年克之，小人勿用，久战得胜。' },
      { name: '六四', original: '儒有衣袽，終日戒。', baihua: '四爻阴位：繻有衣袽、终日戒，备患于未然。' },
      { name: '九五', original: '東鄰殺牛，不如西鄰之禴祭，實受其福。', baihua: '五爻阳位：东邻杀牛、不如西邻之禴祭，实受其福，诚胜繁礼。' },
      { name: '上六', original: '濡其首，厲。', baihua: '上爻阴位：濡其首、厉，成功后失慎。' },
    ]
  },
  '火水未济': {
    number: 64,
    short: '未济',
    guaCi: { original: '未濟，亨，小狐汔濟，濡其尾，無攸利。', baihua: '未济卦，亨，小狐汔济、濡其尾，无所利。事未竟。' },
    xiangCi: { original: '火在水上，未濟。君子以慎辨物居方。', baihua: '火在水上、未济，君子慎辨物居方。' },
    yaoCi: [
      { name: '初六', original: '濡其尾，吝。', baihua: '初爻阴位：濡其尾、吝，始渡沾尾，宜慎。' },
      { name: '九二', original: '曳其輪，貞吉。', baihua: '二爻阳位：曳其轮、守正吉，缓进得正。' },
      { name: '六三', original: '未濟，征凶，利涉大川。', baihua: '三爻阴位：未济、征凶，利涉大川，险中宜渡。' },
      { name: '九四', original: '貞吉，悔亡，震用伐鬼方，三年有賞于大國。', baihua: '四爻阳位：守正吉悔亡，震用伐鬼方、三年有赏于大国，久勤得报。' },
      { name: '六五', original: '貞吉，無悔，君子之光，有孚，吉。', baihua: '五爻阴位：守正吉无悔，君子之光、有孚吉，德辉可信。' },
      { name: '上九', original: '有孚于飲酒，無咎，濡其首，有孚失是。', baihua: '上爻阳位：有孚于饮酒、无咎，濡其首、有孚失是，乐极失度。' },
    ]
  },
};

/* S02：六亲释义（5 条，词条卡用） */
const LIUQIN_CN = {
  '父母': '父母爻：生我护我者——主长辈、文书、房产、根基、保障。白话提示：凡与「庇荫、凭证、承托」相关之事看父母。',
  '兄弟': '兄弟爻：同我比肩者——主同辈、合作者、竞争、破耗、分利。白话提示：涉及「分财、同行、往来」多论兄弟。',
  '子孙': '子孙爻：我生者——主晚辈、子女、技艺、福气、解忧、医药。白话提示：逢忧疑困扰，子孙为解忧之神。',
  '妻财': '妻财爻：我克者——主财利、物资、妻室、可支配之产。白话提示：谋财问利，先观妻财状态。',
  '官鬼': '官鬼爻：克我者——主事业、官职、压力、是非、疾患。白话提示：问事业吉凶与忧患之事看官鬼。',
};

/* S03：六神释义（6 条，词条卡用） */
const LIUSHEN_CN = {
  '青龙': '青龙：主喜庆、文书、贵人、酒食宴乐；多与正面喜庆之事相系（趋势参考：逢青龙多主顺遂喜气）。',
  '朱雀': '朱雀：主口舌、文书信息、声音表达；宜留意言谈文书与是非口舌。',
  '勾陈': '勾陈：主田土、迟缓、牵绊、旧事；多与拖延、牵连相关，宜耐心处理。',
  '螣蛇': '螣蛇（腾蛇）：主虚惊、缠绕、变化不实；遇之多留意疑虑幻觉、反复之象。',
  '白虎': '白虎：主刚猛、伤病、快速、肃杀；与急变、伤病面相关，宜谨慎守正。',
  '玄武': '玄武：主暗昧、隐蔽、隐私、盗失；多与暗处之事相关，宜防隐忧。',
};

/* S04：世应基础含义（免费解读区「世应含义」卡） */
const SHIYING_CN = {
  'intro': '世爻 = 占问的主体方（当事人自己或所代表的一方）；应爻 = 主体所面对的对象、对方或所问之事的一端。',
  'example': '白话示例：问出行，世为我、应为目的地与彼方；问合作，世为我方、应为对方；问自身状态，世为当下处境。',
  'read': '世应相生合多主和顺投契；相冲克多主隔阂对抗；世空应实或应空世实，皆有侧重，需结合动变细看（细处由深度解读承接）。',
};

/* S05：常用占断术语短释（10 条，词条卡/术语展示用） */
const TERMS_CN = {
  UI_COPY.divination['jk-xunkong']: '旬空（空亡）：日柱所值旬内无此支，该爻如落空——主该事暂不落实、虚位待填。趋势参考：旬空之事常需出空后才有眉目。',
  '月破': '月破：爻支被当月所冲——主当月经受冲击、效力减损；月过之后渐复。',
  '日破': '日破 / 日冲：被当日所冲——当日多生变动、被催促；冲实或冲空另有别论。',
  '暗动': '暗动：静爻被日辰冲动而暗自发用——主暗流已动、事在悄悄变化。',
  '回头生克': '回头生 / 回头克：动爻化出的变爻反过来生/克自身——化回头生多为助力回馈；化回头克多主反受其制，宜留意。',
  '化空化墓': '化空 / 化破 / 化墓：动爻变入空亡/被冲破/入墓——多主所化之事暂不成形、受困待时。',
  '入墓': '入墓：爻入墓库——主受藏、阻滞、暂难施展；冲开墓库方有转机。',
  '六合六冲': '六合 / 六冲：卦与卦、爻与爻的合冲关系——合主牵合和缓，冲主动荡分开。',
  '伏神': '伏神：用神不上卦时，从本宫卦中借出者——主事藏于暗、需待引动。',
  '用忌原仇': '用神 / 原神 / 忌神 / 仇神：断卦聚焦的对象 / 生用者 / 克用者 / 生忌者——白话提示：看事先定用神，再看其得助受制。',
};

/* S06：通用话术（动爻 / 静卦 / 互卦 / 免费区免责） */
const LIUYAO_GENERIC = {
  '动爻': '此爻发动，表示所问之事在该环节出现变动或推动；宜结合爻辞与变爻细看（更细断语可由「深度断卦」展开）。',
  '静卦': '整卦六爻安静，事势相对稳定，宜守常观察；若需更细层次，可再行深度断卦参考。',
  '互卦': '互卦反映事态发展中间阶段的内在张力；趋势参考：可留意过程中被忽略的暗层。',
  '免责': '以上为通用卦理与卦辞的趋势参考，仅供娱乐与启发，不构成任何实际建议。',
};

/* S07：合规尾注（追加在免费解读区末尾，沿用 REQ-006 免责口径） */
const LIUYAO_DISCLAIMER = '以上内容由传统卦理生成，属趋势参考与娱乐范畴，不构成任何现实建议；请理性看待，重大决策请依据现实信息。';

/* REQ-075：六爻焦点详解文案（动爻/世应/空亡·月破·日破/暗动/回头生克/化空化墓 逐项点击 → LLM 结合本盘针对性解读，小额余额即时扣费） */
const LIUYAO_FOCUS_CN = {
  'title': '焦点详解（付费）',
  'intro': '结合本盘爻象（yaosDetail）与 64 卦爻辞原文，对动爻、世应、空亡·月破·日破、暗动、回头生克、化空化墓逐项做针对性解读（每项按用量扣余额；同项结果自动缓存，再次点击不再重复扣费）。',
  'pay_tip': '详解（扣余额）',
  'miss': '本盘无此标记',
  'loading': '详解生成中…',
  'expand': '展开',
  'collapse': '收起',
  'empty': '（暂无详解内容）',
  'err': '详解生成失败，请重试。'
};

/* 卦理通则：六爻/梅花/小六壬通用规则提示（免费解读区正文之外的静态规则参考；世应为六爻专有概念）。 */
const C3_GENERIC_RULES = {
  '动爻': '动爻是本卦转为之卦的关键爻位，提示当下最易生变、最需留意的环节；一爻动宜看变爻之意，多爻动则综观整体趋势。',
  UI_COPY.divination['ly-th-shiying']: '世爻代表问事者自身，应爻代表所问之人或事之方；世应相生多顺、相克多阻，是判读双方态势与远近的基础坐标。',
  '互卦': '互卦由本卦二至四爻、三至五爻重组而成，揭示事情发展过程中潜伏的中间阶段，补本卦与变卦未尽之处。',
  '本卦': '本卦呈现事情起始与整体基调，是判读的根基。',
  '变卦': '变卦呈现事情的可能走向与结果，由动爻推演而来，宜与本卦对照着看。'
};

/* C4 meihua.patterns 五格局（体用生克）；引擎输出 tiYongRelation 的「体用比和」归并为键名「比和」。 */
const C4_MEIHUA_PATTERNS = {
  '体克用': '体（我/主）克用（事/客），主所谋可得，事虽能成却需出力费心，宜主动争取、忌半途松懈。',
  '用克体': '用（事/客）克体（我/主），主外力压制、所求难成或倍感吃力，宜守不宜攻，暂收锋芒以观其变。',
  '体生用': '体（我/主）生用（事/客），主我方付出、能量外泄，虽用心良苦却易耗神，宜量力而行、忌过度倾注。',
  '用生体': '用（事/客）生体（我/主），主得外力相济、贵人暗助，事多顺遂省力，宜顺势承接、把握时机。',
  '比和': '体与用同气比和，主双方相合、事易成就，少有掣肘，宜同心协力、顺势推进。'
};

/* C4 xiaoliuren.shens 六神掌诀释义；落掌神名（primary.name/point）直接查表，查不到走中性兜底文案。 */
const C4_XIAOLIUREN_SHENS = {
  '大安': '大安主安稳静止，诸事平顺、少波折，宜静守与落实，不必急于变动。',
  '留连': '留连主拖延纠缠，事多反复、进展迟缓，宜耐心等待、忌仓促决断。',
  '速喜': '速喜主喜信速至，事有进展、多有佳音，宜把握当下、乘势而动。',
  '赤口': '赤口主口舌是非，易生争执或误解，宜谨言慎行、避开冲突。',
  '小吉': '小吉主小有所成，事渐顺遂、可得其利，宜稳妥推进、积小为大。',
  UI_COPY.divination['qm-kongwang']: '空亡主落空虚无，谋事易散、难得其实，宜暂收手、另择时机。'
};

/* REQ-107：免费解读区折叠 —— 块级折叠（label 作点击头，默认收起；openDefault=true 可直显）。
   独立函数组件（自带 useState），避免在父级渲染函数里按条件增减 hooks 破坏钩子顺序。 */
function FreeFoldBlock({ label, text, tip, openDefault }) {
  const [open, setOpen] = useState(Boolean(openDefault));
  const inner = [React.createElement('button', {
    key: 'l',
    type: 'button',
    className: 'fb-label fb-fold-head' + (open ? ' open' : ''),
    onClick: function () { setOpen(!open); },
    'aria-expanded': open ? 'true' : 'false'
  }, label, React.createElement('span', { className: 'fb-chev' }, '▸'))];
  if (open) {
    if (text) inner.push(React.createElement('div', { key: 'x', className: 'fb-txt' }, text));
    if (tip) inner.push(React.createElement('div', { key: 'p', className: 'fb-tip' }, tip));
  }
  return React.createElement('div', { className: 'free-block foldable' }, inner);
}
/* 整卡折叠（卦理词条卡：标题作点击头，默认收起；展开后内部块按 b.fold 各自开合，未标 fold 的直显） */
function FreeFoldCard({ title, blocks }) {
  const [open, setOpen] = useState(false);
  const kids = [React.createElement('button', {
    key: 't',
    type: 'button',
    className: 'fc-title fc-fold-head' + (open ? ' open' : ''),
    onClick: function () { setOpen(!open); },
    'aria-expanded': open ? 'true' : 'false'
  }, React.createElement('span', { className: 'fc-t' }, title), React.createElement('span', { className: 'fc-chev' }, '▸'))];
  if (open) {
    blocks.forEach(function (b, i) {
      if (b.fold) {
        kids.push(React.createElement(FreeFoldBlock, { key: 'b' + i, label: b.label, text: b.text, tip: b.tip }));
      } else {
        const inner = [];
        if (b.label) inner.push(React.createElement('div', { key: 'l', className: 'fb-label' }, b.label));
        if (b.text) inner.push(React.createElement('div', { key: 'x', className: 'fb-txt' }, b.text));
        if (b.tip) inner.push(React.createElement('div', { key: 'p', className: 'fb-tip' }, b.tip));
        kids.push(React.createElement('div', { key: 'b' + i, className: 'free-block' }, inner));
      }
    });
  }
  return React.createElement('div', { className: 'free-card card-fold' }, kids);
}
function FreeCard(title, blocks, opts) {
  if (opts && opts.foldCard) {
    return React.createElement(FreeFoldCard, { title: title, blocks: blocks });
  }
  const kids = [React.createElement('div', { key: 't', className: 'fc-title' }, title)];
  blocks.forEach(function (b, i) {
    if (b.fold) {
      kids.push(React.createElement(FreeFoldBlock, { key: 'b' + i, label: b.label, text: b.text, tip: b.tip }));
    } else {
      const inner = [];
      if (b.label) inner.push(React.createElement('div', { key: 'l', className: 'fb-label' }, b.label));
      if (b.text) inner.push(React.createElement('div', { key: 'x', className: 'fb-txt' }, b.text));
      if (b.tip) inner.push(React.createElement('div', { key: 'p', className: 'fb-tip' }, b.tip));
      kids.push(React.createElement('div', { key: 'b' + i, className: 'free-block' }, inner));
    }
  });
  return React.createElement('div', { className: 'free-card' }, kids);
}
/* ---------- REQ-128 阶段 0：名词白话卡（6 方法） ----------
   数据源：frontend/public/data/term-cards.js（window.TC_TERM_CARDS，文案组第四轮交付物，更新只替换该文件）。
   交互对齐 REQ-073/107 折叠风格：
   - TCTermRow：把结果页渲染出的名词包成可点击标签（命中卡片的加下划线/高亮提示可点），
     点击展开该词白话卡（term + plain）；未命中卡片的名词照常渲染（不可点）。
   - TCTermPanel：「名词释义」兜底折叠面板（复用 FreeCard foldCard），列出本方法全部卡（term → 点击展开 plain）。
   匹配容错（稳妥口径）：① 文本与 term 精确相等；② term 长度≥2 且文本包含 term；
   ③ 文本长度≥2 且 term 包含文本（覆盖「天蓬」↔「天蓬星」、干支前缀「甲子·天蓬星」、
   「青龙」↔「青龙（黄道）」、「三交课」↔「三交」等变体）；单字 term（如 元/会/运/世）只走精确匹配防误命中。
   均为独立函数组件（自带 useState），避免在父级渲染函数里按条件增减 hooks 破坏钩子顺序（同 REQ-107 约定）。 */
function tcCardMap(method) {
  const all = (typeof window !== 'undefined' && window.TC_TERM_CARDS) || {};
  const list = (all && all[method]) || [];
  const map = {};
  list.forEach(function (c) {
    if (c && c.key && c.term && c.plain && !map[c.key]) map[c.key] = c;
  });
  return map;
}
function tcFindCard(map, text) {
  if (!map || text == null) return null;
  const t = String(text).trim();
  if (!t) return null;
  // ① 精确相等优先（如「天乙贵神」不会误命中断言里的「贵神」）
  for (const k in map) {
    const c = map[k];
    if (c.term === t) return c;
  }
  // ② term 是文本子串：取命中位置最早者（如「门迫（离九宫景门）」先命中前缀「门迫」而非括号里的「景门」），
  //    同位置取更长 term（更具体）；term 长度 < 2 不参与（单字只走精确，防误命中）
  let best = null, bestPos = -1, bestLen = 0;
  for (const k in map) {
    const c = map[k];
    if (c.term.length < 2) continue;
    const p = t.indexOf(c.term);
    if (p === -1) continue;
    if (best === null || p < bestPos || (p === bestPos && c.term.length > bestLen)) {
      best = c; bestPos = p; bestLen = c.term.length;
    }
  }
  if (best) return best;
  // ③ 文本是 term 子串（覆盖「天蓬」↔「天蓬星」、干支前缀「甲子·天蓬星」、「青龙」↔「青龙（黄道）」、
  //    「三交课」↔「三交」等变体）：取最短 term（最贴近词根）
  let best3 = null, best3Len = 0;
  for (const k in map) {
    const c = map[k];
    if (t.length < 2) continue;
    if (c.term.indexOf(t) === -1) continue;
    if (best3 === null || c.term.length < best3Len) { best3 = c; best3Len = c.term.length; }
  }
  return best3;
}
function TCTermChip({ method, card, text, className, open, onClick }) {
  const kids = [text];
  if (card) kids.push(React.createElement('span', { key: 'ch', className: 'tc-chev' }, open ? '▾' : '▸'));
  return React.createElement('span', {
    className: (className || 'tc-chip') + (card ? ' tc-hit' : '') + (open ? ' tc-open' : ''),
    onClick: card ? onClick : undefined,
    title: card ? '点击查看白话释义' : undefined,
    role: card ? 'button' : undefined,
    'aria-expanded': card ? (open ? 'true' : 'false') : undefined
  }, kids);
}
function TCTermRow({ method, label, items, chipClass, matchOf, textOf }) {
  const [openKey, setOpenKey] = useState(null);
  const map = tcCardMap(method);
  const chips = [];
  const seen = {};
  (Array.isArray(items) ? items : []).forEach(function (it, i) {
    const matchText = matchOf ? matchOf(it) : (it == null ? '' : String(it));
    const txt = textOf ? textOf(it) : (it == null ? '' : String(it));
    if (!matchText || !txt) return;
    const card = tcFindCard(map, matchText);
    const dedupeKey = card ? card.key : matchText;
    if (seen[dedupeKey]) return; // 同一名词/同一卡片只留一枚标签
    seen[dedupeKey] = true;
    chips.push(React.createElement(TCTermChip, {
      key: i,
      method: method,
      card: card,
      text: txt,
      className: chipClass,
      open: card ? openKey === card.key : false,
      onClick: function () { setOpenKey(openKey === card.key ? null : card.key); }
    }));
  });
  if (!chips.length) return null;
  let openCard = null;
  if (openKey) { for (const k in map) { if (map[k].key === openKey) { openCard = map[k]; break; } } }
  const body = openCard ? React.createElement('div', { key: 'body', className: 'tc-card-body' },
    React.createElement('div', { className: 'tcb-term' }, openCard.term),
    React.createElement('div', { className: 'tcb-plain' }, openCard.plain)) : null;
  return React.createElement('div', { className: 'tc-row' },
    label ? React.createElement('span', { key: 'cap', className: 'tc-cap' }, label) : null,
    chips, body);
}
function TCTermPanel({ method }) {
  const map = tcCardMap(method);
  const keys = Object.keys(map);
  if (!keys.length) return null;
  const blocks = keys.map(function (k) {
    const c = map[k];
    return { label: c.term, text: c.plain, fold: true };
  });
  return FreeCard('名词释义（免费）', blocks, { foldCard: true });
}
/* REQ-073：六爻免费解读区 = 卦理解读（本卦/变卦/动爻/互卦/世应五块 + 原文引用小字）+
   卦理词条（S02 六亲 / S03 六神 / S05 术语短释）+ S06 免费区免责 + S07 合规尾注。
   数据均取自 result_json（originalName/changedName/interName/changingYaos/worldAndResponse/yaosDetail 富字段）。 */
function LiuyaoTermCard(res) {
  const blocks = [];
  const yaos = Array.isArray(res.yaosDetail) ? res.yaosDetail.slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); }) : [];
  const any = function (fn) { return yaos.some(fn); };
  // S02 六亲释义：取本卦爻位所临六亲 + 伏神/卦身补出的六亲（按传统顺序排列）
  const relSet = [];
  const pushRel = function (n) { if (n && relSet.indexOf(n) === -1) relSet.push(n); };
  yaos.forEach(function (y) { pushRel(y && y.sixRelative); });
  (Array.isArray(res.hiddenSpirits) ? res.hiddenSpirits : []).forEach(function (h) { pushRel(h && h.sixRelative); });
  if (res.guaShen) pushRel(res.guaShen.sixRelative);
  const liuqinOrder = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
  const liuqinLines = liuqinOrder.filter(function (n) { return relSet.indexOf(n) !== -1; }).map(function (n) { return LIUQIN_CN[n]; });
  if (liuqinLines.length) blocks.push({ label: '六亲释义（本卦所临）', text: liuqinLines.join('\n') });
  // S03 六神释义：本卦六爻自下而上各临其一，全部列出作词条（REQ-107：折叠菜单，点击展开）
  const godOrder = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
  blocks.push({ label: '六神释义（六爻自下而上各临其一）', text: godOrder.map(function (n) { return LIUSHEN_CN[n]; }).join('\n'), fold: true });
  // S05 术语短释：按本课 yaosDetail 富字段（空亡/月破/日破/暗动/回头生克/化空/入墓/六合六冲/伏神）命中取用
  const hits = [];
  const hit = function (key, yes) { if (yes && hits.indexOf(key) === -1) hits.push(key); };
  hit(UI_COPY.divination['jk-xunkong'], any(function (y) { return Boolean(y.isVoid); }));
  hit('月破', any(function (y) { return Boolean(y.isMonthBreak); }));
  hit('日破', any(function (y) { return Boolean(y.isDayBreak || y.isDayClash); }));
  hit('暗动', any(function (y) { return Boolean(y.isHiddenMove); }));
  hit('回头生克', any(function (y) { return Boolean(y.isChanging) && Array.isArray(y.changeRelations) && y.changeRelations.some(function (r) { return typeof r === 'string' && r.indexOf('回头') === 0; }); }));
  hit('化空化墓', any(function (y) { return Boolean(y.isChanging) && Array.isArray(y.changeRelations) && y.changeRelations.indexOf('化空') !== -1; }));
  hit('入墓', any(function (y) { return Boolean(y.isRuMu); }));
  {
    const rels = (res.hexagramRelations || {});
    const relText = String(rels.original || '') + String(rels.transition || '');
    hit('六合六冲', any(function (y) { return Boolean(y.isLiuhe); }) || relText.indexOf('六合') !== -1 || relText.indexOf('六冲') !== -1);
  }
  hit('伏神', Array.isArray(res.hiddenSpirits) && res.hiddenSpirits.length > 0);
  const termLines = hits.map(function (k) { return '· ' + TERMS_CN[k]; });
  blocks.push({
    label: '术语短释（本课命中）',
    text: termLines.length ? termLines.join('\n') : '本课无空亡、月破、日破、暗动、回头生克等特殊术语标记，宜以卦意、世应与用神参看。',
    tip: TERMS_CN['用忌原仇'],
    fold: true
  });
  // REQ-107：卦理词条整卡折叠（标题点击展开；内部 六神释义/术语短释 各自折叠，六亲释义直显）
  return FreeCard('卦理词条（免费）', blocks, { foldCard: true });
}
/* ---------- REQ-075：六爻焦点详解 —— 动爻/世应/空亡·月破·日破/暗动/回头生克/化空化墓 逐项点击 → LLM 结合本盘针对性解读（小额余额即时扣费）。
   命中判定复用 S05 术语短释（LiuyaoTermCard 同一套 yaosDetail 富字段逻辑）；未命中置灰「本盘无此标记」不请求；世应恒可点。
   三态：loading 文案 / 失败 err 文案 / 成功 interpretation 可折叠面板（复用 interp-body 解析面板样式）；本地缓存已取结果（同 focus 再点直接展示不再请求）。 ---------- */
function LiuyaoFocusPanel({ res, focusMap, onDetail, onToggle }) {
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const yaos = Array.isArray(res.yaosDetail) ? res.yaosDetail.slice() : [];
  const any = function (fn) { return yaos.some(fn); };
  const hasMoving = Boolean((Array.isArray(res.changingYaos) && res.changingYaos.length) || any(function (y) { return Boolean(y.isChanging); }));
  const hasKong = Boolean(any(function (y) { return Boolean(y.isVoid); }) || any(function (y) { return Boolean(y.isMonthBreak); }) || any(function (y) { return Boolean(y.isDayBreak || y.isDayClash); }));
  const hasAnDong = Boolean(any(function (y) { return Boolean(y.isHiddenMove); }));
  const hasHuiTou = Boolean(any(function (y) { return Boolean(y.isChanging) && Array.isArray(y.changeRelations) && y.changeRelations.some(function (r) { return typeof r === 'string' && r.indexOf('回头') === 0; }); }));
  const hasHuaKong = Boolean(any(function (y) { return Boolean(y.isChanging) && Array.isArray(y.changeRelations) && y.changeRelations.indexOf('化空') !== -1; }));
  const items = [
    { key: 'moving_yao', label: '动爻', hit: hasMoving },
    { key: 'shi_ying', label: UI_COPY.divination['ly-th-shiying'], hit: true },
    { key: 'kong_wang', label: '空亡·月破·日破', hit: hasKong },
    { key: 'an_dong', label: '暗动', hit: hasAnDong },
    { key: 'hui_tou_sheng_ke', label: '回头生克', hit: hasHuiTou },
    { key: 'hua_kong_hua_mu', label: '化空化墓', hit: hasHuaKong }
  ];
  const rows = items.map(function (it) {
    const st = focusMap[it.key] || {};
    const kids = [];
    kids.push(React.createElement('span', { key: 'nm', className: 'focus-name' + (it.hit ? '' : ' off') }, it.label));
    if (!it.hit) {
      kids.push(React.createElement('span', { key: 'miss', className: 'focus-note' }, LIUYAO_FOCUS_CN.miss));
    } else if (st.loading) {
      kids.push(React.createElement('span', { key: 'ld', className: 'focus-note' }, LIUYAO_FOCUS_CN.loading));
    } else if (st.txt) {
      kids.push(React.createElement('button', { key: 'tg', type: 'button', className: 'focus-btn' + (st.open ? ' on' : ''), onClick: function () { onToggle(it.key); } }, st.open ? LIUYAO_FOCUS_CN.collapse : LIUYAO_FOCUS_CN.expand));
    } else {
      kids.push(React.createElement('button', { key: 'go', type: 'button', className: 'focus-btn', onClick: function () { onDetail(it.key); } }, [LIUYAO_FOCUS_CN.pay_tip, payBadge(payEnough)]));
    }
    if (st.err) kids.push(React.createElement('span', { key: 'er', className: 'focus-note err' }, st.err));
    if (st.txt && st.open) {
      kids.push(React.createElement('div', { key: 'panel', className: 'interp-body focus-panel' }, st.txt));
    }
    return React.createElement('div', { key: it.key, className: 'focus-item' }, kids);
  });
  return React.createElement('div', { className: 'focus-card' },
    React.createElement('div', { className: 'fc-title' }, LIUYAO_FOCUS_CN.title),
    React.createElement('div', { className: 'focus-intro' }, LIUYAO_FOCUS_CN.intro),
    rows,
    React.createElement('div', { className: 'focus-disclaim' }, LIUYAO_DISCLAIMER));
}
function LiuyaoFreeReading(res) {
  const blocks = [];
  const originalName = res.originalName || res.name || '';
  const changedName = (res.changedName && res.changedName !== originalName) ? res.changedName : '';
  const interName = res.interName || '';
  // S01 本卦大意：正文取 HEX_GENERIC 本卦大意，兜底 HEX_MEANINGS 单段大意
  const g0 = originalName ? HEX_GENERIC[originalName] : null;
  const mainText = originalName
    ? ((g0 && g0['本卦大意']) || HEX_MEANINGS[originalName] || ('「' + originalName + '」大意暂缺，可参考卦辞与大象综合体会。'))
    : '';
  blocks.push({
    label: '本卦大意',
    text: mainText || '（本次结果未带卦名，请以卦象与爻象参看。）',
    tip: originalName ? ('以「' + originalName + '」卦名、卦辞与大象为纲，看所问之事当前的基调与态势（趋势参考）。') : ''
  });
  // S08 原文引用 + 白话释义小字：至少接入卦辞 guaCi + 大象 xiangCi
  const htxt = originalName ? HEX_TEXT[originalName] : null;
  if (htxt) {
    const lit = [];
    if (htxt.guaCi && htxt.guaCi.original) lit.push('卦辞 · 原文：' + htxt.guaCi.original);
    if (htxt.guaCi && htxt.guaCi.baihua) lit.push('卦辞 · 白话：' + htxt.guaCi.baihua);
    if (htxt.xiangCi && htxt.xiangCi.original) lit.push('大象 · 原文：' + htxt.xiangCi.original);
    if (htxt.xiangCi && htxt.xiangCi.baihua) lit.push('大象 · 白话：' + htxt.xiangCi.baihua);
    if (lit.length) blocks.push({
      label: '原文引用 · 白话释义',
      text: lit.join('\n'),
      tip: '原文引自《周易》古籍（公有领域），白话为现代白话修正，仅供文化参考。',
      fold: true
    });
  }
  // 变卦大意：changedName 存在且 != originalName 取 HEX_GENERIC 变卦大意；否则静卦（S06）
  if (changedName) {
    const g1 = HEX_GENERIC[changedName];
    const changedText = (g1 && g1['变卦大意']) || HEX_MEANINGS[changedName] || '';
    blocks.push({
      label: '变卦大意',
      text: changedText || ('「' + changedName + '」为动爻所成之变卦，代表事态推进后可能的走向与结果，宜结合本卦对照体会。'),
      tip: '由本卦动爻推演而来，代表事态推进之后可能的走向与结果（趋势参考）。'
    });
  } else {
    blocks.push({
      label: '变卦大意',
      text: '无变卦（静卦）。\n' + LIUYAO_GENERIC['静卦'],
      tip: '本课六爻安静，以本卦卦意与世应、用神之象参看，不另取变卦。'
    });
  }
  // 动爻提示：S06 动爻通则 + 逐条「第N爻动」+ 对应爻辞白话（HEX_TEXT.yaoCi 按爻位取，初九/九二…对应初爻/二爻…）
  const chg = Array.isArray(res.changingYaos) ? res.changingYaos : [];
  if (chg.length) {
    const mvLines = chg.map(function (y) {
      const p = (y && y.position != null) ? y.position : null;
      let yc = null;
      if (p != null && htxt && Array.isArray(htxt.yaoCi) && htxt.yaoCi[p - 1]) yc = htxt.yaoCi[p - 1];
      return '第' + (p != null ? p : '?') + '爻动：' + (yc && yc.baihua ? yc.baihua : LIUYAO_GENERIC['动爻']);
    });
    blocks.push({
      label: '动爻提示',
      text: '通则：' + LIUYAO_GENERIC['动爻'] + '\n' + mvLines.join('\n'),
      tip: '动爻所临六亲及其与世应的生克关系，影响事情的进退取舍；逐爻详解可由「深度断卦」展开。',
      fold: true
    });
  } else {
    blocks.push({
      label: '动爻提示',
      text: '无动爻（静卦）。',
      tip: '静卦以卦意为体，以世应、用神与月建日辰的生克关系参断。',
      fold: true
    });
  }
  // 互卦提示：S06 互卦 + 本课互卦名（HEX_MEANINGS 作引文小字）
  if (interName) {
    blocks.push({
      label: '互卦提示',
      text: LIUYAO_GENERIC['互卦'] + '本卦互卦为「' + interName + '」，主事情推进过程中的中间潜势。',
      tip: HEX_MEANINGS[interName] ? ('「' + interName + '」大意小字：' + HEX_MEANINGS[interName]) : ''
    });
  }
  // 世应含义：S04 基础含义 + 本课世应落位
  const wAndR = Array.isArray(res.worldAndResponse) ? res.worldAndResponse : null;
  const wrParts = [];
  if (wAndR) {
    for (let i = 0; i < 6; i++) {
      const s = wrCellAt(wAndR, i);
      if (s === UI_COPY.divination['ly-shi'] || s === UI_COPY.divination['ly-ying']) wrParts.push((s === UI_COPY.divination['ly-shi'] ? '世爻' : '应爻') + '在' + YAO_LABEL[i] + '爻（第' + (i + 1) + '爻）');
    }
  }
  blocks.push({
    label: '世应含义',
    text: SHIYING_CN['intro'] + (wrParts.length ? '\n本课落位：' + wrParts.join('，') + '。' : '') + '\n' + SHIYING_CN['example'],
    tip: SHIYING_CN['read']
  });
  // S06 免费区免责 + S07 合规尾注（追加到免费解读区末尾）
  // REQ-107：卦理解读卡仅「原文引用·白话释义（本卦命中）/ 动爻提示（爻辞命中）」折叠；本卦大意保持直显
  return React.createElement(React.Fragment, null,
    FreeCard('卦理解读（免费）', blocks),
    LiuyaoTermCard(res),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 8 } },
      LIUYAO_GENERIC['免责'] + '\n' + LIUYAO_DISCLAIMER));
}
function MeihuaFreeReading(res) {
  const blocks = [];
  const originalName = res.originalName || '';
  const changedName = (res.changedName && res.changedName !== originalName) ? res.changedName : '';
  const mainMeaning = originalName ? ((HEX_GENERIC[originalName] && HEX_GENERIC[originalName]['本卦大意']) || HEX_MEANINGS[originalName] || '') : '';
  blocks.push({
    label: '本卦大意',
    text: mainMeaning || (originalName ? ('「' + originalName + '」大意暂缺，可参考卦辞、大象与体用关系综合体会。') : '本卦卦名暂缺，请以卦象爻象为准。')
  });
  // C4 meihua.patterns：按引擎体用关系（analysis.tiYongRelation / tiYongRaw）查五格局文案
  const an = res.analysis || {};
  const rel = an.tiYongRelation || an.tiYongRaw || '';
  const relKey = (rel === '体用比和') ? '比和' : rel; // 引擎「体用比和」归并为键名「比和」
  const patText = relKey ? (C4_MEIHUA_PATTERNS[relKey] || '') : '';
  blocks.push({
    label: '体用生克',
    text: rel ? ('本卦体用关系「' + rel + '」' + (patText ? '：' + patText : '：该关系未列入常规五格局，可结合本卦大意与通用提示综合体会。')) : '本卦未标定体用关系，可结合本卦大意与变卦趋势综合体会。',
    tip: '体卦为己（我、主），用卦为事（客、对方）；格局解释为文化视角下的趋势参考，仅供自我觉察。'
  });
  if (changedName) {
    blocks.push({
      label: '变卦趋势',
      text: ((HEX_GENERIC[changedName] && HEX_GENERIC[changedName]['变卦大意']) || HEX_MEANINGS[changedName] || ('「' + changedName + '」为动爻所成之变卦，代表事态推进后的可能走向；宜结合本卦对照体会。'))
    });
  }
  // C3 genericRules：梅花免费区通用提示改用原创通则（动爻/本卦/互卦/变卦；世应为六爻专有概念，梅花不取）
  const mv = res.movingYao || {};
  const c3Lines = [];
  c3Lines.push(UI_COPY.divination['ly-dong-yao'] + C3_GENERIC_RULES['动爻'] + (mv.position != null ? '（本卦第' + mv.position + '爻为动爻）' : ''));
  c3Lines.push('本卦：' + C3_GENERIC_RULES['本卦']);
  c3Lines.push('互卦：' + C3_GENERIC_RULES['互卦']);
  c3Lines.push('变卦：' + C3_GENERIC_RULES['变卦']);
  blocks.push({
    label: '通用提示',
    text: '梅花易数以体用生克为断事主线：体卦为己、为求测者，用卦为事、为对方。\n' + c3Lines.join('\n'),
    tip: '以上为静态规则参考，仅供自我觉察，不构成任何决策建议。'
  });
  return FreeCard('免费解读', blocks);
}
function XiaoliurenFreeReading(res) {
  const blocks = [];
  const primary = res.primary || {};
  const name = primary.name || res.point || '';
  const seq = res.sequence || {};
  const seqNames = [seq.month, seq.day, seq.hour].map(function (p) { return p && p.name ? p.name : ''; }).filter(Boolean);
  // C4 xiaoliuren.shens：按落掌神（primary.name/point）查六神释义；查不到走中性兜底文案
  const shenText = (name && C4_XIAOLIUREN_SHENS[name]) || '';
  blocks.push({
    label: '掌诀含义',
    text: shenText ? shenText : (name ? ('本课落宫「' + name + '」释义未收录，可参考上方通用提示并结合所问之事综合体会。') : '本课落宫暂缺，请以起宫、行宫与所问之事综合体会。'),
    tip: '落宫掌诀是小六壬断事的核心口诀；释义为文化视角下的趋势参考，仅供自我觉察。'
  });
  // C3 genericRules：小六壬「起宫—行宫—落宫」与本卦（起始）—互卦（中段）—变卦（结果）同构，通则并列供参读
  blocks.push({
    label: '通用提示',
    text: (seqNames.length === 3 ? '本课自' + seqNames[0] + '起，经' + seqNames[1] + '，落于' + seqNames[2] + '。' : '')
      + '小六壬按「月 → 日 → 时」依序顺数至落宫断事：起宫见事端，行宫见过程，落宫为事之归结；落宫吉凶宜结合所问之事与自身处境综合体会。'
      + '\n卦理通则（可资参读）：'
      + C3_GENERIC_RULES['本卦'] + C3_GENERIC_RULES['互卦'] + C3_GENERIC_RULES['变卦'],
    tip: '以上为静态规则参考，仅供自我觉察，不构成任何决策建议。'
  });
  return FreeCard('免费解读', blocks);
}
/* REQ-118：大六壬免费静态断课（确定性，零 LLM）—— 依据引擎已排好的课盘字段组织：
   发用/三传主线 + 课体 + 类神/神煞 + 应期参考，末附免责尾注。 */
function LiurenFreeReading(res) {
  const blocks = [];
  // 发用与三传主线（引擎已算好的确定性摘要）
  const rule = res.transmissionRule || '';
  const pattern = res.transmissionPattern || '';
  const trans = Array.isArray(res.threeTransmissions) ? res.threeTransmissions : [];
  const mainLine = res.transmissionSummary
    || (trans.length
      ? '三传主线：' + trans.map(function (t) { return t.stage + t.branch; }).join(' → ') + '。'
      : '');
  blocks.push({
    label: '发用与三传',
    text: (rule ? '本课以「' + rule + '」取初传发用' + (pattern ? '，传态' + pattern : '') + '。' : '')
      + (mainLine ? '\n' + mainLine : '')
      + '\n三传分定事之发端、转折与归结：初传看事端起势，中传看中途变化，末传看最终趋向。',
    tip: '三传为大六壬断事的核心主线；此为传统文化视角的趋势参考，仅供自我觉察。'
  });
  // 课体
  const guaTi = Array.isArray(res.guaTi) ? res.guaTi : [];
  if (guaTi.length) {
    blocks.push({
      label: UI_COPY.divination['dlr-keti'],
      text: '本课课体：' + guaTi.join('、') + '。' + (res.transmissionDetail ? '\n' + res.transmissionDetail : ''),
      tip: '课体为经典取象的概括性名称，提示整课气质；具体吉凶仍须结合四课三传与所问综合体会。'
    });
  }
  // 类神（focusEvidence 主证/辅证，引擎确定性标定）
  const focus = Array.isArray(res.focusEvidence) ? res.focusEvidence : [];
  if (focus.length) {
    const focusLines = focus.map(function (f) {
      const ev = Array.isArray(f.evidence) ? f.evidence.join('；') : '';
      return '· ' + (f.level || '') + '「' + (f.target || '') + '」（' + (f.role || '') + '）' + (ev ? '：' + ev : '');
    });
    blocks.push({
      label: '类神落点',
      text: focusLines.join('\n') + '\n类神依所问主题选取：感情看天后/六合/青龙，事业看贵人/朱雀/青龙，财富看青龙/太常/天空。',
      tip: '类神是断事的取象抓手；只取与本课发用、三传相关的项，不罗列闲象。'
    });
  }
  // 神煞
  const ss = Array.isArray(res.shenShaSummary) ? res.shenShaSummary : [];
  if (ss.length) {
    blocks.push({
      label: UI_COPY.divination['dlr-shensha'],
      text: ss.join('、') + '\n神煞只定位所在干支，须入课/入传或临干支才有象意；不凭单项神煞定吉凶。',
      tip: '神煞作辅助取象，须与课传结合方有象意。'
    });
  }
  // 应期参考
  const timing = Array.isArray(res.timingEvidence) ? res.timingEvidence : [];
  if (timing.length) {
    blocks.push({
      label: UI_COPY.divination['dlr-yingqi'],
      text: timing.join('\n') + '\n应期只作先后、快慢与触发条件的趋势提示，不硬报到具体日期。',
      tip: '以发用→三传→日月条件的先后节奏作参考，不承诺具体时间点。'
    });
  }
  return React.createElement(React.Fragment, null,
    FreeCard('课理解读（免费）', blocks),
    React.createElement(TCTermPanel, { method: 'liuren' }),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 8 } },
      '以上内容由传统课理生成，属趋势参考与娱乐范畴，不构成任何现实建议；请理性看待，重大决策请依据现实信息。'));
}
/* REQ-119：金口诀免费静态断课（确定性，零 LLM）—— 依据引擎已排好的课盘字段组织：
   起课来由 + 阴阳发用 + 五动三动 + 四位生克/比合 + 空亡提示，末附免责尾注。 */
function JinkoujueFreeReading(res) {
  const blocks = [];
  // 起课来由与四位（引擎确定性摘要）
  const calc = (res && typeof res === 'object' && res.calculation) || {};
  const methodLine = (res.methodLabel || '') + (calc.diFenNote ? '：' + calc.diFenNote : '');
  const pos = (res && typeof res === 'object' && res.positions) || {};
  const fourLine = UI_COPY.divination['jk-renyuan'] + (pos.renYuan ? (pos.renYuan.stem || '') + (pos.renYuan.branch || '') : '')
    + '、贵神' + (pos.guiShen ? (pos.guiShen.stem || '') + (pos.guiShen.branch || '') + UI_COPY.divination['dlr-cheng'] + (pos.guiShen.god || '') : '')
    + '、将神' + (pos.jiangShen ? (pos.jiangShen.stem || '') + (pos.jiangShen.branch || '') : '')
    + '、地分' + (res.diFenBranch || '') + '。';
  blocks.push({
    label: '起课与四位',
    text: (methodLine ? methodLine + '。' : '') + '\n四位一体：' + fourLine
      + '\n人元为客/天/外位，贵神为主/官禄位，将神为己身/妻财位，地分为田宅/子孙位——按所问定向取位。',
    tip: '四位一体为金口诀断事的骨架；此为传统文化视角的趋势参考，仅供自我觉察。'
  });
  // 阴阳发用
  const yy = (res && typeof res === 'object' && res.yinYangUse) || {};
  if (yy.pattern) {
    blocks.push({
      label: UI_COPY.divination['jk-yinyang-fayong'],
      text: '本课' + yy.pattern + '（' + (yy.yangCount != null ? yy.yangCount : '') + UI_COPY.divination['ly-yang'] + (yy.yinCount != null ? yy.yinCount : '') + '阴）：'
        + (yy.rule || '') + '，取「' + (yy.usePosition || '') + '」为用'
        + (yy.isVoid ? '；发用旬空，须待出空/填实后再作主断' : '') + '。\n发用位为断事主轴：三阴一阳取唯一阴位、三阳一阴取唯一阳位、二阴二阳以旺相者取用、纯阴/纯阳按次第取用。',
      tip: '发用位是整课的断事落点，先认发用再谈吉凶趋势。'
    });
  }
  // 五动三动
  const mv = Array.isArray(res.movements) ? res.movements : [];
  if (mv.length) {
    blocks.push({
      label: UI_COPY.divination['jk-wudong-sandong'],
      text: mv.map(function (m2) {
        return '· ' + (m2.category || '') + '「' + (m2.name || '') + '」：' + (m2.trigger || '') + '（' + (m2.source || '') + '）';
      }).join('\n')
        + '\n动名主象：财动主财利往来、官动主官非升迁、鬼动主灾讼忧疑、父母动主文书长辈、子孙动主解脱晚辈、兄弟动主竞争同伴。',
      tip: '动名须结合所问与用位综合体会，不按动名直接定现实结果。'
    });
  }
  // 四位生克 + 比合
  const rel = (res && typeof res === 'object' && res.relations) || {};
  const relKeys = [['guiToJiang', '贵神→将神'], ['guiToRen', '贵神→人元'], ['jiangToDi', '将神→地分'], ['renToDi', '人元→地分'], ['guiToDi', '贵神→地分']];
  const relBits = relKeys.filter(function (rk) { return rel[rk[0]]; }).map(function (rk) { return rk[1] + rel[rk[0]]; });
  if (relBits.length || res.bihePoem) {
    blocks.push({
      label: '生克与比合',
      text: (relBits.length ? '四位生克：' + relBits.join('、') + '。\n' : '')
        + (res.bihePoem ? '比合歌诀：' + res.bihePoem + '（二木为爻、二火为灾、二土为滞、二金为刑、二水为盗）。' : '')
        + '\n生克只表盘内作用方向，比合提示四位气质，都不直接判现实成败。',
      tip: '生克与比合作辅助取象，须与发用、动象结合。'
    });
  }
  // 空亡提示（旬空）
  const xk = Array.isArray(res.xunKong) ? res.xunKong : [];
  if (xk.length) {
    blocks.push({
      label: '旬空提示',
      text: '日旬空亡：' + xk.join('、') + '。空亡之位信息未实，须待出空/填实后再作主断，不直接判无成。',
      tip: '空亡只表示该位信息暂虚，不构成现实吉凶定论。'
    });
  }
  return React.createElement(React.Fragment, null,
    FreeCard('课理解读（免费）', blocks),
    React.createElement(TCTermPanel, { method: 'jinkoujue' }),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 8 } },
      '以上内容由传统课理生成，依据《六壬神课金口诀古本》，属趋势参考与娱乐范畴，不构成任何现实建议；请理性看待，重大决策请依据现实信息。'));
}
/* REQ-120：奇门时家免费静态断局（确定性，零 LLM）—— 依据引擎已排好的局盘字段组织：
   定局与值符值使 + 格局主线 + 反证提示 + 应期节奏 + 方位参考，末附免责尾注。 */
function QimenFreeReading(res) {
  const blocks = [];
  // 定局与值符值使（引擎确定性摘要）
  const ti = (res && typeof res === 'object' && res.timeInfo) || {};
  const scopeCn = QIMEN_SCOPE_CN[res.scope] || res.scope || '时家';
  const methodCn = QIMEN_METHOD_CN[res.method] || res.method || '转盘';
  const juCn = QIMEN_JU_CN[res.juMethod] || res.juMethod || '拆补';
  const juLine = (res.isYangDun ? UI_COPY.divination['qm-yangdun'] : UI_COPY.divination['qm-yindun']) + (res.juShu != null ? res.juShu + '局' : '');
  const juBits = [scopeCn + '奇门', methodCn + '法', juCn + '定局', juLine,
    res.zhiFu ? UI_COPY.divination['qm-zhifu'] + res.zhiFu : '', res.zhiShi ? UI_COPY.divination['qm-zhishi'] + res.zhiShi : '',
    ti.solarTerm ? ti.solarTerm + (ti.epoch ? ti.epoch : '') : ''].filter(Boolean);
  blocks.push({
    label: '定局与值符值使',
    text: juBits.join('，') + '。'
      + (ti.juMethodNote ? '\n' + ti.juMethodNote : '')
      + '\n值符为九星之主、值使为八门之主，断局先认值符值使落宫，再看所问用神宫的门星神干组合。',
    tip: '局盘层级（时/日/月/年家）决定应期量级，不跨级换算。此为传统文化视角的趋势参考，仅供自我觉察。'
  });
  // 格局主线：基础标签 + 经典格局
  const tags = Array.isArray(res.patternTags) ? res.patternTags : [];
  const cls = Array.isArray(res.classicPatterns) ? res.classicPatterns : [];
  const goodCls = cls.filter(function (c) { return c.type === 'good'; });
  const badCls = cls.filter(function (c) { return c.type === 'bad'; });
  if (tags.length || cls.length) {
    const patBits = [];
    if (tags.length) patBits.push('基础标签：' + tags.join('、') + '。');
    if (goodCls.length) patBits.push('吉性格局：' + goodCls.map(function (c) { return c.name; }).join('、') + '。');
    if (badCls.length) patBits.push(UI_COPY.divination['qm-xiongxing-geju'] + badCls.map(function (c) { return c.name; }).join('、') + '。');
    blocks.push({
      label: '格局主线',
      text: patBits.join('\n') + '\n格局为盘面组合提示：伏吟主迟滞反复、反吟主冲动反复、门迫主该宫受阻、入墓主事迟；吉凶混杂宫须分清主次，不单向取吉。',
      tip: '格局命中只证明盘面满足规则，不是现实吉凶或结果概率。'
    });
  }
  // 反证提示：空亡 / 风险宫位
  const counterBits = [];
  const voidPalaces = Array.isArray(res.voidPalaces) ? res.voidPalaces : [];
  if (voidPalaces.length) {
    counterBits.push(UI_COPY.divination['qm-xunkong-prefix'] + voidPalaces.map(function (v) { return (v.branch || '') + '·' + (v.name || ''); }).join('、')
      + '（待出空/填实后再作主断）。');
  }
  const sc = (res && typeof res === 'object' && res.specialConditions) || {};
  if (sc.description) counterBits.push(UI_COPY.divination['qm-teshu-shichen'] + sc.description);
  const risks = Array.isArray(res.palaceInsights) ? res.palaceInsights.filter(function (p) { return p.level === '风险' || p.level === '关注'; }) : [];
  if (risks.length) {
    counterBits.push(UI_COPY.divination['qm-fengxian-gongwei'] + risks.map(function (p) { return p.name + '（' + p.summary + '）'; }).join('；'));
  }
  if (counterBits.length) {
    blocks.push({
      label: '反证提示',
      text: counterBits.join('\n') + '\n反证只提示盘面限制与反向条件，不把单项限制写成现实失败或灾祸。',
      tip: '先看反证再下判断，避免单向取吉。'
    });
  }
  // 应期节奏
  const yq = (res && typeof res === 'object' && res.yingQi) || {};
  if (yq.rhythm || yq.description || yq.triggerConditions) {
    const tc = Array.isArray(yq.triggerConditions) ? yq.triggerConditions : [];
    blocks.push({
      label: UI_COPY.divination['dlr-yingqi'],
      text: (yq.description || '') + '\n盘内节奏：' + (yq.rhythm || '—')
        + (tc.length ? '；触发条件：' + tc.join('；') : '')
        + '\n应期只按局盘层级给相对节奏与触发条件（出空/填实/马星/冲合），不换算固定天数或具体日期。',
      tip: '时家看时辰节奏、日家看日内、月家看月内、年家看年内，不跨级硬报日期。'
    });
  }
  // 方位参考
  const dir = (res && typeof res === 'object' && res.directions) || {};
  const goodDirs = Array.isArray(dir.goodDirections) ? dir.goodDirections : [];
  const avoidDirs = Array.isArray(dir.avoidDirections) ? dir.avoidDirections : [];
  if (goodDirs.length || avoidDirs.length) {
    const dirBits = [];
    if (goodDirs.length) dirBits.push('建议方位：' + goodDirs.map(function (d2) { return d2.direction + (d2.use ? '（宜' + d2.use + '）' : ''); }).join('、') + '。');
    if (avoidDirs.length) dirBits.push('避用方位：' + avoidDirs.map(function (d2) { return d2.direction + (d2.use ? '（宜' + d2.use + '）' : ''); }).join('、') + '。');
    blocks.push({
      label: UI_COPY.divination['qm-fangwei-cankao'],
      text: dirBits.join('\n') + '\n方位为盘面象义参考，采用前须核实现实路线、安全与条件，不构成行动保证。',
      tip: '方位提示只作行动参考，不以方位断言成败。'
    });
  }
  return React.createElement(React.Fragment, null,
    FreeCard('局理解读（免费）', blocks),
    React.createElement(TCTermPanel, { method: 'qimen' }),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 8 } },
      '以上内容由传统局理生成，依据《烟波钓叟歌》《御定奇门宝鉴》《奇门遁甲秘籍大全》，属趋势参考与娱乐范畴，不构成任何现实建议；请理性看待，重大决策请依据现实信息。'));
}
/* ---------- REQ-069：手动录入实际结果 —— 共享常量/工具（六爻·梅花共用逐爻器；签号/掌诀/牌库选牌） ---------- */
/* 六爻手工爻值映射：阳=7(少阳)、阴=8(少阴)、动阳=9(老阳)、动阴=6(老阴) —— 与后端 generateLiuyao options.yaos(6..9) 契约一致 */
const YAO_VAL_OF = function (yang, moving) { return yang ? (moving ? 9 : 7) : (moving ? 6 : 8); };
const blankYaoRows = function () { const a = []; for (let i = 0; i < 6; i++) a.push({ yang: null, mv: false }); return a; };
/* 梅花生辰结构：后端 trigramsByIndex = 1乾/2兑/3离/4震/5巽/6坎/7艮/8坤（爻位自下而上 1=阳 0=阴）；
   逐爻点选成卦后换算为经卦索引 → 通过随机样本重放让引擎确定性还原同一卦盘（body 中的 replay 仅作传输，实际卦象=所录六爻）。 */
const MH_TRIG_IDX = { '111': 1, '110': 2, '101': 3, '100': 4, '011': 5, '010': 6, '001': 7, '000': 8 };
const mhTrigramIdx = function (r3) {
  const key = r3.map(function (r) { return r.yang ? '1' : '0'; }).join('');
  return MH_TRIG_IDX[key] || 0;
};
/* 观音灵签签池（后端 ssgw-data 共 92 支，签号 1-92）；replay 样本把随机签固定在所选签号上 */
const SSGW_POOL_SIZE = 92;
const signReplaySample = function (n) { return (n - 0.5) / SSGW_POOL_SIZE; };
/* 小六壬六宫（与后端 XIAOLIUREN_PALACES 同序：大安/留连/速喜/赤口/小吉/空亡） */
const XLR_PALACE_ORDER = ['大安', '留连', '速喜', '赤口', '小吉', UI_COPY.divination['qm-kongwang']];
/* 按传统「月→日→时」顺数落宫：宫位索引=(月-1+日-1+时-1) mod 6（shichen 序数 1=子…12=亥） */
const xlrPalaceName = function (m, d, h) { return XLR_PALACE_ORDER[(((m - 1) + (d - 1) + (h - 1)) % 6 + 6) % 6] || ''; };

/* =====================================================================
   REQ-061：占卜动效与翻牌交互（统一机制）
   - 读取钩子：tcShouldPlayAnim()=REQ-066①「动画与抽卡模拟」；tcShouldShowCards()=REQ-066⑥「牌面图片显示」
   - 动效阶段 state 机：各演出组件内部 ph 只描述"演出到哪一步"，取数/落库仍走既有 doCast/draw/load
   - 结果一致性：观音灵签/六爻 = 前端先定结果 + replay 固定（REQ-069 同契约）；
     梅花/小六壬 = 取数先行（演出的卦名/落宫一律取自后端结果，不本地复制引擎）；
     塔罗/雷诺曼 = 取数先行，数据藏于牌背，翻牌时揭示
   - 全部器物为占位/程序化 CSS；素材接入点见上方注释的 --art-* 变量槽
   ===================================================================== */
const tcShouldPlayAnim = function () { return TC_SETTINGS.anim_enabled !== false; };
const tcShouldShowCards = function () { return TC_SETTINGS.card_images !== false; };
const artFxEls = function (n) {
  const els = [];
  for (let i = 0; i < n; i++) {
    const st = {
      left: (3 + ((i * 41 + 7) % 90)) + '%',
      bottom: (2 + ((i * 23 + 5) % 12)) + '%',
      width: (3 + ((i * 7) % 4)) + 'px',
      height: (3 + ((i * 7) % 4)) + 'px',
      opacity: 0.32 + ((i * 5) % 4) * 0.16,
      animationDelay: ((i * 0.61) % 3.4).toFixed(2) + 's',
      animationDuration: (3.6 + ((i * 37) % 24) / 10).toFixed(2) + 's',
      animationFillMode: 'both'
    };
    els.push(React.createElement('span', { key: 'fx' + i, className: 'art-fx', style: st }));
  }
  return els;
};
/* 全屏演出层公共框架（z-index 70，高于 modal-mask 50；右上「跳过动画」=单次跳过不改变全局开关） */
function ArtStageFrame(opts) {
  const kids = [
    React.createElement('div', { key: 'bg', className: 'stage-bg' }),
    React.createElement('div', { key: 'fx', className: 'art-fx-wrap' }, artFxEls(10))
  ];
  if (opts.skip) kids.push(React.createElement('button', { key: 'sk', type: 'button', className: 'art-skip', onClick: opts.skip }, UI_COPY.buttons.skip_anim));
  if (opts.cancel) kids.push(React.createElement('button', { key: 'cc', type: 'button', className: 'art-cancel', onClick: opts.cancel }, opts.cancelLabel || UI_COPY.buttons.back));
  kids.push(React.createElement('div', { key: 'cap', className: 'stage-cap' },
    React.createElement('div', { className: 'stage-title' }, opts.title),
    opts.sub ? React.createElement('div', { className: 'stage-sub' }, opts.sub) : null));
  if (opts.children) kids.push(opts.children);
  // REQ-081①：观音灵签 全屏任意处点击触发摇签 —— onTap 挂到整层舞台（排除 跳过/取消 功能按钮）
  const rootTap = opts.onTap
    ? function (e) {
      if (e && e.target && e.target.closest && e.target.closest('.art-skip,.art-cancel')) return;
      opts.onTap(e);
    }
    : null;
  return React.createElement('div', { className: 'art-stage', onClick: rootTap }, kids);
}
/* 翻牌卡正面（占位/正片共用：有 img 用图，无则色块占位；塔罗逆位沿用 rotate180 语义） */
function ArtCardFront(props) {
  const { img, name, suit, rev, phColor } = props;
  const art = img
    ? React.createElement('img', { className: 'tc-img', src: img, alt: name, loading: 'lazy', decoding: 'async' })
    : React.createElement('div', { className: 'fc-ph', style: { background: phColor || '#5B4B8A' } }, name);
  return React.createElement('div', { className: 'fc-side fc-front' },
    React.createElement('div', { className: 'fc-art suit-' + (suit || 'major') + (rev ? ' reversed' : '') }, art));
}
function ArtCardBack(props) {
  return React.createElement('div', { className: 'fc-side fc-back' + (props.kind === 'leno' ? ' leno' : ' taro') },
    React.createElement('span', { className: 'back-mark' }, '太初'));
}

/* ---------------- 观音灵签：可交互签筒舞台 ----------------
   流程：点击签筒（兜底）/ 摇动手机 → 筒身抖动 → 签条弹出旋转落地（签号=进入时已定，replay 固定）→ 转签文。
   devicemotion：iOS 13+ 首次点击时在用户手势内 requestPermission；拒绝/无传感器自动降级为点击模式。 */
function SsgwTubeStage(props) {
  const { fixedNo, resultReady, failed, onDraw, onFinish, onSkip, onExit } = props;
  const [ph, setPh] = useState('idle'); // idle|shake|fly|land|landed|finish|out
  const [motionMode, setMotionMode] = useState(null); // null=未确认 | 'tap'=仅点击 | 'shake'=可摇动
  const timersRef = useRef([]);
  const firedRef = useRef(false);
  const doneRef = useRef(false);
  const motionRef = useRef(false);
  const hiddenRef = useRef(false);
  const accRef = useRef([]);
  const coolRef = useRef(0);
  const askedRef = useRef(false);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  const beginShake = function () {
    if (firedRef.current) return;
    firedRef.current = true;
    coolRef.current = Date.now() + 1200;
    onDraw(fixedNo); // 摇动瞬间即按已定签号取数（replay 固定 → 落签与后端签文必然一致）
    setPh('shake');
    later(function () { setPh('fly'); }, 560);
    later(function () { setPh('land'); }, 1420);
    later(function () { setPh('landed'); }, 2100);
    later(function () { setPh('finish'); }, 2580);
  };
  const armMotion = function () {
    try {
      const DM = window.DeviceMotionEvent;
      if (!DM || typeof DM.requestPermission !== 'function') {
        // 桌面/旧版 iOS：直接启用加速度监听（无传感器则永不触发，不影响点击兜底）
        motionRef.current = true;
        return;
      }
      if (askedRef.current) return;
      askedRef.current = true;
      DM.requestPermission().then(function (st) {
        motionRef.current = (st === 'granted');
        if (st !== 'granted') setMotionMode('tap');
      }).catch(function () { motionRef.current = false; setMotionMode('tap'); });
    } catch (e) { motionRef.current = false; setMotionMode('tap'); }
  };
  useEffect(function () {
    const onVis = function () { hiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    const onMotion = function (ev) {
      if (!motionRef.current || hiddenRef.current || firedRef.current) return;
      const a = ev.accelerationIncludingGravity || ev.acceleration || null;
      if (!a) return;
      const x = a.x || 0, y = a.y || 0, z = a.z || 0;
      const mag = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (mag > 15) {
        const arr = accRef.current.filter(function (t) { return now - t < 800; });
        arr.push(now);
        accRef.current = arr;
        // 窗口 800ms 内 ≥3 次峰值 → 判为一次有效摇动；1.2s 冷却 + 本会话只掉一支签
        if (arr.length >= 3 && now > coolRef.current) beginShake();
      }
    };
    window.addEventListener('devicemotion', onMotion, false);
    return function () {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('devicemotion', onMotion, false);
    };
  }, []);
  const clickTube = function () {
    armMotion();
    beginShake();
  };
  // 演出收尾：动画播完 & 数据就绪（或失败）→ 淡出交给结果视图（DivSsgwView）
  useEffect(function () {
    if (doneRef.current) return;
    if (failed && ph !== 'idle') {
      doneRef.current = true;
      setPh('out');
      later(function () { onFinish(); }, 300);
      return;
    }
    if (ph === 'finish' && resultReady) {
      doneRef.current = true;
      setPh('out');
      later(function () { onFinish(); }, 340);
    }
  }, [ph, resultReady, failed]);
  let stickCls = 'ssgw-stick';
  if (ph === 'fly') stickCls += ' fly';
  else if (ph === 'land') stickCls += ' land';
  else if (ph === 'landed' || ph === 'finish' || ph === 'out') stickCls += ' stay';
  if (ph === 'landed' || ph === 'finish') stickCls += ' reveal';
  const dustEls = [];
  if (ph === 'land' || ph === 'landed' || ph === 'finish') {
    const dxs = [-38, 26, -8, 44, -56, 58];
    dxs.forEach(function (d, di) {
      dustEls.push(React.createElement('i', { key: di, style: { '--dx': d + 'px' } }));
    });
  }
  const tips = [0, 1, 2].map(function (i) { return React.createElement('i', { key: i }); });
  let hint = null;
  if (ph === 'idle') {
    hint = React.createElement('div', { className: 'stage-hint' },
      motionMode === 'tap'
        ? UI_COPY.divin.sign_tap_tap
        : React.createElement('span', null, React.createElement('span', { className: 'h-key' }, UI_COPY.divin.sign_tap_any), UI_COPY.divin.sign_tap_or));
  }
  const zone = React.createElement('div', { className: 'ssgw-zone' },
    React.createElement('div', { className: 'ssgw-land-glow' + (ph === 'landed' || ph === 'finish' ? ' on' : '') }),
    React.createElement('div', { className: 'ssgw-dust' }, dustEls),
    React.createElement('div', { className: 'ssgw-tube-wrap' + (ph === 'shake' ? ' shake' : ''), onClick: clickTube },
      React.createElement('div', { className: 'ssgw-tube' },
        React.createElement('div', { className: 'tube-rim' }),
        React.createElement('div', { className: 'tube-tips' }, tips),
        React.createElement('div', { className: 'tube-mouth' }),
        React.createElement('div', { className: 'tube-body' }))),
    React.createElement('div', { className: stickCls },
      React.createElement('i', { className: 'stick-red' }),
      React.createElement('span', { className: 'stick-no' }, '第 ' + fixedNo + ' 签')));
  const waitLine = (ph === 'finish' && !resultReady)
    ? React.createElement('div', { className: 'stage-wait' }, React.createElement('i', null), '签文正在生成…')
    : null;
  const tipLine = React.createElement('div', { className: 'stage-tip' },
    ph === 'idle' ? '默念所问之事，诚心摇签；签号即你所抽之签，结果以签文为准。' : '摇签完成 · 即将展示签文');
  const children = [zone, hint, waitLine, tipLine];
  return ArtStageFrame({
    title: '观音灵签',
    sub: '一签一问 · 心诚则灵',
    skip: onSkip,
    cancel: (ph === 'idle' && onExit) ? onExit : null,
    cancelLabel: '返回重选',
    // REQ-081①：摇签等待期整个画面可点击触发（保留点击签筒/摇晃兜底）
    onTap: (ph === 'idle') ? clickTube : null,
    children: children
  });
}

/* ---------------- 观音灵签：独立结果展示界面（REQ-081②） ----------------
   摇签/手动选签成功后进入全屏独立视图：大字「第 N 签」+ 签诗 + 免费签意
   + 付费「深度解读」入口；底部「重新起卦 / 返回」全宽并列大按钮。不再把
   卦象结果内联在「临时起卦」页面最下方。 */
function SsgwResultScreen(props) {
  const { res, qText, manLabel, interp, interpErr, interpLoading, payEnough, onInterpret, onRedo, onBack } = props;
  const number = (res && res.number != null) ? res.number : (res && res.no != null ? res.no : null);
  const title = (res && res.title) ? String(res.title) : '';
  const poem = (res && res.poem) ? String(res.poem) : '';
  const draw = (res && res.draw && typeof res.draw === 'object' && !Array.isArray(res.draw)) ? res.draw : {};
  const det = (res && res.details && typeof res.details === 'object' && !Array.isArray(res.details)) ? res.details : null;
  // title 惯例含「第N签 · …」前缀，与大字签号重复时剥掉，仅留签题
  const cleanName = title.replace(/^第[0-9一二三四五六七八九十百千]+签\s*[·、]?\s*/, '').trim();
  const cardKids = [];
  if (qText) cardKids.push(React.createElement('div', { key: 'q', className: 'ssgw-res-echo' }, '问题：', qText));
  if (manLabel) cardKids.push(React.createElement('div', { key: 'm', className: 'ssgw-res-man' }, '录入：', manLabel));
  if (number != null) cardKids.push(React.createElement('div', { key: 'no', className: 'ssgw-res-bigno' }, '第 ' + number + ' 签'));
  if (cleanName) cardKids.push(React.createElement('div', { key: 'nm', className: 'ssgw-res-name' }, cleanName));
  if (poem) cardKids.push(React.createElement('div', { key: 'poem', className: 'ssgw-res-poem' }, poem));
  const extras = [];
  if (number != null && draw.poolSize) extras.push(UI_COPY.divination['gylq-qianchi'] + draw.poolSize + ' 支');
  if (draw.method) extras.push(UI_COPY.divination['gylq-chouqian-fangshi'] + (draw.method === 'manual' ? '手动录入' : '自动摇签'));
  if (extras.length) cardKids.push(React.createElement('div', { key: 'ex', className: 'ssgw-res-extra' }, extras.join(' · ')));
  if (res && res.text) cardKids.push(React.createElement('p', { key: 'tx', style: { marginTop: 8, color: '#6E4A24', lineHeight: 1.7, fontSize: 12.5 } }, String(res.text)));
  // 免费签意（后端确定性签解字段，静态零 LLM；字段缺失则整段不展示）
  const freeKids = [];
  const ji = det && det['吉凶'] ? String(det['吉凶']) : '';
  const zong = det && det['解签总论'] ? String(det['解签总论']) : '';
  const core = det && det['此签核心'] ? String(det['此签核心']) : '';
  if (ji) freeKids.push(React.createElement('span', { key: 'ji', className: 'rf-jixiong' }, ji));
  if (zong) freeKids.push(React.createElement('div', { key: 'z', className: 'rf-item' }, React.createElement('b', null, UI_COPY.divin.sign_free_zonglun), zong));
  if (core) freeKids.push(React.createElement('div', { key: 'c', className: 'rf-item' }, React.createElement('b', null, UI_COPY.divin.sign_free_core), core));
  if (freeKids.length) {
    cardKids.push(React.createElement('div', { key: 'free', className: 'ssgw-res-free' },
      React.createElement('div', { className: 'rf-title' }, UI_COPY.divin.sign_free_head), freeKids));
  }
  cardKids.push(React.createElement('div', { key: 'pay', className: 'ssgw-res-pay' },
    React.createElement('div', { className: 'pay-hint' }, UI_COPY.divin.sign_pay_hint),
    React.createElement('button', { className: 'btn btn-outline', style: { marginTop: 8 }, disabled: interpLoading, onClick: onInterpret },
      interpLoading ? UI_COPY.tips.interpreting : [UI_COPY.buttons.interpret_pay, payBadge(payEnough)]),
    interpErr ? React.createElement('div', { className: 'error', style: { marginTop: 10 } }, interpErr) : null,
    interp ? React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'interp-title' }, UI_COPY.divin.sign_interp_title),
      React.createElement('div', { className: 'interp-body' }, interp)) : null));
  // REQ-104：独立结果页统一口径 —— 结果页免责尾注（复用既有品牌免责常量，不新造文案）
  cardKids.push(React.createElement('div', { key: 'disc', className: 'ssgw-res-disc' }, UI_COPY.landing.disclaimer_short));
  return React.createElement('div', { className: 'ssgw-res-screen' },
    React.createElement('div', { className: 'ssgw-res-head' },
      React.createElement('div', { className: 'ssgw-res-kicker' }, UI_COPY.divin.sign_kicker),
      React.createElement('span', { className: 'ssgw-res-sub' }, UI_COPY.divin.sign_head_sub)),
    React.createElement('div', { className: 'ssgw-res-scroll' },
      React.createElement('div', { className: 'ssgw-res-card' }, cardKids)),
    React.createElement('div', { className: 'ssgw-res-foot' },
      React.createElement('button', { className: 'btn ssgw-res-ghost', onClick: onRedo }, UI_COPY.buttons.redo_divination),
      React.createElement('button', { className: 'btn ssgw-res-ghost', onClick: onBack }, UI_COPY.buttons.back_options)));
}

/* ---------------- REQ-104 + BUG-016：六爻/梅花/小六壬 独立结果页 ----------------
   卦象结果不再内联在「临时起卦」选项列表下方（BUG-016），统一改走全屏独立视图；
   复用 .ssgw-res-* 骨架（与观音灵签 REQ-081 独立页同风格）；底部「重新起卦 / 回到选项」
   全宽并列大按钮。免费静态解读（REQ-055）+ 深度断卦付费入口 + 免责尾注（LIUYAO_DISCLAIMER
   现有常量）全部保留。 */
function GuaResultScreen(props) {
  const { kicker, sub, kids, interp, interpErr, interpLoading, payEnough, onInterpret, onRedo, onBack, interpretLabel } = props;
  const cardKids = kids.slice();
  cardKids.push(React.createElement('div', { key: 'pay', className: 'ssgw-res-pay' },
    React.createElement('div', { className: 'pay-hint' }, UI_COPY.divin.sign_pay_hint),
    React.createElement('button', { className: 'btn btn-outline', style: { marginTop: 8 }, disabled: interpLoading, onClick: onInterpret },
      interpLoading ? UI_COPY.tips.interpreting_liuyao : [(interpretLabel || UI_COPY.buttons.interpret_pay), payBadge(payEnough)]),
    interpErr ? React.createElement('div', { className: 'error', style: { marginTop: 10 } }, interpErr) : null,
    interp ? React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'interp-title' }, UI_COPY.divin.sign_interp_title),
      React.createElement('div', { className: 'interp-body' }, interp)) : null));
  cardKids.push(React.createElement('div', { key: 'disc', className: 'ssgw-res-disc' }, LIUYAO_DISCLAIMER));
  return React.createElement('div', { className: 'ssgw-res-screen' },
    React.createElement('div', { className: 'ssgw-res-head' },
      React.createElement('div', { className: 'ssgw-res-kicker' }, kicker),
      React.createElement('span', { className: 'ssgw-res-sub' }, sub)),
    React.createElement('div', { className: 'ssgw-res-scroll' },
      React.createElement('div', { className: 'ssgw-res-card' }, cardKids)),
    React.createElement('div', { className: 'ssgw-res-foot' },
      React.createElement('button', { className: 'btn ssgw-res-ghost', onClick: onRedo }, UI_COPY.buttons.redo_divination),
      React.createElement('button', { className: 'btn ssgw-res-ghost', onClick: onBack }, UI_COPY.buttons.back_options)));
}

/* ---------------- 六爻起卦演出：逐爻掷 3 铜钱 × 6（yaos 前端先定 → replay 固定） ---------------- */
const shuffleArr = function (a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = b[i]; b[i] = b[j]; b[j] = t;
  }
  return b;
};
const yaosPartsOf = function (v) {
  if (v === 6) return [2, 2, 2];            // 老阴：三字（2+2+2）
  if (v === 7) return shuffleArr([2, 2, 3]); // 少阳：两字一背
  if (v === 8) return shuffleArr([2, 3, 3]); // 少阴：一字两背
  if (v === 9) return [3, 3, 3];            // 老阳：三背
  return shuffleArr([2, 2, 3]);
};
function LiuyaoCastStage(props) {
  const { yaos, resultReady, guaText, failed, onFinish, onSkip } = props;
  const [cur, setCur] = useState(-1);
  const [doneRows, setDoneRows] = useState([]);
  const [phase, setPhase] = useState('run'); // run|final|done
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const timersRef = useRef([]);
  const partsRef = useRef(null);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  if (!partsRef.current) partsRef.current = (yaos || []).map(yaosPartsOf);
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  useEffect(function () {
    if (startedRef.current) return;
    startedRef.current = true;
    const n = (yaos && yaos.length) || 6;
    (yaos || []).forEach(function (v, i) {
      later(function () { setCur(i); }, 150 + i * 780);
      later(function () {
        setDoneRows(function (prev) { return prev.indexOf(i) >= 0 ? prev : prev.concat([i]); });
      }, 150 + i * 780 + 650);
    });
    later(function () { setPhase('final'); }, 150 + n * 780 + 120);
    later(function () { setPhase('done'); }, 150 + n * 780 + 900);
  }, []);
  useEffect(function () {
    if (doneRef.current) return;
    if (failed) { doneRef.current = true; onFinish(); return; }
    if (phase === 'done' && resultReady) { doneRef.current = true; onFinish(); }
  }, [phase, resultReady, failed]);
  let coinRow = null;
  if (cur >= 0 && cur < (yaos || []).length) {
    const parts = partsRef.current[cur] || [];
    const settled = doneRows.indexOf(cur) >= 0;
    coinRow = React.createElement('div', { key: 'c' + cur, className: 'ly-coins' },
      parts.map(function (p, ci) {
        const cls = 'coin' + (settled ? (p === 3 ? ' back' : ' front') : ' toss');
        return React.createElement('div', { key: ci, className: cls },
          React.createElement('div', { className: 'c3d' },
            React.createElement('div', { className: 'side s-a' }),
            React.createElement('div', { className: 'side s-b' })));
      }));
  } else {
    coinRow = React.createElement('div', { className: 'ly-coins' },
      React.createElement('span', { className: 'coin-empty' }, '凝神起卦 · 逐爻掷币'));
  }
  const mvCount = (yaos || []).filter(function (v) { return v === 6 || v === 9; }).length;
  const rowsEls = (yaos || []).map(function (v, i) {
    const mv = (v === 6 || v === 9);
    const yang = (v === 7 || v === 9);
    const barCls = 'lc-bar ' + (mv ? (yang ? 'moving-yang' : 'moving-yin') : (yang ? 'yang' : 'yin'));
    const rCls = 'ly-cast-row' + (cur === i ? ' casting' : '') + (doneRows.indexOf(i) >= 0 ? ' reveal' : '') + (mv ? ' moving' : '');
    const nameTxt = v === 6 ? UI_COPY.divination['ly-old-yin'] : v === 7 ? UI_COPY.divination['ly-shao-yang'] : v === 8 ? UI_COPY.divination['ly-shao-yin'] : v === 9 ? UI_COPY.divination['ly-old-yang'] : '';
    const kids = [
      React.createElement('span', { key: 'p', className: 'lc-pos' }, YAO_LABEL[i] + UI_COPY.divination['ly-yao']),
      React.createElement('span', { key: 'b', className: barCls }),
      React.createElement('span', { key: 'n', className: 'lc-name' }, nameTxt)
    ];
    if (mv) kids.push(React.createElement('span', { key: 'm', className: 'lc-mv' }, '动'));
    return React.createElement('div', { key: i, className: rCls }, kids);
  });
  let banner = null;
  if (phase === 'final' || phase === 'done') {
    banner = React.createElement('div', { className: 'stage-banner' },
      guaText || '六爻成卦',
      React.createElement('small', null, mvCount ? '动爻 ' + mvCount + ' 处' : '六爻安静 · 本卦即用' + (guaText ? '' : '，卦名以结果为准')));
  }
  const waitLine = (phase === 'done' && !resultReady)
    ? React.createElement('div', { className: 'stage-wait' }, React.createElement('i', null), '卦象正在生成…')
    : null;
  const area = React.createElement('div', { className: 'ly-cast-area' },
    coinRow,
    React.createElement('div', { className: 'ly-rows' }, rowsEls),
    banner,
    waitLine);
  return ArtStageFrame({
    title: '六爻起卦',
    sub: '铜钱六掷 · 自初爻向上成卦',
    skip: onSkip,
    children: area
  });
}

/* ---------------- 梅花易数起卦演出（取数先行：光点汇聚 → 卦象按后端结果成形） ---------------- */
function MeihuaCastStage(props) {
  const { result, resultReady, failed, onFinish, onSkip } = props;
  const [step, setStep] = useState(0); // 0..3 三步汇聚；4=卦象成形；5=完成
  const [phase, setPhase] = useState('run');
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const timersRef = useRef([]);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  useEffect(function () {
    if (startedRef.current) return;
    startedRef.current = true;
    later(function () { setStep(1); }, 360);
    later(function () { setStep(2); }, 940);
    later(function () { setStep(3); }, 1520);
    later(function () { setPhase('gua'); setStep(4); }, 2260);
    later(function () { setPhase('done'); }, 3200);
  }, []);
  useEffect(function () {
    if (doneRef.current) return;
    if (failed) { doneRef.current = true; onFinish(); return; }
    if (phase === 'done' && resultReady) { doneRef.current = true; onFinish(); }
  }, [phase, resultReady, failed]);
  const res = (result && typeof result === 'object') ? result : {};
  const stepsCopy = ['上卦之数', '下卦之数', '动爻之位'];
  const nodePos = [{ left: '50%', top: '2%' }, { left: '6%', top: '30%' }, { left: '70%', top: '62%' }];
  const nodes = stepsCopy.map(function (t, i) {
    const active = step >= i + 1;
    return React.createElement('div', { key: i, className: 'mh-node' + (active ? ' on' : ''), style: nodePos[i] },
      React.createElement('span', { className: 'mh-dot' }),
      t);
  });
  const upName = res.up || '';
  const downName = res.down || '';
  const dongTxt = res.dong != null ? '第 ' + res.dong + ' 爻动' : '';
  const partsName = [];
  if (res.originalName) partsName.push(UI_COPY.divination['ly-ben-gua'] + res.originalName);
  if (res.interName) partsName.push(UI_COPY.divination['ly-hu-gua'] + res.interName);
  if (res.changedName && res.changedName !== res.originalName) partsName.push(UI_COPY.divination['ly-bian-gua'] + res.changedName);
  const slotsRow = React.createElement('div', { className: 'mh-slots-row' },
    React.createElement('div', { className: 'mh-slot' }, '上卦', React.createElement('b', { className: upName ? '' : 'blank' }, upName || '待成')),
    React.createElement('div', { className: 'mh-slot' }, '下卦', React.createElement('b', { className: downName ? '' : 'blank' }, downName || '待成')),
    dongTxt ? React.createElement('div', { className: 'mh-slot' }, '动爻', React.createElement('b', null, dongTxt)) : null);
  const arena = React.createElement('div', { className: 'mh-arena' },
    React.createElement('div', { className: 'mh-orb' + (phase === 'run' ? ' on' : '') }),
    React.createElement('div', { className: 'mh-orb2' + (phase === 'run' ? ' on' : '') }),
    nodes);
  let banner = null;
  if (phase === 'gua' || phase === 'done') {
    banner = React.createElement('div', { className: 'stage-banner' },
      partsName.length ? partsName.join(' · ') : '卦象成形',
      React.createElement('small', null, resultReady ? '体用已分 · 随解随观' : '卦象成形中 · 片刻即呈'));
  }
  const waitLine = (phase === 'done' && !resultReady)
    ? React.createElement('div', { className: 'stage-wait' }, React.createElement('i', null), '卦象正在生成…')
    : null;
  return ArtStageFrame({
    title: '梅花易数',
    sub: '以时起卦 · 体用生克察事应',
    skip: onSkip,
    children: [arena, slotsRow, waitLine, banner]
  });
}

/* ---------------- REQ-131：应用内「手动摇卦」面板 ----------------
   与 REQ-069「手动录入」严格区分：069=录已发生的真实结果（逐爻点选）；
   本条=应用内程序随机「摇」出结果（点「摇一次」逐步演出，摇满成卦）。
   六爻：3 枚铜钱每爻一掷，字面=2、背面=3，三币之和定爻（掷钱法八分法口径）：
     6=三字 老阴（动）｜7=两字一背 少阳｜8=一字两背 少阴｜9=三背 老阳（动）
     单币均匀 2/3 → 分布 6:1/8、7:3/8、8:3/8、9:1/8，与传统口径一致；
   梅花：随机起卦三步（上卦八卦之一 / 下卦八卦之一 / 动爻 1-6），铜钱翻动为演出、
     数值程序随机预取（1乾 2兑 3离 4震 5巽 6坎 7艮 8坤），与后端 settings.method='random'
     + replay 确定性重放契约一致（见 REQ-069 手动通道同一契约）。
   动画开关（REQ-066① tcShouldPlayAnim）关 → 点击直接落定结果，不播翻动动画。 */
const MH_TRIG_NAMES = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const SHAKE_TOSS_MS = 640;   // 铜钱翻动动画时长
const SHAKE_SETTLE_MS = 960; // 翻动 + 落定总时长
function LiuyaoShakePanel(props) {
  const { anim, onComplete } = props;
  const [yaos, setYaos] = useState([]);     // 已摇出的爻值 6/7/8/9（自初爻起）
  const [coins, setCoins] = useState(null); // 当前一掷三币（2=字 3=背）
  const [tossing, setTossing] = useState(false);
  const [settled, setSettled] = useState(false);
  const [done, setDone] = useState(false);
  const busyRef = useRef(false);
  const timersRef = useRef([]);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  const toss = function () {
    if (busyRef.current || done) return;
    busyRef.current = true;
    const cs = [0, 1, 2].map(function () { return Math.random() < 0.5 ? 2 : 3; });
    const v = cs[0] + cs[1] + cs[2];
    const n = yaos.length; // 本次落第 n 爻（0 起）
    setCoins(cs);
    setSettled(false);
    if (!anim) {
      setYaos(function (prev) { return prev.concat([v]); });
      setSettled(true);
      if (n + 1 >= 6) setDone(true);
      busyRef.current = false;
      return;
    }
    setTossing(true);
    later(function () { setTossing(false); setSettled(true); }, SHAKE_TOSS_MS);
    later(function () {
      setYaos(function (prev) { return prev.concat([v]); });
      setSettled(true);
      if (n + 1 >= 6) setDone(true);
      busyRef.current = false;
    }, SHAKE_SETTLE_MS);
  };
  const reset = function () {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    busyRef.current = false;
    setYaos([]); setCoins(null); setTossing(false); setSettled(false); setDone(false);
  };
  const finish = function () {
    if (!done || !yaos || yaos.length !== 6) return;
    onComplete({ yaos: yaos.slice() });
  };
  let coinRow = null;
  if (coins) {
    coinRow = React.createElement('div', { key: 'c' + yaos.length, className: 'sh-coins' },
      coins.map(function (p, ci) {
        const cls = 'coin' + (settled ? (p === 3 ? ' back' : ' front') : ' toss');
        return React.createElement('div', { key: ci, className: cls },
          React.createElement('div', { className: 'c3d' },
            React.createElement('div', { className: 'side s-a' }),
            React.createElement('div', { className: 'side s-b' })));
      }));
  } else {
    coinRow = React.createElement('div', { className: 'sh-coins' },
      React.createElement('span', { className: 'coin-empty' }, '凝神起卦 · 待掷铜钱'));
  }
  const rowsEls = yaos.map(function (v, i) {
    const mv = (v === 6 || v === 9);
    const yang = (v === 7 || v === 9);
    const barCls = 'sh-bar ' + (mv ? (yang ? 'moving-yang' : 'moving-yin') : (yang ? 'yang' : 'yin'));
    const nameTxt = v === 6 ? UI_COPY.divination['ly-old-yin'] : v === 7 ? UI_COPY.divination['ly-shao-yang'] : v === 8 ? UI_COPY.divination['ly-shao-yin'] : v === 9 ? UI_COPY.divination['ly-old-yang'] : '';
    const kids = [
      React.createElement('span', { key: 'p', className: 'sh-pos' }, YAO_LABEL[i] + UI_COPY.divination['ly-yao']),
      React.createElement('span', { key: 'b', className: barCls }),
      React.createElement('span', { key: 'n', className: 'sh-name' }, nameTxt)
    ];
    if (mv) kids.push(React.createElement('span', { key: 'm', className: 'sh-mv' }, '动'));
    return React.createElement('div', { key: i, className: 'sh-row reveal' + (mv ? ' moving' : '') }, kids);
  });
  const nextLabel = done ? '' : '摇一次 · ' + YAO_LABEL[yaos.length] + UI_COPY.divination['ly-yao'];
  const actBtn = done
    ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: finish }, '成卦并查看结果')
    : React.createElement('button', { type: 'button', className: 'btn btn-primary', disabled: tossing, onClick: toss }, tossing ? '铜钱翻动中…' : nextLabel);
  const resetLink = (!done && yaos.length > 0)
    ? React.createElement('button', { type: 'button', className: 'sh-reset', onClick: reset }, '清空重摇')
    : null;
  return React.createElement('div', { className: 'sh-panel' },
    React.createElement('div', { className: 'sh-cap' },
      done ? '六爻摇满 · 自初爻向上已成卦（' + yaos.map(function (v) { return v; }).join(' / ') + '）' : '三枚铜钱 · 每爻一掷（自初爻起），共摇 6 次成卦：'),
    coinRow,
    rowsEls.length ? React.createElement('div', { className: 'sh-rows' }, rowsEls) : null,
    React.createElement('div', { className: 'sh-actions' }, actBtn, resetLink),
    React.createElement('div', { className: 'sh-note' }, LIUYAO_DISCLAIMER));
}
function MeihuaShakePanel(props) {
  const { anim, onComplete } = props;
  const stepNames = ['上卦', '下卦', '动爻'];
  const [step, setStep] = useState(0); // 0..2 下一步；3=完成
  const [vals, setVals] = useState([]); // [上卦1-8, 下卦1-8, 动爻1-6]
  const [coins, setCoins] = useState(null);
  const [tossing, setTossing] = useState(false);
  const [settled, setSettled] = useState(false);
  const [done, setDone] = useState(false);
  const busyRef = useRef(false);
  const timersRef = useRef([]);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  const toss = function () {
    if (busyRef.current || done) return;
    busyRef.current = true;
    const max = step === 2 ? 6 : 8;
    const v = 1 + Math.floor(Math.random() * max);
    const cs = [0, 1, 2].map(function () { return Math.random() < 0.5 ? 2 : 3; });
    const n = step;
    setCoins(cs);
    setSettled(false);
    if (!anim) {
      setVals(function (prev) { return prev.concat([v]); });
      setSettled(true);
      if (n + 1 >= 3) setDone(true);
      busyRef.current = false;
      return;
    }
    setTossing(true);
    later(function () { setTossing(false); setSettled(true); }, SHAKE_TOSS_MS);
    later(function () {
      setVals(function (prev) { return prev.concat([v]); });
      setSettled(true);
      if (n + 1 >= 3) setDone(true);
      busyRef.current = false;
    }, SHAKE_SETTLE_MS);
  };
  const reset = function () {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    busyRef.current = false;
    setStep(0); setVals([]); setCoins(null); setTossing(false); setSettled(false); setDone(false);
  };
  const finish = function () {
    if (!done || !vals || vals.length !== 3) return;
    onComplete({ upper: vals[0], lower: vals[1], mvPos: vals[2] });
  };
  let coinRow = null;
  if (coins) {
    coinRow = React.createElement('div', { key: 'c' + step, className: 'sh-coins' },
      coins.map(function (p, ci) {
        const cls = 'coin' + (settled ? (p === 3 ? ' back' : ' front') : ' toss');
        return React.createElement('div', { key: ci, className: cls },
          React.createElement('div', { className: 'c3d' },
            React.createElement('div', { className: 'side s-a' }),
            React.createElement('div', { className: 'side s-b' })));
      }));
  } else {
    coinRow = React.createElement('div', { className: 'sh-coins' },
      React.createElement('span', { className: 'coin-empty' }, '凝神起卦 · 待掷铜钱'));
  }
  const trigName = function (idx) { return MH_TRIG_NAMES[idx] || ''; };
  const chipEls = stepNames.map(function (nm, i) {
    const has = i < vals.length;
    const txt = i === 2 ? (has ? ('第 ' + vals[i] + ' 爻') : '') : (has ? trigName(vals[i]) : '');
    return React.createElement('div', { key: i, className: 'sh-trig' }, nm,
      React.createElement('b', { className: has ? '' : 'blank' }, has ? txt : '待摇'));
  });
  const nextLabel = done ? '' : '摇一次 · ' + stepNames[Math.min(step, 2)];
  const actBtn = done
    ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: finish }, '成卦并查看结果')
    : React.createElement('button', { type: 'button', className: 'btn btn-primary', disabled: tossing, onClick: toss }, tossing ? '铜钱翻动中…' : nextLabel);
  const resetLink = (!done && vals.length > 0)
    ? React.createElement('button', { type: 'button', className: 'sh-reset', onClick: reset }, '清空重摇')
    : null;
  return React.createElement('div', { className: 'sh-panel' },
    React.createElement('div', { className: 'sh-cap' },
      done ? '三步摇齐 · 随机梅花起卦已成' : '随机起卦 · 共三步：先摇上卦、再摇下卦、最后摇动爻（程序随机生成 · 娱乐参考）：'),
    coinRow,
    React.createElement('div', { style: { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 } }, chipEls),
    React.createElement('div', { className: 'sh-actions' }, actBtn, resetLink),
    React.createElement('div', { className: 'sh-note' }, LIUYAO_DISCLAIMER));
}

/* ---------------- 小六壬起卦演出：掌诀盘走宫（结果先取 → 路径按后端 calculation 逐宫游走，落宫与课式一致） ---------------- */
const xlrRingPos = function (idx) {
  const cx = 150, cy = 150, R = 100;
  const ang = (idx * 60 - 90) * Math.PI / 180;
  return { left: Math.round(cx + R * Math.cos(ang)), top: Math.round(cy + R * Math.sin(ang)) };
};
const xlrInfoOf = function (result) {
  const o = (result && typeof result === 'object') ? result : {};
  const calc = (o.calculation && typeof o.calculation === 'object') ? o.calculation : {};
  const M = Number(calc.lunarMonth) || Number(o.lunarMonth) || 1;
  const D = Number(calc.lunarDay) || Number(o.lunarDay) || 1;
  const H = Number(calc.hourNumber) || ((o.hourIndex != null && o.hourIndex >= 0) ? ((o.hourIndex % 12) + 1) : 1);
  return { M: Math.max(1, M), D: Math.max(1, D), H: Math.max(1, H) };
};
function XlrCastStage(props) {
  const { result, resultReady, failed, onFinish, onSkip } = props;
  const [phase, setPhase] = useState('idle'); // idle|walk|done
  const [curIdx, setCurIdx] = useState(-1);
  const [cap, setCap] = useState('');        // 走宫说明
  const [finalName, setFinalName] = useState('');
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const timersRef = useRef([]);
  const later = function (fn, ms) { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(function () {
    return function () { timersRef.current.forEach(clearTimeout); };
  }, []);
  // 取数先行：结果就绪后才开始走宫（每段宫数与后端 lunarMonth/lunarDay/hourNumber 完全一致）
  useEffect(function () {
    if (startedRef.current || !resultReady || !result) return;
    startedRef.current = true;
    const info = xlrInfoOf(result);
    const M = info.M, D = info.D, H = info.H;
    const mHops = M - 1, dHops = D - 1, hHops = H - 1;
    const list = [0];
    let cur = 0;
    const walk = function (n) {
      for (let k = 0; k < n; k++) { cur = (cur + 1) % 6; list.push(cur); }
    };
    walk(mHops);
    const end1 = list.length - 1;
    walk(dHops);
    const end2 = list.length - 1;
    walk(hHops);
    const end3 = list.length - 1;
    const hops = Math.max(1, list.length - 1);
    const hopMs = Math.max(52, Math.min(150, Math.floor(2300 / hops)));
    const pauseMs = 300;
    const perSegTxt = function (n) { return n + ' 宫'; };
    const nameOf = function (i) { return xlrNameAt(i); };
    setCap('月 顺数 ' + perSegTxt(mHops));
    setPhase('walk');
    let t = 160;
    for (let k = 1; k < list.length; k++) {
      (function (kk) {
        later(function () {
          setCurIdx(list[kk]);
          if (kk === end1) setCap('月落「' + nameOf(list[kk]) + '」· 日 续数 ' + perSegTxt(dHops));
          else if (kk === end2) setCap('日落「' + nameOf(list[kk]) + '」· 时 再数 ' + perSegTxt(hHops));
          else if (kk === end3) setCap('时落「' + nameOf(list[kk]) + '」· 定格');
        }, t);
      })(k);
      t += hopMs;
      if (k === end1 || k === end2) t += pauseMs;
    }
    later(function () {
      setCurIdx(list[end3]);
      setFinalName(nameOf(list[end3]));
      setCap('');
      setPhase('done');
    }, t + 260);
    later(function () { onFinish(); }, t + 1050);
  }, [resultReady]);
  useEffect(function () {
    if (doneRef.current) return;
    if (failed && !doneRef.current) { doneRef.current = true; onFinish(); }
  }, [failed, phase]);
  const nodes = XLR_PALACE_ORDER.map(function (nm, i) {
    const pos = xlrRingPos(i);
    const active = curIdx === i;
    return React.createElement('div', {
      key: nm,
      className: 'xlr-node' + (active ? (phase === 'done' ? ' hit' : ' on') : ''),
      style: { left: pos.left + 'px', top: pos.top + 'px' }
    },
      React.createElement('span', { className: 'xn-badge' }, nm),
      React.createElement('span', { className: 'xn-sub' }, (nm === '大安' ? '安稳' : nm === '留连' ? '拖延' : nm === '速喜' ? '喜信' : nm === '赤口' ? '口舌' : nm === '小吉' ? '渐成' : '落空')));
  });
  let verdict = null;
  if (phase === 'done' && finalName) {
    const kw = C4_XIAOLIUREN_SHENS[finalName] || '';
    verdict = React.createElement('div', { className: 'xlr-verdict' },
      '落宫定格 · ' + finalName,
      kw ? React.createElement('small', null, kw.slice(0, 22) + '…') : null);
  }
  const capLine = cap ? React.createElement('div', { className: 'stage-hint', style: { marginTop: 2 } }, cap) : null;
  const waitLine = (phase === 'idle')
    ? React.createElement('div', { className: 'stage-wait' }, React.createElement('i', null), '按所选日期时辰推演课式…')
    : null;
  const arena = React.createElement('div', { className: 'xlr-cast-wrap' },
    React.createElement('div', { className: 'xlr-ring' }),
    React.createElement('div', { className: 'xlr-center' }, '掌诀'),
    nodes);
  return ArtStageFrame({
    title: '小六壬',
    sub: '月日时三程走宫 · 掐指速断',
    skip: onSkip,
    children: [arena, capLine, waitLine, verdict]
  });
}

/* ---------------- 塔罗/雷诺曼：出牌动画（牌堆 → 依次飞向牌位；落位即牌背朝上，进入翻牌阶段） ---------------- */
function DealFly(props) {
  const { cols, onDone } = props;
  const boxRef = useRef(null);
  const [fly, setFly] = useState(false);
  useEffect(function () {
    if (fly) return;
    const box = boxRef.current;
    if (!box) return;
    const list = box.querySelectorAll('.fan-col.deal');
    const br = box.getBoundingClientRect();
    const pileX = br.left + br.width / 2;
    const pileY = br.top + 26;
    list.forEach(function (col, i) {
      const r = col.getBoundingClientRect(); // 此刻无 transform（仅 opacity:0），测得即最终牌位
      const dx = pileX - (r.left + r.width / 2);
      const dy = pileY - (r.top + r.height / 2);
      const deg = (i % 2 === 0 ? 1 : -1) * (4 + (i % 3) * 2);
      col.style.setProperty('--dx', dx.toFixed(1) + 'px');
      col.style.setProperty('--dy', dy.toFixed(1) + 'px');
      col.style.setProperty('--fr', deg + 'deg');
      col.style.setProperty('--fdi', String(i));
      col.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.82) rotate(' + deg + 'deg)';
      col.style.opacity = '1';
    });
    const t = setTimeout(function () { setFly(true); }, 90);
    return function () { clearTimeout(t); };
  }, [fly]);
  // 起飞：交还 CSS 过渡（inline transform/opacity 清空，.fly 的 transition 生效）
  useEffect(function () {
    if (!fly) return;
    const raf = requestAnimationFrame(function () {
      const box = boxRef.current;
      if (!box) return;
      box.querySelectorAll('.fan-col.deal').forEach(function (col) {
        col.style.transform = '';
        col.style.opacity = '';
      });
    });
    return function () { cancelAnimationFrame(raf); };
  }, [fly]);
  useEffect(function () {
    if (!fly) return;
    const n = (cols && cols.length) || 1;
    const t = setTimeout(onDone, 480 + n * 95 + 200);
    return function () { clearTimeout(t); };
  }, [fly]);
  const fanKids = (cols || []).map(function (col, i) {
    const cls = String(col.props.className || '').replace(/\s*(deal|fly)/g, '');
    return React.cloneElement(col, { key: i, className: cls + ' deal' + (fly ? ' fly' : '') });
  });
  return React.createElement('div', { className: 'deal-stage' },
    React.createElement('div', { className: 'deal-pile' + (fly ? ' gone' : '') },
      React.createElement('i', { key: 0 }),
      React.createElement('i', { key: 1 }),
      React.createElement('i', { key: 2 })),
    React.createElement('div', { className: 'card-fan', ref: boxRef }, fanKids));
}
function FanZone(props) {
  return React.createElement('div', { className: 'fan-zone' + (props.bulk ? ' bulk' : '') }, props.children);
}
function ArtStageSkipNote() {
  return null;
}
function DivinationPage({
  onNavigate
}) {
  // REQ-086：付费角标余额充足态（共享单飞查询，驱动「¥ 消耗」角标警示色）
  const payEnough = usePaySufficient();
  const [method, setMethod] = useState('liuyao');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState('');
  const [interp, setInterp] = useState('');
  const [interpLoading, setInterpLoading] = useState(false);
  const [interpErr, setInterpErr] = useState('');
  // REQ-075：六爻焦点详解 —— focus key → {txt, loading, err, open}（本盘结果缓存，同 focus 再点直接展示不再请求）
  const [focusMap, setFocusMap] = useState({});
  const [question, setQuestion] = useState('');
  // REQ-105：占问问题输入框默认折叠（进入起卦操作界面不弹输入法/输入框；点击拟输入框展开填写，留空可直接起卦）
  const [qOpen, setQOpen] = useState(false);
  // REQ-055 ⑤：梅花/小六壬时间选项（日期默认今天 + 时辰默认当前，必填）
  const [timeDate, setTimeDate] = useState(todayStr());
  const [shichen, setShichen] = useState(nowShichen());
  // REQ-044 v2：方案弹窗开关（点选方法 → 弹窗内填占问问题/时间 → 开始起卦）
  const [asking, setAsking] = useState(false);
  // REQ-069：手动录入实际结果 —— 模式开关 / 逐爻点选（六爻·梅花共用）/ 签号选择 / 小六壬两模式
  const [askMode, setAskMode] = useState('auto'); // 'auto' | 'manual'
  const [yaoPick, setYaoPick] = useState(function () { return blankYaoRows(); });
  const [signNo, setSignNo] = useState(null);
  const [xlrWay, setXlrWay] = useState('nums'); // 'nums' | 'palace'
  const [xlrM, setXlrM] = useState('');
  const [xlrD, setXlrD] = useState('');
  const [xlrPalace, setXlrPalace] = useState(-1);
  const [manLabel, setManLabel] = useState(''); // 本次录入方式（展示在结果上方）
  const [manWarn, setManWarn] = useState('');
  const [lastManual, setLastManual] = useState(null); // 手动发起失败后的重试凭据 {seed, meta}
  // REQ-061：占卜动效演出阶段机（null=无演出；'ssgw'=签筒 / 'liuyao'=逐爻掷币 / 'meihua'=梅花环聚 / 'xiaoliuren'=掌诀走宫）
  const [animStage, setAnimStage] = useState(null);
  const [castYaos, setCastYaos] = useState(null); // 六爻动画用逐爻值（前端掷币预演 → options.yaos replay 固定）
  // REQ-118：大六壬断课模板（general/ganqing/shiye/caifu，随 interpret 请求体透传）
  const [liurenTpl, setLiurenTpl] = useState('general');
  // REQ-119：金口诀起课方式四选一（time 时间 / branch 指定地分 / number 数字 / random 随机）
  const [jkMethod, setJkMethod] = useState('time');
  const [jkBranch, setJkBranch] = useState('子');
  const [jkNumber, setJkNumber] = useState('');
  // REQ-120：奇门时家起局参数（起局级别四选一 / 转盘飞盘 / 拆补置闰，默认 时家+转盘+拆补）
  const [qmScope, setQmScope] = useState('hour');
  const [qmMethod, setQmMethod] = useState('zhuanpan');
  const [qmJuMethod, setQmJuMethod] = useState('chaibu');
  const apiMethod = DIVIN_API_METHOD[method] || method;
  const qText = (question || '').trim();
  // REQ-044 v2.1：占问问题可选 —— 有填才随 seed 透传（留空直接起卦，不传空 question）
  const mkSeed = function (extra) {
    const s = Object.assign({}, extra || {});
    if (qText) s.question = qText;
    return s;
  };
  const isTimeMethod = Boolean(TIME_METHODS[method]);
  // 手动模式可用的方法：六爻/梅花（逐爻共用录入器）、观音灵签（签号）、小六壬（三数/掌诀）
  const manualable = method === 'liuyao' || method === 'meihua' || method === 'sign' || method === 'xiaoliuren';
  const timeSeedFor = function () {
    const startH = (SHICHEN_ARR[shichen] || SHICHEN_ARR[0]).start;
    return timeDate + 'T' + pad2(startH) + ':00:00+08:00';
  };
  // 校验时间字段（timeDate/shichen 必填）—— 自动/手动共用
  const timeValid = function () {
    if (typeof timeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(timeDate)) {
      toast('请先选择起卦日期（必填）');
      return false;
    }
    if (!(typeof shichen === 'number' && shichen >= 0 && shichen < SHICHEN_ARR.length)) {
      toast('请选择起卦时辰（必填）');
      return false;
    }
    return true;
  };
  // 打开发起的统一执行：seed 原样透传后端；manual 携带录入元数据（用于展示修正/一致性提示）
  const doCast = async (seed, manual) => {
    setLoading(true);
    setErrored('');
    setData(null);
    setInterp('');
    setInterpErr('');
    setFocusMap({});
    setManWarn('');
    setLiurenTpl('general'); // REQ-118：新起课重置断课模板为通用
    const meta = manual || null;
    if (meta) setManLabel(meta.label);
    try {
      const res = await api('/divinations', {
        method: 'POST',
        body: JSON.stringify({ method: apiMethod, case_id: null, seed: seed })
      });
      const d = (res && res.data) || res;
      // 手动录入结果仅作展示语义修正（后端已按所录内容确定性成卦/选签）
      if (meta && d && d.result && typeof d.result === 'object') {
        const r = d.result;
        if (meta.method === 'meihua') {
          const calc = (r.calculation && typeof r.calculation === 'object') ? r.calculation : {};
          calc.method = '手动录入（逐爻点选成卦）';
          calc.methodKey = 'manual';
          r.calculation = calc;
        } else if (meta.method === 'sign') {
          const dr = (r.draw && typeof r.draw === 'object') ? r.draw : {};
          dr.method = '手动录入';
          r.draw = dr;
        } else if (meta.method === 'xiaoliuren' && meta.expected) {
          const pn = (r.primary && r.primary.name) || '';
          if (pn && pn !== meta.expected) {
            setManWarn('你录入的落宫为「' + meta.expected + '」，与上方所选日期/时辰自动顺数的「' + pn + '」不一致——' +
              '深度解读将以实际时刻所落课式为准；若确认课式无误，请把日期/时辰调到真实掐指时刻。');
          }
        }
      }
      setData(d);
    } catch (e) {
      setErrored((e && e.message) || '起卦失败，请重试。');
    } finally {
      setLoading(false);
    }
  };
  // REQ-119：金口诀起课参数校验（指定地分须为十二地支之一；数字起课须为正整数）
  const jkValid = function () {
    if (jkMethod === 'branch' && !SHICHEN_ARR.some(function (s) { return s.n === jkBranch; })) {
      toast('请选择地分（十二地支之一）');
      return false;
    }
    if (jkMethod === 'number') {
      const n = Number(jkNumber);
      if (!Number.isInteger(n) || n < 1) {
        toast('请输入不小于 1 的整数作为起课数字');
        return false;
      }
    }
    return true;
  };
  // REQ-044 v2/v2.1 自动起卦（沿用既有链路：确定性随机/时间起卦，免费；占问问题可选，留空直接起卦）
  const run = async () => {
    if (loading) return;
    // 梅花/小六壬/大六壬/金口诀：日期与时辰必填（输入框默认已带值，用户清空日期时拦截）
    if (isTimeMethod && !timeValid()) return;
    if (method === 'jinkoujue' && !jkValid()) return;
    // 时间类方法把所选 日期+时辰 组装为东八区 ISO 传给 Node 起卦服务
    // （meihua 读顶层 customDate；xiaoliuren/jinkoujue 走 params.customDate；seed 键原样透传）
    const seed = {};
    if (qText) seed.question = qText;
    if (isTimeMethod) {
      const customDate = timeSeedFor();
      if (method === 'xiaoliuren') {
        seed.params = { customDate: customDate };
      } else if (method === 'jinkoujue') {
        // REQ-119：金口诀起课方式四选一 → params 原样透传引擎（time/branch/number/random）
        const p = { method: jkMethod, customDate: customDate };
        if (jkMethod === 'branch') p.branch = jkBranch;
        else if (jkMethod === 'number') p.number = Number(jkNumber);
        seed.params = p;
      } else {
        seed.customDate = customDate;
      }
    }
    // REQ-120：奇门时家起局参数（起局级别/转盘飞盘/拆补置闰）随 seed 透传引擎
    if (method === 'qimen') {
      seed.scope = qmScope;
      seed.qimenMethod = qmMethod;
      seed.qimenJuMethod = qmJuMethod;
    }
    await doCast(seed, null);
  };
  const interpret = async () => {
    if (!data || !data.id || interpLoading) return;
    setInterpLoading(true);
    setInterpErr('');
    try {
      // REQ-118：大六壬随请求体带断课模板（其余方法沿用空 body，后端向后兼容）
      const bodyStr = method === 'liuren' ? JSON.stringify({ liurenTemplate: liurenTpl }) : '{}';
      const res = await api('/divinations' + '/' + data.id + '/interpret', { method: 'POST', body: bodyStr });
      setInterp((res && res.data && res.data.interpretation) || '（暂无断卦内容）');
    } catch (e) {
      setInterpErr((e && e.message) || '深度断卦失败，请重试。');
    } finally {
      setInterpLoading(false);
    }
  };
  // REQ-075：六爻焦点详解 —— 点击某焦点项 → POST /divinations/{div_id}/focus（同 interpret 的 div_id/扣费机制）；
  // 5002 余额不足已由 api() 统一弹既有充值引导（creditInsuffHandler），此处仅展示错误文案；成功写前端缓存，同 focus 再点直接展开不再请求。
  const focusDetail = async (key) => {
    if (!data || !data.id) return;
    const cur = focusMap[key] || {};
    if (cur.txt || cur.loading) return; // 已缓存或加载中：不重复请求
    setFocusMap(prev => Object.assign({}, prev, { [key]: Object.assign({}, prev[key], { loading: true, err: '' }) }));
    try {
      const r = await api('/divinations' + '/' + data.id + '/focus', { method: 'POST', body: JSON.stringify({ focus: key }) });
      const txt = (r && r.data && r.data.interpretation) || LIUYAO_FOCUS_CN.empty;
      setFocusMap(prev => Object.assign({}, prev, { [key]: { txt: txt, loading: false, err: '', open: true } }));
    } catch (e) {
      setFocusMap(prev => Object.assign({}, prev, { [key]: Object.assign({}, prev[key] || {}, { loading: false, err: (e && e.message) || LIUYAO_FOCUS_CN.err }) }));
    }
  };
  const toggleFocus = (key) => {
    setFocusMap(prev => {
      const cur = prev[key] || {};
      return Object.assign({}, prev, { [key]: Object.assign({}, cur, { open: !cur.open }) });
    });
  };
  // REQ-044 v2：点选列表方法 → 打开起卦弹窗（todo 置灰提示；切换方法沿用 v1 行为：清旧结果、时间类重置为默认今天 + 当前时辰）
  // REQ-069：每次打开弹窗重置手动录入内容
  // REQ-066②：默认模式按功能设置 default_mode —— manual=默认手动录入入口 / auto=自动起卦（现状）/ both=并行不预设（保留上次所选）
  const resetManualState = function () {
    setQOpen(false); // REQ-105：每次进入起卦界面，占问问题输入默认折叠
    setAskMode(tcAskNextDefault(askMode));
    setYaoPick(blankYaoRows());
    setSignNo(null);
    setXlrWay('nums');
    setXlrM('');
    setXlrD('');
    setXlrPalace(-1);
    setManLabel('');
    setManWarn('');
    setLastManual(null);
    // REQ-119：每次进入金口诀起课界面重置起课方式（默认时间起课）
    setJkMethod('time');
    setJkBranch('子');
    setJkNumber('');
    // REQ-120：每次进入奇门时家起局界面重置起局参数（默认 时家+转盘+拆补）
    setQmScope('hour');
    setQmMethod('zhuanpan');
    setQmJuMethod('chaibu');
  };
  const openAsk = x => {
    if (x.todo) {
      toast('「' + x.name + '」敬请期待');
      return;
    }
    if (loading) return;
    if (x.id !== method) {
      setMethod(x.id);
      setData(null);
      setErrored('');
      setInterp('');
      setInterpErr('');
      setFocusMap({});
      if (TIME_METHODS[x.id]) {
        setTimeDate(todayStr());
        setShichen(nowShichen());
      }
    }
    resetManualState();
    setAsking(true);
    // 进入起卦详情页：滚动到顶部，模拟独立页面跳转体验
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeAsk = () => setAsking(false);
  // REQ-044 v2.1：弹窗「开始起卦」—— 占问问题可选（留空直接起卦，填写则随 seed 带入断卦上下文），
  //               点选即关弹窗 → run()（梅花/小六壬时间必填由 run() 内部校验）
  // REQ-061：REQ-066① 开时自动模式进入动效演出层（签筒 / 逐爻掷币 / 梅花环聚 / 掌诀走宫），
  //          演出结束 & 数据就绪后转既有 v2 结果布局；① 关或手动路径不重演、直接出结果。
  const startAsk = () => {
    setLastManual(null);
    setAsking(false);
    // REQ-118/119/120：大六壬、金口诀、奇门时家起课直接取数成课（无动效演出，与梅花/小六壬共用时间取数链路）
    if (method === 'liuren' || method === 'jinkoujue' || method === 'qimen') { run(); return; }
    if (!tcShouldPlayAnim()) { run(); return; }
    if (method === 'sign') {
      // 清掉上一次结果，避免签筒等待期残留旧签文
      setData(null);
      setErrored('');
      setInterp('');
      setInterpErr('');
      setFocusMap({});
      setManLabel('');
      // 前端先定签号（S0，1..92）→ 进入签筒舞台；用户摇签/点击瞬间才 doCast（options.replay 固定该签）
      const n = 1 + Math.floor(Math.random() * SSGW_POOL_SIZE);
      setSignNo(n);
      setAnimStage('ssgw');
      return;
    }
    if (method === 'liuyao') {
      // 前端逐爻模拟掷 3 币定 6/7/8/9 → options.yaos（与 REQ-069 手动通道同一契约）→ 后端确定性还原
      const ys = [];
      for (let i = 0; i < 6; i++) {
        const cs = [];
        for (let k = 0; k < 3; k++) cs.push(Math.random() < 0.5 ? 2 : 3);
        ys.push(cs[0] + cs[1] + cs[2]);
      }
      setCastYaos(ys);
      setAnimStage('liuyao');
      doCast(mkSeed({ options: { yaos: ys } }), null);
      return;
    }
    // 梅花 / 小六壬：取数先行（run 组装 customDate 并 doCast），动画按后端结果做氛围演出，不本地复制引擎
    setAnimStage(method === 'meihua' ? 'meihua' : 'xiaoliuren');
    run();
  };
  // REQ-069：手动「记录并…」总入口 —— 按方法分发：六爻/梅花逐爻成卦、灵签按签号、小六壬三数/掌诀
  // REQ-044 v2.1：占问问题可选 —— 留空（qText 为空）同样允许录入起卦
  const startManual = () => {
    const q = qText;
    if (method === 'liuyao' || method === 'meihua') {
      if (!yaoPick || yaoPick.length !== 6 || yaoPick.some(function (r) { return r.yang == null; })) {
        toast('请把 6 爻逐爻点选完整（每爻选阳或阴）');
        return;
      }
      const movingCount = yaoPick.filter(function (r) { return r.mv; }).length;
      if (method === 'meihua' && movingCount !== 1) {
        toast('梅花易数以单爻为动爻成变卦：请仅标注 1 个动爻');
        return;
      }
      if (isTimeMethod && !timeValid()) return;
      const seed = q ? { question: q } : {};
      if (method === 'liuyao') {
        seed.options = { yaos: yaoPick.map(function (r) { return YAO_VAL_OF(r.yang, r.mv); }) };
      } else {
        const upper = mhTrigramIdx(yaoPick.slice(3, 6));
        const lower = mhTrigramIdx(yaoPick.slice(0, 3));
        if (!upper || !lower) {
          toast('所录六爻无法组成卦象，请重新点选');
          return;
        }
        const mvIdx = yaoPick.findIndex(function (r) { return r.mv; }); // 0..5
        // 后端 generateMeihua 的 settings.method='random' 支持 replay 样本确定性重放；
        // 三个样本分别固定 上卦/下卦/动爻 → 引擎按所录六爻原样成卦（卦象=逐爻录入值，非随机生成）
        seed.settings = {
          method: 'random',
          replay: [(upper - 0.5) / 8, (lower - 0.5) / 8, ((mvIdx + 1) - 0.5) / 6]
        };
        seed.customDate = timeSeedFor();
      }
      const meta = { method: method === 'liuyao' ? 'liuyao' : 'meihua', label: method === 'liuyao' ? '六爻逐爻点选（手动录入）' : '梅花逐爻点选（手动录入）' };
      setLastManual({ seed: seed, meta: meta });
      setAsking(false);
      track('manual_input', { method: method });
      doCast(seed, meta);
    } else if (method === 'sign') {
      if (!(signNo >= 1 && signNo <= SSGW_POOL_SIZE)) {
        toast('请选择你实际摇中的签号（1-' + SSGW_POOL_SIZE + '）');
        return;
      }
      setAsking(false);
      // drawRandomSign 的 replay 样本把随机签固定在所选签号上（签文=该签，随机仅作落库通道）
      const meta = { method: 'sign', label: '签号 ' + signNo + '（手动录入）' };
      const seed = { options: { replay: [signReplaySample(signNo)] } };
      if (q) seed.question = q;
      setLastManual({ seed: seed, meta: meta });
      track('manual_input', { method: method });
      doCast(seed, meta);
    } else if (method === 'xiaoliuren') {
      if (!timeValid()) return;
      let expected = '';
      if (xlrWay === 'nums') {
        const M = Number(xlrM);
        const D = Number(xlrD);
        if (!Number.isInteger(M) || M < 1 || M > 12) {
          toast('请输入月数（1-12）');
          return;
        }
        if (!Number.isInteger(D) || D < 1 || D > 30) {
          toast('请输入日数（1-30）');
          return;
        }
        expected = xlrPalaceName(M, D, shichen + 1);
      } else {
        if (!(xlrPalace >= 0 && xlrPalace < XLR_PALACE_ORDER.length)) {
          toast('请点选实际得到的掌诀（结果宫）');
          return;
        }
        expected = XLR_PALACE_ORDER[xlrPalace];
      }
      const seed = q ? { question: q, params: { customDate: timeSeedFor() } } : { params: { customDate: timeSeedFor() } };
      const meta = {
        method: 'xiaoliuren',
        expected: expected,
        label: xlrWay === 'nums' ? '三数 ' + xlrM + '/' + xlrD + '/' + (shichen + 1) + '（手动录入，落' + expected + '）'
          : '掌诀点选：' + expected + '（手动录入）'
      };
      setLastManual({ seed: seed, meta: meta });
      setAsking(false);
      track('manual_input', { method: method });
      doCast(seed, meta);
    }
  };
  // REQ-061：失败重试 —— 签筒/六爻动画路径仍固定本次结果（replay/yaos），其余沿用既有 run/手动凭据
  const retryAsk = function () {
    if (lastManual) { doCast(lastManual.seed, lastManual.meta); return; }
    if (method === 'sign' && signNo >= 1 && signNo <= SSGW_POOL_SIZE) {
      doCast(mkSeed({ options: { replay: [signReplaySample(signNo)] } }), null);
      return;
    }
    if (method === 'liuyao' && Array.isArray(castYaos) && castYaos.length === 6 && !loading) {
      doCast(mkSeed({ options: { yaos: castYaos } }), null);
      return;
    }
    run();
  };
  const m = DIVIN_METHODS.find(x => x.id === method);
  const result = (data && data.result) || null;
  let view = null;
  if (result && typeof result === 'object') {
    if (method === 'liuyao') view = DivLiuyaoView(result);
    else if (method === 'meihua') view = DivMeihuaView(result);
    else if (method === 'xiaoliuren') view = DivXiaoliurenView(result);
    else if (method === 'liuren') view = DivLiurenView(result);
    else if (method === 'jinkoujue') view = DivJinkoujueView(result);
    else if (method === 'qimen') view = DivQimenView(result);
    else if (method === 'sign' || apiMethod === 'ssgw') view = DivSsgwView(result);
  }
  if (result != null && view == null) {
    view = React.createElement('pre', { style: { fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-2)' } }, JSON.stringify(result, null, 2));
  }
  // REQ-055 ②④：卦象结果下方的免费静态解读（付费「深度断卦」按钮之前）
  let freeReading = null;
  if (result && typeof result === 'object') {
    if (method === 'liuyao') freeReading = LiuyaoFreeReading(result);
    else if (method === 'meihua') freeReading = MeihuaFreeReading(result);
    else if (method === 'xiaoliuren') freeReading = XiaoliurenFreeReading(result);
    else if (method === 'liuren') freeReading = LiurenFreeReading(result);
    else if (method === 'jinkoujue') freeReading = JinkoujueFreeReading(result);
    else if (method === 'qimen') freeReading = QimenFreeReading(result);
  }
  // REQ-061：演出层挂载（动效期间数据取数先行/并行，渲染替 loading 骨架；结束或失败即卸载交还结果分支）
  const resResult = (data && data.result) || null;
  const resultReady = !!data;
  const castFailed = !!errored;
  let stageBody = null;
  if (animStage === 'ssgw') {
    stageBody = React.createElement(SsgwTubeStage, {
      fixedNo: (signNo >= 1 && signNo <= SSGW_POOL_SIZE) ? signNo : 1,
      resultReady: resultReady,
      failed: castFailed,
      onDraw: function (n) { doCast(mkSeed({ options: { replay: [signReplaySample(n)] } }), null); },
      onFinish: function () { setAnimStage(null); },
      onSkip: function () {
        if (loading || data) { setAnimStage(null); return; }
        doCast(mkSeed({ options: { replay: [signReplaySample(signNo >= 1 && signNo <= SSGW_POOL_SIZE ? signNo : 1)] } }), null);
        setAnimStage(null);
      },
      onExit: function () { setAnimStage(null); openAsk(m); }
    });
  } else if (animStage === 'liuyao') {
    const guaR = resResult;
    const guaTxt = (guaR && guaR.originalName)
      ? (guaR.originalName + ((guaR.changedName && guaR.changedName !== guaR.originalName) ? ' 之 ' + guaR.changedName : ''))
      : '';
    stageBody = React.createElement(LiuyaoCastStage, {
      yaos: castYaos || [],
      resultReady: resultReady,
      guaText: guaTxt,
      failed: castFailed,
      onFinish: function () { setAnimStage(null); },
      onSkip: function () { setAnimStage(null); }
    });
  } else if (animStage === 'meihua') {
    stageBody = React.createElement(MeihuaCastStage, {
      result: resResult,
      resultReady: resultReady,
      failed: castFailed,
      onFinish: function () { setAnimStage(null); },
      onSkip: function () { setAnimStage(null); }
    });
  } else if (animStage === 'xiaoliuren') {
    stageBody = React.createElement(XlrCastStage, {
      result: resResult,
      resultReady: resultReady,
      failed: castFailed,
      onFinish: function () { setAnimStage(null); },
      onSkip: function () { setAnimStage(null); }
    });
  }
  let body = null;
  if (animStage) {
    body = stageBody;
  } else if (loading) {
    body = React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'skeleton sk-line' }),
      React.createElement('div', { className: 'skeleton sk-line', style: { width: '60%' } }));
  } else if (errored) {
    body = React.createElement('div', { className: 'card failed-box' },
      React.createElement('div', { className: 'section-title' }, '起卦失败'),
      React.createElement('div', { className: 'error' }, errored),
      React.createElement('button', { className: 'btn btn-primary', onClick: retryAsk }, UI_COPY.buttons.retry));
  }
  // REQ-104 + BUG-016：六爻/梅花/小六壬 卦象结果不再内联于本页（原 data && method !== 'sign' 分支
  // 已移除）—— 起卦成功后统一走全屏独立结果页 GuaResultScreen（见下方 return）。
  // ===== REQ-069 手动录入面板（弹窗内按方法渲染）=====
  const setYRow = function (i, v) {
    setYaoPick(prev => prev.map(function (r, j) { return j === i ? { yang: (r.yang === v ? null : v), mv: r.mv } : r; }));
  };
  const toggleYmv = function (i) {
    setYaoPick(prev => prev.map(function (r, j) { return j === i ? { yang: r.yang, mv: !r.mv } : r; }));
  };
  const autoLabel = method === 'sign' ? '自动抽签' : '自动起卦';
  const manualLabel = method === 'sign' ? '手动选签' : '手动录入结果';
  const filledYao = yaoPick.filter(function (r) { return r.yang != null; }).length;
  const movingYao = yaoPick.filter(function (r) { return r.mv; }).length;
  // REQ-118/119/120：大六壬、金口诀、奇门时家为纯时辰/方式起局（无手动录入通道），强制自动模式且不展示模式切换
  const effectiveManual = (method === 'liuren' || method === 'jinkoujue' || method === 'qimen') ? false : (askMode === 'manual');
  let manualPanel = null;
  if (effectiveManual) {
    if (method === 'liuyao' || method === 'meihua') {
      const rowEls = yaoPick.map(function (r, i) {
        return React.createElement('div', { key: 'y' + i, className: 'yao-row' },
          React.createElement('span', { className: 'yr-pos' }, YAO_LABEL[i] + UI_COPY.divination['ly-yao']),
          React.createElement('div', { className: 'yr-btns' },
            React.createElement('button', { type: 'button', className: 'yr-b yang' + (r.yang === true ? ' sel' : ''), onClick: function () { setYRow(i, true); } }, UI_COPY.divination['ly-yang']),
            React.createElement('button', { type: 'button', className: 'yr-b yin' + (r.yang === false ? ' sel' : ''), onClick: function () { setYRow(i, false); } }, UI_COPY.divination['ly-yin'])),
          React.createElement('button', { type: 'button', className: 'yr-mv' + (r.mv ? ' sel' : ''), onClick: function () { toggleYmv(i); } },
            React.createElement('span', { className: 'mv-ring' }), '动'));
      });
      manualPanel = React.createElement('div', null,
        React.createElement('div', { className: 'manual-cap' },
          method === 'liuyao'
            ? '真实摇卦后自初爻→上爻把每爻结果逐一点选：点「阳/阴」，动爻再点亮「动」（对应 少阳7/少阴8/老阳9/老阴6）。'
            : '真实起卦后按本卦初爻→上爻逐一点选阳/阴，并点亮 1 个动爻（动爻所在经卦为用、另一经卦为体，变卦随之而成）。'),
        React.createElement('div', { className: 'yao-pick' }, rowEls),
        React.createElement('div', { className: 'man-preview' },
          '已录 ' + filledYao + '/6 爻 · 动爻 ' + movingYao + ' 个' +
          (method === 'meihua' ? '（梅花须恰 1 个动爻）' : '（六爻可 0-6 个动爻）')));
    } else if (method === 'sign') {
      const sgEls = [];
      for (let n = 1; n <= SSGW_POOL_SIZE; n++) {
        sgEls.push(React.createElement('button', {
          key: n,
          type: 'button',
          className: 'sg' + (signNo === n ? ' sel' : ''),
          onClick: function () { setSignNo(signNo === n ? null : n); }
        }, n));
      }
      manualPanel = React.createElement('div', null,
        React.createElement('div', { className: 'manual-cap' }, '在签筒中摇得灵签后，直接点选你实际摇中的签号（签池共 ' + SSGW_POOL_SIZE + ' 支）：'),
        React.createElement('div', { className: 'sign-grid' }, sgEls),
        signNo ? React.createElement('div', { className: 'man-preview' }, '已选：', React.createElement('b', null, '第 ' + signNo + ' 签'), ' —— 确认后即时展示该签签文，可继续「深度解读（付费）」。') : null);
    } else if (method === 'xiaoliuren') {
      const Mv = Number(xlrM);
      const Dv = Number(xlrD);
      let prevText = '';
      if (xlrWay === 'nums') {
        if (Number.isInteger(Mv) && Mv >= 1 && Mv <= 12 && Number.isInteger(Dv) && Dv >= 1 && Dv <= 30) {
          const nm = xlrPalaceName(Mv, Dv, shichen + 1);
          prevText = '按三数自动顺数 → 落宫：' + nm + (C4_XIAOLIUREN_SHENS[nm] ? ' · ' + C4_XIAOLIUREN_SHENS[nm] : '');
        }
      } else if (xlrPalace >= 0) {
        const nm = XLR_PALACE_ORDER[xlrPalace];
        prevText = '已选掌诀（结果宫）：' + nm + (C4_XIAOLIUREN_SHENS[nm] ? ' · ' + C4_XIAOLIUREN_SHENS[nm] : '');
      }
      const tab = function (id, txt) {
        return React.createElement('button', { type: 'button', className: 'xlr-tab' + (xlrWay === id ? ' sel' : ''), onClick: function () { setXlrWay(id); } }, txt);
      };
      manualPanel = React.createElement('div', null,
        React.createElement('div', { className: 'manual-cap' }, '把真实掐指过程的结果录进来：填「月/日/时」三数自动落宫，或直接点选最终得到的掌诀（上方日期/时辰用于核对与实际时刻，默认即现在）。'),
        React.createElement('div', { className: 'xlr-tabs' }, tab('nums', '三数自动落宫'), tab('palace', '点选掌诀')),
        xlrWay === 'nums'
          ? React.createElement('div', null,
            React.createElement('div', { className: 'num-inline' },
              React.createElement('div', { className: 'num-field' },
                React.createElement('span', { className: 'nf-cap' }, '月数（1-12）'),
                React.createElement('input', {
                  className: 'num-in',
                  type: 'number',
                  min: 1,
                  max: 12,
                  inputMode: 'numeric',
                  placeholder: '如 3',
                  value: xlrM,
                  onChange: function (e) { setXlrM(e.target.value); }
                })),
              React.createElement('div', { className: 'num-field' },
                React.createElement('span', { className: 'nf-cap' }, '日数（1-30）'),
                React.createElement('input', {
                  className: 'num-in',
                  type: 'number',
                  min: 1,
                  max: 30,
                  inputMode: 'numeric',
                  placeholder: '如 15',
                  value: xlrD,
                  onChange: function (e) { setXlrD(e.target.value); }
                }))),
            React.createElement('div', { className: 'manual-cap', style: { marginTop: 6 } }, '时辰取上方「时辰」选择（子1…亥12）。'))
          : React.createElement('div', { className: 'palace-grid' }, XLR_PALACE_ORDER.map(function (nm, i) {
            return React.createElement('button', {
              key: nm,
              type: 'button',
              className: 'palace-chip' + (xlrPalace === i ? ' sel' : ''),
              onClick: function () { setXlrPalace(xlrPalace === i ? -1 : i); }
            }, React.createElement('span', { className: 'pc-name' }, nm), React.createElement('span', { className: 'pc-kw' }, (C4_XIAOLIUREN_SHENS[nm] || '').slice(0, 12)));
          })),
        prevText ? React.createElement('div', { className: 'man-preview' }, prevText) : null);
    }
  }
  // BUG-017：默认模式=auto/manual 时，手动/自动入口收起到「切换入口」（小字链接）而非默认双栏展示；
  // 仅 default_mode='both' 保留两入口并行双栏（REQ-066②）
  const modeSwitch = (method === 'liuren' || method === 'jinkoujue' || method === 'qimen') ? null : (TC_SETTINGS.default_mode === 'both'
    ? React.createElement('div', { className: 'mode-switch' },
        React.createElement('button', { type: 'button', className: askMode === 'auto' ? 'sel' : '', onClick: function () { setAskMode('auto'); } }, autoLabel),
        React.createElement('button', { type: 'button', className: askMode === 'manual' ? 'sel' : '', onClick: function () { setAskMode('manual'); } }, manualLabel))
    : React.createElement('button', { type: 'button', className: 'mode-switch-link', onClick: function () { setAskMode(askMode === 'auto' ? 'manual' : 'auto'); } },
        askMode === 'auto' ? ('改为' + manualLabel) : ('返回' + autoLabel)));
  const manualStartLabel = method === 'liuyao' ? '记录六爻并成卦'
    : method === 'meihua' ? '记录梅花并成卦'
      : method === 'sign' ? '确认该签并展示'
        : '记录结果并起课';
  // REQ-081②：观音灵签独立结果界面 —— 数据就绪且不在弹窗/签筒演出/错误态时，
  // 全屏独立视图展示（自动摇签 / 手动选签共用）；卦象结果不再内联于本页最下方。
  const signScreenOn = method === 'sign' && !!data && !asking && !animStage && !errored;
  const signRes = (result && method === 'sign') ? result : null;
  // REQ-104 + BUG-016：六爻/梅花/小六壬 卦象结果 → 全屏独立结果页（数据就绪且不在操作面板/演出/错误态）
  const guaResultOn = method !== 'sign' && !!data && !asking && !animStage && !errored && !!view;
  const guaSub = method === 'liuyao' ? '本卦已成 · 六亲世应参断'
    : method === 'meihua' ? '本卦已成 · 体用生克察应'
      : method === 'xiaoliuren' ? '落宫已定 · 速断所问吉凶'
        : method === 'liuren' ? '课式已起 · 四课三传参断'
          : method === 'jinkoujue' ? '课式已起 · 四位一体参断'
            : method === 'qimen' ? '局盘已成 · 九宫四盘参断'
              : '卦象已成 · 心诚则灵';
  let guaKids = [];
  if (guaResultOn) {
    if (qText) guaKids.push(React.createElement('div', { key: 'q', className: 'ssgw-res-echo' }, '问题：', qText));
    if (manLabel) guaKids.push(React.createElement('div', { key: 'm', className: 'ssgw-res-man' }, '录入：', manLabel));
    guaKids.push(React.createElement('div', { key: 'view', className: 'ssgw-gua-view' }, view));
    if (freeReading) guaKids.push(React.createElement('div', { key: 'free', className: 'ssgw-gua-free' }, freeReading));
    // REQ-118：大六壬断课模板选择（通用/感情/事业/财富，随「深度断课」请求体透传）
    if (method === 'liuren') {
      guaKids.push(React.createElement('div', { key: 'tpl', className: 'lr-tpl' },
        React.createElement('div', { className: 'tpl-cap' }, '断课模板（选填）'),
        React.createElement('div', { className: 'tpl-row' }, LIUREN_TEMPLATES.map(function (t) {
          return React.createElement('button', {
            key: t.key,
            type: 'button',
            className: 'tpl-chip' + (liurenTpl === t.key ? ' sel' : ''),
            onClick: function () { setLiurenTpl(t.key); }
          }, t.label);
        })),
        React.createElement('div', { className: 'tpl-note' }, '模板仅影响「深度断课」的侧重点（类神与问题主轴），不改变课盘本身。')));
    }
    if (method === 'liuyao' && result && data && data.id) guaKids.push(React.createElement(LiuyaoFocusPanel, {
      key: 'focus',
      res: result,
      focusMap: focusMap,
      onDetail: focusDetail,
      onToggle: toggleFocus
    }));
    if (result && result.text) guaKids.push(React.createElement('p', { key: 'tx', style: { marginTop: 8, color: 'var(--text-2)', lineHeight: 1.7 } }, String(result.text)));
    if (manWarn) guaKids.push(React.createElement('div', { key: 'warn', className: 'warn-note' }, manWarn));
  }
  // REQ-104：回到选项 —— 清空本盘结果并回到起卦选项列表视图（停留在 /divination，不跳模块 HUB）
  const backToOptions = function () {
    setData(null);
    setErrored('');
    setInterp('');
    setInterpErr('');
    setFocusMap({});
    setAnimStage(null);
    setAsking(false);
    setManLabel('');
    setManWarn('');
  };
  // 回到方法列表：重置起卦状态与结果，回到列表视图
  const backToList = function () {
    backToOptions();
    setAsking(false);
    setMethod('liuyao');
    setQOpen(false);
  };
  // 是否在详情视图（已进入具体起卦方法）
  const inDetail = asking || !!data;
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'hub-title' },
      inDetail ? React.createElement('button', {
        className: 'back-to-list-btn',
        onClick: backToList,
        style: {
          marginRight: 8, padding: '4px 10px', fontSize: 13,
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-2)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'inherit'
        }
      }, '← 返回选择') : null,
      React.createElement(Icon, { name: 'orbit', size: 22 }), ' 临时起卦'),
    // 方法列表：仅列表视图显示
    !inDetail ? React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'section-title' }, '选择起卦方式'),
      React.createElement('div', { className: 'method-list divin-groups' }, DIVIN_GROUP_META.map(function (g) {
        const items = DIVIN_METHODS.filter(function (x) { return x.group === g.key; });
        return React.createElement('div', { key: g.key, className: 'divin-group' },
          React.createElement('div', { className: 'divin-group-title' }, g.title),
          items.map(function (x) {
            return React.createElement('div', {
              key: x.id,
              className: 'method-cell' + (asking && method === x.id ? ' sel' : '') + (x.todo ? ' todo' : ''),
              onClick: function () { openAsk(x); }
            }, React.createElement('div', { className: 'mn' }, x.name), React.createElement('div', { className: 'md' }, x.desc));
          }));
      }))) : null,
    body,
    React.createElement('div', { className: 'back-row fill' },
      React.createElement('button', { className: 'btn btn-outline', onClick: function () { onNavigate('guoxue-hub'); } }, UI_COPY.buttons.back_options)),
    // REQ-105：起卦操作界面（原弹窗改内联面板）—— 进入默认不弹输入法/问题框；
    // 占问问题默认折叠，点击拟输入框展开填写（可留空直接起卦）
    asking ? React.createElement('div', { className: 'card divin-cast' },
      React.createElement('div', { className: 'section-title' }, ((m && m.name) || apiMethod), ' · ' + (effectiveManual ? '手动录入实际结果' : (method === 'sign' ? '抽签' : '起卦'))),
      modeSwitch,
      qOpen
        ? React.createElement('div', { key: 'qo' },
            React.createElement('div', { className: 'ask-cap' }, UI_COPY.divin.ask_label),
            React.createElement('textarea', {
              className: 'q-input',
              rows: 2,
              maxLength: 300,
              placeholder: UI_COPY.divin.ask_ph,
              value: question,
              onChange: function (e) { setQuestion(e.target.value); }
            }),
            React.createElement('div', { className: 'ask-opt-note' }, UI_COPY.divin.ask_opt_note),
            React.createElement('button', { type: 'button', className: 'q-collapse', onClick: function () { setQOpen(false); } }, '收起问题输入'))
        : React.createElement('div', { className: 'q-entry', onClick: function () { setQOpen(true); } },
            React.createElement('span', null, qText ? '已填占问问题：' + qText + '（点击修改）' : '占问问题（选填）· 点击填写'),
            React.createElement('span', { className: 'qe-plus' }, '＋')),
      isTimeMethod ? React.createElement('div', { key: 'tm' },
          React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, '起卦时间（必填）'),
          React.createElement('div', { className: 'dt-row' },
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, '日期', React.createElement('em', null, '*')),
              React.createElement('input', {
                type: 'date',
                className: 'dt-input',
                value: timeDate,
                onChange: function (e) { setTimeDate(e.target.value); }
              })),
            React.createElement('label', { className: 'dt-field' },
              React.createElement('span', { className: 'dt-cap' }, '时辰', React.createElement('em', null, '*')),
              React.createElement('select', {
                className: 'dt-input',
                value: shichen,
                onChange: function (e) { setShichen(Number(e.target.value)); }
              }, SHICHEN_ARR.map(function (s, i) {
                return React.createElement('option', { key: i, value: i }, s.n + '时（' + s.range + '）');
              })))),
          React.createElement('div', { className: 'time-note' }, '默认今天 + 当前时辰，可按实际起卦/掐指时刻调整。')) : null,
      // REQ-119：金口诀起课方式四选一（时间/指定地分/数字/随机；时间对四种方式均必填，随 params 透传引擎）
      method === 'jinkoujue' ? React.createElement('div', { key: 'jk', className: 'jk-panel' },
        React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, '起课方式（四选一）'),
        React.createElement('div', { className: 'jk-methods' }, JINKOUJUE_METHODS.map(function (jm) {
          return React.createElement('button', {
            key: jm.key,
            type: 'button',
            className: 'jk-method-chip' + (jkMethod === jm.key ? ' sel' : ''),
            onClick: function () { setJkMethod(jm.key); }
          }, jm.label);
        })),
        jkMethod === 'branch'
          ? React.createElement('div', { key: 'jkb', className: 'jk-branch-grid' },
              SHICHEN_ARR.map(function (s) {
                return React.createElement('button', {
                  key: s.n,
                  type: 'button',
                  className: 'jk-branch-chip' + (jkBranch === s.n ? ' sel' : ''),
                  onClick: function () { setJkBranch(s.n); }
                }, s.n);
              }))
          : null,
        jkMethod === 'number'
          ? React.createElement('div', { key: 'jkn', className: 'jk-num-row' },
              React.createElement('input', {
                className: 'jk-num-in',
                type: 'number',
                min: 1,
                step: 1,
                inputMode: 'numeric',
                placeholder: '输入不小于 1 的整数',
                value: jkNumber,
                onChange: function (e) { setJkNumber(e.target.value); }
              }))
          : null,
        React.createElement('div', { className: 'jk-note2' },
          jkMethod === 'time' ? '以所选日期/时辰起课：占时辰为地分，顺排四位。'
            : jkMethod === 'branch' ? '按所测方位或来意指定地分（十二地支之一），其余按所选时间顺排。'
              : jkMethod === 'number' ? '报一个正整数，归一为十二地支取地分，其余按所选时间顺排。'
                : '随机取地分（十二地支等概率），其余按所选时间顺排；确定性计算零 LLM 免费。')) : null,
      // REQ-120：奇门时家起局参数面板 —— 起局级别四选（默认时家）+ 转盘/飞盘（默认转盘）
      // + 拆补/置闰（默认拆补；月家/年家固定用月家/年家定局法，此选项仅对时家/日家生效）
      method === 'qimen' ? React.createElement('div', { key: 'qm', className: 'qm-panel' },
        React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, '起局级别（四选一）'),
        React.createElement('div', { className: 'qm-row' }, QIMEN_SCOPES.map(function (s) {
          return React.createElement('button', {
            key: s.key,
            type: 'button',
            className: 'qm-chip' + (qmScope === s.key ? ' sel' : ''),
            onClick: function () { setQmScope(s.key); }
          }, s.label);
        })),
        React.createElement('div', { className: 'qm-note2' },
          (QIMEN_SCOPES.find(function (s) { return s.key === qmScope; }) || {}).hint + '；级别决定应期量级（时家看时辰节奏、日家看日内、月家看月内、年家看年内）。'),
        React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, '排盘方法（二选一）'),
        React.createElement('div', { className: 'qm-row' }, QIMEN_METHODS.map(function (mt) {
          return React.createElement('button', {
            key: mt.key,
            type: 'button',
            className: 'qm-chip' + (qmMethod === mt.key ? ' sel' : ''),
            onClick: function () { setQmMethod(mt.key); }
          }, mt.label);
        })),
        React.createElement('div', { className: 'qm-note2' },
          (QIMEN_METHODS.find(function (mt) { return mt.key === qmMethod; }) || {}).hint + '。'),
        React.createElement('div', { className: 'ask-cap', style: { marginTop: 12 } }, '定局方法（二选一，默认拆补）'),
        React.createElement('div', { className: 'qm-row' }, QIMEN_JU_METHODS.map(function (ju) {
          return React.createElement('button', {
            key: ju.key,
            type: 'button',
            className: 'qm-chip' + (qmJuMethod === ju.key ? ' sel' : ''),
            disabled: qmScope === 'month' || qmScope === 'year',
            onClick: function () { setQmJuMethod(ju.key); }
          }, ju.label);
        })),
        React.createElement('div', { className: 'qm-note2' },
          (QIMEN_JU_METHODS.find(function (ju) { return ju.key === qmJuMethod; }) || {}).hint + '。'
          + (qmScope === 'month' || qmScope === 'year' ? '月家/年家固定用月家/年家定局法，拆补/置闰仅对时家/日家生效。' : '')
          + '起局为确定性计算，零 LLM 免费。')) : null,
      manualPanel,
      React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 16 } },
        React.createElement('button', { className: 'btn btn-outline', type: 'button', style: { flex: 1 }, onClick: closeAsk }, UI_COPY.buttons.cancel),
        effectiveManual
          ? React.createElement('button', { className: 'btn btn-primary', type: 'button', style: { flex: 1 }, disabled: loading, onClick: startManual }, manualStartLabel)
          : React.createElement('button', { className: 'btn btn-primary', type: 'button', style: { flex: 1 }, disabled: loading, onClick: startAsk }, UI_COPY.buttons.start_divination))) : null,
    // REQ-104 + BUG-016：六爻/梅花/小六壬 结果 → 全屏独立结果页（含回到选项）
    guaResultOn ? React.createElement(GuaResultScreen, {
      kicker: (m && m.name) || apiMethod,
      sub: guaSub,
      kids: guaKids,
      interp: interp,
      interpErr: interpErr,
      interpLoading: interpLoading,
      payEnough: payEnough,
      interpretLabel: (method === 'liuren' || method === 'jinkoujue' || method === 'qimen') ? '深度断课（付费）' : undefined,
      onInterpret: interpret,
      onRedo: function () {
        setData(null);
        setErrored('');
        setInterp('');
        setInterpErr('');
        setFocusMap({});
        setAnimStage(null);
        openAsk(m);
      },
      onBack: backToOptions
    }) : null,
    signScreenOn && signRes ? React.createElement(SsgwResultScreen, {
      res: signRes,
      qText: qText,
      manLabel: manLabel,
      interp: interp,
      interpErr: interpErr,
      interpLoading: interpLoading,
      payEnough: payEnough,
      onInterpret: interpret,
      onRedo: function () {
        setData(null);
        setErrored('');
        setInterp('');
        setInterpErr('');
        setFocusMap({});
        setAnimStage(null);
        openAsk(m);
      },
      onBack: backToOptions
    }) : null);
}
