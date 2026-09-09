#!/usr/bin/env node
/**
 * REQ-128 阶段1 临时审计脚本（不提交，跑完即删）
 * 用 @babel/parser 解析主应用 <script>，按 AST 精确框定「框架层组件」节点，
 * 收集其子树内 StringLiteral / TemplateLiteral 中含 CJK 的「裸中文字符串」。
 * 注释 / 正则字面量 / 对象属性键（含中文键）默认不计。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(fileURLToPath(new URL('./frontend/scripts/precompile.js', import.meta.url)));
const parser = require('@babel/parser');

const html = readFileSync('frontend/public/index.html', 'utf8');
const lines = html.split('\n');
const CJK = /[\u4e00-\u9fff]/;

// 提取主应用 <script>（含 ReactDOM.render 的块）
const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
let appScript = null;
for (const block of m) {
  if (block.includes('ReactDOM.render')) {
    appScript = block.replace(/^<script>\n?/, '').replace(/\n?<\/script>$/, '');
    break;
  }
}
if (!appScript) { console.error('未找到主应用 script'); process.exit(1); }

// 计算 script 内偏移 → 文件行号
const scriptStartOffset = html.indexOf(appScript);
const scriptStartLine = html.slice(0, scriptStartOffset).split('\n').length; // script 内容首行行号（1-based）
function srcLine(offset) {
  const before = appScript.slice(0, offset);
  return scriptStartLine + before.split('\n').length - 1;
}

const ast = parser.parse(appScript, { sourceType: 'script', errorRecovery: false });
const top = ast.program.body;

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const c of node) walk(c, fn); return; }
  fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'comments') continue;
    const v = node[k];
    if (v && typeof v === 'object') walk(v, fn);
  }
}

const FRAMEWORK = [
  'api', 'DisclaimerFooter', 'SkinSwitcher', 'LandingPage', 'CreditBalance',
  'BannerBalance', 'payBadge', 'MenuBalance', 'AuthPage', 'NavRail',
  'TopbarModNav', 'TopbarMenu', 'GuoxueHubPage', 'XishiHubPage', 'MbtiHubPage',
  'startRechargePoll', 'resumePendingRechargePoll', 'startRecharge'
];
const CLASSES = ['ErrorBoundary'];
const CONSTS = ['RAIL_MODS', 'MOD_NAV_GROUPS'];

const nodes = [];
for (const stmt of top) {
  if (stmt.type === 'FunctionDeclaration' && FRAMEWORK.includes(stmt.id && stmt.id.name)) nodes.push(stmt);
  if (stmt.type === 'ClassDeclaration' && CLASSES.includes(stmt.id && stmt.id.name)) nodes.push(stmt);
  if (stmt.type === 'VariableDeclaration') {
    for (const d of stmt.declarations) {
      if (d.id && d.id.type === 'Identifier' && CONSTS.includes(d.id.name)) nodes.push(d);
    }
  }
}
nodes.sort((a, b) => a.start - b.start);

let total = 0;
for (const node of nodes) {
  const label = (node.type === 'VariableDeclaration' ? 'const ' : node.type === 'ClassDeclaration' ? 'class ' : 'function ') + (node.id ? node.id.name : (node.declarations ? node.declarations[0].id.name : '?'));
  const hits = [];
  walk(node, (n) => {
    if (n.type === 'StringLiteral') { if (CJK.test(n.value)) hits.push({ line: srcLine(n.start), val: n.value, q: 'str' }); return; }
    if (n.type === 'TemplateLiteral') {
      const joined = n.quasis.map(q => q.value.cooked).join('');
      if (CJK.test(joined)) hits.push({ line: srcLine(n.start), val: joined, q: 'tpl' });
    }
  });
  total += hits.length;
  console.log('\n===== ' + label + '  (L' + srcLine(node.start) + '–' + srcLine(node.end) + ')  中文串 ' + hits.length + ' =====');
  for (const h of hits) console.log('  L' + h.line + ': ' + JSON.stringify(h.val));
}
console.log('\n========== 合计框架层裸中文字符串: ' + total + ' ==========');
