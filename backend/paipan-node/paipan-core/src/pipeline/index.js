/**
 * 命理 · 自研排盘内核 · 管线基座
 * ---------------------------------------------------------------------------
 * 本文件是「纯函数管线」的公共基座，只放与具体能力无关的东西：
 *   1. stripInternal —— 剥离内部实现字段，得到「生产契约形状」
 *   2. getPath      —— 按点路径（含数组下标）取值
 *   3. extractKeyFields —— 按关键字段清单提取子集（对拍门禁的比较对象）
 *   4. stableStringify / fnv1aHash —— 确定性哈希（meta.inputHash / resultId 用）
 *
 * 纪律（违反即返工）：
 *   - 禁止 import 任何 IO / 网络 / LLM / 进程相关模块；本文件不得有副作用。
 *   - 禁止 Math.random、Date.now —— 同样输入必须同样输出。
 *   - 不修改入参（纯函数）。
 *
 * 剥离清单（与 vendor 旧实现黑盒实测的内部字段一致，见 README §3）：
 *   evidenceAnalysis / calculationContext / positionSources / prompt /
 *   calculationChain / sources / timestamp
 * 这些字段属于「给下游 LLM 提示词与审计用」的中间产物，不进生产契约；
 * 新增自研能力时若产生同类中间字段，必须登记进本清单。
 */

/** 内部字段剥离清单（唯一权威位置；对拍两侧共用同一份）。 */
export const INTERNAL_KEYS = Object.freeze([
  'evidenceAnalysis',
  'calculationContext',
  'positionSources',
  'prompt',
  'calculationChain',
  'sources',
  'timestamp',
]);

const INTERNAL_KEY_SET = new Set(INTERNAL_KEYS);

/**
 * 递归剥离内部字段，返回新对象（不改入参）。
 * 数组保持数组、逐元素递归；`undefined` 值的键保持原样（由比较层统一视为不存在）。
 *
 * @param {unknown} value 任意 JSON 形状的值
 * @returns {unknown} 剥离内部字段后的新值
 */
export function stripInternal(value) {
  if (Array.isArray(value)) return value.map((item) => stripInternal(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (INTERNAL_KEY_SET.has(key)) continue;
      out[key] = stripInternal(val);
    }
    return out;
  }
  return value;
}

/**
 * 把路径表达式切成 token 列表。
 * 支持形式：`a.b`、`a.b[0].c`、`[0].a`、`b["x.y"]`（带点的键名用引号包裹）。
 *
 * @param {string} path 点路径表达式
 * @returns {Array<string|number>} token 列表（数组下标为 number）
 */
export function parsePath(path) {
  if (typeof path !== 'string' || path === '') return [];
  const tokens = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf !== '') {
      tokens.push(buf);
      buf = '';
    }
  };
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      flush();
      i += 1;
      continue;
    }
    if (ch === '[') {
      flush();
      const end = path.indexOf(']', i);
      if (end === -1) throw new Error(`getPath: 路径缺少右中括号: ${path}`);
      const inner = path.slice(i + 1, end).trim();
      if (/^-?\d+$/.test(inner)) {
        tokens.push(Number(inner));
      } else {
        tokens.push(inner.replace(/^['"]|['"]$/g, ''));
      }
      i = end + 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush();
  return tokens;
}

/**
 * 按点路径取值（支持数组下标）。
 * 取不到时返回 undefined（不抛错）；路径本身非法（中括号不闭合）时抛错。
 *
 * @param {unknown} obj 取值对象
 * @param {string} path 路径表达式，例如 `palaceOrder[3].verse`
 * @returns {unknown} 命中的值，或 undefined
 */
export function getPath(obj, path) {
  const tokens = parsePath(path);
  let cur = obj;
  for (const token of tokens) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = cur[token];
  }
  return cur;
}

/**
 * 按关键字段清单提取子集，得到「对拍门禁的比较对象」。
 * 字段取不到时该键不存在（而不是 `undefined` 值），保证比较层不会产生噪音。
 *
 * @param {unknown} obj 已归一化（通常已 stripInternal）的输出
 * @param {ReadonlyArray<string>} keyFields 路径清单
 * @returns {Record<string, unknown>} 路径 → 值 的扁平映射
 */
export function extractKeyFields(obj, keyFields) {
  const out = {};
  if (!Array.isArray(keyFields)) return out;
  for (const path of keyFields) {
    const value = getPath(obj, path);
    if (value !== undefined) out[path] = value;
  }
  return out;
}

/**
 * 稳定序列化：对象键递归按字典序排序，数组保持原序。
 * 用途：哈希计算的输入，保证与键插入顺序无关（确定性纪律）。
 *
 * @param {unknown} value 任意 JSON 形状的值
 * @returns {string} 稳定 JSON 字符串
 */
export function stableStringify(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
  return JSON.stringify(value);
}

/**
 * 自写 FNV-1a 32 位哈希，输出 8 位十六进制。
 * 只用于 meta.inputHash / resultId 的标识生成，不参与任何排盘结果。
 *
 * @param {string} text 待哈希文本
 * @returns {string} 8 位小写十六进制
 */
export function fnv1aHash(text) {
  let hash = 0x811c9dc5;
  const str = String(text);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= (str.charCodeAt(i) >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
