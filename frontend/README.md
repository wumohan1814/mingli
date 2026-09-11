# frontend/ — 免构建 H5 前端

技术栈：**免构建 CDN React 18（全局 React/ReactDOM）+ 原生 ES**。无 Vite、无打包器、无 npm 运行时依赖。

权威入口：`public/index.html`（+ `public/admin.html` 后台），由后端静态服务（SPA fallback）。

## 目录

| 路径 | 内容 |
|---|---|
| `public/` | 运行期静态根：入口 `index.html` + 后台 `admin.html` + `sw.js` / `manifest.webmanifest`（PWA）+ `vendor/`（react/react-dom/regions）+ `data/`（pairs/term-cards/ui-copy）+ `art/` / `tarot/` / `lenormand/`（美术素材） |
| `scripts/precompile.js` | JSX 预编译门禁：把 `public/index.html` / `admin.html` 内 `<script type="text/babel">` JSX 编译成普通 JS。**改 JSX 后必跑：`node scripts/precompile.js`** |
| `scripts/smoke-check.js` | 语法冒烟检查 |

## 关键约束

1. **免构建**：不引 Vite/打包器；`<link rel="stylesheet">` 引 `.css`、`<script src>` 引 `.js`（顺序加载，见 `../00_根/导航.md` §7 牵连表）。
2. **权威入口唯一**：只有 `public/index.html`（+ `admin.html`）。旧 Vite+TS 参考源码已归档至 `_archive/前端-vite-ts-参考实现/`（节110；`_archive/` 在**项目根**，2026-09-11 按破竹协议从 `docs/_archive/` 迁出）。
3. **静态资源根绝对路径**：`/vendor/*` `/art/*` `/data/*`（BUG-009 教训）。
4. **改 JSX 必跑门禁**：`node scripts/precompile.js`；禁止浏览器端 `<script type="text/babel">` 实时转译。
5. **拆分约定（节110）**：入口壳逐步拆为 `css/*.css` + `js/*.js`；拆出的 `.js` 是编译后普通 JS、禁止再写 JSX。详见 `../00_根/复用.md` §六。