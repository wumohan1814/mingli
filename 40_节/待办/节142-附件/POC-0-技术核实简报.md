# 节142 · POC-0 技术核实简报（联网 + 本地静态）

> 定位：为「胖 APK 单机版 + GitHub Actions 云端出包」路线补齐 §9.6 待拍板项的**外部事实**。
> 方法：只读公开发布页 / 官方文档 / 公开 issue；对 `backend/paipan-node` 做本地静态核实（不读 node_modules 之外的上游私有仓）。
> 纪律声明：**未访问任何 mingyu 上游仓库内容**；未下载大文件（未下载任何 .whl/.so/zip 成品）。
> 证据标注：`✅已核实`（附链接） / `🔬本地静态`（本仓文件） / `🧠推论`（无直接证据，标注为待验证）。
>
> **本轮核实的环境限制（影响可信度的地方，逐条明示）**：
> 1. `developer.android.com` / `developer.android.google.cn` 在本环境**抓取失败**（多次 `fetch failed`，正文亦为 JS 渲染）→ **Android 官方页原话未能取得**；该条的结论已改用**官方页锚点 + termux/nodejs-mobile 多个独立来源交叉印证**（见 §2.5 末），并在文中标注证据强度。
> 2. GitHub **API 未认证额度在本轮后段用尽**（60 次/小时，返回 403 rate limit）→ 依赖 GitHub API 的部分（Chaquopy 仓库目录、issue 评论、nodejs-mobile issue/PR）已在前段完成，**后续如再需 GitHub 证据须换 IP/加 token**（这也是"零 Node 依赖"只能做到"已安装发行树全目录扫描"而非上游全仓穷尽证明的原因之一）。
> 3. `github.com` 的 HTML 页面在本环境不可抓（`fetch failed`），故 GitHub 证据统一走 **api.github.com / raw.githubusercontent.com**；StackOverflow 页面同样 403，改用 **StackExchange API** 取正文。
> 4. **未下载任何二进制成品**（.whl / .so / .zip），所以「实包体积」「自编后 libnode.so 的实际对齐」「wheel 在 16KB 真机的加载」这三类仍只能待真机/CI 实测；但**"nodejs-mobile 官方 prebuilt 不对齐"这一条已由 issue #148 的报错原文直接证实**，不再是推测。


---

## 一、结论速览表

| # | 核实项 | 结论 | 档位 | 关键证据 |
|---|---|---|---|---|
| 1 | **Chaquopy 授权（§9.6-1）** | **完全免费、无任何许可限制**：12.0.1 起开源（MIT），官方明确"all license restrictions have been removed"。**不需要 license key、不需要注册、不要求应用开源、可商用、可闭源**。Prosperity Public License 3.0（source-available）**落在免费档**；"付费档"自 2022 年起已不存在 | ✅ 结案 | [License 页](https://chaquo.com/chaquopy/license/)、[Changelog 12.0.1](https://chaquo.com/chaquopy/doc/current/changelog.html)、[MIT LICENSE.txt](https://github.com/chaquo/chaquopy/blob/master/LICENSE.txt) |
| 2 | Chaquopy 17 版本能力 | Python **3.10–3.14**（默认 3.10，推荐 3.13）；AGP **7.3–9.2**；minSdk **≥24**；`abiFilters` 必填；Python 3.12+ **仅 64 位** | ✅ | [versions.html](https://chaquo.com/chaquopy/doc/current/versions.html)、[android.html](https://chaquo.com/chaquopy/doc/current/android.html) |
| 3 | **pydantic-core（v2）**（§9.2 最高风险） | **Chaquopy 官方仓无 wheel、无 recipe**；官方立场仍是"**建议降到 pydantic v1**"。但 **2025-10 已有公开成功案例**：用 Python 3.13 + `rust` recipe + `PYO3_CROSS_LIB_DIR` 指向 Chaquopy 预编译 Python，**编译出 pydantic-core 2.41.4 并跑通 pydantic v2**；维护者给出了正确做法（改 `get_rust_env_vars`）。→ **可解，但属于"自建 wheel"工作量，不是开箱可用** | ⚠️ 可解但需自建 | [issue #1017（主干讨论）](https://github.com/chaquo/chaquopy/issues/1017)、[#1326](https://github.com/chaquo/chaquopy/issues/1326)、[#1390](https://github.com/chaquo/chaquopy/issues/1390) |
| 4 | cryptography | ✅ 官方 Android wheel **有**：`cryptography-42.0.8-1-cp313-cp313-android_24_arm64_v8a.whl`（2026-07-07 重建，含 Rust 16KB 对齐修复）。**仅 42.0.8 一个版本可用** | ✅（限版本） | [wheel 目录](https://chaquo.com/pypi-13.1/cryptography/)、[#1171 末条评论](https://github.com/chaquo/chaquopy/issues/1171) |
| 5 | pillow | ⚠️ 有 cp313 arm64 wheel（11.0.0，2024-10-16），但依赖 `chaquopy-freetype`，而后者**最后构建于 2022-10-03（16KB 之前）**；维护者明确把 "`pillow` requiring `chaquopy-freetype`" 列为 16KB 设备不兼容案例 | ⚠️ 16KB 真机存疑 | [pillow wheel](https://chaquo.com/pypi-13.1/pillow/)、[chaquopy-freetype wheel](https://chaquo.com/pypi-13.1/chaquopy-freetype/)、[#1171 末条评论](https://github.com/chaquo/chaquopy/issues/1171) |
| 6 | greenlet | 有 cp313 arm64 wheel（3.1.1-0，2024-10-22，属 16KB 改造后的重建批）；本仓同步 Session、缺失不致命 | ⚠️ 低风险 | [greenlet wheel](https://chaquo.com/pypi-13.1/greenlet/) |
| 7 | uvicorn[standard] extra | 🔴 **`uvloop` / `httptools` 在 Chaquopy 仓不存在（HTTP 404）** → `uvicorn[standard]` 装不上，必须**纯 uvicorn + asyncio loop**（与本仓 §9.2「打包用纯 uvicorn」判断一致） | ✅ 已证伪 extra | [uvloop/ 404](https://chaquo.com/pypi-13.1/uvloop/)、[httptools/ 404](https://chaquo.com/pypi-13.1/httptools/) |
| 8 | **Node 运行时**（§9.6-2，最大架构决策） | **双结论**：① 运行方式上，**JNI 内嵌 libnode.so（不是 exec 二进制）** → **天然规避 Android W^X/exec 限制**（推翻题面前提；且 Termux 二进制路线已确认为四重阻塞）；② 但**官方 prebuilt 明确不是 16KB 对齐**（issue #148 直接点名 `lib/arm64-v8a/libnode.so`"LOAD segments not aligned at 16 KB boundaries"），16KB 修复只进了 main（PR #154，2025-11-13，`-Wl,-z,max-page-size=16384`），**发版 PR #155 至今 open**、唯一维护者 2025-12-31 公开退出 → **"等官方发 16KB 版"不可依赖**；第三方 prebuilt（heylogin Node 24.5.0 / mustang Node 22.9.0）均为 prerelease 且未声明对齐 | 🔴 16KB 硬刺；JNI 形态本身 OK | [issue #148](https://github.com/nodejs-mobile/nodejs-mobile/issues/148)、[PR #154](https://github.com/nodejs-mobile/nodejs-mobile/pull/154)、[PR #155](https://github.com/nodejs-mobile/nodejs-mobile/pull/155)、[fork release v18.20.4](https://github.com/nodejs-mobile/nodejs-mobile/releases/tag/v18.20.4) |
| 9 | **引擎能否 bundle（去掉 Node 依赖）** | 🔬 本仓实测：`paipan-core/src` **零 node 内置模块引用**；`lunar-typescript` 零；`astronomia` 仅 `vsop87` 一处用 fs/path 且根入口不导出它 → 打 ESM bundle **无需任何 Node shim**。**厂商级旁证**：iztro 作者自己就发布 UMD 单文件 `dist/iztro.min.js`（787KB）。**两个坑**：① `astronomia/data/index.js` 会一次性带进**全部 8.9MB 数据表**（本仓只用 8 个 `vsop87B*` = **1.72MB**）→ 改精确子路径 import 可省 **≈7.2MB**；② iztro 是 CJS + import JSON，rollup 要 `@rollup/plugin-json`。**真正需要 Node 的只有外壳**：`server.mjs`(`node:http`/`createRequire`/`node:crypto`)、`extra.mjs`(`node:fs`)、iztro 紫微 | ✅ 结论翻转性发现 | 本仓 `backend/paipan-node/**`（见 §三.3）；[iztro UMD](https://registry.npmjs.org/iztro/latest) |
| 10 | **CI 可行性** | ubuntu-latest 现役镜像自带：**JDK 17（默认）/21/25、Python 3.13.15、Rust 1.98.1、Gradle 9.7.1、Android SDK 37、NDK 27.3（默认）/28.2/29.0**；Chaquopy 只需 Maven Central + chaquo.com/pypi-13.1 + PyPI 三个出口，**无需任何 license 环境变量**；构建缓存目录 `$HOME/.cache/chaquopy` | ✅ 可行 | [Ubuntu 24.04 镜像清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)、[NDK 27 成为默认（2026-01-12）](https://github.com/actions/runner-images/issues/13467)、[#1221 缓存](https://github.com/chaquo/chaquopy/issues/1221) |
| 11 | 16KB 页 + 单 ABI | Chaquopy 17.0 **本体**已支持 16KB；**大量既有 wheel 仍会在 16KB 设备上 dlopen 失败**，故官方推荐 **Python 3.13+**。单 `arm64-v8a` 完全支持（3.12+ 本就只支持 64 位）；Chaquopy 官方明确 **APK splits / App Bundle 对体积帮助不大**，要用 product flavor | ⚠️ 需真机 | [Changelog 17.0](https://chaquo.com/chaquopy/doc/current/changelog.html)、[#1171](https://github.com/chaquo/chaquopy/issues/1171)、[faq-size](https://chaquo.com/chaquopy/doc/current/faq.html) |
| 12 | **exec 限制 / 替代引擎** | **exec 路线直接放弃**：targetSdk≥29 起 @私有目录被平台硬禁（W^X，SELinux `app_data_file`）；**唯一可 exec 位置 = `/data/app/*/lib`（nativeLibraryDir，`apk_data_file`）且需 `extractNativeLibs="true"` + `lib*.so` 命名**，有 2025-06 Android 16/Pixel 8a 实测记录；**Termux 二进制=四重阻塞**（链接器 `/lib` 缺失、`$PREFIX` 不可迁移、SELinux、W^X）。**替代引擎**：LiquidCore 🔴 已死（npm 0.7.10=2020-06-21；**JitPack 0.7.x 构建全 Error，实际上限 0.6.2**；Node 10 基准）；**QuickJS 官方明说"unlikely QuickJS will ever support the Intl APIs"**（但本仓核心不用 Intl → 可行，须宿主注入时区）；**Hermes 的 Intl 借平台 ICU4J、结果随 Android 版本漂移**（对"结果一致"是隐患）；自编上游 node 能成但上游仍在修（[#65771](https://github.com/nodejs/node/issues/65771) 及 4 个 PR 全 open），优点是能带 ICU | ✅ 结论明确 | [SO 64786837](https://stackoverflow.com/questions/64786837/what-path-to-put-executable-to-run-on-android-29)、[termux#2155](https://github.com/termux/termux-app/issues/2155)、[termux#5185](https://github.com/termux/termux-app/issues/5185)、[quickjs-ng es_features](https://raw.githubusercontent.com/quickjs-ng/quickjs/master/docs/docs/es_features.md)、[Hermes IntlAPIs.md](https://raw.githubusercontent.com/facebook/hermes/blob/static_h/doc/IntlAPIs.md) |
| 13 | 附带发现：设备时区可能影响排盘 | 🔬 `paipan-core/src` 有**恰好 2 处**用本地时区构造 `new Date(y,m,d,h,mi,s)`（`qimen/index.js:155`、`qimen-lifetime/index.js:171`），与 `jieQiTable` 比较判定"当前节气"。若两端不同源，**换设备时区/换无 tzdata 引擎会改变奇门结果** → 与验收原则 ①「三形态排盘结果一致」直接冲突。**建议加 `TZ=UTC` vs `TZ=Asia/Shanghai` 对拍用例** | ⚠️ 需一条低成本测试 | 本仓行号见左 |

**一句话**：**Chaquopy 授权这一项可以直接结案——免费、无约束、不需要任何 key**；**真正的架构级风险已锁定为一件事：Node 运行时没有可用的 16KB 合规产物，而唯一维护者已公开退出**（所以要么自编 libnode 并长期维护交叉编译链，要么按本轮已证实的"bundle 方案"把 Node 缩到薄层甚至去掉）；**pydantic-core 是第二风险，但路径已知、有成功案例，属于"照做即可"**；**exec 路线直接放弃**（@私有目录被 W^X 硬禁 + Termux 四重阻塞 + nodejs-mobile 本就是 JNI 形态）。**CI 侧可行**，只需在 workflow 里固化"Python 3.13 + 显式 NDK 版本 + 去掉 `uvicorn[standard]` + 不加 license 变量"四件事。

---

## 二、逐项证据与链接

### 2.1 Chaquopy 授权（§9.6 第 1 项）

**官方 License 页原话**（https://chaquo.com/chaquopy/license/ ）：

> "Since version 12.0.1, Chaquopy is now **free and open-source, and all license restrictions have been removed**. Please upgrade to the current version by editing the Chaquopy version number in your app's top-level build.gradle file."
>
> "The open-source builds are released on **Maven Central**, so there's no longer any need to list the chaquo.com Maven repository in your settings.gradle or build.gradle file."
>
> "**Closed-source Chaquopy versions (12.0.0 and older)** will display a license warning on startup, and will only run for 5 minutes at a time. To remove these restrictions, add the following line to your project's `local.properties` file: `chaquopy.license=free`"

**Free license 页原话**（https://chaquo.com/chaquopy/free-license/ ）：

> "Chaquopy is now free and open-source, and all license restrictions have been removed."

**Changelog 佐证**（https://chaquo.com/chaquopy/doc/current/changelog.html ）：

> "**12.0.1 (2022-07-24)** — First open-source release. Apart from removing the license restrictions, this is identical to version 12.0.0."

**LICENSE 文件**（GitHub API `/repos/chaquo/chaquopy/license` 返回 `spdx_id: MIT`）：

> "Copyright (c) 2017-2025 Chaquopy Ltd and contributors — Permission is hereby granted, free of charge, to any person obtaining a copy of this software … without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software …"
> 链接：https://github.com/chaquo/chaquopy/blob/master/LICENSE.txt

**对本项目的直接结论**：

1. 17.0 属于开源线（>12.0.1），**不存在 license key / 注册 / 环境变量**；`chaquopy.license=free` 只对 ≤12.0.0 的闭源版有意义，与我方无关。
2. 官方**没有任何"你的应用必须开源"的条件**——免费是给所有人的，含商业闭源。
3. 因此 **Prosperity Public License 3.0 这一点不构成问题**：该协议管的是"我方代码怎么发布"，与 Chaquopy 的授权互不牵连。**§9.6 第 1 项可标记为"已核实·免费用"**。
4. 🧠 但引出**一个新的合规待办（非本轮待拍板项）**：MIT 要求"在软件的所有副本或实质性部分中保留版权声明与许可声明"。胖 APK 会**内嵌 Chaquopy 的 Java 运行时 + Python 解释器 + 一批 wheel**，因此需要
   - 仓库根 `NOTICE` / `THIRD-PARTY-NOTICES`；
   - App 内"开源许可"页（AndroidX 有现成 `oss-licenses` 方案，但 Chaquopy 的 Python 侧 wheel 需自己列）。
   连带清单（🧠推论，待逐项确认）：CPython（PSF License）、OpenSSL（Apache-2.0）、SQLite（Public Domain）、**certifi（MPL-2.0，Chaquopy 明确内嵌 certifi 2025.8.3 的 CA bundle）**、各 wheel 自身许可证。**建议在正式立项节里单列一条"第三方许可证台账"。**

### 2.2 Python 版本 / AGP / minSdk / ABI

- 版本矩阵（https://chaquo.com/chaquopy/doc/current/versions.html ）：**Chaquopy 17.0 → Python 3.10–3.14，AGP 7.3–9.2，min API 24**。
- 17.0.0 发布于 **2025-12-01**；运行时不小于 3.10.19 / 3.11.14 / 3.12.12 / 3.13.9 / 3.14.0；**默认 Python 为 3.10**，`version = "3.13"` 需显式设置。
- 16KB 相关官方原文（Changelog 17.0.0）：

  > "Devices with 16 KB pages are now supported by Chaquopy itself. **However, many existing Android wheels will still fail to load on 16 KB devices. For best compatibility with these devices, use Python 3.13 or later.**"

- `abiFilters` 必填，且 **Python 3.12+ 仅支持 64 位（arm64-v8a / x86_64）**；`buildPython`（构建机 Python）**必须与应用 Python 大版本+小版本一致**（17.0 起强制）——CI 上要用 `actions/setup-python` 装 3.13。
- 体积（faq-size）："Each ABI will add several MB to the size of the app, plus the size of any native requirements"，并明确 **APK splits 与 App Bundle 对 Chaquopy 帮助不大**，建议用 product flavor 控制 ABI。
- 标准库限制（android.html）：`multiprocessing` 多数 API 不可用（**多进程不行，多线程/async 可以**，见 §1390 维护者回复）；`crypt`/`grp`/`nis`/`spwd`/`curses`/`readline`/`tkinter` 不支持；`ssl` 用内嵌 certifi **不用系统 CA**；`sys.stdout/stderr` 重定向到 Logcat；写文件必须用 `os.environ["HOME"]`。

### 2.3 pydantic-core（§9.2 最高风险项）——完整脉络

| 时间 | 事件 | 出处 |
|---|---|---|
| 2023-11 | issue #1017 开：pydantic v2 需要 Rust 原生 `pydantic-core`，Chaquopy 无 wheel | [#1017](https://github.com/chaquo/chaquopy/issues/1017) |
| 2024-06-03 | 维护者 mhsmith 给出官方 workaround：`install("pydantic<2")` | [#1017 comment](https://github.com/chaquo/chaquopy/issues/1017#issuecomment-2144089380) |
| 2025-01-13 | 维护者："**As far as I know, nobody has made any further progress on this package.**" + 建议点 👍 而不要灌水 | [#1017 comment](https://github.com/chaquo/chaquopy/issues/1017#issuecomment-2587689461) |
| 2025-01-24 | #1326：有人尝试用 jiter 0.8.0 补丁路线编译 pydantic-core，未成功 | [#1326](https://github.com/chaquo/chaquopy/issues/1326) |
| 2025-07-02 | 维护者："> I don't think anyone ever said they got a `pydantic-core` v2 wheel." | [#1326 comment](https://github.com/chaquo/chaquopy/issues/1326#issuecomment-3029110891) |
| **2025-10-17** | **pax0r 报告成功**：`meta.yaml` 写 `package: pydantic-core 2.41.4` + `requirements.build: [rust]`，并"download precompiled Python from `com.chaquo.python/python/3.13.8` … `export PYO3_CROSS_LIB_DIR=<...>/prefix/`"，**"Build came without problems and I have run console app with Pydantic v2."**（仅差写 PR） | [#1017 comment](https://github.com/chaquo/chaquopy/issues/1017#issuecomment-3417125596) |
| **2025-10-19** | 维护者给出**正确落地方式**：`build-wheel.py` 用的 Maven 包格式与 PyO3 期望不同，但 `extract_target` 已把它整理成标准布局，**可以改 `get_rust_env_vars` 把 `PYO3_CROSS_LIB_DIR` 指过去**；另需 stdlib（同一 Maven 目录下的 `stdlib`） | [#1017 comment](https://github.com/chaquo/chaquopy/issues/1017#issuecomment-3419593446) |

**当前状态判定（本轮核实）**：
- Chaquopy 官方仓 `server/pypi/packages/` 下 **有** `cryptography` / `pillow` / `greenlet` 的 recipe，**没有** `pydantic-core` 目录（GitHub API `/contents/server/pypi/packages/pydantic-core` → **404**；`/cryptography`、`/pillow`、`/greenlet` → 200）。
- 因此 **pydantic-core 至今没有官方 Android wheel**，仍须自建。
- **但"自建可行"已不再是推测**：有第三方公开成功案例 + 维护者给出的官方路径；17.0 的 changelog 还专门改进了"wheel 中捆绑非 Python 库"的兼容性（[#728](https://github.com/chaquo/chaquopy/issues/728) / [#892](https://github.com/chaquo/chaquopy/issues/892) / [#1383](https://github.com/chaquo/chaquopy/issues/1383)），且 Chaquopy 已支持 **AGP 9.x + Python 3.14**。
- 第三方捷径 **不可用**：`Eutalix/android-pydantic-core` 有 cp313 aarch64 wheel，但平台标签是 **`linux_aarch64`（Termux 目标）**、"Built with NDK r25b"、"Includes RPATH fix for **Termux library location**、Linked with `--no-as-needed` to ensure libpython loading" → **与 Chaquopy 的 `android_24_arm64_v8a` 标签和 libpython 链接方式不兼容，不能直接拿来用**（[release 页](https://github.com/Eutalix/android-pydantic-core/releases)）。

**降级到 pydantic v1 的真实代价（🔬本仓静态核实）**：
`backend/pyproject.toml` 声明 `pydantic>=2.0.0`，代码里实际用到 v2-only API：

| 文件 | v2-only 用法 |
|---|---|
| `backend/app/config.py` | `pydantic_settings.BaseSettings`、`model_config = {...}`、`field_validator("jwt_secret")` |
| `backend/app/api/settings.py` | `field_validator` |
| `backend/app/api/cases.py` | `field_validator` ×2、`req.model_dump(exclude=...)` |
| `backend/app/api/case_share.py` | `body.model_dump(exclude=...)` |
| 其余 ~10 个 router | `from pydantic import BaseModel, Field`（v1/v2 通用，无需改） |

→ **降级不是"改个版本号"**：要改 `field_validator→validator`、`model_dump→dict`、`model_config→class Config`、`pydantic-settings` v2 的替代（pydantic-settings 2.x 本身是按 v2 写的，v1 环境要么回退到 `pydantic.BaseSettings`，要么自己读 .env），**并且要确认现役 FastAPI 版本对 pydantic v1 的支持是否还在**（🧠 待核实：FastAPI 近年持续弱化 v1 兼容）。
→ **建议翻转 §9.6 第 6 项的默认值**：默认应是「**自建 pydantic-core wheel**」，把「降级 pydantic v1」从"默认兜底"降为"最后手段"。

### 2.4 其余依赖（对照 §9.2 风险矩阵）

- **cryptography**：官方仓有 recipe（[`server/pypi/packages/cryptography`](https://github.com/chaquo/chaquopy/tree/master/server/pypi/packages/cryptography)）；wheel 目录只有 **42.0.8** 系列，其中 `cryptography-42.0.8-1-cp313-cp313-android_24_arm64_v8a.whl` **最后一次构建 2026-07-07**（正是 Rust wheel 16KB 对齐修复 PR [#1456](https://github.com/chaquo/chaquopy/pull/1456) 落地后）。维护者在 #1171 里把 cryptography 从"16KB 不兼容"名单中**划掉**并注明 "Fixed for Python 3.13"。→ ✅ **pin cryptography==42.0.8 可用**。
- **pillow**：wheel 目录最新是 `pillow-11.0.0-0-cp313-cp313-android_24_arm64_v8a.whl`（2024-10-16）。但维护者在 #1171 末条明确列出 16KB 设备仍不兼容的类别，原文：

  > "some Python 3.13 packages are also incompatible with 16 KB devices, including: Anything that requires non-Python library wheels which haven't yet been rebuilt, such as `numpy` requiring `chaquopy-openblas`, or **`pillow` requiring `chaquopy-freetype`**. Anything based on CMake which was built before 2025-11-24."

  而 `chaquopy-freetype` 的 wheel 目录**最后一个文件是 2022-10-03**（[链接](https://chaquo.com/pypi-13.1/chaquopy-freetype/)）→ **pillow 在 16KB 设备上有明确失败风险**。建议：验证码模块改纯 Python/SVG 生成（§9.2 已有候选），或自建 pillow+freetype。
- **greenlet**：`greenlet-3.1.1-0-cp313-cp313-android_24_arm64_v8a.whl`（2024-10-22）。该批次是维护者确认"已用新 libc++ 重建并通过全部 C++ 包测试"的一批（[#1171 comment](https://github.com/chaquo/chaquopy/issues/1171#issuecomment-2430247901)）；本仓同步 Session 不依赖 greenlet，缺失不致命。
- **退役项**：`passlib` / `bcrypt` / `apscheduler` / `alembic` 运行时不 import（§9.2 已判），可从 APK 依赖里剥离。
- **🔴 新发现的坑：`uvicorn[standard]` 装不上。** `uvloop/` 与 `httptools/` 在 Chaquopy wheel 仓均 **HTTP 404**（[uvloop](https://chaquo.com/pypi-13.1/uvloop/)、[httptools](https://chaquo.com/pypi-13.1/httptools/)），且 17.0 起 pip 强制 `--only-binary`（不再从 PyPI 装 sdist，见 Changelog 17.0.0 Deprecations）。→ APK 侧必须 **`uvicorn`（纯 Python）+ `--loop asyncio`**，并把 `[standard]` 从依赖里去掉。

### 2.5 Node 运行时（§9.6 第 2 项）

**版本寿命（GitHub API 实抓）**

| 仓库 | 状态 | 最后 push | 最新 release | 里面的 Node | prebuilt 产物 |
|---|---|---|---|---|---|
| `JaneaSystems/nodejs-mobile` | 未归档但**事实停更**（174 open issues） | **2021-10-27** | **nodejs-mobile-v0.3.3（2021-08-16）** | **Node 12.19.0**（v8 7.8、napi 7） | `nodejs-mobile-v0.3.3-android.zip`（含 armeabi-v7a/x86/arm64-v8a/x86_64 .so） |
| `nodejs-mobile/nodejs-mobile`（社区 fork） | **存活**（46 open issues，`main` 分支） | **2026-04-30** | **v18.20.4（2024-10-07）** | **Node 18.20.4**（v8 10.2、**napi 9**、uv 1.44.2、openssl 3.0.13+quic） | `nodejs-mobile-v18.20.4-android.zip`（**57MB，下载 25,679 次**）：armeabi-v7a / arm64-v8a / x86_64 |

- 链接：[fork 仓库](https://github.com/nodejs-mobile/nodejs-mobile)、[fork release v18.20.4](https://github.com/nodejs-mobile/nodejs-mobile/releases/tag/v18.20.4)、[Janea 仓库](https://github.com/JaneaSystems/nodejs-mobile)、[Janea release v0.3.3](https://github.com/JaneaSystems/nodejs-mobile/releases/tag/nodejs-mobile-v0.3.3)。
- **Node 18.20.4 覆盖本仓需求**：`node:http`（createServer）、`node:module`（createRequire）、`node:crypto`（randomInt）、ESM `import`——全部在 Node 18 稳定支持（本仓 `server.mjs` 的用法见 §三.3）。**注意：Node 18 已进入 EOL（维护期），这是"长期维护风险"而非"现在不能跑"。**
- **🔬 本仓语法/API 兼容性扫描（对着 Node 18.20.4 = V8 10.2 逐条比对）**：全树扫描未发现 Node 20+/21+ 才有的 API——**无 `Object.groupBy` / `Map.groupBy` / `toSorted` / `toReversed` / `Array.fromAsync` / `Promise.withResolvers` / `import ... with { type: "json" }`（import attributes）/ `??=`**；命中的只有 `structuredClone`（Node 17+ ✅，且仅出现在 `paipan-core/tests/` 的测试里）、`await import()`（动态导入 ✅）、`import.meta.url` + `createRequire(import.meta.url)`（✅）。→ **prebuilt 的 Node 18.20.4 跑本仓引擎不存在"语法太新"问题**（这一点比预想干净）。

**关键机制澄清（推翻题面前提）**：nodejs-mobile 的设计是**把 libnode 编译成 `.so` 放进 `jniLibs/`，由 JVM 通过 JNI 启动 Node 事件循环**（同一进程内），**不是**"把一个 node 可执行文件塞进 App 私有目录再 fork/exec"。因此
- Android 10+ 的 **W^X / 应用私有目录不可 exec** 限制**在这条路线上不成为阻塞**（`.so` 放在 APK 的 `lib/arm64-v8a/` 里，由系统以 `nativeLibraryDir` 加载，属正常 native 库加载）；
- 也**不依赖 Termux 的 glibc/动态库布局**（Termux 二进制路线才要面对该问题）。
- 🧠 **仍必须真机验证的**：② 与 Chaquopy 的 `libpython`/`libc++_shared` 共存时 **so 冲突**（两者都会带 OpenSSL/libc++ 等）；③ 同进程内 Python 事件循环与 Node 事件循环的协作/线程模型。

**🔴 16KB 时间线（本轮最重要的新增事实——决定 Node 路线成败）**

| 时间 | 事件 | 出处 |
|---|---|---|
| 2024-10-07 | fork 最后一次**官方 release**：`v18.20.4`（含 `nodejs-mobile-v18.20.4-android.zip`，57MB） | [releases](https://api.github.com/repos/nodejs-mobile/nodejs-mobile/releases) |
| 2025-06 | 有人在 **Android 16 / Pixel 8a** 上实测成功用 `nativeLibraryDir` 跑原生二进制（见下 exec 小节） | [一文（2025-06-15）](https://u1f383.github.io/android/2025/06/15/run-native-binary-on-android.html) |
| 2025-07-09 | issue **#148「Android 16KB Alignment」** 开，报错原文点名到 libnode：**"Some libraries have LOAD segments not aligned at 16 KB boundaries: lib/arm64-v8a/libnative-lib.so **lib/arm64-v8a/libnode.so** lib/x86_64/libnode.so"**，并引官方口径"Starting November 1st, 2025, all new apps and updates … targeting Android 15+ devices must support 16 KB page sizes." | [#148](https://github.com/nodejs-mobile/nodejs-mobile/issues/148) |
| 2025-11-13 | **PR #154 合并**（commit `d9552e0`）：「tools: update android builds to use 16kb page size」，做法就是在构建里加 **`LDFLAGS: '-Wl,-z,max-page-size=16384'`**；作者自述"**Haven't actually tested this locally**" | [PR #154](https://github.com/nodejs-mobile/nodejs-mobile/pull/154) |
| 2025-11-17 → 至今 | **PR #155「release: nodejs-mobile 18.20.4+16kb-fix」**：`state: open`、`merged_at: null`（最后更新 2026-02-04）→ **修复在 main，但没有发版** | [PR #155](https://github.com/nodejs-mobile/nodejs-mobile/pull/155) |
| 2025-12-31 | 唯一活跃维护者 **staltz 公开退出**："**I am no longer an active maintainer, there is a discussion thread for this and a request for new maintainers. No one has stepped up so far.** Can you stop demanding me?" | 同上 PR 评论 |
| 2026-02-04 | 依赖方（Mustang 项目）催更："we depend on this project for our upcoming mobile apps, and we already uplifted to node.js 24" | 同上 |
| 2026-04-29 / 2026-08-17 | PR #159 开→关（未合并）；PR #162「Document the 16KB page alignment build flag」明确说它只是"**serves as a CI build trigger for the 16KB-aligned android artifacts**" → **对齐后的产物只存在于 CI artifact，无公开下载** | [#159](https://github.com/nodejs-mobile/nodejs-mobile/pull/159)、[#162](https://github.com/nodejs-mobile/nodejs-mobile/pull/162) |

→ **结论（硬结论，不再是"待验"）**：**官方 prebuilt `v18.20.4` 明确不是 16KB 对齐**（issue #148 直接点名 `lib/arm64-v8a/libnode.so`），而**官方至今没有任何 16KB 对齐的 release，且维护者已公开退出**。所以「等官方发 16KB 版」**不可依赖**。三条出路：
1. **自编**（推荐，代价 = 接手一条 NDK/gyp 交叉编译链）：官方有 [doc_mobile/BUILDING.md](https://github.com/nodejs-mobile/nodejs-mobile/blob/main/doc_mobile/BUILDING.md)「Install Android NDK r24 for Linux：`sdkmanager "ndk;24.0.8215888"` … The third argument is the target architecture, which can be one of the following: **arm, x86, arm64 or x86_64** … each built shared library will be placed in `out_android/$(ARCHITECTURE)/libnode.so`」，且**官方 CI 就是现成范例**（见下）。注意 BUILDING.md 用的是 **NDK r24**，而 16KB 需要 **NDK r27+ 的工具链默认值或显式 `-Wl,-z,max-page-size=16384`**——两者要自己调和。
2. **用第三方 prebuilt（都是 prerelease，需自测）**：

   | 候选 | 版本/日期 | 说明 |
   |---|---|---|
   | `heylogin/nodejs-mobile` | **v24.5.0-mobile**，2025-11-10，prerelease，`nodejs-mobile-v24.5.0-android.zip`（约 91MB） | release 原文："**This is a pre-release for convenience. It does not come with actual maintenance guarantees of any kind.**" 🧠 其发版日期在 #154 合并（2025-11-13）**前 3 天** → 是否含 16KB 对齐**无法确认（未找到证据）** |
   | `mustang-im/nodejs-mobile` | **v22.9.0**，2025-08-18，prerelease，android.zip 约 82MB | 另有 v24.5.0（2025-09-09）但**只有 ios.zip**，无 android 资产 |
   | Acurast / Stremio / ingriddaleusag 等 fork | — | releases API 均返回 `[]`：**有源码改动、无 prebuilt** |
   | `@comapeo/nodejs-mobile-react-native`（digidem，npm 18.20.4-2，2025-11-21） | — | RN 插件包（含 libnode 二进制 + postinstall），**不是给原生 Android 直接用的 AAR** |
   | Maven Central | — | 查 `nodejs-mobile` 命中 **0 条** → **无官方 AAR / 无独立 libnode 分发**，Android 集成只能"塞 jniLibs"或抄 RN/Cordova 插件的手工集成方式 |
3. **不用 Node**（见 §3.3 的 bundle 方案）。

**官方 CI 范例（自编 libnode 可直接照抄）** —— `nodejs-mobile/nodejs-mobile` 自己的 [.github/workflows/build-mobile.yml](https://raw.githubusercontent.com/nodejs-mobile/nodejs-mobile/main/.github/workflows/build-mobile.yml) 原文关键行：

> `env: SCCACHE_GHA_ENABLED: 'true'` / `ANDROID_NDK_VERSION: r24` / `ANDROID_TARGET_SDK_VERSION: 24`
> `matrix: config: - { os: ubuntu-22.04, target_arch: arm } - { os: ubuntu-22.04, target_arch: arm64 } - { os: ubuntu-22.04, target_arch: x86_64 }`
> `- uses: mozilla-actions/sccache-action@v0.0.6` / `- uses: nttld/setup-ndk@v1 with: ndk-version: r24`
> `env: … LDFLAGS: '-Wl,-z,max-page-size=16384'`
> `run: ./tools/android_build.sh $MY_ANDROID_NDK_HOME $ANDROID_TARGET_SDK_VERSION $TARGET_ARCH`

→ 即：**在 GitHub Actions 上构建 nodejs-mobile / libnode for Android 有官方可照抄的 workflow**（ubuntu + setup-ndk + 三架构矩阵 + sccache），但**耗时量级未找到任何公开数字**，不要先写预算。

**nodejs-mobile 自身的运行时能力（对本方案的直接约束）** —— 官方 [doc_mobile/FAQ.md](https://github.com/nodejs-mobile/nodejs-mobile/blob/main/doc_mobile/FAQ.md) 原文：

> "Not every API is supported on mobile … Examples: - **`child_process.spawn()`, `child_process.fork()` and other APIs that create new processes will run into permission issues** - `process.exit()` is not allowed by the Apple App Store guidelines - `os.cpus()` may return inconsistent/unreliable results"
> "A few other general JavaScript APIs are also unsupported due to Node.js Mobile **not including full internationalization support**: - RegExp Unicode Property Names, for example `/\p{Letter}+/u`"
> "**No. The runtime expects to be run as a single instance in the process.**"
> "Using tools that merge all nodejs project files into a bundle, such as noderify or **esbuild** and using the bundle instead **has been observed to improve load times** in most situations."

→ 三个直接影响：① **`child_process` 不可用** → Python 与 Node 的协作只能是 **127.0.0.1 loopback**（与 §9.3/本项目设计一致，✅ 不是问题，但**别再考虑"用 subprocess 拉起 node"**）；② **一个进程只能有一个 Node 实例** → 模式 S/C 切换时要注意 node 运行时生命周期只能整体起停；③ **没有完整国际化（ICU）** + **官方自己推荐用 esbuild 打 bundle** → **这正好为 §3.3 的 bundle 方案背书**（且已证实本仓核心代码不需要 Intl）。

**补充：Android 10+ 的 exec 限制到底怎么落（即使不走 JNI 也要知道）**
- ⚠️ **证据强度说明（已补强）**：`developer.android.com` 正文在本环境抓不到（JS 渲染 + fetch 失败），**官方页原话仍未取得**；但官方页锚点与结论已被多个独立来源交叉印证，结论可信度**高于**上一版：
  - 官方锚点：`https://developer.android.com/about/versions/10/behavior-changes-10#execute-permission`（"Removed execute permission for app home directory"）；
  - [termux-app#1072](https://github.com/termux/termux-app/issues/1072)（`No more exec from data folder on targetAPI >= Android Q`，308 条评论）：「The ability to run `execve()` on files within an application's home directory will be removed in target API > 28.」+「yet another "working-as-intended"」；
  - [termux-app#5185](https://github.com/termux/termux-app/issues/5185)：「Android 10 enforces **W^X (Write XOR Execute)** policy: untrusted apps targeting API 29+ cannot call `exec()` on files inside the app's writable home directory … which breaks all Termux executables」；
  - [termux-app#2155 置顶评论](https://github.com/termux/termux-app/issues/2155)（**这条给出了"唯一可 exec 的位置"**）：「any app can execute native libraries (or run APKs) of other apps in **`/data/app/*/lib/`** directory, since they have the rwxr-xr-x permission」「The `/data/data` files are assigned the different app_data_file selinux file context.」并引 AOSP sepolicy 原话：「Sensitive app domains are not allowed to execute from /data to prevent persistence attacks and ensure **all code is executed from read-only locations**.」
  - [SO 64786837 采纳答案](https://stackoverflow.com/questions/64786837/what-path-to-put-executable-to-run-on-android-29)：「When targeting API 29 (Android 10 / Q) or above, it is **not possible anymore to have execute permission for files stored within the app's home directory (data)** … One recommended and (hopefully) future-proof way is to **extract program binaries into the application's native lib directory (with `android:extractNativeLibs=true`), where files can still be executed** but are stored read-only for improved security.」（data 目录里 `chmod +x` 无效，报 `error=13, Permission denied`）
- StackOverflow 62391811「Android 10 - alternative to launching executable as subprocess stored in app home directory」**被采纳答案**（评分 3）原话：

  > "I was unable to find a way to execute a binary/native file embedded inside an APK. However, since android automatically extracts files in the `lib/<ABI>/` folder on install, **I was able to put my python executable in that folder.** … In application code, find the install location of the apk. (not the data dir) … `PackageManager.GetApplicationInfo("my.app.name", PackageInfoFlags.SharedLibraryFiles).NativeLibraryDir` … Exec binary/native prog from that folder. It will be something like this: `/data/app/my.app.name-RmBFingPOpsEA-S577DoZg==/lib/x86_64`"
  > 附注（同答案）："even though the docs seem to imply that only files of the form `lib<name>.so` are extracted, I found that all files in that folder were extracted. (**UPDATE: apparently only for DEBUG builds?**) Sub folders are always ignored and never extracted." 以及 Chromebook 环境下只有 `lib<name>.so` 形式的文件会被安装。

  → 链接：[question/62391811](https://stackoverflow.com/questions/62391811/android-10-alternative-to-launching-executable-as-subproccess-stored-in-app-ho)（页面本身对抓取返回 403，正文经 StackExchange API 取得：[API 答案](https://api.stackexchange.com/2.3/questions/62391811/answers?site=stackoverflow&filter=withbody)）
- 同问题另一答案（评分 1）："**short term workaround** … change android `targetSdkVersion` from `29` to `28` … This means, that things should work even on android 10 devices, however … 1. You can never upgrade the target sdk version. 2. At some point in future the google play store will not allow app uploads that target older sdk versions"。
- 旁证（第三方项目明确把该限制写成"W^X"）：Wine 的补丁标题 [「wineandroid: lower targetSdkVersion to avoid **Android 10 W^X restrictions**」](https://list.winehq.org/hyperkitty/list/wine-gitlab@list.winehq.org/message/MYB4FSTR3BXY4EQ6BIX3VRQG3KDPF33V/)。
- **对本项目的结论（已硬化为"平台事实"）**：① **@ 私有目录 exec 在 targetSdk ≥29 下被平台硬禁**（W^X，SELinux `app_data_file` 禁 exec）；② **唯一可 exec 的位置是 `/data/app/*/lib`（= `nativeLibraryDir`，`apk_data_file` 上下文）**，且必须是 `lib*.so` 命名 + **`android:extractNativeLibs="true"`**；③ 有 **2025-06 在 Android 16 / Pixel 8a 上实测成功**的公开记录（[一文](https://u1f383.github.io/android/2025/06/15/run-native-binary-on-android.html)）：「The workaround is to first add the `extractNativeLibs` attribute in your AndroidManifest.xml … Then rename your native binary to follow the `libXXXXX.so` format … use `context.applicationInfo.nativeLibraryDir` … then you can execute the uploaded native binary using `ProcessBuilder()`」；该文另注一个副作用「`untrusted_app` context restricts certain syscalls that glibc tries to invoke during initialization. As a result, running a **statically compiled** native binary may return a Bad system call error」——**对 nodejs-mobile 是好消息**（libnode 是 bionic 链接的 .so，不走 glibc 那条失败路径）。
- ⚠️ **注意一个与 Android 15/16 默认行为相反的坑**：`extractNativeLibs="true"` 意味着放弃"从 APK 直接 mmap 加载"的默认优化；而 Chaquopy 的 native 库走的是 APK 内加载路径。**两者共存时要在 manifest 层确认不会互相拖累**（这属于 §4.1 真机项）。
- **Termux 二进制塞进普通 APK → 🔴 已确认为四重阻塞（不必再研究）**：① **链接器路径**：Termux Wiki [Differences from Linux](https://wiki.termux.dev/wiki/Differences_from_Linux)「Dynamically linked programs will not run because the linker is expected in a nonexistent location (`/lib`) and libc ABI does not match」；② **`$PREFIX` 不可迁移**：同页「You cannot move `$PREFIX` to another location because all programs expect that `$PREFIX` will not be changed」；③ **SELinux** 只允许从 `/data/app/*/lib` exec（termux-app#2155，见上）；④ **Android 10+ W^X**（termux-app#5185，见上）。→ **这条路彻底放弃。**
- 🧠 若日后确需 exec（例如要跑一个独立的 node 可执行文件），必须自己验证三件事：release 构建下系统是否仍提取非 `lib*.so` 文件（Chromebook 环境只认 `lib<name>.so`）、`untrusted_app` 的 syscall 约束、以及 16KB 对齐。


**其它候选方案（本轮自查部分）**：

| 候选 | 结论 | 证据 |
|---|---|---|
| **LiquidCore**（LiquidPlayer） | 🔴 **已死，且比"停更"更糟**：npm 最后版本 0.7.10 = **2020-06-21**（registry `modified: 2022-05-08`），文档基准是 **Node 10.x LTS**；**JitPack 构建状态 API 显示 0.7.0–0.7.10 与 master 全部 "Error"，只有 0.6.1 / 0.6.2 "ok"** → 实际可用上限 **0.6.2**；2025 年仍有人报 16KB 问题（issue #239「lib version not support 16kb pages in android」：`memory segments are aligned to 4 KB (0x1000) instead of 16 KB`，PR #240 open 未合）。**Maven Central 查无**（`q=liquidcore`、`q=g:org.liquidplayer` 均 0 命中），只有 JitPack `com.github.LiquidPlayer:LiquidCore:0.6.1`。设计上确实贴合（App 内 Node VM + 虚拟文件系统 + 自动 bundle），但**不可用** | [npm registry](https://registry.npmjs.org/liquidcore)、[LiquidCore releases](https://api.github.com/repos/LiquidPlayer/LiquidCore/releases)、[deps.dev](https://deps.dev/npm/liquidcore/0.7.10) |
| **QuickJS 系** | 🔴 **Intl 永久缺失（官方明说）**：quickjs-ng 官方 ES 特性页原话「**Due to size constraints it is unlikely QuickJS will ever support the Intl APIs.**」；平台支持表 `| Android | NDK >= 26.0.10792818 | Limited testing |`。quickjs-ng 本身很活跃（最新 **v0.17.0，2026-09-18**）。**对本仓的真实影响**：本仓核心代码**不用 Intl**（本地扫描：`paipan-core/src` 无 `Intl` / `toLocale*` / `getTimezoneOffset`，时区自实现 `FIXED_OFFSET_TZ` + `shanghaiOffset`）→ **核心引擎不需要 ICU 就能跑**；但**必须由宿主显式注入时区**（见 §3.3 末尾）。可用绑定：`quickjs-java`（Android/JVM 打包）、`quickjs-kt`（Kotlin，含 Async/ESM） | [quickjs-ng ES features](https://raw.githubusercontent.com/quickjs-ng/quickjs/master/docs/docs/es_features.md)、[quickjs-ng releases](https://api.github.com/repos/quickjs-ng/quickjs/releases)、[quickjs-java](https://github.com/zhanghai/quickjs-java)、[quickjs-kt](https://github.com/qdsfdhvh/quickjs-kt) |
| **Hermes** | ⚠️ **有 Intl，但结果会"漂移"（对本项目是隐患）**：官方 [doc/IntlAPIs.md](https://raw.githubusercontent.com/facebook/hermes/blob/static_h/doc/IntlAPIs.md) 原话「We decided to **consume the Android and iOS platform provided facilities** for space efficiency, but **at the cost of some variance in behaviours across Android and iOS platforms**」「the results of running the same code **may vary between devices running different versions of Android**」（体积 +57–62K per ABI；ECMA-402 基准只到 2020-06 的第 7 版）。→ 与"三形态排盘结果一致"的验收原则**直接冲突**，除非完全不用 Intl（本仓恰好不用）。最新 stable **v0.13.0（2024-08-16）** | [Hermes IntlAPIs.md](https://raw.githubusercontent.com/facebook/hermes/blob/static_h/doc/IntlAPIs.md)、[Hermes releases](https://api.github.com/repos/facebook/hermes/releases) |
| 其它小引擎 | 🔴 不作候选：**Duktape** v2.7.0（2022-02-19，官方「Being an embeddable engine, Duktape doesn't provide I/O bindings by default.」）；**JerryScript** v3.0.0（2024-12-18 后无 release，模块按文件路径解析、无 node_modules 解析）；**独立 V8** 无 GitHub releases（只有 test_tag/lkgr），官方 Android 交叉编译需推 `icudtl.dat` + `snapshot_blob.bin`，且 i18n 依赖 ICU（`v8_enable_i18n_support`） | 各自 release 页 |
| **自编上游 node（不是 nodejs-mobile）** | ⚠️ **2026 年状态：能成，但上游还在修**。[nodejs/node#65771](https://github.com/nodejs/node/issues/65771)（2026-09-04 开，**仍 open**，label android）标题「Android arm64 cross-build fails with current main and NDK r29」，阻塞原文：「The Android configure script assigns the Android target compiler to CC and CXX. That compiler is also used for **host-side tools such as ICU and V8 generators**」「The Android zlib target … does not include the corresponding `sources/android/cpufeatures/cpu-features.c` … causes the Android CPU feature symbols to be missing from the link」「Android trap-handler activation must remain disabled」；**成功记录（同 issue）**：「Validation with NDK r29, Android API 30, and arm64 completed successfully. The resulting Node binary also passed basic **zlib, crypto, Intl, WebAssembly, and SharedArrayBuffer** runtime checks on Android 11.」配套修复 PR [#65772](https://github.com/nodejs/node/pull/65772)（分离 host/target 编译器）/ [#65773](https://github.com/nodejs/node/pull/65773)（zlib cpu-features）/ #65774 / #65459 全 open。官方 `android_configure.py` 自带补丁步骤（`patch ./deps/v8/src/trap-handler/trap-handler.h < ./android-patches/trap-handler.h.patch`、`--dest-os=android --openssl-no-asm --cross-compiling`）→ **这条路的最大优点：能把 ICU/Intl 带上**（nodejs-mobile 缺的就是这个） | [#65771](https://github.com/nodejs/node/issues/65771) |
| **🔬 附带发现（与引擎无关，但影响"三形态结果一致"验收）** | `paipan-core/src` 里有**恰好 2 处**用「本地时区构造」`new Date(y, m-1, d, h, min, s)`：`capabilities/qimen/index.js:155`、`capabilities/qimen-lifetime/index.js:171`（都是 `currentTermInfo` 里把挂钟时间转成 ms 后与 `jieQiTable` 比较）。这两处的结果**在理论上依赖运行环境的本地时区**。🧠 若 `jieQiTable` 的时间戳同样按本地时区构造，则两端一起平移、比较结果不变（自洽）；但若不同源，则**换设备时区或换无 tzdata 的引擎会改变"当前节气"判定 → 改变奇门排盘**。→ **建议加一个 `TZ=UTC` vs `TZ=Asia/Shanghai` 的对拍用例**（成本极低、风险明确） | 本仓文件行号见左 |


### 2.6 CI 可行性（GitHub Actions + Chaquopy）

**ubuntu-latest 现役镜像实测清单**（`actions/runner-images` 的 Ubuntu 24.04 页，Image Version **20260907.300.1**，[链接](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)）：

| 需要的东西 | 镜像自带情况 | 结论 |
|---|---|---|
| JDK | **8 / 11 / 17（default）/ 21 / 25** | AGP 7.3–9.x 都在 JDK 17 及以上可跑；需要时可 `actions/setup-java` 指定 21 |
| 构建机 Python | **3.10.21 / 3.11.16 / 3.12.14 / 3.13.15 / 3.14.7**（cached tools） | **3.13.15 开箱可用**，满足 17.0「buildPython 必须与应用 Python 同 minor」的新硬性要求；`buildPython("python3.13")` 或 `actions/setup-python` |
| Rust | **cargo/rustc 1.98.1 预装** | 自建 pydantic-core wheel 的构建链**开箱可用**（pax0r 的 recipe 只需 `requirements.build: [rust]`） |
| Android SDK | build-tools 37.0.0 / platforms android-37.2 … android-34、cmdline-tools 12.0、`ANDROID_HOME`/`ANDROID_SDK_ROOT` 已设 | 无需 `android-actions/setup-android`（或仅在需要特定平台时补装） |
| NDK | **27.3.13750724（默认）** / 28.2.13676358 / 29.0.14206865；**NDK 26 已于 2026-01-12 从镜像移除** | Chaquopy 本体不需要 NDK（"There's no need to actually install the NDK, as all of Chaquopy's native libraries are already pre-compiled and stripped"）；但**自建 native wheel 或自编 libnode 时正好用 27+（16KB 默认）**；若项目曾 pin NDK 26 会直接坏掉 → **在 workflow 里显式声明 NDK 版本** |
| Gradle | 9.7.1 预装 | 用 wrapper 固定版本即可 |
| 其它 | `unzip` / `zip` / `patchelf` / `openssl` / `apksigner`（build-tools 内） | 出包+签名无缺件 |

**网络出口（Chaquopy 构建时实际访问的域名）**：
1. `repo.maven.apache.org`（Maven Central）：`com.chaquo.python:gradle`、`com.chaquo.python:runtime`、`com.chaquo.python:target`（Python 运行时，按 `PYTHON_VERSION` 取）——见 [faq-mirror 的镜像清单](https://chaquo.com/chaquopy/doc/current/faq.html)；
2. `chaquo.com/pypi-13.1/`：**Android wheel 仓库**（当前 17.0 文档仍指向该路径）；
3. `pypi.org`：纯 Python 依赖。

**Maven Central 坐标实测（本轮直接抓目录）**：
- [com/chaquo/python/gradle/maven-metadata.xml](https://repo.maven.apache.org/maven2/com/chaquo/python/gradle/maven-metadata.xml) → `<latest>17.0.0</latest>`、`<release>17.0.0</release>`，`lastUpdated 20251130210915`，历史版本 12.0.1 → 17.0.0。→ **§9.1 里"最新 17.0.0"至本轮核实仍成立（尚无 17.1/18）。**
- [com/chaquo/python/target/](https://repo.maven.apache.org/maven2/com/chaquo/python/target/) 目录里 3.13 系列有 **`3.13.0-0`（2024-10-13）/ `3.13.0-1`（2025-05-07）/ `3.13.9-0`（2025-11-20）**。→ 这正是 17.0 实际下载的 Python 运行时，**也正是自建 pydantic-core wheel 时要解包出来给 `PYO3_CROSS_LIB_DIR` 用的那个包**（路径 `com/chaquo/python/target/3.13.9-0/`）。🧠 建议在 CI 里把该 artifact 作为**固定 URL 的构建输入**（而不是让脚本临时去找），这样 pydantic-core wheel 的构建是可复现的。

→ 三者都是公开可达源，GitHub Actions 无需特殊配置；**私有网络受限时才需要自建镜像**（`--find-links`）。

**不需要 `local.properties`**：Changelog 13.0 起「Projects are no longer required to have a `local.properties` file, as long as the `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variable is set」——runner 镜像已设好这两个变量（见上表），**CI 里无需生成 local.properties**（也就再次说明：不存在需要往 local.properties 写 license 的情形）。

**是否需要 license key 环境变量**：**不需要**（见 §2.1）。CI 里**不要**加 `chaquopy.license=...`。

**缓存**：Chaquopy 在 Linux 上把中间产物缓存到 **`$HOME/.cache/chaquopy`**（[#1221 维护者回复](https://github.com/chaquo/chaquopy/issues/1221#issuecomment-2248619232)）。有用户实测该目录约 **90MB**，并且结论是"**包下载本来就很快，缓存收益不明确**"（同 issue 后续）。→ 🧠 建议：**先不缓存，量出耗时再决定**，避免为一个 90MB 缓存写脆弱 key。

**构建耗时量级**：🧠 **未取得权威数字，本轮不给结论**。可确定的量级因子：Gradle 首次配置 + AGP 下载（数分钟）、Chaquopy 下载 Python 运行时 zip（数十 MB）、pip 解析与下载 wheel（几十 MB）、`arm64-v8a` 单 ABI 打包、若自建 pydantic-core 则 **再加一次 Rust 交叉编译**（这是最重的一步）。→ 建议 CI 首轮**只跑一次并记录真实耗时**，不要先写预算。

**附加（POC 直接可用）：Chaquopy 内跑 Web 服务器 + WebView 的公开实践与两个已知坑**
issue [#1243「Running a web server with Quart」](https://github.com/chaquo/chaquopy/issues/1243) 是一个**完整走通**的公开案例（Quart + hypercorn 跑在 App 内、WebView 加载本地页面），两个坑必须写进 POC 清单：
1. **`Python.start()` 必须在后台线程里调用**。用户先遇到 `set_wakeup_fd only works in main thread of the main interpreter`；维护者回复原话：

   > "The first Google result for this error message indicates that it was fixed in Python 3.9. … Alternatively, **if you call `Python.start` on a different thread, then Python will consider that to be the main thread.** It doesn't need to be the same as the main thread in Java."

   实操：`Thread { Looper.prepare(); Python.start(AndroidPlatform(this)); py.getModule("app").callAttr("run"); Looper.loop() }`，并**从清单里移除** `android:name="com.chaquo.python.android.PyApplication"`（用户实测有效）。
2. **不要用 Java/Kotlin 方式在 Python 里 new Activity**（`MainActivity()` → `Can't create handler inside thread that has not called Looper.prepare()` / `Method addObserver must be called on the main thread`）。维护者原话：

   > "You never create an activity explicitly in Android. … If you want to access it from Python code, just pass `this` as an argument when you call `run`, and store it somewhere on the Python side."

   另注：**Kotlin 的 `var port` 不是 Java field，Python 侧要用 `getPort()`**（"Java *fields* are accessible, but Kotlin 'properties' must be accessed via their `get` and `set` methods"）。
→ 这三条对"Python 后端在 App 内起 127.0.0.1 端口 + WebView 指向它"的形态是**现成的踩坑清单**（与本项目胖 APK 模式 S 的主结构完全对应）。

**16KB page size 与单 ABI 对包体的影响**：
- Google Play 对 16KB 的要求：**2025-11-01 起**（维护者引官方 blog："16 KB support will be required on Google Play from November 1st, 2025"）；**若本 APK 不经 Google Play 分发（自签名侧载），则不受商店强制**，但仍要能在 16KB 真机上跑（新出厂设备默认 16KB）。
- ABI：**单 `arm64-v8a` 是官方推荐做法**（faq-size 的 product flavor 方案）；`x86_64` 只是为 Apple silicon 模拟器/旧模拟器准备，**发布版可不含**。
- 体积：Chaquopy 本体"每个 ABI 增加数 MB"，加上 Python 运行时 + wheel 的 native 依赖 + `libnode.so`（fork 的 Android zip 本身 57MB，含多 ABI，**单 arm64 抽取后的 libnode.so 量级需实包测量**）。→ **§9.6 第 7 项"60–150MB+"的预算仍然只能实包测量。**

---

## 三、对路线的影响（按重要性排序）

### 3.1 ✅ §9.6 第 1 项（Chaquopy 授权）可以关闭
免费、无条件、可闭源商用、无 key。路线乙**不存在"授权导致成本剧增"的后果**。原判断里"若收费则路线乙成本剧增"的风险**清零**。

### 3.2 🔄 最大风险重新排序（本轮定稿）
原：`Chaquopy 授权 > Node 运行时 > pydantic-core`
现：**① Node 运行时的 16KB（已从"未知"变成"确认没有可用官方产物"：官方 prebuilt 不对齐、对齐代码只在 main 且发版 PR 挂着、维护者已公开退出）→ ② pydantic-core 自建 wheel（工程量确定、路径已知、有成功案例）→ ③ pillow/freetype 16KB → ④ Chaquopy 授权（已零风险）**。
🧠 但注意两者性质不同：**② 是"照着做就行"，① 是"要么自己接手一条 C++/NDK/gyp 交叉编译链，要么改架构不用 Node"**——所以 **① 才是真正的架构级决策**。

### 3.3 🔬 最有价值的翻转：**Node 依赖可以被"压缩到很薄"**
本仓实测（`backend/paipan-node/`）：

1. **`paipan-core/src` 全树零 Node 内置模块引用**（对 `node:` / `fs` / `path` / `http` / `crypto` / `os` / `url` / `module` 的 import 扫描 = **无命中**）。
2. 该内核的依赖只有两包（`paipan-core/package.json`）：`lunar-typescript@1.8.6`、`astronomia@4.2.0`；
   - `lunar-typescript@1.8.6`：**零 Node 内置依赖**，且 `main/module/exports` 是标准双格式（`dist/index.cjs` + `dist/index.mjs`）→ 可被 esbuild 直接吃。
   - `astronomia@4.2.0`：`"type": "module"` + 完整 `exports` 映射（`import → ./src/*.js`）；**全树只有 `src/vsop87.js` 用 `fs`/`path`**，而 **`src/index.js` 并不导出 vsop87** → `import ... from 'astronomia'` 这条路**不会**把 `fs` 拖进 bundle。`astronomia/data` 也零 `fs`/`__dirname`/`import.meta` 依赖。**无 `dependencies` 字段**，只有 `engines: node>=12` 声明（不是代码依赖）。
   - **⚠️ 但有一个必须现在就处理的包体陷阱（本轮实测数据）**：`astronomia/data/index.js` **一次性 import 全部数据表**，而本仓只需要其中 8 个行星表：

     | 项 | 实测字节 |
     |---|---|
     | `astronomia/data` 整目录 | **8,924,652 B（≈8.9 MB）** |
     | 其中 `elpMppDeFull.js` + `elpMppDe.js`（月球表，**本仓不用**） | 5,621,854 B（≈5.6 MB） |
     | 本仓实际使用的 8 个 `vsop87B*` 表合计 | **1,723,846 B（≈1.72 MB）** |
     | 其余 `vsop87D*` 等（本仓不用） | 余量 |

     而 `ephemeris.js:58-65` 的用法是 `astronomiaData.vsop87Bmercury` 这种**默认对象取属性**——**esbuild/rollup 无法 tree-shake 掉默认对象里未使用的键**，所以现状打包会把 ~8.9 MB 数据全带进去。→ 🧠 **建议改成 8 条精确子路径 import**（`astronomia/data/vsop87Bmercury` …，该包 `exports` 已为每个数据文件提供 `./data/<name>` 子路径），**单这一项可省 ≈7.2 MB（约 81%）**，直接改善 §9.6-7 的包体预算。
   - → **结论：核心引擎 + 数据，可以被 esbuild 打成一个"零 Node 内置依赖"的 ESM/IIFE bundle**（QuickJS/JerryScript/Hermes/WebView 都能跑）。**这个结论已有三项独立证据**：① 上述本地全目录 grep（见下"证据强度"说明）；② **iztro 作者自己发布的浏览器 UMD 单文件** `dist/iztro.min.js`（**787,440 B**，webpack `libraryTarget:'umd'`，无 `target:'node'`、无 node polyfill，README 直接给 `<script src>` 用法）——**这是"该包能在无 Node 环境跑"的厂商级证据**；③ bundlephobia 对 iztro@2.6.1 打包成功（469,136 B / gzip 145,519，dependencyCount 4）。
- **打包配置的三个已知坑（会直接影响 build 配置）**：
  1. **iztro 是 CJS 入口 + import JSON**（`main: lib/index.js`，tsc `module: commonjs`，locale 走 `import common from './common.json'`）→ **rollup 必须加 `@rollup/plugin-json`**（esbuild / webpack5 原生支持）；iztro 的运行时依赖是 `dayjs` / `i18next` / `lunar-lite` / `lunar-typescript`。
  2. **i18next 23.x 在 `typeof Intl === 'undefined'` 时有降级分支**（compatibilityJSON v3 + logger.error）→ **不会硬崩**，但会打日志；这解释了为什么"无 Intl 引擎"仍能跑起来。
  3. **`astronomia/data` 子路径一旦引入就会带进大表**（见上表）→ 按需精确引入。
- **"零 Node 内置依赖"的证据强度（诚实标注）**：本轮是在**已安装的发行树**上做的目录级扫描，覆盖面接近穷尽，但**不是对上游仓库的穷尽证明**：`astronomia`（整包 + `src` + `data`）、`lunar-typescript`（整包 + `dist`）、`iztro`（`lib`）四个目录分别 grep 了 `require/import` 的 `fs|path|os|url|child_process|node:` 与 `__dirname|import.meta|require(变量)` 等模式，**只命中 `astronomia/lib/vsop87.cjs` 与 `astronomia/src/vsop87.js` 这一处**，其余零命中。🧠 开工前仍建议对本仓 `node_modules` 跑一遍全量兜底 grep + 真机/真引擎跑一次排盘对拍。
  （另注：网上流传的 "bundlejs 打包成功" 这类证据偏弱——其配置会把无法解析的 import **stub 掉**而不是报错，因此**不足以单独证明"零 Node 依赖"**；真正有效的是上面 ①②③ 三项。）

**🔴 跨引擎一致性的真正关键：时区必须由宿主显式注入（不是引擎问题，是数据流问题）**
- 本仓 `paipan-core/src` 自身**不依赖 `Intl`**，但有 **2 处**用宿主的"本地时区构造"：`capabilities/qimen/index.js:155`、`capabilities/qimen-lifetime/index.js:171`（`new Date(y, m-1, d, h, mi, s).getTime()` 与 `jieQiTable` 比较以判定"当前节气"）。
- 依赖包侧也有同样性质：`lunar-typescript` 的 `Solar.fromDate` 用**本地时间 getter**、`fromBaZi` 用 `new Date().getFullYear()`（**受宿主时区影响**）；`astronomia` 的 `Calendar.fromDate/toDate` 全用 `getUTC*`/`Date.UTC`（**不受时区影响**）；`iztro` 只在版权年份用 `new Date().getFullYear()`。
- → 🧠 **结论**：换引擎（QuickJS 无 tzdata → 本地时间等同 UTC）或**换设备时区**，都可能改变奇门/八字类的判定。**正确做法 = 宿主（Kotlin 或 Python 侧）把"挂钟时间 + 明确偏移"传给引擎，引擎内不做任何"本地时区"推断**；并把 `TZ=UTC` vs `TZ=Asia/Shanghai` 写成常驻对拍用例（见 §4.1 第 9 项）。

3. **真正需要 Node 的只有外壳**：
   - `server.mjs`：`node:http`（`createServer`）、`node:module`（`createRequire`）、`node:crypto`（`randomInt`）——**HTTP 服务层**；
   - `extra.mjs`：`node:fs`（`readFileSync`）；
   - 紫微仍需 `require('iztro').astro`（`server.mjs:113`、`ziwei.cjs:26`，CJS 包，`paipan-core` 里**没有** ziwei capability）。

**这对 §9.6 第 2 项的意义（本轮已可给出明确建议）**：
- **官方自己就推荐这条路的"技术内核"**：nodejs-mobile FAQ 原文「Using tools that merge all nodejs project files into a bundle, such as noderify or **esbuild** and using the bundle instead **has been observed to improve load times in most situations**」→ "把 JS 打成一个 bundle 再交给运行时"正是上游推荐做法。
- 选项 a（nodejs-mobile fork）**不必承载全部**：可以把 `paipan-core` **bundle 进 Python/WebView 侧**（甚至先只跑确定性排盘），Node 运行时只保留"HTTP + iztro 紫微"这一小块。
- 甚至出现 **选项 d**：**把 HTTP 层交给已在进程内的 Python（Chaquopy）**，Node 只作为"iztro 调用器"或干脆等 paipan-core 补上 ziwei 后**彻底不需要 Node**（对应原选项 b/c 的收敛点）。
- 🧠 **若坚持"App 内跑真 Node"，唯一稳妥路线**（本轮结论）：**自编**——用 `nodejs-mobile` main 分支（自带 `LDFLAGS: '-Wl,-z,max-page-size=16384'`，PR #154 已合）或按 [nodejs/node#65771](https://github.com/nodejs/node/issues/65771) 的补丁路线自编上游 node，产出 **arm64-v8a 的 `libnode.so`**，按 `jniLibs + lib*.so + extractNativeLibs="true"` 交给 JNI 启动；**不要依赖官方 release**（无 16KB 产物 + 维护者退出）。若可接受重写，则走"bundle + QuickJS/Hermes + 宿主注入时区/IO"，代价从"维护交叉编译链"换成"自证时区与农历数据正确性"。
- **§9.3 里"ESM + createRequire 混合加载需真机验证"这条，风险面也被缩小**：混合加载只集中在 `server.mjs`/`ziwei.cjs` 一处（且 nodejs-mobile 官方 FAQ/README **未提及 ESM/`createRequire` 支持状况** = 仍需真机验证的一个点）。

### 3.4 CI 可行性：**成立**，但要在 workflow 里固化 4 件事
1. `actions/setup-python` 装 **3.13**（满足 buildPython 同 minor 硬约束）；
2. **显式 pin NDK 版本**（镜像默认已从 26 换 27，ndkVersion 不写就会被镜像变动打穿）；
3. **不配 `chaquopy.license`**；把 `uvicorn[standard]` 改成 `uvicorn`；
4. `abiFilters = ["arm64-v8a"]` 单 ABI 出包（需要模拟器时另开 flavor）。

### 3.5 需要回写进节142 的修正
- §9.1 表里「Chaquopy 授权待核实」→ 改 **✅ 免费无限制**。
- §9.2 表里 `pydantic-core` 的「候补替代 = pydantic v1」→ 改为「**首选自建 wheel（Rust + PYO3_CROSS_LIB_DIR），v1 降级为最后手段且需 ~5 文件改造 + FastAPI 兼容确认**」。
- §9.2 新增一行：**`uvicorn[standard]` → `uvicorn`（uvloop/httptools 无 Android wheel）**。
- §9.2 `pillow` 的「官网列支持 ✅」→ 加注「**16KB 设备经 freetype 依赖存在失败风险**」。
- §9.3「Node 内核 14+ 法全在 Node」→ 补「**paipan-core 已可脱离 Node（bundle 零内置依赖）**；Node 剩余职责只有 HTTP 层 + iztro 紫微」。
- §9.6-6 默认值翻转（见 3.2）。
- §9.3「Android 无 `node` 命令，subprocess 两条路都死」→ 补一句**更硬的结论**：「**exec 类方案整体出局**（@私有目录被 W^X 硬禁；Termux 二进制四重阻塞）；nodejs-mobile 走的是 **JNI 加载 `libnode.so`**，与"执行 node 二进制"是两回事」。
- §9.6-2 的选项表要加**第 4 条现实约束**：「**官方 prebuilt 无 16KB 对齐产物，且维护者已公开退出**（issue #148 + PR #155 open + staltz 2025-12-31 声明）→ 真 Node 路线的真实成本 = **长期维护一条自编 libnode 的交叉编译链**」。
- §9.2 / §9.6-7 新增一条**立即可落地的包体优化**：「`astronomia/data/index.js` 会带进 8.9MB 全量数据表，本仓只用 8 个 `vsop87B*`（1.72MB）→ 改精确子路径 import 可省 ≈7.2MB」（本轮实测数字，见 §3.3）。
- §9.5/§4.1 的"本机可做"清单新增一项：「`TZ=UTC` vs `TZ=Asia/Shanghai` 对拍（奇门 2 处本地时区构造 + `lunar-typescript` 的本地 getter）」。
- 新增「第三方许可证台账」条目（见 §2.1 末）。

---

## 四、仍需真机 / 仍需拍板

### 4.1 真机或 CI 才能定的（按优先级）
1. **pydantic-core 自建 wheel 能否在本仓依赖集下跑通**：按 pax0r 路线（Python 3.13 + `requirements.build: [rust]` + `PYO3_CROSS_LIB_DIR` 指向 `com.chaquo.python:python/3.13.x` 解包目录）在 CI 里跑一次；**同时验证生成的 `.so` 是否 16KB 对齐**。
2. **libnode 的 16KB（判定分支已确定）**：**不要再指望 prebuilt**——已确证官方 `v18.20.4` 的 `libnode.so` 不是 16KB 对齐（issue #148 点名）、且官方无任何对齐后的 release。真机项的表述改为：**「跑一次自编流程（nodejs-mobile main / 上游 node 补丁路线），产出 arm64-v8a libnode.so，用 `llvm-readelf -l` 核对 LOAD 段对齐，并在 16KB 真机（Android 15+ 新机）实测 dlopen + 排盘」**；若自编成本不可接受，则直接转 §3.3 的 bundle 方案。
3. **Chaquopy 与 libnode 同进程共存**：`libc++_shared` / OpenSSL / `libpython` 符号与版本冲突；
4. **127.0.0.1 loopback + WebView 明文放行**：Android 9+ 的 `usesCleartextTraffic` / network security config 对 `127.0.0.1` 的例外规则；
5. **SQLite 私有目录 + WAL + FTS5 + trigram**（本仓专有用法）；
6. **实包体积**（单 arm64；`libnode.so` + Python 运行时 + wheel native 部分）；
7. **pillow 在 16KB 真机是否 dlopen 失败**（失败即换 SVG/纯 Python 验证码）；
8. **Node 版本与自编成本**：是否接受"自编 libnode（带 16KB 参数）"这条长期维护成本，或直接转 bundle 方案；若自编，还要决定编 **Node 18（fork main）** 还是 **Node 22/24（heylogin / mustang 的源码改动）**。
9. **【本轮新增·成本极低但必须做】时区对拍**：`TZ=UTC` 与 `TZ=Asia/Shanghai` 下重跑奇门（`qimen` / `qimen-lifetime`）对拍，确认那 2 处本地时区构造不影响结果（见 §3.3 末）。**这一条不需要真机，本机就能做**，但它决定"设备时区不同会不会导致排盘结果不同"这一验收原则。
10. **【本轮新增·不需真机】bundle 试验 + 包体回收**：把 `paipan-core`（含 `lunar-typescript` + `astronomia` 精确子路径）用 esbuild 打一次单文件，**量出真实体积**（预期数据部分 ~1.7MB 而非 8.9MB），并在 Node 18 与本机各跑一次对拍——这一步同时验证了"bundle 方案可行"和"去 Node 后的体积基线"。

### 4.2 仍需人类拍板
| 项 | 现状 | 建议 |
|---|---|---|
| **§9.6-2 Node 运行时（最大决策）** | 本轮定稿：**官方 prebuilt 无 16KB 对齐产物 + 维护者已公开退出**；fork 的 prebuilt 只到 Node 18.20.4（2024-10）；替代引擎中 LiquidCore 已死、Termux 四重阻塞、QuickJS 无 Intl（但本仓不用 Intl） | **建议改选：主推"bundle paipan-core 进 Python 侧 + Node 只留薄 HTTP/iztro 层"，并把"paipan-core 补 ziwei、彻底去 Node"从"选项 b"升格为明确的路线终局**（bundle 已被证明零 Node 依赖，且上游 FAQ 自己推荐 esbuild）。**若坚持真 Node**：唯一稳妥 = 自编 libnode（16KB 链接参数），并把它作为**长期维护项**立项，而不是"等上游发版" |
| §9.6-6 pydantic 降级 | 原默认=v1 | **翻转为默认=自建 pydantic-core wheel**；v1 仅作最后手段（成本已量化：5 文件 + FastAPI 兼容待核实） |
| §9.6-3 Python 版本 | 3.13 / 3.12 | **锁 3.13**（17.0 官方推荐 3.13+ 以兼容 16KB；CI 镜像自带 3.13.15；且 pydantic-core 成功案例正是 3.13） |
| §9.6-7 包体预算 | 60–150MB+ | 维持"先接受、量产再议"，但**立即回收 astronomia 的 ≈7.2MB 浪费**，并在 POC 首次出包后把区间改成实测数字 |
| 新增：`extractNativeLibs="true"` | 若走 JNI libnode 需要它，但 Chaquopy 的 native 库走 APK 内加载 | 需在 POC 里验证两者共存不互相拖累（见 §4.1-3） |
| 新增：第三方许可证台账 | 本轮新发现（Chaquopy MIT 要求保留声明；内嵌 Python/OpenSSL/SQLite/**certifi(MPL-2.0)** 等） | 建议在正式立项节单列一条 |
| 新增：分发渠道 | 若经 Google Play，则 16KB 为强制项（2025-11-01 起）；若自签名侧载则非强制 | 需明确本项目 APK 的分发方式 |

---

*核实时间：本轮 session。来源分布：Chaquopy 事实取自 17.0 当前线上文档（2025-12-01 发布）+ Maven Central 坐标实测；CI 事实取自 runner-images 20260907 镜像页；Android exec/16KB 事实取自 Android 官方锚点（正文本环境不可抓）+ termux/StackOverflow/nodejs-mobile issue 交叉印证；bundle 与体积数字为本仓本地实测。*
*本轮另有一个并行调研子代理（Node 运行时专项）独立复核了 Node/替代引擎/exec 各节，其结论已合并进本文件；其未取得证据的点已在文中以「未找到证据」显式标注。*
