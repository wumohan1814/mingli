/* =====================================================================
 * sw.js — 太初最小 Service Worker（REQ-098 PWA，代码占位版）
 *
 * 只做两件事：
 *   1. cache-as-you-go：运行时把「本项目静态图片」按需写入 CacheStorage；
 *   2. 命中时 cache-first 返回 + 后台静默更新；失败优雅降级回网络。
 *
 * ── 缓存边界（必须与 Caddy / Starlette 静态层互不冲突，见文件末说明）──
 *   ① 只缓存图片：GET + 同源 + URL 命中素材根 /art/ /vendor/ /tarot/ /lenormand/
 *     且响应 Content-Type 为 image/*（或扩展名为图片）。不缓存 HTML/文档——
 *     导航（navigate/document）一律放行；SPA fallback 对缺失文件回吐的
 *     index.html（text/html）也不会被误写（有 Content-Type 校验兜底）。
 *   ② 绝不缓存 /api/：凡 URL 含 /api/（任意位置）直接 return，不 respondWith、
 *     不写缓存 → 纯网络透传，接口永远走服务端最新数据。
 *   ③ 遵循根绝对路径（BUG-009）：素材引用在运行期都是 /art/... 等根绝对 URL，
 *     故这里按 pathname 前缀匹配即可；同源限定避免误抓外域图。
 *   （注：仓库里塔罗/雷诺曼卡面实体在 public 根的 /tarot/ 与 /lenormand/，
 *    代码内以 ./tarot/... 相对引用 → 运行期 URL 为 /tarot/...，故素材根须含
 *    /tarot/ /lenormand/；/vendor/ 目前只有 JS，保留为将来 vendor 图片占位。）
 *
 * ── 策略 ──
 *   cache-first + 后台更新：命中即回缓存，同时后台静默拉一次网络成功后覆盖
 *   （带 6h/URL 节流）；未命中走网络，成功后顺手写入。不追求全量离线预缓存。
 *
 * ── 容量 ──
 *   上限 MAX_BYTES（50MB），超出按 LRU（最久未用）淘汰最旧的条目直到达标；
 *   LRU 账本（URL→字节 + 最近访问序）持久化在独立 meta cache，SW 重启不丢。
 *   字节数优先取 Content-Length，缺失时按扩展名估算（账本级近似）。
 *
 * ── 降级 ──
 *   任何内部异常（Cache API 不可用、配额满、离线…）一律吞掉并回退 fetch：
 *   有 SW 没 SW 页面行为一致，绝不 throw、绝不阻塞页面。
 *
 * 发版提示：素材内容有变时递增 CACHE_VERSION，activate 会自动清掉旧版本缓存。
 * ===================================================================== */
'use strict';

const CACHE_PREFIX = 'taichu-img-';
const CACHE_VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;        // 图片缓存本体
const META_CACHE_NAME = 'taichu-img-meta-v1';           // LRU 账本独立缓存
const META_KEY = '/__taichu_sw_meta__';                 // 账本条目 key（绝对路径，不会与真实素材冲突）

const MAX_BYTES = 50 * 1024 * 1024;                     // 容量上限 50MB
const REFRESH_MIN_MS = 6 * 60 * 60 * 1000;              // 同 URL 后台更新节流：≥6h 一次

/** 本项目静态素材根（根绝对路径，BUG-009）。 */
const ASSET_ROOTS = ['/art/', '/vendor/', '/tarot/', '/lenormand/'];

/** 图片扩展名判定（thumb/卡面/背景/图标/sprites 均为 png|webp|jpg|gif|svg 等） */
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:[?#]|$)/i;

/** 无 Content-Length 时的字节估算表（仅作 LRU 账本近似，不影响响应正确性） */
const EST_BYTES = {
  png: 200 * 1024, webp: 120 * 1024, jpg: 180 * 1024, jpeg: 180 * 1024,
  gif: 200 * 1024, svg: 40 * 1024, avif: 100 * 1024, bmp: 300 * 1024,
  ico: 20 * 1024, default: 150 * 1024
};

/* ============================ LRU 账本 ============================ */

/** 账本文档结构：{ total, order: [url 最新在前], size: {url:bytes}, lastRef: {url:ts} } */
let meta = null;
let metaLoading = null;

async function loadMeta() {
  if (meta) return meta;
  if (!metaLoading) {
    metaLoading = (async () => {
      try {
        const c = await caches.open(META_CACHE_NAME);
        const hit = await c.match(META_KEY);
        const doc = hit ? await hit.json() : null;
        meta = (doc && doc.v === 1 && Array.isArray(doc.order) && doc.size)
          ? doc
          : { v: 1, total: 0, order: [], size: {}, lastRef: {} };
      } catch (err) {
        meta = { v: 1, total: 0, order: [], size: {}, lastRef: {} };
      }
      return meta;
    })();
  }
  return metaLoading;
}

function persistMeta() {
  return caches.open(META_CACHE_NAME).then(c =>
    c.put(META_KEY, new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json' }
    }))
  );
}

/* fetch 事件并发到达时，账本写操作串行化，避免 total/order 竞争错乱 */
let chain = Promise.resolve();
function enqueue(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

/** 把 url 挪到「最近使用」队首 */
function touchUrl(url) {
  const i = meta.order.indexOf(url);
  if (i > 0) meta.order.splice(i, 1);
  if (i !== 0) meta.order.unshift(url);
}

/** 入账一次缓存写入（含覆盖更新），超出上限即 LRU 淘汰 */
function accountStore(url, bytes) {
  return enqueue(async () => {
    await loadMeta();
    const prev = meta.size[url] || 0;
    meta.total = meta.total - prev + bytes;
    meta.size[url] = bytes;
    meta.lastRef[url] = Date.now();
    touchUrl(url);
    await evictIfOver();
    await persistMeta();
  });
}

/** 容量超限：从最久未用（队尾）逐个删除直到 ≤ MAX_BYTES */
async function evictIfOver() {
  if (meta.total <= MAX_BYTES) return;
  const c = await caches.open(CACHE_NAME);
  while (meta.total > MAX_BYTES && meta.order.length > 0) {
    const oldest = meta.order.pop();
    const b = meta.size[oldest] || 0;
    delete meta.size[oldest];
    delete meta.lastRef[oldest];
    meta.total = Math.max(0, meta.total - b);
    try { await c.delete(oldest); } catch (err) { /* 尽力淘汰，失败继续 */ }
  }
}

/** 命中缓存时刷新 LRU 最近使用序（不触发网络） */
function bumpRecency(url) {
  return enqueue(async () => {
    await loadMeta();
    if (meta.size[url] === undefined) return; // 账本里没有 → 不扰动
    touchUrl(url);
    await persistMeta();
  });
}

/** 响应字节数：Content-Length 优先，缺失按扩展名估算 */
function bytesOf(res, url) {
  const cl = res.headers.get('content-length');
  if (cl && /^\d+$/.test(cl)) return parseInt(cl, 10);
  const m = url.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
  return EST_BYTES[(m && m[1]) || 'default'] || EST_BYTES.default;
}

/** 是否真·图片响应（防 SPA fallback 的 text/html 混入缓存） */
function isImageResponse(res, url) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.indexOf('image/') === 0) return true;
  if (ct && ct !== 'application/octet-stream') return false; // html/json/... 一律不缓存
  return IMAGE_EXT_RE.test(url);                              // 无/通用类型时按扩展名兜底
}

/* ============================ 生命周期 ============================ */

self.addEventListener('install', () => {
  // 不做预缓存；skipWaiting 让新版尽快接管（配合 activate 清旧缓存）
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      const stale = k !== CACHE_NAME && k !== META_CACHE_NAME &&
        (k.indexOf(CACHE_PREFIX) === 0 || k.indexOf('taichu-img-meta-') === 0);
      return stale ? caches.delete(k) : null;
    }));
    await self.clients.claim();
  })().catch(() => { /* 清理失败静默 */ }));
});

/* ============================ fetch 拦截 ============================ */

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;  // 只处理同源根绝对素材

  const path = url.pathname;

  // 铁律①：/api/ 永不缓存 —— 直接透传网络，不 respondWith、不写缓存
  if (path.indexOf('/api/') !== -1) return;
  // 铁律②：不缓存 HTML/文档 —— 导航与 document 目标一律走网络
  if (req.mode === 'navigate' || req.destination === 'document') return;

  // 只关心素材根下的图片请求（dest=image 或路径本身是图片扩展名，如 SVG sprite）
  const inRoots = ASSET_ROOTS.some((r) => path.indexOf(r) === 0);
  if (!inRoots) return;
  if (req.destination !== 'image' && !IMAGE_EXT_RE.test(path)) return;

  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);

      if (hit) {
        // cache-first：立即返回；后台静默更新 LRU + 网络刷新（失败不阻塞本次）
        event.waitUntil(bumpRecency(url.href).catch(() => {}));
        event.waitUntil(refreshInBackground(req, url.href).catch(() => {}));
        return hit;
      }

      // 未命中：网络优先，成功后顺手入缓存（cache-as-you-go）
      const res = await fetch(req);
      if (res && res.ok && isImageResponse(res, url.href)) {
        const clone = res.clone();
        event.waitUntil((async () => {
          try {
            await cache.put(req, clone);
            await accountStore(url.href, bytesOf(res, url.href));
          } catch (err) { /* 配额满 / Cache API 不可用：静默，本响应已正常返回 */ }
        })());
      }
      return res;
    } catch (err) {
      // 任何缓存层异常 → 回退纯网络；网络也失败则按浏览器默认错误处理（不伪造响应）
      try { return await fetch(req); } catch (err2) { return Response.error(); }
    }
  })());
});

/** 后台更新：节流内直接跳过；到期则拉网络、校验图片后覆盖缓存并重记账。失败保留旧缓存。 */
async function refreshInBackground(req, urlHref) {
  let due = false;
  await enqueue(async () => {
    await loadMeta();
    const now = Date.now();
    if (now - (meta.lastRef[urlHref] || 0) >= REFRESH_MIN_MS) {
      meta.lastRef[urlHref] = now;
      await persistMeta();
      due = true;
    }
  });
  if (!due) return;

  const res = await fetch(req);
  if (!res || !res.ok || !isImageResponse(res, urlHref)) return;
  const cache = await caches.open(CACHE_NAME);
  const clone = res.clone();
  await cache.put(req, clone);
  await accountStore(urlHref, bytesOf(res, urlHref));
}

/* =====================================================================
 * SW 与 Caddy / 静态缓存头互不冲突的原因
 * ---------------------------------------------------------------------
 * · Caddyfile 只做反向代理（taichu.xyz → web:8000），静态资源由后端
 *   SPAStaticFiles(../frontend/public) 提供，二者都没有给图片/HTML 设
 *   强缓存头；SW 处于最前端（同源 fetch 先过 SW），因此不存在「HTTP 缓存
 *   头 vs SW」的优先级打架。
 * · SW 只认 /art/ /vendor/ /tarot/ /lenormand/ 下的同源图片 GET：这些是
 *   仓库内静态素材（塔罗/雷诺曼卡面、thumb、卡背/六爻/ssgw 背景、生肖
 *   sprite、PWA 图标等），内容发布后不变或极少变，cache-first 安全。
 * · index.html / 各分享直达虚拟路由（文档/navigate）从不进 SW —— 后端
 *   SPA fallback、html=True 目录索引照旧工作，SW 不覆盖任何 HTML 语义。
 * · /api/ 从不进 SW —— 鉴权、计费、数据请求永远直连服务端；SW 缓存失效
 *   不会造成任何接口「脏数据」。
 * · 未来若给静态资源加 Caddy 缓存头（如 immutable 长缓存），对图片仍与
 *   SW 兼容：SW 命中时不再发请求；未命中时浏览器 HTTP 缓存先兜底再回源，
 *   两者同一份内容，互不冲突。切记 HTML 永不设长缓存，否则发版不生效。
 * ===================================================================== */
