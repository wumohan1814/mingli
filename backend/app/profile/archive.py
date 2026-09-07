"""用户档案模块（ADR-0006：DB为唯一事实源）"""
from sqlalchemy.orm import Session
from app.models import (
    Case, Chart, MethodResult, Calibration, Conversation,
    AstrologyReading, MbtiResult,
)


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
        "astrology": _get_astrology(case, db),
        "mbti": _get_mbti(case, db),
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
        {
            "turn": c.turn,
            "role": c.role,
            "content": c.content,
            "topic": c.topic,
            "created_at": str(c.created_at),
        }
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


def _get_astrology(case: Case, db: Session) -> list[dict]:
    """该档案已生成的星座星盘记录（不含 chart_json 全量，控制体积）"""
    readings = (
        db.query(AstrologyReading)
        .filter_by(case_id=case.id)
        .order_by(AstrologyReading.id.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "scope": r.scope,
            "created_at": str(r.created_at),
        }
        for r in readings
    ]


def _get_mbti(case: Case, db: Session) -> dict:
    """该档案的 MBTI：档案主人类型 + 判型记录列表（不含 answers_json 全量）"""
    results = (
        db.query(MbtiResult)
        .filter_by(case_id=case.id)
        .order_by(MbtiResult.id.desc())
        .all()
    )
    return {
        "mbti_type": case.mbti_type,
        "results": [
            {
                "id": r.id,
                "type": r.type,
                "scores": r.scores_json,
                "created_at": str(r.created_at),
            }
            for r in results
        ],
    }
