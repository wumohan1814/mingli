# -*- coding: utf-8 -*-
"""测试环境体检工具（测试组可复用）。

用法：
    cd backend
    python scripts/env_doctor.py            # 全量体检
    python scripts/env_doctor.py --quiet    # 只报失败项

检查内容：
    1. Python 版本（要求 >= 3.11）
    2. 后端运行时依赖（fastapi/uvicorn/sqlalchemy/pydantic/httpx/lunar-python/
       python-multipart/apscheduler/pillow/python-jose/cryptography/...）
    3. 测试依赖（pytest / pytest-asyncio）
    4. Node 版本 + paipan-node 语法（node --check server.mjs）
    5. 排盘 Node 依赖：iztro（CJS 可解析）+ mingyu-core（ESM-only，用动态 import 探测）
    6. 测试 fixtures（tests/fixtures/chart.json、method_anchor.json、slices/）
    7. 本地 .env 存在性（不打印任何密钥值）

纯标准库实现：即使第三方依赖损坏也能运行，从而能报告"缺什么"。
退出码：0 = 全部通过；1 = 存在失败项。
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
PYTHON_MIN = (3, 11)

# 运行时必需 import（app 实际 import 到的顶层包）
RUNTIME_MODULES = [
    "fastapi", "uvicorn", "sqlalchemy", "alembic", "pydantic",
    "pydantic_settings", "jose", "cryptography", "httpx", "lunar_python",
    "multipart", "apscheduler", "PIL",
]
TEST_MODULES = ["pytest", "pytest_asyncio"]

CHECK_HEADERS = {
    "python": "Python",
    "runtime": "后端运行时依赖",
    "test": "测试依赖",
    "node": "Node / paipan-node",
    "node_deps": "排盘 Node 依赖",
    "fixtures": "测试 fixtures",
    "env": "本地 .env",
}


def _check_modules(names: list[str]) -> list[str]:
    fails = []
    for m in names:
        spec = importlib.util.find_spec(m)
        if spec is None:
            fails.append(m)
    return fails


def _node_check() -> list[str]:
    fails = []
    try:
        ver = subprocess.run(
            ["node", "--version"], capture_output=True, text=True, timeout=30
        )
        if ver.returncode != 0:
            fails.append(f"node --version 失败: {ver.stderr.strip()}")
        else:
            server = BACKEND / "paipan-node" / "server.mjs"
            chk = subprocess.run(
                ["node", "--check", str(server)],
                capture_output=True, text=True, timeout=60,
            )
            if chk.returncode != 0:
                fails.append(f"server.mjs 语法错误: {chk.stderr.strip()}")
    except FileNotFoundError:
        fails.append("node 未安装或不在 PATH")
    except subprocess.TimeoutExpired:
        fails.append("node 检查超时")
    return fails


def _node_deps() -> list[str]:
    """探测 paipan-node 依赖：iztro 用 require.resolve，mingyu-core 用 ESM import。"""
    fails = []
    nm = BACKEND / "paipan-node" / "node_modules"
    if not nm.is_dir():
        return ["paipan-node/node_modules 不存在（缺 npm install）"]
    script = r"""
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const nm = process.argv[1];
  const out = { iztro: false, mingyu: false, err: null };
  try { require.resolve('iztro', { paths: [nm] }); out.iztro = true; } catch (e) {}
  try {
    await import(pathToFileURL(path.join(nm, 'mingyu-core', 'dist', 'index.js')).href);
    out.mingyu = true;
  } catch (e) { out.err = String(e && e.message || e); }
  console.log(JSON.stringify(out));
})();
"""
    try:
        r = subprocess.run(
            ["node", "-e", script, str(nm)],
            capture_output=True, text=True, timeout=90,
        )
        if r.returncode != 0:
            return [f"node 探测脚本失败: {r.stderr.strip()[:300]}"]
        data = json.loads(r.stdout.strip().splitlines()[-1])
        if not data.get("iztro"):
            fails.append("iztro 无法解析")
        if not data.get("mingyu"):
            fails.append(f"mingyu-core ESM import 失败: {data.get('err') or ''}")
    except (FileNotFoundError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
        fails.append(f"Node 依赖探测异常: {e}")
    return fails


def _fixtures() -> list[str]:
    fx = BACKEND / "tests" / "fixtures"
    need = ["chart.json", "method_anchor.json", "slices"]
    return [f"{n} 缺失" for n in need if not (fx / n).exists()]


def main() -> int:
    quiet = "--quiet" in sys.argv
    fails_by_check: dict[str, list[str]] = {}

    # 1. Python 版本
    pyver = sys.version_info[:2]
    pf = [] if pyver >= PYTHON_MIN else [f"Python {'.'.join(map(str, pyver))} < {'.'.join(map(str, PYTHON_MIN))}"]
    fails_by_check["python"] = pf

    # 2/3. 依赖
    fails_by_check["runtime"] = _check_modules(RUNTIME_MODULES)
    fails_by_check["test"] = _check_modules(TEST_MODULES)

    # 4/5. Node
    fails_by_check["node"] = _node_check()
    fails_by_check["node_deps"] = _node_deps()

    # 6. fixtures
    fails_by_check["fixtures"] = _fixtures()

    # 7. .env（只报存在性，绝不打印内容）
    envf = BACKEND / ".env"
    fails_by_check["env"] = [] if envf.exists() else ["backend/.env 缺失"]

    total_fail = 0
    for key in ("python", "runtime", "test", "node", "node_deps", "fixtures", "env"):
        fails = fails_by_check[key]
        total_fail += len(fails)
        if not fails:
            if not quiet:
                print(f"[OK]   {CHECK_HEADERS[key]}")
        else:
            print(f"[FAIL] {CHECK_HEADERS[key]}")
            for f in fails:
                print(f"         - {f}")

    print(f"\n结果: {'全部通过' if total_fail == 0 else f'{total_fail} 项失败'} (Python {'.'.join(map(str, sys.version_info[:3]))})")
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
