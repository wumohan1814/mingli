#!/usr/bin/env node
/* 太初自研 — 其余流派排盘（占星/七政四余/五运六气/奇门终身局，基于 mingyu-core）。
 *
 * 从 stdin 读 JSON：
 *   {"year":1990,"month":5,"day":12,"hour":14,"minute":30,"gender":"male",
 *    "name":"测试","birthplace":"北京","longitude":116.4,"latitude":39.9,"true_solar":false}
 *
 * stdout 输出 UTF-8 JSON（对齐 chart.json 契约）：
 *   {"western":<AstrolabeData>, "qizheng":<QizhengResult>,
 *    "wuyun_liuqi":{"birth_year":<WuyunLiuqiResult>,"current_year":<WuyunLiuqiResult>},
 *    "qimen_lifetime":<QimenLifetimeData>|null}
 *
 * 说明：占星/七政/五运六气用 npm mingyu-core@0.2.1；奇门终身局用本地 vendor 的
 * 0.2.2 构建产物（calculateQimenLifetime，npm 0.2.1 无此函数）。
 */

import { readFileSync } from 'node:fs';
import { calculateBirthChartBundle } from 'mingyu-core';
import { calculateWuyunLiuqi } from 'mingyu-core/wuyun-liuqi';
import { calculateQimenLifetime } from './vendor/mingyu-core/dist/divination/algorithms/qimen/index.js';

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

async function main() {
  const raw = readFileSync(0, 'utf8').trim();
  const input = JSON.parse(raw || '{}');

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

  process.stdout.write(JSON.stringify({
    western,
    qizheng,
    wuyun_liuqi: wuyun,
    qimen_lifetime: qimen,
  }));
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
