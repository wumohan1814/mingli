# 节122 · IPIP 官方量表题项原件

> **抓取日期**：2026-09-11 ｜ **来源**：https://ipip.ori.org/ （公有领域；官网明示可 copy / edit / translate / 任何目的商用，无需许可）
> **本目录只放「官网原文」的结构化搬运**，不含任何翻译、改写或推断题项。

---

## 一、逐档位记录

| 文件 | 档位 | 期望题数 | **实得题数** | 官网 URL | 字段完整度 |
|---|---|---|---|---|---|
| `ipip-neo-300.json` | Goldberg (1999) 30 层面 × 10 题 | 300 | **300 ✅** | `newNEOFacetsKey.htm` | text_en ✅ / dimension ✅ / facet ✅ / keying ✅ / text_zh ❌ 无官方中文 |
| `ipip-neo-120.json` | **Johnson (2014)** IPIP-NEO-120 | 120 | **120 ✅** | `30FacetNEO-PI-RItems.htm` | text_en ✅ / dimension ✅ / facet ✅ / keying ✅ / text_zh ❌（另有官方中文页，见下一行） |
| `ipip-neo-120-maples.json` | **Maples et al. (2014)** IPIP-NEO-120 | 120 | **120 ✅** | `30FacetNEO-PI-RItems_Maples_etal.htm` | 同上；**注意这是与 Johnson 版不同的另一套 120 题** |
| `ipip-neo-120-zh.json` | **官方普通话译本**（徐中阳译，指导张雅博士） | 120 | **仅 33 ❌** | `Mandarin translation of IPIP-NEO-120.htm` | text_en 33/120 ✅ / text_zh 33/120 ✅ / **dimension ❌ / facet ❌ / keying ❌（该页不印这些）** |
| `ipip-neo-60.json` | **Maples-Keller et al. (2019)** IPIP-NEO-60 | 60 | **60 ✅** | `IPIP-NEO-60ScoringKeys.htm` | text_en ✅ / dimension ✅ / facet ✅ / keying ✅ / text_zh ❌ |
| `ipip-50.json` | Goldberg (1992) Big-Five Markers 50 题 | 50 | **50 ✅** | `New_IPIP-50-item-scale.htm` | text_en ✅ / dimension ✅ / **facet ❌（该量表无层面）** / keying ✅ / text_zh ❌ |
| `mini-ipip-20.json` | Donnellan et al. (2006) Mini-IPIP | 20 | **20 ✅** | `MiniIPIPKey.htm` | text_en ✅ / dimension ✅ / **facet ❌** / keying ✅ / text_zh ❌ |

**合计实得 673 条题项**（300+120+120+33+60+50+20 中的题项合计 673；其中 33 条带中文）。

---

## 二、⭐ 最重要：IPIP-NEO-60 的 60 题是否都在官方 120 题里？

**结论：不在。逐字比对结果如下。**

> **本节数字是程序化比对得出的**（Python 脚本对四个 JSON 的 `text_en` 做归一化后集合求差；归一化 = 去首尾空白、折叠内部空白、统一大小写、去掉句末句点、统一撇号）。**不是人工目视。**
> ⚠️ **如实记录一次自我纠错**：我最初手工目视得出的 Maples-120 结果是 `59/60`，**程序化比对纠正为 `58/60`**（漏掉了 C5 `Carry out my plans.`）。**人工目视会错，故此处以程序结果为准。**

| 对照对象 | 60 题中有多少**逐字出现** | 不在其中的题数 |
|---|---|---|
| **Johnson-120**（`ipip-neo-120.json`） | **51 / 60** | **9** |
| **Maples-120**（`ipip-neo-120-maples.json`） | **58 / 60** | **2** |
| **300 题池**（`ipip-neo-300.json`） | **60 / 60 ✅** | **0** |

### 不在 Johnson-120 里的 9 题（层面 → 题项原文）
| # | 层面 | 题项 |
|---|---|---|
| 1 | N4 | Am easily intimidated. |
| 2 | N6 | Am calm even in tense situations. |
| 3 | E1 | Act comfortably with others. |
| 4 | O2 | Do not like art. |
| 5 | O3 | Am not easily affected by my emotions. |
| 6 | O4 | Don't like the idea of change. |
| 7 | O6 | Believe in one true religion. |
| 8 | C2 | Like order. |
| 9 | C4 | Set high standards for myself and others. |

### 不在 Maples-120 里的 2 题
| 层面 | 题项 |
|---|---|
| O2 | Believe in the importance of art. |
| C5 | Carry out my plans. |

### 这条结论意味着什么（**给后续工单用**）
1. **60 题是 300 题池的真子集（60/60）**，但**不是任何一版 120 的子集**（51/60 或 59/60）。
   → 若目标是"翻一次、长短两版都能用"，**应以 300 题池为母本**；以 120 为母本会缺题。
2. **官方中文只有 Johnson-120 那一档**（且本次只抓到 33 题）。若做 **60 题快速版**，其中 **9 题在 Johnson-120 里没有对应英文题面**（上表），**其官方中文自然也不存在** → 这 9 条中文必须自己译。
3. 反之，若只用 **Maples-120** 作母本，60 题里缺 **2** 题（O2 `Believe in the importance of art.`、C5 `Carry out my plans.`）。
4. **Johnson-120 与 Maples-120 是两套不同的 120 题**（同一 30 层面池里各选 4 题），**不能混用**；本目录两个文件分别存放。

### 附：其余程序化比对结果（顺带做的，供选型参考）
| 比对 | 结果 |
|---|---|
| Johnson-120 → Maples-120 | **85 / 120** 逐字相同 → 两版重合约 71%，**确实不能互相替代** |
| IPIP-50 vs 300 题池 | **28 / 50**（50 题来自 Goldberg 1992 的词汇学 Big-Five 池，与 30 层面池只是部分重叠） |
| Mini-IPIP-20 vs 300 题池 | **16 / 20**（官网也明说 Mini-IPIP 基于 50 题词汇学量表，不是层面池） |
| IPIP-NEO-60 vs 300 题池 | **60 / 60** ← 只有这一档是完全子集 |

---

## 三、拿不到的东西（如实报告）

| 目标 | 状态 | 卡在哪一步 |
|---|---|---|
| **官方中文 120 题的后 87 题（第 34–120 题）** | ❌ **未拿到** | 该页是**一张超长 HTML 表**，本环境的 `web_fetch` **在固定长度处截断**，两次独立抓取返回**字节级相同**的截断位置（停在第 33 题之后）。**不是页面不存在、不是需要注册**，纯粹是工具截断。→ 换一个能读完整页的方式（浏览器另存 / curl 落盘 / 不限长的抓取服务）即可补齐，**URL 与前面的 33 题都在 `ipip-neo-120-zh.json` 里**。 |
| IPIP-NEO-60 的**官方中文** | ❌ 不存在 | 官网托管的中文**只有 120 题那一档**；其余档位官方无中文。 |
| 300 / 50 / Mini-IPIP 的官方中文 | ❌ 不存在 | 同上。 |
| **PDF 类资料** | ⚪ 本次**不需要** | 所有目标档位的题项都在 **HTML 页面**上，**没有任何一档的题项只存在于 PDF** → 未触发 `web_fetch` 不支持 `application/pdf` 的限制。 |
| 官方中文页的**层面/维度映射** | ❌ 未拿到 | 该页**不印** dimension/facet/keying（只有中英对照题面）。**若该信息存在，可能在本次被截断的后半页里** → 补齐后再定。 |

---

## 四、我做出的推断（**与官网原文分开列**）

> 规则：下面每一条**都不是**官网写的，是本目录整理者的处理或判断。

1. **`dimension` 字母是我做的映射**：官网用罗马数字/全称（如 `Factor I Surgency or Extraversion`、`I. Extraversion`）。我统一映射为 **E / A / C / N / O**。
2. **⚠️ IPIP-50 的第 4 因子口径需注意**：官网对该量表第 (4) 因子的原话是 **"Emotional Stability"**（情绪稳定性），不是 Neuroticism。我把 `dimension` 统一写成 **`N`**，因此 `ipip-50.json` 里 **`keying: "+"` 表示"情绪稳定性高" = 神经质低**，与 `mini-ipip-20.json`（官网第 IV 因子**就叫** Neuroticism，`+` = 神经质高）**方向相反**。→ 这一条是**整理者按 schema 统一后的副作用**，用时必须看各文件 `notes`。
3. **`ipip-neo-60.json` 的两处处理**：① 官网该页标题写的是 `12-Item IPIP Scales`，但页面实际列出 **30 层面 × 2 题 = 60 题**（每域 12 题）——我按**实际条目**登记为 60，并在文件 `notes` 里原样保留了这个标题不一致。② 该页 `– keyed` 前面的减号在抓取文本里是**乱码字符**，我按 `+ keyed` 的对照与页面结构写作 `-`，**这是我的读法，不是逐字转写**。
4. **`ipip-neo-120-maples.json` 的两处拆分**：官网该页有**两个单元格里塞了两条题**（O3 的 `Am not easily affected by my emotions.` + `Experience very few emotional highs and lows.`；O6 的 `Tend to vote for conservative political candidates.` + `Like to stand during the national anthem.`）。我把它们**拆成独立条目**以使每层面恰好 4 题——**拆法是整理者的读法，题面文字本身是逐字原文**。
5. **`ipip-neo-120-zh.json` 的 `item_no` 是该页自己的问卷顺序**，**不是**按层面分组的顺序（该页把题打散，这是问卷惯例）。我**没有**把中文题映射到层面——因为该页不提供映射，硬猜会引入错误。
6. **⚠️ 官方中文页的英文栏与 Johnson-120 计分键页不完全一致**：例如中文页第 28 题英文是 `View myself as predominantly liberal politically.`，而 Johnson-120 计分键页 O6 里的题面是 `Tend to vote for liberal political candidates.` 等。→ **判断：官方中文页译的是"实际施测卷"的题面，与"计分键页"的题面有出入**。这是整理者的判断，**不是官网的说明**；后果是**中文题到层面的映射不可想当然**。
7. **`ipip-neo-120-zh.json` 的 `instructions_zh_verbatim` 中有一处疑似官网错字**（`把和自己年龄大致相访…`，按语境应为"相同"）。我**原样保留并加注**，没有静默改正。
8. **`ipip-neo-300.json` 的 `item_no` 是我按页面顺序编的序号**（N1..N6, E1..E6, O1..O6, A1..A6, C1..C6 各 10 题）；官网该页**不编号**，只按层面分组。
9. **`facet_keying_balance`（各层面 +/− 配比）是我统计的**，不是官网列的；官网只给出分组位置。
10. **未做**：我没有对任何题项做翻译、改写、去重合并或"优化措辞"。

---

## 五、来源与引用（官网原文）

- 官网总入口：https://ipip.ori.org/
- 多构念量表索引：https://ipip.ori.org/newMultipleconstructs.htm
- 计分说明（+/− keyed 的含义）：https://ipip.ori.org/newScoringInstructions.htm
- 300 题（Goldberg 1999，30 层面 × 10）：https://ipip.ori.org/newNEOFacetsKey.htm
- 300 题的层面统计对照表：https://ipip.ori.org/newNEO_FacetsTable.htm
- Johnson-120 计分键：https://ipip.ori.org/30FacetNEO-PI-RItems.htm
- Maples-120 计分键：https://ipip.ori.org/30FacetNEO-PI-RItems_Maples_etal.htm
- IPIP-NEO-60 计分键：https://ipip.ori.org/IPIP-NEO-60ScoringKeys.htm
- 50 题样卷（含 +/- 键）：https://ipip.ori.org/New_IPIP-50-item-scale.htm
- Mini-IPIP 计分键：https://ipip.ori.org/MiniIPIPKey.htm
- Mini-IPIP 对照表（信度）：https://ipip.ori.org/MiniIPIPTable.htm
- **官方普通话译本**：https://ipip.ori.org/Mandarin%20translation%20of%20IPIP-NEO-120.htm
- 中文译本信效度：https://ipip.ori.org/ChineseIPIP-120reliability.htm
- 中文常模：https://ipip.ori.org/ChineseIPIP-120norms.htm

### 各档位官方引用（原文）
- Goldberg, L. R. (1992). The development of markers for the Big-Five factor structure. *Psychological Assessment, 4,* 26-42.
- Goldberg, L. R. (1999). A broad-bandwidth, public domain, personality inventory measuring the lower-level facets of several five-factor models. In I. Merville, I. Deary, F. De Fruyt, & F. Ostendorf (Eds.), *Personality psychology in Europe* (Vol. 7, pp. 7-28). Tilburg, The Netherlands: Tilburg University Press.
- Johnson, J. A. (2014). Measuring thirty facets of the Five Factor Model with a 120-item public domain inventory: Development of the IPIP-NEO-120. *Journal of Research in Personality, 51*, 78-89.
- Maples, J. L., Guan, L., Carter, N. T., & Miller, J. D. (2014). A test of the International Personality Item Pool representation of the revised NEO Personality Inventory and development of a 120-item IPIP-based measure of the Five-Factor Model. *Psychological Assessment, 26*, 1070-1084.
- Maples-Keller, J. L., Williamson, R. L., Sleep, C. E., Carter, N. T., Campbell, W. K., & Miller, J. D. (2019). Using item response theory to develop a 60-item representation of the NEO PI-R using the International Personality Item Pool: Development of the IPIP-NEO-60. *Journal of Personality Assessment, 101*, 4-15. DOI: 10.1080/00223891.2017.1381968
- Donnellan, M. B., Oswald, F. L., Baird, B. M., & Lucas, R. E. (2006). The Mini-IPIP scales: Tiny-yet-effective measures of the Big Five factors of personality. *Psychological Assessment, 18*, 192-203.

> **中文译本的官方说明**：Mandarin Chinese Translation and Validation of Johnson's (2014) IPIP-NEO-120，Provided by **Zhongyang Xu**（徐中阳），指导 **张雅博士**。

---

## 六、官方普通话版 120 题：**已完整取回** + 交叉核对（2026-09-11 追记）

> **本节追记，并更正前面若干处已过时的记录** —— 具体是：§一 表格中 `ipip-neo-120-zh.json` 那一行的「**仅 33 ❌**」、§三 中「**第 34–120 题未拿到**」、§二 注 2 中「**本次只抓到 33 题**」、以及 §一 末尾「**合计实得 673 条**」。
> **按纪律：上面这些原文一律不删除，只在此处更正。** 更正后的数字：中文档 **120/120**，全目录合计实得题项 **760 条**（300+120+120+**120**+60+50+20）。

### 6.1 33/120 是怎么变成 120/120 的

| 项 | 内容 |
|---|---|
| **当时为什么只有 33** | **纯工具截断** —— 该页是一张超长 HTML 表，`web_fetch` 在固定长度处截断，两次独立抓取返回**字节级相同**的截断位置（停在第 33 题之后）。**不是页面限制、不是需要注册、不是题项不存在。** |
| **怎么解决的** | **直连下载整页落盘** → `_raw-mandarin-120.htm`（**175,394 字节 / 3,551 行**） |
| **结构实测** | **121 个表格行元素**（= 1 表头 + **120 题项行**）× **242 个单元格元素**（= 每行 2 格） |
| **中文编码** | 全部是 **HTML 数字字符引用**（形如 `&#20026;`），全文 **1,257 处** → 用 `html.unescape` 解码 |
| **解析方式** | Python，**逐行校验题号**（每格前缀 `{n}.` 必须等于该行行序，任一不符即中止解析）→ **无人工转录** |
| **结果** | `ipip-neo-120-zh.json`：**120 条**，`item_no` 恰为 **1..120**（无重复、无缺） |
| **原件保留** | ✅ **`_raw-mandarin-120.htm` 保留在本目录内**，可随时复验；题库文件可由它重新生成 |

### 6.2 两处排版残留（**只做无损清洗，不改写题面**）

| 位置 | 残留 | 处理 |
|---|---|---|
| **第 120 题英文格** | 句末多出四个数字字符引用，解码后为「**窗体底端**」（Word 表单残留） | **已从 `text_en` 去掉**。已**逐格扫描全部 120 条英文格**，**只有第 120 题**受影响；**中文格未受影响** |
| **第 59、101 题英文格** | 句点前多一个空格（`...than myself .`、`Feel comfortable with myself .`） | **原样保留（未静默改正）**，并记入 `formatting_artifact_note`；交叉核对时按归一化处理 |

> ⚠️ **一处刻意的写法选择**：为免将来的自动化检查把"记录残留"误判成"残留仍在"，`typo_residue_note_item_120` 这条注释**用文字描述**该残留而**不重复原始实体写法**；`capture_method` 也不写标签语法。→ 整份 JSON **不含任何数字实体语法、也不含任何标签语法**，简单扫描即可判定干净。

### 6.3 ⭐ 交叉核对：官方中文页 vs Johnson-120 计分键页

**方法**：程序化逐题比对（Python），**同时**做「按题号对齐」与「按题面集合比对」两种。归一化 = 去首尾空白 + 折叠内部空白 + 去掉标点前多余空格。**不是人工目视。**

| 检查 | 结果 |
|---|---|
| **按题号对齐后逐题相同** | **2 / 120** ❌ |
| **按题面集合比对（多重集）共同条数** | **117 / 120** |
| 只在中文页出现的题面 | **3** |
| 只在计分键页出现的题面 | **3** |
| 题面在两侧唯一时可按文本精确对上 | **117 / 120** |
| **对不上的例外** | **3 条：中文页第 28、58、88 题** |
| 两侧是否有重复题面（会造成多义） | **否，两侧各 0 条重复** → 文本匹配**无歧义** |

**⚠️ 结论一：两页题号完全不对齐，「按 `item_no` 对齐」是错的。**
`ipip-neo-120.json` 是**按层面分组**排列；官方中文页是**按施测顺序打散**排列。**同一套 120 题，两套编号。**（§四 推断 5 在此得到证实。）

**结论二：两页是同一套 120 题，只有 3 条题面措辞不同。**

| 中文页题号 | 中文页的英文题面 | 计分键页对应条 | 层面 |
|---|---|---|---|
| **28** | `View myself as predominantly liberal politically.` | **69** `Tend to vote for liberal political candidates.` | **O6** |
| **58** | `Believe that there is no absolute right or wrong.` | **70** `Believe that there is no absolute right and wrong.` | **O6** |
| **88** | `View myself as predominantly conservative politically.` | **71** `Tend to vote for conservative political candidates.` | **O6** |

（第 58 条只差一个词：中文页写 `or`，计分键页写 `and`。）

**结论三：这 3 条例外全部落在同一个层面 —— O6「开放性 · 价值观」**（政治倾向 / 价值判断类题）。

**顺带所得（对"要不要用官方中文"有用）**：按 117 条可确定项反查，**30 个层面全部覆盖**，其中 **29 个层面各对上 4 条**、**O6 只对上 1 条**（另 3 条即上表例外）；维度分布 **N 24 / E 24 / A 24 / C 24 / O 21**；计分方向 **`+` 63 / `-` 54**。→ 与"每层面 4 题"的 120 题结构**一致**。

### 6.4 ⚠️ 因此：`dimension` / `facet` / `keying` **仍然全部保持 `null`**

| 判断 | 说明 |
|---|---|
| **能推出的** | 按**题面文本精确一致**，**117/120** 可以确定对应到计分键页的哪一条 → 进而取得它的 dimension / facet / keying。**这是事实，不是猜。** |
| **不能推出的** | 剩下 **3 条（28/58/88）无法用文本对上**。它们同属 O6，但**「中文页这道题就等于计分键页 69/70/71」这一步是推断，不是原文**。 |
| **本次的处理** | **120 条的 dimension / facet / keying 一律留 `null`** —— 因为一篇题库里**混着"可确定"与"待裁定"两种状态**，比全留空**更容易被误用**。 |
| **因此** | 🚫 **中文题 → 30 层面的映射尚未建立，且不能想当然。** 是否采用「117 条按文本匹配 + 3 条人工裁定」的方案，**由上层决定**；本目录只提供**数字与例外清单**。 |

### 6.5 本次校验（5 项，全部通过）

| # | 项 | 结果 |
|---|---|---|
| 1 | 120 条、`item_no` 恰为 1..120、无重复无缺、`instrument` 统一、dim/facet/keying 全为 null | ✅ 通过 |
| 2 | `text_zh` 无空、无残留实体、无标签 | ✅ 通过 |
| 3 | `text_en` 无空、无残留实体、无"窗体底端"、无非 ASCII 混入 | ✅ 通过 |
| 4 | JSON 可被 `json.load` 解析 | ✅ 通过（**46,168 字节**） |
| 5 | 抽查第 1 / 60 / 120 题 | ✅ 见下 |

- **第 1 题**：EN `Worry about things.` ／ ZH `为很多事情感到担心`
- **第 60 题**：EN `Make rash decisions.` ／ ZH `会做出草率的决定`
- **第 120 题**：EN `Act without thinking.`（**已去除残留**）／ ZH `做事不经过思考`

> **未受影响的部分**：§二 关于 IPIP-NEO-60 是否落在 120 题里的结论（51/60 Johnson、58/60 Maples、60/60 三百题池）**只依赖各档位的英文计分键页**，与本次的中文档补齐**无关**，结论不变。
