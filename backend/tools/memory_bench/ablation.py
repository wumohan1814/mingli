# -*- coding: utf-8 -*-
"""节118 方向一 · **消融测量**：逐项归因 R1 / R2 / R3 各自贡献。

为什么需要它：`run.py` 只能测「改前 vs 改后」的总账，无法回答「增益是哪一项带来的」。
本脚本在同一进程、**同一份已播种的库**上，依次切换
`app.memory.service.RECALL_ENABLE_*` 开关跑多组配置，并与「全关（=旧行为）」做
**配对 McNemar 精确检验**。

为什么不重播种：`app.database` 在 import 期就绑定 Engine 的库路径，一个进程只能用一个库。
召回对数据的唯一副作用是 `access_count / last_recalled_at`，而**打分只用
importantce × freshness(updated_at)**，两者不参与排序 → 同一库重复测量是安全的
（脚本仍在每组配置前把它们重置，保持状态一致）。

用法：
    python tools/memory_bench/ablation.py
    python tools/memory_bench/ablation.py --repeat 2 --out results/ABLATION.md
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import bench_env

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "results" / "ABLATION.md"

# 配置表：(名称, 说明, {开关属性名: 值})
CONFIGS: list[tuple[str, str, dict]] = [
    ("R0_off", "全关（应精确复现基线旧行为）", {
        "RECALL_ENABLE_QUERY_TERMS": 0, "RECALL_ENABLE_SHORT_QUERY_LIKE": 0,
        "RECALL_HALVE_K_ON_FALLBACK": 1, "RECALL_ENABLE_TAGS_MATCH": 0}),
    ("R1_only", "只开 R1 词项 OR（k 减半保留）", {
        "RECALL_ENABLE_QUERY_TERMS": 1, "RECALL_ENABLE_SHORT_QUERY_LIKE": 0,
        "RECALL_HALVE_K_ON_FALLBACK": 1, "RECALL_ENABLE_TAGS_MATCH": 0}),
    ("R2_only", "只开 R2（LIKE 短问兜底 + 去掉 k 减半）", {
        "RECALL_ENABLE_QUERY_TERMS": 0, "RECALL_ENABLE_SHORT_QUERY_LIKE": 1,
        "RECALL_HALVE_K_ON_FALLBACK": 0, "RECALL_ENABLE_TAGS_MATCH": 0}),
    ("R3_only", "只开 R3 tags 加分（k 减半保留）", {
        "RECALL_ENABLE_QUERY_TERMS": 0, "RECALL_ENABLE_SHORT_QUERY_LIKE": 0,
        "RECALL_HALVE_K_ON_FALLBACK": 1, "RECALL_ENABLE_TAGS_MATCH": 1}),
    ("R1R2", "R1+R2（无 tags）", {
        "RECALL_ENABLE_QUERY_TERMS": 1, "RECALL_ENABLE_SHORT_QUERY_LIKE": 1,
        "RECALL_HALVE_K_ON_FALLBACK": 0, "RECALL_ENABLE_TAGS_MATCH": 0}),
    ("ALL", "R1+R2+R3（= 当前默认）", {
        "RECALL_ENABLE_QUERY_TERMS": 1, "RECALL_ENABLE_SHORT_QUERY_LIKE": 1,
        "RECALL_HALVE_K_ON_FALLBACK": 0, "RECALL_ENABLE_TAGS_MATCH": 1}),
]

SWITCH_NAMES = ("RECALL_ENABLE_QUERY_TERMS", "RECALL_ENABLE_SHORT_QUERY_LIKE",
                "RECALL_HALVE_K_ON_FALLBACK", "RECALL_ENABLE_TAGS_MATCH", "RECALL_PHRASE_FIRST",
                "RECALL_SHORT_QUERY_UNION")


def mcnemar_exact(b: int, c: int) -> float:
    """精确 McNemar：b=A命中B未命中，c=B命中A未命中。"""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / (2 ** n)
    return min(1.0, 2.0 * tail)


def _wilson(hits: int, n: int, z: float = 1.96):
    if n <= 0:
        return None, None
    p = hits / n
    denom = 1.0 + z * z / n
    center = p + z * z / (2 * n)
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return round((center - margin) / denom, 4), round((center + margin) / denom, 4)


def _mean_ci(values, z: float = 1.96):
    n = len(values)
    if n < 2:
        return None, None, False
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / (n - 1)
    se = math.sqrt(var / n)
    lo, hi = mean - z * se, mean + z * se
    return round(lo, 4), round(hi, 4), bool(lo > 0 or hi < 0)


def run_config(name, desc, switches, ctx, repeat: int) -> dict:
    msvc = ctx["msvc"]
    for attr in SWITCH_NAMES:
        setattr(msvc, attr, switches.get(attr, getattr(msvc, attr)))
    # 状态复位：保证每组配置起点一致（默认值见 DEFAULT 备份）
    for attr, val in ctx["defaults"].items():
        if attr not in switches:
            setattr(msvc, attr, val)
    ctx["reset_state"]()

    probe, corpus, stats, topics, db_to_corpus = (ctx["probe"], ctx["corpus"],
                                                 ctx["stats"], ctx["topics"],
                                                 ctx["db_to_corpus"])
    facts_per_user = {u["user_no"]: len(u["facts"]) for u in corpus["users"]}

    records, all_sql, all_ms = [], [], []
    for q in corpus["questions"]:
        user_id = stats["user_ids"][q["username"]]
        expected = {stats["fact_ids"][f] for f in q["expected_fact_ids"]
                    if f in stats["fact_ids"]}
        probe.reset()
        t0 = time.perf_counter()
        msvc.recall_memories(user_id, query=q["question"], k=None, mode="question")
        all_ms.append((time.perf_counter() - t0) * 1000.0)
        ids = list(probe.last_ids)
        ev = probe.last_event or {}
        all_sql.append(probe.sql_calls)
        hit = sorted(expected.intersection(ids))
        n_inj = len(ids)
        recalled_topics = [topics.get(db_to_corpus.get(i, ""), "?") for i in ids]
        from run import _random_floor
        records.append({
            "bucket": q["bucket"], "hit": bool(hit), "n_inj": n_inj,
            "channel": ev.get("channel"),
            "precision_strict": (len(hit) / n_inj) if n_inj else 0.0,
            "precision_topic": (sum(1 for t in recalled_topics if t == q["topic"]) / n_inj)
                               if n_inj else 0.0,
            "random_floor": _random_floor(facts_per_user[q["user_no"]], len(expected), n_inj),
            "ids": tuple(sorted(ids)),
        })

    n = len(records)
    hits = sum(1 for r in records if r["hit"])
    diffs = [(1.0 if r["hit"] else 0.0) - r["random_floor"] for r in records]
    lo, hi, sig = _mean_ci(diffs)
    ci_lo, ci_hi = _wilson(hits, n)
    with_inj = [r for r in records if r["n_inj"] > 0]
    buckets = {}
    for b in ("short", "medium", "long"):
        rows = [r for r in records if r["bucket"] == b]
        if rows:
            buckets[b] = {
                "n": len(rows),
                "hits": sum(1 for r in rows if r["hit"]),
                "recall": round(sum(1 for r in rows if r["hit"]) / len(rows), 4),
                "avg_inj": round(sum(r["n_inj"] for r in rows) / len(rows), 4),
                "channels": _channels(rows),
            }
    return {
        "name": name, "desc": desc, "switches": switches,
        "recall_at_k": round(hits / n, 4), "hits": hits, "n": n,
        "ci": [ci_lo, ci_hi],
        "random_floor": round(sum(r["random_floor"] for r in records) / n, 4),
        "lift": round(sum(diffs) / n, 4), "lift_ci": [lo, hi], "lift_sig": sig,
        "precision_strict": round(sum(r["precision_strict"] for r in with_inj) / len(with_inj), 4) if with_inj else None,
        "precision_topic": round(sum(r["precision_topic"] for r in with_inj) / len(with_inj), 4) if with_inj else None,
        "avg_injected": round(sum(r["n_inj"] for r in records) / n, 4),
        "empty": sum(1 for r in records if r["n_inj"] == 0),
        "channels": _channels(records),
        "sql_mean": round(sum(all_sql) / len(all_sql), 3),
        "lat_p50": round(_pct(all_ms, 0.50), 3),
        "lat_p95": round(_pct(all_ms, 0.95), 3),
        "hit_vector": [r["hit"] for r in records],
        "buckets": buckets,
    }


def _pct(values, q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    idx = q * (len(s) - 1)
    lo, hi = int(math.floor(idx)), int(math.ceil(idx))
    return s[lo] if lo == hi else s[lo] + (s[hi] - s[lo]) * (idx - lo)


def _channels(rows) -> dict:
    out: dict = {}
    for r in rows:
        k = str(r["channel"])
        out[k] = out.get(k, 0) + 1
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="ablation.py")
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--db-dir", default=None)
    ap.add_argument("--single", default=None,
                    help="只跑一个配置并输出单行 JSON（供**每配置独立进程**测量延迟，"
                         "避免同进程内顺序/WAL 累积造成的延迟混淆）")
    args = ap.parse_args(argv)

    paths = bench_env.prepare(args.db_dir, "ablation")
    try:
        import seed as seed_mod
        from sqlalchemy import text
        from app.database import AnalyticsSession
        from app.memory import service as msvc
        from run import Probe
        from app.database import analytics_engine

        schema = seed_mod.create_schema()
        corpus = seed_mod.load_corpus()
        stats = seed_mod.seed(corpus)

        topics = {f["id"]: f["topic"] for u in corpus["users"] for f in u["facts"]}
        db_to_corpus = {v: k for k, v in stats["fact_ids"].items()}

        defaults = {a: getattr(msvc, a) for a in SWITCH_NAMES}

        def reset_state():
            s = AnalyticsSession()
            try:
                s.execute(text("UPDATE agent_memories SET access_count=0, "
                               "last_recalled_at=NULL"))
                s.commit()
            finally:
                s.close()

        probe = Probe(msvc, analytics_engine)
        ctx = {"msvc": msvc, "probe": probe, "corpus": corpus, "stats": stats,
               "topics": topics, "db_to_corpus": db_to_corpus,
               "defaults": defaults, "reset_state": reset_state}

        selected = CONFIGS
        if args.single:
            selected = [c for c in CONFIGS if c[0] == args.single]
            if not selected:
                print("unknown config:", args.single, "| known:",
                      ", ".join(c[0] for c in CONFIGS))
                return 2
        results = [run_config(nm, dc, sw, ctx, args.repeat)
                   for nm, dc, sw in selected]
        probe.restore()
        for a, v in defaults.items():
            setattr(msvc, a, v)

        if args.single:
            r = results[0]
            print("SINGLE_RESULT " + json.dumps(
                {k: r[k] for k in ("name", "recall_at_k", "hits", "n", "lift",
                                   "lift_ci", "lift_sig", "precision_strict",
                                   "precision_topic", "avg_injected", "empty",
                                   "channels", "sql_mean", "lat_p50", "lat_p95")},
                ensure_ascii=False))
            return 0

        base = results[0]
        lines, A = [], None
        A = lines.append
        A("# 节118 方向一 · 消融测量（逐项归因）\n")
        A("> 由 `tools/memory_bench/ablation.py` 生成；同一份已播种库、逐组切换开关。")
        A("> 生成时间（UTC）：%s ｜ Python %s ｜ SQLite %s ｜ repeat=%d\n"
          % (datetime.now(timezone.utc).isoformat(timespec="seconds"),
             sys.version.split()[0], __import__("sqlite3").sqlite_version, args.repeat))
        A("语料指纹：`%s`（用户 %d / 事实 %d / 问题 %d）\n"
          % (corpus["meta"]["content_sha1"], corpus["meta"]["n_users"],
             corpus["meta"]["n_facts"], corpus["meta"]["n_questions"]))
        A("## 1. 总表\n")
        A("| 配置 | 说明 | Recall@k | hits | lift vs random | lift 95%CI | 显著 | 严格准确率 | 平均注入 | 空召回 | SQL/次 | p50 ms | p95 ms | 通道分布 |")
        A("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
        for r in results:
            A("| `%s` | %s | **%.4f** | %d/%d | %+.4f | [%s, %s] | %s | %s | %s | %d | %s | %s | %s | %s |"
              % (r["name"], r["desc"], r["recall_at_k"], r["hits"], r["n"], r["lift"],
                 r["lift_ci"][0], r["lift_ci"][1], "**是**" if r["lift_sig"] else "否",
                 r["precision_strict"], r["avg_injected"], r["empty"], r["sql_mean"],
                 r["lat_p50"], r["lat_p95"],
                 ", ".join("%s=%d" % kv for kv in sorted(r["channels"].items()))))
        A("")
        A("## 2. 与「全关（旧行为）」的**配对 McNemar 精确检验**\n")
        A("| 配置 | both | 仅旧命中 | 仅新命中 | 都不中 | McNemar p | 显著@95% | Recall 变化 |")
        A("|---|---|---|---|---|---|---|---|")
        for r in results[1:]:
            both = only_a = only_b = neither = 0
            for a, b in zip(base["hit_vector"], r["hit_vector"]):
                if a and b: both += 1
                elif a and not b: only_a += 1
                elif b and not a: only_b += 1
                else: neither += 1
            p = mcnemar_exact(only_a, only_b)
            A("| `%s` | %d | %d | %d | %d | %.6f | %s | %+.4f |"
              % (r["name"], both, only_a, only_b, neither, p,
                 "**是**" if p < 0.05 else "否", r["recall_at_k"] - base["recall_at_k"]))
        A("")
        A("## 3. 分档\n")
        A("| 配置 | short Recall | short 注入 | medium Recall | medium 注入 | long Recall | long 注入 |")
        A("|---|---|---|---|---|---|---|")
        for r in results:
            row = ["`%s`" % r["name"]]
            for b in ("short", "medium", "long"):
                d = r["buckets"].get(b) or {}
                row.append(str(d.get("recall")))
                row.append(str(d.get("avg_inj")))
            A("| " + " | ".join(row) + " |")
        A("")
        A("## 4. 各组开关取值（复现用）\n")
        A("| 配置 | " + " | ".join(SWITCH_NAMES) + " |")
        A("|---" * (len(SWITCH_NAMES) + 1) + "|")
        for r in results:
            row = ["`%s`" % r["name"]]
            for a in SWITCH_NAMES:
                row.append(str(r["switches"].get(a, defaults[a])))
            A("| " + " | ".join(row) + " |")

        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        out.with_suffix(".json").write_text(
            json.dumps({"configs": results, "schema": schema,
                        "corpus_meta": corpus["meta"]}, ensure_ascii=False, indent=1),
            encoding="utf-8")

        # 纯 ASCII 控制台
        print("=" * 78)
        print("%-10s %-8s %-8s %-20s %-5s %-9s %-9s %s" % ("config", "recall", "hits", "lift[CI]", "sig", "p50ms", "p95ms", "channels"))
        for r in results:
            print("%-10s %-8.4f %-8s %+.4f[%s,%s] %-5s %-9s %-9s %s"
                  % (r["name"], r["recall_at_k"], "%d/%d" % (r["hits"], r["n"]),
                     r["lift"], r["lift_ci"][0], r["lift_ci"][1],
                     "YES" if r["lift_sig"] else "no",
                     r["lat_p50"], r["lat_p95"], r["channels"]))
        print("=" * 78)
        print("markdown:", out)
        return 0
    finally:
        try:
            import seed as _s
            _s.dispose_engines()
        except Exception:
            pass
        removed, failed = bench_env.cleanup(paths)
        print("cleaned temp db files:", len(removed))
        if failed:
            print("!! NOT cleaned:", failed)


if __name__ == "__main__":
    raise SystemExit(main())
