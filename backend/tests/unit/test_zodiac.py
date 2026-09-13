# -*- coding: utf-8 -*-
"""生肖流年契约测试（横向扩展 Phase A · /zodiac，纯确定性、零 LLM 零扣费）。

分层覆盖（均不 mock 时间）：
  1. Node 侧原函数契约：node 直调 vendored calculateZodiacYearFortune({鼠, 2026})，
     raw 结果含 conflicts / yearGanZhi / noble / relation / actionSignals 等结构，
     且带 evidenceAnalysis / prompt 内部字段（证明“剥离前确实存在”，与第 2 条互证）。
     node 不可用则 skip。
  2. Node 端点契约：真实拉起 paipan-node/server.mjs（随机空闲端口），POST /zodiac
     验证 stripInternal 后任意层级不含 evidenceAnalysis / prompt 等内部字段；
     缺 zodiac → 400（clientError）。
  3. Python 端点契约：TestClient + stub 掉 httpx 转发（不真调 Node）验证
     POST /api/zodiac/fortune —— 鉴权 401 / 参数 400 / 成功 code:0 + data 透传 +
     zodiac_fortune 埋点落 ops 库 / Node 非 200 与连接异常 → 502 / 不产生扣费流水。

注意：vendored getZodiacYearFortune 的返回顶层是 {zodiac, zodiacBranch, yearGanZhi,
yearBranch, relation, elementRelation, noble, meeting, conflicts, evidenceGrade,
interpretationBoundary, favorableRelations, riskRelations, actionSignals}，本身并无
taiSui 顶层键（值年太岁星君名只出现在 prompt 文本里）；server.mjs 在 stripInternal 后
单独经 getYearTaiSui(yearGanZhi) 取回并入响应，故 /zodiac 端点契约顶层含
taiSui:{yearBranch, star}，契约断言落在 conflicts / yearGanZhi / yearBranch / taiSui 上。

生肖流年不落盘面、不扣余额：本文件不做 chart / credit 增量断言，正是该契约。
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
from datetime import date
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


def _wait_ready(proc, port, timeout=20):
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


# ------------------------------------------------------------ Node 侧 ----
@pytest.fixture(scope="module")
def zodiac_node_server():
    """真实拉起常驻排盘 server.mjs（随机端口），测完即终止。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过 /zodiac Node 端点契约测试")
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


def test_zodiac_raw_function_contract():
    """节156 后：自研内核 calculateZodiacYearFortuneCore raw 契约：conflicts/yearGanZhi
    等排盘字段齐全，产物干净（无 evidenceAnalysis/prompt 内部字段）。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过生肖流年原函数契约测试")
    script = (
        "import { calculateZodiacYearFortuneCore } from './paipan-core/src/capabilities/zodiac/index.js';\n"
        "const r = calculateZodiacYearFortuneCore({ zodiac: '鼠', year: 2026 });\n"
        "console.log(JSON.stringify({ zodiac: r.zodiac, zodiacBranch: r.zodiacBranch,\n"
        "  yearGanZhi: r.yearGanZhi, yearBranch: r.yearBranch, noble: r.noble,\n"
        "  relation: r.relation, elementRelation: r.elementRelation, meeting: r.meeting,\n"
        "  conflicts: r.conflicts, actionSignals: r.actionSignals,\n"
        "  favorableRelations: r.favorableRelations, riskRelations: r.riskRelations,\n"
        "  evidenceGrade: r.evidenceGrade, interpretationBoundary: r.interpretationBoundary,\n"
        "  keys: Object.keys(r),\n"
        "  hasEvidenceAnalysis: 'evidenceAnalysis' in r, hasPrompt: 'prompt' in r }));\n"
    )
    proc = subprocess.run(
        [NODE_BIN, "--input-type=module", "--eval", script],
        cwd=str(NODE_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )
    assert proc.returncode == 0, f"node 直调 zodiac 失败: {proc.stderr}"
    out = json.loads(proc.stdout.strip())

    # 结构契约（排盘字段与旧实现逐字段一致——对拍 3672/3672）
    assert out["zodiac"] == "鼠"
    assert out["zodiacBranch"] == "子"
    assert out["yearGanZhi"] == "丙午"      # 2026 = 丙午
    assert out["yearBranch"] == "午"
    # 子午不合（无六合丑 / 三合申子辰命中）→ noble 回落固定串「三合：猴、龙；六合：牛」
    # （与旧实现 BUG-003 修复后的回填文本一致，对拍字段级相等）
    assert out["noble"] == "三合：猴、龙；六合：牛"
    assert out["meeting"] is None
    assert out["relation"] == "生肖地支本气克年干五行"
    assert isinstance(out["conflicts"], list) and out["conflicts"]
    assert [c["type"] for c in out["conflicts"]] == ["冲太岁"]  # 子午相冲
    assert isinstance(out["actionSignals"], list) and out["actionSignals"]
    assert isinstance(out["favorableRelations"], list)
    assert isinstance(out["riskRelations"], list)
    # 文案字段（自撰，与旧实现不同属预期）
    assert out["evidenceGrade"] == "简版关系核验"
    assert out["interpretationBoundary"] == "仅覆盖生肖年支与流年干支的固定关系"
    # 顶层 17 键（含 zodiacWuxing + relationCopy + nobleDetail；无 evidenceAnalysis/prompt）
    assert len(out["keys"]) == 17
    assert "zodiacWuxing" in out["keys"]
    assert "relationCopy" in out["keys"]
    assert "nobleDetail" in out["keys"]
    # 节156：自研内核产物干净（stripInternal 幂等）
    assert out["hasEvidenceAnalysis"] is False
    assert out["hasPrompt"] is False


def test_zodiac_node_endpoint_strips_internal(zodiac_node_server):
    """POST /zodiac：200 返回可解释结构，任意层级不含 evidenceAnalysis/prompt。"""
    resp = httpx.post(f"{zodiac_node_server}/zodiac",
                      json={"zodiac": "鼠", "year": 2026}, timeout=15)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["zodiac"] == "鼠"
    assert data["zodiacBranch"] == "子"
    assert data["yearGanZhi"] == "丙午"
    assert data["yearBranch"] == "午"
    # BUG-003 修复后：noble 由 vendor B2 回填（非 None），端点原样透传
    assert data["noble"] == "三合：猴、龙；六合：牛"
    assert [c["type"] for c in data["conflicts"]] == ["冲太岁"]
    assert data["relation"]
    assert isinstance(data["actionSignals"], list) and data["actionSignals"]
    # taiSui 补齐契约：stripInternal 后经 getYearTaiSui 补回顶层 {yearBranch, star}
    assert data["taiSui"] == {"yearBranch": "午", "star": "文哲"}  # 2026 丙午 → 值年太岁文哲
    # stripInternal 契约：顶层无内部键，且递归任意层级均无
    assert "evidenceAnalysis" not in data
    assert "prompt" not in data
    _assert_no_internal_keys(data)


def test_zodiac_node_endpoint_missing_zodiac_400(zodiac_node_server):
    """POST /zodiac 缺 zodiac → 400（clientError，与 /ziwei 必填校验风格一致）。"""
    resp = httpx.post(f"{zodiac_node_server}/zodiac", json={"year": 2026}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "zodiac" in resp.json().get("error", "")


# ------------------------------------------------------------ Python 端点 ----
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


# Node /zodiac stripInternal 后的输出形状（与 test_zodiac_node_endpoint_* 同源：
# 顶层含 taiSui:{yearBranch, star}，无 evidenceAnalysis/prompt 等内部字段）
SAMPLE_ZODIAC_DATA = {
    "zodiac": "鼠",
    "zodiacBranch": "子",
    "yearGanZhi": "丙午",
    "yearBranch": "午",
    "taiSui": {"yearBranch": "午", "star": "文哲"},
    "relation": "生肖地支本气克年干五行",
    "elementRelation": {
        "kind": "生肖克年干",
        "label": "生肖地支本气克年干五行",
        "classification": "中性关系",
        "yearStemWuxing": "火",
        "zodiacWuxing": "水",
    },
    "noble": None,
    "meeting": None,
    "conflicts": [{"type": "冲太岁", "with": "午", "desc": "岁冲，变动和对立感容易增加，适合预留调整空间。"}],
    "evidenceGrade": "轻量",
    "interpretationBoundary": "仅限生肖与流年关系",
    "favorableRelations": [],
    "riskRelations": ["冲太岁：岁冲，变动和对立感容易增加，适合预留调整空间。"],
    "actionSignals": ["重大变动前预留备选方案"],
}


def _patch_node_post(monkeypatch, *, status=200, payload=None, exc=None, calls=None):
    """stub app.api.zodiac.httpx.post（不真调 Node），可配置响应/异常并记录调用。"""
    import app.api.zodiac as zodiac_mod

    def fake_post(url, json=None, timeout=None):
        if calls is not None:
            calls.append({"url": url, "json": dict(json or {}), "timeout": timeout})
        if exc is not None:
            raise exc
        return _FakeNodeResponse(status, payload)

    monkeypatch.setattr(zodiac_mod.httpx, "post", fake_post)


@pytest.fixture()
def zodiac_client(monkeypatch, orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 会拉起/终止常驻 Node 服务，
    与 e2e 用例同口径）；httpx 转发由各用例自行 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _event_rows(user_id: int):
    """返回该用户 zodiac_fortune 埋点行（ops 临时库）。"""
    from app.database import OpsSession
    from app.models.ops import Event

    session = OpsSession()
    try:
        return session.query(Event).filter_by(
            event_name="zodiac_fortune", user_id=user_id
        ).all()
    finally:
        session.close()


def test_api_zodiac_fortune_success(zodiac_client, monkeypatch):
    """鉴权通过 + Node 200 → code:0 + data 原样透传 + zodiac_fortune 埋点 1 条。"""
    uid = 900001
    calls: list = []
    _patch_node_post(monkeypatch, payload=SAMPLE_ZODIAC_DATA, calls=calls)

    resp = zodiac_client.post(
        "/api/zodiac/fortune",
        json={"zodiac": "鼠", "year": 2026},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["message"] == "ok"
    assert body["data"] == SAMPLE_ZODIAC_DATA
    assert body["data"]["conflicts"][0]["type"] == "冲太岁"
    assert body["data"]["taiSui"]["star"] == "文哲"  # 值年星君随响应透传
    assert "evidenceAnalysis" not in body["data"]
    assert "prompt" not in body["data"]

    # 转发契约：URL 指向 /zodiac，payload 原样透传，timeout=60
    assert len(calls) == 1
    assert calls[0]["url"].endswith("/zodiac")
    assert calls[0]["json"] == {"zodiac": "鼠", "year": 2026}
    assert calls[0]["timeout"] == 60

    # 埋点：恰好 1 条，props 记录生肖与年份
    rows = _event_rows(uid)
    assert len(rows) == 1
    assert rows[0].props == {"zodiac": "鼠", "year": 2026}


def test_api_zodiac_fortune_default_year(zodiac_client, monkeypatch):
    """year 缺省 → 转发当前公历年份（default_factory 动态取值，不 mock 时间）。"""
    uid = 900002
    calls: list = []
    _patch_node_post(monkeypatch, payload=SAMPLE_ZODIAC_DATA, calls=calls)

    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "牛"}, headers=_auth_header(uid)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["code"] == 0
    assert calls[0]["json"] == {"zodiac": "牛", "year": date.today().year}


def test_api_zodiac_fortune_requires_auth(zodiac_client, monkeypatch):
    """无 Authorization → 400 参数校验；非法/非 Bearer 令牌 → 401。"""
    _patch_node_post(monkeypatch, payload=SAMPLE_ZODIAC_DATA)
    # 完全缺头：FastAPI Header(...) 必填校验 → 400（请求参数错误）
    resp = zodiac_client.post("/api/zodiac/fortune", json={"zodiac": "鼠", "year": 2026})
    assert resp.status_code == 400
    # 非 Bearer 前缀 → get_user_id_from_token 抛 401
    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "鼠", "year": 2026},
        headers={"Authorization": "Token abc"},
    )
    assert resp.status_code == 401
    # Bearer 但令牌非法 → verify_access_token 抛 401
    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "鼠", "year": 2026},
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


def test_api_zodiac_fortune_bad_body(zodiac_client, monkeypatch):
    """缺 zodiac / 空 zodiac / year 越界 → 400 参数错误（不触达 Node）。"""
    _patch_node_post(monkeypatch, payload=SAMPLE_ZODIAC_DATA)
    for bad in ({"year": 2026}, {"zodiac": "", "year": 2026}, {"zodiac": "鼠", "year": 1800}):
        resp = zodiac_client.post(
            "/api/zodiac/fortune", json=bad, headers=_auth_header(910001)
        )
        assert resp.status_code == 400, f"body={bad} resp={resp.text}"


def test_api_zodiac_fortune_node_error_502(zodiac_client, monkeypatch):
    """Node 非 200 → 502 网关错误、消息友好、不埋点、不返回假成功。"""
    uid = 900004
    _patch_node_post(monkeypatch, status=500, payload={"error": "流年干支无效"})
    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "鼠", "year": 2026}, headers=_auth_header(uid)
    )
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert _event_rows(uid) == []


def test_api_zodiac_fortune_connection_error_502(zodiac_client, monkeypatch):
    """Node 连接失败/超时（httpx 抛异常）→ 502，与 engine.py 降级风格一致。"""
    uid = 900005
    _patch_node_post(monkeypatch, exc=httpx.ConnectError("connection refused"))
    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "鼠", "year": 2026}, headers=_auth_header(uid)
    )
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert _event_rows(uid) == []


def test_api_zodiac_fortune_never_charges(zodiac_client, monkeypatch):
    """契约：生肖流年不扣余额 —— 调用后该用户无任何 CreditTransaction 流水。"""
    uid = 900006
    _patch_node_post(monkeypatch, payload=SAMPLE_ZODIAC_DATA)
    resp = zodiac_client.post(
        "/api/zodiac/fortune", json={"zodiac": "虎", "year": 2026}, headers=_auth_header(uid)
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == 0

    from app.database import AnalyticsSession
    from app.models import CreditTransaction

    session = AnalyticsSession()
    try:
        rows = session.query(CreditTransaction).filter_by(user_id=uid).all()
    finally:
        session.close()
    assert rows == []


def test_event_name_zh_has_zodiac_mapping():
    """EVENT_NAME_ZH 已收录 zodiac_fortune（Phase A–D 11 个事件里生肖流年在列）。"""
    from app.admin.router import EVENT_NAME_ZH

    assert EVENT_NAME_ZH["zodiac_fortune"] == "生肖流年"
    phase_a_d = [
        "guoxue_hub_view", "xishi_hub_view", "zodiac_fortune",
        "divination_cast", "divination_interpret", "tarot_draw",
        "tarot_interpret", "lenormand_draw", "astrology_chart",
        "astrology_interpret", "mbti_score",
    ]
    assert all(name in EVENT_NAME_ZH for name in phase_a_d)
