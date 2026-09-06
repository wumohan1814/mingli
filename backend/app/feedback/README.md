# feedback/ — 模块 8：质疑模块

读写**跨用户质疑库**（MVP：SQLite `taichu_feedback`，与用户分析库物理 / 逻辑分离）。

## 职责

- 收集：对话中用户提出的"不准 / 质疑"→ `feedbacks`（`confirmed` ｜ `denied` ｜ `corrected`）。
- 归纳：后台周期任务按 `method_key` / `domain` 聚合 → LLM 归纳 → `feedback_summaries`
  → 供方法迭代（更新 method-prompt / 校准权重）。

## 注意

- 质疑库是**跨用户**的，用于方法迭代；不得用于回读单用户档案。
- 归纳任务属后台周期作业，调度方式待定（技术栈清单 T 系列待决项）。
- 写入时不得携带可反推用户身份的明文信息（合规护栏同样覆盖此处）。
