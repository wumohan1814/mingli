# -*- coding: utf-8 -*-
"""临时起卦契约测试（横向扩展 Phase B · /divination，确定性起卦免费 + LLM 断卦可选付费）。

分层覆盖（Node/LLM 转发均 mock，不真调外部）：
  1. Node 侧契约：
     - node --eval 直调 vendored generateLiuyao / generateMeihua / generateXiaoliuren /
       drawRandomSign（node 不可用则 skip），断言四法顶层结构；
     - 真实拉起 paipan-node/server.mjs（随机空闲端口），POST /divination 分发四种
       method：liuyao 手工爻 / meihua 报数 / xiaoliuren 时间课 / ssgw seed 抽签，
       各返回 200 且任意层级不含 evidenceAnalysis/prompt/timestamp 等内部字段；
       缺 method / method 未知 → 400（clientError）。
  2. Python 端点契约（TestClient + stub httpx 转发 / mock chat，不真调 Node/LLM）：
     - POST /api/divinations：鉴权 / case 归属 / 落库 + divination_cast 埋点 +
       seed 原样透传 / Node 非 200 与连接异常 → 502 / 零扣费 / method 非法 400；
     - GET /api/divinations/{id}：本人可取、跨用户 404；
     - POST /api/divinations/{id}/interpret：缓存命中零 LLM 零扣费 / 未命中走 mock
       chat + 即时扣费（ref=divination:{id}）/ 余额不足 5002 / LLMError → 502 /
       二次 interpret 命中缓存不重复扣费 / 跨用户 404。

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


def _auth_header(user_id: int) -> dict:
    from app.auth.router import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _new_user() -> int:
    """临时 analytics 库建真实 user（divinations.user_id / cases.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"div_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_case(uid: int) -> int:
    from app.database import AnalyticsSession
    from app.models import Case, CaseStatus

    session = AnalyticsSession()
    try:
        case = Case(user_id=uid, input_json={"question": "事业运势"}, status=CaseStatus.paipan_done)
        session.add(case)
        session.commit()
        session.refresh(case)
        return case.id
    finally:
        session.close()


def _attach_chart(case_id: int, chart_json: dict) -> None:
    from app.database import AnalyticsSession
    from app.models import Chart

    session = AnalyticsSession()
    try:
        session.add(Chart(case_id=case_id, chart_json=chart_json, degraded_methods=[]))
        session.commit()
    finally:
        session.close()


def _make_divination(uid: int, *, case_id=None, method="liuyao", interpretation=None) -> int:
    """直插一行 divinations（绕过 API，供 GET/interpret 用例准备数据）。"""
    from app.database import AnalyticsSession
    from app.models import Divination

    session = AnalyticsSession()
    try:
        row = Divination(
            user_id=uid,
            case_id=case_id,
            method=method,
            seed_json={"customDate": "2024-05-12T08:30:00+08:00",
                       "options": {"method": "manual", "yaos": [6, 7, 8, 9, 7, 8]}},
            result_json={"originalName": "雷天大壮", "changedName": "火天大有",
                         "yaoArray": [6, 7, 8, 9, 7, 8]},
            interpretation_json=interpretation,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _divination_row(div_id: int):
    from app.database import AnalyticsSession
    from app.models import Divination

    session = AnalyticsSession()
    try:
        return session.query(Divination).filter_by(id=div_id).first()
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


def _fake_node_post(monkeypatch, *, status=200, payload=None, exc=None, calls=None):
    """stub app.api.divination.httpx.post（不真调 Node），可配置响应/异常并记录调用。"""
    import app.api.divination as divination_mod

    def fake_post(url, json=None, timeout=None):
        if calls is not None:
            calls.append({"url": url, "json": dict(json or {}), "timeout": timeout})
        if exc is not None:
            raise exc
        return _FakeNodeResponse(status, payload)

    monkeypatch.setattr(divination_mod.httpx, "post", fake_post)


def _fake_chat(monkeypatch, calls, *, content="断卦解读（mock）：卦象倾向向好，行动宜缓进。", tokens=1234, exc=None):
    """stub app.api.divination.chat（不真调 LLM），记录 messages / json_mode。"""
    import app.api.divination as divination_mod

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

    monkeypatch.setattr(divination_mod, "chat", fake_chat)


def _cast(client, uid: int, *, method="liuyao", case_id=None, seed=None,
          monkeypatch=None, status=200, payload=None, exc=None, calls=None):
    """走真实 POST /api/divinations（httpx 已 stub）；返回 (resp, forward_calls)。"""
    _fake_node_post(monkeypatch, status=status, payload=payload, exc=exc, calls=calls)
    body = {"method": method}
    if case_id is not None:
        body["case_id"] = case_id
    if seed is not None:
        body["seed"] = seed
    resp = client.post("/api/divinations", json=body, headers=_auth_header(uid))
    return resp


# Node /divination stripInternal 后的输出样例（liuyao 手工爻，无内部字段）
SAMPLE_LIUYAO_DATA = {
    "originalName": "雷天大壮",
    "changedName": "火天大有",
    "interName": "乾为天",
    "yaoArray": [6, 7, 8, 9, 7, 8],
    "changingYaos": [{"position": 1, "isChanging": True, "type": "老阴"},
                     {"position": 4, "isChanging": True, "type": "老阳"}],
    "palace": {"name": "坤", "wuxing": "土"},
    "palaceStage": "四世",
    "ganzhi": {"year": "甲辰", "month": "丁卯", "day": "丙申", "hour": "戊子"},
    "generation": {"method": "manual"},
}


# ------------------------------------------------------------ Node 侧 ----
@pytest.fixture(scope="module")
def divination_node_server():
    """真实拉起常驻排盘 server.mjs（随机端口），测完即终止。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过 /divination Node 端点契约测试")
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


def test_divination_raw_functions_contract():
    """vendored 四起卦函数 raw 契约：各自顶层结构齐全（node 直调，不依赖 HTTP）。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过起卦原函数契约测试")
    script = (
        "import { generateLiuyao } from './vendor/mingyu-core/dist/divination/algorithms/liuyao.js';\n"
        "import { generateMeihua } from './vendor/mingyu-core/dist/divination/algorithms/meihua/index.js';\n"
        "import { generateXiaoliuren } from './vendor/mingyu-core/dist/divination/algorithms/xiaoliuren.js';\n"
        "import { drawRandomSign } from './vendor/mingyu-core/dist/divination/algorithms/ssgw.js';\n"
        "const liuyao = generateLiuyao(new Date('2024-05-12T08:30:00+08:00'),\n"
        "  { method: 'manual', yaos: [6,7,8,9,7,8] });\n"
        "const meihua = generateMeihua(new Date('2024-05-12T08:30:00+08:00'), { method: 'number', number: 123 });\n"
        "const xiaoliuren = generateXiaoliuren({ customDate: new Date('2024-05-12T08:30:00+08:00') });\n"
        "const ssgw = drawRandomSign(new Date('2024-05-12T08:30:00+08:00'), { seed: 'ssgw-test-1' });\n"
        "console.log(JSON.stringify({\n"
        "  liuyao: { originalName: liuyao.originalName, changedName: liuyao.changedName,\n"
        "    yaoArray: liuyao.yaoArray, hasPalace: !!liuyao.palace,\n"
        "    changingCount: (liuyao.changingYaos || []).length, generation: liuyao.generation },\n"
        "  meihua: { originalName: meihua.originalName, changedName: meihua.changedName,\n"
        "    tiGua: meihua.tiGua, hasAnalysis: !!meihua.analysis,\n"
        "    hasEvidenceAnalysis: 'evidenceAnalysis' in meihua },\n"
        "  xiaoliuren: { primary: xiaoliuren.primary, palaceCount: (xiaoliuren.palaceOrder || []).length,\n"
        "    hasSequence: !!xiaoliuren.sequence, hasCalculation: !!xiaoliuren.calculation },\n"
        "  ssgw: { number: ssgw.number, title: ssgw.title, hasPoem: !!ssgw.poem,\n"
        "    draw: ssgw.draw } }));\n"
    )
    proc = subprocess.run(
        [NODE_BIN, "--input-type=module", "--eval", script],
        cwd=str(NODE_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=90,
    )
    assert proc.returncode == 0, f"node 直调起卦函数失败: {proc.stderr}"
    out = json.loads(proc.stdout.strip())

    # liuyao：主变互卦 + 六爻爻值 + 宫位 + 动爻（手工爻 6/7/8/9 值逐字保留）
    ly = out["liuyao"]
    assert ly["originalName"] and ly["changedName"]
    assert ly["yaoArray"] == [6, 7, 8, 9, 7, 8]
    assert ly["hasPalace"] is True
    assert ly["changingCount"] == 2            # 6、9 为动爻
    assert ly["generation"]["method"] == "manual"

    # meihua：主变卦 + 体用卦（动爻所在经卦为用）
    mh = out["meihua"]
    assert mh["originalName"] and mh["changedName"]
    assert mh["tiGua"] and mh["tiGua"]["name"]
    assert mh["hasAnalysis"] is True
    assert mh["hasEvidenceAnalysis"] is True    # raw 剥离前确实存在 → 端点需 strip

    # xiaoliuren：六宫课式，主落宫 + 月日时 sequence + 歌诀库
    xlr = out["xiaoliuren"]
    assert xlr["primary"] and xlr["primary"]["name"] in ("大安", "留连", "速喜", "赤口", "小吉", "空亡")
    assert xlr["palaceCount"] == 6
    assert xlr["hasSequence"] is True
    assert xlr["hasCalculation"] is True

    # ssgw：签号/签题/签诗 + 抽签 draw 信息（seed 确定性）
    sg = out["ssgw"]
    assert isinstance(sg["number"], int) and sg["number"] >= 1
    assert sg["title"]
    assert sg["hasPoem"] is True
    assert sg["draw"]["method"] == "random"
    assert sg["draw"]["selectedNumber"] == sg["number"]


def test_divination_node_endpoint_dispatch_and_strip(divination_node_server):
    """POST /divination：四种 method 正确分发且任意层级无内部字段。"""
    cases = [
        # liuyao：手工爻（确定性）
        ("liuyao",
         {"method": "liuyao", "customDate": "2024-05-12T08:30:00+08:00",
          "options": {"method": "manual", "yaos": [6, 7, 8, 9, 7, 8]}},
         lambda d: (d["originalName"] and d["changedName"]
                    and d["yaoArray"] == [6, 7, 8, 9, 7, 8]
                    and d["generation"]["method"] == "manual")),
        # meihua：报数起卦（settings 即报数）
        ("meihua",
         {"method": "meihua", "customDate": "2024-05-12T08:30:00+08:00",
          "settings": {"method": "number", "number": 123}},
         lambda d: (d["originalName"] and d["changedName"]
                    and d["tiGua"]["name"] and d["analysis"]["tiYongRelation"])),
        # xiaoliuren：时间起课（params，customDate 走字符串转换）
        ("xiaoliuren",
         {"method": "xiaoliuren",
          "params": {"customDate": "2024-05-12T08:30:00+08:00"}},
         lambda d: (d["primary"]["name"] in ("大安", "留连", "速喜", "赤口", "小吉", "空亡")
                    and len(d["palaceOrder"]) == 6 and d["sequence"]["month"]["name"])),
        # ssgw：seed 确定性抽签（options）
        ("ssgw",
         {"method": "ssgw", "options": {"seed": "ssgw-test-1"}},
         lambda d: (isinstance(d["number"], int) and d["number"] >= 1
                    and d["title"] and d["draw"]["selectedNumber"] == d["number"])),
    ]
    for method, body, check in cases:
        resp = httpx.post(f"{divination_node_server}/divination", json=body, timeout=15)
        assert resp.status_code == 200, f"{method}: {resp.text}"
        data = resp.json()
        assert isinstance(data, dict), f"{method}: 返回非对象"
        assert check(data), f"{method}: 结构断言失败: {str(data)[:400]}"
        # stripInternal 契约：任意层级无 evidenceAnalysis/prompt/timestamp 等
        assert "evidenceAnalysis" not in data
        assert "prompt" not in data
        assert "timestamp" not in data
        _assert_no_internal_keys(data)


def test_divination_node_endpoint_bad_input_400(divination_node_server):
    """POST /divination：缺 method / method 未知 → 400（clientError）。"""
    # 缺 method → 400
    resp = httpx.post(f"{divination_node_server}/divination", json={}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "method" in resp.json().get("error", "")
    # method 未知 → 400
    resp = httpx.post(f"{divination_node_server}/divination",
                      json={"method": "tarot"}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "Unknown divination method" in resp.json().get("error", "")
    # customDate 无效 → 400（客户端错误而非 500）
    resp = httpx.post(f"{divination_node_server}/divination",
                      json={"method": "liuyao", "customDate": "not-a-date"}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "customDate" in resp.json().get("error", "")


# ------------------------------------------------------------ Python 端点 ----
@pytest.fixture(scope="module")
def divination_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表/拉起 Node）；httpx 与 chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def test_api_divination_cast_success(divination_client, monkeypatch):
    """鉴权通过 + Node 200 → code:0 + 落库（seed/result/method/case 关联）+ divination_cast 埋点。"""
    uid = _new_user()
    cid = _new_case(uid)
    seed = {"customDate": "2024-05-12T08:30:00+08:00",
            "options": {"method": "manual", "yaos": [6, 7, 8, 9, 7, 8]}}
    calls: list = []
    resp = _cast(divination_client, uid, method="liuyao", case_id=cid, seed=seed,
                 monkeypatch=monkeypatch, payload=SAMPLE_LIUYAO_DATA, calls=calls)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert isinstance(data["id"], int) and data["id"] > 0
    assert data["method"] == "liuyao"
    assert data["result"] == SAMPLE_LIUYAO_DATA

    # 转发契约：URL 指向 /divination，payload = {method} + seed 原样透传，timeout=60
    assert len(calls) == 1
    assert calls[0]["url"].endswith("/divination")
    assert calls[0]["json"] == {"method": "liuyao", **seed}
    assert calls[0]["timeout"] == 60

    # 落库：divinations 一行，seed_json / result_json / case 关联完整
    row = _divination_row(data["id"])
    assert row is not None
    assert row.user_id == uid and row.case_id == cid and row.method == "liuyao"
    assert row.seed_json == seed
    assert row.result_json == SAMPLE_LIUYAO_DATA
    assert row.interpretation_json is None

    # 埋点：恰好 1 条 divination_cast
    rows = _event_rows("divination_cast", uid)
    assert len(rows) == 1
    assert rows[0].case_id == cid
    assert rows[0].props == {"method": "liuyao"}

    # 起卦免费：零积分流水
    assert _credit_rows(uid) == []


def test_api_divination_cast_without_case_id(divination_client, monkeypatch):
    """case_id 可空：MVP 允许空（前端拦截），后端照常起卦落库。"""
    uid = _new_user()
    calls: list = []
    resp = _cast(divination_client, uid, method="ssgw", seed={"options": {"seed": "x-1"}},
                 monkeypatch=monkeypatch, payload=SAMPLE_LIUYAO_DATA, calls=calls)
    assert resp.status_code == 200, resp.text
    assert resp.json()["code"] == 0
    row = _divination_row(resp.json()["data"]["id"])
    assert row.case_id is None and row.method == "ssgw"
    assert _event_rows("divination_cast", uid)[0].props == {"method": "ssgw"}


def test_api_divination_cast_foreign_case_404(divination_client, monkeypatch):
    """case_id 非空但属于他人 → 404，不触达 Node。"""
    owner = _new_user()
    other = _new_user()
    cid = _new_case(owner)
    calls: list = []
    resp = _cast(divination_client, other, method="liuyao", case_id=cid,
                 monkeypatch=monkeypatch, payload=SAMPLE_LIUYAO_DATA, calls=calls)
    assert resp.status_code == 404, resp.text
    assert calls == []                     # case 归属校验在转发前
    assert _event_rows("divination_cast", other) == []


def test_api_divination_cast_requires_auth(divination_client, monkeypatch):
    """无 Authorization → 400 参数校验；非 Bearer / 非法令牌 → 401。"""
    _fake_node_post(monkeypatch, payload=SAMPLE_LIUYAO_DATA)
    body = {"method": "liuyao"}
    # 完全缺头：FastAPI Header(...) 必填校验 → 400
    resp = divination_client.post("/api/divinations", json=body)
    assert resp.status_code == 400
    # 非 Bearer 前缀 → 401
    resp = divination_client.post("/api/divinations", json=body,
                                  headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    # Bearer 但令牌非法 → 401
    resp = divination_client.post("/api/divinations", json=body,
                                  headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_api_divination_cast_bad_method_400(divination_client, monkeypatch):
    """method 非支持方法（lenormand 于 Phase C 起为支持方法，改测 tarot 走独立 /tarot 端点）
    → 400 参数错误（pydantic 提前拦截，不触达 Node）。"""
    uid = _new_user()
    calls: list = []
    _fake_node_post(monkeypatch, payload=SAMPLE_LIUYAO_DATA, calls=calls)
    resp = divination_client.post(
        "/api/divinations",
        json={"method": "tarot", "seed": {"options": {}}},
        headers=_auth_header(uid),
    )
    assert resp.status_code == 400, resp.text
    assert calls == []
    assert _event_rows("divination_cast", uid) == []


def test_api_divination_cast_node_error_502(divination_client, monkeypatch):
    """Node 非 200 / 连接异常 → 502 网关错误，不埋点、不落库、不扣费。"""
    uid = _new_user()
    # 非 200
    resp = _cast(divination_client, uid, monkeypatch=monkeypatch, status=500,
                 payload={"error": "起卦失败"})
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    # 连接异常
    resp = _cast(divination_client, uid, monkeypatch=monkeypatch,
                 exc=httpx.ConnectError("connection refused"))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]

    assert _event_rows("divination_cast", uid) == []
    assert _credit_rows(uid) == []


def test_api_divination_get_single_and_isolation(divination_client, monkeypatch):
    """GET 单条：本人可取（只读零 LLM）；跨用户 404。"""
    uid = _new_user()
    other = _new_user()
    div_id = _make_divination(uid, interpretation={"content": "预置断卦"})

    # 本人：code:0，data 含 id/method/result/interpretation
    resp = divination_client.get(f"/api/divinations/{div_id}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["id"] == div_id
    assert data["method"] == "liuyao"
    assert data["result"]["originalName"] == "雷天大壮"
    assert data["interpretation"] == {"content": "预置断卦"}

    # 跨用户 → 404
    resp = divination_client.get(f"/api/divinations/{div_id}", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text

    # 不存在 → 404
    resp = divination_client.get("/api/divinations/999999", headers=_auth_header(uid))
    assert resp.status_code == 404


def test_api_divination_interpret_cache_hit_zero_cost(divination_client, monkeypatch):
    """interpret 缓存命中：interpretation_json 非空 → 直接返回，零 LLM 零扣费。"""
    uid = _new_user()
    div_id = _make_divination(uid, interpretation={"content": "已有断卦（缓存）"})
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == "已有断卦（缓存）"
    assert chat_calls == []                # LLM 未被调用
    assert _credit_rows(uid) == []         # 零扣费


def test_api_divination_interpret_miss_charges_and_caches(divination_client, monkeypatch):
    """interpret 未命中：mock chat 断卦 → 即时扣费（ref=divination:{id}）→ 缓存；
    二次 interpret 命中缓存不重复调 LLM / 不重复扣费。"""
    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    div_id = _make_divination(uid)
    content = "断卦解读（mock）：卦象倾向向好，行动宜缓进。"
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, content=content, tokens=1234)

    # 第一次：走 LLM
    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1

    # messages 契约：system = 断卦 prompt；user = {method, result, chart_summary}
    msg = chat_calls[0]["messages"]
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "断卦" in msg[0]["content"]                 # 读取了 prompts/interpret/divination.md
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["method"] == "liuyao"
    assert user_payload["result"]["originalName"] == "雷天大壮"
    assert user_payload["chart_summary"] is None       # 无关联 case → chart_summary None

    # 即时扣费：consume 流水 ref=divination:{id}，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].type == "consume"
    assert txs[0].ref == f"divination:{div_id}"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 断卦已缓存
    row = _divination_row(div_id)
    assert row.interpretation_json == {"content": content}

    # 断卦埋点
    evs = _event_rows("divination_interpret", uid)
    assert len(evs) == 1
    assert evs[0].props == {"method": "liuyao", "divination_id": div_id}

    # 第二次：命中缓存 → 零 LLM、零新增流水
    resp2 = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                   headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert len(_consume_rows(uid)) == 1


def test_api_divination_interpret_injects_chart_summary(divination_client, monkeypatch, chart_snapshot):
    """interpret 关联已排盘 case 时注入 chart 摘要；未排盘 case → chart_summary None。"""
    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    # case 有 chart → 注入摘要
    cid = _new_case(uid)
    _attach_chart(cid, chart_snapshot)
    div_id = _make_divination(uid, case_id=cid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)
    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    payload = json.loads(chat_calls[0]["messages"][1]["content"])
    summary = payload["chart_summary"]
    assert summary["dayMaster"] == (chart_snapshot.get("bazi") or {}).get("day_master")
    assert summary["pillars"] == (chart_snapshot.get("bazi") or {}).get("pillars")
    assert summary["degraded_methods"] == (chart_snapshot.get("meta") or {}).get("degraded_methods")

    # case 无 chart（未排盘）→ chart_summary None（不抛错）
    cid2 = _new_case(uid)
    div_id2 = _make_divination(uid, case_id=cid2)
    chat_calls2: list = []
    _fake_chat(monkeypatch, chat_calls2)
    resp2 = divination_client.post(f"/api/divinations/{div_id2}/interpret",
                                   headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    payload2 = json.loads(chat_calls2[0]["messages"][1]["content"])
    assert payload2["chart_summary"] is None


def test_api_divination_interpret_insufficient_balance(divination_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    uid = _new_user()          # 未充值，balance=0
    div_id = _make_divination(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "积分不足" in body["message"]
    assert chat_calls == []                # 预检拦截，未调 LLM
    assert _credit_rows(uid) == []


def test_api_divination_interpret_llm_error_502(divination_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不落缓存、不扣费。"""
    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")
    div_id = _make_divination(uid)

    from app.llm import LLMError
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls, exc=LLMError("mock LLM 不可用"))

    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(chat_calls) == 1
    assert _consume_rows(uid) == []        # LLM 未成功 → 不扣费
    assert _divination_row(div_id).interpretation_json is None  # 未缓存


def test_api_divination_interpret_isolation_404(divination_client, monkeypatch):
    """跨用户 interpret → 404（隔离在计费/LLM 之前）。"""
    uid = _new_user()
    other = _new_user()
    div_id = _make_divination(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, chat_calls)

    resp = divination_client.post(f"/api/divinations/{div_id}/interpret",
                                  headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    assert chat_calls == []
    assert _credit_rows(other) == []
