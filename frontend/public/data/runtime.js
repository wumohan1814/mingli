/* ============================================================================
 * 命理 · 运行形态与能力读取入口 ML_RUNTIME（2026-09-22 用户拍板：同源构建地基）
 * ----------------------------------------------------------------------------
 * 定位：同一份前端代码要同时服务三种形态（web 自部署 / APK 单机 / APK 客户端），
 *       形态差异（有无账号 / 计费 / 分享 / 本机素材与 Prompt 管理 / 自填 LLM key）
 *       一律**只从本对象读**，不要在页面里散写形态判断 —— 与后端 app/runtime.py
 *       的 capabilities() 是同一张表的两个读端。
 * 取数：启动时 fetch('/api/runtime') 一次（服务器端权威答案，含 mode/capabilities/
 *       api_version/app_version；该接口无鉴权，故登录前就能读）。
 * 兜底（关键约束）：**取不到就按 web 全能力** —— 老部署没有这个接口、或断网、
 *       或 CDN 命中旧版静态资源时，行为必须与接口存在之前**完全一致**，不许因读
 *       不到而少渲染功能。
 * 用法：
 *     ML_RUNTIME.has('credits')          // 是否具备某能力（未登记的能力一律 false）
 *     ML_RUNTIME.ready.then(function (info) { ... })   // 想等权威答案时
 *     ML_RUNTIME.onReady(function (info) { ... })      // 同上（回调式）
 *     window.addEventListener('runtime-ready', function (e) { e.detail.mode })  // 事件式
 * 本次范围：只建立入口与读取，**不做 UI 条件化改造**（见 docs/standards/08）。
 * ============================================================================ */
(function () {
  if (typeof window.ML_RUNTIME !== 'undefined') return; // 防重复初始化

  var ENDPOINT = '/api/runtime';
  var TIMEOUT_MS = 3000;

  /* web 全能力兜底值：与 backend/app/runtime.py 的 web 形态取值**必须一致**
     （与界面文案无关，改后端那张表时这里要同步；08 号规范登记了这张矩阵）。 */
  var WEB_FULL = {
    auth: true,           // 账号体系
    credits: true,        // 积分与逐法扣费
    share: true,          // 档案/结果分享
    admin: true,          // 管理后台
    prompt_mgmt: true,    // Prompt 管理
    asset_mgmt: true,     // 素材管理
    byo_llm_key: false,   // 用户自填 LLM key（web 形态由服务端配置，不给用户入口）
    events_report: true,  // 埋点上报
    paipan_local: false   // 排盘引擎在本机
  };

  function copyOf(src) {
    var out = {};
    for (var k in src) { if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k]; }
    return out;
  }

  // 当前状态：先按兜底值就绪（页面可在 fetch 回来之前安全渲染）
  var state = {
    mode: 'web',
    capabilities: copyOf(WEB_FULL),
    source: 'fallback',   // fallback | server
    apiVersion: null,
    appVersion: null
  };
  var waiters = [];
  var settled = false;

  function snapshot() {
    return {
      mode: state.mode,
      capabilities: copyOf(state.capabilities),
      source: state.source,
      api_version: state.apiVersion,
      app_version: state.appVersion
    };
  }

  function publish() {
    var info = snapshot();
    var pending = waiters.slice();
    waiters.length = 0;
    for (var i = 0; i < pending.length; i++) {
      try { pending[i](info); } catch (e) { /* 单个回调出错不影响其它订阅者 */ }
    }
    try {
      window.dispatchEvent(new CustomEvent('runtime-ready', { detail: info }));
    } catch (e) { /* 老浏览器无 CustomEvent 构造器：事件通知是可选增强 */ }
  }

  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (settled) { cb(snapshot()); return; }
    waiters.push(cb);
  }

  function applyServerData(data) {
    if (!data || typeof data.mode !== 'string') return;
    state.mode = data.mode;
    if (data.capabilities && typeof data.capabilities === 'object') {
      // 只覆盖后端**明确给出**的键：后端新增能力而前端旧版不认识时不丢能力
      var caps = copyOf(state.capabilities);
      for (var k in data.capabilities) {
        if (Object.prototype.hasOwnProperty.call(data.capabilities, k)) caps[k] = !!data.capabilities[k];
      }
      state.capabilities = caps;
    }
    state.apiVersion = (typeof data.api_version === 'string') ? data.api_version : null;
    state.appVersion = (typeof data.app_version === 'string') ? data.app_version : null;
    state.source = 'server';
  }

  var ready;
  if (typeof window.fetch !== 'function' || typeof window.Promise !== 'function') {
    // 无 fetch 的运行环境（极老内核）：直接用兜底值，绝不因此报错
    settled = true;
    ready = window.Promise ? window.Promise.resolve(snapshot()) : null;
  } else {
    var timer = null;
    var ctl = (typeof window.AbortController === 'function') ? new window.AbortController() : null;
    ready = new window.Promise(function (resolve) {
      timer = window.setTimeout(function () {
        if (ctl) { try { ctl.abort(); } catch (e) { /* 已结束 */ } }
        resolve(snapshot());   // 超时 → 兜底
      }, TIMEOUT_MS);
      var opts = { headers: { Accept: 'application/json' }, cache: 'no-store' };
      if (ctl) opts.signal = ctl.signal;
      window.fetch(ENDPOINT, opts).then(function (resp) {
        if (!resp || !resp.ok) throw new Error('runtime endpoint not ok');
        return resp.json();
      }).then(function (payload) {
        applyServerData(payload && payload.data ? payload.data : null);
      }).catch(function () {
        // 静默降级到兜底值（老部署 / 断网 / 接口暂不可用）；只留一条调试痕迹
        if (window.console && window.console.warn) {
          window.console.warn('[ML_RUNTIME] /api/runtime 不可用，按 web 全能力兜底');
        }
      }).then(function () {
        window.clearTimeout(timer);
        settled = true;
        publish();
        resolve(snapshot());
      });
    });
  }

  window.ML_RUNTIME = {
    endpoint: ENDPOINT,
    ready: ready,
    onReady: onReady,
    /** 是否具备某能力；**未登记的能力一律 false**（防未登记功能被误判为可用）。 */
    has: function (cap) {
      return state.capabilities[cap] === true;
    },
    /** 当前快照（浅拷贝，随便改不影响内部状态）。 */
    snapshot: snapshot,
    // 兼容直读写法（等价于 snapshot().mode）
    get mode() { return state.mode; },
    get source() { return state.source; },
    get capabilities() { return copyOf(state.capabilities); }
  };

  if (settled) publish();   // 无 fetch 环境：立即以兜底值就绪
})();
