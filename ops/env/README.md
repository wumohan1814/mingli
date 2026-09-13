# env/ — 环境变量

`.env.example` 是环境变量的**唯一来源**。新增变量需同步三处：
本文件 → `docs/standards/04-环境与部署说明.md` §3 → `docs/standards/03-接口与数据字典.md` §7。

## 规则

- 命名 `MINGLI_` + `UPPER_SNAKE_CASE`。
- 只有 `.env.example` 入库；真实 `.env` 已被 `.gitignore` 排除。
- 密钥（JWT / LLM API Key / captcha）走部署平台密钥管理，不落文件。

## 关键变量

`MINGLI_ENV` ｜ `MINGLI_DB_PATH` ｜ `MINGLI_FEEDBACK_DB_PATH` ｜ `MINGLI_JWT_SECRET` ｜
`MINGLI_LLM_API_KEY` ｜ `MINGLI_LLM_MODEL` ｜ `MINGLI_COST_GATE_MODE` ｜ `MINGLI_NODE_BIN`

## 待补

- [ ] `.env.example`
