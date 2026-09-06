#!/usr/bin/env node
/* 太初自研 — 排盘引擎常驻 HTTP 服务。
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
 *        relation, elementRelation, noble, meeting, conflicts, evidenceGrade,
 *        interpretationBoundary, favorableRelations, riskRelations, actionSignals}
 *       输入 zodiac 缺失/非法 → 400（客户端错误）。
 *   POST /divination  {method:"liuyao"|"meihua"|"xiaoliuren"|"ssgw",
 *                      customDate?:"ISO 字符串", options?:{}, settings?:{}, params?:{}}
 *     → 200 application/json，确定性起卦结果（六爻卦盘/梅花卦盘/小六壬课式/灵签签文，
 *       已 stripInternal）。method 决定取参位置：
 *       - liuyao      → generateLiuyao(customDate, options)（options 可带手工爻值等）
 *       - meihua      → generateMeihua(customDate, settings)（settings 即报数等）
 *       - xiaoliuren  → generateXiaoliuren(params)（params.customDate 亦接受字符串）
 *       - ssgw        → drawRandomSign(options)（随机抽签）
 *       输入缺 method / method 非法 / customDate 无效 → 400（客户端错误）。
 *
 * 出错返回非 200（JSON {"error": ...}），并把错误打到 stderr，供调用方降级。
 * 监听 127.0.0.1，端口取环境变量 PAIPAN_NODE_PORT，默认 9317。
 *
 * ziwei.cjs / extra.mjs 原样保留，作为 subprocess 降级路径。
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';

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
import { calculateWuyunLiuqi } from 'mingyu-core/wuyun-liuqi';
import { calculateQimenLifetime } from './vendor/mingyu-core/dist/divination/algorithms/qimen/index.js';
import { calculateZodiacYearFortune, getYearTaiSui } from './vendor/mingyu-core/dist/zodiac/index.js';
import { generateLiuyao } from './vendor/mingyu-core/dist/divination/algorithms/liuyao.js';
import { generateMeihua } from './vendor/mingyu-core/dist/divination/algorithms/meihua/index.js';
import { generateXiaoliuren } from './vendor/mingyu-core/dist/divination/algorithms/xiaoliuren.js';
import { drawRandomSign } from './vendor/mingyu-core/dist/divination/algorithms/ssgw.js';

// ---------------------------------------------------------------------------
// 排盘逻辑 —— 从 ziwei.cjs / extra.mjs 原样内联（不改动那两个文件）
// ---------------------------------------------------------------------------

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
    const birth = calculateWuyunLiuqi({ year: input.year });
    const current = calculateWuyunLiuqi({ year: currentYear });
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

function computeZodiac(input) {
  // 必填校验：input 非对象 / zodiac 缺失或非字符串 → 客户端错误（对齐 /ziwei 校验风格）
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.zodiac !== 'string' || !input.zodiac.trim()) {
    throw Object.assign(new Error('Missing required input field: zodiac'), { clientError: true });
  }
  // 纯确定性计算：{zodiac:"鼠", year:2026} → 流年干支/太岁/冲刑害破/贵人/行动信号；
  // evidenceAnalysis/prompt 属引擎内部字段，stripInternal 后不外泄。
  const raw = calculateZodiacYearFortune({ zodiac: input.zodiac, year: input.year });
  const result = stripInternal(raw);
  // 值年太岁星君名只出现在引擎 prompt 文本里（会被 stripInternal 剥离），
  // 这里单独从 getYearTaiSui 取回并入响应，供前端「值年星君」卡展示。
  if (raw.yearGanZhi) {
    result.taiSui = getYearTaiSui(raw.yearGanZhi);  // {yearBranch, star}
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
  switch (method) {
    case 'liuyao':
      // 时间起卦默认（customDate 省略用当前时间）；options 可带手工爻值/铜钱记录
      raw = generateLiuyao(customDate, input.options);
      break;
    case 'meihua':
      // settings 即报数等起卦设置（缺省 {} → 时间起卦）
      raw = generateMeihua(customDate, input.settings || {});
      break;
    case 'xiaoliuren': {
      // 时间起课；params 内 customDate 同样允许字符串
      const params = (input.params && typeof input.params === 'object' && !Array.isArray(input.params))
        ? { ...input.params }
        : {};
      params.customDate = toCustomDate(params.customDate);
      raw = generateXiaoliuren(params);
      break;
    }
    case 'ssgw': {
      // 灵签随机抽签；options 可带 seed/replay 以确定性重放
      const options = (input.options && typeof input.options === 'object' && !Array.isArray(input.options))
        ? input.options
        : {};
      raw = drawRandomSign(options);
      break;
    }
    default:
      throw Object.assign(new Error(`Unknown divination method: ${method}`), { clientError: true });
  }
  return stripInternal(raw);
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
    } else if (pathname === '/divination') {
      const result = computeDivination(input); // 临时起卦同步 API，直接返回
      sendJson(res, 200, result);
    } else {
      sendError(req, res, 404, `Unknown endpoint: ${pathname}. Use /ziwei, /extra, /zodiac or /divination.`);
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
