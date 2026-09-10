// 临时白屏检查驱动：headless Chrome + 原生 WebSocket CDP（零依赖）。
// 加载本地页面 → 收集 console.error / 未捕获异常 → 检查 root 渲染结果。
// 用法：node frontend/scripts/_tmp_whitecheck.cjs [url]
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9233;
const TARGET = process.argv[2] || 'http://127.0.0.1:8000/';

// 整体强制超时：60s 无结果即退出（防挂起）
setTimeout(() => { console.error('TIMEOUT'); try { chrome.kill(); } catch (e) {} process.exit(2); }, 60000);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-wc-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=' + CDP_PORT, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-gpu', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getTarget() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const poll = () => {
      http.get('http://127.0.0.1:' + CDP_PORT + '/json', resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => {
          try {
            const list = JSON.parse(d);
            const page = list.find(t => t.type === 'page');
            if (page) return resolve(page.webSocketDebuggerUrl);
          } catch (e) { /* retry */ }
          if (++tries > 50) return reject(new Error('cdp not ready'));
          setTimeout(poll, 300);
        });
      }).on('error', () => {
        if (++tries > 50) return reject(new Error('cdp not ready'));
        setTimeout(poll, 300);
      });
    };
    poll();
  });
}

(async () => {
  const wsUrl = await getTarget();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pend = {};
  const errors = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params) => new Promise(res => {
    const i = ++id;
    pend[i] = res;
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      errors.push('EXC: ' + (d.text || '') + ' | ' + ((d.exception && d.exception.description) || '').slice(0, 400));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: TARGET });
  await sleep(7000);
  const res = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({rootLen:(document.getElementById("root")||{}).innerHTML?document.getElementById("root").innerHTML.length:0,rootText:(document.getElementById("root")||{}).innerText?document.getElementById("root").innerText.slice(0,160):"",errBound:!!document.querySelector(".failed-box"),landing:!!document.querySelector(".landing-hero")})',
    returnByValue: true
  });
  console.error('RESULT:', JSON.stringify(res.result && res.result.value));
  console.error('ERRORS(' + errors.length + '):');
  errors.slice(0, 20).forEach(e => console.error(e));
  chrome.kill();
  process.exit(0);
})().catch(e => { console.error('FATAL', e && e.message); chrome.kill(); process.exit(1); });
