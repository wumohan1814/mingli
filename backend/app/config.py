"""应用配置（pydantic-settings，从环境变量/.env加载）"""
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    model_config = {"env_prefix": "MINGLI_", "env_file": ".env", "extra": "ignore"}

    # 数据库
    db_path: str = str(Path("data/mingli_analytics.db"))
    feedback_db_path: str = str(Path("data/mingli_feedback.db"))
    ops_db_path: str = str(Path("data/mingli_ops.db"))   # MINGLI_OPS_DB_PATH（埋点/后台/错误上报运维库）

    # LLM（DeepSeek 官方 API，OpenAI 兼容）
    # key 只允许来自环境变量/backend/.env（MINGLI_LLM_API_KEY），严禁硬编码进源码
    llm_api_key: str = ""                        # MINGLI_LLM_API_KEY
    llm_base_url: str = "https://api.deepseek.com"  # MINGLI_LLM_BASE_URL
    llm_model: str = "deepseek-v4-flash"         # MINGLI_LLM_MODEL（解读/分析主模型）
    llm_validation_model: str = "deepseek-v4-flash"  # MINGLI_LLM_VALIDATION_MODEL（校验模型，MVP 与主模型同档，留可换便宜模型）
    llm_timeout: float = 180.0                  # MINGLI_LLM_TIMEOUT（秒；断前尘 method 为长 prompt+长 JSON 输出，需更长超时）
    llm_max_retries: int = 1                     # MINGLI_LLM_MAX_RETRIES（1 原始 + 1 重试 = 最多 2 次尝试）
    llm_temperature: float = 0.3                 # MINGLI_LLM_TEMPERATURE
    llm_max_tokens: int = 12000                  # MINGLI_LLM_MAX_TOKENS（method analyze 输出上限，防超长拖慢生成）
    llm_validation_max_tokens: int = 4000        # MINGLI_LLM_VALIDATION_MAX_TOKENS（校验输出上限）
    llm_max_concurrency: int = 3                 # MINGLI_LLM_MAX_CONCURRENCY（单用户断前尘/预测 method 并发上限）
    llm_global_max_concurrency: int = 100        # MINGLI_LLM_GLOBAL_MAX_CONCURRENCY（全局 method 并发兜底，跨所有用户）

    # JWT 鉴权（ADR-0008：HS256）——必填、无弱默认；生产由 ops/deploy/deploy.sh 生成强随机
    jwt_secret: str
    access_token_ttl: int = 1800
    refresh_token_ttl: int = 604800

    @field_validator("jwt_secret")
    @classmethod
    def _require_strong_jwt_secret(cls, v: str) -> str:
        weak = {
            "change-me-in-production-use-random-32-bytes",
            "change-me-to-a-random-32-byte-string",
        }
        if v in weak or len(v) < 32:
            raise ValueError(
                "MINGLI_JWT_SECRET 必须设为 ≥32 字符的随机值（禁止默认/占位字符串）。"
                "本地：backend/.env 或根 .env；生产：ops/deploy/deploy.sh 自动生成。"
            )
        return v

    # Agent 运维接入（REQ-050）：OpenClaw Agent 专用静态 token，独立于 admin 账号密码/JWT
    # key 只允许来自环境变量/backend/.env（MINGLI_AGENT_TOKEN），严禁硬编码进源码；
    # 空 = 禁用 /admin/agent/*（require_agent 一律 401 拒绝，防误开）
    agent_api_token: str = Field(default="", validation_alias="MINGLI_AGENT_TOKEN")  # MINGLI_AGENT_TOKEN

    # 成本闸门
    cost_gate_mode: str = "full"

    # 校验
    validation_enabled: bool = True

    # 聚合窗口
    aggregation_window_dqc: int = 300
    aggregation_window_pred: int = 60

    # 任务超时
    job_timeout_dqc: int = 600
    job_timeout_pred: int = 180

    # 余额系统
    credit_per_token: int = 1000            # MINGLI_CREDIT_PER_TOKEN：1 存储单位 = 1000 tokens
    # 节141：公开注册开关（内测白名单制）。false（默认）= POST /api/auth/register 一律 403，
    # 新账号只能由后台「新增 C 端用户」创建；测试环境在 conftest 里置 true 以便造数。
    allow_public_register: bool = False     # MINGLI_ALLOW_PUBLIC_REGISTER
    # alias 使环境变量名为 MINGLI_FREE_CREDIT（与字段名 free_credit_on_register 不完全对应）
    free_credit_on_register: int = Field(default=220, validation_alias="MINGLI_FREE_CREDIT")  # 新用户注册赠送余额（220 存储单位 = 22 元 = 22 万 tokens ≈ 9盘首跑 + 3次追问）
    recharge_rate: float = 10.0             # MINGLI_RECHARGE_RATE：1 元 = 10 存储单位（默认，后台 system_configs 可动态改）

    # 节146：金数据充值（jinshuju_* 9 项配置）已随付款充值链路整条拆除。
    # 余额换算口径保留：credit_per_token / recharge_rate（见上）。

    # 限流
    login_max_failures: int = 5
    login_lock_minutes: int = 1440   # 连续 5 次密码错误后锁定 24 小时（1440 分钟）

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Node运行时
    node_path: str = "node"

    # 排盘常驻 Node 服务（paipan-node/server.mjs，HTTP 优先 + subprocess 降级）
    paipan_node_url: str = "http://127.0.0.1:9317"   # MINGLI_PAIPAN_NODE_URL
    paipan_node_port: int = 9317                     # MINGLI_PAIPAN_NODE_PORT
    paipan_max_concurrency: int = 3                  # MINGLI_PAIPAN_MAX_CONCURRENCY（排盘并发上限）

    # 合规文书主体信息（节147 续：抽成配置，仓库里两份文书只放占位符）
    # 背景：用户协议 / 隐私政策是**线上要展示**的合规文书，必须写真实运营主体；
    #   但项目要开源（节142），真实姓名/联系方式留在仓库里等于开源即公开。
    # 解法：仓库里的 docs/legal/*.md 与 frontend/public/legal/*.html 只含
    #   {{OPERATOR_NAME}} / {{OPERATOR_CONTACT}} / {{OPERATOR_EMAIL}} 占位符，
    #   由后端在**服务端渲染**时用这三个配置注入（见 app/legal.py）。
    # ⚠️ 三项任一为空 → 访问 /legal/*.html 一律 500（有意为之：不发布没有运营主体的协议）。
    operator_name: str = ""       # MINGLI_OPERATOR_NAME（运营者名称）
    operator_contact: str = ""    # MINGLI_OPERATOR_CONTACT（联系方式）
    operator_email: str = ""      # MINGLI_OPERATOR_EMAIL（邮箱）

    # 运行形态（渠道开关，2026-09-22 用户拍板：补「同源构建」地基）。
    # 同一份代码支撑三种形态：web（默认，= 现状：账号/计费/分享/后台 admin、key 在服务端）
    # / apk-local（APK 单机：无账号无计费无分享、用户自填 key、数据在本机）
    # / apk-client（壳指向自部署服务器：能力跟随服务器）。
    # ⚠️ 默认值必须是 web —— 缺省即现状，线上部署行为零变化。
    # 能力清单唯一事实源在 app/runtime.py；兼容矩阵见 docs/standards/08。
    runtime_mode: str = "web"                # MINGLI_RUNTIME_MODE

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
