/**
 * 命理 · 自研排盘内核 · 五运六气（`src/capabilities/wuyun/index.js`）
 * ===========================================================================
 * 能力：以公历年推算该年五运六气（岁运太过不及、司天在泉、五步主客运、六步主客气、
 *       符会、平气与病机偏胜），**纯历法推算，不依赖星历**。
 *
 * 契约：导出 `calculateWuyunLiuqiCore({ year })`，stripInternal 之前与旧实现
 *       （`calculateWuyunLiuqi`）**同签名同形状**（形状由黑盒探针确认，见
 *       tools/_probe/wuyun/probe-01~probe-06）：
 *         input / annualMovement / sitian / zaiquan / annualRelation /
 *         annualConformities / movementSteps[5] / qiSteps[6] / pathomechanism / limitations
 *
 * ---------------------------------------------------------------------------
 * 四段纯函数管线（README §1）
 * ---------------------------------------------------------------------------
 *   ① 输入归一化 `normalizeInput(params)`  —— 校验 {year} 为 1900–2199 整数；缺输入/越界抛错
 *   ② 历法/起局 `resolveCalendar(input)`    —— 年干支（六十甲子序）＋ 交司所需节气日
 *                                              （本能力唯一使用 `lunar-typescript` 的地方）
 *   ③ 格局判定 `computeAnnual / computeMovementSteps / computeQiSteps`
 *                                          —— 纯查表与生克判定，无 IO、可反复重算
 *   ④ 输出装配 `assemble(...)`              —— 按生产契约键序拼装
 *
 * ---------------------------------------------------------------------------
 * 对拍实测锁定的口径（均只黑盒运行旧实现得出，未读其源码）
 * ---------------------------------------------------------------------------
 *   1. **年干支**＝六十甲子序 `(year - 4) mod 60`：1900–2199 共 300 年与旧实现
 *      `input.yearGanZhi` **0 处不一致**（probe-02 §5）。
 *   2. **合历年范围 1900–2199**（含端点）：1899 与 2200 旧实现均抛
 *      「节气证据年份需在 1900-2200 之间」（probe-02 §2）；本内核同样抛错。
 *   3. **除公历日期外的全部字段只由干支决定**：同一干支在 300 年的 5 轮里，
 *      除 `input.year` 与 `gregorianStart/End` 外指纹完全一致（probe-04 §1）。
 *   4. **交司公历落点**＝「节气日 + 传统日期序号」，用 `lunar-typescript@1.8.6`
 *      的节气日复现：五步 1500 条 + 六步 1800 条边界在 300 年上 **0 处不一致**（probe-06）。
 *   5. **符会逐年名单**（60 甲子）：天符 12 年（＝同气年）、岁会 8 年、太乙天符 4 年、
 *      同天符 6 年、同岁会 6 年；去重 26 年 —— 与 probe-04 统计一致。
 *   6. **平气**：以「年支 × 司天」对中运的五行关系对判定（rules/wuyun.js PING_QI_RULES），
 *      300 年上与旧实现 100% 一致（每 60 年 10 个平气干支）。
 *
 * ---------------------------------------------------------------------------
 * 与旧实现的**有意分歧**（不视为缺陷；信息性差异会在对拍报告里逐条列出）
 * ---------------------------------------------------------------------------
 *   a. **不产出 `prompt` / `sources` / `calculationChain`**：这三项属内部中间字段
 *      （`stripInternal` 的剥离清单），README §1 ④ 禁止内核夹带提示词与审计轨迹；
 *      规则出处改由 rules 文件的来源登记（含公网 URL）承载。
 *   b. **现代白话文案自撰**：`basis` / `rule` / `summary` / `pathomechanism` 文本与
 *      `limitations` 由本内核按主题从零生成（依据《素问》《运气要诀》公有领域原文），
 *      不从任何第三方实现复制；关键字段不含这些文案（见 fixtures 说明）。
 *   c. **`input.yearGanZhiSource`** 用自撰口径串，且登记为信息性字段。
 *
 * 纪律：确定性零 LLM、零触网、零 IO；`src/` 不读时钟、不用随机数；缺输入抛错不回落。
 */

import { Solar } from 'lunar-typescript';
import {
  ANNUAL_RELATION_KINDS,
  BOUNDARY_PRECISION,
  CLIMATE_QI_BY_ELEMENT,
  CONFORMITY_NAMES,
  GAN_YIN_YANG,
  GAN_YUN_ELEMENT,
  GUEST_ROLE,
  HOST_QI_ORDER,
  LIU_QI,
  LIMITATIONS,
  MOVEMENT_STEPS,
  PING_QI_RULES,
  PING_QI_TYPE,
  QI_STEPS,
  REL_BEGETS_ME,
  REL_CONTROLS_ME,
  REL_I_BEGET,
  REL_I_CONTROL,
  REL_SAME,
  REQUIRED_SOLAR_TERMS,
  SITIAN_PATHOMECHANISM,
  SITIAN_STEP,
  SOURCE_RECONCILIATION,
  TONE_STRENGTH,
  WU_YIN_BY_ELEMENT,
  WU_YUN_ORDER,
  YEAR_GAN_ZHI_SOURCE,
  YEAR_RANGE,
  YUN_BU_JI_NAME,
  YUN_PING_QI_NAME,
  YUN_STRENGTH,
  YUN_TAI_GUO_NAME,
  ZAIQUAN_STEP,
  ZHI_BENWEI_ELEMENT,
  ZHI_ELEMENT,
  ZHI_SITIAN_NAME,
  ganZhiOfYear,
  guestQiNameAtStep,
  wuXingRelation,
  zaiquanNameOfSitian,
} from '../../rules/wuyun.js';

/** 输入/范围类错误（与其它能力同名同形：缺输入不猜、不回落）。 */
export class PaipanInputError extends Error {
  /**
   * @param {string} code 机器可读错误码
   * @param {string} message 面向排障的中文说明
   */
  constructor(code, message) {
    super(message);
    this.name = 'PaipanInputError';
    this.code = code;
  }
}

const MS_PER_DAY = 86400000;
const JDN_EPOCH = 2440588; // 1970-01-01 的儒略日数
const CONFORMITY_FLAG_KEY = Object.freeze({
  天符: 'tianfu', 岁会: 'suihui', 太乙天符: 'taiyiTianfu', 同天符: 'tongTianfu', 同岁会: 'tongSuihui',
});

/* ===========================================================================
 * ① 输入归一化
 * ========================================================================= */

/**
 * 只接受 `{ year }`（1900–2199 整数）。
 * 旧实现同样只接受这一形态（裸数字/字符串年份/缺 year 皆抛错，probe-02 §1）。
 *
 * @param {unknown} params 调用方入参
 * @returns {{year:number}} 归一化后的确定性中间对象
 * @throws {PaipanInputError} `invalid_params` / `missing_year` / `invalid_year` / `year_out_of_range`
 */
export function normalizeInput(params) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('invalid_params', '五运六气入参必须是 { year } 对象（不猜、不回落当前时间）。');
  }
  const raw = params.year;
  if (raw === undefined || raw === null) {
    throw new PaipanInputError('missing_year', '五运六气必须提供 year（公历年整数）。');
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new PaipanInputError('invalid_year', `公历年必须是整数: ${String(raw)}`);
  }
  if (raw < YEAR_RANGE.min || raw > YEAR_RANGE.max) {
    throw new PaipanInputError(
      'year_out_of_range',
      `公历年需在 ${YEAR_RANGE.min}-${YEAR_RANGE.max} 之间（交司日期依赖节气表，范围外不外推）: ${raw}`,
    );
  }
  return { year: raw };
}

/* ===========================================================================
 * ② 历法/起局：年干支 + 交司所需节气日
 * ========================================================================= */

/** 节气 Solar → 儒略日数（取正午，避免时区/夏令时边界影响）。 */
function solarToJdn(solar) {
  return Math.floor(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 12) / MS_PER_DAY) + JDN_EPOCH;
}

/** 儒略日数 → `YYYY-MM-DD`（纯 UTC 运算，与进程本地时区无关）。 */
function jdnToYmd(jdn) {
  const d = new Date((jdn - JDN_EPOCH) * MS_PER_DAY);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 取某年节气表中某节气的儒略日数。
 *
 * @param {number} year 公历年
 * @param {string} name 节气名
 * @returns {number} 儒略日数
 * @throws {Error} 节气表缺该节气（正常年份不会发生；发生即数据异常，直接报错不猜）
 */
function jieQiJdn(year, name) {
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
  const solar = table[name];
  if (!solar) throw new Error(`节气表缺少 ${year} 年「${name}」`);
  return solarToJdn(solar);
}

/**
 * 由公历年得到「年干支 + 交司所需节气日」。节气日只用于把《运气要诀》的
 * 「某节气后第几日」落到公历某一天；本能力到「日」为止，不细化到时刻。
 *
 * @param {{year:number}} input ①段产物
 * @returns {{year:number, yearGanZhi:string, gan:string, zhi:string, jieQi:Record<string, number>}}
 *          `jieQi` 键为节气名、值为儒略日数，另含 `NEXT_大寒`（次年大寒，供终之气与五运收尾）
 */
export function resolveCalendar(input) {
  const { year } = input;
  const yearGanZhi = ganZhiOfYear(year);
  const jieQi = {};
  for (const name of REQUIRED_SOLAR_TERMS) jieQi[name] = jieQiJdn(year, name);
  jieQi['NEXT_大寒'] = jieQiJdn(year + 1, '大寒');
  return { year, yearGanZhi, gan: yearGanZhi[0], zhi: yearGanZhi[1], jieQi };
}

/* ===========================================================================
 * ③ 格局判定（纯查表 / 纯生克，无 IO）
 * ========================================================================= */

/**
 * 主客关系（主 × 客的五行生克），五步与六步共用同一条判定。
 *
 * @param {string} hostElement 主五行
 * @param {string} guestElement 客五行
 * @returns {'同气'|'主生客'|'客生主'|'主克客'|'客克主'} 关系名
 */
export function hostGuestRelationKind(hostElement, guestElement) {
  const rel = wuXingRelation(hostElement, guestElement);
  if (rel === REL_SAME) return '同气';
  if (rel === REL_I_BEGET) return '主生客';
  if (rel === REL_BEGETS_ME) return '客生主';
  if (rel === REL_I_CONTROL) return '主克客';
  return '客克主';
}

/** 五步主客关系文案（自撰）。 */
function movementRelationBasis(hostElement, guestElement) {
  const kind = hostGuestRelationKind(hostElement, guestElement);
  switch (kind) {
    case '同气': return `主运与客运同为${hostElement}气。`;
    case '主生客': return `主运${hostElement}生客运${guestElement}。`;
    case '客生主': return `客运${guestElement}生主运${hostElement}。`;
    case '主克客': return `主运${hostElement}克客运${guestElement}。`;
    default: return `客运${guestElement}克主运${hostElement}。`;
  }
}

/** 六步主客关系文案（自撰）。 */
function qiRelationBasis(hostElement, guestElement) {
  const kind = hostGuestRelationKind(hostElement, guestElement);
  switch (kind) {
    case '同气': return `主气与客气同为${hostElement}气。`;
    case '主生客': return `主气${hostElement}生客气${guestElement}。`;
    case '客生主': return `客气${guestElement}生主气${hostElement}。`;
    case '主克客': return `主气${hostElement}克客气${guestElement}。`;
    default: return `客气${guestElement}克主气${hostElement}。`;
  }
}

/**
 * 年度格局：中运（岁运）、司天、在泉、气运相临、符会、平气。
 *
 * @param {{yearGanZhi:string, gan:string, zhi:string}} calendar ②段产物
 * @returns {object} 年度格局（纯数据，供③-b/③-c 与④使用）
 */
export function computeAnnual(calendar) {
  const { yearGanZhi, gan, zhi } = calendar;
  const yinYang = GAN_YIN_YANG[gan];
  const strength = yinYang === '阳' ? YUN_STRENGTH.yang : YUN_STRENGTH.yin;
  const toneStrength = yinYang === '阳' ? TONE_STRENGTH.yang : TONE_STRENGTH.yin;
  const element = GAN_YUN_ELEMENT[gan];
  const tone = WU_YIN_BY_ELEMENT[element];

  const sitianIdx = LIU_QI.findIndex((q) => q.name === ZHI_SITIAN_NAME[zhi]);
  if (sitianIdx < 0) throw new Error(`地支 ${zhi} 无对应司天六气`);
  const sitianName = LIU_QI[sitianIdx].name;
  const zaiquanName = zaiquanNameOfSitian(sitianName);
  const zaiquanIdx = LIU_QI.findIndex((q) => q.name === zaiquanName);
  const sitianElement = LIU_QI[sitianIdx].element;
  const zaiquanElement = LIU_QI[zaiquanIdx].element;

  const relSitian = wuXingRelation(element, sitianElement);
  const relationKind = {
    [REL_SAME]: '同气',
    [REL_CONTROLS_ME]: '天刑',
    [REL_BEGETS_ME]: '顺化',
    [REL_I_BEGET]: '小逆',
    [REL_I_CONTROL]: '不和',
  }[relSitian];
  if (!ANNUAL_RELATION_KINDS.includes(relationKind)) {
    throw new Error(`无法判定气运相临（中运 ${element} vs 司天 ${sitianElement}）`);
  }

  const tianfu = sitianElement === element;
  const suihui = ZHI_BENWEI_ELEMENT[zhi] === element;
  const taiyiTianfu = tianfu && suihui;
  const tongTianfu = yinYang === '阳' && zaiquanElement === element;
  const tongSuihui = yinYang === '阴' && zaiquanElement === element;

  // 平气：以「年支 × 司天」对中运的五行关系对判定（rules/wuyun.js PING_QI_RULES）
  const relZhi = wuXingRelation(element, ZHI_ELEMENT[zhi]);
  const isPingQi = PING_QI_RULES[strength].some(([a, b]) => a === relZhi && b === relSitian);

  return {
    yearGanZhi,
    gan,
    zhi,
    yinYang,
    element,
    tone,
    toneStrength,
    toneName: toneStrength + tone,
    strength,
    sitianIdx,
    sitianName,
    zaiquanIdx,
    sitianElement,
    zaiquanElement,
    relationKind,
    conformities: { tianfu, suihui, taiyiTianfu, tongTianfu, tongSuihui },
    isPingQi,
    relZhi,
    relSitian,
  };
}

/** 由「元素 + 太少」拼一条五运（主运/客运共用）。 */
function movementEntry(element, toneStrength) {
  return {
    element,
    tone: WU_YIN_BY_ELEMENT[element],
    toneStrength,
    toneName: toneStrength + WU_YIN_BY_ELEMENT[element],
    strength: toneStrength === TONE_STRENGTH.yang ? YUN_STRENGTH.yang : YUN_STRENGTH.yin,
    climateQi: CLIMATE_QI_BY_ELEMENT[element],
  };
}

/**
 * 五步主客运：
 *   主运＝木火土金水顺布，太少以「中运所在一步」为准前后交替（《运气要诀·五音主客太少相生歌》）；
 *   客运＝以中运为初运、按五行相生顺推，太少逐步交替（《运气要诀·客运歌》）。
 *
 * @param {object} annual ③-a 产物
 * @param {Record<string, number>} jieQi ②段节气日
 * @returns {Array<object>} 五步（已含公历区间与主客关系）
 */
export function computeMovementSteps(annual, jieQi) {
  const k = WU_YUN_ORDER.indexOf(annual.element);
  const flip = annual.toneStrength === TONE_STRENGTH.yang ? TONE_STRENGTH.yin : TONE_STRENGTH.yang;

  return MOVEMENT_STEPS.map((spec, i) => {
    const hostToneStrength = (i - k) % 2 === 0 ? annual.toneStrength : flip;
    const hostMovement = movementEntry(WU_YUN_ORDER[i], hostToneStrength);
    const guestElement = WU_YUN_ORDER[(k + i) % WU_YUN_ORDER.length];
    const guestToneStrength = i % 2 === 0 ? annual.toneStrength : flip;
    const guestMovement = movementEntry(guestElement, guestToneStrength);

    const startJdn = jieQi[spec.startTerm] + spec.offsetDays;
    const endJdn = (spec.endTerm === 'NEXT_DAHAN' ? jieQi['NEXT_大寒'] : jieQi[spec.endTerm]) + spec.endOffset;

    return {
      order: i + 1,
      label: spec.label,
      startBoundary: {
        solarTerm: spec.startTerm,
        offsetDays: spec.offsetDays,
        description: spec.offsetDays === 0 ? `${spec.startTerm}日起` : `${spec.startTerm}后第${spec.offsetDays}日起`,
        precision: BOUNDARY_PRECISION,
      },
      periodRule: spec.periodRule,
      hostMovement,
      guestMovement,
      hostGuestRelation: {
        kind: hostGuestRelationKind(hostMovement.element, guestMovement.element),
        basis: movementRelationBasis(hostMovement.element, guestMovement.element),
      },
      guestRole: i === 0 ? GUEST_ROLE.movementFirst : undefined,
      gregorianStart: jdnToYmd(startJdn),
      gregorianEnd: jdnToYmd(endJdn),
    };
  });
}

/**
 * 六步主客气：主气按厥阴→少阴→少阳→太阴→阳明→太阳常序；
 * 客气以司天落三之气、在泉落终之气，按六气升降之次前后排布（《运气要诀·客气司天在泉间气歌》）。
 *
 * @param {object} annual ③-a 产物
 * @param {Record<string, number>} jieQi ②段节气日
 * @returns {Array<object>} 六步（已含公历区间与主客关系）
 */
export function computeQiSteps(annual, jieQi) {
  return QI_STEPS.map((spec, i) => {
    const hostQi = LIU_QI[HOST_QI_ORDER[i]];
    const guestName = guestQiNameAtStep(annual.sitianName, i + 1);
    const guestQi = LIU_QI[LIU_QI.findIndex((q) => q.name === guestName)];
    const startJdn = jieQi[spec.boundaryTerm];
    const nextJdn = i === QI_STEPS.length - 1 ? jieQi['NEXT_大寒'] : jieQi[QI_STEPS[i + 1].boundaryTerm];

    return {
      order: i + 1,
      label: spec.label,
      solarTerms: [...spec.solarTerms],
      hostQi: { ...hostQi },
      guestQi: { ...guestQi },
      hostGuestRelation: {
        kind: hostGuestRelationKind(hostQi.element, guestQi.element),
        basis: qiRelationBasis(hostQi.element, guestQi.element),
      },
      guestRole: i === SITIAN_STEP - 1 ? GUEST_ROLE.sitian
        : i === ZAIQUAN_STEP - 1 ? GUEST_ROLE.zaiquan
          : undefined,
      gregorianStart: jdnToYmd(startJdn),
      gregorianEnd: jdnToYmd(nextJdn - 1),
    };
  });
}

/* ===========================================================================
 * ④ 输出装配
 * ========================================================================= */

/** 气运相临文案（自撰）。 */
function annualRelationBasis(kind, yunElement, sitianElement) {
  switch (kind) {
    case '同气': return `中运${yunElement}与司天${sitianElement}同气。`;
    case '天刑': return `司天${sitianElement}克中运${yunElement}，是谓天刑。`;
    case '顺化': return `司天${sitianElement}生中运${yunElement}，是谓顺化。`;
    case '小逆': return `中运${yunElement}生司天${sitianElement}，是谓小逆。`;
    default: return `中运${yunElement}克司天${sitianElement}，是谓不和。`;
  }
}

/** 符会五项逐条判定与依据（自撰文案，规则名取自 rules/wuyun.js 的 CONFORMITY_NAMES）。 */
function conformityFacts(annual) {
  const { yinYang, element, zhi, sitianElement, zaiquanElement } = annual;
  const zhiElem = ZHI_ELEMENT[zhi];
  const c = annual.conformities;
  const yes = (flag) => (flag ? '成立' : '不成立');
  const hit = (flag) => (flag ? '符合' : '不符合');
  return [
    {
      name: '天符',
      matched: c.tianfu,
      rule: '中运与司天同气。',
      basis: c.tianfu
        ? `中运${element}与司天${sitianElement}同气。`
        : `中运为${element}，司天为${sitianElement}，不同气。`,
    },
    {
      name: '岁会',
      matched: c.suihui,
      rule: '本运临本支本位：木临卯、火临午、金临酉、水临子，土临辰戌丑未。',
      basis: c.suihui
        ? `${zhi}支本位五行属${zhiElem}，中运亦为${element}，本运临本支之位。`
        : `${zhi}支本位五行属${zhiElem}，中运为${element}，未临本支之位。`,
    },
    {
      name: '太乙天符',
      matched: c.taiyiTianfu,
      rule: '同年兼具天符与岁会，天气、运气、岁支三者俱会。',
      basis: `天符${yes(c.tianfu)}，岁会${yes(c.suihui)}。`,
    },
    {
      name: '同天符',
      matched: c.tongTianfu,
      rule: '阳干之年，中运与在泉同气。',
      basis: `${yinYang}干年，中运为${element}，在泉为${zaiquanElement}，${hit(c.tongTianfu)}同天符。`,
    },
    {
      name: '同岁会',
      matched: c.tongSuihui,
      rule: '阴干之年，中运与在泉同气。',
      basis: `${yinYang}干年，中运为${element}，在泉为${zaiquanElement}，${hit(c.tongSuihui)}同岁会。`,
    },
  ];
}

/** 平气说明文案（自撰；判定见 rules/wuyun.js PING_QI_RULES）。 */
function pingQiBasisText(annual) {
  const { yearGanZhi, element, strength, zhi, relZhi, relSitian } = annual;
  if (!annual.isPingQi) {
    return `${yearGanZhi}年中运${strength}，年支${zhi}（${relZhi}）与司天（${relSitian}）未成抑助相济之势，不入平气格`;
  }
  const detail = strength === YUN_STRENGTH.yang
    ? `${YUN_TAI_GUO_NAME[element]}得平`
    : `${YUN_BU_JI_NAME[element]}得助`;
  return `${yearGanZhi}年中运${element}${strength}，年支${zhi}（${relZhi}）与司天（${relSitian}）抑助相济，`
    + `合「太过被抑、不及得助」，故入平气（${YUN_PING_QI_NAME[element]}之纪，${detail}）`;
}

/**
 * 按生产契约键序装配结果对象。
 * 禁止夹带内部字段（prompt / sources / calculationChain）——那些由下游另算（README §1 ④）。
 *
 * @param {{year:number}} input ①段产物
 * @param {object} calendar ②段产物
 * @param {object} annual ③-a 产物
 * @param {Array<object>} movementSteps ③-b 产物
 * @param {Array<object>} qiSteps ③-c 产物
 * @returns {object} 生产契约形状（与旧实现 stripInternal 之前的形状对齐，内部字段除外）
 */
export function assemble(input, calendar, annual, movementSteps, qiSteps) {
  const sitian = { ...LIU_QI[annual.sitianIdx] };
  const zaiquan = { ...LIU_QI[annual.zaiquanIdx] };
  const conformitiesWithAnnual = { ...annual, sitianElement: sitian.element, zaiquanElement: zaiquan.element };
  const names = CONFORMITY_NAMES.filter((name) => annual.conformities[CONFORMITY_FLAG_KEY[name]]);
  const patho = SITIAN_PATHOMECHANISM[sitian.name];
  const pingQiBasis = pingQiBasisText(annual);
  const pingQiType = annual.isPingQi
    ? PING_QI_TYPE.ping
    : (annual.strength === YUN_STRENGTH.yang ? PING_QI_TYPE.taiGuo : PING_QI_TYPE.buJi);

  const movementOut = movementSteps.map((step) => ({
    order: step.order,
    label: step.label,
    startBoundary: step.startBoundary,
    periodRule: step.periodRule,
    hostMovement: step.hostMovement,
    guestMovement: step.guestMovement,
    hostGuestRelation: step.hostGuestRelation,
    guestRole: step.guestRole,
    gregorianStart: step.gregorianStart,
    gregorianEnd: step.gregorianEnd,
  }));

  const qiOut = qiSteps.map((step) => ({
    order: step.order,
    label: step.label,
    solarTerms: step.solarTerms,
    hostQi: step.hostQi,
    guestQi: step.guestQi,
    hostGuestRelation: step.hostGuestRelation,
    guestRole: step.guestRole,
    gregorianStart: step.gregorianStart,
    gregorianEnd: step.gregorianEnd,
  }));

  return {
    input: {
      year: input.year,
      yearGanZhi: calendar.yearGanZhi,
      yearGanZhiSource: YEAR_GAN_ZHI_SOURCE,
    },
    annualMovement: {
      stem: annual.gan,
      element: annual.element,
      name: `${annual.element}运`,
      tone: annual.tone,
      toneStrength: annual.toneStrength,
      toneName: annual.toneName,
      yinYang: annual.yinYang,
      strength: annual.strength,
      basis: `${annual.gan}干化${annual.element}运，${annual.yinYang}干为${annual.strength}，五音取${annual.toneName}。`,
    },
    sitian,
    zaiquan,
    annualRelation: {
      kind: annual.relationKind,
      movementElement: annual.element,
      sitianElement: sitian.element,
      basis: annualRelationBasis(annual.relationKind, annual.element, sitian.element),
    },
    annualConformities: {
      names,
      tianfu: annual.conformities.tianfu,
      suihui: annual.conformities.suihui,
      taiyiTianfu: annual.conformities.taiyiTianfu,
      tongTianfu: annual.conformities.tongTianfu,
      tongSuihui: annual.conformities.tongSuihui,
      facts: conformityFacts(conformitiesWithAnnual),
      sourceReconciliation: { ...SOURCE_RECONCILIATION },
    },
    movementSteps: movementOut,
    qiSteps: qiOut,
    pathomechanism: {
      isPingQi: annual.isPingQi,
      pingQiType,
      pingQiBasis,
      affectedZangFu: patho.affectedZangFu,
      climaticPathology: patho.climaticPathology,
      treatmentGuideline: patho.treatmentGuideline,
      summary: `病机偏胜与平气：${calendar.yearGanZhi}年为${pingQiType}（${pingQiBasis}）；`
        + `${sitian.name}司天，${patho.affectedZangFu}；${patho.climaticPathology}；治则${patho.treatmentGuideline}。`,
    },
    limitations: [...LIMITATIONS],
  };
}

/* ===========================================================================
 * 生产契约入口
 * ========================================================================= */

/**
 * 五运六气排盘（生产契约入口，四段管线串起来）。
 *
 * @param {{year:number}} params 公历年（1900–2199 整数）
 * @returns {object} 与旧实现同形状的年度运气盘（内部字段 prompt/sources/calculationChain 除外）
 * @throws {PaipanInputError} 缺 year / 非整数 / 越界
 */
export function calculateWuyunLiuqiCore(params) {
  const input = normalizeInput(params);
  const calendar = resolveCalendar(input);
  const annual = computeAnnual(calendar);
  const movementSteps = computeMovementSteps(annual, calendar.jieQi);
  const qiSteps = computeQiSteps(annual, calendar.jieQi);
  return assemble(input, calendar, annual, movementSteps, qiSteps);
}

/**
 * 年干支纯函数（旧实现另有同名导出 `getWuyunLiuqiYearGanZhi`；本内核按同一口径提供）。
 *
 * @param {number} year 公历年
 * @returns {string} 两字干支
 * @throws {PaipanInputError} 非整数年
 */
export function getWuyunLiuqiYearGanZhiCore(year) {
  if (typeof year !== 'number' || !Number.isInteger(year)) {
    throw new PaipanInputError('invalid_year', `公历年必须是整数: ${String(year)}`);
  }
  return ganZhiOfYear(year);
}
