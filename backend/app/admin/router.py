"""后台管理 API（prefix=/admin）。

数据源约定：
  - 报表 / 登录 / 审计 → taichu_ops（OpsSession，运维库）
  - 用户档案查询      → taichu_analytics（AnalyticsSession，业务库）
  - 提示词            → 直接读/写 backend/prompts/**/*.md（19 个文件类 prompt：
                        method-prompts 9 / shared 2 / interpret 5 / pair 3）；
                        每次写前先落
                        PromptVersion 版本快照到运维库（可查看历史 / 回滚），写必记审计。

鉴权：Bearer JWT（type=admin）。viewer 可读全部（含版本历史/版本全文）；operator+
才能写提示词（PUT / rollback）。

Agent 运维工具端点（REQ-050，/admin/agent/*）：OpenClaw Agent 经既有 bb3a.mingli.example.com
接入点直调后台 API。鉴权用 Agent 专用静态 token（require_agent，TAICHU_AGENT_TOKEN），
与 admin 账号密码 / admin JWT 完全独立（互不可用）。写动作（赠积分/重置密码/重置 case）
审计：admin_user_id=0 + detail 前缀 "[agent]"，与人工 admin 审计区分；高风险端点响应
data 内带 requires_confirmation=true 标记（确认交互由 OpenClaw/用户侧完成，本端只标记）。
"""
import logging
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.admin.auth import admin_login, require_agent, require_role
from app.auth.router import hash_password
from app.config import settings
from app.credits.service import manual, recharge
from app.database import get_analytics_db, get_feedback_db, get_ops_db
from app.errors import (
    BizError,
    ERR_CASE_NOT_FOUND,
    ERR_CONFLICT,
    ERR_INTERNAL,
    ERR_NOT_FOUND,
    ERR_PARAM,
)
from app.models import (
    Calibration,
    Case,
    CaseStatus,
    Chart,
    Conversation,
    CreditAccount,
    CreditTransaction,
    Job,
    LoginAttempt,
    MethodResult,
    RechargeCode,
    RefreshToken,
    RouteDecision,
    User,
)
from app.models.feedback import Feedback
from app.models.ops import AdminAuditLog, AssetSlot, ErrorReport, Event, PromptVersion
from app.profile.archive import build_archive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# --- 提示词常量 ---
# backend/prompts：router.py 位于 backend/app/admin/，parents[2] = backend
PROMPT_BASE = Path(__file__).resolve().parents[2] / "prompts"
# 19 个文件类提示词 key（纯文件名、全局唯一）→ 相对 backend/prompts/ 的路径。
# 只收录 .md 提示词本体；各目录 README.md / .gitkeep 不算 prompt，不收录。
PROMPT_FILES = {
    # method-prompts（9）
    "bazi-pattern": "method-prompts/bazi-pattern.md",
    "bazi-dayun-liunian": "method-prompts/bazi-dayun-liunian.md",
    "bazi-shensha-nayin": "method-prompts/bazi-shensha-nayin.md",
    "bazi-hunyin-caiyun": "method-prompts/bazi-hunyin-caiyun.md",
    "ziwei": "method-prompts/ziwei.md",
    "xizhan": "method-prompts/xizhan.md",
    "qizheng": "method-prompts/qizheng.md",
    "qimen-lifetime": "method-prompts/qimen-lifetime.md",
    "wuyun-liuqi": "method-prompts/wuyun-liuqi.md",
    # shared（2）
    "revise": "shared/revise.md",
    "validation": "shared/validation.md",
    # interpret（5，含 REQ-075 六爻焦点详解）
    "astrology": "interpret/astrology.md",
    "divination": "interpret/divination.md",
    "divination_focus": "interpret/divination_focus.md",
    "lenormand": "interpret/lenormand.md",
    "tarot": "interpret/tarot.md",
    # pair（3，REQ-072：三大模块配对解析）
    "guoxue": "pair/guoxue.md",
    "xishi": "pair/xishi.md",
    "mbti": "pair/mbti.md",
}
# key → 中文分类（按所在目录；前端列表分组展示）
_CATEGORY_BY_PROMPT_DIR = {
    "method-prompts": "方法",
    "shared": "校验/追问",
    "interpret": "解读",
    "pair": "配对",
}
PROMPT_CATEGORY = {
    key: _CATEGORY_BY_PROMPT_DIR.get(Path(rel).parent.name, "其他")
    for key, rel in PROMPT_FILES.items()
}
# 提示词内容长度上限（防误提交超大内容 / 拖垮读取点）
PROMPT_CONTENT_MAX_LEN = 50000

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
    # 横向扩展 Phase A–D 事件（HUB 浏览 / 生肖流年 / 起卦断卦 / 塔罗 / 雷诺曼 /
    # 星座 / MBTI），一次补全
    "guoxue_hub_view": "国学HUB浏览",
    "xishi_hub_view": "西式HUB浏览",
    "zodiac_fortune": "生肖流年",
    "divination_cast": "起卦",
    "divination_interpret": "断卦解读",
    "divination_focus_interpret": "六爻焦点详解",
    "tarot_draw": "塔罗抽牌",
    "tarot_interpret": "塔罗解读",
    "lenormand_draw": "雷诺曼抽牌",
    "astrology_chart": "星座星盘",
    "astrology_interpret": "星座解读",
    "mbti_score": "MBTI判型",
    "case_share_fill": "分享帮填",
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


class CreateUserRequest(BaseModel):
    """后台新增 C 端用户（约束与 C 端 /api/auth/register 一致）。"""
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    nickname: str | None = Field(default=None, max_length=128)


class AssetUpsertRequest(BaseModel):
    """PUT /admin/assets/{key} body（REQ-059）：url 可为已上传文件的相对路径
    （POST /admin/assets/upload 返回 /uploads/assets/...）或完整 http(s) URL。
    key 与路径参数冗余（与前端表单对齐），传入时须与路径 key 一致。"""
    kind: str = Field(min_length=1, max_length=16)
    url: str = Field(min_length=1, max_length=2048)
    key: str | None = Field(default=None, max_length=64)


# --- 提示词工具 ---
def _prompt_path(key: str) -> Path:
    """key → 提示词文件路径；key 不在 PROMPT_FILES 映射中抛参数错误（防路径穿越）。

    路径始终来自静态映射表，调用方传入的 key 不会拼接进文件系统路径。
    """
    rel = PROMPT_FILES.get(key)
    if rel is None:
        raise BizError(ERR_PARAM, f"未知提示词 key: {key}")
    return PROMPT_BASE / rel


def _validate_prompt_content(content: str) -> None:
    """提示词内容合法性校验：非空 + 长度上限 + 花括号配对。

    任一不满足抛 BizError(ERR_PARAM, 具体原因)。花括号配对用于防截断 / 破坏
    提示词内的 markdown 代码块或 JSON 示例（prompts 文件本体无 {xxx} 模板占位符，
    故无需占位符完整性校验）。
    """
    if content is None or not content.strip():
        raise BizError(ERR_PARAM, "提示词内容不能为空")
    if len(content) > PROMPT_CONTENT_MAX_LEN:
        raise BizError(ERR_PARAM, f"提示词内容过长（上限 {PROMPT_CONTENT_MAX_LEN} 字符）")
    if content.count("{") != content.count("}"):
        raise BizError(ERR_PARAM, "提示词内容花括号不配对（{ 与 } 数量不一致）")


def _add_prompt_version(db: Session, key: str, content: str, admin_id: int | None) -> PromptVersion:
    """把 content 落一份 PromptVersion 快照到运维库（先于 write_text，保证可回滚）。"""
    version = PromptVersion(
        prompt_key=key,
        content=content,
        admin_user_id=admin_id,
    )
    db.add(version)
    return version


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
    # 一次查询取这些用户的积分账户（CreditAccount 与 User 同在业务库 AnalyticsSession）
    accounts = (
        db.query(CreditAccount)
        .filter(CreditAccount.user_id.in_([u.id for u in users]))
        .all()
    )
    balance_map = {acc.user_id: acc.balance for acc in accounts}
    items = [
        {
            "id": u.id,
            "username": u.username,
            "balance": balance_map.get(u.id, 0),
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


# --- 路由：提示词（19 个文件类 prompt：method-prompts 9 / shared 2 / interpret 5 / pair 3） ---
# viewer 可读（列表 / 全文 / 版本历史 / 版本全文）；operator+ 可写（PUT / rollback）。
@router.get("/prompts")
def list_prompts(_admin: dict = Depends(require_role("viewer"))):
    """列全部 19 个文件类提示词：key + 中文分类 + 文件名 + 修改时间。"""
    if not PROMPT_BASE.is_dir():
        raise BizError(ERR_INTERNAL, "提示词目录不存在")
    items = []
    for key, rel in PROMPT_FILES.items():
        path = PROMPT_BASE / rel
        if not path.is_file():  # 文件缺失时跳过该项（不报错，便于逐步迁移）
            continue
        items.append(
            {
                "key": key,
                "category": PROMPT_CATEGORY[key],
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
    if not path.is_file():
        raise BizError(ERR_NOT_FOUND, "提示词文件不存在")
    content = path.read_text(encoding="utf-8")
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "key": key,
            "category": PROMPT_CATEGORY[key],
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
    """保存提示词（operator+）：校验 → 版本快照 → 写文件 → 审计。

    热修改天然生效：所有读取点都是按次 read_text、无启动缓存，无需重启。
    """
    path = _prompt_path(key)
    if not path.is_file():
        raise BizError(ERR_NOT_FOUND, "提示词文件不存在")
    content = req.content or ""
    _validate_prompt_content(content)
    _add_prompt_version(db, key, content, admin["admin_id"])
    path.write_text(content, encoding="utf-8")
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="edit_prompt",
            target_type="prompt",
            target_id=key,
            detail=f"更新提示词 {key}（内容长度 {len(content)}）",
        )
    )
    db.commit()
    return {"code": 0, "message": "ok", "data": {"key": key}}


@router.get("/prompts/{key}/versions")
def list_prompt_versions(
    key: str,
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_ops_db),
):
    """列出某提示词版本历史（按 id 倒序，最新在前；不含全量 content，控制体积）。

    每项 {id, created_at, admin_user_id, length}。
    """
    _prompt_path(key)  # key 非法直接抛参数错误
    rows = (
        db.query(PromptVersion)
        .filter_by(prompt_key=key)
        .order_by(PromptVersion.id.desc())
        .all()
    )
    items = [
        {
            "id": v.id,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "admin_user_id": v.admin_user_id,
            "length": len(v.content),
        }
        for v in rows
    ]
    return {"code": 0, "message": "ok", "data": {"key": key, "items": items}}


@router.get("/prompts/{key}/versions/{version_id}")
def get_prompt_version(
    key: str,
    version_id: int,
    _admin: dict = Depends(require_role("viewer")),
    db: Session = Depends(get_ops_db),
):
    """返回某提示词某个版本的全量内容。"""
    _prompt_path(key)
    version = (
        db.query(PromptVersion)
        .filter_by(id=version_id, prompt_key=key)
        .first()
    )
    if version is None:
        raise BizError(ERR_NOT_FOUND, "版本不存在")
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "id": version.id,
            "prompt_key": version.prompt_key,
            "content": version.content,
            "created_at": version.created_at.isoformat() if version.created_at else None,
        },
    }


@router.post("/prompts/{key}/rollback/{version_id}")
def rollback_prompt(
    key: str,
    version_id: int,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """回滚提示词到某历史版本（operator+）。

    取该版本 content → 校验 → 写文件 → 再落一条"回滚后内容"的新快照（表示回滚到
    vX 之后的最新状态）→ 审计（action=rollback_prompt）。
    """
    path = _prompt_path(key)
    if not path.is_file():
        raise BizError(ERR_NOT_FOUND, "提示词文件不存在")
    version = (
        db.query(PromptVersion)
        .filter_by(id=version_id, prompt_key=key)
        .first()
    )
    if version is None:
        raise BizError(ERR_NOT_FOUND, "版本不存在")
    content = version.content
    _validate_prompt_content(content)
    path.write_text(content, encoding="utf-8")
    _add_prompt_version(db, key, content, admin["admin_id"])
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="rollback_prompt",
            target_type="prompt",
            target_id=key,
            detail=f"回滚提示词 {key} 到版本 v{version_id}（内容长度 {len(content)}）",
        )
    )
    db.commit()
    return {"code": 0, "message": "ok", "data": {"key": key, "version_id": version_id}}


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


# --- 路由：用户管理（新增 / 删除，operator+；业务库操作先行 commit，审计库随后） ---
@router.post("/users")
def create_user(
    req: CreateUserRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_analytics_db),
    ops_db: Session = Depends(get_ops_db),
):
    """后台新增 C 端用户（operator+）。

    username 唯一校验（重复抛 1003 冲突）→ hash_password 建用户 → 注册赠送积分
    （recharge type=free，与 C 端 register 同口径 settings.free_credit_on_register）
    → 运维库写 AdminAuditLog(action=create_user)。审计不含明文密码。
    事务顺序：业务库建用户 commit → 积分赠送（独立 session）→ 审计 commit。
    """
    username = (req.username or "").strip()
    if not username:
        raise BizError(ERR_PARAM, "参数错误", "用户名不能为空")
    if db.query(User).filter_by(username=username).first():
        raise BizError(ERR_CONFLICT, "用户名已存在")

    user = User(
        username=username,
        password_hash=hash_password(req.password),
        nickname=((req.nickname or "").strip() or None),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # 并发兜底：唯一索引兜住 check-then-insert 的竞态
        db.rollback()
        raise BizError(ERR_CONFLICT, "用户名已存在")
    db.refresh(user)

    # 注册赠送积分：失败不阻断建号（与 C 端 register 同策略），仅记日志
    try:
        recharge(user.id, settings.free_credit_on_register, "free", note="后台新增用户")
    except Exception:
        logger.exception(
            "后台新增用户赠送积分失败 user_id=%s username=%s", user.id, username
        )

    ops_db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="create_user",
            target_type="user",
            target_id=str(user.id),
            detail=(
                f"后台新增用户 {username}（赠送 {settings.free_credit_on_register} 积分）"
            ),
        )
    )
    ops_db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {"id": user.id, "username": user.username},
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_analytics_db),
    fb_db: Session = Depends(get_feedback_db),
    ops_db: Session = Depends(get_ops_db),
):
    """删除 C 端用户（operator+）：按 FK 顺序级联清该用户全部业务数据 + 审计。

    analytics 业务库删除范围（顺序不可乱，先子后父）：
      charts / method_results / calibrations / conversations / jobs /
      route_decisions（按该用户 cases 的 id 列表删）→ cases
      → credit_transactions → credit_accounts → recharge_codes（user_id 有 FK，
      不删会违反外键）→ refresh_tokens → login_attempts（按 username 匹配，
      表无 user_id 列）→ users。
    注：本代码库暂无 register_limits 表（任务清单中的预留项），无需删除。
    feedback 库（taichu_feedback）Feedback 按 user_id 同删（跨库无 FK，best-effort）；
    ops 库 events.user_id 无 FK、为埋点历史，保留不删。
    用户不存在抛 1002。事务顺序：业务库删除并 commit → feedback 库 → 审计库 commit。
    """
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise BizError(ERR_NOT_FOUND, "用户不存在")
    username = user.username
    # 先取该用户 cases 的 id 列表，供 case 级子表按 case_id 删（FK 父键在 cases）
    case_ids = [row[0] for row in db.query(Case.id).filter_by(user_id=user_id).all()]

    # 1) case 级子表（按 case_id 删；bulk delete 不触达 ORM 已加载对象）
    for model in (Chart, MethodResult, Calibration, Conversation, Job, RouteDecision):
        db.query(model).filter(model.case_id.in_(case_ids)).delete(
            synchronize_session=False
        )
    # 2) cases 本身
    db.query(Case).filter_by(user_id=user_id).delete(synchronize_session=False)
    # 3) 直接挂 users 的账户/流水/充值码/令牌（父键均为 users）
    for model in (CreditTransaction, CreditAccount, RechargeCode, RefreshToken):
        db.query(model).filter_by(user_id=user_id).delete(synchronize_session=False)
    # 4) login_attempts 按 username（该表只有 username 无 user_id）
    db.query(LoginAttempt).filter_by(username=username).delete(synchronize_session=False)
    # 5) users 本体
    db.query(User).filter_by(id=user_id).delete(synchronize_session=False)
    db.commit()

    # feedback 库同删（尽力而为；跨库失败只记日志，不阻断主流程）
    try:
        fb_db.query(Feedback).filter_by(user_id=user_id).delete(
            synchronize_session=False
        )
        fb_db.commit()
    except Exception:
        logger.warning(
            "删除用户 %s(id=%s) 时清理 feedback 失败", username, user_id, exc_info=True
        )
        fb_db.rollback()

    ops_db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="delete_user",
            target_type="user",
            target_id=str(user_id),
            detail=f"删除用户 {username}（级联清除其档案/对话/积分等全部数据）",
        )
    )
    ops_db.commit()
    return {"code": 0, "message": "ok", "data": {"deleted": True}}


# =========================================================================== #
# Agent 运维工具端点（REQ-050，/admin/agent/*）
#
# OpenClaw Agent 经既有 bb3a.mingli.example.com 通道直调后台 API。鉴权用 require_agent
# （TAICHU_AGENT_TOKEN，独立于 admin 账号密码/admin JWT——两套 token 互不可用）。
# 查看类端点与 /admin/* 对应端点返回同构；写端点复用 /admin/* 相同业务逻辑，
# 审计约定：admin_user_id=0（约定值 = Agent/系统调用，区别于人工 admin id）+
# detail 前缀 "[agent]"（如 "[agent] 赠送积分 user_id=..."），与人工审计区分。
# 高风险写端点（赠积分/重置密码/重置 case）响应 data 内带 requires_confirmation=true
# 标记；确认交互由 OpenClaw/用户侧完成，本端只执行 + 标记。
# =========================================================================== #


def _add_agent_audit(
    db: Session,
    action: str,
    target_type: str,
    target_id: str,
    detail: str,
) -> None:
    """写一条 Agent 调用审计（admin_user_id=0 约定值 + detail 已含 [agent] 前缀）。

    detail 由调用方以 "[agent] " 开头拼好；调用方负责 commit（与业务库事务解耦，
    与 /admin/* 写端点一致：业务库先行 commit，审计库随后）。
    """
    db.add(
        AdminAuditLog(
            admin_user_id=0,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
        )
    )


# --- 报表（查看类，与 GET /admin/reports/{metric} 同构） ---
@router.get("/agent/reports/{metric}")
def agent_get_report(
    metric: str,
    days: int = Query(7, ge=1, le=90),
    _agent: dict = Depends(require_agent),
    db: Session = Depends(get_ops_db),
):
    """Agent 查看运营报表（events 聚合；metric ∈ overview/funnel/llm_cost/errors）。

    与 GET /admin/reports/{metric} 同一聚合逻辑（_metric_*），返回同构 data。
    查看类端点不标 requires_confirmation。
    """
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


# --- 用户查询（查看类，与 GET /admin/users 同构，含积分余额） ---
@router.get("/agent/users")
def agent_list_users(
    q: str = Query("", max_length=64),
    _agent: dict = Depends(require_agent),
    db: Session = Depends(get_analytics_db),
):
    """Agent 按 username 模糊搜 C 端用户（含积分余额；与 /admin/users 同构）。"""
    kw = q.strip()
    query = db.query(User)
    if kw:
        query = query.filter(User.username.like(f"%{kw}%"))
    users = query.order_by(User.id.desc()).limit(50).all()
    accounts = (
        db.query(CreditAccount)
        .filter(CreditAccount.user_id.in_([u.id for u in users]))
        .all()
    )
    balance_map = {acc.user_id: acc.balance for acc in accounts}
    items = [
        {
            "id": u.id,
            "username": u.username,
            "balance": balance_map.get(u.id, 0),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]
    return {"code": 0, "message": "ok", "data": {"items": items}}


# --- 服务健康（查看类；与 C 端 GET /api/health 同口径） ---
@router.get("/agent/health")
def agent_health(_agent: dict = Depends(require_agent)):
    """Agent 查看服务健康 → data {status, version}（与 C 端 /api/health 一致）。"""
    # version 与 app.main FastAPI(version=...) / /api/health 保持一致
    return {"code": 0, "message": "ok", "data": {"status": "ok", "version": "0.1.0"}}


# --- 错误报告（查看类；ErrorReport 明细 + 指标聚合兜底） ---
@router.get("/agent/errors")
def agent_list_errors(
    days: int = Query(7, ge=1, le=90),
    _agent: dict = Depends(require_agent),
    db: Session = Depends(get_ops_db),
):
    """Agent 查看后台错误报告。

    data.items = error_reports 表按 id 倒序最多 50 条明细
    {id, error_code, message, source, user_id, case_id, created_at}。
    现状：代码库尚无 ErrorReport 写入来源（模型已建、无端点/服务实例化），
    明细通常为空——故响应恒带 note 说明，并附 reports/errors（events 表）指标
    聚合兜底（data.aggregate.items，与 GET /reports/errors 同构）。
    """
    rows = (
        db.query(ErrorReport)
        .order_by(ErrorReport.id.desc())
        .limit(50)
        .all()
    )
    items = [
        {
            "id": r.id,
            "error_code": r.error_code,
            "message": r.message,
            "source": r.source,
            "user_id": r.user_id,
            "case_id": r.case_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    now = datetime.utcnow()
    aggregate = _metric_errors(db, days, now)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": items,
            "aggregate": {"metric": "errors", "days": days, "items": aggregate},
            "note": (
                "当前代码库尚无 ErrorReport 写入来源（error_reports 明细通常为空）；"
                "错误可见性以 reports/errors（events 表聚合，见 aggregate）兜底"
            ),
        },
    }


# --- 赠积分（高风险写操作，复用 credits.service.recharge 入账逻辑） ---
@router.post("/agent/credits/manual")
def agent_manual_credit(
    req: CreditManualRequest,
    _agent: dict = Depends(require_agent),
    ops_db: Session = Depends(get_ops_db),
):
    """Agent 赠送积分（高风险，需人工确认）。

    入账等价复用 credits.service.manual 内部逻辑：recharge(type=manual) 写业务库
    （独立 AnalyticsSession，自动 commit）；**不直接调 manual()**——它内部会再写一条
    无 [agent] 标注、admin_user_id=admin_id 的审计，无法满足"审计单次 + 标注 Agent
    来源"，故审计由本端点自写一条（admin_user_id=0 + detail "[agent] 赠送积分 ..."）。
    data.requires_confirmation=true 标记高风险；确认交互由 OpenClaw/用户侧完成。
    """
    if req.delta <= 0:
        raise BizError(ERR_PARAM, "参数错误")
    result = recharge(req.user_id, req.delta, type="manual", note=req.note)
    detail = (
        f"[agent] 赠送积分 user_id={req.user_id} delta={req.delta}"
        f"（当前余额 {result['balance']}）"
    )
    if req.note:
        detail += f"，备注：{req.note}"
    _add_agent_audit(
        ops_db,
        action="credit_manual",
        target_type="user",
        target_id=str(req.user_id),
        detail=detail,
    )
    ops_db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {"balance": result["balance"], "requires_confirmation": True},
    }


# --- 重置用户密码（高风险写操作，逻辑同 /admin/ops/users/{id}/reset-password） ---
@router.post("/agent/ops/users/{user_id}/reset-password")
def agent_reset_user_password(
    user_id: int,
    req: ResetPasswordRequest,
    _agent: dict = Depends(require_agent),
    db: Session = Depends(get_analytics_db),
    ops_db: Session = Depends(get_ops_db),
):
    """Agent 重设 C 端用户密码（高风险，需人工确认）。

    业务逻辑与 /admin 版一致（users.password_hash = hash(new_password)）；审计由
    本端点写（admin_user_id=0 + "[agent]" 前缀），不落密码明文。业务库与审计库
    分别提交。data.requires_confirmation=true 标记高风险。
    """
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise BizError(ERR_NOT_FOUND, "用户不存在")
    user.password_hash = hash_password(req.new_password)
    db.commit()
    _add_agent_audit(
        ops_db,
        action="reset_password",
        target_type="user",
        target_id=str(user_id),
        detail=f"[agent] 重置用户密码 user_id={user_id}（临时密码线下交付）",
    )
    ops_db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {"reset": True, "requires_confirmation": True},
    }


# --- 重置 case 档案（高风险写操作，逻辑同 /admin/ops/users/{id}/reset-case） ---
@router.post("/agent/ops/users/{user_id}/reset-case")
def agent_reset_user_case(
    user_id: int,
    req: ResetCaseRequest,
    _agent: dict = Depends(require_agent),
    db: Session = Depends(get_analytics_db),
    ops_db: Session = Depends(get_ops_db),
):
    """Agent 重置某 case 档案（高风险，需人工确认）。

    业务逻辑与 /admin 版一致（删 charts/method_results/calibrations/conversations，
    case 行保留且 status 置 created，保留 user 与积分）；审计由本端点写
    （admin_user_id=0 + "[agent]" 前缀）。data.requires_confirmation=true 标记高风险。
    """
    case = db.query(Case).filter_by(id=req.case_id, user_id=user_id).first()
    if not case:
        raise BizError(ERR_CASE_NOT_FOUND, "档案不存在")
    for model in (Chart, MethodResult, Calibration, Conversation):
        db.query(model).filter_by(case_id=case.id).delete(synchronize_session=False)
    case.status = CaseStatus.created
    db.commit()
    _add_agent_audit(
        ops_db,
        action="reset_case",
        target_type="case",
        target_id=str(case.id),
        detail=(
            f"[agent] 重置档案 user_id={user_id} case_id={case.id}：已删 charts/"
            "method_results/calibrations/conversations，status 置 created"
        ),
    )
    ops_db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {"reset": True, "requires_confirmation": True},
    }


# =========================================================================== #
# 素材管理（REQ-059，/admin/assets/*；operator+）
#
# 后台素材热更：asset_slots 表（运维库，见 app.models.ops.AssetSlot）的 key→url
# 槽。上传即热更：前台 GET /api/assets（app.api.assets）每次实时查表、无启动缓存，
# PUT/DELETE 后无需重启立即生效；未配置 / 删除的槽 → 前台回退既有 CSS 艺术背景。
#
#   槽分类 kind ∈ {module, method, mbti_type, card, agent}（见模型 docstring）；
#   key 全局唯一、字符白名单 [A-Za-z0-9_-]（防路径穿越 / 脏 key）。
#
#   文件上传流程（MVP 双通道，前端任选）：
#     ① 真实文件：POST /admin/assets/upload（multipart）→ 校验扩展名 jpg/jpeg/png/webp
#        + 大小 ≤5MB → 存 backend/uploads/assets/（uuid 重命名）→ 返回相对路径
#        /uploads/assets/<file> → 再 PUT /admin/assets/{key} 入库；
#     ② 只填地址：PUT /admin/assets/{key} body {kind, url}，url 直接给完整 URL
#        （如 CDN 直传文件）或任何同源 / 开头的相对路径（如复用 frontend/public
#        既有静态资源），不上传文件。
#
# 审计约定：所有写动作必记 AdminAuditLog，action = upload_asset / edit_asset /
# delete_asset，target_type="asset"，target_id=key（upload 为文件名）。
# =========================================================================== #
# key 合法字符：字母/数字开头，字母数字 - _ ，总长 ≤64（跨 kind 全局唯一）
_ASSET_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
# 槽分类白名单（与 ops.AssetSlot.kind 的 String16 约定一致）
ASSET_KINDS = ("module", "method", "mbti_type", "card", "agent")
# 上传文件扩展名白名单（前端渲染的图片格式）+ 大小上限 5MB
ASSET_ALLOWED_EXTS = (".jpg", ".jpeg", ".png", ".webp")
ASSET_MAX_BYTES = 5 * 1024 * 1024
# 上传落盘目录：backend/uploads/assets（router.py 位于 backend/app/admin/，
# parents[2] = backend；main.py 以同一路径挂 /uploads 静态托管）
ASSETS_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "assets"


def _validate_asset_key(key: str) -> str:
    """素材 key 白名单校验（防脏 key / 路径穿越 / 超长）。"""
    key = (key or "").strip()
    if not _ASSET_KEY_RE.match(key):
        raise BizError(ERR_PARAM, f"素材 key 非法: {key!r}（仅字母/数字/-/_，长度 1-64）")
    return key


def _validate_asset_url(url: str) -> str:
    """素材 url 校验：http(s):// 完整 URL，或以 / 开头的同源相对路径。
    相对路径拒绝协议相对（//）与 .. 段（防把 URL 指到站点外 / 上级目录）。"""
    url = (url or "").strip()
    if not url:
        raise BizError(ERR_PARAM, "素材 url 不能为空")
    if url.startswith(("http://", "https://")):
        return url
    if url.startswith("/") and not url.startswith("//") and ".." not in url:
        return url
    raise BizError(
        ERR_PARAM, "素材 url 须为 http(s):// 完整 URL 或以 / 开头的相对路径（不含 ..）"
    )


@router.get("/assets")
def list_assets(
    kind: str = Query("", max_length=16),
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """列出所有素材槽（key/kind/url/updated_at）；kind 非空时按分类过滤。"""
    query = db.query(AssetSlot)
    k = (kind or "").strip()
    if k:
        if k not in ASSET_KINDS:
            raise BizError(ERR_PARAM, f"未知素材分类: {k}（可用 {ASSET_KINDS}）")
        query = query.filter_by(kind=k)
    rows = query.order_by(AssetSlot.kind, AssetSlot.key).all()
    items = [
        {
            "key": r.key,
            "kind": r.kind,
            "url": r.url,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]
    return {"code": 0, "message": "ok", "data": {"items": items}}


@router.post("/assets/upload")
def upload_asset(
    file: UploadFile = File(...),
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """上传素材文件（operator+，multipart）→ 存 backend/uploads/assets/ 并返回
    可访问相对路径；随后用该 url 调 PUT /admin/assets/{key} 完成入槽。

    校验：扩展名 jpg/jpeg/png/webp（按原文件名后缀）、大小 ≤5MB（读满上限+1 字节
    即停，超大文件不整读进内存）、非空。落盘文件名 uuid 重命名（防路径穿越 /
    重名覆盖）。上传只产生文件 + upload_asset 审计，不直接入槽（是否入槽、入哪
    个槽由随后的 PUT 决定；文件可能被多个槽复用）。
    """
    orig = file.filename or ""
    ext = Path(orig).suffix.lower()
    if ext not in ASSET_ALLOWED_EXTS:
        raise BizError(
            ERR_PARAM, f"仅支持图片格式 {'/'.join(ASSET_ALLOWED_EXTS)}（收到 {ext or '无扩展名'}）"
        )
    try:
        ASSETS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        data = file.file.read(ASSET_MAX_BYTES + 1)
    except Exception:
        logger.exception("素材上传读取失败 filename=%s", orig)
        raise BizError(ERR_INTERNAL, "素材上传失败")
    if len(data) > ASSET_MAX_BYTES:
        raise BizError(ERR_PARAM, f"素材文件过大（上限 {ASSET_MAX_BYTES // (1024 * 1024)}MB）")
    if not data:
        raise BizError(ERR_PARAM, "上传文件为空")
    filename = f"{uuid.uuid4().hex}{ext}"
    try:
        (ASSETS_UPLOAD_DIR / filename).write_bytes(data)
    except Exception:
        logger.exception("素材落盘失败 filename=%s", filename)
        raise BizError(ERR_INTERNAL, "素材保存失败")
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="upload_asset",
            target_type="asset",
            target_id=filename,
            detail=f"上传素材文件 {orig}（{len(data)} 字节，未入槽；待 PUT 绑定 key）",
        )
    )
    db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "url": f"/uploads/assets/{filename}",
            "filename": filename,
            "size": len(data),
        },
    }


@router.put("/assets/{key}")
def upsert_asset(
    key: str,
    req: AssetUpsertRequest,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """上传/替换素材槽（operator+，upsert）：url 入库后前台 GET /api/assets 立即可见
    （热更，无缓存）。url 可为 upload 返回的相对路径或完整 URL；重复 PUT 同 key
    即替换。写审计 action=edit_asset（detail 含分类 + url 摘要）。"""
    key = _validate_asset_key(key)
    if req.key is not None and req.key.strip() and _validate_asset_key(req.key) != key:
        raise BizError(ERR_PARAM, "body.key 与路径 key 不一致")
    if req.kind not in ASSET_KINDS:
        raise BizError(ERR_PARAM, f"未知素材分类: {req.kind}（可用 {ASSET_KINDS}）")
    url = _validate_asset_url(req.url)

    now = datetime.utcnow()
    row = db.query(AssetSlot).filter_by(key=key).first()
    is_new = row is None
    if is_new:
        row = AssetSlot(key=key, kind=req.kind, url=url, created_at=now, updated_at=now)
        db.add(row)
    else:
        row.kind = req.kind
        row.url = url
        row.updated_at = now
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="edit_asset",
            target_type="asset",
            target_id=key,
            detail=f"{'新增' if is_new else '替换'}素材槽 {key}（kind={req.kind}，url={url}）",
        )
    )
    db.commit()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "key": key,
            "kind": req.kind,
            "url": url,
            "updated_at": now.isoformat(timespec="seconds"),
        },
    }


@router.delete("/assets/{key}")
def delete_asset(
    key: str,
    admin: dict = Depends(require_role("operator")),
    db: Session = Depends(get_ops_db),
):
    """删除素材槽恢复默认（operator+）：删 asset_slots 行 + 审计 delete_asset。

    只删槽配置、不删 /uploads/assets 下已上传的文件（可能被其他槽复用，且删除
    后如需恢复默认即回到 CSS 艺术背景，不必清理文件）；前台未配置即回退 CSS。
    """
    key = _validate_asset_key(key)
    row = db.query(AssetSlot).filter_by(key=key).first()
    if row is None:
        raise BizError(ERR_NOT_FOUND, "素材槽不存在")
    db.delete(row)
    db.add(
        AdminAuditLog(
            admin_user_id=admin["admin_id"],
            action="delete_asset",
            target_type="asset",
            target_id=key,
            detail=f"删除素材槽 {key}（kind={row.kind}，恢复默认）",
        )
    )
    db.commit()
    return {"code": 0, "message": "ok", "data": {"key": key, "deleted": True}}
