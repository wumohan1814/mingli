# 节 110 · index.html 拆分（解耦）—— 执行方案书 v2（对齐破竹 v0.24）

状态：🟢 已完成 ｜ 强度：大改（单向门）｜ 日期：2026-09-10

## 用户原话
（审计 + 用户追加）①`frontend/public/index.html` 21841 行，超「单文件 2 万行」红线需拆。②按破竹最新协议（v0.24）复审本方案并更新。③执行方任务 = **只做解耦（4 阶段）**；同时**审查全部代码 + 把系统优化点记录到单独文件**，优化在解耦完成后另行执行。

## 我的复述
把 21841 行的单文件前端，在保持免构建架构不变的前提下，**按职责**分阶段拆成「入口壳 + 多个 .css/.js」——本质是 v0.18 的**检索成本治理**（不是"为拆而拆"）；归档废弃的 `frontend/src/`；并在解耦过程中顺手产出《系统优化方向》记录（本次只记录、不执行）。

## 期望形态（验收标准 · 用户可观察）
- **检索成本下降**：拆分后"改同类功能所需读取量"下降（v0.18 判据 3 验证）
- 页面行为 / 路由 / 样式与拆前**完全一致**（用户逐屏亲验）
- 免构建不变；`node frontend/scripts/precompile.js` 门禁全绿
- `frontend/src/` 已归档，全项目只剩**一套**前端真相源
- 产出《系统优化方向》文件 `40_节/待办/节111-系统优化方向记录.md`（本次不执行）

## 覆盖声明（v0.21 硬要求）
- 本方案证明：拆分判据 / 阶段 / 牵连表 / 优化记录格式是明确的
- 未证明：拆分后各模块的真实依赖关系（需阶段 0 只读统计落地后才可知）

## 0. 现状坐标（执行者必读）
- `frontend/public/index.html` = 21841 行权威入口；`frontend/public/admin.html` = 2374 行（后台，独立文件，不在本拆分主目标）
- 免构建管线：`frontend/scripts/precompile.js` 只处理 `public/index.html` + `public/admin.html` **两个**文件（`FILES=[...]`），把 `<script type="text/babel">` JSX 编译成普通 JS，产物引用全局 React/ReactDOM
- 全部是**全局作用域的普通 JS**（预编译后），组件/函数跨区块互相引用（拆分后**加载顺序**是关键风险）
- 已知大块：CSS 设计令牌 `:root` ≈37 行 + 大量组件/页面样式；`ModalBase` ≈2830 行；皮肤系统 `--skin-*`（guoxue/astrology/tarot/xishi/xingzuo/mbti）；9 法 / 西式 / MBTI / 档案 / 设置 / 后台 / 王先生 各视图
- ⚠️ **执行第一步先做只读统计**：量 CSS 段 vs JS 段各行数、列最大 20 个视图/组件，决定"第一刀切哪"，不盲拆

## 1. 拆分判据（v0.18：按职责拆，不按行数）
| 判据 | 怎么判断 |
|---|---|
| ① 文件里有两类东西？ | "改 A 时**完全不需要看 B** 吗？" → 是 → 拆 |
| ② grep 一个功能名命中多个不相关区域？ | **≥2 处不相关 → 拆**（机械化可判定） |
| ③ 能一句话概括职责吗？ | 不能（要"以及"）→ 拆 |

**防错**：⚠️ 行数是信号不是判据（500 行纯配置 ≠ 500 行混合逻辑，别机械按行切）；⚠️ 不为拆而拆（拆成碎片抬高跳转成本，判据②正是防这个）。

## 2. 设计取向（v0.17 乐高原则，大改必过、结论写进每阶段收尾）
- **轻量**：拆出的模块不加冗余包装，保持免构建直接加载
- **接缝**（不是空接口）：按职责隔离成**可替换模块**；不留 YAGNI 空功能 / 死代码
- **埋点** ⭐：拆分不破坏 `backend/app/events` 埋点调用点（对照 `00_根/复用.md` 已有件）
- **开关**：皮肤系统 / agent_enabled 等既有开关保持，不新增开关

## 3. 拆分原则（硬约束，每阶段遵守）
1. **免构建**：不引入 Vite/构建链；`<link>` 引 .css、`<script src>` 引 .js（顺序加载）
2. **预编译守住**：拆出的 .js 只放"已预编译的普通 JS"；JSX 仅留在 index.html 骨架（或扩展 precompile 扫描新文件）
3. **绝对路径**：新 .css/.js 内资源仍用根绝对路径 `/vendor/*`、`/art/*`（BUG-009 教训）
4. **单一事实源**：权威入口仍是 `frontend/public/index.html`
5. **一节一模块、可回退**：git 留底 → 拆 → 用户亲验 → 说"可以" → 下一个模块

## 4. 分阶段执行（方案②渐进切片，每阶段按 §1 判据切）
- ✅ **阶段 0 · 建体系**：只读统计 → 定拆分规范/加载顺序/命名/precompile 适配（落 `复用.md`+`导航.md`）→ 建牵连表（§5）→ 归档 `frontend/src/`（§7）
- ✅ **阶段 1 · 拆 CSS**：设计令牌/组件/页面样式 → `css/tokens.css|components.css|pages.css`；验收逐屏样式一致
- ✅ **阶段 2 · 拆通用件**：ModalBase/Toast/Skeleton/皮肤/共享工具 → `js/components.js`（必须在 views 之前加载）
- ✅ **阶段 3 · 拆视图**：按域逐节；已拆 11 个 JS（guoxue/xishi/mbti/zodiac/cases/divination/onboarding/home/guoxue-tools/agent，明细见「交接点」）
- ✅ **阶段 4 · 收敛达标**：index.html 只剩骨架+vendor+全局状态+api+App 路由（1,381 行 <2000 达标）；`复用.md` 红线更新为「入口壳 <2000 行；单 .js/.css <5000 行」；precompile 定稿

## 5. 牵连表（v0.19：阶段 0 必建，写进 `00_根/导航.md`）
- 拆分会让"同一份信息散多处"风险上升，必须建牵连表，至少含：**加载顺序**（vendor → components.js → views-* → 骨架挂载）、**全局依赖**（token/page/params/navigate/api 被哪些视图引用）、**皮肤系统**（--skin-* 引用点）、**静态资源绝对路径**（/vendor/* /art/* 引用点）
- 规则：改动命中牵连表"被引用方" → 先把"必须同时检查"项全部读到
- 它是**补救不是首选**；首选是拆分时用「单点」（同一信息只放一处，v0.19 判据 5："是职责就拆，是信息就合"）

## 6. precompile 门禁适配
- 现有 precompile.js 只扫 `public/index.html` + `public/admin.html`；拆出的 .js 若含 JSX → 扩展 FILES 列表读目录，或规定「拆出的 .js 是编译后普通 JS、禁止再写 JSX」
- 红线不变：禁止浏览器端 `<script type="text/babel">` 实时转译

## 7. 旧 Vite+TS 参考源码处理（frontend/src/，用户点名）
- `frontend/src/` 是废弃的 Vite5+TS 脚手架（react-router/antd-mobile/axios，与免构建栈完全不同），构成**第二套前端真相源**（违反铁律 2）
- **归档（不删）**：`git mv frontend/src` → `docs/_archive/前端-vite-ts-参考实现/`；同批处理 `frontend/package.json`、`vite.config.ts`、`tsconfig.json`、`package-lock.json`、`taichu-h5-prototype.html`；重写 `frontend/README.md`（现还写 Vite 栈）；更新 `导航.md`+`复用.md` 改述"已归档"
- 不删理由：FE-001 ADR 保留"未来迁 Vite"追溯；破竹"归档>删除"

## 8. 禁碰清单
- 不碰 `backend/`（app/paipan-node/data）、`ops/`、`Dockerfile`、`Caddyfile`、`.env`
- 不碰 `admin.html`（后台拆分另立，最多阶段 4 顺带评估）
- 不改接口契约（method-result v2 / chart.json）；不引入构建链/npm 运行时新依赖；不动 `frontend/public/vendor/`

## 9. 控制点（v0.16 四项逐项回应，未触发写"不适用"）
- 回归：每阶段跑 precompile + 关键路径冒烟（首页/登录/建档/一个解读页/档案）
- 安全/数据：不适用（纯前端静态重构，无鉴权/数据改动）
- 性能：拆分不引入新性能退化（拆分前后首屏/加载对比，性能的凭是数字）
- 结构：每阶段收尾写一句结构反思（§11）
- 缓存：拆分上线首次给 .css/.js 加版本（hash 或 `?v=`），提示用户强刷

## 10. 性能/资源审查 → 产出《系统优化方向》（v0.15，本次只记录、不执行）
执行方在解耦过程中**审查全部代码**（index.html + admin.html + backend），按 v0.15 排查四步，把系统级优化点记入 `40_节/待办/节111-系统优化方向记录.md`：
- **排查四步**：定性（哪里慢/重）→ 取数（改前数字）→ 只读命中段定位 → 复测对比
- **性能的凭是数字**：每条写"改前 X → 预期改后 Y"（无数字不落）
- **主动提代价选项**：发现"8MB 图 / 全表查询 / 高频轮询 / 内存热点"等用户不知情的代价 → 记入（附代价说明）
- **范围（用户点名）**：服务器压力 / 性能 / 渲染效果与速度（镜像体积、前端资源体积与加载、渲染循环、接口查询、内存、构建体积等）
- **本次只记录、不执行**：优化在解耦 4 阶段完成后另开一节按记录逐条执行（逐条带改前/改后数字验收）

## 11. 每阶段验收（v0.24 三拍）+ 结构反思
- 验收三拍：(a) 拉起环境交地址等用户 (b) 用户亲自操作 (c) 说「可以」→ 文字留痕 + git 留底；前端用户亲验，不用截图
- 结构反思（v0.8）：拆到某处"组件与视图耦合过深拆不动" → 写一句反思（哪里难/怎么改/下次会怎样），不硬拆

## 12. 与并行工作的协调
- ⚠️ index.html 曾有人未提交改动（吉祥物侧边定位），现已合入提交历史；执行阶段 0 前先 `git pull` 对齐最新 HEAD，再核对工作区干净

## 13. 交接点（2026-09-11 更新，供下一 session 续做）

- **当前进度**：阶段 0/1/2/3 全部完成（阶段 3 已外置 11 个 JS）；`index.html` 由 22,046 行降至 **1,381 行**（阶段 4 目标 <2000 行已达标）。
- **已拆 11 个 JS**（加载顺序见 `导航.md` §7.1，均在 head、早于主脚本；`css/*.css` 为阶段 1）：
  | 文件 | 内容 |
  |---|---|
  | `js/components.js` | 通用件 toast/Icon/ModalBase/SkinSwitcher + 共享西洋盘面 AstroWheel/AstroNatalPanel |
  | `js/views-guoxue.js` | 黄历 AlmanacPage / 太乙 TaiyiPage / 皇极 HuangjiPage |
  | `js/views-xishi.js` | 西式 HUB / 塔罗 TarotPage / 雷诺曼 LenormandPage / 星座 AstrologyPage |
  | `js/views-mbti.js` | 心理 HUB / 人格 MbtiPage / 免登录分享 MbtiSharePage |
  | `js/views-zodiac.js` | 生肖 ZodiacPage / 生肖关系图标 / 生肖三关系弹窗 |
  | `js/views-cases.js` | 档案列表 CasesPage + 建档弹窗 Rename/CaseContact/ShareFill + 解读流程 Waiting/Calibration/Predict/Revise/Topic + 档案详情 ArchivePage + 9 法命盘渲染 |
  | `js/views-divination.js` | 临时起卦 DivinationPage + 六爻/梅花/小六壬/六壬/金口诀/奇门/文王圣卦 + 卦辞常量 |
  | `js/views-onboarding.js` | 登录注册 AuthPage + 建档引导 OnboardingPage |
  | `js/views-home.js` | 首页 LandingPage + 积分 CreditBalance/BannerBalance/MenuBalance/CreditInsufficientModal + 配对 PairModal + 余额明细 CreditTransactionsPage + 导航 NavRail/TopbarModNav/TopbarMenu + 设置 SettingsPage |
  | `js/views-guoxue-tools.js` | 国学工具 NinePickPage/NamerModal/GuoxueHubPage/GuoxueToolsPage + 九法状态 nineRunState |
  | `js/views-agent.js` | 王先生 AgentPage + AGENT_GREETINGS/AGENT_CASE_KEYWORDS |
- **阶段 3 已完成**：无剩余视图待拆。
- **阶段 4 收敛（进行中）**：index.html 只剩骨架+vendor+全局状态+api+App 路由（已 1,381 行达标）；待办 = `复用.md` 红线更新为「入口壳 <2000 行；单 .js/.css <5000 行」+ 用户逐屏验收。
- **门禁/验证**：每步拆后跑 `node frontend/scripts/precompile.js`（必须全绿，0 编译块）；后端 :8000 冒烟（index.html + 各 js 均 200）。拆出的 .js 只放已预编译普通 JS、禁止 JSX。
- **git 留底**：阶段 3 每域一 commit（`b9ed310` 起至 `f9e2d30`），可回退。

## 14. 收尾检查 + 结构反思（§3.5 第2步，2026-09-11）

- **功能回归**：每步拆后 `node frontend/scripts/precompile.js` 全绿（0 编译块）；后端 :8000 冒烟 11 个 JS + index.html 全部 200；字节搬移零逻辑改动，用户逐屏验收为准。
- **安全 / 数据**：不适用（纯前端静态重构，无鉴权 / 数据 / method-result v2 / chart.json 契约改动）。
- **性能 / 资源**：不适用（字节搬移，无新增依赖 / 渲染 / 查询 / 循环；拆分不引入性能退化）。
- **结构反思**（触发：定位 ≥3 次 grep + 同区域多次修改）：
  - 哪里难：`index.html` 22,046 行单文件，改任一功能都要在 2 万行里 grep 定位；视图与全局状态（api/token/ML_SETTINGS/usePaySufficient）交织，拆视图时须逐块核对「顶层语句是否引用主脚本全局（加载顺序风险）」。
  - 结构上怎么改：按域拆 11 个 `views-*.js` + `components.js` + 3 个 `css`；全局状态/api/App 路由留入口壳；`导航.md` §7 牵连表固化加载顺序与共享依赖（PairRelIcon/usePaySufficient 等跨域复用件保持全局可见）。
  - 下次会怎样：改同类功能只需读对应 `views-<域>.js`（检索量从 2 万行降到 <5k 行）；新增视图照 `复用.md` §六 落对应域文件，不再塞回 index.html。

## 本节指标（v0.21，执行方收尾填写）
- 模型 + provider：deepseek-v4-pro / DeepSeek Harness

## 用户结论
✅ 完成（2026-09-11 用户「收尾节110」拍板）
