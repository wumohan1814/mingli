"""用户档案模块（ADR-0006：DB为唯一事实源）"""
from sqlalchemy.orm import Session
from app.api.mbti import load_types
from app.models import (
    Case, Chart, MethodResult, Calibration, Conversation,
    AstrologyReading, MbtiResult,
)


def build_archive(case: Case, db: Session) -> dict:
    """从数据库聚合命理档案"""
    return {
        "caseId": str(case.id),
        "phone": case.phone,
        "email": case.email,
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
    """该档案已生成的星座星盘记录（只带 chart.natal 控制体积，供档案内直接展示完整盘面）"""
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
            # REQ-039 退回细化：chart 只保留 natal（= r.chart_json["natal"]），
            # 供档案内直接渲染完整本命盘；chart_json 缺失/非 dict 时判空为 None
            "chart": _natal_chart(r.chart_json),
        }
        for r in readings
    ]


def _natal_chart(chart_json) -> dict | None:
    """把 AstrologyReading.chart_json（{natal, fullScope?}）裁成 {natal}；判空兜底 None"""
    if not isinstance(chart_json, dict) or not isinstance(chart_json.get("natal"), dict):
        return None
    return {"natal": chart_json.get("natal")}


def _get_mbti(case: Case, db: Session) -> dict:
    """该档案的人格（大五）数据（节125 起两条账分开）：

    - mbti_type / type_info：档案里「人格类型」= 用户认定过的值（自填或保存），
      语义为「用户认定」，不再是平台判型结果；type_info 从 types.json 实时取。
    - source：来源语义（零 DDL 推导）—— case.mbti_type 存在且与某条判型记录同型
      → "mapped"（由大五参考换算并保存）；否则有类型但无同型记录 → "manual"
      （用户自填）；无类型 → None。
    - scores：最近一条判型记录的 OCEAN 五维（平台产出，0–100）；无记录 → None。
    - results：判型记录列表（不含 answers_json 全量）。
    """
    results = (
        db.query(MbtiResult)
        .filter_by(case_id=case.id)
        .order_by(MbtiResult.id.desc())
        .all()
    )
    # type_info 同 GET /api/mbti/results/{id} 口径：类型大小写不敏感、取五栏文案
    mbti_type = (case.mbti_type or "").strip().upper()
    type_info = load_types().get(mbti_type) or {} if mbti_type else {}
    # 来源语义（节125 零 DDL 推导，非新增列）：有同型判型记录 → 由大五换算并保存；
    # 仅手输（无同型记录）→ 用户自填。
    source = None
    if mbti_type:
        source = "mapped" if any((r.type or "").strip().upper() == mbti_type for r in results) else "manual"
    latest_scores = results[0].scores_json if results else None
    return {
        "mbti_type": case.mbti_type,
        "type_info": type_info,
        "source": source,
        "scores": latest_scores,
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
