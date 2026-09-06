# -*- coding: utf-8 -*-
"""端到端集成测试：多用户隔离 + 无经纬度降级（backend/tests/integration/test_e2e_isolation.py）。

覆盖：
  - test_multi_user_isolation（多用户隔离 C20，否定用例）：
      用户 B 持自己的 token 请求用户 A 的 case 的 paipan / archive → 一律 404，
      后端按 id + user_id 过滤（_get_owned_case / paipan 内联查询），查不到即 404，
      绝不越权读写他人数据。
  - test_degraded_no_longitude：建档不带 longitude/latitude → paipan 成功（code==0），
      degradedMethods 恰为 {qimen-lifetime, western, qizheng, wuyun-liuqi} 四个。

纪律：两用例都不触发 LLM（只走确定性排盘，不做 duan-qian-chen/predict/revise），
无需 mock chat；带经纬度的完整排盘会真实跑 Node 子进程（约 1-2 秒），属预期。
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402  # 需在 conftest 设好临时 DB 环境变量之后 import

# 无经纬度时确定性降级的 4 个方法（顺序以引擎实际输出为准，用集合断言）
DEGRADED_WITHOUT_GEO = {"qimen-lifetime", "western", "qizheng", "wuyun-liuqi"}


# ---------------------------------------------------------------------------- #
# 工具：注册拿 headers / 建档
# ---------------------------------------------------------------------------- #
def _register_headers(client: TestClient, tag: str) -> dict:
    """注册一个新用户并返回其 Bearer 请求头。"""
    resp = client.post(
        "/api/auth/register",
        json={
            "username": f"it_{tag}_{uuid.uuid4().hex[:8]}",
            "password": "secret123",
        },
    )
    assert resp.status_code == 200, f"注册失败: {resp.status_code} {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_case(client: TestClient, headers: dict, **overrides) -> str:
    """按 CreateCaseRequest 建档，返回 caseId（str）。

    默认不带 longitude/latitude（验证无经纬度降级路径）；需要经纬度时经
    overrides 显式传入。
    """
    payload = {
        "birth_year": 1990,
        "birth_month": 5,
        "birth_day": 12,
        "birth_hour": 14,
        "gender": "male",
        "birthplace": "北京",
        "question": "事业运势",
    }
    payload.update(overrides)
    resp = client.post("/api/cases", json=payload, headers=headers)
    assert resp.status_code == 200, f"建档失败: {resp.status_code} {resp.text}"
    return resp.json()["data"]["caseId"]


# ---------------------------------------------------------------------------- #
# 用例 1：多用户数据隔离（否定用例，TDD C20）
# ---------------------------------------------------------------------------- #
def test_multi_user_isolation():
    with TestClient(app) as client:
        # 注册用户 A、B，各自持有 token
        headers_a = _register_headers(client, "a")
        headers_b = _register_headers(client, "b")

        # A 建档并自己对 case 排盘成功
        case_id = _create_case(client, headers_a, longitude=116.4, latitude=39.9)
        resp = client.post(f"/api/cases/{case_id}/paipan", headers=headers_a)
        assert resp.status_code == 200, f"A 排盘失败: {resp.status_code} {resp.text}"
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["caseId"] == case_id

        # B 持自己的 token 请求 A 的 case：paipan 与 archive 都必须 404，不得越权
        resp_paipan = client.post(f"/api/cases/{case_id}/paipan", headers=headers_b)
        assert resp_paipan.status_code == 404, (
            f"B 越权 paipan 未返回 404: {resp_paipan.status_code} {resp_paipan.text}"
        )
        resp_archive = client.get(f"/api/cases/{case_id}/archive", headers=headers_b)
        assert resp_archive.status_code == 404, (
            f"B 越权 archive 未返回 404: {resp_archive.status_code} {resp_archive.text}"
        )


# ---------------------------------------------------------------------------- #
# 用例 2：建档无经纬度 → 确定性降级 4 法
# ---------------------------------------------------------------------------- #
def test_degraded_no_longitude():
    with TestClient(app) as client:
        headers_c = _register_headers(client, "c")

        # 建档只给生辰 + 性别 + 出生地，不带 longitude/latitude
        case_id = _create_case(client, headers_c)  # 无经纬度覆盖 → 走降级路径

        resp = client.post(f"/api/cases/{case_id}/paipan", headers=headers_c)
        assert resp.status_code == 200, f"降级排盘失败: {resp.status_code} {resp.text}"
        body = resp.json()
        assert body["code"] == 0
        degraded = body["data"]["degradedMethods"]
        # 恰好这 4 个方法被降级（顺序以实际为准，集合断言）
        assert set(degraded) == DEGRADED_WITHOUT_GEO, (
            f"降级方法不符: 期望 {sorted(DEGRADED_WITHOUT_GEO)} 实得 {degraded}"
        )
