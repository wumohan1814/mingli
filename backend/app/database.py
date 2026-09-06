"""数据库引擎与会话管理（SQLite MVP）"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
from pathlib import Path

Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
Path(settings.feedback_db_path).parent.mkdir(parents=True, exist_ok=True)

analytics_engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
    echo=False,
)

feedback_engine = create_engine(
    f"sqlite:///{settings.feedback_db_path}",
    connect_args={"check_same_thread": False},
    echo=False,
)

@event.listens_for(analytics_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

@event.listens_for(feedback_engine, "connect")
def _set_feedback_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

AnalyticsSession = sessionmaker(bind=analytics_engine, autocommit=False, autoflush=False)
FeedbackSession = sessionmaker(bind=feedback_engine, autocommit=False, autoflush=False)

Base = declarative_base()
FeedbackBase = declarative_base()


def get_analytics_db():
    session = AnalyticsSession()
    try:
        yield session
    finally:
        session.close()


def get_feedback_db():
    session = FeedbackSession()
    try:
        yield session
    finally:
        session.close()


def ensure_schema() -> None:
    """轻量幂等迁移：为老库补齐缺失列（SQLite ADD COLUMN）。
    - jobs.result_json（预测任务落库）
    - cases.name（档案命名）
    - conversations.topic（板块追问归档，跨次持久化）

    SQLite 的 DDL 不支持 IF NOT EXISTS，故先 PRAGMA table_info 探测再 ALTER；
    用 engine.begin() 开显式事务，幂等（重复执行不报错）。
    create_all 之后调用，因此相关表必然已存在；若表缺失（空库）则直接跳过。
    """
    with analytics_engine.begin() as conn:
        job_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(jobs)"))]
        if job_cols and "result_json" not in job_cols:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN result_json JSON"))
        case_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(cases)"))]
        if case_cols and "name" not in case_cols:
            conn.execute(text("ALTER TABLE cases ADD COLUMN name VARCHAR(128)"))
        conv_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(conversations)"))]
        if conv_cols and "topic" not in conv_cols:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN topic VARCHAR(64)"))
