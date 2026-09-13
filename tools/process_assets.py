"""
命理 · 美术素材后处理 (v2)
- 白键控抠图（带抗锯齿 alpha 渐变）— 用于透明器物
- 右下角 AI 水印擦除（用上方同列底色回填）— 用于不透明牌背
- 居中裁剪到目标比例再 LANCZOS 缩放到目标像素
- 输出 WebP(alpha) + PNG 母版，体积超限时自动降质
"""
import os
import sys
from PIL import Image, ImageChops

ROOT = r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art"


def whitekey_rgba(im, tol_inner=5, tol_outer=34):
    im = im.convert("RGB")
    white = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im, white)
    r, g, b = diff.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)

    def _map(v):
        if v <= tol_inner:
            return 0
        if v >= tol_outer:
            return 255
        return int(round((v - tol_inner) * 255 / (tol_outer - tol_inner)))

    alpha = mx.point(_map, mode="L")
    im.putalpha(alpha)
    return im


def remove_bottomright_watermark(im, frac_w=0.09, frac_h=0.05, sample_above=20):
    """右下角矩形用其正上方的同列像素回填（针对星空类底色近似均匀）。"""
    im = im.convert("RGB")
    W, H = im.size
    bw, bh = int(W * frac_w), int(H * frac_h)
    x0, y0 = W - bw, H - bh  # 矩形左上
    # 从矩形正上方 sample_above 像素处逐列取色，向下填充矩形
    src_y0 = max(0, y0 - sample_above)
    for x in range(x0, W):
        for y in range(y0, H):
            im.putpixel((x, y), im.getpixel((x, src_y0 + (y - y0) % sample_above)))
    return im


def crop_to_aspect_resize(im, tw, th):
    iw, ih = im.size
    tr, ir = tw / th, iw / ih
    if ir > tr:
        new_w = int(round(ih * tr))
        left = (iw - new_w) // 2
        box = (left, 0, left + new_w, ih)
    elif ir < tr:
        new_h = int(round(iw / tr))
        top = (ih - new_h) // 2
        box = (0, top, iw, top + new_h)
    else:
        box = (0, 0, iw, ih)
    return im.crop(box).resize((tw, th), Image.LANCZOS)


def save_with_limit(im, out_path, fmt, limit_kb, start_q=90, min_q=60, has_alpha=True):
    q = start_q
    last = None
    while q >= min_q:
        params = {"quality": q, "method": 6}
        if fmt.upper() == "PNG" and has_alpha:
            params = {"optimize": True}
        if fmt.upper() == "PNG" and not has_alpha:
            params = {"optimize": True}
        im.save(out_path, fmt, **params)
        sz = os.path.getsize(out_path) / 1024.0
        last = (q, sz)
        if sz <= limit_kb:
            return last
        q -= 10
    return last


def process_one(src, subdir, base, tw, th, limit_kb,
                mode="transparent", remove_wm=False):
    im0 = Image.open(src)
    print(f"\n=== {base} ===")
    print(f"  src: {os.path.basename(src)}  size: {im0.size}  mode: {im0.mode}")
    if mode == "transparent":
        im1 = whitekey_rgba(im0)
        a = im1.split()[-1]
        ext = a.getextrema()
        h = a.histogram()
        n = im1.size[0] * im1.size[1]
        print(f"  alpha extrema: {ext} | fully-transparent: {h[0]/n*100:.1f}% | fully-opaque: {h[255]/n*100:.1f}%")
    else:
        im1 = im0.convert("RGB")
        if remove_wm:
            im1 = remove_bottomright_watermark(im1)
            print("  watermark removed (bottom-right filled with field color)")
    im2 = crop_to_aspect_resize(im1, tw, th)
    out_dir = os.path.join(ROOT, subdir)
    os.makedirs(out_dir, exist_ok=True)
    out_png = os.path.join(out_dir, base + ".png")
    out_webp = os.path.join(out_dir, base + ".webp")
    has_alpha = (mode == "transparent")
    q1, s1 = save_with_limit(im2, out_png, "PNG", limit_kb, has_alpha=has_alpha)
    q2, s2 = save_with_limit(im2, out_webp, "WEBP", limit_kb, has_alpha=has_alpha)
    print(f"  -> {base}.png  q={q1}  {s1:.1f}KB  (limit {limit_kb}KB)")
    print(f"  -> {base}.webp  q={q2}  {s2:.1f}KB  (limit {limit_kb}KB)")
    return {"name": base, "png": out_png, "webp": out_webp,
            "png_kb": s1, "webp_kb": s2, "tw": tw, "th": th, "mode": mode}


BATCH = [
    # #2 签条
    {"src": r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art\ssgw\Isolated_product_asset__transp_2026-09-07T18-22-09.png",
     "subdir": "ssgw", "base": "ssgw-stick", "tw": 90, "th": 360, "limit_kb": 150,
     "mode": "transparent", "remove_wm": False},
    # #3 塔罗牌背
    {"src": r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art\card-back\card-back-tarot_raw.png",
     "subdir": "card-back", "base": "card-back-tarot", "tw": 480, "th": 800, "limit_kb": 300,
     "mode": "opaque", "remove_wm": True},
    # #4 雷诺曼牌背
    {"src": r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art\card-back\card-back-lenormand_raw.png",
     "subdir": "card-back", "base": "card-back-lenormand", "tw": 480, "th": 800, "limit_kb": 300,
     "mode": "opaque", "remove_wm": True},
    # #5 铜钱字面
    {"src": r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art\liuyao\Isolated_product_asset__transp_2026-09-07T18-22-30.png",
     "subdir": "liuyao", "base": "coin-face", "tw": 192, "th": 192, "limit_kb": 200,
     "mode": "transparent", "remove_wm": False},
    # #6 铜钱图案面
    {"src": r"C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art\liuyao\Isolated_product_asset__transp_2026-09-07T18-22-28.png",
     "subdir": "liuyao", "base": "coin-back", "tw": 192, "th": 192, "limit_kb": 200,
     "mode": "transparent", "remove_wm": False},
]


if __name__ == "__main__":
    results = []
    for t in BATCH:
        r = process_one(**t)
        results.append(r)
    print("\n========== SUMMARY ==========")
    for r in results:
        print(f"  {r['name']:<22} {r['tw']}x{r['th']}  png {r['png_kb']:.1f}KB  webp {r['webp_kb']:.1f}KB  [{r['mode']}]")
