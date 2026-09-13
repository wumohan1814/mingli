/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 小六壬
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（见 README §2）：
 *   本文件是「小六壬」这门术数的**唯一权威规则位置**。调用方（capabilities/、
 *   对拍框架、测试、未来 server.mjs 适配层）**只能读不能抄**——凡是要用六宫名、
 *   掌诀歌、时辰表、换日口径的地方，一律从这里取；任何地方出现第二份拷贝
 *   即视为缺陷（规则漂移是已知教训）。
 *
 * 文本来源（公有领域俗传口诀，逐字使用，见 00_根/来源.md 的同类登记要求）：
 *   六宫次序与掌诀歌为民间俗传、属公有领域，不署名人古籍，不冒充某家定本。
 *
 * 规则来源标注（每条都写了来源，便于后续节复核）：
 *   - palaces / verse：通行俗传小六壬掌诀（公有领域俗传口诀），逐字使用
 *   - 三宫推算公式：正月从大安起、月上起初一、日上起子时、顺行六宫
 *   - hourIndex 表：对拍实测与旧实现（vendor）一致（含 0=早子时、12=晚子时）
 *   - dayBoundary / leapMonthRule：对拍实测与旧实现（vendor）一致
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」。纯数据 + 纯函数。
 */

/** 六宫次序：大安 → 留连 → 速喜 → 赤口 → 小吉 → 空亡（index 0–5），顺行循环。 */
const PALACES = Object.freeze([
  Object.freeze({
    name: '大安',
    index: 0,
    verse: '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨，将军回田野，仔细更推详。',
  }),
  Object.freeze({
    name: '留连',
    index: 1,
    verse: '留连事难成，求谋日未明，官事凡宜缓，去者未回程，失物南方见，急讨方心称，更须防口舌，人口且平平。',
  }),
  Object.freeze({
    name: '速喜',
    index: 2,
    verse: '速喜喜来临，求财向南行，失物申午未，逢人路上寻，官事有福德，病者无祸侵，田宅六畜吉，行人有信音。',
  }),
  Object.freeze({
    name: '赤口',
    index: 3,
    verse: '赤口主口舌，官非切宜防，失物急去寻，行人有惊慌，六畜多作怪，病者出西方，更须防咀咒，恐怕染瘟皇。',
  }),
  Object.freeze({
    name: '小吉',
    index: 4,
    verse: '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立便至，交关甚是强，凡事皆和合，病者叩穷苍。',
  }),
  Object.freeze({
    name: '空亡',
    index: 5,
    verse: '空亡事不祥，阴人多乖张，求财无利益，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解保安康。',
  }),
]);

/** 十二地支（时辰序用）。 */
export const XI_ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/**
 * 时刻标签表（对拍实测与旧实现一致，共 13 项）：
 *   0=早子时（00:00–00:59）、1–11=丑时…亥时、12=晚子时（23:00–23:59）。
 * 说明：旧实现把子时拆成「早子时 / 晚子时」两个 index，不是 12 项表。
 */
export const XI_HOUR_LABELS = Object.freeze([
  '早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时',
]);

/** 六宫数量（循环取模用）。 */
export const XI_PALACE_COUNT = 6;

/**
 * 小六壬权威规则表。五键为生产契约中 `calculation` 段引用的口径。
 * 冻结（不可写）——规则漂移的第一道防线。
 */
export const XIAOLIUREN_RULES = Object.freeze({
  source: '通行俗传小六壬掌诀（公有领域俗传口诀）',
  palaces: PALACES,
  hourLabels: Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']),
  dayBoundary: '东八区民用日零点换日',
  leapMonthRule: '闰月沿用同名月序',
});

/** 规则表：三宫推算公式（文字版，供审计与提示词复查，不参与计算）。 */
export const XIAOLIUREN_FORMULAS = Object.freeze({
  month: '(lunarMonth - 1) mod 6',
  day: '(monthPalaceIndex + lunarDay - 1) mod 6',
  hour: '(dayPalaceIndex + hourNumber - 1) mod 6',
  hourNumber: 'hourIndex mod 12 + 1',
});

/**
 * 取某宫的完整对象（name/index/verse）。
 * @param {number} palaceIndex 0–5（负数与越界自动取模）
 * @returns {{name: string, index: number, verse: string}} 冻结的宫对象
 */
export function xiPalace(palaceIndex) {
  const i = ((Math.trunc(palaceIndex) % XI_PALACE_COUNT) + XI_PALACE_COUNT) % XI_PALACE_COUNT;
  return PALACES[i];
}

/**
 * 时刻标签：hourIndex 0–12 → 中文标签。
 * @param {number} hourIndex 0=早子时 … 11=亥时 … 12=晚子时
 * @returns {string} 中文标签
 */
export function xiHourLabel(hourIndex) {
  const i = Math.trunc(hourIndex);
  const label = XI_HOUR_LABELS[i];
  if (label === undefined) throw new Error(`xiHourLabel: hourIndex 越界: ${hourIndex}`);
  return label;
}

/**
 * 时辰序判定（东八区民用挂钟时间）。
 * 表（对拍实测与旧实现一致）：
 *   00:00–00:59 → 0（早子时）；01:00–02:59 → 1（丑）；其后每 2 小时一进；
 *   21:00–22:59 → 11（亥）；23:00–23:59 → 12（晚子时）。
 *
 * @param {number} hour 0–23（+08:00 挂钟小时）
 * @returns {number} hourIndex 0–12
 */
export function xiHourIndex(hour) {
  const h = Math.trunc(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) throw new Error(`xiHourIndex: 小时越界: ${hour}`);
  if (h === 23) return 12;
  return Math.floor((h + 1) / 2);
}

/**
 * 时辰序 → 起课用「时辰数」（子=1 … 亥=12；晚子时按 1 计）。
 * @param {number} hourIndex 0–12
 * @returns {number} 1–12
 */
export function xiHourNumber(hourIndex) {
  return ((Math.trunc(hourIndex) % 12) + 12) % 12 + 1;
}
