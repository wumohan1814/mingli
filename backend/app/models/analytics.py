"""用户分析库 ORM 模型（taichu_analytics）"""
from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CaseStatus(str, enum.Enum):
    created = "created"
    paipan_done = "paipan_done"
    dqc_running = "dqc_running"
    dqc_done = "dqc_done"
    calibrated = "calibrated"
    predict_running = "predict_running"
    predict_done = "predict_done"
    failed = "failed"


class JobType(str, enum.Enum):
    duan_qian_chen = "duan-qian-chen"
    predict = "predict"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class Phase(str, enum.Enum):
    duan_qian_chen = "duan-qian-chen"
    prediction = "prediction"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    nickname = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cases = relationship("Case", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(256), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), nullable=False, index=True)
    fail_count = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(128), nullable=True)
    mbti_type = Column(String(8), nullable=True)   # 该档案主人的 MBTI 类型（如 INTJ；POST /api/mbti/score 回写）
    phone = Column(String(32), nullable=True)      # 手机号（REQ-065：非必填，CRM 列表/档案详情展示）
    email = Column(String(128), nullable=True)     # 电子邮箱（REQ-065：非必填，CRM 列表/档案详情展示）
    input_json = Column(JSON, nullable=True)
    current_stage = Column(Integer, default=0)
    status = Column(SAEnum(CaseStatus), default=CaseStatus.created)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="cases")
    chart = relationship("Chart", back_populates="case", uselist=False)
    method_results = relationship("MethodResult", back_populates="case")
    calibration = relationship("Calibration", back_populates="case", uselist=False)
    conversations = relationship("Conversation", back_populates="case")
    jobs = relationship("Job", back_populates="case")


class Chart(Base):
    __tablename__ = "charts"

    case_id = Column(Integer, ForeignKey("cases.id"), primary_key=True)
    chart_json = Column(JSON, nullable=True)
    degraded_methods = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    generated_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="chart")


class MethodResult(Base):
    __tablename__ = "method_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    method_key = Column(String(64), nullable=False)
    phase = Column(SAEnum(Phase), nullable=False)
    result_json = Column(JSON, nullable=True)
    validation_json = Column(JSON, nullable=True)
    cached = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="method_results")


class Calibration(Base):
    __tablename__ = "calibrations"

    case_id = Column(Integer, ForeignKey("cases.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    record_json = Column(JSON, nullable=True)
    fit_json = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="calibration")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    turn = Column(Integer, nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=True)
    # 板块追问 topic（如 "事业"/"财运"/"婚姻"）；普通追问为 None，保持兼容
    topic = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="conversations")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SAEnum(JobType), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.pending)
    total = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="jobs")


class RouteDecision(Base):
    __tablename__ = "route_decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    phase = Column(SAEnum(Phase), nullable=False)
    main_methods = Column(JSON, nullable=True)
    support_methods = Column(JSON, nullable=True)
    reasons = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CreditAccount(Base):
    """积分账户（credit_accounts，user_id 1:1）"""
    __tablename__ = "credit_accounts"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    balance = Column(Integer, default=0)
    total_consumed = Column(Integer, default=0)
    total_recharged = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CreditTransaction(Base):
    """积分流水（credit_transactions，delta>0 入账 / delta<0 消费）"""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    delta = Column(Integer)                 # 正=入账，负=消费
    type = Column(String(16))               # consume | recharge | manual | refund | free
    tokens = Column(Integer, nullable=True)
    amount = Column(Float, nullable=True)
    ref = Column(String(128), nullable=True)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RechargeCode(Base):
    """充值码（recharge_codes）：一次性、绑定 user_id、短时效；充值成功即作废（防重放）。

    status: unused（可用）| used（已充值作废）| expired（预留过期态）。
    """
    __tablename__ = "recharge_codes"

    code = Column(String(16), primary_key=True)   # TC-XXXXXX
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    status = Column(String(8), default="unused")  # unused | used | expired
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemConfig(Base):
    """后台可动态改的系统配置（system_configs，如 recharge_rate / free_credit_on_register）"""
    __tablename__ = "system_configs"

    key = Column(String(64), primary_key=True)  # 如 recharge_rate / free_credit_on_register
    value = Column(String(255))
    description = Column(String(255), nullable=True)
    updated_by = Column(String(64), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RegisterLimit(Base):
    """注册限流计数（register_limits）：注册成功落一行，按 IP / 设备指纹两个维度限流。

    表由 main.py lifespan 的 Base.metadata.create_all 幂等建（老库自动补，无需 ALTER）。
    行不清理：IP 维度查询带 1 小时时间窗，旧行自然失效；设备指纹维度不带时间窗，
    同一设备永久只能注册一个账号。
    """
    __tablename__ = "register_limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip = Column(String(64), index=True)
    device_fingerprint = Column(String(128), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Divination(Base):
    """临时起卦（divinations，Phase B）：确定性起卦免费落库 + LLM 断卦可选付费缓存。

    seed_json / result_json 均可为 None（转发 Node 失败时不落库，故正常行两者非空）；
    interpretation_json 由 POST /divinations/{id}/interpret 写入（{"content": 断卦文本}），
    命中即为缓存，二次 interpret 零 LLM 零扣费直接返回。
    """
    __tablename__ = "divinations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)  # 起卦关联国学档案
    method = Column(String(32), nullable=False)        # liuyao|meihua|xiaoliuren|ssgw|lenormand|...
    seed_json = Column(JSON, nullable=True)            # 报数/时间/摇卦结果
    result_json = Column(JSON, nullable=True)          # 卦象/课式/签文（确定性）
    interpretation_json = Column(JSON, nullable=True)  # LLM 断卦（可选付费，缓存于此）
    created_at = Column(DateTime, default=datetime.utcnow)


class TarotReading(Base):
    """塔罗抽牌（tarot_readings，Phase C）：确定性抽牌免费落库 + LLM 综合解读可选付费缓存。

    draw_json 为 Node /tarot 引擎输出（spreadName + cards[]，含正逆位/关键词/元素/原型），
    确定性免费；interpretation_json 由 POST /api/tarot/readings/{id}/interpret 写入
    （{"content": 解读文本}），命中即为缓存，二次 interpret 零 LLM 零扣费直接返回。
    """
    __tablename__ = "tarot_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    spread_type = Column(String(32), nullable=False)   # single/three/love/career/decision
    question = Column(Text, nullable=True)             # 用户占问方向（可选）
    draw_json = Column(JSON, nullable=True)            # 牌阵 + cards[]（确定性）
    interpretation_json = Column(JSON, nullable=True)  # LLM 综合解读（缓存）
    created_at = Column(DateTime, default=datetime.utcnow)


class AstrologyReading(Base):
    """星座星盘（astrology_readings，Phase D1）：确定性星盘免费落库 + LLM 本命解读可选付费。

    chart_json 为 Node /astrology 引擎输出：{natal, fullScope?}（natal 本命盘恒有；
    scope != 'natal' 时附带 fullScope = natal+yearly+monthly+daily 行运上下文），
    确定性免费；reading_json 由 POST /api/astrology/charts/{id}/interpret 写入
    （{"content": 解读文本}），命中即为缓存，二次 interpret 零 LLM 零扣费直接返回。
    scope 取值 MVP 以 natal 为主，后续盘型（transit/solar_return/secondary/firdaria）
    复用同一行记录；scope 列本身不约束取值（String 宽松存前端请求原值）。
    """
    __tablename__ = "astrology_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)  # 关联国学档案（生辰同源）
    chart_json = Column(JSON, nullable=True)           # {natal, fullScope}（确定性）
    scope = Column(String(32), nullable=True)          # natal|transit|solar_return|secondary|firdaria
    reading_json = Column(JSON, nullable=True)         # LLM 解读（缓存）
    created_at = Column(DateTime, default=datetime.utcnow)


class MbtiResult(Base):
    """MBTI 人格测试结果（mbti_results，Phase D2）：纯代码判型免费落库，零 LLM 零扣费。

    answers_json 为逐题答案原样（[{question_id, choice}|{id, pole}, ...]）；
    scores_json 为四维分（{"EI":{"E":n,"I":n},"SN":{...},"TF":{...},"JP":{...}}）；
    type 为 4 字母类型（如 INTJ）；type_info（16 型文案）不落库，由
    GET /api/mbti/results/{id} 实时从 mbti/data/types.json 取。
    """
    __tablename__ = "mbti_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)  # 关联国学档案（判型结果写回 case.mbti_type）
    answers_json = Column(JSON, nullable=True)         # 逐题答案
    scores_json = Column(JSON, nullable=True)          # 四维分
    type = Column(String(8), nullable=True)            # 如 INTJ
    created_at = Column(DateTime, default=datetime.utcnow)


class MbtiShareLink(Base):
    """MBTI 免登录分享链接（mbti_share_links，REQ-047）：绑定某档案(case)的专属链接。

    他人打开 GET /api/mbti/share/{token}（免登录）仅答 MBTI 并判型，
    每次填写作为一条 MbtiResult 历史记录存入该档案（user_id 取档案主人 case.user_id），
    **不回写** case.mbti_type（填写人可能是他人，不覆盖主人结果）。
    token 由 secrets.token_urlsafe(16) 生成；同一 case 重复 POST /api/mbti/share
    幂等复用已有链接（按 case_id 查重），不重复建行。
    """
    __tablename__ = "mbti_share_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)  # 绑定档案
    token = Column(String(64), unique=True, nullable=False, index=True)            # 分享 token
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case")


class PairReading(Base):
    """双人配对解析记录（pair_readings，REQ-072）：三大模块 LLM 配对解析结果留存。

    由 POST /api/pair/analyze 在 LLM 成功后落一行（module 校验白名单 guoxue /
    xishi / mbti），result_json 存 {"content": 配对解析文本}；LLM 失败不落行
    （502 提示重试），无缓存复用语义——每次请求均新起一次解析。

    case_id_1 / case_id_2 为普通 Integer（**不建 case 外键**）：删除档案时不级联
    处理，历史配对记录保留（列存 id 足够展示/排查，避免删除联动复杂）。
    """
    __tablename__ = "pair_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id_1 = Column(Integer, nullable=False)   # 档案一 id（普通 Integer，无 FK）
    case_id_2 = Column(Integer, nullable=False)   # 档案二 id（普通 Integer，无 FK）
    relation_type = Column(String(32), nullable=False)  # 恋爱/朋友/家人/同事等
    question = Column(Text, nullable=True)        # 用户补充关注点（可选）
    module = Column(String(16), nullable=False)   # guoxue | xishi | mbti
    result_json = Column(JSON, nullable=True)     # {"content": 配对解析文本}
    created_at = Column(DateTime, default=datetime.utcnow)


def _share_default_expiry() -> datetime:
    """case_share_links 缺省有效期：建行时未显式传 expires_at → 7 天后过期。"""
    return datetime.utcnow() + timedelta(days=7)


class CaseShareLink(Base):
    """帮填一次性分享链接（case_share_links，REQ-070）：免登录代建档案归发起者。

    发起者（鉴权）POST /api/case/share 生成/复用一条**只绑定自己 user_id** 的链接
    （不绑 case：帮填本质是让访客代发起者**新建**一个档案，档案名由帮填者填）；
    他人（免登录）GET /api/case/share/{token} 仅可见 owner_name（昵称/手机号脱敏）
    + 建档字段定义，POST /api/case/share/{token}/submit 代建档案
    （user_id=发起者、name=帮填者所填姓名）后 token.used=True 一次性失效。

    幂等复用：同一发起者存在 used=False 且未过期的链接时重复点「分享帮填」返回
    同一 token（与 MbtiShareLink 按 case 查重复用同思路）；被使用/过期后下次生成新链。
    expires_at 缺省 7 天（_share_default_expiry）；过期后 GET/submit 均判失效。
    """
    __tablename__ = "case_share_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # 发起者
    token = Column(String(64), unique=True, nullable=False, index=True)            # 一次性 token（token_urlsafe(16)）
    used = Column(Boolean, default=False)   # True=已代建提交，链接即失效
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True, default=_share_default_expiry)    # 缺省 7 天

    user = relationship("User")


class UserSetting(Base):
    """用户功能设置（user_settings，REQ-066）：7 项开关按 user 1:1 持久化。

    GET /api/settings 无记录时返回默认值（不落库）；PUT /api/settings upsert
    （无记录则建、有则更新，未显式给的字段由列 default 兜底）。
    default_mode 取值 manual|auto|both（api/settings.py Pydantic 校验，非法 400）。
    表由 main.py lifespan 的 Base.metadata.create_all 幂等建（老库自动补，无需 ALTER）。
    """
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    anim_enabled = Column(Boolean, default=True)        # ①动画与抽卡模拟
    default_mode = Column(String(16), default="auto")   # ②占卜界面默认模式：manual|auto|both
    banner_dropdown = Column(Boolean, default=False)    # ③Banner 模块下拉导航
    share_taichu_ui = Column(Boolean, default=True)     # ④分享表单太初 UI
    bg_enabled = Column(Boolean, default=True)          # ⑤背景图显示
    card_images = Column(Boolean, default=True)         # ⑥牌面图片显示
    agent_enabled = Column(Boolean, default=True)       # ⑦太初先生 Agent
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
