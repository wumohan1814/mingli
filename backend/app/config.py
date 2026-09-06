"""应用配置（pydantic-settings，从环境变量/.env加载）"""
from pydantic import Field
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
    llm_timeout: float = 60.0                    # TAICHU_LLM_TIMEOUT（秒）
    llm_max_retries: int = 1                     # TAICHU_LLM_MAX_RETRIES（1 原始 + 1 重试 = 最多 2 次尝试）
    llm_temperature: float = 0.3                 # TAICHU_LLM_TEMPERATURE

    # JWT 鉴权（ADR-0008：HS256）
    jwt_secret: str = "change-me-in-production-use-random-32-bytes"
    access_token_ttl: int = 1800
    refresh_token_ttl: int = 604800

    # 成本闸门
    cost_gate_mode: str = "full"

    # 校验
    validation_enabled: bool = True
    validation_model: str = "mock-cheap-model"

    # 聚合窗口
    aggregation_window_dqc: int = 300
    aggregation_window_pred: int = 60

    # 任务超时
    job_timeout_dqc: int = 600
    job_timeout_pred: int = 180

    # 积分系统
    credit_per_token: int = 1000            # TAICHU_CREDIT_PER_TOKEN：1 积分 = 1000 tokens
    # alias 使环境变量名为 TAICHU_FREE_CREDIT（与字段名 free_credit_on_register 不完全对应）
    free_credit_on_register: int = Field(default=220, validation_alias="TAICHU_FREE_CREDIT")  # 新用户注册赠送积分（220 = 22万 tokens ≈ 9盘首跑 + 3次追问）
    recharge_rate: float = 10.0             # TAICHU_RECHARGE_RATE：1 元 = 10 积分（默认，后台 system_configs 可动态改）

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
    login_lock_minutes: int = 15

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
