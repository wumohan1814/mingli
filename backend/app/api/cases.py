"""Case API 路由：建档/排盘/断前尘/校准/预测/修正/归档/单法直问"""
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_analytics_db
from app.models import (
    Calibration,
    Case,
    CaseStatus,
    Chart,
    Conversation,
    Job,
    JobType,
    JobStatus,
    MethodResult,
    Phase,
)
from app.auth.router import get_user_id_from_token
from app.compliance.guardrails import append_disclaimer
from app.llm import LLMError, chat
from app.methods import ANALYZERS, METHOD_KEYS
from app.paipan import (
    paipan as paipan_engine,  # 端点函数名也是 paipan，故加别名避免遮蔽
    calibration_weight,
    score_fit,
    slice_chart,
)
from app.jobs.orchestrator import run_duan_qian_chen, run_predict
from app.profile.archive import build_archive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["cases"])

# 后台任务引用集合：create_task 的 task 若不被引用可能被 GC 回收，
# 用模块级 set 保存强引用，task 完成回调时 discard。
_background_tasks: set[asyncio.Task] = set()

# 修正对话系统提示词（backend/prompts/shared/revise.md）
# cases.py 位于 backend/app/api/，parents[2] = backend
REVISE_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "shared" / "revise.md"


def _background_done(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if not task.cancelled() and task.exception() is not None:
        # 任务异常已在编排器内部落库为 failed，这里只记日志兜底
        pass


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增/改动的端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def _get_owned_case(db: Session, case_id: int, user_id: int) -> Case:
    """按 id+user_id 取 case（多用户隔离）；不存在抛 404"""
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if not case:
        raise _err(404, "case不存在")
    return case


def _case_question(case: Case) -> str:
    """取该 case 建档时的主问问题，缺失用默认值兜底（与编排器口径一致）"""
    if isinstance(case.input_json, dict) and case.input_json.get("question"):
        return str(case.input_json["question"])
    return "事业运势"


def _load_revise_prompt() -> str:
    """读取 shared/revise.md；缺失视为配置错误（RuntimeError，向上抛 500）"""
    try:
        text = REVISE_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"修正对话提示词缺失或不可读: {REVISE_PROMPT_PATH}") from exc
    if not text.strip():
        raise RuntimeError(f"修正对话提示词为空: {REVISE_PROMPT_PATH}")
    return text


def _chart_summary(chart_json: dict) -> dict:
    """从 chart dict 投影一版简短摘要（字段与 paipan 响应摘要口径对齐），
    供修正对话注入；chart 缺失返回空 dict。"""
    if not isinstance(chart_json, dict):
        return {}
    bazi = chart_json.get("bazi") or {}
    calendar = chart_json.get("calendar") or {}
    meta = chart_json.get("meta") or {}
    return {
        "dayMaster": bazi.get("day_master") or "",
        "dayMasterWuxing": bazi.get("day_master_wuxing") or "",
        "solar": calendar.get("solar") or "",
        "lunar": calendar.get("lunar") or "",
        "pillars": bazi.get("pillars"),
        "degraded_methods": meta.get("degraded_methods") or [],
    }


# --- 请求模型 ---
class CreateCaseRequest(BaseModel):
    birth_year: int
    birth_month: int
    birth_day: int
    birth_hour: int = 0
    gender: str = "male"
    birthplace: str = ""
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    true_solar_time: bool = False
    question: str = "事业运势"


class CalibrationRequest(BaseModel):
    feedback: list[dict]


class ReviseRequest(BaseModel):
    message: str


# --- 路由 ---
@router.post("")
async def create_case(
    req: CreateCaseRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """建档"""
    user_id = get_user_id_from_token(authorization)

    case = Case(
        user_id=user_id,
        input_json=req.model_dump(),
        status=CaseStatus.created,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    return {"code": 0, "message": "ok", "data": {"caseId": str(case.id)}}


@router.post("/{case_id}/paipan")
async def paipan(
    case_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """触发排盘（确定性计算，零LLM）"""
    user_id = get_user_id_from_token(authorization)
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="case不存在")

    # 从建档时的 input_json 取参；缺失字段用 CreateCaseRequest 相同默认值兜底
    inp = case.input_json if isinstance(case.input_json, dict) else {}

    try:
        chart = paipan_engine(
            year=inp.get("birth_year"),
            month=inp.get("birth_month"),
            day=inp.get("birth_day"),
            hour=inp.get("birth_hour", 0),  # 0 = 子时（合法时辰），不要当作缺时辰
            minute=None,
            gender=inp.get("gender", "male"),
            name="",  # input_json 无 name 来源
            birthplace=inp.get("birthplace", ""),
            longitude=inp.get("longitude"),
            latitude=inp.get("latitude"),
            true_solar=inp.get("true_solar_time", False),
        )
    except ValueError as e:
        # 非法输入（如无法识别的 gender）→ 4xx，让调用方修正
        raise HTTPException(status_code=400, detail=f"排盘参数无效: {e}")
    except Exception as e:
        # 引擎/Node 子进程彻底失败等 → 5xx，不吞异常返回假成功
        raise HTTPException(status_code=500, detail=f"排盘执行失败: {e}")

    bazi = chart.get("bazi") or {}
    calendar = chart.get("calendar") or {}
    meta = chart.get("meta") or {}
    degraded_methods = meta.get("degraded_methods") or []

    # 幂等 upsert charts 表
    chart_row = db.query(Chart).filter_by(case_id=case_id).first()
    if chart_row is None:
        chart_row = Chart(case_id=case_id, version=1)
        db.add(chart_row)
    else:
        chart_row.version = (chart_row.version or 1) + 1
    chart_row.chart_json = chart
    chart_row.degraded_methods = degraded_methods
    chart_row.generated_at = datetime.utcnow()

    case.status = CaseStatus.paipan_done
    db.commit()

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "caseId": str(case_id),
            "degradedMethods": degraded_methods,
            "chart": {
                "dayMaster": bazi.get("day_master") or "",
                "dayMasterWuxing": bazi.get("day_master_wuxing") or "",
                "solar": calendar.get("solar") or "",
                "lunar": calendar.get("lunar") or "",
                "trueSolarApplied": calendar.get("true_solar_applied") or False,
            },
        },
        "meta": {"caseId": str(case_id), "stage": "paipan_done"},
    }


@router.post("/{case_id}/duan-qian-chen")
async def duan_qian_chen(
    case_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """断前尘（异步：9法串行+校验）"""
    user_id = get_user_id_from_token(authorization)
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="case不存在")

    # 创建异步任务（后台编排器独立 session 执行，不占用本请求 session）
    job = Job(
        case_id=case_id,
        user_id=user_id,
        type=JobType.duan_qian_chen,
        status=JobStatus.pending,
        total=9,
        completed=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    task = asyncio.create_task(run_duan_qian_chen(job.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_done)

    return JSONResponse(
        status_code=202,
        content={"code": 0, "message": "ok", "data": {"jobId": str(job.id), "total": job.total}},
    )


@router.post("/{case_id}/calibration")
async def calibration(
    case_id: int,
    req: CalibrationRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """提交校准反馈（真实打分：断前尘 MethodResult 聚合 → score_fit → 落 Calibration 表）"""
    user_id = get_user_id_from_token(authorization)
    case = _get_owned_case(db, case_id, user_id)

    # 从该 case 的断前尘结果聚合（多用户隔离：case_id + user_id + phase 过滤）
    dqc_rows = (
        db.query(MethodResult)
        .filter_by(case_id=case_id, user_id=user_id, phase=Phase.duan_qian_chen)
        .all()
    )
    results = {r.method_key: r.result_json for r in dqc_rows if r.result_json}
    validations = {
        r.method_key: r.validation_json for r in dqc_rows if r.validation_json is not None
    }

    fit = score_fit(req.feedback, results, validations)
    rows = fit["rows"]

    # 整体 fit：有 rows 取各法契合度均值（保留两位）；无 rows 取 0.5 兜底、complete=False
    if rows:
        overall = round(sum(r["fit"] for r in rows) / len(rows), 2)
        complete = True
    else:
        overall = 0.5
        complete = False

    weights = {r["method"]: calibration_weight(r["fit"]) for r in rows}

    # upsert calibrations（case_id 为 PK，一行一案；存在则更新）
    cal = db.query(Calibration).filter_by(case_id=case_id).first()
    if cal is None:
        cal = Calibration(case_id=case_id, user_id=user_id)
        db.add(cal)
    else:
        cal.user_id = user_id
    cal.record_json = req.feedback
    cal.fit_json = {"fit": fit, "weights": weights}

    case.status = CaseStatus.calibrated
    db.commit()

    return {
        "code": 0,
        "message": "ok",
        "data": {"fit": overall, "complete": complete, "rows": rows},
    }


@router.post("/{case_id}/predict")
async def predict(
    case_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """预测（异步：路由选法+并行扇出+合并裁决）"""
    user_id = get_user_id_from_token(authorization)
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="case不存在")

    # 建 job：total 先置 0，后台编排器路由后回填实际方法数
    job = Job(
        case_id=case_id,
        user_id=user_id,
        type=JobType.predict,
        status=JobStatus.pending,
        total=0,
        completed=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    task = asyncio.create_task(run_predict(job.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_done)

    return JSONResponse(
        status_code=202,
        content={"code": 0, "message": "ok", "data": {"jobId": str(job.id), "total": job.total}},
    )


@router.post("/{case_id}/revise")
async def revise(
    case_id: int,
    req: ReviseRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """多轮修正（真实 LLM 对话：历史 Conversation + chart 摘要 → chat → 落两行对话）"""
    user_id = get_user_id_from_token(authorization)
    case = _get_owned_case(db, case_id, user_id)

    # 历史对话（按 turn 排序），供上下文组装
    convs = (
        db.query(Conversation)
        .filter_by(case_id=case_id, user_id=user_id)
        .order_by(Conversation.turn.asc())
        .all()
    )
    history = [{"role": c.role, "content": c.content} for c in convs]

    # chart 摘要（未排盘则为空）
    chart_row = db.query(Chart).filter_by(case_id=case_id).first()
    chart_summary = _chart_summary(chart_row.chart_json) if chart_row is not None else {}

    messages = [
        {"role": "system", "content": _load_revise_prompt()},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "question": req.message,
                    "chart_summary": chart_summary,
                    "history": history,
                },
                ensure_ascii=False,
            ),
        },
    ]

    try:
        resp = await chat(messages)  # 非 json_mode，拿自然语言文本
    except LLMError as exc:
        # LLM 失败：记日志 + 502，不吞成假文案
        logger.warning("修正对话 LLM 调用失败 case_id=%s user_id=%s error=%s",
                       case_id, user_id, exc)
        raise _err(502, "修正对话服务暂不可用")

    reply = append_disclaimer(resp["content"])

    # 落两行对话（user + assistant，turn 递增），增量写不覆盖历史
    next_turn = max((c.turn for c in convs), default=0) + 1
    db.add(Conversation(
        case_id=case_id, user_id=user_id, turn=next_turn,
        role="user", content=req.message,
    ))
    db.add(Conversation(
        case_id=case_id, user_id=user_id, turn=next_turn + 1,
        role="assistant", content=reply,
    ))
    db.commit()

    return {"code": 0, "message": "ok", "data": {"reply": reply}}


@router.post("/{case_id}/query/{method_key}")
async def query_method(
    case_id: int,
    method_key: str,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """单法直问（bypass 主模块，缓存优先：命中 prediction 结果零 LLM 直接返回）"""
    user_id = get_user_id_from_token(authorization)

    if method_key not in METHOD_KEYS:
        raise _err(400, f"不支持的方法: {method_key}")
    case = _get_owned_case(db, case_id, user_id)

    # 缓存优先（case_id + user_id + method_key + phase=prediction）
    cached = (
        db.query(MethodResult)
        .filter_by(case_id=case_id, user_id=user_id, method_key=method_key,
                   phase=Phase.prediction)
        .first()
    )
    if cached is not None and cached.result_json:
        cached.cached = True  # 复用标记，与断前尘/预测缓存口径一致
        db.commit()
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "cached": True,
                "method": method_key,
                "phase": "prediction",
                "result": cached.result_json,
            },
        }

    # 未命中：取 chart → 切该法 slice → 单法 analyze
    chart_row = db.query(Chart).filter_by(case_id=case_id).first()
    if chart_row is None or not isinstance(chart_row.chart_json, dict):
        raise _err(409, "case尚未排盘，无法单法直问")

    try:
        slices = slice_chart(chart_row.chart_json, methods=[method_key])
        result = await ANALYZERS[method_key]("prediction", slices.get(method_key),
                                             _case_question(case))
    except (LLMError, ValueError) as exc:
        logger.warning("单法直问失败 method_key=%s case_id=%s user_id=%s error=%s",
                       method_key, case_id, user_id, exc)
        raise _err(502, "该方法直问服务暂不可用，请稍后重试")

    if not isinstance(result, dict) or not result:
        # prompt/slice 缺失导致降级 → 按单法失败处理，不返回假结果
        logger.warning("单法直问降级（analyze 返回空）method_key=%s case_id=%s",
                       method_key, case_id)
        raise _err(502, "该方法当前不可用（已降级），请稍后重试")

    # 落 MethodResult(phase=prediction)；覆盖残留空行避免重复
    if cached is not None:
        cached.result_json = result
        cached.validation_json = None
        cached.cached = False
    else:
        db.add(MethodResult(
            case_id=case_id, user_id=user_id, method_key=method_key,
            phase=Phase.prediction, result_json=result,
            validation_json=None, cached=False,
        ))
    db.commit()

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "cached": False,
            "method": method_key,
            "phase": "prediction",
            "result": result,
        },
    }


@router.get("/{case_id}/archive")
async def archive(
    case_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """命理档案（聚合 chart / calibrations / conversations / method_results）"""
    user_id = get_user_id_from_token(authorization)
    case = _get_owned_case(db, case_id, user_id)

    data = build_archive(case, db)

    return {"code": 0, "message": "ok", "data": data}
