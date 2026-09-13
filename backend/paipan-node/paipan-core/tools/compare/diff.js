/**
 * 排盘内核对拍框架 · 差异比较模块（diff）
 *
 * 用途
 *   比较两侧排盘结果：a = 期望侧（基准 / 旧内核输出 / 快照），b = 实际侧（新内核输出），
 *   产出一份可读、可断言的差异清单，供对拍报告与回归测试使用。
 *
 * 差异条目形状
 *   { path, a, b, kind }
 *   path：点路径 + 数组下标，例如 "ganzhi.year"、"palaceOrder[3].verse"、"sequence.month.name"，
 *         根路径为 "$"。
 *   a / b：该路径两侧的值（b 侧不存在时为 undefined）。
 *   kind：只有下面四种字符串取值。
 *
 * kind 四种取值的精确语义
 *   "missing"    a 侧有该键、b 侧没有（b 丢了字段 / 少了数组元素）。
 *   "extra"      b 侧有该键、a 侧没有（b 多出字段 / 多了数组元素）。
 *   "changed"    两侧都有该键，但值不相等（含两侧类型不同，类型不同不展开递归）。
 *                容差为 0 时，两个不相等的数字也判为 "changed"。
 *   "float-diff" 两侧都是 number、值不相等但 |a - b| <= floatTolerance。
 *                这是信息性差异：容差内已判为「等」，调用方**不得**据此判失败，
 *                仅用于报告浮点误差的量级（例如 0.1 + 0.2 与 0.3）。
 *
 * 归一化约定
 *   undefined 的键视为不存在（两侧同样处理）。旧实现输出里存在 meta.model: undefined
 *   这类键，JSON 序列化后本就消失；若把它当作「存在」会产生无意义噪音。
 *
 * 确定性
 *   返回数组按 path 字符串稳定排序，同样输入两次调用结果完全一致，便于快照与测试。
 *   不做 JSON.stringify 比较（键序不同会造成假差异），也不使用随机数 / 当前时间。
 *
 * 约束
 *   纯函数、零依赖、零 IO、零网络：不读取文件、不写日志、不修改入参。
 */

/** 四种 kind 的唯一合法取值。 */
const KINDS = ["missing", "extra", "changed", "float-diff"];

/** 判断对象自身是否携带该键（原型链上的键不算）。 */
function isPresent(value, key) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

/** 判断是否为数组。 */
function isArray(value) {
  return Array.isArray(value);
}

/** 判断是否为 Date 实例（包含跨 realm 的鸭子判定兜底）。 */
function isDate(value) {
  return value instanceof Date || Object.prototype.toString.call(value) === "[object Date]";
}

/** 拼接点路径：根为 "$"，字段用 "." 连接；非根路径直接续接，例如 "$.ganzhi" + "year" → "ganzhi.year"。 */
function joinPath(base, key) {
  if (base === "" || base === "$") {
    return key;
  }
  return base + "." + key;
}

/** 拼接数组元素路径，例如 "palaceOrder" + 3 → "palaceOrder[3]"。 */
function indexPath(base, index) {
  return base + "[" + index + "]";
}

/**
 * 规则里的 path 归一化：去掉开头的 "$." 或 "$"，与递归中的相对点路径对齐（根为 ""）。
 * 注意：按规格，规则的 path 本身就是排序字段名（{path:"palaceFacts"} 表示按 x["palaceFacts"] 排序），
 * 另提供可选的 field 覆盖该默认，用于「数组名与排序字段名不同」的场景（{path:"arr", field:"k"}）。
 */
function normalizeRulePath(p) {
  if (p === "$") {
    return "";
  }
  if (p.slice(0, 2) === "$.") {
    return p.slice(2);
  }
  return p;
}

/** 比较两个值是否相等（仅用于排序键、日期时间等已知同类型场景）。 */
function samePrimitive(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    return x === y;
  }
  return Object.is(x, y);
}

/**
 * 数值是否相等。
 * 两者都是 number 且都不是 NaN 时用 === 判等，因此 0 与 -0 视为相等。
 */
function numbersEqual(x, y) {
  return x === y;
}

/** 判断两个值是否都是可比较的 number（都是 number 且都不是 NaN）。 */
function isComparableNumberPair(x, y) {
  return typeof x === "number" && typeof y === "number" && !Number.isNaN(x) && !Number.isNaN(y);
}

/**
 * 取出排序规则数组。
 * 支持单个规则 {path:"字段名"} 或规则数组 [{path:"字段名"}, ...]。
 */
function normalizeSortRules(options) {
  const raw = options && options.sortArraysBy;
  if (!raw) {
    return [];
  }
  const list = isArray(raw) ? raw : [raw];
  const rules = [];
  for (let i = 0; i < list.length; i += 1) {
    const rule = list[i];
    if (rule && typeof rule === "object" && typeof rule.path === "string") {
      // 允许写成 "palaceFacts" 或 "$.palaceFacts"，两种写法归一化到同一相对路径
      const p = normalizeRulePath(rule.path);
      const field = typeof rule.field === "string" ? rule.field : null;
      rules.push({ path: p, field });
    }
  }
  return rules;
}

/** 该数组路径是否命中排序规则；命中则返回排序字段名（rule.field 优先，否则用 rule.path），未命中返回 null。 */
function matchSortRule(rules, path) {
  for (let i = 0; i < rules.length; i += 1) {
    if (rules[i].path === path) {
      return rules[i].field || rules[i].path;
    }
  }
  return null;
}

/** 取排序键：String(x[field])，缺失字段视为空串。 */
function sortKeyFor(element, field) {
  if (element === null || typeof element !== "object") {
    return "";
  }
  const raw = element[field];
  if (raw === undefined || raw === null) {
    return "";
  }
  return String(raw);
}

/** 稳定排序副本：不修改入参数组。 */
function sortedCopy(list, field) {
  const indexed = [];
  for (let i = 0; i < list.length; i += 1) {
    indexed.push({ v: list[i], k: sortKeyFor(list[i], field), i: i });
  }
  indexed.sort((x, y) => {
    if (x.k < y.k) {
      return -1;
    }
    if (x.k > y.k) {
      return 1;
    }
    return x.i - y.i;
  });
  return indexed.map((entry) => entry.v);
}

/**
 * 深度比较两个值，收集差异清单（期望侧 a / 实际侧 b）。
 *
 * @param {*} a 期望侧（基准）。约定：a 侧有而 b 侧没有的键 → "missing"。
 * @param {*} b 实际侧（被测）。约定：b 侧有而 a 侧没有的键 → "extra"。
 * @param {object} [options] 选项。
 * @param {number} [options.floatTolerance=0] 浮点容差；两侧同为非 NaN number、值不等但差值不超过容差时产出 "float-diff"。容差为 0 时按 "changed" 处理。
 * @param {object|object[]} [options.sortArraysBy] 数组排序规则，元素形如 { path: "palaceFacts" }；
 *        规则 path 指向某个数组的点路径（去掉开头 "$." 后比较），同时该 path 就是排序字段名
 *        （即按元素 x["palaceFacts"] 排序）；若写成 { path: "arr", field: "k" } 则用 field 指定排序字段。
 *        命中时两侧先按该字段 String(...) 字典序稳定排序，再按下标逐一比较；排序只影响比较顺序，不进入差异结果。
 * @returns {{path: string, a: *, b: *, kind: "missing"|"extra"|"changed"|"float-diff"}[]} 按 path 稳定排序后的差异数组；完全一致时返回 []。
 */
export function deepDiff(a, b, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const floatTolerance =
    typeof opts.floatTolerance === "number" && Number.isFinite(opts.floatTolerance)
      ? Math.abs(opts.floatTolerance)
      : 0;
  const sortRules = normalizeSortRules(opts);
  const diffs = [];
  const seen = new WeakMap();

  function record(path, left, right, kind) {
    diffs.push({ path: path, a: left, b: right, kind: kind });
  }

  /** 两侧都有值但判定为不相等时的统一出口。 */
  function compareValues(left, right, path) {
    if (isComparableNumberPair(left, right) && floatTolerance > 0) {
      const delta = Math.abs(left - right);
      if (delta <= floatTolerance) {
        record(path, left, right, "float-diff");
        return;
      }
      record(path, left, right, "changed");
      return;
    }
    record(path, left, right, "changed");
  }

  function walkArray(left, right, path) {
    const field = matchSortRule(sortRules, path);
    const listA = field ? sortedCopy(left, field) : left;
    const listB = field ? sortedCopy(right, field) : right;
    const max = Math.max(listA.length, listB.length);
    for (let i = 0; i < max; i += 1) {
      const hasLeft = i < listA.length;
      const hasRight = i < listB.length;
      const childPath = indexPath(path, i);
      if (!hasLeft) {
        record(childPath, undefined, listB[i], "extra");
        continue;
      }
      if (!hasRight) {
        record(childPath, listA[i], undefined, "missing");
        continue;
      }
      walk(listA[i], listB[i], childPath);
    }
  }

  function walkObject(left, right, path) {
    const keys = [];

    /** 收集一侧的键，undefined 视为不存在。 */
    function collectKeys(source) {
      if (source === null || typeof source !== "object") {
        return;
      }
      const own = Object.keys(source);
      for (let i = 0; i < own.length; i += 1) {
        const key = own[i];
        if (source[key] === undefined) {
          continue;
        }
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      }
    }

    collectKeys(left);
    collectKeys(right);

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const childPath = joinPath(path, key);
      const hasLeft = isPresent(left, key) && left[key] !== undefined;
      const hasRight = isPresent(right, key) && right[key] !== undefined;
      if (hasLeft && !hasRight) {
        record(childPath, left[key], undefined, "missing");
        continue;
      }
      if (!hasLeft && hasRight) {
        record(childPath, undefined, right[key], "extra");
        continue;
      }
      walk(left[key], right[key], childPath);
    }
  }

  function walk(left, right, path) {
    // undefined 视为不存在（调用方已保证不在此处出现 undefined/undefined）
    if (left === right) {
      return;
    }

    const leftIsDate = isDate(left);
    const rightIsDate = isDate(right);
    const leftIsArray = isArray(left);
    const rightIsArray = isArray(right);
    const leftIsObject = left !== null && typeof left === "object" && !leftIsArray && !leftIsDate;
    const rightIsObject = right !== null && typeof right === "object" && !rightIsArray && !rightIsDate;

    // 类型不同（对象 / 数组 / 日期 / null / 原始值之间）→ changed，不展开递归
    if (leftIsDate || rightIsDate) {
      if (leftIsDate && rightIsDate) {
        if (left.getTime() !== right.getTime()) {
          compareValues(left, right, path);
        }
        return;
      }
      if (leftIsDate && typeof right === "string") {
        if (left.toISOString() !== right) {
          record(path, left, right, "changed");
        }
        return;
      }
      if (rightIsDate && typeof left === "string") {
        if (right.toISOString() !== left) {
          record(path, left, right, "changed");
        }
        return;
      }
      record(path, left, right, "changed");
      return;
    }

    if (leftIsArray || rightIsArray) {
      if (!leftIsArray || !rightIsArray) {
        record(path, left, right, "changed");
        return;
      }
      // 循环引用保护：同一次配对只展开一次
      const seenRight = seen.get(left);
      if (seenRight === right) {
        return;
      }
      seen.set(left, right);
      walkArray(left, right, path);
      return;
    }

    if (leftIsObject || rightIsObject) {
      if (!leftIsObject || !rightIsObject) {
        record(path, left, right, "changed");
        return;
      }
      walkObject(left, right, path);
      return;
    }

    // null 对 null 由前面的 left === right 覆盖；此处 null 对非 null 或其他原始值
    if (left === null || right === null) {
      record(path, left, right, "changed");
      return;
    }

    const leftIsNumber = typeof left === "number";
    const rightIsNumber = typeof right === "number";

    if (leftIsNumber && rightIsNumber) {
      if (Number.isNaN(left) && Number.isNaN(right)) {
        return;
      }
      if (numbersEqual(left, right)) {
        return;
      }
      compareValues(left, right, path);
      return;
    }

    if (typeof left !== typeof right) {
      record(path, left, right, "changed");
      return;
    }

    if (!samePrimitive(left, right)) {
      record(path, left, right, "changed");
    }
  }

  // 递归内部的相对路径：根为 ""，字段路径如 "ganzhi.year"，数组下标如 "palaceOrder[3]"
  walk(a, b, "");

  // 先按 path 字符串稳定排序，保证同样输入两次调用结果完全一致
  diffs.sort((x, y) => {
    if (x.path < y.path) {
      return -1;
    }
    if (x.path > y.path) {
      return 1;
    }
    return 0;
  });

  return diffs;
}

/**
 * 统计差异清单的一致性概览。
 *
 * @param {Array<{kind: string}>|*} diffs deepDiff 的返回数组；传入非数组按空数组处理。
 * @returns {{total: number, byKind: {missing: number, extra: number, changed: number, "float-diff": number}, consistent: boolean}}
 *          total：差异条数（"float-diff" 也计入条数，但调用方判失败时只应看 missing / extra / changed）；
 *          byKind：四种 kind 的计数，四个键永远存在（无则 0）；
 *          consistent：total === 0 时为 true。
 */
export function countConsistency(diffs) {
  const list = isArray(diffs) ? diffs : [];
  const byKind = {
    missing: 0,
    extra: 0,
    changed: 0,
    "float-diff": 0,
  };
  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    const kind = entry && typeof entry === "object" ? entry.kind : undefined;
    if (KINDS.indexOf(kind) !== -1) {
      byKind[kind] += 1;
    }
  }
  return {
    total: list.length,
    byKind: byKind,
    consistent: list.length === 0,
  };
}
