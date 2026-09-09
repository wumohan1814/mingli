# 任务总览 · 2026-09-09 晚 · REQ-084 桌面宠物动画样片 v2

## 已完成（本轮 · 第七轮）

**REQ-084 桌面宠物式三化身动画** —— 样片阶段 v2 交付（国学 + 小鸟 FX）。

### 交付物

| 资产 | 路径 | 体积 |
|---|---|---|
| 国学化身 sprite (WebP) | `frontend/public/art/taichu-pet/mascot-guoxue.webp` | 332.0 KB |
| 国学化身 sprite (PNG) | `frontend/public/art/taichu-pet/mascot-guoxue.png` | 1236.2 KB |
| 小鸟 FX (WebP) | `frontend/public/art/taichu-pet/fx-bird.webp` | 11.4 KB |
| 小鸟 FX (PNG) | `frontend/public/art/taichu-pet/fx-bird.png` | 36.1 KB |
| 需求文档（状态：🟡 样片已交付 v2） | `docs/exchange/素材需求文档-第七轮-REQ084桌面宠物动画.md` | 4 个待确认单已锁默认 |
| 美术交付回执 | `docs/exchange/美术交付回执-2026-09-09-req084-sample.md` | 含 9 项关键技术经验沉淀（A-I） |
| HTML 动画预览 | `docs/icon-preview-req084.html` | filmstrip 同步高亮 + 单角色循环 + sprite 原图 + 小鸟飞入 |

### 本轮 v2 微调（用户反馈驱动）

| 项 | v1 → v2 变化 |
|---|---|
| F1 佛珠 | 裸手无佛珠 → 双手明确握住 108 佛珠于腹前，拇指轻捻，金色流苏垂落 |
| 小鸟风格 | 写实圆胖鸟（圆胖+橘嘴+羽毛纹理）→ 上美影 80 年代水墨/线描简笔画（墨青墨线+描金眼点） |
| F1 构图 | 接受"略近"trade-off（强调"hands clearly holding"导致模型拉近），同角色同姿态，循环节奏不受影响 |

## 关键技术突破（沉淀进 MEMORY）

1. **ImageGen image-to-image + input_fidelity:high** —— 解决跨帧角色一致性难题（纯文本 prompt 必漂移）
2. **每帧实采样 BG 色作 key target** —— image-to-image 模式 BG 实际色 ≠ prompt 指定色
3. **"Frame number N." 唯一前缀** —— 避免 5 帧共享秒级时间戳互相覆盖
4. **sprite 帧按帧号排序非字母序** —— 避免 CSS steps 播放错乱
5. **WebP 透明保留** —— RGBA 透明画布 + 用帧 alpha 作 paste mask
6. **transparent RGBA → precompose 才能喂 compose.py** —— RGBA 透明底经 convert('RGB') 后 top-center 会采到角色色；必须先 8% padding + 暖灰 (208,199,185) BG 填充
7. **绝不要重复 precompose** —— 1024→1186→1374 角色 cell 内比例过小
8. **input_fidelity:high 收敛于 master 视觉风格** —— 同 master 下不同 prompt 微调产出收敛；想改构图需换 master 但换 master 会带入风格漂移

## 已知偏差（不阻塞接入）

- 国学 sprite 瞳色为**黑**非金（master 选择妥协点；如需金瞳需重选 master 重生成）
- F1 构图略近 F2-F10（强调"佛珠在双手"导致模型拉近），同角色不同 cell 尺寸；若需严格统一需换 master 重做（边际成本 ~5-10 credits + 风格漂移风险）
- 2×5 sprite 用 steps(10) 跨行播放 50% 处有"跳行"瞬间（属正常）

## 待用户确认（确认后批量 ~34 credits / 10 分钟）

- [ ] **国学 sprite v2 方向是否通过**（佛珠明确入双手 + 黑瞳 + 略近构图）
- [ ] **小鸟上美影简笔画风格是否通过**（墨青墨线 + 描金眼点）
- [ ] **西式化身 master**：用现有 `module-mascot/xishi-mascot.webp` 作 init_image（观星仰望动作）
- [ ] **MBTI 化身 master**：用现有 `module-mascot/mbti-mascot.webp` 作 init_image（摇椅版）
- [ ] **4 枚 FX 风格锁定**（蝴蝶/星星×2/星座连线）：沿用上美影简笔画线描风，与国学小鸟同语言

确认后批量生成：西式 sprite (10 帧) + MBTI sprite (10 帧) + 4 枚 FX。

## 仍搁置（跨轮）

- 《UI需求-交互改版.md》代码落地
- 塔罗背景 4 方案选定接入
- #5–#8 背景图排期
- 生肖 medallion 方向
- MBTI 美术方向（本轮仍跳过）
- 第三轮 #1a/#2a 循环元素（可选增强）

## 失败帧归档（rejected/）

- `Frame_number_one_OLD_no_beads.png` —— v1 F1，hands 无佛珠
- `Frame_number_one_v2_close_up.png` —— 首次修复版，构图偏近（备用）
- `Frame_number_one_v3_double_padded.png` —— 重复 precompose 导致 1374 过大
- `Frame_number_one_BAD_gold_pupils_medallion.png` —— 换 module-mascot master 引发金瞳回归 + 圆形法盘 + 披风变蓝

## 费用

- v1 样片：10 帧 + 1 F2 重生成 + 1 小鸟 ≈ 60-80 credits（init_image + high fidelity 单价上浮）
- v2 微调：F1 重绘 1 + 小鸟 1 + F1 重试构图 2 ≈ 25-35 credits
- **本轮累计 ≈ 85-115 credits**