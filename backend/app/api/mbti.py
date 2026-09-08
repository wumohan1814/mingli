#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MBTI 人格测试 API 路由（横向扩展 Phase D2 · 人格测试）。

契约（全部纯代码，零 LLM、零扣费、无 interpret 付费点）：
  - GET  /api/mbti/questions      题库公开，无需鉴权：返回 {code:0, data:{questions}}，
                                  questions 直接读 mbti/data/questions.json（60 题，
                                  每题为二选一，选项带 dim pole 映射）。
  - GET  /api/mbti/types/{type}   16 型文案公开，无需鉴权（前端手动输入类型时取
                                  五栏详解，BUG-005）：type 大小写不敏感（转大写
                                  匹配），非法类型 400；零落库零 LLM 零扣费。
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
  - GET  /api/mbti/results?case_id={case_id}
                                  鉴权：按 case_id+user_id 隔离列出该档案全部
                                  MbtiResult（id 倒序），每项 {id, type, scores,
                                  created_at}（不含 answers_json 全量，控制体积）。
                                  与路径版 GET /results/{result_id} 并存
                                  （REQ-047②：档案内回看各次填写记录）。
  - DELETE /api/mbti/results/{result_id}
                                  鉴权（REQ-054）：按 id+user_id 隔离删除单条历史
                                  记录（复用 _get_owned_result，不存在 404），删除
                                  前二次确认由前端做。保守起见不回写 case.mbti_type
                                  （仅删结果行，避免误清档案当前类型）。
  - POST /api/mbti/share          鉴权：body {case_id:int}（须为本人档案，
                                  非本人/不存在 404）：为该档案生成/复用免登录
                                  分享链接（幂等，已有则复用 token），返回
                                  {token, url:"/mbti/share/"+token}（相对路径）。
  - GET  /api/mbti/share/{token}  免登录（REQ-047①）：按 token 取分享链接
                                  （无效/不存在 404），返回 {case_name, questions}，
                                  供他人仅答 MBTI、不建 case 不触其它模块。
  - POST /api/mbti/share/{token}/score
                                  免登录：body {answers}：判型（ValueError→400）
                                  后作为一条历史记录存入该档案（user_id=档案主人，
                                  不回写 case.mbti_type），写 mbti_score 埋点
                                  （props={type, case_id, source:"share"}），
                                  返回 {id, type, scores}。

数据路径：mbti.py 位于 backend/app/api/，parents[1] = backend/app，
故数据目录为 Path(__file__).resolve().parents[1] / "mbti" / "data"。
"""
import json
import logging
import secrets
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
from app.models import Case, MbtiResult, MbtiShareLink

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


def _get_share_link(db: Session, token: str) -> MbtiShareLink:
    """按 token 取分享链接（免登录入口），无效/不存在抛 404"""
    row = db.query(MbtiShareLink).filter_by(token=token).first()
    if row is None:
        raise _err(404, "分享链接不存在或已失效")
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


class ShareRequest(BaseModel):
    case_id: int = Field(description="要生成免登录分享链接的国学档案 id（须为本人档案）")


class ShareScoreRequest(BaseModel):
    answers: List[Dict[str, Any]] = Field(
        description="逐题答案（同 POST /api/mbti/score 的 answers 契约）",
    )


# --- 路由 ---
@router.get("/mbti/questions")
def get_mbti_questions():
    """题库（公开，无需鉴权）：返回 60 题标准版，每题为二选一并带维度 pole。"""
    return {"code": 0, "message": "ok", "data": {"questions": load_questions()}}


@router.get("/mbti/types/{type_code}")
def get_mbti_type_info(type_code: str):
    """16 型详解文案（公开，无需鉴权）：type_code 大小写不敏感（转大写匹配
    load_types() 的 key），命中返回该型 type_info；非法类型 400。
    纯只读 + 进程内缓存，零落库、零 LLM、零扣费（BUG-005：供前端
    result.mode='manual' 直接输入类型时展示对应详解文案）。"""
    upper_type = type_code.strip().upper()
    types_map = load_types()
    if upper_type not in types_map:
        raise _err(400, "未知 MBTI 类型: " + type_code)
    return {"code": 0, "message": "ok",
            "data": {"type": upper_type, "type_info": types_map.get(upper_type)}}


@router.post("/mbti/score")
def score_mbti(
    body: ScoreRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """判型（纯代码，免费，落库）：校验 case 归属 → scoring.score →
    落 mbti_results 表（带 case_id）+ 回写 case.mbti_type + mbti_score 埋点。

    零 LLM 零扣费：判型为本地计数，无 chat 调用、无余额扣减。
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


# --- REQ-047：免登录分享 + 历史记录 ---
@router.post("/mbti/share")
def create_mbti_share_link(
    body: ShareRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """为该档案生成免登录分享链接（鉴权，须为本人档案）：他人打开链接仅答
    MBTI 判型（免登录，见 GET /mbti/share/{token}）。幂等：同一 case 已有
    MbtiShareLink 则复用其 token，不重复建行。返回相对路径 url（前端拼域名）。"""
    user_id = get_user_id_from_token(authorization)

    # ① case 归属校验（id+user_id 隔离，非本人/不存在 → 404）
    case = db.query(Case).filter_by(id=body.case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")

    # ② 幂等：该 case 已有分享链接则复用
    link = db.query(MbtiShareLink).filter_by(case_id=case.id).first()
    if link is None:
        link = MbtiShareLink(case_id=case.id, token=secrets.token_urlsafe(16))
        db.add(link)
        db.commit()
        db.refresh(link)

    return {"code": 0, "message": "ok", "data": {
        "token": link.token,
        "url": "/mbti/share/" + link.token,
    }}


@router.get("/mbti/share/{token}")
def get_mbti_share_landing(
    token: str,
    db: Session = Depends(get_analytics_db),
):
    """免登录分享落地页数据（REQ-047①）：按 token 取绑定档案（无效/不存在 404），
    返回 case_name（供“为 TA 填写”展示）+ 公开题库。仅答 MBTI，不建 case、
    不触其它模块；纯只读零落库零扣费。"""
    link = _get_share_link(db, token)
    case = db.query(Case).filter_by(id=link.case_id).first()
    if case is None:
        raise _err(404, "分享链接不存在或已失效")

    return {"code": 0, "message": "ok", "data": {
        "case_name": case.name,
        "questions": load_questions(),
    }}


@router.post("/mbti/share/{token}/score")
def score_mbti_via_share(
    token: str,
    body: ShareScoreRequest,
    db: Session = Depends(get_analytics_db),
):
    """免登录判型（REQ-047②）：按 token 找档案 → scoring.score（ValueError→400）
    → 作为一条历史记录存入该档案（user_id=档案主人 case.user_id，**不回写**
    case.mbti_type，填写人可能是他人，不覆盖主人结果）→ mbti_score 埋点
    （props={type, case_id, source:"share"}）。零 LLM 零扣费。"""
    link = _get_share_link(db, token)
    case = db.query(Case).filter_by(id=link.case_id).first()
    if case is None:
        raise _err(404, "分享链接不存在或已失效")

    # 判型（纯代码）：非法答案 → 400
    try:
        result = scoring.score(body.answers)
    except ValueError as exc:
        raise _err(400, str(exc))

    # 落库为一条历史记录（user_id 记档案主人，不覆盖 case.mbti_type）
    row = MbtiResult(
        user_id=case.user_id,
        case_id=case.id,
        answers_json=body.answers,
        scores_json=result["scores"],
        type=result["type"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # 埋点（写库失败静默）；source=share 区分免登录入口
    record_event("mbti_score", user_id=case.user_id,
                 props={"type": row.type, "case_id": case.id, "source": "share"})

    return {"code": 0, "message": "ok",
            "data": {"id": row.id, "type": row.type, "scores": row.scores_json}}


@router.get("/mbti/results")
def list_mbti_results_by_case(
    case_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """按档案列出该档案全部 MBTI 结果（鉴权，case_id+user_id 隔离；id 倒序）。
    每项 {id, type, scores, created_at}，不含 answers_json 全量（控制体积）。
    REQ-047②“档案内回看各次记录”用；与路径版 GET /mbti/results/{result_id}
    并存（前者带 ?case_id= 查询参数、后者为路径参数，路由不冲突）。"""
    user_id = get_user_id_from_token(authorization)

    # case 归属校验（非本人/不存在 → 404，口径与 POST /score 一致）
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "档案不存在")

    rows = (db.query(MbtiResult)
            .filter_by(case_id=case_id, user_id=user_id)
            .order_by(MbtiResult.id.desc())
            .all())
    items = [{
        "id": row.id,
        "type": row.type,
        "scores": row.scores_json,
        "created_at": row.created_at,
    } for row in rows]
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}


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


@router.delete("/mbti/results/{result_id}")
def delete_mbti_result(
    result_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """删除单条 MBTI 历史记录（REQ-054）：id+user_id 隔离（复用
    _get_owned_result），不存在 404；删除前二次确认由前端负责，后端仅删除
    该行并 commit。

    注意：即使删除的是档案当前 mbti_type 对应的结果，也**不回写**
    case.mbti_type（仅删历史记录行，档案类型保留）——REQ-054 未明确联动
    清档，保守起见避免误清档案当前类型。零 LLM 零扣费；不写埋点。"""
    user_id = get_user_id_from_token(authorization)
    row = _get_owned_result(db, result_id, user_id)

    db.delete(row)
    db.commit()

    return {"code": 0, "message": "ok",
            "data": {"deleted": True, "id": result_id}}
