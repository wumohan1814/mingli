"""运维库 ORM 模型（taichu_ops）：埋点 / 后台 / 错误上报。

与业务库（taichu_analytics）分离，便于单独备份/清理。
"""
from datetime import datetime
from sqlalchemy import Column, Float, Integer, String, Text, DateTime, JSON, Index
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


class AssetSlot(OpsBase):
    """素材热更槽（REQ-059，运维库 asset_slots）：后台素材管理上传即热更前台展示。

    key 全局唯一（跨 kind）；kind 分类（String16 白名单，admin 写端点校验）：
      - module     模块级 3 槽背景（国学预测 / 西式占卜 / MBTI 落地页背景，
                   落地页与 Hub 页复用同一张；key=module-guoxue / module-xishi /
                   module-mbti）
      - method     Hub 方法级 N 槽背景（国学 Hub / 西式 Hub 每个方法选项独立
                   背景图，按选项 key：method-nine / method-zodiac /
                   method-divination / method-astrology / method-tarot /
                   method-lenormand）
      - mbti_type  MBTI 16 型结果背景（16 槽，按 mbti_type 代码 INTJ…ESFP，
                   仅结果/详情页展示）
      - card       卡牌素材（塔罗 78 + 雷诺曼 36 卡面，按卡 key：tarot-<牌名
                   文件 stem> / lenormand-01…36，统一查看与更换）
      - agent      太初先生会话页背景槽 ×5（key=agent-1…agent-5，前台进入会话/
                   每 10 分钟从已填充槽随机轮换，见 REQ-059⑥）
    url 为素材地址：已上传文件的相对路径（/uploads/assets/...）或完整 URL。
    未配置 / 删除该行 → 前台回退既有 CSS 艺术背景。热更：前台 GET /api/assets
    每次实时查表，无启动缓存，后台 PUT/DELETE 立即生效、无需重启。

    背景蒙版（REQ-059⑧）：opacity 为该槽蒙版不透明度（0~1），NULL = 不启用
    （默认 0）；mask_color 为蒙版颜色 hex（默认黑 #000000，NULL 即默认黑）。
    蒙版只随槽行存在（url 必填），未配置背景的槽无蒙版。

    建表：main.py lifespan 里 OpsBase.metadata.create_all（checkfirst=True）幂等；
    老库补列走 ensure_schema 的 PRAGMA+ALTER（database.py）。
    """
    __tablename__ = "asset_slots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    kind = Column(String(16), nullable=False, default="module")
    url = Column(Text, nullable=False)
    # REQ-059⑧ 背景蒙版：不透明度 0~1（NULL=不启用）+ 蒙版颜色（NULL=默认黑）
    opacity = Column(Float, nullable=True)
    mask_color = Column(String(16), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
