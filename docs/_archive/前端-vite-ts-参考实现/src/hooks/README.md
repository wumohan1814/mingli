# hooks/ — 自定义 Hook

候选（待实现）：

| Hook | 职责 |
|---|---|
| `useAuth` | 鉴权态与刷新令牌维护 |
| `useJobPolling` | **长任务代码轮询**（ADR-0005） |
| `useIntakeForm` | 建档表单与真太阳时开关 |
| `useCalibration` | 问卷逐条反馈收集 |

## `useJobPolling` 约定（ADR-0005）

- **纯代码轮询**：`setInterval` + HTTP `GET /api/jobs/{id}`，**不经过 LLM，零 token 消耗**。
  LLM 只在后端方法模块做分析 / 校验时被调用；轮询只是读任务进度行。
- 间隔建议 2s，带指数退避，上限 10s；任务终态（`succeeded` / `failed`）立即停止。
- 必须处理：超时（前端硬超时略大于后端）、失败重试、页面隐藏时暂停轮询。
- 进度文案示例：「已完成 3/9 种流派分析」。

命名必须 `use` + `PascalCase`，见 `docs/standards/01-命名与变量约定.md` §3。
