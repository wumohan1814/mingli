"""应用配置（pydantic-settings，从环境变量/.env加载）"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    model_config = {"env_prefix": "TAICHU_", "env_file": ".env", "extra": "ignore"}

    # 数据库
    db_path: str = str(Path("data/taichu_analytics.db"))
    feedback_db_path: str = str(Path("data/taichu_feedback.db"))

    # LLM（DeepSeek 官方 API，OpenAI 兼容）
    # key 只允许来自环境变量/backend/.env（TAICHU_LLM_API_KEY），严禁硬编码进源码
    llm_api_key: str = ""                        # TAICHU_LLM_API_KEY
    llm_base_url: str = "https://api.deepseek.com"  # TAICHU_LLM_BASE_URL
    llm_model: str = "deepseek-v4-flash"         # TAICHU_LLM_MODEL（解读/分析主模型）
    llm_validation_model: str = "deepseek-v4-flash"  # TAICHU_LLM_VALIDATION_MODEL（校验模型，MVP 与主模型同档，留可换便宜模型）
    llm_timeout: float = 60.0                    # TAICHU_LLM_TIMEOUT（秒）
    llm_max_retries: int = 2                     # TAICHU_LLM_MAX_RETRIES
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

    # 限流
    login_max_failures: int = 5
    login_lock_minutes: int = 15

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Node运行时
    node_path: str = "node"

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
