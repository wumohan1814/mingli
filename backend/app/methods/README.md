# methods/ — 模块 6：方法模块 ×8

每个方法论一个模块，**并列关系（非主子）**：持有自己的 method-prompt，只吃自己的 slice，
输出 `method-result v2`。

| key | 方法 | 盘面片段 | 排盘引擎 |
|---|---|---|---|
| `bazi-pattern` | 八字格局 | `bazi` | lunar-python |
| `bazi-dayun-liunian` | 大运流年 | `bazi.qi_yun` + `bazi.da_yun` + `timeline_20y` | lunar-python |
| `bazi-shensha-nayin` | 神煞纳音 | `bazi.shensha` + 各柱纳音 | lunar-python |
| `ziwei` | 紫微斗数 | `ziwei` | iztro (Node) |
| `xizhan` | 西式占星 | `western` | mingyu-core (Node) |
| `qizheng` | 七政四余 | `qizheng` | mingyu-core (Node) |
| `qimen-lifetime` | 奇门终身局 | `qimen_lifetime` | mingyu-core vendor 0.2.2 (Node) |
| `wuyun-liuqi` | 五运六气 | `wuyun_liuqi` | mingyu-core (Node) |
| `bazi-hunyin-caiyun` | 八字专题（婚姻 / 财运 / 事业） | `bazi`（全量专题切片） | lunar-python |

> 第 9 法 `bazi-hunyin-caiyun` 由 ADR-0003 纳入，**两阶段都参与**，是「事业运势」主钩子的主方法之一。

## 统一流程

```
订阅 MethodAnalysisRequested（含自己 slice + 主问 / 校准反馈）
  → 注入自己的 method-prompt → 调 LLM
  → 产出 method-result v2
  → 【仅断前尘阶段】经 validation 模块校验，产出 validation.json（ADR-0002）
  → 发布 MethodAnalysisCompleted
```

**落库由用户档案模块统一负责**（订阅 `MethodAnalysisCompleted` 后写库并发布 `RecordPersisted`），
方法模块不写库、不订阅 `RecordPersisted`。

**进度上报由 jobs 模块负责**（订阅 `MethodAnalysisCompleted` 推进计数，ADR-0005），
方法模块不关心自己在第几个。

## 硬约束

1. **注入边界**：每法只喂自己的 slice + 自己的 method-prompt，不注入 shared 文件与其它方法文件。
2. **断前尘严禁并行**：一次只跑一法，等返回再跑下一法（控成本）。
3. 盘面片段为 `null` 或 prompt 缺失 → 该方法不参与，记 `degraded`，**严禁脑补**。

## 已关闭的待决策

- ✅ **校验归属与成本口径（原 P0）** → ADR-0002：校验抽为独立 `../validation/` 模块，
  **仅断前尘阶段**执行，用便宜模型单独计量。首跑成本口径修订为 ~23 次调用（≈15.5 次分析当量）。
- ✅ **`bazi-hunyin-caiyun` 是否纳入（原 P1）** → ADR-0003：两阶段都纳入，成为常驻第 9 法。

## 同源重复识别

`bazi-pattern` / `bazi-dayun-liunian` / `bazi-shensha-nayin` / `bazi-hunyin-caiyun`
**同源自 `bazi`**，阶段 5 合并时它们的一致**不算独立印证**。
