/**
 * 命理 · 自研排盘内核 · 能力：黄历择日（almanac）
 * ---------------------------------------------------------------------------
 * 导出 `generateAlmanacSelectionCore(params)` —— 与旧实现 `generateAlmanacSelection(params)`
 * 同签名、同输出形状（stripInternal 之后的生产契约形状），并**自带 evidenceAnalysis**：
 * 父节 server.mjs 的 computeDivination 会读 `raw.evidenceAnalysis` 投影出
 * `candidateGroups`（preferredDates/conditionalDates/cautionDates/statusByDate/
 * hardConstraints/realityConstraints）——本内核按「自研证据层」生成同名字段，
 * 否则前端候选分组会为空（规格 §二 almanac 的 ⚠ 说明）。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 normalizeInput —— 事项 10 选 1、日期范围 1900–2100、单次 ≤180 天；非法抛错
 *   ② 历法        resolveCalendar  —— lunar-typescript 换算农历/干支/建除/二十八宿/九星/彭祖/冲煞/
 *                                     神煞/逐时时课（本内核唯一使用 lunar-typescript 的地方）
 *   ③ 格局判定    judgeDay        —— 事项宜忌命中 + 候选状态（可用/条件/慎用）+ 证据事实
 *   ④ 输出装配    assemble        —— days 排序 + evidenceAnalysis（含 candidateGroups 投影所需字段）
 *
 * == 对拍实测确认的口径（黑盒探针，禁止读旧实现源码）==
 *   1. 年干支＝**立春精确时刻换年**（实测 2024-02-07 已过立春但未到正月初一 → 甲辰，
 *      而 lunarDate 仍写「农历癸卯年十二月廿八」）；月干支＝节气精确换月；日干支＝晚子时 23:00 换日
 *      （与内核其余能力同一口径）。
 *   2. `lunarDate` 写法＝`农历{农历年干支}年{数字月}月{日中文}`（月名用数字「十一月/十二月」，
 *      闰月加「闰」；年干支取**农历年**口径，与 ganzhi.year 的立春口径不同——实测确认）。
 *   3. `annualDirectionGods` 12 项随 `ganzhi.year`（立春口径年支）顺推；方位名为二十四山通俗名。
 *   4. `gods` ＝ `getDayJiShen()` 在前、`getDayXiongSha()` 在后（顺序即此），四级中 4 个未翻译 i18n 键
 *      按 rules/almanac.js 的校勘表补中文。
 *   5. 逐时时课 13 条＝`getTimes()`，晚子时按次日日干（实测与旧实现逐条一致）；逐时 highlights/cautions
 *      实测恒为空数组（扫 2026 全年 × 4 事项无一条非空），本内核照此。
 *   6. 候选状态：命中本事项忌项、或该日宜项明列「诸事不宜」→ 慎用候选；否则可用候选。
 *      **days 顺序**＝状态（可用→条件→慎用）→「有宜项命中者在先」→ 日期升序（实测反推）。
 *   7. 旧实现**忽略 participants**（实测传完整生辰后输出 `participants: []`，
 *      且 `participantNotes` / `participantRelationFacts` 恒空）；本内核照此并在此登记。
 *   8. 日期范围 1900–2100、单次 ≤180 天（实测抛错文案见 normalizeInput）。
 *
 * == 与旧实现的有意分歧（信息性，不进关键字段）==
 *   - 不输出 `timestamp`、不输出逐日 `moonPhaseEvidence`（后者被 server.mjs 主动剔除；
 *     本内核不含天文历算，故不产该字段）；`evidenceAnalysis` 被 stripInternal 剥离，不进对拍。
 *   - 证据层（evidenceAnalysis/各 fact 的 promptText/sources/limitation）与 highlights/cautions 的
 *     **现代白话说辞**由本文件自行撰写，不复制旧实现文案。
 *   - 结构化盘面字段（历法/建除/二十八宿/九星/彭祖/冲煞/宜忌/方位神/逐时时课）与旧实现 100% 一致。
 */

import { Solar } from 'lunar-typescript';
import {
  ALMANAC_COPY,
  ALMANAC_HOURS,
  ALMANAC_RULES,
  ALMANAC_TOPIC_KEYS,
  ALL_PURPOSES_TABOO,
  BRANCH_DIRECTION_NAMES,
  CANDIDATE_STATUS,
  TWELVE_GOD_LUCK,
  almanacTopic,
  annualDirectionGods,
  cleanTabooItems,
  fixXiongShaName,
  fixXiuAnimal,
  lunarMonthText,
  matchTopicItems,
  nineStar,
  nineStarIndexFromPhases,
} from '../../rules/almanac.js';
import { fnv1aHash, stableStringify } from '../../pipeline/index.js';

/** meta 段版本（旧实现 almanac 无 meta 段，本内核沿用同形状，故只保留常量供审计）。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** 生产契约版本（与旧实现一致；换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** 本内核自撰的证据层限制语。 */
const LIMITATION_FACTS = '传统择日资料只用于当前事项的候选比较，不证明现实中的疾病、灾祸、官非、财损、婚姻或生育结果。';
const LIMITATION_TOPIC = '事项命中事实只说明当前事项关键词是否出现在当日宜忌条目中，不证明事项必然成功，也不得替代现实条件核验。';
const LIMITATION_EVIDENCE = '本内核证据层只记录候选范围、历法字段、事项宜忌命中、神煞读取与候选分组如何形成；不证明现实吉凶、成功率或个人结果。';

/** 内核输入错误（缺输入 / 非法事项 / 非法日期范围）。调用方据此返回 400。 */
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

const MS_PER_DAY = 86400000;

/** 日期字符串 → {y,m,d}（严格校验真实存在的公历日）。 */
function parseYmd(text, fieldName) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new PaipanInputError('invalid_date', `${fieldName} 必须是 YYYY-MM-DD 格式的日期字符串。`);
  }
  const [y, m, d] = text.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d, 12);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== m || back.getUTCDate() !== d) {
    throw new PaipanInputError('invalid_date', `${fieldName} 不是真实存在的公历日期: ${text}`);
  }
  return { year: y, month: m, day: d };
}

/** 日期 → 儒略日数（UT 12:00 惯例）。 */
function jdnOfYmd({ year, month, day }) {
  return Math.floor(Date.UTC(year, month - 1, day, 12) / MS_PER_DAY) + 2440588;
}

/** 儒略日数 → 日期字符串。 */
function ymdOfJdn(j) {
  return new Date((j - 2440588) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 儒略日数 → Solar。 */
function solarOfJdn(j) {
  const [y, m, d] = ymdOfJdn(j).split('-').map(Number);
  return Solar.fromYmd(y, m, d);
}

/** 数字月 → 月份中文写法（对拍实测：数字月「正月/二月/…/十一月/十二月」，不写「冬月/腊月」）。 */
function monthText(lunar) {
  return lunarMonthText(lunar.getMonth());
}

/* ============================ ① 输入归一化 ============================ */

/**
 * ① 输入归一化：事项 + 起止日期（+ 可选参与人，实测旧实现忽略之）。
 *
 * @param {object|undefined|null} params `{ topic, startDate, endDate, participants?, weekendPreference?, timePreferences?, customTopicLabel? }`
 * @returns {{topic:object, startDate:string, endDate:string, startJdn:number, endJdn:number, dayCount:number,
 *   weekendPreference:string, timePreferences:Array<string>, participants:Array, customTopicLabel:string|null, hashInput:object}}
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_params', '黄历择日必须传 { topic, startDate, endDate }；缺输入不猜、不回落。');
  }
  const { topic } = params;
  if (typeof topic !== 'string' || !ALMANAC_TOPIC_KEYS.includes(topic)) {
    throw new PaipanInputError(
      'unknown_topic',
      `未知的黄历择日事项类型: ${topic}（应为 ${ALMANAC_TOPIC_KEYS.join('/')} 之一）`,
    );
  }
  const start = parseYmd(params.startDate, '开始日期');
  const end = parseYmd(params.endDate, '结束日期');
  for (const [label, y] of [['开始日期', start.year], ['结束日期', end.year]]) {
    if (y < ALMANAC_RULES.dateRange.minYear || y > ALMANAC_RULES.dateRange.maxYear) {
      throw new PaipanInputError('date_out_of_range', `${label}年份需在 ${ALMANAC_RULES.dateRange.minYear}-${ALMANAC_RULES.dateRange.maxYear} 之间`);
    }
  }
  const startJdn = jdnOfYmd(start);
  const endJdn = jdnOfYmd(end);
  if (endJdn < startJdn) {
    throw new PaipanInputError('invalid_range', '黄历择日起止日期无效：结束日期不得早于开始日期。');
  }
  const dayCount = endJdn - startJdn + 1;
  if (dayCount > ALMANAC_RULES.dateRange.maxDaysPerCall) {
    throw new PaipanInputError('range_too_long', `黄历择日一次最多比较 ${ALMANAC_RULES.dateRange.maxDaysPerCall} 天，请缩小日期范围`);
  }
  const timePreferences = Array.isArray(params.timePreferences) ? params.timePreferences.map((x) => String(x)) : [];
  const customTopicLabel = typeof params.customTopicLabel === 'string' && params.customTopicLabel.trim() ? params.customTopicLabel.trim() : null;
  return {
    topic: almanacTopic(topic),
    startDate: params.startDate,
    endDate: params.endDate,
    startJdn,
    endJdn,
    dayCount,
    weekendPreference: typeof params.weekendPreference === 'string' && params.weekendPreference ? params.weekendPreference : 'any',
    timePreferences,
    // 对拍实测：旧实现忽略 participants（输出恒为 []），本内核照此登记，不据此编造个人结论。
    participants: [],
    customTopicLabel,
    hashInput: {
      capability: 'almanac',
      topic,
      startDate: params.startDate,
      endDate: params.endDate,
      weekendPreference: typeof params.weekendPreference === 'string' ? params.weekendPreference : 'any',
      timePreferences,
    },
  };
}

/* ============================ ② 历法 ============================ */

/**
 * 构建九星相位边界表：每年「夏至/冬至」当天最近的甲子日（口径见 rules/almanac.js）。
 * 打平时取较早者；同一甲子日只保留一次。
 *
 * @param {number} y0 起始年
 * @param {number} y1 结束年
 * @returns {Array<{jdn:number, type:'顺'|'逆'}>} 升序边界表
 */
export function buildNineStarBoundaries(y0, y1) {
  const list = [];
  for (let year = y0; year <= y1; year += 1) {
    const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
    for (const [name, type] of [['夏至', '逆'], ['冬至', '顺']]) {
      const solar = table[name];
      if (!solar) continue;
      const termJdn = Math.floor(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 12) / MS_PER_DAY) + 2440588;
      let found = null;
      for (let delta = 0; delta <= 31 && found === null; delta += 1) {
        for (const sign of (delta === 0 ? [0] : [delta, -delta])) {
          const j = termJdn + sign;
          if (solarOfJdn(j).getLunar().getDayInGanZhi() === '甲子') { found = j; break; }
        }
      }
      if (found === null) throw new PaipanInputError('nine_star_boundary', `无法为 ${name}${year} 找到最近的甲子日`);
      list.push({ jdn: found, type });
    }
  }
  list.sort((a, b) => a.jdn - b.jdn);
  const uniq = [];
  for (const b of list) if (!uniq.length || uniq[uniq.length - 1].jdn !== b.jdn) uniq.push(b);
  return uniq;
}

/**
 * ② 历法：单日全部历法字段（农历/干支/建除/二十八宿/九星/彭祖/冲煞/神煞/方位神/逐时时课）。
 *
 * @param {string} date YYYY-MM-DD
 * @param {number} jdn 儒略日数
 * @param {ReadonlyArray<object>} boundaries 九星相位边界表
 * @returns {object} 单日历法事实（未装配）
 */
export function resolveCalendar(date, jdn, boundaries) {
  const [y, m, d] = date.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  // 建除十二值 / 二十八宿 / 九星 / 彭祖 / 冲煞 / 神煞
  const jiShen = lunar.getDayJiShen().map(fixXiongShaName);
  const xiongSha = lunar.getDayXiongSha().map(fixXiongShaName);
  const gods = [...jiShen, ...xiongSha];
  const starIndex = nineStarIndexFromPhases(jdn, boundaries);
  const star = nineStar(starIndex);

  const yearGanZhiExact = lunar.getYearInGanZhiExact();
  const yearBranch = yearGanZhiExact.slice(1);

  // 逐时时课：13 条（含晚子时，按次日日干起五鼠遁；lunar-typescript 的 getTimes 与旧实现逐条一致）
  const times = lunar.getTimes();
  const hours = ALMANAC_HOURS.map((def, i) => {
    const t = times[i];
    return {
      name: def.name,
      range: def.range,
      ganzhi: t.getGanZhi(),
      branch: t.getZhi(),
      twelveStar: t.getTianShen(),
      highlights: [],
      cautions: [],
      participantNotes: [],
      participantRelationFacts: [],
    };
  });

  return {
    date,
    jdn,
    weekday: `星期${lunar.getWeekInChinese()}`,
    lunarDate: `农历${lunar.getYearInGanZhi()}年${monthText(lunar)}${lunar.getDayInChinese()}`,
    ganzhi: {
      // 年：立春精确换年；月：节气精确换月；日：晚子时换日（对拍实测口径）
      year: yearGanZhiExact,
      month: lunar.getMonthInGanZhiExact(),
      day: lunar.getDayInGanZhiExact(),
    },
    zodiac: lunar.getDayShengXiao(),
    dayOfficer: lunar.getZhiXing(),
    twelveStar: lunar.getDayTianShen(),
    twentyEightStar: lunar.getXiu(),
    twentyEightStarDetail: {
      fullName: `${lunar.getXiu()}${lunar.getZheng()}${fixXiuAnimal(lunar.getXiu(), lunar.getAnimal())}`,
      sevenStar: lunar.getZheng(),
      animal: fixXiuAnimal(lunar.getXiu(), lunar.getAnimal()),
      zone: lunar.getGong(),
      fortune: lunar.getXiuLuck(),
      source: 'lunar-typescript 二十八宿原生属性（宿名/七政/方/吉凶）；宿动物按本内核校勘表（壁→貐、胃→雉）',
    },
    nineStar: star.name,
    nineStarDetail: {
      fullName: star.fullName,
      color: star.color,
      wuxing: star.wuxing,
      dipper: star.dipper,
      direction: star.direction,
      source: '本内核九星值日口径（换向边界＝夏至/冬至最近甲子日）+ lunar-typescript 九星属性表',
    },
    gods,
    jiShen,
    xiongSha,
    recommends: cleanTabooItems(lunar.getDayYi()),
    avoids: cleanTabooItems(lunar.getDayJi()),
    pengZuGan: lunar.getPengZuGan(),
    pengZuZhi: lunar.getPengZuZhi(),
    pengZu: `${lunar.getPengZuGan()} ${lunar.getPengZuZhi()}`,
    clash: `冲${lunar.getDayChong()}，煞${lunar.getDaySha()}`,
    annualDirectionGods: annualDirectionGods(yearBranch),
    hours,
  };
}

/* ============================ ③ 格局判定 ============================ */

/**
 * ③ 事项命中 + 候选状态 + 证据事实。
 *
 * @param {object} day ②的单日历法事实
 * @param {object} topic ①的事项定义
 * @returns {{status:string, statusRank:number, yiMatched:Array<string>, jiMatched:Array<string>,
 *   highlights:Array<string>, cautions:Array<string>, godFacts:Array<object>, topicMatchFacts:Array<object>}}
 */
export function judgeDay(day, topic) {
  const yiMatched = matchTopicItems(day.recommends, topic.yiKeywords);
  const jiMatched = matchTopicItems(day.avoids, topic.jiKeywords);
  const allTaboo = day.avoids.includes(ALL_PURPOSES_TABOO);

  let status = CANDIDATE_STATUS.preferred;
  let statusRank = 0;
  if (allTaboo) { status = CANDIDATE_STATUS.caution; statusRank = 2; }
  else if (jiMatched.length) { status = CANDIDATE_STATUS.caution; statusRank = 2; }

  const highlights = yiMatched.length ? [ALMANAC_COPY.highlightHit(topic.label)] : [];
  const cautions = [];
  if (jiMatched.length) cautions.push(ALMANAC_COPY.cautionHit(topic.label));
  if (allTaboo) cautions.push(ALMANAC_COPY.cautionAllTaboo(topic.label));

  const godFacts = day.gods.map((name, i) => ({
    key: `${day.date}:god:${name}`,
    name,
    classification: i < day.jiShen.length ? '吉神' : '凶神',
    luck: TWELVE_GOD_LUCK[name] || null,
    status: '已读取',
    limitation: LIMITATION_FACTS,
  }));

  const mkFact = (sourceType, inputItems, keywords, matchedItems, statusText) => ({
    key: `${day.date}:topic:${sourceType === '原始宜项' ? 'day-recommends' : 'day-avoids'}`,
    scope: '候选日',
    topic: topic.key,
    topicLabel: topic.label,
    sourceType,
    status: statusText,
    inputItems,
    keywords,
    matchedItems,
    limitation: LIMITATION_TOPIC,
  });
  const topicMatchFacts = [
    mkFact('原始宜项', day.recommends, topic.yiKeywords, yiMatched, yiMatched.length ? '支持' : '中性'),
    mkFact('原始忌项', day.avoids, topic.jiKeywords, jiMatched, jiMatched.length ? '限制' : '中性'),
  ];

  return { status, statusRank, yiMatched, jiMatched, allTaboo, highlights, cautions, godFacts, topicMatchFacts };
}

/* ============================ ④ 输出装配 ============================ */

/**
 * ④ 输出装配：days 排序（状态 → 有宜项命中 → 日期升序）+ evidenceAnalysis（含候选分组）。
 *
 * @param {{normalized:object, days:Array<object>, evidenceDays:Array<object>}} parts
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, days }) {
  const topic = normalized.topic;
  // days 顺序（对拍实测口径）：状态（可用→条件→慎用）→ 有宜项命中者在前 → 日期升序
  const ordered = days.slice().sort((a, b) => {
    if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank;
    const ah = a.yiMatched.length ? 0 : 1;
    const bh = b.yiMatched.length ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  const candidates = ordered.map((d) => ({
    date: d.date,
    status: d.status,
    calendarFact: {
      date: d.date,
      weekday: d.weekday,
      lunarDate: d.lunarDate,
      ganzhi: d.ganzhi,
      dayOfficer: d.dayOfficer,
      twelveStar: d.twelveStar,
      twentyEightStar: d.twentyEightStar,
      nineStar: d.nineStar,
      clash: d.clash,
    },
    tabooFact: {
      recommends: d.recommends,
      avoids: d.avoids,
      yiMatched: d.yiMatched,
      jiMatched: d.jiMatched,
      highlights: d.highlights,
      cautions: d.cautions,
    },
    godFactCount: d.godFacts.length,
    topicMatchFacts: d.topicMatchFacts,
    decision: {
      status: d.status,
      reasons: [
        ...(d.jiMatched.length ? [`忌项命中 ${d.jiMatched.join('、')}`] : []),
        ...(d.allTaboo ? ['当日宜项明列诸事不宜'] : []),
        ...(d.yiMatched.length ? [`宜项命中 ${d.yiMatched.join('、')}`] : []),
      ],
      limitation: LIMITATION_EVIDENCE,
    },
  }));

  const evidenceAnalysis = {
    key: 'almanac:evidence',
    status: '已计算',
    candidates,
    preferredDates: candidates.filter((c) => c.status === CANDIDATE_STATUS.preferred).map((c) => c.date),
    conditionalDates: candidates.filter((c) => c.status === CANDIDATE_STATUS.conditional).map((c) => c.date),
    cautionDates: candidates.filter((c) => c.status === CANDIDATE_STATUS.caution).map((c) => c.date),
    hardConstraints: ALMANAC_COPY.hardConstraints.map((f) => f(normalized.startDate, normalized.endDate, topic.label)),
    realityConstraints: ALMANAC_COPY.realityConstraints.map((f) => f()),
    calculationChain: [
      `限定 ${normalized.startDate} 至 ${normalized.endDate}，按「${topic.label}」建立 ${normalized.dayCount} 个候选日`,
      `逐日核验事项宜忌命中与值日神煞，形成 ${candidates.reduce((n, c) => n + c.topicMatchFacts.length, 0)} 项事项事实`,
      `按候选状态分组：可用 ${candidates.filter((c) => c.status === CANDIDATE_STATUS.preferred).length} 日、`
        + `慎用 ${candidates.filter((c) => c.status === CANDIDATE_STATUS.caution).length} 日`,
      '未提供参与人资料（旧实现亦忽略参与人），不生成个人适配结论',
    ],
    limitations: [
      LIMITATION_EVIDENCE,
      '原始宜忌只保留历书列项，命中与否只用于当前事项比较；未列不等于适宜，命中也不等于现实必然成功。',
      '候选状态只按明确忌项、诸事不宜与日期稳定排序分组，不设吉凶总分、不代表成功率或唯一最佳日期。',
    ],
    methodology: [
      '先按用户给定日期范围与事项逐日取历法事实（公农历、干支、建除、二十八宿、九星、彭祖、冲煞、方位神、逐时时课）。',
      '再把当日宜忌条目与本事项关键词逐项比对，命中项保持历书原次序。',
      '最后按候选状态与宜项命中情况稳定排序，并把传统支持与限制并列展示。',
    ],
  };

  return {
    topic: topic.key,
    topicLabel: topic.label,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    weekendPreference: normalized.weekendPreference,
    timePreferences: normalized.timePreferences,
    days: ordered.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      lunarDate: d.lunarDate,
      ganzhi: d.ganzhi,
      zodiac: d.zodiac,
      dayOfficer: d.dayOfficer,
      twelveStar: d.twelveStar,
      twentyEightStar: d.twentyEightStar,
      twentyEightStarDetail: d.twentyEightStarDetail,
      nineStar: d.nineStar,
      nineStarDetail: d.nineStarDetail,
      gods: d.gods,
      recommends: d.recommends,
      avoids: d.avoids,
      pengZu: d.pengZu,
      pengZuGan: d.pengZuGan,
      pengZuZhi: d.pengZuZhi,
      clash: d.clash,
      annualDirectionGods: d.annualDirectionGods,
      highlights: d.highlights,
      cautions: d.cautions,
      participantNotes: [],
      topicMatchFacts: d.topicMatchFacts,
      godFacts: d.godFacts,
      participantRelationFacts: [],
      hours: d.hours,
    })),
    participants: [],
    evidenceAnalysis,
  };
}

/* ============================ 对外能力 ============================ */

/**
 * 黄历择日（自研内核）。
 *
 * @param {object} params `{ topic, startDate, endDate, participants?, weekendPreference?, timePreferences?, customTopicLabel? }`
 * @returns {object} 生产契约形状的择日结果（含 evidenceAnalysis 供 server 投影 candidateGroups）
 * @throws {PaipanInputError} 缺参数 / 非法事项 / 非法或越界日期 / 范围超过 180 天
 */
export function generateAlmanacSelectionCore(params) {
  const normalized = normalizeInput(params);                          // ① 输入归一化
  const y0 = Number(normalized.startDate.slice(0, 4));
  const y1 = Number(normalized.endDate.slice(0, 4));
  const boundaries = buildNineStarBoundaries(y0 - 2, y1 + 2);          // ② 历法（九星相位边界）

  const days = [];
  for (let j = normalized.startJdn; j <= normalized.endJdn; j += 1) {
    const date = ymdOfJdn(j);
    const calendar = resolveCalendar(date, j, boundaries);            // ② 历法（单日）
    const judged = judgeDay(calendar, normalized.topic);               // ③ 格局判定
    days.push({ ...calendar, ...judged });
  }
  return assemble({ normalized, days });                               // ④ 输出装配
}

/** 供测试/审计读取：本内核黄历口径的冻结快照（唯一权威值在 rules/almanac.js）。 */
export const ALMANAC_CORE_INFO = Object.freeze({
  rules: ALMANAC_RULES,
  branchDirections: BRANCH_DIRECTION_NAMES,
  hashAlgorithm: 'fnv1a-32（见 src/pipeline/index.js）',
  inputHashOf: (params) => fnv1aHash(stableStringify(params)),
});

export default generateAlmanacSelectionCore;
