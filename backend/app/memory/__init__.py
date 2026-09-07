"""AI 伙伴长期记忆模块（REQ-077）：异步 LLM 事实抽取 + SQLite FTS5 BM25 召回。

对外接口（供 REQ-076 与 API 层调用，详见 service.py 各函数 docstring）：
  - enqueue_extraction(user_id, last_user_msg_id)  每回合对话返回响应后投递抽取任务
  - recall_memories(user_id, query, k, mode)       组装请求上下文时召回记忆文本段
  - memory_worker_loop() / recover_pending_tasks() 进程内 worker（lifespan 接线）
  - run_memory_cleanup() / process_due_task_once() 数据维护与单任务执行（测试入口）
"""
from app.memory.service import (
    enqueue_extraction,
    recall_memories,
    memory_worker_loop,
    process_due_task_once,
    recover_pending_tasks,
    run_memory_cleanup,
)

__all__ = [
    "enqueue_extraction",
    "recall_memories",
    "memory_worker_loop",
    "process_due_task_once",
    "recover_pending_tasks",
    "run_memory_cleanup",
]
