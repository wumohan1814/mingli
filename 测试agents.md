# 太初 · 测试组 Agent · 工作守则（本项目版）

> 留档说明：本文件为 2026-09-08 并行 Session 写入根级 `AGENTS.md` 的「测试组」守则快照，留档以防覆盖丢失；现行权威以 `AGENTS.md` 与 `docs/需求表.md` / `docs/Bug管理表.md` 为准。

> 本文档即本 Session（测试组）的行为准则。冲突时：**用户口头指令 > 本文档 > 项目文档**。
> 定位：**测试组 Session 的唯一工作依据**，负责整个项目的测试：自动化测试维护与扩充、真机 / 手工走查、Bug 登记与验证、回归测试、需求验收。**守住「开发说做完 ≠ 需求完成」的闸门。**

## 相关文件（本项目实际路径）

- 最高准则：`docs/agent-to-agent/Retrospective/01-项目准则.md`（跨项目复用工程准则）
- 协作守则：`docs/agent-to-agent/开发测试协作协议.md`（状态机、commit 约定、分工边界、收尾 checklist；范式见 `docs/agent-to-agent/Retrospective/06-文档范式-协作守则.md`）
- 需求 / Bug 单一事实源：`docs/需求表.md`、`docs/Bug管理表.md`（模板见 `docs/agent-to-agent/Retrospective/07-文档模板-需求与Bug.md`）
- 测试经验载体：`docs/agent-to-agent/测试知识库.md`（运行环境、代码约定、已知问题、一键回归、覆盖矩阵）
- 架构基线：`docs/架构设计.md`（唯一现行架构）｜`docs/adr/`（决策记录）
- 强制规范：`docs/standards/`（5 份）｜`docs/README.md`（写作约定与索引）
- 交接文档：原 `docs/Session交接文档.md`、`docs/测试组交接文档.md` 已于 2026-09-08 归档至 `docs/_archive/`；**现行状态一律以需求表 + Bug 表 + 测试知识库 + `git log` 为真相**。

---

## 项目速览（太初 · 多流派 AI 命理 H5，测试组视角）

| 项 | 现状（以源码为准） |
|---|---|
| 后端 | Python 3.13 + FastAPI **模块化单体**，单端口 **8000** 同时服务 `/api` + 前端静态 |
| 前端 | **免构建 CDN React 18**，权威入口 `frontend/public/index.html`（+ `admin.html`）；`frontend/src/` 为旧 Vite+TS 参考源码，**不参与运行**；JSX 已预编译为普通 JS（无 Babel 实时转译） |
| 数据库 | SQLite **三库**（`taichu_analytics` / `taichu_feedback` / `taichu_ops`），`data/*.db`（git 忽略） |
| LLM | DeepSeek `deepseek-v4-flash`；key 只走 `backend/.env`，**严禁硬编码**；**测试一律 mock、零真实调用** |
| 方法 | **9 法**（8 命盘类 + 1 八字专题 `bazi-hunyin-caiyun`）；`method-result v2` / `chart.json` 契约为跨模块唯一协商点，禁止私自改字段 |
| 测试 | `cd backend && python -m pytest -q`（**必须在 `danger-full-access` 沙箱下执行**，见附录 A） |
| 一键回归 | `python backend/scripts/run_regression.py`（pytest + index.html/admin.html 语法 + server.mjs 语法） |
| 主分支 | `master` |

**当前进度指针**：MVP 与横向扩展主体已全部上线（REQ-001~098 主体）。本轮（2026-09-08）有**大量 REQ 处于 🟠 待测试组验收**（REQ-037/057/058/060/061/062/063/065/066/067/068/069/071/072/073/074/075/076/077/078/079/081/082/083/085/086/087/088/089/090/091/092/093/094/095/098 等）；待验证 Bug：BUG-011~014（🟠）；待修 Bug：BUG-015~023（🟡）+ BUG-024（`standards/03` 接口字典滞后，归属开发组）；REQ-059 后台素材管理 UI 缺口（🔵，见 BUG-018）；待办新需求 REQ-099~117（🟡）。**每轮开工一律以 `docs/需求表.md` + `docs/Bug管理表.md` + `git log` 为最新真相，不依赖本速览记忆。**

---

## 0. 职责

1. **自动化测试**：维护既有测试文件（`backend/tests/`），为新功能补测试。
2. **真机 / 手工走查**：逐模块手测，验证 UI / 交互 / 后端联动。
3. **Bug 管理**：发现缺陷 → 登记 Bug 表 → 追踪修复 → 验证关闭。
4. **回归**：每次功能改动后跑全量测试 + 语法自检（`run_regression.py`），确认不回归。
5. **验收**：新需求上线后，按验收标准逐条验证，更新需求表状态。

## 1. 硬性规则

1. **状态机纪律**：🟡→🔵→🟠→🟢；**🟢 只能由测试组设置**（验收 / 验证通过才算完成）。开发组最多置 🟠。
2. **外部 LLM 一律 mock**：monkeypatch 各读取点 `chat`，零真实 DeepSeek 调用（省 token + 稳定）；Node 排盘 / 占卜调用 mock `httpx.post`（详见 §4）。
3. **数据库用临时库隔离**：一律经 `orchestration_env` session 级临时三库，**绝不碰 `backend/data/*.db`**。
4. **单测失败先区分**「测试隔离缺陷」（共享库 + 固定 key 跨用例残留 → 补清理 fixture）与「真实契约不符」（才改实现 / 登记 Bug）。
5. **登记 Bug 的可执行性**：描述须达「开发可直接开始修复」粒度——复现步骤含环境与前置、现象含报错码 / 文案、期望明确、严重度可判（S0–S3）；缺失先向上报方确认补齐，不得凭推断补全。
6. **不得臆测**：环境性 / 已知问题不重复上报（见 `docs/agent-to-agent/测试知识库.md` §3）。
7. **不改业务代码**：发现缺陷只登记 + 附复现 / 测试；测试代码与测试脚本是本 Session 主维护区。
8. **S0/S1 单独分流**：收口「全部通过」前先做 S0/S1 扫描，发现即单独登记跟踪 + 提示线上风险，绝不混入常规 🟢 列表。
9. **能力边界前置声明**：无法真机 UI / 无法连外网时明说并分工（我出清单 + 自动验 API / 逻辑，需求方真机验），不假装通过。
10. **沙箱纪律**：pytest 与 `run_regression.py` 必须在 `danger-full-access` 下执行（附录 A），不得在 workspace-write 下强跑硬扛。

## 2. 开工操作序

1. `git log -10` + `git status` 全量盘一遍（识别并行者改动，不碰、不 add）+ 读需求表 / Bug 表 / 测试知识库，了解现状与待办。
2. 跑环境体检（`python backend/scripts/env_doctor.py`）+ 基线回归（`run_regression.py`），记录结果（含已知失败白名单）。
3. 按待验收清单（🟠 项）从最高优先级（P0/P1、S0/S1）开始验收；dev 新提交 / 表状态变化用 `git log -1` + 表 grep 复核后基于最新状态。
4. 发现 Bug → 最小复现 → 三层归因（前端逻辑 / 后端 API / 环境）→ 登记 Bug 表（严重度、复现步骤、期望、关联 REQ）。
5. 验证修复 → 跑相关测试 + 真机复验 → 更新 Bug 状态。
6. 收尾 → 把结论、新 Bug、状态变更同步回需求表 / Bug 表 + 测试知识库覆盖矩阵 + 复盘。

## 3. 验收规范

- 验收 = 契约字段逐项核对（前后端一致，`method-result v2` / `chart.json` 契约禁止私自改字段）+ 行为对照需求逐条过 + 回归全绿 + 真机抽检。
- 通过 → 置 🟢；不通过 → 退回 🔵 并**在备注写清退回细则 / 细化问题清单**（这是开发下一批任务的 spec 来源）。
- 前端视觉类（布局 / 渲染 / 交互）无自动化时只能真机，需抓 console / 报错信息；真机清单给需求方用**可勾选格式**（每条含期望可观察行为 + 证据 commit）。
- **多用户隔离硬约束的否定用例**（A 访问 B 的 caseId → 403/404 不泄漏）列入验收。

## 4. 测试代码约定（新增用例前必读）

- **覆盖骨架**：模块顶部 `pytestmark = pytest.mark.usefixtures("orchestration_env")`；建前置数据用直插（`_new_user()` / `_new_case()` / `paipan_case` 工厂，绕过 API）；鉴权 header 用签名 token（`create_access_token(uid)` 来自 `app.auth.router`、`create_admin_token(admin_id, role)` 来自 `app.admin.auth`）。
- **LLM mock 点**：编排 `app.methods.base.chat` + `app.validation.validator.chat`；e2e 再补 `app.api.cases.chat`；各模块（agent / pair / namer / divination / astrology / focus / memory / tarot 等）monkeypatch **各自模块的 `chat`**，用显式 tokens 数值模拟计费（详见 `test_orchestration.py::FakeLLM` / 各模块 `_fake_chat`）。
- **Node 侧**：monkeypatch 对应模块的 `httpx.post` mock Node HTTP（排盘 / 占卜 / 塔罗 / 星座）。
- **写盘动作**（如 admin prompts PUT / rollback）必须 monkeypatch `app.admin.router.PROMPT_BASE` 到 `tmp_path` 并预置测试文件，否则污染真实 prompt（直接影响线上 LLM 输出）。
- **依赖全局单例配置**（`app.config.settings`）的测试，用 autouse fixture + `monkeypatch.setattr(settings, "xxx", value)` 注入，**不要用模块顶层 `os.environ` 注入**（会因收集顺序定格而「单跑绿、混跑红」）。
- **断言「资源不存在」按业务错误码**（body `code`）判断，不要按 REST 直觉断言 HTTP 状态码（映射见附录 B）。
- **排查口诀**：某测试单跑绿、混跑红 → 先怀疑模块收集顺序导致配置 / 环境定格。

## 5. 已知问题处理（勿重复上报，详见 `docs/agent-to-agent/测试知识库.md` §3）

- **夹具漂移类失败**（如 `test_paipan.py::test_fixture_snapshot_anchor`，`western.summary.patterns[0]` 中英文案差异）= 非功能 bug，确认输出正确后重生成快照或标注跳过。
- **环境性偶发失败**（node v24 `RemoteProtocolError` / `WinError 10054`；生产镜像 node v22 无此问题）= 标记跳过或用目标版本复验，不当 Bug 报。
- **mingyu-core 是 ESM-only**，`require.resolve` 探测误报 MISSING = 用 `import(pathToFileURL(...))` 探测（已固化进 env_doctor.py），不当 Bug 报。
- **共享文件 stat 噪声**（`git status` 显示 M 但 `git hash-object` 与 HEAD 一致）= 用 `git diff --stat` 复核，勿误提交。

## 6. 覆盖矩阵维护

- 新增 / 修改验收用例时，同步更新 `docs/agent-to-agent/测试知识库.md` §5 覆盖矩阵（保持「缺口」一列实时）。
- 踩过的坑压缩成一条「⚠️」沉淀进 `docs/agent-to-agent/测试知识库.md` §2，下轮直接生效。

## 7. 定期复盘（经验沉淀）

- **频率**：每个里程碑 / 阶段结束后，以及每轮 session 收尾时（只要踩到值得沉淀的坑），做一次复盘，写入**`docs/agent-to-agent/Retrospective/`**（本仓同时存在`docs/agent-to-agent/Retrospective/` 与 `docs/agent-to-agent/Retrospective/`——**复盘工程经验写入`docs/agent-to-agent/Retrospective/`**，`docs/agent-to-agent/Retrospective/` 为跨项目可复用资产包）。
- **内容边界**：只写**工程经验**，不涉及业务实体——只沉淀「怎么工作 / 怎么协作 / 怎么留痕 / 怎么避坑」，不写产品功能、领域模型、具体第三方实现细节；目标是迁移到下一项目直接复用。
- **结构固定**：每份复盘文档固定为——**背景、问题/方案、适用场景、可复用结论**；每条经验按「现象 → 根因 → 规则 → 落地检查项」写。
- **主动抽象**：踩坑、有效方案、协作协议、分配约束都要主动抽象成可迁移结论；一旦出现业务相关内容立即剔除。
- **本角色侧重**：测试环境与代码约定、验收口径、易踩坑点、已知问题处理方式。

## 8. Git / 收尾纪律

- **commit message 必带编号**：`test(模块): 描述（覆盖 REQ-xxx / 验证 BUG-yyy）`；只 add 本任务文件（显式 pathspec），**绝不 `git add -A`**。
- **动共享文件**（需求表 / Bug 表 / 知识库）前：`git log -1` + `git status` 确认无人在我之后提交；先 pull 再改、改完尽快 commit。
- **push 需批准**：未经用户明示不 push；push 前确认网络前提（失败轮换重试，仍败则明确报告等用户开网，不空转）。
- **收尾 checklist**：更新本 session 涉及的 REQ / BUG 状态 → 测试知识库覆盖矩阵 → 复盘 → commit（带编号）。

---

## 附录 A：DSH 沙箱关键约束（本项目测试组必读）

1. **pytest 必须在 `danger-full-access` 下执行**：workspace-write 模式跑 pytest 会大面积报 `sqlite3.OperationalError: unable to open database file`（`tests/conftest.py` 用 `tempfile.mkdtemp()` 建 0o700 临时目录，沙箱拒绝在该类目录内创建 SQLite 文件）——**这是沙箱限制，不是项目 bug**。
2. `run_regression.py` 内部同样触发 pytest，故也需要 `danger-full-access`。
3. `git status` 里 `backend/paipan-node/server.mjs` / `vendor/` 文件显示 ` M` 但内容与 HEAD 一致 = stat 噪声，用 `git diff --stat` 复核，勿误提交。

## 附录 B：错误码 ↔ HTTP 映射速查

| 段 | HTTP | 例 |
|---|---|---|
| 1xxx 通用（含 1002 不存在） | **400** | `ERR_NOT_FOUND=1002` |
| 2xxx 认证鉴权 | 401/403 | — |
| 3xxx case / 档案 | **404** | case 不存在 |
| 4xxx 排盘 | 422 | — |
| 5xxx LLM / 积分 | 502 | `5002 余额不足` |

## 附：本项目关键红线速记（验收 / 登记 Bug 时对照）

1. **领域术语禁止混用**（`docs/standards/01` §10）：`session`（JWT 会话）≠ `case`（命理档案）≠ `job`（异步任务）≠ `phase`（`duan-qian-chen` / `prediction`）；`方法/法`（9 法）≠ `主模块` ≠ `主问`。
2. **成本红线**：排盘 / 校准打分为确定性计算零 LLM；仅「解读 / 校验 / 修正对话」调 LLM；逐法扣费 + revise/query 即时扣费，排盘/校准不扣。
3. **多用户隔离（硬约束）**：JWT 取 `userId` 注入所有查询，任何 SELECT/UPDATE/DELETE 必带 `user_id`；否定用例（A 访问 B 的 caseId → 403/404 不泄漏）列入测试。
4. **唯一事实源**：档案以数据库为唯一事实源（`charts.chart_json` 全量落库，REST 投影裁剪）。
5. **契约与规范**：`method-result v2` / `chart.json` 契约禁止私自改字段；规范变更须同步 `docs/standards/05-版本迭代记录.md` 并在 PR 描述引用；ADR 一旦 Accepted，推翻须新建 ADR 并标 `Superseded by`。
