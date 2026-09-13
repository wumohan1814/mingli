# profile/ — 模块 7：用户档案模块

读写**用户分析库**（MVP：SQLite `mingli_analytics`），按 `user_id` 逻辑隔离。

## 职责

- 落盘：chart、各法 `method-result`（含 `validation`）、校准记录、对话、报告。
- 订阅 `MethodAnalysisCompleted`，**统一负责落库**，随后发布 `RecordPersisted` 供审计 / 下游。
- 支撑缓存复用：缓存键 `user_id:case_id:method_key:phase:chart_version`，命中即返（零 LLM）。

## 硬约束

所有 `SELECT / UPDATE / DELETE` 必带 `user_id` 条件（含 `archive` 派生视图），
统一走 userId-scoped repository，禁止跨用户直查（C20）。

## 多轮修正

增量写 `conversations`，**不覆盖历史**（项目铁律：历史即数据资产）。
