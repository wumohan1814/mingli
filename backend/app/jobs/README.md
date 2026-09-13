# jobs/ — 模块 10：异步任务编排

> 依据 ADR-0005。断前尘为 8 法 + 每法校验（节139：九法→八法），端到端可达数分钟，同步接口不可行。

## 职责

- 创建任务（`duan-qian-chen` / `predict` 两类），返回 `jobId`。
- 订阅 `MethodAnalysisCompleted` 推进 `completed` 计数。
- 提供状态查询：`GET /api/jobs/{id}` → `{ status, completed, total, result? }`。
- 硬超时后标记 `failed` 并写 `error`。

## 为什么需要独立模块

进度与状态是**跨模块的横切关注点**：方法模块不应关心自己在第几个，
主模块不应关心进度上报。集中在此处，方法模块只管发布事件。

## 硬约束（ADR-0005）

- **轮询零 LLM 调用**：状态查询只读库，不触发任何模型调用。前端为代码轮询（`setInterval` + HTTP GET）。
- 任务进度必须落库（`jobs` 表，用户分析库），**不得只存在内存**——否则进程重启即丢失。
- 任务失败时**已完成方法的结果仍保留**（已落 `method_results`），重试靠缓存键复用，不重复计费。
- 断前尘硬超时建议 10min，预测建议 3min。

## 端点映射

| 端点 | 行为 |
|---|---|
| `POST /api/cases/{id}/duan-qian-chen` | 建任务 → 返 `202 { jobId }` |
| `POST /api/cases/{id}/predict` | 建任务 → 返 `202 { jobId }` |
| `GET /api/jobs/{jobId}` | 查状态；`status=succeeded` 时附带结果 |

其余端点保持同步，不进本模块。
