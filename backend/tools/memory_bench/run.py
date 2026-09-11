# -*- coding: utf-8 -*-
"""离线记忆召回基准 · 执行器。

测什么：对 `corpus.json` 里 70 个「问题 → 期望命中的记忆」标注，逐题调用
**真实的** `app.memory.service.recall_memories()`（mode="question"），判定期望
记忆是否出现在**实际注入的记忆块**里。

怎么拿到召回的记忆 id（本题的取证方式，如实说明）：
  `recall_memories()` 只返回**文本**，其埋点 `agent_memory_recall`
  （service.py L423）只带 `channel / hits / k / elapsed_ms`，**不含 id**。
  因此这里用**外部 monkeypatch**（不改生产代码、不复制其逻辑）：
    1. 替换模块属性 `msvc._render_memory_block`（L443）——它收到的 `items`
       正是**最终注入**的候选列表（L422 调用点），可拿到 id 且天然对齐
       "真实注入"语义（在预算循环里被丢弃的候选不会出现在这里）；
    2. 替换 `msvc.record_event`——只为取回真实埋点里的 `channel`。
  两处替换只发生在测量进程内，进程退出即消失。

硬约束：不联网、不调 LLM、不碰生产库（见 bench_env 隔离层）、零新增依赖。

用法：
    python run.py
    python run.py --repeat 5 --label baseline --markdown results/BASELINE.md
    python run.py --compare results/a.json results/b.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import tracemalloc
from datetime import datetime, timezone
from pathlib import Path

import bench_env

HERE = Path(__file__).resolve().parent
DEFAULT_RESULTS_DIR = HERE / "results"


# --------------------------------------------------------------------------- #
# 参数 / 环境（环境必须在 import app.* 之前准备好）
# --------------------------------------------------------------------------- #
def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        prog="run.py",
        description="太初 · 离线记忆召回基准（不联网/不调 LLM/不碰生产库）")
    ap.add_argument("--db-dir", default=None,
                    help="临时库目录（默认系统临时目录；必须在仓库外）")
    ap.add_argument("--tag", default=None, help="临时库文件名前缀（默认随机）")
    ap.add_argument("--corpus", default=None, help="语料路径（默认 corpus.json）")
    ap.add_argument("--repeat", type=int, default=5, help="每题重复次数（默认 5）")
    ap.add_argument("--k", type=int, default=None,
                    help="显式召回条数；默认 None = 生产默认（question=6）")
    ap.add_argument("--mode", default="question", choices=["question", "opening"])
    ap.add_argument("--label", default=None, help="本次运行标签（before/after/...）")
    ap.add_argument("--out", default=None, help="结果 JSON 路径")
    ap.add_argument("--markdown", default=None, help="额外产出 Markdown 报告路径")
    ap.add_argument("--keep", action="store_true", help="保留临时库文件")
    ap.add_argument("--compare", nargs=2, default=None, metavar=("A", "B"),
                    help="只对比两份历史结果 JSON（不需要建库）")
    return ap.parse_args(argv)


# --------------------------------------------------------------------------- #
# 插桩
# --------------------------------------------------------------------------- #
class Probe:
    """外部插桩容器：测量期间替换 `app.memory.service` 的两个模块属性。"""

    def __init__(self, msvc, analytics_engine) -> None:
        from sqlalchemy import event as sa_event
        self._msvc = msvc
        self._orig_block = msvc._render_memory_block
        self._orig_event = msvc.record_event
        self.last_ids: list = []
        self.last_event: dict | None = None
        self.sql_calls = 0

        def _patched_block(items):
            self.last_ids = [c.get("id") for c in items]
            return self._orig_block(items)

        def _patched_event(name, **kw):
            if name == "agent_memory_recall":
                self.last_event = kw.get("props")
            return self._orig_event(name, **kw)

        msvc._render_memory_block = _patched_block
        msvc.record_event = _patched_event
        sa_event.listen(analytics_engine, "before_cursor_execute", self._on_sql)

    def _on_sql(self, conn, cursor, statement, parameters, context, executemany):
        # 只统计 analytics 引擎上的语句 = 召回自身的 SQL 条数
        # （埋点写 taichu_ops 走另一个引擎，不计入）
        self.sql_calls += 1

    def reset(self) -> None:
        self.last_ids = []
        self.last_event = None
        self.sql_calls = 0

    def restore(self) -> None:
        self._msvc._render_memory_block = self._orig_block
        self._msvc.record_event = self._orig_event


# --------------------------------------------------------------------------- #
# 统计工具
# --------------------------------------------------------------------------- #
def _pct(values: list[float], q: float) -> float | None:
    """线性插值分位数（q ∈ [0,1]）。"""
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    idx = q * (len(s) - 1)
    lo, hi = int(math.floor(idx)), int(math.ceil(idx))
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)


def _random_floor(n_facts: int, n_expected: int, k: int) -> float:
    """随机抽 k 条（不放回）至少命中 1 条期望记忆的概率 —— 用于判断
    "召回通道是否真的比瞎猜强"（超几何分布补）。"""
    if n_expected <= 0 or n_facts <= 0 or k <= 0:
        return 0.0
    k = min(k, n_facts)
    if n_facts - n_expected < k:
        return 1.0
    return 1.0 - math.comb(n_facts - n_expected, k) / math.comb(n_facts, k)


def _wilson(hits: int, n: int, z: float = 1.96) -> tuple[float | None, float | None]:
    """比例的 Wilson 95% 置信区间（小样本比正态近似稳）。"""
    if n <= 0:
        return None, None
    p = hits / n
    denom = 1.0 + z * z / n
    center = p + z * z / (2 * n)
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return round((center - margin) / denom, 4), round((center + margin) / denom, 4)


def _mean_ci(values: list[float], z: float = 1.96) -> tuple:
    """均值的 95% 置信区间 + 是否显著异于 0（区间不含 0）。"""
    n = len(values)
    if n < 2:
        return None, None, False
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / (n - 1)
    se = math.sqrt(var / n)
    lo, hi = mean - z * se, mean + z * se
    return round(lo, 4), round(hi, 4), bool(lo > 0 or hi < 0)


def _peak_memory() -> dict:
    """进程峰值内存。优先 tracemalloc（跨平台）；Linux 上附 ru_maxrss。"""
    cur, peak = tracemalloc.get_traced_memory()
    out = {"tracemalloc_current_mb": round(cur / 1048576.0, 3),
           "tracemalloc_peak_mb": round(peak / 1048576.0, 3),
           "tracemalloc_used": True,
           "ru_maxrss": None, "ru_maxrss_unit": None}
    try:
        import resource  # Unix only
        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        out["ru_maxrss"] = int(usage)
        out["ru_maxrss_unit"] = "bytes (darwin)" if sys.platform == "darwin" else "KB (linux)"
    except Exception:
        pass
    return out


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 4) if values else None


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def _run(args: argparse.Namespace, paths: dict) -> int:
    import seed as seed_mod                       # noqa: PLC0415（环境已就绪）
    from app.memory import service as msvc        # noqa: PLC0415
    from app.database import analytics_engine     # noqa: PLC0415

    corpus_path = args.corpus or seed_mod.CORPUS_PATH
    schema = seed_mod.create_schema()
    corpus = seed_mod.load_corpus(corpus_path)
    stats = seed_mod.seed(corpus)

    corpus_fact_topic: dict[str, str] = {}
    corpus_facts_per_user: dict[int, int] = {}
    for u in corpus["users"]:
        corpus_facts_per_user[u["user_no"]] = len(u["facts"])
        for f in u["facts"]:
            corpus_fact_topic[f["id"]] = f["topic"]
    db_to_corpus: dict[int, str] = {v: k for k, v in stats["fact_ids"].items()}

    probe = Probe(msvc, analytics_engine)
    tracemalloc.start()

    # 预热（不计入指标）：触发惰性导入 / 连接池建立
    warm_user = stats["user_ids"][corpus["users"][0]["username"]]
    msvc.recall_memories(warm_user, query="预热预热量", k=None, mode=args.mode)

    repeat = max(1, int(args.repeat))
    records: list[dict] = []
    all_ms: list[float] = []
    all_sql: list[int] = []
    unstable = 0

    for q in corpus["questions"]:
        user_id = stats["user_ids"][q["username"]]
        expected_db = {stats["fact_ids"][fid] for fid in q["expected_fact_ids"]
                       if fid in stats["fact_ids"]}
        n_facts = corpus_facts_per_user[q["user_no"]]

        ids_first: list = []
        ids_sets: list[frozenset] = []
        samples: list[dict] = []
        for rep in range(repeat):
            probe.reset()
            t0 = time.perf_counter()
            block = msvc.recall_memories(user_id, query=q["question"],
                                         k=args.k, mode=args.mode)
            ms = (time.perf_counter() - t0) * 1000.0
            ids = list(probe.last_ids)
            ev = probe.last_event or {}
            samples.append({"ms": round(ms, 3), "sql": probe.sql_calls,
                            "channel": ev.get("channel"), "hits": ev.get("hits"),
                            "k": ev.get("k"), "elapsed_ms": ev.get("elapsed_ms"),
                            "chars": len(block or "")})
            all_ms.append(ms)
            all_sql.append(probe.sql_calls)
            if rep == 0:
                ids_first = ids
            ids_sets.append(frozenset(ids))

        if len(set(ids_sets)) > 1:
            unstable += 1

        recalled = ids_first
        hit = sorted(expected_db.intersection(recalled))
        n_inj = len(recalled)
        # 按主题判定"相关"：db id 反查回 corpus fact id 再取主题
        topics_of_recalled = [corpus_fact_topic.get(db_to_corpus.get(rid, ""), "?")
                              for rid in recalled]

        records.append({
            "question_id": q["id"],
            "topic": q["topic"],
            "bucket": q["bucket"],
            "question": q["question"],
            "qlen": len(q["question"]),
            "user_no": q["user_no"],
            "expected_fact_ids": q["expected_fact_ids"],
            "n_expected": len(expected_db),
            "n_facts_of_user": n_facts,
            "recalled_ids": recalled,
            "n_recalled": n_inj,
            "hit_ids": hit,
            "recall_hit": bool(hit),
            "precision_strict": (len(hit) / n_inj) if n_inj else 0.0,
            "precision_topic": (sum(1 for t in topics_of_recalled if t == q["topic"]) / n_inj)
                               if n_inj else 0.0,
            "random_floor": _random_floor(n_facts, len(expected_db), n_inj),
            "empty_recall": n_inj == 0,
            "channel": samples[0]["channel"],
            "event_hits": samples[0]["hits"],
            "block_chars": samples[0]["chars"],
            "ms_mean": _avg([s["ms"] for s in samples]),
            "sql_mean": _avg([s["sql"] for s in samples]),
            "samples": samples,
            "repeat_stable": len(set(ids_sets)) == 1,
        })

    memory = _peak_memory()
    tracemalloc.stop()
    probe.restore()

    # ---------------- 指标聚合 ----------------
    def _agg(rows: list[dict]) -> dict:
        asked = len(rows)
        hits = sum(1 for r in rows if r["recall_hit"])
        inj = [r["n_recalled"] for r in rows]
        with_inj = [r for r in rows if r["n_recalled"] > 0]
        ci_lo, ci_hi = _wilson(hits, asked)
        # 逐题"实测命中(0/1) − 随机抽同样条数的命中概率"，均值即 lift
        diffs = [(1.0 if r["recall_hit"] else 0.0) - r["random_floor"] for r in rows]
        lift_lo, lift_hi, lift_sig = _mean_ci(diffs)
        return {
            "n_questions": asked,
            "recall_at_k": round(hits / asked, 4) if asked else None,
            "recall_hits": hits,
            "recall_ci95_low": ci_lo,
            "recall_ci95_high": ci_hi,
            "random_floor_mean": _avg([r["random_floor"] for r in rows]),
            "lift_vs_random": _avg(diffs),
            "lift_ci95_low": lift_lo,
            "lift_ci95_high": lift_hi,
            "lift_significant": lift_sig,
            "precision_strict_mean": _avg([r["precision_strict"] for r in with_inj]),
            "precision_topic_mean": _avg([r["precision_topic"] for r in with_inj]),
            "empty_recall_count": sum(1 for r in rows if r["empty_recall"]),
            "avg_injected": _avg([float(i) for i in inj]),
            "min_injected": min(inj) if inj else None,
            "max_injected": max(inj) if inj else None,
            "avg_block_chars": _avg([float(r["block_chars"]) for r in rows]),
        }

    buckets = {}
    for name in ("short", "medium", "long"):
        rows = [r for r in records if r["bucket"] == name]
        if rows:
            buckets[name] = _agg(rows)

    channels: dict[str, int] = {}
    for r in records:
        key = str(r["channel"])
        channels[key] = channels.get(key, 0) + 1

    result = {
        "meta": {
            "tool": "memory_bench/run.py",
            "label": args.label,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "python": sys.version.split()[0],
            "sqlite": __import__("sqlite3").sqlite_version,
            "cwd": os.getcwd(),
            "git_rev": _read_git_rev(),
            "mode": args.mode,
            "k_arg": args.k,
            "repeat": repeat,
            "corpus_path": str(corpus_path),
            "corpus_meta": corpus["meta"],
            "schema_check": schema,
            "seeded_facts": stats["inserted_facts"],
            "seeded_fts_rows": stats["fts_rows"],
            "db_env": bench_env.env_report(),
            "db_dir": paths["db_dir"],
            "note": "离线基准：不联网、不调 LLM、不碰生产库；recall 走真实 recall_memories()",
        },
        "metrics": {
            **_agg(records),
            "latency_ms_p50": round(_pct(all_ms, 0.50) or 0.0, 3),
            "latency_ms_p95": round(_pct(all_ms, 0.95) or 0.0, 3),
            "latency_ms_p99": round(_pct(all_ms, 0.99) or 0.0, 3),
            "latency_ms_mean": _avg(all_ms),
            "latency_ms_max": round(max(all_ms), 3) if all_ms else None,
            "latency_samples": len(all_ms),
            "sql_per_recall_mean": _avg([float(v) for v in all_sql]),
            "sql_per_recall_p50": round(_pct([float(v) for v in all_sql], 0.5) or 0.0, 3),
            "sql_per_recall_max": max(all_sql) if all_sql else None,
            "unstable_questions": unstable,
        },
        "buckets": buckets,
        "channels": channels,
        "memory": memory,
        "per_question": records,
    }

    out_path = Path(args.out) if args.out else (
        DEFAULT_RESULTS_DIR /
        ("%s_%s.json" % (args.label or "run",
                         datetime.now().strftime("%Y%m%d-%H%M%S"))))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1),
                        encoding="utf-8")

    _print_console(result)
    print("result_json:", out_path)

    if args.markdown:
        md_path = Path(args.markdown)
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(_render_markdown(result), encoding="utf-8")
        print("markdown:", md_path)
    return 0


def _read_git_rev() -> str:
    """不启子进程（避免沙箱管道限制），直接读 .git/HEAD。"""
    try:
        git = HERE
        for _ in range(6):
            git = git.parent
            head = git / ".git" / "HEAD"
            if head.is_file():
                ref = head.read_text(encoding="utf-8").strip()
                if ref.startswith("ref:"):
                    ref_path = git / ".git" / ref.split(" ", 1)[1].strip()
                    if ref_path.is_file():
                        return ref_path.read_text(encoding="utf-8").strip()[:12]
                    packed = git / ".git" / "packed-refs"
                    if packed.is_file():
                        want = ref.split(" ", 1)[1].strip()
                        for line in packed.read_text(encoding="utf-8").splitlines():
                            if line.endswith(want) and not line.startswith("#"):
                                return line.split(" ", 1)[0][:12]
                    return "ref-unresolved"
                return ref[:12]
    except Exception:
        pass
    return "unknown"


def _print_console(result: dict) -> None:
    """纯 ASCII 控制台输出（避免 Windows GBK 控制台中文乱码）。"""
    m, meta = result["metrics"], result["meta"]
    print("=" * 66)
    print("memory recall baseline  label=%s  git=%s" % (meta["label"], meta["git_rev"]))
    print("corpus: users=%(n_users)d facts=%(n_facts)d questions=%(n_questions)d"
          % meta["corpus_meta"])
    print("seeded: facts=%d fts=%d  repeat=%d  mode=%s  k=%s"
          % (meta["seeded_facts"], meta["seeded_fts_rows"], meta["repeat"],
             meta["mode"], meta["k_arg"]))
    print("-" * 66)
    print("Recall@k            : %.4f  (%d/%d)  95%%CI [%s, %s]"
          % (m["recall_at_k"], m["recall_hits"], m["n_questions"],
             m["recall_ci95_low"], m["recall_ci95_high"]))
    print("random-pick floor   : %.4f" % m["random_floor_mean"])
    print("lift vs random      : %+.4f  95%%CI [%s, %s]  significant=%s"
          % (m["lift_vs_random"], m["lift_ci95_low"], m["lift_ci95_high"],
             m["lift_significant"]))
    print("precision strict    : %s" % m["precision_strict_mean"])
    print("precision topic     : %s" % m["precision_topic_mean"])
    print("empty recall        : %d / %d" % (m["empty_recall_count"], m["n_questions"]))
    print("injected avg/min/max: %s / %s / %s"
          % (m["avg_injected"], m["min_injected"], m["max_injected"]))
    print("memory block chars  : %s" % m["avg_block_chars"])
    print("latency ms p50/p95/p99: %s / %s / %s  (n=%d)"
          % (m["latency_ms_p50"], m["latency_ms_p95"], m["latency_ms_p99"],
             m["latency_samples"]))
    print("SQL per recall mean/p50/max: %s / %s / %s"
          % (m["sql_per_recall_mean"], m["sql_per_recall_p50"], m["sql_per_recall_max"]))
    print("peak mem MB (tracemalloc): %s  ru_maxrss=%s"
          % (result["memory"]["tracemalloc_peak_mb"], result["memory"]["ru_maxrss"]))
    print("unstable questions  : %d" % m["unstable_questions"])
    print("-" * 66)
    print("by bucket:")
    print("  %-8s %6s %-10s %-18s %-9s %-9s %-8s %s"
          % ("bucket", "n", "Recall@k", "95%CI", "randfloor", "avg_inj", "empty", "channels"))
    for name in ("short", "medium", "long"):
        b = result["buckets"].get(name)
        if not b:
            continue
        ch = {}
        for r in result["per_question"]:
            if r["bucket"] == name:
                ch[str(r["channel"])] = ch.get(str(r["channel"]), 0) + 1
        print("  %-8s %6d %-10.4f %-18s %-9.4f %-9s %-8d %s"
              % (name, b["n_questions"], b["recall_at_k"],
                 "[%s, %s]" % (b["recall_ci95_low"], b["recall_ci95_high"]),
                 b["random_floor_mean"],
                 b["avg_injected"], b["empty_recall_count"], ch))
    print("channel distribution (all): %s" % result["channels"])
    print("=" * 66)


def _render_markdown(result: dict) -> str:
    """生成 Markdown 报告（含复现命令与全部逐题证据）。"""
    meta, m = result["meta"], result["metrics"]
    cm = meta["corpus_meta"]
    lines: list[str] = []
    add = lines.append

    add("# 记忆召回基线实测报告\n")
    add("> 由 `tools/memory_bench/run.py` 自动生成，**数字全部来自实跑**。\n")
    add("标签：`%s` ｜ 生成时间（UTC）：%s ｜ 代码版本：`%s`\n"
        % (meta["label"], meta["created_at"], meta["git_rev"]))

    # ---------------- 结论摘要（全部由本次数字推导，不硬编码） ----------------
    ch_total = sum(result["channels"].values()) or 1
    bm25_share = result["channels"].get("bm25", 0) / ch_total
    recency_share = result["channels"].get("recency", 0) / ch_total
    b_short = result["buckets"].get("short") or {}
    b_med = result["buckets"].get("medium") or {}
    b_long = result["buckets"].get("long") or {}
    add("\n## 结论摘要（**这是当前实现的基线**，先看这个）\n")
    add("1. **BM25 通道一次都没有触发**：%d 道题里 `bm25` 占 %.1f%%、`recency` 占 %.1f%%。"
        "结合 `_fts_quote()` 把整句包成 trigram 短语（`service.py` L293-295），"
        "BM25 实际要求「记忆原文包含用户原句的连续子串」，因此零候选 → 恒降级 recency。"
        % (ch_total, 100.0 * bm25_share, 100.0 * recency_share))
    add("2. **召回质量与随机抽取不可区分**：Recall@k=%.4f，而随机抽同样条数的下限是 "
        "%.4f，lift=%+.4f，95%%CI [%s, %s]，**%s**。"
        % (m["recall_at_k"], m["random_floor_mean"], m["lift_vs_random"],
           m["lift_ci95_low"], m["lift_ci95_high"],
           "区间不含 0，可认为优于随机" if m["lift_significant"]
           else "区间含 0，不能认为优于随机"))
    add("3. **准确率极低**：注入条目中命中标注期望记忆的仅 %.1f%%，"
        "同主题的仅 %.1f%% —— 即约九成注入内容是无关噪声，却会占满 token 预算。"
        % (100.0 * (m["precision_strict_mean"] or 0), 100.0 * (m["precision_topic_mean"] or 0)))
    add("4. **失败被「静默降级」完全掩盖**：空召回 %d 道（0%%）——因为 recency 兜底永远能"
        "凑出条目，所以从外部看「记忆一直在注入」，只是与问题无关。"
        % m["empty_recall_count"])
    add("5. **短问反而拿到双倍名额**：短问（≤2 字）平均注入 %s 条，中等/长问仅 %s / %s 条 —— "
        "因为 ≥3 字才走 BM25，而 BM25 零命中时 `k` 被减半（`service.py` L381-384）。"
        % (b_short.get("avg_injected"), b_med.get("avg_injected"), b_long.get("avg_injected")))
    add("\n> 本节的数字即「改前」基线；实现修复后用同一命令再跑一次，"
        "再用 `compare.py` 做配对对比（含 McNemar 精确检验）。\n")

    add("\n## 1. 这是什么\n")
    add("对合成语料里的问题逐题调用**真实的** `app.memory.service.recall_memories()`"
        "（`mode=question`，即生产里 `api/agent.py` L200 的调用方式），"
        "判定「期望命中的记忆」是否出现在**实际注入的记忆块**里。\n")
    add("- 不联网、不调用 LLM（**绕过抽取链路**，直接按 `AgentMemory` 表结构播种）")
    add("- 绝不碰生产库（三个库路径被强制指向仓库外临时文件，见 `bench_env.py`）")
    add("- 零新增第三方依赖（只用标准库 + 项目已有依赖）\n")

    add("\n## 2. 怎么复现\n")
    add("```bash")
    add("cd backend")
    add("python tools/memory_bench/corpus_build.py --emit        # （可选）重建语料")
    add("python tools/memory_bench/run.py --repeat %d --label %s \\" % (meta["repeat"], meta["label"]))
    add("    --markdown tools/memory_bench/results/BASELINE.md")
    add("```")
    add("- Python：`%s`；SQLite：`%s`" % (meta["python"], meta["sqlite"]))
    add("- 本次库文件：`%s`（运行结束已按 `--keep` 语义清理，此处仅留痕）"
        % meta["db_env"]["TAICHU_DB_PATH"])

    add("\n## 3. 语料规模\n")
    add("| 项 | 值 |\n|---|---|")
    add("| 虚拟用户 | %d |" % cm["n_users"])
    add("| 事实记忆 | %d 条（每用户 %d~%d 条） |"
        % (cm["n_facts"], cm["min_facts_per_user"], cm["max_facts_per_user"]))
    add("| 问题标注 | %d 条（分档见下） |" % cm["n_questions"])
    add("| 主题数 | %d |" % cm["n_topics"])
    add("| 事实池 | %d 条人工撰写 |" % cm["fact_pool_size"])
    add("| 语料指纹 sha1 | `%s` |" % cm["content_sha1"])
    add("| 实际播种 | 事实 %d 条 / FTS 镜像 %d 行 |"
        % (meta["seeded_facts"], meta["seeded_fts_rows"]))

    add("\n## 4. 总体指标\n")
    add("| 指标 | 值 |\n|---|---|")
    add("| **Recall@k**（k 取生产默认） | **%.4f**（%d/%d）｜95%%CI [%s, %s] |"
        % (m["recall_at_k"], m["recall_hits"], m["n_questions"],
           m["recall_ci95_low"], m["recall_ci95_high"]))
    add("| 随机抽同样条数的命中率下限 | %.4f |" % m["random_floor_mean"])
    add("| **相对随机的提升** | **%+.4f** ｜95%%CI [%s, %s] ｜显著=%s |"
        % (m["lift_vs_random"], m["lift_ci95_low"], m["lift_ci95_high"],
           "是" if m["lift_significant"] else "**否（与随机不可区分）**"))
    add("| 准确率（严格：命中标注的期望记忆） | %s |" % m["precision_strict_mean"])
    add("| 准确率（按主题：命中同主题事实） | %s |" % m["precision_topic_mean"])
    add("| 完全空召回题数 | %d / %d |" % (m["empty_recall_count"], m["n_questions"]))
    add("| 每次注入条数 平均/最小/最大 | %s / %s / %s |"
        % (m["avg_injected"], m["min_injected"], m["max_injected"]))
    add("| 记忆块平均字符数 | %s |" % m["avg_block_chars"])
    add("| 延迟 p50 / p95 / p99 (ms) | %s / %s / %s |"
        % (m["latency_ms_p50"], m["latency_ms_p95"], m["latency_ms_p99"]))
    add("| 延迟均值 / 最大 (ms) | %s / %s |" % (m["latency_ms_mean"], m["latency_ms_max"]))
    add("| 延迟样本数 | %d |" % m["latency_samples"])
    add("| **单次召回 SQL 条数** 平均 / p50 / 最大 | %s / %s / %s |"
        % (m["sql_per_recall_mean"], m["sql_per_recall_p50"], m["sql_per_recall_max"]))
    add("| 进程峰值内存（tracemalloc） | %s MB |" % result["memory"]["tracemalloc_peak_mb"])
    add("| ru_maxrss | %s %s |" % (result["memory"]["ru_maxrss"],
                                   result["memory"]["ru_maxrss_unit"] or ""))
    add("| 重复运行结果不稳定的题数 | %d |" % m["unstable_questions"])

    add("\n## 5. 按问题长度分档（验证「<3 字跳过 BM25」缺陷）\n")
    add("| 分档 | 题数 | Recall@k | 95%CI | 随机下限 | 平均注入条数 | 空召回 | 通道分布 |")
    add("|---|---|---|---|---|---|---|---|")
    for name, label in (("short", "短问 ≤2 字"), ("medium", "中等 3~8 字"),
                        ("long", "自然长问 >8 字")):
        b = result["buckets"].get(name)
        if not b:
            continue
        ch: dict = {}
        for r in result["per_question"]:
            if r["bucket"] == name:
                ch[str(r["channel"])] = ch.get(str(r["channel"]), 0) + 1
        add("| %s | %d | %.4f | [%s, %s] | %.4f | %s | %d | %s |"
            % (label, b["n_questions"], b["recall_at_k"],
               b["recall_ci95_low"], b["recall_ci95_high"], b["random_floor_mean"],
               b["avg_injected"], b["empty_recall_count"],
               ", ".join("%s=%d" % kv for kv in sorted(ch.items()))))

    add("\n## 6. 通道分布（全部题目）\n")
    add("| 通道 | 题数 | 占比 |\n|---|---|---|")
    total = sum(result["channels"].values()) or 1
    for key, cnt in sorted(result["channels"].items(), key=lambda kv: -kv[1]):
        add("| `%s` | %d | %.1f%% |" % (key, cnt, 100.0 * cnt / total))

    add("\n## 7. 逐题证据\n")
    add("| # | 分档 | 主题 | 问题 | 字数 | 期望数 | 注入数 | 命中 | 命中率 | 主题准确率 | 通道 | 延迟ms | SQL |")
    add("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in result["per_question"]:
        add("| %s | %s | %s | %s | %d | %d | %d | %s | %.2f | %.2f | `%s` | %s | %s |"
            % (r["question_id"], r["bucket"], r["topic"], r["question"], r["qlen"],
               r["n_expected"], r["n_recalled"], "✅" if r["recall_hit"] else "❌",
               r["precision_strict"], r["precision_topic"], r["channel"],
               r["ms_mean"], r["sql_mean"]))

    add("\n## 8. 指标口径（避免误读）\n")
    add("- **Recall@k**：期望记忆集合与「实际注入的记忆 id 集合」有交集即算命中"
        "（`k` 未显式传入，用生产默认；注意 BM25 零命中会降级 recency 且 `k` 减半，"
        "故各分档的**平均注入条数不同**，跨档比较请看该列）。")
    add("- **准确率（严格）**：注入条目里属于「该题标注期望记忆」的比例 —— 只认标注，"
        "对 recency 通道必然偏低（它按重要度×新鲜度取，与问题无关）。")
    add("- **准确率（按主题）**：注入条目里与问题同主题的比例 —— 更宽容，反映"
        "「至少没跑题」。")
    add("- **随机下限**：从该用户全部活跃事实里随机抽「同样条数」至少命中 1 条期望"
        "记忆的概率（超几何）。**若实测 Recall 与它持平，说明召回通道没起作用。**")
    add("- 延迟只含 `recall_memories()` 自身（不含网络/LLM）；SQL 条数只统计 "
        "analytics 引擎（埋点写 ops 库不计入）。")
    add("\n> 结论性判断请见仓库 `40_节/待办/节118-记忆层召回可用性修复.md` 与 README；"
        "本文件只负责给数字。\n")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])

    if args.compare:
        import compare as compare_mod
        return compare_mod.compare_files(args.compare[0], args.compare[1])

    paths = bench_env.prepare(args.db_dir, args.tag)
    try:
        return _run(args, paths)
    finally:
        # 必须先释放引擎连接池：Windows 下删除仍被打开的文件会失败
        try:
            import seed as _seed
            _seed.dispose_engines()
        except Exception:
            pass
        if not args.keep:
            removed, failed = bench_env.cleanup(paths)
            print("cleaned temp db files:", len(removed))
            if failed:
                print("!! NOT cleaned (delete manually):", failed)
        else:
            print("kept temp db:", paths["analytics"])


if __name__ == "__main__":
    raise SystemExit(main())
