// 命理太初 · 正文数据总表入口（节135 正文数据统一管理与 i18n 基础设施）
//
// 定位：所有面向用户的正文数据（卦辞、牌义、类型描述、签诗等）的唯一访问入口
// 与 TC_COPY 的关系：TC_COPY 管界面标签（ui.*），CONTENT 管正文内容（各领域模块）
//
// 结构：window.CONTENT = { tarot: { cards: [...] }, iChing: {...}, mbti: {...}, ... }
// 命名：CONTENT.<领域>.<条目>
//
// 语言切换：阶段 F 实现；当前默认中文，数据文件同步加载
// 懒加载：阶段 F 实现；当前与 ui-copy.js 一同首屏加载（塔罗数据量小，可接受）

(function () {
  if (typeof window.CONTENT !== 'undefined') return; // 防止重复初始化
  window.CONTENT = {};

  // 节135：桥接早于本文件加载的既有数据文件（物理位置/文案轮次流程不变）
  // term-cards.js 在 index.html 中先于本文件（无 defer）立即执行，故此处反向挂载；
  // pairs.js 为 defer（解析后执行），由其文件末尾桥接自挂，这里仅作双保险。
  if (window.TC_TERM_CARDS) window.CONTENT.termCards = window.TC_TERM_CARDS;
  if (window.TC_PAIRS) window.CONTENT.pairs = window.TC_PAIRS;

  // 预留：语言状态
  // let currentLang = 'zh';

  // 预留：语言切换方法
  // function setLang(lang) { ... }

  // 预留：各模块注册方法（未来懒加载时用）
  // function registerModule(moduleName, lang, data) { ... }
})();
