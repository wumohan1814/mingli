# 太初 · 命理 H5 — Code Wiki

> 本文档是「太初 · 多流派 AI 命理 H5」项目的代码全景 Wiki，覆盖整体架构、模块职责、关键类与函数、数据模型、依赖关系与运行方式。供新成员上手、跨模块协作与问题排查使用。
>
> 最后更新：2026-09-10 ｜ 以源码为准（backend/app/）

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈与目录结构](#2-技术栈与目录结构)
3. [整体架构与请求流转](#3-整体架构与请求流转)
4. [核心模块职责](#4-核心模块职责)
5. [数据模型与数据库](#5-数据模型与数据库)
6. [关键类与函数说明](#6-关键类与函数说明)
7. [核心业务流程](#7-核心业务流程)
8. [依赖关系](#8-依赖关系)
9. [配置与运行](#9-配置与运行)
10. [关键约束与红线](#10-关键约束与红线)

---

## 1. 项目概览

**太初** 是一个多流派 AI 命理综合 H5 应用（MVP），主钩子为「事业运势趋势参考」。用户录入生辰 → 排盘 → 断前尘回溯校验 → 多流派 AI 综合解读与趋势预测，支持校准修正、反馈质疑与档案沉淀。

### 业务定位

| 项 | 说明 |
|---|---|
| 产品形态 | H5 单页应用（免构建 CDN React） |
| 核心能力 | 9 法命盘排盘 + 断前尘校验 + 多法综合预测 + 修正对话 |
| 横向扩展 | 六爻/梅花/小六壬等临时起卦、塔罗、占星、MBTI、双人配对、起名 |
| 变现 | 余额系统（按 LLM token 扣费）+ 金数据充值表单 |
| AI 伙伴 | 太初先生 Agent（长期记忆 + 对话） |

### 核心设计理念

- **排盘只由代码产出**：盘面数值是历法算术，零 LLM，LLM 只做解读。
- **模块化单体**：按微服务形状切分模块（12 个），Phase2 可拎成物理服务。
- **method-result v2 契约**：跨模块唯一协商点，所有方法模块输出统一结构。
- **断前尘串行 + 预测并行**：控成本，断前尘 9 法串行逐法扣费，预测阶段可并发扇出。

---

## 2. 技术栈与目录结构

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python 3.13 + FastAPI | 单进程单端口 **8000**，同时服务 `/api` 与前端静态文件 |
| 前端 | 免构建 CDN React 18（**JSX 已预编译为普通 JS，无 Babel 实时转译**） | 权威入口 `frontend/public/index.html`（节110 解耦后 = **入口壳 ~1,380 行** + `js/*.js` + `css/*.css`）；旧 Vite+TS 源码已归档 `_archive/前端-vite-ts-参考实现/` |
| 数据库 | SQLite（三库） | `taichu_analytics` / `taichu_feedback` / `taichu_ops`，位于 `data/*.db` |
| 排盘 | lunar-python + Node 22 子进程 | 八字等走 lunar-python；紫微/占星/七政/奇门/五运六气走 `paipan-node/` |
| LLM | DeepSeek（`deepseek-v4-flash`） | OpenAI 兼容；key 只走 `backend/.env` 的 `TAICHU_LLM_API_KEY` |
| 部署 | Docker 单镜像（Python+Node 双运行时）+ Caddy | `taichu.xyz`；`docker-compose.yml` |

### 目录结构

```
taichu/
├── backend/
│   ├── app/                      # FastAPI 应用主体
│   │   ├── main.py               # 应用入口、路由注册、lifespan、静态托管
│   │   ├── config.py             # pydantic-settings 配置（env 前缀 TAICHU_）
│   │   ├── database.py           # 三库引擎 + Session + 轻量迁移 + FTS5
│   │   ├── errors.py             # 统一错误码与 BizError
│   │   ├── middleware.py         # API 请求埋点中间件
│   │   ├── api/                  # REST API 路由层（14 个路由文件）
│   │   ├── auth/                 # JWT 鉴权 / 注册 / 登录 / captcha
│   │   ├── admin/                # 后台管理 API（/admin）
│   │   ├── paipan/               # 排盘基础模块（engine/slicer/scorer/shensha）
│   │   ├── methods/              # 9 个方法模块（×9 analyzer）
│   │   ├── jobs/                 # 异步任务编排（orchestrator）
│   │   ├── synthesis/            # 跨方法合成器
│   │   ├── routing/              # 阶段4 路由决策（零 LLM）
│   │   ├── validation/           # 断前尘结果校验
│   │   ├── compliance/           # 合规护栏（禁区词 / 免责声明）
│   │   ├── credits/              # 余额系统（账户/流水/充值/轮询）
│   │   ├── memory/               # AI 伙伴长期记忆
│   │   ├── profile/              # 用户档案聚合
│   │   ├── events/               # 埋点事件服务
│   │   ├── llm/                  # LLM 客户端（DeepSeek）
│   │   ├── models/               # ORM 模型（analytics/feedback/ops）
│   │   └── shared/               # 公共工具（占位）
│   ├── paipan-node/              # Node 排盘引擎（server.mjs / ziwei.cjs / extra.mjs）
│   ├── prompts/                  # 自研提示词（method-prompts/shared/interpret/pair/agent/namer）
│   ├── tests/                    # 单元 / 集成测试
│   ├── pyproject.toml            # Python 依赖声明
│   └── README.md
├── frontend/
│   ├── public/                   # 实际生效的前端（index.html + admin.html + 资源）
│   │   ├── index.html            # H5 主入口（入口壳：骨架 + vendor 引入 + 加载顺序 + 全局状态/api）
│   │   ├── admin.html            # 后台管理入口（仍为单文件）
│   │   ├── js/                   # 解耦视图/组件（节110；已预编译普通 JS，禁写 JSX）
│   │   ├── css/                  # tokens / components / pages
│   │   └── vendor/               # 本地化 React / ReactDOM（Babel 已移除）
│   └── （src/ 旧 Vite+TS 源码已归档 _archive/前端-vite-ts-参考实现/）
├── data/                         # 数据目录（migrations/schema/seeds，git 忽略 *.db）
├── docs/                         # 架构、ADR、标准、交接文档
├── docker-compose.yml            # web + caddy 编排
├── Dockerfile                    # Python 3.13 + Node 22 双运行时镜像
├── .env.example                  # 环境变量模板
└── README.md
```

---

## 3. 整体架构与请求流转

### 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    前端（frontend/public）                    │
│        免构建 CDN React 18（预编译 JSX，SPA）                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP /api/*  +  静态资源 /
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI 应用（单端口 8000）                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Gateway 层：CORS / 鉴权 / 限流 / captcha / 埋点中间件  │ │
│  └───────────────────────┬────────────────────────────────┘ │
│  ┌───────────────────────▼────────────────────────────────┐ │
│  │  API 路由层（app/api/*.py）—— 14 个领域路由              │ │
│  └───────────────────────┬────────────────────────────────┘ │
│  ┌───────────────────────▼────────────────────────────────┐ │
│  │  业务编排层                                              │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ paipan  │ │ methods  │ │  jobs    │ │ synthesis │  │ │
│  │  │ 排盘    │ │ ×9 分析  │ │ 异步编排 │ │  综合裁决 │  │ │
│  │  └─────────┘ └──────────┘ └──────────┘ └───────────┘  │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ routing │ │validation│ │compliance│ │  credits  │  │ │
│  │  │ 路由    │ │  校验    │ │  合规    │ │  余额系统 │  │ │
│  │  └─────────┘ └──────────┘ └──────────┘ └───────────┘  │ │
│  └───────────────────────┬────────────────────────────────┘ │
│  ┌───────────────────────▼────────────────────────────────┐ │
│  │  数据层：SQLAlchemy ORM + 三库 Session                    │ │
│  │  analytics │ feedback │ ops                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │  SQLite 三库  │ │ Node 22  │ │ DeepSeek LLM │
    │  data/*.db   │ │ 排盘子进程│ │  (HTTP API)  │
    └──────────────┘ └──────────┘ └──────────────┘
```

### 应用启动 Lifespan（`main.py::lifespan`）

1. `Base.metadata.create_all` 建三库全部表（幂等）。
2. `ensure_schema()` 轻量迁移：为老库 `ALTER TABLE` 补列（jobs.result_json、cases.name/phone/email/default 等）。
3. `ensure_agent_memory_fts()` 创建 FTS5 全文索引 + 同步触发器（agent_memories）。
4. `_recover_orphan_jobs()` 把残留 pending/running 的 job 置为 failed。
5. 启动记忆抽取 worker（`memory_worker_loop` 协程）。
6. 拉起常驻排盘 Node 服务（`paipan-node/server.mjs`，PID 记录）。
7. 若配置了 `TAICHU_JINSHUJU_ACCESS_TOKEN`，启动 APScheduler 金数据充值轮询。
8. **关停**：cancel 记忆 worker、stop scheduler、terminate Node 排盘进程。

### 请求处理流程

1. 请求进入 → CORS 中间件 → 埋点中间件（记录 `/api/*` 到 ops.events）。
2. 路由匹配到 `app/api/*.py` 的 APIRouter。
3. 鉴权：`get_user_id_from_token(authorization)` 从 JWT 取 user_id 注入。
4. 业务逻辑（查库 / 调 LLM / 排盘 / 异步任务）。
5. 统一错误处理：`BizError` → `{code, message, detail}` 信封；其他异常 → 500。
6. 前端路由：`SPAStaticFiles` 捕获 404 回退 `index.html`（纯前端虚拟路径）。

---

## 4. 核心模块职责

### 4.1 API 路由层（`app/api/`）

| 路由文件 | prefix | 职责 |
|---|---|---|
| `cases.py` | `/api/cases` | 建档 / 排盘 / 断前尘 / 校准 / 预测 / 修正对话 / 档案归档 / 命名 / 删除 / 单法直问 / 九法解读 |
| `jobs.py` | `/api/jobs` | 查询异步任务状态（jobId 轮询） |
| `divination.py` | `/api/divinations` | 临时起卦（六爻/梅花/小六壬等 10+ 法）/ 断卦 / 焦点详解 |
| `tarot.py` | `/api/tarot` | 塔罗抽牌 / 综合解读 |
| `astrology.py` | `/api/astrology` | 星座星盘 / 本命解读 |
| `mbti.py` | `/api/mbti` | MBTI 题库 / 判型 / 分享链接 |
| `pair.py` | `/api/pair` | 双人配对解析（国学/西式/MBTI） |
| `namer.py` | `/api/namer` | 起名 |
| `zodiac.py` | `/api/zodiac` | 星座运势 |
| `settings.py` | `/api/settings` | 用户功能设置（7 项开关） |
| `memory.py` | `/api/memory` | AI 伙伴记忆管理 |
| `agent.py` | `/api/agent` | 太初先生 Agent 对话 |
| `assets.py` | `/api/assets` | 素材热更槽查询 |
| `case_share.py` | `/api/case/share` | 帮填一次性分享链接 |

### 4.2 排盘基础模块（`app/paipan/`）

| 文件 | 职责 |
|---|---|
| `engine.py` | 排盘唯一入口 `paipan()`：公历出生信息 → chart dict。八字/lunar-python；紫微/占星/七政/奇门/五运六气走 Node 子进程（HTTP 优先 + subprocess 降级） |
| `slicer.py` | `slice_chart()`：把 chart 按 9 法切成各自片段，压缩 LLM 上下文 |
| `scorer.py` | `score_fit()` / `calibration_weight()`：契合度三因子打分（命中率 0.5 + 命题质量 0.3 + 依据链 0.2），纯代码零 LLM |
| `shensha.py` | `compute_shensha()`：命理神煞查表 |

### 4.3 方法模块（`app/methods/`，9 法）

```
METHOD_KEYS = [
    "bazi-pattern",          # 八字格局
    "bazi-dayun-liunian",    # 八字大运流年
    "bazi-shensha-nayin",    # 八字神煞纳音
    "bazi-hunyin-caiyun",    # 八字婚姻财运（专题）
    "ziwei",                 # 紫微斗数
    "xizhan",                # 西洋占星
    "qizheng",               # 七政四余
    "qimen-lifetime",        # 奇门终身局
    "wuyun-liuqi",           # 五运六气
]
```

每个方法模块目录下只有一个 `analyzer.py`，薄封装委托 `app/methods/base.py::analyze_method()`：

```python
# 以 ziwei 为例
async def analyze(phase, slice_data, user_question="", calibration_feedback=None, continuation=None):
    return await analyze_method("ziwei", phase, slice_data, user_question, calibration_feedback, continuation=continuation)
```

`analyze_method()` 流程：加载 `prompts/method-prompts/<key>.md` → 组装 messages（prompt + 输出格式硬指令）→ 调 LLM（json_mode）→ `parse_method_result()` 稳健解析 JSON → 规范化返回 method-result v2。

### 4.4 异步任务编排（`app/jobs/orchestrator.py`）

| 函数 | 职责 |
|---|---|
| `run_duan_qian_chen(job_id)` | 断前尘：9 法并发（per-job 3 并发 + 全局 100 并发兜底）+ 每法独立 session 内「分析 + 校验 + 落库 + 逐法扣费 + 原子推进度」 → 合成问卷 |
| `run_predict(job_id)` | 预测：路由选法 → 并发扇出（不校验）→ 逐法扣费落库 → `synthesize()` 合成 + 合规 |

关键机制：
- **两层信号量**：全局 `_global_llm_semaphore(100)` + per-job `Semaphore(3)` 嵌套。
- **逐法扣费**：`contextvars.ContextVar` 按 asyncio task 隔离 usage 账本，每法协程「快照差值」即该法消耗。
- **断点续跑**：检测已落库非空结果方法数，0 < done < total 时注入 continuation 上下文。
- **原子推进度**：`_bump_completed()` 用 SQL `completed = completed + 1`，避免并发读改写丢更新。

### 4.5 合成器（`app/synthesis/synthesizer.py`）

`synthesize(method_results, route_decision)`：
- 按路由决策分主/辅方法。
- 聚合所有 conclusions，按 domain 归一（事业/财运/感情/健康/性格/家庭/大势）。
- `_decide_trend()` 裁决整体趋势（吉/凶/平，多数决）。
- 输出固定 8 板块报告：综合趋势 + 性格 + 事业 + 财运 + 感情 + 健康 + 家庭 + 大势。

### 4.6 路由决策（`app/routing/router.py`）

`route(main_question, phase, weights, degraded_methods, user_named_methods)`：
- 纯查表（`ROUTE_TABLE` + `DOMAIN_MAP`），零 LLM。
- 主问领域 → 路由表条目 → 过滤降级方法 → 用户点名方法强制纳入 support。
- 输出 `{main_methods, support_methods, reasons}`。

### 4.7 校验模块（`app/validation/validator.py`）

`validate(method_result, slice_data)`：仅断前尘阶段执行（ADR-0002）。
- 读 `past_propositions`，调独立校验模型（`settings.llm_validation_model`）。
- 输出 `{validated, model, validations:[{proposition_index, claim, severity(error/warning/info), reason}]}`。
- LLM 失败 / 解析失败向上抛，由编排层决定处理。

### 4.8 合规护栏（`app/compliance/guardrails.py`）

- `check_output(text)`：关键词表拦截（医疗/投资/司法/自伤等），返回 `(is_safe, msg)`。
- `append_disclaimer(text)`：追加民俗文化免责声明。
- `filter_forbidden_domains(domains)`：过滤禁区领域。

### 4.9 余额系统（`app/credits/`）

| 文件 | 职责 |
|---|---|
| `service.py` | 核心：`consume`（按 tokens 扣费，`delta = -ceil(tokens/1000)`）/ `recharge` / `check_balance` / `balance` / `transactions` / `manual_adjust`（后台元口径调整） |
| `router.py` | 余额查询 / 流水 / 充值码核销 |
| `codes.py` | 充值码生成与核销 |
| `jinshuju.py` | 金数据充值表单 API 对接 |
| `poller.py` | APScheduler 轮询金数据新提交，自动充值 |
| `labels.py` | 流水 ref → 中文标签映射（`METHOD_ZH` 等） |

换算关系：**1 存储单位 = 1000 tokens**；**1 元 = 10 存储单位 = 10,000 tokens**。

### 4.10 AI 伙伴记忆（`app/memory/service.py`）

- `enqueue_extraction(user_id, last_user_msg_id)`：对话回合结束后 <1ms 入队（零 LLM）。
- `recall_memories(user_id, query, k, mode)`：BM25 相关度 + 时间衰减混合召回，渲染为 system 记忆块。
- `memory_worker_loop()`：进程内单协程，认领 `agent_memory_tasks` → 读 `agent_messages` → LLM 抽取 → 落 `agent_memories`（FTS 触发器同步）→ 指数退避重试 ≤3 次。

### 4.11 LLM 客户端（`app/llm/client.py`）

- `chat(messages, *, model, temperature, max_tokens, json_mode, timeout)`：调 DeepSeek `/chat/completions`。
- 可重试错误（超时/429/5xx/连接错误）指数退避；4xx 不重试。
- `reset_usage()` / `get_usage()`：ContextVar 隔离的 usage 账本。
- `LLMError`：统一异常（含 status / retriable）。

### 4.12 鉴权（`app/auth/router.py`）

- `hash_password` / `verify_password`：PBKDF2-HMAC-SHA256（salt 16 字节，10 万次）。
- `create_access_token` / `create_refresh_token`：JWT HS256，access 30min / refresh 7d。
- `get_user_id_from_token(authorization)`：从 Bearer token 取 user_id。
- 注册：图形验证码 + IP（1h ≤2 次）+ 设备指纹（一设备一账号）双维度限流。
- 登录：连续 5 次失败锁定 24h。

### 4.13 后台管理（`app/admin/router.py`）

- prefix `/admin`，JWT（type=admin）鉴权，角色 admin/operator/viewer。
- 报表 / 登录 / 审计 → ops 库；用户档案 → analytics 库。
- 提示词管理：读写 `backend/prompts/**/*.md`，写前落 `PromptVersion` 快照。
- Agent 运维端点（`/admin/agent/*`）：独立静态 token（`TAICHU_AGENT_TOKEN`），余额调整/重置密码/重置 case。

---

## 5. 数据模型与数据库

### 三库分离

| 库 | 引擎 | 说明 |
|---|---|---|
| `taichu_analytics.db` | `analytics_engine` | 业务主库：用户/档案/盘面/方法结果/任务/对话/余额 |
| `taichu_feedback.db` | `feedback_engine` | 跨用户质疑库：反馈 / 反馈汇总 |
| `taichu_ops.db` | `ops_engine` | 运维库：埋点事件 / 后台账号 / 审计 / 错误上报 / 提示词版本 / 素材槽 |

SQLite 配置：WAL 模式 + busy_timeout 10s + foreign_keys ON（并发写安全）。

### 核心 ORM 模型（`app/models/`）

#### 分析库（analytics.py）

| 模型 | 表 | 说明 |
|---|---|---|
| `User` | users | 用户（username/password_hash/nickname） |
| `RefreshToken` | refresh_tokens | refresh token hash + 过期/撤销 |
| `LoginAttempt` | login_attempts | 登录失败计数与锁定 |
| `RegisterLimit` | register_limits | 注册限流（IP + 设备指纹） |
| `Case` | cases | 命理档案（input_json / status / default / phone / email / mbti_type） |
| `Chart` | charts | 盘面 JSON（唯一事实源，chart_json 全量落库） |
| `MethodResult` | method_results | 方法分析结果（method_key / phase / result_json / validation_json / cached） |
| `Calibration` | calibrations | 校准记录（record_json / fit_json） |
| `Conversation` | conversations | 修正对话（turn / role / content / topic） |
| `Job` | jobs | 异步任务（type=duan-qian-chen\|predict / status / total/completed / result_json） |
| `RouteDecision` | route_decisions | 路由决策记录 |
| `CreditAccount` | credit_accounts | 余额账户（balance / total_consumed / total_recharged） |
| `CreditTransaction` | credit_transactions | 余额流水（delta / type / tokens / ref） |
| `RechargeCode` | recharge_codes | 充值码（TC-XXXXXX，一次性） |
| `SystemConfig` | system_configs | 动态系统配置（recharge_rate / free_credit_on_register） |
| `Divination` | divinations | 临时起卦（method / seed_json / result_json / interpretation_json / focus_interpretations） |
| `TarotReading` | tarot_readings | 塔罗抽牌记录 |
| `AstrologyReading` | astrology_readings | 星座星盘记录 |
| `MbtiResult` | mbti_results | MBTI 判型结果 |
| `MbtiShareLink` | mbti_share_links | MBTI 免登录分享链接 |
| `PairReading` | pair_readings | 双人配对解析记录 |
| `CaseShareLink` | case_share_links | 帮填一次性分享链接 |
| `UserSetting` | user_settings | 用户功能设置（7 项开关） |
| `AgentMemory` | agent_memories | AI 伙伴长期记忆事实（content / fact_type / importance / trust / content_hash 去重） |
| `AgentMemoryTask` | agent_memory_tasks | 记忆抽取任务队列 |
| `AgentMessage` | agent_messages | Agent 对话消息 |

关键枚举：
- `CaseStatus`：created → paipan_done → dqc_running → dqc_done → calibrated → predict_running → predict_done / failed
- `JobType`：duan-qian-chen / predict
- `JobStatus`：pending / running / succeeded / failed
- `Phase`：duan-qian-chen / prediction

#### 反馈库（feedback.py）

| 模型 | 表 | 说明 |
|---|---|---|
| `Feedback` | feedbacks | 用户质疑（case_id / method_key / feedback_type=confirmed\|denied\|corrected） |
| `FeedbackSummary` | feedback_summaries | 反馈汇总（period / denied_count / corrected_count / top_issues / ai_analysis） |

#### 运维库（ops.py）

| 模型 | 表 | 说明 |
|---|---|---|
| `Event` | events | 埋点事件（event_name / user_id / props / ip） |
| `AdminUser` | admin_users | 后台管理员 |
| `AdminAuditLog` | admin_audit_logs | 后台操作审计 |
| `ErrorReport` | error_reports | 错误上报 |
| `PromptVersion` | prompt_versions | 提示词版本快照 |
| `AssetSlot` | asset_slots | 素材热更槽（key / kind / url / opacity / mask_color） |

### 关键索引

- `agent_memories`：`UNIQUE(user_id, content_hash)` 去重；`(user_id, deleted_at, created_at)` 索引。
- `agent_memories_fts`：FTS5 虚拟表（trigram tokenizer），由触发器与事实表同步。
- `events`：`(event_name, created_at)` / `(user_id, created_at)`。
- `method_results`：`(case_id, user_id, phase)` 查询。

---

## 6. 关键类与函数说明

### 应用入口与配置

| 元素 | 位置 | 说明 |
|---|---|---|
| `app` | `main.py` | FastAPI 实例，挂载所有路由 + 静态文件 + 中间件 |
| `lifespan(app)` | `main.py` | 异步上下文管理器，启动/关停生命周期 |
| `SPAStaticFiles` | `main.py` | 继承 StaticFiles，404 回退 index.html（SPA 虚拟路由） |
| `Settings` | `config.py` | pydantic-settings，env 前缀 `TAICHU_`，加载 `.env` |
| `BizError` | `errors.py` | 业务异常，带 code/message/detail，全局转 JSON 信封 |

### 排盘

| 函数 | 位置 | 签名 | 说明 |
|---|---|---|---|
| `paipan` | `paipan/engine.py` | `(year, month, day, hour, minute, gender, name, birthplace, longitude, latitude, true_solar) -> dict` | 排盘唯一入口，返回 chart dict |
| `run_ziwei` | `paipan/engine.py` | `(year, month, day, hour, gender) -> dict \| None` | 紫微排盘，HTTP 优先 + subprocess 降级 |
| `run_extra` | `paipan/engine.py` | `(year, month, day, hour, gender, name, birthplace, longitude, latitude, true_solar) -> dict \| None` | 占星/七政/五运六气/奇门 |
| `slice_chart` | `paipan/slicer.py` | `(chart, methods=None) -> dict[str, dict]` | chart 按方法切片 |
| `score_fit` | `paipan/scorer.py` | `(propositions, results, validations) -> dict` | 契合度三因子打分 |
| `calibration_weight` | `paipan/scorer.py` | `(fit) -> float` | 校准权重 = 0.4 + 0.6 × fit |

### 方法分析

| 函数 | 位置 | 说明 |
|---|---|---|
| `analyze_method` | `methods/base.py` | 通用方法分析：加载 prompt → LLM → 解析 → 规范化 method-result v2 |
| `load_prompt` | `methods/base.py` | 读取 `prompts/method-prompts/<key>.md` |
| `parse_method_result` | `methods/base.py` | 稳健解析 LLM 输出 JSON（去 code fence、截大括号） |
| `ANALYZERS` | `methods/__init__.py` | `{method_key: analyze 协程}`，importlib 按路径加载 |
| `METHOD_KEYS` | `methods/__init__.py` | 9 法注册顺序列表 |

### 任务编排

| 函数 | 位置 | 说明 |
|---|---|---|
| `run_duan_qian_chen` | `jobs/orchestrator.py` | 断前尘编排（并发 + 校验 + 逐法扣费 + 合成问卷） |
| `run_predict` | `jobs/orchestrator.py` | 预测编排（路由 + 并发扇出 + 合成 + 合规） |
| `_bump_completed` | `jobs/orchestrator.py` | 原子推进 job.completed（SQL 自增） |
| `_compose_questionnaire` | `jobs/orchestrator.py` | 从 MethodResult 收集问卷（high/medium 置信度，按 domain 去重，≤10 条） |
| `_apply_compliance` | `jobs/orchestrator.py` | 对 report 文字字段做合规拦截 |

### 合成与路由

| 函数 | 位置 | 说明 |
|---|---|---|
| `synthesize` | `synthesis/synthesizer.py` | 跨方法聚合 → 固定 8 板块报告 |
| `_decide_trend` | `synthesis/synthesizer.py` | 吉/凶/平 多数决 |
| `_normalize_domain` | `synthesis/synthesizer.py` | domain 归一到大标签 |
| `route` | `routing/router.py` | 配置化路由决策（零 LLM） |

### 校验与合规

| 函数 | 位置 | 说明 |
|---|---|---|
| `validate` | `validation/validator.py` | 断前尘命题校验（独立 LLM 模型） |
| `check_output` | `compliance/guardrails.py` | 关键词禁区拦截 |
| `append_disclaimer` | `compliance/guardrails.py` | 追加免责声明 |

### LLM

| 函数 | 位置 | 说明 |
|---|---|---|
| `chat` | `llm/client.py` | 调 DeepSeek chat/completions，返回 `{content, usage, model}` |
| `reset_usage` / `get_usage` | `llm/client.py` | ContextVar 隔离的 usage 账本 |
| `LLMError` | `llm/client.py` | LLM 调用异常 |

### 余额

| 函数 | 位置 | 说明 |
|---|---|---|
| `consume` | `credits/service.py` | 按 tokens 扣费（`-ceil(tokens/1000)`） |
| `check_balance` | `credits/service.py` | 余额 ≤0 抛 BizError 5002 |
| `recharge` | `credits/service.py` | 入账（recharge/manual/free/refund） |
| `balance` | `credits/service.py` | 查余额 |
| `transactions` | `credits/service.py` | 流水分页（带中文 label） |
| `manual_adjust` | `credits/service.py` | 后台元口径调整（×10 折算存储单位） |

### 鉴权

| 函数 | 位置 | 说明 |
|---|---|---|
| `get_user_id_from_token` | `auth/router.py` | 从 Authorization header 提取 user_id |
| `create_access_token` | `auth/router.py` | JWT access token（30min） |
| `hash_password` / `verify_password` | `auth/router.py` | PBKDF2-SHA256 |

---

## 7. 核心业务流程

### 7.1 命盘主流程（国学档案）

```
用户注册/登录
    ↓
POST /api/cases 建档（出生信息）→ Case(status=created)
    ↓
POST /api/cases/{id}/paipan 排盘（零 LLM）
    ├─ lunar-python 排八字/大运/流年/神煞
    ├─ Node 子进程排紫微/占星/七政/奇门/五运六气
    └─ 落 Chart(chart_json) + Case(status=paipan_done)
    ↓
POST /api/cases/{id}/duan-qian-chen 断前尘（异步 job）
    ├─ 路由：9 法全跑
    ├─ 并发（per-job 3 + 全局 100）：每法 analyze + validate → 落 MethodResult
    ├─ 逐法扣费（ContextVar 差值）
    └─ 合成问卷（high/medium 置信度命题，≤10 条）→ Job(result_json)
    ↓
POST /api/cases/{id}/calibration 校准
    ├─ 用户对问卷命题反馈（confirmed/denied/corrected）
    ├─ score_fit 三因子打分 → 落 Calibration(fit_json)
    └─ Case(status=calibrated)
    ↓
POST /api/cases/{id}/predict 预测（异步 job）
    ├─ route 路由选主/辅方法
    ├─ 并发扇出 analyze（不校验）→ 逐法扣费落库
    ├─ synthesize 合成 8 板块报告
    ├─ 合规拦截（禁区词）
    └─ Case(status=predict_done) + Job(result_json.report)
    ↓
POST /api/cases/{id}/revise 修正对话（多轮 LLM）
    ├─ 历史对话 + chart 摘要 → LLM → 落两行 Conversation
    └─ 即时扣费
```

### 7.2 横向扩展流程

| 模块 | 起算（免费/零 LLM） | 解读（LLM 付费/缓存） |
|---|---|---|
| 起卦（divination） | POST /api/divinations 转发 Node → 落 Divination | POST /{id}/interpret → LLM 断卦缓存 |
| 塔罗（tarot） | POST /api/tarot/draw → 落 TarotReading | POST /{id}/interpret → LLM 解读缓存 |
| 占星（astrology） | POST /api/astrology/chart → 落 AstrologyReading | POST /{id}/interpret → LLM 解读缓存 |
| MBTI | POST /api/mbti/score 纯代码判型 → 落 MbtiResult | 免费（零 LLM） |

### 7.3 异步任务轮询

```
前端 POST /api/cases/{id}/duan-qian-chen → 202 {jobId}
前端轮询 GET /api/jobs/{jobId}
    → pending/running: {status, completed, total}
    → succeeded: {status, result: questionnaire}
    → failed: {status, error}
```

---

## 8. 依赖关系

### 内部模块依赖（核心链路）

```
main.py
 ├─ api/cases.py ──→ paipan, methods, jobs/orchestrator, synthesis, credits, llm, compliance
 ├─ jobs/orchestrator.py ──→ paipan(slice), methods, routing, synthesis, validation, compliance, credits, llm
 ├─ methods/base.py ──→ llm, prompts
 ├─ paipan/engine.py ──→ lunar-python, paipan-node(Node)
 ├─ synthesis/synthesizer.py ──→ (纯函数)
 ├─ routing/router.py ──→ (纯查表)
 ├─ validation/validator.py ──→ llm, prompts
 ├─ credits/service.py ──→ models, database
 ├─ memory/service.py ──→ llm, models, database
 └─ llm/client.py ──→ httpx, config
```

### 外部依赖

| 依赖 | 用途 | 来源 |
|---|---|---|
| fastapi | Web 框架 | pip |
| uvicorn | ASGI 服务器 | pip |
| sqlalchemy | ORM | pip |
| pydantic / pydantic-settings | 数据校验 / 配置 | pip |
| python-jose | JWT | pip |
| passlib[bcrypt] | 密码哈希（实际用 PBKDF2） | pip |
| httpx | HTTP 客户端（LLM / Node 排盘） | pip |
| lunar-python | 八字/大运/流年/神煞 | pip |
| apscheduler | 金数据轮询定时任务 | pip |
| pillow | 图片处理 | pip |
| Node 22 | 排盘引擎子进程 | 系统 |
| iztro (Node) | 紫微排盘 | paipan-node/node_modules |
| mingyu-core (Node) | 占星/七政/奇门/五运六气/起卦 | paipan-node/vendor |
| DeepSeek API | LLM 解读 | HTTPS |
| 金数据 API | 充值表单 | HTTPS |

### 提示词依赖

提示词均为自研，位于 `backend/prompts/`：

| 目录 | 数量 | 用途 |
|---|---|---|
| `method-prompts/` | 9 | 9 法分析提示词（每法一文件） |
| `shared/` | 3+ | revise / validation / divination-common |
| `interpret/` | 14 | 起卦/塔罗/占星解读提示词 |
| `pair/` | 4 | 双人配对（bazi/guoxue/mbti/xishi） |
| `agent/` | 2 | 太初先生 Agent（greeting/master） |
| `namer/` | 1 | 起名 |

---

## 9. 配置与运行

### 环境变量（`.env`，前缀 `TAICHU_`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TAICHU_LLM_API_KEY` | "" | **必填** DeepSeek API Key，严禁硬编码 |
| `TAICHU_LLM_BASE_URL` | https://api.deepseek.com | LLM API base |
| `TAICHU_LLM_MODEL` | deepseek-v4-flash | 解读主模型 |
| `TAICHU_LLM_TIMEOUT` | 180.0 | LLM 超时（秒） |
| `TAICHU_LLM_MAX_RETRIES` | 1 | 重试次数 |
| `TAICHU_LLM_TEMPERATURE` | 0.3 | 采样温度 |
| `TAICHU_LLM_MAX_TOKENS` | 12000 | method 输出上限 |
| `TAICHU_JWT_SECRET` | change-me... | JWT 密钥（生产改随机 32 字节） |
| `TAICHU_FREE_CREDIT` | 220 | 注册赠送余额（存储单位） |
| `TAICHU_RECHARGE_RATE` | 10.0 | 1 元 = N 存储单位 |
| `TAICHU_JINSHUJU_ACCESS_TOKEN` | "" | 金数据 token（空=不轮询） |
| `TAICHU_JINSHUJU_ALLOW_MOCK` | true | 自测允许 mock 支付（生产 false） |
| `TAICHU_AGENT_TOKEN` | "" | Agent 运维 token（空=禁用 /admin/agent/*） |
| `TAICHU_PAIPAN_NODE_URL` | http://127.0.0.1:9317 | 常驻排盘 Node 服务地址 |
| `TAICHU_PAIPAN_MAX_CONCURRENCY` | 3 | 排盘并发上限 |
| `TAICHU_LLM_MAX_CONCURRENCY` | 3 | 单用户 method 并发上限 |
| `TAICHU_LLM_GLOBAL_MAX_CONCURRENCY` | 100 | 全局 method 并发兜底 |
| `TAICHU_DB_PATH` | data/taichu_analytics.db | 分析库路径 |
| `TAICHU_CORS_ORIGINS` | localhost:5173 | CORS 允许源 |

### 本地启动

**前提**：Python 3.13+、Node.js 22+

```bash
# 1. 安装后端依赖（仓库根目录）
pip install -e "backend[dev]"

# 2. 配置环境变量
cd backend
copy ..\.env.example .env        # Windows
# 编辑 .env，填入 TAICHU_LLM_API_KEY

# 3. 启动
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**访问**：
- 前端 H5：http://localhost:8000
- API 文档（Swagger）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

### 测试

```bash
cd backend
python -m pytest -q
```

### Docker 部署

```bash
docker-compose up -d
```

- `web` 服务：Python+Node 双运行时镜像，挂载 `/opt/taichu/data` 持久化 SQLite。
- `caddy` 服务：HTTPS 反代到 web（172.28.0.10:8000）。

---

## 10. 关键约束与红线

### 领域约束

1. **排盘只由代码产出**：LLM 严禁心算 / 重排 / 修正任何盘面数值。
2. **多用户隔离**：所有 DB 访问必带 `user_id`，由网关注入，禁止跨用户直查。
3. **注入边界**：每法只喂自己的 slice + 自己的 method-prompt。
4. **断前尘串行**：控成本；预测阶段可并行扇出。
5. **校验仅断前尘**（ADR-0002）：预测阶段跳过，用 confidence_level 纪律兜底。
6. **长任务必须异步**（ADR-0005）：返 jobId，进度落 jobs 表，前端轮询。

### 成本红线

- 排盘 / 校准打分 = 确定性计算零 LLM，不扣费。
- 仅「解读 / 校验 / 修正对话」调 LLM，逐法扣费 + revise/query 即时扣费。
- 扣费失败只记日志，不阻断业务结果。

### 安全红线

- LLM API Key 只允许来自 `TAICHU_LLM_API_KEY` 环境变量 / `backend/.env`，**严禁硬编码**。
- JWT 密钥生产环境必须改随机 32 字节。
- 金数据 `TAICHU_JINSHUJU_ALLOW_MOCK` 生产环境必须设 false。

### 前端红线

- 权威入口只有 `frontend/public/index.html`（+ `admin.html`）；旧 `frontend/src/`（Vite+TS）已归档 `_archive/前端-vite-ts-参考实现/`。
- 拆出的 `frontend/public/js/*.js` 只放**已预编译的普通 JS**，**禁止再写 JSX**（`precompile.js` 门禁会扫描并拒绝含 JSX 的文件）。
- 静态资源必须根绝对路径 `/vendor/*`，禁止相对路径。
- 改 JSX 后须跑 `node frontend/scripts/precompile.js`。

### 术语红线

- `session`（JWT 会话）≠ `case`（命理档案）≠ `job`（异步任务）≠ `phase`（duan-qian-chen/prediction）。
- `方法/法`（9 法）≠ `主模块` ≠ `主问`。

---

## 附录：ADR 决策记录索引

| ADR | 标题 |
|---|---|
| 0001 | 排盘层自研与复用边界 |
| 0002 | 校验子会话仅断前尘阶段执行 |
| 0003 | bazi-hunyin-caiyun 两阶段纳入 |
| 0004 | 路由决策归属 routing 模块 |
| 0005 | 长时编排采用 jobId 与代码轮询 |
| 0006 | 归档以数据库为唯一事实源 |
| 0007 | 维持强制注册 R7 现状 |
| 0008 | JWT 算法采用 HS256 |
| 0009 | 横向扩展技术路线 |

详见 `docs/adr/`。
