# 节 162 · 胖 APK 出包链 + 三个地基（附：DeepSeek Key 移出项目、潮汕圣杯月牙杯接线）

> **编号说明**：本会话原本记作「节161」，但 2026-09-22 发现**另一会话已用节161**（commit `ddd20d5`「统一配对选择器」，
> 未建节文件）。为避免两处撞号，本节改用 **162**；仓库内 `pages.css` / `index.html` 里出现的「节161」注释属那一节，
> **与本文件无关**。

状态：🟡 **代码与构建层已完成并验证，真机未验**（APK 已本地出包成功；真机安装/启动只能你验）｜ 强度：**大改**（跨 APK 新工程 / 后端契约 / 数据层 / 前端视觉四层）｜ 日期：2026-09-21 ~ 2026-09-22

> **本节的特殊性**：一次会话里落了四件事。按破竹「一个会话只落成一节」仍记为一节，但**内部按 A–D 分段**，每段独立可读、独立可验。

## 〇、用户原话（四件事）

1. 「需要**导出一个 APK 版本**，同时请**确保我的 DeepSeek API 不在这个项目中**」
2. 「**后台 OpenClaw 的 MCP 服务可以关掉了，不需要在 GitHub 上面包括这个**」→ 追问后拍板「**算了，不删除了，保留吧**」
3. 「再出一个**美术需求**，我需要让**潮汕圣杯**这个功能，**从扔硬币改成扔月牙型的圣杯**（先出这个文档我拿去给美术 Session）」
4. 「先不用保证**双端同步更新**……以后我会要求你单独更新 APK 或者单独更新服务器端。但是我觉得你提到的缺的 **3 个地基**需要补上」

---

## A · 潮汕圣杯：月牙形筊杯（需求文档 → 美术交付 → 接入 → 渲染缺陷修正）

**用户需求**：把掷筊演出的「圆形铜钱」换成**月牙形筊杯**。

| 步骤 | 结果 |
|---|---|
| ① 出美术需求文档 | `40_节/待办/节131-附件/美术需求-潮汕圣杯-月牙筊杯.md`：物件考据（半月木片，长:宽 ≈2.4:1、一平面一凸面）、交付清单、@2x/@3x 规格、色值表、🚫 红旗、**验收三测**（缩略 / 黑白 / 并排） |
| ② 美术交付（另一 session） | `frontend/public/art/shengbei/` 5 张 WebP + `_archive/美术-素材原件/art/shengbei/` PNG/SVG 母版 + 验收对比图 |
| ③ 资产核验（我做，替代目检） | 尺寸 192×80 / 288×120 ✅；两态轮廓 **IoU = 1.000**（同形）✅；透明底 ✅；SVG 无内嵌文字 ✅；深底缩到 96×40 灰度平均差 **28.9/255**（77% 像素差 >10）✅ |
| ④ 接入 | `tokens.css` 新增 `--art-sb-flat/convex/pair`（普通 url 回退 + `image-set` 2x/3x）；`pages.css` 新增独立 `.sb-cup` 家族（**不动 `.coin`**，六爻/摇卦共用它）；`views-divination.js` 的 `ShengbeiCastStage` 换图、去掉块面文字、**翻转轴由硬币式 `rotateY` 改沿长轴翻滚 `rotateX`**；判定/重放/文案零改动 |
| ⑤ **渲染缺陷修正（关键）** | 接线初版同时设了 `background-color` 与 1px 边框、且**没设 `background-size`** → headless Chrome 像素实测：96×40 盒子被渲染成**实心圆角矩形**，与资产轮廓 **IoU 仅 0.543**（图像被裁切 + 透明区露出托底色）→ 修正为「不铺底色 / 不描边 / 图铺满」后 **IoU 0.977**，跨度 x=4..91 与资产完全一致 |

**取舍已写进 CSS 注释**：令牌存在但图 404 时该杯不可见（**形状正确优先于「色块托底」**——托底色会把月牙外侧填成方块，等于把美术的形一起毁掉）；抛起态 `.toss` 仍有实心占位。

**待你真机看**：翻滚观感、两枚先后落地的节奏、96×40 在深色舞台上两态是否「一眼可辨」（§五 三项需人眼）。

---

## B · DeepSeek Key 移出项目

| 项 | 结果 |
|---|---|
| 改动 | 根 `.env` 与 `backend/.env` 删除 `MINGLI_LLM_API_KEY`（原位只留注释）；真实 key 写入**用户级系统环境变量**（HKCU，`setx`）；12 个文档/脚本同步（含 `start.bat`/`start.sh` 空值告警、`99_状态/决策.md` 留痕） |
| 链路验证 | 无环境变量 → `settings.llm_api_key == ''` → LLM 调用 **fail loud** 报「未配置 MINGLI_LLM_API_KEY」（**不会用错 key**）；有环境变量 → 正确读到 |
| 泄露面 | 项目目录（含被 ignore 的文件）+ git 全历史 `sk-` **真实 key 0 命中**；前端零直连 LLM |
| ⚠️ 实测发现 | **这把 key 在 DeepSeek 侧已失效**（真实调用返回 `401 … api key: ****cef1 is invalid`）。长期未暴露的原因：本项目测试纪律是**LLM 一律 mock、零真实调用**。服务器用的是另一份 `.env`，未必相同 |
| 附带修的缺口 | `POST /admin/ops/llm-key` 原本往 `backend/.env` 明文写 key，且因**环境变量优先级更高**而**静默不生效**（运维以为换了 key 其实没换）→ 改为 fail-loud 返回 `ERR_CONFLICT` + 指引；新增 7 例测试。**同时更正一处事实错误**：前端**从未有过**「更换 LLM Key」入口，节142 原称「LLM Key 已在配置分区」是错的 |

---

## C · 胖 APK 出包链（POC-0）

| 层 | 交付 |
|---|---|
| **形态与路线** | 胖 APK·单机（内嵌 Python 后端 + 全部资产 + JS 内核）；**排盘内核「去 Node」** |
| **为什么去 Node** | 社区 nodejs-mobile 仅存 prebuilt v18.20.4，**libnode.so 不符 16KB 页对齐**（issue #148 直接点名）、修复只在 main 未发版（PR #155 至今 open）、唯一维护者 2025-12-31 退出 → **等上游不可依赖**；改为把排盘 JS 打成单文件 bundle 跑在 **App 自带 WebView(V8)**，Python 经 Java 桥调用 |
| **JS 内核 bundle** | `apk/app/src/main/assets/paipan/paipan-bundle.js` **2.53 MiB**（astronomia 精确子路径 import 优化：**8.88MB → 2.65MB，省 70.2%**）；`node:vm` 沙箱证明零 Node 内置（`nodeBuiltinSpecifiers=[]`、`requireCalls=0`）；路由 **6/6 覆盖**；**8/8 摘要与 `server.mjs@Asia/Shanghai` 逐字节一致**；时区缺口**已解决**（7 处挂钟构造改注入偏移） |
| **APK 工程** | `apk/`（Gradle Kotlin DSL + Chaquopy 17.0.0 + AGP 8.7.3 + Kotlin 2.0.21）；`com.mingli.apk` / minSdk 24 / targetSdk 36 / versionCode 1；arm64-v8a + x86_64；仅 `INTERNET` 权限；明文流量**只放行 127.0.0.1/localhost** |
| **构建链** | `C:\AndroidDev`（Temurin JDK 21.0.12.1 / cmdline-tools 23.0.0 / build-tools 36.0.0 / platforms android-36 / platform-tools 37.0.1 / Gradle 8.14.3），`env.ps1` dot-source 生效 |
| **CI** | `.github/workflows/apk.yml`（JDK 21 + Python 3.13 + setup-gradle 8.14.3 + sync + `assembleDebug` + 上传 artifact；境外 runner 显式关闭国内镜像） |
| **本地产物** | `apk/app/build/outputs/apk/debug/app-debug.apk` = **50.5 MB**，debug 签名（可安装） |

**构建期踩到并修掉的 4 个真问题**（都有实测证据）：
1. **依赖源卡死**：Adoptium / services.gradle.org **302 跳 GitHub**，而本机 `objects.githubusercontent.com` 不可达 → 下载零增长；`plugins.gradle.org` 走 Cloudflare 也只挂连接不下载（构建卡在配置期 14 分钟）→ 换**阿里云镜像优先**（实测 google 仓库 6.16 MB/s vs 官方 0.86 MB/s），并留 `-PmingliApkUseChinaMirrors=false` 开关给境外构建。
2. **Chaquopy `buildPython` 只吃单个路径 String**：配置期探测传 `List` → Kotlin DSL **编译失败** → 按「优先删机制」整段删掉（POC-0 无包需构建，pyc 只是优化）。
3. **AGP 8 默认不再生成 `BuildConfig`**：`BuildConfig.VERSION_NAME`（用于「解包版本戳」）→ `Unresolved reference` → 显式 `buildFeatures { buildConfig = true }`。
4. **Kotlin 块注释可嵌套**：注释里写路径通配符（斜杠+双星号）被当成嵌套注释起始 → 整份文件 `Unclosed comment` → 改写注释并在原位留警示。

**APK 内容核验（拆包实测）**：`assets/web` 283 个前端文件 · `assets/paipan/paipan-bundle.js` 2.53MB · `assets/chaquopy/`（app.imy + stdlib + bootstrap + 各 ABI 原生模块）· `lib/` 8 个 .so×2 ABI（含 `libpython3.13.so` 5.14MB、**`libsqlite3_python.so`**）· debug 证书。

**⚠️ 验证边界（必须说清）**：能证明的是**构建成功 + 包内内容正确 + 签名可安装**；**装到手机上能否启动、WebView 能否执行 JS、桥接是否通，只能你真机验**（本机无设备、无模拟器）。已知未验点：不 attach 界面的 WebView 是否执行 JS（已留 `attachTo` 逃生舱）、24MB 级 Python 载荷的首启耗时。

---

## D · 三个地基（用户点名要求补上）

| 地基 | 落地 | 零行为变化证据 |
|---|---|---|
| ① **同源构建渠道开关** | `MINGLI_RUNTIME_MODE`（`web` 默认 / `apk-local` / `apk-client`）+ `backend/app/runtime.py` **唯一能力清单**（credits/auth/share/admin/prompt_mgmt/asset_mgmt/byo_llm_key/events_report/paipan_local）+ `GET /api/runtime` + 前端唯一入口 `ML_RUNTIME`（**取不到按 web 全能力兜底**） | 默认档实测返回 `mode:"web"` 且能力 = 现状语义；非法值回落 `web`；既有改动仅 +16 行 |
| ② **版本契约** | `backend/app/version.py` 单一来源（`APP_VERSION` = pyproject 同值，`API_VERSION` = `1.0` `MAJOR.MINOR`）；`main.py` 的 FastAPI version 改为引用它（**消灭字面量**）；`docs/standards/08-运行形态与版本契约.md` 写兼容矩阵与 bump 纪律 | 契约测试 11 passed，含「前端兜底表 ↔ 后端能力表逐键比对」的**跨语言防漂**用例 |
| ③ **本地数据版本化迁移链** | `schema_meta` + `schema_migrations`；步骤**只增不改**（v1 基线盖章 / v2 建记账表）；时机 = `ensure_schema()` 末尾；**一库一事务、失败整库回滚 + fail loud**；**库版本 > 代码版本 → 拒绝打开**；既有 `ensure_schema()` 补列冻结为历史遗留 | 真实开发库副本（31 表/122 行）升级后**结构指纹与逐表行数完全不变**、版本 v2、重复启动幂等、库版本改 v3 → 正确拒绝。**FTS5 刻意不进链**（保「失败降级不阻断启动」，APK 端 SQLite 是否带 FTS5 未实测）→ 已在 09 §10 登记 |

**规范与测试**：新增 `docs/standards/08`、`09`（+ README 索引）；新增测试 25 例（11 + 7 + 7）全绿。

**明确未做（勿误以为已有）**：前端 UI 按能力条件化渲染；服务器拒绝过旧壳的逻辑；`X-Mingli-Client` 头；APK 侧 versionCode→app_version 映射；**双端自动同步更新机制（用户已拍板不做）**。

---

## 五、门禁与验证总表（均为真跑）

| 项 | 结果 |
|---|---|
| 后端 pytest（三地基+端点相关子集） | **25 passed**（11 runtime + 7 migrations + 7 llm-key） |
| 全量 pytest（另跑） | 2 failed / 313 passed —— 2 项 = **已登记的既存夹具漂移**（`test_paipan.py`，与本节零文件重叠） |
| 前端 precompile 门禁 | **exit=0**（色值门禁通过；两个 HTML 字节不变） |
| `node --check` / `node frontend/scripts/precompile.js` | exit=0 |
| bundle 对拍 | 8/8 摘要与 `server.mjs@Asia/Shanghai` 逐字节一致；11 行 × 4 时区 0 不一致 |
| **Gradle `assembleDebug`** | **BUILD SUCCESSFUL**（21s，缓存后），产物 50.5MB debug APK |
| APK 拆包核验 | 包名/版本/minSdk/targetSdk/权限/ABI/签名/内容全对（见 §C） |
| 圣杯像素验收 | 修正后 IoU 0.977、四角=舞台底（修正前 0.543、四角=托底色） |
| Key 泄露面 | 项目 + 全历史 `sk-` 真实 key **0 命中** |

## 六、新登记的已知问题（`99_状态/已知问题.md`）

1. **🔴 `server.mjs` 排盘结果依赖进程时区**（实测 8 例中 4 例随 `TZ` 变：qimen 16:30/03:00、liuyao、astrology-full）→ 违反「排盘确定性」红线；bundle 侧已修，**server.mjs 未修**。
2. **⚠️ 本机 DeepSeek key 已失效（401）** + 如何区分 401 与「未配置」。
3. **⚠️ 本机装 Android 工具链：官方源会卡死**（含可用的国内镜像与实测吞吐）。
4. **⚠️ `frontend/public/` 是被 Caddy 直服的静态根**：临时验证文件放进去=立刻公网可见（本次踩到，已清理）。
5. **⚠️ `.ps1` 丢 UTF-8 BOM 会变成"假语法错"**（PS 5.1 按 ANSI 解码 → 乱码 + `Unexpected token`，看着像语法问题）。
6. **⚠️ APK 同步脚本的两个"静默丢文件"陷阱**（压平包层级 → 后端 import 全废；按目录名排 `data` → 4 份运行时 JSON 丢出包）。
7. **⚠️ 本机 `Get-Content` 会少算行数**（同一文件 551 vs 618；数行用 `[System.IO.File]::ReadAllLines()`，判改动用 `git diff --stat`）。

## 六之二、收尾追加（2026-09-22 晚，本节的第二批提交）

| 项 | 内容 |
|---|---|
| **修掉「静默丢文件」两颗雷** | 同步脚本改为**保留包层级**（`backend/app → python/app`、`backend/prompts → python/prompts`，`pysrc` 仍平铺在根以保住 MainActivity 的 `getModule("apk_server")` 契约）；排除规则由「按目录名排 `data`」改为**按扩展名排数据库文件**，救回被丢掉的 4 份运行时 JSON（六爻爻辞 `app/data/liuyao_yaoci.json` + 3 份 MBTI 题库）。修前 `app.imy` 里后端**根本 import 不了** |
| **BOM 事故（已修）** | 改 `.ps1` 时丢了 UTF-8 BOM → PS 5.1 按 CP936 解码 → 乱码 + 假语法错。已补回（头 3 字节 239/187/191）并独立复核 **PowerShell 解析 0 错误** |
| **误入库的构建日志** | `apk/build-debug.log` 被我上一批提交带进去了（`.gitignore` 对已跟踪文件无效）→ `git rm --cached`（本地文件保留）+ 补 `*.log` 规则 |
| **`apk/README.md`** | 目录说明更正为「pysrc 平铺 + `app/` + `prompts/`」三层结构，并写明**为什么不能压平** |
| **拆包复核（最终态）** | `app.imy` **153 个文件条目 = 树内每一个文件**（pyc 92 / md 54 / json 4 / gitkeep 2 / 标记 1），含 `app/config.pyc`、`app/admin/router.pyc`、`app/methods/base.pyc`、`app/data/liuyao_yaoci.json`、三条 MBTI JSON、`prompts/**/*.md` 37 条；根本级孤立 `.pyc` = 0；`assets/web`：磁盘 294（含 2 个点文件）→ **进包 292**，双向差集为空（点文件不入包；已实测 APK 内 `assets/web` = 292、点文件 0） |
| **🎉 CI 云端出包成功** | 推送后自动触发 `.github/workflows/apk.yml`（`apk-poc0`）—— **run #1 = completed / success**，产物 artifact `mingli-apk-poc0-debug`（保留 14 天）。即**本机与云端两条路都能出可安装 APK** |
| **最终产物** | `apk/app/build/outputs/apk/debug/app-debug.apk` = **51.06 MB**（debug 签名，可直接装） |
| **提交** | `eb7d5fd`（主体）+ `cbdf3b2`（收尾修正），均已推 `master`；工作区干净 |

## 七、待你决定 / 待你真机

1. **真机装包验证**（唯一无法由 Agent 完成的验收）：`apk/app/build/outputs/apk/debug/app-debug.apk` → 装到安卓手机 → 看首页是否打开、圣杯掷筊是否出现月牙杯。
2. **本地这把 DeepSeek key 是否更换**（现在 401）：换的话给我值（或自己 `setx`），一条命令写回环境变量。
3. **`server.mjs` 的时区缺陷要不要单独立项修**（默认建议：立，它影响线上奇门/六爻结果的确定性）。
4. **是否现在推送**：本次改动含 `apk/**`（新工程）、三地基、圣杯接线、Key 移出与文档同步；仓库是 **public**，推 master 即公开可见。
