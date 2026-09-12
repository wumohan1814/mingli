# -*- coding: utf-8 -*-
"""大五人格（IPIP-NEO-300）契约测试（节123 · /mbti，纯代码，零 LLM 零扣费）。

覆盖分层：
  1. 数据自洽：questions.json 300 题、五维 N/E/O/A/C 各 60、30 层面各 10、
     每题 {id,dim,facet,text,reverse}、题干非空、scale 五档文案齐全；
     types.json 16 型、五栏文案字段齐全非空。
  2. scoring.score 判型（纯函数）：
     - 全高（正向5/反向1）→ ENFJ、全低（正向1/反向5）→ ISTP（节122 §4.4 必做双验）；
     - 反向题翻转正确；
     - 非法输入（空/缺 id/题目不存在/value 越界/重复作答/维度不完整）→ ValueError。
  3. Python 端点契约（TestClient，真实 FastAPI app + 临时库）：
     - GET /api/mbti/questions：公开免鉴权，返回 scale + 300 题；
     - POST /api/mbti/score：body {case_id, answers}（value 1–5），
       落库 mbti_results + 回写 case.mbti_type + mbti_score 埋点，
       返回 {id, type, scores(OCEAN), boundaries} + 零扣费；
     - GET /api/mbti/results/{id}：返回含 boundaries（从 scores 重算）。

本文件没有任何 LLM / Node 依赖。依赖 conftest 的会话级临时库（orchestration_env）。
"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]

# 大五五维
BIG5_DIMS = ("N", "E", "O", "A", "C")
# 5 点李克特 scale
SCALE = ["非常不准确", "不太不准确", "适中", "比较准确", "非常准确"]
# 16 型全量（与 types.json 键集核对）
ALL_TYPES = {
    "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
}
# 每型文案字段
TYPE_FIELDS = ("alias", "strengths", "blindspots", "career", "relationships", "growth")

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _questions() -> list[dict]:
    from app.mbti.scoring import load_questions

    return load_questions()


def _types() -> dict:
    from app.api.mbti import load_types

    return load_types()


def _extreme_answers(high: bool) -> list[dict]:
    """构造全高/全低答卷：正向题按 high 取 5/1，反向题按 high 取 1/5。

    high=True  → 所有题有效分=5（维度分=100）→ ENFJ
    high=False → 所有题有效分=1（维度分=0）→ ISTP
    """
    out = []
    for q in _questions():
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
        user = User(username=f"mbti_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int, **overrides) -> int:
    from app.database import AnalyticsSession
    from app.models import Case

    inp = {"question": "事业运势"}
    inp.update(overrides)
    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, input_json=inp)
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _case_row(case_id: int):
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        return session.query(Case).filter_by(id=case_id).first()
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


def _new_case_named(uid: int, name: str = "测试档案") -> int:
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


def _share_link_rows(case_id: int):
    from app.database import AnalyticsSession
    from app.models import MbtiShareLink

    session = AnalyticsSession()
    try:
        return session.query(MbtiShareLink).filter_by(case_id=case_id).all()
    finally:
        session.close()


def _event_rows(event_name: str, user_id: int):
    from app.database import OpsSession
    from app.models.ops import Event

    session = OpsSession()
    try:
        return session.query(Event).filter_by(event_name=event_name, user_id=user_id).all()
    finally:
        session.close()


def _credit_rows(user_id: int):
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return session.query(CreditTransaction).filter_by(user_id=user_id).all()
    finally:
        session.close()


@pytest.fixture(scope="module")
def mbti_client(orchestration_env):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 数据自洽 ----
def test_questions_json_structure():
    """questions.json：300 题、五维各 60、30 层面各 10、每题含 id/dim/facet/text/reverse。"""
    questions = _questions()
    assert len(questions) == 300

    ids = [q["id"] for q in questions]
    assert len(set(ids)) == 300, "题目 id 唯一"

    texts = []
    per_dim = {d: 0 for d in BIG5_DIMS}
    per_facet = {}
    for q in questions:
        assert q["dim"] in BIG5_DIMS, f"题目 {q['id']} 维度非法: {q['dim']}"
        per_dim[q["dim"]] += 1
        facet = q["facet"]
        assert facet and facet[0] in BIG5_DIMS, f"题目 {q['id']} 层面非法: {facet}"
        per_facet[facet] = per_facet.get(facet, 0) + 1
        assert q["text"] and q["text"].strip()
        assert isinstance(q.get("reverse"), bool), f"题目 {q['id']} reverse 应为 bool"
        texts.append(q["text"])

    assert per_dim == {"N": 60, "E": 60, "O": 60, "A": 60, "C": 60}, per_dim
    assert len(per_facet) == 30, f"应有 30 个层面，实际 {len(per_facet)}"
    assert all(v == 10 for v in per_facet.values()), "每层面应 10 题"
    assert len(texts) == len(set(texts)), "题干不应重复"


def test_scale_field_present():
    """题库文件顶层 scale 为 5 档李克特文案。"""
    import json
    raw = json.loads((BACKEND_DIR / "app" / "mbti" / "data" / "questions.json").read_text(encoding="utf-8"))
    assert raw.get("scale") == SCALE


def test_types_json_structure():
    """types.json：16 型键齐全，每型含 alias + 五栏文案且非空。"""
    types_map = _types()
    assert set(types_map.keys()) == ALL_TYPES
    for code, entry in types_map.items():
        assert isinstance(entry, dict)
        missing = [f for f in TYPE_FIELDS if not entry.get(f) or not str(entry.get(f)).strip()]
        assert not missing, f"{code} 缺少文案字段: {missing}"


# ------------------------------------------------------------ scoring 判型 ----
def test_scoring_all_high_is_enfj():
    """全高（正向5/反向1）→ ENFJ，五维归一分均为 100，无边界。"""
    from app.mbti.scoring import score

    result = score(_extreme_answers(high=True))
    assert result["mapped_type"] == "ENFJ"
    assert result["boundaries"] == []
    for dim in BIG5_DIMS:
        assert result["scores"][dim] == pytest.approx(100.0, abs=0.01)


def test_scoring_all_low_is_istp():
    """全低（正向1/反向5）→ ISTP，五维归一分均为 0，无边界。"""
    from app.mbti.scoring import score

    result = score(_extreme_answers(high=False))
    assert result["mapped_type"] == "ISTP"
    assert result["boundaries"] == []
    for dim in BIG5_DIMS:
        assert result["scores"][dim] == pytest.approx(0.0, abs=0.01)


def test_scoring_reverse_scoring_correct():
    """反向题：reverse=True 时 value=1 有效分=5，value=5 有效分=1。

    取一道反向题，单独验证其贡献方向。
    """
    from app.mbti.scoring import score

    questions = _questions()
    rev_q = next(q for q in questions if q.get("reverse"))
    fwd_q = next(q for q in questions if not q.get("reverse") and q["dim"] == rev_q["dim"])

    # 同维两题：反向题答1（有效分5）、正向题答5（有效分5）→ 该维有效分 10
    answers = [
        {"question_id": rev_q["id"], "value": 1},
        {"question_id": fwd_q["id"], "value": 5},
    ]
    # 需要覆盖全部五维才能通过校验，补全其他维度各一题
    for dim in BIG5_DIMS:
        if dim == rev_q["dim"]:
            continue
        q = next(q for q in questions if q["dim"] == dim)
        answers.append({"question_id": q["id"], "value": 3})

    result = score(answers)
    # 反向题 value=1 应计 5，与正向题 value=5 计 5 同方向
    # 该维共答 2 题，有效分 10/10 → 归一 (10-2)/8*100 = 100
    assert result["scores"][rev_q["dim"]] == pytest.approx(100.0, abs=0.01)


def test_scoring_invalid_inputs():
    """非法输入一律 ValueError：空 / 结构错 / 缺 id / 题目不存在 /
    value 越界 / 重复作答 / 维度不完整 / 非 list。"""
    from app.mbti.scoring import score

    questions = _questions()

    # 覆盖全部五维的合法基座（每维一题 value=3）
    def _full_basis():
        base = []
        for dim in BIG5_DIMS:
            q = next(q for q in questions if q["dim"] == dim)
            base.append({"question_id": q["id"], "value": 3})
        return base

    q1 = questions[0]
    cases = [
        [],                                              # 空
        [{"question_id": q1["id"], "value": 3}],         # 单维（维度不完整）
        [{"value": 3}],                                  # 缺 question_id/id
        [{"question_id": 9999, "value": 3}],             # 题目不存在
        [{"question_id": q1["id"], "value": 0}],         # value < 1
        [{"question_id": q1["id"], "value": 6}],         # value > 5
        [{"question_id": q1["id"], "value": "3"}],       # value 非 int
        [{"question_id": q1["id"], "value": 3},
         {"question_id": q1["id"], "value": 3}],          # 重复作答
        "not-a-list",                                    # 非 list
        [1, 2],                                          # 元素非对象
    ]
    for bad in cases:
        with pytest.raises(ValueError):
            score(bad)

    # 题目不存在叠加在完整基座上仍应报错
    with pytest.raises(ValueError):
        score(_full_basis() + [{"question_id": 9999, "value": 3}])


def test_scoring_accepts_id_alias():
    """question_id 与 id 两种 key 均支持。"""
    from app.mbti.scoring import score

    questions = _questions()
    answers = []
    for dim in BIG5_DIMS:
        q = next(q for q in questions if q["dim"] == dim)
        answers.append({"id": q["id"], "value": 3})
    result = score(answers)
    assert result["mapped_type"]  # 不抛异常即通过
    assert set(result["scores"].keys()) == set(BIG5_DIMS)


# ------------------------------------------------------------ 端点：题库 ----
def test_api_questions_public_and_shape(mbti_client):
    """GET /api/mbti/questions：无需鉴权；返回 scale + 300 题，结构正确。"""
    resp = mbti_client.get("/api/mbti/questions")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["scale"] == SCALE
    questions = data["questions"]
    assert isinstance(questions, list) and len(questions) == 300
    per_dim = {d: sum(1 for q in questions if q["dim"] == d) for d in BIG5_DIMS}
    assert per_dim == {"N": 60, "E": 60, "O": 60, "A": 60, "C": 60}

    first = questions[0]
    assert set(first.keys()) >= {"id", "dim", "facet", "text", "reverse"}
    assert questions == _questions()


# ------------------------------------------------------------ 端点：判型落库 ----
def test_api_score_success_persists_and_events(mbti_client):
    """POST /api/mbti/score：全高 → ENFJ；落库 mbti_results + 回写
    case.mbti_type + mbti_score 埋点；返回 {id, type, scores(OCEAN), boundaries}；零扣费。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _extreme_answers(high=True)
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert isinstance(data["id"], int) and data["id"] > 0
    assert data["type"] == "ENFJ"
    assert data["boundaries"] == []
    # scores 为 OCEAN 五维 0–100
    for dim in BIG5_DIMS:
        assert data["scores"][dim] == pytest.approx(100.0, abs=0.01)

    # 落库
    row = _result_row(data["id"])
    assert row is not None
    assert row.user_id == uid
    assert row.case_id == cid
    assert row.type == "ENFJ"
    assert row.answers_json == answers
    assert set(row.scores_json.keys()) == set(BIG5_DIMS)

    # 档案 mbti_type 回写
    case = _case_row(cid)
    assert case.mbti_type == "ENFJ"

    # 埋点 + 零扣费
    rows = _event_rows("mbti_score", uid)
    assert len(rows) == 1
    assert rows[0].props == {"type": "ENFJ", "case_id": cid}
    assert _credit_rows(uid) == []


def test_api_score_requires_auth(mbti_client):
    """鉴权契约：缺 Authorization → 400；非 Bearer/非法令牌 → 401。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _extreme_answers(high=True)
    body = {"case_id": cid, "answers": answers}
    resp = mbti_client.post("/api/mbti/score", json=body)
    assert resp.status_code == 400
    resp = mbti_client.post("/api/mbti/score", json=body,
                            headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    resp = mbti_client.post("/api/mbti/score", json=body,
                            headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_api_score_bad_answers_400(mbti_client):
    """答案非法 → 400：缺 answers / 空列表 / 单维 / value 越界；不落库不埋点。"""
    uid = _new_user()
    cid = _new_case(uid)
    auth = _auth_header(uid)

    # 缺 answers
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid}, headers=auth)
    assert resp.status_code == 400
    # 缺 case_id
    resp = mbti_client.post("/api/mbti/score", json={"answers": _extreme_answers(True)},
                            headers=auth)
    assert resp.status_code == 400
    # 空列表
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": []},
                            headers=auth)
    assert resp.status_code == 400
    # 单维作答
    q = _questions()[0]
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid,
                                  "answers": [{"question_id": q["id"], "value": 3}]},
                            headers=auth)
    assert resp.status_code == 400
    # value 越界
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid,
                                  "answers": [{"question_id": q["id"], "value": 9}]},
                            headers=auth)
    assert resp.status_code == 400

    assert _event_rows("mbti_score", uid) == []
    assert _credit_rows(uid) == []


def test_api_score_case_isolation_404(mbti_client):
    """归属 404：他人档案 / 不存在 → 404，不判型不落库不埋点。"""
    uid = _new_user()
    other = _new_user()
    other_cid = _new_case(other)
    answers = _extreme_answers(high=True)

    resp = mbti_client.post("/api/mbti/score", json={"case_id": other_cid, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 404
    resp = mbti_client.post("/api/mbti/score", json={"case_id": 999999, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 404

    assert _event_rows("mbti_score", uid) == []
    assert _credit_rows(uid) == []


# ------------------------------------------------------------ 端点：结果复看 ----
def test_api_results_get_with_boundaries(mbti_client):
    """GET /api/mbti/results/{id}：本人返回含 boundaries（从 scores 重算）。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _extreme_answers(high=True)
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": answers},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=_auth_header(uid))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == rid
    assert data["case_id"] == cid
    assert data["type"] == "ENFJ"
    assert data["boundaries"] == []
    assert set(data["scores"].keys()) == set(BIG5_DIMS)
    assert set(data["type_info"].keys()) >= set(TYPE_FIELDS)


def test_api_results_isolation_404(mbti_client):
    """隔离 404：跨用户 / 不存在 → 404；缺鉴权 → 400。"""
    uid = _new_user()
    cid = _new_case(uid)
    other = _new_user()
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid, "answers": _extreme_answers(True)},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=_auth_header(other))
    assert resp.status_code == 404
    resp = mbti_client.get("/api/mbti/results/999999", headers=_auth_header(uid))
    assert resp.status_code == 404
    resp = mbti_client.get(f"/api/mbti/results/{rid}")
    assert resp.status_code == 400


def test_api_result_delete(mbti_client):
    """DELETE /mbti/results/{id}：本人删除 → 行消失；跨用户 → 404；不回写 case.mbti_type。"""
    from app.database import AnalyticsSession
    from app.models import Case

    uid = _new_user()
    cid = _new_case(uid)
    other = _new_user()
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid, "answers": _extreme_answers(True)},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    r = mbti_client.delete(f"/api/mbti/results/{rid}", headers=_auth_header(other))
    assert r.status_code == 404
    r = mbti_client.delete(f"/api/mbti/results/{rid}", headers=_auth_header(uid))
    assert r.status_code == 200
    assert r.json()["data"] == {"deleted": True, "id": rid}
    r = mbti_client.delete(f"/api/mbti/results/{rid}", headers=_auth_header(uid))
    assert r.status_code == 404
    session = AnalyticsSession()
    try:
        case = session.query(Case).filter_by(id=cid).first()
        assert case.mbti_type == "ENFJ"
    finally:
        session.close()


# ------------------------------------------------------------ 端点：16 型公开查询 ----
def test_api_types_public_endpoint(mbti_client):
    """GET /api/mbti/types/{type}：公开免鉴权，大小写不敏感，非法类型 400。"""
    resp = mbti_client.get("/api/mbti/types/intj")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "INTJ"
    for f in TYPE_FIELDS:
        assert data["type_info"][f]

    for code in ("ENFP", "ISTJ", "ESFJ"):
        resp = mbti_client.get(f"/api/mbti/types/{code.lower()}")
        assert resp.status_code == 200 and resp.json()["data"]["type"] == code

    resp = mbti_client.get("/api/mbti/types/XXXX")
    assert resp.status_code == 400
    assert "未知 MBTI 类型" in resp.json()["message"]


# ------------------------------------------------------------ 端点：分享链接（REQ-047） ----
def test_api_share_create_idempotent(mbti_client):
    """POST /api/mbti/share：本人档案 → {token, url}；重复调用幂等复用。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)

    resp1 = mbti_client.post("/api/mbti/share", json={"case_id": cid}, headers=auth)
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    assert data1["token"] and len(data1["token"]) > 0
    assert data1["url"] == "/mbti/share/" + data1["token"]

    resp2 = mbti_client.post("/api/mbti/share", json={"case_id": cid}, headers=auth)
    assert resp2.status_code == 200
    assert resp2.json()["data"]["token"] == data1["token"]

    links = _share_link_rows(cid)
    assert len(links) == 1


def test_api_share_landing_public(mbti_client):
    """GET /api/mbti/share/{token}：免登录返回 {case_name, scale, questions(300)}。"""
    uid = _new_user()
    cid = _new_case_named(uid, name="张三的档案")
    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=_auth_header(uid)).json()["data"]["token"]

    resp = mbti_client.get(f"/api/mbti/share/{token}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["case_name"] == "张三的档案"
    assert data["scale"] == SCALE
    assert len(data["questions"]) == 300

    resp = mbti_client.get("/api/mbti/share/not-a-real-token")
    assert resp.status_code == 404


def test_api_share_score_no_writeback(mbti_client):
    """免登录判型：主人先判型回写档案类型，他人经分享填写 → 存历史记录但不回写档案。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)

    owner = mbti_client.post("/api/mbti/score",
                             json={"case_id": cid, "answers": _extreme_answers(True)},
                             headers=auth)
    assert owner.json()["data"]["type"] == "ENFJ"
    assert _case_row(cid).mbti_type == "ENFJ"

    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=auth).json()["data"]["token"]

    resp1 = mbti_client.post(f"/api/mbti/share/{token}/score",
                             json={"answers": _extreme_answers(False)})
    assert resp1.status_code == 200
    d1 = resp1.json()["data"]
    assert d1["type"] == "ISTP"

    row1 = _result_row(d1["id"])
    assert row1.user_id == uid
    assert row1.type == "ISTP"
    assert _case_row(cid).mbti_type == "ENFJ"  # 不回写

    events = _event_rows("mbti_score", uid)
    assert len(events) == 2
    share_events = [e for e in events if (e.props or {}).get("source") == "share"]
    assert len(share_events) == 1


def test_api_results_list_by_case(mbti_client):
    """GET /api/mbti/results?case_id=：本人列出该档案全部记录（id 倒序），含 boundaries。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)

    mbti_client.post("/api/mbti/score",
                     json={"case_id": cid, "answers": _extreme_answers(True)},
                     headers=auth)
    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=auth).json()["data"]["token"]
    mbti_client.post(f"/api/mbti/share/{token}/score",
                     json={"answers": _extreme_answers(False)})

    resp = mbti_client.get(f"/api/mbti/results?case_id={cid}", headers=auth)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    items = data["items"]
    assert items[0]["type"] == "ISTP"
    assert items[1]["type"] == "ENFJ"
    for it in items:
        assert "boundaries" in it
        assert set(it["scores"].keys()) == set(BIG5_DIMS)
