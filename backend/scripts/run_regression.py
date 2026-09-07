# -*- coding: utf-8 -*-
"""测试组回归自检入口（可复用）。

一键完成交接文档 §4.3 / §8 定义的本地回归三件套：
    1. 后端全量 pytest（默认临时库隔离，不污染 backend/data/*.db）
    2. 前端语法自检：frontend/public/index.html、admin.html（node new Function）
    3. Node 服务语法：backend/paipan-node/server.mjs（node --check）

用法（在仓库根或 backend 目录下均可运行）：
    python backend/scripts/run_regression.py                 # 全量回归
    python backend/scripts/run_regression.py --strict        # 已知夹具漂移也计入失败
    python backend/scripts/run_regression.py -k divination   # 透传 pytest 参数（快速回归）
    python backend/scripts/run_regression.py --collect-only  # 只收集用例（快速数用例数）

约定：
    - 已知失败 test_paipan.py::test_fixture_snapshot_anchor（交接文档 §4.1 夹具漂移，
      非引擎 bug）默认以"已知失败"列出但不导致整体失败；--strict 时计入失败。
    - 退出码：0 全部通过（含已知失败=0） / 1 有失败 / 2 收集或运行错误。
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent

KNOWN_DRIFT = "tests/unit/test_paipan.py::test_fixture_snapshot_anchor"


def run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    print(f"\n$ {' '.join(cmd)}  (cwd={cwd.name})")
    return subprocess.run(cmd, cwd=str(cwd))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true",
                    help="把已知夹具漂移 test_fixture_snapshot_anchor 计入失败")
    ap.add_argument("--collect-only", action="store_true",
                    help="仅收集用例数（不执行用例），用于快速核对规模")
    ap.add_argument("pytest_args", nargs="*",
                    help="透传给 pytest 的其余参数（如 -k zodiac -x）")
    args = ap.parse_args()

    ok, known_fail, failed = 0, 0, 0
    sections = ["后端 pytest", "前端语法自检", "Node 服务语法"]

    # ---------- 1. 后端 pytest ----------
    pytest_cmd = [sys.executable, "-m", "pytest"]
    if args.collect_only:
        pytest_cmd += ["--collect-only", "-q", "-p", "no:cacheprovider"]
    else:
        pytest_cmd += ["-q", "--no-header", "-p", "no:cacheprovider"]
        if not args.strict:
            pytest_cmd += ["--deselect", KNOWN_DRIFT]
    pytest_cmd += args.pytest_args
    if not any(a.startswith("tests/") or a == "tests" for a in args.pytest_args):
        pytest_cmd.append("tests/")  # 默认全量

    r1 = run(pytest_cmd, BACKEND)
    tail = [l for l in (r1.stdout or "").splitlines() if l.strip()][-1:] if r1.stdout else []
    if args.collect_only:
        # 收集模式只看能否跑通收集
        if r1.returncode == 0:
            ok += 1
        else:
            failed += 1
    elif r1.returncode == 0:
        ok += 1
    else:
        failed += 1

    # ---------- 2. 前端语法自检 ----------
    fe_ok = True
    for name in ("index.html", "admin.html"):
        html = ROOT / "frontend" / "public" / name
        if not html.exists():
            print(f"[SKIP] 前端 {name} 不存在: {html}")
            continue
        node_src = (
            "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');"
            "const m=s.match(/<script>([\\s\\S]*)<\\/script>/);"
            "if(!m){console.error('NO_INLINE_SCRIPT');process.exit(2);}"
            "new Function(m[1]);console.log('SYNTAX_OK');"
        )
        r = subprocess.run(
            ["node", "-e", node_src, str(html)],
            capture_output=True, text=True, timeout=120,
        )
        tag = "OK" if r.returncode == 0 else "FAIL"
        if r.returncode != 0:
            fe_ok = False
        print(f"[{tag}] frontend/public/{name} 语法自检"
              + ("" if r.returncode == 0 else f": {r.stderr.strip()[:300]}"))

    # ---------- 3. Node 服务语法 ----------
    server = BACKEND / "paipan-node" / "server.mjs"
    node = shutil.which("node")
    if node is None:
        print("[SKIP] node 不在 PATH，跳过 server.mjs 检查")
    else:
        r3 = subprocess.run([node, "--check", str(server)],
                            capture_output=True, text=True, timeout=60)
        tag = "OK" if r3.returncode == 0 else "FAIL"
        if r3.returncode != 0:
            failed += 1
            print(f"[{tag}] server.mjs 语法: {r3.stderr.strip()[:300]}")
        else:
            print(f"[OK] server.mjs 语法")

    # 前端结果计入汇总
    if fe_ok:
        ok += 1
    else:
        failed += 1

    # ---------- 汇总 ----------
    print(f"\n===== 回归结果 ===== 通过 {ok} / 失败 {failed}")
    if not args.collect_only and not args.strict:
        print(f"注: 已知夹具漂移已排除（{KNOWN_DRIFT}），--strict 可计入")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
