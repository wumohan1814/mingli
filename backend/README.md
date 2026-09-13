# backend/ — 后端（模块化单体）

技术栈：**Python 3.13 + FastAPI**；**Node 22 仅作排盘引擎子进程**（`paipan.py` 通过 `subprocess` 调用
`paipan_ziwei.cjs` / `paipan_extra.mjs`）。MVP 单进程部署，模块按微服务形状切分，Phase2 可拎成物理服务。

## 目录

| 路径 | 内容 |
|---|---|
| `app/gateway/` | 模块 2：API 网关 / 鉴权 / 限流 / captcha / CORS |
| `app/dispatcher/` | 模块 3：进程内事件分发器（in-process pub-sub） |
| `app/paipan/` | 模块 4：排盘基础模块（`paipan` / `slice` / `score` 封装） |
| `app/synthesizer/` | 模块 5：主模块（跨方法合成器） |
| `app/methods/` | 模块 6：方法模块 ×**9**（并列，非主子；ADR-0003） |
| `app/profile/` | 模块 7：用户档案模块（用户分析库读写） |
| `app/feedback/` | 模块 8：质疑模块（跨用户质疑库 + 后台归纳） |
| `app/guardrails/` | 模块 9：合规护栏（横切，内嵌各模块返回前） |
| `app/validation/` | 模块 10：结果校验（**仅断前尘阶段**，ADR-0002） |
| `app/routing/` | 模块 11：阶段 4 路由决策（配置化、零 LLM，ADR-0004） |
| `app/jobs/` | 模块 12：异步任务编排（jobId + 代码轮询，ADR-0005） |
| `app/shared/` | 配置、日志、LLM 客户端、DB 访问、可观测 |
| `prompts/` | method-prompts 与 shared 提示词（**自研**，ADR-0001） |
| `reference/mingli/` | 排盘脚本与提示词（**仅参考，不参与构建**，ADR-0001） |
| `tests/` | 单元 / 集成 / 契约测试与 fixtures |

## 模块清单（技术框架方案 §2.3，9 类）

| # | 模块 | 职责 |
|---|---|---|
| 1 | H5 前端 | 见 `../frontend/` |
| 2 | API 网关 / 鉴权 | JWT 会话、路由、限流、captcha、CORS |
| 3 | 进程内事件分发器 | 模块间事件路由；Phase2 升 Redis Streams / Kafka，Schema 不变 |
| 4 | 排盘基础模块 | `paipan` / `slice` / `score`（确定性、零 LLM） |
| 5 | 主模块 | 可选聚合器：断前尘问卷合成 + 预测阶段 5 合并裁决 |
| 6 | 方法模块 ×**9** | 各方法论独立分析，输出 `method-result v2`（ADR-0003） |
| 7 | 用户档案模块 | 用户分析库读写，全盘落库与缓存复用 |
| 8 | 质疑模块 | 质疑反馈收集与后台归纳 |
| 9 | 合规护栏 | 输出侧禁区过滤 + 末行免责 + 占卜门控（横切内嵌） |
| 10 | 校验模块 | 断前尘阶段结果校验（ADR-0002） |
| 11 | 路由模块 | 主问 → 主 / 辅方法决策，配置化零 LLM（ADR-0004） |
| 12 | 任务模块 | 异步任务编排与进度（ADR-0005） |

### 依赖分层（ADR-0001）

| 归属 | 内容 |
|---|---|
| **引入** | `lunar-python` / `iztro` / `mingyu-core`（开源库） |
| **自研** | 排盘胶水与降级、切片、打分、全部提示词、合并规则 |
| **参考** | `reference/mingli/`（不 import、不打包） |

## 构建顺序（技术框架方案 §13）

排盘基础模块 → 数据底座（用户档案 + 质疑）→ 事件分发器 → 网关 / 鉴权 / 护栏 / 限流 → 主模块 →
方法模块逐个（bazi-pattern → bazi-dayun-liunian → bazi-shensha-nayin → bazi-hunyin-caiyun →
ziwei → qizheng → qimen-lifetime → wuyun-liuqi）→ H5 前端。
**self-run 10× 与开发并行**（R9 / R12 成本闸门）。

## 硬约束

1. **排盘只由代码产出**：LLM 严禁心算 / 重排 / 修正任何盘面数值。
2. **多用户隔离**：所有 DB 访问必带 `user_id`，由网关注入 `userId`，禁止跨用户直查（C20，TDD 必测）。
3. **注入边界**：每法只喂自己的 slice + 自己的 method-prompt。
4. **断前尘并发受控**（控成本）：8 法每 job 3 并发限流（详见 `docs/架构设计.md` §7.2，旧稿"严禁并行"已废止）；预测阶段同样并行扇出。
5. **校验仅断前尘**（ADR-0002）：预测阶段跳过，用 `confidence_level` 纪律兜底。
6. **长任务必须异步**（ADR-0005）：断前尘 / 预测返 `jobId`，进度落 `jobs` 表，前端代码轮询（零 LLM）。
