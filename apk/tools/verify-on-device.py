#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify-on-device —— 真机验收跑（节166）：把「待你真机验收」变成一条命令。

## 它替你做什么

你只需要插上手机（开着 USB 调试），然后跑：

    python apk/tools/verify-on-device.py --install

它会依次做完并给出**客观判据**，而不是让你自己盯着屏幕猜：

1. 找到 `adb` 与设备（多台设备时要 `--serial`）
2. （`--install` 时）装上 `apk/app/build/outputs/apk/debug/app-debug.apk`
3. 启动应用主界面
4. `adb forward` 把手机上的 `127.0.0.1:8765` 映射到本机
5. 轮询直到**应用内置服务就绪**（超时可调）
6. 读 `GET /api/runtime`：**形态必须是 `apk-local`**、`byo_llm_key` 必须为真
7. 读 `GET /`：必须是 200 且有真实 HTML（**这一条专治「打开白屏」**）
8. 取回 `local_token` 并用它请求业务端点（`/api/combine/pools`）→ 必须 200
   （这一条证明**从启动到业务鉴权的整条链在真机上通了**）
9. 抓一段 logcat 里的 Python 异常，帮你定位失败原因

## 为什么这些判据能代表「独立运行」

- 第 6 条 = 应用内跑的**是真的后端**，而且认得出自己是单机形态；
- 第 7 条 = 静态站点挂上了（历史上曾因静态根按 cwd 解析而在安卓上必然 404）；
- 第 8 条 = 单机形态**不需要登录**也能调用业务接口（token 由本机服务自动签发）；
- 全程**不碰官方服务器**（线上实例已于 2026-10-01 下线，本来也没有）。

## 它**不能**替你验的（你要自己看一眼）

- 排盘结果对不对、AI 解读有没有出来（**需要你先在应用里填自己的大模型 API**）；
- 潮汕圣杯的筊杯形状这类**视觉**验收（台账里节162 的遗留项）；
- 「聊天顺手」「文案对不对」这类口味判断。

本脚本**不调用任何大模型**，也不花你一分钱。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APK_PATH = REPO_ROOT / "apk" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
PACKAGE = "com.mingli.apk"
ACTIVITY = "com.mingli.apk.MainActivity"

_results: list[tuple[bool, str, str]] = []


def check(ok: bool, title: str, detail: str = "") -> bool:
    _results.append((bool(ok), title, detail))
    print("%s %s%s" % ("  [OK]  " if ok else "  [FAIL]", title, ("  -- " + detail) if detail else ""))
    return bool(ok)


def find_adb(explicit: str | None) -> str | None:
    if explicit:
        return explicit if Path(explicit).is_file() else None
    for root in (os.environ.get("ANDROID_HOME"), os.environ.get("ANDROID_SDK_ROOT")):
        if root:
            candidate = Path(root) / "platform-tools" / ("adb.exe" if os.name == "nt" else "adb")
            if candidate.is_file():
                return str(candidate)
    return shutil.which("adb")


def adb_run(adb: str, args: list[str], serial: str | None = None, timeout: int = 60):
    cmd = [adb] + (["-s", serial] if serial else []) + args
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=timeout)


def http_get(url: str, headers: dict | None = None, timeout: float = 10.0):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def main() -> int:
    parser = argparse.ArgumentParser(description="真机验收（节166）")
    parser.add_argument("--adb", help="adb 可执行文件路径（缺省自动找）")
    parser.add_argument("--serial", help="多台设备时指定（adb devices 里那串）")
    parser.add_argument("--install", action="store_true", help="先安装/覆盖安装 debug APK")
    parser.add_argument("--apk", help="APK 路径（缺省 apk/app/build/outputs/apk/debug/app-debug.apk）")
    parser.add_argument("--port", type=int, default=18765, help="本机映射端口（缺省 18765，避免与本地服务撞）")
    parser.add_argument("--timeout", type=int, default=60, help="等待应用内置服务就绪的秒数上限")
    args = parser.parse_args()

    adb = find_adb(args.adb)
    if not check(bool(adb), "找到 adb", adb or "未找到：请先 `. C:\\AndroidDev\\env.ps1`，或用 --adb 指定"):
        return 1

    # ---- 设备 ----
    print("\n[1] 设备")
    out = adb_run(adb, ["devices"]).stdout
    print(out.strip())
    lines = [ln.split("\t") for ln in out.splitlines()[1:] if ln.strip()]
    ready = [ln[0] for ln in lines if len(ln) > 1 and ln[1].strip() == "device"]
    unauthorized = [ln[0] for ln in lines if len(ln) > 1 and "unauthorized" in ln[1]]
    if unauthorized:
        print("  设备未授权：请在手机屏幕上点「允许 USB 调试」")
    serial = args.serial or (ready[0] if len(ready) == 1 else None)
    if not check(bool(serial), "恰好一台可用设备", serial or ("找到 %d 台，请用 --serial 指定" % len(ready))):
        return 1

    # ---- 安装 ----
    apk = Path(args.apk) if args.apk else APK_PATH
    print("\n[2] 安装（%s）" % ("开启" if args.install else "跳过：未加 --install"))
    if args.install:
        if not check(apk.is_file(), "APK 存在", str(apk)):
            return 1
        print("  %s = %.1f MB" % (apk.name, apk.stat().st_size / 1024 / 1024))
        r = adb_run(adb, ["install", "-r", str(apk)], serial=serial, timeout=240)
        ok = r.returncode == 0 and "Success" in (r.stdout or "")
        check(ok, "adb install -r 成功", (r.stdout or r.stderr or "").strip().splitlines()[-1] if (r.stdout or r.stderr) else "")

    # ---- 启动 ----
    print("\n[3] 启动应用")
    r = adb_run(adb, ["shell", "am", "start", "-n", "%s/%s" % (PACKAGE, ACTIVITY)], serial=serial)
    check("Error" not in (r.stdout or "") and "does not exist" not in (r.stdout or ""),
          "am start 已下发", (r.stdout or r.stderr or "").strip().splitlines()[-1] if (r.stdout or r.stderr) else "")

    # ---- 端口映射 ----
    print("\n[4] adb forward tcp:%d -> 设备 127.0.0.1:8765" % args.port)
    adb_run(adb, ["forward", "--remove-all"], serial=serial)
    r = adb_run(adb, ["forward", "tcp:%d" % args.port, "tcp:8765"], serial=serial)
    check(r.returncode == 0, "forward 建立", (r.stdout or r.stderr or "").strip())

    # ---- 等待服务就绪（首次安装要解包 CPython，可能十几秒到一分钟）----
    base = "http://127.0.0.1:%d" % args.port
    print("\n[5] 等待应用内置服务就绪（上限 %d 秒；首次安装要解包 Python 运行时）" % args.timeout)
    deadline = time.time() + args.timeout
    ready_ok = False
    last = ""
    while time.time() < deadline:
        try:
            status, _ = http_get(base + "/api/health", timeout=3.0)
            if status == 200:
                ready_ok = True
                break
        except Exception as exc:  # noqa: BLE001
            last = "%s: %s" % (type(exc).__name__, exc)
        time.sleep(1.0)
    check(ready_ok, "设备上的 /api/health 返回 200", "" if ready_ok else last)

    mode = capabilities = None
    token = ""
    if ready_ok:
        # ---- 形态与能力 ----
        print("\n[6] 形态与能力清单（真机返回）")
        try:
            status, body = http_get(base + "/api/runtime")
            data = json.loads(body.decode("utf-8")).get("data", {})
            mode = data.get("mode")
            capabilities = data.get("capabilities") or {}
            token = data.get("local_token") or ""
            check(mode == "apk-local", "mode == apk-local", str(mode))
            check(capabilities.get("byo_llm_key") is True,
                  "byo_llm_key == True（应用内可填大模型 API）", str(capabilities.get("byo_llm_key")))
            check(capabilities.get("auth") is False, "auth == False（单机免登录）", str(capabilities.get("auth")))
            print("      完整能力：%s" % json.dumps(capabilities, ensure_ascii=False))
        except Exception as exc:  # noqa: BLE001
            check(False, "GET /api/runtime 可读", "%s: %s" % (type(exc).__name__, exc))

        # ---- 静态站点（专治白屏）----
        print("\n[7] 静态站点（白屏判据）")
        try:
            status, body = http_get(base + "/")
            text = body.decode("utf-8", errors="replace")
            check(status == 200 and len(body) > 1000,
                  "GET / -> 200 且有真实 HTML", "%s / %d 字节" % (status, len(body)))
            check("<!DOCTYPE html" in text.lower() or "<html" in text.lower(),
                  "内容是 HTML 而不是错误页", text[:60].replace("\n", " "))
        except Exception as exc:  # noqa: BLE001
            check(False, "GET / 可读", "%s: %s" % (type(exc).__name__, exc))

        # ---- 单机 token 能调业务端点 ----
        print("\n[8] 单机 token 能调业务端点（整链验证）")
        if token:
            try:
                status, body = http_get(base + "/api/combine/pools",
                                        headers={"Authorization": "Bearer " + token})
                check(status == 200, "带 local_token 请求 /api/combine/pools -> 200", str(status))
                if status == 200:
                    pools = json.loads(body.decode("utf-8")).get("data", {}) or {}
                    check(bool(pools.get("natal")) and bool(pools.get("moment")),
                          "方法池非空（合参可用）",
                          "natal=%d moment=%d" % (len(pools.get("natal") or []), len(pools.get("moment") or [])))
            except Exception as exc:  # noqa: BLE001
                check(False, "带 token 请求业务端点", "%s: %s" % (type(exc).__name__, exc))
        else:
            check(False, "拿到 local_token", "为空 —— 若 /api/runtime 正常但这里为空，说明回环校验未通过")

    # ---- logcat 里的 Python 异常（帮你定位失败）----
    print("\n[9] logcat 里的 Python 异常（仅供参考）")
    r = adb_run(adb, ["logcat", "-d", "-t", "400", "-s", "python.stdout:V", "python.stderr:V",
                      "AndroidRuntime:E"], serial=serial, timeout=60)
    lines = [ln for ln in (r.stdout or "").splitlines()
             if any(k in ln for k in ("Traceback", "Error", "Exception", "apk_asgi", "apk_server"))]
    if lines:
        for ln in lines[-12:]:
            print("      " + ln)
    else:
        print("      （没有匹配的异常行）")

    adb_run(adb, ["forward", "--remove-all"], serial=serial)
    print("\n（已清理 adb forward）")

    failed = [x for x in _results if not x[0]]
    print("=" * 70)
    print("通过 %d / %d" % (len(_results) - len(failed), len(_results)))
    for _, title, detail in failed:
        print("  [FAIL] %s  %s" % (title, detail))
    print("结论：%s" % ("[PASS] 真机上的「独立运行」判据全部通过" if not failed else "[FAIL] 有判据失败"))
    print("\n还要你自己看一眼的：① 排盘结果对不对（先在应用内「大模型接入」填你自己的 API）")
    print("                        ② 潮汕圣杯筊杯是否月牙形（节162 遗留视觉验收）")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
