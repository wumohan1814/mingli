"""太初 · 命理 H5 后端（FastAPI 模块化单体 MVP）"""
import logging
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

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
from app.api.assets import router as assets_router
from app.api.astrology import router as astrology_router
from app.api.case_share import router as case_share_router
from app.api.cases import router as cases_router
from app.api.divination import router as divination_router
from app.api.jobs import router as jobs_router
from app.api.mbti import router as mbti_router
from app.api.pair import router as pair_router
from app.api.tarot import router as tarot_router
from app.api.zodiac import router as zodiac_router
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
app.include_router(assets_router)
app.include_router(auth_router)
app.include_router(case_share_router)
app.include_router(cases_router)
app.include_router(jobs_router)
app.include_router(zodiac_router)
app.include_router(divination_router)
app.include_router(tarot_router)
app.include_router(astrology_router)
app.include_router(mbti_router)
app.include_router(pair_router)
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


class SPAStaticFiles(StaticFiles):
    """SPA fallback 静态服务：真实文件直接返回，404 一律回退 index.html。

    StaticFiles(html=True) 只对磁盘上真实存在的文件/目录生效：/mbti/share/<token>
    等纯前端虚拟路径（磁盘无对应文件）会抛 404，导致免登录分享链接无法直达前端路由
    （REQ-047）。这里捕获 404 后改返 index.html，由前端自行解析 token。

    注意：StaticFiles 内部抛的是 starlette.exceptions.HTTPException，fastapi.HTTPException
    是其子类而非父类，故不能用于捕获这里抛出的 404。
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            # API / 后台前缀的 404 不回退 index.html：保留 /api/* 与 /admin/* 的
            # 404 语义（未注册接口 / 非法 key 不应返回前端页面）。
            if path.startswith("admin/") or path.startswith("api/"):
                raise
            # StaticFiles.directory 是挂载时传入的 str（如 "../frontend/public"），
            # 不能直接做 str / index.html 除法，须经 Path 拼接（与父类 lookup_path
            # 的 cwd 解析基准一致）。
            index_path = Path(self.directory) / "index.html"
            if index_path.is_file():
                return FileResponse(str(index_path))
            # index.html 也不存在：维持 404，不崩溃。
            raise


# REQ-059：后台素材上传目录静态托管（backend/uploads → /uploads/assets/...）。
# 目录根为 backend/uploads（挂 /uploads），素材文件落在其 assets/ 子目录（与
# admin/router.py 的 ASSETS_UPLOAD_DIR 同源，故 URL /uploads/assets/<file>
# 恰好命中，不双写目录名）；须在下方 "/" SPA 挂载之前注册（路由先匹配原则）。
# 目录创建/挂载失败只记 warning，不阻断服务启动（此时上传端点同样会失败，后台可见）。
uploads_root_dir = Path(__file__).resolve().parents[1] / "uploads"
try:
    (uploads_root_dir / "assets").mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_root_dir)), name="uploads")
    logger.info("素材上传目录静态托管: %s → /uploads", uploads_root_dir / "assets")
except Exception:
    logger.warning("素材上传目录不可用，跳过 /uploads 静态托管", exc_info=True)

# Serve frontend static files at root (after API routes)
frontend_path = Path("../frontend/public")
if frontend_path.exists():
    app.mount("/", SPAStaticFiles(directory=str(frontend_path), html=True), name="frontend")