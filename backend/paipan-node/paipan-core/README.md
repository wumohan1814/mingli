# 命理 · 自研排盘内核（`paipan-core`）· 管线规范

> **节148 交付物**：自研排盘内核的**基建 + 对拍框架**，以「小六壬」作样板能力打通「写内核 → 对拍 100% → 才允许下线旧实现」这条链路。
> **读者**：节149–157 的实现者（真太阳时 / 八字紫微 / 西洋星盘 / 七政五运 / 三式 / 终身局 / 六爻梅花小六壬 / 灵签择日生肖 / 塔罗雷诺曼）。
> **一句话**：内核是**纯函数**，规则只有**一个权威位置**，正确性只由**对拍门禁**说话。
> 母节：节128 命理自研内核（`00_根/入口.md` 与 `40_节/待办/`）。

---

## 1. 纯函数管线：四段，段间只传普通对象

每个能力（`src/capabilities/<cap>/index.js`）必须切成这四段，**顺序固定、边界固定**：

| 段 | 名字 | 允许做什么 | **禁止**做什么 |
|---|---|---|---|
| ① | **输入归一化** `normalizeInput(params)` | 把 `Date` / ISO 字符串 / 数字换成一个**确定性中间对象**（如东八区挂钟时刻）；校验范围；缺输入**抛错** | 禁止回落「当前时间」；禁止读 `process.env`；禁止碰网络/磁盘 |
| ② | **历法/起局** `resolveCalendar(...)` + 起局纯函数 | 调 `lunar-typescript` 换算农历与干支；做时辰序判定 | 禁止在这里做「判断哪一宫好/坏」这类格局逻辑；禁止输出格式化文案 |
| ③ | **格局判定**（小六壬即「三宫推算」`computePalaces`） | 纯取模 / 纯规则表查表；可无 IO 地反复重算 | 禁止依赖①的原始输入形态（只吃②的产物），保证可单测 |
| ④ | **输出装配** `assemble(...)` | 按生产契约键序拼装结果对象 | 禁止夹带内部字段（提示词/审计轨迹）——那些由下游另算 |

**四条硬纪律**（放在 `src/` 下的任何文件都适用）：

1. **段与段之间只传普通 JSON 对象**，不传类实例、不传 `Date`（时间一律转字符串或数值）。
2. **禁止与 IO / LLM / 格式化解耦**：`src/` 里不得出现 `fs` / `net` / `http` / `fetch` / `child_process` / LLM SDK / 前端文案拼接。落盘、打日志、组装提示词都在**调用方**（未来的 `server.mjs` 适配层）。
3. **禁止 `Math.random`、`Date.now` 参与结果**。唯一允许的时间戳是 `meta.calculatedAt`（信息性元数据，对拍时被忽略）；需要测试确定性时用可选的 `params.now` 注入固定值。
4. **时间口径只在一处定义**：本内核统一按**东八区民用挂钟时刻**取历法，做法是「先求绝对时刻（epoch ms）→ 再加 +08:00 偏移读 UTC 字段」，因此**结果与进程本地时区无关**（本机 TZ 不是 +08:00，靠这条保证一致）。

---

## 2. 单一权威规则源纪律

- `src/rules/<cap>.js` = 该能力**唯一权威规则位置**：宫位表、掌诀歌、时辰表、换日口径、公式文字版，全部在这里，并且 `Object.freeze`。
- **调用方只读不抄**：`capabilities/`、对拍框架、测试、未来的 `server.mjs` 适配层**一律从 rules 取**。任何地方出现第二份宫名/歌诀/时辰表拷贝 = 缺陷（**规则漂移是已知教训**）。
- **每条规则都要标来源**：文件里写清「公有领域俗传口诀」/「对拍实测与旧实现一致」/「本内核采用口径（非唯一流派规则）」。涉及第三方文本的，同步登记 `00_根/来源.md`。
- 规则变了，**测试先红**：`tests/` 里对歌诀与口径做逐字断言，就是为了让漂移在 CI 层就炸出来。

---

## 3. 对拍框架：旧实现 vs 自研，关键字段 100% 才准下线

### 3.1 三条命令

```bash
# ① 跑门禁（默认跑全部已登记能力）；--verbose 打印全部信息性差异
cd backend/paipan-node
node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren --verbose

# ② 存 golden 快照（旧实现输出 stripInternal 后落盘，供无 vendor 环境回归）
node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren \
  --save-golden paipan-core/tools/fixtures/xiaoliuren-golden.json

# ③ 用 golden 复跑（不加载旧实现，纯快照回归）
node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren \
  --use-golden paipan-core/tools/fixtures/xiaoliuren-golden.json
```

其它参数：`--legacy <dir>`（旧实现根目录，默认 `vendor/<旧实现包>/dist`，可由 `MINGLI_PAIPAN_LEGACY_DIR` 覆盖）、`--float-tolerance <n>`（默认 0）。

### 3.2 门禁语义（唯一硬标准）

1. 两侧输出都先 `stripInternal()` 归一化（剥离 `evidenceAnalysis / calculationContext / positionSources / prompt / calculationChain / sources / timestamp`，递归）。
2. 按 `defaultKeyFields` 做**字段级**比较（`ganzhi.year`、`palaceOrder[3].verse` 这种点路径 + 数组下标）。
3. **任一关键字段不一致 → 汇总行 `FAILED` + 退出码 1**；全部一致 → `PASSED` + 退出码 0。
4. 非关键字段（`meta.*` 等自研值、旧实现多出的字段）差异**只列不判**，但必须在报告里逐条可见——**不许悄悄吞掉**。
5. `--save-golden` 落盘的快照**不带时间戳**（保证可重复 diff、可入库）。

### 3.3 fixtures 代表性要求

`tools/fixtures/<cap>.json` 的每条夹具必须能让「换界口径」出错时**必然红**。最低覆盖：

- **跨年代**：至少覆盖 1900 年前后 / 1960s / 1990s / 2020s（农历库与干支算法在不同年代的分支不同）；
- **早晚子时**：`00:00–00:59` 与 `23:00–23:59` 各至少一条（换日口径最易错）；
- **节气**：立春（年干支换年）与至少一个「立春精确时刻前后 10 分钟内」的边界对（只靠整日界会漏）；
- **闰月**：至少一个闰月日期；
- **月末/年末**：月末 23:5x 与跨年晚子时各至少一条。

夹具来源：**由旧实现产出 + 人工抽查**（`--save-golden`），不许手写期望值。

### 3.4 已裁决的两处工具语义（避免后续节重复纠结）

- `deepDiff` 的 `path` **不带 `$.` 前缀**（根为 `"$"`），数组用 `arr[1]`；值为 `undefined` 的键**两侧都视为不存在**（旧实现有 `meta.model: undefined` 这类键，JSON 化即消失）。
- `sortArraysBy`：规则 `{"path":"数组路径"}` 同时把 `path` 当作默认排序字段名；数组名 ≠ 排序字段名时用 `{"path":"数组路径","field":"字段名"}`。命中才排序，排序只在比较前生效、不进结果。**当前能力未用到**（小六壬输出无「顺序不保证的数组」）。

### 3.5 框架自身的依赖纪律

对拍框架**必须**能加载旧实现，但内核**必须**不依赖它。所以：

- 旧实现目录名在 `paipan-core` 内以**片段拼接**成可覆盖配置（`--legacy` / `MINGLI_PAIPAN_LEGACY_DIR`），内核目录里不出现旧包名字面量；
- `tools/scan-deps.mjs` 的「`paipan-core` 零旧包名命中」门禁因此是**真门禁**，而不是靠排除项绕过去的；
- golden 快照一旦落地，后续节在没有旧实现的环境也能回归。

---

## 4. 对拍实测确认的历法约定（小六壬样板 · 后续节直接照用）

**全部由黑盒探针实测得出（只运行旧实现、不读其源码），并与 `lunar-typescript@1.8.6` 对照定位到具体方法：**

| 项 | 确认口径 | 实测证据（旧实现输出） |
|---|---|---|
| **年干支** | **立春「精确时刻」换年** = `getYearInGanZhiExact()`。**不是**正月初一换年，**也不是**「立春当天整日界」（`ByLiChun`） | 1990-01-27 是正月初一但在立春前 → 给「己巳」（正月初一换年会得「庚午」）；2000 立春在 02-04 20:40，20:30 给「己卯」、20:41 给「庚辰」 |
| **月干支** | **节气精确时刻换月** = `getMonthInGanZhiExact()` | 2000-02-04 12:00 给「丁丑」（按日界换月会得「戊寅」） |
| **日干支** | **晚子时 23:00 起换日** = `getDayInGanZhiExact()` | 1990-05-12 23:00 给「戊寅」（`getDayInGanZhi()` 与 `…Exact2` 都给「丁丑」） |
| **农历月日** | **东八区民用日零点换日**，晚子时**不**进日 | 2000-02-05 23:40（正月初一）仍 `lunarDay=1` |
| **时辰序** | `0`=早子时(00:00–00:59)、`1–11`=丑…亥、**`12`=晚子时(23:00–23:59)**；共 **13** 个标签 | 1990-05-12 23:00 → `hourIndex 12`、`hourLabel「晚子时」`、`calculation.hourNumber 1` |
| **起课时辰数** | `hourNumber = hourIndex mod 12 + 1`（晚子时按「子=1」计） | 同上 |
| **时干支** | **五鼠遁自实现**（日干取上表日干支之干）；与库的 `getTimeInGanZhi()` 一致，但本内核不复用库 | 12 例探针 0 不一致 |
| **闰月** | 库的 `getMonth() < 0` 即闰月；`lunarMonth = |getMonth()|`；**月宫沿用同名月序** | 2023-03-25 → `lunarMonth 2`、`isLeapMonth true`、`monthPalaceIndex 1` |
| **三宫公式** | `month=(月-1)%6`；`day=(month+lunarDay-1)%6`；`hour=(day+hourNumber-1)%6` | 1990-05-12 07:30 → 3/2/0 |

### 与旧实现的**有意分歧**（已登记，不视为缺陷）

1. **缺 `customDate`**：旧实现**静默回落到「当前时间」**（实测 `{}`、`undefined`、`{month,day,hour}` 三种输入输出完全相同且等于探针运行时刻）。本内核**一律抛错** `PaipanInputError`（确定性纪律）。
2. **数字起课模式 `{month,day,hour}`**：旧实现接受但**完全忽略**这三个数字。本内核不做无法对拍的猜测，抛 `numeric_mode_unsupported`（`server.mjs` 永远传 `customDate`）。
3. **`customDate` 传 ISO 字符串**：旧实现抛「自定义时间不是有效日期。」；本内核**接受** `Date | ISO 字符串 | epoch 毫秒数`（同一时刻的不同形态得到同一 `inputHash`）。
4. **`meta.*`**：`engineVersion` / `inputHash` / `resultId` 用自研值（`0.1.0-mingli` + 自写 FNV-1a），`schemaVersion` 与旧实现保持一致（形状未变）。这些是**非关键字段**，对拍报告里逐条列出。

---

## 5. 开关切换约定（父节接入 `server.mjs`）

自研内核**默认不接管**。切换契约：

- 环境变量：`MINGLI_PAIPAN_CORE_<能力大写>`（例：`MINGLI_PAIPAN_CORE_XIAOLIUREN`）。
- 取值：`on`（也接受 `1` / `true`）→ 走自研内核；**缺省 / 其它值 → 走旧实现**（默认 off，保证线上行为不变）。
- 由**父节各子节**在 `server.mjs` 的适配层里读，内核自身**不读 env**（`src/` 零 env 依赖，开关是调用方的事）。
- 切换前提：`run-compare.mjs` 对该能力 **关键字段 100% 一致**（PASSED），否则不许切。
- 切换后该能力的旧 import 从 `server.mjs` 勾销，`scan-deps.mjs` 的「待勾销清单」应相应减少。

```bash
# 切换示例（父节接 server.mjs 后）
MINGLI_PAIPAN_CORE_XIAOLIUREN=on node server.mjs
```

---

## 6. 零 LLM / 确定性纪律

- 内核**零 LLM、零触网、零 IO**：`src/` 不 import 任何 SDK / `fetch` / `fs` / `net`；排盘是**确定性计算**（这是项目的成本红线：`00_根/入口.md` 三个必答之三）。
- **同样输入必须同样输出**：除了 `meta.calculatedAt`（信息性、对拍忽略）之外，任何字段都不得含时间/随机成分。
- **测试确定性**：`tests/` 不触网、不读真实时钟（用 `params.now` 注入），不依赖进程本地时区（所有输入带 `+08:00`）。
- 缺输入**抛错**，不猜、不默许：猜出来的结果会让对拍失去意义。

---

## 7. 新能力接入清单（节149–157 照做）

1. **建规则表**：`src/rules/<cap>.js` —— 宫位/星曜/条文表 + 口径 + 来源标注 + `Object.freeze`。
2. **写能力纯函数**：`src/capabilities/<cap>/index.js` —— 四段管线（§1），导出 `generateXxxCore(params)`，与旧实现**同签名同形状**。
3. **登记能力表**：在 `tools/compare/run-compare.mjs` 的 `CAPABILITIES` 加一条（夹具文件名、旧实现模块与导出名、内核模块与导出名、input 转换函数）。
4. **产夹具**：`tools/fixtures/<cap>.json` —— 按 §3.3 代表性要求列输入（先只写 `input`）；旧实现侧**不支持的形式**（如 ISO 字符串）由 `toLegacyInput` 转换。
5. **跑对拍**：`run-compare.mjs --capability <cap> --verbose` → 迭代内核直到**关键字段 100%**（不许改 `defaultKeyFields` 来放水；不许伪造结果）。差异口径疑难时，用**黑盒探针**定位旧实现行为（**禁止读 vendor 源码**）。
6. **存 golden**：`--save-golden` 落 `tools/fixtures/<cap>-golden.json`，再 `--use-golden` 复跑确认 PASSED。
7. **接开关**：父节在 `server.mjs` 适配层按 §5 读 `MINGLI_PAIPAN_CORE_<CAP>`，勾销对应 import。
8. **勾销验证**：`node paipan-core/tools/scan-deps.mjs`（`paipan-core` 命中必须 0；`server.mjs` 待勾销清单应减少）；`node --check` 每个新文件；`node paipan-core/tests/<cap>.test.mjs` 全绿。

---

## 8. 本目录文件清单

| 路径 | 作用 |
|---|---|
| `package.json` | 内核对包声明（`type: module` + 唯一依赖 `lunar-typescript@1.8.6`）。**注意**：`backend/paipan-node/package.json` 没有 `type: module`，本文件让 `paipan-core` 下的 `.js` 被正确当 ESM 解析 |
| `src/pipeline/index.js` | 管线基座：`stripInternal` / `getPath` / `extractKeyFields` / `stableStringify` / `fnv1aHash`（纯函数，两侧对拍共用） |
| `src/rules/xiaoliuren.js` | **单一权威规则源**：六宫表 + 掌诀歌（公有领域俗传）+ 时辰表 + 换日/闰月口径 + 公式文字版 |
| `src/capabilities/xiaoliuren/index.js` | 小六壬时间起课：`generateXiaoliurenCore(params)`，四段管线，含全部实测约定注释 |
| `tests/xiaoliuren.test.mjs` | `node:test` 单测（17 例）：正月初一→大安、已知样例写死断言、纯函数性、`stripInternal`、`getPath`、早晚子时、立春/节气换界、闰月、抛错路径、规则表逐字 |
| `tools/compare/diff.js` | 纯函数差异比较：`deepDiff`（容差/排序选项）+ `countConsistency` |
| `tools/compare/run-compare.mjs` | 对拍 CLI + **门禁**（关键字段 100% 才 PASSED），支持存/用 golden |
| `tools/fixtures/xiaoliuren.json` | 夹具：52 个关键字段 + 22 条夹具（10 条规格要求 + 8 条节气/闰月/世纪边界补强） |
| `tools/fixtures/xiaoliuren-golden.json` | 旧实现输出快照（`stripInternal` 后，22 条；无时间戳，可入库） |
| `tools/scan-deps.mjs` | 旧实现依赖扫描：`server.mjs` 待勾销 import 清单 + `paipan-core` 零命中门禁 |

### 常用命令速查

```bash
cd backend/paipan-node

# 单测
node paipan-core/tests/xiaoliuren.test.mjs

# 语法检查（每个新建文件）
node --check paipan-core/src/capabilities/xiaoliuren/index.js

# 依赖扫描（paipan-core 必须 0 命中）
node paipan-core/tools/scan-deps.mjs

# 对拍门禁
node paipan-core/tools/compare/run-compare.mjs --capability xiaoliuren --verbose
```
