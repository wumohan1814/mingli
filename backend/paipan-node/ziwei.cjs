#!/usr/bin/env node
/* 命理自研 — 紫微斗数排盘（iztro）。
 *
 * 从 stdin 读 JSON：{"birthday":"1990-05-12","time_idx":7,"gender":"男"}
 * stdout 输出 UTF-8 JSON：
 *   {soul, body, soul_palace, body_palace, five_elements_class,
 *    lunar_date, time_range,
 *    sihua:[{star,mutagen,palace}],
 *    palaces:[{index,name,heavenly_stem,earthly_branch,
 *              major_stars,minor_stars,adjective_stars,sihua,is_body_palace}]}
 * 供 backend/app/paipan/engine.py 以子进程调用。缺 iztro 时由 Python 侧降级为 null。
 */

const fs = require('fs');
const path = require('path');

function loadAstro() {
  // 优先使用脚本目录下的 node_modules
  const local = path.resolve(__dirname, 'node_modules', 'iztro');
  try {
    return require(local).astro;
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

const starName = (s) => (s && s.name ? s.name : String(s || ''));

function main() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  if (!raw) {
    console.error('Expected JSON on stdin: {"birthday":"1990-05-12","time_idx":7,"gender":"男"}');
    process.exit(2);
  }
  const input = JSON.parse(raw);
  for (const k of ['birthday', 'time_idx', 'gender']) {
    if (input[k] === undefined || input[k] === null || input[k] === '') {
      console.error(`Missing required input field: ${k}`);
      process.exit(2);
    }
  }

  const astrolabe = loadAstro().bySolar(input.birthday, input.time_idx, input.gender, true, 'zh-CN');
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

  process.stdout.write(JSON.stringify({
    soul: astrolabe.soul || '',
    body: astrolabe.body || '',
    soul_palace: astrolabe.earthlyBranchOfSoulPalace || '',
    body_palace: astrolabe.earthlyBranchOfBodyPalace || '',
    five_elements_class: astrolabe.fiveElementsClass || '',
    lunar_date: astrolabe.lunarDate || '',
    time_range: astrolabe.timeRange || '',
    sihua,
    palaces,
  }));
}

try {
  main();
} catch (e) {
  if (e && e.code === 'EPIPE') process.exit(0);
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}
