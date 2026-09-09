#!/usr/bin/env node
/**
 * gen-mascot-placeholder.mjs — REQ-084 占位 sprite sheet 生成器（零依赖）
 *
 * 生成一张「10 帧编号占位图」，用于验证落地页 Q 版三化身「序列帧播放框架」：
 *   网格 5 cols × 2 rows × 256px，总计 10 帧；每帧左上角一块编号色块（10 种色相）
 *   且中央写有帧序号（用像素级位图数字 3×5，避免依赖字体）。
 * 输出为标准 PNG（RGBA，filter 0 + zlib deflate），无任何第三方依赖。
 *
 * 用法：
 *   node frontend/scripts/gen-mascot-placeholder.mjs [输出路径]
 *   默认输出 frontend/public/art/taichu-pet/mascot-guoxue.placeholder.png
 *
 * 说明：占位图仅用于框架验证；线上正式启用请用美术回传动作帧 sprite，并把
 * MODS 中对应 mascot.sprite 的 ready 置 true、src 指向正式素材（cols/rows/frames/
 * width 按回传网格对齐）。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 256, H = 256, COLS = 5, ROWS = 2, FRAMES = 10;
const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art', 'taichu-pet', 'mascot-guoxue.placeholder.png');

// ---- 3×5 像素数字位图（0-9），1=前景色，0=透明 ----
const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

// 10 帧编号色相（左上角色块），与现有占位图同风格
const HUES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]; // 度
function hsv2rgb(h, s = 0.72, v = 0.9) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// 全透明底
const px = new Uint8Array(W * H * ROWS * COLS * 4); // 1280x512 RGBA

function setPx(x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= W * COLS || y >= H * ROWS) return;
  const i = (y * W * COLS + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}

for (let k = 0; k < FRAMES; k++) {
  const col = k % COLS, row = Math.floor(k / COLS);
  const ox = col * W, oy = row * H;
  const hueColor = hsv2rgb(HUES[k]);
  // 左上角 64×64 编号色块
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) setPx(ox + x, oy + y, hueColor);
  // 中央帧序号（放大 8× 的 3×5 数字 → 24×40）
  const d = DIGITS[k];
  const scale = 8;
  const dw = 3 * scale, dh = 5 * scale;
  const dxx = ox + Math.floor((W - dw) / 2), dyy = oy + Math.floor((H - dh) / 2);
  for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 3; dx++) {
    if (d[dy][dx] !== '1') continue;
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      setPx(dxx + dx * scale + sx, dyy + dy * scale + sy, [245, 245, 245]);
    }
  }
}

// ---- PNG 编码 ----
const W_ALL = W * COLS, H_ALL = H * ROWS;
const raw = Buffer.alloc(H_ALL * (1 + W_ALL * 4));
for (let y = 0; y < H_ALL; y++) {
  raw[y * (1 + W_ALL * 4)] = 0; // filter: none
  px.copy(raw, y * (1 + W_ALL * 4) + 1, y * W_ALL * 4, (y + 1) * W_ALL * 4);
}
const idat = deflateSync(raw, { level: 9 });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W_ALL, 0); ihdr.writeUInt32BE(H_ALL, 4);
ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, color type 6 (RGBA)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`✓ 已生成占位 sprite sheet: ${OUT}`);
console.log(`  规格: ${W_ALL}x${H_ALL} (${COLS}×${ROWS}×${W}px, ${FRAMES} 帧编号分色)`);
