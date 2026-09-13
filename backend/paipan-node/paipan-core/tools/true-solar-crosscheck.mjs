/**
 * 命理 · 自研排盘内核 · 节149 交叉比对：Node 内核 ↔ Python 镜像
 * ---------------------------------------------------------------------------
 * 用途（唯一目标）：证明 `paipan-core/src/capabilities/true-solar-time/index.js`（JS 权威实现）
 * 与 `backend/app/paipan/birthtime.py`（Python 镜像，engine.py 的实际消费方）在同一组 20 个
 * 输入上**输出逐字段相等**。
 *
 * 运行：cd backend/paipan-node && node paipan-core/tools/true-solar-crosscheck.mjs
 *   - 20 组输入跨年代（1900s/1960s/1986–1991/1990s/2000s/2020s）、跨月、跨日、跨年、
 *     闰日、夏令时 12 个边界、缺分钟、开关全关；另附一条缺经度错误码比对。
 *   - 每组比对**三个函数**的输出：correctBirthTime / calculateTrueSolarTime / getChinaDst。
 *   - 全部一致 → 打印「全部 20 组一致」并 exit 0；任一不一致 → 打印差异明细并 exit 1。
 *
 * 说明：本脚本属 `tools/`（允许 IO / child_process），**不在 src/ 内**（内核零 IO 纪律不受影响）。
 * Python 侧通过 importlib 按**文件路径**加载 birthtime.py —— 不触发 `app.paipan.__init__`
 * 对 engine.py 的重依赖（本能力零依赖，应当能被单独加载）。
 *
 * 环境变量：MINGLI_PYTHON_BIN（默认 Windows 用 `python`，其它平台用 `python3`）。
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateTrueSolarTime,
  correctBirthTime,
  getChinaDst,
} from '../src/capabilities/true-solar-time/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
/** backend/app/paipan/birthtime.py（tools/ → paipan-core/ → paipan-node/ → backend/）。 */
const PY_MODULE_PATH = resolve(HERE, '../../../app/paipan/birthtime.py');

/** 20 组权威输入（跨越年代 / 月 / 日 / 年 / 闰日 / 夏令时边界 / 缺分钟 / 开关）。 */
const CASES = [
  { label: '1900 世纪（非闰年）', input: { year: 1900, month: 1, day: 15, hour: 12, minute: 0, longitude: 116.4 } },
  { label: '1900 世纪非闰日序', input: { year: 1900, month: 3, day: 1, hour: 0, minute: 30, longitude: 116.4 } },
  { label: '1960s EoT 零点日', input: { year: 1960, month: 6, day: 13, hour: 6, minute: 30, longitude: 121.47 } },
  { label: '1986 起止前一日 23:59', input: { year: 1986, month: 5, day: 3, hour: 23, minute: 59, longitude: 116.4 } },
  { label: '1986 起始日 01:59（标准时）', input: { year: 1986, month: 5, day: 4, hour: 1, minute: 59, longitude: 116.4 } },
  { label: '1986 起始日 02:00（夏令时）', input: { year: 1986, month: 5, day: 4, hour: 2, minute: 0, longitude: 116.4 } },
  { label: '1986 结束日 01:30（歧义段）', input: { year: 1986, month: 9, day: 14, hour: 1, minute: 30, longitude: 116.4 } },
  { label: '1986 结束日 02:00（回标准时）', input: { year: 1986, month: 9, day: 14, hour: 2, minute: 0, longitude: 116.4 } },
  { label: '1987 起始日 + 大修正（西经度）', input: { year: 1987, month: 4, day: 12, hour: 2, minute: 30, longitude: 87.6 } },
  { label: '1988 区间内正午', input: { year: 1988, month: 7, day: 1, hour: 12, minute: 0, longitude: 116.4 } },
  { label: '1989 起始日 01:59（标准时）', input: { year: 1989, month: 4, day: 16, hour: 1, minute: 59, longitude: 113.3 } },
  { label: '1990 结束日 23:59（夏令时末）', input: { year: 1990, month: 9, day: 16, hour: 23, minute: 59, longitude: 104.07 } },
  { label: '1991 起始日 02:00（末年末次）', input: { year: 1991, month: 4, day: 14, hour: 2, minute: 0, longitude: 126.63 } },
  { label: '1992 表外年份（DST 停用）', input: { year: 1992, month: 6, day: 1, hour: 12, minute: 0, longitude: 116.4 } },
  { label: '2000 闰日 + 中央经线', input: { year: 2000, month: 2, day: 29, hour: 23, minute: 50, longitude: 120 } },
  { label: '2023 跨年进位', input: { year: 2023, month: 12, day: 31, hour: 23, minute: 50, longitude: 125.05 } },
  { label: '2024 闰日 + 大修正跨日回退', input: { year: 2024, month: 2, day: 29, hour: 0, minute: 30, longitude: 75 } },
  { label: '2025 EoT 局部极大（5/14）', input: { year: 2025, month: 5, day: 14, hour: 12, minute: 0, longitude: 116.4 } },
  { label: '缺分钟（minute=null）+ 大修正', input: { year: 2025, month: 3, day: 1, hour: 12, minute: null, longitude: 116.4 } },
  {
    label: '两个开关全关（原样返回）',
    input: {
      year: 2025, month: 3, day: 1, hour: 12, minute: 30, longitude: 116.4,
      applyTrueSolar: false, applyDst: false,
    },
  },
];

/** 附检：缺经度时两侧错误码必须一致（不占 20 组名额）。 */
const MISSING_LONGITUDE_CASE = { year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: null };

/** Python 侧驱动器（写入临时文件后执行；从 stdin 读用例、往 stdout 写结果）。 */
const PY_DRIVER = `# -*- coding: utf-8 -*-
import importlib.util, json, sys

spec = importlib.util.spec_from_file_location("mingli_birthtime", ${JSON.stringify(PY_MODULE_PATH)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

cases = json.load(sys.stdin)
out = []
for case in cases:
    base = {k: case[k] for k in ("year", "month", "day", "hour", "minute") if k in case}
    longitude = case.get("longitude")
    item = {}
    try:
        item["calculateTrueSolarTime"] = mod.calculate_true_solar_time(
            **base, longitude=longitude)
    except ValueError as exc:
        item["calculateTrueSolarTime"] = {"error": getattr(exc, "code", type(exc).__name__)}
    try:
        item["getChinaDst"] = mod.get_china_dst(**base)
    except ValueError as exc:
        item["getChinaDst"] = {"error": getattr(exc, "code", type(exc).__name__)}
    cb = dict(base)
    cb["longitude"] = longitude
    if "applyTrueSolar" in case:
        cb["apply_true_solar"] = case["applyTrueSolar"]
    if "applyDst" in case:
        cb["apply_dst"] = case["applyDst"]
    try:
        item["correctBirthTime"] = mod.correct_birth_time(**cb)
    except ValueError as exc:
        item["correctBirthTime"] = {"error": getattr(exc, "code", type(exc).__name__)}
    out.append(item)
json.dump(out, sys.stdout, ensure_ascii=False)
`;

/** 归一化：对象键排序、数字按 4 位小数定形（吸收两语言浮点表示差异）。 */
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canon(value[key]);
    return out;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    const rounded = Number(value.toFixed(4));
    return Object.is(rounded, -0) ? 0 : rounded;
  }
  return value;
}

/** JS 侧：一组输入 → 三函数结果（错误一律收敛为 {error: 错误码}）。 */
function jsResults(input) {
  const item = {};
  try {
    item.calculateTrueSolarTime = calculateTrueSolarTime(input);
  } catch (err) {
    item.calculateTrueSolarTime = { error: err.code ?? err.name };
  }
  try {
    item.getChinaDst = getChinaDst(input);
  } catch (err) {
    item.getChinaDst = { error: err.code ?? err.name };
  }
  try {
    item.correctBirthTime = correctBirthTime(input);
  } catch (err) {
    item.correctBirthTime = { error: err.code ?? err.name };
  }
  return item;
}

/** 跑一次 Python 驱动器。 */
function pythonResults(cases) {
  const pythonBin = process.env.MINGLI_PYTHON_BIN
    ?? (process.platform === 'win32' ? 'python' : 'python3');
  const dir = mkdtempSync(join(tmpdir(), 'mingli-crosscheck-'));
  const driverPath = join(dir, 'driver.py');
  try {
    writeFileSync(driverPath, PY_DRIVER, 'utf8');
    const res = spawnSync(pythonBin, [driverPath], {
      input: JSON.stringify(cases),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    if (res.error) throw new Error(`无法执行 ${pythonBin}: ${res.error.message}`);
    if (res.status !== 0) {
      throw new Error(`${pythonBin} 退出码 ${res.status}\n${res.stderr ?? ''}`);
    }
    return JSON.parse(res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 逐字段差异清单（路径 + 两侧值）。 */
function diffPaths(left, right) {
  const diffs = [];
  const walk = (a, b, path) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const bothObjects = a && b && typeof a === 'object' && typeof b === 'object'
      && !Array.isArray(a) && !Array.isArray(b);
    if (bothObjects) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        walk(a[key], b[key], `${path}.${key}`);
      }
      return;
    }
    const bothArrays = Array.isArray(a) && Array.isArray(b);
    if (bothArrays && a.length === b.length) {
      a.forEach((_, i) => walk(a[i], b[i], `${path}[${i}]`));
      return;
    }
    diffs.push(`${path}: JS=${JSON.stringify(a)} / PY=${JSON.stringify(b)}`);
  };
  walk(left, right, '$');
  return diffs;
}

function main() {
  const inputs = CASES.map((c) => c.input);
  const js = inputs.map(jsResults);
  const py = pythonResults(inputs);

  if (!Array.isArray(py) || py.length !== inputs.length) {
    console.error(`✖ Python 侧返回结果数不符：期望 ${inputs.length}，实际 ${py?.length}`);
    process.exit(1);
  }

  let failed = 0;
  inputs.forEach((input, i) => {
    const left = canon(js[i]);
    const right = canon(py[i]);
    const diffs = diffPaths(left, right);
    if (diffs.length === 0) {
      console.log(`✔ 组 ${String(i + 1).padStart(2, '0')} ${CASES[i].label} —— 三函数一致`);
    } else {
      failed += 1;
      console.error(`✖ 组 ${String(i + 1).padStart(2, '0')} ${CASES[i].label} —— ${diffs.length} 处不一致`);
      for (const line of diffs) console.error(`    ${line}`);
    }
  });

  // 附检：缺经度错误码两侧一致
  const jsErr = jsResults(MISSING_LONGITUDE_CASE).correctBirthTime;
  const pyErr = pythonResults([MISSING_LONGITUDE_CASE])[0].correctBirthTime;
  const errMatch = jsErr.error === 'longitude_required' && pyErr.error === 'longitude_required';
  console.log(errMatch
    ? '＋附检：缺经度时两侧错误码一致（longitude_required）'
    : `✖ 附检失败：JS=${JSON.stringify(jsErr)} / PY=${JSON.stringify(pyErr)}`);
  if (!errMatch) failed += 1;

  if (failed === 0) {
    console.log(`全部 ${inputs.length} 组一致（correctBirthTime / calculateTrueSolarTime / getChinaDst 三函数逐字段相等）`);
    process.exit(0);
  }
  console.error(`✖ 交叉比对失败：${failed} 处（见上）`);
  process.exit(1);
}

main();
