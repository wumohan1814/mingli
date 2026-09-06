# -*- coding: utf-8 -*-
"""金数据开放 API v1 客户端。

文档：https://open.jinshuju.net（个人 Access Token，Bearer 认证，100 次/小时）。
免费版仅 API 轮询可用（无 webhook），网络方向为「我们主动拉金数据」。

返回形如 {"count": N, "entries": [{serial_number, trade_status, field_1, field_2, ...}, ...]}。
"""
import httpx

from app.config import settings


async def fetch_entries(page: int = 1, per_page: int = 50) -> dict:
    """拉取充值表单条目（分页），HTTP 失败 raise；成功返回响应 JSON。

    - path: GET {api_base}/forms/{form_token}/entries
    - auth: Authorization: Bearer {access_token}
    """
    url = f"{settings.jinshuju_api_base}/forms/{settings.jinshuju_form_token}/entries"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {settings.jinshuju_access_token}"},
            params={"page": page, "per_page": per_page},
        )
        resp.raise_for_status()
        return resp.json()
