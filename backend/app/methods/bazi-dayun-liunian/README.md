# bazi-dayun-liunian — 大运流年

| 项 | 值 |
|---|---|
| method key | `bazi-dayun-liunian` |
| 方法 | 大运流年 |
| 盘面片段 | `bazi.qi_yun + bazi.da_yun + timeline_20y` |
| 排盘引擎 | lunar-python |
| 提示词 | `backend/prompts/method-prompts/bazi-dayun-liunian.md` |
| 切片文件 | `slices/bazi-dayun-liunian.json` |

## 契约

输入 `MethodInput`（自己的 slice + 自己的 method-prompt + 主问 / 校准反馈）；
输出 `method-result v2`。**只吃自己的 slice，禁止注入其它方法内容。**

## 降级

盘面片段为 `null` 或提示词缺失 → 本方法不参与本次分析，记入 `degraded_methods`，严禁脑补。
