#!/usr/bin/env node
/** REQ-128 阶段1 临时生成器（不提交）：由 index.html 提取的 UI_COPY 块 + 新增框架层组 → ui-copy.js */
import { readFileSync, writeFileSync } from 'node:fs';

const block = readFileSync('_ui_copy_block.txt', 'utf8');
// 去首行 'const UI_COPY = {' 与末尾 '};'（含尾部空行），整体 +2 缩进
const rawLines = block.split(/\r?\n/);
const bodyLines = rawLines.slice(1);
while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
if (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '};') bodyLines.pop();
const innerLines = bodyLines.map(l => '  ' + l);
// 原 UI_COPY 末尾组（namer）闭合 } 无尾逗号；现其后续接新增组，补一个逗号
const lastIdx = innerLines.length - 1;
if (innerLines[lastIdx].trim() === '}') innerLines[lastIdx] = innerLines[lastIdx] + ',';
const inner = innerLines.join('\n');

const HEADER = `/* ============================================================================
 * 太初 · 全站界面文案总表 TC_COPY（REQ-128 阶段1 建表）
 * ----------------------------------------------------------------------------
 * 来源：原 index.html 内联 UI_COPY（REQ-037/097 等批次，docs/exchange/文案管理方案.md L1
 *       方案），REQ-128 阶段1 迁入独立数据文件 + 补足框架层（落地/登录注册/三 Hub/
 *       Banner/菜单/页脚/通用）缺失 key。
 * 结构：window.TC_COPY = { ui: { <模块>: { <动作|状态>: 文案 } } }；key 规范见
 *       docs/standards/01-命名与变量约定.md §12 —— ui.<模块>.<动作|状态>，小写+连字符。
 *       既有 key（REQ-037 批次起）保持原 key 名与语义（index.html 内 UI_COPY 兼容别名
 *       依赖其不变）；阶段1 新增 key 一律小写+连字符。
 * 更新方式：文案轮次只改本文件；index.html 以 <script src="/data/ui-copy.js"> 引入
 *       （根绝对路径，置于 React 脚本前），不改动引入逻辑与组件接线。
 * 说明：正文类（牌义/卦辞/词条/配对文案）不入本表，走各自数据文件（pairs.js / term-cards.js）。
 */
window.TC_COPY = {
  ui: {
    /* ===== 既有 UI_COPY 全量（REQ-037/097 等批次；保持原 key 名与语义，供 UI_COPY 兼容别名）===== */
`;

const NEW_GROUPS = `
    /* ===== REQ-128 阶段1 新增：框架层界面字（命名小写+连字符，模块与页面 id 对齐）===== */
    agent: {
      name: '太初先生',
      talk: '对坐谈心',
      'chat-title': '找太初先生聊聊'
    },
    auth: {
      'phone-label': '手机号',
      'phone-placeholder': '请输入 11 位手机号',
      'password-label': '密码',
      'password-placeholder': '请输入密码（至少6位）',
      'confirm-label': '确认密码',
      'confirm-placeholder': '请再次输入密码',
      'captcha-label': '图形验证码',
      'captcha-placeholder': '请输入验证码',
      'captcha-fetch': '获取验证码',
      'captcha-refresh-tip': '看不清？点击图片刷新',
      'agree-prefix': '我已阅读并同意',
      'agree-agreement': '《用户协议》',
      'agree-and': '和',
      'agree-privacy': '《隐私政策》',
      'switch-to-register': '没有账号？去注册',
      'switch-to-login': '已有账号？去登录',
      'agree-required': '请先阅读并同意用户协议与隐私政策',
      'username-required': '请输入手机号（注册用户名）',
      'password-required': '请输入密码',
      'confirm-required': '请再次输入确认密码',
      'captcha-required': '请输入图形验证码',
      'phone-invalid': '请输入正确的 11 位手机号',
      'password-too-short': '密码至少需要 6 位',
      'password-mismatch': '两次输入的密码不一致',
      'captcha-expired': '验证码错误或已过期，请重新输入',
      'captcha-load-fail': '验证码加载失败，请点击重试',
      'register-ok': '注册成功，余额已到账',
      'gift-credit': '已赠送余额 ¥{amount}'
    },
    balance: {
      label: '余额',
      loading: '加载余额',
      insufficient: '余额不足',
      'view-detail': '查看余额明细',
      'insufficient-view-detail': '余额不足，点击查看余额明细',
      'view-detail-suffix': ' · 点击查看余额明细',
      'recharge-processing': '充值处理中，预计 1–5 分钟到账',
      'recharge-ok': '充值成功，余额已到账',
      'recharge-unavailable': '充值服务暂不可用，请稍后重试',
      'recharge-no-link': '未获取到充值链接，请稍后重试',
      'pay-hint': '按实际用量从余额扣除',
      'pay-insufficient': '余额不足，补足后可继续',
      'pay-badge': '¥ 消耗',
      'pay-badge-ok': '¥ 消耗：按实际用量从余额扣除',
      'pay-badge-warn': '¥ 消耗：余额不足'
    },
    footer: {
      'legal-agreement': '用户协议',
      'legal-privacy': '隐私政策',
      'legal-agreement-href': '/legal/用户协议.html',
      'legal-privacy-href': '/legal/隐私政策.html'
    },
    hub: {
      'guoxue-nine-name': '九法合一解读',
      'guoxue-nine-sub': '选择档案 · 跑九法或查看/修改解读（八字·紫微·西占·七政·奇门·五运六气等 9 法综合）',
      'guoxue-zodiac-name': '生肖流年',
      'guoxue-zodiac-sub': '犯太岁 · 值年星君 · 贵人',
      'guoxue-divination-name': '临时起卦',
      'guoxue-divination-sub': '六爻 · 梅花 · 小六壬 · 灵签 等，用已有档案起卦',
      'guoxue-almanac-name': '择日',
      'guoxue-almanac-sub': '黄历择日 · 宜忌/冲煞/逐时时课（免费确定性）',
      'guoxue-taiyi-name': '太乙神数',
      'guoxue-taiyi-sub': '年/月/日/时四计七十二局 · 主客定算（免费确定性）',
      'guoxue-huangji-name': '皇极经世',
      'guoxue-huangji-sub': '元会运世 · 值年/月经/旬纬/日卦/时经卦（免费确定性）',
      'guoxue-pair-name': '九法配对',
      'guoxue-pair-sub': '双人合盘 · 缘分与相处建议（付费 LLM，按实际用量扣余额）',
      'guoxue-bazi-name': '八字配对',
      'guoxue-bazi-sub': '双方八字排盘判相性（付费 LLM，按实际用量扣余额）',
      'guoxue-namer-name': '档案起名',
      'guoxue-namer-sub': '依档案八字五行喜用推荐名字（付费 LLM，按实际用量扣余额）',
      'xishi-astrology-name': '星座',
      'xishi-astrology-sub': '本命盘 · 行运 · 日返 · 次限',
      'xishi-tarot-name': '塔罗牌',
      'xishi-tarot-sub': '78 张 · 多牌阵 · 正逆位',
      'xishi-lenormand-name': '雷诺曼',
      'xishi-lenormand-sub': '36 张小牌 · 关键词组合',
      'xishi-more-name': '其他西式占卜',
      'xishi-more-sub': '敬请期待',
      'coming-soon-toast': '该模块敬请期待',
      'mbti-name': '人格测试',
      'mbti-sub': '16 型人格测评 · 60 题 · 判型结果写入档案'
    },
    menu: {
      'login-register': '登录 / 注册',
      open: '打开菜单',
      close: '关闭菜单',
      settings: '功能设置',
      cases: '档案管理'
    },
    nav: {
      module: '模块',
      'module-aria': '模块导航',
      'all-modules-aria': '全部模块',
      guoxue: '国学预测',
      xishi: '西式占卜',
      mbti: '心理测试',
      'item-nine-pick': '九法合一',
      'item-zodiac': '生肖流年',
      'item-divination': '临时起卦',
      'item-almanac': '择日',
      'item-taiyi': '太乙神数',
      'item-huangji': '皇极经世',
      'item-astrology': '星座',
      'item-tarot': '塔罗',
      'item-lenormand': '雷诺曼',
      'item-mbti': '人格测试'
    },
    skin: {
      guoxue: '国学',
      'xishi-astrology': '西式占星',
      tarot: '塔罗',
      aria: '文化皮肤切换',
      'unavailable-toast': '西式占星 / 塔罗暂未开放'
    }
  }
};
`;

const out = HEADER + inner + NEW_GROUPS;
writeFileSync('frontend/public/data/ui-copy.js', out, 'utf8');
console.log('written frontend/public/data/ui-copy.js, bytes =', Buffer.byteLength(out, 'utf8'));
