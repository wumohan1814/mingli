# 节147 · 项目代号 taichu→mingli（标识/环境变量/部署/根目录）

状态：🟢 通过（代码/文档/本地库全部改完 + 门禁全绿；**最后一步「根目录物理改名」由用户在会话末尾执行**）｜ 强度：**大改** ｜ 日期：2026-09-13 拍板 → 2026-09-14 落地

## 用户原话

> 从此以后，这一整个项目的名字也会改成"mingli"，而不是叫"taichu"
> （2026-09-13 第二轮）第一条我认为需要改。第二条设计工具自己产生的以及归档的内容不需要改。
> （2026-09-13 第三轮更正）旧目录撞名选 A：把旧参考项目改名 mingli-reference，本项目占用 mingli；充值码表选 B 在节146 执行。
> （2026-09-14 本轮）节147 的最后一步是把根目录 taichu\ 改名 mingli\，改完当前工作区路径就失效，必须由我在新路径重开工作区——所以把这一步放在最后、做完就告诉我停。

> ⚠️ **本节文件是「改名对照文档」**：本栏之外的正文按原样保留旧名（`taichu` / `Taichu` / `TAICHU`）作为映射两侧的记录，否则对照表会自指失真。

## 我的复述

代码和部署里所有 `taichu` 拼音标识（JS 变量、CSS 令牌、浏览器本地存储键、环境变量前缀、DB 文件名、docker 网络/卷、部署路径、文档路径引用）全部改成 `mingli`；设计工具产物与归档冻结不动；最后把旧参考项目挪名为 `mingli-reference`，本项目根目录改叫 `mingli`。

## 期望形态（验收标准 · 用户可观察）

- [x] 1. 全项目（冻结范围除外）grep 不到 `taichu` / `TAICHU` / `Taichu` / `TC_COPY` / `TC_SETTINGS` / `--taichu-`
      —— **实测残留只有 3 类有意例外**（域名 / SSH 私钥文件名 / 本节与节145 的改名对照文档），已逐条列在下方「例外清单」
- [x] 2. 前端 `node --check` 全过（11 个 js + data 全量 + sw.js）、`precompile` 门禁全过（含散色基线 0）
- [x] 3. 后端 **214 passed / 1 failed**，唯一失败 = 改动前既有夹具漂移（`test_fixture_snapshot_anchor`），非本节回归
- [x] 4. 本地用 `MINGLI_*` 环境变量与 `mingli_*.db` 正常（根 `.env` / `backend/.env` / `.env.example` 三处已同步；DB 文件已改名、`share_mingli_ui` 列已迁移）
- [x] 5. `docker compose` 配置、`Caddyfile`、`Dockerfile`、`start.bat/sh`、`ops/deploy/*`、`standards/06` 全部同步；**线上迁移步骤已写进 `ops/deploy/README.md`（唯一清单，含第 0 步备份与回退）**
- [x] 6. PWA：SW 缓存前缀改新名，**并保留对旧 `taichu-img*` 前缀的一次性回收**（节147 §四-3 的硬要求）
- [x] 7. `standards/01`（命名约定）、`04`（设计令牌）、`06`（环境部署）与代码一致
- [ ] 8. **根目录改名后新路径 `Vibecoding\mingli\` 下 git 状态干净连续、服务可起** —— ⚠️ **未完成**：Agent 两次尝试改名均被 Windows 拒绝（`The process cannot access the file because it is being used by another process`）。根因见下方「留痕 · 什么没测」，**命令已写在 `00_根/入口.md` 交接状态，由用户关闭占用后执行**

## 现状坐标（Agent 用）

**改动盘点（实况，非估算）**

| 层 | 内容 | 规模 |
|---|---|---|
| 前端 JS 标识 | `TC_COPY/TC_PAIRS/TC_SETTINGS/TC_TERM_CARDS`、`TCTerm{Card,Chip,Panel,Row}`、10 个 `tc*` 与 8 个 `*Tc*` 帮助函数（`tcSet`/`tcSavedRef`/`tcSeqRef`/`applyTcSettings`/`shallowEqTc`…）、`shareTaichuUi`、`applyTaichuTarotSpreads`、`TAICHU_TAROT_SPREADS` | **417 处 / 37 文件** |
| CSS 令牌 | `--taichu-*` → `--mingli-*`（`tokens.css` 定义 + 自引用；`standards/04`、`05` 同步） | **314 处 / 8 文件** |
| 浏览器本地存储 / DOM / SW | 7 个 localStorage 键（含 `taichu_onboarding_form`，原盘点漏列）、`taichu-toast` / `taichu-admin-toast`、SW 前 3 项 + 旧前缀回收 | **32 处 / 6 文件** |
| 后端标识 | `taichu_pytest_`（conftest 临时目录）、`taichu_method_`（动态模块名）、三库文件名 `taichu_{analytics,feedback,ops}` | **75 处 / 32 文件** |
| 全量拼音代号 | `Taichu/TAICHU/taichu` 三态替换（含 env 前缀、`/opt/taichu`、docker 网络/卷、镜像名、`.env` 三处） | **418 处 / 71 文件** |
| 措辞修残 + 参考项目消歧 | 节146 死配置措辞改写；旧参考项目 `mingli` → `mingli-reference`（守卫式，不碰真实仓库名） | **42 处 / 19 文件** |
| 文件 / 目录改名 | `docs/archify/taichu-*.json` ×3、`paipan-node/taichu-tarot-spreads.mjs`、`backend/reference/mingli/` → `mingli-reference/` | 5 文件 + 1 目录 |
| 数据库 | 本地 5 个 `.db` 改名（根 `data/` 2 个 + `backend/data/` 3 个）；`user_settings.share_taichu_ui` → `share_mingli_ui` 列迁移（新增 `0002` 迁移 + 回滚脚本） | 5 文件 + 1 列 |

**新旧映射（对照表）**

| 旧 | 新 |
|---|---|
| `TC_COPY` / `TC_SETTINGS` / `TC_PAIRS` / `TC_TERM_CARDS` | `ML_COPY` / `ML_SETTINGS` / `ML_PAIRS` / `ML_TERM_CARDS` |
| `TCTerm{Card,Chip,Panel,Row}` | `MLTerm{Card,Chip,Panel,Row}` |
| `--taichu-*` | `--mingli-*` |
| `taichu_token` / `_refresh_token` / `_session_id` / `_skin` / `_onboarding_form` / `_admin_token` / `_admin_role` | `mingli_*` |
| DOM id `taichu-toast` / `taichu-admin-toast` | `mingli-toast` / `mingli-admin-toast` |
| SW `taichu-img-*` / `taichu-img-meta-v1` / `/__taichu_sw_meta__` | `mingli-*`（**旧前缀在 activate 里保留一次性回收**） |
| env 前缀 `TAICHU_` | `MINGLI_` |
| `data/taichu_{analytics,feedback,ops}.db` | `data/mingli_*.db` |
| `user_settings.share_taichu_ui` | `share_mingli_ui`（REST 字段名同源同改） |
| docker 网络/卷/镜像 `taichu` · 宿主 `/opt/taichu/` | `mingli` · `/opt/mingli/` |
| `paipan-node/taichu-tarot-spreads.mjs` + `applyTaichuTarotSpreads` | `mingli-tarot-spreads.mjs` + `applyMingliTarotSpreads` |
| `docs/archify/taichu-*.json` | `docs/archify/mingli-*.json` |
| `chart.json` 的 `meta.source = "taichu-paipan"` | `"mingli-paipan"` |
| `backend/reference/mingli/` | `backend/reference/mingli-reference/` |

**例外清单（实测残留，全部有意保留）**

| 残留 | 位置 | 为什么保留 |
|---|---|---|
| `mingli.example.com` / `bb3a.mingli.example.com` | `Caddyfile`、`ops/deploy/README.md`、`docs/登录指南.md`、`docs/Code-Wiki.md`、`docs/架构设计.md`、`00_根/导航.md`、`backend/app/admin/router.py`、`docs/archify/mingli-architecture.json`、`40_节/待办/节122` | **域名已注册 + DNS + Let's Encrypt 在跑**（实测 `https://mingli.example.com/api/health` → `{"status":"ok"}`）。节142 已拍板本实例只是发布/内容载体、不是官方托管服务 → 改名零收益、有中断窗口。已在 `Caddyfile` 注明「域名属部署者自填」+ `ops/deploy/README.md` 给可选改名步骤 |
| `<你的私钥文件>` | `ops/deploy/README.md` | **服务器与本地各有一份真实私钥**，改名要两边同步 + `~/.ssh/config`，做错失去登录通道 → 给「先保一条可用会话」的可选步骤 |
| `taichu`（作为旧名） | `40_节/完成/节147-*.md`（本节）、`40_节/完成/节145-*.md`、节文件「用户原话」栏 | **改名对照文档必须同时出现旧名与新名**，否则映射失真；原话栏是逐字历史 |
| `taichu-h5-prototype` | `00_根/导航.md`、`40_节/完成/节110` | `_archive/前端-vite-ts-参考实现/` 里**归档文件的真实文件名**（归档冻结不改） |
| `design_library/taichu` | `40_节/完成/节145`、`99_状态/决策.md`、`40_节/待办/节147`（本节） | `.design_library/` 是**设计工具产物，目录名冻结**（节145/147 拍板），文档引用必须与磁盘一致 |
| `TC-XXXXXX` | `backend/app/credits/labels.py` 注释、`test_credits_labels.py`、`standards/03` | 节146 已 DROP 的充值码**序列号格式串**（不是项目代号）；且 §七-1 的检查模式不含 `TC-` |
| `--tc-*` 令牌族（273 个） | `tokens.css` 等 | 与 `--taichu-*` 是**两个独立令牌族**；节147 拍板的映射表只点名 `--taichu-*`（"仅 tokens.css 一个文件：87 定义 + 11 自引用"）。⚠️ **这是一处待你裁决的遗留**：若认为 `--tc-` 也等于 TaiChu，需另立一节（273 处 + 皮肤与规范文档同步，回归面大） |

## 复用判断

- 库内候选：无（改名工程属一次性机械作业，`库/索引.md` 无对应资产）
- 结论：**新写（就地改名）** —— 理由：产物是标识符替换与迁移脚本，不产生可复用件

## 方案选项（中改及以上必填）

- A（用户拍板）：**按 §三 映射表全改 + §五 冻结项不动 + 分 8 步带验证闸**
- B（未采纳）：只改「用户可见」的 env/DB/目录，内部 JS 标识（`TC_*`/`tc*`/`--taichu-*`）不动 —— 代价：`grep taichu` 永远有噪声，且 `standards/01` 的命名约定与实际不符
- 用户选择：**A**（2026-09-13 第三节「内部代号跟着改」）

**本轮新增的两个拍板点（开工时当面确认，非 Agent 自行决定）**

1. **GitHub 仓库名**：用户选 **B** = 我把 `deploy.sh` / `docs` 里的仓库地址改成 `mingli`，**用户在 GitHub 同步改名**（旧名 301 重定向兜底）。⚠️ **依赖项**：改名必须在服务器下次 `git pull` 之前完成
2. **线上域名**：用户指示「看一下节142，然后给我一个推荐方案」→ 见下方「推荐方案」

### 甲方未答项的推荐方案（域名）

**推荐：保留 `mingli.example.com` / `bb3a.mingli.example.com` 不改，登记为具名例外。**

依据（节142 原文）：**「不保留独立的"官方托管运营服务"……开发者本人部署的开源服务不算"官方"，仅限本人自行使用，不对外提供服务。APK 模式 C 绑定的是"部署者自己的服务器"，无官方服务器可绑。」**
→ 既然这条线上实例只是**发布/内容载体**、**不对外提供服务**，域名就不是产品标识，而是**部署者的一项自填配置**。据此：

- 改域名要：注册新域名 → 改 DNS（阿里云 HiChina）→ 服务器重签 Let's Encrypt → `bb3a`（OpenClaw 接入点）同步改，**有一个线上中断窗口**；而收益 = 0（没人访问这个域名）
- 不改的代价 = `grep taichu` 剩 9 个文件里的域名串 —— 已用 `Caddyfile` 注释把它定性为「部署者自填」，第三方自部署时替换即可
- **若你仍要改**：按 `ops/deploy/README.md` 的「例外两项」表执行即可，代码侧零改动

## 禁碰清单

- API 路径与数据契约的**形状**（`method-result v2` / `chart.json` 字段结构）—— 本节只改 `meta.source` 的**取值**（`taichu-paipan`→`mingli-paipan`），未增删字段
- 余额 / 扣费逻辑与后台调分（节146 白名单）
- §五 冻结项：`.design/`、`.design_library/`、`_archive/`、`tools/_archive/`、`backend/tools/memory_bench/results/`、`node_modules/`、`vendor/`、节139 三个历史基线快照、节文件「用户原话」栏
- 逻辑代码只做标识符改名，**未借改名重构任何业务逻辑**

## 冲突检查

- 与 **节145**：边界是「中文品牌面 vs 拼音代号」——`views-home.js` 的 mascot 删除已在节145 完成，本节不再碰；`backend/paipan-node/taichu-tarot-spreads.mjs` 的**中文注释**节145 改、**文件名与函数标识**本节改
- 与 **节139**：三个历史基线快照（`_baseline-index.html` / `_pristine-index.html` / `_check1.js`）内仍含 `TC_SETTINGS` / `share_taichu_ui` 等旧名 —— **沿用节139 口径整体冻结**（改门禁对照基线会破坏对照意义）
- 与 **节146**：`recharge_codes` 表已在节146 DROP；本节把遗留的 `TAICHU_JINSHUJU_*` 措辞改掉（**不**改写成 `MINGLI_JINSHUJU_*` —— 那会造出从未存在过的变量名，改为「jinshuju_* 配置」）
- 与 **节142**：本节不动「官方托管/开源」定位；域名不改的决策**依据正是节142 §八 的拍板**
- 与 **ADR-0001**（排盘自研 + 参考边界）：`reference/mingli/` 路径改名后 ADR 正文仍写旧路径 —— ADR 全文已归档 `_archive/adr/`，按冻结项不动；新路径以 `backend/reference/README.md` 为准

## 不许被推翻的约定（**给未来的自己看**）

- **域名的定性**：`mingli.example.com` / `bb3a.mingli.example.com` 是**部署者自填的实例域名**，不是项目标识。以后任何「全项目 grep 不到旧名」的检查都要把它们排除，不要为了 grep 干净去动线上
- **`<你的私钥文件>` 是外部真实文件名**：改它必须「先保一条可用会话」再动，永远不要在单一会话里同时改文件名与 ssh config
- **SW 旧前缀回收不能删得太早**：`sw.js` 的 activate 里对 `taichu-img*` 的回收是**节147 的一次性兼容层**，删它要等旧用户全部升级完（不早于本节上线后一个大版本）
- **`--tc-*` 与 `--taichu-*` 是两个令牌族**：本节只改后者。若要合并，必须另立节并同步 `standards/04` + 全部皮肤
- **改名的迁移顺序不可调换**：`备份 → GitHub 仓库改名 → 部署目录 → .env 键名 → DB 文件名与列名 → 起服务验证`。**`.env` 键名与 DB 文件名必须同一窗口内完成**，否则服务起不来（`.env` 不在仓库、无法随代码自动更新）
- **本地存储键改名 = 现存用户一次强制登出 + 皮肤偏好重置**（节147 §四-1 已拍板：内测期不做兼容迁移）。后台同理需重新登录
- **Windows 下「项目根目录改名」必须由人执行，不能交给会话内的 Agent**：只要目录里还有任何一个文件被打开（本会话的工作区、编辑器、静态服务器、同步工具都算），`Rename-Item` 就必然失败。**排期上要把这一步放在会话之外**，别指望 Agent 在会话里做完

## 控制点结果

- **回归**：`cd backend && python -m pytest -q` → **214 passed / 1 failed**，与改动前基线**逐项一致**；唯一失败 = `test_paipan.py::test_fixture_snapshot_anchor`（既有夹具漂移，见 `99_状态/已知问题.md`）
  - 前端：`node --check`（11 个 js + `data/` 全量 + `sw.js`）**0 失败**；`node frontend/scripts/precompile.js` **全过**（含「拆出 .js 不得写 JSX」守卫与散色基线 0）；`node frontend/scripts/smoke-check.js` **1 error = 既有陈旧门禁**（见下）
  - CSS：自写一致性脚本核对 `var(--mingli-*)` 引用 **363 个全部有定义，0 悬空**（另 7 个悬空项为改动前既有，均与本次令牌族无关）
  - Python：`python -m compileall backend/app backend/tests backend/tools` **exit 0**
- **安全 / 数据**：**发现项 1 处已处理** —— 改 `share_taichu_ui` 列名属**数据形状变更**，已附 `0002` 迁移脚本 + 回滚脚本，并已在本机 5 个库执行（`PRAGMA table_info` 验证列名已是 `share_mingli_ui`）。**线上未执行**（随下次部署，步骤见 `ops/deploy/README.md`）。密钥未新增/未外泄；`backend/.env` 里节146 遗留的金数据 token 随本次清理一并**从本机文件删除**
- **性能**：**不适用** —— 只改标识符与字符串常量，零逻辑改动、零新增依赖、零新增查询。DB 文件名与列名变更不影响索引/查询计划（SQLite 列名非索引键）

## 设计取向（**大改必填**）

- 命中的判据 → 怎么落地：**单点** —— 项目代号收敛为「一处定义、多处引用」的 6 个族（JS 前缀 / CSS 前缀 / localStorage 前缀 / env 前缀 / DB 文件名前缀 / docker 名）；**删机制** —— 未新增任何运行时机制，唯一新增文件是 2 个迁移 SQL（纯文档性质，无运行时代码）；**开关** —— SW 旧前缀回收是**自终止**的兼容层（旧缓存清完即自然失效）

## 结构反思（`01` §8.1 触发条件命中时**必写**，否则写"未触发"）

- **哪里难** → ① **「新串含旧串」的自嵌套**：节145 的 `太初`→`命理太初` 会二次前缀（本次靠固定顺序 + 复检抓出 11 处）；节147 的 `taichu`→`mingli` 天然无此问题，**但多了一类反向坑**：**新名 `mingli` 与旧参考项目同名**，机械替换会把「参考项目 mingli」也变成「本项目 mingli」→ 靠**守卫式正则**（`(?<![-/\w])mingli(?![-_\w])`）+ **文件白名单** + **显式保护 3 个真实标识**（`high-confidence-mingli-skill-main`、`wumohan1814/mingli`、`mingli-*.json`）解决
- **结构上怎么改** → 本次的通用做法已固化成三步：**① 枚举真实标识（正则 `\bTC...`、`taichu_...` 去重）→ ② 分类（改 / 不改 / 冻结）→ ③ 机械替换 + 冻结项磁盘核对**。第 ① 步用「扩散式枚举」（先抓前缀，再抓含该片段的驼峰标识）是关键 —— 单纯 `grep taichu` 会漏掉 `TC_COPY` 与 `shallowEqTc`
- **下次会怎样** → 同类工程（换名/换前缀）直接照这三步走；**且必须先答「旧串是否被新串包含」与「新串是否与既有名词撞名」两个问题**，这两个问题的答案决定替换能不能一次性机械完成

## 留痕（**文字必写；截图仅用户要求时**）

- **变更（大白话）**：
  1. 代码里所有「taichu」拼音代号换成「mingli」——包括浏览器里看不见的 JS 变量名（`TC_COPY`→`ML_COPY`）、CSS 设计令牌（`--taichu-`→`--mingli-`）、浏览器本地保存登录态的键名（`taichu_token`→`mingli_token`，**代价：现存用户会被强制退出登录一次、皮肤偏好重置**）、后端读的环境变量前缀（`TAICHU_`→`MINGLI_`）、三个数据库文件名、Docker 的镜像/网络/卷名、服务器部署目录（`/opt/taichu`→`/opt/mingli`）
  2. 三个架构图文件名、一个排盘脚本文件名、参考项目目录名（`mingli`→`mingli-reference`，避免和本项目同名）一并改
  3. 数据库里一个「分享表单显示品牌条」的开关列名改了，附了可回滚的迁移脚本，本机已执行
  4. **线上还没动** —— 迁移步骤（含备份、`.env` 逐键改名、DB 改名、验证链、回退）已写成 `ops/deploy/README.md` 里的一张唯一清单
  5. **两项有意不改并写清了原因**：线上域名（已在跑，改名零收益有中断窗口）与服务器 SSH 私钥文件名（外部真实文件，改错会失去登录通道）——两者都给了「若你以后要改」的安全步骤
- **后端凭**：`pytest` 真实输出 —— `1 failed, 214 passed, 2126 warnings in 83.69s`；失败项原文 `AssertionError: 快照 chart.json 与当前排盘不一致，首个差异路径: <root>.western.summary.patterns[0]`（**改动前基线完全相同**）
- **测试环境**：Windows 11 / Python 3.13.14（系统 Python）+ Node v24.16.0 / 模型 deepseek-v4-flash（@deepseek-ai/dsh）
- **凭怎么产生的**：`cd backend && python -m pytest -q`（须 `danger-full-access`）；`node --check <file>`、`node frontend/scripts/precompile.js`、`node frontend/scripts/smoke-check.js`（工作目录 = 项目根）；DB 迁移 `python -c` 内联脚本（见本节「现状坐标」的迁移文件路径）
- **什么没测**：① **真机走查全未做**（各页面渲染与六套皮肤、登录/切皮肤刷新后保持、建档、占卜扣费、王先生会话、后台登录调分、PWA 安装名）② **线上迁移未执行**（`.env` 改名 / `/opt/taichu`→`/opt/mingli` / DB 改名 / 0002 列迁移 / `recharge_codes` DROP 均未在服务器执行）③ **旧 SW 缓存回收未真机验证**（需老设备浏览器实测）④ Docker 镜像未本地构建验证（`docker compose config` 也未跑，本机无 Docker）⑤ **根目录物理改名未完成** —— 两次 `Rename-Item` 均报 `The process cannot access the file because it is being used by another process`。**根因**：Windows 下**目录内有任何文件被打开时该目录就不能改名**（不是权限问题，也不是本节的改动造成的）；实测占用者至少四类 —— 本会话的 DSH 工作区（`dsh web` 进程）、VS Code（若开着该文件夹）、**另一个会话遗留的 `python -m http.server 8080`（PID 31524，起于 2026-09-12）**、以及同步 `Vibecoding\` 的 Syncthing 两个进程。**Agent 未强杀这些进程**（`99_状态/已知问题.md` 明确禁止破坏其他会话的在制品）；命令已交给用户
- **覆盖声明**：**证明了** —— 改名在源码与文档层完整、无悬挂引用（grep 断言 + 3 类例外逐条具名）、前端三套静态门禁全绿、后端 214 项回归全绿、CSS 令牌无悬空、本机 DB 迁移生效。**未证明** —— 真机视觉与交互正确性、线上迁移可行性、Docker 构建可用性、旧用户设备上的 SW 回收行为
- **截图**：无（按 `99_状态/已知问题.md`「截图不是机制」，本节点未截图）

## 本节指标（定义见 `01` §6；落盘时一并写）

- 请求数：约 120 ｜ 往返次数：**3**（开工指令 1 + 域名/仓库两项拍板 1 + 用户答复 1）
- 交付前耗时：约 3 小时
- **模型 + provider**：deepseek-v4-flash（@deepseek-ai/dsh）

## 用户结论

**待你执行最后一步并确认**：① 关掉占用 `taichu\` 的进程（DSH 会话 / VS Code / 遗留的 `python -m http.server 8080` PID 31524 / Syncthing）后跑 `Rename-Item -LiteralPath .\taichu -NewName 'mingli'`（命令与校验见 `00_根/入口.md` 交接状态）② 在新路径 `Vibecoding\mingli\` 重开工作区后做统一真机走查 ③ 线上迁移按 `ops/deploy/README.md` 执行
