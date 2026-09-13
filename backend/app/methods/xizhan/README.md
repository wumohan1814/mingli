# xizhan — 西式占星

> ⚠️ **节139：本方法已摘出 `METHOD_KEYS` 注册表**（西占退出「九法→八法合一」综合流水线）。
> 目录与提示词保留（可能复用），但**不再被加载、不再切片、不参与合成**；`chart.json.western`
> 仍由排盘生成，供档案详情「占星盘」tab 与西式占卜独立链路（`/astrology/chart`）使用。
> 下方契约为摘出前的历史描述，保留备查。

| 项 | 值 |
|---|---|
| method key | `xizhan` |
| 方法 | 西式占星 |
| 盘面片段 | `western` |
| 排盘引擎 | mingyu-core (Node) |
| 提示词 | `backend/prompts/method-prompts/xizhan.md` |
| 切片文件 | `slices/xizhan.json` |

## 契约

输入 `MethodInput`（自己的 slice + 自己的 method-prompt + 主问 / 校准反馈）；
输出 `method-result v2`。**只吃自己的 slice，禁止注入其它方法内容。**

## 降级

盘面片段为 `null` 或提示词缺失 → 本方法不参与本次分析，记入 `degraded_methods`，严禁脑补。
