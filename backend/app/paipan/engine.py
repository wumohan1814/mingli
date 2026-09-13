#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""命理排盘引擎（app.paipan.engine）——从 reference/mingli-reference/scripts/paipan.py 逐字移植的胶水层。

把公历出生信息排成 chart dict（唯一事实源）。**排盘是历法算术，全部由本模块产出，
LLM 只做解读、禁止重算。**

引擎：
  - 八字 + 神煞 + 大运/流年 + timeline_20y：lunar-python（离线，纯 Python）
  - 紫微：调用 paipan-node/ziwei.cjs（iztro）；缺依赖则 ziwei=null 降级
  - 占星/七政/五运六气：调用 paipan-node/extra.mjs（npm mingyu-core）
  - 奇门终身局：调用 paipan-node/extra.mjs（本地 vendor 的 mingyu-core 构建产物）
  - 上述任一缺失时对应段置 null 并记入 meta.degraded_methods

与参考实现（CLI + 写 chart.json）的关键差异：
  1. 无 argparse / CLI / 写文件，改为可 import 的纯函数 paipan(...) -> dict
  2. meta.source = "mingli-paipan"
  3. normalize_gender 无法识别时 raise ValueError（不再 SystemExit）
  4. 神煞 import 自 app.paipan.shensha（不再 sys.path.insert 参考目录）
  5. Node 脚本经 NODE_DIR（backend/paipan-node）解析
  6. 其余（subprocess payload/timeout/降级判定/timeline 兜底）与参考实现一致
"""

from __future__ import annotations

import json
import subprocess
import threading
from datetime import datetime
from pathlib import Path

import httpx
from lunar_python import Solar

from app.config import settings
from app.paipan.shensha import compute_shensha

GAN_WUXING = {"甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土",
              "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水"}
ZHI_WUXING = {"子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火",
              "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水"}

# 天干五合 / 天干相冲
GAN_HE = {"甲": "己", "己": "甲", "乙": "庚", "庚": "乙", "丙": "辛", "辛": "丙",
          "丁": "壬", "壬": "丁", "戊": "癸", "癸": "戊"}
GAN_CHONG = {"甲": "庚", "庚": "甲", "乙": "辛", "辛": "乙",
             "丙": "壬", "壬": "丙", "丁": "癸", "癸": "丁"}

# 地支关系
ZHI_CHONG = {"子": "午", "午": "子", "丑": "未", "未": "丑", "寅": "申", "申": "寅",
             "卯": "酉", "酉": "卯", "辰": "戌", "戌": "辰", "巳": "亥", "亥": "巳"}
ZHI_HE = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅", "卯": "戌", "戌": "卯",
          "辰": "酉", "酉": "辰", "巳": "申", "申": "巳", "午": "未", "未": "午"}
ZHI_SANHE = {"申": "子辰", "子": "申辰", "辰": "申子",
             "寅": "午戌", "午": "寅戌", "戌": "寅午",
             "巳": "酉丑", "酉": "巳丑", "丑": "巳酉",
             "亥": "卯未", "卯": "亥未", "未": "亥卯"}
ZHI_HAI = {"子": "未", "未": "子", "丑": "午", "午": "丑", "寅": "巳", "巳": "寅",
           "卯": "辰", "辰": "卯", "申": "亥", "亥": "申", "酉": "戌", "戌": "酉"}
ZHI_PO = {"子": "酉", "酉": "子", "卯": "午", "午": "卯", "辰": "丑", "丑": "辰",
          "未": "戌", "戌": "未", "寅": "亥", "亥": "寅", "巳": "申", "申": "巳"}
# 三刑（简化为两两）
ZHI_XING = {"寅": "巳", "巳": "申", "申": "寅",
            "丑": "戌", "戌": "未", "未": "丑",
            "子": "卯", "卯": "子"}

PILLAR_KEYS = ["year", "month", "day", "hour"]
PILLAR_LABEL = {"year": "年", "month": "月", "day": "日", "hour": "时"}

# engine.py 位于 backend/app/paipan/engine.py：
#   parents[0] = .../backend/app/paipan
#   parents[1] = .../backend/app
#   parents[2] = .../backend
# 故 NODE_DIR = backend/paipan-node（ziwei.cjs / extra.mjs 所在）。
NODE_DIR = Path(__file__).resolve().parents[2] / "paipan-node"
ZIWEI_SCRIPT = NODE_DIR / "ziwei.cjs"
EXTRA_SCRIPT = NODE_DIR / "extra.mjs"

# 排盘并发限流：模块级信号量（上限 settings.paipan_max_concurrency）。
# paipan() 整个排盘主体在 `with _paipan_semaphore:` 内执行，超出上限的调用会阻塞排队。
_paipan_semaphore = threading.Semaphore(settings.paipan_max_concurrency)


def normalize_gender(g: str) -> str:
    g = (g or "").strip().lower()
    if g in ("male", "m", "1", "男"):
        return "男"
    if g in ("female", "f", "0", "女"):
        return "女"
    raise ValueError(f"无法识别性别: {g!r}（可用 男/女/male/female/m/f/1/0）")


def gan_zhi_relations(liu_gan, liu_zhi, pillars, day_master):
    """流年干支与命局四柱的合冲刑害破关系，返回 desc 列表。"""
    rels = []
    # 流年干 vs 日主
    if GAN_HE.get(liu_gan) == day_master:
        rels.append(f"流年{liu_gan}与日主{day_master}相合")
    elif GAN_CHONG.get(liu_gan) == day_master:
        rels.append(f"流年{liu_gan}与日主{day_master}相冲")
    # 流年干 vs 各柱干（跳过日柱，日主已在上面单独判断，避免重复）
    for key in PILLAR_KEYS:
        if key == "day":
            continue
        p = pillars.get(key)
        if not p:
            continue
        g = p["gan"]
        if g == liu_gan:
            continue
        if GAN_HE.get(liu_gan) == g:
            rels.append(f"流年干{liu_gan}与{PILLAR_LABEL[key]}干{g}合")
        elif GAN_CHONG.get(liu_gan) == g:
            rels.append(f"流年干{liu_gan}与{PILLAR_LABEL[key]}干{g}冲")
    # 流年支 vs 各柱支
    for key in PILLAR_KEYS:
        p = pillars.get(key)
        if not p:
            continue
        z = p["zhi"]
        if z == liu_zhi:
            continue
        if ZHI_CHONG.get(liu_zhi) == z:
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}相冲")
        elif ZHI_HE.get(liu_zhi) == z:
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}相合")
        elif z in ZHI_SANHE.get(liu_zhi, ""):
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}三合")
        elif ZHI_XING.get(liu_zhi) == z:
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}相刑")
        elif ZHI_HAI.get(liu_zhi) == z:
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}相害")
        elif ZHI_PO.get(liu_zhi) == z:
            rels.append(f"流年支{liu_zhi}与{PILLAR_LABEL[key]}支{z}相破")
    return rels


def build_pillar(b, prefix, getter_gan, getter_zhi, getter_nayin,
                 getter_shishen_gan, getter_shishen_zhi, getter_hide_gan, getter_dish):
    gan = getter_gan()
    zhi = getter_zhi()
    hide = getter_hide_gan()
    shishen_zhi = getter_shishen_zhi()
    hide_gan = [{"gan": g, "shishen": (shishen_zhi[i] if i < len(shishen_zhi) else "")}
                for i, g in enumerate(hide)]
    return {
        "gan": gan, "zhi": zhi,
        "gan_wuxing": GAN_WUXING.get(gan, ""),
        "zhi_wuxing": ZHI_WUXING.get(zhi, ""),
        "nayin": getter_nayin(),
        "shishen_gan": getter_shishen_gan(),
        "shishen_zhi": shishen_zhi,
        "hide_gan": hide_gan,
        "dish": getter_dish(),
    }


def build_bazi(b, has_hour: bool) -> dict:
    pillars = {}
    pillars["year"] = build_pillar(
        b, "year", b.getYearGan, b.getYearZhi, b.getYearNaYin,
        b.getYearShiShenGan, b.getYearShiShenZhi, b.getYearHideGan, b.getYearDiShi)
    pillars["month"] = build_pillar(
        b, "month", b.getMonthGan, b.getMonthZhi, b.getMonthNaYin,
        b.getMonthShiShenGan, b.getMonthShiShenZhi, b.getMonthHideGan, b.getMonthDiShi)
    pillars["day"] = build_pillar(
        b, "day", b.getDayGan, b.getDayZhi, b.getDayNaYin,
        b.getDayShiShenGan, b.getDayShiShenZhi, b.getDayHideGan, b.getDayDiShi)
    if has_hour:
        pillars["hour"] = build_pillar(
            b, "hour", b.getTimeGan, b.getTimeZhi, b.getTimeNaYin,
            b.getTimeShiShenGan, b.getTimeShiShenZhi, b.getTimeHideGan, b.getTimeDiShi)
    else:
        pillars["hour"] = None

    day_master = b.getDayGan()
    return {
        "pillars": pillars,
        "day_master": day_master,
        "day_master_wuxing": GAN_WUXING.get(day_master, ""),
        "shen_gong": b.getShenGong(),
        "ming_gong": b.getMingGong(),
        "tai_yuan": b.getTaiYuan(),
        "xun_kong": b.getDayXunKong(),
        "shensha": compute_shensha({k: {"gan": v["gan"], "zhi": v["zhi"]}
                                    for k, v in pillars.items() if v}),
    }


def build_da_yun(b, gender_num: int) -> list:
    yun = b.getYun(gender_num)
    try:
        start_solar = yun.getStartSolar().toYmdHms()
    except Exception:
        start_solar = ""
    qiyun = {
        "forward": bool(yun.isForward()),
        "start": start_solar,          # 起运公历日期（精确到小时）
        "start_age": yun.getStartYear(),  # 起运岁数
    }
    da_yun = []
    for d in yun.getDaYun()[1:9]:  # 跳过 [0] 起运前占位，取 8 步
        gz = d.getGanZhi()
        if not gz:
            continue
        liu_nian = []
        for ln in d.getLiuNian():
            liu_nian.append({
                "year": ln.getYear(), "age": ln.getAge(),
                "ganzhi": ln.getGanZhi(), "shishen": "",
                "shensha": [], "relations": [],
            })
        da_yun.append({
            "index": d.getIndex(), "ganzhi": gz,
            "start_year": d.getStartYear(), "end_year": d.getEndYear(),
            "age_start": d.getStartAge(), "age_end": d.getEndAge(),
            "liu_nian": liu_nian,
        })
    return qiyun, da_yun


def compute_liu_nian_ganzhi(year: int) -> str:
    """某公历年的流年干支（以立春为界，取年中六月确保在立春后）。"""
    try:
        return Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar().getEightChar().getYear()
    except Exception:
        return ""


def build_timeline_20y(da_yun, pillars, day_master, shensha_targets) -> list:
    # 收集所有流年
    year_map = {}
    for dy in da_yun:
        for ln in dy["liu_nian"]:
            year_map[ln["year"]] = {"liu_nian_ganzhi": ln["ganzhi"],
                                    "age": ln["age"], "da_yun_ganzhi": dy["ganzhi"]}
    cur = datetime.now().year
    years = list(range(cur - 19, cur + 1))
    timeline = []
    for y in years:
        info = year_map.get(y)
        lngz = info["liu_nian_ganzhi"] if info else compute_liu_nian_ganzhi(y)
        dygz = info["da_yun_ganzhi"] if info else ""
        age = info["age"] if info else (y - 1990 + 1)  # 仅兜底
        liu_gan = lngz[0] if len(lngz) >= 1 else ""
        liu_zhi = lngz[1] if len(lngz) >= 2 else ""
        events = []
        for rel in gan_zhi_relations(liu_gan, liu_zhi, pillars, day_master):
            events.append({"type": "冲合", "desc": rel})
        for nm in ("驿马", "桃花", "华盖", "羊刃", "劫煞", "亡神"):
            if liu_zhi and liu_zhi in shensha_targets.get(nm, set()):
                events.append({"type": "神煞", "desc": f"流年见{nm}"})
        timeline.append({
            "year": y, "age": age, "da_yun_ganzhi": dygz,
            "liu_nian_ganzhi": lngz, "events": events,
        })
    return timeline


def run_ziwei(year, month, day, hour, gender) -> dict | None:
    """紫微排盘：先调常驻 HTTP 服务（server.mjs /ziwei），失败则静默降级 subprocess ziwei.cjs。

    HTTP 与 subprocess 输出结构一致；两条路径都失败时返回 None。
    """
    if not ZIWEI_SCRIPT.exists():
        return None
    time_idx = ((hour + 1) // 2) % 12
    payload = {"birthday": f"{year}-{month:02d}-{day:02d}",
               "time_idx": time_idx, "gender": gender}
    # ① 优先：常驻 HTTP 服务（paipan-node/server.mjs）
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/ziwei", json=payload, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                return data
    except Exception:
        pass  # 连接失败/超时/非 200/解析失败 → 静默降级
    # ② 降级：一次性 subprocess（ziwei.cjs，保留原逻辑）
    try:
        r = subprocess.run(["node", str(ZIWEI_SCRIPT)],
                           input=json.dumps(payload, ensure_ascii=False),
                           capture_output=True, text=True, encoding="utf-8", timeout=60)
        if r.returncode != 0:
            return None
        return json.loads(r.stdout)
    except Exception:
        return None


def run_extra(year, month, day, hour, gender, name, birthplace, longitude, latitude,
              true_solar) -> dict | None:
    """占星/七政/五运六气/奇门终身局：先调常驻 HTTP 服务（server.mjs /extra），失败降级 subprocess extra.mjs。

    调用方约定：仅当 longitude is not None 时才调用；失败返回 None。
    """
    if not EXTRA_SCRIPT.exists():
        return None
    payload = {"year": year, "month": month, "day": day, "hour": hour,
               "minute": 0, "gender": gender, "name": name,
               "birthplace": birthplace, "longitude": longitude,
               "latitude": latitude, "true_solar": true_solar}
    # ① 优先：常驻 HTTP 服务（paipan-node/server.mjs）
    try:
        resp = httpx.post(f"{settings.paipan_node_url}/extra", json=payload, timeout=180)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                return data
    except Exception:
        pass  # 连接失败/超时/非 200/解析失败 → 静默降级
    # ② 降级：一次性 subprocess（extra.mjs，保留原逻辑）
    try:
        r = subprocess.run(["node", str(EXTRA_SCRIPT)],
                           input=json.dumps(payload, ensure_ascii=False),
                           capture_output=True, text=True, encoding="utf-8", timeout=180)
        if r.returncode != 0:
            return None
        return json.loads(r.stdout)
    except Exception:
        return None


def paipan(*, year: int, month: int, day: int,
           hour: int | None = None, minute: int | None = None,
           gender: str, name: str = "", birthplace: str = "",
           longitude: float | None = None, latitude: float | None = None,
           true_solar: bool = False) -> dict:
    """排盘（唯一入口）。公历出生信息 → chart dict。

    chart 顶层键固定为：
    meta, input, calendar, bazi, timeline_20y, ziwei,
    western, qizheng, qimen_lifetime, wuyun_liuqi
    """
    with _paipan_semaphore:
        input_hour = hour
        input_minute = minute

        gender = normalize_gender(gender)
        gender_num = 1 if gender == "男" else 0
        has_hour = input_hour is not None

        # 真太阳时近似：经度每偏离 120° 一度修正 4 分钟
        true_solar_applied = False
        hour = input_hour or 12
        minute = input_minute or 0
        if true_solar and longitude is not None:
            delta_min = int(round((longitude - 120) * 4))
            total = hour * 60 + minute + delta_min
            total %= 24 * 60
            hour, minute = divmod(total, 60)
            true_solar_applied = True

        solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
        lunar = solar.getLunar()
        b = lunar.getEightChar()
        if hasattr(b, "setSect"):
            b.setSect(2)

        bazi = build_bazi(b, has_hour)
        qiyun, da_yun = build_da_yun(b, gender_num)
        bazi["qi_yun"] = qiyun
        bazi["da_yun"] = da_yun

        shensha_targets = {}
        for ss in bazi["shensha"]:
            shensha_targets.setdefault(ss["name"], set()).add(ss["target"])

        ziwei = None
        if has_hour:
            ziwei = run_ziwei(year, month, day, hour, gender)

        western = qizheng = wuyun = qimen_lifetime = None
        if has_hour and longitude is not None:
            extra = run_extra(year, month, day, hour, gender, name,
                              birthplace, longitude, latitude,
                              true_solar_applied)
            if extra:
                western = extra.get("western")
                qizheng = extra.get("qizheng")
                wuyun = extra.get("wuyun_liuqi")
                qimen_lifetime = extra.get("qimen_lifetime")

        degraded = []
        if qimen_lifetime is None:
            degraded.append("qimen-lifetime")  # 仅当奇门终身局输出为 null 时降级
        if not has_hour:
            degraded.append("bazi-hour")
        if ziwei is None:
            degraded.append("ziwei")
        if western is None:
            degraded.append("western")
        if qizheng is None:
            degraded.append("qizheng")
        if wuyun is None:
            degraded.append("wuyun-liuqi")

        timeline = build_timeline_20y(da_yun, bazi["pillars"], bazi["day_master"],
                                      shensha_targets)

        chart = {
            "meta": {"version": "1.0.0",
                     "generated_at": datetime.now().isoformat(timespec="seconds"),
                     "source": "mingli-paipan", "degraded_methods": degraded},
            "input": {"calendar": "solar", "year": year, "month": month,
                      "day": day, "hour": input_hour, "minute": input_minute,
                      "gender": gender, "birthplace_name": birthplace,
                      "longitude": longitude, "latitude": latitude,
                      "true_solar_time": true_solar_applied, "sect": 2, "yun_sect": 1,
                      "name": name},
            "calendar": {"solar": solar.toYmdHms(), "lunar": lunar.toString(),
                         "true_solar_applied": true_solar_applied},
            "bazi": bazi,
            "timeline_20y": timeline,
            "ziwei": ziwei,
            "western": western, "qizheng": qizheng,
            "qimen_lifetime": qimen_lifetime, "wuyun_liuqi": wuyun,
        }
        return chart
