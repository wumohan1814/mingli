"""方法模块注册表（Phase 4）。

方法目录名带连字符（如 bazi-pattern），Python 无法 `import app.methods.bazi-pattern`，
因此用 importlib 按文件路径加载各目录下的 analyzer.py，薄封装导出
`ANALYZERS: {method_key: async analyze(...)}` 与 `METHOD_KEYS: [key, ...]`。
"""

import importlib.util
from pathlib import Path

# 9 个方法的注册顺序（与 slicer / 路由表 / mingli SKILL.md §0 对齐）
METHOD_KEYS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
    "ziwei",
    "xizhan",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]


def _load(key: str):
    """按文件路径加载 `<key>/analyzer.py`，返回其 `analyze` 协程。"""
    path = Path(__file__).parent / key / "analyzer.py"
    spec = importlib.util.spec_from_file_location(f"taichu_method_{key.replace('-', '_')}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.analyze


ANALYZERS = {k: _load(k) for k in METHOD_KEYS}

__all__ = ["ANALYZERS", "METHOD_KEYS"]
