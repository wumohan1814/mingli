"""太初 · 命理 H5 后端（FastAPI 模块化单体 MVP）"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, FeedbackBase, analytics_engine, ensure_schema, feedback_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时创建所有表并执行轻量 schema 迁移"""
    Base.metadata.create_all(bind=analytics_engine)
    FeedbackBase.metadata.create_all(bind=feedback_engine)
    ensure_schema()
    yield


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