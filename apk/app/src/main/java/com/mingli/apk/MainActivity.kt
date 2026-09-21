package com.mingli.apk

import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicBoolean

/**
 * POC-0 的唯一界面：一个全屏 WebView，指向 APK 内部自举的 Python 本地服务。
 *
 * 设计要点（刻意保守，减少爆炸半径）：
 * 1. 只用 Android 框架自带类（android.app.Activity + android.webkit.WebView），不引 AndroidX、不用协程。
 * 2. 界面完全用代码搭，不写 layout xml；启动时先显示一张「正在启动」的本地页面，屏幕绝不空白。
 * 3. 启动流程：初始化排盘桥 -> 防御式启动 Python -> 建 WebView -> 后台解包静态站点并启动服务
 *    -> 轮询 /api/health -> 就绪后加载首页。
 * 4. Python 解释器与进程同生命周期：**任何情况下都不调用 Python.stop()**。
 *
 * 关于静态站点（关键约定，与 apk/pysrc 的 apk_server 对齐）：
 * Chaquopy 只把 `src/main/python` 打进 APK，`src/main/assets` 仍然留在 APK 压缩包里，
 * Python 侧拿不到真实路径。而 apk_server 是从**文件系统目录** `<HOME>/web`
 * （Chaquopy 下 HOME = filesDir）读静态资源的，所以必须由这里把
 * `assets/web/` 目录下的全部文件解包到 `<filesDir>/web`，否则 /api/health 会 200 但首页资源全是 404。
 * （⚠️ 注释里**不要**写成带通配符的 `web/` + 两个星号：Kotlin 的块注释是**可嵌套**的，
 *   那句里的斜杠加星号会被当成"嵌套注释开始"，导致整份文件的注释在编译期永不闭合
 *   —— 2026-09-22 实测报 `Syntax error: Unclosed comment`，排查花了一轮。）
 * 前端 index.html 用的是绝对路径（/vendor/...、/data/...），因此站点必须挂在服务器根目录。
 */
class MainActivity : Activity() {

    /** 本地自举服务的健康检查地址（Python 侧 /api/health）。 */
    private val healthUrl = "http://127.0.0.1:8765/api/health"

    /** 本地自举服务的首页地址。 */
    private val appUrl = "http://127.0.0.1:8765/"

    /** 等待服务就绪的总时长上限（毫秒）。 */
    private val readyTimeoutMs = 20_000L

    /** 两次健康检查之间的间隔（毫秒）。 */
    private val pollIntervalMs = 250L

    /** 首页 WebView；初始化失败时为 null。 */
    private var webView: WebView? = null

    /** 保留最后一次异常，便于排查（也会显示到错误页上）。 */
    @Volatile
    private var lastError: Throwable? = null

    /** 置位后，后台线程不再触发任何界面回调。 */
    @Volatile
    private var shuttingDown = false

    /** 健康检查用的单线程执行器（绝不占用主线程）。 */
    private val healthExecutor: ExecutorService = Executors.newSingleThreadExecutor(
        ThreadFactory { runnable ->
            Thread(runnable, "mingli-health-poll").apply { isDaemon = true }
        }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 第一步：初始化排盘桥。必须在任何 WebView / 页面脚本之前完成，
        // 否则网页侧调用排盘接口时会拿不到已注册的桥对象。
        try {
            val ctx: Context = applicationContext
            PaipanBridge.init(ctx)
        } catch (t: Throwable) {
            // 桥初始化失败不阻断启动：先让用户看到界面，问题记在日志里。
            lastError = t
        }

        // 第二步：防御式启动 Python。
        // 若清单里的 Application 被换成非 PyApplication，Python.start 会抛异常，
        // 这里吞掉异常并继续走 WebView 流程，至少能显示错误页而不是闪退。
        try {
            if (!Python.isStarted()) {
                Python.start(AndroidPlatform(this))
            }
        } catch (t: Throwable) {
            lastError = t
        }

        // 第三步：搭界面。先显示一张本地「正在启动」页，避免启动期黑屏。
        val wv = try {
            createWebView()
        } catch (t: Throwable) {
            lastError = t
            null
        }

        if (wv == null) {
            showError("WebView 创建失败：${lastError?.message ?: "未知原因"}")
            return
        }

        webView = wv
        setContentView(wv)
        try {
            wv.loadDataWithBaseURL(null, loadingHtml(), "text/html", "utf-8", null)
        } catch (t: Throwable) {
            lastError = t
        }

        // 第四步：后台轮询本地服务，就绪后切到真正的页面。
        startHealthPolling()
    }

    /**
     * 用代码创建一个只服务本机回环地址的 WebView。
     * 文件访问、内容提供者访问全部关掉：页面资源只应来自 127.0.0.1。
     */
    private fun createWebView(): WebView {
        val wv = WebView(this)
        wv.setBackgroundColor(Color.WHITE)
        wv.isVerticalScrollBarEnabled = true

        val settings: WebSettings = wv.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadsImagesAutomatically = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        // 混合内容一律禁止：http 页面里不允许夹带/降级到不安全资源。
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        // 关掉 file:// 与 content:// 访问，页面只能走本机 HTTP。
        settings.allowFileAccess = false
        settings.allowContentAccess = false

        // 只在 debug 包上开放 WebView 远程调试（chrome://inspect）。
        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (debuggable) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // 导航一律留在应用内，且只认 http/https。
        wv.webViewClient = LocalOnlyWebViewClient()
        return wv
    }

    /**
     * 只允许 http/https 在 WebView 内打开；
     * 其他 scheme（mailto / tel / intent / file / 自定义 scheme）一律拦下，
     * 避免页面把用户弹到外部应用或访问本地文件。
     */
    private inner class LocalOnlyWebViewClient : WebViewClient() {

        @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            val scheme = try {
                URI(url).scheme?.lowercase()
            } catch (t: Throwable) {
                // 解析不了就当外部链接处理（返回 true 拦下）。
                lastError = t
                null
            }
            if (scheme == "http" || scheme == "https") {
                // false = 交给 WebView 自己加载。
                return false
            }
            return true
        }
    }

    /**
     * 启动后的临时页面：纯本地字符串，不依赖任何资源文件，保证屏幕立刻有内容。
     */
    private fun loadingHtml(): String {
        return """
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>正在启动</title>
                <style>
                    html, body { height: 100%; }
                    body {
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #f6f7f9;
                        color: #23262b;
                        font-family: -apple-system, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
                    }
                    .wrap { text-align: center; padding: 24px; }
                    .dot {
                        width: 34px; height: 34px; margin: 0 auto 18px;
                        border: 3px solid #d7dae0;
                        border-top-color: #4b6bdd;
                        border-radius: 50%;
                        animation: spin 0.9s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .title { font-size: 17px; }
                    .hint { margin-top: 8px; font-size: 13px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="wrap">
                    <div class="dot"></div>
                    <div class="title">正在启动本地服务…</div>
                    <div class="hint">首次打开需要解压内置环境，请稍等几秒</div>
                </div>
            </body>
            </html>
        """.trimIndent()
    }

    /**
     * 后台启动本地服务并等待就绪：
     * 本线程负责解包静态站点 + 阻塞跑 `apk_server.main()`；
     * 另起一条轮询线程每 250ms 打一次 `/api/health`，就绪后切首页，超时或服务退出则显示错误页。
     * 所有界面操作都回到主线程（runOnUiThread），绝不在后台线程碰 View。
     */
    private fun startHealthPolling() {
        try {
            healthExecutor.execute {
                // 先把静态站点解包到 filesDir/web，再启动 Python 服务。
                // 顺序很重要：apk_server 是从 <HOME>/web 读静态资源的，
                // 反过来的话首页第一次加载会命中 404。
                try {
                    syncWebAssets()
                } catch (t: Throwable) {
                    // 解包失败不致命：/api/health 仍可能正常，错误页/日志会给出线索。
                    lastError = t
                    Log.w(TAG, "静态站点解包失败", t)
                }

                // 用 AtomicBoolean 而不是普通局部变量：这两个标记由「服务线程」写、
                // 「轮询线程」读，普通局部变量没有跨线程可见性保证。
                val deadline = System.currentTimeMillis() + readyTimeoutMs
                val serviceStarted = AtomicBoolean(false)
                val ready = AtomicBoolean(false)

                // 与 main() 并行的健康检查线程：服务就绪 -> loadUrl；超时 -> 错误页。
                val poller = Thread({
                    while (!shuttingDown && System.currentTimeMillis() < deadline) {
                        // 服务还没起来（首次启动要解包 CPython，可能十几秒）就只等，不判失败。
                        if (!serviceStarted.get()) {
                            sleepQuietly(pollIntervalMs)
                            continue
                        }
                        if (probeHealth()) {
                            ready.set(true)
                            break
                        }
                        sleepQuietly(pollIntervalMs)
                    }

                    if (shuttingDown) {
                        return@Thread
                    }

                    runOnUiThread {
                        if (shuttingDown || isFinishing || isDestroyed) {
                            return@runOnUiThread
                        }
                        if (ready.get()) {
                            try {
                                webView?.loadUrl(appUrl)
                            } catch (t: Throwable) {
                                lastError = t
                                showError("界面加载失败：${t.message ?: "未知原因"}")
                            }
                        } else {
                            val reason = if (serviceStarted.get()) {
                                "内置服务已退出（启动失败，或 8765 端口被占用），未能就绪。"
                            } else {
                                "内置服务在 ${readyTimeoutMs / 1000} 秒内没能启动（首次安装需要解包 Python 运行时，" +
                                    "慢设备上可能更久）。"
                            }
                            showError("$reason\n$healthUrl\n${lastError?.message ?: ""}".trim())
                        }
                    }
                }, "mingli-health-poll")
                poller.isDaemon = true
                poller.start()

                // 自举服务是阻塞式 serve_forever()，占用本线程直到进程结束。
                serviceStarted.set(true)
                try {
                    Python.getInstance().getModule("apk_server").callAttr("main")
                } catch (t: Throwable) {
                    lastError = t
                    Log.e(TAG, "apk_server.main() 启动失败", t)
                }
                // main() 返回 = 服务已退出，它不可能再就绪了；标记后唤醒轮询线程立刻判失败，
                // 不必再干等满 20 秒。
                serviceStarted.set(false)
                poller.interrupt()
            }
        } catch (t: Throwable) {
            // 执行器已经关掉（例如 onCreate 后又立刻销毁）时不至于崩溃。
            lastError = t
            runOnUiThread { showError("后台任务启动失败：${t.message ?: "未知原因"}") }
        }
    }

    /** 休眠，被中断时恢复中断标记并立即返回（shutdown 时用）。 */
    private fun sleepQuietly(millis: Long) {
        try {
            Thread.sleep(millis)
        } catch (ie: InterruptedException) {
            Thread.currentThread().interrupt()
        }
    }

    /**
     * 打一次健康检查。连不上（Connection refused）属于正常现象：返回 false 继续轮询即可。
     */
    @Suppress("DEPRECATION")
    private fun probeHealth(): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            conn = URL(healthUrl).openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 1000
            conn.readTimeout = 2000
            // 不跟随重定向：只认这个地址自己返回的 200。
            conn.instanceFollowRedirects = false
            conn.useCaches = false

            val code = conn.responseCode

            // 读掉并关闭响应体，避免连接泄漏；错误流同样读掉。
            val body = if (code in 200..299) conn.inputStream else conn.errorStream
            try {
                body?.use { it.readBytes() }
            } catch (ignore: Throwable) {
                // 响应体读不出来不影响判定结果。
            }

            code == 200
        } catch (t: Throwable) {
            // 连接被拒绝 / 超时 / 任何 IO 异常：记下来，继续下一轮轮询。
            lastError = t
            false
        } finally {
            try {
                conn?.disconnect()
            } catch (ignore: Throwable) {
                // 断开失败无需处理。
            }
        }
    }

    /**
     * 把 APK 内的 `assets/web/`（整个目录）解包到 `<filesDir>/web`。
     *
     * 为什么必须做：apk_server 的站点根是文件系统上的 `<HOME>/web`（HOME = filesDir），
     * 而 assets 一直躺在 APK 压缩包里，Python 侧没有真实路径可读。
     *
     * 幂等：用 `<filesDir>/web/.assets-version` 记录已解包的版本号，
     * 版本一致就直接跳过（一次解包约 284 个文件 / 17MB，只需在首次启动或升级后做一次）。
     */
    private fun syncWebAssets() {
        val webDir = File(filesDir, WEB_DIR_NAME)
        val stampFile = File(webDir, WEB_STAMP_NAME)

        // versionName 里不会出现路径分隔符，可以安全作为标记内容。
        val stamp = "${packageName}:${BuildConfig.VERSION_NAME}"
        if (stampFile.isFile && stampFile.readText().trim() == stamp) {
            Log.i(TAG, "静态站点已是最新（$stamp），跳过解包")
        } else {
            if (webDir.exists()) {
                webDir.deleteRecursively()
            }
            webDir.mkdirs()

            val startedAt = System.currentTimeMillis()
            val count = try {
                copyAssetTree(WEB_ASSET_DIR, webDir)
            } catch (t: Throwable) {
                lastError = t
                Log.w(TAG, "解包 assets/$WEB_ASSET_DIR 失败", t)
                0
            }
            Log.i(TAG, "静态站点解包完成：$count 个文件，耗时 ${System.currentTimeMillis() - startedAt}ms -> ${webDir.absolutePath}")

            try {
                stampFile.writeText(stamp)
            } catch (t: Throwable) {
                // 写标记失败只是下次会重复解包一遍，不影响功能。
                lastError = t
            }
        }

        // 显式告诉 Python 侧站点在哪，不依赖 Chaquopy 对 HOME 的实现细节
        // （apk_server 的优先级是：参数 > MINGLI_WEB_ROOT > <HOME>/web）。
        // Android 10+ 可能拒绝反射改环境变量，失败也不致命，apk_server 会退回 <HOME>/web。
        try {
            setEnv("MINGLI_WEB_ROOT", webDir.absolutePath)
        } catch (t: Throwable) {
            Log.w(TAG, "设置 MINGLI_WEB_ROOT 失败，依赖 <HOME>/web 兜底", t)
        }
    }

    /** 反射写进程环境变量；失败时抛异常，由调用方决定是否忽略。 */
    @Suppress("UNCHECKED_CAST")
    private fun setEnv(key: String, value: String) {
        val processEnvironment = Class.forName("java.lang.ProcessEnvironment")
        val theEnvironmentField = processEnvironment.getDeclaredField("theEnvironment")
        theEnvironmentField.isAccessible = true
        val env = theEnvironmentField.get(null) as MutableMap<String, String>
        env[key] = value

        // Java 9+ 还维护了一份 theCaseInsensitiveEnvironment，一并更新避免不一致。
        try {
            val ciField = processEnvironment.getDeclaredField("theCaseInsensitiveEnvironment")
            ciField.isAccessible = true
            val ciEnv = ciField.get(null) as MutableMap<String, String>
            ciEnv[key] = value
        } catch (ignore: NoSuchFieldException) {
            // 旧版本没有这个字段，忽略。
        }
    }

    /** 递归把 assets 下某个相对目录里的文件解包到 [destDir]，返回拷贝的文件数。 */
    private fun copyAssetTree(assetPath: String, destDir: File): Int {
        // assets 里列不出来的文件（目录项缺失）就直接返回 0，由上层记日志。
        val children = assets.list(assetPath) ?: return 0

        var count = 0
        for (name in children) {
            val childAssetPath = if (assetPath.isEmpty()) name else "$assetPath/$name"
            val childDirs = assets.list(childAssetPath) ?: emptyArray()
            val dest = File(destDir, name)

            if (childDirs.isNotEmpty()) {
                // 目录：建出来再递归下去。
                dest.mkdirs()
                count += copyAssetTree(childAssetPath, dest)
            } else {
                // 文件：流式拷贝，避免把大文件整个读进内存。
                dest.parentFile?.mkdirs()
                assets.open(childAssetPath).use { input ->
                    FileOutputStream(dest).use { output ->
                        input.copyTo(output, ASSET_COPY_BUFFER)
                    }
                }
                count++
            }
        }
        return count
    }

    /**
     * 显示错误页：优先用打包在 assets 里的 error.html；
     * 读不到就用代码搭一个 LinearLayout，保证任何情况下都不是黑屏/白屏。
     */
    private fun showError(detail: String?) {
        val wv = webView
        if (wv != null) {
            try {
                val html = assets.open("error.html").use { input ->
                    input.bufferedReader(Charsets.UTF_8).readText()
                }
                wv.loadDataWithBaseURL(null, withDetail(html, detail), "text/html", "utf-8", null)
                return
            } catch (t: Throwable) {
                lastError = t
            }
        }

        try {
            setContentView(buildFallbackErrorView(detail))
        } catch (t: Throwable) {
            lastError = t
        }
    }

    /** 把错误详情以转义后的形式插到错误页正文末尾。 */
    private fun withDetail(html: String, detail: String?): String {
        if (detail.isNullOrBlank()) {
            return html
        }
        val escaped = detail
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        val block = "<div style=\"margin-top:18px;padding:12px 14px;border-radius:10px;" +
            "background:#fdecec;border:1px solid #f4c9c9;color:#9a1b1b;font-size:13px;" +
            "line-height:1.6;word-break:break-all;\">错误详情：$escaped</div>"
        val idx = html.lastIndexOf("</body>")
        return if (idx >= 0) {
            html.substring(0, idx) + block + html.substring(idx)
        } else {
            html + block
        }
    }

    /** 最后的兜底错误界面（纯代码，不依赖 assets 与任何 XML）。 */
    private fun buildFallbackErrorView(detail: String?): View {
        val density = resources.displayMetrics.density
        val dp = { v: Int -> (v * density + 0.5f).toInt() }

        val box = LinearLayout(this)
        box.orientation = LinearLayout.VERTICAL
        box.setPadding(dp(24), dp(32), dp(24), dp(24))
        box.setBackgroundColor(Color.WHITE)

        val title = TextView(this)
        title.text = "本地服务启动失败"
        title.setTextColor(Color.parseColor("#9A1B1B"))
        title.textSize = 20f
        title.gravity = Gravity.START
        box.addView(title)

        val message = TextView(this)
        message.text = "内置的本地服务在 20 秒内没有就绪。\n\n" +
            "1. 请在最近任务里完全退出应用，再从桌面重新打开；\n" +
            "2. 仍然失败，请卸载后重新安装本 APK。\n\n" +
            "查看日志：\n" +
            "adb logcat -s python.stdout python.stderr"
        message.textSize = 15f
        message.setTextColor(Color.parseColor("#23262B"))
        message.setPadding(0, dp(14), 0, 0)
        box.addView(message)

        if (!detail.isNullOrBlank()) {
            val detailView = TextView(this)
            detailView.text = "错误详情：$detail"
            detailView.textSize = 13f
            detailView.setTextColor(Color.parseColor("#6B7280"))
            detailView.setPadding(0, dp(14), 0, 0)
            box.addView(detailView)
        }

        val scroll = ScrollView(this)
        scroll.setBackgroundColor(Color.WHITE)
        scroll.addView(
            box,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )
        return scroll
    }

    /** 返回键：WebView 能后退就后退，否则交回系统。 */
    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        val wv = webView
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
            return
        }
        try {
            super.onBackPressed()
        } catch (t: Throwable) {
            lastError = t
        }
    }

    override fun onDestroy() {
        // 先置位：此后后台线程不会再触发任何界面回调。
        shuttingDown = true

        try {
            healthExecutor.shutdownNow()
        } catch (t: Throwable) {
            lastError = t
        }

        // 重要：绝不调用 Python.stop()，也不要以任何方式主动结束 Python 解释器。
        // Python 必须与整个进程同生命周期：Chaquopy 不支持在 Activity 销毁时停止解释器，
        // 一旦停掉，进程内残留的 Python 对象/桥接引用再次被使用时会导致崩溃且无法恢复。
        // 进程被系统回收时，Python 自然随之结束——这正是期望的行为。
        // （另外，不要在这里释放 webView 后继续使用，交给 GC 即可。）

        try {
            super.onDestroy()
        } catch (t: Throwable) {
            lastError = t
        }
    }

    companion object {
        private const val TAG = "MainActivity"

        /** APK 内静态站点所在目录（由 sync 脚本从 frontend/public 拷入）。 */
        private const val WEB_ASSET_DIR = "web"

        /** 解包到 filesDir 下的目录名；apk_server 默认站点根即 <HOME>/web。 */
        private const val WEB_DIR_NAME = "web"

        /** 记录已解包的版本号，避免每次启动都重解包。 */
        private const val WEB_STAMP_NAME = ".assets-version"

        /** 解包用的缓冲区大小（128KB）。 */
        private const val ASSET_COPY_BUFFER = 128 * 1024
    }
}
