#!/usr/bin/env node
/**
 * precompile.js — 一次性/可复跑构建脚本
 *
 * 把 frontend/public/index.html 与 admin.html 中 `<script type="text/babel">` 的 JSX
 * 预编译成普通 JS（用 @babel/core + @babel/preset-react，runtime classic，
 * 产物引用全局 React / ReactDOM，浏览器端不再需要 Babel Standalone）：
 *   1) 移除加载 babel.min.js 的 <script src> 行；
 *   2) 逐个把 type="text/babel" 块编译成普通 JS 并改写为无 type 的 <script>。
 *
 * 另含一道守卫（先于上述编译执行）：
 *   0) 扫描 frontend/public/js/*.js —— 拆出的 .js 只允许放「已预编译的普通 JS」，
 *      不得再写 JSX；用 @babel/core 的默认解析器（不含 jsx 插件）逐个解析，
 *      任一失败即报错并 exit(1)（防止 JSX 逃过门禁、留到浏览器端静默失效）。
 *
 * 原地覆盖 HTML（UTF-8）。不写 package.json、不改 vendor。
 * 用法：node frontend/scripts/precompile.js
 */
import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transformSync } from '@babel/core';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['public/index.html', 'public/admin.html'];

const BABEL_SRC_RE = /<script\b([^>]*)\btype\s*=\s*["']text\/babel["']([^>]*)>([\s\S]*?)<\/script>/gi;
// 匹配任何引用 babel.min.js 的 script 标签（含 src 上的 ./vendor/ 或其它路径、属性顺序不定）
const BABEL_LOADER_RE = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*babel\.min\.js["'][^>]*>\s*<\/script>\s*/gi;

function stats(file) {
  const s = statSync(file);
  const text = readFileSync(file, 'utf8');
  return { lines: text.split('\n').length, bytes: s.size, chars: text.length };
}

function fmtDiff(label, before, after) {
  console.log(`  ${label}: ${before} -> ${after} (${after - before >= 0 ? '+' : ''}${after - before})`);
}

// 拆出的 .js 只允许放「已预编译的普通 JS」：用默认解析器（不含 jsx 插件）解析，
// 含 JSX 或语法错误即抛错。防止 JSX 逃过门禁（门禁只编译 HTML 内联块）而静默失效。
const JS_DIR = 'public/js';

function checkJsDirForJsx() {
  const dir = join(ROOT, JS_DIR);
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.js')).sort();
  } catch {
    // js/ 目录不存在（拆分之前的旧状态）→ 无守卫对象，跳过
    return;
  }
  const failures = [];
  for (const name of names) {
    const code = readFileSync(join(dir, name), 'utf8');
    try {
      transformSync(code, {
        presets: [],
        configFile: false,
        babelrc: false,
        ast: false,
        sourceType: 'unambiguous',
      });
    } catch (e) {
      const reason = String((e && e.message) || e).split('\n')[0];
      failures.push({ name, reason });
    }
  }
  if (failures.length) {
    console.error(`\n✗ 发现 ${failures.length} 个 js/ 文件含 JSX 或语法错误（拆出的 .js 只允许放已预编译的普通 JS）：`);
    for (const f of failures) console.error(`  - ${JS_DIR}/${f.name}：${f.reason}`);
    process.exit(1);
  }
  console.log(`✓ ${JS_DIR}/（${names.length} 个文件）均为已预编译的普通 JS`);
}

// 节136 阶段A：硬编码色值基线门禁。
// 现存散色（pages.css / components.css / js/views-*.js / 两个 HTML 内联样式）登记在
// scripts/hardcode-baseline.json；门禁只拦「比基线多」——阶段 B 每回收一批散色，
// 用 `node frontend/scripts/precompile.js --update-hardcode-baseline` 缩小基线，
// 直到归零。tokens.css 是令牌定义处，整文件豁免。
const HARDCODE_BASELINE = join(ROOT, 'scripts', 'hardcode-baseline.json');
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/g;
// 基线键统一用 POSIX 正斜杠，保证 Windows / Linux 结果一致
const normKey = (rel) => rel.replaceAll('\\', '/');

function hardcodeScanTargets() {
  const list = [];
  for (const dir of [join('public', 'css'), join('public', 'js')]) {
    try {
      for (const n of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.css') || x.endsWith('.js')).sort()) {
        if (dir.endsWith('css') && n === 'tokens.css') continue; // 令牌定义处豁免
        list.push(join(dir, n));
      }
    } catch { /* 目录不存在则跳过 */ }
  }
  for (const html of ['public/index.html', 'public/admin.html']) list.push(html);
  return list;
}

function scanColorLiterals(rel) {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  const hits = [];
  lines.forEach((text, i) => {
    const m = text.match(COLOR_LITERAL_RE);
    if (m) hits.push({ line: i + 1, count: m.length });
  });
  return { count: hits.reduce((s, h) => s + h.count, 0), hits };
}

function measureHardcode() {
  const measured = {};
  for (const rel of hardcodeScanTargets()) {
    if (!existsSync(join(ROOT, rel))) continue;
    const { count } = scanColorLiterals(rel);
    if (count > 0) measured[normKey(rel)] = count;
  }
  return measured;
}

function runHardcodeBaseline(update) {
  const measured = measureHardcode();
  if (update) {
    writeFileSync(HARDCODE_BASELINE, JSON.stringify(measured, null, 2) + '\n', 'utf8');
    console.log(`✓ 已更新硬编码色值基线 scripts/hardcode-baseline.json（${Object.keys(measured).length} 个文件有散色）`);
    return;
  }
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(HARDCODE_BASELINE, 'utf8'));
  } catch {
    console.error('✗ 缺少散色基线 scripts/hardcode-baseline.json：先运行 --update-hardcode-baseline 生成。');
    process.exit(1);
  }
  const failures = [];
  for (const [rel, now] of Object.entries(measured)) {
    const before = baseline[rel] || 0;
    if (now > before) {
      const osRel = join(...rel.split('/')); // 转回平台相对路径，scanColorLiterals 内部再接 ROOT
      failures.push({ rel, before, now, hits: scanColorLiterals(osRel).hits });
    }
  }
  if (failures.length) {
    console.error('\n✗ 发现新增硬编码色值（节136：色值只能进 css/tokens.css；见 standards/04）：');
    for (const f of failures) {
      console.error(`  - ${f.rel}：基线 ${f.before} → 现 ${f.now}（+${f.now - f.before}），命中行（前 8 条）：`);
      for (const h of f.hits.slice(0, 8)) console.error(`      L${h.line}（${h.count} 处）`);
    }
    console.error('  如确属正当新增（如新语义令牌），请改入 tokens.css；不要自行调大基线。');
    process.exit(1);
  }
  const reduced = Object.entries(baseline)
    .filter(([rel, n]) => (measured[rel] || 0) < n)
    .map(([rel, n]) => `${rel} ${n}→${measured[rel] || 0}`);
  const total = Object.values(measured).reduce((s, n) => s + n, 0);
  console.log(`✓ 硬编码色值基线门禁通过（现存 ${total} 处散色，只许减不许增）${reduced.length ? `；可更新基线：${reduced.join('；')}` : ''}`);
}

if (process.argv.includes('--update-hardcode-baseline')) {
  runHardcodeBaseline(true);
  process.exit(0);
}

// 守卫先于 HTML 编译：js/ 有问题时直接退出，不改动任何 HTML
checkJsDirForJsx();
// 节136 阶段A：散色基线门禁，同样先于 HTML 编译
runHardcodeBaseline(false);

let anyError = false;

for (const rel of FILES) {
  const file = join(ROOT, rel);
  const before = stats(file);
  const html = readFileSync(file, 'utf8');
  let out = html;

  // 1) 移除 babel.min.js 加载行
  const removedLoaders = (html.match(BABEL_LOADER_RE) || []).length;
  out = out.replace(BABEL_LOADER_RE, '');

  // 2) 逐个编译 text/babel 块
  let blockIndex = 0;
  const errors = [];
  out = out.replace(BABEL_SRC_RE, (whole, attrsBefore, attrsAfter, code) => {
    blockIndex += 1;
    let result;
    try {
      result = transformSync(code, {
        presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
        filename: `${rel}#block${blockIndex}.jsx`,
        babelrc: false,
        configFile: false,
        sourceMaps: false,
        ast: false,
        comments: true,
      });
    } catch (e) {
      errors.push(`[${rel}] text/babel 块 #${blockIndex} 编译失败：\n${e.message}`);
      // 出错时不改动该块（保持原样返回，防止破坏 HTML）
      return whole;
    }
    if (!result || typeof result.code !== 'string' || !result.code.trim()) {
      errors.push(`[${rel}] text/babel 块 #${blockIndex} 编译结果为空`);
      return whole;
    }
    const compiled = result.code.replace(/\s+$/, '');
    // 丢弃原属性中可能残留的 type 之外属性由 attrsBefore/attrsAfter 保留；此处统一输出无 type 的 <script>
    const extra = (attrsBefore + ' ' + attrsAfter).trim();
    const open = '<script' + (extra ? ' ' + extra : '') + '>';
    return `${open}\n${compiled}\n  </script>`;
  });

  if (errors.length) {
    anyError = true;
    console.error(`\n✗ ${rel}：有 ${errors.length} 个块编译失败，文件未写入（保持原样）。`);
    for (const e of errors) console.error(e + '\n');
    continue;
  }

  writeFileSync(file, out, 'utf8');
  const after = stats(file);
  console.log(`✓ ${rel}`);
  console.log(`  行数:  ${before.lines} -> ${after.lines}`);
  console.log(`  体积:  ${before.bytes} B -> ${after.bytes} B (${(after.bytes / 1024).toFixed(1)} KB)`);
  console.log(`  字符:  ${before.chars} -> ${after.chars}`);
  console.log(`  编译块数: ${blockIndex}，移除 babel.min.js 加载: ${removedLoaders} 处`);
}

if (anyError) {
  console.error('\n存在编译错误，未做任何覆盖写入。请先修复后重跑。');
  process.exit(1);
}
console.log('\n完成：两个 HTML 已原地覆盖为预编译版本（UTF-8）。');
