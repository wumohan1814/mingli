// 根项目的插件版本声明。具体应用在 app/build.gradle.kts 里。
// 注意：本文件刻意不写 allprojects { repositories { ... } }，仓库统一由 settings.gradle.kts 提供。
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("com.chaquo.python") version "17.0.0" apply false
}
