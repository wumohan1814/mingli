"""成本计算：从数据库 jobs 表读 usage，按 DeepSeek-V4-Flash 峰谷定价算金额。

用法：cd backend && python scripts/cost.py

定价（元 / 百万 tokens，2026-08-17 起）：
    缓存命中输入  空闲 0.05 / 高峰 0.10
    未命中输入    空闲 1.5  / 高峰 3.0
    输出          空闲 4.5  / 高峰 9.0
高峰时段（北京时间，工作日）：9:00–12:00、14:00–18:00；周末/节假日全空闲。

计费字段（DeepSeek usage）：
    prompt_cache_hit_tokens = 缓存命中输入
    prompt_tokens           = 未命中输入（DeepSeek 定义，不含 cache_hit）
    completion_tokens       = 输出
"""
from datetime import datetime, timedelta, timezone

from app.database import AnalyticsSession
from app.models import Job

PRICING = {
    "idle": {"cache_hit": 0.05, "cache_miss": 1.5, "output": 4.5},
    "peak": {"cache_hit": 0.10, "cache_miss": 3.0, "output": 9.0},
}
PEAK_HOURS = [(9, 12), (14, 18)]
BJ = timezone(timedelta(hours=8))


def is_peak(dt_bj: datetime) -> bool:
    """北京时间是否高峰（工作日 + 时段；节假日未建模，简化为周一~周五）。"""
    if dt_bj.weekday() >= 5:
        return False
    return any(h0 <= dt_bj.hour < h1 for h0, h1 in PEAK_HOURS)


def cost_of(usage: dict, dt_bj: datetime) -> dict:
    peak = is_peak(dt_bj)
    p = PRICING["peak" if peak else "idle"]
    cache_hit = int(usage.get("prompt_cache_hit_tokens", 0) or 0)
    cache_miss = int(usage.get("prompt_tokens", 0) or 0)
    output = int(usage.get("completion_tokens", 0) or 0)
    cost = (cache_hit * p["cache_hit"] + cache_miss * p["cache_miss"]
            + output * p["output"]) / 1_000_000
    return {"peak": peak, "cache_hit": cache_hit, "cache_miss": cache_miss,
            "output": output, "cost": cost}


def main() -> None:
    session = AnalyticsSession()
    jobs = session.query(Job).order_by(Job.id).all()
    tot = {"cache_hit": 0, "cache_miss": 0, "output": 0, "cost": 0.0}
    for j in jobs:
        u = (j.result_json or {}).get("_usage") if isinstance(j.result_json, dict) else None
        if not u:
            continue
        dt = j.updated_at or j.created_at or datetime.utcnow()
        dt_bj = dt.replace(tzinfo=timezone.utc).astimezone(BJ)
        r = cost_of(u, dt_bj)
        for k in ("cache_hit", "cache_miss", "output", "cost"):
            tot[k] += r[k]
        print(f"job={j.id} type={j.type.value if j.type else '-'} "
              f"status={j.status.value if j.status else '-'} peak={r['peak']} "
              f"hit={r['cache_hit']} miss={r['cache_miss']} out={r['output']} "
              f"cost=¥{r['cost']:.4f}")
    print(f"\n合计: hit={tot['cache_hit']} miss={tot['cache_miss']} "
          f"out={tot['output']} cost=¥{tot['cost']:.4f}")
    session.close()


if __name__ == "__main__":
    main()
