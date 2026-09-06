# xizhan — 西式占星

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
