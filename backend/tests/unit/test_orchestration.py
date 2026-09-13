# -*- coding: utf-8 -*-
"""编排回归测试（backend/tests/unit/test_orchestration.py）。

全 mock、零真实 DeepSeek 调用。mock 点按 Phase 4 既定纪律：
  - `app.methods.base.chat`（analyze_method 内部使用的模块级 chat）
  - `app.validation.validator.chat`（validate 内部使用的模块级 chat）
二者替换为 fake 协程后，orchestrator（app.jobs.orchestrator）经 ANALYZERS /
validate 到达的全部 LLM 调用均被拦截；`from app.llm import chat` 的导入方分别是
base / validator 各自的模块命名空间，故 patch 两个模块属性即可覆盖 8 法分析 + 校验。

覆盖（tests/README.md TDD 清单的编排部分）：
  - 断前尘 8 法串行全成功落库 + 合成问卷（含 failed_methods==[]）
  - 预测：路由(1 条 RouteDecision) + total=5 并行 + 免责声明
  - 缓存复用：同 case 二次断前尘零 LLM、8 行全 cached=True
  - 降级跳过：chart.degraded_methods 含 ziwei → 不产行、不调 LLM
  - 单法失败不中止：ziwei 抛 LLMError → job 仍 succeeded、failed_methods 记 ziwei、其余 7 法落库
"""
from __future__ import annotations

import json

import pytest

from app.database import AnalyticsSession
from app.jobs.orchestrator import run_duan_qian_chen, run_predict
from app.llm import LLMError
from app.models import (
    Job,
    JobStatus,
    JobType,
    MethodResult,
    Phase,
    RouteDecision,
)


# --------------------------------------------------------------------------- #
# 工具：建 Job + 可计数/可定向失败的 fake LLM
# --------------------------------------------------------------------------- #
def _create_job(uid: int, cid: int, job_type: JobType, total: int) -> int:
    session = AnalyticsSession()
    try:
        job = Job(
            case_id=cid,
            user_id=uid,
            type=job_type,
            status=JobStatus.pending,
            total=total,
            completed=0,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return job.id
    finally:
        session.close()


class FakeLLM:
    """替身协程：同时可作 analyze / validate 的 chat，按调用来源记账。

    analyze 的 user message 是含 "method_key" 的 JSON（见 base.analyze_method）；
    validate 的 user message 是含 "method_result" 的 JSON（见 validator.validate）。
    据此区分两条链路并逐 key 计数。
    """

    def __init__(self, fail_key: str | None = None):
        self.fail_key = fail_key
        self.analyze_calls: list[str] = []    # analyze 链路每调一次记一个 method_key
        self.validate_calls: list[str] = []   # validate 链路每调一次记一个 method_key

    async def chat(self, messages, *, model=None, json_mode=False, **kwargs):
        user_text = messages[-1]["content"]
        payload = json.loads(user_text)

        if "method_key" in payload:  # ---- analyze 链路 ----
            key = payload["method_key"]
            # 先记账再失败：analyze_calls 表示"被尝试调用过"，便于失败用例断言
            self.analyze_calls.append(key)
            if key == self.fail_key:
                raise LLMError(f"mock LLM 调用失败 method_key={key}", status=500)
            content = json.dumps(
                {
                    "method": key,
                    "phase": payload.get("phase"),
                    "past_propositions": [
                        {
                            "year_range": "2020",
                            "domain": "事业",
                            "claim": f"{key}: 该流年有升职动向",
                            "confidence_level": "high",
                            "confidence_reason": "reason",
                            "basis": ["依据一"],
                        }
                    ],
                    "conclusions": [
                        {
                            "direction": "吉",
                            "domain": "事业",
                            "claim": "事业运势上扬",
                            "confidence_level": "medium",
                            "evidence": ["证据一"],
                            "risks": [],
                        }
                    ],
                },
                ensure_ascii=False,
            )
            return {
                "content": content,
                "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
                "model": "mock",
            }

        # ---- validate 链路 ----
        mr = payload.get("method_result") or {}
        key = mr.get("method") or "unknown"
        self.validate_calls.append(key)
        content = json.dumps({"validations": []}, ensure_ascii=False)
        return {
            "content": content,
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "model": "mock",
        }


def _patch_chat(monkeypatch, fake: FakeLLM) -> None:
    """按 Phase 4 纪律替换两个模块属性（base / validator 各持一份 chat 引用）。"""
    monkeypatch.setattr("app.methods.base.chat", fake.chat)
    monkeypatch.setattr("app.validation.validator.chat", fake.chat)


def _load_job(job_id: int) -> Job:
    session = AnalyticsSession()
    try:
        return session.query(Job).filter_by(id=job_id).first()
    finally:
        session.close()


def _dqc_rows(cid: int, uid: int) -> list[MethodResult]:
    session = AnalyticsSession()
    try:
        return (
            session.query(MethodResult)
            .filter_by(case_id=cid, user_id=uid, phase=Phase.duan_qian_chen)
            .all()
        )
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 1. 断前尘全链路：8 法成功
# --------------------------------------------------------------------------- #
async def test_duan_qian_chen_orchestration(paipan_case, monkeypatch):
    fake = FakeLLM()
    _patch_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()

    job_id = _create_job(uid, cid, JobType.duan_qian_chen, total=8)
    await run_duan_qian_chen(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.completed == 8
    assert job.error is None

    rows = _dqc_rows(cid, uid)
    assert len(rows) == 8, f"8 法均应落库，实际 {len(rows)} 行"
    for row in rows:
        assert row.result_json, f"{row.method_key} result_json 不应为空"
        assert row.validation_json is not None, f"{row.method_key} validation_json 不应为空"

    rj = job.result_json
    assert rj is not None and rj.get("propositions"), "合成问卷 propositions 应为非空"
    assert rj["method_count"] == 8
    assert rj["failed_methods"] == []

    # 全 mock 链路核对：8 次 analyze + 8 次 validate
    assert len(fake.analyze_calls) == 8
    assert len(fake.validate_calls) == 8


# --------------------------------------------------------------------------- #
# 2. 预测：路由 + 并行扇出 + 合成 + 免责声明
# --------------------------------------------------------------------------- #
async def test_predict_orchestration(paipan_case, monkeypatch):
    fake = FakeLLM()
    _patch_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()

    job_id = _create_job(uid, cid, JobType.predict, total=0)
    await run_predict(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.completed == job.total == 5

    session = AnalyticsSession()
    try:
        route_rows = (
            session.query(RouteDecision)
            .filter_by(case_id=cid, user_id=uid)
            .all()
        )
        pred_rows = (
            session.query(MethodResult)
            .filter_by(case_id=cid, user_id=uid, phase=Phase.prediction)
            .all()
        )
    finally:
        session.close()
    assert len(route_rows) == 1
    main_methods = route_rows[0].main_methods or []
    assert "bazi-pattern" in main_methods
    assert len(pred_rows) == 5, "预测阶段 5 法结果应落库"

    rj = job.result_json
    assert rj is not None
    assert rj["report"].get("trend"), "report.trend 应存在"
    assert rj["report"].get("summary"), "report.summary 应存在（免责由前端全局 DisclaimerFooter 负责，后端不再追加进 summary）"

    # 预测阶段只 analyze（不校验）
    assert len(fake.analyze_calls) == 5
    assert len(fake.validate_calls) == 0


# --------------------------------------------------------------------------- #
# 3. 断前尘缓存复用：二次跑零 LLM
# --------------------------------------------------------------------------- #
async def test_duan_qian_chen_cache_reuse(paipan_case, monkeypatch):
    fake = FakeLLM()
    _patch_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()

    first_job = _create_job(uid, cid, JobType.duan_qian_chen, total=8)
    await run_duan_qian_chen(first_job)
    calls_after_first = (len(fake.analyze_calls), len(fake.validate_calls))
    assert calls_after_first == (8, 8)

    second_job = _create_job(uid, cid, JobType.duan_qian_chen, total=8)
    await run_duan_qian_chen(second_job)

    # 第二次零 LLM：计数器不增长
    assert (len(fake.analyze_calls), len(fake.validate_calls)) == calls_after_first, \
        "缓存复用应零 LLM 调用"

    job2 = _load_job(second_job)
    assert job2.status == JobStatus.succeeded
    assert job2.completed == 8

    rows = _dqc_rows(cid, uid)
    assert len(rows) == 8
    assert all(r.cached for r in rows), "二次运行的 8 行应全部 cached==True"
    for row in rows:
        assert row.result_json, "缓存行 result_json 应保留"


# --------------------------------------------------------------------------- #
# 4. 降级跳过：degraded_methods 含 ziwei
# --------------------------------------------------------------------------- #
async def test_degraded_skip(paipan_case, monkeypatch):
    fake = FakeLLM()
    _patch_chat(monkeypatch, fake)
    uid, cid, _chart, deg = paipan_case(degraded_methods=["ziwei"])
    assert "ziwei" in deg

    job_id = _create_job(uid, cid, JobType.duan_qian_chen, total=8)
    await run_duan_qian_chen(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded
    assert job.completed == 8  # 降级法只推进度不调 LLM

    rows = _dqc_rows(cid, uid)
    keys = [r.method_key for r in rows]
    assert len(keys) == 7
    assert "ziwei" not in keys
    assert "ziwei" not in fake.analyze_calls, "降级方法不应被 analyze 调用"
    assert "ziwei" not in fake.validate_calls


# --------------------------------------------------------------------------- #
# 5. 单法失败不中止整体：ziwei 抛 LLMError
# --------------------------------------------------------------------------- #
async def test_single_method_failure_not_abort(paipan_case, monkeypatch):
    fake = FakeLLM(fail_key="ziwei")
    _patch_chat(monkeypatch, fake)
    uid, cid, _chart, _deg = paipan_case()

    job_id = _create_job(uid, cid, JobType.duan_qian_chen, total=8)
    await run_duan_qian_chen(job_id)

    job = _load_job(job_id)
    assert job.status == JobStatus.succeeded, "单法失败不应使整体失败"
    assert job.completed == 8

    rj = job.result_json
    assert rj is not None
    assert "ziwei" in (rj.get("failed_methods") or []), "failed_methods 应含 ziwei"
    assert rj.get("method_count") == 7, "成功落库 7 法"

    rows = _dqc_rows(cid, uid)
    keys = [r.method_key for r in rows]
    assert len(keys) == 7
    assert "ziwei" not in keys
    assert "ziwei" in fake.analyze_calls, "ziwei 应被尝试调用过一次（然后失败）"
    assert "ziwei" not in fake.validate_calls
