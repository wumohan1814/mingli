"""任务编排器（Phase 4 · ADR-0005 异步编排）。

- run_duan_qian_chen：9 法**串行** + 每法真实校验，逐法 commit 进度；
- run_predict：路由选法后**并行扇出**（不校验），合并合成 + 免责声明。

每个函数在后台 task 内用独立 `AnalyticsSession()` 开/关，不依赖请求级 session。
多用户隔离：所有查询/落库都带 job 的 case_id + user_id。

单法 LLMError/ValueError 只记入 failed_methods（断前尘/预测都不因单法整体崩）；
其余未捕获异常 → job.status=failed、job.error=str(e)。
"""
from __future__ import annotations

import asyncio
import logging

from app.compliance.guardrails import append_disclaimer, check_output
from app.database import AnalyticsSession
from app.llm import LLMError
from app.llm.client import get_usage, reset_usage
from app.methods import ANALYZERS, METHOD_KEYS
from app.models import (
    Case,
    Chart,
    Job,
    JobStatus,
    MethodResult,
    Phase,
    RouteDecision,
)
from app.paipan import slice_chart
from app.routing.router import route
from app.synthesis.synthesizer import synthesize
from app.validation.validator import validate

logger = logging.getLogger(__name__)

DQC_PHASE = Phase.duan_qian_chen
PRED_PHASE = Phase.prediction

# 问卷收集时只保留的置信度
_KEEP_CONFIDENCE = {"high", "medium"}
# 问卷条数上限
_MAX_PROPOSITIONS = 10


def _build_slices(chart: dict) -> dict[str, dict]:
    """缺省 8 片 + 补 bazi-hunyin-caiyun 第 9 片，合并成 key → fragment。"""
    slices = slice_chart(chart)
    slices.update(slice_chart(chart, methods=["bazi-hunyin-caiyun"]))
    return slices


def _query_common(session, job_id: int) -> tuple[Job, Case, Chart]:
    """读 Job（按 id）及其 Case / Chart；任一缺失抛 RuntimeError（→ job failed）。"""
    job = session.query(Job).filter_by(id=job_id).first()
    if job is None:
        raise RuntimeError(f"Job 不存在: job_id={job_id}")
    case = session.query(Case).filter_by(id=job.case_id).first()
    if case is None:
        raise RuntimeError(f"Case 不存在: case_id={job.case_id} job_id={job_id}")
    chart_row = session.query(Chart).filter_by(case_id=job.case_id).first()
    if chart_row is None:
        raise RuntimeError(f"Chart 不存在: case_id={job.case_id} job_id={job_id}")
    return job, case, chart_row


def _user_question(case: Case) -> str:
    if isinstance(case.input_json, dict) and case.input_json.get("question"):
        return str(case.input_json["question"])
    return "事业运势"


# --------------------------------------------------------------------------- #
# 断前尘：9 法串行 + 校验
# --------------------------------------------------------------------------- #
async def run_duan_qian_chen(job_id: int) -> None:
    """断前尘编排：串行 9 法，逐法分析 + 真实校验 + 落库，最后合成问卷。"""
    session = AnalyticsSession()
    try:
        job, case, chart_row = _query_common(session, job_id)
        job.status = JobStatus.running
        session.commit()

        chart = chart_row.chart_json if isinstance(chart_row.chart_json, dict) else {}
        slices = _build_slices(chart)
        degraded = set(chart_row.degraded_methods or [])
        user_question = _user_question(case)

        reset_usage()
        failed_methods: list[str] = []

        # 串行遍历 9 个注册方法
        for key in METHOD_KEYS:
            if key in degraded or key not in ANALYZERS:
                # 整法跳过：不调 LLM，只推进度
                job.completed = (job.completed or 0) + 1
                session.commit()
                continue

            existing = (
                session.query(MethodResult)
                .filter_by(
                    case_id=job.case_id,
                    user_id=job.user_id,
                    method_key=key,
                    phase=DQC_PHASE,
                )
                .first()
            )
            # 缓存命中（result_json 非空）→ 复用，不调 LLM、不重跑校验
            if existing is not None and existing.result_json:
                existing.cached = True
                job.completed = (job.completed or 0) + 1
                session.commit()
                logger.info("断前尘缓存命中 method_key=%s job_id=%s", key, job_id)
                continue

            try:
                result = await ANALYZERS[key]("duan-qian-chen", slices.get(key), user_question)
                if not isinstance(result, dict):
                    # prompt 缺失 / slice 空 → 该方法降级，跳过落库
                    logger.warning("断前尘方法降级 method_key=%s（analyze 返回空）", key)
                    job.completed = (job.completed or 0) + 1
                    session.commit()
                    continue
                validation = await validate(result, slices.get(key))
            except (LLMError, ValueError) as exc:
                # 单法失败：记日志 + 记入 failed_methods，继续下一法
                failed_methods.append(key)
                logger.warning("断前尘单法失败，继续下一法 method_key=%s error=%s", key, exc)
                job.completed = (job.completed or 0) + 1
                session.commit()
                continue

            # 校验成功后落库（覆盖命中但 result 为空的残留行，避免重复行）
            if existing is not None:
                existing.result_json = result
                existing.validation_json = validation
                existing.cached = False
            else:
                session.add(
                    MethodResult(
                        case_id=job.case_id,
                        user_id=job.user_id,
                        method_key=key,
                        phase=DQC_PHASE,
                        result_json=result,
                        validation_json=validation,
                        cached=False,
                    )
                )
            job.completed = (job.completed or 0) + 1
            session.commit()

        # 合成问卷：收集本 case 全部已落库的断前尘结果（含本轮新写与历史缓存行）
        questionnaire = _compose_questionnaire(session, job, failed_methods)
        usage = get_usage()
        questionnaire["_usage"] = usage
        job.result_json = questionnaire
        job.completed = job.total if job.total is not None else job.completed
        job.status = JobStatus.succeeded
        session.commit()
        logger.info(
            "断前尘任务完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
            job_id, questionnaire.get("method_count"), failed_methods,
            usage.get("total_tokens"),
        )
    except Exception as exc:  # 任何未捕获异常 → failed
        try:
            session.rollback()
            job_ref = session.query(Job).filter_by(id=job_id).first()
            if job_ref is not None:
                job_ref.status = JobStatus.failed
                job_ref.error = str(exc)
                session.commit()
        except Exception as inner:  # pragma: no cover - 兜底日志
            logger.exception("断前尘任务失败后更新 job 状态也出错 job_id=%s", job_id)
            raise inner
        logger.exception("断前尘任务失败 job_id=%s", job_id)
        raise
    finally:
        session.close()


def _compose_questionnaire(session, job: Job, failed_methods: list[str]) -> dict:
    """从已落库 MethodResult 收集问卷。

    保留 confidence_level ∈ {high, medium} 的命题，按 domain 去重，最多 10 条。
    """
    rows = (
        session.query(MethodResult)
        .filter_by(case_id=job.case_id, user_id=job.user_id, phase=DQC_PHASE)
        .order_by(MethodResult.id.asc())
        .all()
    )
    propositions: list[dict] = []
    seen_domains: set[str] = set()
    for row in rows:
        rj = row.result_json if isinstance(row.result_json, dict) else {}
        for p in rj.get("past_propositions") or []:
            if not isinstance(p, dict):
                continue
            if p.get("confidence_level") not in _KEEP_CONFIDENCE:
                continue
            domain = str(p.get("domain") or "").strip()
            if not domain or domain in seen_domains:
                continue
            seen_domains.add(domain)
            propositions.append({
                "method": p.get("method") or row.method_key,
                "domain": domain,
                "claim": p.get("claim") or "",
                "year_range": p.get("year_range"),
                "confidence_level": p.get("confidence_level"),
            })
            if len(propositions) >= _MAX_PROPOSITIONS:
                break
        if len(propositions) >= _MAX_PROPOSITIONS:
            break
    return {
        "phase": "duan-qian-chen",
        "propositions": propositions,
        "method_count": len([r for r in rows if r.result_json]),
        "failed_methods": failed_methods,
    }


# --------------------------------------------------------------------------- #
# 预测：路由 + 并行扇出（不校验）+ 合成
# --------------------------------------------------------------------------- #
async def run_predict(job_id: int) -> None:
    """预测编排：路由选法 → 并行 analyze（不校验）→ synthesize + 免责声明。"""
    session = AnalyticsSession()
    try:
        job, case, chart_row = _query_common(session, job_id)
        job.status = JobStatus.running
        session.commit()

        chart = chart_row.chart_json if isinstance(chart_row.chart_json, dict) else {}
        slices = _build_slices(chart)
        degraded = set(chart_row.degraded_methods or [])
        user_question = _user_question(case)

        # 路由（零 LLM）：main + support 去重（保序）
        decision = route(user_question, Phase.prediction, degraded_methods=list(degraded))
        methods: list[str] = list(dict.fromkeys(decision["main_methods"] + decision["support_methods"]))
        job.total = len(methods)
        session.commit()

        # 落路由决策
        session.add(
            RouteDecision(
                case_id=job.case_id,
                user_id=job.user_id,
                phase=PRED_PHASE,
                main_methods=decision["main_methods"],
                support_methods=decision["support_methods"],
                reasons=decision["reasons"],
            )
        )
        session.commit()

        reset_usage()
        failed_methods: list[str] = []

        # 方法集合中可并行扇出的子集
        pending = [m for m in methods if m not in degraded and m in ANALYZERS]

        # 缓存预查（phase=prediction 的行），避免 gather 期间并发读写同一 session
        cache_rows = {
            r.method_key: r
            for r in session.query(MethodResult)
            .filter_by(case_id=job.case_id, user_id=job.user_id, phase=PRED_PHASE)
            .all()
        }

        async def _call_analyze(key: str):
            return await ANALYZERS[key]("prediction", slices.get(key), user_question)

        # 并行扇出：return_exceptions=True 兜底，单法异常不整体崩
        coros = {key: _call_analyze(key) for key in pending}
        if coros:
            outs = await asyncio.gather(*coros.values(), return_exceptions=True)
        else:
            outs = {}
        by_key = dict(zip(coros.keys(), outs)) if outs else {}

        results: list[dict] = []
        for key in methods:
            if key not in pending:
                continue
            cached = cache_rows.get(key)
            if cached is not None and cached.result_json:
                # 缓存命中 → 复用，不调 LLM
                cached.cached = True
                results.append(cached.result_json)
                continue
            out = by_key.get(key)
            if isinstance(out, BaseException):
                failed_methods.append(key)
                logger.warning("预测单法失败，继续其他法 method_key=%s error=%s", key, out)
                continue
            if not isinstance(out, dict) or not out:
                # prompt 缺失 / slice 空 → 该方法降级，跳过落库
                logger.warning("预测方法降级 method_key=%s（analyze 返回空）", key)
                continue
            results.append(out)
            if cached is not None:
                cached.result_json = out
                cached.validation_json = None
                cached.cached = False
            else:
                session.add(
                    MethodResult(
                        case_id=job.case_id,
                        user_id=job.user_id,
                        method_key=key,
                        phase=PRED_PHASE,
                        result_json=out,
                        validation_json=None,
                        cached=False,
                    )
                )
        session.commit()

        # 合成 + 合规拦截 + 免责声明（summary 与各条 description 文字）
        report = await synthesize(results, decision)
        _apply_compliance(report)
        _apply_disclaimer(report)

        usage = get_usage()
        job.result_json = {
            "phase": "prediction",
            "report": report,
            "_usage": usage,
            "failed_methods": failed_methods,
        }
        job.completed = job.total if job.total is not None else len(results)
        job.status = JobStatus.succeeded
        session.commit()
        logger.info(
            "预测任务完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
            job_id, len(results), failed_methods, usage.get("total_tokens"),
        )
    except Exception as exc:  # 任何未捕获异常 → failed
        try:
            session.rollback()
            job_ref = session.query(Job).filter_by(id=job_id).first()
            if job_ref is not None:
                job_ref.status = JobStatus.failed
                job_ref.error = str(exc)
                session.commit()
        except Exception as inner:  # pragma: no cover - 兜底日志
            logger.exception("预测任务失败后更新 job 状态也出错 job_id=%s", job_id)
            raise inner
        logger.exception("预测任务失败 job_id=%s", job_id)
        raise
    finally:
        session.close()


def _apply_compliance(report: dict) -> None:
    """对 report 文字字段做禁区词 / 确定结论拦截；命中则替换为安全兜底文案。"""
    if not isinstance(report, dict):
        return
    fallback = "该部分内容因合规原因未展示。"
    for text_field in ("summary", "description", "trend_text"):
        val = report.get(text_field)
        if isinstance(val, str) and val:
            is_safe, _msg = check_output(val)
            if not is_safe:
                report[text_field] = fallback
    for detail in report.get("details") or []:
        if isinstance(detail, dict) and isinstance(detail.get("description"), str) and detail["description"]:
            is_safe, _msg = check_output(detail["description"])
            if not is_safe:
                detail["description"] = fallback


def _apply_disclaimer(report: dict) -> None:
    """对 report 里的 summary / 文字字段追加免责声明（幂等，已有则跳过）。"""
    if isinstance(report, dict):
        for text_field in ("summary", "description", "trend_text"):
            val = report.get(text_field)
            if isinstance(val, str) and val:
                report[text_field] = append_disclaimer(val)
        for detail in report.get("details") or []:
            if isinstance(detail, dict) and isinstance(detail.get("description"), str) and detail["description"]:
                detail["description"] = append_disclaimer(detail["description"])
