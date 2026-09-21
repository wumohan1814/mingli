// 仓库与插件解析配置：所有依赖仓库都在这里声明，build.gradle.kts 里不再写 buildscript/allprojects。
//
// ⚠️ 国内镜像优先（2026-09-22 实测加的必要性）：本机直连官方源**会长时间挂住** ——
//   · `plugins.gradle.org` 走 Cloudflare，实测只建立长连接不下载（构建卡在配置期 14 分钟、
//     缓存零增长）；
//   · `dl.google.com`（Google Maven）只有 0.86 MB/s。
//   阿里云镜像实测：google 仓库 **6.16 MB/s**（约 7 倍）。故镜像排在官方源**之前**，
//   官方源保留为兜底（镜像缺件时自动回落）。
//
// 境外构建想只走官方源：`gradle assembleDebug -PmingliApkUseChinaMirrors=false`
import org.gradle.api.initialization.resolve.RepositoriesMode

pluginManagement {
    val useChinaMirrors = providers.gradleProperty("mingliApkUseChinaMirrors")
        .map { it.toBoolean() }.getOrElse(true)
    repositories {
        if (useChinaMirrors) {
            maven { url = uri("https://maven.aliyun.com/repository/google") }
            maven { url = uri("https://maven.aliyun.com/repository/public") }
            maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // 只认本文件声明的仓库，子项目里再声明仓库会被忽略（避免仓库来源不一致）。
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    val useChinaMirrors = providers.gradleProperty("mingliApkUseChinaMirrors")
        .map { it.toBoolean() }.getOrElse(true)
    repositories {
        if (useChinaMirrors) {
            maven { url = uri("https://maven.aliyun.com/repository/google") }
            maven { url = uri("https://maven.aliyun.com/repository/public") }
        }
        google()
        mavenCentral()
    }
}

rootProject.name = "mingli-apk"

include(":app")
