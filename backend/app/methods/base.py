"""方法模块公共基座：真实 LLM 调用 + prompt 加载 + JSON 稳健解析。

各方法模块（bazi-pattern / ziwei / …）的 analyzer.py 只保留薄封装，
统一委托本模块的 `analyze_method()` 执行 LLM 分析与结果规范化。

method-result v2 输出契约：
    {
      "method": "<方法 key>",
      "phase": "duan-qian-chen|prediction",
      "past_propositions": [
        {"year_range", "domain", "claim", "confidence_level", "confidence_reason", "basis"}
      ],
      "conclusions": [          // 仅 prediction 阶段输出
        {"direction", "domain", "claim", "confidence_level", "evidence", "risks"}
      ]
    }
    direction ∈ {吉, 凶, 平}；confidence_level ∈ {high, medium, low, speculative}。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings
from app.llm import LLMError, chat

logger = logging.getLogger(__name__)

# base.py 位于 backend/app/methods/，parents[2] = backend
PROMPT_DIR = Path(__file__).resolve().parents[2] / "prompts" / "method-prompts"

# 追加到 method-prompt 之后的输出格式硬性指令（不改动 method-prompts/*.md 原文）
_OUTPUT_FORMAT_INSTRUCTIONS = """
【输出格式（硬性要求，覆盖以上 prompt 中的任何格式说明）】
1. 只输出一个 method-result v2 JSON 对象本身；不要输出任何解释文字、标题、markdown 代码围栏或前后缀。
2. 结构固定为：{"method": "<方法 key>", "phase": "<phase 原样>", "past_propositions": [...], "conclusions": [...]}。
3. past_propositions 必须始终输出为数组（可为空），元素结构：
   {"year_range": "<年份/大运区间>", "domain": "<领域，如事业/财运/健康>", "claim": "<命题断言>",
    "confidence_level": "<等级>", "confidence_reason": "<置信理由>", "basis": ["<依据 1>", "..."]}。
4. 仅当 phase 为 "prediction" 时，额外输出 conclusions 数组（可为空）；元素结构：
   {"direction": "<吉|凶|平>", "domain": "<领域>", "claim": "<结论断言>", "confidence_level": "<等级>",
    "evidence": ["<证据 1>", "..."], "risks": ["<风险 1>", "..."]}。
   非 prediction 阶段不要输出 conclusions（会强制置为 []）。
5. 枚举约束（违者视为非法输出）：
   - direction 只能取 "吉"、"凶"、"平" 三者之一；
   - confidence_level 只能取 "high"、"medium"、"low"、"speculative" 四者之一。
6. 盘面无法支撑的命题宁可不列，严禁编造盘面中不存在的依据；输出必须是合法 JSON（键名与上文完全一致，字符串用双引号）。

【证据分层与置信度校准（节116 · 第②步）】
evidence / basis 数组的每条证据请用 [Lx] 前缀标注证据层级，便于溯源与置信度校准：
  - [L1] 排盘事实：直接来自排盘数据的原始事实（如"日主甲木"、"月支申金"、"大运庚辰"）
  - [L2] 确定性计算：由代码/排盘引擎算出的确定性结论（如十神关系、五行生克、神煞、格局判定）
  - [L3] 传统依据：经典命理理论、口诀、成格条件（如"伤官见官"、"食神制杀"）
  - [L4] 推断延伸：基于以上证据的合理推断与延伸（非直接事实，是推导出来的）
  - [L5] 待核验：需要用户现实反馈才能确认的内容

置信度与证据层级的对应关系（请自觉遵守）：
  - high：结论有 L1 或 L2 级直接证据支撑，且有 L3 传统依据互证
  - medium：有 L3 级传统依据或多条 L2 证据互相印证
  - low：只有 L4 级推断，或单条 L2/L3 孤证
  - speculative：纯推测，无直接盘面证据，仅为可能性提示

【溯源要求】
  - 每条结论的 evidence 数组至少给出 1 条可溯源的依据（L1/L2/L3 级）
  - 只有 L4 或更低层级证据的结论，置信度不得高于 low
  - L4 推断不得冒充 L2/L3 确定性结论；推断性表述请用"可能""倾向于"等措辞
  - 宁可不列，也不要编造不存在的盘面依据

【正文自检与输出收敛（节116 · 第③步）】
1. 表述规范（红线）：
   - 禁止使用"一定""绝对""100%""必然""肯定""毫无疑问"等绝对化表述
   - 禁止编造具体年份或精确日期作为应期；时间判断以大运/流年/月份的干支或五行表述为主
   - 禁止医疗断言（疾病名称、诊断、治疗建议）；健康相关仅作倾向性提示
   - 禁止恐惧营销（"大祸临头""必死"等耸动表述）
2. 反巴纳姆效应：
   - 不写对所有人都成立的废话（如"有时候外向有时候内向""有压力也有动力"）
   - 每条结论必须紧扣该命盘的具体盘面特征（从 L1/L2 证据出发）
   - 对照反例：❌"你有时候很果断，有时候会犹豫"／✅"甲木日主得令身强，性格上偏果断但易固执"
3. 输出收敛（结论漏斗）：
   - 每个领域聚焦 1 个主判断 + 1 条主因果链，不要堆砌多条平行结论
   - 删掉"会有波动""有反复""需注意"等无信息量的泛化句
   - 时间窗口（应期）最多给出 3 个，且必须有明确的盘面依据
4. 置信度明示：
   - low / speculative 置信度的结论，claim 文本中须体现不确定性（用"可能""倾向于""需结合具体情况判断"等）
   - 不得用确定性语气表述低置信结论
"""


def load_prompt(method_key: str) -> str:
    """读取方法提示词 backend/prompts/method-prompts/<method_key>.md；不存在返回 ""。"""
    path = PROMPT_DIR / f"{method_key}.md"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        logger.warning("方法 prompt 不存在，返回空串: %s", path)
        return ""


def parse_method_result(text: str) -> dict:
    """稳健解析 LLM 输出的 method-result JSON。

    依次：剥离 markdown code fence（```json … ```）→ 截取首个 "{" 到末个 "}" →
    json.loads。任何失败抛 ValueError（调用方/编排层决定如何处理，不在此吞错兜底）。
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("LLM 输出为空或非文本")
    cleaned = _strip_code_fence(text.strip())
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"LLM 输出中未找到 JSON 对象的起止大括号: {cleaned[:200]!r}")
    payload = cleaned[start:end + 1]
    try:
        result = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"method-result JSON 解析失败: {exc} — 原文片段: {payload[:300]!r}") from exc
    if not isinstance(result, dict):
        raise ValueError(f"method-result 必须是 JSON 对象，实际为 {type(result).__name__}")
    return result


def _strip_code_fence(text: str) -> str:
    """去掉整段文本外围的 markdown code fence（```json … ``` 或 ``` … ```）。"""
    lines = text.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


async def analyze_method(
    method_key: str,
    phase: str,
    slice_data: dict,
    user_question: str = "",
    calibration_feedback: dict | None = None,
    continuation: str = None,
) -> dict | None:
    """通用方法分析：加载 prompt → 组装 messages → 真实 LLM 调用 → 解析并规范化。

    返回 method-result v2 dict；以下两种情况返回 None（调用方记 degraded）：
    - 方法 prompt 缺失（method-prompts/<key>.md 不存在或为空）；
    - slice_data 不是非空 dict（盘面为空）。

    LLMError（调用失败）与 ValueError（输出解析失败）在此记日志后**原样向上抛**，
    不降级成 mock 数据——由编排层决定该法失败/降级。
    """
    prompt = load_prompt(method_key)
    if not prompt:
        logger.warning("方法 prompt 缺失，analyze_method 返回 None（degraded）: method_key=%s", method_key)
        return None

    if not isinstance(slice_data, dict) or not slice_data:
        logger.warning("盘面 slice 为空，analyze_method 返回 None（degraded）: method_key=%s phase=%s",
                       method_key, phase)
        return None

    payload: dict = {
        "phase": phase,
        "method_key": method_key,
        "slice": slice_data,
        "user_question": user_question,
        "calibration_feedback": calibration_feedback,
    }
    # 断点续跑上下文：服务重启后中断续跑时注入（非空才加，calibration_feedback
    # 保持无条件携带的既有行为不变）
    if continuation:
        payload["continuation"] = continuation

    messages = [
        {"role": "system", "content": prompt + _OUTPUT_FORMAT_INSTRUCTIONS},
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=False),
        },
    ]

    try:
        resp = await chat(messages, json_mode=True, max_tokens=settings.llm_max_tokens)
        result = parse_method_result(resp["content"])
    except LLMError as exc:
        logger.warning("方法 LLM 调用失败，交由编排层决定降级: method_key=%s phase=%s error=%s",
                       method_key, phase, exc)
        raise
    except ValueError as exc:
        logger.warning("方法 LLM 输出解析失败，交由编排层决定降级: method_key=%s phase=%s error=%s",
                       method_key, phase, exc)
        raise

    # 规范化：强制 method/phase 以调用方为准；数组键缺省补空
    result["method"] = method_key
    result["phase"] = phase
    result.setdefault("past_propositions", [])
    if phase == "prediction":
        result.setdefault("conclusions", [])
    else:
        result["conclusions"] = []
    return result
