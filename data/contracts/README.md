# contracts/ — 跨模块契约样例

存放可直接被测试引用的 JSON 样例，作为"唯一协商点"的物证：

| 文件（待建） | 来源 |
|---|---|
| `chart.sample.json` | `paipan.py` 产出（唯一事实源结构） |
| `method-result.sample.json` | `method-result v2`（mingli `SKILL.md` §3） |
| `calibration-record.sample.json` | `校准记录.json`（`score.py` 读取格式） |
| `validation.sample.json` | `<key>.validation.json` 结构 |

改契约必须同步：本目录样例 → `docs/standards/03` → 前端 `src/types/` → 后端实现。
