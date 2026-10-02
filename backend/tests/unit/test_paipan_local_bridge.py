# -*- coding: utf-8 -*-
"""节166：排盘**第三条路**（APK 本机 JS 内核桥）的单元测试。

被测对象：`backend/app/paipan/engine.py::_try_local_bridge`，以及它在
`run_ziwei` / `run_extra` 里的调用位置。

验证四件事：
  1. **web / 本地自用形态完全不碰桥** —— `capabilities()['paipan_local']` 为假时直接返回 None，
     连桥模块的属性都不读一次（这是「零行为变化」的硬证据）。
  2. **apk-local 形态走桥**，并把 `/ziwei` 与正确 payload 传下去。
  3. **桥按契约失败时继续降级** —— `is_available()=False`、或返回 `{"error": ...}`，都当不可用。
  4. ⭐ **桥排在 `SCRIPT.exists()` 守卫之前** —— `backend/paipan-node/` 不进 APK，
     那两个守卫在安卓上恒为假；若桥排在守卫之后，它**永远拿不到执行机会**。
     用例 5 就是这条的回归护栏（把 SCRIPT 指到不存在的路径，桥仍须生效）。
"""
import sys
import types
from pathlib import Path

import pytest

from app.paipan import engine


class _FakeBridge:
    """最小可控的桥替身：记录调用、按需失败。"""

    def __init__(self, result=None, available=True):
        self.result = {"ok": True} if result is None else result
        self.available = available
        self.calls = []
        self.available_probes = 0
        self.init_calls = 0

    def is_available(self):
        self.available_probes += 1
        return self.available

    def init(self, *args, **kwargs):  # 幂等，签名与真桥一致
        self.init_calls += 1
        return True

    def call(self, path, payload=None, timeout_ms=60000):
        self.calls.append((path, payload))
        return self.result


@pytest.fixture
def install_bridge(monkeypatch):
    """把一个可控替身塞进 sys.modules，模拟「APK 里存在 paipan_bridge」；返回该替身。"""
    def _install(result=None, available=True):
        bridge = _FakeBridge(result=result, available=available)
        module = types.ModuleType("paipan_bridge")
        module.is_available = bridge.is_available
        module.init = bridge.init
        module.call = bridge.call
        monkeypatch.setitem(sys.modules, "paipan_bridge", module)
        return bridge
    return _install


@pytest.fixture
def as_apk_local(monkeypatch):
    """置 `capabilities()['paipan_local'] = True`（= apk-local 形态）。"""
    monkeypatch.setattr(engine, "capabilities", lambda: {"paipan_local": True})


# --------------------------------------------------------------------------- #
# 1. web 形态：完全不碰桥
# --------------------------------------------------------------------------- #

def test_web_mode_short_circuits_before_touching_bridge(monkeypatch, install_bridge):
    monkeypatch.setattr(engine, "capabilities", lambda: {"paipan_local": False})
    bridge = install_bridge()

    assert engine._try_local_bridge("/ziwei", {"a": 1}) is None
    # 关键断言：连 is_available() 都没调过 → 能力门是「短路」而不是「试了再放弃」
    assert bridge.available_probes == 0
    assert bridge.calls == []
    assert bridge.init_calls == 0


def test_missing_paipan_local_key_treated_as_absent(monkeypatch, install_bridge):
    """能力清单里没有这个键（老形态/未登记）→ 一律视为不可用，不碰桥。"""
    monkeypatch.setattr(engine, "capabilities", lambda: {})
    bridge = install_bridge()
    assert engine._try_local_bridge("/extra", {}) is None
    assert bridge.calls == []


# --------------------------------------------------------------------------- #
# 2. apk-local 形态：走桥
# --------------------------------------------------------------------------- #

def test_apk_local_calls_bridge_with_path_and_payload(as_apk_local, install_bridge):
    bridge = install_bridge(result={"ziwei": {"soul": "紫微"}})

    out = engine._try_local_bridge("/ziwei", {"birthday": "1990-05-12"})

    assert out == {"ziwei": {"soul": "紫微"}}
    assert bridge.available_probes == 1
    assert bridge.init_calls == 1          # 幂等 init 被调过一次
    assert bridge.calls == [("/ziwei", {"birthday": "1990-05-12"})]


# --------------------------------------------------------------------------- #
# 3. 桥失败 → 继续降级（返回 None，不抛）
# --------------------------------------------------------------------------- #

def test_bridge_not_available_returns_none(as_apk_local, install_bridge):
    bridge = install_bridge(available=False)
    assert engine._try_local_bridge("/ziwei", {}) is None
    assert bridge.calls == []              # 不可用就不该再 call


def test_bridge_error_dict_treated_as_unavailable(as_apk_local, install_bridge):
    """桥的契约是「失败返回 {'error': ...}，永不抛异常」——这里按契约判定。"""
    install_bridge(result={"error": "bridge_not_ready", "detail": "bundle 未注入"})
    assert engine._try_local_bridge("/ziwei", {}) is None


def test_bridge_raising_is_swallowed(as_apk_local, monkeypatch):
    """桥内部抛异常也必须化为 None（不向上冒）。"""
    def _boom(*a, **k):
        raise RuntimeError("java 桥炸了")
    module = types.ModuleType("paipan_bridge")
    module.is_available = lambda: True
    module.init = _boom
    module.call = _boom
    monkeypatch.setitem(sys.modules, "paipan_bridge", module)

    assert engine._try_local_bridge("/ziwei", {}) is None


# --------------------------------------------------------------------------- #
# 4. ⭐ 桥必须排在 SCRIPT.exists() 守卫之前（本节的关键修复点）
# --------------------------------------------------------------------------- #

def test_run_ziwei_prefers_bridge_even_when_node_script_missing(
    monkeypatch, as_apk_local, install_bridge
):
    """`backend/paipan-node/` 不进 APK → 守卫恒假；桥仍须生效。

    这是回归护栏：若将来有人把桥挪到 `if not ZIWEI_SCRIPT.exists(): return None` 之后，
    本用例立刻变红（返回 None 而不是桥结果）。
    """
    monkeypatch.setattr(engine, "ZIWEI_SCRIPT", Path("definitely/not/here/ziwei.cjs"))
    assert not engine.ZIWEI_SCRIPT.exists()          # 前提成立：守卫会判失败
    bridge = install_bridge(result={"soul": "天府", "from": "bridge"})

    out = engine.run_ziwei(1990, 5, 12, 7, "男")

    assert out == {"soul": "天府", "from": "bridge"}
    assert bridge.calls and bridge.calls[0][0] == "/ziwei"
    # payload 形状与既有实现一致（time_idx 由 hour 推出）
    assert bridge.calls[0][1] == {"birthday": "1990-05-12", "time_idx": 4, "gender": "男"}


def test_run_extra_prefers_bridge_even_when_node_script_missing(
    monkeypatch, as_apk_local, install_bridge
):
    monkeypatch.setattr(engine, "EXTRA_SCRIPT", Path("definitely/not/here/extra.mjs"))
    assert not engine.EXTRA_SCRIPT.exists()
    bridge = install_bridge(result={"western": {"sun": "金牛"}})

    out = engine.run_extra(1990, 5, 12, 7, "男", "某人", "某地", 116.4, 39.9, True)

    assert out == {"western": {"sun": "金牛"}}
    assert bridge.calls[0][0] == "/extra"
    payload = bridge.calls[0][1]
    assert payload["year"] == 1990 and payload["longitude"] == 116.4
    assert payload["true_solar"] is True
