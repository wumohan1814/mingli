# -*- coding: utf-8 -*-
"""REQ-063 余额流水可读化：扣费 ref → 中文标签 + 消耗档案名反查。

分层设计（本模块只做**只读映射**，不碰计费逻辑、不修改 ref 写入格式）：

- 纯函数层（不触库，可独立单测）：
  - ``parse_ref(ref)``：把 ref 解析成结构化 dict；无法识别返回 None；
  - ``ref_label(ref, tx_type, *, job_type=None, divination_method=None)``：
    ref + 流水 type → 中文标签；库内字段（jobs.type / divinations.method）
    由调用方查库后以关键字传入，未传时按规则兜底；
- 库增强层 ``label_case_map(session, rows)``：在调用方同一 session 内**批量**
  反查 jobs / divinations / astrology_readings / cases，为每条流水计算
  {label, case_name}，供 service.transactions 逐条附加。

ref 现存格式（backend/app 逐法/即时扣费写死，见 app/jobs/orchestrator.py、
app/api/cases.py、app/api/divination.py、app/api/tarot.py、app/api/astrology.py）：

  job:{job_id}:{method_key}     断前尘/预测逐法扣费（前缀按 jobs.type 区分）
  revise:{case_id}              多轮修正/板块追问（追问）
  query:{case_id}:{method_key}  单法直问（prediction 单法 analyze）
  divination:{id}               起卦断卦 / 雷诺曼解读（按 divinations.method 区分）
  divination_focus:{id}:{focus} 六爻焦点详解（REQ-075，按 divinations.method 区分）
  tarot:{id}                    塔罗解读（tarot_readings 无 case_id 列，档案名恒空）
  astrology:{id}                星座本命解读
  agent:{user_id}               太初先生对话（无档案，闲聊）
  agent:{user_id}:{case_id}     太初先生对话（选了默认档案，可反查档案名）
  serial:{serial}               历史充值流水（type=recharge）。**节146 充值链路已拆除**，
                                该标签映射**保留**：库里已有 type=recharge 历史行，
                                删映射会让余额明细页出现裸 ref（节146 保留白名单）
"""
from __future__ import annotations

from app.models import AstrologyReading, Case, Divination, Job

# --------------------------------------------------------------------------- #
# 中文名映射表
# --------------------------------------------------------------------------- #
# 入账类流水 type → 中文
INCOME_TYPE_ZH = {
    "recharge": "充值",
    "manual": "手动赠送",
    "free": "注册赠送",
    "refund": "退款",
}

# 断前尘/预测逐法扣费 ref 内 method_key → 方法中文（与 paipan 切片/method 目录同名）
METHOD_ZH = {
    "bazi-pattern": "八字格局",
    "ziwei": "紫微",
    "qizheng": "七政",
    "qimen-lifetime": "奇门",
    "xizhan": "西占",
    "wuyun-liuqi": "五运六气",
    "bazi-dayun-liunian": "大运流年",
    "bazi-hunyin-caiyun": "婚姻财运",
    "bazi-shensha-nayin": "神煞纳音",
}

# jobs.type → 消耗项目前缀
JOB_TYPE_ZH = {
    "duan-qian-chen": "断前尘",
    "predict": "预测",
}

# divinations.method → 起卦解读中文（未列出者统一「起卦深度解读」；
# lenormand 雷诺曼走 divination interpret，ref 同样是 divination:{id}）
DIVINATION_METHOD_ZH = {
    "lenormand": "雷诺曼解读",
}


def parse_ref(ref) -> dict | None:
    """ref → 结构化 dict；None/空/无法识别 → None。

    返回的 kind ∈ job|revise|query|divination|divination_focus|tarot|astrology|
    agent|serial。
    """
    if not ref or not isinstance(ref, str):
        return None
    parts = ref.split(":")
    kind = parts[0]
    if kind == "job" and len(parts) in (2, 3) and parts[1].isdigit():
        method = parts[2] if len(parts) == 3 and parts[2] else None
        return {"kind": "job", "job_id": int(parts[1]), "method": method}
    if kind == "revise" and len(parts) == 2 and parts[1].isdigit():
        return {"kind": "revise", "case_id": int(parts[1])}
    if kind == "query" and len(parts) == 3 and parts[1].isdigit() and parts[2]:
        return {"kind": "query", "case_id": int(parts[1]), "method": parts[2]}
    if kind == "divination" and len(parts) == 2 and parts[1].isdigit():
        return {"kind": "divination", "divination_id": int(parts[1])}
    if kind == "divination_focus" and len(parts) == 3 and parts[1].isdigit() and parts[2]:
        return {"kind": "divination_focus", "divination_id": int(parts[1]), "focus": parts[2]}
    if kind == "tarot" and len(parts) == 2 and parts[1].isdigit():
        return {"kind": "tarot", "tarot_id": int(parts[1])}
    if kind == "astrology" and len(parts) == 2 and parts[1].isdigit():
        return {"kind": "astrology", "astrology_id": int(parts[1])}
    if kind == "agent" and len(parts) in (2, 3) and parts[1].isdigit():
        # agent:{user_id}（闲聊） / agent:{user_id}:{case_id}（选了默认档案）
        case_id = None
        if len(parts) == 3 and parts[2].isdigit():
            case_id = int(parts[2])
        return {"kind": "agent", "user_id": int(parts[1]), "case_id": case_id}
    if kind == "serial":
        return {"kind": "serial", "serial": ":".join(parts[1:])}
    return None


def _method_zh(method: str | None) -> str:
    """method_key → 方法中文；未收录保留原始 key（仍比裸 consume 可读）。"""
    if not method:
        return ""
    return METHOD_ZH.get(method, method)


def _enum_value(value):
    """SAEnum 成员（JobType）或普通字符串 → 字符串值。"""
    return getattr(value, "value", value)


def ref_label(ref, tx_type, *, job_type=None, divination_method=None) -> str:
    """ref + 流水 type → 中文标签（纯函数，不触库）。

    规则（REQ-063 §1）：
      - type ∈ recharge|manual|free|refund → 充值/手动赠送/注册赠送/退款；
      - job:{id}:{method} → 按查到的 jobs.type 输出「断前尘·{法}」/「预测·{法}」；
        查不到 job（job_type 未传）兜底「排盘分析」；
      - revise:{case_id} → 「追问」；
      - divination:{id} → divinations.method=lenormand 时「雷诺曼解读」，
        其余「起卦深度解读」（method 未传/记录缺失同样走「起卦深度解读」）；
      - divination_focus:{id}:{focus} → 「六爻焦点详解」（REQ-075，仅六爻）；
      - tarot:{id} → 「塔罗解读」；
      - astrology:{id} → 「星座本命解读」；
      - agent:{user_id}[:{case_id}] → 「太初先生对话」（REQ-076，选档案时 case_id
        可反查档案名，见 label_case_map）；
      - query:{case_id}:{method} → 「单法直问·{法}」（单法直问为 prediction 单法分析）；
      - type=consume 且 ref 无法识别 → 「消耗」。
    """
    if tx_type in INCOME_TYPE_ZH:
        return INCOME_TYPE_ZH[tx_type]
    parsed = parse_ref(ref)
    if parsed is None or tx_type != "consume":
        # consume 之外未知 type 保留原值；consume 但 ref 无法识别 → 消耗
        return "消耗" if tx_type == "consume" else str(tx_type or "消耗")

    kind = parsed["kind"]
    if kind == "job":
        prefix = JOB_TYPE_ZH.get(_enum_value(job_type)) if job_type else None
        if prefix is None:
            return "排盘分析"  # 查不到 job（或 type 未知）→ 兜底
        method = parsed.get("method")
        return prefix if not method else f"{prefix}·{_method_zh(method)}"
    if kind == "query":
        method = parsed.get("method")
        return f"单法直问·{_method_zh(method)}" if method else "单法直问"
    if kind == "revise":
        return "追问"
    if kind == "divination":
        return DIVINATION_METHOD_ZH.get(_enum_value(divination_method), "起卦深度解读")
    if kind == "divination_focus":
        return "六爻焦点详解"
    if kind == "tarot":
        return "塔罗解读"
    if kind == "astrology":
        return "星座本命解读"
    if kind == "agent":
        return "太初先生对话"
    if kind == "serial":
        return "充值"  # serial ref 只出现在 recharge 流水
    return "消耗"


# --------------------------------------------------------------------------- #
# 库增强层：批量反查 label / case_name
# --------------------------------------------------------------------------- #
def label_case_map(session, rows) -> dict[int, dict]:
    """rows（CreditTransaction 列表）→ {流水 id: {"label", "case_name"}}。

    档案名反查（REQ-063 §2）：
      - job:{id}:{m}  → jobs.case_id → cases.name（jobs 表记录消耗时的档案）；
      - revise/query  → ref 内 case_id → cases.name；
      - divination:{id} / divination_focus:{id}:{focus} → divinations.case_id（可空）
        → cases.name（REQ-075 六爻焦点详解同 divinations 反查）；
      - agent:{user_id}:{case_id} → ref 内 case_id → cases.name（REQ-076 太初先生
        对话；agent:{user_id} 无档案 → case_name 恒 None）；
      - astrology:{id} → astrology_readings.case_id（可空）→ cases.name；
      - tarot:{id}   → tarot_readings **无 case_id 列**，档案名恒 None；
      - 入账/未识别/关联档案缺失/档案未命名 → case_name=None。

    批量查询（每类实体一条 IN 查询 + 合并 case 一次查），不逐条打库。
    """
    parsed_by_tx: dict[int, dict | None] = {}
    job_ids, div_ids, astro_ids, direct_case_ids = set(), set(), set(), set()
    for t in rows:
        p = parse_ref(getattr(t, "ref", None))
        parsed_by_tx[t.id] = p
        if p is None:
            continue
        if p["kind"] == "job":
            job_ids.add(p["job_id"])
        elif p["kind"] in ("revise", "query"):
            direct_case_ids.add(p["case_id"])
        elif p["kind"] == "agent":
            if p.get("case_id") is not None:
                direct_case_ids.add(p["case_id"])
        elif p["kind"] in ("divination", "divination_focus"):
            div_ids.add(p["divination_id"])
        elif p["kind"] == "astrology":
            astro_ids.add(p["astrology_id"])

    jobs = (
        {j.id: j for j in session.query(Job).filter(Job.id.in_(job_ids))}
        if job_ids else {}
    )
    divs = (
        {d.id: d for d in session.query(Divination).filter(Divination.id.in_(div_ids))}
        if div_ids else {}
    )
    astros = (
        {a.id: a for a in session.query(AstrologyReading)
         .filter(AstrologyReading.id.in_(astro_ids))}
        if astro_ids else {}
    )

    # 合并需要反查档案名的 case_id，一次批量查 cases.name
    case_ids = set(direct_case_ids)
    case_ids.update(j.case_id for j in jobs.values() if j.case_id)
    case_ids.update(d.case_id for d in divs.values() if d.case_id)
    case_ids.update(a.case_id for a in astros.values() if a.case_id)
    cases = (
        {c.id: c.name for c in session.query(Case).filter(Case.id.in_(case_ids))}
        if case_ids else {}
    )

    result: dict[int, dict] = {}
    for t in rows:
        p = parsed_by_tx[t.id]
        job_type = None
        div_method = None
        case_id = None
        if p is not None:
            kind = p["kind"]
            if kind == "job":
                job = jobs.get(p["job_id"])
                if job is not None:
                    job_type = job.type          # JobType 成员/字符串
                    case_id = job.case_id
            elif kind in ("revise", "query"):
                case_id = p["case_id"]
            elif kind in ("divination", "divination_focus"):
                div = divs.get(p["divination_id"])
                if div is not None:
                    div_method = div.method
                    case_id = div.case_id
            elif kind == "agent":
                case_id = p.get("case_id")     # 选了默认档案 → 反查档案名；闲聊 None
            elif kind == "astrology":
                astro = astros.get(p["astrology_id"])
                if astro is not None:
                    case_id = astro.case_id
            # tarot: tarot_readings 无 case_id 列，无档案可反查
        label = ref_label(
            t.ref, t.type,
            job_type=job_type, divination_method=div_method,
        )
        case_name = cases.get(case_id) if case_id is not None else None
        result[t.id] = {"label": label, "case_name": case_name}
    return result
