# 太初 · 命理 H5

> 多流派 AI 命理综合 H5（MVP V0）
> 主钩子：事业运势趋势参考

录入生辰完成排盘 → 断前尘回溯校验 → 多流派 AI 综合解读与趋势预测，支持校准修正、反馈质疑与档案沉淀，最终聚焦输出「事业运势趋势」参考。

## 实际技术栈（以源码为准）

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python 3.13 + FastAPI | 单进程单端口 **8000**，同时服务 `/api` 与前端静态文件 |
| 前端 | **免构建** CDN React 18 + Babel Standalone | 权威入口 `frontend/public/index.html`（React / ReactDOM / Babel 已本地化到 `frontend/public/vendor/`）。**不需要 npm install、不需要 Vite 构建或启动前端**（沙箱环境阻断 Vite/esbuild，故走免构建路线；页面内 Google Fonts 等少量外部资源仍需联网加载） |
| 数据库 | SQLite（双库） | 分析库 + 反馈库，位于 `data/*.db`（git 忽略） |
| 排盘 | lunar-python / iztro / mingyu-core | Python 侧 lunar-python；紫微等由 Node 子进程引擎产出（`backend/paipan-node/` 的 `node_modules` 与 `vendor/` 已就位，**无需 npm install**；Node 22 仅作排盘引擎子进程） |
| LLM | DeepSeek 官方 API（`deepseek-v4-flash`） | OpenAI 兼容；key 配置在 `backend/.env` |

## 目录要点

| 路径 | 说明 |
|---|---|
| `frontend/public/index.html` | **实际生效的前端**：FastAPI `app.mount("/", StaticFiles(.../frontend/public))` 直接托管 |
| `frontend/public/vendor/` | 本地化的 React 18 / ReactDOM / Babel Standalone |
| `frontend/src/` | 旧 Vite + TS 参考源码，**不参与运行**（详见 docs/前端改造交接说明.md） |
| `backend/app/` | FastAPI 模块化单体后端（9 个方法模块、异步任务、档案 / 反馈 / 合规等） |
| `backend/paipan-node/` | Node 排盘引擎依赖与脚本（已就位） |
| `.env.example` | 环境变量**模板**（LLM key 占位符 `sk-your-key-here`）；真实 key 只放 `backend/.env` |
| `docs/` | 架构、交接与安全文档（总索引见 `docs/README.md`，重点见下「关键文档」） |

## 快速启动

### 前提条件
- Python 3.13（`pyproject.toml` 要求 >=3.11）
- Node.js 22+（仅排盘引擎子进程需要；**全程无需 npm install**）
- （可选）ngrok 用于内网穿透分享

### 1. 安装后端依赖（首次）

后端依赖已由 `backend/pyproject.toml` 声明（FastAPI、SQLAlchemy、lunar-python 等）。在**仓库根目录**执行以下任一命令：

```bash
pip install -e backend             # 安装运行依赖
# 或一次装齐（含 pytest 等开发依赖）：
pip install -e "backend[dev]"
```

> 说明：`[dev]` 对应 `pyproject.toml` 的 `[project.optional-dependencies]`，需在仓库根目录执行；若已 `cd backend`，等效写法为 `pip install -e ".[dev]"`。仓库自带的隔离环境 `backend/.venv`（如存在）请先激活再安装。
>
> **前端无需 npm install**：前端为免构建 CDN React + Babel Standalone（已本地化到 `frontend/public/vendor/`）；Node 22 排盘引擎依赖（`backend/paipan-node/` 的 `node_modules` 与 `vendor/`）也已就位，均不需要任何 npm 安装步骤。

### 2. 配置环境变量（首次，后端 `.env`）

真实 key 不放代码 / 模板，先把根目录模板复制为 `backend/.env` 再填入：

```bash
cd backend
cp ../.env.example .env     # macOS / Linux
# 或 Windows: copy ..\.env.example .env
```

然后编辑 `backend/.env`，至少填入：

```dotenv
TAICHU_LLM_API_KEY=sk-你的真实key
```

> 安全约定：key 只允许出现在本地 `backend/.env`（已被 `.gitignore` 忽略，不进版本库）；严禁硬编码进源码 / README / `.env.example`。详见 `docs/API-Key安全与LLM接入说明.md`。

### 3. 启动（单端口 8000）

**Windows：**

```bat
start.bat
```

**macOS / Linux：**

```bash
./start.sh
```

或手动启动（两者等价）：

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

前端由 FastAPI 在 8000 端口直接托管 `frontend/public/`，**无需另起 Vite / 5173**。

### 4. 访问

| 服务 | 地址 |
|---|---|
| 前端 H5（入口即整站） | http://localhost:8000 |
| API 文档（Swagger） | http://localhost:8000/docs |

### 5. 内网穿透（分享给朋友测试）

```bash
ngrok http 8000
```

### 6. 运行测试

```bash
cd backend
python -m pytest -q
```

## 已验证能力

- **排盘**：多流派确定性排盘（盘面数值零 LLM，只由代码产出）
- **断前尘**：历史回溯校验，降低预测幻觉
- **校准**：结果校验 / 校准链路
- **预测**：9 个方法模块 LLM 综合分析 + 综合解读
- **修正**：跨用户质疑反馈收集与后台归纳
- **档案**：用户分析档案落库与缓存复用
- **异步**：长任务 jobId + 轮询（ADR-0005）

## 关键文档

| 文档 | 内容 |
|---|---|
| `docs/README.md` | docs 总索引（standards / adr / runbooks 结构与写作约定） |
| `docs/人工注意点清单.md` | 需人工实测 / 判断 / 决策的事项清单（MVP 收尾必读） |
| `docs/开发日志.md` | 各阶段开发日志与决策记录 |
| `docs/前端改造交接说明.md` | 免构建前端的真实状态、两套前端结论与运行契约 |
| `docs/API-Key安全与LLM接入说明.md` | DeepSeek 接入与 key 安全约定 |
| `docs/Session交接文档.md` | 会话与交接说明 |
| `docs/standards/03-接口与数据字典.md` | 对外 REST API 契约与数据字典（跨模块唯一协商点） |
| `docs/standards/02-技术栈清单.md` | 技术栈清单与选型 |
