// REQ-084 诊断脚本：探测 Chrome CDP WebSocket 握手到底返回什么（upgrade/response/error/close）。
// 用法：node frontend/scripts/_tmp-ws-probe.cjs <wsUrl>
const http = require('node:http');
const crypto = require('node:crypto');

const wsUrl = process.argv[2] || 'ws://127.0.0.1:9233/devtools/page/0';
const u = new URL(wsUrl);
const key = crypto.randomBytes(16).toString('base64');

const req = http.request({
  host: '127.0.0.1',
  port: u.port,
  path: u.pathname,
  headers: {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': key,
    Origin: 'http://127.0.0.1:' + u.port
  }
});

req.setTimeout(10000, () => { console.log('PROBE timeout'); req.destroy(); });
req.on('upgrade', (res, sock) => { console.log('PROBE upgrade OK status=' + res.statusCode + ' accept=' + res.headers['sec-websocket-accept']); sock.destroy(); });
req.on('response', res => { console.log('PROBE response (NOT upgrade) status=' + res.statusCode); res.resume(); res.on('data', d => { console.log('PROBE body: ' + d.toString().slice(0, 300)); }); });
req.on('error', e => console.log('PROBE error: ' + e.message));
req.on('close', () => console.log('PROBE close'));
req.end();
