#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MBTI 人格测试 API 路由（横向扩展 Phase D2 · 人格测试）。

契约（全部纯代码，零 LLM、零扣费、无 interpret 付费点）：
  - GET  /api/mbti/questions      题库公开，无需鉴权：返回 {code:0, data:{questions}}，
                                  questions 直接读 mbti/data/questions.json（60 题，
                                  每题为二选一，选项带 dim pole 映射）。
  - POST /api/mbti/score          鉴权（Bearer token）：body {case_id, answers}，
                                  case_id 必填（须为本人档案，非本人/不存在 404）：
                                  调 mbti.scoring.score 纯代码判型得 {type, scores}，
                                  落 mbti_results 表（带 case_id）并回写
                                  case.mbti_type = type，再写 mbti_score 埋点
                                  （props={type, case_id}），返回 {id, type, scores}。
                                  答案缺失/结构非法/某维度未作答 → 400 参数错误。
  - GET  /api/mbti/results/{id}   鉴权：按 id+user_id 隔离取记录（查不到 404），
                                  返回 {id, case_id, type, scores, type_info}，
                                  type_info 从 mbti/data/types.json 实时取该型的
                                  五栏文案（alias/优势/盲点/职场/关系/成长）。

数据路径：mbti.py 位于 backend/app/api/，parents[1] = backend/app，
故数据目录为 Path(__file__).resolve().parents[1] / "mbti" / "data"。
"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.router import get_user_id_from_token
from app.database import get_analytics_db
from app.events.service import record_event
from app.mbti import scoring
from app.mbti.scoring import load_questions
from app.models import Case, MbtiResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["mbti"])

MBTI_DATA_DIR = Path(__file__).resolve().parents[1] / "mbti" / "data"
TYPES_PATH = MBTI_DATA_DIR / "types.json"

_types_cache: dict | None = None


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（本文件新增端点统一使用）"""
    return HTTPException(status_code=status, detail=detail)


def load_types() -> dict:
    """读取 16 型文案 types.json（进程内缓存）；文件缺失/为空视为配置错误。"""
    global _types_cache
    if _types_cache is None:
        try:
            data = json.loads(TYPES_PATH.read_text(encoding="utf-8"))
        except OSError as exc:
            raise RuntimeError(f"MBTI 16 型文案缺失或不可读: {TYPES_PATH}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"MBTI 16 型文案 JSON 解析失败: {TYPES_PATH}") from exc
        types_map = data.get("types")
        if not isinstance(types_map, dict) or not types_map:
            raise RuntimeError(f"MBTI 16 型文案为空: {TYPES_PATH}")
        _types_cache = dict(types_map)
    return _types_cache


def _get_owned_result(db: Session, result_id: int, user_id: int) -> MbtiResult:
    """按 id+user_id 取测评结果（多用户隔离）；不存在抛 404"""
    row = db.query(MbtiResult).filter_by(id=result_id, user_id=user_id).first()
    if row is None:
        raise _err(404, "测评记录不存在")
    return row


# --- 请求模型 ---
class ScoreRequest(BaseModel):
    case_id: int = Field(description="国学档案 id（判型结果关联该档案并回写 case.mbti_type）")
    answers: List[Dict[str, Any]] = Field(
        description="逐题答案，两种形态："
                    "[{\"question_id\":1,\"choice\":\"A\"}, ...]（按选项 key 取 pole）或 "
                    "[{\"id\":1,\"pole\":\"E\"}, ...]（直接给所选端字母）；"
                    "需覆盖 EI/SN/TF/JP 四个维度",
    )


# --- 路由 ---
@router.get("/mbti/questions")
def get_mbti_questions():
    """题库（公开，无需鉴权）：返回 60 题标准版，每题为二选一并带维度 pole。"""
    return {"code": 0, "message": "ok", "data": {"questions": load_questions()}}


@router.post("/mbti/score")
def score_mbti(
    body: ScoreRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """判型（纯代码，免费，落库）：校验 case 归属 → scoring.score →
    落 mbti_results 表（带 case_id）+ 回写 case.mbti_type + mbti_score 埋点。

    零 LLM 零扣费：判型为本地计数，无 chat 调用、无积分扣减。
    """
    user_id = get_user_id_from_token(authorization)

    # ① case 归属校验（id+user_id 隔离，非本人/不存在 → 404）
    case = db.query(Case).filter_by(id=body.case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")

    # ② 判型（纯代码）：非法答案（缺失/结构错/题目不存在/维度不全）→ 400
    try:
        result = scoring.score(body.answers)
    except ValueError as exc:
        raise _err(400, str(exc))

    # ③ 落库（免费持久化，供 GET /results/{id} 只读复看）+ 回写档案 MBTI 类型，
    #    同一次 db commit 保证原子（case.mbti_type 与结果行要么都在要么都不在）
    row = MbtiResult(
        user_id=user_id,
        case_id=body.case_id,
        answers_json=body.answers,
        scores_json=result["scores"],
        type=result["type"],
    )
    db.add(row)
    case.mbti_type = result["type"]
    db.commit()
    db.refresh(row)

    # ④ 埋点（写库失败静默，绝不阻断业务）；本功能零 LLM 零扣费
    record_event("mbti_score", user_id=user_id,
                 props={"type": row.type, "case_id": body.case_id})

    return {"code": 0, "message": "ok",
            "data": {"id": row.id, "type": row.type, "scores": row.scores_json}}


@router.get("/mbti/results/{result_id}")
def get_mbti_result(
    result_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """读单条测评结果（只读，零 LLM）：id+user_id 隔离，查不到 404；
    type_info 实时从 types.json 取该型五栏文案（结果行内未冗余存储）。"""
    user_id = get_user_id_from_token(authorization)
    row = _get_owned_result(db, result_id, user_id)

    type_info = load_types().get(row.type) or {}

    return {"code": 0, "message": "ok", "data": {
        "id": row.id,
        "case_id": row.case_id,
        "type": row.type,
        "scores": row.scores_json,
        "type_info": type_info,
    }}
