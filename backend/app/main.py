"""命理 H5 后端（FastAPI 模块化单体 MVP）"""
import asyncio
import logging
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from urllib.parse import quote

from app import legal
from app.config import settings
from app.database import (
    AnalyticsSession,
    Base,
    FeedbackBase,
    OpsBase,
    analytics_engine,
    ensure_agent_memory_fts,
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

    # 节147 续：合规文书主体信息体检 —— 缺了不阻断启动（本地开发/测试可能不需要），
    # 但必须**显眼地喊一声**：这两份是线上展示的用户协议与隐私政策，缺主体信息时
    # /legal/*.html 会返回 500（fail closed，见 app/legal.py）。
    if legal.missing_placeholders():
        logger.warning(
            "合规文书主体信息未配置完整，/legal/*.html 将返回 500。缺失项：%s。"
            "请在 .env 设置 MINGLI_OPERATOR_NAME / MINGLI_OPERATOR_CONTACT / MINGLI_OPERATOR_EMAIL。",
            " / ".join(legal.missing_placeholders()),
        )

    # 孤儿 job 恢复：服务重启后把 pending/running 任务置为 failed（请重新触发）
    _recover_orphan_jobs()

    # REQ-077：FTS5 全文索引 + 同步触发器（幂等；须在 create_all 之后调用，
    # 此时 agent_memories 表已存在）。放 ensure_schema() 同区段（方案书 §1.6）。
    try:
        ensure_agent_memory_fts()
    except Exception:
        # FTS 不可用只降级（召回静默为空），不阻断启动
        logger.warning("agent_memories FTS 初始化失败（记忆召回将降级为空）", exc_info=True)

    # REQ-077：记忆抽取 worker —— 进程内单 asyncio 协程（非进程/线程/daemon，
    # 方案书 §2.1/§2.8）。启动先恢复残留 pending/running 任务（置为可重试），
    # 再拉起 worker；关停时 cancel（未完成任务保留表内由下次启动恢复）。
    memory_worker = None
    try:
        from app.memory.service import (
            memory_worker_loop,
            recover_pending_tasks as recover_memory_tasks,
        )

        recover_memory_tasks()
        memory_worker = asyncio.create_task(memory_worker_loop())
        logger.info("记忆抽取 worker 协程已启动")
    except Exception:
        logger.warning("记忆抽取 worker 启动失败（记忆抽取降级不可用）", exc_info=True)

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

    # 节146：金数据充值轮询（jinshuju_poll）已随付款充值链路整条拆除——lifespan 不再挂任何
    # 充值与到账轮询任务（余额/逐法扣费/后台调分保留，见 credits/service.py）。

    yield

    # REQ-077：优雅关停记忆抽取 worker（cancel + 等收尾；当前 LLM 调用随事件循环
    # 中断，任务行保持 running → 下次启动 _recover 恢复补跑，方案书 §2.8）
    if memory_worker is not None:
        memory_worker.cancel()
        try:
            await memory_worker
        except asyncio.CancelledError:
            pass
        logger.info("记忆抽取 worker 协程已停止")

    if proc is not None:
        try:
            proc.terminate()
            logger.info("排盘常驻服务已停止 pid=%s", proc.pid)
        except Exception:
            logger.warning("排盘常驻服务停止时出错（忽略）", exc_info=True)


from app.admin.router import router as admin_router
from app.api.agent import router as agent_router
from app.api.assets import router as assets_router
from app.api.astrology import router as astrology_router
from app.api.case_share import router as case_share_router
from app.api.cases import router as cases_router
from app.api.divination import router as divination_router
from app.api.jobs import router as jobs_router
from app.api.mbti import router as mbti_router
from app.api.memory import router as memory_router
from app.api.namer import router as namer_router
from app.api.pair import router as pair_router
from app.api.settings import router as settings_router
from app.api.tarot import router as tarot_router
from app.api.zodiac import router as zodiac_router
from app.auth.router import router as auth_router
from app.credits.router import router as credits_router
from app.events.router import router as events_router
from app.middleware import api_metrics_middleware

app = FastAPI(
    title="命理 API",
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
app.include_router(agent_router)
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
app.include_router(namer_router)
app.include_router(settings_router)
app.include_router(memory_router)
app.include_router(credits_router)
app.include_router(events_router)

# 请求埋点中间件（记录 /api/* 到 mingli_ops.events）
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

    另（节147 续）：`/legal/*.html` 是**合规文书**，仓库里只含占位符，需在服务端渲染时
    注入真实运营主体（见 app/legal.py）。只对**确实含占位符**的文件做替换 ——
    其它文件连 body 都不读，保持 StaticFiles 原有的 FileResponse / ETag 行为。
    """

    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
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

        if legal.is_legal_page(path) and isinstance(response, FileResponse):
            return self._render_legal(response)
        return response

    @staticmethod
    def _render_legal(response: FileResponse):
        """把合规文书里的 {{OPERATOR_*}} 占位符替换成配置值。

        - 文件不含占位符 → 原样返回（不影响任何非文书文件）
        - 三项配置任一为空 → 返回 500 并记 error（**不**渲染出空白主体）
        """
        try:
            html = Path(response.path).read_text(encoding="utf-8")
        except OSError:
            return response
        if not legal.has_placeholder(html):
            return response
        try:
            html = legal.render_legal_html(html)
        except legal.OperatorInfoMissing as exc:
            logger.error("%s", exc)
            return PlainTextResponse(str(exc), status_code=500)
        return HTMLResponse(html)


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

# 节140 T3d：旧三大 HUB URL 301 重定向 → /explore 对应文化标签（用户拍板「重定向」）。
# 旧书签/外链直达 /guoxue · /xishi · /mbti 时先落这里（**必须早于下方 "/" SPA 兜底挂载
# 注册**——Starlette 按注册序匹配，挂载 "/" 在后会吞掉一切）；SPA 内部跳转旧 HUB 页名
# 走前端别名渲染 ExplorePage（index.html）。culture 值经 quote 编码进 query，前端
# ExplorePage 挂载时从 location.search 读取预选标签。
_OLD_HUB_REDIRECTS = {
    "/guoxue": "中华",
    "/xishi": "西方",
    "/mbti": "心理",
}
for _old_path, _cult in _OLD_HUB_REDIRECTS.items():
    app.add_api_route(
        _old_path,
        lambda cult=_cult: RedirectResponse(
            "/explore?culture=" + quote(cult), status_code=301
        ),
        methods=["GET"],
        include_in_schema=False,
    )

# Serve frontend static files at root (after API routes)
frontend_path = Path("../frontend/public")
if frontend_path.exists():
    app.mount("/", SPAStaticFiles(directory=str(frontend_path), html=True), name="frontend")