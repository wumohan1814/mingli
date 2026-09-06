"""Jobs API：查询异步任务状态"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_analytics_db
from app.models import Job
from app.auth.router import get_user_id_from_token

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job(
    job_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """查询任务状态（纯读库，零LLM）"""
    user_id = get_user_id_from_token(authorization)
    job = db.query(Job).filter_by(id=job_id, user_id=user_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="job不存在")

    result = None
    if job.status.value == "succeeded":
        result = job.result_json

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "jobId": str(job.id),
            "status": job.status.value if job.status else "pending",
            "completed": job.completed,
            "total": job.total,
            "result": result,
            "error": job.error,
        },
    }
