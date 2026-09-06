"""太初 · 命理 H5 后端（FastAPI 模块化单体 MVP）"""
import logging
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, FeedbackBase, analytics_engine, ensure_schema, feedback_engine

logger = logging.getLogger(__name__)

# 常驻排盘 Node 服务（backend/paipan-node/server.mjs）：
# main.py 位于 backend/app/，parents[1] = backend，故 cwd 需指向 backend/paipan-node
# 以保证 server.mjs 内 ./vendor/... 相对路径正确。
PAIPAN_SERVER = Path(__file__).resolve().parents[1] / "paipan-node" / "server.mjs"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时创建所有表、执行轻量 schema 迁移，并拉起常驻排盘 Node 服务。

    排盘服务启动失败只记 warning、不阻断应用启动：app.paipan.engine 会静默降级到
    subprocess（ziwei.cjs / extra.mjs）。
    """
    proc = None
    Base.metadata.create_all(bind=analytics_engine)
    FeedbackBase.metadata.create_all(bind=feedback_engine)
    ensure_schema()

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

    yield

    if proc is not None:
        try:
            proc.terminate()
            logger.info("排盘常驻服务已停止 pid=%s", proc.pid)
        except Exception:
            logger.warning("排盘常驻服务停止时出错（忽略）", exc_info=True)


from app.api.cases import router as cases_router
from app.api.jobs import router as jobs_router
from app.auth.router import router as auth_router

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


app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(jobs_router)

# Serve frontend static files at root (before API routes)
frontend_path = Path("../frontend/public")
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}