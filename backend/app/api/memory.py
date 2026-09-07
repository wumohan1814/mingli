# -*- coding: utf-8 -*-
"""长期记忆管理 API（REQ-077，prefix=/api/memory）：当前登录用户查看/删除本人记忆。

多用户隔离（方案书 §4 接口层）：user_id 一律来自鉴权 header（get_user_id_from_token），
接口不接受 body/path 传入 user_id；删除按 (id, user_id) 双条件命中，越权一律 404。

端点：
  GET    /api/memory           本人记忆分页列表（limit/offset，软删不展示）
  GET    /api/memory/count     本人活跃记忆数量
  DELETE /api/memory/{id}      单条软删（仅本人；已删/他人 → 404）
  DELETE /api/memory           一键清空本人记忆（软删）

删除均为软删（deleted_at 置位 + 同步摘除 FTS 镜像行），数据保留至维护任务
物理清除（方案书 §6.3.3）；该开关接口不受 user_settings.agent_enabled 影响
（开关只管召回/抽取，记忆数据与用户管理入口保留，§6.4）。

响应统一 {code, message, data} 信封。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.router import get_user_id_from_token
from app.database import get_analytics_db
from app.models import AgentMemory

router = APIRouter(prefix="/api/memory", tags=["memory"])


def _memory_dict(m: AgentMemory) -> dict:
    return {
        "memoryId": m.id,
        "content": m.content,
        "factType": m.fact_type,
        "importance": m.importance,
        "trust": m.trust,
        "accessCount": m.access_count,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
        "lastRecalledAt": m.last_recalled_at.isoformat() if m.last_recalled_at else None,
    }


def _soft_delete(session: Session, ids: list[int]) -> int:
    """软删 + 显式摘除 FTS 镜像行（基表 UPDATE deleted_at 不触发 content 触发器）。

    与 memory/service.py 内部 _soft_delete_memory_ids 同口径；这里直接用原生 SQL
    保持原子（一条事务内完成两处写）。
    """
    if not ids:
        return 0
    now = datetime.utcnow()
    placeholders = ",".join(f":id{i}" for i in range(len(ids)))
    params = {f"id{i}": v for i, v in enumerate(ids)}
    result = session.execute(
        text(
            f"UPDATE agent_memories SET deleted_at = :now "
            f"WHERE deleted_at IS NULL AND id IN ({placeholders})"
        ),
        {"now": now, **params},
    )
    session.execute(
        text(f"DELETE FROM agent_memories_fts WHERE rowid IN ({placeholders})"),
        params,
    )
    return result.rowcount or 0


@router.get("")
def list_memories(
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """本人记忆分页列表（created_at 倒序；软删不展示；用户隔离恒按 token user_id）。"""
    user_id = get_user_id_from_token(authorization)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows = (
        db.query(AgentMemory)
        .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
        .order_by(AgentMemory.created_at.desc(), AgentMemory.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "memories": [_memory_dict(m) for m in rows],
            "limit": limit,
            "offset": offset,
        },
    }


@router.get("/count")
def count_memories(
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """本人活跃记忆数量。"""
    user_id = get_user_id_from_token(authorization)
    count = (
        db.query(AgentMemory)
        .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
        .count()
    )
    return {"code": 0, "message": "ok", "data": {"count": count}}


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: int,
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """单条软删（仅本人，按 (id, user_id) 双条件；不存在/他人/已删 → 404）。"""
    user_id = get_user_id_from_token(authorization)
    row = (
        db.query(AgentMemory)
        .filter(
            AgentMemory.id == memory_id,
            AgentMemory.user_id == user_id,
            AgentMemory.deleted_at.is_(None),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="记忆不存在")
    _soft_delete(db, [row.id])
    db.commit()
    return {"code": 0, "message": "ok", "data": {"memoryId": memory_id, "deleted": True}}


@router.delete("")
def clear_memories(
    authorization: str = Header(...),
    db: Session = Depends(get_analytics_db),
):
    """一键清空本人记忆（软删全部活跃记忆）。"""
    user_id = get_user_id_from_token(authorization)
    ids = [
        m.id for m in (
            db.query(AgentMemory)
            .filter(AgentMemory.user_id == user_id, AgentMemory.deleted_at.is_(None))
            .all()
        )
    ]
    deleted = _soft_delete(db, ids)
    db.commit()
    return {"code": 0, "message": "ok", "data": {"deleted": deleted}}
