# 节 110 · index.html 超限拆分 —— 执行方案书（渐进切片）

状态：🟡 待办（方案书已就绪，待用户拍板后分节执行）｜ 强度：大改（单向门）｜ 日期：2026-09-10

## 用户原话
（审计发现）`frontend/public/index.html` 实测 21841 行，超过 `00_根/复用.md` §五红线「单文件超过 2 万行必须拆」。用户拍板：按**方案② 渐进切片**执行，并纳入旧 Vite+TS 参考源码的处理。

## 我的复述
把 21841 行的单文件前端，在**保持免构建架构不变**的前提下，分阶段拆成「入口壳 + 多个 .css/.js」，每阶段 git 留底、用户亲验、逐个模块推进；同时归档那套废弃的 `frontend/src/`（Vite+TS）参考源码。

## 期望形态（验收标准 · 用户可观察）
- 最终：`index.html` 降到 **< 2000 行**（只留 HTML 骨架 + vendor 引入 + 加载顺序 + 全局状态/路由/api）
- 页面行为、路由、样式与拆前**完全一致**（用户逐屏亲验）
- 免构建架构不变（无 Vite / 无 npm 构建；`node frontend/scripts/precompile.js` 门禁全绿）
- `frontend/src/`（旧 Vite 参考）已归档，全项目只剩**一套**前端真相源

## 0. 现状坐标（执行者必读）
- `frontend/public/index.html` = 21841 行权威入口；`frontend/public/admin.html` = 2374 行（后台，**独立文件，不在本拆分主目标**）
- 免构建管线：`frontend/scripts/precompile.js` 只处理 `public/index.html` + `public/admin.html` **两个**文件（代码里 `FILES = [...]`），把 `<script type="text/babel">` JSX 编译成普通 JS，产物引用全局 React/ReactDOM
- 全部是**全局作用域的普通 JS**（预编译后），组件/函数跨区块互相引用（拆分后**加载顺序**是关键风险）
- 已知大块：CSS 设计令牌 `:root` ≈37 行 + 大量组件/页面样式；`ModalBase` ≈2830 行；皮肤系统 `--skin-*`（guoxue/astrology/tarot/xishi/xingzuo/mbti）；9 法 / 西式 / MBTI / 档案 / 设置 / 后台 / 太初先生会话 各视图
- ⚠️ **执行第一步先做只读统计**（见阶段 0）：量出 CSS 段 vs JS 段各行数、列出最大的 20 个视图/组件，决定"第一刀切哪最划算"，不要盲拆

## 1. 拆分原则（硬约束，每阶段遵守）
1. **免构建**：不引入 Vite/构建链；用 `<link rel="stylesheet">` 引 .css、`<script src>` 引 .js（顺序加载）
2. **预编译守住**：拆出的 .js 只放"已预编译的普通 JS"；JSX 仅允许留在 index.html 骨架（或扩展 precompile 扫描新文件，见 §5）
3. **绝对路径**：新 .css/.js 内资源仍用根绝对路径 `/vendor/*`、`/art/*`（BUG-009 教训，禁止相对路径回归）
4. **单一事实源**：权威入口仍是 `frontend/public/index.html`；破坏这一条 = 返工
5. **一节一模块、可回退**：git 留底 → 拆 → 用户亲验 → 说"可以" → 下一个模块；不凑合、不跨模块拆

## 2. 分阶段执行（方案② 渐进切片）

### 阶段 0 · 建体系（1 个 session，起手必做）
1. **只读统计**：量 CSS/JS 行数分布 + 列最大 20 个视图/组件，抄进本节
2. **定拆分规范并落库**（写进 `00_根/复用.md` §五 + `00_根/导航.md`）：
   - 目标文件树（`css/`、`js/` 挂在 `frontend/public/` 下）
   - **加载顺序表**（`vendor → tokens.css → components.css → pages.css → components.js → 基础视图 → 各域视图 → 骨架挂载`）
   - 命名：`tokens.css` / `components.css` / `pages-*.css` / `components.js` / `views-<域>.js`
   - precompile 适配规则（见 §5）
3. **处理旧前端源码** `frontend/src/`（见 §6，独立归档，不与本拆分混做）

### 阶段 1 · 拆 CSS（1 个 session，第一刀最划算）
- 动作：把 `<style>` 内的设计令牌 / 组件样式 / 页面样式抽出为 `css/tokens.css`、`css/components.css`、`css/pages-*.css`，index.html 用 `<link>` 引
- 验收：页面样式与拆前逐屏一致（用户亲验首页 + 各皮肤切换），precompile 全绿
- 回退：git 留底，删 `<link>` 还原 `<style>`（一整阶段可回退）

### 阶段 2 · 拆通用件（1 个 session）
- 动作：`ModalBase` / `Toast` / `Skeleton` / 皮肤系统 / 共享工具 抽为 `js/components.js`
- 验收：弹窗、提示、骨架屏、皮肤切换照跑
- 强调：`components.js` 必须在任何使用它的视图**之前**加载（定义先于使用）

### 阶段 3 · 拆视图（多 session，按域逐节）
- 每节拆一个域：`views-guoxue.js`（九法/起卦/择吉/生肖）/ `views-xishi.js`（星座/塔罗/雷诺曼/配对）/ `views-mbti.js` / `views-cases.js`（档案/帮填）/ `views-agent.js`（太初先生）/ `views-onboarding.js`（建档/waiting/calibration/predict/revise/topic）…
- 每节：git 留底 → 抽该域 → 用户亲验该域 → 说"可以" → 下一个
- 顺序：`components.js` → 依赖它的基础视图 → 自带域的视图

### 阶段 4 · 收敛达标（1 个 session）
- index.html 只剩：HTML 骨架 + vendor 引入 + 加载顺序 + 全局状态（token/page/params/navigate）+ api 封装
- 达标：index.html **< 2000 行**；`00_根/复用.md` §五红线更新为「入口壳 <2000 行；单 .js/.css <5000 行」
- precompile 门禁多文件适配，本轮定稿

## 3. 加载顺序（最高风险，先画依赖地图）
- 现状：同一 `<script>` 内函数/组件靠全局作用域**互相引用**；拆分后必须「定义文件先于使用文件」
- ⚠️ 最容易翻车的错：某视图引用了「后面才加载」的组件 → 白屏。**每拆一步先画该域的依赖**（"它引用了谁、谁引用了它"），画进 `导航.md`

## 4. precompile 门禁适配
- 现有 precompile.js 只扫 `public/index.html` + `public/admin.html` 两个文件
- 拆出的 .js 若含 JSX → **扩展 precompile 的 FILES 列表**（读目录收集 *.js）；或规定「拆出的 .js 是编译后的普通 JS、禁止再写 JSX」
- 红线不变：**禁止浏览器端 `<script type="text/babel">` 实时转译**

## 5. 旧 Vite+TS 参考源码处理（frontend/src/）—— 用户点名要求
**现状**：`frontend/src/` 是 Vite5 + React18 + TS5 脚手架（react-router / antd-mobile / axios / react-query / zustand），与运行中的免构建 CDN React 是**两套不同技术栈**；是早期废弃方向（`frontend/README.md` 还停在「待补：工程初始化」）。它和 `public/index.html` 构成**第二套前端真相源**，违反破竹铁律 2（单一事实源）。

**推荐：归档（不删）**：
1. `git mv frontend/src` → `docs/_archive/前端-vite-ts-参考实现/`，加 README 横幅「历史参考、不参与运行、技术栈不同、勿以之为准」
2. 同批处理 Vite 构建链文件：`frontend/package.json`、`vite.config.ts`、`tsconfig.json`、`package-lock.json`（运行层不依赖，归档或删除均可）
3. `frontend/taichu-h5-prototype.html`（78KB 早期原型）一并归档
4. 重写 `frontend/README.md`（现还在写 Vite 栈，会误导）→ 改为「权威入口 = public/index.html（免构建）；src/ 已归档」
5. 更新 `00_根/导航.md` + `00_根/复用.md`：「frontend/src/ 为旧 Vite 参考」改述为「已归档」

- **为什么不删**：FE-001 ADR 明确「超 30k 行或团队 ≥3 人时评估迁 Vite 工程化（Phase2）」——src/ 是未来迁回的参考起点；破竹原则「归档 > 删除」。
- **后果一句话**：不处理，下个 agent 打开项目会看到两套前端源码，极易拿 src/ 当真相去改，产生「改了不生效」的返工。

## 6. 禁碰清单
- 不碰 `backend/`（app / paipan-node / data）、`ops/`、`Dockerfile`、`Caddyfile`、`.env`
- 不碰 `admin.html`（后台拆分另立，非本范围，最多阶段 4 顺带评估）
- 不改任何接口契约（`method-result v2` / `chart.json`）
- 不引入构建链 / npm 运行时新依赖
- 不动 `frontend/public/vendor/`（本地化 React 已是编译后产物）

## 7. 控制点
- 回归：每阶段跑 `node frontend/scripts/precompile.js` + 关键路径冒烟（首页 / 登录 / 建档 / 一个解读页 / 档案）
- 安全/数据：不适用（纯前端静态重构，无鉴权/数据改动）
- 缓存：拆分上线首次给 .css/.js 加版本（文件名 hash 或 `?v=`），并提示用户强刷（Ctrl+F5）

## 8. 每阶段验收协议（破竹 v0.11 三拍）
- (a) Agent 拉起环境交地址 → (b) 用户亲自点各页面 → (c) 用户说「可以」→ 文字留痕（节文件）+ git 留底
- 前端用户亲验；**不用截图**（截图仅用户明确要求时做一次）

## 9. 结构反思（每阶段收尾，破竹 §8）
- 拆到某处发现「某组件和某视图耦合过深、拆不动」→ 写一句结构反思（哪里难 / 怎么改 / 下次会怎样），**不要硬拆**

## 10. 与并行工作的协调（重要）
- ⚠️ index.html 当前有**他人未提交的改动**（首页吉祥物「侧边定位模式」）。执行阶段 0 之前**必须先与那份工作对齐 / 合并**，否则拆分基础就含未提交内容（会污染 git 历史）。

## 11. 待用户拍板 / 交付物
- 方案书（本文件）＝ 交付物，供另一 session 按阶段执行
- 执行者每完成一个阶段，在本文件标注阶段状态（🟡→🔵→🟠→🟢），并在 `00_根/入口.md` 同步「下一步」

## 用户结论
待验收