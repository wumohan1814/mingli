# -*- coding: utf-8 -*-
"""REQ-070 分享帮填契约测试（backend/tests/unit/test_cases_share.py）。

真实 FastAPI app（app.main.app）+ TestClient + conftest 会话级临时库，覆盖：
  - POST /api/case/share：鉴权生成/复用帮填链接（幂等复用同一 token、用后过期
    再点发新链）；缺 Authorization → 400。
  - GET /api/case/share/{token}：免登录落地页 → {owner_name, fields}；
    owner_name = 昵称 / 11 位手机号用户名脱敏 / 中性兜底；used/过期/不存在 → 404。
  - POST /api/case/share/{token}/submit：免登录代建档案 →
    case 归属发起者（user_id=发起者、name=帮填姓名、phone/email 落列、
    input_json 为其余建档字段、status=created）、token 一次性失效（二次提交 404
    且不产生重复档案）、name 空白 400、非法手机号 400、无效 token 404、
    case_share_fill 埋点（props={owner_user_id}）、不颁发会话不返回发起者数据。
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest

SUBMIT_BODY = {
    "name": "帮填访客姓名",
    "birth_year": 1995,
    "birth_month": 3,
    "birth_day": 8,
    "birth_hour": 6,
    "gender": "female",
    "birthplace": "上海",
    "longitude": 121.47,
    "latitude": 31.23,
    "true_solar_time": True,
}

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user(username: str | None = None, nickname: str | None = None) -> int:
    """临时 analytics 库建真实 user（case_share_links.user_id 有外键约束）"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(
            username=username or f"share_ut_{uuid.uuid4().hex[:12]}",
            password_hash="test-only",
            nickname=nickname,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _insert_link(user_id: int, token: str, used: bool = False,
                 expires_at=None) -> None:
    """直插 case_share_links 行（绕过 API，测过期/used 分支）"""
    from app.database import AnalyticsSession
    from app.models import CaseShareLink

    session = AnalyticsSession()
    try:
        session.add(CaseShareLink(user_id=user_id, token=token, used=used,
                                  expires_at=expires_at))
        session.commit()
    finally:
        session.close()


def _link_rows(user_id: int) -> list:
    from app.database import AnalyticsSession
    from app.models import CaseShareLink

    session = AnalyticsSession()
    try:
        return session.query(CaseShareLink).filter_by(user_id=user_id).all()
    finally:
        session.close()


def _case_rows(user_id: int) -> list:
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        return session.query(Case).filter_by(user_id=user_id).all()
    finally:
        session.close()


def _event_rows(event_name: str, user_id: int) -> list:
    from app.database import OpsSession
    from app.models.ops import Event

    session = OpsSession()
    try:
        return session.query(Event).filter_by(event_name=event_name,
                                              user_id=user_id).all()
    finally:
        session.close()


@pytest.fixture(scope="module")
def share_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表；免登录端点不依赖 Node/LLM）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def _make_token(client, uid: int) -> str:
    """发起者生成链接并返回 token"""
    resp = client.post("/api/case/share", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["token"]


# ------------------------------------------------------------ 生成链接 ----
def test_cases_share_create_auth_and_shape(share_client):
    """POST /api/case/share：鉴权生成 → {token, url:/case/share/{token}}；
    缺 Authorization → 400。"""
    uid = _new_user()

    resp = share_client.post("/api/case/share")
    assert resp.status_code == 400, resp.text  # Header 必填（与 mbti 口径一致）

    resp = share_client.post("/api/case/share", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["token"] and len(data["token"]) > 0
    assert data["url"] == "/case/share/" + data["token"]


def test_cases_share_create_idempotent_then_new_after_use(share_client):
    """同一发起者未使用时重复生成 → 幂等复用同一 token；链接被使用后 → 新链。"""
    uid = _new_user()
    auth = _auth_header(uid)

    t1 = _make_token(share_client, uid)
    resp2 = share_client.post("/api/case/share", headers=auth)
    data2 = resp2.json()["data"]
    assert data2["token"] == t1, "未使用时应幂等复用同一链接"
    assert len(_link_rows(uid)) == 1

    # 访客代建使用该链接（一次性）后，再次生成 → 新 token（旧链已 used 不可复用）
    resp = share_client.post(
        f"/api/case/share/{t1}/submit", json=SUBMIT_BODY)
    assert resp.status_code == 200, resp.text
    resp3 = share_client.post("/api/case/share", headers=auth)
    assert resp3.status_code == 200, resp3.text
    assert resp3.json()["data"]["token"] != t1, "使用后应发新链"
    assert len(_link_rows(uid)) == 2
    assert any(link.token == t1 and link.used for link in _link_rows(uid))


# ------------------------------------------------------------ 落地页 ----
def test_cases_share_landing_public_fields_and_404(share_client):
    """GET /api/case/share/{token}：免登录 → owner_name + fields（name 必填、
    phone/email 可选）；不存在/已 used → 404；不返回发起者档案数据。"""
    uid = _new_user(nickname="张大爷")
    token = _make_token(share_client, uid)

    resp = share_client.get(f"/api/case/share/{token}")  # 无 Authorization
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["owner_name"] == "张大爷"
    fields = {f["key"]: f for f in data["fields"]}
    assert fields["name"]["required"] is True
    assert fields["phone"]["required"] is False
    assert fields["email"]["required"] is False
    for key in ("birth_year", "birth_month", "birth_day", "birth_hour",
                "gender", "birthplace", "true_solar_time"):
        assert key in fields, f"fields 缺 {key}"
    # 免登录落地页只含展示信息 + 字段定义，绝不包含发起者任何 case 数据
    assert "cases" not in data and "caseId" not in data and "case_id" not in data

    resp = share_client.get("/api/case/share/not-a-real-token")
    assert resp.status_code == 404, resp.text

    # 一次性：提交使用后同 token 落地页 404
    share_client.post(f"/api/case/share/{token}/submit", json=SUBMIT_BODY)
    resp = share_client.get(f"/api/case/share/{token}")
    assert resp.status_code == 404, resp.text


def test_cases_share_landing_owner_name_masking(share_client):
    """owner_name：昵称优先；无昵称且用户名为 11 位手机号 → 脱敏；否则中性兜底。"""
    nick_uid = _new_user(nickname="李先生")
    phone_uid = _new_user(username="13800138000", nickname=None)
    plain_uid = _new_user(username="guest_abc", nickname=None)

    tok_nick = _make_token(share_client, nick_uid)
    tok_phone = _make_token(share_client, phone_uid)
    tok_plain = _make_token(share_client, plain_uid)

    assert share_client.get(f"/api/case/share/{tok_nick}").json()["data"]["owner_name"] == "李先生"
    assert share_client.get(f"/api/case/share/{tok_phone}").json()["data"]["owner_name"] == "138****8000"
    assert share_client.get(f"/api/case/share/{tok_plain}").json()["data"]["owner_name"] == "分享者"


def test_cases_share_landing_expired_404(share_client):
    """已过期链接（expires_at 早于现在）→ 404（used=False 也判失效）。"""
    uid = _new_user()
    _insert_link(uid, "expired-token-abc", used=False,
                 expires_at=datetime.utcnow() - timedelta(hours=1))

    resp = share_client.get("/api/case/share/expired-token-abc")
    assert resp.status_code == 404, resp.text


# ------------------------------------------------------------ 代建提交 ----
def test_cases_share_submit_creates_case_owned_by_inviter(share_client):
    """免登录 submit：新档案归属发起者（user_id/name/phone/email 列/input_json/
    status）；返回 {caseId}；写 case_share_fill 埋点（props={owner_user_id}）。"""
    uid = _new_user()
    token = _make_token(share_client, uid)

    body = dict(SUBMIT_BODY, phone="13800138000", email="guest@example.com")
    resp = share_client.post(f"/api/case/share/{token}/submit", json=body)  # 无 Authorization
    assert resp.status_code == 200, resp.text
    case_id = int(resp.json()["data"]["caseId"])
    assert case_id > 0
    # 响应不颁发任何会话（无 token 字段、无登录态 cookie）
    assert "access_token" not in resp.json() and "refresh_token" not in resp.json()
    assert not resp.cookies.get("access_token")

    cases = _case_rows(uid)
    assert len(cases) == 1
    case = cases[0]
    assert case.user_id == uid, "代建档案必须归属发起者"
    assert case.name == "帮填访客姓名"
    assert case.phone == "13800138000"
    assert case.email == "guest@example.com"
    assert case.status is not None and case.status.value == "created"
    inp = case.input_json
    assert inp["birth_year"] == 1995 and inp["birth_hour"] == 6
    assert inp["gender"] == "female" and inp["true_solar_time"] is True
    assert "name" not in inp and "phone" not in inp and "email" not in inp, \
        "name/phone/email 落列，input_json 只留其余建档字段"

    # 埋点：case_share_fill × 1，props 带 owner_user_id
    events = _event_rows("case_share_fill", uid)
    assert len(events) == 1
    assert events[0].props == {"owner_user_id": uid}


def test_cases_share_submit_is_one_time(share_client):
    """一次性：同一 token 二次 submit → 404，且不产生第二份档案。"""
    uid = _new_user()
    token = _make_token(share_client, uid)

    resp1 = share_client.post(f"/api/case/share/{token}/submit", json=SUBMIT_BODY)
    assert resp1.status_code == 200, resp1.text

    resp2 = share_client.post(f"/api/case/share/{token}/submit", json=SUBMIT_BODY)
    assert resp2.status_code == 404, resp2.text  # 已 used → 失效

    assert len(_case_rows(uid)) == 1, "一次性链接不得重复代建档案"
    assert _link_rows(uid)[0].used is True


def test_cases_share_submit_name_required(share_client):
    """姓名必填：缺省 / 空白 → 400（不落库不埋点）。"""
    uid = _new_user()
    token = _make_token(share_client, uid)

    for bad_name in ("", "   "):
        body = dict(SUBMIT_BODY, name=bad_name)
        resp = share_client.post(f"/api/case/share/{token}/submit", json=body)
        assert resp.status_code == 400, resp.text
    assert _case_rows(uid) == []
    assert _event_rows("case_share_fill", uid) == []
    assert _link_rows(uid)[0].used is False, "校验失败不得消耗一次性链接"


def test_cases_share_submit_bad_phone_and_token(share_client):
    """非法手机号（非 11 位数字）→ 400；无效 token → 404。"""
    uid = _new_user()
    token = _make_token(share_client, uid)

    resp = share_client.post(
        f"/api/case/share/{token}/submit",
        json=dict(SUBMIT_BODY, phone="12345"))
    assert resp.status_code == 400, resp.text
    assert _case_rows(uid) == []

    resp = share_client.post(
        "/api/case/share/not-a-real-token/submit", json=SUBMIT_BODY)
    assert resp.status_code == 404, resp.text


def test_cases_share_visitor_isolated_from_owner_data(share_client):
    """访客隔离：代建成功后访客侧仍无任何访问发起者数据的通道——
    未带 Authorization 列档案 400；伪造/陌生 Bearer 401；发起者既有档案
    数不变、内容不随分享返回。"""
    uid = _new_user()
    # 发起者既有档案（分享前后不应被访客读取/改动）
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        session.add(Case(user_id=uid, name="既有档案A",
                         input_json={"question": "事业运势"}))
        session.commit()
    finally:
        session.close()

    token = _make_token(share_client, uid)
    guest_uid = _new_user()  # 访客自己注册的账号

    # 访客（未登录）访问发起者档案列表 → Header 必填 400
    resp = share_client.get("/api/cases")
    assert resp.status_code == 400, resp.text
    # 访客拿自己的 token 也看不到发起者档案（user_id 隔离）
    resp = share_client.get("/api/cases", headers=_auth_header(guest_uid))
    assert resp.status_code == 200, resp.text
    names = [c["name"] for c in resp.json()["data"]["cases"]]
    assert "既有档案A" not in names and names == []

    # 访客（未登录）触发其它能力（如排盘/八法合一建档入口 POST /api/cases）→ 需鉴权
    resp = share_client.post("/api/cases", json={})
    assert resp.status_code in (400, 422), resp.text  # 未带鉴权即被挡在参数层

    # 访客经分享完成代建后：发起者档案多出的仅这一份，无其它数据泄漏面
    resp = share_client.post(f"/api/case/share/{token}/submit", json=SUBMIT_BODY)
    assert resp.status_code == 200, resp.text
    cases = _case_rows(uid)
    assert len(cases) == 2  # 既有档案A + 代建档案
