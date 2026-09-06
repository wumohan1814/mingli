"""后台鉴权（独立于 C 端 JWT：payload type=admin）。

- 账号存于 taichu_ops.admin_users（与 C 端 users 分离）；
- 密码哈希复用 app.auth.router 的 hash_password/verify_password（hashlib pbkdf2）；
- 令牌为 python-jose HS256 JWT，含 role 与 type=admin，与 C 端 access token 互不通用。
"""
from datetime import datetime, timedelta

from fastapi import Header
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.auth.router import verify_password
from app.config import settings
from app.errors import BizError, ERR_UNAUTHORIZED, ERR_FORBIDDEN
from app.models.ops import AdminUser

# 后台角色优先级（数值大者权限高）：admin > operator > viewer
ROLE_RANK = {"viewer": 1, "operator": 2, "admin": 3}


def role_rank(role: str) -> int:
    """角色 → 优先级数值；未知角色视为 0（无任何权限）。"""
    return ROLE_RANK.get(role or "", 0)


def create_admin_token(admin_id: int, role: str) -> str:
    """签发后台 JWT（HS256，type=admin）。"""
    expire = datetime.utcnow() + timedelta(seconds=settings.access_token_ttl)
    payload = {"sub": str(admin_id), "role": role, "type": "admin", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_admin_from_token(authorization: str) -> tuple[int, str]:
    """解析 Authorization Bearer → (admin_id, role)。

    缺失 / 解析失败 / type 非 admin / role 缺失 一律抛 BizError 未登录。
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise BizError(ERR_UNAUTHORIZED, "未登录")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise BizError(ERR_UNAUTHORIZED, "未登录")
    if payload.get("type") != "admin" or not payload.get("role"):
        raise BizError(ERR_UNAUTHORIZED, "未登录")
    try:
        admin_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise BizError(ERR_UNAUTHORIZED, "未登录")
    return admin_id, str(payload["role"])


def require_role(min_role: str):
    """FastAPI 依赖工厂：要求后台角色 ≥ min_role。

    用法：Depends(require_role("operator"))；返回 dict {admin_id, role}，
    供写动作（审计日志等）取当前操作者。
    """
    if min_role not in ROLE_RANK:
        raise ValueError(f"未知后台角色: {min_role}")

    def _checker(authorization: str = Header(default="")) -> dict:
        admin_id, role = get_admin_from_token(authorization)
        if role_rank(role) < role_rank(min_role):
            raise BizError(ERR_FORBIDDEN, "无权限")
        return {"admin_id": admin_id, "role": role}

    return _checker


def admin_login(username: str, password: str, db: Session) -> tuple[str, str]:
    """后台登录：校验账号密码 → 更新 last_login_at → 返回 (token, role)。"""
    admin = db.query(AdminUser).filter_by(username=username).first()
    if not admin or not verify_password(password, admin.password_hash):
        raise BizError(ERR_UNAUTHORIZED, "用户名或密码错误")
    admin.last_login_at = datetime.utcnow()
    db.commit()
    return create_admin_token(admin.id, admin.role), admin.role
