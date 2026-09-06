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
    } else {
      sendError(req, res, 404, `Unknown endpoint: ${pathname}. Use /ziwei or /extra.`);
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
