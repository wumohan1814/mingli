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


class SystemConfig(Base):
    """后台可动态改的系统配置（system_configs，如 recharge_rate / free_credit_on_register）"""
    __tablename__ = "system_configs"

    key = Column(String(64), primary_key=True)  # 如 recharge_rate / free_credit_on_register
    value = Column(String(255))
    description = Column(String(255), nullable=True)
    updated_by = Column(String(64), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
