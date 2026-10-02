# -*- coding: utf-8 -*-
"""节166：单机形态（`apk-local`）的**本机会话** —— 解决「免登录 ≠ 无 token」。

## 要解决什么

`apk-local` 形态下 `capabilities()['auth']` 为假（前端不渲染登录/注册），
但**后端全部业务端点仍要求 `Authorization` 头**（这是红线③「多用户隔离」的实现方式：
`user_id` 由 JWT 取出并注入所有查询）。
两者直接冲突：单机形态下**没有任何地方能产出 token** → 所有 `/api/*` 都会 400，应用等于不可用。
（实测取证：不带鉴权请求 `GET /api/combine/pools` → `400 {"code":1001,...}`。）

## 怎么做（只加这一处机制）

本机服务**自动预置一个本地用户**并**自动签发 token**：

- **本地用户**：用户名固定 `local`，密码为随机值、**从不展示、从不落明文**
  （`password_hash` 沿用既有 `hash_password`，salts 随机，因此这串密码没有实际用途）；
- **token**：走既有的 `create_access_token`，与真实登录用户**完全同一条代码路径** ——
  于是 JWT 校验、`user_id` 注入、多用户隔离查询**一行都不用改**，
  也**不需要在业务代码里散写形态判断**（`standards/08` §2.3 的硬纪律）。

## 安全边界（为什么可以这样做）

token **只在两个条件同时成立时**才签发：

1. `capabilities()['auth']` 为假 —— 即**只有单机形态**满足；web / apk-client 有账号体系，
   永远走不到这里；
2. **请求来自回环地址**（`request.client.host` ∈ 127.0.0.0/8 或 ::1）。

第 2 条是**自我执行**的护栏：即使有人误把单机形态绑到 `0.0.0.0`，局域网来的请求
也拿不到 token（`apk_asgi` 默认绑 `127.0.0.1`，见该文件 `DEFAULT_HOST`）。
"""
from __future__ import annotations

import ipaddress
import logging
import secrets
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.router import create_access_token, hash_password
from app.database import AnalyticsSession
from app.models import User
from app.runtime import capabilities

logger = logging.getLogger(__name__)

#: 单机形态固定使用的本地用户名（只此一个，永不参与登录）
LOCAL_USERNAME = "local"

#: 本机 token 的有效期：**30 天**。
#:
#: **为什么不用 `settings.access_token_ttl`（默认 1800 秒 = 30 分钟）**：
#: 单机形态**没有登录页** —— token 一过期，前端 `api()` 的 401 分支就会清 token
#: 并跳登录页，而单机形态根本没有那个页面，等于**死路**（实测缺口）。
#: 而一次断前尘 / 合参流程本身就可能跑几分钟，30 分钟的窗口在真实使用里会被跨过。
#:
#: 本机 token 也不是「一次登录会话」那个语义：它**每次启动都会被重新签发**，
#: 且**只能从回环地址取到**（见 `local_session_allowed`），所以给它一个足够长的
#: 有效期、把「用着用着突然卡住」这一整类问题消掉，是更合适的设计。
LOCAL_TOKEN_TTL_SECONDS = 30 * 24 * 3600

_LOOPBACK_HOSTNAMES = frozenset({"localhost", "localhost.localdomain"})


def is_loopback(host: Optional[str]) -> bool:
    """请求来源是否为回环地址。

    `None` / 空串 / 非法 IP / 非回环 IP 一律 **False**（fail closed）。
    """
    if not host:
        return False
    candidate = host.strip().strip("[]")  # IPv6 可能带方括号
    if candidate.lower() in _LOOPBACK_HOSTNAMES:
        return True
    try:
        return ipaddress.ip_address(candidate).is_loopback
    except ValueError:
        return False


def local_session_allowed(client_host: Optional[str]) -> bool:
    """是否允许给这个请求签发本机 token（两个条件同时成立）。"""
    if capabilities().get("auth"):
        return False  # web / apk-client：有账号体系，绝不自动签发
    return is_loopback(client_host)


def ensure_local_user(db: Session) -> int:
    """取或创建本地用户，返回其 `user_id`。幂等。

    并发下可能撞 `username` 唯一约束 → 捕 `IntegrityError` 回滚后重查（不抛给调用方）。
    """
    user = db.query(User).filter_by(username=LOCAL_USERNAME).first()
    if user is not None:
        return user.id

    user = User(username=LOCAL_USERNAME,
                password_hash=hash_password(secrets.token_urlsafe(32)))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(User).filter_by(username=LOCAL_USERNAME).first()
        if existing is None:
            raise
        return existing.id
    db.refresh(user)
    logger.info("单机形态：已预置本地用户 %r（id=%s）", LOCAL_USERNAME, user.id)
    return user.id


def issue_local_token(client_host: Optional[str]) -> Optional[str]:
    """按安全边界决定是否签发本机 token。

    允许（单机形态 + 回环）→ 返回可用的 access token；否则 **None**。
    **不抛异常**（token 拿不到只应导致「前端仍要登录」，不应让 `/api/runtime` 500）。
    """
    if not local_session_allowed(client_host):
        return None
    db = AnalyticsSession()
    try:
        return create_access_token(ensure_local_user(db), LOCAL_TOKEN_TTL_SECONDS)
    except Exception as exc:  # noqa: BLE001
        logger.warning("单机形态：签发本机 token 失败（按未登录处理）：%s: %s",
                       type(exc).__name__, exc)
        return None
    finally:
        db.close()
