#!/usr/bin/env node
/** REQ-128 阶段1 临时冒烟（不提交）：以浏览器 stub 环境执行主应用脚本，验证顶部装载链路
 *  （TC_COPY 数据文件 → UI_COPY 兼容别名 → RAIL_MODS/MOD_NAV_GROUPS 等模块级常量）无运行时错误。 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('frontend/public/index.html', 'utf8');

// 先载入数据文件
const dataSrc = readFileSync('frontend/public/data/ui-copy.js', 'utf8');
const w = {};
new Function('window', dataSrc)(w);
if (!w.TC_COPY || !w.TC_COPY.ui) { console.error('✗ TC_COPY 数据文件未正确装载'); process.exit(1); }
console.log('✓ ui-copy.js 装载：TC_COPY.ui 组数 =', Object.keys(w.TC_COPY.ui).length);

// 提取主应用 script
const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
let appScript = null;
for (const block of m) {
  if (block.includes('ReactDOM.render')) { appScript = block.replace(/^<script[^>]*>\n?/, '').replace(/\n?<\/script>$/, ''); break; }
}
if (!appScript) { console.error('未找到主应用 script'); process.exit(1); }

const noop = () => {};
const fakeEl = () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null, appendChild: noop, addEventListener: noop, removeEventListener: noop, querySelectorAll: () => [], focus: noop, click: noop, remove: noop });
const ctx = {
  console,
  window: { crypto: undefined, location: { pathname: '/', assign: noop }, history: { pushState: noop, replaceState: noop }, matchMedia: () => ({ matches: false }), addEventListener: noop, removeEventListener: noop, open: () => null, prompt: () => null, crypto: undefined },
  document: { getElementById: () => null, createElement: fakeEl, createElementNS: () => fakeEl(), addEventListener: noop, removeEventListener: noop, documentElement: { setAttribute: noop }, body: fakeEl(), querySelectorAll: () => [], title: '' },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { serviceWorker: { register: () => Promise.resolve() }, standalone: undefined, userAgent: 'vm-smoke' },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }),
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0,
  React: {
    useState: () => [undefined, noop], useEffect: noop, useRef: () => ({ current: null }),
    createElement: (...a) => ({ type: a[0] }), Fragment: 'fragment',
    Component: class { constructor() { this.state = {}; } setState(s) { this.state = Object.assign({}, this.state, typeof s === 'function' ? s(this.state) : s); } }
  },
  ReactDOM: { render: noop },
  location: { pathname: '/', assign: noop },
  history: { pushState: noop, replaceState: noop },
  // 浏览器中 TC_COPY 由 /data/ui-copy.js 在 React 脚本前挂到 window；VM 内镜像为全局
  TC_COPY: w.TC_COPY,
  UI_COPY: w.TC_COPY.ui
};
ctx.window.window = ctx.window;
ctx.window.localStorage = ctx.localStorage;
ctx.window.sessionStorage = ctx.sessionStorage;
ctx.window.navigator = ctx.navigator;
ctx.window.document = ctx.document;
ctx.window.fetch = ctx.fetch;
ctx.globalThis = ctx;

vm.createContext(ctx);
try {
  vm.runInContext(appScript, ctx, { filename: 'index.html#app' });
  console.log('✓ 主应用脚本顶层装载成功（无 ReferenceError / SyntaxError）');
  console.log('✓ UI_COPY 别名 = TC_COPY.ui 生效（UI_COPY.buttons 长度 =', ctx.UI_COPY.buttons ? Object.keys(ctx.UI_COPY.buttons).length : 'N/A', '）');
  console.log('✓ RAIL_MODS 标签:', JSON.stringify(ctx.RAIL_MODS.map(m => m.label)));
  console.log('✓ MOD_NAV_GROUPS 组:', JSON.stringify(ctx.MOD_NAV_GROUPS.map(g => g.title)));
  console.log('✓ MOD_NAV_GROUPS 首组项:', JSON.stringify(ctx.MOD_NAV_GROUPS[0].items.map(i => i.label)));
} catch (e) {
  console.error('✗ 主应用脚本装载失败:', e.message);
  console.error(e.stack);
  process.exit(1);
}
