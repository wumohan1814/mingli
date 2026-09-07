"""运维库 ORM 模型（taichu_ops）：埋点 / 后台 / 错误上报。

与业务库（taichu_analytics）分离，便于单独备份/清理。
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index
from app.database import OpsBase


class Event(OpsBase):
    """埋点事件（写多读少、量大、可丢弃）。"""
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_name_created", "event_name", "created_at"),
        Index("ix_events_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_name = Column(String(64), nullable=False)
    user_id = Column(Integer, nullable=True)
    case_id = Column(Integer, nullable=True)
    session_id = Column(String(64), nullable=True)
    props = Column(JSON, nullable=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminUser(OpsBase):
    """后台管理员账号（独立于 C 端 users）。"""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(16), nullable=False, default="admin")  # admin | operator | viewer
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


class AdminAuditLog(OpsBase):
    """后台运维审计日志（所有写动作必记）。"""
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_user_id = Column(Integer, nullable=True)
    action = Column(String(64), nullable=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(String(64), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ErrorReport(OpsBase):
    """错误上报（前后端统一）。"""
    __tablename__ = "error_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    error_code = Column(String(16), nullable=True)
    message = Column(Text, nullable=True)
    detail = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=True)
    case_id = Column(Integer, nullable=True)
    source = Column(String(16), nullable=True)  # frontend | backend
    stack = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PromptVersion(OpsBase):
    """提示词版本快照（REQ-048）。

    每次后台编辑 / 回滚 prompt 前把"将要写盘的内容"落一份快照到运维库，
    支持查看历史版本与回滚。内容不设外键（prompt_key 是文件 key 而非表行）。
    """
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt_key = Column(String(64), nullable=False, index=True)
    content = Column(Text, nullable=False)
    admin_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
