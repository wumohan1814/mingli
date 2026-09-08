# 太初 · Session 交接文档

> 生成时间：2026-09-06（本 Session 更新版：性能优化 / 金数据支付接入 / 注册验证码之后）
> 当前阶段：**Phase 1–7 + P1/P2 产品化扩展全部完成 + 线上已部署**；本 Session 追加完成：**网站性能优化（系统字体 / Caddy gzip·zstd / JSX 预编译）、金数据支付系统接入、注册图形验证码 + 确认密码、免费积分调至 220、充值 UI 暂时隐藏、docs 归档清理、admin 报表埋点中文映射**；**金数据商户认证未完成，支付闭环待用户自行验证**
> 工作目录：C:\Users\wumoh\Documents\Vibecoding\taichu

> 本文件是「当前状态快照」。此前所有 session 的内容已全部完成交接，之后将从本 session 分叉继续。历史开发记录见 `docs/开发日志.md`。

---

## 1. 项目概述

太初 = 多流派 AI 命理综合 H5（MVP），主钩子「事业运势趋势参考」。融合 9 个方法论：
八字×4（格局 / 大运流年 / 神煞纳音 / 婚姻财运事业专题）+ 紫微 + 西占 + 七政 + 奇门终身局 + 五运六气。

核心链路：**建档 → 排盘（确定性零 LLM）→ 断前尘（9 法串行 + 校验）→ 校准 → 预测（路由并行 + 合成）→ 追问修正 → 档案**。

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python 3.13 + FastAPI | 模块化单体，单端口 8000 同时服务 `/api` + 前端静态 |
| 数据库 | SQLite **三库** | analytics（业务+积分）/ feedback（质疑）/ ops（埋点+后台+错误） |
| 前端 | 免构建 CDN React 18（JSX 已预编译，无 Babel Standalone 实时编译） | 权威入口 `frontend/public/index.html` + `admin.html`；`src/` 不参与运行 |
| 排盘 | lunar-python / iztro / mingyu-core | Python + Node 22 双运行时（常驻 `paipan-node/server.mjs`，subprocess 降级） |
| LLM | DeepSeek 官方 API | `deepseek-v4-flash`，OpenAI 兼容，key 在 `backend/.env` |
| 部署 | Docker + Caddy | 单镜像（双运行时）+ Caddy HTTPS 反代（gzip/zstd 压缩）+ SQLite 持久卷 |
| 支付 | 金数据表单 + APScheduler 轮询 | 充值码核销入账；**商户认证未完成，暂不可用** |

## 3. 数据库（三库）

| 库 | 职责 | 表 |
|---|---|---|
| `taichu_analytics` | 用户/排盘/档案/**积分/充值码** | users、refresh_tokens、login_attempts、cases、charts、method_results、calibrations、conversations、jobs、route_decisions、**credit_accounts、credit_transactions、recharge_codes、system_configs** |
| `taichu_feedback` | 跨用户质疑 | feedbacks、feedback_summaries |
| `taichu_ops` | 埋点/后台/错误 | events、admin_users、admin_audit_logs、error_reports |

> 迁移：`database.ensure_schema()` 幂等 ALTER + create_all；首次启动自动执行。

## 4. 已完成内容（分阶段）

- **Phase 1–2**：工程骨架 + 数据底座（用户/JWT/质疑/合规）
- **Phase 3**：排盘引擎（`app/paipan/`：engine + shensha + slicer + scorer，自研）
- **Phase 4**：LLM 接入 + 异步编排（`app/llm/`、`app/methods/` 9 法、`app/validation/`、`app/jobs/orchestrator.py`、jobId 轮询）
- **Phase 5**：API 层（calibration/revise/archive/query 真实化 + 9 个 method-prompts 自研重写 + check_output 接线）
- **Phase 6**：前端（8+ 页接入真实 API + 皮肤 + 双信封 + 失败态 + 档案列表/板块详情）
- **Phase 7**：集成测试 + 文档（端到端 happy path + 隔离/降级 + README/LICENSE/CONTRIBUTING + 人工注意点清单）
- **P1 产品化扩展**：taichu_ops 库 + 统一错误码（`app/errors.py`）+ 埋点三通道 + 后台最小版
- **P2 积分系统**：credit 3 表 + `app/credits/` + 计费接入 + 注册赠送 + 手动分发 + 运维动作
- **性能 / 支付 / 注册安全（2026-09-06，上线后追加）**：
  1. **网站性能修复**：移除 Google Fonts 改系统字体（国内访问被墙拖慢首屏）；Caddy 开 gzip/zstd（`Caddyfile` 一行 `encode gzip zstd`）；前端 JSX 预编译去 Babel —— 浏览器端不再加载 3.1MB `babel.min.js`、不再实时转译，产物为普通 JS（`node frontend/scripts/precompile.js` 可复跑，原地改写 index.html / admin.html）
  2. **金数据支付系统接入**：`recharge_codes` 表 + `app/credits/codes.py`（一次性充值码）+ `jinshuju.py`（拉单）+ `poller.py`（幂等入账）+ `POST /api/credits/charge-code`（换码 + 表单 URL）+ APScheduler 5 分钟轮询 + 前端充值入口与到账轮询（4 秒查余额 / 10 分钟窗口）；**金数据 token 已配服务器 .env；商户认证未完成 → 支付暂不可用，由用户后续自行验证**
  3. **注册图形验证码 + 确认密码**：`app/auth/captcha.py`（PIL 生成 4 位 PNG，去混淆字符，5 分钟 TTL，一次性，内存存储不落盘）+ `GET /api/auth/captcha` + RegisterRequest 增 `captcha_id`/`captcha_code` + 注册页确认密码与验证码 UI；**Pillow 已加进 pyproject 依赖**（容器缺它曾致 502）
  4. **免费积分 100 → 220**：`free_credit_on_register` 默认 220（= 22 万 tokens ≈ 9 盘首跑 + 3 次追问）
  5. **隐藏充值 UI**：前端 4 处充值入口隐藏（商户认证未完成，避免引导支付后无法入账）；后端充值端点、`startRecharge` / `fetchCreditBalance` 函数均保留，恢复时只放开前端入口
  6. **docs 清理**：8 个过时文档移入 `docs/_archive/`（附 README 说明）
  7. **运维后台埋点中文映射**：admin 报表 event_name → 中文展示（如注册/建档/排盘/断前尘/校准/预测完成），event_key 保留英文

## 5. 关键模块 / 端点清单

### 对外 REST（C 端，`/api/*`）
**auth/captcha**（注册图形验证码）· auth/register · auth/login · auth/refresh · cases · cases/{id}/paipan · cases/{id}/duan-qian-chen · cases/{id}/calibration · cases/{id}/predict · cases/{id}/revise · cases/{id}/query/{method_key} · cases/{id}/archive · jobs/{id} · **credits/balance · credits/transactions · credits/charge-code**（充值换码）· **events**（埋点）

### 后台（`/admin/*`，admin.html）
login · reports/{metric} · users?q= · users/{id}/cases · users/{id}/cases/{caseId} · prompts · prompts/{key} · **credits/manual** · **ops/llm-key · ops/users/{id}/reset-password · ops/users/{id}/reset-case**

### 积分计费点（3 处，复用 usage ledger，不侵入方法模块）
1. 断前尘编排（run_duan_qian_chen）
2. 预测编排（run_predict）
3. 同步端点（revise + query/{method_key}）

## 6. 关键决策

| 项 | 决策 |
|---|---|
| 积分换算 | **1 积分 = 1000 tokens**；扣费 `ceil(tokens/1000)`；余额可为负 |
| 充值折算 | 1 元 = 10 积分（`system_configs` 可动态改，无需重启） |
| 注册赠送 | 新用户送 **220** 积分 = 22 万 tokens ≈ 9 盘首跑 + 3 次追问（`TAICHU_FREE_CREDIT`，默认 220） |
| 计费范围 | 只扣 LLM 调用；排盘、校准打分不扣 |
| 前端 | 免构建 CDN React；JSX 由 `frontend/scripts/precompile.js` 预编译为普通 JS，浏览器端无 Babel Standalone / 实时转译 |
| Key | 明文 `backend/.env`（gitignore 已忽略），升级路径见安全说明文档 |
| 收款 | **金数据表单支付**：一次性充值码（`recharge_codes`）+ APScheduler 5 分钟轮询幂等入账（`serial_number` 去重 + 码 unused 校验防重放）；**商户认证未完成，支付暂不可用，用户自行验证**；`TAICHU_JINSHUJU_ALLOW_MOCK=false` 防模拟表单白送积分；小鹅通 webhook 仍明确排除 |
| 编排 | 直接调用（单进程内等价事件分发器） |

## 7. 剩余待办

1. **商户认证 + 支付全链路验证（用户自行）**：金数据 token 已配服务器 .env，`TAICHU_JINSHUJU_ALLOW_MOCK=false` 已设（生产只认 `TRADE_SUCCESS`，防模拟表单白送积分）；待商户认证通过后由用户真支付一笔，验证「charge-code 换码 → 金数据支付 → 轮询入账 → 余额到账」闭环，并核对该笔 `credit_recharge` 埋点
2. **恢复充值 UI（商户认证通过后）**：放开前端 4 处充值入口即可 —— 后端 `POST /api/credits/charge-code`、到账轮询、`startRecharge` / `fetchCreditBalance` 均已保留，无需改后端
3. 前端 admin.html 浏览器实测（JSX 已预编译为普通 JS，无实时转译，可直接真机复验）
4. 后端 admin 手工走查（登录/手动赠积分/运维动作 + 报表埋点中文映射目检）
5. 案例库锚点补全（其余 8 法真调抽检，防 prompt 漂移）
6. 协议律师定稿、运营合规决策（数据出境/算法备案/服务定性）
7. 收款（小鹅通 webhook）——用户明确排除，后续单独处理（独立于金数据路线）

> 线上部署已完成（见 §9）。上线内容含性能优化（系统字体 / gzip·zstd / JSX 预编译），建议真机复验一次首屏加载。

## 8. 关键文档索引

- `docs/架构设计.md` —— **现行唯一架构设计文档**（技术栈 / 数据 / 排盘 / LLM / 编排 / 校验 / 积分 / 支付 / 埋点后台 / 部署 / 成本 / 演进；含并发限流、逐法扣费、continuation 断点续跑、job 幂等、case 状态机、免费积分 220 等现行机制）
- `docs/前端改造交接说明.md` —— 免构建前端契约（JSX 预编译后仍适用）
- `docs/API-Key安全与LLM接入说明.md` —— key 安全
- `docs/legal/` —— 协议/隐私/风险清单
- `ops/deploy/README.md` —— 部署说明
- `docs/开发日志.md` —— 完整开发记录
- `docs/_archive/` —— 已归档过时文档（含 README）：太初技术框架方案、太初技术框架方案_审查、架构设计-产品化扩展、架构设计-积分系统开发方案、架构设计-支付系统-金数据、00-工程骨架、太初H5界面设计方案、UI-积分系统、盘面UI元素清单、人工操作手册、人工注意点清单、小金商户助手-收款业务描述、测试排查记录

## 9. 快速启动 + 部署

### 本地
```bash
cd C:\Users\wumoh\Documents\Vibecoding\taichu
start.bat          # 或 cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# 前端 http://localhost:8000 | API /docs | 后台 /admin.html
```
依赖：Python 3.13 + Node 22；`pip install -e backend`；前端免构建无需 npm install（**改动 JSX 后需 `node frontend/scripts/precompile.js` 重新预编译再提交**）；LLM key 在 `backend/.env`。测试 `cd backend && python -m pytest -q`（24 passed）。

### 线上（服务器）
```bash
cd /opt/taichu/app && git pull
docker compose up -d --build
docker compose ps && docker compose logs -f web
# 访问 https://taichu.xyz
```
部署文件：`Dockerfile` / `docker-compose.yml` / `Caddyfile` / `ops/deploy/{deploy.sh, backup.sh}`（均已推送 GitHub，含 `TAICHU_OPS_DB_PATH` 持久化修复）。

### ⚠️ 服务器运维注意事项（勿回滚，详见 `ops/deploy/README.md`「服务器运维注意事项」）

1. **DNS 已改为海外公共 DNS**：阿里云新加坡 ECS 默认 DNS `100.100.2.136` 在新加坡不可达，国内 `223.5.5.5` 跨境会超时（卡死 sshd），已通过 netplan 持久化为 `8.8.8.8 / 1.1.1.1` 并关 sshd `UseDNS no`。**勿改回 100.100.2.x 或 223.5.5.5**。
2. **OpenClaw 接入点 `bb3a.taichu.xyz`（公网可访问 + 回程走 Tailscale）**：Caddy 上游用 Tailscale IP `100.79.80.16:443` + `tls_server_name ecs-openclaw.tail5b95c6.ts.net`（容器内无法解析 MagicDNS 域名，故用 IP+SNI）。**此入口公网可达，靠随机子域 + 配对 token 保护，勿移除配对 token。**
3. **证书续期**：`bb3a` 子域 DNS 指向公网 IP，HTTP-01 续期正常，无需特殊处理。
4. **SSH 已改密钥登录**：已禁用密码登录，仅可用 `~/.ssh/taichu_sg_ed25519` 登录。

---

## 10. 需求 / Bug 管理 Session 轮次记录

> 自 2026-09-08 起，由**需求/Bug 管理员 Session** 专职维护 `docs/需求表.md` 与 `docs/Bug管理表.md`（单一事实源），遵循 `docs/开发测试协作协议.md`。

### 2026-09-08 轮（首轮，台账审计补记）

**本轮做了什么**：
- 通读 docs 全貌（README / 需求表 / Bug 表 / 交接 / 协作协议 / 测试组交接 / 开发日志 / standards / adr），建立项目全貌与职责认知。
- **对照 git log 审计需求表与 Bug 表的一致性**，发现并补齐两处台账缺口：
  1. **需求表**：649748e 只回填了 19 个 REQ，另 **20 个 🟠 REQ 有实现 commit 但备注未记录** → 全部补「已实现（2026-09-08 本轮 dev）」+ commit（037/057/058/060/061/062/063/065/066/067/068/069/071/072/073/074/075/076/077/079）；REQ-084 补美术素材交付记录（维持 🟡）；REQ-059 审计澄清（后端已实现 5f01cff、**admin.html 缺素材管理 UI 为当前缺口**，维持 🔵）。
  2. **Bug 表**：4 个 🟠 Bug（011/012/013/014）补「修复」列 commit 引用（7105869 / e1916b9·e7dfcd5 / 7105869·02382b6·6219573 / 789bee6）。
- 两张表「变更记录」均追加本轮台账补记。

**待对方（测试组 / 开发）做什么**：
- **测试组**：按上述 commit 验收 🟠 项（39 REQ + 4 Bug 均待验收）；其中 **REQ-059 后台素材管理 UI 缺失**是已知开发缺口，验收时注意；🟢 仅测试组可设。
- **开发**：补做 REQ-059 的 admin.html 素材管理界面（后端就绪）；REQ-069 小六壬后端落库遗留（`generateXiaoliuren` 扩展 manual 字段）待排期。
- **用户（需求方）**：REQ-084 Q 版动画功能是否继续推进（美术素材已交付）、REQ-097 banner 文案待品牌提供；工作区有未提交的 `backend/packages/` 删除（约 2169 文件）+ 美术素材/脚本，待确认是否提交。
