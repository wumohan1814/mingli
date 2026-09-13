/**
 * 命理 · 自研排盘内核 · 能力：生肖流年（zodiac）
 * ---------------------------------------------------------------------------
 * 导出两个函数（父节 server.mjs 两个都要用）：
 *   - `calculateZodiacYearFortuneCore({ zodiac, year })` —— 与旧实现 `calculateZodiacYearFortune`
 *     同签名、同输出形状（stripInternal 之后的生产契约形状）。
 *   - `getYearTaiSuiCore(ganZhi)` —— 与旧实现 `getYearTaiSui` 同形状 `{ yearBranch, star }`。
 *
 * 四段纯函数管线（README §1）：
 *   ① 输入归一化 normalizeInput —— 只认 12 生肖 + 1900–2200 整数年；缺/非法一律抛错
 *   ② 历法/起局  resolveYear —— 年→六十甲子（**不按立春**，对拍实测口径）→ 年干/年支
 *   ③ 格局判定    resolveRelations —— 纯查表 + 纯生克：太岁五关系 / 三合六合三会 / 年干五行
 *   ④ 输出装配    assemble
 * 四段之间只传普通对象；**禁止** IO / LLM / 网络 / 随机数 / 读时钟。
 *
 * == 对拍实测确认的口径（黑盒探针，禁止读旧实现源码；规则表见 rules/zodiac.js）==
 *   1. `yearGanZhi` 由 year 直接推六十甲子，**不看立春**（1900→庚子、2026→丙午）；
 *      year 非 1900–2200 整数时旧实现抛「year 必须是 1900-2200 之间的整数。」。
 *   2. `relation` / `elementRelation` 的口径见 rules/zodiac.js 的 elementRelation()。
 *   3. `conflicts` 固定顺序 值 → 冲 → 刑 → 害 → 破；`with` = 流年支。
 *   4. `noble`：六合命中→「六合贵人」；三合命中→「三合贵人（X局）」；否则回落该生肖固定串。
 *   5. `meeting`：同三会方且非同一支 →「三会关系（方位五行）」；否则 null。
 *   6. `nobleDetail.天乙贵人.partners` 随**流年年干**变（天乙贵人口诀），次序照口诀书写次序。
 *   7. `zodiacWuxing` 为盘面展示文案（土支带藏干：土（丑，己土））。
 *
 * == 与旧实现的有意分歧（信息性，不进关键字段）==
 *   - 所有**现代白话**（relationCopy / conflict.desc / favorableRelations / riskRelations /
 *     actionSignals / nobleDetail 的 explain 与天乙贵人 note / evidenceGrade / interpretationBoundary）
 *     按母节 §3.6 铁则**自行撰写**，不复制旧实现文案，故与旧实现文本不同（对拍报告里逐条列出）。
 *   - 结构化盘面字段（干支/关系/太岁/支类）与旧实现 100% 一致。
 */

import {
  ZODIAC_RULES,
  ZODIAC_ELEMENT_ACTION,
  ZODIAC_ACTION_SIGNALS,
  TAI_SUI_CONFLICT_COPY,
  TAI_SUI_CONFLICT_ORDER,
  baselineRelations,
  branchWuxing,
  branchZodiac,
  elementRelation,
  isLiuChong,
  isLiuHai,
  isLiuHe,
  isLiuPo,
  isSanHe,
  liuHePartner,
  nobleNotes,
  sanHeGroup,
  sanHuiGroup,
  sanXingName,
  taiSuiName,
  tianYiPartners,
  yearGanZhi,
  yearTaiSui,
  zodiacEntry,
} from '../../rules/zodiac.js';

/** meta 兼容字段：本内核无 meta 段（旧实现 zodiac 输出亦无 meta），此处仅留版本常量供调用方引用。 */
export const ENGINE_VERSION = '0.1.0-mingli';

/** 生产契约版本（与旧实现一致；换形状才允许 +1）。 */
export const SCHEMA_VERSION = '1.0.0';

/** 内核输入错误（缺输入 / 输入形态不支持 / 越界）。调用方据此返回 400。 */
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

/** 本内核自撰的边界说明（不复制旧实现文案）。 */
const EVIDENCE_GRADE = '简版关系核验';
const INTERPRETATION_BOUNDARY = '仅覆盖生肖年支与流年干支的固定关系';

/**
 * 年干五行 vs 生肖本气的**自撰**白话（按关系分类分四句，语义与传统生克一致）。
 */
const RELATION_COPY = Object.freeze({
  有利关系: '流年年干的五行生扶你的生肖本气，整体气场偏顺，适合把已铺好的事情往前推一步。',
  风险关系: '你与流年之间是「我生」或「被克」的关系，力气容易被分散，宜先守住节奏再谈扩张。',
  中性关系: '你与流年五行属于同类或我克的关系，主动权多在自己手上，但也要留意用力过猛带来的消耗。',
});

/** 生肖流年六合/三合贵人命中时的贵人白话（自撰）。 */
const NOBLE_HIT_COPY = Object.freeze({
  六合: '流年地支与你的生肖六合，人际与合作的机会相对集中，遇到合拍的人可以多谈一步。',
  三合: '流年地支与你的生肖三合，同类力量聚拢，适合借团队或伙伴之力把事情做大。',
});

/* ============================ ① 输入归一化 ============================ */

/**
 * ① 输入归一化：接受且仅接受 `{ zodiac, year }`。
 * zodiac 必须是 12 生肖之一（不做 trim 猜测）；year 必须是 1900–2200 整数（对拍实测同日）。
 *
 * @param {object|undefined|null} params 调用参数
 * @returns {{zodiac: string, branch: string, year: number, yearGanZhiText: string}}
 */
export function normalizeInput(params) {
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    throw new PaipanInputError('missing_zodiac', '生肖流年必须传 { zodiac, year }；缺输入不猜、不回落。');
  }
  const { zodiac, year } = params;
  if (typeof zodiac !== 'string' || zodiac === '') {
    throw new PaipanInputError('missing_zodiac', '生肖流年必须传 zodiac（12 生肖之一）。');
  }
  let entry;
  try {
    entry = zodiacEntry(zodiac);
  } catch (err) {
    throw new PaipanInputError('unknown_zodiac', `未收录的生肖：${zodiac}（应为 12 生肖之一）。`);
  }
  if (!Number.isInteger(year) || year < ZODIAC_RULES.yearRange.min || year > ZODIAC_RULES.yearRange.max) {
    throw new PaipanInputError(
      'year_out_of_range',
      `year 必须是 ${ZODIAC_RULES.yearRange.min}-${ZODIAC_RULES.yearRange.max} 之间的整数（对拍实测旧实现口径一致）。`,
    );
  }
  return { zodiac: entry.zodiac, branch: entry.branch, year, yearGanZhiText: yearGanZhi(year) };
}

/* ============================ ② 历法/起局 ============================ */

/**
 * ② 年 → 流年干支 / 年干 / 年支 / 太岁星君（不按立春，见文件头 1）。
 *
 * @param {{yearGanZhiText: string}} normalized ①的输出
 * @returns {{yearGanZhi: string, yearGan: string, yearBranch: string, taiSuiStar: string}}
 */
export function resolveYear(normalized) {
  const text = normalized.yearGanZhiText;
  return {
    yearGanZhi: text,
    yearGan: text.slice(0, 1),
    yearBranch: text.slice(1),
    taiSuiStar: taiSuiName(text),
  };
}

/* ============================ ③ 格局判定 ============================ */

/**
 * ③ 地支关系与五行关系判定（纯查表 + 纯生克，规则全部取自 rules/zodiac.js）。
 *
 * @param {{branch: string}} normalized ①的输出
 * @param {{yearGan: string, yearBranch: string}} year ②的输出
 * @returns {{conflictTypes: string[], nobleHit: ('六合'|'三合'|null), meetingGroup: object|null,
 *   element: object, sanHe: object, liuHeBranch: string, tianYi: object|null}}
 */
export function resolveRelations(normalized, year) {
  const { branch } = normalized;
  const { yearBranch, yearGan } = year;

  const conflictTypes = [];
  if (branch === yearBranch) conflictTypes.push('值太岁');
  if (isLiuChong(branch, yearBranch)) conflictTypes.push('冲太岁');
  if (sanXingName(branch, yearBranch) !== null) conflictTypes.push('刑太岁');
  if (isLiuHai(branch, yearBranch)) conflictTypes.push('害太岁');
  if (isLiuPo(branch, yearBranch)) conflictTypes.push('破太岁');
  // 固定顺序（对拍实测 值→冲→刑→害→破）
  conflictTypes.sort((a, b) => TAI_SUI_CONFLICT_ORDER.indexOf(a) - TAI_SUI_CONFLICT_ORDER.indexOf(b));

  const nobleHit = isLiuHe(branch, yearBranch) ? '六合' : (isSanHe(branch, yearBranch) ? '三合' : null);
  const hui = sanHuiGroup(branch);
  const meetingGroup = (hui && yearBranch !== branch && hui.branches.includes(yearBranch)) ? hui : null;

  const zodiacWuxing = branchWuxing(branch);
  const yearStemWuxing = (function resolve() {
    const map = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
    return map[yearGan];
  })();

  return {
    conflictTypes,
    nobleHit,
    meetingGroup,
    element: elementRelation(yearStemWuxing, zodiacWuxing),
    sanHe: sanHeGroup(branch),
    liuHeBranch: liuHePartner(branch),
    tianYi: tianYiPartners(yearGan),
    yearStemWuxing,
    zodiacWuxing,
  };
}

/* ============================ ④ 输出装配 ============================ */

/**
 * ④ 输出装配（键序与旧实现 stripInternal 后逐键对齐；**不**输出 evidenceAnalysis / prompt 等内部字段）。
 *
 * @param {{normalized: object, year: object, relations: object}} parts
 * @returns {object} 生产契约形状
 */
export function assemble({ normalized, year, relations }) {
  const { zodiac, branch } = normalized;
  const { yearGanZhi: gz, yearBranch } = year;
  const {
    conflictTypes, nobleHit, meetingGroup, element, sanHe, liuHeBranch, tianYi, yearStemWuxing, zodiacWuxing,
  } = relations;

  const conflicts = conflictTypes.map((type) => ({
    type,
    with: yearBranch,
    desc: TAI_SUI_CONFLICT_COPY[type],
  }));

  // noble：六合 > 三合 > 该生肖固定串（对拍实测口径 4）
  let noble;
  if (nobleHit === '六合') noble = '六合贵人';
  else if (nobleHit === '三合') noble = `三合贵人（${sanHe.name}）`;
  else noble = `三合：${sanHe.partners.map((b) => branchZodiac(b)).join('、')}；六合：${branchZodiac(liuHeBranch)}`;

  const meeting = meetingGroup ? `三会关系（${meetingGroup.name}）` : null;

  // 助手（自撰白话）：贵人说明
  // 对拍实测（探针 17）：nobleDetail 只有在**流年支真的命中**六合/三合时才带该条，
  // 未命中时只留「天乙贵人」一条（不放该生肖自身的三合/六合说明）。
  const notes = nobleNotes(zodiac);
  const nobleDetail = {};
  if (nobleHit === '六合') {
    nobleDetail.六合 = { partner: branchZodiac(liuHeBranch), explain: notes.liuhe.explain };
  } else if (nobleHit === '三合') {
    nobleDetail.三合 = { partners: notes.sanhe.partners.join('、'), explain: notes.sanhe.explain };
  }
  nobleDetail.天乙贵人 = {
    note: '天乙贵人由流年年干决定（口诀「甲戊庚牛羊、乙己鼠猴乡、丙丁猪鸡位、壬癸兔蛇藏、六辛逢马虎」），并不固定在某个属相之下。',
    partners: tianYi ? tianYi.animals.join('、') : '',
  };

  // 有利 / 风险关系（自撰结构：结构化标签 + 命中贵人/冲太岁的现实提示）
  const favorableRelations = [];
  if (element.classification === '有利关系') favorableRelations.push(element.label);
  if (nobleHit === '六合' || nobleHit === '三合') {
    favorableRelations.push(nobleHit === '六合' ? '六合贵人' : `三合贵人（${sanHe.name}）`);
  }

  const riskRelations = [];
  if (conflicts.length) {
    for (const c of conflicts) riskRelations.push(`${c.type}：${c.desc}`);
  } else {
    for (const r of baselineRelations(zodiac)) riskRelations.push(r);
  }
  if (element.classification === '风险关系') riskRelations.push(element.label);

  // 行动信号（自撰：命中太岁关系与贵人各给一条；都没命中则按生肖本气给一条稳妥取向）
  const actionSignals = [];
  for (const type of conflictTypes) {
    const signal = ZODIAC_ACTION_SIGNALS[type];
    if (signal && !actionSignals.includes(signal)) actionSignals.push(signal);
  }
  if (nobleHit && !actionSignals.includes(ZODIAC_ACTION_SIGNALS.六合三合)) actionSignals.push(ZODIAC_ACTION_SIGNALS.六合三合);
  if (!actionSignals.length) actionSignals.push(ZODIAC_ELEMENT_ACTION[zodiacWuxing]);

  const relationCopy = `${RELATION_COPY[element.classification]}${nobleHit ? ` ${NOBLE_HIT_COPY[nobleHit]}` : ''}`;

  return {
    zodiacBranch: branch,
    zodiac,
    yearGanZhi: gz,
    yearBranch,
    relation: element.label,
    elementRelation: {
      kind: element.kind,
      label: element.label,
      classification: element.classification,
      yearStemWuxing,
      zodiacWuxing,
    },
    noble,
    meeting,
    conflicts,
    evidenceGrade: EVIDENCE_GRADE,
    interpretationBoundary: INTERPRETATION_BOUNDARY,
    favorableRelations,
    riskRelations,
    actionSignals,
    nobleDetail,
    relationCopy,
    zodiacWuxing: zodiacEntry(zodiac).wuxingDisplay,
  };
}

/* ============================ 对外能力 ============================ */

/**
 * 生肖流年简析（自研内核）。
 *
 * @param {{zodiac: string, year: number}} params `{ zodiac: '鼠', year: 2026 }`
 * @returns {object} 生产契约形状的流年关系结果
 * @throws {PaipanInputError} 缺 zodiac / 非法生肖 / year 越界
 */
export function calculateZodiacYearFortuneCore(params) {
  const normalized = normalizeInput(params);              // ① 输入归一化
  const year = resolveYear(normalized);                   // ② 历法/起局
  const relations = resolveRelations(normalized, year);   // ③ 格局判定
  return assemble({ normalized, year, relations });       // ④ 输出装配
}

/**
 * 值年太岁星君（自研内核）：六十甲子 → `{ yearBranch, star }`，与旧实现 getYearTaiSui 同形状。
 *
 * @param {string} ganZhi 年干支，如「丙午」
 * @returns {{yearBranch: string, star: string}}
 * @throws {PaipanInputError} 干支非法
 */
export function getYearTaiSuiCore(ganZhi) {
  if (typeof ganZhi !== 'string' || ganZhi.length !== 2) {
    throw new PaipanInputError('invalid_ganzhi', `年干支必须是两字（如「丙午」）：${ganZhi}`);
  }
  try {
    return yearTaiSui(ganZhi);
  } catch (err) {
    throw new PaipanInputError('invalid_ganzhi', `年干支无法解析：${ganZhi}`);
  }
}

export default calculateZodiacYearFortuneCore;
