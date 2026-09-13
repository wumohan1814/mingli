#!/usr/bin/env node
/* 命理自研 — 排盘引擎常驻 HTTP 服务。
 *
 * 目的：把 ziwei.cjs / extra.mjs 原先「每次 subprocess 调用即启动、用完即退」的
 * 排盘过程收敛为单进程常驻服务。进程启动时一次性加载 iztro + mingyu-core（含
 * vendor 0.2.2 奇门），之后所有请求复用已加载的库，避免每次调用重新加载造成的
 * 内存峰值与冷启动开销。
 *
 * 端点契约（body 为 UTF-8 JSON）：
 *   POST /ziwei  {"birthday":"1990-05-12","time_idx":7,"gender":"男"}
 *     → 200 application/json，12 宫 JSON，输出结构与 ziwei.cjs 逐字一致：
 *       {soul, body, soul_palace, body_palace, five_elements_class,
 *        lunar_date, time_range, sihua:[{star,mutagen,palace}],
 *        palaces:[{index,name,heavenly_stem,earthly_branch,major_stars,
 *                  minor_stars,adjective_stars,sihua,is_body_palace}]}
 *   POST /extra   {year,month,day,hour,minute,gender,name,birthplace,
 *                  longitude,latitude,true_solar}
 *     → 200 application/json，输出结构与 extra.mjs 逐字一致（已 stripInternal）：
 *       {western, qizheng, wuyun_liuqi:{birth_year,current_year}, qimen_lifetime}
 *   POST /zodiac  {zodiac:"鼠", year:2026}
 *     → 200 application/json，生肖流年运程（已 stripInternal）：
 *       {zodiac, zodiacBranch, yearGanZhi, yearBranch, taiSui:{yearBranch, star},
 *        relation, elementRelation, zodiacWuxing, noble, tianyiNoble?, meeting,
 *        conflicts, evidenceGrade, interpretationBoundary, favorableRelations,
 *        riskRelations, actionSignals}
 *       zodiacWuxing 为 B2 本气五行展示文案（如“水（子）”）；贵人三层兜底：
 *       流年命中六合/三合 > B2 贵人（引擎 zodiac/index.js 回填）> tianyiNoble（此处）。
 *       输入 zodiac 缺失/非法 → 400（客户端错误）。
 *   POST /divination  {method:"liuyao"|"meihua"|"xiaoliuren"|"liuren"|"jinkoujue"|"qimen"|"almanac"|"taiyi"|"huangji"|"ssgw"|"lenormand",
 *                      customDate?:"ISO 字符串", spreadType?:"字符串", options?:{},
 *                      settings?:{}, params?:{}}
 *     → 200 application/json，确定性起卦结果（六爻卦盘/梅花卦盘/小六壬课式/大六壬课盘/
 *       金口诀课盘/灵签签文/雷诺曼牌阵，已 stripInternal）。method 决定取参位置：
 *       - liuyao      → generateLiuyao(customDate, options)（options 可带手工爻值等）
 *       - meihua      → generateMeihua(customDate, settings)（settings 即报数等）
 *       - xiaoliuren  → generateXiaoliuren(params)（params.customDate 亦接受字符串）
 *       - liuren      → generateLiuren(customDate)（大六壬时辰起课：月将加时起天地盘，
 *                      四课三传/课体/类神/天将/神煞/应期；确定性零 LLM）
 *       - jinkoujue   → generateJinkoujue(params)（金口诀起课：四位一体人元/贵神/将神/地分
 *                      + 阴阳发用 + 五动三动；params.method 四选一 time 时间 / branch 指定地分 /
 *                      number 数字 / random 随机，branch 传 params.branch、number 传 params.number、
 *                      random 无 seed/replay 时引擎以系统安全随机数取地分；确定性零 LLM）
 *       - qimen       → generateQimen(customDate, qimenMethod, scope, qimenJuMethod)
 *                      （奇门时家一事一占，REQ-120：scope 四选一 hour 时家（默认）/ day 日家 /
 *                      month 月家 / year 年家；qimenMethod 二选一 zhuanpan 转盘（默认）/ feipan 飞盘；
 *                      qimenJuMethod 二选一 chaibu 拆补（默认）/ zhirun 置闰，仅时家/日家生效；
 *                      九宫四盘（九星/八门/八神/天地盘干）+ 格局 + 反证 + 应期 + 方位；确定性零 LLM）
 *       - almanac     → generateAlmanacSelection(input.almanac)（黄历择日，REQ-121，免档案：
 *                      事项 topic 10 选 1 + startDate/endDate 起止（最多 180 天）+ 可选 participants
 *                      （完整生辰，最多 30 位）；逐日 宜忌/冲煞/建除十二值/二十八宿/九星/彭祖百忌/
 *                      方位神/逐时时课 + evidenceAnalysis 候选分组（可用/条件/慎用，压缩为
 *                      candidateGroups 投影）；确定性零 LLM。月相背景已剔除控体积）
 *       - taiyi       → generateTaiyi(input.taiyi)（太乙神数，REQ-124，纯国学大势工具，
 *                      免档案：年/月/日/时四计七十二局基础盘；scope 四选一 year 年家（默认，
 *                      须传 year 公历年份 1-9999 整数）/ month 月家 / day 日家 / hour 时家
 *                      （后三者须传 customDate 东八区 ISO）；输出 阴阳遁局数/太乙/文昌/始击/
 *                      计神/主客定算/十六神 + evidenceChain 证据链投影（计算链/方法论/限制/
 *                      主要事实，原始 evidenceAnalysis 体积大已剥离）；确定性零 LLM）
 *       - huangji     → calculateHuangjiJingshi(input.huangji)（皇极经世，REQ-125，纯国学
 *                      大势工具，免档案：元会运世周期 + 值年/月经/旬纬/日卦/时经卦；mode 二选一
 *                      year 值年（元会运世+值年卦+统卦/运卦/十年卦，传 year 公元整数年份，
 *                      无公元 0 年、不早于公元前 67017 年）/ datetime 年月日时（值年/月经/旬纬/
 *                      日卦/时经卦五层，传 customDate 东八区 ISO）；输出 position/forecast/
 *                      eraTrend/dateTimeForecast + evidenceChain 证据链投影；确定性零 LLM）
 *       - ssgw        → drawRandomSign(options)（随机抽签）
 *       - lenormand   → drawLenormandSpread(spreadType||'single', options)
 *                      （雷诺曼 spreadType 由 input.spreadType 提供，非 settings；
 *                       options 可带 seed/replay 确定性重放）
 *       输入缺 method / method 非法 / spreadType 非法 / customDate 无效 → 400（客户端错误）。
 *   POST /tarot  {spreadType?:"single"|"three"|"love"|"career"|"decision"|...,
 *                 options?:{}}
 *     → 200 application/json，确定性塔罗抽牌（单牌/时间流/爱情/事业/选择等牌阵，
 *       已 stripInternal）：drawTarotSpread(spreadType||'single', options)。
 *       options 原样透传：seed/replay 确定性重放、interactiveSamples 逐张样本、
 *       question 占问方向等。spreadType 缺失 → 'single'；非法 → 400（客户端错误）。
 *   POST /astrology  {year, month?, day?, hour?, minute?, gender?, birthplace?,
 *                     longitude?, latitude?, true_solar?, scope?, dateStr?}
 *     → 200 application/json，确定性西洋星座盘（已 stripInternal）：
 *       - scope 缺省 'natal'：仅返回 {natal}（本命盘，行星/四轴/宫位/相位/庙旺陷落/元素）
 *       - scope != 'natal'：返回 {natal, fullScope}，fullScope =
 *         buildAstrolabeFullScopeContexts(natal, dateStr)（natal+yearly+monthly+daily
 *         全范围上下文，含行运/太阳返照/次限/太阳弧）；dateStr 需 YYYY-MM-DD，
 *         缺省取当天。
 *       出生信息 year 必填；month/day/hour/minute 缺省 1/1/0/0，gender 缺省 male，
 *       longitude/latitude 缺省 null —— 但 generateAstrolabe 必需经纬度推算上升/宫位，
 *       缺失/非法经纬度 → 400（客户端错误）；年份/日期越界由引擎抛错 → 500。
 *
 * 出错返回非 200（JSON {"error": ...}），并把错误打到 stderr，供调用方降级。
 * 监听 127.0.0.1，端口取环境变量 PAIPAN_NODE_PORT，默认 9317。
 *
 * ziwei.cjs / extra.mjs 原样保留，作为 subprocess 降级路径。
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { randomInt } from 'node:crypto';

// ---------------------------------------------------------------------------
// 一次性加载（进程常驻，以下库加载一次后为所有请求复用）
// ---------------------------------------------------------------------------

// iztro 是 CJS 包（无 type:module），用 createRequire 以 CommonJS 语义加载。
const require = createRequire(import.meta.url);

function loadAstro() {
  // 与 ziwei.cjs 相同的解析顺序：先脚本目录下 node_modules，再裸模块名
  try {
    return require('./node_modules/iztro').astro;
  } catch (e) {
    /* fallthrough */
  }
  try {
    return require('iztro').astro;
  } catch (e2) {
    console.error('Missing dependency: iztro. Expected under paipan-node/node_modules.');
    throw e2;
  }
}

const astro = loadAstro(); // { bySolar, ... } —— 紫微排盘入口

// mingyu-core 是 ESM 包（type:module），直接 ESM import。
// 占星/七政/五运六气走 npm mingyu-core@0.2.1；
// 奇门终身局走本地 vendor 0.2.2 构建产物（calculateQimenLifetime，npm 0.2.1 无此函数）。
import { calculateBirthChartBundle } from 'mingyu-core';
import { calculateQimenLifetime } from './vendor/mingyu-core/dist/divination/algorithms/qimen/index.js';
import { generateLiuren } from './vendor/mingyu-core/dist/divination/algorithms/liuren/index.js';
import { generateJinkoujue } from './vendor/mingyu-core/dist/divination/algorithms/jinkoujue.js';
import { generateQimen } from './vendor/mingyu-core/dist/divination/algorithms/qimen/index.js';
import { generateAstrolabe } from './vendor/mingyu-core/dist/divination/algorithms/astrolabe.js';
import { buildAstrolabeFullScopeContexts, buildAstrolabeScopeContext } from './vendor/mingyu-core/dist/divination/astrolabe-scope.js';
import { generateTaiyi } from './vendor/mingyu-core/dist/taiyi/index.js';
import { calculateHuangjiJingshi } from './vendor/mingyu-core/dist/huangji-jingshi/index.js';

// 节155：六爻 / 梅花 / 小六壬已整体切换到自研内核（paipan-core）。
//   起卦/装卦/断卦要素与课式全部自研（对拍门禁 100% 通过，见 paipan-core/tools/compare）；
//   vendor 的 generateLiuyao / generateMeihua / generateXiaoliuren 已下线。
import { generateLiuyaoCore } from './paipan-core/src/capabilities/liuyao/index.js';
import { generateMeihuaCore } from './paipan-core/src/capabilities/meihua/index.js';
import { generateXiaoliurenCore } from './paipan-core/src/capabilities/xiaoliuren/index.js';

// 节152：五运六气已切换到自研内核（对拍 20916/20916 含 60 甲子全覆盖 + 1900–2199
//   300 年全量核对零不一致）；vendor 的 calculateWuyunLiuqi 已下线。
import { calculateWuyunLiuqiCore } from './paipan-core/src/capabilities/wuyun/index.js';

// 节156：观音灵签 / 黄历择日 / 生肖流年已切换到自研内核（对拍 ssgw 238/238、
//   almanac 2882/2882、zodiac 3672/3672 全 100%）；vendor 的 drawRandomSign /
//   generateAlmanacSelection / calculateZodiacYearFortune / getYearTaiSui 已下线。
import { drawRandomSignCore } from './paipan-core/src/capabilities/ssgw/index.js';
import { generateAlmanacSelectionCore } from './paipan-core/src/capabilities/almanac/index.js';
import { calculateZodiacYearFortuneCore, getYearTaiSuiCore } from './paipan-core/src/capabilities/zodiac/index.js';

// 节157：塔罗 / 雷诺曼已整体切换到自研内核（paipan-core）。
//   牌阵表 = 内核 rules 的 TAROT_SPREADS / LENORMAND_SPREADS（唯一来源，含命理覆盖层
//   产品口径：凯尔特十字/七张马蹄/六芒星/四牌四季）；抽牌 = drawTarotSpreadCore /
//   drawLenormandSpreadCore（种子化随机，同 seed 可复现；缺 seed 由 ensureSeed 注入）。
//   mingli-tarot-spreads.mjs 的 monkey-patch 覆盖机制随之退役（内核牌阵已是唯一来源）。
import { drawTarotSpreadCore } from './paipan-core/src/capabilities/tarot/index.js';
import { TAROT_SPREADS } from './paipan-core/src/rules/tarot.js';
import { drawLenormandSpreadCore } from './paipan-core/src/capabilities/lenormand/index.js';
import { LENORMAND_SPREADS } from './paipan-core/src/rules/lenormand.js';

// ---------------------------------------------------------------------------
// 排盘逻辑 —— 从 ziwei.cjs / extra.mjs 原样内联（不改动那两个文件）
// ---------------------------------------------------------------------------

// （节157：REQ-122 的 mingli-tarot-spreads 覆盖层已退役——内核牌阵表 TAROT_SPREADS
//   即为唯一来源，含四牌四季/凯尔特十字/七张马蹄/六芒星产品口径，见上方 import 注释）

/* ---------- /ziwei：紫微排盘（对齐 ziwei.cjs 的 main()） ---------- */

const starName = (s) => (s && s.name ? s.name : String(s || ''));

function computeZiwei(input) {
  // 与 ziwei.cjs 相同的必填校验（缺字段时原脚本 stderr + exit 2）
  for (const k of ['birthday', 'time_idx', 'gender']) {
    if (input[k] === undefined || input[k] === null || input[k] === '') {
      throw Object.assign(new Error(`Missing required input field: ${k}`), { clientError: true });
    }
  }

  const astrolabe = astro.bySolar(input.birthday, input.time_idx, input.gender, true, 'zh-CN');
  const rawPalaces = astrolabe.palaces || [];
  const sihua = [];

  const palaces = rawPalaces.map((p) => {
    const major = (p.majorStars || []).map(starName);
    const minor = (p.minorStars || []).map(starName);
    const adj = (p.adjectiveStars || []).map(starName);
    const stars = [...(p.majorStars || []), ...(p.minorStars || []), ...(p.adjectiveStars || [])];
    const mutagens = stars.filter((s) => s && s.mutagen).map((s) => ({
      star: starName(s), mutagen: s.mutagen, palace: p.name,
    }));
    sihua.push(...mutagens);
    return {
      index: p.index,
      name: p.name,
      heavenly_stem: p.heavenlyStem || '',
      earthly_branch: p.earthlyBranch || '',
      major_stars: major,
      minor_stars: minor,
      adjective_stars: adj,
      sihua: mutagens.map((m) => `${m.star}${m.mutagen}`),
      is_body_palace: Boolean(p.isBodyPalace),
    };
  });

  return {
    soul: astrolabe.soul || '',
    body: astrolabe.body || '',
    soul_palace: astrolabe.earthlyBranchOfSoulPalace || '',
    body_palace: astrolabe.earthlyBranchOfBodyPalace || '',
    five_elements_class: astrolabe.fiveElementsClass || '',
    lunar_date: astrolabe.lunarDate || '',
    time_range: astrolabe.timeRange || '',
    sihua,
    palaces,
  };
}

/* ---------- /extra：占星/七政/五运六气/奇门（对齐 extra.mjs 的 main()） ---------- */

function stripInternal(obj) {
  // 去掉引擎内部字段，保留可解释的盘面事实，控制 chart.json 体积
  if (Array.isArray(obj)) return obj.map(stripInternal);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (['evidenceAnalysis', 'calculationContext', 'positionSources', 'prompt',
           'calculationChain', 'sources', 'timestamp'].includes(k)) continue;
      out[k] = stripInternal(v);
    }
    return out;
  }
  return obj;
}

async function computeExtra(input) {
  // 与 extra.mjs 相同的宽松处理：gender 非 female 一律 male，缺字段交给各子算法容错
  const gender = input.gender === 'female' ? 'female' : 'male';
  const profile = {
    name: input.name || '',
    gender,
    calendarType: 'solar',
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    location: {
      name: input.birthplace || '',
      longitude: input.longitude,
      latitude: input.latitude,
      timezone: 8,
    },
    useTrueSolarTime: Boolean(input.true_solar),
  };

  let western = null;
  let qizheng = null;
  try {
    const bundle = await calculateBirthChartBundle(profile, { systems: ['astrolabe', 'qizheng'] });
    western = bundle.astrolabe ? stripInternal(bundle.astrolabe) : null;
    qizheng = bundle.qizheng ? stripInternal(bundle.qizheng) : null;
  } catch (e) {
    console.error(`[paipan_extra] astrolabe/qizheng 失败: ${e && e.message ? e.message : e}`);
  }

  const currentYear = new Date().getFullYear();
  let wuyun = null;
  try {
    // 节152：自研内核（对拍 100% 后切换；vendor calculateWuyunLiuqi 已下线）
    const birth = calculateWuyunLiuqiCore({ year: input.year });
    const current = calculateWuyunLiuqiCore({ year: currentYear });
    wuyun = {
      birth_year: stripInternal(birth),
      current_year: stripInternal(current),
    };
  } catch (e) {
    console.error(`[paipan_extra] wuyun-liuqi 失败: ${e && e.message ? e.message : e}`);
  }

  let qimen = null;
  try {
    const birthIso = `${input.year}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}T${String(input.hour).padStart(2, '0')}:${String(input.minute || 0).padStart(2, '0')}:00`;
    const qi = calculateQimenLifetime({
      birthDateTime: birthIso,
      timeZoneId: 'Asia/Shanghai',
      location: {
        longitude: input.longitude,
        latitude: input.latitude,
        locationName: input.birthplace || '',
      },
      calendarType: 'solar',
      timeStandard: input.true_solar ? 'trueSolar' : 'civil',
      method: 'zhuanpan',
      juMethod: 'chaibu',
    });
    qimen = stripInternal(qi);
  } catch (e) {
    console.error(`[paipan_extra] qimen-lifetime 失败: ${e && e.message ? e.message : e}`);
  }

  return {
    western,
    qizheng,
    wuyun_liuqi: wuyun,
    qimen_lifetime: qimen,
  };
}

/* ---------- /zodiac：生肖流年（本地 vendor 的 mingyu-core zodiac） ---------- */

// 地支 → 生肖固定映射（天乙贵人展示用；顺序与引擎 ZODIACS 一致）
const BRANCH_TO_ZODIAC = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇',
  午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};
// 天乙贵人：流年年干 → 贵人所落地支（固定硬编码数据，纯确定性、零 LLM）
const TIANYI_NOBLE_BRANCHES = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['寅', '午'],
};

function getTianyiNoble(yearGan) {
  // 流年年干（如 "丙"）→ "天乙贵人：猪、鸡"；无法识别时返回空串，由调用方兜底
  const branches = TIANYI_NOBLE_BRANCHES[yearGan];
  if (!branches || !branches.length) return '';
  return `天乙贵人：${branches.map((b) => BRANCH_TO_ZODIAC[b] || b).join('、')}`;
}

function computeZodiac(input) {
  // 必填校验：input 非对象 / zodiac 缺失或非字符串 → 客户端错误（对齐 /ziwei 校验风格）
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.zodiac !== 'string' || !input.zodiac.trim()) {
    throw Object.assign(new Error('Missing required input field: zodiac'), { clientError: true });
  }
  // 纯确定性计算：{zodiac:"鼠", year:2026} → 流年干支/太岁/冲刑害破/贵人/行动信号。
  // 节156：自研内核（对拍 3672/3672）；evidenceAnalysis 属内部字段，stripInternal 不外泄。
  const raw = calculateZodiacYearFortuneCore({ zodiac: input.zodiac, year: input.year });
  const result = stripInternal(raw);
  // 值年太岁星君名（节156 内核自带 getYearTaiSuiCore，60 太岁表公网采源），
  // 并入响应供前端「值年星君」卡展示。
  if (raw.yearGanZhi) {
    result.taiSui = getYearTaiSuiCore(raw.yearGanZhi);  // {yearBranch, star}
  }
  // BUG-003：贵人字段三层保障，保证最终输出「贵人」内容永远非空：
  //   ① 引擎 noble = 流年命中六合/三合贵人（非空即优先）；
  //   ② 引擎 noble 为空时，由 zodiac/index.js 以 B2 该生肖「贵人」确定性文案回填
  //      （ZODIAC_ANNUAL_COPY，覆盖全部 12 生肖，因此正常不会走到本分支）；
  //   ③ 仍为空（仅当 B2 数据缺失等异常时）→ 此处按流年年干补 tianyiNoble
  //      （天乙贵人，按固定映射查表）作为最后兜底。
  if (!result.noble) {
    const yearGanZhi = raw.yearGanZhi || result.yearGanZhi;
    if (typeof yearGanZhi === 'string' && yearGanZhi.length > 0) {
      const tianyi = getTianyiNoble(yearGanZhi.charAt(0));
      if (tianyi) result.tianyiNoble = tianyi;
    }
  }
  return result;
}

/* ---------- /divination：临时起卦（vendored mingyu-core divination） ---------- */

function toCustomDate(value) {
  // customDate 从前端 JSON 过来是字符串；各 generate* 要求 Date 或 undefined
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(new Error(`Invalid customDate: ${value}`), { clientError: true });
  }
  return d;
}

function computeDivination(input) {
  // 必填校验：input 非对象 / method 缺失或非字符串 → 客户端错误（对齐 /ziwei 校验风格）
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.method !== 'string' || !input.method.trim()) {
    throw Object.assign(new Error('Missing required input field: method'), { clientError: true });
  }

  const method = input.method.trim();
  const customDate = toCustomDate(input.customDate);
  let raw;
  let almanacCustomLabel = ''; // REQ-121：自定义事项文本（topic=='custom'）随 result.customTopicLabel 返回
  switch (method) {
    case 'liuyao':
      // 时间起卦默认（customDate 省略用当前时间）；options 可带手工爻值/铜钱记录。
      // 节155：自研内核不接受缺省时间（确定性纪律），此处显式回落「当前时间」保持旧行为一致。
      raw = generateLiuyaoCore({
        customDate: customDate === undefined ? new Date() : customDate,
        options: (input.options && typeof input.options === 'object' && !Array.isArray(input.options))
          ? input.options : {},
      });
      break;
    case 'meihua':
      // settings 即报数等起卦设置（缺省 {} → 时间起卦）；同上回落当前时间
      raw = generateMeihuaCore({
        customDate: customDate === undefined ? new Date() : customDate,
        settings: (input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings))
          ? input.settings : {},
      });
      break;
    case 'xiaoliuren': {
      // 时间起课；params 内 customDate 同样允许字符串。节155 已切换自研内核：
      // 内核不接受缺省时间（确定性纪律），此处显式回落「当前时间」保持旧行为一致。
      const params = (input.params && typeof input.params === 'object' && !Array.isArray(input.params))
        ? { ...input.params }
        : {};
      params.customDate = toCustomDate(params.customDate);
      if (params.customDate === undefined) params.customDate = new Date();
      raw = generateXiaoliurenCore(params);
      break;
    }
    case 'liuren':
      // 大六壬时辰起课（REQ-118）：月将加时起天地盘，四课三传断吉凶；确定性零 LLM。
      // customDate 即前端所选 日期+时辰 组装的东八区 ISO（缺省用当前时间）。
      raw = generateLiuren(customDate);
      break;
    case 'jinkoujue': {
      // 金口诀起课（REQ-119）：地分起课 → 四位一体（人元/贵神/将神/地分）+ 阴阳发用 +
      // 五动三动；确定性零 LLM。params 原样透传引擎，起课方式四选一（time 时间起课 /
      // branch 指定地分 / number 数字起课 / random 随机起课），branch 传 params.branch、
      // number 传 params.number，random 无 seed/replay 时引擎以系统安全随机数取地分
      // （确定性重放可传 seed/replay）。customDate 即前端所选 日期+时辰 组装的东八区 ISO。
      const params = (input.params && typeof input.params === 'object' && !Array.isArray(input.params))
        ? { ...input.params }
        : {};
      params.customDate = toCustomDate(params.customDate);
      raw = generateJinkoujue(params);
      break;
    }
    case 'qimen': {
      // 奇门时家起局（REQ-120）：一事一占，时/日/月/年四家全做，与八法「奇门终身局
      // qimen-lifetime」命盘类区分。参数契约（透传前端 seed 同名字段）：
      //   scope        hour 时家（默认）/ day 日家 / month 月家 / year 年家
      //   qimenMethod  zhuanpan 转盘（默认）/ feipan 飞盘
      //   qimenJuMethod chaibu 拆补（默认）/ zhirun 置闰（仅时家/日家生效，月家/年家
      //                引擎固定用月家/年家定局法）
      // customDate 即前端所选 日期+时辰 组装的东八区 ISO（缺省用当前时间）。
      const scope = (typeof input.scope === 'string' && input.scope.trim()) ? input.scope.trim() : 'hour';
      if (!['hour', 'day', 'month', 'year'].includes(scope)) {
        throw Object.assign(new Error(`Unknown qimen scope: ${scope}`), { clientError: true });
      }
      const qimenMethod = (typeof input.qimenMethod === 'string' && input.qimenMethod.trim())
        ? input.qimenMethod.trim() : 'zhuanpan';
      if (!['zhuanpan', 'feipan'].includes(qimenMethod)) {
        throw Object.assign(new Error(`Unknown qimen method: ${qimenMethod}`), { clientError: true });
      }
      const qimenJuMethod = (typeof input.qimenJuMethod === 'string' && input.qimenJuMethod.trim())
        ? input.qimenJuMethod.trim() : 'chaibu';
      if (!['chaibu', 'zhirun'].includes(qimenJuMethod)) {
        throw Object.assign(new Error(`Unknown qimen juMethod: ${qimenJuMethod}`), { clientError: true });
      }
      raw = generateQimen(customDate, qimenMethod, scope, qimenJuMethod);
      break;
    }
    case 'almanac': {
      // 黄历择日（REQ-121，纯国学工具，免档案）：事项 + 日期范围（起止）+ 可选参与人 →
      // generateAlmanacSelection（vendored mingyu-core，逐日宜忌/冲煞/建除十二值/二十八宿/
      // 九星/彭祖百忌/方位神/逐时时课 + almanac-evidence.js 候选分组），确定性零 LLM。
      // 参数契约（input.almanac 整体透传引擎）：
      //   topic        事项类型 10 选 1：move 搬家入宅 / marriage 订婚结婚 / opening 开业启动 /
      //                contract 签约合作 / travel 出行赴任 / medical 就医手术 / study 考试学习 /
      //                burial 安葬修坟 / renovation 修造动土 / custom 自定义事项
      //   startDate    开始日期 YYYY-MM-DD（与 endDate 合围最多 180 天）
      //   endDate      结束日期 YYYY-MM-DD
      //   participants 参与人（可选，最多 30 位）：{id?, name?, gender:男|女, year, month, day,
      //                timeIndex(0-12 时辰序), dateType:'solar'|'lunar', isLeapMonth?}
      //                —— 引擎要求参与人完整生辰（生肖/年命须由年支推算），缺生日资料无法核验
      //                刑冲破害，故前端以完整公历生日收集；仅填生肖/年命不满足引擎契约。
      const params = (input.almanac && typeof input.almanac === 'object' && !Array.isArray(input.almanac))
        ? { ...input.almanac }
        : {};
      if (typeof params.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
          || typeof params.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(params.endDate)) {
        throw Object.assign(new Error('黄历择日需要提供开始日期和结束日期（YYYY-MM-DD）'), { clientError: true });
      }
      const ALMANAC_TOPICS = ['move', 'marriage', 'opening', 'contract', 'travel', 'medical', 'study', 'burial', 'renovation', 'custom'];
      if (typeof params.topic !== 'string' || !ALMANAC_TOPICS.includes(params.topic)) {
        throw Object.assign(new Error('黄历择日事项类型必须是 move/marriage/opening/contract/travel/medical/study/burial/renovation/custom 之一'), { clientError: true });
      }
      const startMs = new Date(params.startDate + 'T00:00:00+08:00').getTime();
      const endMs = new Date(params.endDate + 'T00:00:00+08:00').getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
        throw Object.assign(new Error('黄历择日起止日期无效：结束日期不得早于开始日期'), { clientError: true });
      }
      if (Math.round((endMs - startMs) / 86400000) > 179) {
        throw Object.assign(new Error('黄历择日一次最多比较 180 天，请缩小日期范围'), { clientError: true });
      }
      raw = generateAlmanacSelectionCore(params);
      // 自定义事项文本（topic=='custom'）随 result.customTopicLabel 透传（仅展示/供深度解读
      // 引用；引擎只按通用「自定义事项」计算，custom 关键词为空，不参与计算）。
      if (typeof params.customTopicLabel === 'string' && params.customTopicLabel.trim()) {
        almanacCustomLabel = params.customTopicLabel.trim();
      }
      break;
    }
    case 'taiyi': {
      // 太乙神数（REQ-124，纯国学大势工具，免档案）：年/月/日/时四计七十二局基础盘 →
      // generateTaiyi（vendored mingyu-core，太乙/文昌/始击/计神/主客定算/十六神 + evidence
      // 证据链），确定性零 LLM。参数契约（input.taiyi 整体透传引擎）：
      //   scope      四选一 year 年家（默认）/ month 月家 / day 日家 / hour 时家
      //   year       公历年份（1-9999 整数，仅年家必需；引擎年家不接受 date）
      //   customDate 东八区 ISO（月/日/时家必需；引擎以 Date 排月计/日计/时计，
      //               缺省回退顶层 input.customDate）
      const params = (input.taiyi && typeof input.taiyi === 'object' && !Array.isArray(input.taiyi))
        ? { ...input.taiyi }
        : {};
      const scope = (typeof params.scope === 'string' && params.scope.trim()) ? params.scope.trim() : 'year';
      if (!['year', 'month', 'day', 'hour'].includes(scope)) {
        throw Object.assign(new Error('太乙计式必须是 year/month/day/hour 之一'), { clientError: true });
      }
      if (scope === 'year') {
        const year = Number(params.year);
        if (!Number.isInteger(year) || year < 1 || year > 9999) {
          throw Object.assign(new Error('太乙年家需要提供公历年份（1-9999 整数）'), { clientError: true });
        }
        raw = generateTaiyi({ scope: 'year', year });
      } else {
        const d = toCustomDate(params.customDate !== undefined ? params.customDate : input.customDate);
        if (d === undefined) {
          throw Object.assign(new Error('太乙月/日/时家需要提供日期时间（customDate）'), { clientError: true });
        }
        raw = generateTaiyi({ scope, date: d });
      }
      break;
    }
    case 'huangji': {
      // 皇极经世（REQ-125，纯国学大势工具，免档案）：元会运世周期 → 值年/月经/旬纬/日卦/
      // 时经卦 → calculateHuangjiJingshi（vendored mingyu-core，position/forecast/eraTrend/
      // dateTimeForecast + sources/limitations），确定性零 LLM。参数契约（input.huangji）：
      //   mode       二选一 year 值年（默认：元会运世+值年卦+统卦/运卦/十年卦，传 year）/
      //              datetime 年月日时（值年/月经/旬纬/日卦/时经卦五层，传 customDate）
      //   year       公元整数年份（无公元 0 年、不早于公元前 67017 年；仅 year 模式必需）
      //   customDate 东八区 ISO（datetime 模式必需；缺省回退顶层 input.customDate）
      const params = (input.huangji && typeof input.huangji === 'object' && !Array.isArray(input.huangji))
        ? { ...input.huangji }
        : {};
      const mode = (typeof params.mode === 'string' && params.mode.trim()) ? params.mode.trim() : 'year';
      if (!['year', 'datetime'].includes(mode)) {
        throw Object.assign(new Error('皇极经世模式必须是 year/datetime 之一'), { clientError: true });
      }
      if (mode === 'year') {
        const year = Number(params.year);
        if (!Number.isSafeInteger(year) || year === 0 || year < -67017) {
          throw Object.assign(new Error('皇极经世值年模式需要提供公元整数年份（无公元 0 年、不早于公元前 67017 年）'), { clientError: true });
        }
        raw = calculateHuangjiJingshi({ year });
      } else {
        const d = toCustomDate(params.customDate !== undefined ? params.customDate : input.customDate);
        if (d === undefined) {
          throw Object.assign(new Error('皇极经世年月日时模式需要提供日期时间（customDate）'), { clientError: true });
        }
        raw = calculateHuangjiJingshi({ date: d });
      }
      break;
    }
    case 'ssgw': {
      // 灵签随机抽签；options 可带 seed/replay 以确定性重放。
      // 节156：自研内核缺随机源抛错 → 缺 seed 由 ensureSeed 注入；ganzhi 需显式
      // moment（旧实现取调用时刻）→ 缺省注入当前时刻保持展示口径。
      const options = (input.options && typeof input.options === 'object' && !Array.isArray(input.options))
        ? input.options
        : {};
      raw = drawRandomSignCore({
        ...ensureSeed(options),
        // 内核 moment 解析接受 ISO 秒级（不含毫秒）；旧实现 ganzhi 取调用时刻，此处注入保持口径
        moment: (options.moment !== undefined && options.moment !== null && options.moment !== '')
          ? options.moment : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      });
      break;
    }
    case 'lenormand': {
      // 雷诺曼抽牌：spreadType 由 input.spreadType 提供（不是 settings/options）；
      // options 可带 seed/replay 确定性重放。非法 spreadType → 客户端错误。
      const spreadType = (typeof input.spreadType === 'string' && input.spreadType.trim())
        ? input.spreadType.trim()
        : 'single';
      if (!(spreadType in LENORMAND_SPREADS)) {
        throw Object.assign(new Error(`Unknown lenormand spread type: ${spreadType}`), { clientError: true });
      }
      const options = (input.options && typeof input.options === 'object' && !Array.isArray(input.options))
        ? input.options
        : {};
      raw = drawLenormandSpreadCore({ spreadType, options: ensureSeed(options) });
      break;
    }
    default:
      throw Object.assign(new Error(`Unknown divination method: ${method}`), { clientError: true });
  }
  const stripped = stripInternal(raw);
  if (method === 'almanac') {
    // REQ-121：提炼 almanac-evidence.js 的候选分组（可用/条件/慎用 + 日期→状态映射 + 硬约束/
    // 现实约束摘要）随 result 返回供前端展示。原始 evidenceAnalysis 体积大且含内部 promptText/
    // sources/calculationSteps，stripInternal 已整体剥离；这里只保留前端展示所需的最小投影。
    const ev = raw && raw.evidenceAnalysis;
    stripped.candidateGroups = null;
    if (ev && typeof ev === 'object') {
      const statusByDate = {};
      if (Array.isArray(ev.candidates)) {
        ev.candidates.forEach((c) => { if (c && c.date) statusByDate[c.date] = c.status; });
      }
      stripped.candidateGroups = {
        preferredDates: Array.isArray(ev.preferredDates) ? ev.preferredDates : [],
        conditionalDates: Array.isArray(ev.conditionalDates) ? ev.conditionalDates : [],
        cautionDates: Array.isArray(ev.cautionDates) ? ev.cautionDates : [],
        statusByDate,
        hardConstraints: Array.isArray(ev.hardConstraints) ? ev.hardConstraints : [],
        realityConstraints: Array.isArray(ev.realityConstraints) ? ev.realityConstraints : [],
      };
    }
    // 逐日月相为引擎天文背景（REQ-121 结果口径只含 宜忌/冲煞/宿曜/九星/百忌/方位神/逐时时课），
    // 剔除以防 180 天范围的 payload 与落库体积过大。
    if (Array.isArray(stripped.days)) {
      stripped.days.forEach((d) => { if (d && typeof d === 'object') delete d.moonPhaseEvidence; });
    }
    if (almanacCustomLabel) {
      stripped.customTopicLabel = almanacCustomLabel;
    }
  } else if (method === 'taiyi') {
    // REQ-124：提炼 taiyi/evidence.js 的证据链最小投影（计算链/方法论/限制/主要事实/汇总）
    // 随 result 返回，供前端「证据链·局限」展示与深度解读合规引用（趋势参考不作吉凶保证）。
    // 原始 evidenceAnalysis 体积大且含逐条 promptText/sources/calculationSteps，stripInternal
    // 已整体剥离；此处只保留前端展示与 LLM 合规引用所需的最小投影。
    const ev = raw && raw.evidenceAnalysis;
    stripped.evidenceChain = null;
    if (ev && typeof ev === 'object') {
      stripped.evidenceChain = {
        calculationChain: Array.isArray(ev.calculationChain) ? ev.calculationChain : [],
        methodology: Array.isArray(ev.methodology) ? ev.methodology : [],
        limitations: Array.isArray(ev.limitations) ? ev.limitations : [],
        primaryFacts: Array.isArray(ev.primaryFacts) ? ev.primaryFacts : [],
        supportingFacts: Array.isArray(ev.supportingFacts) ? ev.supportingFacts : [],
        summaryFact: (ev.summaryFact && typeof ev.summaryFact === 'object' && ev.summaryFact.promptText)
          ? ev.summaryFact.promptText : '',
      };
    }
  } else if (method === 'huangji') {
    // REQ-125：同样提炼 evidenceChain 投影（元会运世换算链 + 传统依据来源 + 限制）；
    // top-level 与 dateTimeForecast 内的 calculationChain/sources 被 stripInternal 剥离，
    // 这里合并回补（limitations 不在剥离清单，本就保留）。
    const dte = raw && raw.dateTimeForecast;
    const chain = [].concat(
      Array.isArray(raw && raw.calculationChain) ? raw.calculationChain : [],
      (dte && Array.isArray(dte.calculationChain)) ? dte.calculationChain : [],
    );
    const srcs = [].concat(
      Array.isArray(raw && raw.sources) ? raw.sources : [],
      (dte && Array.isArray(dte.sources)) ? dte.sources : [],
    );
    const lims = [].concat(
      Array.isArray(raw && raw.limitations) ? raw.limitations : [],
      (dte && Array.isArray(dte.limitations)) ? dte.limitations : [],
    );
    stripped.evidenceChain = {
      calculationChain: chain,
      sources: srcs,
      limitations: lims,
    };
  }
  return stripped;
}

/* ---------- /tarot：塔罗抽牌（vendored mingyu-core divination/tarot.js） ---------- */

// 节157：自研内核要求确定性输入（缺 seed 抛 PaipanInputError）；对无 seed/replay/逐张样本/
// 手工录入的随机请求注入 crypto 强随机种子，保持「随机抽牌」体验不变，同时让内核路径可用
// （vendor 路径同样受益：显式 seed 走同一套种子化随机，行为无感变化）。
function ensureSeed(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return options;
  if (options.seed === undefined && options.replay === undefined
      && !Array.isArray(options.interactiveSamples) && !Array.isArray(options.manualCardIds)) {
    return { ...options, seed: randomInt(0, 2 ** 31) };
  }
  return options;
}

function computeTarot(input) {
  // 必填校验：input 非对象 / spreadType 非字符串（缺省 'single'）→ 客户端错误
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || (input.spreadType !== undefined && typeof input.spreadType !== 'string')) {
    throw Object.assign(new Error('Invalid input: spreadType must be a string'), { clientError: true });
  }
  const spreadType = (typeof input.spreadType === 'string' && input.spreadType.trim())
    ? input.spreadType.trim()
    : 'single';
  if (!(spreadType in TAROT_SPREADS)) {
    throw Object.assign(new Error(`Unknown tarot spread type: ${spreadType}`), { clientError: true });
  }
  // options 原样透传：seed/replay 确定性重放、interactiveSamples 逐张样本、question 占问方向等；
  // 缺 seed 时注入（节157，见 ensureSeed）；内核缺 seed 抛错，注入后同 seed 可复现
  const options = (input.options && typeof input.options === 'object' && !Array.isArray(input.options))
    ? input.options
    : {};
  return stripInternal(drawTarotSpreadCore({ spreadType, options: ensureSeed(options) }));
}

/* ---------- /astrology：星座星盘（vendored mingyu-core astrolabe + astrolabe-scope） ---------- */

function toAstrolabeText(value, fallback) {
  // generateAstrolabe 的入参为数字字符串（requireNumber 只收 string）；
  // 空值回退缺省，非法数值也回退（越界数值留给引擎本地校验抛错）。
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : fallback;
}

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function todayDateStr() {
  // 非 natal scope 缺省 dateStr 时的参考日期：今天（YYYY-MM-DD）
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function computeAstrology(input) {
  // 必填校验：input 非对象 / year 缺失或非数值 → 客户端错误（对齐 /ziwei 校验风格）
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Invalid input: expected an object'), { clientError: true });
  }
  if (toFiniteNumber(input.year) === null) {
    throw Object.assign(new Error('Missing required input field: year'), { clientError: true });
  }
  // generateAstrolabe 以经纬度推算上升点与宫位（requireNumber 无条件校验），
  // 缺失/非法经纬度属调用方入参问题 → 客户端错误（比引擎 500 友好）。
  if (toFiniteNumber(input.longitude) === null || toFiniteNumber(input.latitude) === null) {
    throw Object.assign(new Error('Missing required input field: longitude/latitude'), { clientError: true });
  }

  // scope 缺省 'natal'：本命盘免费视图；其余盘型（行运/日返/次限等）一律走
  // buildAstrolabeFullScopeContexts 产出 natal+yearly+monthly+daily 全范围上下文。
  const scope = (typeof input.scope === 'string' && input.scope.trim()) ? input.scope.trim() : 'natal';
  const gender = input.gender === 'female' ? 'female' : 'male';

  // generateAstrolabe 实际入参（flat 数字字符串，非 extra 的嵌套 profile）：
  //   year/month/day/hour/minute + latitude/longitude + timezone 或 timeZoneId，
  //   可选 name/gender/locationName/useTrueSolarTime（见 vendor .../algorithms/astrolabe.js 签名）。
  const astrolabeInput = {
    name: typeof input.name === 'string' ? input.name : '',
    gender,
    locationName: typeof input.birthplace === 'string' ? input.birthplace : '',
    year: String(input.year),
    month: toAstrolabeText(input.month, '1'),   // 缺省 1
    day: toAstrolabeText(input.day, '1'),       // 缺省 1
    hour: toAstrolabeText(input.hour, '0'),     // 缺省 0
    minute: toAstrolabeText(input.minute, '0'), // 缺省 0
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    timezone: '8',                              // 与 computeExtra 同口径：固定东八区
    useTrueSolarTime: Boolean(input.true_solar),
  };

  const natal = generateAstrolabe(astrolabeInput);
  const result = { natal: stripInternal(natal) };

  if (scope !== 'natal') {
    // full 优先：行运/日返/次限等一律产出全范围上下文（引擎以统一 YYYY-MM-DD 基准
    // 派生流年/流月/流日；dateStr 缺省/非法时以当天为基准，避免引擎 normalize 抛错）。
    const rawDate = (typeof input.dateStr === 'string' && input.dateStr.trim()) ? input.dateStr.trim() : '';
    const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDateStr();
    result.fullScope = stripInternal(buildAstrolabeFullScopeContexts(natal, referenceDate));
  }
  return result;
}

// ---------------------------------------------------------------------------
// HTTP 服务
// ---------------------------------------------------------------------------

const HOST = '127.0.0.1';
const PORT = Number(process.env.PAIPAN_NODE_PORT) || 9317;
const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64MB 上限，防内存被打满

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(req, res, status, message) {
  console.error(`[paipan_server] ${req.method} ${req.url} -> ${status}: ${message}`);
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  if (req.method !== 'POST') {
    sendError(req, res, 405, 'Method not allowed. Use POST.');
    return;
  }

  let bodyText;
  try {
    bodyText = await readBody(req);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    sendError(req, res, status, String(e && e.message ? e.message : e));
    return;
  }

  let input;
  try {
    input = JSON.parse(bodyText.trim() || '{}');
  } catch (e) {
    sendError(req, res, 400, `Invalid JSON body: ${e && e.message ? e.message : e}`);
    return;
  }

  const pathname = (req.url || '').split('?')[0];

  try {
    if (pathname === '/ziwei') {
      const result = computeZiwei(input); // iztro 同步 API，直接返回
      sendJson(res, 200, result);
    } else if (pathname === '/extra') {
      const result = await computeExtra(input);
      sendJson(res, 200, result);
    } else if (pathname === '/zodiac') {
      const result = computeZodiac(input); // 生肖流年同步 API，直接返回
      sendJson(res, 200, result);
    } else if (pathname === '/tarot') {
      const result = computeTarot(input); // 塔罗抽牌同步 API，直接返回
      sendJson(res, 200, result);
    } else if (pathname === '/astrology') {
      const result = computeAstrology(input); // 星座星盘同步 API（natal + fullScope）
      sendJson(res, 200, result);
    } else if (pathname === '/divination') {
      const result = computeDivination(input); // 临时起卦同步 API，直接返回
      sendJson(res, 200, result);
    } else {
      sendError(req, res, 404, `Unknown endpoint: ${pathname}. Use /ziwei, /extra, /zodiac, /tarot, /astrology or /divination.`);
    }
  } catch (e) {
    // 与子进程脚本一致：ziwei 必填校验 / 计算失败均属调用方可降级的错误
    const status = e && e.clientError ? 400 : 500;
    sendError(req, res, status, String(e && e.message ? e.message : e));
  }
}

const server = createServer(handleRequest);

server.on('error', (e) => {
  console.error(`[paipan_server] server error: ${e && e.message ? e.message : e}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`listening on ${HOST}:${PORT}`);
});

// 优雅退出：SIGINT / SIGTERM 时先停止接收新连接
function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
