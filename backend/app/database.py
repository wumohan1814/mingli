"""数据库引擎与会话管理（SQLite MVP）"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
from pathlib import Path

Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
Path(settings.feedback_db_path).parent.mkdir(parents=True, exist_ok=True)
Path(settings.ops_db_path).parent.mkdir(parents=True, exist_ok=True)

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

ops_engine = create_engine(
    f"sqlite:///{settings.ops_db_path}",
    connect_args={"check_same_thread": False},
    echo=False,
)

@event.listens_for(analytics_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    # 并发写安全：WAL（读写不互斥）+ busy_timeout 10s（3 个并发 method 写排队而不报
    # database is locked）。PRAGMA journal_mode=WAL 返回结果行，不必 fetch。
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

@event.listens_for(feedback_engine, "connect")
def _set_feedback_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

@event.listens_for(ops_engine, "connect")
def _set_ops_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

AnalyticsSession = sessionmaker(bind=analytics_engine, autocommit=False, autoflush=False)
FeedbackSession = sessionmaker(bind=feedback_engine, autocommit=False, autoflush=False)
OpsSession = sessionmaker(bind=ops_engine, autocommit=False, autoflush=False)

Base = declarative_base()
FeedbackBase = declarative_base()
OpsBase = declarative_base()


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


def get_ops_db():
    session = OpsSession()
    try:
        yield session
    finally:
        session.close()


def ensure_schema() -> None:
    """轻量幂等迁移：为老库补齐缺失列（SQLite ADD COLUMN）。
    - jobs.result_json（预测任务落库）
    - cases.name（档案命名）
    - conversations.topic（板块追问归档，跨次持久化）

    整张新表（如 credits 的 recharge_codes）不在此 ALTER：main.py lifespan 里
    `Base.metadata.create_all`（checkfirst=True）对老库/新库都幂等建缺表，本函数
    只需确保新模型已注册到 Base.metadata（app.models 被 import 即可）。

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

        # system_configs 种子：积分默认值（key 不存在才插入，幂等；不覆盖后台已改的配置）。
        sc_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(system_configs)"))]
        if sc_cols:
            def _fmt(v) -> str:
                # 整数值 float（如 10.0）落库为 "10"，非整 float（如 12.5）保留 "12.5"
                return str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)

            # 值取 config 默认（首启时若以环境变量覆盖，则以覆盖值为准落库）
            seeds = {
                "recharge_rate": _fmt(settings.recharge_rate),
                "free_credit_on_register": str(settings.free_credit_on_register),
            }
            for key, value in seeds.items():
                exists = conn.execute(
                    text("SELECT 1 FROM system_configs WHERE key = :key"), {"key": key}
                ).first()
                if not exists:
                    conn.execute(
                        text("INSERT INTO system_configs (key, value) VALUES (:key, :value)"),
                        {"key": key, "value": value},
                    )
