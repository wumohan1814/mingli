#!/usr/bin/env node
/** REQ-128 阶段1 临时校验（不提交）：index.html 内所有 TC_COPY.* 引用均能在 ui-copy.js 解析；且 UI_COPY 仅剩别名定义 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(fileURLToPath(new URL('./frontend/scripts/precompile.js', import.meta.url)));
const parser = require('@babel/parser');

const html = readFileSync('frontend/public/index.html', 'utf8');

// 1) 载入数据文件
const src = readFileSync('frontend/public/data/ui-copy.js', 'utf8');
const w = {};
new Function('window', src)(w);
const TC = w.TC_COPY;

// 2) 提取主应用 script
const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
let appScript = null;
for (const block of m) {
  if (block.includes('ReactDOM.render')) { appScript = block.replace(/^<script[^>]*>\n?/, '').replace(/\n?<\/script>$/, ''); break; }
}
if (!appScript) { console.error('未找到主应用 script'); process.exit(1); }

// 3) 解析并遍历 TC_COPY.* 引用
const ast = parser.parse(appScript, { sourceType: 'script' });
let refs = 0;
let missing = [];
function resolve(node) {
  // 把 TC_COPY.x.y['z'] 展开为路径数组
  const segs = [];
  let cur = node;
  while (cur && cur.type === 'MemberExpression') {
    let key = null;
    if (cur.property.type === 'Identifier') key = cur.property.name;
    else if (cur.property.type === 'StringLiteral') key = cur.property.value;
    else { segs.push('??'); }
    segs.unshift(key);
    cur = cur.object;
  }
  if (cur && cur.type === 'Identifier' && cur.name === 'TC_COPY') return segs;
  return null;
}
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const c of node) walk(c); return; }
  if (node.type === 'MemberExpression') {
    const segs = resolve(node);
    if (segs) {
      refs++;
      let obj = TC;
      for (const s of segs) {
        if (obj == null || !(s in obj)) { missing.push(segs.join('.')); return; }
        obj = obj[s];
      }
    }
  }
  for (const k of Object.keys(node)) {
    if (['loc', 'start', 'end', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments'].includes(k)) continue;
    const v = node[k];
    if (v && typeof v === 'object') walk(v);
  }
}
walk(ast.program);

// 4) UI_COPY 别名检查：全文件只允许一处定义且为别名
const aliasDefs = html.match(/const UI_COPY\s*=\s*[^;]+;/g) || [];
const uiCopyRefs = (html.match(/UI_COPY\./g) || []).length;

console.log('TC_COPY 引用总数:', refs);
console.log('缺失 key:', missing.length ? missing : '无');
if (missing.length) { console.error('\n✗ 存在无法解析的 TC_COPY key'); process.exit(1); }
console.log('UI_COPY 定义出现次数:', aliasDefs.length, '→', JSON.stringify(aliasDefs.map(s => s.trim().slice(0, 60))));
console.log('UI_COPY.xxx 引用总数（应走别名）:', uiCopyRefs);
console.log('\n✓ TC_COPY key 完整性校验通过');
