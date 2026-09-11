"""冒烟：确认 app 能 import、路由表可枚举。

依赖解析：本地依赖装在**系统 Python**（见 `99_状态/已知问题.md`「backend/.venv 里没有 pytest」）。
历史上有 vendor 目录 `backend/packages/`，已于 2026-09-11 从版本库移除
（破竹 §4 排他清单：vendored 第三方完整源码不进库），故不再手动改 `sys.path`。

用法：`cd backend && python test_import.py`
"""
from app.main import app

print("App loaded OK")
print("Routes:", [r.path for r in app.routes])
