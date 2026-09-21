# -*- coding: utf-8 -*-
"""运行形态（渠道开关）与能力清单 · 单一事实源（2026-09-22 用户拍板）。

**要解决什么**：同一份代码要支撑三种形态，但三种形态下「有没有账号 / 有没有计费 /
本机能不能管素材与 Prompt / LLM key 从哪来」并不一样。若让每处代码各自
`if mode == ...`，很快就会出现互相矛盾的判断；故**能力判断只允许走本文件**。

三种形态（`MINGLI_RUNTIME_MODE`，见 `app/config.py`）：
- `web`（**默认，= 现状**）：自有服务器形态。有账号 / 计费 / 分享 / 后台 admin；
  LLM key 由服务端运维配置（用户侧无自填入口）。
- `apk-local`：APK 单机形态。无账号、无计费、无分享；数据在本机；**LLM key 由
  安装者在应用内自填**；本机「设置」即管理面（素材 / Prompt 归本机）。
- `apk-client`：APK 客户端形态（壳指向用户自部署的服务器）。业务能力**跟随服务器**，
  故本文件的该形态取值与 `web` 一致，差异只在「本机不再提供 admin / 素材 / Prompt
  三组管理」（那三件事归服务器）。

**兼容纪律（重要）**：`apk-client` 下前端读到的是**服务器**返回的 `/api/runtime`
（`mode=web`）——本地内嵌后端处于休眠、不参与对外应答。本文件里 `APK_CLIENT` 的取值
描述的是「壳自身承担的职责面」，用于壳侧渲染决策，不是取代服务器答案。

**新增能力怎么做**：一律来 `capabilities()` 加键 + 加一行注释说明「哪个形态开/关、
为什么」，**不要在业务代码里另写形态判断**；新功能默认双端同源（形态专属项才登记差异）。
"""
from typing import Dict, Optional

from app.config import settings

# 合法形态值（配置里写了别的值 → 见 current_mode()，按 web 兜底并告警）
WEB = "web"
APK_LOCAL = "apk-local"
APK_CLIENT = "apk-client"

VALID_MODES = (WEB, APK_LOCAL, APK_CLIENT)


def current_mode() -> str:
    """当前运行形态（`MINGLI_RUNTIME_MODE`）。

    缺省 / 非法值一律**按 `web` 处理**：默认必须等于现状（线上行为零变化），
    且配置写错时宁可退回「老行为」也不要把自己锁成单机形态。
    """
    raw = (getattr(settings, "runtime_mode", "") or "").strip().lower()
    if raw in VALID_MODES:
        return raw
    return WEB


def capabilities(mode: Optional[str] = None) -> Dict[str, bool]:
    """能力清单（**唯一事实源**）：键 = 能力名，值 = 该形态下是否具备。

    `mode` 省略时取 `current_mode()`；显式传入用于测试与文档对照。
    **返回新 dict**（调用方随便改都不会污染全局判断）。
    """
    m = mode if mode in VALID_MODES else current_mode()
    is_web = m == WEB
    is_local = m == APK_LOCAL
    # apk-client：业务能力跟随服务器 → 与 web 同；本机管理面关闭
    is_client = m == APK_CLIENT

    return {
        # 账号体系（注册 / 登录 / JWT / 档案归属服务器）
        # web 现状 = 有；apk-local = 无（单用户直用，无登录态）；apk-client = 有（服务器账号）
        "auth": is_web or is_client,
        # 积分与逐法扣费（红线⑤口径）
        # web = 有；apk-local = 无（整条摘除，深度解读改「用我的 API」）；apk-client = 跟随服务器
        "credits": is_web or is_client,
        # 档案分享链接（case_share / MBTI 分享）
        # web = 有；apk-local = 无（无服务器可承接链接）；apk-client = 跟随服务器
        "share": is_web or is_client,
        # 本机管理后台（admin.html 5 分区）
        # web = 服务器后台；apk-local = 本机即管理面；apk-client = 归服务器（本机不渲染）
        "admin": is_web or is_local,
        # Prompt 管理（23 个 prompt 的查看/编辑/回滚）
        # web = 后台可改（热生效）；apk-local = 改本机随包那份；apk-client = 归服务器
        "prompt_mgmt": is_web or is_local,
        # 素材管理（背景/蒙版/卡面替换）
        # web = 后台上传替换；apk-local = 本机替换/恢复默认；apk-client = 归服务器
        "asset_mgmt": is_web or is_local,
        # 用户自填 LLM key（自备 API）
        # web = 无（key 是服务端运维配置，用户侧不给入口）；apk-local = 有（不填则 LLM 功能引导提示）；
        # apk-client = 无（走服务器的 key，设备不直连 LLM）
        "byo_llm_key": is_local,
        # 服务端埋点上报与运营报表
        # web = 有（events 全量）；apk-local = 无（最多本地日志）；apk-client = 跟随服务器
        "events_report": is_web or is_client,
        # 排盘引擎在本机跑
        # web = 否（服务器 Node 常驻）；apk-local = 是（JS 内核随包 + WebView 内执行）；
        # apk-client = 否（服务器排盘）
        "paipan_local": is_local,
    }
