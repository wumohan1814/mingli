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
// 爻位 / 12 时辰 · 来自 CONTENT 基础名词表（节135）
const YAO_LABEL = CONTENT.basics.yaoLabel;
/* REQ-055：梅花/小六壬 时间选项（12 时辰，date 默认今天、时辰默认当前） */
const SHICHEN_ARR = CONTENT.basics.shichen;
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
// 卦义简述 · 来自 CONTENT 统一正文数据（节135）
const HEX_MEANINGS = CONTENT.iChing.hexMeanings;

/* S01 正文复用（docs/文案交付-第二轮/C3_hexagram_generic.json，64 卦 × 本卦大意/变卦大意，现代白话零占位）：键 = 卦全名。 */
// 本卦大意 / 变卦大意 · 来自 CONTENT 统一正文数据（节135）
const HEX_GENERIC = CONTENT.iChing.hexGeneric;

/* S08 素材（docs/文案交付-第二轮/liuyao_hexagram_texts.json：64 卦辞 + 64 大象 + 386 爻辞「原文+白话」）：键 = 卦全名；yaoCi 自初爻起按爻位排序（乾/坤末尾含用九/用六）。 */
// 卦辞 / 象辞 / 爻辞 · 来自 CONTENT 统一正文数据（节135）
const HEX_TEXT = CONTENT.iChing.hexText;

// 六亲/六神/世应/占断术语/六爻通用话术 · 来自 CONTENT 统一正文数据（节135）
const LIUQIN_CN = CONTENT.divination.glossary.liuqin;
const LIUSHEN_CN = CONTENT.divination.glossary.liushen;
const SHIYING_CN = CONTENT.divination.glossary.shiying;
const TERMS_CN = CONTENT.divination.glossary.terms;
const LIUYAO_GENERIC = CONTENT.divination.glossary.liuyaoGeneric;

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

// 卦理通则（六爻/梅花/小六壬）· 来自 CONTENT 统一正文数据（节135）
const C3_GENERIC_RULES = CONTENT.divination.glossary.c3GenericRules;

// 梅花五格局（体用生克）· 来自 CONTENT 统一正文数据（节135）
const C4_MEIHUA_PATTERNS = CONTENT.divination.glossary.c4MeihuaPatterns;

// 小六壬六神掌诀释义 · 来自 CONTENT 统一正文数据（节135）
const C4_XIAOLIUREN_SHENS = CONTENT.divination.glossary.c4XiaoliurenShens;
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
// 八卦名 · 来自 CONTENT 基础名词表（节135）
const MH_TRIG_NAMES = CONTENT.basics.baguaTrigrams;
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
