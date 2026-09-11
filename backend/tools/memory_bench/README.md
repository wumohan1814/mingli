# 离线记忆召回基准（memory_bench）

给太初的**记忆召回质量**造一把尺子：在**不联网、不调 LLM、不碰生产库**的前提下，
把「现在的召回到底有多差」变成可复现的数字，供实现修复前后做对比。

对应 `40_节/待办/节118-记忆层召回可用性修复.md` 的方案 A **步骤①（先建基准）**。
**本工具只测量，不改任何线上行为。**

---

## 1. 怎么跑

### 环境（重要，先读）

本机 `backend/.venv/Lib/site-packages` **是空的**，`backend/packages/` 也已被清空
（并行治理删除中，只剩 3 个文件）。**唯一可用的解释器是系统 Python**，它已全局装齐
`sqlalchemy / fastapi / pydantic / lunar_python / apscheduler / jose / passlib` 等依赖：

```powershell
# 推荐显式指定解释器（python 3.13.14 / sqlite 3.50.4）
$py = "C:\Users\wumoh\AppData\Local\Programs\Python\Python313\python.exe"
```

### 跑基准

```powershell
cd backend
& $py tools/memory_bench/run.py --repeat 5 --label baseline `
    --out tools/memory_bench/results/baseline.json `
    --markdown tools/memory_bench/results/BASELINE.md
```

控制台输出为**纯 ASCII**（避开 Windows GBK 控制台中文乱码）；完整报告写进
`--markdown` 指定的文件（UTF-8）。

### 常用参数

| 参数 | 作用 |
|---|---|
| `--repeat 5` | 每题重复次数（取延迟分位数用；`repeat=1` 更快） |
| `--label before/after` | 结果标签，写进 JSON 与默认文件名 |
| `--k 6` | 显式指定召回条数；**默认 None = 生产默认**（`question`=6） |
| `--mode question\|opening` | 召回模式（默认 `question`，即生产核心通道） |
| `--out` / `--markdown` | 结果 JSON / Markdown 报告落地路径 |
| `--keep` | 保留临时库文件（默认跑完删掉） |
| `--db-dir` | 指定临时库目录（**必须在仓库外**，否则直接拒绝运行） |
| `--compare a.json b.json` | 只对比两份历史结果，不建库 |

### 只播种、不测量

```powershell
& $py tools/memory_bench/seed.py --keep     # 灌库并打印摘要与库文件路径
```

---

## 2. 安全保证（硬约束，代码里有强制检查）

| 保证 | 实现 |
|---|---|
| **绝不碰生产库** | `bench_env.prepare()` 把 `TAICHU_DB_PATH / _FEEDBACK_ / _OPS_` 三个环境变量指向**仓库外**的临时文件；`assert_isolated()` 只要解析后落在**仓库内**或 `/opt/taichu/data` 下就 `RuntimeError` 拒绝运行 |
| **不联网、不调 LLM** | 全流程无网络调用；**绕过抽取链路**（直接按 `AgentMemory` 表结构 INSERT），因为抽取 worker 才依赖 LLM |
| **零新增三方依赖** | 只用标准库 + 项目已有依赖 |
| **不改线上行为** | 不修改 `app/` 下任何文件；仅在**测量进程内** monkeypatch（见 §4），进程退出即消失 |
| **跑完自清理** | 默认删除临时库（含 `-wal/-shm`）；`--keep` 保留并打印路径 |

> ⚠ 两个平台坑（已在代码里处理，勿改回去）：
> 1. **沙箱不允许写入新建子目录**：`tempfile.mkdtemp()` 出来的目录里 `open()` 报
>    `PermissionError`，而临时目录**根**可写 → 因此库文件直接落在临时目录根，用
>    `memory_bench_<uuid8>_*.db` 唯一命名。
> 2. **Windows 下删除仍被打开的文件会失败**：清理前必须 `dispose_engines()` 释放
>    SQLAlchemy 连接池，否则 `cleanup()` 静默失败、文件残留。

---

## 3. 语料怎么加 / 怎么改

语料分两层：

- **`corpus_build.py`（生成器，确定性）** —— 人工撰写的
  - `FACT_POOL`：14 主题 × 5 条 = **70 条**中文事实（`(topic, fact_type, content)`）
  - `QUESTION_TEMPLATES`：14 主题 × 5 问 = **70 个问题**，分三档：
    `short`（≤2 字）/ `medium`（3~8 字）/ `long`（>8 字）
- **`corpus.json`（产物，可直接手改）** —— 30 个虚拟用户 / 585 条事实 / 70 个问题标注

### 加事实 / 加问题

改 `corpus_build.py` 的 `FACT_POOL` / `QUESTION_TEMPLATES`，然后重建：

```powershell
& $py tools/memory_bench/corpus_build.py --emit
```

重建会打印用户数 / 事实数 / 问题数 / 分档分布 / **语料指纹 sha1**，并跑一组自检
（用户内无重复事实、问题指向的用户存在、期望 id 主题一致）。

### 设计口径（决定指标是否可信，改语料时请保持）

1. **重要性/时效与主题无关**：`importance`、`age_days` 由用户号与序号确定性生成，
   **不按主题倾斜**。若把期望事实调成"既重要又新鲜"，会人为抬高 recency 基线的分数。
2. **噪声是天然的**：每个用户 10~30 条事实只覆盖部分主题，问某主题时其余主题即噪声。
3. **确定性**：不使用 `random`；同版本必得同一语料，指纹一致才可与历史结果比较。

> 期待语料**语义相关**的记忆：`FACT_POOL` 里的事实本身就是命理场景相关的生活事实
> （如「用户准备考公务员」「用户有慢性胃炎，吃不了辣」「用户 2024 年从杭州搬到深圳」），
> `expected_fact_ids` 由生成器按主题自动标注，无需手工维护映射。

---

## 4. 指标怎么读

| 指标 | 含义 | 怎么读 |
|---|---|---|
| **Recall@k** | 期望记忆出现在**实际注入的记忆块**里的题占比 | 主指标；必须与「随机下限」一起看 |
| **随机下限（random floor）** | 从该用户全部活跃事实里**随机抽同样条数**至少命中 1 条期望记忆的概率（超几何） | **若 Recall ≈ 随机下限，说明召回通道没起作用** |
| **lift vs random** | 逐题 `命中(0/1) − 随机下限` 的均值，附 95%CI 与是否显著 | **区间含 0 = 与瞎猜不可区分**，别只看点估计 |
| **准确率（严格）** | 注入条目中属于该题**标注期望记忆**的比例 | 对 recency 通道必然偏低（它按重要度×新鲜度取，与问题无关） |
| **准确率（按主题）** | 注入条目中与问题**同主题**的比例 | 更宽容，反映"至少没跑题" |
| **空召回题数** | 一条都没注入的题数 | 为 0 **不代表**召回正常——recency 兜底永远能凑数 |
| **平均注入条数** | 每次实际注入几条 | ⚠ 各档不同！见下方"已知陷阱" |
| **延迟 p50/p95/p99** | 只含 `recall_memories()` 自身（不含网络/LLM） | 与本机同时跑的其他负载相关，跨机不可比 |
| **单次召回 SQL 条数** | 只统计 analytics 引擎（埋点写 ops 库**不计入**） | 用于验证"修复后没有多打查询" |
| **峰值内存** | `tracemalloc`（跨平台）；Linux 上附 `ru_maxrss` | Windows 无 `resource` 模块，故 `ru_maxrss=None` |
| **通道分布** | `bm25` vs `recency` 各占多少题 | **直接暴露 `_fts_quote()` 缺陷**：现状 100% recency |
| **unstable questions** | 同一题重复多次、注入 id 集合不一致的题数 | 应为 0；非 0 说明召回本身不确定 |

### 已知陷阱（读数字时的三个坑）

1. **各档的注入条数不同**：`recall_memories` 在 BM25 零命中时会**把 k 减半**
   （`service.py` L381-384），所以中等/长问平均只注入 3 条、短问 6 条。
   跨档比较必须同时看"平均注入条数"列，否则会把"名额少"误读成"能力差"。
2. **空召回为 0 会掩盖失败**：静默降级（`service.py` L351/376-384）保证永远有东西注入，
   只是与问题无关。
3. **小样本**：分档后每档仅 14~28 题，单档 lift 的置信区间很宽 —— 判断"是否真的变好"
   请用总体的 lift CI 与 `compare.py` 的配对检验，不要只比分档点估计。

---

## 5. 改前 vs 改后怎么做对比

**核心做法：语料固定 + 跑两次 + 配对检验。**

```powershell
# ① 改前
& $py tools/memory_bench/run.py --repeat 5 --label before `
    --out tools/memory_bench/results/before.json

# ② 改代码（例如把 _fts_quote 的整句短语改成 3-gram OR）

# ③ 改后（同一台机器、同一语料）
& $py tools/memory_bench/run.py --repeat 5 --label after `
    --out tools/memory_bench/results/after.json

# ④ 对比
& $py tools/memory_bench/compare.py results/before.json results/after.json
#  等价：& $py tools/memory_bench/run.py --compare results/before.json results/after.json
```

`compare.py` 会输出：

- 15 项指标的 A / B / delta / **verdict（better / worse / =）**
- **配对 McNemar 精确检验**：只比"同一题命中与否的翻转"
  （`both_hit / A_only / B_only / neither` + `p` 值 + 分档命中数变化），
  天然排除语料难度差异 —— **这是判断改动是否真有效的依据**
- **不可比告警**：若两边的 `corpus_meta.content_sha1`（语料指纹）或题数不同，
  会打印 `!! 数字不可直接比较`

**判定"真的变好了"的标准**：`lift vs random` 的 95%CI **不含 0**，
且 McNemar `p < 0.05`（或至少 `B_only > A_only` 有明确方向）。

---

## 6. 取证方式（怎么拿到召回的记忆 id）

`recall_memories()` **只返回文本**，其埋点 `agent_memory_recall`
（`service.py` L423）只带 `channel / hits / k / elapsed_ms`，**不含 id**。

因此本工具用**外部 monkeypatch**（不改生产代码、不复制其内部逻辑）：

| 替换对象 | 位置 | 为什么是它 |
|---|---|---|
| `msvc._render_memory_block` | `service.py` L443，调用点 L422 | 它收到的 `items` 正是**最终注入**的候选列表（预算循环里被丢弃的不会到这里），语义与"真实注入"严格对齐 |
| `msvc.record_event` | `service.py` L423 调用 | 只为取回真实埋点里的 `channel`，不自行推断 |

两处替换只发生在测量进程内，`Probe.restore()` 在测量结束时还原；进程退出即消失。

---

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `bench_env.py` | 环境隔离（临时库路径 + 禁止写入仓库/生产目录的断言） |
| `corpus_build.py` | 确定性语料生成器（事实池 + 问题模板 + 自检） |
| `corpus.json` | 语料产物（30 用户 / 585 事实 / 70 问题） |
| `seed.py` | 绕过抽取链路直接播种（也可单独作为 CLI 运行） |
| `run.py` | 基准执行器：插桩、跑题、算指标、出 JSON/Markdown |
| `compare.py` | 结果对比 + 配对 McNemar 检验 |
| `results/BASELINE.md` | **当前实现的基线实测报告（数字来自实跑）** |
| `results/*.json` | 每次运行的原始结果（含逐题证据 `per_question`） |

---

## 8. 尚未验证 / 已知限制

- **未验证**：修复后的收益数字（本工具只提供"改前"基线，等实现落地后再跑）。
- **未验证**：Windows 上 `resource` 模块不可用，故 `ru_maxrss` 恒为 `None`，
  峰值内存只有 `tracemalloc` 口径（只统计 Python 堆，不含 SQLite C 层缓存）。
- **未验证**：本基准的延迟**不能**代表生产环境（生产还含 LLM 调用与并发），
  它只用于**同机前后对比**。
- **口径限制**：只测 `mode="question"`（生产核心通道）；`opening` 模式未纳入指标
  （可用 `--mode opening` 单跑，但语料的问题标注是按"提问"语义写的）。
- **口径限制**：「准确率（严格）」只认标注的期望记忆，不放宽到"语义相似"；
  因此该列对任何按重要度/新鲜度排序的通道都会偏低，**不宜单独当质量结论**。

---

## 9. 召回开关怎么关 / 消融测量（节118 方向一）

实现侧开关是 `app/memory/service.py` 顶部的**模块常量**（**函数调用时**读取 → 改属性即生效；
不读环境变量、不影响生产默认行为）：

| 常量 | 默认 | 作用 |
|---|---|---|
| `RECALL_ENABLE_QUERY_TERMS` | 1 | **R1**：整句短语 → ≥3 字词项 `OR` |
| `RECALL_PHRASE_FIRST` | 0 | R1 变体：先试原短语、零候选再退 OR（代价：多 1 次 SQL） |
| `RECALL_ENABLE_SHORT_QUERY_LIKE` | 1 | **R2-1**：<3 字查询用 `LIKE` 兜底（而非直接退化 recency） |
| `RECALL_SHORT_QUERY_UNION` | 1 | R2-1 变体：`1` = LIKE 命中 **∪ recency 全集**；`0` = 只取 LIKE 命中（**实测丢召回**，见 STEP2 报告 q031） |
| `RECALL_HALVE_K_ON_FALLBACK` | 0 | **R2-2**：`1` = 保留旧的「零命中 → k 减半」（已判定有害） |
| `RECALL_ENABLE_TAGS_MATCH` | 1 | **R3**：`tags_json` 参与 Python 侧补充打分（不动 FTS/表结构） |
| `RECALL_TAG_BONUS` | 0.25 | R3 命中 tag 的加分 |
| `RECALL_KEYWORD_BONUS` | 0.35 | R2-1 LIKE 命中 content 的加分 |
| `RECALL_PHRASE_BONUS` | 0.30 | R1 content 含整句的加分（不做两段式 SQL 时的短语精度补偿） |
| `RECALL_TERM_LEN` | 3 | 词项最小长度 = **trigram 硬约束，勿改小** |
| `RECALL_MAX_TERMS` | 24 | OR 词项数上限（防超长查询撑爆 MATCH 表达式） |

**怎么关**：
- 生产/联调：把对应常量置 `0`；**全部 `RECALL_ENABLE_*` 置 0 即完全回到旧行为**
- 测量：不改代码，用下面的消融脚本按配置切换

### 消融测量（逐项归因）

```powershell
$py = "C:\Users\wumoh\AppData\Local\Programs\Python\Python313\python.exe"
cd backend
# ① 同进程跑 6 组配置 → 对比表 + 与「全关」的配对 McNemar（用于**召回**归因）
& $py tools/memory_bench/ablation.py --repeat 3
# ② 单配置独立进程（用于**延迟**归因）
& $py tools/memory_bench/ablation.py --repeat 5 --single ALL
```

产物：`results/ABLATION.md`（含 6 组总表、McNemar、分档、开关取值）+ `results/ABLATION.json`。
配置名：`R0_off`（全关＝旧行为）/ `R1_only` / `R2_only` / `R3_only` / `R1R2` / `ALL`。

> ⚠️ **延迟必须用 `--single` 逐配置独立进程测**：同进程连续跑 6 组时延迟随**执行顺序单调上升**
> （实测 p50 5.7 → 11.6ms），那是 WAL/缓存累积，**不是单项成本**。召回指标不受影响（确定性）。
>
> ⚠️ **本基准的延迟不具跨机可比性**，且同一台机器上受负载影响很大：基线 `run.py` 的
> p50 在两次运行中量到 10.4ms 与 22.0ms，而 `--single` 交替 A/B（每轮独立进程）显示
> 改动前后差值仅 **+0.035ms**。判断"有没有变慢"必须用交替 A/B，不能只看两次 `run.py`。

## 10. 语料的「词面天花板」（读数字前必看）

本语料的 `expected_fact_ids` 由生成器**按主题自动标注**，而问题也是按主题生成的
——**两者常常没有任何共同字面**（例：问「事业」，期望事实内容是「用户准备考公务员」）。
因此**纯词法通道在这份语料上存在结构性天花板**（实测，见 `results/STEP2-REPORT.md`）：

| 通道 | 理论上限（期望事实能被该通道命中的题占比） |
|---|---|
| BM25 词项 OR | **3/70 = 4.3%**（期望事实与问题有共同 3-gram） |
| LIKE（整句子串） | **1/70 = 1.4%** |
| **tags 匹配** | **26/70 = 37.1%**（期望事实的某个 tag 出现在问题里） |

**含义**：这份语料测的是「**主题**检索」而不是「词面检索」。要评估语义能力，需要
另建语料或引入语义通道；评估 tags/元数据能否救回，用上表 37.1% 当上限。
