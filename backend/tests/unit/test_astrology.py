# -*- coding: utf-8 -*-
"""星座星盘契约测试（横向扩展 Phase D1 · /astrology）。

分层覆盖（Node/LLM 转发均 mock，不真调外部）：
  1. Node 侧契约：
     - node --eval 直调 vendored generateAstrolabe + buildAstrolabeFullScopeContexts
       （node 不可用则 skip），断言 natal 顶层结构 + fullScope（natal/yearly/monthly/daily）
       形状 + 剥离前 evidenceAnalysis 存在；
     - 真实拉起 paipan-node/server.mjs（随机空闲端口），POST /astrology：
       scope 缺省 natal 仅返回 {natal}；scope=yearly 返回 {natal, fullScope} 且任意层级
       不含 evidenceAnalysis/prompt/timestamp 等内部字段；缺经纬度/缺 year → 400。
  2. Python 端点契约（TestClient + stub httpx 转发 / mock chat，不真调 Node/LLM）：
     - POST /api/astrology/chart：body {case_id, scope?, date_str?}；鉴权 / 参数校验
       （缺 case_id、scope 非法、date_str 格式）→ 400；case 不存在或非本人 → 404；
       档案缺经纬度 → 400 / 落库带 case_id + astrology_chart 埋点（props 含 case_id）+
       转发契约（生辰扁平化取自 case.input_json、timeout=120、dateStr 透传）/
       Node 非 200 与连接异常 → 502 / 零扣费；
     - GET /api/astrology/charts/{id}：本人可取、跨用户 404；
     - POST /api/astrology/charts/{id}/interpret：缓存命中零 LLM 零扣费 / 未命中走
       mock chat + 即时扣费（ref=astrology:{id}）/ 余额不足 5002 / LLMError → 502 /
       二次 interpret 命中缓存不重复扣费 / 跨用户 404；
     - 法达（app.paipan.firdaria）查表：日盘/夜盘主限序列、75 年总年限、主星顺序、
       窗口截取、is_daytime 简化判定。

依赖 conftest 的会话级临时库（orchestration_env）——任何用例都不触碰真实
backend/data/*.db。
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

NODE_DIR = BACKEND_DIR / "paipan-node"
NODE_BIN = shutil.which("node")

# 与 server.mjs stripInternal() 保持一致的内部字段清单
INTERNAL_KEYS = {
    "evidenceAnalysis", "calculationContext", "positionSources", "prompt",
    "calculationChain", "sources", "timestamp",
}

pytestmark = pytest.mark.usefixtures("orchestration_env")


# ------------------------------------------------------------ 工具 ----
def _assert_no_internal_keys(node, path="root"):
    """递归断言任意层级都不含引擎内部字段（stripInternal 契约）。"""
    if isinstance(node, dict):
        for k, v in node.items():
            assert k not in INTERNAL_KEYS, f"{path}.{k} 未剥离"
            _assert_no_internal_keys(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, item in enumerate(node):
            _assert_no_internal_keys(item, f"{path}[{i}]")


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(proc, port, timeout=30):
    """轮询端口直到 server.mjs 可连接；进程提前退出 / 超时则带上输出抛错。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            out, err = proc.communicate(timeout=5)
            raise RuntimeError(f"server.mjs 提前退出 rc={proc.returncode} out={out!r} err={err!r}")
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.25)
    proc.terminate()
    out, err = proc.communicate(timeout=5)
    raise RuntimeError(f"server.mjs 启动超时 out={out!r} err={err!r}")


def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    """临时 analytics 库建真实 user（astrology_readings.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"ast_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int, **overrides) -> int:
    """直插一个 case（绕过 API）：input_json 即建档生辰，chart 端点从此读取生辰。"""
    from app.database import AnalyticsSession
    from app.models import Case

    inp = {
        "birth_year": 1990,
        "birth_month": 5,
        "birth_day": 12,
        "birth_hour": 10,
        "gender": "male",
        "birthplace": "",
        "longitude": 121.5,
        "latitude": 31.2,
        "true_solar_time": False,
        "question": "事业运势",
    }
    inp.update(overrides)
    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, input_json=inp)
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _new_reading(uid: int, *, scope="natal", chart=None, reading=None) -> int:
    """直插一行 astrology_readings（绕过 API，供 GET/interpret 用例准备数据）。"""
    from app.database import AnalyticsSession
    from app.models import AstrologyReading

    session = AnalyticsSession()
    try:
        row = AstrologyReading(
            user_id=uid,
            chart_json=chart if chart is not None else SAMPLE_ASTROLOGY_CHART,
            scope=scope,
            reading_json=reading,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _reading_row(reading_id: int):
    from app.database import AnalyticsSession
    from app.models import AstrologyReading

    session = AnalyticsSession()
    try:
        return session.query(AstrologyReading).filter_by(id=reading_id).first()
    finally:
        session.close()


def _event_rows(event_name: str, user_id: int):
    from app.database import OpsSession
    from app.models.ops import Event

    session = OpsSession()
    try:
        return session.query(Event).filter_by(event_name=event_name, user_id=user_id).all()
    finally:
        session.close()


def _credit_rows(user_id: int):
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return session.query(CreditTransaction).filter_by(user_id=user_id).all()
    finally:
        session.close()


def _consume_rows(user_id: int):
    """仅取该用户 type=consume 的扣费流水（不计入 recharge 的 free 入账行）。"""
    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        return (session.query(CreditTransaction)
                .filter_by(user_id=user_id, type="consume").all())
    finally:
        session.close()


class _FakeNodeResponse:
    def __init__(self, status: int, payload):
        self.status_code = status
        self._payload = payload

    @property
    def text(self) -> str:
        return (json.dumps(self._payload, ensure_ascii=False)
                if not isinstance(self._payload, str) else self._payload)

    def json(self):
        return self._payload


def _fake_node_post(monkeypatch, mod, *, status=200, payload=None, exc=None, calls=None):
    """stub 指定 API 模块的 httpx.post（不真调 Node），可配置响应/异常并记录调用。"""
    def fake_post(url, json=None, timeout=None):
        if calls is not None:
            calls.append({"url": url, "json": dict(json or {}), "timeout": timeout})
        if exc is not None:
            raise exc
        return _FakeNodeResponse(status, payload)

    monkeypatch.setattr(mod.httpx, "post", fake_post)


def _fake_chat(monkeypatch, mod, calls, *, content="星座解读（mock）：整体气质外向坚韧，宜在关系中练习表达。", tokens=1234, exc=None):
    """stub 指定 API 模块的 chat（不真调 LLM），记录 messages / json_mode。"""
    async def fake_chat(messages, json_mode=False):
        calls.append({"messages": messages, "json_mode": json_mode})
        if exc is not None:
            raise exc
        return {
            "content": content,
            "usage": {"prompt_tokens": 900, "completion_tokens": tokens - 900,
                      "total_tokens": tokens},
            "model": "mock-model",
        }

    monkeypatch.setattr(mod, "chat", fake_chat)


# Node 引擎输出样例（/astrology，均为 stripInternal 后的形态）
SAMPLE_ASTROLOGY_CHART = {
    "natal": {
        "birth": {"dateTime": "1990-05-12 10:30", "standardDateTime": "1990-05-12 10:30",
                  "location": "上海（31.2000, 121.5000）", "timezone": 8, "gender": "male"},
        "planets": [
            {"name": "Sun", "label": "太阳", "sign": "金牛座", "house": 10,
             "formatted": "金牛座21°07′", "retrograde": False, "dignityLabel": "曜升"},
            {"name": "Moon", "label": "月亮", "sign": "天秤座", "house": 4,
             "formatted": "天秤座2°15′", "retrograde": False},
            {"name": "Mercury", "label": "水星", "sign": "双子座", "house": 11,
             "formatted": "双子座5°33′", "retrograde": False},
            {"name": "Venus", "label": "金星", "sign": "白羊座", "house": 9,
             "formatted": "白羊座20°11′", "retrograde": False},
            {"name": "Mars", "label": "火星", "sign": "巨蟹座", "house": 12,
             "formatted": "巨蟹座1°40′", "retrograde": False},
            {"name": "Jupiter", "label": "木星", "sign": "摩羯座", "house": 6,
             "formatted": "摩羯座18°22′", "retrograde": False},
            {"name": "Saturn", "label": "土星", "sign": "摩羯座", "house": 7,
             "formatted": "摩羯座24°05′", "retrograde": False},
            {"name": "Uranus", "label": "天王星", "sign": "摩羯座", "house": 7,
             "formatted": "摩羯座11°40′", "retrograde": False},
            {"name": "Neptune", "label": "海王星", "sign": "摩羯座", "house": 7,
             "formatted": "摩羯座15°20′", "retrograde": False},
            {"name": "Pluto", "label": "冥王星", "sign": "天蝎座", "house": 4,
             "formatted": "天蝎座16°50′", "retrograde": False},
            {"name": "North Node", "label": "北交点", "sign": "双鱼座", "house": 8,
             "formatted": "双鱼座10°10′", "retrograde": False},
        ],
        "angles": [
            {"name": "Ascendant", "label": "上升", "sign": "狮子座", "house": 0,
             "formatted": "狮子座7°46′"},
            {"name": "Midheaven", "label": "天顶", "sign": "白羊座", "house": 0,
             "formatted": "白羊座0°00′"},
        ],
        "aspects": [
            {"body1": "金星", "body2": "木星", "type": "刑相", "symbol": "□",
             "exactAngle": 90, "actualAngle": 89.9521, "orb": 0.05, "allowedOrb": 7,
             "closeness": "紧密", "normalizedOrbRatio": 0.0068, "isOutOfSign": False,
             "applying": False},
            {"body1": "太阳", "body2": "冥王星", "type": "六合", "symbol": "⚹",
             "exactAngle": 60, "actualAngle": 58.2, "orb": 1.8, "allowedOrb": 6,
             "closeness": "中等", "normalizedOrbRatio": 0.3, "isOutOfSign": False,
             "applying": True},
        ],
        "summary": {
            "elements": {"火": ["火星"], "土": ["土星", "天王星", "海王星"],
                         "风": ["月亮", "水星"], "水": ["金星", "冥王星"]},
            "modalities": {"开创": ["太阳", "金星"], "固定": ["月亮", "冥王星"],
                           "变动": ["水星", "火星", "土星", "天王星", "海王星"]},
            "retrograde": ["冥王星"],
            "patterns": ["提桶型"],
        },
    },
    "fullScope": {
        "natal": {"scope": "natal", "dateStr": "", "displayText": "仅使用本命信息",
                  "displayLabel": "本命盘", "promptText": "分析对象：本命盘。"},
        "yearly": {"scope": "yearly", "dateStr": "2026", "displayText": "流年 · 2026",
                   "displayLabel": "流年2026",
                   "promptText": "分析对象：流年2026。\n行运取样：2026-07-01 12:00（UTC+8）。"},
        "monthly": {"scope": "monthly", "dateStr": "2026-06", "displayText": "流月 · 2026-06",
                    "displayLabel": "流月2026-06",
                    "promptText": "分析对象：流月2026-06。\n行运取样：2026-06-15 12:00（UTC+8）。"},
        "daily": {"scope": "daily", "dateStr": "2026-06-01", "displayText": "流日 · 2026-06-01",
                  "displayLabel": "流日2026-06-01",
                  "promptText": "分析对象：流日2026-06-01。\n行运取样：2026-06-01 12:00（UTC+8）。"},
    },
}


# ------------------------------------------------------------ Node 侧 ----
@pytest.fixture(scope="module")
def astrology_node_server():
    """真实拉起常驻排盘 server.mjs（随机端口），测完即终止。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过 /astrology Node 端点契约测试")
    port = _free_port()
    env = dict(os.environ, PAIPAN_NODE_PORT=str(port))
    proc = subprocess.Popen(
        [NODE_BIN, "server.mjs"],
        cwd=str(NODE_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    try:
        _wait_ready(proc, port)
        yield f"http://127.0.0.1:{port}"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


def test_astrology_raw_functions_contract():
    """节151 后：自研内核 generateAstrolabeCore / buildAstrolabeFullScopeContextsCore raw 契约。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过占星原函数契约测试")
    script = (
        "import { generateAstrolabeCore, buildAstrolabeFullScopeContextsCore } from './paipan-core/src/capabilities/astrology/index.js';\n"
        "const natal = generateAstrolabeCore({\n"
        "  name: '契约测试', gender: 'male', locationName: '上海',\n"
        "  year: '1990', month: '5', day: '12', hour: '10', minute: '30',\n"
        "  latitude: '31.2', longitude: '121.5', timezone: '8',\n"
        "  useTrueSolarTime: false });\n"
        "const fc = buildAstrolabeFullScopeContextsCore(natal, '2026-06-01');\n"
        "console.log(JSON.stringify({\n"
        "  natalKeys: Object.keys(natal),\n"
        "  planetNames: natal.planets.map(p => p.name),\n"
        "  angleNames: natal.angles.map(a => a.name),\n"
        "  aspectCount: natal.aspects.length,\n"
        "  houseCount: natal.houses.length,\n"
        "  standardDateTime: natal.birth.standardDateTime,\n"
        "  hasEvidenceAnalysis: 'evidenceAnalysis' in natal,\n"
        "  fullScopeKeys: Object.keys(fc),\n"
        "  yearly: { scope: fc.yearly.scope, dateStr: fc.yearly.dateStr,\n"
        "    promptStart: (fc.yearly.promptText || '').slice(0, 12) },\n"
        "  monthlyDate: fc.monthly.dateStr, dailyDate: fc.daily.dateStr }));\n"
    )
    proc = subprocess.run(
        [NODE_BIN, "--input-type=module", "--eval", script],
        cwd=str(NODE_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    assert proc.returncode == 0, f"node 直调占星函数失败: {proc.stderr}"
    out = json.loads(proc.stdout.strip())

    # natal：行星/四轴/宫位/相位/摘要齐备；节151 自研内核产物干净（无 evidenceAnalysis）
    assert "birth" in out["natalKeys"] and "planets" in out["natalKeys"]
    assert "angles" in out["natalKeys"] and "houses" in out["natalKeys"]
    assert "aspects" in out["natalKeys"] and "summary" in out["natalKeys"]
    assert out["planetNames"][0] == "Sun"
    assert "Ascendant" in out["angleNames"]
    assert out["aspectCount"] >= 1
    assert out["houseCount"] == 12
    assert out["standardDateTime"] == "1990-05-12 10:30"
    assert out["hasEvidenceAnalysis"] is False

    # fullScope：natal + yearly + monthly + daily，各 scope 有正确的日期粒度
    assert out["fullScopeKeys"] == ["natal", "yearly", "monthly", "daily"]
    assert out["yearly"]["scope"] == "yearly"
    assert out["yearly"]["dateStr"] == "2026"
    assert out["yearly"]["promptStart"].startswith("分析对象")
    assert out["monthlyDate"] == "2026-06"
    assert out["dailyDate"] == "2026-06-01"


def test_astrology_node_endpoint_dispatch_and_strip(astrology_node_server):
    """POST /astrology：缺省 scope=natal 仅 {natal}；scope=yearly 返回 {natal, fullScope}；
    两分支均无内部字段；缺经纬度/缺 year → 400。"""
    base = astrology_node_server
    # ① 缺省 scope（natal）：仅返回 natal
    resp = httpx.post(f"{base}/astrology",
                      json={"year": 1990, "month": 5, "day": 12, "hour": 10,
                            "minute": 30, "longitude": 121.5, "latitude": 31.2},
                      timeout=60)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert set(data.keys()) == {"natal"}
    assert "evidenceAnalysis" not in data["natal"] and "timestamp" not in data["natal"]
    assert data["natal"]["birth"]["standardDateTime"] == "1990-05-12 10:30"
    assert len(data["natal"]["planets"]) >= 10 and len(data["natal"]["houses"]) == 12
    _assert_no_internal_keys(data)

    # ② scope=yearly + dateStr：natal + fullScope（natal/yearly/monthly/daily）
    resp = httpx.post(f"{base}/astrology",
                      json={"year": 1990, "month": 5, "day": 12, "hour": 10,
                            "minute": 30, "longitude": 121.5, "latitude": 31.2,
                            "scope": "yearly", "dateStr": "2026-06-01"},
                      timeout=90)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert set(data.keys()) == {"natal", "fullScope"}
    assert set(data["fullScope"].keys()) == {"natal", "yearly", "monthly", "daily"}
    assert data["fullScope"]["yearly"]["scope"] == "yearly"
    assert data["fullScope"]["daily"]["dateStr"] == "2026-06-01"
    _assert_no_internal_keys(data)

    # ③ 参数错误：缺经纬度 → 400；缺 year → 400（均非 500）
    resp = httpx.post(f"{base}/astrology",
                      json={"year": 1990, "month": 5, "day": 12, "hour": 10}, timeout=60)
    assert resp.status_code == 400, resp.text
    assert "longitude/latitude" in resp.json().get("error", "")
    resp = httpx.post(f"{base}/astrology",
                      json={"longitude": 121.5, "latitude": 31.2}, timeout=60)
    assert resp.status_code == 400, resp.text
    assert "year" in resp.json().get("error", "")


# ------------------------------------------------------------ Python 端点 ----
@pytest.fixture(scope="module")
def astrology_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表/拉起 Node）；httpx 与 chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def test_api_astrology_chart_success(astrology_client, monkeypatch):
    """鉴权通过 + Node 200 → code:0 + 落库（case_id/chart_json/scope）+ astrology_chart 埋点 + 零扣费。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    cid = _new_case(uid, birthplace="上海")
    calls: list = []
    _fake_node_post(monkeypatch, astro_mod, payload=SAMPLE_ASTROLOGY_CHART, calls=calls)

    resp = astrology_client.post("/api/astrology/chart",
                                 json={"case_id": cid},
                                 headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert isinstance(data["id"], int) and data["id"] > 0
    assert data["scope"] == "natal"
    assert data["chart"] == SAMPLE_ASTROLOGY_CHART

    # 转发契约：URL /astrology，payload 为档案生辰扁平化（minute 恒 0），timeout=120
    assert len(calls) == 1
    assert calls[0]["url"].endswith("/astrology")
    assert calls[0]["timeout"] == 120
    payload = calls[0]["json"]
    assert payload["year"] == 1990 and payload["month"] == 5 and payload["day"] == 12
    assert payload["hour"] == 10 and payload["minute"] == 0
    assert payload["gender"] == "male" and payload["birthplace"] == "上海"
    assert payload["longitude"] == 121.5 and payload["latitude"] == 31.2
    assert payload["true_solar"] is False
    assert payload["scope"] == "natal" and payload["dateStr"] is None

    # 落库：astrology_readings 一行，case_id/chart_json/scope 完整
    row = _reading_row(data["id"])
    assert row is not None
    assert row.user_id == uid and row.case_id == cid and row.scope == "natal"
    assert row.chart_json == SAMPLE_ASTROLOGY_CHART
    assert row.reading_json is None

    # 埋点 + 零扣费
    rows = _event_rows("astrology_chart", uid)
    assert len(rows) == 1
    assert rows[0].props == {"scope": "natal", "case_id": cid}
    assert _credit_rows(uid) == []


def test_api_astrology_chart_idempotent_reuse(astrology_client, monkeypatch):
    """REQ-039 幂等复用：同一 (user, case, scope) 二次 POST → 返回既有 reading id，
    不再转发 Node（calls 仍 1 次）、不落新行、不重复埋点；scope 不同则各自独立生成。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    cid = _new_case(uid, birthplace="上海")
    calls: list = []
    _fake_node_post(monkeypatch, astro_mod, payload=SAMPLE_ASTROLOGY_CHART, calls=calls)
    auth = _auth_header(uid)

    # 首次生成 → id1；Node 转发 1 次
    r1 = astrology_client.post("/api/astrology/chart", json={"case_id": cid}, headers=auth)
    assert r1.status_code == 200, r1.text
    id1 = r1.json()["data"]["id"]
    assert len(calls) == 1

    # 同 (case, scope) 再入 → 幂等返回 id1，Node 不再转发（calls 仍 1 次）
    r2 = astrology_client.post("/api/astrology/chart", json={"case_id": cid}, headers=auth)
    assert r2.status_code == 200, r2.text
    assert r2.json()["data"]["id"] == id1
    assert r2.json()["data"]["chart"] == SAMPLE_ASTROLOGY_CHART
    assert len(calls) == 1, "幂等命中不应再次转发 Node"

    # 落库仅一行；埋点仅 1 条（不重复写）
    from app.database import AnalyticsSession
    from app.models import AstrologyReading

    session = AnalyticsSession()
    try:
        rows = (session.query(AstrologyReading)
                .filter_by(user_id=uid, case_id=cid).all())
    finally:
        session.close()
    assert [row.id for row in rows] == [id1]
    assert len(_event_rows("astrology_chart", uid)) == 1

    # 不同 scope（yearly）→ 独立生成新行（幂等键含 scope），Node 再转发 1 次
    r3 = astrology_client.post("/api/astrology/chart",
                               json={"case_id": cid, "scope": "yearly",
                                     "date_str": "2026-06-01"},
                               headers=auth)
    assert r3.status_code == 200, r3.text
    id3 = r3.json()["data"]["id"]
    assert id3 != id1
    assert len(calls) == 2
    # 同 scope 再入依然幂等
    r4 = astrology_client.post("/api/astrology/chart",
                               json={"case_id": cid, "scope": "yearly",
                                     "date_str": "2026-06-01"},
                               headers=auth)
    assert r4.json()["data"]["id"] == id3
    assert len(calls) == 2


def test_api_astrology_chart_delete(astrology_client, monkeypatch):
    """REQ-054 DELETE /astrology/charts/{id}：本人删除 → 行消失（再 GET 404）；
    跨用户/不存在 → 404；零扣费零埋点。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    other = _new_user()
    cid = _new_case(uid, birthplace="上海")
    calls: list = []
    _fake_node_post(monkeypatch, astro_mod, payload=SAMPLE_ASTROLOGY_CHART, calls=calls)
    auth = _auth_header(uid)

    r = astrology_client.post("/api/astrology/chart", json={"case_id": cid}, headers=auth)
    rid = r.json()["data"]["id"]

    # 他人删除 → 404（隔离）
    r = astrology_client.delete(f"/api/astrology/charts/{rid}", headers=_auth_header(other))
    assert r.status_code == 404, r.text
    # 本人删除 → 200 deleted
    r = astrology_client.delete(f"/api/astrology/charts/{rid}", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"deleted": True, "id": rid}
    # 已删除 → 再 GET/再删 → 404；行确实消失
    r = astrology_client.get(f"/api/astrology/charts/{rid}", headers=auth)
    assert r.status_code == 404
    r = astrology_client.delete(f"/api/astrology/charts/{rid}", headers=auth)
    assert r.status_code == 404
    assert _reading_row(rid) is None
    # 零扣费；埋点 = 首次生成时的 1 条 astrology_chart（删除端点本身不写埋点）
    assert _credit_rows(uid) == []
    assert len(_event_rows("astrology_chart", uid)) == 1


def test_api_astrology_chart_non_natal_fullscope(astrology_client, monkeypatch):
    """scope != natal：date_str 透传为 dateStr，落库 scope 原值；返回 chart 含 fullScope。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    cid = _new_case(uid)
    calls: list = []
    _fake_node_post(monkeypatch, astro_mod, payload=SAMPLE_ASTROLOGY_CHART, calls=calls)

    resp = astrology_client.post("/api/astrology/chart",
                                 json={"case_id": cid, "scope": "yearly",
                                       "date_str": "2026-06-01"},
                                 headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["scope"] == "yearly"
    assert "fullScope" in data["chart"]
    assert calls[0]["json"]["scope"] == "yearly"
    assert calls[0]["json"]["dateStr"] == "2026-06-01"
    assert _reading_row(data["id"]).scope == "yearly"
    assert _event_rows("astrology_chart", uid)[0].props == {"scope": "yearly", "case_id": cid}


def test_api_astrology_chart_validation_and_isolation(astrology_client, monkeypatch):
    """参数/归属校验：缺鉴权 / 缺 case_id / scope 非法 / date_str 格式错 → 400；
    case 不存在或非本人 → 404；档案缺经纬度 → 400（且不触达 Node、不埋点、零扣费）。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    other = _new_user()
    cid = _new_case(uid)                                          # 带经纬度的本人档案
    other_cid = _new_case(other)                                  # 他人档案
    no_geo_cid = _new_case(uid, longitude=None, latitude=None)    # 本人但缺经纬度
    calls: list = []
    _fake_node_post(monkeypatch, astro_mod, payload=SAMPLE_ASTROLOGY_CHART, calls=calls)
    auth = _auth_header(uid)

    # 完全缺 Authorization 头 → 400
    resp = astrology_client.post("/api/astrology/chart", json={"case_id": cid})
    assert resp.status_code == 400
    # 非 Bearer / 非法令牌 → 401
    resp = astrology_client.post("/api/astrology/chart", json={"case_id": cid},
                                 headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    # 缺 case_id（必填）→ 400 参数错误
    resp = astrology_client.post("/api/astrology/chart", json={}, headers=auth)
    assert resp.status_code == 400, resp.text
    # case 不存在 → 404
    resp = astrology_client.post("/api/astrology/chart", json={"case_id": 999999},
                                 headers=auth)
    assert resp.status_code == 404, resp.text
    # case 非本人 → 404（归属隔离在 Node 转发之前）
    resp = astrology_client.post("/api/astrology/chart", json={"case_id": other_cid},
                                 headers=auth)
    assert resp.status_code == 404, resp.text
    # 档案未提供经纬度 → 400（引擎必填，推算上升/宫位）
    resp = astrology_client.post("/api/astrology/chart", json={"case_id": no_geo_cid},
                                 headers=auth)
    assert resp.status_code == 400, resp.text
    assert "该档案未提供经纬度，无法生成星座盘" in resp.json()["message"]
    # scope 非法（非开放盘型）→ 400
    resp = astrology_client.post("/api/astrology/chart",
                                 json={"case_id": cid, "scope": "celtic"}, headers=auth)
    assert resp.status_code == 400, resp.text
    # 非 natal 且 date_str 非 YYYY-MM-DD → 400
    resp = astrology_client.post("/api/astrology/chart",
                                 json={"case_id": cid, "scope": "yearly",
                                       "date_str": "2026-6-1"}, headers=auth)
    assert resp.status_code == 400, resp.text

    assert calls == []                          # 全程未触达 Node
    assert _event_rows("astrology_chart", uid) == []
    assert _credit_rows(uid) == []


def test_api_astrology_chart_node_error_502(astrology_client, monkeypatch):
    """Node 非 200 / 连接异常 → 502 网关错误，不埋点、不落库、不扣费。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    cid = _new_case(uid)
    body = {"case_id": cid}
    # 非 200
    _fake_node_post(monkeypatch, astro_mod, status=500, payload={"error": "星盘失败"})
    resp = astrology_client.post("/api/astrology/chart", json=body, headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    # 连接异常
    _fake_node_post(monkeypatch, astro_mod, exc=httpx.ConnectError("connection refused"))
    resp = astrology_client.post("/api/astrology/chart", json=body, headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]

    assert _event_rows("astrology_chart", uid) == []
    assert _credit_rows(uid) == []
    from app.database import AnalyticsSession
    from app.models import AstrologyReading
    session = AnalyticsSession()
    try:
        assert session.query(AstrologyReading).filter_by(user_id=uid).count() == 0
    finally:
        session.close()


def test_api_astrology_get_single_and_isolation(astrology_client, monkeypatch):
    """GET 单条：本人可取（只读零 LLM）；跨用户 / 不存在 404。"""
    uid = _new_user()
    other = _new_user()
    rid = _new_reading(uid, reading={"content": "预置解读"})

    # 本人：code:0，data 含 id/scope/chart/reading
    resp = astrology_client.get(f"/api/astrology/charts/{rid}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["id"] == rid
    assert data["scope"] == "natal"
    assert data["chart"] == SAMPLE_ASTROLOGY_CHART
    assert data["reading"] == {"content": "预置解读"}

    # 跨用户 → 404
    resp = astrology_client.get(f"/api/astrology/charts/{rid}", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text

    # 不存在 → 404
    resp = astrology_client.get("/api/astrology/charts/999999", headers=_auth_header(uid))
    assert resp.status_code == 404


def test_api_astrology_interpret_cache_hit_zero_cost(astrology_client, monkeypatch):
    """interpret 缓存命中：reading_json 非空 → 直接返回，零 LLM 零扣费。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    rid = _new_reading(uid, reading={"content": "已有解读（缓存）"})
    chat_calls: list = []
    _fake_chat(monkeypatch, astro_mod, chat_calls)

    resp = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == "已有解读（缓存）"
    assert chat_calls == []                # LLM 未被调用
    assert _credit_rows(uid) == []         # 零扣费


def test_api_astrology_interpret_miss_charges_and_caches(astrology_client, monkeypatch):
    """interpret 未命中：mock chat 解读 → 即时扣费（ref=astrology:{id}）→ 缓存；
    二次 interpret 命中缓存不重复调 LLM / 不重复扣费。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    rid = _new_reading(uid)
    content = "星座解读（mock）：整体气质外向坚韧，宜在关系中练习表达。"
    chat_calls: list = []
    _fake_chat(monkeypatch, astro_mod, chat_calls, content=content, tokens=1234)

    # 第一次：走 LLM
    resp = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1

    # messages 契约：system = 星座解读 prompt（astrology.md）；user = {chart: natal 摘要, scope}
    msg = chat_calls[0]["messages"]
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "星座" in msg[0]["content"] and "本命" in msg[0]["content"]
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["scope"] == "natal"
    chart_digest = user_payload["chart"]
    assert chart_digest["sun"]["label"] == "太阳"
    assert chart_digest["moon"]["label"] == "月亮"
    assert chart_digest["ascendant"]["label"] == "上升"
    assert any(p["label"] == "金星" for p in chart_digest["planets"])
    assert len(chart_digest["aspects"]) == 2
    assert chart_digest["birth"]["dateTime"] == "1990-05-12 10:30"

    # 即时扣费：consume 流水 ref=astrology:{id}，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].type == "consume"
    assert txs[0].ref == f"astrology:{rid}"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 解读已缓存
    row = _reading_row(rid)
    assert row.reading_json == {"content": content}

    # 解读埋点
    evs = _event_rows("astrology_interpret", uid)
    assert len(evs) == 1
    assert evs[0].props == {"scope": "natal", "astrology_reading_id": rid}

    # 第二次：命中缓存 → 零 LLM、零新增流水
    resp2 = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert len(_consume_rows(uid)) == 1


def test_api_astrology_interpret_insufficient_balance(astrology_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    import app.api.astrology as astro_mod

    uid = _new_user()          # 未充值，balance=0
    rid = _new_reading(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, astro_mod, chat_calls)

    resp = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "余额不足" in body["message"]
    assert chat_calls == []                # 预检拦截，未调 LLM
    assert _credit_rows(uid) == []


def test_api_astrology_interpret_llm_error_502(astrology_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不落缓存、不扣费。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")
    rid = _new_reading(uid)

    from app.llm import LLMError
    chat_calls: list = []
    _fake_chat(monkeypatch, astro_mod, chat_calls, exc=LLMError("mock LLM 不可用"))

    resp = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(chat_calls) == 1
    assert _consume_rows(uid) == []        # LLM 未成功 → 不扣费
    assert _reading_row(rid).reading_json is None  # 未缓存


def test_api_astrology_interpret_isolation_404(astrology_client, monkeypatch):
    """跨用户 interpret → 404（隔离在计费/LLM 之前）。"""
    import app.api.astrology as astro_mod

    uid = _new_user()
    other = _new_user()
    rid = _new_reading(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, astro_mod, chat_calls)

    resp = astrology_client.post(f"/api/astrology/charts/{rid}/interpret", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    assert chat_calls == []
    assert _credit_rows(other) == []


# ------------------------------------------------------------ 法达（firdaria）----
def test_firdaria_day_sequence():
    """日盘：首主星太阳；九主星顺序 = 太阳→金星→水星→月亮→土星→木星→火星→北交点→南交点；
    各段周岁闭区间端点正确、年限合计 75。"""
    from app.paipan.firdaria import DAY_RULERS, firdaria_timeline

    periods = firdaria_timeline(1990, is_day=True)
    assert [p["ruler"] for p in periods] == DAY_RULERS
    assert [p["ruler"] for p in periods] == [
        "太阳", "金星", "水星", "月亮", "土星", "木星", "火星", "北交点", "南交点",
    ]
    # 各段：起点承接上段终点+1（无重叠无空洞），首段 0 起
    assert periods[0]["period_start_age"] == 0
    for prev, cur in zip(periods, periods[1:]):
        assert cur["period_start_age"] == prev["period_end_age"] + 1
    # 端点：太阳 0–9、金星 10–17、水星 18–30、月亮 31–39、土星 40–50、木星 51–62、
    # 火星 63–69、北交点 70–72、南交点 73–74
    assert [p["period_end_age"] for p in periods] == [9, 17, 30, 39, 50, 62, 69, 72, 74]
    assert periods[-1]["ruler"] == "南交点"
    # 共 75 个整周岁（0–74），年限合计 75
    assert periods[-1]["period_end_age"] - periods[0]["period_start_age"] + 1 == 75


def test_firdaria_night_sequence():
    """夜盘：首主星月亮；顺序 = 月亮→土星→木星→火星→太阳→金星→水星→北交点→南交点。"""
    from app.paipan.firdaria import NIGHT_RULERS, firdaria_timeline

    periods = firdaria_timeline(1988, is_day=False)
    assert [p["ruler"] for p in periods] == NIGHT_RULERS
    assert [p["ruler"] for p in periods] == [
        "月亮", "土星", "木星", "火星", "太阳", "金星", "水星", "北交点", "南交点",
    ]
    assert periods[0]["period_start_age"] == 0
    assert periods[-1]["period_end_age"] == 74
    # 段长与固定年限一致：月亮 9、土星 11、木星 12、火星 7、太阳 10…
    assert [p["period_end_age"] - p["period_start_age"] + 1 for p in periods] == [
        9, 11, 12, 7, 10, 8, 13, 3, 2,
    ]


def test_firdaria_total_years_and_window():
    """75 年总年限 + 窗口截取（[40,75) 从土星起、[20,40) 从水星起）。"""
    from app.paipan.firdaria import firdaria_timeline

    # 完整一轮主星年限合计 75
    total = sum(p["period_end_age"] - p["period_start_age"] + 1
                for p in firdaria_timeline(1990, True))
    assert total == 75

    # 窗口 [40, 75)：土星（40–50）起、南交点收尾（40 周岁起进入土星主限）
    later = firdaria_timeline(1990, True, start_age=40, end_age=75)
    assert later[0]["ruler"] == "土星" and later[0]["period_start_age"] == 40
    assert later[-1]["ruler"] == "南交点" and later[-1]["period_end_age"] == 74

    # 窗口 [20, 40)：水星（18–30）与月亮（31–39）两整段
    mid = firdaria_timeline(1990, True, start_age=20, end_age=40)
    assert [p["ruler"] for p in mid] == ["水星", "月亮"]

    # 窗口超出一轮（75–150）：进入下一轮同序列（75 周岁起太阳新一周，金星随之）
    next_cycle = firdaria_timeline(1990, True, start_age=75, end_age=90)
    assert [p["ruler"] for p in next_cycle] == ["太阳", "金星"]
    assert next_cycle[0]["period_start_age"] == 75
    assert next_cycle[1]["period_start_age"] == 85


def test_firdaria_is_daytime():
    """MVP 简化日盘判定：hour ∈ [6, 18) 视为日盘。"""
    from app.paipan.firdaria import is_daytime

    assert is_daytime(6) is True
    assert is_daytime(12) is True
    assert is_daytime(17) is True
    assert is_daytime(18) is False
    assert is_daytime(5) is False
    assert is_daytime(23) is False
