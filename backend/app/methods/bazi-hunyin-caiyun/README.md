# bazi-hunyin-caiyun — 八字专题（婚姻 / 财运 / 事业）

| 项 | 值 |
|---|---|
| method key | `bazi-hunyin-caiyun` |
| 方法 | 八字专题：婚姻 / 财运 / 事业 |
| 盘面片段 | `bazi`（全量八字段，专题切片） |
| 排盘引擎 | lunar-python |
| 提示词 | `backend/prompts/method-prompts/bazi-hunyin-caiyun.md`（自研） |
| 切片文件 | `slices/bazi-hunyin-caiyun.json` |

## 定位

ADR-0003 决定**两阶段都纳入**，本方法是常驻的第 9 个方法模块。

- MVP 主钩子为**事业运势**，本方法是该主问的**主方法**之一（路由表见 `../routing/README.md`）。
- 断前尘阶段同样产出 `past_propositions`，参与问卷合成与校准打分。

## 契约

输入 `MethodInput`（自己的 slice + 自己的 method-prompt + 主问 / 校准反馈）；
输出 `method-result v2`。**只吃自己的 slice，禁止注入其它方法内容。**

## 与其它八字系方法的关系

`bazi-pattern` / `bazi-dayun-liunian` / `bazi-shensha-nayin` 与本方法**同源自 `bazi`**，
阶段 5 合并时它们的一致**不算独立印证**（同源重复识别规则）。
