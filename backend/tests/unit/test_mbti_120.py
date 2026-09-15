# -*- coding: utf-8 -*-
"""IPIP-NEO-120 官方普通话译本题库（120 题版）契约测试。

覆盖分层：
  1. 120 题库自洽：questions-120.json 恰 120 条、id=1..120 连续无重无缺、
     dim 只在 N/E/O/A/C 且五维各 24 题、30 层面各 4 题、reverse 全 bool、
     题干非空、scale 五档文案与 300 版一致、meta 声明 120 题。
  2. 3 条 O6 裁定项：中文页 28/58/88 → dim/facet=O6，reverse 与计分键页
     69/70/71 的 keying 一致（28/58 正向、88 反向）。
  3. scoring.score(version="120") 判型（纯函数）：
     - 全高（正向5/反向1）→ ENFJ、全低（正向1/反向5）→ ISTP（口径与 300 版一致）；
     - 按维定向构造：目标维高、其余维低 → 四字母方向正确（N 不参与映射）；
     - 非法 version → ValueError("未知题库版本")；
     - 维度不全 → ValueError。
  4. 300 版默认路径零回归：load_questions()/score() 不带 version 仍是 300 版。
  5. 端点契约（TestClient，真实 FastAPI app + 临时库）：
     - GET /api/mbti/questions?version=120 → 120 题；?version=999 → 400；缺省 → 300 题；
     - POST /api/mbti/score 带 version=120 → ENFJ 落库（mbti_results）；
     - GET /api/mbti/share/{token}?version=120 → 120 题；
     - POST /api/mbti/share/{token}/score 带 version=120 → 落库判型。

本文件没有任何 LLM / Node 依赖。依赖 conftest 的会话级临时库（orchestration_env）。
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]

# 大五五维
BIG5_DIMS = ("N", "E", "O", "A", "C")
# 5 点李克特 scale（与 300 版 questions.json 一致）
SCALE = ["非常不准确", "不太不准确", "适中", "比较准确", "非常准确"]

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _q120() -> list[dict]:
    from app.mbti.scoring import load_questions

    return load_questions("120")


def _extreme_answers(high: bool, version: str = "120") -> list[dict]:
    """构造全高/全低答卷：正向题按 high 取 5/1，反向题按 high 取 1/5。

    high=True  → 所有题有效分=5（维度分=100）→ ENFJ
    high=False → 所有题有效分=1（维度分=0）→ ISTP
    """
    from app.mbti.scoring import load_questions

    out = []
    for q in load_questions(version):
        if high:
            value = 1 if q.get("reverse") else 5
        else:
            value = 5 if q.get("reverse") else 1
        out.append({"question_id": q["id"], "value": value})
    return out


def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"mbti120_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int, name: str = "测试档案") -> int:
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, name=name, input_json={"question": "事业运势"})
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _result_row(result_id: int):
    from app.database import AnalyticsSession
    from app.models import MbtiResult

    session = AnalyticsSession()
    try:
        return session.query(MbtiResult).filter_by(id=result_id).first()
    finally:
        session.close()


@pytest.fixture(scope="module")
def mbti120_client(orchestration_env):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 数据自洽 ----
def test_questions_120_structure():
    """questions-120.json：120 条、id 1..120 连续无重无缺、五维各 24、30 层面各 4。"""
    questions = _q120()
    assert len(questions) == 120

    ids = [q["id"] for q in questions]
    assert ids == list(range(1, 121)), "id 应为 1..120 连续"
    assert len(set(ids)) == 120, "id 无重复"

    per_dim = {d: 0 for d in BIG5_DIMS}
    per_facet = {}
    for q in questions:
        assert q["dim"] in BIG5_DIMS, f"题目 {q['id']} 维度非法: {q['dim']}"
        per_dim[q["dim"]] += 1
        facet = q["facet"]
        assert facet and facet[0] == q["dim"], f"题目 {q['id']} 层面非法: {facet}"
        per_facet[facet] = per_facet.get(facet, 0) + 1
        assert q["text"] and q["text"].strip(), f"题目 {q['id']} 题干为空"
        assert isinstance(q.get("reverse"), bool), f"题目 {q['id']} reverse 应为 bool"

    assert per_dim == {"N": 24, "E": 24, "O": 24, "A": 24, "C": 24}, per_dim
    assert len(per_facet) == 30, f"应有 30 个层面，实际 {len(per_facet)}"
    assert all(v == 4 for v in per_facet.values()), "每层面应 4 题"


def test_questions_120_scale_meta_and_ruling():
    """顶层 scale 与 300 版一致 + meta 声明；3 条 O6 裁定项 reverse 与计分键 keying 一致。"""
    raw = json.loads((BACKEND_DIR / "app" / "mbti" / "data" / "questions-120.json")
                     .read_text(encoding="utf-8"))
    assert raw.get("scale") == SCALE
    meta = raw.get("meta") or {}
    assert meta.get("instrument") == "ipip-neo-120-zh"
    assert meta.get("item_count") == 120

    questions = {q["id"]: q for q in _q120()}
    # 中文页 28/58/88 → Johnson 计分键页 69/70/71（README §6.3，全部 O6）
    ruling = {28: "+", 58: "+", 88: "-"}
    for zh_no, keying in ruling.items():
        q = questions[zh_no]
        assert q["dim"] == "O" and q["facet"] == "O6", f"题目 {zh_no} 应为 O6: {q}"
        assert q["reverse"] == (keying == "-"), f"题目 {zh_no} reverse 与 keying 不符"
    # O6 层面恰 4 题（1 条文本匹配 + 3 条裁定）
    assert sum(1 for q in questions.values() if q["facet"] == "O6") == 4


# ------------------------------------------------------------ scoring 判型 ----
def test_scoring_120_all_high_is_enfj():
    """全高（正向5/反向1）→ ENFJ，五维归一分均为 100，无边界。"""
    from app.mbti.scoring import score

    result = score(_extreme_answers(high=True, version="120"), version="120")
    assert result["mapped_type"] == "ENFJ"
    assert result["boundaries"] == []
    for dim in BIG5_DIMS:
        assert result["scores"][dim] == pytest.approx(100.0, abs=0.01)


def test_scoring_120_all_low_is_istp():
    """全低（正向1/反向5）→ ISTP，五维归一分均为 0，无边界。"""
    from app.mbti.scoring import score

    result = score(_extreme_answers(high=False, version="120"), version="120")
    assert result["mapped_type"] == "ISTP"
    assert result["boundaries"] == []
    for dim in BIG5_DIMS:
        assert result["scores"][dim] == pytest.approx(0.0, abs=0.01)


def test_scoring_120_dimension_direction():
    """按维定向构造：目标维高、其余维低 → 四字母方向正确（N 不参与映射）。"""
    from app.mbti.scoring import score

    answers = []
    for q in _q120():
        if q["dim"] == "E":
            value = 1 if q["reverse"] else 5  # E 维全高
        else:
            value = 5 if q["reverse"] else 1  # 其余维全低
        answers.append({"question_id": q["id"], "value": value})

    result = score(answers, version="120")
    assert result["mapped_type"].startswith("E"), result
    assert result["scores"]["E"] == pytest.approx(100.0, abs=0.01)
    for dim in ("O", "A", "C"):
        assert result["scores"][dim] == pytest.approx(0.0, abs=0.01)


def test_scoring_120_invalid_version():
    """非法 version → ValueError("未知题库版本")。"""
    from app.mbti.scoring import load_questions, score

    with pytest.raises(ValueError) as ei:
        load_questions("999")
    assert "未知题库版本" in str(ei.value)
    with pytest.raises(ValueError) as ei2:
        score([{"question_id": 1, "value": 3}], version="abc")
    assert "未知题库版本" in str(ei2.value)


def test_scoring_120_incomplete_dims():
    """维度不全（只答 E 维一题）→ ValueError。"""
    from app.mbti.scoring import score

    e_q = next(q for q in _q120() if q["dim"] == "E")
    with pytest.raises(ValueError) as ei:
        score([{"question_id": e_q["id"], "value": 3}], version="120")
    assert "未覆盖全部维度" in str(ei.value)


# ------------------------------------------------------------ 300 版零回归 ----
def test_300_default_path_unchanged():
    """默认路径零回归：load_questions()/score() 不带 version 仍是 300 版（ENFJ）。"""
    from app.mbti.scoring import load_questions, score

    assert len(load_questions()) == 300
    assert len(load_questions("300")) == 300

    answers = []
    for q in load_questions("300"):
        answers.append({"question_id": q["id"], "value": 1 if q.get("reverse") else 5})
    assert score(answers)["mapped_type"] == "ENFJ"
    assert score(answers, version="300")["mapped_type"] == "ENFJ"


# ------------------------------------------------------------ 端点 ----
def test_api_questions_version_param(mbti120_client):
    """GET /api/mbti/questions：?version=120 → 120 题；缺省 → 300 题；非法 → 400。"""
    resp = mbti120_client.get("/api/mbti/questions?version=120")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["scale"] == SCALE
    assert len(data["questions"]) == 120

    resp = mbti120_client.get("/api/mbti/questions")
    assert resp.status_code == 200
    assert len(resp.json()["data"]["questions"]) == 300  # 默认仍 300（零回归）

    resp = mbti120_client.get("/api/mbti/questions?version=999")
    assert resp.status_code == 400
    assert "未知题库版本" in resp.json()["message"]


def test_api_score_120_persists(mbti120_client):
    """POST /api/mbti/score 带 version=120：全高 → ENFJ；落库 mbti_results（120 条答案）。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _extreme_answers(high=True, version="120")
    resp = mbti120_client.post("/api/mbti/score",
                               json={"case_id": cid, "answers": answers, "version": "120"},
                               headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "ENFJ"
    assert data["boundaries"] == []
    for dim in BIG5_DIMS:
        assert data["scores"][dim] == pytest.approx(100.0, abs=0.01)

    row = _result_row(data["id"])
    assert row is not None
    assert row.case_id == cid
    assert row.type == "ENFJ"
    assert len(row.answers_json) == 120


def test_api_score_120_bad_version_400(mbti120_client):
    """POST /api/mbti/score 带非法 version → 400。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _extreme_answers(high=True, version="120")
    resp = mbti120_client.post("/api/mbti/score",
                               json={"case_id": cid, "answers": answers, "version": "999"},
                               headers=_auth_header(uid))
    assert resp.status_code == 400
    assert "未知题库版本" in resp.json()["message"]


def test_api_share_120_landing_and_score(mbti120_client):
    """分享链路：GET /share/{token}?version=120 → 120 题；POST /share/{token}/score
    带 version=120 → 全低 ISTP 落库；非法 version → 400。"""
    uid = _new_user()
    cid = _new_case(uid, name="张三的档案")
    token = mbti120_client.post("/api/mbti/share", json={"case_id": cid},
                                headers=_auth_header(uid)).json()["data"]["token"]

    resp = mbti120_client.get(f"/api/mbti/share/{token}?version=120")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["case_name"] == "张三的档案"
    assert data["scale"] == SCALE
    assert len(data["questions"]) == 120

    resp = mbti120_client.get(f"/api/mbti/share/{token}?version=999")
    assert resp.status_code == 400
    assert "未知题库版本" in resp.json()["message"]

    resp = mbti120_client.post(f"/api/mbti/share/{token}/score",
                               json={"answers": _extreme_answers(high=False, version="120"),
                                     "version": "120"})
    assert resp.status_code == 200, resp.text
    d = resp.json()["data"]
    assert d["type"] == "ISTP"
    row = _result_row(d["id"])
    assert row is not None and row.type == "ISTP"
