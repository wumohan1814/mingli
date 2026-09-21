# -*- coding: utf-8 -*-
"""运行形态与版本契约 API（2026-09-22 用户拍板：补「同源构建 + 版本契约」地基）。

`GET /api/runtime` —— 前端**启动即读**的唯一形态/版本入口：
  1. 前端据此决定渲染哪些能力（有没有账号/计费/分享/本机素材与 Prompt 管理）；
  2. APK 壳与服务器据此判定「这个壳配这个服务器行不行」（兼容矩阵见
     `docs/standards/08-运行形态与版本契约.md`）。

**无鉴权**（有意为之）：形态要在登录之前就知道（登录页本身就要按 `auth` 能力决定
渲染），且响应不含任何敏感信息（只有形态名、能力布尔、两个版本号）。

响应信封与其它 `/api` 接口一致：`{"code": 0, "message": "ok", "data": {...}}`。
"""
from fastapi import APIRouter

from app.runtime import capabilities, current_mode
from app.version import API_VERSION, APP_VERSION

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("")
def get_runtime():
    """当前运行形态 + 能力清单 + 版本契约（服务器端权威答案）。"""
    mode = current_mode()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "mode": mode,
            "capabilities": capabilities(mode),
            "api_version": API_VERSION,
            "app_version": APP_VERSION,
        },
    }
