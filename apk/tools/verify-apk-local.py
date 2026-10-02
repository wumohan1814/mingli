#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify-apk-local —— 单机形态（`apk-local`）的可重跑验证脚本（节166）。

## 为什么要有这个脚本

APK 上没有真机就跑不了端到端；但**单机形态的绝大部分风险其实在「后端能不能起来、
形态对不对、静态站点挂没挂上、token 能不能拿到、uvicorn 能不能在后台线程里跑」这几件上**
—— 这些在开发机上**用真后端就能验**，不需要安卓。本脚本把判据固化下来，
避免每次临时拼探针（也避免「只跑单测就以为验过了」）。

## 它验什么（= 节166 的验收判据）

| # | 判据 | 为什么 |
|---|---|---|
| 1 | `configure_environment()` 注入成功，`MINGLI_RUNTIME_MODE=apk-local` | 形态开关是「同一份代码多种形态」的唯一入口 |
| 2 | 环境注入后 `import app.main` 成功 | 后端能进包的第一道门（pydantic v1 那条路） |
| 3 | `GET /api/health` → 200 | MainActivity 的健康轮询只看 200 且**不跟随重定向** |
| 4 | `GET /api/runtime` → 200 且 `mode == "apk-local"` | 前端据此做条件化渲染 |
| 5 | `capabilities` 含 `byo_llm_key: true` | **用户要的「应用内填 API 连大模型」就是这个能力位** |
| 6 | `GET /` 与 `/hecan` → 200（**cwd 与项目目录无关**） | 静态根曾是按 cwd 解析的相对路径 → 安卓上必然白屏 |
| 7 | `data.local_token` 存在 | 单机形态没有登录入口，没 token 则所有 `/api/*` 都会 400 |
| 8 | **用该 token 请求业务端点 → 200（不是 400）** | 判据 7 的**因果验证**：token 必须真能用 |
| 9 | 未配置大模型 Key 时端点 / 页面**不 500、不白屏** | 用户的硬要求：「不填 Key 也能排盘」 |
| 10 | ⭐ **真起 uvicorn（后台线程 + 127.0.0.1）并在**线上**拿到 token** | 这才是 APK 的真实执行模型：MainActivity 在**后台线程**里跑阻塞服务。它同时验两件事——① uvicorn 的信号处理器守卫是否有效（否则 `signal only works in main thread` 直接崩）② token 在真实回环连接上确实下发（TestClient 的默认对端是 `"testclient"`，**不是回环**，验不到这条） |

## 为什么判据 10 必须在真端口上验

Starlette 的 `TestClient` 默认把 ASGI 的 `client` 报成 `("testclient", 50000)`；
而本机会话的护栏要求「请求来自回环地址」→ **护栏会按设计拒绝它**。
所以「TestClient 拿不到 token」**不代表真实环境拿不到**，反过来也一样 ——
必须真起服务、真发 HTTP，才是有效证据。

退出码：0 = 全部通过；1 = 有判据失败。
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import sys
import tempfile
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
PYSRC_DIR = REPO_ROOT / "apk" / "pysrc"
FRONTEND_PUBLIC = REPO_ROOT / "frontend" / "public"

_results: list[tuple[bool, str, str]] = []


def check(ok: bool, title: str, detail: str = "") -> bool:
    _results.append((bool(ok), title, detail))
    print("%s %s%s" % ("  OK  " if ok else " FAIL ", title, ("  -- " + detail) if detail else ""))
    return bool(ok)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="单机形态（apk-local）验证")
    parser.add_argument("--keep", action="store_true", help="保留临时 HOME 目录（排查用）")
    args = parser.parse_args()

    for path, label in ((BACKEND_DIR, "backend/"), (PYSRC_DIR, "apk/pysrc/"),
                        (FRONTEND_PUBLIC, "frontend/public/")):
        if not path.is_dir():
            print("缺少目录 %s（%s）——请在仓库根执行本脚本" % (path, label))
            return 2

    fake_home = Path(tempfile.mkdtemp(prefix="mingli-apk-local-"))
    # 记录「本次运行之前」仓库根有没有 jwt_secret / llm.json —— 判据 11 只查新增，不误伤使用者已有文件
    _pre_existing = {n for n in ("jwt_secret", "llm.json") if (REPO_ROOT / n).exists()}
    print("临时 HOME = %s" % fake_home)
    print("=" * 70)

    # 关键：cwd 设成与项目目录无关的位置，模拟安卓上「cwd 不可控」。
    # 这正是当初「静态根按 cwd 解析」那个必然白屏缺陷的暴露条件。
    os.chdir(tempfile.gettempdir())
    os.environ["HOME"] = str(fake_home)
    for stray in ("MINGLI_RUNTIME_MODE", "MINGLI_WEB_ROOT", "MINGLI_DB_PATH",
                  "MINGLI_FEEDBACK_DB_PATH", "MINGLI_OPS_DB_PATH", "MINGLI_LLM_BASE_URL",
                  "MINGLI_LLM_API_KEY", "MINGLI_LLM_MODEL", "MINGLI_APK_PORT"):
        os.environ.pop(stray, None)
    sys.path.insert(0, str(BACKEND_DIR))
    sys.path.insert(0, str(PYSRC_DIR))

    # ---- 1) 环境注入 ----
    print("[1] 环境注入")
    try:
        import apk_asgi
    except Exception as exc:  # noqa: BLE001
        print(" 导入 apk_asgi 失败：%s: %s" % (type(exc).__name__, exc))
        return 1
    applied = apk_asgi.configure_environment(web_root=str(FRONTEND_PUBLIC))
    check(applied.get("MINGLI_RUNTIME_MODE") == "apk-local",
          "MINGLI_RUNTIME_MODE = apk-local", str(applied.get("MINGLI_RUNTIME_MODE")))
    check(len(applied.get("MINGLI_JWT_SECRET", "")) >= 32, "JWT 密钥已生成/持久化",
          "长度 %d" % len(applied.get("MINGLI_JWT_SECRET", "")))

    # ---- 2) 应用可导入 ----
    print("\n[2] 应用可导入")
    try:
        app = apk_asgi.build_app()
    except Exception as exc:  # noqa: BLE001
        check(False, "import app.main 成功", "%s: %s" % (type(exc).__name__, exc))
        return 1
    check(True, "import app.main 成功", "%d 条路由" % len(app.routes))

    from fastapi.testclient import TestClient  # noqa: PLC0415

    # 显式把 ASGI 的 client 设成回环 —— uvicorn 在真实回环连接上就是这么填的。
    with TestClient(app, client=("127.0.0.1", 51000)) as client:
        print("\n[3~5] 健康 · 形态 · 能力清单")
        health = client.get("/api/health")
        check(health.status_code == 200, "GET /api/health -> 200", str(health.status_code))

        runtime = client.get("/api/runtime")
        check(runtime.status_code == 200, "GET /api/runtime -> 200", str(runtime.status_code))
        data = runtime.json().get("data", {}) if runtime.status_code == 200 else {}
        check(data.get("mode") == "apk-local", "runtime.mode == apk-local", str(data.get("mode")))
        caps = data.get("capabilities", {}) or {}
        check(caps.get("byo_llm_key") is True,
              "byo_llm_key == True（用户要的「应用内填 API」）", str(caps.get("byo_llm_key")))
        check(caps.get("auth") is False, "auth == False（单机无登录）", str(caps.get("auth")))
        check(caps.get("paipan_local") is True, "paipan_local == True", str(caps.get("paipan_local")))

        print("\n[6] 静态站点（cwd 与项目目录无关）")
        for route in ("/", "/hecan"):
            resp = client.get(route)
            check(resp.status_code == 200 and len(resp.content) > 1000,
                  "GET %s -> 200 且有内容" % route,
                  "%s / %d 字节" % (resp.status_code, len(resp.content)))

        print("\n[7] 本机 token（回环来源）")
        token = data.get("local_token") or ""
        check(bool(token), "runtime.data.local_token 存在", "长度 %d" % len(token))

        print("\n[8] token 真能用（因果验证）")
        if token:
            authed = client.get("/api/combine/pools", headers={"Authorization": "Bearer " + token})
            check(authed.status_code == 200, "带 token 请求 /api/combine/pools -> 200",
                  str(authed.status_code))
            if authed.status_code == 200:
                pools = authed.json().get("data", {}) or {}
                check(bool(pools.get("natal")) and bool(pools.get("moment")),
                      "方法池非空", "natal=%d moment=%d" % (len(pools.get("natal") or []),
                                                          len(pools.get("moment") or [])))
        else:
            check(False, "带 token 请求业务端点 -> 200", "无 token，无法验证")

        print("\n[9] 未配置大模型 Key 时（不 500 / 不白屏）")
        for route in ("/", "/hecan", "/api/health"):
            resp = client.get(route)
            check(resp.status_code < 500, "%s 未 500" % route, str(resp.status_code))
        check(not os.environ.get("MINGLI_LLM_API_KEY"), "确认此时确实未配置 Key",
              repr(os.environ.get("MINGLI_LLM_API_KEY")))

    # ---- 10) 真起 uvicorn（后台线程）—— APK 的真实执行模型 ----
    print("\n[10] 真起 uvicorn（后台线程 + 127.0.0.1）—— APK 的真实执行模型")
    port = _free_port()
    server = apk_asgi.create_server(port=port, host="127.0.0.1")
    thread = threading.Thread(target=server.run, name="verify-uvicorn", daemon=True)
    thread.start()

    import httpx  # noqa: PLC0415

    base = "http://127.0.0.1:%d" % port
    deadline = time.time() + 20
    live_token = ""
    last_err = ""
    while time.time() < deadline:
        try:
            resp = httpx.get(base + "/api/runtime", timeout=2.0)
            if resp.status_code == 200:
                live_data = resp.json().get("data", {})
                live_token = live_data.get("local_token") or ""
                check(live_data.get("mode") == "apk-local",
                      "线上 /api/runtime mode == apk-local", str(live_data.get("mode")))
                break
        except Exception as exc:  # noqa: BLE001
            last_err = "%s: %s" % (type(exc).__name__, exc)
        time.sleep(0.3)

    check(bool(live_token), "线上（真回环连接）拿到了 local_token",
          ("长度 %d" % len(live_token)) if live_token else last_err)
    if live_token:
        live = httpx.get(base + "/api/combine/pools",
                         headers={"Authorization": "Bearer " + live_token}, timeout=10.0)
        check(live.status_code == 200, "线上带 token 请求业务端点 -> 200", str(live.status_code))
    live_home = httpx.get(base + "/", timeout=10.0)
    check(live_home.status_code == 200 and len(live_home.content) > 1000,
          "线上 GET / -> 200 且有内容", "%s / %d 字节" % (live_home.status_code, len(live_home.content)))

    server.should_exit = True
    thread.join(timeout=10)
    check(not thread.is_alive(), "uvicorn 已在后台线程内正常退出",
          "（信号处理器守卫有效，未因 signal only works in main thread 崩溃）")

    # ---- 11) 敏感文件不能掉进仓库（回归护栏）----
    # `apk_asgi.home_dir()` 在 `HOME` 不可用时会把落点退到 **当前工作目录**，于是
    # 「忘了设 HOME」的调试运行会把 jwt_secret / llm.json 落进仓库（实测掉在仓库根过一次）。
    # 本判据只查「本次运行有没有**新**落盘」——不误伤使用者自己已有的文件。
    print("\n[11] 敏感文件没有掉进仓库（回归护栏）")
    for name in ("jwt_secret", "llm.json"):
        created = (REPO_ROOT / name).exists() and name not in _pre_existing
        check(not created,
              "仓库根没有被写出 %s" % name,
              "**本脚本刚把它写进了仓库！检查 apk_asgi.home_dir() 的 HOME 回退逻辑**" if created else "")

    # ---- 汇总 ----
    if not args.keep:
        shutil.rmtree(fake_home, ignore_errors=True)
    else:
        print("\n临时 HOME 保留在 %s" % fake_home)

    failed = [r for r in _results if not r[0]]
    print("\n" + "=" * 70)
    print("通过 %d / %d" % (len(_results) - len(failed), len(_results)))
    for _, title, detail in failed:
        print("  FAIL  %s  %s" % (title, detail))
    print("结论：%s" % ("[PASS] 单机形态判据全部通过" if not failed else "[FAIL] 有判据失败"))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
