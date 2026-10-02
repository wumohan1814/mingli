# -*- coding: utf-8 -*-
"""合参 API（八法合一 → 合参改造）。

本文件只承担**当下事合参**与**方法池查询**两件事：

- `GET  /api/combine/pools`   两个方法池（前端勾选面板的唯一事实源）
- `POST /api/combine/moment`  当下事合参（异步 job）

命盘合参（要生辰、走断前尘+校准）不在这里：它的端点是
`POST /api/cases/{case_id}/duan-qian-chen` 与 `/predict`（见 `app/api/cases.py`），
编排在 `app/jobs/orchestrator.py`。

## 当下事合参的流程（一条直线，没有断前尘、没有问卷校准）

```
参数校验 → 建 Job(type=moment-combine, combine_mode=moment, method_keys=methods)
  → 后台任务：逐法**确定性起卦**（复用 divination / tarot 的 Node 转发，零 LLM）
             → 每法落一条 Divination 行（这就是「起卦记录」，可回溯）
             → 组装合并 prompt（prompts/combine/moment.md）
             → **只调 1 次 LLM** 产出统一解读（5 板块骨架）
             → 落 job.result_json，status=succeeded
```

## 扣费口径（不许自创）

- 起卦 = 确定性计算，**零 LLM 零扣费**（与 `POST /api/divinations` 一致）；
- 统一解读 = 1 次 LLM 调用 → 按该次调用实际 tokens 扣 **1 次**，ref = `job:{job_id}`
  （`job:{id}` 两段式是既有格式，流水标签见 `app/credits/labels.py`）。
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.divination import forward_node_divination
from app.api.tarot import forward_node_tarot
from app.auth.router import get_user_id_from_token
from app.combine import (
    COMBINE_MODE_MOMENT,
    MOMENT_POOL,
    NATAL_POOL,
    combine_label,
    load_combine_prompt,
    method_name,
    normalize_methods,
    report_titles_for,
)
from app.config import settings
from app.credits.service import consume
from app.database import AnalyticsSession, get_analytics_db
from app.events.service import record_event
from app.llm import LLMError, chat
from app.methods.base import parse_method_result
from app.models import Divination, Job, JobStatus, JobType
# 余额预检与命盘合参共用同一口径（不足 → job failed("余额不足")），不另写一份
from app.jobs.orchestrator import _check_balance_or_fail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/combine", tags=["combine"])

#: 起卦全失败时的 job.error（与断前尘/预测的「全部方法失败」同一句式）
_CAST_ALL_FAILED = "起卦服务不可用，全部方法失败"
#: LLM 全失败时的 job.error
_LLM_FAILED = "LLM 服务不可用，统一解读失败生成"
#: 板块无法从卦面得出结论时的诚实兜底（不许编、不许两可话）
_SECTION_FALLBACK = "这一层未能从本次卦面看出结果，不作判断。"

# 后台任务强引用集合（与 cases.py 同口径：create_task 的 task 不被引用可能被 GC 回收）
_background_tasks: set[asyncio.Task] = set()


def _background_done(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if not task.cancelled() and task.exception() is not None:
        # 任务异常已在编排内落库为 failed，这里只吞掉以免 asyncio 报未取回异常
        pass


def _charge_llm(user_id: int, total_tokens, ref: str, what: str) -> None:
    """LLM 调用成功后按实际 token 扣费；失败只记日志不阻断结果（架构 §6.3 对账）。

    与 `app/api/divination.py` / `tarot.py` / `cases.py` 的 `_charge_llm` 同口径：
    tokens <= 0（mock / 零消耗）不产生流水，只记 info。
    """
    tokens = int(total_tokens or 0)
    if tokens <= 0:
        logger.info("%s无 token 消耗，跳过扣费 user_id=%s ref=%s", what, user_id, ref)
        return
    try:
        consume(user_id, tokens, ref=ref)
    except Exception as exc:
        logger.error("%s扣费失败 user_id=%s tokens=%s ref=%s error=%s",
                     what, user_id, tokens, ref, exc)


# --------------------------------------------------------------------------- #
# 请求模型
# --------------------------------------------------------------------------- #
class MomentCombineRequest(BaseModel):
    """当下事合参请求。

    - `question`：所问之事（必填）——本模式**只断这一件事**，不推一生格局、不推前世；
    - `methods`：从 `GET /api/combine/pools` 的 `moment` 里挑（非空、池外 key → 400）；
    - `cast`：可选，逐法起卦参数（`method_key → seed`）。前端演出要复现同一卦象时传
      （如 `{"ssgw": {"options": {"seed": "..."}}, "tarot": {"spreadType": "single",
      "options": {"seed": "..."}}}`）；不传 = 引擎自带默认（时间起卦 / 随机起卦）。
    """

    question: str = Field(description="所问之事（必填）")
    methods: list[str] = Field(description="当下事合参方法集（池外 key 拒绝）")
    cast: Optional[dict] = Field(default=None, description="逐法起卦参数（可空）")


# --------------------------------------------------------------------------- #
# 路由
# --------------------------------------------------------------------------- #
@router.get("/pools")
async def get_pools(authorization: str = Header(...)):
    """两个方法池（只读，零 LLM 零扣费）。

    前端勾选面板按它渲染，**不许在前端另写一份 key 列表**——池的单一事实源在
    `app/combine/__init__.py`。返回形状：`{natal: [{key,name}], moment: [{key,name}]}`。
    """
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "natal": [dict(m) for m in NATAL_POOL],
            "moment": [dict(m) for m in MOMENT_POOL],
        },
    }


@router.post("/moment")
async def moment_combine(
    req: MomentCombineRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """当下事合参（异步 202）：逐法确定性起卦 → 只调 1 次 LLM 出统一解读。"""
    user_id = get_user_id_from_token(authorization)

    # ① 参数校验（非法即 400，绝不悄悄退回全量：选了六法却跑十法是事故）
    question = (req.question or "").strip()
    if not question:
        _param_error("question 不能为空")
    try:
        methods = normalize_methods(req.methods, COMBINE_MODE_MOMENT)
        cast = _normalize_cast(req.cast, methods)
    except ValueError as exc:
        _param_error(str(exc))

    label = combine_label(len(methods), COMBINE_MODE_MOMENT)

    # ② 建 job（**没有 case**：本模式不要生辰、不落档案）
    job = Job(
        case_id=None,
        user_id=user_id,
        type=JobType.moment_combine,
        status=JobStatus.pending,
        total=len(methods),
        completed=0,
        method_keys=methods,
        combine_mode=COMBINE_MODE_MOMENT,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # ③ 后台执行（独立 session；起卦参数与问题随参数传入，同时落进各 Divination.seed_json）
    task = asyncio.create_task(run_moment_combine(job.id, question, methods, cast))
    _background_tasks.add(task)
    task.add_done_callback(_background_done)

    return JSONResponse(
        status_code=202,
        content={"code": 0, "message": "ok", "data": {
            "jobId": str(job.id), "total": job.total, "label": label,
        }},
    )


def _param_error(detail: str):
    """参数错误 → 400（信封由 main.py 的 HTTPException 处理器统一转）。"""
    raise HTTPException(status_code=400, detail=detail)


def _normalize_cast(cast, methods: list[str]) -> dict:
    """校验并规范化 `cast`：值必须是对象、key 必须是本次请求的方法。

    返回 `{method_key: seed_dict}`（只留本次真正要起的法）。
    """
    if cast is None:
        return {}
    if not isinstance(cast, dict):
        raise ValueError("cast 必须是对象（method_key → 起卦参数）")
    out: dict = {}
    for key, seed in cast.items():
        if key not in methods:
            raise ValueError(f"cast 含未请求的方法: {key}")
        if seed is not None and not isinstance(seed, dict):
            raise ValueError(f"cast.{key} 必须是对象")
        out[key] = dict(seed or {})
    return out


# --------------------------------------------------------------------------- #
# 后台任务
# --------------------------------------------------------------------------- #
def _cast_one(key: str, seed: dict, user_id: int) -> dict:
    """**单法起卦**（确定性，零 LLM）：塔罗走 Node `/tarot`，其余各法走 Node `/divination`。

    这两条转发就是 `POST /api/divinations` / `POST /api/tarot/draw` 用的同一条实现
    （`forward_node_divination` / `forward_node_tarot`）——不重新发明起卦。
    失败抛 HTTPException(502)，由调用方按「该法失败」处理。
    """
    seed = dict(seed or {})
    if key == "tarot":
        spread_type = seed.pop("spreadType", None)
        options = seed.pop("options", None)
        if options is None:
            options = seed or None
        elif seed:
            options = {**options, **seed}
        return forward_node_tarot(spread_type or "single", options, user_id=user_id)
    return forward_node_divination(key, seed, user_id=user_id)


def _norm_title(text: str) -> str:
    """标题归一：去空白/标点/序号，便于与固定骨架标题宽松匹配（模型常加「一、」「：」）。"""
    return re.sub(r"[\s:：、。.·\-—()（）【】\[\]0-9一二三四五六七八九十]", "", str(text or ""))


def _parse_moment_report(text: str, titles: list[str]) -> dict:
    """LLM 输出 → `{"summary": str, "sections": [{"title", "description"}]}`。

    板块顺序恒为 `titles`（前端按 reportTitles 渲染，形状必须稳定）：
    - 标题宽松匹配（归一后相等 / 互相包含）后按骨架顺序排列；
    - 骨架里缺的板块 → 给一句诚实兜底（不编内容、不写两可话）；
    - 模型多给的标题追加在末尾（不丢信息）。

    容错：整段不是 JSON（模型没照格式给）→ `sections=[]`、`summary` 取原文，
    并记 warning。**不把用户已经付费的那次解读丢掉**。
    """
    raw = text if isinstance(text, str) else ""
    try:
        data = parse_method_result(raw)
    except ValueError as exc:
        logger.warning("当下事合参统一解读不是合法 JSON，按纯文本兜底: %s", exc)
        return {"summary": raw.strip(), "sections": []}

    summary = str(data.get("summary") or "").strip()
    raw_sections = data.get("sections") if isinstance(data.get("sections"), list) else []
    by_title: dict[str, str] = {}
    for item in raw_sections:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        desc = str(item.get("description") or item.get("content") or "").strip()
        if title and desc:
            by_title[_norm_title(title)] = desc

    sections: list[dict] = []
    for title in titles:
        want = _norm_title(title)
        desc = by_title.pop(want, "")
        if not desc:  # 宽松兜底：归一后互相包含也算同一板块
            for key in list(by_title):
                if key and (key in want or want in key):
                    desc = by_title.pop(key)
                    break
        sections.append({"title": title, "description": desc or _SECTION_FALLBACK})

    # 模型多给的板块（骨架外）按原顺序追加，不丢信息
    for key, desc in by_title.items():
        sections.append({"title": key, "description": desc})

    if not summary:
        summary = sections[0]["description"] if sections else ""
    return {"summary": summary, "sections": sections}


def _moment_output_spec(titles: list[str]) -> str:
    """追加到 moment.md 之后的**硬性输出格式**（与 base.py 同套路：prompt 只管纪律，
    结构契约放在代码里，骨架一变这里自动跟着变，不会与 reportTitles 漂移）。"""
    order = " / ".join(f'"{t}"' for t in titles)
    return f"""

【输出格式（硬性要求，覆盖以上 prompt 中的任何格式说明）】
1. 只输出一个 JSON 对象本身；不要任何解释文字、标题、markdown 代码围栏或前后缀。
2. 结构固定为：{{"summary": "<一句话总断>", "sections": [{{"title": "<固定标题>", "description": "<该板块正文>"}}]}}。
3. sections 必须**恰好按此顺序**给这 {len(titles)} 个板块，title **逐字照抄**（不得改写、不得增减）：{order}
4. 每个 description 用大白话写 2–4 句，必须扣住本次卦面（哪一法看到了什么）；各法分歧时把两边的依据并列写清，不许用「既…又…」式的和稀泥话糊过去。
5. 不给概率、百分比、打分或任何无依据的数字；不出现 JSON 字段名、内部方法名、API 等工程噪音。
6. 只断用户问的这件事：不推一生格局、不推前世、不推寿命；与本次卦面无关的内容宁可不写。
"""


async def run_moment_combine(job_id: int, question: str, methods: list[str],
                             cast: dict | None = None) -> None:
    """当下事合参后台编排（独立 session，不占用请求 session）。

    步骤：余额预检 → 逐法起卦（落 Divination 行 + 推进度）→ 组装 moment prompt →
    1 次 LLM → 落 `job.result_json`。单法起卦失败只记 failed_methods，不整体崩；
    全部起卦失败 / LLM 失败 → job failed（fail loud，不返回半成品）。
    """
    session = AnalyticsSession()
    try:
        job = session.query(Job).filter_by(id=job_id).first()
        if job is None:
            raise RuntimeError(f"Job 不存在: job_id={job_id}")
        user_id = job.user_id

        # 计费预检（与断前尘/预测同口径）：余额不足 → failed，不跑 LLM
        if not _check_balance_or_fail(session, job, "当下事合参"):
            return
        job.status = JobStatus.running
        session.commit()

        prompt = load_combine_prompt("moment")   # 缺失 → RuntimeError → job failed
        titles = report_titles_for(COMBINE_MODE_MOMENT)
        cast = cast or {}

        # ① 逐法确定性起卦（零 LLM）：每法一条 Divination 行（起卦记录可回溯）
        castings: list[dict] = []
        failed_methods: list[str] = []
        for key in methods:
            seed = dict(cast.get(key) or {})
            try:
                result = _cast_one(key, seed, user_id)
            except Exception as exc:  # 含 HTTPException(502)：该法失败不整体崩
                failed_methods.append(key)
                logger.warning("当下事合参起卦失败 method_key=%s job_id=%s error=%s",
                               key, job_id, exc)
            else:
                session.add(Divination(
                    user_id=user_id,
                    case_id=None,           # 当下事无档案（Divination.case_id 本就可空）
                    method=key,
                    # 起卦参数 + 所问之事（与 POST /api/divinations 把 question 放 seed 同口径）
                    seed_json={**seed, "question": question},
                    result_json=result,
                ))
                castings.append({"method": key, "name": method_name(key, COMBINE_MODE_MOMENT),
                                 "result": result})
            job.completed = len(castings) + len(failed_methods)
            session.commit()

        if not castings:
            job.status = JobStatus.failed
            job.error = _CAST_ALL_FAILED
            session.commit()
            logger.error("当下事合参中止：全部方法起卦失败 job_id=%s", job_id)
            return

        # ② 组装合并 prompt（唯一一次 LLM 调用）
        payload = {
            "question": question,
            "method_keys": [c["method"] for c in castings],
            "castings": castings,
            "report_titles": titles,
        }
        messages = [
            {"role": "system", "content": prompt + _moment_output_spec(titles)},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
        try:
            resp = await chat(messages, json_mode=True, max_tokens=settings.llm_max_tokens)
        except (LLMError, ValueError) as exc:
            job.status = JobStatus.failed
            job.error = f"{_LLM_FAILED}: {exc}"
            session.commit()
            logger.warning("当下事合参统一解读失败 job_id=%s error=%s", job_id, exc)
            return

        # ③ 按本次调用实际 tokens 扣 **1 次**（逐法扣费在这里不适用：起卦零 LLM）
        tokens = int((resp.get("usage") or {}).get("total_tokens") or 0)
        _charge_llm(user_id, tokens, ref=f"job:{job_id}", what="当下事合参")

        report = _parse_moment_report(resp.get("content"), titles)

        # ④ 落结果（形状即前端契约，见 docs/standards/03-接口与数据字典.md）
        job.result_json = {
            "phase": "moment-combine",
            "question": question,
            "methodKeys": [c["method"] for c in castings],
            "methodNames": [c["name"] for c in castings],
            "label": combine_label(len(castings), COMBINE_MODE_MOMENT),
            "reportTitles": titles,
            "report": report,
            "castings": castings,
            "failed_methods": failed_methods,
            "_usage": {"total_tokens": tokens},
        }
        job.completed = job.total if job.total is not None else job.completed
        job.status = JobStatus.succeeded
        session.commit()

        record_event("moment_combine", user_id=user_id, props={
            "methods": [c["method"] for c in castings],
            "method_count": len(castings),
            "failed_methods": failed_methods,
        })
        logger.info("当下事合参完成 job_id=%s method_count=%s failed=%s total_tokens=%s",
                    job_id, len(castings), failed_methods, tokens)
    except Exception as exc:  # 任何未捕获异常 → failed（绝不静默留 pending）
        try:
            session.rollback()
            job_ref = session.query(Job).filter_by(id=job_id).first()
            if job_ref is not None:
                job_ref.status = JobStatus.failed
                job_ref.error = str(exc)
                session.commit()
        except Exception:  # pragma: no cover - 兜底日志
            logger.exception("当下事合参失败后更新 job 状态也出错 job_id=%s", job_id)
        logger.exception("当下事合参任务失败 job_id=%s", job_id)
    finally:
        session.close()
