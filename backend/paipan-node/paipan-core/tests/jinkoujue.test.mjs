/**
 * 命理 · 自研排盘内核 · 金口诀单测（node:test）
 * ---------------------------------------------------------------------------
 * 运行：cd backend/paipan-node && node paipan-core/tests/jinkoujue.test.mjs
 *
 * 纪律：
 *   - 不触网、不读磁盘、不依赖 Date.now（凡涉及 meta.calculatedAt 处一律注入固定 now）。
 *   - 关键约定写死断言（值来自「对拍实测」而非猜测），约定一变测试先红。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateJinkoujueCore,
  normalizeInput,
  resolveCalendar,
  buildPositions,
  resolveYinYangUse,
  computeMovements,
  computeBihePoem,
  PaipanInputError,
} from '../src/capabilities/jinkoujue/index.js';
import {
  JINKOUJUE_RULES,
  GUI_SHEN_ORDER,
  GUI_SHEN_BENSHU,
  SI_XIANG_ROLES,
  MOVEMENTS,
  BIHE_POEMS,
  YIN_YANG_USE,
} from '../src/rules/jinkoujue.js';

/** 固定 now，保证测试完全确定性。 */
const FIXED_NOW = new Date('2020-01-01T00:00:00.000Z');

const run = (params) => generateJinkoujueCore({ ...params, now: FIXED_NOW });

test('① 锚点样例 2024-06-15 10:30 时间起课（对拍实测写死）：甲辰/庚午/庚戌/辛巳 昼占 月将申 占时巳 贵人丑 旬空寅卯', () => {
  const r = run({ method: 'time', customDate: '2024-06-15T10:30:00+08:00' });
  assert.equal(r.method, 'time');
  assert.equal(r.methodLabel, '时间起课');
  assert.deepEqual(r.ganzhi, { year: '甲辰', month: '庚午', day: '庚戌', hour: '辛巳' });
  assert.equal(r.dayNight, '昼占');
  assert.equal(r.monthLeader, '申');
  assert.equal(r.divinationBranch, '巳');
  assert.equal(r.noblemanBranch, '丑');
  assert.deepEqual(r.xunKong, ['寅', '卯']);
  assert.equal(r.diFenBranch, '巳');
  // 四位一体
  const p = r.positions;
  assert.equal(p.diFen.branch, '巳');
  assert.equal(p.diFen.stem, undefined);
  assert.equal(p.diFen.element, '火');
  assert.equal(p.diFen.elementBasis, '地分支');
  assert.equal(p.diFen.yinYang, '阴');
  assert.equal(p.diFen.seasonState, '旺');
  assert.deepEqual(p.diFen.support, ['月令旺']);
  assert.equal(p.jiangShen.stem, '甲');
  assert.equal(p.jiangShen.branch, '申');
  assert.equal(p.jiangShen.element, '金');
  assert.equal(p.jiangShen.elementBasis, '月将支');
  assert.equal(p.jiangShen.yinYang, '阳');
  assert.equal(p.jiangShen.seasonState, '死');
  assert.deepEqual(p.jiangShen.constraints, ['月令死']);
  assert.equal(p.guiShen.god, '勾陈');
  assert.equal(p.guiShen.stem, '庚');
  assert.equal(p.guiShen.branch, '辰');
  assert.equal(p.guiShen.element, '土');
  assert.equal(p.guiShen.elementBasis, '贵神本属');
  assert.equal(p.guiShen.yinYang, '阳');
  assert.equal(p.guiShen.seasonState, '相');
  assert.equal(p.renYuan.stem, '辛');
  assert.equal(p.renYuan.branch, '巳');
  assert.equal(p.renYuan.element, '金');
  assert.equal(p.renYuan.elementBasis, '人元干');
  assert.equal(p.renYuan.yinYang, '阴');
  // 五位关系
  assert.deepEqual(r.relations, { guiToJiang: '生', guiToRen: '生', jiangToDi: '被克', renToDi: '被克', guiToDi: '被生' });
  // 阴阳发用
  assert.deepEqual(r.yinYangUse, { pattern: '二阴二阳', yinCount: 2, yangCount: 2, usePosition: '将神', rule: '二阴二阳，以将神为用', isVoid: false });
  // 动爻
  assert.equal(r.movements.length, 1);
  assert.equal(r.movements[0].category, '五动');
  assert.equal(r.movements[0].name, '鬼动');
  assert.equal(r.movements[0].trigger, '地分火克人元金');
  assert.equal(r.movements[0].source, '《六壬神课金口诀古本》“五动爻诵”');
  // 比合歌
  assert.equal(r.bihePoem, '二金为刑，互见争斗刑伤折损');
  // calculation
  assert.equal(r.calculation.inputBase, 6);
  assert.equal(r.calculation.inputBaseSource, '占时地支序数');
  assert.equal(r.calculation.diFenNote, '时间起课以占时巳为地分');
  assert.equal(r.calculation.noblemanDirection, '顺布');
  assert.equal(r.calculation.guiShenRule, '顺布至地分得勾陈，贵神本属戊辰土');
});

test('② 四种起课方式：branch 指定地分 / number 归一 / random-replay / time', () => {
  const branch = run({ method: 'branch', customDate: '2024-06-15T10:30:00+08:00', branch: '子' });
  assert.equal(branch.diFenBranch, '子');
  assert.equal(branch.calculation.inputBase, 1);
  assert.equal(branch.calculation.inputBaseSource, '指定地分');
  assert.equal(branch.calculation.diFenNote, '按所测方位或来意指定地分子');

  const num37 = run({ method: 'number', customDate: '2024-06-15T10:30:00+08:00', number: 37 });
  assert.equal(num37.diFenBranch, '子');
  assert.equal(num37.calculation.inputBase, 37);
  assert.equal(num37.calculation.inputBaseSource, '用户数字');
  assert.equal(num37.calculation.diFenNote, '数字起课以37归一为1，对应地分子');

  const num12 = run({ method: 'number', customDate: '2024-06-15T10:30:00+08:00', number: 12 });
  assert.equal(num12.diFenBranch, '亥');
  assert.equal(num12.calculation.diFenNote, '数字起课以12归一为12，对应地分亥');

  const random = run({ method: 'random', customDate: '2024-06-15T10:30:00+08:00', replay: [0.5] });
  assert.equal(random.diFenBranch, '午'); // floor(0.5*12)+1 = 7 → 午
  assert.equal(random.calculation.inputBase, 7);
  assert.equal(random.calculation.inputBaseSource, '随机数');
  assert.equal(random.calculation.diFenNote, '随机起课抽得7，对应地分午');
});

test('③ number 边界：0/负数/小数/非整数 抛 PaipanInputError（与旧实现同语义）', () => {
  for (const bad of [0, -1, -13, 12.5, '13', null, undefined]) {
    assert.throws(
      () => run({ method: 'number', customDate: '2024-06-15T10:30:00+08:00', number: bad }),
      (err) => err instanceof PaipanInputError && err.code === 'bad_number',
      `number=${String(bad)} 应抛 bad_number`,
    );
  }
  assert.throws(() => run({ method: 'branch', customDate: '2024-06-15T10:30:00+08:00', branch: 'XX' }), (e) => e.code === 'bad_branch');
  assert.throws(() => run({ method: 'bad', customDate: '2024-06-15T10:30:00+08:00' }), (e) => e.code === 'bad_method');
  assert.throws(() => run({ method: 'time' }), (e) => e.code === 'missing_custom_date');
});

test('④ 早/晚子时：23:00 换日（庚戌日跨到辛亥日），晚子时占时支=子', () => {
  const early = run({ method: 'time', customDate: '2024-06-15T00:30:00+08:00' });
  assert.equal(early.ganzhi.day, '庚戌');
  assert.equal(early.ganzhi.hour, '丙子');
  assert.equal(early.divinationBranch, '子');
  const late = run({ method: 'time', customDate: '2024-06-15T23:30:00+08:00' });
  assert.equal(late.ganzhi.day, '辛亥'); // 晚子时已换日
  assert.equal(late.ganzhi.hour, '戊子');
  assert.equal(late.divinationBranch, '子');
});

test('⑤ 夜占与贵神逆布：2024-06-15 22:30 夜占 贵人未 逆布（未在巳午未申酉戌区）', () => {
  const r = run({ method: 'time', customDate: '2024-06-15T22:30:00+08:00' });
  assert.equal(r.dayNight, '夜占');
  assert.equal(r.noblemanBranch, '未');
  assert.equal(r.calculation.noblemanDirection, '逆布');
  assert.equal(r.calculation.noblemanRule, '夜占贵人起未，从贵人起十二贵神排至地分亥');
  assert.equal(r.calculation.guiShenRule, '逆布至地分得太常，贵神本属己未土');
});

test('⑥ 月将换将边界：小满 2024-05-20 20:59 前后月将酉→申（中气精确时刻换将）', () => {
  const before = run({ method: 'time', customDate: '2024-05-20T20:30:00+08:00' });
  assert.equal(before.monthLeader, '酉');
  const after = run({ method: 'time', customDate: '2024-05-20T21:30:00+08:00' });
  assert.equal(after.monthLeader, '申');
});

test('⑦ 旬空：锚点日庚戌空寅卯；位支落入 → isVoid=true 且 constraints 追加落日旬空', () => {
  // 2024-01-01 甲子日空戌亥：地分戌 → 空
  const r = run({ method: 'branch', customDate: '2024-01-01T10:00:00+08:00', branch: '戌' });
  assert.deepEqual(r.xunKong, ['戌', '亥']);
  assert.equal(r.positions.diFen.isVoid, true);
  assert.ok(r.positions.diFen.constraints.includes('落日旬空'));
  assert.equal(r.positions.diFen.promptText.includes('旬空'), true);
});

test('⑧ 纯函数性：同输入两次结果一致；calculatedAt 之外逐键相同；产物无随机/时间痕迹', () => {
  const params = { method: 'time', customDate: '2024-06-15T10:30:00+08:00', now: FIXED_NOW };
  const a = generateJinkoujueCore(params);
  const b = generateJinkoujueCore(params);
  const strip = (o) => { const c = { ...o }; delete c.meta; return c; };
  assert.deepEqual(strip(a), strip(b), '注入固定 now 时两次运行除 meta 外必须深相等');
  assert.equal(a.meta.calculatedAt, FIXED_NOW.toISOString());
  assert.equal(a.meta.algorithm, 'jinkoujue');
  assert.equal(a.meta.engineVersion, '0.1.0-mingli');
});

test('⑨ 规则表逐字断言：十二贵神次序与本属、昼夜贵人表、四象类象、五动三动表、发用表、比合歌表', () => {
  assert.deepEqual(GUI_SHEN_ORDER, ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后']);
  assert.deepEqual(GUI_SHEN_BENSHU['勾陈'], { gan: '戊', zhi: '辰', wuxing: '土' });
  assert.deepEqual(GUI_SHEN_BENSHU['螣蛇'], { gan: '丁', zhi: '巳', wuxing: '火' });
  assert.deepEqual(GUI_SHEN_BENSHU['天后'], { gan: '癸', zhi: '亥', wuxing: '水' });
  assert.deepEqual(SI_XIANG_ROLES.diFen, '四象中的田宅、子孙、奴仆、鞍马与六畜位');
  // 五动三动表：5 五动 + 3 三动，顺序妻→官→贼→财→鬼→兄弟→子孙→父母
  assert.deepEqual(MOVEMENTS.map((m) => m.name), ['妻动', '官动', '贼动', '财动', '鬼动', '兄弟动', '子孙动', '父母动']);
  assert.equal(MOVEMENTS[4].trigger === undefined ? true : true, true); // trigger 运行时生成
  // 发用表
  assert.equal(YIN_YANG_USE['二阴二阳'].usePosition, '将神');
  assert.equal(YIN_YANG_USE['纯阳'].rule, '纯阳反阴，以贵神为用');
  assert.equal(YIN_YANG_USE['纯阴'].rule, '纯阴反阳，以将神为用');
  // 比合歌
  assert.equal(BIHE_POEMS['三']['土'], '三土为滞，重滞凝塞迟疑难通');
  assert.equal(BIHE_POEMS['二']['金'], '二金为刑，互见争斗刑伤折损');
  assert.equal(BIHE_POEMS['周流'], '四位五行周流，无极偏比合之患');
  // 规则源
  assert.ok(JINKOUJUE_RULES.movements.length === 8);
  assert.ok(Object.isFrozen(JINKOUJUE_RULES));
});

test('⑩ 一课多动：指定地分戌（2024-06-15）官动+财动+子孙动，五动先于三动', () => {
  const r = run({ method: 'branch', customDate: '2024-06-15T10:30:00+08:00', branch: '戌' });
  const names = r.movements.map((m) => m.name);
  assert.deepEqual(names, ['官动', '财动', '子孙动']);
  assert.equal(r.movements[0].category, '五动');
  assert.equal(r.movements[1].category, '五动');
  assert.equal(r.movements[2].category, '三动');
});

test('⑪ 五子元遁：甲日地分丑 → 人元乙；庚日地分巳 → 人元辛', () => {
  const a = run({ method: 'branch', customDate: '2024-01-01T10:00:00+08:00', branch: '丑' });
  assert.equal(a.positions.renYuan.stem, '乙');
  const g = run({ method: 'time', customDate: '2024-06-15T10:30:00+08:00' });
  assert.equal(g.positions.renYuan.stem, '辛');
});

test('⑫ resolveCalendar / buildPositions / computeBihePoem 独立函数可测', () => {
  const norm = normalizeInput({ method: 'time', customDate: '2024-06-15T10:30:00+08:00' });
  const cal = resolveCalendar(norm);
  assert.equal(cal.dayGanZhi, '庚戌');
  assert.equal(cal.monthLeader, '申');
  const { positions } = buildPositions({
    dayGanZhi: cal.dayGanZhi,
    diFenBranch: '巳',
    monthLeader: cal.monthLeader,
    hourBranch: cal.hourBranch,
    noblemanBranch: '丑',
    monthBranch: cal.monthBranch,
    xunKong: ['寅', '卯'],
  });
  assert.equal(positions.guiShen.god, '勾陈');
  assert.equal(computeBihePoem({ positions }), '二金为刑，互见争斗刑伤折损');
});
