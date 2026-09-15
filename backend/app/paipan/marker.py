# -*- coding: utf-8 -*-
"""
节117 · 确定性「预判标记」层

定位：排盘之后、LLM 解读之前，用纯代码算出一组命理标记，
作为"确定性基础层"喂给各方法模块——把"该看什么"从 LLM 挪到代码，
降低幻觉面与 token 消耗。

设计原则（对齐方案 A · 先八字）：
- 纯代码、零 LLM 调用
- 标记按方法隔离（各法取自己需要的子集）
- 新增字段不破坏既有契约（标记是 slice_data 的新增 key）
- 整层可关闭（feature flag）
"""

from __future__ import annotations

from typing import Any


# --------------------------------------------------------------------------- #
# 基础五行/十神常量
# --------------------------------------------------------------------------- #

# 五行相生
_WU_XING_SHENG = {
    "木": "火",
    "火": "土",
    "土": "金",
    "金": "水",
    "水": "木",
}

# 五行相克
_WU_XING_KE = {
    "木": "土",
    "土": "水",
    "水": "火",
    "火": "金",
    "金": "木",
}

# 日主 → 十神映射表
# key: 五行关系（相对于日主）；value: 十神名（正/偏在十神里分正偏，但标记层只给大类）
# 十神体系（以日主为我）：
#   生我 → 印星（正印/偏印）
#   我生 → 食伤（食神/伤官）
#   克我 → 官杀（正官/七杀）
#   我克 → 财星（正财/偏财）
#   同我 → 比劫（比肩/劫财）

def _shishen_category(day_wuxing: str, target_wuxing: str) -> str:
    """返回十神大类（印星/食伤/官杀/财星/比劫）。

    标记层不需要细分正偏，只给大类，减少歧义。
    """
    if target_wuxing == day_wuxing:
        return "比劫"
    if _WU_XING_SHENG.get(target_wuxing) == day_wuxing:
        # target 生日主 → 印星
        return "印星"
    if _WU_XING_SHENG.get(day_wuxing) == target_wuxing:
        # 日主生 target → 食伤
        return "食伤"
    if _WU_XING_KE.get(target_wuxing) == day_wuxing:
        # target 克日主 → 官杀
        return "官杀"
    if _WU_XING_KE.get(day_wuxing) == target_wuxing:
        # 日主克 target → 财星
        return "财星"
    return ""


# 五行对应季节（用来判断得令）
# 春：寅卯辰 → 木旺；夏：巳午未 → 火旺；
# 秋：申酉戌 → 金旺；冬：亥子丑 → 水旺
# 四季末（辰戌丑未）→ 土旺，但这里简化：按本气算
_ZHI_WANG_WUXING = {
    # 春木
    "寅": "木", "卯": "木",
    # 夏火
    "巳": "火", "午": "火",
    # 秋金
    "申": "金", "酉": "金",
    # 冬水
    "亥": "水", "子": "水",
    # 四季土（本气土，按土旺算）
    "辰": "土", "未": "土", "戌": "土", "丑": "土",
}

# 寒燥判断：生于冬（亥子丑月）→ 偏寒；生于夏（巳午未月）→ 偏燥；
# 生于春（寅卯辰）→ 温和偏湿；生于秋（申酉戌）→ 偏凉
# 月支 → 寒燥标签
_ZHI_HAN_ZAO = {
    "寅": "温和", "卯": "温和", "辰": "偏湿",
    "巳": "偏燥", "午": "偏燥", "未": "偏燥",
    "申": "偏凉", "酉": "偏凉", "戌": "偏凉",
    "亥": "偏寒", "子": "偏寒", "丑": "偏寒",
}

# 日主五行 → 墓库地支（木墓未、火墓戌、金墓丑、水墓辰、土墓戌）
_MU_KU_ZHI = {
    "木": "未",
    "火": "戌",
    "土": "戌",
    "金": "丑",
    "水": "辰",
}


# --------------------------------------------------------------------------- #
# 八字标记计算
# --------------------------------------------------------------------------- #

def _bazi_markers(chart: dict[str, Any]) -> dict[str, Any]:
    """计算八字方法需要的确定性标记。

    输入：完整 chart（使用 chart.bazi 部分）
    输出：八字标记字典，包含：
      - monthly_shishen: 月令十神（大类）
      - monthly_benqi: 月令本气藏干
      - root_qi: 根气摘要（得令/得地/得势 + 综合描述）
      - han_zao: 寒燥标记
      - qi_sha: 七杀标记（有无/透干/有根/制化）
      - muku: 墓库标记（日主墓库 + 出现位置）
    """
    bazi = chart.get("bazi") or {}
    pillars = bazi.get("pillars") or {}
    day_master_wuxing = bazi.get("day_master_wuxing", "")

    if not pillars or not day_master_wuxing:
        return {}

    month_pillar = pillars.get("month") or {}
    month_zhi = month_pillar.get("zhi", "")
    month_hide_gan = month_pillar.get("hide_gan") or []

    # --- 1. 月令十神 & 本气 ---
    monthly_shishen = ""
    monthly_benqi = ""
    if month_hide_gan and len(month_hide_gan) > 0:
        # 月支本气 = 第一个藏干
        monthly_benqi = month_hide_gan[0].get("gan", "")
        monthly_shishen = month_hide_gan[0].get("shishen", "")  # 排盘已算好十神

    # --- 2. 根气摘要 ---
    # 得令：月令五行 = 日主五行，或月令生日主（印星当令）
    de_ling = False
    month_wuxing = _ZHI_WANG_WUXING.get(month_zhi, "")
    if month_wuxing == day_master_wuxing:
        de_ling = True
    elif _WU_XING_SHENG.get(month_wuxing) == day_master_wuxing:
        # 月令生日主 → 印星当令 → 也算得令（广义）
        de_ling = True

    # 得地：四柱地支中有日主五行的本气根
    # （简化：地支五行 == 日主五行 或 地支藏干有日主五行且是本气/余气）
    de_di = False
    gen_positions = []
    for pos in ["year", "month", "day", "hour"]:
        p = pillars.get(pos) or {}
        zhi = p.get("zhi", "")
        zhi_wuxing = p.get("zhi_wuxing", "")
        hide = p.get("hide_gan") or []
        # 本气根：地支五行 == 日主五行
        if zhi_wuxing == day_master_wuxing:
            de_di = True
            gen_positions.append(f"{_pillar_cn(pos)}支")
        else:
            # 余气根：藏干中有日主五行（非本气）
            for hg in hide[1:]:  # 跳过第一个（本气已判断）
                # 从藏干反推五行——这里用十神判断不够，需要天干五行映射
                # 简化：如果藏干对应的十神是比劫，那就是日主同类
                if hg.get("shishen") == "比肩" or hg.get("shishen") == "劫财":
                    de_di = True
                    if f"{_pillar_cn(pos)}支" not in gen_positions:
                        gen_positions.append(f"{_pillar_cn(pos)}支")
                    break

    # 得势：天干有比劫或印星（日主得助）
    de_shi = False
    shi_tians = []
    for pos in ["year", "month", "day", "hour"]:
        p = pillars.get(pos) or {}
        shishen = p.get("shishen_gan", "")
        gan = p.get("gan", "")
        if shishen in ("比肩", "劫财", "正印", "偏印"):
            de_shi = True
            if pos != "day":  # 不算日主自己
                shi_tians.append(f"{_pillar_cn(pos)}干 {gan}")

    # 根气综合描述
    root_desc_parts = []
    if de_ling:
        root_desc_parts.append("得令")
    if de_di:
        root_desc_parts.append("得地")
    if de_shi:
        root_desc_parts.append("得势")
    if not root_desc_parts:
        root_desc_parts.append("身弱无根")

    root_qi = {
        "de_ling": de_ling,
        "de_di": de_di,
        "de_shi": de_shi,
        "gen_positions": gen_positions,
        "summary": "".join(root_desc_parts) if root_desc_parts else "身弱",
    }

    # --- 3. 寒燥标记 ---
    han_zao = _ZHI_HAN_ZAO.get(month_zhi, "")

    # --- 4. 七杀标记 ---
    qi_sha = _calc_qisha_markers(pillars, day_master_wuxing)

    # --- 5. 墓库标记 ---
    muku_zhi = _MU_KU_ZHI.get(day_master_wuxing, "")
    muku_positions = []
    if muku_zhi:
        for pos in ["year", "month", "day", "hour"]:
            p = pillars.get(pos) or {}
            if p.get("zhi") == muku_zhi:
                muku_positions.append(f"{_pillar_cn(pos)}支")

    muku = {
        "muku_zhi": muku_zhi,
        "in_pillars": muku_positions,
        "has_muku": len(muku_positions) > 0,
    }

    return {
        "monthly_shishen": monthly_shishen,
        "monthly_benqi": monthly_benqi,
        "month_zhi": month_zhi,
        "root_qi": root_qi,
        "han_zao": han_zao,
        "qi_sha": qi_sha,
        "muku": muku,
    }


def _calc_qisha_markers(pillars: dict, day_wuxing: str) -> dict:
    """计算七杀相关标记。

    简化版（标记层不求完整格局判断，只给基础信号）：
    - has_qisha: 八字中有七杀（天干或地支藏干有七杀）
    - tou_gan: 七杀透干（天干出现七杀）
    - you_gen: 七杀有根（七杀透干且地支有同类五行）
    - zhi_hua: 七杀有制化（有食神/伤官制杀，或有印星化杀）
    """
    has_qisha = False
    tou_gan = False
    tou_gan_list = []
    you_gen = False
    zhi_zhi = False  # 有制（食伤制杀）
    zhi_hua = False  # 有化（印星化杀）

    # 官杀五行 = 克日主的五行
    qisha_wuxing = ""
    for w, s in _WU_XING_KE.items():
        if s == day_wuxing:
            qisha_wuxing = w
            break

    if not qisha_wuxing:
        return {
            "has_qisha": False,
            "tou_gan": False,
            "you_gen": False,
            "zhi_hua": False,
            "tou_gan_positions": [],
        }

    # 检查天干
    for pos in ["year", "month", "day", "hour"]:
        p = pillars.get(pos) or {}
        shishen = p.get("shishen_gan", "")
        if "七杀" in shishen or "正官" in shishen:
            has_qisha = True
            if pos != "day":
                tou_gan = True
                tou_gan_list.append(f"{_pillar_cn(pos)}干")

    # 检查地支藏干
    qisha_in_zhi = False
    zhi_qisha_positions = []
    for pos in ["year", "month", "day", "hour"]:
        p = pillars.get(pos) or {}
        hide = p.get("hide_gan") or []
        for hg in hide:
            shishen = hg.get("shishen", "")
            if "七杀" in shishen or "正官" in shishen:
                has_qisha = True
                qisha_in_zhi = True
                zhi_qisha_positions.append(f"{_pillar_cn(pos)}支")
                break

    # 有根：七杀透干 + 地支有官杀五行的藏干
    if tou_gan and qisha_in_zhi:
        you_gen = True

    # 制化判断（简化）
    # 食伤制杀：有食神/伤官（天干或地支）
    # 印星化杀：有印星（天干或地支）
    has_shishang = False
    has_yinxing = False
    for pos in ["year", "month", "day", "hour"]:
        p = pillars.get(pos) or {}
        # 天干
        shishen_gan = p.get("shishen_gan", "")
        if "食神" in shishen_gan or "伤官" in shishen_gan:
            has_shishang = True
        if "正印" in shishen_gan or "偏印" in shishen_gan:
            has_yinxing = True
        # 地支藏干
        hide = p.get("hide_gan") or []
        for hg in hide:
            shishen = hg.get("shishen", "")
            if "食神" in shishen or "伤官" in shishen:
                has_shishang = True
            if "正印" in shishen or "偏印" in shishen:
                has_yinxing = True

    if has_qisha:
        if has_shishang:
            zhi_zhi = True
        if has_yinxing:
            zhi_hua = True

    return {
        "has_qisha": has_qisha,
        "tou_gan": tou_gan,
        "you_gen": you_gen,
        "zhi_zhi": zhi_zhi,   # 有制（食伤制）
        "zhi_hua": zhi_hua,   # 有化（印化）
        "tou_gan_positions": tou_gan_list,
    }


def _pillar_cn(pos: str) -> str:
    """柱位置 → 中文（年/月/日/时）。"""
    return {
        "year": "年",
        "month": "月",
        "day": "日",
        "hour": "时",
    }.get(pos, pos)


# --------------------------------------------------------------------------- #
# 紫微斗数标记
# --------------------------------------------------------------------------- #

# 四化简称 → 全称（sihua 里 mutagen 只有 禄/权/科/忌）
_MUTAGEN_CN = {
    "禄": "化禄",
    "权": "化权",
    "科": "化科",
    "忌": "化忌",
}


def _ziwei_palace_by_branch(palaces: list, branch: str) -> dict | None:
    """按地支在十二宫里找对应宫，返回该宫的关键信息；找不到返回 None。

    命宫/身宫在顶层给的是地支（如 soul_palace="戌"），
    palaces 里每宫有 earthly_branch，用分支匹配。
    """
    for p in palaces:
        if not isinstance(p, dict):
            continue
        if p.get("earthly_branch") == branch:
            major = p.get("major_stars")
            major_list = [s for s in major if isinstance(s, str)] if isinstance(major, list) else []
            return {
                "name": p.get("name", ""),
                "branch": branch,
                "major_stars": major_list,
                "is_empty": len(major_list) == 0,
            }
    return None


def _ziwei_markers(chart: dict[str, Any]) -> dict[str, Any]:
    """紫微斗数确定性标记：命宫/身宫主星与空宫、五行局、四化。

    输出是"该看什么"的短事实（会被注入 LLM prompt）：
      - life_palace / body_palace: {name, branch, major_stars, is_empty}
      - five_elements_class: 五行局（如"土五局"）
      - sihua: ["星曜化X·宫名", ...] 短描述列表
    段缺失/为空 → 返回 {}。
    """
    ziwei = chart.get("ziwei") or {}
    palaces = ziwei.get("palaces")
    if not isinstance(palaces, list) or not palaces:
        return {}

    # 命宫：soul_palace 是地支；身宫：body_palace 是地支，兜底用 is_body_palace 标记
    life = _ziwei_palace_by_branch(palaces, ziwei.get("soul_palace", ""))
    body = _ziwei_palace_by_branch(palaces, ziwei.get("body_palace", ""))
    if body is None:
        for p in palaces:
            if isinstance(p, dict) and p.get("is_body_palace"):
                major = p.get("major_stars")
                major_list = [s for s in major if isinstance(s, str)] if isinstance(major, list) else []
                body = {
                    "name": p.get("name", ""),
                    "branch": p.get("earthly_branch", ""),
                    "major_stars": major_list,
                    "is_empty": len(major_list) == 0,
                }
                break

    # 四化：顶层 sihua 是权威清单，转成"星曜化X·宫名"短描述
    sihua: list[str] = []
    for item in ziwei.get("sihua") or []:
        if not isinstance(item, dict):
            continue
        star = item.get("star", "")
        mutagen = item.get("mutagen", "")
        palace = item.get("palace", "")
        if not star or not mutagen:
            continue
        sihua.append(f"{star}{_MUTAGEN_CN.get(mutagen, mutagen)}·{palace}")

    result: dict[str, Any] = {
        "five_elements_class": ziwei.get("five_elements_class", ""),
        "sihua": sihua,
    }
    if life is not None:
        result["life_palace"] = life
    if body is not None:
        result["body_palace"] = body
    return result


# --------------------------------------------------------------------------- #
# 七政四余标记
# --------------------------------------------------------------------------- #

# 庙旺落陷关键标记（dignity 值形如 "庙/乐"、"旺/喜"、"陷"、"平"、"—"）
_QIZHENG_STRONG = ("庙", "旺")
_QIZHENG_WEAK = ("陷",)


def _qizheng_markers(chart: dict[str, Any]) -> dict[str, Any]:
    """七政四余确定性标记：命主/身主、命宫落座、主要星曜强弱、重要相位。

    输出（短事实）：
      - ming_zhu / shen_zhu: 命主/身主（shenZhu 若存在才给）
      - ming_gong: {palace, sign_branch}（十二宫首宫即命宫）
      - key_stars: ["星名·庙旺标记·宫名·逆行", ...]（最多 5 条，庙/旺/陷或落命宫者优先）
      - key_aspects: ["星1相位星2（紧密度）", ...]（最多 3 条，按紧密度排序）
    段缺失/为空 → 返回 {}。
    """
    qizheng = chart.get("qizheng") or {}
    if not qizheng:
        return {}

    result: dict[str, Any] = {}

    ming_zhu = qizheng.get("mingZhu", "")
    shen_zhu = qizheng.get("shenZhu", "")
    if ming_zhu:
        result["ming_zhu"] = ming_zhu
    if shen_zhu:
        result["shen_zhu"] = shen_zhu

    twelve = qizheng.get("twelvePalaces")
    if isinstance(twelve, list) and twelve and isinstance(twelve[0], dict):
        result["ming_gong"] = {
            "palace": twelve[0].get("palace", ""),
            "sign_branch": twelve[0].get("signBranch", ""),
        }

    # 星曜强弱：庙/旺/陷标记，或落命宫的星，优先；最多 5 条
    stars = qizheng.get("stars")
    key_stars: list[str] = []
    if isinstance(stars, list):
        seen: set[str] = set()
        for s in stars:
            if not isinstance(s, dict):
                continue
            name = s.get("name", "")
            if not name or name in seen:
                continue
            dignity = str(s.get("dignity", "") or "")
            notable = any(k in dignity for k in _QIZHENG_STRONG) or any(
                k in dignity for k in _QIZHENG_WEAK
            )
            in_ming = s.get("palace") == "命宫"
            if not (notable or in_ming):
                continue
            parts = [name]
            if dignity and dignity not in ("—", "平"):
                parts.append(dignity)
            if s.get("retrograde"):
                parts.append("逆行")
            if s.get("palace"):
                parts.append(s["palace"])
            key_stars.append("·".join(parts))
            seen.add(name)
            if len(key_stars) >= 5:
                break
    result["key_stars"] = key_stars

    # 重要相位：按紧密度（紧密 < 中等 < 宽松）排序取前 3，保持原顺序兜底
    aspects = qizheng.get("aspects")
    key_aspects: list[str] = []
    if isinstance(aspects, list):
        rank = {"紧密": 0, "中等": 1, "宽松": 2}
        ordered = sorted(
            (a for a in aspects if isinstance(a, dict)),
            key=lambda a: rank.get(a.get("closeness", ""), 3),
        )
        for a in ordered[:3]:
            key_aspects.append(
                f"{a.get('star1', '')}{a.get('type', '')}{a.get('star2', '')}"
                f"（{a.get('closeness', '')}）"
            )
    result["key_aspects"] = key_aspects

    return result


# --------------------------------------------------------------------------- #
# 奇门遁甲（终身盘）标记
# --------------------------------------------------------------------------- #

# 用神 markerType：命主相关的干支条目（年/月/日/时干支 + 天禽寄宫携干）
_QIMEN_YONG_SHEN_TYPES = (
    "yearStem",
    "yearBranch",
    "monthStem",
    "monthBranch",
    "dayStem",
    "dayBranch",
    "hourStem",
    "hourBranch",
    "companionStem",
)


def _qimen_markers(chart: dict[str, Any]) -> dict[str, Any]:
    """奇门终身盘确定性标记：值符/值使落宫、用神年命落宫、特殊格局、空亡、局数。

    输出（短事实）：
      - zhi_fu / zhi_shi: {star|door, palace}（落宫取自 personalMarkers）
      - yong_shen: [{markerType, value, palaceName, layer}, ...]（最多 6 条）
      - patterns: ["格局名(吉/凶)", ...]（classicPatterns + patternTags + specialConditions，最多 6 条）
      - void: {branches: [...], palaces: [...]}（空亡）
      - ju: "阳遁N局" / "阴遁N局"
    段缺失/为空 → 返回 {}。
    """
    qimen = chart.get("qimen_lifetime") or {}
    base = qimen.get("baseChart")
    if not isinstance(base, dict) or not base:
        return {}

    result: dict[str, Any] = {}

    # 值符/值使落宫：personalMarkers 里的 zhiFuStar / zhiShiDoor 条目带 palaceName
    markers_list = qimen.get("personalMarkers")
    zhi_fu_palace = ""
    zhi_shi_palace = ""
    if isinstance(markers_list, list):
        for m in markers_list:
            if not isinstance(m, dict):
                continue
            mtype = m.get("markerType")
            if mtype == "zhiFuStar" and m.get("palaceName"):
                zhi_fu_palace = m["palaceName"]
            elif mtype == "zhiShiDoor" and m.get("palaceName"):
                zhi_shi_palace = m["palaceName"]

    zhi_fu = base.get("zhiFu", "")
    if zhi_fu:
        result["zhi_fu"] = {"star": zhi_fu, "palace": zhi_fu_palace}
    zhi_shi = base.get("zhiShi", "")
    if zhi_shi:
        result["zhi_shi"] = {"door": zhi_shi, "palace": zhi_shi_palace}

    # 用神年命落宫（命主相关 markerType，最多 6 条）
    yong_shen: list[dict] = []
    if isinstance(markers_list, list):
        for m in markers_list:
            if not isinstance(m, dict):
                continue
            if m.get("markerType") not in _QIMEN_YONG_SHEN_TYPES:
                continue
            yong_shen.append(
                {
                    "markerType": m.get("markerType", ""),
                    "value": m.get("value", ""),
                    "palaceName": m.get("palaceName", ""),
                    "layer": m.get("layer", ""),
                }
            )
            if len(yong_shen) >= 6:
                break
    if yong_shen:
        result["yong_shen"] = yong_shen

    # 特殊格局：经典格局（名+吉/凶）→ patternTags → specialConditions，最多 6 条
    patterns: list[str] = []
    classic = base.get("classicPatterns")
    if isinstance(classic, list):
        for cp in classic:
            if not isinstance(cp, dict):
                continue
            name = cp.get("name", "")
            if not name:
                continue
            good_bad = "吉" if cp.get("type") == "good" else "凶"
            patterns.append(f"{name}({good_bad})")
            if len(patterns) >= 4:
                break
    tags = base.get("patternTags")
    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, str) and t:
                patterns.append(t)
            if len(patterns) >= 6:
                break
    special = base.get("specialConditions")
    if isinstance(special, dict):
        cond_names = {
            "isLiuJiaHour": "六甲时",
            "isLiuGuiHour": "六癸时",
            "isShiGanRuMu": "时干入墓",
            "isWuBuYuShi": "五不遇时",
        }
        for key, cn in cond_names.items():
            if special.get(key):
                patterns.append(cn)
        if special.get("description"):
            patterns.append(str(special["description"]))
    if patterns:
        result["patterns"] = patterns[:6]

    # 空亡：空亡地支 + 空亡宫名
    void: dict[str, list] = {}
    vb = base.get("voidBranches")
    if isinstance(vb, list) and vb:
        void["branches"] = [b for b in vb if isinstance(b, str)]
    vp = base.get("voidPalaces")
    if isinstance(vp, list) and vp:
        void["palaces"] = [
            p.get("name", "") for p in vp if isinstance(p, dict) and p.get("name")
        ]
    if void:
        result["void"] = void

    # 局数：阳遁/阴遁 + 局数
    is_yang = base.get("isYangDun")
    ju_shu = base.get("juShu")
    if ju_shu is not None:
        result["ju"] = f"{'阳' if is_yang else '阴'}遁{ju_shu}局"

    return result


# --------------------------------------------------------------------------- #
# 五运六气标记
# --------------------------------------------------------------------------- #

def _wuyun_year_summary(year_block: dict) -> dict:
    """单个年份块（birth_year / current_year）→ 短标记。"""
    out: dict[str, str] = {}
    input_ = year_block.get("input") or {}
    if input_.get("yearGanZhi"):
        out["year_ganzhi"] = str(input_["yearGanZhi"])

    am = year_block.get("annualMovement") or {}
    if am.get("toneName"):
        # 中运五音名（如"太商"），无则退回运名（如"金运"）
        out["zhong_yun"] = str(am["toneName"])
    elif am.get("name"):
        out["zhong_yun"] = str(am["name"])
    if am.get("strength"):
        out["strength"] = str(am["strength"])

    sitian = year_block.get("sitian") or {}
    if sitian.get("name"):
        out["si_tian"] = str(sitian["name"])

    zaiquan = year_block.get("zaiquan") or {}
    if zaiquan.get("name"):
        out["zai_quan"] = str(zaiquan["name"])

    return out


def _wuyun_liuqi_markers(chart: dict[str, Any]) -> dict[str, Any]:
    """五运六气确定性标记：出生年与当前年的年干支、中运、司天、在泉。

    输出：
      - birth: {year_ganzhi, zhong_yun, strength, si_tian, zai_quan}
      - current: 同 birth
    段缺失/为空 → 返回 {}。
    """
    wuyun = chart.get("wuyun_liuqi")
    if not isinstance(wuyun, dict) or not wuyun:
        return {}

    result: dict[str, Any] = {}
    birth = wuyun.get("birth_year")
    current = wuyun.get("current_year")
    if isinstance(birth, dict) and birth:
        result["birth"] = _wuyun_year_summary(birth)
    if isinstance(current, dict) and current:
        result["current"] = _wuyun_year_summary(current)
    return result


# --------------------------------------------------------------------------- #
# 主入口：按方法分发标记
# --------------------------------------------------------------------------- #

# 各方法需要哪些标记（可按需裁剪，不给多余信息）
_METHOD_MARKERS = {
    # 八字4法：都拿完整八字标记
    "bazi-pattern": ["bazi"],
    "bazi-dayun-liunian": ["bazi"],
    "bazi-shensha-nayin": ["bazi"],
    "bazi-hunyin-caiyun": ["bazi"],
    # 非八字法（节117 扩展）：各法一个专属标记类型
    "ziwei": ["ziwei"],
    "qizheng": ["qizheng"],
    "qimen-lifetime": ["qimen"],
    "wuyun-liuqi": ["wuyun_liuqi"],
}


def mark_chart(chart: dict[str, Any], methods: list[str] | None = None) -> dict[str, dict]:
    """对完整 chart 计算各方法的预判标记。

    Args:
        chart: 完整排盘结果
        methods: 需要计算标记的方法 key 列表；None 表示计算全部已注册的

    Returns:
        {method_key: markers_dict} — 每个方法对应的标记字典
        （无标记的方法返回空 dict，调用方可忽略）
    """
    if not chart:
        return {}

    target_methods = methods or list(_METHOD_MARKERS.keys())
    result: dict[str, dict] = {}

    # 预计算（避免重复计算）
    bazi_m = None
    ziwei_m = None
    qizheng_m = None
    qimen_m = None
    wuyun_m = None

    for key in target_methods:
        marker_types = _METHOD_MARKERS.get(key, [])
        if not marker_types:
            result[key] = {}
            continue

        markers = {}
        for mtype in marker_types:
            if mtype == "bazi":
                if bazi_m is None:
                    bazi_m = _bazi_markers(chart)
                markers["bazi"] = bazi_m
            elif mtype == "ziwei":
                if ziwei_m is None:
                    ziwei_m = _ziwei_markers(chart)
                markers["ziwei"] = ziwei_m
            elif mtype == "qizheng":
                if qizheng_m is None:
                    qizheng_m = _qizheng_markers(chart)
                markers["qizheng"] = qizheng_m
            elif mtype == "qimen":
                if qimen_m is None:
                    qimen_m = _qimen_markers(chart)
                markers["qimen"] = qimen_m
            elif mtype == "wuyun_liuqi":
                if wuyun_m is None:
                    wuyun_m = _wuyun_liuqi_markers(chart)
                markers["wuyun_liuqi"] = wuyun_m

        result[key] = markers

    return result


def mark_for_method(chart: dict[str, Any], method_key: str) -> dict:
    """计算单个方法的标记（便捷函数）。"""
    return mark_chart(chart, methods=[method_key]).get(method_key, {})
