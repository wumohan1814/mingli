/**
 * 命理 · 自研排盘内核 · 能力：太乙神数（四计七十二局）
 * ---------------------------------------------------------------------------
 * 导出 `generateTaiyiCore(params)` —— 与旧实现 `generateTaiyi(params)` 同签名、
 * 同输出形状（stripInternal 之后的生产契约形状）。
 *
 * 四段纯函数管线（见 README §1）：
 *   ① 输入归一化 normalizeInput —— {scope:'year', year} 或 {scope:'month'|'day'|'hour', customDate}
 *   ② 历法/起局 resolveCalendar —— lunar-typescript + 中国夏令时(1986–1991) + 纯历法积数
 *   ③ 格局判定 lookupBureau —— 七十二局查表 + 判断语 + 战术指引
 *   ④ 输出装配 assemble
 *
 * == 对拍实测确认的口径（黑盒探针，见 rules/taiyi.js 文件头）==
 *   1. 积年 = 公历年 + 10153917；年/月/日三计恒阳遁，时计按冬夏至分阴阳遁。
 *   2. 积月 = 12×(农历年+10153917) + 农历月序 − 10（农历年=正月初一换年；
 *      闰月按同月序不增计；月干支仍按节气换月）。
 *   3. 积日 = 换日后公历日 JDN + 705595731；晚子时（有效墙钟 ≥23:00）换日。
 *   4. 积时 = 积日×12 + 时辰序 − 11；时辰序 0..11（子=0，晚子时按子计）。
 *   5. 局数 = 积数 mod 72（0→72）；入纪 = 积数 mod 360（0→360）；
 *      元 = floor((入纪−1)/72)+1；纪 = floor((入纪−1)/60)+1。
 *   6. 时计阴阳遁：冬至（精确时刻）→ 夏至为阳遁，夏至 → 冬至为阴遁；
 *      节气时刻取 lunar-typescript 节气表（与旧实现秒级一致，探针 p7–p10）。
 *   7. 中国夏令时 1986–1991：起始日 02:00 起 +1h；结束日 01:00 起回标准时
 *      （旧实现实测口径；与 true-solar-time 的 02:00 边界不同，见 rules 文件头）。
 *   8. 太乙/文昌/计神/始击 与 主客定三算、六将：全部按 72 局查表/公式（rules 文件）。
 *   9. 宫数映射错位口径（亥→坎8、寅→震4、巳→离2）影响所有盘面宫位/同宫判断。
 *
 * 纪律：零 IO、零网络、零 LLM、零随机、零「当前时间」；同样输入同样输出。
 */

import { Solar } from 'lunar-typescript';
import {
  TAIYI_CHONG,
  TAIYI_CIRCLE,
  TAIYI_DIR,
  TAIYI_EPOCH_DAY_OFFSET,
  TAIYI_EPOCH_YEAR_OFFSET,
  TAIYI_GAN,
  TAIYI_GUA,
  TAIYI_HOUR_CONST,
  TAIYI_JUDGMENT_TEXT,
  TAIYI_MODEL,
  TAIYI_MONTH_CONST,
  TAIYI_PALACE_NUM,
  TAIYI_SIXTEEN_GODS,
  TAIYI_TACTIC_TEXT,
  TAIYI_ZHI,
  taiyiBureauRow,
  taiyiCountNature,
  taiyiJiShenYear,
  taiyiMod,
  taiyiStarPos,
  taiyiStartJump,
  taiyiWenYang,
} from '../../rules/taiyi.js';
import { CHINA_DST_RANGES } from '../../rules/true-solar-time.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta.engineVersion —— 自研内核版本（信息性）。 */
export const ENGINE_VERSION = '0.1.0-mingli';
/** meta.schemaVersion —— 生产契约版本，与旧实现保持一致。 */
export const SCHEMA_VERSION = '1.0.0';

/** 东八区偏移（分钟）。全内核唯一处定义时区口径。 */
const CST_OFFSET_MINUTES = 480;

/** 内核输入错误。 */
export class PaipanInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

/** 数字补零。 */
function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}

/** 五鼠遁表：日干 → 子时干。 */
const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
});

/**
 * 把任意受支持的输入换算成「东八区民用挂钟时刻」（epoch ms → +08:00 字段）。
 * 不依赖进程本地时区。
 */
function toCstWallClock(value) {
  let instantMs;
  if (value instanceof Date) {
    instantMs = value.getTime();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    instantMs = value;
  } else if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim());
    if (!m) throw new PaipanInputError('invalid_custom_date', `customDate 无法解析（支持 ISO 8601 或 Date）: ${value}`);
    const [, y, mo, d, hh, mi, ss, tz] = m;
    const parts = { year: Number(y), month: Number(mo), day: Number(d), hour: Number(hh ?? 0), minute: Number(mi ?? 0), second: Number(ss ?? 0) };
    const ranges = [[parts.month, 1, 12, '月'], [parts.day, 1, 31, '日'], [parts.hour, 0, 23, '时'], [parts.minute, 0, 59, '分'], [parts.second, 0, 59, '秒']];
    for (const [value2, lo, hi, label] of ranges) {
      if (!Number.isInteger(value2) || value2 < lo || value2 > hi) {
        throw new PaipanInputError('invalid_custom_date', `customDate 的${label}超出范围（${lo}-${hi}）: ${value}`);
      }
    }
    let offsetMinutes = CST_OFFSET_MINUTES;
    if (tz === 'Z') offsetMinutes = 0;
    else if (tz) {
      const sign = tz[0] === '-' ? -1 : 1;
      const body = tz.slice(1).replace(':', '');
      offsetMinutes = sign * (Number(body.slice(0, 2)) * 60 + Number(body.slice(2, 4)));
    }
    instantMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - offsetMinutes * 60000;
    const check = new Date(instantMs + offsetMinutes * 60000);
    const roundTrip = { year: check.getUTCFullYear(), month: check.getUTCMonth() + 1, day: check.getUTCDate(), hour: check.getUTCHours(), minute: check.getUTCMinutes(), second: check.getUTCSeconds() };
    for (const key of ['year', 'month', 'day', 'hour', 'minute', 'second']) {
      if (roundTrip[key] !== parts[key]) {
        throw new PaipanInputError('invalid_custom_date', `customDate 不是真实存在的时刻（${key} 被进位为 ${roundTrip[key]}）: ${value}`);
      }
    }
  } else {
    throw new PaipanInputError('invalid_custom_date', `customDate 类型不支持（需 Date 或 ISO 字符串）: ${typeof value}`);
  }
  if (!Number.isFinite(instantMs)) {
    throw new PaipanInputError('invalid_custom_date', 'customDate 不是有效日期（Invalid Date / NaN）。');
  }
  const shifted = new Date(instantMs + CST_OFFSET_MINUTES * 60000);
  const wall = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
  return { instantMs, wall };
}

/**
 * 中国夏令时（1986–1991）调整（旧实现实测口径）：
 *   起始日 02:00（含）起为夏令时；结束日 01:00（含）起回标准时；
 *   窗口内中间日期整天 +1 小时。年份表复用 true-solar-time 的官方年份表。
 */
function applyChinaDst(wall) {
  const range = CHINA_DST_RANGES.find((r) => r.year === wall.year);
  if (!range) return wall;
  const d = wall.month * 100 + wall.day;
  const startMD = range.startMonth * 100 + range.startDay;
  const endMD = range.endMonth * 100 + range.endDay;
  let dst = false;
  if (d > startMD && d < endMD) dst = true;
  else if (d === startMD && wall.hour >= 2) dst = true;
  else if (d === endMD && wall.hour < 1) dst = true;
  if (!dst) return wall;
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) + 3600000);
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
 * ① 输入归一化。
 * 支持 { scope:'year', year: 1..9999 整数 } 或
 * { scope:'month'|'day'|'hour', customDate: Date|ISO 字符串|epoch 毫秒 }。
 * 缺输入抛错，绝不回落「当前时间」。
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_input', '太乙起局必须传 {scope, year} 或 {scope, customDate}；不接受缺省输入，也不会回落「当前时间」。');
  }
  const { scope } = params;
  if (scope !== 'year' && scope !== 'month' && scope !== 'day' && scope !== 'hour') {
    throw new PaipanInputError('invalid_scope', `太乙 scope 必须为 year|month|day|hour，收到: ${String(scope)}`);
  }
  if (scope === 'year') {
    const year = params.year;
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw new PaipanInputError('invalid_year', '太乙年份必须是 1-9999 之间的整数。');
    }
    return { mode: 'year', year, hashInput: { capability: 'taiyi', scope: 'year', year } };
  }
  const { customDate } = params;
  if (customDate === undefined || customDate === null) {
    throw new PaipanInputError('missing_custom_date', `太乙 ${scope} 计必须传 customDate；不接受缺省时间。`);
  }
  const { instantMs, wall } = toCstWallClock(customDate);
  const effective = applyChinaDst(wall);
  const iso = `${effective.year}-${pad2(effective.month)}-${pad2(effective.day)}T${pad2(effective.hour)}:${pad2(effective.minute)}:${pad2(effective.second)}+08:00`;
  return { mode: scope, wall, effective, instantMs, iso, hashInput: { capability: 'taiyi', scope, wall: iso } };
}

/**
 * 儒略日数（JDN，格里高利历，该日 00:00 对应）。实现：标准「午正 JDN」公式
 * 再 −1（午正 JDN = 00:00 JDN + 1），保证与旧实现积日口径一致。
 */
export function julianDayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32046;
}

/**
 * 时辰序（有效墙钟小时 → 0..11）：0=子（00:00–00:59 与 23:00–23:59 均按子=0），
 * 1–11=丑…亥。晚子时（23:00–23:59）同时换日。
 */
export function shiChenIndex(hour) {
  const h = Math.trunc(hour);
  if (h === 23) return 0;
  return Math.floor((h + 1) / 2) % 12;
}

/** 时干支（五鼠遁自实现）：日干 + 时辰序 → 干支（时支直接取时辰序，子=0）。 */
export function hourGanZhi(dayGanZhi, hourIndex) {
  const dayGan = dayGanZhi.slice(0, 1);
  const startGan = WU_SHU_DUN[dayGan];
  if (!startGan) throw new PaipanInputError('bad_day_ganzhi', `日干支无法解析: ${dayGanZhi}`);
  const step = taiyiMod(hourIndex, 12);
  return TAIYI_GAN[taiyiMod(TAIYI_GAN.indexOf(startGan) + step, 10)] + TAIYI_ZHI[step];
}

/** 节气表取某年的夏至/冬至精确时刻（lunar-typescript 节气表，+08:00）。 */
function solarTermTimes(year) {
  const xiaZhi = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getJieQiTable()['夏至'];
  const dongZhi = Solar.fromYmdHms(year + 1, 1, 15, 12, 0, 0).getLunar().getJieQiTable()['冬至'];
  return { xiaZhi: xiaZhi ? xiaZhi.toYmdHms() : null, dongZhi: dongZhi ? dongZhi.toYmdHms() : null };
}

/**
 * ② 历法/起局：按计别计算积数 → 局数/入纪/元/纪/阴阳遁 → 四星位置。
 * 纯历法数学，无星历依赖。
 */
export function resolveCalendar(normalized) {
  const scope = normalized.mode;
  let jiShu;          // 积数（年/月/日/时）
  let label;          // 积年/积月/积日/积时
  let ganZhi;         // 盘面干支
  let isYinDun = false;
  let monthZhiIndex = -1;   // 月家计神用

  if (scope === 'year') {
    const year = normalized.year;
    jiShu = year + TAIYI_EPOCH_YEAR_OFFSET;
    label = '积年';
    const lunar = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar();
    ganZhi = lunar.getYearInGanZhiExact();
  } else {
    const eff = normalized.effective;
    const lunar = Solar.fromYmdHms(eff.year, eff.month, eff.day, eff.hour, eff.minute, eff.second).getLunar();
    const hourIndex = shiChenIndex(eff.hour);
    const isLateZi = eff.hour === 23;
    if (scope === 'month') {
      jiShu = 12 * (lunar.getYear() + TAIYI_EPOCH_YEAR_OFFSET) + Math.abs(lunar.getMonth()) + TAIYI_MONTH_CONST;
      label = '积月';
      ganZhi = lunar.getMonthInGanZhiExact();
      monthZhiIndex = TAIYI_ZHI.indexOf(ganZhi.slice(1));
    } else {
      const dayGanZhi = lunar.getDayInGanZhiExact();   // 晚子时 23:00 换日（与旧实现一致）
      if (scope === 'day') {
        const gzDay = isLateZi ? 1 : 0;
        jiShu = julianDayNumber(eff.year, eff.month, eff.day) + gzDay + TAIYI_EPOCH_DAY_OFFSET;
        label = '积日';
        ganZhi = dayGanZhi;
      } else {
        const gzDay = isLateZi ? 1 : 0;
        const jiDay = julianDayNumber(eff.year, eff.month, eff.day) + gzDay + TAIYI_EPOCH_DAY_OFFSET;
        jiShu = jiDay * 12 + hourIndex + TAIYI_HOUR_CONST;
        label = '积时';
        ganZhi = hourGanZhi(dayGanZhi, hourIndex);
        // 时计阴阳遁：冬至 → 夏至 为阳遁，夏至 → 冬至 为阴遁（精确时刻换界）
        const { xiaZhi, dongZhi } = solarTermTimes(eff.year);
        const wallStr = `${eff.year}-${pad2(eff.month)}-${pad2(eff.day)} ${pad2(eff.hour)}:${pad2(eff.minute)}`;
        if (xiaZhi && dongZhi) {
          isYinDun = wallStr >= xiaZhi.slice(0, 16) && wallStr < dongZhi.slice(0, 16);
        }
      }
    }
  }

  const bureau = taiyiMod(jiShu - 1, 72) + 1;
  let entryYears = taiyiMod(jiShu, 360);
  if (entryYears === 0) entryYears = 360;
  const yuan = Math.floor((entryYears - 1) / 72) + 1;
  const ji = Math.floor((entryYears - 1) / 60) + 1;

  // 四星位置
  const taiyiPosition = taiyiStarPos(bureau);
  const wenYang = taiyiWenYang(bureau);
  const wenChangPosition = isYinDun ? TAIYI_CHONG[wenYang] : wenYang;
  const shiJiPosition = taiyiStartJump(bureau);
  let jiShenPosition;
  if (scope === 'month') {
    jiShenPosition = TAIYI_ZHI[taiyiMod(2 - monthZhiIndex, 12)];
  } else {
    const jsYang = taiyiJiShenYear(bureau);
    jiShenPosition = isYinDun ? TAIYI_CHONG[jsYang] : jsYang;
  }

  return { scope, jiShu, label, ganZhi, bureau, entryYears, yuan, ji, isYinDun, taiyiPosition, wenChangPosition, shiJiPosition, jiShenPosition };
}

/**
 * ③ 格局判定：七十二局查表 + 判断语 + 战术指引。
 * 全部为确定性规则，无 IO。
 */
export function evaluateBureau(calendar) {
  const row = taiyiBureauRow(calendar.bureau, calendar.isYinDun);
  const { lord, guest, set } = row;
  const natures = {};
  const ln = taiyiCountNature(lord); if (ln !== undefined) natures.lord = ln;
  const gn = taiyiCountNature(guest); if (gn !== undefined) natures.guest = gn;
  const sn = taiyiCountNature(set); if (sn !== undefined) natures.set = sn;

  // 宫位映射（盘面）
  const palaceOf = (pos) => TAIYI_PALACE_NUM[pos];
  const taiyiPalace = palaceOf(calendar.taiyiPosition);

  // 判断语
  const judgments = [];
  if (palaceOf(calendar.shiJiPosition) === taiyiPalace) {
    judgments.push(TAIYI_JUDGMENT_TEXT.yan());
  }
  const qiuStars = [];
  if (palaceOf(calendar.wenChangPosition) === taiyiPalace) qiuStars.push('文昌');
  if (row.lordGeneral === taiyiPalace) qiuStars.push('主大将');
  if (row.lordAssistant === taiyiPalace) qiuStars.push('主参将');
  if (row.guestGeneral === taiyiPalace) qiuStars.push('客大将');
  if (row.guestAssistant === taiyiPalace) qiuStars.push('客参将');
  if (qiuStars.length) judgments.push(TAIYI_JUDGMENT_TEXT.qiu(qiuStars));
  if (ln !== undefined) judgments.push(TAIYI_JUDGMENT_TEXT.count('主算', lord, ln));
  if (gn !== undefined) judgments.push(TAIYI_JUDGMENT_TEXT.count('客算', guest, gn));
  if (sn !== undefined) judgments.push(TAIYI_JUDGMENT_TEXT.count('定算', set, sn));
  if (row.lordGeneral === 5 || row.lordAssistant === 5) judgments.push(TAIYI_JUDGMENT_TEXT.zhuMid);
  if (row.guestGeneral === 5 || row.guestAssistant === 5) judgments.push(TAIYI_JUDGMENT_TEXT.keMid);

  // 战术指引（决策树，144/144 实测验证）
  const HE = new Set(['上和', '次和', '下和']);
  const isHe = (n) => n !== undefined && HE.has(n);
  let tacticGuidance;
  if (isHe(ln) && isHe(gn)) tacticGuidance = TAIYI_TACTIC_TEXT.bothHe(ln, gn);
  else if (ln === '纯阳' && gn === '纯阳') tacticGuidance = TAIYI_TACTIC_TEXT.bothPureYang;
  else if (ln === '纯阴' && gn === '纯阴') tacticGuidance = TAIYI_TACTIC_TEXT.bothPureYin;
  else if (ln === '纯阴' && gn === '纯阳') tacticGuidance = TAIYI_TACTIC_TEXT.lordYinGuestYang;
  else if (isHe(ln)) tacticGuidance = lord > guest ? TAIYI_TACTIC_TEXT.lordHeWeak(ln) : TAIYI_TACTIC_TEXT.lordHeStrong(ln);
  else if (isHe(gn)) tacticGuidance = lord > guest ? TAIYI_TACTIC_TEXT.guestHeStrong(gn) : TAIYI_TACTIC_TEXT.guestHeWeak(gn);
  else if (lord > guest) tacticGuidance = TAIYI_TACTIC_TEXT.lordMore;
  else if (guest > lord) tacticGuidance = TAIYI_TACTIC_TEXT.guestMore;
  else tacticGuidance = TAIYI_TACTIC_TEXT.equal;

  return {
    row,
    natures,
    judgments,
    tacticGuidance,
    taiyiPalace,
    wenChangPalace: palaceOf(calendar.wenChangPosition),
    shiJiPalace: palaceOf(calendar.shiJiPosition),
    jiShenPalace: palaceOf(calendar.jiShenPosition),
  };
}

/** 格式化挂钟时间（dateTime 段）。 */
function formatWall(eff) {
  return `${eff.year}-${pad2(eff.month)}-${pad2(eff.day)} ${pad2(eff.hour)}:${pad2(eff.minute)}`;
}

/**
 * 证据层（自研证据层，非 vendor 文本）：供 server.mjs 投影成前端证据链展示。
 * 被 stripInternal 剥离，不进对拍；tests 只做结构自测。
 */
export function buildEvidenceAnalysis({ normalized, calendar, evaluated }) {
  const { row, taiyiPalace, wenChangPalace, shiJiPalace, jiShenPalace } = evaluated;
  const label = calendar.label;                 // 积年/积月/积日/积时
  const yearLabel = normalized.mode === 'year'
    ? `公元${normalized.year}年`
    : `${normalized.iso.slice(0, 16)}`;
  const jiShuDesc = normalized.mode === 'year'
    ? `积年 = 公历年 ${normalized.year} + 10153917 = ${calendar.jiShu}`
    : `积${label}：${normalized.iso.slice(0, 16)}（有效墙钟）按历法换算得 ${calendar.jiShu}`;
  return {
    key: 'taiyi:evidence',
    status: '已计算',
    calculationChain: [
      jiShuDesc,
      `局数 = 积${label} mod 72 = ${calendar.bureau}（${calendar.isYinDun ? '阴遁' : '阳遁'}）`,
      `入纪年数 = 积${label} mod 360 = ${calendar.entryYears}；元 = floor((入纪−1)/72)+1 = ${calendar.yuan}；纪 = floor((入纪−1)/60)+1 = ${calendar.ji}`,
      `太乙落宫 = 第 ${calendar.bureau} 局 → ${calendar.taiyiPosition}（${taiyiPalace} 宫 · ${evaluatedRowGua(evaluated)} 方 ${evaluatedRowDir(evaluated)}）`,
      `文昌落宫 = ${calendar.wenChangPosition}（${wenChangPalace} 宫）`,
      `始击落宫 = ${calendar.shiJiPosition}（${shiJiPalace} 宫）`,
      `计神落宫 = ${calendar.jiShenPosition}（${jiShenPalace} 宫）`,
      `主算 ${row.lord}、客算 ${row.guest}、定算 ${row.set}；六将宫数 主大${row.lordGeneral}/主参${row.lordAssistant}/客大${row.guestGeneral}/客参${row.guestAssistant}/定大${row.setGeneral}/定参${row.setAssistant}`,
    ],
    methodology: [
      '按《太乙金镜式经》四计七十二局口径：年计积年起局，月/日/时计以现代历法定位复现通行四计，时计按冬夏至精确时刻分阴阳遁。',
      '四星（太乙/文昌/始击/计神）依局数与遁别查 72 局星表；阴遁时文昌、计神取对冲位。',
      '主客定三算与六将宫数按 72 局表取值，算数性质按传统和数/阴阳分类表判定。',
    ],
    limitations: [
      '本盘为确定性历法起局，不涉及吉凶结论；解读需结合现实背景。',
      '积年按无公元 0 年口径换算；1986–1991 年中国夏令时窗口按国务院公告调整（结束日 01:00 起回标准时）。',
      '72 局表与算数分类以黑盒对拍实测与旧实现一致为准（口径见 src/rules/taiyi.js）。',
    ],
    primaryFacts: [
      `局数 ${calendar.bureau}（${calendar.isYinDun ? '阴遁' : '阳遁'}）`,
      `太乙 ${calendar.taiyiPosition}（${evaluatedRowGua(evaluated)}·${evaluatedRowDir(evaluated)}，${taiyiPalace} 宫）`,
      `主算 ${row.lord}、客算 ${row.guest}、定算 ${row.set}`,
    ],
    supportingFacts: [
      `入纪 ${calendar.entryYears}（元 ${calendar.yuan}、纪 ${calendar.ji}）`,
      `文昌 ${calendar.wenChangPosition}、始击 ${calendar.shiJiPosition}、计神 ${calendar.jiShenPosition}`,
      `主大 ${row.lordGeneral}、主参 ${row.lordAssistant}、客大 ${row.guestGeneral}、客参 ${row.guestAssistant}、定大 ${row.setGeneral}、定参 ${row.setAssistant}`,
    ],
    summaryFact: {
      promptText: `${yearLabel} 太乙${label}起局：${calendar.isYinDun ? '阴遁' : '阳遁'}第 ${calendar.bureau} 局，`
        + `太乙${calendar.taiyiPosition}（${evaluatedRowGua(evaluated)}方${evaluatedRowDir(evaluated)}），`
        + `主算${row.lord}、客算${row.guest}、定算${row.set}。`,
    },
  };
}

/** 证据层辅助：取太乙卦/方位（复用 TAIYI_GUA/DIR）。 */
function evaluatedRowGua(evaluated) {
  return TAIYI_GUA[evaluated.taiyiPalace];
}
function evaluatedRowDir(evaluated) {
  return TAIYI_DIR[evaluated.taiyiPalace];
}

/**
 * ④ 输出装配：形状与旧实现 stripInternal 后逐键对齐。
 */
export function assemble({ normalized, calendar, evaluated, now, evidenceAnalysis }) {
  const { row, natures, judgments, tacticGuidance, taiyiPalace, wenChangPalace, shiJiPalace, jiShenPalace } = evaluated;
  const inputHash = `${fnv1aHash(stableStringify(normalized.hashInput))}${fnv1aHash(`${stableStringify(normalized.hashInput)}#result`)}`;
  const dateTime = normalized.mode === 'year'
    ? `${normalized.year}-07-01 12:00`
    : formatWall(normalized.effective);
  return {
    scope: calendar.scope,
    ganZhi: calendar.ganZhi,
    dateTime,
    accumulatedValue: calendar.jiShu,
    accumulatedLabel: calendar.label,
    accumulatedYears: calendar.jiShu,
    entryYears: calendar.entryYears,
    yuan: calendar.yuan,
    ji: calendar.ji,
    yinYang: calendar.isYinDun ? '阴遁' : '阳遁',
    bureau: calendar.bureau,
    taiyiPosition: calendar.taiyiPosition,
    taiyiPalace,
    taiyiGua: TAIYI_GUA[taiyiPalace],
    taiyiDir: TAIYI_DIR[taiyiPalace],
    wenChangPosition: calendar.wenChangPosition,
    wenChangPalace,
    shiJiPosition: calendar.shiJiPosition,
    shiJiPalace,
    jiShenPosition: calendar.jiShenPosition,
    jiShenPalace,
    lordCount: row.lord,
    guestCount: row.guest,
    setCount: row.set,
    countNatures: natures,
    tacticGuidance,
    lordGeneral: row.lordGeneral,
    lordAssistant: row.lordAssistant,
    guestGeneral: row.guestGeneral,
    guestAssistant: row.guestAssistant,
    setGeneral: row.setGeneral,
    setAssistant: row.setAssistant,
    sixteenGods: TAIYI_SIXTEEN_GODS.map((g) => ({ branch: g.branch, god: g.god })),
    judgments,
    model: TAIYI_MODEL,
    evidenceAnalysis,
    meta: {
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      algorithm: 'taiyi',
      calculatedAt: now.toISOString(),
      inputHash,
      resultId: `taiyi:${inputHash}`,
    },
  };
}

/**
 * 太乙神数四计起局（自研内核）。
 *
 * @param {object} params
 *   - `{ scope:'year', year }`：公历年 1–9999 整数。
 *   - `{ scope:'month'|'day'|'hour', customDate }`：Date / ISO 字符串 / epoch 毫秒。
 *   - `now`：可选，仅用于 meta.calculatedAt。
 * @returns {object} 生产契约形状的排盘结果
 * @throws {PaipanInputError}
 */
export function generateTaiyiCore(params) {
  const normalized = normalizeInput(params);           // ① 输入归一化
  const calendar = resolveCalendar(normalized);        // ② 历法/起局
  const evaluated = evaluateBureau(calendar);          // ③ 格局判定
  const now = params && params.now instanceof Date ? params.now : new Date();
  const evidenceAnalysis = buildEvidenceAnalysis({ normalized, calendar, evaluated });   // 证据层（自研，被剥离）
  return assemble({ normalized, calendar, evaluated, now, evidenceAnalysis });           // ④ 输出装配
}

export default generateTaiyiCore;
