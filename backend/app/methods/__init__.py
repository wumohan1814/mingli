"""方法模块注册表（Phase 4）。

方法目录名带连字符（如 bazi-pattern），Python 无法 `import app.methods.bazi-pattern`，
因此用 importlib 按文件路径加载各目录下的 analyzer.py，薄封装导出
`ANALYZERS: {method_key: async analyze(...)}` 与 `METHOD_KEYS: [key, ...]`。
"""

import importlib.util
from pathlib import Path

# 8 个方法的注册顺序（与 slicer / 路由表 / mingli-reference SKILL.md §0 对齐）
# 节139：xizhan（西式占星）已摘出本注册表——西占属「西式占卜」大模块，
# 不进国学九法→八法综合流水线；其 analyzer 目录与 prompt 保留（可能复用）。
METHOD_KEYS = [
    "bazi-pattern",
    "bazi-dayun-liunian",
    "bazi-shensha-nayin",
    "bazi-hunyin-caiyun",
    "ziwei",
    "qizheng",
    "qimen-lifetime",
    "wuyun-liuqi",
]

# 不在默认流水线、但**可按 key 加载**的方法（可被显式点名运行，如合参第 9 法）。
# 节139 把 xizhan 摘出默认八法注册表（METHOD_KEYS 语义不变），其 analyzer 与
# prompt 一直保留；`app/combine` 的命盘合参池把它作为可选第 9 法重新放回，
# 因此这里必须能按 key 加载它——「不默认跑」与「加载不到」是两件事。
EXTRA_METHOD_KEYS = [
    "xizhan",
]


def _load(key: str):
    """按文件路径加载 `<key>/analyzer.py`，返回其 `analyze` 协程。"""
    path = Path(__file__).parent / key / "analyzer.py"
    spec = importlib.util.spec_from_file_location(f"mingli_method_{key.replace('-', '_')}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.analyze


ANALYZERS = {k: _load(k) for k in METHOD_KEYS + EXTRA_METHOD_KEYS}

__all__ = ["ANALYZERS", "METHOD_KEYS", "EXTRA_METHOD_KEYS"]
