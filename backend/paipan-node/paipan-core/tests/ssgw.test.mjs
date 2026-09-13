/**
 * 命理 · 自研排盘内核 · 单测 · 观音灵签（ssgw）
 * ---------------------------------------------------------------------------
 * 纪律（README §6）：不触网、不读真实时钟、不依赖进程本地时区、确定性。
 * 断言里的「旧实现实测值」全部来自黑盒探针（tools/_probe/probe-09/12/24/25），
 * 不是从任何旧实现源码抄来的。
 *
 * 运行：node paipan-core/tests/ssgw.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POOL_SIZE,
  SSGW_CORE_INFO,
  drawRandomSignCore,
  normalizeInput,
  resolveDraw,
  PaipanInputError,
} from '../src/capabilities/ssgw/index.js';
import {
  SSGW_DRAW_POOL_NUMBERS,
  SSGW_RULES,
  SSGW_SIGNS,
  SSGW_SIGN_COUNT,
  ssgwIndexFromSeed,
  ssgwMulberry32,
  ssgwSeedHash,
  ssgwSignByNumber,
  ssgwUniformFromSeed,
} from '../src/rules/ssgw.js';
import { stripInternal } from '../src/pipeline/index.js';

const FIXED_NOW = new Date('2026-01-01T00:00:00Z');

test('规则表：100 签、编号 1–100 恰好一次、抽取池 1–92', () => {
  assert.equal(SSGW_SIGN_COUNT, 100);
  assert.equal(SSGW_SIGNS.length, 100);
  const numbers = SSGW_SIGNS.map((s) => s.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(SSGW_DRAW_POOL_NUMBERS.length, 92);
  assert.deepEqual([...SSGW_DRAW_POOL_NUMBERS], Array.from({ length: 92 }, (_, i) => i + 1));
  assert.equal(POOL_SIZE, 92);
  assert.ok(Object.isFrozen(SSGW_SIGNS) && Object.isFrozen(SSGW_RULES) && Object.isFrozen(SSGW_DRAW_POOL_NUMBERS));
  for (const sign of SSGW_SIGNS) {
    assert.ok(Object.isFrozen(sign), `签 ${sign.number} 未冻结`);
    assert.ok(typeof sign.poem === 'string' && sign.poem.length > 0, `签 ${sign.number} 签诗为空`);
    assert.ok(['上签', '中签', '下签'].includes(sign.luck), `签 ${sign.number} 吉凶取值异常: ${sign.luck}`);
  }
});

test('PRNG 口径：seed → 池下标 与旧实现实测值一致（45/76/63/14）', () => {
  assert.equal(ssgwIndexFromSeed(0, 92), 45);
  assert.equal(ssgwIndexFromSeed(1, 92), 76);
  assert.equal(ssgwIndexFromSeed(2, 92), 63);
  assert.equal(ssgwIndexFromSeed(123, 92), 14);
  // 种子哈希＝「整段 UTF-16 code unit 异或」版 FNV-1a（不是拆高低字节那版）
  assert.equal(ssgwSeedHash(''), 0x811c9dc5);
  assert.equal(typeof ssgwSeedHash('abc'), 'number');
  // 首个均匀值逐位对拍（旧实现 meta.random.samples[0]）
  assert.equal(ssgwUniformFromSeed(7), 0.5916928979568183);
  assert.equal(ssgwUniformFromSeed(0), 0.49139764392748475);
  assert.equal(ssgwUniformFromSeed('abc'), 0.5166419988963753);
  // mulberry32 是纯函数：同种子同序列
  const a = ssgwMulberry32(ssgwSeedHash(7));
  const b = ssgwMulberry32(ssgwSeedHash(7));
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('抽取：selectedNumber = selectedIndex + 1，且同 seed 同结果（幂等）', () => {
  const first = drawRandomSignCore({ seed: 123, now: FIXED_NOW });
  const second = drawRandomSignCore({ seed: 123, now: FIXED_NOW });
  assert.equal(first.number, second.number);
  assert.equal(first.draw.selectedNumber, first.draw.selectedIndex + 1);
  assert.equal(first.draw.method, 'random');
  assert.equal(first.draw.poolSize, 92);
  assert.equal(first.number, ssgwIndexFromSeed(123, 92) + 1);
  assert.equal(first.number, 15);
  // 结构：stripInternal 后仍是生产契约形状
  const stripped = stripInternal(first);
  assert.ok(!('timestamp' in stripped));
  assert.ok('draw' in stripped && 'details' in stripped && 'ganzhi' in stripped && 'meta' in stripped);
  assert.equal(stripped.meta.random.mode, 'seeded');
  assert.equal(stripped.meta.random.samples.length, 1);
});

test('replay 模式＝均匀值数组（取首值），可与 seed 结果互相印证', () => {
  const u = ssgwUniformFromSeed(7);
  const bySeed = drawRandomSignCore({ seed: 7, now: FIXED_NOW });
  const byReplay = drawRandomSignCore({ replay: [u], now: FIXED_NOW });
  assert.equal(byReplay.draw.selectedIndex, bySeed.draw.selectedIndex);
  assert.equal(byReplay.meta.random.mode, 'replay');
  assert.equal(byReplay.meta.random.samples[0], u);
  assert.ok(!('seed' in byReplay.meta.random));
  // 多元素只取首值
  const multi = drawRandomSignCore({ replay: [0, 0.9, 0.5], now: FIXED_NOW });
  assert.equal(multi.draw.selectedIndex, 0);
  assert.equal(multi.meta.random.samples[0], 0);
});

test('注入随机源（random / rng）与均匀值边界', () => {
  const byFn = drawRandomSignCore({ random: () => 0.25, now: FIXED_NOW });
  assert.equal(byFn.draw.selectedIndex, 23);
  const byRng = drawRandomSignCore({ rng: () => 0.9999999, now: FIXED_NOW });
  assert.equal(byRng.draw.selectedIndex, 91);
  assert.equal(byRng.number, 92);
  assert.equal(byRng.meta.random.mode, 'custom');
  // 越界值抛错
  assert.throws(() => drawRandomSignCore({ random: () => 1, now: FIXED_NOW }), (err) => err instanceof PaipanInputError && err.code === 'invalid_random_value');
  assert.throws(() => drawRandomSignCore({ random: () => -0.5, now: FIXED_NOW }), (err) => err.code === 'invalid_random_value');
});

test('抛错路径：缺随机源 / 模式冲突 / 非法种子 / 非法重放样本 / 随机源不是函数', () => {
  assert.throws(() => drawRandomSignCore(undefined), (err) => err.code === 'missing_random_source');
  assert.throws(() => drawRandomSignCore({}), (err) => err.code === 'missing_random_source');
  assert.throws(() => drawRandomSignCore({ seed: 1, replay: [0.5] }), (err) => err.code === 'conflicting_random_source');
  assert.throws(() => drawRandomSignCore({ seed: 1, random: () => 0.1 }), (err) => err.code === 'conflicting_random_source');
  assert.throws(() => drawRandomSignCore({ seed: true }), (err) => err.code === 'invalid_seed');
  assert.throws(() => drawRandomSignCore({ seed: null }), (err) => err.code === 'missing_random_source');
  assert.throws(() => drawRandomSignCore({ replay: [] }), (err) => err.code === 'invalid_replay');
  assert.throws(() => drawRandomSignCore({ replay: [1] }), (err) => err.code === 'invalid_replay');
  assert.throws(() => drawRandomSignCore({ random: 0.5 }), (err) => err.code === 'invalid_random_source');
});

test('ganzhi 只在显式注入 moment 时给出（不读时钟）', () => {
  const noMoment = drawRandomSignCore({ seed: 7, now: FIXED_NOW });
  assert.equal(noMoment.ganzhi, null);
  assert.equal(noMoment.meta.calculatedAt, FIXED_NOW.toISOString());
  const withMoment = drawRandomSignCore({ seed: 7, moment: '2026-01-01T12:00:00+08:00', now: FIXED_NOW });
  // 12:00 为午时；乙亥日五鼠遁「乙庚丙作初」→ 子时丙子，顺推六位到午时得壬午
  assert.deepEqual(withMoment.ganzhi, { year: '乙巳', month: '戊子', day: '乙亥', hour: '壬午' });
  // 注入时刻不影响抽取结果（随机源与时刻解耦）
  assert.equal(withMoment.number, noMoment.number);
  assert.equal(withMoment.meta.calculatedAt, noMoment.meta.calculatedAt);
  assert.throws(() => drawRandomSignCore({ seed: 1, moment: '2026-13-01T00:00:00+08:00' }), (err) => err.code === 'invalid_moment');
});

test('签号解析：1–100 可取，越界与非法类型抛 RangeError；resolveSignByNumber 等价物', () => {
  assert.equal(ssgwSignByNumber(1).number, 1);
  assert.equal(ssgwSignByNumber(100).number, 100);
  for (const bad of [0, 101, -1, 1.5, '15', 'abc', undefined, null]) {
    assert.throws(() => ssgwSignByNumber(bad), RangeError);
  }
});

test('normalizeInput 不改入参，且归一化结果进入哈希', () => {
  const options = { seed: 42, replay: undefined };
  const snapshot = JSON.stringify(options);
  const normalized = normalizeInput(options);
  assert.equal(JSON.stringify(options), snapshot);
  assert.equal(normalized.mode, 'seeded');
  assert.equal(normalized.hashInput.seed, '42');
  const out = drawRandomSignCore({ seed: 42, now: FIXED_NOW });
  assert.equal(out.meta.inputHash.length, 16);
  assert.match(out.meta.resultId, /^ssgw\.draw:[0-9a-f]{8}$/);
  // 纯函数性：resolveDraw 对同一归一化输入给出同一结果
  const d1 = resolveDraw(normalized);
  const d2 = resolveDraw(normalizeInput({ seed: 42 }));
  assert.deepEqual(d1, d2);
});

test('SSGW_CORE_INFO 暴露权威常量（调用方不许抄第二份）', () => {
  assert.equal(SSGW_CORE_INFO.signCount, 100);
  assert.equal(SSGW_CORE_INFO.poolSize, 92);
  assert.equal(SSGW_CORE_INFO.rules, SSGW_RULES);
  assert.equal(SSGW_CORE_INFO.signs, SSGW_SIGNS);
});
