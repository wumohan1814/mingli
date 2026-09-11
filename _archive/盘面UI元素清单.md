# 盘面（chart）UI 元素清单

> 供 UI / 前端实现「完整盘面展示」用。数据源 = 后端 `charts` 表的 `chart_json`（由 Python 排盘脚本确定性生成，**零 LLM**）。
> 现状：档案页只展示了「日主 + 农历」摘要，太简略。以下是完整盘面需要的 UI 元素，按流派分组，附字段路径。

---

## 1. 八字盘（bazi）—— 必做，最核心

### 1.1 四柱表（主视觉）
一张 4 列（年柱/月柱/日柱/时柱）× 多行的表格，每柱展示：

| 行 | 字段 | 示例 |
|---|---|---|
| 天干 | `pillars.{柱}.gan` | 庚 |
| 地支 | `pillars.{柱}.zhi` | 午 |
| 五行 | `gan_wuxing` / `zhi_wuxing` | 金 / 火 |
| 十神（天干） | `shishen_gan` | 正财 |
| 十神（地支） | `shishen_zhi`（数组） | 比肩、食神 |
| 藏干 | `hide_gan[]`（{gan, shishen}） | 丁(比肩)、己(食神) |
| 纳音 | `nayin` | 路旁土 |
| 十二长生 | `dish` | 临官 |

- **日主高亮**：`day_master` + `day_master_wuxing`（如「日主：庚金」），放在四柱表上方。

### 1.2 辅助信息行
- 命宫 `ming_gong` / 身宫 `shen_gong` / 胎元 `tai_yuan` / 旬空 `xun_kong`（一行小字）。

### 1.3 神煞标签
- `shensha[]`（每项 `name/category/pillars/target`）渲染成彩色小标签（如「驿马·年支」「天乙贵人」）。

### 1.4 大运表
- 起运：`qi_yun.forward`（顺/逆）、`qi_yun.start`（起运公历）、`qi_yun.start_age`（起运年龄）。
- 8 步大运：`da_yun[]` 每行 `ganzhi` + `start_year–end_year` + `age_start–age_end`。

### 1.5 流年时间轴（timeline_20y）
- `timeline_20y[]`：`year / age / da_yun_ganzhi / liu_nian_ganzhi / events[]`（冲合/神煞）。
- 建议做成横向时间轴或年份列表，事件用小字标注。

---

## 2. 紫微盘（ziwei）

- **十二宫圆盘**：`palaces[]` 12 宫，每宫显示 `name / heavenly_stem / earthly_branch / major_stars / minor_stars / adjective_stars / sihua`，`is_body_palace` 标出身宫。
- **命宫/身宫**：`soul` / `body` + `soul_palace` / `body_palace`。
- **四化表**：`sihua[]`（`star + mutagen + palace`）。
- 五行局 `five_elements_class`、农历 `lunar_date`。

> 建议做成经典紫微斗数圆盘（12 宫围一圈，中心标命身）。

---

## 3. 占星盘（western）

- **星盘圆图**：`planets[]`（行星落座落宫）、`angles[]`（四轴 ASC/MC/…）、`houses[]`（宫位）、`aspects[]`（相位）。
- `summary` 可作概览文字。

> 建议做成西占星盘圆图（内圈宫位 + 外圈星座 + 相位线）。

---

## 4. 七政四余（qizheng）

- 命宫 `mingGong` / 身宫 `shenGong` / 命主 `mingZhu`。
- 星曜躔次表 `stars[]`、十二宫 `twelvePalaces[]`、神煞 `shensha[]`、命度/宿度相关（`mansionModel` 等按实际字段）。

---

## 5. 奇门终身局（qimen_lifetime）

- **九宫格**：`baseChart`（九宫 + 九星八门八神 + 四干落宫）。
- `personalMarkers` / `stages`（分限行运）做成分段标签或时间线。

---

## 6. 五运六气（wuyun_liuqi）

- `birth_year`（出生年运气组合）+ `current_year`（当前年运气组合）：岁运/司天在泉/主客气等做成两列对比表。

---

## 实现建议

1. **先做八字盘**（§1，信息最全、用户最常看），再做紫微圆盘（§2），其余按需。
2. 数据直接从 `GET /api/cases/{id}/archive` 的 `data.chart.data` 取（已返回完整 `chart_json`），无需新接口、无需 LLM。
3. 每个流派做成**可折叠的独立区块（tab / accordion）**，默认展开八字盘。
4. 术语旁尽量带白话注释（如「正财 = 稳定收入来源」），呼应已加的「通俗化约束」。

## 需要后端配合的（我可以做）

- 目前 `archive` 已返回完整 `chart_json`（`data.chart.data`），UI 直接消费即可，**无需额外后端改动**。
- 若某些流派字段（western/qizheng/qimen）结构需要更友好的「已简化」版本，告诉我，我可以让后端在 archive 里额外投影一份精简盘面。
