"""Jobs API：查询异步任务状态"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.combine import combine_label, normalize_mode, report_titles_for
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
    """查询任务状态（纯读库，零LLM）。

    信封与旧键**一字未变**（jobId/status/completed/total/result/error），合参改造新增
    三个键（纯派生，不占库列）：

    - `label`：合参标签，如「九法合一」（命盘合参）/「六法合参」（当下事合参）；
      老 job（无 combine_mode）按命盘合参口径、分母取 job.total；
    - `methodKeys`：本 job 实际方法集（建 job 时落库）；老 job 未记录 → `[]`；
    - `reportTitles`：本 job 的报告骨架（板块标题与顺序），前端按它渲染详情板块。
    """
    user_id = get_user_id_from_token(authorization)
    job = db.query(Job).filter_by(id=job_id, user_id=user_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="job不存在")

    result = None
    if job.status.value == "succeeded":
        result = job.result_json

    # 老 job（合参上线前建的行）没有 combine_mode / method_keys → 按命盘合参口径兜底，
    # 行为与前端旧版本一致（不因缺列而少键或报错）。
    mode = normalize_mode(job.combine_mode)
    method_keys = job.method_keys if isinstance(job.method_keys, list) else []
    count = len(method_keys) or int(job.total or 0)

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
            "label": combine_label(count, mode),
            "methodKeys": method_keys,
            "reportTitles": report_titles_for(mode),
        },
    }
