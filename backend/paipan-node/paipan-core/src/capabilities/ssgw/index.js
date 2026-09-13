/**
 * 命理 · 自研排盘内核 · 能力：观音灵签（ssgw）
 * ---------------------------------------------------------------------------
 * 导出 `drawRandomSignCore(options)` —— 与旧实现 `drawRandomSign(options)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状）。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 normalizeInput —— 三模式互斥校验（seed / replay / 注入随机源），缺随机源抛错
 *   ② 起局        resolveDraw     —— 按模式取均匀值 → 池下标 → 签（规则全部取自 rules/ssgw.js）
 *   ③ 格局判定    resolveSignCopy —— 吉凶等级 + 主题键（纯查表，无 IO、无随机）
 *   ④ 输出装配    assemble
 *
 * == 对拍实测确认的口径（黑盒探针，禁止读旧实现源码）==
 *   1. **随机源＝mulberry32(FNV-1a32(String(seed)))**，只取第一次返回值；**下标＝floor(u × 池大小)**。
 *      实测：seed 0/1/2/123 → 池下标 45/76/63/14；seed 7 → u = 0.5916928979568183（与旧实现
 *      meta.random.samples[0] 逐位一致）。池大小 92、签号 = 池下标 + 1。
 *      ⚠ 一处容易搞错的地方：种子哈希必须是「String(seed) 的每个 UTF-16 code unit 整体异或一次」，
 *      不是「先低字节后高字节各乘一次」（后者给出 82/32/58/32，不命中）。
 *   2. **模式互斥**：seed / replay / 注入随机源只能给一种，同时给会抛错。
 *      replay 是**均匀值数组**（不是池下标）：取第一个元素 floor(u × 92) 定下标。
 *   3. `draw.method` 恒为 `'random'`（三种模式都一样）；`draw.poolSize` 恒为 92。
 *   4. 均匀值必须落在 [0,1)，否则抛错；seed 必须是有限数字或文本。
 *   5. **池只到 92 签**（93–100 在签表内但不可达），本内核照此定池（rules/ssgw.js 已登记）。
 *
 * == 与旧实现的有意分歧（信息性，不进关键字段）==
 *   - **不读时钟**：旧实现的 `timestamp` 与 `ganzhi` 都取自「调用时刻」（实测传 customDate/now/date
 *     等键一律被忽略）。本内核按 README §6 纪律不读时钟，因此：
 *       · 不输出 `timestamp`；
 *       · `ganzhi` 只在调用方**显式注入 `options.moment`**（ISO 字符串 / Date / epoch 毫秒）时计算，
 *         否则输出 `null`（确定性优先，属已登记的有意分歧）；
 *       · `meta.calculatedAt` 是唯一允许的时间戳（信息性，对拍被忽略）。
 *   - **缺随机源抛错**：旧实现缺 seed/replay/随机源时静默回落 `Math.random`（实测
 *     meta.random.mode === 'system'）。本内核一律抛 `PaipanInputError('missing_random_source')`。
 *   - **签题 / 签诗 / 释义 / 故事/白话**：按母节 §3.6 铁则**自行撰写或从公网重采**（见 rules/ssgw.js
 *     的数据来源登记），不复制旧实现文本，故与旧实现文本不同（对拍报告里逐条列出）。
 */

import { Solar } from 'lunar-typescript';
import {
  SSGW_DRAW_POOL_NUMBERS,
  SSGW_RULES,
  SSGW_SIGN_COUNT,
  SSGW_SIGNS,
  ssgwMulberry32,
  ssgwSeedHash,
  ssgwSignByNumber,
  ssgwSignInPool,
} from '../../rules/ssgw.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta.engineVersion —— 自研内核版本（与旧实现的 0.2.2 有意不同，属信息性差异）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致（换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** meta.algorithm —— 与旧实现同一算法标识（机器标签，非文案）。 */
export const ALGORITHM = 'ssgw.draw';

/** 抽取池大小（＝ SSGW_DRAW_POOL_NUMBERS.length；旧实现实测 92）。 */
export const POOL_SIZE = SSGW_DRAW_POOL_NUMBERS.length;

/** 东八区偏移（分钟）。全内核唯一处定义时区口径。 */
const CST_OFFSET_MINUTES = 480;

/** 时干支五鼠遁表（与 xiaoliuren 同一口径；本文件不 import 别的 capability，故就地复述口诀）。 */
const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲',
  乙: '丙', 庚: '丙',
  丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚',
  戊: '壬', 癸: '壬',
});
const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 内核输入错误（缺输入 / 模式冲突 / 非法随机源）。调用方据此返回 400。 */
export class PaipanInputError extends Error {
  /**
   * @param {string} code 机器可读错误码
   * @param {string} message 中文错误信息
   */
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/** 数字补零。 */
const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0');

/** 取模（保证非负）。 */
const mod = (n, m) => ((Math.trunc(n) % m) + m) % m;

/**
 * 把 `moment` 归一化成东八区挂钟时刻（与小六壬同一口径；不依赖进程本地时区）。
 * @param {Date|string|number} value 注入时刻
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,second:number}}
 */
function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) instantMs = value.getTime();
  else if (typeof value === 'number' && Number.isFinite(value)) instantMs = value;
  else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_moment', `moment 无法解析（支持 ISO 8601 / Date / epoch 毫秒）: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    let offsetMinutes = CST_OFFSET_MINUTES;
    if (tz === 'Z') offsetMinutes = 0;
    else if (tz) {
      const sign = tz[0] === '-' ? -1 : 1;
      const body = tz.slice(1).replace(':', '');
      offsetMinutes = sign * (Number(body.slice(0, 2)) * 60 + Number(body.slice(2, 4)));
    }
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    instantMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - offsetMinutes * 60000;
    const check = new Date(instantMs + offsetMinutes * 60000);
    if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() + 1 !== parts.month || check.getUTCDate() !== parts.day
      || check.getUTCHours() !== parts.hour || check.getUTCMinutes() !== parts.minute || check.getUTCSeconds() !== parts.second) {
      throw new PaipanInputError('invalid_moment', `moment 不是真实存在的时刻: ${value}`);
    }
  } else {
    throw new PaipanInputError('invalid_moment', `moment 类型不支持（需 Date / ISO 字符串 / epoch 毫秒）: ${typeof value}`);
  }
  if (!Number.isFinite(instantMs)) throw new PaipanInputError('invalid_moment', 'moment 不是有效日期。');
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/**
 * 注入时刻 → 四柱干支（年/月/日取「立春精确换年 / 节气精确换月 / 晚子时换日」口径，与内核其余能力一致）。
 * @param {object} wall 东八区挂钟字段
 * @returns {{year:string,month:string,day:string,hour:string}}
 */
function ganZhiOf(wall) {
  const lunar = Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunar();
  const yearGz = lunar.getYearInGanZhiExact();
  const monthGz = lunar.getMonthInGanZhiExact();
  const dayGz = lunar.getDayInGanZhiExact();
  const hourIndex = wall.hour === 23 ? 12 : Math.floor((wall.hour + 1) / 2);
  const startGan = WU_SHU_DUN[dayGz.slice(0, 1)];
  const step = mod(hourIndex, 12);
  const hourGz = `${GAN[(GAN.indexOf(startGan) + step) % 10]}${ZHI[step]}`;
  return { year: yearGz, month: monthGz, day: dayGz, hour: hourGz };
}

/* ============================ ① 输入归一化 ============================ */

/**
 * ① 输入归一化：三模式互斥（seed / replay / 注入随机源），校验严格照对拍实测口径。
 *
 * @param {object|undefined|null} options 调用参数
 * @returns {{mode:'seeded'|'replay'|'custom', seed?: any, replay?: number[], random?: Function,
 *   wall: object|null, hashInput: object}}
 */
export function normalizeInput(options) {
  if (options === null || options === undefined || typeof options !== 'object' || Array.isArray(options)) {
    throw new PaipanInputError(
      'missing_random_source',
      '观音灵签抽签必须提供 seed（种子）或 replay（均匀值数组）之一；'
      + '本内核不接受「缺随机源」（旧实现在缺随机源时静默回落 Math.random，实测 meta.random.mode === \'system\'，属已登记的缺陷，本内核不沿用）。',
    );
  }
  const hasSeed = options.seed !== undefined && options.seed !== null;
  const hasReplay = options.replay !== undefined && options.replay !== null;
  const randomFn = typeof options.random === 'function' ? options.random : (typeof options.rng === 'function' ? options.rng : null);
  if (typeof options.random !== 'undefined' && options.random !== null && typeof options.random !== 'function' && typeof options.rng !== 'function') {
    throw new PaipanInputError('invalid_random_source', '自定义随机源必须是函数。');
  }

  const provided = [hasSeed, hasReplay, randomFn !== null].filter(Boolean).length;
  if (provided === 0) {
    throw new PaipanInputError(
      'missing_random_source',
      '观音灵签抽签必须提供 seed（种子）或 replay（均匀值数组）之一；本内核不读时钟、不用 Math.random。',
    );
  }
  if (provided > 1) {
    throw new PaipanInputError('conflicting_random_source', 'seed、replay 与自定义随机源只能提供一种。');
  }

  const moment = options.moment !== undefined ? options.moment : undefined;
  const wall = moment === undefined ? null : toCstWallClock(moment);

  if (hasSeed) {
    const seed = options.seed;
    const ok = (typeof seed === 'number' && Number.isFinite(seed)) || (typeof seed === 'string');
    if (!ok) throw new PaipanInputError('invalid_seed', '随机种子必须是有限数字或文本。');
    return { mode: 'seeded', seed, wall, hashInput: { capability: 'ssgw', mode: 'seeded', seed: String(seed) } };
  }
  if (hasReplay) {
    const replay = options.replay;
    if (!Array.isArray(replay) || replay.length === 0) {
      throw new PaipanInputError('invalid_replay', '随机重放样本必须是非空数组。');
    }
    for (const v of replay) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 1) {
        throw new PaipanInputError('invalid_replay', '随机重放样本必须是 [0,1) 区间内的数字。');
      }
    }
    return { mode: 'replay', replay: replay.slice(), wall, hashInput: { capability: 'ssgw', mode: 'replay', replay: replay.slice() } };
  }
  return { mode: 'custom', random: randomFn, wall, hashInput: { capability: 'ssgw', mode: 'custom' } };
}

/* ============================ ② 起局 ============================ */

/**
 * ② 按模式取均匀值 → 池下标 → 签对象。
 * 口径：下标 = floor(u × 池大小)；签号 = 池下标 + 1（对拍实测）。
 *
 * @param {object} normalized ①的输出
 * @returns {{uniform:number, selectedIndex:number, selectedNumber:number, poolSize:number, sign:object}}
 */
export function resolveDraw(normalized) {
  const poolSize = POOL_SIZE;
  let uniform;
  if (normalized.mode === 'seeded') {
    uniform = ssgwMulberry32(ssgwSeedHash(normalized.seed))();
  } else if (normalized.mode === 'replay') {
    uniform = normalized.replay[0];
  } else {
    uniform = normalized.random();
  }
  if (typeof uniform !== 'number' || !Number.isFinite(uniform) || uniform < 0 || uniform >= 1) {
    throw new PaipanInputError('invalid_random_value', '随机源必须返回大于等于 0 且小于 1 的数字。');
  }
  const selectedIndex = Math.min(poolSize - 1, Math.floor(uniform * poolSize));
  const selectedNumber = SSGW_DRAW_POOL_NUMBERS[selectedIndex];
  return { uniform, selectedIndex, selectedNumber, poolSize, sign: ssgwSignInPool(selectedIndex) };
}

/* ============================ ③ 格局判定 ============================ */

/**
 * 本内核自撰的吉凶主题词（按等级给两组主题键，替代旧实现的内容型主题键）。
 * 说明：主题键属**白话组织方式**，按母节 §3.6 「按主题从零生成」自行拟定。
 */
const THEME_KEYS = Object.freeze({
  上签: Object.freeze(['机会所在', '如何把握']),
  中签: Object.freeze(['当前处境', '如何推进']),
  下签: Object.freeze(['风险所在', '如何规避']),
});

/**
 * 本内核自撰的分等级释义模板（零复制旧实现；语义只作稳妥取向，不作结果保证）。
 */
const COPY = Object.freeze({
  上签: Object.freeze({
    总论: '此签属上签，气象明朗：眼下的事有可乘之势，值得顺势推进，但「顺势」不等于「不必准备」。',
    主题1: '机会多来自把事情做扎实之后自然出现的协作与认可，而非临时抱佛脚。',
    主题2: '把可做的一步先落地，再谈更大的安排；节气、档期、人手这类现实条件优先核对。',
    提醒: '好运要靠接得住：把该准备的准备好，机会来时才不至于手忙脚乱。',
    事业: '适合推进既定计划、争取协作与曝光；先做小样验证再放大。',
    财运: '财势偏顺，但要盯现金流与合约细节，不宜靠单一机会押注。',
    感情: '关系气氛柔和，适合把话说开；用心经营胜过刻意安排。',
    学业: '状态在线，适合冲刺与实战演练，注意休息以免后程乏力。',
    健康: '整体平稳，作息规律比临时进补更有效。',
    行动建议: '把目前最有把握的一件事在本周内做出可见进展。',
    风险提醒: '别把顺境当成本事，也别把别人的配合视为理所当然。',
  }),
  中签: Object.freeze({
    总论: '此签属中签，事情处在「未定」之象：既非不通，也非一蹴而就，关键在节奏与耐心。',
    主题1: '眼下的阻滞多与时机、信息不完整或反复商量有关，不是能力不足。',
    主题2: '把大目标拆成能验证的小步，边走边修正，比一次性求全更稳。',
    提醒: '先守后攻：把不确定的部分问清楚、写下来，再决定投入多少。',
    事业: '按部就班推进，先补齐流程与资料，避免临时变更方案。',
    财运: '守成优于扩张，量入为出；不熟的领域先小额试探。',
    感情: '需要沟通与磨合，别用猜测代替确认。',
    学业: '基础题与熟练度优先，忌贪多求快。',
    健康: '注意作息与情绪积累，久坐久熬的代价会延后显现。',
    行动建议: '列出接下来一个月能完成的 2–3 件确定事项，先把它们做完。',
    风险提醒: '别在信息不全时下重注，也别因短期没结果就推翻既定方向。',
  }),
  下签: Object.freeze({
    总论: '此签属下签，提示当前形势偏紧：不是注定不成，而是「现在这样做」的代价偏高。',
    主题1: '风险多来自硬扛与赶时间：越急越容易在小环节出错。',
    主题2: '更适合先收缩范围、稳住基本盘，等条件改善再图推进。',
    提醒: '宜守不宜进，先止损、先照规矩来；把不必要的战场先关掉。',
    事业: '暂缓重大变更与新承诺，先把既有事项收尾。',
    财运: '宜保守，预留现金与缓冲；不做超出承受力的决定。',
    感情: '避免在情绪高点上做决定，先降温再沟通。',
    学业: '不追新内容，回头补基础与错题更有效。',
    健康: '留意睡眠与旧疾复发，必要时及时就医而不是硬撑。',
    行动建议: '本期以「减少风险 + 保住信用」为第一目标，最多推进一件确定的事。',
    风险提醒: '忌争一时之气、忌借贷冒险、忌把希望押在单一来源上。',
  }),
});

/**
 * ③ 格局判定：由签（吉凶等级）解析出释义条目（纯查表）。
 *
 * @param {object} sign rules/ssgw.js 的签对象
 * @returns {{luck:string, themeKeys: string[], copy: object}}
 */
export function resolveSignCopy(sign) {
  const luck = sign.luck || '中签';
  const copy = COPY[luck] || COPY.中签;
  const themeKeys = THEME_KEYS[luck] || THEME_KEYS.中签;
  return { luck, themeKeys, copy };
}

/* ============================ ④ 输出装配 ============================ */

/**
 * ④ 输出装配（键序与旧实现 stripInternal 后逐键对齐）。
 *
 * @param {{normalized:object, draw:object, copy:object, now:Date}} parts
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, draw, copy, now }) {
  const { sign } = draw;
  const { luck, themeKeys, copy: text } = copy;

  const details = {
    吉凶: luck,
    解签总论: `此签为第${sign.number}签「${sign.title}」——${sign.poem.replace(/[\n\r]+/g, '')}${text.总论}`,
    [themeKeys[0]]: text.主题1,
    [themeKeys[1]]: text.主题2,
    提醒: text.提醒,
    此签核心: `${sign.title}：${text.主题1}`,
    核心寓意: text.主题2,
    事业: text.事业,
    财运: text.财运,
    感情: text.感情,
    学业: text.学业,
    健康: text.健康,
    行动建议: text.行动建议,
    风险提醒: text.风险提醒,
  };

  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const randomMeta = { mode: normalized.mode, samples: [draw.uniform] };
  if (normalized.mode === 'seeded') randomMeta.seed = normalized.seed;

  return {
    number: sign.number,
    title: `第${sign.number}签 · ${sign.title}（${luck}）`,
    poem: sign.poem,
    story: `典故：${sign.title}`,
    details,
    ganzhi: normalized.wall ? ganZhiOf(normalized.wall) : null,
    draw: {
      method: 'random',
      poolSize: draw.poolSize,
      selectedIndex: draw.selectedIndex,
      selectedNumber: draw.selectedNumber,
    },
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: ALGORITHM,
      model: undefined,
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `ssgw.draw:${fnv1aHash(`${stableStringify(normalized.hashInput)}#id`)}`,
      random: randomMeta,
      diagnostics: undefined,
    },
  };
}

/* ============================ 对外能力 ============================ */

/**
 * 观音灵签抽签（自研内核）。
 *
 * @param {object} options `{ seed?, replay?, random?, rng?, moment?, now? }`
 *   - `seed`：数字（有限）或文本 → mulberry32(FNV-1a32(String(seed)))，可复现。
 *   - `replay`：非空 [0,1) 数字数组 → 取首值复现同一次抽取（重放老记录用）。
 *   - `random` / `rng`：注入的随机源函数（必须返回 [0,1) 数字）。
 *   - `moment`：可选，注入时刻（ISO / Date / epoch 毫秒）→ 计算 `ganzhi`；不注入则 `ganzhi` 为 null。
 *   - `now`：可选，仅用于 `meta.calculatedAt`（便于测试取固定值）。
 * @returns {object} 生产契约形状的抽签结果
 * @throws {PaipanInputError} 缺随机源 / 模式冲突 / 非法种子 / 非法重放样本 / 非法随机值
 */
export function drawRandomSignCore(options) {
  const normalized = normalizeInput(options);                 // ① 输入归一化
  const draw = resolveDraw(normalized);                       // ② 起局（随机源 → 池下标 → 签）
  const copy = resolveSignCopy(draw.sign);                    // ③ 格局判定（吉凶等级 → 释义）
  const now = options && options.now instanceof Date ? options.now : new Date();
  return assemble({ normalized, draw, copy, now });           // ④ 输出装配
}

/** 供调用方/测试查询本能力已知常量（唯一权威值在 rules/ssgw.js）。 */
export const SSGW_CORE_INFO = Object.freeze({
  signCount: SSGW_SIGN_COUNT,
  poolSize: POOL_SIZE,
  rules: SSGW_RULES,
  signs: SSGW_SIGNS,
  signByNumber: ssgwSignByNumber,
});

export default drawRandomSignCore;
