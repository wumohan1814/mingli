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


def ensure_agent_memory_fts() -> None:
    """REQ-077：FTS5 全文索引（agent_memories_fts，trigram）+ 同步触发器（幂等）。

    方案书 §1.3/§1.6：在 lifespan 的 `Base.metadata.create_all` 之后调用（此时
    agent_memories 表已存在）。采用 **FTS5 内容表自持镜像**（rowid = agent_memories.id），
    中文 tokenizer 用内建 **trigram**，与事实表由数据库触发器自动同步。

    实测结论（SQLite 3.50.4，本机）：
    - trigram tokenizer 内建可用（≥3 字符子串查询可命中，2 字查询返回空集不报错），
      短查询降级由检索层负责（memory/service.py recall 的 recency 兜底）；
    - trigram 表**不支持** FTS5 特殊 'delete' 命令（SQL logic error），故 DELETE 同步
      用普通 `DELETE FROM agent_memories_fts WHERE rowid=old.id`（实测可用）。

    user_id 刻意不进 FTS 列：多用户共享同一全文索引，隔离靠召回 SQL join 回事实表后
    强制 `m.user_id = :uid` 过滤（方案书 §4）。软删（UPDATE deleted_at）不触发下面的
    `AFTER UPDATE OF content` 触发器，服务层软删时显式 DELETE 该 FTS 行。

    SQLite 的 CREATE VIRTUAL TABLE / CREATE TRIGGER 均支持 IF NOT EXISTS，本函数可
    重复执行（幂等）。
    """
    statements = (
        # 内容表自持镜像 + trigram（中文 ≥3 字子串可检索）
        "CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_fts USING fts5(content, tokenize = 'trigram')",
        # 插入同步：新事实进索引
        "CREATE TRIGGER IF NOT EXISTS agent_memories_ai AFTER INSERT ON agent_memories "
        "BEGIN INSERT INTO agent_memories_fts(rowid, content) VALUES (new.id, new.content); END",
        # 物理删除同步：摘索引行（trigram 不支持 'delete' 命令，用普通 DELETE）
        "CREATE TRIGGER IF NOT EXISTS agent_memories_ad AFTER DELETE ON agent_memories "
        "BEGIN DELETE FROM agent_memories_fts WHERE rowid = old.id; END",
        # content 更新同步：先摘后插；去重刷新只 UPDATE 时间戳/importance 不触发此触发器
        "CREATE TRIGGER IF NOT EXISTS agent_memories_au AFTER UPDATE OF content ON agent_memories "
        "BEGIN DELETE FROM agent_memories_fts WHERE rowid = old.id; "
        "INSERT INTO agent_memories_fts(rowid, content) VALUES (new.id, new.content); END",
    )
    with analytics_engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def ensure_schema() -> None:
    """轻量幂等迁移：为老库补齐缺失列（SQLite ADD COLUMN）。
    - jobs.result_json（预测任务落库）
    - cases.name（档案命名）
    - conversations.topic（板块追问归档，跨次持久化）
    - astrology_readings.case_id / mbti_results.case_id / cases.mbti_type
      （统一档案体系：星座、MBTI 复用 cases 档案并回写 mbti_type）
    - cases.phone / cases.email（REQ-065 CRM 化：手机号/邮箱，建档选填、
      独立列供列表/档案详情直接查询，不再只塞 input_json）
    - divinations.focus_interpretations（REQ-075 六爻焦点详解缓存：老库补列，
      新库由 create_all 建全）

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
        if case_cols and "mbti_type" not in case_cols:
            conn.execute(text("ALTER TABLE cases ADD COLUMN mbti_type VARCHAR(8)"))
        if case_cols and "phone" not in case_cols:
            conn.execute(text("ALTER TABLE cases ADD COLUMN phone VARCHAR(32)"))
        if case_cols and "email" not in case_cols:
            conn.execute(text("ALTER TABLE cases ADD COLUMN email VARCHAR(128)"))
        conv_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(conversations)"))]
        if conv_cols and "topic" not in conv_cols:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN topic VARCHAR(64)"))
        # 统一档案体系：astrology_readings / mbti_results 补 case_id（关联国学档案 cases.id）
        astro_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(astrology_readings)"))]
        if astro_cols and "case_id" not in astro_cols:
            conn.execute(text("ALTER TABLE astrology_readings ADD COLUMN case_id INTEGER"))
        mbti_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(mbti_results)"))]
        if mbti_cols and "case_id" not in mbti_cols:
            conn.execute(text("ALTER TABLE mbti_results ADD COLUMN case_id INTEGER"))

        # REQ-075：divinations 补 focus_interpretations（六爻焦点详解缓存 JSON，缺列才加）
        div_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(divinations)"))]
        if div_cols and "focus_interpretations" not in div_cols:
            conn.execute(text("ALTER TABLE divinations ADD COLUMN focus_interpretations JSON"))

        # system_configs 种子：余额默认值（key 不存在才插入，幂等；不覆盖后台已改的配置）。
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
