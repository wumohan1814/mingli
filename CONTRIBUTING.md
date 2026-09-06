# 贡献指南

> 简洁版协作约定。详细工程规范见 `docs/standards/`（命名、技术栈、接口与数据字典、环境与部署、版本迭代），文档写作约定见 `docs/README.md`。

## 项目结构

| 路径 | 说明 |
|---|---|
| `backend/` | FastAPI 模块化单体后端（`app/` 下 9 个方法模块、异步任务、档案 / 反馈 / 合规等）；依赖声明于 `pyproject.toml`，测试在 `backend/tests/` |
| `frontend/` | 前端：**实际生效**的是免构建的 `public/index.html`（CDN React + Babel Standalone，已本地化到 `public/vendor/`）；`src/` 为旧 Vite + TS 参考源码，不参与运行 |
| `docs/` | 工程活文档：`standards/` 强制规范、`adr/` 架构决策记录、`runbooks/` 运维手册，以及交接 / 人工注意点等说明 |
| `reference/` | 参考仓库（mingli skill、排盘引擎等第三方资料，只读不并入） |

## 跑测试

提交前必须通过全部测试：

```bash
cd backend
python -m pytest -q
```

首次运行需先安装依赖（含 pytest 的开发依赖）：`pip install -e "backend[dev]"`（在仓库根目录执行）。

## 如何新增一个方法模块

1. **实现**：在 `backend/app/methods/<key>/` 下新建模块（参考现有模块，暴露 `analyze` 协程）。
2. **提示词**：在 `backend/prompts/method-prompts/<key>.md` 新增对应 method prompt。
3. **注册**：把 `<key>` 加入 `backend/app/methods/__init__.py` 的 `METHOD_KEYS` 列表（注册顺序与 slicer / 路由表对齐）。
4. 需要时同步 `docs/standards/03-接口与数据字典.md`（跨模块唯一协商点）。

## 提交流程

1. 改完先跑 `python -m pytest -q`，确保全绿；
2. 遵守 `docs/standards/01-命名与变量约定.md` 与既有代码风格；
3. 新增 / 变更了文档规范时，在 `docs/standards/05-版本迭代记录.md` 登记；
4. 不提交真实密钥：key 只放本地 `backend/.env`（git 忽略），其余位置一律使用占位符。
