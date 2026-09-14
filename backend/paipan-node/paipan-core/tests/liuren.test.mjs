/**
 * 命理 · 自研排盘内核 · 测试：大六壬（liuren）
 * 确定性：不触网、不读真实时钟、不依赖本地时区。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLiurenCore, PaipanInputError } from '../src/capabilities/liuren/index.js';

const FIX = '2024-06-15T10:30:00+08:00';

function strip(o) {
  if (Array.isArray(o)) return o.map(strip);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'meta' && typeof v === 'object') { out.meta = { engineVersion: v.engineVersion }; continue; }
      out[k] = strip(v);
    }
    return out;
  }
  return o;
}

test('锚点 2024-06-15 10:30：四柱甲辰/庚午/庚戌/辛巳 + 四课三传结构完整', () => {
  const r = generateLiurenCore({ customDate: FIX });
  assert.deepEqual(r.ganzhi, { year: '甲辰', month: '庚午', day: '庚戌', hour: '辛巳' });
  assert.equal(r.fourLessons.length, 4);
  assert.equal(r.threeTransmissions.length, 3);
  assert.equal(r.heavenlyPlate.length, 12);
  assert.equal(r.earthlyPlate.length, 12);
});

test('确定性：同输入两次深等（除 meta）', () => {
  assert.deepEqual(strip(generateLiurenCore({ customDate: FIX })), strip(generateLiurenCore({ customDate: FIX })));
});

test('三传/空亡/月将字段自洽', () => {
  const r = generateLiurenCore({ customDate: FIX });
  assert.ok(r.monthLeader);
  assert.ok(Array.isArray(r.xunKong) && r.xunKong.length === 2);
  assert.ok(r.transmissionRule);
  for (const t of r.threeTransmissions) {
    assert.ok(t.stage && t.branch && t.god);
  }
});

test('晚子时与月将换将：冬至当天月将为丑将（太阳过宫口径）', () => {
  const r = generateLiurenCore({ customDate: '2010-12-22T12:00:00+08:00' });
  assert.equal(r.monthLeader, '丑');
});

test('昴星课：1900-01-15 戊子日 巳/申/丑 三传（非递传）', () => {
  const r = generateLiurenCore({ customDate: '1900-01-15T09:00:00+08:00' });
  assert.equal(r.transmissionRule, '昴星法');
  assert.deepEqual(r.threeTransmissions.map((t) => t.branch), ['巳', '申', '丑']);
});

test('纯函数性：缺 customDate 抛 PaipanInputError', () => {
  assert.throws(() => generateLiurenCore({}), PaipanInputError);
  assert.throws(() => generateLiurenCore({ customDate: 'bad' }), PaipanInputError);
});
