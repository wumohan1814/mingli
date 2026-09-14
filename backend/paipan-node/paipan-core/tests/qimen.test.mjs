/**
 * 命理 · 自研排盘内核 · 测试：奇门时家（qimen）
 * 确定性：不触网、不读真实时钟、不依赖本地时区。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimenCore, PaipanInputError } from '../src/capabilities/qimen/index.js';
import { YANG_DUN_JIEQI, NINE_STARS, EIGHT_DOORS } from '../src/rules/qimen.js';

/** 2024-06-15 10:30 锚点（对拍实测：阳遁6局·上元·天柱·惊门·芒种） */
const FIX = '2024-06-15T10:30:00+08:00';

function strip(o) {
  if (Array.isArray(o)) return o.map(strip);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'meta' && typeof v === 'object') { out.meta = { engineVersion: v.engineVersion, schemaVersion: v.schemaVersion, algorithm: v.algorithm }; continue; }
      out[k] = strip(v);
    }
    return out;
  }
  return o;
}

test('锚点 2024-06-15 10:30：阳遁6局·上元·天柱·惊门·芒种·辛巳时', () => {
  const r = generateQimenCore({ customDate: FIX });
  assert.equal(r.isYangDun, true);
  assert.equal(r.juShu, 6);
  assert.equal(r.timeInfo.epoch, '上元');
  assert.equal(r.zhiFu, '天柱');
  assert.equal(r.zhiShi, '惊门');
  assert.equal(r.timeInfo.juTerm, '芒种');
  assert.equal(r.ganzhi.hour, '辛巳');
  assert.equal(r.scope, 'hour');
});

test('确定性：同输入两次深等（除 meta.calculatedAt）', () => {
  const a = strip(generateQimenCore({ customDate: FIX }));
  const b = strip(generateQimenCore({ customDate: FIX }));
  assert.deepEqual(a, b);
});

test('scope 差异：hour 用时辰旬首符使，day 用日干支旬首', () => {
  const hour = generateQimenCore({ customDate: FIX, scope: 'hour' });
  const day = generateQimenCore({ customDate: FIX, scope: 'day' });
  assert.notEqual(hour.zhiFu, day.zhiFu);
  assert.equal(day.scope, 'day');
});

test('置闰：2024-01-01 拆补 vs 置闰 局数不同（置闰挂下一节气）', () => {
  const chaibu = generateQimenCore({ customDate: '2024-01-01T10:30:00+08:00', qimenJuMethod: 'chaibu' });
  const zhirun = generateQimenCore({ customDate: '2024-01-01T10:30:00+08:00', qimenJuMethod: 'zhirun' });
  assert.notEqual(chaibu.juShu, zhirun.juShu);
});

test('九宫四盘：9 项、名称/方位/元素齐全、中五宫天盘空', () => {
  const r = generateQimenCore({ customDate: FIX });
  assert.equal(r.jiuGongGe.length, 9);
  const middle = r.jiuGongGe.find((g) => g.gong === 5);
  assert.equal(middle.tianPan.star, '');
  assert.equal(middle.tianPan.stem, '');
  assert.ok(r.jiuGongGe[0].diPan.stem);
  assert.ok(NINE_PALACES_CHECK(r.jiuGongGe));
});
function NINE_PALACES_CHECK(list) {
  return list.every((g) => g.name && g.direction && g.element && g.diPan && g.tianPan && g.renPan && g.shenPan);
}

test('规则表：三元表/九星/八门冻结且长度正确', () => {
  assert.equal(Object.keys(YANG_DUN_JIEQI).length, 12);
  assert.equal(Object.keys(NINE_STARS).length, 9);
  assert.equal(Object.keys(EIGHT_DOORS).length, 8);
  assert.ok(Object.isFrozen(YANG_DUN_JIEQI));
});

test('纯函数性：缺 customDate 抛 PaipanInputError；非法参数抛错', () => {
  assert.throws(() => generateQimenCore({}), PaipanInputError);
  assert.throws(() => generateQimenCore({ customDate: 'bad-date' }), PaipanInputError);
  assert.throws(() => generateQimenCore({ customDate: FIX, scope: 'weekly' }), PaipanInputError);
  assert.throws(() => generateQimenCore({ customDate: FIX, qimenMethod: 'bogus' }), PaipanInputError);
});
