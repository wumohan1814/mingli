// 命理 · 正文数据总表入口（节135 正文数据统一管理与 i18n 基础设施）
//
// 定位：所有面向用户的正文数据（卦辞、牌义、类型描述、签诗等）的唯一访问入口
// 与 ML_COPY 的关系：ML_COPY 管界面标签（ui.*），CONTENT 管正文内容（各领域模块）
//
// 结构：window.CONTENT = { tarot: { cards: [...] }, iChing: {...}, mbti: {...}, ... }
// 命名：CONTENT.<领域>.<条目>
//
// 语言切换（节135 阶段 F，已实现）：
//   - 默认中文：各领域 <领域>-zh.js 由 index.html 同步加载，属基础层，首屏即就绪
//   - 其他语言懒加载：setLang(lang) 按 MODULES 逐模块动态注入 <路径>-<lang>.js（script 标签）
//   - 语言文件约定：各语言文件自行给 CONTENT.<模块> 赋值（与既有 -zh.js 同构合并）
//   - 失败即回退中文：某模块语言文件 404/onerror 时保留既有（中文）数据，不清理 CONTENT
//   - 通知：全部模块落定后向 window 派发 'lang-change'（detail = { lang, failed: [...] }）
//   - 访问入口：window.ML_I18N = { setLang, getLang, onLangChange }（视图经此订阅/切换）

(function () {
  if (typeof window.CONTENT !== 'undefined') return; // 防止重复初始化
  window.CONTENT = {};

  // 节135：桥接早于本文件加载的既有数据文件（物理位置/文案轮次流程不变）
  // term-cards.js 在 index.html 中先于本文件（无 defer）立即执行，故此处反向挂载；
  // pairs.js 为 defer（解析后执行），由其文件末尾桥接自挂，这里仅作双保险。
  if (window.ML_TERM_CARDS) window.CONTENT.termCards = window.ML_TERM_CARDS;
  if (window.ML_PAIRS) window.CONTENT.pairs = window.ML_PAIRS;

  /* ==================== 节135 阶段 F：i18n 基础设施 ==================== */

  // 数据根目录：与 index.html 中 <script src="/data/content/..."> 的根绝对路径约定一致（BUG-009）
  var DATA_BASE = '/data';

  // 模块清单（硬编码）：module = CONTENT.<模块> 键名；path = 相对 DATA_BASE 的目录前缀。
  // 语言文件路径 = DATA_BASE + '/' + path + '-' + lang + '.js'
  //   例：{ module:'tarot', path:'content/tarot/cards' } → /data/content/tarot/cards-en.js
  // catalog：节140 功能目录事实源，含大量面向用户的标签文案（name/blurb/intent/tagMeta），
  //   纳入语言化使 explore / 意图推荐可随语言切换；zh 版仍由 index.html 同步加载 catalog.js，
  //   未来写 catalog-en.js（自赋值 CONTENT.catalog）即自动接入。若需目录恒为中文，删去该行即可。
  var MODULES = [
    { module: 'tarot',      path: 'content/tarot/cards' },
    { module: 'iChing',     path: 'content/i-ching/hexagrams' },
    { module: 'divination', path: 'content/divination/glossary' },
    { module: 'astrology',  path: 'content/astrology/names' },
    { module: 'basics',     path: 'content/basics/names' },
    { module: 'catalog',    path: 'content/catalog' }
  ];

  // 状态
  var currentLang = 'zh';  // 当前语言（默认中文，首屏同步加载，无需懒加载）
  var pending = {};        // pending[lang] = Promise：防止并发重复 setLang 同一语言
  var loaded = {};         // loaded[lang][module] = true：该语言该模块文件已成功加载过（缓存，跳过重复注入）

  /**
   * 切换语言：按需懒加载各模块的 <path>-<lang>.js，全部落定（成功或回退）后
   * 派发 window 上的 'lang-change' 事件并 resolve。
   * @param {string} lang  2-3 位小写字母语言代码（如 en/ja）
   * @returns {Promise<{lang:string, failed:string[]}>} failed = 加载失败（回退中文）的模块名
   */
  function setLang(lang) {
    // 防御：非法语言代码 → 拒绝切换
    if (typeof lang !== 'string' || !/^[a-z]{2,3}$/.test(lang)) {
      console.warn('[i18n] 非法语言代码：' + lang + '（应为 2-3 位小写字母，如 zh/en/ja），已拒绝切换。');
      return Promise.reject(new Error('非法语言代码：' + lang));
    }
    // 中文首屏已同步加载 → 当前即中文时直接回当前（不注入任何脚本）
    if (lang === 'zh' && currentLang === 'zh') {
      return Promise.resolve({ lang: 'zh', failed: [] });
    }
    // 防止并发重复 setLang 同一语言：复用进行中的 Promise
    if (pending[lang]) return pending[lang];

    // 切换到不同语言：目标语言文件会覆盖各模块数据，旧语言缓存整体失效
    if (lang !== currentLang) {
      for (var k in loaded) delete loaded[k];
    }

    // 只加载尚未成功加载过的模块文件（缓存标志：同一文件加载过即跳过）
    var remaining = MODULES.filter(function (m) {
      return !(loaded[lang] && loaded[lang][m.module]);
    });
    if (remaining.length === 0) {
      currentLang = lang;
      return Promise.resolve({ lang: lang, failed: [] });
    }

    currentLang = lang; // 乐观置为请求语言（failed 列表会告知视图哪些模块仍为中文）

    var p = Promise.all(remaining.map(function (m) {
      return loadModuleFile(m, lang).then(
        function () { return { module: m.module, ok: true }; },
        function () { return { module: m.module, ok: false }; }
      );
    })).then(function (results) {
      var failed = [];
      results.forEach(function (r) { if (!r.ok) failed.push(r.module); });
      // 全部模块落定（成功或失败回退）后派发 lang-change
      dispatchLangChange(lang, failed);
      return { lang: lang, failed: failed };
    });

    pending[lang] = p;
    p.then(function () { delete pending[lang]; }); // 无论成败都释放并发锁，允许后续重试失败模块
    return p;
  }

  // 动态注入单个模块的语言文件（script 标签，全局赋值脚本；onerror → 保留中文并记警告）
  function loadModuleFile(module, lang) {
    return new Promise(function (resolve, reject) {
      var src = DATA_BASE + '/' + module.path + '-' + lang + '.js';
      var el = document.createElement('script');
      el.async = true; // 各模块并行加载，互不阻塞
      el.onload = function () {
        if (!loaded[lang]) loaded[lang] = {};
        loaded[lang][module.module] = true; // 缓存标志：该文件已加载过
        resolve();
      };
      el.onerror = function () {
        // 加载失败（404 等）：不清除既有数据（中文），仅记警告并标记失败
        console.warn('[i18n] 模块 ' + module.module + ' 的语言文件加载失败（已保留中文）：' + src);
        reject(new Error('语言文件加载失败：' + src));
      };
      el.src = src;
      (document.head || document.documentElement).appendChild(el); // 附加到文档即触发加载
    });
  }

  // 向 window 派发 'lang-change' 事件（detail = { lang, failed }）
  function dispatchLangChange(lang, failed) {
    var detail = { lang: lang, failed: failed || [] };
    var evt;
    if (typeof window.CustomEvent === 'function') {
      evt = new window.CustomEvent('lang-change', { detail: detail });
    } else {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('lang-change', false, false, detail);
    }
    window.dispatchEvent(evt);
  }

  // 读当前语言（默认 'zh'）
  function getLang() {
    return currentLang;
  }

  // 订阅语言切换（轻量 helper，视图用）：cb(detail) 于每次 lang-change 时调用；
  // 返回取消订阅函数（React useEffect 里可直接作 cleanup）。
  function onLangChange(cb) {
    if (typeof cb !== 'function') return function () {};
    var handler = function (evt) { cb(evt.detail || {}); };
    window.addEventListener('lang-change', handler);
    return function () { window.removeEventListener('lang-change', handler); };
  }

  // 对外暴露：视图经 window.ML_I18N 访问（setLang/getLang/onLangChange）
  window.ML_I18N = { setLang: setLang, getLang: getLang, onLangChange: onLangChange };
})();
