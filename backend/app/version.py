# -*- coding: utf-8 -*-
"""版本契约 · 单一版本源（2026-09-22 用户拍板：补「版本契约」地基）。

**为什么必须单独一个文件**：本仓要同时支撑三种形态（web 自部署 / APK 单机 /
APK 客户端），而**服务器端与 APK 端今后各自独立更新**（用户已拍板：不做自动同步）。
两端唯一的兼容判据就是版本号 —— 版本号一旦有两处定义就必然漂移，漂移 = 兼容判定
失效。故：全仓 `api_version` / `app_version` **只允许从这里取**。

口径：
- `APP_VERSION`：本仓（服务器端）发布版本，**与 `backend/pyproject.toml` 的
  `project.version` 保持一致**（现 0.1.0）；APK 壳的 `versionName` 用同一口径。
  `tests/unit/test_runtime_contract.py` 有一条不变量用例盯着这两个数不许漂。
- `API_VERSION`：**接口契约版本**，形如 `MAJOR.MINOR`：
  - `MINOR +1` = 向后兼容地**新增**（新端点 / 新字段 / 新增可选参数）；
  - `MAJOR +1` = **破坏性变更**（删字段 / 改语义 / 改响应形状 / 改错误码含义）。
  什么算破坏性、什么时候必须 bump、APK 壳与服务器的兼容矩阵 → 见
  `docs/standards/08-运行形态与版本契约.md`。
"""

# 服务器端发布版本（与 backend/pyproject.toml 的 project.version 同源同值）
APP_VERSION = "0.1.0"

# 接口契约版本（MAJOR.MINOR；bump 纪律见 docs/standards/08）
API_VERSION = "1.0"
