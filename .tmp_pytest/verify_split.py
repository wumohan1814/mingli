#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""REQ-135 内容保真校验：原 divination.md 的每一行应能在 11 个新文件之一中找到
（允许的结构性调整另行报告）。"""
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(r"C:\Users\wumoh\Documents\Vibecoding\taichu\backend\prompts")
ORIG = Path(r"C:\Users\wumoh\Documents\Vibecoding\taichu\.tmp_pytest\divination_orig.md")

NEW_FILES = [
    "shared/divination-common.md",
    "interpret/divination-liuyao.md",
    "interpret/divination-meihua.md",
    "interpret/divination-xiaoliuren.md",
    "interpret/divination-ssgw.md",
    "interpret/divination-liuren.md",
    "interpret/divination-jinkoujue.md",
    "interpret/divination-qimen.md",
    "interpret/divination-almanac.md",
    "interpret/divination-taiyi.md",
    "interpret/divination-huangji.md",
]

def norm(s: str) -> str:
    return "".join(s.split())  # 去除所有空白后比对

def main():
    orig_raw = ORIG.read_text(encoding="utf-8-sig")  # 容忍 BOM
    orig_lines = orig_raw.splitlines()
    new_text = "\n".join(ROOT.joinpath(f).read_text(encoding="utf-8") for f in NEW_FILES)
    new_norm = norm(new_text)

    matched = 0
    unmatched = []
    for i, line in enumerate(orig_lines, 1):
        if not line.strip():
            continue
        if norm(line) in new_norm:
            matched += 1
        else:
            unmatched.append((i, line))

    print(f"原文有效行（非空）: {matched + len(unmatched)}")
    print(f"在新文件中逐字命中: {matched}")
    print(f"未命中（预期=结构性调整）: {len(unmatched)}")
    print("=" * 60)
    for i, line in unmatched:
        print(f"  [L{i}] {line}")

    # 反向：每个新文件应全部来自原文（除新增的 REQ-135 头注/结构性标题）
    print("=" * 60)
    print("新增文件行数：")
    for f in NEW_FILES:
        p = ROOT.joinpath(f)
        n = len(p.read_text(encoding="utf-8").splitlines())
        print(f"  {f}: {n} 行")

if __name__ == "__main__":
    main()
