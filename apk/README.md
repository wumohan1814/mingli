# 命理 APK（POC-0）

> 面向“手动构建”的人写的说明：照着做就能出一安装包。不需要懂内部实现。

## 这是什么

这是一个**自带一切**的安卓安装包：Python 后端、前端页面、以及一个只在本机运行的小型 HTTP 服务，
全部打包在 APK 里面。

- 手机**不需要联网**，也**不需要官方服务器**。
- 打开应用后，手机上的一个小服务（`127.0.0.1:8765`）会把内置的页面提供给应用自己显示。
- 排盘在手机本地算，靠的是打包进去的 JavaScript。

一句话：装上就能用，离线可用。

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

## POC-0 能做什么、不能做什么

**能做到（这一阶段）：**

- 完全离线启动，不依赖任何官方服务器。
- 打开内置的前端页面（由应用内部的本机服务 `127.0.0.1:8765` 提供）。
- 在前端里完成客户端排盘（用打包进去的 JS）。
- 启动失败时显示一张友好的错误说明页，而不是黑屏或闪退。

**暂时做不到（这一阶段刻意不做）：**

- 任何 **AI / 大模型功能**：没有接密钥，也没装相关 Python 包（依赖列表是空的）。
- 原先基于 Node 的后端功能（去 Node 那部分还没搬过来）。
- 任何需要服务器或联网的功能。
- **只有 32 位 CPU 的老手机**：内置的 Python 3.13 只有 64 位版本，所以只支持 arm64-v8a 设备。
- 正式版 / 签名版安装包：目前只出调试包。

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
