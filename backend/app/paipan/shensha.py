# -*- coding: utf-8 -*-
"""太初自研 — 命理神煞查表（lunar-python 不提供命理神煞，此处自实现）。

输出到 chart.json 的 bazi.shensha 字段，每项：
    {"name", "category", "pillars": ["年"|"月"|"日"|"时"], "target": "地支", "note": "起法"}
全部用标准四柱神煞起法（口诀见各函数），只做查表、不做吉凶判断。
"""

from __future__ import annotations

# 三合局：以「支」查该支所属三合局的对应神煞落支。
# 驿马 / 桃花 / 华盖 / 劫煞 / 亡神 均按三合局起。
_SANHE_GROUP = {
    "申": ["申", "子", "辰"], "子": ["申", "子", "辰"], "辰": ["申", "子", "辰"],
    "寅": ["寅", "午", "戌"], "午": ["寅", "午", "戌"], "戌": ["寅", "午", "戌"],
    "巳": ["巳", "酉", "丑"], "酉": ["巳", "酉", "丑"], "丑": ["巳", "酉", "丑"],
    "亥": ["亥", "卯", "未"], "卯": ["亥", "卯", "未"], "未": ["亥", "卯", "未"],
}

# 每个三合局的首支（用于按局查）
_SANHE_KEY = {"申子辰": "申", "寅午戌": "寅", "巳酉丑": "巳", "亥卯未": "亥"}
_SANHE_BY_BRANCH = {b: k for k, v in _SANHE_GROUP.items() for b in v[:1] if b == k}
for _branch, _members in (("申", ["申", "子", "辰"]), ("寅", ["寅", "午", "戌"]),
                          ("巳", ["巳", "酉", "丑"]), ("亥", ["亥", "卯", "未"])):
    for _m in _members:
        _SANHE_BY_BRANCH[_m] = _branch


def _sanhe_leader(branch: str) -> str:
    """返回某支所属三合局的首支（申/寅/巳/亥）。"""
    if branch in ("子", "辰"):
        return "申"
    if branch in ("午", "戌"):
        return "寅"
    if branch in ("酉", "丑"):
        return "巳"
    if branch in ("卯", "未"):
        return "亥"
    return branch


# 神煞落支（key = 三合局首支，value = 该神煞落支）
_YIMA = {"申": "寅", "寅": "申", "巳": "亥", "亥": "巳"}          # 驿马
_TAOHUA = {"申": "酉", "寅": "卯", "巳": "午", "亥": "子"}          # 桃花(咸池)
_HUAGAI = {"申": "辰", "寅": "戌", "巳": "丑", "亥": "未"}          # 华盖
_JIESHA = {"申": "巳", "寅": "亥", "巳": "寅", "亥": "申"}          # 劫煞
_WANGSHEN = {"申": "亥", "寅": "巳", "巳": "申", "亥": "寅"}        # 亡神
_JIANGXING = {"申": "子", "寅": "午", "巳": "酉", "亥": "卯"}       # 将星

# 天乙贵人（以日干或年干查；取两落支）
_TIANYI = {
    "甲": ["丑", "未"], "戊": ["丑", "未"], "庚": ["丑", "未"],
    "乙": ["子", "申"], "己": ["子", "申"],
    "丙": ["亥", "酉"], "丁": ["亥", "酉"],
    "壬": ["卯", "巳"], "癸": ["卯", "巳"],
    "辛": ["午", "寅"],
}

# 文昌（以日干查）
_WENCHANG = {"甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申",
             "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯"}

# 禄神（以日干查，临官）
_LUSHEN = {"甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳",
           "己": "午", "庚": "申", "辛": "酉", "壬": "亥", "癸": "子"}

# 羊刃（以日干查，阳干帝旺；阴干用其对宫禄前一位，简化为阳干口诀 + 阴干附）
_YANGREN = {"甲": "卯", "丙": "午", "戊": "午", "庚": "酉", "壬": "子",
            "乙": "寅", "丁": "巳", "己": "巳", "辛": "申", "癸": "亥"}

# 金舆（以日干查，禄前二位）
_JINYU = {"甲": "辰", "乙": "巳", "丙": "未", "丁": "申", "戊": "未",
          "己": "申", "庚": "戌", "辛": "亥", "壬": "丑", "癸": "寅"}

# 红鸾 / 天喜（以年支查）
_HONGLUAN = {"子": "卯", "丑": "寅", "寅": "丑", "卯": "子", "辰": "亥", "巳": "戌",
             "午": "酉", "未": "申", "申": "未", "酉": "午", "戌": "巳", "亥": "辰"}
_TIANXI = {"子": "酉", "丑": "申", "寅": "未", "卯": "午", "辰": "巳", "巳": "辰",
           "午": "卯", "未": "寅", "申": "丑", "酉": "子", "戌": "亥", "亥": "戌"}

# 孤辰 / 寡宿（以年支查，按三会方）
_GUCHEN = {"亥": "寅", "子": "寅", "丑": "寅", "寅": "巳", "卯": "巳", "辰": "巳",
           "巳": "申", "午": "申", "未": "申", "申": "亥", "酉": "亥", "戌": "亥"}
_GUASU = {"亥": "戌", "子": "戌", "丑": "戌", "寅": "丑", "卯": "丑", "辰": "丑",
          "巳": "辰", "午": "辰", "未": "辰", "申": "未", "酉": "未", "戌": "未"}

# 魁罡（以日柱干支查）
_KUIGANG = {"庚辰", "庚戌", "壬辰", "戊戌"}

# 天德（以月支查）
_TIANDE = {"寅": "丁", "卯": "申", "辰": "壬", "巳": "辛", "午": "亥", "未": "甲",
           "申": "癸", "酉": "寅", "戌": "丙", "亥": "乙", "子": "巳", "丑": "庚"}

# 月德（以月支三合局查，落天干）
_YUEDE = {"寅": "丙", "午": "丙", "戌": "丙", "申": "壬", "子": "壬", "辰": "壬",
          "亥": "甲", "卯": "甲", "未": "甲", "巳": "庚", "酉": "庚", "丑": "庚"}


def compute_shensha(pillars: dict) -> list:
    """pillars = {year:{gan,zhi}, month:{gan,zhi}, day:{gan,zhi}, hour:{gan,zhi}}。
    返回 bazi.shensha 列表。"""
    out = []
    year_zhi = pillars["year"]["zhi"]
    day_gan = pillars["day"]["gan"]
    year_gan = pillars["year"]["gan"]
    month_zhi = pillars["month"]["zhi"]
    day_zhi = pillars["day"]["zhi"]

    def add(name, category, hit_pillars, target, note):
        if hit_pillars:
            out.append({"name": name, "category": category,
                        "pillars": hit_pillars, "target": target, "note": note})

    # —— 按年支 / 日支（三合局类）——
    for ref_name, ref_zhi in (("年", year_zhi), ("日", day_zhi)):
        lead = _sanhe_leader(ref_zhi)
        for nm, cat, table, note_tpl in (
            ("驿马", "驿马", _YIMA, "{}子辰见寅，寅午戌见申，巳酉丑见亥，亥卯未见巳".format("申")),
            ("桃花", "桃花", _TAOHUA, "{}子辰见酉，寅午戌见卯，巳酉丑见午，亥卯未见子".format("申")),
            ("华盖", "华盖", _HUAGAI, "{}子辰见辰，寅午戌见戌，巳酉丑见丑，亥卯未见未".format("申")),
            ("劫煞", "劫煞", _JIESHA, "{}子辰见巳，寅午戌见亥，巳酉丑见寅，亥卯未见申".format("申")),
            ("亡神", "亡神", _WANGSHEN, "{}子辰见亥，寅午戌见巳，巳酉丑见申，亥卯未见寅".format("申")),
            ("将星", "将星", _JIANGXING, "{}子辰见子，寅午戌见午，巳酉丑见酉，亥卯未见卯".format("申")),
        ):
            target = table.get(lead)
            if target is None:
                continue
            hit = [p for p, v in pillars.items() if v["zhi"] == target]
            add(nm, cat, hit, target, note_tpl)

    # 天乙贵人（年干 + 日干）
    for gname, gan in (("年", year_gan), ("日", day_gan)):
        targets = _TIANYI.get(gan)
        if not targets:
            continue
        for t in targets:
            hit = [p for p, v in pillars.items() if v["zhi"] == t]
            add("天乙贵人", "贵人", hit, t, f"以{gname}干{gan}查，见{t}")

    # 文昌 / 禄神 / 羊刃 / 金舆（日干）
    for nm, table, cat in (("文昌", _WENCHANG, "文昌"), ("禄神", _LUSHEN, "禄"),
                           ("羊刃", _YANGREN, "羊刃"), ("金舆", _JINYU, "金舆")):
        t = table.get(day_gan)
        if t:
            hit = [p for p, v in pillars.items() if v["zhi"] == t]
            add(nm, cat, hit, t, f"以日干{day_gan}查，见{t}")

    # 红鸾 / 天喜（年支）
    for nm, table, cat in (("红鸾", _HONGLUAN, "婚恋"), ("天喜", _TIANXI, "婚恋")):
        t = table.get(year_zhi)
        if t:
            hit = [p for p, v in pillars.items() if v["zhi"] == t]
            add(nm, cat, hit, t, f"以年支{year_zhi}查，见{t}")

    # 孤辰 / 寡宿（年支）
    for nm, table, cat in (("孤辰", _GUCHEN, "孤寡"), ("寡宿", _GUASU, "孤寡")):
        t = table.get(year_zhi)
        if t:
            hit = [p for p, v in pillars.items() if v["zhi"] == t]
            add(nm, cat, hit, t, f"以年支{year_zhi}查，见{t}")

    # 魁罡（日柱）
    if pillars["day"]["gan"] + pillars["day"]["zhi"] in _KUIGANG:
        add("魁罡", "魁罡", ["日"], pillars["day"]["zhi"],
            f"日柱{day_gan}{day_zhi}入魁罡")

    # 天德 / 月德（月支，落天干）
    td = _TIANDE.get(month_zhi)
    if td:
        hit = [p for p, v in pillars.items() if v["gan"] == td]
        add("天德", "吉神", hit, td, f"以月支{month_zhi}查，见天干{td}")
    yd = _YUEDE.get(month_zhi)
    if yd:
        hit = [p for p, v in pillars.items() if v["gan"] == yd]
        add("月德", "吉神", hit, yd, f"以月支{month_zhi}查，见天干{yd}")

    return out
