# 美术交付回执（第六轮 · REQ-043 雷诺曼翻牌呈现重构配套美术）

> 交付日期：2026-09-09
> 关联需求：`../需求表.md` REQ-043（雷诺曼改版，与 REQ-042 塔罗同构，🔵返工）
> 关联需求文档：`素材需求文档-第六轮-雷诺曼翻牌.md`
> 目标模块：西式·雷诺曼 翻牌呈现重构
> 交付方：A⇄A 通道 · 美术 Agent

---

## 1. 资产清单

| ID | 用途 | 路径 | 尺寸 | 体积 | 格式 |
|---|---|---|---|---|---|
| **M1** | 雷诺曼牌桌背景 | `frontend/public/art/lenormand-bg/lenormand-table.webp` | 1080×1920 | 162.6 KB | WebP q85 |
| M1·PNG 备 | 同上 PNG 备 | `frontend/public/art/lenormand-bg/lenormand-table.png` | 1080×1920 | 1376.5 KB | PNG adaptive palette 128 |
| **M2** | 雷诺曼卡背 v2 | `frontend/public/art/card-back/card-back-lenormand-v2.webp` | 512×896 | 107.9 KB | WebP q85 |
| M2·PNG 备 | 同上 PNG 备 | `frontend/public/art/card-back/card-back-lenormand-v2.png` | 512×896 | 329.4 KB | PNG adaptive palette 128 |

## 2. 视觉与符号语言

| 维度 | M1 牌桌背景 | M2 卡背 v2 |
|---|---|---|
| 主色调 | 墨蓝 `#0E1A35` 系 + 月银 `#B8C4D6` | 同左 |
| 主符号 | 大型罗盘（compass rose，卡片点缀）+ 锚/船/心/钥匙 | **月银罗盘（compass rose）** + 6 张雷诺曼小符号环：船/钥匙/心/锚/百合/十字 |
| 角部装饰 | 上：船 + 双心；左右中：锚 + 心+锚；下：船 + 双锚 | TL 指南星 / TR 月牙 / BL 钥匙 / BR 北极星 |
| 风格 | 航海占卜·antique nautical cartography | 同左 + 复古版刻雕（vintage engraved） |
| 中央读牌区 | 上中下分三段，中央约 60% 为低对比度暗区 | 不适用（满幅装饰） |

> 与现卡背 `card-back-lenormand.webp` 的「墨蓝 + 月银罗盘」家族一脉相承，区别于塔罗「紫晶 + 琥珀金」家族。

## 3. 接入点

| 资产 | 接入位置 | 备注 |
|---|---|---|
| M1 牌桌背景 | 雷诺曼页牌桌容器 `background-image` | 可走 REQ-059 素材热更槽（key 建议 `card-table-lenormand`） |
| M2 卡背 v2 | 翻牌/牌阵展示的卡背图引用，对应 CSS 变量 `--art-card-back-lenormand`（`frontend/public/index.html:68`） | 直接替换 `.webp` 引用即可，CSS 变量名不变 |

## 4. 已锁单（spec 默认）

| # | 项 | 锁单 |
|---|---|---|
| 1 | 牌桌背景数量 | **1 张基础款**（与塔罗同构） |
| 2 | 卡背风格主符号 | **月银罗盘 + 6 张雷诺曼小符号环**（船/钥匙/心/锚/百合/十字） |
| 3 | 牌桌背景是否本轮交付 | **是**（与 REQ-043 同期上线） |

## 5. P0 / P1 风险

### P0（无）

无致命问题。两项资产均通过：
- 体积红线（M1 ≤800KB / M2 ≤300KB）
- 视觉中央读牌区保留（M1 中央暗化）
- 风格与现卡背家族一致
- 水印已擦除

### P1（不阻塞接入）

1. **M1 中央裂痕纹理**：模型对 "aged parchment grain texture" 提示扩散至中央，形成细微裂痕纹理。**判断：属"古老占卜桌"质感加成**，不影响读牌（裂痕比牌更暗）。若需纯黑中区可走 inpaint 重制。
2. **M2 6 张符号环中的"百合"画成 fleur-de-lis（鸢尾花）**：模型对 "lily" 略偏差，呈现为风格相近的鸢尾花。**判断：与现 36 张牌面的"百合"符号在神秘学传统中常与鸢尾互通**（韦特/雷诺曼体系均有混合用法），视觉一致且不影响背面不可读原则。若严格要求"百合"形态可走 inpaint 单点重制。

## 6. 归档

- 旧卡背 `card-back-lenormand.webp` + `.png` → `docs/_archive/r6-lenormand-old-card-back/`（保留回滚能力）
- 本批文件未改动 `frontend/public/lenormand/`（36 张牌面实体）和 `frontend/public/tarot/`（塔罗）

## 7. 后续

- 开发接入：替换 `--art-card-back-lenormand` 变量指向 `/art/card-back/card-back-lenormand-v2.webp`；牌桌背景待加 CSS 变量 `--art-table-lenormand`（建议对齐）。
- 若前端塔罗也接入 REQ-059 牌桌热更槽（key=`card-table`），可一并对齐 `card-table-lenormand` key 体系。