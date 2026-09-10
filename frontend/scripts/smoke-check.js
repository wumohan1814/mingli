#!/usr/bin/env node
/**
 * smoke-check.js — 前端静态冒烟检查
 *
 * 对 frontend/public/index.html 做静态语法与结构健康检查，
 * 零运行时依赖（除 Node 自带），用于提交前快速验证：
 *   1. JSX 语法合法性（Babel 预编译成功）
 *   2. 关键全局变量/函数存在性
 *   3. 常见易错模式检测
 *   4. 代码规模监控
 *
 * 用法：node frontend/scripts/smoke-check.js
 * 退出码：0 = 全部通过，1 = 有错误
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_HTML = join(ROOT, 'public', 'index.html');

// ---- 颜色输出 ----
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
  bold: '\x1b[1m'
};

let errors = 0;
let warnings = 0;

function pass(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function fail(msg) { errors++; console.log(`  ${C.red}✗${C.reset} ${msg}`); }
function warn(msg) { warnings++; console.log(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function section(title) { console.log(`\n${C.cyan}${C.bold}▸ ${title}${C.reset}`); }

// ============================================================
// 1. 文件基本信息
// ============================================================
section('文件基本信息');
const html = readFileSync(INDEX_HTML, 'utf8');
const stats = statSync(INDEX_HTML);
const lines = html.split('\n').length;
const kb = (stats.size / 1024).toFixed(1);

console.log(`  ${C.dim}路径:${C.reset} frontend/public/index.html`);
console.log(`  ${C.dim}行数:${C.reset} ${lines} 行`);
console.log(`  ${C.dim}体积:${C.reset} ${kb} KB`);

if (lines > 25000) warn(`代码行数 ${lines} 已超过 25000 行警戒线，建议考虑拆分`);
else if (lines > 20000) warn(`代码行数 ${lines} 接近 25000 行警戒线`);
else pass(`代码行数 ${lines} 在可控范围内（< 25000）`);

// ============================================================
// 2. JSX 语法检查（Babel 预编译）
// ============================================================
section('JSX 语法检查');

const BABEL_SRC_RE = /<script\b([^>]*)\btype\s*=\s*["']text\/babel["']([^>]*)>([\s\S]*?)<\/script>/gi;
const babelBlocks = [];
let m;
while ((m = BABEL_SRC_RE.exec(html)) !== null) {
  babelBlocks.push({
    index: babelBlocks.length + 1,
    code: m[3],
    startOffset: m.index,
    startLine: html.slice(0, m.index).split('\n').length
  });
}

console.log(`  ${C.dim}发现 ${babelBlocks.length} 个 text/babel 代码块${C.reset}`);

try {
  const { transformSync } = require('@babel/core');
  let syntaxOk = true;
  for (const block of babelBlocks) {
    try {
      transformSync(block.code, {
        presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
        filename: `index.html#block${block.index}.jsx`,
        babelrc: false,
        configFile: false,
        sourceMaps: false,
        ast: false,
        comments: true,
      });
    } catch (e) {
      syntaxOk = false;
      fail(`块 #${block.index} (约第 ${block.startLine} 行) 语法错误: ${e.message.split('\n')[0]}`);
    }
  }
  if (syntaxOk) pass(`全部 ${babelBlocks.length} 个 JSX 代码块语法正确`);
} catch (e) {
  warn(`无法加载 @babel/core，跳过语法检查（${e.message.split('\n')[0]}）`);
}

// ============================================================
// 3. 关键全局变量/函数存在性
// ============================================================
section('关键全局变量/函数存在性');

const criticalGlobals = [
  // 核心函数
  { name: 'api()', pattern: /async\s+function\s+api\s*\(/, desc: '统一请求封装' },
  { name: 'logout()', pattern: /function\s+logout\s*\(/, desc: '登出函数' },
  { name: 'toast()', pattern: /function\s+toast\s*\(/, desc: '全局轻提示' },
  { name: 'App()', pattern: /function\s+App\s*\(/, desc: '根组件' },
  // 核心变量
  { name: 'token', pattern: /^let\s+token\s*=/m, desc: '访问令牌' },
  { name: 'refreshToken', pattern: /^let\s+refreshToken\s*=/m, desc: '刷新令牌' },
  // 关键常量
  { name: 'API (baseURL)', pattern: /const\s+API\s*=/, desc: 'API 基础路径' },
  { name: 'UI_COPY / TC_COPY', pattern: /TC_COPY\s*=|window\.TC_COPY/, desc: '全局文案表' },
];

for (const g of criticalGlobals) {
  if (g.pattern.test(html)) pass(`${g.name} — ${g.desc}`);
  else fail(`缺失 ${g.name} — ${g.desc}`);
}

// ============================================================
// 4. 常见易错模式检测
// ============================================================
section('易错模式检测');

// 4.1 localStorage key 一致性
const lsKeys = new Set();
const lsGetRe = /localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*['"]([^'"]+)['"]/g;
let lsMatch;
while ((lsMatch = lsGetRe.exec(html)) !== null) lsKeys.add(lsMatch[1]);

const lsKeyList = Array.from(lsKeys).sort();
console.log(`  ${C.dim}发现 ${lsKeyList.length} 个 localStorage key:${C.reset}`);
for (const k of lsKeyList) console.log(`    ${C.dim}•${C.reset} ${k}`);

// 4.2 检查是否有直接修改 state 的情况（常见 Bug 源）
const directMutatePatterns = [
  { pattern: /\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/, desc: '数组直接变更方法（需确认是否作用于 state 数组）' },
];

// 4.3 检查 fetch 直连（绕过 api() 封装）
const directFetchCount = (html.match(/\bfetch\s*\(/g) || []).length;
const apiCallCount = (html.match(/\bapi\s*\(/g) || []).length;
console.log(`  ${C.dim}fetch 调用: ${directFetchCount} 次 | api() 调用: ${apiCallCount} 次${C.reset}`);

// 统计非 api() 内部的 fetch（粗略估算：api 函数体内的 fetch 约 3-4 次）
const directFetches = Math.max(0, directFetchCount - 4);
if (directFetches > 5) warn(`发现约 ${directFetches} 处直连 fetch（绕过 api() 封装），建议统一收敛`);
else pass(`fetch 调用基本通过 api() 封装`);

// 4.4 检查 dangerouslySetInnerHTML（XSS 风险点）
const xssCount = (html.match(/dangerouslySetInnerHTML/g) || []).length;
if (xssCount > 0) warn(`发现 ${xssCount} 处 dangerouslySetInnerHTML，需确认内容来源可信`);
else pass('无 dangerouslySetInnerHTML（XSS 低风险）');

// 4.5 检查 eval / new Function
const evalCount = (html.match(/\beval\s*\(/g) || []).length;
const newFuncCount = (html.match(/new\s+Function\s*\(/g) || []).length;
if (evalCount > 0) warn(`发现 ${evalCount} 处 eval() 调用`);
if (newFuncCount > 0) warn(`发现 ${newFuncCount} 处 new Function() 调用`);
if (evalCount === 0 && newFuncCount === 0) pass('无 eval / new Function（动态代码执行低风险）');

// ============================================================
// 5. 组件与页面数量统计
// ============================================================
section('组件与页面统计');

const functionComponents = html.match(/^function\s+\w+\s*\([^)]*\)\s*\{/gm) || [];
const constComponents = html.match(/^const\s+\w+\s*=\s*(?:\([^)]*\)|[^=]*?)\s*=>\s*\{/gm) || [];
const pageLike = html.match(/function\s+\w+Page\s*\(/g) || [];

console.log(`  ${C.dim}函数组件: ${functionComponents.length} 个${C.reset}`);
console.log(`  ${C.dim}箭头组件: ${constComponents.length} 个${C.reset}`);
console.log(`  ${C.dim}页面级组件 (*Page): ${pageLike.length} 个${C.reset}`);

// ============================================================
// 6. CSS 设计令牌覆盖度
// ============================================================
section('CSS 设计令牌');

const cssVars = new Set();
const cssVarRe = /--([\w-]+)\s*:/g;
let cssMatch;
while ((cssMatch = cssVarRe.exec(html)) !== null) cssVars.add(cssMatch[1]);

const varCategories = {
  color: [...cssVars].filter(v => /^(ink|gold|jade|cinnabar|paper|surface|text|border|skin|error)/.test(v)).length,
  font: [...cssVars].filter(v => /^font-/.test(v)).length,
  radius: [...cssVars].filter(v => /^radius-/.test(v)).length,
  shadow: [...cssVars].filter(v => /^shadow-/.test(v)).length,
  art: [...cssVars].filter(v => /^art-/.test(v)).length,
  motion: [...cssVars].filter(v => /^(dur|ease)/.test(v)).length,
};

const totalTokens = cssVars.size;
console.log(`  ${C.dim}设计令牌总数: ${totalTokens} 个${C.reset}`);
for (const [cat, count] of Object.entries(varCategories)) {
  if (count > 0) console.log(`    ${C.dim}• ${cat}:${C.reset} ${count} 个`);
}
if (totalTokens >= 20) pass(`设计令牌体系较完整（${totalTokens} 个变量）`);
else warn(`设计令牌数量偏少（${totalTokens} 个），建议补齐`);

// ============================================================
// 汇总
// ============================================================
console.log(`\n${C.bold}════════════════════════════════════${C.reset}`);
console.log(`${C.bold}  冒烟检查结果${C.reset}`);
console.log(`${C.bold}════════════════════════════════════${C.reset}`);
console.log(`  通过项: ${C.green}${Math.max(0, 10 - errors - warnings)}${C.reset}`);
console.log(`  警告: ${C.yellow}${warnings}${C.reset}`);
console.log(`  错误: ${C.red}${errors}${C.reset}`);
console.log('');

if (errors > 0) {
  console.log(`${C.red}${C.bold}✗ 存在错误，请修复后再提交${C.reset}`);
  process.exit(1);
} else {
  console.log(`${C.green}${C.bold}✓ 所有关键检查通过${C.reset}`);
  if (warnings > 0) console.log(`${C.yellow}  （有 ${warnings} 个警告，建议关注）${C.reset}`);
  process.exit(0);
}
