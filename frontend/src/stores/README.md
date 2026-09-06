# stores/ — 客户端状态

鉴权态、当前 case、问卷草稿、UI 偏好。

- 服务端数据（盘面、报告、对话）**不入 store**，由请求层缓存管理，避免双份事实源。
- 命名后缀 `Store`，如 `authStore.ts`、`caseStore.ts`。
