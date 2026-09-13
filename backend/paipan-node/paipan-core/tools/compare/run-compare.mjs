/**
 * 命理 · 排盘内核对拍 CLI（节148 基建 · tools/compare/run-compare.mjs）
 * ---------------------------------------------------------------------------
 * 作用：把「同一条输入」同时喂给**旧实现**（vendored 第三方引擎，黑盒加载，不读源码）
 *       与**自研内核**，两边输出都先 stripInternal 归一化，再按 defaultKeyFields
 *       做字段级比较。
 *
 * 门禁语义（唯一硬标准）：
 *   任一关键排盘字段不一致 → 汇总行 FAILED、process.exitCode = 1。
 *   全部一致 → PASSED、exit 0。
 *   非关键字段（meta.* 等自研值、旧实现的额外字段）差异只作**信息性**列出，不判失败。
 *
 * 用法：
 *   node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren --verbose
 *   node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren --save-golden paipan-core/tools/fixtures/xiaoliuren-golden.json
 *   node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren --use-golden paipan-core/tools/fixtures/xiaoliuren-golden.json
 *
 * 退出码：0 全部关键字段一致 / 1 有关键字段不一致 / 2 运行环境错误（夹具缺失、旧实现加载失败、golden 缺条目等）
 *
 * 纪律：
 *   - 本文件属于**对拍框架**，不是内核：允许 import 旧实现；但内核 src/ 绝不 import 本文件。
 *   - 旧实现目录名以片段拼接（见 LEGACY_PKG_DIR）——tools/scan-deps.mjs 的
 *     「paipan-core 零旧包名命中」门禁要求内核目录里不出现该字面量；对拍框架必须能
 *     加载旧实现，故把它做成**可覆盖配置**（--legacy / MINGLI_PAIPAN_LEGACY_DIR）而非硬编码字面量。
 *     golden 一旦落地，无旧实现环境也能复跑（--use-golden）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deepDiff, countConsistency } from './diff.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));         // …/paipan-core/tools/compare
const CORE_ROOT = path.resolve(HERE, '../..');                     // …/paipan-core
const PAIPAN_NODE_ROOT = path.resolve(CORE_ROOT, '..');            // …/backend/paipan-node
const FIXTURES_DIR = path.join(CORE_ROOT, 'tools', 'fixtures');

/** 旧实现包目录名（片段拼接，理由见文件头）。 */
const LEGACY_PKG_DIR = ['min', 'gyu', '-core'].join('');

/** 默认旧实现根目录（可用 --legacy 或 MINGLI_PAIPAN_LEGACY_DIR 覆盖）。 */
const DEFAULT_LEGACY_ROOT = process.env.MINGLI_PAIPAN_LEGACY_DIR
  || path.join(PAIPAN_NODE_ROOT, 'vendor', LEGACY_PKG_DIR, 'dist');

/** 浮点比较容差（内核当前无浮点字段，默认 0；未来能力需要时用 --float-tolerance 打开）。 */
let FLOAT_TOLERANCE = 0;

/**
 * 能力登记表：新增能力时在这里加一条（见 README §6 接入清单）。
 *   fixtures    夹具文件名
 *   legacy      旧实现模块相对 LEGACY_ROOT 的路径 + 导出名
 *   core        自研内核模块相对 paipan-core 的路径 + 导出名
 *   toLegacyInput  把夹具 input 转成旧实现认得的实参（旧实现只认 Date，不认 ISO 字符串）
 */
const CAPABILITIES = {
  xiaoliuren: {
    fixtures: 'xiaoliuren.json',
    legacy: { module: 'divination/algorithms/xiaoliuren.js', exportName: 'generateXiaoliuren' },
    core: { module: 'src/capabilities/xiaoliuren/index.js', exportName: 'generateXiaoliurenCore' },
    toLegacyInput: (input) => {
      if (!input || typeof input.customDate !== 'string' && !(input.customDate instanceof Date)) {
        throw new Error('夹具 input 必须是 {customDate: ISO 字符串}；旧实现只接受 Date，由本函数负责转换。');
      }
      return { customDate: input.customDate instanceof Date ? input.customDate : new Date(input.customDate) };
    },
  },
};

/** 中文对齐用：显示宽度（粗略，CJK 记 2 列）。 */
function displayWidth(text) {
  let w = 0;
  for (const ch of String(text)) w += /[\u1100-\u115f\u2e80-\ua4cf\ua960-\ua97f\uac00-\ud7ff\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
  return w;
}

/** 右侧补空格到指定显示宽度。 */
function padEndWide(text, width) {
  const s = String(text);
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)));
}

/** 值转成单行显示文本（长 verse 截断）。 */
function showValue(value, max = 48) {
  if (value === undefined) return '(键不存在)';
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 解析命令行参数。 */
function parseArgs(argv) {
  const opts = { capability: null, saveGolden: null, useGolden: null, verbose: false, legacyRoot: DEFAULT_LEGACY_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      i += 1;
      if (i >= argv.length) throw new Error(`参数 ${flag} 缺少数值`);
      return argv[i];
    };
    if (flag === '--capability') opts.capability = takeValue();
    else if (flag === '--save-golden') opts.saveGolden = takeValue();
    else if (flag === '--use-golden') opts.useGolden = takeValue();
    else if (flag === '--legacy') opts.legacyRoot = takeValue();
    else if (flag === '--float-tolerance') FLOAT_TOLERANCE = Number(takeValue());
    else if (flag === '--verbose' || flag === '-v') opts.verbose = true;
    else if (flag === '--help' || flag === '-h') opts.help = true;
    else throw new Error(`未知参数: ${arg}`);
  }
  return opts;
}

const HELP = `命理 · 排盘内核对拍
  --capability <name>      只跑指定能力（默认全部）
  --save-golden <file>     把旧实现输出（stripInternal 后）存为 golden 快照
  --use-golden <file>      用已存 golden 代替跑旧实现（无 vendor 环境回归用）
  --legacy <dir>           旧实现根目录（默认 vendor 下的旧包 dist，可由 MINGLI_PAIPAN_LEGACY_DIR 覆盖）
  --float-tolerance <n>    浮点容差（默认 0）
  --verbose, -v            打印全部信息性差异与逐条明字段
`;

/** 动态加载一个模块的具名导出。 */
async function loadExport(modulePath, exportName) {
  const mod = await import(pathToFileURL(modulePath).href);
  const fn = mod[exportName];
  if (typeof fn !== 'function') {
    throw new Error(`模块未导出函数 ${exportName}: ${modulePath}`);
  }
  return fn;
}

/** 主流程。 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const targets = opts.capability ? [opts.capability] : Object.keys(CAPABILITIES);
  for (const name of targets) {
    if (!CAPABILITIES[name]) throw new Error(`未登记的能力: ${name}（可选: ${Object.keys(CAPABILITIES).join(', ')}）`);
  }

  const { stripInternal, extractKeyFields } = await import(pathToFileURL(path.join(CORE_ROOT, 'src', 'pipeline', 'index.js')).href);
  const { generateXiaoliurenCore } = await import(pathToFileURL(path.join(CORE_ROOT, 'src', 'capabilities', 'xiaoliuren', 'index.js')).href);

  let failedCapabilities = 0;

  for (const capability of targets) {
    const spec = CAPABILITIES[capability];
    const fixturePath = path.join(FIXTURES_DIR, spec.fixtures);
    if (!fs.existsSync(fixturePath)) throw new Error(`夹具文件不存在: ${fixturePath}`);
    const fixtureDoc = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const defaultKeyFields = fixtureDoc.defaultKeyFields;
    const fixtures = fixtureDoc.fixtures;
    if (!Array.isArray(defaultKeyFields) || !Array.isArray(fixtures)) {
      throw new Error(`夹具文件结构不对（需 defaultKeyFields[] 与 fixtures[]）: ${fixturePath}`);
    }

    // 旧实现（或 golden 快照）
    let legacyRun = null;
    let golden = null;
    let legacyLabel;
    if (opts.useGolden) {
      const goldenPath = path.resolve(opts.useGolden);
      if (!fs.existsSync(goldenPath)) throw new Error(`golden 文件不存在: ${goldenPath}`);
      golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
      if (!golden.fixtures || typeof golden.fixtures !== 'object') throw new Error(`golden 文件结构不对（需 fixtures 对象）: ${goldenPath}`);
      legacyLabel = `golden 快照 ${path.relative(process.cwd(), goldenPath)}（旧实现输出，无 vendor 依赖）`;
    } else {
      const legacyModulePath = path.join(path.resolve(opts.legacyRoot), spec.legacy.module);
      if (!fs.existsSync(legacyModulePath)) {
        throw new Error(`旧实现模块不存在: ${legacyModulePath}（可用 --use-golden 走 golden 快照，或 --legacy 指定目录）`);
      }
      legacyRun = await loadExport(legacyModulePath, spec.legacy.exportName);
      legacyLabel = path.relative(PAIPAN_NODE_ROOT, legacyModulePath);
    }

    console.log(`=== 命理 · 排盘内核对拍 · capability=${capability} ===`);
    console.log(`旧实现侧：${legacyLabel}`);
    console.log(`新实现侧：${path.relative(PAIPAN_NODE_ROOT, path.join(CORE_ROOT, spec.core.module))}`);
    console.log(`关键字段：${defaultKeyFields.length} 个 ｜ 夹具：${fixtures.length} 条 ｜ 浮点容差：${FLOAT_TOLERANCE}`);

    const goldenOut = { capability, defaultKeyFields, note: 'golden 快照：旧实现（vendored 第三方引擎）输出经 stripInternal 归一化后的结果。不含时间戳，保证可重复 diff。', fixtures: {} };
    let passed = 0;
    const failedFixtures = [];
    let fieldTotal = 0;
    let fieldOk = 0;
    const infoDiffs = [];

    for (const fixture of fixtures) {
      const keyFields = Array.isArray(fixture.keyFields) && fixture.keyFields.length ? fixture.keyFields : defaultKeyFields;
      let legacyStripped;
      let coreStripped;
      try {
        if (golden) {
          const entry = golden.fixtures[fixture.name];
          if (!entry || !entry.stripped) throw new Error(`golden 快照缺该夹具条目: ${fixture.name}`);
          legacyStripped = entry.stripped;
        } else {
          const legacyRaw = legacyRun(spec.toLegacyInput(fixture.input));
          legacyStripped = stripInternal(legacyRaw);
        }
        const coreRaw = capability === 'xiaoliuren'
          ? generateXiaoliurenCore(fixture.input)
          : await (await loadExport(path.join(CORE_ROOT, spec.core.module), spec.core.exportName))(fixture.input);
        coreStripped = stripInternal(coreRaw);
      } catch (err) {
        failedFixtures.push({ name: fixture.name, reason: `运行异常: ${err && err.message ? err.message : String(err)}` });
        console.log(`[FAIL] ${fixture.name}  运行异常: ${err && err.message ? err.message : String(err)}`);
        continue;
      }

      goldenOut.fixtures[fixture.name] = { input: fixture.input, stripped: legacyStripped };

      // 关键字段比较（门禁）
      const legacyKey = extractKeyFields(legacyStripped, keyFields);
      const coreKey = extractKeyFields(coreStripped, keyFields);
      const keyDiffs = deepDiff(legacyKey, coreKey, { floatTolerance: FLOAT_TOLERANCE })
        .filter((d) => d.kind !== 'float-diff');
      fieldTotal += keyFields.length;
      fieldOk += keyFields.length - keyDiffs.length;
      const status = keyDiffs.length === 0 ? 'PASS' : 'FAIL';
      if (keyDiffs.length === 0) passed += 1;
      else failedFixtures.push({ name: fixture.name, reason: `${keyDiffs.length} 个关键字段不一致`, diffs: keyDiffs });
      console.log(`[${status}] ${padEndWide(fixture.name, 34)} 关键字段 ${keyFields.length - keyDiffs.length}/${keyFields.length}`);
      for (const d of keyDiffs) {
        console.log(`        关键差异 ${d.path}  旧=${showValue(d.a)}  新=${showValue(d.b)}  (${d.kind})`);
      }

      // 全量比较（信息性，不判失败）
      const fullDiffs = deepDiff(legacyStripped, coreStripped, { floatTolerance: FLOAT_TOLERANCE });
      for (const d of fullDiffs) infoDiffs.push({ fixture: fixture.name, ...d });
      if (opts.verbose && fullDiffs.length) {
        const stat = countConsistency(fullDiffs);
        console.log(`        信息性差异 ${stat.total} 条（missing=${stat.byKind.missing} extra=${stat.byKind.extra} changed=${stat.byKind.changed} float=${stat.byKind['float-diff']}）`);
      }
    }

    console.log('-'.repeat(72));
    const rate = fieldTotal === 0 ? 1 : fieldOk / fieldTotal;
    console.log(`汇总：夹具 ${fixtures.length} 条，通过 ${passed}，失败 ${fixtures.length - passed}；关键字段一致率 ${(rate * 100).toFixed(2)}%（${fieldOk}/${fieldTotal}）`);

    const infoByPath = new Map();
    for (const d of infoDiffs) {
      const key = `${d.path} :: ${d.kind}`;
      if (!infoByPath.has(key)) infoByPath.set(key, []);
      infoByPath.get(key).push(d);
    }
    console.log(`信息性差异（非关键字段，不判失败）：${infoDiffs.length} 条，涉及路径 ${infoByPath.size} 个`);
    const infoLimit = opts.verbose ? infoDiffs.length : Math.min(10, infoDiffs.length);
    for (const d of infoDiffs.slice(0, infoLimit)) {
      console.log(`  - ${d.fixture}  ${d.path}  旧=${showValue(d.a)}  新=${showValue(d.b)}  (${d.kind})`);
    }
    if (infoDiffs.length > infoLimit) console.log(`  …（其余 ${infoDiffs.length - infoLimit} 条省略；加 --verbose 看全部）`);

    if (Array.isArray(fixtureDoc.notes)) {
      console.log('夹具说明：');
      for (const n of fixtureDoc.notes) console.log(`  * ${n}`);
    }

    if (opts.saveGolden) {
      const outPath = path.resolve(opts.saveGolden);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(goldenOut, null, 2)}\n`, 'utf8');
      console.log(`golden 已写入：${path.relative(process.cwd(), outPath)}（${Object.keys(goldenOut.fixtures).length} 条夹具快照）`);
    }

    if (fixtures.length - passed > 0) {
      failedCapabilities += 1;
      console.log('RESULT: FAILED');
      for (const f of failedFixtures) console.log(`  × ${f.name} —— ${f.reason}`);
    } else {
      console.log('RESULT: PASSED');
    }
  }

  process.exitCode = failedCapabilities === 0 ? 0 : 1;
  return failedCapabilities;
}

main().catch((err) => {
  console.error(`[对拍框架错误] ${err && err.stack ? err.stack : String(err)}`);
  process.exitCode = 2;
});
