# 命理（mingli）

> 多流派 AI 命理解读 H5 应用：录入生辰 → 排盘 → 多流派综合解读 → 断前尘校验 → 校准追问 → 档案沉淀。
> 用大白话给不懂命理术语的普通用户提供解读，支持八字 / 紫微 / 西洋占星 / 七政四余 / 奇门 / 五运六气等流派，
> 另有六爻 / 梅花易数 / 小六壬 / 塔罗 / 雷诺曼 / MBTI 大五等玩法。

---

## 功能一览

| 模块 | 说明 |
|---|---|
| 命盘·八法合一 | 选档案 → 排盘 → 多法解读（八字格局 / 大运流年 / 神煞纳音 / 婚姻财运 + 紫微 + 七政 + 奇门终身局 + 五运六气）→ 断前尘 / 校准 / 追问 |
| 即时起卦 | 六爻 / 梅花易数 / 小六壬 / 观音灵签 / 大六壬 / 金口诀 / 奇门时家 / 潮汕圣杯（掷筊） |
| 择吉与时势 | 黄历择日 / 八字起名 / 双人配对 / 时势推演（太乙神数、皇极经世） |
| 生肖流年 | 按档案生肖出流年（免费引流玩法） |
| 星座 | 本命星盘 + 太阳/月亮/上升三格 + 三关系 + 深度解读 |
| 塔罗 / 雷诺曼 | 78 张塔罗（19 种牌阵）、36 张雷诺曼（7 种牌阵），两段式取牌/读牌 |
| MBTI / 大五人格 | 大五 OCEAN 测评（120 快速版 / 300 完整版）+ 四字母对照 + 档案绑定 |
| 档案层 | 统一建档、档案管理、分享帮填（免登录代建） |
| 王先生会话 | AI 陪伴「对坐谈心」：带档案上下文 + 跨会话长期记忆 |
| 后台管理 | 报表 / 用户 / 余额调整 / Prompt 管理台 / 素材热更 |

## 技术栈

- **后端**：Python 3.13 + FastAPI（模块化单体），单端口同时服务 `/api` 与前端静态资源
- **数据库**：SQLite 三库（分析 / 反馈 / 运维），本地文件，零外部依赖
- **排盘引擎**：
  - 八字：Python 确定性计算
  - 紫微 / 西洋占星 / 七政四余 / 奇门 / 五运六气 / 六爻 / 梅花 / 灵签等：Node.js 纯函数内核（`backend/paipan-node/paipan-core`，零 LLM、确定性、可对拍）
- **前端**：免构建 CDN React（无需 npm install / Vite 构建）
- **部署**：Docker Compose + Caddy（自动 HTTPS）

## 快速开始

### 环境前提

| 项 | 要求 |
|---|---|
| Python | 3.13（`backend/pyproject.toml` 要求 >=3.11） |
| Node.js | 22+（仅排盘引擎子进程需要；全程无需 npm install） |
| LLM key | 只放 `backend/.env` 的 `MINGLI_LLM_API_KEY`，严禁硬编码（详见 `docs/API-Key安全与LLM接入说明.md`） |

### 启动

```bash
# 1. 安装后端依赖
pip install -e "backend[dev]"

# 2. 配置环境变量
cp .env.example .env        # 填入 MINGLI_LLM_API_KEY 等

# 3. 启动后端（FastAPI 同时托管前端静态资源）
cd backend && python -m uvicorn app.main:app --port 8000
```

访问：

- 应用：http://localhost:8000
- API 文档（Swagger）：http://localhost:8000/docs

Node 排盘服务（可选，未启动时自动降级）：

```bash
cd backend/paipan-node && node server.mjs   # :9317
```

### 测试

```bash
cd backend && python -m pytest -q
```

## 环境变量

复制 `.env.example` 为 `.env` 并修改。关键项：

| 变量 | 说明 |
|---|---|
| `MINGLI_LLM_API_KEY` | DeepSeek 官方 API key（必填） |
| `MINGLI_JWT_SECRET` | 随机密钥（`openssl rand -hex 32` 生成） |
| `MINGLI_SITE_DOMAIN` | 站点域名（占位符 `mingli.example.com`，真实域名不入库） |
| `MINGLI_OPERATOR_NAME/CONTACT/EMAIL` | 合规文书运营主体（`docs/legal/` 与 `frontend/public/legal/` 用 `{{OPERATOR_*}}` 占位符，服务端渲染时注入） |

## 目录结构

```
backend/                  # FastAPI 后端
  app/                    # 业务模块（auth / cases / credits / admin / paipan…）
  paipan-node/            # Node 排盘引擎（paipan-core 内核 + server.mjs）
  prompts/                # 提示词（interpret / method-prompts / pair / agent）
  tests/                  # pytest 测试
frontend/public/          # 免构建前端（index.html + js/ + css/ + data/ + art/）
data/                     # SQLite 数据库（git 忽略）与迁移脚本
docs/                     # 工程文档 / 合规文书 / 标准规范
ops/                      # 部署（docker-compose、Caddy、backup）
tools/                    # 本地开发辅助脚本
00_根/ 40_节/ 99_状态/    # 破竹框架的治理层（需求 / 迭代 / 状态）
```

## 部署

- `Dockerfile` + `docker-compose.yml`：单容器部署后端与 Node 排盘服务
- `Caddyfile`：HTTPS 反向代理，域名用环境变量 `MINGLI_SITE_DOMAIN` 注入（真实域名只存在于 `.env`，不进仓库）
- 详细流程见 `ops/deploy/README.md`

## 免责声明

本项目中的命理 / 占卜 / 心理测评内容仅供**娱乐与自我探索参考**，不构成任何医疗、法律、投资或人生决策建议。
所有输出由 AI 生成，存在不确定性，请理性看待。

## 许可证

[MIT](./LICENSE)

Copyright (c) 2026 wumohan
