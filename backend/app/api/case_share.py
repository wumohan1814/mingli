#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分享帮填 API 路由（REQ-070）：一次性分享链接 + 免登录代建档案归发起者。

契约（访客全程免登录、零会话、零既有数据可见）：
  - POST /api/case/share                鉴权（Bearer）：发起者生成/复用一条帮填链接。
                                        链接只绑定发起者 user_id，**不绑 case**——REQ-070
                                        定位在「新建档案界面/新建档案按钮旁」，帮填本质是
                                        让访客代发起者**新建**档案（档案名由帮填者填）。
                                        幂等：同一发起者已有 used=False 且未过期的链接则
                                        复用同一 token（否则每次点都新发会刷掉旧链）。
                                        返回 {token, url:"/case/share/"+token}。
  - GET  /api/case/share/{token}        免登录：校验 token 存在 / 未 used / 未过期
                                        （任一不满足 404），返回 {owner_name, fields}。
                                        owner_name = 发起者昵称，无昵称且用户名为 11 位
                                        手机号则脱敏（138****1234），都没有则中性兜底；
                                        fields = 建档字段定义（name 必填、phone/email
                                        可选）。**不返回发起者任何档案/其它数据**。
  - POST /api/case/share/{token}/submit 免登录：body {name, birth_year, birth_month,
                                        birth_day, birth_hour, gender, birthplace,
                                        longitude, latitude, true_solar_time, phone?,
                                        email?}。name strip 后非空（否则 400）；
                                        复用 cases 建档逻辑建 case：user_id=发起者、
                                        name=name、input_json=其余建档字段、
                                        phone/email 落独立列（校验同 REQ-065），
                                        成功后原子置 token.used=True（一次性失效，
                                        条件 UPDATE rowcount 守卫并发重放），
                                        写 case_share_fill 埋点（props={owner_user_id}），
                                        返回 {caseId}。访客不颁发任何会话 token。

隔离：GET/submit 均免登录且不建会话；除本模块两个免登录端点外，其余 /api 均需
Bearer（访客触排盘/九法合一等其它能力 → 401，前端提示登录/注册）；返回体不含
发起者任何既有 case 数据。
"""
import logging
import re
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 只读复用 cases.py 的 REQ-065 公共字段模型（phone 11 位数字 / email 含 @ 校验），
# 不改动 cases.py；导入会连带加载 cases 路由模块（main 本就加载，无新增运行时开销）。
from app.api.cases import CaseContactFields
from app.auth.router import get_user_id_from_token
from app.database import get_analytics_db
from app.events.service import record_event
from app.models import Case, CaseShareLink, CaseStatus, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/case/share", tags=["case-share"])

# 帮填落地页字段定义（与统一建档组件同构：出生年月日时辰/性别/出生地/经纬度/真太阳时 +
# 可选联系方式）。required 以**后端可接受缺省**为准：仅 name/出生年月日为硬必填；
# phone/email 明确可选；其余项后端有默认值但统一建档组件通常仍采集。
CASE_SHARE_FIELDS: list[dict] = [
    {"key": "name", "label": "姓名", "type": "text", "required": True},
    {"key": "birth_year", "label": "出生年", "type": "number", "required": True},
    {"key": "birth_month", "label": "出生月", "type": "number", "required": True},
    {"key": "birth_day", "label": "出生日", "type": "number", "required": True},
    {"key": "birth_hour", "label": "出生时辰", "type": "number", "required": False, "default": 0},
    {"key": "gender", "label": "性别", "type": "select", "required": False, "default": "male",
     "options": [{"value": "male", "label": "男"}, {"value": "female", "label": "女"}]},
    {"key": "birthplace", "label": "出生地", "type": "text", "required": False, "default": ""},
    {"key": "true_solar_time", "label": "按真太阳时", "type": "boolean", "required": False,
     "default": False},
    {"key": "longitude", "label": "经度", "type": "number", "required": False},
    {"key": "latitude", "label": "纬度", "type": "number", "required": False},
    {"key": "phone", "label": "手机号", "type": "text", "required": False},
    {"key": "email", "label": "邮箱", "type": "text", "required": False},
]


class CaseShareSubmitRequest(CaseContactFields):
    """帮填提交 body：姓名必填 + 统一建档出生字段 + 选填联系方式。

    phone/email 的格式校验继承自 CaseContactFields（REQ-065 口径：11 位数字
    手机号 / 含 @ 邮箱），空白串归一为 None。
    """
    name: str = Field(description="姓名（必填；代建档案名，strip 后非空才放行）",
                      max_length=128)
    birth_year: int
    birth_month: int
    birth_day: int
    birth_hour: int = 0
    gender: str = "male"
    birthplace: str = ""
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    true_solar_time: bool = False


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（与 cases/mbti 端点一致）"""
    return HTTPException(status_code=status, detail=detail)


def _mask_phone(phone: str) -> str:
    """手机号脱敏：138****1234（长度不足 7 位时原样返回，防御性）"""
    if len(phone) >= 7:
        return phone[:3] + "****" + phone[-4:]
    return phone


def _owner_display_name(owner: User) -> str:
    """发起者展示名：昵称 → 11 位手机号用户名脱敏 → 中性兜底（不泄漏其它信息）"""
    nickname = (owner.nickname or "").strip()
    if nickname:
        return nickname
    username = (owner.username or "").strip()
    if re.fullmatch(r"\d{11}", username):
        return _mask_phone(username)
    return "分享者"


def _get_active_share_link(db: Session, token: str) -> CaseShareLink:
    """按 token 取**可用**帮填链接（免登录入口）。

    不存在 / 已 used（一次性已提交）/ 已过期 → 404（不区分细节，防探测）。
    """
    link = db.query(CaseShareLink).filter_by(token=token).first()
    if link is None:
        raise _err(404, "分享链接不存在或已失效")
    if link.used:
        raise _err(404, "分享链接已使用（一次性链接，提交后即失效）")
    if link.expires_at is not None and link.expires_at <= datetime.utcnow():
        raise _err(404, "分享链接已过期")
    return link


def _active_link_of(db: Session, user_id: int) -> Optional[CaseShareLink]:
    """该发起者当前可复用的链接（used=False 且未过期，取最早一条）；无则 None"""
    now = datetime.utcnow()
    return (
        db.query(CaseShareLink)
        .filter(
            CaseShareLink.user_id == user_id,
            CaseShareLink.used.is_(False),
            or_(CaseShareLink.expires_at.is_(None), CaseShareLink.expires_at > now),
        )
        .order_by(CaseShareLink.id.asc())
        .first()
    )


# --- 路由 ---
@router.post("")
def create_case_share_link(
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """发起者生成/复用帮填链接（鉴权）。

    幂等：已有 used=False 且未过期的链接则复用同一 token（同一发起者连续点
    「分享帮填」拿到同一链接，不刷旧链）；被使用/过期后下次生成新链。
    url 为前端 SPA 深链相对路径（/case/share/{token} 由主服务 SPA fallback
    回退 index.html，前端路由解析 token）。
    """
    user_id = get_user_id_from_token(authorization)

    link = _active_link_of(db, user_id)
    if link is None:
        link = CaseShareLink(user_id=user_id, token=secrets.token_urlsafe(16))
        db.add(link)
        db.commit()
        db.refresh(link)

    return {"code": 0, "message": "ok", "data": {
        "token": link.token,
        "url": "/case/share/" + link.token,
    }}


@router.get("/{token}")
def get_case_share_landing(
    token: str,
    db: Session = Depends(get_analytics_db),
):
    """免登录分享落地页数据：校验 token 可用（一次性未用、未过期）→
    仅返回 owner_name（发起者昵称/手机号脱敏，供「为 XX 填写」展示）+
    建档字段定义。零落库零会话，不返回发起者任何既有档案/数据（访客隔离）。"""
    link = _get_active_share_link(db, token)
    owner = db.query(User).filter_by(id=link.user_id).first()
    if owner is None:
        raise _err(404, "分享链接不存在或已失效")

    return {"code": 0, "message": "ok", "data": {
        "owner_name": _owner_display_name(owner),
        "fields": CASE_SHARE_FIELDS,
    }}


@router.post("/{token}/submit")
def submit_case_via_share(
    token: str,
    body: CaseShareSubmitRequest,
    db: Session = Depends(get_analytics_db),
):
    """免登录代建档案（一次性，归发起者）：body 校验 → 找 token 发起者 →
    复用 cases 建档逻辑建 case（user_id=发起者、name=name、input_json=其余
    建档字段、phone/email 落列）→ 原子置 used=True 失效 → 埋点 → {caseId}。

    并发守卫：case 落库与「条件 UPDATE used:False→True」同事务提交；rowcount
    != 1 说明已被并发请求先消费（重放），整事务回滚并 404，保证严格一次性。
    """
    # ① token 可用性 + 发起者
    link = _get_active_share_link(db, token)
    owner = db.query(User).filter_by(id=link.user_id).first()
    if owner is None:
        raise _err(404, "分享链接不存在或已失效")

    # ② 姓名必填（strip 后非空；全空白等价未填）
    name = (body.name or "").strip()
    if not name:
        raise _err(400, "姓名必填")

    # ③ 复用 cases 建档逻辑（与 POST /api/cases 同构）：phone/email 落独立列，
    #    input_json 落出生等其余建档字段（不含 name/phone/email）
    case = Case(
        user_id=owner.id,
        name=name,
        input_json=body.model_dump(exclude={"name", "phone", "email"}),
        phone=body.phone,
        email=body.email,
        status=CaseStatus.created,
    )
    db.add(case)

    # ④ 一次性失效：条件 UPDATE（used False→True）与建 case 同一事务原子提交；
    #    影响行数非 1 → 已被并发消费，回滚并 404
    marked = (
        db.query(CaseShareLink)
        .filter(CaseShareLink.id == link.id, CaseShareLink.used.is_(False))
        .update({"used": True}, synchronize_session=False)
    )
    if marked != 1:
        db.rollback()
        raise _err(404, "分享链接已失效")
    db.commit()
    db.refresh(case)

    # ⑤ 埋点（写库失败静默，绝不阻断业务）；user_id 记发起者（访客匿名）
    record_event("case_share_fill", user_id=owner.id,
                 props={"owner_user_id": owner.id})

    return {"code": 0, "message": "ok", "data": {"caseId": str(case.id)}}
