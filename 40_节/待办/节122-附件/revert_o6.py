# -*- coding: utf-8 -*-
"""
回滚 O6 面中"非政治投票"的 9 题到原题（保留 171/35/175 的 Agent 改版）。
从 pre-revision-backup/ 读回原 text_en/text_zh（第一版翻译），并清除 revised 相关字段。
"""
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
# 文件 -> 需回滚的 item_no 集合（保留 171/35/175 不动）
REVERT = {
    "ipip-neo-300.json": {172, 173, 174, 176, 177, 178, 179, 180},
    "ipip-neo-60.json": {36},
}

REVISED_KEYS = ("revised", "revised_by", "revision_category", "revision_note", "original_text_en")

for fn, nos in REVERT.items():
    cur = json.load(open(os.path.join(BASE, fn), encoding="utf-8"))
    bak = json.load(open(os.path.join(BASE, "pre-revision-backup", fn), encoding="utf-8"))
    bak_map = {x["item_no"]: x for x in bak["items"]}
    for it in cur["items"]:
        if it["item_no"] in nos:
            src = bak_map[it["item_no"]]
            it["text_en"] = src["text_en"]
            it["text_zh"] = src["text_zh"]
            for k in REVISED_KEYS:
                it.pop(k, None)
    json.dump(cur, open(os.path.join(BASE, fn), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    kept = sum(1 for x in cur["items"] if x.get("revised"))
    print(f"{fn}: 回滚 {len(nos)} 题，剩余保留改版标记 = {kept}")

# 校验：300 应仅 171/175 保留改版；60 应仅 35 保留
for fn in ("ipip-neo-300.json", "ipip-neo-60.json"):
    items = json.load(open(os.path.join(BASE, fn), encoding="utf-8"))["items"]
    rev = [(x["item_no"], x["text_zh"]) for x in items if x.get("revised")]
    print(f"\n{fn} 仍标注改版的题：", rev)
