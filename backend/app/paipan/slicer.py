# -*- coding: utf-8 -*-
"""命理太初自研 — chart.json 片段裁剪（slice）。

按方法 key 从 chart dict 抽出每个方法模块只需要的那一小块盘面，返回
`{method_key: fragment}`。目的：**压上下文**——每个方法只喂它自己的切片，
不再把整个 chart 塞给方法模块。

切片与排盘同为**代码计算**：字段怎么切、切多切少都由本模块决定，
LLM 不手切、不脑补。对应源字段为 null 时，切片内相应字段写 null，
null ⇒ 该方法按降级规则不参与本轮。

key → 字段映射（= mingli SKILL.md §0 注册表）：
    bazi-pattern        → {"input": chart.input,
                            "bazi": {pillars, day_master, day_master_wuxing,
                                     ming_gong, shen_gong, tai_yuan,
                                     xun_kong, shensha}}
    bazi-dayun-liunian  → {"bazi": {qi_yun, da_yun}, "timeline_20y": ...}
    bazi-shensha-nayin  → {"bazi": {pillars(仅每柱 gan/zhi/nayin), shensha,
                                    xun_kong}}
    bazi-hunyin-caiyun  → {"input": ..., "bazi": chart.bazi(全量),
                            "timeline_20y": ...}
    ziwei               → {"ziwei": chart.ziwei}
    qizheng             → {"qizheng": chart.qizheng}
    qimen-lifetime      → {"qimen_lifetime": chart.qimen_lifetime}
    wuyun-liuqi         → {"wuyun_liuqi": chart.wuyun_liuqi}

节139：`xizhan` 切片已摘除（西占退出九法→八法综合流水线）。chart.json 仍由排盘
生成 `western` 字段（供档案详情「占星盘」tab 只读展示 + 西式占卜独立链路），
只是不再切片进 LLM。
"""

from __future__ import annotations

# 7 个命盘类方法（缺省切片集；顺序同 mingli SKILL.md §0 注册表）
DEFAULT_METHODS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "ziwei",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]

# 八字专题（阶段 4 路由需要时单独补切）
SPECIAL_METHODS = ["bazi-hunyin-caiyun"]

PILLAR_KEYS = ("year", "month", "day", "hour")
NAYIN_TRIM_KEYS = ("gan", "zhi", "nayin")


def _pick(source, keys):
    """从 dict 按 keys 取子对象；缺失的 key 写 null（保持结构稳定）。"""
    if not isinstance(source, dict):
        return None
    return {k: source.get(k) for k in keys}


def _trim_pillars(pillars):
    """bazi-shensha-nayin：每柱只保留 gan/zhi/nayin，丢掉其余字段。"""
    if not isinstance(pillars, dict):
        return None
    out = {}
    for key in PILLAR_KEYS:
        pillar = pillars.get(key)
        if isinstance(pillar, dict):
            out[key] = {k: pillar.get(k) for k in NAYIN_TRIM_KEYS}
        else:
            # 缺时辰 hour=null / 字段缺失：原样写 null
            out[key] = None
    return out


def _has_content(value) -> bool:
    """递归判断片段里是否还有任何非 null 内容（决定是否“片段为空”）。"""
    if value is None:
        return False
    if isinstance(value, dict):
        return any(_has_content(v) for v in value.values())
    if isinstance(value, list):
        return any(_has_content(v) for v in value)
    return True


def build_fragment(key: str, chart: dict):
    """按映射把 chart 切成该 key 的片段 dict。未知 key 返回 None。"""
    if key == "bazi-pattern":
        return {
            "input": chart.get("input"),
            "bazi": _pick(chart.get("bazi"), [
                "pillars", "day_master", "day_master_wuxing", "ming_gong",
                "shen_gong", "tai_yuan", "xun_kong", "shensha",
            ]),
        }
    if key == "bazi-dayun-liunian":
        return {
            "bazi": _pick(chart.get("bazi"), ["qi_yun", "da_yun"]),
            "timeline_20y": chart.get("timeline_20y"),
        }
    if key == "bazi-shensha-nayin":
        bazi = chart.get("bazi")
        frag_bazi = None
        if isinstance(bazi, dict):
            frag_bazi = {
                "pillars": _trim_pillars(bazi.get("pillars")),
                "shensha": bazi.get("shensha"),
                "xun_kong": bazi.get("xun_kong"),
            }
        return {"bazi": frag_bazi}
    if key == "bazi-hunyin-caiyun":
        return {
            "input": chart.get("input"),
            "bazi": chart.get("bazi"),
            "timeline_20y": chart.get("timeline_20y"),
        }
    if key == "ziwei":
        return {"ziwei": chart.get("ziwei")}
    if key == "qizheng":
        return {"qizheng": chart.get("qizheng")}
    if key == "qimen-lifetime":
        return {"qimen_lifetime": chart.get("qimen_lifetime")}
    if key == "wuyun-liuqi":
        return {"wuyun_liuqi": chart.get("wuyun_liuqi")}
    return None


def slice_chart(chart: dict, methods: list[str] | None = None) -> dict[str, dict]:
    """把 chart 切成 `{key: fragment}`。缺省产出 7 个命盘类片段；
    `methods` 可显式指定（含 bazi-hunyin-caiyun 等专题片段）。

    未知 key 抛 ValueError。"""
    if not isinstance(chart, dict):
        raise ValueError("chart 必须是 JSON 对象")

    keys = list(DEFAULT_METHODS if methods is None else methods)
    if not keys:
        raise ValueError("methods 为空")

    unknown = [m for m in keys if build_fragment(m, chart) is None]
    if unknown:
        raise ValueError(
            f"未知方法 key {unknown}；合法 key 含 {', '.join(DEFAULT_METHODS)}、"
            f"{', '.join(SPECIAL_METHODS)}"
        )

    return {key: build_fragment(key, chart) for key in keys}
