// 临时：node 顶层执行前端主脚本（mock 浏览器 + React），暴露顶层初始化运行时错误
// （未定义引用 / 常量初始化崩溃等）。组件渲染期不执行（ReactDOM.render mock 为停止）。
const fs = require('node:fs');
const html = fs.readFileSync('frontend/public/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// 取最长的内联脚本块 = 主应用脚本（其余为 vendor CDN 引用与小段注册脚本）
const app = scripts.sort((a, b) => b.length - a.length)[0];
console.error('app script len:', app.length);

const noop = () => {};
const el = (type, props, ...children) => ({ type, props, children });
global.window = {
  location: { pathname: '/', hostname: 'localhost', search: '', hash: '' },
  history: { pushState: noop, replaceState: noop, length: 1 },
  addEventListener: noop, removeEventListener: noop,
  innerWidth: 390, innerHeight: 800,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  prompt: () => null, confirm: () => false, alert: noop,
  requestAnimationFrame: cb => cb(), cancelAnimationFrame: noop,
  setTimeout, clearTimeout, setInterval, clearInterval,
  scrollTo: noop, devicePixelRatio: 2, location_assign: null,
};
global.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop } }),
  createTextNode: () => ({}),
  head: { appendChild: noop },
  documentElement: { setAttribute: noop, style: {} },
  body: { appendChild: noop, style: {} },
  addEventListener: noop, removeEventListener: noop,
  querySelector: () => null, querySelectorAll: () => [],
  title: '', cookie: '',
};
global.navigator = { userAgent: 'node', onLine: true, serviceWorker: { register: noop }, platform: 'node' };
global.localStorage = global.window.localStorage;
global.location = global.window.location;
global.history = global.window.history;
global.self = global.window;
global.React = {
  createElement: el,
  Fragment: 'FRAGMENT',
  useState: () => [], useEffect: noop, useRef: () => ({ current: null }),
  useMemo: f => (typeof f === 'function' ? f() : f), useCallback: f => f,
  useContext: () => ({}), useReducer: () => [{}, noop],
  Component: class { render() { return null; } },
  createContext: () => ({ Provider: 'P', Consumer: 'C', displayName: '' }),
  memo: f => f, forwardRef: f => f, StrictMode: 'SM', Suspense: 'S',
  Children: { map: (c, fn) => (Array.isArray(c) ? c.map(fn) : []), only: c => c, count: c => (c ? 1 : 0), toArray: c => (Array.isArray(c) ? c : []) },
};
global.ReactDOM = {
  render: () => { console.error('REACTDOM.RENDER CALLED (顶层执行到 render 即停止)'); },
  createRoot: () => ({ render: () => { console.error('REACTDOM.CREATEROOT.RENDER (顶层执行到 render 即停止)'); } }),
};
// 预加载 data 文件：以 node 全局为 window 执行，使 window.TC_COPY 等成为全局标识符
let prelude = '';
for (const f of ['ui-copy.js', 'pairs.js', 'term-cards.js']) {
  prelude += fs.readFileSync('frontend/public/data/' + f, 'utf8') + '\n;\n';
}
console.error('data prelude len:', prelude.length);
try {
  new Function('window', 'document', prelude)(globalThis, global.document);
  console.error('prelude globals: TC_COPY=' + typeof globalThis.TC_COPY + ' UI_COPY=' + typeof globalThis.UI_COPY);
} catch (e) {
  console.error('PRELUDE-ERROR:', e && e.message);
}
global.console.error = global.console.error; // 保留
try {
  new Function('window', 'document', 'navigator', 'localStorage', 'location', 'history', 'React', 'ReactDOM', 'self',
    app)(global.window, global.document, global.navigator, global.localStorage, global.location, global.history, global.React, global.ReactDOM, global.window);
  console.error('TOPLEVEL-OK: 顶层初始化无运行时错误');
} catch (e) {
  console.error('TOPLEVEL-ERROR:', e && e.message);
  console.error(e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
}
