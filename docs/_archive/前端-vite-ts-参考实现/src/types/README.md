# types/ — 类型定义

与 `docs/standards/03-接口与数据字典.md` **同源**的 TypeScript 类型。

| 文件（待建） | 内容 |
|---|---|
| `api.ts` | REST 信封、各端点请求 / 响应类型 |
| `chart.ts` | `chart.json` 结构（与 mingli `paipan.py` 产出对齐） |
| `method-result.ts` | `method-result v2`（`past_propositions` / `conclusions`） |
| `domain.ts` | `methodKey`、 `phase`、`domain`、`confidenceLevel` 等枚举 |

**变更纪律**：先改 `docs/standards/03`，再改这里，最后改实现。顺序反了即为契约漂移。
