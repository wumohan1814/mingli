# gateway/ — 模块 2：API 网关 / 鉴权

## 职责

- 路由：`/api/**`，REST/JSON；全盘走主模块，单方法直问走方法模块。
- 鉴权：`Bearer <访问JWT>` 验签名取 `userId`，**注入所有模块调用与 DB 查询作用域**。
- 安全（R10）：登录失败限流与锁定、注册 captcha、同 IP / 账号注册与登录频控。
- 令牌：短访问 JWT（15–30min，含 `userId`，服务端零存储）+ 刷新令牌（7d，服务端存储）。

## 硬约束（C20，TDD 必测）

1. JWT 提取的 `userId` 必须注入所有下游调用，禁止任何绕过 `userId` 作用域的直查。
2. 数据访问统一走 userId-scoped repository。
3. 否定用例：用户 A 持自己 token 请求用户 B 的 `caseId` → 必须 403 / 404，且日志不泄漏 B 的数据。

## 注记

MVP 为**单进程单实例**；JWT 无状态是为 Phase2 水平扩展预留（C24），MVP 阶段不做多实例。
