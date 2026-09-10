# services/ — 服务层

REST 客户端与接口封装，是与后端的**唯一出网口**。

- 接口路径与字段必须与 `docs/standards/03-接口与数据字典.md` 逐项对齐。
- 统一处理：JWT 注入、401 自动刷新、错误信封解包、超时与重试。

## 同步 / 异步端点（ADR-0005）

| 类型 | 端点 | 封装要求 |
|---|---|---|
| **异步** | `POST /api/cases/{id}/duan-qian-chen`、`POST /api/cases/{id}/predict` | 返回 `jobId`，配合 `useJobPolling` 轮询 `GET /api/jobs/{id}` |
| 同步 | 其余全部端点 | 直接返回结果 |

轮询本身是**纯 HTTP 读状态，零 LLM 调用**，不得在轮询路径上触发任何模型请求。

命名后缀 `Service`，如 `caseService.ts`、`authService.ts`、`jobService.ts`。
