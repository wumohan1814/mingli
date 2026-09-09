// REQ-084 临时验证用静态服务器：服务 frontend/public，/api/* 一律 404 JSON（模拟后端不可达 →
// 前端回退默认设置，agent_enabled 默认 true）。可选 --indexOverride 用另一份 index.html 服务首页
// （基线对比用）。用法：
//   node frontend/scripts/_tmp-static-server.cjs --port 8765 [--indexOverride <file>]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const get = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const PORT = parseInt(get('--port', '8765'), 10);
const ROOT = path.join(__dirname, '..', 'public');
const INDEX_OVERRIDE = get('--indexOverride', null);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};

function readIndex() {
  if (INDEX_OVERRIDE) return fs.readFileSync(INDEX_OVERRIDE);
  return fs.readFileSync(path.join(ROOT, 'index.html'));
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    pathname = req.url.split('?')[0];
  }
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readIndex());
    return;
  }
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 404, error: 'backend unavailable in verify harness' }));
    return;
  }
  const file = path.join(ROOT, pathname);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
    return;
  }
  // SPA fallback：无扩展名未知路径 → index.html（深链直接打开场景）
  if (!path.extname(pathname)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readIndex());
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found: ' + pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('static server on http://127.0.0.1:' + PORT + ' root=' + ROOT + (INDEX_OVERRIDE ? ' indexOverride=' + INDEX_OVERRIDE : ''));
});
