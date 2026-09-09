#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台账快照生成器（派生只读产物，非第二事实源）
================================================
从 `docs/需求表.md` 与 `docs/Bug管理表.md` 抽取短字段，生成：
  1. docs/台账状态一览.md   —— 按状态/章节/严重度分组的编号清单 + 计数（人一眼看进度）
  2. docs/台账快照-需求表.csv —— 短字段快照（Excel 可开，按状态/模块筛选、审计用）
  3. docs/台账快照-Bug表.csv  —— 同上（Bug 表）

规则：
- 源表（md）仍是唯一事实源；本工具只读源、只写"生成文件"（带生成标记，勿手改生成文件）。
- 确定性解析：按行首 `| REQ-` / `| BUG-` 且按 `|` 切分（单元格内不含竖线）。
- 附带轻量一致性校验：重复编号 / 空状态 / 未知状态 → 写入一览 + 打印警告。
- 纯标准库，无外部依赖。用法：`python tools/gen_ledger_snapshot.py`
"""

from __future__ import annotations

import csv
import datetime
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQ_MD = ROOT / "docs" / "需求表.md"
BUG_MD = ROOT / "docs" / "Bug管理表.md"
OUT_SUMMARY = ROOT / "docs" / "台账状态一览.md"
OUT_REQ_CSV = ROOT / "docs" / "台账快照-需求表.csv"
OUT_BUG_CSV = ROOT / "docs" / "台账快照-Bug表.csv"

STATUS_NAME = {
    "🟡": "待办",
    "🔵": "开发中",
    "🟠": "待验收",
    "🟢": "已验收",
    "⚪": "归档",
}

REQ_SECTION_RE = re.compile(r"^## ([A-F])\.\s*(.+)")
REQ_ROW_RE = re.compile(r"^\|\s*REQ-\d+\s*\|")
BUG_ROW_RE = re.compile(r"^\|\s*BUG-\d+\s*\|")
REF_RE = re.compile(r"(REQ-\d+|BUG-\d+)")


def split_row(line: str) -> list[str]:
    """按 | 切分表格行；首尾空段剔除，保留 5+ 段。"""
    parts = line.strip().split("|")
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [p.strip() for p in parts]


def short_title(text: str, limit: int = 40) -> str:
    """取首段可读标题：按 冒号/破折号/逗号 截断，再限长。"""
    t = re.split(r"[：:——，,]", text, maxsplit=1)[0].strip()
    return t if len(t) <= limit else t[: limit - 1] + "…"


def refs_of(note: str) -> str:
    return " ".join(sorted(set(REF_RE.findall(note))))


def parse_reqs() -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    warnings: list[str] = []
    section = ""
    seen: set[str] = set()
    for line in REQ_MD.read_text(encoding="utf-8").splitlines():
        m = REQ_SECTION_RE.match(line.strip())
        if m:
            section = f"{m.group(1)}. {m.group(2)}"
            continue
        if not REQ_ROW_RE.match(line):
            continue
        f = split_row(line)
        if len(f) < 5:
            warnings.append(f"需求表：行结构异常（不足 5 列）→ {f[0] if f else line[:40]}")
            continue
        rid = f[0]
        if rid in seen:
            warnings.append(f"需求表：重复编号 {rid}")
        seen.add(rid)
        status = f[3]
        if not status:
            warnings.append(f"需求表：{rid} 状态为空")
        elif status not in STATUS_NAME:
            warnings.append(f"需求表：{rid} 未知状态符号 {status!r}")
        rows.append(
            {
                "id": rid,
                "section": section,
                "title": short_title(f[1]),
                "priority": f[2],
                "status": status,
                "note": " | ".join(f[4:]),
            }
        )
    return rows, warnings


def parse_bugs() -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    warnings: list[str] = []
    seen: set[str] = set()
    for line in BUG_MD.read_text(encoding="utf-8").splitlines():
        if not BUG_ROW_RE.match(line):
            continue
        f = split_row(line)
        if len(f) < 4:
            warnings.append(f"Bug表：行结构异常（不足 4 列）→ {f[0] if f else line[:40]}")
            continue
        bid = f[0]
        if bid in seen:
            warnings.append(f"Bug表：重复编号 {bid}")
        seen.add(bid)
        status = f[3]
        if not status:
            warnings.append(f"Bug表：{bid} 状态为空")
        elif status not in STATUS_NAME:
            warnings.append(f"Bug表：{bid} 未知状态符号 {status!r}")
        title = f[1]
        mod = ""
        if "·" in title:
            mod = title.split("·", 1)[0].strip()
        rows.append(
            {
                "id": bid,
                "module": mod,
                "title": short_title(title, 60),
                "severity": f[2],
                "status": status,
                "found": f[4] if len(f) > 4 else "",
                "fixed": f[5] if len(f) > 5 else "",
                "note": " | ".join(f[6:]),
            }
        )
    return rows, warnings


def group_counts(rows: list[dict], key: str) -> list[tuple[str, int, list[str]]]:
    buckets: dict[str, list[str]] = {}
    for r in rows:
        buckets.setdefault(r[key], []).append(r["id"])
    order = ["🟡", "🔵", "🟠", "🟢", "⚪"] if key == "status" else None
    items = [(k, len(v), v) for k, v in buckets.items()]
    if order:
        rank = {s: i for i, s in enumerate(order)}
        items.sort(key=lambda x: rank.get(x[0], 99))
    else:
        items.sort(key=lambda x: x[0])
    return items


def render_summary(reqs, bugs, warnings) -> str:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    L: list[str] = []
    L.append("# 台账状态一览（生成文件 · 勿手改）")
    L.append("")
    L.append(f"> 由 `tools/gen_ledger_snapshot.py` 自动生成（{now}）；源为 `docs/需求表.md` 与 `docs/Bug管理表.md`。")
    L.append("> 改源表后重跑一次即可刷新本文件与 CSV 快照。")
    L.append("")
    L.append("## 需求表（REQ）")
    L.append("")
    L.append(f"- 总数：{len(reqs)}")
    for st, cnt, ids in group_counts(reqs, "status"):
        L.append(f"- {STATUS_NAME.get(st, st)}：{cnt} 条 —— {'、'.join(ids)}")
    L.append("")
    L.append("### 按模块（章节）")
    for sec, cnt, ids in group_counts(reqs, "section"):
        L.append(f"- **{sec or '（未归章节）'}**：{cnt} 条")
    L.append("")
    L.append("## Bug 表（BUG）")
    L.append("")
    L.append(f"- 总数：{len(bugs)}")
    for st, cnt, ids in group_counts(bugs, "status"):
        L.append(f"- {STATUS_NAME.get(st, st)}：{cnt} 条 —— {'、'.join(ids)}")
    L.append("")
    L.append("### 按严重度")
    for sev, cnt, _ in group_counts(bugs, "severity"):
        L.append(f"- {sev}：{cnt} 条")
    L.append("")
    L.append("## 一致性警告")
    if warnings:
        for w in warnings:
            L.append(f"- {w}")
    else:
        L.append("- 无（编号唯一、状态均有合法符号）")
    L.append("")
    return "\n".join(L)


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    reqs, w1 = parse_reqs()
    bugs, w2 = parse_bugs()
    warnings = w1 + w2

    OUT_SUMMARY.write_text(render_summary(reqs, bugs, warnings), encoding="utf-8")

    write_csv(
        OUT_REQ_CSV,
        ["编号", "章节", "标题", "优先级", "状态", "关联"],
        [[r["id"], r["section"], r["title"], r["priority"], STATUS_NAME.get(r["status"], r["status"]), refs_of(r["note"])] for r in reqs],
    )
    write_csv(
        OUT_BUG_CSV,
        ["编号", "模块", "标题", "严重度", "状态", "发现", "修复", "关联"],
        [
            [r["id"], r["module"], r["title"], r["severity"], STATUS_NAME.get(r["status"], r["status"]), r["found"], r["fixed"], refs_of(r["note"])]
            for r in bugs
        ],
    )

    print(f"需求 REQ：{len(reqs)} 条；Bug：{len(bugs)} 条；警告 {len(warnings)} 条")
    for st, cnt, _ in group_counts(reqs, "status"):
        print(f"  REQ {st} {STATUS_NAME.get(st, st)}: {cnt}")
    for st, cnt, _ in group_counts(bugs, "status"):
        print(f"  BUG {st} {STATUS_NAME.get(st, st)}: {cnt}")
    for w in warnings:
        print("  ⚠", w)
    print("生成：")
    print(" ", OUT_SUMMARY)
    print(" ", OUT_REQ_CSV)
    print(" ", OUT_BUG_CSV)
    return 0


if __name__ == "__main__":
    sys.exit(main())
