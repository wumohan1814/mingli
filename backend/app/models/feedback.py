"""跨用户质疑库 ORM 模型（mingli_feedback）"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Enum as SAEnum
from app.database import FeedbackBase
import enum


class FeedbackType(str, enum.Enum):
    confirmed = "confirmed"
    denied = "denied"
    corrected = "corrected"


class Feedback(FeedbackBase):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    method_key = Column(String(64), nullable=True)
    domain = Column(String(32), nullable=True)
    claim_text = Column(Text, nullable=True)
    feedback_type = Column(SAEnum(FeedbackType), nullable=False)
    user_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FeedbackSummary(FeedbackBase):
    __tablename__ = "feedback_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    period = Column(String(32), nullable=True)
    method_key = Column(String(64), nullable=True)
    denied_count = Column(Integer, default=0)
    corrected_count = Column(Integer, default=0)
    top_issues = Column(JSON, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
