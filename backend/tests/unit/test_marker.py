# -*- coding: utf-8 -*-
"""节117 扩展 · 确定性预判标记层单测（4 个非八字方法）。

覆盖：
  - ziwei / qizheng / qimen-lifetime / wuyun-liuqi 四法各自返回非空、结构正确的标记；
  - 八字 4 法标记回归（不因本次扩展退化）；
  - 空 chart / 缺段 chart / 类型异常的段 → 对应方法返回 {}，mark_chart 不抛异常。

chart 使用 conftest 的 chart_snapshot 会话夹具（fixtures/chart.json）。
"""
import copy

from app.paipan.marker import mark_chart, mark_for_method

# (方法 key, 标记类型 key)
NEW_METHODS = [
    ("ziwei", "ziwei"),
    ("qizheng", "qizheng"),
    ("qimen-lifetime", "qimen"),
    ("wuyun-liuqi", "wuyun_liuqi"),
]

# 方法 key → chart 顶层段名
METHOD_TO_SECTION = {
    "ziwei": "ziwei",
    "qizheng": "qizheng",
    "qimen-lifetime": "qimen_lifetime",
    "wuyun-liuqi": "wuyun_liuqi",
}

BAZI_METHODS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
]


def test_new_methods_return_nonempty_markers(chart_snapshot):
    """4 个新方法各自返回非空标记，且带对应标记类型。"""
    for method, mtype in NEW_METHODS:
        markers = mark_for_method(chart_snapshot, method)
        assert markers, f"{method} 标记不应为空"
        assert mtype in markers, f"{method} 缺少 {mtype} 类型标记"
        assert markers[mtype], f"{method} 的 {mtype} 标记内容不应为空"


def test_ziwei_markers_shape(chart_snapshot):
    m = mark_for_method(chart_snapshot, "ziwei")["ziwei"]
    assert m["five_elements_class"] == "土五局"
    life = m["life_palace"]
    assert life["name"] == "命宫"
    assert life["branch"] == "戌"
    assert life["is_empty"] is False
    assert isinstance(life["major_stars"], list)
    assert "太阴" in life["major_stars"]
    body = m["body_palace"]
    assert body["name"] == "福德"
    assert body["is_empty"] is False
    assert "巨门" in body["major_stars"]
    assert isinstance(m["sihua"], list) and len(m["sihua"]) == 4
    assert "天同化忌·官禄" in m["sihua"]
    assert "太阳化禄·迁移" in m["sihua"]


def test_qizheng_markers_shape(chart_snapshot):
    m = mark_for_method(chart_snapshot, "qizheng")["qizheng"]
    assert m["ming_zhu"] == "土"
    assert m["ming_gong"] == {"palace": "命宫", "sign_branch": "丑"}
    assert isinstance(m["key_stars"], list) and len(m["key_stars"]) >= 1
    assert isinstance(m["key_aspects"], list) and len(m["key_aspects"]) <= 3
    # 命宫落星 + 庙旺标记应进 key_stars（镇星在命宫、庙/乐）
    assert any("镇星" in s for s in m["key_stars"])


def test_qimen_markers_shape(chart_snapshot):
    m = mark_for_method(chart_snapshot, "qimen-lifetime")["qimen"]
    assert m["zhi_fu"]["star"] == "天芮"
    assert m["zhi_fu"]["palace"] == "坤二宫"
    assert m["zhi_shi"]["door"] == "死门"
    assert m["zhi_shi"]["palace"] == "巽四宫"
    assert m["ju"] == "阳遁7局"
    assert m["void"]["branches"] == ["寅", "卯"]
    assert m["void"]["palaces"] == ["艮八宫", "震三宫"]
    assert isinstance(m["yong_shen"], list) and len(m["yong_shen"]) >= 5
    required_keys = {"markerType", "value", "palaceName", "layer"}
    for entry in m["yong_shen"]:
        assert required_keys <= set(entry.keys())
    assert isinstance(m["patterns"], list) and m["patterns"]


def test_wuyun_liuqi_markers_shape(chart_snapshot):
    m = mark_for_method(chart_snapshot, "wuyun-liuqi")["wuyun_liuqi"]
    birth = m["birth"]
    assert birth["year_ganzhi"] == "庚午"
    assert birth["zhong_yun"] == "太商"
    assert birth["strength"] == "太过"
    assert birth["si_tian"] == "少阴君火"
    assert birth["zai_quan"] == "阳明燥金"
    current = m["current"]
    assert current["year_ganzhi"] == "丙午"
    assert current["zhong_yun"] == "太羽"
    assert current["zai_quan"] == "阳明燥金"


def test_bazi_methods_regression(chart_snapshot):
    """八字 4 法标记不受本次扩展影响（回归）。"""
    for method in BAZI_METHODS:
        markers = mark_for_method(chart_snapshot, method)
        assert "bazi" in markers and markers["bazi"], f"{method} 的八字标记不应为空"


def test_mark_chart_covers_all_methods(chart_snapshot):
    """mark_chart 全量计算覆盖 8 个注册方法，且都是 dict。"""
    result = mark_chart(chart_snapshot)
    assert set(result.keys()) == set(BAZI_METHODS + [m for m, _ in NEW_METHODS])
    for key, markers in result.items():
        assert isinstance(markers, dict), f"{key} 的标记应为 dict"


def test_empty_chart_returns_empty():
    """空 chart（{} / None）→ {}，不抛异常。"""
    assert mark_chart({}) == {}
    assert mark_chart(None) == {}
    for method, _ in NEW_METHODS:
        assert mark_for_method({}, method) == {}


def test_missing_section_returns_empty(chart_snapshot):
    """去掉某段 → 对应方法的标记 payload 返回 {}；mark_chart 全量仍不抛异常。"""
    for method, section in METHOD_TO_SECTION.items():
        chart = copy.deepcopy(chart_snapshot)
        chart.pop(section, None)
        # 已注册方法的返回形态是 {标记类型: payload}，缺段时 payload 为 {}
        markers = mark_for_method(chart, method)
        assert markers, f"{method} 缺段后外层仍应存在"
        assert all(payload == {} for payload in markers.values()), \
            f"{method} 缺段应返回空 payload"
        all_markers = mark_chart(chart)
        assert method in all_markers
        assert all(payload == {} for payload in all_markers[method].values())


def test_mark_chart_does_not_raise_on_malformed(chart_snapshot):
    """残缺/类型异常的段（None、错误类型）不抛异常（内部 .get 防御）。"""
    chart = copy.deepcopy(chart_snapshot)
    chart["ziwei"] = None
    chart["qizheng"] = {"stars": "not-a-list", "aspects": None}
    chart["qimen_lifetime"] = {"baseChart": None}
    chart["wuyun_liuqi"] = {}
    result = mark_chart(chart)
    assert result["ziwei"]["ziwei"] == {}
    assert result["qimen-lifetime"]["qimen"] == {}
    assert result["wuyun-liuqi"]["wuyun_liuqi"] == {}
    assert result["qizheng"]["qizheng"]["key_stars"] == []
    assert result["qizheng"]["qizheng"]["key_aspects"] == []
    # 八字段没被破坏，仍正常
    assert result["bazi-pattern"]["bazi"]
