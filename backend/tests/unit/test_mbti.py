# -*- coding: utf-8 -*-
"""MBTI 人格测试契约测试（横向扩展 Phase D2 · /mbti，纯代码，零 LLM 零扣费）。

覆盖分层：
  1. 数据自洽：questions.json 60 题、四维各 15、选项 pole 与维度一致、题干去重；
     types.json 16 型、五栏文案字段齐全非空。
  2. scoring.score 判型（纯函数，直接 import 单测）：
     - 全 A → ESTJ、全 B → INFP（A/B 选项 key → pole 映射正确）；
     - pole 形态（{"id","pole"}）按端字母计数（INTJ 示例）；
     - 平票默认倾向 E/S/T/J；
     - 非法输入（空/缺 id/题目不存在/选项无效/pole 越维/重复作答/单维作答）→ ValueError。
  3. Python 端点契约（TestClient，真实 FastAPI app + 临时库）：
     - GET /api/mbti/questions：公开免鉴权，60 题、四维各 15；
     - POST /api/mbti/score：body {case_id, answers}（case_id 必填，须为本人档案）；
       落库 mbti_results（带 case_id）+ 回写 case.mbti_type + mbti_score 埋点
       （props 含 case_id）+ 返回 {id, type, scores} + 零扣费；
       非本人/不存在的档案 → 404；答案缺失/空/维度不全/题目非法 → 400；
     - GET /api/mbti/results/{id}：本人可取（type_info 五栏，含 case_id 字段），
       跨用户/不存在 → 404。

本文件没有任何 LLM / Node 依赖：MBTI 判型在 Python 内完成，零扣费。
依赖 conftest 的会话级临时库（orchestration_env），不触碰真实 backend/data/*.db。
"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]

# 16 型全量（与 types.json 键集核对）
ALL_TYPES = {
    "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
}
# 每型文案字段（alias + 五栏）
TYPE_FIELDS = ("alias", "strengths", "blindspots", "career", "relationships", "growth")
# 维度 → 两端字母
DIM_POLES = {"EI": ("E", "I"), "SN": ("S", "N"), "TF": ("T", "F"), "JP": ("J", "P")}
# 平票默认倾向（与 scoring.TIE_DEFAULTS 一致，测试锁契约）
TIE_DEFAULTS = {"EI": "E", "SN": "S", "TF": "T", "JP": "J"}

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _questions() -> list[dict]:
    from app.mbti.scoring import load_questions

    return load_questions()


def _types() -> dict:
    from app.api.mbti import load_types

    return load_types()


def _answers_by_key(key: str) -> list[dict]:
    """60 题全选同一选项 key（choice 形态）。"""
    return [{"question_id": q["id"], "choice": key} for q in _questions()]


def _answers_by_pole(pole_map: dict) -> list[dict]:
    """pole 形态：pole_map = {dim: 目标端字母}，该维全部题目选该端。"""
    out = []
    for q in _questions():
        dim = q["dim"]
        if dim in pole_map:
            out.append({"id": q["id"], "pole": pole_map[dim]})
    return out


def _first_two(dim: str) -> tuple[dict, dict]:
    """某维前两题（供 1:1 平票/映射用例）。"""
    qs = [q for q in _questions() if q["dim"] == dim]
    return qs[0], qs[1]


def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    """临时 analytics 库建真实 user（mbti_results.user_id 有外键约束）。"""
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
    """直插一个 case（绕过 API）：MBTI 判型只依赖 case 存在且归属本人。"""
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
    """按 id 取 case 行（校验 mbti_type 回写）。"""
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
    """直插一个带 name 的 case（REQ-047 分享落地页展示 case_name 用）。"""
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
    """真实 FastAPI app 的 TestClient（lifespan 建表；MBTI 端点不依赖 Node/LLM）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 数据自洽 ----
def test_questions_json_structure():
    """questions.json：60 题、id 唯一连续、四维各 15、每题二选一带合法 pole。"""
    questions = _questions()
    assert len(questions) == 60
    ids = [q["id"] for q in questions]
    assert sorted(ids) == list(range(1, 61)), "题目 id 应为 1..60 无缺无重"

    texts = []
    per_dim = {d: 0 for d in DIM_POLES}
    for q in questions:
        assert q["dim"] in DIM_POLES, f"题目 {q['id']} 维度非法"
        per_dim[q["dim"]] += 1
        assert q["text"] and q["text"].strip()
        texts.append(q["text"])

        options = q["options"]
        assert isinstance(options, list) and len(options) == 2
        keys = [o["key"] for o in options]
        assert keys == ["A", "B"], f"题目 {q['id']} 选项 key 应为 A/B"
        poles = {o["pole"] for o in options}
        assert poles == set(DIM_POLES[q["dim"]]), (
            f"题目 {q['id']} 选项 pole {poles} 应覆盖维度 {q['dim']} 两端"
        )
        for o in options:
            assert o["text"] and o["text"].strip()

    assert per_dim == {"EI": 15, "SN": 15, "TF": 15, "JP": 15}, per_dim
    assert len(texts) == len(set(texts)), "题干不应重复"


def test_types_json_structure():
    """types.json：16 型键齐全，每型含 alias + 五栏文案且非空。"""
    types_map = _types()
    assert set(types_map.keys()) == ALL_TYPES
    for code, entry in types_map.items():
        assert isinstance(entry, dict)
        missing = [f for f in TYPE_FIELDS if not entry.get(f) or not str(entry.get(f)).strip()]
        assert not missing, f"{code} 缺少文案字段: {missing}"


# ------------------------------------------------------------ scoring 判型 ----
def test_scoring_all_a_is_estj():
    """全 A（每维全选 A = 偏 E/S/T/J 选项）→ ESTJ，分 = 每维 15:0。"""
    from app.mbti.scoring import score

    answers = _answers_by_key("A")
    assert len(answers) == 60
    result = score(answers)
    assert result["type"] == "ESTJ"
    assert result["scores"] == {
        "EI": {"E": 15, "I": 0},
        "SN": {"S": 15, "N": 0},
        "TF": {"T": 15, "F": 0},
        "JP": {"J": 15, "P": 0},
    }


def test_scoring_all_b_is_infp():
    """全 B（每维全选 B = 偏 I/N/F/P 选项）→ INFP，分 = 每维 0:15。"""
    from app.mbti.scoring import score

    result = score(_answers_by_key("B"))
    assert result["type"] == "INFP"
    assert result["scores"] == {
        "EI": {"E": 0, "I": 15},
        "SN": {"S": 0, "N": 15},
        "TF": {"T": 0, "F": 15},
        "JP": {"J": 0, "P": 15},
    }


def test_scoring_pole_form_and_type_lettering():
    """pole 形态按端字母计数：EI→I、SN→N、TF→T、JP→J → INTJ（选项 key 无关）。"""
    from app.mbti.scoring import score

    answers = _answers_by_pole({"EI": "I", "SN": "N", "TF": "T", "JP": "J"})
    result = score(answers)
    assert result["type"] == "INTJ"
    assert result["scores"] == {
        "EI": {"E": 0, "I": 15},
        "SN": {"S": 0, "N": 15},
        "TF": {"T": 15, "F": 0},
        "JP": {"J": 15, "P": 0},
    }


def test_scoring_tie_defaults_to_estj():
    """平票默认倾向：每维 1:1 平票（choice 形态取 1 A + 1 B）→ 默认 E/S/T/J → ESTJ。"""
    from app.mbti.scoring import score

    answers = []
    for dim in DIM_POLES:
        q1, q2 = _first_two(dim)
        answers.append({"question_id": q1["id"], "choice": "A"})   # 默认端 +1
        answers.append({"question_id": q2["id"], "choice": "B"})   # 另一端 +1
    result = score(answers)
    assert result["scores"] == {
        "EI": {"E": 1, "I": 1},
        "SN": {"S": 1, "N": 1},
        "TF": {"T": 1, "F": 1},
        "JP": {"J": 1, "P": 1},
    }
    # 平票逐维取默认倾向
    assert result["type"] == "".join(TIE_DEFAULTS[d] for d in DIM_POLES) == "ESTJ"


def test_scoring_mapping_question_dim_to_option_pole():
    """题型映射正确：choice 形态按题库选项 pole 落位（非按 key 序号）。"""
    from app.mbti.scoring import score

    # 对 EI 维：题1 选 A（应计 E），题2 选 B（应计 I）；其余维照做 → 各 1:1
    answers = []
    for dim in DIM_POLES:
        q1, q2 = _first_two(dim)
        answers.append({"question_id": q1["id"], "choice": "A"})
        answers.append({"question_id": q2["id"], "choice": "B"})
    # 显式核对每题选项 pole：A 恒为该维默认端、B 恒为另一端（题库约定，判型以此为锚）
    for q in _questions():
        by_key = {o["key"]: o["pole"] for o in q["options"]}
        assert by_key["A"] == TIE_DEFAULTS[q["dim"]], f"题目 {q['id']} A 应为默认端"
        other = DIM_POLES[q["dim"]][1]
        assert by_key["B"] == other, f"题目 {q['id']} B 应为 {other}"

    result = score(answers)
    assert result["scores"]["EI"] == {"E": 1, "I": 1}
    assert result["scores"]["SN"] == {"S": 1, "N": 1}


def test_scoring_invalid_inputs():
    """非法输入一律 ValueError：空 / 结构错 / 缺 id / 题目不存在 / 选项无效 /
    pole 越维 / 重复作答 / 单维作答（维度不完整）。"""
    from app.mbti.scoring import score

    q1 = _first_two("EI")[0]
    q_sn = _first_two("SN")[0]

    # 覆盖全部四维的合法基座（每题各一次），供叠加非法项用
    def _full_basis():
        base = []
        for dim in DIM_POLES:
            base.append({"question_id": _first_two(dim)[0]["id"], "choice": "A"})
        return base

    cases = [
        [],                                              # 空
        [{"question_id": q1["id"], "choice": "A"}],      # 单维（维度不完整）
        [{"choice": "A"}],                               # 缺 question_id/id
        [{"question_id": 9999, "choice": "A"}],          # 题目不存在
        [{"question_id": q1["id"], "choice": "Z"}],      # 选项 key 无效
        [{"id": q1["id"], "pole": "Z"}],                 # pole 不属于该题维度
        [{"id": q1["id"], "pole": "S"}],                 # pole 越维（S 不属于 EI）
        [{"question_id": q1["id"], "choice": "A"},
         {"question_id": q1["id"], "choice": "A"}],      # 重复作答
        "not-a-list",                                    # 非 list
        [1, 2],                                          # 元素非对象
    ]
    for bad in cases:
        with pytest.raises(ValueError):
            score(bad)

    # 题目不存在 / pole 越维叠加在完整基座上仍应报错（而非静默忽略）
    with pytest.raises(ValueError):
        score(_full_basis() + [{"question_id": 9999, "choice": "A"}])
    with pytest.raises(ValueError):
        score(_full_basis() + [{"id": q_sn["id"], "pole": "E"}])  # E 不属于 SN


# ------------------------------------------------------------ 端点：题库 ----
def test_api_questions_public_and_shape(mbti_client):
    """GET /api/mbti/questions：无需鉴权；60 题、四维各 15、结构与题库文件一致。"""
    resp = mbti_client.get("/api/mbti/questions")   # 无 Authorization
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    questions = body["data"]["questions"]
    assert isinstance(questions, list) and len(questions) == 60
    per_dim = {d: sum(1 for q in questions if q["dim"] == d) for d in DIM_POLES}
    assert per_dim == {"EI": 15, "SN": 15, "TF": 15, "JP": 15}

    first = questions[0]
    assert set(first.keys()) >= {"id", "dim", "text", "options"}
    assert len(first["options"]) == 2
    assert first["options"][0]["key"] == "A"
    assert first["options"][0]["pole"] in DIM_POLES[first["dim"]]
    # 与后端题库文件同源
    assert questions == _questions()


# ------------------------------------------------------------ 端点：判型落库 ----
def test_api_score_success_persists_and_events(mbti_client):
    """POST /api/mbti/score：全 A → ESTJ；落库 mbti_results（带 case_id）+ 回写
    case.mbti_type + mbti_score 埋点（props 含 case_id）；返回 {id,type,scores}；零扣费。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _answers_by_key("A")
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert isinstance(data["id"], int) and data["id"] > 0
    assert data["type"] == "ESTJ"
    assert data["scores"] == {
        "EI": {"E": 15, "I": 0},
        "SN": {"S": 15, "N": 0},
        "TF": {"T": 15, "F": 0},
        "JP": {"J": 15, "P": 0},
    }

    # 落库：answers_json 原样、scores_json/type/case_id 完整、user 归属正确
    row = _result_row(data["id"])
    assert row is not None
    assert row.user_id == uid
    assert row.case_id == cid
    assert row.type == "ESTJ"
    assert row.answers_json == answers
    assert row.scores_json == data["scores"]

    # 档案 mbti_type 被回写（与结果行同一次 commit）
    case = _case_row(cid)
    assert case is not None and case.mbti_type == "ESTJ"

    # 埋点 + 零扣费
    rows = _event_rows("mbti_score", uid)
    assert len(rows) == 1
    assert rows[0].props == {"type": "ESTJ", "case_id": cid}
    assert _credit_rows(uid) == []


def test_api_score_pole_form(mbti_client):
    """POST /score 支持 pole 形态答案：{"id","pole"} → INTJ 落库（带 case_id）。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _answers_by_pole({"EI": "I", "SN": "N", "TF": "T", "JP": "J"})
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "INTJ"
    assert _result_row(data["id"]).type == "INTJ"
    assert _case_row(cid).mbti_type == "INTJ"


def test_api_score_requires_auth(mbti_client):
    """鉴权契约：完全缺 Authorization → 400（Header 必填校验）；非 Bearer/非法令牌 → 401。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _answers_by_key("A")
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
    """答案非法 → 400：缺 answers / 空列表 / 单维作答 / 题目不存在；不落库不埋点。"""
    uid = _new_user()
    cid = _new_case(uid)
    auth = _auth_header(uid)

    # 缺 answers（pydantic 必填）→ 400 参数错误
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid}, headers=auth)
    assert resp.status_code == 400, resp.text
    # 缺 case_id（pydantic 必填）→ 400 参数错误
    resp = mbti_client.post("/api/mbti/score", json={"answers": _answers_by_key("A")},
                            headers=auth)
    assert resp.status_code == 400, resp.text
    # 空列表 → 400
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": []},
                            headers=auth)
    assert resp.status_code == 400, resp.text
    assert "答案" in resp.json()["message"] or "answers" in resp.json()["detail"]
    # 只答 EI 单维 → 400（维度不完整）
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid,
                                  "answers": [{"question_id": 1, "choice": "A"}]},
                            headers=auth)
    assert resp.status_code == 400, resp.text
    assert "维度" in resp.json()["message"]
    # 题目不存在 → 400
    resp = mbti_client.post("/api/mbti/score",
                            json={"case_id": cid,
                                  "answers": [{"question_id": 9999, "choice": "A"}]},
                            headers=auth)
    assert resp.status_code == 400, resp.text

    assert _event_rows("mbti_score", uid) == []
    assert _credit_rows(uid) == []


def test_api_score_case_isolation_404(mbti_client):
    """归属 404：case_id 为他人档案 / 不存在的档案 → 404，不判型不落库不埋点。"""
    uid = _new_user()
    other = _new_user()
    other_cid = _new_case(other)
    answers = _answers_by_key("A")

    # 他人档案 → 404（归属隔离在判型/落库之前）
    resp = mbti_client.post("/api/mbti/score", json={"case_id": other_cid, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 404, resp.text
    # 不存在 → 404
    resp = mbti_client.post("/api/mbti/score", json={"case_id": 999999, "answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 404, resp.text

    assert _event_rows("mbti_score", uid) == []
    assert _credit_rows(uid) == []


# ------------------------------------------------------------ 端点：结果复看 ----
def test_api_results_get_and_type_info(mbti_client):
    """GET /api/mbti/results/{id}：本人返回 {id,case_id,type,scores,type_info}，
    type_info 为该型五栏文案（与 types.json 同源）。"""
    uid = _new_user()
    cid = _new_case(uid)
    answers = _answers_by_key("B")   # INFP
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": answers},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["id"] == rid
    assert data["case_id"] == cid
    assert data["type"] == "INFP"
    assert data["scores"] == {
        "EI": {"E": 0, "I": 15},
        "SN": {"S": 0, "N": 15},
        "TF": {"T": 0, "F": 15},
        "JP": {"J": 0, "P": 15},
    }
    # type_info 五栏文案（alias + 优势/盲点/职场/关系/成长）
    assert set(data["type_info"].keys()) >= set(TYPE_FIELDS)
    assert data["type_info"]["alias"] == _types()["INFP"]["alias"]
    for f in TYPE_FIELDS:
        assert data["type_info"][f]


def test_api_results_isolation_404(mbti_client):
    """隔离 404：跨用户读他人结果 / 不存在的 id → 404。"""
    uid = _new_user()
    cid = _new_case(uid)
    other = _new_user()
    resp = mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": _answers_by_key("A")},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    # 跨用户 → 404
    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    # 不存在 → 404
    resp = mbti_client.get("/api/mbti/results/999999", headers=_auth_header(uid))
    assert resp.status_code == 404
    # 未带鉴权 → 400（Header 必填）
    resp = mbti_client.get(f"/api/mbti/results/{rid}")
    assert resp.status_code == 400


# ------------------------------------------------------------ 端点：分享链接生成（REQ-047①） ----
def test_api_share_create_idempotent(mbti_client):
    """POST /api/mbti/share：本人档案 → {token, url}；重复调用幂等复用同一 token，
    mbti_share_links 该 case 仅一行。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)

    resp1 = mbti_client.post("/api/mbti/share", json={"case_id": cid}, headers=auth)
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()["data"]
    assert data1["token"] and len(data1["token"]) > 0
    assert data1["url"] == "/mbti/share/" + data1["token"]

    resp2 = mbti_client.post("/api/mbti/share", json={"case_id": cid}, headers=auth)
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()["data"]
    assert data2["token"] == data1["token"], "同一 case 应幂等复用 token"
    assert data2["url"] == data1["url"]

    links = _share_link_rows(cid)
    assert len(links) == 1
    assert links[0].token == data1["token"]


def test_api_share_create_isolation_404_and_auth(mbti_client):
    """归属/鉴权：他人档案 / 不存在 → 404；缺 Authorization → 400。"""
    uid = _new_user()
    other = _new_user()
    other_cid = _new_case_named(other)

    resp = mbti_client.post("/api/mbti/share", json={"case_id": other_cid}, headers=_auth_header(uid))
    assert resp.status_code == 404, resp.text
    resp = mbti_client.post("/api/mbti/share", json={"case_id": 999999}, headers=_auth_header(uid))
    assert resp.status_code == 404, resp.text
    resp = mbti_client.post("/api/mbti/share", json={"case_id": other_cid})
    assert resp.status_code == 400, resp.text  # Header 必填
    assert _share_link_rows(other_cid) == []


# ------------------------------------------------------------ 端点：分享落地页 + 免登录判型（REQ-047） ----
def test_api_share_landing_public_and_404(mbti_client):
    """GET /api/mbti/share/{token}：免登录返回 {case_name, questions(60)}；
    无效 token → 404。"""
    uid = _new_user()
    cid = _new_case_named(uid, name="张三的档案")
    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=_auth_header(uid)).json()["data"]["token"]

    resp = mbti_client.get(f"/api/mbti/share/{token}")   # 无 Authorization
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["case_name"] == "张三的档案"
    assert data["questions"] == _questions() and len(data["questions"]) == 60

    resp = mbti_client.get("/api/mbti/share/not-a-real-token")
    assert resp.status_code == 404, resp.text


def test_api_share_score_no_writeback_and_history(mbti_client):
    """免登录判型核心契约：主人先判型（ESTJ，回写 case.mbti_type），他人经分享
    两次填写（INFP / INTJ）→ ①每次存为一条历史记录（user_id=档案主人）；
    ②**不回写** case.mbti_type（仍 ESTJ）；③埋点 props 带 source=share。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)

    # 主人先答全 A → ESTJ（写主人结果 + 回写档案类型）
    owner = mbti_client.post("/api/mbti/score",
                             json={"case_id": cid, "answers": _answers_by_key("A")},
                             headers=auth)
    assert owner.json()["data"]["type"] == "ESTJ"
    assert _case_row(cid).mbti_type == "ESTJ"

    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=auth).json()["data"]["token"]

    # 他人（免登录）答全 B → INFP：作为第二条记录，不回写档案类型
    resp1 = mbti_client.post(f"/api/mbti/share/{token}/score",
                             json={"answers": _answers_by_key("B")})
    assert resp1.status_code == 200, resp1.text
    d1 = resp1.json()["data"]
    assert d1["type"] == "INFP"
    assert isinstance(d1["id"], int) and d1["id"] > 0

    row1 = _result_row(d1["id"])
    assert row1.user_id == uid, "分享填写记录应归属档案主人"
    assert row1.case_id == cid
    assert row1.type == "INFP"
    assert row1.answers_json == _answers_by_key("B")
    assert _case_row(cid).mbti_type == "ESTJ", "他人填写不得覆盖档案主人类型"

    # 再次免登录填写（pole 形态 INTJ）→ 又新增一条记录（不覆盖既有记录）
    resp2 = mbti_client.post(f"/api/mbti/share/{token}/score",
                             json={"answers": _answers_by_pole({"EI": "I", "SN": "N",
                                                                "TF": "T", "JP": "J"})})
    assert resp2.status_code == 200, resp2.text
    d2 = resp2.json()["data"]
    assert d2["type"] == "INTJ"
    assert d2["id"] != d1["id"]
    assert _result_row(d2["id"]).type == "INTJ"
    assert _case_row(cid).mbti_type == "ESTJ"   # 仍未回写

    # 埋点：mbti_score × 3（主人 1 + 分享 2），分享的 props 带 source=share
    events = _event_rows("mbti_score", uid)
    assert len(events) == 3
    share_events = [e for e in events if (e.props or {}).get("source") == "share"]
    assert len(share_events) == 2
    assert all(e.props["case_id"] == cid for e in share_events)
    types_seen = {e.props["type"] for e in share_events}
    assert types_seen == {"INFP", "INTJ"}


def test_api_share_score_invalid_token_and_bad_answers(mbti_client):
    """分享判型错误分支：无效 token → 404；答案非法（空/维度不全）→ 400；
    均不落库不埋点。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=_auth_header(uid)).json()["data"]["token"]

    resp = mbti_client.post("/api/mbti/share/not-a-real-token/score",
                            json={"answers": _answers_by_key("A")})
    assert resp.status_code == 404, resp.text

    resp = mbti_client.post(f"/api/mbti/share/{token}/score", json={"answers": []})
    assert resp.status_code == 400, resp.text
    resp = mbti_client.post(f"/api/mbti/share/{token}/score",
                            json={"answers": [{"question_id": 1, "choice": "A"}]})
    assert resp.status_code == 400, resp.text

    assert _event_rows("mbti_score", uid) == []


# ------------------------------------------------------------ 端点：按 case 列出历史记录（REQ-047②） ----
def test_api_results_list_by_case(mbti_client):
    """GET /api/mbti/results?case_id=：本人列出该档案全部记录（id 倒序），
    每项 {id,type,scores,created_at}，不含 answers_json；他人/不存在档案 → 404；
    缺 Authorization → 400。"""
    uid = _new_user()
    cid = _new_case_named(uid)
    auth = _auth_header(uid)
    other = _new_user()

    # 造 3 条：主人 ESTJ → 分享 INFP → 分享 INTJ（id 递增：INTJ 最新）
    mbti_client.post("/api/mbti/score", json={"case_id": cid, "answers": _answers_by_key("A")},
                     headers=auth)
    token = mbti_client.post("/api/mbti/share", json={"case_id": cid},
                             headers=auth).json()["data"]["token"]
    mbti_client.post(f"/api/mbti/share/{token}/score", json={"answers": _answers_by_key("B")})
    mbti_client.post(f"/api/mbti/share/{token}/score",
                     json={"answers": _answers_by_pole({"EI": "I", "SN": "N",
                                                        "TF": "T", "JP": "J"})})

    resp = mbti_client.get(f"/api/mbti/results?case_id={cid}", headers=auth)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] == 3
    items = data["items"]
    types_order = [it["type"] for it in items]
    assert types_order == ["INTJ", "INFP", "ESTJ"], "应按 id 倒序（最新在前）"
    assert all(items[i]["id"] > items[i + 1]["id"] for i in range(len(items) - 1))
    first = items[0]
    assert set(first.keys()) >= {"id", "type", "scores", "created_at"}
    assert "answers" not in first and "answers_json" not in first
    assert first["scores"] == {"EI": {"E": 0, "I": 15}, "SN": {"S": 0, "N": 15},
                               "TF": {"T": 15, "F": 0}, "JP": {"J": 15, "P": 0}}

    # 隔离：他人列该档案 / 不存在档案 → 404；缺鉴权 → 400
    resp = mbti_client.get(f"/api/mbti/results?case_id={cid}", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    resp = mbti_client.get("/api/mbti/results?case_id=999999", headers=auth)
    assert resp.status_code == 404, resp.text
    resp = mbti_client.get(f"/api/mbti/results?case_id={cid}")
    assert resp.status_code == 400, resp.text

    # 与路径版 GET /mbti/results/{id} 并存：取单条仍可用
    rid = items[-1]["id"]
    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=auth)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["id"] == rid

