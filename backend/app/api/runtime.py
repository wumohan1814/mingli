# -*- coding: utf-8 -*-
"""运行形态与版本契约 API（2026-09-22 用户拍板：补「同源构建 + 版本契约」地基）。

`GET /api/runtime` —— 前端**启动即读**的唯一形态/版本入口：
  1. 前端据此决定渲染哪些能力（有没有账号/计费/分享/本机素材与 Prompt 管理）；
  2. APK 壳与服务器据此判定「这个壳配这个服务器行不行」（兼容矩阵见
     `docs/standards/08-运行形态与版本契约.md`）。

**无鉴权**（有意为之）：形态要在登录之前就知道（登录页本身就要按 `auth` 能力决定
渲染），且响应不含任何敏感信息（只有形态名、能力布尔、两个版本号）。

⚠️ **节166 起多了一个可选字段 `local_token`**：单机形态（`apk-local`）下前端没有登录入口，
拿不到 token 则所有 `/api/*` 都会 400。故本端点在**两个条件同时成立**时下发一个
本机 token：① `auth` 能力为假（只有单机形态满足）② **请求来自回环地址**。
判定与理由见 `app/local_session.py` —— 第②条是自我执行的护栏，即使误绑 `0.0.0.0`
局域网也拿不到。非单机形态下**该字段不存在**，响应形状与改前一致。

响应信封与其它 `/api` 接口一致：`{"code": 0, "message": "ok", "data": {...}}`。
"""
from fastapi import APIRouter, Request

from app.local_session import issue_local_token
from app.runtime import capabilities, current_mode
from app.version import API_VERSION, APP_VERSION

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("")
def get_runtime(request: Request):
    """当前运行形态 + 能力清单 + 版本契约（服务器端权威答案）。"""
    mode = current_mode()
    data = {
        "mode": mode,
        "capabilities": capabilities(mode),
        "api_version": API_VERSION,
        "app_version": APP_VERSION,
    }
    # 单机形态：本机（回环）请求顺带下发 token，使前端免登录即可调用业务端点。
    # 非单机形态 / 非回环来源 → None → **不加该键**（保持既有响应形状）。
    local_token = issue_local_token(request.client.host if request.client else None)
    if local_token:
        data["local_token"] = local_token
    return {"code": 0, "message": "ok", "data": data}
