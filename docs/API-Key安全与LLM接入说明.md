# API-Key 安全与 LLM 接入说明

> 范围：DeepSeek 官方 API（OpenAI 兼容）接入层 `backend/app/llm/` + 配置项 `backend/app/config.py`。
> 目标读者：命理后续实现方法模块 / 校验 / 编排的开发者。

## 1. MVP 现状

- **key 存哪**：明文存于 `backend/.env`（本地文件，已被根 `.gitignore` 的 `.env` 规则忽略，**不进版本库**）。
- **key 怎么读**：FastAPI 启动时 cwd 为 `backend`（`start.sh`/`start.bat` 均先 `cd backend`），
  pydantic-settings 以 `MINGLI_` 前缀 + `env_file=".env"` 读入 `Settings`，最终落在
  `settings.llm_api_key` 单点。
- **零硬编码**：全项目 `.py` 源码 / `.env.example` / README 中无真实 key 字面量；真实 key 唯一出现在
  `backend/.env`（该文件被 git 忽略）。
- **接入层**：`backend/app/llm/client.py` 的 `chat()` 用 `httpx.AsyncClient` 调
  `{llm_base_url}/chat/completions`，带 `Authorization: Bearer`；无 key 时抛
  `LLMError("未配置 MINGLI_LLM_API_KEY")`。
- **现有环境变量键**（`backend/.env` 内）：`MINGLI_DB_PATH`、`MINGLI_FEEDBACK_DB_PATH` 与
  新增 `MINGLI_LLM_*` 同文件共存，便于从 backend 目录独立启动。

## 2. 已留的升级空间（未来怎么改、改哪里）

### 2.1 key 来源收敛 + 换 secret manager
key 来源已**统一收敛**在 `backend/app/config.py` 的 `llm_api_key` 一处。
未来换 AWS Secrets Manager / HashiCorp Vault / K8s Secret / 云函数环境变量注入时，
只需替换该字段的取值来源（例如给 `Settings` 增加一个 provider 逻辑，或用云平台原生注入覆盖环境变量），
**`backend/app/llm/client.py` 不用改一行**。

### 2.2 provider / 模型档位可配置
- `MINGLI_LLM_BASE_URL` 配置化：切换成任何 OpenAI 兼容协议的 provider 只改环境变量，不改代码。
- `MINGLI_LLM_MODEL` 配置化：MVP 用 `deepseek-v4-flash`，想升级更强档位只改环境变量。

### 2.3 校验模型与主模型分离
`MINGLI_LLM_VALIDATION_MODEL`（默认同主模型档位）与 `MINGLI_LLM_MODEL` 独立配置，
后续按 ADR-0002 把断前尘校验切到更便宜的模型并单独计量时，
改环境变量即可，校验/编排代码只读各自配置，互不耦合。

## 3. 安全红线（MVP 必须遵守）

- key **严禁**硬编码进源码、前端、README、`.env.example`（模板只能用占位符）。
- **严禁**把 `backend/.env` 提交 git（`.gitignore` 的 `.env` 规则已覆盖，含子目录）。
- 泄露即轮换：立即到 DeepSeek 平台作废旧 key、生成新 key 并更新 `backend/.env`。
- 生产环境必须走 secret manager + 最小权限（服务账号只读所需 secret，不用长明文）。
- 提交代码 / 贴日志前自查：不得出现 `sk-` 开头的真实 key 片段。

## 4. 当前风险与 TODO（Phase2 待办）

| 风险/缺口 | 说明 | 建议 |
| --- | --- | --- |
| 明文 .env 泄露窗口 | 本地明文存 key，若机器/备份被入侵即泄露 | Phase2 引入 secret manager；开发机全盘加密；`.env` 不进任何备份 |
| 无 key 轮换机制 | 当前只能手工改 `backend/.env` | Phase2 做轮换 SOP / 半自动化 |
| 无用量告警 | `chat()` 已按次记录 usage tokens 日志，但无聚合告警 | Phase2 基于日志或网关做 token 用量计量与阈值告警（成本闸门联动） |
