"""用户分析库 ORM 模型（taichu_analytics）"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CaseStatus(str, enum.Enum):
    created = "created"
    paipan_done = "paipan_done"
    dqc_running = "dqc_running"
    dqc_done = "dqc_done"
    calibrated = "calibrated"
    predict_running = "predict_running"
    predict_done = "predict_done"
    failed = "failed"


class JobType(str, enum.Enum):
    duan_qian_chen = "duan-qian-chen"
    predict = "predict"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class Phase(str, enum.Enum):
    duan_qian_chen = "duan-qian-chen"
    prediction = "prediction"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    nickname = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cases = relationship("Case", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(256), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), nullable=False, index=True)
    fail_count = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(128), nullable=True)
    input_json = Column(JSON, nullable=True)
    current_stage = Column(Integer, default=0)
    status = Column(SAEnum(CaseStatus), default=CaseStatus.created)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="cases")
    chart = relationship("Chart", back_populates="case", uselist=False)
    method_results = relationship("MethodResult", back_populates="case")
    calibration = relationship("Calibration", back_populates="case", uselist=False)
    conversations = relationship("Conversation", back_populates="case")
    jobs = relationship("Job", back_populates="case")


class Chart(Base):
    __tablename__ = "charts"

    case_id = Column(Integer, ForeignKey("cases.id"), primary_key=True)
    chart_json = Column(JSON, nullable=True)
    degraded_methods = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    generated_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="chart")


class MethodResult(Base):
    __tablename__ = "method_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    method_key = Column(String(64), nullable=False)
    phase = Column(SAEnum(Phase), nullable=False)
    result_json = Column(JSON, nullable=True)
    validation_json = Column(JSON, nullable=True)
    cached = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="method_results")


class Calibration(Base):
    __tablename__ = "calibrations"

    case_id = Column(Integer, ForeignKey("cases.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    record_json = Column(JSON, nullable=True)
    fit_json = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="calibration")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    turn = Column(Integer, nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=True)
    # 板块追问 topic（如 "事业"/"财运"/"婚姻"）；普通追问为 None，保持兼容
    topic = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="conversations")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SAEnum(JobType), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.pending)
    total = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="jobs")


class RouteDecision(Base):
    __tablename__ = "route_decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    phase = Column(SAEnum(Phase), nullable=False)
    main_methods = Column(JSON, nullable=True)
    support_methods = Column(JSON, nullable=True)
    reasons = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CreditAccount(Base):
    """积分账户（credit_accounts，user_id 1:1）"""
    __tablename__ = "credit_accounts"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    balance = Column(Integer, default=0)
    total_consumed = Column(Integer, default=0)
    total_recharged = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CreditTransaction(Base):
    """积分流水（credit_transactions，delta>0 入账 / delta<0 消费）"""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    delta = Column(Integer)                 # 正=入账，负=消费
    type = Column(String(16))               # consume | recharge | manual | refund | free
    tokens = Column(Integer, nullable=True)
    amount = Column(Float, nullable=True)
    ref = Column(String(128), nullable=True)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RechargeCode(Base):
    """充值码（recharge_codes）：一次性、绑定 user_id、短时效；充值成功即作废（防重放）。

    status: unused（可用）| used（已充值作废）| expired（预留过期态）。
    """
    __tablename__ = "recharge_codes"

    code = Column(String(16), primary_key=True)   # TC-XXXXXX
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    status = Column(String(8), default="unused")  # unused | used | expired
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemConfig(Base):
    """后台可动态改的系统配置（system_configs，如 recharge_rate / free_credit_on_register）"""
    __tablename__ = "system_configs"

    key = Column(String(64), primary_key=True)  # 如 recharge_rate / free_credit_on_register
    value = Column(String(255))
    description = Column(String(255), nullable=True)
    updated_by = Column(String(64), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RegisterLimit(Base):
    """注册限流计数（register_limits）：注册成功落一行，按 IP / 设备指纹两个维度限流。

    表由 main.py lifespan 的 Base.metadata.create_all 幂等建（老库自动补，无需 ALTER）。
    行不清理：IP 维度查询带 1 小时时间窗，旧行自然失效；设备指纹维度不带时间窗，
    同一设备永久只能注册一个账号。
    """
    __tablename__ = "register_limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip = Column(String(64), index=True)
    device_fingerprint = Column(String(128), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Divination(Base):
    """临时起卦（divinations，Phase B）：确定性起卦免费落库 + LLM 断卦可选付费缓存。

    seed_json / result_json 均可为 None（转发 Node 失败时不落库，故正常行两者非空）；
    interpretation_json 由 POST /divinations/{id}/interpret 写入（{"content": 断卦文本}），
    命中即为缓存，二次 interpret 零 LLM 零扣费直接返回。
    """
    __tablename__ = "divinations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)  # 起卦关联国学档案
    method = Column(String(32), nullable=False)        # liuyao|meihua|xiaoliuren|ssgw|lenormand|...
    seed_json = Column(JSON, nullable=True)            # 报数/时间/摇卦结果
    result_json = Column(JSON, nullable=True)          # 卦象/课式/签文（确定性）
    interpretation_json = Column(JSON, nullable=True)  # LLM 断卦（可选付费，缓存于此）
    created_at = Column(DateTime, default=datetime.utcnow)
