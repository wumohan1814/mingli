# src/ — 源码

> **权威运行件说明**：当前实际对外服务的是 **`frontend/public/index.html`**（免构建 CDN React + Babel Standalone，由 FastAPI 直接静态托管）。本目录 `src/` 是 **Vite + TS + antd-mobile** 源码参考实现；沙箱环境当前会阻止 Vite/esbuild 构建，故 `src/` **不参与运行**。
>
> 合并时以 `index.html` 为准，本目录需保持与之一致：
> - **皮肤令牌**：使用 `--skin-accent`（内部标识色：按钮/吉/描边）+ `--skin-banner`（顶部 Banner / 底部胶囊），见 `styles/tokens.css`；最终值以 `index.html` 内联定义为准（国学内部=玉青#3E7C6B、Banner=朱砂#B23A3A；占星内部=深空蓝#2A3A5C、Banner=月银#C9CBD3；塔罗内部=琥珀#C9A24B、Banner=紫晶#5B4B8A）。
> - **接口契约（双信封并存，切勿统一 unwrap）**：`/auth/*` 返回裸包 `{access_token, refresh_token}`；`/cases`、`/jobs` 返回 `{code, data, meta}`。见 `services/api.ts` 的 `unwrap`。
> - **页面清单**：landing / auth / onboarding / waiting / calibration / predict / revise / archive（共 8 页），与 `index.html` 路由对齐。

## 分层依赖方向（只允许单向依赖）

```
pages → components → services → types
  └──────────────── → stores / hooks / utils
```

- `pages/` 可依赖任意下层；`components/` **不得**反向依赖 `pages/`。
- `types/` 是最底层，不依赖任何层。
- 跨层共享逻辑放 `hooks/` 或 `utils/`，不放 `components/`。

## 子目录

| 目录 | 用途 |
|---|---|
| `pages/` | 路由级页面 |
| `components/` | 可复用组件（基础 / 业务 / 盘面渲染） |
| `layouts/` | 页面框架与导航 |
| `hooks/` | 自定义 Hook |
| `services/` | REST 客户端、轮询、鉴权拦截器 |
| `stores/` | 客户端状态容器 |
| `styles/` | 设计令牌、主题、全局样式 |
| `assets/` | 图标 / 字体 / 插图 |
| `types/` | 与接口字典对齐的类型定义 |
| `utils/` | 无副作用工具函数 |
