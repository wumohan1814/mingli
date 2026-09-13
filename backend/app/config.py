"""应用配置（pydantic-settings，从环境变量/.env加载）"""
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    model_config = {"env_prefix": "TAICHU_", "env_file": ".env", "extra": "ignore"}

    # 数据库
    db_path: str = str(Path("data/taichu_analytics.db"))
    feedback_db_path: str = str(Path("data/taichu_feedback.db"))
    ops_db_path: str = str(Path("data/taichu_ops.db"))   # TAICHU_OPS_DB_PATH（埋点/后台/错误上报运维库）

    # LLM（DeepSeek 官方 API，OpenAI 兼容）
    # key 只允许来自环境变量/backend/.env（TAICHU_LLM_API_KEY），严禁硬编码进源码
    llm_api_key: str = ""                        # TAICHU_LLM_API_KEY
    llm_base_url: str = "https://api.deepseek.com"  # TAICHU_LLM_BASE_URL
    llm_model: str = "deepseek-v4-flash"         # TAICHU_LLM_MODEL（解读/分析主模型）
    llm_validation_model: str = "deepseek-v4-flash"  # TAICHU_LLM_VALIDATION_MODEL（校验模型，MVP 与主模型同档，留可换便宜模型）
    llm_timeout: float = 180.0                  # TAICHU_LLM_TIMEOUT（秒；断前尘 method 为长 prompt+长 JSON 输出，需更长超时）
    llm_max_retries: int = 1                     # TAICHU_LLM_MAX_RETRIES（1 原始 + 1 重试 = 最多 2 次尝试）
    llm_temperature: float = 0.3                 # TAICHU_LLM_TEMPERATURE
    llm_max_tokens: int = 12000                  # TAICHU_LLM_MAX_TOKENS（method analyze 输出上限，防超长拖慢生成）
    llm_validation_max_tokens: int = 4000        # TAICHU_LLM_VALIDATION_MAX_TOKENS（校验输出上限）
    llm_max_concurrency: int = 3                 # TAICHU_LLM_MAX_CONCURRENCY（单用户断前尘/预测 method 并发上限）
    llm_global_max_concurrency: int = 100        # TAICHU_LLM_GLOBAL_MAX_CONCURRENCY（全局 method 并发兜底，跨所有用户）

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
                "TAICHU_JWT_SECRET 必须设为 ≥32 字符的随机值（禁止默认/占位字符串）。"
                "本地：backend/.env 或根 .env；生产：ops/deploy/deploy.sh 自动生成。"
            )
        return v

    # Agent 运维接入（REQ-050）：OpenClaw Agent 专用静态 token，独立于 admin 账号密码/JWT
    # key 只允许来自环境变量/backend/.env（TAICHU_AGENT_TOKEN），严禁硬编码进源码；
    # 空 = 禁用 /admin/agent/*（require_agent 一律 401 拒绝，防误开）
    agent_api_token: str = Field(default="", validation_alias="TAICHU_AGENT_TOKEN")  # TAICHU_AGENT_TOKEN

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
    credit_per_token: int = 1000            # TAICHU_CREDIT_PER_TOKEN：1 存储单位 = 1000 tokens
    # 节141：公开注册开关（内测白名单制）。false（默认）= POST /api/auth/register 一律 403，
    # 新账号只能由后台「新增 C 端用户」创建；测试环境在 conftest 里置 true 以便造数。
    allow_public_register: bool = False     # TAICHU_ALLOW_PUBLIC_REGISTER
    # alias 使环境变量名为 TAICHU_FREE_CREDIT（与字段名 free_credit_on_register 不完全对应）
    free_credit_on_register: int = Field(default=220, validation_alias="TAICHU_FREE_CREDIT")  # 新用户注册赠送余额（220 存储单位 = 22 元 = 22 万 tokens ≈ 9盘首跑 + 3次追问）
    recharge_rate: float = 10.0             # TAICHU_RECHARGE_RATE：1 元 = 10 存储单位（默认，后台 system_configs 可动态改）

    # 金数据支付（充值表单 K4kgC7，小金商务助手；字段映射已锁定，见 docs/架构设计-支付系统-金数据.md §9.2）
    jinshuju_form_url: str = "https://u2zi0lwm.jsjform.com/f/K4kgC7"   # 充值表单完整 URL（跳转地址）
    jinshuju_form_token: str = "K4kgC7"                                # 表单 token（API 用）
    jinshuju_access_token: str = ""          # TAICHU_JINSHUJU_ACCESS_TOKEN：个人 Access Token（敏感，只走 env/.env，默认空=不轮询）
    jinshuju_api_base: str = "https://api.jinshuju.net/v1"             # 金数据开放 API v1 base
    jinshuju_poll_interval: int = 300        # TAICHU_JINSHUJU_POLL_INTERVAL：轮询间隔（秒），默认 5 分钟
    jinshuju_field_code: str = "field_1"     # 充值码字段
    jinshuju_field_amount: str = "field_2"   # 商品档位字段（数组 [{name,number,price}]，取 number>0 的 price）
    jinshuju_field_status: str = "field_3"   # 处理状态字段（预留回写「已处理」）
    jinshuju_allow_mock: bool = True         # TAICHU_JINSHUJU_ALLOW_MOCK：自测允许 MOCK_PAY_SUCCESS；**生产设 false**

    # 限流
    login_max_failures: int = 5
    login_lock_minutes: int = 1440   # 连续 5 次密码错误后锁定 24 小时（1440 分钟）

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Node运行时
    node_path: str = "node"

    # 排盘常驻 Node 服务（paipan-node/server.mjs，HTTP 优先 + subprocess 降级）
    paipan_node_url: str = "http://127.0.0.1:9317"   # TAICHU_PAIPAN_NODE_URL
    paipan_node_port: int = 9317                     # TAICHU_PAIPAN_NODE_PORT
    paipan_max_concurrency: int = 3                  # TAICHU_PAIPAN_MAX_CONCURRENCY（排盘并发上限）

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
