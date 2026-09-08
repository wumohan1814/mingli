# -*- coding: utf-8 -*-
"""配对解析契约测试（REQ-072 · /api/pair/analyze）。

分层覆盖（LLM 均 mock，不真调外部）：
  1. 成功链路（guoxue）：鉴权 + 双档案（各带 chart）→ code:0 + {id, interpretation}；
     messages 契约（system=prompts/pair/guoxue.md；user JSON 含 relation_type /
     question / person_a / person_b，profile 为 bazi 摘要）；即时扣费
     （ref=pair:{id}，tokens→ceil 存储单位）；落 pair_readings（含 relation_type /
     question / module / result_json={"content":...}）；pair_analysis 埋点
     props={module, relation_type}；
  2. 三模块数据源：
     - guoxue 无 chart → 400「未排盘…请先生成」；
     - xishi 有 AstrologyReading(natal) → profile 为 natal 摘要；无 reading → 400「未生成星盘」；
     - mbti case.mbti_type 优先（type_info 从 types.json 实时取）；无类型无结果 → 400「未测 MBTI」；
  3. 归属/参数校验：非本人档案 404（隔离在计费/LLM 之前）；module 白名单外 400；
     relation_type 为空 400；
  4. 计费语义：余额不足 → HTTP 502 + code 5002 且不放行 LLM；LLM 失败 → 502
     不落行不扣费；
  5. REQ-048：3 份 pair prompt 已注册进 admin PROMPT_FILES，文件存在且带合规免责。

依赖 conftest 的会话级临时库（orchestration_env）——不触碰真实 backend/data/*.db。
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
CHART_JSON_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "chart.json"

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    """临时 analytics 库建真实 user（pair_readings.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"pair_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int, *, mbti_type=None) -> int:
    """直插一个 case（绕过 API）。"""
    from app.database import AnalyticsSession
    from app.models import Case

    session = AnalyticsSession()
    try:
        case = Case(
            user_id=uid,
            name="测试档案",
            input_json={"question": "事业运势"},
            mbti_type=mbti_type,
        )
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _add_chart(cid: int, chart: dict) -> None:
    """直插 charts 行（case_id 为 PK）。"""
    from app.database import AnalyticsSession
    from app.models import Chart

    session = AnalyticsSession()
    try:
        session.add(Chart(case_id=cid, chart_json=chart))
        session.commit()
    finally:
        session.close()


def _add_astrology(uid: int, cid: int, chart: dict) -> int:
    from app.database import AnalyticsSession
    from app.models import AstrologyReading

    session = AnalyticsSession()
    try:
        row = AstrologyReading(user_id=uid, case_id=cid, chart_json=chart, scope="natal")
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _consume_rows(user_id: int):
    """仅取该用户 type=consume 的扣费流水（不计入 recharge 的 free 入账行）。"""
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return (session.query(CreditTransaction)
                .filter_by(user_id=user_id, type="consume").all())
    finally:
        session.close()


def _pair_rows(user_id: int):
    from app.database import AnalyticsSession
    from app.models import PairReading

    session = AnalyticsSession()
    try:
        return session.query(PairReading).filter_by(user_id=user_id).all()
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


def _chart_snapshot() -> dict:
    with open(CHART_JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


# xishi 用迷你 natal 样例（含日月升 + summary，供 _natal_digest 提炼）
SAMPLE_NATAL_CHART = {
    "natal": {
        "birth": {"dateTime": "1990-05-12 10:30", "location": "上海", "gender": "male"},
        "planets": [
            {"name": "Sun", "label": "太阳", "sign": "金牛座", "house": 10,
             "formatted": "金牛座21°07′", "retrograde": False, "dignityLabel": "曜升"},
            {"name": "Moon", "label": "月亮", "sign": "天秤座", "house": 4,
             "formatted": "天秤座2°15′", "retrograde": False},
            {"name": "Venus", "label": "金星", "sign": "白羊座", "house": 9,
             "formatted": "白羊座20°11′", "retrograde": False},
        ],
        "angles": [
            {"name": "Ascendant", "label": "上升", "sign": "狮子座", "house": 0,
             "formatted": "狮子座7°46′"},
        ],
        "aspects": [
            {"body1": "金星", "body2": "木星", "type": "刑相", "symbol": "□",
             "exactAngle": 90, "orb": 0.05, "closeness": "紧密"},
        ],
        "summary": {
            "elements": {"土": ["金星"], "风": ["月亮"]},
            "modalities": {"固定": ["太阳"]},
            "patterns": ["提桶型"],
        },
    },
}


def _fake_chat(monkeypatch, calls, *, content="配对解析（mock）：两人互补多于冲突，宜多沟通。", tokens=1234, exc=None):
    """stub app.api.pair 模块的 chat（不真调 LLM），记录 messages / json_mode。"""
    import app.api.pair as pair_mod

    async def fake_chat(messages, json_mode=False):
        calls.append({"messages": messages, "json_mode": json_mode})
        if exc is not None:
            raise exc
        return {
            "content": content,
            "usage": {"prompt_tokens": 900, "completion_tokens": tokens - 900,
                      "total_tokens": tokens},
            "model": "mock-model",
        }

    monkeypatch.setattr(pair_mod, "chat", fake_chat)


@pytest.fixture(scope="module")
def pair_client(orchestration_env):
    """真实 FastAPI app 的 TestClient；chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


# ------------------------------------------------------------ 用例 ----
def test_pair_guoxue_success_full_chain(pair_client, monkeypatch):
    """guoxue 成功链路：双档案各带 chart → 扣费 ref=pair:{id} → 落 pair_readings → 埋点。"""
    import app.api.pair as pair_mod

    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    _add_chart(cid1, _chart_snapshot())
    _add_chart(cid2, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    content = "配对解析（mock）：两人互补多于冲突，宜多沟通。"
    calls: list = []
    _fake_chat(monkeypatch, calls, content=content, tokens=1234)

    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "恋爱", "question": "看重长期发展，想了解沟通模式",
              "module": "guoxue"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    rid = body["data"]["id"]
    assert isinstance(rid, int) and rid > 0
    assert body["data"]["interpretation"] == content

    # messages 契约：system = prompts/pair/guoxue.md；user = {relation_type, question, person_a/b}
    assert len(calls) == 1
    msg = calls[0]["messages"]
    assert calls[0]["json_mode"] is False
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "国学" in msg[0]["content"] and "合参" in msg[0]["content"]
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["relation_type"] == "恋爱"
    assert user_payload["question"] == "看重长期发展，想了解沟通模式"
    for key in ("person_a", "person_b"):
        person = user_payload[key]
        assert person["case"]["id"] in (cid1, cid2)
        assert "profile" in person
        profile = person["profile"]
        assert profile["dayMaster"]          # bazi 摘要（cases._chart_summary 口径）
        assert profile["pillars"] and "solar" in profile

    # 即时扣费：ref=pair:{id}，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"pair:{rid}"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 落 pair_readings：字段完整
    rows = _pair_rows(uid)
    assert len(rows) == 1
    row = rows[0]
    assert row.id == rid
    assert row.case_id_1 == cid1 and row.case_id_2 == cid2
    assert row.relation_type == "恋爱"
    assert row.question == "看重长期发展，想了解沟通模式"
    assert row.module == "guoxue"
    assert row.result_json == {"content": content}

    # 埋点 props={module, relation_type}
    evs = _event_rows("pair_analysis", uid)
    assert len(evs) == 1
    assert evs[0].props == {"module": "guoxue", "relation_type": "恋爱"}


def test_pair_xishi_success_natal_profile(pair_client, monkeypatch):
    """xishi：双档案各带 AstrologyReading(natal) → profile 为 natal 摘要。"""
    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    _add_astrology(uid, cid1, SAMPLE_NATAL_CHART)
    _add_astrology(uid, cid2, SAMPLE_NATAL_CHART)
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "朋友", "module": "xishi"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text

    user_payload = json.loads(calls[0]["messages"][1]["content"])
    profile = user_payload["person_a"]["profile"]
    # natal 摘要（astrology._natal_digest 口径）：日月升 + planets + aspects + elements
    assert profile["sun"]["label"] == "太阳"
    assert profile["moon"]["label"] == "月亮"
    assert profile["ascendant"]["label"] == "上升"
    assert any(p["label"] == "金星" for p in profile["planets"])
    assert len(profile["aspects"]) == 1
    assert "elements" in profile

    rows = _pair_rows(uid)
    assert len(rows) == 1 and rows[0].module == "xishi"


def test_pair_mbti_success_case_type(pair_client, monkeypatch):
    """mbti：profile 用 case.mbti_type（无 MbtiResult 行也可），type_info 从 types.json 取。"""
    uid = _new_user()
    cid1 = _new_case(uid, mbti_type="INTJ")
    cid2 = _new_case(uid, mbti_type="ENFP")
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "同事", "module": "mbti"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text

    user_payload = json.loads(calls[0]["messages"][1]["content"])
    pa, pb = user_payload["person_a"]["profile"], user_payload["person_b"]["profile"]
    assert pa["type"] == "INTJ" and pb["type"] == "ENFP"
    assert pa["type_info"]["alias"] and pb["type_info"]["alias"]  # 评语已实时取到
    assert _pair_rows(uid)[0].module == "mbti"


def test_pair_bazi_success_full_chain(pair_client, monkeypatch):
    """REQ-093④ bazi 成功链路：双档案各带 chart → profile 为八字画像（_bazi_digest
    口径）→ system=prompts/pair/bazi.md → 扣费 ref=pair:{id} → 落行 module=bazi
    → 埋点 props={module:bazi}。"""
    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    _add_chart(cid1, _chart_snapshot())
    _add_chart(cid2, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    content = "配对解析（mock）：八字五行互补，用神相济，宜多磨合。"
    calls: list = []
    _fake_chat(monkeypatch, calls, content=content, tokens=1500)

    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "恋爱", "question": "想了解五行是否互补",
              "module": "bazi"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    rid = body["data"]["id"]
    assert body["data"]["interpretation"] == content

    # messages 契约：system = prompts/pair/bazi.md；profile 为八字画像（更细的 bazi 摘要）
    assert len(calls) == 1
    msg = calls[0]["messages"]
    assert calls[0]["json_mode"] is False
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "八字配对" in msg[0]["content"] and "合参" in msg[0]["content"]
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["relation_type"] == "恋爱"
    for key in ("person_a", "person_b"):
        profile = user_payload[key]["profile"]
        assert profile["dayMaster"] and profile["dayMasterWuxing"]
        assert profile["pillars"]["day"]["gan"]          # 四柱含干支
        assert profile["pillars"]["day"]["nayin"]        # 纳音
        assert profile["pillars"]["day"]["shishen_gan"]  # 十神
        assert profile["ming_gong"] and profile["shen_gong"]   # 命宫/身宫
        assert isinstance(profile["shensha"], list) and profile["shensha"]

    # 即时扣费：ref=pair:{id}，tokens=1500 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"pair:{rid}"
    assert txs[0].delta == -2

    rows = _pair_rows(uid)
    assert len(rows) == 1 and rows[0].module == "bazi"
    assert rows[0].case_id_1 == cid1 and rows[0].case_id_2 == cid2
    assert rows[0].result_json == {"content": content}

    evs = _event_rows("pair_analysis", uid)
    assert len(evs) == 1
    assert evs[0].props == {"module": "bazi", "relation_type": "恋爱"}


def test_pair_bazi_missing_chart_400(pair_client, monkeypatch):
    """bazi：档案无 chart → 400「未排盘…请先生成」（不调 LLM、不扣费）。"""
    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "恋爱", "module": "bazi"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 400, resp.text
    assert "未排盘" in resp.json()["message"] and "请先生成" in resp.json()["message"]
    assert calls == []
    assert _consume_rows(uid) == []
    assert _pair_rows(uid) == []


def test_pair_missing_data_400_not_auto_generate(pair_client, monkeypatch):
    """缺数据 → 400 提示先生成（不自动生成、不调 LLM、不扣费）；三种模块分别覆盖。"""
    uid = _new_user()
    calls: list = []
    _fake_chat(monkeypatch, calls)
    auth = _auth_header(uid)

    # guoxue：档案无 chart
    c1, c2 = _new_case(uid), _new_case(uid)
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": c1, "case_id_2": c2,
              "relation_type": "恋爱", "module": "guoxue"},
        headers=auth,
    )
    assert resp.status_code == 400, resp.text
    assert "未排盘" in resp.json()["message"] and "请先生成" in resp.json()["message"]

    # xishi：档案无 astrology_readings
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": c1, "case_id_2": c2,
              "relation_type": "恋爱", "module": "xishi"},
        headers=auth,
    )
    assert resp.status_code == 400, resp.text
    assert "未生成星盘" in resp.json()["message"] and "请先生成" in resp.json()["message"]

    # mbti：档案无 mbti_type 且无 MbtiResult
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": c1, "case_id_2": c2,
              "relation_type": "恋爱", "module": "mbti"},
        headers=auth,
    )
    assert resp.status_code == 400, resp.text
    assert "未测 MBTI" in resp.json()["message"] and "请先生成" in resp.json()["message"]

    assert calls == []            # 未调 LLM
    assert _consume_rows(uid) == []
    assert _pair_rows(uid) == []
    assert _event_rows("pair_analysis", uid) == []


def test_pair_isolation_and_param_validation(pair_client, monkeypatch):
    """非本人档案 → 404；module 白名单外 / relation_type 空 → 400（均不调 LLM）。"""
    uid = _new_user()
    other = _new_user()
    other_cid = _new_case(other)
    my_cid = _new_case(uid)
    _add_chart(my_cid, _chart_snapshot())
    _add_chart(other_cid, _chart_snapshot())

    calls: list = []
    _fake_chat(monkeypatch, calls)
    auth = _auth_header(uid)

    # case_id_2 非本人 → 404（隔离在计费/LLM 之前）
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": my_cid, "case_id_2": other_cid,
              "relation_type": "恋爱", "module": "guoxue"},
        headers=auth,
    )
    assert resp.status_code == 404, resp.text
    assert "档案不存在" in resp.json()["message"]

    # case 不存在 → 404
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": my_cid, "case_id_2": 999999,
              "relation_type": "恋爱", "module": "guoxue"},
        headers=auth,
    )
    assert resp.status_code == 404, resp.text

    # module 白名单外 → 400
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": my_cid, "case_id_2": my_cid,
              "relation_type": "恋爱", "module": "tarot"},
        headers=auth,
    )
    assert resp.status_code == 400, resp.text
    assert "不支持的模块" in resp.json()["message"]

    # relation_type 空 → 400
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": my_cid, "case_id_2": my_cid,
              "relation_type": "   ", "module": "guoxue"},
        headers=auth,
    )
    assert resp.status_code == 400, resp.text
    assert "关系类型" in resp.json()["message"]

    assert calls == []
    assert _consume_rows(uid) == []


def test_pair_insufficient_balance_5002(pair_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    _add_chart(cid1, _chart_snapshot())
    _add_chart(cid2, _chart_snapshot())

    calls: list = []
    _fake_chat(monkeypatch, calls)
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "恋爱", "module": "guoxue"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "余额不足" in body["message"]
    assert calls == []                # 预检拦截，未调 LLM
    assert _pair_rows(uid) == []


def test_pair_llm_error_502_no_persist(pair_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不落行、不扣费。"""
    from app.llm import LLMError

    uid = _new_user()
    cid1, cid2 = _new_case(uid), _new_case(uid)
    _add_chart(cid1, _chart_snapshot())
    _add_chart(cid2, _chart_snapshot())
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    calls: list = []
    _fake_chat(monkeypatch, calls, exc=LLMError("mock LLM 不可用"))
    resp = pair_client.post(
        "/api/pair/analyze",
        json={"case_id_1": cid1, "case_id_2": cid2,
              "relation_type": "恋爱", "module": "guoxue"},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(calls) == 1
    assert _consume_rows(uid) == []    # LLM 未成功 → 不扣费
    assert _pair_rows(uid) == []       # 未落行


def test_pair_prompts_registered_and_bounded():
    """REQ-048 归属：4 份 pair prompt 注册进 admin PROMPT_FILES（后台可热改/回滚），
    文件存在、带合规免责、篇幅受控。"""
    from app.admin.router import PROMPT_FILES

    expected = {
        "guoxue": "pair/guoxue.md",
        "xishi": "pair/xishi.md",
        "mbti": "pair/mbti.md",
        "bazi": "pair/bazi.md",  # REQ-093④ 八字配对
    }
    for key, rel in expected.items():
        assert PROMPT_FILES[key] == rel, f"{key} 未注册到后台提示词白名单"
        text = (BACKEND_DIR / "prompts" / rel).read_text(encoding="utf-8")
        assert 300 <= len(text) <= 1500, f"{key}.md 篇幅越界（len={len(text)}）"
        assert "免责" in text and "娱乐" in text
        assert ("禁止" in text or "严禁" in text), f"{key}.md 缺绝对化断语红线"
