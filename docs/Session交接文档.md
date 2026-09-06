# 太初 · Session 交接文档

> 生成时间：2026-09-06（本次 Session 更新 · Phase 7 收尾）
> 当前阶段：**Phase 1–7 全部完成（MVP 主链闭环）**
> 工作目录：C:\Users\wumoh\Documents\Vibecoding\taichu

---

## 1. 项目概述

太初是一个AI驱动的多流派命理综合H5产品。MVP以"事业运势"为主钩子，融合9个方法论。

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python 3.13 + FastAPI 0.141 | 模块化单体 |
| 数据库 | SQLite（双库：analytics + feedback） | 本地文件 |
| 前端 | React 18（CDN免构建） + Babel Standalone | 因沙箱阻止Vite/esbuild |
| 排盘 | lunar-python / iztro / mingyu-core | **Node 依赖已就位并验证** |
| 认证 | JWT HS256 + pbkdf2_hmac | 用户名/密码 |
| 部署 | 单端口8000 | ngrok内网穿透 |

## 3. 当前运行状态

- 后端**当前未运行**（已检查 :8000 无进程）。
- 启动命令：`cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- 沙箱模式：**danger-full-access**（本 Session 已提权，无文件限制；Node 子进程已验证可用）

### 已验证通过的API端点（12个）
POST /api/auth/register · /api/auth/login · /api/auth/refresh · /api/cases · /api/cases/{id}/paipan（✅ 真实排盘）· /api/cases/{id}/duan-qian-chen（✅ 异步 202 + 9 法串行）· /api/cases/{id}/calibration（✅ 真实化）· /api/cases/{id}/predict（✅ 异步 202 + 路由并行 + 合成）· /api/cases/{id}/revise（✅ 真实化）· GET /api/cases/{id}/archive（✅ 真实化聚合）· POST /api/cases/{id}/query/{method_key}（✅ 单法直问，缓存优先）· GET /api/jobs/{jobId}

### 前端
CDN React SPA（frontend/public/index.html），7个页面。

---

## 4. 本 Session 已完成（Phase 3 排盘 → Phase 7 集成收尾，MVP 主链闭环）

### 4.1 Node 运行时已就位 `backend/paipan-node/`（已验证）
- `package.json`：deps iztro ^2.5.0、mingyu-core ^0.2.1
- `ziwei.cjs`：紫微排盘（iztro），stdin 读 `{"birthday","time_idx","gender"}` → stdout 输出 12 宫 JSON
- `extra.mjs`：占星/七政/五运六气/奇门（mingyu-core + vendor），stdin 读生辰 → stdout 输出 `{western,qizheng,wuyun_liuqi,qimen_lifetime}`
- `node_modules/`（约70MB，从 reference 复制，**未 npm install**）：iztro、mingyu-core 及传递依赖
- `vendor/`（约8.6MB）：mingyu-core 0.2.2 构建产物，用于奇门 `calculateQimenLifetime`
- **冒烟验证通过**：ziwei 输出 12 宫；extra 四段全非 null

### 4.2 `backend/app/paipan/` 已实现 3 个自研模块（可 import 纯函数，非 CLI）
- `shensha.py` → `compute_shensha(pillars) -> list`（神煞查表）
- `slicer.py` → `slice_chart(chart, methods=None) -> dict[str, dict]`（9 法切片映射）
- `scorer.py` → `score_fit(propositions, results, validations) -> dict` + `calibration_weight(fit)`（三因子：0.5命中率+0.3命题质量+0.2依据链；weight=0.4+0.6×契合度）

### 4.3 验证
- 参考实现 `reference/mingli/scripts/paipan.py` 全链冒烟通过：9 段（bazi/ziwei/western/qizheng/qimen_lifetime/wuyun_liuqi）全非 null、`degraded_methods==[]`。
- `slice_chart` 8 片全部正常产出。
- `pytest`：排盘层 9 用例 + 编排层 5 用例 = **14 passed**。

### 4.4 Phase 4 · 真实 LLM 接入 + 异步编排（已完成）
- **LLM 客户端** `backend/app/llm/client.py`：`async chat(messages, *, model, json_mode, ...) -> {content, usage, model}`，OpenAI 兼容 DeepSeek（`https://api.deepseek.com`，模型 `deepseek-v4-flash`）；4xx 不重试、429/5xx/超时指数退避；进程内 `_usage`/`reset_usage()`/`get_usage()` 成本计量。
- **配置** `backend/app/config.py` 新增 `llm_api_key / llm_base_url / llm_model / llm_validation_model / llm_timeout / llm_max_retries / llm_temperature`；真实 key 仅存 `backend/.env`（已被 `.gitignore` 忽略，代码零硬编码）。
- **Key 安全方案** `docs/API-Key安全与LLM接入说明.md`：MVP 明文 `.env` + 升级路径（secret manager / provider 与模型档位可切换 / 校验模型分离）。
- **方法模块真实化** `backend/app/methods/base.py`（prompt 加载 + 稳健 JSON 解析 + 输出格式硬指令 + 异常上抛）+ 9 个 `analyzer.py` 薄封装；`backend/app/methods/__init__.py` 用 importlib 加载 `ANALYZERS`（目录名带连字符）。
- **校验真实化** `backend/app/validation/validator.py`：输出契约对齐 `scorer.quality_score()`（`validations[].severity` = error/warning/info）；`prompts/shared/validation.md`。
- **异步编排** `backend/app/jobs/orchestrator.py`：`run_duan_qian_chen`（9 法串行 + 每法校验 + 缓存复用 + 落库 + 合成问卷 + usage）；`run_predict`（路由选法 + 并行扇出 + 落 route_decisions + 合成 + 免责声明）。
- **数据层** `Job.result_json` 字段 + `database.ensure_schema()` 幂等迁移（`ALTER TABLE jobs ADD COLUMN result_json`）；端点 `duan-qian-chen`/`predict` 改 **202 + `asyncio.create_task`**（模块级 `_background_tasks` 强引用）；`GET /api/jobs/{id}` 的 `result` 读 `result_json`。
- **验证**：编排 mock 端到端（断前尘 9 法落库 + 预测路由主3辅2 + 合成 + 免责声明）；API 冒烟（`202 → 轮询 → succeeded` 全闭环）；真调冒烟（`analyze_method` 真实 DeepSeek 返回 method-result v2，`usage prompt=1763/completion=254/total=2017`）。

### 4.5 Phase 5 · API 层端点真实化 + method-prompts 重写（已完成）
- **method-prompts 9 份自研重写**（`backend/prompts/method-prompts/*.md`）：参考 mingli 规则、对齐太初 slice + method-result v2；真调冒烟产出 4 条可证伪命题
- **合规护栏接线**：`check_output` 在 `run_predict` 合成后、免责前 `_apply_compliance`
- **`calibration` 端点真实化**：断前尘结果聚合 → `score_fit` → 落 `Calibration` 表
- **`revise` 端点真实化**：历史对话 + chart 摘要 → 真实 LLM → 落 `Conversation`（`prompts/shared/revise.md`）
- **`archive` 端点真实化**：`build_archive` 聚合 chart/校准/对话/方法结果
- **新增** `POST /api/cases/{id}/query/{method_key}`：单法直问（缓存优先，零 LLM）
- **统一错误处理**：`_err` / `_get_owned_case` helper

### 4.6 Phase 6 · 前端消费真实结果（已完成）
- **前端去 mock**：统一轮询 `GET /api/jobs/{jobId}` → 渲染真实 job result
- **CalibrationPage 契合度**：读 `result.propositions` 展示校准契合度（含过渡态）
- **PredictPage**：读 `result.report` 渲染预测合成结果
- **ArchivePage 完整档案**：展示 `build_archive` 聚合的 chart/校准/对话/方法结果
- 两页收尾，前后端契约以 job result / method-result v2 为准

### 4.7 Phase 7 · 端到端集成测试 + 文档收尾（已完成）
- **端到端集成测试**：happy path（`test_full_main_flow`）+ 隔离/降级（`test_multi_user_isolation` / `test_degraded_no_longitude`），pytest 全量 **17 passed**
- **README 重写**（Phase 1–7 全貌 + 启动/测试指引）
- **`docs/人工注意点清单.md`**：人工实测/技术债/部署/安全/防漂移注意点汇总（与下节「剩余待做」对应）
- **修复** `backend/app/api/cases.py` datetime import bug

---

## 5. 剩余待做（Phase 7 之后 · 人工注意点，详见 `docs/人工注意点清单.md`）

1. **self-run 10× 成本实测**（owner=用户，R9 成本闸门，**全项目完成后执行**）：单 case 首跑全盘总成本（断前尘 9 分析+9 校验 + 预测 5 分析 ≈ 23 次调用），回填 `COST_GATE_MODE` 阈值。
2. **前端浏览器实测**：浏览器过一遍主链全流程（注册 → 建档 → 排盘 → 断前尘 → 校准 → 预测 → revise → archive），尤其校准契合度过渡态与档案页三段。
3. **revise 补 `check_output`**：与 `predict` 对齐，revise 合成后加合规拦截（当前仅 `append_disclaimer`）。
4. **prompt 长度调优**：真调冒烟 `bazi-pattern` 单法 completion≈14k tokens（偏多），在 method-prompts 追加「每条 claim 一句话、basis 精简」等输出长度约束。
5. **案例库回归锚点**（防 prompt 漂移）。

> 以上 5 项与 `docs/人工注意点清单.md`「六、待办（跨阶段）」一一对应。

---

## 6. 关键决策记录（含本 Session 新增）

1. 免构建前端：沙箱阻止Vite/esbuild子进程spawn，改用CDN React + Babel Standalone
2. 密码哈希：放弃passlib，改用hashlib pbkdf2_hmac
3. 单端口部署：FastAPI同时服务前端静态文件和API，端口8000
4. npm包已安装：frontend/node_modules已安装
5. Python包已安装：lunar-python 1.4.8 已在 site-packages（**无需再 pip install**）
6. 皮肤系统：MVP仅做国学皮肤
7. LLM调用：早期全部确定性 mock、预留接口（Phase 4 起已切换真实 DeepSeek，见 §4.4）
8. **Node 依赖复用**：iztro/mingyu-core 已存在于 reference，本 Session **直接复制**到 `backend/paipan-node/`，**不 npm install**（规避网络/权限重试）
9. **排盘引擎模块化**：自研 paipan/slice/score 改为**可 import 纯函数**（返回 dict），不沿用 mingli 的 CLI+文件形态

---

## 7. 分工与执行约束（重要，务必遵守）

1. **不要亲自写子代理可以完成的内容**——这会导致主会话 token 爆炸。把低级的底层代码撰写之类的工作交给子 session，使用 **DeepSeek V4 flash**（code_flash）进行，以保证高缓存命中率。
2. **严格执行分工，不要越俎代庖**：主会话只做架构设计、契约定义、任务拆分、集成与评审、验证；重复性/底层代码撰写一律交 code_flash。
3. **子代理异常处理**：若子代理异常，先分析异常原因，判断是否需要用户协作解决；不要自行降级为主会话手写，也不要反复盲目重试。
4. **避免 pip/npm install 反复重试**：依赖已就位（lunar-python 已装；iztro/mingyu-core 已在 `backend/paipan-node`），不要重复安装；如确需安装，一次到位，避免每次新工具调用、无法复用缓存。
5. **网络问题**：用户有 VPN 可解决网络问题；遇到下载/网络故障，**暂停并询问用户**，避免多次无效尝试和卡死。

---

## 8. 需要阅读的文件（Phase 3 参考）

按优先级：
1. `reference/mingli/SKILL.md` — Skill 定义（§0 注册表、method-result v2 契约）
2. `reference/mingli/scripts/paipan.py` — 排盘胶水（engine.py 的直接对照）
3. `reference/mingli/scripts/shensha.py` / `slice_chart.py` / `score.py` — 已移植为 backend 模块
4. `reference/mingli/scripts/paipan_ziwei.cjs` / `paipan_extra.mjs` — 已移植为 backend/paipan-node
5. `docs/standards/03-接口与数据字典.md` — chart.json / method-result v2 / 缓存键契约
6. `docs/adr/0001-排盘层自研与复用边界.md` — 自研为主/引入/参考三层归属
7. `backend/app/paipan/README.md` — 模块定位（paipan/slice/score 三能力）

---

## 9. 项目结构（关键更新）

```
taichu/
  backend/
    app/
      paipan/                # ★ Phase3 排盘模块（本 Session 新增）
        __init__.py          # ✅ 已导出公共 API
        shensha.py           # ✅ 神煞
        slicer.py            # ✅ 切片
        scorer.py            # ✅ 打分
        engine.py            # ✅ 已完成（排盘胶水）
        README.md
      api/cases.py           # ✅ paipan 端点已接入真实排盘
      models/analytics.py    # Chart/MethodResult 等 ORM 已就绪
      methods/               # ✅ 9 个方法模块（analyzer.py 薄封装，真实 LLM）
      ...
  backend/paipan-node/       # ★ Node 运行时（本 Session 新增，已验证）
      package.json / ziwei.cjs / extra.mjs
      node_modules/          # 已复制（iztro/mingyu-core 等）
      vendor/                # 已复制（mingyu-core 0.2.2 奇门）
  reference/mingli/          # 仅参考，不参与构建
  docs/                      # 产品/技术规划 + 交接文档 + standards/ + adr/（原 backgroud 目录并入 docs）
  temp/smoke/                # 冒烟产物（chart.json + slices/）
```

---

## 10. 沙箱 / 依赖注意事项

- 当前模式：**danger-full-access**（已提权，Node 子进程可用）
- **不要 npm install**：Node 依赖已在 `backend/paipan-node/node_modules` 与 `vendor/` 就位
- **不要 pip install**：lunar-python 1.4.8 已装
- Vite/esbuild：仍被沙箱阻止（前端继续用 CDN React）
- 网络：如遇下载失败，**暂停并询问用户**（用户有 VPN），不要反复重试

---

## 11. 快速启动

```bash
cd C:\Users\wumoh\Documents\Vibecoding\taichu\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# 前端 http://localhost:8000 ｜ API 文档 http://localhost:8000/docs ｜ ngrok http 8000
```

排盘模块冒烟（已可用）：
```python
from app.paipan import paipan, slice_chart
chart = paipan(year=1990, month=5, day=12, hour=14, minute=30, gender="male",
               name="测试", birthplace="北京", longitude=116.4, latitude=39.9)
slices = slice_chart(chart)   # 8 片
```
