# 命理 APK（单机版）

> 面向“手动构建”的人写的说明：照着做就能出一安装包。不需要懂内部实现。

## 这是什么

这是一个**自带一切**的安卓安装包：完整的 Python 后端、前端页面、排盘引擎，
全部打包在 APK 里面，由应用内部的一个本机服务（`127.0.0.1:8765`）在设备上跑起来。

- 手机**不需要联网**，也**不需要官方服务器**（自有线上实例已于 2026-10-01 下线）。
- 打开应用后，本机服务会把内置的页面提供给应用自己显示。
- 排盘在手机本地算，靠的是打包进去的 JavaScript 内核。
- **AI 解读需要你自己填一个大模型 API**（应用内「大模型接入」）——
  这是唯一需要联网的功能，且用你自己的账号、你自己的费用；不填也能正常排盘。

一句话：装上就能用，离线可排盘，AI 解读自备 API。


## 先准备什么

在 Windows 上，用 PowerShell 先加载一次环境（每个新开的窗口都要做一次）：

```powershell
. C:\AndroidDev\env.ps1
```

这行命令会把 `JAVA_HOME`、`ANDROID_HOME` 设好，并把 `gradle` 加进 PATH。
之后 `gradle` 命令才可用。

需要具备：

| 需要的东西 | 说明 |
| --- | --- |
| JDK 21 | Gradle 与编译都用它。版本不对会直接报错。 |
| Android SDK（platform 36） | 编译目标平台。 |
| Python 3.13 | 可选。用来预编译 Python 字节码，让应用启动更快。**本机 PATH 上已有 Python 3.13.14。** 没装也不会构建失败，只是跳过这步优化。 |

## 构建三步

1. 进入 APK 模块目录：

   ```powershell
   cd apk
   ```

2. 把仓库里的源码同步成 APK 需要的“内置资源”：

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\sync-assets.ps1
   ```

   两个可选参数：

   - `-OnlyBootstrap`：只同步 Python 自举服务，跳过后端代码和前端页面。适合先试试能不能跑起来。
   - `-NoWeb`：跳过前端页面资源，只同步 Python 部分。

   例如：`powershell -ExecutionPolicy Bypass -File tools\sync-assets.ps1 -OnlyBootstrap`

3. 构建调试包：

   ```powershell
   gradle assembleDebug
   ```

   第一次构建会下载依赖，比较慢（几分钟到十几分钟）；之后会快很多。

## 产物在哪

```
apk\app\build\outputs\apk\debug\app-debug.apk
```

这个名字带 `debug`，说明是调试包，只能自己测试用。

## 怎么装到手机

方式一：用数据线（推荐）

1. 手机打开「开发者选项」里的「USB 调试」。
2. 数据线连电脑，先确认能识别到手机：

   ```powershell
   adb devices
   ```

   列表里出现设备号才算成功。

3. 安装（`-r` 表示覆盖安装，已装过也能装）：

   ```powershell
   adb install -r app-debug.apk
   ```

方式二：不用数据线

把 `app-debug.apk` 拷到手机上（微信/QQ/网盘/U 盘都行），在手机上点这个文件安装。
第一次会提示需要「安装未知应用」权限，允许即可。

## 打开后是什么样

点桌面图标打开，应用会**自动**加载内置的本地页面，不需要你做任何设置。
第一次打开时，应用会把 APK 里的 Python 运行环境和前端页面解包到自己的私有目录
（约 17MB，几百个文件），所以会先显示一张「正在启动本地服务…」的过渡页，几秒后自动进入正式界面。
这属于正常现象，之后启动就快很多。卸载重装会重新解包一次。

## 这一版能做什么、不能做什么

**能做到（已实测）：**

- **完全离线启动**，不依赖任何官方服务器（不需要 Node，也不需要联网）。
- 应用内部起一个**真正的后端**：`apk_asgi` 会在后台线程里跑 uvicorn + FastAPI
  （`app.main:app`），静态页面、`/api/*`、`/admin` 全由它托管，本机地址 `127.0.0.1:8765`。
- **排盘在设备本地算**：紫微/占星/七政/奇门/五运六气经 `paipan_bridge`
  （Python → Java → WebView → JS 内核 bundle）；八字用的是随包的 `lunar-python`。
- **AI 解读可用 —— 需要你自己填一个大模型 API**：应用内「大模型接入」里填
  接口地址 / Key / 型号，然后点「测试连通」。**不填也能用**（确定性排盘照常，
  AI 解读处给引导提示，不会白屏）。
- 启动失败时先回退到旧的纯标准库服务（`apk_server`，只有静态 + 排盘），
  再失败才显示友好错误页 —— **不会黑屏、不会闪退**。

**暂时做不到 / 已知边界：**

- **只有 64 位 CPU**：内置 Python 3.13 只有 64 位版本，只支持 `arm64-v8a` / `x86_64`
  （32 位老手机装不了）。
- **只出调试包**，没有正式签名版。
- 大模型调用走**本机 Python 侧**（不走 WebView `fetch`）。这样设计有两个原因：
  ① Android 的网络安全策略管不到 Python 的原生 socket，所以**局域网上的
  `http://` 本地大模型也能连**（WebView 侧会被策略挡）；② 顺带绕开 CORS。
- 本机服务默认**只监听 `127.0.0.1`**，不要改成对外监听 —— 单机形态会自动签发本机
  token，对外监听等于把 token 送到局域网（代码里有回环校验兜底，但别依赖它）。

## 依赖是怎么进包的（节166，实测定稿）

pip 列表写在 `app/build.gradle.kts` 的 `chaquopy { pip { ... } }` 里。两条**必须知道**的规则：

1. **Chaquopy 的 pip 硬编码 `--only-binary :all:`，sdist 永不编译。**
   所以「没 wheel」= **构建期直接失败**，不是运行期才炸。
   - `pydantic` 只能钉 **v1 系**（`pydantic>=2` 依赖 Rust 扩展 `pydantic-core`，
     官方索引里没有它的安卓 wheel）→ 全仓已于节166 降到 v1。
   - `uvicorn` **不能带 `[standard]`**（uvloop / httptools / watchfiles 没有纯 Python wheel）。
   - `python-jose` **不带 `[cryptography]`**（JWT 只用 HS256，hmac/hashlib 足够）。
2. **「纯 Python 但只发 sdist」的包同样会被拒收。**
   `lunar-python` 就是这类 —— 它的 wheel 是本仓库自建的
   （`apk/app/wheels/lunar_python-1.4.8-py3-none-any.whl`，115 KB，0 个原生扩展），
   靠 `options("--find-links", file("wheels").absolutePath)` 引入。
   升级它的版本时照 `build.gradle.kts` 里的注释重新生成一次即可。

**加新依赖前必做**：先去 PyPI 确认**有 `.whl`**，光看「是不是纯 Python」不够。

## 怎么验证（不需要安卓手机）

```powershell
python apk/tools/verify-apk-local.py
```

它用真后端在开发机上验单机形态的 23 条判据（形态/能力/静态站点/token/大模型未配置不崩），
**并且会真起一个 uvicorn 后台线程发真回环 HTTP** —— 那才是 APK 的真实执行模型
（顺带验证 uvicorn 的信号处理器守卫没被后台线程搞崩）。

## ⚠️ 构建前必读的两个坑（都是实测踩过的）

| 坑 | 现象 | 怎么办 |
| --- | --- | --- |
| **本机 pip 走注册表里的失效系统代理** | Chaquopy 装包报 `pip returned exit status 1`，日志里是 `WinError 10061` 连不上 `192.168.31.217:53969`。**清 `HTTP_PROXY` 环境变量无效**（它是从注册表读的） | 跑 `gradle` 前设 `$env:NO_PROXY='*'`（`no_proxy` 也一起设）。Chaquopy 的 pip 是 Gradle 拉起的子进程、继承环境 |
| **`sdkmanager 'ndk;版本'` 会把 `;` 当分隔符** | 报 `Package ndk not found`，看着像「源里没这个版本」 | 用新 CLI：`android.exe sdk install 'ndk/版本'`。注意：**降 pydantic v1 之后已不需要 NDK** |


## 出问题怎么查

| 现象 | 怎么办 |
| --- | --- |
| 打开后一直白屏 / 停在启动页 | 先多等几秒；还不行就完全退出应用再打开。仍然失败时看日志：<br>`adb logcat -s python.stdout python.stderr` |
| 构建报找不到 SDK | 检查 `. C:\AndroidDev\env.ps1` 是否执行过、`ANDROID_HOME` 是否正确；必要时在 `apk\local.properties` 里写 `sdk.dir=...`（该文件不入版本库）。 |
| Gradle 报 JDK 相关错误（例如 class file version） | Java 版本不对，必须用 **JDK 21**；也可以解开 `gradle.properties` 里注释掉的 `org.gradle.java.home` 指定路径。 |
| 警告 “unsupported compileSdkVersion 36” | 只是警告，`gradle.properties` 里已经压制（`android.suppressUnsupportedCompileSdk=36`），不用管。 |
| 提示缺少 Python 服务相关文件 | 打包前忘了跑 `tools\sync-assets.ps1`，补跑一次再构建。 |

## 怎么拿到能装的 APK（两条路，都已跑通）

| 方式 | 怎么做 | 产物 |
| --- | --- | --- |
| **本机构建** | `. C:\AndroidDev\env.ps1` → `cd apk` → `powershell -File tools\sync-assets.ps1` → `gradle assembleDebug` | `apk/app/build/outputs/apk/debug/app-debug.apk`（约 **51 MB**） |
| **GitHub 云端构建** | 推代码（改动 `apk/**` 会自动触发）或在仓库 Actions 页手动跑工作流 `apk-poc0` | 该次运行页面下方的 artifact **`mingli-apk-poc0-debug`**（保留 14 天） |

> 两个包都是 **debug 签名**、内容同源，可直接传到手机安装。云端那条路的意义 = 本地没装 Android 工具链的人也能出包。
> 首次云端运行已成功（2026-09-22）。

## ⚠️ 改这个目录里的 `.ps1` 之前必读

`tools/sync-assets.ps1` **必须带 UTF-8 BOM**（文件头 3 字节 = `239,187,191`）。本机执行它的是 **PowerShell 5.1**，
没有 BOM 时它按 **ANSI(CP936)** 解码 → 中文全乱码、并在解析期报 `Unexpected token` / `string is missing the terminator`
—— **看起来像语法错误，实际是编码问题**（2026-09-22 真踩过一次，排查花了一整轮）。
复核方法：`[System.IO.File]::ReadAllBytes($p)[0..2]` 是否 `239,187,191`，以及
`[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$null,[ref]$err)` 的错误数是否为 0。

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `app/src/main/java/com/mingli/apk/` | Kotlin 代码（界面、启动流程、排盘桥接口）。 |
| `app/src/main/python/` | **生成物**：三层拼起来的 —— ① `apk/pysrc` 的自举服务与排盘桥（**平铺在根**，MainActivity 按顶层模块名取，别挪进子目录）② `backend/app/` → `python/app/` ③ `backend/prompts/` → `python/prompts/`。**②③ 的目录层级必须保留**：后端代码用的是绝对包导入（`from app.config import …`）与 `parents[2]/"prompts"` 这类相对定位，一旦压平就连 import 都过不了。 |
| `app/src/main/assets/web/` | **生成物**：前端页面的拷贝。 |
| `app/src/main/assets/paipan/` | **生成物**：排盘 JS 包。 |
| `tools/sync-assets.ps1` / `tools/sync-assets.sh` | 同步脚本（Windows 用 `.ps1`，CI 用 `.sh`），负责把源码拷进上面这些目录。 |

> 重要：`app/src/main/python/`、`app/src/main/assets/web/`、`app/src/main/assets/paipan/`
> 这三个目录都是构建产出的中间物，**不在版本库里**。
> 所以第一次构建之前，一定要先跑一次 `tools\sync-assets.ps1`，否则会缺文件。
