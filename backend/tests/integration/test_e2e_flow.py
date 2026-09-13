# -*- coding: utf-8 -*-
"""端到端主流程集成测试（backend/tests/integration/test_e2e_flow.py）。

在真实 FastAPI app（app.main.app）+ 真实异步编排（端点内 asyncio.create_task
后台任务，跑在 TestClient 的事件循环里）上串起完整主链路：

    register → create case → paipan → duan-qian-chen(异步9法+逐法校验)
    → calibration(真实打分) → predict(异步路由+扇出+合成) → revise(修正对话)
    → archive(归档聚合)

最后直接查临时 analytics 库做落库断言（DB 为唯一事实源），覆盖端到端闭环。

零真实 DeepSeek 调用：按 Phase 4 既定纪律，monkeypatch 三处模块级 `chat`：
  - app.methods.base.chat            （8 法分析，analyze_method 内部调用点）
  - app.validation.validator.chat     （断前尘逐法校验，validate 内部调用点）
  - app.api.cases.chat                （修正对话，revise 内部调用点）
fake_chat 按最后一条 user 消息 JSON 的内容分派三条链路（分析/校验/对话），
与三处真实调用点互不污染：三个模块各自持有自己的模块级 chat 引用。

DB 隔离由 tests/conftest.py 负责（MINGLI_DB_PATH / MINGLI_FEEDBACK_DB_PATH
在一切 app import 之前指向临时 sqlite），本测试绝不触碰真实库。
"""
from __future__ import annotations

import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import AnalyticsSession
from app.main import app
from app.models import (
    Calibration,
    Conversation,
    Job,
    JobStatus,
    JobType,
    MethodResult,
    Phase,
)

# 测试生辰（虚构数据，与 tests/fixtures/chart.json 同源；含经纬度 ⇒ 完整盘零降级）
CREATE_CASE_BODY = {
    "birth_year": 1990,
    "birth_month": 5,
    "birth_day": 12,
    "birth_hour": 14,
    "gender": "male",
    "birthplace": "北京",
    "longitude": 116.4,
    "latitude": 39.9,
    "question": "事业运势",
}


async def fake_chat(messages, **kw):
    """三合一假 LLM：按最后一条 user 消息 JSON 内容分派分析/校验/对话。

    - 含 "method_result"            → 校验链路（validator.validate），返回空 validations；
    - payload.phase ∈ (duan-qian-chen, prediction) → 分析链路（base.analyze_method），
      返回 method-result v2（prediction 阶段附带 conclusions）；
    - 其余（question/chart_summary/history）→ 修正对话（revise），返回自然语言文本。
    """
    last = messages[-1]["content"] if messages else ""
    try:
        payload = json.loads(last)
    except Exception:
        payload = {}
    if "method_result" in payload:  # 校验（断前尘逐法 validate）
        content = json.dumps({"validations": []}, ensure_ascii=False)
    elif payload.get("phase") in ("duan-qian-chen", "prediction"):  # 分析（analyze_method）
        ph = payload["phase"]
        content = json.dumps({
            "method": payload.get("method_key", "x"),
            "phase": ph,
            "past_propositions": [
                {
                    "year_range": "2019-2021",
                    "domain": "事业",
                    "claim": "mock命题",
                    "confidence_level": "high",
                    "confidence_reason": "r",
                    "basis": ["b"],
                }
            ],
            "conclusions": [
                {
                    "direction": "吉",
                    "domain": "事业",
                    "claim": "mock结论",
                    "confidence_level": "medium",
                    "evidence": ["e"],
                    "risks": [],
                }
            ] if ph == "prediction" else [],
        }, ensure_ascii=False)
    else:  # 修正对话（revise，非 json_mode，自然语言）
        content = "这是修正回复。"
    return {
        "content": content,
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        "model": "mock",
    }


@pytest.fixture()
def e2e_client(monkeypatch, orchestration_env):
    """端到端复用夹具：patch 三处 chat + 进入 TestClient 生命周期。

    `with TestClient(app)` 保证 lifespan 启动、且后台 asyncio.create_task
    编排任务跑在同一个持续存活的事件循环里（同步轮询即可等到终态）。
    """
    monkeypatch.setattr("app.methods.base.chat", fake_chat)
    monkeypatch.setattr("app.validation.validator.chat", fake_chat)
    monkeypatch.setattr("app.api.cases.chat", fake_chat)
    with TestClient(app) as client:
        yield client


def _wait_job(client: TestClient, headers: dict, job_id: str, rounds: int = 100) -> dict:
    """同步轮询 job 至终态（succeeded/failed），返回 jobs 响应的 data。"""
    for _ in range(rounds):
        resp = client.get(f"/api/jobs/{job_id}", headers=headers)
        assert resp.status_code == 200, f"查询 job 失败: {resp.status_code} {resp.text}"
        body = resp.json()
        assert body.get("code") == 0, body
        data = body["data"]
        if data["status"] in ("succeeded", "failed"):
            return data
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} 在 {rounds} 轮轮询内未进入终态")


# --------------------------------------------------------------------------- #
# 端到端主流程
# --------------------------------------------------------------------------- #
def test_full_main_flow(e2e_client):
    client = e2e_client

    # 1) register：裸 TokenResponse（非信封），拿 access_token 构造鉴权头
    #    注册需图形验证码：先 GET /api/auth/captcha 拿到 captcha_id，再白盒读进程内
    #    内存 _store 取明文（单进程内存验证码，属测试内部实现细节），带上后再注册。
    username = f"e2e_{uuid.uuid4().hex[:10]}"
    cap_resp = client.get("/api/auth/captcha")
    assert cap_resp.status_code == 200, cap_resp.text
    cap_body = cap_resp.json()
    assert cap_body["code"] == 0, cap_body
    cap_data = cap_body["data"]
    assert cap_data["image"].startswith("data:image/png;base64,"), cap_data["image"][:40]
    from app.auth.captcha import _store

    captcha_id = cap_data["captcha_id"]
    captcha_code = _store[captcha_id][0]
    resp = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": "pass1234",
            "captcha_id": captcha_id,
            "captcha_code": captcha_code,
        },
    )
    assert resp.status_code == 200, resp.text
    token_body = resp.json()
    assert isinstance(token_body, dict) and "access_token" in token_body, (
        "register 应返回裸 token 对象"
    )
    headers = {"Authorization": f"Bearer {token_body['access_token']}"}

    # 2) create case：建档（带经纬度 + 主问）
    resp = client.post("/api/cases", json=CREATE_CASE_BODY, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0, body
    case_id = int(body["data"]["caseId"])

    # 3) paipan：确定性排盘，完整盘 ⇒ degradedMethods == []
    resp = client.post(f"/api/cases/{case_id}/paipan", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0, body
    data = body["data"]
    assert data["caseId"] == str(case_id)
    assert data["degradedMethods"] == [], f"完整盘不应降级: {data['degradedMethods']}"
    assert data["chart"]["dayMaster"], "chart.dayMaster 应存在"

    # 4) duan-qian-chen：202 + 后台 8 法串行分析 + 逐法校验；同步轮询到 succeeded
    resp = client.post(f"/api/cases/{case_id}/duan-qian-chen", headers=headers)
    assert resp.status_code == 202, resp.text
    dqc_job_id = resp.json()["data"]["jobId"]
    dqc_data = _wait_job(client, headers, dqc_job_id)
    assert dqc_data["status"] == "succeeded", f"断前尘任务失败: {dqc_data}"
    assert dqc_data["total"] == 8
    dqc_result = dqc_data["result"]
    assert dqc_result and dqc_result.get("propositions"), (
        f"断前尘问卷 propositions 应为非空: {dqc_result}"
    )

    # 5) calibration：提交确认反馈 → 真实三因子打分（fit 必存在）
    resp = client.post(
        f"/api/cases/{case_id}/calibration",
        json={"feedback": [
            {"method": "bazi-pattern", "domain": "事业", "claim": "x",
             "feedback": "confirmed"},
        ]},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    cal_body = resp.json()
    assert cal_body["code"] == 0, cal_body
    assert cal_body["data"]["fit"] is not None, "calibration data.fit 应存在"
    assert len(cal_body["data"]["rows"]) >= 1

    # 6) predict：202 + 后台 路由(事业财运) + 并行扇出；轮询到 succeeded 拿 report
    resp = client.post(f"/api/cases/{case_id}/predict", headers=headers)
    assert resp.status_code == 202, resp.text
    pred_job_id = resp.json()["data"]["jobId"]
    pred_data = _wait_job(client, headers, pred_job_id)
    assert pred_data["status"] == "succeeded", f"预测任务失败: {pred_data}"
    assert pred_data["result"] and pred_data["result"].get("report"), (
        f"预测 report 应存在: {pred_data.get('result')}"
    )

    # 7) revise：修正对话（真实历史 + chart 摘要 → chat → 落两行）
    resp = client.post(
        f"/api/cases/{case_id}/revise", json={"message": "再问"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    rev_body = resp.json()
    assert rev_body["code"] == 0, rev_body
    assert rev_body["data"]["reply"], "revise reply 应为非空"

    # 8) archive：归档聚合（chart / conversations 必须存在）
    resp = client.get(f"/api/cases/{case_id}/archive", headers=headers)
    assert resp.status_code == 200, resp.text
    arch_body = resp.json()
    assert arch_body["code"] == 0, arch_body
    arch = arch_body["data"]
    assert arch["chart"] is not None, "archive chart 应存在"
    assert isinstance(arch["conversations"], list) and arch["conversations"], (
        "archive conversations 应存在且非空"
    )
    assert arch["caseId"] == str(case_id)

    # 9) 落库断言：DB 为唯一事实源（临时 analytics 库，conftest 隔离）
    session = AnalyticsSession()
    try:
        jobs = (
            session.query(Job)
            .filter_by(case_id=case_id)
            .order_by(Job.id.asc())
            .all()
        )
        assert len(jobs) == 2, f"应有 duan-qian-chen + predict 两条 job: {len(jobs)}"
        by_type = {j.type: j for j in jobs}
        assert by_type[JobType.duan_qian_chen].status == JobStatus.succeeded
        assert by_type[JobType.predict].status == JobStatus.succeeded
        user_id = jobs[0].user_id

        dqc_rows = (
            session.query(MethodResult)
            .filter_by(case_id=case_id, user_id=user_id, phase=Phase.duan_qian_chen)
            .all()
        )
        assert len(dqc_rows) == 8, f"断前尘 8 法结果应全部落库: {len(dqc_rows)}"
        assert all(r.result_json for r in dqc_rows), "断前尘各行 result_json 不应为空"
        assert all(r.validation_json is not None for r in dqc_rows), (
            "断前尘各行 validation_json 不应为空"
        )

        pred_rows = (
            session.query(MethodResult)
            .filter_by(case_id=case_id, user_id=user_id, phase=Phase.prediction)
            .all()
        )
        assert len(pred_rows) >= 1, "预测阶段结果应落库 ≥1 行"

        assert (
            session.query(Calibration).filter_by(case_id=case_id).count() == 1
        ), "Calibration 应恰有 1 行"
        assert (
            session.query(Conversation).filter_by(case_id=case_id).count() >= 2
        ), "Conversation 应 ≥2 行（一次 revise 落 user+assistant 两行）"
    finally:
        session.close()
