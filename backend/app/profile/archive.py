"""用户档案模块（ADR-0006：DB为唯一事实源）"""
from sqlalchemy.orm import Session
from app.models import Case, Chart, MethodResult, Calibration, Conversation


def build_archive(case: Case, db: Session) -> dict:
    """从数据库聚合命理档案"""
    return {
        "caseId": str(case.id),
        "input": case.input_json,
        "status": case.status.value if case.status else None,
        "chart": _get_chart(case, db),
        "calibrations": _get_calibrations(case, db),
        "conversations": _get_conversations(case, db),
        "method_results": _get_method_results(case, db),
    }


def _get_chart(case: Case, db: Session) -> dict | None:
    chart = db.query(Chart).filter_by(case_id=case.id).first()
    if chart:
        return {"data": chart.chart_json, "degraded": chart.degraded_methods}
    return None


def _get_calibrations(case: Case, db: Session) -> dict | None:
    cal = db.query(Calibration).filter_by(case_id=case.id).first()
    if cal:
        return {"record": cal.record_json, "fit": cal.fit_json}
    return None


def _get_conversations(case: Case, db: Session) -> list[dict]:
    convs = (
        db.query(Conversation)
        .filter_by(case_id=case.id)
        .order_by(Conversation.turn)
        .all()
    )
    return [
        {"turn": c.turn, "role": c.role, "content": c.content, "created_at": str(c.created_at)}
        for c in convs
    ]


def _get_method_results(case: Case, db: Session) -> list[dict]:
    results = (
        db.query(MethodResult)
        .filter_by(case_id=case.id)
        .all()
    )
    return [
        {
            "method": r.method_key,
            "phase": r.phase.value if r.phase else None,
            "result": r.result_json,
            "validation": r.validation_json,
            "cached": r.cached,
        }
        for r in results
    ]
