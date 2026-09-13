/**
 * 命理 · 自研排盘内核 · 真太阳时 + 中国夏令时（1986–1991）单测（node:test）
 * ---------------------------------------------------------------------------
 * 运行：cd backend/paipan-node && node paipan-core/tests/true-solar-time.test.mjs
 *
 * 纪律：
 *   - 不触网、不读磁盘、不读真实时钟（本能力不需要 now）、不依赖进程本地时区
 *     （全程只用公历年月日时分整数，不做 Date→挂钟换算）。
 *   - 关键口径写死断言（值来自**权威锚点**与**国务院公告年份表**，不是猜测）；
 *     口径一变测试先红。
 *   - 与 Python 镜像（backend/app/paipan/birthtime.py）的逐字段一致由
 *     tools/true-solar-crosscheck.mjs 交叉验证，并由 backend/tests/unit/test_birthtime.py 调用。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PaipanInputError,
  calculateTrueSolarTime,
  correctBirthTime,
  getChinaDst,
  normalizeInput,
  resolveDayOfYear,
} from '../src/capabilities/true-solar-time/index.js';
import {
  CHINA_DST_RANGES,
  CHINA_DST_RULES,
  EOT_ACCURACY,
  EOT_ANCHORS,
  EOT_FORMULA,
  LARGE_TRUE_SOLAR_DELTA_MINUTES,
  LSTM_DEGREES,
  UNCERTAINTY_MESSAGES,
  chinaDstRangeForYear,
  dayOfYear,
  daysInMonth,
  equationOfTimeMinutes,
  isLeapYear,
  monthDayKey,
  roundMinutes,
} from '../src/rules/true-solar-time.js';

/** 测试基准年（平年）；锚点值按月日给出，N 随平/闰年变化，故一律显式声明年份。 */
const COMMON_YEAR = 2025;

/** 月日 → 年序比较用（测试内部辅助）。 */
const mdKey = (anchor) => anchor.month * 100 + anchor.day;

/** 取某锚点在指定年的实现值（4 位小数）。 */
const anchorValue = (anchor, year = COMMON_YEAR) => (
  roundMinutes(equationOfTimeMinutes(dayOfYear(year, anchor.month, anchor.day)))
);

/** 从结果里取某个不确定项码（取不到返回 null）。 */
const uncertaintyCode = (result, code) => (
  result.uncertainties.find((item) => item.code === code) ?? null
);

/* ==========================================================================
 * ⓪ 规则表本身（漂移的第一道防线）
 * ========================================================================== */

test('⓪ 规则表冻结且口径逐字可查（公式/符号约定/边界语义/文案）', () => {
  assert.equal(Object.isFrozen(EOT_FORMULA), true);
  assert.equal(Object.isFrozen(EOT_ANCHORS), true);
  assert.equal(Object.isFrozen(CHINA_DST_RANGES), true);
  assert.equal(Object.isFrozen(CHINA_DST_RULES), true);
  assert.equal(Object.isFrozen(UNCERTAINTY_MESSAGES), true);
  assert.equal(Object.isFrozen(EOT_ACCURACY), true);
  assert.equal(CHINA_DST_RANGES.every((r) => Object.isFrozen(r)), true);

  // 公式文字逐字（NOAA/Spencer 全式；节149 方案②；γ = 2π(N−1)/365）
  assert.equal(
    EOT_FORMULA.expression,
    'EoT = 229.18·(0.000075 + 0.001868·cos γ − 0.032077·sin γ − 0.014615·cos 2γ − 0.040849·sin 2γ)',
  );
  assert.equal(EOT_FORMULA.gammaExpression, 'γ = 2π·(N − 1) / 365');
  assert.equal(EOT_FORMULA.scaleMinutes, 229.18);
  assert.equal(EOT_FORMULA.offset, 1);
  assert.equal(EOT_FORMULA.denominator, 365);
  assert.equal(EOT_FORMULA.constantCoefficient, 0.000075);
  assert.equal(EOT_FORMULA.cosGammaCoefficient, 0.001868);
  assert.equal(EOT_FORMULA.sinGammaCoefficient, -0.032077);
  assert.equal(EOT_FORMULA.cos2GammaCoefficient, -0.014615);
  assert.equal(EOT_FORMULA.sin2GammaCoefficient, -0.040849);
  // 旧式留痕（已废弃，仅审计；不得再参与计算）
  assert.match(EOT_FORMULA.superseded, /9\.87·sin\(2B\)/);
  assert.match(EOT_ACCURACY.supersededFormula, /9\.87·sin\(2B\)/);
  assert.equal(EOT_ACCURACY.supersededMaxDeviationMinutes, 0.85);
  // 符号约定写死：真太阳时 = 民用时 + 4·(经度 − 120) + EoT
  assert.equal(EOT_FORMULA.signConvention, '真太阳时 = 民用时 + 4·(经度 − 120) + EoT（EoT = 视太阳时 − 平太阳时）');
  assert.equal(LSTM_DEGREES, 120);
  assert.equal(LARGE_TRUE_SOLAR_DELTA_MINUTES, 20);

  // 官方年份表逐字（国务院公告）
  assert.deepEqual(
    CHINA_DST_RANGES.map((r) => [r.year, r.startMonth, r.startDay, r.endMonth, r.endDay, r.firstYear]),
    [
      [1986, 5, 4, 9, 14, true],
      [1987, 4, 12, 9, 13, false],
      [1988, 4, 10, 9, 11, false],
      [1989, 4, 16, 9, 17, false],
      [1990, 4, 15, 9, 16, false],
      [1991, 4, 14, 9, 15, false],
    ],
  );
  // 边界语义文字逐字
  assert.equal(CHINA_DST_RULES.clockConvention, '起止日均以钟表 02:00 为界（公告原文「凌晨 2 时」）');
  assert.equal(CHINA_DST_RULES.startBoundary, '起始日当日 02:00（含）起为夏令时；该日 00:00–01:59 仍按标准时');
  assert.equal(CHINA_DST_RULES.endBoundary, '结束日当日 02:00 前（不含 02:00）为夏令时；该日 02:00（含）起按标准时');
  assert.match(CHINA_DST_RULES.ambiguousWindow, /结束日 01:00–01:59/);
  assert.equal(CHINA_DST_RULES.firstYearRule, '1986 年（施行首年）：5 月第一个周日 02:00 起');
  assert.equal(CHINA_DST_RULES.otherYearsRule, '1987–1991 年：4 月中旬第一个周日 02:00 起');
  assert.equal(CHINA_DST_RULES.endRule, '结束日一律为 9 月第一个周日 02:00');
  // 不确定项文案存在且非空（唯一权威位置；Python 镜像逐字照抄）
  for (const code of ['dst_ambiguous_hour', 'true_solar_large_delta', 'minute_unknown']) {
    assert.equal(typeof UNCERTAINTY_MESSAGES[code], 'string');
    assert.ok(UNCERTAINTY_MESSAGES[code].length > 10, `${code} 文案过短`);
  }
  // 表外年份无区间
  assert.equal(chinaDstRangeForYear(1985), null);
  assert.equal(chinaDstRangeForYear(1992), null);
});

test('⓪ 官方年份表的 12 个起止日全部落在周日（与「第一个周日」公告口径自洽）', () => {
  for (const range of CHINA_DST_RANGES) {
    const startWeekday = new Date(Date.UTC(range.year, range.startMonth - 1, range.startDay)).getUTCDay();
    const endWeekday = new Date(Date.UTC(range.year, range.endMonth - 1, range.endDay)).getUTCDay();
    assert.equal(startWeekday, 0, `${range.year} 起始日应为周日`);
    assert.equal(endWeekday, 0, `${range.year} 结束日应为周日`);
  }
});

test('⓪ 闰年与日序自写实现（1900 非闰 / 2000 闰 / 2024 闰 / 闰日进位）', () => {
  assert.equal(isLeapYear(1900), false);   // 百年不闰
  assert.equal(isLeapYear(2000), true);    // 四百年再闰
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.equal(dayOfYear(2025, 1, 1), 1);
  assert.equal(dayOfYear(2025, 12, 31), 365);
  assert.equal(dayOfYear(2024, 12, 31), 366);
  // 1900 年 3 月 1 日为第 60 天（非闰）；2000 年 3 月 1 日为第 61 天（闰）
  assert.equal(dayOfYear(1900, 3, 1), 60);
  assert.equal(dayOfYear(2000, 3, 1), 61);
  assert.equal(dayOfYear(2024, 2, 29), 60);
});

/* ==========================================================================
 * ① 均时差权威锚点（对拍对象 = NOAA 公开 EoT 数据与万年历零点日）
 * ========================================================================== */

test('① 均时差：七个权威锚点的实现值与登记偏差（口径：视太阳时 − 平太阳时）', () => {
  for (const anchor of EOT_ANCHORS) {
    const value = anchorValue(anchor);
    const deviation = Math.abs(value - anchor.anchor);
    assert.ok(deviation <= anchor.maxDeviation + 1e-9,
      `${anchor.month}/${anchor.day} EoT=${value}，锚值=${anchor.anchor}，偏差=${deviation.toFixed(4)}`
      + ` 超出登记上界 ${anchor.maxDeviation}`);
    assert.ok(Math.abs(deviation - anchor.observed) < 5e-4,
      `${anchor.month}/${anchor.day} 实测偏差 ${deviation.toFixed(4)} 与 rules 登记 ${anchor.observed} 不符（规则或公式被改动）`);
  }
  // 三个数值锚点的精确回归值（**Spencer 全式**；改式必红）
  assert.equal(anchorValue(EOT_ANCHORS.find((a) => a.month === 2 && a.day === 11)), -14.1997);
  assert.equal(anchorValue(EOT_ANCHORS.find((a) => a.month === 11 && a.day === 3)), 16.3653);
  assert.equal(anchorValue(EOT_ANCHORS.find((a) => a.month === 5 && a.day === 14)), 3.9263);
  // 2/11 与锚值 −14.2 逐位吻合（±0.001 内）；5/14 真值与两式均为正号正量级
  assert.ok(Math.abs(anchorValue(EOT_ANCHORS.find((a) => a.month === 2 && a.day === 11)) - (-14.2)) <= 0.001);
  assert.ok(anchorValue(EOT_ANCHORS.find((a) => a.month === 5 && a.day === 14)) > 0);
  assert.ok(Math.abs(anchorValue(EOT_ANCHORS.find((a) => a.month === 5 && a.day === 14)) - 3.7) <= 0.3);
});

test('① 均时差：±0.3 分钟目标的达标/未达标清单（诚实断言，不静默放水）', () => {
  const byMonthDay = (a, b) => (mdKey(a) - mdKey(b));
  const within = EOT_ANCHORS
    .filter((a) => Math.abs(anchorValue(a) - a.anchor) <= EOT_ACCURACY.taskTargetMinutes + 1e-9)
    .sort(byMonthDay)
    .map((a) => `${a.month}/${a.day}`);
  const outside = EOT_ANCHORS
    .filter((a) => Math.abs(anchorValue(a) - a.anchor) > EOT_ACCURACY.taskTargetMinutes + 1e-9)
    .sort(byMonthDay)
    .map((a) => `${a.month}/${a.day}`);
  // 节149 方案②（换用 Spencer 全式）后的现状：4 项达标、3 个零点日仍在 0.30–0.40 区间。
  // 若未来再换式（或改锚值），本条会变红 → 属**知情变更**：请同步更新 rules 的
  // EOT_ACCURACY 登记并上报节149，不要直接改期望值。
  assert.deepEqual(within, EOT_ACCURACY.anchorsWithinTarget);
  assert.deepEqual(outside, EOT_ACCURACY.anchorsOutsideTarget);
  assert.equal(EOT_ACCURACY.formulaMaxDeviationMinutes, 0.4);
  // Spencer 全式的固有偏差确实 ≤ 登记上界 0.4（换式前旧式为 0.85）
  for (const anchor of EOT_ANCHORS) {
    assert.ok(Math.abs(anchorValue(anchor) - anchor.anchor) <= EOT_ACCURACY.formulaMaxDeviationMinutes + 1e-9);
  }
  assert.match(EOT_ACCURACY.decision, /方案②/);
});

test('① EoT 零点日：Spencer 全式的过零点落在锚点日 ±2 天内', () => {
  for (const [month, day] of [[4, 15], [6, 13], [9, 1], [12, 25]]) {
    const samples = [];
    for (let offset = -3; offset <= 3; offset += 1) {
      const probe = new Date(Date.UTC(COMMON_YEAR, month - 1, day + offset));
      const m = probe.getUTCMonth() + 1;
      const d = probe.getUTCDate();
      samples.push(equationOfTimeMinutes(dayOfYear(COMMON_YEAR, m, d)));
    }
    const hasSignChange = samples.some((value, i) => i > 0 && Math.sign(value) !== Math.sign(samples[i - 1]));
    assert.ok(hasSignChange, `${month}/${day} ±3 天内应出现过零（EoT 符号翻转）`);
  }
});

test('① 均时差取值域：全年 −14.3 ≤ EoT ≤ +16.4 分钟（公式量级自检）', () => {
  let min = Infinity;
  let max = -Infinity;
  for (let n = 1; n <= 366; n += 1) {
    const value = equationOfTimeMinutes(n);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  assert.ok(min < -14 && min > -15, `EoT 最小值异常: ${min}`);
  assert.ok(max > 16 && max < 17, `EoT 最大值异常: ${max}`);
});

/* ==========================================================================
 * ② 官方 12 个起止日边界（钟表 02:00）
 * ========================================================================== */

test('② 12 个官方起止日：起始日 01:59 非夏令时 / 02:00 起夏令时；结束日 01:59 夏令时 / 02:00 非', () => {
  let assertions = 0;
  for (const range of CHINA_DST_RANGES) {
    const before = getChinaDst({
      year: range.year, month: range.startMonth, day: range.startDay, hour: 1, minute: 59,
    });
    const at = getChinaDst({
      year: range.year, month: range.startMonth, day: range.startDay, hour: 2, minute: 0,
    });
    assert.equal(before.isDst, false, `${range.year}-${range.startMonth}-${range.startDay} 01:59 应为标准时`);
    assert.equal(at.isDst, true, `${range.year}-${range.startMonth}-${range.startDay} 02:00 应起夏令时`);
    assert.match(at.rule, /夏令时/);

    const endBefore = getChinaDst({
      year: range.year, month: range.endMonth, day: range.endDay, hour: 1, minute: 59,
    });
    const endAt = getChinaDst({
      year: range.year, month: range.endMonth, day: range.endDay, hour: 2, minute: 0,
    });
    assert.equal(endBefore.isDst, true, `${range.year}-${range.endMonth}-${range.endDay} 01:59 应按夏令时计（歧义段）`);
    assert.equal(endAt.isDst, false, `${range.year}-${range.endMonth}-${range.endDay} 02:00 应回到标准时`);
    assert.match(endAt.rule, /标准时/);
    assertions += 4;
  }
  // 6 个年份 × 2 个边界日 × （01:59 / 02:00 各一）= 24 条断言
  assert.equal(assertions, 6 * 2 * 2);
});

test('② 区间内整日夏令时、区间外（前一日/后一日）非夏令时', () => {
  // 1990：04-15 起、09-16 止
  assert.equal(getChinaDst({ year: 1990, month: 4, day: 15, hour: 12, minute: 0 }).isDst, true);
  assert.equal(getChinaDst({ year: 1990, month: 7, day: 1, hour: 0, minute: 0 }).isDst, true);
  assert.equal(getChinaDst({ year: 1990, month: 9, day: 15, hour: 23, minute: 59 }).isDst, true);
  assert.equal(getChinaDst({ year: 1990, month: 4, day: 14, hour: 23, minute: 59 }).isDst, false);
  assert.equal(getChinaDst({ year: 1990, month: 9, day: 17, hour: 0, minute: 0 }).isDst, false);
  // 1 月/10 月（区间外）
  assert.equal(getChinaDst({ year: 1990, month: 1, day: 1, hour: 12, minute: 0 }).isDst, false);
  assert.equal(getChinaDst({ year: 1990, month: 10, day: 1, hour: 12, minute: 0 }).isDst, false);
});

test('② 表外年份：1985 / 1992 / 2023 一律标准时，且 rule 说明「不在施行年份」', () => {
  for (const year of [1985, 1992, 2023, 1900, 2000]) {
    for (const [month, day] of [[6, 1], [7, 15], [9, 1]]) {
      const result = getChinaDst({ year, month, day, hour: 12, minute: 0 });
      assert.equal(result.isDst, false, `${year}-${month}-${day} 不应为夏令时`);
      assert.match(result.rule, /不在中国官方夏令时施行年份（1986–1991）/);
    }
  }
});

test('③ 1986 年特殊：05-04（5 月第一个周日）起，而非 4 月中旬第一个周日', () => {
  // 1986 年 4 月 13 日是 4 月的第二个周日；若误用 1987+ 规则会把它当起始日
  assert.equal(new Date(Date.UTC(1986, 3, 13)).getUTCDay(), 0);
  assert.equal(getChinaDst({ year: 1986, month: 4, day: 13, hour: 12, minute: 0 }).isDst, false);
  assert.equal(getChinaDst({ year: 1986, month: 4, day: 30, hour: 12, minute: 0 }).isDst, false);
  assert.equal(getChinaDst({ year: 1986, month: 5, day: 3, hour: 23, minute: 59 }).isDst, false);
  assert.equal(getChinaDst({ year: 1986, month: 5, day: 4, hour: 1, minute: 59 }).isDst, false);
  assert.equal(getChinaDst({ year: 1986, month: 5, day: 4, hour: 2, minute: 0 }).isDst, true);
  // rule 文案点明「施行首年」
  const rule = getChinaDst({ year: 1986, month: 6, day: 1, hour: 12, minute: 0 }).rule;
  assert.match(rule, /1986 年（施行首年）：5 月第一个周日 02:00 起/);
  assert.match(rule, /05-04 02:00 起 → 09-14 02:00 止/);
  // 1987 年起用 4 月规则
  const rule1987 = getChinaDst({ year: 1987, month: 6, day: 1, hour: 12, minute: 0 }).rule;
  assert.match(rule1987, /1987–1991 年：4 月中旬第一个周日 02:00 起/);
  assert.match(rule1987, /04-12 02:00 起 → 09-13 02:00 止/);
});

/* ==========================================================================
 * ③ 校正链：顺序 / 明细 / 不确定项
 * ========================================================================== */

test('④ 歧义段挂 dst_ambiguous_hour：结束日 01:00–01:59；00:59 与 02:00 不挂', () => {
  const ambiguous = [
    { year: 1986, month: 9, day: 14, hour: 1, minute: 0 },
    { year: 1988, month: 9, day: 11, hour: 1, minute: 59 },
    { year: 1991, month: 9, day: 15, hour: 1, minute: 30 },
  ];
  for (const input of ambiguous) {
    const result = correctBirthTime({ ...input, longitude: 116.4 });
    assert.equal(getChinaDst(input).isDst, true, '歧义段按夏令时计');
    const hit = uncertaintyCode(result, 'dst_ambiguous_hour');
    assert.ok(hit, `${input.year}-${input.month}-${input.day} ${input.hour}:${input.minute} 应挂 dst_ambiguous_hour`);
    assert.equal(hit.message, UNCERTAINTY_MESSAGES.dst_ambiguous_hour);
  }
  const notAmbiguous = [
    { year: 1988, month: 9, day: 11, hour: 0, minute: 59 },   // 结束日 00:59 → 不歧义
    { year: 1988, month: 9, day: 11, hour: 2, minute: 0 },    // 结束日 02:00 → 已回标准时
    { year: 1988, month: 9, day: 12, hour: 1, minute: 30 },   // 结束日次日 → 无歧义
    { year: 1988, month: 4, day: 10, hour: 1, minute: 30 },   // 起始日 01:30 → 不歧义（尚未施行）
  ];
  for (const input of notAmbiguous) {
    const result = correctBirthTime({ ...input, longitude: 116.4 });
    assert.equal(uncertaintyCode(result, 'dst_ambiguous_hour'), null,
      `${input.year}-${input.month}-${input.day} ${input.hour}:${input.minute} 不应挂歧义不确定项`);
  }
  // 歧义段不确定项与 applyDst 开关无关（描述的是输入本身的不确定性）
  const raw = { year: 1988, month: 9, day: 11, hour: 1, minute: 30, longitude: 116.4, applyDst: false };
  assert.ok(uncertaintyCode(correctBirthTime(raw), 'dst_ambiguous_hour'));
  assert.equal(correctBirthTime(raw).applied.dst, false);
});

test('⑤ 大修正挂 true_solar_large_delta：经度 75°E（4·(75−120) = −180 分钟）', () => {
  const result = correctBirthTime({
    year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: 75,
  });
  const ts = calculateTrueSolarTime({ year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: 75 });
  assert.equal(ts.longitudeDeltaMinutes, -180);
  assert.equal(ts.totalDeltaMinutes, -185.7811);          // −180 + EoT(7/15) = −5.7811（Spencer 全式）
  assert.equal(ts.hour, 8);
  assert.equal(ts.minute, 54);                            // 12:00 − 185.7811 → 08:54（floor(−185.7811+0.5) = −186）
  const hit = uncertaintyCode(result, 'true_solar_large_delta');
  assert.ok(hit, '经度 75°E 的真太阳时总修正 −185.8 分钟应挂大修正不确定项');
  assert.equal(hit.message, UNCERTAINTY_MESSAGES.true_solar_large_delta);
  assert.equal(result.deltaMinutes, -60 - 186);           // 先夏令时（1990-07-15 属区间）再真太阳时

  // 中央经线 120°E：只有均时差，|EoT| 全年 < 17 分钟 → 不挂大修正
  const central = correctBirthTime({
    year: 1990, month: 11, day: 3, hour: 12, minute: 0, longitude: 120,
  });
  assert.equal(uncertaintyCode(central, 'true_solar_large_delta'), null);
  assert.equal(calculateTrueSolarTime({ year: 1990, month: 11, day: 3, hour: 12, minute: 0, longitude: 120 }).longitudeDeltaMinutes, 0);
});

test('⑤ 大修正阈值精确构造：|EoT + 经度差| = 19.9 不挂 / 20.1 挂（阈值取 20）', () => {
  // 2025-02-11 EoT = −14.1997（Spencer 全式）；经度差 = 4·(lon − 120)
  //   lon = 118.574925 → 经度差 −5.7003 → 合计 −19.9000（< 20，不挂）
  //   lon = 118.524925 → 经度差 −5.9003 → 合计 −20.1000（≥ 20，挂）
  const below = correctBirthTime({ year: 2025, month: 2, day: 11, hour: 12, minute: 0, longitude: 118.574925 });
  const belowTs = calculateTrueSolarTime({ year: 2025, month: 2, day: 11, hour: 12, minute: 0, longitude: 118.574925 });
  assert.equal(belowTs.totalDeltaMinutes, -19.9);
  assert.equal(uncertaintyCode(below, 'true_solar_large_delta'), null);

  const above = correctBirthTime({ year: 2025, month: 2, day: 11, hour: 12, minute: 0, longitude: 118.524925 });
  const aboveTs = calculateTrueSolarTime({ year: 2025, month: 2, day: 11, hour: 12, minute: 0, longitude: 118.524925 });
  assert.equal(aboveTs.totalDeltaMinutes, -20.1);
  assert.ok(uncertaintyCode(above, 'true_solar_large_delta'));
  // 阈值常量唯一权威位置
  assert.equal(LARGE_TRUE_SOLAR_DELTA_MINUTES, 20);
});

test('⑥ 缺经度抛 PaipanInputError(longitude_required)：两个函数都抛；applyTrueSolar=false 不抛', () => {
  for (const input of [
    { year: 1990, month: 7, day: 15, hour: 12, minute: 0 },
    { year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: null },
    { year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: undefined },
    { year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: '116.4' },
  ]) {
    assert.throws(() => calculateTrueSolarTime(input), (err) => {
      assert.ok(err instanceof PaipanInputError);
      assert.equal(err.code, 'longitude_required');
      return true;
    });
    assert.throws(() => correctBirthTime(input), (err) => err.code === 'longitude_required');
  }
  // 关闭真太阳时后不再需要经度（夏令时仍可单独校正）
  const onlyDst = correctBirthTime({
    year: 1990, month: 7, day: 15, hour: 12, minute: 0, applyTrueSolar: false,
  });
  assert.deepEqual(onlyDst.applied, { eot: false, longitude: false, dst: true });
  assert.equal(onlyDst.deltaMinutes, -60);
  assert.equal(onlyDst.hour, 11);
  // 经度越界
  assert.throws(() => calculateTrueSolarTime({
    year: 1990, month: 7, day: 15, hour: 12, minute: 0, longitude: 200,
  }), (err) => err.code === 'longitude_out_of_range');
});

test('⑦ 跨日进位/退位：23:50 + 20 分钟 → 次日 00:10；跨月、跨年、回退一天', () => {
  // 2000-04-15（闰年，N=106，EoT=+0.0196）+ 经度 125.05（+20.2）→ 总修正 +20.2196 → 进位 +20
  const forward = calculateTrueSolarTime({
    year: 2000, month: 4, day: 15, hour: 23, minute: 50, longitude: 125.05,
  });
  assert.equal(forward.longitudeDeltaMinutes, 20.2);
  assert.equal(forward.totalDeltaMinutes, 20.2196);
  assert.deepEqual(
    [forward.year, forward.month, forward.day, forward.hour, forward.minute],
    [2000, 4, 16, 0, 10],
  );
  // 跨年：2023-12-31 23:50 + 18（EoT −2.4535 + 20.2 = 17.7465 → floor(18.2465) = 18）→ 2024-01-01 00:08
  const yearCross = calculateTrueSolarTime({
    year: 2023, month: 12, day: 31, hour: 23, minute: 50, longitude: 125.05,
  });
  assert.equal(yearCross.totalDeltaMinutes, 17.7465);
  assert.deepEqual(
    [yearCross.year, yearCross.month, yearCross.day, yearCross.hour, yearCross.minute],
    [2024, 1, 1, 0, 8],
  );
  // 同日小位移（不跨日）：2024-03-01 00:30 − 27 → 2024-03-01 00:03
  const smallShift = calculateTrueSolarTime({
    year: 2024, month: 3, day: 1, hour: 0, minute: 30, longitude: 116.4,
  });
  assert.equal(smallShift.totalDeltaMinutes, -27.1242);
  assert.deepEqual(
    [smallShift.year, smallShift.month, smallShift.day, smallShift.hour, smallShift.minute],
    [2024, 3, 1, 0, 3],
  );
  // 跨月回退（闰年）：2024-03-01 00:30 经度 75（−193）→ 2024-02-29（闰日）21:17
  const back = calculateTrueSolarTime({
    year: 2024, month: 3, day: 1, hour: 0, minute: 30, longitude: 75,
  });
  assert.equal(back.totalDeltaMinutes, -192.7242);
  assert.deepEqual([back.year, back.month, back.day], [2024, 2, 29]);
  assert.deepEqual([back.hour, back.minute], [21, 17]);
  // 跨月回退（非闰年）：2023-03-01 00:30 经度 75 → 2023-02-28 21:17
  const backNonLeap = calculateTrueSolarTime({
    year: 2023, month: 3, day: 1, hour: 0, minute: 30, longitude: 75,
  });
  assert.deepEqual([backNonLeap.year, backNonLeap.month, backNonLeap.day], [2023, 2, 28]);
  assert.deepEqual([backNonLeap.hour, backNonLeap.minute], [21, 17]);
  // 校正链同样跨日：1988-04-10 00:30（起始日尚未夏令时）→ 位移 −16 → 00:14 同日
  const chain = correctBirthTime({ year: 1988, month: 4, day: 10, hour: 0, minute: 30, longitude: 116.4 });
  assert.equal(chain.deltaMinutes, -16);
  assert.deepEqual([chain.month, chain.day, chain.hour, chain.minute], [4, 10, 0, 14]);
  // 校正链跨日回退：1988-04-10 02:30（已夏令时）→ −60 −16 = −76 → 01:14
  const chainDst = correctBirthTime({ year: 1988, month: 4, day: 10, hour: 2, minute: 30, longitude: 116.4 });
  assert.equal(chainDst.deltaMinutes, -76);
  assert.deepEqual([chainDst.day, chainDst.hour, chainDst.minute], [10, 1, 14]);
  // 校正链跨日回退：1990-07-15 00:30 经度 75（−60 − 186 = −246）→ 前一日 20:24
  const chainBack = correctBirthTime({ year: 1990, month: 7, day: 15, hour: 0, minute: 30, longitude: 75 });
  assert.equal(chainBack.deltaMinutes, -246);
  assert.deepEqual(
    [chainBack.year, chainBack.month, chainBack.day, chainBack.hour, chainBack.minute],
    [1990, 7, 14, 20, 24],
  );
});

test('⑧ 缺 minute：按 00 分计算并挂 minute_unknown（不抛错、不回落当前时间）', () => {
  const withNull = correctBirthTime({ year: 2025, month: 3, day: 1, hour: 12, minute: null, longitude: 116.4 });
  const withZero = correctBirthTime({ year: 2025, month: 3, day: 1, hour: 12, minute: 0, longitude: 116.4 });
  assert.ok(uncertaintyCode(withNull, 'minute_unknown'));
  // 除不确定项清单外，其余字段与 minute=0 完全一致（缺分钟 = 按 0 计）
  assert.deepEqual({ ...withNull, uncertainties: [] }, { ...withZero, uncertainties: [] });
  assert.equal(uncertaintyCode(withZero, 'minute_unknown'), null);
  // undefined 与 null 同义
  const withUndefined = correctBirthTime({ year: 2025, month: 3, day: 1, hour: 12, longitude: 116.4 });
  assert.ok(uncertaintyCode(withUndefined, 'minute_unknown'));
  // 不确定项顺序固定：dst_ambiguous_hour → true_solar_large_delta → minute_unknown
  const ordered = correctBirthTime({
    year: 1990, month: 9, day: 16, hour: 1, minute: null, longitude: 75,
  });
  assert.deepEqual(ordered.uncertainties.map((u) => u.code),
    ['dst_ambiguous_hour', 'true_solar_large_delta', 'minute_unknown']);
  assert.equal(ordered.applied.dst, true);
});

test('⑨ 校正链顺序：DST 先减 1 小时 → 再真太阳时（EoT + 经度差）', () => {
  const both = correctBirthTime({ year: 1988, month: 7, day: 1, hour: 12, minute: 0, longitude: 116.4 });
  const tsOnly = correctBirthTime({
    year: 1988, month: 7, day: 1, hour: 12, minute: 0, longitude: 116.4, applyDst: false,
  });
  const dstOnly = correctBirthTime({
    year: 1988, month: 7, day: 1, hour: 12, minute: 0, longitude: 116.4, applyTrueSolar: false,
  });
  assert.deepEqual(both.applied, { eot: true, longitude: true, dst: true });
  assert.equal(dstOnly.deltaMinutes, -60);
  assert.equal(both.deltaMinutes, dstOnly.deltaMinutes + tsOnly.deltaMinutes);
  // 先减 1 小时再位移 = 一次性位移（同一时刻的两种算法等价）
  assert.equal(both.hour * 60 + both.minute,
    (12 * 60 + 0 + both.deltaMinutes) % 1440);
  // 关掉两项 → 原样返回
  const none = correctBirthTime({
    year: 1988, month: 7, day: 1, hour: 12, minute: 0, longitude: 116.4,
    applyTrueSolar: false, applyDst: false,
  });
  assert.deepEqual(
    [none.year, none.month, none.day, none.hour, none.minute],
    [1988, 7, 1, 12, 0],
  );
  assert.equal(none.deltaMinutes, 0);
  assert.deepEqual(none.applied, { eot: false, longitude: false, dst: false });
  assert.deepEqual(none.uncertainties, []);
});

test('⑩ 取整口径：分钟浮点保留 4 位（floor(x·10⁴+0.5)/10⁴），位移用 floor(total+0.5)', () => {
  assert.equal(roundMinutes(3.123456), 3.1235);
  assert.equal(roundMinutes(-3.123456), -3.1235);
  assert.equal(roundMinutes(0), 0);
  assert.equal(Object.is(roundMinutes(-0.00001), 0), true);   // −0.00001 → 0（不得返回 −0）
  assert.equal(roundMinutes(-0.0001), -0.0001);
  const ts = calculateTrueSolarTime({ year: 2025, month: 5, day: 14, hour: 12, minute: 0, longitude: 116.4 });
  assert.equal(ts.eotMinutes, 3.9263);
  assert.equal(ts.longitudeDeltaMinutes, -14.4);
  assert.equal(ts.totalDeltaMinutes, -10.4737);
  // 位移取整：floor(−10.4737 + 0.5) = floor(−9.9737) = −10 → 12:00 − 10 分钟 = 11:50
  assert.equal(ts.hour, 11);
  assert.equal(ts.minute, 50);
});

test('⑪ 纯函数性：同输入同输出、不改入参、四段可单独调用', () => {
  const input = { year: 1990, month: 9, day: 16, hour: 1, minute: 30, longitude: 116.4 };
  const snapshot = JSON.stringify(input);
  const first = correctBirthTime(input);
  const second = correctBirthTime(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), snapshot, '不得改动入参');
  // ① 输入归一化：minuteKnown 标记
  assert.deepEqual(normalizeInput({ year: 1990, month: 9, day: 16, hour: 1, minute: 30 }),
    { year: 1990, month: 9, day: 16, hour: 1, minute: 30, minuteKnown: true });
  assert.deepEqual(normalizeInput({ year: 1990, month: 9, day: 16, hour: 1 }),
    { year: 1990, month: 9, day: 16, hour: 1, minute: 0, minuteKnown: false });
  // ② 日序 + EoT（未取整）
  const resolved = resolveDayOfYear({ year: 2025, month: 5, day: 14 });
  assert.equal(resolved.dayOfYear, 134);
  assert.ok(Math.abs(resolved.equationOfTimeMinutes - 3.926275) < 1e-4);
  // 输出键序（生产契约形状；下游按键取值）
  assert.deepEqual(Object.keys(first), ['year', 'month', 'day', 'hour', 'minute', 'applied', 'deltaMinutes', 'uncertainties']);
  assert.deepEqual(Object.keys(first.applied), ['eot', 'longitude', 'dst']);
  assert.deepEqual(
    Object.keys(calculateTrueSolarTime({ year: 2025, month: 5, day: 14, hour: 12, minute: 0, longitude: 116.4 })),
    ['year', 'month', 'day', 'hour', 'minute', 'eotMinutes', 'longitudeDeltaMinutes', 'totalDeltaMinutes'],
  );
  assert.deepEqual(Object.keys(getChinaDst({ year: 1986, month: 5, day: 4, hour: 2, minute: 0 })), ['isDst', 'rule']);
});

test('⑫ 非法输入抛错：月份/日/时/分越界、不存在的日期、非对象输入', () => {
  const bad = [
    { year: 2023, month: 2, day: 29, hour: 12, minute: 0 },   // 2023 非闰年
    { year: 2023, month: 13, day: 1, hour: 12, minute: 0 },
    { year: 2023, month: 4, day: 31, hour: 12, minute: 0 },
    { year: 2023, month: 4, day: 1, hour: 24, minute: 0 },
    { year: 2023, month: 4, day: 1, hour: 12, minute: 60 },
    { year: 2023, month: 4, day: 1, hour: -1, minute: 0 },
    { year: 2023, month: 4, day: 1, hour: 12.5, minute: 0 },
    { year: 2023, month: 4, day: 1, minute: 0 },              // 缺 hour
    { year: 2023, month: 4, hour: 12, minute: 0 },            // 缺 day
  ];
  for (const input of bad) {
    assert.throws(() => correctBirthTime(input), (err) => {
      assert.ok(err instanceof PaipanInputError, `应抛 PaipanInputError: ${JSON.stringify(input)}`);
      assert.equal(err.code, 'invalid_datetime');
      return true;
    });
  }
  assert.throws(() => calculateTrueSolarTime(null), (err) => err.code === 'invalid_datetime');
  assert.throws(() => getChinaDst(undefined), (err) => err.code === 'invalid_datetime');
  // 合法：闰日可以
  assert.doesNotThrow(() => correctBirthTime({ year: 2024, month: 2, day: 29, hour: 12, minute: 0, longitude: 116.4 }));
  assert.doesNotThrow(() => correctBirthTime({ year: 2000, month: 2, day: 29, hour: 12, minute: 0, longitude: 116.4 }));
});

test('⑬ 月份日序号工具与区间比较口径（monthDayKey 单调）', () => {
  assert.equal(monthDayKey(5, 4), 504);
  assert.equal(monthDayKey(9, 14), 914);
  assert.ok(monthDayKey(4, 30) < monthDayKey(5, 1));
  assert.ok(monthDayKey(9, 30) > monthDayKey(9, 14));
  // 区间判定用的就是 MMDD 比较（区间同日历年，不涉及跨年）
  assert.ok(monthDayKey(3, 31) < monthDayKey(4, 12));
  assert.ok(monthDayKey(10, 1) > monthDayKey(9, 13));
});
