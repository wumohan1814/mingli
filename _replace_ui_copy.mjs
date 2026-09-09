#!/usr/bin/env node
/** REQ-128 阶段1 临时脚本（不提交）：把 index.html 内联 UI_COPY 对象整体替换为兼容别名 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'frontend/public/index.html';
let t = readFileSync(path, 'utf8');
const EOL = t.includes('\r\n') ? '\r\n' : '\n';

const startMark = '// ===== B1 全站 UI 文案常量（REQ-037）=====';
const endMark = "const API = '/api';";
const s = t.indexOf(startMark);
const e = t.indexOf(endMark);
if (s < 0 || e < 0 || e <= s) { console.error('标记未找到 s=' + s + ' e=' + e); process.exit(1); }

const alias = [
  '// ===== B1 全站 UI 文案常量（REQ-037）→ REQ-128 阶段1：全站界面文案总表 TC_COPY =====',
  '// 文案总表已迁至独立数据文件 frontend/public/data/ui-copy.js（window.TC_COPY，key 规范见',
  '// docs/standards/01-命名与变量约定.md §12：ui.<模块>.<动作|状态>，小写+连字符）。',
  '// 说明：既有 190+ 处 UI_COPY.xxx 引用（各模块页/内容页）保留原名继续可用 —— 本行以兼容',
  '// 别名指向 TC_COPY.ui（同一文案源，零改写零回归）；框架层页面（落地/登录注册/三 Hub/',
  '// Banner/菜单/页脚/通用）已直引 TC_COPY.ui.* 规范路径。',
  'const UI_COPY = TC_COPY.ui;'
].join(EOL);

const out = t.slice(0, s) + alias + EOL + t.slice(e);
writeFileSync(path, out, 'utf8');
console.log('done: replaced UI_COPY object with alias (removed', t.slice(s, e).split(EOL).length, 'lines)');
