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
     - POST /api/mbti/score：落库 mbti_results + mbti_score 埋点 + 返回
       {type, scores} + 零扣费；答案缺失/空/维度不全/题目非法 → 400；
     - GET /api/mbti/results/{id}：本人可取（type_info 五栏），跨用户/不存在 → 404。

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


def _result_row(result_id: int):
    from app.database import AnalyticsSession
    from app.models import MbtiResult

    session = AnalyticsSession()
    try:
        return session.query(MbtiResult).filter_by(id=result_id).first()
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
    """POST /api/mbti/score：全 A → ESTJ；落库 mbti_results + mbti_score 埋点；
    返回 {id,type,scores}；零扣费（无 CreditTransaction）。"""
    uid = _new_user()
    answers = _answers_by_key("A")
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers},
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

    # 落库：answers_json 原样、scores_json/type 完整、user 归属正确
    row = _result_row(data["id"])
    assert row is not None
    assert row.user_id == uid
    assert row.type == "ESTJ"
    assert row.answers_json == answers
    assert row.scores_json == data["scores"]

    # 埋点 + 零扣费
    rows = _event_rows("mbti_score", uid)
    assert len(rows) == 1
    assert rows[0].props == {"type": "ESTJ"}
    assert _credit_rows(uid) == []


def test_api_score_pole_form(mbti_client):
    """POST /score 支持 pole 形态答案：{"id","pole"} → INTJ 落库。"""
    uid = _new_user()
    answers = _answers_by_pole({"EI": "I", "SN": "N", "TF": "T", "JP": "J"})
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers},
                            headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "INTJ"
    assert _result_row(data["id"]).type == "INTJ"


def test_api_score_requires_auth(mbti_client):
    """鉴权契约：完全缺 Authorization → 400（Header 必填校验）；非 Bearer/非法令牌 → 401。"""
    answers = _answers_by_key("A")
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers})
    assert resp.status_code == 400
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers},
                            headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers},
                            headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_api_score_bad_answers_400(mbti_client):
    """答案非法 → 400：缺 answers / 空列表 / 单维作答 / 题目不存在；不落库不埋点。"""
    uid = _new_user()
    auth = _auth_header(uid)
    q_sn = _first_two("SN")[0]

    # 缺 answers（pydantic 必填）→ 400 参数错误
    resp = mbti_client.post("/api/mbti/score", json={}, headers=auth)
    assert resp.status_code == 400, resp.text
    # 空列表 → 400
    resp = mbti_client.post("/api/mbti/score", json={"answers": []}, headers=auth)
    assert resp.status_code == 400, resp.text
    assert "答案" in resp.json()["message"] or "answers" in resp.json()["detail"]
    # 只答 EI 单维 → 400（维度不完整）
    resp = mbti_client.post("/api/mbti/score",
                            json={"answers": [{"question_id": 1, "choice": "A"}]},
                            headers=auth)
    assert resp.status_code == 400, resp.text
    assert "维度" in resp.json()["message"]
    # 题目不存在 → 400
    resp = mbti_client.post("/api/mbti/score",
                            json={"answers": [{"question_id": 9999, "choice": "A"}]},
                            headers=auth)
    assert resp.status_code == 400, resp.text

    assert _event_rows("mbti_score", uid) == []
    assert _credit_rows(uid) == []


# ------------------------------------------------------------ 端点：结果复看 ----
def test_api_results_get_and_type_info(mbti_client):
    """GET /api/mbti/results/{id}：本人返回 {id,type,scores,type_info}，
    type_info 为该型五栏文案（与 types.json 同源）。"""
    uid = _new_user()
    answers = _answers_by_key("B")   # INFP
    resp = mbti_client.post("/api/mbti/score", json={"answers": answers},
                            headers=_auth_header(uid))
    rid = resp.json()["data"]["id"]

    resp = mbti_client.get(f"/api/mbti/results/{rid}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["id"] == rid
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
    other = _new_user()
    resp = mbti_client.post("/api/mbti/score", json={"answers": _answers_by_key("A")},
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
