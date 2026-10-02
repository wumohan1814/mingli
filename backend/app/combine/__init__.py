# -*- coding: utf-8 -*-
"""合参方法池（**单一事实源**）：命盘合参池 + 当下事合参池 + 中文 label。

本模块是全仓唯一允许定义「合参可选哪些法」的地方。任何新增/摘除方法
**只改这里**——端点、编排器、`GET /api/jobs/{id}`、测试都从这里取事实，
不许在别处再写一份 key 列表（重复记录 = 缺陷）。

两种合参模式（`jobs.combine_mode` 落库值）：

| mode | 名称 | 要不要生辰 | 流程 |
|---|---|---|---|
| `natal` | 命盘合参 | 要（走排盘） | 断前尘（逐法）→ 问卷校准 → 预测（沿用同一批法） |
| `moment` | 当下事合参 | 不要 | 逐法确定性起卦 → **只调 1 次 LLM** 出统一解读 |

label 规则（前端按此显示进度标题）：
`combine_label(n, "natal") == "九法合一"` / `combine_label(n, "moment") == "六法合参"`。
"""
from __future__ import annotations

import logging
from pathlib import Path

from app.credits.labels import METHOD_ZH
from app.synthesis.synthesizer import MOMENT_REPORT_TITLES, REPORT_TITLES

logger = logging.getLogger(__name__)

#: 合参提示词目录（backend/prompts/combine/；combine 位于 backend/app/，parents[2] = backend）
COMBINE_PROMPT_DIR = Path(__file__).resolve().parents[2] / "prompts" / "combine"

#: 合参模式（落 `jobs.combine_mode`）
COMBINE_MODE_NATAL = "natal"
COMBINE_MODE_MOMENT = "moment"
COMBINE_MODES = (COMBINE_MODE_NATAL, COMBINE_MODE_MOMENT)

# --------------------------------------------------------------------------- #
# 命盘合参池（要生辰，走断前尘 + 校准）
# --------------------------------------------------------------------------- #
#: 池的 key 顺序 = 前端勾选面板顺序 = 断前尘并发顺序（确定顺序，不许随意调）。
#: 第 9 法 xizhan（西占）：节139 曾把西占摘出「国学八法」综合流水线（`METHOD_KEYS`
#: 仍是那 8 个，语义不变）；这里作为**可选的合参第 9 法**重新放回——它的 analyzer
#: 与 prompt 一直都在，故只是「重新可选」，不是复活默认流水线。
NATAL_POOL_KEYS: tuple[str, ...] = (
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
    "ziwei",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
    "xizhan",
)

#: 命盘合参池（契约形状 `[{key, name}]`）。中文名与流水标签同源（`METHOD_ZH`），
#: 保证「勾选面板上的名字」与「余额明细里的名字」永远一致，不另建一张表。
NATAL_POOL: tuple[dict, ...] = tuple(
    {"key": k, "name": METHOD_ZH[k]} for k in NATAL_POOL_KEYS
)

# --------------------------------------------------------------------------- #
# 当下事合参池（不要生辰，不走断前尘）
# --------------------------------------------------------------------------- #
# 依据 `frontend/public/data/content/catalog.js` 里「`needCase:'none'` 且
# `answer:['问当下事']`」的条目推导，共 10 条；顺序同 catalog 出现顺序。
#
# ⚠️ key 以**后端真能起卦的入口**为准，不照抄 catalog 的 `params.method`：
#   - catalog 条目 `sign`（观音灵签）的 `params.method: 'sign'` 是**前端演出用 id**，
#     前端 `views-divination.js` 有 `DIVIN_API_METHOD = { sign: 'ssgw' }` 显式映射；
#     后端 /divination 只认 `ssgw`（`DIVINATION_METHODS` / Node server.mjs case 'ssgw'），
#     故池里记 **`ssgw`**——否则「以能真正起卦为准」这条会当场破。
#   - catalog 条目 `tarot` 没有 `params.method`（走独立页 `/api/tarot/draw`），
#     池里记 `tarot`，起卦走 tarot 转发（见 `app/api/combine.py`）。
#   - 其余 8 条 catalog `params.method` 与后端 key 完全一致，原样采用。
MOMENT_POOL: tuple[dict, ...] = (
    {"key": "ssgw", "name": "观音灵签"},
    {"key": "shengbei", "name": "潮汕圣杯"},
    {"key": "tarot", "name": "塔罗"},
    {"key": "liuyao", "name": "六爻"},
    {"key": "meihua", "name": "梅花易数"},
    {"key": "xiaoliuren", "name": "小六壬"},
    {"key": "lenormand", "name": "雷诺曼"},
    {"key": "liuren", "name": "大六壬"},
    {"key": "jinkoujue", "name": "金口诀"},
    {"key": "qimen", "name": "奇门时家"},
)

MOMENT_POOL_KEYS: tuple[str, ...] = tuple(m["key"] for m in MOMENT_POOL)

#: 两种模式的池（mode → `[{key, name}]`）
_POOLS: dict[str, tuple[dict, ...]] = {
    COMBINE_MODE_NATAL: NATAL_POOL,
    COMBINE_MODE_MOMENT: MOMENT_POOL,
}

#: 两种模式的报告骨架（mode → 板块标题顺序）。命盘合参沿用既有 8 板块（零变化），
#: 当下事合参是 5 板块新骨架（与 `synthesize()` 的 report_titles 参数同源）。
REPORT_TITLES_BY_MODE: dict[str, list[str]] = {
    COMBINE_MODE_NATAL: REPORT_TITLES,
    COMBINE_MODE_MOMENT: MOMENT_REPORT_TITLES,
}

# --------------------------------------------------------------------------- #
# 中文数字 / label
# --------------------------------------------------------------------------- #
#: 通用中文数字 1–10（label 只用得到 1–10；11 起显式报错，不许悄悄降级成阿拉伯数字）
_CN_NUM = ("零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十")

#: 模式 → label 后缀（命盘合参「N法合一」/ 当下事合参「N法合参」）
_LABEL_SUFFIX = {
    COMBINE_MODE_NATAL: "合一",
    COMBINE_MODE_MOMENT: "合参",
}


def cn_number(n: int) -> str:
    """1–10 → 中文数字（1→一 … 10→十）；超出范围抛 ValueError。"""
    if not isinstance(n, int) or isinstance(n, bool):
        raise ValueError(f"中文数字只接受整数，收到 {type(n).__name__}")
    if n < 1 or n > len(_CN_NUM) - 1:
        raise ValueError(f"中文数字只覆盖 1–10，收到 {n}")
    return _CN_NUM[n]


def combine_label(count: int, mode: str) -> str:
    """方法数 + 合参模式 → label（如 `9, "natal"` → 「九法合一」）。

    `count <= 0` 返回空串（job 还没定方法集时的诚实表达，不编一个「零法合一」）。
    """
    if not count or count <= 0:
        return ""
    return f"{cn_number(int(count))}法{_LABEL_SUFFIX[require_mode(mode)]}"


# --------------------------------------------------------------------------- #
# 取池 / 校验
# --------------------------------------------------------------------------- #
def require_mode(mode: str) -> str:
    """校验合参模式；非法值抛 ValueError（调用方转 400）。"""
    if mode not in _POOLS:
        raise ValueError(f"未知合参模式 {mode!r}；合法值：{'/'.join(COMBINE_MODES)}")
    return mode


def normalize_mode(mode) -> str:
    """落库/传参里的模式 → 合法模式；NULL / 未知值（合参上线前的老 job）按命盘合参兜底。

    与 `require_mode` 的分工：**读**老数据用本函数（要能容错），**收**新请求用
    `require_mode`（非法值必须当场拒）。
    """
    return mode if mode in _POOLS else COMBINE_MODE_NATAL


def pool(mode: str) -> tuple[dict, ...]:
    """该模式的池（`[{key, name}]`，顺序固定）。"""
    return _POOLS[require_mode(mode)]


def pool_keys(mode: str) -> tuple[str, ...]:
    """该模式的合法 key（顺序固定）。"""
    return tuple(m["key"] for m in pool(mode))


def method_name(key: str, mode: str = COMBINE_MODE_NATAL) -> str:
    """key → 中文名；不在该池则原样返回 key（流水/日志可读性兜底）。"""
    for m in pool(mode):
        if m["key"] == key:
            return m["name"]
    return key


def normalize_methods(methods, mode: str) -> list[str]:
    """请求里的方法集 → **规范顺序**的去重列表；非法 key / 空集抛 ValueError。

    规范顺序 = 池顺序（不是请求顺序）。有了它，「同一批法」的判定是纯集合判定，
    顺序不同不会骗过幂等指纹（见 `fingerprint`）。
    """
    require_mode(mode)
    if methods is None:
        return list(pool_keys(mode))
    if not isinstance(methods, (list, tuple)):
        raise ValueError("methods 必须是字符串数组")
    allowed = pool_keys(mode)
    picked: set[str] = set()
    for raw in methods:
        key = raw.strip() if isinstance(raw, str) else raw
        if not isinstance(key, str) or not key:
            raise ValueError("methods 只能包含非空字符串")
        if key not in allowed:
            raise ValueError(f"不支持的方法: {key}")
        picked.add(key)
    if not picked:
        raise ValueError("methods 不能为空数组（省略该字段 = 用全量池）")
    return [k for k in allowed if k in picked]


def fingerprint(methods) -> list[str]:
    """幂等指纹：方法集的规范化形式（可存 JSON、可直接比较）。

    `None`（老 job 没记录方法集）→ 返回 `None`，与任何集合都**不相等**：
    无法证明「旧 job 跑的就是这批法」时一律不复用，宁可贵一次也不给错结果。
    """
    if methods is None:
        return None
    return [str(k) for k in methods]


def same_method_set(a, b) -> bool:
    """两串方法集是否同一批（顺序无关、去重无关；任一侧为 None → False）。"""
    if a is None or b is None:
        return False
    return set(str(k) for k in a) == set(str(k) for k in b)


def report_titles_for(mode: str) -> list[str]:
    """该模式的报告骨架（返回副本，调用方改不污染全局）。"""
    return list(REPORT_TITLES_BY_MODE[require_mode(mode)])


#: `chart.meta.degraded_methods` 记的是**盘面字段名**，与合参方法 key 有一处不同名：
#: 西占盘面字段叫 `western`，方法 key 叫 `xizhan`（排盘引擎 `engine.py` 输出 `western`）。
#: 节139 把 xizhan 摘出流水线后没人受影响；合参把 xizhan 放回**可选池**后，这个不同名会
#: 让「盘面缺失（western=null）」的 xizhan 照跑（slice = {"western": None}，非空 dict
#: 骗过 analyze_method 的空盘检查）——故在取降级集合时显式对齐。
DEGRADED_KEY_ALIASES: dict[str, str] = {"western": "xizhan"}


def degraded_method_keys(keys) -> set[str]:
    """`chart.meta.degraded_methods` → 方法 key 集合（含不同名对齐）。"""
    return {DEGRADED_KEY_ALIASES.get(str(k), str(k)) for k in (keys or [])}


def load_combine_prompt(name: str) -> str:
    """读 `backend/prompts/combine/<name>.md`（natal / moment）全文。

    每次调用**读盘**（与 `methods.base.load_prompt` 同口径）：后台热改提示词即生效，
    不做进程内缓存。缺失或为空 → RuntimeError：提示词是本流程的必需件，缺了必须
    当场炸（fail loud），不许悄悄跑出一份没有合参纪律的解读。
    """
    path = COMBINE_PROMPT_DIR / f"{name}.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"合参提示词缺失或不可读: {path}") from exc
    if not text.strip():
        raise RuntimeError(f"合参提示词为空: {path}")
    return text


__all__ = [
    "COMBINE_MODE_NATAL",
    "COMBINE_MODE_MOMENT",
    "COMBINE_MODES",
    "NATAL_POOL",
    "NATAL_POOL_KEYS",
    "MOMENT_POOL",
    "MOMENT_POOL_KEYS",
    "REPORT_TITLES_BY_MODE",
    "cn_number",
    "combine_label",
    "require_mode",
    "normalize_mode",
    "pool",
    "pool_keys",
    "method_name",
    "normalize_methods",
    "fingerprint",
    "same_method_set",
    "report_titles_for",
    "degraded_method_keys",
    "load_combine_prompt",
]
