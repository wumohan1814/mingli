# 太初 · Session 交接文档

> 生成时间：2026-09-06（Phase 1–7 全部完成 + 人工联调迭代收尾）
> 当前阶段：**MVP 主链闭环完成**（排盘 → 断前尘 → 校准 → 预测 → 追问 → 档案全链路可用；进入「上线前人工核验」阶段）
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
29. LICENSE：MIT，版权人 `吴默涵`。
30. 用户协议/隐私政策接入（`docs/legal/` + 前端勾选 + 页尾链接）。

### A.7 测试与成本
31. **pytest 19 passed**（排盘 9 + 编排 5 + 端到端 3 + 锚点 2）。
32. **self-run 成本实测**：用 test1 这一轮结果作锚（不再跑 10 次）。单 case 首跑全盘 ≈ **¥1.06**（断前尘 ¥0.84 + 预测 ¥0.22，约 23 次调用）；`COST_GATE_MODE` 维持 `full`。

### A.8 线上部署准备（服务器就绪 + 部署文件，尚未拉取部署）
33. **服务器选型**：香港轻量下架 → 选**新加坡 2核1G**（阿里云，Ubuntu 24.04，免备案）；域名 `taichu.xyz` A 记录已解析到服务器。实测排盘 Node 常驻进程仅约 100MB，1G 内存 + 1G swap 足够。
34. **服务器准备（已完成）**：swap 1G；Docker 29.8.0 + Compose v5.5.1；部署目录 `/opt/taichu/{data,backup}`；GitHub 只读 Deploy Key（已验证可拉 private 仓库，commit `f35f191`）。
35. **部署文件（已写，未 commit）**：
    - `Dockerfile`：Python 3.13 + Node 22 双运行时镜像，排盘 `node_modules/vendor` 打包进镜像（服务器不 npm install）。
    - `.dockerignore`：排除 `.env`/`*.db`/`reference`/`frontend/node_modules` 等，保留排盘依赖。
    - `docker-compose.yml`：web 单体 + Caddy，SQLite 卷挂载 `/opt/taichu/data`。
    - `Caddyfile`：`taichu.xyz` 自动 Let's Encrypt HTTPS + 反代。
    - `ops/deploy/{deploy.sh, backup.sh, README.md}`：一键部署、每日 SQLite 备份、部署说明。
36. **部署架构决策**：Caddy HTTPS 反代 → web 单体（FastAPI + Node 排盘常驻 `server.mjs` + SQLite 持久卷）；数据库继续 SQLite（PostgreSQL 留 Phase2）；密钥 `.env` 注入（JWT_SECRET 自动随机、LLM key 用户填）。

---

## B. 剩余需要人工处理的事项（详见 `docs/人工注意点清单.md` 与 `docs/人工操作手册.md`）

1. **前端浏览器实测**：语法已由子代理用 babel parser 机器验证（JSX PARSE OK），但真实交互需人工点一遍（已进行得差不多）。
2. **其余 8 法真调抽检**：只有 bazi-pattern 真调过，其余方法建议 self-run 时顺带抽检。
3. **协议合规律师定稿**：用户明确「暂时先不处理」，留待上线前。
4. **运营合规决策**（数据出境、算法备案、服务定性等）：见 `docs/legal/交付说明与风险清单.md` 第四、五节，需用户决策。

---

## C. 快速启动

```bash
cd C:\Users\wumoh\Documents\Vibecoding\taichu
start.bat          # 或 cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# 前端 http://localhost:8000 | API 文档 /docs
```

依赖：Python 3.13 + Node 22（排盘引擎）；`pip install -e backend`（已可正常安装）；前端免构建无需 npm install；LLM key 在 `backend/.env`。

测试：`cd backend && python -m pytest -q`（19 passed）。

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
