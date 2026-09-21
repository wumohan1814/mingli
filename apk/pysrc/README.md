# apk/pysrc —— 「去 Node」路线的 Python 侧（Chaquopy）

本目录是**契约入口**，由三个模块构成；MainActivity / sync 脚本 / build.gradle.kts 由其他子代理负责，
这里只固定「它们需要知道的约定」。

```
apk/pysrc/
├─ apk_server.py      # 自举 HTTP 服务（纯标准库，无 FastAPI/pydantic）
├─ paipan_bridge.py   # Python → Java(PaipanBridge) → WebView(V8) → JS 内核
└─ README.md          # 本文件
```

---

## 1. MainActivity 需要知道的三件事

### 1.1 启动服务（**必须在后台线程**）

```kotlin
// Chaquopy: Python.start(AndroidPlatform(this)) 之后
Thread {
    val py = Python.getInstance()
    py.getModule("apk_server").callAttr("main")   // 等价于 from apk_server import main; main()
}.start()
```

* `main(port=None, host=None, web_root=None)` **阻塞**在 `serve_forever()`，所以只能在线程里调。
* 需要自己管生命周期时用 `start_background()`（返回 `(server, thread)`）或 `create_server()`（不阻塞）。
* **不要在 Python 里 `new Activity`**（简报 §2.6：会炸 `Looper.prepare()`/主线程断言）；
  本服务一个 Activity 都不需要，静态资源从文件系统读。

### 1.2 判就绪

```
GET http://127.0.0.1:8765/api/health      # 200 + {"ok": true, ...}；health.bridge.ready 表示 JS 内核就绪
GET http://127.0.0.1:8765/api/paipan/ping # 真实排盘自检；整链通 → 200，反之为 503 + 明确错误 JSON
```

推荐判据：**端口能连 + `/api/health` 返回 200** 即「Python 侧起来了」；
要确认「JS 内核也通了」再看 `health.bridge.ready` 或 `/api/paipan/ping`。

### 1.3 WebView 指向

```
http://127.0.0.1:8765/            # 静态前端（web_root 的 index.html）
http://127.0.0.1:8765/api/paipan/ziwei   # POST，body = 原 Node 形态的 payload
```

Android 9+ 明文放行：`127.0.0.1` 属 loopback，仍需网络安全性配置允许 cleartext
（`usesCleartextTraffic` 或 `network_security_config` 里给 `127.0.0.1` 开域），**这是 manifest 侧的事**。

---

## 2. 静态资源约定（**sync 脚本请看这条**）

| 项 | 约定 |
|---|---|
| 仓库内源目录 | `apk/app/src/main/assets/web/`（由 frontend 构建产物拷入，**不由本子代理维护**） |
| 运行时目录 | **`<filesDir>/web`** —— 即 `os.environ["HOME"] + "/web"`（Chaquopy 里 `HOME` = 应用私有目录） |
| 覆盖方式 | 环境变量 `MINGLI_WEB_ROOT`，或 `main(web_root=...)` |
| 目录结构 | 完全自由；只要求根目录有 `index.html`（没有也能跑，但 `/` 会返回一个 JSON 目录清单） |

sync 脚本要做的事：把 `assets/web/**` 递归拷到 `context.filesDir/web/**`（首次启动或版本变更时）。
**不要**指望服务去读 assets —— Python 侧读 assets 需要额外的 Java 反射，本阶段刻意不做。

URL 直接映射文件路径：`/` → `index.html`、`/js/app.js` → `<web_root>/js/app.js`。
缺失文件一律 **404**（不是 500）；路径越界（`..`/绝对路径注入）**403**。

---

## 3. 排盘 API（与 `backend/paipan-node/server.mjs` 同路径同语义）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/paipan/ziwei` | 紫微斗数。body：`{"birthday":"1990-05-12","time_idx":7,"gender":"男"}` |
| POST | `/api/paipan/extra` | 占星/七政/五运六气/奇门终身局。body：`{year,month,day,hour,minute,birthplace,longitude,latitude,true_solar,gender}` |
| POST | `/api/paipan/zodiac` | 生肖流年。body：`{"zodiac":"鼠","year":2026}` |
| POST | `/api/paipan/tarot` | 塔罗。body：`{"spreadType":"single","options":{"seed":123}}` |
| POST | `/api/paipan/astrology` | 星盘。body：`{year,month,day,hour,minute,longitude,latitude,scope,dateStr}` |
| POST | `/api/paipan/divination` | 起卦（method ∈ liuyao/meihua/xiaoliuren/liuren/jinkoujue/qimen/almanac/taiyi/huangji/ssgw/shengbei/lenormand） |
| GET | `/api/health` | 就绪探针（恒 200） |
| GET | `/api/paipan/ping` | 真实排盘自检（200 / 503） |
| GET | `/api/paipan/routes` | 路由清单 + 桥状态 |

这 6 条 POST 路径就是 bundle 的 `dispatch()` 支持的全部路径（覆盖 `server.mjs` 的 6 条路由，**无遗漏**）。
错误仍是 `{"error": "...", "status": N}` 形状（与 `server.mjs` 的 `sendError` 同形，多一个 `status`）。

---

## 4. bundle 契约（构建脚本 `apk/tools/build-paipan-bundle.mjs` 产出）

| 项 | 值 |
|---|---|
| 产物 | `apk/app/src/main/assets/paipan/paipan-bundle.js`（**生成物，不入库**） |
| 形态 | esbuild IIFE（非 ESM）、`platform: "browser"`、零 Node 内置、无 `require()` |
| 入口 | `globalThis.__MINGLI_PAIPAN` |
| API | `dispatch(path, payloadJson) -> jsonString`（**同步**；错误也返回 JSON）<br>`setTimezoneOffsetMinutes(minutes)`（默认 480 = Asia/Shanghai）<br>`getTimezoneOffsetMinutes()` / `isTimezoneOverrideInstalled()` / `routes` / `version` |
| 生成 | `cd apk && npm install && node tools/build-paipan-bundle.mjs` |

> ⚠️ **交付给 `.gitignore` 的负责人**：`apk/app/src/main/assets/paipan/paipan-bundle.js` 是生成物（约 2.5MB），
> 不入库；当前根 `.gitignore` **尚未覆盖**该路径（`app/src/main/python`、`app/src/main/assets/web` 已覆盖）。
> 建议加一行：`apk/app/src/main/assets/paipan/`。

`setTimezoneOffsetMinutes(480)` 由 `PaipanBridge.init()` 在注入 bundle 后自动调用；
`dispatch()` 首次调用也会自动安装时区覆盖（双保险，不依赖 init 时序）。

---

## 5. `paipan_bridge` 用法

```python
import paipan_bridge

paipan_bridge.init()                                     # 幂等；非 APK 环境返回 False，不抛异常
data = paipan_bridge.call("/ziwei", {"birthday": "1990-05-12", "time_idx": 7, "gender": "男"})
if "error" in data:
    ...                                                  # 降级
```

* `call(path, payload: dict, timeout_ms=60000) -> dict`：**json 进 json 出**；
  超时/初始化失败/JS 异常一律是 `{"error": "...", "detail": "..."}`，**不会向上抛**。
* 本模块可在**非 Chaquopy** 环境安全 import；真正调用时才给 `RuntimeError("仅在 APK 内可用")`。
* 依赖 Kotlin 侧 `PaipanBridge` 的 `@JvmStatic`（Kotlin `object` 的方法默认不是 Java 静态方法，
  Python 用 `jclass(...)` 只能调静态方法）。同时加了 `@JvmOverloads`，Python 才能只传 2 个参数。

---

## 6. 本机（无 APK）能验证到什么

```bash
python -m py_compile paipan_bridge.py apk_server.py         # 语法
python -c "import paipan_bridge as b; print(b.is_available(), b.call('/ziwei', {}))"   # 非 APK 的降级路径
python apk_server.py                                        # 只起静态 + health（bridge 恒 unavailable）
```

`/api/paipan/*` 在本机一定是 503（没有 Java/WebView）——这是**预期行为**，不是 bug。
真正的整链验证只能在真机/模拟器上跑 `/api/paipan/ping`。
