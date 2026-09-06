"""埋点采集路由：POST /api/events（前端批量埋点，可匿名）。"""
import logging
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.auth.router import get_user_id_from_token
from app.events.service import record_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["events"])


class EventItem(BaseModel):
    event_name: str
    props: Optional[dict] = None
    session_id: Optional[str] = None


class EventsRequest(BaseModel):
    events: list[EventItem]


@router.post("/events")
async def post_events(req: EventsRequest, authorization: Optional[str] = Header(None)):
    """接收前端批量埋点；尽力解析 user_id（匿名也允许）。"""
    user_id = None
    if authorization:
        try:
            user_id = get_user_id_from_token(authorization)
        except Exception:
            user_id = None

    count = 0
    for e in req.events:
        record_event(e.event_name, user_id=user_id, session_id=e.session_id, props=e.props)
        count += 1

    return {"code": 0, "message": "ok", "data": {"count": count}}
