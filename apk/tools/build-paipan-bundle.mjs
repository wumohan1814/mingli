#!/usr/bin/env node
/**
 * build-paipan-bundle.mjs —— 把排盘 JS 内核打成「可在 Android WebView(V8) 里跑的 IIFE bundle」。
 *
 * 用法（在 `apk/` 目录）：
 *   npm install
 *   node tools/build-paipan-bundle.mjs                 # 打包 + 自检 + 冒烟
 *   node tools/build-paipan-bundle.mjs --no-smoke      # 只打包 + 自检
 *   node tools/build-paipan-bundle.mjs --smoke-only --json   # 不重打包，只跑冒烟并输出摘要（供 TZ 对拍）
 *
 * 产物：`apk/app/src/main/assets/paipan/paipan-bundle.js`（生成物，**不入库**）
 *
 * 三条硬约束（本脚本即为守门人）：
 *   1. **零 Node 内置**：`platform:"browser"` + `external: []`；打包后再对产物文本与 metafile
 *      输入清单双向自检，命中 `require("fs")` / `"node:fs"` / `process.` 之类即 **退出码 1**。
 *   2. **astronomia 精确子路径**：`astronomia/data`（默认对象，会带进 8.9MB 全量表）被别名成
 *      只含本仓实际用的 8 个 `vsop87B*`（1.72MB）的虚拟模块；脚本会**真实再打一次"未优化"
 *      基线包**并给出前后字节数对比（真实数字，非估算）。
 *   3. **自检产物形态**：必须是 IIFE、必须挂 `globalThis.__MINGLI_PAIPAN`、必须暴露
 *      `dispatch` / `setTimezoneOffsetMinutes`。
 *
 * 冒烟（默认开）：在 **无 process / 无 require / 无 Buffer / 无 Node 内置** 的 `node:vm`
 * 裸上下文里执行 bundle，真打 6 条路由；再单独一轮注入 Web Crypto（模拟 WebView）验证
 * `randomSeedInt` 的 WebView 分支。
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APK_DIR = path.resolve(HERE, '..');
const REPO_DIR = path.resolve(APK_DIR, '..');
const ADAPTER = path.join(REPO_DIR, 'backend', 'paipan-node', 'paipan-web-adapter.mjs');
const OUT_FILE = path.join(APK_DIR, 'app', 'src', 'main', 'assets', 'paipan', 'paipan-bundle.js');
const ASTRONOMIA_DATA_DIR = path.join(
  REPO_DIR, 'backend', 'paipan-node', 'paipan-core', 'node_modules', 'astronomia', 'data',
);

const ARGS = new Set(process.argv.slice(2));
const NO_SMOKE = ARGS.has('--no-smoke');
const SMOKE_ONLY = ARGS.has('--smoke-only');
const AS_JSON = ARGS.has('--json');
const NO_COMPARE = ARGS.has('--no-compare');
const MINIFY = !ARGS.has('--no-minify');

/** 本仓实际使用的 8 个 VSOP87B 表（来源：paipan-core/src/capabilities/astrology/ephemeris.js:58-65）。 */
const VSOP87B_TABLES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

/** 契约路由（与 server.mjs handleRequest 的 if-else 分支一一对应）。 */
const CONTRACT_ROUTES = ['/ziwei', '/extra', '/zodiac', '/tarot', '/astrology', '/divination'];

/** Node 内置模块名（自检清单）。 */
const NODE_BUILTINS = [
  'fs', 'path', 'http', 'https', 'crypto', 'module', 'os', 'url', 'child_process', 'assert',
  'stream', 'buffer', 'util', 'events', 'net', 'tls', 'zlib', 'worker_threads', 'vm', 'readline',
  'querystring', 'process', 'perf_hooks', 'timers', 'string_decoder', 'tty', 'dns', 'dgram',
  'cluster', 'repl', 'v8', 'constants', 'async_hooks', 'inspector', 'punycode', 'sys', 'trace_events',
];

// ---------------------------------------------------------------------------
// esbuild 插件：astronomia/data 精确子路径别名
// ---------------------------------------------------------------------------

const SHIM_NS = 'mingli-astronomia-data-shim';

/**
 * `import astronomiaData from 'astronomia/data'`（ephemeris.js:31）拿到的是一个**默认对象**，
 * 其 20 个键一次性 import 了全部数据表（含 5.6MB 月球表 + 8 个 vsop87D），esbuild/rollup
 * 都无法 tree-shake 掉默认对象里未使用的键。此插件把该说明符解析成一个虚拟模块，
 * 只 re-export 本仓真正用到的 8 个 `vsop87B*`（+ 同名键，保持调用点零改动）。
 */
function astronomiaDataShimPlugin() {
  return {
    name: 'mingli-astronomia-data-shim',
    setup(b) {
      b.onResolve({ filter: /^astronomia\/data$/ }, (args) => ({
        path: 'astronomia-data-shim',
        namespace: SHIM_NS,
        pluginData: { resolveDir: args.resolveDir },
      }));
      b.onLoad({ filter: /.*/, namespace: SHIM_NS }, (args) => ({
        contents: [
          '// 由 apk/tools/build-paipan-bundle.mjs 注入：astronomia/data 的精确子路径替身。',
          ...VSOP87B_TABLES.map((n) => `import ${n} from "astronomia/data/vsop87B${n}";`),
          `export default { ${VSOP87B_TABLES.map((n) => `vsop87B${n}: ${n}`).join(', ')} };`,
        ].join('\n'),
        loader: 'js',
        resolveDir: args.pluginData.resolveDir,
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// 虚拟 entry：把适配层挂到 globalThis.__MINGLI_PAIPAN
// ---------------------------------------------------------------------------

const ENTRY_NS = 'mingli-bundle-entry';

function bundleEntryPlugin() {
  const spec = JSON.stringify(ADAPTER.replace(/\\/g, '/'));
  return {
    name: 'mingli-bundle-entry',
    setup(b) {
      b.onResolve({ filter: /^mingli-bundle-entry$/ }, () => ({ path: 'entry', namespace: ENTRY_NS }));
      b.onLoad({ filter: /.*/, namespace: ENTRY_NS }, () => ({
        contents: [
          `import { dispatch, setTimezoneOffsetMinutes, getTimezoneOffsetMinutes, isTimezoneOverrideInstalled, ROUTES as routes, version } from ${spec};`,
          'const api = {',
          '  dispatch,',
          '  setTimezoneOffsetMinutes,',
          '  getTimezoneOffsetMinutes,',
          '  isTimezoneOverrideInstalled,',
          '  routes,',
          '  version,',
          "  bundle: 'paipan-webview-iife',",
          '};',
          'globalThis.__MINGLI_PAIPAN = api;',
        ].join('\n'),
        loader: 'js',
        resolveDir: path.join(REPO_DIR, 'backend', 'paipan-node'),
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// 打包
// ---------------------------------------------------------------------------

const SHARED_OPTIONS = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  external: [], // 明确：没有任何 external；任何 Node 内置都会在打包期直接报错
  minify: MINIFY,
  charset: 'utf8', // 保留中文原文（比 \uXXXX 转义更小）
  legalComments: 'eof', // 保留第三方 MIT/Apache 声明（合规台账需要）
  sourcemap: false,
  metafile: true,
  logLevel: 'warning',
  logLimit: 20,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

function entryPoints() {
  // 用虚拟 entry 的 namespace 路径作为入口由 onResolve 处理；此处传包名形式的说明符。
  return ['mingli-bundle-entry'];
}

async function buildOnce({ optimizeAstronomia, outfile }) {
  mkdirSync(path.dirname(outfile), { recursive: true });
  const plugins = [bundleEntryPlugin()];
  if (optimizeAstronomia) plugins.push(astronomiaDataShimPlugin());
  const result = await build({
    ...SHARED_OPTIONS,
    entryPoints: entryPoints(),
    outfile,
    plugins,
    absWorkingDir: REPO_DIR,
    nodePaths: [
      path.join(REPO_DIR, 'backend', 'paipan-node', 'node_modules'),
      path.join(REPO_DIR, 'backend', 'paipan-node', 'paipan-core', 'node_modules'),
    ],
  });
  return result;
}

// ---------------------------------------------------------------------------
// 自检
// ---------------------------------------------------------------------------

function selfCheck(code, metafile) {
  const failures = [];
  const warnings = [];
  const stats = {};

  // ① 产物文本里的 Node 内置说明符
  const builtinAlt = NODE_BUILTINS.join('|');
  const specRe = new RegExp(
    `(?:require\\s*\\(\\s*|from\\s*|import\\s*\\(\\s*)["'\`](?:node:)?(?:${builtinAlt})["'\`]`,
    'g',
  );
  const specHits = [...new Set((code.match(specRe) || []).map((s) => s.trim()))];
  stats.nodeBuiltinSpecifiers = specHits;
  if (specHits.length) failures.push(`产物中出现 Node 内置模块说明符: ${specHits.join(' | ')}`);

  // ② IIFE 里不该有任何 require(...)
  const requireHits = [...new Set((code.match(/require\s*\(/g) || []))];
  stats.requireCalls = requireHits.length;
  if (requireHits.length) failures.push('产物中出现 require( 调用（IIFE 应为完全自包含）');

  // ③ 常见 Node 全局
  for (const [name, re] of [
    ['process.', /\bprocess\./],
    ['__dirname', /\b__dirname\b/],
    ['__filename', /\b__filename\b/],
    ['Buffer', /\bBuffer\./],
    ['import.meta', /\bimport\.meta\b/],
  ]) {
    const hits = (code.match(re) || []).length;
    stats[`global:${name}`] = hits;
    if (hits) failures.push(`产物中出现 Node 全局 ${name}（出现 ${hits} 次）`);
  }

  // ④ metafile 输入清单里不该有 node: / 内置路径
  const inputs = Object.keys(metafile.inputs);
  stats.inputFiles = inputs.length;
  const badInputs = inputs.filter((p) => /(^|\/)(node:|fs|path|http|crypto|module|os|url|child_process)\.?[a-z_]*$/i.test(p)
    && /(^|\/)(node:)/.test(p));
  if (badInputs.length) failures.push(`metafile 输入含 node: 协议模块: ${badInputs.join(', ')}`);

  // ⑤ astronomia 大表是否真的没进包（按输入路径判定，比字符串匹配可靠）
  const dataInputs = inputs.filter((p) => p.includes('astronomia/data/'));
  stats.astronomiaDataInputs = dataInputs.map((p) => p.split('astronomia/data/')[1]);
  const bigTables = dataInputs.filter((p) => /elpMppDe|vsop87D/.test(p));
  if (bigTables.length) {
    failures.push(`astronomia 未优化数据表进了包: ${bigTables.map((p) => p.split('astronomia/data/')[1]).join(', ')}`);
  }

  // ⑥ 产物形态
  for (const [label, re] of [
    ['globalThis.__MINGLI_PAIPAN 挂载', /__MINGLI_PAIPAN/],
    ['dispatch 导出', /dispatch/],
    ['setTimezoneOffsetMinutes 导出', /setTimezoneOffsetMinutes/],
  ]) {
    if (!re.test(code)) failures.push(`产物缺少：${label}`);
    stats[`shape:${label}`] = re.test(code);
  }
  if (!/^\s*(?:var|const|let|\()/.test(code) || /\bexport\s*\{/.test(code.slice(0, 400))) {
    warnings.push('产物开头不像 IIFE（请人工确认 format 未被改动）');
  }

  return { failures, warnings, stats };
}

// ---------------------------------------------------------------------------
// 冒烟：在 WebView 语义的 vm 上下文里真跑 6 条路由
// ---------------------------------------------------------------------------

/**
 * 「时钟相关」字段：内核里的 `calculatedAt: new Date().toISOString()`（多处 capabilities）。
 * 这些值与排盘结果无关，但每次调用都不同 → 做 TZ 对拍前必须剔除，否则摘要永远不一致。
 */
const VOLATILE_KEYS = new Set(['calculatedAt', 'generatedAt', 'createdAt', 'timestamp', 'requestId']);

function volatileKeysOf(value, out = []) {
  if (Array.isArray(value)) {
    for (const v of value) volatileKeysOf(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (VOLATILE_KEYS.has(k)) out.push(k);
      else volatileKeysOf(v, out);
    }
  }
  return out;
}

/** 剔除易变字段后的确定性字符串化（键序固定）。 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => !VOLATILE_KEYS.has(k)).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

const SMOKE_CASES = [
  { path: '/ziwei', payload: { birthday: '1990-05-12', time_idx: 7, gender: '男' }, pick: (r) => r.soul_palace },
  { path: '/zodiac', payload: { zodiac: '鼠', year: 2026 }, pick: (r) => r.yearGanZhi },
  {
    path: '/tarot',
    payload: { spreadType: 'single', options: { seed: 20240204 } },
    pick: (r) => (r.cards && r.cards[0] ? r.cards[0].name || r.cards[0].card : undefined),
  },
  {
    path: '/astrology',
    payload: {
      year: 1990, month: 5, day: 12, hour: 10, minute: 30,
      longitude: 116.4, latitude: 39.9, scope: 'natal',
    },
    pick: (r) => (r.natal && r.natal.birth ? r.natal.birth : undefined),
  },
  {
    // fullScope 且**不给 dateStr** → 走 todayDateStr() 的缺省参考日（历史上用设备本地时区取「今天」，
    // 跨零点会整天错位；这里用来证明「今天」也被拉回注入偏移）。
    path: '/astrology',
    payload: {
      year: 1990, month: 5, day: 12, hour: 10, minute: 30,
      longitude: 116.4, latitude: 39.9, scope: 'full',
    },
    pick: (r) => (r.fullScope ? Object.keys(r.fullScope).length : undefined),
  },
  {
    path: '/divination',
    payload: { method: 'qimen', customDate: '2024-02-04 16:30:00' },
    pick: (r) => ({ ju: r.juShu, term: r.currentTerm, dun: r.isYangDun }),
  },
  {
    // 节气交界边界样本：本地 03:00（东八区）——正是「按设备时区构造 nowMs」会分裂结果的位置。
    // 该用例的 stableSha256 应与「未改动的 server.mjs 在 TZ=Asia/Shanghai 下」逐字一致。
    path: '/divination',
    payload: { method: 'qimen', customDate: '2024-02-04 03:00:00' },
    pick: (r) => ({ ju: r.juShu, term: r.currentTerm, dun: r.isYangDun }),
  },
  {
    path: '/divination',
    payload: { method: 'liuyao', customDate: '2024-02-04 16:30:00' },
    pick: (r) => (r.hexagram ? r.hexagram.name || r.hexagram : undefined),
  },
  {
    path: '/divination',
    // 显式给 moment：内核缺 moment 时会注入 `new Date().toISOString()`（不可复现）
    payload: { method: 'ssgw', options: { seed: 20240204, moment: '2024-02-04T08:30:00Z' } },
    pick: (r) => r.signName || r.name || r.sign,
  },
  {
    path: '/extra',
    payload: {
      year: 1990, month: 5, day: 12, hour: 10, minute: 30,
      longitude: 116.4, latitude: 39.9, birthplace: '北京', gender: 'male',
    },
    pick: (r) => ({
      western: r.western ? 1 : 0,
      qizheng: r.qizheng ? 1 : 0,
      wuyun: r.wuyun_liuqi ? 1 : 0,
      qimen: r.qimen_lifetime ? 1 : 0,
    }),
  },
  { path: '/nope', payload: {}, expectError: true },
];

function runSmoke(code, { withWebCrypto }) {
  // 沙箱 = 「浏览器/WebView 语义」而非「Node 语义」：只给 Web 平台 API
  // （timers / console / 可选 Web Crypto），**不给** process / require / Buffer / module /
  // global / setImmediate 等 Node 专有全局——这些一旦被 bundle 用到就会立刻 ReferenceError。
  const pendingTimers = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {}, trace() {} },
    setTimeout: (fn, _ms, ...rest) => { pendingTimers.push(() => fn(...rest)); return pendingTimers.length; },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    queueMicrotask: (fn) => { pendingTimers.push(fn); },
  };
  if (withWebCrypto) {
    // 模拟 WebView：只提供 Web Crypto（不是 node:crypto 模块）
    sandbox.crypto = globalThis.crypto;
  }
  const ctx = vm.createContext(sandbox, { name: 'mingli-webview-sim' });
  // 明确断言上下文里没有 Node 全局
  const probe = vm.runInContext(
    'typeof process + "|" + typeof require + "|" + typeof Buffer + "|" + typeof module'
    + ' + "|" + typeof global + "|" + typeof setImmediate',
    ctx,
  );
  const initErrors = [];
  try {
    vm.runInContext(code, ctx, { filename: 'paipan-bundle.js' });
  } catch (e) {
    // 注意：bundle 是单行 2MB+，e.stack 会把整行打出来 → 只留 name/message
    return { initFailed: true, probe, initError: `${e && e.name}: ${e && e.message}`, rows: [], allOk: false };
  }
  // 排空定时器（模拟 WebView 回到事件循环：宿主下次 evaluateJavascript 前 setTimeout 已触发）
  let guard = 0;
  while (pendingTimers.length && guard++ < 10000) {
    const fn = pendingTimers.shift();
    try {
      fn();
    } catch (e) {
      initErrors.push(String(e && e.message ? e.message : e));
    }
  }

  const api = ctx.__MINGLI_PAIPAN;
  if (!api) throw new Error('bundle 未挂载 globalThis.__MINGLI_PAIPAN');
  if (typeof api.dispatch !== 'function') throw new Error('dispatch 不是函数');
  if (typeof api.setTimezoneOffsetMinutes !== 'function') throw new Error('setTimezoneOffsetMinutes 不是函数');

  const applied = api.setTimezoneOffsetMinutes(480);
  const routes = Array.isArray(api.routes) ? api.routes.slice() : [];

  const rows = [];
  for (const c of SMOKE_CASES) {
    const t0 = Date.now();
    const raw = api.dispatch(c.path, JSON.stringify(c.payload));
    const ms = Date.now() - t0;
    let parsed = null;
    let parseErr = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parseErr = String(e && e.message ? e.message : e);
    }
    const isError = !!(parsed && typeof parsed === 'object' && typeof parsed.error === 'string');
    rows.push({
      path: c.path,
      method: c.payload.method || c.payload.spreadType || '',
      bytes: Buffer.byteLength(raw, 'utf8'),
      ms,
      isError,
      expectError: !!c.expectError,
      ok: parseErr === null && isError === !!c.expectError,
      pick: parseErr === null && !isError && c.pick ? c.pick(parsed) : undefined,
      error: parseErr || (isError ? parsed.error : undefined),
      sha256: createHash('sha256').update(raw).digest('hex').slice(0, 16),
      // 供 TZ 对拍：剔除「时钟相关」字段后的规范摘要（否则每次运行都不同，无法对拍）
      stableSha256: createHash('sha256').update(stableStringify(parsed)).digest('hex').slice(0, 16),
      volatileKeys: volatileKeysOf(parsed),
    });
  }

  return {
    nodeGlobalProbe: probe,
    initErrors,
    tzOffset: applied,
    tzOverrideInstalled: typeof api.isTimezoneOverrideInstalled === 'function'
      ? api.isTimezoneOverrideInstalled() : null,
    routes,
    rows,
    allOk: rows.every((r) => r.ok),
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function humanBytes(n) {
  return `${n.toLocaleString('en-US')} B (${(n / 1048576).toFixed(2)} MiB)`;
}

function dirBytes(dir, filter) {
  if (!existsSync(dir)) return null;
  let total = 0;
  let count = 0;
  for (const f of readdirSync(dir)) {
    if (filter && !filter(f)) continue;
    const st = statSync(path.join(dir, f));
    if (!st.isFile()) continue;
    total += st.size;
    count += 1;
  }
  return { total, count };
}

async function main() {
  const report = { tz: process.env.TZ || '(unset → 系统本地时区)', steps: [] };
  const say = (s) => { if (!AS_JSON) console.log(s); };

  // ---- 0. 输入体检 ----
  if (!existsSync(ADAPTER)) throw new Error(`适配层不存在: ${ADAPTER}`);
  const adapterSrc = readFileSync(ADAPTER, 'utf8');
  const routesMatch = /export const ROUTES = \[([^\]]*)\]/.exec(adapterSrc);
  const declaredRoutes = routesMatch
    ? [...routesMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : [];
  const missingRoutes = CONTRACT_ROUTES.filter((r) => !declaredRoutes.includes(r));
  const extraRoutes = declaredRoutes.filter((r) => !CONTRACT_ROUTES.includes(r));

  // 适配层自身也不许碰 Node 内置（源级检查，比只看产物更早暴露问题）
  const adapterHits = [...adapterSrc.matchAll(/(?:from|require\s*\()\s*["'](?:node:)?([a-z_]+)["']/g)]
    .map((m) => m[1])
    .filter((m) => NODE_BUILTINS.includes(m) || m.startsWith('node:'));

  // ---- 1. 正式打包（已优化）----
  let bundleResult = null;
  if (!SMOKE_ONLY) {
    say('=== [1/5] 打包签名 ===');
    say(`  esbuild          : ${(await import('esbuild')).version}`);
    say(`  node             : ${process.version}`);
    say(`  适配层           : ${ADAPTER}`);
    say(`  产物             : ${OUT_FILE}`);
    say(`  format/platform  : iife / browser（external: []）  minify=${MINIFY}`);

    if (adapterHits.length) {
      report.adapterNodeBuiltins = adapterHits;
      throw new Error(`适配层源码引用了 Node 内置: ${[...new Set(adapterHits)].join(', ')}`);
    }
    if (missingRoutes.length) throw new Error(`适配层缺少契约路由: ${missingRoutes.join(', ')}`);

    say('\n=== [2/5] 优化后打包（astronomia/data → 8 个 vsop87B 子路径）===');
    const t0 = Date.now();
    bundleResult = await buildOnce({ optimizeAstronomia: true, outfile: OUT_FILE });
    say(`  完成，用时 ${Date.now() - t0} ms`);
  }

  if (!existsSync(OUT_FILE)) throw new Error(`产物不存在: ${OUT_FILE}（先不加 --smoke-only 跑一次）`);
  const code = readFileSync(OUT_FILE, 'utf8');
  const outBytes = Buffer.byteLength(code, 'utf8');
  const gzBytes = zlib.gzipSync(Buffer.from(code, 'utf8'), { level: 9 }).length;
  report.artifact = {
    path: path.relative(REPO_DIR, OUT_FILE).replace(/\\/g, '/'),
    bytes: outBytes,
    gzipBytes: gzBytes,
    lines: code.split('\n').length,
  };

  if (!SMOKE_ONLY) {
    const metafile = bundleResult.metafile;
    report.optimized = { bytes: outBytes, gzipBytes: gzBytes, inputs: Object.keys(metafile.inputs).length };
    say(`  产物字节 : ${humanBytes(outBytes)}   gzip ${humanBytes(gzBytes)}`);

    // ---- astronomia 优化前后真实对比（再真打一次未优化基线包）----
    if (!NO_COMPARE) {
      say('\n=== [3/5] 基线打包（不做 astronomia 别名，用于真实前后对比）===');
      const baseFile = path.join(tmpdir(), `paipan-bundle.baseline.${process.pid}.js`);
      try {
        const t1 = Date.now();
        const baseResult = await buildOnce({ optimizeAstronomia: false, outfile: baseFile });
        const baseCode = readFileSync(baseFile, 'utf8');
        const baseBytes = Buffer.byteLength(baseCode, 'utf8');
        const baseGz = zlib.gzipSync(Buffer.from(baseCode, 'utf8'), { level: 9 }).length;
        report.baseline = {
          bytes: baseBytes,
          gzipBytes: baseGz,
          inputs: Object.keys(baseResult.metafile.inputs).length,
        };
        report.astronomiaSaving = {
          bytes: baseBytes - outBytes,
          percent: Number((((baseBytes - outBytes) / baseBytes) * 100).toFixed(1)),
          gzipBytes: baseGz - gzBytes,
        };
        say(`  ✅ 真实实测：未优化 ${humanBytes(baseBytes)} → 优化后 ${humanBytes(outBytes)}`);
        say(`     省下 ${humanBytes(baseBytes - outBytes)}（${report.astronomiaSaving.percent}%）`
          + `；gzip ${baseGz.toLocaleString('en-US')} → ${gzBytes.toLocaleString('en-US')}`
          + `（省 ${(baseGz - gzBytes).toLocaleString('en-US')} B）`);
        say(`     用时 ${Date.now() - t1} ms；基线包已删除（仅取其真实字节数）`);
      } finally {
        rmSync(baseFile, { force: true });
        rmSync(`${baseFile}.map`, { force: true });
      }
    }

    const dataAll = dirBytes(ASTRONOMIA_DATA_DIR);
    const dataVsop = dirBytes(ASTRONOMIA_DATA_DIR, (f) => /^vsop87B.*\.js$/.test(f));
    if (dataAll && dataVsop) {
      report.astronomiaDataDir = {
        allBytes: dataAll.total, allFiles: dataAll.count,
        vsop87BBytes: dataVsop.total, vsop87BFiles: dataVsop.count,
      };
      say(`  参考（源码口径）：astronomia/data 全目录 ${dataAll.total.toLocaleString('en-US')} B`
        + `；8 个 vsop87B* ${dataVsop.total.toLocaleString('en-US')} B`);
    }

    // ---- 自检 ----
    say('\n=== [4/5] 产物自检 ===');
    const check = selfCheck(code, metafile);
    report.selfCheck = check;
    for (const [k, v] of Object.entries(check.stats)) say(`  ${k}: ${JSON.stringify(v)}`);
    for (const w of check.warnings) say(`  ⚠️  ${w}`);
    if (check.failures.length) {
      for (const f of check.failures) say(`  ❌ ${f}`);
      console.error(`\n自检失败（${check.failures.length} 项），产物已写出但**不可用**：${OUT_FILE}`);
      process.exitCode = 1;
      return report;
    }
    say(`  ✅ 零 Node 内置 / 无 require() / 无 process·Buffer·__dirname / astronomia 大表未进包`);
    say(`  ✅ IIFE 形态 + globalThis.__MINGLI_PAIPAN(dispatch, setTimezoneOffsetMinutes) 就位`);
    say(`  路由声明（适配层 ROUTES）：${declaredRoutes.join(' ')}`);
    if (extraRoutes.length) say(`  ⚠️  额外路由：${extraRoutes.join(' ')}`);
  }

  // ---- 冒烟 ----
  if (!NO_SMOKE) {
    if (!SMOKE_ONLY) {
      say('\n=== [5/5] 冒烟：WebView 语义的 vm 上下文里真打 6 条路由 ===');
      say('      （沙箱只给 Web 平台 API：timers / console / 可选 Web Crypto；'
        + '不给 process·require·Buffer·module·global·setImmediate）');
    }
    // 第一轮：不注入 crypto（验证无 Web Crypto 时的兜底分支）
    const bare = runSmoke(code, { withWebCrypto: false });
    // 第二轮：注入 Web Crypto（模拟真实 WebView）
    const webcrypto = runSmoke(code, { withWebCrypto: true });
    report.smoke = { bare, webcrypto };
    if (bare.initFailed || webcrypto.initFailed) {
      const bad = bare.initFailed ? bare : webcrypto;
      console.error(`\n❌ bundle 在 WebView 语义沙箱里执行失败：${bad.initError}`);
      console.error('   （若提到 Node 专有全局，说明产物仍依赖 Node；'
        + '若提到 Web API 缺失，说明沙箱还需补齐该 Web 平台 API）');
      process.exitCode = 1;
      return report;
    }
    if (!AS_JSON) {
      console.log(`      vm 内 Node 全局探针 (process|require|Buffer|module|global|setImmediate) = ${bare.nodeGlobalProbe}`);
      console.log(`      setTimezoneOffsetMinutes(480) → ${webcrypto.tzOffset}，override 已安装 = ${webcrypto.tzOverrideInstalled}`);
      if (webcrypto.initErrors.length) console.log(`      init 期间定时器回调异常 ${webcrypto.initErrors.length} 条（已忽略）`);
      console.log('      path         method      bytes      ms   ok  digest            pick');
      for (const r of webcrypto.rows) {
        console.log(`      ${r.path.padEnd(12)} ${String(r.method).padEnd(10)} `
          + `${String(r.bytes).padStart(8)} ${String(r.ms).padStart(6)}  `
          + `${r.ok ? ' ✅ ' : ' ❌ '} ${r.sha256}  ${JSON.stringify(r.pick ?? r.error ?? '')}`);
      }
      console.log(`      all-ok = ${webcrypto.allOk}`);
    }
    if (!webcrypto.allOk) {
      console.error('\n冒烟失败：上述 ❌ 行的输出不符合契约。');
      process.exitCode = 1;
    }
  }

  if (AS_JSON) {
    // TZ 对拍用：只输出确定性摘要，不含时间/耗时；用 stableSha256（已剔除 calculatedAt 等易变字段）
    console.log(JSON.stringify({
      tzEnv: process.env.TZ || null,
      bytes: outBytes,
      rows: (report.smoke ? report.smoke.webcrypto.rows : []).map((r) => ({
        path: r.path, method: r.method, bytes: r.bytes, isError: r.isError,
        stableSha256: r.stableSha256, unstableSha256: r.sha256,
        volatileKeys: [...new Set(r.volatileKeys || [])].sort(),
        pick: r.pick ?? null, error: r.error ?? null,
      })),
    }));
  }
  return report;
}

main().catch((e) => {
  // bundle 是单行 2MB+，stack 会把整行打出来 → 只保留 message（限长）
  const msg = String((e && e.message) || e);
  console.error(`\n构建失败：${msg.length > 2000 ? msg.slice(0, 2000) + ' …（已截断）' : msg}`);
  process.exitCode = 1;
});
