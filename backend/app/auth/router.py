"""认证模块：注册/登录/JWT/限流"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import hashlib, os, base64
from jose import jwt, JWTError

from app.auth.captcha import generate_captcha, verify_captcha
from app.config import settings
from app.database import get_analytics_db
from app.errors import BizError, ERR_FORBIDDEN, ERR_PARAM, ERR_RATE_LIMITED
from app.models import User, RefreshToken, LoginAttempt, RegisterLimit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])

# 简单的密码哈希（避免 passlib/bcrypt 兼容性问题）
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return base64.b64encode(salt + dk).decode()

def verify_password(password: str, hashed: str) -> bool:
    try:
        decoded = base64.b64decode(hashed)
        salt = decoded[:16]
        dk = decoded[16:]
        new_dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return dk == new_dk
    except Exception:
        return False


# --- 请求/响应模型 ---
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    captcha_id: str
    captcha_code: str
    # 前端采集的设备指纹；默认空串兼容旧客户端（空串不做设备维度限流）
    device_fingerprint: str = Field(default="", max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# --- JWT 工具函数 ---
def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(seconds=settings.access_token_ttl)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user_id: int, db: Session) -> str:
    expire = datetime.utcnow() + timedelta(seconds=settings.refresh_token_ttl)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh", "jti": ""}
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    # 存储refresh token hash
    db_token = RefreshToken(
        user_id=user_id,
        token_hash=hash_password(token),
        expires_at=expire,
    )
    db.add(db_token)
    db.commit()
    return token


def verify_access_token(token: str) -> int:
    """验证访问令牌，返回user_id"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="无效的令牌类型")
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="令牌无效或已过期")


def get_user_id_from_token(authorization: str = "") -> int:
    """从 Authorization header 提取 user_id"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少认证令牌")
    token = authorization.removeprefix("Bearer ")
    return verify_access_token(token)


# --- 注册限流参数（R10：防脚本批量注册，IP + 设备指纹双维度） ---
REGISTER_IP_MAX_PER_HOUR = 2      # 同一 IP 1 小时内最多注册次数
REGISTER_IP_WINDOW = timedelta(hours=1)


# --- 限流检查 ---
def check_login_rate_limit(username: str, db: Session):
    """检查是否被锁定"""
    attempt = db.query(LoginAttempt).filter_by(username=username).first()
    if attempt and attempt.locked_until and attempt.locked_until > datetime.utcnow():
        remaining = (attempt.locked_until - datetime.utcnow()).seconds
        raise HTTPException(
            status_code=429,
            detail=f"登录尝试过多，请在 {remaining} 秒后重试",
        )


def record_login_failure(username: str, db: Session):
    """记录登录失败"""
    attempt = db.query(LoginAttempt).filter_by(username=username).first()
    if not attempt:
        attempt = LoginAttempt(username=username, fail_count=1)
        db.add(attempt)
    else:
        attempt.fail_count += 1
        if attempt.fail_count >= settings.login_max_failures:
            attempt.locked_until = datetime.utcnow() + timedelta(minutes=settings.login_lock_minutes)
    db.commit()


def clear_login_attempts(username: str, db: Session):
    """登录成功后清除失败记录"""
    db.query(LoginAttempt).filter_by(username=username).delete()
    db.commit()


# --- 路由 ---
@router.get("/auth/captcha")
async def get_captcha():
    """获取注册图形验证码：返回 {code, message, data:{captcha_id, image}}。"""
    return {"code": 0, "message": "ok", "data": generate_captcha()}


@router.post("/auth/register", response_model=TokenResponse)
async def register(
    req: RegisterRequest,
    request: Request,
    db: Session = Depends(get_analytics_db),
):
    """注册新用户（图形验证码 + IP/设备指纹双维度限流）

    节141：**公开注册默认关闭**（内测白名单制）。`TAICHU_ALLOW_PUBLIC_REGISTER=false`
    （默认）时本端点一律 403 + `ERR_FORBIDDEN`，新账号只能由后台「新增 C 端用户」创建；
    **不物理删除端点**，测试环境把开关置 true 即可继续造数（零测试返工）。
    """
    if not settings.allow_public_register:
        raise BizError(ERR_FORBIDDEN, "本项目只开放给内部人员，请联系开发者获得测试资格。")

    # 图形验证码校验（R10：防脚本批量注册）：不通过则直接拒绝，不建用户
    if not verify_captcha(req.captcha_id, req.captcha_code):
        raise BizError(ERR_PARAM, "验证码错误或已过期")

    # --- 注册限流（验证码通过后、建用户前判定，防脚本刷号） ---
    ip = request.client.host if request.client else ""
    # 归一化设备指纹：去空白 + 截断到列长（String(128)），保证查询与落库同口径
    device_fp = (req.device_fingerprint or "").strip()[:128]

    cutoff = datetime.utcnow() - REGISTER_IP_WINDOW
    recent_ip_count = (
        db.query(RegisterLimit)
        .filter(RegisterLimit.ip == ip, RegisterLimit.created_at > cutoff)
        .count()
    )
    if recent_ip_count >= REGISTER_IP_MAX_PER_HOUR:
        raise BizError(ERR_RATE_LIMITED, "同一 IP 1 小时内注册次数已达上限（最多 2 次）")

    if device_fp:
        # 设备指纹维度不带时间窗：该设备注册过即永久拒绝（一设备一账号）
        fp_count = (
            db.query(RegisterLimit)
            .filter(RegisterLimit.device_fingerprint == device_fp)
            .count()
        )
        if fp_count >= 1:
            raise BizError(ERR_RATE_LIMITED, "该设备已注册过账号")

    existing = db.query(User).filter_by(username=req.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="用户名已存在")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 注册赠送余额（架构 §4.4：free_credit_on_register 默认 100）：失败只记日志，不阻断注册
    try:
        from app.credits.service import recharge
        recharge(user.id, settings.free_credit_on_register, "free", note="注册赠送")
    except Exception:
        logger.exception("注册赠送余额失败 user_id=%s username=%s", user.id, req.username)

    # 注册成功（建用户 + 赠余额后）落一条限流计数，供后续 IP/设备维度判定
    db.add(RegisterLimit(ip=ip, device_fingerprint=device_fp))
    db.commit()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, db)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_analytics_db)):
    """登录"""
    check_login_rate_limit(req.username, db)

    user = db.query(User).filter_by(username=req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        record_login_failure(req.username, db)
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    clear_login_attempts(req.username, db)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, db)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: Session = Depends(get_analytics_db)):
    """刷新令牌"""
    try:
        payload = jwt.decode(req.refresh_token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="无效的令牌类型")
        user_id = int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="刷新令牌无效或已过期")

    # 验证refresh token在数据库中且未被撤销
    token_hash = hash_password(req.refresh_token)
    db_token = (
        db.query(RefreshToken)
        .filter_by(user_id=user_id, revoked=False)
        .filter(RefreshToken.expires_at > datetime.utcnow())
        .first()
    )
    if not db_token:
        raise HTTPException(status_code=401, detail="刷新令牌已失效")

    # 撤销旧token
    db_token.revoked = True
    db.commit()

    access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id, db)

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)