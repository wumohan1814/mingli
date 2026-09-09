// REQ-084 辅助脚本：以 node child_process 方式拉起 headless Chrome（与 _tmp-cdp-verify.cjs 相同参数），
// 保持进程存活并打印 CDP 地址。用法：node frontend/scripts/_tmp-chrome-launch.cjs
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-lc-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9233',
  '--remote-allow-origins=*',
  '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1280,1024',
  'about:blank'
], { stdio: 'ignore' });
chrome.on('exit', code => { console.log('chrome exited', code); process.exit(0); });
console.log('launched chrome pid=' + chrome.pid);
setInterval(() => {}, 60000); // 保持事件循环存活
