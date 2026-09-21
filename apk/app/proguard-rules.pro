# 命理 · 胖 APK —— R8/ProGuard 规则
#
# 现状：release 构建块里 isMinifyEnabled = false（POC-0 不混淆），因此本文件当前
# **不承载任何必须的规则**，存在的意义是让 `assembleRelease` 不会因为「引用了不存在的
# 规则文件」而失败（release 块里 proguardFiles(... "proguard-rules.pro") 是真引用）。
#
# 将来要开混淆时，注意这些**不能被裁掉**的入口（Chaquopy / 反射调用）：
#   - com.mingli.apk.PaipanBridge   —— Python 侧经 jclass("com.mingli.apk.PaipanBridge") 反射调用
#   - com.mingli.apk.MainActivity   —— 清单里的启动入口
#   - Chaquopy 运行时自身的类（其 AAR 自带 consumer 规则，通常无需手写）
# 开混淆前请先跑一次真机：排盘桥接与 WebView 加载各验一遍，再决定是否保留本文件为空。
