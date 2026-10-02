plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.chaquo.python")
}

/*
 * 这里刻意**不**显式指定 Chaquopy 的 buildPython，也不打开 pyc 预编译。
 *
 * 2026-09-22 实测：原先写了配置期探测（providers.exec 找 Python 3.13）再调 buildPython(列表)，
 * 结果是 **Kotlin DSL 编译直接失败** —— Chaquopy 的 buildPython 只接受**单个可执行文件路径
 * String**，传 List 报 `Type mismatch: inferred type is List<String> but String was expected`；
 * 而 Windows 的 `py -3.13`（启动器带参数）也无法用单一路径表达。
 *
 * 取舍（破竹铁律 8：优先删机制）：POC-0 阶段 pip{} 是空的、没有任何包需要"从源码构建"，
 * Chaquopy 会自己按 PATH 找 Python；pyc 预编译只是"设备端首次启动更快"的优化，
 * 不显式打开时找不到 Python 只告警、不会让构建失败。故整段删掉（顺带消掉一处配置期 exec
 * 与 Gradle 9 弃用告警）。将来要装 fastapi 这类需要构建的包时，再按 Chaquopy 文档
 * 显式指定 buildPython（**路径 String**）与 buildRequirements，并在 CI 钉同版本 Python。
 */

android {
    namespace = "com.mingli.apk"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mingli.apk"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-poc0"

        // Chaquopy 17 只支持 64 位 ABI（Python 3.12+ 已移除 32 位支持），
        // 因此不要加 armeabi-v7a / x86，否则构建直接失败。
        ndk {
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/*.kotlin_module",
            )
        }
    }

    // AGP 8 起 BuildConfig **默认不再生成**。MainActivity 用 BuildConfig.VERSION_NAME
    // 做「静态站点解包版本戳」（升级 APK 后自动重新解包 assets/web），故必须显式打开
    //（2026-09-22 实测：不开就直接报 `Unresolved reference 'BuildConfig'`）。
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

chaquopy {
    defaultConfig {
        version = "3.13"
        pip {
            /*
             * 节166 · P1 探针（2026-10-02，用户拍板走「降 pydantic v1」路线）。
             *
             * 为什么必须是这一套：Chaquopy 17 的 pip **硬编码 `--only-binary :all:`，sdist 永不编译**，
             * 且只传一个 `--platform android_24_arm64_v8a`。所以「没安卓 wheel」= 构建期直接失败。
             *   - pydantic-core（Rust）：官方索引 404、issue #1326 已关闭且从未产出 v2 wheel
             *     → `pydantic>=2` 在 APK 里**不可用**
             *   - pydantic 1.10.22 / SQLAlchemy 是 `py3-none-any` 纯 Python wheel → 可用
             *   - `uvicorn[standard]` 必失败（uvloop / httptools / watchfiles 无纯 Python wheel）
             *     → 只能 `install("uvicorn")`（纯 Python h11 兜底）
             *
             * 本套已在开发机 Python 3.13.14 上实测功能全通（BaseModel / @validator /
             * FastAPI 路由 / response_model / 422 校验）。见 `40_节/待办/节166-…md` §二·结论。
             *
             * 刻意不装的（免背无用依赖与原生扩展风险）：
             *   passlib[bcrypt]（auth 用的是 hashlib.pbkdf2_hmac，根本没被使用）
             *   python-jose[cryptography]（JWT 只需 HS256，hmac/hashlib 足够）
             *
             * 先用最小可判定集探针；确认构建期解析通过后，再补 httpx / python-multipart /
             * apscheduler / pillow / lunar-python（届时同样先核它们的 wheel 标签）。
             */
            install("pydantic==1.10.22")
            install("fastapi<0.119")
            install("uvicorn")
            install("sqlalchemy")
            // P1 第一批（2026-10-02）已在本机构建通过并落盘验证：
            //   pydantic 1.10.22 / fastapi 0.118.3 / uvicorn 0.54.0 / sqlalchemy 2.1.1
            //   ＋ starlette 0.48.0 / anyio 4.15.1 / click 8.5.0 / h11 0.16.0 / idna 3.20 / typing_extensions 4.16.0
            //   全部落在 build/python/pip/debug/common/（纯 Python wheel 的 ABI 无关桶）
            //   APK 51.06 MB → 58.20 MB
            // 第二批：补齐后端运行期其余依赖，把「还有没有别的安卓 wheel 缺口」一次问清
            install("httpx")            // LLM 客户端 / 排盘引擎 HTTP 调用
            install("python-multipart") // 文件上传（后台上传素材）
            install("apscheduler")      // 定时任务
            install("pillow")           // 图片处理（Chaquopy 索引有 11.0.0 预编译包）
            /*
             * 🔴 `python-jose` —— **节166 真机事故的根因，务必保留**。
             *
             * `app/auth/router.py` 与 `app/admin/auth.py` 都在**模块级** `from jose import jwt`，
             * 而 `app/main.py` 会 import 这两个模块 ⇒ **缺它 = `import app.main` 直接失败**
             * ⇒ `apk_asgi` 起不来 ⇒ 退回纯标准库的 `apk_server`。
             * 后果不是「报个错」而是**整个后端消失**：前端拿不到 `/api/runtime`，退回
             * 「Web 版全能力」假设 → **弹出一个单机形态根本没有的登录页**（用户 2026-10-02 真机实测）。
             *
             * ⚠️ **为什么当初漏了**：桌面开发机上 `jose` 由系统 Python 提供，本地怎么跑都是绿的；
             * 而「用改动前后的依赖清单对比来确认没有新增依赖」这种验证**结构上抓不到本来就漏的包**。
             * 复现/复核方法：造一个只装本文件所列包的环境，跑
             * `python -c "import app.main"` —— 会精确报出缺哪个（见 apk/tools/verify-apk-local.py 的判据 12）。
             *
             * ⚠️ 刻意**不带 `[cryptography]`**：JWT 只用 HS256，hmac/hashlib 足够；
             * 而 `cryptography` 是 Rust 扩展、没有安卓 wheel（装不上）。
             */
            install("python-jose")
            // lunar-python（八字排盘，engine.py 的 `from lunar_python import Solar`）：
            //   PyPI 上**只有 sdist**，而 Chaquopy 的 pip 硬编码 `--only-binary :all:` → 拒收，
            //   实测报 `Could not find a version ... (from versions: none)`。
            //   它是**纯 Python**，故改为自建一个 `py3-none-any` wheel 随仓库提供（**无需 NDK/Rust**）。
            //   生成命令（一次性、可复现，升级版本时照做）：
            //     pip download lunar-python --no-deps -d tmp
            //     pip wheel tmp/lunar_python-<ver>.tar.gz --no-deps -w apk/app/wheels
            //   `wheels` 目录用绝对路径传，避免 Chaquopy 相对路径基准不明（实测基准与直觉不一致过）。
            options("--find-links", file("wheels").absolutePath)
            install("lunar-python==1.4.8")
            /*
             * ⚠️ `lunar-python` **暂不入 pip 列表**（2026-10-02 本机构建实测）：
             *   `ERROR: Could not find a version that satisfies the requirement lunar-python (from versions: none)`
             * 原因：它在 PyPI 上**只发 sdist（.tar.gz）、不发 wheel**，而 Chaquopy 的 pip 硬编码
             *   `--only-binary :all:` → sdist 一律拒收，于是解析阶段直接失败（**不是**它有问题）。
             * 它是**纯 Python**，所以出路是自建一个 `py3-none-any` wheel（**不需要 NDK/Rust**），
             * 放到 `apk/wheels/` 再用 `options("--find-links", "wheels")` 引入——待做，见
             * `40_节/待办/节166-…md`。
             */
        }
    }
}

dependencies {
    // POC-0 刻意零依赖：WebView 用系统内置的 android.webkit.WebView，
    // Activity 用框架的 android.app.Activity，不引 AndroidX，减少爆炸半径。
}
