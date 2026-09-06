# 太初 · Session 交接文档

> 生成时间：2026-09-06（Phase 1–7 全部完成 + 人工联调迭代收尾）
> 当前阶段：**P1/P2 产品化扩展完成**（埋点/后台/积分/错误码；MVP 主链之上，运营地基与积分计费闭环已落地，进入上线准备）
> 工作目录：C:\Users\wumoh\Documents\Vibecoding\taichu

---

## 0. 本次交接的范围说明

本次交接**起始于用户这句话**：

> 「完整地一步一步告诉我，人工干预、检查需要做什么、注意什么、怎么做。我来帮你完成」

自这句话之后的所有改动，均记录在下文（§A 起）。此前（Phase 1–7 主体开发）的历史记录见 `docs/开发日志.md` 与 `docs/测试排查记录.md`。

---

## A. 本轮（人工联调迭代）完成的全部改动

### A.1 环境与启动修复
1. `start.bat` 中文乱码（UTF-8 vs GBK）→ 重写为纯 ASCII 英文提示。
2. `pip install -e backend` 失败 → `pyproject.toml` 补 `[build-system]` + `[tool.setuptools.packages.find]`（包名 `app` 而非 `taichu-backend`）。

### A.2 排盘/LLM 后端修复
3. **LLM「content 为空」**：DeepSeek V4 Flash 是推理模型，json_mode 下 JSON 落在 `reasoning_content` 而非 `content` → `app/llm/client.py` 的 `_parse_success` 加 `reasoning_content` 回退。
4. **LLM 无限重试/计费失控**：重试 `llm_max_retries` 2→1（最多 2 次尝试）；`orchestrator.py` 加「连续 2 法 LLM 失败即停止」快速失败。
5. **成本计量补缓存命中**：`client.py` 的 usage 加 `prompt_cache_hit_tokens`；新增 `backend/scripts/cost.py`（按峰谷 + 缓存命中算金额）。
6. **占星盘「格局」英文**：`extra.mjs` 加 `localizeWestern`，把 `summary.patterns` 的英文格局名/星体名中文化。
7. **合成板块归一化**：`synthesizer.py` 加 `_normalize_domain`，把「事业总断/事业/财运/事业合作」等细碎 domain 归一到大标签（事业/财运/感情/健康/性格/家庭/迁移）。
8. **合成免责冗余**：去掉 `orchestrator.py` 的 `_apply_disclaimer` 调用（免责由前端全局 `DisclaimerFooter` 统一展示，不再混进 report 文字）。

### A.3 后端功能增强
9. **档案列表**：`GET /api/cases`（含 `name/methodCount/totalMethods/chartSummary/hasReport`）。
10. **档案命名/删除**：`Case.name` 字段 + 幂等迁移；`PATCH /api/cases/{id}`、`DELETE /api/cases/{id}`（级联删 6 张子表）。
11. **读历史解读**：`GET /api/cases/{id}/report`（读最新 predict 报告，零 LLM）。
12. **板块追问归档**：`Conversation.topic` 字段 + 迁移；`revise` 落库存 topic；`archive` 返回 topic（跨次持久化，跟着档案走）。
13. **板块追问 context**：`ReviseRequest` 加 `topic` 字段。
14. **合规护栏补全**：`revise` 端点补 `check_output`（禁区词拦截）。

### A.4 前端改造（frontend/public/index.html，免构建 CDN React）
15. **建档页**：年/月/日/时辰改下拉；出生地省/市/区三级联动（`vendor/regions.js`，31 省 342 市 2978 区县）；表单 localStorage 持久化（`taichu_onboarding_form`）；删除旧 `CITY_COORDS` 死代码。
16. **档案列表页**（CasesPage）：展示档案（名称/进度/盘面摘要）；命名、删除、查看排盘、继续排盘（methodCount<9 时）、查看解读/继续。
17. **解读页**（PredictPage）：先读历史 report（不重调 LLM）；板块整卡可点「查看详情」进独立板块页；去置信度灰字；底部按钮重构（追问解读/回到档案/回到档案列表/回到首页/退出登录）。
18. **板块详情页**（TopicPage，新增）：板块独立解读 + 趋势 + 该板块追问（跨次回显历史）。
19. **追问解读页**（RevisePage）：初始内容=综合评定+通用引导语（不限事业运势）；移除退出登录；底部小按钮排版。
20. **401 自动续期**：`api()` 遇 401 用 refresh_token 静默刷新并重试，且**同时更新 access+refresh token**（refresh 端点会撤销旧 refresh_token）。
21. **首页文案**：标题「太初 · 九法合参，看清你的人生大势」；副标题「九大流派交叉印证 · 越用越懂你 · 更接近真实」；按钮「开始我的命理推演」（已登录进档案列表、未登录去注册）；三卡「更准确的回答」。
22. **注册协议**：勾选框默认已勾选，未勾选不能注册；页尾全局加「用户协议 · 隐私政策」链接；生成 `frontend/public/legal/用户协议.html` + `隐私政策.html`（从 `docs/legal/*.md` 转换）。

### A.5 提示词与回归
23. 9 个 method-prompts 自研重写（参考 mingli 规则、对齐 slice + method-result v2）。
24. 每个 prompt 加「通俗化约束」7 条：公历年份、术语白话、claim 通俗、不伪精确、红线不变、领域覆盖、简洁克制。
25. 排盘回归基线（`tests/fixtures/chart.json` + 9 片快照 + `test_paipan.py` 9 用例）。
26. 编排回归（`test_orchestration.py` 5 用例）。
27. 端到端集成测试（`test_e2e_flow.py` + `test_e2e_isolation.py`）。
28. **案例库回归锚点**（新增）：`tests/fixtures/method_anchor.json` + `test_method_anchor.py`（防 prompt 漂移）。

### A.6 合规与授权
29. LICENSE：MIT，版权人 `wumohan`。
30. 用户协议/隐私政策接入（`docs/legal/` + 前端勾选 + 页尾链接）。

### A.7 测试与成本
31. **pytest 19 passed**（排盘 9 + 编排 5 + 端到端 3 + 锚点 2）。
32. **self-run 成本实测**：用 test1 这一轮结果作锚（不再跑 10 次）。单 case 首跑全盘 ≈ **¥1.06**（断前尘 ¥0.84 + 预测 ¥0.22，约 23 次调用）；`COST_GATE_MODE` 维持 `full`。

### A.8 线上部署准备（服务器就绪 + 部署文件，尚未拉取部署）
33. **服务器选型**：香港轻量下架 → 选**新加坡 2核1G**（阿里云，Ubuntu 24.04，免备案）；域名 `mingli.example.com` A 记录已解析到服务器。实测排盘 Node 常驻进程仅约 100MB，1G 内存 + 1G swap 足够。
34. **服务器准备（已完成）**：swap 1G；Docker 29.8.0 + Compose v5.5.1；部署目录 `/opt/taichu/{data,backup}`；GitHub 只读 Deploy Key（已验证可拉 private 仓库，commit `f35f191`）。
35. **部署文件（已写，未 commit）**：
    - `Dockerfile`：Python 3.13 + Node 22 双运行时镜像，排盘 `node_modules/vendor` 打包进镜像（服务器不 npm install）。
    - `.dockerignore`：排除 `.env`/`*.db`/`reference`/`frontend/node_modules` 等，保留排盘依赖。
    - `docker-compose.yml`：web 单体 + Caddy，SQLite 卷挂载 `/opt/taichu/data`。
    - `Caddyfile`：`mingli.example.com` 自动 Let's Encrypt HTTPS + 反代。
    - `ops/deploy/{deploy.sh, backup.sh, README.md}`：一键部署、每日 SQLite 备份、部署说明。
36. **部署架构决策**：Caddy HTTPS 反代 → web 单体（FastAPI + Node 排盘常驻 `server.mjs` + SQLite 持久卷）；数据库继续 SQLite（PostgreSQL 留 Phase2）；密钥 `.env` 注入（JWT_SECRET 自动随机、LLM key 用户填）。

---

## B. 剩余需要人工处理的事项（详见 `docs/人工注意点清单.md` 与 `docs/人工操作手册.md`）

1. **收款（小鹅通 webhook）**：明确排除在产品化扩展之外，**留待用户单独处理**（P2 手动分发已可先用）。
2. **线上部署**：服务器（新加坡 2核1G）+ Docker/Caddy 部署文件均已就绪，尚未正式拉取代码上线。
3. **前端浏览器实测**：C 端 index.html 已基本点完；**新增后台 `frontend/public/admin.html` 尚未浏览器实测**，需人工点一遍（登录/报表/用户档案/prompt 管理/手动赠积分/运维动作）。
4. **后端 admin 手工走查**：后台登录、`POST /admin/credits/manual` 手动赠积分、运维动作（换 LLM key/重置密码/重置档案）建议 self-run 时顺带抽检。
5. **案例库锚点补全**：目前仅 bazi-pattern 真调过并立锚；其余 8 法建议 self-run 时顺带真调抽检、补锚点防 prompt 漂移。
6. **协议合规律师定稿**：用户明确「暂时先不处理」，留待上线前。
7. **运营合规决策**（数据出境、算法备案、服务定性等）：见 `docs/legal/交付说明与风险清单.md` 第四、五节，需用户决策。

---

## C. 快速启动

```bash
cd C:\Users\wumoh\Documents\Vibecoding\taichu
start.bat          # 或 cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# 前端 http://localhost:8000 | API 文档 /docs
```

依赖：Python 3.13 + Node 22（排盘引擎）；`pip install -e backend`（已可正常安装）；前端免构建无需 npm install；LLM key 在 `backend/.env`。

测试：`cd backend && python -m pytest -q`（24 passed）。

---

## D. 关键文档索引

- `docs/人工操作手册.md` —— 一步步人工验收清单
- `docs/人工注意点清单.md` —— 22 条注意点 + 待办
- `docs/测试排查记录.md` —— 已修复问题台账 + self-run 成本
- `docs/盘面UI元素清单.md` —— 完整盘面 UI 元素（转 UI 人员）
- `docs/前端改造交接说明.md` —— 免构建前端契约
- `docs/API-Key安全与LLM接入说明.md` —— DeepSeek 接入与 key 安全
- `docs/legal/` —— 用户协议、隐私政策、交付说明与风险清单
- `docs/开发日志.md` —— Phase 1–7 开发记录
- `ops/deploy/README.md` —— 线上部署说明（Docker + Caddy + SQLite 持久化 + 每日备份）

---

## E. 产品化扩展架构交接（设计参考；P1/P2 已实现，落地记录见 §F）

> 本段起始于用户问「数据库架构、埋点、后台管理、积分、错误码怎么做」。
> 目标：让读本交接文档的 session，知道**要看哪些文档、怎么落地这套新架构**。

### E.0 需求范围与已定决策

用户提出的 5 项扩展 + 积分补充需求，**除「接支付系统」外**全部纳入：

| # | 内容 | 状态 |
|---|---|---|
| 1 | 初期数据库架构（用户/排盘/档案/其他数据） | ✅ 已实现（见 §F） |
| 2 | 完整产品埋点方案 | ✅ 已实现（见 §F） |
| 3 | 简单后台管理系统（报表/运维/prompt/用户档案） | ✅ 已实现（见 §F） |
| 4 | 积分系统（token → 积分，充值/手动分发） | ✅ 已实现（见 §F） |
| 5 | 报错与错误代码体系 | ✅ 已实现（见 §F） |
| — | 积分折算 + 运维空间 | ✅ 已实现（见 §F） |
| — | **接支付系统（小鹅通 webhook 充值）** | **❌ 明确排除，用户单独处理** |

**已拍板的决策**：
- 积分换算：**1 积分 = 1000 tokens**（DeepSeek V4 flash）。
- 充值折算：**1 元 = 10 积分**（默认值，存 `system_configs` 表，后台可动态改、无需重启）。
- 运维空间：后台**手动赠送积分**（查用户余额 → 输入数量 + 备注 → 入账 + 审计）。

### E.1 必须阅读的文档（按顺序）

1. **`docs/架构设计-产品化扩展.md`** —— 总览：五大内容各自的表结构、模块、流程、分期（P1 运营最小闭环 / P2 收费闭环 / P3 增强）。
2. **`docs/架构设计-积分系统开发方案.md`** —— 积分系统详细开发方案：常量/配置、`system_configs` 表、`credit_accounts`/`credit_transactions` 表、计费流程（扣费点/拦截点）、API 契约、错误码、埋点、测试要点、实施步骤（6 步）。
3. **`docs/UI-积分系统.md`** —— UI 元素清单：C 端 7 元素 + 后台运维空间 2 元素（配置页/手动赠送）。
4. 现有基线：`docs/standards/03-接口与数据字典.md`（现有 12 表 + 契约）、本文档 §A（现有实现）。

### E.2 五大内容「怎么做」速览

1. **数据库**：新增 `taichu_ops` 库（`events`/`admin_users`/`admin_audit_logs`/`error_reports`）；`taichu_analytics` 库加 `credit_accounts`/`credit_transactions`/`system_configs`。沿用 `ensure_schema()` 幂等迁移。
2. **埋点**：`events` 表 + 三通道采集（前端 `POST /api/events`、后端 middleware 记请求、LLM client 记 `llm_call`）；核心漏斗 = 注册→建档→排盘→断前尘→校准→预测。
3. **后台**：独立 `/admin/*` 路由 + `admin.html`（复用免构建模式），三级权限；报表聚合 `events`，运维动作全写 `admin_audit_logs`。
4. **积分**：`check_balance`（预检）+ `consume`（按 `ceil(tokens/1000)` 扣）在 3 处计费点接入（断前尘编排/预测编排/revise+单法直问）；不扣排盘与校准打分。
5. **错误码**：`app/errors.py` 定义 `BizError(code,message,detail)` + 全局异常处理器；分段（1xxx 通用/2xxx 认证/3xxx case/4xxx 排盘/5xxx LLM积分/9xxx 系统）；前端 `api()` 拦截按 code 显示友好文案 + 上报 `error_reports`。

### E.3 实施分期（建议顺序）

| 期 | 内容 | 备注 |
|---|---|---|
| **P1** | `taichu_ops` 库 + `events` 埋点 + 统一错误码 + 后台最小版（报表/档案/prompt 编辑） | 地基 |
| **P2** | 积分（`system_configs` + `credit_*` 表 + 计费接入 + 余额拦截 + 运维手动赠送）+ 后台运维动作 | 收费闭环 |
| **P3** | 小鹅通 webhook 充值 + 报表可视化增强 | **支付部分由用户单独处理** |

### E.4 执行提示（P1/P2 已按此落地，以下为当时的实现约定，供复盘参考）

- **延续约定**：模块化单体 + SQLite 逻辑分库 + FastAPI + 免构建前端；按「拆小 + code_flash 实现 + 主会话评审验收」推进。
- **先做 P1 的 `taichu_ops` 库 + 统一错误码**（它们是积分和后台的地基）。
- 积分计费点要复用现有 `usage` ledger（`get_usage`）避免侵入方法模块；`analyze_method`/`validate` 保持纯函数。
- 手动赠送积分必须写 `admin_audit_logs`；充值折算率改 `system_configs` 而非硬编码。
- **不要碰支付 webhook**（小鹅通），留待用户明确要求。
- `docs/架构设计-产品化扩展.md` —— 产品化扩展五大内容总览（数据库/埋点/后台/积分/错误码）
- `docs/架构设计-积分系统开发方案.md` —— 积分系统开发方案（1 积分 = 1000 tokens）
- `docs/UI-积分系统.md` —— 积分 UI 元素清单（C 端 + 后台运维空间）

---

## F. P1/P2 产品化扩展（已实现）

> 承接 §E 的架构设计（`docs/架构设计-产品化扩展.md` + `docs/架构设计-积分系统开发方案.md`）落地。**P1（运营地基）+ P2（积分收费闭环）已全部完成**；收款（小鹅通 webhook）明确排除、由用户单独处理。当前 pytest 全量 **24 passed**。

### F.1 P1 —— 运营地基（taichu_ops 库 + 错误码 + 埋点 + 后台最小版）
1. **taichu_ops 逻辑库 4 表**：`events` / `admin_users` / `admin_audit_logs` / `error_reports`（沿用 `ensure_schema()` 幂等迁移）。
2. **统一错误码体系**：`backend/app/errors.py` 定义 `BizError(code, message, detail)` + 全局异常处理器；分段码 **1xxx 通用 / 2xxx 认证 / 3xxx case / 4xxx 排盘 / 5xxx LLM·积分 / 9xxx 系统**。
3. **埋点三通道**：前端 `track`（`POST /api/events`）+ 后端 `api_request` middleware + LLM `llm_call`（记模型/usage/成本）；报表聚合 `events`。
4. **后台最小版**：后端 `backend/app/admin/`（登录/报表/用户档案/prompt 管理）+ 前端 `frontend/public/admin.html`（复用 CDN 免构建模式）。
5. C 端 `api()` 按错误码显示友好文案，并把报错上报 `error_reports`。

### F.2 P2 —— 积分系统（收费闭环）
1. **3 张新表**：`credit_accounts` / `credit_transactions` / `system_configs`（幂等迁移）。
2. **积分服务**：`backend/app/credits/service.py` —— `balance` / `check_balance`（预检）/ `consume`（按 `ceil(tokens/1000)` 扣）/ `recharge` / `manual` / `transactions`。
3. **计费接入 3 处**：断前尘编排 / 预测编排 / revise + 单法直问（query）端点；**排盘与校准打分不扣费**。
4. **注册赠送**：新用户注册送 **100 积分**。
5. **C 端 API**：`GET /api/credits/balance`、`GET /api/credits/transactions`。
6. **后台手动分发**：`POST /admin/credits/manual`（查用户余额 → 输入数量 + 备注 → 入账 + 写 `admin_audit_logs`）。
7. **后台运维动作**：换 LLM key / 重置密码 / 重置档案（均写审计）。
8. 折算率配置化：1 积分 = 1000 tokens、1 元 = 10 积分（默认值存 `system_configs`，后台可动态改、无需重启）。

### F.3 关键决策（落地确认）
- **1 积分 = 1000 tokens**（DeepSeek V4 flash），`consume` 按 `ceil(tokens/1000)` 扣整数；折算率不硬编码、存 `system_configs` 可动态改。
- **计费点收敛 3 处**（断前尘编排 / 预测编排 / revise+query），复用现有 usage ledger（`get_usage`），`analyze_method`/`validate` 保持纯函数不侵入。
- **audit 必写**：手动赠送与运维动作（换 key/重置密码/重置档案）一律写 `admin_audit_logs`。
- **余额预检与扣费分离**：请求前 `check_balance` 拦截，成功后 `consume` 入账。
- **收款不接**：小鹅通 webhook 明确排除，留待用户单独处理。
- pytest 全量 **24 passed**（在 §A 的 19 passed 之上新增积分/埋点/错误码用例）。
