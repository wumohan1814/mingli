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
            // POC-0 阶段刻意留空：不装 fastapi/pydantic，避免拖进 pydantic-core 自建 wheel 问题。
            // 后续阶段在此加 install("fastapi") 等（届时必须同时显式指定 buildPython，见文件顶部说明）。
        }
    }
}

dependencies {
    // POC-0 刻意零依赖：WebView 用系统内置的 android.webkit.WebView，
    // Activity 用框架的 android.app.Activity，不引 AndroidX，减少爆炸半径。
}
