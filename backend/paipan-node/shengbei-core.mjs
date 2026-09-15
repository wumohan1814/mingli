/**
 * 命理 · 潮汕圣杯（掷筊）内核 —— 纯函数、零依赖、可独立 import 验证
 * ---------------------------------------------------------------------------
 * 节131：潮汕/闽南/台湾民间「掷筊问神」的确定性实现。本模块只做一件事：
 * 由随机源（seed / replay / 注入函数）定「两枚筊杯的落面」，再由两面组合定三态。
 *
 * == 公版常识口径（节131 调研，潮汕本地叫法待用户拍板/待联网核实）==
 *   筊杯分两面：平面（阳面）/ 凸面（阴面）。两杯组合三态：
 *     圣杯（圣筊）= 一平一凸（一阴一阳）= 应允
 *     笑杯（笑筊）= 两平面           = 再问
 *     阴杯（哭杯）= 两凸面           = 不允
 *   本产品口径：一次一掷（掷出两杯即定三态），不做连掷三次取多数（留待用户拍板）。
 *
 * == PRNG 口径（与 ssgw 对齐，同 seed 逐值相等）==
 *   uniform = mulberry32(FNV-1a32(String(seed))) 的依次返回值（每杯取一个）；
 *   杯面 = u < 0.5 ? 平面(flat) : 凸面(convex)。
 *   ⚠ 种子哈希必须是「String(seed) 每个 UTF-16 code unit 整体异或一次」（与
 *   ssgwSeedHash 同口径），不拆低字节/高字节。
 *
 * == 与 ssgw 的关系 ==
 *   本模块为 server.mjs 内的轻量能力（不挂 paipan-core capabilities 目录，也不做
 *   四段管线与对拍门禁——节131 范围仅 server.mjs + 验证），仅复用 paipan-core
 *   pipeline 的确定性哈希工具（纯函数、无副作用）。
 */

import { fnv1aHash, stableStringify } from './paipan-core/src/pipeline/index.js';

/** 三态定义（机器键 → 展示名/短判；正文详解的唯一来源在前端 CONTENT.divination.shengbei）。 */
export const SHENGBEI_STATES = Object.freeze({
  sheng: Object.freeze({ cn: '圣杯', short: '应允' }),
  xiao: Object.freeze({ cn: '笑杯', short: '再问' }),
  yin: Object.freeze({ cn: '阴杯', short: '不允' }),
});

/** 杯面显示名。 */
export const SHENGBEI_FACE_CN = Object.freeze({ flat: '平面', convex: '凸面' });

/** 每态一句判读（机器口径的简短落点；正文详解见前端 CONTENT.divination.shengbei）。 */
export const SHENGBEI_MEANING = Object.freeze({
  sheng: '一平一凸（一阴一阳），神示应允：所问之事可得允准，可按心意推进。',
  xiao: '两杯皆平面朝上，神示「再问」：所问未明或时机未到，宜把话说清、换种问法再掷一次。',
  yin: '两杯皆凸面朝上，神示不允：所问之事当下不宜推进，宜暂缓或另作打算。',
});

/** 内核版本 / 契约版本 / 算法标识（信息性字段，与 ssgw 同风格）。 */
export const ENGINE_VERSION = '0.1.0-mingli';
export const SCHEMA_VERSION = '1.0.0';
export const ALGORITHM = 'shengbei.draw';

/** 内核输入错误（缺随机源 / 模式冲突 / 非法种子 / 非法样本）。调用方据此返回 400。 */
export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/** FNV-1a 32 位哈希（零依赖自实现，与 paipan-core rules/ssgw.js 的 ssgwSeedHash 同口径）。 */
export function shengbeiSeedHash(seed) {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 标准 mulberry32：返回「取下一次均匀分布随机数」的函数（纯函数，无状态外泄）。 */
export function shengbeiMulberry32(seedInt) {
  let a = seedInt | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由种子取首个均匀随机数（区间 [0,1)，首值口径，与 ssgw 一致）。 */
export function shengbeiUniformFromSeed(seed) {
  return shengbeiMulberry32(shengbeiSeedHash(seed))();
}

/** 均匀值 → 杯面：u < 0.5 → 平面(flat/阳面)，否则凸面(convex/阴面)。 */
export function shengbeiFaceOf(u) {
  return u < 0.5 ? 'flat' : 'convex';
}

/** 两面组合 → 三态：两平=笑杯 / 两凸=阴杯 / 一平一凸=圣杯。 */
export function shengbeiStateOf(faces) {
  const convex = faces.filter((f) => f === 'convex').length;
  if (convex === 0) return 'xiao';
  if (convex === 2) return 'yin';
  return 'sheng';
}

/* ============================ ① 输入归一化 ============================ */

/**
 * ① 输入归一化：三模式互斥（seed / replay / 注入随机源），口径对齐 ssgw。
 *
 * @param {object|undefined|null} options 调用参数
 * @returns {{mode:'seeded'|'replay'|'custom', seed?: any, samples?: number[], random?: Function, hashInput: object}}
 */
export function normalizeShengbeiInput(options) {
  if (options === null || options === undefined || typeof options !== 'object' || Array.isArray(options)) {
    throw new PaipanInputError(
      'missing_random_source',
      '潮汕圣杯掷筊必须提供 seed（种子）或 replay（均匀值数组）之一；'
      + '本内核不接受「缺随机源」（不读时钟、不用 Math.random）。',
    );
  }
  const hasSeed = options.seed !== undefined && options.seed !== null;
  const hasReplay = Array.isArray(options.replay) && options.replay.length >= 2;
  const randomFn = typeof options.random === 'function' ? options.random : (typeof options.rng === 'function' ? options.rng : null);

  const provided = [hasSeed, hasReplay, randomFn !== null].filter(Boolean).length;
  if (provided === 0) {
    throw new PaipanInputError(
      'missing_random_source',
      '潮汕圣杯掷筊必须提供 seed（种子）或 replay（均匀值数组）之一；本内核不读时钟、不用 Math.random。',
    );
  }
  if (provided > 1) {
    throw new PaipanInputError('conflicting_random_source', 'seed、replay 与自定义随机源只能提供一种。');
  }

  if (hasSeed) {
    const seed = options.seed;
    const ok = (typeof seed === 'number' && Number.isFinite(seed)) || (typeof seed === 'string');
    if (!ok) throw new PaipanInputError('invalid_seed', '随机种子必须是有限数字或文本。');
    return { mode: 'seeded', seed, hashInput: { capability: 'shengbei', mode: 'seeded', seed: String(seed) } };
  }
  if (hasReplay) {
    const samples = options.replay.slice(0, 2);
    for (const v of samples) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
        throw new PaipanInputError('invalid_replay', '随机重放样本必须是 [0,1) 区间内的数字。');
      }
    }
    return { mode: 'replay', samples, hashInput: { capability: 'shengbei', mode: 'replay', samples } };
  }
  return { mode: 'custom', random: randomFn, hashInput: { capability: 'shengbei', mode: 'custom' } };
}

/* ============================ ② 起局（定面定态） ============================ */

/**
 * ② 按模式取两个均匀值 → 两面 → 三态。
 *
 * @param {object} normalized ①的输出
 * @returns {{u1:number, u2:number, faces:string[], state:string}}
 */
export function resolveShengbeiDraw(normalized) {
  let u1;
  let u2;
  if (normalized.mode === 'seeded') {
    const next = shengbeiMulberry32(shengbeiSeedHash(normalized.seed));
    u1 = next();
    u2 = next();
  } else if (normalized.mode === 'replay') {
    u1 = normalized.samples[0];
    u2 = normalized.samples[1];
  } else {
    u1 = normalized.random();
    u2 = normalized.random();
  }
  for (const u of [u1, u2]) {
    if (typeof u !== 'number' || !Number.isFinite(u) || u < 0 || u >= 1) {
      throw new PaipanInputError('invalid_random_value', '随机源必须返回大于等于 0 且小于 1 的数字。');
    }
  }
  const faces = [shengbeiFaceOf(u1), shengbeiFaceOf(u2)];
  return { u1, u2, faces, state: shengbeiStateOf(faces) };
}

/* ============================ ③ 输出装配 ============================ */

/**
 * ③ 输出装配（生产契约形状，stripInternal 后透传）。
 *
 * @param {{normalized:object, draw:object, now:Date}} parts
 * @returns {object}
 */
export function assembleShengbei({ normalized, draw, now }) {
  const st = SHENGBEI_STATES[draw.state];
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const randomMeta = { mode: normalized.mode, samples: [draw.u1, draw.u2] };
  if (normalized.mode === 'seeded') randomMeta.seed = normalized.seed;

  return {
    state: draw.state,
    stateCn: st.cn,
    short: st.short,
    meaning: SHENGBEI_MEANING[draw.state],
    blocks: draw.faces.map((f) => ({ face: f, faceCn: SHENGBEI_FACE_CN[f] })),
    count: 2,
    draw: {
      method: 'random',
      count: 2,
      samples: [draw.u1, draw.u2],
    },
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: ALGORITHM,
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `shengbei.draw:${fnv1aHash(`${stableStringify(normalized.hashInput)}#id`)}`,
      random: randomMeta,
    },
  };
}

/* ============================ 对外能力 ============================ */

/**
 * 潮汕圣杯（掷筊）—— 确定性三态判定。
 *
 * @param {object} options `{ seed?, replay?, random?, rng?, now? }`
 *   - `seed`：数字（有限）或文本 → mulberry32(FNV-1a32(String(seed)))，可复现。
 *   - `replay`：非空 [0,1) 数字数组 → 取前两个复现同一次掷杯（重放/前端演出固定落面用）。
 *   - `random` / `rng`：注入的随机源函数（必须返回 [0,1) 数字）。
 *   - `now`：可选，仅用于 `meta.calculatedAt`（便于测试取固定值）。
 * @returns {object} 生产契约形状的掷筊结果（state/stateCn/short/meaning/blocks/count/draw/meta）
 * @throws {PaipanInputError} 缺随机源 / 模式冲突 / 非法种子 / 非法重放样本 / 非法随机值
 */
export function drawShengbeiCore(options) {
  const normalized = normalizeShengbeiInput(options);   // ① 输入归一化
  const draw = resolveShengbeiDraw(normalized);         // ② 起局（随机源 → 两面 → 三态）
  const now = options && options.now instanceof Date ? options.now : new Date();
  return assembleShengbei({ normalized, draw, now });   // ③ 输出装配
}

export default drawShengbeiCore;
