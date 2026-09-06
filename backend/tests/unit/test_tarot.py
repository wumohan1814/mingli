# -*- coding: utf-8 -*-
"""塔罗 + 雷诺曼契约测试（横向扩展 Phase C · /tarot + /divination[lenormand]）。

分层覆盖（Node/LLM 转发均 mock，不真调外部）：
  1. Node 侧契约：
     - node --eval 直调 vendored drawTarotSpread / drawLenormandSpread（node 不可用则
       skip），断言顶层结构 + 同 seed 确定性 + 剥离前 evidenceAnalysis 存在；
     - 真实拉起 paipan-node/server.mjs（随机空闲端口），POST /tarot（single/three/
       spreadType 缺省 single）与 POST /divination lenormand（three/single）正确分发，
       各返回 200 且任意层级不含 evidenceAnalysis/prompt/timestamp 等内部字段；
       非法 spreadType（tarot / lenormand）→ 400（clientError）。
  2. Python 端点契约（TestClient + stub httpx 转发 / mock chat，不真调 Node/LLM）：
     - POST /api/tarot/draw：鉴权 / spread_type 校验 / 落库 + tarot_draw 埋点 +
       {spreadType, options} 转发契约 / Node 非 200 与连接异常 → 502 / 零扣费；
     - GET /api/tarot/readings/{id}：本人可取、跨用户 404；
     - POST /api/tarot/readings/{id}/interpret：缓存命中零 LLM 零扣费 / 未命中走 mock
       chat + 即时扣费（ref=tarot:{id}）/ 余额不足 5002 / LLMError → 502 /
       二次 interpret 命中缓存不重复扣费 / 跨用户 404；
     - POST /api/divinations（method=lenormand）：case_id 可空落库 + spreadType 透传 /
       缺省 single；interpret 走 prompts/interpret/lenormand.md（system 含雷诺曼）。

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
    """临时 analytics 库建真实 user（tarot_readings.user_id 有外键约束）。"""
    from app.database import AnalyticsSession
    from app.models import User

    session = AnalyticsSession()
    try:
        user = User(username=f"tar_ut_{uuid.uuid4().hex[:12]}", password_hash="test-only")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _new_reading(uid: int, *, spread_type="three", question="近期感情走向",
                 draw=None, interpretation=None) -> int:
    """直插一行 tarot_readings（绕过 API，供 GET/interpret 用例准备数据）。"""
    from app.database import AnalyticsSession
    from app.models import TarotReading

    session = AnalyticsSession()
    try:
        row = TarotReading(
            user_id=uid,
            spread_type=spread_type,
            question=question,
            draw_json=draw if draw is not None else SAMPLE_TAROT_DRAW,
            interpretation_json=interpretation,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id
    finally:
        session.close()


def _reading_row(reading_id: int):
    from app.database import AnalyticsSession
    from app.models import TarotReading

    session = AnalyticsSession()
    try:
        return session.query(TarotReading).filter_by(id=reading_id).first()
    finally:
        session.close()


def _make_divination(uid: int, *, method="lenormand", interpretation=None) -> int:
    """直插一行 divinations（method=lenormand，绕过 API，供 interpret 用例准备数据）。"""
    from app.database import AnalyticsSession
    from app.models import Divination

    session = AnalyticsSession()
    try:
        row = Divination(
            user_id=uid,
            case_id=None,
            method=method,
            seed_json={"spreadType": "three", "options": {"seed": "lenormand-ut-1"}},
            result_json=SAMPLE_LENORMAND_RESULT,
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


def _fake_node_post(monkeypatch, mod, *, status=200, payload=None, exc=None, calls=None):
    """stub 指定 API 模块的 httpx.post（不真调 Node），可配置响应/异常并记录调用。"""
    def fake_post(url, json=None, timeout=None):
        if calls is not None:
            calls.append({"url": url, "json": dict(json or {}), "timeout": timeout})
        if exc is not None:
            raise exc
        return _FakeNodeResponse(status, payload)

    monkeypatch.setattr(mod.httpx, "post", fake_post)


def _fake_chat(monkeypatch, mod, calls, *, content="塔罗解读（mock）：整体倾向向好，宜把握眼前机会。", tokens=1234, exc=None):
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


# Node 引擎输出样例（tarot / lenormand，均为 stripInternal 后的形态）
SAMPLE_TAROT_DRAW = {
    "spreadType": "three",
    "spreadName": "时间流牌阵",
    "cards": [
        {"id": 17, "name": "星星", "position": "过去", "reversed": False,
         "keywords": ["希望", "灵感", "指引"],
         "element": "大阿卡纳（核心课题与阶段转折）", "archetype": "大阿卡纳的人生主轴"},
        {"id": 10, "name": "命运之轮", "position": "现在", "reversed": True,
         "keywords": ["命运", "变化", "循环"],
         "element": "大阿卡纳（核心课题与阶段转折）", "archetype": "大阿卡纳的人生主轴"},
        {"id": 19, "name": "太阳", "position": "未来", "reversed": False,
         "keywords": ["成功", "喜悦", "活力"],
         "element": "大阿卡纳（核心课题与阶段转折）", "archetype": "大阿卡纳的人生主轴"},
    ],
    "draw": {"deckSize": 78, "method": "Fisher-Yates洗牌后依牌位顺序取顶牌",
             "order": [
                 {"index": 1, "position": "过去", "cardId": 17, "cardName": "星星", "orientation": "正位"},
                 {"index": 2, "position": "现在", "cardId": 10, "cardName": "命运之轮", "orientation": "逆位"},
                 {"index": 3, "position": "未来", "cardId": 19, "cardName": "太阳", "orientation": "正位"},
             ]},
}

SAMPLE_LENORMAND_RESULT = {
    "spreadType": "three",
    "spreadName": "三牌事件线",
    "cards": [
        {"id": 1, "name": "骑士", "position": "起因", "keywords": ["消息", "到来", "进展"]},
        {"id": 24, "name": "心", "position": "现状", "keywords": ["感情", "喜欢", "热情"]},
        {"id": 34, "name": "鱼", "position": "走向", "keywords": ["金钱", "流动", "资源"]},
    ],
    "combinations": [
        {"card1": "骑士", "card2": "心", "position1": "起因", "position2": "现状",
         "relation": "牌序相邻", "meaning": "消息带来感情进展", "source": "固定组合"},
        {"card1": "心", "card2": "鱼", "position1": "现状", "position2": "走向",
         "relation": "牌序相邻",
         "meaning": "先按感情流动，再看金钱资源", "source": "相邻牌义合读"},
    ],
    "layoutEvidence": [],
    "draw": {"deckSize": 36, "method": "Fisher-Yates洗牌后依牌位顺序取顶牌",
             "order": [{"index": 1, "position": "起因", "cardId": 1, "cardName": "骑士"},
                       {"index": 2, "position": "现状", "cardId": 24, "cardName": "心"},
                       {"index": 3, "position": "走向", "cardId": 34, "cardName": "鱼"}]},
}


# ------------------------------------------------------------ Node 侧 ----
@pytest.fixture(scope="module")
def tarot_node_server():
    """真实拉起常驻排盘 server.mjs（随机端口），测完即终止。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过 /tarot Node 端点契约测试")
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


def test_tarot_raw_functions_contract():
    """vendored drawTarotSpread / drawLenormandSpread raw 契约：顶层结构 + seed 确定性。"""
    if NODE_BIN is None:
        pytest.skip("本地无 node，跳过塔罗/雷诺曼原函数契约测试")
    script = (
        "import { drawTarotSpread } from './vendor/mingyu-core/dist/divination/tarot.js';\n"
        "import { drawLenormandSpread } from './vendor/mingyu-core/dist/divination/algorithms/lenormand.js';\n"
        "const t1 = drawTarotSpread('three', { seed: 'tarot-ut-1' });\n"
        "const t2 = drawTarotSpread('three', { seed: 'tarot-ut-1' });\n"
        "const ln = drawLenormandSpread('three', { seed: 'lenormand-ut-1' });\n"
        "console.log(JSON.stringify({\n"
        "  tarot: { spreadType: t1.spreadType, spreadName: t1.spreadName,\n"
        "    cardCount: (t1.cards || []).length,\n"
        "    first: t1.cards[0] ? { name: t1.cards[0].name, position: t1.cards[0].position,\n"
        "      reversed: t1.cards[0].reversed,\n"
        "      keywordCount: (t1.cards[0].keywords || []).length,\n"
        "      element: t1.cards[0].element, archetype: t1.cards[0].archetype } : null,\n"
        "    deterministic: JSON.stringify(t1.cards.map(c => c.name)) ===\n"
        "      JSON.stringify(t2.cards.map(c => c.name)),\n"
        "    hasEvidenceAnalysis: 'evidenceAnalysis' in t1,\n"
        "    singleSpreadName: drawTarotSpread('single', { seed: 'tarot-ut-1' }).spreadName },\n"
        "  lenormand: { spreadType: ln.spreadType, spreadName: ln.spreadName,\n"
        "    cardCount: (ln.cards || []).length,\n"
        "    combinationCount: (ln.combinations || []).length,\n"
        "    first: ln.cards[0] ? { name: ln.cards[0].name, position: ln.cards[0].position,\n"
        "      keywordCount: (ln.cards[0].keywords || []).length } : null,\n"
        "    firstCombination: ln.combinations[0] ? { card1: ln.combinations[0].card1,\n"
        "      card2: ln.combinations[0].card2, relation: ln.combinations[0].relation } : null,\n"
        "    hasEvidenceAnalysis: 'evidenceAnalysis' in ln,\n"
        "    hasLayoutEvidence: Array.isArray(ln.layoutEvidence) } }));\n"
    )
    proc = subprocess.run(
        [NODE_BIN, "--input-type=module", "--eval", script],
        cwd=str(NODE_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=90,
    )
    assert proc.returncode == 0, f"node 直调抽牌函数失败: {proc.stderr}"
    out = json.loads(proc.stdout.strip())

    # tarot three：时间流牌阵 3 张，每张含正逆位/关键词/元素/原型；同 seed 完全一致
    t = out["tarot"]
    assert t["spreadType"] == "three"
    assert t["spreadName"] == "时间流牌阵"
    assert t["cardCount"] == 3
    assert t["first"]["name"] and t["first"]["position"]
    assert isinstance(t["first"]["reversed"], bool)
    assert t["first"]["keywordCount"] >= 1
    assert t["first"]["element"] and t["first"]["archetype"]
    assert t["deterministic"] is True
    assert t["hasEvidenceAnalysis"] is True          # raw 剥离前确实存在 → 端点需 strip
    assert t["singleSpreadName"] == "单牌指引"        # spreadType 缺省/显式 single 均单牌

    # lenormand three：三牌事件线 3 张 + 2 组相邻组合（两两牌序相邻）
    ln = out["lenormand"]
    assert ln["spreadType"] == "three"
    assert ln["spreadName"] == "三牌事件线"
    assert ln["cardCount"] == 3
    assert ln["combinationCount"] == 2
    assert ln["first"]["name"] and ln["first"]["keywordCount"] >= 1
    assert ln["firstCombination"]["card1"] and ln["firstCombination"]["card2"]
    assert ln["firstCombination"]["relation"] == "牌序相邻"
    assert ln["hasEvidenceAnalysis"] is True
    assert ln["hasLayoutEvidence"] is True


def test_tarot_node_endpoint_dispatch_and_strip(tarot_node_server):
    """POST /tarot（single/three/缺省）与 POST /divination[lenormand]：分发正确且无内部字段。"""
    base = tarot_node_server
    # ① /tarot 显式 three（seed 确定性）：时间流牌阵 3 张
    resp = httpx.post(f"{base}/tarot",
                      json={"spreadType": "three", "options": {"seed": "tarot-ut-1"}}, timeout=15)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["spreadType"] == "three" and data["spreadName"] == "时间流牌阵"
    assert len(data["cards"]) == 3
    assert all({"name", "position", "reversed", "keywords", "element", "archetype"} <= set(c.keys())
               for c in data["cards"])
    assert "evidenceAnalysis" not in data and "prompt" not in data and "timestamp" not in data
    _assert_no_internal_keys(data)

    # ② /tarot 缺省 spreadType → single 单牌指引
    resp = httpx.post(f"{base}/tarot", json={}, timeout=15)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["spreadType"] == "single" and data["spreadName"] == "单牌指引"
    assert len(data["cards"]) == 1
    assert data["cards"][0]["position"] == "当前指引"
    _assert_no_internal_keys(data)

    # ③ /divination method=lenormand（spreadType 走顶层 input.spreadType，seed 确定性）
    resp = httpx.post(f"{base}/divination",
                      json={"method": "lenormand", "spreadType": "three",
                            "options": {"seed": "lenormand-ut-1"}}, timeout=15)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["spreadType"] == "three" and data["spreadName"] == "三牌事件线"
    assert len(data["cards"]) == 3
    assert len(data["combinations"]) == 2           # 3 张 → 2 组相邻组合
    assert data["combinations"][0]["relation"] == "牌序相邻"
    assert "evidenceAnalysis" not in data and "prompt" not in data and "timestamp" not in data
    _assert_no_internal_keys(data)

    # ④ /divination lenormand 缺省 spreadType → single
    resp = httpx.post(f"{base}/divination",
                      json={"method": "lenormand", "options": {"seed": "lenormand-ut-2"}}, timeout=15)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["spreadType"] == "single" and data["spreadName"] == "单牌线索"
    assert len(data["cards"]) == 1


def test_tarot_node_endpoint_bad_input_400(tarot_node_server):
    """非法 spreadType（tarot / lenormand）→ 400（clientError，非 500）。"""
    base = tarot_node_server
    # /tarot 未知牌阵 → 400
    resp = httpx.post(f"{base}/tarot", json={"spreadType": "no-such-spread"}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "tarot spread type" in resp.json().get("error", "")
    # /tarot spreadType 非字符串 → 400
    resp = httpx.post(f"{base}/tarot", json={"spreadType": 42}, timeout=15)
    assert resp.status_code == 400, resp.text
    # /divination lenormand 未知牌阵 → 400（spreadType 从 input.spreadType 取）
    resp = httpx.post(f"{base}/divination",
                      json={"method": "lenormand", "spreadType": "no-such-spread"}, timeout=15)
    assert resp.status_code == 400, resp.text
    assert "lenormand spread type" in resp.json().get("error", "")


# ------------------------------------------------------------ Python 端点 ----
@pytest.fixture(scope="module")
def tarot_client(orchestration_env):
    """真实 FastAPI app 的 TestClient（lifespan 建表/拉起 Node）；httpx 与 chat 由用例 stub。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


def test_api_tarot_draw_success(tarot_client, monkeypatch):
    """鉴权通过 + Node 200 → code:0 + 落库（spread_type/question/draw）+ tarot_draw 埋点 + 零扣费。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    question = "和 TA 的关系会有进展吗"
    options = {"seed": "tarot-ut-1"}
    calls: list = []
    _fake_node_post(monkeypatch, tarot_mod, payload=SAMPLE_TAROT_DRAW, calls=calls)

    resp = tarot_client.post("/api/tarot/draw",
                             json={"spread_type": "three", "question": question, "options": options},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert isinstance(data["id"], int) and data["id"] > 0
    assert data["spread_type"] == "three"
    assert data["draw"] == SAMPLE_TAROT_DRAW

    # 转发契约：URL 指向 /tarot，payload = {spreadType, options}，timeout=60
    assert len(calls) == 1
    assert calls[0]["url"].endswith("/tarot")
    assert calls[0]["json"] == {"spreadType": "three", "options": options}
    assert calls[0]["timeout"] == 60

    # 落库：tarot_readings 一行，spread_type/question/draw_json 完整
    row = _reading_row(data["id"])
    assert row is not None
    assert row.user_id == uid and row.spread_type == "three"
    assert row.question == question
    assert row.draw_json == SAMPLE_TAROT_DRAW
    assert row.interpretation_json is None

    # 埋点：恰好 1 条 tarot_draw
    rows = _event_rows("tarot_draw", uid)
    assert len(rows) == 1
    assert rows[0].props == {"spread_type": "three"}

    # 抽牌免费：零积分流水
    assert _credit_rows(uid) == []


def test_api_tarot_draw_node_error_502(tarot_client, monkeypatch):
    """Node 非 200 / 连接异常 → 502 网关错误，不埋点、不落库、不扣费。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    # 非 200
    _fake_node_post(monkeypatch, tarot_mod, status=500, payload={"error": "抽牌失败"})
    resp = tarot_client.post("/api/tarot/draw",
                             json={"spread_type": "single"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    # 连接异常
    _fake_node_post(monkeypatch, tarot_mod, exc=httpx.ConnectError("connection refused"))
    resp = tarot_client.post("/api/tarot/draw",
                             json={"spread_type": "single"},
                             headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]

    assert _event_rows("tarot_draw", uid) == []
    assert _credit_rows(uid) == []
    from app.models import TarotReading
    from app.database import AnalyticsSession
    session = AnalyticsSession()
    try:
        assert session.query(TarotReading).filter_by(user_id=uid).count() == 0
    finally:
        session.close()


def test_api_tarot_draw_bad_spread_type_400(tarot_client, monkeypatch):
    """spread_type 不在开放五牌阵（如 celtic Node 支持但本 API 不开放）→ 400，不触达 Node。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    calls: list = []
    _fake_node_post(monkeypatch, tarot_mod, payload=SAMPLE_TAROT_DRAW, calls=calls)
    resp = tarot_client.post("/api/tarot/draw",
                             json={"spread_type": "celtic"},
                             headers=_auth_header(uid))
    assert resp.status_code == 400, resp.text
    assert calls == []
    assert _event_rows("tarot_draw", uid) == []


def test_api_tarot_draw_requires_auth(tarot_client, monkeypatch):
    """无 Authorization → 400 参数校验；非 Bearer / 非法令牌 → 401。"""
    import app.api.tarot as tarot_mod

    _fake_node_post(monkeypatch, tarot_mod, payload=SAMPLE_TAROT_DRAW)
    body = {"spread_type": "single"}
    # 完全缺头：FastAPI Header(...) 必填校验 → 400
    resp = tarot_client.post("/api/tarot/draw", json=body)
    assert resp.status_code == 400
    # 非 Bearer 前缀 → 401
    resp = tarot_client.post("/api/tarot/draw", json=body,
                             headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    # Bearer 但令牌非法 → 401
    resp = tarot_client.post("/api/tarot/draw", json=body,
                             headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_api_tarot_get_single_and_isolation(tarot_client, monkeypatch):
    """GET 单条：本人可取（只读零 LLM）；跨用户 / 不存在 404。"""
    uid = _new_user()
    other = _new_user()
    rid = _new_reading(uid, question="和 TA 的关系会有进展吗",
                       interpretation={"content": "预置解读"})

    # 本人：code:0，data 含 id/spread_type/draw/interpretation
    resp = tarot_client.get(f"/api/tarot/readings/{rid}", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["id"] == rid
    assert data["spread_type"] == "three"
    assert data["draw"] == SAMPLE_TAROT_DRAW
    assert data["interpretation"] == {"content": "预置解读"}

    # 跨用户 → 404
    resp = tarot_client.get(f"/api/tarot/readings/{rid}", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text

    # 不存在 → 404
    resp = tarot_client.get("/api/tarot/readings/999999", headers=_auth_header(uid))
    assert resp.status_code == 404


def test_api_tarot_interpret_cache_hit_zero_cost(tarot_client, monkeypatch):
    """interpret 缓存命中：interpretation_json 非空 → 直接返回，零 LLM 零扣费。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    rid = _new_reading(uid, interpretation={"content": "已有解读（缓存）"})
    chat_calls: list = []
    _fake_chat(monkeypatch, tarot_mod, chat_calls)

    resp = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == "已有解读（缓存）"
    assert chat_calls == []                # LLM 未被调用
    assert _credit_rows(uid) == []         # 零扣费


def test_api_tarot_interpret_miss_charges_and_caches(tarot_client, monkeypatch):
    """interpret 未命中：mock chat 解读 → 即时扣费（ref=tarot:{id}）→ 缓存；
    二次 interpret 命中缓存不重复调 LLM / 不重复扣费。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    rid = _new_reading(uid, question="和 TA 的关系会有进展吗")
    content = "塔罗解读（mock）：整体倾向向好，宜把握眼前机会。"
    chat_calls: list = []
    _fake_chat(monkeypatch, tarot_mod, chat_calls, content=content, tokens=1234)

    # 第一次：走 LLM
    resp = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1

    # messages 契约：system = 塔罗解读 prompt；user = {spread_type, question, draw}
    msg = chat_calls[0]["messages"]
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "塔罗" in msg[0]["content"]                 # 读取了 prompts/interpret/tarot.md
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["spread_type"] == "three"
    assert user_payload["question"] == "和 TA 的关系会有进展吗"
    assert user_payload["draw"] == SAMPLE_TAROT_DRAW

    # 即时扣费：consume 流水 ref=tarot:{id}，tokens=1234 → delta=-2
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].type == "consume"
    assert txs[0].ref == f"tarot:{rid}"
    assert txs[0].tokens == 1234
    assert txs[0].delta == -2

    # 解读已缓存
    row = _reading_row(rid)
    assert row.interpretation_json == {"content": content}

    # 解读埋点
    evs = _event_rows("tarot_interpret", uid)
    assert len(evs) == 1
    assert evs[0].props == {"spread_type": "three", "tarot_reading_id": rid}

    # 第二次：命中缓存 → 零 LLM、零新增流水
    resp2 = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert len(_consume_rows(uid)) == 1


def test_api_tarot_interpret_insufficient_balance(tarot_client, monkeypatch):
    """余额不足（未充值）→ check_balance 抛 5002（HTTP 502 + code 5002），不放行 LLM。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()          # 未充值，balance=0
    rid = _new_reading(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, tarot_mod, chat_calls)

    resp = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["code"] == 5002
    assert "积分不足" in body["message"]
    assert chat_calls == []                # 预检拦截，未调 LLM
    assert _credit_rows(uid) == []


def test_api_tarot_interpret_llm_error_502(tarot_client, monkeypatch):
    """LLM 失败（LLMError）→ 502，不落缓存、不扣费。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")
    rid = _new_reading(uid)

    from app.llm import LLMError
    chat_calls: list = []
    _fake_chat(monkeypatch, tarot_mod, chat_calls, exc=LLMError("mock LLM 不可用"))

    resp = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 502, resp.text
    assert "暂不可用" in resp.json()["message"]
    assert len(chat_calls) == 1
    assert _consume_rows(uid) == []        # LLM 未成功 → 不扣费
    assert _reading_row(rid).interpretation_json is None  # 未缓存


def test_api_tarot_interpret_isolation_404(tarot_client, monkeypatch):
    """跨用户 interpret → 404（隔离在计费/LLM 之前）。"""
    import app.api.tarot as tarot_mod

    uid = _new_user()
    other = _new_user()
    rid = _new_reading(uid)
    chat_calls: list = []
    _fake_chat(monkeypatch, tarot_mod, chat_calls)

    resp = tarot_client.post(f"/api/tarot/readings/{rid}/interpret", headers=_auth_header(other))
    assert resp.status_code == 404, resp.text
    assert chat_calls == []
    assert _credit_rows(other) == []


# ------------------------------------------------------------ divination · lenormand ----
def test_api_divination_lenormand_cast_spreads_spreadtype(tarot_client, monkeypatch):
    """POST /divinations method=lenormand：case_id 可空落库；seed.spreadType 提升到顶层透传。"""
    import app.api.divination as divination_mod

    uid = _new_user()          # 不建 case：lenormand 不要求关联国学档案
    seed = {"spreadType": "three", "options": {"seed": "lenormand-ut-1"}}
    calls: list = []
    _fake_node_post(monkeypatch, divination_mod, payload=SAMPLE_LENORMAND_RESULT, calls=calls)

    resp = tarot_client.post("/api/divinations",
                             json={"method": "lenormand", "seed": seed},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["method"] == "lenormand"
    assert data["result"] == SAMPLE_LENORMAND_RESULT

    # 转发契约：URL /divination；body 顶层 {method, spreadType} + seed 其余透传；timeout=60
    assert len(calls) == 1
    assert calls[0]["url"].endswith("/divination")
    assert calls[0]["json"] == {"method": "lenormand", "spreadType": "three",
                                "options": {"seed": "lenormand-ut-1"}}
    assert calls[0]["timeout"] == 60

    # 落库：divinations 一行，case_id 空、method=lenormand、seed/result 完整
    row = _divination_row(data["id"])
    assert row is not None
    assert row.user_id == uid and row.case_id is None and row.method == "lenormand"
    assert row.seed_json == seed
    assert row.result_json == SAMPLE_LENORMAND_RESULT

    # 埋点 + 零扣费
    assert _event_rows("divination_cast", uid)[0].props == {"method": "lenormand"}
    assert _credit_rows(uid) == []


def test_api_divination_lenormand_cast_default_single(tarot_client, monkeypatch):
    """POST /divinations method=lenormand：seed 无 spreadType → 转发缺省 single。"""
    import app.api.divination as divination_mod

    uid = _new_user()
    calls: list = []
    _fake_node_post(monkeypatch, divination_mod, payload=SAMPLE_LENORMAND_RESULT, calls=calls)

    resp = tarot_client.post("/api/divinations",
                             json={"method": "lenormand", "seed": {"options": {"seed": "ln-x"}}},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["code"] == 0
    assert calls[0]["json"] == {"method": "lenormand", "spreadType": "single",
                                "options": {"seed": "ln-x"}}

    # 无 seed 时同样默认 single（纯 {method} 也放行）
    calls2: list = []
    _fake_node_post(monkeypatch, divination_mod, payload=SAMPLE_LENORMAND_RESULT, calls=calls2)
    resp = tarot_client.post("/api/divinations",
                             json={"method": "lenormand"},
                             headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert calls2[0]["json"] == {"method": "lenormand", "spreadType": "single"}


def test_api_divination_lenormand_interpret_uses_lenormand_prompt(tarot_client, monkeypatch):
    """interpret（method=lenormand）：读 lenormand.md 作 system prompt（含雷诺曼），
    扣费 ref=divination:{id}，二次命中缓存。"""
    import app.api.divination as divination_mod

    uid = _new_user()
    from app.credits.service import recharge
    recharge(uid, 100, "free", note="pytest 预充")

    div_id = _make_divination(uid, method="lenormand")
    content = "雷诺曼解读（mock）：消息带来感情进展，金钱随之流动。"
    chat_calls: list = []
    _fake_chat(monkeypatch, divination_mod, chat_calls, content=content, tokens=999)

    resp = tarot_client.post(f"/api/divinations/{div_id}/interpret", headers=_auth_header(uid))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1

    # system prompt 来自 prompts/interpret/lenormand.md（区别于 divination.md 断卦）
    msg = chat_calls[0]["messages"]
    assert len(msg) == 2 and msg[0]["role"] == "system"
    assert "雷诺曼" in msg[0]["content"]
    user_payload = json.loads(msg[1]["content"])
    assert user_payload["method"] == "lenormand"
    assert user_payload["result"]["spreadName"] == "三牌事件线"
    assert user_payload["chart_summary"] is None

    # 即时扣费 ref=divination:{id}；tokens=999 → delta=-1
    txs = _consume_rows(uid)
    assert len(txs) == 1
    assert txs[0].ref == f"divination:{div_id}"
    assert txs[0].tokens == 999
    assert txs[0].delta == -1
    assert _divination_row(div_id).interpretation_json == {"content": content}

    # 二次 interpret：命中缓存，零 LLM 零新增扣费
    resp2 = tarot_client.post(f"/api/divinations/{div_id}/interpret", headers=_auth_header(uid))
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["interpretation"] == content
    assert len(chat_calls) == 1
    assert len(_consume_rows(uid)) == 1
