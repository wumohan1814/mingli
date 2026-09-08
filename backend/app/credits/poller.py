# -*- coding: utf-8 -*-
"""金数据 API 轮询 → 充值入账（定时任务核心，幂等）。

设计见 docs/架构设计-支付系统-金数据.md §9.6：
  - 支付成功判定集：生产只认 TRADE_SUCCESS；settings.jinshuju_allow_mock=True 时
    额外认 MOCK_PAY_SUCCESS（模拟表单自测）。**生产环境必须 TAICHU_JINSHUJU_ALLOW_MOCK=false**，
    否则模拟表单会白送余额。
  - 幂等逻辑：充值码 resolve 只认 `unused` 且未过期 → 充值成功立刻 mark_used 置
    `used` → 同一 entry / 同一码被重复拉到（轮询天然重拉）时 resolve 返回 None
    直接跳过，绝不重复入账。
  - session 纪律：每条 entry 独立 try/except（异常记日志 continue，单条不拖垮整轮）；
    码查询与置 used 各用一条短生命周期 AnalyticsSession，`recharge()` 由
    credits.service 自开/关 session 并 commit。

字段约定（实际表单 K4kgC7，见 config.jinshuju_field_* / 系统字段）：
  - entry["serial_number"]  幂等主键（金数据系统字段，每条 entry 唯一）
  - entry["trade_status"]   支付状态（TRADE_SUCCESS / MOCK_PAY_SUCCESS = 已支付）
  - entry[field_1]          充值码
  - entry[field_2]          商品档位数组 [{name, number, price}]，取 number>0 的 price
"""
import logging

from app.config import settings
from app.credits.codes import mark_used, resolve_code
from app.credits.jinshuju import fetch_entries
from app.credits.service import recharge
from app.database import AnalyticsSession
from app.events.service import record_event

logger = logging.getLogger(__name__)

# 支付成功判定集（模块加载时按 allow_mock 定型；改配置需重启生效）
PAID_STATUSES = {"TRADE_SUCCESS"}
if settings.jinshuju_allow_mock:            # 生产设 false，防止模拟表单白送余额
    PAID_STATUSES.add("MOCK_PAY_SUCCESS")


async def poll_and_recharge() -> None:
    """拉取金数据最近一页充值条目，逐条处理「支付成功」的入账（幂等）。

    未配置 TAICHU_JINSHUJU_ACCESS_TOKEN 时直接跳过（不真调金数据）。
    """
    if not settings.jinshuju_access_token:
        logger.info("未配置 TAICHU_JINSHUJU_ACCESS_TOKEN，跳过金数据轮询")
        return

    try:
        data = await fetch_entries(page=1, per_page=50)
    except Exception:
        # 拉取失败（网络/配额/token 失效）不崩任务，下个周期自动重试
        logger.exception("金数据拉取条目失败，下个轮询周期重试")
        return

    entries = data.get("entries") or []
    logger.info("金数据轮询拉到 %s 条条目", len(entries))
    for entry in entries:
        try:
            _recharge_one_entry(entry)
        except Exception:
            logger.exception(
                "处理金数据条目失败（已跳过，下轮重拉时若码仍 unused 会重试）serial=%s",
                entry.get("serial_number"),
            )
            continue


def _recharge_one_entry(entry: dict) -> None:
    """处理单条 entry：支付成功 + 码有效 → recharge 入账 + mark_used 防重放。"""
    serial = entry.get("serial_number")
    trade_status = entry.get("trade_status")
    code = entry.get(settings.jinshuju_field_code)   # 充值码字段（field_1）

    # 1) 判定支付成功
    if trade_status not in PAID_STATUSES:
        logger.info("entry serial=%s trade_status=%s 非支付成功，跳过", serial, trade_status)
        return
    if not serial or not code:
        logger.warning("entry serial=%s 缺充值码/序号，跳过", serial)
        return

    # 2) 充值码必须有效（unused 且未过期）—— 天然幂等：已 used 的码直接跳过
    session = AnalyticsSession()
    try:
        row = resolve_code(session, code)
        if row is None:
            logger.info("充值码 %s 不可用（已用/过期/不存在），serial=%s 跳过（幂等）", code, serial)
            return
        user_id = row.user_id
    finally:
        session.close()

    # 3) 金额：field_2 数组取 number>0 的那条 price（float）
    items = entry.get(settings.jinshuju_field_amount) or []
    paid_item = next(
        (it for it in items if _item_number(it) > 0),
        None,
    )
    if paid_item is None:
        logger.warning("entry serial=%s 无已支付档位（%s），跳过", serial, settings.jinshuju_field_amount)
        return
    amount = _item_price(paid_item)
    if amount <= 0:
        logger.warning("entry serial=%s 档位金额异常 %s，跳过", serial, amount)
        return

    # 4) 充值：delta = int(amount * recharge_rate)（1 元 = 10 存储单位）
    delta = int(amount * settings.recharge_rate)
    recharge(user_id, delta, type="recharge", amount=amount, ref=f"serial:{serial}")

    # 5) 标记码已用（防重放，兼作幂等）—— 须在充值成功后才置 used
    session = AnalyticsSession()
    try:
        mark_used(session, code)
    finally:
        session.close()

    # 6) 埋点 credit_recharge（写失败只记日志，不抛）
    record_event(
        "credit_recharge",
        user_id=user_id,
        props={"delta": delta, "amount": amount, "serial": serial},
    )
    logger.info(
        "充值入账 user_id=%s code=%s serial=%s amount=%s delta=%s",
        user_id, code, serial, amount, delta,
    )


def _item_number(item: dict) -> float:
    """档位条目 number 转 float；缺省/非数值按 0（未选中该档位）。"""
    try:
        return float(item.get("number") or 0)
    except (TypeError, ValueError):
        return 0.0


def _item_price(item: dict) -> float:
    """档位条目 price 转 float；缺省/非数值按 0。"""
    try:
        return float(item.get("price") or 0)
    except (TypeError, ValueError):
        return 0.0
