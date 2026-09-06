"""太初 · 命理 H5 后端（FastAPI 模块化单体 MVP）"""
import logging
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import (
    AnalyticsSession,
    Base,
    FeedbackBase,
    OpsBase,
    analytics_engine,
    ensure_schema,
    feedback_engine,
    ops_engine,
)
from app.errors import BizError, code_to_http, http_to_code, ERR_PARAM, ERR_INTERNAL
from app.models import Job, JobStatus

logger = logging.getLogger(__name__)

# 常驻排盘 Node 服务（backend/paipan-node/server.mjs）：
# main.py 位于 backend/app/，parents[1] = backend，故 cwd 需指向 backend/paipan-node
# 以保证 server.mjs 内 ./vendor/... 相对路径正确。
PAIPAN_SERVER = Path(__file__).resolve().parents[1] / "paipan-node" / "server.mjs"


def _recover_orphan_jobs() -> None:
    """启动时恢复孤儿 job：把残留 pending/running 的 job 统一置为 failed。

    进程重启后，后台编排 task 已随旧进程消失，残留 job 不可能自行推进；置 failed
    提示用户重新触发（断点续跑由编排器按 MethodResult 缓存 + continuation 上下文承担，
    旧 job 本身不再续跑）。恢复失败只记 warning，不阻断应用启动。
    """
    session = AnalyticsSession()
    try:
        stale = (
            session.query(Job)
            .filter(Job.status.in_([JobStatus.pending, JobStatus.running]))
            .all()
        )
        for job in stale:
            job.status = JobStatus.failed
            job.error = "服务重启，任务中断，请重新触发"
        session.commit()
        if stale:
            logger.info("孤儿 job 恢复：%s 个 pending/running job 已置为 failed", len(stale))
    except Exception:
        logger.warning("孤儿 job 恢复失败（不阻断应用启动）", exc_info=True)
    finally:
        session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时创建所有表、执行轻量 schema 迁移，并拉起常驻排盘 Node 服务。

    排盘服务启动失败只记 warning、不阻断应用启动：app.paipan.engine 会静默降级到
    subprocess（ziwei.cjs / extra.mjs）。
    """
    proc = None
    Base.metadata.create_all(bind=analytics_engine)
    FeedbackBase.metadata.create_all(bind=feedback_engine)
    OpsBase.metadata.create_all(bind=ops_engine)
    ensure_schema()

    # 孤儿 job 恢复：服务重启后把 pending/running 任务置为 failed（请重新触发）
    _recover_orphan_jobs()

    # 拉起常驻排盘服务（HTTP 优先路径；engine 已内置 subprocess 降级）
    try:
        proc = subprocess.Popen(
            ["node", str(PAIPAN_SERVER)],
            cwd=str(PAIPAN_SERVER.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        logger.info("排盘常驻服务已启动 pid=%s（node %s）", proc.pid, PAIPAN_SERVER)
    except Exception:
        logger.warning("排盘常驻服务启动失败，将降级 subprocess 排盘", exc_info=True)

    # 金数据充值 API 轮询（P2）：仅配置了 TAICHU_JINSHUJU_ACCESS_TOKEN 才启动，
    # 避免未配置时空跑调 API 报错。coalesce + max_instances=1 防任务堆积。
    scheduler = None
    if settings.jinshuju_access_token:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        from app.credits.poller import poll_and_recharge

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            poll_and_recharge,
            "interval",
            seconds=settings.jinshuju_poll_interval,
            id="jinshuju_poll",
            coalesce=True,
            max_instances=1,
        )
        scheduler.start()
        logger.info(
            "金数据充值轮询任务已启动 interval=%ss（配额内 12 次/小时）",
            settings.jinshuju_poll_interval,
        )
    else:
        logger.info("未配置 TAICHU_JINSHUJU_ACCESS_TOKEN，跳过金数据充值轮询")

    yield

    if scheduler is not None:
        scheduler.shutdown(wait=False)
        logger.info("金数据充值轮询任务已停止")

    if proc is not None:
        try:
            proc.terminate()
            logger.info("排盘常驻服务已停止 pid=%s", proc.pid)
        except Exception:
            logger.warning("排盘常驻服务停止时出错（忽略）", exc_info=True)


from app.admin.router import router as admin_router
from app.api.cases import router as cases_router
from app.api.jobs import router as jobs_router
from app.auth.router import router as auth_router
from app.credits.router import router as credits_router
from app.events.router import router as events_router
from app.middleware import api_metrics_middleware

app = FastAPI(
    title="太初 API",
    description="多流派命理综合 H5 后端",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(jobs_router)
app.include_router(credits_router)
app.include_router(events_router)

# 请求埋点中间件（记录 /api/* 到 taichu_ops.events）
app.middleware("http")(api_metrics_middleware)


# --- 统一错误处理（兼容现有 {code, message, detail} 信封） ---
@app.exception_handler(BizError)
async def biz_error_handler(request: Request, exc: BizError):
    return JSONResponse(status_code=code_to_http(exc.code), content=exc.to_dict())


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": http_to_code(exc.status_code), "message": str(exc.detail), "detail": ""},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(x) for x in first.get("loc", [])) or "参数"
    return JSONResponse(
        status_code=400,
        content={"code": ERR_PARAM, "message": "参数错误", "detail": f"{loc}: {first.get('msg', '')}"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("未捕获异常 path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"code": ERR_INTERNAL, "message": "内部错误", "detail": ""},
    )

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

# Serve frontend static files at root (after API routes)
frontend_path = Path("../frontend/public")
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")