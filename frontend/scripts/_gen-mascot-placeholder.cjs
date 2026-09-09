// REQ-084 临时脚本：程序化生成占位 sprite sheet（10 帧编号图）供序列帧播放器验证。
// 纯 Node 零依赖 PNG 编码（RGB、8bit、无滤波）。用法：node frontend/scripts/_gen-mascot-placeholder.cjs
// 产物：frontend/public/art/taichu-pet/mascot-guoxue.placeholder.png（1280x512，5 列 x 2 行，每格 256x256）
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const CELL = 256, COLS = 5, ROWS = 2, FRAMES = 10;
const W = COLS * CELL, H = ROWS * CELL;

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
// 5x7 数字点阵（每行 5 bit，LSB 在右）
const GLYPHS = {
  0: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  2: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  3: [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  4: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  5: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  6: [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  7: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  8: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
};

const px = Buffer.alloc(W * H * 3);
const SCALE = 18; // 5x7 -> 90x126

function setPix(x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r; px[i + 1] = g; px[i + 2] = b;
}
function fillRect(x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPix(x, y, rgb);
}

const expectedCenter = [];
for (let f = 0; f < FRAMES; f++) {
  const col = f % COLS, row = Math.floor(f / COLS);
  const ox = col * CELL, oy = row * CELL;
  const [br, bg, bb] = hslToRgb((f * 36) % 360, 70, 62);
  const border = [Math.round(br * 0.7), Math.round(bg * 0.7), Math.round(bb * 0.7)];
  fillRect(ox, oy, CELL, CELL, [br, bg, bb]);
  fillRect(ox, oy, CELL, 8, border);        // 顶
  fillRect(ox, oy + CELL - 8, CELL, 8, border); // 底
  fillRect(ox, oy, 8, CELL, border);        // 左
  fillRect(ox + CELL - 8, oy, 8, CELL, border); // 右
  // 帧序号数字（白色），居中
  const glyph = GLYPHS[f];
  const gw = 5 * SCALE, gh = 7 * SCALE;
  const gx0 = ox + Math.floor((CELL - gw) / 2), gy0 = oy + Math.floor((CELL - gh) / 2);
  for (let r = 0; r < 7; r++) {
    const bits = glyph[r];
    for (let c = 0; c < 5; c++) {
      if (bits & (1 << (4 - c))) fillRect(gx0 + c * SCALE, gy0 + r * SCALE, SCALE, SCALE, [255, 255, 255]);
    }
  }
  // 左上角小定位点（深色），便于肉眼核对网格对齐
  fillRect(ox + 40, oy + 40, 24, 24, [40, 40, 60]);
  expectedCenter.push([br, bg, bb]);
}

const png = encodePNG(W, H, px);
const outDir = path.join(__dirname, '..', 'public', 'art', 'taichu-pet');
const outFile = path.join(outDir, 'mascot-guoxue.placeholder.png');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, png);
console.log('written:', outFile, png.length, 'bytes');

// ---------- 回读校验：IHDR 尺寸 + 逐帧中心像素色 ----------
const sig = png.subarray(0, 8).toString('hex');
const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
let idat = null;
for (let i = 8; i < png.length;) {
  const len = png.readUInt32BE(i);
  const type = png.toString('ascii', i + 4, i + 8);
  if (type === 'IDAT') idat = png.subarray(i + 8, i + 8 + len);
  i += 12 + len;
}
const raw = zlib.inflateSync(idat);
let ok = sig === '89504e470d0a1a0a' && w === W && h === H;
console.log('IHDR:', w, 'x', h, 'sig-ok:', sig === '89504e470d0a1a0a', 'filter-0 rows:', raw.length === H * (1 + W * 3));
for (let f = 0; f < FRAMES; f++) {
  const col = f % COLS, row = Math.floor(f / COLS);
  // 采样点避开居中的白色数字与四周边框（数字约占 x[83,173] y[65,191]；边框 8px）
  const sx = col * CELL + 60, sy = row * CELL + CELL - 70;
  const i = (sy * (1 + W * 3) + 1) + sx * 3;
  const got = [raw[i], raw[i + 1], raw[i + 2]];
  const same = got.every((v, k) => Math.abs(v - expectedCenter[f][k]) <= 1);
  if (!same) ok = false;
  console.log('frame', f, '(col ' + col + ',row ' + row + ') sample rgb', got.join(','), same ? 'OK' : 'MISMATCH expected ' + expectedCenter[f].join(','));
}
console.log(ok ? 'VERIFY PASS' : 'VERIFY FAIL');
process.exit(ok ? 0 : 1);
