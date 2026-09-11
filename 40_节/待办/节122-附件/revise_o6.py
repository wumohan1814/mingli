# -*- coding: utf-8 -*-
"""
O6（价值观 / 自由主义）面中性化替换脚本
- 原 O6 面所有题项均涉政治/宗教/司法/纳税/爱国等敏感表述，同层面替换不可行
- 草拟同等测量功能（开放性-价值观：偏好新颖/非传统 vs 守旧/传统）的中性题替换
- 保留 keying 方向，text_zh 遵循第一人称、无句号、无"你"、≤14 字
- 标注 revised=True（Agent 改版），留存 original_text_en 供回溯
"""
import json, re, os

BASE = os.path.dirname(os.path.abspath(__file__))
FILES = ["ipip-neo-300.json", "ipip-neo-60.json", "ipip-50.json", "mini-ipip-20.json"]

# 原英文 -> (新英文草稿, 新中文草稿, 原类别)
REPLACE = {
    "Tend to vote for liberal political candidates.": (
        "Like to try new things.", "喜欢尝试新鲜事物", "政治(自由派)"),
    "Believe that there is no absolute right and wrong.": (
        "Open to different ways of thinking.", "乐于接纳不同的观念", "道德相对主义"),
    "Believe that criminals should receive help rather than punishment.": (
        "Believe people can change.", "相信人是可以改变的", "司法(宽恕)"),
    "Believe in one true religion.": (
        "Prefer what is familiar and safe.", "更偏爱熟悉稳妥的事物", "宗教"),
    "Tend to vote for conservative political candidates.": (
        "Stick with familiar old ways.", "习惯沿用老办法处事", "政治(保守派)"),
    "Believe that too much tax money goes to support artists.": (
        "Rarely chase after new trends.", "很少主动追逐新潮流", "纳税"),
    "Believe laws should be strictly enforced.": (
        "Like to have clear rules.", "做事喜欢有明确的规矩", "司法(执法)"),
    "Believe that we coddle criminals too much.": (
        "Dislike when rules are broken.", "看不惯打破常规的做法", "司法(宽容)"),
    "Believe that we should be tough on crime.": (
        "Uncomfortable with unconventional behavior.", "难以接受离经叛道之举", "司法(严惩)"),
    "Like to stand during the national anthem.": (
        "Enjoy following long-standing traditions.", "乐于遵循长久的传统", "爱国表达"),
}

NOTE = ("Agent 改版：原题涉政治/宗教/司法/纳税/爱国等敏感表述，O6 即「自由主义」面，"
        "同层面替换在 O6 内不可行；已草拟同等测量功能的「开放性-价值观（中性版）」题替换，"
        "keying 方向保持不变。原英文见 original_text_en。")

def zlen(s):
    for ch in "，。、！？；：""''（） ":
        s = s.replace(ch, "")
    return len(s)

changed = []
for fn in FILES:
    path = os.path.join(BASE, fn)
    d = json.load(open(path, encoding="utf-8"))
    for it in d["items"]:
        en = it["text_en"]
        if en in REPLACE:
            new_en, new_zh, cat = REPLACE[en]
            if it.get("revised"):
                continue  # 幂等：已改过则跳过
            it["original_text_en"] = en
            it["text_en"] = new_en
            it["text_zh"] = new_zh
            it["revised"] = True
            it["revised_by"] = "agent"
            it["revision_category"] = cat
            it["revision_note"] = NOTE
            changed.append((fn, it["item_no"], cat, en, new_zh))
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"共替换 {len(changed)} 题：")
for fn, no, cat, old, new in changed:
    print(f"  [{fn} #{no}] ({cat}) {old}  ->  {new}")

# 校验：自译规范
errs = []
for fn in FILES:
    d = json.load(open(os.path.join(BASE, fn), encoding="utf-8"))["items"]
    for it in d:
        if it.get("revised"):
            z = it["text_zh"]
            if z.endswith("。"): errs.append(f"[{fn}#{it['item_no']}] 句末句号: {z}")
            if "你" in z: errs.append(f"[{fn}#{it['item_no']}] 含你: {z}")
            if zlen(z) > 14: errs.append(f"[{fn}#{it['item_no']}] 超14字({zlen(z)}): {z}")
print("\n替换项校验错误:", len(errs))
for e in errs: print("  ", e)
print("OK" if not errs else "FAILED")
