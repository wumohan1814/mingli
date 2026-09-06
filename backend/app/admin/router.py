"""后台管理 API（prefix=/admin）。

数据源约定：
  - 报表 / 登录 / 审计 → taichu_ops（OpsSession，运维库）
  - 用户档案查询      → taichu_analytics（AnalyticsSession，业务库）
  - 提示词            → 直接读/写 backend/prompts/method-prompts/*.md（写必记审计）

鉴权：Bearer JWT（type=admin）。viewer 可读全部；operator+ 才能写提示词。
"""
import re
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.admin.auth import admin_login, require_role
from app.auth.router import hash_password
from app.credits.service import manual
from app.database import get_analytics_db, get_ops_db
from app.errors import BizError, ERR_CASE_NOT_FOUND, ERR_INTERNAL, ERR_NOT_FOUND, ERR_PARAM
from app.models import (
    Calibration,
    Case,
    CaseStatus,
    Chart,
    Conversation,
    MethodResult,
    User,
)
from app.models.ops import AdminAuditLog, Event
from app.profile.archive import build_archive

router = APIRouter(prefix="/admin", tags=["admin"])

# backend/prompts/method-prompts：router.py 位于 backend/app/admin/，parents[2] = backend
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts" / "method-prompts"
# 9 个方法提示词 key（规范顺序；README.md 不计入）
PROMPT_KEYS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
    "ziwei",
    "xizhan",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]

# 核心漏斗阶段顺序（前端埋点事件名与 events.event_name 对应）
FUNNEL_STEPS = [
    "auth_register",
    "case_create",
    "paipan",
    "dqc_done",
    "calibration_submit",
    "predict_done",
]

# 埋点 event_name → 报表展示中文名（仅展示层映射；未收录的英文名原样返回不丢失）
EVENT_NAME_ZH = {
    "page_view": "页面浏览",
    "auth_register": "注册",
    "auth_login": "登录",
    "case_create": "建档",
    "paipan": "排盘",
    "dqc_start": "断前尘开始",
    "dqc_done": "断前尘完成",
    "calibration_submit": "校准提交",
    "predict_start": "预测开始",
    "predict_done": "预测完成",
    "revise": "追问",
    "archive_view": "查看档案",
    "llm_call": "LLM 调用",
    "error": "错误",
    "api_request": "API 请求",
    "credit_consume": "积分消耗",
    "credit_recharge": "积分充值",
    "credit_insufficient": "积分不足",
}


def _event_zh(name: str) -> str:
    """event_name → 报表展示中文名；未收录（或空）时原样返回，保证不丢数据。"""
    return EVENT_NAME_ZH.get(name, name) if name else name


# --- 请求模型 ---
class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class PromptUpdateRequest(BaseModel):
    content: str


class CreditManualRequest(BaseModel):
    user_id: int
    delta: int
    note: str = Field(default="", max_length=500)


class LlmKeyRequest(BaseModel):
    api_key: str = Field(min_length=1, max_length=512)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=1, max_length=128)


class ResetCaseRequest(BaseModel):
    case_id: int


# --- 提示词工具 ---
def _prompt_path(key: str) -> Path:
    """key → 提示词文件路径；key 不合法抛参数错误（防路径穿越）。"""
    if key not in PROMPT_KEYS:
        raise BizError(ERR_PARAM, f"未知提示词 key: {key}")
    return PROMPTS_DIR / f"{key}.md"


# --- 报表聚合工具 ---
def _window_start(days: int, now: datetime | None = None) -> datetime:
    """近 N 天（含今天）窗口起点：最早一天 00:00:00（UTC）。"""
    now = now or datetime.utcnow()
    day0 = (now - timedelta(days=days - 1)).date()
    return datetime(day0.year, day0.month, day0.day)


def _day_labels(start: datetime, days: int) -> list[str]:
    """窗口内每天 'YYYY-MM-DD'，用于补零。"""
    return [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]


def _metric_overview(db: Session, days: int, now: datetime) -> list[dict]:
    """overview：每日 api_request 计数（DAU=distinct user_id）+ auth_register 计数。"""
    start = _window_start(days, now)
    buckets = {
        d: {"date": d, "api_requests": 0, "dau": 0, "auth_registers": 0}
        for d in _day_labels(start, days)
    }
    sql = """
        SELECT substr(created_at, 1, 10) AS day,
               SUM(CASE WHEN event_name = 'api_request' THEN 1 ELSE 0 END) AS req,
               COUNT(DISTINCT CASE WHEN event_name = 'api_request' THEN user_id END) AS dau,
               SUM(CASE WHEN event_name = 'auth_register' THEN 1 ELSE 0 END) AS reg
        FROM events
        WHERE created_at >= :start AND event_name IN ('api_request', 'auth_register')
        GROUP BY substr(created_at, 1, 10)
    """
    for row in db.execute(text(sql), {"start": start}):
        bucket = buckets.get(row[0])
        if bucket is not None:
            bucket["api_requests"] = int(row[1] or 0)
            bucket["dau"] = int(row[2] or 0)
            bucket["auth_registers"] = int(row[3] or 0)
    return list(buckets.values())


def _metric_funnel(db: Session, days: int, now: datetime) -> list[dict]:
    """funnel：核心漏斗各阶段事件计数（auth_register → … → predict_done）。

    返回的每项含：
      - event_key：埋点英文原名（对账用，不变）；
      - event_name：报表展示名（优先中文映射，未收录则原样返回英文）；
      - count：该阶段事件数。
    只做展示前映射，不改底层聚合 SQL。
    """
    start = _window_start(days, now)
    counts = {name: 0 for name in FUNNEL_STEPS}
    placeholders = ", ".join(f":k{i}" for i in range(len(FUNNEL_STEPS)))
    params: dict = {"start": start}
    params.update({f"k{i}": name for i, name in enumerate(FUNNEL_STEPS)})
    rows = db.execute(
        text(
            f"SELECT event_name, COUNT(*) AS cnt FROM events "
            f"WHERE created_at >= :start AND event_name IN ({placeholders}) "
            f"GROUP BY event_name"
        ),
        params,
    ).fetchall()
    for name, cnt in rows:
        if name in counts:
            counts[name] = int(cnt)
    return [
        {
            "event_key": name,          # 英文原值，便于对账
            "event_name": _event_zh(name),  # 中文展示名（未映射则原样英文）
            "count": counts[name],
        }
        for name in FUNNEL_STEPS
    ]


def _metric_llm_cost(db: Session, days: int, now: datetime) -> list[dict]:
    """llm_cost：llm_call 每日 total_tokens 求和 + 调用次数。"""
    start = _window_start(days, now)
    buckets = {
        d: {"date": d, "calls": 0, "total_tokens": 0}
        for d in _day_labels(start, days)
    }
    sql = """
        SELECT substr(created_at, 1, 10) AS day,
               COUNT(*) AS calls,
               COALESCE(SUM(CAST(json_extract(props, '$.total_tokens') AS INTEGER)), 0) AS total_tokens
        FROM events
        WHERE event_name = 'llm_call' AND created_at >= :start
        GROUP BY substr(created_at, 1, 10)
    """
    try:
        for row in db.execute(text(sql), {"start": start}):
            bucket = buckets.get(row[0])
            if bucket is not None:
                bucket["calls"] = int(row[1] or 0)
                bucket["total_tokens"] = int(row[2] or 0)
    except OperationalError:
        # SQLite 无 JSON1 的兜底：Python 侧按 props 聚合（ORM 读取已反序列化 props）
        per_day: dict[str, dict] = defaultdict(lambda: {"calls": 0, "total_tokens": 0})
        for created, props in (
            db.query(Event.created_at, Event.props)
            .filter(Event.event_name == "llm_call", Event.created_at >= start)
            .all()
        ):
            key = created.strftime("%Y-%m-%d") if created else ""
            per_day[key]["calls"] += 1
            if isinstance(props, dict):
                tok = props.get("total_tokens")
                if isinstance(tok, (int, float)):
                    per_day[key]["total_tokens"] += int(tok)
        for day, agg in per_day.items():
            if day in buckets:
                buckets[day].update(agg)
    return list(buckets.values())


def _metric_errors(db: Session, days: int, now: datetime) -> list[dict]:
    """errors：error 事件 + api_request status>=500 的每日计数。"""
    start = _window_start(days, now)
    buckets = {
        d: {"date": d, "errors": 0, "http_5xx": 0}
        for d in _day_labels(start, days)
    }
    sql = """
        SELECT substr(created_at, 1, 10) AS day,
               SUM(CASE WHEN event_name = 'error' THEN 1 ELSE 0 END) AS errs,
               SUM(CASE WHEN event_name = 'api_request'
                         AND CAST(json_extract(props, '$.status_code') AS INTEGER) >= 500
                        THEN 1 ELSE 0 END) AS five
        FROM events
        WHERE created_at >= :start
          AND (event_name = 'error'
               OR (event_name = 'api_request'
                   AND CAST(json_extract(props, '$.status_code') AS INTEGER) >= 500))
        GROUP BY substr(created_at, 1, 10)
    """
    try:
        for row in db.execute(text(sql), {"start": start}):
            bucket = buckets.get(row[0])
            if bucket is not None:
                bucket["errors"] = int(row[1] or 0)
                bucket["http_5xx"] = int(row[2] or 0)
    except OperationalError:
        # SQLite 无 JSON1 的兜底：Python 侧按 props 过滤 status_code
        per_day: dict[str, dict] = defaultdict(lambda: {"errors": 0, "http_5xx": 0})
        rows = (
            db.query(Event.event_name, Event.created_at, Event.props)
            .filter(
                Event.created_at >= start,
                Event.event_name.in_(["error", "api_request"]),
            )
            .all()
        )
        for name, created, props in rows:
            key = created.strftime("%Y-%m-%d") if created else ""
            if name == "error":
                per_day[key]["errors"] += 1
            elif name == "api_request" and isinstance(props, dict):
                code = props.get("status_code")
                if isinstance(code, int) and code >= 500:
                    per_day[key]["http_5xx"] += 1
        for day, agg in per_day.items():
            if day in buckets:
                buckets[day].update(agg)
    return list(buckets.values())


# --- 路由：登录 ---
@router.post("/login")
def login(req: AdminLoginRequest, db: Session = Depends(get_ops_db)):
    """后台登录 → {token, role}。"""
    token, role = admin_login(req.username, req.password, db)
    return {"code": 0, "message": "ok", "data": {"token": token, "role": role}}


# --- 路由：报表 ---
@router.get("/reports/{metric}")
def get_report(
    metric: str,
    days: int = Query(7, ge=1, le=90),
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_ops_db),
):
    """运营报表（events 表聚合）。metric ∈ {overview, funnel, llm_cost, errors}。"""
    now = datetime.utcnow()
    if metric == "overview":
        items = _metric_overview(db, days, now)
    elif metric == "funnel":
        items = _metric_funnel(db, days, now)
    elif metric == "llm_cost":
        items = _metric_llm_cost(db, days, now)
    elif metric == "errors":
        items = _metric_errors(db, days, now)
    else:
        raise BizError(ERR_PARAM, f"未知指标: {metric}")
    return {"code": 0, "message": "ok", "data": {"metric": metric, "days": days, "items": items}}


# --- 路由：用户档案（业务库 AnalyticsSession） ---
@router.get("/users")
def list_users(
    q: str = Query("", max_length=64),
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_analytics_db),
):
    """按 username 模糊搜 C 端用户。"""
    kw = q.strip()
    query = db.query(User)
    if kw:
        query = query.filter(User.username.like(f"%{kw}%"))
    users = query.order_by(User.id.desc()).limit(50).all()
    items = [
        {
            "id": u.id,
            "username": u.username,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]
    return {"code": 0, "message": "ok", "data": {"items": items}}


@router.get("/users/{user_id}/cases")
def list_user_cases(
    user_id: int,
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_analytics_db),
):
    """列出某用户的 cases。"""
    cases = (
        db.query(Case)
        .filter_by(user_id=user_id)
        .order_by(Case.id.desc())
        .limit(100)
        .all()
    )
    items = [
        {
            "id": c.id,
            "name": c.name,
            "status": c.status.value if c.status else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cases
    ]
    return {"code": 0, "message": "ok", "data": {"items": items}}


@router.get("/users/{user_id}/cases/{case_id}")
def get_user_case_archive(
    user_id: int,
    case_id: int,
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_analytics_db),
):
    """返回某 case 的完整命理档案（复用 build_archive）。"""
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if not case:
        raise BizError(ERR_CASE_NOT_FOUND, "档案不存在")
    return {"code": 0, "message": "ok", "data": build_archive(case, db)}


# --- 路由：提示词（方法提示词文件） ---
@router.get("/prompts")
def list_prompts(_admin: dict = Depends(require_role("viewer"))):
    """列 9 个 method-prompts：文件名 + 修改时间。"""
    if not PROMPTS_DIR.is_dir():
        raise BizError(ERR_INTERNAL, "提示词目录不存在")
    by_name = {p.name: p for p in PROMPTS_DIR.glob("*.md") if p.name != "README.md"}
    items = []
    for key in PROMPT_KEYS:
        path = by_name.get(f"{key}.md")
        if path is None:
            continue
        items.append(
            {
                "key": key,
                "file": path.name,
                "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(
                    timespec="seconds"
                ),
            }
        )
    return {"code": 0, "message": "ok", "data": {"items": items}}


@router.get("/prompts/{key}")
def get_prompt(key: str, _admin: dict = Depends(require_role("viewer"))):
    """返回某个提示词全文。"""
    path = _prompt_path(key)
    if not path.exists():
        raise BizError(ERR_NOT_FOUND, "提示词文件不存在")
    content = path.read_text(encoding="utf-8")
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "key": key,
            "file": path.name,
            "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(
                timespec="seconds"
            ),
            "content": content,
        },
    }


@router.put("/prompts/{key}")
def update_prompt(
    key: str,
    req: PromptUpdateRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """写回提示词文件（operator+）；写 AdminAuditLog 审计。"""
    path = _prompt_path(key)
    if not path.exists():
        raise BizError(ERR_NOT_FOUND, "提示词文件不存在")
    path.write_text(req.content, encoding="utf-8")
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="edit_prompt",
            target_type="prompt",
            target_id=key,
            detail=f"更新提示词 {key}（内容长度 {len(req.content)}）",
        )
    )
    db.commit()
    return {"code": 0, "message": "ok", "data": {"key": key}}


# --- 路由：积分手动分发（operator+） ---
@router.post("/credits/manual")
def manual_credit(
    req: CreditManualRequest,
    admin: dict = Depends(require_role("operator")),
):
    """后台手动赠送积分（operator+）。

    delta 必须为正整数；入账 + 审计（action=credit_manual）由
    app.credits.service.manual 内部完成，本端点不重复写 audit。
    """
    if req.delta <= 0:
        raise BizError(ERR_PARAM, "参数错误")
    result = manual(req.user_id, req.delta, note=req.note, admin_id=admin["admin_id"])
    return {"code": 0, "message": "ok", "data": {"balance": result["balance"]}}


# --- 路由：运维动作（换 key / 重置密码 / 重置档案，operator+） ---
# backend/.env：router.py 位于 backend/app/admin/，parents[2] = backend
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
_ENV_KEY_NAME = "TAICHU_LLM_API_KEY"


@router.post("/ops/llm-key")
def change_llm_key(
    req: LlmKeyRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """更换 LLM API key（operator+）：改写 backend/.env 的 TAICHU_LLM_API_KEY 行。

    audit 的 detail 不含 key 明文（只记“已更换”）；settings.llm_api_key 是启动时
    快照，改动需**重启后端**才生效（MVP 接受）。
    """
    key = req.api_key.strip()
    if not key or any(ch.isspace() for ch in key):
        raise BizError(ERR_PARAM, "参数错误")

    content = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    pattern = re.compile(rf"(?m)^{re.escape(_ENV_KEY_NAME)}=.*$")
    if pattern.search(content):
        content = pattern.sub(f"{_ENV_KEY_NAME}={key}", content)
    else:  # 文件缺失或尚无该行：追加到末尾
        if content and not content.endswith("\n"):
            content += "\n"
        content += f"{_ENV_KEY_NAME}={key}\n"
    ENV_FILE.write_text(content, encoding="utf-8")

    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="change_llm_key",
            target_type="env",
            target_id=_ENV_KEY_NAME,
            detail=f"已更换 {_ENV_KEY_NAME}（写入 backend/.env，重启后端生效）",
        )
    )
    db.commit()
    return {"code": 0, "message": "ok", "data": {"updated": True}}


@router.post("/ops/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    req: ResetPasswordRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_analytics_db),
    ops_db: Session = Depends(get_ops_db),
):
    """重设 C 端用户密码（operator+）：users.password_hash = hash(new_password) + audit。

    业务库（analytics）与审计库（ops）分别提交；审计不落密码明文。
    """
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise BizError(ERR_NOT_FOUND, "用户不存在")
    user.password_hash = hash_password(req.new_password)
    db.commit()
    ops_db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="reset_password",
            target_type="user",
            target_id=str(user_id),
            detail="重置用户密码（临时密码线下交付）",
        )
    )
    ops_db.commit()
    return {"code": 0, "message": "ok", "data": {"reset": True}}


@router.post("/ops/users/{user_id}/reset-case")
def reset_user_case(
    user_id: int,
    req: ResetCaseRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_analytics_db),
    ops_db: Session = Depends(get_ops_db),
):
    """重置某 case 档案（operator+）：删 charts/method_results/calibrations/
    conversations，case 行保留且 status 置 created（保留 user 与积分）+ audit。

    按架构 §3.2：只删上述四类结果行；jobs / route_decisions 为历史任务记录，
    一并保留（新流程会追加新行，不读取旧行）。
    """
    case = db.query(Case).filter_by(id=req.case_id, user_id=user_id).first()
    if not case:
        raise BizError(ERR_CASE_NOT_FOUND, "档案不存在")
    # 子表按 case_id 删（bulk delete 不触达 ORM 已加载对象；顺序无关，均为独立子表）
    for model in (Chart, MethodResult, Calibration, Conversation):
        db.query(model).filter_by(case_id=case.id).delete(synchronize_session=False)
    case.status = CaseStatus.created
    db.commit()
    ops_db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="reset_case",
            target_type="case",
            target_id=str(case.id),
            detail=(
                f"重置档案（user {user_id}）：已删 charts/method_results/"
                "calibrations/conversations，status 置 created"
            ),
        )
    )
    ops_db.commit()
    return {"code": 0, "message": "ok", "data": {"reset": True}}
