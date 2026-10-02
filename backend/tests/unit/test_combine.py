# -*- coding: utf-8 -*-
"""合参改造 · 契约与编排单测（backend/tests/unit/test_combine.py）。

**零真实 LLM / 零真实 Node 调用**：起卦转发打桩、`chat` 打桩、后台编排直接 await
（不靠轮询等后台 task）。

覆盖清单（对齐交付要求 10）：
  1. 两个方法池的定稿 key / 顺序 / 中文名（唯一事实源），且每个 key **真能起卦/真能加载**；
  2. label 生成（中文数字 1–10 + 「N法合一」/「N法合参」）与非法输入拒绝；
  3. 方法池校验：非法 key / 空数组 / 非数组 → ValueError；端点 → 400；
  4. 幂等指纹带方法集：同一 case 换方法集**不复用**旧 job（断前尘 + 预测）；
  5. 命盘合参编排：断前尘只跑 `job.method_keys` 记的那批法（不写死注册表）、
     预测沿用同一批法（不再走路由表），且 `prompts/combine/natal.md` 纪律真的注入了；
  6. 当下事合参 happy path：逐法起卦落 Divination 行 → **只调 1 次 LLM** → 5 板块结果 +
     按 1 次扣费；起卦全失败 → job failed；
  7. `GET /api/jobs/{id}` 新增 label/methodKeys/reportTitles 且旧键一个不少；
  8. `REPORT_TITLES` 缺省仍为 8 板块（向后兼容零变化），传参才换骨架。
"""
from __future__ import annotations

import json
import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.combine import (
    COMBINE_MODE_MOMENT,
    COMBINE_MODE_NATAL,
    MOMENT_POOL,
    MOMENT_POOL_KEYS,
    NATAL_POOL,
    NATAL_POOL_KEYS,
    cn_number,
    combine_label,
    degraded_method_keys,
    fingerprint,
    load_combine_prompt,
    normalize_methods,
    same_method_set,
)
from app.database import AnalyticsSession
from app.main import app
from app.models import Divination, Job, JobStatus, JobType
from app.synthesis.synthesizer import MOMENT_REPORT_TITLES, REPORT_TITLES, synthesize

pytestmark = pytest.mark.usefixtures("orchestration_env")


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #
def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user(with_balance: bool = True) -> int:
    """临时库建真实 user（jobs.user_id / divinations.user_id 有外键约束），可选预充余额。"""
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"combine_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        uid = user.id
    finally:
        session.close()
    if with_balance:
        from app.credits.service import recharge

        recharge(uid, 100, "free", note="pytest 预充余额")
    return uid


def _new_case(uid: int) -> int:
    from app.models import Case, CaseStatus

    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, input_json={"question": "事业运势"}, status=CaseStatus.paipan_done)
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _load_job(job_id: int) -> Job:
    session = AnalyticsSession()
    try:
        return session.query(Job).filter_by(id=job_id).first()
    finally:
        session.close()


def _consumes(uid: int) -> list:
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return session.query(CreditTransaction).filter_by(user_id=uid, type="consume").all()
    finally:
        session.close()


def _div_rows(uid: int) -> list[Divination]:
    session = AnalyticsSession()
    try:
        return session.query(Divination).filter_by(user_id=uid).all()
    finally:
        session.close()


@pytest.fixture()
def combine_client(orchestration_env):
    """真实 FastAPI 的 TestClient（lifespan 建表/拉起 Node；转发与 chat 由用例打桩）。"""
    with TestClient(app) as client:
        yield client


# --------------------------------------------------------------------------- #
# 1. 两个池（唯一事实源）
# --------------------------------------------------------------------------- #
def test_natal_pool_is_the_final_nine():
    """命盘合参池 = 9 法（第八法不动、xizhan 作为可选第 9 法回归），顺序即池顺序。"""
    assert NATAL_POOL_KEYS == (
        "bazi-pattern", "bazi-dayun-liunian", "bazi-shensha-nayin", "bazi-hunyin-caiyun",
        "ziwei", "qizheng", "qimen-lifetime", "wuyun-liuqi", "xizhan",
    )
    assert [m["key"] for m in NATAL_POOL] == list(NATAL_POOL_KEYS)
    assert all(set(m) == {"key", "name"} and m["name"] for m in NATAL_POOL)


def test_moment_pool_is_the_final_ten():
    """当下事合参池 = 10 法（catalog needCase:none + answer:问当下事 推导，key 以能起卦为准）。"""
    assert MOMENT_POOL_KEYS == (
        "ssgw", "shengbei", "tarot", "liuyao", "meihua",
        "xiaoliuren", "lenormand", "liuren", "jinkoujue", "qimen",
    )
    assert len(MOMENT_POOL) == 10
    # 观音灵签必须是后端起卦 key（ssgw），不是前端演出 id（sign）
    assert "sign" not in MOMENT_POOL_KEYS
    assert MOMENT_POOL[0] == {"key": "ssgw", "name": "观音灵签"}


def test_every_pool_key_can_really_run():
    """池里的 key 必须**真能跑**：命盘池每个都能按 key 加载，当下事池每个都有起卦入口。

    这条是「以能真正起卦为准」的机器化护栏：池里放一个后端不认的 key（如把 ssgw
    写成 sign）就会当场红。
    """
    from app.api.divination import DIVINATION_METHODS
    from app.methods import ANALYZERS
    from app.paipan.slicer import build_fragment

    for key in NATAL_POOL_KEYS:
        assert key in ANALYZERS, f"命盘池 key {key} 无法按 key 加载 analyzer"
        assert build_fragment(key, {"western": {}, "bazi": {}, "ziwei": {}, "qizheng": {},
                                    "qimen_lifetime": {}, "wuyun_liuqi": {},
                                    "timeline_20y": {}}) is not None, \
            f"命盘池 key {key} 没有切片映射（跑了也是空盘）"
    for key in MOMENT_POOL_KEYS:
        assert key == "tarot" or key in DIVINATION_METHODS, \
            f"当下事池 key {key} 不在后端起卦方法表里"


# --------------------------------------------------------------------------- #
# 2. label
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("count,want", [
    (1, "一法合一"), (7, "七法合一"), (8, "八法合一"), (9, "九法合一"), (10, "十法合一"),
])
def test_label_natal(count, want):
    assert combine_label(count, COMBINE_MODE_NATAL) == want


@pytest.mark.parametrize("count,want", [
    (1, "一法合参"), (5, "五法合参"), (6, "六法合参"), (10, "十法合参"),
])
def test_label_moment(count, want):
    assert combine_label(count, COMBINE_MODE_MOMENT) == want


def test_label_edges():
    assert combine_label(0, COMBINE_MODE_NATAL) == ""     # 还没定方法集 → 空 label，不编「零法合一」
    assert cn_number(10) == "十"
    with pytest.raises(ValueError):
        cn_number(11)
    with pytest.raises(ValueError):
        cn_number(0)
    with pytest.raises(ValueError):
        combine_label(3, "midnight")                       # 未知模式不静默兜底


# --------------------------------------------------------------------------- #
# 3. 方法池校验
# --------------------------------------------------------------------------- #
def test_normalize_methods_rejects_bad_input():
    with pytest.raises(ValueError):
        normalize_methods(["no-such-method"], COMBINE_MODE_NATAL)
    with pytest.raises(ValueError):
        normalize_methods([], COMBINE_MODE_NATAL)
    with pytest.raises(ValueError):
        normalize_methods("bazi-pattern", COMBINE_MODE_NATAL)      # 非数组
    with pytest.raises(ValueError):
        normalize_methods({"bazi-pattern": 1}, COMBINE_MODE_NATAL)  # dict 不算数组
    with pytest.raises(ValueError):
        normalize_methods(["sign"], COMBINE_MODE_MOMENT)          # 前端演出 id，不是后端 key


def test_normalize_methods_pool_order_and_dedup():
    assert normalize_methods(None, COMBINE_MODE_NATAL) == list(NATAL_POOL_KEYS)
    assert normalize_methods(["ziwei", "bazi-pattern", "ziwei"], COMBINE_MODE_NATAL) == \
        ["bazi-pattern", "ziwei"]


def test_fingerprint_and_same_set():
    assert fingerprint(None) is None
    assert same_method_set(None, ["ziwei"]) is False          # 老 job 无记录 → 不复用
    assert same_method_set(["ziwei", "bazi-pattern"], ["bazi-pattern", "ziwei"]) is True
    assert same_method_set(["ziwei"], ["ziwei", "qizheng"]) is False


def test_degraded_key_alias_maps_western_to_xizhan():
    """盘面字段名 western → 方法 key xizhan（节139 遗留的不同名，合参必须对齐）。"""
    assert degraded_method_keys(["western", "ziwei"]) == {"xizhan", "ziwei"}
    assert degraded_method_keys(None) == set()


def test_pools_endpoint(combine_client):
    uid = _new_user()
    resp = combine_client.get("/api/combine/pools", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0 and body["message"] == "ok"
    data = body["data"]
    assert [m["key"] for m in data["natal"]] == list(NATAL_POOL_KEYS)
    assert [m["key"] for m in data["moment"]] == list(MOMENT_POOL_KEYS)
    assert data["natal"][0]["name"] == "八字格局"


# --------------------------------------------------------------------------- #
# 4/5. 断前尘：方法集子集 + 幂等指纹
# --------------------------------------------------------------------------- #
@pytest.fixture()
def stub_dqc_orchestrator(monkeypatch):
    """把断前尘后台编排换成 no-op：本组用例只测端点契约（不跑 LLM）。"""
    import app.api.cases as cases_mod

    started: list[int] = []

    async def _noop(job_id):
        started.append(job_id)

    monkeypatch.setattr(cases_mod, "run_duan_qian_chen", _noop)
    return started


def test_duan_qian_chen_default_is_full_pool(combine_client, stub_dqc_orchestrator):
    uid = _new_user()
    cid = _new_case(uid)
    resp = combine_client.post(f"/api/cases/{cid}/duan-qian-chen", headers=_auth_header(uid))
    assert resp.status_code == 202, resp.text
    data = resp.json()["data"]
    assert data["total"] == 9 and data["label"] == "九法合一"
    job = _load_job(int(data["jobId"]))
    assert job.method_keys == list(NATAL_POOL_KEYS)
    assert job.combine_mode == COMBINE_MODE_NATAL


def test_duan_qian_chen_subset_and_idempotency(combine_client, stub_dqc_orchestrator):
    uid = _new_user()
    cid = _new_case(uid)
    h = _auth_header(uid)
    seven = ["bazi-pattern", "bazi-dayun-liunian", "bazi-shensha-nayin", "bazi-hunyin-caiyun",
             "ziwei", "qizheng", "qimen-lifetime"]

    first = combine_client.post(f"/api/cases/{cid}/duan-qian-chen", headers=h)
    assert first.json()["data"]["total"] == 9
    job_full = first.json()["data"]["jobId"]

    # 换方法集 → **不许复用**旧 job（否则用户选七法拿到九法结果）
    second = combine_client.post(f"/api/cases/{cid}/duan-qian-chen", json={"methods": seven}, headers=h)
    assert second.status_code == 202, second.text
    assert second.json()["data"]["jobId"] != job_full
    assert second.json()["data"]["total"] == 7
    assert second.json()["data"]["label"] == "七法合一"
    assert "reused" not in second.json()["data"]

    # 同一方法集（顺序不同）→ 复用
    third = combine_client.post(
        f"/api/cases/{cid}/duan-qian-chen",
        json={"methods": list(reversed(seven))}, headers=h,
    )
    assert third.json()["data"]["jobId"] == second.json()["data"]["jobId"]
    assert third.json()["data"]["reused"] is True
    assert third.json()["data"]["label"] == "七法合一"

    # 非法 key / 空数组 → 400，不静默退回全量
    bad = combine_client.post(f"/api/cases/{cid}/duan-qian-chen",
                              json={"methods": ["sign"]}, headers=h)
    assert bad.status_code == 400, bad.text
    empty = combine_client.post(f"/api/cases/{cid}/duan-qian-chen",
                                json={"methods": []}, headers=h)
    assert empty.status_code == 400, empty.text


def test_duan_qian_chen_legacy_job_without_method_set_is_not_reused(combine_client,
                                                                   stub_dqc_orchestrator):
    """老 job（method_keys 为 NULL）无法证明是同一批法 → 一律另起 job。"""
    uid = _new_user()
    cid = _new_case(uid)
    session = AnalyticsSession()
    try:
        job = Job(case_id=cid, user_id=uid, type=JobType.duan_qian_chen,
                  status=JobStatus.succeeded, total=8, completed=8)
        session.add(job)
        session.commit()
        session.refresh(job)
        legacy_id = job.id
    finally:
        session.close()

    resp = combine_client.post(f"/api/cases/{cid}/duan-qian-chen", headers=_auth_header(uid))
    assert resp.json()["data"]["jobId"] != str(legacy_id)
    assert "reused" not in resp.json()["data"]


# --------------------------------------------------------------------------- #
# 6. 预测沿用断前尘方法集
# --------------------------------------------------------------------------- #
@pytest.fixture()
def stub_predict_orchestrator(monkeypatch):
    import app.api.cases as cases_mod

    async def _noop(job_id):
        return None

    monkeypatch.setattr(cases_mod, "run_predict", _noop)


def test_predict_follows_latest_dqc_method_set(combine_client, stub_dqc_orchestrator,
                                               stub_predict_orchestrator):
    uid = _new_user()
    cid = _new_case(uid)
    h = _auth_header(uid)
    three = ["ziwei", "qizheng", "wuyun-liuqi"]

    dqc = combine_client.post(f"/api/cases/{cid}/duan-qian-chen",
                              json={"methods": three}, headers=h)
    assert dqc.json()["data"]["label"] == "三法合一"

    pred = combine_client.post(f"/api/cases/{cid}/predict", headers=h)
    assert pred.status_code == 202, pred.text
    data = pred.json()["data"]
    assert data["total"] == 3 and data["label"] == "三法合一"
    job = _load_job(int(data["jobId"]))
    assert job.method_keys == three

    # 幂等：同一方法集复用；断前尘换法（回到全量）后预测不复用旧 job
    again = combine_client.post(f"/api/cases/{cid}/predict", headers=h)
    assert again.json()["data"]["jobId"] == data["jobId"]
    assert again.json()["data"]["reused"] is True

    combine_client.post(f"/api/cases/{cid}/duan-qian-chen", headers=h)  # 全量 9 法
    after = combine_client.post(f"/api/cases/{cid}/predict", headers=h)
    assert after.json()["data"]["jobId"] != data["jobId"]
    assert after.json()["data"]["total"] == 9


def test_predict_without_dqc_falls_back_to_full_pool(combine_client, stub_predict_orchestrator):
    """没有断前尘 job → 预测按命盘合参池全量（不是路由表的 5 法）。"""
    uid = _new_user()
    cid = _new_case(uid)
    resp = combine_client.post(f"/api/cases/{cid}/predict", headers=_auth_header(uid))
    assert resp.json()["data"]["total"] == 9
    assert resp.json()["data"]["label"] == "九法合一"


# --------------------------------------------------------------------------- #
# 7. 编排：只跑 job 记的那批法 + 注入合参纪律
# --------------------------------------------------------------------------- #
class _FakeChat:
    """方法分析 / 校验 / 合参解读三用替身：记录 messages，按调用来源返回固定内容。"""

    def __init__(self, moment_payload: dict | None = None):
        self.moment_payload = moment_payload
        self.analyze_calls: list[str] = []
        self.validate_calls: list[str] = []
        self.systems: list[str] = []          # 每次调用的 system prompt（按调用顺序）
        self.analyze_systems: list[str] = []  # 只记「方法分析」链路的 system prompt
        self.calls = 0

    async def chat(self, messages, *, model=None, json_mode=False, **kwargs):
        self.calls += 1
        self.systems.append(messages[0]["content"])
        payload = json.loads(messages[-1]["content"])

        if "method_key" in payload:                      # 方法分析
            key = payload["method_key"]
            self.analyze_calls.append(key)
            self.analyze_systems.append(messages[0]["content"])
            content = json.dumps({
                "method": key, "phase": payload.get("phase"),
                "past_propositions": [{"year_range": "2020", "domain": "事业",
                                       "claim": f"{key}: 该年有变动", "confidence_level": "high",
                                       "confidence_reason": "r", "basis": ["依据"]}],
                "conclusions": ([{"direction": "吉", "domain": "事业", "claim": "上行",
                                  "confidence_level": "medium", "evidence": ["证据"], "risks": []}]
                                if payload.get("phase") == "prediction" else []),
            }, ensure_ascii=False)
        elif "method_result" in payload:                 # 校验
            self.validate_calls.append((payload.get("method_result") or {}).get("method"))
            content = json.dumps({"validations": []}, ensure_ascii=False)
        else:                                            # 当下事合参统一解读
            content = json.dumps(self.moment_payload or {}, ensure_ascii=False)
        return {"content": content,
                "usage": {"prompt_tokens": 1_000_000, "completion_tokens": 0,
                          "total_tokens": 1_000_000},
                "model": "mock"}


def _patch_method_chat(monkeypatch, fake: _FakeChat) -> None:
    monkeypatch.setattr("app.methods.base.chat", fake.chat)
    monkeypatch.setattr("app.validation.validator.chat", fake.chat)


def _create_job(uid: int, cid: int, job_type: JobType, total: int,
                method_keys=None, combine_mode=None) -> int:
    session = AnalyticsSession()
    try:
        job = Job(case_id=cid, user_id=uid, type=job_type, status=JobStatus.pending,
                  total=total, completed=0, method_keys=method_keys, combine_mode=combine_mode)
        session.add(job)
        session.commit()
        session.refresh(job)
        return job.id
    finally:
        session.close()


def _method_rows(cid: int, uid: int, phase) -> list:
    from app.models import MethodResult

    session = AnalyticsSession()
    try:
        return session.query(MethodResult).filter_by(case_id=cid, user_id=uid, phase=phase).all()
    finally:
        session.close()


async def test_dqc_runs_exactly_the_recorded_method_set(paipan_case, monkeypatch):
    """断前尘只跑 job.method_keys 记的法（七法子集 → 只跑 7 法，不碰注册表里其余法）。"""
    from app.jobs.orchestrator import run_duan_qian_chen
    from app.models import Phase

    fake = _FakeChat()
    _patch_method_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()
    seven = ["bazi-pattern", "bazi-dayun-liunian", "bazi-shensha-nayin", "bazi-hunyin-caiyun",
             "ziwei", "qizheng", "qimen-lifetime"]

    job_id = _create_job(uid, cid, JobType.duan_qian_chen, len(seven),
                         method_keys=seven, combine_mode=COMBINE_MODE_NATAL)
    await run_duan_qian_chen(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.completed == 7
    assert sorted(fake.analyze_calls) == sorted(seven)
    assert len(_method_rows(cid, uid, Phase.duan_qian_chen)) == 7
    # 合参纪律（prompts/combine/natal.md）真的注入了**每法分析**的 system prompt
    discipline = load_combine_prompt("natal")
    assert fake.analyze_systems, "应有分析方法调用"
    assert all(discipline.strip()[:20] in s for s in fake.analyze_systems)
    assert all("分歧要并列" in s for s in fake.analyze_systems)


async def test_dqc_includes_xizhan_when_selected(paipan_case, monkeypatch):
    """xizhan 是可选第 9 法：选中它就必须真跑（切片缺失会静默降级成 8 法）。"""
    from app.jobs.orchestrator import run_duan_qian_chen
    from app.models import Phase

    fake = _FakeChat()
    _patch_method_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()

    job_id = _create_job(uid, cid, JobType.duan_qian_chen, 9,
                         method_keys=list(NATAL_POOL_KEYS), combine_mode=COMBINE_MODE_NATAL)
    await run_duan_qian_chen(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded and job.completed == 9
    assert "xizhan" in fake.analyze_calls
    assert "xizhan" in [r.method_key for r in _method_rows(cid, uid, Phase.duan_qian_chen)]


async def test_predict_reuses_dqc_set_and_keeps_default_skeleton(paipan_case, monkeypatch):
    """预测沿用 job 记的方法集（不走路由表），报告骨架仍是既有 8 板块。"""
    from app.jobs.orchestrator import run_predict
    from app.models import Phase, RouteDecision

    fake = _FakeChat()
    _patch_method_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()
    pair = ["bazi-pattern", "ziwei"]

    job_id = _create_job(uid, cid, JobType.predict, len(pair),
                         method_keys=pair, combine_mode=COMBINE_MODE_NATAL)
    await run_predict(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.total == 2 and job.completed == 2
    assert sorted(fake.analyze_calls) == sorted(pair)
    assert len(_method_rows(cid, uid, Phase.prediction)) == 2

    session = AnalyticsSession()
    try:
        decisions = session.query(RouteDecision).filter_by(case_id=cid, user_id=uid).all()
    finally:
        session.close()
    assert len(decisions) == 1
    assert decisions[0].main_methods == pair          # 合参：全部按主法等权，无辅法
    assert decisions[0].support_methods == []
    assert [d["title"] for d in job.result_json["report"]["details"]] == REPORT_TITLES


# --------------------------------------------------------------------------- #
# 8. 当下事合参
# --------------------------------------------------------------------------- #
def _stub_casts(monkeypatch, *, fail: bool = False):
    """打桩两条起卦转发（不真调 Node），记录调用。"""
    import app.api.combine as combine_mod

    calls: list[dict] = []

    def _div(method, seed=None, *, user_id=None):
        calls.append({"kind": "divination", "method": method, "seed": seed})
        if fail:
            raise HTTPException(status_code=502, detail="起卦服务暂不可用，请稍后重试")
        return {"originalName": "雷天大壮", "method": method}

    def _tarot(spread_type, options=None, *, user_id=None):
        calls.append({"kind": "tarot", "spreadType": spread_type, "options": options})
        if fail:
            raise HTTPException(status_code=502, detail="塔罗抽牌服务暂不可用，请稍后重试")
        return {"spreadType": spread_type, "cards": [{"name": "愚者"}]}

    monkeypatch.setattr(combine_mod, "forward_node_divination", _div)
    monkeypatch.setattr(combine_mod, "forward_node_tarot", _tarot)
    return calls


_MOMENT_LLM_OK = {
    "summary": "这件事眼下偏可推进，但要先把条件谈清。",
    "sections": [
        {"title": "综合判断", "description": "几法都指向可以先谈条件。"},
        {"title": "事态走向", "description": "接下来一段时间偏顺，但节奏慢。"},
        {"title": "关键节点", "description": "约一个月内会出现一次明确表态。"},
        {"title": "阻力与助力", "description": "助力来自熟人引荐，阻力来自条款不明。"},
        {"title": "行动建议", "description": "先书面确认分工与分账。"},
    ],
}


async def test_moment_combine_happy_path(monkeypatch):
    """逐法起卦（落 Divination 行）→ 只调 1 次 LLM → 5 板块统一解读 + 1 次扣费。"""
    import app.api.combine as combine_mod

    calls = _stub_casts(monkeypatch)
    fake = _FakeChat(moment_payload=_MOMENT_LLM_OK)
    monkeypatch.setattr(combine_mod, "chat", fake.chat)

    uid = _new_user()
    methods = ["ssgw", "tarot", "liuyao"]
    job_id = _create_job(uid, None, JobType.moment_combine, len(methods),
                         method_keys=methods, combine_mode=COMBINE_MODE_MOMENT)

    await combine_mod.run_moment_combine(job_id, "这件合作要不要接？", methods, {})

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded and job.error is None
    assert job.completed == job.total == 3
    assert job.case_id is None                       # 当下事合参没有档案

    # 逐法起卦：塔罗走 /tarot，其余走 /divination
    assert [c["method"] for c in calls if c["kind"] == "divination"] == ["ssgw", "liuyao"]
    assert [c["spreadType"] for c in calls if c["kind"] == "tarot"] == ["single"]

    rows = _div_rows(uid)
    assert sorted(r.method for r in rows) == sorted(methods)
    assert all(r.case_id is None and r.result_json for r in rows)
    assert all(r.seed_json.get("question") == "这件合作要不要接？" for r in rows)

    # **只调 1 次 LLM**（起卦零 LLM）
    assert fake.calls == 1
    assert "不推前世" in fake.systems[0]
    assert "综合判断" in fake.systems[0]              # 骨架由代码追加进 system prompt

    rj = job.result_json
    assert rj["phase"] == "moment-combine"
    assert rj["report"]["summary"] == _MOMENT_LLM_OK["summary"]
    assert [s["title"] for s in rj["report"]["sections"]] == MOMENT_REPORT_TITLES
    assert [s["description"] for s in rj["report"]["sections"]] == \
        [s["description"] for s in _MOMENT_LLM_OK["sections"]]
    assert rj["label"] == "三法合参"
    assert rj["reportTitles"] == MOMENT_REPORT_TITLES
    assert [c["method"] for c in rj["castings"]] == methods
    assert rj["failed_methods"] == []

    # 1 次 LLM → 1 次扣费（ref = job:{id}，两段式）
    rows_tx = _consumes(uid)
    assert len(rows_tx) == 1
    assert rows_tx[0].ref == f"job:{job_id}"
    assert rows_tx[0].tokens == 1_000_000


async def test_moment_combine_tolerant_of_plain_text_llm_output(monkeypatch):
    """模型没照 JSON 给 → 解读不丢（summary 收原文、sections 空），job 仍 succeeded。"""
    import app.api.combine as combine_mod

    _stub_casts(monkeypatch)

    async def fake_chat(messages, **kwargs):
        return {"content": "这件事可以先谈，但要白纸黑字。",
                "usage": {"total_tokens": 0}, "model": "mock"}

    monkeypatch.setattr(combine_mod, "chat", fake_chat)
    uid = _new_user()
    job_id = _create_job(uid, None, JobType.moment_combine, 2,
                         method_keys=["ssgw", "shengbei"], combine_mode=COMBINE_MODE_MOMENT)

    await combine_mod.run_moment_combine(job_id, "要不要现在谈？", ["ssgw", "shengbei"], {})

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.result_json["report"]["summary"] == "这件事可以先谈，但要白纸黑字。"
    assert job.result_json["report"]["sections"] == []


async def test_moment_combine_all_cast_failed_marks_job_failed(monkeypatch):
    """起卦全失败 → job failed（不返回半成品），且不调 LLM。"""
    import app.api.combine as combine_mod

    _stub_casts(monkeypatch, fail=True)
    fake = _FakeChat(moment_payload=_MOMENT_LLM_OK)
    monkeypatch.setattr(combine_mod, "chat", fake.chat)

    uid = _new_user()
    methods = ["ssgw", "liuyao"]
    job_id = _create_job(uid, None, JobType.moment_combine, len(methods),
                         method_keys=methods, combine_mode=COMBINE_MODE_MOMENT)

    await combine_mod.run_moment_combine(job_id, "问一件事", methods, {})

    job = _load_job(job_id)
    assert job.status == JobStatus.failed
    assert "起卦服务不可用" in (job.error or "")
    assert fake.calls == 0
    assert _div_rows(uid) == []


def test_moment_endpoint_validation(combine_client, monkeypatch):
    """端点参数校验：空 question / 非法 key / cast 含未请求方法 → 400。"""
    import app.api.combine as combine_mod

    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr(combine_mod, "run_moment_combine", _noop)
    uid = _new_user()
    h = _auth_header(uid)

    ok = combine_client.post("/api/combine/moment", headers=h,
                             json={"question": "这事能成吗", "methods": ["ssgw", "tarot"]})
    assert ok.status_code == 202, ok.text
    assert ok.json()["data"]["label"] == "二法合参"
    assert ok.json()["data"]["total"] == 2

    blank = combine_client.post("/api/combine/moment", headers=h,
                                json={"question": "   ", "methods": ["ssgw"]})
    assert blank.status_code == 400, blank.text

    bad_key = combine_client.post("/api/combine/moment", headers=h,
                                  json={"question": "这事能成吗", "methods": ["sign"]})
    assert bad_key.status_code == 400, bad_key.text

    bad_cast = combine_client.post("/api/combine/moment", headers=h,
                                   json={"question": "这事能成吗", "methods": ["ssgw"],
                                         "cast": {"tarot": {"spreadType": "single"}}})
    assert bad_cast.status_code == 400, bad_cast.text


# --------------------------------------------------------------------------- #
# 9. GET /api/jobs/{id}：新增三键、旧键一个不少
# --------------------------------------------------------------------------- #
def test_get_job_adds_three_keys_without_losing_old_ones(combine_client):
    uid = _new_user()
    job_id = _create_job(uid, None, JobType.moment_combine, 6,
                         method_keys=list(MOMENT_POOL_KEYS)[:6],
                         combine_mode=COMBINE_MODE_MOMENT)
    resp = combine_client.get(f"/api/jobs/{job_id}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    # 旧键一个不少
    assert set(data) >= {"jobId", "status", "completed", "total", "result", "error"}
    assert data["jobId"] == str(job_id)
    # 新增三键
    assert data["label"] == "六法合参"
    assert data["methodKeys"] == list(MOMENT_POOL_KEYS)[:6]
    assert data["reportTitles"] == MOMENT_REPORT_TITLES


def test_get_job_legacy_row_still_answers(combine_client):
    """老 job（无 combine_mode / method_keys）→ 按命盘合参口径兜底，不报错、不少键。"""
    uid = _new_user()
    job_id = _create_job(uid, None, JobType.duan_qian_chen, 8)   # method_keys/combine_mode 均 None
    resp = combine_client.get(f"/api/jobs/{job_id}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["label"] == "八法合一"
    assert data["methodKeys"] == []
    assert data["reportTitles"] == REPORT_TITLES


# --------------------------------------------------------------------------- #
# 11. 逐法解读 / 档案列表：按「实际所选方法集」而不是写死注册表
# --------------------------------------------------------------------------- #
def _add_method_row(cid: int, uid: int, key: str, phase, payload: dict | None) -> None:
    from app.models import MethodResult

    session = AnalyticsSession()
    try:
        session.add(MethodResult(case_id=cid, user_id=uid, method_key=key, phase=phase,
                                 result_json=payload, validation_json=None, cached=False))
        session.commit()
    finally:
        session.close()


def test_readings_follow_selected_method_set(combine_client, stub_dqc_orchestrator):
    """选了 3 法只展示 3 条；所选但无结果的法进 degraded；未选的法不出现也不进 degraded。"""
    from app.models import Phase

    uid = _new_user()
    cid = _new_case(uid)
    h = _auth_header(uid)
    picked = ["bazi-pattern", "ziwei", "xizhan"]
    combine_client.post(f"/api/cases/{cid}/duan-qian-chen",
                        json={"methods": picked}, headers=h)

    _add_method_row(cid, uid, "bazi-pattern", Phase.duan_qian_chen,
                    {"method": "bazi-pattern", "past_propositions": [{"domain": "事业"}]})
    _add_method_row(cid, uid, "xizhan", Phase.duan_qian_chen,
                    {"method": "xizhan", "past_propositions": []})

    data = combine_client.get(f"/api/cases/{cid}/readings", headers=h).json()["data"]
    keys = [m["method_key"] for m in data["methods"]]
    assert keys == ["bazi-pattern", "xizhan"]      # 顺序 = 池顺序；ziwei 无结果进 degraded
    assert data["degraded"] == ["ziwei"]
    assert "wuyun-liuqi" not in keys and "wuyun-liuqi" not in data["degraded"]


def test_case_list_total_methods_follows_recorded_set(combine_client, stub_dqc_orchestrator):
    """档案列表进度分母 = 该 case 最近一次断前尘的方法集大小（合参可选子集）。"""
    uid = _new_user()
    cid = _new_case(uid)
    h = _auth_header(uid)

    # 无 job 记录 → 池全量兜底
    cases = combine_client.get("/api/cases", headers=h).json()["data"]["cases"]
    assert [c for c in cases if c["caseId"] == str(cid)][0]["totalMethods"] == 9

    combine_client.post(f"/api/cases/{cid}/duan-qian-chen",
                        json={"methods": ["bazi-pattern", "ziwei"]}, headers=h)
    cases = combine_client.get("/api/cases", headers=h).json()["data"]["cases"]
    assert [c for c in cases if c["caseId"] == str(cid)][0]["totalMethods"] == 2


# --------------------------------------------------------------------------- #
# 12. 合成器骨架：缺省零变化
# --------------------------------------------------------------------------- #
def _v2_sample(method: str) -> dict:
    return {
        "method": method, "phase": "prediction",
        "conclusions": [{"direction": "吉", "domain": "事业", "claim": f"{method} 看好",
                         "confidence_level": "high", "evidence": ["盘面"], "risks": []}],
    }


async def test_synthesize_default_skeleton_is_unchanged():
    results = [_v2_sample(k) for k in NATAL_POOL_KEYS[:3]]
    decision = {"main_methods": list(NATAL_POOL_KEYS[:3]), "support_methods": []}

    default = await synthesize(results, decision)
    assert [d["title"] for d in default["details"]] == REPORT_TITLES

    # 显式传骨架才换（当下事合参用 5 板块）；骨架外的 domain 仍追加在末尾（不丢信息）
    moment = await synthesize(results, decision, report_titles=MOMENT_REPORT_TITLES)
    titles = [d["title"] for d in moment["details"]]
    assert titles[:5] == MOMENT_REPORT_TITLES
    assert titles[5:] == ["事业"]                     # 归一化 domain 不在 5 板块内 → 末尾追加
    assert REPORT_TITLES == ["综合趋势", "性格", "事业", "财运", "感情", "健康", "家庭", "大势"]


async def test_synthesize_empty_results_unchanged():
    assert await synthesize([], {}) == {"summary": "暂无分析结果", "trend": "平", "details": []}
