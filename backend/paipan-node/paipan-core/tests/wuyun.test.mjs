/**
 * 命理 · 自研排盘内核 · 五运六气单测（node:test）
 * ---------------------------------------------------------------------------
 * 运行：cd backend/paipan-node && node paipan-core/tests/wuyun.test.mjs
 *
 * 纪律：
 *   - 不触网、不读真实时钟（本能力无时间入参，天然无时钟依赖）。
 *   - 不依赖进程本地时区：交司日期一律用 UTC 运算，断言写死具体日期。
 *   - 关键约定与规则表**逐字写死断言**（值来自对拍实测，见 tools/_probe/wuyun/），
 *     约定一变测试先红（README §2「规则漂移」教训）。
 *
 * 值与旧实现的对应关系：`tests` 中所有写死值均已由
 *   tools/_probe/wuyun/probe-07-core-vs-legacy-300y.mjs
 * 在 1900–2199 全 300 年、252 个关键字段上与旧实现核对为 100% 一致。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateWuyunLiuqiCore,
  getWuyunLiuqiYearGanZhiCore,
  normalizeInput,
  resolveCalendar,
  computeAnnual,
  computeMovementSteps,
  computeQiSteps,
  hostGuestRelationKind,
  PaipanInputError,
} from '../src/capabilities/wuyun/index.js';
import {
  CONFORMITY_NAMES,
  GAN,
  GAN_YIN_YANG,
  GAN_YUN_ELEMENT,
  GUEST_QI_CYCLE,
  LIU_QI,
  MOVEMENT_STEPS,
  PING_QI_RULES,
  QI_STEPS,
  REL_BEGETS_ME,
  REL_CONTROLS_ME,
  REL_I_BEGET,
  REL_I_CONTROL,
  REL_SAME,
  SOURCE_RECONCILIATION,
  WUYUN_RULES,
  WU_YUN_ORDER,
  YEAR_RANGE,
  ZHI,
  ZHI_BENWEI_ELEMENT,
  ZHI_ELEMENT,
  ZHI_SITIAN_NAME,
  ganZhiOfYear,
  guestQiNameAtStep,
  wuXingRelation,
  zaiquanNameOfSitian,
} from '../src/rules/wuyun.js';
import { stripInternal, getPath } from '../src/pipeline/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (year) => calculateWuyunLiuqiCore({ year });

/* =========================================================================
 * ① 规则表（单一权威源）逐字断言 —— 防规则漂移
 * ========================================================================= */

test('① 天干化五运：十干逐字（甲己土、乙庚金、丙辛水、丁壬木、戊癸火）', () => {
  assert.deepEqual(GAN_YUN_ELEMENT, {
    甲: '土', 己: '土', 乙: '金', 庚: '金', 丙: '水', 辛: '水', 丁: '木', 壬: '木', 戊: '火', 癸: '火',
  });
  assert.equal(GAN.length, 10);
  assert.equal(ZHI.length, 12);
});

test('① 天干阴阳：五阳干太过、五阴干不及', () => {
  for (const gan of ['甲', '丙', '戊', '庚', '壬']) assert.equal(GAN_YIN_YANG[gan], '阳');
  for (const gan of ['乙', '丁', '己', '辛', '癸']) assert.equal(GAN_YIN_YANG[gan], '阴');
});

test('① 地支化六气（司天）：十二支逐字', () => {
  assert.deepEqual(ZHI_SITIAN_NAME, {
    子: '少阴君火', 午: '少阴君火',
    丑: '太阴湿土', 未: '太阴湿土',
    寅: '少阳相火', 申: '少阳相火',
    卯: '阳明燥金', 酉: '阳明燥金',
    辰: '太阳寒水', 戌: '太阳寒水',
    巳: '厥阴风木', 亥: '厥阴风木',
  });
  assert.equal(Object.keys(ZHI_SITIAN_NAME).length, 12);
});

test('① 六气表：六条逐字（名/三阴三阳/本气/五行）', () => {
  assert.deepEqual(LIU_QI.map((q) => [q.name, q.phase, q.qi, q.element]), [
    ['厥阴风木', '厥阴', '风', '木'],
    ['少阴君火', '少阴', '君火', '火'],
    ['少阳相火', '少阳', '相火', '火'],
    ['太阴湿土', '太阴', '湿', '土'],
    ['阳明燥金', '阳明', '燥', '金'],
    ['太阳寒水', '太阳', '寒', '水'],
  ]);
});

test('① 在泉＝司天升降之次后三位：六对逐字', () => {
  assert.deepEqual(GUEST_QI_CYCLE, ['少阳相火', '阳明燥金', '太阳寒水', '厥阴风木', '少阴君火', '太阴湿土']);
  const pairs = {
    少阴君火: '阳明燥金',
    太阴湿土: '太阳寒水',
    少阳相火: '厥阴风木',
    阳明燥金: '少阴君火',
    太阳寒水: '太阴湿土',
    厥阴风木: '少阳相火',
  };
  for (const [sitian, zaiquan] of Object.entries(pairs)) {
    assert.equal(zaiquanNameOfSitian(sitian), zaiquan, `${sitian} 之在泉应为 ${zaiquan}`);
  }
});

test('① 客气六步：司天落三之气、在泉落终之气（十二支逐字，防升降次序错）', () => {
  // 与 tools/_probe/wuyun/probe-08 输出逐字一致
  const expected = {
    子: ['太阳寒水', '厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金'],
    丑: ['厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水'],
    寅: ['少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水', '厥阴风木'],
    卯: ['太阴湿土', '少阳相火', '阳明燥金', '太阳寒水', '厥阴风木', '少阴君火'],
    辰: ['少阳相火', '阳明燥金', '太阳寒水', '厥阴风木', '少阴君火', '太阴湿土'],
    巳: ['阳明燥金', '太阳寒水', '厥阴风木', '少阴君火', '太阴湿土', '少阳相火'],
  };
  for (const [zhi, steps] of Object.entries(expected)) {
    const sitian = ZHI_SITIAN_NAME[zhi];
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => guestQiNameAtStep(sitian, n)), steps, `${zhi} 年客气六步`);
    assert.equal(steps[2], sitian, `${zhi} 年三之气应为司天`);
    assert.equal(steps[5], zaiquanNameOfSitian(sitian), `${zhi} 年终之气应为在泉`);
  }
  // 对冲支（子↔午、丑↔未、寅↔申、卯↔酉、辰↔戌、巳↔亥）同司天 ⇒ 同客气六步
  for (const [a, b] of [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]) {
    assert.equal(ZHI_SITIAN_NAME[a], ZHI_SITIAN_NAME[b], `${a}${b} 应同司天`);
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6].map((n) => guestQiNameAtStep(ZHI_SITIAN_NAME[a], n)),
      [1, 2, 3, 4, 5, 6].map((n) => guestQiNameAtStep(ZHI_SITIAN_NAME[b], n)),
    );
  }
});

test('① 五步交司边界：五条逐字（含传统日期序号与结束规则）', () => {
  assert.deepEqual(MOVEMENT_STEPS.map((s) => [s.label, s.startTerm, s.offsetDays, s.endTerm, s.endOffset, s.periodRule]), [
    ['初运', '大寒', 0, '春分', 12, '大寒日起，至春分后第12日'],
    ['二运', '春分', 13, '芒种', 9, '春分后第13日起，至芒种后第9日'],
    ['三运', '芒种', 10, '处暑', 6, '芒种后第10日起，至处暑后第6日'],
    ['四运', '处暑', 7, '立冬', 3, '处暑后第7日起，至立冬后第3日'],
    ['五运', '立冬', 4, 'NEXT_DAHAN', -1, '立冬后第4日起，至小寒末日'],
  ]);
});

test('① 六步节气分组：六组逐字', () => {
  assert.deepEqual(QI_STEPS.map((s) => [s.label, [...s.solarTerms]]), [
    ['初之气', ['大寒', '立春', '雨水', '惊蛰']],
    ['二之气', ['春分', '清明', '谷雨', '立夏']],
    ['三之气', ['小满', '芒种', '夏至', '小暑']],
    ['四之气', ['大暑', '立秋', '处暑', '白露']],
    ['五之气', ['秋分', '寒露', '霜降', '立冬']],
    ['终之气', ['小雪', '大雪', '冬至', '小寒']],
  ]);
});

test('① 岁会本位支与符会名序：逐字', () => {
  assert.deepEqual(ZHI_BENWEI_ELEMENT, { 卯: '木', 午: '火', 辰: '土', 戌: '土', 丑: '土', 未: '土', 酉: '金', 子: '水' });
  assert.deepEqual(CONFORMITY_NAMES, ['天符', '岁会', '太乙天符', '同天符', '同岁会']);
  assert.deepEqual(WU_YUN_ORDER, ['木', '火', '土', '金', '水']);
  assert.deepEqual(YEAR_RANGE, { min: 1900, max: 2199 });
});

test('① 平气关系对表逐字（太过被抑 / 不及得助）', () => {
  assert.deepEqual(PING_QI_RULES.太过, [[REL_I_BEGET, REL_CONTROLS_ME]]);
  assert.deepEqual(PING_QI_RULES.不及, [
    [REL_SAME, REL_SAME],
    [REL_SAME, REL_BEGETS_ME],
    [REL_SAME, REL_I_BEGET],
    [REL_BEGETS_ME, REL_SAME],
    [REL_I_BEGET, REL_BEGETS_ME],
  ]);
});

test('① 五行关系判定：五种关系封闭且互斥', () => {
  assert.equal(wuXingRelation('木', '木'), REL_SAME);
  assert.equal(wuXingRelation('木', '火'), REL_I_BEGET);
  assert.equal(wuXingRelation('木', '水'), REL_BEGETS_ME);
  assert.equal(wuXingRelation('木', '土'), REL_I_CONTROL);
  assert.equal(wuXingRelation('木', '金'), REL_CONTROLS_ME);
  // 全 5×5 组合都在五类之内
  const all = new Set();
  for (const a of WU_YUN_ORDER) for (const b of WU_YUN_ORDER) all.add(wuXingRelation(a, b));
  assert.deepEqual([...all].sort(), ['克我', '同', '我克', '我生', '生我'].sort());
});

test('① 规则聚合对象与各表同一引用（无第二份拷贝）', () => {
  assert.equal(WUYUN_RULES.yearRange, YEAR_RANGE);
  assert.equal(WUYUN_RULES.ganYunElement, GAN_YUN_ELEMENT);
  assert.equal(WUYUN_RULES.zhiSitianName, ZHI_SITIAN_NAME);
  assert.equal(WUYUN_RULES.liuQi, LIU_QI);
  assert.equal(WUYUN_RULES.movementSteps, MOVEMENT_STEPS);
  assert.equal(WUYUN_RULES.qiSteps, QI_STEPS);
  assert.equal(WUYUN_RULES.pingQiRules, PING_QI_RULES);
  assert.equal(WUYUN_RULES.conformityNames, CONFORMITY_NAMES);
  // 规则表全部冻结（禁改）
  for (const table of [GAN_YUN_ELEMENT, ZHI_SITIAN_NAME, PING_QI_RULES, MOVEMENT_STEPS, QI_STEPS, ZHI_BENWEI_ELEMENT]) {
    assert.equal(Object.isFrozen(table), true, '规则表必须 Object.freeze');
  }
});

/* =========================================================================
 * ② 已知样例（写死断言；值 = 对拍实测 100% 一致的旧实现输出）
 * ========================================================================= */

test('② 2024 甲辰：土运太宫太过、太阳寒水司天、太阴湿土在泉、不和、岁会＋同天符', () => {
  const r = run(2024);
  assert.equal(r.input.yearGanZhi, '甲辰');
  assert.equal(r.annualMovement.name, '土运');
  assert.equal(r.annualMovement.toneName, '太宫');
  assert.equal(r.annualMovement.strength, '太过');
  assert.equal(r.annualMovement.yinYang, '阳');
  assert.equal(r.sitian.name, '太阳寒水');
  assert.equal(r.zaiquan.name, '太阴湿土');
  assert.equal(r.annualRelation.kind, '不和');
  assert.deepEqual(r.annualConformities.names, ['岁会', '同天符']);
  assert.equal(r.annualConformities.suihui, true);
  assert.equal(r.annualConformities.tianfu, false);
  assert.equal(r.pathomechanism.isPingQi, false);
  assert.equal(r.pathomechanism.pingQiType, '太过偏亢');
});

test('② 2024 甲辰：五步主客运与公历区间（写死）', () => {
  const r = run(2024);
  assert.deepEqual(r.movementSteps.map((s) => s.hostMovement.toneName), ['太角', '少徵', '太宫', '少商', '太羽']);
  assert.deepEqual(r.movementSteps.map((s) => s.guestMovement.toneName), ['太宫', '少商', '太羽', '少角', '太徵']);
  assert.deepEqual(r.movementSteps.map((s) => s.hostGuestRelation.kind), Array(5).fill('主克客'));
  assert.deepEqual(r.movementSteps.map((s) => s.gregorianStart), ['2024-01-20', '2024-04-02', '2024-06-15', '2024-08-29', '2024-11-11']);
  assert.deepEqual(r.movementSteps.map((s) => s.gregorianEnd), ['2024-04-01', '2024-06-14', '2024-08-28', '2024-11-10', '2025-01-19']);
  assert.equal(r.movementSteps[0].guestRole, '中运起点');
  assert.equal(r.movementSteps[1].guestRole, undefined);
});

test('② 2026 丙午：水运太羽太过、少阴君火司天、阳明燥金在泉、无符会', () => {
  const r = run(2026);
  assert.equal(r.input.yearGanZhi, '丙午');
  assert.equal(r.annualMovement.element, '水');
  assert.equal(r.annualMovement.tone, '羽');
  assert.equal(r.annualMovement.toneStrength, '太');
  assert.equal(r.annualMovement.toneName, '太羽');
  assert.equal(r.annualMovement.strength, '太过');
  assert.deepEqual(r.sitian, { name: '少阴君火', phase: '少阴', qi: '君火', element: '火' });
  assert.deepEqual(r.zaiquan, { name: '阳明燥金', phase: '阳明', qi: '燥', element: '金' });
  assert.equal(r.annualRelation.kind, '不和');
  assert.deepEqual(r.annualConformities.names, []);
  assert.equal(r.pathomechanism.pingQiType, '太过偏亢');
});

test('② 2026 丙午：五步客运起中运、六步主客关系与区间（写死）', () => {
  const r = run(2026);
  assert.deepEqual(r.movementSteps.map((s) => s.guestMovement.toneName), ['太羽', '少角', '太徵', '少宫', '太商']);
  assert.deepEqual(r.movementSteps.map((s) => s.hostGuestRelation.kind), Array(5).fill('客生主'));
  assert.deepEqual(r.movementSteps.map((s) => s.gregorianStart), ['2026-01-20', '2026-04-02', '2026-06-15', '2026-08-30', '2026-11-11']);
  assert.deepEqual(r.movementSteps.map((s) => s.gregorianEnd), ['2026-04-01', '2026-06-14', '2026-08-29', '2026-11-10', '2027-01-19']);

  assert.deepEqual(r.qiSteps.map((s) => s.hostQi.name), [
    '厥阴风木', '少阴君火', '少阳相火', '太阴湿土', '阳明燥金', '太阳寒水',
  ]);
  assert.deepEqual(r.qiSteps.map((s) => s.guestQi.name), [
    '太阳寒水', '厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金',
  ]);
  assert.deepEqual(r.qiSteps.map((s) => s.hostGuestRelation.kind), ['客生主', '客生主', '同气', '同气', '客克主', '客生主']);
  assert.deepEqual(r.qiSteps.map((s) => s.gregorianStart), ['2026-01-20', '2026-03-20', '2026-05-21', '2026-07-23', '2026-09-23', '2026-11-22']);
  assert.deepEqual(r.qiSteps.map((s) => s.gregorianEnd), ['2026-03-19', '2026-05-20', '2026-07-22', '2026-09-22', '2026-11-21', '2027-01-19']);
  assert.equal(r.qiSteps[2].guestRole, '司天');
  assert.equal(r.qiSteps[5].guestRole, '在泉');
  assert.equal(r.qiSteps[0].guestRole, undefined);
});

test('② 1984 甲子：土运太过、少阴君火司天、顺化、无符会', () => {
  const r = run(1984);
  assert.equal(r.input.yearGanZhi, '甲子');
  assert.equal(r.annualMovement.toneName, '太宫');
  assert.equal(r.sitian.name, '少阴君火');
  assert.equal(r.zaiquan.name, '阳明燥金');
  assert.equal(r.annualRelation.kind, '顺化');
  assert.deepEqual(r.annualConformities.names, []);
  assert.deepEqual(r.movementSteps.map((s) => s.gregorianStart), ['1984-01-21', '1984-04-02', '1984-06-15', '1984-08-30', '1984-11-11']);
});

test('② 1900 庚子（范围下限）：太商太过、天刑、平气之岁（太过被抑）', () => {
  const r = run(1900);
  assert.equal(r.input.yearGanZhi, '庚子');
  assert.equal(r.annualMovement.toneName, '太商');
  assert.equal(r.annualRelation.kind, '天刑');
  assert.deepEqual(r.annualConformities.names, ['同天符']);
  assert.equal(r.pathomechanism.isPingQi, true);
  assert.equal(r.pathomechanism.pingQiType, '平气之岁');
  // 金运太过：支子水泄之（我生）＋司天火克之（克我）→ 平气
  assert.equal(r.annualRelation.movementElement, '金');
  assert.equal(computeAnnual(resolveCalendar(normalizeInput({ year: 1900 }))).relZhi, REL_I_BEGET);
  assert.equal(computeAnnual(resolveCalendar(normalizeInput({ year: 1900 }))).relSitian, REL_CONTROLS_ME);
});

test('② 2199 己亥（范围上限）：少宫不及、厥阴风木司天、五运收尾落到次年大寒前一日', () => {
  const r = run(2199);
  assert.equal(r.input.yearGanZhi, '己亥');
  assert.equal(r.annualMovement.toneName, '少宫');
  assert.equal(r.annualMovement.strength, '不及');
  assert.equal(r.sitian.name, '厥阴风木');
  assert.equal(r.zaiquan.name, '少阳相火');
  assert.equal(r.pathomechanism.pingQiType, '不及偏虚');
  assert.equal(r.movementSteps[4].gregorianEnd, '2200-01-19');
  assert.equal(r.qiSteps[5].gregorianEnd, '2200-01-19');
});

/* =========================================================================
 * ③ 60 甲子全覆盖
 * ========================================================================= */

test('③ 60 甲子全覆盖：1924–1983 恰好一轮，60 个组合各出现一次', () => {
  const seen = new Set();
  for (let year = 1924; year <= 1983; year += 1) {
    const r = run(year);
    const gz = r.input.yearGanZhi;
    assert.equal(gz.length, 2);
    assert.equal(gz, ganZhiOfYear(year));
    assert.equal(seen.has(gz), false, `干支重复: ${gz}`);
    seen.add(gz);
  }
  assert.equal(seen.size, 60);
  // 与公式枚举的 60 甲子集合完全相同
  const formula = new Set();
  for (let i = 0; i < 60; i += 1) formula.add(GAN[i % 10] + ZHI[i % 12]);
  assert.deepEqual([...seen].sort(), [...formula].sort());
});

test('③ 60 甲子：年支决定司天/在泉/客气六步，年干决定中运/太过不及（每组合自洽）', () => {
  for (let year = 1924; year <= 1983; year += 1) {
    const r = run(year);
    const gan = r.input.yearGanZhi[0];
    const zhi = r.input.yearGanZhi[1];
    assert.equal(r.annualMovement.stem, gan);
    assert.equal(r.annualMovement.element, GAN_YUN_ELEMENT[gan]);
    assert.equal(r.annualMovement.strength, GAN_YIN_YANG[gan] === '阳' ? '太过' : '不及');
    assert.equal(r.sitian.name, ZHI_SITIAN_NAME[zhi]);
    assert.equal(r.zaiquan.name, zaiquanNameOfSitian(ZHI_SITIAN_NAME[zhi]));
    assert.deepEqual(
      r.qiSteps.map((s) => s.guestQi.name),
      [1, 2, 3, 4, 5, 6].map((n) => guestQiNameAtStep(ZHI_SITIAN_NAME[zhi], n)),
    );
    // 主运五步恒为木火土金水；客运初运＝中运
    assert.deepEqual(r.movementSteps.map((s) => s.hostMovement.element), WU_YUN_ORDER);
    assert.equal(r.movementSteps[0].guestMovement.toneName, r.annualMovement.toneName);
    // 五步/六步区间连续无缝（次日相接），终之气/五运可跨到次年大寒前一日
    for (let i = 1; i < 5; i += 1) {
      const prevEnd = r.movementSteps[i - 1].gregorianEnd;
      const nextStart = r.movementSteps[i].gregorianStart;
      assert.equal(new Date(`${nextStart}T00:00:00Z`).getTime() - new Date(`${prevEnd}T00:00:00Z`).getTime(), 86400000,
        `${year} 五步应首尾相接（次日）: ${prevEnd} → ${nextStart}`);
    }
    for (let i = 1; i < 6; i += 1) {
      const prevEnd = r.qiSteps[i - 1].gregorianEnd;
      const nextStart = r.qiSteps[i].gregorianStart;
      assert.equal(new Date(`${nextStart}T00:00:00Z`).getTime() - new Date(`${prevEnd}T00:00:00Z`).getTime(), 86400000,
        `${year} 六步应首尾相接（次日）: ${prevEnd} → ${nextStart}`);
    }
  }
});

test('③ 60 甲子：平气恰为 10 个写死干支（太过 3 + 不及 7）', () => {
  const ping = [];
  const byStrength = { 太过: [], 不及: [] };
  for (let year = 1924; year <= 1983; year += 1) {
    const r = run(year);
    if (r.pathomechanism.isPingQi) {
      ping.push(r.input.yearGanZhi);
      byStrength[r.annualMovement.strength].push(r.input.yearGanZhi);
    }
  }
  assert.deepEqual(ping, ['戊辰', '乙酉', '丁亥', '己丑', '辛卯', '癸巳', '戊戌', '庚子', '辛亥', '己未']);
  assert.deepEqual(byStrength.太过, ['戊辰', '戊戌', '庚子']);
  assert.deepEqual(byStrength.不及, ['乙酉', '丁亥', '己丑', '辛卯', '癸巳', '辛亥', '己未']);
  // 已登记口径差异：《运气要诀》原注把乙卯也算平气，本内核与旧实现均不计（见 rules 文件头 §二.3）
  assert.equal(run(1975).input.yearGanZhi, '乙卯');
  assert.equal(run(1975).pathomechanism.isPingQi, false);
});

test('③ 60 甲子：符会逐年计数（天符12/岁会8/太乙天符4/同天符6/同岁会6，去重 26）', () => {
  const counts = { tianfu: 0, suihui: 0, taiyiTianfu: 0, tongTianfu: 0, tongSuihui: 0 };
  const union = new Set();
  for (let year = 1924; year <= 1983; year += 1) {
    const r = run(year);
    for (const key of Object.keys(counts)) if (r.annualConformities[key]) counts[key] += 1;
    if (r.annualConformities.names.length) union.add(r.input.yearGanZhi);
    // 太乙天符＝天符∧岁会；names 顺序恒为符会名序的子序
    assert.equal(r.annualConformities.taiyiTianfu, r.annualConformities.tianfu && r.annualConformities.suihui);
    assert.equal(r.annualConformities.tianfu, r.sitian.element === r.annualMovement.element);
    const idx = r.annualConformities.names.map((n) => CONFORMITY_NAMES.indexOf(n));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), 'names 顺序应与符会名序一致');
  }
  assert.deepEqual(counts, { tianfu: 12, suihui: 8, taiyiTianfu: 4, tongTianfu: 6, tongSuihui: 6 });
  assert.equal(union.size, 26);
  assert.equal(union.size, SOURCE_RECONCILIATION.distinctYearsByListedRules);
});

/* =========================================================================
 * ④ 确定性 / 纯函数性 / 纪律
 * ========================================================================= */

test('④ 确定性：同输入重复调用输出完全一致（无时钟、无随机）', () => {
  for (const year of [1900, 1975, 2024, 2026, 2199]) {
    const a = JSON.stringify(run(year));
    const b = JSON.stringify(run(year));
    assert.equal(a, b, `${year} 两次调用应完全相同`);
  }
});

test('④ 纯函数性：不改入参、输出与入参对象身份无关', () => {
  const params = Object.freeze({ year: 2026 });
  const r = calculateWuyunLiuqiCore(params);
  assert.equal(r.input.year, 2026);
  const params2 = { year: 2026 };
  assert.equal(JSON.stringify(calculateWuyunLiuqiCore(params2)), JSON.stringify(r));
  assert.deepEqual(Object.keys(params2), ['year'], '入参对象不应被添加字段');
});

test('④ 输出形状：不含内部字段（prompt / sources / calculationChain 一律不产出）', () => {
  const r = run(2026);
  assert.equal('prompt' in r, false);
  assert.equal('sources' in r, false);
  assert.equal('calculationChain' in r, false);
  // stripInternal 对结果无副作用（说明本内核本就无内部字段）
  assert.deepEqual(stripInternal(r), r);
  assert.deepEqual(Object.keys(r), [
    'input', 'annualMovement', 'sitian', 'zaiquan', 'annualRelation', 'annualConformities',
    'movementSteps', 'qiSteps', 'pathomechanism', 'limitations',
  ]);
  assert.equal(r.movementSteps.length, 5);
  assert.equal(r.qiSteps.length, 6);
  assert.equal(r.annualConformities.facts.length, 5);
  assert.equal(r.limitations.length, 5);
});

test('④ 交司只到「日」且不依赖进程本地时区（UTC 运算）', () => {
  const r = run(2026);
  for (const s of [...r.movementSteps, ...r.qiSteps]) {
    assert.match(s.gregorianStart, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(s.gregorianEnd, /^\d{4}-\d{2}-\d{2}$/);
  }
  // 五运结束 = 次年大寒前一日；终之气结束同
  const cal = resolveCalendar(normalizeInput({ year: 2026 }));
  assert.equal(r.movementSteps[4].gregorianEnd, '2027-01-19');
  assert.equal(r.qiSteps[5].gregorianEnd, '2027-01-19');
  assert.equal(cal.jieQi['NEXT_大寒'] - cal.jieQi['大寒'], 365);
});

test('④ 四段管线可单独调用且串起来等于入口（段间只传普通对象）', () => {
  const input = normalizeInput({ year: 2026 });
  const calendar = resolveCalendar(input);
  const annual = computeAnnual(calendar);
  const movementSteps = computeMovementSteps(annual, calendar.jieQi);
  const qiSteps = computeQiSteps(annual, calendar.jieQi);
  assert.deepEqual({ ...input }, { year: 2026 });
  assert.equal(typeof calendar.jieQi['大寒'], 'number');
  assert.equal(annual.sitianName, '少阴君火');
  assert.equal(movementSteps.length, 5);
  assert.equal(qiSteps.length, 6);
  // 段②产物可 JSON 化（无类实例、无 Date）
  assert.equal(JSON.parse(JSON.stringify(calendar)).gan, '丙');
});

test('④ 主客关系判定穷尽五类且对称', () => {
  assert.equal(hostGuestRelationKind('木', '木'), '同气');
  assert.equal(hostGuestRelationKind('木', '火'), '主生客');
  assert.equal(hostGuestRelationKind('火', '木'), '客生主');
  assert.equal(hostGuestRelationKind('木', '土'), '主克客');
  assert.equal(hostGuestRelationKind('土', '木'), '客克主');
  for (const a of WU_YUN_ORDER) for (const b of WU_YUN_ORDER) {
    assert.equal(WUYUN_RULES.hostGuestRelationKinds.includes(hostGuestRelationKind(a, b)), true);
  }
});

test('④ 年干支纯函数导出：与入口一致，且非整数抛错', () => {
  for (const year of [1900, 1924, 2024, 2026, 2199]) {
    assert.equal(getWuyunLiuqiYearGanZhiCore(year), ganZhiOfYear(year));
    assert.equal(run(year).input.yearGanZhi, ganZhiOfYear(year));
  }
  assert.throws(() => getWuyunLiuqiYearGanZhiCore('2026'), PaipanInputError);
});

/* =========================================================================
 * ⑤ 抛错路径（缺输入/越界：不猜、不回落当前时间）
 * ========================================================================= */

test('⑤ 缺 year / 形态不支持 / 非整数 / 越界 一律抛 PaipanInputError', () => {
  const cases = [
    [undefined, 'invalid_params'],
    [null, 'invalid_params'],
    [2026, 'invalid_params'],
    [[2026], 'invalid_params'],
    [{}, 'missing_year'],
    [{ year: undefined }, 'missing_year'],
    [{ year: null }, 'missing_year'],
    [{ year: '2026' }, 'invalid_year'],
    [{ year: 2026.5 }, 'invalid_year'],
    [{ year: NaN }, 'invalid_year'],
    [{ year: 1899 }, 'year_out_of_range'],
    [{ year: 2200 }, 'year_out_of_range'],
  ];
  for (const [params, code] of cases) {
    assert.throws(() => calculateWuyunLiuqiCore(params), (err) => {
      assert.equal(err.name, 'PaipanInputError');
      assert.equal(err.code, code, `入口 ${JSON.stringify(params)} 应报 ${code}`);
      return true;
    });
  }
  // 边界端点必须可用
  assert.equal(run(1900).input.year, 1900);
  assert.equal(run(2199).input.year, 2199);
});

/* =========================================================================
 * ⑥ 夹具清单与信息性字段纪律
 * ========================================================================= */

test('⑥ fixtures/wuyun.json：60 甲子全覆盖 + 关键字段可从 stripInternal 结果取到', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools', 'fixtures', 'wuyun.json'), 'utf8'));
  assert.equal(Array.isArray(doc.defaultKeyFields), true);
  assert.equal(Array.isArray(doc.fixtures), true);

  // 60 甲子全覆盖：夹具年份里出现的干支组合为 60 个
  const gzSet = new Set(doc.fixtures.map((f) => ganZhiOfYear(f.input.year)));
  assert.equal(gzSet.size, 60, `夹具应覆盖全部 60 个干支组合，实际 ${gzSet.size}`);
  // 范围端点与跨年代代表年存在
  const years = new Set(doc.fixtures.map((f) => f.input.year));
  for (const y of [1900, 1924, 1983, 1984, 1990, 2000, 2024, 2026, 2100, 2199]) {
    assert.equal(years.has(y), true, `夹具缺代表年 ${y}`);
  }
  // 夹具 input 形态统一为 {year}
  for (const f of doc.fixtures) assert.deepEqual(Object.keys(f.input), ['year']);

  // 关键字段全部可从结果取到（防字段名漂移）
  const r = stripInternal(run(2026));
  const missing = doc.defaultKeyFields.filter((p) => getPath(r, p) === undefined
    && !/guestRole$/.test(p));
  assert.deepEqual(missing, [], `关键字段取不到: ${missing.join(', ')}`);
});

test('⑥ 关键字段不含白话文案；文案字段也不漏进关键字段清单', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools', 'fixtures', 'wuyun.json'), 'utf8'));
  const prohibited = /(^|\.)(basis|rule|description|periodRule|summary|pingQiBasis|affectedZangFu|climaticPathology|treatmentGuideline)$|^limitations|yearGanZhiSource|sourceReconciliation/;
  const banned = doc.defaultKeyFields.filter((p) => prohibited.test(p));
  assert.deepEqual(banned, [], `关键字段里不应出现白话文案: ${banned.join(', ')}`);
});

test('⑥ 内核源码零 IO / 零时钟 / 零随机（文本纪律回归）', () => {
  const files = [
    path.join(here, '..', 'src', 'rules', 'wuyun.js'),
    path.join(here, '..', 'src', 'capabilities', 'wuyun', 'index.js'),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of ['Math.random', 'Date.now', 'process.env', 'new Date()', 'fetch(', 'node:fs', 'node:net', 'child_process']) {
      assert.equal(text.includes(forbidden), false, `${path.basename(file)} 不得出现 ${forbidden}`);
    }
  }
});
