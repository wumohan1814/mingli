package com.mingli.apk

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import org.json.JSONTokener
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * PaipanBridge —— 「去 Node」路线：Python ↔ Java ↔ WebView(V8) ↔ JS 排盘内核。
 *
 * 契约（兄弟子代理的 MainActivity 直接调用，**签名不可改**）：
 *   PaipanBridge.init(ctx: Context)
 *   PaipanBridge.call(path: String, payloadJson: String, timeoutMs: Long = 60000): String
 *
 * 形态：
 *   - 内部持有一个**离屏 WebView**（不 attach 到界面；见 [attachTo] 的逃生舱）；
 *   - **所有 WebView 操作都在主线程**：`call()` 从任意线程进入 → `Handler(mainLooper).post`
 *     → `evaluateJavascript` → 回调里 `latch.countDown()`；调用线程只 `CountDownLatch.await`；
 *   - **不抛异常给 Python**：初始化失败 / 超时 / JS 异常一律返回 `{"error": "...", ...}` JSON；
 *   - 不用 `addJavascriptInterface`：结果经 `evaluateJavascript` 的返回值回传（路径最短、无反射桥）。
 *
 * bundle 注入（assets/paipan/paipan-bundle.js，约 2.6MB）：
 *   一次性把 2.6MB 交给 `evaluateJavascript` 在部分 ROM 上不稳，故**分块注入**：
 *   256/512KB 一段追加进 `globalThis.__MINGLI_SRC`，最后 `(0,eval)` 一次执行；
 *   注入完成后调 `setTimezoneOffsetMinutes(480)`（契约第 5 条，替代 qimen 等处的本地时区构造）。
 *
 * 结果回传（防截断）：
 *   JS 把 dispatch 的输出暂存到 `globalThis.__MINGLI_LAST_RESULT`，只回 `{len, head}`；
 *   大于 [INLINE_RESULT_LIMIT] 时由 Kotlin 侧分块 `substr` 取回（黄历择日等可达数 MB）。
 *
 * 仅用平台 API（`android.webkit` / `android.os` / `org.json`），**不引入任何新依赖**
 * （`androidx.webkit` 的 WebViewAssetLoader 需要改 build.gradle，本文件刻意不用）。
 *
 * 线程安全：`init` 幂等；`ready` / `webView` 均为 `@Volatile`；多线程并发 `call` 各自持独立 latch。
 */
object PaipanBridge {

    private const val TAG = "PaipanBridge"

    /** bundle 产物路径（生成物，不入库；由 apk/tools/build-paipan-bundle.mjs 产出）。 */
    private const val BUNDLE_ASSET = "paipan/paipan-bundle.js"

    /** 给 WebView 一个「正常 origin」，避免 file:// 的额外限制；不发起任何网络请求。 */
    private const val BRIDGE_URL = "https://mingli.local/paipan-bridge"

    private const val BRIDGE_HTML =
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<title>paipan-bridge</title></head><body></body></html>"

    /** 注入时每段的字符数（bundle 2.6MB → 约 6 段）。 */
    private const val INJECT_CHUNK = 512 * 1024

    /** 取回大结果时每段的字符数。 */
    private const val RESULT_CHUNK = 256 * 1024

    /** 结果小于此长度就直接随返回值带回，否则分块取。 */
    private const val INLINE_RESULT_LIMIT = 256 * 1024

    /** `call()` 契约默认超时 60000ms。 */
    private const val DEFAULT_TIMEOUT_MS = 60000L

    /** `init()` 内部等待 bundle 就绪的上限。 */
    private const val INIT_TIMEOUT_MS = 60000L

    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var webView: WebView? = null

    @Volatile
    private var ready = false

    @Volatile
    private var lastError: String? = null

    @Volatile
    private var injectedGeneration = 0

    // -----------------------------------------------------------------------
    // 对外契约 API
    // -----------------------------------------------------------------------

    /**
     * 初始化：建离屏 WebView → 注入 bundle → `setTimezoneOffsetMinutes(480)`。
     * 幂等（已就绪时直接返回）；从任意线程调用安全；绝不抛异常。
     */
    @JvmStatic
    fun init(ctx: Context) {
        if (ready) return
        if (Looper.myLooper() == Looper.getMainLooper()) {
            doInit(ctx)
            return
        }
        val latch = CountDownLatch(1)
        mainHandler.post {
            try {
                doInit(ctx)
            } catch (t: Throwable) {
                lastError = "init 异常: ${t.javaClass.simpleName}: ${t.message}"
                Log.e(TAG, "init failed", t)
            } finally {
                latch.countDown()
            }
        }
        try {
            latch.await(INIT_TIMEOUT_MS + 5000L, TimeUnit.MILLISECONDS)
        } catch (ie: InterruptedException) {
            Thread.currentThread().interrupt()
            lastError = "init 被中断"
        }
    }

    /**
     * 调用 bundle 的一条路由。**同步阻塞**（内部用 latch 等主线程回调），从任意线程安全。
     *
     * @param path        形如 `/ziwei` `/extra` `/zodiac` `/tarot` `/astrology` `/divination`
     * @param payloadJson 请求体 JSON 字符串（可为 `""`，等价 `{}`）
     * @param timeoutMs   超时上限，超时返回 `{"error":"bridge_timeout",...}`
     * @return 排盘结果 JSON 字符串；**任何失败都返回错误 JSON，从不抛异常**
     */
    @JvmStatic
    @JvmOverloads
    fun call(path: String, payloadJson: String, timeoutMs: Long = DEFAULT_TIMEOUT_MS): String {
        val wv = webView
        if (wv == null || !ready) {
            return errorJson(
                "bridge_not_initialized",
                "bundle 未就绪（先 init(ctx)）：${lastError ?: "webview/bundle 尚未注入完成"}",
            )
        }
        val effectiveTimeout = if (timeoutMs <= 0L) DEFAULT_TIMEOUT_MS else timeoutMs
        val payload = payloadJson ?: ""
        val script = buildString {
            append("(function(){var v;try{v=globalThis.__MINGLI_PAIPAN.dispatch(")
            append(jsString(path ?: ""))
            append(",")
            append(jsString(payload))
            append(");}catch(e){v=JSON.stringify({error:'bridge_js_exception: '+String((e&&e.message)||e)});}")
            append("if(typeof v!=='string'){v=String(v);}")
            append("globalThis.__MINGLI_LAST_RESULT=v;")
            append("return {len:v.length,head:v.length<=")
            append(INLINE_RESULT_LIMIT)
            append("?v:null};})()")
        }

        val latch = CountDownLatch(1)
        val out = arrayOfNulls<String>(1)

        mainHandler.post {
            try {
                wv.evaluateJavascript(script) { raw ->
                    try {
                        val node = JSONTokener(if (raw == null || raw == "null") "{}" else raw).nextValue()
                        if (node !is JSONObject) {
                            out[0] = errorJson("bridge_bad_result", "dispatch 返回值非对象: ${truncate(raw)}")
                            latch.countDown()
                            return@evaluateJavascript
                        }
                        val head = if (node.isNull("head")) null else node.optString("head")
                        if (head != null) {
                            out[0] = head
                            latch.countDown()
                        } else {
                            val len = node.optInt("len", -1)
                            if (len < 0) {
                                out[0] = errorJson("bridge_bad_result", "dispatch 返回长度异常: ${truncate(raw)}")
                                latch.countDown()
                            } else {
                                fetchResultInChunks(wv, len, out, latch)
                            }
                        }
                    } catch (t: Throwable) {
                        out[0] = errorJson("bridge_callback_error", "${t.javaClass.simpleName}: ${t.message}")
                        latch.countDown()
                    }
                }
            } catch (t: Throwable) {
                out[0] = errorJson("bridge_eval_error", "${t.javaClass.simpleName}: ${t.message}")
                latch.countDown()
            }
        }

        val finished = try {
            latch.await(effectiveTimeout, TimeUnit.MILLISECONDS)
        } catch (ie: InterruptedException) {
            Thread.currentThread().interrupt()
            return errorJson("bridge_interrupted", "调用线程被中断")
        }
        if (!finished) {
            // 注意：迟到的 JS 回调只会写各自局部数组，不会串到后续调用；
            // 但若 JS 侧陷入死循环，后续调用会排队——需要时用 reset() 重灌 bundle。
            return errorJson("bridge_timeout", "等待 WebView 结果超过 ${effectiveTimeout}ms")
        }
        return out[0] ?: errorJson("bridge_no_result", "回调已触发但未拿到结果")
    }

    /** bundle 是否已注入并完成 `setTimezoneOffsetMinutes(480)`。 */
    @JvmStatic
    fun isReady(): Boolean = ready

    /** 最近一次初始化/注入失败的原因（成功时为 null）。 */
    @JvmStatic
    fun lastError(): String? = lastError

    /** 逃生舱：重灌 bundle（超时后 JS 卡死时使用）。不抛异常。 */
    @JvmStatic
    fun reset() {
        ready = false
        lastError = null
        mainHandler.post {
            try {
                val wv = webView ?: return@post
                injectedGeneration += 1
                wv.reload()
            } catch (t: Throwable) {
                lastError = "reset 异常: ${t.javaClass.simpleName}: ${t.message}"
                Log.e(TAG, "reset failed", t)
            }
        }
    }

    /**
     * 逃生舱（可选）：若某 ROM 上「未 attach 的 WebView 不执行 JS」，
     * MainActivity 可把桥接 WebView attach 进自己的容器（1x1、不可见）。
     * 必须在主线程调用；不抛异常。
     */
    @JvmStatic
    fun attachTo(container: ViewGroup) {
        val run = Runnable {
            try {
                val wv = webView ?: return@Runnable
                if (wv.parent === container) return@Runnable
                (wv.parent as? ViewGroup)?.removeView(wv)
                wv.visibility = View.INVISIBLE
                container.addView(wv, ViewGroup.LayoutParams(1, 1))
            } catch (t: Throwable) {
                lastError = "attachTo 异常: ${t.javaClass.simpleName}: ${t.message}"
                Log.e(TAG, "attachTo failed", t)
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) run.run() else mainHandler.post(run)
    }

    // -----------------------------------------------------------------------
    // 内部：初始化与注入
    // -----------------------------------------------------------------------

    private fun doInit(ctx: Context) {
        // 约定：只在主线程调用（init 已保证）
        try {
            val appCtx = ctx.applicationContext ?: ctx
            val existing = webView
            if (existing == null) {
                val wv = WebView(appCtx)
                wv.settings.javaScriptEnabled = true
                wv.settings.domStorageEnabled = true
                wv.settings.cacheMode = WebSettings.LOAD_NO_CACHE
                wv.settings.allowFileAccess = false
                wv.settings.allowContentAccess = false
                wv.settings.setSupportZoom(false)
                wv.settings.javaScriptCanOpenWindowsAutomatically = false
                wv.isVerticalScrollBarEnabled = false
                wv.isHorizontalScrollBarEnabled = false
                // 不 attach 到界面：手动给 1x1 尺寸，让布局/合成器有确定性尺寸
                val one = View.MeasureSpec.makeMeasureSpec(1, View.MeasureSpec.EXACTLY)
                wv.measure(one, one)
                wv.layout(0, 0, 1, 1)
                wv.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        injectBundle(view ?: wv)
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?,
                    ) {
                        val mainFrame = request?.isForMainFrame ?: true
                        if (mainFrame) {
                            lastError = "WebView 载入失败: ${error?.errorCode} ${error?.description}"
                            Log.e(TAG, lastError!!)
                        }
                    }
                }
                wv.webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        Log.i(TAG, "js-console: ${consoleMessage?.message()}")
                        return true
                    }
                }
                webView = wv
                wv.loadDataWithBaseURL(BRIDGE_URL, BRIDGE_HTML, "text/html", "utf-8", null)
            } else {
                injectBundle(existing)
            }
        } catch (t: Throwable) {
            lastError = "doInit 异常: ${t.javaClass.simpleName}: ${t.message}"
            Log.e(TAG, "doInit failed", t)
        }
    }

    /** 分块把 assets 里的 bundle 灌进 WebView，最后一次 eval 执行。 */
    private fun injectBundle(wv: WebView) {
        if (ready) return
        val myGeneration = injectedGeneration
        val src = try {
            readAsset(wv.context, BUNDLE_ASSET)
        } catch (t: Throwable) {
            lastError = "读取 assets/$BUNDLE_ASSET 失败: ${t.javaClass.simpleName}: ${t.message}"
            Log.e(TAG, lastError!!)
            return
        }
        if (src.isEmpty()) {
            lastError = "assets/$BUNDLE_ASSET 内容为空（先跑 apk/tools/build-paipan-bundle.mjs）"
            Log.e(TAG, lastError!!)
            return
        }

        Log.i(TAG, "注入 bundle: ${src.length} chars，分段 ${INJECT_CHUNK}")
        wv.evaluateJavascript("globalThis.__MINGLI_SRC='';globalThis.__MINGLI_PAIPAN=null;", null)

        var offset = 0
        // 主线程同步发号：同源 evaluateJavascript 按提交顺序执行（FIFO），故各段追加顺序稳定。
        while (offset < src.length) {
            val end = minOf(offset + INJECT_CHUNK, src.length)
            val chunk = src.substring(offset, end)
            offset = end
            wv.evaluateJavascript(
                "globalThis.__MINGLI_SRC=(globalThis.__MINGLI_SRC||'')+${jsString(chunk)};",
                null,
            )
        }

        // 最后一次：真正执行 bundle（IIFE 内挂 globalThis.__MINGLI_PAIPAN）
        wv.evaluateJavascript(
            "(function(){try{var s=globalThis.__MINGLI_SRC||'';globalThis.__MINGLI_SRC=null;" +
                "(0,eval)(s);" +
                "if(!globalThis.__MINGLI_PAIPAN){return 'err:__MINGLI_PAIPAN 未挂载';}" +
                "return 'ok:'+globalThis.__MINGLI_PAIPAN.setTimezoneOffsetMinutes(480);" +
                "}catch(e){return 'err:'+String((e&&e.message)||e);}})()",
        ) { raw ->
            if (myGeneration != injectedGeneration) return@evaluateJavascript // 期间被 reset()
            val r = unquote(raw)
            if (r != null && r.startsWith("ok:")) {
                ready = true
                lastError = null
                Log.i(TAG, "bundle 就绪，时区偏移 = ${r.removePrefix("ok:")} 分钟")
            } else {
                ready = false
                lastError = "bundle 注入失败: ${truncate(r ?: raw)}"
                Log.e(TAG, lastError!!)
            }
        }
    }

    /** 大结果分块取回；每段都是一次独立的主线程 evaluateJavascript。 */
    private fun fetchResultInChunks(wv: WebView, total: Int, out: Array<String?>, latch: CountDownLatch) {
        val sb = StringBuilder(total)
        var offset = 0

        fun step() {
            if (offset >= total) {
                out[0] = sb.toString()
                latch.countDown()
                return
            }
            val take = minOf(RESULT_CHUNK, total - offset)
            val start = offset
            wv.evaluateJavascript(
                "(globalThis.__MINGLI_LAST_RESULT||'').substr($start,$take)",
            ) { raw ->
                try {
                    val piece = unquote(raw)
                    if (piece == null) {
                        out[0] = errorJson("bridge_chunk_failed", "分段取回失败 @$start（返回值非法）")
                        latch.countDown()
                        return@evaluateJavascript
                    }
                    sb.append(piece)
                    offset += piece.length
                    if (piece.isEmpty() && offset < total) {
                        out[0] = errorJson(
                            "bridge_chunk_stalled",
                            "分段取回停滞 @$offset/$total（JS 侧结果被改写？）",
                        )
                        latch.countDown()
                        return@evaluateJavascript
                    }
                    step()
                } catch (t: Throwable) {
                    out[0] = errorJson("bridge_callback_error", "${t.javaClass.simpleName}: ${t.message}")
                    latch.countDown()
                }
            }
        }
        step()
    }

    // -----------------------------------------------------------------------
    // 小工具
    // -----------------------------------------------------------------------

    /** JS 字符串字面量（正确转义引号/反斜杠/控制字符/行分隔符）。 */
    private fun jsString(s: String): String = try {
        JSONObject.quote(s)
    } catch (t: Throwable) {
        "\"\""
    }

    /** 把 evaluateJavascript 的返回值（JSON 序列化后的值）还原为 Kotlin 字符串。 */
    private fun unquote(raw: String?): String? {
        if (raw == null || raw == "null") return null
        return try {
            val v = JSONTokener(raw).nextValue()
            when (v) {
                is String -> v
                is JSONObject -> v.toString()
                else -> v?.toString()
            }
        } catch (t: Throwable) {
            null
        }
    }

    private fun errorJson(kind: String, detail: String): String = try {
        JSONObject()
            .put("error", kind)
            .put("detail", detail)
            .put("bridge", "paipan-webview-iife")
            .toString()
    } catch (t: Throwable) {
        "{\"error\":\"$kind\",\"detail\":\"errorJson 构造失败\"}"
    }

    private fun truncate(s: String?, max: Int = 400): String {
        if (s == null) return "null"
        return if (s.length <= max) s else s.substring(0, max) + "…(共 ${s.length} 字符)"
    }

    private fun readAsset(ctx: Context, name: String): String {
        val sb = StringBuilder(3 * 1024 * 1024)
        ctx.assets.open(name).use { input ->
            val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))
            val buf = CharArray(64 * 1024)
            while (true) {
                val n = reader.read(buf)
                if (n <= 0) break
                sb.append(buf, 0, n)
            }
        }
        return sb.toString()
    }
}
