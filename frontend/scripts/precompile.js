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
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
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

// 守卫先于 HTML 编译：js/ 有问题时直接退出，不改动任何 HTML
checkJsDirForJsx();

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
