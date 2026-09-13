"""功能设置 API（REQ-066）：user_settings 7 项开关持久化，GET/PUT /api/settings。

- GET：鉴权后返回当前用户全量设置；无记录时返回默认值（不落库）。
- PUT：body 为部分/全量字段（各字段均可选），upsert（无记录则建、有则更新，
  未显式给出的字段保留列默认/现值）；default_mode 校验 ∈ {manual, auto, both}
  （非法经 field_validator 抛 ValueError → main.py RequestValidationError 处理器
  转 400「参数错误」信封）；空 body / 全 null 视为无更新：不建行、返回当前设置。

响应统一 {code, message, data:{settings:{7 项}}} 信封，与其它 /api 接口一致。
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.auth.router import get_user_id_from_token
from app.database import get_analytics_db
from app.models import UserSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])

# 7 项设置的字段名（列名 = 接口字段名，契约 key）
_FIELDS = (
    "anim_enabled", "default_mode", "banner_dropdown", "share_mingli_ui",
    "bg_enabled", "card_images", "agent_enabled",
)

# 无记录时的默认值（与 UserSetting 列 default 一一对应；GET 无记录返回且不落库）
DEFAULT_SETTINGS = {
    "anim_enabled": True,      # ①动画与抽卡模拟
    "default_mode": "auto",    # ②占卜界面默认模式：manual|auto|both
    "banner_dropdown": False,  # ③Banner 模块下拉导航
    "share_mingli_ui": True,   # ④分享表单命理太初 UI
    "bg_enabled": True,        # ⑤背景图显示
    "card_images": True,       # ⑥牌面图片显示
    "agent_enabled": True,     # ⑦王先生 Agent
}

_DEFAULT_MODE_VALUES = {"manual", "auto", "both"}


def _row_to_settings(row: UserSetting) -> dict:
    """ORM 行 → data.settings（仅 7 项契约字段，不带 id/user_id/updated_at）。"""
    return {f: getattr(row, f) for f in _FIELDS}


class SettingsUpdateRequest(BaseModel):
    """PUT /api/settings body：各字段均可选，只更新请求里显式给出的字段。

    字段名与 UserSetting 列一一对应；默认 None = 未提供（区别于显式 null，
    两者在路由层都不落库：显式 null 视为该字段无更新，防把开关写成空值）。
    """

    anim_enabled: Optional[bool] = None       # ①动画与抽卡模拟
    default_mode: Optional[str] = None        # ②占卜界面默认模式
    banner_dropdown: Optional[bool] = None    # ③Banner 模块下拉导航
    share_mingli_ui: Optional[bool] = None    # ④分享表单命理太初 UI
    bg_enabled: Optional[bool] = None         # ⑤背景图显示
    card_images: Optional[bool] = None        # ⑥牌面图片显示
    agent_enabled: Optional[bool] = None      # ⑦王先生 Agent

    @field_validator("default_mode")
    @classmethod
    def _validate_default_mode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _DEFAULT_MODE_VALUES:
            raise ValueError("default_mode 仅支持 manual/auto/both")
        return v


@router.get("")
def get_settings(
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """当前用户功能设置：无记录返回默认值（不落库），有记录返回存储全量。"""
    user_id = get_user_id_from_token(authorization)
    row = db.query(UserSetting).filter_by(user_id=user_id).first()
    settings = _row_to_settings(row) if row is not None else dict(DEFAULT_SETTINGS)
    return {"code": 0, "message": "ok", "data": {"settings": settings}}


@router.put("")
def put_settings(
    req: SettingsUpdateRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """部分/全量更新并 upsert；返回更新后的全量 settings。"""
    user_id = get_user_id_from_token(authorization)

    # 显式给出且非 null 的字段才算“要写”的字段
    provided = [f for f in req.model_fields_set if getattr(req, f) is not None]
    if not provided:
        # 空 body / 全 null：无更新语义。不建行（GET 同样不因读取落库），
        # 返回当前设置，避免一次误发的空 PUT 凭空建出一行纯默认记录。
        row = db.query(UserSetting).filter_by(user_id=user_id).first()
        settings = _row_to_settings(row) if row is not None else dict(DEFAULT_SETTINGS)
        return {"code": 0, "message": "ok", "data": {"settings": settings}}

    row = db.query(UserSetting).filter_by(user_id=user_id).first()
    if row is None:
        # 新行：只给 user_id，未显式给的列由列 default（True/False/'auto'）兜底
        row = UserSetting(user_id=user_id)
        db.add(row)
    for f in provided:
        setattr(row, f, getattr(req, f))
    db.commit()
    db.refresh(row)

    return {"code": 0, "message": "ok", "data": {"settings": _row_to_settings(row)}}
