"""跨用户质疑采集模块"""
from sqlalchemy.orm import Session
from app.models.feedback import Feedback, FeedbackType


def record_feedback(
    db: Session,
    case_id: int,
    user_id: int,
    method_key: str,
    domain: str,
    claim_text: str,
    feedback_type: str,
    user_note: str = "",
):
    """记录用户对某条断言的质疑/确认"""
    fb = Feedback(
        case_id=case_id,
        user_id=user_id,
        method_key=method_key,
        domain=domain,
        claim_text=claim_text,
        feedback_type=FeedbackType(feedback_type),
        user_note=user_note,
    )
    db.add(fb)
    db.commit()
    return fb
