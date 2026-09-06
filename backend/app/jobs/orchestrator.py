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
from app.credits.service import check_balance, consume
from app.database import AnalyticsSession
from app.errors import BizError, ERR_INSUFFICIENT_CREDIT
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


def _check_balance_or_fail(session, job: Job, label: str) -> bool:
    """计费预检（任务开头）：余额不足（BizError 5002）→ job=failed("积分不足")，
    commit 后返回 False（不跑 LLM）；余额充足返回 True。

    非 5002 的 BizError 原样上抛，交给外层 except 统一置 failed 并记录真实原因。
    """
    try:
        check_balance(job.user_id)
    except BizError as exc:
        if exc.code != ERR_INSUFFICIENT_CREDIT:
            raise
        job.status = JobStatus.failed
        job.error = "积分不足"
        session.commit()
        logger.warning("%s任务因积分不足未执行 job_id=%s user_id=%s",
                       label, job.id, job.user_id)
        return False
    return True


def _charge_after_run(job_id: int, user_id: int, total_tokens, label: str) -> None:
    """任务收尾计费：LLM 已调用，按实际 token 扣费；扣费失败只记日志不阻断
    成功落库（架构 §6.3：扣费失败但 LLM 已调用 → 记日志对账）。"""
    tokens = int(total_tokens or 0)
    if tokens <= 0:
        logger.info("%s无 LLM token 消耗，跳过扣费 job_id=%s", label, job_id)
        return
    try:
        consume(user_id, tokens, ref=f"job:{job_id}")
    except Exception as exc:
        logger.error("%s扣费失败 job_id=%s user_id=%s tokens=%s error=%s",
                     label, job_id, user_id, tokens, exc)


def _charge_method(user_id: int, tokens, ref: str) -> None:
    """逐法扣费：该法 LLM 已调用（usage 账本已累加）即按 tokens 扣积分。

    容错口径与 `_charge_after_run` 一致：扣费失败只记日志、不阻断任务进度。
    tokens <= 0（未产生消耗，如 LLMError 未成功返回）直接跳过。
    """
    tokens = int(tokens or 0)
    if tokens <= 0:
        return
    try:
        consume(user_id, tokens, ref=ref)
    except Exception as exc:
        logger.error("逐法扣费失败 user_id=%s tokens=%s ref=%s error=%s",
                     user_id, tokens, ref, exc)


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
        # 计费预检：余额不足 → failed，不跑 LLM
        if not _check_balance_or_fail(session, job, "断前尘"):
            return
        job.status = JobStatus.running
        session.commit()

        chart = chart_row.chart_json if isinstance(chart_row.chart_json, dict) else {}
        slices = _build_slices(chart)
        degraded = set(chart_row.degraded_methods or [])
        user_question = _user_question(case)

        reset_usage()
        failed_methods: list[str] = []
        llm_fail_streak = 0

        # 续跑检测（断点续跑语义）：统计该 case 该 phase 已落库非空结果的方法数。
        # 0 < done_count < total 说明是服务重启后中断续跑 → 对剩余方法注入
        # continuation 上下文（已完成方法仍走缓存命中跳过，不重复调 LLM）。
        done_rows = (
            session.query(MethodResult)
            .filter_by(case_id=job.case_id, user_id=job.user_id, phase=DQC_PHASE)
            .all()
        )
        done_count = sum(1 for r in done_rows if r.result_json)
        continuation = (
            "该档案之前的推演被服务器重启中断，请继续完成剩余方法的分析，不要重复已完成的结论。"
            if 0 < done_count < (job.total or 9)
            else None
        )

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

            # 逐法扣费：进入该法前快照进程内 usage 账本，方法处理完（成功或抛
            # ValueError——LLM 已成功返回但解析失败）后按差值立即扣费；
            # LLMError（chat 未成功返回，usage 未累加）差值通常为 0，不产生扣费。
            before = get_usage().get("total_tokens") or 0
            try:
                result = await ANALYZERS[key](
                    "duan-qian-chen", slices.get(key), user_question,
                    continuation=continuation,
                )
                if not isinstance(result, dict):
                    # prompt 缺失 / slice 空 → 该方法降级，跳过落库（未调 LLM，无 token 消耗）
                    logger.warning("断前尘方法降级 method_key=%s（analyze 返回空）", key)
                    job.completed = (job.completed or 0) + 1
                    session.commit()
                    continue
                validation = await validate(result, slices.get(key))
            except (LLMError, ValueError) as exc:
                # 单法失败：记日志 + 记入 failed_methods
                failed_methods.append(key)
                logger.warning("断前尘单法失败 method_key=%s error=%s", key, exc)
                job.completed = (job.completed or 0) + 1
                # 快速失败：连续 2 个方法都因 LLM 调用失败 → 判定服务不可用，停止后续方法，
                # 避免 9 法逐个重试（浪费 token + 时间）。ValueError（解析失败）不累计。
                if isinstance(exc, LLMError):
                    llm_fail_streak += 1
                    if llm_fail_streak >= 2:
                        job.status = JobStatus.failed
                        job.error = f"LLM 服务连续失败，已停止（最后错误：{exc}）"
                        session.commit()
                        logger.error("断前尘任务中止：LLM 连续失败 job_id=%s", job_id)
                        return
                else:
                    llm_fail_streak = 0
                session.commit()
                # 失败也按差值立即扣费：ValueError 时 LLM 已成功返回（usage 已累加）；
                # LLMError 差值通常为 0，由 _charge_method 内部跳过
                _charge_method(job.user_id, get_usage().get("total_tokens") - before,
                               f"job:{job_id}:{key}")
                continue

            # 成功路径（分析 + 校验均完成）：该法答案已生成 → 按差值立即扣费
            _charge_method(job.user_id, get_usage().get("total_tokens") - before,
                           f"job:{job_id}:{key}")

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
        # 计费预检：余额不足 → failed，不跑 LLM
        if not _check_balance_or_fail(session, job, "预测"):
            return
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

        # 续跑检测（与断前尘同语义）：0 < done_count < total 说明是服务重启后中断
        # 续跑 → 对本次 analyze 注入 continuation 上下文（已完成方法仍复用缓存结果）。
        done_count = sum(1 for r in cache_rows.values() if r.result_json)
        continuation = (
            "该档案之前的推演被服务器重启中断，请继续完成剩余方法的分析，不要重复已完成的结论。"
            if 0 < done_count < (job.total or 0)
            else None
        )

        async def _call_analyze(key: str):
            return await ANALYZERS[key](
                "prediction", slices.get(key), user_question,
                continuation=continuation,
            )

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

        # 合成 + 合规拦截（免责由前端全局 DisclaimerFooter 统一展示，不再追加进 report 文字）
        report = await synthesize(results, decision)
        _apply_compliance(report)

        usage = get_usage()
        job.result_json = {
            "phase": "prediction",
            "report": report,
            "_usage": usage,
            "failed_methods": failed_methods,
        }
        job.completed = job.total if job.total is not None else len(results)
        _charge_after_run(job_id, job.user_id, usage.get("total_tokens"), "预测")
        job.status = JobStatus.succeeded
        session.commit()
        logger.info(
            "预测任务完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
            job_id, len(results), failed_methods, usage.get("total_tokens"),
        )
    except Exception as exc:  # 任何未捕获异常 → failed
        try:
            session.rollback()
            # 尽力扣费：任务异常中断未走正常收尾，已消耗的 LLM token 仍按实际 usage
            # 尽力扣掉（失败只记日志，不阻断置 failed）
            try:
                _charge_after_run(job_id, job.user_id, get_usage().get("total_tokens"), "预测")
            except Exception as charge_exc:  # pragma: no cover - 兜底日志
                logger.error("预测异常兜底扣费失败 job_id=%s error=%s", job_id, charge_exc)
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
