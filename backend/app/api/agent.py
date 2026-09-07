# -*- coding: utf-8 -*-
"""太初先生 Agent 会话 API（REQ-076，prefix=/api/agent）：固定 session 对话。

「太初先生」是太初 C 端对话大师（非 REQ-050 运维 Agent）：
  ① 固定 session 对话；会话顶部下拉选默认档案（仅本人档案）；未选档案可闲聊，
     咨询档案相关内容先提示选档案（该提示逻辑在 prompts/agent/master.md 角色 prompt
     内约束，本文件只负责数据注入与编排）。
  ② 可就所选档案详细咨询 + 日常闲聊开导；计费 = 每来回（用户一问 + 先生一回）
     按 LLM 实际 token 扣余额（ceil 积分、1 积分=1000 tokens，同 interpret，
     开启不预扣——先 check_balance 预检、LLM 成功后按实际 total_tokens 即时
     consume）。System Prompt 用户不可改、后台可配置（走 REQ-048 热改+回滚，
     见 app/admin/router.py PROMPT_FILES 的 agent_master / agent_greeting）。
  ③ 上下文 = 会话内保守窗口（最近 20 条本人 agent_messages）；跨会话长期记忆
     接 REQ-077（recall_memories 注入 system 记忆段 + enqueue_extraction 异步入队）。
  ④ 开关 = REQ-066⑦ agent_enabled 默认开，只控制入口显隐（前端控制），API 不
     因开关拦截 chat（既有会话与数据保留，重开可见）。

端点：
  GET  /api/agent/greeting   进入会话取开场白文本（读 prompts/agent/greeting.md，
                             零 LLM 零扣费；按次 read_text，后台热改即时生效）
  GET  /api/agent/messages   本人对话历史（含 role/content/created_at/case_id，
                             按 id 升序，limit 默认最近 50）
  POST /api/agent/chat       一轮对话：归属校验 → 记忆召回 → 组装 messages
                             （master.md + 记忆段 + 档案上下文 + 历史 20 条 +
                             本次 user）→ 预检余额 → LLM → 成功即时扣费
                             （ref=agent:{user_id}[:{case_id}]）→ 落 agent_messages
                             （user/assistant 各一行，assistant.tokens=本轮
                             total_tokens）→ 入队记忆抽取（异步不阻塞，失败静默）
                             → agent_message 埋点。LLM 失败 502 不扣费不落库。

计费 ref 约定（credits/labels.py 可读化 + 档案名反查）：
  - 未选档案（闲聊）：agent:{user_id}
  - 选了默认档案：     agent:{user_id}:{case_id}（labels 据此反查 cases.name）
"""
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.divination import _case_chart_summary  # 与断卦/解读同款 chart 摘要口径
from app.auth.router import get_user_id_from_token
from app.credits.service import check_balance, consume
from app.database import get_analytics_db
from app.events.service import record_event
from app.llm import LLMError, chat
from app.memory import enqueue_extraction, recall_memories
from app.models import AgentMessage, Case

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])

# 角色主 prompt 与开场白话术（backend/prompts/agent/*.md；agent.py 位于
# backend/app/api/，parents[2] = backend；按次 read_text 无启动缓存，REQ-048 热改
# 即时生效——与 interpret/divination.md 读取方式一致）
MASTER_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "agent" / "master.md"
GREETING_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "agent" / "greeting.md"

# 会话内保守上下文窗口：最近 20 条本人 agent_messages（REQ-076③）
HISTORY_WINDOW = 20


def _err(status: int, detail: str) -> HTTPException:
    """统一错误构造（与 divination.py 同款）"""
    return HTTPException(status_code=status, detail=detail)


def _load_prompt(path: Path, what: str) -> str:
    """读取文件类 system prompt；缺失视为配置错误（RuntimeError，向上抛 500）。"""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"{what}提示词缺失或不可读: {path}") from exc
    if not text.strip():
        raise RuntimeError(f"{what}提示词为空: {path}")
    return text


def _load_master_prompt() -> str:
    return _load_prompt(MASTER_PROMPT_PATH, "太初先生")


def _load_greeting_prompt() -> str:
    return _load_prompt(GREETING_PROMPT_PATH, "开场白")


# --- 请求模型 ---
class AgentChatRequest(BaseModel):
    message: str = Field(description="用户本轮消息（非空）")
    case_id: Optional[int] = Field(default=None, description="所选默认档案（仅本人；可空=闲聊）")


def _get_owned_case(db: Session, case_id: int, user_id: int) -> Case:
    """按 id+user_id 取档案（多用户隔离）；不存在抛 404（防越权）。"""
    case = db.query(Case).filter_by(id=case_id, user_id=user_id).first()
    if case is None:
        raise _err(404, "case不存在")
    return case


def _case_context(db: Session, case: Case) -> dict:
    """档案上下文：姓名/性别/出生信息 + chart/bazi 摘要（_case_chart_summary 同款逻辑）。

    注入为独立 system 段（json 文本），供先生结合所选档案给指引；未排盘
    （无 chart 行）时 chartSummary 为 None，先生以姓名/出生信息闲聊开导。
    """
    inp = case.input_json if isinstance(case.input_json, dict) else {}
    return {
        "caseId": case.id,
        "name": case.name or "",
        "gender": inp.get("gender") or "",
        "birth": {
            "year": inp.get("birth_year"),
            "month": inp.get("birth_month"),
            "day": inp.get("birth_day"),
            "hour": inp.get("birth_hour"),
        },
        "birthplace": inp.get("birthplace") or "",
        "chartSummary": _case_chart_summary(db, case.id),
    }


# --- 路由 ---
@router.get("/greeting")
def get_greeting(
    authorization: str = Header(...),
):
    """进入会话取开场白文本（读 greeting.md，零 LLM 零扣费；可轮换、用户不可改）。"""
    get_user_id_from_token(authorization)
    return {"code": 0, "message": "ok", "data": {"greeting": _load_greeting_prompt()}}


@router.get("/messages")
def list_messages(
    limit: int = 50,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """本人对话历史（含 role/content/created_at/case_id/tokens，按 id 升序）。

    用户隔离恒按 token user_id（与 /api/memory 同口径）；limit 默认最近 50 条。
    """
    user_id = get_user_id_from_token(authorization)
    limit = max(1, min(limit, 200))
    rows = (
        db.query(AgentMessage)
        .filter(AgentMessage.user_id == user_id)
        .order_by(AgentMessage.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()  # 按 id 升序返回
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "case_id": m.case_id,
                    "tokens": m.tokens,
                    "created_at": m.created_at.isoformat(timespec="seconds") if m.created_at else None,
                }
                for m in rows
            ],
            "limit": limit,
        },
    }


@router.post("/chat")
async def agent_chat(
    body: AgentChatRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """一轮对话（LLM 付费，即时扣费）：归属校验 → 记忆召回 → 组装 → 预检余额 →
    LLM → 成功扣费 → 落 agent_messages → 入队记忆抽取 → 埋点。LLM 失败 502。
    """
    user_id = get_user_id_from_token(authorization)

    # ① 参数校验：message 非空
    message = (body.message or "").strip()
    if not message:
        raise _err(400, "消息不能为空")

    # ② case 归属校验（case_id 非空则必须属于当前用户，防越权 → 404）
    case_id = body.case_id
    case = None
    if case_id is not None:
        case = _get_owned_case(db, case_id, user_id)

    # ③ 召回跨会话长期记忆（REQ-077；空则跳过；异常/开关关闭静默返回空，不注入）
    memory_block = recall_memories(user_id, query=message, mode="question")

    # ④ 组装 messages：
    #    system = master.md（角色 prompt，REQ-048 热改）+ 长期记忆段（非空时）
    #           + 档案上下文段（选了档案时）→ 历史（最近 20 条本人，保守窗口，
    #           按 id 升序）→ 最后 user = 本次 message
    system_parts = [_load_master_prompt()]
    if memory_block:
        system_parts.append(memory_block)
    if case is not None:
        system_parts.append(
            "【所选档案信息】\n" + json.dumps(_case_context(db, case), ensure_ascii=False)
        )
    history = (
        db.query(AgentMessage)
        .filter(AgentMessage.user_id == user_id)
        .order_by(AgentMessage.id.desc())
        .limit(HISTORY_WINDOW)
        .all()
    )
    history.reverse()  # 按 id 升序（旧→新）
    messages: list[dict] = [{"role": "system", "content": part} for part in system_parts]
    messages += [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": message})

    # ⑤ 计费预检：余额不足抛 BizError 5002（全局处理器转 502 信封），不放行 LLM
    check_balance(user_id)

    # ⑥ LLM 先生应答（非 json_mode 取自然语言文本，对齐 interpret/revise）
    try:
        resp = await chat(messages, json_mode=False)
    except (LLMError, ValueError) as exc:
        # LLM 失败：记日志 + 502，不扣费不落库（不吞成假文案）
        logger.warning("太初先生 LLM 调用失败 user_id=%s case_id=%s error=%s",
                       user_id, case_id, exc)
        raise _err(502, "太初先生暂不可用，请稍后重试")

    content = resp["content"]
    total_tokens = int(resp["usage"]["total_tokens"] or 0)

    # ⑦ 即时扣费：chat 已成功（LLM 已调用），按实际 total_tokens 扣（ceil 积分、
    #    1 积分=1000 tokens，consume 内部换算）；扣费失败只记日志不阻断落库
    #    （对账口径与 interpret/_charge_llm 一致）。
    ref = f"agent:{user_id}" if case_id is None else f"agent:{user_id}:{case_id}"
    try:
        consume(user_id, total_tokens, ref=ref)
    except Exception as exc:
        logger.error("太初先生扣费失败 user_id=%s tokens=%s ref=%s error=%s",
                     user_id, total_tokens, ref, exc)

    # ⑧ 落库：user 消息（tokens=None）+ assistant 消息（tokens=本轮 total_tokens）
    user_msg = AgentMessage(user_id=user_id, case_id=case_id, role="user", content=message)
    assistant_msg = AgentMessage(user_id=user_id, case_id=case_id, role="assistant",
                                 content=content, tokens=total_tokens)
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(user_msg)

    # ⑨ 记忆抽取入队（REQ-077，异步不阻塞：入队 <1ms 零 LLM；失败静默，
    #    绝不影响对话返回——enqueue_extraction 内部已捕获一切异常）
    enqueue_extraction(user_id, user_msg.id)

    # ⑩ 埋点（写库失败静默，绝不阻断业务）
    record_event("agent_message", user_id=user_id, case_id=case_id,
                 props={"tokens": total_tokens, "case_id": case_id})

    return {"code": 0, "message": "ok",
            "data": {"reply": content, "tokens": total_tokens}}
