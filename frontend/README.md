# frontend/ — H5 前端

技术栈：**React 18 + Vite 5 + TypeScript 5**（移动端 H5，不做 APP / 小程序）。

## 目录

| 路径 | 内容 |
|---|---|
| `public/` | 静态资源（favicon、CDN 直传文件） |
| `src/pages/` | 页面：落地页、建档、盘面、断前尘问卷、报告、追问修正、命理档案、登录注册 |
| `src/components/` | 组件：基础组件、业务组件、盘面渲染 |
| `src/layouts/` | 布局：移动端框架、导航、安全区适配 |
| `src/hooks/` | 自定义 Hook（长任务轮询、鉴权态、表单） |
| `src/services/` | REST 客户端与接口封装 |
| `src/stores/` | 客户端状态 |
| `src/styles/` | 设计令牌、主题、全局样式、移动端适配 |
| `src/assets/` | 设计资源：图标、字体、插图 |
| `src/types/` | TypeScript 类型，与 `docs/standards/03-接口与数据字典.md` 对齐 |
| `src/utils/` | 工具函数 |

## 关键约束

1. **前端不暴露单方法入口**（技术框架方案 R6④）：MVP 仅暴露"全盘 / 事业运势"主路径。
2. 类型定义必须与接口字典**同源**；改契约先改 `docs/standards/03`，再改 `src/types/`。
3. 断前尘为长任务（可达数分钟），UI 必须有明确的等待与进度反馈（方案待决 ADR-04）。
4. 所有解读内容渲染时**必须保留末行免责**，不得因组件裁剪丢失。

## 待补

- [ ] 工程初始化（Vite 脚手架 + TS 配置 + ESLint / Prettier）
- [ ] 移动端组件库、状态管理、请求层三件套选型（技术栈清单 T2）
