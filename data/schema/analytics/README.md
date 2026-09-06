# analytics/ — 用户分析库 Schema

表：`users`、`refresh_tokens`、`login_attempts`、`cases`、`charts`、`method_results`、
`calibrations`、`conversations`。

**硬约束**：全部业务表按 `user_id` 行级隔离；`archive` 为派生视图，查询同样必带 `user_id`。
