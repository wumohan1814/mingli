"""埋点写入服务（taichu_ops.events）。

埋点写库失败只记日志、不抛异常、绝不阻断业务。
"""
import logging

from app.database import OpsSession
from app.models.ops import Event

logger = logging.getLogger(__name__)


def record_event(event_name: str, *, user_id=None, case_id=None, session_id=None,
                 props=None, ip=None, user_agent=None) -> None:
    """同步写一条埋点到 taichu_ops.events。失败静默。"""
    try:
        session = OpsSession()
        try:
            session.add(Event(
                event_name=event_name,
                user_id=user_id,
                case_id=case_id,
                session_id=session_id,
                props=props,
                ip=ip,
                user_agent=user_agent,
            ))
            session.commit()
        finally:
            session.close()
    except Exception:
        logger.warning("埋点写入失败 event=%s", event_name, exc_info=True)
