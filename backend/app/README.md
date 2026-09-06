# app/ — 应用包

模块化单体的进程内模块网格。模块间**只通过事件分发器通信**，方法模块不直调主模块。

## 依赖方向

```
gateway → dispatcher ⇄ { methods, synthesizer, profile, feedback }
methods → paipan（取 slice）
所有对外返回 → guardrails（横切过滤）
任意模块 → shared（配置 / 日志 / DB / LLM 客户端）
```

- 模块**禁止**相互直接 import 业务实现，只能依赖 `shared/` 与事件契约。
- 横切能力（鉴权、护栏、计量、任务进度）通过中间件 / 装饰器注入，不散落进模块内部。
- 事件流向（现行）：
  `gateway` → `jobs`（建任务）→ `dispatcher` 串行派发 → `methods` 分析 → `validation`（仅断前尘）
  → 发布 `MethodAnalysisCompleted` → `profile` 落库 + `jobs` 推进进度 + `synthesizer` 聚合。

## 模块目录

| 目录 | 编号 | 状态 |
|---|---|---|
| `gateway/` | 模块 2 | 已定 |
| `dispatcher/` | 模块 3 | 已定 |
| `paipan/` | 模块 4 | 已定（自研，ADR-0001） |
| `synthesizer/` | 模块 5 | 已定（两阶段合成，R11） |
| `methods/` | 模块 6 | 已定（×9，ADR-0003） |
| `profile/` | 模块 7 | 已定 |
| `feedback/` | 模块 8 | 已定 |
| `guardrails/` | 模块 9 | 已定 |
| `validation/` | 模块 10 | 已定（仅断前尘，ADR-0002） |
| `routing/` | 模块 11 | 已定（配置化，ADR-0004） |
| `jobs/` | 模块 12 | 已定（异步编排，ADR-0005） |
| `shared/` | — | 公共能力 |

> 全仓已无「⚠️ 待决策」模块目录——P0 与全部 P1 已关闭，见 `docs/adr/README.md`。
