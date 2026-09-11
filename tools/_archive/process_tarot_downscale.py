#!/usr/bin/env python3
"""塔罗牌面降分辨率（节114）：720x1200 → 480x800

背景（取数结论）：
- 塔罗 full-res webp 原为 720x1200，但 H5 手机端实际显示很小——列表/扇形约
  104–132px 宽、读牌板单元格也远小于 720px，属明显过采样。
- 降到 480x800（比例不变、约 2/3），对 2x Retina 下 240px 以内的显示仍充足；
  掉的是「放大镜也没用到的多余像素」。thumb（360x600）本已够小，不动。
- 原始 720px 素材（jpg）已归档到 _archive/美术-素材原件/tarot/.../720px/，
  日后要更高分辨率可从它重出，本脚本是「向下压」不是「删原件」。

用法：
  python tools/process_tarot_downscale.py

依赖：Pillow（backend 依赖已含；本地已验 webp 支持 True）。
归档：处理完成并验收后，本脚本移入 tools/_archive/ 存档，便于日后查阅参数。
"""
import glob
import io
import os
import sys

from PIL import Image

SRC_GLOB = os.path.join("frontend", "public", "tarot", "rider-waite", "webp", "*.webp")
TARGET_W = 480      # 目标宽度；高度按原比例缩放（720x1200 → 480x800）
QUALITY = 82        # webp 有损质量（0-100）
WEBP_METHOD = 6     # 压缩努力（0-6，越大越省 / 越慢）


def main():
    files = sorted(glob.glob(SRC_GLOB))
    if not files:
        print("未找到文件：", SRC_GLOB)
        sys.exit(1)

    before = 0
    after = 0
    changed = 0
    skipped = 0
    print("target: width=%d quality=%d method=%d" % (TARGET_W, QUALITY, WEBP_METHOD))

    for p in files:
        size0 = os.path.getsize(p)
        before += size0
        with Image.open(p) as im:
            w, h = im.size
            if w <= TARGET_W:
                print("  skip %-24s (%dx%d)" % (os.path.basename(p), w, h))
                skipped += 1
                continue
            th = round(h * TARGET_W / w)
            rgb = im.convert("RGB")
            out = rgb.resize((TARGET_W, th), Image.LANCZOS)
            buf = io.BytesIO()
            out.save(buf, "WEBP", quality=QUALITY, method=WEBP_METHOD)

        with open(p, "wb") as fh:
            fh.write(buf.getvalue())
        size1 = os.path.getsize(p)
        after += size1
        changed += 1
        print("  %-24s %dx%d -> %dx%d  %dKB -> %dKB" % (
            os.path.basename(p), w, h, TARGET_W, th, size0 // 1024, size1 // 1024))

    pct = (100 * after // before) if before else 0
    print("done: changed=%d skipped=%d; total %dKB -> %dKB (%d%%)" % (
        changed, skipped, before // 1024, after // 1024, pct))


if __name__ == "__main__":
    main()