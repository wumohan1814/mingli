/**
 * 命理 · 排盘内核依赖扫描（节148 交付物 · tools/scan-deps.mjs）
 * ---------------------------------------------------------------------------
 * 作用：扫描「旧实现包名」的残留命中，回答两个问题：
 *   ① server.mjs 里还有多少处待在后续节（149–157）勾销的旧实现 import？
 *   ② 自研内核目录 paipan-core/ 里是否已经彻底不依赖旧实现？（门禁：必须 0）
 *
 * 扫描范围（可执行、可指出排除项 —— 见破竹协议铁律 4）：
 *   - 包含：backend/paipan-node/server.mjs、backend/paipan-node/paipan-core/**（递归）
 *   - 排除（逐条指名）：
 *       · paipan-core/**\/node_modules/**            —— 第三方依赖本体，不是我们的代码
 *       · paipan-core/tools/scan-deps.mjs            —— **本文件自己**：它必须写出被搜索的词才能搜索
 *       · paipan-core/**\/*.md                       —— 文档：说明「对拍要加载旧实现」不算代码依赖，
 *                                                       文档命中只做信息性统计，不进 0 门禁
 *       · paipan-core/tools/fixtures/*.json 之类    —— 不排除（夹具与 golden 都必须是纯数据、零旧包名）
 *
 * 输出：`文件:行号: 原文`；再输出两个统计（server 待勾销清单 / paipan-core 命中数）。
 * 退出码：paipan-core 命中数 ≠ 0 → 1；否则 0。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));      // …/paipan-core/tools
const CORE_ROOT = path.resolve(HERE, '..');                     // …/paipan-core
const PAIPAN_NODE_ROOT = path.resolve(CORE_ROOT, '..');         // …/backend/paipan-node
const SERVER_FILE = path.join(PAIPAN_NODE_ROOT, 'server.mjs');

/** 被搜索的旧实现包名（大小写不敏感）。 */
const NEEDLE = /mingyu/i;

/** 本文件自身（必须排除，理由见文件头）。 */
const SELF = fileURLToPath(import.meta.url);

/** 文档类扩展名（信息性统计，不进 0 门禁）。 */
const DOC_EXT = new Set(['.md']);

/** 遍历目录，收集文件（排除 node_modules）。 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/** 在一批文件里找命中行。 */
function scanFiles(files, { excludeSelf = false } = {}) {
  const hits = [];
  for (const file of files) {
    if (excludeSelf && path.resolve(file) === path.resolve(SELF)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (NEEDLE.test(lines[i])) {
        hits.push({ file: path.relative(PAIPAN_NODE_ROOT, file), line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return hits;
}

const rel = (p) => path.relative(PAIPAN_NODE_ROOT, p).replace(/\\/g, '/');

console.log('=== 命理 · 排盘内核依赖扫描（旧实现包名残留） ===');
console.log(`扫描目标：${rel(SERVER_FILE)}、${rel(CORE_ROOT)}/**`);
console.log('排除项：paipan-core/**/node_modules/**、paipan-core/tools/scan-deps.mjs（本文件自身）、paipan-core/**/*.md（文档，仅信息性统计）');
console.log('');

if (!fs.existsSync(SERVER_FILE)) {
  console.error(`[错误] server.mjs 不存在: ${SERVER_FILE}`);
  process.exitCode = 2;
} else {
  const serverHits = scanFiles([SERVER_FILE]);
  console.log(`--- server.mjs：命中 ${serverHits.length} 行 ---`);
  for (const hit of serverHits) console.log(`${hit.file}:${hit.line}: ${hit.text}`);
  const importHits = serverHits.filter((h) => /^\s*import\s/.test(h.text) || /\bfrom\s+['"]/.test(h.text));
  console.log('');

  const coreFiles = walk(CORE_ROOT).filter((f) => path.extname(f).toLowerCase() !== '.md');
  const coreDocFiles = walk(CORE_ROOT).filter((f) => path.extname(f).toLowerCase() === '.md');
  const coreHits = scanFiles(coreFiles, { excludeSelf: true });
  const coreDocHits = scanFiles(coreDocFiles, { excludeSelf: true });

  console.log(`--- paipan-core：命中 ${coreHits.length} 行（门禁：必须 0）---`);
  for (const hit of coreHits) console.log(`${hit.file}:${hit.line}: ${hit.text}`);
  console.log('');

  if (coreDocHits.length) {
    console.log(`--- 信息性：paipan-core 文档（*.md）命中 ${coreDocHits.length} 行（文档说明不算代码依赖）---`);
    for (const hit of coreDocHits) console.log(`${hit.file}:${hit.line}: ${hit.text}`);
    console.log('');
  }

  console.log('=== 统计 ===');
  console.log(`server.mjs 旧实现 import 数（待勾销清单）：${importHits.length}`);
  for (const hit of importHits) console.log(`  · 待勾销  ${hit.file}:${hit.line}`);
  console.log(`paipan-core 命中数（门禁）：${coreHits.length}  ${coreHits.length === 0 ? 'OK' : 'FAILED'}`);
  console.log(`paipan-core 已扫描文件数：${coreFiles.length}（排除 node_modules 与本文件自身）`);
  console.log('');
  console.log(`RESULT: ${coreHits.length === 0 ? 'PASSED' : 'FAILED'}`);
  process.exitCode = coreHits.length === 0 ? 0 : 1;
}
