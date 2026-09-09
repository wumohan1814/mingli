
    // REQ-098：注册最小 Service Worker（sw.js：仅 cache-as-you-go 缓存 /art /vendor /tarot /lenormand 图片；
    // /api、HTML/文档一律不缓存）。失败静默降级：不支持 / 非 HTTPS / 注册失败均不报错，退回纯网络态。
    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register('/sw.js').catch(function () { /* 静默 */ });
      } catch (err) { /* 静默 */ }
    }
  