// REQ-084 临时验证驱动：headless Chrome + 原生 WebSocket CDP（零依赖）。
// 场景：
//   sprite   —— 结构检查 + 逐帧采样（验证 10 帧行优先循环/帧时长）+ reduced-motion 停帧 + 点击进会话
//   final    —— ready=false 结构检查（img + 旧 keyframes + 空 .lm-fx）+ 点击 + reduced-motion 剪裁截图
//   baseline —— 基线（git show HEAD 版 index.html）结构/剪裁截图
// 用法：node frontend/scripts/_tmp-cdp-verify.cjs --scenario <sprite|final|baseline> --port 8765
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9233;

const args = process.argv.slice(2);
const get = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const SCENARIO = get('--scenario', 'sprite');
const PORT = parseInt(get('--port', '8765'), 10);
const OUT_DIR = path.join(__dirname, '_tmp_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.error('[driver]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 最小 PNG 解码（供区域像素 diff） ----------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    i += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error('unsupported png ' + bitDepth + '/' + colorType);
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const out = Buffer.alloc(height * stride);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    prev.set(cur);
  }
  return { width, height, channels, data: out };
}

// ---------- CDP 客户端（raw HTTP upgrade + socket；undici/.NET WebSocket 均被 Chrome 握手拒绝，
// 原生握手 + 显式 Origin 可行。客户端帧需掩码，服务端帧无掩码） ----------
const crypto = require('node:crypto');

async function cdpConnect(wsUrl) {
  const u = new URL(wsUrl);
  const key = crypto.randomBytes(16).toString('base64');
  const { socket, headers } = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: u.port, path: u.pathname,
      headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key, Origin: 'http://127.0.0.1:' + u.port
      }
    });
    req.on('upgrade', (res, sock) => resolve({ socket: sock, headers: res.headers }));
    req.on('error', reject);
    req.end();
  });
  const expect = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  if (headers['sec-websocket-accept'] !== expect) throw new Error('ws accept mismatch');
  socket.setNoDelay(true);
  return socket;
}

function wsSend(socket, text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  const len = payload.length;
  let hdr;
  if (len < 126) hdr = Buffer.from([0x81, 0x80 | len]);
  else if (len < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x81; hdr[1] = 0x80 | 126; hdr.writeUInt16BE(len, 2); }
  else { hdr = Buffer.alloc(10); hdr[0] = 0x81; hdr[1] = 0x80 | 127; hdr.writeBigUInt64BE(BigInt(len), 2); }
  socket.write(Buffer.concat([hdr, mask, masked]));
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.on('data', d => this._onData(d));
    socket.on('error', () => {});
    socket.on('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('cdp closed'));
      this.pending.clear();
    });
  }
  static async connect(wsUrl) {
    const socket = await cdpConnect(wsUrl);
    return new CDP(socket);
  }
  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const opcode = this.buf[0] & 0x0f;
      const masked = (this.buf[1] & 0x80) !== 0;
      let len = this.buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2)); off = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < off + maskLen + len) return;
      let payload = this.buf.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mk = this.buf.subarray(off, off + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mk[i % 4];
        payload = out;
      }
      this.buf = this.buf.subarray(off + maskLen + len);
      if (opcode === 8) { this.socket.end(); return; } // close
      if (opcode === 9) { wsSend(this.socket, ''); continue; } // ping -> pong (opcode ignored; server treats empty text as pong? send proper pong below)
      if (opcode === 10) continue; // pong
      if (opcode !== 1 && opcode !== 2) continue; // ignore continuation/binaries
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      wsSend(this.socket, JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result ? r.result.value : undefined;
  }
  close() { try { this.socket.end(); } catch (e) {} }
}

// ---------- 启动 Chrome + 连接 ----------
async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-cdp-'));
  log('spawning chrome, profile', profile);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--remote-allow-origins=*',
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1280,1024',
    'about:blank'
  ], { stdio: 'ignore' });
  // 等 CDP 端口就绪
  let list = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list');
      list = await res.json();
      if (list.some(t => t.type === 'page')) break;
    } catch (e) {}
    await sleep(200);
  }
  if (!list || !list.some(t => t.type === 'page')) throw new Error('chrome cdp not ready');
  const page = list.find(t => t.type === 'page');
  log('connecting cdp', page.webSocketDebuggerUrl);
  const cdp = await CDP.connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  log('cdp connected');
  return { chrome, cdp };
}

async function waitMascot(cdp, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await cdp.eval("!!document.querySelector('.landing-mascot')")) return;
    await sleep(120);
  }
  throw new Error('landing-mascot not mounted in time');
}

const STRUCT_EXPR = `(() => {
  const btn = document.querySelector('.landing-mascot');
  const sp = document.querySelector('.mascot-sprite.play');
  const fx = document.querySelector('.lm-fx');
  const st = document.getElementById('kf-mascotSpritePlay_5x2_10');
  const img = btn ? btn.querySelector('img') : null;
  return {
    btnClass: btn ? btn.className : null,
    btnRect: btn ? (() => { const r = btn.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    hasImg: !!img,
    imgSrc: img ? img.getAttribute('src') : null,
    imgAlt: img ? img.getAttribute('alt') : null,
    imgAnim: img ? getComputedStyle(img).animationName : null,
    hasSprite: !!sp,
    spriteStyle: sp ? {
      w: sp.style.width, h: sp.style.height,
      bg: getComputedStyle(sp).backgroundImage,
      bs: getComputedStyle(sp).backgroundSize,
      animName: getComputedStyle(sp).animationName,
      animVar: sp.style.getPropertyValue('--sprite-anim').trim(),
      willChange: getComputedStyle(sp).willChange
    } : null,
    fxChildren: fx ? fx.children.length : null,
    kfInjected: st ? { id: st.id, len: st.textContent.length, text: st.textContent } : null,
    capText: btn ? (btn.querySelector('.lm-cap') || {}).textContent || null : null,
    capVisible: btn ? !!btn.querySelector('.lm-cap') : null,
    pathname: location.pathname
  };
})()`;

const SAMPLE_EXPR = `(async () => {
  const el = document.querySelector('.mascot-sprite.play');
  if (!el) return { error: 'no sprite el' };
  const t0 = performance.now();
  const samples = [];
  await new Promise(res => {
    const tick = () => {
      const now = performance.now();
      samples.push({ t: Math.round(now - t0), bp: getComputedStyle(el).backgroundPosition });
      if (now - t0 > 3900) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { samples };
})()`;

const SAMPLE_ANIM_EXPR = `(async () => {
  const el = document.querySelector('.mascot-sprite.play');
  if (!el) return { error: 'no sprite el' };
  const t0 = performance.now();
  const bps = [];
  await new Promise(res => {
    const tick = () => {
      bps.push(getComputedStyle(el).backgroundPosition);
      if (performance.now() - t0 > 700) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { animName: getComputedStyle(el).animationName, bps };
})()`;

function analyzeFrames(samples) {
  const W = 256, COLS = 5;
  const EXPECTED = [];
  for (let k = 0; k < 10; k++) {
    EXPECTED.push('-' + ((k % COLS) * W) + 'px -' + (Math.floor(k / COLS) * W) + 'px');
  }
  // 每帧 dwell 统计
  const seen = new Set();
  const dwell = {};
  const order = [];
  let lastIdx = -1, runStart = null;
  for (const s of samples) {
    let idx = EXPECTED.indexOf(s.bp);
    if (idx < 0) continue;
    seen.add(idx);
    if (idx !== lastIdx) {
      if (lastIdx >= 0) dwell[lastIdx] = (dwell[lastIdx] || 0) + (s.t - runStart);
      order.push(idx);
      lastIdx = idx; runStart = s.t;
    }
  }
  if (lastIdx >= 0) dwell[lastIdx] = (dwell[lastIdx] || 0) + (samples[samples.length - 1].t - runStart);
  // 顺序是否为 0..9 的循环位移重复
  let cyclicOk = true;
  const uniq = [];
  for (const v of order) if (uniq[uniq.length - 1] !== v) uniq.push(v);
  if (uniq.length < 10) cyclicOk = false;
  else {
    const first = uniq[0];
    for (let j = 0; j < 10; j++) if (uniq[j] !== (first + j) % 10) { cyclicOk = false; break; }
  }
  return {
    expected: EXPECTED,
    framesSeen: [...seen].sort((a, b) => a - b),
    all10: seen.size === 10,
    cyclicOk,
    dwellMs: Object.fromEntries(Object.entries(dwell).map(([k, v]) => [k, Math.round(v)])),
    samples: samples.length
  };
}

async function clipShot(cdp, rect, file) {
  const r = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 }
  });
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

// ---------- 场景执行 ----------
async function main() {
  const { chrome, cdp } = await launch();
  const url = 'http://127.0.0.1:' + PORT + '/';
  const result = { scenario: SCENARIO, url, ts: new Date().toISOString() };
  try {
    log('navigate', url);
    await cdp.send('Page.navigate', { url });
    await waitMascot(cdp);
    await sleep(600); // 等首帧绘制/动画起步
    log('mounted; structure check');

    if (SCENARIO === 'sprite') {
      result.structure = await cdp.eval(STRUCT_EXPR);
      log('structure ok; sampling frames over 3.9s');
      const sample = await cdp.eval(SAMPLE_EXPR);
      result.frames = analyzeFrames(sample.samples || []);
      log('sampled', (sample.samples || []).length, 'points');
      // reduced-motion 停帧
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await cdp.send('Page.reload');
      await waitMascot(cdp);
      await sleep(300);
      const rm = await cdp.eval(SAMPLE_ANIM_EXPR);
      result.reducedMotion = { animName: rm.animName, allStaticFirstFrame: (rm.bps || []).every(b => b === '0px 0px'), bpSamples: (rm.bps || []).length };
      log('reduced-motion ok; restoring + screenshot');
      // 恢复 + 截图
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
      await cdp.send('Page.reload');
      await waitMascot(cdp);
      await sleep(500);
      const rect = await cdp.eval("(() => { const r = document.querySelector('.landing-mascot').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()");
      result.shot = await clipShot(cdp, rect, path.join(OUT_DIR, 'sprite-clip.png'));
      log('shot saved; click test');
      // 点击 → 进会话（未登录 → /login 门禁重定向，证明 navigate('agent') 触发）
      await cdp.eval("document.querySelector('.landing-mascot').click(); true");
      await sleep(500);
      result.click = { pathname: await cdp.eval('location.pathname'), expectedRedirect: '/login' };
    } else if (SCENARIO === 'final' || SCENARIO === 'baseline') {
      // reduced-motion 下截剪裁图（静态、可确定性比对）
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await cdp.send('Page.reload');
      await waitMascot(cdp);
      await sleep(400);
      result.structure = await cdp.eval(STRUCT_EXPR);
      const rect = result.structure.btnRect;
      result.shot = await clipShot(cdp, rect, path.join(OUT_DIR, SCENARIO + '-clip.png'));
      if (SCENARIO === 'final') {
        result.outerHTML = await cdp.eval("document.querySelector('.landing-mascot').outerHTML");
        // 点击 → 进会话（未登录 → /login 门禁重定向）
        await cdp.eval("document.querySelector('.landing-mascot').click(); true");
        await sleep(500);
        result.click = { pathname: await cdp.eval('location.pathname'), expectedRedirect: '/login' };
      } else {
        result.outerHTML = await cdp.eval("document.querySelector('.landing-mascot').outerHTML");
      }
      log('final/baseline done');
    }
  } catch (e) {
    result.error = String(e && e.stack || e);
  }
  fs.writeFileSync(path.join(OUT_DIR, SCENARIO + '-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('RESULT_' + SCENARIO + ':');
  console.log(JSON.stringify(result, null, 2));
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  // 进程退出前再确保子进程清理
  await sleep(200);
  process.exit(result.error ? 1 : 0);
}

// ---------- 像素比对（在 final/baseline 各自截图后运行） ----------
if (SCENARIO === 'compare') {
  const a = decodePNG(fs.readFileSync(path.join(OUT_DIR, 'baseline-clip.png')));
  const b = decodePNG(fs.readFileSync(path.join(OUT_DIR, 'final-clip.png')));
  if (a.width !== b.width || a.height !== b.height) {
    console.log('DIFF size mismatch', a.width + 'x' + a.height, b.width + 'x' + b.height);
    process.exit(2);
  }
  const ch = Math.min(a.channels, b.channels);
  let diff = 0, maxDelta = 0, firstDiff = null;
  for (let i = 0; i < a.data.length; i += ch) {
    let d = 0;
    for (let c = 0; c < ch; c++) d += Math.abs(a.data[i + c] - b.data[i + c]);
    if (d > 0) {
      diff++;
      if (d > maxDelta) maxDelta = d;
      if (!firstDiff) firstDiff = i;
    }
  }
  console.log('PIXEL_COMPARE total=' + (a.width * a.height) + ' diff=' + diff + ' maxDelta=' + maxDelta + ' firstDiffIdx=' + firstDiff);
  process.exit(diff === 0 ? 0 : 1);
}

main();
