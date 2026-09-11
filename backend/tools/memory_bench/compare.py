# -*- coding: utf-8 -*-
"""离线记忆基准 · 结果对比（"改前 vs 改后"）。

用法：
    python compare.py results/before.json results/after.json
    python run.py --compare results/before.json results/after.json   # 等价

口径：两份结果只要 `meta.git_rev` 或 `meta.corpus_meta.content_sha1` 不同，
会打印告警 —— 语料变了就不能直接比（数字不可比）。
输出为纯 ASCII，避免 Windows GBK 控制台中文乱码。
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

# (显示名, JSON 路径, 越大越好?)
SPEC: list[tuple[str, tuple[str, ...], bool]] = [
    ("Recall@k",            ("metrics", "recall_at_k"), True),
    ("random floor",        ("metrics", "random_floor_mean"), False),
    ("lift vs random",      ("metrics", "lift_vs_random"), True),
    ("precision strict",    ("metrics", "precision_strict_mean"), True),
    ("precision topic",     ("metrics", "precision_topic_mean"), True),
    ("empty recalls",       ("metrics", "empty_recall_count"), False),
    ("avg injected",        ("metrics", "avg_injected"), True),
    ("latency p50 ms",      ("metrics", "latency_ms_p50"), False),
    ("latency p95 ms",      ("metrics", "latency_ms_p95"), False),
    ("latency p99 ms",      ("metrics", "latency_ms_p99"), False),
    ("SQL per recall",      ("metrics", "sql_per_recall_mean"), False),
    ("peak mem MB",         ("memory", "tracemalloc_peak_mb"), False),
    ("Recall short",        ("buckets", "short", "recall_at_k"), True),
    ("Recall medium",       ("buckets", "medium", "recall_at_k"), True),
    ("Recall long",         ("buckets", "long", "recall_at_k"), True),
]


def _dig(data: dict, path: tuple[str, ...]):
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _mcnemar(a: dict, b: dict) -> dict | None:
    """配对显著性：同一批问题上 A/B 的命中翻转（McNemar 精确检验）。

    只比"命中与否"，天然排除语料难度差异 —— 这是判断改动是否真的有效的手段。
    """
    qa = {r["question_id"]: r for r in a.get("per_question", [])}
    qb = {r["question_id"]: r for r in b.get("per_question", [])}
    common = sorted(set(qa) & set(qb))
    if not common:
        return None
    both_hit = sum(1 for q in common if qa[q]["recall_hit"] and qb[q]["recall_hit"])
    a_only = sum(1 for q in common if qa[q]["recall_hit"] and not qb[q]["recall_hit"])
    b_only = sum(1 for q in common if not qa[q]["recall_hit"] and qb[q]["recall_hit"])
    neither = sum(1 for q in common if not qa[q]["recall_hit"] and not qb[q]["recall_hit"])

    n = a_only + b_only
    if n == 0:
        p = 1.0
    else:
        k = min(a_only, b_only)
        tail = sum(math.comb(n, i) for i in range(k + 1)) * (0.5 ** n)
        p = min(1.0, 2.0 * tail)

    buckets = {}
    for name in ("short", "medium", "long"):
        ids = [q for q in common if qa[q].get("bucket") == name]
        if not ids:
            continue
        ha = sum(1 for q in ids if qa[q]["recall_hit"])
        hb = sum(1 for q in ids if qb[q]["recall_hit"])
        buckets[name] = {"n": len(ids), "hits_A": ha, "hits_B": hb}

    return {"n_common": len(common), "both_hit": both_hit, "A_only": a_only,
            "B_only": b_only, "neither": neither, "mcnemar_p": round(p, 6),
            "significant_95": p < 0.05, "buckets": buckets}


def compare_files(path_a: str, path_b: str) -> int:
    a, b = load(path_a), load(path_b)
    ma, mb = a.get("meta", {}), b.get("meta", {})

    print("=" * 74)
    print("A: %-28s label=%-10s rev=%s" % (path_a, ma.get("label"), ma.get("git_rev")))
    print("B: %-28s label=%-10s rev=%s" % (path_b, mb.get("label"), mb.get("git_rev")))

    warn = []
    if ma.get("git_rev") != mb.get("git_rev"):
        warn.append("git_rev 不同（%s -> %s）：这是代码改动，符合预期"
                    % (ma.get("git_rev"), mb.get("git_rev")))
    ca = (ma.get("corpus_meta") or {}).get("content_sha1")
    cb = (mb.get("corpus_meta") or {}).get("content_sha1")
    if ca != cb:
        warn.append("!! 语料指纹不同（%s -> %s）：数字不可直接比较，请先固定语料" % (ca, cb))
    if (ma.get("corpus_meta") or {}).get("n_questions") != \
       (mb.get("corpus_meta") or {}).get("n_questions"):
        warn.append("!! 问题数不同：数字不可直接比较")
    print("-" * 74)
    print("%-20s %14s %14s %14s  %s" % ("metric", "A", "B", "delta", "verdict"))
    for name, path, higher_better in SPEC:
        va, vb = _dig(a, path), _dig(b, path)
        if va is None and vb is None:
            continue
        try:
            delta = (vb or 0) - (va or 0)
        except TypeError:
            continue
        if abs(delta) < 1e-9:
            verdict = "="
        else:
            improved = (delta > 0) if higher_better else (delta < 0)
            verdict = "better" if improved else "worse"
        print("%-20s %14s %14s %+14.4f  %s"
              % (name,
                 "n/a" if va is None else ("%.4f" % va),
                 "n/a" if vb is None else ("%.4f" % vb),
                 delta, verdict))

    print("-" * 74)
    print("channels A: %s" % a.get("channels"))
    print("channels B: %s" % b.get("channels"))

    mc = _mcnemar(a, b)
    if mc:
        print("-" * 74)
        print("paired McNemar (exact) on %d common questions:" % mc["n_common"])
        print("  both hit=%d  A only=%d  B only=%d  neither=%d"
              % (mc["both_hit"], mc["A_only"], mc["B_only"], mc["neither"]))
        print("  p=%.6f  significant@95%%=%s"
              % (mc["mcnemar_p"], "YES" if mc["significant_95"] else "NO"))
        for name, d in sorted(mc["buckets"].items()):
            print("  %-7s n=%-3d hits A=%d B=%d (delta %+d)"
                  % (name, d["n"], d["hits_A"], d["hits_B"],
                     d["hits_B"] - d["hits_A"]))

    for line in warn:
        print("note:", line)
    print("=" * 74)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="对比两份离线记忆基准结果")
    ap.add_argument("a", help="基线结果 JSON")
    ap.add_argument("b", help="对照结果 JSON")
    args = ap.parse_args(argv)
    return compare_files(args.a, args.b)


if __name__ == "__main__":
    raise SystemExit(main())
