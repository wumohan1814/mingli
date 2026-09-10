// 通用件 + 共享工具（节110 阶段2 拆出）：toast/svgEl/buildOrbit/setOrbitProgress/DisclaimerFooter/Icon/ModalBase/SkinSwitcher/spriteKfName/ensureSpriteKeyframes
// 加载于 vendor+data（React/ReactDOM/TC_COPY）之后、主脚本之前；全局作用域，须早于 views 加载

// 全局轻提示
function toast(msg) {
  let t = document.getElementById('taichu-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'taichu-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

// 轨道引擎（C1）：构建星盘 + 按真实进度点亮节点
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) {
    if (k === 'class') e.setAttribute('class', attrs[k]);else e.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(e);
  return e;
}
function buildOrbit(svgId, methods) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';
  const cx = 120,
    cy = 120;
  const g = svgEl('g', {
    class: 'dqc-rings'
  }, svg);
  [40, 78, 112].forEach((r, idx) => {
    svgEl('circle', {
      cx,
      cy,
      r,
      fill: 'none',
      class: idx === 2 ? 'gold-stroke' : 'ring-stroke',
      'stroke-width': idx === 2 ? 1.4 : 1,
      opacity: idx === 2 ? .8 : .5
    }, g);
  });
  methods.forEach((m, i) => {
    const ang = i / methods.length * Math.PI * 2 - Math.PI / 2;
    const x = cx + 88 * Math.cos(ang),
      y = cy + 88 * Math.sin(ang);
    const c = svgEl('circle', {
      cx: x,
      cy: y,
      r: 6,
      class: 's-pending',
      'data-i': i
    }, g);
    c.dataset.method = m;
  });
  svgEl('circle', {
    cx,
    cy,
    r: 8,
    class: 'gold'
  }, svg);
}
function setOrbitProgress(svgId, methods, done, total) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const nodes = [...svg.querySelectorAll('[data-i]')];
  const lit = Math.min(methods.length, Math.round(done / total * methods.length));
  nodes.forEach((s, i) => {
    if (i < lit) s.setAttribute('class', 's-done');else if (i === lit && done < total) s.setAttribute('class', 's-active');else s.setAttribute('class', 's-pending');
  });
}

// 全局末行免责（合规要求：每页末行免责必须存在；硬编码朱砂，跨皮肤一致）
function DisclaimerFooter() {
  return /*#__PURE__*/React.createElement("div", {
    className: "disclaimer",
    role: "contentinfo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "star"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "spark",
    size: 14
  })), TC_COPY.ui.compliance.disclaimer_full, /*#__PURE__*/React.createElement("div", {
    className: "legal-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: TC_COPY.ui.footer['legal-agreement-href'],
    target: "_blank"
  }, TC_COPY.ui.footer['legal-agreement']), /*#__PURE__*/React.createElement("span", {
    className: "legal-sep"
  }, " · "), /*#__PURE__*/React.createElement("a", {
    href: TC_COPY.ui.footer['legal-privacy-href'],
    target: "_blank"
  }, TC_COPY.ui.footer['legal-privacy'])));
}

// 内联 SVG 图标组件（替代原 Unicode 字符）
function Icon({
  name,
  size = 22,
  stroke = 1.7,
  color
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'icon'
  };
  switch (name) {
    case 'nine':
      {
        const dots = [];
        let k = 0;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          dots.push(/*#__PURE__*/React.createElement("circle", {
            key: k++,
            cx: 4 + c * 8,
            cy: 4 + r * 8,
            r: 2.3
          }));
        }
        return /*#__PURE__*/React.createElement("svg", {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "currentColor",
          className: "icon"
        }, dots);
      }
    case 'pencil':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 20h9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"
      }));
    case 'chat':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"
      }));
    case 'up':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 19V5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 11l6-6 6 6"
      }));
    case 'down':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 5v14"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 13l6 6 6-6"
      }));
    case 'flat':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M5 12h14"
      }));
    case 'check':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M20 6 9 17l-5-5"
      }));
    case 'cross':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M18 6 6 18"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 6l12 12"
      }));
    case 'list':
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M8 6h13"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 12h13"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 18h13"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 6h.01"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 12h.01"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 18h.01"
      }));
    case 'spark':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor",
        className: "icon"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M12 2l2.3 6.5L21 10l-6.7 1.5L12 18l-2.3-6.5L3 10l6.7-1.5z"
      }));
    case 'orbit':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color || 'currentColor',
        strokeWidth: 1.6,
        className: "icon"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "12",
        rx: "10",
        ry: "4.2",
        transform: "rotate(28 12 12)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "12",
        rx: "10",
        ry: "4.2",
        transform: "rotate(-28 12 12)"
      }));
    case 'calendar':
      /* REQ-121：黄历择日（日历 + 勾选标记） */
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4.5",
        width: "18",
        height: "16",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 9.5h18"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 2.5v4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 2.5v4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m9.2 15.2 2 2 3.8-4"
      }));
    case 'taiyi':
      /* REQ-124：太乙神数（九宫格 + 中宫太乙星） */
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M3.5 8h17"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3.5 16h17"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 3.5v17"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 3.5v17"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m12 6.6 1.1 3.3 3.3 1.1-3.3 1.1-1.1 3.3-1.1-3.3-3.3-1.1 3.3-1.1z"
      }));
    case 'huangji':
      /* REQ-125：皇极经世（圆天 + 卦爻层级） */
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "8.6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6.4 8.2h11.2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6.4 12h5.2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12.4 12h5.2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6.4 15.8h11.2"
      }));
    default:
      return null;
  }
}

// ===== 通用 Modal 基座（ModalBase）=====
// 抽取 10 个业务 Modal 的共同结构：遮罩 + 卡片 + 标题 + 内容 + 底部按钮
// 设计原则：
//   1) 完全向后兼容 —— 不修改任何现有 Modal 的调用方式
//   2) 渐进式迁移 —— 新 Modal 直接用基座，旧 Modal 可按需逐步迁移
//   3) 零额外依赖 —— 纯 React + CSS，不引入第三方
//
// Props:
//   visible      boolean       是否显示（不传则默认显示，由父级控制渲染）
//   title        string|node   弹窗标题
//   children     node          弹窗内容
//   footer       node          自定义底部按钮区（不传则不显示）
//   onClose      function      点击遮罩/关闭按钮的回调
//   closable     boolean       是否显示右上角关闭按钮（默认 false，保持旧行为）
//   maskClosable boolean       点击遮罩是否关闭（默认 true）
//   className    string        附加到 .modal 的自定义类名（如 ask-modal, pair-modal）
//   width        number|string 最大宽度（默认 340px）
//   bodyClassName string       内容区附加类名
//   align        'center'|'left'  内容对齐方式（默认 'center'，与旧行为一致）
//   scrollable   boolean       内容过高时是否可滚动（默认 false，长内容建议 true）
//
// 用法：
//   <ModalBase title="标题" onClose={handleClose} footer={
//     <><button onClick={handleClose}>取消</button><button onClick={handleOk}>确定</button></>
//   }>
//     内容
//   </ModalBase>
function ModalBase(_ref) {
  var title = _ref.title;
  var children = _ref.children;
  var footer = _ref.footer;
  var onClose = _ref.onClose;
  var closable = _ref.closable;
  var maskClosable = _ref.maskClosable === undefined ? true : _ref.maskClosable;
  var className = _ref.className;
  var width = _ref.width;
  var bodyClassName = _ref.bodyClassName;
  var align = _ref.align || 'center';
  var scrollable = _ref.scrollable;
  var el = React.createElement;

  // ESC 键关闭
  React.useEffect(function () {
    if (!onClose) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // 打开时禁止背景滚动
  React.useEffect(function () {
    var prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function () { document.body.style.overflow = prev; };
  }, []);

  var modalStyle = {};
  if (width) modalStyle.maxWidth = typeof width === 'number' ? width + 'px' : width;
  if (align === 'left') modalStyle.textAlign = 'left';
  if (scrollable) {
    modalStyle.maxHeight = '88vh';
    modalStyle.display = 'flex';
    modalStyle.flexDirection = 'column';
  }

  var bodyStyle = {};
  if (scrollable) {
    bodyStyle.overflowY = 'auto';
    bodyStyle.flex = '1 1 auto';
    bodyStyle.minHeight = 0;
  }

  // Portal 渲染到 body 末尾，避免父级 transform/filter 等导致 position: fixed 失效
  var modalNode = el('div', {
    className: 'modal-mask',
    onClick: maskClosable && onClose ? onClose : undefined
  }, el('div', {
    className: 'modal' + (className ? ' ' + className : ''),
    style: modalStyle,
    onClick: function onClick(e) { return e.stopPropagation(); }
  },
  // 标题栏（有标题或有关闭按钮时显示）
  (title || closable) ? el('div', {
    className: 'modal-title',
    style: { position: 'relative' }
  }, title, closable ? el('button', {
    className: 'modal-close-btn',
    'aria-label': '关闭',
    onClick: onClose,
    style: {
      position: 'absolute', top: -4, right: -8, width: 28, height: 28,
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 20, color: 'var(--text-3)', lineHeight: 1
    }
  }, '×') : null) : null,
  // 内容区
  el('div', {
    className: 'modal-body' + (bodyClassName ? ' ' + bodyClassName : ''),
    style: bodyStyle
  }, children),
  // 底部按钮区
  footer ? el('div', {
    className: 'modal-footer',
    style: {
      marginTop: 16,
      display: 'flex',
      gap: 10,
      justifyContent: align === 'left' ? 'flex-start' : 'center'
    }
  }, footer) : null));
  // 用 Portal 渲染到 body：确保 position: fixed 相对于视口，不受父级 transform 影响
  if (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && document.body) {
    return ReactDOM.createPortal(modalNode, document.body);
  }
  return modalNode;
}

// 皮肤切换胶囊（MVP 仅国学可切，占星/塔罗置灰）
function SkinSwitcher({
  skin,
  onPick
}) {
  const items = [{
    id: 'guoxue',
    name: TC_COPY.ui.skin.guoxue,
    enabled: true
  }, {
    id: 'astrology',
    name: TC_COPY.ui.skin['xishi-astrology'],
    enabled: false
  }, {
    id: 'tarot',
    name: TC_COPY.ui.skin.tarot,
    enabled: false
  }];
  return /*#__PURE__*/React.createElement("nav", {
    className: "skin-switch",
    "aria-label": TC_COPY.ui.skin.aria
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    "data-skin-btn": it.id,
    className: skin === it.id ? 'active' : '',
    "aria-pressed": skin === it.id ? 'true' : 'false',
    disabled: !it.enabled,
    onClick: () => it.enabled ? onPick(it.id) : toast(TC_COPY.ui.skin['unavailable-toast'])
  }, it.name)));
}

// REQ-084：序列帧 sprite sheet 播放器 —— 依据 sprite 配置（cols/rows/frames/width）生成逐帧
// keyframes：第 k 帧位于第 floor(k/cols) 行、第 k%cols 列；background-position 以 sprite.width
// 的像素偏移逐帧跳变（每段 steps(1) 保持当前帧、段末跳下一帧），100% 回第一帧实现无缝循环。
// 同名 keyframes 只注入一次；素材回传后仅改 MODS 配置即可，无需改 CSS/JS。
function spriteKfName(s) {
  return 'mascotSpritePlay_' + s.cols + 'x' + s.rows + '_' + s.frames;
}
function ensureSpriteKeyframes(s) {
  const name = spriteKfName(s);
  if (document.getElementById('kf-' + name)) return name;
  const stops = [];
  for (let k = 0; k < s.frames; k++) {
    const pct = (k * 100 / s.frames).toFixed(4);
    stops.push(pct + '%{background-position:' + (-(k % s.cols) * s.width) + 'px ' + (-Math.floor(k / s.cols) * s.width) + 'px}');
  }
  stops.push('100%{background-position:0 0}');
  const st = document.createElement('style');
  st.id = 'kf-' + name;
  st.textContent = '@keyframes ' + name + '{' + stops.join('') + '}';
  (document.head || document.documentElement).appendChild(st);
  return name;
}
