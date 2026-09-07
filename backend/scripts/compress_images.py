#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""REQ-042⑥ 塔罗 / 雷诺曼牌图本地压缩 WebP + 分级缩略图（图片处理，不改前端代码）。

把本地牌图批量转成 WebP，并生成宽约 360px 的缩略图 WebP，用于后续前端提速
（保留相对路径 / 懒加载维持 / 不引外部 CDN，本脚本不改任何前端引用）：

  塔罗 80 张（frontend/public/tarot/rider-waite/720px/*.jpg）：
    原尺寸 WebP -> frontend/public/tarot/rider-waite/webp/<同名>.webp   (quality 80, method 6)
    缩略图 WebP -> frontend/public/tarot/rider-waite/thumb/<同名>.webp (quality 75, 宽约 360)
  雷诺曼 36 张（frontend/public/lenormand/*.png）：
    原尺寸 WebP -> frontend/public/lenormand/webp/<同名>.webp
    缩略图 WebP -> frontend/public/lenormand/thumb/<同名>.webp

保留原 JPG / PNG 不动（不回退破坏现有引用），仅新增 webp/ 与 thumb/ 目录。

幂等：默认跳过"已存在且非空"的目标文件；加 --force 可强制重新生成。

用法：
    python backend/scripts/compress_images.py            # 幂等运行
    python backend/scripts/compress_images.py --force    # 强制覆盖重新生成
    python backend/scripts/compress_images.py --quiet    # 不打印逐文件进度

依赖：Python 3.10+，Pillow（含 WebP 插件）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, features

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# ---- 压缩参数 --------------------------------------------------------------
QUALITY_FULL = 80          # 原尺寸 WebP 质量
QUALITY_THUMB = 75         # 缩略图 WebP 质量
METHOD = 6                 # WebP 压缩方法（0-6，越大越慢但体积越小）
THUMB_WIDTH = 360          # 缩略图目标宽度（等比缩放）

# ---- 数据源配置 ------------------------------------------------------------
# src_glob 只匹配当前目录下的图片（顶层），不递归，避免把已生成的产物再当输入。
GROUPS = [
    {
        "name": "tarot",
        "label": "塔罗 (Rider-Waite)",
        "src": REPO_ROOT / "frontend" / "public" / "tarot" / "rider-waite" / "720px",
        "src_glob": "*.jpg",
        "webp_dir": REPO_ROOT / "frontend" / "public" / "tarot" / "rider-waite" / "webp",
        "thumb_dir": REPO_ROOT / "frontend" / "public" / "tarot" / "rider-waite" / "thumb",
    },
    {
        "name": "lenormand",
        "label": "雷诺曼 (Lenormand)",
        "src": REPO_ROOT / "frontend" / "public" / "lenormand",
        "src_glob": "*.png",
        "webp_dir": REPO_ROOT / "frontend" / "public" / "lenormand" / "webp",
        "thumb_dir": REPO_ROOT / "frontend" / "public" / "lenormand" / "thumb",
    },
]


def _check_webp_support() -> None:
    """确保 Pillow 带 WebP 编码支持，否则直接失败。"""
    # 注：Pillow 12 的 Image.SAVE 是惰性填充的（首次存取后才出现 WEBP），
    # 因此用 features.check() 判断编码支持更可靠。
    if not features.check("webp"):
        sys.exit("错误：当前 Pillow 不支持 WebP 编码（缺 libwebp），无法继续。")


def _is_empty_or_missing(path: Path) -> bool:
    """幂等判断：目标不存在或为空文件时才需要生成。"""
    return not path.exists() or path.stat().st_size == 0


def _scale_to_width(size: tuple[int, int], target_width: int) -> tuple[int, int]:
    """按目标宽度等比缩放；原图更窄则保持不变（不放大）。"""
    width, height = size
    if width <= target_width:
        return size
    new_width = target_width
    new_height = max(1, round(height * target_width / width))
    return (new_width, new_height)


def _save_webp(img: Image.Image, dest: Path, quality: int) -> None:
    """把图像存成 WebP（method 固定为 METHOD），父目录自动创建。"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=quality, method=METHOD)


def _fmt(n: int) -> str:
    """字节数人类可读格式化。"""
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.2f} MB"


def convert_group(group: dict, force: bool, quiet: bool) -> dict:
    """转换一组图片，返回统计信息。"""
    src_dir: Path = group["src"]
    webp_dir: Path = group["webp_dir"]
    thumb_dir: Path = group["thumb_dir"]
    files = sorted(p for p in src_dir.glob(group["src_glob"]) if p.is_file())

    stats = {
        "label": group["label"],
        "name": group["name"],
        "count": 0,
        "skipped": 0,
        "errors": [],
        "src_bytes": 0,
        "webp_bytes": 0,
        "thumb_bytes": 0,
    }

    for src in files:
        stats["src_bytes"] += src.stat().st_size
        stem = src.stem
        webp_out = webp_dir / f"{stem}.webp"
        thumb_out = thumb_dir / f"{stem}.webp"

        need_full = force or _is_empty_or_missing(webp_out)
        need_thumb = force or _is_empty_or_missing(thumb_out)

        if not (need_full or need_thumb):
            stats["skipped"] += 1
            if not quiet:
                print(f"  [跳过] {group['name']}/{stem}.webp（已存在）")
            # 已存在的产物也计入体积统计，保证汇总真实反映磁盘占用
            if webp_out.exists():
                stats["webp_bytes"] += webp_out.stat().st_size
            if thumb_out.exists():
                stats["thumb_bytes"] += thumb_out.stat().st_size
            continue

        try:
            with Image.open(src) as img:
                img.load()
                # WebP 支持 alpha：源图带透明通道则转 RGBA，否则统一 RGB（PNG 可能带调色板/灰度）
                if img.mode != "RGB":
                    if "A" in img.getbands():
                        img = img.convert("RGBA")
                    else:
                        img = img.convert("RGB")

                if need_full:
                    _save_webp(img, webp_out, QUALITY_FULL)
                if need_thumb:
                    thumb_img = img
                    if _scale_to_width(img.size, THUMB_WIDTH) != img.size:
                        thumb_img = img.resize(
                            _scale_to_width(img.size, THUMB_WIDTH),
                            Image.Resampling.LANCZOS,
                        )
                    _save_webp(thumb_img, thumb_out, QUALITY_THUMB)

            stats["count"] += 1
            stats["webp_bytes"] += webp_out.stat().st_size
            stats["thumb_bytes"] += thumb_out.stat().st_size
            if not quiet:
                pct = webp_out.stat().st_size / src.stat().st_size * 100
                print(f"  [转换] {src.name} -> {webp_out.relative_to(REPO_ROOT)}  ({pct:.0f}% of 原图)")
        except Exception as exc:  # noqa: BLE001 —— 单张失败不中断整批
            stats["errors"].append(f"{src.name}: {exc}")
            print(f"  [错误] {src.name}: {exc}", file=sys.stderr)

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="塔罗/雷诺曼牌图本地压缩 WebP + 分级缩略图")
    parser.add_argument("--force", action="store_true", help="强制覆盖已存在（非空）的输出")
    parser.add_argument("--quiet", action="store_true", help="不打印逐文件进度，只输出汇总")
    args = parser.parse_args()

    _check_webp_support()

    print(f"REQ-042⑥ 牌图 WebP 压缩（quality={QUALITY_FULL}/thumb={QUALITY_THUMB}, method={METHOD}, "
          f"thumb 宽={THUMB_WIDTH}px）")
    print(f"force={args.force}\n")

    all_stats = []
    for group in GROUPS:
        src: Path = group["src"]
        if not src.is_dir():
            print(f"[跳过] {group['label']}：源目录不存在 {src}")
            continue
        print(f"== {group['label']}（源：{src.relative_to(REPO_ROOT)}）")
        all_stats.append(convert_group(group, args.force, args.quiet))

    # ---- 汇总输出 -----------------------------------------------------------
    print("\n" + "=" * 78)
    print("汇总（原图总大小 / webp 总大小 / thumb 总大小 / 体积对比）")
    print("=" * 78)
    total_src = total_webp = total_thumb = 0
    total_new = total_skip = 0
    for st in all_stats:
        total_src += st["src_bytes"]
        total_webp += st["webp_bytes"]
        total_thumb += st["thumb_bytes"]
        total_new += st["count"]
        total_skip += st["skipped"]
        w_pct = st["webp_bytes"] / st["src_bytes"] * 100 if st["src_bytes"] else 0.0
        t_pct = st["thumb_bytes"] / st["src_bytes"] * 100 if st["src_bytes"] else 0.0
        print(f"[{st['label']}] 张数={st['count']}（跳过={st['skipped']}）")
        print(f"    原图   : {_fmt(st['src_bytes'])}")
        print(f"    webp   : {_fmt(st['webp_bytes'])}   = 原图的 {w_pct:.1f}%（减少 {100 - w_pct:.1f}%）")
        print(f"    thumb  : {_fmt(st['thumb_bytes'])}   = 原图的 {t_pct:.1f}%（减少 {100 - t_pct:.1f}%）")
        if st["errors"]:
            print(f"    错误   : {len(st['errors'])} 张 -> {', '.join(st['errors'][:5])}")

    if all_stats:
        wp = total_webp / total_src * 100 if total_src else 0.0
        tp = total_thumb / total_src * 100 if total_src else 0.0
        print("-" * 78)
        print(f"合计     : 原图 {_fmt(total_src)} | webp {_fmt(total_webp)} "
              f"({wp:.1f}%) | thumb {_fmt(total_thumb)} ({tp:.1f}%)")
        print(f"本次新生成 {total_new} 张，幂等跳过 {total_skip} 张")

    has_error = any(st["errors"] for st in all_stats)
    if has_error:
        print("\n存在转换失败，见上方 [错误] 行。", file=sys.stderr)
        return 1
    print("\n完成。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
