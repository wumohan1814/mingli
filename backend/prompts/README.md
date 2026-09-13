# prompts/ — 提示词资产

| 子目录 | 内容 | 注入范围 |
|---|---|---|
| `method-prompts/` | 8 个命盘类方法各一份 `<method-key>.md`；可选专题 `bazi-hunyin-caiyun.md`；合并裁决 `synthesis-merge.md` | **只注入对应方法模块** |
| `shared/` | 建档、校验、路由、输出、证据、归档等 shared 提示词 | 只注入主会话 / 主模块，**不注入方法子会话** |

## 硬约束（mingli-reference `SKILL.md` §0「子会话注入边界」）

- 方法模块只拿自己的 `<method-key>.md` + 自己的 slice。
- **不得**把 shared 提示词或其它方法的 prompt 注入方法模块；违反即视为越界，输出作废重跑。
- 提示词是"生成侧合规护栏"的载体：强制"趋势 / 参考"话术、禁绝对化断语、禁区不输出。

## 归属：自研（ADR-0001）

提示词由命理太初自研，`reference/mingli-reference/references/` 仅作结构与注入边界的**设计参考**。
不采用软链 / 复制 / submodule 等引入方式——引入等于把上游形态带进自研实现。

## 纪律

- 提示词变更需版本化记录，并防 prompt 漂移；**案例库回归锚点由 Phase2 提前到 MVP 必做**
  （ADR-0001 代价：失去上游兜底，需自行守住质量）。
- 提示词是"生成侧合规护栏"的载体，必须与 `product/compliance/` 的词表与话术规范保持一致。
