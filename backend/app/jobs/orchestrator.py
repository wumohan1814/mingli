"""任务编排器（Phase 4 · ADR-0005 异步编排）。

- run_duan_qian_chen：8 法**并发**（每 job 3 并发限流）+ 每法真实校验，逐法扣费、原子推进度；
- run_predict：路由选法后**并发扇出**（不校验，同样 3 并发限流 + 逐法扣费），合并合成 + 免责声明。

每个函数在后台 task 内用独立 `AnalyticsSession()` 开/关，不依赖请求级 session。
**并发方法协程各自用独立短 `AnalyticsSession()`**，绝不复用主 session（并发协程共享同一
SQLAlchemy Session 会串数据）；主 session 只用于任务开头（`_query_common`/续跑检测/路由）与
gather 之后串行的收尾（合成问卷/落 job 状态）。写 `job.completed` 一律走 `_bump_completed`
（SQL `completed = completed + 1` 原子自增），避免并发读改写丢更新。

usage 账本：`app.llm.client` 用 contextvars.ContextVar 按 asyncio task 隔离——asyncio.gather
为每个协程复制 context，主 task 里 `reset_usage()` 后每个并发 method 协程从 0 各自累计，
协程内 `get_usage()` 快照差值 = 该法自己的 analyze(+validate) 消耗，逐法扣费精确
（ref=`job:{job_id}:{key}`）。主 task 的 contextvar 不含子协程累计，落库 `_usage` 用逐法
tokens 求和而非主 task 的 get_usage()。

并发上限两层信号量嵌套（每法协程先取全局、再取 per-job，退出反向释放）：
  - 模块级 `_global_llm_semaphore = asyncio.Semaphore(settings.llm_global_max_concurrency)`，
    默认 100：全局 method 并发兜底，跨所有用户、所有 job 同时进行的 method 总数；
  - per-job `asyncio.Semaphore(settings.llm_max_concurrency)`，默认 3：单用户（单 job）限流，
    每个 job 内新建，互不影响。

多用户隔离：所有查询/落库都带 job 的 case_id + user_id。

单法 LLMError/ValueError 只记入 failed_methods（断前尘/预测都不因单法整体崩）；
pending 非空且全部失败 → job.status=failed、job.error="LLM 服务不可用，全部方法失败"；
其余未捕获异常 → job.status=failed、job.error=str(e)。
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import update

from app.compliance.guardrails import check_output
from app.config import settings
from app.credits.service import check_balance, consume
from app.database import AnalyticsSession
from app.errors import BizError, ERR_INSUFFICIENT_CREDIT
from app.llm import LLMError
from app.llm.client import get_usage, reset_usage
from app.methods import ANALYZERS, METHOD_KEYS
from app.models import (
    Case,
    CaseStatus,
    Calibration,
    Chart,
    Job,
    JobStatus,
    MethodResult,
    Phase,
    RouteDecision,
)
from app.paipan import slice_chart
from app.paipan.marker import mark_chart
from app.routing.router import route
from app.synthesis.synthesizer import synthesize
from app.validation.validator import validate

logger = logging.getLogger(__name__)

# 模块级全局信号量：跨所有用户、所有 job 的 method 并发兜底上限
# （settings.llm_global_max_concurrency，默认 100）。语义：限「所有用户同时进行的
# method 总数」；与每个 job 内新建的 per-job 信号量（Semaphore(settings.llm_max_concurrency)，
# 默认 3，限单用户）嵌套使用，两层同时生效。asyncio.Semaphore 在 3.10+ 构造时不绑定
# event loop，模块导入期创建安全，首次 await acquire 时再绑定当前 loop。
_global_llm_semaphore = asyncio.Semaphore(settings.llm_global_max_concurrency)

DQC_PHASE = Phase.duan_qian_chen
PRED_PHASE = Phase.prediction

# 问卷收集时只保留的置信度
_KEEP_CONFIDENCE = {"high", "medium"}
# 问卷条数上限
_MAX_PROPOSITIONS = 10


def _check_balance_or_fail(session, job: Job, label: str) -> bool:
    """计费预检（任务开头）：余额不足（BizError 5002）→ job=failed("余额不足")，
    commit 后返回 False（不跑 LLM）；余额充足返回 True。

    非 5002 的 BizError 原样上抛，交给外层 except 统一置 failed 并记录真实原因。
    """
    try:
        check_balance(job.user_id)
    except BizError as exc:
        if exc.code != ERR_INSUFFICIENT_CREDIT:
            raise
        job.status = JobStatus.failed
        job.error = "余额不足"
        session.commit()
        logger.warning("%s任务因余额不足未执行 job_id=%s user_id=%s",
                       label, job.id, job.user_id)
        return False
    return True


def _charge_method(user_id: int, tokens, ref: str) -> None:
    """逐法扣费：该法 LLM 已调用（该协程 context 的 usage 账本已累加）即按 tokens 扣余额。

    容错口径与任务收尾一致：扣费失败只记日志、不阻断任务进度。
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


def _bump_completed(s, job_id: int) -> None:
    """原子推进 job.completed：SQL `completed = completed + 1` 在数据库内自增。

    并发方法协程各自用独立 session 调用本函数；不用「读 → +1 → 写」的读改写，
    避免并发丢更新。Job.completed 是 Integer 列，`Job.completed + 1` 生成原子 SQL。
    """
    s.execute(update(Job).where(Job.id == job_id).values(completed=Job.completed + 1))
    s.commit()


def _build_slices(chart: dict) -> dict[str, dict]:
    """缺省 8 片 + 补 bazi-hunyin-caiyun 第 9 片，合并成 key → fragment。

    节117 · 预判标记层：切片后注入确定性标记（`_markers` 字段），
    供各方法模块在解读时参考，降低幻觉面。
    """
    slices = slice_chart(chart)
    slices.update(slice_chart(chart, methods=["bazi-hunyin-caiyun"]))

    # 节117 · 计算预判标记并注入到各方法切片
    markers_by_method = mark_chart(chart)
    for key, markers in markers_by_method.items():
        if key in slices and markers:
            slices[key]["_markers"] = markers

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
# 断前尘：8 法并发（每 job 3 并发限流）+ 校验 + 逐法扣费
# --------------------------------------------------------------------------- #
async def run_duan_qian_chen(job_id: int) -> None:
    """断前尘编排：并发执行各法（`asyncio.Semaphore(settings.llm_max_concurrency)` 限流，
    默认 3），每法独立 session 内「分析 + 真实校验 + 落库 + 按差值逐法扣费 + 原子推进度」，
    全部完成后串行合成问卷。"""
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

        # 要并发跑的方法（排除降级/未注册）；跳过的方法只原子推进度、不调 LLM
        pending = [k for k in METHOD_KEYS if k not in degraded and k in ANALYZERS]
        skipped = [k for k in METHOD_KEYS if k not in pending]
        for k in skipped:
            _bump_completed(session, job_id)
            logger.info("断前尘跳过（降级/未注册）method_key=%s job_id=%s", k, job_id)

        # 每 job（单用户）3 并发限流；per-job 而非全局模块级
        sem = asyncio.Semaphore(settings.llm_max_concurrency)

        async def _process_dqc_method(key: str):
            """单个 method 协程：独立短 session 内查缓存 → analyze + validate → 逐法扣费
            落库。返回 (key, status, tokens, payload)；status ∈ cached|degraded|done|failed。"""
            s = AnalyticsSession()
            try:
                # 两层信号量嵌套（按书写顺序先取全局、再取 per-job，退出反向释放）：
                # 全局兜底跨所有用户的 method 总数，per-job 限单用户 3 并发。
                async with _global_llm_semaphore, sem:
                    existing = (
                        s.query(MethodResult)
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
                        _bump_completed(s, job_id)
                        s.close()
                        logger.info("断前尘缓存命中 method_key=%s job_id=%s", key, job_id)
                        return (key, "cached", 0, None)

                    # 逐法扣费：进该法前快照本协程 context 的 usage 账本，处理完（成功或抛
                    # ValueError——LLM 已成功返回但解析失败）后按差值立即扣费；
                    # LLMError（chat 未成功返回，usage 未累加）差值通常为 0，不产生扣费。
                    # ContextVar 隔离保证差值只含本方法的 analyze+validate 消耗。
                    before = get_usage().get("total_tokens") or 0
                    try:
                        result = await ANALYZERS[key](
                            "duan-qian-chen", slices.get(key), user_question,
                            continuation=continuation,
                        )
                        if not isinstance(result, dict):
                            # prompt 缺失 / slice 空 → 该方法降级，跳过落库（未调 LLM，无 token 消耗）
                            logger.warning("断前尘方法降级 method_key=%s（analyze 返回空）", key)
                            _bump_completed(s, job_id)
                            s.close()
                            return (key, "degraded", 0, None)
                        validation = await validate(result, slices.get(key))
                    except (LLMError, ValueError) as exc:
                        # 单法失败：按差值扣费（ValueError 时 LLM 已消耗、差值>0），记入失败
                        tokens = (get_usage().get("total_tokens") or 0) - before
                        _charge_method(job.user_id, tokens, f"job:{job_id}:{key}")
                        s.rollback()
                        _bump_completed(s, job_id)
                        s.close()
                        logger.warning("断前尘单法失败 method_key=%s error=%s", key, exc)
                        return (key, "failed", tokens, str(exc))

                    # 成功路径（分析 + 校验均完成）：该法答案已生成 → 按差值立即扣费
                    tokens = (get_usage().get("total_tokens") or 0) - before
                    _charge_method(job.user_id, tokens, f"job:{job_id}:{key}")

                    # 校验成功后落库（覆盖命中但 result 为空的残留行，避免重复行）
                    if existing is not None:
                        existing.result_json = result
                        existing.validation_json = validation
                        existing.cached = False
                    else:
                        s.add(
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
                    s.commit()
                    _bump_completed(s, job_id)
                    s.close()
                    return (key, "done", tokens, result)
            except BaseException:
                # 未捕获异常（如锁等待超时）：关闭本协程 session 后上抛，
                # 由 gather(return_exceptions=True) 兜住，按该法失败处理
                try:
                    s.rollback()
                except Exception:  # pragma: no cover - 兜底
                    pass
                s.close()
                raise

        # 并发扇出：return_exceptions=True 兜底，单法异常不整体崩
        outs = await asyncio.gather(
            *[_process_dqc_method(k) for k in pending], return_exceptions=True
        )
        failed_methods: list[str] = []
        total_tokens = 0
        for key, out in zip(pending, outs):
            if isinstance(out, BaseException):
                # 协程内未捕获异常 → 按该法失败处理（completed 未及推进，收尾统一置 total）
                failed_methods.append(key)
                logger.error("断前尘方法协程异常 method_key=%s job_id=%s", key, job_id,
                             exc_info=out)
                continue
            _key, status, tokens, _payload = out
            total_tokens += int(tokens or 0)
            if status == "failed":
                failed_methods.append(key)

        # 全部方法失败（pending 非空且无一成功）→ LLM 服务不可用，任务整体失败
        if len(pending) > 0 and len(failed_methods) >= len(pending):
            job.status = JobStatus.failed
            job.error = "LLM 服务不可用，全部方法失败"
            session.commit()
            logger.error("断前尘任务中止：全部方法失败 job_id=%s", job_id)
            return

        # 合成问卷：收集本 case 全部已落库的断前尘结果（含本轮新写与历史缓存行）。
        # 主 session 串行读（gather 之后执行，安全）。_usage 用逐法 tokens 求和——
        # 主 task 的 contextvar 不含子协程的累计（各自隔离从 0 起算）。
        questionnaire = _compose_questionnaire(session, job, failed_methods)
        questionnaire["_usage"] = {"total_tokens": total_tokens}
        job.result_json = questionnaire
        job.completed = job.total if job.total is not None else job.completed
        case.status = CaseStatus.dqc_done
        job.status = JobStatus.succeeded
        session.commit()
        logger.info(
            "断前尘任务完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
            job_id, questionnaire.get("method_count"), failed_methods,
            total_tokens,
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
# 预测：路由 + 并发扇出（每 job 3 并发限流，不校验）+ 逐法扣费 + 合成
# --------------------------------------------------------------------------- #
async def run_predict(job_id: int) -> None:
    """预测编排：路由选法 → 并发 analyze（`asyncio.Semaphore(settings.llm_max_concurrency)`
    限流，默认 3；不校验）→ 每法独立 session 落库 + 按差值逐法扣费 → synthesize + 合规。"""
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

        # 节116 第④步 · 读取校准数据中的模糊否定信号（如已校准）
        cal_row = session.query(Calibration).filter_by(case_id=job.case_id).first()
        vague_denials_summary = None
        calibration_feedback = None
        if cal_row and isinstance(cal_row.fit_json, dict):
            vd = cal_row.fit_json.get("vague_denials")
            if isinstance(vd, dict) and isinstance(vd.get("summary"), dict):
                vague_denials_summary = vd["summary"]
                calibration_feedback = {
                    "vague_denials": vague_denials_summary,
                    "note": "以下领域存在用户模糊否定反馈，相关方向的置信度请适当下调。",
                }

        reset_usage()

        # 续跑检测（与断前尘同语义）：0 < done_count < total 说明是服务重启后中断
        # 续跑 → 对本次 analyze 注入 continuation 上下文（已完成方法仍复用缓存结果）。
        # 此处仅用主 session 预查一次算 continuation；每法协程会在各自独立 session
        # 内再次查缓存（gather 期间不共享主 session）。
        cache_rows = {
            r.method_key: r
            for r in session.query(MethodResult)
            .filter_by(case_id=job.case_id, user_id=job.user_id, phase=PRED_PHASE)
            .all()
        }
        done_count = sum(1 for r in cache_rows.values() if r.result_json)
        continuation = (
            "该档案之前的推演被服务器重启中断，请继续完成剩余方法的分析，不要重复已完成的结论。"
            if 0 < done_count < (job.total or 0)
            else None
        )

        # 方法集合中可并发扇出的子集（每 job 单用户 3 并发限流）
        pending = [m for m in methods if m not in degraded and m in ANALYZERS]
        sem = asyncio.Semaphore(settings.llm_max_concurrency)

        async def _process_pred_method(key: str):
            """单个 method 协程：独立短 session 内查缓存 → analyze → 按差值逐法扣费
            落库。返回 (key, status, tokens, payload)；status ∈ cached|degraded|done|failed。"""
            s = AnalyticsSession()
            try:
                # 两层信号量嵌套（按书写顺序先取全局、再取 per-job，退出反向释放）：
                # 全局兜底跨所有用户的 method 总数，per-job 限单用户 3 并发。
                async with _global_llm_semaphore, sem:
                    cached = (
                        s.query(MethodResult)
                        .filter_by(
                            case_id=job.case_id,
                            user_id=job.user_id,
                            method_key=key,
                            phase=PRED_PHASE,
                        )
                        .first()
                    )
                    # 缓存命中 → 复用，不调 LLM、不扣费
                    if cached is not None and cached.result_json:
                        cached.cached = True
                        s.commit()
                        s.close()
                        logger.info("预测缓存命中 method_key=%s job_id=%s", key, job_id)
                        return (key, "cached", 0, cached.result_json)

                    # 逐法扣费：进该法前快照本协程 context 的 usage 账本，处理完按差值
                    # 立即扣费（ContextVar 隔离保证差值只含本方法 analyze 的消耗）。
                    before = get_usage().get("total_tokens") or 0
                    try:
                        out = await ANALYZERS[key](
                            "prediction", slices.get(key), user_question,
                            calibration_feedback=calibration_feedback,
                            continuation=continuation,
                        )
                    except (LLMError, ValueError) as exc:
                        # 单法失败：按差值扣费（ValueError 时 LLM 已消耗、差值>0）
                        tokens = (get_usage().get("total_tokens") or 0) - before
                        _charge_method(job.user_id, tokens, f"job:{job_id}:{key}")
                        s.rollback()
                        s.close()
                        logger.warning("预测单法失败，继续其他法 method_key=%s error=%s", key, exc)
                        return (key, "failed", tokens, None)
                    if not isinstance(out, dict) or not out:
                        # prompt 缺失 / slice 空 → 该方法降级，跳过落库（未调 LLM，无消耗）
                        logger.warning("预测方法降级 method_key=%s（analyze 返回空）", key)
                        s.rollback()
                        s.close()
                        return (key, "degraded", 0, None)

                    # 成功：按差值逐法扣费 + 落库（覆盖残留空行避免重复行）
                    tokens = (get_usage().get("total_tokens") or 0) - before
                    _charge_method(job.user_id, tokens, f"job:{job_id}:{key}")
                    if cached is not None:
                        cached.result_json = out
                        cached.validation_json = None
                        cached.cached = False
                    else:
                        s.add(
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
                    s.commit()
                    s.close()
                    return (key, "done", tokens, out)
            except BaseException:
                # 未捕获异常（如锁等待超时）：关闭本协程 session 后上抛，
                # 由 gather(return_exceptions=True) 兜住，按该法失败处理
                try:
                    s.rollback()
                except Exception:  # pragma: no cover - 兜底
                    pass
                s.close()
                raise

        # 并发扇出：return_exceptions=True 兜底，单法异常不整体崩
        outs = await asyncio.gather(
            *[_process_pred_method(m) for m in pending], return_exceptions=True
        )

        results: list[dict] = []
        failed_methods: list[str] = []
        total_tokens = 0
        for key, out in zip(pending, outs):
            if isinstance(out, BaseException):
                # 协程内未捕获异常 → 按该法失败处理
                failed_methods.append(key)
                logger.error("预测方法协程异常 method_key=%s job_id=%s", key, job_id,
                             exc_info=out)
                continue
            _key, status, tokens, payload = out
            total_tokens += int(tokens or 0)
            if status == "failed":
                failed_methods.append(key)
            elif status in ("done", "cached") and isinstance(payload, dict):
                results.append(payload)

        # 合成 + 合规拦截（免责由前端全局 DisclaimerFooter 统一展示，不再追加进 report 文字）
        report = await synthesize(results, decision, vague_denials=vague_denials_summary)
        _apply_compliance(report)

        # _usage 用逐法 tokens 求和——主 task 的 contextvar 不含子协程的累计
        # （各自隔离从 0 起算），且逐法扣费已完成，不再有收尾 _charge_after_run。
        job.result_json = {
            "phase": "prediction",
            "report": report,
            "_usage": {"total_tokens": total_tokens},
            "failed_methods": failed_methods,
        }
        job.completed = job.total if job.total is not None else len(results)
        case.status = CaseStatus.predict_done
        job.status = JobStatus.succeeded
        session.commit()
        logger.info(
            "预测任务完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
            job_id, len(results), failed_methods, total_tokens,
        )
    except Exception as exc:  # 任何未捕获异常 → failed
        try:
            session.rollback()
            # 异常兜底不再扣费：逐法扣费在各自协程内已完成；主 task 的 contextvar
            # 不含子协程累计（get_usage() 必为 0），此处只置 failed。
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
