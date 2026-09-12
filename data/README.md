# data/ — 数据层

> Schema 与迁移的**唯一权威位置**。后端不得在代码中隐式建表。

## 三库（技术框架方案 R6 + 后台/埋点库）

| 库 | MVP 文件 | 用途 | 隔离方式 |
|---|---|---|---|
| 用户分析库 | `taichu_analytics.db` | chart、method-result、校准、对话、报告 | 按 `user_id` **逻辑隔离** |
| 跨用户质疑库 | `taichu_feedback.db` | 质疑反馈与归纳汇总，供方法迭代 | 跨用户共享 |
| 后台/埋点库 | `taichu_ops.db` | 埋点 events、后台审计、错误上报 | 后台/运维专用 |

三库**各自独立的迁移版本线**。

## 目录

| 路径 | 内容 |
|---|---|
| `schema/analytics/` | 用户分析库 DDL |
| `schema/feedback/` | 跨用户质疑库 DDL |
| `migrations/analytics/` | 用户分析库迁移脚本 |
| `migrations/feedback/` | 跨用户质疑库迁移脚本 |
| `seeds/` | 本地开发与测试用种子数据（**虚构生辰**） |
| `contracts/` | 跨模块契约样例：`chart.json`、`method-result v2`、`校准记录.json` |

## 纪律

1. 表结构与字段以 `schema/` 为准，字段变更必须走迁移脚本 + 更新
   `docs/standards/03-接口与数据字典.md` §4 / §5。
2. 所有查询必带 `user_id`（用户分析库）；破坏性变更必须提供回滚脚本。
3. SQLite 为 MVP 选择，切换到 PostgreSQL 的时点见技术栈清单 T7。
4. 真实用户数据**禁止**进入仓库；`*.db` 已被 `.gitignore` 排除。
